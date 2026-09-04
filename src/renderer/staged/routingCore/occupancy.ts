import type { Point, PositionedRoute } from "../contracts.js";
import { aggregateRoutingObservations } from "./claims.js";
import {
  createRoutingSegmentId,
  type RoutingAxis,
  type RoutingObservation,
  type RoutingPolicy,
  type RoutingSegment,
  type RoutingViolation
} from "./contracts.js";
import {
  buildRoutingSegments,
  getSegmentAxis,
  roundRoutingMetric,
  spansOverlap
} from "./geometry.js";
import { solveRoutingClaims } from "./solver.js";
import { reconstructRouteFromAssignments } from "./reconstruction.js";

export interface PhysicalSegmentOccupancy {
  connectorId: string;
  segmentKey: string;
  logicalRunId: string;
  axis: RoutingAxis;
  nominalCoordinate: number;
  spanStart: number;
  spanEnd: number;
  movable: boolean;
  priority: number;
  resourceId?: string;
  obstacleId?: string;
  sharedTrackGroupId?: string;
}

export interface PhysicalSegmentOccupancyResolution {
  coordinateBySegmentKey: Map<string, number>;
  displacementBySegmentKey: Map<string, number>;
  violations: RoutingViolation[];
  status: "resolved" | "needs_expansion" | "needs_alternate_candidate" | "unsatisfiable";
}

export interface RouteOccupancyResolution extends PhysicalSegmentOccupancyResolution {
  routeByConnectorId: Map<string, PositionedRoute>;
}

export interface RouteOccupancyInput {
  connectorId: string;
  route: PositionedRoute;
  priority: number;
  lockedSegmentKeys?: ReadonlySet<string>;
  sharedTrackGroupBySegmentIndex?: ReadonlyMap<number, string>;
}

export interface ResolveRouteOccupancyOptions {
  buildSegmentKey: (connectorId: string, routeSegmentIndex: number) => string;
  policy?: Partial<RoutingPolicy>;
  fixEndpointSegments?: boolean;
  includeEndpointSegments?: boolean;
}

interface AggregatedPhysicalSegment {
  connectorId: string;
  segmentKey: string;
  logicalRunId: string;
  axis: RoutingAxis;
  nominalCoordinate: number;
  spanStart: number;
  spanEnd: number;
  movable: boolean;
  priority: number;
  sharedTrackGroupId?: string;
  entries: PhysicalSegmentOccupancy[];
}

function segmentPoints(segment: AggregatedPhysicalSegment): { start: Point; end: Point } {
  return segment.axis === "horizontal"
    ? {
        start: { x: segment.spanStart, y: segment.nominalCoordinate },
        end: { x: segment.spanEnd, y: segment.nominalCoordinate }
      }
    : {
        start: { x: segment.nominalCoordinate, y: segment.spanStart },
        end: { x: segment.nominalCoordinate, y: segment.spanEnd }
      };
}

function aggregatePhysicalSegments(
  entries: readonly PhysicalSegmentOccupancy[]
): AggregatedPhysicalSegment[] {
  const bySegmentKey = new Map<string, AggregatedPhysicalSegment>();
  for (const entry of [...entries].sort((left, right) =>
    left.segmentKey.localeCompare(right.segmentKey)
    || left.resourceId?.localeCompare(right.resourceId ?? "")
    || left.obstacleId?.localeCompare(right.obstacleId ?? "")
    || 0
  )) {
    const existing = bySegmentKey.get(entry.segmentKey);
    if (!existing) {
      bySegmentKey.set(entry.segmentKey, {
        connectorId: entry.connectorId,
        segmentKey: entry.segmentKey,
        logicalRunId: entry.logicalRunId,
        axis: entry.axis,
        nominalCoordinate: roundRoutingMetric(entry.nominalCoordinate),
        spanStart: roundRoutingMetric(Math.min(entry.spanStart, entry.spanEnd)),
        spanEnd: roundRoutingMetric(Math.max(entry.spanStart, entry.spanEnd)),
        movable: entry.movable,
        priority: entry.priority,
        sharedTrackGroupId: entry.sharedTrackGroupId,
        entries: [entry]
      });
      continue;
    }
    if (existing.axis !== entry.axis) {
      throw new Error(`Physical routing segment "${entry.segmentKey}" was observed with conflicting axes.`);
    }
    existing.spanStart = roundRoutingMetric(Math.min(existing.spanStart, entry.spanStart, entry.spanEnd));
    existing.spanEnd = roundRoutingMetric(Math.max(existing.spanEnd, entry.spanStart, entry.spanEnd));
    existing.movable = existing.movable && entry.movable;
    existing.priority = Math.min(existing.priority, entry.priority);
    existing.entries.push(entry);
  }
  return [...bySegmentKey.values()].sort((left, right) =>
    left.priority - right.priority
    || left.connectorId.localeCompare(right.connectorId)
    || left.logicalRunId.localeCompare(right.logicalRunId)
  );
}

export function resolvePhysicalSegmentOccupancy(
  entries: readonly PhysicalSegmentOccupancy[],
  policy: Partial<RoutingPolicy> = {}
): PhysicalSegmentOccupancyResolution {
  const physicalSegments = aggregatePhysicalSegments(entries);
  const segmentKeyById = new Map<string, string>();
  const segments: RoutingSegment[] = physicalSegments.map((physical): RoutingSegment => {
    const id = createRoutingSegmentId(
      physical.connectorId,
      "occupancy",
      physical.logicalRunId
    );
    segmentKeyById.set(id, physical.segmentKey);
    const points = segmentPoints(physical);
    return {
      id,
      connectorId: physical.connectorId,
      candidateId: "occupancy",
      logicalRunId: physical.logicalRunId,
      routeSegmentIndex: -1,
      axis: physical.axis,
      coordinate: physical.nominalCoordinate,
      spanStart: physical.spanStart,
      spanEnd: physical.spanEnd,
      start: points.start,
      end: points.end,
      endpointRole: "internal",
      movable: physical.movable,
      priority: physical.priority,
      sharedTrackGroupId: physical.sharedTrackGroupId
    };
  });
  const segmentByKey = new Map(physicalSegments.map((physical, index) => [
    physical.segmentKey,
    segments[index]!
  ] as const));
  const observations: RoutingObservation[] = physicalSegments.flatMap((physical) => {
    const segment = segmentByKey.get(physical.segmentKey)!;
    const base: RoutingObservation[] = physical.entries.map((entry) => ({
      segmentId: segment.id,
      resourceId: entry.resourceId,
      obstacleId: entry.obstacleId,
      movable: entry.movable,
      priority: entry.priority,
      sharedTrackGroupId: entry.sharedTrackGroupId
    }));
    if (!physical.movable) {
      base.push({
        segmentId: segment.id,
        lockedCoordinate: physical.nominalCoordinate,
        movable: false
      });
    }
    return base;
  });
  const aggregated = aggregateRoutingObservations(segments, observations, policy.epsilon);
  const result = solveRoutingClaims(aggregated.claims, {
    policy,
    priorViolations: aggregated.violations
  });
  const coordinateBySegmentKey = new Map<string, number>();
  const displacementBySegmentKey = new Map<string, number>();
  for (const [segmentId, assignment] of result.assignments) {
    const segmentKey = segmentKeyById.get(segmentId);
    if (!segmentKey) {
      continue;
    }
    coordinateBySegmentKey.set(segmentKey, assignment.coordinate);
    if (Math.abs(assignment.displacement) > (policy.epsilon ?? 0.5)) {
      displacementBySegmentKey.set(segmentKey, assignment.displacement);
    }
  }
  return {
    status: result.status,
    coordinateBySegmentKey,
    displacementBySegmentKey,
    violations: result.violations
  };
}

export function buildLogicalRunIds(route: PositionedRoute): string[] {
  const ids: string[] = [];
  const internalCountByAxis: Record<RoutingAxis, number> = {
    horizontal: 0,
    vertical: 0
  };
  for (let index = 0; index < route.points.length - 1; index += 1) {
    const axis = getSegmentAxis(route.points[index]!, route.points[index + 1]!);
    if (!axis) {
      ids.push(`non-orthogonal-${index}`);
      continue;
    }
    if (index === 0) {
      ids.push(`source-terminal-${axis}`);
      continue;
    }
    if (index === route.points.length - 2) {
      ids.push(`target-terminal-${axis}`);
      continue;
    }
    ids.push(`${axis}-internal-${internalCountByAxis[axis]}`);
    internalCountByAxis[axis] += 1;
  }
  return ids;
}

export function resolveRouteSegmentOccupancy(
  routes: readonly RouteOccupancyInput[],
  options: ResolveRouteOccupancyOptions
): PhysicalSegmentOccupancyResolution {
  const entries: PhysicalSegmentOccupancy[] = [];
  for (const input of routes) {
    const logicalRunIds = buildLogicalRunIds(input.route);
    const segments = buildRoutingSegments(input.connectorId, input.route, {
      candidateId: "route-occupancy",
      logicalRunIds,
      priority: input.priority,
      sharedTrackGroupBySegmentIndex: input.sharedTrackGroupBySegmentIndex
    });
    for (const segment of segments) {
      if ((options.includeEndpointSegments ?? true) === false
        && (segment.endpointRole === "source" || segment.endpointRole === "target")) {
        continue;
      }
      const segmentKey = options.buildSegmentKey(input.connectorId, segment.routeSegmentIndex);
      const endpointFixed = (options.fixEndpointSegments ?? true)
        && (segment.endpointRole === "source" || segment.endpointRole === "target");
      entries.push({
        connectorId: input.connectorId,
        segmentKey,
        logicalRunId: segment.logicalRunId,
        axis: segment.axis,
        nominalCoordinate: segment.coordinate,
        spanStart: segment.spanStart,
        spanEnd: segment.spanEnd,
        movable: !endpointFixed && !input.lockedSegmentKeys?.has(segmentKey),
        priority: input.priority,
        sharedTrackGroupId: segment.sharedTrackGroupId
      });
    }
  }
  const epsilon = options.policy?.epsilon ?? 0.5;
  const movableEntries = entries.filter((entry) => entry.movable);
  const relevantEntries = entries.filter((entry) => entry.movable || movableEntries.some((movable) =>
    movable.axis === entry.axis
    && spansOverlap(
      movable.spanStart,
      movable.spanEnd,
      entry.spanStart,
      entry.spanEnd,
      epsilon
    )
  ));
  return resolvePhysicalSegmentOccupancy(relevantEntries, options.policy);
}

export function resolveAndReconstructRouteOccupancy(
  routes: readonly RouteOccupancyInput[],
  options: ResolveRouteOccupancyOptions
): RouteOccupancyResolution {
  const resolution = resolveRouteSegmentOccupancy(routes, options);
  const routeByConnectorId = new Map<string, PositionedRoute>();
  for (const input of routes) {
    const segments = buildRoutingSegments(input.connectorId, input.route, {
      candidateId: "route-occupancy",
      logicalRunIds: buildLogicalRunIds(input.route),
      priority: input.priority,
      sharedTrackGroupBySegmentIndex: input.sharedTrackGroupBySegmentIndex
    });
    const assignments = new Map(segments.flatMap((segment) => {
      const coordinate = resolution.coordinateBySegmentKey.get(
        options.buildSegmentKey(input.connectorId, segment.routeSegmentIndex)
      );
      return coordinate === undefined ? [] : [[segment.id, coordinate] as const];
    }));
    routeByConnectorId.set(
      input.connectorId,
      resolution.status === "resolved"
        ? reconstructRouteFromAssignments(input.route, segments, assignments)
        : input.route
    );
  }
  return {
    ...resolution,
    routeByConnectorId
  };
}
