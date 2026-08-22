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

describe("detail-aware rendering", () => {
  it("hides route, access, and entry-point annotations in compact detail ia_place_map while keeping primary_nav", async () => {
    const bundle = await loadBundle(manifestPath);
    const input = await loadExampleInput(bundle.rootDir, "place_viewstate_transition");

    for (const format of formats) {
      const compact = renderSource(input, bundle, {
        viewId: "ia_place_map",
        format,
        profileId: "strict",
        detailId: "compact"
      });
      const detailed = renderSource(input, bundle, {
        viewId: "ia_place_map",
        format,
        profileId: "strict",
        detailId: "detailed"
      });

      expect(compact.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
      expect(detailed.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
      expect(compact.text).not.toContain("/billing");
      expect(compact.text).not.toContain("[auth]");
      expect(compact.text).not.toContain("entry_points:");
      expect(compact.text).toContain("primary_nav: true");
      expect(detailed.text).toContain("/billing");
      expect(detailed.text).toContain("[auth]");
      expect(detailed.text).toContain("entry_points:");
      expect(detailed.text).toContain("primary_nav: true");
    }
  });

  it("hides route and access annotations in compact detail ia_place_map examples that do not use primary_nav", async () => {
    const bundle = await loadBundle(manifestPath);
    const input = await loadExampleInput(bundle.rootDir, "outcome_to_ia_trace");

    for (const format of formats) {
      const compact = renderSource(input, bundle, {
        viewId: "ia_place_map",
        format,
        profileId: "strict",
        detailId: "compact"
      });
      const detailed = renderSource(input, bundle, {
        viewId: "ia_place_map",
        format,
        profileId: "strict",
        detailId: "detailed"
      });

      expect(compact.text).not.toContain("/checkout/billing");
      expect(compact.text).not.toContain("/checkout/review");
      expect(compact.text).not.toContain("[auth]");
      expect(detailed.text).toContain("/checkout/billing");
      expect(detailed.text).toContain("/checkout/review");
      expect(detailed.text).toContain("[auth]");
    }
  });

  it("omits journey reference badges in compact detail", async () => {
    const bundle = await loadBundle(manifestPath);
    const input = await loadExampleInput(bundle.rootDir, "outcome_to_ia_trace");

    for (const format of formats) {
      const compact = renderSource(input, bundle, {
        viewId: "journey_map",
        format,
        profileId: "strict",
        detailId: "compact"
      });
      const detailed = renderSource(input, bundle, {
        viewId: "journey_map",
        format,
        profileId: "strict",
        detailId: "detailed"
      });

      expect(compact.text).not.toContain("Payment Friction");
      expect(detailed.text).toContain("Payment Friction");
    }
  });

  it("omits outcome-opportunity secondary annotations in compact detail", async () => {
    const bundle = await loadBundle(manifestPath);
    const input = await loadExampleInput(bundle.rootDir, "metric_event_instrumentation");

    for (const format of formats) {
      const compact = renderSource(input, bundle, {
        viewId: "outcome_opportunity_map",
        format,
        profileId: "strict",
        detailId: "compact"
      });
      const detailed = renderSource(input, bundle, {
        viewId: "outcome_opportunity_map",
        format,
        profileId: "strict",
        detailId: "detailed"
      });

      expect(compact.text).not.toContain("Experience:");
      expect(compact.text).not.toContain("Event:");
      expect(compact.text).not.toContain("Implemented by:");
      expect(detailed.text).toContain("Event:");
      expect(detailed.text).toContain("Implemented by:");
    }
  });

  it("drops secondary service edge labels in compact detail while keeping the edges", async () => {
    const bundle = await loadBundle(manifestPath);
    const input = await loadExampleInput(bundle.rootDir, "service_blueprint_slice");

    for (const format of formats) {
      const compact = renderSource(input, bundle, {
        viewId: "service_blueprint",
        format,
        profileId: "strict",
        detailId: "compact"
      });
      const detailed = renderSource(input, bundle, {
        viewId: "service_blueprint",
        format,
        profileId: "strict",
        detailId: "detailed"
      });

      expect(compact.text).not.toContain("realized by");
      expect(compact.text).not.toContain("depends on");
      expect(compact.text).not.toContain("constrained by");
      expect(compact.text).not.toContain("reads");
      expect(compact.text).not.toContain("writes");
      expect(compact.text).toContain("Store Claim");
      expect(detailed.text).toContain("realized by");
    }
  });

  it("drops scenario branch labels in compact detail", async () => {
    const bundle = await loadBundle(manifestPath);
    const input = await loadExampleInput(bundle.rootDir, "scenario_branching");

    for (const format of formats) {
      const compact = renderSource(input, bundle, {
        viewId: "scenario_flow",
        format,
        profileId: "strict",
        detailId: "compact"
      });
      const detailed = renderSource(input, bundle, {
        viewId: "scenario_flow",
        format,
        profileId: "strict",
        detailId: "detailed"
      });

      expect(compact.text).not.toContain("delivery_selected");
      expect(compact.text).not.toContain("pickup_selected");
      expect(compact.text).not.toContain("E-032");
      expect(detailed.text).toContain("delivery selected");
      expect(detailed.text).toContain("e-032");
    }
  });

  it("hides ui_contracts secondary overlays in compact detail when view states are primary", async () => {
    const bundle = await loadBundle(manifestPath);
    const input = await loadExampleInput(bundle.rootDir, "place_viewstate_transition");

    for (const format of formats) {
      const compact = renderSource(input, bundle, {
        viewId: "ui_contracts",
        format,
        profileId: "permissive",
        detailId: "compact"
      });
      const detailed = renderSource(input, bundle, {
        viewId: "ui_contracts",
        format,
        profileId: "permissive",
        detailId: "detailed"
      });

      expect(compact.text).toContain("Billing Editing");
      expect(compact.text).not.toContain("/billing");
      expect(compact.text).not.toContain("[auth]");
      expect(compact.text).not.toContain("data: PaymentMethod");
      expect(compact.text).not.toContain("State detail: Billing Form");
      expect(compact.text).not.toContain("Form Ready");
      expect(compact.text).not.toContain("Save Subscription");
      expect(compact.text).not.toContain("Subscription");
      expect(compact.text).not.toContain("Supporting Contracts");
      expect(detailed.text).toContain("/billing");
      expect(detailed.text).toContain("[auth]");
      expect(detailed.text).toContain("data: PaymentMethod");
      expect(detailed.text).toContain("State detail: Billing Form");
      expect(detailed.text).toContain("Save Subscription");
      expect(detailed.text).toContain("Subscription");
      expect(detailed.text).not.toContain("Supporting Contracts");
    }
  });

  it("omits empty ui_contracts place containers in compact detail and reports a coverage note", async () => {
    const bundle = await loadBundle(manifestPath);
    const fixturePath = path.join(repoRoot, "tests/fixtures/render/ui_contracts_empty_places.sdd");
    const input = {
      path: fixturePath,
      text: await readFile(fixturePath, "utf8")
    };

    for (const format of formats) {
      const compact = renderSource(input, bundle, {
        viewId: "ui_contracts",
        format,
        profileId: "permissive",
        detailId: "compact"
      });
      const detailed = renderSource(input, bundle, {
        viewId: "ui_contracts",
        format,
        profileId: "permissive",
        detailId: "detailed"
      });

      expect(compact.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
      expect(detailed.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
      expect(compact.text).not.toContain("Behavior Details");
      expect(compact.text).not.toContain("Dataset Details");
      expect(compact.text).not.toContain("Projects by Period");
      expect(detailed.text).toContain("Behavior Details");
      expect(detailed.text).toContain("Dataset Details");
      expect(detailed.text).toContain("Projects by Period");
      expect(compact.notes).toEqual([
        "Omitted empty ui_contracts containers in compact detail: Behavior Details, Dataset Details, Projects by Period."
      ]);
      expect(detailed.notes).toEqual([]);
    }
  });

  it("keeps ui_contracts state groups visible in compact detail when state is the primary graph", async () => {
    const bundle = await loadBundle(manifestPath);
    const input = await loadExampleInput(bundle.rootDir, "ui_state_fallback");

    for (const format of formats) {
      const compact = renderSource(input, bundle, {
        viewId: "ui_contracts",
        format,
        profileId: "strict",
        detailId: "compact"
      });
      const detailed = renderSource(input, bundle, {
        viewId: "ui_contracts",
        format,
        profileId: "strict",
        detailId: "detailed"
      });

      expect(compact.text).toContain("State graph: Case Review");
      expect(compact.text).toContain("State graph: Review Panel");
      expect(compact.text).not.toContain("/cases/review");
      expect(compact.text).not.toContain("[auth]");
      expect(detailed.text).toContain("/cases/review");
      expect(detailed.text).toContain("[auth]");
    }
  });

  it("keeps ui_contracts projection scope profile-agnostic while compact detail hides secondary render detail", async () => {
    const bundle = await loadBundle(manifestPath);
    const input = await loadExampleInput(bundle.rootDir, "place_viewstate_transition");
    const compiled = compileSource(input, bundle);
    const projected = projectView(compiled.graph!, bundle, "ui_contracts");

    expect(projected.projection?.nodes.map((node) => node.id)).toEqual(
      expect.arrayContaining(["ST-010a", "ST-010b", "E-010", "SA-010", "D-010"])
    );

    const compact = renderSource(input, bundle, {
      viewId: "ui_contracts",
      format: "dot",
      profileId: "strict",
      detailId: "compact"
    });
    const detailed = renderSource(input, bundle, {
      viewId: "ui_contracts",
      format: "dot",
      profileId: "strict",
      detailId: "detailed"
    });

    expect(compact.text).not.toContain("Form Ready");
    expect(compact.text).not.toContain("Save Subscription");
    expect(compact.text).not.toContain("Subscription");
    expect(compact.text).not.toContain("Supporting Contracts");
    expect(detailed.text).toContain("Form Ready");
    expect(detailed.text).toContain("Save Subscription");
    expect(detailed.text).toContain("Subscription");
    expect(detailed.text).not.toContain("Supporting Contracts");
  });
});
