import type {
  MeasuredEdge,
  MeasuredPort,
  MeasuredScene,
  PaintGroup,
  Point,
  PortSide,
  PositionedContainer,
  PositionedEdge,
  PositionedEdgeLabel,
  PositionedItem,
  PositionedNode,
  PositionedRoute,
  PositionedScene,
  RoutingStyle,
  ScenarioFlowItemMetadata
} from "./contracts.js";
import { createRoutingDiagnostic, sortRendererDiagnostics, type RendererDiagnostic } from "./diagnostics.js";
import { collapseRoutePoints } from "./routing.js";
import { decorateScenarioFlowPositionedScene } from "./scenarioFlowDecorations.js";
import type {
  ScenarioFlowEdgeChannel,
  ScenarioFlowMiddleEdge,
  ScenarioFlowMiddleLayerModel,
  ScenarioFlowNodePlacement
} from "./scenarioFlowMiddleLayer.js";

type ScenarioFlowRoutePattern =
  | "same_track_forward"
  | "cross_track_branch_bridge"
  | "realization_vertical"
  | "realization_corridor"
  | "parking_fallback";
type ScenarioFlowGutterAxis = "horizontal" | "vertical";
type ScenarioFlowGutterKind =
  | "node_right"
  | "node_bottom"
  | "column"
  | "lane"
  | "edge_local"
  | "obstacle_north"
  | "obstacle_south"
  | "obstacle_east"
  | "obstacle_west";
type EndpointRole = "source" | "target";
type ScenarioFlowCellMetadata = Extract<ScenarioFlowItemMetadata, { kind: "cell" }>;
type PositionedScenarioFlowCell = PositionedContainer & {
  viewMetadata: {
    scenarioFlow: ScenarioFlowCellMetadata;
  };
};

interface IndexedScenarioFlowNode {
  node: PositionedNode;
  placement: ScenarioFlowNodePlacement;
  portsByRole: ReadonlyMap<string, MeasuredPort>;
}

interface IndexedScenarioFlowCell {
  cell: PositionedContainer;
  columnOrder: number;
  rowOrder: number;
  trackOrder: number;
}

interface ScenarioFlowPositionedIndex {
  nodeById: ReadonlyMap<string, IndexedScenarioFlowNode>;
  cellById: ReadonlyMap<string, IndexedScenarioFlowCell>;
  columnLeftByOrder: ReadonlyMap<number, number>;
  columnRightByOrder: ReadonlyMap<number, number>;
  rowTopByOrder: ReadonlyMap<number, number>;
  rowBottomByOrder: ReadonlyMap<number, number>;
  nodeBoxes: ScenarioFlowBox[];
}

interface ScenarioFlowBox {
  itemId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ScenarioFlowResolvedEndpoint {
  itemId: string;
  portId: string;
  side: PortSide;
}

interface ScenarioFlowNodeEdgeBucketLists {
  startingConnectorIds: string[];
  endingConnectorIds: string[];
}

export interface ScenarioFlowNodeEdgeBuckets {
  nodeId: string;
  north: ScenarioFlowNodeEdgeBucketLists;
  south: ScenarioFlowNodeEdgeBucketLists;
  east: ScenarioFlowNodeEdgeBucketLists;
  west: ScenarioFlowNodeEdgeBucketLists;
}

export interface ScenarioFlowNodeGutter {
  nodeId: string;
  cellId: string;
  columnOrder: number;
  laneOrder: number;
  rightAvailable: number;
  bottomAvailable: number;
}

export interface ScenarioFlowGlobalGutterState {
  columnExpansions: Record<number, number>;
  laneExpansions: Record<number, number>;
}

export interface ScenarioFlowGutterOccupancy {
  connectorId: string;
  key: string;
  axis: ScenarioFlowGutterAxis;
  kind: ScenarioFlowGutterKind;
  nominalCoordinate: number;
  spanStart: number;
  spanEnd: number;
  routeSegmentIndex: number;
  nodeId?: string;
  side?: PortSide;
  endpointRole?: EndpointRole;
  columnOrder?: number;
  laneOrder?: number;
  ownershipRank?: number;
}

export interface ScenarioFlowConnectorPlan {
  id: string;
  semanticEdgeIds: string[];
  type: string;
  channel: ScenarioFlowEdgeChannel;
  from: string;
  to: string;
  sourceSide: PortSide;
  targetSide: PortSide;
  sourcePortId: string;
  targetPortId: string;
  sourceLaneOrder: number;
  sourceBandOrder: number;
  sourceTrackOrder: number;
  sourceAuthorOrder: number;
  outgoingOrder: number;
  targetStableId: string;
  pattern: ScenarioFlowRoutePattern;
  classes: string[];
  role: string;
  markers: MeasuredEdge["markers"];
  label?: MeasuredEdge["label"];
  step2Route: PositionedRoute;
  step3Route: PositionedRoute;
  finalRoute: PositionedRoute;
  occupiedGutters: ScenarioFlowGutterOccupancy[];
}

export interface ScenarioFlowRoutingStages {
  connectorPlans: ScenarioFlowConnectorPlan[];
  nodeEdgeBuckets: ScenarioFlowNodeEdgeBuckets[];
  nodeGutters: ScenarioFlowNodeGutter[];
  globalGutterState: ScenarioFlowGlobalGutterState;
  gutterOccupancy: ScenarioFlowGutterOccupancy[];
  step2PositionedScene: PositionedScene;
  step3PositionedScene: PositionedScene;
  finalPositionedScene: PositionedScene;
  diagnostics: RendererDiagnostic[];
}

interface PreparedScenarioFlowRoutes {
  connectorPlans: ScenarioFlowConnectorPlan[];
  occupancy: ScenarioFlowGutterOccupancy[];
  occupancyByConnectorId: Map<string, ScenarioFlowGutterOccupancy[]>;
}

const CHANNEL_PRIORITY: Record<ScenarioFlowEdgeChannel, number> = {
  step_flow: 0,
  place_navigation: 1,
  view_transition: 2,
  realization: 3
};
const PORT_ROLE_BY_CHANNEL: Record<ScenarioFlowEdgeChannel, { source: string; target: string }> = {
  step_flow: { source: "flow_out", target: "flow_in" },
  place_navigation: { source: "mirror_out", target: "mirror_in" },
  view_transition: { source: "mirror_out", target: "mirror_in" },
  realization: { source: "realization_out", target: "realization_in" }
};
const FIXED_SEPARATION_DISTANCE = 16;
const OBSTACLE_SWERVE_CLEARANCE = 18;
const GUTTER_OVERFLOW_TOLERANCE = 8;
const MAX_FINAL_ROUTING_ATTEMPTS = 8;
const LABEL_OFFSET = 10;
const LABEL_CANDIDATE_STEP = 14;
const ROOT_PADDING_FALLBACK = 28;
const EPSILON = 0.5;

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function clonePositionedScene(scene: PositionedScene): PositionedScene {
  return structuredClone(scene) as PositionedScene;
}

function buildEmptyRoute(): PositionedRoute {
  return {
    style: "orthogonal",
    points: []
  };
}

function isPositionedNode(item: PositionedItem): item is PositionedNode {
  return item.kind === "node" && item.viewMetadata?.scenarioFlow?.kind === "semantic_node";
}

function isScenarioFlowCell(item: PositionedItem): item is PositionedScenarioFlowCell {
  return item.kind === "container" && item.viewMetadata?.scenarioFlow?.kind === "cell";
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

function translatePositionedItem(item: PositionedItem, dx: number, dy: number): void {
  item.x = roundMetric(item.x + dx);
  item.y = roundMetric(item.y + dy);
  if (item.kind === "container") {
    for (const child of item.children) {
      translatePositionedItem(child, dx, dy);
    }
  }
}

function updateRootSize(root: PositionedContainer): void {
  const maxRight = Math.max(0, ...root.children.map((child) => child.x + child.width));
  const maxBottom = Math.max(0, ...root.children.map((child) => child.y + child.height));
  root.width = roundMetric(maxRight + Math.max(root.chrome.padding.right, ROOT_PADDING_FALLBACK));
  root.height = roundMetric(maxBottom + Math.max(root.chrome.padding.bottom, ROOT_PADDING_FALLBACK));
}

function compareConnectorPlans(left: ScenarioFlowConnectorPlan, right: ScenarioFlowConnectorPlan): number {
  return CHANNEL_PRIORITY[left.channel] - CHANNEL_PRIORITY[right.channel]
    || left.sourceLaneOrder - right.sourceLaneOrder
    || left.sourceBandOrder - right.sourceBandOrder
    || left.sourceTrackOrder - right.sourceTrackOrder
    || left.sourceAuthorOrder - right.sourceAuthorOrder
    || left.outgoingOrder - right.outgoingOrder
    || left.targetStableId.localeCompare(right.targetStableId)
    || left.id.localeCompare(right.id);
}

function buildIndex(
  scene: PositionedScene,
  middleLayer: ScenarioFlowMiddleLayerModel
): ScenarioFlowPositionedIndex {
  const items = flattenItems(scene.root);
  const placementByNodeId = new Map(middleLayer.placements.map((placement) => [placement.nodeId, placement] as const));
  const cellById = new Map<string, IndexedScenarioFlowCell>();
  const nodeById = new Map<string, IndexedScenarioFlowNode>();
  const columnLeftByOrder = new Map<number, number>();
  const columnRightByOrder = new Map<number, number>();
  const rowTopByOrder = new Map<number, number>();
  const rowBottomByOrder = new Map<number, number>();

  for (const item of items) {
    if (isScenarioFlowCell(item)) {
      const meta = item.viewMetadata.scenarioFlow;
      cellById.set(item.id, {
        cell: item,
        columnOrder: meta.columnOrder,
        rowOrder: meta.rowOrder,
        trackOrder: meta.trackOrder
      });
      columnLeftByOrder.set(meta.columnOrder, Math.min(columnLeftByOrder.get(meta.columnOrder) ?? item.x, item.x));
      columnRightByOrder.set(meta.columnOrder, Math.max(columnRightByOrder.get(meta.columnOrder) ?? item.x + item.width, item.x + item.width));
      rowTopByOrder.set(meta.rowOrder, Math.min(rowTopByOrder.get(meta.rowOrder) ?? item.y, item.y));
      rowBottomByOrder.set(meta.rowOrder, Math.max(rowBottomByOrder.get(meta.rowOrder) ?? item.y + item.height, item.y + item.height));
    }
  }

  for (const item of items) {
    if (!isPositionedNode(item)) {
      continue;
    }
    const placement = placementByNodeId.get(item.id);
    if (!placement) {
      continue;
    }
    nodeById.set(item.id, {
      node: item,
      placement,
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

function getNextValue(values: ReadonlyMap<number, number>, order: number): number | undefined {
  return [...values.entries()]
    .filter(([candidateOrder]) => candidateOrder > order)
    .sort(([leftOrder], [rightOrder]) => leftOrder - rightOrder)[0]?.[1];
}

function resolveEndpoint(
  edgeId: string,
  node: IndexedScenarioFlowNode,
  role: string,
  diagnostics: RendererDiagnostic[]
): ScenarioFlowResolvedEndpoint | undefined {
  const port = node.portsByRole.get(role);
  if (!port) {
    diagnostics.push(createRoutingDiagnostic(
      "renderer.routing.scenario_flow_unresolved_port",
      `Could not resolve scenario-flow port role "${role}" on node "${node.node.id}".`,
      edgeId,
      "warn"
    ));
    return undefined;
  }

  return {
    itemId: node.node.id,
    portId: port.id,
    side: port.side
  };
}

function buildRoute(points: Point[], style: RoutingStyle = "orthogonal"): PositionedRoute {
  return {
    style,
    points: collapseRoutePoints(points)
  };
}

function resolveForwardBridgeX(
  source: IndexedScenarioFlowNode,
  target: IndexedScenarioFlowNode,
  sourceStub: Point,
  targetStub: Point,
  index: ScenarioFlowPositionedIndex
): number {
  const sourceCell = index.cellById.get(source.placement.cellId);
  const targetCell = index.cellById.get(target.placement.cellId);
  const minBridgeX = roundMetric(sourceStub.x + FIXED_SEPARATION_DISTANCE);
  const maxBridgeX = roundMetric(targetStub.x - FIXED_SEPARATION_DISTANCE);

  if (sourceCell && targetCell && targetCell.columnOrder > sourceCell.columnOrder) {
    const sourceRight = index.columnRightByOrder.get(sourceCell.columnOrder) ?? (sourceCell.cell.x + sourceCell.cell.width);
    const targetLeft = index.columnLeftByOrder.get(targetCell.columnOrder) ?? targetCell.cell.x;
    const gutterMidpoint = roundMetric((sourceRight + targetLeft) / 2);
    if (maxBridgeX >= minBridgeX) {
      return Math.min(maxBridgeX, Math.max(minBridgeX, gutterMidpoint));
    }
  }

  return maxBridgeX >= minBridgeX ? roundMetric((minBridgeX + maxBridgeX) / 2) : targetStub.x;
}

function resolveRealizationCorridorX(
  source: IndexedScenarioFlowNode,
  target: IndexedScenarioFlowNode,
  connectorIndex: number
): number {
  const right = Math.max(source.node.x + source.node.width, target.node.x + target.node.width);
  return roundMetric(right + FIXED_SEPARATION_DISTANCE + connectorIndex * 4);
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

function getSidePointWithOffset(node: PositionedNode, side: PortSide, offset: number): Point {
  const center = {
    x: roundMetric(node.x + node.width / 2),
    y: roundMetric(node.y + node.height / 2)
  };
  switch (side) {
    case "north":
      return { x: roundMetric(center.x + offset), y: node.y };
    case "south":
      return { x: roundMetric(center.x + offset), y: roundMetric(node.y + node.height) };
    case "east":
      return { x: roundMetric(node.x + node.width), y: roundMetric(center.y + offset) };
    case "west":
      return { x: node.x, y: roundMetric(center.y + offset) };
  }
}

function determinePattern(
  edge: ScenarioFlowMiddleEdge,
  source: IndexedScenarioFlowNode,
  target: IndexedScenarioFlowNode
): ScenarioFlowRoutePattern {
  if (source.placement.placementRole === "parking" || target.placement.placementRole === "parking") {
    return "parking_fallback";
  }

  if (edge.channel === "realization") {
    return Math.abs(source.node.x + source.node.width / 2 - (target.node.x + target.node.width / 2)) <= EPSILON
      ? "realization_vertical"
      : "realization_corridor";
  }

  return source.placement.trackId === target.placement.trackId
    ? "same_track_forward"
    : "cross_track_branch_bridge";
}

function buildConnectorPlans(
  measuredScene: MeasuredScene,
  middleLayer: ScenarioFlowMiddleLayerModel,
  index: ScenarioFlowPositionedIndex,
  diagnostics: RendererDiagnostic[]
): ScenarioFlowConnectorPlan[] {
  const measuredEdgeById = new Map(measuredScene.edges.map((edge) => [edge.id, edge] as const));
  const laneOrderById = new Map(middleLayer.laneGuides.map((lane) => [lane.laneId, lane.order] as const));
  const bandOrderById = new Map(middleLayer.bands.map((band) => [band.id, band.bandOrder] as const));
  const trackOrderById = new Map(middleLayer.tracks.map((track) => [track.id, track.trackOrder] as const));
  const outgoingBySource = new Map<string, number>();
  const plans: ScenarioFlowConnectorPlan[] = [];

  for (const edge of middleLayer.edges) {
    const measuredEdge = measuredEdgeById.get(edge.id);
    const source = index.nodeById.get(edge.from);
    const target = index.nodeById.get(edge.to);
    if (!measuredEdge || !source || !target) {
      diagnostics.push(createRoutingDiagnostic(
        "renderer.routing.scenario_flow_parking_fallback",
        `Could not resolve both endpoints for scenario-flow edge "${edge.id}".`,
        edge.id,
        "warn"
      ));
      continue;
    }

    const portRoles = PORT_ROLE_BY_CHANNEL[edge.channel];
    const from = resolveEndpoint(edge.id, source, portRoles.source, diagnostics);
    const to = resolveEndpoint(edge.id, target, portRoles.target, diagnostics);
    if (!from || !to) {
      continue;
    }

    const outgoingOrder = outgoingBySource.get(edge.from) ?? 0;
    outgoingBySource.set(edge.from, outgoingOrder + 1);
    plans.push({
      id: edge.id,
      semanticEdgeIds: [...edge.semanticEdgeIds],
      type: edge.type,
      channel: edge.channel,
      from: edge.from,
      to: edge.to,
      sourceSide: from.side,
      targetSide: to.side,
      sourcePortId: from.portId,
      targetPortId: to.portId,
      sourceLaneOrder: laneOrderById.get(source.placement.laneId) ?? 999,
      sourceBandOrder: bandOrderById.get(source.placement.bandId) ?? 999,
      sourceTrackOrder: trackOrderById.get(source.placement.trackId) ?? 999,
      sourceAuthorOrder: source.placement.sourceAuthorOrder,
      outgoingOrder,
      targetStableId: edge.to,
      pattern: determinePattern(edge, source, target),
      classes: [...measuredEdge.classes],
      role: measuredEdge.role,
      markers: measuredEdge.markers,
      label: measuredEdge.label,
      step2Route: buildEmptyRoute(),
      step3Route: buildEmptyRoute(),
      finalRoute: buildEmptyRoute(),
      occupiedGutters: []
    });
  }

  return plans.sort(compareConnectorPlans);
}

function buildEmptyNodeEdgeBuckets(nodeId: string): ScenarioFlowNodeEdgeBuckets {
  return {
    nodeId,
    north: { startingConnectorIds: [], endingConnectorIds: [] },
    south: { startingConnectorIds: [], endingConnectorIds: [] },
    east: { startingConnectorIds: [], endingConnectorIds: [] },
    west: { startingConnectorIds: [], endingConnectorIds: [] }
  };
}

function getSideBuckets(
  buckets: ScenarioFlowNodeEdgeBuckets,
  side: PortSide
): ScenarioFlowNodeEdgeBucketLists {
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
  plans: readonly ScenarioFlowConnectorPlan[],
  index: ScenarioFlowPositionedIndex
): Map<string, ScenarioFlowNodeEdgeBuckets> {
  const bucketsByNodeId = new Map<string, ScenarioFlowNodeEdgeBuckets>();
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

function buildNodeGutters(index: ScenarioFlowPositionedIndex): ScenarioFlowNodeGutter[] {
  return [...index.nodeById.values()].map((context) => {
    const cell = index.cellById.get(context.placement.cellId);
    const columnOrder = cell?.columnOrder ?? 0;
    const laneOrder = cell?.rowOrder ?? 0;
    const nextColumnLeft = getNextValue(index.columnLeftByOrder, columnOrder);
    const nextRowTop = getNextValue(index.rowTopByOrder, laneOrder);
    return {
      nodeId: context.node.id,
      cellId: context.placement.cellId,
      columnOrder,
      laneOrder,
      rightAvailable: roundMetric(Math.max(0, (nextColumnLeft ?? (context.node.x + context.node.width)) - (context.node.x + context.node.width))),
      bottomAvailable: roundMetric(Math.max(0, (nextRowTop ?? (context.node.y + context.node.height)) - (context.node.y + context.node.height)))
    };
  }).sort((left, right) =>
    left.laneOrder - right.laneOrder
    || left.columnOrder - right.columnOrder
    || left.nodeId.localeCompare(right.nodeId)
  );
}

function buildGlobalGutterState(
  columnExpansions: Record<number, number> = {},
  laneExpansions: Record<number, number> = {}
): ScenarioFlowGlobalGutterState {
  return {
    columnExpansions,
    laneExpansions
  };
}

function buildEndpointOffsets(
  index: ScenarioFlowPositionedIndex,
  bucketsByNodeId: ReadonlyMap<string, ScenarioFlowNodeEdgeBuckets>
): ReadonlyMap<string, Map<PortSide, Map<string, number>>> {
  const offsetsByNodeId = new Map<string, Map<PortSide, Map<string, number>>>();

  for (const [nodeId, context] of index.nodeById.entries()) {
    const buckets = bucketsByNodeId.get(nodeId) ?? buildEmptyNodeEdgeBuckets(nodeId);
    const nodeOffsets = new Map<PortSide, Map<string, number>>();
    const sideLengths: Record<PortSide, number> = {
      north: context.node.width,
      south: context.node.width,
      east: context.node.height,
      west: context.node.height
    };

    (["north", "south", "east", "west"] as const).forEach((side) => {
      const sideBuckets = getSideBuckets(buckets, side);
      const incoming = [...sideBuckets.endingConnectorIds];
      const outgoing = [...sideBuckets.startingConnectorIds];
      const ids = incoming.length > 0 && outgoing.length > 0
        ? [...incoming.map((id) => ["incoming", id] as const), ...outgoing.map((id) => ["outgoing", id] as const)]
        : [...(incoming.length > 0 ? incoming : outgoing).map((id) => ["single", id] as const)];
      const longEnough = sideLengths[side] > 2 * Math.max(0, ids.length - 1) * FIXED_SEPARATION_DISTANCE;
      const offsets = new Map<string, number>();

      if (incoming.length > 0 && outgoing.length > 0) {
        incoming.forEach((connectorId, indexInGroup) => {
          offsets.set(connectorId, roundMetric(-(incoming.length - indexInGroup) * FIXED_SEPARATION_DISTANCE));
        });
        outgoing.forEach((connectorId, indexInGroup) => {
          offsets.set(connectorId, roundMetric(indexInGroup * FIXED_SEPARATION_DISTANCE));
        });
      } else {
        ids.forEach(([, connectorId], indexInGroup) => {
          const offset = longEnough
            ? roundMetric(indexInGroup * FIXED_SEPARATION_DISTANCE)
            : roundMetric((indexInGroup - (ids.length - 1) / 2) * FIXED_SEPARATION_DISTANCE);
          offsets.set(connectorId, offset);
        });
      }

      nodeOffsets.set(side, offsets);
    });
    offsetsByNodeId.set(nodeId, nodeOffsets);
  }

  return offsetsByNodeId;
}

function getEndpointOffset(
  endpointOffsetsByNodeId: ReadonlyMap<string, Map<PortSide, Map<string, number>>>,
  nodeId: string,
  side: PortSide,
  connectorId: string
): number {
  return endpointOffsetsByNodeId.get(nodeId)?.get(side)?.get(connectorId) ?? 0;
}

function buildSegmentCoordinateKey(connectorId: string, routeSegmentIndex: number): string {
  return `${connectorId}::segment:${routeSegmentIndex}`;
}

function buildTemplateRoute(
  plan: ScenarioFlowConnectorPlan,
  index: ScenarioFlowPositionedIndex,
  endpointOffsetsByNodeId: ReadonlyMap<string, Map<PortSide, Map<string, number>>>,
  segmentCoordinateByKey: ReadonlyMap<string, number> = new Map<string, number>()
): PositionedRoute {
  const source = index.nodeById.get(plan.from);
  const target = index.nodeById.get(plan.to);
  if (!source || !target) {
    return buildEmptyRoute();
  }

  const sourcePoint = getSidePointWithOffset(
    source.node,
    plan.sourceSide,
    getEndpointOffset(endpointOffsetsByNodeId, plan.from, plan.sourceSide, plan.id)
  );
  const targetPoint = getSidePointWithOffset(
    target.node,
    plan.targetSide,
    getEndpointOffset(endpointOffsetsByNodeId, plan.to, plan.targetSide, plan.id)
  );
  const sourceStub = moveOutward(sourcePoint, plan.sourceSide, FIXED_SEPARATION_DISTANCE);
  const targetStub = moveOutward(targetPoint, plan.targetSide, FIXED_SEPARATION_DISTANCE);
  const points: Point[] = [sourcePoint, sourceStub];

  if (plan.pattern === "realization_vertical" && Math.abs(sourceStub.x - targetStub.x) <= EPSILON) {
    points.push(targetStub, targetPoint);
    return applySegmentCoordinates(buildRoute(points, "orthogonal"), plan.id, segmentCoordinateByKey);
  }

  if (plan.pattern === "realization_corridor" || plan.pattern === "parking_fallback") {
    const connectorIndex = Math.max(0, plan.outgoingOrder);
    const corridorX = resolveRealizationCorridorX(source, target, connectorIndex);
    points.push(
      { x: corridorX, y: sourceStub.y },
      { x: corridorX, y: targetStub.y },
      targetStub,
      targetPoint
    );
    return applySegmentCoordinates(buildRoute(points, "orthogonal"), plan.id, segmentCoordinateByKey);
  }

  const bridgeX = resolveForwardBridgeX(source, target, sourceStub, targetStub, index);
  if (Math.abs(sourceStub.y - targetStub.y) <= EPSILON && sourceStub.x <= targetStub.x) {
    points.push(targetStub, targetPoint);
  } else {
    points.push(
      { x: bridgeX, y: sourceStub.y },
      { x: bridgeX, y: targetStub.y },
      targetStub,
      targetPoint
    );
  }

  return applySegmentCoordinates(buildRoute(points, "orthogonal"), plan.id, segmentCoordinateByKey);
}

function applySegmentCoordinates(
  route: PositionedRoute,
  connectorId: string,
  segmentCoordinateByKey: ReadonlyMap<string, number>
): PositionedRoute {
  if (segmentCoordinateByKey.size === 0 || route.points.length < 3) {
    return route;
  }

  const points = route.points.map((point) => ({ ...point }));
  for (let index = 1; index < points.length - 3; index += 1) {
    const assignedCoordinate = segmentCoordinateByKey.get(buildSegmentCoordinateKey(connectorId, index));
    if (assignedCoordinate === undefined) {
      continue;
    }
    const start = points[index]!;
    const end = points[index + 1]!;
    if (Math.abs(start.y - end.y) <= EPSILON) {
      start.y = assignedCoordinate;
      end.y = assignedCoordinate;
    } else if (Math.abs(start.x - end.x) <= EPSILON) {
      start.x = assignedCoordinate;
      end.x = assignedCoordinate;
    }
  }

  return buildRoute(points, route.style);
}

function segmentIntersectsBox(start: Point, end: Point, box: ScenarioFlowBox): boolean {
  if (Math.abs(start.x - end.x) <= EPSILON) {
    const x = start.x;
    if (x <= box.x + EPSILON || x >= box.x + box.width - EPSILON) {
      return false;
    }
    const low = Math.min(start.y, end.y);
    const high = Math.max(start.y, end.y);
    return low < box.y + box.height - EPSILON && high > box.y + EPSILON;
  }

  if (Math.abs(start.y - end.y) <= EPSILON) {
    const y = start.y;
    if (y <= box.y + EPSILON || y >= box.y + box.height - EPSILON) {
      return false;
    }
    const low = Math.min(start.x, end.x);
    const high = Math.max(start.x, end.x);
    return low < box.x + box.width - EPSILON && high > box.x + EPSILON;
  }

  return false;
}

function findRouteIntersection(route: PositionedRoute, boxes: readonly ScenarioFlowBox[]): {
  segmentIndex: number;
  box: ScenarioFlowBox;
  start: Point;
  end: Point;
} | undefined {
  for (let index = 1; index < route.points.length; index += 1) {
    const start = route.points[index - 1]!;
    const end = route.points[index]!;
    for (const box of boxes) {
      if (segmentIntersectsBox(start, end, box)) {
        return {
          segmentIndex: index - 1,
          box,
          start,
          end
        };
      }
    }
  }
  return undefined;
}

function buildObstacleOccupancy(
  connectorId: string,
  box: ScenarioFlowBox,
  side: PortSide,
  axis: ScenarioFlowGutterAxis,
  coordinate: number,
  spanStart: number,
  spanEnd: number,
  routeSegmentIndex: number
): ScenarioFlowGutterOccupancy {
  return {
    connectorId,
    key: `obstacle:${box.itemId}:${side}`,
    kind: `obstacle_${side}` satisfies ScenarioFlowGutterKind,
    axis,
    nominalCoordinate: roundMetric(coordinate),
    spanStart: roundMetric(Math.min(spanStart, spanEnd)),
    spanEnd: roundMetric(Math.max(spanStart, spanEnd)),
    routeSegmentIndex,
    nodeId: box.itemId,
    side,
    ownershipRank: 1
  };
}

function swerveRouteAroundIntersection(
  route: PositionedRoute,
  intersection: NonNullable<ReturnType<typeof findRouteIntersection>>,
  connectorId: string
): {
  route: PositionedRoute;
  occupancy: ScenarioFlowGutterOccupancy;
} {
  const points = [...route.points];
  const { start, end, box, segmentIndex } = intersection;

  if (Math.abs(start.y - end.y) <= EPSILON) {
    const aboveY = roundMetric(box.y - OBSTACLE_SWERVE_CLEARANCE);
    const belowY = roundMetric(box.y + box.height + OBSTACLE_SWERVE_CLEARANCE);
    const detourY = Math.abs(start.y - aboveY) <= Math.abs(start.y - belowY) ? aboveY : belowY;
    const detourSide: PortSide = detourY < box.y ? "north" : "south";
    const before = { x: roundMetric(start.x < end.x ? box.x - OBSTACLE_SWERVE_CLEARANCE : box.x + box.width + OBSTACLE_SWERVE_CLEARANCE), y: start.y };
    const after = { x: before.x, y: detourY };
    const exit = { x: roundMetric(start.x < end.x ? box.x + box.width + OBSTACLE_SWERVE_CLEARANCE : box.x - OBSTACLE_SWERVE_CLEARANCE), y: detourY };
    const rejoin = { x: exit.x, y: end.y };
    points.splice(segmentIndex + 1, 0, before, after, exit, rejoin);
    return {
      route: buildRoute(points, route.style),
      occupancy: buildObstacleOccupancy(
        connectorId,
        box,
        detourSide,
        "horizontal",
        detourY,
        after.x,
        exit.x,
        segmentIndex
      )
    };
  }

  const leftX = roundMetric(box.x - OBSTACLE_SWERVE_CLEARANCE);
  const rightX = roundMetric(box.x + box.width + OBSTACLE_SWERVE_CLEARANCE);
  const detourX = Math.abs(start.x - leftX) <= Math.abs(start.x - rightX) ? leftX : rightX;
  const detourSide: PortSide = detourX < box.x ? "west" : "east";
  const before = { x: start.x, y: roundMetric(start.y < end.y ? box.y - OBSTACLE_SWERVE_CLEARANCE : box.y + box.height + OBSTACLE_SWERVE_CLEARANCE) };
  const after = { x: detourX, y: before.y };
  const exit = { x: detourX, y: roundMetric(start.y < end.y ? box.y + box.height + OBSTACLE_SWERVE_CLEARANCE : box.y - OBSTACLE_SWERVE_CLEARANCE) };
  const rejoin = { x: end.x, y: exit.y };
  points.splice(segmentIndex + 1, 0, before, after, exit, rejoin);
  return {
    route: buildRoute(points, route.style),
    occupancy: buildObstacleOccupancy(
      connectorId,
      box,
      detourSide,
      "vertical",
      detourX,
      after.y,
      exit.y,
      segmentIndex
    )
  };
}

function refineRouteAgainstObstacles(
  route: PositionedRoute,
  plan: ScenarioFlowConnectorPlan,
  nodeBoxes: readonly ScenarioFlowBox[]
): {
  route: PositionedRoute;
  occupancy: ScenarioFlowGutterOccupancy[];
} {
  const blockingBoxes = nodeBoxes.filter((box) => box.itemId !== plan.from && box.itemId !== plan.to);
  let refinedRoute = route;
  const occupancy: ScenarioFlowGutterOccupancy[] = [];

  for (let pass = 0; pass < 6; pass += 1) {
    const intersection = findRouteIntersection(refinedRoute, blockingBoxes);
    if (!intersection) {
      break;
    }
    const refined = swerveRouteAroundIntersection(refinedRoute, intersection, plan.id);
    refinedRoute = refined.route;
    occupancy.push(refined.occupancy);
  }

  return {
    route: refinedRoute,
    occupancy
  };
}

function resolveColumnOrderForX(index: ScenarioFlowPositionedIndex, x: number, fallbackOrder = 0): number {
  const candidates = [...index.columnRightByOrder.keys()].sort((left, right) => left - right);
  for (const columnOrder of candidates) {
    const right = index.columnRightByOrder.get(columnOrder) ?? 0;
    const nextLeft = getNextValue(index.columnLeftByOrder, columnOrder);
    if (x >= right - EPSILON && (nextLeft === undefined || x <= nextLeft + EPSILON)) {
      return columnOrder;
    }
  }
  return fallbackOrder;
}

function resolveLaneOrderForY(index: ScenarioFlowPositionedIndex, y: number, fallbackOrder = 0): number {
  const candidates = [...index.rowBottomByOrder.keys()].sort((left, right) => left - right);
  for (const rowOrder of candidates) {
    const bottom = index.rowBottomByOrder.get(rowOrder) ?? 0;
    const nextTop = getNextValue(index.rowTopByOrder, rowOrder);
    if (y >= bottom - EPSILON && (nextTop === undefined || y <= nextTop + EPSILON)) {
      return rowOrder;
    }
  }
  return fallbackOrder;
}

function buildGenericOccupancy(
  plan: ScenarioFlowConnectorPlan,
  route: PositionedRoute,
  index: ScenarioFlowPositionedIndex
): ScenarioFlowGutterOccupancy[] {
  const source = index.nodeById.get(plan.from);
  const target = index.nodeById.get(plan.to);
  const sourceCell = source ? index.cellById.get(source.placement.cellId) : undefined;
  const targetCell = target ? index.cellById.get(target.placement.cellId) : undefined;
  const occupancy: ScenarioFlowGutterOccupancy[] = [];

  for (let segmentIndex = 0; segmentIndex < route.points.length - 1; segmentIndex += 1) {
    const start = route.points[segmentIndex]!;
    const end = route.points[segmentIndex + 1]!;
    const horizontal = Math.abs(start.y - end.y) <= EPSILON;
    const vertical = Math.abs(start.x - end.x) <= EPSILON;
    if (!horizontal && !vertical) {
      continue;
    }
    const first = segmentIndex === 0;
    const last = segmentIndex === route.points.length - 2;
    const axis: ScenarioFlowGutterAxis = horizontal ? "horizontal" : "vertical";
    const nominalCoordinate = roundMetric(horizontal ? start.y : start.x);
    const spanStart = roundMetric(horizontal ? Math.min(start.x, end.x) : Math.min(start.y, end.y));
    const spanEnd = roundMetric(horizontal ? Math.max(start.x, end.x) : Math.max(start.y, end.y));
    if (spanEnd - spanStart <= EPSILON) {
      continue;
    }

    if (first || last) {
      const endpointRole: EndpointRole = first ? "source" : "target";
      const nodeId = first ? plan.from : plan.to;
      const side = first ? plan.sourceSide : plan.targetSide;
      const cell = first ? sourceCell : targetCell;
      const nodeRight = first && side === "east";
      const nodeBottom = first && side === "south";
      occupancy.push({
        connectorId: plan.id,
        key: nodeRight
          ? `node:${nodeId}:right`
          : nodeBottom
            ? `node:${nodeId}:bottom`
            : `edge:${nodeId}:${side}:${endpointRole}`,
        axis,
        kind: nodeRight ? "node_right" : nodeBottom ? "node_bottom" : "edge_local",
        nodeId,
        side,
        endpointRole,
        nominalCoordinate,
        spanStart,
        spanEnd,
        routeSegmentIndex: segmentIndex,
        columnOrder: cell?.columnOrder,
        laneOrder: cell?.rowOrder,
        ownershipRank: 0
      });
      continue;
    }

    if (segmentIndex === 1 || segmentIndex === route.points.length - 3) {
      const endpointRole: EndpointRole = segmentIndex === 1 ? "source" : "target";
      const nodeId = endpointRole === "source" ? plan.from : plan.to;
      const side = endpointRole === "source" ? plan.sourceSide : plan.targetSide;
      const cell = endpointRole === "source" ? sourceCell : targetCell;
      const nodeRight = endpointRole === "source" && side === "east";
      const nodeBottom = endpointRole === "source" && side === "south";
      occupancy.push({
        connectorId: plan.id,
        key: nodeRight
          ? `node:${nodeId}:right`
          : nodeBottom
            ? `node:${nodeId}:bottom`
            : `edge:${nodeId}:${side}:${endpointRole}`,
        axis,
        kind: nodeRight ? "node_right" : nodeBottom ? "node_bottom" : "edge_local",
        nodeId,
        side,
        endpointRole,
        nominalCoordinate,
        spanStart,
        spanEnd,
        routeSegmentIndex: segmentIndex,
        columnOrder: cell?.columnOrder,
        laneOrder: cell?.rowOrder,
        ownershipRank: 0
      });
      continue;
    }

    if (vertical) {
      const columnOrder = resolveColumnOrderForX(index, nominalCoordinate, sourceCell?.columnOrder ?? 0);
      occupancy.push({
        connectorId: plan.id,
        key: `column:${columnOrder}:right`,
        axis,
        kind: "column",
        nominalCoordinate,
        spanStart,
        spanEnd,
        routeSegmentIndex: segmentIndex,
        columnOrder,
        laneOrder: sourceCell?.rowOrder
      });
    } else {
      const laneOrder = resolveLaneOrderForY(index, nominalCoordinate, sourceCell?.rowOrder ?? 0);
      occupancy.push({
        connectorId: plan.id,
        key: `lane:${laneOrder}:below`,
        axis,
        kind: "lane",
        nominalCoordinate,
        spanStart,
        spanEnd,
        routeSegmentIndex: segmentIndex,
        columnOrder: sourceCell?.columnOrder,
        laneOrder
      });
    }
  }

  return occupancy;
}

function buildOccupancyByConnector(
  plans: readonly ScenarioFlowConnectorPlan[],
  routeSelector: (plan: ScenarioFlowConnectorPlan) => PositionedRoute,
  index: ScenarioFlowPositionedIndex,
  extraOccupancyByConnector = new Map<string, ScenarioFlowGutterOccupancy[]>()
): {
  occupancy: ScenarioFlowGutterOccupancy[];
  occupancyByConnectorId: Map<string, ScenarioFlowGutterOccupancy[]>;
} {
  const occupancyByConnectorId = new Map<string, ScenarioFlowGutterOccupancy[]>();
  const occupancy: ScenarioFlowGutterOccupancy[] = [];

  for (const plan of plans) {
    const connectorOccupancy = [
      ...(extraOccupancyByConnector.get(plan.id) ?? []),
      ...buildGenericOccupancy(plan, routeSelector(plan), index)
    ].sort((left, right) =>
      left.key.localeCompare(right.key)
      || left.axis.localeCompare(right.axis)
      || left.routeSegmentIndex - right.routeSegmentIndex
      || left.connectorId.localeCompare(right.connectorId)
    );
    occupancyByConnectorId.set(plan.id, connectorOccupancy);
    occupancy.push(...connectorOccupancy);
  }

  return {
    occupancy,
    occupancyByConnectorId
  };
}

function spansTouchOrOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return Math.min(endA, endB) - Math.max(startA, startB) >= -EPSILON;
}

function isDisplaceableOccupancy(entry: ScenarioFlowGutterOccupancy): boolean {
  return entry.kind === "node_right"
    || entry.kind === "node_bottom"
    || entry.kind === "column"
    || entry.kind === "lane"
    || entry.kind === "obstacle_north"
    || entry.kind === "obstacle_south"
    || entry.kind === "obstacle_east"
    || entry.kind === "obstacle_west";
}

function buildGlobalResolutionKey(entry: ScenarioFlowGutterOccupancy): string | undefined {
  if (entry.axis === "vertical" && entry.columnOrder !== undefined) {
    return `vertical:${entry.columnOrder}`;
  }
  if (entry.axis === "horizontal" && entry.laneOrder !== undefined) {
    return `horizontal:${entry.laneOrder}`;
  }
  return undefined;
}

function compareOccupancyForResolution(
  left: ScenarioFlowGutterOccupancy,
  right: ScenarioFlowGutterOccupancy,
  planById: ReadonlyMap<string, ScenarioFlowConnectorPlan>
): number {
  const leftPlan = planById.get(left.connectorId);
  const rightPlan = planById.get(right.connectorId);
  if (leftPlan && rightPlan) {
    return compareConnectorPlans(leftPlan, rightPlan)
      || (left.ownershipRank ?? 99) - (right.ownershipRank ?? 99)
      || left.routeSegmentIndex - right.routeSegmentIndex;
  }
  return left.connectorId.localeCompare(right.connectorId)
    || (left.ownershipRank ?? 99) - (right.ownershipRank ?? 99)
    || left.routeSegmentIndex - right.routeSegmentIndex;
}

function resolveOccupancyCoordinates(
  plans: readonly ScenarioFlowConnectorPlan[],
  occupancy: readonly ScenarioFlowGutterOccupancy[]
): Map<string, number> {
  const planById = new Map(plans.map((plan) => [plan.id, plan] as const));
  const grouped = new Map<string, ScenarioFlowGutterOccupancy[]>();
  const coordinateBySegmentKey = new Map<string, number>();

  for (const entry of occupancy) {
    if (!isDisplaceableOccupancy(entry)) {
      continue;
    }
    const key = `${entry.key}|${entry.axis}`;
    const existing = grouped.get(key) ?? [];
    existing.push(entry);
    grouped.set(key, existing);
  }

  grouped.forEach((group) => {
    const occupied: Array<{ entry: ScenarioFlowGutterOccupancy; coordinate: number }> = [];
    const sorted = [...group].sort((left, right) => compareOccupancyForResolution(left, right, planById));

    for (const entry of sorted) {
      let coordinate = entry.nominalCoordinate;
      for (const occupiedEntry of occupied) {
        if (!spansTouchOrOverlap(entry.spanStart, entry.spanEnd, occupiedEntry.entry.spanStart, occupiedEntry.entry.spanEnd)) {
          continue;
        }
        if (coordinate < occupiedEntry.coordinate + FIXED_SEPARATION_DISTANCE) {
          coordinate = roundMetric(occupiedEntry.coordinate + FIXED_SEPARATION_DISTANCE);
        }
      }
      occupied.push({ entry, coordinate });
      occupied.sort((left, right) => left.coordinate - right.coordinate);
      coordinateBySegmentKey.set(buildSegmentCoordinateKey(entry.connectorId, entry.routeSegmentIndex), coordinate);
    }
  });

  const globalGroups = new Map<string, ScenarioFlowGutterOccupancy[]>();
  for (const entry of occupancy) {
    if (!isDisplaceableOccupancy(entry)) {
      continue;
    }
    const key = buildGlobalResolutionKey(entry);
    if (!key) {
      continue;
    }
    const existing = globalGroups.get(key) ?? [];
    existing.push(entry);
    globalGroups.set(key, existing);
  }

  globalGroups.forEach((group) => {
    const occupied: Array<{ entry: ScenarioFlowGutterOccupancy; coordinate: number }> = [];
    const sorted = [...group].sort((left, right) => compareOccupancyForResolution(left, right, planById));

    for (const entry of sorted) {
      const segmentKey = buildSegmentCoordinateKey(entry.connectorId, entry.routeSegmentIndex);
      let coordinate = coordinateBySegmentKey.get(segmentKey) ?? entry.nominalCoordinate;
      for (const occupiedEntry of occupied) {
        if (!spansTouchOrOverlap(entry.spanStart, entry.spanEnd, occupiedEntry.entry.spanStart, occupiedEntry.entry.spanEnd)) {
          continue;
        }
        if (coordinate < occupiedEntry.coordinate + FIXED_SEPARATION_DISTANCE) {
          coordinate = roundMetric(occupiedEntry.coordinate + FIXED_SEPARATION_DISTANCE);
        }
      }
      occupied.push({ entry, coordinate });
      occupied.sort((left, right) => left.coordinate - right.coordinate);
      coordinateBySegmentKey.set(segmentKey, coordinate);
    }
  });

  return coordinateBySegmentKey;
}

function roundUpToSeparationDistance(value: number): number {
  if (value <= 0) {
    return 0;
  }
  return roundMetric(Math.ceil(value / FIXED_SEPARATION_DISTANCE) * FIXED_SEPARATION_DISTANCE);
}

function resolveRequiredEndpointGapExpansions(
  plans: readonly ScenarioFlowConnectorPlan[],
  index: ScenarioFlowPositionedIndex
): {
  columnExpansions: Record<number, number>;
  laneExpansions: Record<number, number>;
} {
  const columnExpansions: Record<number, number> = {};
  const laneExpansions: Record<number, number> = {};

  for (const plan of plans) {
    const source = index.nodeById.get(plan.from);
    const target = index.nodeById.get(plan.to);
    if (!source || !target) {
      continue;
    }
    const sourceCell = index.cellById.get(source.placement.cellId);
    const targetCell = index.cellById.get(target.placement.cellId);
    if (!sourceCell || !targetCell) {
      continue;
    }
    if (plan.sourceSide === "east" && plan.targetSide === "west" && targetCell.columnOrder > sourceCell.columnOrder) {
      const gap = roundMetric(target.node.x - (source.node.x + source.node.width));
      const required = FIXED_SEPARATION_DISTANCE * 2;
      const overflow = roundMetric(required - gap);
      if (overflow > 0) {
        columnExpansions[sourceCell.columnOrder] = roundUpToSeparationDistance(
          Math.max(columnExpansions[sourceCell.columnOrder] ?? 0, overflow)
        );
      }
    }
    if (plan.sourceSide === "south" && plan.targetSide === "north" && targetCell.rowOrder > sourceCell.rowOrder) {
      const gap = roundMetric(target.node.y - (source.node.y + source.node.height));
      const required = FIXED_SEPARATION_DISTANCE * 2;
      const overflow = roundMetric(required - gap);
      if (overflow > 0) {
        laneExpansions[sourceCell.rowOrder] = roundUpToSeparationDistance(
          Math.max(laneExpansions[sourceCell.rowOrder] ?? 0, overflow)
        );
      }
    }
  }

  return { columnExpansions, laneExpansions };
}

function resolveRequiredColumnExpansions(
  occupancy: readonly ScenarioFlowGutterOccupancy[],
  index: ScenarioFlowPositionedIndex,
  coordinateBySegmentKey: ReadonlyMap<string, number>
): Record<number, number> {
  const required: Record<number, number> = {};

  for (const entry of occupancy) {
    if (entry.axis !== "vertical" || entry.columnOrder === undefined) {
      continue;
    }
    const nextColumnLeft = getNextValue(index.columnLeftByOrder, entry.columnOrder);
    if (nextColumnLeft === undefined) {
      continue;
    }
    const coordinate = coordinateBySegmentKey.get(buildSegmentCoordinateKey(entry.connectorId, entry.routeSegmentIndex))
      ?? entry.nominalCoordinate;
    const overflow = roundMetric(coordinate - (nextColumnLeft - FIXED_SEPARATION_DISTANCE - GUTTER_OVERFLOW_TOLERANCE));
    if (overflow > 0) {
      required[entry.columnOrder] = roundUpToSeparationDistance(Math.max(required[entry.columnOrder] ?? 0, overflow));
    }
  }

  return required;
}

function resolveRequiredLaneExpansions(
  occupancy: readonly ScenarioFlowGutterOccupancy[],
  index: ScenarioFlowPositionedIndex,
  coordinateBySegmentKey: ReadonlyMap<string, number>
): Record<number, number> {
  const required: Record<number, number> = {};

  for (const entry of occupancy) {
    if (entry.axis !== "horizontal" || entry.laneOrder === undefined) {
      continue;
    }
    const nextRowTop = getNextValue(index.rowTopByOrder, entry.laneOrder);
    if (nextRowTop === undefined) {
      continue;
    }
    const coordinate = coordinateBySegmentKey.get(buildSegmentCoordinateKey(entry.connectorId, entry.routeSegmentIndex))
      ?? entry.nominalCoordinate;
    const overflow = roundMetric(coordinate - (nextRowTop - FIXED_SEPARATION_DISTANCE - GUTTER_OVERFLOW_TOLERANCE));
    if (overflow > 0) {
      required[entry.laneOrder] = roundUpToSeparationDistance(Math.max(required[entry.laneOrder] ?? 0, overflow));
    }
  }

  return required;
}

function hasNonZeroExpansion(expansions: Record<number, number>): boolean {
  return Object.values(expansions).some((value) => value > 0);
}

function accumulateExpansions(
  existing: Record<number, number>,
  additional: Record<number, number>
): Record<number, number> {
  const accumulated: Record<number, number> = { ...existing };
  for (const [key, value] of Object.entries(additional)) {
    if (value <= 0) {
      continue;
    }
    accumulated[Number(key)] = roundMetric((accumulated[Number(key)] ?? 0) + value);
  }
  return accumulated;
}

function applyGlobalGutterExpansions(
  scene: PositionedScene,
  middleLayer: ScenarioFlowMiddleLayerModel,
  columnExpansions: Record<number, number>,
  laneExpansions: Record<number, number>
): PositionedScene {
  const shifted = clonePositionedScene(scene);
  const cumulativeColumnShift = new Map<number, number>();
  const cumulativeLaneShift = new Map<number, number>();
  const positionedCells = shifted.root.children.filter(isScenarioFlowCell);
  const columnOrders = [...new Set(positionedCells.map((cell) => cell.viewMetadata.scenarioFlow.columnOrder))];
  const rowOrders = [...new Set(positionedCells.map((cell) => cell.viewMetadata.scenarioFlow.rowOrder))];

  columnOrders
    .sort((left, right) => left - right)
    .forEach((columnOrder) => {
      const shift = [...Object.entries(columnExpansions)]
        .map(([key, value]) => [Number(key), value] as const)
        .filter(([candidateOrder]) => candidateOrder < columnOrder)
        .reduce((sum, [, value]) => sum + value, 0);
      cumulativeColumnShift.set(columnOrder, roundMetric(shift));
    });

  rowOrders
    .sort((left, right) => left - right)
    .forEach((rowOrder) => {
      const shift = [...Object.entries(laneExpansions)]
        .map(([key, value]) => [Number(key), value] as const)
        .filter(([candidateOrder]) => candidateOrder < rowOrder)
        .reduce((sum, [, value]) => sum + value, 0);
      cumulativeLaneShift.set(rowOrder, roundMetric(shift));
    });

  for (const child of shifted.root.children) {
    if (!isScenarioFlowCell(child)) {
      continue;
    }
    const meta = child.viewMetadata.scenarioFlow;
    translatePositionedItem(
      child,
      cumulativeColumnShift.get(meta.columnOrder) ?? 0,
      cumulativeLaneShift.get(meta.rowOrder) ?? 0
    );
  }

  updateRootSize(shifted.root);
  return decorateScenarioFlowPositionedScene({
    ...shifted,
    decorations: []
  }, middleLayer);
}

function buildPreparedRoutes(
  connectorPlans: readonly ScenarioFlowConnectorPlan[],
  index: ScenarioFlowPositionedIndex,
  endpointOffsetsByNodeId: ReadonlyMap<string, Map<PortSide, Map<string, number>>>,
  segmentCoordinateByKey: ReadonlyMap<string, number> = new Map<string, number>()
): PreparedScenarioFlowRoutes {
  const plans: ScenarioFlowConnectorPlan[] = connectorPlans.map((plan) => ({
    ...plan,
    occupiedGutters: []
  }));
  const obstacleOccupancyByConnectorId = new Map<string, ScenarioFlowGutterOccupancy[]>();

  for (const plan of plans) {
    plan.step2Route = buildTemplateRoute(plan, index, endpointOffsetsByNodeId);
    const refined = refineRouteAgainstObstacles(plan.step2Route, plan, index.nodeBoxes);
    plan.step3Route = refined.route;
    const finalRefined = segmentCoordinateByKey.size === 0
      ? refined
      : refineRouteAgainstObstacles(
        buildTemplateRoute(plan, index, endpointOffsetsByNodeId, segmentCoordinateByKey),
        plan,
        index.nodeBoxes
      );
    plan.finalRoute = finalRefined.route;
    obstacleOccupancyByConnectorId.set(plan.id, finalRefined.occupancy);
  }

  const occupancyResult = buildOccupancyByConnector(
    plans,
    (plan) => plan.finalRoute,
    index,
    obstacleOccupancyByConnectorId
  );
  for (const plan of plans) {
    plan.occupiedGutters = occupancyResult.occupancyByConnectorId.get(plan.id) ?? [];
  }

  return {
    connectorPlans: plans,
    occupancy: occupancyResult.occupancy,
    occupancyByConnectorId: occupancyResult.occupancyByConnectorId
  };
}

function buildStep3Routes(
  connectorPlans: readonly ScenarioFlowConnectorPlan[],
  index: ScenarioFlowPositionedIndex,
  endpointOffsetsByNodeId: ReadonlyMap<string, Map<PortSide, Map<string, number>>>
): PreparedScenarioFlowRoutes {
  const plans: ScenarioFlowConnectorPlan[] = connectorPlans.map((plan) => ({
    ...plan,
    occupiedGutters: []
  }));
  const obstacleOccupancyByConnectorId = new Map<string, ScenarioFlowGutterOccupancy[]>();

  for (const plan of plans) {
    plan.step2Route = buildTemplateRoute(plan, index, endpointOffsetsByNodeId);
    const refined = refineRouteAgainstObstacles(plan.step2Route, plan, index.nodeBoxes);
    plan.step3Route = refined.route;
    plan.finalRoute = refined.route;
    obstacleOccupancyByConnectorId.set(plan.id, refined.occupancy);
  }

  const occupancyResult = buildOccupancyByConnector(
    plans,
    (plan) => plan.step3Route,
    index,
    obstacleOccupancyByConnectorId
  );
  for (const plan of plans) {
    plan.occupiedGutters = occupancyResult.occupancyByConnectorId.get(plan.id) ?? [];
  }

  return {
    connectorPlans: plans,
    occupancy: occupancyResult.occupancy,
    occupancyByConnectorId: occupancyResult.occupancyByConnectorId
  };
}

function boxIntersectsBox(left: ScenarioFlowBox, right: ScenarioFlowBox): boolean {
  return left.x < right.x + right.width - EPSILON
    && left.x + left.width > right.x + EPSILON
    && left.y < right.y + right.height - EPSILON
    && left.y + left.height > right.y + EPSILON;
}

function buildLabelCandidates(
  label: NonNullable<MeasuredEdge["label"]>,
  route: PositionedRoute
): PositionedEdgeLabel[] {
  const candidates: PositionedEdgeLabel[] = [];
  for (let index = 1; index < route.points.length; index += 1) {
    const start = route.points[index - 1]!;
    const end = route.points[index]!;
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    if (length < 8) {
      continue;
    }
    const mid = {
      x: roundMetric((start.x + end.x) / 2),
      y: roundMetric((start.y + end.y) / 2)
    };
    const horizontal = Math.abs(start.y - end.y) <= EPSILON;
    const offsets = [LABEL_OFFSET, LABEL_OFFSET + LABEL_CANDIDATE_STEP, -(LABEL_OFFSET + label.height), -(LABEL_OFFSET + LABEL_CANDIDATE_STEP + label.height)];
    for (const offset of offsets) {
      candidates.push({
        lines: [...label.lines],
        width: label.width,
        height: label.height,
        lineHeight: label.lineHeight,
        textStyleRole: label.textStyleRole,
        x: horizontal ? roundMetric(mid.x - label.width / 2) : roundMetric(mid.x + offset),
        y: horizontal ? roundMetric(mid.y + offset) : roundMetric(mid.y - label.height / 2)
      });
    }
  }
  return candidates;
}

function placeLabels(
  plans: readonly ScenarioFlowConnectorPlan[],
  scene: PositionedScene,
  diagnostics: RendererDiagnostic[]
): Map<string, PositionedEdgeLabel> {
  const labelsByPlanId = new Map<string, PositionedEdgeLabel>();
  const placedBoxes: ScenarioFlowBox[] = [];
  const forbiddenBoxes = flattenItems(scene.root)
    .filter(isPositionedNode)
    .map((node) => ({
      itemId: node.id,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height
    }));

  for (const plan of plans) {
    if (!plan.label) {
      continue;
    }
    const candidates = buildLabelCandidates(plan.label, plan.finalRoute);
    const selected = candidates.find((candidate) => {
      const box = {
        itemId: plan.id,
        x: candidate.x,
        y: candidate.y,
        width: candidate.width,
        height: candidate.height
      };
      return ![...forbiddenBoxes, ...placedBoxes].some((blocked) => boxIntersectsBox(box, blocked));
    });
    if (!selected) {
      diagnostics.push(createRoutingDiagnostic(
        "renderer.routing.scenario_flow_label_fallback",
        `Could not place branch label for scenario-flow edge "${plan.id}" without an overlap. Omitting the label.`,
        plan.id,
        "warn"
      ));
      continue;
    }
    labelsByPlanId.set(plan.id, selected);
    placedBoxes.push({
      itemId: plan.id,
      x: selected.x,
      y: selected.y,
      width: selected.width,
      height: selected.height
    });
  }

  return labelsByPlanId;
}

function buildPositionedEdges(
  plans: readonly ScenarioFlowConnectorPlan[],
  routeSelector: (plan: ScenarioFlowConnectorPlan) => PositionedRoute,
  labelsByPlanId = new Map<string, PositionedEdgeLabel>()
): PositionedEdge[] {
  return plans.map((plan): PositionedEdge => {
    const route = routeSelector(plan);
    return {
      id: plan.id,
      role: plan.role,
      classes: plan.classes,
      from: {
        itemId: plan.from,
        portId: plan.sourcePortId,
        x: route.points[0]?.x ?? 0,
        y: route.points[0]?.y ?? 0
      },
      to: {
        itemId: plan.to,
        portId: plan.targetPortId,
        x: route.points[route.points.length - 1]?.x ?? 0,
        y: route.points[route.points.length - 1]?.y ?? 0
      },
      route,
      label: labelsByPlanId.get(plan.id),
      markers: plan.markers,
      paintGroup: "edges" satisfies PaintGroup
    };
  });
}

function withEdgesAndDiagnostics(
  scene: PositionedScene,
  edges: PositionedEdge[],
  diagnostics: RendererDiagnostic[]
): PositionedScene {
  return {
    ...scene,
    edges,
    diagnostics: sortRendererDiagnostics([...scene.diagnostics, ...diagnostics])
  };
}

function emitFinalIntersectionDiagnostics(
  plans: readonly ScenarioFlowConnectorPlan[],
  nodeBoxes: readonly ScenarioFlowBox[],
  diagnostics: RendererDiagnostic[]
): void {
  for (const plan of plans) {
    const intersection = findRouteIntersection(plan.finalRoute, nodeBoxes);
    if (!intersection) {
      continue;
    }
    diagnostics.push(createRoutingDiagnostic(
      "renderer.routing.scenario_flow_node_intersection",
      `Scenario-flow edge "${plan.id}" intersects node "${intersection.box.itemId}".`,
      plan.id,
      "error"
    ));
  }
}

export function buildScenarioFlowRoutingStages(
  measuredScene: MeasuredScene,
  positionedScene: PositionedScene,
  middleLayer: ScenarioFlowMiddleLayerModel
): ScenarioFlowRoutingStages {
  const diagnostics: RendererDiagnostic[] = [];
  const baseIndex = buildIndex(positionedScene, middleLayer);
  const connectorPlans = buildConnectorPlans(measuredScene, middleLayer, baseIndex, diagnostics);
  const baseBucketsByNodeId = buildNodeEdgeBuckets(connectorPlans, baseIndex);
  const baseEndpointOffsetsByNodeId = buildEndpointOffsets(baseIndex, baseBucketsByNodeId);
  const step2Plans = connectorPlans.map((plan) => ({
    ...plan,
    step2Route: buildTemplateRoute(plan, baseIndex, baseEndpointOffsetsByNodeId)
  }));
  const step2PositionedScene = withEdgesAndDiagnostics(
    positionedScene,
    buildPositionedEdges(step2Plans, (plan) => plan.step2Route),
    diagnostics
  );
  const step3Prepared = buildStep3Routes(connectorPlans, baseIndex, baseEndpointOffsetsByNodeId);
  const step3PositionedScene = withEdgesAndDiagnostics(
    positionedScene,
    buildPositionedEdges(step3Prepared.connectorPlans, (plan) => plan.step3Route),
    diagnostics
  );

  let workingScene = positionedScene;
  let workingIndex = baseIndex;
  let workingGlobalGutterState = buildGlobalGutterState();
  let finalPrepared = step3Prepared;

  for (let attempt = 0; attempt < MAX_FINAL_ROUTING_ATTEMPTS; attempt += 1) {
    const bucketsByNodeId = buildNodeEdgeBuckets(connectorPlans, workingIndex);
    const endpointOffsetsByNodeId = buildEndpointOffsets(workingIndex, bucketsByNodeId);
    const nominalPrepared = buildStep3Routes(connectorPlans, workingIndex, endpointOffsetsByNodeId);
    const segmentCoordinates = resolveOccupancyCoordinates(nominalPrepared.connectorPlans, nominalPrepared.occupancy);
    const endpointGapExpansions = resolveRequiredEndpointGapExpansions(nominalPrepared.connectorPlans, workingIndex);
    const columnExpansions = accumulateExpansions(
      endpointGapExpansions.columnExpansions,
      resolveRequiredColumnExpansions(nominalPrepared.occupancy, workingIndex, segmentCoordinates)
    );
    const laneExpansions = accumulateExpansions(
      endpointGapExpansions.laneExpansions,
      resolveRequiredLaneExpansions(nominalPrepared.occupancy, workingIndex, segmentCoordinates)
    );

    if (!hasNonZeroExpansion(columnExpansions) && !hasNonZeroExpansion(laneExpansions)) {
      finalPrepared = buildPreparedRoutes(connectorPlans, workingIndex, endpointOffsetsByNodeId, segmentCoordinates);
      break;
    }

    workingGlobalGutterState = buildGlobalGutterState(
      accumulateExpansions(workingGlobalGutterState.columnExpansions, columnExpansions),
      accumulateExpansions(workingGlobalGutterState.laneExpansions, laneExpansions)
    );
    workingScene = applyGlobalGutterExpansions(workingScene, middleLayer, columnExpansions, laneExpansions);
    workingIndex = buildIndex(workingScene, middleLayer);

    if (attempt === MAX_FINAL_ROUTING_ATTEMPTS - 1) {
      const finalBucketsByNodeId = buildNodeEdgeBuckets(connectorPlans, workingIndex);
      const finalEndpointOffsetsByNodeId = buildEndpointOffsets(workingIndex, finalBucketsByNodeId);
      const nominal = buildStep3Routes(connectorPlans, workingIndex, finalEndpointOffsetsByNodeId);
      const finalSegmentCoordinates = resolveOccupancyCoordinates(nominal.connectorPlans, nominal.occupancy);
      finalPrepared = buildPreparedRoutes(connectorPlans, workingIndex, finalEndpointOffsetsByNodeId, finalSegmentCoordinates);
    }
  }

  const finalDiagnostics: RendererDiagnostic[] = [...diagnostics];
  emitFinalIntersectionDiagnostics(finalPrepared.connectorPlans, workingIndex.nodeBoxes, finalDiagnostics);
  const labelsByPlanId = placeLabels(finalPrepared.connectorPlans, workingScene, finalDiagnostics);
  const finalPositionedScene = withEdgesAndDiagnostics(
    workingScene,
    buildPositionedEdges(finalPrepared.connectorPlans, (plan) => plan.finalRoute, labelsByPlanId),
    finalDiagnostics
  );
  const finalBucketsByNodeId = buildNodeEdgeBuckets(finalPrepared.connectorPlans, workingIndex);

  return {
    connectorPlans: finalPrepared.connectorPlans,
    nodeEdgeBuckets: [...finalBucketsByNodeId.values()].sort((left, right) => left.nodeId.localeCompare(right.nodeId)),
    nodeGutters: buildNodeGutters(workingIndex),
    globalGutterState: workingGlobalGutterState,
    gutterOccupancy: finalPrepared.occupancy,
    step2PositionedScene,
    step3PositionedScene,
    finalPositionedScene,
    diagnostics: sortRendererDiagnostics(finalDiagnostics)
  };
}
