import type { ViewSpec } from "../bundle/types.js";
import type { CompiledGraph } from "../compiler/types.js";
import type { Projection } from "../projector/types.js";
import { resolveDetailDisplayPolicy } from "./detailDisplay.js";
import { buildUiContractsRenderData } from "./uiContractsRenderModel.js";

export interface PreparedProjectionForRender {
  projection: Projection;
  notes: string[];
}

export function prepareProjectionForRender(
  view: ViewSpec,
  projection: Projection,
  graph: CompiledGraph,
  detailId: string
): PreparedProjectionForRender {
  if (view.id !== "ui_contracts") {
    return {
      projection,
      notes: []
    };
  }

  const displayPolicy = resolveDetailDisplayPolicy(view, detailId);
  const prepared = buildUiContractsRenderData(projection, graph, displayPolicy);
  return {
    projection: prepared.projection,
    notes: prepared.notes
  };
}
