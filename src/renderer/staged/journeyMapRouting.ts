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
  | "adjacent_forward_root_step"
  | "adjacent_forward_root_to_contained"
  | "long_forward_root_step"
  | "adjacent_forward_contained_to_root"
  | "backward_same_stage"
  | "backward_root_step";

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
  archetypeRank: 0 | 1 | 2 | 3 | 4 | 5 | 6;
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
  endpointSpan?: {
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
  endpointSpan?: {
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

export interface JourneyMapBranchDepartureControl {
  axis: "vertical";
  nominalCoordinate: number;
  span: {
    start: number;
    end: number;
  };
  obstacleItemId: string;
  obstacleBoundaryCoordinate: number;
  order: 0;
  locked: false;
}

export interface JourneyMapBranchPlan {
  sourceOutdegree: number;
  sourceOrdinal: number;
  departureControl?: JourneyMapBranchDepartureControl;
}

export interface JourneyMapJoinArrivalControl {
  axis: "vertical";
  nominalCoordinate: number;
  span: {
    start: number;
    end: number;
  };
  obstacleItemId: string;
  obstacleBoundaryCoordinate: number;
  order: 0;
  locked: false;
}

export interface JourneyMapJoinPlan {
  targetIndegree: number;
  targetOrdinal: number;
  arrivalControl?: JourneyMapJoinArrivalControl;
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
  topologyModifiers?: ["branch"] | ["join"];
  branch?: JourneyMapBranchPlan;
  join?: JourneyMapJoinPlan;
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
  outgoingEdgeIdsByNodeId: Map<string, string[]>;
  incomingEdgeIdsByNodeId: Map<string, string[]>;
}

interface RouteEligibility {
  archetype: JourneyMapRouteArchetype;
  source: IndexedJourneyNode;
  target: IndexedJourneyNode;
  sourceStage?: IndexedJourneyStage;
  targetStage?: IndexedJourneyStage;
  sourceStepOrder: number;
  targetStepOrder: number;
  branch?: {
    sourceOutdegree: number;
    sourceOrdinal: number;
  };
  join?: {
    targetIndegree: number;
    targetOrdinal: number;
  };
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

function compareMeasuredEdgesByAuthoredOrder(left: MeasuredEdge, right: MeasuredEdge): number {
  const leftMetadata = left.viewMetadata?.journeyMap;
  const rightMetadata = right.viewMetadata?.journeyMap;
  return (leftMetadata?.authorOrder ?? Number.MAX_SAFE_INTEGER)
      - (rightMetadata?.authorOrder ?? Number.MAX_SAFE_INTEGER)
    || (leftMetadata?.sameEndpointOrdinal ?? Number.MAX_SAFE_INTEGER)
      - (rightMetadata?.sameEndpointOrdinal ?? Number.MAX_SAFE_INTEGER)
    || (leftMetadata?.exactIdentityOrdinal ?? Number.MAX_SAFE_INTEGER)
      - (rightMetadata?.exactIdentityOrdinal ?? Number.MAX_SAFE_INTEGER)
    || left.id.localeCompare(right.id);
}

function orderedEdgeIdsByNode(
  edgesByNodeId: ReadonlyMap<string, readonly MeasuredEdge[]>
): Map<string, string[]> {
  return new Map(
    [...edgesByNodeId].map(([nodeId, edges]) => [
      nodeId,
      [...edges].sort(compareMeasuredEdgesByAuthoredOrder).map((edge) => edge.id)
    ])
  );
}

function buildDegreeIndex(edges: readonly MeasuredEdge[]): JourneyDegreeIndex {
  const incomingByNodeId = new Map<string, number>();
  const outgoingByNodeId = new Map<string, number>();
  const sameEndpointCountByKey = new Map<string, number>();
  const outgoingTargetsByNodeId = new Map<string, string[]>();
  const outgoingEdgesByNodeId = new Map<string, MeasuredEdge[]>();
  const incomingEdgesByNodeId = new Map<string, MeasuredEdge[]>();
  for (const edge of edges) {
    outgoingByNodeId.set(edge.from.itemId, (outgoingByNodeId.get(edge.from.itemId) ?? 0) + 1);
    incomingByNodeId.set(edge.to.itemId, (incomingByNodeId.get(edge.to.itemId) ?? 0) + 1);
    const endpointKey = `${edge.from.itemId}\u0000${edge.to.itemId}`;
    sameEndpointCountByKey.set(endpointKey, (sameEndpointCountByKey.get(endpointKey) ?? 0) + 1);
    const targets = outgoingTargetsByNodeId.get(edge.from.itemId) ?? [];
    targets.push(edge.to.itemId);
    outgoingTargetsByNodeId.set(edge.from.itemId, targets);
    const outgoingEdges = outgoingEdgesByNodeId.get(edge.from.itemId) ?? [];
    outgoingEdges.push(edge);
    outgoingEdgesByNodeId.set(edge.from.itemId, outgoingEdges);
    const incomingEdges = incomingEdgesByNodeId.get(edge.to.itemId) ?? [];
    incomingEdges.push(edge);
    incomingEdgesByNodeId.set(edge.to.itemId, incomingEdges);
  }
  const outgoingEdgeIdsByNodeId = orderedEdgeIdsByNode(outgoingEdgesByNodeId);
  const incomingEdgeIdsByNodeId = orderedEdgeIdsByNode(incomingEdgesByNodeId);
  return {
    incomingByNodeId,
    outgoingByNodeId,
    sameEndpointCountByKey,
    outgoingTargetsByNodeId,
    outgoingEdgeIdsByNodeId,
    incomingEdgeIdsByNodeId
  };
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
  const endpointKey = `${source.node.id}\u0000${target.node.id}`;
  if ((degrees.sameEndpointCountByKey.get(endpointKey) ?? 0) !== 1
    || source.node.id === target.node.id
    || hasPath(target.node.id, source.node.id, degrees.outgoingTargetsByNodeId)) {
    return undefined;
  }
  const sourceOutdegree = degrees.outgoingByNodeId.get(source.node.id) ?? 0;
  const targetIndegree = degrees.incomingByNodeId.get(target.node.id) ?? 0;
  const isBranch = sourceOutdegree > 1;
  const sourceOrdinal = isBranch
    ? (degrees.outgoingEdgeIdsByNodeId.get(source.node.id) ?? []).indexOf(edge.id)
    : -1;
  if (isBranch && sourceOrdinal < 0) {
    return undefined;
  }
  const branch = isBranch ? { sourceOutdegree, sourceOrdinal } : undefined;
  const sourceStage = source.metadata.stageId
    ? index.stageById.get(source.metadata.stageId)
    : undefined;
  const targetStage = target.metadata.stageId
    ? index.stageById.get(target.metadata.stageId)
    : undefined;
  if ((source.metadata.stageId && !sourceStage) || (target.metadata.stageId && !targetStage)) {
    return undefined;
  }
  const sourceStepOrder = source.metadata.stepOrder;
  const targetStepOrder = target.metadata.stepOrder;
  if (sourceStage
    && targetStage
    && sourceStage.stage.id === targetStage.stage.id
    && sourceStepOrder !== undefined
    && targetStepOrder !== undefined
    && targetStepOrder < sourceStepOrder) {
    if (!branch && (sourceOutdegree !== 1 || targetIndegree !== 1)) {
      return undefined;
    }
    return {
      archetype: "backward_same_stage",
      source,
      target,
      sourceStage,
      targetStage,
      sourceStepOrder,
      targetStepOrder,
      ...(branch ? { branch } : {})
    };
  }
  if (!sourceStage
    && !targetStage
    && target.metadata.rootOrder < source.metadata.rootOrder) {
    if (sourceOutdegree !== 1 || targetIndegree !== 1) {
      return undefined;
    }
    return {
      archetype: "backward_root_step",
      source,
      target,
      sourceStepOrder: 0,
      targetStepOrder: 0,
    };
  }

  const isJoin = !isBranch && sourceOutdegree === 1 && targetIndegree > 1;
  if (!isBranch && !isJoin && (sourceOutdegree !== 1 || targetIndegree !== 1)) {
    return undefined;
  }
  const targetOrdinal = isJoin
    ? (degrees.incomingEdgeIdsByNodeId.get(target.node.id) ?? []).indexOf(edge.id)
    : -1;
  if (isJoin && targetOrdinal < 0) {
    return undefined;
  }
  const join = isJoin ? { targetIndegree, targetOrdinal } : undefined;
  if (join && (!sourceStage
    || !targetStage
    || sourceStage.stage.id !== targetStage.stage.id)) {
    return undefined;
  }
  if (!sourceStage && !targetStage) {
    if (target.metadata.rootOrder <= source.metadata.rootOrder) {
      return undefined;
    }
    if (!branch && target.metadata.rootOrder !== source.metadata.rootOrder + 1) {
      return undefined;
    }
    return {
      archetype: target.metadata.rootOrder === source.metadata.rootOrder + 1
        ? "adjacent_forward_root_step"
        : "long_forward_root_step",
      source,
      target,
      sourceStepOrder: 0,
      targetStepOrder: 0,
      ...(branch ? { branch } : {})
    };
  }
  if (!sourceStage || !targetStage) {
    if (!branch || target.metadata.rootOrder <= source.metadata.rootOrder) {
      return undefined;
    }
    if (!sourceStage && targetStage) {
      const targetStepOrder = target.metadata.stepOrder;
      if (targetStage.metadata.rootOrder !== source.metadata.rootOrder + 1
        || targetStepOrder !== 0) {
        return undefined;
      }
      return {
        archetype: "adjacent_forward_root_to_contained",
        source,
        target,
        targetStage,
        sourceStepOrder: 0,
        targetStepOrder,
        branch
      };
    }
    if (sourceStage && !targetStage) {
      const sourceStepOrder = source.metadata.stepOrder;
      if (target.metadata.rootOrder !== sourceStage.metadata.rootOrder + 1
        || sourceStepOrder !== sourceStage.stepIds.length - 1) {
        return undefined;
      }
      return {
        archetype: "adjacent_forward_contained_to_root",
        source,
        target,
        sourceStage,
        sourceStepOrder,
        targetStepOrder: 0,
        branch
      };
    }
    return undefined;
  }
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
      targetStepOrder,
      ...(branch ? { branch } : {}),
      ...(join ? { join } : {})
    };
  }

  if (targetStage.metadata.rootOrder <= sourceStage.metadata.rootOrder) {
    return undefined;
  }
  const isAdjacentDirectBridge = targetStage.metadata.rootOrder === sourceStage.metadata.rootOrder + 1
    && sourceStepOrder === sourceStage.stepIds.length - 1
    && targetStepOrder === 0;
  if (branch && !isAdjacentDirectBridge) {
    return undefined;
  }
  return {
    archetype: isAdjacentDirectBridge
      ? "adjacent_forward_cross_stage"
      : "long_forward_cross_stage",
    source,
    target,
    sourceStage,
    targetStage,
    sourceStepOrder,
    targetStepOrder,
    ...(branch ? { branch } : {})
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
  if (eligibility.archetype === "adjacent_forward_root_to_contained"
    && eligibility.targetStage) {
    return [{
      stageId: eligibility.targetStage.stage.id,
      side: "west",
      x: roundMetric(eligibility.targetStage.stage.x),
      y: target.y,
      order: 0,
      locked: true
    }];
  }
  if (eligibility.archetype === "adjacent_forward_contained_to_root"
    && eligibility.sourceStage) {
    return [{
      stageId: eligibility.sourceStage.stage.id,
      side: "east",
      x: roundMetric(eligibility.sourceStage.stage.x + eligibility.sourceStage.stage.width),
      y: source.y,
      order: 0,
      locked: true
    }];
  }
  if (eligibility.archetype === "long_forward_cross_stage"
    && eligibility.sourceStage
    && eligibility.targetStage) {
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
  if (eligibility.archetype !== "adjacent_forward_cross_stage"
    || !eligibility.sourceStage
    || !eligibility.targetStage) {
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
  if ((eligibility.archetype !== "non_adjacent_forward_same_stage"
    && eligibility.archetype !== "backward_same_stage")
    || !eligibility.sourceStage) {
    return undefined;
  }
  const firstStepOrder = Math.min(eligibility.sourceStepOrder, eligibility.targetStepOrder);
  const lastStepOrder = Math.max(eligibility.sourceStepOrder, eligibility.targetStepOrder);
  const stepIds = eligibility.sourceStage.stepIds.slice(
    firstStepOrder,
    lastStepOrder + 1
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
  const intermediateSteps = spannedSteps.slice(1, -1);
  const firstIntermediateStep = intermediateSteps[0];
  const lastIntermediateStep = intermediateSteps.at(-1);
  const usesBranchDeparture = eligibility.branch
    && eligibility.archetype !== "backward_same_stage";
  const branchDepartureX = usesBranchDeparture && firstIntermediateStep
    ? roundMetric((source.x + firstIntermediateStep.x) / 2)
    : undefined;
  const joinArrivalX = eligibility.join && lastIntermediateStep
    ? roundMetric((lastIntermediateStep.x + lastIntermediateStep.width + target.x) / 2)
    : undefined;
  if (usesBranchDeparture && (!firstIntermediateStep
    || branchDepartureX === undefined
    || branchDepartureX - source.x < MIN_ARROW_MARKER_LEG
    || firstIntermediateStep.x - branchDepartureX < MIN_ARROW_MARKER_LEG)) {
    return undefined;
  }
  if (eligibility.join && (!lastIntermediateStep
    || joinArrivalX === undefined
    || joinArrivalX - (lastIntermediateStep.x + lastIntermediateStep.width) < MIN_ARROW_MARKER_LEG
    || target.x - joinArrivalX < MIN_ARROW_MARKER_LEG)) {
    return undefined;
  }
  const trackStart = branchDepartureX ?? source.x;
  const trackEnd = joinArrivalX ?? target.x;
  return {
    stageId: eligibility.sourceStage.stage.id,
    axis: "horizontal",
    nominalCoordinate,
    span: {
      start: roundMetric(Math.min(trackStart, trackEnd)),
      end: roundMetric(Math.max(trackStart, trackEnd))
    },
    ...(eligibility.branch || eligibility.join ? {
      endpointSpan: {
        start: roundMetric(Math.min(source.x, target.x)),
        end: roundMetric(Math.max(source.x, target.x))
      }
    } : {}),
    intermediateStepIds: stepIds.slice(1, -1),
    obstacleControls: intermediateSteps.map((step) => ({
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
    && eligibility.archetype !== "long_forward_root_step"
    && eligibility.archetype !== "backward_root_step") {
    return undefined;
  }
  if (eligibility.archetype === "long_forward_cross_stage"
    && (!eligibility.sourceStage || !eligibility.targetStage)) {
    return undefined;
  }
  if (root.children.length === 0) {
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
  const firstRootOrder = Math.min(sourceRootOrder, targetRootOrder);
  const lastRootOrder = Math.max(sourceRootOrder, targetRootOrder);
  const intermediateRootItems = root.children.filter((item) => {
    const rootOrder = rootOrderOf(item);
    return rootOrder !== undefined
      && rootOrder > firstRootOrder
      && rootOrder < lastRootOrder;
  });
  const firstIntermediateRootItem = intermediateRootItems[0];
  const branchDepartureX = eligibility.branch && firstIntermediateRootItem
    ? roundMetric((source.x + firstIntermediateRootItem.x) / 2)
    : undefined;
  if (eligibility.branch && (!firstIntermediateRootItem
    || branchDepartureX === undefined
    || branchDepartureX - source.x < MIN_ARROW_MARKER_LEG
    || firstIntermediateRootItem.x - branchDepartureX < MIN_ARROW_MARKER_LEG)) {
    return undefined;
  }
  const trackStart = branchDepartureX ?? source.x;
  return {
    ownerContainerId: root.id,
    axis: "horizontal",
    nominalCoordinate,
    span: {
      start: roundMetric(Math.min(trackStart, target.x)),
      end: roundMetric(Math.max(trackStart, target.x))
    },
    ...(eligibility.branch ? {
      endpointSpan: {
        start: roundMetric(Math.min(source.x, target.x)),
        end: roundMetric(Math.max(source.x, target.x))
      }
    } : {}),
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

function buildBranchPlan(
  eligibility: RouteEligibility,
  source: JourneyMapResolvedEndpoint,
  stageLocalBypass: JourneyMapStageLocalBypass | undefined,
  rootOuterBypass: JourneyMapRootOuterBypass | undefined
): JourneyMapBranchPlan | undefined {
  if (!eligibility.branch) {
    return undefined;
  }
  const bypass = stageLocalBypass ?? rootOuterBypass;
  const obstacleControl = stageLocalBypass?.obstacleControls[0]
    ? {
      obstacleItemId: stageLocalBypass.obstacleControls[0].stepId,
      obstacleBoundaryCoordinate: stageLocalBypass.obstacleControls[0].entryX
    }
    : rootOuterBypass?.obstacleControls[0]
      ? {
        obstacleItemId: rootOuterBypass.obstacleControls[0].rootItemId,
        obstacleBoundaryCoordinate: rootOuterBypass.obstacleControls[0].entryX
      }
      : undefined;
  const departureControl = bypass && obstacleControl
    ? {
      axis: "vertical" as const,
      nominalCoordinate: bypass.span.start,
      span: {
        start: roundMetric(Math.min(source.y, bypass.nominalCoordinate)),
        end: roundMetric(Math.max(source.y, bypass.nominalCoordinate))
      },
      ...obstacleControl,
      order: 0 as const,
      locked: false as const
    }
    : undefined;
  return {
    sourceOutdegree: eligibility.branch.sourceOutdegree,
    sourceOrdinal: eligibility.branch.sourceOrdinal,
    ...(departureControl ? { departureControl } : {})
  };
}

function buildJoinPlan(
  eligibility: RouteEligibility,
  target: JourneyMapResolvedEndpoint,
  stageLocalBypass: JourneyMapStageLocalBypass | undefined
): JourneyMapJoinPlan | undefined {
  if (!eligibility.join) {
    return undefined;
  }
  const obstacleControl = stageLocalBypass?.obstacleControls.at(-1);
  const arrivalControl = stageLocalBypass && obstacleControl
    ? {
      axis: "vertical" as const,
      nominalCoordinate: stageLocalBypass.span.end,
      span: {
        start: roundMetric(Math.min(target.y, stageLocalBypass.nominalCoordinate)),
        end: roundMetric(Math.max(target.y, stageLocalBypass.nominalCoordinate))
      },
      obstacleItemId: obstacleControl.stepId,
      obstacleBoundaryCoordinate: obstacleControl.exitX,
      order: 0 as const,
      locked: false as const
    }
    : undefined;
  return {
    targetIndegree: eligibility.join.targetIndegree,
    targetOrdinal: eligibility.join.targetOrdinal,
    ...(arrivalControl ? { arrivalControl } : {})
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

function buildSingleStageBoundaryRoute(
  archetype: "adjacent_forward_root_to_contained" | "adjacent_forward_contained_to_root",
  source: JourneyMapResolvedEndpoint,
  target: JourneyMapResolvedEndpoint,
  stageGates: readonly JourneyMapStageGate[],
  includeStageGateVertex: boolean
): PositionedRoute | undefined {
  const [gate] = stageGates;
  if (!gate
    || source.side !== "east"
    || target.side !== "west"
    || source.x >= target.x) {
    return undefined;
  }
  const gateIsTargetBoundary = archetype === "adjacent_forward_root_to_contained";
  if ((gateIsTargetBoundary && (gate.side !== "west" || source.x >= gate.x || gate.x >= target.x))
    || (!gateIsTargetBoundary && (gate.side !== "east" || source.x >= gate.x || gate.x >= target.x))) {
    return undefined;
  }
  if (source.y === target.y) {
    return {
      style: "orthogonal",
      points: cloneRoutePoints(includeStageGateVertex ? [source, gate, target] : [source, target])
    };
  }
  const bendX = roundMetric(gateIsTargetBoundary
    ? (source.x + gate.x) / 2
    : (gate.x + target.x) / 2);
  if (bendX - source.x < MIN_ARROW_MARKER_LEG
    || target.x - bendX < MIN_ARROW_MARKER_LEG) {
    return undefined;
  }
  return {
    style: "orthogonal",
    points: cloneRoutePoints(gateIsTargetBoundary
      ? [
        source,
        { x: bendX, y: source.y },
        { x: bendX, y: target.y },
        ...(includeStageGateVertex ? [gate] : []),
        target
      ]
      : [
        source,
        ...(includeStageGateVertex ? [gate] : []),
        { x: bendX, y: source.y },
        { x: bendX, y: target.y },
        target
      ])
  };
}

function buildRootOuterBypassRoute(
  source: JourneyMapResolvedEndpoint,
  target: JourneyMapResolvedEndpoint,
  bypass: JourneyMapRootOuterBypass,
  stageGates: readonly JourneyMapStageGate[],
  branch: JourneyMapBranchPlan | undefined,
  includeControls: boolean
): PositionedRoute | undefined {
  const departure = branch?.departureControl;
  if (departure) {
    if (source.side !== "east"
      || target.side !== "south"
      || stageGates.length !== 0
      || source.x >= departure.nominalCoordinate
      || departure.nominalCoordinate >= target.x
      || departure.nominalCoordinate - source.x < MIN_ARROW_MARKER_LEG
      || bypass.nominalCoordinate <= source.y
      || bypass.nominalCoordinate <= target.y
      || bypass.nominalCoordinate - target.y < MIN_ARROW_MARKER_LEG) {
      return undefined;
    }
    return {
      style: "orthogonal",
      points: cloneRoutePoints([
        source,
        { x: departure.nominalCoordinate, y: source.y },
        { x: departure.nominalCoordinate, y: bypass.nominalCoordinate },
        ...(includeControls
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
  const [sourceGate, targetGate] = stageGates;
  const isBackwardRootStep = source.x > target.x;
  const sourceBoundaryY = sourceGate?.y ?? source.y;
  const targetBoundaryY = targetGate?.y ?? target.y;
  if (source.side !== "south"
    || target.side !== "south"
    || source.x === target.x
    || (isBackwardRootStep
      ? stageGates.length !== 0
      : sourceGate?.side !== "south" || targetGate?.side !== "south")
    || bypass.nominalCoordinate <= sourceBoundaryY
    || bypass.nominalCoordinate <= targetBoundaryY
    || bypass.nominalCoordinate - source.y < MIN_ARROW_MARKER_LEG
    || bypass.nominalCoordinate - target.y < MIN_ARROW_MARKER_LEG) {
    return undefined;
  }
  const obstaclePoints = source.x < target.x
    ? bypass.obstacleControls.flatMap((control) => [
      { x: control.entryX, y: bypass.nominalCoordinate },
      { x: control.exitX, y: bypass.nominalCoordinate }
    ])
    : [...bypass.obstacleControls].reverse().flatMap((control) => [
      { x: control.exitX, y: bypass.nominalCoordinate },
      { x: control.entryX, y: bypass.nominalCoordinate }
    ]);
  return {
    style: "orthogonal",
    points: cloneRoutePoints([
      source,
      ...(includeControls && sourceGate ? [sourceGate] : []),
      { x: source.x, y: bypass.nominalCoordinate },
      ...(includeControls ? obstaclePoints : []),
      { x: target.x, y: bypass.nominalCoordinate },
      ...(includeControls && targetGate ? [targetGate] : []),
      target
    ])
  };
}

function buildStageLocalBypassRoute(
  source: JourneyMapResolvedEndpoint,
  target: JourneyMapResolvedEndpoint,
  bypass: JourneyMapStageLocalBypass,
  branch: JourneyMapBranchPlan | undefined,
  join: JourneyMapJoinPlan | undefined,
  includeObstacleControls: boolean
): PositionedRoute | undefined {
  const departure = branch?.departureControl;
  if (departure) {
    if (source.side !== "east"
      || target.side !== "south"
      || source.x >= departure.nominalCoordinate
      || departure.nominalCoordinate >= target.x
      || departure.nominalCoordinate - source.x < MIN_ARROW_MARKER_LEG
      || bypass.nominalCoordinate <= source.y
      || bypass.nominalCoordinate <= target.y
      || bypass.nominalCoordinate - target.y < MIN_ARROW_MARKER_LEG) {
      return undefined;
    }
    return {
      style: "orthogonal",
      points: cloneRoutePoints([
        source,
        { x: departure.nominalCoordinate, y: source.y },
        { x: departure.nominalCoordinate, y: bypass.nominalCoordinate },
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
  const arrival = join?.arrivalControl;
  if (arrival) {
    const sourceLeg = bypass.nominalCoordinate - source.y;
    if (source.side !== "south"
      || target.side !== "west"
      || source.x >= arrival.nominalCoordinate
      || arrival.nominalCoordinate >= target.x
      || sourceLeg < MIN_ARROW_MARKER_LEG
      || bypass.nominalCoordinate <= target.y
      || target.x - arrival.nominalCoordinate < MIN_ARROW_MARKER_LEG) {
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
        { x: arrival.nominalCoordinate, y: bypass.nominalCoordinate },
        { x: arrival.nominalCoordinate, y: target.y },
        target
      ])
    };
  }
  const sourceLeg = Math.abs(bypass.nominalCoordinate - source.y);
  const targetLeg = Math.abs(bypass.nominalCoordinate - target.y);
  if (source.side !== "south"
    || target.side !== "south"
    || source.x === target.x
    || bypass.nominalCoordinate <= source.y
    || bypass.nominalCoordinate <= target.y
    || sourceLeg < MIN_ARROW_MARKER_LEG
    || targetLeg < MIN_ARROW_MARKER_LEG) {
    return undefined;
  }
  const obstaclePoints = source.x < target.x
    ? bypass.obstacleControls.flatMap((control) => [
      { x: control.entryX, y: bypass.nominalCoordinate },
      { x: control.exitX, y: bypass.nominalCoordinate }
    ])
    : [...bypass.obstacleControls].reverse().flatMap((control) => [
      { x: control.exitX, y: bypass.nominalCoordinate },
      { x: control.entryX, y: bypass.nominalCoordinate }
    ]);
  return {
    style: "orthogonal",
    points: cloneRoutePoints([
      source,
      { x: source.x, y: bypass.nominalCoordinate },
      ...(includeObstacleControls ? obstaclePoints : []),
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
    archetypeRank: eligibility.archetype === "backward_same_stage"
      || eligibility.archetype === "backward_root_step"
      ? 6
      : eligibility.branch
        ? 4
        : eligibility.join
          ? 5
      : eligibility.archetype === "adjacent_forward_same_stage"
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

function routeContainsVerticesInOrder(
  route: PositionedRoute,
  expectedVertices: readonly Point[]
): boolean {
  let previousIndex = -1;
  for (const expected of expectedVertices) {
    const nextIndex = route.points.findIndex((point, index) =>
      index > previousIndex && point.x === expected.x && point.y === expected.y
    );
    if (nextIndex < 0) {
      return false;
    }
    previousIndex = nextIndex;
  }
  return true;
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
  routeStage: JourneyMapRouteValidationStage = "provisional",
  measuredScene?: MeasuredScene
): RendererDiagnostic[] {
  const diagnostics: RendererDiagnostic[] = [];
  const index = buildJourneyMapPositionedIndex(positionedScene);
  const measuredDegrees = measuredScene ? buildDegreeIndex(measuredScene.edges) : undefined;
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
        : plan.archetype === "adjacent_forward_root_to_contained"
          ? plan.stageGates.length === 1
            && plan.stageGates[0]?.stageId === expectedTargetStageId
            && plan.stageGates[0]?.side === "west"
            && plan.stageGates[0]?.order === 0
            && plan.stageGates[0]?.locked === true
          : plan.archetype === "adjacent_forward_contained_to_root"
            ? plan.stageGates.length === 1
              && plan.stageGates[0]?.stageId === expectedSourceStageId
              && plan.stageGates[0]?.side === "east"
              && plan.stageGates[0]?.order === 0
              && plan.stageGates[0]?.locked === true
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
    const bypassExpected = plan.archetype === "non_adjacent_forward_same_stage"
      || plan.archetype === "backward_same_stage";
    if (bypassExpected) {
      const stage = bypass ? index.stageById.get(bypass.stageId) : undefined;
      const sourceStepOrder = source.metadata.stepOrder;
      const targetStepOrder = target.metadata.stepOrder;
      const expectedStepIds = stage && sourceStepOrder !== undefined && targetStepOrder !== undefined
        ? stage.stepIds.slice(
          Math.min(sourceStepOrder, targetStepOrder),
          Math.max(sourceStepOrder, targetStepOrder) + 1
        )
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
      const expectedDepartureX = plan.branch && expectedObstacleControls[0]
        ? roundMetric((plan.sourceEndpoint.x + expectedObstacleControls[0].entryX) / 2)
        : plan.sourceEndpoint.x;
      const lastExpectedObstacleControl = expectedObstacleControls.at(-1);
      const expectedArrivalX = plan.join && lastExpectedObstacleControl
        ? roundMetric((lastExpectedObstacleControl.exitX + plan.targetEndpoint.x) / 2)
        : plan.targetEndpoint.x;
      const expectedEndpointSpan = {
        start: Math.min(plan.sourceEndpoint.x, plan.targetEndpoint.x),
        end: Math.max(plan.sourceEndpoint.x, plan.targetEndpoint.x)
      };
      const stageBottom = stage ? stage.stage.y + stage.stage.height : Number.NaN;
      const expectedRouteControlPoints = plan.sourceEndpoint.x < plan.targetEndpoint.x
        ? expectedObstacleControls.flatMap((control) => [
          { x: control.entryX, y: bypass?.nominalCoordinate ?? Number.NaN },
          { x: control.exitX, y: bypass?.nominalCoordinate ?? Number.NaN }
        ])
        : [...expectedObstacleControls].reverse().flatMap((control) => [
          { x: control.exitX, y: bypass?.nominalCoordinate ?? Number.NaN },
          { x: control.entryX, y: bypass?.nominalCoordinate ?? Number.NaN }
        ]);
      const routeHasProvisionalControls = routeStage === "step2"
        || routeContainsVerticesInOrder(route, expectedRouteControlPoints);
      const bypassContractMatches = bypass !== undefined
        && stage?.stage.id === expectedSourceStageId
        && expectedSourceStageId === expectedTargetStageId
        && bypass.axis === "horizontal"
        && bypass.nominalCoordinate === roundMetric(maximumStepBottom + MIN_ARROW_MARKER_LEG)
        && bypass.nominalCoordinate < stageBottom
        && bypass.span.start === Math.min(expectedDepartureX, expectedArrivalX)
        && bypass.span.end === Math.max(expectedDepartureX, expectedArrivalX)
        && (plan.branch || plan.join
          ? JSON.stringify(bypass.endpointSpan) === JSON.stringify(expectedEndpointSpan)
          : bypass.endpointSpan === undefined)
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
    const rootBypassExpected = plan.archetype === "long_forward_cross_stage"
      || plan.archetype === "long_forward_root_step"
      || plan.archetype === "backward_root_step";
    if (rootBypassExpected) {
      const maximumRootItemBottom = positionedScene.root.children.length > 0
        ? Math.max(...positionedScene.root.children.map((item) => item.y + item.height))
        : Number.NaN;
      const expectedNominalCoordinate = roundMetric(
        maximumRootItemBottom + MIN_ARROW_MARKER_LEG
      );
      const sourceRootOrder = source.metadata.rootOrder;
      const targetRootOrder = target.metadata.rootOrder;
      const firstRootOrder = Math.min(sourceRootOrder, targetRootOrder);
      const lastRootOrder = Math.max(sourceRootOrder, targetRootOrder);
      const intermediateRootItems = positionedScene.root.children.filter((item) => {
        const rootOrder = rootOrderOf(item);
        return rootOrder !== undefined
          && rootOrder > firstRootOrder
          && rootOrder < lastRootOrder;
      });
      const expectedObstacleControls = intermediateRootItems.map((item) => ({
        rootItemId: item.id,
        entryX: roundMetric(item.x),
        exitX: roundMetric(item.x + item.width)
      }));
      const expectedDepartureX = plan.branch && expectedObstacleControls[0]
        ? roundMetric((plan.sourceEndpoint.x + expectedObstacleControls[0].entryX) / 2)
        : plan.sourceEndpoint.x;
      const expectedEndpointSpan = {
        start: Math.min(plan.sourceEndpoint.x, plan.targetEndpoint.x),
        end: Math.max(plan.sourceEndpoint.x, plan.targetEndpoint.x)
      };
      const expectedRouteControlPoints = plan.sourceEndpoint.x < plan.targetEndpoint.x
        ? expectedObstacleControls.flatMap((control) => [
          { x: control.entryX, y: rootBypass?.nominalCoordinate ?? Number.NaN },
          { x: control.exitX, y: rootBypass?.nominalCoordinate ?? Number.NaN }
        ])
        : [...expectedObstacleControls].reverse().flatMap((control) => [
          { x: control.exitX, y: rootBypass?.nominalCoordinate ?? Number.NaN },
          { x: control.entryX, y: rootBypass?.nominalCoordinate ?? Number.NaN }
        ]);
      const routeHasProvisionalControls = routeStage === "step2"
        || routeContainsVerticesInOrder(route, expectedRouteControlPoints);
      const rootBypassContractMatches = rootBypass !== undefined
        && rootBypass.ownerContainerId === positionedScene.root.id
        && plan.ownerContainerId === positionedScene.root.id
        && rootBypass.axis === "horizontal"
        && rootBypass.nominalCoordinate === expectedNominalCoordinate
        && rootBypass.nominalCoordinate < positionedScene.root.y + positionedScene.root.height
        && rootBypass.span.start === Math.min(expectedDepartureX, plan.targetEndpoint.x)
        && rootBypass.span.end === Math.max(expectedDepartureX, plan.targetEndpoint.x)
        && (plan.branch
          ? JSON.stringify(rootBypass.endpointSpan) === JSON.stringify(expectedEndpointSpan)
          : rootBypass.endpointSpan === undefined)
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

    const branch = plan.branch;
    const join = plan.join;
    const isBackwardArchetype = plan.archetype === "backward_same_stage"
      || plan.archetype === "backward_root_step";
    const topologyModifiersMatch = branch
      ? !join && JSON.stringify(plan.topologyModifiers) === JSON.stringify(["branch"])
      : join
        ? JSON.stringify(plan.topologyModifiers) === JSON.stringify(["join"])
        : plan.topologyModifiers === undefined;
    const branchBypass = plan.stageLocalBypass ?? plan.rootOuterBypass;
    const firstBranchObstacle = plan.stageLocalBypass?.obstacleControls[0]
      ? {
        obstacleItemId: plan.stageLocalBypass.obstacleControls[0].stepId,
        obstacleBoundaryCoordinate: plan.stageLocalBypass.obstacleControls[0].entryX
      }
      : plan.rootOuterBypass?.obstacleControls[0]
        ? {
          obstacleItemId: plan.rootOuterBypass.obstacleControls[0].rootItemId,
          obstacleBoundaryCoordinate: plan.rootOuterBypass.obstacleControls[0].entryX
        }
        : undefined;
    const expectedDepartureControl = !isBackwardArchetype && branchBypass && firstBranchObstacle
      ? {
        axis: "vertical" as const,
        nominalCoordinate: roundMetric(
          (plan.sourceEndpoint.x + firstBranchObstacle.obstacleBoundaryCoordinate) / 2
        ),
        span: {
          start: roundMetric(Math.min(plan.sourceEndpoint.y, branchBypass.nominalCoordinate)),
          end: roundMetric(Math.max(plan.sourceEndpoint.y, branchBypass.nominalCoordinate))
        },
        ...firstBranchObstacle,
        order: 0 as const,
        locked: false as const
      }
      : undefined;
    const authoredOutgoingEdgeIds = measuredDegrees?.outgoingEdgeIdsByNodeId.get(plan.from);
    const expectedSourceOrdinal = authoredOutgoingEdgeIds?.indexOf(plan.id);
    const branchDegreeContractMatches = branch
      ? measuredDegrees
        ? authoredOutgoingEdgeIds !== undefined
          && authoredOutgoingEdgeIds.length > 1
          && branch.sourceOutdegree === authoredOutgoingEdgeIds.length
          && expectedSourceOrdinal !== undefined
          && expectedSourceOrdinal >= 0
          && branch.sourceOrdinal === expectedSourceOrdinal
        : branch.sourceOutdegree > 1
          && branch.sourceOrdinal >= 0
          && branch.sourceOrdinal < branch.sourceOutdegree
      : true;
    const branchContractMatches = branch
      ? topologyModifiersMatch
        && branchDegreeContractMatches
        && plan.priority.archetypeRank === (isBackwardArchetype ? 6 : 4)
        && JSON.stringify(branch.departureControl) === JSON.stringify(expectedDepartureControl)
        && plan.sourceEndpoint.side === (isBackwardArchetype ? "south" : "east")
      : plan.priority.archetypeRank !== 4;
    if (!branchContractMatches) {
      diagnostics.push(createRoutingDiagnostic(
        "renderer.routing.journey_map_archetype_fallback",
        `Journey edge "${plan.id}" does not expose its accepted branch topology contract.`,
        plan.id,
        "warn",
        JSON.stringify({ relatedIds: [plan.id, plan.from] })
      ));
    }

    const joinBypass = plan.stageLocalBypass;
    const lastJoinObstacle = joinBypass?.obstacleControls.at(-1);
    const expectedArrivalControl = joinBypass && lastJoinObstacle
      ? {
        axis: "vertical" as const,
        nominalCoordinate: roundMetric((lastJoinObstacle.exitX + plan.targetEndpoint.x) / 2),
        span: {
          start: roundMetric(Math.min(plan.targetEndpoint.y, joinBypass.nominalCoordinate)),
          end: roundMetric(Math.max(plan.targetEndpoint.y, joinBypass.nominalCoordinate))
        },
        obstacleItemId: lastJoinObstacle.stepId,
        obstacleBoundaryCoordinate: lastJoinObstacle.exitX,
        order: 0 as const,
        locked: false as const
      }
      : undefined;
    const authoredIncomingEdgeIds = measuredDegrees?.incomingEdgeIdsByNodeId.get(plan.to);
    const authoredJoinSourceEdgeIds = measuredDegrees?.outgoingEdgeIdsByNodeId.get(plan.from);
    const expectedTargetOrdinal = authoredIncomingEdgeIds?.indexOf(plan.id);
    const joinDegreeContractMatches = join
      ? measuredDegrees
        ? authoredIncomingEdgeIds !== undefined
          && authoredIncomingEdgeIds.length > 1
          && authoredJoinSourceEdgeIds !== undefined
          && authoredJoinSourceEdgeIds.length === 1
          && authoredJoinSourceEdgeIds[0] === plan.id
          && join.targetIndegree === authoredIncomingEdgeIds.length
          && expectedTargetOrdinal !== undefined
          && expectedTargetOrdinal >= 0
          && join.targetOrdinal === expectedTargetOrdinal
        : join.targetIndegree > 1
          && join.targetOrdinal >= 0
          && join.targetOrdinal < join.targetIndegree
      : true;
    const joinContractMatches = join
      ? topologyModifiersMatch
        && joinDegreeContractMatches
        && plan.priority.archetypeRank === 5
        && JSON.stringify(join.arrivalControl) === JSON.stringify(expectedArrivalControl)
        && plan.targetEndpoint.side === "west"
      : plan.priority.archetypeRank !== 5
        && (branch || plan.topologyModifiers === undefined);
    if (!joinContractMatches) {
      diagnostics.push(createRoutingDiagnostic(
        "renderer.routing.journey_map_archetype_fallback",
        `Journey edge "${plan.id}" does not expose its accepted join topology contract.`,
        plan.id,
        "warn",
        JSON.stringify({ relatedIds: [plan.id, plan.to] })
      ));
    }

    const sourceOutgoingIds = measuredDegrees?.outgoingEdgeIdsByNodeId.get(plan.from);
    const targetIncomingIds = measuredDegrees?.incomingEdgeIdsByNodeId.get(plan.to);
    const backwardDegreeContractMatches = measuredDegrees
      ? sourceOutgoingIds?.includes(plan.id) === true
        && targetIncomingIds?.includes(plan.id) === true
        && (branch
          ? sourceOutgoingIds.length > 1
          : sourceOutgoingIds.length === 1 && targetIncomingIds.length === 1)
        && (measuredDegrees.sameEndpointCountByKey.get(`${plan.from}\u0000${plan.to}`) ?? 0) === 1
        && !hasPath(plan.to, plan.from, measuredDegrees.outgoingTargetsByNodeId)
      : true;
    const backwardOrderContractMatches = plan.archetype === "backward_same_stage"
      ? source.metadata.stageId !== undefined
        && source.metadata.stageId === target.metadata.stageId
        && source.metadata.stepOrder !== undefined
        && target.metadata.stepOrder !== undefined
        && target.metadata.stepOrder < source.metadata.stepOrder
      : plan.archetype === "backward_root_step"
        ? source.metadata.stageId === undefined
          && target.metadata.stageId === undefined
          && target.metadata.rootOrder < source.metadata.rootOrder
        : true;
    const backwardContractMatches = isBackwardArchetype
      ? plan.priority.archetypeRank === 6
        && plan.sourceEndpoint.side === "south"
        && plan.targetEndpoint.side === "south"
        && plan.stageGates.length === 0
        && join === undefined
        && backwardDegreeContractMatches
        && backwardOrderContractMatches
      : plan.priority.archetypeRank !== 6;
    if (!backwardContractMatches) {
      diagnostics.push(createRoutingDiagnostic(
        "renderer.routing.journey_map_archetype_fallback",
        `Journey edge "${plan.id}" does not expose its accepted backward topology contract.`,
        plan.id,
        "warn",
        JSON.stringify({ relatedIds: [plan.id, plan.from, plan.to] })
      ));
    }
  }
  return sortRendererDiagnostics(diagnostics);
}

export function validateJourneyMapBasicRoutes(
  plans: readonly JourneyMapConnectorPlan[],
  positionedScene: PositionedScene,
  routeStage: "step2" | "final_basic" = "final_basic",
  measuredScene?: MeasuredScene
): RendererDiagnostic[] {
  return validateJourneyMapRoutes(plans, positionedScene, routeStage, measuredScene);
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
    const isBackward = eligibility.archetype === "backward_same_stage"
      || eligibility.archetype === "backward_root_step";
    const usesStageLocalBypass = eligibility.archetype === "non_adjacent_forward_same_stage"
      || eligibility.archetype === "backward_same_stage";
    const usesRootOuterBypass = eligibility.archetype === "long_forward_cross_stage"
      || eligibility.archetype === "long_forward_root_step"
      || eligibility.archetype === "backward_root_step";
    const sourceUsesSouthEndpoint = isBackward || (!eligibility.branch
      && (usesStageLocalBypass || usesRootOuterBypass));
    const targetUsesSouthEndpoint = isBackward || (!eligibility.join
      && (usesStageLocalBypass || usesRootOuterBypass));
    const sourceEndpoint = resolveEndpoint(
      edge,
      eligibility.source,
      "source",
      sourceUsesSouthEndpoint ? "journey_escape_out" : edge.routing.sourcePortRole,
      sourceUsesSouthEndpoint ? "south" : "east",
      diagnostics
    );
    const targetEndpoint = resolveEndpoint(
      edge,
      eligibility.target,
      "target",
      targetUsesSouthEndpoint ? "journey_escape_in" : edge.routing.targetPortRole,
      targetUsesSouthEndpoint ? "south" : "west",
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
    const branch = buildBranchPlan(
      eligibility,
      sourceEndpoint,
      stageLocalBypass,
      rootOuterBypass
    );
    const join = buildJoinPlan(eligibility, targetEndpoint, stageLocalBypass);
    const basicArchetype = isBasicRouteArchetype(eligibility.archetype)
      ? eligibility.archetype
      : undefined;
    const step2Route = usesStageLocalBypass && stageLocalBypass
      ? buildStageLocalBypassRoute(
        sourceEndpoint,
        targetEndpoint,
        stageLocalBypass,
        branch,
        join,
        false
      )
      : usesRootOuterBypass && rootOuterBypass
        ? buildRootOuterBypassRoute(
          sourceEndpoint,
          targetEndpoint,
          rootOuterBypass,
          stageGates,
          branch,
          false
        )
        : eligibility.archetype === "adjacent_forward_root_step"
          ? buildAdjacentRootStepRoute(sourceEndpoint, targetEndpoint)
          : eligibility.archetype === "adjacent_forward_root_to_contained"
            || eligibility.archetype === "adjacent_forward_contained_to_root"
            ? buildSingleStageBoundaryRoute(
              eligibility.archetype,
              sourceEndpoint,
              targetEndpoint,
              stageGates,
              false
            )
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
      ? buildStageLocalBypassRoute(
        sourceEndpoint,
        targetEndpoint,
        stageLocalBypass,
        branch,
        join,
        true
      )
      : usesRootOuterBypass && rootOuterBypass
        ? buildRootOuterBypassRoute(
          sourceEndpoint,
          targetEndpoint,
          rootOuterBypass,
          stageGates,
          branch,
          true
        )
        : eligibility.archetype === "adjacent_forward_root_step"
          ? buildAdjacentRootStepRoute(sourceEndpoint, targetEndpoint)
          : eligibility.archetype === "adjacent_forward_root_to_contained"
            || eligibility.archetype === "adjacent_forward_contained_to_root"
            ? buildSingleStageBoundaryRoute(
              eligibility.archetype,
              sourceEndpoint,
              targetEndpoint,
              stageGates,
              true
            )
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
      ...(branch ? { topologyModifiers: ["branch"] as ["branch"], branch } : {}),
      ...(join ? { topologyModifiers: ["join"] as ["join"], join } : {}),
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
    "step2",
    measuredScene
  );
  const finalBasicValidationDiagnostics = validateJourneyMapBasicRoutes(
    connectorPlans,
    preRoutingPositionedScene,
    "final_basic",
    measuredScene
  );
  const provisionalValidationDiagnostics = validateJourneyMapRoutes(
    connectorPlans,
    preRoutingPositionedScene,
    "provisional",
    measuredScene
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
