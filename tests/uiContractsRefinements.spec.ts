import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle, validateLoadedBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import { buildUiContractsPresentationModel } from "../src/renderer/uiContractsPresentationModel.js";
import { buildUiContractsRendererScene, renderUiContractsStagedSvg } from "../src/renderer/staged/uiContracts.js";
import { runStagedRendererPipeline } from "../src/renderer/staged/pipeline.js";
import type { PositionedItem } from "../src/renderer/staged/contracts.js";

const fixturePath = "tests/fixtures/render/ui_contracts_renderer_refinements.sdd";

async function setup(detailId: string) {
  const bundle = await loadBundle("bundle/v0.1/manifest.yaml");
  const input = { path: fixturePath, text: await readFile(fixturePath, "utf8") };
  const compiled = compileSource(input, bundle);
  expect(compiled.diagnostics).toEqual([]);
  const graph = compiled.graph!;
  const view = bundle.views.views.find(candidate => candidate.id === "ui_contracts")!;
  const projection = projectView(graph, bundle, view.id).projection!;
  const model = buildUiContractsPresentationModel(projection, graph, view, detailId);
  const scene = buildUiContractsRendererScene(projection, graph, view, { detailId });
  const rendered = await runStagedRendererPipeline(scene);
  return { model, scene, rendered };
}

function findItem(item: PositionedItem, id: string): PositionedItem | undefined {
  if (item.id === id) return item;
  if (item.kind === "container") for (const child of item.children) {
    const match = findItem(child, id);
    if (match) return match;
  }
  return undefined;
}

describe("ui_contracts renderer refinements", () => {
  it("retains multi-node component scopes and omits sole simple scopes in compact detail", async () => {
    const { model } = await setup("compact");
    expect(model.scopes.map(scope => scope.id)).toEqual(expect.arrayContaining([
      "scope:P-001", "scope:C-020", "scope:C-021", "standalone:transitions"
    ]));
    expect(model.scopes.map(scope => scope.id)).not.toEqual(expect.arrayContaining([
      "scope:P-010", "scope:C-060", "standalone:VS-050"
    ]));
    expect(model.scopes.find(scope => scope.id === "scope:C-020")?.simple).toBe(false);
    expect(model.visibleSemanticNodeIds).not.toContain("P-010");
    expect(model.visibleSemanticNodeIds).toContain("C-050");
  });

  it("packs consecutive simple scopes in source order in detailed detail", async () => {
    const { model, scene, rendered } = await setup("detailed");
    expect(model.packSimpleScopeIds).toEqual(expect.arrayContaining([
      "scope:P-010", "scope:C-050", "scope:C-060", "standalone:VS-050"
    ]));
    expect(model.scopes.find(scope => scope.id === "scope:P-010")?.description).toBe("A descriptive simple place");
    expect(model.scopes.find(scope => scope.id === "scope:P-010")?.simple).toBe(true);
    expect(model.scopes.find(scope => scope.id === "scope:C-020")?.contracts.length).toBeGreaterThan(0);
    const simpleItems = model.packSimpleScopeIds.map(id => findItem(rendered.positionedScene.root, id)!);
    expect(simpleItems.every(Boolean)).toBe(true);
    const c050 = findItem(rendered.positionedScene.root, "scope:C-050")!;
    const c060 = findItem(rendered.positionedScene.root, "scope:C-060")!;
    expect(c060.x).toBeGreaterThan(c050.x);
    expect(c060.y).toBe(c050.y);
    expect(scene.root.layout.pack?.gap).toBe(28);
    expect(rendered.positionedScene.root.width).toBeLessThan(1300);
  });

  it("shrinks the transition scope to its positioned children", async () => {
    const { rendered } = await setup("detailed");
    const transition = findItem(rendered.positionedScene.root, "standalone:transitions");
    expect(transition?.kind).toBe("container");
    if (!transition || transition.kind !== "container") throw new Error("Missing transition scope");
    const sequence = transition.children[0];
    expect(sequence.kind).toBe("container");
    if (sequence.kind !== "container") throw new Error("Missing transition sequence");
    const right = Math.max(...sequence.children.map(child => child.x - sequence.x + child.width));
    expect(transition.width + 0.001).toBeGreaterThanOrEqual(sequence.x - transition.x + right + transition.chrome.padding.right);
    expect(transition.width).toBeLessThan(1300);
  });

  it("keeps SVG and PNG on the same positioned scene", async () => {
    const bundle = await loadBundle("bundle/v0.1/manifest.yaml");
    const input = { path: fixturePath, text: await readFile(fixturePath, "utf8") };
    const compiled = compileSource(input, bundle);
    const graph = compiled.graph!;
    const view = bundle.views.views.find(candidate => candidate.id === "ui_contracts")!;
    const projection = projectView(graph, bundle, view.id).projection!;
    const svg = await renderUiContractsStagedSvg(projection, graph, view, { detailId: "detailed" });
    expect(svg.svg).toContain("scope:P-010");
    expect(svg.positionedScene.root.width).toBeGreaterThan(0);
  });

  it("takes omission behavior from bundle policy and rejects malformed policy declarations", async () => {
    const bundle = await loadBundle("bundle/v0.1/manifest.yaml");
    const input = { path: fixturePath, text: await readFile(fixturePath, "utf8") };
    const compiled = compileSource(input, bundle);
    const graph = compiled.graph!;
    const view = bundle.views.views.find(candidate => candidate.id === "ui_contracts")!;
    const compact = view.conventions.renderer_defaults!.detail_display!.compact as Record<string, boolean>;
    compact.omit_simple_scopes = false;
    const projection = projectView(graph, bundle, view.id).projection!;
    const model = buildUiContractsPresentationModel(projection, graph, view, "compact");
    expect(model.scopes.some(scope => scope.id === "scope:C-060")).toBe(true);

    const malformed = structuredClone(bundle);
    const config = malformed.views.views.find(candidate => candidate.id === "ui_contracts")!
      .conventions.renderer_defaults!.ui_contracts_presentation as Record<string, unknown>;
    delete config.scope_policy;
    expect(() => validateLoadedBundle(malformed)).toThrow();
  });
});
