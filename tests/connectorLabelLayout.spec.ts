import { describe, expect, it } from "vitest";
import type { PositionedEdge, PositionedEdgeLabel, PositionedScene } from "../src/renderer/staged/contracts.js";
import {
  assessConnectorLabels, auditConnectorLabels, labelAssociatedWithSegment, measureConnectorLabelCapacity,
  connectorLabelCapacityClaims, connectorLabelCapacityAnchors, measureConnectorLabelScopeDeficits, measureConnectorLabelMinimumScopeDeficits, measureConnectorLabelRelativeClearanceDeficits,
  type ConnectorLabelCapacityClaim, type ConnectorLabelCorridor
} from "../src/renderer/staged/connectorLabelLayout.js";
import { wrappedLabelPreservesText } from "../src/renderer/staged/connectorLabelLayout.js";
import { buildRouteSegmentDetails } from "../src/renderer/staged/connectorLabelPlacement.js";

const measured = { lines: ["label"], width: 40, height: 20, lineHeight: 20, textStyleRole: "edge_label" };
function edge(id = "a", points = [{ x: 20, y: 100 }, { x: 220, y: 100 }], label: PositionedEdgeLabel | undefined = { ...measured, x: 80, y: 90 }): PositionedEdge {
  return { id, role: "relationship", classes: [], paintGroup: "edges",
    from: { itemId: "source", ...points[0]! }, to: { itemId: "target", ...points.at(-1)! },
    route: { style: "orthogonal", points }, label };
}
function scene(edges = [edge()]): PositionedScene {
  return { viewId: "test", themeId: "default", diagnostics: [], decorations: [], edges,
    paintOrder: ["chrome", "nodes", "labels", "edges", "edge_labels"], root: {
      kind: "container", id: "root", role: "root", primitive: "root", classes: [], layout: { strategy: "manual" },
      chrome: { padding: { top: 0, right: 0, bottom: 0, left: 0 } }, headerContent: [], children: [], ports: [],
      x: 0, y: 0, width: 300, height: 300
    } };
}
const input = (s: PositionedScene) => ({ scene: s, expectedLabels: new Map([["a", measured]]) });

describe("shared connector label audit and placement", () => {
  it("retains valid labels and audits without consuming the search allowance", () => {
    const s = scene(), searchBudget = { candidates: 1 };
    expect(assessConnectorLabels({ ...input(s), searchBudget }).problems).toEqual([]);
    expect(searchBudget.candidates).toBe(1);
    auditConnectorLabels({ ...input(s), searchBudget });
    expect(searchBudget.candidates).toBe(1);
  });
  it("rejects a label beside one owning leg when another owning leg crosses its box", () => {
    const s = scene([edge("a", [{ x: 100, y: 20 }, { x: 100, y: 150 },
      { x: 220, y: 150 }, { x: 220, y: 20 }], { ...measured, x: 112, y: 130 })]);
    expect(auditConnectorLabels({ ...input(s), requireAdjacentLabels: true }).problems.map(problem => problem.kind)).toContain("detached");
    const placed = assessConnectorLabels({ ...input(s), requireAdjacentLabels: true });
    expect(placed.problems).toEqual([]);
    expect(placed.labels.get("a")!.y + measured.height).toBeLessThanOrEqual(138);
  });
  it("bounds aggregate label retries and prospective fallbacks without a minimum-one clamp", () => {
    const s = scene(), searchBudget = { candidates: 2 };
    s.root.chrome.headerBandHeight = 300;
    const options = { ...input(s), requireAdjacentLabels: true, searchBudget };
    const result = assessConnectorLabels(options);
    expect(searchBudget.candidates).toBe(0);
    expect(result.labels.get("a")).toEqual(s.edges[0]!.label);
    expect(assessConnectorLabels(options).labels.get("a")).toEqual(s.edges[0]!.label);
    expect(searchBudget.candidates).toBe(0);
  });

  it("preserves a measurable upper loop row instead of a fallback inside its own node", () => {
    const label = { ...measured, width: 155.676, height: 36 };
    const s = scene([edge("a", [{ x: 129, y: 130 }, { x: 129, y: 113 },
      { x: 152, y: 113 }, { x: 152, y: 130 }], { ...label, x: 0, y: 130 })]);
    s.root.chrome.headerBandHeight = 100;
    s.root.children.push({ kind: "node", id: "source", role: "node", primitive: "card", classes: [],
      x: 20, y: 130, width: 260, height: 100, widthBand: "standard",
      widthPolicy: { preferred: "standard", allowed: ["standard"] }, overflowPolicy: { kind: "grow_height" },
      overflow: { status: "fits" }, content: [], ports: [] });
    const result = assessConnectorLabels({ ...input(s), expectedLabels: new Map([["a", label]]),
      requireAdjacentLabels: true, adjacentProbeOnly: true, searchBudget: { candidates: 64 },
      scopeByConnectorId: new Map([["a", { x: 17, y: 117, width: 266, height: 166 }]]) });
    const box = result.labels.get("a")!;
    expect(box.y + box.height).toBe(101);
    expect(113 - box.y - box.height).toBe(12);
    expect(result.problems.map(problem => problem.kind)).toEqual(["bounds", "header"]);
  });


  it.each(["top", "bottom"] as const)("measures the selected long-label %s deficit and clears it by moving its owning route", side => {
    const label = { ...measured, width: 191.808, height: 120 };
    const scope = { x: 40, y: 24, width: 220, height: 250 };
    const ownY = side === "top" ? 110.5 : 187.5;
    const rivalY = ownY + (side === "top" ? 23 : -23);
    const s = scene([edge("a", [{ x: 20, y: ownY }, { x: 280, y: ownY }], { ...label, x: 54.096, y: 0 }),
      { ...edge("b", [{ x: 20, y: rivalY }, { x: 280, y: rivalY }]), label: undefined }]);
    const options = { ...input(s), expectedLabels: new Map([["a", label]]),
      requireAdjacentLabels: true, unrelatedRouteClearance: 24, rejectAmbiguousAssociation: true,
      scopeByConnectorId: new Map([["a", scope]]), eventBasedHorizontalSearch: true };
    const assessment = assessConnectorLabels(options);
    expect(assessment.problems.map(problem => problem.kind)).toEqual(["bounds"]);
    const deficits = measureConnectorLabelScopeDeficits(options, assessment);
    expect(deficits).toEqual([{ connectorId: "a", side, deficit: 45.5 }]);
    // Apply exactly the measured displacement to both tracks, leaving the scope
    // origin unchanged, as an owning container's padding reflow would do.
    for (const connector of s.edges) for (const point of connector.route.points) point.y += side === "top" ? 45.5 : -45.5;
    expect(assessConnectorLabels(options).problems).toEqual([]);
  });
  it("does not request scope expansion for a selected row also blocked by a rival", () => {
    const label = { ...measured, width: 191.808, height: 120 };
    const s = scene([edge("a", [{ x: 20, y: 110.5 }, { x: 280, y: 110.5 }], { ...label, x: 54.096, y: -21.5 }),
      { ...edge("b", [{ x: 20, y: 100 }, { x: 280, y: 100 }]), label: undefined }]);
    const options = { ...input(s), expectedLabels: new Map([["a", label]]), requireAdjacentLabels: true,
      unrelatedRouteClearance: 24, scopeByConnectorId: new Map([["a", { x: 40, y: 24, width: 220, height: 250 }]]) };
    expect(measureConnectorLabelScopeDeficits(options, auditConnectorLabels(options))).toEqual([]);
  });
  it("ranks complete adjacent-row alternatives with two probes instead of offset search", () => {
    const label = { ...measured, height: 36 };
    const score = (rivalY: number) => {
      const s = scene([edge("a", [{ x: 20, y: 158.5 }, { x: 280, y: 158.5 }], { ...label, x: 130, y: 148 }),
        { ...edge("rival", [{ x: 20, y: rivalY }, { x: 280, y: rivalY }]), label: undefined },
        { ...edge("lower", [{ x: 20, y: 194 }, { x: 280, y: 194 }]), label: undefined }]);
      const searchBudget = { candidates: 8 };
      const options = { ...input(s), expectedLabels: new Map([["a", label]]), searchBudget,
        requireAdjacentLabels: true, adjacentProbeOnly: true, unrelatedRouteClearance: 24,
        rejectAmbiguousAssociation: true, scopeByConnectorId: new Map([["a", { x: 40, y: 24, width: 220, height: 250 }]]) };
      const result = assessConnectorLabels(options);
      expect(searchBudget.candidates).toBe(6);
      expect(result.labels.get("a")!.y).toBe(110.5);
      return { result, options };
    };
    // The first rival is13.5px above the upper text box; the second is29.5px.
    const blocked = score(97), clear = score(81);
    expect(blocked.result.problems.map(problem => problem.kind)).toContain("connector");
    expect(clear.result.problems).toEqual([]);
    const emitted = { ...clear.options.scene, edges: clear.options.scene.edges.map(connector => ({ ...connector,
      label: clear.result.labels.get(connector.id) ?? connector.label })) };
    expect(auditConnectorLabels({ ...clear.options, scene: emitted }).problems).toEqual([]);
    // The probe flag does not alter final full assessment or its audit criteria.
    expect(assessConnectorLabels({ ...clear.options, scene: emitted, adjacentProbeOnly: false }).problems).toEqual([]);
  });
  it.each(["horizontal", "vertical"] as const)("skips exhaustive %s offsets only when full-scope rivals block both adjacent rows", orientation => {
    const transpose = (point: { x: number; y: number }) => orientation === "horizontal" ? point : { x: point.y, y: point.x };
    const label = orientation === "horizontal" ? { ...measured, width: 155, height: 36 }
      : { ...measured, width: 36, height: 155 };
    const s = scene([edge("a", [transpose({ x: 20, y: 129 }), transpose({ x: 280, y: 129 })]),
      { ...edge("upper", [transpose({ x: 20, y: 105 }), transpose({ x: 280, y: 105 })]), label: undefined },
      { ...edge("lower", [transpose({ x: 20, y: 153 }), transpose({ x: 280, y: 153 })]), label: undefined }]);
    const searchBudget = { candidates: 128 };
    const bounds = orientation === "horizontal" ? { x: 40, y: 24, width: 220, height: 250 }
      : { x: 24, y: 40, width: 250, height: 220 };
    const options = { ...input(s), expectedLabels: new Map([["a", label]]), searchBudget,
      requireAdjacentLabels: true, unrelatedRouteClearance: 24,
      scopeByConnectorId: new Map([["a", bounds]]), eventBasedHorizontalSearch: true };
    const result = assessConnectorLabels(options);
    expect(searchBudget.candidates).toBe(126);
    expect(result.problems.map(problem => problem.kind)).toContain("connector");
    // A partial lower rival cannot prove impossibility; preserve local search.
    s.edges[2]!.route.points = [transpose({ x: 20, y: 153 }), transpose({ x: 70, y: 153 })];
    const partial = assessConnectorLabels(options);
    expect(searchBudget.candidates).toBeLessThanOrEqual(124);
    if (orientation === "vertical") expect(partial.labels.get("a")!.y).toBe(94);
    expect(partial.problems).toEqual([]);
  });
  it("measures minimum scoped text dimensions without placement or allowance consumption", () => {
    const s = scene(), searchBudget = { candidates: 0 };
    const expectedLabels = new Map([["a", { ...measured, width: 155.676, height: 36 }],
      ["b", { ...measured, width: 170.988, height: 36 }], ["c", { ...measured, width: 90, height: 80 }]]);
    const scope = { x: 0, y: 0, width: 48, height: 60 };
    const options = { scene: s, expectedLabels, searchBudget,
      scopeByConnectorId: new Map([...expectedLabels.keys()].map(id => [id, scope])) };
    const deficits = measureConnectorLabelMinimumScopeDeficits(options);
    expect(deficits).toEqual([{ connectorId: "a", axis: "x", deficit: 107.676 },
      { connectorId: "b", axis: "x", deficit: 122.988 }, { connectorId: "c", axis: "x", deficit: 42 },
      { connectorId: "c", axis: "y", deficit: 20 }]);
    // One physical gutter needs the maximum width deficit, not their sum.
    const widthIncrement = Math.max(...deficits.filter(d => d.axis === "x").map(d => d.deficit));
    expect(widthIncrement).toBe(122.988);
    expect(scope.width + widthIncrement).toBe(170.988);
    expect(searchBudget.candidates).toBe(0);
    const expanded = { ...scope, width: 170.988, height: 80 };
    expect(measureConnectorLabelMinimumScopeDeficits({ ...options,
      scopeByConnectorId: new Map([...expectedLabels.keys()].map(id => [id, expanded])) })).toEqual([]);
  });
  it("does not invent minimum capacity for malformed nonfinite dimensions", () => {
    const s = scene();
    expect(measureConnectorLabelMinimumScopeDeficits({ ...input(s), expectedLabels: new Map([["a", { ...measured, width: Infinity }]]) })).toEqual([]);
    expect(measureConnectorLabelMinimumScopeDeficits({ ...input(s),
      scopeByConnectorId: new Map([["a", { x: 0, y: 0, width: NaN, height: 100 }]]) })).toEqual([]);
  });
  it("charges only the selected new connector while auditing retained invalid old labels", () => {
    const s = scene([
      edge("old-a", [{ x: 20, y: 100 }, { x: 280, y: 100 }], { ...measured, x: 80, y: 112 }),
      edge("old-b", [{ x: 20, y: 220 }, { x: 280, y: 220 }], { ...measured, x: 80, y: 232 }),
      edge("new", [{ x: 20, y: 130 }, { x: 280, y: 130 }], { ...measured, x: 80, y: 120 })
    ]);
    const searchBudget = { candidates: 16 };
    const options = { scene: s, expectedLabels: new Map(s.edges.map(connector => [connector.id, measured])),
      requireAdjacentLabels: true, unrelatedRouteClearance: 24, rejectAmbiguousAssociation: true,
      adjacentProbeOnly: true, searchBudget, searchConnectorIds: new Set(["new"]) };
    const partial = assessConnectorLabels(options);
    expect(searchBudget.candidates).toBe(14);
    expect(partial.labels.get("old-a")).toBe(s.edges[0]!.label);
    expect(partial.labels.get("old-b")).toBe(s.edges[1]!.label);
    expect(partial.problems).toContainEqual({ connectorId: "old-a", kind: "connector", obstacleId: "new" });
    expect(partial.labels.get("new")!.y).toBe(142);
    // Final assessment has no search restriction: it may move an old label
    // displaced by the new route, and must independently clear all conflicts.
    const full = assessConnectorLabels({ ...options, searchConnectorIds: undefined, adjacentProbeOnly: false,
      searchBudget: { candidates: 64 } });
    expect(full.problems).toEqual([]);
    expect(full.labels.get("old-a")!.y).toBe(68);
    expect(full.labels.get("old-a")).not.toBe(s.edges[0]!.label);
  });
  it.each(["horizontal", "vertical"] as const)("measures exact displacement from a constrained parallel %s track", orientation => {
    const transpose = (point: { x: number; y: number }) => orientation === "horizontal" ? point : { x: point.y, y: point.x };
    const label = orientation === "horizontal" ? { ...measured, height: 36 } : { ...measured, width: 36, height: 40 };
    const placed = orientation === "horizontal" ? { ...label, x: 80, y: 87.5 } : { ...label, x: 87.5, y: 80 };
    const s = scene([edge("a", [transpose({ x: 20, y: 135.5 }), transpose({ x: 280, y: 135.5 })], placed)]);
    const scope = orientation === "horizontal" ? { x: 40, y: 24, width: 220, height: 250 }
      : { x: 24, y: 40, width: 250, height: 220 };
    const options = { ...input(s), expectedLabels: new Map([["a", label]]), requireAdjacentLabels: true,
      unrelatedRouteClearance: 24, scopeByConnectorId: new Map([["a", scope]]) };
    const constrained = buildRouteSegmentDetails({ style: "orthogonal",
      points: [transpose({ x: 20, y: 81 }), transpose({ x: 280, y: 81 })] });
    const tracks = new Map([["other", constrained]]);
    const axis = orientation === "horizontal" ? "y" : "x";
    expect(measureConnectorLabelRelativeClearanceDeficits(options, auditConnectorLabels(options), tracks))
      .toEqual([{ connectorId: "a", otherConnectorId: "other", axis, direction: 1, deficit: 17.5 }]);
    placed[axis] += 17.5;
    for (const point of s.edges[0]!.route.points) point[axis] += 17.5;
    expect(measureConnectorLabelRelativeClearanceDeficits(options, auditConnectorLabels(options), tracks)).toEqual([]);
    // Partial coverage permits along-axis escape and cannot establish a demand.
    placed[axis] -= 17.5;
    for (const point of s.edges[0]!.route.points) point[axis] -= 17.5;
    const partial = buildRouteSegmentDetails({ style: "orthogonal",
      points: [transpose({ x: 60, y: 81 }), transpose({ x: 180, y: 81 })] });
    expect(measureConnectorLabelRelativeClearanceDeficits(options, auditConnectorLabels(options), new Map([["other", partial]]))).toEqual([]);
  });
  it("measures negative displacement when the selected box is above a constrained rival", () => {
    const label = { ...measured, height: 36 };
    const s = scene([edge("a", undefined, { ...label, x: 80, y: 112 })]);
    const options = { ...input(s), expectedLabels: new Map([["a", label]]), requireAdjacentLabels: true,
      unrelatedRouteClearance: 24, scopeByConnectorId: new Map([["a", { x: 40, y: 24, width: 180, height: 250 }]]) };
    const track = buildRouteSegmentDetails({ style: "orthogonal", points: [{ x: 20, y: 154.5 }, { x: 280, y: 154.5 }] });
    expect(measureConnectorLabelRelativeClearanceDeficits(options, auditConnectorLabels(options), new Map([["other", track]])))
      .toEqual([{ connectorId: "a", otherConnectorId: "other", axis: "y", direction: -1, deficit: 17.5 }]);
  });
  it("does not invent a displacement direction for text crossing a constrained track", () => {
    const s = scene();
    const options = { ...input(s), unrelatedRouteClearance: 24 };
    const track = buildRouteSegmentDetails({ style: "orthogonal", points: [{ x: 0, y: 100 }, { x: 300, y: 100 }] });
    expect(measureConnectorLabelRelativeClearanceDeficits(options, auditConnectorLabels(options), new Map([["other", track]]))).toEqual([]);
  });
  it.each([false, true])("retains a clearance-event prospective stem row despite narrow X scope (probe=%s)", adjacentProbeOnly => {
    const label = { ...measured, width: 155.676, height: 36 };
    const s = scene([edge("a", [{ x: 747.988, y: 129 }, { x: 747.988, y: 258 }], { ...label, x: 759.988, y: 185.5 }),
      { ...edge("rival", [{ x: 700, y: 195 }, { x: 965, y: 195 }]), label: undefined }]);
    s.root.width = 1000; s.root.height = 400;
    s.root.children.push({ kind: "node", id: "left", role: "node", primitive: "card", classes: [],
      x: 600, y: 100, width: 147.988, height: 200, widthBand: "standard",
      widthPolicy: { preferred: "standard", allowed: ["standard"] }, overflowPolicy: { kind: "grow_height" },
      overflow: { status: "fits" }, content: [], ports: [] });
    const searchBudget = { candidates: 32 };
    const options = { ...input(s), expectedLabels: new Map([["a", label]]), requireAdjacentLabels: true,
      unrelatedRouteClearance: 24, rejectAmbiguousAssociation: true, adjacentProbeOnly, searchBudget,
      scopeByConnectorId: new Map([["a", { x: 680, y: 24, width: 120, height: 359 }]]) };
    const result = assessConnectorLabels(options);
    const placed = result.labels.get("a")!;
    expect(placed.x).toBe(759.988);
    expect(placed.y).toBe(219);
    expect(placed.y - 195).toBe(24);
    expect(placed.x - 747.988).toBeCloseTo(12);
    expect(result.problems.map(problem => problem.kind)).toEqual(["bounds"]);
    expect(measureConnectorLabelScopeDeficits(options, result)).toEqual([{ connectorId: "a", side: "right", deficit: 115.664 }]);
    expect(searchBudget.candidates).toBeGreaterThanOrEqual(18);
    expect(searchBudget.candidates).toBeLessThan(30);
    expect(result.anchorByConnectorId.get("a")!.orientation).toBe("vertical");
    const partialBudget = { candidates: 32 };
    const partial = assessConnectorLabels({ ...options, adjacentProbeOnly: true,
      prospectiveOffsetEvents: false, searchBudget: partialBudget });
    // Partial scoring reserves the offset-event work for a complete scene.
    // It still audits its unresolved box; it cannot claim final acceptance.
    expect(partialBudget.candidates).toBe(30);
    expect(partial.problems.some(problem => problem.kind !== "bounds")).toBe(true);
  });
  it("skips actual placement when the scoped height cannot fit measured text", () => {
    const s = scene(), searchBudget = { candidates: 8 };
    const result = assessConnectorLabels({ ...input(s), searchBudget, requireAdjacentLabels: true,
      scopeByConnectorId: new Map([["a", { x: 0, y: 95, width: 300, height: 10 }]]) });
    expect(searchBudget.candidates).toBe(6);
    expect(result.problems.map(problem => problem.kind)).toContain("bounds");
    expect(result.labels.get("a")!.lines).toEqual(measured.lines);
  });
  it("audits source text across word and token wrapping without hiding changed characters", () => {
    expect(wrappedLabelPreservesText(["[Open", "workspace]", "{workspace", "selected}"], "[Open workspace] {workspace selected}")).toBe(true);
    expect(wrappedLabelPreservesText(["[LongToken", "WithoutSpaces]"], "[LongTokenWithoutSpaces]")).toBe(true);
    expect(wrappedLabelPreservesText(["[LongToken", "WrongSpaces]"], "[LongTokenWithoutSpaces]")).toBe(false);
    expect(wrappedLabelPreservesText(["{workspaceselected}"], "{workspace selected}")).toBe(false);
    expect(wrappedLabelPreservesText(["[Open…]"], "[Open workspace]")).toBe(false);
  });
  it.each(["horizontal", "vertical"] as const)("requires distance and projected overlap on a %s segment", orientation => {
    const points = orientation === "horizontal" ? [{ x: 0, y: 100 }, { x: 100, y: 100 }]
      : [{ x: 100, y: 0 }, { x: 100, y: 100 }];
    const segment = buildRouteSegmentDetails({ style: "orthogonal", points })[0]!;
    const label = orientation === "horizontal" ? { x: 20, y: 112, width: 40, height: 20 }
      : { x: 112, y: 20, width: 40, height: 20 };
    expect(labelAssociatedWithSegment(label, segment)).toBe(true);
    expect(labelAssociatedWithSegment({ ...label, [orientation === "horizontal" ? "y" : "x"]: 114 }, segment)).toBe(false);
    expect(labelAssociatedWithSegment({ ...label, [orientation === "horizontal" ? "x" : "y"]: 99 }, segment)).toBe(false);
  });
  it("ignores zero-length segments and accepts short segments using their actual span", () => {
    const segment = buildRouteSegmentDetails({ style: "orthogonal", points: [{ x: 20, y: 100 }, { x: 24, y: 100 }] })[0]!;
    expect(labelAssociatedWithSegment({ ...measured, x: 10, y: 90 }, segment)).toBe(true);
    expect(labelAssociatedWithSegment({ ...measured, x: 10, y: 90 }, { ...segment, end: segment.start })).toBe(false);
  });
  it("retains already valid labels and does not mutate scene input", () => {
    const s = scene(), before = structuredClone(s);
    const assessment = assessConnectorLabels(input(s));
    expect(assessment.labels.get("a")).toBe(s.edges[0]!.label);
    expect(assessment.problems).toEqual([]);
    expect(s).toEqual(before);
  });
  it("finds an associated adjacent segment when a midpoint is obstructed", () => {
    const s = scene([edge("a", [{ x: 20, y: 60 }, { x: 200, y: 60 }, { x: 200, y: 220 }, { x: 220, y: 220 }],
      { ...measured, x: 240, y: 140 })]);
    const assessment = assessConnectorLabels({ ...input(s), scopeByConnectorId: new Map([["a", { x: 0, y: 0, width: 180, height: 300 }]]) });
    expect(assessment.problems).toEqual([]);
    expect(assessment.anchorByConnectorId.get("a")!.orientation).toBe("horizontal");
  });
  it("uses exact segment events when a short self-loop has a narrow legal label interval", () => {
    const label = { ...measured, width: 155.676, height: 36 };
    const s = scene([edge("a", [{ x: 32, y: 188 }, { x: 52, y: 188 }], { ...label, x: -25.838, y: 194 })]);
    const options = { scene: s, expectedLabels: new Map([["a", label]]),
      scopeByConnectorId: new Map([["a", { x: 24, y: 24, width: 256, height: 260 }]]) };
    const accepted = assessConnectorLabels({ ...options, eventBasedHorizontalSearch: true });
    expect(accepted.problems).toEqual([]);
    expect(accepted.labels.get("a")!.x).toBe(32);
    expect(auditConnectorLabels({ ...options, scene: { ...s, edges: [{ ...s.edges[0]!, label: accepted.labels.get("a") }] } }).problems).toEqual([]);
  });
  it.each(["horizontal", "vertical"] as const)("moves labels off their own %s stroke only when opted in", orientation => {
    const points = orientation === "horizontal" ? [{ x: 20, y: 100 }, { x: 220, y: 100 }]
      : [{ x: 100, y: 20 }, { x: 100, y: 220 }];
    const s = scene([edge("a", points)]);
    const options = { ...input(s), requireAdjacentLabels: true, unrelatedRouteClearance: 24, rejectAmbiguousAssociation: true };
    expect(auditConnectorLabels(options).problems.map(p => p.kind)).toContain("detached");
    const result = assessConnectorLabels(options);
    expect(result.problems).toEqual([]);
    const box = result.labels.get("a")!;
    // Independent axis distance to the line, using its actual finite overlap.
    const coordinate = orientation === "horizontal" ? box.y : box.x;
    const extent = orientation === "horizontal" ? box.height : box.width;
    expect(Math.max(coordinate - 100, 100 - coordinate - extent, 0)).toBe(12);
    expect(box.lines).toEqual(measured.lines);
  });
  it("audits all competing segments at 24px, including a nearby segment endpoint", () => {
    const s = scene([edge("a", undefined, { ...measured, x: 80, y: 112 }),
      { ...edge("b", [{ x: 130, y: 120 }, { x: 200, y: 120 }]), label: undefined }]);
    expect(auditConnectorLabels(input(s)).problems).toEqual([]);
    const options = { ...input(s), requireAdjacentLabels: true, unrelatedRouteClearance: 24 };
    expect(auditConnectorLabels(options).problems).toContainEqual({ connectorId: "a", kind: "connector", obstacleId: "b" });
    const result = assessConnectorLabels(options);
    expect(result.problems).toEqual([]);
    const box = result.labels.get("a")!;
    const dx = Math.max(130 - box.x - box.width, box.x - 200, 0);
    const dy = Math.max(120 - box.y - box.height, box.y - 120, 0);
    expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(23.5);
  });
  it("requires own-route association to beat a nearby competing endpoint", () => {
    const s = scene([edge("a", undefined, { ...measured, x: 80, y: 112 }),
      { ...edge("b", [{ x: 130, y: 120 }, { x: 160, y: 120 }]), label: undefined }]);
    // The rival endpoint is 10px from the box; own route is 12px away.
    expect(auditConnectorLabels({ ...input(s), rejectAmbiguousAssociation: true }).problems).toEqual([]);
    expect(auditConnectorLabels({ ...input(s), requireAdjacentLabels: true, rejectAmbiguousAssociation: true }).problems)
      .toContainEqual({ connectorId: "a", kind: "ambiguous", obstacleId: "b" });
  });
  it("finds the exact scoped gutter boundary without a grid-sized expansion", () => {
    const s = scene([edge("a", [{ x: 20, y: 100 }, { x: 220, y: 100 }])]);
    const options = { ...input(s), requireAdjacentLabels: true, eventBasedHorizontalSearch: true,
      scopeByConnectorId: new Map([["a", { x: 137, y: 50, width: 40, height: 140 }]]) };
    const result = assessConnectorLabels(options);
    expect(result.problems).toEqual([]);
    expect(result.labels.get("a")!.x).toBe(137);
    expect(result.labels.get("a")!.y).toBe(68);
  });
  it("audits missing labels without silently omitting measured text", () => {
    const s = scene([edge("a", undefined, undefined)]);
    s.edges[0]!.label = undefined;
    expect(auditConnectorLabels(input(s)).problems.map(p => p.kind)).toContain("missing");
    expect(assessConnectorLabels(input(s)).labels.get("a")!.lines).toEqual(measured.lines);
  });
  it("rejects equal or closer competing associations even when neither route intersects the label", () => {
    const label = { ...measured, x: 80, y: 108 };
    const s = scene([edge("a", [{ x: 20, y: 100 }, { x: 220, y: 100 }], label),
      edge("b", [{ x: 20, y: 136 }, { x: 220, y: 136 }])]);
    s.edges[1]!.label = undefined;
    const strict = { ...input(s), rejectAmbiguousAssociation: true };
    expect(auditConnectorLabels(input(s)).problems).toEqual([]);
    expect(auditConnectorLabels(strict).problems).toContainEqual({ connectorId: "a", kind: "ambiguous", obstacleId: "b" });
    expect(assessConnectorLabels(strict).problems).toEqual([]);
    expect(assessConnectorLabels(strict).labels.get("a")).not.toEqual(label);
  });
  it("accepts a uniquely closer route and ignores nearby routes without projected overlap", () => {
    const s = scene([edge("a", [{ x: 20, y: 100 }, { x: 220, y: 100 }], { ...measured, x: 80, y: 104 }),
      edge("b", [{ x: 20, y: 136 }, { x: 220, y: 136 }]),
      edge("c", [{ x: 200, y: 102 }, { x: 220, y: 102 }])]);
    s.edges[1]!.label = undefined; s.edges[2]!.label = undefined;
    expect(auditConnectorLabels({ ...input(s), rejectAmbiguousAssociation: true }).problems).toEqual([]);
  });
  it("audits other connectors and markers, while allowing the label's own route", () => {
    expect(auditConnectorLabels(input(scene())).problems).toEqual([]);
    const s = scene([edge(), { ...edge("b", [{ x: 110, y: 20 }, { x: 110, y: 160 }]), label: undefined }]);
    expect(auditConnectorLabels(input(s)).problems.map(p => p.kind)).toContain("connector");
    s.edges[1]!.route.points = [{ x: 100, y: 20 }, { x: 100, y: 100 }]; s.edges[1]!.markers = { end: "arrow" };
    expect(auditConnectorLabels(input(s)).problems.map(p => p.kind)).toContain("marker");
  });
  it("checks label clearance, actual headers, separators and adapter bounds", () => {
    const s = scene([edge(), edge("b", undefined, { ...measured, x: 125, y: 90 })]);
    s.root.chrome.headerBandHeight = 95;
    s.root.children.push({ kind: "node", id: "obstacle", role: "node", primitive: "card", classes: [],
      x: 100, y: 90, width: 40, height: 20, widthBand: "standard",
      widthPolicy: { preferred: "standard", allowed: ["standard"] }, overflowPolicy: { kind: "grow_height" },
      overflow: { status: "fits" }, content: [], ports: [] });
    const assessment = auditConnectorLabels({ ...input(s),
      scopeByConnectorId: new Map([["a", { x: 0, y: 0, width: 90, height: 300 }]]),
      separators: [{ coordinate: 100, spanStart: 0, spanEnd: 300 }] });
    expect(assessment.problems.map(p => p.kind)).toEqual(expect.arrayContaining(["node", "header", "bounds", "label", "separator"]));
  });
  it("keeps a degraded label when all associated positions are blocked", () => {
    const s = scene(); s.root.chrome.headerBandHeight = 300;
    const result = assessConnectorLabels(input(s));
    expect(result.labels.get("a")).toEqual(s.edges[0]!.label);
    expect(result.problems.map(p => p.kind)).toContain("header");
  });
  it("repositions reversed and vertical routes using their actual segments", () => {
    for (const points of [[{ x: 220, y: 100 }, { x: 20, y: 100 }], [{ x: 100, y: 20 }, { x: 100, y: 220 }]]) {
      const s = scene([edge("a", points, { ...measured, x: 240, y: 240 })]);
      expect(assessConnectorLabels(input(s)).problems).toEqual([]);
    }
  });
});

describe("shared measured label capacity", () => {
  const corridor: ConnectorLabelCorridor = { owner: "opaque", axis: "x", bounds: { x: 0, y: 0, width: 50, height: 300 },
    connectorIds: ["a", "b"], margin: 12 };
  const claim = (connectorId: string, spanStart = 0, spanEnd = 100, thickness = 40): ConnectorLabelCapacityClaim =>
    ({ owner: "opaque", connectorId, priority: connectorId === "a" ? 0 : 1, spanStart, spanEnd, thickness });
  it.each(["x", "y"] as const)("measures simultaneous claims on the %s axis", axis => {
    const region = { ...corridor, axis, bounds: { ...corridor.bounds, height: 50 } };
    const [result] = measureConnectorLabelCapacity([region], [claim("a"), claim("b")], 16);
    expect(result).toEqual({ owner: "opaque", axis, availableSize: 50, requiredSize: 120, connectorIds: ["a", "b"] });
  });
  it("reuses tracks across disjoint spans", () => {
    expect(measureConnectorLabelCapacity([corridor], [claim("a", 0, 100), claim("b", 100, 200)], 16)[0]!.requiredSize).toBe(64);
  });
  it("combines a label and its supporting route once and merges duplicate boundary requirements", () => {
    const result = measureConnectorLabelCapacity([corridor, corridor], [claim("a"), claim("a", 0, 100, 0)], 16);
    expect(result).toHaveLength(1);
    expect(result[0]!.requiredSize).toBe(64);
  });
  it("uses selected anchors and disjoint label rows for adjacent-label horizontal capacity", () => {
    const s = scene([edge("a", [{ x: 20, y: 60 }, { x: 200, y: 60 }], { ...measured, x: 70, y: 72 }),
      edge("b", [{ x: 20, y: 200 }, { x: 200, y: 200 }], { ...measured, width: 70, x: 60, y: 212 })]);
    const options = { scene: s, expectedLabels: new Map([["a", measured], ["b", { ...measured, width: 70 }]]),
      requireAdjacentLabels: true };
    const assessment = auditConnectorLabels(options);
    const unresolved = { ...assessment, problems: [{ connectorId: "a", kind: "bounds" as const }] };
    const region = { ...corridor, bounds: { x: 140, y: 0, width: 50, height: 300 } };
    const claims = connectorLabelCapacityClaims(options, unresolved, [region]);
    expect(measureConnectorLabelCapacity([region], claims, 16)[0]!.requiredSize).toBe(94);
    const selected = buildRouteSegmentDetails(s.edges[0]!.route)[0]!;
    expect(connectorLabelCapacityAnchors({ ...options, preferredAnchorByConnectorId: new Map([["a", selected]]) }, unresolved).get("a")).toBe(selected);
  });
  it("reserves maximum width for prospective above/below rows in a narrow gutter", () => {
    const labels = [{ ...measured, width: 155.676, height: 36 }, { ...measured, width: 138.988, height: 36 }];
    const s = scene([edge("a", [{ x: 20, y: 130 }, { x: 280, y: 130 }], { ...labels[0]!, x: 80, y: 120 }),
      edge("b", [{ x: 20, y: 146 }, { x: 280, y: 146 }], { ...labels[1]!, x: 80, y: 120 })]);
    const gutter = { x: 126, y: 40, width: 48, height: 220 };
    const options = { scene: s, expectedLabels: new Map([["a", labels[0]!], ["b", labels[1]!]]),
      requireAdjacentLabels: true, unrelatedRouteClearance: 24, rejectAmbiguousAssociation: true,
      eventBasedHorizontalSearch: true, scopeByConnectorId: new Map([["a", gutter], ["b", gutter]]) };
    const searchBudget = { candidates: 64 };
    const result = assessConnectorLabels({ ...options, searchBudget });
    // Exactly two prospective side rows per connector; impossible scoped
    // placement never enumerates the horizontal offset grid.
    expect(searchBudget.candidates).toBe(60);
    expect(result.problems.some(p => p.kind === "bounds")).toBe(true);
    const first = result.labels.get("a")!, second = result.labels.get("b")!;
    expect(first.y + first.height).toBe(118);
    expect(second.y).toBe(158);
    // Independent row test: the text envelopes and their 12px margins do not overlap.
    expect(first.y + first.height + 12).toBeLessThanOrEqual(second.y - 12);
    const region = { owner: "gap", axis: "x" as const, bounds: gutter, connectorIds: ["a", "b"], margin: 12 };
    const claims = connectorLabelCapacityClaims(options, result, [region]);
    const demand = measureConnectorLabelCapacity([region], claims, 16)[0]!;
    expect(demand.requiredSize).toBe(179.676);
    const wider = { ...gutter, x: 48, width: demand.requiredSize };
    const fitted = assessConnectorLabels({ ...options, searchBudget, scopeByConnectorId: new Map([["a", wider], ["b", wider]]) });
    expect(fitted.problems).toEqual([]);
    expect(searchBudget.candidates).toBeGreaterThanOrEqual(52);
  });
  it.each(["x", "y"] as const)("does not grow the %s axis for a label trapped between full-gutter parallel rivals", axis => {
    const transpose = (point: { x: number; y: number }) => axis === "x" ? point : { x: point.y, y: point.x };
    const label = axis === "x" ? { ...measured, width: 155.676, height: 36 } : { ...measured, width: 36, height: 155.676 };
    const second = axis === "x" ? { ...label, width: 170.988 } : { ...label, height: 170.988 };
    const s = scene([edge("a", [transpose({ x: 20, y: 105 }), transpose({ x: 280, y: 105 })]),
      edge("b", [transpose({ x: 20, y: 129 }), transpose({ x: 280, y: 129 })]),
      { ...edge("return", [transpose({ x: 20, y: 153 }), transpose({ x: 280, y: 153 })]), label: undefined }]);
    const bounds = axis === "x" ? { x: 126, y: 20, width: 48, height: 260 } : { x: 20, y: 126, width: 260, height: 48 };
    const options = { scene: s, expectedLabels: new Map([["a", label], ["b", second]]),
      requireAdjacentLabels: true, unrelatedRouteClearance: 24, rejectAmbiguousAssociation: true,
      scopeByConnectorId: new Map([["a", bounds], ["b", bounds]]) };
    const corridor = { owner: "gap", axis, bounds, connectorIds: ["a", "b"], margin: 12 };
    const claims = connectorLabelCapacityClaims(options, assessConnectorLabels(options), [corridor]);
    // Above b occupies81..117 and hits a at105; below occupies141..177
    // and hits the return at153. Increasing the crossing-axis size cannot fix either.
    expect(claims.find(claim => claim.connectorId === "b")!.thickness).toBe(0);
    const topWidth = axis === "x" ? label.width : label.height + 24;
    expect(measureConnectorLabelCapacity([corridor], claims, 16)[0]!.requiredSize).toBe(topWidth + 24);
    // A rival covering only part of the gap can become avoidable after an
    // expansion; it must not suppress the label's capacity claim.
    s.edges[2]!.route.points = [transpose({ x: 150, y: 153 }), transpose({ x: 170, y: 153 })];
    const partialClaims = connectorLabelCapacityClaims(options, assessConnectorLabels(options), [corridor]);
    expect(partialClaims.find(claim => claim.connectorId === "b")!.thickness).toBeGreaterThan(0);
    s.edges[2]!.route.points = [transpose({ x: 20, y: 250 }), transpose({ x: 280, y: 250 })];
    const alternative = assessConnectorLabels(options);
    const alternativeClaims = connectorLabelCapacityClaims(options, alternative, [corridor]);
    expect(alternativeClaims.find(claim => claim.connectorId === "b")!.thickness).toBeGreaterThan(0);
    expect(alternative.labels.get("a")![axis === "x" ? "y" : "x"] + 36 + 12)
      .toBeLessThanOrEqual(alternative.labels.get("b")![axis === "x" ? "y" : "x"] - 12);
  });
  it("keeps unresolved capacity on a scoped anchor instead of the longest external segment", () => {
    const s = scene([edge("a", [{ x: 20, y: 60 }, { x: 200, y: 60 }, { x: 200, y: 280 }],
      { ...measured, x: 80, y: 72 })]);
    const options = { ...input(s), requireAdjacentLabels: true,
      scopeByConnectorId: new Map([["a", { x: 50, y: 30, width: 100, height: 100 }]]) };
    const assessment = { ...auditConnectorLabels(options), problems: [{ connectorId: "a", kind: "bounds" as const }] };
    expect(connectorLabelCapacityAnchors(options, assessment).get("a")!.routeSegmentIndex).toBe(0);
  });
  it("returns no deficit when capacity suffices and preserves inputs", () => {
    const claims = [claim("a"), claim("b")], before = structuredClone(claims);
    expect(measureConnectorLabelCapacity([{ ...corridor, bounds: { ...corridor.bounds, width: 120 } }], claims, 16)).toEqual([]);
    expect(claims).toEqual(before);
    expect(measureConnectorLabelCapacity([corridor], claims, 16)).toEqual(measureConnectorLabelCapacity([corridor], [...claims].reverse(), 16));
  });
});
