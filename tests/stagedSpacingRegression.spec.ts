import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { compileSource, loadBundle, type Bundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import type { MeasuredContainer, PositionedContainer, PositionedItem, PositionedScene } from "../src/renderer/staged/contracts.js";
import { renderScenarioFlowStagedSvg } from "../src/renderer/staged/scenarioFlow.js";
import { renderServiceBlueprintStagedSvg } from "../src/renderer/staged/serviceBlueprint.js";
import { positionJourneyMapMeasuredSceneBeforeRouting, renderJourneyMapStagedSvg } from "../src/renderer/staged/journeyMap.js";
import { positionMeasuredSceneBeforeRouting } from "../src/renderer/staged/macroLayout.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let bundle: Bundle;
let scenarioSource: string;
let blueprintSource: string;
let journeySource: string;
beforeAll(async () => {
  [bundle, scenarioSource, blueprintSource, journeySource] = await Promise.all([
    loadBundle(path.join(repoRoot, "bundle/v0.1/manifest.yaml")),
    readFile(path.join(repoRoot, "docs/sdd_app_planning/sdd_for_sdd.sdd"), "utf8"),
    readFile(path.join(repoRoot, "bundle/v0.1/examples/service_blueprint_slice.sdd"), "utf8"),
    readFile(path.join(repoRoot, "bundle/v0.1/examples/three_branch_journey.sdd"), "utf8")
  ]);
});

function context(text: string, viewId: string) {
  const compiled = compileSource({ path: "spacing-proof.sdd", text }, bundle);
  expect(compiled.diagnostics).toEqual([]);
  const graph = compiled.graph!;
  const projected = projectView(graph, bundle, viewId);
  expect(projected.diagnostics).toEqual([]);
  return { graph, projection: projected.projection!, view: structuredClone(bundle.views.views.find(view => view.id === viewId)!) };
}

function flatten(item: PositionedItem): PositionedItem[] {
  return [item, ...(item.kind === "container" ? item.children.flatMap(flatten) : [])];
}

function geometry(scene: PositionedScene) {
  return flatten(scene.root).filter(item => item.kind === "node").map(({ id, x, y, width, height }) => ({ id, x, y, width, height }));
}

function expectBounds(scene: PositionedScene): void {
  const { root } = scene;
  expect(scene.diagnostics.filter(diagnostic => diagnostic.severity === "error")).toEqual([]);
  for (const item of flatten(root)) {
    expect(item.y).toBeGreaterThanOrEqual(root.y);
    expect(item.y + item.height).toBeLessThanOrEqual(root.y + root.height);
  }
  for (const edge of scene.edges) {
    for (const point of edge.route.points) {
      expect(point.y).toBeGreaterThanOrEqual(root.y);
      expect(point.y).toBeLessThanOrEqual(root.y + root.height);
    }
    if (edge.label) {
      expect(edge.label.y).toBeGreaterThanOrEqual(root.y);
      expect(edge.label.y + edge.label.height).toBeLessThanOrEqual(root.y + root.height);
    }
  }
  expect(root.height - Math.max(...root.children.map(child => child.y + child.height))).toBe(root.chrome.padding.bottom);
}

function scenarioCells(scene: PositionedScene, laneId: string): PositionedContainer[] {
  return scene.root.children.filter((child): child is PositionedContainer => child.kind === "container"
    && child.viewMetadata?.scenarioFlow?.kind === "cell" && child.viewMetadata.scenarioFlow.laneId === laneId);
}

function parkedPolicies(count: number): string {
  return blueprintSource + "\n" + Array.from({ length: count }, (_, index) => `Policy PL-${900 + index} "Parked policy ${index + 1}"\nEND\n`).join("\n");
}

describe("spacing regression proof cases", () => {
  it.each(["compact", "detailed"])("trims the sdd_for_sdd Scenario Flow to occupied lane rows (%s)", async detailId => {
    const c = context(scenarioSource, "scenario_flow");
    const result = await renderScenarioFlowStagedSvg(c.projection, c.graph, c.view, { detailId });
    expect(result.positionedScene.root).toMatchObject({ width: 1508, height: 880 });
    expect(geometry(result.positionedScene)).toHaveLength(15);
    const stepCells = scenarioCells(result.positionedScene, "step");
    const placeCells = scenarioCells(result.positionedScene, "place");
    expect(new Set(stepCells.map(cell => cell.y)).size).toBe(6); // includes the internal component separator
    expect(new Set(placeCells.map(cell => cell.y)).size).toBe(1);
    expect(new Set(stepCells.map(cell => cell.resolvedSlotHeight))).toEqual(new Set([53]));
    expect(new Set(placeCells.map(cell => cell.resolvedSlotHeight))).toEqual(new Set([48]));
    expect(placeCells[0]!.height).toBe(242);
    expectBounds(result.positionedScene);

    c.view.conventions.renderer_defaults!.scenario_flow_layout!.trailing_track_policy = "preserve";
    const preserved = await renderScenarioFlowStagedSvg(c.projection, c.graph, c.view, { detailId });
    expect(new Set(scenarioCells(preserved.positionedScene, "place").map(cell => cell.y)).size).toBe(6);
    expect(preserved.positionedScene.root.height).toBeGreaterThan(result.positionedScene.root.height);
    expect(geometry(result.positionedScene)).toEqual(geometry(preserved.positionedScene));
    expect(result.middleLayer).toEqual(preserved.middleLayer);
    c.view.conventions.renderer_defaults!.scenario_flow_layout!.trailing_track_policy = "trim";
    expect((await renderScenarioFlowStagedSvg(c.projection, c.graph, c.view, { detailId })).svg).toBe(result.svg);
  });

  it("preserves leading/internal logical rows, stable cell IDs, and one tier for a shown empty lane", async () => {
    const c = context(`SDD-TEXT 0.1
Step J-100 "Decision"
  PRECEDES J-101 "First"
  PRECEDES J-102 "Second"
END
Step J-101 "First"
END
Step J-102 "Second"
END
Step J-103 "Disconnected"
  REALIZED_BY P-100 "Last row place"
END
Place P-100 "Last row place"
END
`, "scenario_flow");
    c.view.conventions.renderer_defaults!.scenario_flow_layout!.empty_lane_policy = "show";
    const result = await renderScenarioFlowStagedSvg(c.projection, c.graph, c.view, { detailId: "compact" });
    const places = scenarioCells(result.positionedScene, "place");
    expect(new Set(places.map(cell => cell.y)).size).toBe(4); // leading 0, 1 and internal separator 2
    const occupied = places.find(cell => cell.children.some(node => node.id === "P-100"))!;
    expect(occupied.id).toContain("component:2__track:0");
    expect(result.middleLayer.placements.find(node => node.nodeId === "P-100")).toMatchObject({ rowOrder: 3 });
    const empty = scenarioCells(result.positionedScene, "view_state");
    expect(new Set(empty.map(cell => cell.y)).size).toBe(1);
    expect(empty.every(cell => cell.children.length === 0 && cell.height === 68)).toBe(true);
    expectBounds(result.positionedScene);
  });

  it.each([{ count: 0, height: 608 }, { count: 4, height: 788 }, { count: 10, height: 1148 }])(
    "grows only the occupied Service Blueprint lane for $count parked policies", async ({ count, height }) => {
      const c = context(parkedPolicies(count), "service_blueprint");
      const result = await renderServiceBlueprintStagedSvg(c.projection, c.graph, c.view, { detailId: "compact" });
      const before = await positionMeasuredSceneBeforeRouting(result.measuredScene);
      expect(before.root.height).toBe(height);
      const cells = before.root.children as PositionedContainer[];
      expect(new Set(cells.map(cell => cell.resolvedSlotHeight))).toEqual(new Set([48]));
      const policyCells = cells.filter(cell => cell.viewMetadata?.serviceBlueprint?.kind === "cell"
        && cell.viewMetadata.serviceBlueprint.laneId.endsWith(":policy"));
      expect(cells.filter(cell => !policyCells.includes(cell)).every(cell => cell.height === 72)).toBe(true);
      if (count > 1) {
        const stack = policyCells.find(cell => cell.children.length === count)!;
        expect(stack.children.slice(1).every((child, index) => child.y - stack.children[index]!.y === 60)).toBe(true);
        const single = policyCells.find(cell => cell.children.length === 1)!;
        expect(single.children[0]!.y + single.children[0]!.height / 2).toBe(single.y + single.height / 2);
      }
      expectBounds(result.positionedScene);
    }
  );

  it("consumes both bundle tier scope and alignment at runtime, including the ungrouped lane", async () => {
    const c = context(parkedPolicies(4) + '\nProcess PR-999 "Ungrouped process with a deliberately long title"\nEND\n', "service_blueprint");
    const initial = await renderServiceBlueprintStagedSvg(c.projection, c.graph, c.view, { detailId: "compact" });
    const diagramCells = initial.measuredScene.root.children as MeasuredContainer[];
    expect(new Set(diagramCells.map(cell => cell.resolvedSlotHeight))).toEqual(new Set([53]));
    expect(diagramCells.some(cell => cell.viewMetadata?.serviceBlueprint?.kind === "cell"
      && cell.viewMetadata.serviceBlueprint.laneId.endsWith(":ungrouped"))).toBe(true);

    c.view.conventions.renderer_defaults!.cell_sizing!.stack_alignment = "start";
    const started = await renderServiceBlueprintStagedSvg(c.projection, c.graph, c.view, { detailId: "compact" });
    expect(started.measuredScene.root.height).toBe(initial.measuredScene.root.height);
    const startedBefore = await positionMeasuredSceneBeforeRouting(started.measuredScene);
    expect((startedBefore.root.children as PositionedContainer[]).every(cell => cell.children.length === 0
      || cell.children[0]!.y === cell.y + cell.chrome.padding.top)).toBe(true);
    expect(geometry(started.positionedScene)).not.toEqual(geometry(initial.positionedScene));

    c.view.conventions.renderer_defaults!.cell_sizing!.node_tier_scope = "lane";
    const scoped = await renderServiceBlueprintStagedSvg(c.projection, c.graph, c.view, { detailId: "compact" });
    expect(scoped.measuredScene.root.height).toBeLessThan(initial.measuredScene.root.height);
    expect(new Set((scoped.measuredScene.root.children as MeasuredContainer[]).map(cell => cell.resolvedSlotHeight))).toEqual(new Set([48, 53]));
    expect(geometry(scoped.positionedScene).map(({ id, width, height }) => ({ id, width, height })))
      .toEqual(geometry(initial.positionedScene).map(({ id, width, height }) => ({ id, width, height })));
  });

  it.each([{ branches: 1, raw: 368, height: 368 }, { branches: 3, raw: 544, height: 368 }, { branches: 8, raw: 984, height: 788 }])(
    "refits Journey Map bounds after aligning $branches root branches without changing Stage geometry", async ({ branches, raw, height }) => {
      const source = journeySource + '\nStep J-900 "Root decision"\n'
        + Array.from({ length: branches }, (_, index) => `  PRECEDES J-${901 + index} "Root branch ${index + 1}"`).join("\n") + "\nEND\n"
        + Array.from({ length: branches }, (_, index) => `Step J-${901 + index} "Root branch ${index + 1}"\nEND\n`).join("\n");
      const c = context(source, "journey_map");
      const result = await renderJourneyMapStagedSvg(c.projection, c.graph, bundle, c.view, { detailId: "compact" });
      const unaligned = await positionMeasuredSceneBeforeRouting(result.measuredScene);
      const aligned = await positionJourneyMapMeasuredSceneBeforeRouting(result.measuredScene);
      expect(unaligned.root.height).toBe(raw);
      expect(aligned.root.height).toBe(height);
      expect(aligned.root.width).toBe(unaligned.root.width);
      expect(aligned.root.children.filter(item => item.kind === "container")).toEqual(unaligned.root.children.filter(item => item.kind === "container"));
      expect(geometry(aligned).filter(node => node.id.startsWith("J-9")).map(node => node.y)).toEqual([92, ...Array.from({ length: branches }, (_, index) => 92 + index * 88)]);
      expect(result.positionedScene.root.height).toBe(height);
      expectBounds(result.positionedScene);
      expect((await renderJourneyMapStagedSvg(c.projection, c.graph, bundle, c.view, { detailId: "compact" })).svg).toBe(result.svg);
    }
  );
});
