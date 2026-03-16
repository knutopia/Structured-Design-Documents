export type RendererDiagnosticPhase = "scene" | "measure" | "layout" | "routing" | "backend";
export type RendererDiagnosticSeverity = "error" | "warn" | "info";

export interface RendererDiagnostic {
  phase: RendererDiagnosticPhase;
  code: string;
  severity: RendererDiagnosticSeverity;
  message: string;
  targetId?: string;
  details?: string;
}

const severityOrder: Record<RendererDiagnosticSeverity, number> = {
  error: 0,
  warn: 1,
  info: 2
};

const phaseOrder: Record<RendererDiagnosticPhase, number> = {
  scene: 0,
  measure: 1,
  layout: 2,
  routing: 3,
  backend: 4
};

export function compareRendererDiagnostics(a: RendererDiagnostic, b: RendererDiagnostic): number {
  const severityCompare = severityOrder[a.severity] - severityOrder[b.severity];
  if (severityCompare !== 0) {
    return severityCompare;
  }

  const phaseCompare = phaseOrder[a.phase] - phaseOrder[b.phase];
  if (phaseCompare !== 0) {
    return phaseCompare;
  }

  const codeCompare = a.code.localeCompare(b.code);
  if (codeCompare !== 0) {
    return codeCompare;
  }

  const targetCompare = (a.targetId ?? "").localeCompare(b.targetId ?? "");
  if (targetCompare !== 0) {
    return targetCompare;
  }

  const detailsCompare = (a.details ?? "").localeCompare(b.details ?? "");
  if (detailsCompare !== 0) {
    return detailsCompare;
  }

  return a.message.localeCompare(b.message);
}

export function sortRendererDiagnostics(diagnostics: RendererDiagnostic[]): RendererDiagnostic[] {
  return [...diagnostics].sort(compareRendererDiagnostics);
}

export function hasRendererErrors(diagnostics: RendererDiagnostic[]): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}
