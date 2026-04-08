import type { SyntaxLineClassifierClause, SyntaxLineKindDefinition } from "../bundle/types.js";
import type { SourceSpan } from "../types.js";
import { getPattern, getStatement, getTokenSource, type ParserSyntaxRuntime } from "./syntaxRuntime.js";

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
  lineKindKind: SyntaxLineKindDefinition["kind"] | "unknown";
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

function nextTokenAfterPrefix(text: string, prefix?: string): string | undefined {
  const trimmedStart = text.trimStart();
  if (trimmedStart === "") {
    return undefined;
  }

  const remainder = prefix && trimmedStart.startsWith(prefix) ? trimmedStart.slice(prefix.length) : trimmedStart.slice(1);
  return firstToken(remainder);
}

function leadingIdentifierBeforeEquals(text: string, identifierPattern: RegExp): boolean {
  const equalsIndex = text.indexOf("=");
  if (equalsIndex === -1) {
    return false;
  }

  const left = text.slice(0, equalsIndex).trim();
  return identifierPattern.test(left);
}

function classifierMatches(clause: SyntaxLineClassifierClause, text: string, runtime: ParserSyntaxRuntime): boolean {
  if ("any_of" in clause) {
    return clause.any_of.some((candidate) => classifierMatches(candidate, text, runtime));
  }

  let matched = false;
  let matches = true;
  const trimmedText = text.trim();
  const trimmedStart = text.trimStart();

  if ("trimmed_equals" in clause) {
    matched = true;
    matches &&= trimmedText === clause.trimmed_equals;
  }

  if ("first_non_whitespace" in clause) {
    matched = true;
    matches &&= trimmedStart.startsWith(clause.first_non_whitespace);
  }

  if ("first_token_source" in clause) {
    matched = true;
    const token = firstToken(text);
    matches &&= token !== undefined && getTokenSource(runtime, clause.first_token_source).tokenSet.has(token);
  }

  if ("next_token_source" in clause) {
    matched = true;
    const prefix =
      "first_non_whitespace" in clause && typeof clause.first_non_whitespace === "string"
        ? clause.first_non_whitespace
        : undefined;
    const token = nextTokenAfterPrefix(text, prefix);
    matches &&= token !== undefined && getTokenSource(runtime, clause.next_token_source).tokenSet.has(token);
  }

  if ("leading_identifier_before_equals" in clause) {
    matched = true;
    matches &&=
      clause.leading_identifier_before_equals &&
      leadingIdentifierBeforeEquals(trimmedText, getPattern(runtime, "lexical.identifier_pattern"));
  }

  return matched && matches;
}

function statementNamesForLineKind(lineKind: SyntaxLineKindDefinition): string[] {
  if (lineKind.statement) {
    return [lineKind.statement];
  }

  return lineKind.statements ?? [];
}

export function statementKindForClassifiedLine(
  classifiedLine: ClassifiedLine,
  runtime: ParserSyntaxRuntime
): string | undefined {
  if (classifiedLine.lineKindKind === "unknown") {
    return classifiedLine.kind === "unknown" ? undefined : classifiedLine.kind;
  }

  const lineKind = runtime.lineKindsByKind.get(classifiedLine.lineKindKind);
  if (!lineKind) {
    return classifiedLine.kind === "unknown" ? undefined : classifiedLine.kind;
  }

  if (lineKind.statement) {
    return lineKind.statement;
  }

  return lineKind.statements?.includes(classifiedLine.kind) ? classifiedLine.kind : undefined;
}

function allowsTrailingComment(lineKind: SyntaxLineKindDefinition, runtime: ParserSyntaxRuntime): boolean {
  return statementNamesForLineKind(lineKind).some((statementName) =>
    runtime.trailingCommentAllowedStatements.has(statementName)
  );
}

function commentTextForCommentLine(rawLine: string, commentPrefix: string): string {
  const trimmedStart = rawLine.trimStart();
  return trimmedStart.startsWith(commentPrefix) ? trimmedStart.slice(commentPrefix.length) : "";
}

function resolvedLineKind(kind: string): ClassifiedLineKind | undefined {
  switch (kind) {
    case "blank_line":
    case "comment_line":
    case "end_line":
    case "top_node_header":
    case "nested_node_header":
    case "edge_line":
    case "property_line":
      return kind;
    default:
      return undefined;
  }
}

function classifyMatchedStatement(
  statementKind: string,
  lineKindKind: SyntaxLineKindDefinition["kind"],
  record: LineRecord,
  span: SourceSpan,
  content: string,
  commentText: string | undefined,
  runtime: ParserSyntaxRuntime
): ClassifiedLine {
  const resolvedKind = resolvedLineKind(statementKind);
  if (!resolvedKind) {
    return {
      kind: "unknown",
      lineKindKind,
      content,
      span,
      commentText
    };
  }

  if (resolvedKind === "blank_line") {
    return {
      kind: "blank_line",
      lineKindKind,
      content: "",
      span
    };
  }

  if (resolvedKind === "comment_line") {
    return {
      kind: "comment_line",
      lineKindKind,
      content: "",
      span,
      commentText: commentTextForCommentLine(record.raw, runtime.syntax.lexical.comment_prefix)
    };
  }

  return {
    kind: resolvedKind,
    lineKindKind,
    content,
    span,
    commentText
  };
}

function matchLineKind(
  record: LineRecord,
  lineKind: SyntaxLineKindDefinition,
  runtime: ParserSyntaxRuntime
): { content: string; commentText?: string; evaluationText: string } | undefined {
  const rawMatched = classifierMatches(lineKind.classifier, record.raw, runtime);
  const shouldStripTrailingComment = allowsTrailingComment(lineKind, runtime);
  const stripped = shouldStripTrailingComment ? stripTrailingComment(record.raw) : undefined;
  const strippedMatched =
    shouldStripTrailingComment && stripped ? classifierMatches(lineKind.classifier, stripped.content, runtime) : false;

  if (!rawMatched && !strippedMatched) {
    return undefined;
  }

  if (shouldStripTrailingComment && stripped) {
    return {
      content: stripped.content,
      commentText: stripped.commentText,
      evaluationText: stripped.content
    };
  }

  return {
    content: record.raw.trimEnd(),
    evaluationText: record.raw
  };
}

function resolveMultiStatementKind(
  lineKind: SyntaxLineKindDefinition,
  evaluationText: string,
  runtime: ParserSyntaxRuntime
): string | undefined {
  const matchedStatements = statementNamesForLineKind(lineKind).filter((statementName) => {
    const statement = getStatement(runtime, statementName);
    return statement.match ? classifierMatches(statement.match, evaluationText, runtime) : false;
  });

  return matchedStatements.length === 1 ? matchedStatements[0] : undefined;
}

export function classifyLine(record: LineRecord, runtime: ParserSyntaxRuntime): ClassifiedLine {
  const span = makeSpan(record);

  for (const lineKind of runtime.lineKindsInPrecedenceOrder) {
    const matched = matchLineKind(record, lineKind, runtime);
    if (!matched) {
      continue;
    }

    if (lineKind.statement) {
      return classifyMatchedStatement(
        lineKind.statement,
        lineKind.kind,
        record,
        span,
        matched.content,
        matched.commentText,
        runtime
      );
    }

    const resolvedStatement = resolveMultiStatementKind(lineKind, matched.evaluationText, runtime);
    if (!resolvedStatement) {
      return {
        kind: "unknown",
        lineKindKind: lineKind.kind,
        content: matched.content,
        span,
        commentText: matched.commentText
      };
    }

    return classifyMatchedStatement(
      resolvedStatement,
      lineKind.kind,
      record,
      span,
      matched.content,
      matched.commentText,
      runtime
    );
  }

  return {
    kind: "unknown",
    lineKindKind: "unknown",
    content: record.raw.trimEnd(),
    span
  };
}
