import type { Diagnostic } from "../types.js";

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

export interface CompileResult {
  graph?: CompiledGraph;
  diagnostics: Diagnostic[];
}

const graphSourcePath = new WeakMap<CompiledGraph, string>();

export function attachGraphSourcePath(graph: CompiledGraph, sourcePath: string): void {
  graphSourcePath.set(graph, sourcePath);
}

export function getGraphSourcePath(graph: CompiledGraph): string | undefined {
  return graphSourcePath.get(graph);
}

