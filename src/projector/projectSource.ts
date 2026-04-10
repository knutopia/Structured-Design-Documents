import type { Bundle } from "../bundle/types.js";
import { compileSource } from "../compiler/compileSource.js";
import type { CompiledGraph } from "../compiler/types.js";
import type { Diagnostic, SourceInput } from "../types.js";
import { projectView } from "./projectView.js";
import type { Projection, ProjectionResult } from "./types.js";

interface CompileAndProjectSourceResult {
  graph?: CompiledGraph;
  projection?: Projection;
  diagnostics: Diagnostic[];
}

function compileAndProjectSource(
  input: SourceInput,
  bundle: Bundle,
  viewId: string
): CompileAndProjectSourceResult {
  const compiled = compileSource(input, bundle);
  if (!compiled.graph) {
    return {
      diagnostics: compiled.diagnostics
    };
  }

  const projected = projectView(compiled.graph, bundle, viewId);
  return {
    graph: compiled.graph,
    projection: projected.projection,
    diagnostics: projected.diagnostics
  };
}

export function projectSource(input: SourceInput, bundle: Bundle, viewId: string): ProjectionResult {
  const projected = compileAndProjectSource(input, bundle, viewId);
  return {
    projection: projected.projection,
    diagnostics: projected.diagnostics
  };
}
