import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import { buildUiContractsRenderModel } from "../src/renderer/uiContractsRenderModel.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

async function buildModel(sourceName: string, text: string) {
  const bundle = await loadBundle(manifestPath);
  const input = {
    path: path.join(repoRoot, "tests/fixtures/render", `${sourceName}.sdd`),
    text
  };

  const compiled = compileSource(input, bundle);
  expect(compiled.diagnostics).toEqual([]);

  const projected = projectView(compiled.graph!, bundle, "ui_contracts");
  expect(projected.diagnostics).toEqual([]);
  expect(projected.projection).toBeDefined();

  return buildUiContractsRenderModel(projected.projection!, compiled.graph!);
}

describe("ui_contracts render model ownership", () => {
  it("renders view-state-owned supporting contracts inside the owning view state", async () => {
    const model = await buildModel("viewstate_owned_support", `SDD-TEXT 0.1

Place P-100 "Draft Review"
  CONTAINS VS-100 "Editing"
END

ViewState VS-100 "Editing"
  place_id=P-100
  data_required=DraftRecord
  EMITS E-100 "Draft Saved"
  DEPENDS_ON SA-100 "Persist Draft"
END

Event E-100 "Draft Saved"
END

SystemAction SA-100 "Persist Draft"
END
`);

    expect(model.rootItems).toHaveLength(1);
    expect(model.rootItems[0]?.kind).toBe("place");

    const place = model.rootItems[0];
    if (!place || place.kind !== "place") {
      throw new Error("Expected root place item.");
    }

    expect(place.childItems).toHaveLength(1);
    expect(place.childItems[0]?.kind).toBe("view_state");

    const viewState = place.childItems[0];
    if (!viewState || viewState.kind !== "view_state") {
      throw new Error("Expected nested view state item.");
    }

    expect(viewState.childItems.map((item) => item.kind)).toEqual(["node", "node"]);
    expect(viewState.childItems.map((item) => item.orderAnchorId)).toEqual(["E-100", "SA-100"]);
    expect(model.rootItems.some((item) => item.kind === "support_group")).toBe(false);
  });

  it("falls back to a shared supporting group when a support node has multiple structural owners", async () => {
    const model = await buildModel("shared_support_group", `SDD-TEXT 0.1

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
`);

    const place = model.rootItems[0];
    if (!place || place.kind !== "place") {
      throw new Error("Expected root place item.");
    }

    const components = place.childItems.filter((item) => item.kind === "component");
    expect(components).toHaveLength(2);
    expect(components.every((item) => item.childItems.length === 0)).toBe(true);

    const sharedGroup = model.rootItems.at(-1);
    expect(sharedGroup?.kind).toBe("support_group");
    if (!sharedGroup || sharedGroup.kind !== "support_group") {
      throw new Error("Expected shared supporting group.");
    }

    expect(sharedGroup.labelLines).toEqual(["Shared Supporting Contracts"]);
    expect(sharedGroup.nodeIds).toEqual(["E-200"]);
  });

  it("keeps components plain when they have no nested state detail or supporting contracts", async () => {
    const model = await buildModel("plain_component", `SDD-TEXT 0.1

Component C-300 "Plain Panel"
END
`);

    expect(model.rootItems).toHaveLength(1);
    expect(model.rootItems[0]?.kind).toBe("component");

    const component = model.rootItems[0];
    if (!component || component.kind !== "component") {
      throw new Error("Expected root component item.");
    }

    expect(component.childItems).toEqual([]);
  });

  it("orders component-owned supporting contracts by top-level author order", async () => {
    const bundle = await loadBundle(manifestPath);
    const examplePath = path.join(bundle.rootDir, "examples/ui_state_fallback.sdd");
    const input = {
      path: examplePath,
      text: await readFile(examplePath, "utf8")
    };

    const compiled = compileSource(input, bundle);
    expect(compiled.diagnostics).toEqual([]);

    const projected = projectView(compiled.graph!, bundle, "ui_contracts");
    expect(projected.diagnostics).toEqual([]);
    expect(projected.projection).toBeDefined();

    const model = buildUiContractsRenderModel(projected.projection!, compiled.graph!);
    const place = model.rootItems[0];
    if (!place || place.kind !== "place") {
      throw new Error("Expected root place item.");
    }

    const component = place.childItems.find((item) => item.kind === "component");
    if (!component || component.kind !== "component") {
      throw new Error("Expected nested component item.");
    }

    expect(component.childItems.filter((item) => item.kind === "node").map((item) => item.orderAnchorId)).toEqual([
      "E-060",
      "SA-060",
      "D-060"
    ]);
  });
});
