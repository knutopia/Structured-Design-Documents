import { expect, it } from "vitest";
import type { PositionedScene } from "../src/renderer/staged/contracts.js";
import { createForwardRoutingWitness, auditForwardRoutingWitness, translateForwardRoutingWitness } from "../src/renderer/staged/routingCore/forwardWitness.js";
import { selectRoutingQuality } from "../src/renderer/staged/routingCore/qualitySelection.js";
import type { FinalRoutingContext } from "../src/renderer/staged/routingCore/lifecycle.js";
function context(points: { x: number; y: number }[]): FinalRoutingContext {
  return {
    bounds: { minX: 0, minY: 0, maxX: 200, maxY: 200 }, boxes: [], connectors: [{
      id: "edge", priority: 0,
      source: { nodeId: "a", side: "south", point: points[0]!, minLeg: 1 }, target: { nodeId: "b", side: "west", point: points.at(-1)!, minLeg: 1 }, route: { style: "orthogonal", points }
    }]
  };
}
function scene(): PositionedScene {
  return {
    viewId: "test", detailId: "compact", themeId: "default",
    root: { kind: "container", id: "root", role: "root", primitive: "root", classes: [],
      layout: { strategy: "manual" }, chrome: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
      headerContent: [], children: [], ports: [], x: 0, y: 0, width: 200, height: 200 },
    edges: [{ id: "edge", role: "navigation", classes: [], from: { itemId: "a", x: 10, y: 10 }, to: { itemId: "b", x: 100, y: 100 }, route: { style: "orthogonal", points: [{ x: 10, y: 10 }, { x: 10, y: 50 }, { x: 5, y: 50 }, { x: 5, y: 100 }, { x: 100, y: 100 }] }, paintGroup: "edges", markers: { end: "arrow" } }],
    decorations: [], diagnostics: [], paintOrder: []
  };
}
it("retains a frozen finite baseline, independently checks acceptance and invalidates geometry/marker changes", () => {
  const baseline = scene(); baseline.routingEvidence = { candidates: 12, repairs: 0, revisions: [] };
  const witness = createForwardRoutingWitness(baseline, ["edge"]);
  expect(Object.isFrozen(witness.baseline.root)).toBe(true);
  expect("routingEvidence" in witness.baseline).toBe(false);
  const proposed = structuredClone(baseline); proposed.edges[0]!.route.points = [{ x: 10, y: 10 }, { x: 10, y: 100 }, { x: 100, y: 100 }]; proposed.forwardRoutingWitness = witness;
  const callbacks = { buildContext: (s: PositionedScene) => context(s.edges[0]!.route.points), auditOrdinary: () => [] };
  expect(auditForwardRoutingWitness(proposed, callbacks)).toEqual([]);
  expect(auditForwardRoutingWitness(proposed, { ...callbacks, auditOrdinary: () => ["marker failure"] })).toContain("baseline_scene_rejected");
  proposed.root.width++;
  expect(auditForwardRoutingWitness(proposed, callbacks)).toContain("baseline_geometry_or_policy_mismatch");
  proposed.root.width--; proposed.edges[0]!.markers = { end: "none" };
  expect(auditForwardRoutingWitness(proposed, callbacks)).toContain("baseline_geometry_or_policy_mismatch");
});
it("transforms every absolute witness position without changing relative port offsets", () => {
  const baseline = scene(); baseline.edges[0]!.label = { x: 50, y: 60, width: 20, height: 10, lineHeight: 10, textStyleRole: "label", lines: ["text"] };
  baseline.decorations = [{ kind: "line", id: "decoration", classes: [], paintGroup: "edges", from: { x: 1, y: 2 }, to: { x: 3, y: 4 } }];
  const original = createForwardRoutingWitness(baseline, ["edge"]), shifted = translateForwardRoutingWitness(original, 20, 30);
  expect(shifted.baseline.root.x).toBe(20); expect(shifted.baseline.root.y).toBe(30);
  expect(shifted.baseline.edges[0]!.label?.x).toBe(70); expect(shifted.baseline.edges[0]!.label?.y).toBe(90);
  expect(shifted.baseline.edges[0]!.route.points[0]).toEqual({ x: 30, y: 40 });
  expect(original.baseline.edges[0]!.route.points[0]).toEqual({ x: 10, y: 10 });
});
it("rejects nested or cyclic solver history before invoking either audit callback", () => {
  for (const history of ["forwardRoutingWitness", "routingEvidence"]) {
    const proposed = scene();
    proposed.forwardRoutingWitness = structuredClone(createForwardRoutingWitness(proposed, ["edge"]));
    Object.assign(proposed.forwardRoutingWitness.baseline, { [history]: proposed.forwardRoutingWitness });
    let callbacks = 0;
    expect(auditForwardRoutingWitness(proposed, {
      buildContext: () => { callbacks++; return undefined; },
      auditOrdinary: () => { callbacks++; return auditForwardRoutingWitness(proposed, {
        buildContext: () => undefined, auditOrdinary: () => []
      }); }
    })).toEqual(["recursive_baseline"]);
    expect(callbacks).toBe(0);
  }
});
it("runs baseline admission per candidate even when repaired geometry is cached", () => {
  const c = context([{ x: 10, y: 10 }, { x: 10, y: 100 }, { x: 100, y: 100 }]); const seen: string[] = [];
  const result = selectRoutingQuality([{ id: "disallowed", context: c }, { id: "allowed", context: c }], { admit: candidate => { seen.push(candidate.id); return candidate.id === "allowed"; } });
  expect(seen).toEqual(["disallowed", "allowed"]); expect(result.selected?.id).toBe("allowed");
  expect(result.rejected).toContainEqual({ id: "disallowed", reason: "baseline_admission_rejected" });
});
