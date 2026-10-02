import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { compileSource, createSemanticRelationshipReader, loadBundle, projectView, renderSource, validateGraph } from "../src/index.js";
import type { Bundle } from "../src/bundle/types.js";
import { suggestNodeId } from "../src/authoring/guidedAddition/forms.js";
import { createGuidedDocumentSnapshot } from "../src/authoring/guidedAddition/snapshot.js";
import { createGuidanceCatalog } from "../src/authoring/guidedAddition/catalog.js";
import { getNodeAuthoringForm, getNodeIdSuggestionInputs, listAllowedEndpointTriples } from "../src/bundle/guidedAuthoring.js";
import { renderSourcePreview } from "../src/renderer/previewWorkflow.js";

const manifest = path.resolve("bundle/v0.2/manifest.yaml");
const views = ["journey_map", "service_blueprint", "scenario_flow"];
const types = ["JourneyStep", "BlueprintStep", "ScenarioStep"];
let bundle: Bundle;
const temporaryDirectories: string[] = [];
beforeAll(async () => { bundle = await loadBundle(manifest); });
afterAll(async () => { await Promise.all(temporaryDirectories.map((dir) => rm(dir, { recursive: true, force: true }))); });

function compile(text: string, selected = bundle) {
  const result = compileSource({ path: "/tmp/step-differentiation.sdd", text: `SDD-TEXT ${selected.manifest.language_version}\n${text}` }, selected);
  expect(result.diagnostics).toEqual([]);
  expect(result.graph).toBeDefined();
  return result.graph!;
}
function node(type: string, id: string, edges = "", props = "") {
  return `${type} ${id} "${id}"\n${props}${edges}END\n`;
}
function fixture(direction: "forward" | "reverse" | "reciprocal" = "reciprocal") {
  const common = '  owner = "Design"\n  description = "Episode"\n  actor = "Customer"\n  intent = "Complete task"\n  success_criteria = "Task complete"\n';
  return [
    node("Stage", "G-001", '  CONTAINS J-001\n  CONTAINS J-002\n', '  owner = "Design"\n  description = "Purchase"\n  order_index = 1\n'),
    node("JourneyStep", "J-001", `  PRECEDES J-002\n  REALIZED_BY P-001\n  REFINED_BY S-001\n${direction !== "reverse" ? '  MAPS_TO BP-001\n' : ''}  MAPS_TO BP-002\n`, common),
    node("JourneyStep", "J-002", '  REALIZED_BY P-001\n', common),
    node("BlueprintStep", "BP-001", `  PRECEDES BP-002\n  REALIZED_BY PR-001\n  REFINED_BY S-002\n${direction !== "forward" ? '  MAPS_TO J-001\n' : ''}  MAPS_TO J-002\n`, common),
    node("BlueprintStep", "BP-002", '  REALIZED_BY PR-002\n  REFINED_BY S-001\n  REFINED_BY S-003\n', common),
    node("ScenarioStep", "S-001", '  PRECEDES S-002\n  REALIZED_BY P-001\n', common),
    node("ScenarioStep", "S-002", '  PRECEDES S-003\n  REALIZED_BY P-001\n', common),
    node("ScenarioStep", "S-003", '  REALIZED_BY P-001\n', common),
    node("Place", "P-001", '', '  owner = "Product"\n  description = "Checkout"\n  surface = web\n  route_or_key = "/checkout"\n  access = public\n'),
    ...["PR-001", "PR-002"].map(id => node("Process", id, '', '  owner = "Operations"\n  description = "Delivery"\n  visibility = frontstage\n  sla = "Immediate"\n')),
    node("Metric", "M-001", '  INSTRUMENTED_AT J-001\n  INSTRUMENTED_AT BP-001\n  INSTRUMENTED_AT S-001\n', '  owner = "Analytics"\n  description = "Completion"\n  definition = "Completed tasks"\n  source = "Events"\n  cadence = "Daily"\n  metric_type = "Count"\n')
  ].join("\n");
}
async function mutate(mutator: (data: Record<string, any>) => void): Promise<Bundle> {
  const dir = await mkdtemp("/tmp/sdd-step-bundle-");
  temporaryDirectories.push(dir);
  await cp(path.dirname(manifest), dir, { recursive: true });
  const files = ["core/vocab.yaml", "core/contracts.yaml", "core/authoring.yaml", "core/views.yaml", "core/schema.json", "profiles/simple.yaml", "profiles/permissive.yaml", "profiles/strict.yaml"];
  const data: Record<string, any> = {};
  for (const file of files) data[file] = YAML.parse(await readFile(path.join(dir, file), "utf8"));
  mutator(data);
  for (const file of files) await writeFile(path.join(dir, file), file.endsWith(".json") ? JSON.stringify(data[file], null, 2) : YAML.stringify(data[file]));
  return loadBundle(path.join(dir, "manifest.yaml"));
}

describe("v0.2 Step differentiation", () => {
  it("accepts exact new types and preserves the independent v0.1 vocabulary", async () => {
    const old = await loadBundle("bundle/v0.1/manifest.yaml");
    for (const type of types) {
      expect(compile(node(type, "J-001")).nodes[0].type).toBe(type);
      expect(compileSource({ path: "old.sdd", text: node(type, "J-001") }, old).diagnostics.some(d => d.severity === "error")).toBe(true);
    }
    for (const type of ["Step", "BluePrintStep"]) {
      expect(compileSource({ path: "new.sdd", text: `SDD-TEXT 0.2\n${node(type, "J-001")}` }, bundle).diagnostics.some(d => d.severity === "error")).toBe(true);
    }
    expect(compile(node("Step", "J-001"), old).nodes[0].type).toBe("Step");
    expect(bundle.schema.$defs).toHaveProperty("nodeType.enum", expect.not.arrayContaining(["Step"]));
  });

  it("enforces every legal endpoint and rejects cross-type order, reverse refinement and illegal mappings", () => {
    for (const relation of bundle.contracts.relationships.filter(r => ["CONTAINS", "PRECEDES", "REALIZED_BY", "INSTRUMENTED_AT", "MAPS_TO", "REFINED_BY"].includes(r.type))) {
      for (const pair of relation.allowed_endpoints) {
        const graph = compile(node(pair.from, "J-101", `  ${relation.type} J-102\n`) + node(pair.to, "J-102"));
        expect(validateGraph(graph, bundle, "simple").diagnostics.filter(d => d.code === "validate.endpoint_pairs_enforced"), `${pair.from} ${relation.type} ${pair.to}`).toEqual([]);
      }
    }
    for (const [from, type, to] of [
      ["JourneyStep", "PRECEDES", "BlueprintStep"], ["BlueprintStep", "PRECEDES", "ScenarioStep"],
      ["ScenarioStep", "REFINED_BY", "JourneyStep"], ["Stage", "CONTAINS", "BlueprintStep"],
      ["JourneyStep", "MAPS_TO", "JourneyStep"], ["ScenarioStep", "MAPS_TO", "BlueprintStep"]
    ]) {
      expect(validateGraph(compile(node(from, "J-101", `  ${type} J-102\n`) + node(to, "J-102")), bundle, "simple").errorCount, `${from} ${type} ${to}`).toBeGreaterThan(0);
    }
    expect(validateGraph(compile(node("JourneyStep", "J-101", '  MAPS_TO J-101\n')), bundle, "simple").errorCount).toBeGreaterThan(0);
  });

  it("transfers properties, realization, references and decision severities without inheritance", async () => {
    const old = await loadBundle("bundle/v0.1/manifest.yaml");
    const props = '  opportunity_refs = "OP-999"\n  kind = invalid\n';
    for (const type of types) for (const profile of ["simple", "permissive", "strict"]) {
      const text = node(type, "J-001", '  PRECEDES J-002\n  PRECEDES J-003\n', props) + node(type, "J-002") + node(type, "J-003");
      const baseline = validateGraph(compile(text.replaceAll(type, "Step"), old), old, profile);
      const actual = validateGraph(compile(text), bundle, profile);
      const normalize = (diagnostics: typeof actual.diagnostics) => diagnostics.filter(d => d.code !== "validate.id_prefix_type_coupling").map(d => [d.code.replace(/(journey|blueprint|scenario)_step_/g, "step_"), d.severity, d.relatedIds]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
      expect(normalize(actual.diagnostics)).toEqual(normalize(baseline.diagnostics));
    }
    for (const [type, id] of [["JourneyStep", "J-001"], ["BlueprintStep", "BP-001"], ["ScenarioStep", "S-001"]]) {
      const text = fixture().replace(new RegExp(`(${type} ${id}[^\\n]*\\n[\\s\\S]*?)  REALIZED_BY [^\\n]+\\n`), "$1");
      const graph = compile(text);
      expect(validateGraph(graph, bundle, "strict").diagnostics.some(d => d.relatedIds?.includes(id) && d.ruleId?.endsWith("step_realization_required"))).toBe(true);
    }
  });

  it("coalesces symmetric correspondence while retaining literal authored declarations and duplicate diagnostics", () => {
    const graph = compile(fixture());
    const reader = createSemanticRelationshipReader(graph, bundle);
    expect(graph.edges.filter(e => e.type === "MAPS_TO")).toHaveLength(4);
    expect(reader.relationships.filter(e => e.type === "MAPS_TO")).toHaveLength(3);
    expect(reader.lookup("J-001", "outgoing", "MAPS_TO")).toHaveLength(2);
    expect(reader.lookup("J-001", "incoming", "MAPS_TO")).toHaveLength(2);
    expect(reader.lookup("BP-001", "incident", "MAPS_TO")).toHaveLength(2);
    expect(reader.lookup("S-001", "incoming", "REFINED_BY")).toHaveLength(2);
    expect(reader.lookup("S-001", "outgoing", "REFINED_BY")).toHaveLength(0);
    expect(reader.lookup("J-001", "outgoing", "REFINED_BY").map(r => r.to)).toEqual(["S-001"]);
    expect(reader.lookup("BP-001", "outgoing", "REFINED_BY").map(r => r.to)).toEqual(["S-002"]);
    expect(validateGraph(graph, bundle, "strict").diagnostics).toEqual([]);
    expect(validateGraph(compile(fixture().replace('  MAPS_TO BP-001\n', '  MAPS_TO BP-001\n  MAPS_TO BP-001\n')), bundle, "simple").diagnostics.some(d => d.code === "validate.duplicate_edge_detection")).toBe(true);
  });

  it("keeps declaration associations and directed defaults without graph expansion", async () => {
    const selected = await mutate(data => { delete data["core/contracts.yaml"].relationships.find((r: any) => r.type === "MAPS_TO").semantics; });
    const graph = compile(fixture());
    const before = JSON.stringify(graph);
    const reader = createSemanticRelationshipReader(graph, bundle);
    const pair = reader.lookup("J-001", "incident", "MAPS_TO").find(r => r.from === "BP-001")!;
    expect(pair.declarations).toHaveLength(2);
    expect(pair.declarations.every(edge => graph.edges.includes(edge))).toBe(true);
    expect(reader.lookup("J-002", "outgoing", "REFINED_BY")).toEqual([]);
    expect(JSON.stringify(graph)).toBe(before);
    const directed = createSemanticRelationshipReader(graph, selected);
    expect(directed.relationships.filter(r => r.type === "MAPS_TO")).toHaveLength(4);
    expect(directed.lookup("J-001", "incoming", "MAPS_TO")).toHaveLength(1);
    expect(directed.lookup("J-001", "outgoing", "MAPS_TO")).toHaveLength(2);
  });

  it("follows renamed relationship tokens and preserves reference and instrumentation order", async () => {
    const selected = await mutate(data => {
      const rename = (value: any): any => value === "MAPS_TO" ? "CORRESPONDS" : Array.isArray(value) ? value.map(rename) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([key, value]) => [key, rename(value)])) : value;
      for (const key of Object.keys(data)) data[key] = rename(data[key]);
    });
    const graph = compile(fixture().replaceAll("MAPS_TO", "CORRESPONDS"), selected);
    expect(createSemanticRelationshipReader(graph, selected).lookup("J-001", "incident", "CORRESPONDS")).toHaveLength(2);
    const journey = projectView(graph, selected, "journey_map");
    expect(journey.diagnostics).toEqual([]);
    expect(journey.projection!.derived.node_annotations[0].references?.map(r => r.target_id)).toEqual(["BP-001", "BP-002", "S-001"]);
    const outcome = projectView(graph, selected, "outcome_opportunity_map");
    expect(outcome.diagnostics).toEqual([]);
    expect(outcome.projection!.derived.node_annotations[0].references?.map(r => r.target_type)).toEqual(types);
    const withOpportunity = compile(fixture().replace('  MAPS_TO BP-001\n', '  opportunity_refs = "OP-002, OP-001"\n  MAPS_TO BP-001\n') + node("Opportunity", "OP-001") + node("Opportunity", "OP-002"));
    const references = projectView(withOpportunity, bundle, "journey_map").projection!.derived.node_annotations[0].references!;
    expect(references.map(r => r.target_id)).toEqual(["OP-001", "OP-002", "BP-001", "BP-002", "S-001"]);
    expect(references.slice(0, 2).every(r => r.role === "opportunity_ref")).toBe(true);
  });

  it("projects forward, reverse and reciprocal mappings identically without leaking Step types", () => {
    for (const [i, view] of views.entries()) {
      const projections = ["forward", "reverse", "reciprocal"].map(direction => projectView(compile(fixture(direction as "forward" | "reverse" | "reciprocal")), bundle, view));
      for (const projected of projections) {
        expect(projected.diagnostics).toEqual([]);
        expect(projected.projection!.nodes.filter(n => types.includes(n.type)).map(n => n.type)).toEqual(Array(i === 2 ? 3 : 2).fill(types[i]));
      }
      expect(projections[0].projection).toEqual(projections[1].projection);
      expect(projections[0].projection).toEqual(projections[2].projection);
      for (const format of ["dot", "mermaid"] as const) for (const detailId of ["compact", "detailed"]) {
        const rendered = ["forward", "reverse", "reciprocal"].map(direction => renderSource({ path: "proof.sdd", text: `SDD-TEXT 0.2\n${fixture(direction as "forward" | "reverse" | "reciprocal")}` }, bundle, { viewId: view, format, detailId, profileId: "strict" }));
        expect(rendered[0].diagnostics).toEqual([]);
        expect(rendered[0].text).toBe(rendered[1].text);
        expect(rendered[0].text).toBe(rendered[2].text);
        expect(rendered[0].text?.includes(i === 2 ? "Refines:" : "Maps to:")).toBe(detailId === "detailed");
      }
    }
  });

  it("follows coherently renamed types through parsing, forms, projection, staged rendering and decorators", async () => {
    for (const [i, type] of types.entries()) {
      const renamed = `Episode${i}`;
      const selected = await mutate(data => {
        const replace = (value: any): any => typeof value === "string" ? value === type ? renamed : value : Array.isArray(value) ? value.map(replace) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([key, value]) => [key === type ? renamed : key, replace(value)])) : value;
        for (const key of Object.keys(data)) data[key] = replace(data[key]);
      });
      const text = (await readFile("bundle/v0.2/examples/step_differentiation.sdd", "utf8")).replace(/^SDD-TEXT 0.2\n/, "").replaceAll(type, renamed);
      const graph = compile(text, selected);
      expect(getNodeAuthoringForm(selected, renamed)).toBeDefined();
      expect(listAllowedEndpointTriples(selected).some(t => t.from === renamed || t.to === renamed)).toBe(true);
      const projected = projectView(graph, selected, views[i]);
      expect(projected.diagnostics).toEqual([]);
      expect(projected.projection!.nodes.some(n => n.type === renamed)).toBe(true);
      const result = await renderSourcePreview({ path: "renamed.sdd", text: `SDD-TEXT 0.2\n${text}` }, selected, { viewId: views[i], format: "svg", detailId: "detailed", profileId: "strict", nodeDecoratorModeId: "type,id" });
      expect(result.diagnostics.filter(d => d.severity === "error")).toEqual([]);
      expect(result.artifact?.format).toBe("svg");
      if (result.artifact?.format === "svg") expect(result.artifact.text).toContain(renamed);
    }
  });

  it("follows loaded correspondence directionality and validates invalid descriptors", async () => {
    const directed = await mutate(data => { data["core/contracts.yaml"].relationships.find((r: any) => r.type === "MAPS_TO").semantics.directionality = "directed"; });
    const reader = createSemanticRelationshipReader(compile(fixture(), directed), directed);
    expect(reader.relationships.filter(r => r.type === "MAPS_TO")).toHaveLength(4);
    expect(reader.lookup("J-001", "incoming", "MAPS_TO")).toHaveLength(1);
    await expect(mutate(data => { data["core/contracts.yaml"].relationships.find((r: any) => r.type === "MAPS_TO").semantics.identity_fields = ["type"]; })).rejects.toThrow(/Loaded bundle is invalid/);
  });

  it("uses bundle prefixes, endpoint legality, reference labels and detail switches", async () => {
    const selected = await mutate(data => {
      data["core/authoring.yaml"].node_id_suggestions.prefix_by_type.JourneyStep = "EP";
      const remove = (r: any) => r.from === "JourneyStep" && r.to === "Process";
      data["core/contracts.yaml"].relationships.find((r: any) => r.type === "REALIZED_BY").allowed_endpoints = data["core/contracts.yaml"].relationships.find((r: any) => r.type === "REALIZED_BY").allowed_endpoints.filter((r: any) => !remove(r));
      for (const view of data["core/views.yaml"].views) view.conventions.guided_addition.relationships = view.conventions.guided_addition.relationships.filter((r: any) => !(r.type === "REALIZED_BY" && remove(r)));
      const defaults = data["core/views.yaml"].views.find((v: any) => v.id === "journey_map").conventions.renderer_defaults;
      defaults.relationship_references[0].label = "Corresponds with";
      defaults.detail_display.compact.show_relationship_references = true;
      defaults.detail_display.detailed.show_relationship_references = false;
    });
    expect(getNodeIdSuggestionInputs(selected, "JourneyStep")?.prefix).toBe("EP");
    expect(listAllowedEndpointTriples(selected).some(t => t.from === "JourneyStep" && t.type === "REALIZED_BY" && t.to === "Process")).toBe(false);
    const validation = validateGraph(compile(node("JourneyStep", "J-001", '  REALIZED_BY PR-001\n') + node("Process", "PR-001"), selected), selected, "strict");
    expect(validation.diagnostics.some(d => d.code === "validate.endpoint_pairs_enforced")).toBe(true);
    expect(validation.diagnostics.some(d => d.code === "validate.id_prefix_type_coupling" && d.relatedIds?.includes("J-001"))).toBe(true);
    const snapshot = createGuidedDocumentSnapshot(selected, { document_ref: "proof.sdd", text: `SDD-TEXT 0.2\n${fixture()}` });
    expect(suggestNodeId(snapshot, createGuidanceCatalog(selected).getNodeType("JourneyStep")!)).toBe("EP-001");
    for (const detailId of ["compact", "detailed"]) {
      const rendered = renderSource({ path: "mutated.sdd", text: `SDD-TEXT 0.2\n${fixture()}` }, selected, { viewId: "journey_map", format: "dot", detailId, profileId: "simple" });
      expect(rendered.text?.includes("Corresponds with:")).toBe(detailId === "compact");
      const svg = await renderSourcePreview({ path: "mutated.sdd", text: `SDD-TEXT 0.2\n${fixture()}` }, selected, { viewId: "journey_map", format: "svg", detailId, profileId: "simple" });
      expect(svg.diagnostics.filter(d => d.severity === "error")).toEqual([]);
      if (svg.artifact?.format === "svg") expect(svg.artifact.text.toLowerCase().includes("corresponds with")).toBe(detailId === "compact");
    }
  });
});
