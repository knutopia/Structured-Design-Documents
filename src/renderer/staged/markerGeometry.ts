import type { Point, EdgeMarkerKind } from "./contracts.js";

/** Shared axial anchor/footprint used by SVG painting and final routing clearance. */
export function arrowMarkerReferenceX(direction: "start" | "end", arrowSize: number): number {
  return direction === "end" ? arrowSize - 1 : 1;
}
export function markerRoutingClearance(marker: EdgeMarkerKind | undefined, arrowSize: number, strokeWidth: number): number {
  // Unmarked endpoints have no painted marker footprint; endpoint and port-stub rules still apply.
  return marker === "arrow" ? Math.max(12, arrowMarkerReferenceX("end", arrowSize) + strokeWidth / 2) : 0;
}

/** Bounding box of the filled arrow path painted by UI Contracts. */
export function arrowMarkerFootprintBox(
  tip: Point, neighbor: Point, arrowSize: number, strokeWidth: number
): { x: number; y: number; width: number; height: number } | undefined {
  const length = Math.hypot(tip.x - neighbor.x, tip.y - neighbor.y);
  if (length <= 0) return undefined;
  const dx = (tip.x - neighbor.x) / length;
  const dy = (tip.y - neighbor.y) / length;
  const base = { x: tip.x - dx * (arrowSize - 1), y: tip.y - dy * (arrowSize - 1) };
  const corners = [
    { x: tip.x + dx, y: tip.y + dy },
    { x: base.x - dy * arrowSize / 2, y: base.y + dx * arrowSize / 2 },
    { x: base.x + dy * arrowSize / 2, y: base.y - dx * arrowSize / 2 }
  ];
  const inset = strokeWidth / 2;
  const x = Math.min(...corners.map((corner) => corner.x)) - inset;
  const y = Math.min(...corners.map((corner) => corner.y)) - inset;
  return {
    x, y,
    width: Math.max(...corners.map((corner) => corner.x)) - x + inset,
    height: Math.max(...corners.map((corner) => corner.y)) - y + inset
  };
}
