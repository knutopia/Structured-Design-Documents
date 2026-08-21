import { getBundleValidationProfileFallback } from "../bundle/toolDefaults.js";
import type { Bundle } from "../bundle/types.js";
import { loadDefaultsSources, resolveDefault } from "../config/resolver.js";
import type { DefaultsConfigRuntime } from "../config/runtime.js";
import type { ResolvedDefault } from "../config/types.js";

export async function resolveCliValidationProfile(
  runtime: DefaultsConfigRuntime,
  cwd: string,
  bundle: Bundle,
  explicitProfileId?: string
): Promise<ResolvedDefault> {
  const sources = await loadDefaultsSources(runtime, cwd);
  return resolveDefault({
    setting: "validation_profile_id",
    explicitValue: explicitProfileId,
    sources,
    bundleValue: getBundleValidationProfileFallback(bundle),
    availableValues: bundle.manifest.profiles.map((profile) => profile.id),
    bundlePath: bundle.manifestPath
  });
}
