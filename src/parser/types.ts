import type { Diagnostic, SourceSpan } from "../types.js";

export type ValueKind = "quoted_string" | "bare_value";

export interface BlankLine {
  kind: "BlankLine";
  span: SourceSpan;
}

export interface CommentLine {
  kind: "CommentLine";
  rawText: string;
  span: SourceSpan;
}

export interface PropertyLine {
  kind: "PropertyLine";
  key: string;
  valueKind: ValueKind;
  rawValue: string;
  span: SourceSpan;
}

export interface EdgeProperty {
  kind: "EdgeProperty";
  key: string;
  valueKind: ValueKind;
  rawValue: string;
}

export interface EdgeLine {
  kind: "EdgeLine";
  relType: string;
  to: string;
  toName: string | null;
  event: string | null;
  guard: string | null;
  effect: string | null;
  props: EdgeProperty[];
  span: SourceSpan;
}

export interface NodeBlock {
  kind: "NodeBlock";
  headerKind: string;
  nodeType: string;
  id: string;
  name: string;
  bodyItems: ParseBodyItem[];
  span: SourceSpan;
  headerSpan: SourceSpan;
}

export type ParseBodyItem = PropertyLine | EdgeLine | NodeBlock | BlankLine | CommentLine;

export interface ParseDocument {
  kind: "Document";
  declaredVersion?: string;
  effectiveVersion: string;
  items: Array<NodeBlock | BlankLine | CommentLine>;
  span: SourceSpan;
}

export interface ParseResult {
  document?: ParseDocument;
  diagnostics: Diagnostic[];
}
