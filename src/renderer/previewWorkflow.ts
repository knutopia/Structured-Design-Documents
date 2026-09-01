import type { Bundle, ViewSpec } from "../bundle/types.js";
import {
  getBundleRenderDetailFallback,
  getBundleValidationProfileFallback
} from "../bundle/toolDefaults.js";
import { compileSource } from "../compiler/compileSource.js";
import type { CompiledGraph } from "../compiler/types.js";
import { hasErrors, sortDiagnostics, type Diagnostic } from "../diagnostics/types.js";
import { projectView } from "../projector/projectView.js";
import type { Projection } from "../projector/types.js";
import type { SourceInput } from "../types.js";
import { validateGraph } from "../validator/validateGraph.js";
import {
  prepareProjectionForRender,
  type PreparedProjectionForRender
} from "./prepareProjectionForRender.js";
import {
  getPreviewBackend,
  renderPreviewArtifact,
  type PreviewArtifactResult
} from "./previewBackends.js";
import { renderPreparedProjectionText } from "./renderView.js";
import type { PreviewFormat, PreviewRendererBackendId } from "./renderArtifacts.js";
import type { RendererDiagnostic } from "./staged/diagnostics.js";
import {
  getPreviewArtifactCapability,
  getViewRenderCapability,
  type PreviewArtifactCapability,
  type ViewRenderCapability
} from "./viewRenderers.js";

export interface SourcePreviewRenderOptions {
  viewId: string;
  format: PreviewFormat;
  profileId?: string;
  detailId?: string;
  nodeDecoratorModeId?: string;
  backendId?: PreviewRendererBackendId;
}

export interface SourcePreviewRenderResult {
  profileId: string;
  detailId: string;
  view: ViewSpec;
  capability: ViewRenderCapability;
  previewCapability: PreviewArtifactCapability;
  artifact?: PreviewArtifactResult;
  notes: string[];
  diagnostics: Diagnostic[];
}

export interface CompiledPreviewRenderOptions {
  viewId: string;
  format: PreviewFormat;
  profileId: string;
  detailId: string;
  nodeDecoratorModeId?: string;
  backendId?: PreviewRendererBackendId;
}

export interface PreparedCompiledGraphPreview {
  profileId: string;
  detailId: string;
  view: ViewSpec;
  capability: ViewRenderCapability;
  previewCapability: PreviewArtifactCapability;
  prepared?: PreparedProjectionForRender;
  diagnostics: Diagnostic[];
}

function mapRendererDiagnostic(sourcePath: string, diagnostic: RendererDiagnostic): Diagnostic {
  const messageParts = [diagnostic.message];
  if (diagnostic.phase) {
    messageParts.push(`phase=${diagnostic.phase}`);
  }
  if (diagnostic.details) {
    messageParts.push(diagnostic.details);
  }

  return {
    stage: "render",
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: messageParts.join(" | "),
    file: sourcePath,
    relatedIds: diagnostic.targetId ? [diagnostic.targetId] : undefined
  };
}

function resolvePreviewView(bundle: Bundle, viewId: string): { view: ViewSpec; capability: ViewRenderCapability } {
  const view = bundle.views.views.find((candidate) => candidate.id === viewId);
  if (!view) {
    throw new Error(`Unknown view '${viewId}'.`);
  }

  const capability = getViewRenderCapability(viewId);
  if (!capability) {
    throw new Error(`View '${viewId}' is not renderable.`);
  }

  return {
    view,
    capability
  };
}

function resolvePreviewCapability(
  capability: ViewRenderCapability,
  format: PreviewFormat,
  backendId?: PreviewRendererBackendId
): PreviewArtifactCapability {
  const previewCapability = getPreviewArtifactCapability(capability, format, backendId);
  if (!previewCapability) {
    const backendSuffix = backendId ? ` with backend '${backendId}'` : "";
    throw new Error(`Unsupported preview format '${format}'${backendSuffix}.`);
  }

  return previewCapability;
}

function projectCompiledGraph(
  graph: CompiledGraph,
  bundle: Bundle,
  view: ViewSpec,
  detailId: string,
  diagnostics: Diagnostic[]
): PreparedProjectionForRender | undefined {
  const projected = projectView(graph, bundle, view.id);
  diagnostics.push(...projected.diagnostics);
  if (!projected.projection) {
    return undefined;
  }

  return prepareProjectionForRender(view, projected.projection, graph, detailId);
}

export function prepareCompiledGraphPreview(
  sourcePath: string,
  graph: CompiledGraph,
  bundle: Bundle,
  options: CompiledPreviewRenderOptions
): PreparedCompiledGraphPreview {
  const { view, capability } = resolvePreviewView(bundle, options.viewId);
  const previewCapability = resolvePreviewCapability(capability, options.format, options.backendId);
  const diagnostics: Diagnostic[] = [];

  if (!bundle.manifest.render_details.some((detail) => detail.id === options.detailId)) {
    diagnostics.push({
      stage: "render",
      code: "render.unknown_detail",
      severity: "error",
      message: `Unknown render detail '${options.detailId}'`,
      file: sourcePath
    });
  }

  const prepared = hasErrors(diagnostics)
    ? undefined
    : projectCompiledGraph(graph, bundle, view, options.detailId, diagnostics);

  return {
    profileId: options.profileId,
    detailId: options.detailId,
    view,
    capability,
    previewCapability,
    prepared,
    diagnostics: sortDiagnostics(diagnostics)
  };
}

export async function renderPreparedCompiledGraphPreview(
  sourcePath: string,
  graph: CompiledGraph,
  bundle: Bundle,
  preparedResult: PreparedCompiledGraphPreview
): Promise<SourcePreviewRenderResult> {
  const diagnostics = [...preparedResult.diagnostics];
  const {
    profileId,
    detailId,
    view,
    capability,
    previewCapability,
    prepared
  } = preparedResult;
  const notes = [...(prepared?.notes ?? [])];

  if (!prepared || hasErrors(diagnostics)) {
    return {
      profileId,
      detailId,
      view,
      capability,
      previewCapability,
      notes,
      diagnostics: sortDiagnostics(diagnostics)
    };
  }

  const previewBackend = getPreviewBackend(previewCapability.backendId);
  let artifact: PreviewArtifactResult;
  if (previewBackend.inputRequirement.kind === "text") {
    const renderResult = renderPreparedProjectionText(graph, bundle, view, prepared.projection, {
      viewId: view.id,
      format: previewBackend.inputRequirement.sourceFormat,
      profileId,
      detailId
    });
    diagnostics.push(...renderResult.diagnostics);
    notes.push(...renderResult.notes.filter((note) => !notes.includes(note)));
    if (!renderResult.text || hasErrors(diagnostics)) {
      return {
        profileId,
        detailId,
        view,
        capability,
        previewCapability,
        notes,
        diagnostics: sortDiagnostics(diagnostics)
      };
    }
    artifact = await renderPreviewArtifact({
      backendId: previewCapability.backendId,
      bundle,
      view,
      format: previewCapability.format,
      source: {
        kind: "text",
        format: previewBackend.inputRequirement.sourceFormat,
        text: renderResult.text
      }
    });
  } else {
    artifact = await renderPreviewArtifact({
      backendId: previewCapability.backendId,
      bundle,
      view,
      format: previewCapability.format,
      source: {
        kind: "projection",
        graph,
        projection: prepared.projection,
        detailId
      }
    });
  }

  diagnostics.push(...(artifact.diagnostics ?? []).map((diagnostic) => mapRendererDiagnostic(sourcePath, diagnostic)));
  return {
    profileId,
    detailId,
    view,
    capability,
    previewCapability,
    artifact: hasErrors(diagnostics) ? undefined : artifact,
    notes,
    diagnostics: sortDiagnostics(diagnostics)
  };
}

export async function renderCompiledGraphPreview(
  sourcePath: string,
  graph: CompiledGraph,
  bundle: Bundle,
  options: CompiledPreviewRenderOptions
): Promise<SourcePreviewRenderResult> {
  return renderPreparedCompiledGraphPreview(
    sourcePath,
    graph,
    bundle,
    prepareCompiledGraphPreview(sourcePath, graph, bundle, options)
  );
}

export async function renderSourcePreview(
  input: SourceInput,
  bundle: Bundle,
  options: SourcePreviewRenderOptions
): Promise<SourcePreviewRenderResult> {
  const profileId = options.profileId ?? getBundleValidationProfileFallback(bundle);
  const detailId = options.detailId ?? getBundleRenderDetailFallback(bundle);
  const { view, capability } = resolvePreviewView(bundle, options.viewId);
  const previewCapability = resolvePreviewCapability(capability, options.format, options.backendId);

  if (!bundle.manifest.render_details.some((detail) => detail.id === detailId)) {
    return {
      profileId,
      detailId,
      view,
      capability,
      previewCapability,
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
  const diagnostics: Diagnostic[] = [...compileResult.diagnostics];
  if (!compileResult.graph || hasErrors(diagnostics)) {
    return {
      profileId,
      detailId,
      view,
      capability,
      previewCapability,
      notes: [],
      diagnostics: sortDiagnostics(diagnostics)
    };
  }

  const validation = validateGraph(compileResult.graph, bundle, profileId);
  diagnostics.push(...validation.diagnostics);
  if (validation.errorCount > 0) {
    return {
      profileId,
      detailId,
      view,
      capability,
      previewCapability,
      notes: [],
      diagnostics: sortDiagnostics(diagnostics)
    };
  }

  const rendered = await renderCompiledGraphPreview(input.path, compileResult.graph, bundle, {
    viewId: options.viewId,
    format: options.format,
    profileId,
    detailId,
    backendId: options.backendId
  });
  return {
    ...rendered,
    artifact: hasErrors([...diagnostics, ...rendered.diagnostics]) ? undefined : rendered.artifact,
    diagnostics: sortDiagnostics([...diagnostics, ...rendered.diagnostics])
  };
}
