import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { compileSource, loadBundle, validateGraph } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import { renderScenarioFlowStagedSvg } from "../src/renderer/staged/scenarioFlow.js";
import { renderSourcePreview } from "../src/renderer/previewWorkflow.js";
import * as core from "../src/renderer/staged/routingCore/index.js";
import { independentParallelConflicts } from "./routingHardeningOracle.js";
import { registerRendererTheme, resolveRendererTheme } from "../src/renderer/staged/theme.js";
import { markerRoutingClearance } from "../src/renderer/staged/markerGeometry.js";
import { flattenPositionedItems, routeIntersectsRect } from "./stagedVisualHarness.js";

const exact = "docs/sdd_app_planning/sdd_for_sdd.sdd";
async function inputContext(source: string) {
  const bundle = await loadBundle("bundle/v0.1/manifest.yaml"), input = { path: source, text: await readFile(source, "utf8") };
  const compiled = compileSource(input, bundle), graph = compiled.graph!;
  expect(validateGraph(graph, bundle, "simple").diagnostics.filter(d => d.severity === "error")).toEqual([]);
  return { bundle, input, graph, projection: projectView(graph, bundle, "scenario_flow").projection!, view: bundle.views.views.find(v => v.id === "scenario_flow")! };
}
afterEach(() => vi.restoreAllMocks());

describe("Scenario production final-resolution gate", () => {
  for (const source of [exact, "bundle/v0.1/examples/scenario_branching.sdd"]) for (const detailId of ["compact", "detailed"]) for (const mode of ["none", "type", "id", "type,id"] as const) {
    it(`${source} / simple / ${detailId} / ${mode}`, async () => {
      const c = await inputContext(source);
      const spy = vi.spyOn(core, "runRoutingLifecycle");
      const result = await renderScenarioFlowStagedSvg(c.projection, c.graph, c.view, { detailId, nodeDecoratorMode: { id: mode, showNodeType: mode.includes("type"), showNodeId: mode.includes("id") } });
      expect(spy).toHaveBeenCalled();
      expect(result.diagnostics.filter(d => d.severity === "error")).toEqual([]);

      const resolution = spy.mock.results.at(-1)!.value as core.FinalRoutingResult;
      expect(resolution.status, JSON.stringify(resolution)).toBe("resolved");
      if (resolution.status !== "resolved") throw Error(resolution.reason);
      if (source.endsWith("scenario_branching.sdd") && detailId === "compact") expect(resolution.trace.repairRevisions).toBeGreaterThan(0);
      const context = resolution.context;
      const byId = new Map(result.positionedScene.edges.map(e => [e.id, e]));
      const connectors = context.connectors.map(connector => ({ ...connector, route: byId.get(connector.id)!.route }));
      expect(core.validateFinalRouteSet({ ...context, connectors })).toEqual([]);
      expect(independentParallelConflicts(connectors)).toBe(0);
      for (const edge of connectors) {
        expect(edge.route.points[0]).toEqual(edge.source.point); expect(edge.route.points.at(-1)).toEqual(edge.target.point);
        for (const box of [...context.boxes, ...(context.blockers ?? [])]) expect(routeIntersectsRect(edge.route, box), `${edge.id} / ${box.id}`).toBe(false);
      }
    });
  }
  it("rejects an irreparable production context without publishing an artifact", async () => {
    const c = await inputContext(exact), actual = core.runRoutingLifecycle;
    const spy = vi.spyOn(core, "runRoutingLifecycle").mockImplementation(context => actual({ ...context, bounds: { ...context.bounds, maxX: context.bounds.minX }, connectors: context.connectors.map(connector => ({ ...connector,
      runConstraints: new Map(core.buildRoutingSegments(connector.id, connector.route, { logicalRunIds: core.buildLogicalRunIds(connector.route) }).map(s => [s.logicalRunId, { lockedCoordinate: s.coordinate, lockReason: "resource" as const }]))
    })) }));
    const result = await renderSourcePreview(c.input, c.bundle, { viewId: "scenario_flow", format: "svg", profileId: "simple", detailId: "detailed", nodeDecoratorModeId: "type,id" });
    expect(spy).toHaveBeenCalled(); expect(result.artifact).toBeUndefined();
    expect(result.diagnostics.some(d => d.severity === "error" && d.code.includes("routing"))).toBe(true);
  });
  it("uses one production expansion owner for measured marker capacity", async () => {
    const bundle = await loadBundle("bundle/v0.1/manifest.yaml");
    const graph = compileSource({ path: "scenario-capacity.sdd", text: `SDD-TEXT 0.1
Step J-100 "Begin"
  PRECEDES J-101 "Finish"
END
Step J-101 "Finish"
END
` }, bundle).graph!;
    const projection = projectView(graph, bundle, "scenario_flow").projection!;
    const view = bundle.views.views.find(v => v.id === "scenario_flow")!;
    const theme = structuredClone(resolveRendererTheme("default").theme);
    theme.id = "scenario-marker-capacity"; theme.paint.arrowSize = 240; registerRendererTheme(theme);
    const spy = vi.spyOn(core, "runRoutingLifecycle");
    const result = await renderScenarioFlowStagedSvg(projection, graph, view, {
      themeId: theme.id, detailId: "compact", nodeDecoratorMode: { id: "none", showNodeType: false, showNodeId: false }
    });
    const resolution = spy.mock.results[0]!.value as core.FinalRoutingResult;
    expect(resolution.status, JSON.stringify(resolution)).toBe("resolved");
    expect(resolution.trace.expansionPasses).toBeGreaterThan(0);
    expect(result.diagnostics.filter(d => d.severity === "error")).toEqual([]);
    if (resolution.status === "resolved") expect(core.validateFinalRouteSet(resolution.context)).toEqual([]);
    const initial = spy.mock.calls[0]![0];
    expect(8 - initial.policy!.maxExpansionPasses! + resolution.trace.expansionPasses).toBeLessThanOrEqual(8);
  });
  it("derives clearance from the painted marker footprint", () => {
    expect(markerRoutingClearance("none", 30, 2)).toBe(0);
    expect(markerRoutingClearance("arrow", 10, 2)).toBe(12);
    expect(markerRoutingClearance("arrow", 30, 2)).toBe(30);
  });
});
