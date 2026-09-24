import type { LabelBox, RouteSegmentDetail } from "./connectorLabelPlacement.js";

/** Painted-line clearance shared by placement repair and final audit. */
export function labelBoxIntersectsSegment(box: LabelBox, segment: RouteSegmentDetail, clearance = 0.5): boolean {
  return segment.orientation === "vertical"
    ? segment.coordinate >= box.x - clearance
      && segment.coordinate <= box.x + box.width + clearance
      && spansOverlap(
        Math.min(segment.start.y, segment.end.y),
        Math.max(segment.start.y, segment.end.y),
        box.y, box.y + box.height
      )
    : segment.coordinate >= box.y - clearance
      && segment.coordinate <= box.y + box.height + clearance
      && spansOverlap(
        Math.min(segment.start.x, segment.end.x),
        Math.max(segment.start.x, segment.end.x),
        box.x, box.x + box.width
      );
}

function spansOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return Math.min(endA, endB) - Math.max(startA, startB) > 0.01;
}

/** Independent paint-box overlap check; smaller tolerance than candidate search. */
export function labelBoxesOverlap(left: LabelBox, right: LabelBox): boolean {
  const epsilon = 0.01;
  return left.x < right.x + right.width - epsilon
    && left.x + left.width > right.x + epsilon
    && left.y < right.y + right.height - epsilon
    && left.y + left.height > right.y + epsilon;
}

/** Distance from a label box to a whole route segment, including its endpoints. */
export function labelBoxDistanceToSegment(box: LabelBox, segment: RouteSegmentDetail): number {
  const minX = Math.min(segment.start.x, segment.end.x);
  const maxX = Math.max(segment.start.x, segment.end.x);
  const minY = Math.min(segment.start.y, segment.end.y);
  const maxY = Math.max(segment.start.y, segment.end.y);
  const dx = Math.max(minX - box.x - box.width, box.x - maxX, 0);
  const dy = Math.max(minY - box.y - box.height, box.y - maxY, 0);
  return Math.hypot(dx, dy);
}
