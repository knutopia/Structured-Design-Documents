import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { compileSource, loadBundle, validateGraph } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import { renderOutcomeOpportunityMapStagedSvg } from "../src/renderer/staged/outcomeOpportunityMap.js";
import { renderSourcePreview } from "../src/renderer/previewWorkflow.js";
import * as core from "../src/renderer/staged/routingCore/index.js";
import { independentParallelConflicts } from "./routingHardeningOracle.js";
import { markerRoutingClearance } from "../src/renderer/staged/markerGeometry.js";
import { flattenPositionedItems, routeIntersectsRect } from "./stagedVisualHarness.js";

const exact = "docs/sdd_app_planning/sdd_for_sdd.sdd";
async function inputContext(source: string) {
  const bundle = await loadBundle("bundle/v0.1/manifest.yaml"), input = { path: source, text: await readFile(source, "utf8") };
  const compiled = compileSource(input, bundle), graph = compiled.graph!;
  expect(validateGraph(graph, bundle, "simple").diagnostics.filter(d => d.severity === "error")).toEqual([]);
  return { bundle, input, graph, projection: projectView(graph, bundle, "outcome_opportunity_map").projection!, view: bundle.views.views.find(v => v.id === "outcome_opportunity_map")! };
}
afterEach(() => vi.restoreAllMocks());

describe("Outcome production final-resolution gate", () => {
  for (const source of [exact, "bundle/v0.1/examples/multiple_outcomes.sdd"]) for (const detailId of ["compact", "detailed"]) for (const mode of ["none", "type", "id", "type,id"] as const) {
    it(`${source} / simple / ${detailId} / ${mode}`, async () => {
      const c = await inputContext(source);
      const spy = vi.spyOn(core, "runRoutingLifecycle");
      const result = await renderOutcomeOpportunityMapStagedSvg(c.projection, c.graph, c.view, { detailId, nodeDecoratorMode: { id: mode, showNodeType: mode.includes("type"), showNodeId: mode.includes("id") } });
      expect(spy).toHaveBeenCalled();
      expect(result.diagnostics.filter(d => d.severity === "error")).toEqual([]);
      if (source === exact) expect(result.routingStages.finalResolutionTrace.repairRevisions).toBeGreaterThan(0);
      const context = spy.mock.calls.at(-1)![0];
      const byId = new Map(result.positionedScene.edges.map(e => [e.id, e]));
      const planById = new Map(result.routingStages.connectorPlans.map(p => [p.id, p]));
      const connectors = context.connectors.map(connector => ({ ...connector, route: byId.get(planById.get(connector.id)!.edgeId)!.route }));
      expect(core.validateFinalRouteSet({ ...context, connectors })).toEqual([]);
      expect(independentParallelConflicts(connectors)).toBe(0);
      for (const edge of connectors) {
        expect(edge.route.points[0]).toEqual(edge.source.point); expect(edge.route.points.at(-1)).toEqual(edge.target.point);
        for (const box of context.boxes) expect(routeIntersectsRect(edge.route, box), `${edge.id} / ${box.id}`).toBe(false);
      }
      if (source === exact && detailId === "detailed" && mode === "type,id") {
        const baseline: core.FinalRoutingContext = JSON.parse(await readFile("tests/fixtures/render/routing_hardening_captured_outcome.json", "utf8"));
        expect(context.bounds).toEqual(baseline.bounds);
        expect(context.boxes.map(({ id, x, y, width, height }) => ({ id, x, y, width, height })).sort((a,b)=>a.id.localeCompare(b.id)))
          .toEqual([...baseline.boxes].sort((a,b)=>a.id.localeCompare(b.id)));
        for (const edge of result.positionedScene.edges) {
          const old = baseline.connectors.find(c => c.id === edge.id)!;
          expect({ x: edge.from.x, y: edge.from.y }).toEqual(old.source.point);
          expect({ x: edge.to.x, y: edge.to.y }).toEqual(old.target.point);
        }
      }
    });
  }
  it("rejects an irreparable production context without publishing an artifact", async () => {
    const c = await inputContext(exact), actual = core.runRoutingLifecycle;
    const spy = vi.spyOn(core, "runRoutingLifecycle").mockImplementation(context => actual({ ...context, connectors: context.connectors.map(connector => ({ ...connector,
      runConstraints: new Map(core.buildRoutingSegments(connector.id, connector.route, { logicalRunIds: core.buildLogicalRunIds(connector.route) }).map(s => [s.logicalRunId, { lockedCoordinate: s.coordinate, lockReason: "resource" as const }]))
    })) }));
    const result = await renderSourcePreview(c.input, c.bundle, { viewId: "outcome_opportunity_map", format: "svg", profileId: "simple", detailId: "detailed", nodeDecoratorModeId: "type,id" });
    expect(spy).toHaveBeenCalled(); expect(result.artifact).toBeUndefined();
    expect(result.diagnostics.some(d => d.severity === "error" && d.code.includes("track_separation"))).toBe(true);
  });
  it("derives clearance from the painted marker footprint", () => {
    expect(markerRoutingClearance("none", 30, 2)).toBe(0);
    expect(markerRoutingClearance("arrow", 10, 2)).toBe(12);
    expect(markerRoutingClearance("arrow", 30, 2)).toBe(30);
  });
});
