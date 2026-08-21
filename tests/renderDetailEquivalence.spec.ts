import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import {
  compileSource,
  loadBundle,
  renderSource,
  validateLoadedBundle
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
import type { TransitionalStagedRenderSettings } from "../src/renderer/staged/contracts.js";
import { resolveProfileDisplayPolicy } from "./legacyProfileDisplay.js";
import {
  normalizeStage3SceneProfileMetadata,
  normalizeStage3SvgProfileMetadata
} from "./stage3ArtifactNormalizer.js";

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

function createLegacySentinelBundle(): Bundle {
  const cloned = structuredClone(bundle) as Bundle;
  const sentinels = [
    ["legacy_simple", "simple"],
    ["legacy_permissive", "permissive"],
    ["legacy_strict", "strict"]
  ] as const;
  for (const [detailId, profileId] of sentinels) {
    cloned.manifest.render_details.push({ id: detailId, intent: `Test-only ${profileId} policy baseline.` });
    for (const view of cloned.views.views) {
      const defaults = view.conventions.renderer_defaults as Record<string, unknown>;
      const detailDisplay = defaults.detail_display as Record<string, Record<string, boolean>>;
      detailDisplay[detailId] = structuredClone(resolveProfileDisplayPolicy(view, profileId)) as Record<string, boolean>;
    }
  }
  validateLoadedBundle(cloned);
  return cloned;
}

async function renderStaged(
  loadedBundle: Bundle,
  view: ViewSpec,
  example: string,
  settings: TransitionalStagedRenderSettings
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

describe("Stage 3 render-detail equivalence", () => {
  it("normalizes only the transitional profile metadata", () => {
    const scene = { profileId: "strict", x: 12, nested: { profileId: "simple", label: "profile-strict" } };
    expect(normalizeStage3SceneProfileMetadata(scene)).toEqual({ x: 12, nested: { label: "profile-strict" } });
    const svg = '<svg class="renderer profile-strict unrelated" data-profile-id="strict" data-x="12"><text>profile-strict</text></svg>';
    expect(normalizeStage3SvgProfileMetadata(svg)).toBe(
      '<svg class="renderer unrelated" data-x="12"><text>profile-strict</text></svg>'
    );
  });

  it("preserves simple→compact and permissive|strict→detailed across every renderer path", async () => {
    const legacy = createLegacySentinelBundle();
    const mappings = [
      ["compact", "legacy_simple"],
      ["detailed", "legacy_permissive"],
      ["detailed", "legacy_strict"]
    ] as const;

    for (const [viewId, example] of cases) {
      const input = await inputFor(example);
      const view = legacy.views.views.find((candidate) => candidate.id === viewId)!;
      for (const [detailId, legacyDetailId] of mappings) {
        for (const format of ["dot", "mermaid"] as const) {
          const current = renderSource(input, legacy, { viewId, format, profileId: "strict", detailId });
          const baseline = renderSource(input, legacy, { viewId, format, profileId: "strict", detailId: legacyDetailId });
          expect(current.text, `${viewId}/${format}/${detailId}`).toBe(baseline.text);
          expect(current.notes).toEqual(baseline.notes);
          expect(current.diagnostics).toEqual(baseline.diagnostics);
        }

        const currentStaged = await renderStaged(legacy, view, example, {
          profileId: "strict",
          detailId
        });
        const baselineStaged = await renderStaged(legacy, view, example, {
          profileId: "strict",
          detailId: legacyDetailId
        });
        expect(currentStaged, `${viewId}/staged/${detailId}`).toEqual(baselineStaged);

        for (const format of ["svg", "png"] as const) {
          const currentLegacy = await renderSourcePreview(input, legacy, {
            viewId,
            format,
            backendId: "legacy_graphviz_preview",
            profileId: "strict",
            detailId
          });
          const baselineLegacy = await renderSourcePreview(input, legacy, {
            viewId,
            format,
            backendId: "legacy_graphviz_preview",
            profileId: "strict",
            detailId: legacyDetailId
          });
          expect(currentLegacy.artifact, `${viewId}/graphviz/${format}/${detailId}`).toEqual(baselineLegacy.artifact);
          expect(currentLegacy.notes).toEqual(baselineLegacy.notes);
          expect(currentLegacy.diagnostics).toEqual(baselineLegacy.diagnostics);
        }
      }
    }
  }, 120_000);

  it("keeps display independent from successful validation profiles", async () => {
    for (const [viewId, example] of cases) {
      const input = await inputFor(example);
      const simple = renderSource(input, bundle, { viewId, format: "dot", profileId: "simple", detailId: "detailed" });
      const strict = renderSource(input, bundle, { viewId, format: "dot", profileId: "strict", detailId: "detailed" });
      expect(simple.text, `${viewId}/text`).toBe(strict.text);

      const view = bundle.views.views.find((candidate) => candidate.id === viewId)!;
      const simpleStaged = await renderStaged(bundle, view, example, { profileId: "simple", detailId: "detailed" });
      const strictStaged = await renderStaged(bundle, view, example, { profileId: "strict", detailId: "detailed" });
      expect(normalizeStage3SceneProfileMetadata(simpleStaged.rendererScene)).toEqual(
        normalizeStage3SceneProfileMetadata(strictStaged.rendererScene)
      );
      expect(normalizeStage3SceneProfileMetadata(simpleStaged.measuredScene)).toEqual(
        normalizeStage3SceneProfileMetadata(strictStaged.measuredScene)
      );
      expect(normalizeStage3SceneProfileMetadata(simpleStaged.positionedScene)).toEqual(
        normalizeStage3SceneProfileMetadata(strictStaged.positionedScene)
      );
      expect(normalizeStage3SvgProfileMetadata(simpleStaged.svg)).toBe(
        normalizeStage3SvgProfileMetadata(strictStaged.svg)
      );
      expect(simpleStaged.png).toEqual(strictStaged.png);
      expect(simpleStaged.diagnostics).toEqual(strictStaged.diagnostics);
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
