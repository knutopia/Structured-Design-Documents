import type { Diagnostic } from "../types.js";

export function formatPrettyDiagnostics(diagnostics: Diagnostic[]): string {
  return diagnostics
    .map((diagnostic) => {
      const location = diagnostic.span
        ? `${diagnostic.file}:${diagnostic.span.line}:${diagnostic.span.column}`
        : diagnostic.file;
      const ruleSuffix = diagnostic.ruleId ? ` [${diagnostic.ruleId}]` : "";
      return `${location} ${diagnostic.severity.toUpperCase()} ${diagnostic.code}${ruleSuffix} ${diagnostic.message}`;
    })
    .join("\n");
}

