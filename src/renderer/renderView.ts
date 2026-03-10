import type { Bundle } from "../bundle/types.js";
import { compileSource } from "../compiler/compileSource.js";
import { getGraphSourcePath, type CompiledGraph } from "../compiler/types.js";
import { hasErrors, sortDiagnostics } from "../diagnostics/types.js";
import { projectView } from "../projector/projectView.js";
import type { Projection } from "../projector/types.js";
import type { RenderOptions, RenderResult, SourceInput } from "../types.js";
import { validateGraph } from "../validator/validateGraph.js";
import { renderIaPlaceMapDot } from "./dot.js";
import { buildIaPlaceMapRenderModel } from "./iaPlaceMapRenderModel.js";
import { renderIaPlaceMapMermaid } from "./mermaid.js";
import { getFallbackDotPreviewStyle, resolveDotPreviewStyle } from "./previewStyle.js";

function renderCompiledGraph(graph: CompiledGraph, bundle: Bundle, options: RenderOptions): RenderResult {
  const projected = projectView(graph, bundle, options.viewId);
  const diagnostics = [...projected.diagnostics];
  if (!projected.projection) {
    return {
      format: options.format,
      viewId: options.viewId,
      diagnostics: sortDiagnostics(diagnostics)
    };
  }

  const projection = projected.projection;
  if (projection.view_id !== "ia_place_map") {
    diagnostics.push({
      stage: "render",
      code: "render.unsupported_view",
      severity: "error",
      message: `View '${projection.view_id}' is not supported in v0.1`,
      file: getGraphSourcePath(graph) ?? "<compiled>"
    });
    return {
      format: options.format,
      viewId: options.viewId,
      diagnostics: sortDiagnostics(diagnostics)
    };
  }

  const view = bundle.views.views.find((candidate) => candidate.id === options.viewId);
  const model = buildIaPlaceMapRenderModel(projection as Projection, graph, view?.projection.hierarchy_edges ?? []);
  const dotStyle = view ? resolveDotPreviewStyle(bundle, view) : getFallbackDotPreviewStyle();
  const text =
    options.format === "dot" ? renderIaPlaceMapDot(model, dotStyle) : renderIaPlaceMapMermaid(model);
  return {
    format: options.format,
    viewId: options.viewId,
    text,
    diagnostics: sortDiagnostics(diagnostics)
  };
}

export function renderSource(input: SourceInput, bundle: Bundle, options: RenderOptions): RenderResult {
  const compileResult = compileSource(input, bundle);
  const diagnostics = [...compileResult.diagnostics];
  if (!compileResult.graph || hasErrors(diagnostics)) {
    return {
      format: options.format,
      viewId: options.viewId,
      diagnostics: sortDiagnostics(diagnostics)
    };
  }

  const validation = validateGraph(compileResult.graph, bundle, options.profileId ?? "recommended");
  diagnostics.push(...validation.diagnostics);
  if (validation.errorCount > 0) {
    return {
      format: options.format,
      viewId: options.viewId,
      diagnostics: sortDiagnostics(diagnostics)
    };
  }

  const rendered = renderCompiledGraph(compileResult.graph, bundle, options);
  return {
    format: options.format,
    viewId: options.viewId,
    text: rendered.text,
    diagnostics: sortDiagnostics([...diagnostics, ...rendered.diagnostics])
  };
}
