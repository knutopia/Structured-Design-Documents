import {
  type RoutingCoordinateRange,
  type RoutingObservation,
  type RoutingSegment,
  type RoutingSegmentId,
  type RoutingTrackClaim,
  type RoutingViolation
} from "./contracts.js";
import { roundRoutingMetric, routingSegmentKey } from "./geometry.js";

export interface AggregatedRoutingClaims {
  claims: RoutingTrackClaim[];
  violations: RoutingViolation[];
}

function normalizeRange(range: RoutingCoordinateRange): RoutingCoordinateRange {
  return {
    min: roundRoutingMetric(Math.min(range.min, range.max)),
    max: roundRoutingMetric(Math.max(range.min, range.max))
  };
}

export function mergeCoordinateRanges(
  ranges: readonly RoutingCoordinateRange[],
  epsilon = 0.5
): RoutingCoordinateRange[] {
  const sorted = ranges
    .map(normalizeRange)
    .sort((left, right) => left.min - right.min || left.max - right.max);
  const merged: RoutingCoordinateRange[] = [];

  for (const range of sorted) {
    const previous = merged[merged.length - 1];
    if (!previous || range.min > previous.max + epsilon) {
      merged.push({ ...range });
      continue;
    }
    previous.max = roundRoutingMetric(Math.max(previous.max, range.max));
  }

  return merged;
}

export function aggregateRoutingObservations(
  segments: readonly RoutingSegment[],
  observations: readonly RoutingObservation[],
  epsilon = 0.5
): AggregatedRoutingClaims {
  const segmentById = new Map<string, RoutingSegment>(
    segments.map((segment) => [routingSegmentKey(segment.id), segment] as const)
  );
  const observationsBySegmentId = new Map<string, RoutingObservation[]>();
  const violations: RoutingViolation[] = [];

  for (const observation of observations) {
    const key = routingSegmentKey(observation.segmentId);
    if (!segmentById.has(key)) {
      violations.push({
        kind: "missing_segment",
        message: `Routing observation references unknown physical segment "${key}".`,
        connectorIds: [],
        segmentIds: [observation.segmentId],
        resourceIds: observation.resourceId ? [observation.resourceId] : undefined,
        obstacleIds: observation.obstacleId ? [observation.obstacleId] : undefined
      });
      continue;
    }
    const grouped = observationsBySegmentId.get(key) ?? [];
    grouped.push(observation);
    observationsBySegmentId.set(key, grouped);
  }

  const claims = [...segments]
    .sort((left, right) => routingSegmentKey(left.id).localeCompare(routingSegmentKey(right.id)))
    .map((segment): RoutingTrackClaim => {
      const grouped = [...(observationsBySegmentId.get(routingSegmentKey(segment.id)) ?? [])]
        .sort((left, right) =>
          (left.resourceId ?? "").localeCompare(right.resourceId ?? "")
          || (left.obstacleId ?? "").localeCompare(right.obstacleId ?? "")
          || (left.lockedCoordinate ?? Number.NEGATIVE_INFINITY)
            - (right.lockedCoordinate ?? Number.NEGATIVE_INFINITY)
        );
      let min = Number.NEGATIVE_INFINITY;
      let max = Number.POSITIVE_INFINITY;
      const lockedCoordinates: number[] = [];
      const resourceIds = new Set<string>();
      const obstacleIds = new Set<string>();
      const forbiddenRanges: RoutingCoordinateRange[] = [];
      let movable = segment.movable;
      let priority = segment.priority;
      let sharedTrackGroupId = segment.sharedTrackGroupId;

      for (const observation of grouped) {
        if (observation.allowedRange) {
          const range = normalizeRange(observation.allowedRange);
          min = Math.max(min, range.min);
          max = Math.min(max, range.max);
        }
        if (observation.lockedCoordinate !== undefined) {
          lockedCoordinates.push(roundRoutingMetric(observation.lockedCoordinate));
        }
        if (observation.resourceId) {
          resourceIds.add(observation.resourceId);
        }
        if (observation.obstacleId) {
          obstacleIds.add(observation.obstacleId);
        }
        forbiddenRanges.push(...(observation.forbiddenRanges ?? []));
        if (observation.movable === false) {
          movable = false;
        }
        if (observation.priority !== undefined) {
          priority = Math.min(priority, observation.priority);
        }
        if (observation.sharedTrackGroupId !== undefined) {
          if (sharedTrackGroupId === undefined) {
            sharedTrackGroupId = observation.sharedTrackGroupId;
          } else if (sharedTrackGroupId !== observation.sharedTrackGroupId) {
            violations.push({
              kind: "conflicting_locks",
              message: `Physical segment "${routingSegmentKey(segment.id)}" has conflicting shared-track groups.`,
              connectorIds: [segment.connectorId],
              segmentIds: [segment.id]
            });
          }
        }
      }

      const distinctLocks = [...new Set(lockedCoordinates)]
        .sort((left, right) => left - right);
      if (distinctLocks.length > 1
        && distinctLocks[distinctLocks.length - 1]! - distinctLocks[0]! > epsilon) {
        violations.push({
          kind: "conflicting_locks",
          message: `Physical segment "${routingSegmentKey(segment.id)}" has incompatible locked coordinates ${distinctLocks.join(", ")}.`,
          connectorIds: [segment.connectorId],
          segmentIds: [segment.id],
          resourceIds: [...resourceIds].sort(),
          obstacleIds: [...obstacleIds].sort()
        });
      }

      const lockedCoordinate = distinctLocks[0];
      if (lockedCoordinate !== undefined) {
        min = Math.max(min, lockedCoordinate);
        max = Math.min(max, lockedCoordinate);
        movable = false;
      }
      if (min > max + epsilon) {
        violations.push({
          kind: "empty_coordinate_range",
          message: `Physical segment "${routingSegmentKey(segment.id)}" has no coordinate satisfying all observations.`,
          connectorIds: [segment.connectorId],
          segmentIds: [segment.id],
          resourceIds: [...resourceIds].sort(),
          obstacleIds: [...obstacleIds].sort()
        });
      }

      return {
        segment,
        resourceIds: [...resourceIds].sort(),
        obstacleIds: [...obstacleIds].sort(),
        allowedRange: {
          min: roundRoutingMetric(min),
          max: roundRoutingMetric(max)
        },
        forbiddenRanges: mergeCoordinateRanges(forbiddenRanges, epsilon),
        lockedCoordinate,
        movable,
        priority,
        sharedTrackGroupId,
        observations: grouped
      };
    });

  return { claims, violations };
}

export function mapRoutingObservationsBySegment(
  observations: readonly RoutingObservation[]
): Map<RoutingSegmentId, RoutingObservation[]> {
  const grouped = new Map<RoutingSegmentId, RoutingObservation[]>();
  for (const observation of observations) {
    const entries = grouped.get(observation.segmentId) ?? [];
    entries.push(observation);
    grouped.set(observation.segmentId, entries);
  }
  return grouped;
}
