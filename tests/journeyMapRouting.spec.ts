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
  renderJourneyMapBasicRoutingArtifacts,
  renderJourneyMapRoutingArtifacts
} from "../src/renderer/staged/journeyMap.js";
import {
  buildJourneyMapRoutingStages,
  validateJourneyMapBasicRoutes,
  validateJourneyMapRoutes,
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
  it("preserves the three locked basic primary occurrences and explicitly defers later branch/join work", async () => {
    const fixture = await buildFixture("primary");
    expect(fixture.routingStages.connectorPlans.slice(0, 3).map(edgeKey)).toEqual([
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
      { edge: "J-203→J-204", families: ["join"] }
    ]);
    expect(fixture.routingStages.failedConnectorIds).toEqual([]);
    expectExactPartition(fixture);
  });

  it("preserves exact fixture partitions while unopened Gate 6 families remain blocked", async () => {
    const cases = [
      ["primary", 5],
      ["ordering_ownership", 1],
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
    expect(routingStages.connectorPlans.slice(0, 3).map((plan) => plan.priority.archetypeRank)).toEqual([0, 0, 1]);
    expect(first?.finalBasicRoute).toEqual(first?.step2Route);
    expect(first?.finalBasicRoute).not.toBe(first?.step2Route);

    const buckets = new Map(routingStages.nodeEdgeBuckets.map((bucket) => [bucket.nodeId, bucket]));
    expect(buckets.get("J-101")?.east.startingConnectorIds).toEqual([first?.id]);
    expect(buckets.get("J-102")?.west.endingConnectorIds).toEqual([first?.id]);
    expect(buckets.get("J-102")?.east.startingConnectorIds).toEqual([second?.id]);
    expect(buckets.get("J-103")?.west.endingConnectorIds).toEqual([second?.id]);
    expect(buckets.get("J-103")?.east.startingConnectorIds).toEqual([cross?.id]);
    expect(buckets.get("J-201")?.west.endingConnectorIds).toEqual([cross?.id]);
    for (const bucket of routingStages.nodeEdgeBuckets.filter((candidate) =>
      ["J-101", "J-102", "J-103", "J-201"].includes(candidate.nodeId)
    )) {
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
    for (const plan of fixture.routingStages.connectorPlans.slice(0, 3)) {
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
    expect((first.step2Svg.match(/data-edge-id=/g) ?? [])).toHaveLength(5);
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

describe("journey map Gate 6 non-adjacent same-Stage routing", () => {
  it("routes only the isolated ordering skip and keeps every later family deferred", async () => {
    const fixture = await buildFixture("ordering_ownership");
    expect(fixture.routingStages.connectorPlans).toHaveLength(1);
    const [plan] = fixture.routingStages.connectorPlans;
    expect(plan).toMatchObject({
      id: "J-503__PRECEDES__J-501__c8f35bbd840d5e1bff1eb4eed771c5362ef16bd9c7f80e653a3aa392b25477c8__0",
      from: "J-503",
      to: "J-501",
      ownerContainerId: "G-500",
      archetype: "non_adjacent_forward_same_stage",
      authorOrder: 0,
      sameEndpointOrdinal: 0,
      exactIdentityOrdinal: 0,
      sourceEndpoint: {
        itemId: "J-503",
        portId: "J-503__escape_out",
        side: "south",
        x: 980,
        y: 156,
        offset: 112
      },
      targetEndpoint: {
        itemId: "J-501",
        portId: "J-501__escape_in",
        side: "south",
        x: 1476,
        y: 140,
        offset: 112
      },
      stageGates: [],
      stageLocalBypass: {
        stageId: "G-500",
        axis: "horizontal",
        nominalCoordinate: 168,
        span: { start: 980, end: 1476 },
        intermediateStepIds: ["J-502"],
        obstacleControls: [
          { stepId: "J-502", entryX: 1116, exitX: 1340 }
        ],
        order: 0,
        locked: false
      }
    });
    expect(plan?.priority).toEqual({
      archetypeRank: 2,
      sourceRootOrder: 2,
      sourceStepOrder: 0,
      authorOrder: 0,
      targetRootOrder: 2,
      targetStepOrder: 2,
      sameEndpointOrdinal: 0,
      exactIdentityOrdinal: 0,
      edgeId: plan.id
    });
    expect(fixture.routingStages.deferredConnectors.map((edge) => ({
      edge: edgeKey(edge),
      families: edge.deferredFamilies
    }))).toEqual([
      { edge: "J-501→J-502", families: ["backward", "non_adjacent_same_stage"] },
      { edge: "J-591→J-590", families: ["root_step", "backward"] }
    ]);
    expect(fixture.routingStages.failedConnectorIds).toEqual([]);
    expectExactPartition(fixture);

    for (const name of ["topology", "duplicate", "compressed"] as const) {
      const laterFamily = await buildFixture(name);
      expect(laterFamily.routingStages.connectorPlans).toHaveLength(0);
      expectExactPartition(laterFamily);
    }
    const primary = await buildFixture("primary");
    expect(primary.routingStages.connectorPlans.map(edgeKey)).toEqual([
      "J-101→J-102",
      "J-102→J-103",
      "J-103→J-201",
      "J-204→J-401",
      "J-250→J-260"
    ]);
  });

  it("uses a bounds-derived south-to-south bypass below the Step row without moving accepted geometry", async () => {
    const fixture = await buildFixture("ordering_ownership");
    const [plan] = fixture.routingStages.connectorPlans;
    expect(plan?.step2Route.points).toEqual([
      { x: 980, y: 156 },
      { x: 980, y: 168 },
      { x: 1476, y: 168 },
      { x: 1476, y: 140 }
    ]);
    expect(plan?.provisionalRoute.points).toEqual([
      { x: 980, y: 156 },
      { x: 980, y: 168 },
      { x: 1116, y: 168 },
      { x: 1340, y: 168 },
      { x: 1476, y: 168 },
      { x: 1476, y: 140 }
    ]);
    expect(plan?.provisionalRoute).not.toEqual(plan?.step2Route);
    expect(plan?.provisionalRoute).not.toBe(plan?.step2Route);
    expect(validateJourneyMapRoutes(
      fixture.routingStages.connectorPlans,
      fixture.preRoutingPositionedScene,
      "step2"
    )).toEqual([]);
    expect(validateJourneyMapRoutes(
      fixture.routingStages.connectorPlans,
      fixture.preRoutingPositionedScene,
      "provisional"
    )).toEqual([]);
    expect(validateJourneyMapRoutes(
      fixture.routingStages.connectorPlans,
      fixture.preRoutingPositionedScene,
      "final_basic"
    )).toEqual([]);
    expect(fixture.routingStages.provisionalPositionedScene.root).toEqual(
      fixture.preRoutingPositionedScene.root
    );
    expect(fixture.routingStages.provisionalPositionedScene.edges).toHaveLength(1);

    const source = findNode(fixture.preRoutingPositionedScene, "J-503");
    const intermediate = findNode(fixture.preRoutingPositionedScene, "J-502");
    const target = findNode(fixture.preRoutingPositionedScene, "J-501");
    const stage = findContainer(fixture.preRoutingPositionedScene, "G-500");
    const trackY = plan!.stageLocalBypass!.nominalCoordinate;
    expect(trackY).toBe(Math.max(
      source.y + source.height,
      intermediate.y + intermediate.height,
      target.y + target.height
    ) + MIN_ARROW_MARKER_LEG);
    expect(trackY).toBeLessThan(stage.y + stage.height);
    const routeSegments = segments(plan!.provisionalRoute);
    expect(routeSegments.every(({ start, end }) => segmentLength(start, end) !== undefined)).toBe(true);
    expect(segmentLength(routeSegments[0]!.start, routeSegments[0]!.end)).toBe(MIN_ARROW_MARKER_LEG);
    expect(segmentLength(routeSegments.at(-1)!.start, routeSegments.at(-1)!.end)).toBeGreaterThanOrEqual(
      MIN_ARROW_MARKER_LEG
    );
    expect(trackY).toBeGreaterThan(intermediate.y + intermediate.height);

    const buckets = new Map(fixture.routingStages.nodeEdgeBuckets.map((bucket) => [bucket.nodeId, bucket]));
    expect(buckets.get("J-503")?.south.startingConnectorIds).toEqual([plan?.id]);
    expect(buckets.get("J-501")?.south.endingConnectorIds).toEqual([plan?.id]);
    expect(buckets.get("J-503")?.east.startingConnectorIds).toEqual([]);
    expect(buckets.get("J-501")?.west.endingConnectorIds).toEqual([]);
    expect(fixture.routingStages.diagnostics.filter((diagnostic) =>
      diagnostic.phase === "routing"
    )).toEqual([]);
  });

  it("renders deterministic family debug SVG/PNG while retaining accepted earlier route structures", async () => {
    const fixture = await buildFixture("ordering_ownership");
    const first = await renderJourneyMapRoutingArtifacts(
      fixture.projection,
      fixture.graph,
      fixture.bundle,
      fixture.view,
      "strict"
    );
    const second = await renderJourneyMapRoutingArtifacts(
      fixture.projection,
      fixture.graph,
      fixture.bundle,
      fixture.view,
      "strict"
    );
    const direct = await renderPositionedSceneToPng(first.routingStages.provisionalPositionedScene);
    expect(first.provisionalSvg).toBe(direct.svg);
    expect(sha256(first.provisionalPng)).toBe(sha256(direct.png));
    expect(first.provisionalSvg).not.toBe(first.step2Svg);
    expect(sha256(first.provisionalPng)).toBe(sha256(first.step2Png));
    expect((first.provisionalSvg.match(/data-edge-id=/g) ?? [])).toHaveLength(1);
    expect(first.provisionalSvg).toContain("marker-end=\"url(#scene-marker-arrow-end)\"");
    expect(sha256(first.provisionalSvg)).toBe(sha256(second.provisionalSvg));
    expect(sha256(first.provisionalPng)).toBe(sha256(second.provisionalPng));
    expect(first.diagnostics.some((diagnostic) =>
      diagnostic.severity === "warn" || diagnostic.severity === "error"
    )).toBe(false);

    const primary = await buildFixture("primary");
    expect(primary.routingStages.connectorPlans.slice(0, 3).map((plan) => ({
      edge: edgeKey(plan),
      step2: plan.step2Route.points,
      provisional: plan.provisionalRoute.points
    }))).toEqual([
      {
        edge: "J-101→J-102",
        step2: [{ x: 276, y: 116 }, { x: 288, y: 116 }, { x: 288, y: 124 }, { x: 300, y: 124 }],
        provisional: [{ x: 276, y: 116 }, { x: 288, y: 116 }, { x: 288, y: 124 }, { x: 300, y: 124 }]
      },
      {
        edge: "J-102→J-103",
        step2: [{ x: 604, y: 124 }, { x: 616, y: 124 }, { x: 616, y: 116 }, { x: 628, y: 116 }],
        provisional: [{ x: 604, y: 124 }, { x: 616, y: 124 }, { x: 616, y: 116 }, { x: 628, y: 116 }]
      },
      {
        edge: "J-103→J-201",
        step2: [{ x: 852, y: 116 }, { x: 892, y: 116 }, { x: 892, y: 154 }, { x: 932, y: 154 }],
        provisional: [
          { x: 852, y: 116 }, { x: 872, y: 116 }, { x: 892, y: 116 },
          { x: 892, y: 154 }, { x: 912, y: 154 }, { x: 932, y: 154 }
        ]
      }
    ]);
  });

  it("fails visibly instead of falling back when a south port or baseline bypass space is unavailable", async () => {
    const fixture = await buildFixture("ordering_ownership");
    const missingPortScene = structuredClone(fixture.preRoutingPositionedScene) as PositionedScene;
    const missingPortNode = findNode(missingPortScene, "J-503");
    missingPortNode.ports = missingPortNode.ports.filter((port) => port.role !== "journey_escape_out");
    const missingPort = buildJourneyMapRoutingStages(fixture.measuredScene, missingPortScene);
    expect(missingPort.connectorPlans).toEqual([]);
    expect(missingPort.failedConnectorIds).toEqual([
      "J-503__PRECEDES__J-501__c8f35bbd840d5e1bff1eb4eed771c5362ef16bd9c7f80e653a3aa392b25477c8__0"
    ]);
    expect(missingPort.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(expect.arrayContaining([
      "renderer.routing.journey_map_unresolved_endpoint",
      "renderer.routing.journey_map_edge_omitted"
    ]));

    const insufficientSpaceScene = structuredClone(fixture.preRoutingPositionedScene) as PositionedScene;
    findContainer(insufficientSpaceScene, "G-500").height = 132;
    const insufficientSpace = buildJourneyMapRoutingStages(
      fixture.measuredScene,
      insufficientSpaceScene
    );
    expect(insufficientSpace.connectorPlans).toEqual([]);
    expect(insufficientSpace.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(expect.arrayContaining([
      "renderer.routing.journey_map_archetype_fallback",
      "renderer.routing.journey_map_edge_omitted"
    ]));
    expect(insufficientSpace.diagnostics.some((diagnostic) =>
      diagnostic.code === "renderer.routing.journey_map_gutter_expansion_exhausted"
    )).toBe(false);
  });
});

describe("journey map Gate 6 long cross-Stage and root-Step routing", () => {
  it("routes exactly the two locked primary proof occurrences with stable identity and priority", async () => {
    const fixture = await buildFixture("primary");
    const [longCross, rootDirect] = fixture.routingStages.connectorPlans.slice(3);
    expect(longCross).toMatchObject({
      id: "J-204__PRECEDES__J-401__318ddfc8a0a2555e2d3e8d652057700201e31e361ac7f271648ae7600f4e1b85__0",
      from: "J-204",
      to: "J-401",
      ownerContainerId: "root",
      archetype: "long_forward_cross_stage",
      authorOrder: 7,
      sameEndpointOrdinal: 0,
      exactIdentityOrdinal: 0,
      sourceEndpoint: {
        itemId: "J-204",
        portId: "J-204__escape_out",
        side: "south",
        x: 1788,
        y: 140
      },
      targetEndpoint: {
        itemId: "J-401",
        portId: "J-401__escape_in",
        side: "south",
        x: 2859.576,
        y: 140
      },
      stageGates: [
        { stageId: "G-200", side: "south", x: 1788, y: 236, order: 0, locked: true },
        { stageId: "G-400", side: "south", x: 2859.576, y: 160, order: 0, locked: true }
      ],
      rootOuterBypass: {
        ownerContainerId: "root",
        axis: "horizontal",
        nominalCoordinate: 248,
        span: { start: 1788, end: 2859.576 },
        intermediateRootItemIds: ["J-250", "J-260", "G-300"],
        obstacleControls: [
          { rootItemId: "J-250", entryX: 1960, exitX: 2184 },
          { rootItemId: "J-260", entryX: 2224, exitX: 2448 },
          { rootItemId: "G-300", entryX: 2488, exitX: 2687.576 }
        ],
        order: 0,
        locked: false
      }
    });
    expect(longCross?.priority).toEqual({
      archetypeRank: 3,
      sourceRootOrder: 1,
      sourceStepOrder: 3,
      authorOrder: 7,
      targetRootOrder: 5,
      targetStepOrder: 0,
      sameEndpointOrdinal: 0,
      exactIdentityOrdinal: 0,
      edgeId: longCross.id
    });
    expect(rootDirect).toMatchObject({
      id: "J-250__PRECEDES__J-260__41af070b7875a64ca707ee01b6165425f0d5fc78aa0510895157b68f9195daa6__0",
      from: "J-250",
      to: "J-260",
      ownerContainerId: "root",
      archetype: "adjacent_forward_root_step",
      authorOrder: 8,
      sourceEndpoint: {
        itemId: "J-250",
        portId: "J-250__flow_out",
        side: "east",
        x: 2184,
        y: 116
      },
      targetEndpoint: {
        itemId: "J-260",
        portId: "J-260__flow_in",
        side: "west",
        x: 2224,
        y: 116
      },
      stageGates: []
    });
    expect(rootDirect?.priority).toEqual({
      archetypeRank: 3,
      sourceRootOrder: 2,
      sourceStepOrder: 0,
      authorOrder: 8,
      targetRootOrder: 3,
      targetStepOrder: 0,
      sameEndpointOrdinal: 0,
      exactIdentityOrdinal: 0,
      edgeId: rootDirect.id
    });
    expect(rootDirect?.rootOuterBypass).toBeUndefined();
    expect(fixture.routingStages.deferredConnectors.map((edge) => ({
      edge: edgeKey(edge),
      families: edge.deferredFamilies
    }))).toEqual([
      { edge: "J-201→J-202", families: ["branch"] },
      { edge: "J-201→J-203", families: ["branch", "non_adjacent_same_stage"] },
      { edge: "J-202→J-204", families: ["join", "non_adjacent_same_stage"] },
      { edge: "J-203→J-204", families: ["join"] }
    ]);
    expect(fixture.routingStages.connectorPlans).toHaveLength(5);
    expect(fixture.routingStages.failedConnectorIds).toEqual([]);
    expectExactPartition(fixture);
  });

  it("uses a root-peripheral south-gated route and keeps the adjacent root chain direct", async () => {
    const fixture = await buildFixture("primary");
    const [longCross, rootDirect] = fixture.routingStages.connectorPlans.slice(3);
    expect(longCross?.step2Route.points).toEqual([
      { x: 1788, y: 140 },
      { x: 1788, y: 248 },
      { x: 2859.576, y: 248 },
      { x: 2859.576, y: 140 }
    ]);
    expect(longCross?.provisionalRoute.points).toEqual([
      { x: 1788, y: 140 },
      { x: 1788, y: 236 },
      { x: 1788, y: 248 },
      { x: 1960, y: 248 },
      { x: 2184, y: 248 },
      { x: 2224, y: 248 },
      { x: 2448, y: 248 },
      { x: 2488, y: 248 },
      { x: 2687.576, y: 248 },
      { x: 2859.576, y: 248 },
      { x: 2859.576, y: 160 },
      { x: 2859.576, y: 140 }
    ]);
    expect(rootDirect?.step2Route.points).toEqual([
      { x: 2184, y: 116 },
      { x: 2224, y: 116 }
    ]);
    expect(rootDirect?.provisionalRoute).toEqual(rootDirect?.step2Route);
    expect(validateJourneyMapRoutes(
      fixture.routingStages.connectorPlans,
      fixture.preRoutingPositionedScene,
      "step2"
    )).toEqual([]);
    expect(validateJourneyMapRoutes(
      fixture.routingStages.connectorPlans,
      fixture.preRoutingPositionedScene,
      "provisional"
    )).toEqual([]);
    expect(validateJourneyMapRoutes(
      fixture.routingStages.connectorPlans,
      fixture.preRoutingPositionedScene,
      "final_basic"
    )).toEqual([]);
    const maximumRootItemBottom = Math.max(
      ...fixture.preRoutingPositionedScene.root.children.map((item) => item.y + item.height)
    );
    expect(longCross?.rootOuterBypass?.nominalCoordinate).toBe(
      maximumRootItemBottom + MIN_ARROW_MARKER_LEG
    );
    expect(longCross?.rootOuterBypass?.nominalCoordinate).toBeLessThan(
      fixture.preRoutingPositionedScene.root.y + fixture.preRoutingPositionedScene.root.height
    );
    const buckets = new Map(fixture.routingStages.nodeEdgeBuckets.map((bucket) => [bucket.nodeId, bucket]));
    expect(buckets.get("J-204")?.south.startingConnectorIds).toEqual([longCross?.id]);
    expect(buckets.get("J-401")?.south.endingConnectorIds).toEqual([longCross?.id]);
    expect(buckets.get("J-250")?.east.startingConnectorIds).toEqual([rootDirect?.id]);
    expect(buckets.get("J-260")?.west.endingConnectorIds).toEqual([rootDirect?.id]);
    expect(fixture.routingStages.diagnostics.filter((diagnostic) =>
      diagnostic.phase === "routing"
    )).toEqual([]);
  });

  it("derives the peripheral track from each profile without changing semantic routing", async () => {
    const simple = await buildFixture("primary", "simple");
    const permissive = await buildFixture("primary", "permissive");
    const strict = await buildFixture("primary", "strict");
    expect(simple.routingStages.connectorPlans.map(edgeKey)).toEqual(
      strict.routingStages.connectorPlans.map(edgeKey)
    );
    expect(permissive.routingStages.connectorPlans).toEqual(strict.routingStages.connectorPlans);
    const simpleLong = simple.routingStages.connectorPlans[3]!;
    const strictLong = strict.routingStages.connectorPlans[3]!;
    expect(simpleLong.rootOuterBypass?.nominalCoordinate).toBe(188);
    expect(simpleLong.stageGates.map((gate) => gate.y)).toEqual([176, 160]);
    expect(strictLong.rootOuterBypass?.nominalCoordinate).toBe(248);
    expect(strictLong.stageGates.map((gate) => gate.y)).toEqual([236, 160]);
    expect(simpleLong.rootOuterBypass?.obstacleControls).toEqual(
      strictLong.rootOuterBypass?.obstacleControls
    );
    expect(simple.routingStages.connectorPlans[4]?.step2Route.points).toEqual([
      { x: 2184, y: 116 }, { x: 2224, y: 116 }
    ]);
  });

  it("fails visibly for unavailable ports or peripheral space and diagnoses malformed contracts", async () => {
    const fixture = await buildFixture("primary");
    const longId = fixture.routingStages.connectorPlans[3]!.id;

    const missingPortScene = structuredClone(fixture.preRoutingPositionedScene) as PositionedScene;
    const source = findNode(missingPortScene, "J-204");
    source.ports = source.ports.filter((port) => port.role !== "journey_escape_out");
    const missingPort = buildJourneyMapRoutingStages(fixture.measuredScene, missingPortScene);
    expect(missingPort.failedConnectorIds).toContain(longId);
    expect(missingPort.connectorPlans.map(edgeKey)).not.toContain("J-204→J-401");
    expect(missingPort.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(expect.arrayContaining([
      "renderer.routing.journey_map_unresolved_endpoint",
      "renderer.routing.journey_map_edge_omitted"
    ]));

    const insufficientSpaceScene = structuredClone(fixture.preRoutingPositionedScene) as PositionedScene;
    insufficientSpaceScene.root.height = 248;
    const insufficientSpace = buildJourneyMapRoutingStages(
      fixture.measuredScene,
      insufficientSpaceScene
    );
    expect(insufficientSpace.failedConnectorIds).toContain(longId);
    expect(insufficientSpace.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(expect.arrayContaining([
      "renderer.routing.journey_map_archetype_fallback",
      "renderer.routing.journey_map_edge_omitted"
    ]));

    const misalignedRootStepScene = structuredClone(
      fixture.preRoutingPositionedScene
    ) as PositionedScene;
    findNode(misalignedRootStepScene, "J-260").y += 8;
    const misalignedRootStep = buildJourneyMapRoutingStages(
      fixture.measuredScene,
      misalignedRootStepScene
    );
    expect(misalignedRootStep.connectorPlans.map(edgeKey)).not.toContain("J-250→J-260");
    expect(misalignedRootStep.failedConnectorIds).toContain(
      fixture.routingStages.connectorPlans[4]!.id
    );
    expect(misalignedRootStep.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        "renderer.routing.journey_map_archetype_fallback",
        "renderer.routing.journey_map_edge_omitted"
      ])
    );

    const malformedGate = structuredClone(fixture.routingStages.connectorPlans[3]!) as JourneyMapConnectorPlan;
    malformedGate.stageGates[0]!.side = "east";
    expect(validateJourneyMapRoutes(
      [malformedGate],
      fixture.preRoutingPositionedScene,
      "provisional"
    ).map((diagnostic) => diagnostic.code)).toContain(
      "renderer.routing.journey_map_boundary_gate_fallback"
    );

    const unlockedGate = structuredClone(
      fixture.routingStages.connectorPlans[3]!
    ) as JourneyMapConnectorPlan;
    Object.assign(unlockedGate.stageGates[0]!, { locked: false });
    expect(validateJourneyMapRoutes(
      [unlockedGate],
      fixture.preRoutingPositionedScene,
      "provisional"
    ).map((diagnostic) => diagnostic.code)).toContain(
      "renderer.routing.journey_map_boundary_gate_fallback"
    );

    const malformedControls = structuredClone(fixture.routingStages.connectorPlans[3]!) as JourneyMapConnectorPlan;
    malformedControls.rootOuterBypass!.obstacleControls[0]!.entryX += 1;
    expect(validateJourneyMapRoutes(
      [malformedControls],
      fixture.preRoutingPositionedScene,
      "provisional"
    ).map((diagnostic) => diagnostic.code)).toContain(
      "renderer.routing.journey_map_archetype_fallback"
    );
    expect(fixture.routingStages.diagnostics.some((diagnostic) =>
      diagnostic.code.includes("occupancy")
      || diagnostic.code.includes("capacity")
      || diagnostic.code.includes("expansion")
    )).toBe(false);
  });
});
