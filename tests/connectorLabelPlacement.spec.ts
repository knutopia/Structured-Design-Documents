import { describe, expect, it } from "vitest";
import type {
  MeasuredEdgeLabel,
  PositionedRoute,
  PositionedScene
} from "../src/renderer/staged/contracts.js";
import {
  buildConnectorRouteSegmentsById,
  positionConnectorLabel
} from "../src/renderer/staged/connectorLabelPlacement.js";
import type { RendererDiagnostic } from "../src/renderer/staged/diagnostics.js";

const measuredLabel: MeasuredEdgeLabel = {
  lines: ["relates"],
  width: 48,
  height: 20,
  lineHeight: 20,
  textStyleRole: "edge_label"
};

function testScene(): PositionedScene {
  return {
    viewId: "test",
    profileId: "strict",
    themeId: "default",
    root: {
      kind: "container",
      id: "root",
      role: "root",
      primitive: "root",
      classes: [],
      layout: { strategy: "manual" },
      chrome: {
        padding: { top: 0, right: 0, bottom: 0, left: 0 }
      },
      headerContent: [],
      children: [],
      ports: [],
      x: -200,
      y: -200,
      width: 800,
      height: 800
    },
    edges: [],
    decorations: [],
    diagnostics: [],
    paintOrder: ["chrome", "nodes", "labels", "edges", "edge_labels"]
  };
}

function placeLabel(
  route: PositionedRoute,
  options: Partial<Parameters<typeof positionConnectorLabel>[0]> = {}
) {
  const diagnostics: RendererDiagnostic[] = [];
  const connectorId = "connector:test";
  const connectorSegmentsById = buildConnectorRouteSegmentsById(
    [{ id: connectorId, route }],
    (connector) => connector.id,
    (connector) => connector.route
  );

  return {
    label: positionConnectorLabel({
      connectorId,
      measuredLabel,
      route,
      connectorSegmentsById,
      blockedBoxes: [],
      separatorSegments: [],
      scene: testScene(),
      diagnostics,
      diagnosticsPolicy: {
        omittedCode: "test.label_omitted",
        fallbackCode: "test.label_fallback",
        noAnchorMessage: (id) => `${id} omitted`,
        noCandidateMessage: (id) => `${id} has no candidate`,
        fallbackMessage: (id) => `${id} fallback`
      },
      connectorBlockMode: "all_segments",
      horizontalPlacementMode: "scenario_side_offsets",
      horizontalSideLabelDistance: 12,
      includeAdjacentHorizontalLabelAnchors: true,
      preferHorizontalAnchors: true,
      preferHorizontalSidePlacement: true,
      horizontalLabelAssociationPolicy: {
        maxDetachedDistance: 12
      },
      ...options
    }),
    diagnostics
  };
}

describe("connector label placement", () => {
  it("prefers adjacent horizontal anchors over a long vertical midpoint anchor", () => {
    const route: PositionedRoute = {
      style: "orthogonal",
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 300 },
        { x: 200, y: 300 }
      ]
    };

    const { label, diagnostics } = placeLabel(route, {
      horizontalLabelLanePreference: { leftX: 24 }
    });

    expect(diagnostics).toEqual([]);
    expect(label).toBeDefined();
    expect(label!.x).toBeCloseTo(24, 3);
    expect(
      Math.min(
        Math.abs(label!.y + label!.height - 0),
        Math.abs(label!.y - 0),
        Math.abs(label!.y + label!.height - 300),
        Math.abs(label!.y - 300)
      )
    ).toBeLessThanOrEqual(12.5);
  });

  it("rejects detached lane candidates and keeps horizontal labels near their own segment", () => {
    const route: PositionedRoute = {
      style: "orthogonal",
      points: [
        { x: 0, y: 100 },
        { x: 120, y: 100 }
      ]
    };

    const { label, diagnostics } = placeLabel(route, {
      horizontalLabelLanePreference: { leftX: 300 }
    });

    expect(diagnostics).toEqual([]);
    expect(label).toBeDefined();
    expect(label!.x).toBeLessThan(120);
    expect(Math.abs(label!.y + label!.height - 100)).toBeLessThanOrEqual(12.5);
  });

  it("prefers strong horizontal overlap over weak distance-only association", () => {
    const route: PositionedRoute = {
      style: "orthogonal",
      points: [
        { x: 0, y: 100 },
        { x: 120, y: 100 },
        { x: 120, y: 200 },
        { x: 240, y: 200 }
      ]
    };

    const { label, diagnostics } = placeLabel(route, {
      horizontalLabelLanePreference: { leftX: 72 }
    });

    expect(diagnostics).toEqual([]);
    expect(label).toBeDefined();
    expect(label!.x).toBeCloseTo(72, 3);
    expect(label!.y + label!.height).toBeCloseTo(88, 3);
  });

  it("uses weak horizontal association when no strong candidate is available", () => {
    const route: PositionedRoute = {
      style: "orthogonal",
      points: [
        { x: 0, y: 100 },
        { x: 120, y: 100 }
      ]
    };

    const { label, diagnostics } = placeLabel(route, {
      blockedBoxes: [{
        x: 30,
        y: 90,
        width: 60,
        height: 20
      }],
      horizontalLabelAssociationPolicy: {
        maxDetachedDistance: 12,
        maxStrongDetachedDistance: 0
      }
    });

    expect(diagnostics).toEqual([]);
    expect(label).toBeDefined();
    expect(label!.y + label!.height).toBeCloseTo(88, 3);
  });

  it("prefers the earlier horizontal anchor when strong lane candidates tie", () => {
    const route: PositionedRoute = {
      style: "orthogonal",
      points: [
        { x: 0, y: 100 },
        { x: 120, y: 100 },
        { x: 120, y: 200 },
        { x: 240, y: 200 }
      ]
    };

    const { label, diagnostics } = placeLabel(route, {
      horizontalLabelLanePreference: { leftX: 96 },
      preferEarlierHorizontalAnchors: true
    });

    expect(diagnostics).toEqual([]);
    expect(label).toBeDefined();
    expect(label!.x).toBeCloseTo(96, 3);
    expect(label!.y + label!.height).toBeCloseTo(88, 3);
  });

  it("uses vertical placement when no adjacent horizontal segment is usable", () => {
    const route: PositionedRoute = {
      style: "orthogonal",
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 200 },
        { x: 20, y: 200 }
      ]
    };

    const { label, diagnostics } = placeLabel(route);

    expect(diagnostics).toEqual([]);
    expect(label).toBeDefined();
    expect(label!.x).toBeCloseTo(22, 3);
    expect(label!.y + label!.height / 2).toBeGreaterThan(80);
    expect(label!.y + label!.height / 2).toBeLessThan(120);
  });
});
