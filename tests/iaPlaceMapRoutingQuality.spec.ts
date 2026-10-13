import { readFile, writeFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { loadBundle } from "../src/bundle/loadBundle.js";
import type { Bundle } from "../src/bundle/types.js";
import { compileSource } from "../src/compiler/compileSource.js";
import { projectView } from "../src/projector/projectView.js";
import { buildIaPlaceMapRendererScene } from "../src/renderer/staged/iaPlaceMap.js";
import { runIaPlaceMapRendererPipeline } from "../src/renderer/staged/iaPlaceMapRouting.js";
import type { MeasuredContainer, Point, PositionedContainer, PositionedEdge, PositionedItem, PositionedScene } from "../src/renderer/staged/contracts.js";

import { measureScene } from "../src/renderer/staged/pipeline.js";
import { getRendererTheme } from "../src/renderer/staged/theme.js";

const proofCache = new Map<string, Promise<PositionedScene>>();
const originalAreaTopPadding = new WeakMap<PositionedScene, Map<string, number>>();
let bundle: Bundle;
beforeAll(async () => { proofCache.clear(); bundle = await loadBundle("bundle/v0.2/manifest.yaml"); });
function items(root: PositionedContainer): PositionedItem[] {
  return [root, ...root.children.flatMap(child => child.kind === "container" ? items(child) : [child])];
}
function proof(fixture: string, detailId: string, diagramId?: string): Promise<PositionedScene> {
  const key = JSON.stringify([fixture, detailId, diagramId]);
  let pending = proofCache.get(key);
  if (!pending) {
    pending = computeProof(fixture, detailId, diagramId);
    proofCache.set(key, pending);
  }
  return pending;
}
async function computeProof(fixture: string, detailId: string, diagramId?: string) {
  const path = `tests/fixtures/render/${fixture}.sdd`;
  const compiled = compileSource({ path, text: await readFile(path, "utf8") }, bundle);
  const projected = projectView(compiled.graph!, bundle, "ia_place_map", diagramId ? { diagramId } : undefined);
  const scene = buildIaPlaceMapRendererScene(projected.projection!, compiled.graph!,
    bundle.views.views.find(view => view.id === "ia_place_map")!, { detailId }, bundle);
  const measuredOriginal = measureScene(scene);
  const baselineTopPadding = new Map<string, number>();
  const visitMeasured = (container: MeasuredContainer): void => {
    if (container.role === "area") baselineTopPadding.set(container.id, container.chrome.padding.top);
    for (const child of container.children) if (child.kind === "container") visitMeasured(child);
  };
  visitMeasured(measuredOriginal.root);
  const result = await runIaPlaceMapRendererPipeline(scene);
  originalAreaTopPadding.set(result.positionedScene, baselineTopPadding);
  // Debug candidates never replace canonical evidence or bypass the SVG boundary.
  await writeFile(`/tmp/ia-quality.${fixture}.${detailId}.${diagramId ?? "combined"}.json`, JSON.stringify(result.positionedScene, null, 2));
  expect(result.positionedScene.diagnostics.filter(d => d.severity === "error"), `${fixture}/${detailId}/${diagramId ?? "combined"} final diagnostics`).toEqual([]);
  return result.positionedScene;
}

type Rect = { x: number; y: number; width: number; height: number };
function segments(edge: PositionedEdge) {
  return edge.route.points.slice(1).map((b, index) => ({ a: edge.route.points[index]!, b, index }));
}
// Independent axis-aligned geometry: no production routing/audit helpers.
function separation(a: Rect, b: Rect): number {
  for (const value of [a.x, a.y, a.width, a.height, b.x, b.y, b.width, b.height]) expect(Number.isFinite(value), "finite geometry input").toBe(true);
  return Math.max(b.x - a.x - a.width, a.x - b.x - b.width,
    b.y - a.y - a.height, a.y - b.y - b.height, 0);
}
function segmentBox(a: Point, b: Point): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) };
}
function properCrossing(a: Point, b: Point, c: Point, d: Point): boolean {
  if ((a.y === b.y) === (c.y === d.y)) return false;
  const h = a.y === b.y ? [a, b] : [c, d];
  const v = a.y === b.y ? [c, d] : [a, b];
  return v[0]!.x > Math.min(h[0]!.x, h[1]!.x) + 0.5 && v[0]!.x < Math.max(h[0]!.x, h[1]!.x) - 0.5
    && h[0]!.y > Math.min(v[0]!.y, v[1]!.y) + 0.5 && h[0]!.y < Math.max(v[0]!.y, v[1]!.y) - 0.5;
}
function arrowBox(edge: PositionedEdge, arrowSize: number, strokeWidth: number): Rect | undefined {
  if (edge.markers?.end !== "arrow") return undefined;
  const points = edge.route.points, tip = points.at(-1)!, previous = points.at(-2)!;
  const length = Math.hypot(tip.x - previous.x, tip.y - previous.y);
  expect(length).toBeGreaterThan(0);
  expect(Number.isFinite(length)).toBe(true);
  const dx = (tip.x - previous.x) / length, dy = (tip.y - previous.y) / length;
  const base = { x: tip.x - dx * (arrowSize - 1), y: tip.y - dy * (arrowSize - 1) };
  const corners = [{ x: tip.x + dx, y: tip.y + dy },
    { x: base.x - dy * arrowSize / 2, y: base.y + dx * arrowSize / 2 },
    { x: base.x + dy * arrowSize / 2, y: base.y - dx * arrowSize / 2 }];
  const x = Math.min(...corners.map(p => p.x)) - strokeWidth / 2;
  const y = Math.min(...corners.map(p => p.y)) - strokeWidth / 2;
  return { x, y, width: Math.max(...corners.map(p => p.x)) + strokeWidth / 2 - x,
    height: Math.max(...corners.map(p => p.y)) + strokeWidth / 2 - y };
}

describe.each(["compact", "detailed"])("independent IA routing quality: %s", detail => {
  it.each(["DG-002", "DG-003"])("centers the aligned singleton %s and places its label beside the route", async diagram => {
    const final = await proof("ia_parallel_navigation_v02", detail, diagram);
    expect(final.diagnostics.filter(d => d.severity === "error")).toEqual([]);
    expect(final.edges).toHaveLength(1);
    const edge = final.edges[0]!;
    const index = new Map(items(final.root).map(item => [item.id, item]));
    const from = index.get(edge.from.itemId)!, to = index.get(edge.to.itemId)!;
    expect(edge.route.points).toHaveLength(2);
    expect(Math.abs(edge.from.y - (from.y + from.height / 2))).toBeLessThanOrEqual(0.5);
    expect(Math.abs(edge.to.y - (to.y + to.height / 2))).toBeLessThanOrEqual(0.5);
    const label = edge.label!;
    const distance = Math.max(label.y - edge.from.y, edge.from.y - label.y - label.height, 0);
    expect(distance).toBeCloseTo(12, 1);
    const areas = items(final.root).filter(item => item.kind === "container" && item.role === "area").sort((a, b) => a.x - b.x);
    expect(label.x).toBeGreaterThanOrEqual(areas[0]!.x + areas[0]!.width - 0.5);
    expect(label.x + label.width).toBeLessThanOrEqual(areas[1]!.x + 0.5);
  });

  it.each([undefined, "DG-001"])("preserves the complete parallel inventory and balanced attachments (%s)", async diagram => {
    const final = await proof("ia_parallel_navigation_v02", detail, diagram);
    expect(final.diagnostics.filter(d => d.severity === "error")).toEqual([]);
    expect(final.edges.map(e => `${e.from.itemId}->${e.to.itemId}`).sort()).toEqual([
      "P-001->P-002", "P-001->P-002", "P-002->P-001", "P-002->P-003"
    ]);
    const labels = final.edges.flatMap(edge => edge.label ? [edge.label.lines.join(" ")] : []);
    expect(labels).toContain("[Open current workspace] {workspace selected}");
    expect(labels).toContain("[Accept invitation] {invitation valid}");
    const index = new Map(items(final.root).map(item => [item.id, item]));
    // All ordinary incoming/outgoing reservations on a side form one centered group.
    for (const id of ["P-001", "P-002"]) for (const side of ["east", "west"]) {
      const node = index.get(id)!;
      const offsets = final.edges.flatMap(edge => [edge.from, edge.to]).filter(endpoint =>
        endpoint.itemId === id && Math.abs(endpoint.x - (side === "east" ? node.x + node.width : node.x)) <= 0.5
      ).map(endpoint => endpoint.y).sort((a, b) => a - b);
      if (!offsets.length) continue;
      expect((offsets[0]! + offsets.at(-1)!) / 2, `${id}/${side} port-group center`).toBeCloseTo(node.y + node.height / 2, 1);
    }
  });

  it.each([undefined, "DG-001"])("keeps parallel proof strokes clear of nodes, headers, borders, and arrowheads (%s)", async diagram => {
    const final = await proof("ia_parallel_navigation_v02", detail, diagram);
    const all = items(final.root), failures: string[] = [];
    const theme = getRendererTheme(final.themeId);
    expect(theme.paint.edgeStrokeWidth).toBeGreaterThan(0);
    expect(theme.paint.arrowSize).toBeGreaterThan(0);
    expect(Number.isFinite(theme.paint.edgeStrokeWidth)).toBe(true);
    expect(Number.isFinite(theme.paint.arrowSize)).toBe(true);
    const headers = all.flatMap(item => item.kind === "container" ? item.headerContent.map(block => ({
      id: block.id, x: item.x + block.x, y: item.y + block.y, width: block.width, height: block.height
    })) : []);
    for (const edge of final.edges) for (const segment of segments(edge)) {
      const box = segmentBox(segment.a, segment.b);
      for (const node of all.filter(item => item.kind === "node")) {
        if (node.id === edge.from.itemId && segment.index === 0 || node.id === edge.to.itemId && segment.index === edge.route.points.length - 2) continue;
        const distance = separation(box, node) - theme.paint.edgeStrokeWidth / 2;
        if (distance < 15.5) failures.push(`${edge.id}/${segment.index} node ${node.id}: ${distance}px`);
      }
      for (const header of headers) {
        const distance = separation(box, header) - theme.paint.edgeStrokeWidth / 2;
        if (distance < 15.5) failures.push(`${edge.id}/${segment.index} header ${header.id}: ${distance}px`);
      }
      for (const area of all.filter(item => item.kind === "container" && item.role === "area")) {
        const borders = [{ x: area.x, y: area.y, width: area.width, height: 0 },
          { x: area.x, y: area.y + area.height, width: area.width, height: 0 },
          { x: area.x, y: area.y, width: 0, height: area.height },
          { x: area.x + area.width, y: area.y, width: 0, height: area.height }];
        for (const border of borders) {
          if ((box.height === 0) !== (border.height === 0)) continue; // transverse boundary crossing is legal
          const distance = separation(box, border) - theme.paint.edgeStrokeWidth / 2;
          if (distance < 15.5) failures.push(`${edge.id}/${segment.index} parallel border ${area.id}: ${distance}px`);
        }
      }
      for (const other of final.edges.filter(other => other.id !== edge.id)) {
        const marker = arrowBox(other, theme.paint.arrowSize, theme.paint.edgeStrokeWidth);
        if (marker && separation(box, marker) - theme.paint.edgeStrokeWidth / 2 < 15.5) failures.push(`${edge.id}/${segment.index} arrow ${other.id}: ${separation(box, marker) - theme.paint.edgeStrokeWidth / 2}px`);
      }
    }
    expect(failures).toEqual([]);
  });

  it.each([undefined, "DG-001"])("places full parallel labels in the gutter beside their own route (%s)", async diagram => {
    const final = await proof("ia_parallel_navigation_v02", detail, diagram);
    const areas = items(final.root).filter(item => item.kind === "container" && item.role === "area").sort((a, b) => a.x - b.x);
    const failures: string[] = [];
    for (const edge of final.edges.filter(edge => edge.label)) {
      const label = edge.label!;
      expect(label.x).toBeGreaterThanOrEqual(areas[0]!.x + areas[0]!.width - 0.5);
      expect(label.x + label.width).toBeLessThanOrEqual(areas[1]!.x + 0.5);
      const ownDistance = Math.min(...segments(edge).map(segment => separation(label, segmentBox(segment.a, segment.b))));
      expect(ownDistance, `${edge.id} adjacent label`).toBeCloseTo(12, 1);
      for (const other of final.edges.filter(other => other.id !== edge.id)) {
        const distance = Math.min(...segments(other).map(segment => separation(label, segmentBox(segment.a, segment.b))));
        if (distance < 23.5) failures.push(`${edge.id} label to ${other.id}: ${distance}px`);
      }
    }
    expect(failures).toEqual([]);

  });

  it.each([undefined, "DG-001"])("fits parallel gutter labels without avoidable Area top expansion (%s)", async diagram => {
    const final = await proof("ia_parallel_navigation_v02", detail, diagram);
    const baseline = originalAreaTopPadding.get(final)!;
    expect(baseline.size).toBe(2);
    for (const area of items(final.root).filter((item): item is PositionedContainer => item.kind === "container" && item.role === "area")) {
      expect(baseline.has(area.id)).toBe(true);
      expect(area.chrome.padding.top, `${area.id} top padding must match the original measured scene`).toBeCloseTo(baseline.get(area.id)!, 1);
    }
    for (const revision of final.routingEvidence!.revisions) for (const [owner, demand] of revision.expansion?.padding ?? []) {
      if ([...baseline.keys()].some(id => owner === `${id}\u0000top`)) {
        expect(demand, "legal cross-Area labels must claim gutter capacity before header space").toBe(0);
      }
    }
  });

  it.each([undefined, "DG-001"])("reuses horizontal gutter capacity for disjoint label rows (%s)", async diagram => {
    const final = await proof("ia_parallel_navigation_v02", detail, diagram);
    const labels = final.edges.flatMap(edge => edge.label ? [edge.label] : []).sort((a, b) => a.y - b.y);
    expect(labels).toHaveLength(2);
    expect(labels[0]!.y + labels[0]!.height).toBeLessThanOrEqual(labels[1]!.y + 0.5);
    const maximumWidth = Math.max(...labels.map(label => label.width));
    // Two 24px clear side rails admit the widest label in either disjoint row.
    // Horizontal route tracks do not add widths: their separation is vertical.
    const sufficientGutter = maximumWidth + 2 * 24;
    const areas = items(final.root).filter(item => item.kind === "container" && item.role === "area").sort((a, b) => a.x - b.x);
    const gutter = areas[1]!.x - areas[0]!.x - areas[0]!.width;
    expect(gutter, "disjoint labels must not reserve the sum of their widths").toBeLessThanOrEqual(sufficientGutter + 0.5);
    const trace = final.routingEvidence!;
    expect(trace).toBeDefined();
    const baselineGap = final.root.layout.gap ?? 0;
    const demandLimit = Math.max(0, sufficientGutter - baselineGap);
    for (const revision of trace.revisions) for (const [owner, demand] of revision.expansion?.gaps ?? []) {
      if (owner === `root\u0000${areas[0]!.id}\u0000${areas[1]!.id}`) {
        expect(demand, "absolute gutter demand must derive from reusable row capacity").toBeLessThanOrEqual(demandLimit + 0.5);
      }
    }
  });

  it.each([undefined, "DG-001"])("eliminates avoidable parallel proof crossings and crowded parallel tracks (%s)", async diagram => {
    const final = await proof("ia_parallel_navigation_v02", detail, diagram);
    const failures: string[] = [];
    for (let i = 0; i < final.edges.length; i++) for (const second of final.edges.slice(i + 1)) {
      const first = final.edges[i]!;
      for (const a of segments(first)) for (const b of segments(second)) {
        if (properCrossing(a.a, a.b, b.a, b.b)) failures.push(`${first.id}/${a.index} crosses ${second.id}/${b.index}`);
        if ((a.a.y === a.b.y) !== (b.a.y === b.b.y)) continue;
        const aa = segmentBox(a.a, a.b), bb = segmentBox(b.a, b.b);
        const overlap = aa.height === 0 ? Math.min(aa.x + aa.width, bb.x + bb.width) - Math.max(aa.x, bb.x)
          : Math.min(aa.y + aa.height, bb.y + bb.height) - Math.max(aa.y, bb.y);
        const paintedDistance = separation(aa, bb) - getRendererTheme(final.themeId).paint.edgeStrokeWidth;
        if (overlap > 0.5 && paintedDistance < 15.5) failures.push(`${first.id}/${a.index} parallel ${second.id}/${b.index}: ${paintedDistance}px`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("keeps every BillSage route inside its selected common owner", async () => {
    const final = await proof("billSage_structure", detail);
    expect(final.diagnostics.filter(d => d.severity === "error")).toEqual([]);
    expect(final.edges).toHaveLength(8);
    const area = items(final.root).find(item => item.id === "A-200")!;
    const contained = new Set(items(area as PositionedContainer).map(item => item.id));
    for (const edge of final.edges.filter(edge => contained.has(edge.from.itemId) && contained.has(edge.to.itemId))) {
      for (const point of edge.route.points) {
        expect(point.x).toBeGreaterThanOrEqual(area.x + 16 - 0.5);
        expect(point.x).toBeLessThanOrEqual(area.x + area.width - 16 + 0.5);
        expect(point.y).toBeGreaterThanOrEqual(area.y + 16 - 0.5);
        expect(point.y).toBeLessThanOrEqual(area.y + area.height - 16 + 0.5);
      }
    }
  });
  it("keeps BillSage painted routes clear with only declared source-trunk sharing exempted", async () => {
    const final = await proof("billSage_structure", detail);
    const all = items(final.root), theme = getRendererTheme(final.themeId), failures: string[] = [];
    expect(theme.paint.edgeStrokeWidth).toBeGreaterThan(0);
    const structural = new Set(final.root.viewMetadata!.iaPlaceMap!.expectedStructuralEdges.map(edge => edge.id));
    const declaredSharedSource = (a: PositionedEdge, b: PositionedEdge): boolean => {
      if (!structural.has(a.id) || !structural.has(b.id) || !a.classes.includes("shared_trunk") || !b.classes.includes("shared_trunk") || a.from.itemId !== b.from.itemId) return false;
      const aa = a.route.points[0]!, ab = a.route.points[1]!, ba = b.route.points[0]!, bb = b.route.points[1]!;
      return aa.y === ab.y && ba.y === bb.y && Math.abs(aa.y - ba.y) <= 0.5
        || aa.x === ab.x && ba.x === bb.x && Math.abs(aa.x - ba.x) <= 0.5;
    };
    for (const edge of final.edges) for (const segment of segments(edge)) {
      const box = segmentBox(segment.a, segment.b);
      for (const node of all.filter(item => item.kind === "node")) {
        if (node.id === edge.from.itemId && segment.index === 0 || node.id === edge.to.itemId && segment.index === edge.route.points.length - 2) continue;
        const distance = separation(box, node) - theme.paint.edgeStrokeWidth / 2;
        if (distance < 15.5) failures.push(`${edge.from.itemId}->${edge.to.itemId}/${segment.index} node ${node.id}: ${distance}px`);
      }
      for (const container of all.filter((item): item is PositionedContainer => item.kind === "container")) for (const header of container.headerContent) {
        const distance = separation(box, { x: container.x + header.x, y: container.y + header.y, width: header.width, height: header.height }) - theme.paint.edgeStrokeWidth / 2;
        if (distance < 15.5) failures.push(`${edge.id}/${segment.index} header ${header.id}: ${distance}px`);
      }
      for (const other of final.edges.filter(other => other.id !== edge.id)) {
        if (segment.index === 0 && declaredSharedSource(edge, other)) continue;
        const marker = arrowBox(other, theme.paint.arrowSize, theme.paint.edgeStrokeWidth);
        if (marker) {
          const distance = separation(box, marker) - theme.paint.edgeStrokeWidth / 2;
          if (distance < 15.5) failures.push(`${edge.from.itemId}->${edge.to.itemId}/${segment.index} marker ${other.from.itemId}->${other.to.itemId}: ${distance}px`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("removes avoidable double crossings between BillSage routes", async () => {
    const final = await proof("billSage_structure", detail);
    const failures: string[] = [];
    for (let i = 0; i < final.edges.length; i++) for (const second of final.edges.slice(i + 1)) {
      const first = final.edges[i]!;
      const crossings = segments(first).flatMap(a => segments(second).filter(b => properCrossing(a.a, a.b, b.a, b.b)));
      if (crossings.length > 1) failures.push(`${first.from.itemId}->${first.to.itemId} / ${second.from.itemId}->${second.to.itemId}: ${crossings.length} crossings`);
    }
    expect(failures).toEqual([]);
  });

  it("preserves BillSage structural order and takes the feasible straight Overview-to-Projection route", async () => {
    const final = await proof("billSage_structure", detail);
    const index = new Map(items(final.root).map(item => [item.id, item]));
    expect(items(index.get("A-200") as PositionedContainer).filter(item => item.kind === "node").map(item => item.id))
      .toEqual(["P-210", "P-220", "P-221", "P-222", "P-230"]);
    const overview = index.get("P-210")!, projection = index.get("P-220")!;
    const left = Math.max(overview.x + 16, projection.x + 16);
    const right = Math.min(overview.x + overview.width - 16, projection.x + projection.width - 16);
    expect(right - left, "facing side span admits a shared vertical coordinate").toBeGreaterThan(0);
    const candidateX = Math.min(right, Math.max(left, (overview.x + overview.width / 2 + projection.x + projection.width / 2) / 2));
    const candidate = segmentBox({ x: candidateX, y: overview.y + overview.height }, { x: candidateX, y: projection.y });
    for (const other of items(final.root).filter(item => item.kind === "node" && item.id !== overview.id && item.id !== projection.id)) {
      expect(separation(candidate, other), `straight alternative clearance to ${other.id}`).toBeGreaterThanOrEqual(15.5);
    }
    const edge = final.edges.find(edge => edge.from.itemId === "P-210" && edge.to.itemId === "P-220")!;
    expect(edge.route.points, "feasible direct route must win over a multi-bend arrival").toHaveLength(2);
    expect(edge.from.x).toBeCloseTo(edge.to.x, 1);
    expect(edge.from.x).toBeGreaterThanOrEqual(left - 0.5);
    expect(edge.from.x).toBeLessThanOrEqual(right + 0.5);
    expect(index.get("P-221")!.x).toBeGreaterThan(projection.x);
    expect(index.get("P-222")!.x).toBeCloseTo(index.get("P-221")!.x, 1);
    expect(index.get("P-221")!.y).toBeLessThan(index.get("P-222")!.y);
  });

});
