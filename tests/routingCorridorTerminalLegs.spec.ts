import { describe, expect, it } from "vitest";
import { buildPortCorridorCandidates, runRoutingLifecycle, validateFinalRouteSet,
  type FinalRoutingContext } from "../src/renderer/staged/routingCore/index.js";

function context(): FinalRoutingContext {
  return { corridorSearch: "obstacle_aware", connectors: [{ id: "return", priority: 0,
    route: { style: "orthogonal", points: [{ x: 452, y: 80 }, { x: 148, y: 80 }] },
    source: { nodeId: "right", side: "north", point: { x: 452, y: 80 }, minLeg: 0 },
    target: { nodeId: "left", side: "north", point: { x: 148, y: 80 }, minLeg: 12 } }],
    boxes: [{ id: "left", x: 40, y: 80, width: 224, height: 98 }, { id: "right", x: 344, y: 80, width: 224, height: 98 }],
    blockers: [{ id: "left-header", x: 24, y: 24, width: 256, height: 40 },
      { id: "right-header", x: 328, y: 24, width: 256, height: 40 }],
    bounds: { minX: 0, minY: 0, maxX: 608, maxY: 348 } };
}

describe("shared corridor recovery terminal contracts", () => {
  it("does not yield a collapsed turnaround that shortens a required arrow leg", () => {
    const ctx = context();
    const candidates = [...buildPortCorridorCandidates(ctx.connectors[0]!, ctx)];
    expect(candidates.length).toBeGreaterThan(0);
    for (const points of candidates) {
      expect(Math.hypot(points.at(-1)!.x - points.at(-2)!.x, points.at(-1)!.y - points.at(-2)!.y)).toBeGreaterThanOrEqual(12);
    }
    expect(candidates).toContainEqual([{ x: 452, y: 80 }, { x: 452, y: 68 }, { x: 148, y: 68 }, { x: 148, y: 80 }]);
  });
  it("recovers asymmetric north ports within the existing search budget and header channel", () => {
    const result = runRoutingLifecycle(context());
    expect(result.status).toBe("resolved");
    if (result.status !== "resolved") return;
    expect(validateFinalRouteSet(result.context)).toEqual([]);
    expect(result.routeByConnectorId.get("return")!.points).toEqual([
      { x: 452, y: 80 }, { x: 452, y: 68 }, { x: 148, y: 68 }, { x: 148, y: 80 }
    ]);
  });
});
