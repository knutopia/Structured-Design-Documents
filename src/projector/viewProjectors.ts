import type { Bundle, ViewSpec } from "../bundle/types.js";
import type { CompiledGraph } from "../compiler/types.js";
import type { ProjectionResult } from "./types.js";
import { buildIaPlaceMapProjection } from "./iaPlaceMap.js";
import { buildJourneyMapProjection } from "./journeyMap.js";
import { buildOutcomeOpportunityMapProjection } from "./outcomeOpportunityMap.js";
import { buildScenarioFlowProjection } from "./scenarioFlow.js";
import { buildServiceBlueprintProjection } from "./serviceBlueprint.js";
import { buildUiContractsProjection } from "./uiContracts.js";

export type ViewProjector = (graph: CompiledGraph, bundle: Bundle, view: ViewSpec) => ProjectionResult;

const viewProjectors: Partial<Record<string, ViewProjector>> = {
  outcome_opportunity_map: buildOutcomeOpportunityMapProjection,
  journey_map: buildJourneyMapProjection,
  service_blueprint: buildServiceBlueprintProjection,
  ia_place_map: buildIaPlaceMapProjection,
  scenario_flow: buildScenarioFlowProjection,
  ui_contracts: buildUiContractsProjection
};

export function getViewProjector(viewId: string): ViewProjector | undefined {
  return viewProjectors[viewId];
}
