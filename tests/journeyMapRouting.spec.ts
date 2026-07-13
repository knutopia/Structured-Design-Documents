import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import type { Bundle, ViewSpec } from "../src/bundle/types.js";
import type { CompiledGraph } from "../src/compiler/types.js";
import { projectView } from "../src/projector/projectView.js";
import type { Projection } from "../src/projector/types.js";
import type {
  MeasuredScene,
  Point,
  PositionedContainer,
  PositionedItem,
  PositionedNode,
  PositionedRoute,
  PositionedScene,
  RendererScene
} from "../src/renderer/staged/contracts.js";
import {
  buildJourneyMapRendererScene,
  positionJourneyMapMeasuredSceneBeforeRouting,
  renderJourneyMapBasicRoutingArtifacts
} from "../src/renderer/staged/journeyMap.js";
import {
  buildJourneyMapRoutingStages,
  validateJourneyMapBasicRoutes,
  type JourneyMapConnectorPlan,
  type JourneyMapRoutingStages
} from "../src/renderer/staged/journeyMapRouting.js";
import { measureScene } from "../src/renderer/staged/pipeline.js";
import { MIN_ARROW_MARKER_LEG } from "../src/renderer/staged/routing.js";
import { renderPositionedSceneToPng } from "../src/renderer/staged/svgBackend.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");
const fixtureRoot = path.join(repoRoot, "tests/fixtures/render");
const bundlePromise = loadBundle(manifestPath);

interface JourneyRoutingFixture {
  bundle: Bundle;
  view: ViewSpec;
  graph: CompiledGraph;
  projection: Projection;
  rendererScene: RendererScene;
  measuredScene: MeasuredScene;
  preRoutingPositionedScene: PositionedScene;
  routingStages: JourneyMapRoutingStages;
}

function journeyView(bundle: Bundle): ViewSpec {
  const view = bundle.views.views.find((candidate) => candidate.id === "journey_map");
  if (!view) {
    throw new Error("Missing journey_map view in test bundle.");
  }
  return view;
}

async function buildFixture(name: string, profileId = "strict"): Promise<JourneyRoutingFixture> {
  const bundle = await bundlePromise;
  const fixturePath = path.join(fixtureRoot, `journey_map_staged_${name}.sdd`);
  const compiled = compileSource({ path: fixturePath, text: await readFile(fixturePath, "utf8") }, bundle);
  expect(compiled.diagnostics).toEqual([]);
  expect(compiled.graph).toBeDefined();
  const projected = projectView(compiled.graph!, bundle, "journey_map");
  expect(projected.diagnostics).toEqual([]);
  expect(projected.projection).toBeDefined();
  const view = journeyView(bundle);
  const rendererScene = buildJourneyMapRendererScene(
    projected.projection!,
    compiled.graph!,
    bundle,
    view,
    profileId
  );
  const measuredScene = measureScene(rendererScene);
  const preRoutingPositionedScene = await positionJourneyMapMeasuredSceneBeforeRouting(measuredScene);
  const routingStages = buildJourneyMapRoutingStages(measuredScene, preRoutingPositionedScene);
  return {
    bundle,
    view,
    graph: compiled.graph!,
    projection: projected.projection!,
    rendererScene,
    measuredScene,
    preRoutingPositionedScene,
    routingStages
  };
}

function edgeKey(edge: { from: string; to: string }): string {
  return `${edge.from}→${edge.to}`;
}

function flattenPositionedItems(container: PositionedContainer): PositionedItem[] {
  return container.children.flatMap((item) =>
    item.kind === "container" ? [item, ...flattenPositionedItems(item)] : [item]
  );
}

function findNode(scene: PositionedScene, id: string): PositionedNode {
  const item = flattenPositionedItems(scene.root).find((candidate) => candidate.id === id);
  expect(item?.kind).toBe("node");
  return item as PositionedNode;
}

function findContainer(scene: PositionedScene, id: string): PositionedContainer {
  const item = flattenPositionedItems(scene.root).find((candidate) => candidate.id === id);
  expect(item?.kind).toBe("container");
  return item as PositionedContainer;
}

function segments(route: PositionedRoute): Array<{ start: Point; end: Point }> {
  return route.points.slice(1).map((end, index) => ({ start: route.points[index]!, end }));
}

function segmentLength(start: Point, end: Point): number | undefined {
  if (start.x === end.x) {
    return Math.abs(end.y - start.y);
  }
  if (start.y === end.y) {
    return Math.abs(end.x - start.x);
  }
  return undefined;
}

function routeContainsPoint(route: PositionedRoute, point: Point): boolean {
  return segments(route).some(({ start, end }) => {
    if (start.x === end.x && point.x === start.x) {
      return point.y >= Math.min(start.y, end.y) && point.y <= Math.max(start.y, end.y);
    }
    if (start.y === end.y && point.y === start.y) {
      return point.x >= Math.min(start.x, end.x) && point.x <= Math.max(start.x, end.x);
    }
    return false;
  });
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function expectExactPartition(fixture: JourneyRoutingFixture): void {
  const routedIds = fixture.routingStages.connectorPlans.map((plan) => plan.id);
  const deferredIds = fixture.routingStages.deferredConnectors.map((edge) => edge.id);
  const failedIds = fixture.routingStages.failedConnectorIds;
  const partition = [...routedIds, ...deferredIds, ...failedIds];
  expect(new Set(partition).size).toBe(partition.length);
  expect(new Set(partition)).toEqual(new Set(fixture.measuredScene.edges.map((edge) => edge.id)));
}

describe("journey map Gate 5 basic routing", () => {
  it("routes only the three locked basic primary occurrences and explicitly defers the rest", async () => {
    const fixture = await buildFixture("primary");
    expect(fixture.routingStages.connectorPlans.map(edgeKey)).toEqual([
      "J-101→J-102",
      "J-102→J-103",
      "J-103→J-201"
    ]);
    expect(fixture.routingStages.deferredConnectors.map((edge) => ({
      edge: edgeKey(edge),
      families: edge.deferredFamilies
    }))).toEqual([
      { edge: "J-201→J-202", families: ["branch"] },
      { edge: "J-201→J-203", families: ["branch", "non_adjacent_same_stage"] },
      { edge: "J-202→J-204", families: ["join", "non_adjacent_same_stage"] },
      { edge: "J-203→J-204", families: ["join"] },
      { edge: "J-204→J-401", families: ["long_cross_stage"] },
      { edge: "J-250→J-260", families: ["root_step"] }
    ]);
    expect(fixture.routingStages.failedConnectorIds).toEqual([]);
    expectExactPartition(fixture);
  });

  it("partitions every locked fixture without routing Gate 6 families early", async () => {
    const cases = [
      ["primary", 3],
      ["ordering_ownership", 0],
      ["topology", 0],
      ["duplicate", 0],
      ["compressed", 0]
    ] as const;
    for (const [name, expectedRoutedCount] of cases) {
      const fixture = await buildFixture(name);
      expect(fixture.routingStages.connectorPlans).toHaveLength(expectedRoutedCount);
      expect(fixture.routingStages.failedConnectorIds).toEqual([]);
      expectExactPartition(fixture);
    }
  });

  it("builds typed owners, priorities, east/west endpoints, side buckets, and simple Stage gates", async () => {
    const { routingStages } = await buildFixture("primary");
    const [first, second, cross] = routingStages.connectorPlans;
    expect(first).toMatchObject({
      from: "J-101",
      to: "J-102",
      ownerContainerId: "G-100",
      archetype: "adjacent_forward_same_stage",
      authorOrder: 0,
      sourceEndpoint: { itemId: "J-101", portId: "J-101__flow_out", side: "east", x: 276, y: 116 },
      targetEndpoint: { itemId: "J-102", portId: "J-102__flow_in", side: "west", x: 300, y: 124 },
      stageGates: []
    });
    expect(first?.priority).toEqual({
      archetypeRank: 0,
      sourceRootOrder: 0,
      sourceStepOrder: 0,
      authorOrder: 0,
      targetRootOrder: 0,
      targetStepOrder: 1,
      sameEndpointOrdinal: 0,
      exactIdentityOrdinal: 0,
      edgeId: first?.id
    });
    expect(first?.step2Route.points).toEqual([
      { x: 276, y: 116 },
      { x: 288, y: 116 },
      { x: 288, y: 124 },
      { x: 300, y: 124 }
    ]);
    expect(second).toMatchObject({
      from: "J-102",
      to: "J-103",
      ownerContainerId: "G-100",
      archetype: "adjacent_forward_same_stage",
      sourceEndpoint: { x: 604, y: 124 },
      targetEndpoint: { x: 628, y: 116 }
    });
    expect(second?.step2Route.points).toEqual([
      { x: 604, y: 124 },
      { x: 616, y: 124 },
      { x: 616, y: 116 },
      { x: 628, y: 116 }
    ]);
    expect(cross).toMatchObject({
      from: "J-103",
      to: "J-201",
      ownerContainerId: "root",
      archetype: "adjacent_forward_cross_stage",
      authorOrder: 2,
      sourceEndpoint: { itemId: "J-103", portId: "J-103__flow_out", side: "east", x: 852, y: 116 },
      targetEndpoint: { itemId: "J-201", portId: "J-201__flow_in", side: "west", x: 932, y: 154 },
      stageGates: [
        { stageId: "G-100", side: "east", x: 872, y: 116, order: 0, locked: true },
        { stageId: "G-200", side: "west", x: 912, y: 154, order: 0, locked: true }
      ]
    });
    expect(cross?.step2Route.points).toEqual([
      { x: 852, y: 116 },
      { x: 892, y: 116 },
      { x: 892, y: 154 },
      { x: 932, y: 154 }
    ]);
    expect(cross?.finalBasicRoute.points).toEqual([
      { x: 852, y: 116 },
      { x: 872, y: 116 },
      { x: 892, y: 116 },
      { x: 892, y: 154 },
      { x: 912, y: 154 },
      { x: 932, y: 154 }
    ]);
    expect(routingStages.connectorPlans.map((plan) => plan.priority.archetypeRank)).toEqual([0, 0, 1]);
    expect(first?.finalBasicRoute).toEqual(first?.step2Route);
    expect(first?.finalBasicRoute).not.toBe(first?.step2Route);

    const buckets = new Map(routingStages.nodeEdgeBuckets.map((bucket) => [bucket.nodeId, bucket]));
    expect(buckets.get("J-101")?.east.startingConnectorIds).toEqual([first?.id]);
    expect(buckets.get("J-102")?.west.endingConnectorIds).toEqual([first?.id]);
    expect(buckets.get("J-102")?.east.startingConnectorIds).toEqual([second?.id]);
    expect(buckets.get("J-103")?.west.endingConnectorIds).toEqual([second?.id]);
    expect(buckets.get("J-103")?.east.startingConnectorIds).toEqual([cross?.id]);
    expect(buckets.get("J-201")?.west.endingConnectorIds).toEqual([cross?.id]);
    for (const bucket of routingStages.nodeEdgeBuckets) {
      expect(bucket.north).toEqual({ startingConnectorIds: [], endingConnectorIds: [] });
      expect(bucket.south).toEqual({ startingConnectorIds: [], endingConnectorIds: [] });
    }
  });

  it("produces orthogonal exterior routes with legal gates, clear obstacles, and 12px marker legs", async () => {
    const fixture = await buildFixture("primary");
    expect(validateJourneyMapBasicRoutes(
      fixture.routingStages.connectorPlans,
      fixture.preRoutingPositionedScene,
      "step2"
    )).toEqual([]);
    expect(validateJourneyMapBasicRoutes(
      fixture.routingStages.connectorPlans,
      fixture.preRoutingPositionedScene,
      "final_basic"
    )).toEqual([]);
    expect(fixture.routingStages.step2PositionedScene.root).toEqual(fixture.preRoutingPositionedScene.root);
    expect(fixture.routingStages.step2PositionedScene.edges.map((edge) => edge.id)).toEqual(
      fixture.routingStages.connectorPlans.map((plan) => plan.id)
    );
    expect(fixture.preRoutingPositionedScene.edges).toEqual([]);
    for (const plan of fixture.routingStages.connectorPlans) {
      const routeSegments = segments(plan.finalBasicRoute);
      expect(routeSegments.every(({ start, end }) => segmentLength(start, end) !== undefined)).toBe(true);
      expect(segmentLength(routeSegments[0]!.start, routeSegments[0]!.end)).toBeGreaterThanOrEqual(
        MIN_ARROW_MARKER_LEG
      );
      expect(segmentLength(routeSegments.at(-1)!.start, routeSegments.at(-1)!.end)).toBeGreaterThanOrEqual(
        MIN_ARROW_MARKER_LEG
      );
      const source = findNode(fixture.preRoutingPositionedScene, plan.from);
      const target = findNode(fixture.preRoutingPositionedScene, plan.to);
      expect(plan.sourceEndpoint.x).toBe(source.x + source.width);
      expect(plan.targetEndpoint.x).toBe(target.x);
      for (const gate of plan.stageGates) {
        const stage = findContainer(fixture.preRoutingPositionedScene, gate.stageId);
        const headerBottom = stage.y + stage.chrome.padding.top + (stage.chrome.headerBandHeight ?? 0);
        expect(gate.y).toBeGreaterThanOrEqual(headerBottom);
        expect(routeContainsPoint(plan.step2Route, gate)).toBe(true);
        expect(plan.finalBasicRoute.points).toContainEqual({ x: gate.x, y: gate.y });
      }
    }
    expect(fixture.routingStages.diagnostics.filter((diagnostic) => diagnostic.phase === "routing")).toEqual([]);
  });

  it("keeps profile-dependent target geometry deterministic without changing the routed family", async () => {
    const simple = await buildFixture("primary", "simple");
    const permissive = await buildFixture("primary", "permissive");
    const strict = await buildFixture("primary", "strict");
    expect(simple.routingStages.connectorPlans.map(edgeKey)).toEqual(strict.routingStages.connectorPlans.map(edgeKey));
    expect(permissive.routingStages.connectorPlans.map(edgeKey)).toEqual(strict.routingStages.connectorPlans.map(edgeKey));
    expect(simple.routingStages.connectorPlans[2]?.targetEndpoint.y).toBe(124);
    expect(permissive.routingStages.connectorPlans[2]?.targetEndpoint.y).toBe(154);
    expect(strict.routingStages.connectorPlans[2]?.targetEndpoint.y).toBe(154);
    expect(permissive.routingStages.connectorPlans).toEqual(strict.routingStages.connectorPlans);
    const strictAgain = await buildFixture("primary", "strict");
    expect(JSON.stringify(strictAgain.routingStages)).toBe(JSON.stringify(strict.routingStages));
  });

  it("renders deterministic partial step-2 SVG and PNG from the exact same SVG", async () => {
    const fixture = await buildFixture("primary");
    const first = await renderJourneyMapBasicRoutingArtifacts(
      fixture.projection,
      fixture.graph,
      fixture.bundle,
      fixture.view,
      "strict"
    );
    const second = await renderJourneyMapBasicRoutingArtifacts(
      fixture.projection,
      fixture.graph,
      fixture.bundle,
      fixture.view,
      "strict"
    );
    const direct = await renderPositionedSceneToPng(first.routingStages.step2PositionedScene);
    expect(first.step2Svg).toBe(direct.svg);
    expect(sha256(first.step2Png)).toBe(sha256(direct.png));
    expect(first.step2Svg).toContain("data-edge-id=");
    expect((first.step2Svg.match(/data-edge-id=/g) ?? [])).toHaveLength(3);
    expect(first.step2Svg).toContain("marker-end=\"url(#scene-marker-arrow-end)\"");
    expect([...first.step2Png.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(first.finalBasicSvg).not.toBe(first.step2Svg);
    expect(sha256(first.step2Svg)).toBe(sha256(second.step2Svg));
    expect(sha256(first.step2Png)).toBe(sha256(second.step2Png));
    expect(first.diagnostics.some((diagnostic) =>
      diagnostic.severity === "warn" || diagnostic.severity === "error"
    )).toBe(false);
  });

  it("emits locked structural diagnostics for missing endpoints, omissions, duplicate IDs, and diagonals", async () => {
    const fixture = await buildFixture("primary");

    const missingEndpointScene = structuredClone(fixture.measuredScene) as MeasuredScene;
    missingEndpointScene.edges[0]!.from.itemId = "J-missing";
    const missingEndpoint = buildJourneyMapRoutingStages(
      missingEndpointScene,
      fixture.preRoutingPositionedScene
    );
    expect(missingEndpoint.diagnostics.some((diagnostic) =>
      diagnostic.code === "renderer.routing.journey_map_unresolved_endpoint"
      && diagnostic.severity === "error"
    )).toBe(true);

    const missingPortScene = structuredClone(fixture.preRoutingPositionedScene) as PositionedScene;
    findNode(missingPortScene, "J-101").ports = [];
    const missingPort = buildJourneyMapRoutingStages(fixture.measuredScene, missingPortScene);
    expect(missingPort.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(expect.arrayContaining([
      "renderer.routing.journey_map_unresolved_endpoint",
      "renderer.routing.journey_map_edge_omitted"
    ]));

    const duplicateIdScene = structuredClone(fixture.measuredScene) as MeasuredScene;
    duplicateIdScene.edges.push(structuredClone(duplicateIdScene.edges[0]!));
    const duplicateId = buildJourneyMapRoutingStages(duplicateIdScene, fixture.preRoutingPositionedScene);
    expect(duplicateId.diagnostics.some((diagnostic) =>
      diagnostic.code === "renderer.routing.journey_map_edge_duplicated"
      && diagnostic.severity === "error"
    )).toBe(true);

    const diagonalPlan = structuredClone(fixture.routingStages.connectorPlans[0]!) as JourneyMapConnectorPlan;
    diagonalPlan.finalBasicRoute.points = [
      { ...diagonalPlan.sourceEndpoint },
      { ...diagonalPlan.targetEndpoint }
    ];
    expect(validateJourneyMapBasicRoutes(
      [diagonalPlan],
      fixture.preRoutingPositionedScene
    ).some((diagnostic) => diagnostic.code === "renderer.routing.journey_map_non_orthogonal_route")).toBe(true);

    const emptyPlan = structuredClone(fixture.routingStages.connectorPlans[0]!) as JourneyMapConnectorPlan;
    emptyPlan.finalBasicRoute.points = [];
    const emptyDiagnostics = validateJourneyMapBasicRoutes(
      [emptyPlan],
      fixture.preRoutingPositionedScene
    );
    expect(emptyDiagnostics.map((diagnostic) => diagnostic.code)).toEqual(expect.arrayContaining([
      "renderer.routing.journey_map_endpoint_intrusion",
      "renderer.routing.marker_leg_minimum_unmet"
    ]));
  });
});
