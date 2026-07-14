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
  extractJourneyMapOccupancy,
  journeyMapDuplicateLaneIndex,
  JOURNEY_MAP_TRACK_SEPARATION,
  validateJourneyMapBasicRoutes,
  validateJourneyMapExpansionBound,
  validateJourneyMapResolvedStages,
  validateJourneyMapRoutes,
  type JourneyMapConnectorPlan,
  type JourneyMapOccupancyRecord,
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

  it("preserves exact fixture partitions as later accepted Gate 6 families accumulate", async () => {
    const cases = [
      ["primary", 9],
      ["ordering_ownership", 3],
      ["topology", 9],
      ["duplicate", 3],
      ["compressed", 18]
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

describe("journey map Gate 7 typed occupancy extraction", () => {
  function canonicalRuns(route: PositionedRoute): Array<{
    axis: "horizontal" | "vertical";
    coordinate: number;
    span: { start: number; end: number };
    routeSegmentIndexes: number[];
  }> {
    const runs: Array<{
      axis: "horizontal" | "vertical";
      coordinate: number;
      span: { start: number; end: number };
      routeSegmentIndexes: number[];
    }> = [];
    segments(route).forEach(({ start, end }, routeSegmentIndex) => {
      const axis = start.y === end.y ? "horizontal" : "vertical";
      const coordinate = axis === "horizontal" ? start.y : start.x;
      const span = axis === "horizontal"
        ? { start: Math.min(start.x, end.x), end: Math.max(start.x, end.x) }
        : { start: Math.min(start.y, end.y), end: Math.max(start.y, end.y) };
      const previous = runs.at(-1);
      if (previous && previous.axis === axis && previous.coordinate === coordinate) {
        previous.span.start = Math.min(previous.span.start, span.start);
        previous.span.end = Math.max(previous.span.end, span.end);
        previous.routeSegmentIndexes.push(routeSegmentIndex);
      } else {
        runs.push({ axis, coordinate, span, routeSegmentIndexes: [routeSegmentIndex] });
      }
    });
    return runs;
  }

  function expectRecordRecomputes(
    record: JourneyMapOccupancyRecord,
    planById: ReadonlyMap<string, JourneyMapConnectorPlan>
  ): void {
    const plan = planById.get(record.connectorId);
    expect(plan).toBeDefined();
    const run = canonicalRuns(plan!.provisionalRoute)[record.segmentRunIndex];
    expect(run).toBeDefined();
    expect(record.routeSegmentIndex).toBe(run!.routeSegmentIndexes[0]);
    expect(record.axis).toBe(run!.axis);
    expect(record.nominalCoordinate).toBe(run!.coordinate);
    expect(record.resolvedCoordinate).toBe(run!.coordinate);
    expect(record.span).toEqual(run!.span);
    expect(record.ownerContainerId).toBe(plan!.ownerContainerId);
    expect(record.archetype).toBe(plan!.archetype);
    expect(record.priority).toEqual(plan!.priority);
    expect(record.priority).not.toBe(plan!.priority);
    expect(record.resourceKey.length).toBeGreaterThan(0);
  }

  it("extracts every locked resource kind with complete recomputable records across all profile-runs", async () => {
    const fixtures = await Promise.all([
      buildFixture("primary", "simple"),
      buildFixture("primary", "permissive"),
      buildFixture("primary", "strict"),
      buildFixture("ordering_ownership"),
      buildFixture("topology"),
      buildFixture("duplicate"),
      buildFixture("compressed")
    ]);
    const expectedResourceKinds = [
      "adjacent_step_gap",
      "arrival_stem",
      "departure_stem",
      "inter_root_item_gutter",
      "node_side",
      "obstacle_swerve",
      "root_outer_bypass",
      "stage_boundary_gate",
      "stage_local_bypass"
    ];
    const actualResourceKinds = new Set<string>();

    for (const fixture of fixtures) {
      const { connectorPlans, nominalOccupancy: occupancy } = fixture.routingStages;
      const planById = new Map(connectorPlans.map((plan) => [plan.id, plan] as const));
      expect(occupancy.length).toBeGreaterThan(connectorPlans.length);
      expect(new Set(occupancy.map((record) => record.connectorId))).toEqual(
        new Set(connectorPlans.map((plan) => plan.id))
      );
      const recordIdentities = occupancy.map((record) =>
        `${record.connectorId}|${record.resourceKey}|${record.axis}|${record.segmentRunIndex}`
      );
      expect(new Set(recordIdentities).size).toBe(recordIdentities.length);
      occupancy.forEach((record) => {
        actualResourceKinds.add(record.resource.kind);
        expectRecordRecomputes(record, planById);
      });

      const extracted = extractJourneyMapOccupancy(connectorPlans, fixture.preRoutingPositionedScene);
      const reverseExtracted = extractJourneyMapOccupancy(
        [...connectorPlans].reverse(),
        fixture.preRoutingPositionedScene
      );
      expect(extracted).toEqual(occupancy);
      expect(reverseExtracted).toEqual(occupancy);
      expect(validateJourneyMapResolvedStages(
        connectorPlans,
        fixture.routingStages.nominalOccupancy,
        fixture.routingStages.occupancy,
        fixture.routingStages.resolvedConnectors,
        fixture.routingStages.expansionAttempts,
        fixture.preRoutingPositionedScene,
        fixture.routingStages.finalPositionedScene
      )).toEqual([]);
    }

    expect([...actualResourceKinds].sort()).toEqual(expectedResourceKinds);
  });

  it("keeps every accepted Gate 6 plan and route byte-for-byte immutable while extracting occupancy", async () => {
    const fixtures = await Promise.all([
      buildFixture("primary"),
      buildFixture("ordering_ownership"),
      buildFixture("topology"),
      buildFixture("duplicate"),
      buildFixture("compressed")
    ]);

    for (const fixture of fixtures) {
      const before = structuredClone(fixture.routingStages.connectorPlans);
      const beforeScenes = {
        step2: structuredClone(fixture.routingStages.step2PositionedScene),
        provisional: structuredClone(fixture.routingStages.provisionalPositionedScene),
        finalBasic: structuredClone(fixture.routingStages.finalBasicPositionedScene)
      };
      const occupancy = extractJourneyMapOccupancy(
        fixture.routingStages.connectorPlans,
        fixture.preRoutingPositionedScene
      );
      expect(occupancy).toEqual(fixture.routingStages.nominalOccupancy);
      expect(fixture.routingStages.connectorPlans).toEqual(before);
      expect(fixture.routingStages.step2PositionedScene).toEqual(beforeScenes.step2);
      expect(fixture.routingStages.provisionalPositionedScene).toEqual(beforeScenes.provisional);
      expect(fixture.routingStages.finalBasicPositionedScene).toEqual(beforeScenes.finalBasic);
    }
  });

  it("late-orders the isolated duplicate proof onto three legal 16px-separated endpoint tracks", async () => {
    const fixture = await buildFixture("duplicate");
    const { connectorPlans, resolvedConnectors, occupancy, step3PositionedScene, finalPositionedScene } =
      fixture.routingStages;
    expect(resolvedConnectors.map((state) => state.connectorId)).toEqual(
      connectorPlans.map((plan) => plan.id)
    );
    expect(resolvedConnectors.map((state) => state.sourceEndpoint.offset)).toEqual([24, 8, 40]);
    expect(resolvedConnectors.map((state) => state.targetEndpoint.offset)).toEqual([24, 8, 40]);
    expect(resolvedConnectors.map((state) => state.preparedRoute.points)).toEqual([
      [{ x: 256, y: 56 }, { x: 296, y: 56 }],
      [{ x: 256, y: 40 }, { x: 296, y: 40 }],
      [{ x: 256, y: 72 }, { x: 296, y: 72 }]
    ]);
    expect(resolvedConnectors.map((state) => state.finalRoute)).toEqual(
      resolvedConnectors.map((state) => state.preparedRoute)
    );
    const sortedSourceYs = resolvedConnectors
      .map((state) => state.sourceEndpoint.y)
      .sort((left, right) => left - right);
    const sortedTargetYs = resolvedConnectors
      .map((state) => state.targetEndpoint.y)
      .sort((left, right) => left - right);
    expect(sortedSourceYs).toEqual([40, 56, 72]);
    expect(sortedTargetYs).toEqual([40, 56, 72]);
    expect(sortedSourceYs.slice(1).map((value, index) => value - sortedSourceYs[index]!))
      .toEqual([JOURNEY_MAP_TRACK_SEPARATION, JOURNEY_MAP_TRACK_SEPARATION]);
    expect(new Set(step3PositionedScene.edges.map((edge) => edge.from.y)).size).toBe(3);
    expect(new Set(step3PositionedScene.edges.map((edge) => edge.to.y)).size).toBe(3);
    expect(finalPositionedScene.edges).toEqual(step3PositionedScene.edges);

    const endpointRecords = occupancy.filter((record) =>
      record.resource.kind === "node_side"
      || record.resource.kind === "departure_stem"
      || record.resource.kind === "arrival_stem"
    );
    expect(endpointRecords.some((record) =>
      record.nominalCoordinate !== record.resolvedCoordinate
    )).toBe(true);
    expect(endpointRecords.every((record) =>
      [40, 56, 72].includes(record.resolvedCoordinate)
    )).toBe(true);
    expect(fixture.routingStages.expansionAttempts).toEqual([]);
  });

  it("keeps duplicate resolution deterministic under measured-edge reversal and derives final PNG from final SVG", async () => {
    const fixture = await buildFixture("duplicate");
    const reversed = buildJourneyMapRoutingStages(
      { ...structuredClone(fixture.measuredScene), edges: [...fixture.measuredScene.edges].reverse() },
      fixture.preRoutingPositionedScene
    );
    expect(reversed.resolvedConnectors).toEqual(fixture.routingStages.resolvedConnectors);
    expect(reversed.occupancy).toEqual(fixture.routingStages.occupancy);
    expect(reversed.step3PositionedScene).toEqual(fixture.routingStages.step3PositionedScene);
    expect(reversed.finalPositionedScene).toEqual(fixture.routingStages.finalPositionedScene);

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
    const direct = await renderPositionedSceneToPng(first.routingStages.finalPositionedScene);
    expect(first.finalSvg).toBe(direct.svg);
    expect(sha256(first.finalPng)).toBe(sha256(direct.png));
    expect(first.finalSvg).toBe(second.finalSvg);
    expect(sha256(first.finalPng)).toBe(sha256(second.finalPng));
    expect(first.finalSvg).not.toBe(first.provisionalSvg);
    expect((first.finalSvg.match(/data-edge-id=/g) ?? [])).toHaveLength(3);
    expect((first.finalSvg.match(/marker-end="url\(#scene-marker-arrow-end\)"/g) ?? []))
      .toHaveLength(3);
  });

  it("late-orders the ordering proof at the crowded J-501 south side without a shared stem", async () => {
    const fixture = await buildFixture("ordering_ownership");
    const stateById = new Map(
      fixture.routingStages.resolvedConnectors.map((state) => [state.connectorId, state] as const)
    );
    const incomingPlan = fixture.routingStages.connectorPlans.find((plan) =>
      plan.from === "J-503" && plan.to === "J-501"
    )!;
    const outgoingPlan = fixture.routingStages.connectorPlans.find((plan) =>
      plan.from === "J-501" && plan.to === "J-502"
    )!;
    const incoming = stateById.get(incomingPlan.id)!;
    const outgoing = stateById.get(outgoingPlan.id)!;

    expect(incoming.targetEndpoint).toMatchObject({
      itemId: "J-501", side: "south", x: 1492, y: 140, offset: 128
    });
    expect(outgoing.sourceEndpoint).toMatchObject({
      itemId: "J-501", side: "south", x: 1476, y: 140, offset: 112
    });
    expect(incoming.targetEndpoint.x - outgoing.sourceEndpoint.x).toBe(
      JOURNEY_MAP_TRACK_SEPARATION
    );
    expect(incoming.finalRoute.points).toEqual([
      { x: 980, y: 156 }, { x: 980, y: 168 },
      { x: 1492, y: 168 }, { x: 1492, y: 140 }
    ]);
    expect(outgoing.finalRoute.points).toEqual([
      { x: 1476, y: 140 }, { x: 1476, y: 152 },
      { x: 1228, y: 152 }, { x: 1228, y: 140 }
    ]);
    expect(incoming.finalRoute.points.at(-1)).not.toEqual(outgoing.finalRoute.points[0]);

    const j501Records = fixture.routingStages.occupancy.filter((record) =>
      record.resource.kind === "node_side" && record.resource.nodeId === "J-501"
    );
    expect(j501Records.map((record) => record.resolvedCoordinate).sort((left, right) => left - right))
      .toEqual([1476, 1492]);
    expect(j501Records.some((record) =>
      record.nominalCoordinate !== record.resolvedCoordinate
    )).toBe(true);
  });

  it("late-orders primary branch and join endpoints in prepared-stem order at 16px separation", async () => {
    const fixture = await buildFixture("primary");
    const plansByPair = new Map(fixture.routingStages.connectorPlans.map((plan) => [
      `${plan.from}->${plan.to}`,
      plan
    ] as const));
    const stateById = new Map(
      fixture.routingStages.resolvedConnectors.map((state) => [state.connectorId, state] as const)
    );
    const states = (pairs: readonly string[]) => pairs.map((pair) =>
      stateById.get(plansByPair.get(pair)!.id)!
    );
    const [nearBranch, farBranch] = states(["J-201->J-202", "J-201->J-203"]);
    const [upperJoin, lowerJoin] = states(["J-203->J-204", "J-202->J-204"]);

    expect([nearBranch.sourceEndpoint.y, farBranch.sourceEndpoint.y]).toEqual([146, 162]);
    expect(farBranch.sourceEndpoint.y - nearBranch.sourceEndpoint.y).toBe(
      JOURNEY_MAP_TRACK_SEPARATION
    );
    expect([upperJoin.targetEndpoint.y, lowerJoin.targetEndpoint.y]).toEqual([108, 124]);
    expect(lowerJoin.targetEndpoint.y - upperJoin.targetEndpoint.y).toBe(
      JOURNEY_MAP_TRACK_SEPARATION
    );
    expect(new Set([nearBranch.sourceEndpoint.offset, farBranch.sourceEndpoint.offset]).size).toBe(2);
    expect(new Set([upperJoin.targetEndpoint.offset, lowerJoin.targetEndpoint.offset]).size).toBe(2);
    expect(nearBranch.finalRoute.points[0]).toEqual({ x: 1156, y: 146 });
    expect(farBranch.finalRoute.points[0]).toEqual({ x: 1156, y: 162 });
    expect(upperJoin.finalRoute.points).toEqual([
      { x: 1652, y: 124 }, { x: 1664, y: 124 },
      { x: 1664, y: 108 }, { x: 1692, y: 108 }
    ]);
    expect(lowerJoin.finalRoute.points).toEqual([
      { x: 1292, y: 140 }, { x: 1292, y: 168 },
      { x: 1680, y: 168 }, { x: 1680, y: 124 }, { x: 1692, y: 124 }
    ]);
    expect(fixture.routingStages.expansionAttempts).toEqual([{
      attempt: 1,
      requests: [{
        kind: "stage_step_gap",
        stageId: "G-200",
        afterStepOrder: 2,
        amount: JOURNEY_MAP_TRACK_SEPARATION
      }]
    }]);
    expect(findNode(fixture.routingStages.finalPositionedScene, "J-203").x).toBe(1428);
    expect(findNode(fixture.routingStages.finalPositionedScene, "J-204").x).toBe(1692);
    expect(fixture.routingStages.finalPositionedScene.root.width
      - fixture.preRoutingPositionedScene.root.width).toBe(JOURNEY_MAP_TRACK_SEPARATION);

    const rerun = buildJourneyMapRoutingStages(
      { ...structuredClone(fixture.measuredScene), edges: [...fixture.measuredScene.edges].reverse() },
      fixture.preRoutingPositionedScene
    );
    expect(rerun.resolvedConnectors).toEqual(fixture.routingStages.resolvedConnectors);
    expect(rerun.occupancy).toEqual(fixture.routingStages.occupancy);
    expect(rerun.finalPositionedScene).toEqual(fixture.routingStages.finalPositionedScene);
  });

  it("separates simple reciprocal SCCs as nested arcs while preserving the accepted self-loop", async () => {
    const fixture = await buildFixture("topology");
    const planByPair = new Map(fixture.routingStages.connectorPlans.map((plan) => [
      `${plan.from}->${plan.to}`,
      plan
    ] as const));
    const stateById = new Map(fixture.routingStages.resolvedConnectors.map((state) => [
      state.connectorId,
      state
    ] as const));
    const state = (pair: string) => stateById.get(planByPair.get(pair)!.id)!;

    expect(state("J-701->J-702").finalRoute.points).toEqual([
      { x: 444, y: 140 }, { x: 444, y: 152 },
      { x: 676, y: 152 }, { x: 676, y: 140 }
    ]);
    expect(state("J-702->J-701").finalRoute.points).toEqual([
      { x: 692, y: 140 }, { x: 692, y: 168 },
      { x: 428, y: 168 }, { x: 428, y: 140 }
    ]);
    expect(state("J-711->J-712").finalRoute.points).toEqual([
      { x: 940, y: 140 }, { x: 940, y: 168 },
      { x: 1172, y: 168 }, { x: 1172, y: 156 }
    ]);
    expect(state("J-712->J-711").finalRoute.points).toEqual([
      { x: 1188, y: 156 }, { x: 1188, y: 184 },
      { x: 924, y: 184 }, { x: 924, y: 140 }
    ]);
    expect(state("J-713->J-713").finalRoute.points).toEqual([
      { x: 1532, y: 116 }, { x: 1544, y: 116 }, { x: 1544, y: 80 },
      { x: 1296, y: 80 }, { x: 1296, y: 116 }, { x: 1308, y: 116 }
    ]);
    expect(state("J-714->J-713").finalRoute.points).toEqual([
      { x: 1668, y: 140 }, { x: 1668, y: 152 },
      { x: 1420, y: 152 }, { x: 1420, y: 140 }
    ]);
    expect(state("J-790->J-791").finalRoute.points).toContainEqual({ x: 276, y: 204 });
    expect(fixture.routingStages.expansionAttempts).toEqual([{
      attempt: 1,
      requests: [{ kind: "stage_bypass_gutter", stageId: "G-700", amount: 16 }]
    }]);
    const nominalStage = findContainer(fixture.preRoutingPositionedScene, "G-700");
    const finalStage = findContainer(fixture.routingStages.finalPositionedScene, "G-700");
    expect(finalStage.height - nominalStage.height).toBe(JOURNEY_MAP_TRACK_SEPARATION);
    expect(fixture.routingStages.finalPositionedScene.root.height
      - fixture.preRoutingPositionedScene.root.height).toBe(JOURNEY_MAP_TRACK_SEPARATION);
    for (const nodeId of ["J-701", "J-702", "J-711", "J-712", "J-713", "J-714"]) {
      expect(findNode(fixture.routingStages.finalPositionedScene, nodeId)).toMatchObject({
        x: findNode(fixture.preRoutingPositionedScene, nodeId).x,
        y: findNode(fixture.preRoutingPositionedScene, nodeId).y
      });
    }

    const reciprocalTrackRecords = fixture.routingStages.occupancy.filter((record) =>
      record.resource.kind === "stage_local_bypass"
      && [
        planByPair.get("J-701->J-702")!.id,
        planByPair.get("J-702->J-701")!.id,
        planByPair.get("J-711->J-712")!.id,
        planByPair.get("J-712->J-711")!.id
      ].includes(record.connectorId)
      && record.axis === "horizontal"
    );
    expect(reciprocalTrackRecords.map((record) => [
      record.connectorId,
      record.nominalCoordinate,
      record.resolvedCoordinate
    ])).toEqual(expect.arrayContaining([
      [planByPair.get("J-701->J-702")!.id, 152, 152],
      [planByPair.get("J-702->J-701")!.id, 152, 168],
      [planByPair.get("J-711->J-712")!.id, 168, 168],
      [planByPair.get("J-712->J-711")!.id, 168, 184]
    ]));

    const rerun = buildJourneyMapRoutingStages(
      { ...structuredClone(fixture.measuredScene), edges: [...fixture.measuredScene.edges].reverse() },
      fixture.preRoutingPositionedScene
    );
    expect(rerun.resolvedConnectors).toEqual(fixture.routingStages.resolvedConnectors);
    expect(rerun.expansionAttempts).toEqual(fixture.routingStages.expansionAttempts);
    expect(rerun.finalPositionedScene).toEqual(fixture.routingStages.finalPositionedScene);
  });

  it("resolves compressed Stage/root occupancy with one bounded whole-structure expansion", async () => {
    const fixture = await buildFixture("compressed");
    const { routingStages } = fixture;
    const planByPair = new Map(routingStages.connectorPlans.map((plan) => [
      `${plan.from}->${plan.to}`,
      plan
    ] as const));
    const stateById = new Map(routingStages.resolvedConnectors.map((state) => [
      state.connectorId,
      state
    ] as const));
    const state = (pair: string) => stateById.get(planByPair.get(pair)!.id)!;
    const horizontalCoordinates = (pair: string) => canonicalRuns(state(pair).finalRoute)
      .filter((run) => run.axis === "horizontal")
      .map((run) => run.coordinate);
    const verticalCoordinates = (pair: string) => canonicalRuns(state(pair).finalRoute)
      .filter((run) => run.axis === "vertical")
      .map((run) => run.coordinate);

    expect(routingStages.expansionAttempts).toEqual([{
      attempt: 1,
      requests: [
        { kind: "root_item_gap", afterRootOrder: 0, amount: 48 },
        { kind: "root_item_gap", afterRootOrder: 1, amount: 16 },
        { kind: "root_outer_gutter", ownerContainerId: "root", amount: 96 },
        { kind: "stage_bypass_gutter", stageId: "G-900", amount: 96 },
        { kind: "stage_bypass_gutter", stageId: "G-910", amount: 32 },
        { kind: "stage_step_gap", stageId: "G-900", afterStepOrder: 0, amount: 80 },
        { kind: "stage_step_gap", stageId: "G-900", afterStepOrder: 1, amount: 32 }
      ]
    }]);
    expect(routingStages.finalPositionedScene.root).toMatchObject({ width: 2064, height: 384 });
    expect(findContainer(routingStages.finalPositionedScene, "G-900")).toMatchObject({
      x: 32, width: 872, height: 224
    });
    expect(findNode(routingStages.finalPositionedScene, "J-902").x).toBe(380);
    expect(findNode(routingStages.finalPositionedScene, "J-903").x).toBe(660);
    expect(findNode(routingStages.finalPositionedScene, "J-950").x).toBe(992);
    expect(findContainer(routingStages.finalPositionedScene, "G-910")).toMatchObject({
      x: 1272, width: 760, height: 160
    });

    expect([
      horizontalCoordinates("J-901->J-903").at(-1),
      horizontalCoordinates("J-901->J-950").at(-1),
      horizontalCoordinates("J-901->J-911")[1],
      horizontalCoordinates("J-901->J-912")[1],
      horizontalCoordinates("J-901->J-913")[1],
      horizontalCoordinates("J-902->J-950").at(-1),
      horizontalCoordinates("J-902->J-913")[1]
    ]).toEqual([152, 168, 184, 200, 216, 232, 248]);
    expect([
      horizontalCoordinates("J-950->J-912").at(-1),
      horizontalCoordinates("J-950->J-913").at(-1),
      horizontalCoordinates("J-911->J-913")[0]
    ]).toEqual([152, 168, 184]);
    expect([
      horizontalCoordinates("J-901->J-911").at(-1),
      horizontalCoordinates("J-901->J-912").at(-1),
      horizontalCoordinates("J-901->J-913").at(-1),
      horizontalCoordinates("J-902->J-913").at(-1),
      horizontalCoordinates("J-903->J-913").at(-1),
      horizontalCoordinates("J-912->J-902")[0],
      horizontalCoordinates("J-913->J-901")[0]
    ]).toEqual([268, 284, 300, 316, 332, 348, 364]);
    expect([
      verticalCoordinates("J-901->J-911")[1],
      verticalCoordinates("J-901->J-912")[1],
      verticalCoordinates("J-901->J-913")[1],
      verticalCoordinates("J-902->J-913")[1],
      verticalCoordinates("J-903->J-913")[0]
    ].sort((left, right) => left - right)).toEqual([916, 932, 948, 964, 980]);
    expect([
      verticalCoordinates("J-950->J-912")[0],
      verticalCoordinates("J-950->J-913")[0]
    ].sort((left, right) => left - right)).toEqual([1228, 1244]);

    const j901Sources = routingStages.resolvedConnectors
      .filter((candidate) => planByPair.get(`J-901->${candidate.targetEndpoint.itemId}`)?.id
        === candidate.connectorId)
      .map((candidate) => candidate.sourceEndpoint.y)
      .sort((left, right) => left - right);
    expect(j901Sources).toEqual([96, 104, 112, 120, 128, 136]);
    expect(new Set(j901Sources).size).toBe(6);
    expect(j901Sources.slice(1).map((coordinate, index) =>
      coordinate - j901Sources[index]!
    )).toEqual([8, 8, 8, 8, 8]);
    expect([
      verticalCoordinates("J-901->J-902")[0],
      verticalCoordinates("J-901->J-903")[0],
      verticalCoordinates("J-901->J-950")[0],
      verticalCoordinates("J-901->J-911")[0],
      verticalCoordinates("J-901->J-912")[0],
      verticalCoordinates("J-901->J-913")[0]
    ]).toEqual([368, 288, 304, 320, 336, 352]);

    expect(routingStages.occupancy.some((record) =>
      record.resource.kind === "stage_local_bypass"
      && record.nominalCoordinate !== record.resolvedCoordinate
    )).toBe(true);
    expect(routingStages.occupancy.some((record) =>
      record.resource.kind === "root_outer_bypass"
      && record.nominalCoordinate !== record.resolvedCoordinate
    )).toBe(true);
    expect(routingStages.occupancy.some((record) =>
      (record.resource.kind === "inter_root_item_gutter"
        || record.resource.kind === "obstacle_swerve")
      && record.nominalCoordinate !== record.resolvedCoordinate
    )).toBe(true);

    for (const resolved of routingStages.resolvedConnectors) {
      const runs = canonicalRuns(resolved.finalRoute);
      const primaryRecords = routingStages.occupancy.filter((record) =>
        record.connectorId === resolved.connectorId
        && [
          "adjacent_step_gap",
          "stage_local_bypass",
          "inter_root_item_gutter",
          "root_outer_bypass",
          "obstacle_swerve"
        ].includes(record.resource.kind)
      );
      expect(new Set(primaryRecords.map((record) => record.segmentRunIndex))).toEqual(
        new Set(runs.map((_, index) => index))
      );
      for (const record of routingStages.occupancy.filter((candidate) =>
        candidate.connectorId === resolved.connectorId
      )) {
        const run = runs[record.segmentRunIndex];
        expect(run).toBeDefined();
        expect(record.axis).toBe(run!.axis);
        expect(record.resolvedCoordinate).toBe(run!.coordinate);
        expect(record.span).toEqual(run!.span);
        expect(record.routeSegmentIndex).toBe(run!.routeSegmentIndexes[0]);
      }
      for (const gate of resolved.stageGates) {
        const stage = findContainer(routingStages.finalPositionedScene, gate.stageId);
        const onBorder = gate.side === "east"
          ? gate.x === stage.x + stage.width
          : gate.side === "west"
            ? gate.x === stage.x
            : gate.side === "south"
              ? gate.y === stage.y + stage.height
              : gate.y === stage.y;
        expect(onBorder).toBe(true);
        expect(routeContainsPoint(resolved.finalRoute, gate)).toBe(true);
      }
    }

    const rerun = buildJourneyMapRoutingStages(
      { ...structuredClone(fixture.measuredScene), edges: [...fixture.measuredScene.edges].reverse() },
      fixture.preRoutingPositionedScene
    );
    expect(rerun.expansionAttempts).toEqual(routingStages.expansionAttempts);
    expect(rerun.resolvedConnectors).toEqual(routingStages.resolvedConnectors);
    expect(rerun.occupancy).toEqual(routingStages.occupancy);
    expect(rerun.finalPositionedScene).toEqual(routingStages.finalPositionedScene);
    expect(routingStages.diagnostics).toEqual([]);
  });

  it("emits the locked capacity warning when pending expansion survives the hard attempt bound", () => {
    const request = {
      kind: "root_outer_gutter" as const,
      ownerContainerId: "root",
      amount: JOURNEY_MAP_TRACK_SEPARATION
    };
    const attempts = Array.from(
      { length: 4 },
      (_, index) => ({ attempt: index + 1, requests: [request] })
    );
    expect(validateJourneyMapExpansionBound(attempts, [request])).toMatchObject([{
      code: "renderer.routing.journey_map_gutter_expansion_exhausted",
      severity: "warn",
      targetId: "root"
    }]);
    expect(validateJourneyMapExpansionBound(attempts.slice(0, 3), [request])).toEqual([]);
    expect(validateJourneyMapExpansionBound(attempts, [])).toEqual([]);
  });

  it("independently rejects every resolved occupancy, reconstruction, and expansion mutation", async () => {
    const fixture = await buildFixture("compressed");
    const validate = (candidate: JourneyMapRoutingStages) => validateJourneyMapResolvedStages(
      candidate.connectorPlans,
      candidate.nominalOccupancy,
      candidate.occupancy,
      candidate.resolvedConnectors,
      candidate.expansionAttempts,
      fixture.preRoutingPositionedScene,
      candidate.finalPositionedScene
    );
    expect(validate(fixture.routingStages)).toEqual([]);

    const recordMutations: Array<[string, (record: JourneyMapOccupancyRecord) => void]> = [
      ["connector identity", (record) => { record.connectorId = "missing-connector"; }],
      ["resource", (record) => {
        record.resource = { kind: "root_outer_bypass", rootId: "missing-root" };
      }],
      ["resource key", (record) => { record.resourceKey = "wrong-resource"; }],
      ["owner", (record) => { record.ownerContainerId = "wrong-owner"; }],
      ["axis", (record) => {
        record.axis = record.axis === "horizontal" ? "vertical" : "horizontal";
      }],
      ["nominal coordinate", (record) => { record.nominalCoordinate += 1; }],
      ["resolved coordinate", (record) => { record.resolvedCoordinate += 1; }],
      ["span", (record) => { record.span.end += 1; }],
      ["route segment", (record) => { record.routeSegmentIndex += 1; }],
      ["segment run", (record) => { record.segmentRunIndex += 1; }],
      ["archetype", (record) => {
        record.archetype = record.archetype === "self_loop"
          ? "adjacent_forward_same_stage"
          : "self_loop";
      }],
      ["priority", (record) => { record.priority.authorOrder += 1; }],
      ["lock", (record) => { record.lock = { kind: "exact", reason: "mutation" }; }]
    ];
    for (const [name, mutate] of recordMutations) {
      const candidate = structuredClone(fixture.routingStages) as JourneyMapRoutingStages;
      mutate(candidate.occupancy[0]!);
      expect(validate(candidate), name).not.toEqual([]);
    }

    const endpoint = structuredClone(fixture.routingStages) as JourneyMapRoutingStages;
    endpoint.resolvedConnectors[0]!.sourceEndpoint.portId = "wrong-port";
    expect(validate(endpoint).map((diagnostic) => diagnostic.code)).toContain(
      "renderer.routing.journey_map_endpoint_intrusion"
    );

    const gate = structuredClone(fixture.routingStages) as JourneyMapRoutingStages;
    const gatedState = gate.resolvedConnectors.find((state) => state.stageGates.length > 0)!;
    gatedState.stageGates[0]!.order += 1;
    expect(validate(gate).map((diagnostic) => diagnostic.code)).toContain(
      "renderer.routing.journey_map_boundary_gate_fallback"
    );

    const orphaned = structuredClone(fixture.routingStages) as JourneyMapRoutingStages;
    orphaned.resolvedConnectors[0]!.segmentCoordinates[0]!.resolvedCoordinate += 1;
    expect(validate(orphaned).map((diagnostic) => diagnostic.code)).toContain(
      "renderer.routing.journey_map_archetype_fallback"
    );

    const reconstruction = structuredClone(fixture.routingStages) as JourneyMapRoutingStages;
    reconstruction.resolvedConnectors[0]!.finalRoute.points[1]!.x += 1;
    expect(validate(reconstruction).map((diagnostic) => diagnostic.code)).toContain(
      "renderer.routing.journey_map_archetype_fallback"
    );

    const diagonal = structuredClone(fixture.routingStages) as JourneyMapRoutingStages;
    diagonal.resolvedConnectors[0]!.finalRoute.points[1]!.y += 1;
    diagonal.finalPositionedScene.edges[0]!.route = structuredClone(
      diagonal.resolvedConnectors[0]!.finalRoute
    );
    expect(validate(diagonal).map((diagnostic) => diagnostic.code)).toContain(
      "renderer.routing.journey_map_non_orthogonal_route"
    );

    const separation = structuredClone(fixture.routingStages) as JourneyMapRoutingStages;
    const directPlan = separation.connectorPlans.find((plan) =>
      plan.from === "J-903" && plan.to === "J-950"
    )!;
    const directState = separation.resolvedConnectors.find((state) =>
      state.connectorId === directPlan.id
    )!;
    directState.finalRoute.points[1]!.x = 938;
    directState.finalRoute.points[2]!.x = 938;
    directState.segmentCoordinates[1]!.resolvedCoordinate = 938;
    separation.finalPositionedScene.edges.find((edge) => edge.id === directPlan.id)!.route =
      structuredClone(directState.finalRoute);
    expect(validate(separation).map((diagnostic) => diagnostic.code)).toContain(
      "renderer.routing.journey_map_track_separation_unmet"
    );

    const noncanonicalExpansion = structuredClone(fixture.routingStages) as JourneyMapRoutingStages;
    noncanonicalExpansion.expansionAttempts[0]!.attempt = 2;
    expect(validate(noncanonicalExpansion).map((diagnostic) => diagnostic.code)).toContain(
      "renderer.routing.journey_map_archetype_fallback"
    );

    const exhausted = structuredClone(fixture.routingStages) as JourneyMapRoutingStages;
    exhausted.expansionAttempts = Array.from({ length: 5 }, (_, index) => ({
      attempt: index + 1,
      requests: [{
        kind: "root_outer_gutter" as const,
        ownerContainerId: "root",
        amount: JOURNEY_MAP_TRACK_SEPARATION
      }]
    }));
    expect(validate(exhausted).map((diagnostic) => diagnostic.code)).toContain(
      "renderer.routing.journey_map_gutter_expansion_exhausted"
    );
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
      ["topology", 9],
      ["duplicate", 3],
      ["compressed", 18]
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
    expect(topology.routingStages.deferredConnectors).toEqual([]);
    expect(topology.routingStages.failedConnectorIds).toEqual([]);
    expectExactPartition(topology);

    const duplicate = await buildFixture("duplicate");
    expect(duplicate.routingStages.connectorPlans).toHaveLength(3);
    expect(duplicate.routingStages.connectorPlans.filter((plan) => plan.branch)).toEqual([]);
    expectExactPartition(duplicate);
    const compressed = await buildFixture("compressed");
    expect(compressed.routingStages.connectorPlans.filter((plan) => plan.branch)).toHaveLength(14);
    expectExactPartition(compressed);

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
        stage,
        fixture.measuredScene
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
      ["topology", 9, 0],
      ["duplicate", 3, 0],
      ["compressed", 18, 0]
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
    expect(topology.routingStages.connectorPlans).toHaveLength(9);
    expect(topology.routingStages.deferredConnectors).toEqual([]);
    expect(topology.routingStages.failedConnectorIds).toEqual([]);
    expectExactPartition(topology);

    for (const [name, routed, deferred] of [
      ["primary", 9, 0],
      ["duplicate", 3, 0],
      ["compressed", 18, 0]
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

  it("fails malformed backward contracts visibly and keeps duplicates and Gate 7 blocked", async () => {
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

    expect(topology.routingStages.deferredConnectors).toEqual([]);
    const duplicate = await buildFixture("duplicate");
    expect(duplicate.routingStages.connectorPlans).toHaveLength(3);
    expect(duplicate.routingStages.deferredConnectors).toEqual([]);
    expect(ordering.routingStages.diagnostics.some((diagnostic) =>
      diagnostic.code.includes("occupancy")
      || diagnostic.code.includes("capacity")
      || diagnostic.code.includes("expansion")
      || diagnostic.code.includes("separation")
      || diagnostic.code === "renderer.routing.journey_map_peripheral_backward_edge"
    )).toBe(false);
  });
});

describe("journey map Gate 6 shape-aware cycle routing", () => {
  it("classifies both reciprocal topology components from graph shape without claiming the self-loop", async () => {
    const fixture = await buildFixture("topology");
    const cyclePlans = fixture.routingStages.connectorPlans.filter((plan) =>
      plan.cycleComponent?.componentKind === "simple_reciprocal"
    );
    expect(cyclePlans.map((plan) => ({
      edge: edgeKey(plan),
      archetype: plan.archetype,
      rank: plan.priority.archetypeRank,
      componentId: plan.cycleComponent?.componentId,
      componentOrdinal: plan.cycleComponent?.componentOrdinal,
      componentNodeIds: plan.cycleComponent?.componentNodeIds,
      edgeOrdinal: plan.cycleComponent?.edgeOrdinal,
      role: plan.cycleComponent?.role,
      owner: plan.ownerContainerId,
      sides: [plan.sourceEndpoint.side, plan.targetEndpoint.side]
    }))).toEqual([
      {
        edge: "J-701→J-702",
        archetype: "cycle_forward_same_stage",
        rank: 6,
        componentId: "journey-cycle:5:J-701|5:J-702",
        componentOrdinal: 0,
        componentNodeIds: ["J-701", "J-702"],
        edgeOrdinal: 0,
        role: "forward",
        owner: "G-700",
        sides: ["south", "south"]
      },
      {
        edge: "J-702→J-701",
        archetype: "cycle_return_same_stage",
        rank: 6,
        componentId: "journey-cycle:5:J-701|5:J-702",
        componentOrdinal: 0,
        componentNodeIds: ["J-701", "J-702"],
        edgeOrdinal: 1,
        role: "return",
        owner: "G-700",
        sides: ["south", "south"]
      },
      {
        edge: "J-711→J-712",
        archetype: "cycle_forward_same_stage",
        rank: 6,
        componentId: "journey-cycle:5:J-711|5:J-712",
        componentOrdinal: 1,
        componentNodeIds: ["J-711", "J-712"],
        edgeOrdinal: 0,
        role: "forward",
        owner: "G-700",
        sides: ["south", "south"]
      },
      {
        edge: "J-712→J-711",
        archetype: "cycle_return_same_stage",
        rank: 6,
        componentId: "journey-cycle:5:J-711|5:J-712",
        componentOrdinal: 1,
        componentNodeIds: ["J-711", "J-712"],
        edgeOrdinal: 1,
        role: "return",
        owner: "G-700",
        sides: ["south", "south"]
      }
    ]);
    expect(cyclePlans.map((plan) => plan.cycleComponent?.componentEdgeIds)).toEqual([
      [cyclePlans[0]!.id, cyclePlans[1]!.id],
      [cyclePlans[0]!.id, cyclePlans[1]!.id],
      [cyclePlans[2]!.id, cyclePlans[3]!.id],
      [cyclePlans[2]!.id, cyclePlans[3]!.id]
    ]);
    expect(cyclePlans.map((plan) => plan.provisionalRoute.points)).toEqual([
      [{ x: 428, y: 140 }, { x: 428, y: 152 }, { x: 676, y: 152 }, { x: 676, y: 140 }],
      [{ x: 676, y: 140 }, { x: 676, y: 152 }, { x: 428, y: 152 }, { x: 428, y: 140 }],
      [{ x: 924, y: 140 }, { x: 924, y: 168 }, { x: 1172, y: 168 }, { x: 1172, y: 156 }],
      [{ x: 1172, y: 156 }, { x: 1172, y: 168 }, { x: 924, y: 168 }, { x: 924, y: 140 }]
    ]);
    expect(fixture.routingStages.deferredConnectors).toEqual([]);
    expect(fixture.routingStages.failedConnectorIds).toEqual([]);
    expectExactPartition(fixture);
  });

  it("applies uniform Alternative B to the complex compressed SCC while retaining full component pressure", async () => {
    const fixture = await buildFixture("compressed");
    const plans = fixture.routingStages.connectorPlans;
    expect(plans).toHaveLength(18);
    expect(plans.map(edgeKey)).toEqual([
      "J-901→J-902", "J-901→J-903", "J-901→J-950", "J-901→J-911", "J-901→J-912", "J-901→J-913",
      "J-902→J-903", "J-902→J-950", "J-902→J-913",
      "J-903→J-950", "J-903→J-913",
      "J-950→J-911", "J-950→J-912", "J-950→J-913",
      "J-911→J-913", "J-912→J-913",
      "J-912→J-902", "J-913→J-901"
    ]);
    expect(plans.map((plan) => ({
      archetype: plan.archetype,
      owner: plan.ownerContainerId,
      sides: `${plan.sourceEndpoint.side}→${plan.targetEndpoint.side}`,
      gateSides: plan.stageGates.map((gate) => gate.side).join(","),
      stageBypass: plan.stageLocalBypass
        ? plan.stageLocalBypass.boundaryRole ?? "local"
        : undefined,
      rootBypass: plan.rootOuterBypass !== undefined
    }))).toEqual([
      { archetype: "adjacent_forward_same_stage", owner: "G-900", sides: "east→west", gateSides: "", stageBypass: undefined, rootBypass: false },
      { archetype: "non_adjacent_forward_same_stage", owner: "G-900", sides: "east→south", gateSides: "", stageBypass: "local", rootBypass: false },
      { archetype: "forward_contained_to_root_bypass", owner: "root", sides: "east→south", gateSides: "east", stageBypass: "egress", rootBypass: false },
      { archetype: "long_forward_cross_stage", owner: "root", sides: "east→south", gateSides: "east,south", stageBypass: "egress", rootBypass: true },
      { archetype: "long_forward_cross_stage", owner: "root", sides: "east→south", gateSides: "east,south", stageBypass: "egress", rootBypass: true },
      { archetype: "long_forward_cross_stage", owner: "root", sides: "east→south", gateSides: "east,south", stageBypass: "egress", rootBypass: true },
      { archetype: "adjacent_forward_same_stage", owner: "G-900", sides: "east→west", gateSides: "", stageBypass: undefined, rootBypass: false },
      { archetype: "forward_contained_to_root_bypass", owner: "root", sides: "east→south", gateSides: "east", stageBypass: "egress", rootBypass: false },
      { archetype: "long_forward_cross_stage", owner: "root", sides: "east→south", gateSides: "east,south", stageBypass: "egress", rootBypass: true },
      { archetype: "adjacent_forward_contained_to_root", owner: "root", sides: "east→west", gateSides: "east", stageBypass: undefined, rootBypass: false },
      { archetype: "long_forward_cross_stage", owner: "root", sides: "east→south", gateSides: "east,south", stageBypass: undefined, rootBypass: true },
      { archetype: "adjacent_forward_root_to_contained", owner: "root", sides: "east→west", gateSides: "west", stageBypass: undefined, rootBypass: false },
      { archetype: "forward_root_to_contained_bypass", owner: "root", sides: "east→south", gateSides: "west", stageBypass: "ingress", rootBypass: false },
      { archetype: "forward_root_to_contained_bypass", owner: "root", sides: "east→south", gateSides: "west", stageBypass: "ingress", rootBypass: false },
      { archetype: "non_adjacent_forward_same_stage", owner: "G-910", sides: "south→west", gateSides: "", stageBypass: "local", rootBypass: false },
      { archetype: "adjacent_forward_same_stage", owner: "G-910", sides: "east→west", gateSides: "", stageBypass: undefined, rootBypass: false },
      { archetype: "cycle_return_cross_stage", owner: "root", sides: "south→south", gateSides: "south,south", stageBypass: undefined, rootBypass: true },
      { archetype: "cycle_return_cross_stage", owner: "root", sides: "south→south", gateSides: "south,south", stageBypass: undefined, rootBypass: true }
    ]);
    expect(plans.map((plan) => plan.authorOrder)).toEqual(
      Array.from({ length: 18 }, (_, index) => index)
    );
    expect(plans.map((plan) => plan.cycleComponent?.edgeOrdinal)).toEqual(
      Array.from({ length: 18 }, (_, index) => index)
    );
    expect(plans.map((plan) => plan.cycleComponent?.componentOrdinal)).toEqual(
      Array.from({ length: 18 }, () => 0)
    );
    expect(plans.slice(0, 14).map((plan) => plan.topologyModifiers)).toEqual(
      Array.from({ length: 14 }, () => ["branch"])
    );
    expect(plans.slice(0, 14).map((plan) => plan.priority.archetypeRank)).toEqual(
      Array.from({ length: 14 }, () => 4)
    );
    expect(plans.slice(0, 14).map((plan) => [
      plan.branch?.sourceOutdegree,
      plan.branch?.sourceOrdinal
    ])).toEqual([
      [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
      [3, 0], [3, 1], [3, 2],
      [2, 0], [2, 1],
      [3, 0], [3, 1], [3, 2]
    ]);
    expect([plans[2]!, plans[7]!, plans[12]!, plans[13]!].map((plan) => ({
      edge: edgeKey(plan),
      role: plan.stageLocalBypass?.boundaryRole,
      span: plan.stageLocalBypass?.span,
      intermediateStepIds: plan.stageLocalBypass?.intermediateStepIds,
      obstacleControls: plan.stageLocalBypass?.obstacleControls,
      departureControl: plan.branch?.departureControl
    }))).toEqual([
      {
        edge: "J-901→J-950",
        role: "egress",
        span: { start: 288, end: 792 },
        intermediateStepIds: ["J-902", "J-903"],
        obstacleControls: [
          { stepId: "J-902", entryX: 300, exitX: 524 },
          { stepId: "J-903", entryX: 548, exitX: 772 }
        ],
        departureControl: {
          axis: "vertical", nominalCoordinate: 288, span: { start: 116, end: 152 },
          obstacleItemId: "J-902", obstacleBoundaryCoordinate: 300, order: 0, locked: false
        }
      },
      {
        edge: "J-902→J-950",
        role: "egress",
        span: { start: 536, end: 792 },
        intermediateStepIds: ["J-903"],
        obstacleControls: [{ stepId: "J-903", entryX: 548, exitX: 772 }],
        departureControl: {
          axis: "vertical", nominalCoordinate: 536, span: { start: 116, end: 152 },
          obstacleItemId: "J-903", obstacleBoundaryCoordinate: 548, order: 0, locked: false
        }
      },
      {
        edge: "J-950→J-912",
        role: "ingress",
        span: { start: 1096, end: 1476 },
        intermediateStepIds: ["J-911"],
        obstacleControls: [{ stepId: "J-911", entryX: 1116, exitX: 1340 }],
        departureControl: {
          axis: "vertical", nominalCoordinate: 1076, span: { start: 116, end: 152 },
          obstacleItemId: "G-910", obstacleBoundaryCoordinate: 1096, order: 0, locked: false
        }
      },
      {
        edge: "J-950→J-913",
        role: "ingress",
        span: { start: 1096, end: 1724 },
        intermediateStepIds: ["J-911", "J-912"],
        obstacleControls: [
          { stepId: "J-911", entryX: 1116, exitX: 1340 },
          { stepId: "J-912", entryX: 1364, exitX: 1588 }
        ],
        departureControl: {
          axis: "vertical", nominalCoordinate: 1076, span: { start: 116, end: 152 },
          obstacleItemId: "G-910", obstacleBoundaryCoordinate: 1096, order: 0, locked: false
        }
      }
    ]);
    expect([plans[3]!, plans[4]!, plans[5]!, plans[8]!].map((plan) =>
      plan.stageLocalBypass?.boundaryTransition
    )).toEqual(Array.from({ length: 4 }, () => ({
      axis: "vertical",
      nominalCoordinate: 812,
      span: { start: 152, end: 172 },
      stageBoundaryCoordinate: 792,
      obstacleItemId: "J-950",
      obstacleBoundaryCoordinate: 832,
      order: 0,
      locked: false
    })));
    expect(plans[10]!.branch?.departureControl).toEqual({
      axis: "vertical",
      nominalCoordinate: 812,
      span: { start: 116, end: 172 },
      obstacleItemId: "J-950",
      obstacleBoundaryCoordinate: 832,
      order: 0,
      locked: false
    });
    expect(plans.slice(14, 16).map((plan) => ({
      edge: edgeKey(plan),
      modifiers: plan.topologyModifiers,
      join: plan.join,
      rank: plan.priority.archetypeRank
    }))).toEqual([
      {
        edge: "J-911→J-913",
        modifiers: ["join"],
        join: {
          targetIndegree: 6,
          targetOrdinal: 4,
          arrivalControl: {
            axis: "vertical",
            nominalCoordinate: 1600,
            span: { start: 116, end: 152 },
            obstacleItemId: "J-912",
            obstacleBoundaryCoordinate: 1588,
            order: 0,
            locked: false
          }
        },
        rank: 5
      },
      {
        edge: "J-912→J-913",
        modifiers: ["join"],
        join: { targetIndegree: 6, targetOrdinal: 5 },
        rank: 5
      }
    ]);
    const returns = plans.slice(16);
    expect(returns.map((plan) => ({
      edge: edgeKey(plan),
      archetype: plan.archetype,
      role: plan.cycleComponent?.role,
      edgeOrdinal: plan.cycleComponent?.edgeOrdinal,
      owner: plan.ownerContainerId,
      rank: plan.priority.archetypeRank,
      gates: plan.stageGates.map((gate) => [gate.stageId, gate.side, gate.x, gate.y]),
      span: plan.rootOuterBypass?.span
    }))).toEqual([
      {
        edge: "J-912→J-902",
        archetype: "cycle_return_cross_stage",
        role: "return",
        edgeOrdinal: 16,
        owner: "root",
        rank: 6,
        gates: [["G-910", "south", 1476, 160], ["G-900", "south", 412, 160]],
        span: { start: 412, end: 1476 }
      },
      {
        edge: "J-913→J-901",
        archetype: "cycle_return_cross_stage",
        role: "return",
        edgeOrdinal: 17,
        owner: "root",
        rank: 6,
        gates: [["G-910", "south", 1724, 160], ["G-900", "south", 164, 160]],
        span: { start: 164, end: 1724 }
      }
    ]);
    expect(plans.every((plan) =>
      plan.cycleComponent?.componentId
        === "journey-cycle:5:J-901|5:J-902|5:J-903|5:J-950|5:J-911|5:J-912|5:J-913"
      && plan.cycleComponent.componentKind === "complex"
      && plan.cycleComponent.componentEdgeIds.length === 18
    )).toBe(true);
    expect(plans[0]!.cycleComponent?.componentNodeIds).toEqual([
      "J-901", "J-902", "J-903", "J-950", "J-911", "J-912", "J-913"
    ]);
    expect(plans[0]!.cycleComponent?.componentEdgeIds).toEqual(plans.map((plan) => plan.id));
    expect(plans.slice(0, 16).every((plan) => plan.cycleComponent?.role === "ordinary")).toBe(true);
    const buckets = new Map(fixture.routingStages.nodeEdgeBuckets.map((bucket) => [bucket.nodeId, bucket]));
    expect([
      ...(buckets.get("J-913")?.west.endingConnectorIds ?? []),
      ...(buckets.get("J-913")?.south.endingConnectorIds ?? [])
    ]).toHaveLength(6);
    expect(buckets.get("J-912")?.south.startingConnectorIds).toContain(returns[0]!.id);
    expect(buckets.get("J-913")?.south.startingConnectorIds).toContain(returns[1]!.id);
    expect(buckets.get("J-902")?.south.endingConnectorIds).toContain(returns[0]!.id);
    expect(buckets.get("J-901")?.south.endingConnectorIds).toContain(returns[1]!.id);
    expect(fixture.routingStages.deferredConnectors).toEqual([]);
    expect(fixture.routingStages.failedConnectorIds).toEqual([]);
    expect(fixture.routingStages.diagnostics).toEqual([]);
    expectExactPartition(fixture);
  });

  it("keeps SCC identity and geometry deterministic under edge reordering and annotation-only changes", async () => {
    const fixture = await buildFixture("compressed");
    const geometry = (routing: JourneyMapRoutingStages) => routing.connectorPlans.map((plan) => ({
      id: plan.id,
      archetype: plan.archetype,
      priority: plan.priority,
      cycleComponent: plan.cycleComponent,
      topologyModifiers: plan.topologyModifiers,
      branch: plan.branch,
      join: plan.join,
      sourceEndpoint: plan.sourceEndpoint,
      targetEndpoint: plan.targetEndpoint,
      stageGates: plan.stageGates,
      stageLocalBypass: plan.stageLocalBypass,
      rootOuterBypass: plan.rootOuterBypass,
      step2Route: plan.step2Route,
      provisionalRoute: plan.provisionalRoute,
      finalBasicRoute: plan.finalBasicRoute
    }));
    const reversedMeasuredScene = structuredClone(fixture.measuredScene) as MeasuredScene;
    reversedMeasuredScene.edges.reverse();
    const reversed = buildJourneyMapRoutingStages(
      reversedMeasuredScene,
      fixture.preRoutingPositionedScene
    );
    expect(geometry(reversed)).toEqual(geometry(fixture.routingStages));

    const annotatedMeasuredScene = structuredClone(fixture.measuredScene) as MeasuredScene;
    for (const edge of annotatedMeasuredScene.edges) {
      edge.role = "annotation-only-role";
      edge.classes = [...edge.classes, "annotation-only-class"];
      edge.label = {
        lines: ["annotation only"],
        width: 84,
        height: 16,
        lineHeight: 16,
        textStyleRole: "edge_label"
      };
    }
    const annotated = buildJourneyMapRoutingStages(
      annotatedMeasuredScene,
      fixture.preRoutingPositionedScene
    );
    expect(geometry(annotated)).toEqual(geometry(fixture.routingStages));
    expect(reversed.diagnostics).toEqual([]);
    expect(annotated.diagnostics).toEqual([]);
  });

  it("rejects malformed SCC metadata and does not misclassify duplicate reciprocal occurrences", async () => {
    const compressed = await buildFixture("compressed");
    const cycleReturn = compressed.routingStages.connectorPlans[16]!;
    const malformedComponentId = structuredClone(cycleReturn) as JourneyMapConnectorPlan;
    malformedComponentId.cycleComponent!.componentId = "journey-cycle:malformed";
    const malformedRole = structuredClone(cycleReturn) as JourneyMapConnectorPlan;
    malformedRole.cycleComponent!.role = "ordinary";
    const malformedKind = structuredClone(cycleReturn) as JourneyMapConnectorPlan;
    malformedKind.cycleComponent!.componentKind = "simple_reciprocal";
    const malformedComponentOrdinal = structuredClone(cycleReturn) as JourneyMapConnectorPlan;
    malformedComponentOrdinal.cycleComponent!.componentOrdinal = 1;
    const malformedNodeOrder = structuredClone(cycleReturn) as JourneyMapConnectorPlan;
    malformedNodeOrder.cycleComponent!.componentNodeIds.reverse();
    const malformedEdgeOrdinal = structuredClone(cycleReturn) as JourneyMapConnectorPlan;
    malformedEdgeOrdinal.cycleComponent!.edgeOrdinal = 15;
    const malformedEdgeOrder = structuredClone(cycleReturn) as JourneyMapConnectorPlan;
    malformedEdgeOrder.cycleComponent!.componentEdgeIds.reverse();
    const malformedRank = structuredClone(cycleReturn) as JourneyMapConnectorPlan;
    malformedRank.priority.archetypeRank = 5;
    const malformedGate = structuredClone(cycleReturn) as JourneyMapConnectorPlan;
    malformedGate.stageGates[0]!.x += 1;
    const malformedRootControl = structuredClone(cycleReturn) as JourneyMapConnectorPlan;
    malformedRootControl.rootOuterBypass!.obstacleControls[0]!.entryX += 1;
    const malformedBoundaryTransition = structuredClone(
      compressed.routingStages.connectorPlans[3]!
    ) as JourneyMapConnectorPlan;
    malformedBoundaryTransition.stageLocalBypass!.boundaryTransition!.nominalCoordinate += 1;
    const malformedIngressControl = structuredClone(
      compressed.routingStages.connectorPlans[12]!
    ) as JourneyMapConnectorPlan;
    malformedIngressControl.branch!.departureControl!.nominalCoordinate += 1;
    const ordinaryAsReturn = structuredClone(
      compressed.routingStages.connectorPlans[0]!
    ) as JourneyMapConnectorPlan;
    ordinaryAsReturn.cycleComponent!.role = "return";
    ordinaryAsReturn.priority.archetypeRank = 6;
    for (const malformed of [
      malformedComponentId,
      malformedRole,
      malformedKind,
      malformedComponentOrdinal,
      malformedNodeOrder,
      malformedEdgeOrdinal,
      malformedEdgeOrder,
      malformedRank,
      malformedRootControl,
      malformedBoundaryTransition,
      malformedIngressControl,
      ordinaryAsReturn
    ]) {
      expect(validateJourneyMapRoutes(
        [malformed],
        compressed.preRoutingPositionedScene,
        "provisional",
        compressed.measuredScene
      ).map((diagnostic) => diagnostic.code)).toContain(
        "renderer.routing.journey_map_archetype_fallback"
      );
    }
    expect(validateJourneyMapRoutes(
      [malformedGate],
      compressed.preRoutingPositionedScene,
      "provisional",
      compressed.measuredScene
    ).map((diagnostic) => diagnostic.code)).toContain(
      "renderer.routing.journey_map_boundary_gate_fallback"
    );
    expect(validateJourneyMapRoutes(
      [cycleReturn],
      compressed.preRoutingPositionedScene,
      "provisional"
    ).map((diagnostic) => diagnostic.code)).toContain(
      "renderer.routing.journey_map_archetype_fallback"
    );

    const topologyCapacity = await buildFixture("topology");
    const firstCycle = topologyCapacity.routingStages.connectorPlans.find((plan) =>
      plan.from === "J-701" && plan.to === "J-702"
    )!;
    const missingCyclePortScene = structuredClone(
      topologyCapacity.preRoutingPositionedScene
    ) as PositionedScene;
    const firstCycleSource = findNode(missingCyclePortScene, "J-701");
    firstCycleSource.ports = firstCycleSource.ports.filter((port) =>
      port.role !== "journey_escape_out"
    );
    expect(buildJourneyMapRoutingStages(
      topologyCapacity.measuredScene,
      missingCyclePortScene
    ).failedConnectorIds).toContain(firstCycle.id);
    const insufficientCycleStage = structuredClone(
      topologyCapacity.preRoutingPositionedScene
    ) as PositionedScene;
    findContainer(insufficientCycleStage, "G-700").height = 120;
    expect(buildJourneyMapRoutingStages(
      topologyCapacity.measuredScene,
      insufficientCycleStage
    ).failedConnectorIds).toContain(firstCycle.id);

    const topology = await buildFixture("topology");
    const duplicatedMeasuredScene = structuredClone(topology.measuredScene) as MeasuredScene;
    const forward = duplicatedMeasuredScene.edges.find((edge) =>
      edge.from.itemId === "J-701" && edge.to.itemId === "J-702"
    )!;
    duplicatedMeasuredScene.edges.push({
      ...structuredClone(forward),
      id: `${forward.id}__duplicate-proof`,
      viewMetadata: {
        journeyMap: {
          kind: "precedes",
          authorOrder: 99,
          sameEndpointOrdinal: 1,
          exactIdentityOrdinal: 0
        }
      }
    });
    const duplicated = buildJourneyMapRoutingStages(
      duplicatedMeasuredScene,
      topology.preRoutingPositionedScene
    );
    const reciprocalOccurrences = [
      ...duplicated.connectorPlans,
      ...duplicated.deferredConnectors
    ].filter((edge) =>
      (edge.from === "J-701" && edge.to === "J-702")
      || (edge.from === "J-702" && edge.to === "J-701")
    );
    expect(reciprocalOccurrences).toHaveLength(3);
    expect(reciprocalOccurrences.every((edge) =>
      edge.cycleComponent?.componentKind === "complex"
    )).toBe(true);
    expect(duplicated.deferredConnectors.filter((edge) =>
      edge.from === "J-701" && edge.to === "J-702"
    ).every((edge) => edge.deferredFamilies.includes("duplicate"))).toBe(true);

    const externalMeasuredScene = structuredClone(topology.measuredScene) as MeasuredScene;
    externalMeasuredScene.edges = externalMeasuredScene.edges.filter((edge) =>
      !(edge.from.itemId === "J-713" && edge.to.itemId === "J-713")
      && !(edge.from.itemId === "J-790" && edge.to.itemId === "J-701")
    );
    const externalEdgeId = "synthetic-external-edge-touching-simple-scc";
    externalMeasuredScene.edges.push({
      ...structuredClone(forward),
      id: externalEdgeId,
      from: { ...structuredClone(forward.from), itemId: "J-713" },
      to: { ...structuredClone(forward.to), itemId: "J-701" },
      viewMetadata: {
        journeyMap: {
          kind: "precedes",
          authorOrder: 99,
          sameEndpointOrdinal: 0,
          exactIdentityOrdinal: 0
        }
      }
    });
    const external = buildJourneyMapRoutingStages(
      externalMeasuredScene,
      topology.preRoutingPositionedScene
    );
    expect(external.connectorPlans.map((plan) => plan.id)).not.toContain(externalEdgeId);
    expect(external.deferredConnectors.find((edge) => edge.id === externalEdgeId))
      .toMatchObject({ from: "J-713", to: "J-701" });
  });
});

describe("journey map Gate 6 self-loop routing", () => {
  const selfLoopId = "J-713__PRECEDES__J-713__2a6ea6d3272f5ed9c1f8af6a31503aaeeeb10df8f9ebdce3f3a3b1cf36b09432__0";

  it("routes the unique topology self-loop through the accepted east-west upper collar", async () => {
    const fixture = await buildFixture("topology");
    const plan = fixture.routingStages.connectorPlans.find((candidate) => candidate.id === selfLoopId);
    expect(plan).toMatchObject({
      id: selfLoopId,
      from: "J-713",
      to: "J-713",
      ownerContainerId: "G-700",
      archetype: "self_loop",
      authorOrder: 6,
      sameEndpointOrdinal: 0,
      exactIdentityOrdinal: 0,
      sourceEndpoint: {
        itemId: "J-713", portId: "J-713__flow_out", side: "east", x: 1532, y: 116
      },
      targetEndpoint: {
        itemId: "J-713", portId: "J-713__flow_in", side: "west", x: 1308, y: 116
      },
      stageGates: [],
      selfLoopTrack: {
        nodeId: "J-713",
        loopSide: "north",
        axis: "horizontal",
        nominalCoordinate: 80,
        span: { start: 1296, end: 1544 },
        sourceControl: {
          axis: "vertical",
          nominalCoordinate: 1544,
          span: { start: 80, end: 116 },
          order: 0,
          locked: false
        },
        targetControl: {
          axis: "vertical",
          nominalCoordinate: 1296,
          span: { start: 80, end: 116 },
          order: 0,
          locked: false
        },
        order: 0,
        locked: false
      }
    });
    expect(plan?.priority).toEqual({
      archetypeRank: 6,
      sourceRootOrder: 1,
      sourceStepOrder: 4,
      authorOrder: 6,
      targetRootOrder: 1,
      targetStepOrder: 4,
      sameEndpointOrdinal: 0,
      exactIdentityOrdinal: 0,
      edgeId: selfLoopId
    });
    expect(plan?.stageLocalBypass).toBeUndefined();
    expect(plan?.rootOuterBypass).toBeUndefined();
    expect(plan?.cycleComponent).toBeUndefined();
    expect(plan?.topologyModifiers).toBeUndefined();
    expect(plan?.branch).toBeUndefined();
    expect(plan?.join).toBeUndefined();
    const expectedRoute = [
      { x: 1532, y: 116 }, { x: 1544, y: 116 }, { x: 1544, y: 80 },
      { x: 1296, y: 80 }, { x: 1296, y: 116 }, { x: 1308, y: 116 }
    ];
    expect(plan?.step2Route.points).toEqual(expectedRoute);
    expect(plan?.provisionalRoute.points).toEqual(expectedRoute);
    expect(plan?.finalBasicRoute.points).toEqual(expectedRoute);
    expect(fixture.routingStages.connectorPlans.filter((candidate) =>
      candidate.priority.archetypeRank === 6
    ).map(edgeKey)).toEqual([
      "J-701→J-702",
      "J-702→J-701",
      "J-711→J-712",
      "J-712→J-711",
      "J-713→J-713",
      "J-714→J-713"
    ]);
    const bucket = fixture.routingStages.nodeEdgeBuckets.find((candidate) =>
      candidate.nodeId === "J-713"
    );
    expect(bucket?.east.startingConnectorIds).toEqual([selfLoopId]);
    expect(bucket?.west.endingConnectorIds).toEqual([selfLoopId]);
    expect(bucket?.south.endingConnectorIds).toEqual([
      "J-714__PRECEDES__J-713__48be4303b0633d1150403027b444b86f13dc6ac7e956b46aa2bdaa0956251025__0"
    ]);
    expect(fixture.routingStages.connectorPlans).toHaveLength(9);
    expect(fixture.routingStages.deferredConnectors).toEqual([]);
    expect(fixture.routingStages.failedConnectorIds).toEqual([]);
    expect(fixture.routingStages.diagnostics).toEqual([]);
    expectExactPartition(fixture);

    const withoutSelfLoop = structuredClone(fixture.measuredScene) as MeasuredScene;
    withoutSelfLoop.edges = withoutSelfLoop.edges.filter((edge) => edge.id !== selfLoopId);
    const acceptedEarlier = buildJourneyMapRoutingStages(
      withoutSelfLoop,
      fixture.preRoutingPositionedScene
    );
    expect(fixture.routingStages.connectorPlans.filter((candidate) => candidate.id !== selfLoopId))
      .toEqual(acceptedEarlier.connectorPlans);
  });

  it("keeps self-loop identity and geometry deterministic across profiles, edge order, and annotation-only data", async () => {
    const strict = await buildFixture("topology", "strict");
    const geometry = (routing: JourneyMapRoutingStages) => {
      const plan = routing.connectorPlans.find((candidate) => candidate.id === selfLoopId);
      return plan && {
        id: plan.id,
        ownerContainerId: plan.ownerContainerId,
        archetype: plan.archetype,
        priority: plan.priority,
        sourceEndpoint: plan.sourceEndpoint,
        targetEndpoint: plan.targetEndpoint,
        selfLoopTrack: plan.selfLoopTrack,
        step2Route: plan.step2Route,
        provisionalRoute: plan.provisionalRoute,
        finalBasicRoute: plan.finalBasicRoute
      };
    };
    for (const profileId of ["simple", "permissive"] as const) {
      expect(geometry((await buildFixture("topology", profileId)).routingStages))
        .toEqual(geometry(strict.routingStages));
    }

    const reversedMeasuredScene = structuredClone(strict.measuredScene) as MeasuredScene;
    reversedMeasuredScene.edges.reverse();
    expect(geometry(buildJourneyMapRoutingStages(
      reversedMeasuredScene,
      strict.preRoutingPositionedScene
    ))).toEqual(geometry(strict.routingStages));

    const annotationOnlyMeasuredScene = structuredClone(strict.measuredScene) as MeasuredScene;
    const annotationOnlyEdge = annotationOnlyMeasuredScene.edges.find((edge) => edge.id === selfLoopId)!;
    annotationOnlyEdge.role = "annotation-only-role";
    annotationOnlyEdge.classes = [...annotationOnlyEdge.classes, "annotation-only-class"];
    annotationOnlyEdge.label = {
      lines: ["kind loop is renderer-irrelevant"],
      width: 240,
      height: 16,
      lineHeight: 16,
      textStyleRole: "edge_label"
    };
    expect(geometry(buildJourneyMapRoutingStages(
      annotationOnlyMeasuredScene,
      strict.preRoutingPositionedScene
    ))).toEqual(geometry(strict.routingStages));
  });

  it("rejects malformed self-loop contracts, missing capacity, and duplicate occurrences visibly", async () => {
    const fixture = await buildFixture("topology");
    const plan = fixture.routingStages.connectorPlans.find((candidate) => candidate.id === selfLoopId)!;
    const malformedPlans: JourneyMapConnectorPlan[] = [];
    const mutate = (mutation: (candidate: JourneyMapConnectorPlan) => void) => {
      const candidate = structuredClone(plan) as JourneyMapConnectorPlan;
      mutation(candidate);
      malformedPlans.push(candidate);
    };
    mutate((candidate) => { candidate.selfLoopTrack!.nodeId = "J-714"; });
    mutate((candidate) => { candidate.selfLoopTrack!.loopSide = "south" as "north"; });
    mutate((candidate) => { candidate.selfLoopTrack!.axis = "vertical" as "horizontal"; });
    mutate((candidate) => { candidate.selfLoopTrack!.nominalCoordinate += 1; });
    mutate((candidate) => { candidate.selfLoopTrack!.span.start += 1; });
    mutate((candidate) => { candidate.selfLoopTrack!.sourceControl.nominalCoordinate += 1; });
    mutate((candidate) => { candidate.selfLoopTrack!.targetControl.span.end += 1; });
    mutate((candidate) => { candidate.selfLoopTrack!.sourceControl.order = 1 as 0; });
    mutate((candidate) => { candidate.selfLoopTrack!.targetControl.order = 1 as 0; });
    mutate((candidate) => { candidate.selfLoopTrack!.targetControl.locked = true as false; });
    mutate((candidate) => { candidate.selfLoopTrack!.order = 1 as 0; });
    mutate((candidate) => { candidate.archetype = "backward_same_stage"; });
    mutate((candidate) => { candidate.priority.archetypeRank = 5; });
    mutate((candidate) => { candidate.priority.edgeId = "malformed-self-loop-priority"; });
    mutate((candidate) => { candidate.authorOrder += 1; });
    mutate((candidate) => { candidate.sameEndpointOrdinal += 1; });
    mutate((candidate) => { candidate.exactIdentityOrdinal += 1; });
    mutate((candidate) => { candidate.sourceEndpoint.portId = "J-713__escape_out"; });
    mutate((candidate) => { candidate.sourceEndpoint.offset += 1; });
    mutate((candidate) => { candidate.targetEndpoint.portId = "J-713__escape_in"; });
    mutate((candidate) => { candidate.targetEndpoint.offset += 1; });
    mutate((candidate) => { candidate.stageGates.push({
      stageId: "G-700", side: "east", x: 1800, y: 116, order: 0, locked: true
    }); });
    mutate((candidate) => { candidate.topologyModifiers = ["join"]; });
    for (const malformed of malformedPlans) {
      expect(validateJourneyMapRoutes(
        [malformed],
        fixture.preRoutingPositionedScene,
        "provisional",
        fixture.measuredScene
      ).map((diagnostic) => diagnostic.code)).toContain(
        "renderer.routing.journey_map_archetype_fallback"
      );
    }
    const malformedRoute = structuredClone(plan) as JourneyMapConnectorPlan;
    malformedRoute.provisionalRoute.points[2]!.y += 1;
    expect(validateJourneyMapRoutes(
      [malformedRoute],
      fixture.preRoutingPositionedScene,
      "provisional",
      fixture.measuredScene
    ).map((diagnostic) => diagnostic.code)).toContain(
      "renderer.routing.journey_map_non_orthogonal_route"
    );
    expect(validateJourneyMapRoutes(
      [plan],
      fixture.preRoutingPositionedScene,
      "provisional"
    ).map((diagnostic) => diagnostic.code)).toContain(
      "renderer.routing.journey_map_archetype_fallback"
    );

    for (const role of ["journey_flow_out", "journey_flow_in"] as const) {
      const missingPortScene = structuredClone(fixture.preRoutingPositionedScene) as PositionedScene;
      const node = findNode(missingPortScene, "J-713");
      node.ports = node.ports.filter((port) => port.role !== role);
      const missingPort = buildJourneyMapRoutingStages(fixture.measuredScene, missingPortScene);
      expect(missingPort.failedConnectorIds).toContain(selfLoopId);
      expect(missingPort.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
        "renderer.routing.journey_map_unresolved_endpoint"
      );
    }
    for (const role of ["journey_flow_out", "journey_flow_in"] as const) {
      const malformedPortSide = structuredClone(
        fixture.preRoutingPositionedScene
      ) as PositionedScene;
      const port = findNode(malformedPortSide, "J-713").ports.find((candidate) =>
        candidate.role === role
      )!;
      port.side = "south";
      const malformedPort = buildJourneyMapRoutingStages(
        fixture.measuredScene,
        malformedPortSide
      );
      expect(malformedPort.failedConnectorIds).toContain(selfLoopId);
      expect(validateJourneyMapRoutes(
        [plan],
        malformedPortSide,
        "provisional",
        fixture.measuredScene
      ).map((diagnostic) => diagnostic.code)).toContain(
        "renderer.routing.journey_map_archetype_fallback"
      );
    }
    const insufficientHeaderClearance = structuredClone(
      fixture.preRoutingPositionedScene
    ) as PositionedScene;
    findContainer(insufficientHeaderClearance, "G-700").chrome.headerBandHeight = 49;
    const headerFailure = buildJourneyMapRoutingStages(
      fixture.measuredScene,
      insufficientHeaderClearance
    );
    expect(headerFailure.failedConnectorIds).toContain(selfLoopId);
    expect(headerFailure.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "renderer.routing.journey_map_archetype_fallback"
    );
    expect(validateJourneyMapRoutes(
      [plan],
      insufficientHeaderClearance,
      "provisional",
      fixture.measuredScene
    ).map((diagnostic) => diagnostic.code)).toContain(
      "renderer.routing.journey_map_stage_header_intersection"
    );
    const obstructingHeaderContent = structuredClone(
      fixture.preRoutingPositionedScene
    ) as PositionedScene;
    const obstructedStage = findContainer(obstructingHeaderContent, "G-700");
    obstructedStage.headerContent[0] = {
      ...obstructedStage.headerContent[0]!,
      x: 1000,
      y: 40,
      width: 248,
      height: 16
    };
    const contentFailure = buildJourneyMapRoutingStages(
      fixture.measuredScene,
      obstructingHeaderContent
    );
    expect(contentFailure.failedConnectorIds).toContain(selfLoopId);
    expect(validateJourneyMapRoutes(
      [plan],
      obstructingHeaderContent,
      "provisional",
      fixture.measuredScene
    ).map((diagnostic) => diagnostic.code)).toContain(
      "renderer.routing.journey_map_stage_header_intersection"
    );
    const unrelatedStageObstruction = structuredClone(
      fixture.preRoutingPositionedScene
    ) as PositionedScene;
    const unrelatedStage = structuredClone(
      findContainer(unrelatedStageObstruction, "G-700")
    ) as PositionedContainer;
    unrelatedStage.id = "G-self-loop-obstacle";
    unrelatedStage.x = 1400;
    unrelatedStage.y = 70;
    unrelatedStage.width = 20;
    unrelatedStage.height = 20;
    unrelatedStage.headerContent = [];
    unrelatedStage.children = [];
    unrelatedStageObstruction.root.children.push(unrelatedStage);
    const unrelatedStageFailure = buildJourneyMapRoutingStages(
      fixture.measuredScene,
      unrelatedStageObstruction
    );
    expect(unrelatedStageFailure.failedConnectorIds).toContain(selfLoopId);
    expect(unrelatedStageFailure.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "renderer.routing.journey_map_archetype_fallback"
    );
    const insufficientLeft = structuredClone(fixture.preRoutingPositionedScene) as PositionedScene;
    findContainer(insufficientLeft, "G-700").x = 1296;
    expect(buildJourneyMapRoutingStages(
      fixture.measuredScene,
      insufficientLeft
    ).failedConnectorIds).toContain(selfLoopId);
    const insufficientRight = structuredClone(fixture.preRoutingPositionedScene) as PositionedScene;
    findContainer(insufficientRight, "G-700").width = 1248;
    expect(buildJourneyMapRoutingStages(
      fixture.measuredScene,
      insufficientRight
    ).failedConnectorIds).toContain(selfLoopId);

    const duplicateOccurrences = structuredClone(fixture.measuredScene) as MeasuredScene;
    const selfLoopEdge = duplicateOccurrences.edges.find((edge) => edge.id === selfLoopId)!;
    duplicateOccurrences.edges.push({
      ...structuredClone(selfLoopEdge),
      id: `${selfLoopId}__duplicate-proof`,
      viewMetadata: {
        journeyMap: {
          kind: "precedes",
          authorOrder: 99,
          sameEndpointOrdinal: 1,
          exactIdentityOrdinal: 0
        }
      }
    });
    const duplicated = buildJourneyMapRoutingStages(
      duplicateOccurrences,
      fixture.preRoutingPositionedScene
    );
    expect(duplicated.connectorPlans.filter((candidate) =>
      candidate.from === "J-713" && candidate.to === "J-713"
    )).toEqual([]);
    expect(duplicated.deferredConnectors.filter((candidate) =>
      candidate.from === "J-713" && candidate.to === "J-713"
    )).toHaveLength(2);
    expect(duplicated.deferredConnectors.filter((candidate) =>
      candidate.from === "J-713" && candidate.to === "J-713"
    ).every((candidate) =>
      candidate.deferredFamilies.includes("duplicate")
      && candidate.deferredFamilies.includes("self_loop")
    )).toBe(true);

    const repeatedStableId = structuredClone(fixture.measuredScene) as MeasuredScene;
    repeatedStableId.edges.push(structuredClone(selfLoopEdge));
    const repeated = buildJourneyMapRoutingStages(
      repeatedStableId,
      fixture.preRoutingPositionedScene
    );
    expect(repeated.failedConnectorIds).toContain(selfLoopId);
    expect(repeated.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "renderer.routing.journey_map_edge_duplicated"
    );
  });

  it("renders deterministic self-loop SVG and derives PNG from that exact SVG", async () => {
    const fixture = await buildFixture("topology");
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
    const direct = await renderPositionedSceneToPng(
      first.routingStages.provisionalPositionedScene
    );
    expect(first.provisionalSvg).toBe(direct.svg);
    expect(sha256(first.provisionalPng)).toBe(sha256(direct.png));
    expect(first.provisionalSvg).toBe(second.provisionalSvg);
    expect(sha256(first.provisionalPng)).toBe(sha256(second.provisionalPng));
    expect(first.provisionalSvg).toContain(`data-edge-id="${selfLoopId}"`);
    expect(first.diagnostics.some((diagnostic) =>
      diagnostic.severity === "warn" || diagnostic.severity === "error"
    )).toBe(false);
  });
});

describe("journey map Gate 6 duplicate occurrence routing", () => {
  const duplicateIds = [
    "J-801__PRECEDES__J-802__5d47769e364fd1c11f69d961820f545b79093ca7433a92b5ba977c55ca7db7c7__0",
    "J-801__PRECEDES__J-802__8fcf1e99bcf6a39ba71e63745f7738eef3880d78bc98ad4a36e1fce1ef8a0b1e__0",
    "J-801__PRECEDES__J-802__5d47769e364fd1c11f69d961820f545b79093ca7433a92b5ba977c55ca7db7c7__1"
  ];
  const expectedRoutes = [
    [{ x: 256, y: 56 }, { x: 296, y: 56 }],
    [
      { x: 256, y: 56 }, { x: 268, y: 56 }, { x: 268, y: 40 },
      { x: 284, y: 40 }, { x: 284, y: 56 }, { x: 296, y: 56 }
    ],
    [
      { x: 256, y: 56 }, { x: 268, y: 56 }, { x: 268, y: 72 },
      { x: 284, y: 72 }, { x: 284, y: 56 }, { x: 296, y: 56 }
    ]
  ];
  const duplicateGroupFrom = (
    base: MeasuredScene["edges"][number],
    prefix: string
  ): MeasuredScene["edges"] => Array.from({ length: 3 }, (_, ordinal) => {
    const edge = structuredClone(base);
    edge.id = `${prefix}-${ordinal}`;
    const metadata = edge.viewMetadata?.journeyMap;
    expect(metadata).toBeDefined();
    metadata!.authorOrder = ordinal;
    metadata!.sameEndpointOrdinal = ordinal;
    metadata!.exactIdentityOrdinal = ordinal;
    return edge;
  });

  it("maps authored duplicate ordinals to the accepted alternating nominal slots", () => {
    expect(Array.from({ length: 7 }, (_, ordinal) =>
      journeyMapDuplicateLaneIndex(ordinal)
    )).toEqual([0, -1, 1, -2, 2, -3, 3]);
  });

  it("routes the complete duplicate group as the accepted direct/upper/lower nominal fan", async () => {
    const fixture = await buildFixture("duplicate");
    const plans = fixture.routingStages.connectorPlans;
    expect(plans.map((plan) => plan.id)).toEqual(duplicateIds);
    expect(plans.map((plan) => [
      plan.authorOrder,
      plan.sameEndpointOrdinal,
      plan.exactIdentityOrdinal
    ])).toEqual([[0, 0, 0], [1, 1, 0], [2, 2, 1]]);

    for (const [groupOrdinal, plan] of plans.entries()) {
      const laneIndex = [0, -1, 1][groupOrdinal]!;
      expect(plan).toMatchObject({
        from: "J-801",
        to: "J-802",
        ownerContainerId: "root",
        archetype: "adjacent_forward_root_step",
        sourceEndpoint: {
          itemId: "J-801",
          portId: "J-801__flow_out",
          side: "east",
          x: 256,
          y: 56,
          offset: 24
        },
        targetEndpoint: {
          itemId: "J-802",
          portId: "J-802__flow_in",
          side: "west",
          x: 296,
          y: 56,
          offset: 24
        },
        markers: { end: "arrow" },
        stageGates: [],
        duplicateFan: {
          policy: "distinct_nominal_fan",
          groupEdgeIds: duplicateIds,
          groupSize: 3,
          groupOrdinal,
          laneIndex,
          axis: "horizontal",
          nominalCoordinate: 56 + laneIndex * JOURNEY_MAP_TRACK_SEPARATION,
          order: 0,
          locked: false
        }
      });
      expect(plan.priority).toEqual({
        archetypeRank: 3,
        sourceRootOrder: 0,
        sourceStepOrder: 0,
        authorOrder: groupOrdinal,
        targetRootOrder: 1,
        targetStepOrder: 0,
        sameEndpointOrdinal: groupOrdinal,
        exactIdentityOrdinal: groupOrdinal === 2 ? 1 : 0,
        edgeId: duplicateIds[groupOrdinal]
      });
      expect(plan.topologyModifiers).toBeUndefined();
      expect(plan.branch).toBeUndefined();
      expect(plan.join).toBeUndefined();
      expect(plan.cycleComponent).toBeUndefined();
      expect(plan.stageLocalBypass).toBeUndefined();
      expect(plan.rootOuterBypass).toBeUndefined();
      expect(plan.selfLoopTrack).toBeUndefined();
      expect(plan.step2Route.points).toEqual(expectedRoutes[groupOrdinal]);
      expect(plan.provisionalRoute.points).toEqual(expectedRoutes[groupOrdinal]);
      expect(plan.finalBasicRoute.points).toEqual(expectedRoutes[groupOrdinal]);
    }
    expect(plans[0]!.duplicateFan).toEqual({
      policy: "distinct_nominal_fan",
      groupEdgeIds: duplicateIds,
      groupSize: 3,
      groupOrdinal: 0,
      laneIndex: 0,
      axis: "horizontal",
      nominalCoordinate: 56,
      span: { start: 256, end: 296 },
      segmentIndex: 0,
      order: 0,
      locked: false
    });
    for (const [index, coordinate] of [[1, 40], [2, 72]] as const) {
      expect(plans[index]!.duplicateFan).toEqual({
        policy: "distinct_nominal_fan",
        groupEdgeIds: duplicateIds,
        groupSize: 3,
        groupOrdinal: index,
        laneIndex: index === 1 ? -1 : 1,
        axis: "horizontal",
        nominalCoordinate: coordinate,
        span: { start: 268, end: 284 },
        segmentIndex: 2,
        sourceControl: {
          axis: "vertical",
          nominalCoordinate: 268,
          span: { start: Math.min(56, coordinate), end: Math.max(56, coordinate) },
          segmentIndex: 1,
          order: 0,
          locked: false
        },
        targetControl: {
          axis: "vertical",
          nominalCoordinate: 284,
          span: { start: Math.min(56, coordinate), end: Math.max(56, coordinate) },
          segmentIndex: 3,
          order: 0,
          locked: false
        },
        order: 0,
        locked: false
      });
    }
    const buckets = new Map(fixture.routingStages.nodeEdgeBuckets.map((bucket) => [
      bucket.nodeId,
      bucket
    ]));
    expect(buckets.get("J-801")?.east.startingConnectorIds).toEqual(duplicateIds);
    expect(buckets.get("J-802")?.west.endingConnectorIds).toEqual(duplicateIds);
    expect(fixture.routingStages.deferredConnectors).toEqual([]);
    expect(fixture.routingStages.failedConnectorIds).toEqual([]);
    expect(fixture.routingStages.diagnostics).toEqual([
      expect.objectContaining({
        code: "renderer.scene.journey_map_step_only",
        severity: "info",
        targetId: "J-801"
      })
    ]);
    for (const stage of ["step2", "provisional", "final_basic"] as const) {
      expect(validateJourneyMapRoutes(
        plans,
        fixture.preRoutingPositionedScene,
        stage,
        fixture.measuredScene
      )).toEqual([]);
    }
    expectExactPartition(fixture);
  });

  it("keeps group assignment deterministic and recovers the canonical direct base for one occurrence", async () => {
    const fixture = await buildFixture("duplicate");
    const geometry = (routing: JourneyMapRoutingStages) => routing.connectorPlans.map((plan) => ({
      id: plan.id,
      ownerContainerId: plan.ownerContainerId,
      archetype: plan.archetype,
      priority: plan.priority,
      sourceEndpoint: plan.sourceEndpoint,
      targetEndpoint: plan.targetEndpoint,
      duplicateFan: plan.duplicateFan,
      step2Route: plan.step2Route,
      provisionalRoute: plan.provisionalRoute,
      finalBasicRoute: plan.finalBasicRoute
    }));
    const reversed = structuredClone(fixture.measuredScene) as MeasuredScene;
    reversed.edges.reverse();
    expect(geometry(buildJourneyMapRoutingStages(
      reversed,
      fixture.preRoutingPositionedScene
    ))).toEqual(geometry(fixture.routingStages));

    const annotationOnly = structuredClone(fixture.measuredScene) as MeasuredScene;
    for (const edge of annotationOnly.edges) {
      edge.role = "annotation-only-role";
      edge.classes = [...edge.classes, "annotation-only-class"];
      edge.label = {
        lines: ["erased duplicate annotation"],
        width: 200,
        height: 16,
        lineHeight: 16,
        textStyleRole: "edge_label"
      };
    }
    expect(geometry(buildJourneyMapRoutingStages(
      annotationOnly,
      fixture.preRoutingPositionedScene
    ))).toEqual(geometry(fixture.routingStages));

    const singleOccurrence = structuredClone(fixture.measuredScene) as MeasuredScene;
    singleOccurrence.edges = [singleOccurrence.edges[0]!];
    const recovered = buildJourneyMapRoutingStages(
      singleOccurrence,
      fixture.preRoutingPositionedScene
    );
    expect(recovered.connectorPlans).toHaveLength(1);
    expect(recovered.connectorPlans[0]).toMatchObject({
      id: duplicateIds[0],
      archetype: "adjacent_forward_root_step",
      priority: { archetypeRank: 3 },
      step2Route: { points: expectedRoutes[0] }
    });
    expect(recovered.connectorPlans[0]?.duplicateFan).toBeUndefined();
    expect(recovered.deferredConnectors).toEqual([]);
    expect(recovered.failedConnectorIds).toEqual([]);
  });

  it("rejects malformed fan contracts and fails supported groups atomically", async () => {
    const fixture = await buildFixture("duplicate");
    const [direct, upper, lower] = fixture.routingStages.connectorPlans;
    const malformedPlans: JourneyMapConnectorPlan[] = [];
    const mutate = (
      original: JourneyMapConnectorPlan,
      mutation: (candidate: JourneyMapConnectorPlan) => void
    ) => {
      const candidate = structuredClone(original) as JourneyMapConnectorPlan;
      mutation(candidate);
      malformedPlans.push(candidate);
    };
    mutate(direct!, (plan) => { plan.duplicateFan!.groupEdgeIds.reverse(); });
    mutate(direct!, (plan) => { plan.duplicateFan!.groupSize = 2; });
    mutate(direct!, (plan) => { plan.duplicateFan!.groupOrdinal = 1; });
    mutate(direct!, (plan) => { plan.duplicateFan!.laneIndex = -1; });
    mutate(direct!, (plan) => { plan.duplicateFan!.nominalCoordinate = 40; });
    mutate(direct!, (plan) => { plan.duplicateFan!.span.start += 1; });
    mutate(direct!, (plan) => { plan.duplicateFan!.segmentIndex = 2; });
    mutate(direct!, (plan) => { plan.duplicateFan!.locked = true as false; });
    mutate(upper!, (plan) => { plan.duplicateFan!.sourceControl!.nominalCoordinate += 1; });
    mutate(upper!, (plan) => { plan.duplicateFan!.targetControl!.span.end += 1; });
    mutate(upper!, (plan) => { plan.duplicateFan!.sourceControl!.segmentIndex = 3; });
    mutate(upper!, (plan) => { plan.priority.archetypeRank = 4; });
    mutate(upper!, (plan) => { plan.ownerContainerId = "not-root"; });
    mutate(upper!, (plan) => { plan.authorOrder += 1; });
    mutate(upper!, (plan) => { plan.topologyModifiers = ["branch"]; });
    mutate(upper!, (plan) => { delete plan.markers; });
    for (const malformed of malformedPlans) {
      expect(validateJourneyMapRoutes(
        [malformed],
        fixture.preRoutingPositionedScene,
        "provisional",
        fixture.measuredScene
      ).map((diagnostic) => diagnostic.code)).toContain(
        "renderer.routing.journey_map_archetype_fallback"
      );
    }
    const swappedRoute = structuredClone(upper!) as JourneyMapConnectorPlan;
    swappedRoute.provisionalRoute = structuredClone(lower!.provisionalRoute);
    expect(validateJourneyMapRoutes(
      [swappedRoute],
      fixture.preRoutingPositionedScene,
      "provisional",
      fixture.measuredScene
    ).map((diagnostic) => diagnostic.code)).toContain(
      "renderer.routing.journey_map_archetype_fallback"
    );
    expect(validateJourneyMapRoutes(
      [direct!],
      fixture.preRoutingPositionedScene,
      "provisional"
    ).map((diagnostic) => diagnostic.code)).toContain(
      "renderer.routing.journey_map_archetype_fallback"
    );

    for (const role of ["journey_flow_out", "journey_flow_in"] as const) {
      const missingPortScene = structuredClone(
        fixture.preRoutingPositionedScene
      ) as PositionedScene;
      const node = findNode(missingPortScene, role === "journey_flow_out" ? "J-801" : "J-802");
      node.ports = node.ports.filter((port) => port.role !== role);
      const missingPort = buildJourneyMapRoutingStages(fixture.measuredScene, missingPortScene);
      expect(missingPort.connectorPlans).toEqual([]);
      expect(missingPort.failedConnectorIds).toEqual(duplicateIds);
      expect(missingPort.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
        "renderer.routing.journey_map_unresolved_endpoint"
      );
    }
    const malformedPortSide = structuredClone(
      fixture.preRoutingPositionedScene
    ) as PositionedScene;
    findNode(malformedPortSide, "J-802").ports.find((port) =>
      port.role === "journey_flow_in"
    )!.side = "south";
    const wrongSide = buildJourneyMapRoutingStages(fixture.measuredScene, malformedPortSide);
    expect(wrongSide.connectorPlans).toEqual([]);
    expect(wrongSide.failedConnectorIds).toEqual(duplicateIds);

    const unequalEndpointY = structuredClone(
      fixture.preRoutingPositionedScene
    ) as PositionedScene;
    findNode(unequalEndpointY, "J-802").y += 8;
    const unequalYFailure = buildJourneyMapRoutingStages(
      fixture.measuredScene,
      unequalEndpointY
    );
    expect(unequalYFailure.connectorPlans).toEqual([]);
    expect(unequalYFailure.failedConnectorIds).toEqual(duplicateIds);

    const memberMutations: Array<(edge: MeasuredScene["edges"][number]) => void> = [
      (edge) => { edge.ownerContainerId = "not-root"; },
      (edge) => { edge.routing.sourcePortRole = "not-flow-out"; },
      (edge) => { edge.routing.targetPortRole = "not-flow-in"; },
      (edge) => { delete edge.markers; },
      (edge) => { edge.markers = { start: "arrow", end: "arrow" }; }
    ];
    for (const mutateMember of memberMutations) {
      const malformedMember = structuredClone(fixture.measuredScene) as MeasuredScene;
      mutateMember(malformedMember.edges[1]!);
      const atomicFailure = buildJourneyMapRoutingStages(
        malformedMember,
        fixture.preRoutingPositionedScene
      );
      expect(atomicFailure.connectorPlans).toEqual([]);
      expect(atomicFailure.deferredConnectors).toEqual([]);
      expect(atomicFailure.failedConnectorIds).toEqual(duplicateIds);
      expect(validateJourneyMapRoutes(
        fixture.routingStages.connectorPlans,
        fixture.preRoutingPositionedScene,
        "provisional",
        malformedMember
      ).map((diagnostic) => diagnostic.code)).toContain(
        "renderer.routing.journey_map_archetype_fallback"
      );
    }

    const malformedIdentityMutations: Array<
      (metadata: NonNullable<MeasuredScene["edges"][number]["viewMetadata"]>["journeyMap"])
        => void
    > = [
      (metadata) => { metadata!.authorOrder = -1; },
      (metadata) => { metadata!.authorOrder = 0; },
      (metadata) => { metadata!.sameEndpointOrdinal = 7; },
      (metadata) => { metadata!.exactIdentityOrdinal = -1; }
    ];
    for (const mutateIdentity of malformedIdentityMutations) {
      const malformedIdentity = structuredClone(fixture.measuredScene) as MeasuredScene;
      const metadata = malformedIdentity.edges[1]!.viewMetadata?.journeyMap;
      expect(metadata).toBeDefined();
      mutateIdentity(metadata);
      const deferred = buildJourneyMapRoutingStages(
        malformedIdentity,
        fixture.preRoutingPositionedScene
      );
      expect(deferred.connectorPlans).toEqual([]);
      expect(deferred.deferredConnectors).toHaveLength(3);
      expect(deferred.deferredConnectors.every((edge) =>
        edge.deferredFamilies.includes("duplicate")
      )).toBe(true);
      expect(deferred.failedConnectorIds).toEqual([]);
    }

    const narrowGap = structuredClone(fixture.preRoutingPositionedScene) as PositionedScene;
    findNode(narrowGap, "J-802").x = 280;
    const capacityFailure = buildJourneyMapRoutingStages(fixture.measuredScene, narrowGap);
    expect(capacityFailure.connectorPlans).toEqual([]);
    expect(capacityFailure.deferredConnectors).toEqual([]);
    expect(capacityFailure.failedConnectorIds).toEqual(duplicateIds);
    expect(capacityFailure.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        "renderer.routing.journey_map_archetype_fallback",
        "renderer.routing.journey_map_edge_omitted"
      ])
    );

    const insufficientRootHeight = structuredClone(
      fixture.preRoutingPositionedScene
    ) as PositionedScene;
    insufficientRootHeight.root.height = 72;
    const rootCapacityFailure = buildJourneyMapRoutingStages(
      fixture.measuredScene,
      insufficientRootHeight
    );
    expect(rootCapacityFailure.connectorPlans).toEqual([]);
    expect(rootCapacityFailure.failedConnectorIds).toEqual(duplicateIds);

    const obstructed = structuredClone(fixture.preRoutingPositionedScene) as PositionedScene;
    const obstacle = structuredClone(findNode(obstructed, "J-801")) as PositionedNode;
    obstacle.id = "J-duplicate-obstacle";
    obstacle.x = 270;
    obstacle.y = 44;
    obstacle.width = 12;
    obstacle.height = 24;
    obstacle.content = [];
    obstacle.ports = [];
    obstacle.viewMetadata = {
      journeyMap: {
        kind: "step",
        rootOrder: 2,
        globalStepOrder: 2,
        uncontained: true
      }
    };
    obstructed.root.children.push(obstacle);
    const obstacleFailure = buildJourneyMapRoutingStages(fixture.measuredScene, obstructed);
    expect(obstacleFailure.connectorPlans).toEqual([]);
    expect(obstacleFailure.failedConnectorIds).toEqual(duplicateIds);

    for (const groupSize of [4, 5]) {
      const oversized = structuredClone(fixture.measuredScene) as MeasuredScene;
      for (let ordinal = 3; ordinal < groupSize; ordinal += 1) {
        const member = structuredClone(oversized.edges[ordinal === 3 ? 1 : 2]!);
        member.id = `synthetic-duplicate-occurrence-${groupSize}-${ordinal}`;
        const metadata = member.viewMetadata?.journeyMap;
        expect(metadata).toBeDefined();
        metadata!.authorOrder = ordinal;
        metadata!.sameEndpointOrdinal = ordinal;
        metadata!.exactIdentityOrdinal = ordinal - 2;
        oversized.edges.push(member);
      }
      const oversizedFailure = buildJourneyMapRoutingStages(
        oversized,
        fixture.preRoutingPositionedScene
      );
      expect(oversizedFailure.connectorPlans).toEqual([]);
      expect(oversizedFailure.deferredConnectors).toEqual([]);
      expect(oversizedFailure.failedConnectorIds).toEqual(oversized.edges.map((edge) => edge.id));
      expect(oversizedFailure.diagnostics.filter((diagnostic) =>
        diagnostic.code === "renderer.routing.journey_map_archetype_fallback"
      )).toHaveLength(groupSize);
    }

    const unsupported = structuredClone(fixture.preRoutingPositionedScene) as PositionedScene;
    const unsupportedMetadata = findNode(unsupported, "J-802").viewMetadata?.journeyMap;
    expect(unsupportedMetadata?.kind).toBe("step");
    if (unsupportedMetadata?.kind === "step") {
      unsupportedMetadata.rootOrder = 2;
    }
    const unsupportedResult = buildJourneyMapRoutingStages(fixture.measuredScene, unsupported);
    expect(unsupportedResult.connectorPlans).toEqual([]);
    expect(unsupportedResult.deferredConnectors).toHaveLength(3);
    expect(unsupportedResult.failedConnectorIds).toEqual([]);

    const repeatedStableId = structuredClone(fixture.measuredScene) as MeasuredScene;
    repeatedStableId.edges.push(structuredClone(repeatedStableId.edges[0]!));
    const repeated = buildJourneyMapRoutingStages(
      repeatedStableId,
      fixture.preRoutingPositionedScene
    );
    expect(repeated.connectorPlans.filter((plan) =>
      plan.from === "J-801" && plan.to === "J-802"
    )).toEqual([]);
    expect(repeated.failedConnectorIds).toContain(duplicateIds[0]);
    expect(repeated.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "renderer.routing.journey_map_edge_duplicated"
    );
  });

  it("defers every duplicate morphology outside the accepted adjacent root-Step group", async () => {
    const primary = await buildFixture("primary");
    const topology = await buildFixture("topology");
    const assertGroupDeferred = (
      measuredScene: MeasuredScene,
      positionedScene: PositionedScene,
      groupIds: readonly string[]
    ) => {
      const result = buildJourneyMapRoutingStages(measuredScene, positionedScene);
      expect(result.connectorPlans.filter((plan) => groupIds.includes(plan.id))).toEqual([]);
      expect(result.failedConnectorIds.filter((id) => groupIds.includes(id))).toEqual([]);
      expect(result.deferredConnectors.filter((edge) => groupIds.includes(edge.id))).toEqual(
        expect.arrayContaining(groupIds.map((id) => expect.objectContaining({
          id,
          deferredFamilies: expect.arrayContaining(["duplicate"])
        })))
      );
    };

    const sameStageBase = primary.measuredScene.edges.find((edge) =>
      edge.from.itemId === "J-101" && edge.to.itemId === "J-102"
    )!;
    const sameStageGroup = duplicateGroupFrom(sameStageBase, "unsupported-contained");
    assertGroupDeferred(
      { ...structuredClone(primary.measuredScene), edges: sameStageGroup },
      primary.preRoutingPositionedScene,
      sameStageGroup.map((edge) => edge.id)
    );

    const crossStageBase = primary.measuredScene.edges.find((edge) =>
      edge.from.itemId === "J-103" && edge.to.itemId === "J-201"
    )!;
    const crossStageGroup = duplicateGroupFrom(crossStageBase, "unsupported-cross-stage");
    assertGroupDeferred(
      { ...structuredClone(primary.measuredScene), edges: crossStageGroup },
      primary.preRoutingPositionedScene,
      crossStageGroup.map((edge) => edge.id)
    );

    const backwardBase = topology.measuredScene.edges.find((edge) =>
      edge.from.itemId === "J-714" && edge.to.itemId === "J-713"
    )!;
    const backwardGroup = duplicateGroupFrom(backwardBase, "unsupported-backward");
    assertGroupDeferred(
      { ...structuredClone(topology.measuredScene), edges: backwardGroup },
      topology.preRoutingPositionedScene,
      backwardGroup.map((edge) => edge.id)
    );

    const selfLoopBase = topology.measuredScene.edges.find((edge) =>
      edge.from.itemId === "J-713" && edge.to.itemId === "J-713"
    )!;
    const selfLoopGroup = duplicateGroupFrom(selfLoopBase, "unsupported-self-loop");
    assertGroupDeferred(
      { ...structuredClone(topology.measuredScene), edges: selfLoopGroup },
      topology.preRoutingPositionedScene,
      selfLoopGroup.map((edge) => edge.id)
    );

    const cycleForwardBase = topology.measuredScene.edges.find((edge) =>
      edge.from.itemId === "J-701" && edge.to.itemId === "J-702"
    )!;
    const cycleReturn = structuredClone(topology.measuredScene.edges.find((edge) =>
      edge.from.itemId === "J-702" && edge.to.itemId === "J-701"
    )!);
    const cycleGroup = duplicateGroupFrom(cycleForwardBase, "unsupported-cycle");
    assertGroupDeferred(
      { ...structuredClone(topology.measuredScene), edges: [...cycleGroup, cycleReturn] },
      topology.preRoutingPositionedScene,
      cycleGroup.map((edge) => edge.id)
    );

    const rootBase = primary.measuredScene.edges.find((edge) =>
      edge.from.itemId === "J-250" && edge.to.itemId === "J-260"
    )!;
    const mixedBranchGroup = duplicateGroupFrom(rootBase, "unsupported-mixed-branch");
    const extraOutgoing = structuredClone(rootBase);
    extraOutgoing.id = "unsupported-extra-outgoing";
    extraOutgoing.to = { ...extraOutgoing.to, itemId: "J-401", portId: undefined };
    extraOutgoing.viewMetadata!.journeyMap!.authorOrder = 3;
    assertGroupDeferred(
      {
        ...structuredClone(primary.measuredScene),
        edges: [...mixedBranchGroup, extraOutgoing]
      },
      primary.preRoutingPositionedScene,
      mixedBranchGroup.map((edge) => edge.id)
    );

    const mixedJoinGroup = duplicateGroupFrom(rootBase, "unsupported-mixed-join");
    const extraIncoming = structuredClone(rootBase);
    extraIncoming.id = "unsupported-extra-incoming";
    extraIncoming.from = { ...extraIncoming.from, itemId: "J-401", portId: undefined };
    extraIncoming.viewMetadata!.journeyMap!.authorOrder = 3;
    assertGroupDeferred(
      {
        ...structuredClone(primary.measuredScene),
        edges: [...mixedJoinGroup, extraIncoming]
      },
      primary.preRoutingPositionedScene,
      mixedJoinGroup.map((edge) => edge.id)
    );
  });

  it("renders deterministic duplicate-fan SVG and derives PNG from that exact SVG", async () => {
    const fixture = await buildFixture("duplicate");
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
    const direct = await renderPositionedSceneToPng(
      first.routingStages.provisionalPositionedScene
    );
    expect(first.provisionalSvg).toBe(direct.svg);
    expect(sha256(first.provisionalPng)).toBe(sha256(direct.png));
    expect(first.provisionalSvg).toBe(second.provisionalSvg);
    expect(sha256(first.provisionalPng)).toBe(sha256(second.provisionalPng));
    for (const edgeId of duplicateIds) {
      expect(first.provisionalSvg).toContain(`data-edge-id="${edgeId}"`);
    }
    expect((first.provisionalSvg.match(/data-edge-id=/g) ?? [])).toHaveLength(3);
    expect(first.diagnostics).toEqual([
      expect.objectContaining({
        code: "renderer.scene.journey_map_step_only",
        severity: "info",
        targetId: "J-801"
      })
    ]);
    expect(first.diagnostics.some((diagnostic) =>
      diagnostic.severity === "warn" || diagnostic.severity === "error"
    )).toBe(false);
  });
});
