import type { RendererCellSizingConfig, ViewSpec } from "./types.js";

export function isRendererCellSizingConfig(value: unknown): value is RendererCellSizingConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const policy = value as Record<string, unknown>;
  return Object.keys(policy).length === 2
    && (policy.node_tier_scope === "lane" || policy.node_tier_scope === "diagram")
    && (policy.stack_alignment === "start" || policy.stack_alignment === "center");
}

export function resolveCellSizingPolicy(view: ViewSpec): RendererCellSizingConfig {
  const policy = view.conventions.renderer_defaults?.cell_sizing;
  if (!isRendererCellSizingConfig(policy)) {
    throw new Error(`View '${view.id}' must declare valid renderer_defaults.cell_sizing`);
  }
  return { ...policy };
}
