import { expect, it } from "vitest";
import { readFile, writeFile } from "node:fs/promises";
import { buildUiContractsPresentationModel } from "../src/renderer/uiContractsPresentationModel.js";
import { runUiContractsRendererPipeline } from "../src/renderer/staged/uiContractsPipeline.js";
import { prepareCompactLoopProof, COMPACT_LOOP_PROOF, normalizeCompactLoopPair, capturedProofRelationshipSegments } from "./uiContractsCompactLoopFixture.js";

it("accepts the actual full production sheet through the enabled policy", async () => {
  const proof = await prepareCompactLoopProof(), view = structuredClone(proof.full.preview.view);
  expect(view.conventions.renderer_defaults!.ui_contracts_presentation!.routing!.capacity.node).toBe("port_minimum");
  const model = buildUiContractsPresentationModel(proof.full.preview.prepared!.projection, proof.graph, view, "compact");
  const outcome = await runUiContractsRendererPipeline(model, { detailId: "compact", nodeDecoratorMode: COMPACT_LOOP_PROOF.decorators });
  await writeFile("/tmp/ui-full-production-outcome.json", JSON.stringify(outcome, null, 2));
  expect(outcome.status, JSON.stringify(outcome.status === "failed" ? { reason: outcome.reason, violations: outcome.violations } : outcome.evidence)).toBe("accepted");
  if (outcome.status === "accepted") {
    const captured = JSON.parse(await readFile("src/renderer/staged/routing-prototype/evidence.json", "utf8")).captures.diagram;
    const scene = outcome.revision.positionedScene, inventory = scene.root.viewMetadata!.uiContracts!.inventory!;
    expect(normalizeCompactLoopPair(scene, proof.full.sequence, new Map(inventory.relationships.map(relationship => [relationship.id, relationship.segmentIds]))))
      .toEqual(normalizeCompactLoopPair(captured.positioned, captured.sequence, capturedProofRelationshipSegments(captured.positioned, captured.sequence)));
  }
}, 60000);
