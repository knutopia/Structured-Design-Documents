import type { Bundle, ViewSpec } from "../bundle/types.js";
import { compileSource } from "../compiler/compileSource.js";
import type { CompiledGraph } from "../compiler/types.js";
import { hasErrors, sortDiagnostics, type Diagnostic } from "../diagnostics/types.js";
import { projectView } from "../projector/projectView.js";
import type { Projection } from "../projector/types.js";
import type { SourceInput } from "../types.js";
import { validateGraph } from "../validator/validateGraph.js";
import { resolveProfileDisplayPolicy } from "./profileDisplay.js";
import {
  getPreviewBackend,
  renderPreviewArtifact,
  type PreviewArtifactResult
} from "./previewBackends.js";
import { renderCompiledGraphText } from "./renderView.js";
import type { PreviewFormat, PreviewRendererBackendId } from "./renderArtifacts.js";
import type { RendererDiagnostic } from "./staged/diagnostics.js";
import { buildUiContractsRenderData } from "./uiContractsRenderModel.js";
import {
  getPreviewArtifactCapability,
  getViewRenderCapability,
  type PreviewArtifactCapability,
  type ViewRenderCapability
} from "./viewRenderers.js";

export interface SourcePreviewRenderOptions {
  viewId: string;
  format: PreviewFormat;
  profileId: string;
  backendId?: PreviewRendererBackendId;
}

export interface SourcePreviewRenderResult {
  view: ViewSpec;
  capability: ViewRenderCapability;
  previewCapability: PreviewArtifactCapability;
  artifact?: PreviewArtifactResult;
  notes: string[];
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
  profileId: string,
  diagnostics: Diagnostic[]
): { projection?: Projection; notes: string[] } {
  const projected = projectView(graph, bundle, view.id);
  diagnostics.push(...projected.diagnostics);
  if (!projected.projection) {
    return { notes: [] };
  }

  if (view.id === "ui_contracts") {
    const prepared = buildUiContractsRenderData(
      projected.projection,
      graph,
      resolveProfileDisplayPolicy(view, profileId)
    );
    return {
      projection: prepared.projection,
      notes: prepared.notes
    };
  }

  return {
    projection: projected.projection,
    notes: []
  };
}

export async function renderSourcePreview(
  input: SourceInput,
  bundle: Bundle,
  options: SourcePreviewRenderOptions
): Promise<SourcePreviewRenderResult> {
  const { view, capability } = resolvePreviewView(bundle, options.viewId);
  const previewCapability = resolvePreviewCapability(capability, options.format, options.backendId);
  const previewBackend = getPreviewBackend(previewCapability.backendId);

  const compileResult = compileSource(input, bundle);
  const diagnostics: Diagnostic[] = [...compileResult.diagnostics];
  if (!compileResult.graph || hasErrors(diagnostics)) {
    return {
      view,
      capability,
      previewCapability,
      notes: [],
      diagnostics: sortDiagnostics(diagnostics)
    };
  }

  const validation = validateGraph(compileResult.graph, bundle, options.profileId);
  diagnostics.push(...validation.diagnostics);
  if (validation.errorCount > 0) {
    return {
      view,
      capability,
      previewCapability,
      notes: [],
      diagnostics: sortDiagnostics(diagnostics)
    };
  }

  let artifact: PreviewArtifactResult | undefined;
  let notes: string[] = [];
  if (previewBackend.inputRequirement.kind === "text") {
    const renderResult = renderCompiledGraphText(compileResult.graph, bundle, {
      viewId: options.viewId,
      format: previewBackend.inputRequirement.sourceFormat,
      profileId: options.profileId
    });
    diagnostics.push(...renderResult.diagnostics);
    notes = [...renderResult.notes];

    if (!renderResult.text || hasErrors(diagnostics)) {
      return {
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
      format: options.format,
      source: {
        kind: "text",
        format: previewBackend.inputRequirement.sourceFormat,
        text: renderResult.text
      }
    });
  } else {
    const prepared = projectCompiledGraph(compileResult.graph, bundle, view, options.profileId, diagnostics);
    notes = [...prepared.notes];
    if (!prepared.projection || hasErrors(diagnostics)) {
      return {
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
      format: options.format,
      source: {
        kind: "projection",
        graph: compileResult.graph,
        projection: prepared.projection,
        profileId: options.profileId
      }
    });
  }

  diagnostics.push(...(artifact.diagnostics ?? []).map((diagnostic) => mapRendererDiagnostic(input.path, diagnostic)));

  return {
    view,
    capability,
    previewCapability,
    artifact: hasErrors(diagnostics) ? undefined : artifact,
    notes,
    diagnostics: sortDiagnostics(diagnostics)
  };
}
