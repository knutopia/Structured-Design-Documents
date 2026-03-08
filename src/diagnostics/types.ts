import type { Diagnostic, Severity } from "../types.js";

const severityOrder: Record<Severity, number> = {
  error: 0,
  warn: 1,
  info: 2
};

export function compareDiagnostics(a: Diagnostic, b: Diagnostic): number {
  const severityCompare = severityOrder[a.severity] - severityOrder[b.severity];
  if (severityCompare !== 0) {
    return severityCompare;
  }

  const stageCompare = a.stage.localeCompare(b.stage);
  if (stageCompare !== 0) {
    return stageCompare;
  }

  const codeCompare = a.code.localeCompare(b.code);
  if (codeCompare !== 0) {
    return codeCompare;
  }

  const fileCompare = a.file.localeCompare(b.file);
  if (fileCompare !== 0) {
    return fileCompare;
  }

  const lineCompare = (a.span?.line ?? 0) - (b.span?.line ?? 0);
  if (lineCompare !== 0) {
    return lineCompare;
  }

  const columnCompare = (a.span?.column ?? 0) - (b.span?.column ?? 0);
  if (columnCompare !== 0) {
    return columnCompare;
  }

  const ruleCompare = (a.ruleId ?? "").localeCompare(b.ruleId ?? "");
  if (ruleCompare !== 0) {
    return ruleCompare;
  }

  return a.message.localeCompare(b.message);
}

export function sortDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  return [...diagnostics].sort(compareDiagnostics);
}

export function hasErrors(diagnostics: Diagnostic[]): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}

export type { Diagnostic, Severity };

