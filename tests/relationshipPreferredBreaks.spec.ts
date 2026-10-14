import { cloneEdgeLabelSpec } from "../src/renderer/staged/contracts.js";
import { describe, expect, it } from "vitest";
import { prepareRelationshipLabels, formatRelationshipLabels } from "../src/renderer/relationshipLabelFormatter.js";
import { createEdgeLabelMeasurementService } from "../src/renderer/staged/microLayout.js";

const presentation = {
  separator: " ", wrapping: "prefer_part_boundaries" as const,
  parts: [{ field: "first", template: "<{value}>", resolve_node_name: true },
  { field: "second", template: "({value})", resolve_node_name: false }], detail_display: { compact: true }
};
const measure = createEdgeLabelMeasurementService("default", []);
describe("generic preferred part wrapping", () => {
  it("copies preferred offsets without sharing them", () => {
    const label = { text: "one two", textStyleRole: "edge_label", preferredBreaks: [3] };
    const copied = cloneEdgeLabelSpec(label)!;
    copied.preferredBreaks![0] = 4;
    expect(label.preferredBreaks).toEqual([3]);
  });
  it("keeps a fitting complete label on one line", () => {
    const label = prepareRelationshipLabels([{ first: "one", second: "two" }], new Map(), presentation, "compact")[0]!;
    expect(measure({ ...label, textStyleRole: "edge_label" }, "short").lines).toEqual(["<one> (two)"]);
  });
  it("wraps oversized parts without losing characters or order", () => {
    const label = prepareRelationshipLabels([{ first: "A".repeat(70), second: "short" }], new Map(), presentation, "compact")[0]!;
    const wrapped = measure({ ...label, textStyleRole: "edge_label" }, "long");
    expect(wrapped.lines.join("").replace(/\s/g, "")).toBe(label.text.replace(/\s/g, ""));
    expect(wrapped.lines.at(-1)).toContain("(short)");
    expect(wrapped.lines.length).toBeGreaterThan(2);
  });
  it("preserves missing-part and duplicate name semantics in flattened legacy labels", () => {
    const sources = [{ first: "a", second: "present" }, { first: "b" }, { second: "only" }];
    const names = new Map([["a", "Shared"], ["b", "Shared"]]);
    const prepared = prepareRelationshipLabels(sources, names, presentation, "compact");
    expect(prepared.map(label => label?.text)).toEqual(formatRelationshipLabels(sources, names, presentation, "compact"));
    expect(prepared[0]!.text).toBe("<Shared (a)> (present)");
    expect(prepared[1]!.preferredBreaks).toEqual([]);
    expect(prepared[2]!.text).toBe("(only)");
  });
});
