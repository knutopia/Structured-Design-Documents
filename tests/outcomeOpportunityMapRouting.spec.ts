import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import type {
  Point,
  PortSide,
  PositionedContainer,
  PositionedEdge,
  PositionedItem,
  PositionedNode,
  PositionedScene
} from "../src/renderer/staged/contracts.js";
import {
  renderOutcomeOpportunityMapRoutingDebugArtifacts,
  type OutcomeOpportunityMapRoutingDebugArtifactsResult
} from "../src/renderer/staged/outcomeOpportunityMap.js";
import {
  collectEdgeLabelBoxes,
  expectLabelsDoNotOverlapBoxes,
  expectLabelsDoNotOverlapEachOther,
  expectHorizontalEndpointLabelsHaveMinimumClearance,
  expectLabelsHaveMinimumBoxClearance,
  expectNoRouteIntersectionsWithNonEndpointBoxes,
  expectRoutesDoNotEnterEndpointBoxes,
  expectSameOrientationSegmentsSeparated
} from "./stagedVisualHarness.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];
const OUTCOME_OPPORTUNITY_LABEL_NODE_CLEARANCE = 24;
const ROUTING_SPACING = 16;

const DENSE_ROUTING_SOURCE = `
SDD-TEXT 0.1

Outcome O-001 "Outcome One"
  MEASURED_BY M-999 "Shared Metric"
END

Outcome O-002 "Outcome Two"
  MEASURED_BY M-999 "Shared Metric"
END

Outcome O-003 "Outcome Three"
  MEASURED_BY M-999 "Shared Metric"
END

Opportunity OP-001 "Opportunity One"
  SUPPORTS O-001 "Outcome One"
  SUPPORTS O-002 "Outcome Two"
END

Opportunity OP-002 "Opportunity Two"
  SUPPORTS O-002 "Outcome Two"
  SUPPORTS O-003 "Outcome Three"
END

Opportunity OP-003 "Opportunity Three"
  SUPPORTS O-003 "Outcome Three"
  SUPPORTS O-001 "Outcome One"
END

Opportunity OP-004 "Opportunity Four"
  SUPPORTS O-001 "Outcome One"
END

Opportunity OP-005 "Opportunity Five"
  SUPPORTS O-001 "Outcome One"
END

Opportunity OP-006 "Opportunity Six"
  SUPPORTS O-001 "Outcome One"
END

Initiative I-001 "Shared Initiative"
  ADDRESSES OP-001 "Opportunity One"
  ADDRESSES OP-003 "Opportunity Three"
END

Metric M-999 "Shared Metric"
END
`;

async function renderOutcomeOpportunitySource(
  sourceText: string,
  profileId = "strict"
): Promise<OutcomeOpportunityMapRoutingDebugArtifactsResult> {
  const bundle = await loadBundle(manifestPath);
  const view = bundle.views.views.find((candidate) => candidate.id === "outcome_opportunity_map");
  if (!view) {
    throw new Error("Could not resolve the outcome_opportunity_map view.");
  }

  const input = {
    path: path.join(repoRoot, "tests/fixtures/render/__inline_outcome_opportunity_routing__.sdd"),
    text: `${sourceText.trim()}\n`
  };
  const compiled = compileSource(input, bundle);
  expect(compiled.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
  if (!compiled.graph) {
    throw new Error("Could not compile inline outcome-opportunity source.");
  }

  const projected = projectView(compiled.graph, bundle, "outcome_opportunity_map");
  expect(projected.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
  if (!projected.projection) {
    throw new Error("Could not project inline source to outcome_opportunity_map.");
  }

  return renderOutcomeOpportunityMapRoutingDebugArtifacts(
    projected.projection,
    compiled.graph,
    view,
    profileId
  );
}

async function renderOutcomeOpportunityExample(
  exampleName: string,
  profileId = "strict"
): Promise<OutcomeOpportunityMapRoutingDebugArtifactsResult> {
  return renderOutcomeOpportunitySource(
    await readFile(path.join(repoRoot, "bundle/v0.1/examples", `${exampleName}.sdd`), "utf8"),
    profileId
  );
}

function flattenPositionedItems(root: PositionedContainer): PositionedItem[] {
  const items: PositionedItem[] = [root];
  for (const child of root.children) {
    items.push(child);
    if (child.kind === "container") {
      items.push(...flattenPositionedItems(child));
    }
  }
  return items;
}

function findNode(root: PositionedContainer, nodeId: string): PositionedNode {
  const item = flattenPositionedItems(root).find((candidate) => candidate.id === nodeId);
  if (!item || item.kind !== "node") {
    throw new Error(`Could not find positioned node "${nodeId}".`);
  }
  return item;
}

function findEdge(edges: readonly PositionedEdge[], edgeId: string): PositionedEdge {
  const edge = edges.find((candidate) => candidate.id === edgeId);
  if (!edge) {
    throw new Error(`Could not find positioned edge "${edgeId}".`);
  }
  return edge;
}

function expectOrthogonalRoute(edge: PositionedEdge): void {
  for (let index = 1; index < edge.route.points.length; index += 1) {
    const start = edge.route.points[index - 1]!;
    const end = edge.route.points[index]!;
    expect(start.x === end.x || start.y === end.y, `${edge.id} segment ${index - 1}`).toBe(true);
  }
}

function expectSceneRoutesOrthogonal(scene: PositionedScene): void {
  for (const edge of scene.edges) {
    expectOrthogonalRoute(edge);
  }
}

interface AxisAlignedSegment {
  edgeId: string;
  segmentIndex: number;
  axis: "horizontal" | "vertical";
  coordinate: number;
  spanStart: number;
  spanEnd: number;
}

function collectAxisAlignedSegments(edge: PositionedEdge): AxisAlignedSegment[] {
  const segments: AxisAlignedSegment[] = [];
  for (let index = 1; index < edge.route.points.length; index += 1) {
    const start = edge.route.points[index - 1]!;
    const end = edge.route.points[index]!;
    if (start.x === end.x) {
      segments.push({
        edgeId: edge.id,
        segmentIndex: index - 1,
        axis: "vertical",
        coordinate: start.x,
        spanStart: Math.min(start.y, end.y),
        spanEnd: Math.max(start.y, end.y)
      });
      continue;
    }
    if (start.y === end.y) {
      segments.push({
        edgeId: edge.id,
        segmentIndex: index - 1,
        axis: "horizontal",
        coordinate: start.y,
        spanStart: Math.min(start.x, end.x),
        spanEnd: Math.max(start.x, end.x)
      });
    }
  }
  return segments;
}

function collectInternalVerticalSegments(edge: PositionedEdge): AxisAlignedSegment[] {
  const segments = collectAxisAlignedSegments(edge);
  return segments.filter((segment, index) =>
    segment.axis === "vertical" && index > 0 && index < segments.length - 1
  );
}

function expectOverlappingSegmentsSeparated(segments: readonly AxisAlignedSegment[], spacing = ROUTING_SPACING): void {
  for (let index = 0; index < segments.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < segments.length; otherIndex += 1) {
      const first = segments[index]!;
      const second = segments[otherIndex]!;
      if (first.axis !== second.axis) {
        continue;
      }
      const overlap = Math.min(first.spanEnd, second.spanEnd) - Math.max(first.spanStart, second.spanStart);
      if (overlap <= 0.5) {
        continue;
      }
      expect(Math.abs(first.coordinate - second.coordinate), [
        first.edgeId,
        `segment ${first.segmentIndex}`,
        second.edgeId,
        `segment ${second.segmentIndex}`,
        first.axis,
        `overlap ${overlap}`
      ].join(" ")).toBeGreaterThanOrEqual(spacing - 0.5);
    }
  }
}

function segmentsCrossAtInterior(first: AxisAlignedSegment, second: AxisAlignedSegment): boolean {
  if (first.axis === second.axis) {
    return false;
  }

  const horizontal = first.axis === "horizontal" ? first : second;
  const vertical = first.axis === "vertical" ? first : second;
  return vertical.coordinate > horizontal.spanStart + 0.5
    && vertical.coordinate < horizontal.spanEnd - 0.5
    && horizontal.coordinate > vertical.spanStart + 0.5
    && horizontal.coordinate < vertical.spanEnd - 0.5;
}

function expectNoInteriorRouteCrossing(first: PositionedEdge, second: PositionedEdge): void {
  const firstSegments = collectAxisAlignedSegments(first);
  const secondSegments = collectAxisAlignedSegments(second);
  for (const firstSegment of firstSegments) {
    for (const secondSegment of secondSegments) {
      expect(segmentsCrossAtInterior(firstSegment, secondSegment), [
        first.id,
        `segment ${firstSegment.segmentIndex}`,
        second.id,
        `segment ${secondSegment.segmentIndex}`
      ].join(" ")).toBe(false);
    }
  }
}

function segmentOverlapsNodeHeight(segment: AxisAlignedSegment, node: PositionedNode): boolean {
  return segment.axis === "vertical"
    && Math.min(segment.spanEnd, node.y + node.height) - Math.max(segment.spanStart, node.y) > 0.5;
}

function labelSegmentClearance(
  label: NonNullable<PositionedEdge["label"]>,
  segment: AxisAlignedSegment
): number {
  if (segment.axis === "vertical") {
    const horizontalGap = Math.max(
      segment.coordinate - (label.x + label.width),
      label.x - segment.coordinate,
      0
    );
    const verticalGap = Math.max(
      segment.spanStart - (label.y + label.height),
      label.y - segment.spanEnd,
      0
    );
    return Math.hypot(horizontalGap, verticalGap);
  }

  const horizontalGap = Math.max(
    segment.spanStart - (label.x + label.width),
    label.x - segment.spanEnd,
    0
  );
  const verticalGap = Math.max(
    segment.coordinate - (label.y + label.height),
    label.y - segment.coordinate,
    0
  );
  return Math.hypot(horizontalGap, verticalGap);
}

function expectEndpointSpacing(
  edges: readonly PositionedEdge[],
  endpoint: "from" | "to",
  spacing = ROUTING_SPACING
): void {
  const coordinates = edges
    .map((edge) => endpoint === "from" ? edge.from.y : edge.to.y)
    .sort((left, right) => left - right);
  for (let index = 1; index < coordinates.length; index += 1) {
    expect(coordinates[index]! - coordinates[index - 1]!, `endpoint gap ${index}`)
      .toBeGreaterThanOrEqual(spacing - 0.5);
  }
}

function expectPrimaryConnectorLabelsPresent(edges: readonly PositionedEdge[]): void {
  for (const edge of edges.filter((candidate) =>
    candidate.id.includes("__supports__")
    || candidate.id.includes("__addresses__")
    || candidate.id.includes("__measured_by__")
  )) {
    expect(edge.label, edge.id).toBeDefined();
  }
}

function collectNodeBoxes(root: PositionedContainer): Array<{ itemId: string; x: number; y: number; width: number; height: number }> {
  return flattenPositionedItems(root)
    .filter((item): item is PositionedNode => item.kind === "node")
    .map((item) => ({
      itemId: item.id,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height
    }));
}

function expectEndpointOnExteriorSide(
  point: Point,
  node: PositionedNode,
  side: PortSide
): void {
  switch (side) {
    case "north":
      expect(point.y).toBe(node.y);
      expect(point.x).toBeGreaterThanOrEqual(node.x);
      expect(point.x).toBeLessThanOrEqual(node.x + node.width);
      break;
    case "south":
      expect(point.y).toBe(node.y + node.height);
      expect(point.x).toBeGreaterThanOrEqual(node.x);
      expect(point.x).toBeLessThanOrEqual(node.x + node.width);
      break;
    case "east":
      expect(point.x).toBe(node.x + node.width);
      expect(point.y).toBeGreaterThanOrEqual(node.y);
      expect(point.y).toBeLessThanOrEqual(node.y + node.height);
      break;
    case "west":
      expect(point.x).toBe(node.x);
      expect(point.y).toBeGreaterThanOrEqual(node.y);
      expect(point.y).toBeLessThanOrEqual(node.y + node.height);
      break;
  }
}

describe("outcome_opportunity_map routing step 2", () => {
  it("builds deterministic endpoint buckets and exterior same-band templates for the canonical trace", async () => {
    const rendered = await renderOutcomeOpportunityExample("outcome_to_ia_trace");

    expect(rendered.routingStages.connectorPlans.map((plan) => ({
      edgeId: plan.edgeId,
      type: plan.type,
      pattern: plan.pattern,
      sourceSide: plan.sourceSide,
      targetSide: plan.targetSide,
      label: plan.label?.lines.flat().join(" ")
    }))).toEqual([
      {
        edgeId: "OP-001__supports__O-001",
        type: "SUPPORTS",
        pattern: "same_band_support",
        sourceSide: "east",
        targetSide: "west",
        label: "supports"
      },
      {
        edgeId: "I-001__addresses__OP-001",
        type: "ADDRESSES",
        pattern: "same_band_addressing",
        sourceSide: "east",
        targetSide: "west",
        label: "addresses"
      },
      {
        edgeId: "O-001__measured_by__M-001",
        type: "MEASURED_BY",
        pattern: "same_band_measurement",
        sourceSide: "east",
        targetSide: "west",
        label: "measured by"
      }
    ]);
    expect(rendered.step2PositionedScene.edges.map((edge) => edge.label)).toEqual([undefined, undefined, undefined]);

    const opBucket = rendered.routingStages.nodeEdgeBuckets.find((bucket) => bucket.nodeId === "OP-001");
    expect(opBucket?.east.startingConnectorIds).toEqual(["connector:1:OP-001__supports__O-001"]);
    expect(opBucket?.west.endingConnectorIds).toEqual(["connector:2:I-001__addresses__OP-001"]);

    const supports = findEdge(rendered.step2PositionedScene.edges, "OP-001__supports__O-001");
    expectEndpointOnExteriorSide(supports.from, findNode(rendered.step2PositionedScene.root, "OP-001"), "east");
    expectEndpointOnExteriorSide(supports.to, findNode(rendered.step2PositionedScene.root, "O-001"), "west");
    expect(supports.route.points).toEqual([
      { x: supports.from.x, y: supports.from.y },
      { x: supports.to.x, y: supports.to.y }
    ]);

    expect(rendered.step2Svg).toContain("outcome_opportunity_semantic_edge");
    expect(Array.from(rendered.step2Png.slice(0, PNG_SIGNATURE.length))).toEqual(PNG_SIGNATURE);
  });

  it("displaces crowded metric endpoints and uses a measured-column template for stacked metrics", async () => {
    const rendered = await renderOutcomeOpportunityExample("metric_event_instrumentation");
    const measuredPlans = rendered.routingStages.connectorPlans.filter((plan) => plan.type === "MEASURED_BY");

    expect(measuredPlans.map((plan) => ({
      edgeId: plan.edgeId,
      pattern: plan.pattern
    }))).toEqual([
      {
        edgeId: "O-050__measured_by__M-050",
        pattern: "same_band_measurement"
      },
      {
        edgeId: "O-050__measured_by__M-051",
        pattern: "stacked_measurement"
      }
    ]);

    const outcomeBucket = rendered.routingStages.nodeEdgeBuckets.find((bucket) => bucket.nodeId === "O-050");
    expect(outcomeBucket?.east.startingConnectorIds).toEqual([
      "connector:3:O-050__measured_by__M-050",
      "connector:4:O-050__measured_by__M-051"
    ]);

    const firstMetricEdge = findEdge(rendered.step2PositionedScene.edges, "O-050__measured_by__M-050");
    const secondMetricEdge = findEdge(rendered.step2PositionedScene.edges, "O-050__measured_by__M-051");
    expect(firstMetricEdge.from.y).not.toBe(secondMetricEdge.from.y);
    expect(secondMetricEdge.route.points.length).toBeGreaterThan(3);
    expect(secondMetricEdge.route.points[0]).toEqual({
      x: secondMetricEdge.from.x,
      y: secondMetricEdge.from.y
    });
    expect(secondMetricEdge.route.points.at(-1)).toEqual({
      x: secondMetricEdge.to.x,
      y: secondMetricEdge.to.y
    });
    expectEndpointOnExteriorSide(secondMetricEdge.from, findNode(rendered.step2PositionedScene.root, "O-050"), "east");
    expectEndpointOnExteriorSide(secondMetricEdge.to, findNode(rendered.step2PositionedScene.root, "M-051"), "west");

    const step2Route = rendered.routingStages.step2PositionedScene.edges.find((edge) =>
      edge.id === "O-050__measured_by__M-051"
    )?.route.points;
    const step3Route = rendered.routingStages.step3PositionedScene.edges.find((edge) =>
      edge.id === "O-050__measured_by__M-051"
    )?.route.points;
    expect(step3Route).not.toEqual(step2Route);
    expect(rendered.routingStages.gutterOccupancy.some((entry) =>
      entry.kind === "column"
      && entry.key.includes(":expanded")
      && entry.columnOrder !== undefined
      && entry.spanEnd > entry.spanStart
      && entry.locked === undefined
    )).toBe(true);
    expect(rendered.routingStages.gutterOccupancy.some((entry) =>
      entry.kind === "column" && entry.columnOrder !== undefined
    )).toBe(true);
    expect(Math.max(0, ...Object.values(rendered.routingStages.globalGutterState.columnExpansions)))
      .toBeGreaterThan(0);

    const finalStackedMetricEdge = findEdge(
      rendered.routingStages.finalPositionedScene.edges,
      "O-050__measured_by__M-051"
    );
    expect(finalStackedMetricEdge.label).toBeDefined();
    if (!finalStackedMetricEdge.label) {
      throw new Error("Expected stacked metric label to be present.");
    }
    const firstMetricNode = findNode(rendered.routingStages.finalPositionedScene.root, "M-050");
    expectLabelsHaveMinimumBoxClearance(
      [{
        edgeId: finalStackedMetricEdge.id,
        x: finalStackedMetricEdge.label.x,
        y: finalStackedMetricEdge.label.y,
        width: finalStackedMetricEdge.label.width,
        height: finalStackedMetricEdge.label.height
      }],
      [{
        itemId: firstMetricNode.id,
        x: firstMetricNode.x,
        y: firstMetricNode.y,
        width: firstMetricNode.width,
        height: firstMetricNode.height
      }],
      OUTCOME_OPPORTUNITY_LABEL_NODE_CLEARANCE
    );
  });

  it("routes projected secondary connectors through typed secondary ports without final labels", async () => {
    const rendered = await renderOutcomeOpportunitySource(`
SDD-TEXT 0.1

Outcome O-900 "Dense Outcome"
  MEASURED_BY M-901 "Metric One"
END

Metric M-901 "Metric One"
  INSTRUMENTED_AT O-900 "Dense Outcome"
END

Opportunity OP-901 "Dense Opportunity"
  SUPPORTS O-900 "Dense Outcome"
END

Initiative I-901 "Implementation Reference"
  ADDRESSES OP-901 "Dense Opportunity"
  IMPLEMENTED_BY M-901 "Metric One"
END
`);

    expect(rendered.routingStages.connectorPlans.filter((plan) =>
      plan.type === "IMPLEMENTED_BY" || plan.type === "INSTRUMENTED_AT"
    ).map((plan) => ({
      edgeId: plan.edgeId,
      sourceSide: plan.sourceSide,
      targetSide: plan.targetSide,
      pattern: plan.pattern,
      sourcePortId: plan.sourcePortId,
      targetPortId: plan.targetPortId
    }))).toEqual([
      {
        edgeId: "I-901__implemented_by__M-901",
        sourceSide: "south",
        targetSide: "north",
        pattern: "secondary_reference",
        sourcePortId: "secondary_out",
        targetPortId: "secondary_in"
      },
      {
        edgeId: "M-901__instrumented_at__O-900",
        sourceSide: "south",
        targetSide: "north",
        pattern: "secondary_reference",
        sourcePortId: "secondary_out",
        targetPortId: "secondary_in"
      }
    ]);
    expect(rendered.step2PositionedScene.edges.every((edge) => edge.label === undefined)).toBe(true);
  });

  it("keeps dense multi-outcome routing orthogonal, separated, and label-visible", async () => {
    const rendered = await renderOutcomeOpportunitySource(DENSE_ROUTING_SOURCE);

    expectSceneRoutesOrthogonal(rendered.routingStages.step2PositionedScene);
    expectSceneRoutesOrthogonal(rendered.routingStages.step3PositionedScene);
    expectSceneRoutesOrthogonal(rendered.routingStages.finalPositionedScene);

    const finalEdges = rendered.routingStages.finalPositionedScene.edges;
    const bridgeSegments = [
      "OP-001__supports__O-002",
      "OP-002__supports__O-003",
      "OP-003__supports__O-001"
    ].flatMap((edgeId) => collectInternalVerticalSegments(findEdge(finalEdges, edgeId)));
    expect(bridgeSegments.length).toBeGreaterThanOrEqual(3);
    expect(new Set(bridgeSegments.map((segment) => segment.coordinate)).size).toBeGreaterThan(1);
    expectOverlappingSegmentsSeparated(bridgeSegments);

    const outcomeOneWestArrivals = finalEdges.filter((edge) => edge.to.itemId === "O-001");
    expect(outcomeOneWestArrivals.length).toBeGreaterThanOrEqual(4);
    expectEndpointSpacing(outcomeOneWestArrivals, "to");
    expectPrimaryConnectorLabelsPresent(finalEdges);
  });

  it("separates same-source east-edge address fan-out through local node-right bundles", async () => {
    const rendered = await renderOutcomeOpportunitySource(`
SDD-TEXT 0.1

Initiative I-001 "Guided setup priority planner"
  ADDRESSES OP-001 "Users cannot see which setup steps matter"
  ADDRESSES OP-007 "Handoff gaps hide next ownership"
END

Initiative I-002 "Data readiness preflight"
  ADDRESSES OP-002 "Imported data quality issues appear too late"
END

Initiative I-003 "Vocabulary mapping and templates"
  ADDRESSES OP-003 "Terminology does not match the team workflow"
  ADDRESSES OP-001 "Users cannot see which setup steps matter"
END

Initiative I-004 "Exception triage workspace"
  ADDRESSES OP-004 "Exception handling requires support escalation"
  ADDRESSES OP-006 "Teams need rollout controls before trusting automation"
END

Initiative I-005 "Recommendation evidence drawer"
  ADDRESSES OP-005 "Recommendation evidence is hard to audit"
  ADDRESSES OP-008 "Outcome history is not visible at review time"
END

Initiative I-006 "Controlled automation rollout"
  ADDRESSES OP-006 "Teams need rollout controls before trusting automation"
  ADDRESSES OP-005 "Recommendation evidence is hard to audit"
END

Initiative I-007 "Operational handoff checklist"
  ADDRESSES OP-007 "Handoff gaps hide next ownership"
  ADDRESSES OP-004 "Exception handling requires support escalation"
END

Opportunity OP-001 "Users cannot see which setup steps matter"
  SUPPORTS O-001 "Shorten time to first value"
  SUPPORTS O-002 "Increase self-serve task completion"
END

Opportunity OP-002 "Imported data quality issues appear too late"
  SUPPORTS O-001 "Shorten time to first value"
  SUPPORTS O-003 "Improve trust in automated recommendations"
END

Opportunity OP-003 "Terminology does not match the team workflow"
  SUPPORTS O-002 "Increase self-serve task completion"
END

Opportunity OP-004 "Exception handling requires support escalation"
  SUPPORTS O-002 "Increase self-serve task completion"
END

Opportunity OP-005 "Recommendation evidence is hard to audit"
  SUPPORTS O-003 "Improve trust in automated recommendations"
END

Opportunity OP-006 "Teams need rollout controls before trusting automation"
  SUPPORTS O-002 "Increase self-serve task completion"
  SUPPORTS O-003 "Improve trust in automated recommendations"
END

Opportunity OP-007 "Handoff gaps hide next ownership"
  SUPPORTS O-001 "Shorten time to first value"
  SUPPORTS O-002 "Increase self-serve task completion"
END

Opportunity OP-008 "Outcome history is not visible at review time"
  SUPPORTS O-003 "Improve trust in automated recommendations"
END

Outcome O-001 "Shorten time to first value"
END

Outcome O-002 "Increase self-serve task completion"
END

Outcome O-003 "Improve trust in automated recommendations"
END
`);

    expectSceneRoutesOrthogonal(rendered.routingStages.finalPositionedScene);
    expect(rendered.routingStages.connectorPlans.filter((plan) => plan.from === "I-007").map((plan) => ({
      edgeId: plan.edgeId,
      pattern: plan.pattern
    }))).toEqual([
      {
        edgeId: "I-007__addresses__OP-007",
        pattern: "same_band_addressing"
      },
      {
        edgeId: "I-007__addresses__OP-004",
        pattern: "cross_band_bridge"
      }
    ]);

    const sourceEdges = rendered.routingStages.finalPositionedScene.edges.filter((edge) => edge.from.itemId === "I-007");
    expect(sourceEdges.map((edge) => edge.id)).toEqual([
      "I-007__addresses__OP-007",
      "I-007__addresses__OP-004"
    ]);
    expectEndpointSpacing(sourceEdges, "from");

    const sourceHorizontalSegments = sourceEdges.flatMap((edge) =>
      collectAxisAlignedSegments(edge).filter((segment) =>
        segment.axis === "horizontal" && segment.segmentIndex === 0
      )
    );
    expect(sourceHorizontalSegments.length).toBe(2);
    expectOverlappingSegmentsSeparated(sourceHorizontalSegments);

    const sourceLocalVerticalTurns = sourceEdges.flatMap((edge) =>
      collectAxisAlignedSegments(edge).filter((segment) =>
        segment.axis === "vertical" && segment.segmentIndex === 1
      )
    );
    expect(sourceLocalVerticalTurns.length).toBe(2);
    expectOverlappingSegmentsSeparated(sourceLocalVerticalTurns);

    const sourceLocalOccupancy = rendered.routingStages.gutterOccupancy.filter((entry) =>
      entry.key === "node:I-007:right" && entry.connectorId.includes("I-007__addresses")
    );
    expect(sourceLocalOccupancy.some((entry) =>
      entry.kind === "node_right"
      && entry.axis === "vertical"
      && entry.spanEnd > entry.spanStart
      && entry.locked === undefined
    )).toBe(true);
    expect(rendered.routingStages.gutterOccupancy.some((entry) =>
      entry.connectorId.includes("I-007__addresses")
      && entry.kind === "column"
      && entry.columnOrder !== undefined
      && entry.locked === undefined
    )).toBe(true);
    expect(rendered.routingStages.gutterOccupancy.some((entry) =>
      entry.connectorId.includes("I-007__addresses")
      && entry.kind === "band"
      && entry.rowOrder !== undefined
      && entry.locked === undefined
    )).toBe(true);

    const nodeBoxes = collectNodeBoxes(rendered.routingStages.finalPositionedScene.root);
    expectNoRouteIntersectionsWithNonEndpointBoxes(rendered.routingStages.finalPositionedScene.edges, nodeBoxes);
    expect(rendered.routingStages.diagnostics.filter((diagnostic) =>
      diagnostic.code === "renderer.routing.outcome_opportunity_node_intersection"
    )).toEqual([]);

    const finalEdges = rendered.routingStages.finalPositionedScene.edges;
    const outcomeOne = findNode(rendered.routingStages.finalPositionedScene.root, "O-001");
    const outcomeOneArrivals = [
      "OP-001__supports__O-001",
      "OP-002__supports__O-001",
      "OP-007__supports__O-001"
    ].map((edgeId) => findEdge(finalEdges, edgeId));
    const outcomeOneLocalVerticals = outcomeOneArrivals.flatMap((edge) =>
      collectAxisAlignedSegments(edge).filter((segment) =>
        segmentOverlapsNodeHeight(segment, outcomeOne) && segment.coordinate < outcomeOne.x
      )
    );
    expect(outcomeOneLocalVerticals.length).toBeGreaterThanOrEqual(3);
    expectOverlappingSegmentsSeparated(outcomeOneLocalVerticals);
    const outcomeOneTargetApproaches = outcomeOneArrivals.map((edge) => {
      const approach = collectAxisAlignedSegments(edge).find((segment) =>
        segment.axis === "horizontal"
        && Math.abs(segment.coordinate - edge.to.y) <= 0.5
        && Math.abs(segment.spanEnd - edge.to.x) <= 0.5
      );
      if (!approach) {
        throw new Error(`Expected ${edge.id} to have a final horizontal target approach.`);
      }
      return approach;
    });
    for (const approach of outcomeOneTargetApproaches) {
      expect(approach.spanEnd - approach.spanStart, approach.edgeId)
        .toBeLessThanOrEqual(ROUTING_SPACING * 3 + 0.5);
      for (const trunk of outcomeOneLocalVerticals) {
        if (trunk.edgeId === approach.edgeId) {
          continue;
        }
        expect(segmentsCrossAtInterior(approach, trunk), [
          approach.edgeId,
          `approach ${approach.segmentIndex}`,
          trunk.edgeId,
          `trunk ${trunk.segmentIndex}`
        ].join(" ")).toBe(false);
      }
    }
    const op002ToOutcomeOne = findEdge(finalEdges, "OP-002__supports__O-001");
    const op002TargetApproach = collectAxisAlignedSegments(op002ToOutcomeOne).find((segment) =>
      segment.axis === "horizontal"
      && Math.abs(segment.coordinate - op002ToOutcomeOne.to.y) <= 0.5
      && Math.abs(segment.spanEnd - op002ToOutcomeOne.to.x) <= 0.5
    );
    expect(op002TargetApproach).toBeDefined();
    if (!op002TargetApproach) {
      throw new Error("Expected OP-002__supports__O-001 to have a target-local horizontal approach.");
    }
    expect(op002TargetApproach.spanEnd - op002TargetApproach.spanStart)
      .toBeLessThanOrEqual(ROUTING_SPACING * 3 + 0.5);
    const op002TargetVertical = outcomeOneLocalVerticals.find((segment) =>
      segment.edgeId === "OP-002__supports__O-001"
    );
    expect(op002TargetVertical).toBeDefined();
    if (!op002TargetVertical) {
      throw new Error("Expected OP-002__supports__O-001 to have a target-local vertical approach.");
    }
    expect(outcomeOne.x - op002TargetVertical.coordinate)
      .toBeLessThanOrEqual(ROUTING_SPACING * 3 + 0.5);
    const outcomeOneEdgeLocalOccupancy = rendered.routingStages.gutterOccupancy.filter((entry) =>
      entry.key === "edge-local:O-001:west"
      && entry.kind === "edge_local"
      && entry.endpointRole === "target"
    );
    for (const edgeId of [
      "OP-001__supports__O-001",
      "OP-002__supports__O-001",
      "OP-007__supports__O-001"
    ]) {
      expect(outcomeOneEdgeLocalOccupancy.some((entry) => entry.connectorId.includes(edgeId)), edgeId).toBe(true);
    }

    const supportsOverlapSegments = [
      findEdge(finalEdges, "OP-002__supports__O-003"),
      findEdge(finalEdges, "OP-007__supports__O-001"),
      findEdge(finalEdges, "OP-007__supports__O-002")
    ].flatMap((edge) =>
      collectAxisAlignedSegments(edge).filter((segment) => segment.axis === "vertical")
    );
    expectOverlappingSegmentsSeparated(supportsOverlapSegments);
    expectNoInteriorRouteCrossing(
      findEdge(finalEdges, "I-001__addresses__OP-007"),
      findEdge(finalEdges, "I-003__addresses__OP-001")
    );

    const directSupport = findEdge(finalEdges, "OP-003__supports__O-002");
    expect(directSupport.route.points).toEqual([
      { x: directSupport.from.x, y: directSupport.from.y },
      { x: directSupport.to.x, y: directSupport.to.y }
    ]);

    const directSupportLabel = directSupport.label;
    expect(directSupportLabel).toBeDefined();
    if (!directSupportLabel) {
      throw new Error("Expected OP-003__supports__O-002 label to be present.");
    }
    const longSupportVerticals = collectAxisAlignedSegments(findEdge(finalEdges, "OP-002__supports__O-003"))
      .filter((segment) => segment.axis === "vertical");
    expect(Math.min(...longSupportVerticals.map((segment) => labelSegmentClearance(directSupportLabel, segment))))
      .toBeGreaterThanOrEqual(ROUTING_SPACING - 0.5);

    const opportunity = findNode(rendered.routingStages.finalPositionedScene.root, "OP-003");
    const outcome = findNode(rendered.routingStages.finalPositionedScene.root, "O-002");
    const supportCorridorWidth = outcome.x - (opportunity.x + opportunity.width);
    expect(supportCorridorWidth).toBeGreaterThanOrEqual(
      (directSupport.label?.width ?? 0) + OUTCOME_OPPORTUNITY_LABEL_NODE_CLEARANCE * 2 + ROUTING_SPACING * 3 - 0.5
    );

    const obstacleOccupancy = rendered.routingStages.gutterOccupancy.filter((candidate) =>
      candidate.kind.startsWith("obstacle_")
    );
    expect(obstacleOccupancy.length).toBeGreaterThan(0);

    const movableObstacleSegmentsByGroup = new Map<string, AxisAlignedSegment[]>();
    for (const entry of obstacleOccupancy.filter((candidate) => (candidate.ownershipRank ?? 0) > 0)) {
      const groupKey = `${entry.key}|${entry.axis}`;
      const existing = movableObstacleSegmentsByGroup.get(groupKey) ?? [];
      if (!existing.some((segment) => segment.edgeId === entry.connectorId && segment.segmentIndex === entry.routeSegmentIndex)) {
        existing.push({
          edgeId: entry.connectorId,
          segmentIndex: entry.routeSegmentIndex,
          axis: entry.axis,
          coordinate: entry.nominalCoordinate,
          spanStart: entry.spanStart,
          spanEnd: entry.spanEnd
        });
      }
      movableObstacleSegmentsByGroup.set(groupKey, existing);
    }
    for (const obstacleSegments of movableObstacleSegmentsByGroup.values()) {
      expectOverlappingSegmentsSeparated(obstacleSegments);
    }
  });

  it("keeps parking connectors deterministic and diagnosed", async () => {
    const rendered = await renderOutcomeOpportunitySource(`
SDD-TEXT 0.1

Outcome O-990 "Anchored Outcome"
END

Opportunity OP-991 "Orphan Opportunity"
END

Initiative I-991 "Orphan Initiative"
  ADDRESSES OP-991 "Orphan Opportunity"
END
`);

    expect(rendered.routingStages.connectorPlans).toEqual([
      expect.objectContaining({
        edgeId: "I-991__addresses__OP-991",
        pattern: "parking_fallback",
        sourceSide: "east",
        targetSide: "west"
      })
    ]);
    expect(rendered.routingStages.diagnostics.map((diagnostic) => ({
      code: diagnostic.code,
      targetId: diagnostic.targetId,
      severity: diagnostic.severity
    }))).toEqual([
      {
        code: "renderer.routing.outcome_opportunity_parking_connector",
        targetId: "I-991__addresses__OP-991",
        severity: "info"
      }
    ]);

    const parkingEdge = findEdge(rendered.step2PositionedScene.edges, "I-991__addresses__OP-991");
    expect(parkingEdge.route.points.length).toBeGreaterThan(3);
    expectEndpointOnExteriorSide(parkingEdge.from, findNode(rendered.step2PositionedScene.root, "I-991"), "east");
    expectEndpointOnExteriorSide(parkingEdge.to, findNode(rendered.step2PositionedScene.root, "OP-991"), "west");
  });

  it("produces final routed canonical proof cases with labels and no node-crossing routes", async () => {
    for (const exampleName of ["outcome_to_ia_trace", "metric_event_instrumentation"] as const) {
      const rendered = await renderOutcomeOpportunityExample(exampleName);
      const finalEdges = rendered.routingStages.finalPositionedScene.edges;
      const nodeBoxes = collectNodeBoxes(rendered.routingStages.finalPositionedScene.root);
      const labelBoxes = collectEdgeLabelBoxes(finalEdges);

      expect(finalEdges.length).toBeGreaterThan(0);
      expect(labelBoxes.length).toBe(finalEdges.length);
      expect(rendered.routingStages.diagnostics.filter((diagnostic) =>
        diagnostic.code === "renderer.routing.outcome_opportunity_node_intersection"
        || diagnostic.code === "renderer.routing.outcome_opportunity_edge_label_omitted"
        || diagnostic.code === "renderer.routing.outcome_opportunity_edge_label_fallback"
      )).toEqual([]);
      expectNoRouteIntersectionsWithNonEndpointBoxes(finalEdges, nodeBoxes);
      expectRoutesDoNotEnterEndpointBoxes(finalEdges, nodeBoxes);
      expectSameOrientationSegmentsSeparated(finalEdges);
      expectLabelsDoNotOverlapBoxes(labelBoxes, nodeBoxes);
      expectHorizontalEndpointLabelsHaveMinimumClearance(finalEdges, nodeBoxes, OUTCOME_OPPORTUNITY_LABEL_NODE_CLEARANCE);
      expectLabelsDoNotOverlapEachOther(labelBoxes);
    }
  });

  it("keeps shared cross-band nodes canonical while routing final connectors without duplication", async () => {
    const rendered = await renderOutcomeOpportunitySource(`
SDD-TEXT 0.1

Outcome O-301 "Outcome A"
  MEASURED_BY M-399 "Shared Metric"
END

Outcome O-302 "Outcome B"
  MEASURED_BY M-399 "Shared Metric"
END

Opportunity OP-399 "Shared Opportunity"
  SUPPORTS O-302 "Outcome B"
  SUPPORTS O-301 "Outcome A"
END

Opportunity OP-301 "Opportunity A"
  SUPPORTS O-301 "Outcome A"
END

Initiative I-399 "Shared Initiative"
  ADDRESSES OP-301 "Opportunity A"
  ADDRESSES OP-399 "Shared Opportunity"
END

Metric M-399 "Shared Metric"
END
`);
    const finalEdges = rendered.routingStages.finalPositionedScene.edges;
    const nodeBoxes = collectNodeBoxes(rendered.routingStages.finalPositionedScene.root);

    expect(rendered.middleLayer.placements.filter((placement) => placement.nodeId === "OP-399")).toHaveLength(1);
    expect(rendered.middleLayer.placements.filter((placement) => placement.nodeId === "I-399")).toHaveLength(1);
    expect(rendered.middleLayer.placements.filter((placement) => placement.nodeId === "M-399")).toHaveLength(1);
    expect(rendered.routingStages.connectorPlans.map((plan) => plan.pattern)).toContain("cross_band_bridge");
    expectNoRouteIntersectionsWithNonEndpointBoxes(finalEdges, nodeBoxes);
    expectRoutesDoNotEnterEndpointBoxes(finalEdges, nodeBoxes);
  });
});
