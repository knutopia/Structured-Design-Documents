import { describe, expect, it } from "vitest";
import { runRoutingLifecycle, validateFinalRouteSet, type FinalRoutingContext, type FinalRoutingConnector } from "../src/renderer/staged/routingCore/lifecycle.js";

import { independentParallelConflicts, terminalFixture } from "./routingHardeningOracle.js";

describe("routing hardening final acceptance contract", () => {
  it("rejects the neutral fixed-terminal conflict without exposing an accepted route map", () => {
    const context = terminalFixture();
    expect(independentParallelConflicts(context.connectors)).toBe(1);
    const result = runRoutingLifecycle(context, { maxCandidates: 1 });
    expect(result.status).toBe("failed");
    expect("routeByConnectorId" in result).toBe(false);
  });
  it("accepts axis-aligned straight routes and still rejects diagonal straight geometry", () => {
    const context = terminalFixture(), connector = context.connectors[0]!;
    connector.target.point.y = connector.source.point.y;
    connector.route = { style: "straight", points: [{ ...connector.source.point }, { ...connector.target.point }] };
    context.connectors = [connector];
    expect(runRoutingLifecycle(context).status).toBe("resolved");
    connector.target.point.y += 30; connector.route.points[1]!.y += 30;
    expect(validateFinalRouteSet(context).some(v => v.kind === "non_orthogonal_segment")).toBe(true);
    expect(runRoutingLifecycle(context).status).toBe("failed");
  });
  it("certifies actual geometry and preserves a valid input", () => {
    const context = terminalFixture();
    context.connectors[0]!.route.points[1]!.x = 80;
    context.connectors[0]!.route.points[2]!.x = 80;
    const result = runRoutingLifecycle(context);
    expect(result.status).toBe("resolved");
    if (result.status !== "resolved") return;
    const final = context.connectors.map(c => ({ ...c, route: result.routeByConnectorId.get(c.id)! }));
    expect(independentParallelConflicts(final)).toBe(0);
    expect(final).toEqual(context.connectors);
    expect(Object.isFrozen(final[0]!.route.points[0])).toBe(true);
  });
  it.each([1.5, 14.5, 15.499, 15.5, 16])("agrees at a separation of %spx", distance => {
    const context = terminalFixture();
    const b = context.connectors[1]!;
    b.target.point.y = 40 + distance;
    b.route.points[2]!.y = b.route.points[3]!.y = b.target.point.y;
    expect(independentParallelConflicts(context.connectors) > 0).toBe(distance < 15.5);
    expect(validateFinalRouteSet(context).some(v => v.kind === "track_separation")).toBe(distance < 15.5);
  });
  it("checks missing points, independent attachment, declared side, both marker legs, bounds, and endpoint reentry", () => {
    const original = terminalFixture();
    original.connectors = [original.connectors[0]!];
    for (const mutate of [
      (c: FinalRoutingContext) => { c.connectors[0]!.route.points = []; },
      (c: FinalRoutingContext) => { c.connectors[0]!.route.points[0]!.x = 2; },
      (c: FinalRoutingContext) => { c.connectors[0]!.source.side = "west"; },
      (c: FinalRoutingContext) => { c.connectors[0]!.source.minLeg = 130; },
      (c: FinalRoutingContext) => { c.connectors[0]!.target.minLeg = 90; },
      (c: FinalRoutingContext) => { c.bounds.maxX = 150; },
      (c: FinalRoutingContext) => { c.boxes = [{ id: "a-s", x: 100, y: 50, width: 40, height: 40 }]; }
    ]) {
      const context = structuredClone(original); mutate(context);
      expect(runRoutingLifecycle(context, { maxCandidates: 1 }).status).toBe("failed");
    }
  });
});
