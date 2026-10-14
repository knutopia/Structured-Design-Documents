import { allocatePortOffsets } from "./portCapacity.js";

/** Allocate a same-side pair together while preserving every occupied port. */
export function allocateOrderedPortPair(input: {
  sideLength: number; minInset: number; minSeparation: number;
  direction: "positive" | "negative";
  placement: "nearest_feasible" | "before_other_arrivals";
  occupiedOffsets: readonly number[]; otherArrivalOffsets: readonly number[];
}): { departure: number; arrival: number; } | undefined {
  const high = input.placement === "before_other_arrivals" && input.otherArrivalOffsets.length
    ? Math.min(input.sideLength - input.minInset, Math.min(...input.otherArrivalOffsets) - input.minSeparation)
    : input.sideLength - input.minInset;
  if (!Number.isFinite(high) || high - input.minInset < input.minSeparation - 1e-6) return undefined;
  const ordered = input.direction === "negative" ? ["arrival", "departure"] : ["departure", "arrival"];
  const allocation = allocatePortOffsets({
    sideLength: input.sideLength, minInset: input.minInset,
    minSeparation: input.minSeparation, maximumOffset: high, reservedOffsets: input.occupiedOffsets, requestIds: ordered
  });
  if (allocation.status !== "allocated") return undefined;
  const departure = allocation.offsets.get("departure")!, arrival = allocation.offsets.get("arrival")!;
  if (Math.max(departure, arrival) > high + 1e-6) return undefined;
  return { departure, arrival };
}

/** Direction is a validity condition, independent of route cost. */
export function orderedPortPairHasTraversal(departure: number, arrival: number,
  direction: "positive" | "negative", epsilon = 1e-6): boolean {
  return Number.isFinite(departure) && Number.isFinite(arrival)
    && (direction === "negative" ? departure - arrival : arrival - departure) > epsilon;
}
