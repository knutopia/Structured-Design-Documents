import { createHash } from "node:crypto";
import { access, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Bundle, SyntaxStatementDefinition } from "../bundle/types.js";
import { sortDiagnostics, type Diagnostic } from "../diagnostics/types.js";
import { stripTrailingComment } from "../parser/classifyLine.js";
import type {
  BlankLine,
  CommentLine,
  EdgeLine,
  NodeBlock,
  ParseDocument,
  PropertyLine
} from "../parser/types.js";
import { projectView } from "../projector/projectView.js";
import type { ProjectionResult } from "../projector/types.js";
import type { SourceSpan } from "../types.js";
import { validateGraph } from "../validator/validateGraph.js";
import type {
  ApplyChangeSetArgs,
  ChangeOperation,
  ChangeSetMode,
  ChangeSetResult,
  ChangeSetSummary,
  CreateDocumentArgs,
  CreateDocumentResult,
  DocumentPath,
  DocumentRevision,
  Handle,
  InsertEdgeLineOp,
  InsertNodeBlockOp,
  Placement,
  StructuralRelationshipType,
  ValueKind
} from "./contracts.js";
import { evaluateDocumentText, type EvaluatedDocumentText, type EvaluationOptions } from "./evaluation.js";
import {
  inspectDocumentText,
  type InspectLoadFailure,
  type InspectSourceAccess,
  type InspectTarget,
  type InspectedDocument,
  type OwnedTrivia
} from "./inspect.js";
import {
  createChangeSetJournal,
  createDeleteDocumentInverse,
  createRestoreDocumentInverse,
  type ChangeSetJournal
} from "./journal.js";
import { computeDocumentRevision, normalizeTextToLf, writeCanonicalLfText } from "./revisions.js";
import type { AuthoringWorkspace } from "./workspace.js";

const EMPTY_TEMPLATE_ID = "empty";
const EMPTY_TEMPLATE_VERSION = "0.1";
const MINIMUM_TOP_LEVEL_BLOCKS_CODE = "parse.minimum_top_level_blocks";
const STRUCTURAL_RELATIONSHIP_TYPES = new Set<StructuralRelationshipType>(["CONTAINS", "COMPOSED_OF"]);
const TEMP_HANDLE_PREFIX = "tmp_authoring_";

type TriviaItem = BlankLine | CommentLine;
type StructuralModelItem = NodeModel | PropertyModel | EdgeModel;

interface TriviaLineModel {
  raw: string;
  span: SourceSpan;
}

interface BaseModelItem {
  kind: "node_block" | "property_line" | "edge_line";
  handle?: Handle;
  leadingTrivia: TriviaLineModel[];
}

interface DocumentModel {
  effectiveVersion: string;
  preVersionTrivia: TriviaLineModel[];
  versionLine: string;
  topLevelNodes: NodeModel[];
  trailingTrivia: TriviaLineModel[];
}

interface NodeModel extends BaseModelItem {
  kind: "node_block";
  headerKind: string;
  nodeType: string;
  nodeId: string;
  name: string;
  depth: number;
  rawHeaderLine: string | null;
  headerCommentSuffix: string;
  headerChanged: boolean;
  rawEndLine: string | null;
  bodyItems: StructuralModelItem[];
  bodyTrailingTrivia: TriviaLineModel[];
}

interface PropertyModel extends BaseModelItem {
  kind: "property_line";
  key: string;
  valueKind: ValueKind;
  rawValue: string;
  rawLine: string | null;
  commentSuffix: string;
  lineChanged: boolean;
}

interface EdgeModel extends BaseModelItem {
  kind: "edge_line";
  relType: string;
  to: string;
  toName: string | null;
  event: string | null;
  guard: string | null;
  effect: string | null;
  props: Record<string, string>;
  rawLine: string | null;
  commentSuffix: string;
  lineChanged: boolean;
}

type InternalInsertNodeBlockOp = InsertNodeBlockOp & { __internal_handle?: Handle };
type InternalInsertEdgeLineOp = InsertEdgeLineOp & { __internal_handle?: Handle };

interface AuthoringSyntax {
  versionLiteral: string;
  topHeaderKind: string;
  nestedHeaderKind: string;
  endLiteral: string;
  bareValuePattern: RegExp;
  edgeFieldOrder: string[];
}

export class AuthoringMutationError extends Error {
  readonly diagnostics: Diagnostic[];
  readonly changeSet?: ChangeSetResult;

  constructor(message: string, diagnostics: Diagnostic[], changeSet?: ChangeSetResult) {
    super(message);
    this.name = "AuthoringMutationError";
    this.diagnostics = diagnostics;
    this.changeSet = changeSet;
  }
}

function createTemporaryHandle(label: string): Handle {
  const digest = createHash("sha256").update(label, "utf8").digest("hex");
  return `${TEMP_HANDLE_PREFIX}${digest}`;
}

function isTemporaryHandle(handle: Handle | undefined): handle is Handle {
  return typeof handle === "string" && handle.startsWith(TEMP_HANDLE_PREFIX);
}

function resolveMappedHandle(handle: Handle | undefined, mapping: ReadonlyMap<Handle, Handle>): Handle | undefined {
  if (!handle) {
    return undefined;
  }

  return mapping.get(handle) ?? handle;
}

function createDocumentUri(documentPath: DocumentPath): string {
  return `sdd://document/${documentPath}`;
}

function createDiagnostic(
  file: string,
  code: string,
  message: string,
  span?: SourceSpan
): Diagnostic {
  return {
    stage: "cli",
    code,
    severity: "error",
    message,
    file,
    span
  };
}

function createEmptySummary(): ChangeSetSummary {
  return {
    node_insertions: [],
    node_deletions: [],
    node_renames: [],
    property_changes: [],
    edge_insertions: [],
    edge_deletions: [],
    ordering_changes: []
  };
}

function createBaseChangeSetResult(
  changeSetId: string,
  path: DocumentPath,
  origin: ChangeSetResult["origin"],
  documentEffect: ChangeSetResult["document_effect"],
  baseRevision: DocumentRevision | null,
  mode: ChangeSetMode,
  operations: ChangeOperation[]
): ChangeSetResult {
  return {
    kind: "sdd-change-set",
    change_set_id: changeSetId,
    path,
    origin,
    document_effect: documentEffect,
    base_revision: baseRevision,
    mode,
    status: "rejected",
    undo_eligible: false,
    operations,
    summary: createEmptySummary(),
    diagnostics: []
  };
}

function statementByEmittedKind(bundle: Bundle, kind: string): SyntaxStatementDefinition | undefined {
  return Object.values(bundle.syntax.statements).find((statement) => statement.emits?.kind === kind);
}

function firstLiteral(statement: SyntaxStatementDefinition): string | undefined {
  const literal = statement.sequence?.find((item) => "literal" in item);
  return literal && "literal" in literal ? literal.literal : undefined;
}

function createAuthoringSyntax(bundle: Bundle): AuthoringSyntax {
  const topBlock = bundle.syntax.blocks[bundle.syntax.document.top_level_block_kind];
  const nestedBlockName = topBlock.body_item_kinds.find((itemKind) => itemKind in bundle.syntax.blocks);
  const nestedBlock = nestedBlockName ? bundle.syntax.blocks[nestedBlockName] : undefined;
  const endStatement = bundle.syntax.statements[topBlock.terminator_statement];
  const edgeStatement = statementByEmittedKind(bundle, "EdgeLine");

  return {
    versionLiteral: bundle.syntax.document.version_declaration.literal,
    topHeaderKind: topBlock.header_statement,
    nestedHeaderKind: nestedBlock?.header_statement ?? "nested_node_header",
    endLiteral: firstLiteral(endStatement) ?? "END",
    bareValuePattern: new RegExp(`^(?:${bundle.syntax.lexical.bare_value_pattern})$`),
    edgeFieldOrder: edgeStatement?.fixed_order ?? ["rel_type", "to", "to_name", "event", "guard", "effect", "props"]
  };
}

function extractLeadingWhitespace(rawLine: string): string {
  const match = rawLine.match(/^\s*/u);
  return match?.[0] ?? "";
}

function extractTrailingCommentSuffix(rawLine: string): string {
  const stripped = stripTrailingComment(rawLine);
  if (stripped.commentText === undefined) {
    return "";
  }

  return rawLine.slice(stripped.content.length);
}

function indentForDepth(depth: number): string {
  return "  ".repeat(depth);
}

function quoteString(bundle: Bundle, value: string): string {
  const { delimiter, standardized_escapes } = bundle.syntax.lexical.quoted_string;
  const escapesByValue = new Map(standardized_escapes.map((entry) => [entry.value, entry.literal]));
  let encoded = "";

  for (const character of value) {
    if (character === delimiter) {
      encoded += escapesByValue.get(character) ?? `\\${delimiter}`;
      continue;
    }

    if (character === "\\") {
      encoded += escapesByValue.get(character) ?? "\\\\";
      continue;
    }

    encoded += escapesByValue.get(character) ?? character;
  }

  return `${delimiter}${encoded}${delimiter}`;
}

function emitPropertyValue(bundle: Bundle, valueKind: ValueKind, rawValue: string): string {
  return valueKind === "quoted_string" ? quoteString(bundle, rawValue) : rawValue;
}

function emitEdgePropertyValue(syntax: AuthoringSyntax, bundle: Bundle, rawValue: string): string {
  return syntax.bareValuePattern.test(rawValue) ? rawValue : quoteString(bundle, rawValue);
}

function emitNodeHeaderLine(bundle: Bundle, syntax: AuthoringSyntax, node: NodeModel): string {
  const indent = node.rawHeaderLine ? extractLeadingWhitespace(node.rawHeaderLine) : indentForDepth(node.depth);
  const prefix = node.headerKind === syntax.nestedHeaderKind ? "+ " : "";
  return `${indent}${prefix}${node.nodeType} ${node.nodeId} ${quoteString(bundle, node.name)}${node.headerCommentSuffix}`;
}

function emitPropertyLine(bundle: Bundle, nodeDepth: number, property: PropertyModel): string {
  const indent = property.rawLine ? extractLeadingWhitespace(property.rawLine) : indentForDepth(nodeDepth + 1);
  return `${indent}${property.key}=${emitPropertyValue(bundle, property.valueKind, property.rawValue)}${property.commentSuffix}`;
}

function emitEdgeLine(bundle: Bundle, syntax: AuthoringSyntax, nodeDepth: number, edge: EdgeModel): string {
  const indent = edge.rawLine ? extractLeadingWhitespace(edge.rawLine) : indentForDepth(nodeDepth + 1);
  const fragments: string[] = [];

  for (const fieldName of syntax.edgeFieldOrder) {
    switch (fieldName) {
      case "rel_type":
        fragments.push(edge.relType);
        break;
      case "to":
        fragments.push(edge.to);
        break;
      case "to_name":
        if (edge.toName !== null) {
          fragments.push(quoteString(bundle, edge.toName));
        }
        break;
      case "event":
        if (edge.event !== null) {
          fragments.push(`[${edge.event}]`);
        }
        break;
      case "guard":
        if (edge.guard !== null) {
          fragments.push(`{${edge.guard}}`);
        }
        break;
      case "effect":
        if (edge.effect !== null) {
          fragments.push(`/ ${edge.effect}`);
        }
        break;
      case "props":
        for (const key of Object.keys(edge.props).sort()) {
          fragments.push(`${key}=${emitEdgePropertyValue(syntax, bundle, edge.props[key] ?? "")}`);
        }
        break;
      default:
        break;
    }
  }

  return `${indent}${fragments.join(" ")}${edge.commentSuffix}`;
}

function emitEndLine(syntax: AuthoringSyntax, node: NodeModel): string {
  return node.rawEndLine ?? `${indentForDepth(node.depth)}${syntax.endLiteral}`;
}

function toTriviaLineModel(item: TriviaItem, source: InspectSourceAccess): TriviaLineModel {
  return {
    raw: source.sliceSpan(item.span),
    span: item.span
  };
}

function toTriviaLines(items: TriviaItem[] | undefined, source: InspectSourceAccess): TriviaLineModel[] {
  return (items ?? []).map((item) => toTriviaLineModel(item, source));
}

function createParseItemHandleIndex(inspected: InspectedDocument): Map<object, Handle> {
  const handles = new Map<object, Handle>();
  for (const [handle, target] of inspected.handleIndex.entries()) {
    handles.set(target.kind === "node_block" ? target.node : target.line, handle);
  }
  return handles;
}

function isStructuralTarget(target: InspectTarget | undefined): target is InspectTarget {
  return target !== undefined;
}

function rawLineAtSpan(source: InspectSourceAccess, span: SourceSpan): string {
  return source.lineText(span.line);
}

function splitTrailingTrivia(
  owned: OwnedTrivia | undefined,
  node: NodeBlock,
  source: InspectSourceAccess
): { bodyTrailing: TriviaLineModel[]; documentTrailing: TriviaLineModel[] } {
  const bodyTrailing: TriviaLineModel[] = [];
  const documentTrailing: TriviaLineModel[] = [];

  for (const item of owned?.trailing ?? []) {
    const target = item.span.startOffset >= node.span.endOffset ? documentTrailing : bodyTrailing;
    target.push(toTriviaLineModel(item, source));
  }

  return { bodyTrailing, documentTrailing };
}

function detectVersionLineNumber(source: InspectSourceAccess, firstTopLevelLine: number, versionLiteral: string): number | null {
  for (let lineNumber = 1; lineNumber < firstTopLevelLine; lineNumber += 1) {
    const line = source.lineText(lineNumber).trimStart();
    if (line.startsWith(versionLiteral)) {
      return lineNumber;
    }
  }

  return null;
}

function buildNodeModel(
  node: NodeBlock,
  inspected: InspectedDocument,
  handlesByParseItem: Map<object, Handle>,
  depth: number,
  options: {
    isFirstTopLevel: boolean;
    isLastTopLevel: boolean;
    versionLineNumber: number | null;
  }
): { nodeModel: NodeModel; documentTrailing: TriviaLineModel[] } {
  const handle = handlesByParseItem.get(node);
  const owned = handle ? inspected.rewriteOwnership.byHandle.get(handle) : undefined;
  const leadingTrivia = toTriviaLines(owned?.leading, inspected.source).filter((item) => {
    if (!options.isFirstTopLevel || options.versionLineNumber === null) {
      return true;
    }

    return item.span.line > options.versionLineNumber;
  });
  const { bodyTrailing, documentTrailing } = splitTrailingTrivia(owned, node, inspected.source);
  const nodeModel: NodeModel = {
    kind: "node_block",
    handle,
    leadingTrivia,
    headerKind: node.headerKind,
    nodeType: node.nodeType,
    nodeId: node.id,
    name: node.name,
    depth,
    rawHeaderLine: inspected.source.sliceSpan(node.headerSpan),
    headerCommentSuffix: extractTrailingCommentSuffix(inspected.source.sliceSpan(node.headerSpan)),
    headerChanged: false,
    rawEndLine: rawLineAtSpan(inspected.source, {
      ...node.headerSpan,
      line: node.span.endLine,
      endLine: node.span.endLine,
      column: 1,
      endColumn: inspected.source.lineText(node.span.endLine).length + 1,
      startOffset: node.span.endOffset - inspected.source.lineText(node.span.endLine).length,
      endOffset: node.span.endOffset
    }),
    bodyItems: [],
    bodyTrailingTrivia: bodyTrailing
  };

  for (const bodyItem of node.bodyItems) {
    if (bodyItem.kind === "BlankLine" || bodyItem.kind === "CommentLine") {
      continue;
    }

    const bodyHandle = handlesByParseItem.get(bodyItem);
    const bodyOwned = bodyHandle ? inspected.rewriteOwnership.byHandle.get(bodyHandle) : undefined;
    const leading = toTriviaLines(bodyOwned?.leading, inspected.source);

    if (bodyItem.kind === "PropertyLine") {
      nodeModel.bodyItems.push({
        kind: "property_line",
        handle: bodyHandle,
        leadingTrivia: leading,
        key: bodyItem.key,
        valueKind: bodyItem.valueKind,
        rawValue: bodyItem.rawValue,
        rawLine: inspected.source.sliceSpan(bodyItem.span),
        commentSuffix: extractTrailingCommentSuffix(inspected.source.sliceSpan(bodyItem.span)),
        lineChanged: false
      });
      continue;
    }

    if (bodyItem.kind === "EdgeLine") {
      nodeModel.bodyItems.push({
        kind: "edge_line",
        handle: bodyHandle,
        leadingTrivia: leading,
        relType: bodyItem.relType,
        to: bodyItem.to,
        toName: bodyItem.toName,
        event: bodyItem.event,
        guard: bodyItem.guard,
        effect: bodyItem.effect,
        props: Object.fromEntries(bodyItem.props.map((prop) => [prop.key, prop.rawValue])),
        rawLine: inspected.source.sliceSpan(bodyItem.span),
        commentSuffix: extractTrailingCommentSuffix(inspected.source.sliceSpan(bodyItem.span)),
        lineChanged: false
      });
      continue;
    }

    const nestedNode = buildNodeModel(bodyItem, inspected, handlesByParseItem, depth + 1, {
      isFirstTopLevel: false,
      isLastTopLevel: false,
      versionLineNumber: null
    });
    nestedNode.nodeModel.leadingTrivia = leading;
    nodeModel.bodyItems.push(nestedNode.nodeModel);
  }

  return {
    nodeModel,
    documentTrailing: options.isLastTopLevel ? documentTrailing : []
  };
}

function buildDocumentModel(inspected: InspectedDocument, bundle: Bundle): DocumentModel {
  const handlesByParseItem = createParseItemHandleIndex(inspected);
  const topLevelNodes = inspected.document.items.filter((item): item is NodeBlock => item.kind === "NodeBlock");
  const firstTopLevelNode = topLevelNodes[0];
  const versionLineNumber = firstTopLevelNode
    ? detectVersionLineNumber(inspected.source, firstTopLevelNode.headerSpan.line, bundle.syntax.document.version_declaration.literal)
    : null;
  const preVersionTrivia = inspected.document.items
    .filter((item): item is TriviaItem => item.kind === "BlankLine" || item.kind === "CommentLine")
    .filter((item) => versionLineNumber !== null && item.span.line < versionLineNumber)
    .map((item) => toTriviaLineModel(item, inspected.source));
  const versionLine =
    versionLineNumber !== null
      ? inspected.source.lineText(versionLineNumber)
      : `${bundle.syntax.document.version_declaration.literal} ${inspected.document.effectiveVersion}`;
  const documentModel: DocumentModel = {
    effectiveVersion: inspected.document.effectiveVersion,
    preVersionTrivia,
    versionLine,
    topLevelNodes: [],
    trailingTrivia: []
  };

  topLevelNodes.forEach((node, index) => {
    const built = buildNodeModel(node, inspected, handlesByParseItem, 0, {
      isFirstTopLevel: index === 0,
      isLastTopLevel: index === topLevelNodes.length - 1,
      versionLineNumber
    });
    documentModel.topLevelNodes.push(built.nodeModel);
    if (index === topLevelNodes.length - 1) {
      documentModel.trailingTrivia = built.documentTrailing;
    }
  });

  return documentModel;
}

function findNodeByHandle(nodes: NodeModel[], handle: Handle): NodeModel | undefined {
  for (const node of nodes) {
    if (node.handle === handle) {
      return node;
    }

    const nested = findNodeByHandle(
      node.bodyItems.filter((item): item is NodeModel => item.kind === "node_block"),
      handle
    );
    if (nested) {
      return nested;
    }
  }

  return undefined;
}

function findBodyParentForHandle(nodes: NodeModel[], handle: Handle): { parent: NodeModel; index: number } | undefined {
  for (const node of nodes) {
    const index = node.bodyItems.findIndex((item) => item.handle === handle);
    if (index !== -1) {
      return { parent: node, index };
    }

    const nested = findBodyParentForHandle(
      node.bodyItems.filter((item): item is NodeModel => item.kind === "node_block"),
      handle
    );
    if (nested) {
      return nested;
    }
  }

  return undefined;
}

function findTopLevelIndex(model: DocumentModel, handle: Handle): number {
  return model.topLevelNodes.findIndex((node) => node.handle === handle);
}

function placementError(documentPath: DocumentPath, message: string): Diagnostic {
  return createDiagnostic(documentPath, "sdd.invalid_placement", message);
}

function handleError(documentPath: DocumentPath, handle: string): Diagnostic {
  return createDiagnostic(documentPath, "sdd.invalid_handle", `Handle '${handle}' is not valid for the base revision.`);
}

function createRejectedChangeSet(
  result: ChangeSetResult,
  diagnostics: Diagnostic[],
  evaluated?: EvaluatedDocumentText
): ChangeSetResult {
  result.status = "rejected";
  result.undo_eligible = false;
  result.diagnostics = sortDiagnostics([...(evaluated?.diagnostics ?? []), ...diagnostics]);
  result.projection_results = evaluated?.projectionResults;
  delete result.resulting_revision;
  return result;
}

function isBootstrapMinimumTopLevelFailure(result: InspectLoadFailure, text: string): boolean {
  return (
    text === emptyTemplateText() &&
    result.diagnostics.length > 0 &&
    result.diagnostics.every((diagnostic) => diagnostic.code === MINIMUM_TOP_LEVEL_BLOCKS_CODE)
  );
}

function emptyTemplateText(): string {
  return `SDD-TEXT ${EMPTY_TEMPLATE_VERSION}\n`;
}

function appendLines(target: string[], lines: TriviaLineModel[] | string[]): void {
  for (const line of lines) {
    target.push(typeof line === "string" ? line : line.raw);
  }
}

function renderNode(bundle: Bundle, syntax: AuthoringSyntax, node: NodeModel, output: string[]): void {
  appendLines(output, node.leadingTrivia);
  output.push(node.rawHeaderLine === null || node.headerChanged ? emitNodeHeaderLine(bundle, syntax, node) : node.rawHeaderLine);

  for (const item of node.bodyItems) {
    if (item.kind === "node_block") {
      renderNode(bundle, syntax, item, output);
    } else if (item.kind === "property_line") {
      appendLines(output, item.leadingTrivia);
      output.push(item.rawLine === null || item.lineChanged ? emitPropertyLine(bundle, node.depth, item) : item.rawLine);
    } else {
      appendLines(output, item.leadingTrivia);
      output.push(item.rawLine === null || item.lineChanged ? emitEdgeLine(bundle, syntax, node.depth, item) : item.rawLine);
    }
  }

  appendLines(output, node.bodyTrailingTrivia);
  output.push(emitEndLine(syntax, node));
}

function renderDocumentModel(bundle: Bundle, syntax: AuthoringSyntax, model: DocumentModel): string {
  const lines: string[] = [];
  appendLines(lines, model.preVersionTrivia);
  lines.push(model.versionLine);
  for (const node of model.topLevelNodes) {
    renderNode(bundle, syntax, node, lines);
  }
  appendLines(lines, model.trailingTrivia);
  const rendered = lines.join("\n");
  return rendered.endsWith("\n") ? rendered : `${rendered}\n`;
}

function createEmptyDocumentModel(bundle: Bundle): DocumentModel {
  const syntax = createAuthoringSyntax(bundle);
  return {
    effectiveVersion: EMPTY_TEMPLATE_VERSION,
    preVersionTrivia: [],
    versionLine: `${syntax.versionLiteral} ${EMPTY_TEMPLATE_VERSION}`,
    topLevelNodes: [],
    trailingTrivia: []
  };
}

function ensurePlacementAnchor(
  documentPath: DocumentPath,
  placement: Placement,
  targetIndex: number,
  anchorLabel: string
): Diagnostic | undefined {
  if ((placement.mode === "before" || placement.mode === "after") && targetIndex === -1) {
    return handleError(documentPath, placement.anchor_handle ?? anchorLabel);
  }

  return undefined;
}

function requireAnchorForRelativePlacement(
  documentPath: DocumentPath,
  placement: Placement
): Diagnostic | undefined {
  if ((placement.mode === "before" || placement.mode === "after") && !placement.anchor_handle) {
    return placementError(documentPath, "Placement mode 'before' or 'after' requires anchor_handle.");
  }

  return undefined;
}

function topLevelInsertIndex(model: DocumentModel, documentPath: DocumentPath, placement: Placement): number | Diagnostic {
  switch (placement.mode) {
    case "first":
      return 0;
    case "last":
      return model.topLevelNodes.length;
    case "before": {
      const index = placement.anchor_handle ? findTopLevelIndex(model, placement.anchor_handle) : -1;
      return ensurePlacementAnchor(documentPath, placement, index, "<missing>") ?? index;
    }
    case "after": {
      const index = placement.anchor_handle ? findTopLevelIndex(model, placement.anchor_handle) : -1;
      return ensurePlacementAnchor(documentPath, placement, index, "<missing>") ?? index + 1;
    }
  }
}

function bodyInsertIndex(parent: NodeModel, documentPath: DocumentPath, placement: Placement): number | Diagnostic {
  switch (placement.mode) {
    case "first":
      return 0;
    case "last":
      return parent.bodyItems.length;
    case "before": {
      const index = placement.anchor_handle
        ? parent.bodyItems.findIndex((item) => item.handle === placement.anchor_handle)
        : -1;
      return ensurePlacementAnchor(documentPath, placement, index, "<missing>") ?? index;
    }
    case "after": {
      const index = placement.anchor_handle
        ? parent.bodyItems.findIndex((item) => item.handle === placement.anchor_handle)
        : -1;
      return ensurePlacementAnchor(documentPath, placement, index, "<missing>") ?? index + 1;
    }
  }
}

function createNodeModel(syntax: AuthoringSyntax, depth: number, op: InsertNodeBlockOp): NodeModel {
  const internalOperation = op as InternalInsertNodeBlockOp;
  return {
    kind: "node_block",
    handle: internalOperation.__internal_handle,
    leadingTrivia: [],
    headerKind: depth === 0 ? syntax.topHeaderKind : syntax.nestedHeaderKind,
    nodeType: op.node_type,
    nodeId: op.node_id,
    name: op.name,
    depth,
    rawHeaderLine: null,
    headerCommentSuffix: "",
    headerChanged: true,
    rawEndLine: null,
    bodyItems: [],
    bodyTrailingTrivia: []
  };
}

function isBootstrapInsertOperation(operation: ChangeOperation): operation is InsertNodeBlockOp {
  return (
    operation.kind === "insert_node_block" &&
    operation.placement.stream === "top_level" &&
    (operation.placement.mode === "first" || operation.placement.mode === "last") &&
    operation.placement.anchor_handle === undefined &&
    operation.placement.parent_handle === undefined
  );
}

function applyInsertNodeBlock(
  model: DocumentModel,
  syntax: AuthoringSyntax,
  documentPath: DocumentPath,
  operation: InsertNodeBlockOp,
  summary: ChangeSetSummary
): Diagnostic | undefined {
  const internalOperation = operation as InternalInsertNodeBlockOp;
  if (operation.placement.stream === "top_level") {
    if (operation.placement.parent_handle !== undefined) {
      return placementError(documentPath, "Top-level node insertion must not specify parent_handle.");
    }

    const index = topLevelInsertIndex(model, documentPath, operation.placement);
    if (typeof index !== "number") {
      return index;
    }

    model.topLevelNodes.splice(index, 0, createNodeModel(syntax, 0, operation));
  } else {
    if (!operation.placement.parent_handle) {
      return placementError(documentPath, "Body insertion must specify parent_handle.");
    }

    const parent = findNodeByHandle(model.topLevelNodes, operation.placement.parent_handle);
    if (!parent) {
      return handleError(documentPath, operation.placement.parent_handle);
    }

    const index = bodyInsertIndex(parent, documentPath, operation.placement);
    if (typeof index !== "number") {
      return index;
    }

    model.topLevelNodes = model.topLevelNodes.map((node) => node);
    parent.bodyItems.splice(index, 0, createNodeModel(syntax, parent.depth + 1, operation));
  }

  summary.node_insertions.push({
    handle: internalOperation.__internal_handle,
    node_id: operation.node_id,
    node_type: operation.node_type
  });
  return undefined;
}

function applyDeleteNodeBlock(
  model: DocumentModel,
  documentPath: DocumentPath,
  operation: Extract<ChangeOperation, { kind: "delete_node_block" }>,
  summary: ChangeSetSummary
): Diagnostic | undefined {
  const topLevelIndex = findTopLevelIndex(model, operation.node_handle);
  if (topLevelIndex !== -1) {
    const [removed] = model.topLevelNodes.splice(topLevelIndex, 1);
    summary.node_deletions.push({
      handle: operation.node_handle,
      node_id: removed?.nodeId
    });
    return undefined;
  }

  const bodyParent = findBodyParentForHandle(model.topLevelNodes, operation.node_handle);
  if (!bodyParent || bodyParent.parent.bodyItems[bodyParent.index]?.kind !== "node_block") {
    return handleError(documentPath, operation.node_handle);
  }

  const [removed] = bodyParent.parent.bodyItems.splice(bodyParent.index, 1);
  summary.node_deletions.push({
    handle: operation.node_handle,
    node_id: removed && removed.kind === "node_block" ? removed.nodeId : undefined
  });
  return undefined;
}

function applySetNodeName(
  model: DocumentModel,
  documentPath: DocumentPath,
  operation: Extract<ChangeOperation, { kind: "set_node_name" }>,
  summary: ChangeSetSummary
): Diagnostic | undefined {
  const node = findNodeByHandle(model.topLevelNodes, operation.node_handle);
  if (!node) {
    return handleError(documentPath, operation.node_handle);
  }

  const previousName = node.name;
  node.name = operation.name;
  node.headerChanged = true;
  summary.node_renames.push({
    handle: operation.node_handle,
    from: previousName,
    to: operation.name
  });
  return undefined;
}

function propertyMatches(node: NodeModel, key: string): Array<{ item: PropertyModel; index: number }> {
  return node.bodyItems
    .map((item, index) => ({ item, index }))
    .filter((entry): entry is { item: PropertyModel; index: number } => entry.item.kind === "property_line" && entry.item.key === key);
}

function applySetNodeProperty(
  model: DocumentModel,
  documentPath: DocumentPath,
  operation: Extract<ChangeOperation, { kind: "set_node_property" }>,
  summary: ChangeSetSummary
): Diagnostic | undefined {
  const node = findNodeByHandle(model.topLevelNodes, operation.node_handle);
  if (!node) {
    return handleError(documentPath, operation.node_handle);
  }

  const matchingProperties = propertyMatches(node, operation.key);
  if (matchingProperties.length > 1) {
    return createDiagnostic(
      documentPath,
      "sdd.ambiguous_target",
      `Node '${operation.node_handle}' has multiple '${operation.key}' properties.`
    );
  }

  if (matchingProperties.length === 1) {
    const existing = matchingProperties[0]!.item;
    const previousValue = existing.rawValue;
    existing.valueKind = operation.value_kind;
    existing.rawValue = operation.raw_value;
    existing.lineChanged = true;
    summary.property_changes.push({
      node_handle: operation.node_handle,
      key: operation.key,
      from: previousValue,
      to: operation.raw_value
    });
    return undefined;
  }

  const newProperty: PropertyModel = {
    kind: "property_line",
    leadingTrivia: [],
    key: operation.key,
    valueKind: operation.value_kind,
    rawValue: operation.raw_value,
    rawLine: null,
    commentSuffix: "",
    lineChanged: true
  };
  const lastPropertyIndex = [...node.bodyItems].reverse().findIndex((item) => item.kind === "property_line");
  if (lastPropertyIndex !== -1) {
    const insertIndex = node.bodyItems.length - lastPropertyIndex;
    node.bodyItems.splice(insertIndex, 0, newProperty);
  } else {
    const firstNonProperty = node.bodyItems.findIndex((item) => item.kind !== "property_line");
    node.bodyItems.splice(firstNonProperty === -1 ? 0 : firstNonProperty, 0, newProperty);
  }

  summary.property_changes.push({
    node_handle: operation.node_handle,
    key: operation.key,
    to: operation.raw_value
  });
  return undefined;
}

function applyRemoveNodeProperty(
  model: DocumentModel,
  documentPath: DocumentPath,
  operation: Extract<ChangeOperation, { kind: "remove_node_property" }>,
  summary: ChangeSetSummary
): Diagnostic | undefined {
  const node = findNodeByHandle(model.topLevelNodes, operation.node_handle);
  if (!node) {
    return handleError(documentPath, operation.node_handle);
  }

  const matchingProperties = propertyMatches(node, operation.key);
  if (matchingProperties.length > 1) {
    return createDiagnostic(
      documentPath,
      "sdd.ambiguous_target",
      `Node '${operation.node_handle}' has multiple '${operation.key}' properties.`
    );
  }

  if (matchingProperties.length === 0) {
    return createDiagnostic(
      documentPath,
      "sdd.invalid_handle",
      `Property '${operation.key}' does not exist on node '${operation.node_handle}'.`
    );
  }

  const match = matchingProperties[0]!;
  node.bodyItems.splice(match.index, 1);
  summary.property_changes.push({
    node_handle: operation.node_handle,
    key: operation.key,
    from: match.item.rawValue
  });
  return undefined;
}

function defaultEdgeInsertIndex(parent: NodeModel): number {
  for (let index = parent.bodyItems.length - 1; index >= 0; index -= 1) {
    if (parent.bodyItems[index]?.kind === "edge_line") {
      return index + 1;
    }
  }

  for (let index = parent.bodyItems.length - 1; index >= 0; index -= 1) {
    if (parent.bodyItems[index]?.kind === "property_line") {
      return index + 1;
    }
  }

  const firstNestedNode = parent.bodyItems.findIndex((item) => item.kind === "node_block");
  return firstNestedNode === -1 ? 0 : firstNestedNode;
}

function isStructuralRelationshipType(value: string): value is StructuralRelationshipType {
  return STRUCTURAL_RELATIONSHIP_TYPES.has(value as StructuralRelationshipType);
}

function findBodyItemLocation(
  nodes: NodeModel[],
  handle: Handle
): { parent: NodeModel; index: number; item: StructuralModelItem } | undefined {
  const parent = findBodyParentForHandle(nodes, handle);
  if (!parent) {
    return undefined;
  }

  const item = parent.parent.bodyItems[parent.index];
  if (!item) {
    return undefined;
  }

  return {
    parent: parent.parent,
    index: parent.index,
    item
  };
}

function moveArrayItem<T>(items: T[], fromIndex: number, insertIndex: number): number {
  const [item] = items.splice(fromIndex, 1);
  const normalizedIndex = insertIndex > fromIndex ? insertIndex - 1 : insertIndex;
  items.splice(normalizedIndex, 0, item as T);
  return normalizedIndex;
}

function structuralStreamBodyIndexes(parent: NodeModel, relType: StructuralRelationshipType): number[] {
  return parent.bodyItems.flatMap((item, index) =>
    item.kind === "edge_line" && item.relType === relType ? [index] : []
  );
}

function structuralStreamHandles(parent: NodeModel, relType: StructuralRelationshipType): Handle[] {
  return parent.bodyItems.flatMap((item) =>
    item.kind === "edge_line" && item.relType === relType && item.handle ? [item.handle] : []
  );
}

function bodyStreamHandles(parent: NodeModel): Handle[] {
  return parent.bodyItems.flatMap((item) => (item.handle ? [item.handle] : []));
}

function resolveTopLevelNodeIndex(
  model: DocumentModel,
  documentPath: DocumentPath,
  handle: Handle
): number | Diagnostic {
  const topLevelIndex = findTopLevelIndex(model, handle);
  if (topLevelIndex !== -1) {
    return topLevelIndex;
  }

  if (findNodeByHandle(model.topLevelNodes, handle)) {
    return placementError(documentPath, "Top-level node reordering requires a top-level node handle.");
  }

  return handleError(documentPath, handle);
}

function applyRepositionTopLevelNode(
  model: DocumentModel,
  documentPath: DocumentPath,
  operation: Extract<ChangeOperation, { kind: "reposition_top_level_node" }>,
  summary: ChangeSetSummary
): Diagnostic | undefined {
  if (operation.placement.stream !== "top_level") {
    return placementError(documentPath, "Top-level node reordering must target the top-level stream.");
  }
  if (operation.placement.parent_handle !== undefined) {
    return placementError(documentPath, "Top-level node reordering must not specify parent_handle.");
  }

  const anchorRequirement = requireAnchorForRelativePlacement(documentPath, operation.placement);
  if (anchorRequirement) {
    return anchorRequirement;
  }

  const targetIndex = resolveTopLevelNodeIndex(model, documentPath, operation.node_handle);
  if (typeof targetIndex !== "number") {
    return targetIndex;
  }

  let insertIndex: number;
  switch (operation.placement.mode) {
    case "first":
      insertIndex = 0;
      break;
    case "last":
      insertIndex = model.topLevelNodes.length;
      break;
    case "before":
    case "after": {
      if (operation.placement.anchor_handle === operation.node_handle) {
        return placementError(documentPath, "Placement anchor_handle must differ from the target node.");
      }

      const anchorIndex = resolveTopLevelNodeIndex(model, documentPath, operation.placement.anchor_handle as Handle);
      if (typeof anchorIndex !== "number") {
        return anchorIndex;
      }

      insertIndex = operation.placement.mode === "before" ? anchorIndex : anchorIndex + 1;
      break;
    }
  }

  const newIndex = moveArrayItem(model.topLevelNodes, targetIndex, insertIndex);
  if (newIndex === targetIndex) {
    return undefined;
  }

  summary.ordering_changes.push({
    kind: "top_level_node",
    target_handle: operation.node_handle,
    old_index: targetIndex,
    new_index: newIndex
  });
  return undefined;
}

function applyRepositionStructuralEdge(
  model: DocumentModel,
  documentPath: DocumentPath,
  operation: Extract<ChangeOperation, { kind: "reposition_structural_edge" }>,
  summary: ChangeSetSummary
): Diagnostic | undefined {
  if (operation.placement.stream !== "body") {
    return placementError(documentPath, "Structural edge reordering must target the body stream.");
  }
  if (!operation.placement.parent_handle) {
    return placementError(documentPath, "Structural edge reordering requires parent_handle.");
  }

  const anchorRequirement = requireAnchorForRelativePlacement(documentPath, operation.placement);
  if (anchorRequirement) {
    return anchorRequirement;
  }

  const parent = findNodeByHandle(model.topLevelNodes, operation.placement.parent_handle);
  if (!parent) {
    return handleError(documentPath, operation.placement.parent_handle);
  }

  const targetLocation = findBodyItemLocation(model.topLevelNodes, operation.edge_handle);
  if (!targetLocation) {
    return handleError(documentPath, operation.edge_handle);
  }
  if (targetLocation.parent.handle !== operation.placement.parent_handle) {
    return placementError(documentPath, "Structural edge reordering target must belong to placement.parent_handle.");
  }
  if (targetLocation.item.kind !== "edge_line") {
    return placementError(documentPath, "Structural edge reordering requires an edge handle.");
  }
  if (!isStructuralRelationshipType(targetLocation.item.relType)) {
    return placementError(
      documentPath,
      "Structural edge reordering only supports CONTAINS and COMPOSED_OF edge handles."
    );
  }

  const relType = targetLocation.item.relType;
  const oldStructuralStream = structuralStreamHandles(parent, relType);
  const oldIndex = oldStructuralStream.indexOf(operation.edge_handle);
  if (oldIndex === -1) {
    return placementError(documentPath, "Structural edge reordering target is not part of the requested parent stream.");
  }

  let insertIndex: number;
  switch (operation.placement.mode) {
    case "first": {
      const bodyIndexes = structuralStreamBodyIndexes(parent, relType);
      insertIndex = bodyIndexes[0] ?? targetLocation.index;
      break;
    }
    case "last": {
      const bodyIndexes = structuralStreamBodyIndexes(parent, relType);
      const lastBodyIndex = bodyIndexes[bodyIndexes.length - 1];
      insertIndex = lastBodyIndex === undefined ? targetLocation.index + 1 : lastBodyIndex + 1;
      break;
    }
    case "before":
    case "after": {
      if (operation.placement.anchor_handle === operation.edge_handle) {
        return placementError(documentPath, "Placement anchor_handle must differ from the target edge.");
      }

      const anchorLocation = findBodyItemLocation(
        model.topLevelNodes,
        operation.placement.anchor_handle as Handle
      );
      if (!anchorLocation) {
        return handleError(documentPath, operation.placement.anchor_handle as Handle);
      }
      if (anchorLocation.parent.handle !== operation.placement.parent_handle) {
        return placementError(documentPath, "Structural edge anchor must belong to placement.parent_handle.");
      }
      if (anchorLocation.item.kind !== "edge_line" || anchorLocation.item.relType !== relType) {
        return placementError(
          documentPath,
          `Structural edge anchor must be a ${relType} edge in the same parent body stream.`
        );
      }

      insertIndex = operation.placement.mode === "before" ? anchorLocation.index : anchorLocation.index + 1;
      break;
    }
  }

  const newBodyIndex = moveArrayItem(parent.bodyItems, targetLocation.index, insertIndex);
  const newStructuralStream = structuralStreamHandles(parent, relType);
  const newIndex = newStructuralStream.indexOf(operation.edge_handle);
  if (newBodyIndex === targetLocation.index || newIndex === oldIndex) {
    return undefined;
  }

  summary.ordering_changes.push({
    kind: "structural_edge",
    target_handle: operation.edge_handle,
    parent_handle: operation.placement.parent_handle,
    old_index: oldIndex,
    new_index: newIndex
  });
  return undefined;
}

function applyMoveNestedNodeBlock(
  model: DocumentModel,
  documentPath: DocumentPath,
  operation: Extract<ChangeOperation, { kind: "move_nested_node_block" }>,
  summary: ChangeSetSummary
): Diagnostic | undefined {
  if (operation.placement.stream !== "body") {
    return placementError(documentPath, "Nested node movement must target the body stream.");
  }
  if (!operation.placement.parent_handle) {
    return placementError(documentPath, "Nested node movement requires parent_handle.");
  }

  const anchorRequirement = requireAnchorForRelativePlacement(documentPath, operation.placement);
  if (anchorRequirement) {
    return anchorRequirement;
  }

  const requestedParent = findNodeByHandle(model.topLevelNodes, operation.placement.parent_handle);
  if (!requestedParent) {
    return handleError(documentPath, operation.placement.parent_handle);
  }

  const topLevelIndex = findTopLevelIndex(model, operation.node_handle);
  if (topLevelIndex !== -1) {
    return placementError(documentPath, "Nested node movement requires a nested node block handle.");
  }

  const targetLocation = findBodyItemLocation(model.topLevelNodes, operation.node_handle);
  if (!targetLocation) {
    return handleError(documentPath, operation.node_handle);
  }
  if (targetLocation.parent.handle !== operation.placement.parent_handle) {
    return placementError(documentPath, "Nested node movement target must belong to placement.parent_handle.");
  }
  if (targetLocation.item.kind !== "node_block") {
    return placementError(documentPath, "Nested node movement requires a nested node block handle.");
  }

  const oldIndex = bodyStreamHandles(requestedParent).indexOf(operation.node_handle);
  if (oldIndex === -1) {
    return placementError(documentPath, "Nested node movement target is not part of the requested parent body stream.");
  }

  let insertIndex: number;
  switch (operation.placement.mode) {
    case "first":
      insertIndex = 0;
      break;
    case "last":
      insertIndex = requestedParent.bodyItems.length;
      break;
    case "before":
    case "after": {
      if (operation.placement.anchor_handle === operation.node_handle) {
        return placementError(documentPath, "Placement anchor_handle must differ from the target node.");
      }

      const anchorLocation = findBodyItemLocation(
        model.topLevelNodes,
        operation.placement.anchor_handle as Handle
      );
      if (!anchorLocation) {
        return handleError(documentPath, operation.placement.anchor_handle as Handle);
      }
      if (anchorLocation.parent.handle !== operation.placement.parent_handle) {
        return placementError(documentPath, "Nested node movement anchor must belong to placement.parent_handle.");
      }

      insertIndex = operation.placement.mode === "before" ? anchorLocation.index : anchorLocation.index + 1;
      break;
    }
  }

  const newIndex = moveArrayItem(requestedParent.bodyItems, targetLocation.index, insertIndex);
  const reorderedBodyStream = bodyStreamHandles(requestedParent);
  const newBodyIndex = reorderedBodyStream.indexOf(operation.node_handle);
  if (newIndex === targetLocation.index || newBodyIndex === oldIndex) {
    return undefined;
  }

  summary.ordering_changes.push({
    kind: "nested_node_block",
    target_handle: operation.node_handle,
    parent_handle: operation.placement.parent_handle,
    old_index: oldIndex,
    new_index: newBodyIndex
  });
  return undefined;
}

function applyInsertEdgeLine(
  model: DocumentModel,
  documentPath: DocumentPath,
  operation: InsertEdgeLineOp,
  summary: ChangeSetSummary
): Diagnostic | undefined {
  const internalOperation = operation as InternalInsertEdgeLineOp;
  const parent = findNodeByHandle(model.topLevelNodes, operation.parent_handle);
  if (!parent) {
    return handleError(documentPath, operation.parent_handle);
  }

  let insertIndex: number;
  if (!operation.placement) {
    insertIndex = defaultEdgeInsertIndex(parent);
  } else {
    if (operation.placement.stream !== "body") {
      return placementError(documentPath, "Edge insertion placement must target the body stream.");
    }
    if (operation.placement.parent_handle && operation.placement.parent_handle !== operation.parent_handle) {
      return placementError(documentPath, "Edge insertion parent_handle must match the operation parent_handle.");
    }

    const computedIndex = bodyInsertIndex(parent, documentPath, operation.placement);
    if (typeof computedIndex !== "number") {
      return computedIndex;
    }
    insertIndex = computedIndex;
  }

  parent.bodyItems.splice(insertIndex, 0, {
    kind: "edge_line",
    handle: internalOperation.__internal_handle,
    leadingTrivia: [],
    relType: operation.rel_type,
    to: operation.to,
    toName: operation.to_name ?? null,
    event: operation.event ?? null,
    guard: operation.guard ?? null,
    effect: operation.effect ?? null,
    props: { ...(operation.props ?? {}) },
    rawLine: null,
    commentSuffix: "",
    lineChanged: true
  });

  summary.edge_insertions.push({
    handle: internalOperation.__internal_handle,
    parent_handle: operation.parent_handle,
    rel_type: operation.rel_type,
    to: operation.to
  });
  return undefined;
}

function applyRemoveEdgeLine(
  model: DocumentModel,
  documentPath: DocumentPath,
  operation: Extract<ChangeOperation, { kind: "remove_edge_line" }>,
  summary: ChangeSetSummary
): Diagnostic | undefined {
  const bodyParent = findBodyParentForHandle(model.topLevelNodes, operation.edge_handle);
  if (!bodyParent) {
    return handleError(documentPath, operation.edge_handle);
  }

  const target = bodyParent.parent.bodyItems[bodyParent.index];
  if (!target || target.kind !== "edge_line") {
    return handleError(documentPath, operation.edge_handle);
  }

  bodyParent.parent.bodyItems.splice(bodyParent.index, 1);
  summary.edge_deletions.push({
    handle: operation.edge_handle,
    parent_handle: bodyParent.parent.handle ?? operation.edge_handle,
    rel_type: target.relType,
    to: target.to
  });
  return undefined;
}

function applyOperation(
  model: DocumentModel,
  syntax: AuthoringSyntax,
  documentPath: DocumentPath,
  operation: ChangeOperation,
  summary: ChangeSetSummary
): Diagnostic | undefined {
  switch (operation.kind) {
    case "insert_node_block":
      return applyInsertNodeBlock(model, syntax, documentPath, operation, summary);
    case "delete_node_block":
      return applyDeleteNodeBlock(model, documentPath, operation, summary);
    case "set_node_name":
      return applySetNodeName(model, documentPath, operation, summary);
    case "set_node_property":
      return applySetNodeProperty(model, documentPath, operation, summary);
    case "remove_node_property":
      return applyRemoveNodeProperty(model, documentPath, operation, summary);
    case "insert_edge_line":
      return applyInsertEdgeLine(model, documentPath, operation, summary);
    case "remove_edge_line":
      return applyRemoveEdgeLine(model, documentPath, operation, summary);
    case "reposition_top_level_node":
      return applyRepositionTopLevelNode(model, documentPath, operation, summary);
    case "reposition_structural_edge":
      return applyRepositionStructuralEdge(model, documentPath, operation, summary);
    case "move_nested_node_block":
      return applyMoveNestedNodeBlock(model, documentPath, operation, summary);
    default:
      return createDiagnostic(
        documentPath,
        "sdd.unsupported_operation",
        "Operation is not implemented in checkpoint 4."
      );
  }
}

function collectTemporaryHandleMappingsFromItems(
  sourceItems: StructuralModelItem[],
  candidateItems: StructuralModelItem[],
  mapping: Map<Handle, Handle>
): void {
  const count = Math.min(sourceItems.length, candidateItems.length);
  for (let index = 0; index < count; index += 1) {
    const sourceItem = sourceItems[index];
    const candidateItem = candidateItems[index];
    if (!sourceItem || !candidateItem || sourceItem.kind !== candidateItem.kind) {
      continue;
    }

    if (isTemporaryHandle(sourceItem.handle) && candidateItem.handle) {
      mapping.set(sourceItem.handle, candidateItem.handle);
    }

    if (sourceItem.kind === "node_block" && candidateItem.kind === "node_block") {
      collectTemporaryHandleMappingsFromItems(sourceItem.bodyItems, candidateItem.bodyItems, mapping);
    }
  }
}

function collectTemporaryHandleMappings(
  model: DocumentModel,
  candidateInspected: InspectedDocument,
  bundle: Bundle
): Map<Handle, Handle> {
  const mapping = new Map<Handle, Handle>();
  const candidateModel = buildDocumentModel(candidateInspected, bundle);

  collectTemporaryHandleMappingsFromItems(
    model.topLevelNodes,
    candidateModel.topLevelNodes,
    mapping
  );

  return mapping;
}

function remapPlacementHandles(
  placement: Placement,
  mapping: ReadonlyMap<Handle, Handle>
): Placement {
  return {
    ...placement,
    anchor_handle: resolveMappedHandle(placement.anchor_handle, mapping),
    parent_handle: resolveMappedHandle(placement.parent_handle, mapping)
  };
}

export function remapOperationHandles(
  operations: ChangeOperation[],
  mapping: ReadonlyMap<Handle, Handle>
): ChangeOperation[] {
  return operations.map((operation) => {
    switch (operation.kind) {
      case "insert_node_block":
        return {
          kind: operation.kind,
          node_type: operation.node_type,
          node_id: operation.node_id,
          name: operation.name,
          placement: remapPlacementHandles(operation.placement, mapping)
        };
      case "delete_node_block":
        return {
          kind: operation.kind,
          node_handle: resolveMappedHandle(operation.node_handle, mapping) ?? operation.node_handle
        };
      case "set_node_name":
        return {
          kind: operation.kind,
          node_handle: resolveMappedHandle(operation.node_handle, mapping) ?? operation.node_handle,
          name: operation.name
        };
      case "set_node_property":
        return {
          kind: operation.kind,
          node_handle: resolveMappedHandle(operation.node_handle, mapping) ?? operation.node_handle,
          key: operation.key,
          value_kind: operation.value_kind,
          raw_value: operation.raw_value
        };
      case "remove_node_property":
        return {
          kind: operation.kind,
          node_handle: resolveMappedHandle(operation.node_handle, mapping) ?? operation.node_handle,
          key: operation.key
        };
      case "insert_edge_line":
        return {
          kind: operation.kind,
          parent_handle: resolveMappedHandle(operation.parent_handle, mapping) ?? operation.parent_handle,
          rel_type: operation.rel_type,
          to: operation.to,
          to_name: operation.to_name,
          event: operation.event,
          guard: operation.guard,
          effect: operation.effect,
          props: operation.props ? { ...operation.props } : undefined,
          placement: operation.placement ? remapPlacementHandles(operation.placement, mapping) : undefined
        };
      case "remove_edge_line":
        return {
          kind: operation.kind,
          edge_handle: resolveMappedHandle(operation.edge_handle, mapping) ?? operation.edge_handle
        };
      case "reposition_top_level_node":
        return {
          kind: operation.kind,
          node_handle: resolveMappedHandle(operation.node_handle, mapping) ?? operation.node_handle,
          placement: remapPlacementHandles(operation.placement, mapping)
        };
      case "reposition_structural_edge":
        return {
          kind: operation.kind,
          edge_handle: resolveMappedHandle(operation.edge_handle, mapping) ?? operation.edge_handle,
          placement: remapPlacementHandles(operation.placement, mapping)
        };
      case "move_nested_node_block":
        return {
          kind: operation.kind,
          node_handle: resolveMappedHandle(operation.node_handle, mapping) ?? operation.node_handle,
          placement: remapPlacementHandles(operation.placement, mapping)
        };
    }
  });
}

function remapSummaryHandles(
  summary: ChangeSetSummary,
  mapping: ReadonlyMap<Handle, Handle>
): ChangeSetSummary {
  return {
    node_insertions: summary.node_insertions.map((entry) => ({
      ...entry,
      handle: resolveMappedHandle(entry.handle, mapping)
    })),
    node_deletions: summary.node_deletions.map((entry) => ({
      ...entry,
      handle: resolveMappedHandle(entry.handle, mapping) ?? entry.handle
    })),
    node_renames: summary.node_renames.map((entry) => ({
      ...entry,
      handle: resolveMappedHandle(entry.handle, mapping) ?? entry.handle
    })),
    property_changes: summary.property_changes.map((entry) => ({
      ...entry,
      node_handle: resolveMappedHandle(entry.node_handle, mapping) ?? entry.node_handle
    })),
    edge_insertions: summary.edge_insertions.map((entry) => ({
      ...entry,
      handle: resolveMappedHandle(entry.handle, mapping),
      parent_handle: resolveMappedHandle(entry.parent_handle, mapping) ?? entry.parent_handle
    })),
    edge_deletions: summary.edge_deletions.map((entry) => ({
      ...entry,
      handle: resolveMappedHandle(entry.handle, mapping) ?? entry.handle,
      parent_handle: resolveMappedHandle(entry.parent_handle, mapping) ?? entry.parent_handle
    })),
    ordering_changes: summary.ordering_changes.map((entry) => ({
      ...entry,
      target_handle: resolveMappedHandle(entry.target_handle, mapping) ?? entry.target_handle,
      parent_handle: resolveMappedHandle(entry.parent_handle, mapping)
    }))
  };
}

export interface ExecuteChangeOperationsArgs extends ApplyChangeSetArgs {
  origin?: ChangeSetResult["origin"];
  allowEmptyTemplateBootstrap?: boolean;
}

export interface ExecuteChangeOperationsResult {
  changeSet: ChangeSetResult;
  tempHandleMapping: Map<Handle, Handle>;
}

function prepareOperationsForExecution(
  changeSetId: string,
  operations: ChangeOperation[]
): ChangeOperation[] {
  return operations.map((operation, index) => {
    switch (operation.kind) {
      case "insert_node_block": {
        const internalOperation = operation as InternalInsertNodeBlockOp;
        return {
          ...operation,
          __internal_handle:
            internalOperation.__internal_handle ??
            createTemporaryHandle(`${changeSetId}|node|${index}|${operation.node_id}`)
        } as ChangeOperation;
      }
      case "insert_edge_line": {
        const internalOperation = operation as InternalInsertEdgeLineOp;
        return {
          ...operation,
          __internal_handle:
            internalOperation.__internal_handle ??
            createTemporaryHandle(`${changeSetId}|edge|${index}|${operation.parent_handle}|${operation.rel_type}|${operation.to}`)
        } as ChangeOperation;
      }
      default:
        return operation;
    }
  });
}

export async function executeChangeOperations(
  workspace: AuthoringWorkspace,
  bundle: Bundle,
  args: ExecuteChangeOperationsArgs,
  journal = createChangeSetJournal(workspace)
): Promise<ExecuteChangeOperationsResult> {
  const resolvedPath = workspace.resolveDocumentPath(args.path);
  const mode = args.mode ?? "dry_run";
  const evaluationOptions: EvaluationOptions = {
    validate_profile: args.validate_profile,
    projection_views: args.projection_views
  };
  const changeSet = createBaseChangeSetResult(
    journal.createChangeSetId(),
    resolvedPath.publicPath,
    args.origin ?? "apply_change_set",
    "updated",
    args.base_revision,
    mode,
    []
  );
  const preparedOperations = prepareOperationsForExecution(changeSet.change_set_id, args.operations);
  changeSet.operations = remapOperationHandles(preparedOperations, new Map());

  let rawText: string;
  try {
    rawText = await readFile(resolvedPath.absolutePath, "utf8");
  } catch {
    return {
      changeSet: createRejectedChangeSet(changeSet, [
        createDiagnostic(resolvedPath.publicPath, "sdd.document_missing", `Document '${resolvedPath.publicPath}' does not exist.`)
      ]),
      tempHandleMapping: new Map()
    };
  }

  const canonicalText = normalizeTextToLf(rawText);
  const currentRevision = computeDocumentRevision(canonicalText);
  const currentEvaluated = evaluateDocumentText(bundle, resolvedPath.publicPath, canonicalText, evaluationOptions);

  if (currentRevision !== args.base_revision) {
    const rejected = createRejectedChangeSet(
      changeSet,
      [
        createDiagnostic(
          resolvedPath.publicPath,
          "sdd.revision_mismatch",
          `Document revision '${currentRevision}' does not match base revision '${args.base_revision}'.`
        )
      ],
      currentEvaluated
    );

    if (mode === "dry_run") {
      await journal.recordChangeSet(rejected);
    }

    return {
      changeSet: rejected,
      tempHandleMapping: new Map()
    };
  }

  const inspected = inspectDocumentText(bundle, resolvedPath.publicPath, canonicalText);
  const syntax = createAuthoringSyntax(bundle);
  const summary = createEmptySummary();
  const model =
    inspected.kind === "sdd-inspect-load-failure"
      ? isBootstrapMinimumTopLevelFailure(inspected, canonicalText) &&
        (args.allowEmptyTemplateBootstrap || preparedOperations.every((operation) => isBootstrapInsertOperation(operation)))
        ? createEmptyDocumentModel(bundle)
        : undefined
      : buildDocumentModel(inspected, bundle);

  if (!model) {
    const rejected = createRejectedChangeSet(
      changeSet,
      [
        createDiagnostic(
          resolvedPath.publicPath,
          "sdd.parse_invalid_for_apply",
          "Document could not be inspected for apply_change_set."
        )
      ],
      currentEvaluated
    );

    if (mode === "dry_run") {
      await journal.recordChangeSet(rejected);
    }

    return {
      changeSet: rejected,
      tempHandleMapping: new Map()
    };
  }

  for (const operation of preparedOperations) {
    const diagnostic = applyOperation(model, syntax, resolvedPath.publicPath, operation, summary);
    if (diagnostic) {
      const rejected = createRejectedChangeSet(changeSet, [diagnostic], currentEvaluated);
      if (mode === "dry_run") {
        await journal.recordChangeSet(rejected);
      }
      return {
        changeSet: rejected,
        tempHandleMapping: new Map()
      };
    }
  }

  const candidateText = renderDocumentModel(bundle, syntax, model);
  const evaluated = evaluateDocumentText(bundle, resolvedPath.publicPath, candidateText, evaluationOptions);
  const candidateInspected = inspectDocumentText(bundle, resolvedPath.publicPath, candidateText);
  const tempHandleMapping =
    candidateInspected.kind === "sdd-inspected-document"
      ? collectTemporaryHandleMappings(model, candidateInspected, bundle)
      : new Map<Handle, Handle>();

  changeSet.status = "applied";
  changeSet.operations = remapOperationHandles(preparedOperations, tempHandleMapping);
  changeSet.summary = remapSummaryHandles(summary, tempHandleMapping);
  changeSet.diagnostics = evaluated.diagnostics;
  changeSet.projection_results = evaluated.projectionResults;
  changeSet.resulting_revision = evaluated.revision;
  changeSet.undo_eligible = mode === "commit";

  if (mode === "commit") {
    await mkdir(path.dirname(resolvedPath.absolutePath), { recursive: true });
    await writeCanonicalLfText(resolvedPath.absolutePath, candidateText);
    await journal.recordChangeSet(changeSet, {
      inverse: createRestoreDocumentInverse(resolvedPath.publicPath, currentRevision, canonicalText)
    });
  } else {
    await journal.recordChangeSet(changeSet);
  }

  return {
    changeSet,
    tempHandleMapping
  };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function createCreateDocumentRejection(
  journal: ChangeSetJournal,
  documentPath: DocumentPath,
  diagnostics: Diagnostic[]
): never {
  const changeSet = createBaseChangeSetResult(
    journal.createChangeSetId(),
    documentPath,
    "create_document",
    "created",
    null,
    "commit",
    []
  );
  changeSet.diagnostics = sortDiagnostics(diagnostics);
  throw new AuthoringMutationError(diagnostics[0]?.message ?? "Create document rejected.", diagnostics, changeSet);
}

export async function createDocument(
  workspace: AuthoringWorkspace,
  bundle: Bundle,
  args: CreateDocumentArgs,
  journal = createChangeSetJournal(workspace)
): Promise<CreateDocumentResult> {
  const resolvedPath = workspace.resolveDocumentPath(args.path);

  if (await fileExists(resolvedPath.absolutePath)) {
    createCreateDocumentRejection(journal, resolvedPath.publicPath, [
      createDiagnostic(resolvedPath.publicPath, "sdd.document_exists", `Document '${resolvedPath.publicPath}' already exists.`)
    ]);
  }

  if (args.template_id !== EMPTY_TEMPLATE_ID) {
    createCreateDocumentRejection(journal, resolvedPath.publicPath, [
      createDiagnostic(
        resolvedPath.publicPath,
        "sdd.unsupported_template",
        `Unsupported template '${args.template_id}'.`
      )
    ]);
  }

  if ((args.version ?? EMPTY_TEMPLATE_VERSION) !== EMPTY_TEMPLATE_VERSION) {
    createCreateDocumentRejection(journal, resolvedPath.publicPath, [
      createDiagnostic(
        resolvedPath.publicPath,
        "sdd.unsupported_document_version",
        `Unsupported document version '${args.version}'.`
      )
    ]);
  }

  const canonicalText = emptyTemplateText();
  await mkdir(path.dirname(resolvedPath.absolutePath), { recursive: true });
  await writeCanonicalLfText(resolvedPath.absolutePath, canonicalText);

  const changeSet = createBaseChangeSetResult(
    journal.createChangeSetId(),
    resolvedPath.publicPath,
    "create_document",
    "created",
    null,
    "commit",
    []
  );
  const evaluated = evaluateDocumentText(bundle, resolvedPath.publicPath, canonicalText);
  changeSet.status = "applied";
  changeSet.undo_eligible = true;
  changeSet.resulting_revision = evaluated.revision;
  changeSet.diagnostics = evaluated.diagnostics;

  await journal.recordChangeSet(changeSet, {
    inverse: createDeleteDocumentInverse(resolvedPath.publicPath)
  });

  return {
    kind: "sdd-create-document",
    path: resolvedPath.publicPath,
    uri: createDocumentUri(resolvedPath.publicPath),
    revision: evaluated.revision,
    change_set: changeSet
  };
}

export async function applyChangeSet(
  workspace: AuthoringWorkspace,
  bundle: Bundle,
  args: ApplyChangeSetArgs,
  journal = createChangeSetJournal(workspace)
): Promise<ChangeSetResult> {
  return (await executeChangeOperations(workspace, bundle, {
    ...args,
    origin: "apply_change_set"
  }, journal)).changeSet;
}
