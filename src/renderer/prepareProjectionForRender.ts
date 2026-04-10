import type { ViewSpec } from "../bundle/types.js";
import type { CompiledGraph } from "../compiler/types.js";
import type { Projection } from "../projector/types.js";
import { resolveProfileDisplayPolicy } from "./profileDisplay.js";
import { buildUiContractsRenderData } from "./uiContractsRenderModel.js";

export interface PreparedProjectionForRender {
  projection: Projection;
  notes: string[];
}

export function prepareProjectionForRender(
  view: ViewSpec,
  projection: Projection,
  graph: CompiledGraph,
  profileId: string
): PreparedProjectionForRender {
  if (view.id !== "ui_contracts") {
    return {
      projection,
      notes: []
    };
  }

  const displayPolicy = resolveProfileDisplayPolicy(view, profileId);
  const prepared = buildUiContractsRenderData(projection, graph, displayPolicy);
  return {
    projection: prepared.projection,
    notes: prepared.notes
  };
}
