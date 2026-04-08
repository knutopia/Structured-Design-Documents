import type { Diagnostic } from "../types.js";
import { classifyLine, type ClassifiedLine, type LineRecord } from "./classifyLine.js";
import type { ParserSyntaxRuntime } from "./syntaxRuntime.js";
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

function toPropertyLineNode(result: ReturnType<typeof interpretStatement>, classifiedLine: ClassifiedLine): PropertyLine | undefined {
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

function parseHeaderFields(
  record: LineRecord,
  classifiedLine: ClassifiedLine,
  runtime: ParserSyntaxRuntime,
  expectedHeaderKind: "top_node_header" | "nested_node_header"
): { nodeType?: string; id?: string; name?: string; error?: string } {
  const parsed = interpretStatement(record.raw, expectedHeaderKind, runtime);
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const nodeType = asString(getCapturePrimary(parsed.captures, "node_type"));
  const id = asString(getCapturePrimary(parsed.captures, "id"));
  const name = asString(getCapturePrimary(parsed.captures, "name"));
  if (!nodeType || !id || name === undefined) {
    return { error: `Invalid ${expectedHeaderKind}` };
  }

  return {
    nodeType,
    id,
    name
  };
}

function parseBodyLine(
  file: string,
  record: LineRecord,
  runtime: ParserSyntaxRuntime,
  diagnostics: Diagnostic[]
): PropertyLine | EdgeLine | BlankLine | CommentLine | undefined {
  const classifiedLine = classifyLine(record, runtime);
  switch (classifiedLine.kind) {
    case "blank_line":
      return toBlankLine(classifiedLine);
    case "comment_line":
      return toCommentLine(classifiedLine);
    case "property_line": {
      const parsed = interpretStatement(record.raw, "property_line", runtime);
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
      const parsed = interpretStatement(record.raw, "edge_line", runtime);
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
  expectedHeaderKind: "top_node_header" | "nested_node_header"
): ParseBlockResult {
  const headerRecord = records[startIndex];
  const classifiedHeader = classifyLine(headerRecord, runtime);
  if (classifiedHeader.kind !== expectedHeaderKind) {
    diagnostics.push(
      createDiagnostic(
        file,
        classifiedHeader,
        "parse.invalid_node_header",
        `Expected ${expectedHeaderKind}, found ${classifiedHeader.kind}`
      )
    );
    return { nextIndex: startIndex + 1 };
  }

  const parsedHeader = parseHeaderFields(headerRecord, classifiedHeader, runtime, expectedHeaderKind);
  if (!parsedHeader.nodeType || !parsedHeader.id || parsedHeader.name === undefined) {
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
    if (classifiedLine.kind === "end_line") {
      const parsedEndLine = interpretStatement(record.raw, "end_line", runtime);
      if (!parsedEndLine.ok) {
        diagnostics.push(
          createDiagnostic(file, classifiedLine, "parse.unexpected_line_in_block", parsedEndLine.error)
        );
        index += 1;
        continue;
      }

      const block: NodeBlock = {
        kind: "NodeBlock",
        headerKind: expectedHeaderKind,
        nodeType: parsedHeader.nodeType,
        id: parsedHeader.id,
        name: parsedHeader.name,
        bodyItems,
        headerSpan: classifiedHeader.span,
        span: {
          line: classifiedHeader.span.line,
          column: classifiedHeader.span.column,
          endLine: classifiedLine.span.endLine,
          endColumn: classifiedLine.span.endColumn,
          startOffset: classifiedHeader.span.startOffset,
          endOffset: classifiedLine.span.endOffset
        }
      };
      return { block, nextIndex: index + 1 };
    }

    if (classifiedLine.kind === "nested_node_header") {
      const nested = parseNodeBlock(file, records, index, runtime, diagnostics, "nested_node_header");
      if (nested.block) {
        bodyItems.push(nested.block);
      }
      index = nested.nextIndex;
      continue;
    }

    if (classifiedLine.kind === "top_node_header") {
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

    const parsedItem = parseBodyLine(file, record, runtime, diagnostics);
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
      `Node block '${parsedHeader.id}' is missing an END terminator`
    )
  );
  return { nextIndex: records.length };
}
