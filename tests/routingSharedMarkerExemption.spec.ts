import { describe, expect, it } from "vitest";
import { validateRouting } from "../src/renderer/staged/routingCore/validation.js";
import type { RoutingBox, RoutingValidationEdge } from "../src/renderer/staged/routingCore/contracts.js";
const marker: RoutingBox = { id: "branch:marker", x: 396, y: 30, width: 12, height: 12, clearance: 16, exemptSharedTrackGroupIds: ["trunk"] };
const edge: RoutingValidationEdge = { id: "branch", sourceItemId: "source", targetItemId: "target", style: "orthogonal",
  points: [{ x: 384, y: 0 }, { x: 384, y: 70 }, { x: 390, y: 70 }, { x: 390, y: 35 }, { x: 420, y: 35 }],
  sharedTrackGroupBySegmentIndex: new Map([[0, "trunk"]]) };
describe("segment-scoped shared marker exemptions", () => {
  it("exempts declared shared trunk only and still checks later unshared segments", () => {
    const violations = validateRouting({ edges: [edge], boxes: [marker], policy: { minTerminalLeg: 0 } }).filter(v => v.boxId === marker.id);
    expect(violations.some(v => v.routeSegmentIndexes?.includes(0))).toBe(false);
    expect(violations.some(v => v.routeSegmentIndexes?.includes(2) && v.kind === "node_clearance")).toBe(true);
    expect(violations.some(v => v.routeSegmentIndexes?.includes(3) && v.kind === "node_intersection")).toBe(true);
  });
  it("keeps the full 16px envelope for unrelated shared groups and untagged markers", () => {
    for (const obstacle of [{ ...marker, exemptSharedTrackGroupIds: ["other"] }, { ...marker, exemptSharedTrackGroupIds: undefined }]) {
      const violations = validateRouting({ edges: [edge], boxes: [obstacle], policy: { minTerminalLeg: 0 } });
      expect(violations.some(v => v.boxId === marker.id && v.routeSegmentIndexes?.includes(0) && v.kind === "node_clearance")).toBe(true);
    }
  });
});
