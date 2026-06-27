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
const LABEL_GAP = 24;
const MAX_GLOBAL_GUTTER_ATTEMPTS = 4;

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

function buildEndpointOffsets(
  index: OutcomeOpportunityPositionedIndex,
  bucketsByNodeId: ReadonlyMap<string, OutcomeOpportunityNodeEdgeBuckets>
): ReadonlyMap<string, Map<PortSide, Map<string, number>>> {
  const offsetsByNodeId = new Map<string, Map<PortSide, Map<string, number>>>();

  for (const [nodeId, context] of index.nodeById.entries()) {
    const nodeOffsets = new Map<PortSide, Map<string, number>>();
    const buckets = bucketsByNodeId.get(nodeId) ?? buildEmptyNodeEdgeBuckets(nodeId);
    const sideLengths: Record<PortSide, number> = {
      north: context.node.width,
      south: context.node.width,
      east: context.node.height,
      west: context.node.height
    };

    (["north", "south", "east", "west"] as const).forEach((side) => {
      const ids = [
        ...getSideBuckets(buckets, side).endingConnectorIds,
        ...getSideBuckets(buckets, side).startingConnectorIds
      ];
      const maxOffset = Math.max(0, sideLengths[side] / 2 - ENDPOINT_MARGIN);
      const sideOffsets = new Map<string, number>();
      ids.forEach((connectorId, indexInSide) => {
        const centered = (indexInSide - (ids.length - 1) / 2) * ENDPOINT_SPACING;
        const clamped = Math.min(maxOffset, Math.max(-maxOffset, centered));
        sideOffsets.set(connectorId, roundMetric(clamped));
      });
      nodeOffsets.set(side, sideOffsets);
    });
    offsetsByNodeId.set(nodeId, nodeOffsets);
  }

  return offsetsByNodeId;
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
  const span = sideCoordinateSpan(node, side);

  switch (side) {
    case "north":
      return {
        x: roundMetric(clampMetric(centerX + offset, span.min, span.max)),
        y: roundMetric(node.y)
      };
    case "south":
      return {
        x: roundMetric(clampMetric(centerX + offset, span.min, span.max)),
        y: roundMetric(node.y + node.height)
      };
    case "east":
      return {
        x: roundMetric(node.x + node.width),
        y: roundMetric(clampMetric(centerY + offset, span.min, span.max))
      };
    case "west":
      return {
        x: roundMetric(node.x),
        y: roundMetric(clampMetric(centerY + offset, span.min, span.max))
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

function tryAlignHorizontalEndpoints(
  source: PositionedNode,
  target: PositionedNode,
  sourcePoint: Point,
  targetPoint: Point
): { sourcePoint: Point; targetPoint: Point } {
  const overlapTop = Math.max(source.y + ENDPOINT_MARGIN, target.y + ENDPOINT_MARGIN);
  const overlapBottom = Math.min(
    source.y + Math.max(ENDPOINT_MARGIN, source.height - ENDPOINT_MARGIN),
    target.y + Math.max(ENDPOINT_MARGIN, target.height - ENDPOINT_MARGIN)
  );

  if (overlapTop > overlapBottom) {
    return {
      sourcePoint,
      targetPoint
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
    targetPoint: { x: targetPoint.x, y: sharedY }
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
    return buildRoute([aligned.sourcePoint, aligned.targetPoint]);
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

function countSideBucketConnectors(buckets: OutcomeOpportunityNodeEdgeBuckets, side: PortSide): number {
  const sideBuckets = getSideBuckets(buckets, side);
  return sideBuckets.startingConnectorIds.length + sideBuckets.endingConnectorIds.length;
}

function resolveRequiredGlobalGutterState(
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
      const labelNeed = plan.label ? plan.label.width + LABEL_GAP : 0;
      const routeNeed = EXTERIOR_STUB * 2 + (plan.outgoingOrder * ENDPOINT_SPACING);
      accumulateExpansion(
        columnExpansions,
        source.placement.columnOrder,
        Math.max(labelNeed, routeNeed) - availableGap
      );
    }
    if (plan.sourceSide === "south" && plan.targetSide === "north" && source.placement.rowOrder <= target.placement.rowOrder) {
      const availableGap = roundMetric(target.node.y - (source.node.y + source.node.height));
      const labelNeed = plan.label ? plan.label.height + LABEL_GAP : 0;
      accumulateExpansion(rowExpansions, source.placement.rowOrder, labelNeed - availableGap);
    }
  }

  return buildGlobalGutterState(columnExpansions, rowExpansions);
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

function buildSegmentOccupancy(
  connectorId: string,
  route: PositionedRoute,
  index: OutcomeOpportunityPositionedIndex
): OutcomeOpportunityGutterOccupancy[] {
  const occupancy: OutcomeOpportunityGutterOccupancy[] = [];
  for (let segmentIndex = 1; segmentIndex < route.points.length; segmentIndex += 1) {
    const start = route.points[segmentIndex - 1]!;
    const end = route.points[segmentIndex]!;
    if (start.x === end.x) {
      const columnOrder = [...index.columnRightByOrder.entries()]
        .filter(([, right]) => right <= start.x)
        .sort(([leftOrder], [rightOrder]) => rightOrder - leftOrder)[0]?.[0];
      occupancy.push({
        connectorId,
        key: columnOrder === undefined ? `edge:${connectorId}:segment:${segmentIndex - 1}` : `column:${columnOrder}:right`,
        axis: "vertical",
        kind: columnOrder === undefined ? "edge_local" : "column",
        nominalCoordinate: roundMetric(start.x),
        spanStart: roundMetric(Math.min(start.y, end.y)),
        spanEnd: roundMetric(Math.max(start.y, end.y)),
        routeSegmentIndex: segmentIndex - 1,
        columnOrder,
        ownershipRank: segmentIndex
      });
      continue;
    }
    if (start.y === end.y) {
      const rowOrder = [...index.rowBottomByOrder.entries()]
        .filter(([, bottom]) => bottom <= start.y)
        .sort(([leftOrder], [rightOrder]) => rightOrder - leftOrder)[0]?.[0];
      occupancy.push({
        connectorId,
        key: rowOrder === undefined ? `edge:${connectorId}:segment:${segmentIndex - 1}` : `row:${rowOrder}:below`,
        axis: "horizontal",
        kind: rowOrder === undefined ? "edge_local" : "band",
        nominalCoordinate: roundMetric(start.y),
        spanStart: roundMetric(Math.min(start.x, end.x)),
        spanEnd: roundMetric(Math.max(start.x, end.x)),
        routeSegmentIndex: segmentIndex - 1,
        rowOrder,
        ownershipRank: segmentIndex
      });
    }
  }
  return occupancy;
}

function buildEndpointOccupancy(plan: OutcomeOpportunityConnectorTemplatePlan): OutcomeOpportunityGutterOccupancy[] {
  const sourcePoint = plan.finalRoute.points[0] ?? plan.step3Route.points[0];
  const targetPoint = plan.finalRoute.points.at(-1) ?? plan.step3Route.points.at(-1);
  const occupancy: OutcomeOpportunityGutterOccupancy[] = [];
  if (sourcePoint) {
    occupancy.push({
      connectorId: plan.id,
      key: plan.sourceSide === "east" ? `node:${plan.from}:right` : `node:${plan.from}:${plan.sourceSide}`,
      axis: plan.sourceSide === "east" || plan.sourceSide === "west" ? "horizontal" : "vertical",
      kind: plan.sourceSide === "east" ? "node_right" : plan.sourceSide === "south" ? "node_bottom" : "edge_local",
      nominalCoordinate: plan.sourceSide === "east" || plan.sourceSide === "west" ? sourcePoint.y : sourcePoint.x,
      spanStart: 0,
      spanEnd: EXTERIOR_STUB,
      routeSegmentIndex: 0,
      nodeId: plan.from,
      side: plan.sourceSide,
      endpointRole: "source",
      locked: true
    });
  }
  if (targetPoint) {
    occupancy.push({
      connectorId: plan.id,
      key: plan.targetSide === "east" ? `node:${plan.to}:right` : `node:${plan.to}:${plan.targetSide}`,
      axis: plan.targetSide === "east" || plan.targetSide === "west" ? "horizontal" : "vertical",
      kind: plan.targetSide === "east" ? "node_right" : plan.targetSide === "south" ? "node_bottom" : "edge_local",
      nominalCoordinate: plan.targetSide === "east" || plan.targetSide === "west" ? targetPoint.y : targetPoint.x,
      spanStart: 0,
      spanEnd: EXTERIOR_STUB,
      routeSegmentIndex: Math.max(0, plan.finalRoute.points.length - 2),
      nodeId: plan.to,
      side: plan.targetSide,
      endpointRole: "target",
      locked: true
    });
  }
  return occupancy;
}

function buildGutterOccupancy(
  plans: readonly OutcomeOpportunityConnectorTemplatePlan[],
  index: OutcomeOpportunityPositionedIndex
): OutcomeOpportunityGutterOccupancy[] {
  return plans.flatMap((plan) => [
    ...buildEndpointOccupancy(plan),
    ...buildSegmentOccupancy(plan.id, plan.finalRoute, index)
  ]).sort((left, right) =>
    left.key.localeCompare(right.key)
    || left.connectorId.localeCompare(right.connectorId)
    || left.routeSegmentIndex - right.routeSegmentIndex
  );
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
            "warn"
          ));
        }
      }
    }
  }
}

function collectBlockingBoxes(index: OutcomeOpportunityPositionedIndex): BlockingBox[] {
  return index.nodeBoxes.map((box) => ({ ...box }));
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
  const nodeBoxes = collectBlockingBoxes(index);

  for (const plan of plans) {
    if (!plan.label) {
      continue;
    }
    const label = positionConnectorLabel({
      connectorId: plan.id,
      measuredLabel: plan.label,
      route: plan.finalRoute,
      connectorSegmentsById,
      blockedBoxes: [...nodeBoxes, ...placedLabelBoxes],
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
  const step3Plans = routePlansForScene(step2Plans, baseIndex, "step3Route", "guttered");
  const step3PositionedScene = withStep2EdgesAndDiagnostics(
    preRoutingPositionedScene,
    buildPositionedEdges(step3Plans, (plan) => plan.step3Route),
    diagnostics
  );

  let globalGutterState = buildGlobalGutterState();
  let workingScene = preRoutingPositionedScene;
  let workingIndex = baseIndex;
  let finalPlans = step3Plans;

  for (let attempt = 0; attempt < MAX_GLOBAL_GUTTER_ATTEMPTS; attempt += 1) {
    workingIndex = buildIndex(workingScene, middleLayer);
    finalPlans = routePlansForScene(finalPlans, workingIndex, "finalRoute", "guttered");
    const workingBuckets = buildNodeEdgeBuckets(finalPlans, workingIndex);
    const required = resolveRequiredGlobalGutterState(finalPlans, workingIndex, workingBuckets);
    if (!hasNonZeroExpansion(required)) {
      break;
    }
    globalGutterState = mergeGlobalGutterStates(globalGutterState, required);
    workingScene = applyGlobalGutterExpansions(preRoutingPositionedScene, globalGutterState);
  }

  workingIndex = buildIndex(workingScene, middleLayer);
  finalPlans = routePlansForScene(finalPlans, workingIndex, "finalRoute", "guttered");
  const finalBucketsByNodeId = buildNodeEdgeBuckets(finalPlans, workingIndex);
  const finalDiagnostics: RendererDiagnostic[] = [...diagnostics];
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
    gutterOccupancy: buildGutterOccupancy(finalPlans, workingIndex),
    step2PositionedScene,
    step3PositionedScene,
    finalPositionedScene,
    diagnostics: sortRendererDiagnostics(finalDiagnostics)
  };
}
