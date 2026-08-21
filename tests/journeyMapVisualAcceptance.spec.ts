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
import { JOURNEY_MAP_PREFERRED_TERMINAL_LEG } from "../src/renderer/staged/journeyMapRouting.js";
import type { RendererDiagnostic } from "../src/renderer/staged/diagnostics.js";
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
const duplicateFixturePath = path.join(
  repoRoot,
  "tests/fixtures/render/journey_map_staged_duplicate.sdd"
);

function isBlockingJourneyDiagnostic(diagnostic: RendererDiagnostic): boolean {
  return diagnostic.severity === "error"
    || (diagnostic.severity === "warn"
      && diagnostic.code !== "renderer.routing.journey_map_unavoidable_crossing");
}

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

function routesIntersect(left: PositionedRoute, right: PositionedRoute): boolean {
  const segments = (route: PositionedRoute) => route.points.slice(1).map((end, index) => ({
    start: route.points[index]!,
    end
  }));
  const between = (value: number, first: number, second: number) =>
    value >= Math.min(first, second) && value <= Math.max(first, second);
  return segments(left).some((leftSegment) => segments(right).some((rightSegment) => {
    const leftHorizontal = leftSegment.start.y === leftSegment.end.y;
    const rightHorizontal = rightSegment.start.y === rightSegment.end.y;
    if (leftHorizontal && rightHorizontal) {
      return leftSegment.start.y === rightSegment.start.y
        && Math.max(
          Math.min(leftSegment.start.x, leftSegment.end.x),
          Math.min(rightSegment.start.x, rightSegment.end.x)
        ) <= Math.min(
          Math.max(leftSegment.start.x, leftSegment.end.x),
          Math.max(rightSegment.start.x, rightSegment.end.x)
        );
    }
    if (!leftHorizontal && !rightHorizontal) {
      return leftSegment.start.x === rightSegment.start.x
        && Math.max(
          Math.min(leftSegment.start.y, leftSegment.end.y),
          Math.min(rightSegment.start.y, rightSegment.end.y)
        ) <= Math.min(
          Math.max(leftSegment.start.y, leftSegment.end.y),
          Math.max(rightSegment.start.y, rightSegment.end.y)
        );
    }
    const horizontal = leftHorizontal ? leftSegment : rightSegment;
    const vertical = leftHorizontal ? rightSegment : leftSegment;
    return between(vertical.start.x, horizontal.start.x, horizontal.end.x)
      && between(horizontal.start.y, vertical.start.y, vertical.end.y);
  }));
}

function sharedCollinearSegments(
  left: PositionedRoute,
  right: PositionedRoute
): Array<{ axis: "horizontal" | "vertical"; coordinate: number; start: number; end: number }> {
  const segments = (route: PositionedRoute) => route.points.slice(1).map((end, index) => ({
    start: route.points[index]!,
    end
  }));
  const shared: Array<{
    axis: "horizontal" | "vertical";
    coordinate: number;
    start: number;
    end: number;
  }> = [];
  for (const leftSegment of segments(left)) {
    for (const rightSegment of segments(right)) {
      const leftHorizontal = leftSegment.start.y === leftSegment.end.y;
      const rightHorizontal = rightSegment.start.y === rightSegment.end.y;
      if (leftHorizontal && rightHorizontal && leftSegment.start.y === rightSegment.start.y) {
        const start = Math.max(
          Math.min(leftSegment.start.x, leftSegment.end.x),
          Math.min(rightSegment.start.x, rightSegment.end.x)
        );
        const end = Math.min(
          Math.max(leftSegment.start.x, leftSegment.end.x),
          Math.max(rightSegment.start.x, rightSegment.end.x)
        );
        if (end > start) {
          shared.push({ axis: "horizontal", coordinate: leftSegment.start.y, start, end });
        }
      } else if (!leftHorizontal && !rightHorizontal
        && leftSegment.start.x === rightSegment.start.x) {
        const start = Math.max(
          Math.min(leftSegment.start.y, leftSegment.end.y),
          Math.min(rightSegment.start.y, rightSegment.end.y)
        );
        const end = Math.min(
          Math.max(leftSegment.start.y, leftSegment.end.y),
          Math.max(rightSegment.start.y, rightSegment.end.y)
        );
        if (end > start) {
          shared.push({ axis: "vertical", coordinate: leftSegment.start.x, start, end });
        }
      }
    }
  }
  return shared;
}

function properPerpendicularCrossings(left: PositionedRoute, right: PositionedRoute): Point[] {
  const segments = (route: PositionedRoute) => route.points.slice(1).map((end, index) => ({
    start: route.points[index]!,
    end
  }));
  const crossings: Point[] = [];
  for (const leftSegment of segments(left)) {
    for (const rightSegment of segments(right)) {
      const leftHorizontal = leftSegment.start.y === leftSegment.end.y;
      const rightHorizontal = rightSegment.start.y === rightSegment.end.y;
      if (leftHorizontal === rightHorizontal) {
        continue;
      }
      const horizontal = leftHorizontal ? leftSegment : rightSegment;
      const vertical = leftHorizontal ? rightSegment : leftSegment;
      const x = vertical.start.x;
      const y = horizontal.start.y;
      if (x > Math.min(horizontal.start.x, horizontal.end.x)
        && x < Math.max(horizontal.start.x, horizontal.end.x)
        && y > Math.min(vertical.start.y, vertical.end.y)
        && y < Math.max(vertical.start.y, vertical.end.y)) {
        crossings.push({ x, y });
      }
    }
  }
  return crossings;
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
      { detailId: "detailed" }
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
    expect(rendered.diagnostics.some(isBlockingJourneyDiagnostic)).toBe(false);
  });

  it("keeps the long cross-Stage route locally clear and the root-Step chain visually direct", async () => {
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
      { detailId: "detailed" }
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
    expect(longCross!.from).toMatchObject({ portId: "J-204__flow_out", x: 1656, y: 116 });
    expect(longCross!.to).toMatchObject({ portId: "J-401__escape_in", x: 2617.592, y: 140 });
    expect(rootDirect!.route.points).toEqual([
      { x: 1940, y: 116 },
      { x: 1980, y: 116 }
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
    const spanLocalY = 178;
    expect(spanLocalY).toBeGreaterThan(
      Math.max(...scene.root.children
        .filter((item) => ["J-250", "J-260", "G-300", "G-400"].includes(item.id))
        .map((item) => item.y + item.height))
    );
    expect(spanLocalY).toBeLessThan(scene.root.y + scene.root.height);
    expect(longCross!.route.points).toContainEqual({ x: 1694, y: 178 });
    expect(longCross!.route.points).toContainEqual({ x: 2617.592, y: 160 });
    expect(longCross!.route.points.at(-2)?.y).toBeGreaterThan(longCross!.route.points.at(-1)!.y);
    expect(getTerminalSegmentLength(longCross!)).toBeGreaterThanOrEqual(MIN_ARROW_MARKER_LEG);
    expect(rendered.provisionalSvg).not.toBe(rendered.step2Svg);
    expect(rendered.diagnostics.some(isBlockingJourneyDiagnostic)).toBe(false);
  });

  it("uses direct and minimal-L branch fan-out with clear local and root-peripheral tracks", async () => {
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
        { detailId: "detailed" }
      );
    };

    const primary = await renderFixture(primaryFixturePath);
    const primaryScene = primary.routingStages.provisionalPositionedScene;
    const primaryBranches = primaryScene.edges.filter((edge) => edge.from.itemId === "J-201");
    expect(primaryBranches).toHaveLength(2);
    expect(primaryBranches.map((edge) => edge.from)).toEqual([
      { itemId: "J-201", portId: "J-201__flow_out", x: 1160, y: 116 },
      { itemId: "J-201", portId: "J-201__escape_out", x: 1048, y: 204 }
    ]);
    expect(primaryBranches[0]!.route.points).toEqual([
      { x: 1160, y: 116 }, { x: 1184, y: 116 }
    ]);
    expect(primaryBranches[1]!.route.points).toEqual([
      { x: 1048, y: 204 }, { x: 1048, y: 260 }, { x: 1184, y: 260 }
    ]);

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
    expect(topologyScene.edges).toHaveLength(9);
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
      { x: 256, y: 116 }, { x: 316, y: 116 }
    ]);
    expect(outer?.route.points).toContainEqual({ x: 276, y: 194 });
    expect(outer?.route.points).toContainEqual({ x: 1800, y: 194 });
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
    expect(194).toBeGreaterThan(stage!.y + stage!.height);
    expect(194).toBeLessThan(topologyScene.root.y + topologyScene.root.height);
    expect(primary.diagnostics.some(isBlockingJourneyDiagnostic)).toBe(false);
    expect(topology.diagnostics.some(isBlockingJourneyDiagnostic)).toBe(false);
  });

  it("removes the nominal join crossing with direct and minimal-L routes", async () => {
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
      { detailId: "detailed" }
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
      { x: 1408, y: 116 }, { x: 1432, y: 116 }
    ]);
    expect(direct?.route.points).toEqual([
      { x: 1408, y: 260 }, { x: 1544, y: 260 }, { x: 1544, y: 140 }
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

    expect(routesIntersect(bypass!.route, direct!.route)).toBe(false);
    expect(sharedCollinearSegments(bypass!.route, direct!.route)).toEqual([]);
    expect(properPerpendicularCrossings(bypass!.route, direct!.route)).toEqual([]);
    expect(properPerpendicularCrossings(branchBypass!.route, direct!.route)).toEqual([]);
    expect(rendered.diagnostics.some(isBlockingJourneyDiagnostic)).toBe(false);
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
        projected.projection!, compiled.graph!, bundle, view!, { detailId: "detailed" }
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
      { x: 1476, y: 140 }, { x: 1476, y: 158 },
      { x: 1228, y: 158 }, { x: 1228, y: 140 }
    ]);
    expect(rootReturn?.route.points).toEqual([
      { x: 1760, y: 140 }, { x: 1760, y: 194 },
      { x: 1608, y: 194 }, { x: 848, y: 194 },
      { x: 696, y: 194 }, { x: 696, y: 140 }
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
    expect(topologyScene.edges).toHaveLength(9);
    const topologyReturn = topologyScene.edges.find((edge) =>
      edge.from.itemId === "J-714" && edge.to.itemId === "J-713"
    );
    expect(topologyReturn?.route.points).toEqual([
      { x: 1668, y: 140 }, { x: 1668, y: 158 },
      { x: 1420, y: 158 }, { x: 1420, y: 140 }
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
    expect(ordering.diagnostics.some(isBlockingJourneyDiagnostic)).toBe(false);
    expect(topology.diagnostics.some(isBlockingJourneyDiagnostic)).toBe(false);
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
        projected.projection!, compiled.graph!, bundle, view!, { detailId: "detailed" }
      );
    };

    const topology = await renderFixture(topologyFixturePath);
    const topologyScene = topology.routingStages.provisionalPositionedScene;
    expect(topologyScene.edges).toHaveLength(9);
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
      { x: 428, y: 140 }, { x: 428, y: 158 },
      { x: 676, y: 158 }, { x: 676, y: 140 }
    ]);
    expect(firstReturn?.route.points).toEqual([
      { x: 676, y: 140 }, { x: 676, y: 158 },
      { x: 428, y: 158 }, { x: 428, y: 140 }
    ]);
    expect(secondForward?.route.points).toEqual([
      { x: 924, y: 140 }, { x: 924, y: 174 },
      { x: 1172, y: 174 }, { x: 1172, y: 156 }
    ]);
    expect(secondReturn?.route.points).toEqual([
      { x: 1172, y: 156 }, { x: 1172, y: 174 },
      { x: 924, y: 174 }, { x: 924, y: 140 }
    ]);
    expect(routeContainsPoint(firstForward!.route, { x: 552, y: 158 })).toBe(true);
    expect(routeContainsPoint(firstReturn!.route, { x: 552, y: 158 })).toBe(true);
    expect(routeContainsPoint(secondForward!.route, { x: 1048, y: 174 })).toBe(true);
    expect(routeContainsPoint(secondReturn!.route, { x: 1048, y: 174 })).toBe(true);

    const compressed = await renderFixture(compressedFixturePath);
    const compressedScene = compressed.routingStages.provisionalPositionedScene;
    expect(compressedScene.edges).toHaveLength(18);
    const shorterReturn = compressedScene.edges.find((edge) =>
      edge.from.itemId === "J-912" && edge.to.itemId === "J-902"
    );
    const outerReturn = compressedScene.edges.find((edge) =>
      edge.from.itemId === "J-913" && edge.to.itemId === "J-901"
    );
    expect(shorterReturn).toBeDefined();
    expect(outerReturn).toBeDefined();
    const sharedReturnTrack = sharedCollinearSegments(
      shorterReturn!.route,
      outerReturn!.route
    ).find((segment) => segment.axis === "horizontal");
    expect(sharedReturnTrack).toBeDefined();
    expect(sharedReturnTrack!.coordinate).toBeGreaterThan(
      Math.max(...compressedScene.root.children.map((item) => item.y + item.height))
    );
    expect(sharedReturnTrack!.coordinate).toBeLessThan(
      compressedScene.root.y + compressedScene.root.height
    );

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
    expect(topology.diagnostics.some(isBlockingJourneyDiagnostic)).toBe(false);
    expect(compressed.diagnostics.filter(isBlockingJourneyDiagnostic)).toEqual([
      expect.objectContaining({
        code: "renderer.routing.journey_map_preferred_terminal_leg_unmet"
      })
    ]);
  }, 10_000);
});

describe("journey map Gate 6 self-loop visual acceptance", () => {
  it("separates the clockwise upper collar from the accepted backward track", async () => {
    const bundle = await loadBundle(manifestPath);
    const compiled = compileSource({
      path: topologyFixturePath,
      text: await readFile(topologyFixturePath, "utf8")
    }, bundle);
    expect(compiled.diagnostics).toEqual([]);
    expect(compiled.graph).toBeDefined();
    const projected = projectView(compiled.graph!, bundle, "journey_map");
    expect(projected.diagnostics).toEqual([]);
    expect(projected.projection).toBeDefined();
    const view = bundle.views.views.find((candidate) => candidate.id === "journey_map");
    expect(view).toBeDefined();
    const rendered = await renderJourneyMapRoutingArtifacts(
      projected.projection!, compiled.graph!, bundle, view!, { detailId: "detailed" }
    );
    const scene = rendered.routingStages.provisionalPositionedScene;
    expect(scene.edges).toHaveLength(9);
    const selfLoop = scene.edges.find((edge) =>
      edge.from.itemId === "J-713" && edge.to.itemId === "J-713"
    );
    const backward = scene.edges.find((edge) =>
      edge.from.itemId === "J-714" && edge.to.itemId === "J-713"
    );
    expect(selfLoop).toBeDefined();
    expect(backward).toBeDefined();
    expect(selfLoop).toMatchObject({
      from: { itemId: "J-713", portId: "J-713__flow_out", x: 1532, y: 116 },
      to: { itemId: "J-713", portId: "J-713__flow_in", x: 1308, y: 116 }
    });
    expect(selfLoop!.route.points).toEqual([
      { x: 1532, y: 116 }, { x: 1544, y: 116 }, { x: 1544, y: 80 },
      { x: 1290, y: 80 }, { x: 1290, y: 116 }, { x: 1308, y: 116 }
    ]);
    expect(getTerminalSegmentLength(selfLoop!)).toBe(JOURNEY_MAP_PREFERRED_TERMINAL_LEG);

    const items = flattenPositionedItems(scene.root);
    const nodeBoxes = items
      .filter((item): item is PositionedNode => item.kind === "node")
      .map((node) => ({
        itemId: node.id, x: node.x, y: node.y, width: node.width, height: node.height
      }));
    expectNoRouteIntersectionsWithNonEndpointBoxes([selfLoop!], nodeBoxes);
    expectRoutesDoNotEnterEndpointBoxes([selfLoop!], nodeBoxes);
    for (const header of collectHeaderBoxes(scene.root)) {
      expect(routeIntersectsRect(selfLoop!.route, header)).toBe(false);
    }
    const owner = items.find((item): item is PositionedContainer =>
      item.kind === "container" && item.id === "G-700"
    );
    expect(owner).toBeDefined();
    for (const point of selfLoop!.route.points) {
      expect(point.x).toBeGreaterThan(owner!.x);
      expect(point.x).toBeLessThan(owner!.x + owner!.width);
      expect(point.y).toBeGreaterThan(
        owner!.y + (owner!.chrome.headerBandHeight ?? 0)
      );
      expect(point.y).toBeLessThan(owner!.y + owner!.height);
    }
    expect(routesIntersect(selfLoop!.route, backward!.route)).toBe(false);
    const acceptedEarlierIds = [
      "J-790__PRECEDES__J-701__661a1f868e72e80d2f47aedd3157ec09171f344f4a9aa62486fc7da5457bd384__0",
      "J-790__PRECEDES__J-791__71d18a11d3f80b2283cb17a0d68e86a327e54fca708def24c118a265fc3cd6be__0",
      "J-714__PRECEDES__J-791__37d24514299e09f03f8d2a42e59503f5de765431b1348d451dfadcb4d8555722__0",
      "J-701__PRECEDES__J-702__62dd9eaed887ffe62145782afe1dc6bc99c19e1b2bf7a5d307b531d232493540__0",
      "J-702__PRECEDES__J-701__c9a6391812ee931f5875c47b25b2d20c79e3d847c68b0dfe4f1b2b60b6d8a5fe__0",
      "J-711__PRECEDES__J-712__9a1802733c65b60fc3855bbf277a593f8778b7ddae303150862ec114578c2c57__0",
      "J-712__PRECEDES__J-711__540ae902a78d2f04ab591261eca74d355c37e4a437c084c2e44d877b71f8c822__0",
      "J-714__PRECEDES__J-713__48be4303b0633d1150403027b444b86f13dc6ac7e956b46aa2bdaa0956251025__0"
    ];
    const acceptedEarlier = scene.edges.filter((edge) => edge.id !== selfLoop!.id);
    expect(acceptedEarlier.map((edge) => edge.id)).toEqual(acceptedEarlierIds);
    for (const acceptedEdge of acceptedEarlier) {
      expect(routesIntersect(selfLoop!.route, acceptedEdge.route), acceptedEdge.id).toBe(false);
    }
    expect(routeContainsPoint(selfLoop!.route, { x: 1500, y: 80 })).toBe(true);
    expect(routeContainsPoint(backward!.route, { x: 1500, y: 158 })).toBe(true);
    expect(rendered.provisionalSvg).toContain("marker-end=\"url(#scene-marker-arrow-end)\"");
    expect(rendered.diagnostics.some(isBlockingJourneyDiagnostic)).toBe(false);
  });
});

describe("journey map Gate 6 duplicate occurrence visual acceptance", () => {
  it("keeps three nominal tracks countable while isolating Gate 7 debt to terminal stubs", async () => {
    const bundle = await loadBundle(manifestPath);
    const compiled = compileSource({
      path: duplicateFixturePath,
      text: await readFile(duplicateFixturePath, "utf8")
    }, bundle);
    expect(compiled.diagnostics).toEqual([]);
    expect(compiled.graph).toBeDefined();
    const projected = projectView(compiled.graph!, bundle, "journey_map");
    expect(projected.diagnostics).toEqual([]);
    expect(projected.projection).toBeDefined();
    const view = bundle.views.views.find((candidate) => candidate.id === "journey_map");
    expect(view).toBeDefined();
    const rendered = await renderJourneyMapRoutingArtifacts(
      projected.projection!, compiled.graph!, bundle, view!, { detailId: "detailed" }
    );
    const rerendered = await renderJourneyMapRoutingArtifacts(
      projected.projection!, compiled.graph!, bundle, view!, { detailId: "detailed" }
    );
    expect(rendered.provisionalSvg).toBe(rerendered.provisionalSvg);
    const scene = rendered.routingStages.provisionalPositionedScene;
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
    expect(scene.root).toMatchObject({ x: 0, y: 0, width: 552, height: 112 });
    expect(scene.edges.map((edge) => edge.id)).toEqual(duplicateIds);
    expect(scene.edges.map((edge) => edge.route.points)).toEqual(expectedRoutes);
    expect(scene.edges.map((edge) => [
      edge.from.portId,
      edge.from.x,
      edge.from.y,
      edge.to.portId,
      edge.to.x,
      edge.to.y
    ])).toEqual(duplicateIds.map(() => [
      "J-801__flow_out", 256, 56, "J-802__flow_in", 296, 56
    ]));

    const checkpoints = [{ x: 276, y: 56 }, { x: 276, y: 40 }, { x: 276, y: 72 }];
    for (const [expectedIndex, checkpoint] of checkpoints.entries()) {
      expect(scene.edges.map((edge) => routeContainsPoint(edge.route, checkpoint))).toEqual(
        scene.edges.map((_, index) => index === expectedIndex)
      );
    }
    expect([56 - 40, 72 - 56]).toEqual([16, 16]);
    const expectedSharedStubs = [
      { axis: "horizontal" as const, coordinate: 56, start: 256, end: 268 },
      { axis: "horizontal" as const, coordinate: 56, start: 284, end: 296 }
    ];
    for (let left = 0; left < scene.edges.length; left += 1) {
      for (let right = left + 1; right < scene.edges.length; right += 1) {
        expect(sharedCollinearSegments(
          scene.edges[left]!.route,
          scene.edges[right]!.route
        )).toEqual(expectedSharedStubs);
        expect(properPerpendicularCrossings(
          scene.edges[left]!.route,
          scene.edges[right]!.route
        )).toEqual([]);
      }
    }
    expect(routeContainsPoint(scene.edges[1]!.route, { x: 262, y: 56 })).toBe(true);
    expect(routeContainsPoint(scene.edges[1]!.route, { x: 290, y: 56 })).toBe(true);
    expect(getTerminalSegmentLength(scene.edges[0]!)).toBe(40);
    expect(getTerminalSegmentLength(scene.edges[1]!)).toBe(MIN_ARROW_MARKER_LEG);
    expect(getTerminalSegmentLength(scene.edges[2]!)).toBe(MIN_ARROW_MARKER_LEG);

    const nodeBoxes = flattenPositionedItems(scene.root)
      .filter((item): item is PositionedNode => item.kind === "node")
      .map((node) => ({
        itemId: node.id, x: node.x, y: node.y, width: node.width, height: node.height
      }));
    expectNoRouteIntersectionsWithNonEndpointBoxes(scene.edges, nodeBoxes);
    expectRoutesDoNotEnterEndpointBoxes(scene.edges, nodeBoxes);
    expect(collectHeaderBoxes(scene.root)).toEqual([]);
    for (const header of collectHeaderBoxes(scene.root)) {
      for (const edge of scene.edges) {
        expect(routeIntersectsRect(edge.route, header)).toBe(false);
      }
    }
    for (const edge of scene.edges) {
      for (const point of edge.route.points) {
        expect(point.x).toBeGreaterThan(scene.root.x);
        expect(point.x).toBeLessThan(scene.root.x + scene.root.width);
        expect(point.y).toBeGreaterThan(scene.root.y);
        expect(point.y).toBeLessThan(scene.root.y + scene.root.height);
      }
    }
    for (const edgeId of duplicateIds) {
      expect(rendered.provisionalSvg).toContain(`data-edge-id="${edgeId}"`);
    }
    expect((rendered.provisionalSvg.match(/data-edge-id=/g) ?? [])).toHaveLength(3);
    expect((rendered.provisionalSvg.match(
      /marker-end="url\(#scene-marker-arrow-end\)"/g
    ) ?? [])).toHaveLength(3);
    expect(rendered.diagnostics).toEqual([
      expect.objectContaining({
        code: "renderer.scene.journey_map_step_only",
        severity: "info",
        targetId: "J-801"
      })
    ]);
  });
});

describe("journey map Gate 7 duplicate endpoint visual proof", () => {
  it("removes both shared terminal stubs and arrow overdraw with legal separated border endpoints", async () => {
    const bundle = await loadBundle(manifestPath);
    const compiled = compileSource({
      path: duplicateFixturePath,
      text: await readFile(duplicateFixturePath, "utf8")
    }, bundle);
    expect(compiled.diagnostics).toEqual([]);
    expect(compiled.graph).toBeDefined();
    const projected = projectView(compiled.graph!, bundle, "journey_map");
    expect(projected.diagnostics).toEqual([]);
    expect(projected.projection).toBeDefined();
    const view = bundle.views.views.find((candidate) => candidate.id === "journey_map");
    expect(view).toBeDefined();
    const rendered = await renderJourneyMapRoutingArtifacts(
      projected.projection!, compiled.graph!, bundle, view!, { detailId: "detailed" }
    );
    const rerendered = await renderJourneyMapRoutingArtifacts(
      projected.projection!, compiled.graph!, bundle, view!, { detailId: "detailed" }
    );
    const scene = rendered.routingStages.finalPositionedScene;
    expect(scene.root).toMatchObject({ x: 0, y: 0, width: 552, height: 112 });
    expect(scene.edges.map((edge) => edge.route.points)).toEqual([
      [{ x: 256, y: 56 }, { x: 296, y: 56 }],
      [{ x: 256, y: 40 }, { x: 296, y: 40 }],
      [{ x: 256, y: 72 }, { x: 296, y: 72 }]
    ]);
    expect(scene.edges.map((edge) => edge.from.y)).toEqual([56, 40, 72]);
    expect(scene.edges.map((edge) => edge.to.y)).toEqual([56, 40, 72]);
    expect(new Set(scene.edges.map((edge) => `${edge.to.x}:${edge.to.y}`)).size).toBe(3);
    for (let left = 0; left < scene.edges.length; left += 1) {
      for (let right = left + 1; right < scene.edges.length; right += 1) {
        expect(routesIntersect(scene.edges[left]!.route, scene.edges[right]!.route)).toBe(false);
        expect(sharedCollinearSegments(
          scene.edges[left]!.route,
          scene.edges[right]!.route
        )).toEqual([]);
        expect(properPerpendicularCrossings(
          scene.edges[left]!.route,
          scene.edges[right]!.route
        )).toEqual([]);
      }
    }
    for (const edge of scene.edges) {
      expect(getTerminalSegmentLength(edge)).toBeGreaterThanOrEqual(MIN_ARROW_MARKER_LEG);
    }
    const nodeBoxes = flattenPositionedItems(scene.root)
      .filter((item): item is PositionedNode => item.kind === "node")
      .map((node) => ({
        itemId: node.id, x: node.x, y: node.y, width: node.width, height: node.height
      }));
    expectNoRouteIntersectionsWithNonEndpointBoxes(scene.edges, nodeBoxes);
    expectRoutesDoNotEnterEndpointBoxes(scene.edges, nodeBoxes);
    expect(rendered.finalSvg).toBe(rerendered.finalSvg);
    expect(rendered.finalSvg).not.toBe(rendered.provisionalSvg);
    expect((rendered.finalSvg.match(/data-edge-id=/g) ?? [])).toHaveLength(3);
    expect((rendered.finalSvg.match(
      /marker-end="url\(#scene-marker-arrow-end\)"/g
    ) ?? [])).toHaveLength(3);
    expect(rendered.diagnostics.some(isBlockingJourneyDiagnostic)).toBe(false);
  });
});

describe("journey map Gate 7 ordering and primary endpoint visual proof", () => {
  async function renderFixture(fixture: string) {
    const bundle = await loadBundle(manifestPath);
    const compiled = compileSource({
      path: fixture,
      text: await readFile(fixture, "utf8")
    }, bundle);
    expect(compiled.diagnostics).toEqual([]);
    expect(compiled.graph).toBeDefined();
    const projected = projectView(compiled.graph!, bundle, "journey_map");
    expect(projected.diagnostics).toEqual([]);
    expect(projected.projection).toBeDefined();
    const view = bundle.views.views.find((candidate) => candidate.id === "journey_map");
    expect(view).toBeDefined();
    return renderJourneyMapRoutingArtifacts(
      projected.projection!, compiled.graph!, bundle, view!, { detailId: "detailed" }
    );
  }

  it("separates the incoming and outgoing J-501 south stems without a crossing", async () => {
    const rendered = await renderFixture(fixturePath);
    const scene = rendered.routingStages.finalPositionedScene;
    const incoming = scene.edges.find((edge) =>
      edge.from.itemId === "J-503" && edge.to.itemId === "J-501"
    )!;
    const outgoing = scene.edges.find((edge) =>
      edge.from.itemId === "J-501" && edge.to.itemId === "J-502"
    )!;
    expect(incoming.to).toMatchObject({ x: 1492, y: 140 });
    expect(outgoing.from).toMatchObject({ x: 1476, y: 140 });
    expect(incoming.to.x - outgoing.from.x).toBe(16);
    expect(routesIntersect(incoming.route, outgoing.route)).toBe(false);
    expect(sharedCollinearSegments(incoming.route, outgoing.route)).toEqual([]);
    expect(properPerpendicularCrossings(incoming.route, outgoing.route)).toEqual([]);
    expect(getTerminalSegmentLength(incoming)).toBeGreaterThanOrEqual(MIN_ARROW_MARKER_LEG);
    expect(getTerminalSegmentLength(outgoing)).toBeGreaterThanOrEqual(MIN_ARROW_MARKER_LEG);
    expect(rendered.finalSvg).not.toBe(rendered.provisionalSvg);
  });

  it("gives stacked primary branches and joins distinct legal endpoint sides", async () => {
    const rendered = await renderFixture(primaryFixturePath);
    const scene = rendered.routingStages.finalPositionedScene;
    const edge = (from: string, to: string) => scene.edges.find((candidate) =>
      candidate.from.itemId === from && candidate.to.itemId === to
    )!;
    const nearBranch = edge("J-201", "J-202");
    const farBranch = edge("J-201", "J-203");
    const upperJoin = edge("J-203", "J-204");
    const lowerJoin = edge("J-202", "J-204");

    expect(nearBranch.from).toMatchObject({ portId: "J-201__flow_out", x: 1160, y: 116 });
    expect(farBranch.from).toMatchObject({ portId: "J-201__escape_out", x: 1048, y: 204 });
    expect(upperJoin.to).toMatchObject({ portId: "J-204__escape_in", x: 1544, y: 140 });
    expect(lowerJoin.to).toMatchObject({ portId: "J-204__flow_in", x: 1432, y: 116 });
    expect(sharedCollinearSegments(nearBranch.route, farBranch.route)).toEqual([]);
    expect(sharedCollinearSegments(upperJoin.route, lowerJoin.route)).toEqual([]);
    expect(properPerpendicularCrossings(nearBranch.route, farBranch.route)).toEqual([]);
    expect(properPerpendicularCrossings(upperJoin.route, lowerJoin.route)).toEqual([]);
    expect(routesIntersect(upperJoin.route, lowerJoin.route)).toBe(false);
    expect(rendered.routingStages.expansionAttempts).toEqual([]);
    for (const candidate of [nearBranch, farBranch, upperJoin, lowerJoin]) {
      expect(getTerminalSegmentLength(candidate)).toBeGreaterThanOrEqual(MIN_ARROW_MARKER_LEG);
    }
    expect(rendered.finalSvg).not.toBe(rendered.provisionalSvg);
    expect(rendered.diagnostics.some(isBlockingJourneyDiagnostic)).toBe(false);
  });
});

describe("journey map Gate 7 reciprocal topology visual proof", () => {
  it("renders both simple reciprocal SCCs as crossing-free nested arcs", async () => {
    const bundle = await loadBundle(manifestPath);
    const compiled = compileSource({
      path: topologyFixturePath,
      text: await readFile(topologyFixturePath, "utf8")
    }, bundle);
    expect(compiled.diagnostics).toEqual([]);
    expect(compiled.graph).toBeDefined();
    const projected = projectView(compiled.graph!, bundle, "journey_map");
    expect(projected.diagnostics).toEqual([]);
    expect(projected.projection).toBeDefined();
    const view = bundle.views.views.find((candidate) => candidate.id === "journey_map");
    expect(view).toBeDefined();
    const rendered = await renderJourneyMapRoutingArtifacts(
      projected.projection!, compiled.graph!, bundle, view!, { detailId: "detailed" }
    );
    const rerendered = await renderJourneyMapRoutingArtifacts(
      projected.projection!, compiled.graph!, bundle, view!, { detailId: "detailed" }
    );
    const scene = rendered.routingStages.finalPositionedScene;
    const edge = (from: string, to: string) => scene.edges.find((candidate) =>
      candidate.from.itemId === from && candidate.to.itemId === to
    )!;
    const firstForward = edge("J-701", "J-702");
    const firstReturn = edge("J-702", "J-701");
    const secondForward = edge("J-711", "J-712");
    const secondReturn = edge("J-712", "J-711");
    const selfLoop = edge("J-713", "J-713");

    expect(firstForward.route.points).toEqual([
      { x: 444, y: 140 }, { x: 444, y: 158 },
      { x: 676, y: 158 }, { x: 676, y: 140 }
    ]);
    expect(firstReturn.route.points).toEqual([
      { x: 692, y: 140 }, { x: 692, y: 174 },
      { x: 428, y: 174 }, { x: 428, y: 140 }
    ]);
    expect(secondForward.route.points).toEqual([
      { x: 940, y: 140 }, { x: 940, y: 174 },
      { x: 1172, y: 174 }, { x: 1172, y: 156 }
    ]);
    expect(secondReturn.route.points).toEqual([
      { x: 1188, y: 156 }, { x: 1188, y: 190 },
      { x: 924, y: 190 }, { x: 924, y: 140 }
    ]);
    for (const [inner, outer] of [
      [firstForward, firstReturn],
      [secondForward, secondReturn]
    ]) {
      expect(routesIntersect(inner.route, outer.route)).toBe(false);
      expect(sharedCollinearSegments(inner.route, outer.route)).toEqual([]);
      expect(properPerpendicularCrossings(inner.route, outer.route)).toEqual([]);
      expect(getTerminalSegmentLength(inner)).toBeGreaterThanOrEqual(MIN_ARROW_MARKER_LEG);
      expect(getTerminalSegmentLength(outer)).toBeGreaterThanOrEqual(MIN_ARROW_MARKER_LEG);
    }
    expect(selfLoop.route.points).toContainEqual({ x: 1544, y: 80 });
    expect(selfLoop.route.points).toContainEqual({ x: 1290, y: 80 });
    for (const reciprocal of [firstForward, firstReturn, secondForward, secondReturn]) {
      expect(routesIntersect(selfLoop.route, reciprocal.route)).toBe(false);
    }

    const nodeBoxes = flattenPositionedItems(scene.root)
      .filter((item): item is PositionedNode => item.kind === "node")
      .map((node) => ({
        itemId: node.id, x: node.x, y: node.y, width: node.width, height: node.height
      }));
    expectNoRouteIntersectionsWithNonEndpointBoxes(scene.edges, nodeBoxes);
    expectRoutesDoNotEnterEndpointBoxes(scene.edges, nodeBoxes);
    for (const header of collectHeaderBoxes(scene.root)) {
      for (const reciprocal of [firstForward, firstReturn, secondForward, secondReturn, selfLoop]) {
        expect(routeIntersectsRect(reciprocal.route, header)).toBe(false);
      }
    }
    expect(rendered.routingStages.expansionAttempts).toEqual([{
      attempt: 1,
      requests: [{ kind: "stage_bypass_gutter", stageId: "G-700", amount: 32 }]
    }]);
    expect(rendered.finalSvg).toBe(rerendered.finalSvg);
    expect(rendered.finalSvg).not.toBe(rendered.provisionalSvg);
    expect(rendered.diagnostics.some(isBlockingJourneyDiagnostic)).toBe(false);
  });
});

describe("journey map dense remediation stop proof", () => {
  it("records the failed dense acceptance gates without accepting visual evidence", async () => {
    const bundle = await loadBundle(manifestPath);
    const compiled = compileSource({
      path: compressedFixturePath,
      text: await readFile(compressedFixturePath, "utf8")
    }, bundle);
    expect(compiled.diagnostics).toEqual([]);
    expect(compiled.graph).toBeDefined();
    const projected = projectView(compiled.graph!, bundle, "journey_map");
    expect(projected.diagnostics).toEqual([]);
    expect(projected.projection).toBeDefined();
    const view = bundle.views.views.find((candidate) => candidate.id === "journey_map");
    expect(view).toBeDefined();
    const rendered = await renderJourneyMapRoutingArtifacts(
      projected.projection!, compiled.graph!, bundle, view!, { detailId: "detailed" }
    );
    const rerendered = await renderJourneyMapRoutingArtifacts(
      projected.projection!, compiled.graph!, bundle, view!, { detailId: "detailed" }
    );
    const scene = rendered.routingStages.finalPositionedScene;
    expect(scene.edges).toHaveLength(18);
    expect(scene.root).toMatchObject({ width: 2064, height: 400 });
    expect(rendered.routingStages.residualCrossings).toHaveLength(58);
    expect(scene.edges.flatMap((candidate) => candidate.continuityMarks ?? [])).toHaveLength(56);
    expect((rendered.finalSvg.match(/ Q /g) ?? [])).toHaveLength(56);
    expect(rendered.routingStages.expansionAttempts).toHaveLength(2);
    expect(rendered.routingStages.connectorPlans.some((plan) =>
      plan.routeFamily === "early_south_egress"
    )).toBe(false);
    expect(rendered.routingStages.diagnostics.filter((diagnostic) =>
      diagnostic.code === "renderer.routing.journey_map_preferred_terminal_leg_unmet"
    )).toHaveLength(1);
    expect(rendered.routingStages.diagnostics.some((diagnostic) =>
      diagnostic.severity === "error"
    )).toBe(false);
    expect(rendered.routingStages.step3PositionedScene.edges.every((candidate) =>
      !candidate.continuityMarks
    )).toBe(true);
    expect(rendered.diagnostics).toEqual(rendered.routingStages.diagnostics);
    expect(rendered.finalSvg).toBe(rerendered.finalSvg);
    expect(rendered.finalSvg).not.toBe(rendered.provisionalSvg);
  }, 10_000);
});
