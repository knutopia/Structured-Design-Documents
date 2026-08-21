import type { Bundle } from "../bundle/types.js";
import {
  getBundleRenderDetailFallback,
  getBundleValidationProfileFallback
} from "../bundle/toolDefaults.js";
import { compileSource } from "../compiler/compileSource.js";
import { getGraphSourcePath, type CompiledGraph } from "../compiler/types.js";
import { hasErrors, sortDiagnostics } from "../diagnostics/types.js";
import { projectView } from "../projector/projectView.js";
import type { RenderOptions, RenderResult, SourceInput } from "../types.js";
import { validateGraph } from "../validator/validateGraph.js";
import { getTextArtifactCapability, getViewTextRenderer } from "./viewRenderers.js";

type ResolvedRenderOptions = RenderOptions & { profileId: string; detailId: string };

export function renderCompiledGraphText(
  graph: CompiledGraph,
  bundle: Bundle,
  options: ResolvedRenderOptions
): RenderResult {
  const projected = projectView(graph, bundle, options.viewId);
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
  const renderer = getViewTextRenderer(options.viewId);
  if (!view || !renderer || !getTextArtifactCapability(renderer.capability, options.format)) {
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

  const rendered = renderer.render(
    projected.projection,
    graph,
    bundle,
    view,
    options.format,
    options.detailId
  );

  return {
    format: options.format,
    viewId: options.viewId,
    profileId: options.profileId,
    detailId: options.detailId,
    text: rendered.text,
    notes: rendered.notes,
    diagnostics: sortDiagnostics(diagnostics)
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
    text: rendered.text,
    notes: rendered.notes,
    diagnostics: sortDiagnostics([...diagnostics, ...rendered.diagnostics])
  };
}
