import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import type { PositionedScene } from "../src/renderer/staged/contracts.js";
import { renderIaPlaceMapStagedSvg } from "../src/renderer/staged/iaPlaceMap.js";
import { renderJourneyMapStagedSvg } from "../src/renderer/staged/journeyMap.js";
import { renderOutcomeOpportunityMapStagedSvg } from "../src/renderer/staged/outcomeOpportunityMap.js";
import { renderScenarioFlowStagedSvg } from "../src/renderer/staged/scenarioFlow.js";
import { renderServiceBlueprintStagedSvg } from "../src/renderer/staged/serviceBlueprint.js";
import { renderPositionedSceneToSvg } from "../src/renderer/staged/svgBackend.js";
import * as themes from "../src/renderer/staged/theme.js";
import { renderUiContractsStagedSvg } from "../src/renderer/staged/uiContracts.js";
import { buildPositionedSvgFixture } from "./stagedSvgFixtures.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function chromeRects(svg: string, itemId: string): Record<string, number>[] {
  const group = [...svg.matchAll(/<g\b[^>]*data-item-id="([^"]+)"[^>]*>([\s\S]*?)<\/g>/g)]
    .find((match) => match[1] === itemId)?.[2] ?? "";
  return [...group.matchAll(/<rect\b[^>]*\/>/g)].map(([rect]) =>
    Object.fromEntries([...rect.matchAll(/\b(x|y|width|height|rx|ry)="([^"]+)"/g)]
      .map((match) => [match[1]!, Number(match[2])]))
  );
}

function expectInsideRootStroke(svg: string, scene: PositionedScene, strokeWidth: number): void {
  const rect = chromeRects(svg, scene.root.id)[0]!;
  expect(rect).toBeDefined();
  const half = strokeWidth / 2;
  // Check painted extents, independently of the backend's rectangle construction.
  expect(rect.x! - half).toBeCloseTo(scene.root.x, 3);
  expect(rect.y! - half).toBeCloseTo(scene.root.y, 3);
  expect(rect.x! + rect.width! + half).toBeCloseTo(scene.root.x + scene.root.width, 3);
  expect(rect.y! + rect.height! + half).toBeCloseTo(scene.root.y + scene.root.height, 3);
  expect(svg).toContain(`width="${scene.root.width}" height="${scene.root.height}" viewBox="${scene.root.x} ${scene.root.y} ${scene.root.width} ${scene.root.height}"`);
}

describe("staged root inside strokes", () => {
  it("contains the proof-case stroke without changing the viewport, nested outlines, or scene", async () => {
    const scene = buildPositionedSvgFixture();
    const before = structuredClone(scene);
    const { svg, diagnostics } = await renderPositionedSceneToSvg(scene);

    expectInsideRootStroke(svg, scene, themes.getRendererTheme(scene.themeId).paint.strokeWidth);
    const child = scene.root.children[0]!;
    expect(chromeRects(svg, child.id)[0]).toMatchObject({
      x: child.x, y: child.y, width: child.width, height: child.height
    });
    expect(svg).toContain('<rect class="scene-node__chrome" x="48" y="68" width="160" height="66" rx="14" ry="14"/>');
    expect(scene).toEqual(before);
    expect(diagnostics).toEqual(before.diagnostics);
  });

  it("uses the scene root identity even with a renamed, offset root and nested root primitive", async () => {
    const scene = buildPositionedSvgFixture();
    scene.root.id = "outer-frame";
    scene.root.primitive = "cluster";
    scene.root.x = -12;
    scene.root.y = 30;
    const child = scene.root.children[0]!;
    if (child.kind !== "container") throw new Error("Expected a container fixture.");
    child.id = "root";
    child.primitive = "root";
    const { svg } = await renderPositionedSceneToSvg(scene);

    expectInsideRootStroke(svg, scene, themes.getRendererTheme(scene.themeId).paint.strokeWidth);
    expect(chromeRects(svg, child.id)[0]).toMatchObject({
      x: child.x, y: child.y, width: child.width, height: child.height, rx: 18, ry: 18
    });
  });

  it.each([0, 0.5, 18])("uses the theme stroke width and keeps radius %s nonnegative", async (radius) => {
    const scene = buildPositionedSvgFixture();
    const theme = structuredClone(themes.getRendererTheme(scene.themeId));
    theme.paint.strokeWidth = 4;
    theme.paint.cornerRadii.container.root = radius;
    const mock = vi.spyOn(themes, "resolveRendererTheme").mockReturnValue({ theme, diagnostics: [] });
    try {
      const { svg } = await renderPositionedSceneToSvg(scene);
      expectInsideRootStroke(svg, scene, theme.paint.strokeWidth);
      expect(chromeRects(svg, scene.root.id)[0]).toMatchObject({ rx: Math.max(0, radius - 2), ry: Math.max(0, radius - 2) });
      expect(svg).toContain("stroke-width: 4;");
    } finally {
      mock.mockRestore();
    }
  });

  it("insets root header-band chrome while leaving nested header bands centered", async () => {
    const scene = buildPositionedSvgFixture();
    scene.root.chrome.headerBandHeight = 28;
    const before = structuredClone(scene);
    const { svg } = await renderPositionedSceneToSvg(scene);
    expect(chromeRects(svg, scene.root.id)[1]).toEqual({
      x: 0.75, y: 0.75, width: 558.5, height: 26.5, rx: 13.25, ry: 13.25
    });
    const child = scene.root.children[0]!;
    expect(chromeRects(svg, child.id)[1]).toMatchObject({
      x: child.x, y: child.y, width: child.width, height: 28, rx: 14, ry: 14
    });
    expect(scene).toEqual(before);
  });

  it.each([[1, 20], [20, 1.5]])("omits collapsed root chrome at %s by %s with a warning", async (width, height) => {
    const scene = buildPositionedSvgFixture();
    scene.root.width = width;
    scene.root.height = height;
    const { svg, diagnostics } = await renderPositionedSceneToSvg(scene);
    expect(chromeRects(svg, scene.root.id)).toEqual([]);
    expect(diagnostics).toContainEqual(expect.objectContaining({
      code: "renderer.backend.root_chrome_collapsed", phase: "backend", severity: "warn",
      targetId: scene.root.id, details: "scene-container__chrome"
    }));
    expect(svg).not.toMatch(/(?:width|height|rx|ry)="-/);
  });

  it("omits only a collapsed header band and preserves invalid-root diagnostics", async () => {
    const scene = buildPositionedSvgFixture();
    scene.root.chrome.headerBandHeight = 1;
    const headerResult = await renderPositionedSceneToSvg(scene);
    expectInsideRootStroke(headerResult.svg, scene, 1.5);
    expect(chromeRects(headerResult.svg, scene.root.id)).toHaveLength(1);
    expect(headerResult.diagnostics).toContainEqual(expect.objectContaining({
      code: "renderer.backend.root_chrome_collapsed", details: "scene-container__header-band"
    }));
    scene.root.width = 0;
    const invalidResult = await renderPositionedSceneToSvg(scene);
    expect(invalidResult.diagnostics).toContainEqual(expect.objectContaining({
      code: "renderer.backend.invalid_root_bounds"
    }));
    expect(invalidResult.svg).toContain('width="1" height="280" viewBox="0 0 1 280"');
    expect(chromeRects(invalidResult.svg, scene.root.id)).toEqual([]);
  });

  const diagramCases = [
    { viewId: "ia_place_map", source: "bundle/v0.1/examples/outcome_to_ia_trace.sdd", render: renderIaPlaceMapStagedSvg },
    { viewId: "ui_contracts", source: "bundle/v0.1/examples/place_viewstate_transition.sdd", render: renderUiContractsStagedSvg },
    { viewId: "scenario_flow", source: "bundle/v0.1/examples/scenario_branching.sdd", render: renderScenarioFlowStagedSvg },
    { viewId: "service_blueprint", source: "bundle/v0.1/examples/service_blueprint_slice.sdd", render: renderServiceBlueprintStagedSvg },
    { viewId: "outcome_opportunity_map", source: "bundle/v0.1/examples/outcome_to_ia_trace.sdd", render: renderOutcomeOpportunityMapStagedSvg },
    { viewId: "journey_map", source: "tests/fixtures/render/journey_map_staged_primary.sdd", render: undefined }
  ];

  it.each(diagramCases)("keeps the $viewId outline inside its exported bounds", async ({ viewId, source, render }) => {
    const bundle = await loadBundle(path.join(repoRoot, "bundle/v0.1/manifest.yaml"));
    const sourcePath = path.join(repoRoot, source);
    const compiled = compileSource({ path: sourcePath, text: await readFile(sourcePath, "utf8") }, bundle);
    expect(compiled.graph).toBeDefined();
    const projected = projectView(compiled.graph!, bundle, viewId);
    expect(projected.projection).toBeDefined();
    const view = bundle.views.views.find((candidate) => candidate.id === viewId)!;
    const settings = { detailId: "compact" };
    const result = render
      ? await render(projected.projection!, compiled.graph!, view, settings)
      : await renderJourneyMapStagedSvg(projected.projection!, compiled.graph!, bundle, view, settings);
    expectInsideRootStroke(result.svg, result.positionedScene, themes.getRendererTheme(result.positionedScene.themeId).paint.strokeWidth);
    expect(result.diagnostics.filter((diagnostic) => diagnostic.phase === "backend")).toEqual([]);
  });
});
