import { getBundleValidationProfileFallback } from "../bundle/toolDefaults.js";
import type { Bundle } from "../bundle/types.js";

export function resolveCliValidationProfile(bundle: Bundle, explicitProfileId?: string): string {
  return explicitProfileId ?? getBundleValidationProfileFallback(bundle);
}
