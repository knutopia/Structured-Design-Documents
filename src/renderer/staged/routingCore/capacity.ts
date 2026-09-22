import { DEFAULT_ROUTING_POLICY, type RoutingBox, type RoutingSegment, type RoutingPolicy } from "./contracts.js";

export interface RoutingCorridorDeficit {
  axis: RoutingSegment["axis"];
  beforeBoxId: string;
  afterBoxId: string;
  requiredSize: number;
  availableSize: number;
}

/** Measures simultaneous tracks between solid node walls, including the margins
 * already owned by those nodes. Layout ownership/application stays with callers. */
export function measureRoutingCorridorDeficits(
  segments: readonly RoutingSegment[],
  boxes: readonly RoutingBox[],
  overrides: Partial<RoutingPolicy> = {}
): RoutingCorridorDeficit[] {
  const policy = { ...DEFAULT_ROUTING_POLICY, ...overrides };
  const result = new Map<string, RoutingCorridorDeficit>();
  for (const axis of ["vertical", "horizontal"] as const) {
    const vertical = axis === "vertical";
    const runs = segments.filter(s => s.axis === axis);
    const coordinate = (b: RoutingBox) => vertical ? b.x : b.y;
    const size = (b: RoutingBox) => vertical ? b.width : b.height;
    const spanStart = (b: RoutingBox) => vertical ? b.y : b.x;
    const spanEnd = (b: RoutingBox) => spanStart(b) + (vertical ? b.height : b.width);
    for (const before of boxes) for (const after of boxes) {
      const low = coordinate(before) + size(before), high = coordinate(after);
      if (high <= low + policy.epsilon) continue;
      const start = Math.max(spanStart(before), spanStart(after));
      const end = Math.min(spanEnd(before), spanEnd(after));
      if (end - start <= policy.epsilon) continue;
      // A nearer wall owns this corridor; do not sum capacities across nodes.
      if (boxes.some(b => b !== before && b !== after && coordinate(b) >= low - policy.epsilon
        && coordinate(b) + size(b) <= high + policy.epsilon
        && Math.min(end, spanEnd(b)) - Math.max(start, spanStart(b)) > policy.epsilon)) continue;
      const inside = runs.filter(s => s.coordinate > low + policy.epsilon && s.coordinate < high - policy.epsilon
        && Math.min(end, s.spanEnd) - Math.max(start, s.spanStart) > policy.epsilon);
      if (inside.length < 2) continue;
      const events = [...new Set([start, end, ...inside.flatMap(s => [Math.max(start, s.spanStart), Math.min(end, s.spanEnd)])])].sort((a, b) => a - b);
      let tracks = 0;
      for (let i = 1; i < events.length; i++) {
        if (events[i]! - events[i - 1]! <= policy.epsilon) continue;
        const sample = (events[i]! + events[i - 1]!) / 2;
        const active = inside.filter(s => s.spanStart < sample && s.spanEnd > sample);
        tracks = Math.max(tracks, new Set(active.map(s => s.sharedTrackGroupId === undefined
          ? `connector:${s.connectorId}` : `group:${s.sharedTrackGroupId}`)).size);
      }
      if (tracks < 2) continue;
      const requiredSize = (before.clearance ?? 0) + (tracks - 1) * policy.minSeparation + (after.clearance ?? 0);
      if (requiredSize <= high - low + policy.epsilon) continue;
      result.set(`${axis}:${before.id}:${after.id}`, { axis, beforeBoxId: before.id, afterBoxId: after.id,
        requiredSize, availableSize: high - low });
    }
  }
  return [...result.values()];
}
