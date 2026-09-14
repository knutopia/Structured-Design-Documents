import type { EdgeMarkerKind } from "./contracts.js";

/** Shared axial anchor/footprint used by SVG painting and final routing clearance. */
export function arrowMarkerReferenceX(direction: "start" | "end", arrowSize: number): number {
  return direction === "end" ? arrowSize - 1 : 1;
}
export function markerRoutingClearance(marker: EdgeMarkerKind | undefined, arrowSize: number, strokeWidth: number): number {
  // Unmarked endpoints have no painted marker footprint; endpoint and port-stub rules still apply.
  return marker === "arrow" ? Math.max(12, arrowMarkerReferenceX("end", arrowSize) + strokeWidth / 2) : 0;
}
