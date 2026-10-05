import type { Bundle } from "../bundle/types.js";
import { getGraphSourcePath, type CompiledGraph } from "../compiler/types.js";
import { hasErrors, sortDiagnostics } from "../diagnostics/types.js";
import { resolveDiagramSelection } from "../diagrams/resolveDiagrams.js";
import { attachProjectionSourceEdgeIndex, copySelectedGraphContext } from "./edgeOccurrences.js";
import type { ProjectionResult } from "./types.js";
import { getViewProjector } from "./viewProjectors.js";

export interface ProjectOptions { diagramId?: string; }

export function projectView(graph: CompiledGraph, bundle: Bundle, viewId: string, options: ProjectOptions = {}): ProjectionResult {
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

  return projectResolvedSelection(graph, bundle, resolveDiagramSelection(graph, bundle, { viewId, diagramId: options.diagramId }));
}

function projectResolvedSelection(graph: CompiledGraph, bundle: Bundle, selection: ReturnType<typeof resolveDiagramSelection>): ProjectionResult {
  if (hasErrors(selection.diagnostics)) return { diagnostics: sortDiagnostics(selection.diagnostics) };
  const view = bundle.views.views.find(candidate => candidate.id === selection.viewId);
  const projector = view ? getViewProjector(view.id) : undefined;
  if (!view || !projector) return { diagnostics: [{ stage: "project", code: "project.unsupported_view", severity: "error",
    message: `View '${selection.viewId}' is not supported in v0.1`, file: getGraphSourcePath(graph) ?? "<compiled>" }] };
  attachProjectionSourceEdgeIndex(graph, selection.sourceEdgeIndex);
  const structuralGraph = selection.diagramId ? { ...graph, nodes: selection.nodes, edges: selection.edges } : graph;
  if (structuralGraph !== graph) copySelectedGraphContext(graph, structuralGraph, selection.sourceEdgeIndex);
  const projected = projector(structuralGraph, bundle, view, {
    primaryNodes: selection.nodes, primaryEdges: selection.edges,
    documentGraph: graph, sourceEdgeIndex: selection.sourceEdgeIndex,
    diagramId: selection.diagramId, diagramName: selection.diagramName
  });
  return { ...projected, diagnostics: sortDiagnostics([...selection.diagnostics, ...projected.diagnostics]) };
}

export function projectDiagram(graph: CompiledGraph, bundle: Bundle, diagramId: string): ProjectionResult {
  return projectResolvedSelection(graph, bundle, resolveDiagramSelection(graph, bundle, { diagramId }));
}
