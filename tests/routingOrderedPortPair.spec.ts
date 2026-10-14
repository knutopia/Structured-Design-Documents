import { describe, expect, it } from "vitest";
import { allocateOrderedPortPair, orderedPortPairHasTraversal } from "../src/renderer/staged/routingCore/orderedPortPair.js";

describe("ordered same-side loop pairs", () => {
  it("reserves ordinary arrivals before placing a backward pair at shared pitch", () => {
    const pair = allocateOrderedPortPair({
      sideLength: 120, minInset: 12, minSeparation: 23,
      occupiedOffsets: [60], otherArrivalOffsets: [60], direction: "negative", placement: "before_other_arrivals"
    });
    expect(pair).toBeDefined();
    expect(pair!.arrival).toBeGreaterThanOrEqual(12);
    expect(pair!.departure - pair!.arrival).toBeCloseTo(23);
    expect(60 - pair!.departure).toBeGreaterThanOrEqual(23);
  });
  it("changes traversal only through the configured direction", () => {
    const input = {
      sideLength: 120, minInset: 12, minSeparation: 23,
      occupiedOffsets: [], otherArrivalOffsets: [], placement: "nearest_feasible" as const
    };
    const negative = allocateOrderedPortPair({ ...input, direction: "negative" })!;
    const positive = allocateOrderedPortPair({ ...input, direction: "positive" })!;
    expect(positive).toEqual({ departure: negative.arrival, arrival: negative.departure });
    expect(orderedPortPairHasTraversal(negative.departure, negative.arrival, "negative")).toBe(true);
    expect(orderedPortPairHasTraversal(negative.departure, negative.arrival, "positive")).toBe(false);
    expect(orderedPortPairHasTraversal(NaN, 0, "negative")).toBe(false);
  });
  it("reports exhausted capacity without moving an ordinary arrival", () => {
    expect(allocateOrderedPortPair({
      sideLength: 60, minInset: 12, minSeparation: 23,
      occupiedOffsets: [30], otherArrivalOffsets: [30], direction: "negative", placement: "before_other_arrivals"
    })).toBeUndefined();
  });
});
