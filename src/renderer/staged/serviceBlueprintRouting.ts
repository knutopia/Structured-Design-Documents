import type {
  EdgeMarkers,
  Point,
  PortSide,
  PositionedContainer,
  PositionedEdge,
  PositionedItem,
  PositionedNode,
  PositionedRoute,
  PositionedScene,
  RendererScene
} from "./contracts.js";
import {
  createRoutingDiagnostic,
  sortRendererDiagnostics,
  type RendererDiagnostic
} from "./diagnostics.js";
import type {
  ServiceBlueprintMiddleCell,
  ServiceBlueprintMiddleEdge,
  ServiceBlueprintMiddleLayerModel
} from "./serviceBlueprintMiddleLayer.js";

const FIXED_SEPARATION_DISTANCE = 16;
const OBSTACLE_SWERVE_CLEARANCE = 16;
const GUTTER_OVERFLOW_TOLERANCE = 8;
const ROOT_PADDING_FALLBACK = 28;

type ConnectorPattern =
  | "precedes_same_row"
  | "precedes_stair"
  | "same_row_bottom"
  | "vertical_direct"
  | "vertical_bridge";

type GutterAxis = "vertical" | "horizontal";
type GutterKind =
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

interface ServiceBlueprintNodeEdgeBucketLists {
  startingConnectorIds: string[];
  endingConnectorIds: string[];
}

export interface ServiceBlueprintNodeEdgeBuckets {
  nodeId: string;
  north: ServiceBlueprintNodeEdgeBucketLists;
  south: ServiceBlueprintNodeEdgeBucketLists;
  east: ServiceBlueprintNodeEdgeBucketLists;
  west: ServiceBlueprintNodeEdgeBucketLists;
}

export interface ServiceBlueprintNodeGutter {
  nodeId: string;
  cellId: string;
  columnOrder: number;
  laneOrder: number;
  rightAvailable: number;
  bottomAvailable: number;
}

export interface ServiceBlueprintGlobalGutterState {
  columnExpansions: Record<number, number>;
  laneExpansions: Record<number, number>;
}

export interface ServiceBlueprintGutterOccupancy {
  connectorId: string;
  key: string;
  axis: GutterAxis;
  kind: GutterKind;
  nodeId?: string;
  side?: PortSide;
  endpointRole?: EndpointRole;
  columnOrder?: number;
  laneOrder?: number;
  nominalCoordinate: number;
  spanStart: number;
  spanEnd: number;
  routeSegmentIndex: number;
  ownershipRank?: number;
}

interface PositionedBlueprintNodeContext {
  node: PositionedNode;
  cell: PositionedContainer;
  cellMeta: ServiceBlueprintMiddleCell;
  authorOrder: number;
}

interface PositionedBlueprintIndex {
  nodeById: Map<string, PositionedBlueprintNodeContext>;
  cellById: Map<string, { cell: PositionedContainer; meta: ServiceBlueprintMiddleCell }>;
  columnLeftByOrder: Map<number, number>;
  columnRightByOrder: Map<number, number>;
  rowTopByOrder: Map<number, number>;
  rowBottomByOrder: Map<number, number>;
  allNodeBoxes: Array<{ itemId: string; x: number; y: number; width: number; height: number }>;
}

interface ConnectorOrderingKey {
  edgeFamilyRank: number;
  precedesSubtypeRank: number;
  sourceLaneOrder: number;
  sourceColumnOrder: number;
  sourceAuthorOrder: number;
  outgoingOrder: number;
  destinationStableId: string;
}

interface ConnectorTemplate {
  pattern: ConnectorPattern;
  sourceSide: PortSide;
  targetSide: PortSide;
  baseBridgeX?: number;
  baseBridgeY?: number;
}

interface ConnectorRouteState {
  route: PositionedRoute;
  bridgeX?: number;
  bridgeY?: number;
  occupiedGutters: ServiceBlueprintGutterOccupancy[];
}

interface RouteSegment {
  orientation: "vertical" | "horizontal";
  coordinate: number;
}

interface RouteSegmentDetail extends RouteSegment {
  routeSegmentIndex: number;
  start: Point;
  end: Point;
}

interface GutterRect {
  key: string;
  kind: GutterKind;
  nodeId?: string;
  columnOrder?: number;
  laneOrder?: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ServiceBlueprintConnectorPlan {
  id: string;
  memberConnectorIds: string[];
  semanticEdgeIds: string[];
  type: string;
  channel: ServiceBlueprintMiddleEdge["channel"];
  role: string;
  classes: string[];
  markers?: EdgeMarkers;
  from: string;
  to: string;
  sourceLaneOrder: number;
  targetLaneOrder: number;
  sourceColumnOrder: number;
  targetColumnOrder: number;
  sourceAuthorOrder: number;
  outgoingOrder: number;
  orderingKey: ConnectorOrderingKey;
  sourceSide: PortSide;
  targetSide: PortSide;
  edgeBucketAssignments: {
    sourceNodeId: string;
    targetNodeId: string;
  };
  pattern: ConnectorPattern;
  step2Route: PositionedRoute;
  step3Route: PositionedRoute;
  finalRoute: PositionedRoute;
  occupiedGutters: ServiceBlueprintGutterOccupancy[];
}

export interface ServiceBlueprintRoutingStageResult {
  positionedScene: PositionedScene;
  connectorPlans: ServiceBlueprintConnectorPlan[];
  nodeEdgeBuckets: ServiceBlueprintNodeEdgeBuckets[];
  nodeGutters: ServiceBlueprintNodeGutter[];
  globalGutterState: ServiceBlueprintGlobalGutterState;
  gutterOccupancy: ServiceBlueprintGutterOccupancy[];
  diagnostics: RendererDiagnostic[];
}

export interface ServiceBlueprintRoutingStagesResult {
  step2: ServiceBlueprintRoutingStageResult;
  step3: ServiceBlueprintRoutingStageResult;
  final: ServiceBlueprintRoutingStageResult;
}

interface GutterLocalBundleClaim {
  connectorId: string;
  gutterKey: string;
  kind: "node_bottom" | "node_right";
  routeSegmentIndex: number;
  nominalCoordinate: number;
  spanStart: number;
  spanEnd: number;
  inwardOwnedCoordinates: number[];
  outwardOwnedCoordinates: number[];
  sourceEndpointKey?: string;
  targetEndpointKey?: string;
  columnOrder?: number;
  laneOrder?: number;
}

interface GutterLocalBundleResolution {
  endpointCoordinateByEndpointKey: Map<string, number>;
  segmentCoordinateBySegmentKey: Map<string, number>;
  lockedSegmentKeys: Set<string>;
  requiredColumnExpansions: Record<number, number>;
  requiredLaneExpansions: Record<number, number>;
}

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function buildEmptyBucketLists(): ServiceBlueprintNodeEdgeBucketLists {
  return {
    startingConnectorIds: [],
    endingConnectorIds: []
  };
}

function buildEmptyNodeEdgeBuckets(nodeId: string): ServiceBlueprintNodeEdgeBuckets {
  return {
    nodeId,
    north: buildEmptyBucketLists(),
    south: buildEmptyBucketLists(),
    east: buildEmptyBucketLists(),
    west: buildEmptyBucketLists()
  };
}

function getSideBuckets(
  buckets: ServiceBlueprintNodeEdgeBuckets,
  side: PortSide
): ServiceBlueprintNodeEdgeBucketLists {
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

function flattenPositionedItems(root: PositionedContainer): PositionedItem[] {
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

function clonePositionedScene(scene: PositionedScene): PositionedScene {
  return structuredClone(scene) as PositionedScene;
}

function isServiceBlueprintCell(item: PositionedItem): item is PositionedContainer {
  return item.kind === "container" && item.classes.includes("service_blueprint_cell");
}

function isSemanticPositionedNode(item: PositionedItem): item is PositionedNode {
  return item.kind === "node" && item.classes.includes("semantic_node");
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

function getSceneEdgeById(
  edges: readonly RendererScene["edges"][number][],
  edgeId: string
): RendererScene["edges"][number] {
  const edge = edges.find((candidate) => candidate.id === edgeId);
  if (!edge) {
    throw new Error(`Could not resolve service_blueprint scene edge "${edgeId}".`);
  }
  return edge;
}

function segmentIntersectsRect(
  start: Point,
  end: Point,
  rect: { x: number; y: number; width: number; height: number },
  options: { ignoreStart?: boolean; ignoreEnd?: boolean } = {}
): boolean {
  if (Math.abs(start.x - end.x) <= 0.5) {
    const x = start.x;
    if (x <= rect.x + 0.5 || x >= rect.x + rect.width - 0.5) {
      return false;
    }
    const low = Math.min(start.y, end.y);
    const high = Math.max(start.y, end.y);
    const clippedLow = options.ignoreStart ? low + 0.5 : low;
    const clippedHigh = options.ignoreEnd ? high - 0.5 : high;
    return clippedLow < rect.y + rect.height - 0.5 && clippedHigh > rect.y + 0.5;
  }

  if (Math.abs(start.y - end.y) <= 0.5) {
    const y = start.y;
    if (y <= rect.y + 0.5 || y >= rect.y + rect.height - 0.5) {
      return false;
    }
    const low = Math.min(start.x, end.x);
    const high = Math.max(start.x, end.x);
    const clippedLow = options.ignoreStart ? low + 0.5 : low;
    const clippedHigh = options.ignoreEnd ? high - 0.5 : high;
    return clippedLow < rect.x + rect.width - 0.5 && clippedHigh > rect.x + 0.5;
  }

  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);
  return minX < rect.x + rect.width - 0.5
    && maxX > rect.x + 0.5
    && minY < rect.y + rect.height - 0.5
    && maxY > rect.y + 0.5;
}

function collectIntersectingBoxes(
  points: Point[],
  boxes: ReadonlyArray<{ itemId: string; x: number; y: number; width: number; height: number }>
): Array<{ itemId: string; x: number; y: number; width: number; height: number }> {
  const intersections: Array<{ itemId: string; x: number; y: number; width: number; height: number }> = [];

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1]!;
    const end = points[index]!;
    for (const box of boxes) {
      const isFirstSegment = index === 1;
      const isLastSegment = index === points.length - 1;
      if (segmentIntersectsRect(start, end, box, {
        ignoreStart: isFirstSegment,
        ignoreEnd: isLastSegment
      })) {
        intersections.push(box);
      }
    }
  }

  return intersections;
}

function collapseRoutePoints(points: Point[]): Point[] {
  const rounded = points.map((point) => ({
    x: roundMetric(point.x),
    y: roundMetric(point.y)
  }));
  const deduped: Point[] = [];

  for (const point of rounded) {
    const last = deduped[deduped.length - 1];
    if (!last || last.x !== point.x || last.y !== point.y) {
      deduped.push(point);
    }
  }

  const collapsed: Point[] = [];
  for (const point of deduped) {
    collapsed.push(point);
    while (collapsed.length >= 3) {
      const tail = collapsed.length - 1;
      const a = collapsed[tail - 2]!;
      const b = collapsed[tail - 1]!;
      const c = collapsed[tail]!;
      const horizontal = a.y === b.y && b.y === c.y;
      const vertical = a.x === b.x && b.x === c.x;
      if (!horizontal && !vertical) {
        break;
      }
      collapsed.splice(tail - 1, 1);
    }
  }

  if (collapsed.length === 1) {
    collapsed.push({
      ...collapsed[0]
    });
  }

  return collapsed;
}

function buildPositionedRoute(points: Point[]): PositionedRoute {
  const collapsed = collapseRoutePoints(points);
  const style = collapsed.length === 2 ? "straight" : "orthogonal";
  return {
    style,
    points: collapsed
  };
}

function buildRouteSegments(route: PositionedRoute): RouteSegment[] {
  const segments: RouteSegment[] = [];

  for (let index = 1; index < route.points.length; index += 1) {
    const start = route.points[index - 1]!;
    const end = route.points[index]!;
    if (start.x === end.x) {
      segments.push({
        orientation: "vertical",
        coordinate: start.x
      });
      continue;
    }
    if (start.y === end.y) {
      segments.push({
        orientation: "horizontal",
        coordinate: start.y
      });
    }
  }

  return segments;
}

function buildRouteSegmentDetails(route: PositionedRoute): RouteSegmentDetail[] {
  const details: RouteSegmentDetail[] = [];

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

function getInternalVerticalCoordinates(route: PositionedRoute): number[] {
  return buildRouteSegments(route)
    .filter((segment, index, all) => segment.orientation === "vertical" && index > 0 && index < all.length - 1)
    .map((segment) => segment.coordinate);
}

function getInternalHorizontalCoordinates(route: PositionedRoute): number[] {
  return buildRouteSegments(route)
    .filter((segment, index, all) => segment.orientation === "horizontal" && index > 0 && index < all.length - 1)
    .map((segment) => segment.coordinate);
}

function getFirstInternalVerticalCoordinate(route: PositionedRoute): number | undefined {
  return getInternalVerticalCoordinates(route)[0];
}

function getFirstInternalHorizontalCoordinate(route: PositionedRoute): number | undefined {
  return getInternalHorizontalCoordinates(route)[0];
}

function sortNumericAscending(values: Iterable<number>): number[] {
  return [...values].sort((left, right) => left - right);
}

function spansOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return Math.min(endA, endB) - Math.max(startA, startB) > 0.5;
}

function buildSegmentDisplacementKey(connectorId: string, routeSegmentIndex: number): string {
  return `${connectorId}|${routeSegmentIndex}`;
}

function buildMarkerKey(markers?: EdgeMarkers): string {
  if (!markers) {
    return "none";
  }
  return `${markers.start ?? "none"}|${markers.end ?? "none"}`;
}

function buildMergeKey(connector: ServiceBlueprintConnectorPlan): string {
  return [
    connector.from,
    connector.to,
    connector.sourceSide,
    connector.targetSide,
    connector.pattern,
    connector.channel,
    buildMarkerKey(connector.markers)
  ].join("|");
}

function buildCompatibleConnectorMergeDiagnostic(
  connectors: readonly ServiceBlueprintConnectorPlan[]
): RendererDiagnostic {
  const canonical = [...connectors]
    .sort((left, right) => compareOrderingKey(left.orderingKey, right.orderingKey) || left.id.localeCompare(right.id))[0]!;
  return createRoutingDiagnostic(
    "renderer.routing.service_blueprint_same_node_connector_not_merged",
    `Connectors ${connectors.map((connector) => `"${connector.id}"`).join(", ")} share the same source and target nodes but were kept separate because their resolved routing sides or channel semantics differ.`,
    canonical.id,
    "info"
  );
}

function mergeCompatibleConnectorPlans(
  connectorPlans: readonly ServiceBlueprintConnectorPlan[]
): {
  connectorPlans: ServiceBlueprintConnectorPlan[];
  diagnostics: RendererDiagnostic[];
} {
  const diagnostics: RendererDiagnostic[] = [];
  const groupedByNodes = new Map<string, ServiceBlueprintConnectorPlan[]>();

  for (const connector of connectorPlans) {
    const key = `${connector.from}|${connector.to}`;
    const existing = groupedByNodes.get(key) ?? [];
    existing.push(connector);
    groupedByNodes.set(key, existing);
  }

  const merged: ServiceBlueprintConnectorPlan[] = [];

  for (const group of groupedByNodes.values()) {
    if (group.length === 1) {
      merged.push(group[0]!);
      continue;
    }

    const groupedByCompatibility = new Map<string, ServiceBlueprintConnectorPlan[]>();
    for (const connector of group) {
      const key = buildMergeKey(connector);
      const existing = groupedByCompatibility.get(key) ?? [];
      existing.push(connector);
      groupedByCompatibility.set(key, existing);
    }

    if (groupedByCompatibility.size > 1) {
      diagnostics.push(buildCompatibleConnectorMergeDiagnostic(group));
    }

    for (const compatibleGroup of groupedByCompatibility.values()) {
      compatibleGroup.sort((left, right) => compareOrderingKey(left.orderingKey, right.orderingKey) || left.id.localeCompare(right.id));
      if (compatibleGroup.length === 1) {
        merged.push(compatibleGroup[0]!);
        continue;
      }

      const canonical = compatibleGroup[0]!;
      merged.push({
        ...canonical,
        memberConnectorIds: compatibleGroup.flatMap((connector) => connector.memberConnectorIds),
        semanticEdgeIds: [...new Set(compatibleGroup.flatMap((connector) => connector.semanticEdgeIds))],
        classes: [...new Set(compatibleGroup.flatMap((connector) => connector.classes))]
      });
    }
  }

  merged.sort((left, right) => compareOrderingKey(left.orderingKey, right.orderingKey) || left.id.localeCompare(right.id));
  return {
    connectorPlans: merged,
    diagnostics
  };
}

function buildIndex(
  root: PositionedContainer,
  cells: readonly ServiceBlueprintMiddleCell[],
  authorOrderByNodeId: ReadonlyMap<string, number>
): PositionedBlueprintIndex {
  const flattened = flattenPositionedItems(root);
  const cellMap = new Map(
    root.children
      .filter(isServiceBlueprintCell)
      .map((cell) => [cell.id, cell] as const)
  );
  const cellById = new Map<string, { cell: PositionedContainer; meta: ServiceBlueprintMiddleCell }>();
  const nodeById = new Map<string, PositionedBlueprintNodeContext>();
  const columnLeftByOrder = new Map<number, number>();
  const columnRightByOrder = new Map<number, number>();
  const rowTopByOrder = new Map<number, number>();
  const rowBottomByOrder = new Map<number, number>();

  for (const meta of cells) {
    const cell = cellMap.get(meta.id);
    if (!cell) {
      continue;
    }
    cellById.set(meta.id, { cell, meta });
    const left = columnLeftByOrder.get(meta.columnOrder);
    const right = columnRightByOrder.get(meta.columnOrder);
    columnLeftByOrder.set(meta.columnOrder, left === undefined ? cell.x : Math.min(left, cell.x));
    columnRightByOrder.set(meta.columnOrder, right === undefined ? cell.x + cell.width : Math.max(right, cell.x + cell.width));
    const top = rowTopByOrder.get(meta.rowOrder);
    const bottom = rowBottomByOrder.get(meta.rowOrder);
    rowTopByOrder.set(meta.rowOrder, top === undefined ? cell.y : Math.min(top, cell.y));
    rowBottomByOrder.set(meta.rowOrder, bottom === undefined ? cell.y + cell.height : Math.max(bottom, cell.y + cell.height));

    for (const nodeId of meta.nodeIds) {
      const node = flattened.find((item) => item.id === nodeId);
      if (!node || !isSemanticPositionedNode(node)) {
        continue;
      }
      nodeById.set(nodeId, {
        node,
        cell,
        cellMeta: meta,
        authorOrder: authorOrderByNodeId.get(nodeId) ?? Number.MAX_SAFE_INTEGER
      });
    }
  }

  const allNodeBoxes = [...nodeById.values()].map((context) => ({
    itemId: context.node.id,
    x: context.node.x,
    y: context.node.y,
    width: context.node.width,
    height: context.node.height
  }));

  return {
    nodeById,
    cellById,
    columnLeftByOrder,
    columnRightByOrder,
    rowTopByOrder,
    rowBottomByOrder,
    allNodeBoxes
  };
}

function getNextValue(values: ReadonlyMap<number, number>, current: number): number | undefined {
  return [...values.entries()]
    .filter(([order]) => order > current)
    .sort((left, right) => left[0] - right[0])[0]?.[1];
}

function getNodeCenter(context: PositionedBlueprintNodeContext): Point {
  return {
    x: roundMetric(context.node.x + context.node.width / 2),
    y: roundMetric(context.node.y + context.node.height / 2)
  };
}

function getSideCenter(context: PositionedBlueprintNodeContext, side: PortSide): Point {
  const center = getNodeCenter(context);
  switch (side) {
    case "north":
      return {
        x: center.x,
        y: roundMetric(context.node.y)
      };
    case "south":
      return {
        x: center.x,
        y: roundMetric(context.node.y + context.node.height)
      };
    case "east":
      return {
        x: roundMetric(context.node.x + context.node.width),
        y: center.y
      };
    case "west":
      return {
        x: roundMetric(context.node.x),
        y: center.y
      };
  }
}

function buildConnectorOrderingKey(
  edge: ServiceBlueprintMiddleEdge,
  source: PositionedBlueprintNodeContext,
  outgoingOrder: number
): ConnectorOrderingKey {
  const isPrecedes = edge.type === "PRECEDES";
  const isStepPrecedes = isPrecedes && source.node.role === "step";
  return {
    edgeFamilyRank: isPrecedes ? 0 : 1,
    precedesSubtypeRank: isStepPrecedes ? 0 : 1,
    sourceLaneOrder: source.cellMeta.rowOrder,
    sourceColumnOrder: source.cellMeta.columnOrder,
    sourceAuthorOrder: source.authorOrder,
    outgoingOrder,
    destinationStableId: edge.to
  };
}

function compareOrderingKey(left: ConnectorOrderingKey, right: ConnectorOrderingKey): number {
  return left.edgeFamilyRank - right.edgeFamilyRank
    || left.precedesSubtypeRank - right.precedesSubtypeRank
    || left.sourceLaneOrder - right.sourceLaneOrder
    || left.sourceColumnOrder - right.sourceColumnOrder
    || left.sourceAuthorOrder - right.sourceAuthorOrder
    || left.outgoingOrder - right.outgoingOrder
    || left.destinationStableId.localeCompare(right.destinationStableId);
}

function determineConnectorTemplate(
  edge: ServiceBlueprintMiddleEdge,
  source: PositionedBlueprintNodeContext,
  target: PositionedBlueprintNodeContext
): ConnectorTemplate {
  const sameRow = source.cellMeta.rowOrder === target.cellMeta.rowOrder;
  const sourceAboveTarget = source.cellMeta.rowOrder < target.cellMeta.rowOrder;
  const sameColumn = source.cellMeta.columnOrder === target.cellMeta.columnOrder;

  if (edge.type === "PRECEDES") {
    if (sameRow) {
      return {
        pattern: "precedes_same_row",
        sourceSide: "east",
        targetSide: "west"
      };
    }

    return {
      pattern: "precedes_stair",
      sourceSide: "east",
      targetSide: "west",
      baseBridgeX: roundMetric(source.node.x + source.node.width + FIXED_SEPARATION_DISTANCE)
    };
  }

  if (sameRow) {
    return {
      pattern: "same_row_bottom",
      sourceSide: "south",
      targetSide: "south",
      baseBridgeY: roundMetric(
        Math.max(source.node.y + source.node.height, target.node.y + target.node.height) + FIXED_SEPARATION_DISTANCE
      )
    };
  }

  if (sameColumn) {
    return {
      pattern: "vertical_direct",
      sourceSide: sourceAboveTarget ? "south" : "north",
      targetSide: sourceAboveTarget ? "north" : "south"
    };
  }

  return {
    pattern: "vertical_bridge",
    sourceSide: sourceAboveTarget ? "south" : "north",
    targetSide: sourceAboveTarget ? "north" : "south",
    baseBridgeX: roundMetric(source.node.x + source.node.width + FIXED_SEPARATION_DISTANCE)
  };
}

function buildTemplateRoute(
  sourcePoint: Point,
  targetPoint: Point,
  template: ConnectorTemplate
): PositionedRoute {
  switch (template.pattern) {
    case "precedes_same_row":
    case "vertical_direct":
      return buildPositionedRoute([
        sourcePoint,
        targetPoint
      ]);
    case "precedes_stair":
      return buildPositionedRoute([
        sourcePoint,
        {
          x: template.baseBridgeX ?? sourcePoint.x,
          y: sourcePoint.y
        },
        {
          x: template.baseBridgeX ?? sourcePoint.x,
          y: targetPoint.y
        },
        targetPoint
      ]);
    case "vertical_bridge": {
      const direction = sourcePoint.y < targetPoint.y ? 1 : -1;
      const sourceStubY = roundMetric(sourcePoint.y + direction * FIXED_SEPARATION_DISTANCE);
      const targetStubY = roundMetric(targetPoint.y - direction * FIXED_SEPARATION_DISTANCE);
      return buildPositionedRoute([
        sourcePoint,
        {
          x: sourcePoint.x,
          y: sourceStubY
        },
        {
          x: template.baseBridgeX ?? sourcePoint.x,
          y: sourceStubY
        },
        {
          x: template.baseBridgeX ?? sourcePoint.x,
          y: targetStubY
        },
        {
          x: targetPoint.x,
          y: targetStubY
        },
        targetPoint
      ]);
    }
    case "same_row_bottom":
      return buildPositionedRoute([
        sourcePoint,
        {
          x: sourcePoint.x,
          y: template.baseBridgeY ?? sourcePoint.y
        },
        {
          x: targetPoint.x,
          y: template.baseBridgeY ?? targetPoint.y
        },
        targetPoint
      ]);
  }
}

function buildConnectorPlans(
  sceneEdges: readonly RendererScene["edges"][number][],
  middleLayer: ServiceBlueprintMiddleLayerModel,
  index: PositionedBlueprintIndex
): {
  connectorPlans: ServiceBlueprintConnectorPlan[];
  diagnostics: RendererDiagnostic[];
} {
  const outgoingCounts = new Map<string, number>();
  const initialPlans: Array<ServiceBlueprintConnectorPlan & { sceneEdge: RendererScene["edges"][number] }> = [];

  for (const edge of middleLayer.edges) {
    const source = index.nodeById.get(edge.from);
    const target = index.nodeById.get(edge.to);
    if (!source || !target) {
      continue;
    }

    const outgoingOrder = outgoingCounts.get(edge.from) ?? 0;
    outgoingCounts.set(edge.from, outgoingOrder + 1);
    const orderingKey = buildConnectorOrderingKey(edge, source, outgoingOrder);
    const template = determineConnectorTemplate(edge, source, target);
    const sourcePoint = getSideCenter(source, template.sourceSide);
    const targetPoint = getSideCenter(target, template.targetSide);
    const step2Route = buildTemplateRoute(sourcePoint, targetPoint, template);
    const sceneEdge = getSceneEdgeById(sceneEdges, edge.id);

    initialPlans.push({
      id: edge.id,
      memberConnectorIds: [edge.id],
      semanticEdgeIds: [...edge.semanticEdgeIds],
      type: edge.type,
      channel: edge.channel,
      role: sceneEdge.role,
      classes: [...sceneEdge.classes],
      markers: sceneEdge.markers,
      from: edge.from,
      to: edge.to,
      sourceLaneOrder: source.cellMeta.rowOrder,
      targetLaneOrder: target.cellMeta.rowOrder,
      sourceColumnOrder: source.cellMeta.columnOrder,
      targetColumnOrder: target.cellMeta.columnOrder,
      sourceAuthorOrder: source.authorOrder,
      outgoingOrder,
      orderingKey,
      sourceSide: template.sourceSide,
      targetSide: template.targetSide,
      edgeBucketAssignments: {
        sourceNodeId: edge.from,
        targetNodeId: edge.to
      },
      pattern: template.pattern,
      step2Route,
      step3Route: step2Route,
      finalRoute: step2Route,
      occupiedGutters: [],
      sceneEdge
    });
  }

  initialPlans.sort((left, right) => compareOrderingKey(left.orderingKey, right.orderingKey) || left.id.localeCompare(right.id));
  return mergeCompatibleConnectorPlans(initialPlans.map(({ sceneEdge: _sceneEdge, ...plan }) => plan));
}

function rebuildStep2RouteForIndex(
  connector: ServiceBlueprintConnectorPlan,
  index: PositionedBlueprintIndex
): PositionedRoute {
  const source = index.nodeById.get(connector.from);
  const target = index.nodeById.get(connector.to);
  if (!source || !target) {
    return connector.step2Route;
  }

  const sourcePoint = getSideCenter(source, connector.sourceSide);
  const targetPoint = getSideCenter(target, connector.targetSide);
  switch (connector.pattern) {
    case "precedes_same_row":
    case "vertical_direct":
      return buildPositionedRoute([sourcePoint, targetPoint]);
    case "precedes_stair":
      return buildPositionedRoute([
        sourcePoint,
        {
          x: roundMetric(source.node.x + source.node.width + FIXED_SEPARATION_DISTANCE),
          y: sourcePoint.y
        },
        {
          x: roundMetric(source.node.x + source.node.width + FIXED_SEPARATION_DISTANCE),
          y: targetPoint.y
        },
        targetPoint
      ]);
    case "vertical_bridge": {
      const direction = sourcePoint.y < targetPoint.y ? 1 : -1;
      const sourceStubY = roundMetric(sourcePoint.y + direction * FIXED_SEPARATION_DISTANCE);
      const targetStubY = roundMetric(targetPoint.y - direction * FIXED_SEPARATION_DISTANCE);
      const bridgeX = roundMetric(source.node.x + source.node.width + FIXED_SEPARATION_DISTANCE);
      return buildPositionedRoute([
        sourcePoint,
        {
          x: sourcePoint.x,
          y: sourceStubY
        },
        {
          x: bridgeX,
          y: sourceStubY
        },
        {
          x: bridgeX,
          y: targetStubY
        },
        {
          x: targetPoint.x,
          y: targetStubY
        },
        targetPoint
      ]);
    }
    case "same_row_bottom": {
      const bridgeY = roundMetric(
        Math.max(source.node.y + source.node.height, target.node.y + target.node.height) + FIXED_SEPARATION_DISTANCE
      );
      return buildPositionedRoute([
        sourcePoint,
        {
          x: sourcePoint.x,
          y: bridgeY
        },
        {
          x: targetPoint.x,
          y: bridgeY
        },
        targetPoint
      ]);
    }
  }
}

function buildNodeEdgeBuckets(
  connectorPlans: readonly ServiceBlueprintConnectorPlan[],
  index: PositionedBlueprintIndex
): Map<string, ServiceBlueprintNodeEdgeBuckets> {
  const bucketsByNodeId = new Map<string, ServiceBlueprintNodeEdgeBuckets>();

  for (const nodeId of index.nodeById.keys()) {
    bucketsByNodeId.set(nodeId, buildEmptyNodeEdgeBuckets(nodeId));
  }

  for (const connector of connectorPlans) {
    const sourceBuckets = bucketsByNodeId.get(connector.from) ?? buildEmptyNodeEdgeBuckets(connector.from);
    const targetBuckets = bucketsByNodeId.get(connector.to) ?? buildEmptyNodeEdgeBuckets(connector.to);

    getSideBuckets(sourceBuckets, connector.sourceSide).startingConnectorIds.push(connector.id);
    getSideBuckets(targetBuckets, connector.targetSide).endingConnectorIds.push(connector.id);
    bucketsByNodeId.set(connector.from, sourceBuckets);
    bucketsByNodeId.set(connector.to, targetBuckets);
  }

  return bucketsByNodeId;
}

function getObstacleLocalOwnershipCount(
  bucketsByNodeId: ReadonlyMap<string, ServiceBlueprintNodeEdgeBuckets>,
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

function buildNodeGutters(index: PositionedBlueprintIndex): ServiceBlueprintNodeGutter[] {
  return [...index.nodeById.values()].map((context) => {
    const nextColumnLeft = getNextValue(index.columnLeftByOrder, context.cellMeta.columnOrder);
    const nextRowTop = getNextValue(index.rowTopByOrder, context.cellMeta.rowOrder);
    return {
      nodeId: context.node.id,
      cellId: context.cell.id,
      columnOrder: context.cellMeta.columnOrder,
      laneOrder: context.cellMeta.rowOrder,
      rightAvailable: roundMetric(Math.max(0, (nextColumnLeft ?? (context.cell.x + context.cell.width)) - (context.node.x + context.node.width))),
      bottomAvailable: roundMetric(Math.max(0, (nextRowTop ?? (context.cell.y + context.cell.height)) - (context.node.y + context.node.height)))
    };
  });
}

function buildGlobalGutterState(
  columnExpansions: Record<number, number> = {},
  laneExpansions: Record<number, number> = {}
): ServiceBlueprintGlobalGutterState {
  return {
    columnExpansions,
    laneExpansions
  };
}

function buildGutterRects(
  scene: PositionedScene,
  index: PositionedBlueprintIndex,
  globalGutterState: ServiceBlueprintGlobalGutterState
): GutterRect[] {
  const rects: GutterRect[] = [];

  for (const context of index.nodeById.values()) {
    const columnExpansion = globalGutterState.columnExpansions[context.cellMeta.columnOrder] ?? 0;
    const laneExpansion = globalGutterState.laneExpansions[context.cellMeta.rowOrder] ?? 0;
    const nextColumnLeft = getNextValue(index.columnLeftByOrder, context.cellMeta.columnOrder) ?? roundMetric(context.cell.x + context.cell.width);
    const nextRowTop = getNextValue(index.rowTopByOrder, context.cellMeta.rowOrder) ?? roundMetric(context.cell.y + context.cell.height);
    const rightLimit = roundMetric(nextColumnLeft - columnExpansion);
    const bottomLimit = roundMetric(nextRowTop - laneExpansion);
    const rightWidth = roundMetric(Math.max(0, rightLimit - (context.node.x + context.node.width)));
    const bottomHeight = roundMetric(Math.max(0, bottomLimit - (context.node.y + context.node.height)));

    if (rightWidth > 0) {
      rects.push({
        key: `node:${context.node.id}:right`,
        kind: "node_right",
        nodeId: context.node.id,
        columnOrder: context.cellMeta.columnOrder,
        laneOrder: context.cellMeta.rowOrder,
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
        columnOrder: context.cellMeta.columnOrder,
        laneOrder: context.cellMeta.rowOrder,
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
      ? roundMetric((index.columnRightByOrder.get(numericOrder) ?? 0))
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
      ? roundMetric((index.rowBottomByOrder.get(numericOrder) ?? 0))
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

function buildGutterOccupancyForIntersection(
  connectorId: string,
  segment: RouteSegmentDetail,
  rect: GutterRect
): ServiceBlueprintGutterOccupancy | undefined {
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
      nodeId: rect.nodeId,
      columnOrder: rect.columnOrder,
      laneOrder: rect.laneOrder,
      nominalCoordinate: roundMetric(segment.coordinate),
      spanStart,
      spanEnd,
      routeSegmentIndex: segment.routeSegmentIndex
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
    nodeId: rect.nodeId,
    columnOrder: rect.columnOrder,
    laneOrder: rect.laneOrder,
    nominalCoordinate: roundMetric(segment.coordinate),
    spanStart,
    spanEnd,
    routeSegmentIndex: segment.routeSegmentIndex
  };
}

function isObstacleLocalKind(kind: GutterKind): boolean {
  return kind === "obstacle_north"
    || kind === "obstacle_south"
    || kind === "obstacle_east"
    || kind === "obstacle_west";
}

function isEdgeLocalKind(kind: GutterKind): boolean {
  return kind === "edge_local";
}

function getObstacleSideKind(side: PortSide): GutterKind {
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

function getExpectedEdgeLocalAxis(side: PortSide): GutterAxis {
  return side === "north" || side === "south" ? "horizontal" : "vertical";
}

function buildEdgeLocalEndpointKey(connectorId: string, endpointRole: EndpointRole): string {
  return `${connectorId}|${endpointRole}`;
}

function buildEdgeLocalOccupancy(
  connectorId: string,
  segment: RouteSegmentDetail,
  nodeId: string,
  side: PortSide,
  endpointRole: EndpointRole
): ServiceBlueprintGutterOccupancy {
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

function overlapsNodeExtent(
  segment: RouteSegmentDetail,
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
  segment: RouteSegmentDetail,
  nodeId: string,
  side: PortSide,
  ownershipRank: number
): ServiceBlueprintGutterOccupancy {
  if (segment.orientation === "horizontal") {
    return {
      connectorId,
      key: `obstacle:${nodeId}:${side}`,
      axis: "horizontal",
      kind: getObstacleSideKind(side),
      nodeId,
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
    nominalCoordinate: roundMetric(segment.coordinate),
    spanStart: roundMetric(Math.min(segment.start.y, segment.end.y)),
    spanEnd: roundMetric(Math.max(segment.start.y, segment.end.y)),
    routeSegmentIndex: segment.routeSegmentIndex,
    ownershipRank
  };
}

function buildAttachedObstacleOccupanciesForNode(
  connector: ServiceBlueprintConnectorPlan,
  routeSegments: readonly RouteSegmentDetail[],
  nodeId: string,
  node: { x: number; y: number; width: number; height: number }
): ServiceBlueprintGutterOccupancy[] {
  const occupancies: ServiceBlueprintGutterOccupancy[] = [];

  const attachSegment = (
    role: "source" | "target",
    side: PortSide,
    expectedOrientation: RouteSegment["orientation"]
  ): void => {
    if (routeSegments.length < 2) {
      return;
    }

    const localSegment = role === "source" ? routeSegments[1] : routeSegments[routeSegments.length - 2];
    if (!localSegment || localSegment.orientation !== expectedOrientation) {
      return;
    }

    if (!overlapsNodeExtent(localSegment, node)) {
      return;
    }

    switch (side) {
      case "north":
        if (localSegment.orientation === "horizontal" && localSegment.coordinate < node.y - 0.5) {
          occupancies.push(buildObstacleLocalOccupancy(connector.id, localSegment, nodeId, side, 0));
        }
        break;
      case "south":
        if (localSegment.orientation === "horizontal" && localSegment.coordinate > node.y + node.height + 0.5) {
          occupancies.push(buildObstacleLocalOccupancy(connector.id, localSegment, nodeId, side, 0));
        }
        break;
      case "east":
        if (localSegment.orientation === "vertical" && localSegment.coordinate > node.x + node.width + 0.5) {
          occupancies.push(buildObstacleLocalOccupancy(connector.id, localSegment, nodeId, side, 0));
        }
        break;
      case "west":
        if (localSegment.orientation === "vertical" && localSegment.coordinate < node.x - 0.5) {
          occupancies.push(buildObstacleLocalOccupancy(connector.id, localSegment, nodeId, side, 0));
        }
        break;
    }
  };

  if (connector.from === nodeId) {
    attachSegment("source", connector.sourceSide, connector.sourceSide === "north" || connector.sourceSide === "south" ? "horizontal" : "vertical");
  }
  if (connector.to === nodeId) {
    attachSegment("target", connector.targetSide, connector.targetSide === "north" || connector.targetSide === "south" ? "horizontal" : "vertical");
  }

  return occupancies;
}

function buildEdgeLocalOccupancyForEndpoint(
  connector: ServiceBlueprintConnectorPlan,
  routeSegments: readonly RouteSegmentDetail[],
  nodeId: string,
  node: { x: number; y: number; width: number; height: number },
  side: PortSide,
  endpointRole: EndpointRole
): ServiceBlueprintGutterOccupancy | undefined {
  if (routeSegments.length < 2) {
    return undefined;
  }

  const segment = endpointRole === "source" ? routeSegments[1] : routeSegments[routeSegments.length - 2];
  if (!segment || segment.orientation !== getExpectedEdgeLocalAxis(side)) {
    return undefined;
  }

  if (!overlapsNodeExtent(segment, node)) {
    return undefined;
  }

  switch (side) {
    case "north":
      if (segment.orientation === "horizontal" && segment.coordinate < node.y - 0.5) {
        return buildEdgeLocalOccupancy(connector.id, segment, nodeId, side, endpointRole);
      }
      break;
    case "south":
      if (segment.orientation === "horizontal" && segment.coordinate > node.y + node.height + 0.5) {
        return buildEdgeLocalOccupancy(connector.id, segment, nodeId, side, endpointRole);
      }
      break;
    case "east":
      if (segment.orientation === "vertical" && segment.coordinate > node.x + node.width + 0.5) {
        return buildEdgeLocalOccupancy(connector.id, segment, nodeId, side, endpointRole);
      }
      break;
    case "west":
      if (segment.orientation === "vertical" && segment.coordinate < node.x - 0.5) {
        return buildEdgeLocalOccupancy(connector.id, segment, nodeId, side, endpointRole);
      }
      break;
  }

  return undefined;
}

function extractEdgeLocalOccupancyForConnector(
  connector: ServiceBlueprintConnectorPlan,
  route: PositionedRoute,
  index: PositionedBlueprintIndex
): ServiceBlueprintGutterOccupancy[] {
  const segments = buildRouteSegmentDetails(route);
  if (segments.length < 2) {
    return [];
  }

  const occupancies: ServiceBlueprintGutterOccupancy[] = [];
  const source = index.nodeById.get(connector.from);
  if (source) {
    const sourceEntry = buildEdgeLocalOccupancyForEndpoint(
      connector,
      segments,
      connector.from,
      source.node,
      connector.sourceSide,
      "source"
    );
    if (sourceEntry) {
      occupancies.push(sourceEntry);
    }
  }

  const target = index.nodeById.get(connector.to);
  if (target) {
    const targetEntry = buildEdgeLocalOccupancyForEndpoint(
      connector,
      segments,
      connector.to,
      target.node,
      connector.targetSide,
      "target"
    );
    if (targetEntry) {
      occupancies.push(targetEntry);
    }
  }

  occupancies.sort((left, right) => left.key.localeCompare(right.key)
    || left.routeSegmentIndex - right.routeSegmentIndex
    || left.spanStart - right.spanStart
    || left.spanEnd - right.spanEnd
    || left.connectorId.localeCompare(right.connectorId));
  return occupancies;
}

function buildSwerveObstacleOccupanciesForNode(
  connector: ServiceBlueprintConnectorPlan,
  routeSegments: readonly RouteSegmentDetail[],
  nodeId: string,
  node: { x: number; y: number; width: number; height: number }
): ServiceBlueprintGutterOccupancy[] {
  if (connector.from === nodeId || connector.to === nodeId) {
    return [];
  }

  const occupancies: ServiceBlueprintGutterOccupancy[] = [];
  const spansNodeHeight = (segment: RouteSegmentDetail): boolean => {
    const spanStart = Math.min(segment.start.y, segment.end.y);
    const spanEnd = Math.max(segment.start.y, segment.end.y);
    return spanStart < node.y + node.height - 0.5 && spanEnd > node.y + 0.5;
  };
  const spansNodeWidth = (segment: RouteSegmentDetail): boolean => {
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
        occupancies.push(buildObstacleLocalOccupancy(connector.id, segment, nodeId, "north", 1));
      } else if (segment.coordinate > node.y + node.height + 0.5) {
        occupancies.push(buildObstacleLocalOccupancy(connector.id, segment, nodeId, "south", 1));
      }
    }
  }

  if (hasHorizontalBypass) {
    for (const segment of routeSegments) {
      if (segment.orientation !== "vertical" || !spansNodeHeight(segment)) {
        continue;
      }
      if (segment.coordinate < node.x - 0.5) {
        occupancies.push(buildObstacleLocalOccupancy(connector.id, segment, nodeId, "west", 1));
      } else if (segment.coordinate > node.x + node.width + 0.5) {
        occupancies.push(buildObstacleLocalOccupancy(connector.id, segment, nodeId, "east", 1));
      }
    }
  }

  return occupancies;
}

function extractObstacleLocalOccupancyForConnector(
  connector: ServiceBlueprintConnectorPlan,
  route: PositionedRoute,
  index: PositionedBlueprintIndex
): ServiceBlueprintGutterOccupancy[] {
  const segments = buildRouteSegmentDetails(route);
  if (segments.length === 0) {
    return [];
  }

  const occupancies: ServiceBlueprintGutterOccupancy[] = [];
  for (const [nodeId, context] of index.nodeById.entries()) {
    occupancies.push(
      ...buildAttachedObstacleOccupanciesForNode(connector, segments, nodeId, context.node),
      ...buildSwerveObstacleOccupanciesForNode(connector, segments, nodeId, context.node)
    );
  }

  occupancies.sort((left, right) => left.key.localeCompare(right.key)
    || (left.ownershipRank ?? 0) - (right.ownershipRank ?? 0)
    || left.routeSegmentIndex - right.routeSegmentIndex
    || left.spanStart - right.spanStart
    || left.spanEnd - right.spanEnd
    || left.connectorId.localeCompare(right.connectorId));
  return occupancies;
}

function extractGutterOccupancyForRoute(
  connector: ServiceBlueprintConnectorPlan,
  route: PositionedRoute,
  scene: PositionedScene,
  index: PositionedBlueprintIndex,
  globalGutterState: ServiceBlueprintGlobalGutterState
): ServiceBlueprintGutterOccupancy[] {
  const rects = buildGutterRects(scene, index, globalGutterState);
  const occupancy: ServiceBlueprintGutterOccupancy[] = [];

  for (const segment of buildRouteSegmentDetails(route)) {
    for (const rect of rects) {
      const entry = buildGutterOccupancyForIntersection(connector.id, segment, rect);
      if (entry) {
        occupancy.push(entry);
      }
    }
  }

  occupancy.push(...extractEdgeLocalOccupancyForConnector(connector, route, index));
  occupancy.push(...extractObstacleLocalOccupancyForConnector(connector, route, index));

  occupancy.sort((left, right) => left.key.localeCompare(right.key)
    || (left.ownershipRank ?? 0) - (right.ownershipRank ?? 0)
    || left.routeSegmentIndex - right.routeSegmentIndex
    || left.spanStart - right.spanStart
    || left.spanEnd - right.spanEnd
    || left.connectorId.localeCompare(right.connectorId));
  return occupancy;
}

function extractGutterOccupancyByConnector(
  connectorPlans: readonly ServiceBlueprintConnectorPlan[],
  routesByConnectorId: ReadonlyMap<string, PositionedRoute>,
  scene: PositionedScene,
  index: PositionedBlueprintIndex,
  globalGutterState: ServiceBlueprintGlobalGutterState
): {
  occupancy: ServiceBlueprintGutterOccupancy[];
  occupancyByConnectorId: Map<string, ServiceBlueprintGutterOccupancy[]>;
} {
  const occupancyByConnectorId = new Map<string, ServiceBlueprintGutterOccupancy[]>();
  const occupancy: ServiceBlueprintGutterOccupancy[] = [];

  for (const connector of connectorPlans) {
    const route = routesByConnectorId.get(connector.id) ?? connector.step3Route;
    const connectorOccupancy = extractGutterOccupancyForRoute(
      connector,
      route,
      scene,
      index,
      globalGutterState
    );
    occupancyByConnectorId.set(connector.id, connectorOccupancy);
    occupancy.push(...connectorOccupancy);
  }

  return {
    occupancy,
    occupancyByConnectorId
  };
}

function getNonEndpointBoxes(
  connector: ServiceBlueprintConnectorPlan,
  index: PositionedBlueprintIndex
): Array<{ itemId: string; x: number; y: number; width: number; height: number }> {
  return index.allNodeBoxes.filter((box) => box.itemId !== connector.from && box.itemId !== connector.to);
}

function resolveVerticalBridgeX(
  baseX: number,
  connector: ServiceBlueprintConnectorPlan,
  index: PositionedBlueprintIndex,
  pointsBuilder: (bridgeX: number) => Point[],
  diagnostics: RendererDiagnostic[],
  diagnosticCode: string
): number {
  let bridgeX = baseX;

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const boxes = collectIntersectingBoxes(pointsBuilder(bridgeX), getNonEndpointBoxes(connector, index));
    if (boxes.length === 0) {
      return bridgeX;
    }

    bridgeX = roundMetric(Math.max(bridgeX + FIXED_SEPARATION_DISTANCE, ...boxes.map((box) => box.x + box.width + FIXED_SEPARATION_DISTANCE)));
  }

  diagnostics.push(
    createRoutingDiagnostic(
      diagnosticCode,
      `Connector "${connector.id}" exhausted vertical obstacle-avoidance attempts while resolving service_blueprint routing.`,
      connector.id,
      "warn"
    )
  );
  return bridgeX;
}

function resolveHorizontalBridgeY(
  baseY: number,
  connector: ServiceBlueprintConnectorPlan,
  index: PositionedBlueprintIndex,
  pointsBuilder: (bridgeY: number) => Point[],
  diagnostics: RendererDiagnostic[],
  diagnosticCode: string
): number {
  let bridgeY = baseY;

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const boxes = collectIntersectingBoxes(pointsBuilder(bridgeY), getNonEndpointBoxes(connector, index));
    if (boxes.length === 0) {
      return bridgeY;
    }

    bridgeY = roundMetric(Math.max(bridgeY + FIXED_SEPARATION_DISTANCE, ...boxes.map((box) => box.y + box.height + FIXED_SEPARATION_DISTANCE)));
  }

  diagnostics.push(
    createRoutingDiagnostic(
      diagnosticCode,
      `Connector "${connector.id}" exhausted horizontal obstacle-avoidance attempts while resolving service_blueprint routing.`,
      connector.id,
      "warn"
    )
  );
  return bridgeY;
}

function findIntersectingBoxesAlongSegment(
  start: Point,
  end: Point,
  boxes: ReadonlyArray<{ itemId: string; x: number; y: number; width: number; height: number }>
): Array<{ itemId: string; x: number; y: number; width: number; height: number }> {
  const intersections = boxes.filter((box) => segmentIntersectsRect(start, end, box, {
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

function resolveLocalVerticalDetourX(
  originalX: number,
  encounterY: number,
  exitY: number,
  obstacle: { itemId: string; x: number; y: number; width: number; height: number },
  connector: ServiceBlueprintConnectorPlan,
  index: PositionedBlueprintIndex,
  diagnostics: RendererDiagnostic[]
): number {
  const baseX = roundMetric(
    Math.max(
      originalX + FIXED_SEPARATION_DISTANCE,
      obstacle.x + obstacle.width + OBSTACLE_SWERVE_CLEARANCE
    )
  );
  return resolveVerticalBridgeX(
    baseX,
    connector,
    index,
    (candidateBridgeX) => [
      { x: originalX, y: encounterY },
      { x: candidateBridgeX, y: encounterY },
      { x: candidateBridgeX, y: exitY },
      { x: originalX, y: exitY }
    ],
    diagnostics,
    "renderer.routing.service_blueprint_vertical_swerve_fallback"
  );
}

function resolveLocalHorizontalDetourY(
  originalY: number,
  encounterX: number,
  exitX: number,
  obstacle: { itemId: string; x: number; y: number; width: number; height: number },
  connector: ServiceBlueprintConnectorPlan,
  index: PositionedBlueprintIndex,
  diagnostics: RendererDiagnostic[]
): number {
  const baseY = roundMetric(
    Math.max(
      originalY + FIXED_SEPARATION_DISTANCE,
      obstacle.y + obstacle.height + OBSTACLE_SWERVE_CLEARANCE
    )
  );
  return resolveHorizontalBridgeY(
    baseY,
    connector,
    index,
    (candidateBridgeY) => [
      { x: encounterX, y: originalY },
      { x: encounterX, y: candidateBridgeY },
      { x: exitX, y: candidateBridgeY },
      { x: exitX, y: originalY }
    ],
    diagnostics,
    "renderer.routing.service_blueprint_horizontal_swerve_fallback"
  );
}

function buildVerticalSegmentWithLocalSwerves(
  start: Point,
  end: Point,
  connector: ServiceBlueprintConnectorPlan,
  index: PositionedBlueprintIndex,
  bucketsByNodeId: ReadonlyMap<string, ServiceBlueprintNodeEdgeBuckets>,
  diagnostics: RendererDiagnostic[]
): ConnectorRouteState {
  const points: Point[] = [start];
  const direction = start.y <= end.y ? 1 : -1;
  let cursor = start;

  while (true) {
    const obstacle = findIntersectingBoxesAlongSegment(cursor, end, getNonEndpointBoxes(connector, index))[0];
    if (!obstacle) {
      points.push(end);
      return {
        route: buildPositionedRoute(points),
        occupiedGutters: []
      };
    }

    const northOwnershipCount = getObstacleLocalOwnershipCount(bucketsByNodeId, obstacle.itemId, "north");
    const southOwnershipCount = getObstacleLocalOwnershipCount(bucketsByNodeId, obstacle.itemId, "south");
    const encounterY = roundMetric(
      direction > 0
        ? obstacle.y - OBSTACLE_SWERVE_CLEARANCE - northOwnershipCount * FIXED_SEPARATION_DISTANCE
        : obstacle.y + obstacle.height + OBSTACLE_SWERVE_CLEARANCE + southOwnershipCount * FIXED_SEPARATION_DISTANCE
    );
    const exitY = roundMetric(
      direction > 0
        ? obstacle.y + obstacle.height + OBSTACLE_SWERVE_CLEARANCE + southOwnershipCount * FIXED_SEPARATION_DISTANCE
        : obstacle.y - OBSTACLE_SWERVE_CLEARANCE - northOwnershipCount * FIXED_SEPARATION_DISTANCE
    );
    const bridgeX = resolveLocalVerticalDetourX(cursor.x, encounterY, exitY, obstacle, connector, index, diagnostics);

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
}

function buildHorizontalSegmentWithLocalSwerves(
  start: Point,
  end: Point,
  connector: ServiceBlueprintConnectorPlan,
  index: PositionedBlueprintIndex,
  bucketsByNodeId: ReadonlyMap<string, ServiceBlueprintNodeEdgeBuckets>,
  diagnostics: RendererDiagnostic[]
): ConnectorRouteState {
  const points: Point[] = [start];
  const movingRight = start.x <= end.x;
  let cursor = start;

  while (true) {
    const obstacle = findIntersectingBoxesAlongSegment(cursor, end, getNonEndpointBoxes(connector, index))[0];
    if (!obstacle) {
      points.push(end);
      return {
        route: buildPositionedRoute(points),
        occupiedGutters: []
      };
    }

    const westOwnershipCount = getObstacleLocalOwnershipCount(bucketsByNodeId, obstacle.itemId, "west");
    const eastOwnershipCount = getObstacleLocalOwnershipCount(bucketsByNodeId, obstacle.itemId, "east");
    const encounterX = roundMetric(
      movingRight
        ? obstacle.x - OBSTACLE_SWERVE_CLEARANCE - westOwnershipCount * FIXED_SEPARATION_DISTANCE
        : obstacle.x + obstacle.width + OBSTACLE_SWERVE_CLEARANCE + eastOwnershipCount * FIXED_SEPARATION_DISTANCE
    );
    const exitX = roundMetric(
      movingRight
        ? obstacle.x + obstacle.width + OBSTACLE_SWERVE_CLEARANCE + eastOwnershipCount * FIXED_SEPARATION_DISTANCE
        : obstacle.x - OBSTACLE_SWERVE_CLEARANCE - westOwnershipCount * FIXED_SEPARATION_DISTANCE
    );
    const bridgeY = resolveLocalHorizontalDetourY(cursor.y, encounterX, exitX, obstacle, connector, index, diagnostics);

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
}

function buildRouteWithLocalSwerves(
  route: PositionedRoute,
  connector: ServiceBlueprintConnectorPlan,
  index: PositionedBlueprintIndex,
  bucketsByNodeId: ReadonlyMap<string, ServiceBlueprintNodeEdgeBuckets>,
  diagnostics: RendererDiagnostic[]
): ConnectorRouteState {
  const points: Point[] = [];

  for (let indexPoint = 1; indexPoint < route.points.length; indexPoint += 1) {
    const start = route.points[indexPoint - 1]!;
    const end = route.points[indexPoint]!;
    const state = start.x === end.x
      ? buildVerticalSegmentWithLocalSwerves(start, end, connector, index, bucketsByNodeId, diagnostics)
      : buildHorizontalSegmentWithLocalSwerves(start, end, connector, index, bucketsByNodeId, diagnostics);
    if (points.length === 0) {
      points.push(...state.route.points);
    } else {
      points.push(...state.route.points.slice(1));
    }
  }

  return {
    route: buildPositionedRoute(points),
    occupiedGutters: []
  };
}

function buildStep3Route(
  connector: ServiceBlueprintConnectorPlan,
  index: PositionedBlueprintIndex,
  bucketsByNodeId: ReadonlyMap<string, ServiceBlueprintNodeEdgeBuckets>,
  diagnostics: RendererDiagnostic[]
): ConnectorRouteState {
  if (!index.nodeById.has(connector.from) || !index.nodeById.has(connector.to)) {
    return {
      route: connector.step2Route,
      occupiedGutters: []
    };
  }

  switch (connector.pattern) {
    case "precedes_same_row":
    case "vertical_direct":
      return buildRouteWithLocalSwerves(connector.step2Route, connector, index, bucketsByNodeId, diagnostics);
    case "precedes_stair": {
      const state = buildRouteWithLocalSwerves(connector.step2Route, connector, index, bucketsByNodeId, diagnostics);
      return {
        route: state.route,
        bridgeX: getFirstInternalVerticalCoordinate(state.route),
        occupiedGutters: []
      };
    }
    case "same_row_bottom": {
      const state = buildRouteWithLocalSwerves(connector.step2Route, connector, index, bucketsByNodeId, diagnostics);
      return {
        route: state.route,
        bridgeY: getFirstInternalHorizontalCoordinate(state.route),
        occupiedGutters: []
      };
    }
    case "vertical_bridge": {
      const state = buildRouteWithLocalSwerves(connector.step2Route, connector, index, bucketsByNodeId, diagnostics);
      return {
        route: state.route,
        bridgeX: getFirstInternalVerticalCoordinate(state.route),
        occupiedGutters: []
      };
    }
  }
}

function buildStep3ConnectorPlansForScene(
  connectorPlans: readonly ServiceBlueprintConnectorPlan[],
  scene: PositionedScene,
  index: PositionedBlueprintIndex,
  bucketsByNodeId: ReadonlyMap<string, ServiceBlueprintNodeEdgeBuckets>,
  diagnostics: RendererDiagnostic[],
  globalGutterState: ServiceBlueprintGlobalGutterState
): {
  connectorPlans: ServiceBlueprintConnectorPlan[];
  routeStates: Map<string, ConnectorRouteState>;
  occupancy: ServiceBlueprintGutterOccupancy[];
} {
  const routeStates = new Map<string, ConnectorRouteState>();
  const rerouted = connectorPlans.map((connector) => {
    const step2Route = rebuildStep2RouteForIndex(connector, index);
    const routeState = buildStep3Route(
      {
        ...connector,
        step2Route
      },
      index,
      bucketsByNodeId,
      diagnostics
    );
    routeStates.set(connector.id, {
      route: routeState.route,
      occupiedGutters: []
    });
    return {
      ...connector,
      step2Route,
      step3Route: routeState.route,
      occupiedGutters: []
    };
  });

  const occupancyResult = extractGutterOccupancyByConnector(
    rerouted,
    new Map(rerouted.map((connector) => [connector.id, connector.step3Route] as const)),
    scene,
    index,
    globalGutterState
  );
  const connectorPlansWithOccupancy = rerouted.map((connector) => {
    const occupiedGutters = occupancyResult.occupancyByConnectorId.get(connector.id) ?? [];
    routeStates.set(connector.id, {
      route: connector.step3Route,
      occupiedGutters
    });
    return {
      ...connector,
      occupiedGutters
    };
  });

  return {
    connectorPlans: connectorPlansWithOccupancy,
    routeStates,
    occupancy: occupancyResult.occupancy
  };
}

function buildEndpointOffsets(
  index: PositionedBlueprintIndex,
  bucketsByNodeId: ReadonlyMap<string, ServiceBlueprintNodeEdgeBuckets>
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
      const sideBuckets = getSideBuckets(buckets, side);
      const incoming = [...sideBuckets.endingConnectorIds];
      const outgoing = [...sideBuckets.startingConnectorIds];
      const longEnough = sideLengths[side] > 2 * Math.max(0, incoming.length + outgoing.length - 1) * FIXED_SEPARATION_DISTANCE;
      const offsets = new Map<string, number>();

      if (incoming.length > 0 && outgoing.length > 0) {
        incoming.forEach((connectorId, indexInGroup) => {
          offsets.set(
            connectorId,
            roundMetric(-(incoming.length - indexInGroup) * FIXED_SEPARATION_DISTANCE)
          );
        });
        outgoing.forEach((connectorId, indexInGroup) => {
          offsets.set(connectorId, roundMetric(indexInGroup * FIXED_SEPARATION_DISTANCE));
        });
      } else {
        const ids = incoming.length > 0 ? incoming : outgoing;
        ids.forEach((connectorId, indexInGroup) => {
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

function getSidePointWithOffset(
  context: PositionedBlueprintNodeContext,
  side: PortSide,
  offset: number
): Point {
  const center = getNodeCenter(context);
  switch (side) {
    case "north":
      return {
        x: roundMetric(center.x + offset),
        y: roundMetric(context.node.y)
      };
    case "south":
      return {
        x: roundMetric(center.x + offset),
        y: roundMetric(context.node.y + context.node.height)
      };
    case "east":
      return {
        x: roundMetric(context.node.x + context.node.width),
        y: roundMetric(center.y + offset)
      };
    case "west":
      return {
        x: roundMetric(context.node.x),
        y: roundMetric(center.y + offset)
      };
  }
}

function spansTouchOrOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return Math.min(endA, endB) - Math.max(startA, startB) >= -0.5;
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

function isBundleLocalKind(kind: GutterKind): kind is "node_bottom" | "node_right" {
  return kind === "node_bottom" || kind === "node_right";
}

function getBundleClaimAxis(kind: "node_bottom" | "node_right"): GutterAxis {
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
  entry: ServiceBlueprintGutterOccupancy,
  rect: GutterRect
): boolean {
  if (rect.kind === "node_bottom") {
    return entry.axis === "vertical" && entry.spanStart <= rect.y + 0.5;
  }

  return entry.axis === "horizontal" && entry.spanStart <= rect.x + 0.5;
}

function touchesOuterBoundary(
  entry: ServiceBlueprintGutterOccupancy,
  rect: GutterRect
): boolean {
  if (rect.kind === "node_bottom") {
    return entry.axis === "vertical" && entry.spanEnd >= rect.y + rect.height - 0.5;
  }

  return entry.axis === "horizontal" && entry.spanEnd >= rect.x + rect.width - 0.5;
}

function chooseBundleClaimEntry(
  entries: readonly ServiceBlueprintGutterOccupancy[],
  connector: ServiceBlueprintConnectorPlan,
  routeSegmentCount: number,
  kind: "node_bottom" | "node_right"
): ServiceBlueprintGutterOccupancy | undefined {
  const claimAxis = getBundleClaimAxis(kind);
  const sourceLocalSegmentIndex = routeSegmentCount >= 2 && matchesBundleSourceSide(kind, connector.sourceSide)
    ? 1
    : undefined;
  const targetLocalSegmentIndex = routeSegmentCount >= 2 && matchesBundleTargetSide(kind, connector.targetSide)
    ? routeSegmentCount - 2
    : undefined;

  const candidates = entries.filter((entry) => entry.axis === claimAxis);
  if (candidates.length === 0) {
    return undefined;
  }

  const getScore = (entry: ServiceBlueprintGutterOccupancy): number => {
    if (entry.routeSegmentIndex === sourceLocalSegmentIndex || entry.routeSegmentIndex === targetLocalSegmentIndex) {
      return 0;
    }
    if (candidates.length === 1) {
      return 1;
    }
    return 2;
  };

  return [...candidates].sort((left, right) =>
    getScore(left) - getScore(right)
    || left.routeSegmentIndex - right.routeSegmentIndex
    || left.spanStart - right.spanStart
    || left.spanEnd - right.spanEnd
    || left.connectorId.localeCompare(right.connectorId)
  )[0];
}

function compareBundleClaimsCanonical(
  left: GutterLocalBundleClaim,
  right: GutterLocalBundleClaim,
  connectorPlanById: ReadonlyMap<string, ServiceBlueprintConnectorPlan>
): number {
  return left.nominalCoordinate - right.nominalCoordinate
    || compareOrderingKey(
      connectorPlanById.get(left.connectorId)?.orderingKey ?? {
        edgeFamilyRank: 0,
        precedesSubtypeRank: 0,
        sourceLaneOrder: 0,
        sourceColumnOrder: 0,
        sourceAuthorOrder: 0,
        outgoingOrder: 0,
        destinationStableId: left.connectorId
      },
      connectorPlanById.get(right.connectorId)?.orderingKey ?? {
        edgeFamilyRank: 0,
        precedesSubtypeRank: 0,
        sourceLaneOrder: 0,
        sourceColumnOrder: 0,
        sourceAuthorOrder: 0,
        outgoingOrder: 0,
        destinationStableId: right.connectorId
      }
    )
    || left.routeSegmentIndex - right.routeSegmentIndex
    || left.connectorId.localeCompare(right.connectorId);
}

function buildGutterLocalBundleResolution(
  connectorPlans: readonly ServiceBlueprintConnectorPlan[],
  routesByConnectorId: ReadonlyMap<string, PositionedRoute>,
  occupancy: readonly ServiceBlueprintGutterOccupancy[],
  scene: PositionedScene,
  index: PositionedBlueprintIndex,
  globalGutterState: ServiceBlueprintGlobalGutterState
): GutterLocalBundleResolution {
  const endpointCoordinateByEndpointKey = new Map<string, number>();
  const segmentCoordinateBySegmentKey = new Map<string, number>();
  const lockedSegmentKeys = new Set<string>();
  const requiredColumnExpansions: Record<number, number> = {};
  const requiredLaneExpansions: Record<number, number> = {};
  const connectorPlanById = new Map(connectorPlans.map((connector) => [connector.id, connector] as const));
  const routeSegmentCountByConnectorId = new Map(
    connectorPlans.map((connector) => [
      connector.id,
      buildRouteSegmentDetails(routesByConnectorId.get(connector.id) ?? connector.step3Route).length
    ] as const)
  );
  const bundleRectByKey = new Map(
    buildGutterRects(scene, index, globalGutterState)
      .filter((rect) => rect.kind === "node_bottom" || rect.kind === "node_right")
      .map((rect) => [rect.key, rect] as const)
  );
  const occupancyByBundleKey = new Map<string, ServiceBlueprintGutterOccupancy[]>();

  for (const entry of occupancy) {
    if (!isBundleLocalKind(entry.kind)) {
      continue;
    }
    const existing = occupancyByBundleKey.get(entry.key) ?? [];
    existing.push(entry);
    occupancyByBundleKey.set(entry.key, existing);
  }

  occupancyByBundleKey.forEach((group, bundleKey) => {
    const rect = bundleRectByKey.get(bundleKey);
    if (!rect || !isBundleLocalKind(rect.kind)) {
      return;
    }

    const entriesByConnectorId = new Map<string, ServiceBlueprintGutterOccupancy[]>();
    for (const entry of group) {
      const existing = entriesByConnectorId.get(entry.connectorId) ?? [];
      existing.push(entry);
      entriesByConnectorId.set(entry.connectorId, existing);
    }

    const claims: GutterLocalBundleClaim[] = [];
    const fixedInnerOwners: Array<{ coordinate: number; extent: number }> = [];

    for (const [connectorId, connectorEntries] of entriesByConnectorId.entries()) {
      const connector = connectorPlanById.get(connectorId);
      if (!connector) {
        continue;
      }

      const routeSegmentCount = routeSegmentCountByConnectorId.get(connectorId) ?? 0;
      const chosenClaim = chooseBundleClaimEntry(connectorEntries, connector, routeSegmentCount, rect.kind);
      const inwardOwnedEntries = connectorEntries.filter((entry) => touchesInnerBoundary(entry, rect));
      const outwardOwnedEntries = connectorEntries.filter((entry) => touchesOuterBoundary(entry, rect));

      const sourceEndpointKey = chosenClaim && rect.nodeId === connector.from && chosenClaim.routeSegmentIndex === 1
        && matchesBundleSourceSide(rect.kind, connector.sourceSide)
        ? buildEdgeLocalEndpointKey(connector.id, "source")
        : undefined;
      const targetEndpointKey = chosenClaim && rect.nodeId === connector.to && chosenClaim.routeSegmentIndex === routeSegmentCount - 2
        && matchesBundleTargetSide(rect.kind, connector.targetSide)
        ? buildEdgeLocalEndpointKey(connector.id, "target")
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
        laneOrder: chosenClaim.laneOrder
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
        if (compareBundleClaimsCanonical(leftClaim, rightClaim, connectorPlanById) <= 0) {
          addEdge(leftIndex, rightIndex);
        } else {
          addEdge(rightIndex, leftIndex);
        }
      }
    }

    const indegree = new Map<number, number>();
    claims.forEach((_, indexClaim) => indegree.set(indexClaim, 0));
    edges.forEach((targets) => {
      targets.forEach((targetIndex) => indegree.set(targetIndex, (indegree.get(targetIndex) ?? 0) + 1));
    });

    const remaining = new Set(claims.map((_, indexClaim) => indexClaim));
    const orderedClaimIndices: number[] = [];
    while (remaining.size > 0) {
      const available = [...remaining]
        .filter((indexClaim) => (indegree.get(indexClaim) ?? 0) === 0)
        .sort((leftIndex, rightIndex) =>
          compareBundleClaimsCanonical(claims[leftIndex]!, claims[rightIndex]!, connectorPlanById)
        );
      if (available.length === 0) {
        orderedClaimIndices.push(
          ...[...remaining].sort((leftIndex, rightIndex) =>
            compareBundleClaimsCanonical(claims[leftIndex]!, claims[rightIndex]!, connectorPlanById)
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

    const claimIndexByConnectorId = new Map(claims.map((claim, indexClaim) => [claim.connectorId, indexClaim] as const));
    const assignedCoordinateByClaimIndex = new Map<number, number>();
    for (const claimIndex of orderedClaimIndices) {
      const claim = claims[claimIndex]!;
      let assignedCoordinate = claim.nominalCoordinate;

      for (const owner of fixedInnerOwners) {
        if (spansContainCoordinate(claim.spanStart, claim.spanEnd, owner.coordinate)) {
          assignedCoordinate = Math.max(assignedCoordinate, owner.extent + FIXED_SEPARATION_DISTANCE);
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
          assignedCoordinate = Math.max(assignedCoordinate, predecessorCoordinate + FIXED_SEPARATION_DISTANCE);
        }
      }

      assignedCoordinate = roundMetric(assignedCoordinate);
      assignedCoordinateByClaimIndex.set(claimIndex, assignedCoordinate);
      const segmentKey = buildSegmentDisplacementKey(claim.connectorId, claim.routeSegmentIndex);
      const shouldApplyBundleCoordinate = (claim.sourceEndpointKey !== undefined || claim.targetEndpointKey !== undefined)
        && (claims.length > 1
          || fixedInnerOwners.length > 0
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

      if (rect.kind === "node_bottom" && claim.laneOrder !== undefined) {
        const availableLimit = roundMetric(rect.y + rect.height);
        const overflow = roundMetric(assignedCoordinate - availableLimit);
        if (overflow > 0) {
          requiredLaneExpansions[claim.laneOrder] = roundUpToSeparationDistance(
            Math.max(requiredLaneExpansions[claim.laneOrder] ?? 0, overflow)
          );
        }
      }
      if (rect.kind === "node_right" && claim.columnOrder !== undefined) {
        const availableLimit = roundMetric(rect.x + rect.width);
        const overflow = roundMetric(assignedCoordinate - availableLimit);
        if (overflow > 0) {
          requiredColumnExpansions[claim.columnOrder] = roundUpToSeparationDistance(
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
    requiredLaneExpansions
  };
}

function resolveEdgeLocalFanOutCoordinates(
  connectorPlans: readonly ServiceBlueprintConnectorPlan[],
  occupancy: readonly ServiceBlueprintGutterOccupancy[]
): Map<string, number> {
  const connectorPlanById = new Map(connectorPlans.map((connector) => [connector.id, connector] as const));
  const grouped = new Map<string, ServiceBlueprintGutterOccupancy[]>();

  for (const entry of occupancy) {
    if (!isEdgeLocalKind(entry.kind)) {
      continue;
    }
    const key = `${entry.key}|${entry.axis}`;
    const existing = grouped.get(key) ?? [];
    existing.push(entry);
    grouped.set(key, existing);
  }

  const assignedCoordinateByEndpointKey = new Map<string, number>();

  const compareByPriority = (left: ServiceBlueprintGutterOccupancy, right: ServiceBlueprintGutterOccupancy): number => {
    const leftConnector = connectorPlanById.get(left.connectorId);
    const rightConnector = connectorPlanById.get(right.connectorId);
    if (!leftConnector || !rightConnector) {
      return left.connectorId.localeCompare(right.connectorId);
    }
    return compareOrderingKey(leftConnector.orderingKey, rightConnector.orderingKey)
      || left.routeSegmentIndex - right.routeSegmentIndex
      || left.connectorId.localeCompare(right.connectorId);
  };

  grouped.forEach((group) => {
    const side = group[0]?.side;
    if (!side) {
      return;
    }
    const direction = getOutwardDirectionForSide(side);
    const visited = new Set<number>();

    const getAssignedCoordinate = (entry: ServiceBlueprintGutterOccupancy): number =>
      assignedCoordinateByEndpointKey.get(
        buildEdgeLocalEndpointKey(entry.connectorId, entry.endpointRole ?? "source")
      ) ?? entry.nominalCoordinate;

    const touchesOrOverlaps = (left: ServiceBlueprintGutterOccupancy, right: ServiceBlueprintGutterOccupancy): boolean =>
      spansTouchOrOverlap(left.spanStart, left.spanEnd, right.spanStart, right.spanEnd)
      && Math.abs(getAssignedCoordinate(left) - getAssignedCoordinate(right)) < FIXED_SEPARATION_DISTANCE;

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
          if (touchesOrOverlaps(group[currentIndex]!, group[candidateIndex]!)) {
            visited.add(candidateIndex);
            queue.push(candidateIndex);
          }
        }
      }

      const component = componentIndices.map((componentIndex) => group[componentIndex]!);
      component.sort(compareByPriority);

      let frontier: number | undefined;
      for (const entry of component) {
        const currentCoordinate = getAssignedCoordinate(entry);
        const assignedCoordinate = frontier === undefined
          ? currentCoordinate
          : direction > 0
            ? roundMetric(Math.max(currentCoordinate, frontier + FIXED_SEPARATION_DISTANCE))
            : roundMetric(Math.min(currentCoordinate, frontier - FIXED_SEPARATION_DISTANCE));
        frontier = assignedCoordinate;
        assignedCoordinateByEndpointKey.set(
          buildEdgeLocalEndpointKey(entry.connectorId, entry.endpointRole ?? "source"),
          assignedCoordinate
        );
      }
    }
  });

  return assignedCoordinateByEndpointKey;
}

function resolveOccupancyDisplacements(
  connectorPlans: readonly ServiceBlueprintConnectorPlan[],
  occupancy: readonly ServiceBlueprintGutterOccupancy[],
  lockedSegmentKeys: ReadonlySet<string> = new Set<string>()
): Map<string, number> {
  const displacementBySegmentKey = new Map<string, number>();
  const connectorPlanById = new Map(connectorPlans.map((connector) => [connector.id, connector] as const));
  const genericGroups = new Map<string, ServiceBlueprintGutterOccupancy[]>();
  const obstacleLocalGroups = new Map<string, ServiceBlueprintGutterOccupancy[]>();

  for (const entry of occupancy) {
    if (isEdgeLocalKind(entry.kind) || entry.kind === "node_bottom" || entry.kind === "node_right") {
      continue;
    }
    const key = `${entry.key}|${entry.axis}`;
    const targetGroups = isObstacleLocalKind(entry.kind) ? obstacleLocalGroups : genericGroups;
    const existing = targetGroups.get(key) ?? [];
    existing.push(entry);
    targetGroups.set(key, existing);
  }

  const processGroups = (
    groups: ReadonlyMap<string, ServiceBlueprintGutterOccupancy[]>,
    compareEntries: (left: ServiceBlueprintGutterOccupancy, right: ServiceBlueprintGutterOccupancy) => number
  ): void => {
    groups.forEach((group) => {
    const visited = new Set<number>();

      const getEffectiveCoordinate = (entry: ServiceBlueprintGutterOccupancy): number =>
        roundMetric(entry.nominalCoordinate + (displacementBySegmentKey.get(
          buildSegmentDisplacementKey(entry.connectorId, entry.routeSegmentIndex)
        ) ?? 0));

      const overlaps = (left: ServiceBlueprintGutterOccupancy, right: ServiceBlueprintGutterOccupancy): boolean =>
        spansOverlap(left.spanStart, left.spanEnd, right.spanStart, right.spanEnd)
        && Math.abs(getEffectiveCoordinate(left) - getEffectiveCoordinate(right)) < FIXED_SEPARATION_DISTANCE;

      const isLocked = (entry: ServiceBlueprintGutterOccupancy): boolean =>
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
            if (assignedCoordinate < occupiedEntry.coordinate + FIXED_SEPARATION_DISTANCE) {
              assignedCoordinate = roundMetric(occupiedEntry.coordinate + FIXED_SEPARATION_DISTANCE);
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

  const compareByPriority = (left: ServiceBlueprintGutterOccupancy, right: ServiceBlueprintGutterOccupancy): number => {
    const leftConnector = connectorPlanById.get(left.connectorId);
    const rightConnector = connectorPlanById.get(right.connectorId);
    if (!leftConnector || !rightConnector) {
      return left.connectorId.localeCompare(right.connectorId);
    }
    return compareOrderingKey(leftConnector.orderingKey, rightConnector.orderingKey)
      || left.routeSegmentIndex - right.routeSegmentIndex
      || left.connectorId.localeCompare(right.connectorId);
  };

  const compareByObstacleOwnership = (left: ServiceBlueprintGutterOccupancy, right: ServiceBlueprintGutterOccupancy): number => {
    return (left.ownershipRank ?? 0) - (right.ownershipRank ?? 0)
      || compareByPriority(left, right);
  };

  processGroups(genericGroups, compareByPriority);
  processGroups(obstacleLocalGroups, compareByObstacleOwnership);

  return displacementBySegmentKey;
}

function roundUpToSeparationDistance(value: number): number {
  if (value <= 0) {
    return 0;
  }
  return roundMetric(Math.ceil(value / FIXED_SEPARATION_DISTANCE) * FIXED_SEPARATION_DISTANCE);
}

function applyGlobalGutterExpansions(
  scene: PositionedScene,
  cells: readonly ServiceBlueprintMiddleCell[],
  columnExpansions: Record<number, number>,
  laneExpansions: Record<number, number>
): PositionedScene {
  const shifted = clonePositionedScene(scene);
  const cellMap = new Map(cells.map((cell) => [cell.id, cell] as const));
  const cumulativeColumnShift = new Map<number, number>();
  const cumulativeLaneShift = new Map<number, number>();

  [...new Set(cells.map((cell) => cell.columnOrder))]
    .sort((left, right) => left - right)
    .forEach((columnOrder) => {
      const shift = [...Object.entries(columnExpansions)]
        .map(([key, value]) => [Number(key), value] as const)
        .filter(([candidateOrder]) => candidateOrder < columnOrder)
        .reduce((sum, [, value]) => sum + value, 0);
      cumulativeColumnShift.set(columnOrder, roundMetric(shift));
    });
  [...new Set(cells.map((cell) => cell.rowOrder))]
    .sort((left, right) => left - right)
    .forEach((rowOrder) => {
      const shift = [...Object.entries(laneExpansions)]
        .map(([key, value]) => [Number(key), value] as const)
        .filter(([candidateOrder]) => candidateOrder < rowOrder)
        .reduce((sum, [, value]) => sum + value, 0);
      cumulativeLaneShift.set(rowOrder, roundMetric(shift));
    });

  for (const child of shifted.root.children) {
    if (!isServiceBlueprintCell(child)) {
      continue;
    }
    const meta = cellMap.get(child.id);
    if (!meta) {
      continue;
    }
    translatePositionedItem(
      child,
      cumulativeColumnShift.get(meta.columnOrder) ?? 0,
      cumulativeLaneShift.get(meta.rowOrder) ?? 0
    );
  }

  updateRootSize(shifted.root);
  return shifted;
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

function resolveRequiredColumnExpansions(
  occupancy: readonly ServiceBlueprintGutterOccupancy[],
  index: PositionedBlueprintIndex,
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
      required[entry.columnOrder] = roundUpToSeparationDistance(
        Math.max(required[entry.columnOrder] ?? 0, overflow)
      );
    }
  }

  return required;
}

function resolveRequiredLaneExpansions(
  occupancy: readonly ServiceBlueprintGutterOccupancy[],
  index: PositionedBlueprintIndex,
  displacementBySegmentKey: ReadonlyMap<string, number>
): Record<number, number> {
  const required: Record<number, number> = {};

  for (const entry of occupancy) {
    if (entry.axis !== "horizontal" || entry.laneOrder === undefined) {
      continue;
    }
    const displacement = displacementBySegmentKey.get(
      buildSegmentDisplacementKey(entry.connectorId, entry.routeSegmentIndex)
    ) ?? 0;
    const nextRowTop = getNextValue(index.rowTopByOrder, entry.laneOrder);
    if (nextRowTop === undefined) {
      continue;
    }
    const effectiveCoordinate = roundMetric(entry.nominalCoordinate + displacement);
    const overflow = roundMetric(effectiveCoordinate - (nextRowTop - GUTTER_OVERFLOW_TOLERANCE));
    if (overflow > 0) {
      required[entry.laneOrder] = roundUpToSeparationDistance(
        Math.max(required[entry.laneOrder] ?? 0, overflow)
      );
    }
  }

  return required;
}

function buildFinalRoute(
  connector: ServiceBlueprintConnectorPlan,
  index: PositionedBlueprintIndex,
  endpointOffsetsByNodeId: ReadonlyMap<string, Map<PortSide, Map<string, number>>>,
  displacementBySegmentKey: ReadonlyMap<string, number>,
  bundleEndpointCoordinateByEndpointKey: ReadonlyMap<string, number>,
  bundleSegmentCoordinateBySegmentKey: ReadonlyMap<string, number>
): ConnectorRouteState {
  const source = index.nodeById.get(connector.from);
  const target = index.nodeById.get(connector.to);
  if (!source || !target) {
    return {
      route: connector.step3Route,
      occupiedGutters: connector.occupiedGutters
    };
  }

  const sourceOffset = endpointOffsetsByNodeId.get(connector.from)?.get(connector.sourceSide)?.get(connector.id) ?? 0;
  const targetOffset = endpointOffsetsByNodeId.get(connector.to)?.get(connector.targetSide)?.get(connector.id) ?? 0;
  const sourcePoint = getSidePointWithOffset(source, connector.sourceSide, sourceOffset);
  const targetPoint = getSidePointWithOffset(target, connector.targetSide, targetOffset);
  const sourceBundleCoordinate = bundleEndpointCoordinateByEndpointKey.get(
    buildEdgeLocalEndpointKey(connector.id, "source")
  );
  const targetBundleCoordinate = bundleEndpointCoordinateByEndpointKey.get(
    buildEdgeLocalEndpointKey(connector.id, "target")
  );
  const segments = buildRouteSegmentDetails(connector.step3Route);

  if (segments.length === 0) {
    return {
      route: buildPositionedRoute([sourcePoint, targetPoint]),
      occupiedGutters: connector.occupiedGutters
    };
  }

  if (segments.length === 1) {
    const onlySegment = segments[0]!;
    if (onlySegment.orientation === "vertical") {
      const displacement = displacementBySegmentKey.get(
        buildSegmentDisplacementKey(connector.id, onlySegment.routeSegmentIndex)
      ) ?? 0;
      const bridgeX = roundMetric(Math.max(sourcePoint.x, targetPoint.x, onlySegment.coordinate + displacement));
      if (bridgeX === sourcePoint.x && bridgeX === targetPoint.x) {
        return {
          route: buildPositionedRoute([sourcePoint, targetPoint]),
          occupiedGutters: connector.occupiedGutters
        };
      }

      const direction = sourcePoint.y <= targetPoint.y ? 1 : -1;
      const sourceStubY = sourceBundleCoordinate
        ?? roundMetric(sourcePoint.y + direction * FIXED_SEPARATION_DISTANCE);
      const targetStubY = targetBundleCoordinate
        ?? roundMetric(targetPoint.y - direction * FIXED_SEPARATION_DISTANCE);
      const route = buildPositionedRoute([
        sourcePoint,
        { x: sourcePoint.x, y: sourceStubY },
        { x: bridgeX, y: sourceStubY },
        { x: bridgeX, y: targetStubY },
        { x: targetPoint.x, y: targetStubY },
        targetPoint
      ]);
      return {
        route,
        bridgeX: getFirstInternalVerticalCoordinate(route),
        occupiedGutters: connector.occupiedGutters
      };
    }

    const displacement = displacementBySegmentKey.get(
      buildSegmentDisplacementKey(connector.id, onlySegment.routeSegmentIndex)
    ) ?? 0;
    const bridgeY = roundMetric(Math.max(sourcePoint.y, targetPoint.y, onlySegment.coordinate + displacement));
    const direction = sourcePoint.x <= targetPoint.x ? 1 : -1;
    const sourceStubX = sourceBundleCoordinate
      ?? roundMetric(sourcePoint.x + direction * FIXED_SEPARATION_DISTANCE);
    const targetStubX = targetBundleCoordinate
      ?? roundMetric(targetPoint.x - direction * FIXED_SEPARATION_DISTANCE);
    const route = bridgeY === sourcePoint.y
      && bridgeY === targetPoint.y
      && sourceStubX === sourcePoint.x
      && targetStubX === targetPoint.x
      ? buildPositionedRoute([sourcePoint, targetPoint])
      : buildPositionedRoute([
        sourcePoint,
        { x: sourceStubX, y: sourcePoint.y },
        { x: sourceStubX, y: bridgeY },
        { x: targetStubX, y: bridgeY },
        { x: targetStubX, y: targetPoint.y },
        targetPoint
      ]);
    return {
      route,
      bridgeY: bridgeY === sourcePoint.y && bridgeY === targetPoint.y ? undefined : bridgeY,
      occupiedGutters: connector.occupiedGutters
    };
  }

  const adjustedSegments = segments.map((segment, segmentIndex) => {
    const bundleCoordinate = bundleSegmentCoordinateBySegmentKey.get(
      buildSegmentDisplacementKey(connector.id, segment.routeSegmentIndex)
    );
    if (segment.orientation === "vertical") {
      if (segmentIndex === 0) {
        return {
          orientation: "vertical" as const,
          coordinate: sourcePoint.x
        };
      }
      if (segmentIndex === segments.length - 1) {
        return {
          orientation: "vertical" as const,
          coordinate: targetPoint.x
        };
      }
      return {
        orientation: "vertical" as const,
        coordinate: bundleCoordinate ?? roundMetric(
          segment.coordinate + (displacementBySegmentKey.get(
            buildSegmentDisplacementKey(connector.id, segment.routeSegmentIndex)
          ) ?? 0)
        )
      };
    }

    if (segmentIndex === 0) {
      return {
        orientation: "horizontal" as const,
        coordinate: sourcePoint.y
      };
    }
    if (segmentIndex === segments.length - 1) {
      return {
        orientation: "horizontal" as const,
        coordinate: targetPoint.y
      };
    }
    return {
      orientation: "horizontal" as const,
      coordinate: bundleCoordinate ?? roundMetric(
        segment.coordinate + (displacementBySegmentKey.get(
          buildSegmentDisplacementKey(connector.id, segment.routeSegmentIndex)
        ) ?? 0)
      )
    };
  });

  const points: Point[] = [sourcePoint];
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
  points.push(targetPoint);

  const route = buildPositionedRoute(points);
  return {
    route,
    bridgeX: getFirstInternalVerticalCoordinate(route),
    bridgeY: getFirstInternalHorizontalCoordinate(route),
    occupiedGutters: connector.occupiedGutters
  };
}

function buildRouteStatesForConnectors(
  connectorPlans: readonly ServiceBlueprintConnectorPlan[],
  index: PositionedBlueprintIndex,
  endpointOffsetsByNodeId: ReadonlyMap<string, Map<PortSide, Map<string, number>>>,
  displacementBySegmentKey: ReadonlyMap<string, number>,
  bundleEndpointCoordinateByEndpointKey: ReadonlyMap<string, number>,
  bundleSegmentCoordinateBySegmentKey: ReadonlyMap<string, number>
): Map<string, ConnectorRouteState> {
  const routeStates = new Map<string, ConnectorRouteState>();

  for (const connector of connectorPlans) {
    routeStates.set(
      connector.id,
      buildFinalRoute(
        connector,
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

function buildGutterLocalPreparedRoutes(
  connectorPlans: readonly ServiceBlueprintConnectorPlan[],
  scene: PositionedScene,
  index: PositionedBlueprintIndex,
  globalGutterState: ServiceBlueprintGlobalGutterState,
  endpointOffsetsByNodeId: ReadonlyMap<string, Map<PortSide, Map<string, number>>>
): {
  bundleEndpointCoordinateByEndpointKey: Map<string, number>;
  bundleSegmentCoordinateBySegmentKey: Map<string, number>;
  lockedBundleSegmentKeys: Set<string>;
  requiredColumnExpansions: Record<number, number>;
  requiredLaneExpansions: Record<number, number>;
  routeStates: Map<string, ConnectorRouteState>;
  occupancyResult: {
    occupancy: ServiceBlueprintGutterOccupancy[];
    occupancyByConnectorId: Map<string, ServiceBlueprintGutterOccupancy[]>;
  };
  connectorPlansWithOccupancy: ServiceBlueprintConnectorPlan[];
} {
  const nominalRouteStates = buildRouteStatesForConnectors(
    connectorPlans,
    index,
    endpointOffsetsByNodeId,
    new Map<string, number>(),
    new Map<string, number>(),
    new Map<string, number>()
  );
  const nominalOccupancyResult = extractGutterOccupancyByConnector(
    connectorPlans,
    new Map([...nominalRouteStates.entries()].map(([connectorId, state]) => [connectorId, state.route] as const)),
    scene,
    index,
    globalGutterState
  );
  const gutterLocalBundleResolution = buildGutterLocalBundleResolution(
    connectorPlans,
    new Map([...nominalRouteStates.entries()].map(([connectorId, state]) => [connectorId, state.route] as const)),
    nominalOccupancyResult.occupancy,
    scene,
    index,
    globalGutterState
  );
  const routeStates = buildRouteStatesForConnectors(
    connectorPlans,
    index,
    endpointOffsetsByNodeId,
    new Map<string, number>(),
    gutterLocalBundleResolution.endpointCoordinateByEndpointKey,
    gutterLocalBundleResolution.segmentCoordinateBySegmentKey
  );
  const occupancyResult = extractGutterOccupancyByConnector(
    connectorPlans,
    new Map([...routeStates.entries()].map(([connectorId, state]) => [connectorId, state.route] as const)),
    scene,
    index,
    globalGutterState
  );

  return {
    bundleEndpointCoordinateByEndpointKey: gutterLocalBundleResolution.endpointCoordinateByEndpointKey,
    bundleSegmentCoordinateBySegmentKey: gutterLocalBundleResolution.segmentCoordinateBySegmentKey,
    lockedBundleSegmentKeys: gutterLocalBundleResolution.lockedSegmentKeys,
    requiredColumnExpansions: gutterLocalBundleResolution.requiredColumnExpansions,
    requiredLaneExpansions: gutterLocalBundleResolution.requiredLaneExpansions,
    routeStates,
    occupancyResult,
    connectorPlansWithOccupancy: connectorPlans.map((connector) => ({
      ...connector,
      occupiedGutters: occupancyResult.occupancyByConnectorId.get(connector.id) ?? []
    }))
  };
}

function buildPositionedEdges(
  connectorPlans: readonly ServiceBlueprintConnectorPlan[],
  routesByConnectorId: ReadonlyMap<string, ConnectorRouteState>
): PositionedEdge[] {
  return connectorPlans.map((connector) => {
    const routeState = routesByConnectorId.get(connector.id);
    const route = routeState?.route ?? connector.finalRoute;
    const start = route.points[0]!;
    const end = route.points[route.points.length - 1]!;
    return {
      id: connector.id,
      role: connector.role,
      classes: [...connector.classes],
      from: {
        itemId: connector.from,
        x: start.x,
        y: start.y
      },
      to: {
        itemId: connector.to,
        x: end.x,
        y: end.y
      },
      route,
      label: undefined,
      markers: connector.markers,
      paintGroup: "edges"
    };
  });
}

function buildStageScene(
  baseScene: PositionedScene,
  edges: PositionedEdge[],
  diagnostics: RendererDiagnostic[]
): PositionedScene {
  return {
    ...clonePositionedScene(baseScene),
    edges,
    decorations: [],
    diagnostics: sortRendererDiagnostics(diagnostics)
  };
}

function routeIntersectsForbiddenBoxes(
  edges: readonly PositionedEdge[],
  boxes: ReadonlyArray<{ itemId: string; x: number; y: number; width: number; height: number }>
): string[] {
  const offending: string[] = [];
  for (const edge of edges) {
    const blockingBoxes = boxes.filter((box) => box.itemId !== edge.from.itemId && box.itemId !== edge.to.itemId);
    const intersects = collectIntersectingBoxes(edge.route.points, blockingBoxes);
    if (intersects.length > 0) {
      offending.push(edge.id);
    }
  }
  return offending;
}

export function buildServiceBlueprintRoutingStages(
  baseScene: PositionedScene,
  rendererScene: RendererScene,
  middleLayer: ServiceBlueprintMiddleLayerModel,
  authorOrderByNodeId: ReadonlyMap<string, number>
): ServiceBlueprintRoutingStagesResult {
  const baseIndex = buildIndex(baseScene.root, middleLayer.cells, authorOrderByNodeId);
  const connectorPlanResult = buildConnectorPlans(rendererScene.edges, middleLayer, baseIndex);
  const connectorPlans = connectorPlanResult.connectorPlans;
  const stage2Diagnostics: RendererDiagnostic[] = [...baseScene.diagnostics, ...connectorPlanResult.diagnostics];
  const bucketsByNodeId = buildNodeEdgeBuckets(connectorPlans, baseIndex);
  const nodeGutters = buildNodeGutters(baseIndex);

  const step2Scene = buildStageScene(
    baseScene,
    buildPositionedEdges(
      connectorPlans,
      new Map(connectorPlans.map((connector) => [connector.id, {
        route: connector.step2Route,
        occupiedGutters: []
      }]))
    ),
    stage2Diagnostics
  );

  const step3Diagnostics: RendererDiagnostic[] = [...baseScene.diagnostics, ...connectorPlanResult.diagnostics];
  const zeroGlobalGutterState = buildGlobalGutterState();
  const step3Build = buildStep3ConnectorPlansForScene(
    connectorPlans,
    baseScene,
    baseIndex,
    bucketsByNodeId,
    step3Diagnostics,
    zeroGlobalGutterState
  );
  const step3RouteStates = step3Build.routeStates;
  const step3ConnectorPlans = step3Build.connectorPlans;
  const step3Occupancy = step3Build.occupancy;
  const step3Scene = buildStageScene(
    baseScene,
    buildPositionedEdges(step3ConnectorPlans, step3RouteStates),
    step3Diagnostics
  );

  const step3BucketsByNodeId = buildNodeEdgeBuckets(step3ConnectorPlans, baseIndex);
  let workingScene = baseScene;
  let workingIndex = baseIndex;
  let workingGlobalGutterState = buildGlobalGutterState();
  let workingConnectorPlans = step3ConnectorPlans;
  let workingBucketsByNodeId = step3BucketsByNodeId;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const endpointOffsetsByNodeId = buildEndpointOffsets(workingIndex, workingBucketsByNodeId);
    const gutterLocalPrepared = buildGutterLocalPreparedRoutes(
      workingConnectorPlans,
      workingScene,
      workingIndex,
      workingGlobalGutterState,
      endpointOffsetsByNodeId
    );
    const nominalOccupancyResult = gutterLocalPrepared.occupancyResult;
    const nominalConnectorPlans = gutterLocalPrepared.connectorPlansWithOccupancy;
    const displacementBySegmentKey = resolveOccupancyDisplacements(
      nominalConnectorPlans,
      nominalOccupancyResult.occupancy,
      gutterLocalPrepared.lockedBundleSegmentKeys
    );
    const columnExpansions = accumulateExpansions(
      gutterLocalPrepared.requiredColumnExpansions,
      resolveRequiredColumnExpansions(
        nominalOccupancyResult.occupancy,
        workingIndex,
        displacementBySegmentKey
      )
    );
    const laneExpansions = accumulateExpansions(
      gutterLocalPrepared.requiredLaneExpansions,
      resolveRequiredLaneExpansions(
        nominalOccupancyResult.occupancy,
        workingIndex,
        displacementBySegmentKey
      )
    );

    if (!hasNonZeroExpansion(columnExpansions) && !hasNonZeroExpansion(laneExpansions)) {
      workingConnectorPlans = nominalConnectorPlans;
      break;
    }

    workingGlobalGutterState = buildGlobalGutterState(
      accumulateExpansions(workingGlobalGutterState.columnExpansions, columnExpansions),
      accumulateExpansions(workingGlobalGutterState.laneExpansions, laneExpansions)
    );
    workingScene = applyGlobalGutterExpansions(workingScene, middleLayer.cells, columnExpansions, laneExpansions);
    workingIndex = buildIndex(workingScene.root, middleLayer.cells, authorOrderByNodeId);
    const iterationDiagnostics: RendererDiagnostic[] = [];
    const rerouted = buildStep3ConnectorPlansForScene(
      connectorPlans,
      workingScene,
      workingIndex,
      workingBucketsByNodeId,
      iterationDiagnostics,
      workingGlobalGutterState
    );
    workingConnectorPlans = rerouted.connectorPlans;
    workingBucketsByNodeId = buildNodeEdgeBuckets(workingConnectorPlans, workingIndex);
  }

  const finalDiagnostics: RendererDiagnostic[] = [...baseScene.diagnostics, ...connectorPlanResult.diagnostics];
  const finalStep3Build = buildStep3ConnectorPlansForScene(
    connectorPlans,
    workingScene,
    workingIndex,
    workingBucketsByNodeId,
    finalDiagnostics,
    workingGlobalGutterState
  );
  const finalStep3ConnectorPlans = finalStep3Build.connectorPlans;
  const finalBucketsByNodeId = buildNodeEdgeBuckets(finalStep3ConnectorPlans, workingIndex);
  const finalEndpointOffsetsByNodeId = buildEndpointOffsets(workingIndex, finalBucketsByNodeId);
  const gutterLocalPreparedFinal = buildGutterLocalPreparedRoutes(
    finalStep3ConnectorPlans,
    workingScene,
    workingIndex,
    workingGlobalGutterState,
    finalEndpointOffsetsByNodeId
  );
  const nominalFinalConnectorPlans = gutterLocalPreparedFinal.connectorPlansWithOccupancy;
  const finalDisplacementBySegmentKey = resolveOccupancyDisplacements(
    nominalFinalConnectorPlans,
    gutterLocalPreparedFinal.occupancyResult.occupancy,
    gutterLocalPreparedFinal.lockedBundleSegmentKeys
  );
  const finalRouteStates = buildRouteStatesForConnectors(
    nominalFinalConnectorPlans,
    workingIndex,
    finalEndpointOffsetsByNodeId,
    finalDisplacementBySegmentKey,
    gutterLocalPreparedFinal.bundleEndpointCoordinateByEndpointKey,
    gutterLocalPreparedFinal.bundleSegmentCoordinateBySegmentKey
  );
  const finalOccupancyResult = extractGutterOccupancyByConnector(
    nominalFinalConnectorPlans,
    new Map([...finalRouteStates.entries()].map(([connectorId, state]) => [connectorId, state.route] as const)),
    workingScene,
    workingIndex,
    workingGlobalGutterState
  );
  const finalConnectorPlans = nominalFinalConnectorPlans.map((connector) => {
    const routeState = finalRouteStates.get(connector.id);
    const occupiedGutters = finalOccupancyResult.occupancyByConnectorId.get(connector.id) ?? [];
    if (routeState) {
      routeState.occupiedGutters = occupiedGutters;
    }
    return {
      ...connector,
      finalRoute: routeState?.route ?? connector.step3Route,
      occupiedGutters
    };
  });
  const finalEdges = buildPositionedEdges(finalConnectorPlans, finalRouteStates);
  const offendingEdges = routeIntersectsForbiddenBoxes(finalEdges, workingIndex.allNodeBoxes);
  for (const edgeId of offendingEdges) {
    finalDiagnostics.push(
      createRoutingDiagnostic(
        "renderer.routing.service_blueprint_node_intersection",
        `Final routed service_blueprint connector "${edgeId}" still intersects a non-endpoint node box.`,
        edgeId,
        "error"
      )
    );
  }

  const finalScene = buildStageScene(workingScene, finalEdges, finalDiagnostics);

  return {
    step2: {
      positionedScene: step2Scene,
      connectorPlans,
      nodeEdgeBuckets: [...bucketsByNodeId.values()],
      nodeGutters,
      globalGutterState: buildGlobalGutterState(),
      gutterOccupancy: [],
      diagnostics: sortRendererDiagnostics(stage2Diagnostics)
    },
    step3: {
      positionedScene: step3Scene,
      connectorPlans: step3ConnectorPlans,
      nodeEdgeBuckets: [...step3BucketsByNodeId.values()],
      nodeGutters,
      globalGutterState: buildGlobalGutterState(),
      gutterOccupancy: step3Occupancy,
      diagnostics: sortRendererDiagnostics(step3Diagnostics)
    },
    final: {
      positionedScene: finalScene,
      connectorPlans: finalConnectorPlans,
      nodeEdgeBuckets: [...finalBucketsByNodeId.values()],
      nodeGutters: buildNodeGutters(workingIndex),
      globalGutterState: workingGlobalGutterState,
      gutterOccupancy: finalOccupancyResult.occupancy,
      diagnostics: sortRendererDiagnostics(finalDiagnostics)
    }
  };
}
