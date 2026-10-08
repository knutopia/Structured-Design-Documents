import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { compileSource, loadBundle, validateGraph } from "../src/index.js";
import { projectDiagram } from "../src/projector/projectView.js";
import { renderSourcePreview } from "../src/renderer/previewWorkflow.js";
import { renderScenarioFlowStagedSvg } from "../src/renderer/staged/scenarioFlow.js";
import * as core from "../src/renderer/staged/routingCore/index.js";
import { independentParallelConflicts } from "./routingHardeningOracle.js";
import {
  collectEdgeLabelBoxes, collectHeaderBoxes, flattenPositionedItems, getItemRect,
  expectLabelsDoNotOverlapBoxes, expectLabelsDoNotOverlapEachOther,
  expectLabelsDoNotOverlapHeaders, expectRoutesDoNotCrossLabels
} from "./stagedVisualHarness.js";

const fixturePath = "tests/fixtures/render/scenario_overlap_reconvergence.sdd";
const evidenceDirectory = process.env.SDD_SCENARIO_OVERLAP_EVIDENCE_DIR;

async function fixtureContext() {
  const bundle = await loadBundle("bundle/v0.2/manifest.yaml");
  const input = { path: fixturePath, text: await readFile(fixturePath, "utf8") };
  const compiled = compileSource(input, bundle);
  expect(compiled.diagnostics.filter(diagnostic => diagnostic.severity === "error")).toEqual([]);
  if (!compiled.graph) throw new Error("Could not compile the overlap regression fixture.");
  const graph = compiled.graph;
  expect(validateGraph(graph, bundle, "simple").diagnostics.filter(diagnostic => diagnostic.severity === "error")).toEqual([]);
  const projected = projectDiagram(graph, bundle, "DG-001");
  expect(projected.diagnostics.filter(diagnostic => diagnostic.severity === "error")).toEqual([]);
  if (!projected.projection) throw new Error("Could not project DG-001.");
  const view = bundle.views.views.find(candidate => candidate.id === projected.projection!.view_id);
  if (!view) throw new Error("Could not resolve the scenario view.");
  return { bundle, input, graph, projection: projected.projection, view };
}

afterEach(() => vi.restoreAllMocks());

describe("scenario_flow reconverging overlap recovery", () => {
  let context: Awaited<ReturnType<typeof fixtureContext>>;
  beforeAll(async () => { context = await fixtureContext(); });

  for (const detailId of ["compact", "detailed"]) {
    for (const mode of ["none", "type", "id", "type,id"] as const) {
      it(`validates emitted geometry and deterministic previews: ${detailId} / ${mode}`, async () => {
        const spy = vi.spyOn(core, "runRoutingLifecycle");
        const rendered = await renderScenarioFlowStagedSvg(context.projection, context.graph, context.view, {
          detailId,
          nodeDecoratorMode: { id: mode, showNodeType: mode.includes("type"), showNodeId: mode.includes("id") }
        });
        expect(spy).toHaveBeenCalled();
        expect(rendered.diagnostics.filter(diagnostic => diagnostic.severity === "error")).toEqual([]);

        const revision = rendered.routingStages.labelLayoutTrace?.selectedRevision ?? 0;
        const initial = spy.mock.calls[revision]![0];
        const resolution = spy.mock.results[revision]!.value as core.FinalRoutingResult;
        expect(resolution.status).toBe("resolved");
        if (resolution.status !== "resolved") throw new Error(resolution.reason);
        // The proof needs geometric recovery; it must not silently pass because a
        // fixture or preparation change removed the original conflict.
        expect(core.validateFinalRouteSet(initial).some(violation =>
          violation.kind === "collinear_overlap" || violation.kind === "track_separation"
        )).toBe(true);
        expect(resolution.trace.expansionPasses).toBe(0);
        expect(resolution.context.bounds).toEqual(initial.bounds);
        expect(resolution.context.boxes).toEqual(initial.boxes);
        expect(resolution.context.blockers).toEqual(initial.blockers);
        const originalById = new Map(initial.connectors.map(connector => [connector.id, connector]));
        const emittedById = new Map(rendered.positionedScene.edges.map(edge => [edge.id, edge]));
        expect([...emittedById.keys()].sort()).toEqual([...originalById.keys()].sort());
        const emittedConnectors = resolution.context.connectors.map(connector => {
          const original = originalById.get(connector.id)!;
          expect(connector.source).toEqual(original.source);
          expect(connector.target).toEqual(original.target);
          return { ...connector, route: emittedById.get(connector.id)!.route };
        });
        expect(core.validateFinalRouteSet({ ...resolution.context, connectors: emittedConnectors })).toEqual([]);
        expect(independentParallelConflicts(emittedConnectors)).toBe(0);

        const scene = rendered.positionedScene;
        const downwardBranch = scene.edges.find(edge => edge.from.itemId === "S-002" && edge.to.itemId === "S-004")!;
        // Rebuilding for label capacity must preserve the simplest valid south-to-west route.
        // Check the emitted geometry rather than a prepared candidate or a particular offset.
        expect(downwardBranch.from.portId).toBe("flow_out_south");
        expect(downwardBranch.route.points).toEqual([
          { x: downwardBranch.from.x, y: downwardBranch.from.y },
          { x: downwardBranch.from.x, y: downwardBranch.to.y },
          { x: downwardBranch.to.x, y: downwardBranch.to.y }
        ]);
        expect(scene.edges.filter(edge => edge.label).map(edge => edge.id)).toEqual(
          rendered.measuredScene.edges.filter(edge => edge.label).map(edge => edge.id)
        );
        for (const edge of scene.edges.filter(edge => edge.label)) {
          const label = edge.label!;
          const associated = edge.route.points.slice(1).some((end, index) => {
            const start = edge.route.points[index]!;
            const horizontal = start.y === end.y;
            const axis = horizontal ? "x" : "y", size = horizontal ? "width" : "height";
            const length = Math.abs(end[axis] - start[axis]);
            const overlap = Math.min(label[axis] + label[size], Math.max(start[axis], end[axis]))
              - Math.max(label[axis], Math.min(start[axis], end[axis]));
            const dx = Math.max(Math.min(start.x, end.x) - label.x - label.width, label.x - Math.max(start.x, end.x), 0);
            const dy = Math.max(Math.min(start.y, end.y) - label.y - label.height, label.y - Math.max(start.y, end.y), 0);
            return length > 0.5 && overlap >= Math.min(24, label[size], length) - 0.5 && Math.hypot(dx, dy) <= 12.5;
          });
          expect(associated, `${edge.id} own-segment association`).toBe(true);
        }
        const nodes = flattenPositionedItems(scene.root).filter(item => item.kind === "node");
        for (const edge of scene.edges.filter(edge => edge.label && (
          (edge.from.itemId === "S-003" && edge.to.itemId === "S-006")
          || (edge.from.itemId === "S-004" && edge.to.itemId === "S-005"))
        )) {
          const endpoints = nodes.filter(node => node.id === edge.from.itemId || node.id === edge.to.itemId);
          expect(edge.label!.y).toBeGreaterThanOrEqual(Math.min(...endpoints.map(node => node.y)));
          expect(edge.label!.y + edge.label!.height).toBeLessThanOrEqual(Math.max(...endpoints.map(node => node.y + node.height)));
        }
        expect(rendered.diagnostics.filter(d => /edge_label_(unresolved|fallback|omitted)$/.test(d.code))).toEqual([]);
        const labels = collectEdgeLabelBoxes(scene.edges);
        const nodeBoxes = flattenPositionedItems(scene.root).filter(item => item.kind === "node")
          .map(item => ({ itemId: item.id, ...getItemRect(item) }));
        expectLabelsDoNotOverlapEachOther(labels);
        expectLabelsDoNotOverlapBoxes(labels, nodeBoxes);
        expectLabelsDoNotOverlapHeaders(labels, collectHeaderBoxes(scene.root));
        expectRoutesDoNotCrossLabels(scene.edges, labels);
        for (const label of labels) {
          expect(label.x).toBeGreaterThanOrEqual(scene.root.x);
          expect(label.y).toBeGreaterThanOrEqual(scene.root.y);
          expect(label.x + label.width).toBeLessThanOrEqual(scene.root.x + scene.root.width);
          expect(label.y + label.height).toBeLessThanOrEqual(scene.root.y + scene.root.height);
        }

        const options = {
          viewId: context.view.id, diagramId: "DG-001", format: "svg" as const,
          profileId: "simple", detailId, nodeDecoratorModeId: mode
        };
        const preview = await renderSourcePreview(context.input, context.bundle, options);
        const repeated = await renderSourcePreview(context.input, context.bundle, options);
        for (const result of [preview, repeated]) {
          expect(result.diagnostics.filter(diagnostic => diagnostic.severity === "error")).toEqual([]);
          expect(result.previewCapability.backendId).toBe("staged_scenario_flow_preview");
          expect(result.diagramId).toBe("DG-001");
          expect(result.diagramName).toBe("Probe");
          expect(result.artifact?.format).toBe("svg");
        }
        if (preview.artifact?.format !== "svg" || repeated.artifact?.format !== "svg") {
          throw new Error("Missing overlap proof SVG preview.");
        }
        expect(preview.artifact.text).toEqual(repeated.artifact.text);
        expect(preview.artifact.text).not.toContain("\r");
        expect(preview.artifact.text).toContain("<title>Probe</title>");
        if (evidenceDirectory) {
          await mkdir(evidenceDirectory, { recursive: true });
          const prefix = path.join(evidenceDirectory, `${detailId}.${mode.replace(",", "-")}`);
          await writeFile(`${prefix}.svg`, preview.artifact.text);
          await writeFile(`${prefix}.json`, `${JSON.stringify({
            trace: resolution.trace,
            labelLayoutTrace: rendered.routingStages.labelLayoutTrace,
            gutters: rendered.routingStages.globalGutterState,
            initial,
            final: resolution.context,
            positionedScene: rendered.positionedScene,
            diagnostics: rendered.diagnostics
          }, (_key, value) => value instanceof Map ? [...value.entries()] : value instanceof Set ? [...value] : value, 2)}\n`);
        }
      });
    }
  }

  it("rasterizes the repaired detailed type,id SVG into a PNG preview", async () => {
    const result = await renderSourcePreview(context.input, context.bundle, {
      viewId: context.view.id, diagramId: "DG-001", format: "png",
      profileId: "simple", detailId: "detailed", nodeDecoratorModeId: "type,id"
    });
    expect(result.diagnostics.filter(diagnostic => diagnostic.severity === "error")).toEqual([]);
    expect(result.previewCapability.backendId).toBe("staged_scenario_flow_preview");
    expect(result.diagramId).toBe("DG-001");
    expect(result.diagramName).toBe("Probe");
    expect(result.artifact?.format).toBe("png");
    if (result.artifact?.format !== "png") throw new Error("Missing overlap proof PNG preview.");
    expect(Array.from(result.artifact.bytes.slice(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(result.artifact.bytes.length).toBeGreaterThan(32);
    if (evidenceDirectory) {
      await mkdir(evidenceDirectory, { recursive: true });
      await writeFile(path.join(evidenceDirectory, "detailed.type-id.png"), result.artifact.bytes);
    }
  });
});
