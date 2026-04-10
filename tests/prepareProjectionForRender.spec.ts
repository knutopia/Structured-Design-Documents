import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import { prepareProjectionForRender } from "../src/renderer/prepareProjectionForRender.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");
const uiContractsCoverageNote =
  "Omitted empty ui_contracts containers in simple profile: Behavior Details, Dataset Details, Projects by Period.";

async function loadExampleInput(fileName: string): Promise<{ path: string; text: string }> {
  const filePath = path.join(repoRoot, "bundle/v0.1/examples", fileName);
  return {
    path: filePath,
    text: await readFile(filePath, "utf8")
  };
}

describe("prepareProjectionForRender", () => {
  it("returns non-ui_contracts projections unchanged with no notes", async () => {
    const bundle = await loadBundle(manifestPath);
    const input = await loadExampleInput("outcome_to_ia_trace.sdd");
    const compiled = compileSource(input, bundle);
    const projected = projectView(compiled.graph!, bundle, "ia_place_map");
    const view = bundle.views.views.find((candidate) => candidate.id === "ia_place_map");

    expect(compiled.diagnostics).toEqual([]);
    expect(projected.diagnostics).toEqual([]);
    expect(view).toBeDefined();
    expect(projected.projection).toBeDefined();

    const prepared = prepareProjectionForRender(view!, projected.projection!, compiled.graph!, "simple");

    expect(prepared.projection).toBe(projected.projection);
    expect(prepared.notes).toEqual([]);
  });

  it("adds ui_contracts coverage notes and metadata in simple profiles", async () => {
    const bundle = await loadBundle(manifestPath);
    const fixturePath = path.join(repoRoot, "tests/fixtures/render/ui_contracts_empty_places.sdd");
    const input = {
      path: fixturePath,
      text: await readFile(fixturePath, "utf8")
    };
    const compiled = compileSource(input, bundle);
    const projected = projectView(compiled.graph!, bundle, "ui_contracts");
    const view = bundle.views.views.find((candidate) => candidate.id === "ui_contracts");

    expect(compiled.diagnostics).toEqual([]);
    expect(projected.diagnostics).toEqual([]);
    expect(view).toBeDefined();
    expect(projected.projection).toBeDefined();

    const prepared = prepareProjectionForRender(view!, projected.projection!, compiled.graph!, "simple");

    expect(prepared.projection).not.toBe(projected.projection);
    expect(prepared.notes).toEqual([uiContractsCoverageNote]);
    expect(prepared.projection.notes).toContain(uiContractsCoverageNote);
    expect(prepared.projection.derived.view_metadata.ui_contracts_coverage).toEqual({
      omitted_empty_place_containers: [
        { id: "P-221", name: "Behavior Details" },
        { id: "P-222", name: "Dataset Details" },
        { id: "P-310", name: "Projects by Period" }
      ]
    });
  });

  it("does not mutate the raw projectView result when renderer preparation is applied", async () => {
    const bundle = await loadBundle(manifestPath);
    const fixturePath = path.join(repoRoot, "tests/fixtures/render/ui_contracts_empty_places.sdd");
    const input = {
      path: fixturePath,
      text: await readFile(fixturePath, "utf8")
    };
    const compiled = compileSource(input, bundle);
    const projected = projectView(compiled.graph!, bundle, "ui_contracts");
    const view = bundle.views.views.find((candidate) => candidate.id === "ui_contracts");

    expect(compiled.diagnostics).toEqual([]);
    expect(projected.diagnostics).toEqual([]);
    expect(view).toBeDefined();
    expect(projected.projection).toBeDefined();

    const rawProjection = projected.projection!;
    const rawSnapshot = structuredClone(rawProjection);

    prepareProjectionForRender(view!, rawProjection, compiled.graph!, "simple");

    expect(rawProjection).toEqual(rawSnapshot);
    expect(rawProjection.notes).not.toContain(uiContractsCoverageNote);
    expect(rawProjection.derived.view_metadata.ui_contracts_coverage).toBeUndefined();
  });
});
