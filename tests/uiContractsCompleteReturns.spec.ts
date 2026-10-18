import { writeFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { compileSource, loadBundle, validateLoadedBundle } from "../src/index.js";
import { resolveUiContractsPresentation } from "../src/bundle/uiContractsPresentation.js";
import type { Bundle } from "../src/bundle/types.js";
import { prepareCompiledGraphPreview } from "../src/renderer/previewWorkflow.js";
import { wrappedLabelPreservesText } from "../src/renderer/staged/connectorLabelLayout.js";
import { auditUiContractsScene, uiRoutingContext, uiSceneItems } from "../src/renderer/staged/uiContractsAcceptance.js";
import { runUiContractsRendererPipeline } from "../src/renderer/staged/uiContractsPipeline.js";
import { validateFinalRouteSet } from "../src/renderer/staged/routingCore/lifecycle.js";
import { testUiRoutingPolicy } from "./uiContractsRoutingTestSupport.js";

const settings = { detailId: "compact", nodeDecoratorMode: { id: "type,id", showNodeType: true, showNodeId: true } };
function source(edges: readonly (readonly [number, number])[], labelled: boolean) {
  return { path: "ui_contracts_complete_returns.sdd", text: `SDD-TEXT 0.2
Place P-900 "Return transitions"
  route_or_key=/returns
  access=public
${[0, 1, 2].map(index => `  CONTAINS VS-90${index} "State ${index}"`).join("\n")}
END
${[0, 1, 2].map(index => `ViewState VS-90${index} "State ${index}"
  place_id=P-900
${edges.filter(([from]) => from === index).map(([from, to]) => `  TRANSITIONS_TO VS-90${to} "State ${to}"${labelled ? ` [Move${from}${to}]` : ""}`).join("\n")}
END
`).join("")}` };
}

describe("production complete return routes", () => {
  let original: Bundle;
  beforeAll(async () => { original = await loadBundle("bundle/v0.2/manifest.yaml"); });
  async function render(edges: readonly (readonly [number, number])[], labelled: boolean) {
    const bundle = structuredClone(original);
    const view = bundle.views.views.find(view => view.id === "ui_contracts")!;
    const policy = structuredClone(testUiRoutingPolicy);
    policy.capacity.node = "port_minimum";
    view.conventions.renderer_defaults!.ui_contracts_presentation!.routing = policy;
    resolveUiContractsPresentation(view);
    validateLoadedBundle(bundle);
    const input = source(edges, labelled), compiled = compileSource(input, bundle);
    expect(compiled.diagnostics).toEqual([]);
    const prepared = prepareCompiledGraphPreview(input.path, compiled.graph!, bundle, {
      viewId: "ui_contracts", format: "svg", profileId: "simple", detailId: "compact", nodeDecoratorModeId: "type,id"
    });
    expect(prepared.diagnostics).toEqual([]);
    const model = prepared.prepared!.presentationModel!;
    const outcome = await runUiContractsRendererPipeline(model, settings, { candidates: 128, expansions: 4 });
    if (outcome.status === "failed") await writeFile(`/tmp/ui-returns-failure-${labelled}.json`, JSON.stringify(outcome, null, 2));
    expect(outcome.status, JSON.stringify(outcome.status === "failed" ? {
      reason: outcome.reason, violations: outcome.violations, unresolved: outcome.unresolved,
      consumed: { candidates: outcome.evidence.candidates, repairs: outcome.evidence.repairs, expansions: outcome.evidence.expansions }
    } : outcome.evidence)).toBe("accepted");
    if (outcome.status !== "accepted") throw new Error("Expected complete return routing");
    const scene = outcome.revision.positionedScene, inventory = scene.root.viewMetadata!.uiContracts!.inventory!;
    expect(scene.edges).toHaveLength(edges.length);
    expect(scene.edges.filter(edge => edge.markers?.end === "arrow")).toHaveLength(edges.length);
    expect(inventory.relationships).toHaveLength(model.relationships.length);
    const connectors = inventory.relationships.filter(relationship => !relationship.structural);
    expect(connectors).toHaveLength(edges.length);
    for (const relationship of connectors) {
      expect(relationship.segmentIds).toHaveLength(1);
      expect(relationship.paths).toHaveLength(1);
      expect(relationship.paths![0]!.segments).toEqual([{ id: relationship.segmentIds[0], reverse: false }]);
      const edge = scene.edges.find(edge => edge.id === relationship.segmentIds[0])!;
      const expected = model.relationships.find(candidate => candidate.id === relationship.id)!;
      if (expected.label) expect(wrappedLabelPreservesText(edge.label!.lines, expected.label)).toBe(true);
      const binding = scene.uiRoutingBindings!.find(binding => binding.id === edge.id)!;
      expect(edge.route.points[0]).toEqual(binding.source.point);
      expect(edge.route.points.at(-1)).toEqual(binding.target.point);
      const items = new Map(uiSceneItems(scene.root).map(item => [item.id, item]));
      for (const endpoint of [binding.source, binding.target]) {
        const node = items.get(endpoint.nodeId)!, port = node.ports.find(port => port.id === endpoint.portId)!;
        expect(endpoint.point).toEqual({ x: node.x + port.x, y: node.y + port.y });
        expect(endpoint.side).toBe(port.side);
      }
    }
    expect(validateFinalRouteSet(uiRoutingContext(scene))).toEqual([]);
    expect(auditUiContractsScene(scene)).toEqual([]);
    return { scene, model };
  }

  it.each([false, true])("rebuilds aligned facing endpoints before freezing a three-state cycle (labels=%s)", async labelled => {
    const { scene, model } = await render([[0, 1], [1, 0], [2, 1]], labelled);
    const sequence = model.scopes[0]!.sequences[0]!;
    const first = sequence.nodes.find(node => node.semanticId === "VS-900")!;
    const second = sequence.nodes.find(node => node.semanticId === "VS-901")!;
    const aligned = scene.edges.find(edge => edge.from.itemId === first.id && edge.to.itemId === second.id)!;
    expect(aligned.from.y).toBe(aligned.to.y);
    expect(aligned.route.points).toEqual([{ x: aligned.from.x, y: aligned.from.y }, { x: aligned.to.x, y: aligned.to.y }]);
    const arrivals = scene.uiRoutingBindings!.filter(binding => binding.target.nodeId === second.id).map(binding => binding.target);
    expect(arrivals).toHaveLength(2);
    expect(new Set(arrivals.map(endpoint => endpoint.portId)).size).toBe(2);
    expect(new Set(arrivals.map(endpoint => endpoint.point.y)).size).toBe(2);
  });

  it.each([false, true])("routes two ordinary returns as complete nonoverlapping polylines (labels=%s)", async labelled => {
    const { scene } = await render([[0, 1], [1, 2], [2, 0], [2, 1]], labelled);
    const returns = scene.edges.filter(edge => edge.viewMetadata?.uiTransition?.kind === "return");
    expect(returns).toHaveLength(2);
    for (const edge of returns) expect(edge.route.points.length).toBeGreaterThanOrEqual(4);
    const starts = returns.map(edge => [edge.from.x, edge.from.y].join(","));
    expect(new Set(starts).size).toBe(2);
  });
});
