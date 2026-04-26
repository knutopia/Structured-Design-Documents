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
  RoutingStyle
} from "./contracts.js";
import { createRoutingDiagnostic, sortRendererDiagnostics, type RendererDiagnostic } from "./diagnostics.js";
import { collapseRoutePoints } from "./routing.js";
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
  x: number;
  y: number;
}

export interface ScenarioFlowNodeEdgeBucket {
  nodeId: string;
  side: PortSide;
  startingConnectorIds: string[];
  endingConnectorIds: string[];
}

export interface ScenarioFlowGutterOccupancy {
  connectorId: string;
  kind: "column_gutter" | "lane_gutter" | "obstacle_swerve" | "edge_local";
  axis: "horizontal" | "vertical";
  coordinate: number;
  spanStart: number;
  spanEnd: number;
  routeSegmentIndex: number;
  nodeId?: string;
  columnOrder?: number;
  rowOrder?: number;
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
  nodeEdgeBuckets: ScenarioFlowNodeEdgeBucket[];
  gutterOccupancy: ScenarioFlowGutterOccupancy[];
  step2PositionedScene: PositionedScene;
  step3PositionedScene: PositionedScene;
  finalPositionedScene: PositionedScene;
  diagnostics: RendererDiagnostic[];
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
const MIRROR_OFFSET = 12;
const REALIZATION_CORRIDOR_OFFSET = 22;
const OBSTACLE_CLEARANCE = 18;
const LABEL_OFFSET = 10;
const LABEL_CANDIDATE_STEP = 14;
const EPSILON = 0.5;

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function isPositionedNode(item: PositionedItem): item is PositionedNode {
  return item.kind === "node" && item.viewMetadata?.scenarioFlow?.kind === "semantic_node";
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

function getPortPoint(node: PositionedNode, port: MeasuredPort): Point {
  return {
    x: roundMetric(node.x + port.x),
    y: roundMetric(node.y + port.y)
  };
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
    if (item.kind === "container" && item.viewMetadata?.scenarioFlow?.kind === "cell") {
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

  const point = getPortPoint(node.node, port);
  return {
    itemId: node.node.id,
    portId: port.id,
    side: port.side,
    x: point.x,
    y: point.y
  };
}

function buildRoute(points: Point[], style: RoutingStyle = "orthogonal"): PositionedRoute {
  return {
    style,
    points: collapseRoutePoints(points)
  };
}

function resolveBetweenColumnGutter(
  source: IndexedScenarioFlowNode,
  target: IndexedScenarioFlowNode,
  index: ScenarioFlowPositionedIndex
): number {
  const sourceCell = index.cellById.get(source.placement.cellId);
  const targetCell = index.cellById.get(target.placement.cellId);
  if (sourceCell && targetCell && targetCell.columnOrder > sourceCell.columnOrder) {
    const sourceRight = index.columnRightByOrder.get(sourceCell.columnOrder) ?? (sourceCell.cell.x + sourceCell.cell.width);
    const targetLeft = index.columnLeftByOrder.get(targetCell.columnOrder) ?? targetCell.cell.x;
    if (targetLeft - sourceRight > OBSTACLE_CLEARANCE * 2) {
      return roundMetric((sourceRight + targetLeft) / 2);
    }
  }

  return roundMetric(Math.max(source.node.x + source.node.width, target.node.x + target.node.width) + OBSTACLE_CLEARANCE);
}

function resolveRealizationCorridorX(
  source: IndexedScenarioFlowNode,
  target: IndexedScenarioFlowNode,
  connectorIndex: number
): number {
  const right = Math.max(source.node.x + source.node.width, target.node.x + target.node.width);
  return roundMetric(right + REALIZATION_CORRIDOR_OFFSET + connectorIndex * 6);
}

function buildTemplateRoute(
  pattern: ScenarioFlowRoutePattern,
  source: IndexedScenarioFlowNode,
  target: IndexedScenarioFlowNode,
  from: ScenarioFlowResolvedEndpoint,
  to: ScenarioFlowResolvedEndpoint,
  index: ScenarioFlowPositionedIndex,
  connectorIndex: number
): PositionedRoute {
  if (pattern === "same_track_forward") {
    const offset = source.placement.laneId === "step"
      ? 0
      : source.placement.laneId === "place"
        ? MIRROR_OFFSET
        : MIRROR_OFFSET * 2;
    return offset === 0
      ? buildRoute([from, to])
      : buildRoute([
        from,
        { x: from.x + OBSTACLE_CLEARANCE, y: from.y },
        { x: from.x + OBSTACLE_CLEARANCE, y: from.y + offset },
        { x: to.x - OBSTACLE_CLEARANCE, y: to.y + offset },
        { x: to.x - OBSTACLE_CLEARANCE, y: to.y },
        to
      ]);
  }

  if (pattern === "cross_track_branch_bridge") {
    const bridgeX = resolveBetweenColumnGutter(source, target, index);
    return buildRoute([
      from,
      { x: bridgeX, y: from.y },
      { x: bridgeX, y: to.y },
      to
    ]);
  }

  if (pattern === "realization_vertical") {
    return buildRoute([from, to]);
  }

  if (pattern === "realization_corridor") {
    const direction = from.y <= to.y ? 1 : -1;
    const corridorX = resolveRealizationCorridorX(source, target, connectorIndex);
    return buildRoute([
      from,
      { x: from.x, y: roundMetric(from.y + direction * OBSTACLE_CLEARANCE) },
      { x: corridorX, y: roundMetric(from.y + direction * OBSTACLE_CLEARANCE) },
      { x: corridorX, y: roundMetric(to.y - direction * OBSTACLE_CLEARANCE) },
      { x: to.x, y: roundMetric(to.y - direction * OBSTACLE_CLEARANCE) },
      to
    ]);
  }

  const bridgeX = roundMetric(Math.max(source.node.x + source.node.width, target.node.x + target.node.width) + OBSTACLE_CLEARANCE);
  return buildRoute([
    from,
    { x: bridgeX, y: from.y },
    { x: bridgeX, y: to.y },
    to
  ]);
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
    const pattern = determinePattern(edge, source, target);
    const step2Route = buildTemplateRoute(pattern, source, target, from, to, index, plans.length);

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
      pattern,
      classes: [...measuredEdge.classes],
      role: measuredEdge.role,
      markers: measuredEdge.markers,
      label: measuredEdge.label,
      step2Route,
      step3Route: step2Route,
      finalRoute: step2Route,
      occupiedGutters: []
    });
  }

  return plans.sort(compareConnectorPlans);
}

function buildNodeEdgeBuckets(plans: readonly ScenarioFlowConnectorPlan[]): ScenarioFlowNodeEdgeBucket[] {
  const buckets = new Map<string, ScenarioFlowNodeEdgeBucket>();
  const ensure = (nodeId: string, side: PortSide) => {
    const key = `${nodeId}|${side}`;
    const existing = buckets.get(key);
    if (existing) {
      return existing;
    }
    const created: ScenarioFlowNodeEdgeBucket = {
      nodeId,
      side,
      startingConnectorIds: [],
      endingConnectorIds: []
    };
    buckets.set(key, created);
    return created;
  };

  for (const plan of plans) {
    ensure(plan.from, plan.sourceSide).startingConnectorIds.push(plan.id);
    ensure(plan.to, plan.targetSide).endingConnectorIds.push(plan.id);
  }

  return [...buckets.values()].sort((left, right) =>
    left.nodeId.localeCompare(right.nodeId) || left.side.localeCompare(right.side)
  );
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
    const aboveY = roundMetric(box.y - OBSTACLE_CLEARANCE);
    const belowY = roundMetric(box.y + box.height + OBSTACLE_CLEARANCE);
    const detourY = Math.abs(start.y - aboveY) <= Math.abs(start.y - belowY) ? aboveY : belowY;
    const before = { x: roundMetric(start.x < end.x ? box.x - OBSTACLE_CLEARANCE : box.x + box.width + OBSTACLE_CLEARANCE), y: start.y };
    const after = { x: before.x, y: detourY };
    const exit = { x: roundMetric(start.x < end.x ? box.x + box.width + OBSTACLE_CLEARANCE : box.x - OBSTACLE_CLEARANCE), y: detourY };
    const rejoin = { x: exit.x, y: end.y };
    points.splice(segmentIndex + 1, 0, before, after, exit, rejoin);
    return {
      route: buildRoute(points, route.style),
      occupancy: {
        connectorId,
        kind: "obstacle_swerve",
        axis: "horizontal",
        coordinate: detourY,
        spanStart: Math.min(after.x, exit.x),
        spanEnd: Math.max(after.x, exit.x),
        routeSegmentIndex: segmentIndex,
        nodeId: box.itemId
      }
    };
  }

  const leftX = roundMetric(box.x - OBSTACLE_CLEARANCE);
  const rightX = roundMetric(box.x + box.width + OBSTACLE_CLEARANCE);
  const detourX = Math.abs(start.x - leftX) <= Math.abs(start.x - rightX) ? leftX : rightX;
  const before = { x: start.x, y: roundMetric(start.y < end.y ? box.y - OBSTACLE_CLEARANCE : box.y + box.height + OBSTACLE_CLEARANCE) };
  const after = { x: detourX, y: before.y };
  const exit = { x: detourX, y: roundMetric(start.y < end.y ? box.y + box.height + OBSTACLE_CLEARANCE : box.y - OBSTACLE_CLEARANCE) };
  const rejoin = { x: end.x, y: exit.y };
  points.splice(segmentIndex + 1, 0, before, after, exit, rejoin);
  return {
    route: buildRoute(points, route.style),
    occupancy: {
      connectorId,
      kind: "obstacle_swerve",
      axis: "vertical",
      coordinate: detourX,
      spanStart: Math.min(after.y, exit.y),
      spanEnd: Math.max(after.y, exit.y),
      routeSegmentIndex: segmentIndex,
      nodeId: box.itemId
    }
  };
}

function refineRouteAgainstObstacles(
  plan: ScenarioFlowConnectorPlan,
  nodeBoxes: readonly ScenarioFlowBox[]
): {
  route: PositionedRoute;
  occupancy: ScenarioFlowGutterOccupancy[];
} {
  const blockingBoxes = nodeBoxes.filter((box) => box.itemId !== plan.from && box.itemId !== plan.to);
  let route = plan.step2Route;
  const occupancy: ScenarioFlowGutterOccupancy[] = [];

  for (let pass = 0; pass < 6; pass += 1) {
    const intersection = findRouteIntersection(route, blockingBoxes);
    if (!intersection) {
      break;
    }
    const refined = swerveRouteAroundIntersection(route, intersection, plan.id);
    route = refined.route;
    occupancy.push(refined.occupancy);
  }

  return {
    route,
    occupancy
  };
}

function buildRouteOccupancy(
  plan: ScenarioFlowConnectorPlan,
  index: ScenarioFlowPositionedIndex
): ScenarioFlowGutterOccupancy[] {
  const sourceCell = index.cellById.get(index.nodeById.get(plan.from)?.placement.cellId ?? "");
  return plan.step3Route.points.slice(1).map((point, indexInRoute) => {
    const previous = plan.step3Route.points[indexInRoute]!;
    const horizontal = Math.abs(previous.y - point.y) <= EPSILON;
    return {
      connectorId: plan.id,
      kind: horizontal ? "lane_gutter" : "column_gutter",
      axis: horizontal ? "horizontal" : "vertical",
      coordinate: roundMetric(horizontal ? point.y : point.x),
      spanStart: roundMetric(horizontal ? Math.min(previous.x, point.x) : Math.min(previous.y, point.y)),
      spanEnd: roundMetric(horizontal ? Math.max(previous.x, point.x) : Math.max(previous.y, point.y)),
      routeSegmentIndex: indexInRoute,
      columnOrder: sourceCell?.columnOrder,
      rowOrder: sourceCell?.rowOrder
    } satisfies ScenarioFlowGutterOccupancy;
  });
}

function expandSceneForRoutes(scene: PositionedScene, plans: ScenarioFlowConnectorPlan[]): PositionedScene {
  const maxX = Math.max(
    scene.root.x + scene.root.width,
    ...plans.flatMap((plan) => plan.finalRoute.points.map((point) => point.x + 28))
  );
  const maxY = Math.max(
    scene.root.y + scene.root.height,
    ...plans.flatMap((plan) => plan.finalRoute.points.map((point) => point.y + 28))
  );

  if (maxX <= scene.root.x + scene.root.width && maxY <= scene.root.y + scene.root.height) {
    return scene;
  }

  return {
    ...scene,
    root: {
      ...scene.root,
      width: roundMetric(maxX - scene.root.x),
      height: roundMetric(maxY - scene.root.y)
    }
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
    const blockingBoxes = nodeBoxes.filter((box) => box.itemId !== plan.from && box.itemId !== plan.to);
    const intersection = findRouteIntersection(plan.finalRoute, blockingBoxes);
    if (!intersection) {
      continue;
    }
    diagnostics.push(createRoutingDiagnostic(
      "renderer.routing.scenario_flow_node_intersection",
      `Scenario-flow edge "${plan.id}" intersects non-endpoint node "${intersection.box.itemId}".`,
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
  const index = buildIndex(positionedScene, middleLayer);
  const connectorPlans = buildConnectorPlans(measuredScene, middleLayer, index, diagnostics);
  const nodeEdgeBuckets = buildNodeEdgeBuckets(connectorPlans);
  const step2PositionedScene = withEdgesAndDiagnostics(
    positionedScene,
    buildPositionedEdges(connectorPlans, (plan) => plan.step2Route),
    diagnostics
  );

  for (const plan of connectorPlans) {
    const refined = refineRouteAgainstObstacles(plan, index.nodeBoxes);
    plan.step3Route = refined.route;
    plan.finalRoute = refined.route;
    plan.occupiedGutters = [...refined.occupancy, ...buildRouteOccupancy(plan, index)];
  }

  const gutterOccupancy = connectorPlans.flatMap((plan) => plan.occupiedGutters);
  const step3PositionedScene = withEdgesAndDiagnostics(
    positionedScene,
    buildPositionedEdges(connectorPlans, (plan) => plan.step3Route),
    diagnostics
  );
  const expandedScene = expandSceneForRoutes(positionedScene, connectorPlans);
  emitFinalIntersectionDiagnostics(connectorPlans, index.nodeBoxes, diagnostics);
  const labelsByPlanId = placeLabels(connectorPlans, expandedScene, diagnostics);
  const finalPositionedScene = withEdgesAndDiagnostics(
    expandedScene,
    buildPositionedEdges(connectorPlans, (plan) => plan.finalRoute, labelsByPlanId),
    diagnostics
  );

  return {
    connectorPlans,
    nodeEdgeBuckets,
    gutterOccupancy,
    step2PositionedScene,
    step3PositionedScene,
    finalPositionedScene,
    diagnostics: sortRendererDiagnostics(diagnostics)
  };
}
