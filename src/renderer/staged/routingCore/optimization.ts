import type { Point } from "../contracts.js";
import type { FinalRoutingConnector } from "./lifecycle.js";
import { buildRoutingSegments, perpendicularSegmentsCross } from "./geometry.js";

const EPSILON = 0.5;

export interface HorizontalAlignmentRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HorizontalAlignmentInput {
  source: HorizontalAlignmentRect;
  target: HorizontalAlignmentRect;
  sourcePoint: Point;
  targetPoint: Point;
  sourceCount: number;
  targetCount: number;
  blocked?: (start: Point, end: Point) => boolean;
}

/** Resolve the shared cross-axis coordinate for an eligible east-to-west pair. */
export function resolveHorizontalSharedY(input: HorizontalAlignmentInput): number | undefined {
  const sourceMultiple = input.sourceCount > 1;
  const targetMultiple = input.targetCount > 1;
  const overlapTop = Math.max(input.source.y, input.target.y);
  const overlapBottom = Math.min(
    input.source.y + input.source.height,
    input.target.y + input.target.height
  );
  if (overlapBottom - overlapTop <= EPSILON) return undefined;
  const preferredY = sourceMultiple && !targetMultiple ? input.sourcePoint.y : input.targetPoint.y;
  const sharedY = Math.max(overlapTop, Math.min(overlapBottom, preferredY));
  if (Math.abs(sharedY - preferredY) > EPSILON) return undefined;
  const start = { x: input.source.x + input.source.width, y: sharedY };
  const end = { x: input.target.x, y: sharedY };
  if (start.x >= end.x || input.blocked?.(start, end)) return undefined;
  return sharedY;
}

export function routeCost(connectors: readonly FinalRoutingConnector[]): [number, number, number] {
  const segments = connectors.map((connector) => buildRoutingSegments(connector.id, connector.route));
  let crossings = 0;
  let bends = 0;
  let length = 0;
  for (let index = 0; index < connectors.length; index += 1) {
    const points = connectors[index]!.route.points;
    bends += Math.max(0, points.length - 2);
    for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
      length += Math.abs(points[pointIndex]!.x - points[pointIndex - 1]!.x)
        + Math.abs(points[pointIndex]!.y - points[pointIndex - 1]!.y);
    }
    for (let otherIndex = 0; otherIndex < index; otherIndex += 1) {
      for (const left of segments[index]!) for (const right of segments[otherIndex]!) {
        if (perpendicularSegmentsCross(left, right, EPSILON)) crossings += 1;
      }
    }
  }
  return [crossings, bends, length];
}

/** Count interior perpendicular crossings between a pair of connector routes. */
export function routeCrossings(left: FinalRoutingConnector, right: FinalRoutingConnector): number {
  const leftSegments = buildRoutingSegments(left.id, left.route);
  const rightSegments = buildRoutingSegments(right.id, right.route);
  let crossings = 0;
  for (const leftSegment of leftSegments) {
    for (const rightSegment of rightSegments) {
      if (perpendicularSegmentsCross(leftSegment, rightSegment, EPSILON)) crossings += 1;
    }
  }
  return crossings;
}

export interface SourceAttachmentSwap {
  leftConnectorId: string;
  rightConnectorId: string;
  leftPoint: Point;
  rightPoint: Point;
}

/**
 * Propose swapping two source attachment positions while preserving both route
 * topologies. The first southbound run moves with its new port; the remainder
 * of each route, including its target attachment, stays fixed.
 */
export function swapSouthboundSourceAttachments(
  connectors: readonly FinalRoutingConnector[],
  swap: SourceAttachmentSwap
): FinalRoutingConnector[] | undefined {
  const left = connectors.find((connector) => connector.id === swap.leftConnectorId);
  const right = connectors.find((connector) => connector.id === swap.rightConnectorId);
  if (!left || !right || left.id === right.id
    || left.source.side !== "south" || right.source.side !== "south"
    || left.source.nodeId !== right.source.nodeId
    || left.runConstraints?.size || right.runConstraints?.size
    || left.sharedTrackGroupBySegmentIndex?.size || right.sharedTrackGroupBySegmentIndex?.size
    || left.markedCrossings?.size || right.markedCrossings?.size) return undefined;

  const leftPoints = moveSouthboundPrefix(left.route.points, swap.leftPoint);
  const rightPoints = moveSouthboundPrefix(right.route.points, swap.rightPoint);
  if (!leftPoints || !rightPoints) return undefined;

  return connectors.map((connector) => {
    if (connector.id === left.id) {
      return { ...connector, source: { ...connector.source, point: swap.leftPoint },
        route: { ...connector.route, points: leftPoints } };
    }
    if (connector.id === right.id) {
      return { ...connector, source: { ...connector.source, point: swap.rightPoint },
        route: { ...connector.route, points: rightPoints } };
    }
    return connector;
  });
}

function moveSouthboundPrefix(points: readonly Point[], newStart: Point): Point[] | undefined {
  if (points.length < 3 || Math.abs(points[0]!.y - newStart.y) > EPSILON) return undefined;
  let firstSouthPoint = -1;
  for (let index = 1; index < points.length; index += 1) {
    if (Math.abs(points[index]!.y - points[0]!.y) <= EPSILON) continue;
    firstSouthPoint = index;
    break;
  }
  if (firstSouthPoint < 1 || points[firstSouthPoint]!.y <= points[0]!.y + EPSILON) return undefined;
  for (let index = 0; index <= firstSouthPoint; index += 1) {
    if (Math.abs(points[index]!.x - points[0]!.x) > EPSILON) return undefined;
  }

  const moved = points.map((point, index) => index <= firstSouthPoint
    ? { x: newStart.x, y: point.y }
    : { ...point });
  const normalized: Point[] = [];
  for (const point of moved) {
    const previous = normalized[normalized.length - 1];
    if (previous && Math.abs(previous.x - point.x) <= EPSILON
      && Math.abs(previous.y - point.y) <= EPSILON) continue;
    while (normalized.length >= 2) {
      const a = normalized[normalized.length - 2]!;
      const b = normalized[normalized.length - 1]!;
      const collinear = (Math.abs(a.x - b.x) <= EPSILON && Math.abs(b.x - point.x) <= EPSILON)
        || (Math.abs(a.y - b.y) <= EPSILON && Math.abs(b.y - point.y) <= EPSILON);
      if (!collinear) break;
      normalized.pop();
    }
    normalized.push(point);
  }
  return normalized;
}

export function compareRouteCosts(left: readonly number[], right: readonly number[]): number {
  for (let index = 0; index < left.length; index += 1) {
    if (Math.abs(left[index]! - right[index]!) > EPSILON) return left[index]! - right[index]!;
  }
  return 0;
}
