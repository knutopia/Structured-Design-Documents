import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { beforeAll, describe, expect, it } from "vitest";
import {
  BundleValidationError,
  collectBundleDiagnostics,
  computeBundleFingerprint,
  getBundleNodeDecoratorModeFallback,
  getBundleValidationProfileFallback,
  loadBundle,
  renderSource,
  validateLoadedBundle
} from "../src/index.js";
import type {
  Bundle,
  BundleManifestNodeDecoratorModeEntry,
  BundleManifestToolDefaults,
  ProfileId
} from "../src/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bundleRoot = path.join(repoRoot, "bundle/v0.1");
const manifestPath = path.join(bundleRoot, "manifest.yaml");

let bundle: Bundle;

beforeAll(async () => {
  bundle = await loadBundle(manifestPath);
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

async function readOutcomeInput(root: string) {
  const sourcePath = path.join(root, "examples/outcome_to_ia_trace.sdd");
  return {
    path: sourcePath,
    text: await readFile(sourcePath, "utf8")
  };
}

describe("bundle tool defaults", () => {
  it("loads the shipped simple validation fallback through the public accessor", () => {
    const toolDefaults: BundleManifestToolDefaults = bundle.manifest.tool_defaults;
    const profileId: ProfileId = getBundleValidationProfileFallback(bundle);
    expect(toolDefaults.validation_profile_id).toBe("simple");
    expect(profileId).toBe("simple");
    expect(collectBundleDiagnostics(bundle)).toEqual([]);
  });

  it("rejects missing, malformed, empty, and unknown validation defaults", () => {
    expectInvalid("bundle.tool_defaults.shape", (cloned) => {
      delete (cloned.manifest as unknown as Record<string, unknown>).tool_defaults;
    });
    expectInvalid("bundle.tool_defaults.shape", (cloned) => {
      (cloned.manifest as unknown as Record<string, unknown>).tool_defaults = [];
    });
    expectInvalid("bundle.tool_defaults.shape", (cloned) => {
      (cloned.manifest.tool_defaults as unknown as Record<string, unknown>).unexpected = true;
    });
    expectInvalid("bundle.tool_defaults.invalid_validation_profile_id", (cloned) => {
      cloned.manifest.tool_defaults.validation_profile_id = "";
    });
    expectInvalid("bundle.tool_defaults.unknown_validation_profile", (cloned) => {
      cloned.manifest.tool_defaults.validation_profile_id = "recommended";
    });
  });

  it("loads bundle-owned node decorator modes and their none fallback", () => {
    const modes: BundleManifestNodeDecoratorModeEntry[] = bundle.manifest.node_decorator_modes;
    expect(modes).toEqual([
      { id: "none", intent: expect.any(String), show_node_type: false, show_node_id: false },
      { id: "type", intent: expect.any(String), show_node_type: true, show_node_id: false },
      { id: "id", intent: expect.any(String), show_node_type: false, show_node_id: true },
      { id: "type,id", intent: expect.any(String), show_node_type: true, show_node_id: true }
    ]);
    expect(getBundleNodeDecoratorModeFallback(bundle)).toBe("none");
  });

  it("rejects malformed decorator declarations and invalid decorator fallbacks", () => {
    expectInvalid("bundle.node_decorator_modes.shape", (cloned) => {
      delete (cloned.manifest as unknown as Record<string, unknown>).node_decorator_modes;
    });
    expectInvalid("bundle.node_decorator_modes.invalid_id", (cloned) => {
      cloned.manifest.node_decorator_modes[0]!.id = "";
    });
    expectInvalid("bundle.node_decorator_modes.duplicate_id", (cloned) => {
      cloned.manifest.node_decorator_modes.push({ ...cloned.manifest.node_decorator_modes[0]! });
    });
    expectInvalid("bundle.node_decorator_modes.invalid_intent", (cloned) => {
      cloned.manifest.node_decorator_modes[0]!.intent = "";
    });
    expectInvalid("bundle.node_decorator_modes.invalid_display_value", (cloned) => {
      (cloned.manifest.node_decorator_modes[0] as unknown as Record<string, unknown>).show_node_type = "yes";
    });
    expectInvalid("bundle.tool_defaults.invalid_node_decorator_mode_id", (cloned) => {
      cloned.manifest.tool_defaults.node_decorator_mode_id = "";
    });
    expectInvalid("bundle.tool_defaults.unknown_node_decorator_mode", (cloned) => {
      cloned.manifest.tool_defaults.node_decorator_mode_id = "all";
    });
  });

  it("preserves duplicate manifest profile rejection", () => {
    expectInvalid("bundle.profiles.duplicate_manifest_id", (cloned) => {
      cloned.manifest.profiles.push({ ...cloned.manifest.profiles[0]! });
    });
  });

  it("includes the validation fallback in the bundle fingerprint", () => {
    const changed = cloneBundle();
    changed.manifest.tool_defaults.validation_profile_id = "strict";
    expect(computeBundleFingerprint(changed)).not.toBe(computeBundleFingerprint(bundle));
  });

  it("includes decorator declarations and fallback in the bundle fingerprint", () => {
    const policyChanged = cloneBundle();
    policyChanged.manifest.node_decorator_modes[0]!.show_node_id = true;
    expect(computeBundleFingerprint(policyChanged)).not.toBe(computeBundleFingerprint(bundle));

    const fallbackChanged = cloneBundle();
    fallbackChanged.manifest.tool_defaults.node_decorator_mode_id = "type";
    expect(computeBundleFingerprint(fallbackChanged)).not.toBe(computeBundleFingerprint(bundle));
  });

  it("uses one effective profile for omitted and explicit library rendering", async () => {
    const input = await readOutcomeInput(bundleRoot);
    const omitted = renderSource(input, bundle, {
      viewId: "ia_place_map",
      format: "dot"
    });
    const explicitSimple = renderSource(input, bundle, {
      viewId: "ia_place_map",
      format: "dot",
      profileId: "simple",
    detailId: "compact"
    });
    const explicitStrict = renderSource(input, bundle, {
      viewId: "ia_place_map",
      format: "dot",
      profileId: "strict",
    detailId: "detailed"
    });

    expect(omitted.profileId).toBe("simple");
    expect(omitted.text).toBe(explicitSimple.text);
    expect(omitted.diagnostics).toEqual(explicitSimple.diagnostics);
    expect(explicitStrict.profileId).toBe("strict");
    expect(explicitStrict.text).not.toBe(explicitSimple.text);
  });

  it("reports the effective profile on compile and unknown-profile failures", async () => {
    const compileFailure = renderSource({ path: "invalid.sdd", text: "NOT SDD" }, bundle, {
      viewId: "ia_place_map",
      format: "dot"
    });
    expect(compileFailure.profileId).toBe("simple");
    expect(compileFailure.text).toBeUndefined();

    const unknownProfile = renderSource(await readOutcomeInput(bundleRoot), bundle, {
      viewId: "ia_place_map",
      format: "dot",
      profileId: "recommended"
    });
    expect(unknownProfile.profileId).toBe("recommended");
    expect(unknownProfile.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "validate.unknown_profile",
        message: "Unknown profile 'recommended'"
      })
    ]));
  });

  it("changes public omitted-profile behavior from a bundle-only mutation", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "sdd-bundle-default-"));
    const tempBundleRoot = path.join(tempRoot, "v0.1");
    try {
      await cp(bundleRoot, tempBundleRoot, { recursive: true });
      const tempManifestPath = path.join(tempBundleRoot, "manifest.yaml");
      const manifest = YAML.parse(await readFile(tempManifestPath, "utf8")) as Record<string, unknown>;
      const toolDefaults = manifest.tool_defaults as Record<string, unknown>;
      toolDefaults.validation_profile_id = "strict";
      await writeFile(tempManifestPath, YAML.stringify(manifest), "utf8");

      const mutatedBundle = await loadBundle(tempManifestPath);
      const input = await readOutcomeInput(tempBundleRoot);
      const omitted = renderSource(input, mutatedBundle, {
        viewId: "ia_place_map",
        format: "dot"
      });
      const explicitStrict = renderSource(input, mutatedBundle, {
        viewId: "ia_place_map",
        format: "dot",
        profileId: "strict",
        detailId: "compact"
      });

      expect(getBundleValidationProfileFallback(mutatedBundle)).toBe("strict");
      expect(omitted.profileId).toBe("strict");
      expect(omitted.text).toBe(explicitStrict.text);
      expect(omitted.diagnostics).toEqual(explicitStrict.diagnostics);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});
