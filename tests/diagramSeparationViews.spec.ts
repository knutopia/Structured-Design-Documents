import { completeExactSceneConnections } from "../src/renderer/staged/sceneBuilders.js";
import type { SceneEdge } from "../src/renderer/staged/contracts.js";
import nodePath from "node:path";
import YAML from "yaml";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { loadBundle } from "../src/bundle/loadBundle.js";
import type { Bundle } from "../src/bundle/types.js";
import { compileSource } from "../src/compiler/compileSource.js";
import { projectDiagram } from "../src/projector/projectView.js";
import { renderSource } from "../src/renderer/renderView.js";
import { renderSourcePreview } from "../src/renderer/previewWorkflow.js";
import { buildJourneyMapRenderModel } from "../src/renderer/journeyMapRenderModel.js";
import { buildIaPlaceMapRenderModel } from "../src/renderer/iaPlaceMapRenderModel.js";
import { resolveDetailDisplayPolicy } from "../src/renderer/detailDisplay.js";
import { buildUiContractsPresentationModel } from "../src/renderer/uiContractsPresentationModel.js";
let bundle: Bundle;
beforeAll(async () => { bundle = await loadBundle("bundle/v0.2/manifest.yaml"); });
const cases = [
  ["journey", "DG-101", "journey_map", ["J-101", "STG-101"], 1],
  ["service", "DG-201", "service_blueprint", ["B-201", "D-201", "PL-201", "PR-201", "PR-202", "SA-201"], 6],
  ["ia", "DG-301", "ia_place_map", ["A-301", "P-301", "P-302", "P-303"], 2],
  ["outcome", "DG-401", "outcome_opportunity_map", ["I-401", "M-401", "O-401", "OP-401"], 3],
  ["ui", "DG-501", "ui_contracts", ["C-501", "P-501", "S-501", "S-502", "VS-501"], 3],
  ["ui", "DG-502", "ui_contracts", ["S-501", "S-502"], 1],
  ["ui", "DG-503", "ui_contracts", ["S-501", "S-502"], 1]
] as const;

describe("shared named selection across all remaining views", () => {
  for (const [fixture, diagramId, viewId, nodes, edgeCount] of cases) {
    it(`${diagramId} ${viewId} retains exact inventory in projection and all supported artifacts`, async () => {
      const path = `tests/fixtures/diagram-separation/${fixture}.sdd`, text = await readFile(path, "utf8"), input = { path, text };
      const compiled = compileSource(input, bundle);
      expect(compiled.diagnostics.filter(d => d.severity === "error")).toEqual([]);
      const projected = projectDiagram(compiled.graph!, bundle, diagramId);
      expect(projected.diagnostics.filter(d => d.severity === "error")).toEqual([]);
      const projection = projected.projection!, view = bundle.views.views.find(v => v.id === viewId)!;
      expect(projection.nodes.map(n => n.id)).toEqual(nodes);
      expect(projection.edges).toHaveLength(edgeCount);
      if (viewId === "journey_map") {
        const model = buildJourneyMapRenderModel(projection, compiled.graph!, bundle, view.projection.hierarchy_edges, view.projection.ordering_edges, resolveDetailDisplayPolicy(view, "detailed"));
        expect(model.rootItems.map(item => item.id)).toEqual(["STG-101"]);
        expect(projection.derived.node_annotations[0].references!.map(r => r.target_id).sort()).toEqual(["B-101", "OP-101", "S-101"]);
      }
      if (viewId === "ia_place_map") {
        const model = buildIaPlaceMapRenderModel(projection, compiled.graph!, view.projection.hierarchy_edges, resolveDetailDisplayPolicy(view, "detailed"));
        expect(model.rootItems.map(item => item.id)).toEqual(["A-301", "P-302", "P-303"]);
      }
      if (viewId === "outcome_opportunity_map") expect(projection.derived.node_annotations.flatMap(a => a.references!.map(r => r.target_id)).sort()).toEqual(["PR-401", "S-401"]);
      if (diagramId === "DG-502" || diagramId === "DG-503") {
        const model = buildUiContractsPresentationModel(projection, compiled.graph!, view, "compact");
        expect(model.visibleSemanticNodeIds.sort()).toEqual(["S-501", "S-502"]);
        expect([...new Set(model.occurrences.map(o => o.semanticId))].sort()).toEqual(["S-501", "S-502"]);
        expect(model.relationships.map(e => e.label).join(" ")).toContain(diagramId === "DG-502" ? "zebra" : "apple");
        expect(model.relationships.map(e => e.label).join(" ")).toContain("Save request");
      }
      for (const detailId of ["compact", "detailed"]) {
        for (const format of ["dot", "mermaid"] as const) {
          const result = renderSource(input, bundle, { viewId, diagramId, format, detailId, profileId: "simple" });
          expect(result.diagnostics.filter(d => d.severity === "error")).toEqual([]);
          expect(result.text).toBeTruthy();
          expect(result.text).not.toContain("Excluded");
        }
        for (const format of ["svg", "png"] as const) {
          const result = await renderSourcePreview(input, bundle, { viewId, diagramId, format, detailId, profileId: "simple" });
          expect(result.diagnostics.filter(d => d.severity === "error")).toEqual([]);
          expect(result.artifact).toBeDefined();
          if (format === "svg") {
            expect(result.artifact!.text).toContain(`<title>${projection.diagram_name}</title>`);
            if (diagramId === "DG-502" || diagramId === "DG-503") expect(result.artifact!.text).not.toContain("Request editor");
          }
          if (process.env.SDD_RECORD_DIAGRAM_EVIDENCE === "1") await writeFile(`docs/v0.2_syntax_extension/evidence/diagram-separation/${diagramId}.${detailId}.${format}`, format === "svg" ? result.artifact!.text! : result.artifact!.bytes!);
        }
      }
      const legacy = await renderSourcePreview(input, bundle, { viewId, diagramId, format: "svg", detailId: "detailed", profileId: "simple", backendId: "legacy_graphviz_preview" });
      expect(legacy.artifact).toBeDefined();
      expect(legacy.diagnostics.filter(d => d.severity === "error")).toEqual([]);
    });
  }
  it("completes exact cross-scope navigation and rejects unsupported parallel navigation", async () => {
    const viewId = "ia_place_map";
    for (const parallel of [false, true]) {
      const text = `SDD-TEXT 0.2\nDiagram DG-399 "Unsupported navigation"\n  diagram_type=ia_place_map\nEND\nArea A-399 "Area"\n  CONTAINS P-398 diagrams=DG-399\nEND\nPlace P-398 "Inside area"\n  NAVIGATES_TO P-399 diagrams=DG-399\n${parallel ? "  NAVIGATES_TO P-399 diagrams=DG-399\n" : ""}END\nPlace P-399 "Outside area"\nEND\n`;
      const result = await renderSourcePreview({ path: "unsupported-ia.sdd", text }, bundle, { viewId, diagramId: "DG-399", format: "svg", profileId: "simple", force: true });
      if (parallel) {
        expect(result.artifact).toBeUndefined();
        expect(result.diagnostics.some(d => d.code === "renderer.scene.unsupported_parallel_occurrences" && d.severity === "error")).toBe(true);
      } else {
        expect(result.artifact).toBeDefined();
        expect(result.diagnostics.filter(d => d.severity === "error")).toEqual([]);
        if (process.env.SDD_RECORD_DIAGRAM_EVIDENCE === "1") {
          await writeFile("docs/v0.2_syntax_extension/evidence/diagram-separation/DG-399.cross-scope.svg", result.artifact!.text!);
          const png = await renderSourcePreview({ path: "unsupported-ia.sdd", text }, bundle, { viewId, diagramId: "DG-399", format: "png", profileId: "simple" });
          await writeFile("docs/v0.2_syntax_extension/evidence/diagram-separation/DG-399.cross-scope.png", png.artifact!.bytes!);
        }
      }
      const legacy = await renderSourcePreview({ path: "unsupported-ia.sdd", text }, bundle, { viewId, diagramId: "DG-399", format: "svg", profileId: "simple", backendId: "legacy_graphviz_preview" });
      expect(legacy.artifact).toBeDefined();
    }
  });

  it("uses bundle reference label/detail rules without expanding selected topology", async () => {
    const path = "tests/fixtures/diagram-separation/journey.sdd", text = await readFile(path, "utf8"), compiled = compileSource({ path, text }, bundle).graph!;
    const temporary = await mkdtemp("/tmp/sdd-diagram-reference-");
    await cp(bundle.rootDir, temporary, { recursive: true });
    const viewsPath = nodePath.join(temporary, "core/views.yaml");
    const artifact = YAML.parse(await readFile(viewsPath, "utf8"));
    const view = artifact.views.find((v: { id: string }) => v.id === "journey_map");
    const config = view.conventions.renderer_defaults.relationship_references.find((c: { relationship: string }) => c.relationship === "MAPS_TO");
    config.label = "Crosswalk changed by bundle";
    await writeFile(viewsPath, YAML.stringify(artifact));
    const changed = await loadBundle(nodePath.join(temporary, "manifest.yaml"));
    const original = projectDiagram(compiled, bundle, "DG-101").projection!, mutated = projectDiagram(compiled, changed, "DG-101").projection!;
    expect(mutated.nodes).toEqual(original.nodes);
    expect(mutated.edges).toEqual(original.edges);
    expect(mutated.derived.node_annotations[0].references!.some(r => r.label === config.label)).toBe(true);
    const result = renderSource({ path, text }, changed, { viewId: "journey_map", diagramId: "DG-101", format: "dot", profileId: "simple", detailId: "detailed" });
    expect(result.text).toContain("Crosswalk changed by bundle");
    view.conventions.renderer_defaults.detail_display.detailed[config.detail_setting] = false;
    await writeFile(viewsPath, YAML.stringify(artifact));
    const hidden = await loadBundle(nodePath.join(temporary, "manifest.yaml"));
    const hiddenProjection = projectDiagram(compiled, hidden, "DG-101").projection!;
    expect(hiddenProjection.nodes).toEqual(original.nodes);
    expect(hiddenProjection.edges).toEqual(original.edges);
    const hiddenResult = renderSource({ path, text }, hidden, { viewId: "journey_map", diagramId: "DG-101", format: "dot", profileId: "simple", detailId: "detailed" });
    expect(hiddenResult.text).not.toContain("Crosswalk changed by bundle");
    await rm(temporary, { recursive: true, force: true });
  });

  it("does not infer selected UI ownership from place_id without the selected structural edge", () => {
    const text = `SDD-TEXT 0.2\nDiagram DG-599 "Independent owners"\n  diagram_type=ui_contracts\nEND\nPlace P-599 "Explicit place"\n  diagrams=DG-599\n  CONTAINS VS-598\nEND\nViewState VS-598 "Explicit view"\n  diagrams=DG-599\n  place_id=P-599\nEND\n`;
    const graph = compileSource({ path: "ui-no-ownership.sdd", text }, bundle).graph!;
    const projection = projectDiagram(graph, bundle, "DG-599").projection!;
    expect(projection.edges).toEqual([]);
    const view = bundle.views.views.find(v => v.id === "ui_contracts")!;
    const model = buildUiContractsPresentationModel(projection, graph, view, "detailed");
    const place = model.scopes.find(scope => scope.focal.semanticId === "P-599")!;
    expect(place.sequences).toEqual([]);
    expect(model.scopes.some(scope => scope.kind === "standalone" && scope.focal.semanticId === "VS-598")).toBe(true);
    expect(model.relationships).toEqual([]);
  });

  it("matches exact represented occurrence references rather than ordinal substrings", () => {
    const edges: SceneEdge[] = [{ id: "edge-source-key-10", role: "navigation", classes: [],
      viewMetadata: { sourceEdgeIds: ["source-key-10"] }, from: { itemId: "A", portId: "east" },
      to: { itemId: "B", portId: "west" }, routing: { style: "orthogonal", preferAxis: "horizontal" } }];
    const diagnostics = completeExactSceneConnections(edges, [{ from: "C", to: "D", source_edge_id: "source-key-1", role: "navigation" }]);
    expect(diagnostics).toEqual([]);
    expect(edges).toHaveLength(2);
    expect(edges[1].viewMetadata!.sourceEdgeIds).toEqual(["source-key-1"]);
  });

});
