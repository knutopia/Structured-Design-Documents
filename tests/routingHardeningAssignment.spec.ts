import { describe, expect, it } from "vitest";
import {
  aggregateRoutingObservations, buildRoutingSegments, buildRoutingRunDependencies, solveRoutingClaims,
  resolveRouteSegmentOccupancy, resolvePhysicalSegmentOccupancy,
  type RoutingObservation, type RoutingSegment
} from "../src/renderer/staged/routingCore/index.js";

const run = (id: string, y: number, movable = false): RoutingSegment =>
  buildRoutingSegments(id, [{ x: 0, y }, { x: 100, y }], {
    movableBySegmentIndex: new Map([[0, movable]])
  })[0]!;
const locked = (s: RoutingSegment): RoutingObservation => ({ segmentId: s.id, lockedCoordinate: s.coordinate });

describe("routing hardening: supplied assignment contract", () => {
  it.each([1.5, 14.5, 15.499])("rejects fixed overlapping spans %spx apart", separation => {
    const segments = [run("a", 0), run("b", separation)];
    const aggregated = aggregateRoutingObservations(segments, segments.map(locked));
    const result = solveRoutingClaims(aggregated.claims);
    expect(result.status).not.toBe("resolved");
    expect(result.assignments.size).toBe(0);
  });
  it.each([15.5, 16, 50])("accepts safely separated fixed spans at %spx", separation => {
    const segments = [run("a", 0), run("b", separation)];
    expect(solveRoutingClaims(aggregateRoutingObservations(segments, segments.map(locked)).claims).status).toBe("resolved");
  });
  it("retains all-fixed terminal sections at the occupancy boundary", () => {
    const result = resolveRouteSegmentOccupancy([0, 1.5].map((y, i) => ({
      connectorId: String(i), priority: i, route: { style: "orthogonal" as const, points: [{ x: 0, y }, { x: 100, y }] }
    })), { buildSegmentKey: (id, index) => `${id}:${index}` });
    expect(result.status).not.toBe("resolved");
    expect(result.coordinateBySegmentKey.size).toBe(0);
  });
  it("moves a close disjoint-domain movable run while retaining the fixed run", () => {
    const a = run("a", 0), b = run("b", 8, true);
    const claims = aggregateRoutingObservations([a, b], [locked(a), { segmentId: b.id, allowedRange: { min: 8, max: 32 } }]).claims;
    const result = solveRoutingClaims(claims);
    expect(result.status).toBe("resolved");
    expect(result.assignments.get(a.id)?.coordinate).toBe(0);
    expect(result.assignments.get(b.id)!.coordinate).toBeGreaterThanOrEqual(15.5);
    expect([...solveRoutingClaims([...claims].reverse()).assignments]).toEqual([...result.assignments]);
  });
  it("does not emit nominal fallback assignments from a failed component", () => {
    const segments = [run("safe", -100), run("a", 0), run("b", 1.5)];
    const result = solveRoutingClaims(aggregateRoutingObservations(segments, segments.map(locked)).claims);
    expect(result.status).not.toBe("resolved");
    expect(result.assignments.size).toBe(0);
  });
  it("enforces resources on locked as well as movable coordinates", () => {
    const a = run("a", 100);
    const claims = aggregateRoutingObservations([a], [{ ...locked(a), resourceId: "corridor" }]).claims;
    const result = solveRoutingClaims(claims, { resources: [{ id: "corridor", axis: "horizontal", minCoordinate: 0, maxCoordinate: 50 }] });
    expect(result.status).not.toBe("resolved");
  });
  it("preserves explicit sharing and aggregates multiple bounded observations", () => {
    const segments = [run("a", 0), run("b", 0)];
    const observations = segments.flatMap(s => [
      { ...locked(s), sharedTrackGroupId: "trunk" },
      { segmentId: s.id, allowedRange: { min: -2, max: 2 }, resourceId: "one" },
      { segmentId: s.id, allowedRange: { min: -1, max: 1 }, resourceId: "two" }
    ]);
    const result = solveRoutingClaims(aggregateRoutingObservations(segments, observations).claims);
    expect(result.status).toBe("resolved");
    expect(result.assignments.size).toBe(2);
  });
  it("does not drop incompatible locks across physical observations", () => {
    const entries = [0, 2].map(lockedCoordinate => ({
      connectorId: "a", segmentKey: "a:0", logicalRunId: "one", axis: "horizontal" as const,
      nominalCoordinate: 0, spanStart: 0, spanEnd: 100, movable: false, priority: 0, lockedCoordinate
    }));
    const result = resolvePhysicalSegmentOccupancy(entries);
    expect(result.status).not.toBe("resolved");
    expect(result.violations.some(v => v.kind === "conflicting_locks")).toBe(true);
  });
  it("retains terminal span dependencies separately from fixed transverse coordinates", () => {
    const dependencies = buildRoutingRunDependencies({ style: "orthogonal", points: [
      { x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 50 }, { x: 100, y: 50 }
    ] });
    expect(dependencies[0]!.end).toEqual({ kind: "run", logicalRunId: dependencies[1]!.logicalRunId });
    expect(dependencies[2]!.start).toEqual({ kind: "run", logicalRunId: dependencies[1]!.logicalRunId });
    expect(dependencies[0]!.start).toEqual({ kind: "endpoint", role: "source", coordinate: 0 });
  });
  it("reports bounded exhaustion without partial or nominal fallback assignments", () => {
    const segments = [run("a", 0), run("b", 1.5)];
    const result = solveRoutingClaims(aggregateRoutingObservations(segments, segments.map(locked)).claims, { maxSearchStates: 0 });
    expect(result.status).not.toBe("resolved");
    expect(result.assignments.size).toBe(0);
    expect(result.violations[0]?.message).toContain("0-state bound");
  });

});
