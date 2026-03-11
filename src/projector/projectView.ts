import type { Bundle } from "../bundle/types.js";
import { getGraphSourcePath, type CompiledGraph } from "../compiler/types.js";
import { sortDiagnostics } from "../diagnostics/types.js";
import type { ProjectionResult } from "./types.js";
import { getViewProjector } from "./viewProjectors.js";

export function projectView(graph: CompiledGraph, bundle: Bundle, viewId: string): ProjectionResult {
  const file = getGraphSourcePath(graph) ?? "<compiled>";
  const view = bundle.views.views.find((candidate) => candidate.id === viewId);
  if (!view) {
    return {
      diagnostics: sortDiagnostics([
        {
          stage: "project",
          code: "project.unknown_view",
          severity: "error",
          message: `Unknown view '${viewId}'`,
          file
        }
      ])
    };
  }

  const projector = getViewProjector(view.id);
  if (!projector) {
    return {
      diagnostics: sortDiagnostics([
        {
          stage: "project",
          code: "project.unsupported_view",
          severity: "error",
          message: `View '${viewId}' is not supported in v0.1`,
          file
        }
      ])
    };
  }

  return projector(graph, bundle, view);
}
