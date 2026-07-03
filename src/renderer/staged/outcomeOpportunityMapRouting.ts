import type {
  MeasuredEdge,
  MeasuredPort,
  MeasuredScene,
  OutcomeOpportunityItemMetadata,
  PaintGroup,
  Point,
  PortSide,
  PositionedContainer,
  PositionedEdge,
  PositionedItem,
  PositionedNode,
  PositionedRoute,
  PositionedScene
} from "./contracts.js";
import {
  buildConnectorRouteSegmentsById,
  FIXED_LABEL_CLEARANCE,
  positionConnectorLabel,
  type BlockingBox
} from "./connectorLabelPlacement.js";
import { createRoutingDiagnostic, sortRendererDiagnostics, type RendererDiagnostic } from "./diagnostics.js";
import { collapseRoutePoints } from "./routing.js";
import type {
  OutcomeOpportunityEdgeChannel,
  OutcomeOpportunityMiddleEdge,
  OutcomeOpportunityMiddleLayerModel,
  OutcomeOpportunityNodePlacement
} from "./outcomeOpportunityMapMiddleLayer.js";
import { decorateOutcomeOpportunityPositionedScene } from "./outcomeOpportunityMapDecorations.js";

export type OutcomeOpportunityRoutePattern =
  | "same_band_addressing"
  | "same_band_support"
  | "same_band_measurement"
  | "stacked_measurement"
  | "cross_band_bridge"
  | "secondary_reference"
  | "parking_fallback";

type EndpointRole = "source" | "target";

interface IndexedOutcomeOpportunityNode {
  node: PositionedNode;
  placement: OutcomeOpportunityNodePlacement;
  cell?: IndexedOutcomeOpportunityCell;
  portsByRole: ReadonlyMap<string, MeasuredPort>;
}

interface IndexedOutcomeOpportunityCell {
  cell: PositionedContainer;
  columnOrder: number;
  rowOrder: number;
}

type OutcomeOpportunityCellMetadata = Extract<OutcomeOpportunityItemMetadata, { kind: "cell" }>;
type PositionedOutcomeOpportunityCell = PositionedContainer & {
  viewMetadata: {
    outcomeOpportunity: OutcomeOpportunityCellMetadata;
  };
};

interface OutcomeOpportunityPositionedIndex {
  nodeById: ReadonlyMap<string, IndexedOutcomeOpportunityNode>;
  cellById: ReadonlyMap<string, IndexedOutcomeOpportunityCell>;
  columnLeftByOrder: ReadonlyMap<number, number>;
  columnRightByOrder: ReadonlyMap<number, number>;
  rowTopByOrder: ReadonlyMap<number, number>;
  rowBottomByOrder: ReadonlyMap<number, number>;
  nodeBoxes: OutcomeOpportunityBox[];
}

interface EndpointSpec {
  side: PortSide;
  portRole: string;
}

export interface OutcomeOpportunityResolvedEndpoint {
  itemId: string;
  portId: string;
  side: PortSide;
}

export interface OutcomeOpportunityNodeEdgeBucketLists {
  startingConnectorIds: string[];
  endingConnectorIds: string[];
}

export interface OutcomeOpportunityNodeEdgeBuckets {
  nodeId: string;
  north: OutcomeOpportunityNodeEdgeBucketLists;
  south: OutcomeOpportunityNodeEdgeBucketLists;
  east: OutcomeOpportunityNodeEdgeBucketLists;
  west: OutcomeOpportunityNodeEdgeBucketLists;
}

type OutcomeOpportunityGutterAxis = "horizontal" | "vertical";
type OutcomeOpportunityGutterKind =
  | "node_right"
  | "node_bottom"
  | "column"
  | "band"
  | "edge_local"
  | "obstacle_north"
  | "obstacle_south"
  | "obstacle_east"
  | "obstacle_west";

interface OutcomeOpportunityBox {
  itemId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface OutcomeOpportunityRouteSegment {
  orientation: "vertical" | "horizontal";
  coordinate: number;
}

interface OutcomeOpportunityRouteSegmentDetail extends OutcomeOpportunityRouteSegment {
  routeSegmentIndex: number;
  start: Point;
  end: Point;
}

interface OutcomeOpportunityConnectorRouteState {
  route: PositionedRoute;
  occupiedGutters: OutcomeOpportunityGutterOccupancy[];
}

type OutcomeOpportunityLocalGutterKind = "node_right" | "node_bottom";

interface OutcomeOpportunityGutterRect {
  key: string;
  kind: OutcomeOpportunityLocalGutterKind | "column" | "band";
  nodeId?: string;
  columnOrder?: number;
  rowOrder?: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

type OutcomeOpportunityLocalGutterRect = OutcomeOpportunityGutterRect & {
  kind: OutcomeOpportunityLocalGutterKind;
  nodeId: string;
};

interface OutcomeOpportunityLocalBundleClaim {
  connectorId: string;
  gutterKey: string;
  kind: "node_right" | "node_bottom";
  routeSegmentIndex: number;
  nominalCoordinate: number;
  spanStart: number;
  spanEnd: number;
  inwardOwnedCoordinates: number[];
  outwardOwnedCoordinates: number[];
  sourceEndpointKey?: string;
  targetEndpointKey?: string;
  columnOrder?: number;
  rowOrder?: number;
}

interface OutcomeOpportunityBundleResolution {
  endpointCoordinateByEndpointKey: Map<string, number>;
  segmentCoordinateBySegmentKey: Map<string, number>;
  lockedSegmentKeys: Set<string>;
  requiredColumnExpansions: Record<number, number>;
  requiredRowExpansions: Record<number, number>;
}

interface OutcomeOpportunityPreparedRouteResolution {
  bundleEndpointCoordinateByEndpointKey: Map<string, number>;
  preparedSegmentCoordinateBySegmentKey: Map<string, number>;
  lockedSegmentKeys: Set<string>;
  requiredColumnExpansions: Record<number, number>;
  requiredRowExpansions: Record<number, number>;
  targetLocalBypassSelections: Map<string, OutcomeOpportunityTargetLocalBypassSelection>;
  routeStates: Map<string, OutcomeOpportunityConnectorRouteState>;
  occupancyResult: {
    occupancy: OutcomeOpportunityGutterOccupancy[];
    occupancyByConnectorId: Map<string, OutcomeOpportunityGutterOccupancy[]>;
  };
  connectorPlansWithOccupancy: OutcomeOpportunityConnectorTemplatePlan[];
}

interface OutcomeOpportunityEndpointSideOrderOverride {
  incomingConnectorIds?: string[];
  outgoingConnectorIds?: string[];
}

type OutcomeOpportunityEndpointSideOrderOverrides = ReadonlyMap<
  string,
  Map<PortSide, OutcomeOpportunityEndpointSideOrderOverride>
>;

export interface OutcomeOpportunityNodeGutter {
  nodeId: string;
  cellId: string;
  columnOrder: number;
  rowOrder: number;
  rightAvailable: number;
  bottomAvailable: number;
}

export interface OutcomeOpportunityGlobalGutterState {
  columnExpansions: Record<number, number>;
  rowExpansions: Record<number, number>;
}

interface OutcomeOpportunityTargetLocalBypassSelection {
  connectorId: string;
  targetNodeId: string;
  side: PortSide;
  blockerConnectorIds: string[];
}

export interface OutcomeOpportunityGutterOccupancy {
  connectorId: string;
  key: string;
  axis: OutcomeOpportunityGutterAxis;
  kind: OutcomeOpportunityGutterKind;
  nominalCoordinate: number;
  spanStart: number;
  spanEnd: number;
  routeSegmentIndex: number;
  nodeId?: string;
  side?: PortSide;
  endpointRole?: EndpointRole;
  columnOrder?: number;
  rowOrder?: number;
  ownershipRank?: number;
  locked?: boolean;
}

export interface OutcomeOpportunityConnectorTemplatePlan {
  id: string;
  edgeId: string;
  semanticEdgeIds: string[];
  type: string;
  channel: OutcomeOpportunityEdgeChannel;
  from: string;
  to: string;
  priority: number;
  sourceSide: PortSide;
  targetSide: PortSide;
  sourcePortId: string;
  targetPortId: string;
  sourceSemanticBandOrder: number;
  sourcePhysicalSlotOrder: number;
  sourceColumnOrder: number;
  sourceAuthorOrder: number;
  outgoingOrder: number;
  targetStableId: string;
  pattern: OutcomeOpportunityRoutePattern;
  role: string;
  classes: string[];
  markers: MeasuredEdge["markers"];
  label?: MeasuredEdge["label"];
  step2Route: PositionedRoute;
  step3Route: PositionedRoute;
  finalRoute: PositionedRoute;
}

export interface OutcomeOpportunityRoutingStages {
  connectorPlans: OutcomeOpportunityConnectorTemplatePlan[];
  nodeEdgeBuckets: OutcomeOpportunityNodeEdgeBuckets[];
  nodeGutters: OutcomeOpportunityNodeGutter[];
  globalGutterState: OutcomeOpportunityGlobalGutterState;
  gutterOccupancy: OutcomeOpportunityGutterOccupancy[];
  step2PositionedScene: PositionedScene;
  step3PositionedScene: PositionedScene;
  finalPositionedScene: PositionedScene;
  diagnostics: RendererDiagnostic[];
}

const ENDPOINT_SPACING = 16;
const EXTERIOR_STUB = 18;
const ENDPOINT_MARGIN = 10;
const HORIZONTAL_LABEL_NODE_CLEARANCE = 24;
const HORIZONTAL_LABEL_GAP = HORIZONTAL_LABEL_NODE_CLEARANCE * 2;
const HORIZONTAL_LABEL_TRACK_CLEARANCE = FIXED_LABEL_CLEARANCE;
const VERTICAL_LABEL_GAP = 24;
const MAX_GLOBAL_GUTTER_ATTEMPTS = 4;
const GUTTER_OVERFLOW_TOLERANCE = 8;
const OBSTACLE_SWERVE_CLEARANCE = 16;

const ENDPOINTS_BY_CHANNEL: Record<string, { source: EndpointSpec; target: EndpointSpec }> = {
  initiative_addressing: {
    source: { side: "east", portRole: "intent_out" },
    target: { side: "west", portRole: "intent_in" }
  },
  opportunity_support: {
    source: { side: "east", portRole: "intent_out" },
    target: { side: "west", portRole: "intent_in" }
  },
  outcome_measurement: {
    source: { side: "east", portRole: "measure_out" },
    target: { side: "west", portRole: "measure_in" }
  },
  implementation_reference: {
    source: { side: "south", portRole: "secondary_out" },
    target: { side: "north", portRole: "secondary_in" }
  },
  instrumentation_reference: {
    source: { side: "south", portRole: "secondary_out" },
    target: { side: "north", portRole: "secondary_in" }
  }
};

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function buildRouteSegmentDetails(route: PositionedRoute): OutcomeOpportunityRouteSegmentDetail[] {
  const details: OutcomeOpportunityRouteSegmentDetail[] = [];

  for (let index = 1; index < route.points.length; index += 1) {
    const start = route.points[index - 1]!;
    const end = route.points[index]!;
    if (start.x === end.x) {
      details.push({
        routeSegmentIndex: index - 1,
        orientation: "vertical",
        coordinate: start.x,
        start,
        end
      });
      continue;
    }
    if (start.y === end.y) {
      details.push({
        routeSegmentIndex: index - 1,
        orientation: "horizontal",
        coordinate: start.y,
        start,
        end
      });
    }
  }

  return details;
}

function spansOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return Math.min(endA, endB) - Math.max(startA, startB) > 0.5;
}

function spansTouchOrOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return Math.min(endA, endB) - Math.max(startA, startB) >= -0.5;
}

function buildSegmentDisplacementKey(connectorId: string, routeSegmentIndex: number): string {
  return `${connectorId}|${routeSegmentIndex}`;
}

function buildEndpointCoordinateKey(connectorId: string, endpointRole: EndpointRole): string {
  return `${connectorId}|${endpointRole}`;
}

function isEdgeLocalKind(kind: OutcomeOpportunityGutterKind): boolean {
  return kind === "edge_local";
}

function isObstacleLocalKind(kind: OutcomeOpportunityGutterKind): boolean {
  return kind === "obstacle_north"
    || kind === "obstacle_south"
    || kind === "obstacle_east"
    || kind === "obstacle_west";
}

function getObstacleSideKind(side: PortSide): OutcomeOpportunityGutterKind {
  switch (side) {
    case "north":
      return "obstacle_north";
    case "south":
      return "obstacle_south";
    case "east":
      return "obstacle_east";
    case "west":
      return "obstacle_west";
  }
}

function getObstacleSideFromKind(kind: OutcomeOpportunityGutterKind): PortSide | undefined {
  switch (kind) {
    case "obstacle_north":
      return "north";
    case "obstacle_south":
      return "south";
    case "obstacle_east":
      return "east";
    case "obstacle_west":
      return "west";
    default:
      return undefined;
  }
}

function getExpectedEdgeLocalAxis(side: PortSide): OutcomeOpportunityRouteSegment["orientation"] {
  return side === "north" || side === "south" ? "horizontal" : "vertical";
}

function getOutwardDirectionForSide(side: PortSide): 1 | -1 {
  switch (side) {
    case "south":
    case "east":
      return 1;
    case "north":
    case "west":
      return -1;
  }
}

function getObstacleLocalBaseCoordinate(
  node: { x: number; y: number; width: number; height: number },
  side: PortSide
): number {
  switch (side) {
    case "north":
      return roundMetric(node.y - OBSTACLE_SWERVE_CLEARANCE);
    case "south":
      return roundMetric(node.y + node.height + OBSTACLE_SWERVE_CLEARANCE);
    case "east":
      return roundMetric(node.x + node.width + OBSTACLE_SWERVE_CLEARANCE);
    case "west":
      return roundMetric(node.x - OBSTACLE_SWERVE_CLEARANCE);
  }
}

function roundUpToEndpointSpacing(value: number): number {
  if (value <= 0) {
    return 0;
  }
  return roundMetric(Math.ceil(value / ENDPOINT_SPACING) * ENDPOINT_SPACING);
}

function flattenItems(root: PositionedContainer): PositionedItem[] {
  const flattened: PositionedItem[] = [root];
  const queue: PositionedItem[] = [...root.children];
  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) {
      continue;
    }
    flattened.push(item);
    if (item.kind === "container") {
      queue.push(...item.children);
    }
  }
  return flattened;
}

function isOutcomeOpportunityNode(item: PositionedItem): item is PositionedNode {
  return item.kind === "node" && item.viewMetadata?.outcomeOpportunity?.kind === "semantic_node";
}

function isOutcomeOpportunityCell(item: PositionedItem): item is PositionedOutcomeOpportunityCell {
  return item.kind === "container" && item.viewMetadata?.outcomeOpportunity?.kind === "cell";
}

function buildIndex(
  scene: PositionedScene,
  middleLayer: OutcomeOpportunityMiddleLayerModel
): OutcomeOpportunityPositionedIndex {
  const placementByNodeId = new Map(middleLayer.placements.map((placement) => [placement.nodeId, placement] as const));
  const cellById = new Map<string, IndexedOutcomeOpportunityCell>();
  const nodeById = new Map<string, IndexedOutcomeOpportunityNode>();
  const columnLeftByOrder = new Map<number, number>();
  const columnRightByOrder = new Map<number, number>();
  const rowTopByOrder = new Map<number, number>();
  const rowBottomByOrder = new Map<number, number>();
  const items = flattenItems(scene.root);

  for (const item of items) {
    if (!isOutcomeOpportunityCell(item)) {
      continue;
    }
    const metadata = item.viewMetadata.outcomeOpportunity;
    cellById.set(item.id, {
      cell: item,
      columnOrder: metadata.columnOrder,
      rowOrder: metadata.rowOrder
    });
    columnLeftByOrder.set(metadata.columnOrder, Math.min(columnLeftByOrder.get(metadata.columnOrder) ?? item.x, item.x));
    columnRightByOrder.set(
      metadata.columnOrder,
      Math.max(columnRightByOrder.get(metadata.columnOrder) ?? item.x + item.width, item.x + item.width)
    );
    rowTopByOrder.set(metadata.rowOrder, Math.min(rowTopByOrder.get(metadata.rowOrder) ?? item.y, item.y));
    rowBottomByOrder.set(
      metadata.rowOrder,
      Math.max(rowBottomByOrder.get(metadata.rowOrder) ?? item.y + item.height, item.y + item.height)
    );
  }

  for (const item of items) {
    if (!isOutcomeOpportunityNode(item)) {
      continue;
    }
    const placement = placementByNodeId.get(item.id);
    if (!placement) {
      continue;
    }
    nodeById.set(item.id, {
      node: item,
      placement,
      cell: cellById.get(placement.cellId),
      portsByRole: new Map(item.ports.map((port) => [port.role, port] as const))
    });
  }

  return {
    nodeById,
    cellById,
    columnLeftByOrder,
    columnRightByOrder,
    rowTopByOrder,
    rowBottomByOrder,
    nodeBoxes: [...nodeById.values()].map(({ node }) => ({
      itemId: node.id,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height
    }))
  };
}

function endpointSpecsForChannel(channel: OutcomeOpportunityEdgeChannel): { source: EndpointSpec; target: EndpointSpec } {
  return ENDPOINTS_BY_CHANNEL[channel] ?? ENDPOINTS_BY_CHANNEL.implementation_reference;
}

function resolvePort(
  edgeId: string,
  node: IndexedOutcomeOpportunityNode,
  role: string,
  diagnostics: RendererDiagnostic[]
): MeasuredPort | undefined {
  const port = node.portsByRole.get(role);
  if (port) {
    return port;
  }

  diagnostics.push(createRoutingDiagnostic(
    "renderer.routing.outcome_opportunity_unresolved_port",
    `Could not resolve outcome-opportunity port role "${role}" on node "${node.node.id}".`,
    edgeId,
    "warn"
  ));
  return undefined;
}

function determinePattern(
  edge: OutcomeOpportunityMiddleEdge,
  source: IndexedOutcomeOpportunityNode,
  target: IndexedOutcomeOpportunityNode
): OutcomeOpportunityRoutePattern {
  if (source.placement.parking || target.placement.parking) {
    return "parking_fallback";
  }

  const sameBand = source.placement.semanticBandId === target.placement.semanticBandId;
  if (!sameBand) {
    return "cross_band_bridge";
  }

  switch (edge.channel) {
    case "initiative_addressing":
      return "same_band_addressing";
    case "opportunity_support":
      return "same_band_support";
    case "outcome_measurement":
      return source.placement.physicalSlotId === target.placement.physicalSlotId
        ? "same_band_measurement"
        : "stacked_measurement";
    case "implementation_reference":
    case "instrumentation_reference":
      return "secondary_reference";
    default:
      return "cross_band_bridge";
  }
}

function buildEmptyNodeEdgeBuckets(nodeId: string): OutcomeOpportunityNodeEdgeBuckets {
  return {
    nodeId,
    north: { startingConnectorIds: [], endingConnectorIds: [] },
    south: { startingConnectorIds: [], endingConnectorIds: [] },
    east: { startingConnectorIds: [], endingConnectorIds: [] },
    west: { startingConnectorIds: [], endingConnectorIds: [] }
  };
}

function getSideBuckets(
  buckets: OutcomeOpportunityNodeEdgeBuckets,
  side: PortSide
): OutcomeOpportunityNodeEdgeBucketLists {
  switch (side) {
    case "north":
      return buckets.north;
    case "south":
      return buckets.south;
    case "east":
      return buckets.east;
    case "west":
      return buckets.west;
  }
}

function buildNodeEdgeBuckets(
  plans: readonly OutcomeOpportunityConnectorTemplatePlan[],
  index: OutcomeOpportunityPositionedIndex
): Map<string, OutcomeOpportunityNodeEdgeBuckets> {
  const bucketsByNodeId = new Map<string, OutcomeOpportunityNodeEdgeBuckets>();
  for (const nodeId of index.nodeById.keys()) {
    bucketsByNodeId.set(nodeId, buildEmptyNodeEdgeBuckets(nodeId));
  }

  for (const plan of plans) {
    const sourceBuckets = bucketsByNodeId.get(plan.from) ?? buildEmptyNodeEdgeBuckets(plan.from);
    const targetBuckets = bucketsByNodeId.get(plan.to) ?? buildEmptyNodeEdgeBuckets(plan.to);
    getSideBuckets(sourceBuckets, plan.sourceSide).startingConnectorIds.push(plan.id);
    getSideBuckets(targetBuckets, plan.targetSide).endingConnectorIds.push(plan.id);
    bucketsByNodeId.set(plan.from, sourceBuckets);
    bucketsByNodeId.set(plan.to, targetBuckets);
  }

  return bucketsByNodeId;
}

function getObstacleLocalOwnershipCount(
  bucketsByNodeId: ReadonlyMap<string, OutcomeOpportunityNodeEdgeBuckets>,
  nodeId: string,
  side: PortSide
): number {
  const buckets = bucketsByNodeId.get(nodeId);
  if (!buckets) {
    return 0;
  }
  const sideBuckets = getSideBuckets(buckets, side);
  return sideBuckets.startingConnectorIds.length + sideBuckets.endingConnectorIds.length;
}

function buildEndpointOffsets(
  index: OutcomeOpportunityPositionedIndex,
  bucketsByNodeId: ReadonlyMap<string, OutcomeOpportunityNodeEdgeBuckets>,
  sideOrderOverrides: OutcomeOpportunityEndpointSideOrderOverrides = new Map<string, Map<PortSide, OutcomeOpportunityEndpointSideOrderOverride>>()
): ReadonlyMap<string, Map<PortSide, Map<string, number>>> {
  const offsetsByNodeId = new Map<string, Map<PortSide, Map<string, number>>>();

  for (const [nodeId, context] of index.nodeById.entries()) {
    const nodeOffsets = new Map<PortSide, Map<string, number>>();
    const buckets = bucketsByNodeId.get(nodeId) ?? buildEmptyNodeEdgeBuckets(nodeId);
    const nodeOverrides = sideOrderOverrides.get(nodeId);
    const sideLengths: Record<PortSide, number> = {
      north: context.node.width,
      south: context.node.width,
      east: context.node.height,
      west: context.node.height
    };

    (["north", "south", "east", "west"] as const).forEach((side) => {
      const sideBuckets = getSideBuckets(buckets, side);
      const sideOverride = nodeOverrides?.get(side);
      const incoming = getOrderedConnectorIds(sideBuckets.endingConnectorIds, sideOverride?.incomingConnectorIds);
      const outgoing = getOrderedConnectorIds(sideBuckets.startingConnectorIds, sideOverride?.outgoingConnectorIds);
      const longEnough = sideLengths[side] > 2 * Math.max(0, incoming.length + outgoing.length - 1) * ENDPOINT_SPACING;
      const sideOffsets = new Map<string, number>();

      if (incoming.length > 0 && outgoing.length > 0) {
        incoming.forEach((connectorId, indexInGroup) => {
          sideOffsets.set(
            connectorId,
            roundMetric(-(incoming.length - indexInGroup) * ENDPOINT_SPACING)
          );
        });
        outgoing.forEach((connectorId, indexInGroup) => {
          sideOffsets.set(connectorId, roundMetric(indexInGroup * ENDPOINT_SPACING));
        });
      } else {
        const ids = incoming.length > 0 ? incoming : outgoing;
        ids.forEach((connectorId, indexInGroup) => {
          const offset = longEnough
            ? roundMetric(indexInGroup * ENDPOINT_SPACING)
            : roundMetric((indexInGroup - (ids.length - 1) / 2) * ENDPOINT_SPACING);
          sideOffsets.set(connectorId, offset);
        });
      }
      nodeOffsets.set(side, sideOffsets);
    });
    offsetsByNodeId.set(nodeId, nodeOffsets);
  }

  return offsetsByNodeId;
}

function getOrderedConnectorIds(
  connectorIds: readonly string[],
  overrideIds?: readonly string[]
): string[] {
  if (!overrideIds || overrideIds.length === 0) {
    return [...connectorIds];
  }

  const connectorIdSet = new Set(connectorIds);
  const ordered = overrideIds.filter((connectorId, index) =>
    connectorIdSet.has(connectorId) && overrideIds.indexOf(connectorId) === index
  );
  const remaining = connectorIds.filter((connectorId) => !ordered.includes(connectorId));
  return [...ordered, ...remaining];
}

function getEndpointOffset(
  endpointOffsets: ReadonlyMap<string, Map<PortSide, Map<string, number>>>,
  nodeId: string,
  side: PortSide,
  connectorId: string
): number {
  return endpointOffsets.get(nodeId)?.get(side)?.get(connectorId) ?? 0;
}

function sideCoordinateSpan(node: PositionedNode, side: PortSide): { min: number; max: number } {
  if (side === "north" || side === "south") {
    return {
      min: roundMetric(node.x + ENDPOINT_MARGIN),
      max: roundMetric(node.x + Math.max(ENDPOINT_MARGIN, node.width - ENDPOINT_MARGIN))
    };
  }

  return {
    min: roundMetric(node.y + ENDPOINT_MARGIN),
    max: roundMetric(node.y + Math.max(ENDPOINT_MARGIN, node.height - ENDPOINT_MARGIN))
  };
}

function clampMetric(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getSidePointWithOffset(node: PositionedNode, side: PortSide, offset: number): Point {
  const centerX = roundMetric(node.x + node.width / 2);
  const centerY = roundMetric(node.y + node.height / 2);

  switch (side) {
    case "north":
      return {
        x: roundMetric(centerX + offset),
        y: roundMetric(node.y)
      };
    case "south":
      return {
        x: roundMetric(centerX + offset),
        y: roundMetric(node.y + node.height)
      };
    case "east":
      return {
        x: roundMetric(node.x + node.width),
        y: roundMetric(centerY + offset)
      };
    case "west":
      return {
        x: roundMetric(node.x),
        y: roundMetric(centerY + offset)
      };
  }
}

function moveOutward(point: Point, side: PortSide, distance: number): Point {
  switch (side) {
    case "north":
      return { x: point.x, y: roundMetric(point.y - distance) };
    case "south":
      return { x: point.x, y: roundMetric(point.y + distance) };
    case "east":
      return { x: roundMetric(point.x + distance), y: point.y };
    case "west":
      return { x: roundMetric(point.x - distance), y: point.y };
  }
}

function endpointOffsetTrackRank(offset: number): number {
  const steps = Math.round(offset / ENDPOINT_SPACING);
  return Math.max(0, Math.abs(steps) - 1);
}

function resolveExteriorApproachCoordinate(
  point: Point,
  side: PortSide,
  offset: number
): number {
  const distance = ENDPOINT_SPACING * (1 + endpointOffsetTrackRank(offset) * 2);
  switch (side) {
    case "north":
      return roundMetric(point.y - distance);
    case "south":
      return roundMetric(point.y + distance);
    case "east":
      return roundMetric(point.x + distance);
    case "west":
      return roundMetric(point.x - distance);
  }
}

function tryAlignHorizontalEndpoints(
  source: PositionedNode,
  target: PositionedNode,
  sourcePoint: Point,
  targetPoint: Point
): { sourcePoint: Point; targetPoint: Point; aligned: boolean } {
  const overlapTop = Math.max(source.y + ENDPOINT_MARGIN, target.y + ENDPOINT_MARGIN);
  const overlapBottom = Math.min(
    source.y + Math.max(ENDPOINT_MARGIN, source.height - ENDPOINT_MARGIN),
    target.y + Math.max(ENDPOINT_MARGIN, target.height - ENDPOINT_MARGIN)
  );

  if (overlapTop > overlapBottom) {
    return {
      sourcePoint,
      targetPoint,
      aligned: false
    };
  }

  const preferredY = sourcePoint.y >= overlapTop && sourcePoint.y <= overlapBottom
    ? sourcePoint.y
    : targetPoint.y >= overlapTop && targetPoint.y <= overlapBottom
      ? targetPoint.y
      : (sourcePoint.y + targetPoint.y) / 2;
  const sharedY = roundMetric(clampMetric(preferredY, overlapTop, overlapBottom));
  return {
    sourcePoint: { x: sourcePoint.x, y: sharedY },
    targetPoint: { x: targetPoint.x, y: sharedY },
    aligned: true
  };
}

function buildRoute(points: Point[]): PositionedRoute {
  return {
    style: "orthogonal",
    points: collapseRoutePoints(points)
  };
}

function resolveBridgeX(
  sourcePoint: Point,
  targetPoint: Point,
  plan: OutcomeOpportunityConnectorTemplatePlan,
  stage: "step2" | "guttered"
): number {
  const stageOffset = stage === "guttered"
    ? plan.outgoingOrder * ENDPOINT_SPACING
    : 0;
  const preferred = sourcePoint.x <= targetPoint.x
    ? (sourcePoint.x + targetPoint.x) / 2 + stageOffset
    : Math.min(sourcePoint.x, targetPoint.x) - EXTERIOR_STUB * (plan.pattern === "parking_fallback" ? 2 : 1);
  return roundMetric(preferred);
}

function resolveBridgeY(
  sourcePoint: Point,
  targetPoint: Point,
  plan: OutcomeOpportunityConnectorTemplatePlan,
  stage: "step2" | "guttered"
): number {
  const stageOffset = stage === "guttered"
    ? plan.outgoingOrder * ENDPOINT_SPACING
    : 0;
  const preferred = sourcePoint.y <= targetPoint.y
    ? (sourcePoint.y + targetPoint.y) / 2 + stageOffset
    : Math.min(sourcePoint.y, targetPoint.y) - EXTERIOR_STUB * (plan.pattern === "parking_fallback" ? 2 : 1);
  return roundMetric(preferred);
}

function buildEastWestTemplate(
  plan: OutcomeOpportunityConnectorTemplatePlan,
  source: IndexedOutcomeOpportunityNode,
  target: IndexedOutcomeOpportunityNode,
  sourcePoint: Point,
  targetPoint: Point,
  stage: "step2" | "guttered"
): PositionedRoute {
  if (
    (plan.pattern === "same_band_addressing"
      || plan.pattern === "same_band_support"
      || plan.pattern === "same_band_measurement")
    && sourcePoint.x <= targetPoint.x
  ) {
    const aligned = tryAlignHorizontalEndpoints(source.node, target.node, sourcePoint, targetPoint);
    if (aligned.aligned) {
      return buildRoute([aligned.sourcePoint, aligned.targetPoint]);
    }
  }

  const sourceStub = moveOutward(sourcePoint, plan.sourceSide, EXTERIOR_STUB);
  const targetStub = moveOutward(targetPoint, plan.targetSide, EXTERIOR_STUB);
  const bridgeX = resolveBridgeX(sourceStub, targetStub, plan, stage);
  return buildRoute([
    sourcePoint,
    sourceStub,
    { x: bridgeX, y: sourceStub.y },
    { x: bridgeX, y: targetStub.y },
    targetStub,
    targetPoint
  ]);
}

function buildGeneralTemplate(
  plan: OutcomeOpportunityConnectorTemplatePlan,
  sourcePoint: Point,
  targetPoint: Point,
  stage: "step2" | "guttered"
): PositionedRoute {
  const sourceStub = moveOutward(sourcePoint, plan.sourceSide, EXTERIOR_STUB);
  const targetStub = moveOutward(targetPoint, plan.targetSide, EXTERIOR_STUB);
  const bridgeY = resolveBridgeY(sourceStub, targetStub, plan, stage);

  return buildRoute([
    sourcePoint,
    sourceStub,
    { x: sourceStub.x, y: bridgeY },
    { x: targetStub.x, y: bridgeY },
    targetStub,
    targetPoint
  ]);
}

function buildTemplateRoute(
  plan: OutcomeOpportunityConnectorTemplatePlan,
  source: IndexedOutcomeOpportunityNode,
  target: IndexedOutcomeOpportunityNode,
  endpointOffsets: ReadonlyMap<string, Map<PortSide, Map<string, number>>>,
  stage: "step2" | "guttered"
): PositionedRoute {
  const sourcePoint = getSidePointWithOffset(
    source.node,
    plan.sourceSide,
    getEndpointOffset(endpointOffsets, plan.from, plan.sourceSide, plan.id)
  );
  const targetPoint = getSidePointWithOffset(
    target.node,
    plan.targetSide,
    getEndpointOffset(endpointOffsets, plan.to, plan.targetSide, plan.id)
  );

  if (plan.sourceSide === "east" && plan.targetSide === "west") {
    return buildEastWestTemplate(plan, source, target, sourcePoint, targetPoint, stage);
  }

  return buildGeneralTemplate(plan, sourcePoint, targetPoint, stage);
}

function getNonEndpointBoxes(
  plan: OutcomeOpportunityConnectorTemplatePlan,
  index: OutcomeOpportunityPositionedIndex
): OutcomeOpportunityBox[] {
  return index.nodeBoxes.filter((box) => box.itemId !== plan.from && box.itemId !== plan.to);
}

function collectIntersectingBoxes(
  points: Point[],
  boxes: readonly OutcomeOpportunityBox[]
): OutcomeOpportunityBox[] {
  const intersections: OutcomeOpportunityBox[] = [];

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1]!;
    const end = points[index]!;
    for (const box of boxes) {
      const isFirstSegment = index === 1;
      const isLastSegment = index === points.length - 1;
      if (segmentIntersectsBox(start, end, box, {
        ignoreStart: isFirstSegment,
        ignoreEnd: isLastSegment
      })) {
        intersections.push(box);
      }
    }
  }

  return intersections;
}

function findIntersectingBoxesAlongSegment(
  start: Point,
  end: Point,
  boxes: readonly OutcomeOpportunityBox[]
): OutcomeOpportunityBox[] {
  const intersections = boxes.filter((box) => segmentIntersectsBox(start, end, box, {
    ignoreStart: true,
    ignoreEnd: true
  }));

  if (Math.abs(start.x - end.x) <= 0.5) {
    const descending = start.y > end.y;
    return intersections.sort((left, right) => {
      const leftMetric = descending ? left.y + left.height : left.y;
      const rightMetric = descending ? right.y + right.height : right.y;
      return leftMetric - rightMetric;
    });
  }

  const movingLeft = start.x > end.x;
  return intersections.sort((left, right) => {
    const leftMetric = movingLeft ? left.x + left.width : left.x;
    const rightMetric = movingLeft ? right.x + right.width : right.x;
    return leftMetric - rightMetric;
  });
}

function resolveVerticalBridgeX(
  baseX: number,
  plan: OutcomeOpportunityConnectorTemplatePlan,
  index: OutcomeOpportunityPositionedIndex,
  pointsBuilder: (bridgeX: number) => Point[],
  diagnostics: RendererDiagnostic[],
  diagnosticCode: string
): number {
  let bridgeX = baseX;

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const boxes = collectIntersectingBoxes(pointsBuilder(bridgeX), getNonEndpointBoxes(plan, index));
    if (boxes.length === 0) {
      return bridgeX;
    }

    bridgeX = roundMetric(Math.max(bridgeX + ENDPOINT_SPACING, ...boxes.map((box) => box.x + box.width + ENDPOINT_SPACING)));
  }

  diagnostics.push(createRoutingDiagnostic(
    diagnosticCode,
    `Connector "${plan.edgeId}" exhausted vertical obstacle-avoidance attempts while resolving outcome-opportunity routing.`,
    plan.edgeId,
    "warn"
  ));
  return bridgeX;
}

function resolveHorizontalBridgeY(
  baseY: number,
  plan: OutcomeOpportunityConnectorTemplatePlan,
  index: OutcomeOpportunityPositionedIndex,
  pointsBuilder: (bridgeY: number) => Point[],
  diagnostics: RendererDiagnostic[],
  diagnosticCode: string
): number {
  let bridgeY = baseY;

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const boxes = collectIntersectingBoxes(pointsBuilder(bridgeY), getNonEndpointBoxes(plan, index));
    if (boxes.length === 0) {
      return bridgeY;
    }

    bridgeY = roundMetric(Math.max(bridgeY + ENDPOINT_SPACING, ...boxes.map((box) => box.y + box.height + ENDPOINT_SPACING)));
  }

  diagnostics.push(createRoutingDiagnostic(
    diagnosticCode,
    `Connector "${plan.edgeId}" exhausted horizontal obstacle-avoidance attempts while resolving outcome-opportunity routing.`,
    plan.edgeId,
    "warn"
  ));
  return bridgeY;
}

function resolveLocalVerticalDetourX(
  originalX: number,
  encounterY: number,
  exitY: number,
  obstacle: OutcomeOpportunityBox,
  plan: OutcomeOpportunityConnectorTemplatePlan,
  index: OutcomeOpportunityPositionedIndex,
  diagnostics: RendererDiagnostic[]
): number {
  const baseX = roundMetric(Math.max(
    originalX + ENDPOINT_SPACING,
    obstacle.x + obstacle.width + OBSTACLE_SWERVE_CLEARANCE
  ));
  return resolveVerticalBridgeX(
    baseX,
    plan,
    index,
    (candidateBridgeX) => [
      { x: originalX, y: encounterY },
      { x: candidateBridgeX, y: encounterY },
      { x: candidateBridgeX, y: exitY },
      { x: originalX, y: exitY }
    ],
    diagnostics,
    "renderer.routing.outcome_opportunity_vertical_swerve_fallback"
  );
}

function resolveLocalHorizontalDetourY(
  originalY: number,
  encounterX: number,
  exitX: number,
  obstacle: OutcomeOpportunityBox,
  plan: OutcomeOpportunityConnectorTemplatePlan,
  index: OutcomeOpportunityPositionedIndex,
  diagnostics: RendererDiagnostic[]
): number {
  const baseY = roundMetric(Math.max(
    originalY + ENDPOINT_SPACING,
    obstacle.y + obstacle.height + OBSTACLE_SWERVE_CLEARANCE
  ));
  return resolveHorizontalBridgeY(
    baseY,
    plan,
    index,
    (candidateBridgeY) => [
      { x: encounterX, y: originalY },
      { x: encounterX, y: candidateBridgeY },
      { x: exitX, y: candidateBridgeY },
      { x: exitX, y: originalY }
    ],
    diagnostics,
    "renderer.routing.outcome_opportunity_horizontal_swerve_fallback"
  );
}

function buildVerticalSegmentWithLocalSwerves(
  start: Point,
  end: Point,
  plan: OutcomeOpportunityConnectorTemplatePlan,
  index: OutcomeOpportunityPositionedIndex,
  bucketsByNodeId: ReadonlyMap<string, OutcomeOpportunityNodeEdgeBuckets>,
  diagnostics: RendererDiagnostic[]
): OutcomeOpportunityConnectorRouteState {
  const points: Point[] = [start];
  const direction = start.y <= end.y ? 1 : -1;
  const maxSwerveAttempts = Math.max(16, getNonEndpointBoxes(plan, index).length * 4 + 4);
  const visitedCursors = new Set<string>();
  let cursor = start;

  for (let attempt = 0; attempt < maxSwerveAttempts; attempt += 1) {
    const cursorKey = `${roundMetric(cursor.x)}:${roundMetric(cursor.y)}`;
    if (visitedCursors.has(cursorKey)) {
      break;
    }
    visitedCursors.add(cursorKey);
    const obstacle = findIntersectingBoxesAlongSegment(cursor, end, getNonEndpointBoxes(plan, index))[0];
    if (!obstacle) {
      points.push(end);
      return {
        route: buildRoute(points),
        occupiedGutters: []
      };
    }

    const northOwnershipCount = getObstacleLocalOwnershipCount(bucketsByNodeId, obstacle.itemId, "north");
    const southOwnershipCount = getObstacleLocalOwnershipCount(bucketsByNodeId, obstacle.itemId, "south");
    const encounterY = roundMetric(
      direction > 0
        ? obstacle.y - OBSTACLE_SWERVE_CLEARANCE - northOwnershipCount * ENDPOINT_SPACING
        : obstacle.y + obstacle.height + OBSTACLE_SWERVE_CLEARANCE + southOwnershipCount * ENDPOINT_SPACING
    );
    const exitY = roundMetric(
      direction > 0
        ? obstacle.y + obstacle.height + OBSTACLE_SWERVE_CLEARANCE + southOwnershipCount * ENDPOINT_SPACING
        : obstacle.y - OBSTACLE_SWERVE_CLEARANCE - northOwnershipCount * ENDPOINT_SPACING
    );
    const bridgeX = resolveLocalVerticalDetourX(cursor.x, encounterY, exitY, obstacle, plan, index, diagnostics);

    if (cursor.y !== encounterY) {
      points.push({
        x: cursor.x,
        y: encounterY
      });
    }
    points.push(
      {
        x: bridgeX,
        y: encounterY
      },
      {
        x: bridgeX,
        y: exitY
      },
      {
        x: cursor.x,
        y: exitY
      }
    );

    cursor = {
      x: cursor.x,
      y: exitY
    };
  }

  diagnostics.push(createRoutingDiagnostic(
    "renderer.routing.outcome_opportunity_vertical_swerve_fallback",
    `Connector "${plan.edgeId}" exhausted local vertical obstacle-avoidance attempts while resolving outcome-opportunity routing.`,
    plan.edgeId,
    "warn"
  ));
  points.push(end);
  return {
    route: buildRoute(points),
    occupiedGutters: []
  };
}

function buildHorizontalSegmentWithLocalSwerves(
  start: Point,
  end: Point,
  plan: OutcomeOpportunityConnectorTemplatePlan,
  index: OutcomeOpportunityPositionedIndex,
  bucketsByNodeId: ReadonlyMap<string, OutcomeOpportunityNodeEdgeBuckets>,
  diagnostics: RendererDiagnostic[]
): OutcomeOpportunityConnectorRouteState {
  const points: Point[] = [start];
  const movingRight = start.x <= end.x;
  const maxSwerveAttempts = Math.max(16, getNonEndpointBoxes(plan, index).length * 4 + 4);
  const visitedCursors = new Set<string>();
  let cursor = start;

  for (let attempt = 0; attempt < maxSwerveAttempts; attempt += 1) {
    const cursorKey = `${roundMetric(cursor.x)}:${roundMetric(cursor.y)}`;
    if (visitedCursors.has(cursorKey)) {
      break;
    }
    visitedCursors.add(cursorKey);
    const obstacle = findIntersectingBoxesAlongSegment(cursor, end, getNonEndpointBoxes(plan, index))[0];
    if (!obstacle) {
      points.push(end);
      return {
        route: buildRoute(points),
        occupiedGutters: []
      };
    }

    const westOwnershipCount = getObstacleLocalOwnershipCount(bucketsByNodeId, obstacle.itemId, "west");
    const eastOwnershipCount = getObstacleLocalOwnershipCount(bucketsByNodeId, obstacle.itemId, "east");
    const encounterX = roundMetric(
      movingRight
        ? obstacle.x - OBSTACLE_SWERVE_CLEARANCE - westOwnershipCount * ENDPOINT_SPACING
        : obstacle.x + obstacle.width + OBSTACLE_SWERVE_CLEARANCE + eastOwnershipCount * ENDPOINT_SPACING
    );
    const exitX = roundMetric(
      movingRight
        ? obstacle.x + obstacle.width + OBSTACLE_SWERVE_CLEARANCE + eastOwnershipCount * ENDPOINT_SPACING
        : obstacle.x - OBSTACLE_SWERVE_CLEARANCE - westOwnershipCount * ENDPOINT_SPACING
    );
    const bridgeY = resolveLocalHorizontalDetourY(cursor.y, encounterX, exitX, obstacle, plan, index, diagnostics);

    if (cursor.x !== encounterX) {
      points.push({
        x: encounterX,
        y: cursor.y
      });
    }
    points.push(
      {
        x: encounterX,
        y: bridgeY
      },
      {
        x: exitX,
        y: bridgeY
      },
      {
        x: exitX,
        y: cursor.y
      }
    );

    cursor = {
      x: exitX,
      y: cursor.y
    };
  }

  diagnostics.push(createRoutingDiagnostic(
    "renderer.routing.outcome_opportunity_horizontal_swerve_fallback",
    `Connector "${plan.edgeId}" exhausted local horizontal obstacle-avoidance attempts while resolving outcome-opportunity routing.`,
    plan.edgeId,
    "warn"
  ));
  points.push(end);
  return {
    route: buildRoute(points),
    occupiedGutters: []
  };
}

function buildRouteWithLocalSwerves(
  route: PositionedRoute,
  plan: OutcomeOpportunityConnectorTemplatePlan,
  index: OutcomeOpportunityPositionedIndex,
  bucketsByNodeId: ReadonlyMap<string, OutcomeOpportunityNodeEdgeBuckets>,
  diagnostics: RendererDiagnostic[]
): OutcomeOpportunityConnectorRouteState {
  const points: Point[] = [];

  for (let pointIndex = 1; pointIndex < route.points.length; pointIndex += 1) {
    const start = route.points[pointIndex - 1]!;
    const end = route.points[pointIndex]!;
    const state = start.x === end.x
      ? buildVerticalSegmentWithLocalSwerves(start, end, plan, index, bucketsByNodeId, diagnostics)
      : buildHorizontalSegmentWithLocalSwerves(start, end, plan, index, bucketsByNodeId, diagnostics);
    if (points.length === 0) {
      points.push(...state.route.points);
    } else {
      points.push(...state.route.points.slice(1));
    }
  }

  return {
    route: buildRoute(points.length > 0 ? points : route.points),
    occupiedGutters: []
  };
}

function applyLocalSwervesToStep3Plans(
  plans: readonly OutcomeOpportunityConnectorTemplatePlan[],
  index: OutcomeOpportunityPositionedIndex,
  bucketsByNodeId: ReadonlyMap<string, OutcomeOpportunityNodeEdgeBuckets>,
  diagnostics: RendererDiagnostic[]
): OutcomeOpportunityConnectorTemplatePlan[] {
  return plans.map((plan) => {
    if (!index.nodeById.has(plan.from) || !index.nodeById.has(plan.to)) {
      return plan;
    }
    const state = buildRouteWithLocalSwerves(plan.step3Route, plan, index, bucketsByNodeId, diagnostics);
    return {
      ...plan,
      step3Route: state.route
    };
  });
}

function buildConnectorPlans(
  measuredScene: MeasuredScene,
  middleLayer: OutcomeOpportunityMiddleLayerModel,
  index: OutcomeOpportunityPositionedIndex,
  diagnostics: RendererDiagnostic[]
): OutcomeOpportunityConnectorTemplatePlan[] {
  const measuredEdgeById = new Map(measuredScene.edges.map((edge) => [edge.id, edge] as const));
  const middleEdgeById = new Map(middleLayer.edges.map((edge) => [edge.id, edge] as const));
  const plans: OutcomeOpportunityConnectorTemplatePlan[] = [];

  for (const connector of middleLayer.connectorPlans) {
    const edge = middleEdgeById.get(connector.edgeId);
    const measuredEdge = measuredEdgeById.get(connector.edgeId);
    const source = index.nodeById.get(edge?.from ?? "");
    const target = index.nodeById.get(edge?.to ?? "");
    if (!edge || !measuredEdge || !source || !target) {
      diagnostics.push(createRoutingDiagnostic(
        "renderer.routing.outcome_opportunity_unresolved_connector",
        `Could not resolve both positioned endpoints for outcome-opportunity connector "${connector.edgeId}".`,
        connector.edgeId,
        "warn"
      ));
      continue;
    }

    const endpointSpecs = endpointSpecsForChannel(edge.channel);
    const sourcePort = resolvePort(edge.id, source, endpointSpecs.source.portRole, diagnostics);
    const targetPort = resolvePort(edge.id, target, endpointSpecs.target.portRole, diagnostics);
    if (!sourcePort || !targetPort) {
      continue;
    }

    const pattern = determinePattern(edge, source, target);
    if (pattern === "parking_fallback") {
      diagnostics.push(createRoutingDiagnostic(
        "renderer.routing.outcome_opportunity_parking_connector",
        `Connector "${edge.id}" uses deterministic parking fallback routing because at least one endpoint is in a parking band.`,
        edge.id,
        "info"
      ));
    }

    plans.push({
      id: connector.id,
      edgeId: edge.id,
      semanticEdgeIds: [...edge.semanticEdgeIds],
      type: edge.type,
      channel: edge.channel,
      from: edge.from,
      to: edge.to,
      priority: connector.priority,
      sourceSide: endpointSpecs.source.side,
      targetSide: endpointSpecs.target.side,
      sourcePortId: sourcePort.id,
      targetPortId: targetPort.id,
      sourceSemanticBandOrder: connector.sourceSemanticBandOrder,
      sourcePhysicalSlotOrder: connector.sourcePhysicalSlotOrder,
      sourceColumnOrder: connector.sourceColumnOrder,
      sourceAuthorOrder: connector.sourceAuthorOrder,
      outgoingOrder: connector.outgoingOrder,
      targetStableId: connector.targetStableId,
      pattern,
      role: measuredEdge.role,
      classes: [
        ...measuredEdge.classes,
        `route-pattern-${pattern}`
      ],
      markers: measuredEdge.markers,
      label: measuredEdge.label,
      step2Route: {
        style: "orthogonal",
        points: []
      },
      step3Route: {
        style: "orthogonal",
        points: []
      },
      finalRoute: {
        style: "orthogonal",
        points: []
      }
    });
  }

  return plans.sort((left, right) =>
    left.priority - right.priority
    || left.sourceSemanticBandOrder - right.sourceSemanticBandOrder
    || left.sourcePhysicalSlotOrder - right.sourcePhysicalSlotOrder
    || left.sourceColumnOrder - right.sourceColumnOrder
    || left.sourceAuthorOrder - right.sourceAuthorOrder
    || left.outgoingOrder - right.outgoingOrder
    || left.targetStableId.localeCompare(right.targetStableId)
    || left.id.localeCompare(right.id)
  );
}

function compareConnectorPlanPriority(
  left: OutcomeOpportunityConnectorTemplatePlan,
  right: OutcomeOpportunityConnectorTemplatePlan
): number {
  return left.priority - right.priority
    || left.sourceSemanticBandOrder - right.sourceSemanticBandOrder
    || left.sourcePhysicalSlotOrder - right.sourcePhysicalSlotOrder
    || left.sourceColumnOrder - right.sourceColumnOrder
    || left.sourceAuthorOrder - right.sourceAuthorOrder
    || left.outgoingOrder - right.outgoingOrder
    || left.targetStableId.localeCompare(right.targetStableId)
    || left.id.localeCompare(right.id);
}

function getPrimaryOrientationForSide(side: PortSide): OutcomeOpportunityRouteSegment["orientation"] {
  return side === "north" || side === "south" ? "vertical" : "horizontal";
}

function getSecondaryOrientationForSide(side: PortSide): OutcomeOpportunityRouteSegment["orientation"] {
  return getPrimaryOrientationForSide(side) === "vertical" ? "horizontal" : "vertical";
}

function getPreferredPreparedStemCoordinate(
  plan: OutcomeOpportunityConnectorTemplatePlan,
  route: PositionedRoute,
  endpointRole: EndpointRole
): number | undefined {
  const side = endpointRole === "source" ? plan.sourceSide : plan.targetSide;
  const primaryOrientation = getPrimaryOrientationForSide(side);
  const secondaryOrientation = getSecondaryOrientationForSide(side);
  const segments = buildRouteSegmentDetails(route);

  if (segments.length === 0) {
    return undefined;
  }

  if (endpointRole === "source") {
    const firstTurnIndex = segments.findIndex((segment) => segment.orientation === secondaryOrientation);
    if (firstTurnIndex >= 0) {
      for (let segmentIndex = firstTurnIndex + 1; segmentIndex < segments.length; segmentIndex += 1) {
        const candidate = segments[segmentIndex]!;
        if (candidate.orientation === primaryOrientation) {
          return candidate.coordinate;
        }
      }
    }

    return segments.find((segment) => segment.orientation === primaryOrientation)?.coordinate;
  }

  for (let segmentIndex = segments.length - 1; segmentIndex >= 0; segmentIndex -= 1) {
    if (segments[segmentIndex]!.orientation !== secondaryOrientation) {
      continue;
    }
    for (let candidateIndex = segmentIndex - 1; candidateIndex >= 0; candidateIndex -= 1) {
      const candidate = segments[candidateIndex]!;
      if (candidate.orientation === primaryOrientation) {
        return candidate.coordinate;
      }
    }
    break;
  }

  for (let segmentIndex = segments.length - 1; segmentIndex >= 0; segmentIndex -= 1) {
    const candidate = segments[segmentIndex]!;
    if (candidate.orientation === primaryOrientation) {
      return candidate.coordinate;
    }
  }

  return undefined;
}

function buildPreferredEndpointSideOrderOverrides(
  plans: readonly OutcomeOpportunityConnectorTemplatePlan[],
  bucketsByNodeId: ReadonlyMap<string, OutcomeOpportunityNodeEdgeBuckets>,
  routeStates: ReadonlyMap<string, OutcomeOpportunityConnectorRouteState>
): OutcomeOpportunityEndpointSideOrderOverrides {
  const planById = new Map(plans.map((plan) => [plan.id, plan] as const));
  const overrides = new Map<string, Map<PortSide, OutcomeOpportunityEndpointSideOrderOverride>>();

  const compareByPriority = (leftId: string, rightId: string): number => {
    const leftPlan = planById.get(leftId);
    const rightPlan = planById.get(rightId);
    if (!leftPlan || !rightPlan) {
      return leftId.localeCompare(rightId);
    }
    return compareConnectorPlanPriority(leftPlan, rightPlan);
  };

  const compareByPreparedStem = (
    leftId: string,
    rightId: string,
    endpointRole: EndpointRole
  ): number => {
    const leftPlan = planById.get(leftId);
    const rightPlan = planById.get(rightId);
    const leftRoute = routeStates.get(leftId)?.route;
    const rightRoute = routeStates.get(rightId)?.route;
    const leftCoordinate = leftPlan && leftRoute
      ? getPreferredPreparedStemCoordinate(leftPlan, leftRoute, endpointRole)
      : undefined;
    const rightCoordinate = rightPlan && rightRoute
      ? getPreferredPreparedStemCoordinate(rightPlan, rightRoute, endpointRole)
      : undefined;

    if (leftCoordinate !== undefined && rightCoordinate !== undefined && Math.abs(leftCoordinate - rightCoordinate) > 0.5) {
      return leftCoordinate - rightCoordinate;
    }
    if (leftCoordinate !== undefined && rightCoordinate === undefined) {
      return -1;
    }
    if (leftCoordinate === undefined && rightCoordinate !== undefined) {
      return 1;
    }
    return compareByPriority(leftId, rightId);
  };

  for (const [nodeId, buckets] of bucketsByNodeId.entries()) {
    for (const side of ["north", "south", "east", "west"] as const) {
      const sideBuckets = getSideBuckets(buckets, side);
      const preferredIncoming = [...sideBuckets.endingConnectorIds].sort((leftId, rightId) =>
        compareByPreparedStem(leftId, rightId, "target")
      );
      const preferredOutgoing = [...sideBuckets.startingConnectorIds].sort((leftId, rightId) =>
        compareByPreparedStem(leftId, rightId, "source")
      );

      if (arraysEqual(preferredIncoming, sideBuckets.endingConnectorIds)
        && arraysEqual(preferredOutgoing, sideBuckets.startingConnectorIds)) {
        continue;
      }

      let sideOverrides = overrides.get(nodeId);
      if (!sideOverrides) {
        sideOverrides = new Map<PortSide, OutcomeOpportunityEndpointSideOrderOverride>();
        overrides.set(nodeId, sideOverrides);
      }
      sideOverrides.set(side, {
        incomingConnectorIds: preferredIncoming,
        outgoingConnectorIds: preferredOutgoing
      });
    }
  }

  return overrides;
}

function routeEndpoint(
  route: PositionedRoute,
  role: EndpointRole
): Point {
  const points = route.points;
  const point = role === "source" ? points[0] : points[points.length - 1];
  return point ?? { x: 0, y: 0 };
}

function buildPositionedEdges(
  plans: readonly OutcomeOpportunityConnectorTemplatePlan[],
  getRoute: (plan: OutcomeOpportunityConnectorTemplatePlan) => PositionedRoute,
  labelsByPlanId: ReadonlyMap<string, PositionedEdge["label"]> = new Map()
): PositionedEdge[] {
  return plans.map((plan) => ({
    id: plan.edgeId,
    role: plan.role,
    classes: [...plan.classes],
    from: {
      itemId: plan.from,
      portId: plan.sourcePortId,
      ...routeEndpoint(getRoute(plan), "source")
    },
    to: {
      itemId: plan.to,
      portId: plan.targetPortId,
      ...routeEndpoint(getRoute(plan), "target")
    },
    route: {
      style: getRoute(plan).style,
      points: getRoute(plan).points.map((point) => ({ ...point }))
    },
    label: labelsByPlanId.get(plan.id),
    markers: plan.markers,
    paintGroup: "edges" satisfies PaintGroup
  }));
}

function getNextValue(values: ReadonlyMap<number, number>, order: number): number | undefined {
  return [...values.entries()]
    .filter(([candidateOrder]) => candidateOrder > order)
    .sort(([leftOrder], [rightOrder]) => leftOrder - rightOrder)[0]?.[1];
}

function buildNodeGutters(index: OutcomeOpportunityPositionedIndex): OutcomeOpportunityNodeGutter[] {
  return [...index.nodeById.values()].map((context) => {
    const cell = context.cell ?? index.cellById.get(context.placement.cellId);
    const columnOrder = cell?.columnOrder ?? context.placement.columnOrder;
    const rowOrder = cell?.rowOrder ?? context.placement.rowOrder;
    const nextColumnLeft = getNextValue(index.columnLeftByOrder, columnOrder);
    const nextRowTop = getNextValue(index.rowTopByOrder, rowOrder);

    return {
      nodeId: context.node.id,
      cellId: context.placement.cellId,
      columnOrder,
      rowOrder,
      rightAvailable: roundMetric(Math.max(0, (nextColumnLeft ?? (context.node.x + context.node.width)) - (context.node.x + context.node.width))),
      bottomAvailable: roundMetric(Math.max(0, (nextRowTop ?? (context.node.y + context.node.height)) - (context.node.y + context.node.height)))
    };
  }).sort((left, right) =>
    left.rowOrder - right.rowOrder
    || left.columnOrder - right.columnOrder
    || left.nodeId.localeCompare(right.nodeId)
  );
}

function buildGlobalGutterState(
  columnExpansions: Record<number, number> = {},
  rowExpansions: Record<number, number> = {}
): OutcomeOpportunityGlobalGutterState {
  return {
    columnExpansions,
    rowExpansions
  };
}

function maxRecordValue(record: Record<number, number>): number {
  return Math.max(0, ...Object.values(record));
}

function hasNonZeroExpansion(state: OutcomeOpportunityGlobalGutterState): boolean {
  return maxRecordValue(state.columnExpansions) > 0 || maxRecordValue(state.rowExpansions) > 0;
}

function accumulateExpansion(target: Record<number, number>, order: number, amount: number): void {
  if (amount <= 0) {
    return;
  }
  target[order] = roundMetric(Math.max(target[order] ?? 0, amount));
}

function mergeExpansionRecords(...records: ReadonlyArray<Record<number, number>>): Record<number, number> {
  const merged: Record<number, number> = {};
  for (const record of records) {
    for (const [order, amount] of Object.entries(record)) {
      accumulateExpansion(merged, Number(order), amount);
    }
  }
  return merged;
}

function countSideBucketConnectors(buckets: OutcomeOpportunityNodeEdgeBuckets, side: PortSide): number {
  const sideBuckets = getSideBuckets(buckets, side);
  return sideBuckets.startingConnectorIds.length + sideBuckets.endingConnectorIds.length;
}

function resolveRequiredEndpointGapExpansions(
  plans: readonly OutcomeOpportunityConnectorTemplatePlan[],
  index: OutcomeOpportunityPositionedIndex,
  bucketsByNodeId: ReadonlyMap<string, OutcomeOpportunityNodeEdgeBuckets>
): OutcomeOpportunityGlobalGutterState {
  const columnExpansions: Record<number, number> = {};
  const rowExpansions: Record<number, number> = {};
  const gutterByNodeId = new Map(buildNodeGutters(index).map((gutter) => [gutter.nodeId, gutter] as const));

  for (const [nodeId, buckets] of bucketsByNodeId.entries()) {
    const gutter = gutterByNodeId.get(nodeId);
    if (!gutter) {
      continue;
    }
    const rightConnectorCount = countSideBucketConnectors(buckets, "east");
    const bottomConnectorCount = countSideBucketConnectors(buckets, "south");
    const requiredRight = Math.max(0, (rightConnectorCount - 1) * ENDPOINT_SPACING + EXTERIOR_STUB);
    const requiredBottom = Math.max(0, (bottomConnectorCount - 1) * ENDPOINT_SPACING + EXTERIOR_STUB);
    accumulateExpansion(columnExpansions, gutter.columnOrder, requiredRight - gutter.rightAvailable);
    accumulateExpansion(rowExpansions, gutter.rowOrder, requiredBottom - gutter.bottomAvailable);
  }

  for (const plan of plans) {
    const source = index.nodeById.get(plan.from);
    const target = index.nodeById.get(plan.to);
    if (!source || !target) {
      continue;
    }
    if (plan.sourceSide === "east" && plan.targetSide === "west" && source.placement.columnOrder < target.placement.columnOrder) {
      const availableGap = roundMetric(target.node.x - (source.node.x + source.node.width));
      const routeNeed = EXTERIOR_STUB * 2 + (plan.outgoingOrder * ENDPOINT_SPACING);
      accumulateExpansion(columnExpansions, source.placement.columnOrder, routeNeed - availableGap);
    }
  }

  return buildGlobalGutterState(columnExpansions, rowExpansions);
}

function getNodeCenterY(node: PositionedNode): number {
  return roundMetric(node.y + node.height / 2);
}

function maxOverlappingIntervals(intervals: ReadonlyArray<{ start: number; end: number }>): number {
  let maxOverlap = 0;

  for (let index = 0; index < intervals.length; index += 1) {
    const current = intervals[index]!;
    let overlapCount = 0;
    for (const candidate of intervals) {
      if (Math.min(current.end, candidate.end) - Math.max(current.start, candidate.start) > 0.5) {
        overlapCount += 1;
      }
    }
    maxOverlap = Math.max(maxOverlap, overlapCount);
  }

  return maxOverlap;
}

function resolveRequiredLabelColumnExpansions(
  plans: readonly OutcomeOpportunityConnectorTemplatePlan[],
  index: OutcomeOpportunityPositionedIndex
): Record<number, number> {
  const columnExpansions: Record<number, number> = {};
  const demandByColumnOrder = new Map<number, {
    widestLabelWidth: number;
    availableGap: number;
    intervals: Array<{ start: number; end: number }>;
  }>();

  for (const plan of plans) {
    if (!plan.label || plan.sourceSide !== "east" || plan.targetSide !== "west") {
      continue;
    }

    const source = index.nodeById.get(plan.from);
    const target = index.nodeById.get(plan.to);
    if (!source || !target || source.placement.columnOrder >= target.placement.columnOrder) {
      continue;
    }

    const columnOrder = source.placement.columnOrder;
    const availableGap = roundMetric(target.node.x - (source.node.x + source.node.width));
    const sourceY = getNodeCenterY(source.node);
    const targetY = getNodeCenterY(target.node);
    const spanStart = Math.min(sourceY, targetY);
    const spanEnd = Math.max(sourceY, targetY);
    const existing = demandByColumnOrder.get(columnOrder) ?? {
      widestLabelWidth: 0,
      availableGap,
      intervals: []
    };
    existing.widestLabelWidth = Math.max(existing.widestLabelWidth, plan.label.width);
    existing.availableGap = Math.min(existing.availableGap, availableGap);
    existing.intervals.push({
      start: roundMetric(spanStart),
      end: roundMetric(spanEnd <= spanStart + 0.5 ? spanStart + 1 : spanEnd)
    });
    demandByColumnOrder.set(columnOrder, existing);
  }

  for (const [columnOrder, demand] of demandByColumnOrder.entries()) {
    const trackCount = maxOverlappingIntervals(demand.intervals);
    const routeTrackWidth = roundMetric(trackCount * ENDPOINT_SPACING);
    const required = roundMetric(demand.widestLabelWidth + HORIZONTAL_LABEL_GAP + routeTrackWidth);
    accumulateExpansion(columnExpansions, columnOrder, required - demand.availableGap);
  }

  return columnExpansions;
}

function resolveRequiredLabelRowExpansions(
  plans: readonly OutcomeOpportunityConnectorTemplatePlan[],
  index: OutcomeOpportunityPositionedIndex
): Record<number, number> {
  const rowExpansions: Record<number, number> = {};

  for (const plan of plans) {
    if (!plan.label || plan.sourceSide !== "south" || plan.targetSide !== "north") {
      continue;
    }

    const source = index.nodeById.get(plan.from);
    const target = index.nodeById.get(plan.to);
    if (!source || !target || source.placement.rowOrder > target.placement.rowOrder) {
      continue;
    }

    const availableGap = roundMetric(target.node.y - (source.node.y + source.node.height));
    const required = roundMetric(plan.label.height + VERTICAL_LABEL_GAP);
    accumulateExpansion(rowExpansions, source.placement.rowOrder, required - availableGap);
  }

  return rowExpansions;
}

function resolveRequiredGlobalGutterState(
  plans: readonly OutcomeOpportunityConnectorTemplatePlan[],
  index: OutcomeOpportunityPositionedIndex,
  bucketsByNodeId: ReadonlyMap<string, OutcomeOpportunityNodeEdgeBuckets>
): OutcomeOpportunityGlobalGutterState {
  const endpointGapExpansions = resolveRequiredEndpointGapExpansions(plans, index, bucketsByNodeId);
  const labelColumnExpansions = resolveRequiredLabelColumnExpansions(plans, index);
  const labelRowExpansions = resolveRequiredLabelRowExpansions(plans, index);

  return buildGlobalGutterState(
    mergeExpansionRecords(endpointGapExpansions.columnExpansions, labelColumnExpansions),
    mergeExpansionRecords(endpointGapExpansions.rowExpansions, labelRowExpansions)
  );
}

function translatePositionedItem(item: PositionedItem, dx: number, dy: number): void {
  item.x = roundMetric(item.x + dx);
  item.y = roundMetric(item.y + dy);
  if (item.kind === "container") {
    for (const child of item.children) {
      translatePositionedItem(child, dx, dy);
    }
  }
}

function cumulativeExpansion(record: Record<number, number>, order: number): number {
  return roundMetric(Object.entries(record)
    .filter(([candidateOrder]) => order > Number(candidateOrder))
    .reduce((sum, [, value]) => sum + value, 0));
}

function applyGlobalGutterExpansions(
  scene: PositionedScene,
  state: OutcomeOpportunityGlobalGutterState
): PositionedScene {
  const expanded = structuredClone(scene) as PositionedScene;
  let maxRight = 0;
  let maxBottom = 0;

  for (const child of expanded.root.children) {
    if (!isOutcomeOpportunityCell(child)) {
      maxRight = Math.max(maxRight, child.x + child.width);
      maxBottom = Math.max(maxBottom, child.y + child.height);
      continue;
    }
    const metadata = child.viewMetadata.outcomeOpportunity;
    const dx = cumulativeExpansion(state.columnExpansions, metadata.columnOrder);
    const dy = cumulativeExpansion(state.rowExpansions, metadata.rowOrder);
    if (dx !== 0 || dy !== 0) {
      translatePositionedItem(child, dx, dy);
    }
    maxRight = Math.max(maxRight, child.x + child.width);
    maxBottom = Math.max(maxBottom, child.y + child.height);
  }

  const rootRightPadding = Math.max(expanded.root.chrome.padding.right, 28);
  const rootBottomPadding = Math.max(expanded.root.chrome.padding.bottom, 28);
  expanded.root.width = roundMetric(Math.max(expanded.root.width, maxRight + rootRightPadding));
  expanded.root.height = roundMetric(Math.max(expanded.root.height, maxBottom + rootBottomPadding));
  return decorateOutcomeOpportunityPositionedScene({
    ...expanded,
    decorations: []
  });
}

function buildGutterRects(
  scene: PositionedScene,
  index: OutcomeOpportunityPositionedIndex,
  globalGutterState: OutcomeOpportunityGlobalGutterState
): OutcomeOpportunityGutterRect[] {
  const rects: OutcomeOpportunityGutterRect[] = [];

  for (const context of index.nodeById.values()) {
    const cell = context.cell ?? index.cellById.get(context.placement.cellId);
    const columnOrder = cell?.columnOrder ?? context.placement.columnOrder;
    const rowOrder = cell?.rowOrder ?? context.placement.rowOrder;
    const columnExpansion = globalGutterState.columnExpansions[columnOrder] ?? 0;
    const rowExpansion = globalGutterState.rowExpansions[rowOrder] ?? 0;
    const nextColumnLeft = getNextValue(index.columnLeftByOrder, columnOrder) ?? roundMetric(context.node.x + context.node.width);
    const nextRowTop = getNextValue(index.rowTopByOrder, rowOrder) ?? roundMetric(context.node.y + context.node.height);
    const rightLimit = roundMetric(nextColumnLeft - columnExpansion);
    const bottomLimit = roundMetric(nextRowTop - rowExpansion);
    const rightWidth = roundMetric(Math.max(0, rightLimit - (context.node.x + context.node.width)));
    const bottomHeight = roundMetric(Math.max(0, bottomLimit - (context.node.y + context.node.height)));

    if (rightWidth > 0) {
      rects.push({
        key: `node:${context.node.id}:right`,
        kind: "node_right",
        nodeId: context.node.id,
        columnOrder,
        rowOrder,
        x: roundMetric(context.node.x + context.node.width),
        y: roundMetric(context.node.y),
        width: rightWidth,
        height: roundMetric(context.node.height)
      });
    }

    if (bottomHeight > 0) {
      rects.push({
        key: `node:${context.node.id}:bottom`,
        kind: "node_bottom",
        nodeId: context.node.id,
        columnOrder,
        rowOrder,
        x: roundMetric(context.node.x),
        y: roundMetric(context.node.y + context.node.height),
        width: roundMetric(context.node.width),
        height: bottomHeight
      });
    }
  }

  for (const [columnOrder, expansionWidth] of Object.entries(globalGutterState.columnExpansions)) {
    const numericOrder = Number(columnOrder);
    if (expansionWidth <= 0) {
      continue;
    }
    const nextColumnLeft = getNextValue(index.columnLeftByOrder, numericOrder);
    const x = nextColumnLeft === undefined
      ? roundMetric(index.columnRightByOrder.get(numericOrder) ?? 0)
      : roundMetric(nextColumnLeft - expansionWidth);
    rects.push({
      key: `column:${numericOrder}:expanded`,
      kind: "column",
      columnOrder: numericOrder,
      x,
      y: 0,
      width: roundMetric(expansionWidth),
      height: roundMetric(scene.root.height)
    });
  }

  for (const [rowOrder, expansionHeight] of Object.entries(globalGutterState.rowExpansions)) {
    const numericOrder = Number(rowOrder);
    if (expansionHeight <= 0) {
      continue;
    }
    const nextRowTop = getNextValue(index.rowTopByOrder, numericOrder);
    const y = nextRowTop === undefined
      ? roundMetric(index.rowBottomByOrder.get(numericOrder) ?? 0)
      : roundMetric(nextRowTop - expansionHeight);
    rects.push({
      key: `row:${numericOrder}:expanded`,
      kind: "band",
      rowOrder: numericOrder,
      x: 0,
      y,
      width: roundMetric(scene.root.width),
      height: roundMetric(expansionHeight)
    });
  }

  return rects.sort((left, right) =>
    left.key.localeCompare(right.key)
    || left.x - right.x
    || left.y - right.y
  );
}

function buildLocalGutterRects(
  scene: PositionedScene,
  index: OutcomeOpportunityPositionedIndex,
  globalGutterState: OutcomeOpportunityGlobalGutterState
): OutcomeOpportunityLocalGutterRect[] {
  return buildGutterRects(scene, index, globalGutterState)
    .filter((rect): rect is OutcomeOpportunityLocalGutterRect =>
      (rect.kind === "node_bottom" || rect.kind === "node_right") && rect.nodeId !== undefined
    );
}

function resolveExpandedBundleLimit(
  rect: OutcomeOpportunityLocalGutterRect,
  index: OutcomeOpportunityPositionedIndex
): number {
  if (rect.kind === "node_bottom" && rect.rowOrder !== undefined) {
    return getNextValue(index.rowTopByOrder, rect.rowOrder) ?? roundMetric(rect.y + rect.height);
  }

  if (rect.kind === "node_right" && rect.columnOrder !== undefined) {
    return getNextValue(index.columnLeftByOrder, rect.columnOrder) ?? roundMetric(rect.x + rect.width);
  }

  return rect.kind === "node_bottom"
    ? roundMetric(rect.y + rect.height)
    : roundMetric(rect.x + rect.width);
}

function buildSegmentOccupancy(
  connectorId: string,
  route: PositionedRoute,
  index: OutcomeOpportunityPositionedIndex
): OutcomeOpportunityGutterOccupancy[] {
  const occupancy: OutcomeOpportunityGutterOccupancy[] = [];
  const resolveColumnOwnership = (x: number): { key: string; columnOrder?: number } => {
    const containing = [...index.columnLeftByOrder.entries()]
      .filter(([order, left]) => {
        const right = index.columnRightByOrder.get(order);
        return right !== undefined && x >= left - 0.5 && x <= right + 0.5;
      })
      .sort(([leftOrder], [rightOrder]) => leftOrder - rightOrder)[0]?.[0];
    if (containing !== undefined) {
      return {
        key: `column:${containing}:inside`,
        columnOrder: containing
      };
    }

    const previous = [...index.columnRightByOrder.entries()]
      .filter(([, right]) => right <= x + 0.5)
      .sort(([leftOrder], [rightOrder]) => rightOrder - leftOrder)[0]?.[0];
    return {
      key: previous === undefined ? `edge:${connectorId}` : `column:${previous}:right`,
      columnOrder: previous
    };
  };
  const resolveRowOwnership = (y: number): { key: string; rowOrder?: number } => {
    const containing = [...index.rowTopByOrder.entries()]
      .filter(([order, top]) => {
        const bottom = index.rowBottomByOrder.get(order);
        return bottom !== undefined && y >= top - 0.5 && y <= bottom + 0.5;
      })
      .sort(([leftOrder], [rightOrder]) => leftOrder - rightOrder)[0]?.[0];
    if (containing !== undefined) {
      return {
        key: `row:${containing}:inside`,
        rowOrder: containing
      };
    }

    const previous = [...index.rowBottomByOrder.entries()]
      .filter(([, bottom]) => bottom <= y + 0.5)
      .sort(([leftOrder], [rightOrder]) => rightOrder - leftOrder)[0]?.[0];
    return {
      key: previous === undefined ? `edge:${connectorId}` : `row:${previous}:below`,
      rowOrder: previous
    };
  };

  for (const segment of buildRouteSegmentDetails(route)) {
    if (segment.orientation === "vertical") {
      const ownership = resolveColumnOwnership(segment.coordinate);
      occupancy.push({
        connectorId,
        key: ownership.columnOrder === undefined ? `${ownership.key}:segment:${segment.routeSegmentIndex}` : ownership.key,
        axis: "vertical",
        kind: ownership.columnOrder === undefined ? "edge_local" : "column",
        nominalCoordinate: roundMetric(segment.coordinate),
        spanStart: roundMetric(Math.min(segment.start.y, segment.end.y)),
        spanEnd: roundMetric(Math.max(segment.start.y, segment.end.y)),
        routeSegmentIndex: segment.routeSegmentIndex,
        columnOrder: ownership.columnOrder,
        ownershipRank: segment.routeSegmentIndex
      });
      continue;
    }
    if (segment.orientation === "horizontal") {
      const ownership = resolveRowOwnership(segment.coordinate);
      occupancy.push({
        connectorId,
        key: ownership.rowOrder === undefined ? `${ownership.key}:segment:${segment.routeSegmentIndex}` : ownership.key,
        axis: "horizontal",
        kind: ownership.rowOrder === undefined ? "edge_local" : "band",
        nominalCoordinate: roundMetric(segment.coordinate),
        spanStart: roundMetric(Math.min(segment.start.x, segment.end.x)),
        spanEnd: roundMetric(Math.max(segment.start.x, segment.end.x)),
        routeSegmentIndex: segment.routeSegmentIndex,
        rowOrder: ownership.rowOrder,
        ownershipRank: segment.routeSegmentIndex
      });
    }
  }
  return occupancy;
}

function buildGutterOccupancyForIntersection(
  connectorId: string,
  segment: OutcomeOpportunityRouteSegmentDetail,
  rect: OutcomeOpportunityGutterRect
): OutcomeOpportunityGutterOccupancy | undefined {
  if (segment.orientation === "vertical") {
    if (segment.coordinate < rect.x - 0.5 || segment.coordinate > rect.x + rect.width + 0.5) {
      return undefined;
    }
    const spanStart = roundMetric(Math.max(Math.min(segment.start.y, segment.end.y), rect.y));
    const spanEnd = roundMetric(Math.min(Math.max(segment.start.y, segment.end.y), rect.y + rect.height));
    if (spanEnd - spanStart <= 0.5) {
      return undefined;
    }
    return {
      connectorId,
      key: rect.key,
      axis: "vertical",
      kind: rect.kind,
      nominalCoordinate: roundMetric(segment.coordinate),
      spanStart,
      spanEnd,
      routeSegmentIndex: segment.routeSegmentIndex,
      nodeId: rect.nodeId,
      columnOrder: rect.columnOrder,
      rowOrder: rect.rowOrder
    };
  }

  if (segment.coordinate < rect.y - 0.5 || segment.coordinate > rect.y + rect.height + 0.5) {
    return undefined;
  }
  const spanStart = roundMetric(Math.max(Math.min(segment.start.x, segment.end.x), rect.x));
  const spanEnd = roundMetric(Math.min(Math.max(segment.start.x, segment.end.x), rect.x + rect.width));
  if (spanEnd - spanStart <= 0.5) {
    return undefined;
  }
  return {
    connectorId,
    key: rect.key,
    axis: "horizontal",
    kind: rect.kind,
    nominalCoordinate: roundMetric(segment.coordinate),
    spanStart,
    spanEnd,
    routeSegmentIndex: segment.routeSegmentIndex,
    nodeId: rect.nodeId,
    columnOrder: rect.columnOrder,
    rowOrder: rect.rowOrder
  };
}

function buildPhysicalGutterOccupancy(
  connectorId: string,
  route: PositionedRoute,
  scene: PositionedScene,
  index: OutcomeOpportunityPositionedIndex,
  globalGutterState: OutcomeOpportunityGlobalGutterState
): OutcomeOpportunityGutterOccupancy[] {
  const occupancy: OutcomeOpportunityGutterOccupancy[] = [];
  const rects = buildGutterRects(scene, index, globalGutterState);

  for (const segment of buildRouteSegmentDetails(route)) {
    for (const rect of rects) {
      const entry = buildGutterOccupancyForIntersection(connectorId, segment, rect);
      if (entry) {
        occupancy.push(entry);
      }
    }
  }

  return occupancy;
}

function overlapsNodeExtent(
  segment: OutcomeOpportunityRouteSegmentDetail,
  node: { x: number; y: number; width: number; height: number }
): boolean {
  if (segment.orientation === "horizontal") {
    const spanStart = Math.min(segment.start.x, segment.end.x);
    const spanEnd = Math.max(segment.start.x, segment.end.x);
    return spanStart < node.x + node.width - 0.5 && spanEnd > node.x + 0.5;
  }

  const spanStart = Math.min(segment.start.y, segment.end.y);
  const spanEnd = Math.max(segment.start.y, segment.end.y);
  return spanStart < node.y + node.height - 0.5 && spanEnd > node.y + 0.5;
}

function buildObstacleLocalOccupancy(
  connectorId: string,
  segment: OutcomeOpportunityRouteSegmentDetail,
  nodeId: string,
  side: PortSide,
  ownershipRank: number
): OutcomeOpportunityGutterOccupancy {
  if (segment.orientation === "horizontal") {
    return {
      connectorId,
      key: `obstacle:${nodeId}:${side}`,
      axis: "horizontal",
      kind: getObstacleSideKind(side),
      nodeId,
      side,
      nominalCoordinate: roundMetric(segment.coordinate),
      spanStart: roundMetric(Math.min(segment.start.x, segment.end.x)),
      spanEnd: roundMetric(Math.max(segment.start.x, segment.end.x)),
      routeSegmentIndex: segment.routeSegmentIndex,
      ownershipRank
    };
  }

  return {
    connectorId,
    key: `obstacle:${nodeId}:${side}`,
    axis: "vertical",
    kind: getObstacleSideKind(side),
    nodeId,
    side,
    nominalCoordinate: roundMetric(segment.coordinate),
    spanStart: roundMetric(Math.min(segment.start.y, segment.end.y)),
    spanEnd: roundMetric(Math.max(segment.start.y, segment.end.y)),
    routeSegmentIndex: segment.routeSegmentIndex,
    ownershipRank
  };
}

function buildEdgeLocalOccupancy(
  connectorId: string,
  segment: OutcomeOpportunityRouteSegmentDetail,
  nodeId: string,
  side: PortSide,
  endpointRole: EndpointRole
): OutcomeOpportunityGutterOccupancy {
  if (segment.orientation === "horizontal") {
    return {
      connectorId,
      key: `edge-local:${nodeId}:${side}`,
      axis: "horizontal",
      kind: "edge_local",
      nodeId,
      side,
      endpointRole,
      nominalCoordinate: roundMetric(segment.coordinate),
      spanStart: roundMetric(Math.min(segment.start.x, segment.end.x)),
      spanEnd: roundMetric(Math.max(segment.start.x, segment.end.x)),
      routeSegmentIndex: segment.routeSegmentIndex
    };
  }

  return {
    connectorId,
    key: `edge-local:${nodeId}:${side}`,
    axis: "vertical",
    kind: "edge_local",
    nodeId,
    side,
    endpointRole,
    nominalCoordinate: roundMetric(segment.coordinate),
    spanStart: roundMetric(Math.min(segment.start.y, segment.end.y)),
    spanEnd: roundMetric(Math.max(segment.start.y, segment.end.y)),
    routeSegmentIndex: segment.routeSegmentIndex
  };
}

function segmentSitsOutsideNodeSide(
  segment: OutcomeOpportunityRouteSegmentDetail,
  node: { x: number; y: number; width: number; height: number },
  side: PortSide
): boolean {
  switch (side) {
    case "north":
      return segment.orientation === "horizontal" && segment.coordinate < node.y - 0.5;
    case "south":
      return segment.orientation === "horizontal" && segment.coordinate > node.y + node.height + 0.5;
    case "east":
      return segment.orientation === "vertical" && segment.coordinate > node.x + node.width + 0.5;
    case "west":
      return segment.orientation === "vertical" && segment.coordinate < node.x - 0.5;
  }
}

function findEndpointLocalSegment(
  routeSegments: readonly OutcomeOpportunityRouteSegmentDetail[],
  node: { x: number; y: number; width: number; height: number },
  side: PortSide,
  endpointRole: EndpointRole
): OutcomeOpportunityRouteSegmentDetail | undefined {
  const expectedOrientation = getExpectedEdgeLocalAxis(side);
  const isValidLocalSegment = (segment: OutcomeOpportunityRouteSegmentDetail | undefined): segment is OutcomeOpportunityRouteSegmentDetail =>
    segment !== undefined
    && segment.orientation === expectedOrientation
    && overlapsNodeExtent(segment, node)
    && segmentSitsOutsideNodeSide(segment, node, side);

  if (endpointRole === "source") {
    const sourceLocalSegment = routeSegments[1];
    return isValidLocalSegment(sourceLocalSegment) ? sourceLocalSegment : undefined;
  }

  for (let segmentIndex = routeSegments.length - 2; segmentIndex >= 0; segmentIndex -= 1) {
    const segment = routeSegments[segmentIndex];
    if (isValidLocalSegment(segment)) {
      return segment;
    }
  }

  return undefined;
}

function buildEdgeLocalOccupancyForEndpoint(
  plan: OutcomeOpportunityConnectorTemplatePlan,
  routeSegments: readonly OutcomeOpportunityRouteSegmentDetail[],
  nodeId: string,
  node: { x: number; y: number; width: number; height: number },
  side: PortSide,
  endpointRole: EndpointRole
): OutcomeOpportunityGutterOccupancy | undefined {
  if (routeSegments.length < 2) {
    return undefined;
  }

  const segment = findEndpointLocalSegment(routeSegments, node, side, endpointRole);
  if (!segment) {
    return undefined;
  }
  return buildEdgeLocalOccupancy(plan.id, segment, nodeId, side, endpointRole);
}

function extractEdgeLocalOccupancyForConnector(
  plan: OutcomeOpportunityConnectorTemplatePlan,
  route: PositionedRoute,
  index: OutcomeOpportunityPositionedIndex
): OutcomeOpportunityGutterOccupancy[] {
  const segments = buildRouteSegmentDetails(route);
  if (segments.length < 2) {
    return [];
  }

  const occupancies: OutcomeOpportunityGutterOccupancy[] = [];
  const source = index.nodeById.get(plan.from);
  if (source) {
    const sourceEntry = buildEdgeLocalOccupancyForEndpoint(
      plan,
      segments,
      plan.from,
      source.node,
      plan.sourceSide,
      "source"
    );
    if (sourceEntry) {
      occupancies.push(sourceEntry);
    }
  }

  const target = index.nodeById.get(plan.to);
  if (target) {
    const targetEntry = buildEdgeLocalOccupancyForEndpoint(
      plan,
      segments,
      plan.to,
      target.node,
      plan.targetSide,
      "target"
    );
    if (targetEntry) {
      occupancies.push(targetEntry);
    }
  }

  return sortGutterOccupancy(occupancies);
}

function buildAttachedObstacleOccupanciesForNode(
  plan: OutcomeOpportunityConnectorTemplatePlan,
  routeSegments: readonly OutcomeOpportunityRouteSegmentDetail[],
  nodeId: string,
  node: { x: number; y: number; width: number; height: number }
): OutcomeOpportunityGutterOccupancy[] {
  const occupancies: OutcomeOpportunityGutterOccupancy[] = [];

  const attachSegment = (role: EndpointRole, side: PortSide): void => {
    if (routeSegments.length < 2) {
      return;
    }

    const localSegment = role === "source" ? routeSegments[1] : routeSegments[routeSegments.length - 2];
    if (!localSegment || localSegment.orientation !== getExpectedEdgeLocalAxis(side)) {
      return;
    }

    if (!overlapsNodeExtent(localSegment, node)) {
      return;
    }

    switch (side) {
      case "north":
        if (localSegment.orientation === "horizontal" && localSegment.coordinate < node.y - 0.5) {
          occupancies.push(buildObstacleLocalOccupancy(plan.id, localSegment, nodeId, side, 0));
        }
        break;
      case "south":
        if (localSegment.orientation === "horizontal" && localSegment.coordinate > node.y + node.height + 0.5) {
          occupancies.push(buildObstacleLocalOccupancy(plan.id, localSegment, nodeId, side, 0));
        }
        break;
      case "east":
        if (localSegment.orientation === "vertical" && localSegment.coordinate > node.x + node.width + 0.5) {
          occupancies.push(buildObstacleLocalOccupancy(plan.id, localSegment, nodeId, side, 0));
        }
        break;
      case "west":
        if (localSegment.orientation === "vertical" && localSegment.coordinate < node.x - 0.5) {
          occupancies.push(buildObstacleLocalOccupancy(plan.id, localSegment, nodeId, side, 0));
        }
        break;
    }
  };

  if (plan.from === nodeId) {
    attachSegment("source", plan.sourceSide);
  }
  if (plan.to === nodeId) {
    attachSegment("target", plan.targetSide);
  }

  return occupancies;
}

function buildSwerveObstacleOccupanciesForNode(
  plan: OutcomeOpportunityConnectorTemplatePlan,
  routeSegments: readonly OutcomeOpportunityRouteSegmentDetail[],
  nodeId: string,
  node: { x: number; y: number; width: number; height: number }
): OutcomeOpportunityGutterOccupancy[] {
  if (plan.from === nodeId || plan.to === nodeId) {
    return [];
  }

  const occupancies: OutcomeOpportunityGutterOccupancy[] = [];
  const spansNodeHeight = (segment: OutcomeOpportunityRouteSegmentDetail): boolean => {
    const spanStart = Math.min(segment.start.y, segment.end.y);
    const spanEnd = Math.max(segment.start.y, segment.end.y);
    return spanStart < node.y + node.height - 0.5 && spanEnd > node.y + 0.5;
  };
  const spansNodeWidth = (segment: OutcomeOpportunityRouteSegmentDetail): boolean => {
    const spanStart = Math.min(segment.start.x, segment.end.x);
    const spanEnd = Math.max(segment.start.x, segment.end.x);
    return spanStart < node.x + node.width - 0.5 && spanEnd > node.x + 0.5;
  };

  const hasVerticalBypass = routeSegments.some((segment) =>
    segment.orientation === "vertical"
    && segment.coordinate > node.x + node.width + 0.5
    && spansNodeHeight(segment)
  );
  const hasHorizontalBypass = routeSegments.some((segment) =>
    segment.orientation === "horizontal"
    && segment.coordinate > node.y + node.height + 0.5
    && spansNodeWidth(segment)
  );

  if (hasVerticalBypass) {
    for (const segment of routeSegments) {
      if (segment.orientation !== "horizontal" || !spansNodeWidth(segment)) {
        continue;
      }
      if (segment.coordinate < node.y - 0.5) {
        occupancies.push(buildObstacleLocalOccupancy(plan.id, segment, nodeId, "north", 1));
      } else if (segment.coordinate > node.y + node.height + 0.5) {
        occupancies.push(buildObstacleLocalOccupancy(plan.id, segment, nodeId, "south", 1));
      }
    }
  }

  if (hasHorizontalBypass) {
    for (const segment of routeSegments) {
      if (segment.orientation !== "vertical" || !spansNodeHeight(segment)) {
        continue;
      }
      if (segment.coordinate < node.x - 0.5) {
        occupancies.push(buildObstacleLocalOccupancy(plan.id, segment, nodeId, "west", 1));
      } else if (segment.coordinate > node.x + node.width + 0.5) {
        occupancies.push(buildObstacleLocalOccupancy(plan.id, segment, nodeId, "east", 1));
      }
    }
  }

  return occupancies;
}

function extractObstacleLocalOccupancyForConnector(
  plan: OutcomeOpportunityConnectorTemplatePlan,
  route: PositionedRoute,
  index: OutcomeOpportunityPositionedIndex
): OutcomeOpportunityGutterOccupancy[] {
  const segments = buildRouteSegmentDetails(route);
  if (segments.length === 0) {
    return [];
  }

  const occupancies: OutcomeOpportunityGutterOccupancy[] = [];
  for (const [nodeId, context] of index.nodeById.entries()) {
    occupancies.push(
      ...buildAttachedObstacleOccupanciesForNode(plan, segments, nodeId, context.node),
      ...buildSwerveObstacleOccupanciesForNode(plan, segments, nodeId, context.node)
    );
  }

  return sortGutterOccupancy(occupancies);
}

function extractGutterOccupancyByConnector(
  plans: readonly OutcomeOpportunityConnectorTemplatePlan[],
  routesByConnectorId: ReadonlyMap<string, PositionedRoute>,
  scene: PositionedScene,
  index: OutcomeOpportunityPositionedIndex,
  globalGutterState: OutcomeOpportunityGlobalGutterState
): {
  occupancy: OutcomeOpportunityGutterOccupancy[];
  occupancyByConnectorId: Map<string, OutcomeOpportunityGutterOccupancy[]>;
} {
  const occupancyByConnectorId = new Map<string, OutcomeOpportunityGutterOccupancy[]>();
  const occupancy: OutcomeOpportunityGutterOccupancy[] = [];

  for (const plan of plans) {
    const route = routesByConnectorId.get(plan.id) ?? plan.step3Route;
    const connectorOccupancy = sortGutterOccupancy([
      ...buildPhysicalGutterOccupancy(plan.id, route, scene, index, globalGutterState),
      ...buildSegmentOccupancy(plan.id, route, index),
      ...extractEdgeLocalOccupancyForConnector(plan, route, index),
      ...extractObstacleLocalOccupancyForConnector(plan, route, index)
    ]);
    occupancyByConnectorId.set(plan.id, connectorOccupancy);
    occupancy.push(...connectorOccupancy);
  }

  return {
    occupancy: sortGutterOccupancy(occupancy),
    occupancyByConnectorId
  };
}

function sortGutterOccupancy(
  occupancy: OutcomeOpportunityGutterOccupancy[]
): OutcomeOpportunityGutterOccupancy[] {
  return occupancy.sort((left, right) =>
    left.key.localeCompare(right.key)
    || left.axis.localeCompare(right.axis)
    || left.nominalCoordinate - right.nominalCoordinate
    || left.spanStart - right.spanStart
    || left.spanEnd - right.spanEnd
      || left.connectorId.localeCompare(right.connectorId)
      || left.routeSegmentIndex - right.routeSegmentIndex
  );
}

function isBundleLocalKind(kind: OutcomeOpportunityGutterKind): kind is "node_bottom" | "node_right" {
  return kind === "node_bottom" || kind === "node_right";
}

function getBundleClaimAxis(kind: "node_bottom" | "node_right"): OutcomeOpportunityGutterAxis {
  return kind === "node_bottom" ? "horizontal" : "vertical";
}

function matchesBundleSourceSide(kind: "node_bottom" | "node_right", side: PortSide): boolean {
  return (kind === "node_bottom" && side === "south")
    || (kind === "node_right" && side === "east");
}

function matchesBundleTargetSide(kind: "node_bottom" | "node_right", side: PortSide): boolean {
  return (kind === "node_bottom" && side === "north")
    || (kind === "node_right" && side === "west");
}

function spansContainCoordinate(start: number, end: number, coordinate: number): boolean {
  return coordinate >= start - 0.5 && coordinate <= end + 0.5;
}

function touchesInnerBoundary(
  entry: OutcomeOpportunityGutterOccupancy,
  rect: OutcomeOpportunityLocalGutterRect
): boolean {
  if (rect.kind === "node_bottom") {
    return entry.axis === "vertical" && entry.spanStart <= rect.y + 0.5;
  }

  return entry.axis === "horizontal" && entry.spanStart <= rect.x + 0.5;
}

function touchesOuterBoundary(
  entry: OutcomeOpportunityGutterOccupancy,
  rect: OutcomeOpportunityLocalGutterRect
): boolean {
  if (rect.kind === "node_bottom") {
    return entry.axis === "vertical" && entry.spanEnd >= rect.y + rect.height - 0.5;
  }

  return entry.axis === "horizontal" && entry.spanEnd >= rect.x + rect.width - 0.5;
}

function chooseBundleClaimEntry(
  entries: readonly OutcomeOpportunityGutterOccupancy[],
  plan: OutcomeOpportunityConnectorTemplatePlan,
  routeSegmentCount: number,
  kind: "node_bottom" | "node_right"
): OutcomeOpportunityGutterOccupancy | undefined {
  const claimAxis = getBundleClaimAxis(kind);
  const sourceLocalSegmentIndex = routeSegmentCount >= 2 && matchesBundleSourceSide(kind, plan.sourceSide)
    ? 1
    : undefined;
  const targetLocalSegmentIndex = routeSegmentCount >= 2 && matchesBundleTargetSide(kind, plan.targetSide)
    ? routeSegmentCount - 2
    : undefined;

  const candidates = entries.filter((entry) => entry.axis === claimAxis);
  if (candidates.length === 0) {
    return undefined;
  }

  const score = (entry: OutcomeOpportunityGutterOccupancy): number => {
    if (entry.routeSegmentIndex === sourceLocalSegmentIndex || entry.routeSegmentIndex === targetLocalSegmentIndex) {
      return 0;
    }
    if (candidates.length === 1) {
      return 1;
    }
    return 2;
  };

  return [...candidates].sort((left, right) =>
    score(left) - score(right)
    || left.routeSegmentIndex - right.routeSegmentIndex
    || left.spanStart - right.spanStart
    || left.spanEnd - right.spanEnd
    || left.connectorId.localeCompare(right.connectorId)
  )[0];
}

function compareBundleClaimsCanonical(
  left: OutcomeOpportunityLocalBundleClaim,
  right: OutcomeOpportunityLocalBundleClaim,
  planById: ReadonlyMap<string, OutcomeOpportunityConnectorTemplatePlan>
): number {
  const leftPlan = planById.get(left.connectorId);
  const rightPlan = planById.get(right.connectorId);
  return left.nominalCoordinate - right.nominalCoordinate
    || (leftPlan && rightPlan ? compareConnectorPlanPriority(leftPlan, rightPlan) : left.connectorId.localeCompare(right.connectorId))
    || left.routeSegmentIndex - right.routeSegmentIndex
    || left.connectorId.localeCompare(right.connectorId);
}

function buildGutterLocalBundleResolution(
  plans: readonly OutcomeOpportunityConnectorTemplatePlan[],
  routesByConnectorId: ReadonlyMap<string, PositionedRoute>,
  occupancy: readonly OutcomeOpportunityGutterOccupancy[],
  scene: PositionedScene,
  globalGutterState: OutcomeOpportunityGlobalGutterState,
  index: OutcomeOpportunityPositionedIndex
): OutcomeOpportunityBundleResolution {
  const endpointCoordinateByEndpointKey = new Map<string, number>();
  const segmentCoordinateBySegmentKey = new Map<string, number>();
  const lockedSegmentKeys = new Set<string>();
  const requiredColumnExpansions: Record<number, number> = {};
  const requiredRowExpansions: Record<number, number> = {};
  const planById = new Map(plans.map((plan) => [plan.id, plan] as const));
  const routeSegmentCountByConnectorId = new Map(
    plans.map((plan) => [
      plan.id,
      buildRouteSegmentDetails(routesByConnectorId.get(plan.id) ?? plan.step3Route).length
    ] as const)
  );
  const rectByKey = new Map(buildLocalGutterRects(scene, index, globalGutterState).map((rect) => [rect.key, rect] as const));
  const occupancyByBundleKey = new Map<string, OutcomeOpportunityGutterOccupancy[]>();

  for (const entry of occupancy) {
    if (!isBundleLocalKind(entry.kind)) {
      continue;
    }
    const existing = occupancyByBundleKey.get(entry.key) ?? [];
    existing.push(entry);
    occupancyByBundleKey.set(entry.key, existing);
  }

  occupancyByBundleKey.forEach((group, bundleKey) => {
    const rect = rectByKey.get(bundleKey);
    if (!rect || !isBundleLocalKind(rect.kind)) {
      return;
    }

    const entriesByConnectorId = new Map<string, OutcomeOpportunityGutterOccupancy[]>();
    for (const entry of group) {
      const existing = entriesByConnectorId.get(entry.connectorId) ?? [];
      existing.push(entry);
      entriesByConnectorId.set(entry.connectorId, existing);
    }

    const claims: OutcomeOpportunityLocalBundleClaim[] = [];
    const fixedInnerOwners: Array<{ coordinate: number; extent: number }> = [];

    for (const [connectorId, connectorEntries] of entriesByConnectorId.entries()) {
      const plan = planById.get(connectorId);
      if (!plan) {
        continue;
      }

      const routeSegmentCount = routeSegmentCountByConnectorId.get(connectorId) ?? 0;
      const chosenClaim = chooseBundleClaimEntry(connectorEntries, plan, routeSegmentCount, rect.kind);
      const inwardOwnedEntries = connectorEntries.filter((entry) => touchesInnerBoundary(entry, rect));
      const outwardOwnedEntries = connectorEntries.filter((entry) => touchesOuterBoundary(entry, rect));
      const canClaimSourceEndpoint = rect.nodeId === plan.from && matchesBundleSourceSide(rect.kind, plan.sourceSide);
      const canClaimTargetEndpoint = rect.nodeId === plan.to && matchesBundleTargetSide(rect.kind, plan.targetSide);

      const sourceEndpointKey = chosenClaim && canClaimSourceEndpoint && chosenClaim.routeSegmentIndex === 1
        ? buildEndpointCoordinateKey(plan.id, "source")
        : undefined;
      const targetEndpointKey = chosenClaim && canClaimTargetEndpoint && chosenClaim.routeSegmentIndex === routeSegmentCount - 2
        ? buildEndpointCoordinateKey(plan.id, "target")
        : undefined;

      const participatesLocally = sourceEndpointKey !== undefined
        || targetEndpointKey !== undefined
        || inwardOwnedEntries.length > 0
        || outwardOwnedEntries.length > 0;

      if (!chosenClaim) {
        for (const entry of inwardOwnedEntries) {
          fixedInnerOwners.push({
            coordinate: entry.nominalCoordinate,
            extent: entry.spanEnd
          });
        }
        continue;
      }
      if (!participatesLocally) {
        continue;
      }

      claims.push({
        connectorId,
        gutterKey: bundleKey,
        kind: rect.kind,
        routeSegmentIndex: chosenClaim.routeSegmentIndex,
        nominalCoordinate: chosenClaim.nominalCoordinate,
        spanStart: chosenClaim.spanStart,
        spanEnd: chosenClaim.spanEnd,
        inwardOwnedCoordinates: inwardOwnedEntries.map((entry) => entry.nominalCoordinate),
        outwardOwnedCoordinates: outwardOwnedEntries.map((entry) => entry.nominalCoordinate),
        sourceEndpointKey,
        targetEndpointKey,
        columnOrder: chosenClaim.columnOrder,
        rowOrder: chosenClaim.rowOrder
      });
    }

    if (claims.length === 0) {
      return;
    }

    const edges = new Map<number, Set<number>>();
    const addEdge = (fromIndex: number, toIndex: number): void => {
      if (fromIndex === toIndex) {
        return;
      }
      const existing = edges.get(fromIndex) ?? new Set<number>();
      existing.add(toIndex);
      edges.set(fromIndex, existing);
    };
    const hasEdge = (fromIndex: number, toIndex: number): boolean => edges.get(fromIndex)?.has(toIndex) ?? false;

    for (let sourceIndex = 0; sourceIndex < claims.length; sourceIndex += 1) {
      for (let targetIndex = 0; targetIndex < claims.length; targetIndex += 1) {
        if (sourceIndex === targetIndex) {
          continue;
        }
        const sourceClaim = claims[sourceIndex]!;
        const targetClaim = claims[targetIndex]!;
        if (sourceClaim.inwardOwnedCoordinates.some((coordinate) =>
          spansContainCoordinate(targetClaim.spanStart, targetClaim.spanEnd, coordinate)
        )) {
          addEdge(sourceIndex, targetIndex);
        }
        if (sourceClaim.outwardOwnedCoordinates.some((coordinate) =>
          spansContainCoordinate(targetClaim.spanStart, targetClaim.spanEnd, coordinate)
        )) {
          addEdge(targetIndex, sourceIndex);
        }
      }
    }

    for (let leftIndex = 0; leftIndex < claims.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < claims.length; rightIndex += 1) {
        const leftClaim = claims[leftIndex]!;
        const rightClaim = claims[rightIndex]!;
        if (!spansTouchOrOverlap(leftClaim.spanStart, leftClaim.spanEnd, rightClaim.spanStart, rightClaim.spanEnd)) {
          continue;
        }
        if (hasEdge(leftIndex, rightIndex) || hasEdge(rightIndex, leftIndex)) {
          continue;
        }
        if (compareBundleClaimsCanonical(leftClaim, rightClaim, planById) <= 0) {
          addEdge(leftIndex, rightIndex);
        } else {
          addEdge(rightIndex, leftIndex);
        }
      }
    }

    const indegree = new Map<number, number>();
    claims.forEach((_, claimIndex) => indegree.set(claimIndex, 0));
    edges.forEach((targets) => {
      targets.forEach((targetIndex) => indegree.set(targetIndex, (indegree.get(targetIndex) ?? 0) + 1));
    });

    const remaining = new Set(claims.map((_, claimIndex) => claimIndex));
    const orderedClaimIndices: number[] = [];
    while (remaining.size > 0) {
      const available = [...remaining]
        .filter((claimIndex) => (indegree.get(claimIndex) ?? 0) === 0)
        .sort((leftIndex, rightIndex) =>
          compareBundleClaimsCanonical(claims[leftIndex]!, claims[rightIndex]!, planById)
        );
      if (available.length === 0) {
        orderedClaimIndices.push(
          ...[...remaining].sort((leftIndex, rightIndex) =>
            compareBundleClaimsCanonical(claims[leftIndex]!, claims[rightIndex]!, planById)
          )
        );
        break;
      }

      const nextIndex = available[0]!;
      orderedClaimIndices.push(nextIndex);
      remaining.delete(nextIndex);
      for (const targetIndex of edges.get(nextIndex) ?? []) {
        indegree.set(targetIndex, (indegree.get(targetIndex) ?? 1) - 1);
      }
    }

    const assignedCoordinateByClaimIndex = new Map<number, number>();
    for (const claimIndex of orderedClaimIndices) {
      const claim = claims[claimIndex]!;
      let assignedCoordinate = claim.nominalCoordinate;
      const constrainedByFixedInnerOwner = fixedInnerOwners.some((owner) =>
        spansContainCoordinate(claim.spanStart, claim.spanEnd, owner.coordinate)
      );

      for (const owner of fixedInnerOwners) {
        if (spansContainCoordinate(claim.spanStart, claim.spanEnd, owner.coordinate)) {
          assignedCoordinate = Math.max(assignedCoordinate, owner.extent + ENDPOINT_SPACING);
        }
      }

      for (const [predecessorIndex, targets] of edges.entries()) {
        if (!targets.has(claimIndex)) {
          continue;
        }
        const predecessorClaim = claims[predecessorIndex]!;
        const predecessorCoordinate = assignedCoordinateByClaimIndex.get(predecessorIndex);
        if (predecessorCoordinate === undefined) {
          continue;
        }
        if (spansTouchOrOverlap(predecessorClaim.spanStart, predecessorClaim.spanEnd, claim.spanStart, claim.spanEnd)) {
          assignedCoordinate = Math.max(assignedCoordinate, predecessorCoordinate + ENDPOINT_SPACING);
        }
      }

      assignedCoordinate = roundMetric(assignedCoordinate);
      assignedCoordinateByClaimIndex.set(claimIndex, assignedCoordinate);
      const segmentKey = buildSegmentDisplacementKey(claim.connectorId, claim.routeSegmentIndex);
      const competesWithLocalClaim = [...edges.entries()].some(([predecessorIndex, targets]) => {
        const relatedIndices = predecessorIndex === claimIndex
          ? [...targets]
          : targets.has(claimIndex) ? [predecessorIndex] : [];
        return relatedIndices.some((relatedIndex) => {
          const relatedClaim = claims[relatedIndex];
          return relatedClaim !== undefined
            && spansTouchOrOverlap(claim.spanStart, claim.spanEnd, relatedClaim.spanStart, relatedClaim.spanEnd);
        });
      });
      const shouldApplyBundleCoordinate = (claim.sourceEndpointKey !== undefined || claim.targetEndpointKey !== undefined)
        && (competesWithLocalClaim
          || constrainedByFixedInnerOwner
          || Math.abs(assignedCoordinate - claim.nominalCoordinate) > 0.5);
      if (shouldApplyBundleCoordinate) {
        segmentCoordinateBySegmentKey.set(segmentKey, assignedCoordinate);
        lockedSegmentKeys.add(segmentKey);
        if (claim.sourceEndpointKey) {
          endpointCoordinateByEndpointKey.set(claim.sourceEndpointKey, assignedCoordinate);
        }
        if (claim.targetEndpointKey) {
          endpointCoordinateByEndpointKey.set(claim.targetEndpointKey, assignedCoordinate);
        }
      }

      if (claim.kind === "node_bottom" && claim.rowOrder !== undefined) {
        const overflow = roundMetric(assignedCoordinate - resolveExpandedBundleLimit(rect, index));
        if (overflow > 0) {
          requiredRowExpansions[claim.rowOrder] = roundUpToEndpointSpacing(
            Math.max(requiredRowExpansions[claim.rowOrder] ?? 0, overflow)
          );
        }
      }
      if (claim.kind === "node_right" && claim.columnOrder !== undefined) {
        const overflow = roundMetric(assignedCoordinate - resolveExpandedBundleLimit(rect, index));
        if (overflow > 0) {
          requiredColumnExpansions[claim.columnOrder] = roundUpToEndpointSpacing(
            Math.max(requiredColumnExpansions[claim.columnOrder] ?? 0, overflow)
          );
        }
      }
    }
  });

  return {
    endpointCoordinateByEndpointKey,
    segmentCoordinateBySegmentKey,
    lockedSegmentKeys,
    requiredColumnExpansions,
    requiredRowExpansions
  };
}

interface OutcomeOpportunityTargetEdgeLocalClaim {
  entry: OutcomeOpportunityGutterOccupancy;
  plan: OutcomeOpportunityConnectorTemplatePlan;
  side: PortSide;
  baseCoordinate: number;
  direction: 1 | -1;
  localTrunk: OutcomeOpportunityRouteSegmentDetail;
  finalApproach: OutcomeOpportunityRouteSegmentDetail;
  targetAxisCoordinate: number;
  routeLength: number;
}

function segmentSpanStart(segment: OutcomeOpportunityRouteSegmentDetail): number {
  return segment.orientation === "horizontal"
    ? Math.min(segment.start.x, segment.end.x)
    : Math.min(segment.start.y, segment.end.y);
}

function segmentSpanEnd(segment: OutcomeOpportunityRouteSegmentDetail): number {
  return segment.orientation === "horizontal"
    ? Math.max(segment.start.x, segment.end.x)
    : Math.max(segment.start.y, segment.end.y);
}

function segmentContainsPoint(segment: OutcomeOpportunityRouteSegmentDetail, point: Point): boolean {
  if (segment.orientation === "horizontal") {
    return Math.abs(point.y - segment.coordinate) <= 0.5
      && point.x >= segmentSpanStart(segment) - 0.5
      && point.x <= segmentSpanEnd(segment) + 0.5;
  }

  return Math.abs(point.x - segment.coordinate) <= 0.5
    && point.y >= segmentSpanStart(segment) - 0.5
    && point.y <= segmentSpanEnd(segment) + 0.5;
}

function segmentContainsAxisCoordinateInterior(
  segment: OutcomeOpportunityRouteSegmentDetail,
  coordinate: number
): boolean {
  return coordinate > segmentSpanStart(segment) + 0.5
    && coordinate < segmentSpanEnd(segment) - 0.5;
}

function routeManhattanLength(route: PositionedRoute): number {
  return route.points.reduce((total, point, index) => {
    const previous = route.points[index - 1];
    if (!previous) {
      return total;
    }
    return total + Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y);
  }, 0);
}

function approachCrossesLocalTrunk(
  approach: OutcomeOpportunityRouteSegmentDetail,
  trunk: OutcomeOpportunityRouteSegmentDetail
): boolean {
  if (approach.orientation === trunk.orientation) {
    return false;
  }

  if (approach.orientation === "horizontal") {
    return trunk.coordinate > segmentSpanStart(approach) + 0.5
      && trunk.coordinate < segmentSpanEnd(approach) - 0.5
      && approach.coordinate > segmentSpanStart(trunk) + 0.5
      && approach.coordinate < segmentSpanEnd(trunk) - 0.5;
  }

  return approach.coordinate > segmentSpanStart(trunk) + 0.5
    && approach.coordinate < segmentSpanEnd(trunk) - 0.5
    && trunk.coordinate > segmentSpanStart(approach) + 0.5
    && trunk.coordinate < segmentSpanEnd(approach) - 0.5;
}

function routeSegmentsCrossAtInterior(
  first: OutcomeOpportunityRouteSegmentDetail,
  second: OutcomeOpportunityRouteSegmentDetail
): boolean {
  if (first.orientation === second.orientation) {
    return false;
  }

  const horizontal = first.orientation === "horizontal" ? first : second;
  const vertical = first.orientation === "vertical" ? first : second;
  return vertical.coordinate > segmentSpanStart(horizontal) + 0.5
    && vertical.coordinate < segmentSpanEnd(horizontal) - 0.5
    && horizontal.coordinate > segmentSpanStart(vertical) + 0.5
    && horizontal.coordinate < segmentSpanEnd(vertical) - 0.5;
}

function routesCrossAtInterior(left: PositionedRoute, right: PositionedRoute): boolean {
  const leftSegments = buildRouteSegmentDetails(left);
  const rightSegments = buildRouteSegmentDetails(right);
  return leftSegments.some((leftSegment) =>
    rightSegments.some((rightSegment) => routeSegmentsCrossAtInterior(leftSegment, rightSegment))
  );
}

function deriveTargetEdgeLocalClaim(
  entry: OutcomeOpportunityGutterOccupancy,
  plan: OutcomeOpportunityConnectorTemplatePlan,
  route: PositionedRoute,
  baseCoordinate: number,
  side: PortSide
): OutcomeOpportunityTargetEdgeLocalClaim | undefined {
  const routeSegments = buildRouteSegmentDetails(route);
  const localTrunk = routeSegments.find((segment) => segment.routeSegmentIndex === entry.routeSegmentIndex);
  if (!localTrunk || localTrunk.orientation !== getExpectedEdgeLocalAxis(side)) {
    return undefined;
  }

  const targetPoint = route.points[route.points.length - 1];
  if (!targetPoint) {
    return undefined;
  }

  const finalApproach = routeSegments.find((segment) =>
    segment.routeSegmentIndex > localTrunk.routeSegmentIndex
    && segment.orientation === getPrimaryOrientationForSide(side)
    && segmentContainsPoint(segment, targetPoint)
  );
  if (!finalApproach) {
    return undefined;
  }

  return {
    entry,
    plan,
    side,
    baseCoordinate,
    direction: getOutwardDirectionForSide(side),
    localTrunk,
    finalApproach,
    targetAxisCoordinate: side === "east" || side === "west" ? targetPoint.y : targetPoint.x,
    routeLength: routeManhattanLength(route)
  };
}

function compareTargetTrackPreference(
  left: OutcomeOpportunityTargetEdgeLocalClaim,
  right: OutcomeOpportunityTargetEdgeLocalClaim
): number {
  const axisOrder = left.direction < 0
    ? right.targetAxisCoordinate - left.targetAxisCoordinate
    : left.targetAxisCoordinate - right.targetAxisCoordinate;
  return axisOrder
    || compareConnectorPlanPriority(left.plan, right.plan)
    || left.entry.routeSegmentIndex - right.entry.routeSegmentIndex
    || left.entry.connectorId.localeCompare(right.entry.connectorId);
}

function findStronglyConnectedComponents(
  indices: readonly number[],
  edges: ReadonlyMap<number, ReadonlySet<number>>
): number[][] {
  const allowed = new Set(indices);
  const indexByNode = new Map<number, number>();
  const lowlinkByNode = new Map<number, number>();
  const stack: number[] = [];
  const onStack = new Set<number>();
  const components: number[][] = [];
  let nextIndex = 0;

  const visit = (node: number): void => {
    indexByNode.set(node, nextIndex);
    lowlinkByNode.set(node, nextIndex);
    nextIndex += 1;
    stack.push(node);
    onStack.add(node);

    for (const target of edges.get(node) ?? []) {
      if (!allowed.has(target)) {
        continue;
      }
      if (!indexByNode.has(target)) {
        visit(target);
        lowlinkByNode.set(node, Math.min(lowlinkByNode.get(node) ?? 0, lowlinkByNode.get(target) ?? 0));
      } else if (onStack.has(target)) {
        lowlinkByNode.set(node, Math.min(lowlinkByNode.get(node) ?? 0, indexByNode.get(target) ?? 0));
      }
    }

    if (lowlinkByNode.get(node) !== indexByNode.get(node)) {
      return;
    }

    const component: number[] = [];
    while (stack.length > 0) {
      const stacked = stack.pop()!;
      onStack.delete(stacked);
      component.push(stacked);
      if (stacked === node) {
        break;
      }
    }
    components.push(component);
  };

  for (const index of indices) {
    if (!indexByNode.has(index)) {
      visit(index);
    }
  }

  return components;
}

function countCycleCrossings(
  claimIndex: number,
  componentIndices: readonly number[],
  edges: ReadonlyMap<number, ReadonlySet<number>>
): number {
  let crossings = 0;
  const componentIndexSet = new Set(componentIndices);
  for (const target of edges.get(claimIndex) ?? []) {
    if (componentIndexSet.has(target)) {
      crossings += 1;
    }
  }
  for (const [source, targets] of edges.entries()) {
    if (source !== claimIndex && componentIndexSet.has(source) && targets.has(claimIndex)) {
      crossings += 1;
    }
  }
  return crossings;
}

function chooseTargetLocalBypassClaim(
  componentIndices: readonly number[],
  claims: readonly OutcomeOpportunityTargetEdgeLocalClaim[],
  edges: ReadonlyMap<number, ReadonlySet<number>>
): number {
  return [...componentIndices].sort((leftIndex, rightIndex) => {
    const left = claims[leftIndex]!;
    const right = claims[rightIndex]!;
    const leftBridge = left.plan.pattern === "cross_band_bridge" ? 0 : 1;
    const rightBridge = right.plan.pattern === "cross_band_bridge" ? 0 : 1;
    return leftBridge - rightBridge
      || countCycleCrossings(rightIndex, componentIndices, edges) - countCycleCrossings(leftIndex, componentIndices, edges)
      || right.routeLength - left.routeLength
      || compareConnectorPlanPriority(left.plan, right.plan)
      || left.entry.connectorId.localeCompare(right.entry.connectorId);
  })[0]!;
}

function topologicalTargetTrackOrder(
  componentIndices: readonly number[],
  claims: readonly OutcomeOpportunityTargetEdgeLocalClaim[],
  edges: ReadonlyMap<number, ReadonlySet<number>>
): number[] {
  const componentIndexSet = new Set(componentIndices);
  const indegree = new Map<number, number>();
  for (const index of componentIndices) {
    indegree.set(index, 0);
  }
  for (const [sourceIndex, targets] of edges.entries()) {
    if (!componentIndexSet.has(sourceIndex)) {
      continue;
    }
    for (const targetIndex of targets) {
      if (componentIndexSet.has(targetIndex)) {
        indegree.set(targetIndex, (indegree.get(targetIndex) ?? 0) + 1);
      }
    }
  }

  const remaining = new Set(componentIndices);
  const ordered: number[] = [];
  while (remaining.size > 0) {
    const available = [...remaining]
      .filter((index) => (indegree.get(index) ?? 0) === 0)
      .sort((leftIndex, rightIndex) => compareTargetTrackPreference(claims[leftIndex]!, claims[rightIndex]!));
    if (available.length === 0) {
      ordered.push(
        ...[...remaining].sort((leftIndex, rightIndex) =>
          compareTargetTrackPreference(claims[leftIndex]!, claims[rightIndex]!)
        )
      );
      break;
    }

    const nextIndex = available[0]!;
    ordered.push(nextIndex);
    remaining.delete(nextIndex);
    for (const targetIndex of edges.get(nextIndex) ?? []) {
      if (remaining.has(targetIndex)) {
        indegree.set(targetIndex, (indegree.get(targetIndex) ?? 1) - 1);
      }
    }
  }

  return ordered;
}

function resolveTargetEdgeLocalCompaction(
  plans: readonly OutcomeOpportunityConnectorTemplatePlan[],
  occupancy: readonly OutcomeOpportunityGutterOccupancy[],
  routeStates: ReadonlyMap<string, OutcomeOpportunityConnectorRouteState>,
  index: OutcomeOpportunityPositionedIndex
): {
  endpointCoordinateByEndpointKey: Map<string, number>;
  segmentCoordinateBySegmentKey: Map<string, number>;
  lockedSegmentKeys: Set<string>;
  targetLocalBypassSelections: Map<string, OutcomeOpportunityTargetLocalBypassSelection>;
} {
  const planById = new Map(plans.map((plan) => [plan.id, plan] as const));
  const grouped = new Map<string, OutcomeOpportunityTargetEdgeLocalClaim[]>();
  const endpointCoordinateByEndpointKey = new Map<string, number>();
  const segmentCoordinateBySegmentKey = new Map<string, number>();
  const lockedSegmentKeys = new Set<string>();
  const targetLocalBypassSelections = new Map<string, OutcomeOpportunityTargetLocalBypassSelection>();

  for (const entry of occupancy) {
    if (!isEdgeLocalKind(entry.kind)
      || entry.endpointRole !== "target"
      || !entry.nodeId
      || !entry.side
      || entry.axis !== getExpectedEdgeLocalAxis(entry.side)
    ) {
      continue;
    }
    const node = index.nodeById.get(entry.nodeId)?.node;
    if (!node) {
      continue;
    }
    const plan = planById.get(entry.connectorId);
    if (!plan) {
      continue;
    }
    const baseCoordinate = getObstacleLocalBaseCoordinate(node, entry.side);
    const route = routeStates.get(entry.connectorId)?.route ?? plan.step3Route;
    const claim = deriveTargetEdgeLocalClaim(entry, plan, route, baseCoordinate, entry.side);
    if (!claim) {
      continue;
    }
    const key = `target-edge-local:${entry.side}:${entry.axis}:${baseCoordinate}`;
    const existing = grouped.get(key) ?? [];
    existing.push(claim);
    grouped.set(key, existing);
  }

  grouped.forEach((group) => {
    const side = group[0]?.side;
    const baseCoordinate = group[0]?.baseCoordinate;
    if (!side || baseCoordinate === undefined) {
      return;
    }

    const direction = getOutwardDirectionForSide(side);
    const visited = new Set<number>();
    const touchesOrOverlaps = (
      left: OutcomeOpportunityTargetEdgeLocalClaim,
      right: OutcomeOpportunityTargetEdgeLocalClaim
    ): boolean => spansTouchOrOverlap(left.entry.spanStart, left.entry.spanEnd, right.entry.spanStart, right.entry.spanEnd);

    const crossingEdges = new Map<number, Set<number>>();
    const addCrossingEdge = (innerIndex: number, outerIndex: number): void => {
      if (innerIndex === outerIndex) {
        return;
      }
      const existing = crossingEdges.get(innerIndex) ?? new Set<number>();
      existing.add(outerIndex);
      crossingEdges.set(innerIndex, existing);
    };

    for (let sourceIndex = 0; sourceIndex < group.length; sourceIndex += 1) {
      for (let targetIndex = 0; targetIndex < group.length; targetIndex += 1) {
        if (sourceIndex === targetIndex) {
          continue;
        }
        const source = group[sourceIndex]!;
        const target = group[targetIndex]!;
        if (segmentContainsAxisCoordinateInterior(target.localTrunk, source.targetAxisCoordinate)) {
          addCrossingEdge(sourceIndex, targetIndex);
        }
      }
    }

    for (let entryIndex = 0; entryIndex < group.length; entryIndex += 1) {
      if (visited.has(entryIndex)) {
        continue;
      }

      const componentIndices: number[] = [];
      const queue = [entryIndex];
      visited.add(entryIndex);
      while (queue.length > 0) {
        const currentIndex = queue.shift()!;
        componentIndices.push(currentIndex);
        for (let candidateIndex = 0; candidateIndex < group.length; candidateIndex += 1) {
          if (visited.has(candidateIndex)) {
            continue;
          }
          if (touchesOrOverlaps(group[currentIndex]!, group[candidateIndex]!)
            || (crossingEdges.get(currentIndex)?.has(candidateIndex) ?? false)
            || (crossingEdges.get(candidateIndex)?.has(currentIndex) ?? false)
          ) {
            visited.add(candidateIndex);
            queue.push(candidateIndex);
          }
        }
      }

      if (componentIndices.length <= 1) {
        continue;
      }

      const bypassedClaimIndices = new Set<number>();
      while (true) {
        const activeIndices = componentIndices.filter((componentIndex) => !bypassedClaimIndices.has(componentIndex));
        const cyclicComponents = findStronglyConnectedComponents(activeIndices, crossingEdges)
          .filter((component) =>
            component.length > 1
            || component.some((componentIndex) => crossingEdges.get(componentIndex)?.has(componentIndex) ?? false)
          );
        if (cyclicComponents.length === 0) {
          break;
        }

        const cycle = cyclicComponents
          .sort((left, right) =>
            Math.min(...left) - Math.min(...right)
            || left.length - right.length
          )[0]!;
        const bypassedClaimIndex = chooseTargetLocalBypassClaim(cycle, group, crossingEdges);
        bypassedClaimIndices.add(bypassedClaimIndex);
        const bypassedClaim = group[bypassedClaimIndex]!;
        const blockerConnectorIds = cycle
          .filter((cycleIndex) => cycleIndex !== bypassedClaimIndex)
          .filter((cycleIndex) =>
            approachCrossesLocalTrunk(bypassedClaim.finalApproach, group[cycleIndex]!.localTrunk)
            || approachCrossesLocalTrunk(group[cycleIndex]!.finalApproach, bypassedClaim.localTrunk)
            || segmentContainsAxisCoordinateInterior(group[cycleIndex]!.localTrunk, bypassedClaim.targetAxisCoordinate)
            || segmentContainsAxisCoordinateInterior(bypassedClaim.localTrunk, group[cycleIndex]!.targetAxisCoordinate)
          )
          .map((cycleIndex) => group[cycleIndex]!.entry.connectorId);
        const existing = targetLocalBypassSelections.get(bypassedClaim.entry.connectorId);
        targetLocalBypassSelections.set(bypassedClaim.entry.connectorId, {
          connectorId: bypassedClaim.entry.connectorId,
          targetNodeId: bypassedClaim.entry.nodeId ?? bypassedClaim.plan.to,
          side: bypassedClaim.side,
          blockerConnectorIds: [...new Set([
            ...(existing?.blockerConnectorIds ?? []),
            ...(blockerConnectorIds.length > 0
              ? blockerConnectorIds
              : cycle
                .filter((cycleIndex) => cycleIndex !== bypassedClaimIndex)
                .map((cycleIndex) => group[cycleIndex]!.entry.connectorId))
          ])].sort()
        });
      }

      const assignmentEdges = new Map<number, Set<number>>();
      for (const [sourceIndex, targets] of crossingEdges.entries()) {
        if (bypassedClaimIndices.has(sourceIndex) || !componentIndices.includes(sourceIndex)) {
          continue;
        }
        for (const targetIndex of targets) {
          if (!bypassedClaimIndices.has(targetIndex) && componentIndices.includes(targetIndex)) {
            const existing = assignmentEdges.get(sourceIndex) ?? new Set<number>();
            existing.add(targetIndex);
            assignmentEdges.set(sourceIndex, existing);
          }
        }
      }

      const orderedClaimIndices = topologicalTargetTrackOrder(componentIndices, group, assignmentEdges);
      const assignedDepthByClaimIndex = new Map<number, number>();
      for (const claimIndex of orderedClaimIndices) {
        const claim = group[claimIndex]!;
        let assignedDepth = 0;
        for (const [sourceIndex, targets] of assignmentEdges.entries()) {
          if (targets.has(claimIndex)) {
            assignedDepth = Math.max(assignedDepth, (assignedDepthByClaimIndex.get(sourceIndex) ?? 0) + 1);
          }
        }

        while ([...assignedDepthByClaimIndex.entries()].some(([assignedClaimIndex, depth]) =>
          depth === assignedDepth && touchesOrOverlaps(claim, group[assignedClaimIndex]!)
        )) {
          assignedDepth += 1;
        }

        assignedDepthByClaimIndex.set(claimIndex, assignedDepth);
        const assignedCoordinate = roundMetric(baseCoordinate + direction * assignedDepth * ENDPOINT_SPACING);
        const endpointKey = buildEndpointCoordinateKey(claim.entry.connectorId, "target");
        const segmentKey = buildSegmentDisplacementKey(claim.entry.connectorId, claim.entry.routeSegmentIndex);
        endpointCoordinateByEndpointKey.set(endpointKey, assignedCoordinate);
        segmentCoordinateBySegmentKey.set(segmentKey, assignedCoordinate);
        lockedSegmentKeys.add(segmentKey);
      }
    }
  });

  return {
    endpointCoordinateByEndpointKey,
    segmentCoordinateBySegmentKey,
    lockedSegmentKeys,
    targetLocalBypassSelections
  };
}

function resolveOccupancyDisplacements(
  plans: readonly OutcomeOpportunityConnectorTemplatePlan[],
  occupancy: readonly OutcomeOpportunityGutterOccupancy[],
  lockedSegmentKeys: ReadonlySet<string> = new Set<string>()
): Map<string, number> {
  const displacementBySegmentKey = new Map<string, number>();
  const planById = new Map(plans.map((plan) => [plan.id, plan] as const));
  const genericGroups = new Map<string, OutcomeOpportunityGutterOccupancy[]>();
  const obstacleLocalGroups = new Map<string, OutcomeOpportunityGutterOccupancy[]>();

  for (const entry of occupancy) {
    if (isEdgeLocalKind(entry.kind) || entry.kind === "node_bottom" || entry.kind === "node_right") {
      continue;
    }
    const groupKey = `${entry.key}|${entry.axis}`;
    const targetGroups = isObstacleLocalKind(entry.kind) ? obstacleLocalGroups : genericGroups;
    const existing = targetGroups.get(groupKey) ?? [];
    existing.push(entry);
    targetGroups.set(groupKey, existing);
  }

  const compareByPriority = (
    left: OutcomeOpportunityGutterOccupancy,
    right: OutcomeOpportunityGutterOccupancy
  ): number => {
    const leftPlan = planById.get(left.connectorId);
    const rightPlan = planById.get(right.connectorId);
    if (!leftPlan || !rightPlan) {
      return left.connectorId.localeCompare(right.connectorId)
        || left.routeSegmentIndex - right.routeSegmentIndex;
    }
    return compareConnectorPlanPriority(leftPlan, rightPlan)
      || left.routeSegmentIndex - right.routeSegmentIndex
      || left.connectorId.localeCompare(right.connectorId);
  };

  const compareByObstacleOwnership = (
    left: OutcomeOpportunityGutterOccupancy,
    right: OutcomeOpportunityGutterOccupancy
  ): number => (left.ownershipRank ?? 0) - (right.ownershipRank ?? 0)
    || compareByPriority(left, right);

  const processGroups = (
    groups: ReadonlyMap<string, OutcomeOpportunityGutterOccupancy[]>,
    compareEntries: (left: OutcomeOpportunityGutterOccupancy, right: OutcomeOpportunityGutterOccupancy) => number
  ): void => {
    groups.forEach((group) => {
    const visited = new Set<number>();

    const getEffectiveCoordinate = (entry: OutcomeOpportunityGutterOccupancy): number =>
      roundMetric(entry.nominalCoordinate + (displacementBySegmentKey.get(
        buildSegmentDisplacementKey(entry.connectorId, entry.routeSegmentIndex)
      ) ?? 0));

    const overlaps = (
      left: OutcomeOpportunityGutterOccupancy,
      right: OutcomeOpportunityGutterOccupancy
    ): boolean =>
      spansOverlap(left.spanStart, left.spanEnd, right.spanStart, right.spanEnd)
      && Math.abs(getEffectiveCoordinate(left) - getEffectiveCoordinate(right)) < ENDPOINT_SPACING;

    const isLocked = (entry: OutcomeOpportunityGutterOccupancy): boolean =>
      lockedSegmentKeys.has(buildSegmentDisplacementKey(entry.connectorId, entry.routeSegmentIndex));

    for (let index = 0; index < group.length; index += 1) {
      if (visited.has(index)) {
        continue;
      }

      const componentIndices: number[] = [];
      const queue = [index];
      visited.add(index);
      while (queue.length > 0) {
        const currentIndex = queue.shift()!;
        componentIndices.push(currentIndex);
        for (let candidateIndex = 0; candidateIndex < group.length; candidateIndex += 1) {
          if (visited.has(candidateIndex)) {
            continue;
          }
          if (overlaps(group[currentIndex]!, group[candidateIndex]!)) {
            visited.add(candidateIndex);
            queue.push(candidateIndex);
          }
        }
      }

      const component = componentIndices.map((componentIndex) => group[componentIndex]!);
      const fixedEntries = component
        .filter((entry) => isLocked(entry))
        .sort((left, right) =>
          getEffectiveCoordinate(left) - getEffectiveCoordinate(right)
          || compareEntries(left, right)
        );
      const movableEntries = component
        .filter((entry) => !isLocked(entry))
        .sort(compareEntries);
      const occupied = fixedEntries.map((entry) => ({
        entry,
        coordinate: getEffectiveCoordinate(entry)
      }));

      for (const entry of movableEntries) {
        let assignedCoordinate = getEffectiveCoordinate(entry);
        for (const occupiedEntry of occupied) {
          if (!spansOverlap(
            entry.spanStart,
            entry.spanEnd,
            occupiedEntry.entry.spanStart,
            occupiedEntry.entry.spanEnd
          )) {
            continue;
          }
          if (assignedCoordinate < occupiedEntry.coordinate + ENDPOINT_SPACING) {
            assignedCoordinate = roundMetric(occupiedEntry.coordinate + ENDPOINT_SPACING);
          }
        }

        occupied.push({
          entry,
          coordinate: assignedCoordinate
        });
        occupied.sort((left, right) =>
          left.coordinate - right.coordinate
          || compareEntries(left.entry, right.entry)
        );

        const totalDisplacement = roundMetric(assignedCoordinate - entry.nominalCoordinate);
        const segmentKey = buildSegmentDisplacementKey(entry.connectorId, entry.routeSegmentIndex);
        if (totalDisplacement > (displacementBySegmentKey.get(segmentKey) ?? 0)) {
          displacementBySegmentKey.set(segmentKey, totalDisplacement);
        }
      }
    }
    });
  };

  processGroups(genericGroups, compareByPriority);
  processGroups(obstacleLocalGroups, compareByObstacleOwnership);

  return displacementBySegmentKey;
}

function resolveRequiredColumnExpansions(
  occupancy: readonly OutcomeOpportunityGutterOccupancy[],
  index: OutcomeOpportunityPositionedIndex,
  displacementBySegmentKey: ReadonlyMap<string, number>
): Record<number, number> {
  const required: Record<number, number> = {};

  for (const entry of occupancy) {
    if (entry.axis !== "vertical" || entry.columnOrder === undefined) {
      continue;
    }
    const displacement = displacementBySegmentKey.get(
      buildSegmentDisplacementKey(entry.connectorId, entry.routeSegmentIndex)
    ) ?? 0;
    const nextColumnLeft = getNextValue(index.columnLeftByOrder, entry.columnOrder);
    if (nextColumnLeft === undefined) {
      continue;
    }
    const effectiveCoordinate = roundMetric(entry.nominalCoordinate + displacement);
    const overflow = roundMetric(effectiveCoordinate - (nextColumnLeft - GUTTER_OVERFLOW_TOLERANCE));
    if (overflow > 0) {
      required[entry.columnOrder] = roundUpToEndpointSpacing(
        Math.max(required[entry.columnOrder] ?? 0, overflow)
      );
    }
  }

  return required;
}

function resolveRequiredRowExpansions(
  occupancy: readonly OutcomeOpportunityGutterOccupancy[],
  index: OutcomeOpportunityPositionedIndex,
  displacementBySegmentKey: ReadonlyMap<string, number>
): Record<number, number> {
  const required: Record<number, number> = {};

  for (const entry of occupancy) {
    if (entry.axis !== "horizontal" || entry.rowOrder === undefined) {
      continue;
    }
    const displacement = displacementBySegmentKey.get(
      buildSegmentDisplacementKey(entry.connectorId, entry.routeSegmentIndex)
    ) ?? 0;
    const nextRowTop = getNextValue(index.rowTopByOrder, entry.rowOrder);
    if (nextRowTop === undefined) {
      continue;
    }
    const effectiveCoordinate = roundMetric(entry.nominalCoordinate + displacement);
    const overflow = roundMetric(effectiveCoordinate - (nextRowTop - GUTTER_OVERFLOW_TOLERANCE));
    if (overflow > 0) {
      required[entry.rowOrder] = roundUpToEndpointSpacing(
        Math.max(required[entry.rowOrder] ?? 0, overflow)
      );
    }
  }

  return required;
}

function segmentIntersectsBox(
  start: Point,
  end: Point,
  box: OutcomeOpportunityBox,
  options: { ignoreStart?: boolean; ignoreEnd?: boolean } = {}
): boolean {
  if (Math.abs(start.x - end.x) <= 0.5) {
    const x = start.x;
    if (x <= box.x + 0.5 || x >= box.x + box.width - 0.5) {
      return false;
    }
    const low = Math.min(start.y, end.y);
    const high = Math.max(start.y, end.y);
    const clippedLow = options.ignoreStart ? low + 0.5 : low;
    const clippedHigh = options.ignoreEnd ? high - 0.5 : high;
    return clippedLow < box.y + box.height - 0.5 && clippedHigh > box.y + 0.5;
  }

  if (Math.abs(start.y - end.y) <= 0.5) {
    const y = start.y;
    if (y <= box.y + 0.5 || y >= box.y + box.height - 0.5) {
      return false;
    }
    const low = Math.min(start.x, end.x);
    const high = Math.max(start.x, end.x);
    const clippedLow = options.ignoreStart ? low + 0.5 : low;
    const clippedHigh = options.ignoreEnd ? high - 0.5 : high;
    return clippedLow < box.x + box.width - 0.5 && clippedHigh > box.x + 0.5;
  }

  return false;
}

function emitFinalIntersectionDiagnostics(
  plans: readonly OutcomeOpportunityConnectorTemplatePlan[],
  boxes: readonly OutcomeOpportunityBox[],
  diagnostics: RendererDiagnostic[]
): void {
  for (const plan of plans) {
    for (let index = 1; index < plan.finalRoute.points.length; index += 1) {
      const start = plan.finalRoute.points[index - 1]!;
      const end = plan.finalRoute.points[index]!;
      for (const box of boxes) {
        const endpoint = box.itemId === plan.from || box.itemId === plan.to;
        if (segmentIntersectsBox(start, end, box, {
          ignoreStart: endpoint && index === 1,
          ignoreEnd: endpoint && index === plan.finalRoute.points.length - 1
        })) {
          diagnostics.push(createRoutingDiagnostic(
            "renderer.routing.outcome_opportunity_node_intersection",
            `Connector "${plan.edgeId}" intersects node "${box.itemId}" after outcome-opportunity routing.`,
            plan.edgeId,
            "error"
          ));
        }
      }
    }
  }
}

function inflateLabelBlockingBox(box: OutcomeOpportunityBox, clearance: number): BlockingBox {
  return {
    itemId: box.itemId,
    x: roundMetric(box.x - clearance),
    y: roundMetric(box.y - clearance),
    width: roundMetric(box.width + clearance * 2),
    height: roundMetric(box.height + clearance * 2)
  };
}

function collectLabelBlockingBoxes(index: OutcomeOpportunityPositionedIndex): BlockingBox[] {
  return index.nodeBoxes.map((box) => inflateLabelBlockingBox(box, HORIZONTAL_LABEL_NODE_CLEARANCE));
}

function buildConnectorSegmentBlockingBoxes(
  plans: readonly OutcomeOpportunityConnectorTemplatePlan[],
  excludedPlanId: string,
  clearance: number
): BlockingBox[] {
  const boxes: BlockingBox[] = [];

  for (const plan of plans) {
    if (plan.id === excludedPlanId) {
      continue;
    }

    for (const segment of buildRouteSegmentDetails(plan.finalRoute)) {
      if (segment.orientation === "vertical") {
        const spanStart = Math.min(segment.start.y, segment.end.y);
        const spanEnd = Math.max(segment.start.y, segment.end.y);
        if (spanEnd - spanStart <= 0.5) {
          continue;
        }
        boxes.push({
          itemId: `${plan.id}:segment:${segment.routeSegmentIndex}`,
          x: roundMetric(segment.coordinate - clearance),
          y: roundMetric(spanStart - clearance),
          width: roundMetric(clearance * 2),
          height: roundMetric((spanEnd - spanStart) + clearance * 2)
        });
        continue;
      }

      const spanStart = Math.min(segment.start.x, segment.end.x);
      const spanEnd = Math.max(segment.start.x, segment.end.x);
      if (spanEnd - spanStart <= 0.5) {
        continue;
      }
      boxes.push({
        itemId: `${plan.id}:segment:${segment.routeSegmentIndex}`,
        x: roundMetric(spanStart - clearance),
        y: roundMetric(segment.coordinate - clearance),
        width: roundMetric((spanEnd - spanStart) + clearance * 2),
        height: roundMetric(clearance * 2)
      });
    }
  }

  return boxes;
}

function placeLabels(
  plans: readonly OutcomeOpportunityConnectorTemplatePlan[],
  scene: PositionedScene,
  index: OutcomeOpportunityPositionedIndex,
  diagnostics: RendererDiagnostic[]
): Map<string, PositionedEdge["label"]> {
  const labelsByPlanId = new Map<string, PositionedEdge["label"]>();
  const connectorSegmentsById = buildConnectorRouteSegmentsById(
    plans,
    (plan) => plan.id,
    (plan) => plan.finalRoute
  );
  const placedLabelBoxes: BlockingBox[] = [];
  const nodeBoxes = collectLabelBlockingBoxes(index);

  for (const plan of plans) {
    if (!plan.label) {
      continue;
    }
    const label = positionConnectorLabel({
      connectorId: plan.id,
      measuredLabel: plan.label,
      route: plan.finalRoute,
      connectorSegmentsById,
      blockedBoxes: [
        ...nodeBoxes,
        ...buildConnectorSegmentBlockingBoxes(plans, plan.id, HORIZONTAL_LABEL_TRACK_CLEARANCE),
        ...placedLabelBoxes
      ],
      separatorSegments: [],
      scene,
      diagnostics,
      diagnosticsPolicy: {
        omittedCode: "renderer.routing.outcome_opportunity_edge_label_omitted",
        fallbackCode: "renderer.routing.outcome_opportunity_edge_label_fallback",
        noAnchorMessage: (connectorId) => `Connector "${connectorId}" has no usable label anchor.`,
        noCandidateMessage: (connectorId) => `Connector "${connectorId}" has no collision-free label position.`,
        fallbackMessage: (connectorId) => `Connector "${connectorId}" used fallback label placement.`
      },
      connectorBlockMode: "all_segments",
      horizontalPlacementMode: "scenario_side_offsets"
    });
    if (!label) {
      continue;
    }
    labelsByPlanId.set(plan.id, label);
    placedLabelBoxes.push({
      x: label.x,
      y: label.y,
      width: label.width,
      height: label.height
    });
  }

  return labelsByPlanId;
}

function withStep2EdgesAndDiagnostics(
  scene: PositionedScene,
  edges: PositionedEdge[],
  diagnostics: readonly RendererDiagnostic[]
): PositionedScene {
  return decorateOutcomeOpportunityPositionedScene({
    ...structuredClone(scene),
    edges,
    decorations: [],
    diagnostics: sortRendererDiagnostics([
      ...scene.diagnostics,
      ...diagnostics
    ])
  });
}

function routePlansForScene(
  plans: readonly OutcomeOpportunityConnectorTemplatePlan[],
  index: OutcomeOpportunityPositionedIndex,
  routeField: "step2Route" | "step3Route" | "finalRoute",
  stage: "step2" | "guttered"
): OutcomeOpportunityConnectorTemplatePlan[] {
  const buckets = buildNodeEdgeBuckets(plans, index);
  const endpointOffsets = buildEndpointOffsets(index, buckets);

  return plans.map((plan) => {
    const source = index.nodeById.get(plan.from);
    const target = index.nodeById.get(plan.to);
    if (!source || !target) {
      return plan;
    }
    return {
      ...plan,
      [routeField]: buildTemplateRoute(plan, source, target, endpointOffsets, stage)
    };
  });
}

function routePlansForSceneWithEndpointOffsets(
  plans: readonly OutcomeOpportunityConnectorTemplatePlan[],
  index: OutcomeOpportunityPositionedIndex,
  routeField: "step2Route" | "step3Route" | "finalRoute",
  stage: "step2" | "guttered",
  endpointOffsets: ReadonlyMap<string, Map<PortSide, Map<string, number>>>
): OutcomeOpportunityConnectorTemplatePlan[] {
  return plans.map((plan) => {
    const source = index.nodeById.get(plan.from);
    const target = index.nodeById.get(plan.to);
    if (!source || !target) {
      return plan;
    }
    return {
      ...plan,
      [routeField]: buildTemplateRoute(plan, source, target, endpointOffsets, stage)
    };
  });
}

function buildFinalRoute(
  plan: OutcomeOpportunityConnectorTemplatePlan,
  index: OutcomeOpportunityPositionedIndex,
  endpointOffsetsByNodeId: ReadonlyMap<string, Map<PortSide, Map<string, number>>>,
  displacementBySegmentKey: ReadonlyMap<string, number>,
  bundleEndpointCoordinateByEndpointKey: ReadonlyMap<string, number>,
  bundleSegmentCoordinateBySegmentKey: ReadonlyMap<string, number>
): OutcomeOpportunityConnectorRouteState {
  const source = index.nodeById.get(plan.from);
  const target = index.nodeById.get(plan.to);
  if (!source || !target) {
    return {
      route: plan.step3Route,
      occupiedGutters: []
    };
  }

  const sourceOffset = getEndpointOffset(endpointOffsetsByNodeId, plan.from, plan.sourceSide, plan.id);
  const targetOffset = getEndpointOffset(endpointOffsetsByNodeId, plan.to, plan.targetSide, plan.id);
  let sourcePoint = getSidePointWithOffset(
    source.node,
    plan.sourceSide,
    sourceOffset
  );
  let targetPoint = getSidePointWithOffset(
    target.node,
    plan.targetSide,
    targetOffset
  );
  if (
    plan.sourceSide === "east"
    && plan.targetSide === "west"
    && (plan.pattern === "same_band_addressing"
      || plan.pattern === "same_band_support"
      || plan.pattern === "same_band_measurement")
    && sourcePoint.x <= targetPoint.x
    && Math.abs(sourceOffset) <= 0.5
    && Math.abs(targetOffset) <= 0.5
  ) {
    const aligned = tryAlignHorizontalEndpoints(source.node, target.node, sourcePoint, targetPoint);
    if (aligned.aligned) {
      sourcePoint = aligned.sourcePoint;
      targetPoint = aligned.targetPoint;
    }
  }
  const sourceBundleCoordinate = bundleEndpointCoordinateByEndpointKey.get(
    buildEndpointCoordinateKey(plan.id, "source")
  );
  const targetBundleCoordinate = bundleEndpointCoordinateByEndpointKey.get(
    buildEndpointCoordinateKey(plan.id, "target")
  );
  const segments = buildRouteSegmentDetails(plan.step3Route);

  if (segments.length === 0) {
    return {
      route: buildRoute([sourcePoint, targetPoint]),
      occupiedGutters: []
    };
  }

  if (segments.length === 1) {
    const onlySegment = segments[0]!;
    const segmentKey = buildSegmentDisplacementKey(plan.id, onlySegment.routeSegmentIndex);
    const displacement = displacementBySegmentKey.get(segmentKey) ?? 0;
    const resolvedCoordinate = bundleSegmentCoordinateBySegmentKey.get(segmentKey)
      ?? roundMetric(onlySegment.coordinate + displacement);

    if (onlySegment.orientation === "vertical") {
      const bridgeX = roundMetric(Math.max(sourcePoint.x, targetPoint.x, resolvedCoordinate));
      if (bridgeX === sourcePoint.x && bridgeX === targetPoint.x) {
        return {
          route: buildRoute([sourcePoint, targetPoint]),
          occupiedGutters: []
        };
      }

      const direction = sourcePoint.y <= targetPoint.y ? 1 : -1;
      const sourceStubY = sourceBundleCoordinate
        ?? roundMetric(sourcePoint.y + direction * ENDPOINT_SPACING);
      const targetStubY = targetBundleCoordinate
        ?? roundMetric(targetPoint.y - direction * ENDPOINT_SPACING);
      return {
        route: buildRoute([
          sourcePoint,
          { x: sourcePoint.x, y: sourceStubY },
          { x: bridgeX, y: sourceStubY },
          { x: bridgeX, y: targetStubY },
          { x: targetPoint.x, y: targetStubY },
          targetPoint
        ]),
        occupiedGutters: []
      };
    }

    const bridgeY = roundMetric(Math.max(sourcePoint.y, targetPoint.y, resolvedCoordinate));
    const explicitSegmentCoordinate = bundleSegmentCoordinateBySegmentKey.get(segmentKey);
    const segmentAdjustment = explicitSegmentCoordinate === undefined
      ? displacement
      : roundMetric(explicitSegmentCoordinate - onlySegment.coordinate);
    const canPreserveDirectRoute = plan.sourceSide === "east"
      && plan.targetSide === "west"
      && (plan.pattern === "same_band_addressing"
        || plan.pattern === "same_band_support"
        || plan.pattern === "same_band_measurement")
      && Math.abs(sourcePoint.y - targetPoint.y) <= 0.5
      && Math.abs(segmentAdjustment) < ENDPOINT_SPACING - 0.5
      && !index.nodeBoxes
        .filter((box) => box.itemId !== plan.from && box.itemId !== plan.to)
        .some((box) => segmentIntersectsBox(sourcePoint, targetPoint, box));
    if (canPreserveDirectRoute) {
      return {
        route: buildRoute([sourcePoint, targetPoint]),
        occupiedGutters: []
      };
    }

    const direction = sourcePoint.x <= targetPoint.x ? 1 : -1;
    const sourceStubX = sourceBundleCoordinate
      ?? roundMetric(sourcePoint.x + direction * ENDPOINT_SPACING);
    const targetStubX = targetBundleCoordinate
      ?? roundMetric(targetPoint.x - direction * ENDPOINT_SPACING);
    const direct = bridgeY === sourcePoint.y
      && bridgeY === targetPoint.y
      && sourceStubX === sourcePoint.x
      && targetStubX === targetPoint.x;
    return {
      route: direct
        ? buildRoute([sourcePoint, targetPoint])
        : buildRoute([
          sourcePoint,
          { x: sourceStubX, y: sourcePoint.y },
          { x: sourceStubX, y: bridgeY },
          { x: targetStubX, y: bridgeY },
          { x: targetStubX, y: targetPoint.y },
          targetPoint
        ]),
      occupiedGutters: []
    };
  }

  const adjustedSegments = segments.map((segment, segmentIndex) => {
    const segmentKey = buildSegmentDisplacementKey(plan.id, segment.routeSegmentIndex);
    const bundleCoordinate = bundleSegmentCoordinateBySegmentKey.get(segmentKey);
    const displacedCoordinate = bundleCoordinate ?? (
      displacementBySegmentKey.has(segmentKey)
        ? roundMetric(segment.coordinate + (displacementBySegmentKey.get(segmentKey) ?? 0))
        : undefined
    );
    if (segment.orientation === "vertical") {
      if (segmentIndex === 0) {
        return {
          orientation: "vertical" as const,
          coordinate: displacedCoordinate ?? sourcePoint.x
        };
      }
      if (segmentIndex === segments.length - 1) {
        return {
          orientation: "vertical" as const,
          coordinate: displacedCoordinate ?? targetPoint.x
        };
      }
      return {
        orientation: "vertical" as const,
        coordinate: displacedCoordinate ?? segment.coordinate
      };
    }

    if (segmentIndex === 0) {
      return {
        orientation: "horizontal" as const,
        coordinate: displacedCoordinate ?? sourcePoint.y
      };
    }
    if (segmentIndex === segments.length - 1) {
      return {
        orientation: "horizontal" as const,
        coordinate: displacedCoordinate ?? targetPoint.y
      };
    }
    return {
      orientation: "horizontal" as const,
      coordinate: displacedCoordinate ?? segment.coordinate
    };
  });
  const points: Point[] = [sourcePoint];
  const firstSegment = adjustedSegments[0]!;
  const secondSegment = adjustedSegments[1];
  if (secondSegment && firstSegment.orientation === "horizontal" && firstSegment.coordinate !== sourcePoint.y) {
    const approachX = plan.sourceSide === "east" || plan.sourceSide === "west"
      ? sourceBundleCoordinate ?? resolveExteriorApproachCoordinate(sourcePoint, plan.sourceSide, sourceOffset)
      : sourcePoint.x;
    points.push(
      {
        x: approachX,
        y: sourcePoint.y
      },
      {
        x: approachX,
        y: firstSegment.coordinate
      }
    );
  }
  if (secondSegment && firstSegment.orientation === "vertical" && firstSegment.coordinate !== sourcePoint.x) {
    const approachY = plan.sourceSide === "north" || plan.sourceSide === "south"
      ? sourceBundleCoordinate ?? resolveExteriorApproachCoordinate(sourcePoint, plan.sourceSide, sourceOffset)
      : sourcePoint.y;
    points.push(
      {
        x: sourcePoint.x,
        y: approachY
      },
      {
        x: firstSegment.coordinate,
        y: approachY
      }
    );
  }
  for (let segmentIndex = 1; segmentIndex < adjustedSegments.length; segmentIndex += 1) {
    const previous = adjustedSegments[segmentIndex - 1]!;
    const next = adjustedSegments[segmentIndex]!;
    points.push(previous.orientation === "horizontal"
      ? {
        x: next.coordinate,
        y: previous.coordinate
      }
      : {
        x: previous.coordinate,
        y: next.coordinate
      });
  }
  const lastSegment = adjustedSegments[adjustedSegments.length - 1]!;
  if (lastSegment.orientation === "horizontal" && lastSegment.coordinate !== targetPoint.y) {
    const approachX = plan.targetSide === "east" || plan.targetSide === "west"
      ? targetBundleCoordinate ?? resolveExteriorApproachCoordinate(targetPoint, plan.targetSide, targetOffset)
      : targetPoint.x;
    points.push(
      {
        x: approachX,
        y: lastSegment.coordinate
      },
      {
        x: approachX,
        y: targetPoint.y
      }
    );
  }
  if (lastSegment.orientation === "vertical" && lastSegment.coordinate !== targetPoint.x) {
    const approachY = plan.targetSide === "north" || plan.targetSide === "south"
      ? targetBundleCoordinate ?? resolveExteriorApproachCoordinate(targetPoint, plan.targetSide, targetOffset)
      : targetPoint.y;
    points.push(
      {
        x: lastSegment.coordinate,
        y: approachY
      },
      {
        x: targetPoint.x,
        y: approachY
      }
    );
  }
  points.push(targetPoint);

  return {
    route: buildRoute(points),
    occupiedGutters: []
  };
}

function buildRouteStatesForPlans(
  plans: readonly OutcomeOpportunityConnectorTemplatePlan[],
  index: OutcomeOpportunityPositionedIndex,
  endpointOffsetsByNodeId: ReadonlyMap<string, Map<PortSide, Map<string, number>>>,
  displacementBySegmentKey: ReadonlyMap<string, number>,
  bundleEndpointCoordinateByEndpointKey: ReadonlyMap<string, number>,
  bundleSegmentCoordinateBySegmentKey: ReadonlyMap<string, number>
): Map<string, OutcomeOpportunityConnectorRouteState> {
  const routeStates = new Map<string, OutcomeOpportunityConnectorRouteState>();

  for (const plan of plans) {
    routeStates.set(
      plan.id,
      buildFinalRoute(
        plan,
        index,
        endpointOffsetsByNodeId,
        displacementBySegmentKey,
        bundleEndpointCoordinateByEndpointKey,
        bundleSegmentCoordinateBySegmentKey
      )
    );
  }

  return routeStates;
}

interface OutcomeOpportunityTargetLocalRouteGeometry {
  side: PortSide;
  localTrunk: OutcomeOpportunityRouteSegmentDetail;
  finalApproach: OutcomeOpportunityRouteSegmentDetail;
  targetAxisCoordinate: number;
}

function deriveTargetLocalRouteGeometry(
  plan: OutcomeOpportunityConnectorTemplatePlan,
  route: PositionedRoute,
  index: OutcomeOpportunityPositionedIndex
): OutcomeOpportunityTargetLocalRouteGeometry | undefined {
  const target = index.nodeById.get(plan.to);
  if (!target) {
    return undefined;
  }

  const routeSegments = buildRouteSegmentDetails(route);
  const localTrunk = findEndpointLocalSegment(routeSegments, target.node, plan.targetSide, "target");
  const targetPoint = route.points[route.points.length - 1];
  if (!localTrunk || !targetPoint) {
    return undefined;
  }

  const finalApproach = routeSegments.find((segment) =>
    segment.routeSegmentIndex > localTrunk.routeSegmentIndex
    && segment.orientation === getPrimaryOrientationForSide(plan.targetSide)
    && segmentContainsPoint(segment, targetPoint)
  );
  if (!finalApproach) {
    return undefined;
  }

  return {
    side: plan.targetSide,
    localTrunk,
    finalApproach,
    targetAxisCoordinate: plan.targetSide === "east" || plan.targetSide === "west"
      ? targetPoint.y
      : targetPoint.x
  };
}

function buildTargetLocalBypassRoute(
  route: PositionedRoute,
  geometry: OutcomeOpportunityTargetLocalRouteGeometry,
  bypassCoordinate: number
): PositionedRoute {
  const targetPoint = route.points[route.points.length - 1]!;
  const prefix = route.points.slice(0, geometry.localTrunk.routeSegmentIndex + 1);

  if (geometry.side === "east" || geometry.side === "west") {
    return buildRoute([
      ...prefix,
      {
        x: geometry.localTrunk.coordinate,
        y: bypassCoordinate
      },
      {
        x: targetPoint.x,
        y: bypassCoordinate
      },
      targetPoint
    ]);
  }

  return buildRoute([
    ...prefix,
    {
      x: bypassCoordinate,
      y: geometry.localTrunk.coordinate
    },
    {
      x: bypassCoordinate,
      y: targetPoint.y
    },
    targetPoint
  ]);
}

function applyTargetLocalBypassesToRouteStates(
  plans: readonly OutcomeOpportunityConnectorTemplatePlan[],
  routeStates: ReadonlyMap<string, OutcomeOpportunityConnectorRouteState>,
  targetLocalBypassSelections: ReadonlyMap<string, OutcomeOpportunityTargetLocalBypassSelection>,
  index: OutcomeOpportunityPositionedIndex,
  diagnostics: RendererDiagnostic[]
): Map<string, OutcomeOpportunityConnectorRouteState> {
  if (targetLocalBypassSelections.size === 0) {
    return new Map(routeStates);
  }

  const planById = new Map(plans.map((plan) => [plan.id, plan] as const));
  const updated = new Map(routeStates);

  for (const selection of targetLocalBypassSelections.values()) {
    const plan = planById.get(selection.connectorId);
    const routeState = updated.get(selection.connectorId);
    if (!plan || !routeState) {
      continue;
    }

    const geometry = deriveTargetLocalRouteGeometry(plan, routeState.route, index);
    if (!geometry || geometry.side !== selection.side) {
      continue;
    }

    const blockerRoutes: PositionedRoute[] = [];
    const blockerGeometries = selection.blockerConnectorIds.flatMap((blockerConnectorId) => {
      const blockerPlan = planById.get(blockerConnectorId);
      const blockerRouteState = updated.get(blockerConnectorId);
      if (!blockerPlan || !blockerRouteState) {
        return [];
      }
      const blockerGeometry = deriveTargetLocalRouteGeometry(blockerPlan, blockerRouteState.route, index);
      if (blockerGeometry && blockerGeometry.side === selection.side
        && approachCrossesLocalTrunk(geometry.finalApproach, blockerGeometry.localTrunk)
      ) {
        blockerRoutes.push(blockerRouteState.route);
        return [blockerGeometry];
      }
      return [];
    });
    if (blockerGeometries.length === 0) {
      continue;
    }

    const blockerSpanStart = Math.min(...blockerGeometries.map((blocker) => segmentSpanStart(blocker.localTrunk)));
    const blockerSpanEnd = Math.max(...blockerGeometries.map((blocker) => segmentSpanEnd(blocker.localTrunk)));
    const candidateCoordinates = [
      roundMetric(blockerSpanStart - ENDPOINT_SPACING),
      roundMetric(blockerSpanEnd + ENDPOINT_SPACING)
    ].sort((left, right) =>
      Math.abs(left - geometry.targetAxisCoordinate) - Math.abs(right - geometry.targetAxisCoordinate)
      || left - right
    );

    const acceptedRoute = candidateCoordinates
      .map((candidateCoordinate) => buildTargetLocalBypassRoute(routeState.route, geometry, candidateCoordinate))
      .find((candidateRoute) => collectIntersectingBoxes(
        candidateRoute.points,
        getNonEndpointBoxes(plan, index)
      ).length === 0 && blockerRoutes.every((blockerRoute) => !routesCrossAtInterior(candidateRoute, blockerRoute)));

    if (!acceptedRoute) {
      diagnostics.push(createRoutingDiagnostic(
        "renderer.routing.outcome_opportunity_connector_crossing_fallback",
        `Connector "${plan.edgeId}" kept its target approach because no node- and connector-clear target-local bypass was available.`,
        plan.edgeId,
        "warn"
      ));
      continue;
    }

    updated.set(selection.connectorId, {
      route: acceptedRoute,
      occupiedGutters: []
    });
  }

  return updated;
}

function buildGutterLocalPreparedRoutes(
  plans: readonly OutcomeOpportunityConnectorTemplatePlan[],
  scene: PositionedScene,
  index: OutcomeOpportunityPositionedIndex,
  globalGutterState: OutcomeOpportunityGlobalGutterState,
  bucketsByNodeId: ReadonlyMap<string, OutcomeOpportunityNodeEdgeBuckets>,
  endpointOffsetsByNodeId: ReadonlyMap<string, Map<PortSide, Map<string, number>>>,
  diagnostics: RendererDiagnostic[]
): {
  bundleEndpointCoordinateByEndpointKey: Map<string, number>;
  bundleSegmentCoordinateBySegmentKey: Map<string, number>;
  lockedBundleSegmentKeys: Set<string>;
  requiredColumnExpansions: Record<number, number>;
  requiredRowExpansions: Record<number, number>;
  routeStates: Map<string, OutcomeOpportunityConnectorRouteState>;
  occupancyResult: {
    occupancy: OutcomeOpportunityGutterOccupancy[];
    occupancyByConnectorId: Map<string, OutcomeOpportunityGutterOccupancy[]>;
  };
  connectorPlansWithOccupancy: OutcomeOpportunityConnectorTemplatePlan[];
} {
  const nominalPlans = applyLocalSwervesToStep3Plans(
    routePlansForSceneWithEndpointOffsets(
      plans,
      index,
      "step3Route",
      "guttered",
      endpointOffsetsByNodeId
    ),
    index,
    bucketsByNodeId,
    diagnostics
  );
  const nominalRouteStates = buildRouteStatesForPlans(
    nominalPlans,
    index,
    endpointOffsetsByNodeId,
    new Map<string, number>(),
    new Map<string, number>(),
    new Map<string, number>()
  );
  const nominalOccupancyResult = extractGutterOccupancyByConnector(
    nominalPlans,
    new Map([...nominalRouteStates.entries()].map(([connectorId, state]) => [connectorId, state.route] as const)),
    scene,
    index,
    globalGutterState
  );
  const bundleResolution = buildGutterLocalBundleResolution(
    nominalPlans,
    new Map([...nominalRouteStates.entries()].map(([connectorId, state]) => [connectorId, state.route] as const)),
    nominalOccupancyResult.occupancy,
    scene,
    globalGutterState,
    index
  );
  const routeStates = buildRouteStatesForPlans(
    nominalPlans,
    index,
    endpointOffsetsByNodeId,
    new Map<string, number>(),
    bundleResolution.endpointCoordinateByEndpointKey,
    bundleResolution.segmentCoordinateBySegmentKey
  );
  const occupancyResult = extractGutterOccupancyByConnector(
    nominalPlans,
    new Map([...routeStates.entries()].map(([connectorId, state]) => [connectorId, state.route] as const)),
    scene,
    index,
    globalGutterState
  );

  return {
    bundleEndpointCoordinateByEndpointKey: bundleResolution.endpointCoordinateByEndpointKey,
    bundleSegmentCoordinateBySegmentKey: bundleResolution.segmentCoordinateBySegmentKey,
    lockedBundleSegmentKeys: bundleResolution.lockedSegmentKeys,
    requiredColumnExpansions: bundleResolution.requiredColumnExpansions,
    requiredRowExpansions: bundleResolution.requiredRowExpansions,
    routeStates,
    occupancyResult,
    connectorPlansWithOccupancy: nominalPlans.map((plan) => ({
      ...plan,
      occupiedGutters: occupancyResult.occupancyByConnectorId.get(plan.id) ?? []
    }))
  };
}

function buildPreparedRoutesWithLateEndpointOrdering(
  plans: readonly OutcomeOpportunityConnectorTemplatePlan[],
  scene: PositionedScene,
  index: OutcomeOpportunityPositionedIndex,
  globalGutterState: OutcomeOpportunityGlobalGutterState,
  bucketsByNodeId: ReadonlyMap<string, OutcomeOpportunityNodeEdgeBuckets>,
  diagnostics: RendererDiagnostic[]
): {
  endpointOffsetsByNodeId: ReadonlyMap<string, Map<PortSide, Map<string, number>>>;
  gutterLocalPrepared: ReturnType<typeof buildGutterLocalPreparedRoutes>;
} {
  const initialEndpointOffsetsByNodeId = buildEndpointOffsets(index, bucketsByNodeId);
  const initialPrepared = buildGutterLocalPreparedRoutes(
    plans,
    scene,
    index,
    globalGutterState,
    bucketsByNodeId,
    initialEndpointOffsetsByNodeId,
    diagnostics
  );
  const preferredSideOrderOverrides = buildPreferredEndpointSideOrderOverrides(
    plans,
    bucketsByNodeId,
    initialPrepared.routeStates
  );

  if (preferredSideOrderOverrides.size === 0) {
    return {
      endpointOffsetsByNodeId: initialEndpointOffsetsByNodeId,
      gutterLocalPrepared: initialPrepared
    };
  }

  const optimizedEndpointOffsetsByNodeId = buildEndpointOffsets(index, bucketsByNodeId, preferredSideOrderOverrides);
  const optimizedPrepared = buildGutterLocalPreparedRoutes(
    plans,
    scene,
    index,
    globalGutterState,
    bucketsByNodeId,
    optimizedEndpointOffsetsByNodeId,
    diagnostics
  );
  return {
    endpointOffsetsByNodeId: optimizedEndpointOffsetsByNodeId,
    gutterLocalPrepared: optimizedPrepared
  };
}

function buildObstacleLocalCompaction(
  plans: readonly OutcomeOpportunityConnectorTemplatePlan[],
  occupancy: readonly OutcomeOpportunityGutterOccupancy[],
  index: OutcomeOpportunityPositionedIndex
): {
  segmentCoordinateBySegmentKey: Map<string, number>;
  lockedSegmentKeys: Set<string>;
} {
  const planById = new Map(plans.map((plan) => [plan.id, plan] as const));
  const segmentCoordinateBySegmentKey = new Map<string, number>();
  const lockedSegmentKeys = new Set<string>();
  const groups = new Map<string, OutcomeOpportunityGutterOccupancy[]>();

  for (const entry of occupancy) {
    if (!isObstacleLocalKind(entry.kind)) {
      continue;
    }
    const key = `${entry.key}|${entry.axis}`;
    const existing = groups.get(key) ?? [];
    existing.push(entry);
    groups.set(key, existing);
  }

  const compareMovableEntries = (
    left: OutcomeOpportunityGutterOccupancy,
    right: OutcomeOpportunityGutterOccupancy,
    baseCoordinate: number
  ): number => {
    const leftDistance = Math.abs(left.nominalCoordinate - baseCoordinate);
    const rightDistance = Math.abs(right.nominalCoordinate - baseCoordinate);
    const leftPlan = planById.get(left.connectorId);
    const rightPlan = planById.get(right.connectorId);

    if (Math.abs(leftDistance - rightDistance) > 0.5) {
      return leftDistance - rightDistance;
    }
    if (!leftPlan || !rightPlan) {
      return left.connectorId.localeCompare(right.connectorId);
    }
    return compareConnectorPlanPriority(leftPlan, rightPlan)
      || left.routeSegmentIndex - right.routeSegmentIndex
      || left.connectorId.localeCompare(right.connectorId);
  };

  groups.forEach((group) => {
    const first = group[0];
    if (!first?.nodeId) {
      return;
    }

    const side = getObstacleSideFromKind(first.kind);
    const node = index.nodeById.get(first.nodeId)?.node;
    if (!side || !node) {
      return;
    }

    const baseCoordinate = getObstacleLocalBaseCoordinate(node, side);
    const direction = getOutwardDirectionForSide(side);
    const visited = new Set<number>();
    const competesLocally = (
      left: OutcomeOpportunityGutterOccupancy,
      right: OutcomeOpportunityGutterOccupancy
    ): boolean => spansTouchOrOverlap(left.spanStart, left.spanEnd, right.spanStart, right.spanEnd);

    for (let groupIndex = 0; groupIndex < group.length; groupIndex += 1) {
      if (visited.has(groupIndex)) {
        continue;
      }

      const componentIndices: number[] = [];
      const queue = [groupIndex];
      visited.add(groupIndex);
      while (queue.length > 0) {
        const currentIndex = queue.shift()!;
        componentIndices.push(currentIndex);
        for (let candidateIndex = 0; candidateIndex < group.length; candidateIndex += 1) {
          if (visited.has(candidateIndex)) {
            continue;
          }
          if (competesLocally(group[currentIndex]!, group[candidateIndex]!)) {
            visited.add(candidateIndex);
            queue.push(candidateIndex);
          }
        }
      }

      const component = componentIndices.map((componentIndex) => group[componentIndex]!);
      const fixedEntries = component.filter((entry) => (entry.ownershipRank ?? 0) === 0);
      const movableEntries = component
        .filter((entry) => (entry.ownershipRank ?? 0) > 0)
        .sort((left, right) => compareMovableEntries(left, right, baseCoordinate));

      if (movableEntries.length === 0) {
        continue;
      }

      const occupied = fixedEntries.map((entry) => ({
        entry,
        coordinate: entry.nominalCoordinate
      }));

      for (const entry of movableEntries) {
        let assignedCoordinate = baseCoordinate;
        for (const occupiedEntry of occupied) {
          if (!competesLocally(entry, occupiedEntry.entry)) {
            continue;
          }

          if (direction > 0) {
            if (assignedCoordinate < occupiedEntry.coordinate + ENDPOINT_SPACING) {
              assignedCoordinate = roundMetric(occupiedEntry.coordinate + ENDPOINT_SPACING);
            }
          } else if (assignedCoordinate > occupiedEntry.coordinate - ENDPOINT_SPACING) {
            assignedCoordinate = roundMetric(occupiedEntry.coordinate - ENDPOINT_SPACING);
          }
        }

        const coordinate = roundMetric(assignedCoordinate);
        const segmentKey = buildSegmentDisplacementKey(entry.connectorId, entry.routeSegmentIndex);
        segmentCoordinateBySegmentKey.set(segmentKey, coordinate);
        lockedSegmentKeys.add(segmentKey);
        occupied.push({
          entry,
          coordinate
        });
      }
    }
  });

  return {
    segmentCoordinateBySegmentKey,
    lockedSegmentKeys
  };
}

function buildPreparedRoutesWithObstacleCompaction(
  plans: readonly OutcomeOpportunityConnectorTemplatePlan[],
  scene: PositionedScene,
  index: OutcomeOpportunityPositionedIndex,
  globalGutterState: OutcomeOpportunityGlobalGutterState,
  bucketsByNodeId: ReadonlyMap<string, OutcomeOpportunityNodeEdgeBuckets>,
  diagnostics: RendererDiagnostic[]
): {
  endpointOffsetsByNodeId: ReadonlyMap<string, Map<PortSide, Map<string, number>>>;
  preparedRoutes: OutcomeOpportunityPreparedRouteResolution;
} {
  const {
    endpointOffsetsByNodeId,
    gutterLocalPrepared
  } = buildPreparedRoutesWithLateEndpointOrdering(
    plans,
    scene,
    index,
    globalGutterState,
    bucketsByNodeId,
    diagnostics
  );
  const targetEdgeLocalCompaction = resolveTargetEdgeLocalCompaction(
    gutterLocalPrepared.connectorPlansWithOccupancy,
    gutterLocalPrepared.occupancyResult.occupancy,
    gutterLocalPrepared.routeStates,
    index
  );
  const preparedEndpointCoordinateByEndpointKey = new Map(
    gutterLocalPrepared.bundleEndpointCoordinateByEndpointKey
  );
  for (const [endpointKey, coordinate] of targetEdgeLocalCompaction.endpointCoordinateByEndpointKey.entries()) {
    preparedEndpointCoordinateByEndpointKey.set(endpointKey, coordinate);
  }
  const preparedSegmentCoordinateBySegmentKey = new Map(
    gutterLocalPrepared.bundleSegmentCoordinateBySegmentKey
  );
  for (const [segmentKey, coordinate] of targetEdgeLocalCompaction.segmentCoordinateBySegmentKey.entries()) {
    preparedSegmentCoordinateBySegmentKey.set(segmentKey, coordinate);
  }
  const edgeLocalRouteStates = buildRouteStatesForPlans(
    gutterLocalPrepared.connectorPlansWithOccupancy,
    index,
    endpointOffsetsByNodeId,
    new Map<string, number>(),
    preparedEndpointCoordinateByEndpointKey,
    preparedSegmentCoordinateBySegmentKey
  );
  const edgeLocalOccupancyResult = extractGutterOccupancyByConnector(
    gutterLocalPrepared.connectorPlansWithOccupancy,
    new Map([...edgeLocalRouteStates.entries()].map(([connectorId, state]) => [connectorId, state.route] as const)),
    scene,
    index,
    globalGutterState
  );
  const obstacleLocalCompaction = buildObstacleLocalCompaction(
    gutterLocalPrepared.connectorPlansWithOccupancy,
    edgeLocalOccupancyResult.occupancy,
    index
  );
  for (const [segmentKey, coordinate] of obstacleLocalCompaction.segmentCoordinateBySegmentKey.entries()) {
    preparedSegmentCoordinateBySegmentKey.set(segmentKey, coordinate);
  }
  const lockedSegmentKeys = new Set<string>(gutterLocalPrepared.lockedBundleSegmentKeys);
  for (const segmentKey of targetEdgeLocalCompaction.lockedSegmentKeys) {
    lockedSegmentKeys.add(segmentKey);
  }
  for (const segmentKey of obstacleLocalCompaction.lockedSegmentKeys) {
    lockedSegmentKeys.add(segmentKey);
  }

  const routeStates = buildRouteStatesForPlans(
    gutterLocalPrepared.connectorPlansWithOccupancy,
    index,
    endpointOffsetsByNodeId,
    new Map<string, number>(),
    preparedEndpointCoordinateByEndpointKey,
    preparedSegmentCoordinateBySegmentKey
  );
  const occupancyResult = extractGutterOccupancyByConnector(
    gutterLocalPrepared.connectorPlansWithOccupancy,
    new Map([...routeStates.entries()].map(([connectorId, state]) => [connectorId, state.route] as const)),
    scene,
    index,
    globalGutterState
  );

  return {
    endpointOffsetsByNodeId,
    preparedRoutes: {
      bundleEndpointCoordinateByEndpointKey: preparedEndpointCoordinateByEndpointKey,
      preparedSegmentCoordinateBySegmentKey,
      lockedSegmentKeys,
      requiredColumnExpansions: gutterLocalPrepared.requiredColumnExpansions,
      requiredRowExpansions: gutterLocalPrepared.requiredRowExpansions,
      targetLocalBypassSelections: targetEdgeLocalCompaction.targetLocalBypassSelections,
      routeStates,
      occupancyResult,
      connectorPlansWithOccupancy: gutterLocalPrepared.connectorPlansWithOccupancy.map((plan) => ({
        ...plan,
        occupiedGutters: occupancyResult.occupancyByConnectorId.get(plan.id) ?? []
      }))
    }
  };
}

function mergeGlobalGutterStates(
  left: OutcomeOpportunityGlobalGutterState,
  right: OutcomeOpportunityGlobalGutterState
): OutcomeOpportunityGlobalGutterState {
  const columnExpansions: Record<number, number> = { ...left.columnExpansions };
  const rowExpansions: Record<number, number> = { ...left.rowExpansions };
  for (const [order, value] of Object.entries(right.columnExpansions)) {
    columnExpansions[Number(order)] = roundMetric((columnExpansions[Number(order)] ?? 0) + value);
  }
  for (const [order, value] of Object.entries(right.rowExpansions)) {
    rowExpansions[Number(order)] = roundMetric((rowExpansions[Number(order)] ?? 0) + value);
  }
  return buildGlobalGutterState(columnExpansions, rowExpansions);
}

export function buildOutcomeOpportunityMapRoutingStages(
  measuredScene: MeasuredScene,
  preRoutingPositionedScene: PositionedScene,
  middleLayer: OutcomeOpportunityMiddleLayerModel
): OutcomeOpportunityRoutingStages {
  const diagnostics: RendererDiagnostic[] = [];
  const baseIndex = buildIndex(preRoutingPositionedScene, middleLayer);
  const basePlans = buildConnectorPlans(measuredScene, middleLayer, baseIndex, diagnostics);
  const step2Plans = routePlansForScene(basePlans, baseIndex, "step2Route", "step2");
  const step2PositionedScene = withStep2EdgesAndDiagnostics(
    preRoutingPositionedScene,
    buildPositionedEdges(step2Plans, (plan) => plan.step2Route),
    diagnostics
  );
  const step3Diagnostics: RendererDiagnostic[] = [...diagnostics];
  const step3TemplatePlans = routePlansForScene(step2Plans, baseIndex, "step3Route", "guttered");
  const step3Plans = applyLocalSwervesToStep3Plans(
    step3TemplatePlans,
    baseIndex,
    buildNodeEdgeBuckets(step3TemplatePlans, baseIndex),
    step3Diagnostics
  );
  const step3PositionedScene = withStep2EdgesAndDiagnostics(
    preRoutingPositionedScene,
    buildPositionedEdges(step3Plans, (plan) => plan.step3Route),
    step3Diagnostics
  );

  let globalGutterState = buildGlobalGutterState();
  let workingScene = preRoutingPositionedScene;
  let workingIndex = baseIndex;

  for (let attempt = 0; attempt < MAX_GLOBAL_GUTTER_ATTEMPTS; attempt += 1) {
    workingIndex = buildIndex(workingScene, middleLayer);
    const workingBuckets = buildNodeEdgeBuckets(step3Plans, workingIndex);
    const iterationDiagnostics: RendererDiagnostic[] = [];
    const { preparedRoutes } = buildPreparedRoutesWithObstacleCompaction(
      step3Plans,
      workingScene,
      workingIndex,
      globalGutterState,
      workingBuckets,
      iterationDiagnostics
    );
    const displacementBySegmentKey = resolveOccupancyDisplacements(
      preparedRoutes.connectorPlansWithOccupancy,
      preparedRoutes.occupancyResult.occupancy,
      preparedRoutes.lockedSegmentKeys
    );
    const endpointAndLabelRequired = resolveRequiredGlobalGutterState(
      preparedRoutes.connectorPlansWithOccupancy,
      workingIndex,
      workingBuckets
    );
    const required = buildGlobalGutterState(
      mergeExpansionRecords(
        endpointAndLabelRequired.columnExpansions,
        preparedRoutes.requiredColumnExpansions,
        resolveRequiredColumnExpansions(
          preparedRoutes.occupancyResult.occupancy,
          workingIndex,
          displacementBySegmentKey
        )
      ),
      mergeExpansionRecords(
        endpointAndLabelRequired.rowExpansions,
        preparedRoutes.requiredRowExpansions,
        resolveRequiredRowExpansions(
          preparedRoutes.occupancyResult.occupancy,
          workingIndex,
          displacementBySegmentKey
        )
      )
    );
    if (!hasNonZeroExpansion(required)) {
      break;
    }
    globalGutterState = mergeGlobalGutterStates(globalGutterState, required);
    workingScene = applyGlobalGutterExpansions(preRoutingPositionedScene, globalGutterState);
  }

  workingIndex = buildIndex(workingScene, middleLayer);
  const finalBucketsByNodeId = buildNodeEdgeBuckets(step3Plans, workingIndex);
  const finalDiagnostics: RendererDiagnostic[] = [...diagnostics];
  const {
    endpointOffsetsByNodeId: finalEndpointOffsetsByNodeId,
    preparedRoutes: preparedRoutesFinal
  } = buildPreparedRoutesWithObstacleCompaction(
    step3Plans,
    workingScene,
    workingIndex,
    globalGutterState,
    finalBucketsByNodeId,
    finalDiagnostics
  );
  const finalDisplacementBySegmentKey = resolveOccupancyDisplacements(
    preparedRoutesFinal.connectorPlansWithOccupancy,
    preparedRoutesFinal.occupancyResult.occupancy,
    preparedRoutesFinal.lockedSegmentKeys
  );
  const finalRouteStatesBeforeBypass = buildRouteStatesForPlans(
    preparedRoutesFinal.connectorPlansWithOccupancy,
    workingIndex,
    finalEndpointOffsetsByNodeId,
    finalDisplacementBySegmentKey,
    preparedRoutesFinal.bundleEndpointCoordinateByEndpointKey,
    preparedRoutesFinal.preparedSegmentCoordinateBySegmentKey
  );
  const finalRouteStates = applyTargetLocalBypassesToRouteStates(
    preparedRoutesFinal.connectorPlansWithOccupancy,
    finalRouteStatesBeforeBypass,
    preparedRoutesFinal.targetLocalBypassSelections,
    workingIndex,
    finalDiagnostics
  );
  const finalOccupancyResult = extractGutterOccupancyByConnector(
    preparedRoutesFinal.connectorPlansWithOccupancy,
    new Map([...finalRouteStates.entries()].map(([connectorId, state]) => [connectorId, state.route] as const)),
    workingScene,
    workingIndex,
    globalGutterState
  );
  const finalPlans = preparedRoutesFinal.connectorPlansWithOccupancy.map((plan) => {
    const routeState = finalRouteStates.get(plan.id);
    return {
      ...plan,
      finalRoute: routeState?.route ?? plan.step3Route
    };
  });
  emitFinalIntersectionDiagnostics(finalPlans, workingIndex.nodeBoxes, finalDiagnostics);
  const labelsByPlanId = placeLabels(finalPlans, workingScene, workingIndex, finalDiagnostics);
  const finalPositionedScene = withStep2EdgesAndDiagnostics(
    workingScene,
    buildPositionedEdges(finalPlans, (plan) => plan.finalRoute, labelsByPlanId),
    finalDiagnostics
  );

  return {
    connectorPlans: finalPlans,
    nodeEdgeBuckets: [...finalBucketsByNodeId.values()].sort((left, right) => left.nodeId.localeCompare(right.nodeId)),
    nodeGutters: buildNodeGutters(workingIndex),
    globalGutterState,
    gutterOccupancy: finalOccupancyResult.occupancy,
    step2PositionedScene,
    step3PositionedScene,
    finalPositionedScene,
    diagnostics: sortRendererDiagnostics(finalDiagnostics)
  };
}
