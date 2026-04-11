import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  compileSource,
  loadBundle,
  projectSource,
  projectView,
  renderSource
} from "../src/index.js";
import { renderSourcePreview } from "../src/renderer/previewWorkflow.js";
import { prepareProjectionForRender } from "../src/renderer/prepareProjectionForRender.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");
const fixturePath = path.join(repoRoot, "tests/fixtures/render/ui_contracts_empty_places.sdd");
const coverageNote =
  "Omitted empty ui_contracts containers in simple profile: Behavior Details, Dataset Details, Projects by Period.";

async function loadFixtureInput(): Promise<{ path: string; text: string }> {
  return {
    path: fixturePath,
    text: await readFile(fixturePath, "utf8")
  };
}

describe("projection orchestration reuse", () => {
  it("keeps the public source convenience path aligned with raw graph projection", async () => {
    const bundle = await loadBundle(manifestPath);
    const input = await loadFixtureInput();
    const compiled = compileSource(input, bundle);
    const fromGraph = projectView(compiled.graph!, bundle, "ui_contracts");
    const fromSource = projectSource(input, bundle, "ui_contracts");

    expect(compiled.diagnostics).toEqual([]);
    expect(fromGraph.diagnostics).toEqual([]);
    expect(fromSource).toEqual(fromGraph);
  });

  it("keeps raw public projection free of renderer-owned simple-profile coverage shaping", async () => {
    const bundle = await loadBundle(manifestPath);
    const input = await loadFixtureInput();
    const compiled = compileSource(input, bundle);
    const projected = projectSource(input, bundle, "ui_contracts");

    expect(compiled.diagnostics).toEqual([]);
    expect(projected.diagnostics).toEqual([]);
    expect(projected.projection).toBeDefined();
    expect(projected.projection!.notes).not.toContain(coverageNote);
    expect(projected.projection!.derived.view_metadata.ui_contracts_coverage).toBeUndefined();
  });

  it("applies ui_contracts simple-profile shaping only through prepareProjectionForRender", async () => {
    const bundle = await loadBundle(manifestPath);
    const input = await loadFixtureInput();
    const compiled = compileSource(input, bundle);
    const projected = projectView(compiled.graph!, bundle, "ui_contracts");
    const view = bundle.views.views.find((candidate) => candidate.id === "ui_contracts");

    expect(compiled.diagnostics).toEqual([]);
    expect(projected.diagnostics).toEqual([]);
    expect(projected.projection).toBeDefined();
    expect(view).toBeDefined();

    const prepared = prepareProjectionForRender(view!, projected.projection!, compiled.graph!, "simple");

    expect(prepared.notes).toEqual([coverageNote]);
    expect(prepared.projection.notes).toContain(coverageNote);
    expect(prepared.projection.derived.view_metadata.ui_contracts_coverage).toEqual({
      omitted_empty_place_containers: [
        { id: "P-221", name: "Behavior Details" },
        { id: "P-222", name: "Dataset Details" },
        { id: "P-310", name: "Projects by Period" }
      ]
    });
    expect(projected.projection!.notes).not.toContain(coverageNote);
    expect(projected.projection!.derived.view_metadata.ui_contracts_coverage).toBeUndefined();
  });

  it("proves renderSource layers renderer preparation on top of the raw public projection", async () => {
    const bundle = await loadBundle(manifestPath);
    const input = await loadFixtureInput();
    const rendered = renderSource(input, bundle, {
      viewId: "ui_contracts",
      format: "dot",
      profileId: "simple"
    });

    expect(rendered.diagnostics).toEqual([]);
    expect(rendered.notes).toEqual([coverageNote]);
    expect(rendered.text).toBeDefined();
  });

  it("proves renderSourcePreview layers renderer preparation on top of the raw public projection", async () => {
    const bundle = await loadBundle(manifestPath);
    const input = await loadFixtureInput();
    const preview = await renderSourcePreview(input, bundle, {
      viewId: "ui_contracts",
      format: "svg",
      profileId: "simple"
    });

    expect(preview.diagnostics).toEqual([]);
    expect(preview.notes).toEqual([coverageNote]);
    expect(preview.artifact?.format).toBe("svg");
  });
});
