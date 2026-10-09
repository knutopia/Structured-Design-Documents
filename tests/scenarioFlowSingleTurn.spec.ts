import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { compileSource, loadBundle, validateGraph } from "../src/index.js";
import { projectDiagram } from "../src/projector/projectView.js";
import { renderScenarioFlowStagedSvg } from "../src/renderer/staged/scenarioFlow.js";
import * as core from "../src/renderer/staged/routingCore/index.js";

async function context(text: string) {
  const bundle = await loadBundle("bundle/v0.2/manifest.yaml");
  const compiled = compileSource({ path: "scenario-single-turn.sdd", text }, bundle);
  expect(compiled.diagnostics.filter(diagnostic => diagnostic.severity === "error")).toEqual([]);
  const graph = compiled.graph!;
  expect(validateGraph(graph, bundle, "simple").diagnostics.filter(diagnostic => diagnostic.severity === "error")).toEqual([]);
  const projected = projectDiagram(graph, bundle, "DG-001");
  expect(projected.diagnostics.filter(diagnostic => diagnostic.severity === "error")).toEqual([]);
  const projection = projected.projection!;
  const view = bundle.views.views.find(candidate => candidate.id === projection.view_id)!;
  return { graph, projection, view };
}

afterEach(() => vi.restoreAllMocks());

describe("Scenario south-to-west single-turn routing", () => {
  it("retains a legal detour for a backward destination", async () => {
    const c = await context(`SDD-TEXT 0.2
ScenarioStep S-001 "First"
  PRECEDES S-002 {Continue} diagrams=DG-001
END
ScenarioStep S-002 "Second"
  PRECEDES S-003 {Continue} diagrams=DG-001
END
ScenarioStep S-003 "Third"
  PRECEDES S-001 {Return} diagrams=DG-001
END
Diagram DG-001 "Backward proof"
  diagram_type=scenario_flow
END`);
    const spy = vi.spyOn(core, "runRoutingLifecycle");
    const rendered = await renderScenarioFlowStagedSvg(c.projection, c.graph, c.view, { detailId: "compact" });
    expect(rendered.diagnostics.filter(diagnostic => diagnostic.severity === "error")).toEqual([]);
    // A cycle deliberately uses the renderer's deterministic source-order chronology.
    expect(rendered.diagnostics.map(diagnostic => diagnostic.code)).toEqual(["renderer.scene.scenario_flow_step_cycle"]);
    const edge = rendered.positionedScene.edges.find(candidate => candidate.from.itemId === "S-003"
      && candidate.to.itemId === "S-001")!;
    expect(edge.from.portId).toBe("flow_out_south");
    expect(edge.to.portId).toBe("flow_in");
    expect(edge.to.x).toBeLessThan(edge.from.x);
    expect(edge.route.points.length).toBeGreaterThan(3);
    const [first, second] = edge.route.points;
    const penultimate = edge.route.points.at(-2)!;
    expect(second!.x).toBe(first!.x);
    expect(second!.y).toBeGreaterThan(first!.y);
    expect(penultimate.x).toBeLessThan(edge.to.x);
    expect(penultimate.y).toBe(edge.to.y);
    const revision = rendered.routingStages.labelLayoutTrace.selectedRevision;
    const accepted = spy.mock.results[revision]!.value as core.FinalRoutingResult;
    expect(accepted.status).toBe("resolved");
    if (accepted.status !== "resolved") throw new Error(accepted.reason);
    const edges = new Map(rendered.positionedScene.edges.map(candidate => [candidate.id, candidate]));
    expect(core.validateFinalRouteSet({ ...accepted.context, connectors: accepted.context.connectors.map(connector => ({
      ...connector, route: edges.get(connector.id)!.route
    })) })).toEqual([]);
  });

  it("repairs a proposed single turn when its horizontal leg is blocked", async () => {
    const c = await context(await readFile("tests/fixtures/render/scenario_overlap_reconvergence.sdd", "utf8"));
    const actual = core.runRoutingLifecycle;
    const blockedInputs: core.FinalRoutingContext[] = [];
    const spy = vi.spyOn(core, "runRoutingLifecycle").mockImplementation((input, options) => {
      const connector = input.connectors.find(candidate => candidate.source.nodeId === "S-002"
        && candidate.target.nodeId === "S-004")!;
      const blocked: core.FinalRoutingContext = { ...input, blockers: [...(input.blockers ?? []), {
        id: "reserved-single-turn-corridor",
        x: (connector.source.point.x + connector.target.point.x) / 2 - 1,
        y: connector.target.point.y - 1,
        width: 2, height: 2, clearance: 0,
        appliesToConnectorIds: [connector.id]
      }] };
      blockedInputs.push(blocked);
      return actual(blocked, options);
    });
    const rendered = await renderScenarioFlowStagedSvg(c.projection, c.graph, c.view, { detailId: "detailed" });
    expect(rendered.diagnostics).toEqual([]);
    const firstInput = blockedInputs[0]!;
    const firstConnector = firstInput.connectors.find(connector => connector.source.nodeId === "S-002"
      && connector.target.nodeId === "S-004")!;
    expect(firstConnector.source.side).toBe("south");
    expect(firstConnector.route.points).toEqual([
      firstConnector.source.point,
      { x: firstConnector.source.point.x, y: firstConnector.target.point.y },
      firstConnector.target.point
    ]);
    expect(core.validateFinalRouteSet(firstInput)).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "node_intersection", boxId: "reserved-single-turn-corridor",
        connectorIds: [firstConnector.id] })
    ]));
    const revision = rendered.routingStages.labelLayoutTrace.selectedRevision;
    const accepted = spy.mock.results[revision]!.value as core.FinalRoutingResult;
    expect(accepted.status).toBe("resolved");
    if (accepted.status !== "resolved") throw new Error(accepted.reason);
    const edges = new Map(rendered.positionedScene.edges.map(edge => [edge.id, edge]));
    const detour = edges.get(firstConnector.id)!;
    expect(detour.route.points.length).toBeGreaterThan(3);
    expect(accepted.context.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "reserved-single-turn-corridor" })
    ]));
    expect(core.validateFinalRouteSet({ ...accepted.context, connectors: accepted.context.connectors.map(connector => ({
      ...connector, route: edges.get(connector.id)!.route
    })) })).toEqual([]);
    expect(rendered.routingStages.labelLayoutTrace.unresolvedLabelIds).toEqual([]);
    expect(rendered.positionedScene.edges.filter(edge => edge.label).map(edge => edge.id)).toEqual(
      rendered.measuredScene.edges.filter(edge => edge.label).map(edge => edge.id)
    );
    // Independent final association calculation, including vertical supporting segments.
    for (const edge of rendered.positionedScene.edges.filter(edge => edge.label)) {
      const label = edge.label!;
      expect(edge.route.points.slice(1).some((end, index) => {
        const start = edge.route.points[index]!;
        const axis = start.y === end.y ? "x" : "y";
        const extent = axis === "x" ? label.width : label.height;
        const low = Math.min(start[axis], end[axis]), high = Math.max(start[axis], end[axis]);
        const overlap = Math.min(high, label[axis] + extent) - Math.max(low, label[axis]);
        const dx = Math.max(label.x - Math.max(start.x, end.x), Math.min(start.x, end.x) - label.x - label.width, 0);
        const dy = Math.max(label.y - Math.max(start.y, end.y), Math.min(start.y, end.y) - label.y - label.height, 0);
        return high - low > 0.5 && overlap >= Math.min(24, extent, high - low) - 0.5 && Math.hypot(dx, dy) <= 12.5;
      }), edge.id).toBe(true);
    }
  });
});
