import type { ViewSpec } from "../bundle/types.js";

export type ResolvedProfileDisplayPolicy = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function resolveProfileDisplayPolicy(view: ViewSpec, profileId: string): ResolvedProfileDisplayPolicy {
  const profileDisplay = view.conventions.renderer_defaults?.profile_display;
  if (!isRecord(profileDisplay)) {
    return {};
  }

  const defaults = isRecord(profileDisplay.default) ? profileDisplay.default : {};
  const profileOverrides = isRecord(profileDisplay[profileId]) ? profileDisplay[profileId] : {};
  return {
    ...defaults,
    ...profileOverrides
  };
}

export function readBooleanProfileDisplaySetting(
  policy: ResolvedProfileDisplayPolicy,
  key: string,
  defaultValue: boolean
): boolean {
  const value = policy[key];
  return typeof value === "boolean" ? value : defaultValue;
}
