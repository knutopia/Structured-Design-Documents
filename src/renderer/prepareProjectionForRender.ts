import type { ViewSpec } from "../bundle/types.js";
import type { CompiledGraph } from "../compiler/types.js";
import type { Projection } from "../projector/types.js";
import { resolveDetailDisplayPolicy } from "./detailDisplay.js";
import { buildUiContractsRenderData } from "./uiContractsRenderModel.js";
import { buildUiContractsPresentationModel, type UiContractsPresentationModel } from "./uiContractsPresentationModel.js";

export interface PreparedProjectionForRender {
  projection: Projection;
  visibleSemanticNodeIds: string[];
  notes: string[];
  presentationModel?: UiContractsPresentationModel;
}

export function prepareProjectionForRender(
  view: ViewSpec,
  projection: Projection,
  graph: CompiledGraph,
  detailId: string,
  target: "legacy" | "staged" = "legacy"
): PreparedProjectionForRender {
  if (view.id !== "ui_contracts") {
    return {
      projection,
      visibleSemanticNodeIds: projection.nodes.map((node) => node.id),
      notes: []
    };
  }

  if (target === "staged") {
    const model = buildUiContractsPresentationModel(projection, graph, view, detailId);
    const preparedProjection = model.omittedPlaceIds.length ? { ...projection,
      notes: [...new Set([...projection.notes, ...model.notes])], derived: { ...projection.derived,
        view_metadata: { ...projection.derived.view_metadata, ui_contracts_coverage: {
          omitted_empty_place_containers: model.omittedPlaceIds.map(id => ({ id, name: projection.nodes.find(node => node.id === id)!.name }))
        } } } } : projection;
    return { projection: preparedProjection, visibleSemanticNodeIds: model.visibleSemanticNodeIds, notes: model.notes, presentationModel: model };
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
