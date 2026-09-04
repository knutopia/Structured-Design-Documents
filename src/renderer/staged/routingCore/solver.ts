import {
  DEFAULT_ROUTING_POLICY,
  type RoutingAssignment,
  type RoutingExpansionRequest,
  type RoutingPolicy,
  type RoutingResource,
  type RoutingSegmentId,
  type RoutingSolveResult,
  type RoutingTrackClaim,
  type RoutingViolation
} from "./contracts.js";
import {
  roundRoutingMetric,
  routingSegmentKey,
  spansOverlap
} from "./geometry.js";

export interface SolveRoutingClaimsOptions {
  resources?: readonly RoutingResource[];
  policy?: Partial<RoutingPolicy>;
  priorViolations?: readonly RoutingViolation[];
  maxSearchStates?: number;
  searchOrder?: "stable" | "most_constrained";
}

interface SearchState {
  visited: number;
  exhausted: boolean;
  best?: {
    assignments: Map<RoutingSegmentId, number>;
    cost: number[];
    lexical: string;
  };
}

function assignmentCostContribution(
  claim: RoutingTrackClaim,
  coordinate: number,
  maxPriority: number
): [number, number] {
  const displacement = Math.abs(coordinate - claim.segment.coordinate);
  return [
    displacement * (maxPriority - claim.priority + 1),
    displacement
  ];
}

function claimsCompete(left: RoutingTrackClaim, right: RoutingTrackClaim, epsilon: number): boolean {
  if (left.segment.axis !== right.segment.axis) {
    return false;
  }
  if (left.sharedTrackGroupId
    && left.sharedTrackGroupId === right.sharedTrackGroupId) {
    return false;
  }
  if (!spansOverlap(
    left.segment.spanStart,
    left.segment.spanEnd,
    right.segment.spanStart,
    right.segment.spanEnd,
    epsilon
  )) {
    return false;
  }
  return Math.max(left.allowedRange.min, right.allowedRange.min)
    <= Math.min(left.allowedRange.max, right.allowedRange.max) + epsilon;
}

function compareClaims(left: RoutingTrackClaim, right: RoutingTrackClaim): number {
  return Number(left.lockedCoordinate === undefined) - Number(right.lockedCoordinate === undefined)
    || Number(left.movable) - Number(right.movable)
    || left.priority - right.priority
    || left.segment.connectorId.localeCompare(right.segment.connectorId)
    || routingSegmentKey(left.segment.id).localeCompare(routingSegmentKey(right.segment.id));
}

function buildClaimComponents(
  claims: readonly RoutingTrackClaim[],
  epsilon: number
): RoutingTrackClaim[][] {
  const ordered = [...claims].sort(compareClaims);
  const visited = new Set<RoutingSegmentId>();
  const components: RoutingTrackClaim[][] = [];

  for (const claim of ordered) {
    if (visited.has(claim.segment.id)) {
      continue;
    }
    const component: RoutingTrackClaim[] = [];
    const queue = [claim];
    visited.add(claim.segment.id);
    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);
      for (const candidate of ordered) {
        if (visited.has(candidate.segment.id) || !claimsCompete(current, candidate, epsilon)) {
          continue;
        }
        visited.add(candidate.segment.id);
        queue.push(candidate);
      }
    }
    components.push(component.sort(compareClaims));
  }
  return components;
}

function isForbidden(claim: RoutingTrackClaim, coordinate: number, epsilon: number): boolean {
  return claim.forbiddenRanges.some((range) =>
    coordinate >= range.min - epsilon && coordinate <= range.max + epsilon
  );
}

function resolveFiniteRange(
  claim: RoutingTrackClaim,
  claims: readonly RoutingTrackClaim[],
  resources: ReadonlyMap<string, RoutingResource>,
  separation: number
): { min: number; max: number } {
  let min = claim.allowedRange.min;
  let max = claim.allowedRange.max;
  for (const resourceId of claim.resourceIds) {
    const resource = resources.get(resourceId);
    if (!resource) {
      continue;
    }
    min = Math.max(min, resource.minCoordinate);
    max = Math.min(max, resource.maxCoordinate);
  }
  const radius = separation * Math.max(4, claims.length * 2 + 2);
  if (!Number.isFinite(min)) {
    min = claim.segment.coordinate - radius;
  }
  if (!Number.isFinite(max)) {
    max = claim.segment.coordinate + radius;
  }
  return {
    min: roundRoutingMetric(min),
    max: roundRoutingMetric(max)
  };
}

function enumerateCoordinates(
  claim: RoutingTrackClaim,
  claims: readonly RoutingTrackClaim[],
  resources: ReadonlyMap<string, RoutingResource>,
  policy: RoutingPolicy
): number[] {
  if (claim.lockedCoordinate !== undefined || !claim.movable) {
    const coordinate = roundRoutingMetric(claim.lockedCoordinate ?? claim.segment.coordinate);
    return coordinate >= claim.allowedRange.min - policy.epsilon
      && coordinate <= claim.allowedRange.max + policy.epsilon
      && !isForbidden(claim, coordinate, policy.epsilon)
      ? [coordinate]
      : [];
  }

  const range = resolveFiniteRange(claim, claims, resources, policy.minSeparation);
  if (range.min > range.max + policy.epsilon) {
    return [];
  }
  const candidates = new Set<number>();
  const add = (value: number): void => {
    const coordinate = roundRoutingMetric(value);
    if (coordinate < range.min - policy.epsilon
      || coordinate > range.max + policy.epsilon
      || isForbidden(claim, coordinate, policy.epsilon)) {
      return;
    }
    candidates.add(coordinate);
  };

  add(claim.segment.coordinate);
  add(range.min);
  add(range.max);
  const anchors = new Set<number>([
    claim.segment.coordinate,
    ...claims.map((candidate) => candidate.segment.coordinate),
    ...claims.flatMap((candidate) =>
      candidate.lockedCoordinate === undefined ? [] : [candidate.lockedCoordinate]
    )
  ]);
  const radius = Math.max(3, claims.length + 1);
  for (const anchor of anchors) {
    for (let offset = -radius; offset <= radius; offset += 1) {
      add(anchor + offset * policy.minSeparation);
    }
  }

  return [...candidates].sort((left, right) =>
    Math.abs(left - claim.segment.coordinate) - Math.abs(right - claim.segment.coordinate)
    || left - right
  );
}

function assignmentCompatible(
  claim: RoutingTrackClaim,
  coordinate: number,
  assigned: ReadonlyMap<RoutingSegmentId, number>,
  claimById: ReadonlyMap<RoutingSegmentId, RoutingTrackClaim>,
  policy: RoutingPolicy
): boolean {
  for (const [otherId, otherCoordinate] of assigned) {
    const other = claimById.get(otherId);
    if (!other || !claimsCompete(claim, other, policy.epsilon)) {
      continue;
    }
    if (Math.abs(coordinate - otherCoordinate) < policy.minSeparation - policy.epsilon) {
      return false;
    }
  }
  return true;
}

function compareScore(
  left: { cost: number[]; lexical: string },
  right: { cost: number[]; lexical: string }
): number {
  for (let index = 0; index < Math.max(left.cost.length, right.cost.length); index += 1) {
    const delta = (left.cost[index] ?? 0) - (right.cost[index] ?? 0);
    if (Math.abs(delta) > 0.0001) {
      return delta;
    }
  }
  return left.lexical.localeCompare(right.lexical);
}

function scoreAssignments(
  claims: readonly RoutingTrackClaim[],
  assignments: ReadonlyMap<RoutingSegmentId, number>
): { cost: number[]; lexical: string } {
  let priorityWeightedDisplacement = 0;
  let totalDisplacement = 0;
  const maxPriority = Math.max(0, ...claims.map((claim) => claim.priority));
  const lexical: string[] = [];
  for (const claim of claims) {
    const coordinate = assignments.get(claim.segment.id) ?? claim.segment.coordinate;
    const displacement = Math.abs(coordinate - claim.segment.coordinate);
    priorityWeightedDisplacement += displacement * (maxPriority - claim.priority + 1);
    totalDisplacement += displacement;
    lexical.push(`${routingSegmentKey(claim.segment.id)}=${roundRoutingMetric(coordinate)}`);
  }
  return {
    cost: [roundRoutingMetric(priorityWeightedDisplacement), roundRoutingMetric(totalDisplacement)],
    lexical: lexical.join("|")
  };
}

function searchAssignments(
  claims: readonly RoutingTrackClaim[],
  candidatesById: ReadonlyMap<RoutingSegmentId, number[]>,
  policy: RoutingPolicy,
  maxSearchStates: number,
  searchOrder: NonNullable<SolveRoutingClaimsOptions["searchOrder"]>
): SearchState {
  const ordered = [...claims].sort(compareClaims);
  const claimById = new Map(ordered.map((claim) => [claim.segment.id, claim] as const));
  const conflictDegreeById = new Map(ordered.map((claim) => [
    claim.segment.id,
    ordered.filter((candidate) => claimsCompete(claim, candidate, policy.epsilon)).length
  ] as const));
  const state: SearchState = { visited: 0, exhausted: false };
  const assigned = new Map<RoutingSegmentId, number>();
  const maxPriority = Math.max(0, ...ordered.map((claim) => claim.priority));
  const compatibleCandidates = (
    claim: RoutingTrackClaim,
    coordinates: ReadonlyMap<RoutingSegmentId, number>
  ): number[] => (candidatesById.get(claim.segment.id) ?? []).filter((candidate) =>
    assignmentCompatible(claim, candidate, coordinates, claimById, policy)
  );
  const selectNextClaim = (
    coordinates: ReadonlyMap<RoutingSegmentId, number>
  ): { claim: RoutingTrackClaim; candidates: number[] } | undefined => ordered
    .filter((claim) => !coordinates.has(claim.segment.id))
    .map((claim) => ({ claim, candidates: compatibleCandidates(claim, coordinates) }))
    .sort((left, right) =>
      left.candidates.length - right.candidates.length
      || (conflictDegreeById.get(right.claim.segment.id) ?? 0)
        - (conflictDegreeById.get(left.claim.segment.id) ?? 0)
      || compareClaims(left.claim, right.claim)
    )[0];
  const greedy = new Map<RoutingSegmentId, number>();
  let greedyComplete = true;
  while (greedy.size < ordered.length) {
    const next = selectNextClaim(greedy);
    const coordinate = next?.candidates[0];
    if (!next || coordinate === undefined) {
      greedyComplete = false;
      break;
    }
    greedy.set(next.claim.segment.id, coordinate);
  }
  if (greedyComplete) {
    state.best = {
      assignments: greedy,
      ...scoreAssignments(ordered, greedy)
    };
  }

  const visit = (weightedDisplacement: number, totalDisplacement: number): void => {
    if (state.visited >= maxSearchStates) {
      state.exhausted = true;
      return;
    }
    state.visited += 1;
    if (assigned.size >= ordered.length) {
      const score = scoreAssignments(ordered, assigned);
      if (!state.best || compareScore(score, state.best) < 0) {
        state.best = {
          assignments: new Map(assigned),
          ...score
        };
      }
      return;
    }

    const next = searchOrder === "most_constrained"
      ? selectNextClaim(assigned)
      : (() => {
          const claim = ordered[assigned.size];
          return claim
            ? { claim, candidates: compatibleCandidates(claim, assigned) }
            : undefined;
        })();
    if (!next || next.candidates.length === 0) {
      return;
    }
    const claim = next.claim;
    for (const coordinate of next.candidates) {
      const [weightedContribution, totalContribution] = assignmentCostContribution(
        claim,
        coordinate,
        maxPriority
      );
      const nextWeighted = weightedDisplacement + weightedContribution;
      const nextTotal = totalDisplacement + totalContribution;
      if (state.best && (nextWeighted > state.best.cost[0]! + 0.0001
        || (Math.abs(nextWeighted - state.best.cost[0]!) <= 0.0001
          && nextTotal > state.best.cost[1]! + 0.0001))) {
        continue;
      }
      assigned.set(claim.segment.id, coordinate);
      visit(nextWeighted, nextTotal);
      assigned.delete(claim.segment.id);
      if (state.exhausted) {
        return;
      }
    }
  };

  visit(0, 0);
  return state;
}

function zeroDisplacementAssignment(
  claims: readonly RoutingTrackClaim[],
  candidatesById: ReadonlyMap<RoutingSegmentId, number[]>,
  policy: RoutingPolicy
): Map<RoutingSegmentId, number> | undefined {
  const ordered = [...claims].sort(compareClaims);
  const claimById = new Map(ordered.map((claim) => [claim.segment.id, claim] as const));
  const assigned = new Map<RoutingSegmentId, number>();
  for (const claim of ordered) {
    const coordinate = roundRoutingMetric(claim.lockedCoordinate ?? claim.segment.coordinate);
    if (!(candidatesById.get(claim.segment.id) ?? []).includes(coordinate)
      || !assignmentCompatible(claim, coordinate, assigned, claimById, policy)) {
      return undefined;
    }
    assigned.set(claim.segment.id, coordinate);
  }
  return assigned;
}

function buildExpansionRequests(
  claims: readonly RoutingTrackClaim[],
  resources: ReadonlyMap<string, RoutingResource>,
  policy: RoutingPolicy,
  reason: RoutingViolation["kind"]
): RoutingExpansionRequest[] {
  const byResource = new Map<string, RoutingExpansionRequest>();
  for (const claim of claims) {
    for (const resourceId of claim.resourceIds) {
      const resource = resources.get(resourceId);
      if (!resource?.expansionOwnerId) {
        continue;
      }
      const request = byResource.get(resourceId) ?? {
        ownerId: resource.expansionOwnerId,
        resourceId,
        axis: resource.axis,
        requiredMaxCoordinate: roundRoutingMetric(resource.maxCoordinate + policy.minSeparation),
        requiredSize: roundRoutingMetric((resource.currentSize
          ?? resource.maxCoordinate - resource.minCoordinate) + policy.minSeparation),
        segmentIds: [],
        reason
      };
      request.segmentIds.push(claim.segment.id);
      byResource.set(resourceId, request);
    }
  }
  return [...byResource.values()]
    .map((request) => ({
      ...request,
      segmentIds: [...new Set(request.segmentIds)].sort((left, right) =>
        routingSegmentKey(left).localeCompare(routingSegmentKey(right))
      )
    }))
    .sort((left, right) =>
      left.ownerId.localeCompare(right.ownerId) || left.resourceId.localeCompare(right.resourceId)
    );
}

function toRoutingAssignments(
  claims: readonly RoutingTrackClaim[],
  coordinates: ReadonlyMap<RoutingSegmentId, number>
): Map<RoutingSegmentId, RoutingAssignment> {
  return new Map(claims.map((claim) => {
    const coordinate = roundRoutingMetric(coordinates.get(claim.segment.id) ?? claim.segment.coordinate);
    return [claim.segment.id, {
      segmentId: claim.segment.id,
      coordinate,
      displacement: roundRoutingMetric(coordinate - claim.segment.coordinate)
    }] as const;
  }));
}

export function solveRoutingClaims(
  claims: readonly RoutingTrackClaim[],
  options: SolveRoutingClaimsOptions = {}
): RoutingSolveResult {
  const policy: RoutingPolicy = {
    ...DEFAULT_ROUTING_POLICY,
    ...options.policy
  };
  const resources = new Map((options.resources ?? []).map((resource) => [resource.id, resource] as const));
  const priorViolations = [...(options.priorViolations ?? [])];
  if (priorViolations.some((violation) =>
    violation.kind === "conflicting_locks"
    || violation.kind === "empty_coordinate_range"
    || violation.kind === "missing_segment"
  )) {
    const expansionRequests = buildExpansionRequests(claims, resources, policy, priorViolations[0]!.kind);
    return expansionRequests.length > 0
      ? {
          status: "needs_expansion",
          assignments: new Map(),
          expansionRequests,
          violations: priorViolations
        }
      : {
          status: "unsatisfiable",
          assignments: new Map(),
          violations: priorViolations
        };
  }

  const candidatesById = new Map<RoutingSegmentId, number[]>();
  const missingCandidates: RoutingTrackClaim[] = [];
  for (const claim of claims) {
    const candidates = enumerateCoordinates(claim, claims, resources, policy);
    candidatesById.set(claim.segment.id, candidates);
    if (candidates.length === 0) {
      missingCandidates.push(claim);
    }
  }
  if (missingCandidates.length > 0) {
    const violations: RoutingViolation[] = missingCandidates.map((claim) => ({
      kind: "empty_coordinate_range",
      message: `Physical segment "${routingSegmentKey(claim.segment.id)}" has no legal track candidate.`,
      connectorIds: [claim.segment.connectorId],
      segmentIds: [claim.segment.id],
      resourceIds: claim.resourceIds,
      obstacleIds: claim.obstacleIds
    }));
    const expansionRequests = buildExpansionRequests(missingCandidates, resources, policy, "empty_coordinate_range");
    return expansionRequests.length > 0
      ? { status: "needs_expansion", assignments: new Map(), expansionRequests, violations }
      : { status: "needs_alternate_candidate", assignments: new Map(), violations };
  }

  const resolvedCoordinates = new Map<RoutingSegmentId, number>();
  for (const component of buildClaimComponents(claims, policy.epsilon)) {
    const unchanged = zeroDisplacementAssignment(component, candidatesById, policy);
    if (unchanged) {
      for (const [segmentId, coordinate] of unchanged) {
        resolvedCoordinates.set(segmentId, coordinate);
      }
      continue;
    }
    const search = searchAssignments(
      component,
      candidatesById,
      policy,
      options.maxSearchStates ?? 100_000,
      options.searchOrder ?? "stable"
    );
    if (search.best) {
      for (const [segmentId, coordinate] of search.best.assignments) {
        resolvedCoordinates.set(segmentId, coordinate);
      }
      continue;
    }

    const violation: RoutingViolation = {
      kind: "assignment_exhausted",
      message: search.exhausted
        ? `Routing assignment search exhausted its ${options.maxSearchStates ?? 100_000}-state bound.`
        : "No separation-preserving routing-track assignment exists within the available resources.",
      connectorIds: [...new Set(component.map((claim) => claim.segment.connectorId))].sort(),
      segmentIds: component.map((claim) => claim.segment.id)
    };
    const expansionRequests = buildExpansionRequests(component, resources, policy, violation.kind);
    if (expansionRequests.length > 0) {
      return {
        status: "needs_expansion",
        assignments: toRoutingAssignments(claims, resolvedCoordinates),
        expansionRequests,
        violations: [violation]
      };
    }
    return {
      status: "needs_alternate_candidate",
      assignments: toRoutingAssignments(claims, resolvedCoordinates),
      violations: [violation]
    };
  }

  return {
    status: "resolved",
    assignments: toRoutingAssignments(claims, resolvedCoordinates),
    violations: []
  };
}
