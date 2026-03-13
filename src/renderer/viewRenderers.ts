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
import { resolveDotPreviewStyle } from "./previewStyle.js";
import { buildScenarioFlowRenderModel } from "./scenarioFlowRenderModel.js";
import { buildServiceBlueprintRenderModel } from "./serviceBlueprintRenderModel.js";
import { buildUiContractsRenderModel } from "./uiContractsRenderModel.js";

export type TextRenderFormat = "dot" | "mermaid";
export type PreviewFormat = "svg" | "png";

export interface ViewRenderCapability {
  textFormats: TextRenderFormat[];
  previewFormats: PreviewFormat[];
  previewSourceByFormat: Record<PreviewFormat, TextRenderFormat>;
  defaultPreviewFormat: PreviewFormat;
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
  ) => string;
}

function dotAndMermaidPreviewCapability(): ViewRenderCapability {
  return {
    textFormats: ["dot", "mermaid"],
    previewFormats: ["svg", "png"],
    previewSourceByFormat: {
      svg: "dot",
      png: "dot"
    },
    defaultPreviewFormat: "svg"
  };
}

const iaPlaceMapRenderer: ViewTextRenderer = {
  capability: {
    textFormats: ["dot", "mermaid"],
    previewFormats: ["svg", "png"],
    previewSourceByFormat: {
      svg: "dot",
      png: "dot"
    },
    defaultPreviewFormat: "svg"
  },
  render: (projection, graph, bundle, view, format, profileId) => {
    const displayPolicy = resolveProfileDisplayPolicy(view, profileId);
    const model = buildIaPlaceMapRenderModel(projection, graph, view.projection.hierarchy_edges ?? [], displayPolicy);
    if (format === "dot") {
      return renderIaPlaceMapDot(model, resolveDotPreviewStyle(bundle, view));
    }

    return renderIaPlaceMapMermaid(model);
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
      return renderJourneyMapDot(model, resolveDotPreviewStyle(bundle, view));
    }

    return renderJourneyMapMermaid(model);
  }
};

const outcomeOpportunityMapRenderer: ViewTextRenderer = {
  capability: dotAndMermaidPreviewCapability(),
  render: (projection, graph, bundle, view, format, profileId) => {
    const displayPolicy = resolveProfileDisplayPolicy(view, profileId);
    const model = buildOutcomeOpportunityMapRenderModel(projection, graph, displayPolicy);
    if (format === "dot") {
      return renderOutcomeOpportunityMapDot(model, resolveDotPreviewStyle(bundle, view));
    }

    return renderOutcomeOpportunityMapMermaid(model);
  }
};

const serviceBlueprintRenderer: ViewTextRenderer = {
  capability: dotAndMermaidPreviewCapability(),
  render: (projection, graph, bundle, view, format, profileId) => {
    const displayPolicy = resolveProfileDisplayPolicy(view, profileId);
    const model = buildServiceBlueprintRenderModel(projection, graph, displayPolicy);
    if (format === "dot") {
      return renderServiceBlueprintDot(model, resolveDotPreviewStyle(bundle, view));
    }

    return renderServiceBlueprintMermaid(model);
  }
};

const scenarioFlowRenderer: ViewTextRenderer = {
  capability: dotAndMermaidPreviewCapability(),
  render: (projection, graph, bundle, view, format, profileId) => {
    const displayPolicy = resolveProfileDisplayPolicy(view, profileId);
    const model = buildScenarioFlowRenderModel(projection, graph, displayPolicy);
    if (format === "dot") {
      return renderScenarioFlowDot(model, resolveDotPreviewStyle(bundle, view));
    }

    return renderScenarioFlowMermaid(model);
  }
};

const uiContractsRenderer: ViewTextRenderer = {
  capability: dotAndMermaidPreviewCapability(),
  render: (projection, graph, bundle, view, format, profileId) => {
    const displayPolicy = resolveProfileDisplayPolicy(view, profileId);
    const model = buildUiContractsRenderModel(projection, graph, displayPolicy);
    if (format === "dot") {
      return renderUiContractsDot(model, resolveDotPreviewStyle(bundle, view));
    }

    return renderUiContractsMermaid(model);
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

export function getKnownRenderableViewIds(bundle: Bundle): string[] {
  return bundle.views.views
    .filter((view) => viewRenderers[view.id])
    .map((view) => view.id);
}
