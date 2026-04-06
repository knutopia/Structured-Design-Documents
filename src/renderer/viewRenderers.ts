import type { Bundle, ViewSpec } from "../bundle/types.js";
import type { CompiledGraph } from "../compiler/types.js";
import type { Projection } from "../projector/types.js";
import {
  renderIaPlaceMapDot,
  renderJourneyMapDot,
  renderOutcomeOpportunityMapDot,
  renderScenarioFlowDot,
  renderServiceBlueprintDot,
  renderUiContractsDot
} from "./dot.js";
import { buildIaPlaceMapRenderModel } from "./iaPlaceMapRenderModel.js";
import { buildJourneyMapRenderModel } from "./journeyMapRenderModel.js";
import {
  renderIaPlaceMapMermaid,
  renderJourneyMapMermaid,
  renderOutcomeOpportunityMapMermaid,
  renderScenarioFlowMermaid,
  renderServiceBlueprintMermaid,
  renderUiContractsMermaid
} from "./mermaid.js";
import { buildOutcomeOpportunityMapRenderModel } from "./outcomeOpportunityMapRenderModel.js";
import { resolveProfileDisplayPolicy } from "./profileDisplay.js";
import { resolveLegacyDotPreviewStyle } from "./previewStyle.js";
import type {
  PreviewArtifactCapability,
  PreviewFormat,
  PreviewRendererBackendId,
  TextArtifactCapability,
  TextRenderFormat
} from "./renderArtifacts.js";
export type {
  PreviewArtifactCapability,
  PreviewFormat,
  PreviewRendererBackendId,
  RendererBackendClass,
  TextArtifactCapability,
  TextRenderFormat,
  TextRendererBackendId
} from "./renderArtifacts.js";
import { buildScenarioFlowRenderModel } from "./scenarioFlowRenderModel.js";
import { buildServiceBlueprintRenderModel } from "./serviceBlueprintRenderModel.js";
import { buildUiContractsRenderData } from "./uiContractsRenderModel.js";

export interface ViewRenderCapability {
  textArtifacts: TextArtifactCapability[];
  previewArtifacts: PreviewArtifactCapability[];
  defaultPreviewFormat: PreviewFormat;
  defaultPreviewBackends?: Partial<Record<PreviewFormat, PreviewRendererBackendId>>;
}

interface ViewTextRenderOutput {
  text: string;
  notes: string[];
}

interface ViewTextRenderer {
  capability: ViewRenderCapability;
  render: (
    projection: Projection,
    graph: CompiledGraph,
    bundle: Bundle,
    view: ViewSpec,
    format: TextRenderFormat,
    profileId: string
  ) => ViewTextRenderOutput;
}

const legacyTextArtifacts: TextArtifactCapability[] = [
  {
    format: "dot",
    backendId: "legacy_dot",
    backendClass: "legacy"
  },
  {
    format: "mermaid",
    backendId: "legacy_mermaid",
    backendClass: "legacy"
  }
];

const legacyPreviewArtifacts: PreviewArtifactCapability[] = [
  {
    format: "svg",
    backendId: "legacy_graphviz_preview",
    backendClass: "legacy"
  },
  {
    format: "png",
    backendId: "legacy_graphviz_preview",
    backendClass: "legacy"
  }
];

const legacyPreviewDefaults: Partial<Record<PreviewFormat, PreviewRendererBackendId>> = {
  svg: "legacy_graphviz_preview",
  png: "legacy_graphviz_preview"
};

const stagedIaPlaceMapPreviewArtifacts: PreviewArtifactCapability[] = [
  {
    format: "svg",
    backendId: "staged_ia_place_map_preview",
    backendClass: "staged"
  },
  {
    format: "png",
    backendId: "staged_ia_place_map_preview",
    backendClass: "staged"
  }
];

const stagedUiContractsPreviewArtifacts: PreviewArtifactCapability[] = [
  {
    format: "svg",
    backendId: "staged_ui_contracts_preview",
    backendClass: "staged"
  },
  {
    format: "png",
    backendId: "staged_ui_contracts_preview",
    backendClass: "staged"
  }
];

const stagedServiceBlueprintPreviewArtifacts: PreviewArtifactCapability[] = [
  {
    format: "svg",
    backendId: "staged_service_blueprint_preview",
    backendClass: "staged"
  },
  {
    format: "png",
    backendId: "staged_service_blueprint_preview",
    backendClass: "staged"
  }
];

function dotAndMermaidPreviewCapability(): ViewRenderCapability {
  return {
    textArtifacts: legacyTextArtifacts.map((artifact) => ({ ...artifact })),
    previewArtifacts: legacyPreviewArtifacts.map((artifact) => ({ ...artifact })),
    defaultPreviewFormat: "svg",
    defaultPreviewBackends: legacyPreviewDefaults
  };
}

const iaPlaceMapRenderer: ViewTextRenderer = {
  capability: {
    textArtifacts: legacyTextArtifacts.map((artifact) => ({ ...artifact })),
    previewArtifacts: [
      ...stagedIaPlaceMapPreviewArtifacts.map((artifact) => ({ ...artifact })),
      ...legacyPreviewArtifacts.map((artifact) => ({ ...artifact }))
    ],
    defaultPreviewFormat: "svg",
    defaultPreviewBackends: {
      svg: "staged_ia_place_map_preview",
      png: "staged_ia_place_map_preview"
    }
  },
  render: (projection, graph, bundle, view, format, profileId) => {
    const displayPolicy = resolveProfileDisplayPolicy(view, profileId);
    const model = buildIaPlaceMapRenderModel(projection, graph, view.projection.hierarchy_edges ?? [], displayPolicy);
    if (format === "dot") {
      return {
        text: renderIaPlaceMapDot(model, resolveLegacyDotPreviewStyle(bundle, view)),
        notes: []
      };
    }

    return {
      text: renderIaPlaceMapMermaid(model),
      notes: []
    };
  }
};

const journeyMapRenderer: ViewTextRenderer = {
  capability: dotAndMermaidPreviewCapability(),
  render: (projection, graph, bundle, view, format, profileId) => {
    const displayPolicy = resolveProfileDisplayPolicy(view, profileId);
    const model = buildJourneyMapRenderModel(
      projection,
      graph,
      view.projection.hierarchy_edges ?? [],
      view.projection.ordering_edges ?? [],
      displayPolicy
    );
    if (format === "dot") {
      return {
        text: renderJourneyMapDot(model, resolveLegacyDotPreviewStyle(bundle, view)),
        notes: []
      };
    }

    return {
      text: renderJourneyMapMermaid(model),
      notes: []
    };
  }
};

const outcomeOpportunityMapRenderer: ViewTextRenderer = {
  capability: dotAndMermaidPreviewCapability(),
  render: (projection, graph, bundle, view, format, profileId) => {
    const displayPolicy = resolveProfileDisplayPolicy(view, profileId);
    const model = buildOutcomeOpportunityMapRenderModel(projection, graph, displayPolicy);
    if (format === "dot") {
      return {
        text: renderOutcomeOpportunityMapDot(model, resolveLegacyDotPreviewStyle(bundle, view)),
        notes: []
      };
    }

    return {
      text: renderOutcomeOpportunityMapMermaid(model),
      notes: []
    };
  }
};

const serviceBlueprintRenderer: ViewTextRenderer = {
  capability: {
    textArtifacts: legacyTextArtifacts.map((artifact) => ({ ...artifact })),
    previewArtifacts: [
      ...stagedServiceBlueprintPreviewArtifacts.map((artifact) => ({ ...artifact })),
      ...legacyPreviewArtifacts.map((artifact) => ({ ...artifact }))
    ],
    defaultPreviewFormat: "svg",
    defaultPreviewBackends: {
      svg: "staged_service_blueprint_preview",
      png: "staged_service_blueprint_preview"
    }
  },
  render: (projection, graph, bundle, view, format, profileId) => {
    const displayPolicy = resolveProfileDisplayPolicy(view, profileId);
    const model = buildServiceBlueprintRenderModel(projection, graph, displayPolicy);
    if (format === "dot") {
      return {
        text: renderServiceBlueprintDot(model, resolveLegacyDotPreviewStyle(bundle, view)),
        notes: []
      };
    }

    return {
      text: renderServiceBlueprintMermaid(model),
      notes: []
    };
  }
};

const scenarioFlowRenderer: ViewTextRenderer = {
  capability: dotAndMermaidPreviewCapability(),
  render: (projection, graph, bundle, view, format, profileId) => {
    const displayPolicy = resolveProfileDisplayPolicy(view, profileId);
    const model = buildScenarioFlowRenderModel(projection, graph, displayPolicy);
    if (format === "dot") {
      return {
        text: renderScenarioFlowDot(model, resolveLegacyDotPreviewStyle(bundle, view)),
        notes: []
      };
    }

    return {
      text: renderScenarioFlowMermaid(model),
      notes: []
    };
  }
};

const uiContractsRenderer: ViewTextRenderer = {
  capability: {
    textArtifacts: legacyTextArtifacts.map((artifact) => ({ ...artifact })),
    previewArtifacts: [
      ...stagedUiContractsPreviewArtifacts.map((artifact) => ({ ...artifact })),
      ...legacyPreviewArtifacts.map((artifact) => ({ ...artifact }))
    ],
    defaultPreviewFormat: "svg",
    defaultPreviewBackends: {
      svg: "staged_ui_contracts_preview",
      png: "staged_ui_contracts_preview"
    }
  },
  render: (projection, graph, bundle, view, format, profileId) => {
    const displayPolicy = resolveProfileDisplayPolicy(view, profileId);
    const prepared = buildUiContractsRenderData(projection, graph, displayPolicy);
    if (format === "dot") {
      return {
        text: renderUiContractsDot(prepared.model, resolveLegacyDotPreviewStyle(bundle, view)),
        notes: prepared.notes
      };
    }

    return {
      text: renderUiContractsMermaid(prepared.model),
      notes: prepared.notes
    };
  }
};

const viewRenderers: Partial<Record<string, ViewTextRenderer>> = {
  outcome_opportunity_map: outcomeOpportunityMapRenderer,
  journey_map: journeyMapRenderer,
  service_blueprint: serviceBlueprintRenderer,
  ia_place_map: iaPlaceMapRenderer,
  scenario_flow: scenarioFlowRenderer,
  ui_contracts: uiContractsRenderer
};

export function getViewTextRenderer(viewId: string): ViewTextRenderer | undefined {
  return viewRenderers[viewId];
}

export function getViewRenderCapability(viewId: string): ViewRenderCapability | undefined {
  return viewRenderers[viewId]?.capability;
}

export function getSupportedTextFormats(capability: ViewRenderCapability): TextRenderFormat[] {
  return capability.textArtifacts.map((artifact) => artifact.format);
}

export function getSupportedPreviewFormats(capability: ViewRenderCapability): PreviewFormat[] {
  return [...new Set(capability.previewArtifacts.map((artifact) => artifact.format))];
}

export function getPreviewArtifactCapabilities(
  capability: ViewRenderCapability,
  format?: PreviewFormat
): PreviewArtifactCapability[] {
  return capability.previewArtifacts.filter((artifact) => (format ? artifact.format === format : true));
}

export function getTextArtifactCapability(
  capability: ViewRenderCapability,
  format: TextRenderFormat
): TextArtifactCapability | undefined {
  return capability.textArtifacts.find((artifact) => artifact.format === format);
}

export function getPreviewArtifactCapability(
  capability: ViewRenderCapability,
  format: PreviewFormat,
  backendId?: PreviewRendererBackendId
): PreviewArtifactCapability | undefined {
  if (backendId) {
    return capability.previewArtifacts.find((artifact) => artifact.format === format && artifact.backendId === backendId);
  }

  const defaultBackendId = capability.defaultPreviewBackends?.[format];
  if (defaultBackendId) {
    return capability.previewArtifacts.find((artifact) => artifact.format === format && artifact.backendId === defaultBackendId);
  }

  return capability.previewArtifacts.find((artifact) => artifact.format === format);
}

export function getSupportedPreviewBackendIds(
  capability: ViewRenderCapability,
  format: PreviewFormat
): PreviewRendererBackendId[] {
  return getPreviewArtifactCapabilities(capability, format).map((artifact) => artifact.backendId);
}

export function getKnownRenderableViewIds(bundle: Bundle): string[] {
  return bundle.views.views
    .filter((view) => viewRenderers[view.id])
    .map((view) => view.id);
}
