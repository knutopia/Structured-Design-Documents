import type { Point, PortSide } from "../contracts.js";
import { effectiveRoutingBounds } from "./bounds.js";
import { DEFAULT_ROUTING_POLICY, type RoutingBox } from "./contracts.js";
import { collapseRoutePoints } from "./geometry.js";
import { validateFinalRouteSet, type FinalRoutingConnector, type FinalRoutingContext } from "./lifecycle.js";
import { routeCost } from "./optimization.js";
import type { RoutingQualityBudget } from "./qualitySelection.js";

export interface MovableSourceProposal {
  connector: FinalRoutingConnector;
  interval: readonly [number, number];
  coordinate: number;
  midpoint: number;
  displacement: number;
}
export interface MovableSourceInput {
  context: FinalRoutingContext;
  connectorId: string;
  sourceBox: RoutingBox;
  sourceSide: PortSide;
  targetSide: PortSide;
  sourceInset: number;
  portPitch: number;
  occupiedSourcePorts: readonly Point[];
  /** Measured labels and other solid painted reservations. */
  extraBlockers?: readonly RoutingBox[];
  budget: RoutingQualityBudget;
}
const normals: Record<PortSide, Point> = {
  north: { x: 0, y: -1 }, south: { x: 0, y: 1 }, west: { x: -1, y: 0 }, east: { x: 1, y: 0 }
};
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y;
/** Geometric event partition, followed by shared complete-route validation. Each
 * open cell has unchanged obstacle/track incidence; no pixel-offset sampling. */
export function proposeMovableSourceRoutes(input: MovableSourceInput): {
  proposals: MovableSourceProposal[]; intervals: (readonly [number, number])[]; rejections: string[]; exhausted: boolean;
} {
  const result = { proposals: [] as MovableSourceProposal[], intervals: [] as (readonly [number, number])[], rejections: [] as string[], exhausted: false };
  const original = input.context.connectors.find(connector => connector.id === input.connectorId);
  if (!original || original.source.nodeId === original.target.nodeId || original.runConstraints?.size || original.sharedTrackGroupBySegmentIndex?.size) {
    result.rejections.push("ineligible_connector"); return result;
  }
  const n = normals[input.sourceSide], targetNormal = normals[input.targetSide];
  if (dot(n, targetNormal) !== 0 || original.target.side !== input.targetSide) { result.rejections.push("incompatible_side_pair"); return result; }
  const t = { x: -targetNormal.x, y: -targetNormal.y };
  const project = (point: Point) => ({ u: dot(point, t), v: dot(point, n) });
  const unproject = (u: number, v: number): Point => ({ x: u * t.x + v * n.x, y: u * t.y + v * n.y });
  const rectangle = (box: RoutingBox) => {
    const corners = [{ x: box.x, y: box.y }, { x: box.x + box.width, y: box.y },
    { x: box.x, y: box.y + box.height }, { x: box.x + box.width, y: box.y + box.height }].map(project);
    return {
      minU: Math.min(...corners.map(p => p.u)), maxU: Math.max(...corners.map(p => p.u)),
      minV: Math.min(...corners.map(p => p.v)), maxV: Math.max(...corners.map(p => p.v))
    };
  };
  const source = rectangle(input.sourceBox), target = project(original.target.point);
  const epsilon = input.context.policy?.epsilon ?? DEFAULT_ROUTING_POLICY.epsilon;
  const minimum = Math.max(epsilon, original.target.minLeg);
  const bounds = effectiveRoutingBounds(original, input.context);
  const envelope = rectangle({ id: "bounds", x: bounds.minX, y: bounds.minY, width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY });
  const low = Math.max(source.minU + input.sourceInset, envelope.minU);
  const high = Math.min(source.maxU - input.sourceInset, envelope.maxU, target.u - minimum);
  if (![low, high, target.u, target.v, input.portPitch, input.sourceInset].every(Number.isFinite)
    || input.portPitch < 0 || input.sourceInset < 0 || high < low || target.v - source.maxV < Math.max(epsilon, original.source.minLeg)) {
    result.rejections.push("empty_endpoint_interval"); return result;
  }
  const events = new Set<number>([low, high]);
  const add = (value: number) => { if (value >= low && value <= high) events.add(value); };
  const separation = input.context.policy?.minSeparation ?? DEFAULT_ROUTING_POLICY.minSeparation;
  const blockers = [...input.context.boxes, ...(input.context.blockers ?? []), ...(input.extraBlockers ?? [])];
  for (const box of blockers) {
    const rect = rectangle(box), clearance = box.clearance ?? 0;
    for (const value of [rect.minU, rect.maxU]) for (const offset of [-clearance, 0, clearance]) add(value + offset);
  }
  for (const connector of input.context.connectors) if (connector.id !== original.id) {
    for (const point of connector.route.points) for (const offset of [-separation, 0, separation]) add(project(point).u + offset);
  }
  for (const port of input.occupiedSourcePorts) { add(project(port).u - input.portPitch); add(project(port).u + input.portPitch); }
  const midpoint = (source.minU + source.maxU) / 2;
  const context = { ...input.context, blockers: [...(input.context.blockers ?? []), ...(input.extraBlockers ?? [])] };
  const build = (u: number): FinalRoutingConnector => {
    const start = unproject(u, source.maxV);
    return {
      ...original, source: { ...original.source, side: input.sourceSide, point: start },
      route: { ...original.route, points: [start, unproject(u, target.v), { ...original.target.point }] }
    };
  };
  const legal = (u: number): boolean => {
    if (input.budget.candidates <= 0) { result.exhausted = true; return false; }
    input.budget.candidates--;
    if (input.occupiedSourcePorts.some(port => Math.abs(project(port).u - u) < input.portPitch - epsilon)) return false;
    const connector = build(u);
    const violations = validateFinalRouteSet({ ...context, connectors: context.connectors.map(other => other.id === original.id ? connector : other) });
    return violations.length === 0;
  };
  const ordered = [...events].sort((a, b) => a - b);
  const coordinates = new Set<number>();
  for (let index = 0; index < ordered.length; index++) {
    const a = ordered[index]!, b = ordered[index + 1];
    if (legal(a)) { result.intervals.push([a, a]); coordinates.add(a); }
    if (b !== undefined && b > a && legal((a + b) / 2)) {
      result.intervals.push([a, b]);
      // Boundaries remain subject to their own audit; tolerance never authorizes
      // moving into a required clearance envelope.
      const nearest = Math.max(a, Math.min(b, midpoint));
      if (legal(nearest)) coordinates.add(nearest);
    }
    if (result.exhausted) break;
  }
  for (const coordinate of coordinates) result.proposals.push({
    connector: build(coordinate), coordinate, midpoint,
    displacement: Math.abs(coordinate - midpoint), interval: result.intervals.find(([a, b]) => coordinate >= a && coordinate <= b)!
  });
  result.proposals.sort((a, b) => a.displacement - b.displacement || routeCost([a.connector])[2] - routeCost([b.connector])[2] || a.coordinate - b.coordinate);
  if (!result.proposals.length && !result.exhausted) result.rejections.push("blocked_interval");
  return result;
}

/** Independent admission: callers must additionally audit both full scenes,
 * bind identical layout/labels/policy, and verify no new expansion demand. */
export function auditMovableSourceAdmission(baseline: FinalRoutingContext, proposed: FinalRoutingContext, shortcutIds: ReadonlySet<string>): string[] {
  const problems: string[] = [];
  const ordinary = new Map(baseline.connectors.map(connector => [connector.id, connector]));
  const ids = proposed.connectors.map(connector => connector.id);
  if (new Set(ids).size !== ids.length || ordinary.size !== baseline.connectors.length || ids.length !== ordinary.size || ids.some(id => !ordinary.has(id))) return ["occurrence_inventory_mismatch"];
  const normalize = (context: FinalRoutingContext) => context.connectors.map(connector => ({ ...connector, route: { ...connector.route, points: collapseRoutePoints(connector.route.points) } }));
  const b = normalize(baseline), f = normalize(proposed);
  for (const connector of f) {
    const before = b.find(candidate => candidate.id === connector.id)!;
    if (shortcutIds.has(connector.id)) {
      const points = connector.route.points;
      if (points.length !== 3 || before.route.points.length <= 3 || connector.source.nodeId === connector.target.nodeId
        || dot(normals[connector.source.side], normals[connector.target.side]) !== 0
        || points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) problems.push(`shortcut_topology:${connector.id}`);
    } else if (before.route.points.length <= 3 && connector.route.points.length > before.route.points.length) problems.push(`protected_route:${connector.id}`);
  }
  const shortcuts = f.filter(connector => shortcutIds.has(connector.id));
  for (let index = 0; index < shortcuts.length; index++) for (const other of shortcuts.slice(index + 1)) {
    const connector = shortcuts[index]!;
    if (connector.source.nodeId !== other.source.nodeId || connector.source.side !== other.source.side
      || connector.target.side !== other.target.side) continue;
    const normal = normals[connector.source.side], targetNormal = normals[connector.target.side];
    const tangent = { x: -targetNormal.x, y: -targetNormal.y };
    const a = { source: dot(connector.source.point, tangent), target: dot(connector.target.point, tangent), depth: dot(connector.target.point, normal) };
    const b = { source: dot(other.source.point, tangent), target: dot(other.target.point, tangent), depth: dot(other.target.point, normal) };
    const epsilon = proposed.policy?.epsilon ?? DEFAULT_ROUTING_POLICY.epsilon;
    const overlap = Math.min(a.target, b.target) - Math.max(a.source, b.source);
    if (overlap > epsilon && Math.abs(a.depth - b.depth) > epsilon
      && (a.depth > b.depth ? a.source >= b.source - epsilon : b.source >= a.source - epsilon))
      problems.push(`source_target_order:${connector.id}:${other.id}`);
  }
  if ([...shortcutIds].some(id => !ordinary.has(id))) problems.push("unknown_shortcut");
  const before = routeCost(b), after = routeCost(f);
  if (after[0] > before[0]) problems.push("additional_crossings");
  if (after[1] >= before[1]) problems.push("no_scene_bend_improvement");
  if (validateFinalRouteSet(baseline).length) problems.push("invalid_baseline");
  if (validateFinalRouteSet(proposed).length) problems.push("invalid_proposal");
  return problems;
}
