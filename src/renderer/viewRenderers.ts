import type { Bundle, ViewSpec } from "../bundle/types.js";
import type { CompiledGraph } from "../compiler/types.js";
import type { Projection } from "../projector/types.js";
import {
  renderIaPlaceMapDot,
  renderJourneyMapDot,
  renderOutcomeOpportunityMapDot,
  renderScenarioFlowDot,
  renderServiceBlueprintDot
} from "./dot.js";
import { buildIaPlaceMapRenderModel } from "./iaPlaceMapRenderModel.js";
import { buildJourneyMapRenderModel } from "./journeyMapRenderModel.js";
import { renderIaPlaceMapMermaid } from "./mermaid.js";
import { buildOutcomeOpportunityMapRenderModel } from "./outcomeOpportunityMapRenderModel.js";
import { resolveDotPreviewStyle } from "./previewStyle.js";
import { buildScenarioFlowRenderModel } from "./scenarioFlowRenderModel.js";
import { buildServiceBlueprintRenderModel } from "./serviceBlueprintRenderModel.js";

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
  render: (projection: Projection, graph: CompiledGraph, bundle: Bundle, view: ViewSpec, format: TextRenderFormat) => string;
}

function dotPreviewCapability(): ViewRenderCapability {
  return {
    textFormats: ["dot"],
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
  render: (projection, graph, bundle, view, format) => {
    const model = buildIaPlaceMapRenderModel(projection, graph, view.projection.hierarchy_edges ?? []);
    if (format === "dot") {
      return renderIaPlaceMapDot(model, resolveDotPreviewStyle(bundle, view));
    }

    return renderIaPlaceMapMermaid(model);
  }
};

const journeyMapRenderer: ViewTextRenderer = {
  capability: dotPreviewCapability(),
  render: (projection, graph, bundle, view) => {
    const model = buildJourneyMapRenderModel(
      projection,
      graph,
      view.projection.hierarchy_edges ?? [],
      view.projection.ordering_edges ?? []
    );
    return renderJourneyMapDot(model, resolveDotPreviewStyle(bundle, view));
  }
};

const outcomeOpportunityMapRenderer: ViewTextRenderer = {
  capability: dotPreviewCapability(),
  render: (projection, graph, bundle, view) => {
    const model = buildOutcomeOpportunityMapRenderModel(projection, graph);
    return renderOutcomeOpportunityMapDot(model, resolveDotPreviewStyle(bundle, view));
  }
};

const serviceBlueprintRenderer: ViewTextRenderer = {
  capability: dotPreviewCapability(),
  render: (projection, graph, bundle, view) => {
    const model = buildServiceBlueprintRenderModel(projection, graph);
    return renderServiceBlueprintDot(model, resolveDotPreviewStyle(bundle, view));
  }
};

const scenarioFlowRenderer: ViewTextRenderer = {
  capability: dotPreviewCapability(),
  render: (projection, graph, bundle, view) => {
    const model = buildScenarioFlowRenderModel(projection, graph);
    return renderScenarioFlowDot(model, resolveDotPreviewStyle(bundle, view));
  }
};

const viewRenderers: Partial<Record<string, ViewTextRenderer>> = {
  outcome_opportunity_map: outcomeOpportunityMapRenderer,
  journey_map: journeyMapRenderer,
  service_blueprint: serviceBlueprintRenderer,
  ia_place_map: iaPlaceMapRenderer,
  scenario_flow: scenarioFlowRenderer
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
