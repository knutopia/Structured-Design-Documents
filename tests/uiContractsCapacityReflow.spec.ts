import { beforeAll, describe, expect, it } from "vitest";
import { runUiContractsRendererPipeline } from "../src/renderer/staged/uiContractsPipeline.js";
import { uiSceneItems, auditUiContractsScene } from "../src/renderer/staged/uiContractsAcceptance.js";
import { focusedModel } from "./uiContractsRoutingTestSupport.js";
import { COMPACT_LOOP_PROOF, prepareCompactLoopProof } from "./uiContractsCompactLoopFixture.js";
import { applyUiCapacityRequirements, mergeUiCapacityRequirements, type UiCapacityRequirement } from "../src/renderer/staged/uiContractsCapacity.js";
import { UiContractsSceneBuilder } from "../src/renderer/staged/uiContractsPresentationScene.js";
import { measureRendererScene } from "../src/renderer/staged/microLayout.js";
import { positionMeasuredSceneBeforeRouting } from "../src/renderer/staged/macroLayout.js";

describe("UI Contracts owned capacity reflow", () => {
  let proof: Awaited<ReturnType<typeof prepareCompactLoopProof>>;
  beforeAll(async () => { proof = await prepareCompactLoopProof(); });
  const settings = { detailId: "compact", nodeDecoratorMode: COMPACT_LOOP_PROOF.decorators };
  it("merges absolute bounds by maximum while isolating alternative ledgers and independent resources", () => {
    const bottom: UiCapacityRequirement = { resource: { kind: "padding", containerId: "owner", side: "bottom" }, minimumExtent: 80, reason: "label_envelope", connectorIds: ["one"] };
    const original = structuredClone(bottom);
    const south = mergeUiCapacityRequirements([bottom], [{ ...bottom, minimumExtent: 96, connectorIds: ["two"] }, { ...bottom, minimumExtent: 80 }]);
    expect(south).toHaveLength(1); expect(south[0]!.minimumExtent).toBe(96); expect(south[0]!.connectorIds).toEqual(["one", "two"]);
    const north = mergeUiCapacityRequirements([], [{ ...bottom, resource: { ...bottom.resource, kind: "padding", containerId: "owner", side: "top" }, minimumExtent: 40 }]);
    expect(bottom).toEqual(original); expect(north).toHaveLength(1); expect(south[0]!.resource).toEqual(bottom.resource);
    const independent = mergeUiCapacityRequirements(south, [{ ...bottom, resource: { kind: "padding", containerId: "other", side: "bottom" } }]);
    expect(independent).toHaveLength(2); expect(independent.map(request => request.minimumExtent).sort()).toEqual([80, 96]);
  });
  it("reports an unsupported packed adjacency and validates all resources before changing the scene", () => {
    const builder = new UiContractsSceneBuilder("compact", COMPACT_LOOP_PROOF.decorators), scene = builder.complete(focusedModel(proof.full.model, proof.bundle));
    const scope = scene.root.children[0]!;
    if (scope.kind !== "container") throw new Error("Expected actual scope owner.");
    scope.layout.pack = { eligibleItemIds: scope.children.map(child => child.id), gap: 16 };
    const before = structuredClone(scene);
    const result = applyUiCapacityRequirements(scene, [
      { resource: { kind: "padding", containerId: scene.root.id, side: "bottom" }, minimumExtent: 200, reason: "label_envelope", connectorIds: [] },
      { resource: { kind: "gap", containerId: scope.id, beforeId: scope.children[0]!.id, afterId: scope.children[1]!.id }, minimumExtent: 50, reason: "label_envelope", connectorIds: [] }
    ]);
    expect(result.status).toBe("unsupported_capacity_owner"); expect(scene).toEqual(before);
    expect(applyUiCapacityRequirements(scene, [{ resource: { kind: "padding", containerId: "absent", side: "bottom" }, minimumExtent: 1, reason: "route_clearance", connectorIds: [] }]).status).toBe("unsupported_capacity_owner");
  });
  it("identifies an ineffective absolute demand without changing realized geometry", async () => {
    const builder = new UiContractsSceneBuilder("compact", COMPACT_LOOP_PROOF.decorators), scene = builder.complete(focusedModel(proof.full.model, proof.bundle));
    const baseline = await positionMeasuredSceneBeforeRouting(measureRendererScene(scene));
    expect(applyUiCapacityRequirements(scene, [{ resource: { kind: "padding", containerId: scene.root.id, side: "bottom" }, minimumExtent: 0, reason: "route_clearance", connectorIds: [] }]))
      .toEqual({ status: "applied", changed: false });
    expect(await positionMeasuredSceneBeforeRouting(measureRendererScene(scene))).toEqual(baseline);
  });
  for (const packed of [false, true]) it(`moves following production scopes through actual layout (${packed ? "packed" : "stack"})`, async () => {
    const without = focusedModel(proof.diagram.model, proof.bundle), withLoop = focusedModel(proof.full.model, proof.bundle);
    const later = proof.full.model.scopes.filter(scope => scope.id !== COMPACT_LOOP_PROOF.scopeId).slice(0, 3).map(scope => ({ ...structuredClone(scope),
      sequences: [], compositions: [], contracts: [], containment: [], parents: [], children: [] }));
    expect(later).toHaveLength(3);
    for (const model of [without, withLoop]) {
      model.scopes.push(...structuredClone(later));
      model.visibleSemanticNodeIds.push(...later.map(scope => scope.focal.semanticId));
      if (packed) model.packSimpleScopeIds = model.scopes.map(scope => scope.id);
    }
    const baseline = await runUiContractsRendererPipeline(without, settings), grown = await runUiContractsRendererPipeline(withLoop, settings);
    expect(baseline.status, JSON.stringify(baseline.status === "failed" ? baseline.violations : [])).toBe("accepted");
    expect(grown.status, JSON.stringify(grown.status === "failed" ? grown.violations : [])).toBe("accepted");
    if (baseline.status !== "accepted" || grown.status !== "accepted") return;
    const before = new Map(uiSceneItems(baseline.revision.positionedScene.root).map(item => [item.id, item]));
    const after = new Map(uiSceneItems(grown.revision.positionedScene.root).map(item => [item.id, item]));
    const ownerId = `${proof.full.sequence.id}:return-region`, ownerBefore = before.get(ownerId)!, ownerAfter = after.get(ownerId)!;
    expect(ownerAfter.height - ownerBefore.height).toBe(96);
    expect(after.get(later[0].id)!.y - before.get(later[0].id)!.y).toBe(96);
    expect(after.get(COMPACT_LOOP_PROOF.scopeId)!.height - before.get(COMPACT_LOOP_PROOF.scopeId)!.height).toBe(96);
    expect(grown.revision.positionedScene.root.height - baseline.revision.positionedScene.root.height).toBe(96);
    expect(grown.evidence.expansions).toBe(1);
    expect(auditUiContractsScene(grown.revision.positionedScene)).toEqual([]);
    expect(baseline.revision.positionedScene.edges).toHaveLength(2);
    expect(grown.revision.positionedScene.edges).toHaveLength(3);
  });
});
