import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import {
  BundleValidationError,
  collectBundleDiagnostics,
  computeBundleFingerprint,
  getBundleRenderDetailFallback,
  loadBundle,
  resolveDetailDisplayPolicy,
  validateLoadedBundle
} from "../src/index.js";
import type { Bundle, BundleManifestRenderDetailEntry, RenderDetailId } from "../src/index.js";
import { getKnownRenderableViewIds } from "../src/renderer/viewRenderers.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let bundle: Bundle;

beforeAll(async () => {
  bundle = await loadBundle(path.join(repoRoot, "bundle/v0.1/manifest.yaml"));
});

function cloneBundle(): Bundle {
  return structuredClone(bundle) as Bundle;
}

function expectInvalid(code: string, mutate: (cloned: Bundle) => void): void {
  const cloned = cloneBundle();
  mutate(cloned);
  expect(() => validateLoadedBundle(cloned)).toThrow(BundleValidationError);
  expect(collectBundleDiagnostics(cloned).map((diagnostic) => diagnostic.code)).toContain(code);
}

describe("bundle-owned render details", () => {
  it("ships ordered compact and detailed declarations with compact fallback", () => {
    const entries: BundleManifestRenderDetailEntry[] = bundle.manifest.render_details;
    const detailId: RenderDetailId = getBundleRenderDetailFallback(bundle);
    expect(entries.map((entry) => entry.id)).toEqual(["compact", "detailed"]);
    expect(entries.every((entry) => entry.intent.trim().length > 0)).toBe(true);
    expect(detailId).toBe("compact");
  });

  it("requires valid declarations and a known exact tool fallback", () => {
    expectInvalid("bundle.render_details.shape", (cloned) => {
      delete (cloned.manifest as unknown as Record<string, unknown>).render_details;
    });
    expectInvalid("bundle.render_details.shape", (cloned) => {
      (cloned.manifest as unknown as Record<string, unknown>).render_details = {};
    });
    expectInvalid("bundle.render_details.invalid_id", (cloned) => {
      cloned.manifest.render_details[0]!.id = " ";
    });
    expectInvalid("bundle.render_details.duplicate_id", (cloned) => {
      cloned.manifest.render_details.push({ ...cloned.manifest.render_details[0]! });
    });
    expectInvalid("bundle.render_details.invalid_intent", (cloned) => {
      cloned.manifest.render_details[0]!.intent = "";
    });
    expectInvalid("bundle.tool_defaults.shape", (cloned) => {
      delete (cloned.manifest.tool_defaults as unknown as Record<string, unknown>).render_detail_id;
    });
    expectInvalid("bundle.tool_defaults.invalid_render_detail_id", (cloned) => {
      cloned.manifest.tool_defaults.render_detail_id = "";
    });
    expectInvalid("bundle.tool_defaults.unknown_render_detail", (cloned) => {
      cloned.manifest.tool_defaults.render_detail_id = "full";
    });
  });

  it("requires exact boolean detail policy coverage for every rendering participant", () => {
    expectInvalid("bundle.render_details.policy_shape", (cloned) => {
      delete (cloned.views.views[0]!.conventions.renderer_defaults as Record<string, unknown>).detail_display;
    });
    expectInvalid("bundle.render_details.policy_coverage", (cloned) => {
      const policies = cloned.views.views[0]!.conventions.renderer_defaults!.detail_display as Record<string, unknown>;
      delete policies.compact;
    });
    expectInvalid("bundle.render_details.unknown_policy_id", (cloned) => {
      const policies = cloned.views.views[0]!.conventions.renderer_defaults!.detail_display as Record<string, unknown>;
      policies.full = {};
    });
    expectInvalid("bundle.render_details.policy_shape", (cloned) => {
      const policies = cloned.views.views[0]!.conventions.renderer_defaults!.detail_display as Record<string, unknown>;
      policies.compact = [];
    });
    expectInvalid("bundle.render_details.invalid_display_value", (cloned) => {
      const policies = cloned.views.views[0]!.conventions.renderer_defaults!.detail_display as Record<string, Record<string, unknown>>;
      policies.compact!.show_instrumentation_annotations = "no";
    });
  });

  it("requires a positive bundle-owned visible semantic node threshold for batch rendering", () => {
    for (const view of bundle.views.views) {
      expect(view.conventions.renderer_defaults?.batch_applicability).toEqual({
        kind: "visible_semantic_node_count",
        minimum: 1
      });
    }
    expectInvalid("bundle.render_batch.applicability_shape", (cloned) => {
      delete (cloned.views.views[0]!.conventions.renderer_defaults as Record<string, unknown>).batch_applicability;
    });
    expectInvalid("bundle.render_batch.applicability_shape", (cloned) => {
      cloned.views.views[0]!.conventions.renderer_defaults!.batch_applicability = {
        kind: "visible_semantic_node_count",
        minimum: 0
      };
    });
  });

  it("requires a valid bundle-owned scenario-flow layout policy", () => {
    const scenarioView = bundle.views.views.find((view) => view.id === "scenario_flow")!;
    expect(scenarioView.conventions.renderer_defaults?.scenario_flow_layout).toEqual({
      primary_lane_id: "step",
      lanes: [
        { id: "step", label: "Steps", node_types: ["Step"] },
        { id: "place", label: "Places", node_types: ["Place"] },
        { id: "view_state", label: "View States", node_types: ["ViewState"] }
      ],
      empty_lane_policy: "omit",
      component_order: "source",
      component_gap_rows: 1,
      branch_order: "source",
      trailing_track_policy: "trim"
    });

    expectInvalid("bundle.scenario_flow.layout_shape", (cloned) => {
      const view = cloned.views.views.find((candidate) => candidate.id === "scenario_flow")!;
      delete (view.conventions.renderer_defaults as Record<string, unknown>).scenario_flow_layout;
    });
    expectInvalid("bundle.scenario_flow.layout_shape", (cloned) => {
      const view = cloned.views.views.find((candidate) => candidate.id === "scenario_flow")!;
      view.conventions.renderer_defaults!.scenario_flow_layout!.component_gap_rows = -1;
    });
    for (const value of [undefined, "compact", 0]) {
      expectInvalid("bundle.scenario_flow.layout_shape", (cloned) => {
        const view = cloned.views.views.find((candidate) => candidate.id === "scenario_flow")!;
        (view.conventions.renderer_defaults!.scenario_flow_layout as unknown as Record<string, unknown>).trailing_track_policy = value;
      });
    }
    expectInvalid("bundle.scenario_flow.layout_shape", (cloned) => {
      const view = cloned.views.views.find((candidate) => candidate.id === "scenario_flow")!;
      view.conventions.renderer_defaults!.scenario_flow_layout!.lanes.push({
        ...view.conventions.renderer_defaults!.scenario_flow_layout!.lanes[0]!
      });
    });
  });

  it("requires a valid bundle-owned journey-map layout policy", () => {
    const journeyView = bundle.views.views.find((view) => view.id === "journey_map")!;
    expect(journeyView.conventions.renderer_defaults?.journey_map_layout).toEqual({
      branch_placement: "stacked",
      branch_order: "source",
      scope: "sibling_steps",
      disconnected_components: "source_sequential",
      unsupported_branch_fallback: "source_row"
    });

    expectInvalid("bundle.journey_map.layout_shape", (cloned) => {
      const view = cloned.views.views.find((candidate) => candidate.id === "journey_map")!;
      delete (view.conventions.renderer_defaults as Record<string, unknown>).journey_map_layout;
    });
    expectInvalid("bundle.journey_map.layout_shape", (cloned) => {
      const view = cloned.views.views.find((candidate) => candidate.id === "journey_map")!;
      view.conventions.renderer_defaults!.journey_map_layout!.branch_placement = "sideways" as "stacked";
    });
  });

  it("requires exact cell-sizing contracts for the two tiered grid backends", () => {
    for (const viewId of ["scenario_flow", "service_blueprint"]) {
      const view = bundle.views.views.find(candidate => candidate.id === viewId)!;
      expect(view.conventions.renderer_defaults!.cell_sizing).toEqual(viewId === "scenario_flow"
        ? { node_tier_scope: "lane", stack_alignment: "start" }
        : { node_tier_scope: "diagram", stack_alignment: "center" });
      for (const value of [undefined, [], {},
        { node_tier_scope: "row", stack_alignment: "start" },
        { node_tier_scope: "lane", stack_alignment: "end" },
        { node_tier_scope: "lane", stack_alignment: "start", extra: true }
      ]) {
        expectInvalid("bundle.renderer.cell_sizing_shape", cloned => {
          const defaults = cloned.views.views.find(candidate => candidate.id === viewId)!.conventions.renderer_defaults!;
          (defaults as Record<string, unknown>).cell_sizing = value;
        });
      }
    }
  });

  it("fingerprints tier scope, alignment, and trailing-track policy independently", () => {
    for (const key of ["scope", "alignment", "trailing"] as const) {
      const cloned = cloneBundle();
      const defaults = cloned.views.views.find(view => view.id === "scenario_flow")!.conventions.renderer_defaults!;
      if (key === "scope") defaults.cell_sizing!.node_tier_scope = "diagram";
      if (key === "alignment") defaults.cell_sizing!.stack_alignment = "center";
      if (key === "trailing") defaults.scenario_flow_layout!.trailing_track_policy = "preserve";
      validateLoadedBundle(cloned);
      expect(computeBundleFingerprint(cloned)).not.toBe(computeBundleFingerprint(bundle));
    }
  });

  it("cross-checks the renderer registry without embedding view IDs in bundle validation", () => {
    const participants = bundle.views.views
      .filter((view) => view.conventions.renderer_defaults !== undefined)
      .map((view) => view.id);
    expect(participants).toEqual(getKnownRenderableViewIds(bundle));
  });

  it("exposes only the declared compact and detailed display policies", () => {
    for (const view of bundle.views.views) {
      const defaults = view.conventions.renderer_defaults as Record<string, unknown>;
      expect(defaults).not.toHaveProperty("profile_display");
      expect(Object.keys(defaults.detail_display as Record<string, unknown>)).toEqual(["compact", "detailed"]);
      expect(resolveDetailDisplayPolicy(view, "compact")).toEqual(
        (defaults.detail_display as Record<string, unknown>).compact
      );
      expect(resolveDetailDisplayPolicy(view, "detailed")).toEqual(
        (defaults.detail_display as Record<string, unknown>).detailed
      );
    }
  });

  it("includes fallback and per-view policy changes in the bundle fingerprint", () => {
    const fallbackChanged = cloneBundle();
    fallbackChanged.manifest.tool_defaults.render_detail_id = "detailed";
    expect(computeBundleFingerprint(fallbackChanged)).not.toBe(computeBundleFingerprint(bundle));

    const policyChanged = cloneBundle();
    const policy = policyChanged.views.views[0]!.conventions.renderer_defaults!.detail_display as Record<string, Record<string, boolean>>;
    policy.compact!.show_instrumentation_annotations = true;
    expect(computeBundleFingerprint(policyChanged)).not.toBe(computeBundleFingerprint(bundle));

    const applicabilityChanged = cloneBundle();
    applicabilityChanged.views.views[0]!.conventions.renderer_defaults!.batch_applicability!.minimum = 2;
    expect(computeBundleFingerprint(applicabilityChanged)).not.toBe(computeBundleFingerprint(bundle));

    const scenarioLayoutChanged = cloneBundle();
    const scenarioView = scenarioLayoutChanged.views.views.find((view) => view.id === "scenario_flow")!;
    scenarioView.conventions.renderer_defaults!.scenario_flow_layout!.component_gap_rows = 2;
    expect(computeBundleFingerprint(scenarioLayoutChanged)).not.toBe(computeBundleFingerprint(bundle));

    const journeyLayoutChanged = cloneBundle();
    const journeyView = journeyLayoutChanged.views.views.find((view) => view.id === "journey_map")!;
    journeyView.conventions.renderer_defaults!.journey_map_layout!.branch_placement = "inline";
    expect(computeBundleFingerprint(journeyLayoutChanged)).not.toBe(computeBundleFingerprint(bundle));
  });

  it("fails unsupported view/detail resolution rather than falling back", () => {
    const view = bundle.views.views[0]!;
    expect(() => resolveDetailDisplayPolicy(view, "full")).toThrow("does not support render detail 'full'");
    const missing = structuredClone(view);
    delete (missing.conventions.renderer_defaults as Record<string, unknown>).detail_display;
    expect(() => resolveDetailDisplayPolicy(missing, "compact")).toThrow("does not declare");
  });
});
