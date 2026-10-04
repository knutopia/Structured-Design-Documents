import { ensureProjectionSourceEdgeIndex, projectionOccurrenceDiagnostics } from "../projector/edgeOccurrences.js";
import type { Bundle, ViewSpec } from "../bundle/types.js";
import {
  getBundleRenderDetailFallback,
  getBundleValidationProfileFallback
} from "../bundle/toolDefaults.js";
import { compileSource } from "../compiler/compileSource.js";
import { getGraphSourcePath, type CompiledGraph } from "../compiler/types.js";
import { hasErrors, sortDiagnostics } from "../diagnostics/types.js";
import { projectView } from "../projector/projectView.js";
import type { Projection } from "../projector/types.js";
import type { RenderOptions, RenderResult, SourceInput } from "../types.js";
import { validateGraph } from "../validator/validateGraph.js";
import { prepareProjectionForRender } from "./prepareProjectionForRender.js";
import { getTextArtifactCapability, getViewTextRenderer } from "./viewRenderers.js";

type ResolvedRenderOptions = RenderOptions & { profileId: string; detailId: string };

export function renderPreparedProjectionText(
  graph: CompiledGraph,
  bundle: Bundle,
  view: ViewSpec,
  projection: Projection,
  options: ResolvedRenderOptions
): RenderResult {
  if (projection.diagram_id) ensureProjectionSourceEdgeIndex(graph, bundle);
  const occurrenceDiagnostics = projectionOccurrenceDiagnostics(projection, graph, bundle);
  if (occurrenceDiagnostics.length) return { format: options.format, viewId: options.viewId, profileId: options.profileId,
    detailId: options.detailId, notes: [], diagnostics: occurrenceDiagnostics };
  const renderer = getViewTextRenderer(options.viewId);
  if (!renderer || !getTextArtifactCapability(renderer.capability, options.format)) {
    return {
      format: options.format,
      viewId: options.viewId,
      profileId: options.profileId,
      detailId: options.detailId,
      notes: [],
      diagnostics: [{
        stage: "render",
        code: "render.unsupported_view",
        severity: "error",
        message: `View '${options.viewId}' is not supported in v0.1`,
        file: getGraphSourcePath(graph) ?? "<compiled>"
      }]
    };
  }

  if (projection.diagram_id && prepareProjectionForRender(view, projection, graph, options.detailId).visibleSemanticNodeIds.length === 0) {
    return { format: options.format, viewId: view.id, diagramId: projection.diagram_id, diagramName: projection.diagram_name,
      profileId: options.profileId, detailId: options.detailId, notes: [], diagnostics: [{ stage: "render",
        code: "renderer.diagram_no_visible_content", severity: "error",
        message: `Diagram '${projection.diagram_id}' has no visible content at render detail '${options.detailId}'.`,
        file: getGraphSourcePath(graph) ?? "<compiled>" }] };
  }
  const rendered = renderer.render(
    projection,
    graph,
    bundle,
    view,
    options.format,
    options.detailId
  );

  if (projection.diagram_id && options.format === "dot") {
    rendered.text = rendered.text.replace(/^digraph [^\n]+ \{/, `digraph ${JSON.stringify(projection.diagram_name)} {`);
  }
  return {
    format: options.format,
    viewId: options.viewId,
    profileId: options.profileId,
    detailId: options.detailId,
    ...(projection.diagram_id ? { diagramId: projection.diagram_id, diagramName: projection.diagram_name } : {}),
    text: rendered.text,
    notes: rendered.notes,
    diagnostics: []
  };
}

export function renderCompiledGraphText(
  graph: CompiledGraph,
  bundle: Bundle,
  options: ResolvedRenderOptions
): RenderResult {
  const projected = projectView(graph, bundle, options.viewId, { diagramId: options.diagramId });
  const diagnostics = [...projected.diagnostics];
  if (!projected.projection) {
    return {
      format: options.format,
      viewId: options.viewId,
      profileId: options.profileId,
      detailId: options.detailId,
      notes: [],
      diagnostics: sortDiagnostics(diagnostics)
    };
  }

  const view = bundle.views.views.find((candidate) => candidate.id === options.viewId);
  if (!view) {
    diagnostics.push({
      stage: "render",
      code: "render.unsupported_view",
      severity: "error",
      message: `View '${options.viewId}' is not supported in v0.1`,
      file: getGraphSourcePath(graph) ?? "<compiled>"
    });
    return {
      format: options.format,
      viewId: options.viewId,
      profileId: options.profileId,
      detailId: options.detailId,
      notes: [],
      diagnostics: sortDiagnostics(diagnostics)
    };
  }

  const rendered = renderPreparedProjectionText(graph, bundle, view, projected.projection, options);
  return {
    ...rendered,
    diagnostics: sortDiagnostics([...diagnostics, ...rendered.diagnostics])
  };
}

export function renderSource(input: SourceInput, bundle: Bundle, options: RenderOptions): RenderResult {
  const profileId = options.profileId ?? getBundleValidationProfileFallback(bundle);
  const detailId = options.detailId ?? getBundleRenderDetailFallback(bundle);
  if (!bundle.manifest.render_details.some((detail) => detail.id === detailId)) {
    return {
      format: options.format,
      viewId: options.viewId,
      profileId,
      detailId,
      notes: [],
      diagnostics: [{
        stage: "render",
        code: "render.unknown_detail",
        severity: "error",
        message: `Unknown render detail '${detailId}'`,
        file: input.path
      }]
    };
  }
  const compileResult = compileSource(input, bundle);
  const diagnostics = [...compileResult.diagnostics];
  if (!compileResult.graph || hasErrors(diagnostics)) {
    return {
      format: options.format,
      viewId: options.viewId,
      profileId,
      detailId,
      notes: [],
      diagnostics: sortDiagnostics(diagnostics)
    };
  }

  const validation = validateGraph(compileResult.graph, bundle, profileId);
  diagnostics.push(...validation.diagnostics);
  if (validation.errorCount > 0) {
    return {
      format: options.format,
      viewId: options.viewId,
      profileId,
      detailId,
      notes: [],
      diagnostics: sortDiagnostics(diagnostics)
    };
  }

  const rendered = renderCompiledGraphText(compileResult.graph, bundle, {
    ...options,
    profileId,
    detailId
  });
  return {
    format: options.format,
    viewId: options.viewId,
    profileId,
    detailId,
    ...(rendered.diagramId ? { diagramId: rendered.diagramId, diagramName: rendered.diagramName } : {}),
    text: rendered.text,
    notes: rendered.notes,
    diagnostics: sortDiagnostics([...diagnostics, ...rendered.diagnostics])
  };
}
