import { describe, expect, it } from "vitest";
import { allocatePortOffsets } from "../src/renderer/staged/routingCore/portCapacity.js";

describe("shared bounded port capacity", () => {
  it("allocates centred side-bounded offsets in stable request order", () => {
    const result = allocatePortOffsets({ sideLength: 100, minInset: 12, minSeparation: 16,
      requestIds: ["first", "second"] });
    expect(result.status).toBe("allocated");
    if (result.status !== "allocated") return;
    expect([...result.offsets]).toEqual([["first", 44], ["second", 60]]);
  });

  it("leaves clearance around existing side ports and reports exhausted capacity", () => {
    const result = allocatePortOffsets({ sideLength: 100, minInset: 12, minSeparation: 16,
      reservedOffsets: [50], requestIds: ["first", "second", "third", "fourth", "fifth"] });
    expect(result).toEqual({ status: "capacity_exhausted", requested: 5, availableSlots: 3, sideLength: 100 });
  });

  it("rejects malformed or duplicate requests instead of placing ports outside a node", () => {
    expect(allocatePortOffsets({ sideLength: 20, minInset: 12, minSeparation: 16, requestIds: ["a"] }).status)
      .toBe("capacity_exhausted");
    expect(allocatePortOffsets({ sideLength: 100, minInset: 12, minSeparation: 16, requestIds: ["a", "a"] }).status)
      .toBe("capacity_exhausted");
  });
});
