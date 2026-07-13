import type {
  EdgeMarkers,
  JourneyMapEdgeMetadata,
  JourneyMapItemMetadata,
  MeasuredContentBlock,
  MeasuredEdge,
  MeasuredScene,
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
  createRoutingDiagnostic,
  sortRendererDiagnostics,
  type RendererDiagnostic
} from "./diagnostics.js";
import { MIN_ARROW_MARKER_LEG, resolvePortOnItem } from "./routing.js";

export type JourneyMapRouteArchetype =
  | "adjacent_forward_same_stage"
  | "adjacent_forward_cross_stage"
  | "non_adjacent_forward_same_stage"
  | "long_forward_cross_stage"
  | "adjacent_forward_root_step";

export type JourneyMapBasicRouteArchetype =
  | "adjacent_forward_same_stage"
  | "adjacent_forward_cross_stage";

function isBasicRouteArchetype(
  archetype: JourneyMapRouteArchetype
): archetype is JourneyMapBasicRouteArchetype {
  return archetype === "adjacent_forward_same_stage"
    || archetype === "adjacent_forward_cross_stage";
}

export type JourneyMapDeferredFamily =
  | "duplicate"
  | "root_step"
  | "branch"
  | "join"
  | "cycle"
  | "self_loop"
  | "backward"
  | "non_adjacent_same_stage"
  | "long_cross_stage"
  | "unsupported_basic_geometry";

export interface JourneyMapResolvedEndpoint {
  itemId: string;
  portId: string;
  side: PortSide;
  x: number;
  y: number;
  offset: number;
}

export interface JourneyMapStageGate {
  stageId: string;
  side: PortSide;
  x: number;
  y: number;
  order: number;
  locked: true;
}

export interface JourneyMapRoutePriority {
  archetypeRank: 0 | 1 | 2 | 3;
  sourceRootOrder: number;
  sourceStepOrder: number;
  authorOrder: number;
  targetRootOrder: number;
  targetStepOrder: number;
  sameEndpointOrdinal: number;
  exactIdentityOrdinal: number;
  edgeId: string;
}

export interface JourneyMapStageLocalBypass {
  stageId: string;
  axis: "horizontal";
  nominalCoordinate: number;
  span: {
    start: number;
    end: number;
  };
  intermediateStepIds: string[];
  obstacleControls: Array<{
    stepId: string;
    entryX: number;
    exitX: number;
  }>;
  order: 0;
  locked: false;
}

export interface JourneyMapRootOuterBypass {
  ownerContainerId: string;
  axis: "horizontal";
  nominalCoordinate: number;
  span: {
    start: number;
    end: number;
  };
  intermediateRootItemIds: string[];
  obstacleControls: Array<{
    rootItemId: string;
    entryX: number;
    exitX: number;
  }>;
  order: 0;
  locked: false;
}

export interface JourneyMapNodeEdgeBucketLists {
  startingConnectorIds: string[];
  endingConnectorIds: string[];
}

export interface JourneyMapNodeEdgeBuckets {
  nodeId: string;
  north: JourneyMapNodeEdgeBucketLists;
  south: JourneyMapNodeEdgeBucketLists;
  east: JourneyMapNodeEdgeBucketLists;
  west: JourneyMapNodeEdgeBucketLists;
}

export interface JourneyMapConnectorPlan {
  id: string;
  from: string;
  to: string;
  ownerContainerId: string;
  archetype: JourneyMapRouteArchetype;
  priority: JourneyMapRoutePriority;
  authorOrder: number;
  sameEndpointOrdinal: number;
  exactIdentityOrdinal: number;
  sourceEndpoint: JourneyMapResolvedEndpoint;
  targetEndpoint: JourneyMapResolvedEndpoint;
  stageGates: JourneyMapStageGate[];
  stageLocalBypass?: JourneyMapStageLocalBypass;
  rootOuterBypass?: JourneyMapRootOuterBypass;
  role: string;
  classes: string[];
  markers?: EdgeMarkers;
  step2Route: PositionedRoute;
  provisionalRoute: PositionedRoute;
  finalBasicRoute: PositionedRoute;
}

export interface JourneyMapDeferredConnector {
  id: string;
  from: string;
  to: string;
  deferredFamilies: JourneyMapDeferredFamily[];
}

export interface JourneyMapRoutingStages {
  connectorPlans: JourneyMapConnectorPlan[];
  deferredConnectors: JourneyMapDeferredConnector[];
  failedConnectorIds: string[];
  nodeEdgeBuckets: JourneyMapNodeEdgeBuckets[];
  step2PositionedScene: PositionedScene;
  provisionalPositionedScene: PositionedScene;
  finalBasicPositionedScene: PositionedScene;
  diagnostics: RendererDiagnostic[];
}

type JourneyStepMetadata = Extract<JourneyMapItemMetadata, { kind: "step" }>;
type JourneyStageMetadata = Extract<JourneyMapItemMetadata, { kind: "stage" }>;

interface IndexedJourneyNode {
  node: PositionedNode;
  metadata: JourneyStepMetadata;
}

interface IndexedJourneyStage {
  stage: PositionedContainer;
  metadata: JourneyStageMetadata;
  stepIds: string[];
}

interface JourneyMapPositionedIndex {
  nodeById: Map<string, IndexedJourneyNode>;
  stageById: Map<string, IndexedJourneyStage>;
  allNodes: IndexedJourneyNode[];
  allStages: IndexedJourneyStage[];
}

interface JourneyDegreeIndex {
  incomingByNodeId: Map<string, number>;
  outgoingByNodeId: Map<string, number>;
  sameEndpointCountByKey: Map<string, number>;
  outgoingTargetsByNodeId: Map<string, string[]>;
}

interface RouteEligibility {
  archetype: JourneyMapRouteArchetype;
  source: IndexedJourneyNode;
  target: IndexedJourneyNode;
  sourceStage?: IndexedJourneyStage;
  targetStage?: IndexedJourneyStage;
  sourceStepOrder: number;
  targetStepOrder: number;
}

interface Rect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function flattenItems(container: PositionedContainer): PositionedItem[] {
  return container.children.flatMap((item) =>
    item.kind === "container" ? [item, ...flattenItems(item)] : [item]
  );
}

function buildJourneyMapPositionedIndex(scene: PositionedScene): JourneyMapPositionedIndex {
  const nodeById = new Map<string, IndexedJourneyNode>();
  const stageById = new Map<string, IndexedJourneyStage>();
  const allNodes: IndexedJourneyNode[] = [];
  const allStages: IndexedJourneyStage[] = [];

  for (const item of flattenItems(scene.root)) {
    const metadata = item.viewMetadata?.journeyMap;
    if (item.kind === "node" && metadata?.kind === "step") {
      const indexed = { node: item, metadata };
      nodeById.set(item.id, indexed);
      allNodes.push(indexed);
      continue;
    }
    if (item.kind === "container" && metadata?.kind === "stage") {
      const indexed = {
        stage: item,
        metadata,
        stepIds: item.children
          .filter((child): child is PositionedNode => child.kind === "node")
          .map((child) => child.id)
      };
      stageById.set(item.id, indexed);
      allStages.push(indexed);
    }
  }

  allNodes.sort((left, right) =>
    left.metadata.globalStepOrder - right.metadata.globalStepOrder
    || left.node.id.localeCompare(right.node.id)
  );
  allStages.sort((left, right) =>
    left.metadata.rootOrder - right.metadata.rootOrder
    || left.stage.id.localeCompare(right.stage.id)
  );
  return { nodeById, stageById, allNodes, allStages };
}

function buildDegreeIndex(edges: readonly MeasuredEdge[]): JourneyDegreeIndex {
  const incomingByNodeId = new Map<string, number>();
  const outgoingByNodeId = new Map<string, number>();
  const sameEndpointCountByKey = new Map<string, number>();
  const outgoingTargetsByNodeId = new Map<string, string[]>();
  for (const edge of edges) {
    outgoingByNodeId.set(edge.from.itemId, (outgoingByNodeId.get(edge.from.itemId) ?? 0) + 1);
    incomingByNodeId.set(edge.to.itemId, (incomingByNodeId.get(edge.to.itemId) ?? 0) + 1);
    const endpointKey = `${edge.from.itemId}\u0000${edge.to.itemId}`;
    sameEndpointCountByKey.set(endpointKey, (sameEndpointCountByKey.get(endpointKey) ?? 0) + 1);
    const targets = outgoingTargetsByNodeId.get(edge.from.itemId) ?? [];
    targets.push(edge.to.itemId);
    outgoingTargetsByNodeId.set(edge.from.itemId, targets);
  }
  return { incomingByNodeId, outgoingByNodeId, sameEndpointCountByKey, outgoingTargetsByNodeId };
}

function hasPath(
  from: string,
  to: string,
  outgoingTargetsByNodeId: ReadonlyMap<string, readonly string[]>
): boolean {
  const pending = [...(outgoingTargetsByNodeId.get(from) ?? [])];
  const visited = new Set<string>([from]);
  while (pending.length > 0) {
    const current = pending.shift()!;
    if (current === to) {
      return true;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);
    pending.push(...(outgoingTargetsByNodeId.get(current) ?? []));
  }
  return false;
}

function resolveRouteEligibility(
  edge: MeasuredEdge,
  index: JourneyMapPositionedIndex,
  degrees: JourneyDegreeIndex
): RouteEligibility | undefined {
  const source = index.nodeById.get(edge.from.itemId);
  const target = index.nodeById.get(edge.to.itemId);
  if (!source || !target) {
    return undefined;
  }
  if ((degrees.outgoingByNodeId.get(source.node.id) ?? 0) !== 1
    || (degrees.incomingByNodeId.get(target.node.id) ?? 0) !== 1) {
    return undefined;
  }
  const endpointKey = `${source.node.id}\u0000${target.node.id}`;
  if ((degrees.sameEndpointCountByKey.get(endpointKey) ?? 0) !== 1
    || hasPath(target.node.id, source.node.id, degrees.outgoingTargetsByNodeId)) {
    return undefined;
  }

  const sourceStage = source.metadata.stageId
    ? index.stageById.get(source.metadata.stageId)
    : undefined;
  const targetStage = target.metadata.stageId
    ? index.stageById.get(target.metadata.stageId)
    : undefined;
  if ((source.metadata.stageId && !sourceStage) || (target.metadata.stageId && !targetStage)) {
    return undefined;
  }
  if (!sourceStage && !targetStage) {
    if (target.metadata.rootOrder !== source.metadata.rootOrder + 1) {
      return undefined;
    }
    return {
      archetype: "adjacent_forward_root_step",
      source,
      target,
      sourceStepOrder: 0,
      targetStepOrder: 0
    };
  }
  if (!sourceStage || !targetStage) {
    return undefined;
  }
  const sourceStepOrder = source.metadata.stepOrder;
  const targetStepOrder = target.metadata.stepOrder;
  if (!sourceStage || !targetStage || sourceStepOrder === undefined || targetStepOrder === undefined) {
    return undefined;
  }
  if (sourceStage.stage.id === targetStage.stage.id) {
    if (targetStepOrder <= sourceStepOrder) {
      return undefined;
    }
    return {
      archetype: targetStepOrder === sourceStepOrder + 1
        ? "adjacent_forward_same_stage"
        : "non_adjacent_forward_same_stage",
      source,
      target,
      sourceStage,
      targetStage,
      sourceStepOrder,
      targetStepOrder
    };
  }

  if (targetStage.metadata.rootOrder <= sourceStage.metadata.rootOrder) {
    return undefined;
  }
  const isAdjacentDirectBridge = targetStage.metadata.rootOrder === sourceStage.metadata.rootOrder + 1
    && sourceStepOrder === sourceStage.stepIds.length - 1
    && targetStepOrder === 0;
  return {
    archetype: isAdjacentDirectBridge
      ? "adjacent_forward_cross_stage"
      : "long_forward_cross_stage",
    source,
    target,
    sourceStage,
    targetStage,
    sourceStepOrder,
    targetStepOrder
  };
}

function classifyDeferredFamilies(
  edge: MeasuredEdge,
  index: JourneyMapPositionedIndex,
  degrees: JourneyDegreeIndex
): JourneyMapDeferredFamily[] {
  const families: JourneyMapDeferredFamily[] = [];
  const source = index.nodeById.get(edge.from.itemId);
  const target = index.nodeById.get(edge.to.itemId);
  const endpointKey = `${edge.from.itemId}\u0000${edge.to.itemId}`;
  if ((degrees.sameEndpointCountByKey.get(endpointKey) ?? 0) > 1) {
    families.push("duplicate");
  }
  if (edge.from.itemId === edge.to.itemId) {
    families.push("self_loop");
  } else if (hasPath(edge.to.itemId, edge.from.itemId, degrees.outgoingTargetsByNodeId)) {
    families.push("cycle");
  }
  if (!source?.metadata.stageId || !target?.metadata.stageId) {
    families.push("root_step");
  }
  if ((degrees.outgoingByNodeId.get(edge.from.itemId) ?? 0) > 1) {
    families.push("branch");
  }
  if ((degrees.incomingByNodeId.get(edge.to.itemId) ?? 0) > 1) {
    families.push("join");
  }
  if (source && target) {
    const backwardInStage = source.metadata.stageId
      && source.metadata.stageId === target.metadata.stageId
      && source.metadata.stepOrder !== undefined
      && target.metadata.stepOrder !== undefined
      && target.metadata.stepOrder <= source.metadata.stepOrder;
    const sharesContainedStage = source.metadata.stageId !== undefined
      && source.metadata.stageId === target.metadata.stageId;
    const backwardAtRoot = !sharesContainedStage
      && target.metadata.rootOrder <= source.metadata.rootOrder;
    if (backwardInStage || backwardAtRoot) {
      families.push("backward");
    }
  }
  if (source?.metadata.stageId && source.metadata.stageId === target?.metadata.stageId) {
    if (source.metadata.stepOrder === undefined
      || target.metadata.stepOrder === undefined
      || target.metadata.stepOrder !== source.metadata.stepOrder + 1) {
      families.push("non_adjacent_same_stage");
    }
  } else if (source?.metadata.stageId && target?.metadata.stageId) {
    families.push("long_cross_stage");
  }
  if (families.length === 0) {
    families.push("unsupported_basic_geometry");
  }
  return families;
}

function resolveEndpoint(
  edge: MeasuredEdge,
  indexedNode: IndexedJourneyNode,
  endpoint: "source" | "target",
  preferredRole: string | undefined,
  expectedSide: PortSide,
  diagnostics: RendererDiagnostic[]
): JourneyMapResolvedEndpoint | undefined {
  const measuredEndpoint = endpoint === "source" ? edge.from : edge.to;
  const port = resolvePortOnItem(indexedNode.node, measuredEndpoint, preferredRole);
  if (!port || port.side !== expectedSide) {
    diagnostics.push(createRoutingDiagnostic(
      "renderer.routing.journey_map_unresolved_endpoint",
      `Journey edge "${edge.id}" could not resolve its required ${expectedSide} ${endpoint} endpoint.`,
      edge.id,
      "error",
      JSON.stringify({ relatedIds: [edge.id, indexedNode.node.id] })
    ));
    return undefined;
  }
  return {
    itemId: indexedNode.node.id,
    portId: port.id,
    side: expectedSide,
    x: roundMetric(indexedNode.node.x + port.x),
    y: roundMetric(indexedNode.node.y + port.y),
    offset: roundMetric(port.side === "north" || port.side === "south" ? port.x : port.y)
  };
}

function buildStageGates(
  eligibility: RouteEligibility,
  source: JourneyMapResolvedEndpoint,
  target: JourneyMapResolvedEndpoint
): JourneyMapStageGate[] {
  if (!eligibility.sourceStage || !eligibility.targetStage) {
    return [];
  }
  if (eligibility.archetype === "long_forward_cross_stage") {
    return [
      {
        stageId: eligibility.sourceStage.stage.id,
        side: "south",
        x: source.x,
        y: roundMetric(eligibility.sourceStage.stage.y + eligibility.sourceStage.stage.height),
        order: 0,
        locked: true
      },
      {
        stageId: eligibility.targetStage.stage.id,
        side: "south",
        x: target.x,
        y: roundMetric(eligibility.targetStage.stage.y + eligibility.targetStage.stage.height),
        order: 0,
        locked: true
      }
    ];
  }
  if (eligibility.archetype !== "adjacent_forward_cross_stage") {
    return [];
  }
  return [
    {
      stageId: eligibility.sourceStage.stage.id,
      side: "east",
      x: roundMetric(eligibility.sourceStage.stage.x + eligibility.sourceStage.stage.width),
      y: source.y,
      order: 0,
      locked: true
    },
    {
      stageId: eligibility.targetStage.stage.id,
      side: "west",
      x: roundMetric(eligibility.targetStage.stage.x),
      y: target.y,
      order: 0,
      locked: true
    }
  ];
}

function buildStageLocalBypass(
  eligibility: RouteEligibility,
  source: JourneyMapResolvedEndpoint,
  target: JourneyMapResolvedEndpoint
): JourneyMapStageLocalBypass | undefined {
  if (eligibility.archetype !== "non_adjacent_forward_same_stage" || !eligibility.sourceStage) {
    return undefined;
  }
  const stepIds = eligibility.sourceStage.stepIds.slice(
    eligibility.sourceStepOrder,
    eligibility.targetStepOrder + 1
  );
  const childrenById = new Map(
    eligibility.sourceStage.stage.children
      .filter((child): child is PositionedNode => child.kind === "node")
      .map((child) => [child.id, child])
  );
  const spannedSteps = stepIds
    .map((stepId) => childrenById.get(stepId))
    .filter((step): step is PositionedNode => step !== undefined);
  if (spannedSteps.length !== stepIds.length) {
    return undefined;
  }
  const maximumStepBottom = Math.max(...spannedSteps.map((step) => step.y + step.height));
  const nominalCoordinate = roundMetric(maximumStepBottom + MIN_ARROW_MARKER_LEG);
  const stageBottom = eligibility.sourceStage.stage.y + eligibility.sourceStage.stage.height;
  if (nominalCoordinate >= stageBottom) {
    return undefined;
  }
  return {
    stageId: eligibility.sourceStage.stage.id,
    axis: "horizontal",
    nominalCoordinate,
    span: {
      start: roundMetric(Math.min(source.x, target.x)),
      end: roundMetric(Math.max(source.x, target.x))
    },
    intermediateStepIds: stepIds.slice(1, -1),
    obstacleControls: spannedSteps.slice(1, -1).map((step) => ({
      stepId: step.id,
      entryX: roundMetric(step.x),
      exitX: roundMetric(step.x + step.width)
    })),
    order: 0,
    locked: false
  };
}

function rootOrderOf(item: PositionedItem): number | undefined {
  const metadata = item.viewMetadata?.journeyMap;
  return metadata?.kind === "stage" || metadata?.kind === "step"
    ? metadata.rootOrder
    : undefined;
}

function buildRootOuterBypass(
  eligibility: RouteEligibility,
  root: PositionedContainer,
  source: JourneyMapResolvedEndpoint,
  target: JourneyMapResolvedEndpoint
): JourneyMapRootOuterBypass | undefined {
  if (eligibility.archetype !== "long_forward_cross_stage"
    || !eligibility.sourceStage
    || !eligibility.targetStage
    || root.children.length === 0) {
    return undefined;
  }
  const maximumRootItemBottom = Math.max(
    ...root.children.map((item) => item.y + item.height)
  );
  const nominalCoordinate = roundMetric(maximumRootItemBottom + MIN_ARROW_MARKER_LEG);
  if (nominalCoordinate >= root.y + root.height) {
    return undefined;
  }
  const sourceRootOrder = eligibility.source.metadata.rootOrder;
  const targetRootOrder = eligibility.target.metadata.rootOrder;
  const intermediateRootItems = root.children.filter((item) => {
    const rootOrder = rootOrderOf(item);
    return rootOrder !== undefined
      && rootOrder > sourceRootOrder
      && rootOrder < targetRootOrder;
  });
  return {
    ownerContainerId: root.id,
    axis: "horizontal",
    nominalCoordinate,
    span: {
      start: roundMetric(Math.min(source.x, target.x)),
      end: roundMetric(Math.max(source.x, target.x))
    },
    intermediateRootItemIds: intermediateRootItems.map((item) => item.id),
    obstacleControls: intermediateRootItems.map((item) => ({
      rootItemId: item.id,
      entryX: roundMetric(item.x),
      exitX: roundMetric(item.x + item.width)
    })),
    order: 0,
    locked: false
  };
}

function cloneRoutePoints(points: readonly Point[]): Point[] {
  return points.map((point) => ({ x: point.x, y: point.y }));
}

function buildEastWestForwardRoute(
  source: JourneyMapResolvedEndpoint,
  target: JourneyMapResolvedEndpoint
): PositionedRoute | undefined {
  if (source.side !== "east" || target.side !== "west" || source.x >= target.x) {
    return undefined;
  }
  if (source.y === target.y) {
    return { style: "orthogonal", points: cloneRoutePoints([source, target]) };
  }
  const bendX = roundMetric((source.x + target.x) / 2);
  if (bendX - source.x < MIN_ARROW_MARKER_LEG || target.x - bendX < MIN_ARROW_MARKER_LEG) {
    return undefined;
  }
  return {
    style: "orthogonal",
    points: cloneRoutePoints([
      source,
      { x: bendX, y: source.y },
      { x: bendX, y: target.y },
      target
    ])
  };
}

function buildAdjacentRootStepRoute(
  source: JourneyMapResolvedEndpoint,
  target: JourneyMapResolvedEndpoint
): PositionedRoute | undefined {
  if (source.y !== target.y) {
    return undefined;
  }
  return buildEastWestForwardRoute(source, target);
}

function buildBasicRoute(
  archetype: JourneyMapBasicRouteArchetype,
  source: JourneyMapResolvedEndpoint,
  target: JourneyMapResolvedEndpoint,
  stageGates: readonly JourneyMapStageGate[],
  includeStageGateVertices: boolean
): PositionedRoute | undefined {
  if (source.x >= target.x) {
    return undefined;
  }
  if (archetype === "adjacent_forward_same_stage") {
    return buildEastWestForwardRoute(source, target);
  }

  const [sourceGate, targetGate] = stageGates;
  if (!sourceGate || !targetGate || source.x >= sourceGate.x || sourceGate.x >= targetGate.x || targetGate.x >= target.x) {
    return undefined;
  }
  const bridgeX = roundMetric((sourceGate.x + targetGate.x) / 2);
  if (!includeStageGateVertices) {
    return source.y === target.y
      ? { style: "orthogonal", points: cloneRoutePoints([source, target]) }
      : {
        style: "orthogonal",
        points: cloneRoutePoints([
          source,
          { x: bridgeX, y: source.y },
          { x: bridgeX, y: target.y },
          target
        ])
      };
  }
  if (source.y === target.y) {
    return {
      style: "orthogonal",
      points: cloneRoutePoints([source, sourceGate, targetGate, target])
    };
  }
  return {
    style: "orthogonal",
    points: cloneRoutePoints([
      source,
      sourceGate,
      { x: bridgeX, y: source.y },
      { x: bridgeX, y: target.y },
      targetGate,
      target
    ])
  };
}

function buildRootOuterBypassRoute(
  source: JourneyMapResolvedEndpoint,
  target: JourneyMapResolvedEndpoint,
  bypass: JourneyMapRootOuterBypass,
  stageGates: readonly JourneyMapStageGate[],
  includeControls: boolean
): PositionedRoute | undefined {
  const [sourceGate, targetGate] = stageGates;
  if (source.side !== "south"
    || target.side !== "south"
    || sourceGate?.side !== "south"
    || targetGate?.side !== "south"
    || source.x >= target.x
    || bypass.nominalCoordinate <= sourceGate.y
    || bypass.nominalCoordinate <= targetGate.y
    || bypass.nominalCoordinate - source.y < MIN_ARROW_MARKER_LEG
    || bypass.nominalCoordinate - target.y < MIN_ARROW_MARKER_LEG) {
    return undefined;
  }
  return {
    style: "orthogonal",
    points: cloneRoutePoints([
      source,
      ...(includeControls ? [sourceGate] : []),
      { x: source.x, y: bypass.nominalCoordinate },
      ...(includeControls
        ? bypass.obstacleControls.flatMap((control) => [
          { x: control.entryX, y: bypass.nominalCoordinate },
          { x: control.exitX, y: bypass.nominalCoordinate }
        ])
        : []),
      { x: target.x, y: bypass.nominalCoordinate },
      ...(includeControls ? [targetGate] : []),
      target
    ])
  };
}

function buildStageLocalBypassRoute(
  source: JourneyMapResolvedEndpoint,
  target: JourneyMapResolvedEndpoint,
  bypass: JourneyMapStageLocalBypass,
  includeObstacleControls: boolean
): PositionedRoute | undefined {
  const sourceLeg = Math.abs(bypass.nominalCoordinate - source.y);
  const targetLeg = Math.abs(bypass.nominalCoordinate - target.y);
  if (source.side !== "south"
    || target.side !== "south"
    || source.x >= target.x
    || bypass.nominalCoordinate <= source.y
    || bypass.nominalCoordinate <= target.y
    || sourceLeg < MIN_ARROW_MARKER_LEG
    || targetLeg < MIN_ARROW_MARKER_LEG) {
    return undefined;
  }
  return {
    style: "orthogonal",
    points: cloneRoutePoints([
      source,
      { x: source.x, y: bypass.nominalCoordinate },
      ...(includeObstacleControls
        ? bypass.obstacleControls.flatMap((control) => [
          { x: control.entryX, y: bypass.nominalCoordinate },
          { x: control.exitX, y: bypass.nominalCoordinate }
        ])
        : []),
      { x: target.x, y: bypass.nominalCoordinate },
      target
    ])
  };
}

function buildPriority(
  edge: MeasuredEdge,
  metadata: JourneyMapEdgeMetadata,
  eligibility: RouteEligibility
): JourneyMapRoutePriority {
  return {
    archetypeRank: eligibility.archetype === "adjacent_forward_same_stage"
      ? 0
      : eligibility.archetype === "adjacent_forward_cross_stage"
        ? 1
        : eligibility.archetype === "non_adjacent_forward_same_stage"
          ? 2
          : 3,
    sourceRootOrder: eligibility.source.metadata.rootOrder,
    sourceStepOrder: eligibility.sourceStepOrder,
    authorOrder: metadata.authorOrder,
    targetRootOrder: eligibility.target.metadata.rootOrder,
    targetStepOrder: eligibility.targetStepOrder,
    sameEndpointOrdinal: metadata.sameEndpointOrdinal,
    exactIdentityOrdinal: metadata.exactIdentityOrdinal,
    edgeId: edge.id
  };
}

function comparePriorities(left: JourneyMapRoutePriority, right: JourneyMapRoutePriority): number {
  return left.archetypeRank - right.archetypeRank
    || left.sourceRootOrder - right.sourceRootOrder
    || left.sourceStepOrder - right.sourceStepOrder
    || left.authorOrder - right.authorOrder
    || left.targetRootOrder - right.targetRootOrder
    || left.targetStepOrder - right.targetStepOrder
    || left.sameEndpointOrdinal - right.sameEndpointOrdinal
    || left.exactIdentityOrdinal - right.exactIdentityOrdinal
    || left.edgeId.localeCompare(right.edgeId);
}

function emptyBucket(): JourneyMapNodeEdgeBucketLists {
  return { startingConnectorIds: [], endingConnectorIds: [] };
}

function buildNodeEdgeBuckets(
  plans: readonly JourneyMapConnectorPlan[],
  index: JourneyMapPositionedIndex
): JourneyMapNodeEdgeBuckets[] {
  const bucketsByNodeId = new Map<string, JourneyMapNodeEdgeBuckets>();
  const getBucket = (nodeId: string): JourneyMapNodeEdgeBuckets => {
    const existing = bucketsByNodeId.get(nodeId);
    if (existing) {
      return existing;
    }
    const created = {
      nodeId,
      north: emptyBucket(),
      south: emptyBucket(),
      east: emptyBucket(),
      west: emptyBucket()
    };
    bucketsByNodeId.set(nodeId, created);
    return created;
  };
  for (const plan of plans) {
    getBucket(plan.from)[plan.sourceEndpoint.side].startingConnectorIds.push(plan.id);
    getBucket(plan.to)[plan.targetEndpoint.side].endingConnectorIds.push(plan.id);
  }
  return [...bucketsByNodeId.values()].sort((left, right) =>
    (index.nodeById.get(left.nodeId)?.metadata.globalStepOrder ?? Number.MAX_SAFE_INTEGER)
      - (index.nodeById.get(right.nodeId)?.metadata.globalStepOrder ?? Number.MAX_SAFE_INTEGER)
    || left.nodeId.localeCompare(right.nodeId)
  );
}

function routeSegments(route: PositionedRoute): Array<{ start: Point; end: Point; index: number }> {
  const segments: Array<{ start: Point; end: Point; index: number }> = [];
  for (let index = 1; index < route.points.length; index += 1) {
    segments.push({ start: route.points[index - 1]!, end: route.points[index]!, index: index - 1 });
  }
  return segments;
}

function segmentLength(start: Point, end: Point): number | undefined {
  if (start.x === end.x) {
    return Math.abs(end.y - start.y);
  }
  if (start.y === end.y) {
    return Math.abs(end.x - start.x);
  }
  return undefined;
}

function segmentIntersectsRectInterior(start: Point, end: Point, rect: Rect): boolean {
  if (start.y === end.y) {
    const spanStart = Math.min(start.x, end.x);
    const spanEnd = Math.max(start.x, end.x);
    return start.y > rect.y
      && start.y < rect.y + rect.height
      && spanStart < rect.x + rect.width
      && spanEnd > rect.x;
  }
  if (start.x === end.x) {
    const spanStart = Math.min(start.y, end.y);
    const spanEnd = Math.max(start.y, end.y);
    return start.x > rect.x
      && start.x < rect.x + rect.width
      && spanStart < rect.y + rect.height
      && spanEnd > rect.y;
  }
  return true;
}

function nodeRect(indexedNode: IndexedJourneyNode): Rect {
  return {
    id: indexedNode.node.id,
    x: indexedNode.node.x,
    y: indexedNode.node.y,
    width: indexedNode.node.width,
    height: indexedNode.node.height
  };
}

function contentRect(node: PositionedNode, block: MeasuredContentBlock): Rect {
  return {
    id: block.id,
    x: node.x + block.x,
    y: node.y + block.y,
    width: block.width,
    height: block.height
  };
}

function intersectsRoute(route: PositionedRoute, rect: Rect): boolean {
  return routeSegments(route).some(({ start, end }) => segmentIntersectsRectInterior(start, end, rect));
}

function routeContainsPoint(route: PositionedRoute, point: Point): boolean {
  return routeSegments(route).some(({ start, end }) => {
    if (start.x === end.x && point.x === start.x) {
      return point.y >= Math.min(start.y, end.y) && point.y <= Math.max(start.y, end.y);
    }
    if (start.y === end.y && point.y === start.y) {
      return point.x >= Math.min(start.x, end.x) && point.x <= Math.max(start.x, end.x);
    }
    return false;
  });
}

function routeContainsHorizontalSpan(
  route: PositionedRoute,
  y: number,
  spanStart: number,
  spanEnd: number
): boolean {
  const spans = routeSegments(route)
    .filter(({ start, end }) => start.y === y && end.y === y)
    .map(({ start, end }) => ({
      start: Math.min(start.x, end.x),
      end: Math.max(start.x, end.x)
    }))
    .sort((left, right) => left.start - right.start || left.end - right.end);
  let coveredThrough = spanStart;
  for (const span of spans) {
    if (span.end < coveredThrough) {
      continue;
    }
    if (span.start > coveredThrough) {
      return false;
    }
    coveredThrough = Math.max(coveredThrough, span.end);
    if (coveredThrough >= spanEnd) {
      return true;
    }
  }
  return false;
}

function endpointIsOnExterior(
  endpoint: JourneyMapResolvedEndpoint,
  node: PositionedNode
): boolean {
  switch (endpoint.side) {
    case "north":
      return endpoint.y === node.y
        && endpoint.x >= node.x
        && endpoint.x <= node.x + node.width;
    case "south":
      return endpoint.y === node.y + node.height
        && endpoint.x >= node.x
        && endpoint.x <= node.x + node.width;
    case "east":
      return endpoint.x === node.x + node.width
        && endpoint.y >= node.y
        && endpoint.y <= node.y + node.height;
    case "west":
      return endpoint.x === node.x
        && endpoint.y >= node.y
        && endpoint.y <= node.y + node.height;
  }
}

function pushGeometryDiagnostic(
  diagnostics: RendererDiagnostic[],
  code: string,
  message: string,
  edgeId: string,
  relatedIds: string[]
): void {
  diagnostics.push(createRoutingDiagnostic(
    code,
    message,
    edgeId,
    "error",
    JSON.stringify({ relatedIds })
  ));
}

export type JourneyMapRouteValidationStage = "step2" | "provisional" | "final_basic";

export function validateJourneyMapRoutes(
  plans: readonly JourneyMapConnectorPlan[],
  positionedScene: PositionedScene,
  routeStage: JourneyMapRouteValidationStage = "provisional"
): RendererDiagnostic[] {
  const diagnostics: RendererDiagnostic[] = [];
  const index = buildJourneyMapPositionedIndex(positionedScene);
  for (const plan of plans) {
    const route = routeStage === "step2"
      ? plan.step2Route
      : routeStage === "provisional"
        ? plan.provisionalRoute
        : plan.finalBasicRoute;
    const segments = routeSegments(route);
    const firstPoint = route.points[0];
    const lastPoint = route.points.at(-1);
    const startsAtSource = firstPoint?.x === plan.sourceEndpoint.x
      && firstPoint.y === plan.sourceEndpoint.y;
    const endsAtTarget = lastPoint?.x === plan.targetEndpoint.x
      && lastPoint.y === plan.targetEndpoint.y;
    if (route.points.length < 2 || !startsAtSource || !endsAtTarget) {
      pushGeometryDiagnostic(
        diagnostics,
        "renderer.routing.journey_map_endpoint_intrusion",
        `Journey edge "${plan.id}" has a disconnected or empty ${routeStage} route.`,
        plan.id,
        [plan.id, !startsAtSource ? plan.from : plan.to]
      );
    }
    if (segments.some(({ start, end }) => segmentLength(start, end) === undefined)) {
      pushGeometryDiagnostic(
        diagnostics,
        "renderer.routing.journey_map_non_orthogonal_route",
        `Journey edge "${plan.id}" contains a non-orthogonal segment.`,
        plan.id,
        [plan.id]
      );
      continue;
    }

    const source = index.nodeById.get(plan.from);
    const target = index.nodeById.get(plan.to);
    if (!source || !target) {
      pushGeometryDiagnostic(
        diagnostics,
        "renderer.routing.journey_map_unresolved_endpoint",
        `Journey edge "${plan.id}" references a missing positioned endpoint.`,
        plan.id,
        [plan.id, !source ? plan.from : plan.to]
      );
      continue;
    }
    const sourceAtExterior = endpointIsOnExterior(plan.sourceEndpoint, source.node);
    const targetAtExterior = endpointIsOnExterior(plan.targetEndpoint, target.node);
    if (!sourceAtExterior || !targetAtExterior) {
      pushGeometryDiagnostic(
        diagnostics,
        "renderer.routing.journey_map_endpoint_intrusion",
        `Journey edge "${plan.id}" does not use legal exterior endpoints.`,
        plan.id,
        [plan.id, !sourceAtExterior ? plan.from : plan.to]
      );
    }

    for (const indexedNode of index.allNodes) {
      if (!intersectsRoute(route, nodeRect(indexedNode))) {
        continue;
      }
      const isEndpoint = indexedNode.node.id === plan.from || indexedNode.node.id === plan.to;
      pushGeometryDiagnostic(
        diagnostics,
        isEndpoint
          ? "renderer.routing.journey_map_endpoint_intrusion"
          : "renderer.routing.journey_map_node_intersection",
        `Journey edge "${plan.id}" intersects ${isEndpoint ? "endpoint" : "unrelated"} Step "${indexedNode.node.id}".`,
        plan.id,
        [plan.id, indexedNode.node.id]
      );
    }

    for (const indexedStage of index.allStages) {
      const headerBandHeight = indexedStage.stage.chrome.headerBandHeight ?? 0;
      const headerRect: Rect = {
        id: indexedStage.stage.id,
        x: indexedStage.stage.x,
        y: indexedStage.stage.y,
        width: indexedStage.stage.width,
        height: indexedStage.stage.chrome.padding.top + headerBandHeight
      };
      if (intersectsRoute(route, headerRect)) {
        pushGeometryDiagnostic(
          diagnostics,
          "renderer.routing.journey_map_stage_header_intersection",
          `Journey edge "${plan.id}" intersects Stage header "${indexedStage.stage.id}".`,
          plan.id,
          [plan.id, indexedStage.stage.id]
        );
      }
      const sourceStageId = source.metadata.stageId;
      const targetStageId = target.metadata.stageId;
      if (indexedStage.stage.id !== sourceStageId
        && indexedStage.stage.id !== targetStageId
        && intersectsRoute(route, {
          id: indexedStage.stage.id,
          x: indexedStage.stage.x,
          y: indexedStage.stage.y,
          width: indexedStage.stage.width,
          height: indexedStage.stage.height
        })) {
        pushGeometryDiagnostic(
          diagnostics,
          "renderer.routing.journey_map_unrelated_stage_intersection",
          `Journey edge "${plan.id}" intersects unrelated Stage "${indexedStage.stage.id}".`,
          plan.id,
          [plan.id, indexedStage.stage.id]
        );
      }
    }

    for (const indexedNode of index.allNodes) {
      for (const block of indexedNode.node.content.filter((candidate) => candidate.region === "secondary")) {
        if (intersectsRoute(route, contentRect(indexedNode.node, block))) {
          pushGeometryDiagnostic(
            diagnostics,
            "renderer.routing.journey_map_badge_intersection",
            `Journey edge "${plan.id}" intersects badge "${block.id}".`,
            plan.id,
            [plan.id, indexedNode.node.id, block.id]
          );
        }
      }
    }

    const firstSegment = segments[0];
    const lastSegment = segments[segments.length - 1];
    if (plan.markers?.start === "arrow"
      && (!firstSegment
        || (segmentLength(firstSegment.start, firstSegment.end) ?? 0) < MIN_ARROW_MARKER_LEG)) {
      diagnostics.push(createRoutingDiagnostic(
        "renderer.routing.marker_leg_minimum_unmet",
        `Journey edge "${plan.id}" has a start marker leg below ${MIN_ARROW_MARKER_LEG}px.`,
        plan.id,
        "info",
        JSON.stringify({ relatedIds: [plan.id] })
      ));
    }
    if (plan.markers?.end === "arrow"
      && (!lastSegment
        || (segmentLength(lastSegment.start, lastSegment.end) ?? 0) < MIN_ARROW_MARKER_LEG)) {
      diagnostics.push(createRoutingDiagnostic(
        "renderer.routing.marker_leg_minimum_unmet",
        `Journey edge "${plan.id}" has an end marker leg below ${MIN_ARROW_MARKER_LEG}px.`,
        plan.id,
        "info",
        JSON.stringify({ relatedIds: [plan.id] })
      ));
    }

    const expectedSourceStageId = source.metadata.stageId;
    const expectedTargetStageId = target.metadata.stageId;
    const gateContractMatches = plan.archetype === "adjacent_forward_cross_stage"
      ? plan.stageGates.length === 2
        && plan.stageGates[0]?.stageId === expectedSourceStageId
        && plan.stageGates[0]?.side === "east"
        && plan.stageGates[0]?.order === 0
        && plan.stageGates[0]?.locked === true
        && plan.stageGates[1]?.stageId === expectedTargetStageId
        && plan.stageGates[1]?.side === "west"
        && plan.stageGates[1]?.order === 0
        && plan.stageGates[1]?.locked === true
      : plan.archetype === "long_forward_cross_stage"
        ? plan.stageGates.length === 2
          && plan.stageGates[0]?.stageId === expectedSourceStageId
          && plan.stageGates[0]?.side === "south"
          && plan.stageGates[0]?.order === 0
          && plan.stageGates[0]?.locked === true
          && plan.stageGates[1]?.stageId === expectedTargetStageId
          && plan.stageGates[1]?.side === "south"
          && plan.stageGates[1]?.order === 0
          && plan.stageGates[1]?.locked === true
        : plan.stageGates.length === 0;
    if (!gateContractMatches) {
      diagnostics.push(createRoutingDiagnostic(
        "renderer.routing.journey_map_boundary_gate_fallback",
        `Journey edge "${plan.id}" does not expose its accepted ordered Stage-gate contract.`,
        plan.id,
        "warn",
        JSON.stringify({ relatedIds: [plan.id, expectedSourceStageId, expectedTargetStageId] })
      ));
    }
    for (const gate of plan.stageGates) {
      const stage = index.stageById.get(gate.stageId);
      const headerBottom = stage
        ? stage.stage.y + stage.stage.chrome.padding.top + (stage.stage.chrome.headerBandHeight ?? 0)
        : Number.NaN;
      const stageBottom = stage ? stage.stage.y + stage.stage.height : Number.NaN;
      const stageRight = stage ? stage.stage.x + stage.stage.width : Number.NaN;
      const gateIsOnBorder = stage !== undefined && (
        gate.side === "east"
          ? gate.x === stageRight && gate.y >= headerBottom && gate.y <= stageBottom
          : gate.side === "west"
            ? gate.x === stage.stage.x && gate.y >= headerBottom && gate.y <= stageBottom
            : gate.side === "south"
              ? gate.y === stageBottom && gate.x >= stage.stage.x && gate.x <= stageRight
              : gate.y === stage.stage.y && gate.x >= stage.stage.x && gate.x <= stageRight
      );
      const gateIsOnRoute = routeContainsPoint(route, gate);
      if (!stage
        || gate.locked !== true
        || !gateIsOnBorder
        || !gateIsOnRoute) {
        diagnostics.push(createRoutingDiagnostic(
          "renderer.routing.journey_map_boundary_gate_fallback",
          `Journey edge "${plan.id}" does not cross Stage "${gate.stageId}" at its locked ${gate.side} gate.`,
          plan.id,
          "warn",
          JSON.stringify({ relatedIds: [plan.id, gate.stageId] })
        ));
      }
    }

    const bypass = plan.stageLocalBypass;
    const bypassExpected = plan.archetype === "non_adjacent_forward_same_stage";
    if (bypassExpected) {
      const stage = bypass ? index.stageById.get(bypass.stageId) : undefined;
      const sourceStepOrder = source.metadata.stepOrder;
      const targetStepOrder = target.metadata.stepOrder;
      const expectedStepIds = stage && sourceStepOrder !== undefined && targetStepOrder !== undefined
        ? stage.stepIds.slice(sourceStepOrder, targetStepOrder + 1)
        : [];
      const spannedSteps = expectedStepIds
        .map((stepId) => index.nodeById.get(stepId)?.node)
        .filter((step): step is PositionedNode => step !== undefined);
      const maximumStepBottom = spannedSteps.length > 0
        ? Math.max(...spannedSteps.map((step) => step.y + step.height))
        : Number.NaN;
      const expectedObstacleControls = spannedSteps.slice(1, -1).map((step) => ({
        stepId: step.id,
        entryX: roundMetric(step.x),
        exitX: roundMetric(step.x + step.width)
      }));
      const stageBottom = stage ? stage.stage.y + stage.stage.height : Number.NaN;
      const routeHasProvisionalControls = routeStage === "step2"
        || expectedObstacleControls.every((control) =>
          route.points.some((point) =>
            point.x === control.entryX && point.y === bypass?.nominalCoordinate
          )
          && route.points.some((point) =>
            point.x === control.exitX && point.y === bypass?.nominalCoordinate
          )
        );
      const bypassContractMatches = bypass !== undefined
        && stage?.stage.id === expectedSourceStageId
        && expectedSourceStageId === expectedTargetStageId
        && bypass.axis === "horizontal"
        && bypass.nominalCoordinate === roundMetric(maximumStepBottom + MIN_ARROW_MARKER_LEG)
        && bypass.nominalCoordinate < stageBottom
        && bypass.span.start === Math.min(plan.sourceEndpoint.x, plan.targetEndpoint.x)
        && bypass.span.end === Math.max(plan.sourceEndpoint.x, plan.targetEndpoint.x)
        && JSON.stringify(bypass.intermediateStepIds) === JSON.stringify(expectedStepIds.slice(1, -1))
        && JSON.stringify(bypass.obstacleControls) === JSON.stringify(expectedObstacleControls)
        && bypass.order === 0
        && bypass.locked === false
        && routeHasProvisionalControls
        && routeContainsHorizontalSpan(
          route,
          bypass.nominalCoordinate,
          bypass.span.start,
          bypass.span.end
        );
      if (!bypassContractMatches) {
        diagnostics.push(createRoutingDiagnostic(
          "renderer.routing.journey_map_archetype_fallback",
          `Journey edge "${plan.id}" does not expose its accepted Stage-local bypass contract.`,
          plan.id,
          "warn",
          JSON.stringify({ relatedIds: [plan.id, expectedSourceStageId] })
        ));
      }
    } else if (bypass) {
      diagnostics.push(createRoutingDiagnostic(
        "renderer.routing.journey_map_archetype_fallback",
        `Journey edge "${plan.id}" exposes an unexpected Stage-local bypass contract.`,
        plan.id,
        "warn",
        JSON.stringify({ relatedIds: [plan.id, bypass.stageId] })
      ));
    }

    const rootBypass = plan.rootOuterBypass;
    const rootBypassExpected = plan.archetype === "long_forward_cross_stage";
    if (rootBypassExpected) {
      const maximumRootItemBottom = positionedScene.root.children.length > 0
        ? Math.max(...positionedScene.root.children.map((item) => item.y + item.height))
        : Number.NaN;
      const expectedNominalCoordinate = roundMetric(
        maximumRootItemBottom + MIN_ARROW_MARKER_LEG
      );
      const sourceRootOrder = source.metadata.rootOrder;
      const targetRootOrder = target.metadata.rootOrder;
      const intermediateRootItems = positionedScene.root.children.filter((item) => {
        const rootOrder = rootOrderOf(item);
        return rootOrder !== undefined
          && rootOrder > sourceRootOrder
          && rootOrder < targetRootOrder;
      });
      const expectedObstacleControls = intermediateRootItems.map((item) => ({
        rootItemId: item.id,
        entryX: roundMetric(item.x),
        exitX: roundMetric(item.x + item.width)
      }));
      const routeHasProvisionalControls = routeStage === "step2"
        || expectedObstacleControls.every((control) =>
          route.points.some((point) =>
            point.x === control.entryX && point.y === rootBypass?.nominalCoordinate
          )
          && route.points.some((point) =>
            point.x === control.exitX && point.y === rootBypass?.nominalCoordinate
          )
        );
      const rootBypassContractMatches = rootBypass !== undefined
        && rootBypass.ownerContainerId === positionedScene.root.id
        && plan.ownerContainerId === positionedScene.root.id
        && rootBypass.axis === "horizontal"
        && rootBypass.nominalCoordinate === expectedNominalCoordinate
        && rootBypass.nominalCoordinate < positionedScene.root.y + positionedScene.root.height
        && rootBypass.span.start === Math.min(plan.sourceEndpoint.x, plan.targetEndpoint.x)
        && rootBypass.span.end === Math.max(plan.sourceEndpoint.x, plan.targetEndpoint.x)
        && JSON.stringify(rootBypass.intermediateRootItemIds)
          === JSON.stringify(intermediateRootItems.map((item) => item.id))
        && JSON.stringify(rootBypass.obstacleControls) === JSON.stringify(expectedObstacleControls)
        && rootBypass.order === 0
        && rootBypass.locked === false
        && routeHasProvisionalControls
        && routeContainsHorizontalSpan(
          route,
          rootBypass.nominalCoordinate,
          rootBypass.span.start,
          rootBypass.span.end
        );
      if (!rootBypassContractMatches) {
        diagnostics.push(createRoutingDiagnostic(
          "renderer.routing.journey_map_archetype_fallback",
          `Journey edge "${plan.id}" does not expose its accepted root-outer bypass contract.`,
          plan.id,
          "warn",
          JSON.stringify({ relatedIds: [plan.id, positionedScene.root.id] })
        ));
      }
    } else if (rootBypass) {
      diagnostics.push(createRoutingDiagnostic(
        "renderer.routing.journey_map_archetype_fallback",
        `Journey edge "${plan.id}" exposes an unexpected root-outer bypass contract.`,
        plan.id,
        "warn",
        JSON.stringify({ relatedIds: [plan.id, rootBypass.ownerContainerId] })
      ));
    }
  }
  return sortRendererDiagnostics(diagnostics);
}

export function validateJourneyMapBasicRoutes(
  plans: readonly JourneyMapConnectorPlan[],
  positionedScene: PositionedScene,
  routeStage: "step2" | "final_basic" = "final_basic"
): RendererDiagnostic[] {
  return validateJourneyMapRoutes(plans, positionedScene, routeStage);
}

function positionedEdgeFromPlan(plan: JourneyMapConnectorPlan, route: PositionedRoute): PositionedEdge {
  return {
    id: plan.id,
    role: plan.role,
    classes: [...plan.classes],
    from: {
      itemId: plan.sourceEndpoint.itemId,
      portId: plan.sourceEndpoint.portId,
      x: plan.sourceEndpoint.x,
      y: plan.sourceEndpoint.y
    },
    to: {
      itemId: plan.targetEndpoint.itemId,
      portId: plan.targetEndpoint.portId,
      x: plan.targetEndpoint.x,
      y: plan.targetEndpoint.y
    },
    route: {
      style: route.style,
      points: cloneRoutePoints(route.points)
    },
    ...(plan.markers ? { markers: { ...plan.markers } } : {}),
    paintGroup: "edges"
  };
}

function withRoutes(
  scene: PositionedScene,
  plans: readonly JourneyMapConnectorPlan[],
  routeForPlan: (plan: JourneyMapConnectorPlan) => PositionedRoute,
  diagnostics: readonly RendererDiagnostic[]
): PositionedScene {
  const cloned = structuredClone(scene) as PositionedScene;
  return {
    ...cloned,
    edges: plans.map((plan) => positionedEdgeFromPlan(plan, routeForPlan(plan))),
    diagnostics: sortRendererDiagnostics([...scene.diagnostics, ...diagnostics])
  };
}

export function buildJourneyMapRoutingStages(
  measuredScene: MeasuredScene,
  preRoutingPositionedScene: PositionedScene
): JourneyMapRoutingStages {
  const diagnostics: RendererDiagnostic[] = [];
  const index = buildJourneyMapPositionedIndex(preRoutingPositionedScene);
  const degrees = buildDegreeIndex(measuredScene.edges);
  const connectorPlans: JourneyMapConnectorPlan[] = [];
  const deferredConnectors: JourneyMapDeferredConnector[] = [];
  const failedConnectorIds: string[] = [];
  const routeEligibleIds = new Set<string>();
  const occurrenceCountById = new Map<string, number>();
  for (const edge of measuredScene.edges) {
    occurrenceCountById.set(edge.id, (occurrenceCountById.get(edge.id) ?? 0) + 1);
  }
  const duplicateEdgeIds = new Set<string>();
  for (const [edgeId, count] of occurrenceCountById) {
    if (count <= 1) {
      continue;
    }
    duplicateEdgeIds.add(edgeId);
    failedConnectorIds.push(edgeId);
    diagnostics.push(createRoutingDiagnostic(
      "renderer.routing.journey_map_edge_duplicated",
      `Journey edge "${edgeId}" appears ${count} times with the same stable ID.`,
      edgeId,
      "error",
      JSON.stringify({ relatedIds: [edgeId] })
    ));
  }

  for (const edge of measuredScene.edges) {
    if (duplicateEdgeIds.has(edge.id)) {
      continue;
    }
    const eligibility = resolveRouteEligibility(edge, index, degrees);
    if (!eligibility) {
      const sourceExists = index.nodeById.has(edge.from.itemId);
      const targetExists = index.nodeById.has(edge.to.itemId);
      if (!sourceExists || !targetExists) {
        diagnostics.push(createRoutingDiagnostic(
          "renderer.routing.journey_map_unresolved_endpoint",
          `Journey edge "${edge.id}" references a missing positioned Step.`,
          edge.id,
          "error",
          JSON.stringify({ relatedIds: [edge.id, !sourceExists ? edge.from.itemId : edge.to.itemId] })
        ));
        failedConnectorIds.push(edge.id);
      } else {
        deferredConnectors.push({
          id: edge.id,
          from: edge.from.itemId,
          to: edge.to.itemId,
          deferredFamilies: classifyDeferredFamilies(edge, index, degrees)
        });
      }
      continue;
    }
    routeEligibleIds.add(edge.id);
    const edgeMetadata = edge.viewMetadata?.journeyMap;
    const expectedOwnerId = eligibility.sourceStage
      && eligibility.targetStage
      && eligibility.sourceStage.stage.id === eligibility.targetStage.stage.id
      ? eligibility.sourceStage.stage.id
      : preRoutingPositionedScene.root.id;
    if (!edgeMetadata || edge.ownerContainerId !== expectedOwnerId) {
      diagnostics.push(createRoutingDiagnostic(
        "renderer.routing.journey_map_edge_omitted",
        `Journey edge "${edge.id}" is missing typed identity metadata or its accepted routing owner.`,
        edge.id,
        "error",
        JSON.stringify({ relatedIds: [edge.id, expectedOwnerId] })
      ));
      failedConnectorIds.push(edge.id);
      continue;
    }
    const usesStageLocalBypass = eligibility.archetype === "non_adjacent_forward_same_stage";
    const usesRootOuterBypass = eligibility.archetype === "long_forward_cross_stage";
    const usesSouthEndpoints = usesStageLocalBypass || usesRootOuterBypass;
    const sourceEndpoint = resolveEndpoint(
      edge,
      eligibility.source,
      "source",
      usesSouthEndpoints ? "journey_escape_out" : edge.routing.sourcePortRole,
      usesSouthEndpoints ? "south" : "east",
      diagnostics
    );
    const targetEndpoint = resolveEndpoint(
      edge,
      eligibility.target,
      "target",
      usesSouthEndpoints ? "journey_escape_in" : edge.routing.targetPortRole,
      usesSouthEndpoints ? "south" : "west",
      diagnostics
    );
    if (!sourceEndpoint || !targetEndpoint) {
      diagnostics.push(createRoutingDiagnostic(
        "renderer.routing.journey_map_edge_omitted",
        `Journey edge "${edge.id}" could not be reconstructed after endpoint resolution.`,
        edge.id,
        "error",
        JSON.stringify({ relatedIds: [edge.id] })
      ));
      failedConnectorIds.push(edge.id);
      continue;
    }
    const stageGates = buildStageGates(eligibility, sourceEndpoint, targetEndpoint);
    const stageLocalBypass = buildStageLocalBypass(eligibility, sourceEndpoint, targetEndpoint);
    const rootOuterBypass = buildRootOuterBypass(
      eligibility,
      preRoutingPositionedScene.root,
      sourceEndpoint,
      targetEndpoint
    );
    const basicArchetype = isBasicRouteArchetype(eligibility.archetype)
      ? eligibility.archetype
      : undefined;
    const step2Route = usesStageLocalBypass && stageLocalBypass
      ? buildStageLocalBypassRoute(sourceEndpoint, targetEndpoint, stageLocalBypass, false)
      : usesRootOuterBypass && rootOuterBypass
        ? buildRootOuterBypassRoute(
          sourceEndpoint,
          targetEndpoint,
          rootOuterBypass,
          stageGates,
          false
        )
        : eligibility.archetype === "adjacent_forward_root_step"
          ? buildAdjacentRootStepRoute(sourceEndpoint, targetEndpoint)
      : basicArchetype
        ? buildBasicRoute(
          basicArchetype,
          sourceEndpoint,
          targetEndpoint,
          stageGates,
          false
        )
        : undefined;
    const provisionalRoute = usesStageLocalBypass && stageLocalBypass
      ? buildStageLocalBypassRoute(sourceEndpoint, targetEndpoint, stageLocalBypass, true)
      : usesRootOuterBypass && rootOuterBypass
        ? buildRootOuterBypassRoute(
          sourceEndpoint,
          targetEndpoint,
          rootOuterBypass,
          stageGates,
          true
        )
        : eligibility.archetype === "adjacent_forward_root_step"
          ? buildAdjacentRootStepRoute(sourceEndpoint, targetEndpoint)
      : basicArchetype
        ? buildBasicRoute(
          basicArchetype,
          sourceEndpoint,
          targetEndpoint,
          stageGates,
          true
        )
        : undefined;
    const finalBasicRoute = provisionalRoute
      ? { style: provisionalRoute.style, points: cloneRoutePoints(provisionalRoute.points) }
      : undefined;
    if (!step2Route || !provisionalRoute || !finalBasicRoute) {
      diagnostics.push(createRoutingDiagnostic(
        "renderer.routing.journey_map_archetype_fallback",
        `Journey edge "${edge.id}" could not construct its accepted route template.`,
        edge.id,
        "warn",
        JSON.stringify({ relatedIds: [edge.id] })
      ));
      diagnostics.push(createRoutingDiagnostic(
        "renderer.routing.journey_map_edge_omitted",
        `Journey edge "${edge.id}" was omitted after basic route construction failed.`,
        edge.id,
        "error",
        JSON.stringify({ relatedIds: [edge.id] })
      ));
      failedConnectorIds.push(edge.id);
      continue;
    }
    const priority = buildPriority(edge, edgeMetadata, eligibility);
    connectorPlans.push({
      id: edge.id,
      from: edge.from.itemId,
      to: edge.to.itemId,
      ownerContainerId: expectedOwnerId,
      archetype: eligibility.archetype,
      priority,
      authorOrder: edgeMetadata.authorOrder,
      sameEndpointOrdinal: edgeMetadata.sameEndpointOrdinal,
      exactIdentityOrdinal: edgeMetadata.exactIdentityOrdinal,
      sourceEndpoint,
      targetEndpoint,
      stageGates,
      ...(stageLocalBypass ? { stageLocalBypass } : {}),
      ...(rootOuterBypass ? { rootOuterBypass } : {}),
      role: edge.role,
      classes: [...edge.classes],
      ...(edge.markers ? { markers: { ...edge.markers } } : {}),
      step2Route,
      provisionalRoute,
      finalBasicRoute
    });
  }

  connectorPlans.sort((left, right) => comparePriorities(left.priority, right.priority));
  const routedCountById = new Map<string, number>();
  for (const plan of connectorPlans) {
    routedCountById.set(plan.id, (routedCountById.get(plan.id) ?? 0) + 1);
  }
  for (const [edgeId, count] of routedCountById) {
    if (count > 1) {
      diagnostics.push(createRoutingDiagnostic(
        "renderer.routing.journey_map_edge_duplicated",
        `Journey edge "${edgeId}" was reconstructed ${count} times.`,
        edgeId,
        "error",
        JSON.stringify({ relatedIds: [edgeId] })
      ));
    }
  }
  for (const edgeId of routeEligibleIds) {
    if (!routedCountById.has(edgeId) && !failedConnectorIds.includes(edgeId)) {
      diagnostics.push(createRoutingDiagnostic(
        "renderer.routing.journey_map_edge_omitted",
        `Eligible journey edge "${edgeId}" has no reconstructed accepted route.`,
        edgeId,
        "error",
        JSON.stringify({ relatedIds: [edgeId] })
      ));
      failedConnectorIds.push(edgeId);
    }
  }

  const step2ValidationDiagnostics = validateJourneyMapBasicRoutes(
    connectorPlans,
    preRoutingPositionedScene,
    "step2"
  );
  const finalBasicValidationDiagnostics = validateJourneyMapBasicRoutes(
    connectorPlans,
    preRoutingPositionedScene,
    "final_basic"
  );
  const provisionalValidationDiagnostics = validateJourneyMapRoutes(
    connectorPlans,
    preRoutingPositionedScene,
    "provisional"
  );
  diagnostics.push(
    ...step2ValidationDiagnostics,
    ...provisionalValidationDiagnostics,
    ...finalBasicValidationDiagnostics
  );
  const sortedDiagnostics = sortRendererDiagnostics(diagnostics);
  const step2PositionedScene = withRoutes(
    preRoutingPositionedScene,
    connectorPlans,
    (plan) => plan.step2Route,
    sortedDiagnostics
  );
  const finalBasicPositionedScene = withRoutes(
    preRoutingPositionedScene,
    connectorPlans,
    (plan) => plan.finalBasicRoute,
    sortedDiagnostics
  );
  const provisionalPositionedScene = withRoutes(
    preRoutingPositionedScene,
    connectorPlans,
    (plan) => plan.provisionalRoute,
    sortedDiagnostics
  );

  return {
    connectorPlans,
    deferredConnectors,
    failedConnectorIds: [...new Set(failedConnectorIds)],
    nodeEdgeBuckets: buildNodeEdgeBuckets(connectorPlans, index),
    step2PositionedScene,
    provisionalPositionedScene,
    finalBasicPositionedScene,
    diagnostics: sortRendererDiagnostics([...preRoutingPositionedScene.diagnostics, ...sortedDiagnostics])
  };
}
