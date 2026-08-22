import type { Bundle } from "./types.js";

export function getBundleValidationProfileFallback(bundle: Bundle): string {
  return bundle.manifest.tool_defaults.validation_profile_id;
}

export function getBundleRenderDetailFallback(bundle: Bundle): string {
  return bundle.manifest.tool_defaults.render_detail_id;
}
