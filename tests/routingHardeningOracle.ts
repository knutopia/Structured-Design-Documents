import type { FinalRoutingContext, FinalRoutingConnector } from "../src/renderer/staged/routingCore/lifecycle.js";

// Separate interval arithmetic: never delegates separation acceptance to production geometry.
export function independentParallelConflicts(connectors: readonly FinalRoutingConnector[]): number {
  const runs = connectors.flatMap(c => c.route.points.slice(1).map((p, i) => {
    const a = c.route.points[i]!, horizontal = a.y === p.y;
    return { id: c.id, horizontal, coordinate: horizontal ? a.y : a.x,
      low: horizontal ? Math.min(a.x, p.x) : Math.min(a.y, p.y),
      high: horizontal ? Math.max(a.x, p.x) : Math.max(a.y, p.y) };
  }));
  let count = 0;
  for (let i = 0; i < runs.length; i++) for (let j = i + 1; j < runs.length; j++) {
    const a = runs[i]!, b = runs[j]!;
    if (a.id !== b.id && a.horizontal === b.horizontal && Math.min(a.high, b.high) - Math.max(a.low, b.low) > 0.5
      && Math.abs(a.coordinate - b.coordinate) < 15.5) count++;
  }
  return count;
}
export function terminalFixture(): FinalRoutingContext {
  const connector = (id: string, sourceY: number, targetY: number, turn: number): FinalRoutingConnector => ({
    id, priority: 0,
    source: { point: { x: 0, y: sourceY }, side: "east", nodeId: `${id}-s`, minLeg: 0 },
    target: { point: { x: 200, y: targetY }, side: "west", nodeId: `${id}-t`, minLeg: 12 },
    route: { style: "orthogonal", points: [{ x: 0, y: sourceY }, { x: turn, y: sourceY }, { x: turn, y: targetY }, { x: 200, y: targetY }] }
  });
  return { connectors: [connector("a", 40, 100, 120), connector("b", 160, 41.5, 104)], boxes: [], bounds: { minX: 0, minY: 0, maxX: 200, maxY: 200 } };
}

