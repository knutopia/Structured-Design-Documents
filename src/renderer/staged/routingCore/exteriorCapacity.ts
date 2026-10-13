import type { PortSide } from "../contracts.js";
import { validRoutingBounds, type RoutingBounds } from "./bounds.js";

export interface ExteriorRoutingCorridorClaim {
  connectorId: string;
  spanStart: number;
  spanEnd: number;
}
export interface ExteriorRoutingCorridorInput {
  bounds: RoutingBounds;
  side: PortSide;
  boxes: readonly { x: number; y: number; width: number; height: number }[];
  /** Each claim represents one physical track; normalize shared observations first. */
  claims: readonly ExteriorRoutingCorridorClaim[];
  clearance: number;
  separation: number;
}
/** Measure the largest actual exterior-space deficit across cross-axis intervals.
 * Disjoint track spans reuse corridor space rather than accumulating global demand. */
export function measureExteriorRoutingCorridorDeficit(input: ExteriorRoutingCorridorInput): number {
  const { bounds, side, clearance, separation } = input;
  if (!validRoutingBounds(bounds) || !["west", "east", "north", "south"].includes(side)
    || ![clearance, separation].every(Number.isFinite) || clearance < 0 || separation <= 0
    || input.boxes.some(box => ![box.x, box.y, box.width, box.height].every(Number.isFinite) || box.width < 0 || box.height < 0)
    || input.claims.some(claim => ![claim.spanStart, claim.spanEnd].every(Number.isFinite))) {
    throw new RangeError("Exterior routing capacity requires finite ordered geometry and nonnegative clearance with positive separation.");
  }
  const vertical = side === "west" || side === "east";
  const min = vertical ? bounds.minY : bounds.minX;
  const max = vertical ? bounds.maxY : bounds.maxX;
  const span = (box: ExteriorRoutingCorridorInput["boxes"][number]) => vertical
    ? [box.y, box.y + box.height] as const : [box.x, box.x + box.width] as const;
  const events = new Set([min, max]);
  const add = (value: number) => { if (value >= min && value <= max) events.add(value); };
  for (const claim of input.claims) { add(claim.spanStart); add(claim.spanEnd); }
  for (const box of input.boxes) { const [start,end] = span(box); add(start); add(end); }
  const ordered = [...events].sort((a,b) => a-b);
  let deficit = 0;
  for (let index = 1; index < ordered.length; index++) {
    const start = ordered[index-1]!, end = ordered[index]!;
    if (start === end) continue;
    const active = input.claims.filter(claim => Math.min(claim.spanStart,claim.spanEnd) < end && Math.max(claim.spanStart,claim.spanEnd) > start).length;
    if (!active) continue;
    const boxes = input.boxes.filter(box => { const [a,b] = span(box); return a < end && b > start; });
    const available = side === "west" ? Math.min(bounds.maxX,...boxes.map(box=>box.x)) - bounds.minX
      : side === "east" ? bounds.maxX - Math.max(bounds.minX,...boxes.map(box=>box.x+box.width))
      : side === "north" ? Math.min(bounds.maxY,...boxes.map(box=>box.y)) - bounds.minY
      : bounds.maxY - Math.max(bounds.minY,...boxes.map(box=>box.y+box.height));
    deficit = Math.max(deficit, 2*clearance + (active-1)*separation - available);
  }
  return deficit;
}
