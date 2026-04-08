import type { SyntaxBlockDefinition, SyntaxEmitFieldValue } from "../bundle/types.js";
import type { Diagnostic } from "../types.js";
import { classifyLine, statementKindForClassifiedLine, type ClassifiedLine, type LineRecord } from "./classifyLine.js";
import { getBlock, type ParserSyntaxRuntime } from "./syntaxRuntime.js";
import { getCapturePrimary, interpretStatement } from "./statementInterpreter.js";
import type {
  BlankLine,
  CommentLine,
  EdgeLine,
  EdgeProperty,
  NodeBlock,
  ParseBodyItem,
  PropertyLine,
  ValueKind
} from "./types.js";

export interface ParseBlockResult {
  block?: NodeBlock;
  nextIndex: number;
}

interface BlockEmitContext {
  header: Record<string, unknown>;
  body_items: ParseBodyItem[];
}

function createDiagnostic(
  file: string,
  classifiedLine: ClassifiedLine,
  code: string,
  message: string
): Diagnostic {
  return {
    stage: "parse",
    code,
    severity: "error",
    message,
    file,
    span: classifiedLine.span
  };
}

function toBlankLine(classifiedLine: ClassifiedLine): BlankLine {
  return {
    kind: "BlankLine",
    span: classifiedLine.span
  };
}

function toCommentLine(classifiedLine: ClassifiedLine): CommentLine {
  return {
    kind: "CommentLine",
    rawText: classifiedLine.commentText ?? "",
    span: classifiedLine.span
  };
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNullableString(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }

  return typeof value === "string" ? value : undefined;
}

function asEdgeOptionalText(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  return value === "" ? null : value;
}

function asValueKind(value: unknown): ValueKind | undefined {
  return value === "quoted_string" || value === "bare_value" ? value : undefined;
}

function asHeaderKind(value: unknown): NodeBlock["headerKind"] | undefined {
  return value === "top_node_header" || value === "nested_node_header" ? value : undefined;
}

function toEdgeProperty(value: unknown): EdgeProperty | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const key = asString(record.key);
  const valueKind = asValueKind(record.value_kind);
  const rawValue = asString(record.raw_value);
  if (!key || !valueKind || rawValue === undefined) {
    return undefined;
  }

  return {
    kind: "EdgeProperty",
    key,
    valueKind,
    rawValue
  };
}

function toPropertyLineNode(
  result: ReturnType<typeof interpretStatement>,
  classifiedLine: ClassifiedLine
): PropertyLine | undefined {
  if (!result.ok) {
    return undefined;
  }

  const key = asString(result.emittedFields.key);
  const valueKind = asValueKind(result.emittedFields.value_kind);
  const rawValue = asString(result.emittedFields.raw_value);
  if (!key || !valueKind || rawValue === undefined) {
    return undefined;
  }

  return {
    kind: "PropertyLine",
    key,
    valueKind,
    rawValue,
    span: classifiedLine.span
  };
}

function toEdgeLineNode(result: ReturnType<typeof interpretStatement>, classifiedLine: ClassifiedLine): EdgeLine | undefined {
  if (!result.ok) {
    return undefined;
  }

  const relType = asString(result.emittedFields.rel_type);
  const to = asString(result.emittedFields.to);
  const toName = asNullableString(result.emittedFields.to_name);
  const event = asEdgeOptionalText(result.emittedFields.event);
  const guard = asEdgeOptionalText(result.emittedFields.guard);
  const effect = asEdgeOptionalText(result.emittedFields.effect);
  const rawProps = result.emittedFields.props;
  const props = Array.isArray(rawProps) ? rawProps.map((entry) => toEdgeProperty(entry)) : undefined;

  if (!relType || !to || toName === undefined || event === undefined || guard === undefined || effect === undefined) {
    return undefined;
  }

  if (!props || props.some((entry) => entry === undefined)) {
    return undefined;
  }

  return {
    kind: "EdgeLine",
    relType,
    to,
    toName,
    event,
    guard,
    effect,
    props: props as EdgeProperty[],
    span: classifiedLine.span
  };
}

function parseHeaderContext(
  record: LineRecord,
  headerStatement: string,
  runtime: ParserSyntaxRuntime
): { header?: Record<string, unknown>; error?: string } {
  const parsed = interpretStatement(record.raw, headerStatement, runtime);
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const header = Object.fromEntries(
    Object.keys(parsed.captures).map((captureName) => [captureName, getCapturePrimary(parsed.captures, captureName)])
  );

  const nodeType = asString(header.node_type);
  const id = asString(header.id);
  const name = asString(header.name);
  if (!nodeType || !id || name === undefined) {
    return { error: `Invalid ${headerStatement}` };
  }

  return { header };
}

function resolveBlockEmitFieldValue(context: BlockEmitContext, fieldValue: SyntaxEmitFieldValue): unknown {
  if (typeof fieldValue !== "string") {
    return fieldValue.const;
  }

  let current: unknown = context;
  for (const segment of fieldValue.split(".")) {
    if (typeof current !== "object" || current === null || !(segment in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function buildNodeBlockFromSyntax(
  block: SyntaxBlockDefinition,
  header: Record<string, unknown>,
  bodyItems: ParseBodyItem[],
  headerLine: ClassifiedLine,
  terminatorLine: ClassifiedLine
): NodeBlock | undefined {
  const emittedFields = { ...(block.emits.defaults ?? {}) };
  const context: BlockEmitContext = {
    header,
    body_items: bodyItems
  };

  for (const [fieldName, fieldValue] of Object.entries(block.emits.fields ?? {})) {
    const resolvedValue = resolveBlockEmitFieldValue(context, fieldValue);
    if (resolvedValue !== undefined) {
      emittedFields[fieldName] = resolvedValue;
    }
  }

  const headerKind = asHeaderKind(emittedFields.header_kind);
  const nodeType = asString(emittedFields.node_type);
  const id = asString(emittedFields.id);
  const name = asString(emittedFields.name);
  const emittedBodyItems = emittedFields.body_items;

  if (!headerKind || !nodeType || !id || name === undefined || !Array.isArray(emittedBodyItems)) {
    return undefined;
  }

  return {
    kind: "NodeBlock",
    headerKind,
    nodeType,
    id,
    name,
    bodyItems: emittedBodyItems as ParseBodyItem[],
    headerSpan: headerLine.span,
    span: {
      line: headerLine.span.line,
      column: headerLine.span.column,
      endLine: terminatorLine.span.endLine,
      endColumn: terminatorLine.span.endColumn,
      startOffset: headerLine.span.startOffset,
      endOffset: terminatorLine.span.endOffset
    }
  };
}

function blockNameForHeaderStatement(
  runtime: ParserSyntaxRuntime,
  blockNames: string[],
  statementKind: string
): string | undefined {
  return blockNames.find((blockName) => getBlock(runtime, blockName).header_statement === statementKind);
}

function parseBodyLine(
  file: string,
  record: LineRecord,
  classifiedLine: ClassifiedLine,
  statementKind: string,
  runtime: ParserSyntaxRuntime,
  diagnostics: Diagnostic[]
): PropertyLine | EdgeLine | BlankLine | CommentLine | undefined {
  switch (statementKind) {
    case "blank_line":
      return toBlankLine(classifiedLine);
    case "comment_line":
      return toCommentLine(classifiedLine);
    case "property_line": {
      const parsed = interpretStatement(record.raw, statementKind, runtime);
      const property = toPropertyLineNode(parsed, classifiedLine);
      if (!property) {
        diagnostics.push(
          createDiagnostic(
            file,
            classifiedLine,
            "parse.invalid_property_line",
            parsed.ok ? "Invalid property line" : parsed.error
          )
        );
        return undefined;
      }
      return property;
    }
    case "edge_line": {
      const parsed = interpretStatement(record.raw, statementKind, runtime);
      const edge = toEdgeLineNode(parsed, classifiedLine);
      if (!edge) {
        diagnostics.push(
          createDiagnostic(
            file,
            classifiedLine,
            "parse.invalid_edge_line",
            parsed.ok ? "Invalid edge line" : parsed.error
          )
        );
        return undefined;
      }
      return edge;
    }
    default:
      diagnostics.push(
        createDiagnostic(file, classifiedLine, "parse.unexpected_line_in_block", "Unexpected line in node block")
      );
      return undefined;
  }
}

export function parseNodeBlock(
  file: string,
  records: LineRecord[],
  startIndex: number,
  runtime: ParserSyntaxRuntime,
  diagnostics: Diagnostic[],
  blockName: string
): ParseBlockResult {
  const block = getBlock(runtime, blockName);
  const headerStatement = block.header_statement;
  const topLevelBlockName = runtime.syntax.document.top_level_block_kind;
  const topLevelHeaderStatement = getBlock(runtime, topLevelBlockName).header_statement;
  const allowedBodyStatementKinds = new Set(
    block.body_item_kinds.filter((itemKind) => runtime.statementsByName.has(itemKind))
  );
  const allowedNestedBlockNames = block.body_item_kinds.filter((itemKind) => runtime.blocksByName.has(itemKind));
  const headerRecord = records[startIndex];
  const classifiedHeader = classifyLine(headerRecord, runtime);
  const headerStatementKind = statementKindForClassifiedLine(classifiedHeader, runtime);
  if (headerStatementKind !== headerStatement) {
    diagnostics.push(
      createDiagnostic(
        file,
        classifiedHeader,
        "parse.invalid_node_header",
        `Expected ${headerStatement}, found ${headerStatementKind ?? classifiedHeader.kind}`
      )
    );
    return { nextIndex: startIndex + 1 };
  }

  const parsedHeader = parseHeaderContext(headerRecord, headerStatement, runtime);
  if (!parsedHeader.header) {
    diagnostics.push(
      createDiagnostic(
        file,
        classifiedHeader,
        "parse.invalid_node_header",
        parsedHeader.error ?? "Invalid node header"
      )
    );
    return { nextIndex: startIndex + 1 };
  }

  const bodyItems: ParseBodyItem[] = [];
  let index = startIndex + 1;
  while (index < records.length) {
    const record = records[index];
    const classifiedLine = classifyLine(record, runtime);
    const statementKind = statementKindForClassifiedLine(classifiedLine, runtime);

    if (statementKind === block.terminator_statement) {
      const parsedEndLine = interpretStatement(record.raw, statementKind, runtime);
      if (!parsedEndLine.ok) {
        diagnostics.push(
          createDiagnostic(file, classifiedLine, "parse.unexpected_line_in_block", parsedEndLine.error)
        );
        index += 1;
        continue;
      }

      const parsedBlock = buildNodeBlockFromSyntax(
        block,
        parsedHeader.header,
        bodyItems,
        classifiedHeader,
        classifiedLine
      );
      if (!parsedBlock) {
        diagnostics.push(
          createDiagnostic(file, classifiedHeader, "parse.invalid_node_header", "Invalid node block emission")
        );
        return { nextIndex: index + 1 };
      }
      return { block: parsedBlock, nextIndex: index + 1 };
    }

    const nestedBlockName =
      statementKind ? blockNameForHeaderStatement(runtime, allowedNestedBlockNames, statementKind) : undefined;
    if (nestedBlockName) {
      const nested = parseNodeBlock(file, records, index, runtime, diagnostics, nestedBlockName);
      if (nested.block) {
        bodyItems.push(nested.block);
      }
      index = nested.nextIndex;
      continue;
    }

    if (statementKind === topLevelHeaderStatement && !allowedNestedBlockNames.includes(topLevelBlockName)) {
      diagnostics.push(
        createDiagnostic(
          file,
          classifiedLine,
          "parse.unexpected_top_node_header",
          "Top-level node header is not allowed inside another node block"
        )
      );
      index += 1;
      continue;
    }

    if (!statementKind || !allowedBodyStatementKinds.has(statementKind)) {
      diagnostics.push(
        createDiagnostic(file, classifiedLine, "parse.unexpected_line_in_block", "Unexpected line in node block")
      );
      index += 1;
      continue;
    }

    const parsedItem = parseBodyLine(file, record, classifiedLine, statementKind, runtime, diagnostics);
    if (parsedItem) {
      bodyItems.push(parsedItem);
    }
    index += 1;
  }

  diagnostics.push(
    createDiagnostic(
      file,
      classifiedHeader,
      "parse.missing_end",
      `Node block '${asString(parsedHeader.header.id) ?? "unknown"}' is missing an END terminator`
    )
  );
  return { nextIndex: records.length };
}
