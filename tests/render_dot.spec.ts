import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadBundle, renderSource } from "../src/index.js";
import { normalizeLineEndings } from "./textNormalization.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

describe("renderSource dot", () => {
  it("renders supported bundle views to stable DOT output", async () => {
    const bundle = await loadBundle(manifestPath);

    for (const [exampleName, viewId, goldenName] of [
      ["outcome_to_ia_trace.sdd", "ia_place_map", "outcome_to_ia_trace.dot"],
      ["place_viewstate_transition.sdd", "ia_place_map", "place_viewstate_transition.dot"],
      ["outcome_to_ia_trace.sdd", "journey_map", "outcome_to_ia_trace.journey_map.dot"],
      ["service_blueprint_slice.sdd", "journey_map", "service_blueprint_slice.journey_map.dot"],
      ["service_blueprint_slice.sdd", "service_blueprint", "service_blueprint_slice.service_blueprint.dot"],
      ["outcome_to_ia_trace.sdd", "outcome_opportunity_map", "outcome_to_ia_trace.outcome_opportunity_map.dot"],
      ["metric_event_instrumentation.sdd", "outcome_opportunity_map", "metric_event_instrumentation.outcome_opportunity_map.dot"],
      ["scenario_branching.sdd", "scenario_flow", "scenario_branching.scenario_flow.dot"],
      ["place_viewstate_transition.sdd", "ui_contracts", "place_viewstate_transition.ui_contracts.dot"],
      ["ui_state_fallback.sdd", "ui_contracts", "ui_state_fallback.ui_contracts.dot"]
    ] as const) {
      const examplePath = path.join(bundle.rootDir, "examples", exampleName);
      const input = {
        path: examplePath,
        text: await readFile(examplePath, "utf8")
      };
      const golden = await readFile(path.join(repoRoot, "tests/goldens", goldenName), "utf8");
      const result = renderSource(input, bundle, {
        viewId,
        format: "dot"
      });
      expect(result.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
      expect(normalizeLineEndings(result.text!)).toBe(normalizeLineEndings(golden).trimEnd());
    }
  });
});
