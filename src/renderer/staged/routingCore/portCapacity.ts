export interface PortOffsetAllocationInput {
  sideLength: number;
  minInset: number;
  minSeparation: number;
  /** Existing ports keep their positions and reserve the same clearance as allocated ports. */
  reservedOffsets?: readonly number[];
  /** Optional upper bound of a reserved subinterval; the preferred centre stays on the full side. */
  maximumOffset?: number;
  /** Stable caller order is retained when the selected slots are assigned. */
  requestIds: readonly string[];
}

export type PortOffsetAllocation =
  | { status: "allocated"; offsets: ReadonlyMap<string, number>; availableSlots: number; displacementFromCenter: number }
  | { status: "capacity_exhausted"; requested: number; availableSlots: number; sideLength: number };

/**
 * Allocate deterministic, side-bounded port offsets without moving existing ports.
 * Groups use the shared minimum separation as their pitch and centre on the side.
 * Reservations translate the whole group to the nearest feasible position, then
 * locations are assigned in the caller's stable request order.
 */
export function allocatePortOffsets(input: PortOffsetAllocationInput): PortOffsetAllocation {
  const { sideLength, minInset, minSeparation } = input;
  const maximumOffset = Math.min(sideLength - minInset, input.maximumOffset ?? sideLength - minInset);
  if (![sideLength, minInset, minSeparation, maximumOffset].every(Number.isFinite)
    || sideLength < 0 || minInset < 0 || minSeparation <= 0) {
    return { status: "capacity_exhausted", requested: input.requestIds.length, availableSlots: 0, sideLength };
  }
  if (new Set(input.requestIds).size !== input.requestIds.length) {
    return { status: "capacity_exhausted", requested: input.requestIds.length, availableSlots: 0, sideLength };
  }

  const usable = maximumOffset - minInset;
  if (usable < -1e-6) {
    return { status: "capacity_exhausted", requested: input.requestIds.length, availableSlots: 0, sideLength };
  }
  const reserved = [...(input.reservedOffsets ?? [])].sort((a, b) => a - b);
  if (reserved.some(offset => !Number.isFinite(offset))) {
    return { status: "capacity_exhausted", requested: input.requestIds.length, availableSlots: 0, sideLength };
  }
  // Continuous side capacity, including free intervals split by fixed reservations.
  let availableSlots = 0;
  let next = minInset;
  for (const offset of reserved) {
    const end = Math.min(maximumOffset, offset - minSeparation);
    if (end >= next - 1e-6) availableSlots += Math.floor((end - next + 1e-6) / minSeparation) + 1;
    next = Math.max(next, offset + minSeparation);
  }
  if (next <= maximumOffset + 1e-6) {
    availableSlots += Math.floor((maximumOffset - next + 1e-6) / minSeparation) + 1;
  }
  const count = input.requestIds.length;
  const center = sideLength / 2;
  const nominal = Array.from({ length: count }, (_unused, index) => center + (index - (count - 1) / 2) * minSeparation);
  const minShift = count ? minInset - nominal[0]! : 0;
  const maxShift = count ? maximumOffset - nominal.at(-1)! : 0;
  // A feasible translation starts at the centre or at an interval boundary. Test
  // both sides of every reservation; negative displacement wins an exact tie.
  const shifts = [0, minShift, maxShift, ...nominal.flatMap(port => reserved.flatMap(offset =>
    [offset - minSeparation - port, offset + minSeparation - port]))]
    .filter(shift => shift >= minShift - 1e-6 && shift <= maxShift + 1e-6)
    .sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
  const displacementFromCenter = shifts.find(shift => nominal.every(port => reserved.every(offset =>
    Math.abs(port + shift - offset) >= minSeparation - 1e-6)));
  if (displacementFromCenter === undefined) {
    return { status: "capacity_exhausted", requested: count, availableSlots, sideLength };
  }
  const selected = nominal.map(port => port + displacementFromCenter);
  const offsets = new Map(input.requestIds.map((id, index) => [id, selected[index]!] as const));
  return { status: "allocated", offsets, availableSlots, displacementFromCenter };
}
