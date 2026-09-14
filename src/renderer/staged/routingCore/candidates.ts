import type { PositionedRoute } from "../contracts.js";
import type { Point } from "../contracts.js";
import {
  type RoutingBox,
  type RoutingValidationEdge,
  type RoutingValidationPolicy,
  type RoutingViolation,
  type RoutingViolationKind
} from "./contracts.js";
import { validateRouting } from "./validation.js";
import { collapseRoutePoints, roundRoutingMetric } from "./geometry.js";

export interface OrderedRouteCandidate {
  id: string;
  route: PositionedRoute;
}

export interface SelectRouteCandidateInput {
  connectorId: string;
  sourceItemId: string;
  targetItemId: string;
  candidates: readonly OrderedRouteCandidate[];
  boxes?: readonly RoutingBox[];
  policy?: Partial<RoutingValidationPolicy>;
  blockingViolationKinds?: ReadonlySet<RoutingViolationKind>;
}

export interface SelectedRouteCandidate {
  status: "resolved" | "unsatisfiable";
  candidate?: OrderedRouteCandidate;
  violations: RoutingViolation[];
}

const DEFAULT_BLOCKING_KINDS = new Set<RoutingViolationKind>([
  "non_orthogonal_segment",
  "endpoint_mismatch",
  "endpoint_intrusion",
  "node_intersection",
  "terminal_leg_too_short"
]);

/** Selects the first view-ordered topology that passes the requested shared checks. */
export function selectRouteCandidate(input: SelectRouteCandidateInput): SelectedRouteCandidate {
  let lastViolations: RoutingViolation[] = [];
  for (const candidate of input.candidates) {
    const edge: RoutingValidationEdge = {
      id: input.connectorId,
      sourceItemId: input.sourceItemId,
      targetItemId: input.targetItemId,
      style: candidate.route.style,
      points: candidate.route.points
    };
    const blockingKinds = input.blockingViolationKinds ?? DEFAULT_BLOCKING_KINDS;
    const violations = validateRouting({
      edges: [edge],
      boxes: input.boxes,
      policy: input.policy
    }).filter((violation) => blockingKinds.has(violation.kind));
    if (violations.length === 0) {
      return { status: "resolved", candidate, violations: [] };
    }
    lastViolations = violations;
  }
  return { status: "unsatisfiable", violations: lastViolations };
}

function endpointSide(point: Point, box: RoutingBox | undefined, epsilon: number): "north" | "south" | "east" | "west" | undefined {
  if (!box) {
    return undefined;
  }
  if (Math.abs(point.x - box.x) <= epsilon) return "west";
  if (Math.abs(point.x - (box.x + box.width)) <= epsilon) return "east";
  if (Math.abs(point.y - box.y) <= epsilon) return "north";
  if (Math.abs(point.y - (box.y + box.height)) <= epsilon) return "south";
  return undefined;
}

function exteriorStub(point: Point, side: ReturnType<typeof endpointSide>, clearance: number): Point {
  switch (side) {
    case "west": return { x: roundRoutingMetric(point.x - clearance), y: point.y };
    case "east": return { x: roundRoutingMetric(point.x + clearance), y: point.y };
    case "north": return { x: point.x, y: roundRoutingMetric(point.y - clearance) };
    case "south": return { x: point.x, y: roundRoutingMetric(point.y + clearance) };
    default: return { ...point };
  }
}

/** Builds deterministic outer-corridor alternatives without embedding view semantics. */
export function buildExteriorOrthogonalCandidates(
  edge: RoutingValidationEdge,
  boxes: readonly RoutingBox[],
  clearance = 16,
  epsilon = 0.5
): OrderedRouteCandidate[] {
  const source = edge.points[0];
  const target = edge.points.at(-1);
  if (!source || !target) {
    return [];
  }
  const boxById = new Map(boxes.map((box) => [box.id, box] as const));
  const sourceStub = exteriorStub(source, endpointSide(source, boxById.get(edge.sourceItemId), epsilon), clearance);
  const targetStub = exteriorStub(target, endpointSide(target, boxById.get(edge.targetItemId), epsilon), clearance);
  const minX = roundRoutingMetric(Math.min(sourceStub.x, targetStub.x, ...boxes.map((box) => box.x)) - clearance);
  const maxX = roundRoutingMetric(Math.max(sourceStub.x, targetStub.x, ...boxes.map((box) => box.x + box.width)) + clearance);
  const minY = roundRoutingMetric(Math.min(sourceStub.y, targetStub.y, ...boxes.map((box) => box.y)) - clearance);
  const maxY = roundRoutingMetric(Math.max(sourceStub.y, targetStub.y, ...boxes.map((box) => box.y + box.height)) + clearance);
  const route = (id: string, middle: Point[]): OrderedRouteCandidate => ({
    id,
    route: {
      style: "orthogonal",
      points: collapseRoutePoints([source, sourceStub, ...middle, targetStub, target])
    }
  });
  return [
    { id: "current", route: { style: edge.style, points: edge.points.map((point) => ({ ...point })) } },
    route("outer-top", [{ x: sourceStub.x, y: minY }, { x: targetStub.x, y: minY }]),
    route("outer-bottom", [{ x: sourceStub.x, y: maxY }, { x: targetStub.x, y: maxY }]),
    route("outer-left", [{ x: minX, y: sourceStub.y }, { x: minX, y: targetStub.y }]),
    route("outer-right", [{ x: maxX, y: sourceStub.y }, { x: maxX, y: targetStub.y }])
  ];
}

// Type-only dependency: lifecycle owns acceptance; this module only proposes geometry.
import type { FinalRoutingContext, FinalRoutingConnector } from "./lifecycle.js";
import { DEFAULT_ROUTING_POLICY } from "./contracts.js";
import { buildRoutingSegments } from "./geometry.js";
import { buildLogicalRunIds, buildRoutingRunDependencies } from "./occupancy.js";

/** Event-derived single-run changes compose into coupled turn arrangements in the coordinator. */
export function* buildTerminalTurnAlternatives(
  context: FinalRoutingContext,
  violations: readonly RoutingViolation[]
): Generator<readonly FinalRoutingConnector[]> {
  const policy = { ...DEFAULT_ROUTING_POLICY, ...context.policy };
  const ordered = [...context.connectors].sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  for (const c of ordered) {
    const relevant = violations.filter(v => v.connectorIds.includes(c.id));
    if (!relevant.length) continue;
    const logicalRunIds = buildLogicalRunIds(c.route);
    const segments = buildRoutingSegments(c.id, c.route, { logicalRunIds });
    const dependencies = buildRoutingRunDependencies(c.route);
    const implicated = new Set<string>();
    for (const v of relevant) {
      const index = v.routeSegmentIndexes?.[v.connectorIds.indexOf(c.id)];
      if (index === undefined) segments.forEach(s => implicated.add(s.logicalRunId));
      else {
        const dependency = dependencies[index];
        if (!dependency) continue;
        implicated.add(dependency.logicalRunId);
        for (const end of [dependency.start, dependency.end]) if (end.kind === "run") implicated.add(end.logicalRunId);
      }
    }
    for (const segment of segments) {
      const index = segment.routeSegmentIndex;
      if (index === 0 || index === c.route.points.length - 2 || !implicated.has(segment.logicalRunId)) continue;
      const constraint = c.runConstraints?.get(segment.logicalRunId);
      if (constraint?.lockedCoordinate !== undefined) continue;
      const horizontal = segment.axis === "horizontal";
      const transverse = (p: Point): number => horizontal ? p.y : p.x;
      const events = new Set<number>();
      const min = Math.max(horizontal ? context.bounds.minY : context.bounds.minX, constraint?.allowedRange?.min ?? -Infinity);
      const max = Math.min(horizontal ? context.bounds.maxY : context.bounds.maxX, constraint?.allowedRange?.max ?? Infinity);
      const add = (n: number): void => { const value = roundRoutingMetric(n); if (value >= min && value <= max) events.add(value); };
      add(min); add(max);
      for (const other of ordered) for (const p of other.route.points) {
        const value = transverse(p);
        add(value); add(value - policy.minSeparation); add(value + policy.minSeparation);
      }
      for (const box of [...context.boxes, ...(context.blockers ?? [])]) {
        const low = horizontal ? box.y : box.x, high = low + (horizontal ? box.height : box.width);
        for (const value of [low, high]) { add(value); add(value - policy.minSeparation); add(value + policy.minSeparation); }
      }
      for (const endpoint of [c.source, c.target]) {
        add(transverse(endpoint.point) - Math.max(endpoint.minLeg, policy.minTerminalLeg));
        add(transverse(endpoint.point) + Math.max(endpoint.minLeg, policy.minTerminalLeg));
      }
      for (const coordinate of [...events].sort((a, b) => Math.abs(a - segment.coordinate) - Math.abs(b - segment.coordinate) || a - b)) {
        if (Math.abs(coordinate - segment.coordinate) <= policy.epsilon) continue;
        const points = c.route.points.map(p => ({ ...p }));
        if (horizontal) points[index]!.y = points[index + 1]!.y = coordinate;
        else points[index]!.x = points[index + 1]!.x = coordinate;
        const normalized = collapseRoutePoints(points, policy.epsilon);
        // Topology-specific ownership cannot survive collapse without an explicit remapping.
        if (normalized.length !== points.length && (c.runConstraints?.size || c.sharedTrackGroupBySegmentIndex?.size)) continue;
        // Crossing marks refer to one geometry revision; an adapter must regenerate them
        // before a changed arrangement can satisfy require_mark.
        yield context.connectors.map(other => other.id === c.id
          ? { ...c, markedCrossings: undefined, route: { ...c.route, points: normalized } }
          : { ...other, markedCrossings: undefined });
      }
    }
  }
}
