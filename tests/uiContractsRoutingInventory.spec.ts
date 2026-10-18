import { beforeAll, describe, expect, it } from "vitest";
import type { PositionedScene } from "../src/renderer/staged/contracts.js";
import { auditUiContractsScene } from "../src/renderer/staged/uiContractsAcceptance.js";
import { runUiContractsRendererPipeline } from "../src/renderer/staged/uiContractsPipeline.js";
import { COMPACT_LOOP_PROOF, prepareCompactLoopProof } from "./uiContractsCompactLoopFixture.js";
import { focusedModel } from "./uiContractsRoutingTestSupport.js";

describe("production UI relationship inventory acceptance", () => {
  let accepted: PositionedScene;
  let loopId: string;

  beforeAll(async () => {
    const proof = await prepareCompactLoopProof();
    const model = focusedModel(proof.full.model, proof.bundle);
    const outcome = await runUiContractsRendererPipeline(model, {
      detailId: COMPACT_LOOP_PROOF.detailId, nodeDecoratorMode: COMPACT_LOOP_PROOF.decorators
    });
    if (outcome.status !== "accepted") throw new Error(JSON.stringify(outcome.violations));
    accepted = outcome.revision.positionedScene;
    loopId = accepted.edges.find(edge => edge.from.itemId === edge.to.itemId)!.id;
    expect(auditUiContractsScene(accepted)).toEqual([]);
  });

  const copy = () => structuredClone(accepted);
  const loop = (scene: PositionedScene) => scene.edges.find(edge => edge.id === loopId)!;
  const inventory = (scene: PositionedScene) => scene.root.viewMetadata!.uiContracts!.inventory!;
  const rejects = (scene: PositionedScene, kind?: string) => {
    const before = structuredClone(scene);
    const findings = auditUiContractsScene(scene);
    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: "error", ...(kind ? { code: `renderer.routing.ui_contracts_${kind}` } : {}) })
    ]));
    expect(scene).toEqual(before);
  };

  it("retains all three actual relationships as complete, independently bound paths", () => {
    const intent = inventory(accepted);
    expect(intent.relationships).toHaveLength(3);
    expect(intent.segments).toHaveLength(3);
    expect(accepted.edges).toHaveLength(3);
    expect(accepted.uiRoutingBindings).toHaveLength(3);
    for (const relationship of intent.relationships) {
      expect(relationship.structural).toBe(false);
      expect(relationship.segmentIds).toHaveLength(1);
      const segment = intent.segments.find(segment => segment.id === relationship.segmentIds[0])!;
      expect(segment.relationshipIds).toContain(relationship.id);
      expect(accepted.edges.some(edge => edge.id === segment.id)).toBe(true);
      expect(accepted.uiRoutingBindings!.some(binding => binding.id === segment.id)).toBe(true);
    }
    expect(auditUiContractsScene(accepted)).toEqual([]);
  });

  it("rejects a missing physical connector despite preserved relationship inventory", () => {
    const scene = copy();
    scene.edges = scene.edges.filter(edge => edge.id !== loopId);
    rejects(scene, "missing_path");
    rejects(scene, "missing_segment");
  });

  it("rejects duplicate painted connector IDs", () => {
    const scene = copy();
    scene.edges.push(structuredClone(loop(scene)));
    rejects(scene, "duplicate_path");
  });

  it("rejects an additional painted connector with no inventory provenance", () => {
    const scene = copy(), duplicate = structuredClone(loop(scene));
    duplicate.id += ":unexpected";
    scene.edges.push(duplicate);
    rejects(scene, "unexpected_path");
  });

  it("rejects a lost endpoint occurrence", () => {
    const scene = copy();
    loop(scene).to.itemId = "absent-occurrence";
    rejects(scene, "provenance");
  });

  it("rejects an endpoint whose declared port was removed", () => {
    const scene = copy();
    delete loop(scene).from.portId;
    rejects(scene, "attachment");
  });

  it("rejects lost declared ownership", () => {
    const scene = copy();
    delete loop(scene).ownerContainerId;
    rejects(scene, "provenance");
  });

  it("rejects a changed relationship style", () => {
    const scene = copy();
    loop(scene).classes = ["edge-dashed"];
    rejects(scene, "provenance");
  });

  it("rejects a missing full prepared label", () => {
    const scene = copy();
    delete loop(scene).label;
    rejects(scene, "label_coverage");
  });

  it("rejects a truncated prepared label", () => {
    const scene = copy();
    loop(scene).label!.lines.pop();
    rejects(scene, "label_coverage");
  });

  it("rejects changed full label text even with retained measured bounds", () => {
    const scene = copy();
    loop(scene).label!.lines[0] = "[WrongEvent]";
    rejects(scene, "label_coverage");
  });

  it("rejects a missing terminal marker", () => {
    const scene = copy();
    delete loop(scene).markers;
    rejects(scene, "marker_coverage");
  });

  it("rejects a changed terminal marker", () => {
    const scene = copy();
    loop(scene).markers!.end = "none";
    rejects(scene, "marker_coverage");
  });

  it("rejects an enabled scene with missing inventory", () => {
    const scene = copy();
    delete scene.root.viewMetadata!.uiContracts!.inventory;
    rejects(scene, "inventory_missing");
  });

  it("rejects a relationship with no declared physical path", () => {
    const scene = copy();
    inventory(scene).relationships.find(relationship => relationship.segmentIds.includes(loopId))!.segmentIds = [];
    rejects(scene, "missing_relationship");
  });

  it("rejects lost physical-segment relationship provenance", () => {
    const scene = copy();
    inventory(scene).segments.find(segment => segment.id === loopId)!.relationshipIds = [];
    rejects(scene);
  });

  it("rejects relationship semantic endpoints inconsistent with its physical path", () => {
    const scene = copy();
    inventory(scene).relationships.find(relationship => relationship.segmentIds.includes(loopId))!.from = "VS-not-the-source";
    rejects(scene);
  });

  it("rejects a connector with no independently allocated binding", () => {
    const scene = copy();
    scene.uiRoutingBindings = scene.uiRoutingBindings!.filter(binding => binding.id !== loopId);
    rejects(scene, "binding_missing");
  });

  it("rejects missing binding inventory", () => {
    const scene = copy();
    delete scene.uiRoutingBindings;
    rejects(scene, "binding_missing");
  });

  it("rejects a binding moved away from the actual allocated port", () => {
    const scene = copy();
    scene.uiRoutingBindings!.find(binding => binding.id === loopId)!.source.point.x += 1;
    rejects(scene, "attachment");
  });

  it("rejects a binding naming a different declared port", () => {
    const scene = copy();
    scene.uiRoutingBindings!.find(binding => binding.id === loopId)!.source.portId = "missing-port";
    rejects(scene, "attachment");
  });

  it("rejects a binding declaring a different side", () => {
    const scene = copy();
    scene.uiRoutingBindings!.find(binding => binding.id === loopId)!.source.side = "north";
    rejects(scene, "attachment");
  });
});
