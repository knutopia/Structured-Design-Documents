import type { Bundle, ViewSpec } from "../bundle/types.js";
import {
  getBundleRenderDetailFallback,
  getBundleValidationProfileFallback
} from "../bundle/toolDefaults.js";
import { compileSource } from "../compiler/compileSource.js";
import { getGraphSourcePath, type CompiledGraph } from "../compiler/types.js";
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
  PreviewArtifactRenderingError,
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
  diagramId?: string;
  format: PreviewFormat;
  profileId?: string;
  detailId?: string;
  nodeDecoratorModeId?: string;
  backendId?: PreviewRendererBackendId;
  force?: boolean;
}

export interface SourcePreviewRenderResult {
  diagramId?: string;
  diagramName?: string;
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
  diagramId?: string;
  format: PreviewFormat;
  profileId: string;
  detailId: string;
  nodeDecoratorModeId?: string;
  backendId?: PreviewRendererBackendId;
  force?: boolean;
}

export interface PreparedCompiledGraphPreview {
  diagramId?: string;
  diagramName?: string;
  profileId: string;
  detailId: string;
  view: ViewSpec;
  capability: ViewRenderCapability;
  previewCapability: PreviewArtifactCapability;
  nodeDecoratorModeId?: string;
  prepared?: PreparedProjectionForRender;
  diagnostics: Diagnostic[];
  force?: boolean;
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
  diagnostics: Diagnostic[],
  target: "legacy" | "staged",
  diagramId?: string
): PreparedProjectionForRender | undefined {
  const projected = projectView(graph, bundle, view.id, { diagramId });
  diagnostics.push(...projected.diagnostics);
  if (!projected.projection) {
    return undefined;
  }

  try {
    const prepared = prepareProjectionForRender(view, projected.projection, graph, detailId, target);
    if (diagramId && prepared.visibleSemanticNodeIds.length === 0) {
      diagnostics.push({ stage: "render", code: "renderer.diagram_no_visible_content", severity: "error",
        message: `Diagram '${diagramId}' has no visible content at render detail '${detailId}'.`,
        file: getGraphSourcePath(graph) ?? "<compiled>", relatedIds: [diagramId] });
      return undefined;
    }
    return prepared;
  } catch (error) {
    diagnostics.push({ stage: "render", code: "renderer.invalid_source_edge_reference", severity: "error",
      message: error instanceof Error ? error.message : String(error), file: getGraphSourcePath(graph) ?? "<compiled>" });
    return undefined;
  }
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
    : projectCompiledGraph(graph, bundle, view, options.detailId, diagnostics,
      getPreviewBackend(previewCapability.backendId).backendClass === "staged" ? "staged" : "legacy", options.diagramId);

  return {
    profileId: options.profileId,
    detailId: options.detailId,
    view,
    capability,
    previewCapability,
    nodeDecoratorModeId: options.nodeDecoratorModeId,
    prepared,
    ...(prepared?.projection.diagram_id ? { diagramId: prepared.projection.diagram_id, diagramName: prepared.projection.diagram_name } : {}),
    diagnostics: sortDiagnostics(diagnostics),
    force: options.force
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
    prepared,
    nodeDecoratorModeId,
    force,
    diagramId,
    diagramName
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
  try {
  if (previewBackend.inputRequirement.kind === "text") {
    const renderResult = renderPreparedProjectionText(graph, bundle, view, prepared.projection, {
      viewId: view.id,
      diagramId,
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
        detailId,
        nodeDecoratorModeId
      }
    });
  }

  } catch (error) {
    if (!(error instanceof PreviewArtifactRenderingError)) throw error;
    diagnostics.push(...error.diagnostics.map(diagnostic => mapRendererDiagnostic(sourcePath, diagnostic)));
    return { profileId, detailId, view, capability, previewCapability, notes, diagnostics: sortDiagnostics(diagnostics),
      ...(diagramId ? { diagramId, diagramName } : {}) };
  }

  diagnostics.push(...(artifact.diagnostics ?? []).map((diagnostic) => mapRendererDiagnostic(sourcePath, diagnostic)));
  return {
    profileId,
    detailId,
    view,
    capability,
    previewCapability,
    artifact: hasErrors(diagnostics) && (!force || diagramId) ? undefined : artifact,
    ...(diagramId ? { diagramId, diagramName } : {}),
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
    diagramId: options.diagramId,
    format: options.format,
    profileId,
    detailId,
    nodeDecoratorModeId: options.nodeDecoratorModeId,
    backendId: options.backendId,
    force: options.force
  });
  return {
    ...rendered,
    artifact: hasErrors([...diagnostics, ...rendered.diagnostics]) && (!options.force || options.diagramId) ? undefined : rendered.artifact,
    diagnostics: sortDiagnostics([...diagnostics, ...rendered.diagnostics])
  };
}
