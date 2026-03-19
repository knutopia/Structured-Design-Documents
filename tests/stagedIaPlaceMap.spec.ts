import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import {
  buildIaPlaceMapRendererScene,
  renderIaPlaceMapStagedSvg
} from "../src/renderer/staged/iaPlaceMap.js";
import type { PositionedContainer, PositionedEdge, PositionedItem } from "../src/renderer/staged/contracts.js";
import {
  expectRendererStageSnapshot,
  expectRendererStageTextSnapshot
} from "./rendererStageSnapshotHarness.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

function findPositionedItem(root: PositionedContainer, id: string): PositionedItem {
  const queue: PositionedItem[] = [...root.children];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    if (current.id === id) {
      return current;
    }
    if (current.kind === "container") {
      queue.push(...current.children);
    }
  }

  throw new Error(`Could not find positioned item "${id}".`);
}

function getTerminalSegmentLength(edge: PositionedEdge): number {
  const points = edge.route.points;
  const end = points[points.length - 1];
  const beforeEnd = points[points.length - 2];
  if (!end || !beforeEnd) {
    throw new Error(`Edge "${edge.id}" is missing route points.`);
  }

  return Math.hypot(end.x - beforeEnd.x, end.y - beforeEnd.y);
}

function getTerminalSegment(edge: PositionedEdge): { dx: number; dy: number; length: number } {
  const points = edge.route.points;
  const end = points[points.length - 1];
  const beforeEnd = points[points.length - 2];
  if (!end || !beforeEnd) {
    throw new Error(`Edge "${edge.id}" is missing route points.`);
  }

  const dx = end.x - beforeEnd.x;
  const dy = end.y - beforeEnd.y;
  return {
    dx,
    dy,
    length: Math.hypot(dx, dy)
  };
}

function expectDirectVerticalRoute(edge: PositionedEdge): void {
  expect(edge.route.points).toHaveLength(2);
  expect(getTerminalSegment(edge)).toEqual(expect.objectContaining({
    dx: 0,
    length: expect.any(Number)
  }));
  expect(getTerminalSegmentLength(edge)).toBeGreaterThanOrEqual(20);
}

function expectSharedTrunkRoute(edge: PositionedEdge): void {
  expect(edge.route.points).toHaveLength(3);
  expect(edge.route.points[0]?.x).toBe(edge.route.points[1]?.x);
  expect(edge.route.points[1]?.y).toBe(edge.route.points[2]?.y);
  expect(getTerminalSegment(edge)).toEqual(expect.objectContaining({
    dy: 0,
    length: expect.any(Number)
  }));
  expect(getTerminalSegmentLength(edge)).toBeGreaterThanOrEqual(20);
}

async function loadInput(filePath: string): Promise<{ path: string; text: string }> {
  return {
    path: filePath,
    text: await readFile(filePath, "utf8")
  };
}

async function buildIaArtifacts(examplePath: string, profileId: string) {
  const bundle = await loadBundle(manifestPath);
  const view = bundle.views.views.find((candidate) => candidate.id === "ia_place_map");
  if (!view) {
    throw new Error("Could not resolve the ia_place_map view.");
  }

  const input = await loadInput(examplePath);
  const compiled = compileSource(input, bundle);
  if (!compiled.graph) {
    throw new Error(`Could not compile ${examplePath}.`);
  }

  const projected = projectView(compiled.graph, bundle, "ia_place_map");
  if (!projected.projection) {
    throw new Error(`Could not project ${examplePath} to ia_place_map.`);
  }

  const rendererScene = buildIaPlaceMapRendererScene(projected.projection, compiled.graph, view, profileId);
  const rendered = await renderIaPlaceMapStagedSvg(projected.projection, compiled.graph, view, profileId);

  return {
    rendererScene,
    rendered
  };
}

describe("staged ia_place_map", () => {
  it("matches committed staged snapshots for the mixed top-level IA source-order fixture", async () => {
    const fixturePath = path.join(repoRoot, "tests/fixtures/render/source_order_ia.sdd");
    const { rendererScene, rendered } = await buildIaArtifacts(fixturePath, "simple");

    expect(rendered.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(rendered.positionedScene.root.children.map((child) => child.id)).toEqual([
      "P-700__group",
      "A-200",
      "A-500"
    ]);
    expect(rendered.svg).not.toContain('class="scene-port');

    await expectRendererStageSnapshot("ia-place-map.source-order.renderer-scene.json", rendererScene);
    await expectRendererStageSnapshot("ia-place-map.source-order.measured-scene.json", rendered.measuredScene);
    await expectRendererStageSnapshot("ia-place-map.source-order.positioned-scene.json", rendered.positionedScene);
    await expectRendererStageTextSnapshot("ia-place-map.source-order.svg", rendered.svg);
  });

  it("renders outcome_to_ia_trace through the staged SVG path with area headers and navigation arrows", async () => {
    const examplePath = path.join(repoRoot, "bundle/v0.1/examples/outcome_to_ia_trace.sdd");
    const { rendered } = await buildIaArtifacts(examplePath, "recommended");

    expect(rendered.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(rendered.svg).toContain("Checkout Area");
    expect(rendered.svg).toContain("/checkout/billing");
    expect(rendered.svg).toContain("auth");
    expect(rendered.svg).toContain('marker-end="url(#scene-marker-arrow-end)"');
    expect(rendered.svg).not.toContain('class="scene-port');
    expect(rendered.positionedScene.edges).toHaveLength(1);
    expect(rendered.positionedScene.edges[0]).toEqual(expect.objectContaining({
      classes: expect.arrayContaining(["ia_local_structure", "follower_edge", "merged_navigation", "shared_trunk"]),
      from: expect.objectContaining({
        itemId: "P-001",
        portId: "south_chain"
      }),
      to: expect.objectContaining({
        itemId: "P-002",
        portId: "west"
      })
    }));
    expectSharedTrunkRoute(rendered.positionedScene.edges[0]!);
  });

  it("applies simple-profile suppression while still indenting implicit top-level place sequences", async () => {
    const examplePath = path.join(repoRoot, "bundle/v0.1/examples/place_viewstate_transition.sdd");
    const { rendered } = await buildIaArtifacts(examplePath, "simple");

    expect(rendered.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(rendered.svg).not.toContain("/billing");
    expect(rendered.svg).not.toContain("auth");
    expect(rendered.svg).not.toContain("entry_points:");
    expect(rendered.svg).toContain("primary_nav: true");
    expect(rendered.positionedScene.root.children).toHaveLength(1);

    const billing = findPositionedItem(rendered.positionedScene.root, "P-010");
    const confirmation = findPositionedItem(rendered.positionedScene.root, "P-011");
    if (billing.kind !== "node" || confirmation.kind !== "node") {
      throw new Error("Expected staged ia_place_map nodes for Billing and Confirmation.");
    }

    expect(confirmation.x).toBeGreaterThan(billing.x);
    expect(confirmation.y).toBeGreaterThan(billing.y);
    expect(rendered.positionedScene.edges[0]).toEqual(expect.objectContaining({
      classes: expect.arrayContaining(["ia_local_structure", "follower_edge", "merged_navigation", "shared_trunk"]),
      from: expect.objectContaining({
        itemId: "P-010",
        portId: "south_chain"
      }),
      to: expect.objectContaining({
        itemId: "P-011",
        portId: "west"
      })
    }));
    expectSharedTrunkRoute(rendered.positionedScene.edges[0]!);
  });

  it("renders only forward local-structure connectors for recursive contain chains", async () => {
    const fixturePath = path.join(repoRoot, "tests/fixtures/render/recursive_chain_ia.sdd");
    const { rendererScene, rendered } = await buildIaArtifacts(fixturePath, "simple");

    expect(rendered.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(rendered.positionedScene.edges).toHaveLength(2);

    expect(rendered.positionedScene.edges.map((edge) => edge.id).sort()).toEqual([
      "P-800__nav__P-801",
      "P-801__nav__P-802"
    ]);
    expect(rendered.positionedScene.edges.every((edge) => edge.classes.includes("contains_edge"))).toBe(true);
    expect(rendered.positionedScene.edges.every((edge) => edge.classes.includes("direct_vertical"))).toBe(true);
    expect(rendered.positionedScene.edges.every((edge) => edge.to.portId === "north_chain")).toBe(true);
    rendered.positionedScene.edges.forEach((edge) => expectDirectVerticalRoute(edge));

    await expectRendererStageSnapshot("ia-place-map.recursive-chain.renderer-scene.json", rendererScene);
    await expectRendererStageSnapshot("ia-place-map.recursive-chain.measured-scene.json", rendered.measuredScene);
    await expectRendererStageSnapshot("ia-place-map.recursive-chain.positioned-scene.json", rendered.positionedScene);
    await expectRendererStageTextSnapshot("ia-place-map.recursive-chain.svg", rendered.svg);
  });

  it("matches the reference-style hub and follower geometry for billSage_structure", async () => {
    const examplePath = path.join(repoRoot, "real_world_exploration/billSage_structure.sdd");
    const { rendererScene, rendered } = await buildIaArtifacts(examplePath, "recommended");

    expect(rendered.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);

    const dashboard = findPositionedItem(rendered.positionedScene.root, "P-100");
    const reportView = findPositionedItem(rendered.positionedScene.root, "P-110");
    const overview = findPositionedItem(rendered.positionedScene.root, "P-210");
    const projection = findPositionedItem(rendered.positionedScene.root, "P-220");
    const feeSchedule = findPositionedItem(rendered.positionedScene.root, "P-221");
    const funding = findPositionedItem(rendered.positionedScene.root, "P-222");
    const createProjection = findPositionedItem(rendered.positionedScene.root, "P-230");

    if (
      dashboard.kind !== "node"
      || reportView.kind !== "node"
      || overview.kind !== "node"
      || projection.kind !== "node"
      || feeSchedule.kind !== "node"
      || funding.kind !== "node"
      || createProjection.kind !== "node"
    ) {
      throw new Error("Expected billSage fixture items to resolve to staged place nodes.");
    }

    expect(reportView.x).toBe(dashboard.x);
    expect(projection.x).toBeGreaterThan(overview.x);
    expect(createProjection.x).toBe(projection.x);
    expect(feeSchedule.x).toBeGreaterThan(projection.x);
    expect(funding.x).toBe(feeSchedule.x);
    expect(feeSchedule.y).toBeGreaterThan(projection.y);
    expect(funding.y).toBeGreaterThan(feeSchedule.y);
    expect(createProjection.y).toBeGreaterThan(funding.y);

    expect(rendered.positionedScene.edges.map((edge) => edge.id)).toEqual([
      "P-100__nav__P-110",
      "P-220__nav__P-221",
      "P-220__nav__P-222",
      "P-210__nav__P-220",
      "P-210__nav__P-230"
    ]);
    expect(rendered.positionedScene.edges.some((edge) => edge.id === "P-221__nav__P-220")).toBe(false);
    expect(rendered.positionedScene.edges.some((edge) => edge.id === "P-222__nav__P-220")).toBe(false);
    expect(rendered.positionedScene.edges.some((edge) => edge.id === "P-230__nav__P-220")).toBe(false);

    const directVertical = rendered.positionedScene.edges.find((edge) => edge.id === "P-100__nav__P-110");
    if (!directVertical) {
      throw new Error("Expected the direct Dashboard -> Report View connector.");
    }
    expectDirectVerticalRoute(directVertical);

    rendered.positionedScene.edges
      .filter((edge) => edge.id !== "P-100__nav__P-110")
      .forEach((edge) => expectSharedTrunkRoute(edge));

    await expectRendererStageSnapshot("ia-place-map.billSage-structure.renderer-scene.json", rendererScene);
    await expectRendererStageSnapshot("ia-place-map.billSage-structure.measured-scene.json", rendered.measuredScene);
    await expectRendererStageSnapshot("ia-place-map.billSage-structure.positioned-scene.json", rendered.positionedScene);
    await expectRendererStageTextSnapshot("ia-place-map.billSage-structure.svg", rendered.svg);
  });
});
