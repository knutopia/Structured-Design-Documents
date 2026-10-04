import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadBundle } from "../src/bundle/loadBundle.js";
import type { Bundle } from "../src/bundle/types.js";
import { collectBundleDiagnostics } from "../src/bundle/validateLoadedBundle.js";
import { resolveBundleFieldReference } from "../src/bundle/bundleReferences.js";
import { computeBundleFingerprint } from "../src/bundle/fingerprint.js";
import { compileSource } from "../src/compiler/compileSource.js";
import type { CompiledGraph } from "../src/compiler/types.js";
import { resolveDiagramSelection, resolveDocumentDiagrams } from "../src/diagrams/resolveDiagrams.js";
import { listDiagrams } from "../src/diagrams/resolveDiagrams.js";
import { createSourceEdgeIndex, semanticEdgeIdentity } from "../src/relationships/edgeIdentity.js";
import { createSemanticRelationshipReader } from "../src/relationships/semanticRelationships.js";
import { validateGraph } from "../src/validator/validateGraph.js";
import { projectDiagram } from "../src/projector/projectView.js";
import { renderSource } from "../src/renderer/renderView.js";
import { renderSourcePreview } from "../src/renderer/previewWorkflow.js";

let bundle: Bundle;
let oldBundle: Bundle;
const temps: string[] = [];
beforeAll(async () => { [bundle, oldBundle] = await Promise.all([loadBundle("bundle/v0.2/manifest.yaml"), loadBundle("bundle/v0.1/manifest.yaml")]); });
afterAll(async () => { await Promise.all(temps.map((dir) => rm(dir, { recursive: true, force: true }))); });
async function mutatedBundle(mutate: (changed: Bundle) => void): Promise<Bundle> {
  const changed = structuredClone(bundle); mutate(changed);
  const dir = await mkdtemp("/tmp/sdd-diagram-contract-"); temps.push(dir);
  await cp("bundle/v0.2", dir, {recursive:true});
  const artifacts = {vocab:changed.vocab,syntax:changed.syntax,schema:changed.schema,contracts:changed.contracts,
    projection_schema:changed.projectionSchema,views:changed.views,authoring:changed.authoring};
  for (const [key, relative] of Object.entries(changed.manifest.core)) {
    const value = artifacts[key as keyof typeof artifacts];
    await writeFile(path.join(dir,relative),relative.endsWith(".json") ? JSON.stringify(value,null,2)+"\n" : YAML.stringify(value));
  }
  for (const profile of changed.manifest.profiles) await writeFile(path.join(dir,profile.path),YAML.stringify(changed.profiles[profile.id]));
  return loadBundle(path.join(dir,"manifest.yaml"));
}
function graph(text: string, loaded = bundle): CompiledGraph {
  const result = compileSource({ path: "membership.sdd", text: `${loaded.syntax.document.version_declaration.literal} ${loaded.manifest.language_version}\n${text}` }, loaded);
  expect(result.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
  expect(result.graph).toBeDefined();
  return result.graph!;
}
const declaration = (id = "DG-001", type = "scenario_flow") => `Diagram ${id} \"Flow\"\ndiagram_type=${type}\nEND\n`;
const pair = (membership = "DG-001", edges = `PRECEDES S-002 diagrams=${membership}`) => `ScenarioStep S-001 \"Start\"\n${edges}\nEND\nScenarioStep S-002 \"End\"\nEND\n`;

describe("diagram membership bundle authority", () => {
  it("loads optional capability and derives view choices generically", () => {
    expect(bundle.contracts.diagram_membership?.declaration_type).toBe("Diagram");
    expect(oldBundle.contracts.diagram_membership).toBeUndefined();
    const descriptor = bundle.authoring!.node_forms.by_type.Diagram!.properties[0]!;
    expect(resolveBundleFieldReference(bundle, descriptor.choices_from!)).toEqual(bundle.views.views.map((view) => view.id));
    expect(bundle.views.views.every((view) => view.projection.named_diagrams?.enabled)).toBe(true);
  });
  it("fingerprints every new artifact field through the existing canonical path", () => {
    const original = computeBundleFingerprint(bundle);
    for (const mutate of [
      (data:Bundle) => { data.contracts.diagram_membership!.references.delimiter = ";"; },
      (data:Bundle) => { data.views.views[0]!.projection.named_diagrams!.enabled = false; },
      (data:Bundle) => { data.authoring!.node_id_suggestions.prefix_by_type.Diagram = "CV"; },
      (data:Bundle) => { (data.schema.$defs as Record<string, {enum:string[]}>).nodeType!.enum.push("Canvas"); }
    ]) { const changed=structuredClone(bundle); mutate(changed); expect(computeBundleFingerprint(changed)).not.toBe(original); }
  });
  it.each([
    (b: Bundle) => { b.contracts.diagram_membership!.declaration_type = "Missing"; },
    (b: Bundle) => { b.contracts.diagram_membership!.type_property = "bad key"; },
    (b: Bundle) => { b.contracts.diagram_membership!.membership_property = b.contracts.diagram_membership!.type_property; },
    (b: Bundle) => { b.contracts.diagram_membership!.references.delimiter = ""; },
    (b: Bundle) => { (b.contracts.diagram_membership!.references as unknown as {semantics:string}).semantics = "list"; },
    (b: Bundle) => { b.views.views[0]!.projection.include_node_types.push("Diagram"); },
    (b: Bundle) => { b.contracts.relationships[0]!.allowed_endpoints.push({ from: "Diagram", to: "ScenarioStep" }); },
    (b: Bundle) => { delete b.contracts.diagram_membership; },
    (b: Bundle) => { b.authoring!.node_forms.by_type.Diagram!.properties[0]!.choices_from!.selector = "missing"; },
    (b: Bundle) => { b.contracts.common_rules.find((rule) => rule.rule_logic?.kind === "duplicate_edge_identity")!.rule_logic!.key_fields = ["from", "type", "to", "bogus"]; },
    (b: Bundle) => { b.contracts.common_rules.find((rule) => rule.rule_logic?.kind === "duplicate_edge_identity")!.rule_logic!.key_fields = []; },
    (b: Bundle) => { b.contracts.common_rules.find((rule) => rule.rule_logic?.kind === "duplicate_edge_identity")!.rule_logic!.key_fields = ["from", "type", "to", "props", "props"]; },
    (b: Bundle) => { b.contracts.common_rules.find((rule) => rule.rule_logic?.kind === "duplicate_edge_identity")!.rule_logic!.ignored_fields = ["bogus"]; },
    (b: Bundle) => { b.contracts.common_rules.find((rule) => rule.rule_logic?.kind === "duplicate_edge_identity")!.rule_logic!.ignored_fields = ["from"]; },
    (b: Bundle) => { b.contracts.common_rules.find((rule) => rule.rule_logic?.kind === "duplicate_edge_identity")!.rule_logic!.ignored_properties = [5]; },
    (b: Bundle) => { b.contracts.common_rules.find((rule) => rule.rule_logic?.kind === "duplicate_edge_identity")!.rule_logic!.ignored_properties = ["bad key"]; },
    (b: Bundle) => { b.contracts.common_rules.find((rule) => rule.rule_logic?.kind === "duplicate_edge_identity")!.rule_logic!.ignored_properties = "field"; },
  ])("rejects inconsistent descriptors and bindings (%#)", (mutate) => {
    const changed = structuredClone(bundle); mutate(changed);
    expect(collectBundleDiagnostics(changed).some((diagnostic) => diagnostic.severity === "error")).toBe(true);
  });
  it.each([
    ["key_fields", ["from", "type", "to", "unknown"]],
    ["ignored_fields", ["unknown"]],
    ["ignored_properties", [5]]
  ])("rejects invalid identity %s through the real loader", async (field, value) => {
    await expect(mutatedBundle((data) => {
      data.contracts.common_rules.find((rule) => rule.rule_logic?.kind === "duplicate_edge_identity")!.rule_logic![field as string] = value;
    })).rejects.toMatchObject({ code: "bundle.invalid", diagnostics: expect.arrayContaining([expect.objectContaining({ severity: "error" })]) });
  });
  it("validates wildcard predicate paths through the real loader while preserving empty and partial matches", async () => {
    await expect(mutatedBundle((data) => {
      data.authoring!.node_forms.by_type.Diagram!.properties[0]!.choices_from!.where!.selector = "projection.named_diagrams.missing";
    })).rejects.toMatchObject({ code: "bundle.invalid", diagnostics: expect.arrayContaining([expect.objectContaining({ code: "bundle.authoring.invalid_choices_reference", severity: "error" })]) });
    const disabled = await mutatedBundle((data) => {
      for (const view of data.views.views) view.projection.named_diagrams!.enabled = false;
    });
    expect(resolveBundleFieldReference(disabled, disabled.authoring!.node_forms.by_type.Diagram!.properties[0]!.choices_from!)).toEqual([]);
    const partial = await mutatedBundle((data) => {
      delete data.views.views[0]!.projection.named_diagrams;
    });
    expect(resolveBundleFieldReference(partial, partial.authoring!.node_forms.by_type.Diagram!.properties[0]!.choices_from!)).toEqual(partial.views.views.slice(1).map((view) => view.id));
  });
  it("loads coherent renamed conventions through parsing, forms, exact projection and rendered artifacts", async () => {
    const dir = await mkdtemp("/tmp/sdd-diagram-bundle-"); temps.push(dir);
    await cp("bundle/v0.2", dir, { recursive: true });
    for (const filename of ["core/vocab.yaml", "core/contracts.yaml", "core/authoring.yaml", "core/schema.json"]) {
      const target = path.join(dir, filename);
      let text = await readFile(target, "utf8");
      text = text.replace(/\bDiagram\b/g, "Canvas").replace(/\bdiagram_type\b/g, "canvas_kind").replace(/\bdiagrams\b/g, "canvases").replace(/\bDG\b/g, "CV");
      await writeFile(target, text);
    }
    const renamed = await loadBundle(path.join(dir, "manifest.yaml"));
    expect(renamed.authoring!.node_id_suggestions.prefix_by_type.Canvas).toBe("CV");
    expect(renamed.authoring!.node_forms.by_type.Canvas!.properties[0]!.property).toBe("canvas_kind");
    const source = `Canvas CV-001 \"Canvas\"\ncanvas_kind=scenario_flow\nEND\nScenarioStep S-001 \"Only\"\ncanvases=CV-001\nEND\n`;
    expect(resolveDiagramSelection(graph(source, renamed), renamed, {diagramId: "CV-001"}).nodes.map((node) => node.id)).toEqual(["S-001"]);
    const oldProperty = graph(source.replace("canvases=CV-001", "diagrams=CV-001"), renamed);
    expect(resolveDocumentDiagrams(oldProperty,renamed).diagrams[0]!.nodeCount).toBe(0);
    const oldTypeProperty=graph(source.replace("canvas_kind=scenario_flow","diagram_type=scenario_flow"),renamed);
    expect(resolveDocumentDiagrams(oldTypeProperty,renamed).diagnostics.some((diagnostic) => diagnostic.code==="validate.diagram_invalid_type")).toBe(true);
    expect(validateGraph(graph(source,renamed),renamed,"strict").diagnostics.some((diagnostic) => diagnostic.code.includes("id_prefix_type_coupling"))).toBe(false);
    expect(validateGraph(graph(source.replaceAll("CV-001", "DG-001"),renamed),renamed,"strict").diagnostics.some((diagnostic) => diagnostic.code.includes("id_prefix_type_coupling"))).toBe(true);
    const oldSpelling = compileSource({path:"old.sdd",text:`SDD-TEXT 0.2\n${declaration()}`}, renamed);
    expect(oldSpelling.graph).toBeUndefined();

    const renderingSource = `Canvas CV-001 "Renamed canvas"\ncanvas_kind=scenario_flow\nEND\nScenarioStep S-001 "Start"\nkind=decision\nPRECEDES S-002 {chosen branch} canvases=CV-001\nPRECEDES S-002 {excluded branch}\nEND\nScenarioStep S-002 "Finish"\nEND\nScenarioStep S-003 "Outside canvas"\nEND\n`;
    const compiled = graph(renderingSource, renamed);
    const selection = resolveDiagramSelection(compiled, renamed, {diagramId: "CV-001"});
    const projected = projectDiagram(compiled, renamed, "CV-001");
    expect(projected.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(projected.projection).toMatchObject({diagram_id: "CV-001", diagram_name: "Renamed canvas", view_id: "scenario_flow"});
    expect(projected.projection!.nodes.map((node) => node.id)).toEqual(["S-001", "S-002"]);
    expect(projected.projection!.edges).toEqual([{from: "S-001", type: "PRECEDES", to: "S-002", source_edge_id: selection.sourceEdgeIndex.idFor(selection.edges[0]!)}]);
    expect(projected.projection!.derived.edge_annotations.map((annotation) => annotation.display_label)).toEqual(["chosen branch"]);
    const input = {path: "renamed-conventions.sdd", text: `${renamed.syntax.document.version_declaration.literal} ${renamed.manifest.language_version}\n${renderingSource}`};
    for (const format of ["dot", "mermaid"] as const) {
      const rendered = renderSource(input, renamed, {viewId: "scenario_flow", diagramId: "CV-001", format, detailId: "detailed", profileId: "simple"});
      expect(rendered.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
      expect(rendered).toMatchObject({diagramId: "CV-001", diagramName: "Renamed canvas"});
      expect(rendered.text).toContain("chosen branch");
      expect(rendered.text).not.toContain("excluded branch");
      expect(rendered.text).not.toContain("Outside canvas");
      if (format === "dot") expect(rendered.text).toContain('digraph "Renamed canvas" {');
    }
    for (const format of ["svg", "png"] as const) {
      const rendered = await renderSourcePreview(input, renamed, {viewId: "scenario_flow", diagramId: "CV-001", format, detailId: "detailed", profileId: "simple"});
      expect(rendered.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
      expect(rendered).toMatchObject({diagramId: "CV-001", diagramName: "Renamed canvas"});
      expect(rendered.artifact?.format).toBe(format);
      if (rendered.artifact?.format === "svg") {
        expect(rendered.artifact.text).toContain("<title>Renamed canvas</title>");
        expect(rendered.artifact.text).toContain('data-diagram-id="CV-001"');
        expect(rendered.artifact.text).toContain("chosen branch");
        expect(rendered.artifact.text).not.toContain("excluded branch");
        expect(rendered.artifact.text).not.toContain("Outside canvas");
        const edgeIds = [...rendered.artifact.text.matchAll(/data-edge-id="([^"]+)"/g)].map((match) => match[1]);
        expect(new Set(edgeIds).size).toBe(1);
      } else if (rendered.artifact?.format === "png") {
        expect(Array.from(rendered.artifact.bytes.slice(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        expect(rendered.artifact.bytes.length).toBeGreaterThan(32);
      }
    }
  });
  it("changes the delimiter and eligibility without production convention lists", async () => {
    const changed = await mutatedBundle((data) => { data.contracts.diagram_membership!.references.delimiter = ";"; });
    const source = graph(declaration()+declaration("DG-002")+pair('"DG-002; DG-001"'), changed);
    expect(resolveDocumentDiagrams(source, changed).diagrams.map((diagram) => diagram.edgeCount)).toEqual([1,1]);
    const disabled = await mutatedBundle((data) => { data.contracts.diagram_membership!.references.delimiter = ";"; data.views.views.find((view) => view.id === "scenario_flow")!.projection.named_diagrams!.enabled = false; });
    expect(resolveDocumentDiagrams(source, disabled).diagnostics.some((diagnostic) => diagnostic.code === "validate.diagram_invalid_type")).toBe(true);
    expect(resolveBundleFieldReference(disabled,disabled.authoring!.node_forms.by_type.Diagram!.properties[0]!.choices_from!)).not.toContain("scenario_flow");
    expect(resolveDiagramSelection(source, disabled, {viewId:"scenario_flow"}).nodes).toHaveLength(2);
    const combinedInput = {path: "combined-with-disabled-named-support.sdd", text: `SDD-TEXT 0.2\n${pair("unused", "PRECEDES S-002")}`};
    const combinedText = renderSource(combinedInput, disabled, {viewId: "scenario_flow", format: "dot", profileId: "simple"});
    expect(combinedText.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(combinedText.text).toContain("Start");
    expect(combinedText.text).toContain("End");
    expect(combinedText.diagramId).toBeUndefined();
    const combinedSvg = await renderSourcePreview(combinedInput, disabled, {viewId: "scenario_flow", format: "svg", profileId: "simple"});
    expect(combinedSvg.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(combinedSvg.artifact?.format).toBe("svg");
    expect(combinedSvg.diagramId).toBeUndefined();
    const restricted = await mutatedBundle((data) => { data.views.views.find((view) => view.id === "scenario_flow")!.projection.include_edge_types = []; });
    expect(resolveDocumentDiagrams(graph(declaration()+pair()), restricted).diagnostics.some((diagnostic) => diagnostic.code === "validate.diagram_incompatible_edge")).toBe(true);
    expect(projectDiagram(graph(declaration()+pair()), restricted, "DG-001").projection).toBeUndefined();
    const restrictedNodes = await mutatedBundle((data) => {
      const view = data.views.views.find((candidate) => candidate.id === "scenario_flow")!;
      view.projection.include_node_types = [];
      // Reference descriptors must remain coherent with the narrowed primary registry.
      view.conventions.renderer_defaults!.relationship_references = [];
    });
    const assignedNode = graph(declaration()+`ScenarioStep S-001 "Explicit"\ndiagrams=DG-001\nEND\n`, restrictedNodes);
    expect(resolveDocumentDiagrams(assignedNode, restrictedNodes).diagnostics.some((diagnostic) => diagnostic.code === "validate.diagram_incompatible_node")).toBe(true);
    expect(projectDiagram(assignedNode, restrictedNodes, "DG-001").projection).toBeUndefined();
  });
  it("coherently removes capability and reports named operations as unsupported", async () => {
    const changed = await mutatedBundle((data) => {
      const descriptor = data.contracts.diagram_membership!;
      delete data.contracts.diagram_membership;
      for (const view of data.views.views) delete view.projection.named_diagrams;
      delete data.contracts.common_rules.find((rule) => rule.rule_logic?.kind === "duplicate_edge_identity")!.rule_logic!.property_exclusion_refs;
      data.contracts.common_rules = data.contracts.common_rules.filter((rule) => rule.rule_logic?.kind !== "diagram_membership");
      for (const form of Object.values(data.authoring!.node_forms.by_type)) form.properties = form.properties.filter((field) => field.property !== descriptor.membership_property && field.property !== descriptor.type_property);
    });
    // Membership-free bundles may still contain ordinary metadata vocabulary/forms.
    const source = graph(pair("unused", "PRECEDES S-002"), changed);
    expect(resolveDiagramSelection(source, changed, {diagramId:"DG-001"}).diagnostics.some((diagnostic) => diagnostic.code === "project.named_diagrams_unsupported")).toBe(true);
  });
});

describe("source multiplicity and literal membership resolution", () => {
  it.each([
    declaration().replace("END", "diagram_type=journey_map\nEND"),
    declaration()+pair("DG-001").replace('"Start"\n', '"Start"\ndiagrams=DG-001\ndiagrams=DG-001\n'),
    declaration()+pair("DG-001", "PRECEDES S-002 diagrams=DG-001 diagrams=DG-001"),
  ])("rejects reserved source duplicates before collapse (%#)", (source) => {
    const result = compileSource({path:"duplicate.sdd",text:`SDD-TEXT 0.2\n${source}`}, bundle);
    expect(result.graph).toBeUndefined();
    expect(result.diagnostics.find((diagnostic) => diagnostic.code === "compile.duplicate_reserved_property")?.span).toBeDefined();
  });
  it("preserves unrelated duplicate-property behavior", () => {
    const source = graph('ScenarioStep S-001 "One"\ndescription="first"\ndescription="last"\nEND\n');
    expect(source.nodes[0]!.props.description).toBe("last");
  });
  it("resolves forward references, sets, raw values, and additive endpoints without mutation", () => {
    const source = graph(pair('" DG-002, DG-001, DG-002 "')+declaration()+declaration("DG-002"));
    const before = JSON.stringify(source); const resolution = resolveDocumentDiagrams(source,bundle);
    expect(resolution.diagrams.map((diagram) => [diagram.nodeCount,diagram.edgeCount])).toEqual([[2,1],[2,1]]);
    expect(resolution.diagnostics.filter((diagnostic) => diagnostic.code === "validate.diagram_repeated_reference")).toHaveLength(1);
    expect(resolution.diagrams.every((diagram) => diagram.diagnostics.some((diagnostic) => diagnostic.code === "validate.diagram_repeated_reference"))).toBe(true);
    expect(source.edges[0]!.props.diagrams).toBe(" DG-002, DG-001, DG-002 ");
    expect(JSON.stringify(source)).toBe(before);
    expect(resolution.diagrams[0]!.inclusions.map((entry) => entry.reasons)).toEqual([["assigned_edge_endpoint"],["assigned_edge_endpoint"]]);
  });
  it("marks every resolved diagram from an invalid list and omits fabricated counts in public discovery", () => {
    const source = graph(declaration()+declaration("DG-002")+pair('"DG-001,DG-002,"'));
    const document=resolveDocumentDiagrams(source,bundle);
    expect(document.diagnostics.filter((diagnostic) => diagnostic.code === "validate.diagram_invalid_reference")).toHaveLength(1);
    for (const diagram of listDiagrams(source,bundle)) {
      expect(diagram.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({code:"validate.diagram_invalid_reference",severity:"error"})]));
      expect(diagram.nodeCount).toBeUndefined(); expect(diagram.edgeCount).toBeUndefined();
    }
    expect(resolveDiagramSelection(source,bundle,{diagramId:"DG-001"}).nodes).toEqual([]);
  });
  it.each(["", "DG-001,", ",DG-001", "bad", "DG-999", "S-001"])("rejects invalid memberships in every profile: %s", (reference) => {
    const source = graph(declaration()+pair(`"${reference}"`));
    for (const profile of Object.keys(bundle.profiles)) {
      const result = validateGraph(source,bundle,profile);
      expect(result.diagnostics.some((diagnostic) => diagnostic.code.startsWith("validate.diagram_") && diagnostic.severity === "error" && diagnostic.span)).toBe(true);
    }
  });
  it.each(["missing", ""])("rejects invalid Diagram types: %s", (type) => {
    const source = graph(declaration("DG-001",type || '""'));
    const resolution = resolveDocumentDiagrams(source,bundle);
    expect(resolution.diagrams[0]!.nodeCount).toBeUndefined();
    expect(resolution.diagnostics[0]!.severity).toBe("error");
  });
  it("rejects a missing Diagram type in every profile", () => {
    const source=graph(declaration().replace("diagram_type=scenario_flow\n",""));
    for (const profile of Object.keys(bundle.profiles)) expect(validateGraph(source,bundle,profile).diagnostics.some((diagnostic) => diagnostic.code==="validate.diagram_invalid_type" && diagnostic.severity==="error")).toBe(true);
  });
  it("rejects metadata nesting and incompatible assignments; empty declarations remain draft inventories", () => {
    const source = graph(declaration().replace("END", "diagrams=DG-001\nEND")+`Opportunity OP-001 "Opportunity"\ndiagrams=DG-001\nEND\n`);
    expect(resolveDocumentDiagrams(source,bundle).diagnostics.map((diagnostic) => diagnostic.code)).toEqual(expect.arrayContaining(["validate.diagram_metadata_membership","validate.diagram_incompatible_node"]));
    const empty = resolveDocumentDiagrams(graph(declaration()),bundle);
    expect(empty.diagrams[0]).toMatchObject({nodeCount:0,edgeCount:0});
    expect(empty.diagnostics[0]).toMatchObject({code:"validate.diagram_empty",severity:"warn"});
  });
  it("rejects a legal global reference as an illegal primary assignment", () => {
    const source = graph(declaration("DG-001", "journey_map")+`JourneyStep J-001 "Journey"\nREFINED_BY BP-001 diagrams=DG-001\nEND\nBlueprintStep BP-001 "Blueprint"\nEND\n`);
    expect(resolveDocumentDiagrams(source,bundle).diagnostics.some((diagnostic) => diagnostic.code === "validate.diagram_incompatible_edge")).toBe(true);
  });
  it("keeps unassigned connecting edges out and preserves global branch obligations", () => {
    const source = graph(declaration()+declaration("DG-002")+`ScenarioStep S-001 "Shared"\ndiagrams=DG-001\nPRECEDES S-002 diagrams=DG-001\nPRECEDES S-003 diagrams=DG-002\nEND\nScenarioStep S-002 "Left"\nPRECEDES S-001\nEND\nScenarioStep S-003 "Right"\nEND\n`);
    const selected = resolveDiagramSelection(source,bundle,{diagramId:"DG-001"});
    expect(selected.nodes.map((node) => node.id)).toEqual(["S-001","S-002"]);
    expect(selected.edges.map((edge) => [edge.from,edge.to])).toEqual([["S-001","S-002"]]);
    expect(resolveDiagramSelection(source,bundle,{diagramId:"DG-002"}).nodes.map((node) => node.id)).toEqual(["S-001","S-003"]);
    expect(resolveDiagramSelection(source,bundle,{viewId:"scenario_flow"}).edges).toHaveLength(3);
    expect(validateGraph(source,bundle,"strict").diagnostics.some((diagnostic) => diagnostic.code.includes("branch") && diagnostic.relatedIds?.includes("S-001"))).toBe(true);
  });
  it("allows isolated, disconnected, cyclic members without inferring a root or hierarchy", () => {
    const source=graph(declaration()+`ScenarioStep S-001 "First"\nPRECEDES S-002 diagrams=DG-001\nEND\nScenarioStep S-002 "Second"\nPRECEDES S-001 diagrams=DG-001\nEND\nScenarioStep S-003 "Isolated"\ndiagrams=DG-001\nEND\nScenarioStep S-004 "Unassigned"\nEND\n`);
    const selected=resolveDiagramSelection(source,bundle,{diagramId:"DG-001"});
    expect(selected.nodes.map((node) => node.id)).toEqual(["S-001","S-002","S-003"]);
    expect(selected.edges).toHaveLength(2);
    expect(validateGraph(source,bundle,"simple").diagnostics.some((diagnostic) => diagnostic.code.includes("precedes_cycle_policy"))).toBe(true);
  });
  it("checks each assigned type independently and permits shared compatible content", () => {
    const source=graph(declaration("DG-001","ia_place_map")+declaration("DG-002","ui_contracts")+`Place P-001 "Shared"\ndiagrams="DG-002,DG-001"\nEND\n`);
    expect(resolveDocumentDiagrams(source,bundle).diagrams.map((diagram) => diagram.nodeCount)).toEqual([1,1]);
    const incompatible=graph(declaration()+declaration("DG-002","journey_map")+`ScenarioStep S-001 "Scenario"\ndiagrams="DG-001,DG-002"\nEND\n`);
    expect(resolveDocumentDiagrams(incompatible,bundle).diagnostics.some((diagnostic) => diagnostic.code==="validate.diagram_incompatible_node" && diagnostic.relatedIds?.includes("DG-002"))).toBe(true);
  });
  it("fails unknown/conflicting selectors without fallback", () => {
    const source = graph(declaration()+pair());
    for (const options of [{diagramId:"DG-999"},{diagramId:"DG-001",viewId:"journey_map"},{}]) {
      const result = resolveDiagramSelection(source,bundle,options);
      expect(result.nodes).toEqual([]); expect(result.edges).toEqual([]); expect(result.diagnostics.some((diagnostic) => diagnostic.severity === "error")).toBe(true);
    }
  });
});

describe("semantic and source occurrence identities", () => {
  it("membership metadata does not alter meaning while guards/effects/properties do", () => {
    const source = graph(declaration()+declaration("DG-002")+pair("DG-001", "PRECEDES S-002 diagrams=DG-001\nPRECEDES S-002 diagrams=DG-002"));
    expect(source.edges).toHaveLength(2);
    expect(semanticEdgeIdentity(source.edges[0]!,bundle)).toBe(semanticEdgeIdentity(source.edges[1]!,bundle));
    expect(semanticEdgeIdentity({...source.edges[0]!,to_name:"Different hint"},bundle)).toBe(semanticEdgeIdentity(source.edges[0]!,bundle));
    expect(validateGraph(source,bundle,"simple").diagnostics.filter((diagnostic) => diagnostic.code === "validate.duplicate_edge_detection")).toHaveLength(1);
    for (const changed of [{guard:"yes"},{event:"E-001"},{effect:"save"},{props:{field:"one"}}]) {
      expect(semanticEdgeIdentity({...source.edges[0]!,...changed},bundle)).not.toBe(semanticEdgeIdentity(source.edges[0]!,bundle));
    }
    const index = createSourceEdgeIndex(source,bundle);
    expect(index.idFor(source.edges[0]!)).not.toBe(index.idFor(source.edges[1]!));
    expect(index.resolve(index.idFor(source.edges[1]!)!)).toBe(source.edges[1]);
    expect(index.resolve(index.idFor(source.edges[1]!)!,{to:"S-999"})).toBeUndefined();
    expect(index.resolve("missing")).toBeUndefined();
  });
  it("identity exclusions affect validation and semantic readers through the bundle", async () => {
    const source = graph(declaration()+declaration("DG-002")+pair("DG-001", "PRECEDES S-002 diagrams=DG-001\nPRECEDES S-002 diagrams=DG-002"));
    const changed = await mutatedBundle((data) => { delete data.contracts.common_rules.find((rule) => rule.rule_logic?.kind === "duplicate_edge_identity")!.rule_logic!.property_exclusion_refs; });
    expect(semanticEdgeIdentity(source.edges[0]!,changed)).not.toBe(semanticEdgeIdentity(source.edges[1]!,changed));
    expect(validateGraph(source,changed,"simple").diagnostics.filter((diagnostic) => diagnostic.code === "validate.duplicate_edge_detection")).toHaveLength(0);
    const originalKeys = createSemanticRelationshipReader(source,bundle).relationships.map((relationship) => relationship.identity);
    const changedKeys = createSemanticRelationshipReader(source,changed).relationships.map((relationship) => relationship.identity);
    expect(new Set(originalKeys).size).toBe(1); expect(new Set(changedKeys).size).toBe(2);
  });
  it("consumes common ignored fields without changing authored declaration data", async () => {
    const source=graph(declaration()+pair());
    const changed=await mutatedBundle((data) => {
      const logic=data.contracts.common_rules.find((rule) => rule.rule_logic?.kind === "duplicate_edge_identity")!.rule_logic!;
      logic.key_fields=[...logic.key_fields as string[], "to_name"];
    });
    expect(semanticEdgeIdentity({...source.edges[0]!,to_name:"Other target hint"},changed)).toBe(semanticEdgeIdentity(source.edges[0]!,changed));
  });
  it("source references remain stable under membership and unrelated-content changes", () => {
    const first = graph(declaration()+pair()); const second = graph(declaration()+pair("DG-001", "PRECEDES S-002")+`ScenarioStep S-003 "Unrelated"\nEND\n`);
    expect(createSourceEdgeIndex(first,bundle).idFor(first.edges[0]!)).toBe(createSourceEdgeIndex(second,bundle).idFor(second.edges[0]!));
  });
  it("old bundle arbitrary metadata keeps old semantics and named operations unsupported", () => {
    const source = graph(`Step S-001 "One"\nPRECEDES S-002 diagrams=DG-001\nPRECEDES S-002 diagrams=DG-002\nEND\nStep S-002 "Two"\nEND\n`,oldBundle);
    expect(semanticEdgeIdentity(source.edges[0]!,oldBundle)).not.toBe(semanticEdgeIdentity(source.edges[1]!,oldBundle));
    expect(resolveDocumentDiagrams(source,oldBundle).diagnostics).toEqual([]);
    expect(resolveDiagramSelection(source,oldBundle,{diagramId:"DG-001"}).diagnostics[0]!.code).toBe("project.named_diagrams_unsupported");
  });
});
