import { effectiveRoutingBounds } from "./bounds.js";
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
import { collapseRoutePoints, roundRoutingMetric, routingObstacleEnvelope, segmentIntersectsBoxInterior } from "./geometry.js";

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
  "node_clearance",
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
import type { FinalRoutingContext, FinalRoutingConnector, FinalRoutingEndpoint } from "./lifecycle.js";
import { DEFAULT_ROUTING_POLICY, type RoutingPolicy } from "./contracts.js";
import { buildRoutingSegments, departsOutwardFromPort } from "./geometry.js";
import { buildLogicalRunIds, buildRoutingRunDependencies } from "./occupancy.js";

/**
 * Minimum outward stub for a constructed corridor route, in px.
 *
 * A zero-length stub would collapse away and could leave the first segment departing
 * sideways rather than outward, which acceptance rejects as `endpoint_intrusion`. The
 * floor guarantees the stub survives `collapseRoutePoints` as a real outward leg.
 */
const CORRIDOR_MIN_STUB = 8;

/**
 * Hard cap on corridor candidates per connector.
 *
 * Coordinate events scale with scene density (every box edge and every other route
 * point, each with a ±minSeparation variant), so an uncapped enumeration would make
 * recovery cost unbounded and order-dependent. The cap keeps recovery deterministic
 * and bounded; ordering is minimal-change-first so the cap drops the least plausible
 * candidates.
 */
const MAX_CORRIDOR_CANDIDATES_PER_CONNECTOR = 256;

function corridorStub(endpoint: FinalRoutingEndpoint, clearance = 0): Point {
  const distance = Math.max(endpoint.minLeg, CORRIDOR_MIN_STUB, clearance);
  switch (endpoint.side) {
    case "east": return { x: roundRoutingMetric(endpoint.point.x + distance), y: endpoint.point.y };
    case "west": return { x: roundRoutingMetric(endpoint.point.x - distance), y: endpoint.point.y };
    case "north": return { x: endpoint.point.x, y: roundRoutingMetric(endpoint.point.y - distance) };
    case "south": return { x: endpoint.point.x, y: roundRoutingMetric(endpoint.point.y + distance) };
  }
}

/** Deterministic outward U seed for distinct ports on the same side.
 * This supplies geometry only: owner bounds and blockers still require full validation.
 * Straight rendering intent and coincident cross-axis attachments are not rebuilt. */
export function buildPortCorridorSeed(connector: FinalRoutingConnector, outwardClearance: number): PositionedRoute | undefined {
  if (!Number.isFinite(outwardClearance) || outwardClearance < 0
    || ![connector.source, connector.target].every(endpoint =>
      [endpoint.point.x, endpoint.point.y, endpoint.minLeg].every(Number.isFinite) && endpoint.minLeg >= 0)) {
    throw new RangeError("Port corridor seeds require finite endpoints and nonnegative clearance.");
  }
  if (connector.route.style !== "orthogonal" || connector.source.side !== connector.target.side) return undefined;
  const side = connector.source.side;
  const vertical = side === "north" || side === "south";
  const source = connector.source.point, target = connector.target.point;
  if (Math.abs(vertical ? source.x - target.x : source.y - target.y) <= DEFAULT_ROUTING_POLICY.epsilon) return undefined;
  const sourceStub = corridorStub(connector.source, outwardClearance);
  const targetStub = corridorStub(connector.target, outwardClearance);
  const coordinate = side === "north" ? Math.min(sourceStub.y, targetStub.y)
    : side === "south" ? Math.max(sourceStub.y, targetStub.y)
    : side === "west" ? Math.min(sourceStub.x, targetStub.x) : Math.max(sourceStub.x, targetStub.x);
  const points = collapseRoutePoints([source,
    vertical ? { x: source.x, y: coordinate } : { x: coordinate, y: source.y },
    vertical ? { x: target.x, y: coordinate } : { x: coordinate, y: target.y }, target], DEFAULT_ROUTING_POLICY.epsilon);
  return { style: "orthogonal", points };
}

/**
 * Port-to-port corridor candidates for one connector, minimal-change first.
 *
 * Why this exists. `buildTerminalTurnAlternatives` rewrites ONE existing segment
 * coordinate per yield, so it can only ever preserve the emitted topology. When the
 * emitted route is already wrong — for example an eight-point detour that cuts through
 * a box, where the correct route is a four-point path staying inside the channel both
 * ports already face — no single-coordinate edit can reach the correct shape, because
 * reaching it requires several points to collapse away at once. Every one-move
 * neighbour then still intersects a box, and the coordinator refuses to queue states
 * carrying such violations, so the repair frontier dies immediately. Measured on the
 * frozen SDD-app fixture: 2312 one-move alternatives, zero queueable, in all eight
 * failing `scenario_flow` gates.
 *
 * This generator supplies the missing capability by constructing routes from the two
 * DECLARED ports rather than perturbing the emitted route. Both stubs step outward
 * along the declared side, so port outwardness and `minLeg` hold by construction for
 * any middle geometry.
 *
 * Deterministic: coordinate events are collected into sets, then sorted by distance
 * from the coordinate the emitted route already used for its first internal run on the
 * relevant axis, with a numeric tiebreak. The same context always yields the same
 * sequence.
 */
export function* buildPortCorridorCandidates(
  connector: FinalRoutingConnector,
  context: FinalRoutingContext,
  options: { topologyOrder?: "balanced" } = {}
): Generator<Point[]> {
  // A `straight` route's geometry IS its contract: the adapter asked for a direct line
  // between two ports. Rebuilding it as a multi-bend corridor is not repair, it is
  // substitution of a different rendering intent, and it would silently accept a diagonal
  // route that acceptance is required to reject. Only `orthogonal` routes grant the router
  // latitude over their shape, so only those are eligible.
  if (connector.route.style !== "orthogonal") {
    return;
  }
  // A fresh topology re-derives logical run IDs from the route, so any run constraint or
  // shared track group keyed to the previous topology would become stale. Acceptance
  // reports that as `endpoint_mismatch`, which terminates the lifecycle outright, so such
  // connectors are not eligible for corridor recovery. This mirrors the ownership guard
  // `buildTerminalTurnAlternatives` applies before accepting a collapsed point count.
  if (connector.runConstraints?.size || connector.sharedTrackGroupBySegmentIndex?.size) {
    return;
  }

  const policy: RoutingPolicy = { ...DEFAULT_ROUTING_POLICY, ...context.policy };
  const separation = policy.minSeparation;
  const epsilon = policy.epsilon;
  const bounds = effectiveRoutingBounds(connector, context);
  const sourceStub = corridorStub(connector.source, context.boxes.find(box => box.id === connector.source.nodeId)?.clearance);
  const targetStub = corridorStub(connector.target, context.boxes.find(box => box.id === connector.target.nodeId)?.clearance);
  const boxes = [...context.boxes, ...(context.blockers ?? [])]
    .filter(box => !box.appliesToConnectorIds || box.appliesToConnectorIds.includes(connector.id))
    .map(routingObstacleEnvelope);

  // Candidate middle-run coordinates, drawn from the same event sources the turn
  // generator uses: box edges, other routes' points, and this route's own points. The
  // last of these matters most — the natural channel is frequently a coordinate the
  // emitted route already touches.
  const xs = new Set<number>();
  const ys = new Set<number>();
  const addX = (n: number): void => {
    for (const value of [n, n - separation, n + separation]) {
      const rounded = roundRoutingMetric(value);
      if (rounded >= bounds.minX && rounded <= bounds.maxX) xs.add(rounded);
    }
  };
  const addY = (n: number): void => {
    for (const value of [n, n - separation, n + separation]) {
      const rounded = roundRoutingMetric(value);
      if (rounded >= bounds.minY && rounded <= bounds.maxY) ys.add(rounded);
    }
  };
  for (const box of boxes) {
    addX(box.x); addX(box.x + box.width);
    addY(box.y); addY(box.y + box.height);
  }
  for (const other of context.connectors) {
    for (const point of other.route.points) { addX(point.x); addY(point.y); }
  }
  for (const point of connector.route.points) { addX(point.x); addY(point.y); }
  addX(sourceStub.x); addX(targetStub.x);
  addY(sourceStub.y); addY(targetStub.y);

  const segments = buildRoutingSegments(connector.id, connector.route, {
    logicalRunIds: buildLogicalRunIds(connector.route)
  });
  const preferredX = segments.find(s => s.axis === "vertical" && s.endpointRole === "internal")?.coordinate ?? sourceStub.x;
  const preferredY = segments.find(s => s.axis === "horizontal" && s.endpointRole === "internal")?.coordinate ?? sourceStub.y;
  const byPreference = (preferred: number) => (a: number, b: number): number =>
    Math.abs(a - preferred) - Math.abs(b - preferred) || a - b;
  // Split the budget across both axes so a dense scene cannot spend it all on one.
  const perAxis = Math.max(1, Math.floor((MAX_CORRIDOR_CANDIDATES_PER_CONNECTOR - 3) / (options.topologyOrder === "balanced" ? 4 : 2)));
  const orderedEvents = (values: Set<number>, preferred: number, spanMin: number, spanMax: number): number[] => {
    const ordered = [...values].sort(byPreference(preferred));
    if (options.topologyOrder !== "balanced") return ordered.slice(0, perAxis);
    const midpoint = (spanMin + spanMax) / 2;
    const flanks = [ordered.filter(value => value < spanMin), ordered.filter(value => value > spanMax),
      ordered.filter(value => value >= spanMin && value <= midpoint).sort(byPreference(spanMin)),
      ordered.filter(value => value > midpoint && value <= spanMax).sort(byPreference(spanMax))];
    const balanced: number[] = [];
    for (let index = 0; flanks.some(flank => index < flank.length); index++) {
      for (const flank of flanks) if (flank[index] !== undefined) balanced.push(flank[index]!);
    }
    return balanced.slice(0, perAxis);
  };
  const orderedXs = orderedEvents(xs, preferredX, Math.min(sourceStub.x, targetStub.x), Math.max(sourceStub.x, targetStub.x));
  const orderedYs = orderedEvents(ys, preferredY, Math.min(sourceStub.y, targetStub.y), Math.max(sourceStub.y, targetStub.y));

  const wrap = (middle: readonly Point[]): Point[] => collapseRoutePoints(
    [connector.source.point, sourceStub, ...middle, targetStub, connector.target.point],
    epsilon
  );
  // A candidate whose terminals do not depart outward can never be accepted, so it is
  // dropped here rather than yielded for the coordinator to reject.
  const departsOutward = (points: readonly Point[]): boolean => points.length >= 2
    && departsOutwardFromPort(connector.source.side, points[0]!, points[1]!, epsilon)
    && departsOutwardFromPort(connector.target.side, points.at(-1)!, points.at(-2)!, epsilon)
    // Collapsing a collinear turn can shorten the surviving terminal section.
    // Recovery must not freeze a candidate that violates its endpoint contract.
    && (context.corridorSearch !== "obstacle_aware" || (
      Math.hypot(points[1]!.x - points[0]!.x, points[1]!.y - points[0]!.y) >= connector.source.minLeg - epsilon
      && Math.hypot(points.at(-2)!.x - points.at(-1)!.x, points.at(-2)!.y - points.at(-1)!.y) >= connector.target.minLeg - epsilon));

  const seen = new Set<string>();
  const queue: Point[][] = [];
  let family = "direct";
  const familyByRoute = new Map<Point[], string>();
  let familyCoordinate: number | undefined;
  const coordinateByRoute = new Map<Point[], number>();
  const push = (points: Point[]): void => {
    if (queue.length >= MAX_CORRIDOR_CANDIDATES_PER_CONNECTOR) return;
    if (!departsOutward(points)) return;
    if (context.corridorSearch === "obstacle_aware" && points.slice(1).some((point, index) => Math.abs(point.x - points[index]!.x) > epsilon
      && Math.abs(point.y - points[index]!.y) > epsilon)) return;
    // Reject solid intersections before consuming the bounded candidate set.
    // Only the incident leg may cross its own node's attachment envelope.
    if (context.corridorSearch === "obstacle_aware") for (let index = 0; index < points.length - 1; index++) for (const box of boxes) {
      if (index === 0 && box.id === connector.source.nodeId
        || index === points.length - 2 && box.id === connector.target.nodeId) continue;
      const axis = Math.abs(points[index]!.x - points[index + 1]!.x) <= epsilon ? "vertical" : "horizontal";
      if (box.blocksAxis && box.blocksAxis !== axis) continue;
      if (segmentIntersectsBoxInterior(points[index]!, points[index + 1]!, box, epsilon)) return;
    }
    const key = JSON.stringify(points);
    if (seen.has(key)) return;
    seen.add(key);
    queue.push(points);
    familyByRoute.set(points, family);
    if (familyCoordinate !== undefined) coordinateByRoute.set(points, familyCoordinate);
  };

  // Straight stub-to-stub, then the two one-corner L shapes, then two-corner Z shapes
  // with a free middle run. Ordered by increasing bend count so the simplest viable
  // corridor is proposed first.
  push(wrap([]));
  push(wrap([{ x: targetStub.x, y: sourceStub.y }]));
  push(wrap([{ x: sourceStub.x, y: targetStub.y }]));
  const pushX = (c: number) => { family = "x"; familyCoordinate = c; push(wrap([{ x: c, y: sourceStub.y }, { x: c, y: targetStub.y }])); };
  const pushY = (c: number) => { family = "y"; familyCoordinate = c; push(wrap([{ x: sourceStub.x, y: c }, { x: targetStub.x, y: c }])); };
  if (options.topologyOrder === "balanced") {
    for (let index = 0; index < Math.max(orderedXs.length, orderedYs.length); index++) {
      if (orderedXs[index] !== undefined) pushX(orderedXs[index]!);
      if (orderedYs[index] !== undefined) pushY(orderedYs[index]!);
    }
  } else {
    orderedXs.forEach(pushX); orderedYs.forEach(pushY);
  }

  // A channel can require leaving both endpoint rows: e.g. a north-to-south
  // return beside a self-loop, with a marker blocking its nearest horizontal
  // run. Two independent event coordinates reach that exterior corridor.
  family = "exterior"; familyCoordinate = undefined;
  if (context.corridorSearch === "obstacle_aware") for (const x of orderedXs) for (const y of orderedYs) {
    if (queue.length >= MAX_CORRIDOR_CANDIDATES_PER_CONNECTOR) break;
    push(wrap([{ x: sourceStub.x, y }, { x, y }, { x, y: targetStub.y }]));
    push(wrap([{ x, y: sourceStub.y }, { x, y }, { x: targetStub.x, y }]));
  }

  if (options.topologyOrder === "balanced") {
    // Reserve exposure for each topology family: an axis with many events cannot
    // consume every early trial before a different axis or exterior turn appears.
    const families = ["direct", "x", "y", "exterior"].map(name => {
      const routes = queue.filter(route => familyByRoute.get(route) === name);
      if (name !== "x" && name !== "y") return routes.sort((a, b) => a.length - b.length);
      const spanMin = name === "x" ? Math.min(sourceStub.x, targetStub.x) : Math.min(sourceStub.y, targetStub.y);
      const spanMax = name === "x" ? Math.max(sourceStub.x, targetStub.x) : Math.max(sourceStub.y, targetStub.y);
      const preferred = name === "x" ? preferredX : preferredY;
      const midpoint = (spanMin + spanMax) / 2;
      const flanks = [
        { routes: routes.filter(route => coordinateByRoute.get(route)! < spanMin), preferred },
        { routes: routes.filter(route => coordinateByRoute.get(route)! > spanMax), preferred },
        { routes: routes.filter(route => coordinateByRoute.get(route)! >= spanMin && coordinateByRoute.get(route)! <= midpoint), preferred: spanMin },
        { routes: routes.filter(route => coordinateByRoute.get(route)! > midpoint && coordinateByRoute.get(route)! <= spanMax), preferred: spanMax }
      ].map(flank => flank.routes.sort((a, b) => a.length - b.length
        || Math.abs(coordinateByRoute.get(a)! - flank.preferred) - Math.abs(coordinateByRoute.get(b)! - flank.preferred)
        || coordinateByRoute.get(a)! - coordinateByRoute.get(b)!));
      const alternated: Point[][] = [];
      for (let index = 0; flanks.some(flank => index < flank.length); index++) {
        for (const flank of flanks) if (flank[index]) alternated.push(flank[index]!);
      }
      return alternated;
    });
    const balanced: Point[][] = [];
    for (let index = 0; families.some(routes => index < routes.length); index++) {
      for (const routes of families) if (routes[index]) balanced.push(routes[index]!);
    }
    queue.splice(0, queue.length, ...balanced);
  }
  for (const points of queue.slice(0, MAX_CORRIDOR_CANDIDATES_PER_CONNECTOR)) {
    yield points;
  }
}

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
      const bounds = effectiveRoutingBounds(c, context);
      const horizontal = segment.axis === "horizontal";
      const transverse = (p: Point): number => horizontal ? p.y : p.x;
      const events = new Set<number>();
      const min = Math.max(horizontal ? bounds.minY : bounds.minX, constraint?.allowedRange?.min ?? -Infinity);
      const max = Math.min(horizontal ? bounds.maxY : bounds.maxX, constraint?.allowedRange?.max ?? Infinity);
      const add = (n: number): void => { const value = roundRoutingMetric(n); if (value >= min && value <= max) events.add(value); };
      add(min); add(max);
      for (const other of ordered) for (const p of other.route.points) {
        const value = transverse(p);
        add(value); add(value - policy.minSeparation); add(value + policy.minSeparation);
      }
      for (const box of [...context.boxes, ...(context.blockers ?? [])]
        .filter(box => !box.appliesToConnectorIds || box.appliesToConnectorIds.includes(c.id))
        .map(routingObstacleEnvelope)) {
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
