import type { ViewSpec } from "../bundle/types.js";

export type ResolvedDetailDisplayPolicy = Record<string, boolean>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function resolveDetailDisplayPolicy(
  view: ViewSpec,
  detailId: string
): ResolvedDetailDisplayPolicy {
  const detailDisplay = view.conventions.renderer_defaults?.detail_display;
  if (!isRecord(detailDisplay)) {
    throw new Error(`View '${view.id}' does not declare renderer_defaults.detail_display`);
  }

  const rawPolicy = detailDisplay[detailId];
  if (!isRecord(rawPolicy)) {
    throw new Error(`View '${view.id}' does not support render detail '${detailId}'`);
  }

  const policy: ResolvedDetailDisplayPolicy = {};
  for (const [key, value] of Object.entries(rawPolicy)) {
    if (typeof value !== "boolean") {
      throw new Error(`View '${view.id}' render detail '${detailId}' setting '${key}' must be boolean`);
    }
    policy[key] = value;
  }
  return policy;
}

export function readBooleanDetailDisplaySetting(
  policy: ResolvedDetailDisplayPolicy,
  key: string
): boolean {
  if (!policy) {
    throw new Error(`Render detail policy is required to read boolean setting '${key}'`);
  }
  const value = policy[key];
  if (typeof value !== "boolean") {
    throw new Error(`Render detail policy is missing boolean setting '${key}'`);
  }
  return value;
}
