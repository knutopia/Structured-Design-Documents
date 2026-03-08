import type { Bundle } from "../bundle/types.js";
import type { Diagnostic } from "../types.js";
import { classifyLine, type ClassifiedLine, type LineRecord } from "./classifyLine.js";
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

function isWhitespace(character: string | undefined): boolean {
  return character === " " || character === "\t";
}

function skipWhitespace(text: string, index: number): number {
  let cursor = index;
  while (isWhitespace(text[cursor])) {
    cursor += 1;
  }
  return cursor;
}

function readToken(text: string, index: number): { token: string; nextIndex: number } {
  let cursor = index;
  while (cursor < text.length && !isWhitespace(text[cursor])) {
    cursor += 1;
  }
  return {
    token: text.slice(index, cursor),
    nextIndex: cursor
  };
}

function parseQuotedString(
  text: string,
  index: number
): { value?: string; nextIndex: number; error?: string } {
  if (text[index] !== "\"") {
    return { nextIndex: index, error: "Expected opening quote" };
  }

  let cursor = index + 1;
  let value = "";
  while (cursor < text.length) {
    const character = text[cursor];
    if (character === "\\") {
      const nextCharacter = text[cursor + 1];
      if (nextCharacter === "\"" || nextCharacter === "\\") {
        value += nextCharacter;
        cursor += 2;
        continue;
      }
      value += "\\";
      cursor += 1;
      continue;
    }

    if (character === "\"") {
      return {
        value,
        nextIndex: cursor + 1
      };
    }

    value += character;
    cursor += 1;
  }

  return { nextIndex: cursor, error: "Unterminated quoted string" };
}

function parseValueAtom(
  text: string,
  index: number,
  bundle: Bundle
): { value?: string; valueKind?: ValueKind; nextIndex: number; error?: string } {
  if (text[index] === "\"") {
    const quoted = parseQuotedString(text, index);
    return {
      value: quoted.value,
      valueKind: "quoted_string",
      nextIndex: quoted.nextIndex,
      error: quoted.error
    };
  }

  const barePattern = new RegExp(bundle.syntax.lexical.bare_value_pattern);
  const token = readToken(text, index);
  if (!token.token || !barePattern.test(token.token)) {
    return { nextIndex: token.nextIndex, error: "Invalid bare value" };
  }

  return {
    value: token.token,
    valueKind: "bare_value",
    nextIndex: token.nextIndex
  };
}

function parsePropertyAt(
  text: string,
  bundle: Bundle
): { property?: PropertyLine; error?: string } {
  const content = text.trim();
  const equalsIndex = content.indexOf("=");
  if (equalsIndex === -1) {
    return { error: "Property line must contain '='" };
  }

  const key = content.slice(0, equalsIndex).trim();
  const identifierPattern = new RegExp(bundle.syntax.lexical.identifier_pattern);
  if (!identifierPattern.test(key)) {
    return { error: "Invalid property key" };
  }

  const valueText = content.slice(equalsIndex + 1).trim();
  const parsedValue = parseValueAtom(valueText, 0, bundle);
  if (parsedValue.error || parsedValue.value === undefined || parsedValue.valueKind === undefined) {
    return { error: parsedValue.error ?? "Invalid property value" };
  }

  if (skipWhitespace(valueText, parsedValue.nextIndex) !== valueText.length) {
    return { error: "Unexpected trailing characters in property line" };
  }

  return {
    property: {
      kind: "PropertyLine",
      key,
      valueKind: parsedValue.valueKind,
      rawValue: parsedValue.value,
      span: {
        line: 0,
        column: 0,
        endLine: 0,
        endColumn: 0,
        startOffset: 0,
        endOffset: 0
      }
    }
  };
}

function parseEdgeProperty(
  text: string,
  bundle: Bundle
): { property?: EdgeProperty; consumed: number; error?: string } {
  const equalsIndex = text.indexOf("=");
  if (equalsIndex === -1) {
    return { consumed: 0, error: "Edge property must contain '='" };
  }

  const key = text.slice(0, equalsIndex).trim();
  const identifierPattern = new RegExp(bundle.syntax.lexical.identifier_pattern);
  if (!identifierPattern.test(key)) {
    return { consumed: 0, error: "Invalid edge property key" };
  }

  const valueText = text.slice(equalsIndex + 1).trimStart();
  const parsedValue = parseValueAtom(valueText, 0, bundle);
  if (parsedValue.error || parsedValue.value === undefined || parsedValue.valueKind === undefined) {
    return { consumed: 0, error: parsedValue.error ?? "Invalid edge property value" };
  }

  const remaining = valueText.slice(parsedValue.nextIndex);
  if (remaining.trimStart() !== "") {
    return { consumed: 0, error: "Unexpected trailing characters in edge property" };
  }

  return {
    consumed: text.length,
    property: {
      kind: "EdgeProperty",
      key,
      valueKind: parsedValue.valueKind,
      rawValue: parsedValue.value
    }
  };
}

function parseNodeHeader(
  text: string,
  headerKind: "top_node_header" | "nested_node_header",
  bundle: Bundle
): { nodeType?: string; id?: string; name?: string; error?: string } {
  let cursor = 0;
  const source = text.trimStart();
  if (headerKind === "nested_node_header") {
    if (!source.startsWith("+")) {
      return { error: "Nested node headers must start with '+'" };
    }
    cursor = 1;
    cursor = skipWhitespace(source, cursor);
  }

  const nodeTypeToken = readToken(source, cursor);
  const nodeTypes = new Set(bundle.vocab.node_types.map((token) => token.token));
  if (!nodeTypes.has(nodeTypeToken.token)) {
    return { error: "Invalid node type" };
  }
  cursor = nodeTypeToken.nextIndex;
  if (!isWhitespace(source[cursor])) {
    return { error: "Expected whitespace after node type" };
  }
  cursor = skipWhitespace(source, cursor);

  const idToken = readToken(source, cursor);
  const idPattern = new RegExp(bundle.syntax.lexical.id_pattern);
  if (!idPattern.test(idToken.token)) {
    return { error: "Invalid node id" };
  }
  cursor = idToken.nextIndex;
  if (!isWhitespace(source[cursor])) {
    return { error: "Expected whitespace after node id" };
  }
  cursor = skipWhitespace(source, cursor);

  const quoted = parseQuotedString(source, cursor);
  if (quoted.error || quoted.value === undefined) {
    return { error: quoted.error ?? "Invalid node name" };
  }
  cursor = skipWhitespace(source, quoted.nextIndex);
  if (cursor !== source.length) {
    return { error: "Unexpected trailing characters in node header" };
  }

  return {
    nodeType: nodeTypeToken.token,
    id: idToken.token,
    name: quoted.value
  };
}

function parseEdgeLine(text: string, bundle: Bundle): { edge?: EdgeLine; error?: string } {
  let cursor = skipWhitespace(text, 0);
  const relToken = readToken(text, cursor);
  const relationshipTypes = new Set(bundle.vocab.relationship_types.map((token) => token.token));
  if (!relationshipTypes.has(relToken.token)) {
    return { error: "Invalid relationship type" };
  }
  cursor = relToken.nextIndex;
  if (!isWhitespace(text[cursor])) {
    return { error: "Expected whitespace after relationship type" };
  }
  cursor = skipWhitespace(text, cursor);

  const idToken = readToken(text, cursor);
  const idPattern = new RegExp(bundle.syntax.lexical.id_pattern);
  if (!idPattern.test(idToken.token)) {
    return { error: "Invalid edge target id" };
  }
  cursor = idToken.nextIndex;

  let toName: string | null = null;
  let event: string | null = null;
  let guard: string | null = null;
  let effect: string | null = null;
  const props: EdgeProperty[] = [];

  while (cursor < text.length) {
    cursor = skipWhitespace(text, cursor);
    if (cursor >= text.length) {
      break;
    }

    const character = text[cursor];
    if (character === "\"") {
      if (toName !== null) {
        return { error: "Duplicate edge target name" };
      }
      const quoted = parseQuotedString(text, cursor);
      if (quoted.error || quoted.value === undefined) {
        return { error: quoted.error ?? "Invalid edge target name" };
      }
      toName = quoted.value;
      cursor = quoted.nextIndex;
      continue;
    }

    if (character === "[") {
      if (event !== null) {
        return { error: "Duplicate event annotation" };
      }
      const endIndex = text.indexOf("]", cursor + 1);
      if (endIndex === -1) {
        return { error: "Unterminated event annotation" };
      }
      event = text.slice(cursor + 1, endIndex).trim();
      cursor = endIndex + 1;
      continue;
    }

    if (character === "{") {
      if (guard !== null) {
        return { error: "Duplicate guard annotation" };
      }
      const endIndex = text.indexOf("}", cursor + 1);
      if (endIndex === -1) {
        return { error: "Unterminated guard annotation" };
      }
      guard = text.slice(cursor + 1, endIndex);
      cursor = endIndex + 1;
      continue;
    }

    if (character === "/") {
      if (effect !== null) {
        return { error: "Duplicate effect annotation" };
      }
      cursor += 1;
      cursor = skipWhitespace(text, cursor);
      const parsedEffect = parseValueAtom(text, cursor, bundle);
      if (parsedEffect.error || parsedEffect.value === undefined) {
        return { error: parsedEffect.error ?? "Invalid effect annotation" };
      }
      effect = parsedEffect.value;
      cursor = parsedEffect.nextIndex;
      continue;
    }

    const remaining = text.slice(cursor);
    const nextBoundary = remaining.search(/[ \t]/);
    const propertyText = nextBoundary === -1 ? remaining : remaining.slice(0, nextBoundary);
    const property = parseEdgeProperty(propertyText, bundle);
    if (!property.property) {
      return { error: property.error ?? "Invalid edge property" };
    }
    props.push(property.property);
    cursor += property.consumed;
  }

  return {
    edge: {
      kind: "EdgeLine",
      relType: relToken.token,
      to: idToken.token,
      toName,
      event: event === "" ? null : event,
      guard: guard === "" ? null : guard,
      effect: effect === "" ? null : effect,
      props,
      span: {
        line: 0,
        column: 0,
        endLine: 0,
        endColumn: 0,
        startOffset: 0,
        endOffset: 0
      }
    }
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

function parseBodyLine(
  file: string,
  record: LineRecord,
  bundle: Bundle,
  diagnostics: Diagnostic[]
): PropertyLine | EdgeLine | BlankLine | CommentLine | undefined {
  const classifiedLine = classifyLine(record, bundle);
  switch (classifiedLine.kind) {
    case "blank_line":
      return toBlankLine(classifiedLine);
    case "comment_line":
      return toCommentLine(classifiedLine);
    case "property_line": {
      const parsed = parsePropertyAt(classifiedLine.content, bundle);
      if (!parsed.property) {
        diagnostics.push(
          createDiagnostic(file, classifiedLine, "parse.invalid_property_line", parsed.error ?? "Invalid property line")
        );
        return undefined;
      }
      parsed.property.span = classifiedLine.span;
      return parsed.property;
    }
    case "edge_line": {
      const parsed = parseEdgeLine(classifiedLine.content, bundle);
      if (!parsed.edge) {
        diagnostics.push(
          createDiagnostic(file, classifiedLine, "parse.invalid_edge_line", parsed.error ?? "Invalid edge line")
        );
        return undefined;
      }
      parsed.edge.span = classifiedLine.span;
      return parsed.edge;
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
  bundle: Bundle,
  diagnostics: Diagnostic[],
  expectedHeaderKind: "top_node_header" | "nested_node_header"
): ParseBlockResult {
  const headerRecord = records[startIndex];
  const classifiedHeader = classifyLine(headerRecord, bundle);
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

  const parsedHeader = parseNodeHeader(classifiedHeader.content, expectedHeaderKind, bundle);
  if (!parsedHeader.nodeType || !parsedHeader.id || !parsedHeader.name) {
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
    const classifiedLine = classifyLine(record, bundle);
    if (classifiedLine.kind === "end_line") {
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
      const nested = parseNodeBlock(file, records, index, bundle, diagnostics, "nested_node_header");
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

    const parsedItem = parseBodyLine(file, record, bundle, diagnostics);
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

