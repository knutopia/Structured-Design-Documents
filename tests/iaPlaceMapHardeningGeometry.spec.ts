import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { loadBundle } from "../src/bundle/loadBundle.js";
import type { Bundle, ViewSpec } from "../src/bundle/types.js";
import { compileSource } from "../src/compiler/compileSource.js";
import { projectView } from "../src/projector/projectView.js";
import { buildIaPlaceMapRendererScene } from "../src/renderer/staged/iaPlaceMap.js";
import { auditIaPlaceMapFinalScene, runIaPlaceMapRendererPipeline } from "../src/renderer/staged/iaPlaceMapRouting.js";
import { renderPositionedSceneToPng, renderPositionedSceneToSvg } from "../src/renderer/staged/svgBackend.js";
import { renderSvgToPng } from "../src/renderer/svgArtifacts.js";
import { RendererArtifactError } from "../src/renderer/staged/diagnostics.js";
import { resolveRendererTheme } from "../src/renderer/staged/theme.js";
import { wrappedLabelPreservesText } from "../src/renderer/staged/connectorLabelLayout.js";
import type { Point, PositionedEdgeLabel } from "../src/renderer/staged/contracts.js";

let bundle: Bundle, view: ViewSpec, original: string;
const fixture = "tests/fixtures/render/ia_parallel_navigation_v02.sdd";
const first = '    NAVIGATES_TO P-002 [E-001] {workspace selected} diagrams="DG-001,DG-002"';
beforeAll(async () => {
  bundle = await loadBundle("bundle/v0.2/manifest.yaml");
  view = bundle.views.views.find(view => view.id === "ia_place_map")!;
  original = await readFile(fixture, "utf8");
});

function build(text: string, detailId: string, decorators?: string[]) {
  const compiled = compileSource({ path: fixture, text }, bundle);
  expect(compiled.diagnostics.filter(d => d.severity === "error")).toEqual([]);
  const projected = projectView(compiled.graph!, bundle, view.id);
  return { compiled, scene: buildIaPlaceMapRendererScene(projected.projection!, compiled.graph!, view, { detailId,
    nodeDecoratorMode: { id: decorators?.join(",") || "none", showNodeType: decorators?.includes("type") ?? false,
      showNodeId: decorators?.includes("id") ?? false } }, bundle) };
}

const variants = [
  { name: "three parallels", change: (s: string) => s.replace(first, first + '\n    NAVIGATES_TO P-002 [E-001] {workspace archived} diagrams=DG-001'), count: 5, label: "[Open current workspace] {workspace archived}" },
  { name: "identical duplicates", change: (s: string) => s.replace(first, first + "\n" + first), count: 5, label: "[Open current workspace] {workspace selected}" },
  { name: "same Event with different guards", change: (s: string) => s.replace("P-002 [E-002]", "P-002 [E-001]"), count: 4, label: "[Open current workspace] {invitation valid}" },
  { name: "same-name Events", change: (s: string) => s.replace('"Accept invitation"', '"Open current workspace"'), count: 4, label: "[Open current workspace (E-002)] {invitation valid}" },
  { name: "long label", change: (s: string) => s.replace('Event E-001 "Open current workspace"', 'Event E-001 "Open the currently selected workspace after confirming all permissions and reviewing the invitation history"'), count: 4 },
  { name: "long token", change: (s: string) => s.replace('Event E-001 "Open current workspace"', 'Event E-001 "' + "Workspace".repeat(18) + '"'), count: 4 },
  { name: "self-loop", change: (s: string) => s.replace(first, first + '\n    NAVIGATES_TO P-001 [E-001] {refresh workspace} diagrams=DG-001'), count: 5, label: "[Open current workspace] {refresh workspace}" },
  { name: "multiple incoming and child return", change: (s: string) => s.replace("    route_or_key=/workspace/settings", '    NAVIGATES_TO P-002 [E-001] {settings saved} diagrams=DG-001\n    route_or_key=/workspace/settings'), count: 5, label: "[Open current workspace] {settings saved}" }
];

/** Independent box-to-painted-axis geometry, without calling renderer audits. */
function labelSegmentDistance(box: PositionedEdgeLabel, a: Point, b: Point): number {
  expect([box.x, box.y, box.width, box.height, a.x, a.y, b.x, b.y].every(Number.isFinite)).toBe(true);
  expect(Math.min(Math.abs(a.x - b.x), Math.abs(a.y - b.y))).toBeLessThanOrEqual(0.5);
  const dx = Math.max(box.x - Math.max(a.x, b.x), Math.min(a.x, b.x) - box.x - box.width, 0);
  const dy = Math.max(box.y - Math.max(a.y, b.y), Math.min(a.y, b.y) - box.y - box.height, 0);
  return Math.hypot(dx, dy);
}

describe.each(["compact", "detailed"])("IA hardening final geometry in %s", detailId => {
  it.each(variants)("accepts $name with complete paths and original text", async variant => {
    const { scene } = build(variant.change(original), detailId);
    const result = await runIaPlaceMapRendererPipeline(scene);
    const final = result.positionedScene;
    expect(final.diagnostics.filter(d => d.severity === "error")).toEqual([]);
    expect(auditIaPlaceMapFinalScene(final)).toEqual([]);
    const occurrences = final.root.viewMetadata!.iaPlaceMap!.expectedNavigationOccurrences;
    expect(occurrences).toHaveLength(variant.count);
    expect(new Set(occurrences.map(o => o.sourceEdgeId)).size).toBe(variant.count);
    for (const occurrence of occurrences) {
      const connector = final.edges.find(e => e.id === occurrence.connectorId)!;
      expect(connector).toBeDefined();
      expect(connector.from.itemId).toBe(occurrence.from);
      expect(connector.to.itemId).toBe(occurrence.to);
      if (occurrence.label) expect(wrappedLabelPreservesText(connector.label!.lines, occurrence.label)).toBe(true);
      if (connector.label) {
        const distanceTo = (edge: typeof connector) => Math.min(...edge.route.points.slice(1)
          .map((b, index) => labelSegmentDistance(connector.label!, edge.route.points[index]!, b)));
        expect(distanceTo(connector), `${variant.name}: own annotation distance`).toBeCloseTo(12, 0);
        for (const other of final.edges.filter(edge => edge.id !== connector.id))
          expect(distanceTo(other), `${variant.name}: annotation ${connector.id} to ${other.id}`).toBeGreaterThanOrEqual(23.5);
      }
    }
    if (variant.label) expect(occurrences.map(o => o.label)).toContain(variant.label);
    if (variant.name === "identical duplicates") {
      const duplicates = occurrences.filter(o => o.label === variant.label);
      expect(duplicates).toHaveLength(2);
      expect(final.edges.find(e => e.id === duplicates[0]!.connectorId)!.route)
        .not.toEqual(final.edges.find(e => e.id === duplicates[1]!.connectorId)!.route);
    }
  });

  it.each([[], ["type"], ["id"], ["type", "id"]].map(decorators => ({ decorators })))
    ("preserves geometry with decorators $decorators", async ({ decorators }) => {
    const result = await runIaPlaceMapRendererPipeline(build(original, detailId, decorators).scene);
    expect(result.positionedScene.diagnostics.filter(d => d.severity === "error")).toEqual([]);
    expect(auditIaPlaceMapFinalScene(result.positionedScene)).toEqual([]);
  });
});

it("serializes deterministically and rasterizes the same accepted SVG", async () => {
  const scene = build(original, "detailed").scene;
  const first = await runIaPlaceMapRendererPipeline(scene), second = await runIaPlaceMapRendererPipeline(scene);
  expect(second.positionedScene).toEqual(first.positionedScene);
  const artifact = await renderPositionedSceneToPng(first.positionedScene);
  expect((await renderPositionedSceneToSvg(second.positionedScene)).svg).toBe(artifact.svg);
  expect(artifact.svg).not.toContain("\r");
  const theme = resolveRendererTheme(scene.themeId).theme;
  expect(await renderSvgToPng(artifact.svg, { dpi: theme.dpi, fontFamily: theme.fontFamily,
    pngFontAssetPaths: theme.fontFaces.map(face => face.pngFontAssetPath) })).toEqual(artifact.png);
});

it("independently rejects missing occurrences, text, markers and invalid ports before SVG emission", async () => {
  const result = await runIaPlaceMapRendererPipeline(build(original, "detailed").scene);
  const final = result.positionedScene;
  const id = final.root.viewMetadata!.iaPlaceMap!.expectedNavigationOccurrences[0]!.connectorId;
  for (const change of [
    (s: typeof final) => { s.edges = s.edges.filter(e => e.id !== id); },
    (s: typeof final) => { s.edges.find(e => e.id === id)!.label = undefined; },
    (s: typeof final) => { s.edges.find(e => e.id === id)!.label!.lines = ["lost annotation"]; },
    (s: typeof final) => { s.edges.find(e => e.id === id)!.markers = undefined; },
    (s: typeof final) => { s.edges.find(e => e.id === id)!.to.x += 1000; }
  ]) {
    const corrupted = structuredClone(final);
    change(corrupted);
    expect(auditIaPlaceMapFinalScene(corrupted).some(d => d.severity === "error")).toBe(true);
    await expect(renderPositionedSceneToSvg(corrupted)).rejects.toBeInstanceOf(RendererArtifactError);
  }
});
