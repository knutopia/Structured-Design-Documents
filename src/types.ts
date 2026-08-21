export type Severity = "error" | "warn" | "info";
export type RenderDetailId = string;

export type DiagnosticStage =
  | "bundle"
  | "authoring"
  | "parse"
  | "compile"
  | "validate"
  | "project"
  | "render"
  | "cli";

export interface SourceInput {
  path: string;
  text: string;
}

export interface SourceSpan {
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  startOffset: number;
  endOffset: number;
}

export interface Diagnostic {
  stage: DiagnosticStage;
  code: string;
  severity: Severity;
  message: string;
  file: string;
  span?: SourceSpan;
  ruleId?: string;
  profileId?: string;
  relatedIds?: string[];
}

export interface RenderOptions {
  viewId: string;
  format: "dot" | "mermaid";
  profileId?: string;
  detailId?: RenderDetailId;
}

export interface RenderResult {
  format: "dot" | "mermaid";
  viewId: string;
  profileId: string;
  detailId: RenderDetailId;
  text?: string;
  notes: string[];
  diagnostics: Diagnostic[];
}
