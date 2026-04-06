import type { Diagnostic, SourceSpan } from "../types.js";

export interface CompiledNode {
  id: string;
  type: string;
  name: string;
  props: Record<string, string>;
}

export interface CompiledEdge {
  from: string;
  type: string;
  to: string;
  to_name: string | null;
  event: string | null;
  guard: string | null;
  effect: string | null;
  props: Record<string, string>;
}

export interface CompiledGraph {
  schema: "sdd-text";
  version: string;
  nodes: CompiledNode[];
  edges: CompiledEdge[];
}

export interface AuthorOrderedEdge {
  type: string;
  to: string;
}

export interface CompiledGraphAuthorOrder {
  topLevelNodeIds: string[];
  edgeLineOrderByParentId: Map<string, AuthorOrderedEdge[]>;
}

export interface CompileResult {
  graph?: CompiledGraph;
  diagnostics: Diagnostic[];
}

const graphSourcePath = new WeakMap<CompiledGraph, string>();
const graphAuthorOrder = new WeakMap<CompiledGraph, CompiledGraphAuthorOrder>();
const compiledEdgeSourceSpan = new WeakMap<CompiledEdge, SourceSpan>();

function cloneSourceSpan(span: SourceSpan): SourceSpan {
  return {
    line: span.line,
    column: span.column,
    endLine: span.endLine,
    endColumn: span.endColumn,
    startOffset: span.startOffset,
    endOffset: span.endOffset
  };
}

export function attachGraphSourcePath(graph: CompiledGraph, sourcePath: string): void {
  graphSourcePath.set(graph, sourcePath);
}

export function getGraphSourcePath(graph: CompiledGraph): string | undefined {
  return graphSourcePath.get(graph);
}

export function attachGraphAuthorOrder(graph: CompiledGraph, authorOrder: CompiledGraphAuthorOrder): void {
  graphAuthorOrder.set(graph, {
    topLevelNodeIds: [...authorOrder.topLevelNodeIds],
    edgeLineOrderByParentId: new Map(
      [...authorOrder.edgeLineOrderByParentId.entries()].map(([parentId, entries]) => [
        parentId,
        entries.map((entry) => ({ ...entry }))
      ])
    )
  });
}

export function getGraphAuthorOrder(graph: CompiledGraph): CompiledGraphAuthorOrder | undefined {
  return graphAuthorOrder.get(graph);
}

export function attachCompiledEdgeSourceSpan(edge: CompiledEdge, span: SourceSpan): void {
  compiledEdgeSourceSpan.set(edge, cloneSourceSpan(span));
}

export function getCompiledEdgeSourceSpan(edge: CompiledEdge): SourceSpan | undefined {
  const span = compiledEdgeSourceSpan.get(edge);
  return span ? cloneSourceSpan(span) : undefined;
}
