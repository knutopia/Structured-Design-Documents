import { renderPreviewArtifact } from "../src/renderer/previewBackends.js";
import { readFile } from "node:fs/promises";
import { describe, expect, it, beforeAll } from "vitest";
import { loadBundle } from "../src/bundle/loadBundle.js";
import type { Bundle } from "../src/bundle/types.js";
import { compileSource } from "../src/compiler/compileSource.js";
import { projectDiagram, projectView } from "../src/projector/projectView.js";
import { projectDiagramSource, projectSource } from "../src/projector/projectSource.js";
import { buildScenarioFlowRenderModel } from "../src/renderer/scenarioFlowRenderModel.js";
import { resolveDetailDisplayPolicy } from "../src/renderer/detailDisplay.js";
import { renderPreparedProjectionText, renderSource } from "../src/renderer/renderView.js";
import { renderSourcePreview } from "../src/renderer/previewWorkflow.js";
import { validateGraph } from "../src/validator/validateGraph.js";

let bundle: Bundle, named: string, control: string;
const input = (text: string) => ({ path: "/proof.sdd", text });
function graph(text: string) {
  const result = compileSource(input(text), bundle);
  expect(result.diagnostics.filter(d => d.severity === "error")).toEqual([]);
  expect(result.graph).toBeDefined();
  return result.graph!;
}
const diagram = (id: string, view = "scenario_flow") => `Diagram ${id} "${id}"\n  diagram_type=${view}\nEND\n`;

beforeAll(async () => {
  bundle = await loadBundle("bundle/v0.2/manifest.yaml");
  named = await readFile("tests/fixtures/diagram-separation/scenario_named.sdd", "utf8");
  control = await readFile("tests/fixtures/diagram-separation/scenario_control.sdd", "utf8");
});

describe("exact named projection", () => {
  it("has independent explicit proof inventories and the unchanged combined control", () => {
    const compiled = graph(named);
    const expected = [
      ["DG-001", ["SS-001", "SS-002", "SS-003", "SS-004", "SS-005"], 4],
      ["DG-002", ["SS-001", "SS-006", "SS-007", "SS-008"], 3],
      ["DG-003", ["SS-009", "SS-010", "SS-011"], 2]
    ] as const;
    for (const [id, nodes, count] of expected) {
      const projected = projectDiagram(compiled, bundle, id);
      expect(projected.diagnostics.filter(d => d.severity === "error")).toEqual([]);
      expect(projected.projection!.nodes.map(n => n.id)).toEqual(nodes);
      expect(projected.projection!.edges).toHaveLength(count);
      expect(projected.projection!.edges.every(e => e.source_edge_id)).toBe(true);
      expect(projected.projection).toEqual(projectDiagramSource(input(named), bundle, id).projection);
      expect(projected.projection).toEqual(projectSource(input(named), bundle, "scenario_flow", { diagramId: id }).projection);
    }
    const combined = projectView(compiled, bundle, "scenario_flow").projection!;
    expect(combined.nodes).toHaveLength(11);
    expect(combined.edges).toHaveLength(9);
    expect(combined).toEqual(projectView(graph(control), bundle, "scenario_flow").projection);
  });

  it("does not induce unassigned edges between included endpoints or react to excluded content", () => {
    const base = projectDiagram(graph(named), bundle, "DG-001").projection!;
    const changed = named.replace('  PRECEDES SS-003 diagrams=DG-001', '  PRECEDES SS-003 diagrams=DG-001\n  PRECEDES SS-004 {unselected shortcut}')
      + '\nScenarioStep SS-099 "Unrelated"\nEND\n' + diagram("DG-099");
    const compiled = graph(changed);
    expect(projectDiagram(compiled, bundle, "DG-001").projection).toEqual(base);
    expect(projectView(compiled, bundle, "scenario_flow").projection!.edges).toHaveLength(10);
  });

  it("includes assigned edge endpoints additively plus isolated, disconnected and shared members", () => {
    const text = `SDD-TEXT 0.2\n${diagram("DG-001")}${diagram("DG-002")}\nScenarioStep S-001 "Start"\n  diagrams=DG-001\n  PRECEDES S-002 diagrams="DG-001,DG-002"\nEND\nScenarioStep S-002 "End"\nEND\nScenarioStep S-003 "Isolated"\n  diagrams=DG-002\nEND\nScenarioStep S-004 "Disconnected"\n  PRECEDES S-005 diagrams=DG-002\nEND\nScenarioStep S-005 "Other end"\nEND\n`;
    const compiled = graph(text), first = projectDiagram(compiled, bundle, "DG-001").projection!, second = projectDiagram(compiled, bundle, "DG-002").projection!;
    expect(first.nodes.map(n => n.id)).toEqual(["S-001", "S-002"]);
    expect(second.nodes.map(n => n.id)).toEqual(["S-001", "S-002", "S-003", "S-004", "S-005"]);
    expect(first.edges[0].source_edge_id).toBe(second.edges.find(e => e.from === "S-001")!.source_edge_id);
    expect(second.edges).toHaveLength(2);
  });

  it("keeps global cycle diagnostics and supports rootless cyclic membership", () => {
    const text = `SDD-TEXT 0.2\n${diagram("DG-001")}ScenarioStep S-001 "A"\n  PRECEDES S-002 diagrams=DG-001\nEND\nScenarioStep S-002 "B"\n  PRECEDES S-001 diagrams=DG-001\nEND\n`;
    const compiled = graph(text);
    expect(projectDiagram(compiled, bundle, "DG-001").projection!.edges).toHaveLength(2);
    expect(validateGraph(compiled, bundle, "strict").diagnostics.some(d => d.message.toLowerCase().includes("cycl"))).toBe(true);
  });

  it("uses exact guarded occurrences despite canonical/source ordering differences", async () => {
    const text = `SDD-TEXT 0.2\n${diagram("DG-001")}${diagram("DG-002")}ScenarioStep S-001 "Decision"\n  kind=decision\n  PRECEDES S-002 {zebra} diagrams=DG-001\n  PRECEDES S-002 {apple} diagrams=DG-002\nEND\nScenarioStep S-002 "End"\nEND\n`;
    const compiled = graph(text), view = bundle.views.views.find(v => v.id === "scenario_flow")!;
    for (const [id, label, excluded] of [["DG-001", "zebra", "apple"], ["DG-002", "apple", "zebra"]]) {
      const projection = projectDiagram(compiled, bundle, id).projection!;
      expect(projection.derived.edge_annotations.map(a => a.display_label)).toEqual([label]);
      expect(projection.derived.edge_annotations[0].source_edge_id).toBe(projection.edges[0].source_edge_id);
      expect(buildScenarioFlowRenderModel(projection, compiled, view, resolveDetailDisplayPolicy(view, "detailed")).edges[0].branchLabel).toBe(label);
      for (const format of ["dot", "mermaid"] as const) {
        const rendered = renderSource(input(text), bundle, { viewId: "scenario_flow", diagramId: id, format, profileId: "simple", detailId: "detailed" });
        expect(rendered.diagnostics.filter(d => d.severity === "error")).toEqual([]);
        expect(rendered.text).toContain(label);
        expect(rendered.text).not.toContain(excluded);
      }
      const svg = await renderSourcePreview(input(text), bundle, { viewId: "scenario_flow", diagramId: id, format: "svg", profileId: "simple", detailId: "detailed" });
      expect(svg.diagnostics.filter(d => d.severity === "error")).toEqual([]);
      expect(svg.artifact!.text).toContain(label);
      expect(svg.artifact!.text).not.toContain(excluded);
      expect(svg.artifact!.text).toContain(`<title>${id}</title>`);
    }
  });

  it("has empty raw projections and clear invalid/non-visible rendering failures", async () => {
    const text = `SDD-TEXT 0.2\n${diagram("DG-001")}ScenarioStep S-001 "Outside"\nEND\n`;
    expect(projectDiagram(graph(text), bundle, "DG-001").projection!.nodes).toEqual([]);
    expect(projectDiagram(graph(text), bundle, "DG-404").projection).toBeUndefined();
    expect(projectView(graph(text), bundle, "journey_map", { diagramId: "DG-001" }).projection).toBeUndefined();
    const rendered = await renderSourcePreview(input(text), bundle, { viewId: "scenario_flow", diagramId: "DG-001", format: "svg", profileId: "simple", force: true });
    expect(rendered.artifact).toBeUndefined();
    expect(rendered.diagnostics.some(d => d.code === "renderer.diagram_no_visible_content")).toBe(true);
  });
  it("rejects missing, mismatched and unselected occurrence references without triple fallback", async () => {
    const compiled = graph(named), projected = projectDiagram(compiled, bundle, "DG-001").projection!;
    const view = bundle.views.views.find(v => v.id === "scenario_flow")!;
    for (const mutate of [
      (p: typeof projected) => { delete p.edges[0].source_edge_id; },
      (p: typeof projected) => { p.edges[0].source_edge_id = "missing-occurrence"; },
      (p: typeof projected) => { p.edges[0].source_edge_id = p.edges[1].source_edge_id; },
      (p: typeof projected) => { p.derived.edge_annotations[0].source_edge_id = "missing-occurrence"; }
    ]) {
      const projection = structuredClone(projected); mutate(projection);
      const result = renderPreparedProjectionText(compiled, bundle, view, projection, { viewId: view.id, format: "dot", profileId: "simple", detailId: "detailed" });
      expect(result.text).toBeUndefined();
      expect(result.diagnostics.some(d => d.code === "project.invalid_source_edge_reference")).toBe(true);
      await expect(renderPreviewArtifact({ bundle, view, backendId: "staged_scenario_flow_preview", format: "svg",
        source: { kind: "projection", graph: compiled, projection, detailId: "detailed" } })).rejects.toMatchObject({
          diagnostics: expect.arrayContaining([expect.objectContaining({ code: "project.invalid_source_edge_reference", severity: "error" })])
        });
    }
  });

  it("preserves raw isolated membership when compact presentation hides its only member", async () => {
    const text = `SDD-TEXT 0.2\n${diagram("DG-001")}Place P-001 "Isolated place"\n  diagrams=DG-001\nEND\n`;
    expect(projectDiagram(graph(text), bundle, "DG-001").projection!.nodes.map(node => node.id)).toEqual(["P-001"]);
    const compact = await renderSourcePreview(input(text), bundle, { viewId: "scenario_flow", diagramId: "DG-001", format: "svg", profileId: "simple", detailId: "compact" });
    expect(compact.artifact).toBeUndefined();
    expect(compact.diagnostics.some(d => d.code === "renderer.diagram_no_visible_content")).toBe(true);
    const detailed = await renderSourcePreview(input(text), bundle, { viewId: "scenario_flow", diagramId: "DG-001", format: "svg", profileId: "simple", detailId: "detailed" });
    expect(detailed.artifact).toBeDefined();
    const repeated = await renderSourcePreview(input(text), bundle, { viewId: "scenario_flow", diagramId: "DG-001", format: "svg", profileId: "simple", detailId: "detailed" });
    expect(repeated.artifact!.text).toEqual(detailed.artifact!.text);
    expect(detailed.artifact!.text).not.toContain("\r");
  });

  it("rejects unassigned same-endpoint guarded occurrences in raw primary edges and annotations", async () => {
    const text = `SDD-TEXT 0.2\n${diagram("DG-001")}${diagram("DG-002")}ScenarioStep S-001 "Decision"\n  kind=decision\n  PRECEDES S-002 {selected} diagrams=DG-001\n  PRECEDES S-002 {unselected} diagrams=DG-002\nEND\nScenarioStep S-002 "End"\nEND\n`;
    const compiled = graph(text), selected = projectDiagram(compiled, bundle, "DG-001").projection!;
    const unselectedId = projectDiagram(compiled, bundle, "DG-002").projection!.edges[0].source_edge_id!;
    const view = bundle.views.views.find(v => v.id === "scenario_flow")!;
    for (const mutate of [
      (p: typeof selected) => { p.edges[0].source_edge_id = unselectedId; p.derived.edge_annotations = []; },
      (p: typeof selected) => { p.derived.edge_annotations[0].source_edge_id = unselectedId; },
      (p: typeof selected) => { p.edges[0].source_edge_id = unselectedId; p.derived.edge_annotations[0].source_edge_id = unselectedId; p.derived.edge_annotations[0].display_label = "unselected"; }
    ]) {
      const projection = structuredClone(selected); mutate(projection);
      const rendered = renderPreparedProjectionText(compiled, bundle, view, projection, { viewId: view.id, format: "dot", profileId: "simple", detailId: "detailed" });
      expect(rendered.text).toBeUndefined();
      expect(rendered.diagnostics.some(d => d.code === "project.invalid_source_edge_reference")).toBe(true);
      await expect(renderPreviewArtifact({ bundle, view, backendId: "staged_scenario_flow_preview", format: "svg",
        source: { kind: "projection", graph: compiled, projection, detailId: "detailed" } })).rejects.toMatchObject({
          diagnostics: expect.arrayContaining([expect.objectContaining({ code: "project.invalid_source_edge_reference", severity: "error" })])
        });
    }
  });

});
