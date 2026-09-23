import { describe, expect, it } from "vitest";
import { runRoutingLifecycle, validateFinalRouteSet, type FinalRoutingContext } from "../src/renderer/staged/routingCore/index.js";

function fixture(clearance?: number): FinalRoutingContext {
  return {
    boxes: [
      { id: "source", x: 0, y: 0, width: 40, height: 40, clearance },
      { id: "target", x: 200, y: 0, width: 40, height: 40, clearance },
      { id: "obstacle", x: 90, y: 50, width: 60, height: 40, clearance }
    ],
    bounds: { minX: -50, minY: -50, maxX: 300, maxY: 150 },
    connectors: [{ id: "edge", priority: 0,
      source: { nodeId: "source", side: "east", point: { x: 40, y: 20 }, minLeg: 0 },
      target: { nodeId: "target", side: "west", point: { x: 200, y: 20 }, minLeg: 12 },
      route: { style: "orthogonal", points: [
        { x: 40, y: 20 }, { x: 60, y: 20 }, { x: 60, y: 50 },
        { x: 180, y: 50 }, { x: 180, y: 20 }, { x: 200, y: 20 }
      ] }
    }]
  };
}

// Deliberately independent of the production intersection/envelope helpers.
function assertClearance(context: FinalRoutingContext) {
  for (const c of context.connectors) for (let i = 0; i < c.route.points.length - 1; i++) {
    const a = c.route.points[i]!, b = c.route.points[i + 1]!;
    for (const box of context.boxes) {
      if (box.id === c.source.nodeId && i === 0 || box.id === c.target.nodeId && i === c.route.points.length - 2) continue;
      const dx = Math.max(box.x - Math.max(a.x, b.x), Math.min(a.x, b.x) - box.x - box.width, 0);
      const dy = Math.max(box.y - Math.max(a.y, b.y), Math.min(a.y, b.y) - box.y - box.height, 0);
      expect(Math.max(dx, dy), `${c.id}/${i}/${box.id}`).toBeGreaterThanOrEqual((box.clearance ?? 0) - 0.5);
    }
  }
}

describe("retaining adapter-owned node clearance", () => {
  it.each([false, true])("keeps parallel runs away from dividers but permits crossings (transpose=%s)", transpose => {
    const context = fixture(16);
    context.boxes = context.boxes.slice(0, 2);
    context.blockers = [{ id: "divider", x: 0, y: 50, width: 250, height: 0,
      clearance: 16, blocksAxis: "horizontal" }];
    if (transpose) {
      for (const box of [...context.boxes, ...context.blockers]) [box.x, box.y, box.width, box.height] = [box.y, box.x, box.height, box.width];
      context.blockers[0]!.blocksAxis = "vertical";
      context.bounds = { minX: -50, minY: -50, maxX: 150, maxY: 300 };
      for (const c of context.connectors) {
        for (const p of [c.source.point, c.target.point, ...c.route.points]) [p.x, p.y] = [p.y, p.x];
        c.source.side = "south"; c.target.side = "north";
      }
    }
    const violations = validateFinalRouteSet(context).filter(v => v.boxId === "divider");
    expect(violations).toHaveLength(1);
    expect(violations[0]!.routeSegmentIndexes).toEqual([2]);
    const result = runRoutingLifecycle(context);
    expect(result.status).toBe("resolved");
    if (result.status !== "resolved") throw new Error(result.reason);
    expect(validateFinalRouteSet(result.context)).toEqual([]);
    // Move the parallel run beyond the margin; its perpendicular legs cross the divider.
    for (const point of context.connectors[0]!.route.points.slice(2, 4)) {
      if (transpose) point.x = 80;
      else point.y = 80;
    }
    expect(validateFinalRouteSet(context)).toEqual([]);
  });

  it("leaves callers without obstacle margins unchanged", () => {
    const context = fixture();
    const result = runRoutingLifecycle(context);
    expect(result.status).toBe("resolved");
    if (result.status !== "resolved") throw new Error(result.reason);
    expect(result.context.connectors).toEqual(context.connectors);
    expect(result.trace.candidates).toBe(0);
  });

  it.each([false, true])("repairs a boundary-hugging route with its margin preserved (transpose=%s)", transpose => {
    const context = fixture(16);
    if (transpose) {
      for (const box of context.boxes) [box.x, box.y, box.width, box.height] = [box.y, box.x, box.height, box.width];
      context.bounds = { minX: -50, minY: -50, maxX: 150, maxY: 300 };
      for (const c of context.connectors) {
        for (const p of [c.source.point, c.target.point, ...c.route.points]) [p.x, p.y] = [p.y, p.x];
        c.source.side = "south"; c.target.side = "north";
      }
    }
    expect(validateFinalRouteSet(context).some(v => v.kind === "node_clearance" && v.boxId === "obstacle")).toBe(true);
    const result = runRoutingLifecycle(context);
    expect(result.status).toBe("resolved");
    if (result.status !== "resolved") throw new Error(result.reason);
    assertClearance(result.context);
    expect(validateFinalRouteSet(result.context)).toEqual([]);
    expect(runRoutingLifecycle(context)).toEqual(result);
  });

  it("permits attachment legs but rejects a subsequent run beside its own endpoint", () => {
    const context = fixture(16);
    const route = context.connectors[0]!.route;
    route.points[1]!.x = route.points[2]!.x = 48;
    expect(validateFinalRouteSet(context)).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "node_clearance", boxId: "source", routeSegmentIndexes: [1] })
    ]));
    route.points = [{ x: 40, y: 20 }, { x: 200, y: 20 }];
    expect(validateFinalRouteSet(context)).toEqual([]);
  });

  it.each([NaN, Infinity, -1])("rejects an invalid obstacle margin %s", clearance => {
    expect(runRoutingLifecycle(fixture(clearance)).status).toBe("failed");
  });

  it("cannot accept hugging when its search budget is exhausted", () => {
    const result = runRoutingLifecycle(fixture(16), { maxCandidates: 1 });
    expect(result.status).toBe("failed");
    expect("routeByConnectorId" in result).toBe(false);
  });

  it("rejects an expansion that mutates a connector-scoped divider barrier", () => {
    const context = fixture(16);
    context.boxes[2]!.y = -50;
    context.boxes[2]!.height = 200;
    context.blockers = [{ id: "divider", x: 0, y: 50, width: 250, height: 0,
      clearance: 16, appliesToConnectorIds: ["edge"] }];
    let expanded = false;
    const result = runRoutingLifecycle(context, { expand: current => {
      expanded = true;
      (current.blockers![0]!.appliesToConnectorIds as string[]).pop();
      return { ...current, bounds: { ...current.bounds, maxY: 250 } };
    } });
    expect(expanded).toBe(true);
    expect(result.status).toBe("failed");
    if (result.status !== "failed") throw new Error("Unexpected acceptance");
    expect(result.reason).toBe("invalid_context");
    expect(context.blockers[0]!.appliesToConnectorIds).toEqual(["edge"]);
  });

  it("rejects an expansion that discards the adapter's obstacle margins", () => {
    const context = fixture(16);
    context.boxes[2]!.y = -50;
    context.boxes[2]!.height = 200;
    let expanded = false;
    const result = runRoutingLifecycle(context, { expand: current => {
      expanded = true;
      return { ...current, bounds: { ...current.bounds, maxY: 250 },
        boxes: current.boxes.map(box => ({ ...box, clearance: undefined })) };
    } });
    expect(expanded).toBe(true);
    expect(result.status).toBe("failed");
    if (result.status !== "failed") throw new Error("Unexpected acceptance");
    expect(result.reason).toBe("invalid_context");
  });
});
