import { beforeAll, describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { resolveUiContractsPresentation } from "../src/bundle/uiContractsPresentation.js";
import { validateLoadedBundle } from "../src/bundle/validateLoadedBundle.js";
import type { Bundle, UiContractsRoutingPolicy } from "../src/bundle/types.js";
import { prepareCompiledGraphPreview } from "../src/renderer/previewWorkflow.js";
import { auditUiContractsScene, uiSceneItems } from "../src/renderer/staged/uiContractsAcceptance.js";
import { measureRendererScene, type NodeMinimumExtent } from "../src/renderer/staged/microLayout.js";
import { runUiContractsRendererPipeline, type UiRoutingOutcome } from "../src/renderer/staged/uiContractsPipeline.js";
import { testUiRoutingPolicy } from "./uiContractsRoutingTestSupport.js";

const decorators = { id: "type,id", showNodeType: true, showNodeId: true };
const settings = { detailId: "detailed", nodeDecoratorMode: decorators };
const crowdedFanout = `SDD-TEXT 0.2\nComponent C-900 "Source"\n${Array.from({ length: 14 }, (_, index) => `  EMITS E-9${String(index).padStart(2, "0")} "Event ${index}"`).join("\n")}\nEND\n${Array.from({ length: 14 }, (_, index) => `Event E-9${String(index).padStart(2, "0")} "Event ${index}"\nEND\n`).join("")}`;
const crowdedLoops = `SDD-TEXT 0.2
Place P-900 "Crowded loops"
  route_or_key=/crowded
  access=public
  CONTAINS VS-900 "Ready"
END
ViewState VS-900 "Ready"
  place_id=P-900
  TRANSITIONS_TO VS-900 "Ready" [One]
  TRANSITIONS_TO VS-900 "Ready" [Two]
END
`;

describe("production UI attachment capacity growth", () => {
  let original: Bundle;
  beforeAll(async () => { original = await loadBundle("bundle/v0.2/manifest.yaml"); });
  function prepare(text: string, node: "fixed" | "port_minimum", change?: (policy: UiContractsRoutingPolicy) => void) {
    const bundle = structuredClone(original);
    const view = bundle.views.views.find(view => view.id === "ui_contracts")!;
    const policy = structuredClone(testUiRoutingPolicy);
    policy.capacity.node = node;
    change?.(policy);
    view.conventions.renderer_defaults!.ui_contracts_presentation!.routing = policy;
    validateLoadedBundle(bundle);
    expect(resolveUiContractsPresentation(view).routing).toEqual(policy);
    const compiled = compileSource({ path: "ui_contracts_port_growth.sdd", text }, bundle);
    expect(compiled.diagnostics).toEqual([]);
    const preview = prepareCompiledGraphPreview("ui_contracts_port_growth.sdd", compiled.graph!, bundle, {
      viewId: "ui_contracts", format: "svg", profileId: "simple", detailId: "detailed", nodeDecoratorModeId: decorators.id
    });
    expect(preview.diagnostics).toEqual([]);
    return preview.prepared!.presentationModel!;
  }
  function accepted(outcome: UiRoutingOutcome) {
    expect(outcome.status, JSON.stringify(outcome.status === "failed" ? { reason: outcome.reason, violations: outcome.violations, evidence: outcome.evidence } : outcome.evidence)).toBe("accepted");
    if (outcome.status !== "accepted") throw new Error("Expected accepted capacity rebuild");
    expect(auditUiContractsScene(outcome.revision.positionedScene)).toEqual([]);
    return outcome;
  }

  it("fails fixed capacity and grows only the crowded fanout occurrence through preliminary and final measurement", async () => {
    const fixed = prepare(crowdedFanout, "fixed"), growing = prepare(crowdedFanout, "port_minimum");
    const blocked = await runUiContractsRendererPipeline(fixed, settings, { candidates: 64 });
    expect(blocked.status).toBe("failed");
    if (blocked.status !== "failed") return;
    expect(blocked.reason).toBe("attachment_capacity");
    expect(blocked.evidence.expansions).toBe(0);
    expect(blocked.unresolved).toContainEqual(expect.objectContaining({ resource: expect.objectContaining({ kind: "node_extent", axis: "x" }), minimumExtent: 240 }));
    const outcome = accepted(await runUiContractsRendererPipeline(growing, settings, { candidates: 64 }));
    expect(outcome.evidence.expansions).toBe(1);
    const group = growing.scopes.find(scope => scope.contracts.length)!.contracts[0]!;
    const items = new Map(uiSceneItems(outcome.revision.positionedScene.root).map(item => [item.id, item]));
    const source = items.get(group.source.id)!;
    expect([source.width, source.height]).toEqual([240, 53]);
    for (const depiction of growing.occurrences.filter(occurrence => occurrence.semanticId === "C-900" && occurrence.id !== source.id)) {
      const node = items.get(depiction.id);
      if (node) expect(node.width, depiction.id).toBe(224);
    }
    for (const port of source.ports) {
      expect(port.x).toBeGreaterThanOrEqual(0); expect(port.x).toBeLessThanOrEqual(source.width);
      expect(port.y).toBeGreaterThanOrEqual(0); expect(port.y).toBeLessThanOrEqual(source.height);
    }
    expect(source.ports.filter(port => port.side === "south")).toHaveLength(13);
    const minima = new Map<string, NodeMinimumExtent>([[source.id, { width: 240, height: 53 }]]);
    expect(measureRendererScene(outcome.revision.rendererScene, { minimumNodeExtents: minima })).toEqual(outcome.revision.measuredScene);
    expect(outcome.revision.positionedScene.root.viewMetadata!.uiContracts!.inventory!.relationships).toHaveLength(14);
  });

  it("resolves actual multiple-loop terminal demand without chasing a moving reservation", async () => {
    const east = (policy: UiContractsRoutingPolicy) => {
      policy.self_loop.traversal.axis = "y";
      policy.self_loop.side_trials = [{ side: "east", pair_placement: "nearest_feasible" }];
    };
    const fixed = await runUiContractsRendererPipeline(prepare(crowdedLoops, "fixed", east), settings, { candidates: 64 });
    expect(fixed.status).toBe("failed");
    if (fixed.status === "failed") expect(fixed.reason).toBe("attachment_capacity");
    const model = prepare(crowdedLoops, "port_minimum", east);
    const outcome = accepted(await runUiContractsRendererPipeline(model, settings, { candidates: 64 }));
    const occurrence = model.scopes[0]!.sequences[0]!.nodes[0]!;
    const node = uiSceneItems(outcome.revision.positionedScene.root).find(item => item.id === occurrence.id)!;
    expect(node.width).toBe(224);
    expect(node.height).toBeGreaterThan(53);
    expect(outcome.revision.positionedScene.edges).toHaveLength(2);
    expect(outcome.evidence.expansions).toBeLessThanOrEqual(2);
  });

  it("keeps an unrelated tall contract label out of crowded card dimensions", async () => {
    const unrelated = `Component C-901 "Other source"\n  BINDS_TO D-990 "Other data" field=${"long_unrelated_field_".repeat(12)}\nEND\nDataEntity D-990 "Other data"\nEND\n`;
    const baselineModel = prepare(crowdedFanout, "port_minimum"), changedModel = prepare(crowdedFanout + unrelated, "port_minimum");
    const baseline = accepted(await runUiContractsRendererPipeline(baselineModel, settings, { candidates: 128 }));
    const changed = accepted(await runUiContractsRendererPipeline(changedModel, settings, { candidates: 128 }));
    const sourceId = baselineModel.scopes.find(scope => scope.contracts.some(group => group.source.semanticId === "C-900"))!.contracts[0]!.source.id;
    const before = uiSceneItems(baseline.revision.positionedScene.root).find(item => item.id === sourceId)!;
    const after = uiSceneItems(changed.revision.positionedScene.root).find(item => item.id === sourceId)!;
    expect([after.width, after.height]).toEqual([before.width, before.height]);
    expect(after.ports.map(port => [port.id, port.x, port.y])).toEqual(before.ports.map(port => [port.id, port.x, port.y]));
    expect(changed.revision.positionedScene.edges.some(edge => edge.label && edge.label.height > 100)).toBe(true);
    const nodeRequests = changed.evidence.trials.flatMap(trial => trial.requirements).filter(request => request.resource.kind === "node_extent");
    expect(nodeRequests.every(request => request.minimumExtent === 240)).toBe(true);
  });
});
