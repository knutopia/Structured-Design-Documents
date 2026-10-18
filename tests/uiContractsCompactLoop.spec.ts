import { beforeAll, describe, expect, it } from "vitest";
import { readFile, writeFile } from "node:fs/promises";
import { runUiContractsRendererPipeline } from "../src/renderer/staged/uiContractsPipeline.js";
import { auditUiContractsScene, uiRoutingContext, uiSceneItems } from "../src/renderer/staged/uiContractsAcceptance.js";
import { COMPACT_LOOP_PROOF, capturedProofRelationshipSegments, normalizeCompactLoopPair, prepareCompactLoopProof } from "./uiContractsCompactLoopFixture.js";
import type { UiContractsPresentationModel } from "../src/renderer/uiContractsPresentationModel.js";
import type { UiContractsRoutingPolicy } from "../src/bundle/types.js";

import { focusedModel } from "./uiContractsRoutingTestSupport.js";
import { getRendererTheme, registerRendererTheme } from "../src/renderer/staged/theme.js";
import { readablePortPitch, readableRoutingClearance } from "../src/renderer/staged/routingCore/bounds.js";
import { validateFinalRouteSet } from "../src/renderer/staged/routingCore/lifecycle.js";

describe("production UI compact-loop contract", () => {
  let proof: Awaited<ReturnType<typeof prepareCompactLoopProof>>;
  beforeAll(async () => { proof = await prepareCompactLoopProof(); });
  it("reproduces compact geometry through actual owned reflow and retains the working pair", async () => {
    const model = focusedModel(proof.full.model, proof.bundle);
    const outcome = await runUiContractsRendererPipeline(model, { detailId: "compact", nodeDecoratorMode: COMPACT_LOOP_PROOF.decorators });
    await writeFile("/tmp/ui-compact-loop-outcome.json", JSON.stringify(outcome, null, 2));
    expect(outcome.status, JSON.stringify(outcome.status === "failed" ? outcome.violations : outcome.evidence)).toBe("accepted");
    if (outcome.status !== "accepted") return;
    const scene = outcome.revision.positionedScene, loop = scene.edges.find(edge => edge.from.itemId === edge.to.itemId)!;
    expect(loop.route.points).toHaveLength(4);
    expect(loop.from.x - loop.to.x).toBe(23);
    expect(loop.route.points[1]!.y - loop.from.y).toBe(17);
    expect(loop.label!.lines).toEqual(["[ChangeProductLabels]", "{selectedLabels remains", "nonempty}"]);
    expect(scene.edges).toHaveLength(3);
    expect(scene.edges.filter(edge => edge.markers?.end === "arrow")).toHaveLength(3);
    expect(auditUiContractsScene(scene)).toEqual([]);
    const nodes = uiSceneItems(scene.root).filter(node => proof.full.sequence.nodes.some(expected => expected.id === node.id));
    expect(nodes.map(node => [node.width, node.height])).toEqual([[224, 53], [224, 53]]);
    const evidence = JSON.parse(await readFile("src/renderer/staged/routing-prototype/evidence.json", "utf8"));
    const historical = evidence.captures.diagram;
    const paths = new Map(scene.root.viewMetadata!.uiContracts!.inventory!.relationships.map(relation => [relation.id, relation.segmentIds]));
    expect(normalizeCompactLoopPair(scene, proof.full.sequence, paths)).toEqual(normalizeCompactLoopPair(historical.positioned, historical.sequence,
      capturedProofRelationshipSegments(historical.positioned, historical.sequence)));
    expect(outcome.evidence.expansions).toBeGreaterThan(0);
  });
  it("rejects a collision-free label-sized loop independently of route validity", async () => {
    const outcome = await runUiContractsRendererPipeline(focusedModel(proof.full.model, proof.bundle), { detailId: "compact", nodeDecoratorMode: COMPACT_LOOP_PROOF.decorators });
    if (outcome.status !== "accepted") throw new Error(JSON.stringify(outcome));
    const scene = structuredClone(outcome.revision.positionedScene), loop = scene.edges.find(edge => edge.from.itemId === edge.to.itemId)!;
    const node = uiSceneItems(scene.root).find(item => item.id === loop.from.itemId)!;
    const binding = scene.uiRoutingBindings!.find(binding => binding.id === loop.id)!;
    for (const [role, offset] of [["source", 180], ["target", 24]] as const) {
      const endpoint = role === "source" ? loop.from : loop.to, port = node.ports.find(port => port.id === endpoint.portId)!;
      endpoint.x = node.x + offset; port.x = offset; port.offset = offset; binding[role].point.x = endpoint.x;
    }
    loop.route.points = [{ x: loop.from.x, y: loop.from.y }, { x: loop.from.x, y: loop.from.y + 17 },
      { x: loop.to.x, y: loop.to.y + 17 }, { x: loop.to.x, y: loop.to.y }];
    binding.fixedRoute = structuredClone(loop.route);
    expect(validateFinalRouteSet(uiRoutingContext(scene))).toEqual([]);
    expect(auditUiContractsScene(scene)).toContainEqual(expect.objectContaining({ code: "renderer.routing.ui_contracts_compact_shape" }));
  });
  it("derives compact pitch/depth from changed shared theme geometry", async () => {
    const theme = structuredClone(getRendererTheme("default"));
    theme.id = "ui-compact-loop-geometry-variation"; theme.paint.arrowSize = 14; theme.paint.edgeStrokeWidth = 4;
    registerRendererTheme(theme);
    const outcome = await runUiContractsRendererPipeline(focusedModel(proof.full.model, proof.bundle), { detailId: "compact", themeId: theme.id, nodeDecoratorMode: COMPACT_LOOP_PROOF.decorators });
    expect(outcome.status, JSON.stringify(outcome.status === "failed" ? outcome.violations : [])).toBe("accepted");
    if (outcome.status !== "accepted") return;
    const loop = outcome.revision.positionedScene.edges.find(edge => edge.from.itemId === edge.to.itemId)!;
    expect(loop.from.x - loop.to.x).toBe(readablePortPitch(14, 4));
    expect(loop.route.points[1]!.y - loop.from.y).toBe(readableRoutingClearance(4));
    expect(loop.from.x - loop.to.x).not.toBe(23);
    expect(auditUiContractsScene(outcome.revision.positionedScene)).toEqual([]);
  });
});
