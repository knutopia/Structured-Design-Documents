import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { loadBundle } from "../src/bundle/loadBundle.js";
import type { Bundle } from "../src/bundle/types.js";
import { compileSource } from "../src/compiler/compileSource.js";
import { projectView } from "../src/projector/projectView.js";
import { buildIaPlaceMapRendererScene } from "../src/renderer/staged/iaPlaceMap.js";
import { runIaPlaceMapRendererPipeline, auditIaPlaceMapFinalScene } from "../src/renderer/staged/iaPlaceMapRouting.js";
import { renderPositionedSceneToSvg } from "../src/renderer/staged/svgBackend.js";
import type { PositionedContainer, PositionedItem, PositionedScene } from "../src/renderer/staged/contracts.js";

let bundle: Bundle, original: string;
const cache = new Map<string, Promise<PositionedScene>>();
beforeAll(async () => {
  bundle = await loadBundle("bundle/v0.2/manifest.yaml");
  original = await readFile("tests/fixtures/render/ia_parallel_navigation_v02.sdd", "utf8");
  cache.clear();
});
function items(root: PositionedContainer): PositionedItem[] {
  return [root, ...root.children.flatMap(item => item.kind === "container" ? items(item) : [item])];
}
function render(text: string, detailId: string): Promise<PositionedScene> {
  const key = JSON.stringify([text, detailId]);
  if (!cache.has(key)) cache.set(key, (async () => {
    const compiled = compileSource({ path: "/tmp/ia-independent-variant.sdd", text }, bundle);
    expect(compiled.diagnostics.filter(d => d.severity === "error")).toEqual([]);
    const view = bundle.views.views.find(view => view.id === "ia_place_map")!;
    const projection = projectView(compiled.graph!, bundle, view.id).projection!;
    const final = (await runIaPlaceMapRendererPipeline(buildIaPlaceMapRendererScene(
      projection, compiled.graph!, view, { detailId }, bundle))).positionedScene;
    expect(final.diagnostics.filter(d => d.severity === "error")).toEqual([]);
    await renderPositionedSceneToSvg(final);
    return final;
  })());
  return cache.get(key)!;
}
function rectDistance(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  expect([a.x, a.y, a.width, a.height, b.x, b.y, b.width, b.height].every(Number.isFinite)).toBe(true);
  return Math.max(b.x - a.x - a.width, a.x - b.x - b.width, b.y - a.y - a.height, a.y - b.y - b.height, 0);
}

const nested = `SDD-TEXT 0.2
Area A-010 "Nested ownership"
  CONTAINS P-010
  + Place P-010 "Parent"
    CONTAINS P-011
    NAVIGATES_TO P-011
    + Place P-011 "Child"
      CONTAINS P-012
      NAVIGATES_TO P-012
      + Place P-012 "Grandchild"
        route_or_key=/nested/grandchild
      END
    END
  END
END
`;

describe.each(["compact", "detailed"])("independent IA metamorphic routing: %s", detail => {
  it("preserves geometry when semantic IDs are renamed", async () => {
    const replacements = new Map([["A-001", "A-881"], ["A-002", "A-882"], ["P-001", "P-771"], ["P-002", "P-772"], ["P-003", "P-773"], ["E-001", "E-661"], ["E-002", "E-662"]]);
    const changed = original.replace(/\b(?:A|P|E)-\d+\b/g, id => replacements.get(id) ?? id);
    const base = await render(original, detail), renamed = await render(changed, detail);
    const index = new Map(items(renamed.root).map(item => [item.id, item]));
    for (const node of items(base.root).filter(item => replacements.has(item.id))) {
      const other = index.get(replacements.get(node.id)!)!;
      expect([other.x, other.y, other.width, other.height]).toEqual([node.x, node.y, node.width, node.height]);
    }
    for (const edge of base.edges) {
      const others = renamed.edges.filter(other => other.from.itemId === replacements.get(edge.from.itemId)
        && other.to.itemId === replacements.get(edge.to.itemId) && other.label?.lines.join(" ") === edge.label?.lines.join(" "));
      expect(others).toHaveLength(1);
      expect(others[0]!.route.points).toEqual(edge.route.points);
    }
  });

  it("preserves relative geometry and ownership under global translation", async () => {
    const base = await render(original, detail), shifted = structuredClone(base);
    const dx = 137.25, dy = 83.5;
    for (const item of items(shifted.root)) { item.x += dx; item.y += dy; }
    for (const edge of shifted.edges) {
      edge.from.x += dx; edge.from.y += dy; edge.to.x += dx; edge.to.y += dy;
      for (const point of edge.route.points) { point.x += dx; point.y += dy; }
      if (edge.label) { edge.label.x += dx; edge.label.y += dy; }
      for (const mark of edge.continuityMarks ?? []) { mark.point.x += dx; mark.point.y += dy; }
    }
    for (const decoration of shifted.decorations) {
      if (decoration.kind === "line") { decoration.from.x += dx; decoration.from.y += dy; decoration.to.x += dx; decoration.to.y += dy; }
      else { decoration.x += dx; decoration.y += dy; }
    }
    expect(auditIaPlaceMapFinalScene(shifted)).toEqual([]);
    const svg = await renderPositionedSceneToSvg(shifted);
    expect(svg.svg).toContain(`viewBox="${shifted.root.x} ${shifted.root.y} ${shifted.root.width} ${shifted.root.height}"`);
    for (const [i, edge] of shifted.edges.entries()) for (const [j, point] of edge.route.points.entries()) {
      expect(point.x - dx).toBeCloseTo(base.edges[i]!.route.points[j]!.x, 4);
      expect(point.y - dy).toBeCloseTo(base.edges[i]!.route.points[j]!.y, 4);
    }
  });

  it("keeps reciprocal annotations separate and readable", async () => {
    const text = original.replace('    NAVIGATES_TO P-001 diagrams=DG-001', '    NAVIGATES_TO P-001 [E-001] {leave workspace} diagrams=DG-001');
    const final = await render(text, detail);
    expect(final.edges).toHaveLength(4);
    const labels = final.edges.flatMap(edge => edge.label ? [{ ...edge.label, text: edge.label.lines.join(" ") }] : []);
    expect(labels.map(label => label.text)).toContain("[Open current workspace] {leave workspace}");
    expect(labels).toHaveLength(3);
    for (let i = 0; i < labels.length; i++) for (const other of labels.slice(i + 1)) {
      expect(rectDistance(labels[i]!, other), `${labels[i]!.text} / ${other.text}`).toBeGreaterThanOrEqual(7.5);
    }
    for (const edge of final.edges.filter(edge => edge.label)) for (const other of final.edges.filter(other => other.id !== edge.id)) {
      const distance = Math.min(...other.route.points.slice(1).map((b, i) => {
        const a = other.route.points[i]!;
        return rectDistance(edge.label!, { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) });
      }));
      expect(distance, `${edge.id} label to ${other.id}`).toBeGreaterThanOrEqual(23.5);
    }
  });

  it("keeps nested Place hierarchy and routes inside their selected Area", async () => {
    const final = await render(nested, detail);
    const index = new Map(items(final.root).map(item => [item.id, item]));
    const area = index.get("A-010")!;
    expect(items(area as PositionedContainer).filter(item => item.kind === "node").map(item => item.id)).toEqual(["P-010", "P-011", "P-012"]);
    expect(index.get("P-011")!.y).toBeGreaterThan(index.get("P-010")!.y + index.get("P-010")!.height);
    expect(index.get("P-012")!.y).toBeGreaterThan(index.get("P-011")!.y + index.get("P-011")!.height);
    expect(final.edges).toHaveLength(2);
    for (const edge of final.edges) for (const point of edge.route.points) {
      expect(point.x).toBeGreaterThanOrEqual(area.x + 16 - 0.5);
      expect(point.x).toBeLessThanOrEqual(area.x + area.width - 16 + 0.5);
      expect(point.y).toBeGreaterThanOrEqual(area.y + 16 - 0.5);
      expect(point.y).toBeLessThanOrEqual(area.y + area.height - 16 + 0.5);
    }
  });
});
