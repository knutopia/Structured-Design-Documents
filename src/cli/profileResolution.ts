import {
  getBundleNodeDecoratorModeFallback,
  getBundleRenderDetailFallback,
  getBundleValidationProfileFallback
} from "../bundle/toolDefaults.js";
import type { Bundle } from "../bundle/types.js";
import { loadDefaultsSources, resolveDefault } from "../config/resolver.js";
import type { DefaultsConfigRuntime } from "../config/runtime.js";
import type { ResolvedDefault } from "../config/types.js";

export async function resolveCliValidationProfile(
  runtime: DefaultsConfigRuntime,
  bundle: Bundle,
  explicitProfileId?: string
): Promise<ResolvedDefault> {
  const sources = await loadDefaultsSources(runtime);
  return resolveDefault({
    setting: "validation_profile_id",
    explicitValue: explicitProfileId,
    sources,
    bundleValue: getBundleValidationProfileFallback(bundle),
    availableValues: bundle.manifest.profiles.map((profile) => profile.id),
    bundlePath: bundle.manifestPath
  });
}

export interface ResolvedCliRenderSettings {
  profile: ResolvedDefault;
  detail: ResolvedDefault;
}

export interface ResolvedCliShowSettings extends ResolvedCliRenderSettings {
  decorators: ResolvedDefault;
}

export async function resolveCliRenderSettings(
  runtime: DefaultsConfigRuntime,
  bundle: Bundle,
  explicit?: { profileId?: string; detailId?: string }
): Promise<ResolvedCliRenderSettings> {
  const sources = await loadDefaultsSources(runtime);
  return {
    profile: resolveDefault({
      setting: "validation_profile_id",
      explicitValue: explicit?.profileId,
      sources,
      bundleValue: getBundleValidationProfileFallback(bundle),
      availableValues: bundle.manifest.profiles.map((profile) => profile.id),
      bundlePath: bundle.manifestPath
    }),
    detail: resolveDefault({
      setting: "render_detail_id",
      explicitValue: explicit?.detailId,
      sources,
      bundleValue: getBundleRenderDetailFallback(bundle),
      availableValues: bundle.manifest.render_details.map((detail) => detail.id),
      bundlePath: bundle.manifestPath
    })
  };
}

export async function resolveCliShowSettings(
  runtime: DefaultsConfigRuntime,
  bundle: Bundle,
  explicit?: { profileId?: string; detailId?: string; nodeDecoratorModeId?: string }
): Promise<ResolvedCliShowSettings> {
  const sources = await loadDefaultsSources(runtime);
  return {
    profile: resolveDefault({
      setting: "validation_profile_id",
      explicitValue: explicit?.profileId,
      sources,
      bundleValue: getBundleValidationProfileFallback(bundle),
      availableValues: bundle.manifest.profiles.map((profile) => profile.id),
      bundlePath: bundle.manifestPath
    }),
    detail: resolveDefault({
      setting: "render_detail_id",
      explicitValue: explicit?.detailId,
      sources,
      bundleValue: getBundleRenderDetailFallback(bundle),
      availableValues: bundle.manifest.render_details.map((detail) => detail.id),
      bundlePath: bundle.manifestPath
    }),
    decorators: resolveDefault({
      setting: "node_decorator_mode_id",
      explicitValue: explicit?.nodeDecoratorModeId,
      sources,
      bundleValue: getBundleNodeDecoratorModeFallback(bundle),
      availableValues: bundle.manifest.node_decorator_modes.map((mode) => mode.id),
      bundlePath: bundle.manifestPath
    })
  };
}
