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
    expect(fixture.routingStages.deferredConnectors).toEqual([]);
    expect(fixture.routingStages.failedConnectorIds).toEqual([]);
    expectExactPartition(fixture);
  });

  it("preserves exact fixture partitions while unopened Gate 6 families remain blocked", async () => {
    const cases = [
      ["primary", 9],
      ["ordering_ownership", 3],
      ["topology", 4],
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
    expect((first.step2Svg.match(/data-edge-id=/g) ?? [])).toHaveLength(9);
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
  it("retains the isolated ordering skip while later accepted families are added", async () => {
    const fixture = await buildFixture("ordering_ownership");
    expect(fixture.routingStages.connectorPlans).toHaveLength(3);
    const plan = fixture.routingStages.connectorPlans.find((candidate) =>
      candidate.from === "J-503" && candidate.to === "J-501"
    );
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
    expect(fixture.routingStages.deferredConnectors).toEqual([]);
    expect(fixture.routingStages.failedConnectorIds).toEqual([]);
    expectExactPartition(fixture);

    for (const [name, expectedCount] of [
      ["topology", 4],
      ["duplicate", 0],
      ["compressed", 0]
    ] as const) {
      const laterFamily = await buildFixture(name);
      expect(laterFamily.routingStages.connectorPlans).toHaveLength(expectedCount);
      expectExactPartition(laterFamily);
    }
    const primary = await buildFixture("primary");
    expect(primary.routingStages.connectorPlans.map(edgeKey)).toEqual([
      "J-101→J-102",
      "J-102→J-103",
      "J-103→J-201",
      "J-204→J-401",
      "J-250→J-260",
      "J-201→J-202",
      "J-201→J-203",
      "J-202→J-204",
      "J-203→J-204"
    ]);
  });

  it("uses a bounds-derived south-to-south bypass below the Step row without moving accepted geometry", async () => {
    const fixture = await buildFixture("ordering_ownership");
    const plan = fixture.routingStages.connectorPlans.find((candidate) =>
      candidate.from === "J-503" && candidate.to === "J-501"
    );
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
    expect(fixture.routingStages.provisionalPositionedScene.edges).toHaveLength(3);

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
    expect((first.provisionalSvg.match(/data-edge-id=/g) ?? [])).toHaveLength(3);
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
    expect(missingPort.connectorPlans).toHaveLength(2);
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
    expect(insufficientSpace.connectorPlans).toHaveLength(2);
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
    expect(fixture.routingStages.deferredConnectors).toEqual([]);
    expect(fixture.routingStages.connectorPlans).toHaveLength(9);
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

describe("journey map Gate 6 branch fan-out routing", () => {
  it("applies forward source-branch precedence to exactly two primary and three topology occurrences", async () => {
    const primary = await buildFixture("primary");
    const primaryBranches = primary.routingStages.connectorPlans.slice(5, 7);
    expect(primaryBranches.map((plan) => ({
      id: plan.id,
      edge: edgeKey(plan),
      owner: plan.ownerContainerId,
      archetype: plan.archetype,
      modifiers: plan.topologyModifiers,
      branch: plan.branch,
      rank: plan.priority.archetypeRank,
      authorOrder: plan.authorOrder
    }))).toEqual([
      {
        id: "J-201__PRECEDES__J-202__593fe33d0efc3afc341263d5931f29a5f6fe37e5d7a0c711e6b630dc3f490377__0",
        edge: "J-201→J-202",
        owner: "G-200",
        archetype: "adjacent_forward_same_stage",
        modifiers: ["branch"],
        branch: { sourceOutdegree: 2, sourceOrdinal: 0 },
        rank: 4,
        authorOrder: 3
      },
      {
        id: "J-201__PRECEDES__J-203__fa511db8d388c1c641794046eb99f8143ad8ad693087448c54862f0fdd6d7105__0",
        edge: "J-201→J-203",
        owner: "G-200",
        archetype: "non_adjacent_forward_same_stage",
        modifiers: ["branch"],
        branch: {
          sourceOutdegree: 2,
          sourceOrdinal: 1,
          departureControl: {
            axis: "vertical",
            nominalCoordinate: 1168,
            span: { start: 154, end: 228 },
            obstacleItemId: "J-202",
            obstacleBoundaryCoordinate: 1180,
            order: 0,
            locked: false
          }
        },
        rank: 4,
        authorOrder: 4
      }
    ]);
    expect(primary.routingStages.connectorPlans.map((plan) => plan.priority.archetypeRank)).toEqual([
      0, 0, 1, 3, 3, 4, 4, 5, 5
    ]);
    expect(primary.routingStages.deferredConnectors).toEqual([]);
    expectExactPartition(primary);

    const topology = await buildFixture("topology");
    const topologyBranches = topology.routingStages.connectorPlans.filter((plan) =>
      plan.priority.archetypeRank === 4
    );
    expect(topologyBranches.map((plan) => ({
      id: plan.id,
      edge: edgeKey(plan),
      owner: plan.ownerContainerId,
      archetype: plan.archetype,
      modifiers: plan.topologyModifiers,
      branch: plan.branch,
      rank: plan.priority.archetypeRank,
      authorOrder: plan.authorOrder
    }))).toEqual([
      {
        id: "J-790__PRECEDES__J-701__661a1f868e72e80d2f47aedd3157ec09171f344f4a9aa62486fc7da5457bd384__0",
        edge: "J-790→J-701",
        owner: "root",
        archetype: "adjacent_forward_root_to_contained",
        modifiers: ["branch"],
        branch: { sourceOutdegree: 2, sourceOrdinal: 0 },
        rank: 4,
        authorOrder: 0
      },
      {
        id: "J-790__PRECEDES__J-791__71d18a11d3f80b2283cb17a0d68e86a327e54fca708def24c118a265fc3cd6be__0",
        edge: "J-790→J-791",
        owner: "root",
        archetype: "long_forward_root_step",
        modifiers: ["branch"],
        branch: {
          sourceOutdegree: 2,
          sourceOrdinal: 1,
          departureControl: {
            axis: "vertical",
            nominalCoordinate: 276,
            span: { start: 116, end: 188 },
            obstacleItemId: "G-700",
            obstacleBoundaryCoordinate: 296,
            order: 0,
            locked: false
          }
        },
        rank: 4,
        authorOrder: 1
      },
      {
        id: "J-714__PRECEDES__J-791__37d24514299e09f03f8d2a42e59503f5de765431b1348d451dfadcb4d8555722__0",
        edge: "J-714→J-791",
        owner: "root",
        archetype: "adjacent_forward_contained_to_root",
        modifiers: ["branch"],
        branch: { sourceOutdegree: 2, sourceOrdinal: 1 },
        rank: 4,
        authorOrder: 8
      }
    ]);
    expect(topology.routingStages.deferredConnectors.map((edge) => ({
      edge: edgeKey(edge),
      families: edge.deferredFamilies
    }))).toEqual([
      { edge: "J-701→J-702", families: ["cycle"] },
      { edge: "J-702→J-701", families: ["cycle", "join", "backward", "non_adjacent_same_stage"] },
      { edge: "J-711→J-712", families: ["cycle"] },
      { edge: "J-712→J-711", families: ["cycle", "backward", "non_adjacent_same_stage"] },
      { edge: "J-713→J-713", families: ["self_loop", "join", "backward", "non_adjacent_same_stage"] }
    ]);
    expect(topology.routingStages.failedConnectorIds).toEqual([]);
    expectExactPartition(topology);

    for (const name of ["duplicate", "compressed"] as const) {
      const deferred = await buildFixture(name);
      expect(deferred.routingStages.connectorPlans).toEqual([]);
      expectExactPartition(deferred);
    }

    const reorderedMeasuredScene = structuredClone(primary.measuredScene) as MeasuredScene;
    reorderedMeasuredScene.edges.reverse();
    const reordered = buildJourneyMapRoutingStages(
      reorderedMeasuredScene,
      primary.preRoutingPositionedScene
    );
    expect(reordered.connectorPlans.filter((plan) => plan.branch).map((plan) => ({
      id: plan.id,
      branch: plan.branch,
      priority: plan.priority,
      step2Route: plan.step2Route,
      provisionalRoute: plan.provisionalRoute
    }))).toEqual(primaryBranches.map((plan) => ({
      id: plan.id,
      branch: plan.branch,
      priority: plan.priority,
      step2Route: plan.step2Route,
      provisionalRoute: plan.provisionalRoute
    })));
    expect(reordered.diagnostics.filter((diagnostic) =>
      diagnostic.phase === "routing"
    )).toEqual([]);
  });

  it("builds the exact shared-east primary fan-out with a bounds-derived departure and local bypass", async () => {
    const fixture = await buildFixture("primary");
    const [direct, bypass] = fixture.routingStages.connectorPlans.slice(5, 7);
    expect(direct).toMatchObject({
      sourceEndpoint: {
        itemId: "J-201", portId: "J-201__flow_out", side: "east", x: 1156, y: 154
      },
      targetEndpoint: {
        itemId: "J-202", portId: "J-202__flow_in", side: "west", x: 1180, y: 116
      },
      stageGates: []
    });
    expect(direct?.step2Route.points).toEqual([
      { x: 1156, y: 154 }, { x: 1168, y: 154 },
      { x: 1168, y: 116 }, { x: 1180, y: 116 }
    ]);
    expect(direct?.provisionalRoute).toEqual(direct?.step2Route);
    expect(bypass).toMatchObject({
      sourceEndpoint: {
        itemId: "J-201", portId: "J-201__flow_out", side: "east", x: 1156, y: 154
      },
      targetEndpoint: {
        itemId: "J-203", portId: "J-203__escape_in", side: "south", x: 1540, y: 156
      },
      stageGates: [],
      stageLocalBypass: {
        stageId: "G-200",
        axis: "horizontal",
        nominalCoordinate: 228,
        span: { start: 1168, end: 1540 },
        endpointSpan: { start: 1156, end: 1540 },
        intermediateStepIds: ["J-202"],
        obstacleControls: [{ stepId: "J-202", entryX: 1180, exitX: 1404 }],
        order: 0,
        locked: false
      }
    });
    expect(bypass?.step2Route.points).toEqual([
      { x: 1156, y: 154 }, { x: 1168, y: 154 }, { x: 1168, y: 228 },
      { x: 1540, y: 228 }, { x: 1540, y: 156 }
    ]);
    expect(bypass?.provisionalRoute.points).toEqual([
      { x: 1156, y: 154 }, { x: 1168, y: 154 }, { x: 1168, y: 228 },
      { x: 1180, y: 228 }, { x: 1404, y: 228 },
      { x: 1540, y: 228 }, { x: 1540, y: 156 }
    ]);
    const buckets = new Map(fixture.routingStages.nodeEdgeBuckets.map((bucket) => [bucket.nodeId, bucket]));
    expect(buckets.get("J-201")?.east.startingConnectorIds).toEqual([direct?.id, bypass?.id]);
    expect(buckets.get("J-202")?.west.endingConnectorIds).toEqual([direct?.id]);
    expect(buckets.get("J-203")?.south.endingConnectorIds).toEqual([bypass?.id]);
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
    expect(fixture.routingStages.diagnostics.filter((diagnostic) =>
      diagnostic.phase === "routing"
    )).toEqual([]);
  });

  it("routes topology fan-out through one-sided gates and a root-peripheral branch track", async () => {
    const fixture = await buildFixture("topology");
    const [enterStage, outer, exitStage] = fixture.routingStages.connectorPlans;
    expect(enterStage).toMatchObject({
      sourceEndpoint: { itemId: "J-790", portId: "J-790__flow_out", side: "east", x: 256, y: 116 },
      targetEndpoint: { itemId: "J-701", portId: "J-701__flow_in", side: "west", x: 316, y: 116 },
      stageGates: [{ stageId: "G-700", side: "west", x: 296, y: 116, order: 0, locked: true }]
    });
    expect(enterStage?.step2Route.points).toEqual([{ x: 256, y: 116 }, { x: 316, y: 116 }]);
    expect(enterStage?.provisionalRoute.points).toEqual([
      { x: 256, y: 116 }, { x: 296, y: 116 }, { x: 316, y: 116 }
    ]);
    expect(outer).toMatchObject({
      sourceEndpoint: { itemId: "J-790", portId: "J-790__flow_out", side: "east", x: 256, y: 116 },
      targetEndpoint: { itemId: "J-791", portId: "J-791__escape_in", side: "south", x: 1952, y: 140 },
      stageGates: [],
      rootOuterBypass: {
        ownerContainerId: "root",
        axis: "horizontal",
        nominalCoordinate: 188,
        span: { start: 276, end: 1952 },
        endpointSpan: { start: 256, end: 1952 },
        intermediateRootItemIds: ["G-700"],
        obstacleControls: [{ rootItemId: "G-700", entryX: 296, exitX: 1800 }],
        order: 0,
        locked: false
      }
    });
    expect(outer?.step2Route.points).toEqual([
      { x: 256, y: 116 }, { x: 276, y: 116 }, { x: 276, y: 188 },
      { x: 1952, y: 188 }, { x: 1952, y: 140 }
    ]);
    expect(outer?.provisionalRoute.points).toEqual([
      { x: 256, y: 116 }, { x: 276, y: 116 }, { x: 276, y: 188 },
      { x: 296, y: 188 }, { x: 1800, y: 188 },
      { x: 1952, y: 188 }, { x: 1952, y: 140 }
    ]);
    expect(exitStage).toMatchObject({
      sourceEndpoint: { itemId: "J-714", portId: "J-714__flow_out", side: "east", x: 1780, y: 116 },
      targetEndpoint: { itemId: "J-791", portId: "J-791__flow_in", side: "west", x: 1840, y: 116 },
      stageGates: [{ stageId: "G-700", side: "east", x: 1800, y: 116, order: 0, locked: true }]
    });
    expect(exitStage?.step2Route.points).toEqual([{ x: 1780, y: 116 }, { x: 1840, y: 116 }]);
    expect(exitStage?.provisionalRoute.points).toEqual([
      { x: 1780, y: 116 }, { x: 1800, y: 116 }, { x: 1840, y: 116 }
    ]);
    const buckets = new Map(fixture.routingStages.nodeEdgeBuckets.map((bucket) => [bucket.nodeId, bucket]));
    expect(buckets.get("J-790")?.east.startingConnectorIds).toEqual([enterStage?.id, outer?.id]);
    expect(buckets.get("J-791")?.south.endingConnectorIds).toEqual([outer?.id]);
    expect(buckets.get("J-791")?.west.endingConnectorIds).toEqual([exitStage?.id]);
    for (const stage of ["step2", "provisional", "final_basic"] as const) {
      expect(validateJourneyMapRoutes(
        fixture.routingStages.connectorPlans,
        fixture.preRoutingPositionedScene,
        stage
      )).toEqual([]);
    }
    expect(fixture.routingStages.diagnostics.filter((diagnostic) =>
      diagnostic.phase === "routing"
    )).toEqual([]);
  });

  it("derives primary branch geometry across profiles without changing classification", async () => {
    const simple = await buildFixture("primary", "simple");
    const permissive = await buildFixture("primary", "permissive");
    const strict = await buildFixture("primary", "strict");
    expect(simple.routingStages.connectorPlans.map(edgeKey)).toEqual(strict.routingStages.connectorPlans.map(edgeKey));
    expect(permissive.routingStages.connectorPlans).toEqual(strict.routingStages.connectorPlans);
    const [simpleDirect, simpleBypass] = simple.routingStages.connectorPlans.slice(5, 7);
    expect(simpleDirect?.step2Route.points).toEqual([
      { x: 1156, y: 124 }, { x: 1168, y: 124 },
      { x: 1168, y: 116 }, { x: 1180, y: 116 }
    ]);
    expect(simpleBypass?.step2Route.points).toEqual([
      { x: 1156, y: 124 }, { x: 1168, y: 124 }, { x: 1168, y: 168 },
      { x: 1540, y: 168 }, { x: 1540, y: 156 }
    ]);
    expect(simpleBypass?.stageLocalBypass).toMatchObject({
      nominalCoordinate: 168,
      span: { start: 1168, end: 1540 },
      endpointSpan: { start: 1156, end: 1540 }
    });
    expect(simpleBypass?.branch?.departureControl).toMatchObject({
      nominalCoordinate: 1168,
      span: { start: 124, end: 168 }
    });
  });

  it("fails branch construction and validation visibly without activating Gate 7 fallbacks", async () => {
    const primary = await buildFixture("primary");
    const branchIds = primary.routingStages.connectorPlans.slice(5, 7).map((plan) => plan.id);
    const missingPortScene = structuredClone(primary.preRoutingPositionedScene) as PositionedScene;
    const source = findNode(missingPortScene, "J-201");
    source.ports = source.ports.filter((port) => port.role !== "journey_flow_out");
    const missingPort = buildJourneyMapRoutingStages(primary.measuredScene, missingPortScene);
    expect(missingPort.failedConnectorIds).toEqual(expect.arrayContaining(branchIds));
    expect(missingPort.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(expect.arrayContaining([
      "renderer.routing.journey_map_unresolved_endpoint",
      "renderer.routing.journey_map_edge_omitted"
    ]));

    const insufficientLocalScene = structuredClone(primary.preRoutingPositionedScene) as PositionedScene;
    findContainer(insufficientLocalScene, "G-200").height = 196;
    const insufficientLocal = buildJourneyMapRoutingStages(primary.measuredScene, insufficientLocalScene);
    expect(insufficientLocal.failedConnectorIds).toContain(branchIds[1]);
    expect(insufficientLocal.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(expect.arrayContaining([
      "renderer.routing.journey_map_archetype_fallback",
      "renderer.routing.journey_map_edge_omitted"
    ]));

    const topology = await buildFixture("topology");
    const insufficientRootScene = structuredClone(topology.preRoutingPositionedScene) as PositionedScene;
    insufficientRootScene.root.height = 188;
    const insufficientRoot = buildJourneyMapRoutingStages(topology.measuredScene, insufficientRootScene);
    expect(insufficientRoot.failedConnectorIds).toContain(topology.routingStages.connectorPlans[1]!.id);

    const malformedBranch = structuredClone(primary.routingStages.connectorPlans[6]!) as JourneyMapConnectorPlan;
    malformedBranch.branch!.sourceOrdinal = 2;
    expect(validateJourneyMapRoutes(
      [malformedBranch],
      primary.preRoutingPositionedScene,
      "provisional"
    ).map((diagnostic) => diagnostic.code)).toContain("renderer.routing.journey_map_archetype_fallback");

    const swappedBranchOrdinal = structuredClone(
      primary.routingStages.connectorPlans[6]!
    ) as JourneyMapConnectorPlan;
    swappedBranchOrdinal.branch!.sourceOrdinal = 0;
    expect(validateJourneyMapRoutes(
      [swappedBranchOrdinal],
      primary.preRoutingPositionedScene,
      "provisional",
      primary.measuredScene
    ).map((diagnostic) => diagnostic.code)).toContain("renderer.routing.journey_map_archetype_fallback");

    const malformedDeparture = structuredClone(primary.routingStages.connectorPlans[6]!) as JourneyMapConnectorPlan;
    malformedDeparture.branch!.departureControl!.nominalCoordinate += 1;
    expect(validateJourneyMapRoutes(
      [malformedDeparture],
      primary.preRoutingPositionedScene,
      "provisional"
    ).map((diagnostic) => diagnostic.code)).toContain("renderer.routing.journey_map_archetype_fallback");
    expect(primary.routingStages.diagnostics.some((diagnostic) =>
      diagnostic.code.includes("occupancy")
      || diagnostic.code.includes("capacity")
      || diagnostic.code.includes("expansion")
      || diagnostic.code.includes("separation")
    )).toBe(false);

    const unsupportedMeasuredScene = structuredClone(primary.measuredScene) as MeasuredScene;
    const sourceBranch = unsupportedMeasuredScene.edges.find((edge) =>
      edge.from.itemId === "J-201" && edge.to.itemId === "J-202"
    )!;
    const longCross = unsupportedMeasuredScene.edges.find((edge) =>
      edge.from.itemId === "J-204" && edge.to.itemId === "J-401"
    )!;
    unsupportedMeasuredScene.edges.push({
      ...structuredClone(longCross),
      id: "synthetic-long-cross-stage-branch",
      from: { ...structuredClone(sourceBranch.from) },
      viewMetadata: {
        journeyMap: {
          kind: "precedes",
          authorOrder: 99,
          sameEndpointOrdinal: 0,
          exactIdentityOrdinal: 0
        }
      }
    });
    const unsupported = buildJourneyMapRoutingStages(
      unsupportedMeasuredScene,
      primary.preRoutingPositionedScene
    );
    expect(unsupported.deferredConnectors.find((edge) =>
      edge.id === "synthetic-long-cross-stage-branch"
    )?.deferredFamilies).toEqual(["branch", "join", "long_cross_stage"]);
    expect(unsupported.failedConnectorIds).not.toContain("synthetic-long-cross-stage-branch");
  });
});

describe("journey map Gate 6 join fan-in routing", () => {
  it("routes exactly the two authored primary joins and preserves every accepted earlier plan", async () => {
    const primary = await buildFixture("primary");
    const joins = primary.routingStages.connectorPlans.slice(7);
    expect(joins.map((plan) => ({
      id: plan.id,
      edge: edgeKey(plan),
      owner: plan.ownerContainerId,
      archetype: plan.archetype,
      modifiers: plan.topologyModifiers,
      join: plan.join,
      rank: plan.priority.archetypeRank,
      authorOrder: plan.authorOrder
    }))).toEqual([
      {
        id: "J-202__PRECEDES__J-204__34ffe7148c62ef2de7d7441ff3c229f6cdb4caa830ec06c13e4fc135c1d271b4__0",
        edge: "J-202→J-204",
        owner: "G-200",
        archetype: "non_adjacent_forward_same_stage",
        modifiers: ["join"],
        join: {
          targetIndegree: 2,
          targetOrdinal: 0,
          arrivalControl: {
            axis: "vertical",
            nominalCoordinate: 1664,
            span: { start: 116, end: 168 },
            obstacleItemId: "J-203",
            obstacleBoundaryCoordinate: 1652,
            order: 0,
            locked: false
          }
        },
        rank: 5,
        authorOrder: 5
      },
      {
        id: "J-203__PRECEDES__J-204__507b45c44ab3c264dd2cf0e03b67cea5ea2e7d31b604dd0d7f5a434686a53ac9__0",
        edge: "J-203→J-204",
        owner: "G-200",
        archetype: "adjacent_forward_same_stage",
        modifiers: ["join"],
        join: { targetIndegree: 2, targetOrdinal: 1 },
        rank: 5,
        authorOrder: 6
      }
    ]);
    expect(primary.routingStages.connectorPlans).toHaveLength(9);
    expect(primary.routingStages.deferredConnectors).toEqual([]);
    expect(primary.routingStages.failedConnectorIds).toEqual([]);
    expectExactPartition(primary);

    for (const [name, routed, deferred] of [
      ["ordering_ownership", 3, 0],
      ["topology", 4, 5],
      ["duplicate", 0, 3],
      ["compressed", 0, 18]
    ] as const) {
      const fixture = await buildFixture(name);
      expect(fixture.routingStages.connectorPlans).toHaveLength(routed);
      expect(fixture.routingStages.deferredConnectors).toHaveLength(deferred);
      expect(fixture.routingStages.failedConnectorIds).toEqual([]);
      expectExactPartition(fixture);
    }

    const reorderedMeasuredScene = structuredClone(primary.measuredScene) as MeasuredScene;
    reorderedMeasuredScene.edges.reverse();
    const reordered = buildJourneyMapRoutingStages(
      reorderedMeasuredScene,
      primary.preRoutingPositionedScene
    );
    expect(reordered.connectorPlans.filter((plan) => plan.join)).toEqual(joins);
    expect(reordered.diagnostics.filter((diagnostic) => diagnostic.phase === "routing")).toEqual([]);

    const withoutJoins = structuredClone(primary.measuredScene) as MeasuredScene;
    const joinIds = new Set(joins.map((plan) => plan.id));
    withoutJoins.edges = withoutJoins.edges.filter((edge) => !joinIds.has(edge.id));
    const acceptedEarlier = buildJourneyMapRoutingStages(
      withoutJoins,
      primary.preRoutingPositionedScene
    );
    expect(primary.routingStages.connectorPlans.slice(0, 7)).toEqual(acceptedEarlier.connectorPlans);
  });

  it("builds the common-west direct and Stage-local arrival templates across profiles", async () => {
    const strict = await buildFixture("primary", "strict");
    const [bypass, direct] = strict.routingStages.connectorPlans.slice(7);
    expect(bypass).toMatchObject({
      sourceEndpoint: {
        itemId: "J-202", portId: "J-202__escape_out", side: "south", x: 1292, y: 140
      },
      targetEndpoint: {
        itemId: "J-204", portId: "J-204__flow_in", side: "west", x: 1676, y: 116
      },
      stageGates: [],
      stageLocalBypass: {
        stageId: "G-200",
        axis: "horizontal",
        nominalCoordinate: 168,
        span: { start: 1292, end: 1664 },
        endpointSpan: { start: 1292, end: 1676 },
        intermediateStepIds: ["J-203"],
        obstacleControls: [{ stepId: "J-203", entryX: 1428, exitX: 1652 }],
        order: 0,
        locked: false
      }
    });
    expect(bypass?.step2Route.points).toEqual([
      { x: 1292, y: 140 }, { x: 1292, y: 168 }, { x: 1664, y: 168 },
      { x: 1664, y: 116 }, { x: 1676, y: 116 }
    ]);
    expect(bypass?.provisionalRoute.points).toEqual([
      { x: 1292, y: 140 }, { x: 1292, y: 168 },
      { x: 1428, y: 168 }, { x: 1652, y: 168 }, { x: 1664, y: 168 },
      { x: 1664, y: 116 }, { x: 1676, y: 116 }
    ]);
    expect(direct).toMatchObject({
      sourceEndpoint: {
        itemId: "J-203", portId: "J-203__flow_out", side: "east", x: 1652, y: 124
      },
      targetEndpoint: {
        itemId: "J-204", portId: "J-204__flow_in", side: "west", x: 1676, y: 116
      },
      stageGates: []
    });
    expect(direct?.step2Route.points).toEqual([
      { x: 1652, y: 124 }, { x: 1664, y: 124 },
      { x: 1664, y: 116 }, { x: 1676, y: 116 }
    ]);
    expect(direct?.provisionalRoute).toEqual(direct?.step2Route);

    const buckets = new Map(strict.routingStages.nodeEdgeBuckets.map((bucket) => [bucket.nodeId, bucket]));
    expect(buckets.get("J-202")?.south.startingConnectorIds).toEqual([bypass?.id]);
    expect(buckets.get("J-203")?.east.startingConnectorIds).toEqual([direct?.id]);
    expect(buckets.get("J-204")?.west.endingConnectorIds).toEqual([bypass?.id, direct?.id]);
    for (const stage of ["step2", "provisional", "final_basic"] as const) {
      expect(validateJourneyMapRoutes(
        strict.routingStages.connectorPlans,
        strict.preRoutingPositionedScene,
        stage,
        strict.measuredScene
      )).toEqual([]);
    }

    const simple = await buildFixture("primary", "simple");
    const permissive = await buildFixture("primary", "permissive");
    expect(simple.routingStages.connectorPlans.slice(7)).toEqual(strict.routingStages.connectorPlans.slice(7));
    expect(permissive.routingStages.connectorPlans.slice(7)).toEqual(strict.routingStages.connectorPlans.slice(7));

    const first = await renderJourneyMapRoutingArtifacts(
      strict.projection,
      strict.graph,
      strict.bundle,
      strict.view,
      "strict"
    );
    const second = await renderJourneyMapRoutingArtifacts(
      strict.projection,
      strict.graph,
      strict.bundle,
      strict.view,
      "strict"
    );
    const directPng = await renderPositionedSceneToPng(first.routingStages.provisionalPositionedScene);
    expect(first.provisionalSvg).toBe(directPng.svg);
    expect(sha256(first.provisionalPng)).toBe(sha256(directPng.png));
    expect(sha256(first.provisionalSvg)).toBe(sha256(second.provisionalSvg));
    expect(sha256(first.provisionalPng)).toBe(sha256(second.provisionalPng));
    expect(first.diagnostics.some((diagnostic) =>
      diagnostic.severity === "warn" || diagnostic.severity === "error"
    )).toBe(false);
  });

  it("fails malformed joins visibly and defers unsupported join morphologies without Gate 7 behavior", async () => {
    const primary = await buildFixture("primary");
    const [bypass, direct] = primary.routingStages.connectorPlans.slice(7);
    const joinIds = [bypass!.id, direct!.id];

    const missingTargetPortScene = structuredClone(primary.preRoutingPositionedScene) as PositionedScene;
    const target = findNode(missingTargetPortScene, "J-204");
    target.ports = target.ports.filter((port) => port.role !== "journey_flow_in");
    const missingTargetPort = buildJourneyMapRoutingStages(primary.measuredScene, missingTargetPortScene);
    expect(missingTargetPort.failedConnectorIds).toEqual(expect.arrayContaining(joinIds));

    const missingSourcePortScene = structuredClone(primary.preRoutingPositionedScene) as PositionedScene;
    const bypassSource = findNode(missingSourcePortScene, "J-202");
    bypassSource.ports = bypassSource.ports.filter((port) => port.role !== "journey_escape_out");
    const missingSourcePort = buildJourneyMapRoutingStages(primary.measuredScene, missingSourcePortScene);
    expect(missingSourcePort.failedConnectorIds).toContain(bypass!.id);
    expect(missingSourcePort.failedConnectorIds).not.toContain(direct!.id);

    const insufficientSpaceScene = structuredClone(primary.preRoutingPositionedScene) as PositionedScene;
    findContainer(insufficientSpaceScene, "G-200").height = 136;
    const insufficientSpace = buildJourneyMapRoutingStages(primary.measuredScene, insufficientSpaceScene);
    expect(insufficientSpace.failedConnectorIds).toContain(bypass!.id);
    expect(insufficientSpace.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(expect.arrayContaining([
      "renderer.routing.journey_map_archetype_fallback",
      "renderer.routing.journey_map_edge_omitted"
    ]));

    const malformedDegree = structuredClone(bypass!) as JourneyMapConnectorPlan;
    malformedDegree.join!.targetIndegree = 3;
    const swappedOrdinal = structuredClone(bypass!) as JourneyMapConnectorPlan;
    swappedOrdinal.join!.targetOrdinal = 1;
    const malformedArrival = structuredClone(bypass!) as JourneyMapConnectorPlan;
    malformedArrival.join!.arrivalControl!.nominalCoordinate += 1;
    for (const malformed of [malformedDegree, swappedOrdinal, malformedArrival]) {
      expect(validateJourneyMapRoutes(
        [malformed],
        primary.preRoutingPositionedScene,
        "provisional",
        primary.measuredScene
      ).map((diagnostic) => diagnostic.code)).toContain(
        "renderer.routing.journey_map_archetype_fallback"
      );
    }

    const singleIncomingScene = structuredClone(primary.measuredScene) as MeasuredScene;
    singleIncomingScene.edges = singleIncomingScene.edges.filter((edge) => edge.id !== direct!.id);
    const falseSingleIncomingJoin = structuredClone(bypass!) as JourneyMapConnectorPlan;
    falseSingleIncomingJoin.join!.targetIndegree = 1;
    expect(validateJourneyMapRoutes(
      [falseSingleIncomingJoin],
      primary.preRoutingPositionedScene,
      "provisional",
      singleIncomingScene
    ).map((diagnostic) => diagnostic.code)).toContain(
      "renderer.routing.journey_map_archetype_fallback"
    );

    const branchingSourceScene = structuredClone(primary.measuredScene) as MeasuredScene;
    const bypassMeasuredEdge = branchingSourceScene.edges.find((edge) => edge.id === bypass!.id)!;
    branchingSourceScene.edges.push({
      ...structuredClone(bypassMeasuredEdge),
      id: "synthetic-second-outgoing-from-join-source",
      to: { ...structuredClone(bypassMeasuredEdge.to), itemId: "J-203" },
      viewMetadata: {
        journeyMap: {
          kind: "precedes",
          authorOrder: 99,
          sameEndpointOrdinal: 0,
          exactIdentityOrdinal: 0
        }
      }
    });
    expect(validateJourneyMapRoutes(
      [bypass!],
      primary.preRoutingPositionedScene,
      "provisional",
      branchingSourceScene
    ).map((diagnostic) => diagnostic.code)).toContain(
      "renderer.routing.journey_map_archetype_fallback"
    );

    const unsupportedMeasuredScene = structuredClone(primary.measuredScene) as MeasuredScene;
    const longCross = unsupportedMeasuredScene.edges.find((edge) =>
      edge.from.itemId === "J-204" && edge.to.itemId === "J-401"
    )!;
    unsupportedMeasuredScene.edges.push({
      ...structuredClone(longCross),
      id: "synthetic-root-to-contained-join",
      from: { ...structuredClone(longCross.from), itemId: "J-260" },
      viewMetadata: {
        journeyMap: {
          kind: "precedes",
          authorOrder: 99,
          sameEndpointOrdinal: 0,
          exactIdentityOrdinal: 0
        }
      }
    });
    const unsupported = buildJourneyMapRoutingStages(
      unsupportedMeasuredScene,
      primary.preRoutingPositionedScene
    );
    expect(unsupported.deferredConnectors.find((edge) =>
      edge.id === "synthetic-root-to-contained-join"
    )?.deferredFamilies).toEqual(["root_step", "join"]);
    expect(unsupported.failedConnectorIds).not.toContain("synthetic-root-to-contained-join");
    expect(primary.routingStages.diagnostics.some((diagnostic) =>
      diagnostic.code.includes("occupancy")
      || diagnostic.code.includes("capacity")
      || diagnostic.code.includes("expansion")
      || diagnostic.code.includes("separation")
    )).toBe(false);
  });
});

describe("journey map Gate 6 backward routing", () => {
  it("routes exactly the three non-cyclic backward occurrences after every accepted earlier family", async () => {
    const ordering = await buildFixture("ordering_ownership");
    const orderingBackward = ordering.routingStages.connectorPlans.filter((plan) =>
      plan.priority.archetypeRank === 6
    );
    expect(orderingBackward.map((plan) => ({
      id: plan.id,
      edge: edgeKey(plan),
      owner: plan.ownerContainerId,
      archetype: plan.archetype,
      rank: plan.priority.archetypeRank,
      authorOrder: plan.authorOrder,
      modifiers: plan.topologyModifiers,
      branch: plan.branch
    }))).toEqual([
      {
        id: "J-501__PRECEDES__J-502__51e0788a6e29bb43634e865529e007ccee051ad1e572b8494b89efdd4ae46b2c__0",
        edge: "J-501→J-502",
        owner: "G-500",
        archetype: "backward_same_stage",
        rank: 6,
        authorOrder: 1,
        modifiers: undefined,
        branch: undefined
      },
      {
        id: "J-591__PRECEDES__J-590__f4e82fc8e90b608618ba9db0adfc05a2b84b27fd7ad9d5165dc1473d75b3dd85__0",
        edge: "J-591→J-590",
        owner: "root",
        archetype: "backward_root_step",
        rank: 6,
        authorOrder: 2,
        modifiers: undefined,
        branch: undefined
      }
    ]);
    expect(ordering.routingStages.connectorPlans).toHaveLength(3);
    expect(ordering.routingStages.deferredConnectors).toEqual([]);
    expect(ordering.routingStages.failedConnectorIds).toEqual([]);
    expectExactPartition(ordering);

    const topology = await buildFixture("topology");
    const topologyBackward = topology.routingStages.connectorPlans.find((plan) =>
      plan.archetype === "backward_same_stage"
    );
    expect(topologyBackward).toMatchObject({
      id: "J-714__PRECEDES__J-713__48be4303b0633d1150403027b444b86f13dc6ac7e956b46aa2bdaa0956251025__0",
      from: "J-714",
      to: "J-713",
      ownerContainerId: "G-700",
      archetype: "backward_same_stage",
      priority: { archetypeRank: 6, sourceStepOrder: 5, targetStepOrder: 4, authorOrder: 7 },
      topologyModifiers: ["branch"],
      branch: { sourceOutdegree: 2, sourceOrdinal: 0 }
    });
    expect(topologyBackward?.join).toBeUndefined();
    expect(topology.routingStages.connectorPlans).toHaveLength(4);
    expect(topology.routingStages.deferredConnectors).toHaveLength(5);
    expect(topology.routingStages.deferredConnectors.map(edgeKey)).toEqual([
      "J-701→J-702", "J-702→J-701", "J-711→J-712", "J-712→J-711", "J-713→J-713"
    ]);
    expect(topology.routingStages.failedConnectorIds).toEqual([]);
    expectExactPartition(topology);

    for (const [name, routed, deferred] of [
      ["primary", 9, 0],
      ["duplicate", 0, 3],
      ["compressed", 0, 18]
    ] as const) {
      const fixture = await buildFixture(name);
      expect(fixture.routingStages.connectorPlans).toHaveLength(routed);
      expect(fixture.routingStages.deferredConnectors).toHaveLength(deferred);
      expect(fixture.routingStages.failedConnectorIds).toEqual([]);
      expectExactPartition(fixture);
    }

    const reversedMeasuredScene = structuredClone(topology.measuredScene) as MeasuredScene;
    reversedMeasuredScene.edges.reverse();
    const reversed = buildJourneyMapRoutingStages(
      reversedMeasuredScene,
      topology.preRoutingPositionedScene
    );
    expect(reversed.connectorPlans.find((plan) => plan.archetype === "backward_same_stage"))
      .toEqual(topologyBackward);

    expect(topology.routingStages.connectorPlans.slice(0, 3).map((plan) => plan.id)).toEqual([
      "J-790__PRECEDES__J-701__661a1f868e72e80d2f47aedd3157ec09171f344f4a9aa62486fc7da5457bd384__0",
      "J-790__PRECEDES__J-791__71d18a11d3f80b2283cb17a0d68e86a327e54fca708def24c118a265fc3cd6be__0",
      "J-714__PRECEDES__J-791__37d24514299e09f03f8d2a42e59503f5de765431b1348d451dfadcb4d8555722__0"
    ]);
  });

  it("builds south-port Stage-local and reverse root-outer templates with exact controls", async () => {
    const ordering = await buildFixture("ordering_ownership");
    const [sameStage, rootReturn] = ordering.routingStages.connectorPlans.filter((plan) =>
      plan.priority.archetypeRank === 6
    );
    expect(sameStage).toMatchObject({
      sourceEndpoint: {
        itemId: "J-501", portId: "J-501__escape_out", side: "south", x: 1476, y: 140
      },
      targetEndpoint: {
        itemId: "J-502", portId: "J-502__escape_in", side: "south", x: 1228, y: 140
      },
      stageGates: [],
      stageLocalBypass: {
        stageId: "G-500",
        axis: "horizontal",
        nominalCoordinate: 152,
        span: { start: 1228, end: 1476 },
        intermediateStepIds: [],
        obstacleControls: [],
        order: 0,
        locked: false
      }
    });
    expect(sameStage?.step2Route.points).toEqual([
      { x: 1476, y: 140 }, { x: 1476, y: 152 },
      { x: 1228, y: 152 }, { x: 1228, y: 140 }
    ]);
    expect(sameStage?.provisionalRoute).toEqual(sameStage?.step2Route);

    expect(rootReturn).toMatchObject({
      sourceEndpoint: {
        itemId: "J-591", portId: "J-591__escape_out", side: "south", x: 1760, y: 140
      },
      targetEndpoint: {
        itemId: "J-590", portId: "J-590__escape_in", side: "south", x: 696, y: 140
      },
      stageGates: [],
      rootOuterBypass: {
        ownerContainerId: "root",
        axis: "horizontal",
        nominalCoordinate: 188,
        span: { start: 696, end: 1760 },
        intermediateRootItemIds: ["G-500"],
        obstacleControls: [{ rootItemId: "G-500", entryX: 848, exitX: 1608 }],
        order: 0,
        locked: false
      }
    });
    expect(rootReturn?.step2Route.points).toEqual([
      { x: 1760, y: 140 }, { x: 1760, y: 188 },
      { x: 696, y: 188 }, { x: 696, y: 140 }
    ]);
    expect(rootReturn?.provisionalRoute.points).toEqual([
      { x: 1760, y: 140 }, { x: 1760, y: 188 },
      { x: 1608, y: 188 }, { x: 848, y: 188 },
      { x: 696, y: 188 }, { x: 696, y: 140 }
    ]);

    const topology = await buildFixture("topology");
    const topologyBackward = topology.routingStages.connectorPlans.find((plan) =>
      plan.archetype === "backward_same_stage"
    );
    expect(topologyBackward).toMatchObject({
      sourceEndpoint: {
        itemId: "J-714", portId: "J-714__escape_out", side: "south", x: 1668, y: 140
      },
      targetEndpoint: {
        itemId: "J-713", portId: "J-713__escape_in", side: "south", x: 1420, y: 140
      },
      stageGates: [],
      stageLocalBypass: {
        stageId: "G-700", nominalCoordinate: 152,
        span: { start: 1420, end: 1668 },
        endpointSpan: { start: 1420, end: 1668 },
        intermediateStepIds: [], obstacleControls: []
      }
    });
    expect(topologyBackward?.provisionalRoute.points).toEqual([
      { x: 1668, y: 140 }, { x: 1668, y: 152 },
      { x: 1420, y: 152 }, { x: 1420, y: 140 }
    ]);

    for (const [fixture, plans] of [
      [ordering, ordering.routingStages.connectorPlans],
      [topology, topology.routingStages.connectorPlans]
    ] as const) {
      for (const stage of ["step2", "provisional", "final_basic"] as const) {
        expect(validateJourneyMapRoutes(
          plans,
          fixture.preRoutingPositionedScene,
          stage,
          fixture.measuredScene
        )).toEqual([]);
      }
    }

    const first = await renderJourneyMapRoutingArtifacts(
      ordering.projection, ordering.graph, ordering.bundle, ordering.view, "strict"
    );
    const second = await renderJourneyMapRoutingArtifacts(
      ordering.projection, ordering.graph, ordering.bundle, ordering.view, "strict"
    );
    const directPng = await renderPositionedSceneToPng(first.routingStages.provisionalPositionedScene);
    expect(first.provisionalSvg).toBe(directPng.svg);
    expect(sha256(first.provisionalPng)).toBe(sha256(directPng.png));
    expect(sha256(first.provisionalSvg)).toBe(sha256(second.provisionalSvg));
    expect(sha256(first.provisionalPng)).toBe(sha256(second.provisionalPng));
    expect(first.diagnostics.some((diagnostic) =>
      diagnostic.severity === "warn" || diagnostic.severity === "error"
    )).toBe(false);
  });

  it("fails malformed backward contracts visibly and keeps cycles, self-loops, duplicates, and Gate 7 blocked", async () => {
    const ordering = await buildFixture("ordering_ownership");
    const sameStage = ordering.routingStages.connectorPlans.find((plan) =>
      plan.archetype === "backward_same_stage"
    )!;
    const rootReturn = ordering.routingStages.connectorPlans.find((plan) =>
      plan.archetype === "backward_root_step"
    )!;

    const missingPortScene = structuredClone(ordering.preRoutingPositionedScene) as PositionedScene;
    const source = findNode(missingPortScene, "J-501");
    source.ports = source.ports.filter((port) => port.role !== "journey_escape_out");
    const missingPort = buildJourneyMapRoutingStages(ordering.measuredScene, missingPortScene);
    expect(missingPort.failedConnectorIds).toContain(sameStage.id);
    expect(missingPort.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(expect.arrayContaining([
      "renderer.routing.journey_map_unresolved_endpoint",
      "renderer.routing.journey_map_edge_omitted"
    ]));

    const insufficientStage = structuredClone(ordering.preRoutingPositionedScene) as PositionedScene;
    findContainer(insufficientStage, "G-500").height = 120;
    expect(buildJourneyMapRoutingStages(ordering.measuredScene, insufficientStage).failedConnectorIds)
      .toContain(sameStage.id);
    const insufficientRoot = structuredClone(ordering.preRoutingPositionedScene) as PositionedScene;
    insufficientRoot.root.height = 188;
    expect(buildJourneyMapRoutingStages(ordering.measuredScene, insufficientRoot).failedConnectorIds)
      .toContain(rootReturn.id);

    const malformedRank = structuredClone(sameStage) as JourneyMapConnectorPlan;
    malformedRank.priority.archetypeRank = 5;
    const malformedDirection = structuredClone(sameStage) as JourneyMapConnectorPlan;
    malformedDirection.archetype = "non_adjacent_forward_same_stage";
    const swappedRootControls = structuredClone(rootReturn) as JourneyMapConnectorPlan;
    [swappedRootControls.provisionalRoute.points[2], swappedRootControls.provisionalRoute.points[3]] = [
      swappedRootControls.provisionalRoute.points[3]!,
      swappedRootControls.provisionalRoute.points[2]!
    ];
    for (const malformed of [malformedRank, malformedDirection, swappedRootControls]) {
      expect(validateJourneyMapRoutes(
        [malformed], ordering.preRoutingPositionedScene, "provisional", ordering.measuredScene
      ).map((diagnostic) => diagnostic.code)).toContain(
        "renderer.routing.journey_map_archetype_fallback"
      );
    }

    const branchingRootMeasuredScene = structuredClone(ordering.measuredScene) as MeasuredScene;
    const measuredRootReturn = branchingRootMeasuredScene.edges.find((edge) =>
      edge.id === rootReturn.id
    )!;
    branchingRootMeasuredScene.edges.push({
      ...structuredClone(measuredRootReturn),
      id: "synthetic-branching-root-backward",
      to: { ...structuredClone(measuredRootReturn.to), itemId: "J-501" },
      viewMetadata: {
        journeyMap: {
          kind: "precedes", authorOrder: 99, sameEndpointOrdinal: 0, exactIdentityOrdinal: 0
        }
      }
    });
    const branchingRoot = buildJourneyMapRoutingStages(
      branchingRootMeasuredScene,
      ordering.preRoutingPositionedScene
    );
    expect(branchingRoot.failedConnectorIds).not.toContain(rootReturn.id);
    expect(branchingRoot.deferredConnectors.find((edge) => edge.id === rootReturn.id))
      .toMatchObject({ deferredFamilies: ["root_step", "branch", "backward"] });

    const topology = await buildFixture("topology");
    const topologyBackward = topology.routingStages.connectorPlans.find((plan) =>
      plan.archetype === "backward_same_stage"
    )!;
    const malformedBranch = structuredClone(topologyBackward) as JourneyMapConnectorPlan;
    malformedBranch.branch!.sourceOrdinal = 1;
    expect(validateJourneyMapRoutes(
      [malformedBranch], topology.preRoutingPositionedScene, "provisional", topology.measuredScene
    ).map((diagnostic) => diagnostic.code)).toContain(
      "renderer.routing.journey_map_archetype_fallback"
    );

    const cyclicMeasuredScene = structuredClone(topology.measuredScene) as MeasuredScene;
    const measuredBackward = cyclicMeasuredScene.edges.find((edge) => edge.id === topologyBackward.id)!;
    cyclicMeasuredScene.edges.push({
      ...structuredClone(measuredBackward),
      id: "synthetic-cycle-return",
      from: { ...structuredClone(measuredBackward.from), itemId: "J-713" },
      to: { ...structuredClone(measuredBackward.to), itemId: "J-714" },
      viewMetadata: {
        journeyMap: {
          kind: "precedes", authorOrder: 99, sameEndpointOrdinal: 0, exactIdentityOrdinal: 0
        }
      }
    });
    expect(validateJourneyMapRoutes(
      [topologyBackward], topology.preRoutingPositionedScene, "provisional", cyclicMeasuredScene
    ).map((diagnostic) => diagnostic.code)).toContain(
      "renderer.routing.journey_map_archetype_fallback"
    );

    expect(topology.routingStages.deferredConnectors.map((edge) => edge.deferredFamilies)).toEqual([
      ["cycle"],
      ["cycle", "join", "backward", "non_adjacent_same_stage"],
      ["cycle"],
      ["cycle", "backward", "non_adjacent_same_stage"],
      ["self_loop", "join", "backward", "non_adjacent_same_stage"]
    ]);
    const duplicate = await buildFixture("duplicate");
    expect(duplicate.routingStages.connectorPlans).toEqual([]);
    expect(duplicate.routingStages.deferredConnectors).toHaveLength(3);
    expect(ordering.routingStages.diagnostics.some((diagnostic) =>
      diagnostic.code.includes("occupancy")
      || diagnostic.code.includes("capacity")
      || diagnostic.code.includes("expansion")
      || diagnostic.code.includes("separation")
      || diagnostic.code === "renderer.routing.journey_map_peripheral_backward_edge"
    )).toBe(false);
  });
});
