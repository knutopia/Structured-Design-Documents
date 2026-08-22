import type { Bundle, ViewSpec } from "../bundle/types.js";
import type { CompiledGraph } from "../compiler/types.js";
import type { Projection } from "../projector/types.js";
import {
  assertLegacyGraphvizPreviewAvailable,
  LEGACY_GRAPHVIZ_PREVIEW_BACKEND_ID,
  LEGACY_GRAPHVIZ_PREVIEW_SOURCE_FORMAT,
  legacyGraphvizInstallHint,
  renderLegacyGraphvizPreview
} from "./legacyGraphvizPreviewBackend.js";
import type {
  PreviewFormat,
  PreviewRendererBackendId,
  RendererBackendClass,
  TextRenderFormat
} from "./renderArtifacts.js";
import { resolveStagedPreviewStyle } from "./previewStyle.js";
import type { RendererDiagnostic } from "./staged/diagnostics.js";
import {
  renderIaPlaceMapStagedPng,
  renderIaPlaceMapStagedSvg
} from "./staged/iaPlaceMap.js";
import {
  renderJourneyMapStagedPng,
  renderJourneyMapStagedSvg
} from "./staged/journeyMap.js";
import {
  renderOutcomeOpportunityMapStagedPng,
  renderOutcomeOpportunityMapStagedSvg
} from "./staged/outcomeOpportunityMap.js";
import {
  renderScenarioFlowStagedPng,
  renderScenarioFlowStagedSvg
} from "./staged/scenarioFlow.js";
import {
  renderUiContractsStagedPng,
  renderUiContractsStagedSvg
} from "./staged/uiContracts.js";
import {
  renderServiceBlueprintStagedPng,
  renderServiceBlueprintStagedSvg
} from "./staged/serviceBlueprint.js";
import { registerStagedRendererTheme } from "./staged/theme.js";
import type { StagedRenderSettings } from "./staged/contracts.js";

export const STAGED_IA_PLACE_MAP_PREVIEW_BACKEND_ID = "staged_ia_place_map_preview";
export const STAGED_JOURNEY_MAP_PREVIEW_BACKEND_ID = "staged_journey_map_preview";
export const STAGED_UI_CONTRACTS_PREVIEW_BACKEND_ID = "staged_ui_contracts_preview";
export const STAGED_SERVICE_BLUEPRINT_PREVIEW_BACKEND_ID = "staged_service_blueprint_preview";
export const STAGED_SCENARIO_FLOW_PREVIEW_BACKEND_ID = "staged_scenario_flow_preview";
export const STAGED_OUTCOME_OPPORTUNITY_MAP_PREVIEW_BACKEND_ID = "staged_outcome_opportunity_map_preview";

export type PreviewArtifactSource =
  | {
    kind: "text";
    format: TextRenderFormat;
    text: string;
  }
  | {
    kind: "projection";
    graph: CompiledGraph;
    projection: Projection;
    detailId: string;
    themeId?: string;
  };

export interface RenderPreviewArtifactRequest {
  backendId: PreviewRendererBackendId;
  bundle: Bundle;
  view: ViewSpec;
  format: PreviewFormat;
  source: PreviewArtifactSource;
}

export interface PreviewArtifactBase {
  sourceArtifacts?: Partial<Record<TextRenderFormat, string>>;
  diagnostics?: RendererDiagnostic[];
}

export type PreviewArtifactResult =
  | ({
    format: "svg";
    text: string;
  } & PreviewArtifactBase)
  | ({
    format: "png";
    bytes: Uint8Array;
  } & PreviewArtifactBase);

export type PreviewBackendInputRequirement =
  | {
    kind: "text";
    sourceFormat: TextRenderFormat;
  }
  | {
    kind: "projection";
  };

export interface PreviewBackendDescriptor {
  id: PreviewRendererBackendId;
  backendClass: RendererBackendClass;
  inputRequirement: PreviewBackendInputRequirement;
  installHint: () => string;
  assertAvailable?: () => void;
  render: (request: RenderPreviewArtifactRequest) => Promise<PreviewArtifactResult>;
}

interface StagedProjectionPreviewBackendOptions {
  id: PreviewRendererBackendId;
  viewId: string;
  renderSvg: (
    projection: Projection,
    graph: CompiledGraph,
    view: ViewSpec,
    settings: StagedRenderSettings,
    bundle: Bundle
  ) => Promise<{
    svg: string;
    diagnostics: RendererDiagnostic[];
  }>;
  renderPng: (
    projection: Projection,
    graph: CompiledGraph,
    view: ViewSpec,
    settings: StagedRenderSettings,
    bundle: Bundle
  ) => Promise<{
    png: Uint8Array;
    diagnostics: RendererDiagnostic[];
  }>;
}

function createStagedProjectionPreviewBackend(
  options: StagedProjectionPreviewBackendOptions
): PreviewBackendDescriptor {
  return {
    id: options.id,
    backendClass: "staged",
    inputRequirement: {
      kind: "projection"
    },
    installHint: () => "",
    render: async (request) => {
      if (request.source.kind !== "projection") {
        throw new Error(`Preview backend '${options.id}' requires projection source input.`);
      }
      if (request.view.id !== options.viewId) {
        throw new Error(`Preview backend '${options.id}' only supports the ${options.viewId} view.`);
      }

      const themeId = registerStagedRendererTheme(
        request.source.themeId ?? "default",
        resolveStagedPreviewStyle(request.bundle, request.view)
      );
      const settings: StagedRenderSettings = {
        detailId: request.source.detailId,
        themeId
      };
      if (request.format === "svg") {
        const rendered = await options.renderSvg(
          request.source.projection,
          request.source.graph,
          request.view,
          settings,
          request.bundle
        );
        return {
          format: "svg",
          text: rendered.svg,
          diagnostics: rendered.diagnostics
        };
      }

      const rendered = await options.renderPng(
        request.source.projection,
        request.source.graph,
        request.view,
        settings,
        request.bundle
      );
      return {
        format: "png",
        bytes: rendered.png,
        diagnostics: rendered.diagnostics
      };
    }
  };
}

const previewBackends: Record<PreviewRendererBackendId, PreviewBackendDescriptor> = {
  [LEGACY_GRAPHVIZ_PREVIEW_BACKEND_ID]: {
    id: LEGACY_GRAPHVIZ_PREVIEW_BACKEND_ID,
    backendClass: "legacy",
    inputRequirement: {
      kind: "text",
      sourceFormat: LEGACY_GRAPHVIZ_PREVIEW_SOURCE_FORMAT
    },
    installHint: legacyGraphvizInstallHint,
    assertAvailable: assertLegacyGraphvizPreviewAvailable,
    render: async (request) => {
      if (request.source.kind !== "text") {
        throw new Error(`Preview backend '${LEGACY_GRAPHVIZ_PREVIEW_BACKEND_ID}' requires text source input.`);
      }

      const payload = await renderLegacyGraphvizPreview({
        bundle: request.bundle,
        view: request.view,
        format: request.format,
        sourceText: request.source.text
      });

      if (request.format === "svg") {
        return {
          format: "svg",
          text: payload as string
        };
      }

      return {
        format: "png",
        bytes: payload as Uint8Array
      };
    }
  },
  [STAGED_IA_PLACE_MAP_PREVIEW_BACKEND_ID]: createStagedProjectionPreviewBackend({
    id: STAGED_IA_PLACE_MAP_PREVIEW_BACKEND_ID,
    viewId: "ia_place_map",
    renderSvg: renderIaPlaceMapStagedSvg,
    renderPng: renderIaPlaceMapStagedPng
  }),
  [STAGED_JOURNEY_MAP_PREVIEW_BACKEND_ID]: createStagedProjectionPreviewBackend({
    id: STAGED_JOURNEY_MAP_PREVIEW_BACKEND_ID,
    viewId: "journey_map",
    renderSvg: (projection, graph, view, settings, bundle) =>
      renderJourneyMapStagedSvg(projection, graph, bundle, view, settings),
    renderPng: (projection, graph, view, settings, bundle) =>
      renderJourneyMapStagedPng(projection, graph, bundle, view, settings)
  }),
  [STAGED_UI_CONTRACTS_PREVIEW_BACKEND_ID]: createStagedProjectionPreviewBackend({
    id: STAGED_UI_CONTRACTS_PREVIEW_BACKEND_ID,
    viewId: "ui_contracts",
    renderSvg: renderUiContractsStagedSvg,
    renderPng: renderUiContractsStagedPng
  }),
  [STAGED_SERVICE_BLUEPRINT_PREVIEW_BACKEND_ID]: createStagedProjectionPreviewBackend({
    id: STAGED_SERVICE_BLUEPRINT_PREVIEW_BACKEND_ID,
    viewId: "service_blueprint",
    renderSvg: renderServiceBlueprintStagedSvg,
    renderPng: renderServiceBlueprintStagedPng
  }),
  [STAGED_SCENARIO_FLOW_PREVIEW_BACKEND_ID]: createStagedProjectionPreviewBackend({
    id: STAGED_SCENARIO_FLOW_PREVIEW_BACKEND_ID,
    viewId: "scenario_flow",
    renderSvg: renderScenarioFlowStagedSvg,
    renderPng: renderScenarioFlowStagedPng
  }),
  [STAGED_OUTCOME_OPPORTUNITY_MAP_PREVIEW_BACKEND_ID]: createStagedProjectionPreviewBackend({
    id: STAGED_OUTCOME_OPPORTUNITY_MAP_PREVIEW_BACKEND_ID,
    viewId: "outcome_opportunity_map",
    renderSvg: renderOutcomeOpportunityMapStagedSvg,
    renderPng: renderOutcomeOpportunityMapStagedPng
  })
};

export function getPreviewBackend(backendId: PreviewRendererBackendId): PreviewBackendDescriptor {
  return previewBackends[backendId];
}

export function assertPreviewBackendAvailable(backendId: PreviewRendererBackendId): void {
  previewBackends[backendId].assertAvailable?.();
}

export async function renderPreviewArtifact(request: RenderPreviewArtifactRequest): Promise<PreviewArtifactResult> {
  const backend = getPreviewBackend(request.backendId);
  const rendered = await backend.render(request);
  const sourceArtifacts = request.source.kind === "text"
    ? {
      ...rendered.sourceArtifacts,
      [request.source.format]: request.source.text
    }
    : rendered.sourceArtifacts;

  if (rendered.format === "svg") {
    return {
      ...rendered,
      sourceArtifacts
    };
  }

  return {
    ...rendered,
    sourceArtifacts
  };
}
