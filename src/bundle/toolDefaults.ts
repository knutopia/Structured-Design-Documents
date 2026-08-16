import type { Bundle } from "./types.js";

export function getBundleValidationProfileFallback(bundle: Bundle): string {
  return bundle.manifest.tool_defaults.validation_profile_id;
}
