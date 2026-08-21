import type { ViewSpec } from "../src/bundle/types.js";

export type ResolvedLegacyProfileDisplayPolicy = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function resolveProfileDisplayPolicy(
  view: ViewSpec,
  profileId: string
): ResolvedLegacyProfileDisplayPolicy {
  const profileDisplay = view.conventions.renderer_defaults?.profile_display;
  if (!isRecord(profileDisplay)) return {};
  const defaults = isRecord(profileDisplay.default) ? profileDisplay.default : {};
  const profileOverrides = isRecord(profileDisplay[profileId]) ? profileDisplay[profileId] : {};
  return { ...defaults, ...profileOverrides };
}
