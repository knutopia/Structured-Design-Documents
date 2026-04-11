import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Bundle } from "../bundle/types.js";
import { sortDiagnostics } from "../diagnostics/types.js";
import { parseSource } from "../parser/parseSource.js";
import type {
  BlankLine,
  CommentLine,
  EdgeLine,
  NodeBlock,
  ParseBodyItem,
  ParseDocument,
  PropertyLine
} from "../parser/types.js";
import type {
  DocumentPath,
  DocumentRevision,
  DocumentUri,
  Handle,
  InspectBodyItem,
  InspectBodyItem as PublicInspectBodyItem,
  InspectNodeBlock,
  InspectResource,
  StructuralRelationshipType
} from "./contracts.js";
import { computeDocumentRevision, normalizeTextToLf } from "./revisions.js";
import type { AuthoringWorkspace } from "./workspace.js";

type StructuralParseItem = NodeBlock | PropertyLine | EdgeLine;
type TriviaItem = BlankLine | CommentLine;

const STRUCTURAL_RELATIONSHIP_TYPES = new Set<StructuralRelationshipType>(["CONTAINS", "COMPOSED_OF"]);

export interface InspectLoadFailure {
  kind: "sdd-inspect-load-failure";
  path: DocumentPath;
  revision: DocumentRevision;
  diagnostics: ReturnType<typeof sortDiagnostics>;
}

export interface InspectNodeTarget {
  kind: "node_block";
  handle: Handle;
  node: NodeBlock;
  parent_handle: Handle | null;
}

export interface InspectPropertyTarget {
  kind: "property_line";
  handle: Handle;
  line: PropertyLine;
  parent_handle: Handle;
  parent_node: NodeBlock;
  order_index: number;
}

export interface InspectEdgeTarget {
  kind: "edge_line";
  handle: Handle;
  line: EdgeLine;
  parent_handle: Handle;
  parent_node: NodeBlock;
  order_index: number;
  structural_order_index: number | null;
}

export type InspectTarget = InspectNodeTarget | InspectPropertyTarget | InspectEdgeTarget;

export interface OwnedTrivia {
  leading: TriviaItem[];
  trailing: TriviaItem[];
}

export interface RewriteOwnership {
  byHandle: Map<Handle, OwnedTrivia>;
}

export interface InspectedDocument {
  kind: "sdd-inspected-document";
  resource: InspectResource;
  document: ParseDocument;
  handleIndex: Map<Handle, InspectTarget>;
  rewriteOwnership: RewriteOwnership;
}

export type InspectDocumentResult = InspectedDocument | InspectLoadFailure;

function createInspectUri(documentPath: DocumentPath): DocumentUri {
  return `sdd://document/${documentPath}/inspect`;
}

function createOwnedTrivia(): OwnedTrivia {
  return {
    leading: [],
    trailing: []
  };
}

function ensureOwnedTrivia(rewriteOwnership: RewriteOwnership, handle: Handle): OwnedTrivia {
  const existing = rewriteOwnership.byHandle.get(handle);
  if (existing) {
    return existing;
  }

  const created = createOwnedTrivia();
  rewriteOwnership.byHandle.set(handle, created);
  return created;
}

function isTriviaItem(item: ParseBodyItem | ParseDocument["items"][number]): item is TriviaItem {
  return item.kind === "BlankLine" || item.kind === "CommentLine";
}

function isStructuralBodyItem(item: ParseBodyItem): item is StructuralParseItem {
  return item.kind === "NodeBlock" || item.kind === "PropertyLine" || item.kind === "EdgeLine";
}

function createHandle(revision: DocumentRevision, item: StructuralParseItem): Handle {
  const structuralKey = `${revision}|${item.kind}|${item.span.startOffset}|${item.span.endOffset}`;
  const digest = createHash("sha256").update(structuralKey, "utf8").digest("hex");
  return `hdl_${digest}`;
}

interface TraversalState {
  revision: DocumentRevision;
  resource: InspectResource;
  handleIndex: Map<Handle, InspectTarget>;
  rewriteOwnership: RewriteOwnership;
}

function structuralOrderIndex(
  item: EdgeLine,
  structuralCounters: Record<StructuralRelationshipType, number>
): number | null {
  if (!STRUCTURAL_RELATIONSHIP_TYPES.has(item.relType as StructuralRelationshipType)) {
    return null;
  }

  const relType = item.relType as StructuralRelationshipType;
  const nextIndex = structuralCounters[relType];
  structuralCounters[relType] += 1;
  return nextIndex;
}

function pushBodyItem(state: TraversalState, bodyItem: PublicInspectBodyItem): void {
  state.resource.body_items.push(bodyItem);
}

function ownLeadingTrivia(state: TraversalState, handle: Handle, trivia: TriviaItem[]): void {
  if (trivia.length === 0) {
    return;
  }

  ensureOwnedTrivia(state.rewriteOwnership, handle).leading.push(...trivia);
}

function ownTrailingTrivia(state: TraversalState, handle: Handle, trivia: TriviaItem[]): void {
  if (trivia.length === 0) {
    return;
  }

  ensureOwnedTrivia(state.rewriteOwnership, handle).trailing.push(...trivia);
}

function toInspectBodyItemKind(item: StructuralParseItem): InspectBodyItem["kind"] {
  switch (item.kind) {
    case "NodeBlock":
      return "node_block";
    case "PropertyLine":
      return "property_line";
    case "EdgeLine":
      return "edge_line";
  }
}

function toInspectNodeBlock(handle: Handle, block: NodeBlock, parentHandle: Handle | null): InspectNodeBlock {
  return {
    handle,
    node_type: block.nodeType,
    node_id: block.id,
    name: block.name,
    parent_handle: parentHandle,
    body_stream: [],
    structural_order_streams: {}
  };
}

function traverseNodeBlock(
  block: NodeBlock,
  parentHandle: Handle | null,
  leadingTrivia: TriviaItem[],
  state: TraversalState
): Handle {
  const nodeHandle = createHandle(state.revision, block);
  const nodeResource = toInspectNodeBlock(nodeHandle, block, parentHandle);

  state.resource.nodes.push(nodeResource);
  state.handleIndex.set(nodeHandle, {
    kind: "node_block",
    handle: nodeHandle,
    node: block,
    parent_handle: parentHandle
  });
  ensureOwnedTrivia(state.rewriteOwnership, nodeHandle);
  ownLeadingTrivia(state, nodeHandle, leadingTrivia);

  const structuralCounters: Record<StructuralRelationshipType, number> = {
    CONTAINS: 0,
    COMPOSED_OF: 0
  };
  let bodyOrderIndex = 0;
  let pendingTrivia: TriviaItem[] = [];

  for (const bodyItem of block.bodyItems) {
    if (isTriviaItem(bodyItem)) {
      pendingTrivia.push(bodyItem);
      continue;
    }

    if (!isStructuralBodyItem(bodyItem)) {
      continue;
    }

    const handle = createHandle(state.revision, bodyItem);
    nodeResource.body_stream.push(handle);
    ownLeadingTrivia(state, handle, pendingTrivia);
    pendingTrivia = [];

    if (bodyItem.kind === "PropertyLine") {
      pushBodyItem(state, {
        handle,
        kind: "property_line",
        parent_handle: nodeHandle,
        order_index: bodyOrderIndex,
        property: {
          key: bodyItem.key,
          value_kind: bodyItem.valueKind,
          raw_value: bodyItem.rawValue
        }
      });
      state.handleIndex.set(handle, {
        kind: "property_line",
        handle,
        line: bodyItem,
        parent_handle: nodeHandle,
        parent_node: block,
        order_index: bodyOrderIndex
      });
      ensureOwnedTrivia(state.rewriteOwnership, handle);
    } else if (bodyItem.kind === "EdgeLine") {
      const structuralIndex = structuralOrderIndex(bodyItem, structuralCounters);
      if (structuralIndex !== null) {
        const relType = bodyItem.relType as StructuralRelationshipType;
        const stream = nodeResource.structural_order_streams[relType] ?? [];
        stream.push(handle);
        nodeResource.structural_order_streams[relType] = stream;
      }

      pushBodyItem(state, {
        handle,
        kind: "edge_line",
        parent_handle: nodeHandle,
        order_index: bodyOrderIndex,
        edge: {
          rel_type: bodyItem.relType,
          to: bodyItem.to,
          to_name: bodyItem.toName,
          event: bodyItem.event,
          guard: bodyItem.guard,
          effect: bodyItem.effect,
          props: Object.fromEntries(bodyItem.props.map((prop) => [prop.key, prop.rawValue])),
          structural_order_index: structuralIndex
        }
      });
      state.handleIndex.set(handle, {
        kind: "edge_line",
        handle,
        line: bodyItem,
        parent_handle: nodeHandle,
        parent_node: block,
        order_index: bodyOrderIndex,
        structural_order_index: structuralIndex
      });
      ensureOwnedTrivia(state.rewriteOwnership, handle);
    } else {
      pushBodyItem(state, {
        handle,
        kind: "node_block",
        parent_handle: nodeHandle,
        order_index: bodyOrderIndex
      });
      traverseNodeBlock(bodyItem, nodeHandle, [], state);
    }

    bodyOrderIndex += 1;
  }

  ownTrailingTrivia(state, nodeHandle, pendingTrivia);
  return nodeHandle;
}

function buildInspectDocument(
  documentPath: DocumentPath,
  revision: DocumentRevision,
  document: ParseDocument,
  diagnostics: ReturnType<typeof sortDiagnostics>
): InspectedDocument {
  const resource: InspectResource = {
    kind: "sdd-document-inspect",
    uri: createInspectUri(documentPath),
    path: documentPath,
    revision,
    effective_version: document.effectiveVersion,
    top_level_order: [],
    nodes: [],
    body_items: [],
    diagnostics
  };
  const state: TraversalState = {
    revision,
    resource,
    handleIndex: new Map(),
    rewriteOwnership: {
      byHandle: new Map()
    }
  };
  let pendingTopLevelTrivia: TriviaItem[] = [];

  for (const item of document.items) {
    if (isTriviaItem(item)) {
      pendingTopLevelTrivia.push(item);
      continue;
    }

    const nodeHandle = traverseNodeBlock(item, null, pendingTopLevelTrivia, state);
    resource.top_level_order.push(nodeHandle);
    pendingTopLevelTrivia = [];
  }

  const lastTopLevelHandle = resource.top_level_order[resource.top_level_order.length - 1];
  if (lastTopLevelHandle) {
    ownTrailingTrivia(state, lastTopLevelHandle, pendingTopLevelTrivia);
  }

  return {
    kind: "sdd-inspected-document",
    resource,
    document,
    handleIndex: state.handleIndex,
    rewriteOwnership: state.rewriteOwnership
  };
}

export async function inspectDocument(
  workspace: AuthoringWorkspace,
  bundle: Bundle,
  documentPath: string
): Promise<InspectDocumentResult> {
  const resolvedDocument = workspace.resolveDocumentPath(documentPath);
  const rawText = await readFile(resolvedDocument.absolutePath, "utf8");
  const canonicalText = normalizeTextToLf(rawText);
  const revision = computeDocumentRevision(canonicalText);
  const parseResult = parseSource(
    {
      path: resolvedDocument.publicPath,
      text: canonicalText
    },
    bundle
  );
  const diagnostics = sortDiagnostics(parseResult.diagnostics);

  if (!parseResult.document) {
    return {
      kind: "sdd-inspect-load-failure",
      path: resolvedDocument.publicPath,
      revision,
      diagnostics
    };
  }

  return buildInspectDocument(
    resolvedDocument.publicPath,
    revision,
    parseResult.document,
    diagnostics
  );
}
