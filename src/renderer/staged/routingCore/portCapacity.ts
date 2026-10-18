import { ROUTING_METRIC_PRECISION } from "./geometry.js";

export interface PortGroupCapacityDemandInput {
  sideLength: number;
  minInset: number;
  minSeparation: number;
  /** Rigid, ordered local offsets beginning at zero. */
  relativeOffsets: readonly number[];
  /** Existing ports remain fixed throughout this allocation trial. */
  reservedOffsets: readonly number[];
  /** Fixed ordering limit on the final group port, independent of side growth. */
  maximumGroupEnd?: number;
}

export type PortGroupCapacityDemand =
  | { status: "fits" | "growth_required"; minimumExtent: number; start: number }
  | { status: "ordering_exhausted" | "invalid_input" };

/**
 * Find the minimum side extent for one declared rigid port group. Each reserved
 * port excludes an open interval of group starts for every relative offset;
 * exact minimum separation remains admissible. A finite interval sweep handles
 * fragmented capacity without moving reservations or trying incremental growth.
 */
export function minimumPortGroupSideLength(input: PortGroupCapacityDemandInput): PortGroupCapacityDemand {
  const { sideLength, minInset, minSeparation, relativeOffsets, reservedOffsets, maximumGroupEnd } = input;
  if (![sideLength, minInset, minSeparation, ...(maximumGroupEnd === undefined ? [] : [maximumGroupEnd])]
    .every(value => Number.isFinite(value) && value >= 0)
    || minSeparation <= 0 || !Array.isArray(relativeOffsets) || relativeOffsets.length === 0
    || relativeOffsets[0] !== 0 || !Array.isArray(reservedOffsets)
    || [...relativeOffsets].some((offset, index) => !Number.isFinite(offset) || offset < 0
      || index > 0 && (offset <= relativeOffsets[index - 1]!
        || offset - relativeOffsets[index - 1]! + Number.EPSILON * Math.max(1, offset, minSeparation) < minSeparation))
    || [...reservedOffsets].some(offset => !Number.isFinite(offset) || offset < 0)) return { status: "invalid_input" };

  const span = relativeOffsets.at(-1)!;
  const forbidden: Array<{ min: number; max: number }> = [];
  for (const reservation of reservedOffsets) for (const offset of relativeOffsets) {
    const min = reservation - offset - minSeparation, max = reservation - offset + minSeparation;
    if (!Number.isFinite(min) || !Number.isFinite(max)) return { status: "invalid_input" };
    forbidden.push({ min, max });
  }
  forbidden.sort((a, b) => a.min - b.min || a.max - b.max);
  const merged: typeof forbidden = [];
  for (const interval of forbidden) {
    const previous = merged.at(-1);
    // Touching open intervals retain a feasible point at their common boundary.
    if (previous && interval.min < previous.max) previous.max = Math.max(previous.max, interval.max);
    else merged.push({ ...interval });
  }
  let start = minInset;
  for (const interval of merged) {
    if (start <= interval.min) break;
    if (start < interval.max) start = interval.max;
  }
  const end = start + span;
  if (!Number.isFinite(end)) return { status: "invalid_input" };
  if (maximumGroupEnd !== undefined
    && end - maximumGroupEnd > Number.EPSILON * Math.max(1, end, maximumGroupEnd)) return { status: "ordering_exhausted" };
  const required = end + minInset;
  if (!Number.isFinite(required)) return { status: "invalid_input" };
  if (required <= sideLength) return { status: "fits", minimumExtent: sideLength, start };
  const scaled = required * ROUTING_METRIC_PRECISION;
  const minimumExtent = Number.isFinite(scaled) ? Math.ceil(scaled) / ROUTING_METRIC_PRECISION : required;
  return { status: "growth_required", minimumExtent, start };
}

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
