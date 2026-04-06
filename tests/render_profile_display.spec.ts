import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle, renderSource } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";

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
  it("hides route, access, and entry-point annotations in simple ia_place_map while keeping primary_nav", async () => {
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
      expect(simple.text).not.toContain("/billing");
      expect(simple.text).not.toContain("[auth]");
      expect(simple.text).not.toContain("entry_points:");
      expect(simple.text).toContain("primary_nav: true");
      expect(permissive.text).toContain("/billing");
      expect(permissive.text).toContain("[auth]");
      expect(permissive.text).toContain("entry_points:");
      expect(permissive.text).toContain("primary_nav: true");
    }
  });

  it("hides route and access annotations in simple ia_place_map examples that do not use primary_nav", async () => {
    const bundle = await loadBundle(manifestPath);
    const input = await loadExampleInput(bundle.rootDir, "outcome_to_ia_trace");

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

      expect(simple.text).not.toContain("/checkout/billing");
      expect(simple.text).not.toContain("/checkout/review");
      expect(simple.text).not.toContain("[auth]");
      expect(permissive.text).toContain("/checkout/billing");
      expect(permissive.text).toContain("/checkout/review");
      expect(permissive.text).toContain("[auth]");
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
      expect(simple.text).not.toContain("/billing");
      expect(simple.text).not.toContain("[auth]");
      expect(simple.text).not.toContain("data: PaymentMethod");
      expect(simple.text).not.toContain("State detail: Billing Form");
      expect(simple.text).not.toContain("Form Ready");
      expect(simple.text).not.toContain("Save Subscription");
      expect(simple.text).not.toContain("Subscription");
      expect(simple.text).not.toContain("Supporting Contracts");
      expect(permissive.text).toContain("/billing");
      expect(permissive.text).toContain("[auth]");
      expect(permissive.text).toContain("data: PaymentMethod");
      expect(permissive.text).toContain("State detail: Billing Form");
      expect(permissive.text).toContain("Save Subscription");
      expect(permissive.text).toContain("Subscription");
      expect(permissive.text).not.toContain("Supporting Contracts");
    }
  });

  it("omits empty ui_contracts place containers in simple and reports a coverage note", async () => {
    const bundle = await loadBundle(manifestPath);
    const fixturePath = path.join(repoRoot, "tests/fixtures/render/ui_contracts_empty_places.sdd");
    const input = {
      path: fixturePath,
      text: await readFile(fixturePath, "utf8")
    };

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

      expect(simple.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
      expect(permissive.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
      expect(simple.text).not.toContain("Behavior Details");
      expect(simple.text).not.toContain("Dataset Details");
      expect(simple.text).not.toContain("Projects by Period");
      expect(permissive.text).toContain("Behavior Details");
      expect(permissive.text).toContain("Dataset Details");
      expect(permissive.text).toContain("Projects by Period");
      expect(simple.notes).toEqual([
        "Omitted empty ui_contracts containers in simple profile: Behavior Details, Dataset Details, Projects by Period."
      ]);
      expect(permissive.notes).toEqual([]);
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
      const permissive = renderSource(input, bundle, {
        viewId: "ui_contracts",
        format,
        profileId: "permissive"
      });

      expect(simple.text).toContain("State graph: Case Review");
      expect(simple.text).toContain("State graph: Review Panel");
      expect(simple.text).not.toContain("/cases/review");
      expect(simple.text).not.toContain("[auth]");
      expect(permissive.text).toContain("/cases/review");
      expect(permissive.text).toContain("[auth]");
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
    expect(simple.text).not.toContain("Save Subscription");
    expect(simple.text).not.toContain("Subscription");
    expect(simple.text).not.toContain("Supporting Contracts");
    expect(permissive.text).toContain("Form Ready");
    expect(permissive.text).toContain("Save Subscription");
    expect(permissive.text).toContain("Subscription");
    expect(permissive.text).not.toContain("Supporting Contracts");
  });
});
