export interface PortOffsetAllocationInput {
  sideLength: number;
  minInset: number;
  minSeparation: number;
  /** Existing ports keep their positions and reserve the same clearance as allocated ports. */
  reservedOffsets?: readonly number[];
  /** Stable caller order is retained when the selected slots are assigned. */
  requestIds: readonly string[];
}

export type PortOffsetAllocation =
  | { status: "allocated"; offsets: ReadonlyMap<string, number>; availableSlots: number }
  | { status: "capacity_exhausted"; requested: number; availableSlots: number; sideLength: number };

/**
 * Allocate deterministic, side-bounded port offsets without moving existing ports.
 * Candidate locations use the shared minimum separation as their pitch; among legal
 * locations, the allocator chooses the set closest to the side centre, then assigns
 * those locations in the caller's stable request order.
 */
export function allocatePortOffsets(input: PortOffsetAllocationInput): PortOffsetAllocation {
  const { sideLength, minInset, minSeparation } = input;
  if (![sideLength, minInset, minSeparation].every(Number.isFinite)
    || sideLength < 0 || minInset < 0 || minSeparation <= 0) {
    return { status: "capacity_exhausted", requested: input.requestIds.length, availableSlots: 0, sideLength };
  }
  if (new Set(input.requestIds).size !== input.requestIds.length) {
    return { status: "capacity_exhausted", requested: input.requestIds.length, availableSlots: 0, sideLength };
  }

  const usable = sideLength - 2 * minInset;
  if (usable < -1e-6) {
    return { status: "capacity_exhausted", requested: input.requestIds.length, availableSlots: 0, sideLength };
  }
  const slotCount = Math.floor((Math.max(0, usable) + 1e-6) / minSeparation) + 1;
  const reserved = input.reservedOffsets ?? [];
  const legal = Array.from({ length: slotCount }, (_unused, index) => minInset + index * minSeparation)
    .filter(offset => offset <= sideLength - minInset + 1e-6
      && reserved.every(existing => Math.abs(existing - offset) >= minSeparation - 1e-6));
  const availableSlots = legal.length;
  if (availableSlots < input.requestIds.length) {
    return { status: "capacity_exhausted", requested: input.requestIds.length, availableSlots, sideLength };
  }

  const center = sideLength / 2;
  const selected = [...legal].sort((a, b) => Math.abs(a - center) - Math.abs(b - center) || a - b)
    .slice(0, input.requestIds.length).sort((a, b) => a - b);
  const offsets = new Map(input.requestIds.map((id, index) => [id, selected[index]!] as const));
  return { status: "allocated", offsets, availableSlots };
}
