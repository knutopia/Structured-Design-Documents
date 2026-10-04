import type { Bundle } from "../bundle/types.js";
import { compileSource } from "../compiler/compileSource.js";
import type { CompiledGraph } from "../compiler/types.js";
import type { Diagnostic, SourceInput } from "../types.js";
import { projectDiagram, projectView, type ProjectOptions } from "./projectView.js";
import type { Projection, ProjectionResult } from "./types.js";

interface CompileAndProjectSourceResult {
  graph?: CompiledGraph;
  projection?: Projection;
  diagnostics: Diagnostic[];
}

function compileAndProjectSource(
  input: SourceInput,
  bundle: Bundle,
  viewId: string,
  options?: ProjectOptions
): CompileAndProjectSourceResult {
  const compiled = compileSource(input, bundle);
  if (!compiled.graph) {
    return {
      diagnostics: compiled.diagnostics
    };
  }

  const projected = projectView(compiled.graph, bundle, viewId, options);
  return {
    graph: compiled.graph,
    projection: projected.projection,
    diagnostics: projected.diagnostics
  };
}

export function projectSource(input: SourceInput, bundle: Bundle, viewId: string, options?: ProjectOptions): ProjectionResult {
  const projected = compileAndProjectSource(input, bundle, viewId, options);
  return {
    projection: projected.projection,
    diagnostics: projected.diagnostics
  };
}

export function projectDiagramSource(input: SourceInput, bundle: Bundle, diagramId: string): ProjectionResult {
  const compiled = compileSource(input, bundle);
  if (!compiled.graph) return { diagnostics: compiled.diagnostics };
  return projectDiagram(compiled.graph, bundle, diagramId);
}
