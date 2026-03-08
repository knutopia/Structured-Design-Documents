import type { Bundle } from "../bundle/types.js";
import type { SourceSpan } from "../types.js";

export type ClassifiedLineKind =
  | "blank_line"
  | "comment_line"
  | "end_line"
  | "top_node_header"
  | "nested_node_header"
  | "edge_line"
  | "property_line"
  | "unknown";

export interface LineRecord {
  raw: string;
  lineNumber: number;
  startOffset: number;
}

export interface ClassifiedLine {
  kind: ClassifiedLineKind;
  content: string;
  span: SourceSpan;
  commentText?: string;
}

function makeSpan(record: LineRecord): SourceSpan {
  return {
    line: record.lineNumber,
    column: 1,
    endLine: record.lineNumber,
    endColumn: record.raw.length + 1,
    startOffset: record.startOffset,
    endOffset: record.startOffset + record.raw.length
  };
}

export function stripTrailingComment(rawLine: string): { content: string; commentText?: string } {
  let inQuote = false;
  let escapeNext = false;
  let bracketDepth = 0;
  let braceDepth = 0;

  for (let index = 0; index < rawLine.length; index += 1) {
    const character = rawLine[index];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (inQuote) {
      if (character === "\\") {
        escapeNext = true;
      } else if (character === "\"") {
        inQuote = false;
      }
      continue;
    }

    if (character === "\"") {
      inQuote = true;
      continue;
    }

    if (character === "[") {
      bracketDepth += 1;
      continue;
    }

    if (character === "]" && bracketDepth > 0) {
      bracketDepth -= 1;
      continue;
    }

    if (character === "{") {
      braceDepth += 1;
      continue;
    }

    if (character === "}" && braceDepth > 0) {
      braceDepth -= 1;
      continue;
    }

    if (character === "#" && bracketDepth === 0 && braceDepth === 0) {
      return {
        content: rawLine.slice(0, index).trimEnd(),
        commentText: rawLine.slice(index + 1)
      };
    }
  }

  return { content: rawLine.trimEnd() };
}

function firstToken(text: string): string | undefined {
  return text.trimStart().split(/\s+/, 1)[0] || undefined;
}

function leadingIdentifierBeforeEquals(text: string, identifierPattern: RegExp): boolean {
  const equalsIndex = text.indexOf("=");
  if (equalsIndex === -1) {
    return false;
  }

  const left = text.slice(0, equalsIndex).trim();
  return identifierPattern.test(left);
}

export function classifyLine(record: LineRecord, bundle: Bundle): ClassifiedLine {
  const span = makeSpan(record);
  const trimmed = record.raw.trim();
  if (trimmed === "") {
    return { kind: "blank_line", content: "", span };
  }

  if (trimmed.startsWith("#")) {
    return {
      kind: "comment_line",
      content: "",
      span,
      commentText: trimmed.slice(1)
    };
  }

  const { content, commentText } = stripTrailingComment(record.raw);
  const contentTrimmed = content.trim();

  if (contentTrimmed === "END") {
    return { kind: "end_line", content, span, commentText };
  }

  const nodeTypeTokens = new Set(bundle.vocab.node_types.map((token) => token.token));
  const relationshipTokens = new Set(bundle.vocab.relationship_types.map((token) => token.token));
  const identifierPattern = new RegExp(bundle.syntax.lexical.identifier_pattern);

  const trimmedStart = content.trimStart();
  if (trimmedStart.startsWith("+")) {
    const withoutPlus = trimmedStart.slice(1).trimStart();
    const token = firstToken(withoutPlus);
    if (token && nodeTypeTokens.has(token)) {
      return { kind: "nested_node_header", content, span, commentText };
    }
  }

  const token = firstToken(content);
  if (token && nodeTypeTokens.has(token)) {
    return { kind: "top_node_header", content, span, commentText };
  }

  if (token && relationshipTokens.has(token)) {
    return { kind: "edge_line", content, span, commentText };
  }

  if (leadingIdentifierBeforeEquals(contentTrimmed, identifierPattern)) {
    return { kind: "property_line", content, span, commentText };
  }

  return { kind: "unknown", content, span, commentText };
}

