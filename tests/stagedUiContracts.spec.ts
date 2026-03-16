import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import type { PositionedContainer, PositionedItem, RendererScene } from "../src/renderer/staged/contracts.js";
import {
  buildUiContractsRendererScene,
  renderUiContractsStagedSvg
} from "../src/renderer/staged/uiContracts.js";
import {
  expectRendererStageSnapshot,
  expectRendererStageTextSnapshot
} from "./rendererStageSnapshotHarness.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

function findPositionedItem(root: PositionedContainer, id: string): PositionedItem {
  const queue: PositionedItem[] = [...root.children];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    if (current.id === id) {
      return current;
    }

    if (current.kind === "container") {
      queue.push(...current.children);
    }
  }

  throw new Error(`Could not find positioned item "${id}".`);
}

function findContainerChildIds(
  scene: RendererScene,
  containerId: string
): string[] {
  const queue: Array<RendererScene["root"] | RendererScene["root"]["children"][number]> = [scene.root];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || current.kind !== "container") {
      continue;
    }

    if (current.id === containerId) {
      return current.children.map((child) => child.id);
    }

    queue.push(...current.children);
  }

  throw new Error(`Could not find renderer-scene container "${containerId}".`);
}

async function buildUiContractsArtifactsFromInput(
  input: { path: string; text: string },
  profileId: string
) {
  const bundle = await loadBundle(manifestPath);
  const view = bundle.views.views.find((candidate) => candidate.id === "ui_contracts");
  if (!view) {
    throw new Error("Could not resolve the ui_contracts view.");
  }

  const compiled = compileSource(input, bundle);
  expect(compiled.diagnostics).toEqual([]);
  if (!compiled.graph) {
    throw new Error(`Could not compile ${input.path}.`);
  }

  const projected = projectView(compiled.graph, bundle, "ui_contracts");
  expect(projected.diagnostics).toEqual([]);
  if (!projected.projection) {
    throw new Error(`Could not project ${input.path} to ui_contracts.`);
  }

  const rendererScene = buildUiContractsRendererScene(projected.projection, compiled.graph, view, profileId);
  const rendered = await renderUiContractsStagedSvg(projected.projection, compiled.graph, view, profileId);

  return {
    rendererScene,
    rendered
  };
}

async function buildUiContractsArtifacts(examplePath: string, profileId: string) {
  return buildUiContractsArtifactsFromInput({
    path: examplePath,
    text: await readFile(examplePath, "utf8")
  }, profileId);
}

describe("staged ui_contracts", () => {
  it("matches committed staged snapshots for place_viewstate_transition in recommended profile", async () => {
    const examplePath = path.join(repoRoot, "bundle/v0.1/examples/place_viewstate_transition.sdd");
    const { rendererScene, rendered } = await buildUiContractsArtifacts(examplePath, "recommended");

    expect(rendered.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(rendererScene.root.children.map((child) => child.id)).toEqual(["P-010", "P-011"]);
    expect(findContainerChildIds(rendererScene, "P-010")).toEqual(["view_state_graph:P-010", "C-010"]);

    await expectRendererStageSnapshot("ui-contracts.place-viewstate-transition.renderer-scene.json", rendererScene);
    await expectRendererStageSnapshot("ui-contracts.place-viewstate-transition.measured-scene.json", rendered.measuredScene);
    await expectRendererStageSnapshot("ui-contracts.place-viewstate-transition.positioned-scene.json", rendered.positionedScene);
    await expectRendererStageTextSnapshot("ui-contracts.place-viewstate-transition.svg", rendered.svg);
  });

  it("builds fallback-to-state structure without a synthetic ViewState graph", async () => {
    const examplePath = path.join(repoRoot, "bundle/v0.1/examples/ui_state_fallback.sdd");
    const { rendererScene, rendered } = await buildUiContractsArtifacts(examplePath, "recommended");

    expect(rendered.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(rendererScene.root.layout).toEqual(expect.objectContaining({
      strategy: "stack",
      direction: "vertical",
      crossAlignment: "stretch"
    }));
    expect(rendered.svg).toContain("State graph: Case Review");
    expect(rendered.svg).toContain("State graph: Review Panel");
    expect(rendered.svg).not.toContain("ViewState Graph");

    const placeGraph = findPositionedItem(rendered.positionedScene.root, "secondary_state_group:P-060");
    const componentGraph = findPositionedItem(rendered.positionedScene.root, "secondary_state_group:C-060");
    expect(placeGraph.kind).toBe("container");
    expect(componentGraph.kind).toBe("container");
  });

  it("keeps the shared supporting group structural in the staged scene", async () => {
    const { rendererScene, rendered } = await buildUiContractsArtifactsFromInput({
      path: path.join(repoRoot, "tests/fixtures/render/shared_support_group_staged.sdd"),
      text: `SDD-TEXT 0.1

Place P-200 "Claims"
  COMPOSED_OF C-200 "Primary Button"
  COMPOSED_OF C-201 "Secondary Button"
END

Component C-200 "Primary Button"
  EMITS E-200 "Submit"
END

Component C-201 "Secondary Button"
  EMITS E-200 "Submit"
END

Event E-200 "Submit"
END
`
    }, "recommended");

    expect(rendered.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(rendererScene.root.children.map((child) => child.id)).toEqual(["P-200", "shared_supporting_contracts"]);
    expect(rendered.svg).toContain("Shared Supporting Contracts");
    expect(findPositionedItem(rendered.positionedScene.root, "shared_supporting_contracts").kind).toBe("container");
    expect(
      rendered.positionedScene.edges
        .filter((edge) => edge.role === "emits" && edge.to.itemId === "E-200")
        .map((edge) => edge.from.itemId)
    ).toEqual(["C-200", "C-201"]);
  });
});
