import type { Bundle } from "../bundle/types.js";
import type { Diagnostic, SourceInput, SourceSpan } from "../types.js";
import { compareDiagnostics } from "../diagnostics/types.js";
import { classifyLine, type LineRecord } from "./classifyLine.js";
import { parseNodeBlock } from "./parseBlock.js";
import type { BlankLine, CommentLine, ParseDocument, ParseResult } from "./types.js";

function buildLineRecords(text: string): LineRecord[] {
  const lines = text.split(/\r\n|\n/);
  const records: LineRecord[] = [];
  let offset = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index] ?? "";
    records.push({
      raw,
      lineNumber: index + 1,
      startOffset: offset
    });
    offset += raw.length + 1;
  }
  return records;
}

function documentSpan(records: LineRecord[]): SourceSpan {
  const lastRecord = records[records.length - 1];
  return {
    line: 1,
    column: 1,
    endLine: lastRecord?.lineNumber ?? 1,
    endColumn: (lastRecord?.raw.length ?? 0) + 1,
    startOffset: 0,
    endOffset: lastRecord ? lastRecord.startOffset + lastRecord.raw.length : 0
  };
}

function toTrivia(record: LineRecord, bundle: Bundle): BlankLine | CommentLine | undefined {
  const classifiedLine = classifyLine(record, bundle);
  if (classifiedLine.kind === "blank_line") {
    return {
      kind: "BlankLine",
      span: classifiedLine.span
    };
  }

  if (classifiedLine.kind === "comment_line") {
    return {
      kind: "CommentLine",
      rawText: classifiedLine.commentText ?? "",
      span: classifiedLine.span
    };
  }

  return undefined;
}

function createDiagnostic(
  input: SourceInput,
  record: LineRecord,
  code: string,
  message: string
): Diagnostic {
  return {
    stage: "parse",
    code,
    severity: "error",
    message,
    file: input.path,
    span: {
      line: record.lineNumber,
      column: 1,
      endLine: record.lineNumber,
      endColumn: record.raw.length + 1,
      startOffset: record.startOffset,
      endOffset: record.startOffset + record.raw.length
    }
  };
}

function parseVersionDeclaration(
  input: SourceInput,
  record: LineRecord,
  bundle: Bundle,
  diagnostics: Diagnostic[]
): string | undefined {
  const classifiedLine = classifyLine(record, bundle);
  const content = classifiedLine.content.trim();
  const literal = bundle.syntax.document.version_declaration.literal;
  const versionPattern = new RegExp(bundle.syntax.lexical.version_number_pattern);
  if (!content.startsWith(`${literal} `)) {
    return undefined;
  }
  const version = content.slice(literal.length).trim();
  if (!versionPattern.test(version)) {
    diagnostics.push(
      createDiagnostic(input, record, "parse.invalid_version_declaration", "Invalid version declaration")
    );
    return undefined;
  }

  if (!bundle.syntax.document.version_declaration.post_parse_supported_versions.includes(version)) {
    diagnostics.push(
      createDiagnostic(
        input,
        record,
        "parse.unsupported_version",
        `Unsupported version '${version}'`
      )
    );
  }

  return version;
}

export function parseSource(input: SourceInput, bundle: Bundle): ParseResult {
  const diagnostics: Diagnostic[] = [];
  const records = buildLineRecords(input.text);
  const items: ParseDocument["items"] = [];
  let index = 0;
  let declaredVersion: string | undefined;

  while (index < records.length) {
    const trivia = toTrivia(records[index], bundle);
    if (!trivia) {
      break;
    }
    items.push(trivia);
    index += 1;
  }

  if (index < records.length) {
    const maybeVersion = parseVersionDeclaration(input, records[index], bundle, diagnostics);
    if (maybeVersion !== undefined) {
      declaredVersion = maybeVersion;
      index += 1;
      while (index < records.length) {
        const trivia = toTrivia(records[index], bundle);
        if (!trivia) {
          break;
        }
        items.push(trivia);
        index += 1;
      }
    }
  }

  while (index < records.length) {
    const record = records[index];
    const classifiedLine = classifyLine(record, bundle);
    if (classifiedLine.kind === "blank_line" || classifiedLine.kind === "comment_line") {
      const trivia = toTrivia(record, bundle);
      if (trivia) {
        items.push(trivia);
      }
      index += 1;
      continue;
    }

    if (classifiedLine.kind !== "top_node_header") {
      diagnostics.push(
        createDiagnostic(
          input,
          record,
          "parse.expected_top_node_header",
          "Expected a top-level node block"
        )
      );
      index += 1;
      continue;
    }

    const parsedBlock = parseNodeBlock(input.path, records, index, bundle, diagnostics, "top_node_header");
    if (parsedBlock.block) {
      items.push(parsedBlock.block);
    }
    index = parsedBlock.nextIndex;
  }

  const errorDiagnostics = diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  if (errorDiagnostics.length > 0) {
    return {
      diagnostics: diagnostics.sort(compareDiagnostics)
    };
  }

  const document: ParseDocument = {
    kind: "Document",
    declaredVersion,
    effectiveVersion: declaredVersion ?? bundle.syntax.document.version_declaration.default_effective_version,
    items,
    span: documentSpan(records)
  };

  return {
    document,
    diagnostics: diagnostics.sort(compareDiagnostics)
  };
}
