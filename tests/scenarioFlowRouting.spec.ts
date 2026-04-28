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
import type { PositionedEdge, PositionedScene } from "../src/renderer/staged/contracts.js";
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
const FIXED_SEPARATION_DISTANCE = 16;
const OBSTACLE_SWERVE_CLEARANCE = 18;
const ROOT_RIGHT_GUTTER = 28;

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
  segmentIndex: number;
}> {
  const segments: Array<{
    start: { x: number; y: number };
    end: { x: number; y: number };
    orientation: "horizontal" | "vertical";
    length: number;
    segmentIndex: number;
  }> = [];

  for (let index = 1; index < edge.route.points.length; index += 1) {
    const start = edge.route.points[index - 1]!;
    const end = edge.route.points[index]!;
    if (Math.abs(start.x - end.x) <= 0.5) {
      segments.push({
        start,
        end,
        orientation: "vertical",
        length: Math.abs(end.y - start.y),
        segmentIndex: index - 1
      });
    } else if (Math.abs(start.y - end.y) <= 0.5) {
      segments.push({
        start,
        end,
        orientation: "horizontal",
        length: Math.abs(end.x - start.x),
        segmentIndex: index - 1
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

function maxRouteX(scene: PositionedScene): number {
  return Math.max(0, ...scene.edges.flatMap((edge) => [
    ...edge.route.points.map((point) => point.x),
    ...(edge.label ? [edge.label.x + edge.label.width] : [])
  ]));
}

function getLaneSeparatorEndX(scene: PositionedScene, separatorId: string): number {
  const separator = scene.decorations.find((decoration) => decoration.kind === "line" && decoration.id === separatorId);
  if (!separator || separator.kind !== "line") {
    throw new Error(`Could not find lane separator "${separatorId}".`);
  }
  return separator.to.x;
}

function getFirstHorizontalSegment(edge: PositionedEdge): ReturnType<typeof routeSegments>[number] {
  const segment = routeSegments(edge).find((candidate) => candidate.orientation === "horizontal");
  if (!segment) {
    throw new Error(`Edge "${edge.id}" does not have a horizontal segment.`);
  }
  return segment;
}

function getSingleBypassSegmentSpanningNodes(
  edge: PositionedEdge,
  boxesById: ReadonlyMap<string, { x: number; y: number; width: number; height: number }>,
  blockerIds: readonly string[]
): ReturnType<typeof routeSegments>[number] {
  const blockers = blockerIds.map((blockerId) => {
    const blocker = boxesById.get(blockerId);
    if (!blocker) {
      throw new Error(`Could not find blocker "${blockerId}".`);
    }
    return blocker;
  });
  const bypassSegments = routeSegments(edge)
    .filter((segment) => {
      const bypassTop = Math.min(segment.start.y, segment.end.y);
      const bypassBottom = Math.max(segment.start.y, segment.end.y);
      return segment.orientation === "vertical"
        && blockers.every((blocker) =>
          segment.start.x > blocker.x + blocker.width
          && bypassTop <= blocker.y + 0.5
          && bypassBottom >= blocker.y + blocker.height - 0.5
        );
    });
  expect(bypassSegments.length).toBe(1);
  return bypassSegments[0]!;
}

function expectSingleBypassSpanningNodes(
  edge: PositionedEdge,
  boxesById: ReadonlyMap<string, { x: number; y: number; width: number; height: number }>,
  blockerIds: readonly string[]
): number {
  const bypass = getSingleBypassSegmentSpanningNodes(edge, boxesById, blockerIds);
  return bypass.start.x;
}

function expectCollapsedSourceEdgeEntry(
  edge: PositionedEdge,
  boxesById: ReadonlyMap<string, { x: number; y: number; width: number; height: number }>,
  sourceId: string,
  blockerIds: readonly string[]
): number {
  const source = boxesById.get(sourceId);
  if (!source) {
    throw new Error(`Could not find source "${sourceId}".`);
  }
  const bypass = getSingleBypassSegmentSpanningNodes(edge, boxesById, blockerIds);
  const firstHorizontal = getFirstHorizontalSegment(edge);
  expect(bypass.segmentIndex).toBe(0);
  expect(edge.from.x).toBe(bypass.start.x);
  expect(edge.route.points[0]).toEqual({
    x: bypass.start.x,
    y: source.y + source.height
  });
  expect(bypass.start.x).toBeGreaterThanOrEqual(source.x);
  expect(bypass.start.x).toBeLessThanOrEqual(source.x + source.width);
  expect(firstHorizontal.start.x).toBeGreaterThan(firstHorizontal.end.x);
  return bypass.start.x;
}

function expectUncollapsedSourceEdgeEntry(
  edge: PositionedEdge,
  boxesById: ReadonlyMap<string, { x: number; y: number; width: number; height: number }>,
  blockerIds: readonly string[]
): void {
  const bypass = getSingleBypassSegmentSpanningNodes(edge, boxesById, blockerIds);
  const firstHorizontal = getFirstHorizontalSegment(edge);
  expect(bypass.segmentIndex).toBeGreaterThan(0);
  expect(edge.from.x).not.toBe(bypass.start.x);
  expect(firstHorizontal.start.x).toBeLessThan(firstHorizontal.end.x);
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

  it("groups consecutive same-column realization blockers into ordered wide swerves", async () => {
    const context = await resolveScenarioFlowContext("scenario_branching.sdd");
    const rendered = await renderScenarioFlowStagedSvg(
      context.projection,
      context.graph,
      context.view,
      "strict"
    );
    const boxesById = new Map(collectVisibleItemBoxes(rendered.positionedScene.root)
      .map((box) => [box.itemId, box] as const));

    const localA = getEdgeById(rendered.positionedScene.edges, "J-032__realized_by__P-032");
    const wideB = getEdgeById(rendered.positionedScene.edges, "J-032__realized_by__VS-032a");
    const wideC = getEdgeById(rendered.positionedScene.edges, "J-031__realized_by__VS-031a");
    const localAX = expectSingleBypassSpanningNodes(localA, boxesById, ["P-031"]);
    const wideBX = expectSingleBypassSpanningNodes(wideB, boxesById, ["P-031", "P-032", "VS-031a"]);
    const wideCX = expectSingleBypassSpanningNodes(wideC, boxesById, ["J-032", "P-031", "P-032"]);
    expect(localAX).toBeLessThan(wideBX);
    expect(wideBX).toBeLessThan(wideCX);
    expectCollapsedSourceEdgeEntry(localA, boxesById, "J-032", ["P-031"]);
    expectCollapsedSourceEdgeEntry(wideB, boxesById, "J-032", ["P-031", "P-032", "VS-031a"]);
    expectUncollapsedSourceEdgeEntry(wideC, boxesById, ["J-032", "P-031", "P-032"]);
    expect(wideB.from.x - localA.from.x).toBeGreaterThanOrEqual(FIXED_SEPARATION_DISTANCE);

    const localD = getEdgeById(rendered.positionedScene.edges, "J-035__realized_by__P-035");
    const wideE = getEdgeById(rendered.positionedScene.edges, "J-035__realized_by__VS-035a");
    const wideF = getEdgeById(rendered.positionedScene.edges, "J-034__realized_by__VS-034a");
    const localDX = expectSingleBypassSpanningNodes(localD, boxesById, ["P-034"]);
    const wideEX = expectSingleBypassSpanningNodes(wideE, boxesById, ["P-034", "P-035", "VS-034a"]);
    const wideFX = expectSingleBypassSpanningNodes(wideF, boxesById, ["J-035", "P-034", "P-035"]);
    expect(localDX).toBeLessThan(wideEX);
    expect(wideEX).toBeLessThan(wideFX);
    expectCollapsedSourceEdgeEntry(localD, boxesById, "J-035", ["P-034"]);
    expectCollapsedSourceEdgeEntry(wideE, boxesById, "J-035", ["P-034", "P-035", "VS-034a"]);
    expectUncollapsedSourceEdgeEntry(wideF, boxesById, ["J-035", "P-034", "P-035"]);
    expect(wideE.from.x - localD.from.x).toBeGreaterThanOrEqual(FIXED_SEPARATION_DISTANCE);

    const wideBSegmentIndex = getSingleBypassSegmentSpanningNodes(
      wideB,
      boxesById,
      ["P-031", "P-032", "VS-031a"]
    ).segmentIndex;
    const wideBOccupancy = rendered.routingStages.gutterOccupancy.filter((entry) =>
      entry.connectorId === "J-032__realized_by__VS-032a"
      && entry.routeSegmentIndex === wideBSegmentIndex
    );
    expect(wideBOccupancy.some((entry) => entry.kind === "column")).toBe(false);
    expect(new Set(wideBOccupancy
      .filter((entry) => entry.kind === "obstacle_east")
      .map((entry) => entry.swerveGroupId)).size).toBe(1);
    expect(wideBOccupancy.filter((entry) => entry.kind === "obstacle_east")).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "obstacle:P-031:east", swerveBlockerCount: 3 }),
      expect.objectContaining({ key: "obstacle:P-032:east", swerveBlockerCount: 3 }),
      expect.objectContaining({ key: "obstacle:VS-031a:east", swerveBlockerCount: 3 })
    ]));

    const j032 = boxesById.get("J-032");
    const j035 = boxesById.get("J-035");
    if (!j032 || !j035) {
      throw new Error("Could not resolve proof-case step blockers.");
    }
    expect(j032.y - getFirstHorizontalSegment(wideC).start.y).toBeGreaterThanOrEqual(OBSTACLE_SWERVE_CLEARANCE);
    expect(j035.y - getFirstHorizontalSegment(getEdgeById(rendered.positionedScene.edges, "J-034__realized_by__P-034")).start.y)
      .toBeGreaterThanOrEqual(OBSTACLE_SWERVE_CLEARANCE);
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

    const directTransition = getEdgeById(rendered.positionedScene.edges, "VS-030a__transitions_to__VS-031a");
    const directTransitionSegments = routeSegments(directTransition);
    expect(directTransitionSegments.length).toBe(1);
    expect(directTransitionSegments[0]?.orientation).toBe("horizontal");
    const branchedTransition = getEdgeById(rendered.positionedScene.edges, "VS-030a__transitions_to__VS-032a");
    expect(Math.abs(directTransitionSegments[0]!.start.y - routeSegments(branchedTransition)[0]!.start.y))
      .toBeGreaterThanOrEqual(FIXED_SEPARATION_DISTANCE);

    const routeRight = maxRouteX(rendered.positionedScene);
    expect(rendered.positionedScene.root.width - routeRight).toBeGreaterThanOrEqual(ROOT_RIGHT_GUTTER);
    expect(getLaneSeparatorEndX(rendered.positionedScene, "lane-step__separator")).toBeGreaterThanOrEqual(routeRight);
    expect(getLaneSeparatorEndX(rendered.positionedScene, "lane-place__separator")).toBeGreaterThanOrEqual(routeRight);

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
    const step3BoxesById = new Map(collectVisibleItemBoxes(debug.step3PositionedScene.root)
      .map((box) => [box.itemId, box] as const));
    const step3LocalX = expectSingleBypassSpanningNodes(
      getEdgeById(debug.step3PositionedScene.edges, "J-032__realized_by__P-032"),
      step3BoxesById,
      ["P-031"]
    );
    const step3WideX = expectSingleBypassSpanningNodes(
      getEdgeById(debug.step3PositionedScene.edges, "J-032__realized_by__VS-032a"),
      step3BoxesById,
      ["P-031", "P-032", "VS-031a"]
    );
    const step3EarlierWideX = expectSingleBypassSpanningNodes(
      getEdgeById(debug.step3PositionedScene.edges, "J-031__realized_by__VS-031a"),
      step3BoxesById,
      ["J-032", "P-031", "P-032"]
    );
    expect(step3LocalX).toBeLessThan(step3WideX);
    expect(step3WideX).toBeLessThan(step3EarlierWideX);
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
