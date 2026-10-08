import { describe, expect, it } from "vitest";
import type { Point, PortSide } from "../src/renderer/staged/contracts.js";
import {
  buildLogicalRunIds,
  buildPortCorridorCandidates,
  runRoutingLifecycle,
  validateFinalRouteSet,
  type FinalRoutingConnector,
  type FinalRoutingContext,
  type RoutingBox
} from "../src/renderer/staged/routingCore/index.js";
import { independentParallelConflicts } from "./routingHardeningOracle.js";

function connector(id: string, points: Array<[number, number]>, priority: number): FinalRoutingConnector {
  const route = { style: "orthogonal" as const, points: points.map(([x, y]) => ({ x, y })) };
  return {
    id, priority, route,
    source: { point: { ...route.points[0]! }, side: "east", nodeId: `${id}-source`, minLeg: 0 },
    target: { point: { ...route.points.at(-1)! }, side: "west", nodeId: `${id}-target`, minLeg: 12 }
  };
}

function overlapContext(clearance = false): FinalRoutingContext {
  const boxes: RoutingBox[] = clearance ? [
    { id: "a-source", x: -40, y: -20, width: 40, height: 40, clearance: 16 },
    { id: "a-target", x: 100, y: 80, width: 40, height: 40, clearance: 16 },
    { id: "b-source", x: -40, y: 80, width: 40, height: 40, clearance: 16 },
    { id: "b-target", x: 100, y: -20, width: 40, height: 40, clearance: 16 }
  ] : [];
  return {
    connectors: [
      connector("a", [[0, 0], [50, 0], [50, 100], [100, 100]], 0),
      connector("b", [[0, 100], [50, 100], [50, 0], [100, 0]], 1)
    ],
    boxes,
    bounds: { minX: -64, minY: -44, maxX: 164, maxY: 144 },
    policy: { minSeparation: 16, epsilon: 0.5, crossingTreatment: "penalize", maxExpansionPasses: 0 }
  };
}

function accepted(context: FinalRoutingContext) {
  const before = structuredClone(context);
  const result = runRoutingLifecycle(context);
  expect(result.status, JSON.stringify({ trace: result.trace, violations: result.violations })).toBe("resolved");
  if (result.status !== "resolved") throw Error(result.reason);
  expect(validateFinalRouteSet(result.context)).toEqual([]);
  expect(independentParallelConflicts(result.context.connectors)).toBe(0);
  expect(result.context.boxes).toEqual(before.boxes);
  expect(result.context.blockers).toEqual(before.blockers);
  expect(result.context.bounds).toEqual(before.bounds);
  expect(result.context.policy).toEqual(before.policy);
  expect(result.trace.expansionPasses).toBe(0);
  for (const original of before.connectors) {
    const repaired = result.context.connectors.find(c => c.id === original.id)!;
    expect(repaired.source).toEqual(original.source);
    expect(repaired.target).toEqual(original.target);
    expect(repaired.priority).toBe(original.priority);
    expect(repaired.runConstraints).toEqual(original.runConstraints);
    expect(repaired.sharedTrackGroupBySegmentIndex).toEqual(original.sharedTrackGroupBySegmentIndex);
    expect(repaired.route.points[0]).toEqual(original.source.point);
    expect(repaired.route.points.at(-1)).toEqual(original.target.point);
    expect(result.routeByConnectorId.get(original.id)).toEqual(repaired.route);
  }
  expect(context).toEqual(before);
  expect(result.trace.candidates).toBeLessThanOrEqual(4096);
  expect(result.trace.repairRevisions).toBeLessThanOrEqual(128);
  return result;
}

function translate(c: FinalRoutingConnector, x: number, y: number): FinalRoutingConnector {
  const move = (p: Point): Point => ({ x: p.x + x, y: p.y + y });
  return { ...c, route: { ...c.route, points: c.route.points.map(move) },
    source: { ...c.source, point: move(c.source.point) }, target: { ...c.target, point: move(c.target.point) } };
}

describe("shared corridor reconstruction for overlap recovery", () => {
  it.each([false, true])("repairs reversed terminal rows with endpoint clearance %s", clearance => {
    const context = overlapContext(clearance);
    expect(validateFinalRouteSet(context).map(v => v.kind)).toEqual(["collinear_overlap"]);
    expect(independentParallelConflicts(context.connectors)).toBeGreaterThan(0);
    const result = accepted(context);
    // Moving the existing single bridge cannot reverse these rows without overlap.
    expect(result.context.connectors.some(c => c.route.points.length > 4)).toBe(true);
  });

  it("repairs parallel tracks below the required separation", () => {
    const context = overlapContext();
    context.connectors = [context.connectors[0]!, connector("b", [[0, 108], [58, 108], [58, 8], [100, 8]], 1)];
    const kinds = validateFinalRouteSet(context).map(v => v.kind);
    expect(kinds).toContain("track_separation");
    expect(kinds).not.toContain("collinear_overlap");
    accepted(context);
  });

  it("composes repairs for two independent overlapping pairs", () => {
    const context = overlapContext();
    const second = context.connectors.map(c => {
      const moved = translate(c, 0, 200);
      return { ...moved, id: `${c.id}-second`, priority: c.priority + 2,
        source: { ...moved.source, nodeId: `${c.id}-second-source` },
        target: { ...moved.target, nodeId: `${c.id}-second-target` } };
    });
    context.connectors = [...context.connectors, ...second];
    context.bounds = { ...context.bounds, maxY: 344 };
    expect(validateFinalRouteSet(context).filter(v => v.kind === "collinear_overlap")).toHaveLength(2);
    accepted(context);
  });

  it.each(["transpose", "reverse", "translate"])("repairs the same geometry after %s", transform => {
    const context = overlapContext(true);
    if (transform === "transpose") {
      const point = (p: Point): Point => ({ x: p.y, y: p.x });
      const sides: Record<PortSide, PortSide> = { east: "south", west: "north", north: "west", south: "east" };
      context.connectors = context.connectors.map(c => ({ ...c, route: { ...c.route, points: c.route.points.map(point) },
        source: { ...c.source, point: point(c.source.point), side: sides[c.source.side] },
        target: { ...c.target, point: point(c.target.point), side: sides[c.target.side] } }));
      context.boxes = context.boxes.map(b => ({ ...b, x: b.y, y: b.x, width: b.height, height: b.width }));
      const b = context.bounds;
      context.bounds = { minX: b.minY, minY: b.minX, maxX: b.maxY, maxY: b.maxX };
    } else if (transform === "reverse") {
      context.connectors = context.connectors.map(c => ({ ...c,
        route: { ...c.route, points: [...c.route.points].reverse() }, source: { ...c.target }, target: { ...c.source } }));
    } else {
      context.connectors = context.connectors.map(c => translate(c, 71, -31));
      context.boxes = context.boxes.map(b => ({ ...b, x: b.x + 71, y: b.y - 31 }));
      const b = context.bounds;
      context.bounds = { minX: b.minX + 71, minY: b.minY - 31, maxX: b.maxX + 71, maxY: b.maxY - 31 };
    }
    accepted(context);
  });

  it("is deterministic across repeated runs and connector input order", () => {
    const context = overlapContext();
    const routes = (result: ReturnType<typeof accepted>) => [...result.routeByConnectorId].sort(([a], [b]) => a.localeCompare(b));
    const first = routes(accepted(context));
    expect(routes(accepted(context))).toEqual(first);
    expect(routes(accepted({ ...context, connectors: [...context.connectors].reverse() }))).toEqual(first);
  });

  it("preserves an unrelated connector while repairing the complete scene", () => {
    const context = overlapContext();
    const unrelated = connector("unrelated", [[0, 220], [100, 220]], 2);
    context.connectors = [...context.connectors, unrelated];
    context.bounds = { ...context.bounds, maxY: 264 };
    const result = accepted(context);
    expect(result.routeByConnectorId.get(unrelated.id)).toEqual(unrelated.route);
  });

  it("invalidates crossing marks throughout a repaired revision without mutating the input", () => {
    const context = overlapContext();
    const unrelated = connector("unrelated", [[0, 220], [100, 220]], 2);
    context.connectors = [...context.connectors, unrelated].map(c => ({ ...c,
      markedCrossings: new Set([`previous-geometry-${c.id}`]) }));
    context.bounds = { ...context.bounds, maxY: 264 };
    const result = accepted(context);
    for (const c of result.context.connectors) expect(c.markedCrossings).toBeUndefined();
    expect(result.routeByConnectorId.get(unrelated.id)).toEqual(unrelated.route);
    for (const c of context.connectors) expect(c.markedCrossings).toEqual(new Set([`previous-geometry-${c.id}`]));
  });

  it("keeps scoped blockers authoritative during reconstructed-route acceptance", () => {
    const context = overlapContext();
    context.blockers = [{ id: "reserved-strip", x: 12, y: 12, width: 76, height: 8,
      blocksAxis: "horizontal", appliesToConnectorIds: ["a"] }];
    expect(validateFinalRouteSet(context).map(v => v.kind)).toEqual(["collinear_overlap"]);
    accepted(context);
  });

  it.each([{ maxCandidates: 1 }, { maxRepairRevisions: 0 }])("rejects within the existing budget %j", options => {
    const context = overlapContext(), before = structuredClone(context);
    const result = runRoutingLifecycle(context, options);
    expect(result.status).toBe("failed");
    expect("routeByConnectorId" in result).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.trace.candidates).toBeLessThanOrEqual(options.maxCandidates ?? 4096);
    expect(result.trace.repairRevisions).toBeLessThanOrEqual(options.maxRepairRevisions ?? 128);
    expect(result.trace.expansionPasses).toBe(0);
    expect(context).toEqual(before);
  });

  it("returns accepted geometry through the unchanged valid-input fast path", () => {
    const first = accepted(overlapContext());
    const second = runRoutingLifecycle(first.context);
    expect(second.status).toBe("resolved");
    if (second.status !== "resolved") throw Error(second.reason);
    expect([...second.routeByConnectorId]).toEqual([...first.routeByConnectorId]);
    expect(second.trace.candidates).toBe(0);
    expect(second.trace.repairRevisions).toBe(0);
    expect(second.trace.expansionPasses).toBe(0);
  });

  it.each(["run-lock", "shared-track"])("preserves topology-bound %s ownership", ownership => {
    const context = overlapContext();
    context.connectors = context.connectors.map(c => ownership === "run-lock" ? { ...c,
      runConstraints: new Map([[buildLogicalRunIds(c.route)[1]!, { lockedCoordinate: 50, lockReason: "resource" as const }]])
    } : { ...c, sharedTrackGroupBySegmentIndex: new Map([[0, `owned-${c.id}`]]) });
    for (const c of context.connectors) expect([...buildPortCorridorCandidates(c, context)]).toEqual([]);
    const before = structuredClone(context), first = runRoutingLifecycle(context), second = runRoutingLifecycle(context);
    expect(first.status).toBe("failed");
    expect(first).toEqual(second);
    expect("routeByConnectorId" in first).toBe(false);
    expect(first.trace.candidates).toBeLessThanOrEqual(4096);
    expect(first.trace.repairRevisions).toBeLessThanOrEqual(128);
    expect(context).toEqual(before);
  });
});
