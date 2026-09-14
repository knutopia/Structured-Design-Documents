import type { Point, PositionedRoute, PortSide } from "../contracts.js";
import { DEFAULT_ROUTING_POLICY, type RoutingBox, type RoutingCoordinateRange, type RoutingValidationPolicy, type RoutingViolation } from "./contracts.js";
import { buildRoutingSegments, segmentLength, perpendicularSegmentsCross } from "./geometry.js";
import { validateRouting } from "./validation.js";
import { buildLogicalRunIds, resolveAndReconstructRouteOccupancy } from "./occupancy.js";
import { buildTerminalTurnAlternatives } from "./candidates.js";

/** Resolved by the adapter from port/layout geometry before constructing candidates. */
export interface FinalRoutingEndpoint {
  point: Point;
  side: PortSide;
  nodeId: string;
  /** Zero is permitted only for an unmarked end without a port-owned stub. */
  minLeg: number;
}
export interface FinalRoutingRunConstraint {
  allowedRange?: RoutingCoordinateRange;
  lockedCoordinate?: number;
  lockReason?: "endpoint" | "resource" | "topology";
}
export interface FinalRoutingConnector {
  id: string;
  route: PositionedRoute;
  source: FinalRoutingEndpoint;
  target: FinalRoutingEndpoint;
  priority: number;
  /** Keys are logical run IDs within this topology, never stale array offsets. */
  runConstraints?: ReadonlyMap<string, FinalRoutingRunConstraint>;
  sharedTrackGroupBySegmentIndex?: ReadonlyMap<number, string>;
  markedCrossings?: ReadonlySet<string>;
}
export interface FinalRoutingContext {
  connectors: readonly FinalRoutingConnector[];
  boxes: readonly RoutingBox[];
  /** Adapter-declared solid headers/reservations; containers are not implicitly solid. */
  blockers?: readonly RoutingBox[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  policy?: Partial<RoutingValidationPolicy>;
}
export interface FinalRoutingTrace {
  validations: number;
  candidates: number;
  repairRevisions: number;
  expansionPasses: number;
  repeatedStates: number;
}
export type FinalRoutingResult =
  | { status: "resolved"; context: FinalRoutingContext; routeByConnectorId: ReadonlyMap<string, PositionedRoute>; violations: []; trace: FinalRoutingTrace }
  | { status: "failed"; reason: "invalid_context" | "candidate_exhausted" | "repair_exhausted" | "repeated_state" | "expansion_exhausted"; violations: RoutingViolation[]; debugConnectors: readonly FinalRoutingConnector[]; trace: FinalRoutingTrace };
export interface FinalRoutingOptions {
  maxCandidates?: number;
  maxRepairRevisions?: number;
  /** Absolute requirements, applied to the adapter's stable original layout. */
  expand?: (context: FinalRoutingContext, violations: readonly RoutingViolation[], absolutePass: number) => FinalRoutingContext | undefined;
}

function issue(kind: RoutingViolation["kind"], message: string, id: string, index?: number): RoutingViolation {
  return { kind, message, connectorIds: [id], segmentIds: [], routeSegmentIndexes: index === undefined ? undefined : [index] };
}
function outward(endpoint: FinalRoutingEndpoint, neighbour: Point, epsilon: number): boolean {
  const dx = neighbour.x - endpoint.point.x, dy = neighbour.y - endpoint.point.y;
  switch (endpoint.side) {
    case "east": return dx > epsilon && Math.abs(dy) <= epsilon;
    case "west": return dx < -epsilon && Math.abs(dy) <= epsilon;
    case "north": return dy < -epsilon && Math.abs(dx) <= epsilon;
    case "south": return dy > epsilon && Math.abs(dx) <= epsilon;
  }
}

/** Complete geometry acceptance for this API; intentionally has no interaction-exclusion switch. */
export function validateFinalRouteSet(context: FinalRoutingContext): RoutingViolation[] {
  const policy = { ...DEFAULT_ROUTING_POLICY, ...context.policy };
  const epsilon = policy.epsilon;
  const violations: RoutingViolation[] = [];
  const ids = new Set<string>();
  const b = context.bounds;
  if (![policy.minSeparation, policy.epsilon, policy.maxExpansionPasses].every(Number.isFinite)
    || policy.minSeparation <= 0 || policy.epsilon < 0 || policy.epsilon >= policy.minSeparation
    || !Number.isInteger(policy.maxExpansionPasses) || policy.maxExpansionPasses < 0
    || [...context.boxes, ...(context.blockers ?? [])].some(box =>
      ![box.x, box.y, box.width, box.height].every(Number.isFinite) || box.width < 0 || box.height < 0)) {
    return [issue("endpoint_mismatch", "Final routing requires finite policy and obstacle geometry.", "")];
  }
  if (![b.minX, b.minY, b.maxX, b.maxY].every(Number.isFinite) || b.minX > b.maxX || b.minY > b.maxY) {
    return [issue("empty_coordinate_range", "Final routing requires finite ordered canvas bounds.", "")];
  }
  for (const c of context.connectors) {
    const points = c.route.points;
    if (ids.has(c.id) || (c.route.style !== "orthogonal" && c.route.style !== "straight") || points.length < 2
      || !points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))
      || ![c.source, c.target].every(e => Number.isFinite(e.point.x) && Number.isFinite(e.point.y) && Number.isFinite(e.minLeg) && e.minLeg >= 0)) {
      violations.push(issue("endpoint_mismatch", "Final routing requires unique connectors, finite orthogonal routes and independently resolved endpoints.", c.id));
      continue;
    }
    ids.add(c.id);
    for (const [id, constraint] of c.runConstraints ?? []) {
      if (constraint.allowedRange && (!Number.isFinite(constraint.allowedRange.min) || !Number.isFinite(constraint.allowedRange.max) || constraint.allowedRange.min > constraint.allowedRange.max)
        || constraint.lockedCoordinate !== undefined && !Number.isFinite(constraint.lockedCoordinate)
        || !buildLogicalRunIds(c.route).includes(id)) {
        violations.push(issue("endpoint_mismatch", `Invalid or stale resource constraint for run ${id}.`, c.id));
      }
    }
    for (const [endpoint, neighbour, index] of [[c.source, points[1]!, 0], [c.target, points.at(-2)!, points.length - 2]] as const) {
      if (!outward(endpoint, neighbour, epsilon)) violations.push(issue("endpoint_intrusion", "Route violates its declared endpoint side or has a degenerate terminal section.", c.id, index));
      if (segmentLength(endpoint.point, neighbour) < endpoint.minLeg - epsilon) violations.push(issue("terminal_leg_too_short", `Terminal requires ${endpoint.minLeg}px clearance.`, c.id, index));
    }
    const segments = buildRoutingSegments(c.id, c.route, { logicalRunIds: buildLogicalRunIds(c.route) });
    for (const s of segments) {
      const constraint = c.runConstraints?.get(s.logicalRunId);
      if (constraint?.allowedRange && (s.coordinate < constraint.allowedRange.min - epsilon || s.coordinate > constraint.allowedRange.max + epsilon)
        || constraint?.lockedCoordinate !== undefined && Math.abs(s.coordinate - constraint.lockedCoordinate) > epsilon) {
        violations.push(issue("empty_coordinate_range", `Run ${s.logicalRunId} violates its declared resource or lock.`, c.id, s.routeSegmentIndex));
      }
    }
    if (points.some(p => p.x < b.minX - epsilon || p.x > b.maxX + epsilon || p.y < b.minY - epsilon || p.y > b.maxY + epsilon)) {
      violations.push(issue("empty_coordinate_range", "Route leaves the adapter's finite routing bounds.", c.id));
    }
  }
  if (violations.some(v => v.kind === "endpoint_mismatch")) return violations;
  const edges = context.connectors.map(c => ({ id: c.id, sourceItemId: c.source.nodeId, targetItemId: c.target.nodeId,
    style: "orthogonal" as const, points: c.route.points, expectedSourcePoint: c.source.point, expectedTargetPoint: c.target.point,
    sharedTrackGroupBySegmentIndex: c.sharedTrackGroupBySegmentIndex, markedCrossings: c.markedCrossings }));
  violations.push(...validateRouting({ edges, boxes: [...context.boxes, ...(context.blockers ?? [])], policy: { ...policy, minTerminalLeg: 0 } }));
  // Existing compatibility validation skips endpoint boxes. Here every section must stay outside
  // them, including later reentry; boundary attachment itself has no interior intersection.
  for (const c of context.connectors) {
    const endpointBoxes = context.boxes.filter(box => box.id === c.source.nodeId || box.id === c.target.nodeId);
    const reentry = validateRouting({ edges: [{ id: c.id, sourceItemId: "", targetItemId: "", style: c.route.style, points: c.route.points }], boxes: endpointBoxes, policy: { ...policy, minTerminalLeg: 0 } });
    violations.push(...reentry.map(v => ({ ...v, kind: "endpoint_intrusion" as const })));
  }
  return violations;
}

function accepted(context: FinalRoutingContext, trace: FinalRoutingTrace): FinalRoutingResult {
  const connectors = context.connectors.map(c => ({ ...c, route: Object.freeze({ style: c.route.style,
    points: Object.freeze(c.route.points.map(p => Object.freeze({ ...p }))) as unknown as Point[] }) }));
  return { status: "resolved", context: { ...context, connectors }, routeByConnectorId: new Map(connectors.map(c => [c.id, c.route])), violations: [], trace };
}

/** Expansion owners receive a detached revision so in-place rebuilding cannot erase
 * the authoritative input constraints used to check the returned context. */
function copyForExpansion(context: FinalRoutingContext): FinalRoutingContext {
  return { ...context, bounds: { ...context.bounds }, policy: { ...context.policy },
    boxes: context.boxes.map(box => ({ ...box })), blockers: context.blockers?.map(box => ({ ...box })),
    connectors: context.connectors.map(connector => ({ ...connector,
      source: { ...connector.source, point: { ...connector.source.point } },
      target: { ...connector.target, point: { ...connector.target.point } },
      route: { ...connector.route, points: connector.route.points.map(point => ({ ...point })) },
      runConstraints: connector.runConstraints && new Map([...connector.runConstraints].map(([id, constraint]) => [id,
        { ...constraint, allowedRange: constraint.allowedRange && { ...constraint.allowedRange } }])),
      sharedTrackGroupBySegmentIndex: connector.sharedTrackGroupBySegmentIndex && new Map(connector.sharedTrackGroupBySegmentIndex),
      markedCrossings: connector.markedCrossings && new Set(connector.markedCrossings)
    })) };
}

function canonical(context: FinalRoutingContext): string {
  return JSON.stringify([context.bounds, context.boxes, context.blockers, [...context.connectors].sort((a, b) => a.id.localeCompare(b.id))
    .map(c => [c.id, c.source, c.target, c.route.points])]);
}
interface RouteSetState { context: FinalRoutingContext; violations: RoutingViolation[]; score: number[]; key: string }
function score(context: FinalRoutingContext, baseline: FinalRoutingContext, violations: readonly RoutingViolation[], initialImplicated: ReadonlySet<string>): number[] {
  const nominal = new Map(baseline.connectors.map(c => [c.id, c]));
  let unrelated = 0, displacement = 0, bends = 0, length = 0, crossings = 0;
  const maxPriority = Math.max(0, ...context.connectors.map(c => c.priority));
  for (const c of context.connectors) {
    const original = nominal.get(c.id)!;
    if (JSON.stringify(original.route.points) !== JSON.stringify(c.route.points) && !initialImplicated.has(c.id)) unrelated++;
    c.route.points.forEach((p, i) => {
      const q = original.route.points[Math.min(i, original.route.points.length - 1)]!;
      displacement += (Math.abs(p.x - q.x) + Math.abs(p.y - q.y)) * (maxPriority - c.priority + 1);
      if (i) length += segmentLength(c.route.points[i - 1]!, p);
    });
    bends += c.route.points.length - 2;
  }
  for (let i = 0; i < context.connectors.length; i++) for (let j = i + 1; j < context.connectors.length; j++) {
    const a = context.connectors[i]!, b = context.connectors[j]!;
    const treatment = context.policy?.crossingTreatmentForPair?.(a.id, b.id) ?? context.policy?.crossingTreatment ?? DEFAULT_ROUTING_POLICY.crossingTreatment;
    if (treatment !== "penalize") continue;
    for (const x of buildRoutingSegments(a.id, a.route)) for (const y of buildRoutingSegments(b.id, b.route)) if (perpendicularSegmentsCross(x, y)) crossings++;
  }
  return [violations.length, unrelated, displacement, crossings, bends, length];
}
function compareStates(a: RouteSetState, b: RouteSetState): number {
  for (let i = 0; i < a.score.length; i++) if (Math.abs(a.score[i]! - b.score[i]!) > 0.0001) return a.score[i]! - b.score[i]!;
  return a.key.localeCompare(b.key);
}

/** One final-acceptance coordinator. Every geometry revision is rebuilt and checked globally. */
export function runRoutingLifecycle(initial: FinalRoutingContext, options: FinalRoutingOptions = {}): FinalRoutingResult {
  const trace: FinalRoutingTrace = { validations: 0, candidates: 0, repairRevisions: 0, expansionPasses: 0, repeatedStates: 0 };
  const maxCandidates = Math.max(1, options.maxCandidates ?? 4096), maxRevisions = Math.max(0, options.maxRepairRevisions ?? 128);
  if (!Number.isSafeInteger(maxCandidates) || !Number.isSafeInteger(maxRevisions)) {
    return { status: "failed", reason: "invalid_context", violations: [issue("assignment_exhausted", "Final routing requires finite integer search budgets.", "")], debugConnectors: initial.connectors, trace };
  }
  const seen = new Set<string>();
  const initialViolations = validateFinalRouteSet(initial); trace.validations++;
  const initialImplicated = new Set(initialViolations.flatMap(v => v.connectorIds));
  let context = initial;
  let best: RouteSetState = { context, violations: initialViolations, score: score(context, initial, initialViolations, initialImplicated), key: canonical(context) };
  if (!initialViolations.length) return accepted(context, trace);
  if (initialViolations.some(v => v.kind === "endpoint_mismatch")) return { status: "failed", reason: "invalid_context", violations: initialViolations, debugConnectors: context.connectors, trace };
  // Preserve the established assignment candidate when it satisfies the complete contract.
  // Assignment failure is only a frozen-span result and cannot terminate bend repair.
  let assignmentCandidate: RouteSetState | undefined;
  if (maxCandidates > 1) {
    const assignment = resolveAndReconstructRouteOccupancy(initial.connectors.map(c => {
      const ids = buildLogicalRunIds(c.route);
      return { connectorId: c.id, route: c.route, priority: c.priority,
        // The initial assignment candidate owns implicated connectors only; complete
        // surrounding geometry remains present as fixed claims. Later revisions can
        // widen the affected set if reconstructed spans expose another interaction.
        lockedSegmentKeys: initialImplicated.has(c.id) ? undefined : new Set(ids.map((_id, i) => `${c.id}|${i}`)),
        sharedTrackGroupBySegmentIndex: c.sharedTrackGroupBySegmentIndex,
        observationsBySegmentKey: new Map(ids.flatMap((id, i) => {
          const constraint = c.runConstraints?.get(id);
          return constraint ? [[`${c.id}|${i}`, [constraint]] as const] : [];
        })) };
    }), { buildSegmentKey: (id, index) => `${id}|${index}`, policy: initial.policy });
    if (assignment.status === "resolved") {
      const reconstructed = { ...initial, connectors: initial.connectors.map(c => ({ ...c, markedCrossings: undefined, route: assignment.routeByConnectorId.get(c.id)! })) };
      const violations = validateFinalRouteSet(reconstructed); trace.validations++; trace.candidates++;
      if (!violations.length) assignmentCandidate = { context: reconstructed, violations, key: canonical(reconstructed), score: score(reconstructed, initial, violations, initialImplicated) };
    }
  }
  while (trace.candidates < maxCandidates) {
    const seedViolations = trace.expansionPasses === 0 ? initialViolations : validateFinalRouteSet(context);
    if (trace.expansionPasses) {
      trace.validations++;
      best = { context, violations: seedViolations, score: score(context, initial, seedViolations, initialImplicated), key: canonical(context) };
    }
    trace.candidates++;
    if (!seedViolations.length) return accepted(context, trace);
    const queue: RouteSetState[] = [{ context, violations: seedViolations, score: score(context, initial, seedViolations, initialImplicated), key: canonical(context) }];
    seen.add(queue[0]!.key);
    while (queue.length && trace.candidates < maxCandidates && trace.repairRevisions < maxRevisions) {
      queue.sort(compareStates);
      const current = queue.shift()!;
      trace.repairRevisions++;
      let valid: RouteSetState | undefined = assignmentCandidate;
      assignmentCandidate = undefined;
      for (const connectors of buildTerminalTurnAlternatives(current.context, current.violations)) {
        if (trace.candidates >= maxCandidates) break;
        const next = { ...current.context, connectors }, key = canonical(next);
        if (seen.has(key)) { trace.repeatedStates++; continue; }
        seen.add(key); trace.candidates++;
        const violations = validateFinalRouteSet(next); trace.validations++;
        const state = { context: next, violations, key, score: score(next, initial, violations, initialImplicated) };
        if (compareStates(state, best) < 0) best = state;
        if (!violations.length) { if (!valid || compareStates(state, valid) < 0) valid = state; continue; }
        // Candidate changes may expose another route/component. Its violations drive the next revision.
        // Irreversible endpoint/resource violations cannot be fixed by unrelated later turn changes.
        if (violations.some(v => v.kind !== "track_separation" && v.kind !== "collinear_overlap" && v.kind !== "perpendicular_crossing")) continue;
        queue.push(state);
      }
      if (valid) return accepted(valid.context, trace);
    }
    const policy = { ...DEFAULT_ROUTING_POLICY, ...context.policy };
    if (!options.expand || trace.expansionPasses >= policy.maxExpansionPasses || trace.candidates >= maxCandidates || trace.repairRevisions >= maxRevisions) break;
    const expanded = options.expand(copyForExpansion(best.context), best.violations, trace.expansionPasses + 1);
    if (!expanded) break;
    // Expansion rebuilds geometry, never the semantic membership or acceptance policy.
    const byId = new Map(expanded.connectors.map(c => [c.id, c]));
    const boxes = new Set(expanded.boxes.map(box => box.id));
    const blockers = new Set(expanded.blockers?.map(box => box.id));
    if (expanded.connectors.length !== initial.connectors.length || initial.connectors.some(c => {
      const next = byId.get(c.id);
      return !next || next.source.nodeId !== c.source.nodeId || next.target.nodeId !== c.target.nodeId
        || next.priority !== c.priority || next.source.side !== c.source.side || next.target.side !== c.target.side
        || next.source.minLeg < c.source.minLeg || next.target.minLeg < c.target.minLeg
        || [...(c.runConstraints ?? [])].some(([id, constraint]) => {
          const retained = next.runConstraints?.get(id);
          return !retained || retained.lockReason !== constraint.lockReason
            || constraint.lockedCoordinate !== undefined && retained.lockedCoordinate !== constraint.lockedCoordinate
            || constraint.allowedRange !== undefined && (!retained.allowedRange
              || retained.allowedRange.min < constraint.allowedRange.min || retained.allowedRange.max > constraint.allowedRange.max);
        })
        || JSON.stringify([...(c.sharedTrackGroupBySegmentIndex ?? [])]) !== JSON.stringify([...(next.sharedTrackGroupBySegmentIndex ?? [])]);
    }) || initial.boxes.some(box => !boxes.has(box.id)) || initial.blockers?.some(box => !blockers.has(box.id))) {
      return { status: "failed", reason: "invalid_context", violations: [issue("endpoint_mismatch", "Expansion dropped required routing context or weakened endpoint, resource, or sharing constraints.", "")], debugConnectors: context.connectors, trace };
    }
    const before = context.bounds, after = expanded.bounds;
    if (after.minX > before.minX || after.minY > before.minY || after.maxX < before.maxX || after.maxY < before.maxY
      || canonical(expanded) === canonical(context)) { trace.repeatedStates++; break; }
    trace.expansionPasses++;
    context = { ...expanded, policy: initial.policy };
  }
  if (assignmentCandidate) return accepted(assignmentCandidate.context, trace);
  return { status: "failed", reason: trace.repairRevisions >= maxRevisions ? "repair_exhausted" : trace.candidates >= maxCandidates ? "candidate_exhausted" : options.expand && trace.expansionPasses >= (context.policy?.maxExpansionPasses ?? DEFAULT_ROUTING_POLICY.maxExpansionPasses) ? "expansion_exhausted" : trace.repeatedStates ? "repeated_state" : "candidate_exhausted",
    violations: best.violations, debugConnectors: best.context.connectors, trace };
}
