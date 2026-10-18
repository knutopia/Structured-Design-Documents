import { describe, expect, it } from "vitest";
import {
  buildPortCorridorCandidates,
  buildPortCorridorSeed,
  buildTerminalTurnAlternatives,
  auditMovableSourceAdmission,
  canonicalRoutingQualityContext,
  generateRoutingQualityCandidates,
  proposeMovableSourceRoutes,
  resolveAndReconstructRouteOccupancy,
  runRoutingLifecycle,
  swapSouthboundSourceAttachments,
  validateFinalRouteSet,
  type FinalRoutingConnector,
  type FinalRoutingContext
} from "../src/renderer/staged/routingCore/index.js";

function context(): FinalRoutingContext {
  const fixed: FinalRoutingConnector = {
    id: "fixed", priority: 10, fixed: true,
    source: { nodeId: "a", side: "east", point: { x: 0, y: 0 }, minLeg: 10 },
    target: { nodeId: "b", side: "west", point: { x: 100, y: 0 }, minLeg: 10 },
    route: { style: "orthogonal", points: [
      { x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 40 },
      { x: 80, y: 40 }, { x: 80, y: 0 }, { x: 100, y: 0 }
    ] }
  };
  const movable: FinalRoutingConnector = {
    id: "movable", priority: 0,
    source: { nodeId: "c", side: "east", point: { x: 0, y: 100 }, minLeg: 10 },
    target: { nodeId: "d", side: "west", point: { x: 100, y: 100 }, minLeg: 10 },
    route: { style: "orthogonal", points: [
      { x: 0, y: 100 }, { x: 30, y: 100 }, { x: 30, y: 40 },
      { x: 70, y: 40 }, { x: 70, y: 100 }, { x: 100, y: 100 }
    ] }
  };
  return { bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 }, boxes: [],
    policy: { minSeparation: 10, crossingTreatment: "forbid" }, connectors: [fixed, movable] };
}

describe("shared fixed route constraints", () => {
  it("moves a conflicting higher-priority route around the complete fixed route", () => {
    const initial = context();
    const original = structuredClone(initial);
    expect(validateFinalRouteSet(initial).some(v => v.kind === "collinear_overlap")).toBe(true);
    const result = runRoutingLifecycle(initial, { maxCandidates: 128 });
    expect(result.status).toBe("resolved");
    if (result.status !== "resolved") return;
    expect(validateFinalRouteSet(result.context)).toEqual([]);
    expect(result.context.connectors[0]).toMatchObject(original.connectors[0]!);
    expect(result.routeByConnectorId.get("movable")).not.toEqual(original.connectors[1]!.route);
    expect(initial).toEqual(original);
  });

  it("reports an infeasible fixed conflict without displacing either route", () => {
    const initial = context();
    initial.connectors[1]!.fixed = true;
    const original = structuredClone(initial);
    const result = runRoutingLifecycle(initial, { maxCandidates: 128 });
    expect(result.status).toBe("failed");
    if (result.status !== "failed") return;
    expect(result.violations.some(v => v.kind === "collinear_overlap")).toBe(true);
    expect(result.debugConnectors).toEqual(original.connectors);
    expect(initial).toEqual(original);
  });

  it("retains exact fixed point lists in occupancy reconstruction", () => {
    const fixed = context().connectors[0]!;
    fixed.route.points.splice(3, 0, { x: 50, y: 40 });
    const original = structuredClone(fixed.route);
    const result = resolveAndReconstructRouteOccupancy([
      { connectorId: fixed.id, route: fixed.route, priority: fixed.priority, fixed: true }
    ], { buildSegmentKey: (id, index) => `${id}|${index}`, fixEndpointSegments: false, includeEndpointSegments: false });
    expect(result.status).toBe("resolved");
    expect(result.routeByConnectorId.get(fixed.id)).toEqual(original);
    expect([...result.displacementBySegmentKey]).toEqual([]);
    expect(result.coordinateBySegmentKey.size).toBe(fixed.route.points.length - 1);
  });

  it("includes fixed status in candidate identity and keeps it through quality proposals", () => {
    const initial = context();
    const unfixed = { ...initial, connectors: initial.connectors.map(c => ({ ...c, fixed: false })) };
    expect(canonicalRoutingQualityContext(initial)).not.toBe(canonicalRoutingQualityContext(unfixed));
    const proposals = generateRoutingQualityCandidates(initial, { maxCandidates: 64, maxAlternativesPerConnector: 32 });
    expect(proposals.candidates.length).toBeGreaterThan(0);
    for (const candidate of proposals.candidates) {
      expect(candidate.context.connectors[0]).toEqual(initial.connectors[0]);
      expect(validateFinalRouteSet(candidate.context)).toEqual([]);
    }
  });

  it("offers no terminal or corridor replacement for a fixed connector", () => {
    const initial = context();
    const fixed = initial.connectors[0]!;
    expect([...buildPortCorridorCandidates(fixed, initial)]).toEqual([]);
    expect(buildPortCorridorSeed({ ...fixed, target: { ...fixed.target, side: "east" } }, 20)).toBeUndefined();
    for (const connectors of buildTerminalTurnAlternatives(initial, validateFinalRouteSet(initial))) {
      expect(connectors[0]!.route).toEqual(fixed.route);
      expect(connectors[0]!.fixed).toBe(true);
    }
  });

  it("rejects fixed source attachment changes without consuming proposal budget", () => {
    const initial = context();
    const fixed = initial.connectors[0]!;
    const budget = { candidates: 20, repairs: 10 };
    const proposal = proposeMovableSourceRoutes({ context: initial, connectorId: fixed.id,
      sourceBox: { id: "a", x: 0, y: 0, width: 100, height: 10 }, sourceSide: "south", targetSide: "west",
      sourceInset: 10, portPitch: 10, occupiedSourcePorts: [], budget });
    expect(proposal.proposals).toEqual([]);
    expect(proposal.rejections).toContain("ineligible_connector");
    expect(budget).toEqual({ candidates: 20, repairs: 10 });
    const source = { ...fixed.source, nodeId: "shared", side: "south" as const };
    expect(swapSouthboundSourceAttachments(initial.connectors.map(c => ({ ...c, source })), {
      leftConnectorId: "fixed", rightConnectorId: "movable", leftPoint: { x: 30, y: 0 }, rightPoint: { x: 20, y: 0 }
    })).toBeUndefined();
    const damaged = { ...initial, connectors: initial.connectors.map(c => c.id === fixed.id
      ? { ...c, source: { ...c.source, point: { x: 1, y: 0 } } } : c) };
    expect(auditMovableSourceAdmission(initial, damaged, new Set())).toContain("fixed_route_changed:fixed");
  });

  it("continues to reject endpoint, obstacle, owner and crossing violations on fixed routes", () => {
    const initial = context();
    const fixed = initial.connectors[0]!;
    const alone = { ...initial, connectors: [fixed] };
    expect(validateFinalRouteSet(alone)).toEqual([]);
    expect(validateFinalRouteSet({ ...alone, connectors: [{ ...fixed, source: { ...fixed.source, side: "west" } }] })
      .some(v => v.kind === "endpoint_intrusion")).toBe(true);
    expect(validateFinalRouteSet({ ...alone, blockers: [{ id: "blocker", x: 45, y: 35, width: 10, height: 10 }] })
      .some(v => v.kind === "node_intersection")).toBe(true);
    expect(validateFinalRouteSet({ ...alone, connectors: [{ ...fixed,
      routingBounds: { ownerId: "owner", minX: 0, minY: 0, maxX: 100, maxY: 30 } }] })
      .some(v => v.kind === "empty_coordinate_range")).toBe(true);
    const crossing: FinalRoutingConnector = { id: "crossing", priority: 0, fixed: true,
      source: { nodeId: "e", side: "south", point: { x: 50, y: 20 }, minLeg: 0 },
      target: { nodeId: "f", side: "north", point: { x: 50, y: 70 }, minLeg: 0 },
      route: { style: "orthogonal", points: [{ x: 50, y: 20 }, { x: 50, y: 70 }] } };
    expect(validateFinalRouteSet({ ...alone, connectors: [fixed, crossing] })
      .some(v => v.kind === "perpendicular_crossing")).toBe(true);
  });

  it.each(["constraint", "geometry"] as const)("refuses expansion that changes the fixed %s", change => {
    const initial = context();
    initial.connectors[1]!.fixed = true;
    const original = structuredClone(initial);
    const result = runRoutingLifecycle(initial, { maxCandidates: 128, expand: detached => {
      const fixed = detached.connectors[0]!;
      if (change === "constraint") fixed.fixed = false;
      else fixed.route.points[2]!.y += 1;
      return { ...detached, bounds: { ...detached.bounds, maxX: 120 } };
    } });
    expect(result.status).toBe("failed");
    if (result.status !== "failed") return;
    expect(result.reason).toBe("invalid_context");
    expect(result.debugConnectors).toEqual(original.connectors);
    expect(initial).toEqual(original);
  });
});
