import type { Diagnostic } from "../types.js";
import { sortDiagnostics } from "./types.js";

interface DiagnosticBucket {
  severity: Diagnostic["severity"];
  code: string;
  ruleId?: string;
  diagnostics: Diagnostic[];
}

interface FileDiagnostics {
  file: string;
  buckets: DiagnosticBucket[];
}

function bucketKey(diagnostic: Diagnostic): string {
  return `${diagnostic.severity}\u0000${diagnostic.code}\u0000${diagnostic.ruleId ?? ""}`;
}

function formatInstanceCount(count: number): string {
  return `${count} instance${count === 1 ? "" : "s"}`;
}

function formatLocation(diagnostic: Diagnostic): string {
  if (!diagnostic.span) {
    return "<no span>";
  }

  return `${diagnostic.span.line}:${diagnostic.span.column}`;
}

function groupDiagnostics(diagnostics: Diagnostic[]): FileDiagnostics[] {
  const files = new Map<string, { group: FileDiagnostics; buckets: Map<string, DiagnosticBucket> }>();

  for (const diagnostic of sortDiagnostics(diagnostics)) {
    let fileGroup = files.get(diagnostic.file);
    if (!fileGroup) {
      fileGroup = {
        group: {
          file: diagnostic.file,
          buckets: []
        },
        buckets: new Map()
      };
      files.set(diagnostic.file, fileGroup);
    }

    const key = bucketKey(diagnostic);
    let bucket = fileGroup.buckets.get(key);
    if (!bucket) {
      bucket = {
        severity: diagnostic.severity,
        code: diagnostic.code,
        ruleId: diagnostic.ruleId,
        diagnostics: []
      };
      fileGroup.buckets.set(key, bucket);
      fileGroup.group.buckets.push(bucket);
    }

    bucket.diagnostics.push(diagnostic);
  }

  return [...files.values()].map((entry) => entry.group);
}

export function formatPrettyDiagnostics(diagnostics: Diagnostic[]): string {
  if (diagnostics.length === 0) {
    return "";
  }

  return groupDiagnostics(diagnostics)
    .map((fileGroup) => {
      const lines = [fileGroup.file];

      for (const bucket of fileGroup.buckets) {
        const ruleSuffix = bucket.ruleId ? ` [${bucket.ruleId}]` : "";
        const sharedMessage = bucket.diagnostics.every((diagnostic) => diagnostic.message === bucket.diagnostics[0]?.message)
          ? bucket.diagnostics[0]?.message
          : undefined;
        const header = `  ${bucket.severity.toUpperCase()} ${bucket.code}${ruleSuffix} (${formatInstanceCount(bucket.diagnostics.length)})`;
        lines.push(sharedMessage ? `${header} ${sharedMessage}` : header);

        for (const diagnostic of bucket.diagnostics) {
          const suffix = sharedMessage ? "" : ` ${diagnostic.message}`;
          lines.push(`    ${formatLocation(diagnostic)}${suffix}`);
        }
      }

      return lines.join("\n");
    })
    .join("\n\n");
}
