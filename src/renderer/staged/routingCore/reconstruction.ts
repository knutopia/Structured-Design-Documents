import type { Point, PositionedRoute } from "../contracts.js";
import type { RoutingAssignment, RoutingSegment, RoutingSegmentId } from "./contracts.js";
import { collapseRoutePoints, roundRoutingMetric } from "./geometry.js";

export function reconstructRouteFromAssignments(
  route: PositionedRoute,
  segments: readonly RoutingSegment[],
  assignments: ReadonlyMap<RoutingSegmentId, RoutingAssignment | number>
): PositionedRoute {
  const points: Point[] = route.points.map((point) => ({ ...point }));
  const ordered = [...segments].sort((left, right) =>
    left.routeSegmentIndex - right.routeSegmentIndex
  );

  for (const segment of ordered) {
    const rawAssignment = assignments.get(segment.id);
    if (rawAssignment === undefined) {
      continue;
    }
    const coordinate = roundRoutingMetric(
      typeof rawAssignment === "number" ? rawAssignment : rawAssignment.coordinate
    );
    const start = points[segment.routeSegmentIndex];
    const end = points[segment.routeSegmentIndex + 1];
    if (!start || !end) {
      continue;
    }
    if (segment.axis === "horizontal") {
      start.y = coordinate;
      end.y = coordinate;
    } else {
      start.x = coordinate;
      end.x = coordinate;
    }
  }

  return {
    style: route.style,
    points: collapseRoutePoints(points)
  };
}
