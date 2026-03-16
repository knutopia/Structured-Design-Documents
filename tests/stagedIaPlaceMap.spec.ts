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
import type { PositionedContainer, PositionedItem } from "../src/renderer/staged/contracts.js";
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
      "P-700__branch",
      "A-200",
      "A-500"
    ]);

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
    expect(rendered.svg).toContain('marker-end="url(#scene-marker-arrow)"');
    expect(rendered.positionedScene.edges).toHaveLength(1);
    expect(rendered.positionedScene.edges[0]).toEqual(expect.objectContaining({
      from: expect.objectContaining({
        itemId: "P-001",
        portId: "south"
      }),
      to: expect.objectContaining({
        itemId: "P-002",
        portId: "north"
      })
    }));
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
      from: expect.objectContaining({
        itemId: "P-010",
        portId: "south"
      }),
      to: expect.objectContaining({
        itemId: "P-011",
        portId: "north"
      })
    }));
  });
});
