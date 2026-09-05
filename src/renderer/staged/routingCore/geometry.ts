import type { Point, PositionedRoute } from "../contracts.js";
import {
  createRoutingSegmentId,
  type RoutingAxis,
  type RoutingBox,
  type RoutingSegment,
  type RoutingSegmentId
} from "./contracts.js";

export const ROUTING_METRIC_PRECISION = 1000;

export function roundRoutingMetric(value: number): number {
  return Math.round(value * ROUTING_METRIC_PRECISION) / ROUTING_METRIC_PRECISION;
}

export function pointsEqual(left: Point, right: Point, epsilon = 0.5): boolean {
  return Math.abs(left.x - right.x) <= epsilon && Math.abs(left.y - right.y) <= epsilon;
}

export function getSegmentAxis(start: Point, end: Point, epsilon = 0.5): RoutingAxis | undefined {
  if (Math.abs(start.y - end.y) <= epsilon) {
    return "horizontal";
  }
  if (Math.abs(start.x - end.x) <= epsilon) {
    return "vertical";
  }
  return undefined;
}

export function getSegmentCoordinate(start: Point, axis: RoutingAxis): number {
  return roundRoutingMetric(axis === "horizontal" ? start.y : start.x);
}

export function getSegmentSpan(start: Point, end: Point, axis: RoutingAxis): {
  spanStart: number;
  spanEnd: number;
} {
  return axis === "horizontal"
    ? {
        spanStart: roundRoutingMetric(Math.min(start.x, end.x)),
        spanEnd: roundRoutingMetric(Math.max(start.x, end.x))
      }
    : {
        spanStart: roundRoutingMetric(Math.min(start.y, end.y)),
        spanEnd: roundRoutingMetric(Math.max(start.y, end.y))
      };
}

export function segmentLength(start: Point, end: Point): number {
  return roundRoutingMetric(Math.abs(end.x - start.x) + Math.abs(end.y - start.y));
}

export function spansOverlap(
  leftStart: number,
  leftEnd: number,
  rightStart: number,
  rightEnd: number,
  epsilon = 0.5
): boolean {
  return Math.min(leftEnd, rightEnd) - Math.max(leftStart, rightStart) > epsilon;
}

export function spansTouchOrOverlap(
  leftStart: number,
  leftEnd: number,
  rightStart: number,
  rightEnd: number,
  epsilon = 0.5
): boolean {
  return Math.min(leftEnd, rightEnd) - Math.max(leftStart, rightStart) >= -epsilon;
}

export function spanOverlapLength(
  leftStart: number,
  leftEnd: number,
  rightStart: number,
  rightEnd: number
): number {
  return roundRoutingMetric(Math.max(
    0,
    Math.min(leftEnd, rightEnd) - Math.max(leftStart, rightStart)
  ));
}

export function collapseRoutePoints(points: readonly Point[], epsilon = 0.5): Point[] {
  const collapsed: Point[] = [];

  for (const point of points) {
    const normalized = {
      x: roundRoutingMetric(point.x),
      y: roundRoutingMetric(point.y)
    };
    const previous = collapsed[collapsed.length - 1];
    if (previous && pointsEqual(previous, normalized, epsilon)) {
      continue;
    }
    collapsed.push(normalized);

    while (collapsed.length >= 3) {
      const first = collapsed[collapsed.length - 3]!;
      const middle = collapsed[collapsed.length - 2]!;
      const last = collapsed[collapsed.length - 1]!;
      const firstAxis = getSegmentAxis(first, middle, epsilon);
      const secondAxis = getSegmentAxis(middle, last, epsilon);
      if (!firstAxis || firstAxis !== secondAxis) {
        break;
      }
      collapsed.splice(collapsed.length - 2, 1);
    }
  }

  return collapsed;
}

export interface BuildRoutingSegmentsOptions {
  candidateId?: string;
  logicalRunIds?: readonly string[];
  movableBySegmentIndex?: ReadonlyMap<number, boolean>;
  priority?: number;
  sharedTrackGroupBySegmentIndex?: ReadonlyMap<number, string>;
}

export function buildRoutingSegments(
  connectorId: string,
  route: PositionedRoute | readonly Point[],
  options: BuildRoutingSegmentsOptions = {}
): RoutingSegment[] {
  const points: readonly Point[] = "points" in route ? route.points : route;
  const candidateId = options.candidateId ?? "default";
  const segments: RoutingSegment[] = [];

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]!;
    const end = points[index + 1]!;
    const axis = getSegmentAxis(start, end);
    if (!axis || segmentLength(start, end) <= 0.5) {
      continue;
    }
    const logicalRunId = options.logicalRunIds?.[index] ?? `run-${index}`;
    const span = getSegmentSpan(start, end, axis);
    segments.push({
      id: createRoutingSegmentId(connectorId, candidateId, logicalRunId),
      connectorId,
      candidateId,
      logicalRunId,
      routeSegmentIndex: index,
      axis,
      coordinate: getSegmentCoordinate(start, axis),
      ...span,
      start: { ...start },
      end: { ...end },
      endpointRole: index === 0
        ? "source"
        : index === points.length - 2
          ? "target"
          : "internal",
      movable: options.movableBySegmentIndex?.get(index) ?? true,
      priority: options.priority ?? 0,
      sharedTrackGroupId: options.sharedTrackGroupBySegmentIndex?.get(index)
    });
  }

  return segments;
}

function isStrictlyInside(value: number, min: number, max: number, epsilon: number): boolean {
  return value > min + epsilon && value < max - epsilon;
}

export function pointInsideBoxInterior(point: Point, box: RoutingBox, epsilon = 0.5): boolean {
  return isStrictlyInside(point.x, box.x, box.x + box.width, epsilon)
    && isStrictlyInside(point.y, box.y, box.y + box.height, epsilon);
}

export function segmentIntersectsBoxInterior(
  start: Point,
  end: Point,
  box: RoutingBox,
  epsilon = 0.5
): boolean {
  const axis = getSegmentAxis(start, end, epsilon);
  if (axis === "horizontal") {
    if (!isStrictlyInside(start.y, box.y, box.y + box.height, epsilon)) {
      return false;
    }
    return spansOverlap(
      Math.min(start.x, end.x),
      Math.max(start.x, end.x),
      box.x,
      box.x + box.width,
      epsilon
    );
  }
  if (axis === "vertical") {
    if (!isStrictlyInside(start.x, box.x, box.x + box.width, epsilon)) {
      return false;
    }
    return spansOverlap(
      Math.min(start.y, end.y),
      Math.max(start.y, end.y),
      box.y,
      box.y + box.height,
      epsilon
    );
  }

  // Liang-Barsky clipping for the uncommon straight/diagonal route case.
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const minX = box.x + epsilon;
  const maxX = box.x + box.width - epsilon;
  const minY = box.y + epsilon;
  const maxY = box.y + box.height - epsilon;
  let lower = 0;
  let upper = 1;
  const bounds: Array<[number, number]> = [
    [-dx, start.x - minX],
    [dx, maxX - start.x],
    [-dy, start.y - minY],
    [dy, maxY - start.y]
  ];

  for (const [p, q] of bounds) {
    if (Math.abs(p) <= epsilon) {
      if (q < 0) {
        return false;
      }
      continue;
    }
    const ratio = q / p;
    if (p < 0) {
      lower = Math.max(lower, ratio);
    } else {
      upper = Math.min(upper, ratio);
    }
    if (lower > upper) {
      return false;
    }
  }
  return upper - lower > epsilon / Math.max(1, segmentLength(start, end));
}

export function endpointDepartsIntoBox(
  endpoint: Point,
  adjacent: Point,
  box: RoutingBox,
  epsilon = 0.5
): boolean {
  if (pointInsideBoxInterior(endpoint, box, epsilon)) {
    return true;
  }
  const length = Math.max(segmentLength(endpoint, adjacent), 1);
  const ratio = Math.min(1, Math.max(epsilon * 2, 1) / length);
  const probe = {
    x: endpoint.x + (adjacent.x - endpoint.x) * ratio,
    y: endpoint.y + (adjacent.y - endpoint.y) * ratio
  };
  return pointInsideBoxInterior(probe, box, epsilon / 2);
}

export function perpendicularSegmentsCross(
  left: RoutingSegment,
  right: RoutingSegment,
  epsilon = 0.5
): boolean {
  if (left.axis === right.axis) {
    return false;
  }
  const horizontal = left.axis === "horizontal" ? left : right;
  const vertical = left.axis === "vertical" ? left : right;
  return vertical.coordinate > horizontal.spanStart + epsilon
    && vertical.coordinate < horizontal.spanEnd - epsilon
    && horizontal.coordinate > vertical.spanStart + epsilon
    && horizontal.coordinate < vertical.spanEnd - epsilon;
}

export function buildCrossingKey(
  leftConnectorId: string,
  leftSegmentIndex: number,
  rightConnectorId: string,
  rightSegmentIndex: number
): string {
  const entries = [
    `${leftConnectorId}:${leftSegmentIndex}`,
    `${rightConnectorId}:${rightSegmentIndex}`
  ].sort((left, right) => left.localeCompare(right));
  return entries.join("|");
}

export function moveSegmentToCoordinate(segment: RoutingSegment, coordinate: number): RoutingSegment {
  const rounded = roundRoutingMetric(coordinate);
  const start = segment.axis === "horizontal"
    ? { x: segment.start.x, y: rounded }
    : { x: rounded, y: segment.start.y };
  const end = segment.axis === "horizontal"
    ? { x: segment.end.x, y: rounded }
    : { x: rounded, y: segment.end.y };
  return {
    ...segment,
    coordinate: rounded,
    start,
    end
  };
}

export function routingSegmentKey(id: RoutingSegmentId): string {
  return id as string;
}
