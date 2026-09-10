import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { BundleValidationError, collectBundleDiagnostics, compileSource, loadBundle, validateLoadedBundle } from "../src/index.js";
import type { Bundle, ViewSpec } from "../src/bundle/types.js";
import { projectView } from "../src/projector/projectView.js";
import { buildUiContractsPresentationModel, type UiContractsHierarchy } from "../src/renderer/uiContractsPresentationModel.js";
import { prepareProjectionForRender } from "../src/renderer/prepareProjectionForRender.js";

let bundle: Bundle, source: string, view: ViewSpec;
beforeAll(async () => {
  bundle = await loadBundle("bundle/v0.1/manifest.yaml");
  view = bundle.views.views.find(view => view.id === "ui_contracts")!;
  source = await readFile("docs/hierarchical_ui_contracts/departure_desk.sdd", "utf8");
});
function model(text = source, detail = "detailed", spec = view) {
  const compiled = compileSource({ path: "/tmp/presentation.sdd", text }, bundle);
  expect(compiled.diagnostics).toEqual([]);
  const projected = projectView(compiled.graph!, bundle, "ui_contracts");
  expect(projected.diagnostics).toEqual([]);
  const projection = projected.projection!, before = structuredClone(projection);
  const result = buildUiContractsPresentationModel(projection, compiled.graph!, spec, detail);
  expect(projection).toEqual(before);
  return result;
}
const walk = (item: UiContractsHierarchy): UiContractsHierarchy[] => [item, ...item.children.flatMap(walk)];

describe("bundle-driven UI contracts presentation", () => {
  it("preserves the complete fixture's identity and relationship sets", () => {
    const detailed = model(), compact = model(source, "compact");
    expect(detailed.diagnostics).toEqual([]);
    expect(compact.diagnostics).toEqual([]);
    expect(detailed.visibleSemanticNodeIds).toHaveLength(51);
    expect(detailed.relationships).toHaveLength(45);
    expect(compact.visibleSemanticNodeIds).toHaveLength(17);
    expect(compact.relationships).toHaveLength(24);
    expect(new Set(detailed.occurrences.map(node => node.semanticId))).toEqual(new Set(detailed.visibleSemanticNodeIds));
    expect(new Set(compact.occurrences.map(node => node.semanticId))).toEqual(new Set(compact.visibleSemanticNodeIds));
    expect(compact.overview).toEqual(detailed.overview);
    expect(compact.isolatedComponents).toEqual(detailed.isolatedComponents);
    expect(compact.isolatedComponents.nodes.map(node => node.semanticId)).toEqual(["C-460"]);
    expect(detailed.occurrences.map(node => node.id).length).toBe(new Set(detailed.occurrences.map(node => node.id)).size);
  });

  it("groups isolated components in authored order while preserving composition and scopes", () => {
    const text = `SDD-TEXT 0.1
Component C-020 "Zulu"
END
Component C-010 "Alpha"
END
Place P-001 "Page"
  COMPOSED_OF C-010 "Alpha"
END
`;
    for (const detail of ["compact", "detailed"]) {
      const result = model(text, detail);
      expect(result.overview).toEqual([]);
      expect(result.isolatedComponents.nodes.map(node => node.semanticId)).toEqual(["C-020", "C-010"]);
      expect(result.isolatedComponents.title).toBe("Components without hierarchy");
      expect(result.scopes.map(scope => scope.focal.semanticId)).toEqual(["P-001"]);
      expect(result.scopes[0].compositions[0].targets[0].semanticId).toBe("C-010");
      expect(new Set(result.occurrences.map(node => node.semanticId))).toEqual(new Set(result.visibleSemanticNodeIds));
    }
    expect(model('SDD-TEXT 0.1\nComponent C-001 "Parent"\n  CONTAINS C-002 "Child"\nEND\nComponent C-002 "Child"\nEND\n').isolatedComponents.nodes).toEqual([]);
    const spec = structuredClone(view), config = spec.conventions.renderer_defaults!.ui_contracts_presentation!;
    config.labels.isolated_components = "Uncontained cards";
    expect(model(text, "compact", spec).isolatedComponents.title).toBe("Uncontained cards");
    config.hierarchy.isolated_components = "individual_roots";
    expect(model(text, "compact", spec).overview).toHaveLength(2);
    expect(model(text, "compact", spec).isolatedComponents.nodes).toEqual([]);
    config.hierarchy.isolated_components = "grouped";
    config.relationships.find(rule => rule.kind === "containment")!.edge_type = "COMPOSED_OF";
    const reselected = model('SDD-TEXT 0.1\nComponent C-001 "Parent"\n  CONTAINS C-002 "Child"\nEND\nComponent C-002 "Child"\nEND\n', "compact", spec);
    expect(reselected.isolatedComponents.nodes.map(node => node.semanticId)).toEqual(["C-001", "C-002"]);
    expect(reselected.overview).toEqual([]);
  });

  it("requires the isolated-component bundle policy and caption", () => {
    for (const field of ["policy", "caption"]) {
      const cloned = structuredClone(bundle);
      const config = cloned.views.views.find(view => view.id === "ui_contracts")!.conventions.renderer_defaults!.ui_contracts_presentation!;
      if (field === "policy") delete (config.hierarchy as Partial<typeof config.hierarchy>).isolated_components;
      else delete (config.labels as Partial<typeof config.labels>).isolated_components;
      expect(() => validateLoadedBundle(cloned)).toThrow(BundleValidationError);
    }
  });

  it("expands H1 once and retains both immediate parents and the child", () => {
    const result = model(), hierarchy = result.overview.flatMap(walk);
    expect(result.overview.map(item => item.node.semanticId)).toEqual(["C-410"]);
    const seals = hierarchy.filter(item => item.node.semanticId === "C-430");
    expect(seals).toHaveLength(2);
    expect(seals[0].locator).toBe("H1");
    expect(seals[0].node.path).toEqual(["C-410", "C-420"]);
    expect(seals[0].children[0].node.semanticId).toBe("C-431");
    expect(seals[1].referenceTo).toBe(seals[0].id);
    expect(seals[1].title).toBe("H1 · See Cargo Sheet");
    expect(seals[1].children).toEqual([]);
    const scope = result.scopes.find(scope => scope.focal.semanticId === "C-430")!;
    expect(scope.parents.map(node => node.semanticId)).toEqual(["C-420", "C-470"]);
    expect(scope.children.map(node => node.semanticId)).toEqual(["C-431"]);
    expect(scope.focal.attributes.map(attribute => attribute.groupId)).toEqual(["description", "inputs", "outputs"]);
    expect(scope.parents.every(node => node.attributes.length === 0)).toBe(true);
  });

  it("delivers declared Place metadata and keeps trigger/guard/effect text when support nodes are hidden", () => {
    const compact = model(source, "compact"), detailed = model();
    const place = detailed.scopes.find(scope => scope.focal.semanticId === "P-410")!;
    expect(place.focal.attributes.map(attribute => attribute.groupId)).toEqual(["route_or_key", "access", "entry_points", "primary_nav"]);
    expect(place.description).toBeTruthy();
    expect(compact.scopes.find(scope => scope.focal.semanticId === "P-410")!.focal.attributes.map(a => a.groupId)).toEqual(["primary_nav"]);
    expect(compact.relationships.find(edge => edge.from === "VS-410a" && edge.to === "VS-410b")?.label).toBe("[Release load] {seal_valid} / SA-440");
    expect(compact.register.nodes).toEqual([]);
  });

  it("honors bundle-only label, attribute, endpoint-selector, and visibility mutations", () => {
    const spec = structuredClone(view), config = spec.conventions.renderer_defaults!.ui_contracts_presentation!;
    config.relationships.find(rule => rule.kind === "containment")!.label = "Includes";
    config.content.component[0] = { property: "responsibilities", label: "Responsibility", visible_when: "show_component_description" };
    let result = model(source, "detailed", spec);
    expect(result.relationships.filter(edge => edge.kind === "containment").every(edge => edge.label === "Includes")).toBe(true);
    expect(result.scopes.find(scope => scope.focal.semanticId === "C-430")!.focal.attributes.some(a => a.groupId === "description")).toBe(false);
    const policies = spec.conventions.renderer_defaults!.detail_display as Record<string, Record<string, boolean>>;
    policies.detailed.show_component_hierarchy = false;
    result = model(source, "detailed", spec);
    expect(result.overview).toEqual([]);
    expect(result.isolatedComponents.nodes).toEqual([]);
    expect(result.scopes.every(scope => scope.parents.length === 0 && scope.children.length === 0)).toBe(true);
    config.relationships.find(rule => rule.kind === "composition")!.from = ["Component"];
    expect(model(source, "detailed", spec).scopes.every(scope => scope.compositions.length === 0)).toBe(true);
  });

  it("rejects missing presentation configuration and missing detail switches at bundle load validation", () => {
    const cloned = structuredClone(bundle), spec = cloned.views.views.find(view => view.id === "ui_contracts")!;
    delete spec.conventions.renderer_defaults!.ui_contracts_presentation;
    expect(() => validateLoadedBundle(cloned)).toThrow(BundleValidationError);
    expect(collectBundleDiagnostics(cloned).some(d => d.message.includes("ui_contracts_presentation"))).toBe(true);
    spec.conventions.renderer_defaults!.ui_contracts_presentation = structuredClone(view.conventions.renderer_defaults!.ui_contracts_presentation);
    delete (spec.conventions.renderer_defaults!.detail_display as Record<string, Record<string, boolean>>).compact.show_component_hierarchy;
    expect(() => validateLoadedBundle(cloned)).toThrow(BundleValidationError);
    expect(collectBundleDiagnostics(cloned).some(d => d.message.includes("show_component_hierarchy"))).toBe(true);
  });

  it("keeps State-only fallback and suppresses structure-only compact scopes", async () => {
    const text = await readFile("bundle/v0.1/examples/ui_state_fallback.sdd", "utf8");
    const compact = model(text, "compact");
    expect(compact.scopes.some(scope => scope.sequences.length)).toBe(true);
    expect(compact.register.nodes.length).toBeGreaterThan(0);
    const structure = model('SDD-TEXT 0.1\nComponent C-001 "Parent"\n  CONTAINS C-002 "Child"\nEND\nComponent C-002 "Child"\nEND\n', "compact");
    expect(structure.scopes).toEqual([]);
    expect(structure.overview[0].children[0].node.semanticId).toBe("C-002");
  });

  it("suppresses isolated, chain, and sibling scopes without stale occurrences or lost containment", () => {
    const result = model(`SDD-TEXT 0.1
Component C-001 "Root"
  CONTAINS C-002 "Branch"
  CONTAINS C-003 "Sibling"
END
Component C-002 "Branch"
  CONTAINS C-004 "Leaf"
END
Component C-003 "Sibling"
END
Component C-004 "Leaf"
END
Component C-005 "Isolated"
END
`);
    expect(result.scopes).toEqual([]);
    expect(result.occurrences.every(node => ["overview", "components-without-containment"].includes(node.scopeId))).toBe(true);
    expect(new Set(result.occurrences.map(node => node.semanticId))).toEqual(new Set(result.visibleSemanticNodeIds));
    const hierarchy = result.overview.flatMap(walk);
    for (const edge of result.relationships) {
      expect(result.structuralRelationshipIds).toContain(edge.id);
      expect(hierarchy.some(item => item.node.semanticId === edge.from
        && item.children.some(child => child.node.semanticId === edge.to))).toBe(true);
    }
    expect(result.omissions).toEqual([]);
    expect(result.notes).toEqual([]);
  });

  it("retains reused leaves with multiple parents", () => {
    const result = model(`SDD-TEXT 0.1
Component C-001 "One"
  CONTAINS C-003 "Shared"
END
Component C-002 "Two"
  CONTAINS C-003 "Shared"
END
Component C-003 "Shared"
END
`, "compact");
    expect(result.scopes.map(scope => scope.focal.semanticId)).toEqual(["C-003"]);
    expect(result.scopes[0].parents.map(node => node.semanticId)).toEqual(["C-001", "C-002"]);
  });

  it("uses selected attributes and contracts rather than detail names to retain scopes", () => {
    const text = `SDD-TEXT 0.1
Place P-001 "Page"
  CONTAINS VS-001 "View"
END
ViewState VS-001 "View"
  place_id=P-001
END
Component C-001 "Attributed"
  description="Useful context"
END
Component C-002 "Contract"
  BINDS_TO D-001 "Data"
END
DataEntity D-001 "Data"
END
`;
    expect(model(text, "compact").scopes.filter(scope => scope.kind === "component")).toEqual([]);
    expect(model(text).scopes.filter(scope => scope.kind === "component").map(scope => scope.focal.semanticId)).toEqual(["C-001", "C-002"]);
    const spec = structuredClone(view);
    const policies = spec.conventions.renderer_defaults!.detail_display as Record<string, Record<string, boolean>>;
    policies.compact.show_component_description = true;
    expect(model(text, "compact", spec).scopes.filter(scope => scope.kind === "component").map(scope => scope.focal.semanticId)).toEqual(["C-001"]);
  });

  it("retains a single visible State even without transitions", () => {
    const result = model(`SDD-TEXT 0.1
Component C-001 "Owner"
END
State ST-001 "Ready"
  scope_id=C-001
END
`, "compact");
    expect(result.scopes).toHaveLength(1);
    expect(result.scopes[0].sequences[0].nodes.map(node => node.semanticId)).toEqual(["ST-001"]);
    expect(result.scopes[0].sequences[0].edges).toEqual([]);
  });

  it("retains structure-only scopes when overview visibility is disabled", () => {
    const spec = structuredClone(view);
    const policies = spec.conventions.renderer_defaults!.detail_display as Record<string, Record<string, boolean>>;
    policies.detailed.show_component_hierarchy = false;
    const result = model('SDD-TEXT 0.1\nComponent C-001 "Isolated"\nEND\n', "detailed", spec);
    expect(result.overview).toEqual([]);
    expect(result.scopes.map(scope => scope.focal.semanticId)).toEqual(["C-001"]);
    expect(result.structuralRelationshipIds).toEqual([]);
  });

  it("reports cycles even when there are no hierarchy roots", () => {
    const result = model('SDD-TEXT 0.1\nComponent C-001 "One"\n  CONTAINS C-002 "Two"\nEND\nComponent C-002 "Two"\n  CONTAINS C-001 "One"\nEND\n');
    expect(result.diagnostics.some(diagnostic => diagnostic.code === "renderer.scene.ui_contracts_containment_cycle" && diagnostic.severity === "error")).toBe(true);
    expect(result.overview).toEqual([]);
    expect(result.structuralRelationshipIds).toEqual([]);
    expect(result.scopes).toHaveLength(2);
  });

  it("keeps legacy preparation as the default while exposing staged preparation explicitly", () => {
    const compiled = compileSource({ path: "/tmp/input.sdd", text: source }, bundle);
    const projection = projectView(compiled.graph!, bundle, "ui_contracts").projection!;
    const legacy = prepareProjectionForRender(view, projection, compiled.graph!, "compact");
    expect(legacy.presentationModel).toBeUndefined();
    const staged = prepareProjectionForRender(view, projection, compiled.graph!, "compact", "staged");
    expect(staged.presentationModel).toBeDefined();
    expect(staged.visibleSemanticNodeIds).toHaveLength(17);
  });
});
