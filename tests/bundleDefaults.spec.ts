import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { loadBundle } from "../src/bundle/loadBundle.js";
import {
  bundleManifestPath,
  loadBundleVersion,
  loadSelectedBundle
} from "../src/cli/bundleResolution.js";
import type { DefaultsConfigRuntime } from "../src/config/index.js";
import type { Bundle } from "../src/bundle/types.js";

function runtime(global?: string): DefaultsConfigRuntime {
  return {
    getGlobalConfigPath: () => "/user/config/sdd/config.yaml",
    read: vi.fn(async () => global === undefined
      ? undefined
      : { version: "1", defaults: { bundle_version: global } }),
    set: vi.fn(),
    unset: vi.fn()
  };
}

describe("default bundle selection", () => {
  it("uses v0.1 when no bundle preference is stored", async () => {
    const result = await loadSelectedBundle(
      runtime(),
      (manifestPath) => loadBundle(manifestPath),
      undefined,
      path.resolve(".")
    );
    expect(result.selection).toMatchObject({
      version: "0.1",
      source: "default",
      manifestPath: bundleManifestPath("0.1", path.resolve("."))
    });
    expect(result.bundle.manifest.bundle_version).toBe("0.1");
  });

  it("maps a saved version and validates the manifest version", async () => {
    const savedBundle = {
      manifest: { bundle_version: "0.2" }
    } as Bundle;
    const load = vi.fn(async () => savedBundle);
    const result = await loadSelectedBundle(runtime("0.2"), load, undefined, "/repo");
    expect(load).toHaveBeenCalledWith("/repo/bundle/v0.2/manifest.yaml");
    expect(result.selection.source).toBe("global");
  });

  it("rejects missing and mismatched saved bundles", async () => {
    await expect(loadSelectedBundle(runtime("0.2"), async () => {
      throw Object.assign(new Error("missing"), { code: "ENOENT" });
    }, undefined, "/repo")).rejects.toMatchObject({
      code: "config.bundle_not_found"
    });

    await expect(loadBundleVersion(async () => ({ manifest: { bundle_version: "0.1" } } as Bundle), "0.2", "/repo"))
      .rejects.toMatchObject({ code: "config.bundle_version_mismatch" });
  });

  it("lets an explicit manifest bypass the saved bundle preference", async () => {
    const load = vi.fn(async () => ({ manifest: { bundle_version: "custom" } } as Bundle));
    const result = await loadSelectedBundle(runtime("0.2"), load, "/custom/manifest.yaml", "/repo");
    expect(load).toHaveBeenCalledWith("/custom/manifest.yaml");
    expect(result.selection.source).toBe("cli");
    expect(result.selection.version).toBeUndefined();
    expect(result.bundle.manifest.bundle_version).toBe("custom");
  });
});
