import { describe, expect, it } from "vitest";
import { buildRoutingSegments, measureRoutingCorridorDeficits, type RoutingBox } from "../src/renderer/staged/routingCore/index.js";

const boxes: RoutingBox[] = [
  { id: "left", x: 0, y: 0, width: 100, height: 100, clearance: 16 },
  { id: "right", x: 144, y: 0, width: 100, height: 100, clearance: 16 }
];
function run(id: string, x: number, y1 = 10, y2 = 90) {
  return buildRoutingSegments(id, [{ x, y: y1 }, { x, y: y2 }]);
}

describe("physical corridor capacity", () => {
  it.each([false, true])("counts mixed tracks and both node margins (transpose=%s)", transpose => {
    const walls = structuredClone(boxes);
    let runs = [...run("obstacle-detour", 118), ...run("endpoint-track", 128)];
    if (transpose) {
      for (const b of walls) [b.x, b.y, b.width, b.height] = [b.y, b.x, b.height, b.width];
      runs = runs.flatMap(s => buildRoutingSegments(s.connectorId, [s.start, s.end].map(p => ({ x: p.y, y: p.x }))));
    }
    expect(measureRoutingCorridorDeficits(runs, walls)).toEqual([{
      axis: transpose ? "horizontal" : "vertical", beforeBoxId: "left", afterBoxId: "right",
      requiredSize: 48, availableSize: 44
    }]);
    if (transpose) walls[1]!.y += 4;
    else walls[1]!.x += 4;
    expect(measureRoutingCorridorDeficits(runs, walls)).toEqual([]);
  });

  it("counts simultaneous runs rather than every run that visits a corridor", () => {
    const walls = structuredClone(boxes);
    walls[1]!.x = 150;
    expect(measureRoutingCorridorDeficits([
      ...run("through", 118), ...run("early", 134, 0, 40), ...run("late", 134, 60, 100)
    ], walls)).toEqual([]);
    expect(measureRoutingCorridorDeficits([
      ...run("through", 118), ...run("early", 126, 0, 70), ...run("late", 134, 60, 100)
    ], walls)[0]).toMatchObject({ requiredSize: 64, availableSize: 50 });
  });

  it("does not expand a wide corridor or count explicitly shared tracks twice", () => {
    expect(measureRoutingCorridorDeficits([...run("one", 118), ...run("two", 128)],
      [boxes[0]!, { ...boxes[1]!, x: 180 }])).toEqual([]);
    const shared = [...run("one", 118), ...run("two", 118)].map(s => ({ ...s, sharedTrackGroupId: "shared" }));
    expect(measureRoutingCorridorDeficits(shared, boxes)).toEqual([]);
  });

  it("does not treat space occupied by an intervening node as one corridor", () => {
    const walls = [boxes[0]!, { ...boxes[1]!, x: 180 }, { id: "middle", x: 120, y: 0, width: 40, height: 100, clearance: 16 }];
    const deficits = measureRoutingCorridorDeficits([...run("one", 118), ...run("two", 162)], walls);
    expect(deficits).toEqual([]);
  });
});
