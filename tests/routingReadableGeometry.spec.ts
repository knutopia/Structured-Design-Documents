import { describe, expect, it } from "vitest";
import { READABLE_ROUTING_GEOMETRY, readablePortPitch, readableRoutingClearance } from "../src/renderer/staged/routingCore/bounds.js";
describe("shared readable painted geometry", () => {
  it("retains 16px outside ordinary and larger strokes", () => {
    for (const width of [0, 2, 8, 20]) expect(readableRoutingClearance(width) - width / 2).toBe(16);
    expect(readableRoutingClearance(2)).toBe(17);
    expect(readableRoutingClearance(-2)).toBe(16);
    expect(READABLE_ROUTING_GEOMETRY.tolerance).toBe(0.5);
  });
  it("increases port pitch with painted marker and stroke size", () => {
    expect(readablePortPitch(12, 2)).toBe(24);
    for (const [arrow, stroke] of [[0, 0], [12, 2], [24, 6]]) {
      expect(readablePortPitch(arrow!, stroke!) - arrow! / 2 - stroke!).toBe(16);
    }
    expect(readablePortPitch(-10, -2)).toBe(16);
  });
  it("rejects nonfinite theme geometry rather than weakening clearance", () => {
    for (const value of [NaN, Infinity, -Infinity]) {
      expect(() => readableRoutingClearance(value)).toThrow(RangeError);
      expect(() => readablePortPitch(value, 2)).toThrow(RangeError);
      expect(() => readablePortPitch(12, value)).toThrow(RangeError);
    }
  });
});
