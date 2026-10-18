import { mkdir, readFile, writeFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import { buildUiContractsRendererScene, renderUiContractsStagedSvg, renderUiContractsStagedPng } from "../src/renderer/staged/uiContracts.js";
import type { PositionedContainer, PositionedItem, RendererScene } from "../src/renderer/staged/contracts.js";
import { measureRendererScene } from "../src/renderer/staged/microLayout.js";
import { positionMeasuredScene } from "../src/renderer/staged/macroLayout.js";
import { prepareCompiledGraphPreview, renderSourcePreview } from "../src/renderer/previewWorkflow.js";
import { isBatchApplicable } from "../src/renderer/prepareProjectionForRender.js";
import { assessUiContractsGeometry } from "./uiContractsB5Acceptance.js";
import { expectRendererStageSnapshot, expectRendererStageTextSnapshot } from "./rendererStageSnapshotHarness.js";

// These explicit scene lenses test shared packing before any routing policy.
// Public SVG/PNG acceptance remains exercised through the production coordinator.
async function layoutPackingScene(scene: RendererScene) {
  const measuredScene = measureRendererScene(scene);
  return { rendererScene: scene, measuredScene, positionedScene: await positionMeasuredScene(measuredScene) };
}

let bundle: Awaited<ReturnType<typeof loadBundle>>;
beforeAll(async () => { bundle = await loadBundle("bundle/v0.1/manifest.yaml"); });
async function artifacts(path: string, detailId = "detailed", activeBundle = bundle) {
  const input = { path, text: await readFile(path, "utf8") };
  const compiled = compileSource(input, activeBundle);
  expect(compiled.diagnostics).toEqual([]);
  const graph = compiled.graph!, view = activeBundle.views.views.find(view => view.id === "ui_contracts")!;
  const projection = projectView(graph, activeBundle, view.id).projection!;
  const rendererScene = buildUiContractsRendererScene(projection, graph, view, { detailId });
  const rendered = await renderUiContractsStagedSvg(projection, graph, view, { detailId });
  expect(assessUiContractsGeometry(rendered.positionedScene)).toEqual([]);
  return { input, graph, projection, view, rendererScene, rendered };
}

function section(children: PositionedItem[], id: string): PositionedContainer {
  const group = children.find(child => child.id === id);
  if (group?.kind !== "container") throw new Error(`Missing section ${id}`);
  return group;
}

function rows(group: PositionedContainer) {
  return [...new Set(group.children.map(child => child.y))].map(y => group.children.filter(child => child.y === y));
}

function expectFitted(group: PositionedContainer) {
  const titleMinimum = Math.max(0, ...group.headerContent.map(block => block.x + block.width + group.chrome.padding.right));
  const contentMinimum = Math.max(...group.children.map(card => card.x + card.width)) - group.x + group.chrome.padding.right;
  expect(group.width).toBeCloseTo(Math.max(titleMinimum, contentMinimum), 3);
}

describe("public staged UI contracts B5 renderer", () => {
  for (const detailId of ["compact", "detailed"]) it(`packs thirteen components without hierarchy in source-ordered natural-size rows / ${detailId}`, async () => {
    const currentBundle = await loadBundle("bundle/v0.2/manifest.yaml");
    const { rendered, rendererScene } = await artifacts("tests/fixtures/render/ui_contracts_horizontal.sdd", detailId, currentBundle);
    const group = section(rendered.positionedScene.root.children, "components-without-containment");
    expect(group.children).toHaveLength(13);
    expect(rows(group).map(row => row.length)).toEqual([2, 2, 2, 2, 2, 2, 1]);
    const measured = rendered.measuredScene.root.children.find(child => child.id === group.id);
    if (measured?.kind !== "container") throw new Error("Missing measured components");
    expect(group.children.map(({ id, width, height }) => ({ id, width, height })))
      .toEqual(measured.children.map(({ id, width, height }) => ({ id, width, height })));
    expectFitted(group);
    const beforeFitScene = structuredClone(rendererScene);
    for (const child of beforeFitScene.root.children) if (child.kind === "container" && child.layout.pack?.fitContent) {
      child.layout.pack.fitContent = false;
    }
    const beforeFit = await layoutPackingScene(beforeFitScene);
    const afterFit = await layoutPackingScene(rendererScene);
    for (const child of afterFit.positionedScene.root.children) if (child.kind === "container" && child.layout.pack?.fitContent) {
      const previous = section(beforeFit.positionedScene.root.children, child.id);
      expect(child.children).toEqual(previous.children);
      expect(child.height).toBe(previous.height);
      expect(child.width).toBeLessThan(previous.width);
      expectFitted(child);
    }
    if (detailId === "detailed") expect(rows(section(rendered.positionedScene.root.children, "target-register")).map(row => row.length)).toEqual([2, 2, 2]);
    else expect(rendered.positionedScene.root.children.some(child => child.id === "target-register")).toBe(false);
  });

  it("uses a wide target title before wrapping without widening the components section", async () => {
    const currentBundle = await loadBundle("bundle/v0.2/manifest.yaml");
    const { graph, projection, view, rendered } = await artifacts("tests/fixtures/render/ui_contracts_horizontal.sdd", "detailed", currentBundle);
    const wideView = structuredClone(view);
    wideView.conventions.renderer_defaults!.ui_contracts_presentation!.labels.target_register =
      "Referenced targets · Help Center search, article delivery, feedback collection, and external service contracts used across all supported regions, including follow-up notifications and asynchronous search indexing";
    const wide = await renderUiContractsStagedSvg(projection, graph, wideView, { detailId: "detailed" });
    expect(assessUiContractsGeometry(wide.positionedScene)).toEqual([]);
    expect(section(wide.positionedScene.root.children, "components-without-containment"))
      .toEqual(section(rendered.positionedScene.root.children, "components-without-containment"));
    const targets = section(wide.positionedScene.root.children, "target-register");
    expect(rows(targets).map(row => row.length)).toEqual([4, 2]);
    expectFitted(targets);
    const repeated = await renderUiContractsStagedSvg(projection, graph, wideView, { detailId: "detailed" });
    expect(repeated.svg).toBe(wide.svg);
    expect(repeated.positionedScene).toEqual(wide.positionedScene);
  });

  for (const version of ["v0.1", "v0.2"]) for (const detailId of ["compact", "detailed"]) {
    for (const count of [0, 1, 2]) it(`preserves cardinality, detail visibility and projection / ${version} / ${detailId} / ${count}`, async () => {
      const activeBundle = await loadBundle(`bundle/${version}/manifest.yaml`);
      const fixture = await readFile("tests/fixtures/render/ui_contracts_horizontal.sdd", "utf8");
      let seen = 0;
      const text = fixture.replace("SDD-TEXT 0.2", `SDD-TEXT ${version.slice(1)}`)
        .replace(/^Component C-8\d\d[^]*?^END\n/gm, block => seen++ < count ? block : "");
      const graph = compileSource({ path: "/tmp/horizontal-cardinality.sdd", text }, activeBundle).graph!;
      const view = activeBundle.views.views.find(candidate => candidate.id === "ui_contracts")!;
      const projection = projectView(graph, activeBundle, view.id).projection!;
      const beforeProjection = structuredClone(projection);
      const rendered = await renderUiContractsStagedSvg(projection, graph, view, { detailId });
      expect(assessUiContractsGeometry(rendered.positionedScene)).toEqual([]);
      expect(projection).toEqual(beforeProjection);
      const group = rendered.positionedScene.root.children.find(child => child.id === "components-without-containment");
      if (count === 0) expect(group).toBeUndefined();
      else {
        if (group?.kind !== "container") throw new Error("Missing components without hierarchy");
        expect(rows(group).map(row => row.length)).toEqual([count]);
        if (count === 1) {
          expect(group.layout.pack).toBeUndefined();
          const measured = rendered.measuredScene.root.children.find(child => child.id === group.id)!;
          expect([group.width, group.height]).toEqual([measured.width, measured.height]);
        } else expectFitted(group);
      }
      const target = rendered.positionedScene.root.children.find(child => child.id === "target-register");
      if (detailId === "compact") expect(target).toBeUndefined();
      else {
        if (target?.kind !== "container") throw new Error("Missing targets");
        expect(target.layout.pack?.fitContent).toBe(true);
        expectFitted(target);
      }
    });
  }

  for (const detailId of ["compact", "detailed"]) it(`uses own minima in a synthetic scene with ordinary scopes omitted / ${detailId}`, async () => {
    const currentBundle = await loadBundle("bundle/v0.2/manifest.yaml");
    const fixture = await readFile("tests/fixtures/render/ui_contracts_horizontal.sdd", "utf8");
    const components = fixture.match(/^Component C-8\d\d[^]*?^END\n/gm)!.slice(0, 6).join("\n");
    const view = currentBundle.views.views.find(candidate => candidate.id === "ui_contracts")!;
    for (const withTargets of [false, true]) {
      const text = `SDD-TEXT 0.2\n${components}\n${withTargets ? 'Event E-800 "Search requested"\nEND\n' : ""}`;
      const graph = compileSource({ path: "/tmp/horizontal-only.sdd", text }, currentBundle).graph!;
      const projection = projectView(graph, currentBundle, view.id).projection!;
      const normal = buildUiContractsRendererScene(projection, graph, view, { detailId });
      expect(normal.root.children.some(child => child.id.startsWith("scope:"))).toBe(detailId === "detailed");
      const synthetic = structuredClone(normal);
      // Only this explicit fixture lens removes ordinary scopes; production visibility stays intact.
      synthetic.root.children = synthetic.root.children.filter(child => !child.id.startsWith("scope:"));
      synthetic.root.layout.pack = undefined;
      const baseline = await layoutPackingScene(synthetic);
      expect(assessUiContractsGeometry(baseline.positionedScene)).toEqual([]);
      const group = section(baseline.positionedScene.root.children, "components-without-containment");
      expect(rows(group).map(row => row.length)).toEqual([1, 1, 1, 1, 1, 1]);
      expectFitted(group);
      const componentScene = synthetic.root.children.find(child => child.id === group.id)!;
      componentScene.viewMetadata!.uiContracts!.title =
        "Components without hierarchy · Help Center search, article delivery, feedback collection, and external service contracts used across all supported regions, including follow-up notifications and asynchronous search indexing";
      const wide = await layoutPackingScene(synthetic);
      expect(assessUiContractsGeometry(wide.positionedScene)).toEqual([]);
      const widened = section(wide.positionedScene.root.children, group.id);
      expect(rows(widened)[0].length).toBeGreaterThan(1);
      expectFitted(widened);
      if (withTargets && detailId === "detailed") {
        const beforeTarget = section(baseline.positionedScene.root.children, "target-register");
        const afterTarget = section(wide.positionedScene.root.children, "target-register");
        expect(afterTarget.width).toBe(beforeTarget.width);
        expect(afterTarget.children.map(child => [child.id, child.x - afterTarget.x, child.y - afterTarget.y, child.width, child.height]))
          .toEqual(beforeTarget.children.map(child => [child.id, child.x - beforeTarget.x, child.y - beforeTarget.y, child.width, child.height]));
      }
    }
  });

  for (const detailId of ["compact", "detailed"]) it(`exports deterministic SVG and its derived PNG with matching bounds / ${detailId}`, async () => {
    const currentBundle = await loadBundle("bundle/v0.2/manifest.yaml");
    const { graph, projection, view, rendered } = await artifacts("tests/fixtures/render/ui_contracts_horizontal.sdd", detailId, currentBundle);
    const png = await renderUiContractsStagedPng(projection, graph, view, { detailId });
    expect(png.svg).toBe(rendered.svg);
    expect(png.positionedScene).toEqual(rendered.positionedScene);
    expect(png.diagnostics).toEqual([]);
    const bytes = Buffer.from(png.png);
    expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const [width, height] = [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
    expect(Math.abs(width - rendered.positionedScene.root.width)).toBeLessThan(1);
    expect(Math.abs(height - rendered.positionedScene.root.height)).toBeLessThan(1);
  });
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
    expect(scene.root.children).toHaveLength(detailId === "compact" ? 1 : 3);
    const group = scene.root.children.find(child => child.id === "components-without-containment")!;
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

  it("packs referenced targets across the widest positioned section in source order", async () => {
    const { graph, projection, view, rendererScene, rendered } = await artifacts("bundle/v0.1/examples/departure_desk.sdd");
    const root = rendered.positionedScene.root;
    const register = root.children.find(child => child.id === "target-register")!;
    if (register.kind !== "container") throw new Error("Missing target register");
    const expectedOrder = rendererScene.root.children.find(child => child.id === "target-register");
    if (!expectedOrder || expectedOrder.kind !== "container") throw new Error("Missing register scene");
    expect(register.children.map(child => child.id)).toEqual(expectedOrder.children.map(child => child.id));
    expect(register.children).toHaveLength(19);
    expectFitted(register);
    expect(register.width).toBeLessThan(Math.max(...root.children.filter(child => child.id !== register.id).map(child => child.width)));
    expect(new Set(register.children.map(child => child.y)).size).toBeGreaterThan(1);
    expect(register.children.some((child, index) => index > 0 && child.y === register.children[index - 1].y)).toBe(true);
    for (const [index, child] of register.children.entries()) {
      expect(child.x).toBeGreaterThanOrEqual(register.x + register.chrome.padding.left);
      expect(child.x + child.width).toBeLessThanOrEqual(register.x + register.width - register.chrome.padding.right + 0.001);
      expect(child.y + child.height).toBeLessThanOrEqual(register.y + register.height - register.chrome.padding.bottom + 0.001);
      if (index > 0) expect(child.y > register.children[index - 1].y || child.y === register.children[index - 1].y && child.x > register.children[index - 1].x).toBe(true);
    }

    const columnView = structuredClone(view);
    columnView.conventions.renderer_defaults!.ui_contracts_presentation!.target_register_layout.mode = "column";
    const column = await renderUiContractsStagedSvg(projection, graph, columnView, { detailId: "detailed" });
    const columnRegister = column.positionedScene.root.children.find(child => child.id === register.id)!;
    expect(columnRegister.kind).toBe("container");
    if (columnRegister.kind !== "container") throw new Error("Missing column register");
    expect(columnRegister.children.map(child => child.id)).toEqual(register.children.map(child => child.id));
    expect(new Set(columnRegister.children.map(child => child.x)).size).toBe(1);
    expect(register.height).toBeLessThan(columnRegister.height);
    expect(root.width).toBe(column.positionedScene.root.width);
  });

  it("uses the widest card when the register has no sibling section", async () => {
    for (const count of [1, 2]) {
      const text = `SDD-TEXT 0.1\n${Array.from({ length: count }, (_, index) => `Event E-00${index + 1} "Target ${index + 1}"\nEND\n`).join("")}`;
      const graph = compileSource({ path: "/tmp/register-only.sdd", text }, bundle).graph!;
      const view = bundle.views.views.find(candidate => candidate.id === "ui_contracts")!;
      const projection = projectView(graph, bundle, view.id).projection!;
      const result = await renderUiContractsStagedSvg(projection, graph, view, { detailId: "detailed" });
      expect(result.positionedScene.diagnostics.filter(diagnostic => diagnostic.severity === "error")).toEqual([]);
      expect(result.positionedScene.root.children).toHaveLength(1);
      const register = result.positionedScene.root.children[0];
      if (register.kind !== "container") throw new Error("Missing target register");
      expect(register.children).toHaveLength(count);
      expect(register.width).toBe(Math.max(...register.children.map(child => child.width)) + register.chrome.padding.left + register.chrome.padding.right);
      expect(new Set(register.children.map(child => child.x)).size).toBe(1);
    }
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
    const input = { path: "bundle/v0.1/examples/departure_desk.sdd", text: await readFile("bundle/v0.1/examples/departure_desk.sdd", "utf8") };
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
