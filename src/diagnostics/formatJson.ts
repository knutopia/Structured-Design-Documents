import type { Diagnostic } from "../types.js";

export function formatJsonDiagnostics(diagnostics: Diagnostic[]): string {
  return JSON.stringify(diagnostics, null, 2);
}

