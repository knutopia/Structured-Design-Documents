import { writeFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { compileSource, loadBundle, validateLoadedBundle } from "../src/index.js";
import type { Bundle, UiContractsRoutingPolicy } from "../src/bundle/types.js";
import { resolveUiContractsPresentation } from "../src/bundle/uiContractsPresentation.js";
import { prepareCompiledGraphPreview } from "../src/renderer/previewWorkflow.js";
import { auditUiContractsScene, uiRoutingContext, uiSceneItems } from "../src/renderer/staged/uiContractsAcceptance.js";
import { runUiContractsRendererPipeline, type UiRoutingOutcome } from "../src/renderer/staged/uiContractsPipeline.js";
import { routeCost } from "../src/renderer/staged/routingCore/optimization.js";
import { testUiRoutingPolicy } from "./uiContractsRoutingTestSupport.js";

let loaded: Bundle;
beforeAll(async () => { loaded = await loadBundle("bundle/v0.2/manifest.yaml"); });
const settings = { detailId: "compact", nodeDecoratorMode: { id: "type,id", showNodeType: true, showNodeId: true } };

// Real presentation content owns the spare space: the forward annotation creates
// top padding and the tall peer creates room below the short loop's card. No
// scene coordinates, dimensions, or capacity requirements are injected.
const equalFitSource = `SDD-TEXT 0.2
Place P-100 "Equal fit page"
  route_or_key=/equal-fit
  access=public
  CONTAINS VS-100 "Ready"
  CONTAINS VS-101 "Peer"
END
ViewState VS-100 "Ready"
  place_id=P-100
  TRANSITIONS_TO VS-101 "Peer" [E-100]
  TRANSITIONS_TO VS-100 "Ready" [Repeat]
END
ViewState VS-101 "Tall peer ${"additional visible content ".repeat(70)}"
  place_id=P-100
  TRANSITIONS_TO VS-100 "Ready" [Back]
END
Event E-100 "Forward annotation ${"required context ".repeat(40)}"
END
`;

const isolatedSource = `SDD-TEXT 0.2
Place P-200 "Loop page"
  route_or_key=/loop
  access=public
  CONTAINS VS-200 "Ready"
END
ViewState VS-200 "Ready"
  place_id=P-200
  TRANSITIONS_TO VS-200 "Ready" [Repeat]
END
`;

function prepared(text: string, change: (policy: UiContractsRoutingPolicy) => void = () => {}) {
  const bundle = structuredClone(loaded);
  const view = bundle.views.views.find(view => view.id === "ui_contracts")!;
  const policy = structuredClone(testUiRoutingPolicy);
  change(policy);
  view.conventions.renderer_defaults!.ui_contracts_presentation!.routing = policy;
  resolveUiContractsPresentation(view);
  validateLoadedBundle(bundle);
  const compiled = compileSource({ path: "/tmp/ui-policy-consumption.sdd", text }, bundle);
  expect(compiled.diagnostics).toEqual([]);
  const result = prepareCompiledGraphPreview("/tmp/ui-policy-consumption.sdd", compiled.graph!, bundle, {
    viewId: "ui_contracts", format: "svg", profileId: "simple", detailId: "compact", nodeDecoratorModeId: "type,id"
  });
  expect(result.diagnostics).toEqual([]);
  expect(result.prepared!.presentationModel!.routing).toEqual(policy);
  return result.prepared!;
}

function accepted(outcome: UiRoutingOutcome) {
  expect(outcome.status, JSON.stringify(outcome.status === "failed" ? { reason: outcome.reason, findings: outcome.violations } : outcome.evidence)).toBe("accepted");
  if (outcome.status !== "accepted") throw new Error("Expected accepted production scene");
  expect(auditUiContractsScene(outcome.revision.positionedScene)).toEqual([]);
  return outcome.revision.positionedScene;
}

function loop(scene: ReturnType<typeof accepted>) {
  return scene.edges.find(edge => edge.viewMetadata?.uiTransition?.kind === "loop")!;
}
function side(scene: ReturnType<typeof accepted>) {
  return scene.uiRoutingBindings!.find(binding => binding.id === loop(scene).id)!.source.side;
}

describe("loaded UI routing policy controls production behavior", () => {
  it("uses loaded side order to break a complete equal-cost, no-growth comparison", async () => {
    const normal = prepared(equalFitSource, policy => { policy.capacity.owner = "fixed"; });
    const reversed = prepared(equalFitSource, policy => { policy.capacity.owner = "fixed"; policy.self_loop.side_trials.reverse(); });
    expect(reversed.projection).toEqual(normal.projection);
    const limits = { candidates: 16, repairs: 0, expansions: 0 };
    const first = await runUiContractsRendererPipeline(normal.presentationModel!, settings, limits);
    const second = await runUiContractsRendererPipeline(reversed.presentationModel!, settings, limits);
    await writeFile("/tmp/ui-policy-equal-fit-outcomes.json", JSON.stringify({ first, second }, null, 2));
    const south = accepted(first), north = accepted(second);
    for (const outcome of [first, second]) {
      expect(outcome.evidence.trials.map(trial => trial.choices)).toEqual([[0], [1]]);
      expect(outcome.evidence.trials.every(trial => trial.accepted && trial.requirements.length === 0)).toBe(true);
      expect(outcome.evidence.expansions).toBe(0);
    }
    expect(routeCost(uiRoutingContext(south).connectors)).toEqual(routeCost(uiRoutingContext(north).connectors));
    expect(side(south)).toBe("south");
    expect(side(north)).toBe("north");
    expect(uiSceneItems(south.root).filter(item => item.kind === "node").map(item => [item.id, item.x, item.y, item.width, item.height]))
      .toEqual(uiSceneItems(north.root).filter(item => item.kind === "node").map(item => [item.id, item.x, item.y, item.width, item.height]));
  });

  it("changes departure/arrival direction solely through the loaded traversal", async () => {
    const negative = prepared(isolatedSource);
    const positive = prepared(isolatedSource, policy => { policy.self_loop.traversal.direction = "positive"; });
    expect(positive.projection).toEqual(negative.projection);
    const backward = accepted(await runUiContractsRendererPipeline(negative.presentationModel!, settings, { candidates: 16, repairs: 0 }));
    const forward = accepted(await runUiContractsRendererPipeline(positive.presentationModel!, settings, { candidates: 16, repairs: 0 }));
    expect(loop(backward).to.x - loop(backward).from.x).toBe(-23);
    expect(loop(forward).to.x - loop(forward).from.x).toBe(23);
    expect(side(forward)).toBe(side(backward));
    expect(loop(forward).label!.lines).toEqual(loop(backward).label!.lines);
    expect(uiSceneItems(forward.root).filter(item => item.kind === "node").map(item => [item.id, item.width, item.height]))
      .toEqual(uiSceneItems(backward.root).filter(item => item.kind === "node").map(item => [item.id, item.width, item.height]));
  });

  it("forbids actual owner growth when the loaded capacity policy is fixed", async () => {
    const growing = prepared(isolatedSource);
    const fixed = prepared(isolatedSource, policy => { policy.capacity.owner = "fixed"; });
    expect(fixed.projection).toEqual(growing.projection);
    const grown = await runUiContractsRendererPipeline(growing.presentationModel!, settings, { candidates: 16, repairs: 0 });
    accepted(grown);
    expect(grown.evidence.expansions).toBeGreaterThan(0);
    const blocked = await runUiContractsRendererPipeline(fixed.presentationModel!, settings, { candidates: 16, repairs: 0 });
    expect(blocked.status).toBe("failed");
    if (blocked.status !== "failed") return;
    expect(blocked.evidence.expansions).toBe(0);
    expect(blocked.unresolved.some(request => request.resource.kind === "padding")).toBe(true);
    expect(blocked.violations.some(diagnostic => diagnostic.severity === "error")).toBe(true);
  });
});
