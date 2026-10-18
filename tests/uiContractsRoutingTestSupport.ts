import type { Bundle, UiContractsRoutingPolicy } from "../src/bundle/types.js";
import { resolveUiContractsPresentation } from "../src/bundle/uiContractsPresentation.js";
import type { UiContractsPresentationModel } from "../src/renderer/uiContractsPresentationModel.js";
import { COMPACT_LOOP_PROOF } from "./uiContractsCompactLoopFixture.js";

export const testUiRoutingPolicy: UiContractsRoutingPolicy = {
  scope: "within_transition_region", export_clearance: "readable_gap", capacity: { owner: "padding_and_adjacency_gaps", node: "fixed" },
  self_loop: { shape: "compact_same_side", traversal: { axis: "x", direction: "negative" },
    side_trials: [{ side: "south", pair_placement: "before_other_arrivals" }, { side: "north", pair_placement: "nearest_feasible" }],
    label: "external", selection: ["crossings", "bends", "enlargement", "side_order", "length"] }
};

/** Isolate production-prepared proof data; opt in through the production policy resolver. */
export function focusedModel(input: UiContractsPresentationModel, bundle: Bundle): UiContractsPresentationModel {
  const view = structuredClone(bundle.views.views.find(view => view.id === "ui_contracts")!);
  view.conventions.renderer_defaults!.ui_contracts_presentation!.routing = structuredClone(testUiRoutingPolicy);
  const routing = resolveUiContractsPresentation(view).routing;
  const model = structuredClone(input), scope = model.scopes.find(scope => scope.id === COMPACT_LOOP_PROOF.scopeId)!;
  scope.compositions = []; scope.contracts = []; scope.parents = []; scope.children = []; scope.containment = [];
  model.scopes = [scope]; model.overview = []; model.isolatedComponents.nodes = []; model.register.nodes = [];
  const relationshipIds = new Set(scope.sequences.flatMap(sequence => sequence.edges.map(edge => edge.relationshipId)));
  model.relationships = model.relationships.filter(edge => relationshipIds.has(edge.id)); model.structuralRelationshipIds = [];
  model.visibleSemanticNodeIds = [scope.focal.semanticId, ...scope.sequences.flatMap(sequence => sequence.nodes.map(node => node.semanticId))];
  model.packSimpleScopeIds = []; model.simpleScopeIds = [];
  model.routing = structuredClone(routing);
  return model;
}
