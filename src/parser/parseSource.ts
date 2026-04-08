import type { Bundle } from "../bundle/types.js";
import type { Diagnostic, SourceInput, SourceSpan } from "../types.js";
import { compareDiagnostics } from "../diagnostics/types.js";
import { classifyLine, statementKindForClassifiedLine, type ClassifiedLine, type LineRecord } from "./classifyLine.js";
import { parseNodeBlock } from "./parseBlock.js";
import { createParserSyntaxRuntime, getBlock, getStatement, type ParserSyntaxRuntime } from "./syntaxRuntime.js";
import { getCapturePrimary, interpretStatement } from "./statementInterpreter.js";
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

function toTriviaFromClassifiedLine(
  classifiedLine: ClassifiedLine,
  runtime: ParserSyntaxRuntime,
  statementKind: string | undefined
): BlankLine | CommentLine | undefined {
  if (!statementKind) {
    return undefined;
  }

  const emittedKind = getStatement(runtime, statementKind).emits?.kind;
  if (emittedKind === "BlankLine") {
    return {
      kind: "BlankLine",
      span: classifiedLine.span
    };
  }

  if (emittedKind === "CommentLine") {
    return {
      kind: "CommentLine",
      rawText: classifiedLine.commentText ?? "",
      span: classifiedLine.span
    };
  }

  return undefined;
}

function toAllowedDocumentTrivia(
  record: LineRecord,
  runtime: ParserSyntaxRuntime,
  allowedStatements: Set<string>
): BlankLine | CommentLine | undefined {
  const classifiedLine = classifyLine(record, runtime);
  const statementKind = statementKindForClassifiedLine(classifiedLine, runtime);
  if (!statementKind || !allowedStatements.has(statementKind)) {
    return undefined;
  }

  return toTriviaFromClassifiedLine(classifiedLine, runtime, statementKind);
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

function createDocumentDiagnostic(
  input: SourceInput,
  records: LineRecord[],
  code: string,
  message: string
): Diagnostic {
  return {
    stage: "parse",
    code,
    severity: "error",
    message,
    file: input.path,
    span: documentSpan(records)
  };
}

function isVersionDeclarationCandidate(record: LineRecord, runtime: ParserSyntaxRuntime): boolean {
  return record.raw.trimStart().startsWith(runtime.syntax.document.version_declaration.literal);
}

function parseVersionDeclaration(
  input: SourceInput,
  record: LineRecord,
  runtime: ParserSyntaxRuntime,
  diagnostics: Diagnostic[]
): { consumed: boolean; declaredVersion?: string } {
  if (!isVersionDeclarationCandidate(record, runtime)) {
    return { consumed: false };
  }

  const versionConfig = runtime.syntax.document.version_declaration;
  const parsed = interpretStatement(record.raw, versionConfig.statement_kind, runtime);
  if (!parsed.ok) {
    diagnostics.push(
      createDiagnostic(input, record, "parse.invalid_version_declaration", "Invalid version declaration")
    );
    return { consumed: true };
  }

  const version = getCapturePrimary(parsed.captures, "version_number");
  if (typeof version !== "string") {
    diagnostics.push(
      createDiagnostic(input, record, "parse.invalid_version_declaration", "Invalid version declaration")
    );
    return { consumed: true };
  }

  if (!versionConfig.allowed) {
    diagnostics.push(
      createDiagnostic(
        input,
        record,
        "parse.unexpected_version_declaration",
        "Version declaration is not allowed by the document syntax contract"
      )
    );
    return { consumed: true };
  }

  if (!versionConfig.post_parse_supported_versions.includes(version)) {
    diagnostics.push(
      createDiagnostic(
        input,
        record,
        "parse.unsupported_version",
        `Unsupported version '${version}'`
      )
    );
  }

  return {
    consumed: true,
    declaredVersion: version
  };
}

function hasTopLevelBlockAhead(
  records: LineRecord[],
  startIndex: number,
  runtime: ParserSyntaxRuntime,
  headerStatement: string
): boolean {
  for (let index = startIndex; index < records.length; index += 1) {
    const classifiedLine = classifyLine(records[index], runtime);
    if (statementKindForClassifiedLine(classifiedLine, runtime) === headerStatement) {
      return true;
    }
  }

  return false;
}

export function parseSource(input: SourceInput, bundle: Bundle): ParseResult {
  const diagnostics: Diagnostic[] = [];
  const records = buildLineRecords(input.text);
  const runtime = createParserSyntaxRuntime(bundle);
  const { document: documentConfig } = runtime.syntax;
  const topLevelBlockName = documentConfig.top_level_block_kind;
  const topLevelHeaderStatement = getBlock(runtime, topLevelBlockName).header_statement;
  const betweenBlockAllowedStatements = new Set([
    ...runtime.documentLeadingLineKinds,
    ...runtime.documentTrailingLineKinds
  ]);
  const items: ParseDocument["items"] = [];
  let index = 0;
  let declaredVersion: string | undefined;
  let topLevelBlockCount = 0;

  while (index < records.length) {
    const trivia = toAllowedDocumentTrivia(records[index], runtime, runtime.documentLeadingLineKinds);
    if (!trivia) {
      break;
    }
    items.push(trivia);
    index += 1;
  }

  if (index < records.length) {
    const parsedVersion = parseVersionDeclaration(input, records[index], runtime, diagnostics);
    if (parsedVersion.consumed) {
      declaredVersion = parsedVersion.declaredVersion;
      index += 1;

      while (index < records.length) {
        const trivia = toAllowedDocumentTrivia(records[index], runtime, runtime.documentLeadingLineKinds);
        if (!trivia) {
          break;
        }
        items.push(trivia);
        index += 1;
      }
    } else if (documentConfig.version_declaration.required) {
      diagnostics.push(
        createDocumentDiagnostic(
          input,
          records,
          "parse.missing_version_declaration",
          "Document is missing the required version declaration"
        )
      );
    }
  } else if (documentConfig.version_declaration.required) {
    diagnostics.push(
      createDocumentDiagnostic(
        input,
        records,
        "parse.missing_version_declaration",
        "Document is missing the required version declaration"
      )
    );
  }

  while (index < records.length) {
    const record = records[index];
    const classifiedLine = classifyLine(record, runtime);
    const statementKind = statementKindForClassifiedLine(classifiedLine, runtime);

    if (statementKind === topLevelHeaderStatement) {
      const parsedBlock = parseNodeBlock(input.path, records, index, runtime, diagnostics, topLevelBlockName);
      if (parsedBlock.block) {
        items.push(parsedBlock.block);
        topLevelBlockCount += 1;
      }
      index = parsedBlock.nextIndex;
      continue;
    }

    const trivia = toTriviaFromClassifiedLine(classifiedLine, runtime, statementKind);
    if (trivia && statementKind) {
      const allowedStatements =
        topLevelBlockCount === 0
          ? runtime.documentLeadingLineKinds
          : hasTopLevelBlockAhead(records, index + 1, runtime, topLevelHeaderStatement)
            ? betweenBlockAllowedStatements
            : runtime.documentTrailingLineKinds;

      if (allowedStatements.has(statementKind)) {
        items.push(trivia);
        index += 1;
        continue;
      }
    }

    diagnostics.push(
      createDiagnostic(
        input,
        record,
        "parse.expected_top_level_block",
        "Expected a top-level node block"
      )
    );
    index += 1;
  }

  if (topLevelBlockCount < documentConfig.minimum_top_level_blocks) {
    diagnostics.push(
      createDocumentDiagnostic(
        input,
        records,
        "parse.minimum_top_level_blocks",
        `Expected at least ${documentConfig.minimum_top_level_blocks} top-level node block${
          documentConfig.minimum_top_level_blocks === 1 ? "" : "s"
        }`
      )
    );
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
    effectiveVersion: declaredVersion ?? documentConfig.version_declaration.default_effective_version,
    items,
    span: documentSpan(records)
  };

  return {
    document,
    diagnostics: diagnostics.sort(compareDiagnostics)
  };
}
