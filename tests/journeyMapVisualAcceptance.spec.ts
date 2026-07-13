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
});
