import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import YAML from "yaml";
import { describe, expect, it } from "vitest";
import { loadBundle } from "../src/bundle/loadBundle.js";
import { compileSource } from "../src/compiler/compileSource.js";
import { projectView } from "../src/projector/projectView.js";
import { buildIaPlaceMapRendererScene } from "../src/renderer/staged/iaPlaceMap.js";
import { auditIaPlaceMapFinalScene, runIaPlaceMapRendererPipeline } from "../src/renderer/staged/iaPlaceMapRouting.js";
import { renderPositionedSceneToSvg } from "../src/renderer/staged/svgBackend.js";
import type { PositionedNode, PositionedContainer } from "../src/renderer/staged/contracts.js";

async function renderLoop(detailId: string, direction: "negative" | "positive" | "omitted", bottom = false) {
  const temporary = await mkdtemp("/tmp/sdd-backward-loop-");
  try {
    await cp("bundle/v0.2", join(temporary, "bundle"), { recursive: true });
    const viewsPath = join(temporary, "bundle/core/views.yaml");
    const views = YAML.parse(await readFile(viewsPath, "utf8"));
    const view = views.views.find((entry: { id: string }) => entry.id === "ia_place_map");
    view.conventions.renderer_defaults.ia_place_map.navigation.routing_preferences.self_loop = {
      traversal: { axis: "x", direction }, side_trials: [
        { side: "north", pair_placement: "nearest_feasible" },
        ...(bottom ? [{ side: "south", pair_placement: "before_other_arrivals" }] : []) ] };
    if (direction === "omitted") delete view.conventions.renderer_defaults.ia_place_map.navigation.routing_preferences.self_loop;
    await writeFile(viewsPath, YAML.stringify(views));
    const bundle = await loadBundle(join(temporary, "bundle/manifest.yaml"));
    const source = (await readFile("tests/fixtures/render/ia_parallel_navigation_v02.sdd", "utf8"))
      .replace('    NAVIGATES_TO P-002 [E-001] {workspace selected} diagrams="DG-001,DG-002"',
        '    NAVIGATES_TO P-002 [E-001] {workspace selected} diagrams="DG-001,DG-002"\n    NAVIGATES_TO P-001 [E-001] {refresh workspace} diagrams=DG-001');
    const compiled = compileSource({ path: "loop.sdd", text: source }, bundle);
    expect(compiled.diagnostics.filter(issue => issue.severity === "error")).toEqual([]);
    const projection = projectView(compiled.graph!, bundle, "ia_place_map").projection!;
    const scene = buildIaPlaceMapRendererScene(projection, compiled.graph!, bundle.views.views.find(entry => entry.id === "ia_place_map")!, { detailId }, bundle);
    const result = await runIaPlaceMapRendererPipeline(scene);
    await writeFile(`/tmp/ia-backward-loop.${detailId}.${direction}${bottom ? ".bottom-trial" : ""}.json`, JSON.stringify(result.positionedScene, null, 2));
    if (!result.positionedScene.diagnostics.some(issue => issue.severity === "error"))
      await writeFile(`/tmp/ia-backward-loop.${detailId}.${direction}${bottom ? ".bottom-trial" : ""}.svg`, (await renderPositionedSceneToSvg(result.positionedScene)).svg);
    return result;
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

describe.each(["compact", "detailed"])("loaded backward loop in %s", detail => {
  it("changes ordered ports through the real loader direction and rejects a corrupted order", async () => {
    const negative = await renderLoop(detail, "negative");
    const positive = await renderLoop(detail, "positive");
    const omitted = await renderLoop(detail, "omitted");
    expect(omitted.positionedScene.iaAcceptancePolicy?.routingPreferences?.self_loop).toBeUndefined();
    const omittedOccurrence = omitted.positionedScene.root.viewMetadata!.iaPlaceMap!.expectedNavigationOccurrences.find(record => record.from === record.to)!;
    const omittedEdge = omitted.positionedScene.edges.find(record => record.id === omittedOccurrence.connectorId)!;
    expect(omittedEdge.route.points.at(-1)!.x - omittedEdge.route.points[0]!.x).toBeGreaterThan(0);
    for (const [result, sign] of [[negative, -1], [positive, 1]] as const) {
      expect(result.positionedScene.diagnostics.filter(issue => issue.severity === "error")).toEqual([]);
      expect(auditIaPlaceMapFinalScene(result.positionedScene)).toEqual([]);
      const occurrence = result.positionedScene.root.viewMetadata!.iaPlaceMap!.expectedNavigationOccurrences.find(record => record.from === record.to)!;
      const edge = result.positionedScene.edges.find(record => record.id === occurrence.connectorId)!;
      expect((edge.route.points.at(-1)!.x - edge.route.points[0]!.x) * sign).toBeGreaterThan(0);
      const corrupt = structuredClone(result.positionedScene);
      const node = (function find(container: PositionedContainer): PositionedNode | undefined {
        for (const child of container.children) {
          if (child.kind === "node" && child.id === occurrence.from) return child;
          if (child.kind === "container") { const found = find(child); if (found) return found; }
        }
      })(corrupt.root)!;
      const sourcePort = node.ports.find(port => port.id === edge.from.portId)!;
      const targetPort = node.ports.find(port => port.id === edge.to.portId)!;
      [sourcePort.x, targetPort.x] = [targetPort.x, sourcePort.x];
      expect(auditIaPlaceMapFinalScene(corrupt).some(issue => issue.code === "renderer.routing.ia_loop_traversal")).toBe(true);
      // A loop pair cannot exempt ordinary arrivals sharing its side from the
      // original balanced allocation or authorize an unwitnessed movable port.
      const shiftedArrival = structuredClone(result.positionedScene);
      const arrivalNode = (function find(container: PositionedContainer): PositionedNode | undefined {
        for (const child of container.children) {
          if (child.kind === "node" && child.id === occurrence.from) return child;
          if (child.kind === "container") { const found = find(child); if (found) return found; }
        }
      })(shiftedArrival.root)!;
      const arrival = shiftedArrival.edges.find(candidate => candidate.from.itemId !== occurrence.from && candidate.to.itemId === occurrence.from)!;
      const arrivalPort = arrivalNode.ports.find(port => port.id === arrival.to.portId)!;
      arrivalPort.side = "north";
      arrivalPort.x = arrivalNode.width - 40;
      arrivalPort.y = 0;
      arrivalPort.offset = arrivalPort.x;
      arrival.to.x = arrivalNode.x + arrivalPort.x;
      arrival.to.y = arrivalNode.y;
      arrival.route.points[arrival.route.points.length - 1] = { x: arrival.to.x, y: arrival.to.y };
      expect(auditIaPlaceMapFinalScene(shiftedArrival).some(issue => issue.code === "renderer.routing.ia_forward_admission"
        && issue.details?.startsWith("missing_forward_witness:"))).toBe(true);
      await expect(renderPositionedSceneToSvg(shiftedArrival)).rejects.toThrow();
    }
  });
  it("assesses the bottom alternative independently under one aggregate allowance", async () => {
    const result = await renderLoop(detail, "negative", true);
    const evidence = result.positionedScene.routingEvidence!;
    expect(evidence.candidates).toBeLessThanOrEqual(4096);
    expect(evidence.repairs).toBeLessThanOrEqual(128);
    expect(evidence.revisions.flatMap(revision => revision.costs ?? []).map(([id]) => id))
      .toEqual(expect.arrayContaining(["independent-loop-north", "independent-loop-south"]));
    expect(result.positionedScene.diagnostics.filter(issue => issue.severity === "error")).toEqual([]);
    expect(auditIaPlaceMapFinalScene(result.positionedScene)).toEqual([]);
  });
});
