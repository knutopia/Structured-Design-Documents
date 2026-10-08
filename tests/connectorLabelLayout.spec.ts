import { describe, expect, it } from "vitest";
import type { PositionedEdge, PositionedEdgeLabel, PositionedScene } from "../src/renderer/staged/contracts.js";
import {
  assessConnectorLabels, auditConnectorLabels, labelAssociatedWithSegment, measureConnectorLabelCapacity,
  type ConnectorLabelCapacityClaim, type ConnectorLabelCorridor
} from "../src/renderer/staged/connectorLabelLayout.js";
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
  it("audits missing labels without silently omitting measured text", () => {
    const s = scene([edge("a", undefined, undefined)]);
    s.edges[0]!.label = undefined;
    expect(auditConnectorLabels(input(s)).problems.map(p => p.kind)).toContain("missing");
    expect(assessConnectorLabels(input(s)).labels.get("a")!.lines).toEqual(measured.lines);
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
  it("returns no deficit when capacity suffices and preserves inputs", () => {
    const claims = [claim("a"), claim("b")], before = structuredClone(claims);
    expect(measureConnectorLabelCapacity([{ ...corridor, bounds: { ...corridor.bounds, width: 120 } }], claims, 16)).toEqual([]);
    expect(claims).toEqual(before);
    expect(measureConnectorLabelCapacity([corridor], claims, 16)).toEqual(measureConnectorLabelCapacity([corridor], [...claims].reverse(), 16));
  });
});
