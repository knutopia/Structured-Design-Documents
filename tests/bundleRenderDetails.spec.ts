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
  });

  it("fails unsupported view/detail resolution rather than falling back", () => {
    const view = bundle.views.views[0]!;
    expect(() => resolveDetailDisplayPolicy(view, "full")).toThrow("does not support render detail 'full'");
    const missing = structuredClone(view);
    delete (missing.conventions.renderer_defaults as Record<string, unknown>).detail_display;
    expect(() => resolveDetailDisplayPolicy(missing, "compact")).toThrow("does not declare");
  });
});
