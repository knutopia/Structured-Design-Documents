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
const GUTTER_CLEARANCE = 8;
const ROOT_PADDING_FALLBACK = 28;

type ConnectorPattern =
  | "precedes_same_row"
  | "precedes_stair"
  | "same_row_bottom"
  | "vertical_direct"
  | "vertical_bridge";

type GutterAxis = "vertical" | "horizontal";
type GutterKind = "node_right" | "node_bottom" | "column" | "lane";

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
  columnOrder?: number;
  laneOrder?: number;
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

export interface ServiceBlueprintConnectorPlan {
  id: string;
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

function getVerticalBridgeX(route: PositionedRoute): number | undefined {
  if (route.points.length < 4) {
    return undefined;
  }

  const first = route.points[0]!;
  const second = route.points[1]!;
  const third = route.points[2]!;
  if (first.y !== second.y || second.x !== third.x) {
    return undefined;
  }

  return second.x;
}

function getHorizontalBridgeY(route: PositionedRoute): number | undefined {
  if (route.points.length < 4) {
    return undefined;
  }

  const first = route.points[0]!;
  const second = route.points[1]!;
  const third = route.points[2]!;
  if (first.x !== second.x || second.y !== third.y) {
    return undefined;
  }

  return second.y;
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
    case "vertical_bridge":
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
): ServiceBlueprintConnectorPlan[] {
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
  return initialPlans.map(({ sceneEdge: _sceneEdge, ...plan }) => plan);
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

function buildStep3Route(
  connector: ServiceBlueprintConnectorPlan,
  index: PositionedBlueprintIndex,
  diagnostics: RendererDiagnostic[]
): ConnectorRouteState {
  const source = index.nodeById.get(connector.from);
  const target = index.nodeById.get(connector.to);
  if (!source || !target) {
    return {
      route: connector.step2Route,
      occupiedGutters: []
    };
  }

  const sourcePoint = getSideCenter(source, connector.sourceSide);
  const targetPoint = getSideCenter(target, connector.targetSide);
  const occupiedGutters: ServiceBlueprintGutterOccupancy[] = [];

  switch (connector.pattern) {
    case "precedes_same_row":
    case "vertical_direct":
      if (connector.pattern === "vertical_direct") {
        const directPoints = [sourcePoint, targetPoint];
        const intersections = collectIntersectingBoxes(directPoints, getNonEndpointBoxes(connector, index));
        if (intersections.length > 0) {
          const baseBridgeX = roundMetric(Math.max(source.node.x + source.node.width, target.node.x + target.node.width) + FIXED_SEPARATION_DISTANCE);
          const bridgeX = resolveVerticalBridgeX(
            baseBridgeX,
            connector,
            index,
            (candidateBridgeX) => [
              sourcePoint,
              { x: candidateBridgeX, y: sourcePoint.y },
              { x: candidateBridgeX, y: targetPoint.y },
              targetPoint
            ],
            diagnostics,
            "renderer.routing.service_blueprint_vertical_swerve_fallback"
          );
          occupiedGutters.push({
            connectorId: connector.id,
            key: `column:${connector.sourceColumnOrder}:bridge`,
            axis: "vertical",
            kind: "column",
            columnOrder: connector.sourceColumnOrder
          });
          return {
            route: buildPositionedRoute([
              sourcePoint,
              { x: bridgeX, y: sourcePoint.y },
              { x: bridgeX, y: targetPoint.y },
              targetPoint
            ]),
            bridgeX,
            occupiedGutters
          };
        }
      }

      return {
        route: buildPositionedRoute([sourcePoint, targetPoint]),
        occupiedGutters
      };
    case "precedes_stair": {
      const baseBridgeX = roundMetric(source.node.x + source.node.width + FIXED_SEPARATION_DISTANCE);
      const bridgeX = resolveVerticalBridgeX(
        baseBridgeX,
        connector,
        index,
        (candidateBridgeX) => [
          sourcePoint,
          { x: candidateBridgeX, y: sourcePoint.y },
          { x: candidateBridgeX, y: targetPoint.y },
          targetPoint
        ],
        diagnostics,
        "renderer.routing.service_blueprint_precedes_swerve_fallback"
      );
      occupiedGutters.push(
        {
          connectorId: connector.id,
          key: `node:${connector.from}:right`,
          axis: "vertical",
          kind: "node_right",
          nodeId: connector.from
        },
        {
          connectorId: connector.id,
          key: `column:${connector.sourceColumnOrder}:bridge`,
          axis: "vertical",
          kind: "column",
          columnOrder: connector.sourceColumnOrder
        }
      );
      return {
        route: buildPositionedRoute([
          sourcePoint,
          { x: bridgeX, y: sourcePoint.y },
          { x: bridgeX, y: targetPoint.y },
          targetPoint
        ]),
        bridgeX,
        occupiedGutters
      };
    }
    case "same_row_bottom": {
      const baseBridgeY = roundMetric(
        Math.max(source.node.y + source.node.height, target.node.y + target.node.height) + FIXED_SEPARATION_DISTANCE
      );
      const bridgeY = resolveHorizontalBridgeY(
        baseBridgeY,
        connector,
        index,
        (candidateBridgeY) => [
          sourcePoint,
          { x: sourcePoint.x, y: candidateBridgeY },
          { x: targetPoint.x, y: candidateBridgeY },
          targetPoint
        ],
        diagnostics,
        "renderer.routing.service_blueprint_horizontal_swerve_fallback"
      );
      occupiedGutters.push(
        {
          connectorId: connector.id,
          key: `node:${connector.from}:bottom`,
          axis: "horizontal",
          kind: "node_bottom",
          nodeId: connector.from
        },
        {
          connectorId: connector.id,
          key: `lane:${connector.sourceLaneOrder}:below`,
          axis: "horizontal",
          kind: "lane",
          laneOrder: connector.sourceLaneOrder
        }
      );
      return {
        route: buildPositionedRoute([
          sourcePoint,
          { x: sourcePoint.x, y: bridgeY },
          { x: targetPoint.x, y: bridgeY },
          targetPoint
        ]),
        bridgeY,
        occupiedGutters
      };
    }
    case "vertical_bridge": {
      const baseBridgeX = roundMetric(source.node.x + source.node.width + FIXED_SEPARATION_DISTANCE);
      const bridgeX = resolveVerticalBridgeX(
        baseBridgeX,
        connector,
        index,
        (candidateBridgeX) => [
          sourcePoint,
          { x: candidateBridgeX, y: sourcePoint.y },
          { x: candidateBridgeX, y: targetPoint.y },
          targetPoint
        ],
        diagnostics,
        "renderer.routing.service_blueprint_vertical_bridge_swerve_fallback"
      );
      occupiedGutters.push(
        {
          connectorId: connector.id,
          key: `node:${connector.from}:right`,
          axis: "vertical",
          kind: "node_right",
          nodeId: connector.from
        },
        {
          connectorId: connector.id,
          key: `column:${connector.sourceColumnOrder}:bridge`,
          axis: "vertical",
          kind: "column",
          columnOrder: connector.sourceColumnOrder
        }
      );
      return {
        route: buildPositionedRoute([
          sourcePoint,
          { x: bridgeX, y: sourcePoint.y },
          { x: bridgeX, y: targetPoint.y },
          targetPoint
        ]),
        bridgeX,
        occupiedGutters
      };
    }
  }
}

function gatherGutterOccupancy(
  routeStates: ReadonlyMap<string, ConnectorRouteState>
): ServiceBlueprintGutterOccupancy[] {
  const occupancy: ServiceBlueprintGutterOccupancy[] = [];
  routeStates.forEach((state) => {
    occupancy.push(...state.occupiedGutters);
  });
  return occupancy;
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

function buildTrackIndices(
  connectorPlans: readonly ServiceBlueprintConnectorPlan[]
): {
  verticalTrackByConnectorId: Map<string, number>;
  horizontalTrackByConnectorId: Map<string, number>;
} {
  const verticalTrackByConnectorId = new Map<string, number>();
  const horizontalTrackByConnectorId = new Map<string, number>();
  const verticalGroups = new Map<string, ServiceBlueprintConnectorPlan[]>();
  const horizontalGroups = new Map<string, ServiceBlueprintConnectorPlan[]>();

  for (const connector of connectorPlans) {
    if (
      connector.pattern === "precedes_stair"
      || connector.pattern === "vertical_bridge"
      || getVerticalBridgeX(connector.step3Route) !== undefined
    ) {
      const key = `column:${connector.sourceColumnOrder}:vertical`;
      const existing = verticalGroups.get(key) ?? [];
      existing.push(connector);
      verticalGroups.set(key, existing);
    }
    if (connector.pattern === "same_row_bottom") {
      const key = `lane:${connector.sourceLaneOrder}:horizontal`;
      const existing = horizontalGroups.get(key) ?? [];
      existing.push(connector);
      horizontalGroups.set(key, existing);
    }
  }

  verticalGroups.forEach((group) => {
    group
      .sort((left, right) => compareOrderingKey(left.orderingKey, right.orderingKey) || left.id.localeCompare(right.id))
      .forEach((connector, indexInGroup) => {
        verticalTrackByConnectorId.set(connector.id, indexInGroup);
      });
  });
  horizontalGroups.forEach((group) => {
    group
      .sort((left, right) => compareOrderingKey(left.orderingKey, right.orderingKey) || left.id.localeCompare(right.id))
      .forEach((connector, indexInGroup) => {
        horizontalTrackByConnectorId.set(connector.id, indexInGroup);
      });
  });

  return {
    verticalTrackByConnectorId,
    horizontalTrackByConnectorId
  };
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

function resolveRequiredColumnExpansions(
  connectorPlans: readonly ServiceBlueprintConnectorPlan[],
  index: PositionedBlueprintIndex,
  endpointOffsetsByNodeId: ReadonlyMap<string, Map<PortSide, Map<string, number>>>,
  trackIndices: {
    verticalTrackByConnectorId: ReadonlyMap<string, number>;
    horizontalTrackByConnectorId: ReadonlyMap<string, number>;
  }
): Record<number, number> {
  const required: Record<number, number> = {};

  for (const connector of connectorPlans) {
    const step3BridgeX = getVerticalBridgeX(connector.step3Route);
    if (
      connector.pattern !== "precedes_stair"
      && connector.pattern !== "vertical_bridge"
      && step3BridgeX === undefined
    ) {
      continue;
    }
    const source = index.nodeById.get(connector.from);
    const target = index.nodeById.get(connector.to);
    if (!source) {
      continue;
    }
    const sideOffsets = endpointOffsetsByNodeId.get(connector.from)?.get(connector.sourceSide);
    const endpointOffset = sideOffsets?.get(connector.id) ?? 0;
    const sourcePoint = getSidePointWithOffset(source, connector.sourceSide, endpointOffset);
    const trackIndex = trackIndices.verticalTrackByConnectorId.get(connector.id) ?? 0;
    const targetPoint = target
      ? getSidePointWithOffset(
        target,
        connector.targetSide,
        endpointOffsetsByNodeId.get(connector.to)?.get(connector.targetSide)?.get(connector.id) ?? 0
      )
      : sourcePoint;
    const bridgeX = roundMetric(
      Math.max(
        step3BridgeX ?? -Infinity,
        sourcePoint.x + GUTTER_CLEARANCE,
        targetPoint.x + GUTTER_CLEARANCE,
        source.node.x + source.node.width + FIXED_SEPARATION_DISTANCE + trackIndex * FIXED_SEPARATION_DISTANCE
      )
    );
    const nextColumnLeft = getNextValue(index.columnLeftByOrder, connector.sourceColumnOrder);
    if (nextColumnLeft === undefined) {
      continue;
    }
    const limit = roundMetric(nextColumnLeft - GUTTER_CLEARANCE);
    if (bridgeX > limit) {
      required[connector.sourceColumnOrder] = roundMetric(Math.max(required[connector.sourceColumnOrder] ?? 0, bridgeX - limit));
    }
  }

  return required;
}

function resolveRequiredLaneExpansions(
  connectorPlans: readonly ServiceBlueprintConnectorPlan[],
  index: PositionedBlueprintIndex,
  endpointOffsetsByNodeId: ReadonlyMap<string, Map<PortSide, Map<string, number>>>,
  trackIndices: {
    verticalTrackByConnectorId: ReadonlyMap<string, number>;
    horizontalTrackByConnectorId: ReadonlyMap<string, number>;
  }
): Record<number, number> {
  const required: Record<number, number> = {};

  for (const connector of connectorPlans) {
    if (connector.pattern !== "same_row_bottom") {
      continue;
    }
    const source = index.nodeById.get(connector.from);
    const target = index.nodeById.get(connector.to);
    if (!source || !target) {
      continue;
    }
    const sourceOffset = endpointOffsetsByNodeId.get(connector.from)?.get(connector.sourceSide)?.get(connector.id) ?? 0;
    const targetOffset = endpointOffsetsByNodeId.get(connector.to)?.get(connector.targetSide)?.get(connector.id) ?? 0;
    const sourcePoint = getSidePointWithOffset(source, connector.sourceSide, sourceOffset);
    const targetPoint = getSidePointWithOffset(target, connector.targetSide, targetOffset);
    const trackIndex = trackIndices.horizontalTrackByConnectorId.get(connector.id) ?? 0;
    const step3BridgeY = getHorizontalBridgeY(connector.step3Route);
    const bridgeY = roundMetric(
      Math.max(
        step3BridgeY ?? -Infinity,
        Math.max(sourcePoint.y, targetPoint.y) + FIXED_SEPARATION_DISTANCE + trackIndex * FIXED_SEPARATION_DISTANCE
      )
    );
    const nextRowTop = getNextValue(index.rowTopByOrder, connector.sourceLaneOrder);
    if (nextRowTop === undefined) {
      continue;
    }
    const limit = roundMetric(nextRowTop - GUTTER_CLEARANCE);
    if (bridgeY > limit) {
      required[connector.sourceLaneOrder] = roundMetric(Math.max(required[connector.sourceLaneOrder] ?? 0, bridgeY - limit));
    }
  }

  return required;
}

function buildFinalRoute(
  connector: ServiceBlueprintConnectorPlan,
  index: PositionedBlueprintIndex,
  endpointOffsetsByNodeId: ReadonlyMap<string, Map<PortSide, Map<string, number>>>,
  trackIndices: {
    verticalTrackByConnectorId: ReadonlyMap<string, number>;
    horizontalTrackByConnectorId: ReadonlyMap<string, number>;
  }
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

  switch (connector.pattern) {
    case "precedes_same_row":
      return {
        route: sourcePoint.y === targetPoint.y
          ? buildPositionedRoute([sourcePoint, targetPoint])
          : buildPositionedRoute([
            sourcePoint,
            { x: targetPoint.x, y: sourcePoint.y },
            targetPoint
          ]),
        occupiedGutters: connector.occupiedGutters
      };
    case "vertical_direct": {
      const step3BridgeX = getVerticalBridgeX(connector.step3Route);
      if (step3BridgeX !== undefined) {
        const trackIndex = trackIndices.verticalTrackByConnectorId.get(connector.id) ?? 0;
        const bridgeX = roundMetric(
          Math.max(
            step3BridgeX,
            sourcePoint.x + GUTTER_CLEARANCE,
            targetPoint.x + GUTTER_CLEARANCE,
            source.node.x + source.node.width + FIXED_SEPARATION_DISTANCE + trackIndex * FIXED_SEPARATION_DISTANCE
          )
        );
        return {
          route: buildPositionedRoute([
            sourcePoint,
            { x: bridgeX, y: sourcePoint.y },
            { x: bridgeX, y: targetPoint.y },
            targetPoint
          ]),
          bridgeX,
          occupiedGutters: connector.occupiedGutters
        };
      }

      return {
        route: sourcePoint.x === targetPoint.x
          ? buildPositionedRoute([sourcePoint, targetPoint])
          : buildPositionedRoute([
            sourcePoint,
            { x: sourcePoint.x, y: targetPoint.y },
            targetPoint
          ]),
        occupiedGutters: connector.occupiedGutters
      };
    }
    case "precedes_stair":
    case "vertical_bridge": {
      const step3BridgeX = getVerticalBridgeX(connector.step3Route);
      const baseBridgeX = roundMetric(
        Math.max(
          step3BridgeX ?? -Infinity,
          sourcePoint.x + GUTTER_CLEARANCE,
          targetPoint.x + GUTTER_CLEARANCE,
          source.node.x + source.node.width + FIXED_SEPARATION_DISTANCE
        )
      );
      const trackIndex = trackIndices.verticalTrackByConnectorId.get(connector.id) ?? 0;
      const bridgeX = roundMetric(baseBridgeX + trackIndex * FIXED_SEPARATION_DISTANCE);
      return {
        route: buildPositionedRoute([
          sourcePoint,
          { x: bridgeX, y: sourcePoint.y },
          { x: bridgeX, y: targetPoint.y },
          targetPoint
        ]),
        bridgeX,
        occupiedGutters: connector.occupiedGutters
      };
    }
    case "same_row_bottom": {
      const trackIndex = trackIndices.horizontalTrackByConnectorId.get(connector.id) ?? 0;
      const step3BridgeY = getHorizontalBridgeY(connector.step3Route);
      const bridgeY = roundMetric(
        Math.max(
          step3BridgeY ?? -Infinity,
          Math.max(sourcePoint.y, targetPoint.y) + FIXED_SEPARATION_DISTANCE + trackIndex * FIXED_SEPARATION_DISTANCE
        )
      );
      return {
        route: buildPositionedRoute([
          sourcePoint,
          { x: sourcePoint.x, y: bridgeY },
          { x: targetPoint.x, y: bridgeY },
          targetPoint
        ]),
        bridgeY,
        occupiedGutters: connector.occupiedGutters
      };
    }
  }
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
  const stage2Diagnostics: RendererDiagnostic[] = [...baseScene.diagnostics];
  const baseIndex = buildIndex(baseScene.root, middleLayer.cells, authorOrderByNodeId);
  const connectorPlans = buildConnectorPlans(rendererScene.edges, middleLayer, baseIndex);
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

  const step3Diagnostics: RendererDiagnostic[] = [...baseScene.diagnostics];
  const step3RouteStates = new Map<string, ConnectorRouteState>();
  const step3ConnectorPlans = connectorPlans.map((connector) => {
    const routeState = buildStep3Route(connector, baseIndex, step3Diagnostics);
    step3RouteStates.set(connector.id, routeState);
    return {
      ...connector,
      step3Route: routeState.route,
      occupiedGutters: routeState.occupiedGutters
    };
  });
  const step3Occupancy = gatherGutterOccupancy(step3RouteStates);
  const step3Scene = buildStageScene(
    baseScene,
    buildPositionedEdges(step3ConnectorPlans, step3RouteStates),
    step3Diagnostics
  );

  const step3BucketsByNodeId = buildNodeEdgeBuckets(step3ConnectorPlans, baseIndex);
  const endpointOffsetsByNodeId = buildEndpointOffsets(baseIndex, step3BucketsByNodeId);
  const trackIndices = buildTrackIndices(step3ConnectorPlans);
  const columnExpansions = resolveRequiredColumnExpansions(step3ConnectorPlans, baseIndex, endpointOffsetsByNodeId, trackIndices);
  const laneExpansions = resolveRequiredLaneExpansions(step3ConnectorPlans, baseIndex, endpointOffsetsByNodeId, trackIndices);
  const expandedScene = applyGlobalGutterExpansions(baseScene, middleLayer.cells, columnExpansions, laneExpansions);
  const expandedIndex = buildIndex(expandedScene.root, middleLayer.cells, authorOrderByNodeId);
  const expandedBucketsByNodeId = buildNodeEdgeBuckets(step3ConnectorPlans, expandedIndex);
  const expandedEndpointOffsetsByNodeId = buildEndpointOffsets(expandedIndex, expandedBucketsByNodeId);
  const finalDiagnostics: RendererDiagnostic[] = [...baseScene.diagnostics];
  const finalRouteStates = new Map<string, ConnectorRouteState>();
  const finalConnectorPlans = step3ConnectorPlans.map((connector) => {
    const routeState = buildFinalRoute(connector, expandedIndex, expandedEndpointOffsetsByNodeId, trackIndices);
    finalRouteStates.set(connector.id, routeState);
    return {
      ...connector,
      finalRoute: routeState.route
    };
  });
  const finalEdges = buildPositionedEdges(finalConnectorPlans, finalRouteStates);
  const offendingEdges = routeIntersectsForbiddenBoxes(finalEdges, expandedIndex.allNodeBoxes);
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

  const finalScene = buildStageScene(expandedScene, finalEdges, finalDiagnostics);
  const finalOccupancy = gatherGutterOccupancy(finalRouteStates);

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
      nodeEdgeBuckets: [...expandedBucketsByNodeId.values()],
      nodeGutters: buildNodeGutters(expandedIndex),
      globalGutterState: buildGlobalGutterState(columnExpansions, laneExpansions),
      gutterOccupancy: finalOccupancy,
      diagnostics: sortRendererDiagnostics(finalDiagnostics)
    }
  };
}
