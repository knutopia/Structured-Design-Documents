import path from "node:path";
import { loadDefaultsSources } from "../config/resolver.js";
import { DefaultsConfigError, type DefaultsConfigRuntime } from "../config/index.js";
import type { LoadedDefaultsSources } from "../config/types.js";
import type { Bundle } from "../bundle/types.js";

export const DEFAULT_BUNDLE_VERSION = "0.1";

export type BundleSelectionSource = "cli" | "global" | "default";

export interface BundleSelection {
  version?: string;
  manifestPath: string;
  source: BundleSelectionSource;
}

export function bundleManifestPath(version: string, baseDirectory = process.cwd()): string {
  return path.resolve(baseDirectory, "bundle", `v${version}`, "manifest.yaml");
}

function selectionFromSources(
  sources: LoadedDefaultsSources,
  baseDirectory: string
): BundleSelection {
  const configuredVersion = sources.global?.config.defaults.bundle_version;
  const version = configuredVersion ?? DEFAULT_BUNDLE_VERSION;
  return {
    version,
    manifestPath: bundleManifestPath(version, baseDirectory),
    source: configuredVersion === undefined ? "default" : "global"
  };
}

export async function resolveBundleSelection(
  runtime: DefaultsConfigRuntime,
  explicitManifestPath?: string,
  baseDirectory = process.cwd()
): Promise<BundleSelection> {
  if (explicitManifestPath !== undefined) {
    return {
      manifestPath: explicitManifestPath,
      source: "cli"
    };
  }

  return selectionFromSources(await loadDefaultsSources(runtime), baseDirectory);
}

function errorCode(error: unknown): string | undefined {
  return error && typeof error === "object" && "code" in error && typeof error.code === "string"
    ? error.code
    : error && typeof error === "object" && "cause" in error
      ? errorCode(error.cause)
      : undefined;
}

export async function loadSelectedBundle(
  runtime: DefaultsConfigRuntime,
  load: (manifestPath: string) => Promise<Bundle>,
  explicitManifestPath?: string,
  baseDirectory = process.cwd()
): Promise<{ bundle: Bundle; selection: BundleSelection; sources?: LoadedDefaultsSources }> {
  const sources = explicitManifestPath === undefined ? await loadDefaultsSources(runtime) : undefined;
  const selection = explicitManifestPath === undefined
    ? selectionFromSources(sources!, baseDirectory)
    : { manifestPath: explicitManifestPath, source: "cli" as const };
  let bundle: Bundle;
  try {
    bundle = await load(selection.manifestPath);
  } catch (error) {
    if (selection.version !== undefined && errorCode(error) === "ENOENT") {
      throw new DefaultsConfigError(
        "config.bundle_not_found",
        `Bundle version '${selection.version}' was not found at '${selection.manifestPath}'.`
      );
    }
    throw error;
  }

  if (selection.version !== undefined && bundle.manifest.bundle_version !== selection.version) {
    throw new DefaultsConfigError(
      "config.bundle_version_mismatch",
      `Bundle version '${selection.version}' resolved to '${selection.manifestPath}', but the manifest declares '${bundle.manifest.bundle_version}'.`
    );
  }

  return { bundle, selection, sources };
}

export async function loadBundleVersion(
  load: (manifestPath: string) => Promise<Bundle>,
  version: string,
  baseDirectory = process.cwd()
): Promise<{ bundle: Bundle; manifestPath: string }> {
  const manifestPath = bundleManifestPath(version, baseDirectory);
  let bundle: Bundle;
  try {
    bundle = await load(manifestPath);
  } catch (error) {
    if (errorCode(error) === "ENOENT") {
      throw new DefaultsConfigError(
        "config.bundle_not_found",
        `Bundle version '${version}' was not found at '${manifestPath}'.`
      );
    }
    throw error;
  }

  if (bundle.manifest.bundle_version !== version) {
    throw new DefaultsConfigError(
      "config.bundle_version_mismatch",
      `Bundle version '${version}' resolved to '${manifestPath}', but the manifest declares '${bundle.manifest.bundle_version}'.`
    );
  }

  return { bundle, manifestPath };
}
