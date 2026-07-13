import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import type { PositionedContainer, PositionedNode } from "../src/renderer/staged/contracts.js";
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
    expect(scene.edges).toHaveLength(1);
    const [edge] = scene.edges;
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
    expect(scene.edges).toHaveLength(7);
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
    expect(topologyScene.edges).toHaveLength(3);
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
});
