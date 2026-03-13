import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle, renderSource } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import { normalizeLineEndings } from "./textNormalization.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");
const formats = ["dot", "mermaid"] as const;

async function loadExampleInput(bundleRoot: string, exampleName: string): Promise<{ path: string; text: string }> {
  const examplePath = path.join(bundleRoot, "examples", `${exampleName}.sdd`);
  return {
    path: examplePath,
    text: await readFile(examplePath, "utf8")
  };
}

describe("profile-aware render detail", () => {
  it("keeps ia_place_map output unchanged across simple and permissive", async () => {
    const bundle = await loadBundle(manifestPath);
    const input = await loadExampleInput(bundle.rootDir, "place_viewstate_transition");

    for (const format of formats) {
      const simple = renderSource(input, bundle, {
        viewId: "ia_place_map",
        format,
        profileId: "simple"
      });
      const permissive = renderSource(input, bundle, {
        viewId: "ia_place_map",
        format,
        profileId: "permissive"
      });

      expect(simple.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
      expect(permissive.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
      expect(normalizeLineEndings(simple.text!)).toBe(normalizeLineEndings(permissive.text!));
    }
  });

  it("omits journey reference badges in simple", async () => {
    const bundle = await loadBundle(manifestPath);
    const input = await loadExampleInput(bundle.rootDir, "outcome_to_ia_trace");

    for (const format of formats) {
      const simple = renderSource(input, bundle, {
        viewId: "journey_map",
        format,
        profileId: "simple"
      });
      const permissive = renderSource(input, bundle, {
        viewId: "journey_map",
        format,
        profileId: "permissive"
      });

      expect(simple.text).not.toContain("Payment Friction");
      expect(permissive.text).toContain("Payment Friction");
    }
  });

  it("omits outcome-opportunity instrumentation annotations in simple", async () => {
    const bundle = await loadBundle(manifestPath);
    const input = await loadExampleInput(bundle.rootDir, "metric_event_instrumentation");

    for (const format of formats) {
      const simple = renderSource(input, bundle, {
        viewId: "outcome_opportunity_map",
        format,
        profileId: "simple"
      });
      const permissive = renderSource(input, bundle, {
        viewId: "outcome_opportunity_map",
        format,
        profileId: "permissive"
      });

      expect(simple.text).not.toContain("Experience:");
      expect(simple.text).not.toContain("Event:");
      expect(permissive.text).toContain("Event:");
    }
  });

  it("drops secondary service edge labels in simple while keeping the edges", async () => {
    const bundle = await loadBundle(manifestPath);
    const input = await loadExampleInput(bundle.rootDir, "service_blueprint_slice");

    for (const format of formats) {
      const simple = renderSource(input, bundle, {
        viewId: "service_blueprint",
        format,
        profileId: "simple"
      });
      const permissive = renderSource(input, bundle, {
        viewId: "service_blueprint",
        format,
        profileId: "permissive"
      });

      expect(simple.text).not.toContain("realized by");
      expect(simple.text).not.toContain("depends on");
      expect(simple.text).not.toContain("constrained by");
      expect(simple.text).not.toContain("reads");
      expect(simple.text).not.toContain("writes");
      expect(simple.text).toContain("Store Claim");
      expect(permissive.text).toContain("realized by");
    }
  });

  it("drops scenario branch labels in simple", async () => {
    const bundle = await loadBundle(manifestPath);
    const input = await loadExampleInput(bundle.rootDir, "scenario_branching");

    for (const format of formats) {
      const simple = renderSource(input, bundle, {
        viewId: "scenario_flow",
        format,
        profileId: "simple"
      });
      const permissive = renderSource(input, bundle, {
        viewId: "scenario_flow",
        format,
        profileId: "permissive"
      });

      expect(simple.text).not.toContain("delivery_selected");
      expect(simple.text).not.toContain("pickup_selected");
      expect(simple.text).not.toContain("E-032");
      expect(permissive.text).toContain("delivery_selected");
      expect(permissive.text).toContain("E-032");
    }
  });

  it("hides ui_contracts secondary overlays in simple when view states are primary", async () => {
    const bundle = await loadBundle(manifestPath);
    const input = await loadExampleInput(bundle.rootDir, "place_viewstate_transition");

    for (const format of formats) {
      const simple = renderSource(input, bundle, {
        viewId: "ui_contracts",
        format,
        profileId: "simple"
      });
      const permissive = renderSource(input, bundle, {
        viewId: "ui_contracts",
        format,
        profileId: "permissive"
      });

      expect(simple.text).toContain("Billing Editing");
      expect(simple.text).not.toContain("data: PaymentMethod");
      expect(simple.text).not.toContain("State detail: Billing Form");
      expect(simple.text).not.toContain("Form Ready");
      expect(simple.text).not.toContain("Supporting Contracts");
      expect(permissive.text).toContain("data: PaymentMethod");
      expect(permissive.text).toContain("State detail: Billing Form");
      expect(permissive.text).toContain("Supporting Contracts");
    }
  });

  it("keeps ui_contracts state groups visible in simple when state is the primary graph", async () => {
    const bundle = await loadBundle(manifestPath);
    const input = await loadExampleInput(bundle.rootDir, "ui_state_fallback");

    for (const format of formats) {
      const simple = renderSource(input, bundle, {
        viewId: "ui_contracts",
        format,
        profileId: "simple"
      });

      expect(simple.text).toContain("State graph: Case Review");
      expect(simple.text).toContain("State graph: Review Panel");
    }
  });

  it("keeps ui_contracts projection scope profile-agnostic while simple hides secondary render detail", async () => {
    const bundle = await loadBundle(manifestPath);
    const input = await loadExampleInput(bundle.rootDir, "place_viewstate_transition");
    const compiled = compileSource(input, bundle);
    const projected = projectView(compiled.graph!, bundle, "ui_contracts");

    expect(projected.projection?.nodes.map((node) => node.id)).toEqual(
      expect.arrayContaining(["ST-010a", "ST-010b", "E-010", "SA-010", "D-010"])
    );

    const simple = renderSource(input, bundle, {
      viewId: "ui_contracts",
      format: "dot",
      profileId: "simple"
    });
    const permissive = renderSource(input, bundle, {
      viewId: "ui_contracts",
      format: "dot",
      profileId: "permissive"
    });

    expect(simple.text).not.toContain("Form Ready");
    expect(simple.text).not.toContain("Supporting Contracts");
    expect(permissive.text).toContain("Form Ready");
    expect(permissive.text).toContain("Supporting Contracts");
  });
});
