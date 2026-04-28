import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import {
  renderScenarioFlowRoutingDebugArtifacts,
  renderScenarioFlowStagedSvg
} from "../src/renderer/staged/scenarioFlow.js";
import type { PositionedEdge } from "../src/renderer/staged/contracts.js";
import {
  collectEdgeLabelBoxes,
  collectVisibleItemBoxes,
  expectLabelsDoNotOverlapBoxes,
  expectLabelsDoNotOverlapEachOther,
  expectNoForbiddenDiagnostics,
  expectNoRouteIntersectionsWithNonEndpointBoxes,
  expectRoutesDoNotEnterEndpointBoxes,
  expectSameOrientationSegmentsSeparated,
  getEdgeById
} from "./stagedVisualHarness.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

async function resolveScenarioFlowContext(fileName: string) {
  const bundle = await loadBundle(manifestPath);
  const view = bundle.views.views.find((candidate) => candidate.id === "scenario_flow");
  if (!view) {
    throw new Error("Could not resolve the scenario_flow view.");
  }

  const filePath = path.join(repoRoot, "bundle/v0.1/examples", fileName);
  const input = {
    path: filePath,
    text: await readFile(filePath, "utf8")
  };
  const compiled = compileSource(input, bundle);
  expect(compiled.diagnostics).toEqual([]);
  if (!compiled.graph) {
    throw new Error(`Could not compile ${input.path}.`);
  }

  const projected = projectView(compiled.graph, bundle, "scenario_flow");
  expect(projected.diagnostics).toEqual([]);
  if (!projected.projection) {
    throw new Error(`Could not project ${input.path} to scenario_flow.`);
  }

  return {
    graph: compiled.graph,
    projection: projected.projection,
    view
  };
}

function edgeIds(edges: readonly PositionedEdge[]): string[] {
  return edges.map((edge) => edge.id);
}

function routeSegments(edge: PositionedEdge): Array<{
  start: { x: number; y: number };
  end: { x: number; y: number };
  orientation: "horizontal" | "vertical";
  length: number;
}> {
  const segments: Array<{
    start: { x: number; y: number };
    end: { x: number; y: number };
    orientation: "horizontal" | "vertical";
    length: number;
  }> = [];

  for (let index = 1; index < edge.route.points.length; index += 1) {
    const start = edge.route.points[index - 1]!;
    const end = edge.route.points[index]!;
    if (Math.abs(start.x - end.x) <= 0.5) {
      segments.push({
        start,
        end,
        orientation: "vertical",
        length: Math.abs(end.y - start.y)
      });
    } else if (Math.abs(start.y - end.y) <= 0.5) {
      segments.push({
        start,
        end,
        orientation: "horizontal",
        length: Math.abs(end.x - start.x)
      });
    }
  }

  return segments.filter((segment) => segment.length > 0.5);
}

function expectDirectVerticalRoute(edge: PositionedEdge): void {
  const segments = routeSegments(edge);
  expect(segments.length).toBe(1);
  expect(segments[0]?.orientation).toBe("vertical");
}

function expectVerticalSwerveRoute(edge: PositionedEdge): void {
  const segments = routeSegments(edge);
  expect(segments[0]?.orientation).toBe("vertical");
  expect(segments[0]?.length).toBeGreaterThan(16);
  expect(segments.some((segment) => segment.orientation === "horizontal")).toBe(true);
  expect(edge.route.points[0]?.x).toBe(edge.route.points.at(-1)?.x);
}

function maxExpansion(expansions: Record<number, number>): number {
  return Math.max(0, ...Object.values(expansions));
}

function maxVerticalSegmentX(edge: PositionedEdge): number {
  const xCoordinates = routeSegments(edge)
    .filter((segment) => segment.orientation === "vertical")
    .map((segment) => segment.start.x);
  return Math.max(...xCoordinates);
}

describe("scenario_flow staged routing", () => {
  it("routes proof-case connectors through explicit scenario-flow ports with deterministic priority", async () => {
    const context = await resolveScenarioFlowContext("scenario_branching.sdd");
    const rendered = await renderScenarioFlowStagedSvg(
      context.projection,
      context.graph,
      context.view,
      "strict"
    );

    expectNoForbiddenDiagnostics(rendered.diagnostics, [
      "renderer.routing.scenario_flow_unresolved_port",
      "renderer.routing.unresolved_port",
      "renderer.routing.scenario_flow_node_intersection",
      "renderer.routing.scenario_flow_label_fallback"
    ]);

    const firstPrecedes = getEdgeById(rendered.positionedScene.edges, "J-030__precedes__J-031");
    const firstRealization = getEdgeById(rendered.positionedScene.edges, "J-030__realized_by__P-030");
    expect(firstPrecedes.from.portId).toBe("flow_out");
    expect(firstPrecedes.to.portId).toBe("flow_in");
    expect(firstRealization.from.portId).toBe("realization_out");
    expect(firstRealization.to.portId).toBe("realization_in");

    const connectorIds = rendered.routingStages.connectorPlans.map((plan) => plan.id);
    const firstRealizationIndex = connectorIds.findIndex((id) => id.includes("__realized_by__"));
    const lastPrecedesIndex = connectorIds.map((id, index) => ({ id, index }))
      .filter(({ id }) => id.includes("__precedes__"))
      .at(-1)?.index;
    expect(firstRealizationIndex).toBeGreaterThan(lastPrecedesIndex ?? -1);
    expect(firstPrecedes.classes).toContain("edge-channel-step_flow");
    expect(firstRealization.classes).toContain("edge-channel-realization");
    expect(firstRealization.classes).toContain("edge-dotted");
    expect(rendered.routingStages.connectorPlans.find((plan) => plan.id === firstRealization.id)?.pattern)
      .toBe("realization_vertical");
    expectDirectVerticalRoute(firstRealization);
  });

  it("keeps same-column realization routing vertical and swerves only around blockers", async () => {
    const context = await resolveScenarioFlowContext("scenario_branching.sdd");
    const rendered = await renderScenarioFlowStagedSvg(
      context.projection,
      context.graph,
      context.view,
      "strict"
    );

    expect(rendered.routingStages.connectorPlans
      .filter((plan) => plan.channel === "realization")
      .map((plan) => plan.pattern)).toEqual(
        rendered.routingStages.connectorPlans
          .filter((plan) => plan.channel === "realization")
          .map(() => "realization_vertical")
      );

    const direct = getEdgeById(rendered.positionedScene.edges, "J-030__realized_by__P-030");
    expectDirectVerticalRoute(direct);
    expect(rendered.routingStages.gutterOccupancy).toEqual(expect.arrayContaining([
      expect.objectContaining({
        connectorId: "J-030__realized_by__P-030",
        key: "node:J-030:bottom",
        kind: "node_bottom",
        endpointRole: "source",
        locked: true
      }),
      expect.objectContaining({
        connectorId: "J-030__realized_by__P-030",
        key: "edge:P-030:north:target",
        kind: "edge_local",
        endpointRole: "target",
        locked: true
      })
    ]));
    expect(rendered.routingStages.gutterOccupancy.some((entry) =>
      entry.connectorId === "J-030__realized_by__P-030" && entry.kind === "column"
    )).toBe(false);

    expectVerticalSwerveRoute(getEdgeById(rendered.positionedScene.edges, "J-030__realized_by__VS-030a"));
    expectVerticalSwerveRoute(getEdgeById(rendered.positionedScene.edges, "J-032__realized_by__P-032"));

    const j030VsOccupancy = rendered.routingStages.gutterOccupancy.filter((entry) =>
      entry.connectorId === "J-030__realized_by__VS-030a"
    );
    const obstacleEastOccupancy = j030VsOccupancy.find((entry) => entry.key === "obstacle:P-030:east");
    expect(obstacleEastOccupancy).toEqual(expect.objectContaining({
      kind: "obstacle_east"
    }));
    expect(j030VsOccupancy.some((entry) =>
      entry.kind === "column" && entry.routeSegmentIndex === obstacleEastOccupancy?.routeSegmentIndex
    )).toBe(false);

    const j030Vs030a = getEdgeById(rendered.positionedScene.edges, "J-030__realized_by__VS-030a");
    const p030P032 = getEdgeById(rendered.positionedScene.edges, "P-030__navigates_to__P-032");
    expect(maxVerticalSegmentX(j030Vs030a)).toBeLessThan(maxVerticalSegmentX(p030P032));
    expect(maxExpansion(rendered.routingStages.globalGutterState.columnExpansions)).toBeLessThanOrEqual(64);
    expect(maxExpansion(rendered.routingStages.globalGutterState.laneExpansions)).toBeLessThanOrEqual(64);
    expect(rendered.routingStages.finalPositionedScene.root.width)
      .toBeLessThanOrEqual(rendered.routingStages.step3PositionedScene.root.width + 128);
    expect(rendered.routingStages.finalPositionedScene.root.height)
      .toBeLessThanOrEqual(rendered.routingStages.step3PositionedScene.root.height + 160);
  });

  it("routes mirror connectors at lower priority than Step flow without crossing proof-case nodes", async () => {
    const context = await resolveScenarioFlowContext("scenario_branching.sdd");
    const rendered = await renderScenarioFlowStagedSvg(
      context.projection,
      context.graph,
      context.view,
      "strict"
    );
    const ids = edgeIds(rendered.positionedScene.edges);
    const stepFlowIndex = ids.findIndex((id) => id === "J-030__precedes__J-031");
    const navigationIndex = ids.findIndex((id) => id === "P-030__navigates_to__P-031");
    const transitionIndex = ids.findIndex((id) => id === "VS-030a__transitions_to__VS-031a");
    expect(stepFlowIndex).toBeGreaterThanOrEqual(0);
    expect(navigationIndex).toBeGreaterThan(stepFlowIndex);
    expect(transitionIndex).toBeGreaterThan(navigationIndex);
    expect(getEdgeById(rendered.positionedScene.edges, "P-030__navigates_to__P-031").from.portId).toBe("mirror_out");
    expect(getEdgeById(rendered.positionedScene.edges, "VS-030a__transitions_to__VS-031a").from.portId).toBe("mirror_out");

    const boxes = collectVisibleItemBoxes(rendered.positionedScene.root)
      .filter((box) => box.itemId !== "root");
    expectNoRouteIntersectionsWithNonEndpointBoxes(rendered.positionedScene.edges, boxes);
    expectRoutesDoNotEnterEndpointBoxes(rendered.positionedScene.edges, boxes);
    expectSameOrientationSegmentsSeparated(rendered.positionedScene.edges);
  });

  it("places branch labels for strict and permissive profiles and hides them for simple", async () => {
    const context = await resolveScenarioFlowContext("scenario_branching.sdd");
    const strict = await renderScenarioFlowStagedSvg(
      context.projection,
      context.graph,
      context.view,
      "strict"
    );
    const permissive = await renderScenarioFlowStagedSvg(
      context.projection,
      context.graph,
      context.view,
      "permissive"
    );
    const simple = await renderScenarioFlowStagedSvg(
      context.projection,
      context.graph,
      context.view,
      "simple"
    );

    expect(strict.positionedScene.edges.filter((edge) => edge.label).map((edge) => edge.id)).toEqual([
      "J-030__precedes__J-031",
      "J-030__precedes__J-032",
      "J-033__precedes__J-034",
      "J-033__precedes__J-035"
    ]);
    expect(permissive.positionedScene.edges.filter((edge) => edge.label).length).toBe(4);
    expect(simple.positionedScene.edges.filter((edge) => edge.label)).toEqual([]);

    const labels = collectEdgeLabelBoxes(strict.positionedScene.edges);
    const boxes = collectVisibleItemBoxes(strict.positionedScene.root).filter((box) => box.itemId !== "root");
    expectLabelsDoNotOverlapBoxes(labels, boxes);
    expectLabelsDoNotOverlapEachOther(labels);
  });

  it("returns step-2 and step-3 routing debug scenes, SVG, and PNG bytes", async () => {
    const context = await resolveScenarioFlowContext("scenario_branching.sdd");
    const debug = await renderScenarioFlowRoutingDebugArtifacts(
      context.projection,
      context.graph,
      context.view,
      "strict"
    );

    expect(debug.step2PositionedScene.edges.length).toBeGreaterThan(0);
    expect(debug.step3PositionedScene.edges.length).toBeGreaterThan(0);
    expect(debug.routingStages.gutterOccupancy.length).toBeGreaterThan(0);
    const j030Buckets = debug.routingStages.nodeEdgeBuckets.find((bucket) => bucket.nodeId === "J-030");
    expect(j030Buckets?.east.startingConnectorIds.length).toBeGreaterThan(0);
    expect(debug.routingStages.nodeGutters.some((gutter) =>
      gutter.nodeId === "J-030" && gutter.rightAvailable > 0 && gutter.bottomAvailable > 0
    )).toBe(true);
    expect(maxExpansion(debug.routingStages.globalGutterState.columnExpansions)).toBeLessThanOrEqual(64);
    expect(maxExpansion(debug.routingStages.globalGutterState.laneExpansions)).toBeLessThanOrEqual(64);
    expect(debug.routingStages.finalPositionedScene.root.width)
      .toBeLessThanOrEqual(debug.routingStages.step3PositionedScene.root.width + 128);
    expect(debug.routingStages.finalPositionedScene.root.height)
      .toBeLessThanOrEqual(debug.routingStages.step3PositionedScene.root.height + 160);
    expect(debug.routingStages.gutterOccupancy.some((entry) =>
      entry.key === "node:J-030:right"
      && entry.kind === "node_right"
      && entry.columnOrder !== undefined
      && entry.routeSegmentIndex !== undefined
    )).toBe(true);
    expect(debug.step2Svg).toContain("scenario_flow_semantic_edge");
    expect(debug.step3Svg).toContain("scenario_flow_semantic_edge");
    expect(debug.step2Png.byteLength).toBeGreaterThan(0);
    expect(debug.step3Png.byteLength).toBeGreaterThan(0);
  });
});
