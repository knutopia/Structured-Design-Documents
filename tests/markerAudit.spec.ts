import { describe, expect, it } from "vitest";
import type { PositionedEdge, PositionedScene } from "../src/renderer/staged/contracts.js";
import { auditPositionedSceneMarkers, buildEndpointMarkerRoutingBlockers } from "../src/renderer/staged/markerAudit.js";
import type { FinalRoutingConnector } from "../src/renderer/staged/routingCore/index.js";

function edge(id: string, points: Array<{ x: number; y: number }>, arrow = false): PositionedEdge {
  return { id, role: "navigation", classes: [], paintGroup: "edges", from: { itemId: `${id}:from`, ...points[0]! },
    to: { itemId: `${id}:to`, ...points.at(-1)! }, route: { style: "orthogonal", points },
    ...(arrow ? { markers: { end: "arrow" as const } } : {}) };
}
function scene(edges: PositionedEdge[]): PositionedScene {
  return { viewId: "test", detailId: "compact", themeId: "default", edges, decorations: [], diagnostics: [],
    paintOrder: ["chrome", "nodes", "labels", "edges", "edge_labels"], root: {
      id: "root", kind: "container", role: "root", primitive: "root", classes: [],
      x: 0, y: 0, width: 300, height: 300, layout: { strategy: "manual" },
      chrome: { padding: { top: 0, right: 0, bottom: 0, left: 0 } }, headerContent: [], children: [], ports: []
    } };
}
const arrow = () => edge("a", [{ x: 20, y: 100 }, { x: 100, y: 100 }], true);

describe("shared painted marker acceptance", () => {
  it("builds routing reservations from endpoint sides before the seed route is repaired", () => {
    const connectors: FinalRoutingConnector[] = ["a", "b"].map(id => ({ id, priority: 0,
      route: { style: "orthogonal", points: [{ x: 20, y: 100 }, { x: 100, y: 100 }] },
      source: { nodeId: "source", point: { x: 20, y: 100 }, side: "north", minLeg: 0 },
      target: { nodeId: "target", point: { x: 100, y: 100 }, side: "north", minLeg: 12 } }));
    const [box] = buildEndpointMarkerRoutingBlockers(connectors, new Map([["a", { end: "arrow" }]]), 10, 2);
    expect(box!.appliesToConnectorIds).toEqual(["b"]);
    expect(box!.y).toBeLessThan(100);
    expect(box!.x).toBeGreaterThan(90);
    expect(box!.x + box!.width).toBeGreaterThan(100);
    expect(box!.y + box!.height).toBeGreaterThanOrEqual(100);
  });
  it("accepts the supporting terminal and separate arrows", () => {
    expect(auditPositionedSceneMarkers(scene([arrow(), edge("b", [{ x: 20, y: 140 }, { x: 100, y: 140 }], true)]))).toEqual([]);
  });
  it("detects a stroke clipping the painted arrow despite missing its centreline", () => {
    const s = scene([arrow(), edge("b", [{ x: 96, y: 90 }, { x: 96, y: 98 }])]);
    expect(auditPositionedSceneMarkers(s).map(d => d.code)).toContain("renderer.routing.marker_connector");
  });
  it("checks arrow pairs, labels, solid headers and exported bounds", () => {
    const s = scene([arrow(), edge("b", [{ x: 100, y: 50 }, { x: 100, y: 100 }], true)]);
    s.edges[1]!.label = { lines: ["label"], x: 90, y: 95, width: 20, height: 20, lineHeight: 20, textStyleRole: "edge_label" };
    s.root.headerContent.push({ id: "header", kind: "text", textStyleRole: "title", lines: ["header"],
      x: 90, y: 90, width: 20, height: 20, lineHeight: 20, region: "primary" });
    const findings = auditPositionedSceneMarkers(s).map(d => d.code);
    expect(findings).toEqual(expect.arrayContaining(["renderer.routing.marker_marker", "renderer.routing.marker_label", "renderer.routing.marker_obstacle"]));
    s.root.width = 100;
    expect(auditPositionedSceneMarkers(s).map(d => d.code)).toContain("renderer.routing.marker_bounds");
  });
  it("allows attachment to the owned endpoint but audits a later route section", () => {
    const a = arrow();
    const s = scene([a]);
    s.root.children.push({ id: a.to.itemId, kind: "node", role: "place", primitive: "card", classes: [],
      x: 100, y: 80, width: 100, height: 40, widthBand: "standard", widthPolicy: { preferred: "standard", allowed: ["standard"] },
      overflowPolicy: { kind: "grow_height" }, overflow: { status: "fits" }, content: [], ports: [] });
    expect(auditPositionedSceneMarkers(s)).toEqual([]);
    a.route.points = [{ x: 96, y: 90 }, { x: 96, y: 98 }, { x: 80, y: 98 }, { x: 80, y: 100 }, { x: 100, y: 100 }];
    expect(auditPositionedSceneMarkers(s).map(d => d.code)).toContain("renderer.routing.marker_connector");
  });
});
