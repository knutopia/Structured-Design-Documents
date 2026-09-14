import { routeIntersectsRect } from "./stagedVisualHarness.js";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { runRoutingLifecycle, validateFinalRouteSet, type FinalRoutingContext, type FinalRoutingConnector } from "../src/renderer/staged/routingCore/lifecycle.js";
import { collapseRoutePoints, buildCrossingKey } from "../src/renderer/staged/routingCore/geometry.js";
import { resolveRouteSegmentOccupancy } from "../src/renderer/staged/routingCore/occupancy.js";
import { buildLogicalRunIds } from "../src/renderer/staged/routingCore/occupancy.js";
import { independentParallelConflicts, terminalFixture } from "./routingHardeningOracle.js";

function accepted(context: FinalRoutingContext) {
  const result = runRoutingLifecycle(context);
  expect(result.status, JSON.stringify(result.status === "failed" ? { trace: result.trace, violations: result.violations } : result.trace)).toBe("resolved");
  if (result.status !== "resolved") throw Error(result.reason);
  const connectors = context.connectors.map(c => ({ ...c, route: result.routeByConnectorId.get(c.id)! }));
  expect(independentParallelConflicts(connectors)).toBe(0);
  expect(validateFinalRouteSet({ ...context, connectors })).toEqual([]);
  for (const c of connectors) {
    for (const box of [...context.boxes, ...(context.blockers ?? [])]) expect(routeIntersectsRect(c.route, box), `${c.id} intersects ${box.id}`).toBe(false);
    expect(c.route.points[0]).toEqual(c.source.point);
    expect(c.route.points.at(-1)).toEqual(c.target.point);
  }
  const second = runRoutingLifecycle({ ...context, connectors });
  expect(second.status).toBe("resolved");
  if (second.status === "resolved") expect([...second.routeByConnectorId]).toEqual([...result.routeByConnectorId]);
  expect(second.trace.repairRevisions).toBe(0);
  return result;
}
const captured = (): FinalRoutingContext => JSON.parse(readFileSync(new URL("./fixtures/render/routing_hardening_captured_outcome.json", import.meta.url), "utf8"));

describe("shared terminal-aware route-set lifecycle", () => {
  it.each(["original", "transpose", "reverse", "translate"])("repairs a terminal conflict under %s geometry", transform => {
    const context = terminalFixture();
    if (transform === "reverse") for (const c of context.connectors) {
      c.route.points.reverse(); [c.source, c.target] = [c.target, c.source];
    }
    if (transform === "transpose") for (const c of context.connectors) {
      const transpose = (p: { x: number; y: number }) => ({ x: p.y, y: p.x });
      c.route.points = c.route.points.map(transpose);
      for (const end of [c.source, c.target]) { end.point = transpose(end.point); end.side = end.side === "east" ? "south" : "north"; }
    }
    if (transform === "translate") {
      for (const c of context.connectors) {
        c.route.points = c.route.points.map(p => ({ x: p.x + 71, y: p.y - 31 }));
        for (const end of [c.source, c.target]) end.point = { x: end.point.x + 71, y: end.point.y - 31 };
      }
      context.bounds = { minX: 71, maxX: 271, minY: -31, maxY: 169 };
    }
    const result = accepted(context);
    expect(result.trace.repairRevisions).toBeGreaterThan(0);
  });
  it("repairs captured exact Outcome geometry without layout expansion", () => {
    const context = captured(), before = JSON.stringify({ boxes: context.boxes, endpoints: context.connectors.map(c => [c.source, c.target]), bounds: context.bounds });
    const result = accepted(context);
    expect(result.trace.expansionPasses).toBe(0);
    expect(JSON.stringify({ boxes: context.boxes, endpoints: context.connectors.map(c => [c.source, c.target]), bounds: context.bounds })).toBe(before);
  });
  it("uses geometry with neutral IDs and deterministically reordered input", () => {
    const context = captured();
    const names = new Map(context.boxes.map((b, i) => [b.id, `box-${i}`]));
    context.boxes = context.boxes.map(b => ({ ...b, id: names.get(b.id)! }));
    context.connectors = context.connectors.map((c, i) => ({ ...c, id: `connector-${i}`, source: { ...c.source, nodeId: names.get(c.source.nodeId)! }, target: { ...c.target, nodeId: names.get(c.target.nodeId)! } }));
    const first = accepted(context), second = accepted({ ...context, connectors: [...context.connectors].reverse() });
    const routes = (result: typeof first) => [...result.routeByConnectorId].sort(([a], [b]) => a.localeCompare(b));
    expect(routes(first)).toEqual(routes(second));
  });
  it("reports bounded rejection when all implicated turns are fixed", () => {
    const context = terminalFixture();
    for (const c of context.connectors) c.runConstraints = new Map([[buildLogicalRunIds(c.route)[1]!, { lockedCoordinate: c.route.points[1]!.x, lockReason: "resource" }]]);
    const result = runRoutingLifecycle(context);
    expect(result.status).toBe("failed");
    expect(result.trace.repairRevisions).toBe(1);
    expect("routeByConnectorId" in result).toBe(false);
  });
  it("changes candidates after the supplied fixed-span assignment is contradictory", () => {
    const context = terminalFixture();
    expect(resolveRouteSegmentOccupancy(context.connectors.map(c => ({ connectorId: c.id, priority: c.priority, route: c.route })), { buildSegmentKey: (id, i) => `${id}:${i}` }).status).not.toBe("resolved");
    accepted(context);
  });
  it("rebuilds interactions with a formerly separate surrounding run", () => {
    const context = terminalFixture();
    const c: FinalRoutingConnector = { id: "surrounding", priority: 3,
      source: { nodeId: "c-s", point: { x: 60, y: 0 }, side: "east", minLeg: 12 },
      target: { nodeId: "c-t", point: { x: 110, y: 60 }, side: "west", minLeg: 12 },
      route: { style: "orthogonal", points: [{ x: 60, y: 0 }, { x: 88, y: 0 }, { x: 88, y: 60 }, { x: 110, y: 60 }] } };
    context.connectors = [...context.connectors, c];
    const proposed = structuredClone(context);
    proposed.connectors[0]!.route.points[1]!.x = proposed.connectors[0]!.route.points[2]!.x = 80;
    expect(validateFinalRouteSet(proposed).some(v => v.connectorIds.includes(c.id))).toBe(true);
    const result = accepted(context);
    expect(result.routeByConnectorId.get(c.id)).toEqual(c.route);
  });
  it("does not accept a zero-width detour removed by normalization", () => {
    const context = terminalFixture(), b = context.connectors[1]!;
    b.route.points = collapseRoutePoints([b.route.points[0]!, b.route.points[1]!, { x: 104, y: 27 }, { x: 104, y: 27 }, b.route.points[2]!, b.route.points[3]!]);
    expect(b.route.points).toEqual(terminalFixture().connectors[1]!.route.points);
    expect(runRoutingLifecycle(context, { maxCandidates: 1 }).status).toBe("failed");
    accepted(context);
  });
  it("repairs an internal run around multiple node blockers", () => {
    const c: FinalRoutingConnector = { id: "a", priority: 0,
      source: { point: { x: 0, y: 0 }, nodeId: "s", side: "south", minLeg: 12 },
      target: { point: { x: 100, y: 100 }, nodeId: "t", side: "north", minLeg: 12 },
      route: { style: "orthogonal", points: [{ x: 0, y: 0 }, { x: 0, y: 50 }, { x: 100, y: 50 }, { x: 100, y: 100 }] } };
    accepted({ connectors: [c], boxes: [30, 70].map(x => ({ id: `box-${x}`, x, y: 40, width: 20, height: 20 })), bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 } });
  });
  it("uses penalized crossings to choose between equal-displacement legal turns", () => {
    const context = terminalFixture();
    const a = context.connectors[0]!, b = context.connectors[1]!;
    a.priority = 1; a.source.point.y = 0; a.route.points = [{ x: 0, y: 0 }, { x: 80, y: 0 }, { x: 80, y: 100 }, { x: 200, y: 100 }];
    b.priority = 0; b.source.point = { x: 40, y: 30 }; b.target.point = { x: 120, y: 70 }; b.route.points = [{ x: 40, y: 30 }, { x: 80, y: 30 }, { x: 80, y: 70 }, { x: 120, y: 70 }];
    const c: FinalRoutingConnector = { id: "c", priority: 2,
      source: { point: { x: 20, y: 50 }, nodeId: "c-s", side: "east", minLeg: 0 },
      target: { point: { x: 70, y: 50 }, nodeId: "c-t", side: "west", minLeg: 12 },
      route: { style: "orthogonal", points: [{ x: 20, y: 50 }, { x: 70, y: 50 }] } };
    context.connectors = [a, b, c]; context.policy = { crossingTreatment: "penalize" };
    const result = accepted(context);
    expect(result.routeByConnectorId.get("a")!.points[1]!.x).toBe(96);
  });
  it("expands through its owner for failures discovered only by final bounds validation", () => {
    const context = terminalFixture(); context.connectors = [context.connectors[0]!]; context.bounds.maxX = 150;
    const withoutOwner = runRoutingLifecycle(context);
    expect(withoutOwner.status).toBe("failed");
    const calls: number[] = [];
    const result = runRoutingLifecycle(context, { expand: (current, violations, pass) => {
      calls.push(pass); expect(violations.some(v => v.kind === "empty_coordinate_range")).toBe(true);
      return { ...current, bounds: { ...current.bounds, maxX: 200 } };
    } });
    expect(result.status).toBe("resolved"); expect(calls).toEqual([1]);
    const repeated = runRoutingLifecycle(context, { expand: current => current });
    expect(repeated.status).toBe("failed"); expect(repeated.trace.repeatedStates).toBeGreaterThan(0);
  });
  it("keeps global candidate/revision and expansion budgets finite", () => {
    const context = terminalFixture();
    const capped = runRoutingLifecycle(context, { maxCandidates: 1, maxRepairRevisions: 0 });
    expect(capped.status).toBe("failed"); expect(capped.trace.candidates).toBeLessThanOrEqual(1);
    for (const c of context.connectors) c.runConstraints = new Map([[buildLogicalRunIds(c.route)[1]!, { lockedCoordinate: c.route.points[1]!.x }]]);
    context.policy = { maxExpansionPasses: 2 };
    const exhausted = runRoutingLifecycle(context, { expand: (current, _violations, pass) => ({ ...current, bounds: { ...current.bounds, maxX: 200 + pass * 16 } }) });
    expect(exhausted.status).toBe("failed"); expect(exhausted.trace.expansionPasses).toBe(2);
  });

  it("retains absolute resource ownership across expansion", () => {
    for (const constraint of [{ lockedCoordinate: 120, lockReason: "resource" as const }, { allowedRange: { min: 110, max: 130 } }]) {
      const context = terminalFixture(); context.connectors = [context.connectors[0]!]; context.bounds.maxX = 150;
      const connector = context.connectors[0]!;
      connector.route.points[1]!.x = connector.route.points[2]!.x = 120;
      connector.runConstraints = new Map([[buildLogicalRunIds(connector.route)[1]!, constraint]]);
      const result = runRoutingLifecycle(context, { expand: current => ({ ...current,
        bounds: { ...current.bounds, maxX: 200 },
        connectors: current.connectors.map(c => ({ ...c, runConstraints: undefined,
          route: { ...c.route, points: c.route.points.map((p, i) => i === 1 || i === 2 ? { ...p, x: 80 } : p) } })) }) });
      expect(result.status).toBe("failed");
      if (result.status === "failed") expect(result.reason).toBe("invalid_context");
      const retained = runRoutingLifecycle(context, { expand: current => ({ ...current, bounds: { ...current.bounds, maxX: 200 } }) });
      expect(retained.status).toBe("resolved");
      if (retained.status === "resolved") expect(validateFinalRouteSet(retained.context)).toEqual([]);
    }
  });
  it("cannot erase authoritative locks by rebuilding expansion input in place", () => {
    const context = terminalFixture(); context.connectors = [context.connectors[0]!]; context.bounds.maxX = 150;
    const id = buildLogicalRunIds(context.connectors[0]!.route)[1]!;
    context.connectors[0]!.runConstraints = new Map([[id, { lockedCoordinate: 120, lockReason: "resource" }]]);
    const result = runRoutingLifecycle(context, { expand: current => {
      current.bounds.maxX = 200;
      current.connectors[0]!.runConstraints = undefined;
      current.connectors[0]!.route.points[1]!.x = current.connectors[0]!.route.points[2]!.x = 80;
      return current;
    } });
    expect(result.status).toBe("failed");
    expect(context.bounds.maxX).toBe(150);
    expect(context.connectors[0]!.runConstraints?.get(id)?.lockedCoordinate).toBe(120);
    expect(context.connectors[0]!.route.points[1]!.x).toBe(120);
  });
  it("accepts a declared continuity mark only on its geometry revision", () => {
    const context = terminalFixture();
    const make = (id: string, points: { x: number; y: number }[], sourceSide: "east" | "south", targetSide: "west" | "north"): FinalRoutingConnector => ({
      id, priority: 0, route: { style: "orthogonal", points },
      source: { point: points[0]!, side: sourceSide, nodeId: id + "-s", minLeg: 0 },
      target: { point: points.at(-1)!, side: targetSide, nodeId: id + "-t", minLeg: 12 }
    });
    const a = make("a", [{ x: 0, y: 50 }, { x: 100, y: 50 }], "east", "west");
    const b = make("b", [{ x: 50, y: 0 }, { x: 50, y: 100 }], "south", "north");
    context.connectors = [a, b]; context.policy = { crossingTreatment: "require_mark" };
    expect(runRoutingLifecycle(context).status).toBe("failed");
    a.markedCrossings = new Set([buildCrossingKey("a", 0, "b", 0)]);
    expect(runRoutingLifecycle(context).status).toBe("resolved");
    a.markedCrossings = undefined;
    expect(runRoutingLifecycle(context).status).toBe("failed");
  });

});
