import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import type {
  Point,
  PositionedContainer,
  PositionedNode,
  PositionedRoute
} from "../src/renderer/staged/contracts.js";
import { renderJourneyMapRoutingArtifacts } from "../src/renderer/staged/journeyMap.js";
import { MIN_ARROW_MARKER_LEG } from "../src/renderer/staged/routing.js";
import {
  collectHeaderBoxes,
  expectNoRouteIntersectionsWithNonEndpointBoxes,
  expectRoutesDoNotEnterEndpointBoxes,
  flattenPositionedItems,
  getTerminalSegmentLength,
  routeIntersectsRect
} from "./stagedVisualHarness.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");
const fixturePath = path.join(
  repoRoot,
  "tests/fixtures/render/journey_map_staged_ordering_ownership.sdd"
);
const primaryFixturePath = path.join(
  repoRoot,
  "tests/fixtures/render/journey_map_staged_primary.sdd"
);
const topologyFixturePath = path.join(
  repoRoot,
  "tests/fixtures/render/journey_map_staged_topology.sdd"
);
const compressedFixturePath = path.join(
  repoRoot,
  "tests/fixtures/render/journey_map_staged_compressed.sdd"
);

function routeContainsPoint(route: PositionedRoute, point: Point): boolean {
  return route.points.slice(1).some((end, index) => {
    const start = route.points[index]!;
    if (start.x === end.x && point.x === start.x) {
      return point.y >= Math.min(start.y, end.y) && point.y <= Math.max(start.y, end.y);
    }
    if (start.y === end.y && point.y === start.y) {
      return point.x >= Math.min(start.x, end.x) && point.x <= Math.max(start.x, end.x);
    }
    return false;
  });
}

describe("journey map Gate 6 visual acceptance", () => {
  it("keeps the isolated same-Stage skip below the Step row with clear south ports", async () => {
    const bundle = await loadBundle(manifestPath);
    const compiled = compileSource({
      path: fixturePath,
      text: await readFile(fixturePath, "utf8")
    }, bundle);
    expect(compiled.diagnostics).toEqual([]);
    expect(compiled.graph).toBeDefined();
    const projected = projectView(compiled.graph!, bundle, "journey_map");
    expect(projected.diagnostics).toEqual([]);
    expect(projected.projection).toBeDefined();
    const view = bundle.views.views.find((candidate) => candidate.id === "journey_map");
    expect(view).toBeDefined();

    const rendered = await renderJourneyMapRoutingArtifacts(
      projected.projection!,
      compiled.graph!,
      bundle,
      view!,
      "strict"
    );
    const scene = rendered.routingStages.provisionalPositionedScene;
    expect(scene.edges).toHaveLength(3);
    const edge = scene.edges.find((candidate) =>
      candidate.from.itemId === "J-503" && candidate.to.itemId === "J-501"
    );
    expect(edge).toBeDefined();
    expect(edge).toMatchObject({
      from: { itemId: "J-503", portId: "J-503__escape_out", x: 980, y: 156 },
      to: { itemId: "J-501", portId: "J-501__escape_in", x: 1476, y: 140 }
    });
    expect(getTerminalSegmentLength(edge!)).toBeGreaterThanOrEqual(MIN_ARROW_MARKER_LEG);

    const items = flattenPositionedItems(scene.root);
    const nodes = items.filter((item): item is PositionedNode => item.kind === "node");
    const nodeBoxes = nodes.map((node) => ({
      itemId: node.id,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height
    }));
    expectNoRouteIntersectionsWithNonEndpointBoxes(scene.edges, nodeBoxes);
    expectRoutesDoNotEnterEndpointBoxes(scene.edges, nodeBoxes);
    for (const header of collectHeaderBoxes(scene.root)) {
      expect(routeIntersectsRect(edge!.route, header)).toBe(false);
    }

    const owner = items.find((item): item is PositionedContainer =>
      item.kind === "container" && item.id === "G-500"
    );
    expect(owner).toBeDefined();
    expect(owner!.children.map((child) => child.id)).toEqual(["J-503", "J-502", "J-501"]);
    expect(scene.root.children.map((child) => child.id)).toEqual(["G-600", "J-590", "G-500", "J-591"]);
    for (const point of edge!.route.points) {
      expect(point.x).toBeGreaterThan(owner!.x);
      expect(point.x).toBeLessThan(owner!.x + owner!.width);
      expect(point.y).toBeGreaterThan(
        owner!.y + owner!.chrome.padding.top + (owner!.chrome.headerBandHeight ?? 0)
      );
      expect(point.y).toBeLessThan(owner!.y + owner!.height);
    }
    expect(rendered.provisionalSvg).toContain("data-edge-id=");
    expect(rendered.provisionalSvg).toContain("marker-end=\"url(#scene-marker-arrow-end)\"");
    expect(rendered.diagnostics.some((diagnostic) =>
      diagnostic.severity === "warn" || diagnostic.severity === "error"
    )).toBe(false);
  });

  it("keeps the long cross-Stage route peripheral and the root-Step chain visually direct", async () => {
    const bundle = await loadBundle(manifestPath);
    const compiled = compileSource({
      path: primaryFixturePath,
      text: await readFile(primaryFixturePath, "utf8")
    }, bundle);
    expect(compiled.diagnostics).toEqual([]);
    expect(compiled.graph).toBeDefined();
    const projected = projectView(compiled.graph!, bundle, "journey_map");
    expect(projected.diagnostics).toEqual([]);
    expect(projected.projection).toBeDefined();
    const view = bundle.views.views.find((candidate) => candidate.id === "journey_map");
    expect(view).toBeDefined();

    const rendered = await renderJourneyMapRoutingArtifacts(
      projected.projection!,
      compiled.graph!,
      bundle,
      view!,
      "strict"
    );
    const scene = rendered.routingStages.provisionalPositionedScene;
    expect(scene.edges).toHaveLength(9);
    const longCross = scene.edges.find((edge) =>
      edge.from.itemId === "J-204" && edge.to.itemId === "J-401"
    );
    const rootDirect = scene.edges.find((edge) =>
      edge.from.itemId === "J-250" && edge.to.itemId === "J-260"
    );
    expect(longCross).toBeDefined();
    expect(rootDirect).toBeDefined();
    expect(longCross!.from).toMatchObject({ portId: "J-204__escape_out", x: 1788, y: 140 });
    expect(longCross!.to).toMatchObject({ portId: "J-401__escape_in", x: 2859.576, y: 140 });
    expect(rootDirect!.route.points).toEqual([
      { x: 2184, y: 116 },
      { x: 2224, y: 116 }
    ]);

    const items = flattenPositionedItems(scene.root);
    const nodes = items.filter((item): item is PositionedNode => item.kind === "node");
    const nodeBoxes = nodes.map((node) => ({
      itemId: node.id,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height
    }));
    expectNoRouteIntersectionsWithNonEndpointBoxes([longCross!, rootDirect!], nodeBoxes);
    expectRoutesDoNotEnterEndpointBoxes([longCross!, rootDirect!], nodeBoxes);
    for (const header of collectHeaderBoxes(scene.root)) {
      expect(routeIntersectsRect(longCross!.route, header)).toBe(false);
    }

    const rootItemBoxes = scene.root.children
      .filter((item) => ["J-250", "J-260", "G-300"].includes(item.id))
      .map((item) => ({
        itemId: item.id,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height
      }));
    for (const box of rootItemBoxes) {
      expect(routeIntersectsRect(longCross!.route, box)).toBe(false);
    }
    const peripheralY = 248;
    expect(peripheralY).toBeGreaterThan(
      Math.max(...scene.root.children.map((item) => item.y + item.height))
    );
    expect(peripheralY).toBeLessThan(scene.root.y + scene.root.height);
    expect(longCross!.route.points).toContainEqual({ x: 1788, y: 236 });
    expect(longCross!.route.points).toContainEqual({ x: 2859.576, y: 160 });
    expect(longCross!.route.points.at(-2)?.y).toBeGreaterThan(longCross!.route.points.at(-1)!.y);
    expect(getTerminalSegmentLength(longCross!)).toBeGreaterThanOrEqual(MIN_ARROW_MARKER_LEG);
    expect(rendered.provisionalSvg).not.toBe(rendered.step2Svg);
    expect(rendered.diagnostics.some((diagnostic) =>
      diagnostic.severity === "warn" || diagnostic.severity === "error"
    )).toBe(false);
  });

  it("keeps branch fan-out on a common east departure with clear local and root-peripheral tracks", async () => {
    const bundle = await loadBundle(manifestPath);
    const view = bundle.views.views.find((candidate) => candidate.id === "journey_map");
    expect(view).toBeDefined();

    const renderFixture = async (fixture: string) => {
      const compiled = compileSource({
        path: fixture,
        text: await readFile(fixture, "utf8")
      }, bundle);
      expect(compiled.diagnostics).toEqual([]);
      expect(compiled.graph).toBeDefined();
      const projected = projectView(compiled.graph!, bundle, "journey_map");
      expect(projected.diagnostics).toEqual([]);
      expect(projected.projection).toBeDefined();
      return renderJourneyMapRoutingArtifacts(
        projected.projection!,
        compiled.graph!,
        bundle,
        view!,
        "strict"
      );
    };

    const primary = await renderFixture(primaryFixturePath);
    const primaryScene = primary.routingStages.provisionalPositionedScene;
    const primaryBranches = primaryScene.edges.filter((edge) => edge.from.itemId === "J-201");
    expect(primaryBranches).toHaveLength(2);
    expect(primaryBranches.map((edge) => edge.from)).toEqual([
      { itemId: "J-201", portId: "J-201__flow_out", x: 1156, y: 154 },
      { itemId: "J-201", portId: "J-201__flow_out", x: 1156, y: 154 }
    ]);
    expect(primaryBranches[0]!.route.points).toContainEqual({ x: 1168, y: 116 });
    expect(primaryBranches[1]!.route.points).toContainEqual({ x: 1168, y: 228 });

    const primaryItems = flattenPositionedItems(primaryScene.root);
    const primaryNodeBoxes = primaryItems
      .filter((item): item is PositionedNode => item.kind === "node")
      .map((node) => ({
        itemId: node.id,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height
      }));
    expectNoRouteIntersectionsWithNonEndpointBoxes(primaryBranches, primaryNodeBoxes);
    expectRoutesDoNotEnterEndpointBoxes(primaryBranches, primaryNodeBoxes);
    for (const edge of primaryBranches) {
      for (const header of collectHeaderBoxes(primaryScene.root)) {
        expect(routeIntersectsRect(edge.route, header)).toBe(false);
      }
      expect(getTerminalSegmentLength(edge)).toBeGreaterThanOrEqual(MIN_ARROW_MARKER_LEG);
    }

    const topology = await renderFixture(topologyFixturePath);
    const topologyScene = topology.routingStages.provisionalPositionedScene;
    expect(topologyScene.edges).toHaveLength(8);
    const enterStage = topologyScene.edges.find((edge) =>
      edge.from.itemId === "J-790" && edge.to.itemId === "J-701"
    );
    const outer = topologyScene.edges.find((edge) =>
      edge.from.itemId === "J-790" && edge.to.itemId === "J-791"
    );
    const exitStage = topologyScene.edges.find((edge) =>
      edge.from.itemId === "J-714" && edge.to.itemId === "J-791"
    );
    expect(enterStage?.route.points).toEqual([
      { x: 256, y: 116 }, { x: 296, y: 116 }, { x: 316, y: 116 }
    ]);
    expect(outer?.route.points).toContainEqual({ x: 276, y: 188 });
    expect(outer?.route.points).toContainEqual({ x: 1800, y: 188 });
    expect(exitStage?.route.points).toEqual([
      { x: 1780, y: 116 }, { x: 1800, y: 116 }, { x: 1840, y: 116 }
    ]);

    const topologyItems = flattenPositionedItems(topologyScene.root);
    const topologyNodeBoxes = topologyItems
      .filter((item): item is PositionedNode => item.kind === "node")
      .map((node) => ({
        itemId: node.id,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height
      }));
    expectNoRouteIntersectionsWithNonEndpointBoxes(topologyScene.edges, topologyNodeBoxes);
    expectRoutesDoNotEnterEndpointBoxes(topologyScene.edges, topologyNodeBoxes);
    for (const edge of topologyScene.edges) {
      for (const header of collectHeaderBoxes(topologyScene.root)) {
        expect(routeIntersectsRect(edge.route, header)).toBe(false);
      }
      expect(getTerminalSegmentLength(edge)).toBeGreaterThanOrEqual(MIN_ARROW_MARKER_LEG);
    }
    const stage = topologyItems.find((item): item is PositionedContainer =>
      item.kind === "container" && item.id === "G-700"
    );
    expect(stage).toBeDefined();
    expect(188).toBeGreaterThan(stage!.y + stage!.height);
    expect(188).toBeLessThan(topologyScene.root.y + topologyScene.root.height);
    expect(primary.diagnostics.some((diagnostic) =>
      diagnostic.severity === "warn" || diagnostic.severity === "error"
    )).toBe(false);
    expect(topology.diagnostics.some((diagnostic) =>
      diagnostic.severity === "warn" || diagnostic.severity === "error"
    )).toBe(false);
  });

  it("records the nominal join crossing as readability debt while keeping hard geometry clear", async () => {
    const bundle = await loadBundle(manifestPath);
    const compiled = compileSource({
      path: primaryFixturePath,
      text: await readFile(primaryFixturePath, "utf8")
    }, bundle);
    expect(compiled.diagnostics).toEqual([]);
    expect(compiled.graph).toBeDefined();
    const projected = projectView(compiled.graph!, bundle, "journey_map");
    expect(projected.diagnostics).toEqual([]);
    expect(projected.projection).toBeDefined();
    const view = bundle.views.views.find((candidate) => candidate.id === "journey_map");
    expect(view).toBeDefined();
    const rendered = await renderJourneyMapRoutingArtifacts(
      projected.projection!,
      compiled.graph!,
      bundle,
      view!,
      "strict"
    );
    const scene = rendered.routingStages.provisionalPositionedScene;
    expect(scene.edges).toHaveLength(9);
    const bypass = scene.edges.find((edge) =>
      edge.from.itemId === "J-202" && edge.to.itemId === "J-204"
    );
    const direct = scene.edges.find((edge) =>
      edge.from.itemId === "J-203" && edge.to.itemId === "J-204"
    );
    const branchBypass = scene.edges.find((edge) =>
      edge.from.itemId === "J-201" && edge.to.itemId === "J-203"
    );
    expect(bypass?.route.points).toEqual([
      { x: 1292, y: 140 }, { x: 1292, y: 168 },
      { x: 1428, y: 168 }, { x: 1652, y: 168 }, { x: 1664, y: 168 },
      { x: 1664, y: 116 }, { x: 1676, y: 116 }
    ]);
    expect(direct?.route.points).toEqual([
      { x: 1652, y: 124 }, { x: 1664, y: 124 },
      { x: 1664, y: 116 }, { x: 1676, y: 116 }
    ]);
    expect(branchBypass).toBeDefined();

    const nodeBoxes = flattenPositionedItems(scene.root)
      .filter((item): item is PositionedNode => item.kind === "node")
      .map((node) => ({
        itemId: node.id,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height
      }));
    expectNoRouteIntersectionsWithNonEndpointBoxes([bypass!, direct!], nodeBoxes);
    expectRoutesDoNotEnterEndpointBoxes([bypass!, direct!], nodeBoxes);
    for (const edge of [bypass!, direct!]) {
      for (const header of collectHeaderBoxes(scene.root)) {
        expect(routeIntersectsRect(edge.route, header)).toBe(false);
      }
      expect(getTerminalSegmentLength(edge)).toBeGreaterThanOrEqual(MIN_ARROW_MARKER_LEG);
    }

    const nominalCrossing = { x: 1540, y: 168 };
    expect(routeContainsPoint(bypass!.route, nominalCrossing)).toBe(true);
    expect(routeContainsPoint(branchBypass!.route, nominalCrossing)).toBe(true);
    const mergedConvergence = { x: 1664, y: 116 };
    expect(routeContainsPoint(bypass!.route, mergedConvergence)).toBe(true);
    expect(routeContainsPoint(direct!.route, mergedConvergence)).toBe(true);
    expect(rendered.diagnostics.some((diagnostic) =>
      diagnostic.severity === "warn" || diagnostic.severity === "error"
    )).toBe(false);
  });

  it("keeps backward routes peripheral while recording the shared ordering stem as readability debt", async () => {
    const bundle = await loadBundle(manifestPath);
    const view = bundle.views.views.find((candidate) => candidate.id === "journey_map");
    expect(view).toBeDefined();
    const renderFixture = async (sourcePath: string) => {
      const compiled = compileSource({
        path: sourcePath,
        text: await readFile(sourcePath, "utf8")
      }, bundle);
      expect(compiled.diagnostics).toEqual([]);
      expect(compiled.graph).toBeDefined();
      const projected = projectView(compiled.graph!, bundle, "journey_map");
      expect(projected.diagnostics).toEqual([]);
      expect(projected.projection).toBeDefined();
      return renderJourneyMapRoutingArtifacts(
        projected.projection!, compiled.graph!, bundle, view!, "strict"
      );
    };

    const ordering = await renderFixture(fixturePath);
    const orderingScene = ordering.routingStages.provisionalPositionedScene;
    expect(orderingScene.edges).toHaveLength(3);
    const incomingSkip = orderingScene.edges.find((edge) =>
      edge.from.itemId === "J-503" && edge.to.itemId === "J-501"
    );
    const sameStageReturn = orderingScene.edges.find((edge) =>
      edge.from.itemId === "J-501" && edge.to.itemId === "J-502"
    );
    const rootReturn = orderingScene.edges.find((edge) =>
      edge.from.itemId === "J-591" && edge.to.itemId === "J-590"
    );
    expect(sameStageReturn?.route.points).toEqual([
      { x: 1476, y: 140 }, { x: 1476, y: 152 },
      { x: 1228, y: 152 }, { x: 1228, y: 140 }
    ]);
    expect(rootReturn?.route.points).toEqual([
      { x: 1760, y: 140 }, { x: 1760, y: 188 },
      { x: 1608, y: 188 }, { x: 848, y: 188 },
      { x: 696, y: 188 }, { x: 696, y: 140 }
    ]);
    expect(incomingSkip).toBeDefined();
    const sharedStemPoint = { x: 1476, y: 146 };
    expect(routeContainsPoint(incomingSkip!.route, sharedStemPoint)).toBe(true);
    expect(routeContainsPoint(sameStageReturn!.route, sharedStemPoint)).toBe(true);

    const orderingItems = flattenPositionedItems(orderingScene.root);
    const orderingNodes = orderingItems
      .filter((item): item is PositionedNode => item.kind === "node")
      .map((node) => ({
        itemId: node.id, x: node.x, y: node.y, width: node.width, height: node.height
      }));
    expectNoRouteIntersectionsWithNonEndpointBoxes(
      [sameStageReturn!, rootReturn!], orderingNodes
    );
    expectRoutesDoNotEnterEndpointBoxes([sameStageReturn!, rootReturn!], orderingNodes);
    for (const edge of [sameStageReturn!, rootReturn!]) {
      for (const header of collectHeaderBoxes(orderingScene.root)) {
        expect(routeIntersectsRect(edge.route, header)).toBe(false);
      }
      expect(getTerminalSegmentLength(edge)).toBeGreaterThanOrEqual(MIN_ARROW_MARKER_LEG);
      expect(edge.route.points.at(-2)!.y).toBeGreaterThan(edge.route.points.at(-1)!.y);
    }
    const orderingStage = orderingItems.find((item): item is PositionedContainer =>
      item.kind === "container" && item.id === "G-500"
    );
    expect(orderingStage).toBeDefined();
    expect(188).toBeGreaterThan(orderingStage!.y + orderingStage!.height);
    expect(188).toBeLessThan(orderingScene.root.y + orderingScene.root.height);

    const topology = await renderFixture(topologyFixturePath);
    const topologyScene = topology.routingStages.provisionalPositionedScene;
    expect(topologyScene.edges).toHaveLength(8);
    const topologyReturn = topologyScene.edges.find((edge) =>
      edge.from.itemId === "J-714" && edge.to.itemId === "J-713"
    );
    expect(topologyReturn?.route.points).toEqual([
      { x: 1668, y: 140 }, { x: 1668, y: 152 },
      { x: 1420, y: 152 }, { x: 1420, y: 140 }
    ]);
    const topologyItems = flattenPositionedItems(topologyScene.root);
    const topologyNodes = topologyItems
      .filter((item): item is PositionedNode => item.kind === "node")
      .map((node) => ({
        itemId: node.id, x: node.x, y: node.y, width: node.width, height: node.height
      }));
    expectNoRouteIntersectionsWithNonEndpointBoxes([topologyReturn!], topologyNodes);
    expectRoutesDoNotEnterEndpointBoxes([topologyReturn!], topologyNodes);
    for (const header of collectHeaderBoxes(topologyScene.root)) {
      expect(routeIntersectsRect(topologyReturn!.route, header)).toBe(false);
    }
    expect(getTerminalSegmentLength(topologyReturn!)).toBeGreaterThanOrEqual(
      MIN_ARROW_MARKER_LEG
    );
    expect(ordering.diagnostics.some((diagnostic) =>
      diagnostic.severity === "warn" || diagnostic.severity === "error"
    )).toBe(false);
    expect(topology.diagnostics.some((diagnostic) =>
      diagnostic.severity === "warn" || diagnostic.severity === "error"
    )).toBe(false);
  });

  it("keeps reciprocal and complex SCC routes peripheral while recording their shared tracks as readability debt", async () => {
    const bundle = await loadBundle(manifestPath);
    const view = bundle.views.views.find((candidate) => candidate.id === "journey_map");
    expect(view).toBeDefined();
    const renderFixture = async (sourcePath: string) => {
      const compiled = compileSource({
        path: sourcePath,
        text: await readFile(sourcePath, "utf8")
      }, bundle);
      expect(compiled.diagnostics).toEqual([]);
      expect(compiled.graph).toBeDefined();
      const projected = projectView(compiled.graph!, bundle, "journey_map");
      expect(projected.diagnostics).toEqual([]);
      expect(projected.projection).toBeDefined();
      return renderJourneyMapRoutingArtifacts(
        projected.projection!, compiled.graph!, bundle, view!, "strict"
      );
    };

    const topology = await renderFixture(topologyFixturePath);
    const topologyScene = topology.routingStages.provisionalPositionedScene;
    expect(topologyScene.edges).toHaveLength(8);
    const firstForward = topologyScene.edges.find((edge) =>
      edge.from.itemId === "J-701" && edge.to.itemId === "J-702"
    );
    const firstReturn = topologyScene.edges.find((edge) =>
      edge.from.itemId === "J-702" && edge.to.itemId === "J-701"
    );
    const secondForward = topologyScene.edges.find((edge) =>
      edge.from.itemId === "J-711" && edge.to.itemId === "J-712"
    );
    const secondReturn = topologyScene.edges.find((edge) =>
      edge.from.itemId === "J-712" && edge.to.itemId === "J-711"
    );
    expect(firstForward?.route.points).toEqual([
      { x: 428, y: 140 }, { x: 428, y: 152 },
      { x: 676, y: 152 }, { x: 676, y: 140 }
    ]);
    expect(firstReturn?.route.points).toEqual([
      { x: 676, y: 140 }, { x: 676, y: 152 },
      { x: 428, y: 152 }, { x: 428, y: 140 }
    ]);
    expect(secondForward?.route.points).toEqual([
      { x: 924, y: 140 }, { x: 924, y: 168 },
      { x: 1172, y: 168 }, { x: 1172, y: 156 }
    ]);
    expect(secondReturn?.route.points).toEqual([
      { x: 1172, y: 156 }, { x: 1172, y: 168 },
      { x: 924, y: 168 }, { x: 924, y: 140 }
    ]);
    expect(routeContainsPoint(firstForward!.route, { x: 552, y: 152 })).toBe(true);
    expect(routeContainsPoint(firstReturn!.route, { x: 552, y: 152 })).toBe(true);
    expect(routeContainsPoint(secondForward!.route, { x: 1048, y: 168 })).toBe(true);
    expect(routeContainsPoint(secondReturn!.route, { x: 1048, y: 168 })).toBe(true);

    const compressed = await renderFixture(compressedFixturePath);
    const compressedScene = compressed.routingStages.provisionalPositionedScene;
    expect(compressedScene.edges).toHaveLength(18);
    const shorterReturn = compressedScene.edges.find((edge) =>
      edge.from.itemId === "J-912" && edge.to.itemId === "J-902"
    );
    const outerReturn = compressedScene.edges.find((edge) =>
      edge.from.itemId === "J-913" && edge.to.itemId === "J-901"
    );
    expect(shorterReturn?.route.points).toEqual([
      { x: 1476, y: 140 }, { x: 1476, y: 160 }, { x: 1476, y: 172 },
      { x: 1056, y: 172 }, { x: 832, y: 172 }, { x: 412, y: 172 },
      { x: 412, y: 160 }, { x: 412, y: 140 }
    ]);
    expect(outerReturn?.route.points).toEqual([
      { x: 1724, y: 140 }, { x: 1724, y: 160 }, { x: 1724, y: 172 },
      { x: 1056, y: 172 }, { x: 832, y: 172 }, { x: 164, y: 172 },
      { x: 164, y: 160 }, { x: 164, y: 140 }
    ]);
    expect(routeContainsPoint(shorterReturn!.route, { x: 944, y: 172 })).toBe(true);
    expect(routeContainsPoint(outerReturn!.route, { x: 944, y: 172 })).toBe(true);

    for (const scene of [topologyScene, compressedScene]) {
      const nodeBoxes = flattenPositionedItems(scene.root)
        .filter((item): item is PositionedNode => item.kind === "node")
        .map((node) => ({
          itemId: node.id,
          x: node.x,
          y: node.y,
          width: node.width,
          height: node.height
        }));
      expectNoRouteIntersectionsWithNonEndpointBoxes(scene.edges, nodeBoxes);
      expectRoutesDoNotEnterEndpointBoxes(scene.edges, nodeBoxes);
      for (const edge of scene.edges) {
        for (const header of collectHeaderBoxes(scene.root)) {
          expect(routeIntersectsRect(edge.route, header)).toBe(false);
        }
        expect(getTerminalSegmentLength(edge)).toBeGreaterThanOrEqual(MIN_ARROW_MARKER_LEG);
      }
    }
    expect(topology.diagnostics.some((diagnostic) =>
      diagnostic.severity === "warn" || diagnostic.severity === "error"
    )).toBe(false);
    expect(compressed.diagnostics.some((diagnostic) =>
      diagnostic.severity === "warn" || diagnostic.severity === "error"
    )).toBe(false);
  });
});
