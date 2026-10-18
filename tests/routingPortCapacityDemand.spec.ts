import { describe, expect, it } from "vitest";
import { minimumPortGroupSideLength, type PortGroupCapacityDemandInput } from "../src/renderer/staged/routingCore/portCapacity.js";
import { ROUTING_METRIC_PRECISION } from "../src/renderer/staged/routingCore/geometry.js";
import { readablePortPitch } from "../src/renderer/staged/routingCore/bounds.js";
import { markerRoutingClearance } from "../src/renderer/staged/markerGeometry.js";

const pair: PortGroupCapacityDemandInput = {
  sideLength: 40, minInset: 12, minSeparation: 23, relativeOffsets: [0, 23], reservedOffsets: []
};

describe("minimum side extent for a fixed port group", () => {
  it("reports the rigid 23-unit pair's finite corner-bounded minimum", () => {
    expect(minimumPortGroupSideLength(pair)).toEqual({ status: "growth_required", minimumExtent: 47, start: 12 });
    expect(minimumPortGroupSideLength({ ...pair, sideLength: 47 })).toEqual({ status: "fits", minimumExtent: 47, start: 12 });
  });

  it("uses caller-supplied shared marker clearance and pitch", () => {
    for (const [arrowSize, strokeWidth] of [[10, 2], [40, 4]]) {
      const minInset = markerRoutingClearance("arrow", arrowSize!, strokeWidth!);
      const minSeparation = readablePortPitch(arrowSize!, strokeWidth!);
      const result = minimumPortGroupSideLength({ ...pair, sideLength: 0, minInset, minSeparation, relativeOffsets: [0, minSeparation] });
      expect(result).toEqual({ status: "growth_required", minimumExtent: minInset * 2 + minSeparation, start: minInset });
    }
  });

  it("preserves an already sufficient extent, including its original precision", () => {
    expect(minimumPortGroupSideLength({ ...pair, sideLength: 224 })).toEqual({ status: "fits", minimumExtent: 224, start: 12 });
    expect(minimumPortGroupSideLength({ ...pair, sideLength: 47.0005, minInset: 12.0002 })).toEqual({ status: "fits", minimumExtent: 47.0005, start: 12.0002 });
  });

  it("jumps past reservation intervals without moving a reserved arrival", () => {
    expect(minimumPortGroupSideLength({ ...pair, reservedOffsets: [30] })).toEqual({ status: "growth_required", minimumExtent: 88, start: 53 });
  });

  it("accounts for each offset of a rigid pair across disconnected free capacity", () => {
    // Three disconnected singleton slots fit this side, but no pair at pitch 16.
    expect(minimumPortGroupSideLength({ sideLength: 100, minInset: 12, minSeparation: 16,
      relativeOffsets: [0, 16], reservedOffsets: [34, 66] }))
      .toEqual({ status: "growth_required", minimumExtent: 110, start: 82 });
  });

  it("uses the first feasible gap instead of jumping beyond every reservation", () => {
    expect(minimumPortGroupSideLength({ sideLength: 100, minInset: 12, minSeparation: 10,
      relativeOffsets: [0, 30], reservedOffsets: [40] }))
      .toEqual({ status: "fits", minimumExtent: 100, start: 20 });
  });

  it("keeps exact separation admissible where forbidden open intervals touch", () => {
    expect(minimumPortGroupSideLength({ sideLength: 70, minInset: 12, minSeparation: 23,
      relativeOffsets: [0, 46], reservedOffsets: [35] }))
      .toEqual({ status: "fits", minimumExtent: 70, start: 12 });
    expect(minimumPortGroupSideLength({ sideLength: 20, minInset: 10, minSeparation: 10,
      relativeOffsets: [0], reservedOffsets: [0, 20] }))
      .toEqual({ status: "fits", minimumExtent: 20, start: 10 });
  });

  it("handles groups beyond pairs without conflating distinct forbidden starts", () => {
    expect(minimumPortGroupSideLength({ ...pair, relativeOffsets: [0, 23, 46], reservedOffsets: [30] }))
      .toEqual({ status: "growth_required", minimumExtent: 111, start: 53 });
    expect(minimumPortGroupSideLength({ sideLength: 1, minInset: 0.1, minSeparation: 0.1,
      relativeOffsets: [0, 0.1, 0.2, 0.3], reservedOffsets: [] }))
      .toEqual({ status: "fits", minimumExtent: 1, start: 0.1 });
  });

  it("handles one port and zero initial capacity", () => {
    expect(minimumPortGroupSideLength({ ...pair, sideLength: 0, relativeOffsets: [0] }))
      .toEqual({ status: "growth_required", minimumExtent: 24, start: 12 });
  });

  it("rounds positive growth upward at shared renderer precision", () => {
    const result = minimumPortGroupSideLength({ ...pair, minInset: 12.0002 });
    expect(result).toEqual({ status: "growth_required", minimumExtent: 47.001, start: 12.0002 });
    if (result.status !== "growth_required") throw new Error("Expected finite growth demand");
    expect(result.minimumExtent * ROUTING_METRIC_PRECISION).toBe(Math.ceil((12.0002 * 2 + 23) * ROUTING_METRIC_PRECISION));
  });

  it("permits growth with an exactly satisfied fixed ordering bound", () => {
    expect(minimumPortGroupSideLength({ ...pair, maximumGroupEnd: 35 }))
      .toEqual({ status: "growth_required", minimumExtent: 47, start: 12 });
    expect(minimumPortGroupSideLength({ sideLength: 1, minInset: 0.1, minSeparation: 0.1,
      relativeOffsets: [0, 0.2], reservedOffsets: [], maximumGroupEnd: 0.3 }))
      .toEqual({ status: "fits", minimumExtent: 1, start: 0.1 });
  });

  it("reports pinned ordering exhaustion regardless of additional far-end space", () => {
    for (const sideLength of [40, 224, 1000]) {
      expect(minimumPortGroupSideLength({ ...pair, sideLength, reservedOffsets: [30], maximumGroupEnd: 60 }))
        .toEqual({ status: "ordering_exhausted" });
      expect(minimumPortGroupSideLength({ ...pair, sideLength, maximumGroupEnd: 34 }))
        .toEqual({ status: "ordering_exhausted" });
    }
  });

  it("does not mutate inputs and ignores reservation enumeration order or duplicates", () => {
    const input = { sideLength: 140, minInset: 12, minSeparation: 16, relativeOffsets: [0, 16], reservedOffsets: [75, 40] };
    const before = structuredClone(input);
    const expected = { status: "fits", minimumExtent: 140, start: 91 };
    expect(minimumPortGroupSideLength(input)).toEqual(expected);
    expect(input).toEqual(before);
    expect(minimumPortGroupSideLength({ ...input, reservedOffsets: [40, 75, 40] })).toEqual(expected);
  });

  const invalid: Array<[string, Partial<PortGroupCapacityDemandInput>]> = [
    ["negative side length", { sideLength: -1 }],
    ["infinite side length", { sideLength: Infinity }],
    ["NaN side length", { sideLength: NaN }],
    ["negative corner inset", { minInset: -1 }],
    ["infinite corner inset", { minInset: Infinity }],
    ["zero separation", { minSeparation: 0 }],
    ["negative separation", { minSeparation: -1 }],
    ["infinite separation", { minSeparation: Infinity }],
    ["empty group", { relativeOffsets: [] }],
    ["group not beginning at zero", { relativeOffsets: [1, 24] }],
    ["negative group offset", { relativeOffsets: [0, -23] }],
    ["unordered group", { relativeOffsets: [0, 46, 23] }],
    ["duplicate group offset", { relativeOffsets: [0, 23, 23] }],
    ["internally under-separated group", { relativeOffsets: [0, 12] }],
    ["nonfinite group offset", { relativeOffsets: [0, Infinity] }],
    ["negative reservation", { reservedOffsets: [-1] }],
    ["NaN reservation", { reservedOffsets: [NaN] }],
    ["infinite reservation", { reservedOffsets: [Infinity] }],
    ["negative ordering bound", { maximumGroupEnd: -1 }],
    ["infinite ordering bound", { maximumGroupEnd: Infinity }],
    ["NaN ordering bound", { maximumGroupEnd: NaN }],
    ["unrepresentable required extent", { minInset: Number.MAX_VALUE }]
  ];
  it.each(invalid)("rejects %s", (_label, change) => {
    expect(minimumPortGroupSideLength({ ...pair, ...change })).toEqual({ status: "invalid_input" });
  });

  it("rejects sparse group and reservation arrays", () => {
    const relativeOffsets = new Array<number>(3);
    relativeOffsets[0] = 0; relativeOffsets[2] = 46;
    expect(minimumPortGroupSideLength({ ...pair, relativeOffsets })).toEqual({ status: "invalid_input" });
    expect(minimumPortGroupSideLength({ ...pair, reservedOffsets: new Array<number>(1) })).toEqual({ status: "invalid_input" });
  });

  it("agrees with an independent finite-grid search across fragmented reservations", () => {
    for (const reservedOffsets of [[], [3], [8], [3, 8], [0, 6, 12], [2, 4, 6, 8, 10]]) {
      for (const relativeOffsets of [[0], [0, 2], [0, 4], [0, 2, 4]]) {
        const input = { sideLength: 5, minInset: 1, minSeparation: 2, relativeOffsets, reservedOffsets };
        const result = minimumPortGroupSideLength(input);
        const starts = Array.from({ length: 81 }, (_, index) => index / 4 + 1);
        const earliest = starts.find(start => relativeOffsets.every(offset => reservedOffsets.every(reservation => Math.abs(start + offset - reservation) >= 2)));
        expect(earliest).toBeDefined();
        expect(result).toEqual({ status: Math.max(5, earliest! + relativeOffsets.at(-1)! + 1) > 5 ? "growth_required" : "fits",
          minimumExtent: Math.max(5, earliest! + relativeOffsets.at(-1)! + 1), start: earliest });
      }
    }
  });
});
