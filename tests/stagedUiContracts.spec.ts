import { mkdir, readFile, writeFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import { buildUiContractsRendererScene, renderUiContractsStagedSvg } from "../src/renderer/staged/uiContracts.js";
import { prepareCompiledGraphPreview, renderSourcePreview } from "../src/renderer/previewWorkflow.js";
import { isBatchApplicable } from "../src/renderer/prepareProjectionForRender.js";
import { assessUiContractsGeometry } from "./uiContractsB5Acceptance.js";
import { expectRendererStageSnapshot, expectRendererStageTextSnapshot } from "./rendererStageSnapshotHarness.js";

let bundle: Awaited<ReturnType<typeof loadBundle>>;
beforeAll(async () => { bundle = await loadBundle("bundle/v0.1/manifest.yaml"); });
async function artifacts(path: string, detailId = "detailed") {
  const input = { path, text: await readFile(path, "utf8") };
  const compiled = compileSource(input, bundle);
  expect(compiled.diagnostics).toEqual([]);
  const graph = compiled.graph!, view = bundle.views.views.find(view => view.id === "ui_contracts")!;
  const projection = projectView(graph, bundle, view.id).projection!;
  const rendererScene = buildUiContractsRendererScene(projection, graph, view, { detailId });
  const rendered = await renderUiContractsStagedSvg(projection, graph, view, { detailId });
  expect(assessUiContractsGeometry(rendered.positionedScene)).toEqual([]);
  return { input, graph, projection, view, rendererScene, rendered };
}

describe("public staged UI contracts B5 renderer", () => {
  for (const [fixture, name] of [
    ["bundle/v0.1/examples/place_viewstate_transition.sdd", "place-viewstate-transition"],
    ["bundle/v0.1/examples/ui_state_fallback.sdd", "ui-state-fallback"],
    ["tests/fixtures/render/ui_contracts_dense_sparse_staged.sdd", "dense-sparse"]
  ]) it(`preserves accepted complete-sheet snapshots for ${name}`, async () => {
    const { rendererScene, rendered } = await artifacts(fixture);
    expect(rendered.svg).toContain("Components without hierarchy");
    expect(rendered.svg).toContain('class="ui-contracts-container__title-band"');
    expect(rendered.svg).not.toContain('class="scene-port');
    expect(rendered.svg).not.toMatch(/marker-(?:start|end)=/);
    expect(rendererScene.root.layout.crossAlignment).toBe("start");
    if (name !== "dense-sparse") {
      await expectRendererStageSnapshot(`ui-contracts.${name}.renderer-scene.json`, rendererScene);
      await expectRendererStageSnapshot(`ui-contracts.${name}.measured-scene.json`, rendered.measuredScene);
    }
    await expectRendererStageSnapshot(`ui-contracts.${name}.positioned-scene.json`, rendered.positionedScene);
    await expectRendererStageTextSnapshot(`ui-contracts.${name}.svg`, rendered.svg);
  });

  for (const detailId of ["compact", "detailed"]) it(`renders isolated cards directly in a single enclosure / ${detailId}`, () => {
    const graph = compileSource({ path: "/tmp/isolated.sdd", text: 'SDD-TEXT 0.1\nComponent C-020 "Zulu"\nEND\nComponent C-010 "Alpha"\nEND\n' }, bundle).graph!;
    const view = structuredClone(bundle.views.views.find(view => view.id === "ui_contracts")!);
    const projection = projectView(graph, bundle, view.id).projection!;
    view.conventions.renderer_defaults!.ui_contracts_presentation!.labels.isolated_components = "Uncontained cards";
    const scene = buildUiContractsRendererScene(projection, graph, view, { detailId });
    expect(scene.diagnostics).toEqual([]);
    expect(scene.edges).toEqual([]);
    expect(scene.root.children).toHaveLength(1);
    const group = scene.root.children[0];
    expect(group.kind).toBe("container");
    if (group.kind !== "container") throw new Error("Missing shared enclosure");
    expect(group.viewMetadata?.uiContracts?.title).toBe("Uncontained cards");
    expect(group.children.map(child => child.kind)).toEqual(["node", "node"]);
    expect(group.children.map(child => child.id)).toEqual([
      expect.stringContaining("C-020"), expect.stringContaining("C-010")
    ]);
  });

  it("uses staged coverage for structural compact diagrams while preserving legacy preparation", () => {
    const input = { path: "/tmp/structure.sdd", text: 'SDD-TEXT 0.1\nComponent C-100 "Parent"\n  CONTAINS C-101 "Child"\nEND\nComponent C-101 "Child"\nEND\n' };
    const graph = compileSource(input, bundle).graph!;
    const options = { viewId: "ui_contracts", format: "svg" as const, profileId: "simple", detailId: "compact" };
    const staged = prepareCompiledGraphPreview(input.path, graph, bundle, options);
    expect(staged.prepared!.visibleSemanticNodeIds).toEqual(["C-100", "C-101"]);
    expect(staged.prepared!.presentationModel!.overview).toHaveLength(1);
    expect(isBatchApplicable(staged.view, staged.prepared!)).toBe(true);
    const legacy = prepareCompiledGraphPreview(input.path, graph, bundle, { ...options, backendId: "legacy_graphviz_preview" });
    expect(legacy.prepared!.presentationModel).toBeUndefined();
  });

  it("omits only empty Place scopes in compact detail and retains the coverage note", async () => {
    const { rendererScene, rendered, graph, view } = await artifacts("tests/fixtures/render/ui_contracts_empty_places.sdd", "compact");
    expect(rendererScene.root.children.filter(node => node.id.startsWith("scope:P-")).map(node => node.id)).toEqual(["scope:P-100", "scope:P-210", "scope:P-220"]);
    expect(rendered.svg).toContain("Components without hierarchy");
    expect(rendered.svg).not.toContain("Behavior Details");
    const prepared = prepareCompiledGraphPreview("/tmp/empty.sdd", graph, bundle, { viewId: view.id, format: "svg", profileId: "simple", detailId: "compact" });
    expect(prepared.prepared!.notes).toEqual(["Omitted empty ui_contracts containers in compact detail: Behavior Details, Dataset Details, Projects by Period."]);
  });

  it("changes native output from bundle-only relationship, attribute and visibility selections", async () => {
    const graph = compileSource({ path: "/tmp/policy.sdd", text: 'SDD-TEXT 0.1\nComponent C-100 "Parent"\n  description="Original description"\n  responsibility="Selected purpose"\n  CONTAINS C-101 "Child"\nEND\nComponent C-101 "Child"\nEND\n' }, bundle).graph!;
    const view = structuredClone(bundle.views.views.find(view => view.id === "ui_contracts")!);
    const projection = projectView(graph, bundle, view.id).projection!;
    const config = view.conventions.renderer_defaults!.ui_contracts_presentation!;
    config.relationships.find(rule => rule.kind === "containment")!.label = "Includes";
    config.content.component[0] = { property: "responsibility", label: "Purpose", visible_when: "show_component_description" };
    let result = await renderUiContractsStagedSvg(projection, graph, view, { detailId: "detailed" });
    expect(assessUiContractsGeometry(result.positionedScene)).toEqual([]);
    expect(result.svg).toContain("Includes");
    expect(result.svg).toContain("Selected purpose");
    expect(result.svg).not.toContain("Original description");
    (view.conventions.renderer_defaults!.detail_display as Record<string, Record<string, boolean>>).detailed.show_component_hierarchy = false;
    result = await renderUiContractsStagedSvg(projection, graph, view, { detailId: "detailed" });
    expect(result.svg).not.toContain("Component hierarchy");
    expect(result.positionedScene.edges).toEqual([]);
    expect(result.svg).toContain("Component scope · Parent");
  });

  it("uses the bundle decorator fallback when the caller omits decorators", async () => {
    const custom = structuredClone(bundle);
    custom.manifest.tool_defaults.node_decorator_mode_id = "type,id";
    const input = { path: "/tmp/decorators.sdd", text: 'SDD-TEXT 0.1\nComponent C-100 "Visible"\nEND\n' };
    const result = await renderSourcePreview(input, custom, { viewId: "ui_contracts", format: "svg", detailId: "compact" });
    expect(result.artifact?.format).toBe("svg");
    if (result.artifact?.format !== "svg") throw new Error("Missing SVG");
    expect(result.artifact.text).toContain('>Component</tspan>');
    expect(result.artifact.text).toContain('>C-100</tspan>');
  });

  for (const detailId of ["compact", "detailed"]) for (const nodeDecoratorModeId of ["none", "type", "id", "type,id"]) it(`public preview ${detailId} / ${nodeDecoratorModeId}`, async () => {
    const input = { path: "docs/hierarchical_ui_contracts/departure_desk.sdd", text: await readFile("docs/hierarchical_ui_contracts/departure_desk.sdd", "utf8") };
    const result = await renderSourcePreview(input, bundle, { viewId: "ui_contracts", format: "svg", profileId: "simple", detailId, nodeDecoratorModeId });
    // The unchanged fixture deliberately reuses C-430 under two parents; the
    // existing validator reports that recommendation independently of rendering.
    expect(result.diagnostics.map(diagnostic => diagnostic.code)).toEqual(["validate.contains_single_parent_recommended"]);
    expect(result.diagnostics[0].severity).toBe("warn");
    expect(result.previewCapability.backendId).toBe("staged_ui_contracts_preview");
    expect(result.artifact?.format).toBe("svg");
    if (result.artifact?.format !== "svg") throw new Error("Missing staged SVG");
    const svg = result.artifact.text;
    expect(svg).toContain("Components without hierarchy");
    expect(svg).not.toContain("Component hierarchy · Crew Note");
    const graph = compileSource(input, bundle).graph!;
    const view = bundle.views.views.find(view => view.id === "ui_contracts")!;
    const scene = buildUiContractsRendererScene(projectView(graph, bundle, view.id).projection!, graph, view, { detailId });
    expect(scene.diagnostics.filter(d => d.severity === "error")).toEqual([]);
    const groupIndex = scene.root.children.findIndex(item => item.id === "components-without-containment");
    expect(groupIndex).toBe(1);
    expect(scene.root.children[groupIndex + 1].id).toMatch(/^scope:P-/);
    expect(svg).toContain("H1 · Repeated hierarchy");
    expect(svg).toContain("H1 · See Cargo Sheet");
    const decoratorText = [...svg.matchAll(/<text[^>]*shared-node__decorator-item[^>]*>([\s\S]*?)<\/text>/g)].map(match => match[1]);
    expect(decoratorText.some(text => text.includes(">Component</tspan>"))).toBe(nodeDecoratorModeId.includes("type"));
    expect(decoratorText.some(text => text.includes(">C-430</tspan>"))).toBe(nodeDecoratorModeId.includes("id"));
    expect(svg.includes("Referenced targets")).toBe(detailId === "detailed");
    await mkdir("/tmp/sdd-b5-public", { recursive: true });
    await writeFile(`/tmp/sdd-b5-public/departure_desk.${detailId}.${nodeDecoratorModeId.replace(",", "-")}.svg`, svg);
  });
});
