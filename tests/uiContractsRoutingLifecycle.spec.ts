import { beforeAll, describe, expect, it } from "vitest";
import { compileSource } from "../src/index.js";
import { resolveUiContractsPresentation } from "../src/bundle/uiContractsPresentation.js";
import type { UiContractsRoutingPolicy } from "../src/bundle/types.js";
import { prepareCompiledGraphPreview } from "../src/renderer/previewWorkflow.js";
import { auditUiContractsScene, uiSceneItems } from "../src/renderer/staged/uiContractsAcceptance.js";
import { measureRendererScene } from "../src/renderer/staged/microLayout.js";
import { positionMeasuredSceneBeforeRouting } from "../src/renderer/staged/macroLayout.js";
import { runUiContractsRendererPipeline, type UiRoutingOutcome } from "../src/renderer/staged/uiContractsPipeline.js";
import { COMPACT_LOOP_PROOF, prepareCompactLoopProof } from "./uiContractsCompactLoopFixture.js";
import { focusedModel, testUiRoutingPolicy } from "./uiContractsRoutingTestSupport.js";

const settings = { detailId: "compact", nodeDecoratorMode: COMPACT_LOOP_PROOF.decorators };

async function expectCoherent(outcome: UiRoutingOutcome): Promise<void> {
  expect(outcome.status, JSON.stringify(outcome.status === "failed" ? outcome.violations : outcome.evidence)).toBe("accepted");
  if (outcome.status !== "accepted") throw new Error("Expected accepted revision");
  const { rendererScene, measuredScene, positionedScene } = outcome.revision;
  expect(measureRendererScene(rendererScene)).toEqual(measuredScene);
  const rebuilt = await positionMeasuredSceneBeforeRouting(measuredScene);
  const measured = new Map(uiSceneItems(rebuilt.root).map(item => [item.id, item]));
  for (const item of uiSceneItems(positionedScene.root)) {
    const expected = measured.get(item.id)!;
    expect([item.x, item.y, item.width, item.height], item.id).toEqual([expected.x, expected.y, expected.width, expected.height]);
  }
  expect(positionedScene.diagnostics.filter(d => d.severity === "error")).toEqual([]);
  expect(auditUiContractsScene(positionedScene)).toEqual([]);
}

describe("bounded production UI routing lifecycle", () => {
  let proof: Awaited<ReturnType<typeof prepareCompactLoopProof>>;
  beforeAll(async () => { proof = await prepareCompactLoopProof(); });
  const summary = (outcome: UiRoutingOutcome) => outcome.evidence.trials.map(trial => [trial.choices, trial.requirements, trial.findings, trial.accepted]);
  function withPolicy(change: (policy: UiContractsRoutingPolicy) => void) {
    const model = focusedModel(proof.full.model, proof.bundle);
    const view = structuredClone(proof.bundle.views.views.find(view => view.id === "ui_contracts")!);
    const policy = structuredClone(testUiRoutingPolicy);
    change(policy);
    view.conventions.renderer_defaults!.ui_contracts_presentation!.routing = policy;
    model.routing = resolveUiContractsPresentation(view).routing;
    return model;
  }
  function multipleLoops() {
    const bundle = structuredClone(proof.bundle);
    const view = bundle.views.views.find(view => view.id === "ui_contracts")!;
    view.conventions.renderer_defaults!.ui_contracts_presentation!.routing = structuredClone(testUiRoutingPolicy);
    resolveUiContractsPresentation(view);
    const text = `SDD-TEXT 0.2\n${[1, 2].map(index => `Place P-90${index} "Scope ${index}"\n  route_or_key=/scope${index}\n  access=public\n  CONTAINS VS-90${index} "Ready"\nEND\nViewState VS-90${index} "Ready"\n  place_id=P-90${index}\n  TRANSITIONS_TO VS-90${index} "Ready" [Again${index}]\nEND\n`).join("")}`;
    const compiled = compileSource({ path: "multiple_ui_loops.sdd", text }, bundle);
    expect(compiled.diagnostics).toEqual([]);
    const prepared = prepareCompiledGraphPreview("multiple_ui_loops.sdd", compiled.graph!, bundle, {
      viewId: "ui_contracts", format: "svg", profileId: "simple", detailId: "compact", nodeDecoratorModeId: "type,id"
    });
    expect(prepared.diagnostics).toEqual([]);
    return prepared.prepared!.presentationModel!;
  }

  it("audits a real seed with zero candidate, repair and expansion allowance", async () => {
    const outcome = await runUiContractsRendererPipeline(withPolicy(() => {}), settings, { candidates: 0, repairs: 0, expansions: 0 });
    expect(outcome.status).toBe("failed");
    if (outcome.status !== "failed") return;
    expect(outcome.reason).toBe("candidate_budget");
    expect(outcome.evidence).toMatchObject({ candidates: 0, repairs: 0, expansions: 0 });
    expect(outcome.evidence.trials).toHaveLength(1);
    expect(outcome.evidence.trials[0]!.findings).toContainEqual(expect.objectContaining({ code: "renderer.routing.ui_contracts_label_bounds", severity: "error" }));
    expect(outcome.unresolved.some(request => request.resource.kind === "padding")).toBe(true);
    expect(outcome.diagnosticRevision).toBeDefined();
    expect(auditUiContractsScene(outcome.diagnosticRevision!.positionedScene).length).toBeGreaterThan(0);
  });

  it("assesses both side seeds before spending a two-candidate allowance on recovery", async () => {
    const outcome = await runUiContractsRendererPipeline(withPolicy(() => {}), settings, { candidates: 2, repairs: 0, expansions: 0 });
    expect(outcome.status).toBe("failed");
    expect(outcome.evidence.candidates).toBe(2);
    expect(outcome.evidence.repairs).toBe(0);
    expect(outcome.evidence.expansions).toBe(0);
    expect(outcome.evidence.trials.map(trial => trial.choices)).toEqual([[0], [1]]);
    expect(outcome.evidence.trials.every(trial => trial.requirements.length === 0)).toBe(true);
    expect(outcome.evidence.trials[1]!.findings.some(d => d.code === "renderer.routing.ui_contracts_label_connector")).toBe(true);
  });

  it("retains concrete deficits when loaded owner policy forbids the needed growth", async () => {
    const outcome = await runUiContractsRendererPipeline(withPolicy(policy => { policy.capacity.owner = "fixed"; }), settings, { candidates: 32 });
    expect(outcome.status).toBe("failed");
    if (outcome.status !== "failed") return;
    expect(outcome.evidence.expansions).toBe(0);
    expect(outcome.unresolved).toContainEqual(expect.objectContaining({ resource: expect.objectContaining({ kind: "padding", side: "bottom" }), minimumExtent: 96 }));
    expect(outcome.evidence.trials.every(trial => !trial.accepted && trial.requirements.length === 0)).toBe(true);
    expect(outcome.violations.length).toBeGreaterThan(0);
    expect(outcome.evidence.candidates).toBeLessThanOrEqual(32);
  });

  it("stops at zero expansion allowance and reports a meaningful failure", async () => {
    const outcome = await runUiContractsRendererPipeline(withPolicy(() => {}), settings, { candidates: 32, repairs: 0, expansions: 0 });
    expect(outcome.status).toBe("failed");
    if (outcome.status !== "failed") return;
    expect(outcome.reason).toBe("expansion_budget");
    expect(outcome.evidence.expansions).toBe(0);
    expect(outcome.unresolved.length).toBeGreaterThan(0);
    expect(outcome.violations.length).toBeGreaterThan(0);
  });

  it("keeps rejected branches isolated and accepts owned growth without repair work", async () => {
    const model = withPolicy(() => {}), before = structuredClone(model);
    const rejected = await runUiContractsRendererPipeline(model, settings, { candidates: 2, repairs: 0 });
    const accepted = await runUiContractsRendererPipeline(model, settings, { candidates: 3, repairs: 0, expansions: 1 });
    expect(model).toEqual(before);
    expect(summary(accepted).slice(0, 2)).toEqual(summary(rejected));
    expect(accepted.evidence).toMatchObject({ candidates: 3, repairs: 0, expansions: 1 });
    await expectCoherent(accepted);
  });

  it("retains an accepted matching revision when later multi-loop exploration exhausts", async () => {
    const model = multipleLoops(), before = structuredClone(model);
    const outcome = await runUiContractsRendererPipeline(model, settings, { candidates: 6, expansions: 1 });
    expect(outcome.evidence.candidates).toBe(6);
    expect(outcome.evidence.trials.slice(0, 4).map(trial => trial.choices)).toEqual([[0, 0], [0, 1], [1, 0], [1, 1]]);
    const accepted = outcome.evidence.trials.find(trial => trial.accepted)!;
    expect(accepted.choices).toEqual([0, 0]);
    expect(new Set(accepted.requirements.map(request => JSON.stringify(request.resource))).size).toBe(2);
    expect(outcome.evidence.expansions).toBe(1);
    await expectCoherent(outcome);
    expect(model).toEqual(before);
    if (outcome.status === "accepted") expect(outcome.revision.positionedScene.edges).toHaveLength(2);
  });

  it("reserves enough work to assess all four complete baseline assignments for two loops", async () => {
    const outcome = await runUiContractsRendererPipeline(multipleLoops(), settings, { candidates: 4, repairs: 0, expansions: 0 });
    expect(outcome.status).toBe("failed");
    expect(outcome.evidence.candidates).toBe(4);
    expect(outcome.evidence.expansions).toBe(0);
    expect(outcome.evidence.trials.map(trial => trial.choices)).toEqual([[0, 0], [0, 1], [1, 0], [1, 1]]);
  });

  it("returns the same complete outcome for identical prepared input and finite limits", async () => {
    const model = withPolicy(() => {});
    const limits = { candidates: 8, repairs: 0, expansions: 2 };
    const first = await runUiContractsRendererPipeline(model, settings, limits);
    const second = await runUiContractsRendererPipeline(model, settings, limits);
    await expectCoherent(first);
    expect(second).toEqual(first);
  });

  it.each([-1, 0.5, NaN, Infinity])("rejects malformed finite-search limits %s", async value => {
    for (const limits of [{ candidates: value }, { repairs: value }, { expansions: value }]) {
      await expect(runUiContractsRendererPipeline(withPolicy(() => {}), settings, limits)).rejects.toThrow(RangeError);
    }
  });
});
