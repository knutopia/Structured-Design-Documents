import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import {
  compileSource,
  loadBundle,
  renderSource
} from "../src/index.js";
import type { Bundle, ViewSpec } from "../src/bundle/types.js";
import { projectView } from "../src/projector/projectView.js";
import { renderSourcePreview } from "../src/renderer/previewWorkflow.js";
import { renderIaPlaceMapStagedPng } from "../src/renderer/staged/iaPlaceMap.js";
import { renderJourneyMapStagedPng } from "../src/renderer/staged/journeyMap.js";
import { renderOutcomeOpportunityMapStagedPng } from "../src/renderer/staged/outcomeOpportunityMap.js";
import { renderScenarioFlowStagedPng } from "../src/renderer/staged/scenarioFlow.js";
import { renderServiceBlueprintStagedPng } from "../src/renderer/staged/serviceBlueprint.js";
import { renderUiContractsStagedPng } from "../src/renderer/staged/uiContracts.js";
import type { StagedRenderSettings } from "../src/renderer/staged/contracts.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cases = [
  ["outcome_opportunity_map", "metric_event_instrumentation"],
  ["journey_map", "outcome_to_ia_trace"],
  ["service_blueprint", "service_blueprint_slice"],
  ["ia_place_map", "outcome_to_ia_trace"],
  ["scenario_flow", "scenario_branching"],
  ["ui_contracts", "place_viewstate_transition"]
] as const;

let bundle: Bundle;

beforeAll(async () => {
  bundle = await loadBundle(path.join(repoRoot, "bundle/v0.1/manifest.yaml"));
});

async function inputFor(example: string): Promise<{ path: string; text: string }> {
  const inputPath = path.join(bundle.rootDir, "examples", `${example}.sdd`);
  return { path: inputPath, text: await readFile(inputPath, "utf8") };
}

async function renderStaged(
  loadedBundle: Bundle,
  view: ViewSpec,
  example: string,
  settings: StagedRenderSettings
) {
  const input = await inputFor(example);
  const compiled = compileSource(input, loadedBundle);
  const projected = projectView(compiled.graph!, loadedBundle, view.id);
  expect(compiled.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
  expect(projected.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);

  switch (view.id) {
    case "ia_place_map":
      return renderIaPlaceMapStagedPng(projected.projection!, compiled.graph!, view, settings);
    case "journey_map":
      return renderJourneyMapStagedPng(projected.projection!, compiled.graph!, loadedBundle, view, settings);
    case "outcome_opportunity_map":
      return renderOutcomeOpportunityMapStagedPng(projected.projection!, compiled.graph!, view, settings);
    case "scenario_flow":
      return renderScenarioFlowStagedPng(projected.projection!, compiled.graph!, view, settings);
    case "service_blueprint":
      return renderServiceBlueprintStagedPng(projected.projection!, compiled.graph!, view, settings);
    case "ui_contracts":
      return renderUiContractsStagedPng(projected.projection!, compiled.graph!, view, settings);
    default:
      throw new Error(`Unsupported test view '${view.id}'`);
  }
}

describe("Stage 4 render-detail identity", () => {

  it("keeps display independent from successful validation profiles", async () => {
    for (const [viewId, example] of cases) {
      const input = await inputFor(example);
      const simple = renderSource(input, bundle, { viewId, format: "dot", profileId: "simple", detailId: "detailed" });
      const strict = renderSource(input, bundle, { viewId, format: "dot", profileId: "strict", detailId: "detailed" });
      expect(simple.text, `${viewId}/text`).toBe(strict.text);

      const simplePreview = await renderSourcePreview(input, bundle, {
        viewId,
        format: "svg",
        profileId: "simple",
        detailId: "detailed"
      });
      const strictPreview = await renderSourcePreview(input, bundle, {
        viewId,
        format: "svg",
        profileId: "strict",
        detailId: "detailed"
      });
      expect(simplePreview.artifact, `${viewId}/staged-svg`).toEqual(strictPreview.artifact);
      expect(simplePreview.notes).toEqual(strictPreview.notes);
      expect(simplePreview.diagnostics).toEqual(strictPreview.diagnostics);

      const artifact = simplePreview.artifact;
      if (!artifact || artifact.format !== "svg") {
        throw new Error(`Expected staged SVG artifact for '${viewId}'.`);
      }
      const svg = artifact.text;
      expect(svg).toContain("detail-detailed");
      expect(svg).toContain('data-detail-id="detailed"');
      expect(svg).not.toContain("profile-");
      expect(svg).not.toContain("data-profile-id");

      const view = bundle.views.views.find((candidate) => candidate.id === viewId)!;
      const staged = await renderStaged(bundle, view, example, { detailId: "detailed" });
      expect(staged.rendererScene.detailId).toBe("detailed");
      expect(staged.measuredScene.detailId).toBe("detailed");
      expect(staged.positionedScene.detailId).toBe("detailed");
    }
  }, 60_000);

  it("keeps validation diagnostics fixed when only detail changes", async () => {
    for (const [viewId, example] of cases) {
      const input = await inputFor(example);
      const compact = renderSource(input, bundle, { viewId, format: "dot", profileId: "strict", detailId: "compact" });
      const detailed = renderSource(input, bundle, { viewId, format: "dot", profileId: "strict", detailId: "detailed" });
      expect(compact.diagnostics, viewId).toEqual(detailed.diagnostics);
    }
  });

  it("makes omitted detail and per-view policy behavior bundle-owned", async () => {
    const input = await inputFor("outcome_to_ia_trace");
    const detailed = renderSource(input, bundle, {
      viewId: "ia_place_map",
      format: "dot",
      profileId: "strict",
      detailId: "detailed"
    });

    const fallbackChanged = structuredClone(bundle) as Bundle;
    fallbackChanged.manifest.tool_defaults.render_detail_id = "detailed";
    expect(renderSource(input, fallbackChanged, {
      viewId: "ia_place_map",
      format: "dot",
      profileId: "strict"
    }).text).toBe(detailed.text);

    const policyChanged = structuredClone(bundle) as Bundle;
    const view = policyChanged.views.views.find((candidate) => candidate.id === "ia_place_map")!;
    const compact = (view.conventions.renderer_defaults!.detail_display as Record<string, Record<string, boolean>>).compact!;
    compact.show_place_route_or_key = true;
    expect(renderSource(input, policyChanged, {
      viewId: "ia_place_map",
      format: "dot",
      profileId: "strict",
      detailId: "compact"
    }).text).toContain("/checkout/billing");
  });

  it("reports effective IDs on failures and diagnoses unknown explicit detail", () => {
    const compileFailure = renderSource({ path: "bad.sdd", text: "NOT SDD" }, bundle, {
      viewId: "ia_place_map",
      format: "dot"
    });
    expect(compileFailure).toMatchObject({ profileId: "simple", detailId: "compact" });
    expect(compileFailure.text).toBeUndefined();

    const unknown = renderSource({ path: "bad.sdd", text: "NOT SDD" }, bundle, {
      viewId: "ia_place_map",
      format: "dot",
      profileId: "strict",
      detailId: "full"
    });
    expect(unknown).toMatchObject({ profileId: "strict", detailId: "full" });
    expect(unknown.diagnostics).toEqual([expect.objectContaining({ code: "render.unknown_detail" })]);
  });
});
