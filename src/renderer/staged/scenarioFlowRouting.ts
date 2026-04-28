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
  cell?: IndexedScenarioFlowCell;
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

type ScenarioFlowGutterRectKind = Extract<ScenarioFlowGutterKind, "node_right" | "node_bottom" | "column" | "lane">;

interface ScenarioFlowGutterRect {
  key: string;
  kind: ScenarioFlowGutterRectKind;
  x: number;
  y: number;
  width: number;
  height: number;
  nodeId?: string;
  columnOrder?: number;
  laneOrder?: number;
}

interface ScenarioFlowSwerveMetadata {
  swerveGroupId: string;
  swerveBlockerCount: number;
  swerveTraversalStart: number;
  swerveSpanStart: number;
  swerveSpanEnd: number;
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
  locked?: boolean;
  swerveGroupId?: string;
  swerveBlockerCount?: number;
  swerveTraversalStart?: number;
  swerveSpanStart?: number;
  swerveSpanEnd?: number;
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
  requiredColumnExpansions: Record<number, number>;
  requiredLaneExpansions: Record<number, number>;
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

function clampMetric(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getHorizontalOverlap(
  source: PositionedNode,
  target: PositionedNode
): { left: number; right: number } | undefined {
  const left = roundMetric(Math.max(source.x, target.x));
  const right = roundMetric(Math.min(source.x + source.width, target.x + target.width));
  return right - left > EPSILON ? { left, right } : undefined;
}

function resolveVerticalTrackX(
  source: PositionedNode,
  target: PositionedNode,
  preferredX: number
): number | undefined {
  const overlap = getHorizontalOverlap(source, target);
  if (!overlap) {
    return undefined;
  }
  return roundMetric(clampMetric(preferredX, overlap.left, overlap.right));
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
    return source.cell
      && target.cell
      && source.cell.columnOrder === target.cell.columnOrder
      && getHorizontalOverlap(source.node, target.node)
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

function buildGutterRects(
  scene: PositionedScene,
  index: ScenarioFlowPositionedIndex,
  globalGutterState: ScenarioFlowGlobalGutterState
): ScenarioFlowGutterRect[] {
  const rects: ScenarioFlowGutterRect[] = [];

  for (const context of index.nodeById.values()) {
    const cell = index.cellById.get(context.placement.cellId);
    if (!cell) {
      continue;
    }
    const columnExpansion = globalGutterState.columnExpansions[cell.columnOrder] ?? 0;
    const laneExpansion = globalGutterState.laneExpansions[cell.rowOrder] ?? 0;
    const nextColumnLeft = getNextValue(index.columnLeftByOrder, cell.columnOrder)
      ?? roundMetric(cell.cell.x + cell.cell.width);
    const nextRowTop = getNextValue(index.rowTopByOrder, cell.rowOrder)
      ?? roundMetric(cell.cell.y + cell.cell.height);
    const rightLimit = roundMetric(nextColumnLeft - columnExpansion);
    const bottomLimit = roundMetric(nextRowTop - laneExpansion);
    const rightWidth = roundMetric(Math.max(0, rightLimit - (context.node.x + context.node.width)));
    const bottomHeight = roundMetric(Math.max(0, bottomLimit - (context.node.y + context.node.height)));

    if (rightWidth > 0) {
      rects.push({
        key: `node:${context.node.id}:right`,
        kind: "node_right",
        nodeId: context.node.id,
        columnOrder: cell.columnOrder,
        laneOrder: cell.rowOrder,
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
        columnOrder: cell.columnOrder,
        laneOrder: cell.rowOrder,
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
      key: `column:${numericOrder}:right`,
      kind: "column",
      columnOrder: numericOrder,
      x,
      y: 0,
      width: roundMetric(expansionWidth),
      height: roundMetric(scene.root.height)
    });
  }

  for (const [laneOrder, expansionHeight] of Object.entries(globalGutterState.laneExpansions)) {
    const numericOrder = Number(laneOrder);
    if (expansionHeight <= 0) {
      continue;
    }
    const nextRowTop = getNextValue(index.rowTopByOrder, numericOrder);
    const y = nextRowTop === undefined
      ? roundMetric(index.rowBottomByOrder.get(numericOrder) ?? 0)
      : roundMetric(nextRowTop - expansionHeight);
    rects.push({
      key: `lane:${numericOrder}:below`,
      kind: "lane",
      laneOrder: numericOrder,
      x: 0,
      y,
      width: roundMetric(scene.root.width),
      height: roundMetric(expansionHeight)
    });
  }

  return rects;
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

function clampEndpointSegmentCoordinate(
  value: number,
  fallbackValue: number,
  orientation: ScenarioFlowGutterAxis,
  segmentIndex: number,
  lastSegmentIndex: number,
  plan?: ScenarioFlowConnectorPlan,
  index?: ScenarioFlowPositionedIndex
): number {
  if (!plan || !index) {
    return roundMetric(value);
  }

  let min = -Infinity;
  let max = Infinity;
  const addSideConstraint = (nodeId: string, side: PortSide): void => {
    const node = index.nodeById.get(nodeId)?.node;
    if (!node) {
      return;
    }
    if (orientation === "vertical" && (side === "north" || side === "south")) {
      min = Math.max(min, node.x);
      max = Math.min(max, node.x + node.width);
    }
    if (orientation === "horizontal" && (side === "east" || side === "west")) {
      min = Math.max(min, node.y);
      max = Math.min(max, node.y + node.height);
    }
  };

  if (segmentIndex === 0) {
    addSideConstraint(plan.from, plan.sourceSide);
  }
  if (segmentIndex === lastSegmentIndex) {
    addSideConstraint(plan.to, plan.targetSide);
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return roundMetric(value);
  }
  if (min > max) {
    return roundMetric(value);
  }
  if (value < min - EPSILON || value > max + EPSILON) {
    return roundMetric(fallbackValue);
  }
  return roundMetric(clampMetric(value, min, max));
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

  if (plan.pattern === "realization_vertical") {
    const trackOffset = source.cell ? source.cell.rowOrder * FIXED_SEPARATION_DISTANCE * 2 : 0;
    const trackX = resolveVerticalTrackX(source.node, target.node, roundMetric(sourcePoint.x + trackOffset));
    if (trackX !== undefined) {
      return buildRoute([
        { x: trackX, y: sourcePoint.y },
        { x: trackX, y: targetPoint.y }
      ], "orthogonal");
    }
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
    return applySegmentCoordinates(buildRoute(points, "orthogonal"), plan.id, segmentCoordinateByKey, plan, index);
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

  return applySegmentCoordinates(buildRoute(points, "orthogonal"), plan.id, segmentCoordinateByKey, plan, index);
}

function applySegmentCoordinates(
  route: PositionedRoute,
  connectorId: string,
  segmentCoordinateByKey: ReadonlyMap<string, number>,
  plan?: ScenarioFlowConnectorPlan,
  index?: ScenarioFlowPositionedIndex
): PositionedRoute {
  if (segmentCoordinateByKey.size === 0 || route.points.length < 2) {
    return route;
  }

  const points = route.points.map((point) => ({ ...point }));
  for (let pointIndex = 0; pointIndex < points.length - 1; pointIndex += 1) {
    const assignedCoordinate = segmentCoordinateByKey.get(buildSegmentCoordinateKey(connectorId, pointIndex));
    if (assignedCoordinate === undefined) {
      continue;
    }
    const start = points[pointIndex]!;
    const end = points[pointIndex + 1]!;
    if (Math.abs(start.y - end.y) <= EPSILON) {
      const y = clampEndpointSegmentCoordinate(assignedCoordinate, start.y, "horizontal", pointIndex, points.length - 2, plan, index);
      start.y = y;
      end.y = y;
    } else if (Math.abs(start.x - end.x) <= EPSILON) {
      const x = clampEndpointSegmentCoordinate(assignedCoordinate, start.x, "vertical", pointIndex, points.length - 2, plan, index);
      start.x = x;
      end.x = x;
    }
  }

  return buildRoute(points, route.style);
}

function segmentIntersectsBox(
  start: Point,
  end: Point,
  box: ScenarioFlowBox,
  options: { ignoreStart?: boolean; ignoreEnd?: boolean } = {}
): boolean {
  if (Math.abs(start.x - end.x) <= EPSILON) {
    const x = start.x;
    if (x <= box.x + EPSILON || x >= box.x + box.width - EPSILON) {
      return false;
    }
    const low = Math.min(start.y, end.y);
    const high = Math.max(start.y, end.y);
    const clippedLow = options.ignoreStart ? low + EPSILON : low;
    const clippedHigh = options.ignoreEnd ? high - EPSILON : high;
    return clippedLow < box.y + box.height - EPSILON && clippedHigh > box.y + EPSILON;
  }

  if (Math.abs(start.y - end.y) <= EPSILON) {
    const y = start.y;
    if (y <= box.y + EPSILON || y >= box.y + box.height - EPSILON) {
      return false;
    }
    const low = Math.min(start.x, end.x);
    const high = Math.max(start.x, end.x);
    const clippedLow = options.ignoreStart ? low + EPSILON : low;
    const clippedHigh = options.ignoreEnd ? high - EPSILON : high;
    return clippedLow < box.x + box.width - EPSILON && clippedHigh > box.x + EPSILON;
  }

  return false;
}

function collectIntersectingBoxes(
  points: readonly Point[],
  boxes: readonly ScenarioFlowBox[]
): ScenarioFlowBox[] {
  const intersections: ScenarioFlowBox[] = [];

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1]!;
    const end = points[index]!;
    for (const box of boxes) {
      if (segmentIntersectsBox(start, end, box, {
        ignoreStart: index === 1,
        ignoreEnd: index === points.length - 1
      })) {
        intersections.push(box);
      }
    }
  }

  return intersections;
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
  routeSegmentIndex: number,
  swerveMetadata?: ScenarioFlowSwerveMetadata
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
    ownershipRank: 1,
    ...swerveMetadata
  };
}

function appendRoutePoint(points: Point[], point: Point): void {
  const rounded = {
    x: roundMetric(point.x),
    y: roundMetric(point.y)
  };
  const previous = points.at(-1);
  if (previous && Math.abs(previous.x - rounded.x) <= EPSILON && Math.abs(previous.y - rounded.y) <= EPSILON) {
    return;
  }
  points.push(rounded);
}

function getNonEndpointBoxes(
  plan: ScenarioFlowConnectorPlan,
  index: ScenarioFlowPositionedIndex
): ScenarioFlowBox[] {
  return index.nodeBoxes.filter((box) => box.itemId !== plan.from && box.itemId !== plan.to);
}

function findIntersectingBoxesAlongSegment(
  start: Point,
  end: Point,
  boxes: readonly ScenarioFlowBox[]
): ScenarioFlowBox[] {
  const intersections = boxes.filter((box) => segmentIntersectsBox(start, end, box, {
    ignoreStart: true,
    ignoreEnd: true
  }));

  if (Math.abs(start.x - end.x) <= EPSILON) {
    const direction = start.y <= end.y ? 1 : -1;
    return intersections.sort((left, right) => {
      const leftMetric = direction > 0 ? left.y : left.y + left.height;
      const rightMetric = direction > 0 ? right.y : right.y + right.height;
      return direction > 0 ? leftMetric - rightMetric : rightMetric - leftMetric;
    });
  }

  const direction = start.x <= end.x ? 1 : -1;
  return intersections.sort((left, right) => {
    const leftMetric = direction > 0 ? left.x : left.x + left.width;
    const rightMetric = direction > 0 ? right.x : right.x + right.width;
    return direction > 0 ? leftMetric - rightMetric : rightMetric - leftMetric;
  });
}

function getObstacleLocalOwnershipCount(
  bucketsByNodeId: ReadonlyMap<string, ScenarioFlowNodeEdgeBuckets>,
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

function resolveVerticalBridgeX(
  baseX: number,
  plan: ScenarioFlowConnectorPlan,
  index: ScenarioFlowPositionedIndex,
  pointsBuilder: (bridgeX: number) => Point[]
): number {
  let bridgeX = baseX;

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const boxes = collectIntersectingBoxes(pointsBuilder(bridgeX), getNonEndpointBoxes(plan, index));
    if (boxes.length === 0) {
      return bridgeX;
    }

    bridgeX = roundMetric(Math.max(
      bridgeX + FIXED_SEPARATION_DISTANCE,
      ...boxes.map((box) => box.x + box.width + FIXED_SEPARATION_DISTANCE)
    ));
  }

  return bridgeX;
}

function resolveHorizontalBridgeY(
  baseY: number,
  plan: ScenarioFlowConnectorPlan,
  index: ScenarioFlowPositionedIndex,
  pointsBuilder: (bridgeY: number) => Point[]
): number {
  let bridgeY = baseY;

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const boxes = collectIntersectingBoxes(pointsBuilder(bridgeY), getNonEndpointBoxes(plan, index));
    if (boxes.length === 0) {
      return bridgeY;
    }

    bridgeY = roundMetric(Math.max(
      bridgeY + FIXED_SEPARATION_DISTANCE,
      ...boxes.map((box) => box.y + box.height + FIXED_SEPARATION_DISTANCE)
    ));
  }

  return bridgeY;
}

function resolveLocalVerticalDetourX(
  originalX: number,
  encounterY: number,
  exitY: number,
  obstacle: ScenarioFlowBox,
  plan: ScenarioFlowConnectorPlan,
  index: ScenarioFlowPositionedIndex
): number {
  const baseX = roundMetric(Math.max(
    originalX + FIXED_SEPARATION_DISTANCE,
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
    ]
  );
}

function resolveVerticalSwerveReturnX(
  originalX: number,
  ownershipCount: number,
  plan: ScenarioFlowConnectorPlan,
  index: ScenarioFlowPositionedIndex
): number {
  if (plan.pattern !== "realization_vertical" || ownershipCount <= 0) {
    return originalX;
  }

  const source = index.nodeById.get(plan.from);
  const target = index.nodeById.get(plan.to);
  const overlap = source && target ? getHorizontalOverlap(source.node, target.node) : undefined;
  if (!overlap) {
    return originalX;
  }

  const offset = ownershipCount * FIXED_SEPARATION_DISTANCE;
  const leftCandidate = roundMetric(clampMetric(originalX - offset, overlap.left, overlap.right));
  if (Math.abs(leftCandidate - originalX) >= FIXED_SEPARATION_DISTANCE - EPSILON) {
    return leftCandidate;
  }

  const rightCandidate = roundMetric(clampMetric(originalX + offset, overlap.left, overlap.right));
  if (Math.abs(rightCandidate - originalX) >= FIXED_SEPARATION_DISTANCE - EPSILON) {
    return rightCandidate;
  }

  return originalX;
}

function resolveLocalHorizontalDetourY(
  originalY: number,
  encounterX: number,
  exitX: number,
  obstacle: ScenarioFlowBox,
  plan: ScenarioFlowConnectorPlan,
  index: ScenarioFlowPositionedIndex
): number {
  const baseY = roundMetric(Math.max(
    originalY + FIXED_SEPARATION_DISTANCE,
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
    ]
  );
}

function buildVerticalSwerveGroupId(
  plan: ScenarioFlowConnectorPlan,
  start: Point,
  end: Point,
  obstacles: readonly ScenarioFlowBox[]
): string {
  return [
    plan.id,
    "vertical",
    roundMetric(start.x),
    roundMetric(start.y),
    roundMetric(end.y),
    obstacles.map((obstacle) => obstacle.itemId).join(",")
  ].join(":");
}

function buildVerticalSwerveMetadata(
  plan: ScenarioFlowConnectorPlan,
  start: Point,
  end: Point,
  obstacles: readonly ScenarioFlowBox[]
): ScenarioFlowSwerveMetadata {
  const direction = start.y <= end.y ? 1 : -1;
  const first = obstacles[0]!;
  const traversalStart = direction > 0
    ? roundMetric(first.y - start.y)
    : roundMetric(start.y - (first.y + first.height));
  return {
    swerveGroupId: buildVerticalSwerveGroupId(plan, start, end, obstacles),
    swerveBlockerCount: obstacles.length,
    swerveTraversalStart: traversalStart,
    swerveSpanStart: roundMetric(Math.min(...obstacles.map((obstacle) => obstacle.y))),
    swerveSpanEnd: roundMetric(Math.max(...obstacles.map((obstacle) => obstacle.y + obstacle.height)))
  };
}

function buildWideVerticalSegmentWithLocalSwerve(
  start: Point,
  end: Point,
  obstacles: readonly ScenarioFlowBox[],
  plan: ScenarioFlowConnectorPlan,
  index: ScenarioFlowPositionedIndex
): {
  points: Point[];
  occupancy: ScenarioFlowGutterOccupancy[];
} {
  const points: Point[] = [start];
  const occupancy: ScenarioFlowGutterOccupancy[] = [];
  const direction = start.y <= end.y ? 1 : -1;
  const firstObstacle = obstacles[0]!;
  const lastObstacle = obstacles[obstacles.length - 1]!;
  const rawEncounterY = roundMetric(
    direction > 0
      ? firstObstacle.y - OBSTACLE_SWERVE_CLEARANCE
      : firstObstacle.y + firstObstacle.height + OBSTACLE_SWERVE_CLEARANCE
  );
  const encounterY = direction > 0
    ? roundMetric(clampMetric(rawEncounterY, start.y, firstObstacle.y - EPSILON))
    : roundMetric(clampMetric(rawEncounterY, firstObstacle.y + firstObstacle.height + EPSILON, start.y));
  const rawExitY = roundMetric(
    direction > 0
      ? lastObstacle.y + lastObstacle.height + OBSTACLE_SWERVE_CLEARANCE
      : lastObstacle.y - OBSTACLE_SWERVE_CLEARANCE
  );
  const exitY = direction > 0
    ? roundMetric(Math.max(encounterY + EPSILON, rawExitY))
    : roundMetric(Math.min(encounterY - EPSILON, rawExitY));
  const baseBridgeX = roundMetric(Math.max(
    start.x + FIXED_SEPARATION_DISTANCE,
    ...obstacles.map((obstacle) => obstacle.x + obstacle.width + OBSTACLE_SWERVE_CLEARANCE)
  ));
  const bridgeX = resolveVerticalBridgeX(
    baseBridgeX,
    plan,
    index,
    (candidateBridgeX) => [
      { x: start.x, y: encounterY },
      { x: candidateBridgeX, y: encounterY },
      { x: candidateBridgeX, y: exitY },
      { x: start.x, y: exitY }
    ]
  );
  const metadata = buildVerticalSwerveMetadata(plan, start, end, obstacles);

  appendRoutePoint(points, { x: start.x, y: encounterY });
  const encounterSegmentIndex = Math.max(0, points.length - 1);
  appendRoutePoint(points, { x: bridgeX, y: encounterY });
  const detourSegmentIndex = Math.max(0, points.length - 1);
  appendRoutePoint(points, { x: bridgeX, y: exitY });
  const exitSegmentIndex = Math.max(0, points.length - 1);
  appendRoutePoint(points, { x: start.x, y: exitY });
  appendRoutePoint(points, { x: start.x, y: end.y });

  occupancy.push(buildObstacleOccupancy(
    plan.id,
    firstObstacle,
    direction > 0 ? "north" : "south",
    "horizontal",
    encounterY,
    start.x,
    bridgeX,
    encounterSegmentIndex,
    metadata
  ));
  for (const obstacle of obstacles) {
    occupancy.push(buildObstacleOccupancy(
      plan.id,
      obstacle,
      bridgeX < obstacle.x ? "west" : "east",
      "vertical",
      bridgeX,
      encounterY,
      exitY,
      detourSegmentIndex,
      metadata
    ));
  }
  occupancy.push(buildObstacleOccupancy(
    plan.id,
    lastObstacle,
    direction > 0 ? "south" : "north",
    "horizontal",
    exitY,
    start.x,
    bridgeX,
    exitSegmentIndex,
    metadata
  ));

  return { points, occupancy };
}

function buildVerticalSegmentWithLocalSwerves(
  start: Point,
  end: Point,
  plan: ScenarioFlowConnectorPlan,
  index: ScenarioFlowPositionedIndex,
  bucketsByNodeId: ReadonlyMap<string, ScenarioFlowNodeEdgeBuckets>
): {
  points: Point[];
  occupancy: ScenarioFlowGutterOccupancy[];
} {
  const points: Point[] = [start];
  const occupancy: ScenarioFlowGutterOccupancy[] = [];
  const direction = start.y <= end.y ? 1 : -1;
  const nonEndpointBoxes = getNonEndpointBoxes(plan, index);

  if (plan.pattern === "realization_vertical") {
    const directObstacles = findIntersectingBoxesAlongSegment(start, end, nonEndpointBoxes);
    if (directObstacles.length > 1) {
      return buildWideVerticalSegmentWithLocalSwerve(start, end, directObstacles, plan, index);
    }
  }

  let cursor = start;

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const projectedEnd = { x: cursor.x, y: end.y };
    const obstacle = findIntersectingBoxesAlongSegment(cursor, projectedEnd, nonEndpointBoxes)[0];
    if (!obstacle) {
      appendRoutePoint(points, projectedEnd);
      return { points, occupancy };
    }

    const rawEncounterY = roundMetric(
      direction > 0
        ? obstacle.y - OBSTACLE_SWERVE_CLEARANCE
        : obstacle.y + obstacle.height + OBSTACLE_SWERVE_CLEARANCE
    );
    const encounterY = direction > 0
      ? roundMetric(clampMetric(rawEncounterY, cursor.y, obstacle.y - EPSILON))
      : roundMetric(clampMetric(rawEncounterY, obstacle.y + obstacle.height + EPSILON, cursor.y));
    const exitY = roundMetric(
      direction > 0
        ? obstacle.y + obstacle.height + OBSTACLE_SWERVE_CLEARANCE
        : obstacle.y - OBSTACLE_SWERVE_CLEARANCE
    );
    const bridgeX = resolveLocalVerticalDetourX(cursor.x, encounterY, exitY, obstacle, plan, index);
    const returnX = resolveVerticalSwerveReturnX(cursor.x, 0, plan, index);
    const swerveMetadata = plan.pattern === "realization_vertical"
      ? buildVerticalSwerveMetadata(plan, cursor, projectedEnd, [obstacle])
      : undefined;

    appendRoutePoint(points, { x: cursor.x, y: encounterY });
    const encounterSegmentIndex = Math.max(0, points.length - 1);
    appendRoutePoint(points, { x: bridgeX, y: encounterY });
    const detourSegmentIndex = Math.max(0, points.length - 1);
    appendRoutePoint(points, { x: bridgeX, y: exitY });
    const exitSegmentIndex = Math.max(0, points.length - 1);
    appendRoutePoint(points, { x: returnX, y: exitY });
    occupancy.push(buildObstacleOccupancy(
      plan.id,
      obstacle,
      direction > 0 ? "north" : "south",
      "horizontal",
      encounterY,
      cursor.x,
      bridgeX,
      encounterSegmentIndex,
      swerveMetadata
    ));
    occupancy.push(buildObstacleOccupancy(
      plan.id,
      obstacle,
      bridgeX < obstacle.x ? "west" : "east",
      "vertical",
      bridgeX,
      encounterY,
      exitY,
      detourSegmentIndex,
      swerveMetadata
    ));
    occupancy.push(buildObstacleOccupancy(
      plan.id,
      obstacle,
      direction > 0 ? "south" : "north",
      "horizontal",
      exitY,
      returnX,
      bridgeX,
      exitSegmentIndex,
      swerveMetadata
    ));

    cursor = {
      x: returnX,
      y: exitY
    };
  }

  appendRoutePoint(points, { x: cursor.x, y: end.y });
  return { points, occupancy };
}

function buildHorizontalSegmentWithLocalSwerves(
  start: Point,
  end: Point,
  plan: ScenarioFlowConnectorPlan,
  index: ScenarioFlowPositionedIndex,
  bucketsByNodeId: ReadonlyMap<string, ScenarioFlowNodeEdgeBuckets>
): {
  points: Point[];
  occupancy: ScenarioFlowGutterOccupancy[];
} {
  const points: Point[] = [start];
  const occupancy: ScenarioFlowGutterOccupancy[] = [];
  const movingRight = start.x <= end.x;
  let cursor = start;

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const obstacle = findIntersectingBoxesAlongSegment(cursor, end, getNonEndpointBoxes(plan, index))[0];
    if (!obstacle) {
      appendRoutePoint(points, end);
      return { points, occupancy };
    }

    const rawEncounterX = roundMetric(
      movingRight
        ? obstacle.x - OBSTACLE_SWERVE_CLEARANCE
        : obstacle.x + obstacle.width + OBSTACLE_SWERVE_CLEARANCE
    );
    const encounterX = movingRight
      ? roundMetric(clampMetric(rawEncounterX, cursor.x, obstacle.x - EPSILON))
      : roundMetric(clampMetric(rawEncounterX, obstacle.x + obstacle.width + EPSILON, cursor.x));
    const exitX = roundMetric(
      movingRight
        ? obstacle.x + obstacle.width + OBSTACLE_SWERVE_CLEARANCE
        : obstacle.x - OBSTACLE_SWERVE_CLEARANCE
    );
    const bridgeY = resolveLocalHorizontalDetourY(cursor.y, encounterX, exitX, obstacle, plan, index);

    appendRoutePoint(points, { x: encounterX, y: cursor.y });
    const encounterSegmentIndex = Math.max(0, points.length - 1);
    appendRoutePoint(points, { x: encounterX, y: bridgeY });
    const detourSegmentIndex = Math.max(0, points.length - 1);
    appendRoutePoint(points, { x: exitX, y: bridgeY });
    const exitSegmentIndex = Math.max(0, points.length - 1);
    appendRoutePoint(points, { x: exitX, y: cursor.y });
    occupancy.push(buildObstacleOccupancy(
      plan.id,
      obstacle,
      movingRight ? "west" : "east",
      "vertical",
      encounterX,
      cursor.y,
      bridgeY,
      encounterSegmentIndex
    ));
    occupancy.push(buildObstacleOccupancy(
      plan.id,
      obstacle,
      bridgeY < obstacle.y ? "north" : "south",
      "horizontal",
      bridgeY,
      encounterX,
      exitX,
      detourSegmentIndex
    ));
    occupancy.push(buildObstacleOccupancy(
      plan.id,
      obstacle,
      movingRight ? "east" : "west",
      "vertical",
      exitX,
      cursor.y,
      bridgeY,
      exitSegmentIndex
    ));

    cursor = {
      x: exitX,
      y: cursor.y
    };
  }

  appendRoutePoint(points, end);
  return { points, occupancy };
}

function updateSegmentCoordinate(
  occupancy: ScenarioFlowGutterOccupancy,
  route: PositionedRoute
): ScenarioFlowGutterOccupancy {
  const start = route.points[occupancy.routeSegmentIndex];
  const end = route.points[occupancy.routeSegmentIndex + 1];
  if (!start || !end) {
    return occupancy;
  }
  const horizontal = Math.abs(start.y - end.y) <= EPSILON;
  const vertical = Math.abs(start.x - end.x) <= EPSILON;
  if (!horizontal && !vertical) {
    return occupancy;
  }
  return {
    ...occupancy,
    nominalCoordinate: roundMetric(horizontal ? start.y : start.x),
    spanStart: roundMetric(horizontal ? Math.min(start.x, end.x) : Math.min(start.y, end.y)),
    spanEnd: roundMetric(horizontal ? Math.max(start.x, end.x) : Math.max(start.y, end.y))
  };
}

function refineRouteAgainstObstacles(
  route: PositionedRoute,
  plan: ScenarioFlowConnectorPlan,
  index: ScenarioFlowPositionedIndex,
  bucketsByNodeId: ReadonlyMap<string, ScenarioFlowNodeEdgeBuckets>
): {
  route: PositionedRoute;
  occupancy: ScenarioFlowGutterOccupancy[];
} {
  const points: Point[] = [];
  const occupancy: ScenarioFlowGutterOccupancy[] = [];

  for (let indexPoint = 1; indexPoint < route.points.length; indexPoint += 1) {
    const start = route.points[indexPoint - 1]!;
    const end = route.points[indexPoint]!;
    const offset = points.length === 0 ? 0 : points.length - 1;
    const refined = Math.abs(start.x - end.x) <= EPSILON
      ? buildVerticalSegmentWithLocalSwerves(start, end, plan, index, bucketsByNodeId)
      : buildHorizontalSegmentWithLocalSwerves(start, end, plan, index, bucketsByNodeId);

    if (points.length === 0) {
      points.push(...refined.points);
    } else {
      points.push(...refined.points.slice(1));
    }
    occupancy.push(...refined.occupancy.map((entry) => ({
      ...entry,
      routeSegmentIndex: entry.routeSegmentIndex + offset
    })));
  }

  const refinedRoute = buildRoute(points, route.style);
  return {
    route: refinedRoute,
    occupancy: occupancy.map((entry) => updateSegmentCoordinate(entry, refinedRoute))
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

function buildEndpointOccupancy(
  plan: ScenarioFlowConnectorPlan,
  endpointRole: EndpointRole,
  segmentIndex: number,
  axis: ScenarioFlowGutterAxis,
  nominalCoordinate: number,
  spanStart: number,
  spanEnd: number,
  cell?: IndexedScenarioFlowCell,
  locked = false
): ScenarioFlowGutterOccupancy {
  const sourceEndpoint = endpointRole === "source";
  const nodeId = sourceEndpoint ? plan.from : plan.to;
  const side = sourceEndpoint ? plan.sourceSide : plan.targetSide;
  const nodeRight = sourceEndpoint && side === "east";
  const nodeBottom = sourceEndpoint && side === "south";
  return {
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
    ownershipRank: 0,
    locked
  };
}

function buildEndpointOccupancyForRoute(
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

    if (first && last) {
      occupancy.push(
        buildEndpointOccupancy(
          plan,
          "source",
          segmentIndex,
          axis,
          nominalCoordinate,
          spanStart,
          spanEnd,
          sourceCell,
          true
        ),
        buildEndpointOccupancy(
          plan,
          "target",
          segmentIndex,
          axis,
          nominalCoordinate,
          spanStart,
          spanEnd,
          targetCell,
          true
        )
      );
      continue;
    }

    if (first || last) {
      const endpointRole: EndpointRole = first ? "source" : "target";
      const cell = first ? sourceCell : targetCell;
      occupancy.push(buildEndpointOccupancy(
        plan,
        endpointRole,
        segmentIndex,
        axis,
        nominalCoordinate,
        spanStart,
        spanEnd,
        cell
      ));
      continue;
    }

    // Internal route segments are not automatically global gutter occupants.
    // They only claim global space when they intersect an explicit gutter rect.
  }

  return occupancy;
}

function buildGutterOccupancyForIntersection(
  connectorId: string,
  routeSegmentIndex: number,
  start: Point,
  end: Point,
  rect: ScenarioFlowGutterRect
): ScenarioFlowGutterOccupancy | undefined {
  const vertical = Math.abs(start.x - end.x) <= EPSILON;
  const horizontal = Math.abs(start.y - end.y) <= EPSILON;
  if (!vertical && !horizontal) {
    return undefined;
  }

  if (vertical) {
    const coordinate = roundMetric(start.x);
    if (coordinate < rect.x - EPSILON || coordinate > rect.x + rect.width + EPSILON) {
      return undefined;
    }
    const spanStart = roundMetric(Math.max(Math.min(start.y, end.y), rect.y));
    const spanEnd = roundMetric(Math.min(Math.max(start.y, end.y), rect.y + rect.height));
    if (spanEnd - spanStart <= EPSILON) {
      return undefined;
    }
    return {
      connectorId,
      key: rect.key,
      axis: "vertical",
      kind: rect.kind,
      nominalCoordinate: coordinate,
      spanStart,
      spanEnd,
      routeSegmentIndex,
      nodeId: rect.nodeId,
      columnOrder: rect.columnOrder,
      laneOrder: rect.laneOrder
    };
  }

  const coordinate = roundMetric(start.y);
  if (coordinate < rect.y - EPSILON || coordinate > rect.y + rect.height + EPSILON) {
    return undefined;
  }
  const spanStart = roundMetric(Math.max(Math.min(start.x, end.x), rect.x));
  const spanEnd = roundMetric(Math.min(Math.max(start.x, end.x), rect.x + rect.width));
  if (spanEnd - spanStart <= EPSILON) {
    return undefined;
  }
  return {
    connectorId,
    key: rect.key,
    axis: "horizontal",
    kind: rect.kind,
    nominalCoordinate: coordinate,
    spanStart,
    spanEnd,
    routeSegmentIndex,
    nodeId: rect.nodeId,
    columnOrder: rect.columnOrder,
    laneOrder: rect.laneOrder
  };
}

function buildRectBasedOccupancy(
  plan: ScenarioFlowConnectorPlan,
  route: PositionedRoute,
  gutterRects: readonly ScenarioFlowGutterRect[]
): ScenarioFlowGutterOccupancy[] {
  const occupancy: ScenarioFlowGutterOccupancy[] = [];

  for (let segmentIndex = 0; segmentIndex < route.points.length - 1; segmentIndex += 1) {
    const start = route.points[segmentIndex]!;
    const end = route.points[segmentIndex + 1]!;
    const endpointSegment = segmentIndex === 0 || segmentIndex === route.points.length - 2;
    for (const rect of gutterRects) {
      if (endpointSegment) {
        continue;
      }
      const entry = buildGutterOccupancyForIntersection(plan.id, segmentIndex, start, end, rect);
      if (entry) {
        occupancy.push(entry);
      }
    }
  }

  return occupancy;
}

function buildOccupancyDedupeKey(entry: ScenarioFlowGutterOccupancy): string {
  return [
    entry.connectorId,
    entry.key,
    entry.axis,
    entry.kind,
    entry.routeSegmentIndex,
    entry.nodeId ?? "",
    entry.endpointRole ?? "",
    entry.spanStart,
    entry.spanEnd
  ].join("|");
}

function dedupeOccupancy(entries: readonly ScenarioFlowGutterOccupancy[]): ScenarioFlowGutterOccupancy[] {
  const byKey = new Map<string, ScenarioFlowGutterOccupancy>();
  for (const entry of entries) {
    const key = buildOccupancyDedupeKey(entry);
    const existing = byKey.get(key);
    if (!existing || (entry.locked && !existing.locked)) {
      byKey.set(key, entry);
    }
  }
  return [...byKey.values()];
}

function buildOccupancyByConnector(
  plans: readonly ScenarioFlowConnectorPlan[],
  routeSelector: (plan: ScenarioFlowConnectorPlan) => PositionedRoute,
  gutterRects: readonly ScenarioFlowGutterRect[],
  index: ScenarioFlowPositionedIndex,
  extraOccupancyByConnector = new Map<string, ScenarioFlowGutterOccupancy[]>()
): {
  occupancy: ScenarioFlowGutterOccupancy[];
  occupancyByConnectorId: Map<string, ScenarioFlowGutterOccupancy[]>;
} {
  const occupancyByConnectorId = new Map<string, ScenarioFlowGutterOccupancy[]>();
  const occupancy: ScenarioFlowGutterOccupancy[] = [];

  for (const plan of plans) {
    const extraOccupancy = extraOccupancyByConnector.get(plan.id) ?? [];
    const obstacleSegmentIndexes = new Set(extraOccupancy
      .filter((entry) => isObstacleLocalKind(entry.kind))
      .map((entry) => entry.routeSegmentIndex));
    const connectorOccupancy = dedupeOccupancy([
      ...extraOccupancy,
      ...buildEndpointOccupancyForRoute(plan, routeSelector(plan), index),
      ...buildRectBasedOccupancy(plan, routeSelector(plan), gutterRects)
        .filter((entry) =>
          !(obstacleSegmentIndexes.has(entry.routeSegmentIndex) && (entry.kind === "column" || entry.kind === "lane"))
        )
    ]).sort((left, right) =>
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
  if (entry.locked) {
    return false;
  }
  return entry.kind === "column" || entry.kind === "lane";
}

function isLocallyResolvableOccupancy(entry: ScenarioFlowGutterOccupancy): boolean {
  if (entry.locked) {
    return false;
  }
  return (entry.kind === "node_bottom" && entry.endpointRole === undefined)
    || entry.kind === "column"
    || entry.kind === "lane";
}

function isObstacleLocalKind(kind: ScenarioFlowGutterKind): boolean {
  return kind === "obstacle_north"
    || kind === "obstacle_south"
    || kind === "obstacle_east"
    || kind === "obstacle_west";
}

function getObstacleSideFromKind(kind: ScenarioFlowGutterKind): PortSide | undefined {
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

function getObstacleLocalBaseCoordinate(box: ScenarioFlowBox, side: PortSide): number {
  switch (side) {
    case "north":
      return roundMetric(box.y - OBSTACLE_SWERVE_CLEARANCE);
    case "south":
      return roundMetric(box.y + box.height + OBSTACLE_SWERVE_CLEARANCE);
    case "east":
      return roundMetric(box.x + box.width + OBSTACLE_SWERVE_CLEARANCE);
    case "west":
      return roundMetric(box.x - OBSTACLE_SWERVE_CLEARANCE);
  }
}

function getOutwardDirectionForSide(side: PortSide): number {
  return side === "south" || side === "east" ? 1 : -1;
}

function rangesOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return Math.min(endA, endB) - Math.max(startA, startB) > EPSILON;
}

function resolvePreviousRowOrder(index: ScenarioFlowPositionedIndex, y: number): number | undefined {
  return [...index.rowBottomByOrder.entries()]
    .filter(([, bottom]) => bottom <= y + EPSILON)
    .sort(([leftOrder], [rightOrder]) => rightOrder - leftOrder)[0]?.[0];
}

function resolvePreviousColumnOrder(index: ScenarioFlowPositionedIndex, x: number): number | undefined {
  return [...index.columnRightByOrder.entries()]
    .filter(([, right]) => right <= x + EPSILON)
    .sort(([leftOrder], [rightOrder]) => rightOrder - leftOrder)[0]?.[0];
}

function recordRequiredExpansion(
  expansions: Record<number, number>,
  order: number | undefined,
  overflow: number
): void {
  if (order === undefined || overflow <= EPSILON) {
    return;
  }
  expansions[order] = roundUpToSeparationDistance(Math.max(expansions[order] ?? 0, overflow));
}

function collectObstacleCompactionOverflow(
  entry: ScenarioFlowGutterOccupancy,
  coordinate: number,
  box: ScenarioFlowBox,
  side: PortSide,
  index: ScenarioFlowPositionedIndex,
  requiredColumnExpansions: Record<number, number>,
  requiredLaneExpansions: Record<number, number>
): void {
  const cell = index.nodeById.get(box.itemId)?.cell;

  if (entry.axis === "horizontal") {
    const overlappingBoxes = index.nodeBoxes.filter((candidate) =>
      candidate.itemId !== box.itemId
      && rangesOverlap(entry.spanStart, entry.spanEnd, candidate.x, candidate.x + candidate.width)
    );

    if (side === "north") {
      const minAllowed = Math.max(
        -Infinity,
        ...overlappingBoxes
          .filter((candidate) => candidate.y + candidate.height <= box.y + EPSILON)
          .map((candidate) => candidate.y + candidate.height)
      );
      if (Number.isFinite(minAllowed) && coordinate < minAllowed - EPSILON) {
        recordRequiredExpansion(
          requiredLaneExpansions,
          resolvePreviousRowOrder(index, box.y),
          minAllowed - coordinate
        );
      }
    } else if (side === "south") {
      const maxAllowed = Math.min(
        Infinity,
        ...overlappingBoxes
          .filter((candidate) => candidate.y >= box.y + box.height - EPSILON)
          .map((candidate) => candidate.y)
      );
      if (Number.isFinite(maxAllowed) && coordinate > maxAllowed + EPSILON) {
        recordRequiredExpansion(requiredLaneExpansions, cell?.rowOrder, coordinate - maxAllowed);
      }
    }
  }

  if (entry.axis === "vertical") {
    const overlappingBoxes = index.nodeBoxes.filter((candidate) =>
      candidate.itemId !== box.itemId
      && rangesOverlap(entry.spanStart, entry.spanEnd, candidate.y, candidate.y + candidate.height)
    );

    if (side === "west") {
      const minAllowed = Math.max(
        -Infinity,
        ...overlappingBoxes
          .filter((candidate) => candidate.x + candidate.width <= box.x + EPSILON)
          .map((candidate) => candidate.x + candidate.width)
      );
      if (Number.isFinite(minAllowed) && coordinate < minAllowed - EPSILON) {
        recordRequiredExpansion(
          requiredColumnExpansions,
          resolvePreviousColumnOrder(index, box.x),
          minAllowed - coordinate
        );
      }
    } else if (side === "east") {
      const maxAllowed = Math.min(
        Infinity,
        ...overlappingBoxes
          .filter((candidate) => candidate.x >= box.x + box.width - EPSILON)
          .map((candidate) => candidate.x)
      );
      if (Number.isFinite(maxAllowed) && coordinate > maxAllowed + EPSILON) {
        recordRequiredExpansion(requiredColumnExpansions, cell?.columnOrder, coordinate - maxAllowed);
      }
    }
  }
}

interface ScenarioFlowObstacleLocalClaim {
  key: string;
  segmentKey: string;
  connectorId: string;
  routeSegmentIndex: number;
  axis: ScenarioFlowGutterAxis;
  entries: ScenarioFlowGutterOccupancy[];
}

interface ScenarioFlowObstacleLocalGroupClaim {
  claim: ScenarioFlowObstacleLocalClaim;
  entries: ScenarioFlowGutterOccupancy[];
  spanStart: number;
  spanEnd: number;
}

function buildObstacleLocalClaimKey(entry: ScenarioFlowGutterOccupancy): string {
  if (entry.swerveGroupId) {
    return [
      entry.connectorId,
      "swerve",
      entry.swerveGroupId,
      entry.axis,
      entry.routeSegmentIndex
    ].join(":");
  }
  return buildSegmentCoordinateKey(entry.connectorId, entry.routeSegmentIndex);
}

function getObstacleLocalClaimSpan(entries: readonly ScenarioFlowGutterOccupancy[]): {
  spanStart: number;
  spanEnd: number;
} {
  return {
    spanStart: roundMetric(Math.min(...entries.map((entry) => entry.spanStart))),
    spanEnd: roundMetric(Math.max(...entries.map((entry) => entry.spanEnd)))
  };
}

function getObstacleLocalClaimBlockerCount(claim: ScenarioFlowObstacleLocalClaim): number {
  return Math.max(1, ...claim.entries.map((entry) => entry.swerveBlockerCount ?? 1));
}

function getObstacleLocalClaimTraversalStart(claim: ScenarioFlowObstacleLocalClaim): number | undefined {
  const starts = claim.entries
    .map((entry) => entry.swerveTraversalStart)
    .filter((start): start is number => start !== undefined);
  return starts.length > 0 ? Math.min(...starts) : undefined;
}

function getObstacleLocalClaimClusterStart(claim: ScenarioFlowObstacleLocalClaim): number | undefined {
  const starts = claim.entries
    .map((entry) => entry.swerveSpanStart)
    .filter((start): start is number => start !== undefined);
  return starts.length > 0 ? Math.min(...starts) : undefined;
}

function hasObstacleLocalClaimSwerveMetadata(claim: ScenarioFlowObstacleLocalClaim): boolean {
  return claim.entries.some((entry) => entry.swerveGroupId !== undefined);
}

function resolveObstacleLocalClaimBaseCoordinate(
  claim: ScenarioFlowObstacleLocalClaim,
  boxById: ReadonlyMap<string, ScenarioFlowBox>,
  fallbackCoordinate: number
): number {
  const coordinates = claim.entries
    .map((entry) => {
      const side = getObstacleSideFromKind(entry.kind);
      const box = entry.nodeId ? boxById.get(entry.nodeId) : undefined;
      return side && box ? getObstacleLocalBaseCoordinate(box, side) : undefined;
    })
    .filter((coordinate): coordinate is number => coordinate !== undefined);

  if (coordinates.length === 0) {
    return fallbackCoordinate;
  }

  const firstSide = getObstacleSideFromKind(claim.entries[0]?.kind ?? "obstacle_east");
  const direction = firstSide ? getOutwardDirectionForSide(firstSide) : 1;
  return roundMetric(direction > 0 ? Math.max(...coordinates) : Math.min(...coordinates));
}

function compareObstacleLocalGroupClaims(
  left: ScenarioFlowObstacleLocalGroupClaim,
  right: ScenarioFlowObstacleLocalGroupClaim,
  planById: ReadonlyMap<string, ScenarioFlowConnectorPlan>,
  baseCoordinate: number
): number {
  const leftHasSwerve = hasObstacleLocalClaimSwerveMetadata(left.claim);
  const rightHasSwerve = hasObstacleLocalClaimSwerveMetadata(right.claim);

  if (leftHasSwerve || rightHasSwerve) {
    const blockerCountDelta = getObstacleLocalClaimBlockerCount(left.claim)
      - getObstacleLocalClaimBlockerCount(right.claim);
    if (blockerCountDelta !== 0) {
      return blockerCountDelta;
    }

    const leftTraversalStart = getObstacleLocalClaimTraversalStart(left.claim);
    const rightTraversalStart = getObstacleLocalClaimTraversalStart(right.claim);
    if (leftTraversalStart !== undefined && rightTraversalStart !== undefined) {
      const traversalDelta = rightTraversalStart - leftTraversalStart;
      if (Math.abs(traversalDelta) > EPSILON) {
        return traversalDelta;
      }
    } else if (leftTraversalStart !== undefined || rightTraversalStart !== undefined) {
      return leftTraversalStart !== undefined ? -1 : 1;
    }

    const leftClusterStart = getObstacleLocalClaimClusterStart(left.claim);
    const rightClusterStart = getObstacleLocalClaimClusterStart(right.claim);
    if (leftClusterStart !== undefined && rightClusterStart !== undefined) {
      const clusterDelta = rightClusterStart - leftClusterStart;
      if (Math.abs(clusterDelta) > EPSILON) {
        return clusterDelta;
      }
    } else if (leftClusterStart !== undefined || rightClusterStart !== undefined) {
      return leftClusterStart !== undefined ? -1 : 1;
    }
  } else {
    const leftDistance = Math.min(...left.entries.map((entry) => Math.abs(entry.nominalCoordinate - baseCoordinate)));
    const rightDistance = Math.min(...right.entries.map((entry) => Math.abs(entry.nominalCoordinate - baseCoordinate)));
    if (Math.abs(leftDistance - rightDistance) > EPSILON) {
      return leftDistance - rightDistance;
    }
  }

  const leftPlan = planById.get(left.claim.connectorId);
  const rightPlan = planById.get(right.claim.connectorId);
  if (leftPlan && rightPlan) {
    return compareConnectorPlans(leftPlan, rightPlan)
      || Math.min(...left.entries.map((entry) => entry.ownershipRank ?? 99))
        - Math.min(...right.entries.map((entry) => entry.ownershipRank ?? 99))
      || left.claim.routeSegmentIndex - right.claim.routeSegmentIndex
      || left.claim.key.localeCompare(right.claim.key);
  }

  return left.claim.connectorId.localeCompare(right.claim.connectorId)
    || Math.min(...left.entries.map((entry) => entry.ownershipRank ?? 99))
      - Math.min(...right.entries.map((entry) => entry.ownershipRank ?? 99))
    || left.claim.routeSegmentIndex - right.claim.routeSegmentIndex
    || left.claim.key.localeCompare(right.claim.key);
}

function buildObstacleLocalCompaction(
  plans: readonly ScenarioFlowConnectorPlan[],
  occupancy: readonly ScenarioFlowGutterOccupancy[],
  index: ScenarioFlowPositionedIndex
): {
  segmentCoordinateBySegmentKey: Map<string, number>;
  lockedSegmentKeys: Set<string>;
  requiredColumnExpansions: Record<number, number>;
  requiredLaneExpansions: Record<number, number>;
} {
  const planById = new Map(plans.map((plan) => [plan.id, plan] as const));
  const boxById = new Map(index.nodeBoxes.map((box) => [box.itemId, box] as const));
  const grouped = new Map<string, ScenarioFlowGutterOccupancy[]>();
  const claimByKey = new Map<string, ScenarioFlowObstacleLocalClaim>();
  const segmentCoordinateBySegmentKey = new Map<string, number>();
  const lockedSegmentKeys = new Set<string>();
  const coordinateByClaimKey = new Map<string, number>();
  const requiredColumnExpansions: Record<number, number> = {};
  const requiredLaneExpansions: Record<number, number> = {};

  for (const entry of occupancy) {
    if (!isObstacleLocalKind(entry.kind)) {
      continue;
    }
    const key = `${entry.key}|${entry.axis}`;
    const existing = grouped.get(key) ?? [];
    existing.push(entry);
    grouped.set(key, existing);

    const claimKey = buildObstacleLocalClaimKey(entry);
    const claim = claimByKey.get(claimKey) ?? {
      key: claimKey,
      segmentKey: buildSegmentCoordinateKey(entry.connectorId, entry.routeSegmentIndex),
      connectorId: entry.connectorId,
      routeSegmentIndex: entry.routeSegmentIndex,
      axis: entry.axis,
      entries: []
    };
    claim.entries.push(entry);
    claimByKey.set(claimKey, claim);
  }

  grouped.forEach((group) => {
    const first = group[0];
    if (!first?.nodeId) {
      return;
    }
    const side = getObstacleSideFromKind(first.kind);
    const box = boxById.get(first.nodeId);
    if (!side || !box) {
      return;
    }

    const baseCoordinate = getObstacleLocalBaseCoordinate(box, side);
    const direction = getOutwardDirectionForSide(side);
    const groupClaimByKey = new Map<string, ScenarioFlowObstacleLocalGroupClaim>();
    for (const entry of group) {
      const claim = claimByKey.get(buildObstacleLocalClaimKey(entry));
      if (!claim) {
        continue;
      }
      const groupClaim = groupClaimByKey.get(claim.key) ?? {
        claim,
        entries: [],
        spanStart: 0,
        spanEnd: 0
      };
      groupClaim.entries.push(entry);
      const span = getObstacleLocalClaimSpan(groupClaim.entries);
      groupClaim.spanStart = span.spanStart;
      groupClaim.spanEnd = span.spanEnd;
      groupClaimByKey.set(claim.key, groupClaim);
    }

    const occupied: Array<{
      claim: ScenarioFlowObstacleLocalGroupClaim;
      coordinate: number;
    }> = [];
    const sorted = [...groupClaimByKey.values()]
      .sort((left, right) => compareObstacleLocalGroupClaims(left, right, planById, baseCoordinate));

    for (const groupClaim of sorted) {
      let coordinate = resolveObstacleLocalClaimBaseCoordinate(groupClaim.claim, boxById, baseCoordinate);
      for (const occupiedEntry of occupied) {
        if (!spansTouchOrOverlap(
          groupClaim.spanStart,
          groupClaim.spanEnd,
          occupiedEntry.claim.spanStart,
          occupiedEntry.claim.spanEnd
        )) {
          continue;
        }
        if (direction > 0) {
          coordinate = Math.max(coordinate, occupiedEntry.coordinate + FIXED_SEPARATION_DISTANCE);
        } else {
          coordinate = Math.min(coordinate, occupiedEntry.coordinate - FIXED_SEPARATION_DISTANCE);
        }
      }
      coordinate = roundMetric(coordinate);
      const existing = coordinateByClaimKey.get(groupClaim.claim.key);
      const resolvedCoordinate = existing === undefined
        ? coordinate
        : direction > 0
          ? Math.max(existing, coordinate)
          : Math.min(existing, coordinate);
      coordinateByClaimKey.set(groupClaim.claim.key, roundMetric(resolvedCoordinate));
      occupied.push({ claim: groupClaim, coordinate: roundMetric(resolvedCoordinate) });
      occupied.sort((left, right) => left.coordinate - right.coordinate);
    }
  });

  for (const claim of claimByKey.values()) {
    const coordinate = coordinateByClaimKey.get(claim.key);
    if (coordinate === undefined) {
      continue;
    }
    segmentCoordinateBySegmentKey.set(claim.segmentKey, coordinate);
    lockedSegmentKeys.add(claim.segmentKey);
    for (const entry of claim.entries) {
      if (!entry.nodeId) {
        continue;
      }
      const side = getObstacleSideFromKind(entry.kind);
      const box = boxById.get(entry.nodeId);
      if (!side || !box) {
        continue;
      }
      collectObstacleCompactionOverflow(
        entry,
        coordinate,
        box,
        side,
        index,
        requiredColumnExpansions,
        requiredLaneExpansions
      );
    }
  }

  return {
    segmentCoordinateBySegmentKey,
    lockedSegmentKeys,
    requiredColumnExpansions,
    requiredLaneExpansions
  };
}

function applyObstacleLocalCompaction(
  plans: readonly ScenarioFlowConnectorPlan[],
  obstacleOccupancyByConnectorId: Map<string, ScenarioFlowGutterOccupancy[]>,
  index: ScenarioFlowPositionedIndex,
  routeSelector: (plan: ScenarioFlowConnectorPlan) => PositionedRoute,
  routeSetter: (plan: ScenarioFlowConnectorPlan, route: PositionedRoute) => void
): {
  requiredColumnExpansions: Record<number, number>;
  requiredLaneExpansions: Record<number, number>;
} {
  const occupancy = [...obstacleOccupancyByConnectorId.values()].flat();
  const compaction = buildObstacleLocalCompaction(plans, occupancy, index);
  if (compaction.segmentCoordinateBySegmentKey.size === 0) {
    return {
      requiredColumnExpansions: compaction.requiredColumnExpansions,
      requiredLaneExpansions: compaction.requiredLaneExpansions
    };
  }

  for (const plan of plans) {
    const compactedRoute = applySegmentCoordinates(
      routeSelector(plan),
      plan.id,
      compaction.segmentCoordinateBySegmentKey,
      plan,
      index
    );
    routeSetter(plan, compactedRoute);
    obstacleOccupancyByConnectorId.set(
      plan.id,
      (obstacleOccupancyByConnectorId.get(plan.id) ?? []).map((entry) => ({
        ...updateSegmentCoordinate(entry, compactedRoute),
        locked: compaction.lockedSegmentKeys.has(buildSegmentCoordinateKey(entry.connectorId, entry.routeSegmentIndex))
      }))
    );
  }

  return {
    requiredColumnExpansions: compaction.requiredColumnExpansions,
    requiredLaneExpansions: compaction.requiredLaneExpansions
  };
}

function isBundleLocalOccupancy(entry: ScenarioFlowGutterOccupancy): boolean {
  return entry.kind === "node_bottom" && entry.axis === "horizontal" && entry.endpointRole === undefined;
}

function resolveObstacleBoundaryClampCoordinates(
  occupancy: readonly ScenarioFlowGutterOccupancy[],
  index: ScenarioFlowPositionedIndex
): Map<string, number> {
  const coordinateBySegmentKey = new Map<string, number>();
  const boxById = new Map(index.nodeBoxes.map((box) => [box.itemId, box] as const));

  for (const entry of occupancy) {
    if (!isObstacleLocalKind(entry.kind) || !entry.nodeId) {
      continue;
    }
    const side = getObstacleSideFromKind(entry.kind);
    const box = boxById.get(entry.nodeId);
    if (!side || !box) {
      continue;
    }

    if (side === "north" && entry.axis === "horizontal" && entry.nominalCoordinate > box.y - EPSILON) {
      coordinateBySegmentKey.set(
        buildSegmentCoordinateKey(entry.connectorId, entry.routeSegmentIndex),
        getObstacleLocalBaseCoordinate(box, side)
      );
    } else if (side === "south" && entry.axis === "horizontal" && entry.nominalCoordinate < box.y + box.height + EPSILON) {
      coordinateBySegmentKey.set(
        buildSegmentCoordinateKey(entry.connectorId, entry.routeSegmentIndex),
        getObstacleLocalBaseCoordinate(box, side)
      );
    } else if (side === "west" && entry.axis === "vertical" && entry.nominalCoordinate > box.x - EPSILON) {
      coordinateBySegmentKey.set(
        buildSegmentCoordinateKey(entry.connectorId, entry.routeSegmentIndex),
        getObstacleLocalBaseCoordinate(box, side)
      );
    } else if (side === "east" && entry.axis === "vertical" && entry.nominalCoordinate < box.x + box.width + EPSILON) {
      coordinateBySegmentKey.set(
        buildSegmentCoordinateKey(entry.connectorId, entry.routeSegmentIndex),
        getObstacleLocalBaseCoordinate(box, side)
      );
    }
  }

  return coordinateBySegmentKey;
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
    if (!isLocallyResolvableOccupancy(entry)) {
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
    if (entry.locked || entry.kind !== "column" || entry.axis !== "vertical" || entry.columnOrder === undefined) {
      continue;
    }
    const nextColumnLeft = getNextValue(index.columnLeftByOrder, entry.columnOrder);
    if (nextColumnLeft === undefined) {
      continue;
    }
    const coordinate = coordinateBySegmentKey.get(buildSegmentCoordinateKey(entry.connectorId, entry.routeSegmentIndex))
      ?? entry.nominalCoordinate;
    const overflow = roundMetric(coordinate - (nextColumnLeft - GUTTER_OVERFLOW_TOLERANCE));
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
    if (entry.locked || entry.kind !== "lane" || entry.axis !== "horizontal" || entry.laneOrder === undefined) {
      continue;
    }
    const nextRowTop = getNextValue(index.rowTopByOrder, entry.laneOrder);
    if (nextRowTop === undefined) {
      continue;
    }
    const coordinate = coordinateBySegmentKey.get(buildSegmentCoordinateKey(entry.connectorId, entry.routeSegmentIndex))
      ?? entry.nominalCoordinate;
    const overflow = roundMetric(coordinate - (nextRowTop - GUTTER_OVERFLOW_TOLERANCE));
    if (overflow > 0) {
      required[entry.laneOrder] = roundUpToSeparationDistance(Math.max(required[entry.laneOrder] ?? 0, overflow));
    }
  }

  return required;
}

function resolveRequiredLocalSegmentSeparationExpansions(
  occupancy: readonly ScenarioFlowGutterOccupancy[],
  index: ScenarioFlowPositionedIndex
): {
  columnExpansions: Record<number, number>;
  laneExpansions: Record<number, number>;
} {
  const columnExpansions: Record<number, number> = {};
  const laneExpansions: Record<number, number> = {};
  const localOccupancy = occupancy.filter((entry) => isObstacleLocalKind(entry.kind));

  for (let leftIndex = 0; leftIndex < localOccupancy.length; leftIndex += 1) {
    const left = localOccupancy[leftIndex]!;
    for (let rightIndex = leftIndex + 1; rightIndex < localOccupancy.length; rightIndex += 1) {
      const right = localOccupancy[rightIndex]!;
      if (
        left.connectorId === right.connectorId
        || left.axis !== right.axis
        || !spansTouchOrOverlap(left.spanStart, left.spanEnd, right.spanStart, right.spanEnd)
      ) {
        continue;
      }

      const distance = Math.abs(left.nominalCoordinate - right.nominalCoordinate);
      const overflow = roundMetric(FIXED_SEPARATION_DISTANCE - distance);
      if (overflow <= EPSILON) {
        continue;
      }

      if (left.axis === "horizontal") {
        const laneOrder = resolveLaneOrderForY(
          index,
          Math.max(left.nominalCoordinate, right.nominalCoordinate),
          left.laneOrder ?? right.laneOrder ?? 0
        );
        recordRequiredExpansion(laneExpansions, laneOrder, overflow);
      } else {
        const columnOrder = resolveColumnOrderForX(
          index,
          Math.max(left.nominalCoordinate, right.nominalCoordinate),
          left.columnOrder ?? right.columnOrder ?? 0
        );
        recordRequiredExpansion(columnExpansions, columnOrder, overflow);
      }
    }
  }

  return { columnExpansions, laneExpansions };
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
  scene: PositionedScene,
  index: ScenarioFlowPositionedIndex,
  endpointOffsetsByNodeId: ReadonlyMap<string, Map<PortSide, Map<string, number>>>,
  bucketsByNodeId: ReadonlyMap<string, ScenarioFlowNodeEdgeBuckets>,
  globalGutterState: ScenarioFlowGlobalGutterState,
  segmentCoordinateByKey: ReadonlyMap<string, number> = new Map<string, number>()
): PreparedScenarioFlowRoutes {
  const plans: ScenarioFlowConnectorPlan[] = connectorPlans.map((plan) => ({
    ...plan,
    occupiedGutters: []
  }));
  const obstacleOccupancyByConnectorId = new Map<string, ScenarioFlowGutterOccupancy[]>();
  const gutterRects = buildGutterRects(scene, index, globalGutterState);

  for (const plan of plans) {
    plan.step2Route = buildTemplateRoute(plan, index, endpointOffsetsByNodeId);
    const refined = refineRouteAgainstObstacles(plan.step2Route, plan, index, bucketsByNodeId);
    plan.step3Route = refined.route;
    const finalRefined = segmentCoordinateByKey.size === 0
      ? refined
      : refineRouteAgainstObstacles(
        buildTemplateRoute(plan, index, endpointOffsetsByNodeId, segmentCoordinateByKey),
        plan,
        index,
        bucketsByNodeId
      );
    plan.finalRoute = applySegmentCoordinates(finalRefined.route, plan.id, segmentCoordinateByKey, plan, index);
    obstacleOccupancyByConnectorId.set(
      plan.id,
      finalRefined.occupancy.map((entry) => updateSegmentCoordinate(entry, plan.finalRoute))
    );
  }

  const obstacleCompaction = applyObstacleLocalCompaction(
    plans,
    obstacleOccupancyByConnectorId,
    index,
    (plan) => plan.finalRoute,
    (plan, route) => {
      plan.finalRoute = route;
    }
  );

  let occupancyResult = buildOccupancyByConnector(
    plans,
    (plan) => plan.finalRoute,
    gutterRects,
    index,
    obstacleOccupancyByConnectorId
  );
  const bundleLocalCoordinates = resolveOccupancyCoordinates(
    plans,
    occupancyResult.occupancy.filter(isBundleLocalOccupancy)
  );
  if (bundleLocalCoordinates.size > 0) {
    for (const plan of plans) {
      plan.finalRoute = applySegmentCoordinates(plan.finalRoute, plan.id, bundleLocalCoordinates, plan, index);
      obstacleOccupancyByConnectorId.set(
        plan.id,
        (obstacleOccupancyByConnectorId.get(plan.id) ?? [])
          .map((entry) => updateSegmentCoordinate(entry, plan.finalRoute))
      );
    }
    occupancyResult = buildOccupancyByConnector(
      plans,
      (plan) => plan.finalRoute,
      gutterRects,
      index,
      obstacleOccupancyByConnectorId
    );
  }
  const obstacleBoundaryCoordinates = resolveObstacleBoundaryClampCoordinates(occupancyResult.occupancy, index);
  if (obstacleBoundaryCoordinates.size > 0) {
    for (const plan of plans) {
      plan.finalRoute = applySegmentCoordinates(plan.finalRoute, plan.id, obstacleBoundaryCoordinates, plan, index);
      obstacleOccupancyByConnectorId.set(
        plan.id,
        (obstacleOccupancyByConnectorId.get(plan.id) ?? [])
          .map((entry) => updateSegmentCoordinate(entry, plan.finalRoute))
      );
    }
    occupancyResult = buildOccupancyByConnector(
      plans,
      (plan) => plan.finalRoute,
      gutterRects,
      index,
      obstacleOccupancyByConnectorId
    );
  }
  for (const plan of plans) {
    plan.occupiedGutters = occupancyResult.occupancyByConnectorId.get(plan.id) ?? [];
  }

  return {
    connectorPlans: plans,
    occupancy: occupancyResult.occupancy,
    occupancyByConnectorId: occupancyResult.occupancyByConnectorId,
    requiredColumnExpansions: obstacleCompaction.requiredColumnExpansions,
    requiredLaneExpansions: obstacleCompaction.requiredLaneExpansions
  };
}

function buildStep3Routes(
  connectorPlans: readonly ScenarioFlowConnectorPlan[],
  scene: PositionedScene,
  index: ScenarioFlowPositionedIndex,
  endpointOffsetsByNodeId: ReadonlyMap<string, Map<PortSide, Map<string, number>>>,
  bucketsByNodeId: ReadonlyMap<string, ScenarioFlowNodeEdgeBuckets>,
  globalGutterState: ScenarioFlowGlobalGutterState
): PreparedScenarioFlowRoutes {
  const plans: ScenarioFlowConnectorPlan[] = connectorPlans.map((plan) => ({
    ...plan,
    occupiedGutters: []
  }));
  const obstacleOccupancyByConnectorId = new Map<string, ScenarioFlowGutterOccupancy[]>();
  const gutterRects = buildGutterRects(scene, index, globalGutterState);

  for (const plan of plans) {
    plan.step2Route = buildTemplateRoute(plan, index, endpointOffsetsByNodeId);
    const refined = refineRouteAgainstObstacles(plan.step2Route, plan, index, bucketsByNodeId);
    plan.step3Route = refined.route;
    plan.finalRoute = refined.route;
    obstacleOccupancyByConnectorId.set(plan.id, refined.occupancy);
  }

  const obstacleCompaction = applyObstacleLocalCompaction(
    plans,
    obstacleOccupancyByConnectorId,
    index,
    (plan) => plan.step3Route,
    (plan, route) => {
      plan.step3Route = route;
      plan.finalRoute = route;
    }
  );

  let occupancyResult = buildOccupancyByConnector(
    plans,
    (plan) => plan.step3Route,
    gutterRects,
    index,
    obstacleOccupancyByConnectorId
  );
  const bundleLocalCoordinates = resolveOccupancyCoordinates(
    plans,
    occupancyResult.occupancy.filter(isBundleLocalOccupancy)
  );
  if (bundleLocalCoordinates.size > 0) {
    for (const plan of plans) {
      const route = applySegmentCoordinates(plan.step3Route, plan.id, bundleLocalCoordinates, plan, index);
      plan.step3Route = route;
      plan.finalRoute = route;
      obstacleOccupancyByConnectorId.set(
        plan.id,
        (obstacleOccupancyByConnectorId.get(plan.id) ?? [])
          .map((entry) => updateSegmentCoordinate(entry, route))
      );
    }
    occupancyResult = buildOccupancyByConnector(
      plans,
      (plan) => plan.step3Route,
      gutterRects,
      index,
      obstacleOccupancyByConnectorId
    );
  }
  const obstacleBoundaryCoordinates = resolveObstacleBoundaryClampCoordinates(occupancyResult.occupancy, index);
  if (obstacleBoundaryCoordinates.size > 0) {
    for (const plan of plans) {
      const route = applySegmentCoordinates(plan.step3Route, plan.id, obstacleBoundaryCoordinates, plan, index);
      plan.step3Route = route;
      plan.finalRoute = route;
      obstacleOccupancyByConnectorId.set(
        plan.id,
        (obstacleOccupancyByConnectorId.get(plan.id) ?? [])
          .map((entry) => updateSegmentCoordinate(entry, route))
      );
    }
    occupancyResult = buildOccupancyByConnector(
      plans,
      (plan) => plan.step3Route,
      gutterRects,
      index,
      obstacleOccupancyByConnectorId
    );
  }
  for (const plan of plans) {
    plan.occupiedGutters = occupancyResult.occupancyByConnectorId.get(plan.id) ?? [];
  }

  return {
    connectorPlans: plans,
    occupancy: occupancyResult.occupancy,
    occupancyByConnectorId: occupancyResult.occupancyByConnectorId,
    requiredColumnExpansions: obstacleCompaction.requiredColumnExpansions,
    requiredLaneExpansions: obstacleCompaction.requiredLaneExpansions
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
  const step3Prepared = buildStep3Routes(
    connectorPlans,
    positionedScene,
    baseIndex,
    baseEndpointOffsetsByNodeId,
    baseBucketsByNodeId,
    buildGlobalGutterState()
  );
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
    const nominalPrepared = buildStep3Routes(
      connectorPlans,
      workingScene,
      workingIndex,
      endpointOffsetsByNodeId,
      bucketsByNodeId,
      workingGlobalGutterState
    );
    const segmentCoordinates = resolveOccupancyCoordinates(nominalPrepared.connectorPlans, nominalPrepared.occupancy);
    const endpointGapExpansions = resolveRequiredEndpointGapExpansions(nominalPrepared.connectorPlans, workingIndex);
    const localSeparationExpansions = resolveRequiredLocalSegmentSeparationExpansions(
      nominalPrepared.occupancy,
      workingIndex
    );
    const columnExpansions = accumulateExpansions(
      accumulateExpansions(
        accumulateExpansions(endpointGapExpansions.columnExpansions, nominalPrepared.requiredColumnExpansions),
        localSeparationExpansions.columnExpansions
      ),
      resolveRequiredColumnExpansions(
        nominalPrepared.occupancy,
        workingIndex,
        segmentCoordinates
      )
    );
    const laneExpansions = accumulateExpansions(
      accumulateExpansions(
        accumulateExpansions(endpointGapExpansions.laneExpansions, nominalPrepared.requiredLaneExpansions),
        localSeparationExpansions.laneExpansions
      ),
      resolveRequiredLaneExpansions(
        nominalPrepared.occupancy,
        workingIndex,
        segmentCoordinates
      )
    );

    if (!hasNonZeroExpansion(columnExpansions) && !hasNonZeroExpansion(laneExpansions)) {
      finalPrepared = buildPreparedRoutes(
        connectorPlans,
        workingScene,
        workingIndex,
        endpointOffsetsByNodeId,
        bucketsByNodeId,
        workingGlobalGutterState
      );
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
      const nominal = buildStep3Routes(
        connectorPlans,
        workingScene,
        workingIndex,
        finalEndpointOffsetsByNodeId,
        finalBucketsByNodeId,
        workingGlobalGutterState
      );
      const finalSegmentCoordinates = resolveOccupancyCoordinates(nominal.connectorPlans, nominal.occupancy);
      finalPrepared = buildPreparedRoutes(
        connectorPlans,
        workingScene,
        workingIndex,
        finalEndpointOffsetsByNodeId,
        finalBucketsByNodeId,
        workingGlobalGutterState
      );
    }
  }

  workingIndex = buildIndex(workingScene, middleLayer);
  const settledBucketsByNodeId = buildNodeEdgeBuckets(connectorPlans, workingIndex);
  const settledEndpointOffsetsByNodeId = buildEndpointOffsets(workingIndex, settledBucketsByNodeId);
  finalPrepared = buildPreparedRoutes(
    connectorPlans,
    workingScene,
    workingIndex,
    settledEndpointOffsetsByNodeId,
    settledBucketsByNodeId,
    workingGlobalGutterState
  );

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
