import type { RendererScene, SceneItem } from "./contracts.js";
import { ROUTING_METRIC_PRECISION } from "./routingCore/geometry.js";

/** Renderer resources refer to actual scene-tree ownership, never nearest boxes. */
export type UiCapacityResource =
  | { kind: "padding"; containerId: string; side: "top" | "right" | "bottom" | "left" }
  | { kind: "gap"; containerId: string; beforeId: string; afterId: string }
  | { kind: "node_extent"; nodeId: string; axis: "x" | "y" };
export interface UiCapacityRequirement {
  resource: UiCapacityResource;
  minimumExtent: number;
  reason: "label_envelope" | "route_clearance" | "port_capacity";
  connectorIds: string[];
}
export function uiCapacityResourceKey(requirement: UiCapacityRequirement): string { return JSON.stringify(requirement.resource); }

/** Merge one candidate's absolute lower bounds, without combining alternatives. */
export function mergeUiCapacityRequirements(ledger: readonly UiCapacityRequirement[], requests: readonly UiCapacityRequirement[]): UiCapacityRequirement[] {
  const merged = new Map<string, UiCapacityRequirement>();
  for (const request of [...ledger, ...requests]) {
    if (!Number.isFinite(request.minimumExtent) || request.minimumExtent < 0) throw new RangeError("Capacity extents must be finite and nonnegative.");
    const key = uiCapacityResourceKey(request), previous = merged.get(key);
    merged.set(key, { ...request, resource: { ...request.resource },
      minimumExtent: Math.max(previous?.minimumExtent ?? 0, Math.ceil(request.minimumExtent * ROUTING_METRIC_PRECISION) / ROUTING_METRIC_PRECISION),
      connectorIds: [...new Set([...(previous?.connectorIds ?? []), ...request.connectorIds])] });
  }
  return [...merged].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, request]) => request);
}

/** Validate the entire ledger before applying it to a freshly built scene. */
export function applyUiCapacityRequirements(scene: RendererScene, ledger: readonly UiCapacityRequirement[]):
  { status: "applied"; changed: boolean } | { status: "unsupported_capacity_owner"; resource: UiCapacityResource } {
  const items = new Map<string, SceneItem>();
  const visit = (item: SceneItem) => { items.set(item.id, item); if (item.kind === "container") item.children.forEach(visit); };
  visit(scene.root);
  for (const request of ledger) {
    if (!Number.isFinite(request.minimumExtent) || request.minimumExtent < 0) throw new RangeError("Capacity extents must be finite and nonnegative.");
    const resource = request.resource;
    const owner = items.get(resource.kind === "node_extent" ? resource.nodeId : resource.containerId);
    if (resource.kind === "node_extent") {
      if (owner?.kind !== "node") return { status: "unsupported_capacity_owner", resource };
    } else if (owner?.kind !== "container") return { status: "unsupported_capacity_owner", resource };
    else if (resource.kind === "gap") {
      const index = owner.children.findIndex(child => child.id === resource.beforeId);
      if (owner.layout.strategy !== "stack" || owner.layout.pack || index < 0 || owner.children[index + 1]?.id !== resource.afterId)
        return { status: "unsupported_capacity_owner", resource };
    }
  }
  let changed = false;
  for (const request of ledger) {
    const resource = request.resource;
    if (resource.kind === "node_extent") continue; // consumed by production measurement
    const owner = items.get(resource.containerId)!;
    if (owner.kind !== "container") continue;
    if (resource.kind === "padding") {
      const next = Math.max(owner.chrome.padding[resource.side], request.minimumExtent);
      changed ||= next > owner.chrome.padding[resource.side]; owner.chrome.padding[resource.side] = next;
    } else {
      const previous = owner.layout.gapAfter?.[resource.beforeId] ?? owner.layout.gap ?? 0, next = Math.max(previous, request.minimumExtent);
      changed ||= next > previous; owner.layout.gapAfter = { ...owner.layout.gapAfter, [resource.beforeId]: next };
    }
  }
  return { status: "applied", changed };
}

/** Preliminary builders and final allocation communicate the same typed demand. */
export class UiPortCapacityError extends Error {
  constructor(readonly requirements: UiCapacityRequirement[], readonly originalHeightFloors: ReadonlyMap<string, number> = new Map(),
    readonly originalNodeExtents: ReadonlyMap<string, { width: number; height: number }> = new Map()) {
    super("Declared attachment ordering exceeds measured node-side capacity.");
  }
}
