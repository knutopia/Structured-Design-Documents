import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import {
  createGuidedAdditionRuntime,
  createGuidedDocumentSnapshot,
  GuidedAdditionDomainError,
  loadBundle,
  type Bundle,
  type ExistingNodeRef,
  type GuidedAdditionResult,
  type GuidedDocumentSnapshot,
  type GuidedStep,
  type PlacementRecommendation
} from "../src/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");
const examplePath = path.join(repoRoot, "bundle/v0.1/examples/outcome_to_ia_trace.sdd");

let bundle: Bundle;
let source: string;
let snapshot: GuidedDocumentSnapshot;

beforeAll(async () => {
  bundle = await loadBundle(manifestPath);
  source = fs.readFileSync(examplePath, "utf8");
  snapshot = makeSnapshot(bundle);
});

function makeSnapshot(selectedBundle: Bundle): GuidedDocumentSnapshot {
  return createGuidedDocumentSnapshot(selectedBundle, {
    document_ref: "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
    path: "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
    text: source
  });
}

function ref(current: GuidedDocumentSnapshot, id: string): ExistingNodeRef {
  const node = current.nodes.find((candidate) => candidate.node_id === id)!;
  return { kind: "existing_node", handle: node.handle, node_id: node.node_id, node_type: node.node_type };
}

function step<K extends GuidedStep["kind"]>(
  result: GuidedAdditionResult,
  kind: K
): Extract<GuidedStep, { kind: K }> {
  expect(result.kind).toBe("sdd-guided-addition-step");
  const value = (result as any).step;
  expect(value.kind).toBe(kind);
  return value;
}

function reachNewEndpointPlacement(
  selectedBundle: Bundle,
  current: GuidedDocumentSnapshot,
  anchorId: string,
  direction: "outgoing" | "incoming",
  relationshipType: string
): GuidedAdditionResult {
  const runtime = createGuidedAdditionRuntime(selectedBundle);
  let result = runtime.begin(current, { anchor: ref(current, anchorId) });
  result = runtime.advance(current, result.state, {
    kind: "choose_operation",
    selection: { kind: "add_relationship", direction, endpoint_strategy: "existing_or_new" }
  });
  const relationship = step(result, "choose_relationship").options.find(
    (choice) => choice.relationship_type === relationshipType
  )!;
  result = runtime.advance(current, result.state, { kind: "choose_relationship", choice_id: relationship.choice_id });
  expect(step(result, "choose_endpoint").options.some((option) => option.kind === "create_new")).toBe(true);
  result = runtime.advance(current, result.state, { kind: "create_new_endpoint" });
  const edit = step(result, "edit_new_node");
  result = runtime.advance(current, result.state, {
    kind: "set_new_node_fields",
    fields: { ...edit.values, name: "New endpoint" }
  });
  if ((result as any).step.kind === "edit_edge_fields") {
    const edge = step(result, "edit_edge_fields");
    result = runtime.advance(current, result.state, { kind: "set_edge_fields", fields: edge.values });
  }
  step(result, "review_placement");
  return result;
}

function nodeRecommendation(result: GuidedAdditionResult): PlacementRecommendation {
  return step(result, "review_placement").recommendations.find(
    (recommendation) => recommendation.target.kind === "new_node"
  )!;
}

function selectAll(
  selectedBundle: Bundle,
  current: GuidedDocumentSnapshot,
  initial: GuidedAdditionResult
): GuidedAdditionResult {
  const runtime = createGuidedAdditionRuntime(selectedBundle);
  let result = initial;
  for (;;) {
    if ((result as any).step.kind !== "review_placement") return result;
    const review = step(result, "review_placement");
    const selected = new Set(result.state.selections.placements.map((item) => item.recommendation_id));
    const recommendation = review.recommendations.find((item) => !selected.has(item.recommendation_id));
    if (!recommendation) return result;
    result = runtime.advance(current, result.state, {
      kind: "select_placement",
      selection: { recommendation_id: recommendation.recommendation_id, selected: recommendation.recommended }
    });
  }
}

describe("guided placement precedence", () => {
  it("nests a structural new target under its existing source", () => {
    const result = reachNewEndpointPlacement(bundle, snapshot, "A-001", "outgoing", "CONTAINS");
    const recommendation = nodeRecommendation(result);
    expect(recommendation).toMatchObject({
      reason_code: "structural_nesting",
      recommended: { stream: "body", mode: "last", parent: ref(snapshot, "A-001") }
    });
    expect(recommendation.alternatives).toContainEqual({ stream: "top_level", mode: "last" });
  });

  it("places outgoing and incoming ordering nodes after and before the anchor", () => {
    const outgoing = nodeRecommendation(reachNewEndpointPlacement(bundle, snapshot, "J-001", "outgoing", "PRECEDES"));
    expect(outgoing).toMatchObject({
      reason_code: "outgoing_graph_sequence",
      recommended: { stream: "top_level", mode: "after", anchor: ref(snapshot, "J-001") }
    });

    const incoming = nodeRecommendation(reachNewEndpointPlacement(bundle, snapshot, "J-002", "incoming", "PRECEDES"));
    expect(incoming).toMatchObject({
      reason_code: "incoming_graph_sequence",
      recommended: { stream: "top_level", mode: "before", anchor: ref(snapshot, "J-002") }
    });
  });

  it("uses same-source target order before fallback append", () => {
    const sameSource = nodeRecommendation(
      reachNewEndpointPlacement(bundle, snapshot, "O-001", "outgoing", "MEASURED_BY")
    );
    expect(sameSource).toMatchObject({
      reason_code: "same_source_target_order",
      recommended: { mode: "after", anchor: ref(snapshot, "M-001") }
    });

    const runtime = createGuidedAdditionRuntime(bundle);
    let standalone = runtime.begin(snapshot, {});
    standalone = runtime.advance(snapshot, standalone.state, { kind: "choose_operation", selection: { kind: "add_node" } });
    standalone = runtime.advance(snapshot, standalone.state, { kind: "choose_node_type", node_type: "Policy" });
    const edit = step(standalone, "edit_new_node");
    standalone = runtime.advance(snapshot, standalone.state, {
      kind: "set_new_node_fields",
      fields: { ...edit.values, name: "Policy" }
    });
    expect(nodeRecommendation(standalone)).toMatchObject({
      reason_code: "fallback_append",
      recommended: { stream: "top_level", mode: "last" }
    });
  });

  it("returns deterministic bounded alternatives without duplicates", () => {
    const recommendation = nodeRecommendation(
      reachNewEndpointPlacement(bundle, snapshot, "J-001", "outgoing", "PRECEDES")
    );
    const all = [recommendation.recommended, ...recommendation.alternatives].map((item) => JSON.stringify(item));
    expect(new Set(all).size).toBe(all.length);
    expect(recommendation.alternatives).toEqual([
      { stream: "top_level", mode: "last" },
      { stream: "top_level", mode: "first" },
      { stream: "top_level", mode: "before", anchor: ref(snapshot, "J-001") }
    ]);
  });
});

describe("confirmation-bound structural reparenting", () => {
  it("requires exact confirmation for a new parent and existing child", () => {
    const runtime = createGuidedAdditionRuntime(bundle);
    const placement = reachNewEndpointPlacement(bundle, snapshot, "J-001", "incoming", "CONTAINS");
    const review = step(placement, "review_placement");
    const node = nodeRecommendation(placement);
    expect(node.required_effect).toMatchObject({
      kind: "reparent_existing_node",
      target: ref(snapshot, "J-001"),
      new_parent: { kind: "new_node", local_id: "node_1" }
    });
    expect(node.required_effect?.effect_id).toMatch(/^eff_[a-f0-9]{64}$/);

    const afterSelections = selectAll(bundle, snapshot, placement);
    const confirmation = step(afterSelections, "confirm_effect");
    expect(() => runtime.advance(snapshot, afterSelections.state, {
      kind: "confirm_effect",
      effect: { ...confirmation.effect, placement: { stream: "top_level", mode: "last" }, confirmed: true }
    })).toThrowError(expect.objectContaining({ code: "guided_addition.confirmation_stale" }));

    let confirmed = runtime.advance(snapshot, afterSelections.state, {
      kind: "confirm_effect",
      effect: { ...confirmation.effect, confirmed: true }
    });
    const proposal = step(confirmed, "review_proposal").proposal;
    expect(proposal.confirmed_effects).toEqual([{ ...confirmation.effect, confirmed: true }]);
    expect(review.recommendations).toHaveLength(2);
  });

  it("clears the effect when a non-reparenting placement is selected", () => {
    const runtime = createGuidedAdditionRuntime(bundle);
    const placement = reachNewEndpointPlacement(bundle, snapshot, "J-001", "incoming", "CONTAINS");
    let result = selectAll(bundle, snapshot, placement);
    step(result, "confirm_effect");
    const node = nodeRecommendation(placement);
    const alternative = node.alternatives.find((candidate) => candidate.mode === "last")!;
    result = runtime.advance(snapshot, result.state, {
      kind: "select_placement",
      selection: { recommendation_id: node.recommendation_id, selected: alternative }
    });
    const proposal = step(result, "review_proposal").proposal;
    expect(proposal.confirmed_effects).toEqual([]);
    expect(result.state.confirmed_effects).toEqual([]);
  });
});

describe("bundle-only placement proofs", () => {
  it("changes sequence placement when the placement policy changes", () => {
    const changed = structuredClone(bundle);
    changed.authoring!.placement_policies.default.outgoing_sequence = "before_anchor" as any;
    const changedSnapshot = makeSnapshot(changed);
    const recommendation = nodeRecommendation(
      reachNewEndpointPlacement(changed, changedSnapshot, "J-001", "outgoing", "PRECEDES")
    );
    expect(recommendation.recommended).toMatchObject({ mode: "before", anchor: ref(changedSnapshot, "J-001") });
  });

  it("changes precedence when relationship authoring semantics change", () => {
    const changed = structuredClone(bundle);
    changed.contracts.relationships.find((relationship) => relationship.type === "PRECEDES")!.authoring!.graph_role = "reference";
    const changedSnapshot = makeSnapshot(changed);
    const recommendation = nodeRecommendation(
      reachNewEndpointPlacement(changed, changedSnapshot, "J-001", "outgoing", "PRECEDES")
    );
    expect(recommendation).toMatchObject({
      reason_code: "same_source_target_order",
      recommended: { anchor: ref(changedSnapshot, "P-001") }
    });
  });

  it("changes standalone placement when fallback policy changes", () => {
    const changed = structuredClone(bundle);
    changed.authoring!.placement_policies.default.fallback = "first" as any;
    const current = makeSnapshot(changed);
    const runtime = createGuidedAdditionRuntime(changed);
    let result = runtime.begin(current, {});
    result = runtime.advance(current, result.state, { kind: "choose_operation", selection: { kind: "add_node" } });
    result = runtime.advance(current, result.state, { kind: "choose_node_type", node_type: "Policy" });
    const edit = step(result, "edit_new_node");
    result = runtime.advance(current, result.state, {
      kind: "set_new_node_fields",
      fields: { ...edit.values, name: "Policy" }
    });
    expect(nodeRecommendation(result).recommended).toEqual({ stream: "top_level", mode: "first" });
  });

  it("removes reparenting when the structural-existing-target policy changes", () => {
    const changed = structuredClone(bundle);
    changed.authoring!.placement_policies.default.structural_existing_target = "same_level" as any;
    const current = makeSnapshot(changed);
    const placement = reachNewEndpointPlacement(changed, current, "J-001", "incoming", "CONTAINS");
    expect(nodeRecommendation(placement)).toMatchObject({ reason_code: "fallback_append" });
    expect(nodeRecommendation(placement)).not.toHaveProperty("required_effect");
    const result = selectAll(changed, current, placement);
    expect(step(result, "review_proposal").proposal.confirmed_effects).toEqual([]);
  });
});
