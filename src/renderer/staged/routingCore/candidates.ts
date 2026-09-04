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
