import { describe, expect, it } from "vitest";
import { allocatePortOffsets } from "../src/renderer/staged/routingCore/portCapacity.js";

describe("shared bounded port capacity", () => {
  it("allocates centred side-bounded offsets in stable request order", () => {
    const result = allocatePortOffsets({ sideLength: 100, minInset: 12, minSeparation: 16,
      requestIds: ["first", "second"] });
    expect(result.status).toBe("allocated");
    if (result.status !== "allocated") return;
    expect([...result.offsets]).toEqual([["first", 42], ["second", 58]]);
  });

  it("centres singleton and odd groups and records reservation displacement", () => {
    for (const [requestIds, expected] of [[["a"], [50]], [["a", "b", "c"], [34, 50, 66]]] as const) {
      const result = allocatePortOffsets({ sideLength: 100, minInset: 12, minSeparation: 16, requestIds });
      expect(result.status).toBe("allocated");
      if (result.status === "allocated") { expect([...result.offsets.values()]).toEqual(expected); expect(result.displacementFromCenter).toBe(0); }
    }
    const result = allocatePortOffsets({ sideLength: 100, minInset: 12, minSeparation: 16, requestIds: ["a"], reservedOffsets: [50] });
    if (result.status === "allocated") { expect(result.offsets.get("a")).toBe(34); expect(result.displacementFromCenter).toBe(-16); }
    else throw new Error("Expected reservation displacement");
  });

  it("leaves clearance around existing side ports and reports exhausted capacity", () => {
    const result = allocatePortOffsets({ sideLength: 100, minInset: 12, minSeparation: 16,
      reservedOffsets: [50], requestIds: ["first", "second", "third", "fourth", "fifth"] });
    expect(result).toEqual({ status: "capacity_exhausted", requested: 5, availableSlots: 4, sideLength: 100 });
  });

  it("chooses the nearest feasible symmetric group among fragmented reservations", () => {
    const input = { sideLength: 140, minInset: 12, minSeparation: 16, reservedOffsets: [75, 40], requestIds: ["a", "b"] };
    const result = allocatePortOffsets(input);
    expect(result.status).toBe("allocated");
    if (result.status !== "allocated") throw new Error("Expected feasible displaced group");
    const offsets = [...result.offsets.values()];
    expect(offsets).toEqual([91, 107]); expect(result.displacementFromCenter).toBe(29);
    expect(offsets[1]! - offsets[0]!).toBe(input.minSeparation);
    for (const offset of offsets) {
      expect(offset).toBeGreaterThanOrEqual(input.minInset);
      expect(offset).toBeLessThanOrEqual(input.sideLength - input.minInset);
      for (const reservation of input.reservedOffsets) expect(Math.abs(offset - reservation)).toBeGreaterThanOrEqual(input.minSeparation);
    }
    // Independent exhaustive quarter-pixel scan: no nearer group can fit.
    for (let start = input.minInset; start <= input.sideLength - input.minInset - input.minSeparation; start += 0.25) {
      const group = [start, start + input.minSeparation];
      if (group.every(offset => input.reservedOffsets.every(reservation => Math.abs(offset - reservation) >= input.minSeparation))) {
        expect(Math.abs((group[0]! + group[1]!) / 2 - input.sideLength / 2)).toBeGreaterThanOrEqual(29);
      }
    }
    const reordered = allocatePortOffsets({ ...input, reservedOffsets: [...input.reservedOffsets].reverse() });
    expect(reordered).toEqual(result);
  });

  it("reports symmetric-group exhaustion even when disconnected free slots remain", () => {
    const result = allocatePortOffsets({ sideLength: 100, minInset: 12, minSeparation: 16,
      reservedOffsets: [34, 66], requestIds: ["a", "b"] });
    expect(result).toEqual({ status: "capacity_exhausted", requested: 2, availableSlots: 3, sideLength: 100 });
    // Independent interval check: the only free points are 12..18, 50, and82..88;
    // none contain two points at the required 16px pitch.
    for (let start = 12; start <= 72; start += 0.25) {
      expect([start, start + 16].every(offset => [34,66].every(reservation => Math.abs(offset - reservation) >= 16))).toBe(false);
    }
  });

  it("rejects malformed or duplicate requests instead of placing ports outside a node", () => {
    expect(allocatePortOffsets({ sideLength: 20, minInset: 12, minSeparation: 16, requestIds: ["a"] }).status)
      .toBe("capacity_exhausted");
    expect(allocatePortOffsets({ sideLength: 100, minInset: 12, minSeparation: 16, requestIds: ["a", "a"] }).status)
      .toBe("capacity_exhausted");
  });
});
