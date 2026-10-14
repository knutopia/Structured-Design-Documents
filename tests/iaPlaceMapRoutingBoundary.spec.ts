import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { loadBundle } from "../src/bundle/loadBundle.js";
import type { Bundle } from "../src/bundle/types.js";
import { compileSource } from "../src/compiler/compileSource.js";
import { projectView } from "../src/projector/projectView.js";
import { buildIaPlaceMapRendererScene } from "../src/renderer/staged/iaPlaceMap.js";
import { runIaPlaceMapRendererPipeline, auditIaPlaceMapFinalScene } from "../src/renderer/staged/iaPlaceMapRouting.js";
import { renderPositionedSceneToSvg } from "../src/renderer/staged/svgBackend.js";
import { RendererArtifactError } from "../src/renderer/staged/diagnostics.js";
import type { PositionedContainer, PositionedItem, PositionedScene, PositionedEdge } from "../src/renderer/staged/contracts.js";
import { getPreviewBackend } from "../src/renderer/previewBackends.js";
import { renderSourcePreview } from "../src/renderer/previewWorkflow.js";

const sourcePath = "tests/fixtures/render/ia_parallel_navigation_v02.sdd";
let bundle: Bundle, text: string, accepted: PositionedScene;
function flatten(root: PositionedContainer): PositionedItem[] {
  return [root, ...root.children.flatMap(item => item.kind === "container" ? flatten(item) : [item])];
}
function navigation(scene: PositionedScene): PositionedEdge { return scene.edges.find(edge => edge.label)!; }
function detour(edge: PositionedEdge, x: number, y: number) {
  const start = edge.route.points[0]!, end = edge.route.points.at(-1)!;
  edge.route.points = [start, { x, y: start.y }, { x, y }, { x: end.x - 24, y }, { x: end.x - 24, y: end.y }, end];
}
beforeAll(async () => {
  bundle = await loadBundle("bundle/v0.2/manifest.yaml");
  text = await readFile(sourcePath, "utf8");
  const graph = compileSource({ path: sourcePath, text }, bundle).graph!;
  const view = bundle.views.views.find(view => view.id === "ia_place_map")!;
  const result = await runIaPlaceMapRendererPipeline(buildIaPlaceMapRendererScene(
    projectView(graph, bundle, view.id).projection!, graph, view, { detailId: "compact" }, bundle));
  accepted = result.positionedScene;
  expect(accepted.diagnostics.filter(d => d.severity === "error")).toEqual([]);
  await renderPositionedSceneToSvg(accepted);
});

const corruptions: Array<{ name: string; finding: RegExp; change: (scene: PositionedScene) => void }> = [
  { name: "lost prepared loaded policy", finding: /policy/i, change: scene => { delete scene.root.viewMetadata!.iaPlaceMap; } },
  { name: "internal owner escape", finding: /bounds|scope/i, change: scene => {
    const edge = scene.edges.find(edge => edge.from.itemId === "P-002" && edge.to.itemId === "P-003")!;
    const owner = flatten(scene.root).find(item => item.id === "A-002")!;
    detour(edge, owner.x - 24, owner.y + owner.height + 24);
  } },
  { name: "nonattachment node stand-off below 16px", finding: /clearance|intersect/i, change: scene => {
    const edge = navigation(scene), node = flatten(scene.root).find(item => item.id === "P-003")!;
    detour(edge, node.x - 8, node.y + node.height / 2);
  } },
  { name: "header stand-off below 16px", finding: /clearance|header|intersect/i, change: scene => {
    const edge = navigation(scene), owner = flatten(scene.root).find(item => item.id === "A-001") as PositionedContainer;
    const header = owner.headerContent[0]!;
    detour(edge, owner.x + header.x + header.width / 2, owner.y + header.y + header.height + 8);
  } },
  { name: "label on its own route", finding: /label/i, change: scene => {
    const edge = navigation(scene), label = edge.label!;
    const horizontal = edge.route.points.slice(1).map((b, i) => [edge.route.points[i]!, b] as const).find(([a, b]) => a.y === b.y)!;
    label.x = (horizontal[0].x + horizontal[1].x - label.width) / 2;
    label.y = horizontal[0].y - label.height / 2;
  } },
  { name: "label within 24px of competing route", finding: /label/i, change: scene => {
    const edge = navigation(scene), other = scene.edges.find(candidate => candidate.id !== edge.id && candidate.label)!;
    const label = edge.label!, a = other.route.points[0]!, b = other.route.points[1]!;
    label.x = (a.x + b.x - label.width) / 2;
    label.y = a.y - label.height - 8;
  } },
  { name: "unrelated painted arrow stand-off below 16px", finding: /marker|clearance|intersect/i, change: scene => {
    const edge = navigation(scene), other = scene.edges.find(candidate => candidate.id !== edge.id && candidate.label)!;
    const tip = other.route.points.at(-1)!;
    detour(edge, tip.x - 16, tip.y + 8);
  } }
];

describe("IA final SVG geometry boundary", () => {
  it.each(corruptions)("withholds $name at SVG and force public boundaries", async ({ change, finding }) => {
    const corrupted = structuredClone(accepted);
    change(corrupted);
    const audit = auditIaPlaceMapFinalScene(corrupted);
    expect(audit.some(d => d.severity === "error" && finding.test(d.message)), audit).toBe(true);
    await expect(renderPositionedSceneToSvg(corrupted)).rejects.toBeInstanceOf(RendererArtifactError);
    const backend = getPreviewBackend("staged_ia_place_map_preview");
    // Exercise the actual SVG boundary through public force handling, using the
    // corrupt final geometry rather than injecting a made-up diagnostic result.
    const stub = vi.spyOn(backend, "render").mockImplementation(async () => {
      const artifact = await renderPositionedSceneToSvg(corrupted);
      return { format: "svg", text: artifact.svg, diagnostics: artifact.diagnostics };
    });
    try {
      for (const diagramId of [undefined, "DG-001"]) {
        const result = await renderSourcePreview({ path: sourcePath, text }, bundle, {
          viewId: "ia_place_map", diagramId, format: "svg", profileId: "simple", detailId: "compact", force: true
        });
        expect(result.artifact).toBeUndefined();
        expect(result.diagnostics.some(d => d.severity === "error" && finding.test(d.message))).toBe(true);
      }
    } finally { stub.mockRestore(); }
  });

  it("records one aggregate route budget through expansion and allocates ports against reflowed nodes", () => {
    const trace = accepted.routingEvidence!;
    expect(trace).toBeDefined();
    expect(trace.candidates).toBeGreaterThan(0);
    expect(trace.candidates).toBeLessThanOrEqual(4096);
    expect(trace.repairs).toBeGreaterThanOrEqual(0);
    expect(trace.repairs).toBeLessThanOrEqual(128);
    const remaining = trace.revisions.filter((revision: { remainingCandidates?: number }) => revision.remainingCandidates !== undefined);
    for (let i = 0; i < remaining.length; i++) {
      expect(remaining[i]!.remainingCandidates!).toBeGreaterThanOrEqual(0);
      expect(remaining[i]!.remainingRepairs!).toBeGreaterThanOrEqual(0);
      if (i) {
        expect(remaining[i]!.remainingCandidates!).toBeLessThanOrEqual(remaining[i - 1]!.remainingCandidates!);
        expect(remaining[i]!.remainingRepairs!).toBeLessThanOrEqual(remaining[i - 1]!.remainingRepairs!);
      }
    }
    expect(trace.revisions.some((revision: { expansion?: unknown }) => revision.expansion)).toBe(true);
    const index = new Map(flatten(accepted.root).map(item => [item.id, item]));
    const portTrials = trace.revisions.flatMap(revision => revision.ports ?? []);
    expect(portTrials.length).toBeGreaterThan(0);
    for (const trial of portTrials) for (const group of trial.groups) {
      const node = index.get(group.nodeId)!;
      expect(group.offsets).toHaveLength(group.requestIds.length);
      expect(group.offsets.length).toBeGreaterThan(0);
      expect(group.offsets.every(Number.isFinite)).toBe(true);
      expect(group.reservedOffsets.every(Number.isFinite)).toBe(true);
      expect(Number.isFinite(group.displacementFromCenter)).toBe(true);
      const length = group.side === "east" || group.side === "west" ? node.height : node.width;
      const offsets = [...group.offsets].sort((a, b) => a - b);
      expect(group.displacementFromCenter).toBeCloseTo((offsets[0]! + offsets.at(-1)!) / 2 - length / 2, 1);
    }
    for (const edge of accepted.edges) for (const endpoint of [edge.from, edge.to]) {
      const node = index.get(endpoint.itemId)!;
      const port = node.ports.find(port => port.id === endpoint.portId)!;
      expect(port, `${edge.id}/${endpoint.itemId}`).toBeDefined();
      expect(endpoint.x).toBeCloseTo(node.x + port.x, 1);
      expect(endpoint.y).toBeCloseTo(node.y + port.y, 1);
    }
  });
});
