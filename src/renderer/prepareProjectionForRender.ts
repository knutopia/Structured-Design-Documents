import type { ViewSpec } from "../bundle/types.js";
import type { CompiledGraph } from "../compiler/types.js";
import type { Projection } from "../projector/types.js";
import { resolveDetailDisplayPolicy } from "./detailDisplay.js";
import { buildUiContractsRenderData } from "./uiContractsRenderModel.js";

export interface PreparedProjectionForRender {
  projection: Projection;
  visibleSemanticNodeIds: string[];
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
      visibleSemanticNodeIds: projection.nodes.map((node) => node.id),
      notes: []
    };
  }

  const displayPolicy = resolveDetailDisplayPolicy(view, detailId);
  const prepared = buildUiContractsRenderData(projection, graph, displayPolicy);
  return {
    projection: prepared.projection,
    visibleSemanticNodeIds: prepared.visibleSemanticNodeIds,
    notes: prepared.notes
  };
}

export function isBatchApplicable(
  view: ViewSpec,
  prepared: PreparedProjectionForRender
): boolean {
  const policy = view.conventions.renderer_defaults?.batch_applicability;
  if (!policy || policy.kind !== "visible_semantic_node_count") {
    throw new Error(`View '${view.id}' does not declare renderer_defaults.batch_applicability`);
  }
  return prepared.visibleSemanticNodeIds.length >= policy.minimum;
}
