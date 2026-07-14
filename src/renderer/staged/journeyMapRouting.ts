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
import { collapseRoutePoints, MIN_ARROW_MARKER_LEG, resolvePortOnItem } from "./routing.js";

export const JOURNEY_MAP_TRACK_SEPARATION = 16;
export const MAX_JOURNEY_MAP_EXPANSION_ATTEMPTS = 4;

export type JourneyMapRouteArchetype =
  | "adjacent_forward_same_stage"
  | "adjacent_forward_cross_stage"
  | "non_adjacent_forward_same_stage"
  | "long_forward_cross_stage"
  | "adjacent_forward_root_step"
  | "adjacent_forward_root_to_contained"
  | "long_forward_root_step"
  | "adjacent_forward_contained_to_root"
  | "forward_contained_to_root_bypass"
  | "forward_root_to_contained_bypass"
  | "backward_same_stage"
  | "backward_root_step"
  | "cycle_forward_same_stage"
  | "cycle_return_same_stage"
  | "cycle_return_cross_stage"
  | "self_loop";

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
  boundaryRole?: "egress" | "ingress";
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
  boundaryTransition?: {
    axis: "vertical";
    nominalCoordinate: number;
    span: {
      start: number;
      end: number;
    };
    stageBoundaryCoordinate: number;
    obstacleItemId: string;
    obstacleBoundaryCoordinate: number;
    order: 0;
    locked: false;
  };
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

export type JourneyMapCycleComponentKind = "simple_reciprocal" | "complex";
export type JourneyMapCycleComponentRole = "ordinary" | "forward" | "return";

export interface JourneyMapCycleComponentMetadata {
  componentId: string;
  componentOrdinal: number;
  componentKind: JourneyMapCycleComponentKind;
  componentNodeIds: string[];
  componentEdgeIds: string[];
  edgeOrdinal: number;
  role: JourneyMapCycleComponentRole;
}

export interface JourneyMapSelfLoopControl {
  axis: "vertical";
  nominalCoordinate: number;
  span: {
    start: number;
    end: number;
  };
  order: 0;
  locked: false;
}

export interface JourneyMapSelfLoopTrack {
  nodeId: string;
  loopSide: "north";
  axis: "horizontal";
  nominalCoordinate: number;
  span: {
    start: number;
    end: number;
  };
  sourceControl: JourneyMapSelfLoopControl;
  targetControl: JourneyMapSelfLoopControl;
  order: 0;
  locked: false;
}

export interface JourneyMapDuplicateFanControl {
  axis: "vertical";
  nominalCoordinate: number;
  span: {
    start: number;
    end: number;
  };
  segmentIndex: 1 | 3;
  order: 0;
  locked: false;
}

export interface JourneyMapDuplicateFan {
  policy: "distinct_nominal_fan";
  groupEdgeIds: string[];
  groupSize: number;
  groupOrdinal: number;
  laneIndex: number;
  axis: "horizontal";
  nominalCoordinate: number;
  span: {
    start: number;
    end: number;
  };
  segmentIndex: 0 | 2;
  sourceControl?: JourneyMapDuplicateFanControl;
  targetControl?: JourneyMapDuplicateFanControl;
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

export type JourneyMapOccupancyAxis = "horizontal" | "vertical";
export type JourneyMapEndpointRole = "source" | "target";

export type JourneyMapOccupancyResource =
  | {
    kind: "node_side";
    nodeId: string;
    side: PortSide;
    endpointRole: JourneyMapEndpointRole;
  }
  | {
    kind: "adjacent_step_gap";
    fromItemId: string;
    toItemId: string;
  }
  | {
    kind: "stage_local_bypass";
    stageId: string;
  }
  | {
    kind: "inter_root_item_gutter";
    beforeRootItemId?: string;
    afterRootItemId?: string;
  }
  | {
    kind: "root_outer_bypass";
    rootId: string;
  }
  | {
    kind: "stage_boundary_gate";
    stageId: string;
    side: PortSide;
    order: number;
  }
  | {
    kind: "obstacle_swerve";
    obstacleItemId: string;
    side: PortSide;
  }
  | {
    kind: "departure_stem";
    nodeId: string;
    side: PortSide;
  }
  | {
    kind: "arrival_stem";
    nodeId: string;
    side: PortSide;
  };

export type JourneyMapOccupancyLock =
  | { kind: "none" }
  | {
    kind: "endpoint_normal";
    itemId: string;
    portId: string;
    side: PortSide;
    normalCoordinate: number;
  }
  | {
    kind: "boundary_normal";
    stageId: string;
    side: PortSide;
    order: number;
    normalCoordinate: number;
  }
  | {
    kind: "exact";
    reason: string;
  };

export interface JourneyMapOccupancyRecord {
  connectorId: string;
  resource: JourneyMapOccupancyResource;
  resourceKey: string;
  ownerContainerId: string;
  axis: JourneyMapOccupancyAxis;
  nominalCoordinate: number;
  resolvedCoordinate: number;
  span: {
    start: number;
    end: number;
  };
  routeSegmentIndex: number;
  segmentRunIndex: number;
  archetype: JourneyMapRouteArchetype;
  priority: JourneyMapRoutePriority;
  lock: JourneyMapOccupancyLock;
}

export interface JourneyMapResolvedSegmentCoordinate {
  segmentRunIndex: number;
  axis: JourneyMapOccupancyAxis;
  nominalCoordinate: number;
  resolvedCoordinate: number;
}

export interface JourneyMapResolvedConnectorState {
  connectorId: string;
  sourceEndpoint: JourneyMapResolvedEndpoint;
  targetEndpoint: JourneyMapResolvedEndpoint;
  stageGates: JourneyMapStageGate[];
  segmentCoordinates: JourneyMapResolvedSegmentCoordinate[];
  preparedRoute: PositionedRoute;
  finalRoute: PositionedRoute;
}

export type JourneyMapExpansionRequest =
  | { kind: "stage_step_gap"; stageId: string; afterStepOrder: number; amount: number }
  | { kind: "root_item_gap"; afterRootOrder: number; amount: number }
  | { kind: "stage_bypass_gutter"; stageId: string; amount: number }
  | { kind: "root_outer_gutter"; ownerContainerId: string; amount: number };

export interface JourneyMapExpansionAttempt {
  attempt: number;
  requests: JourneyMapExpansionRequest[];
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
  selfLoopTrack?: JourneyMapSelfLoopTrack;
  duplicateFan?: JourneyMapDuplicateFan;
  cycleComponent?: JourneyMapCycleComponentMetadata;
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
  cycleComponent?: JourneyMapCycleComponentMetadata;
}

export interface JourneyMapRoutingStages {
  connectorPlans: JourneyMapConnectorPlan[];
  deferredConnectors: JourneyMapDeferredConnector[];
  failedConnectorIds: string[];
  nodeEdgeBuckets: JourneyMapNodeEdgeBuckets[];
  nominalOccupancy: JourneyMapOccupancyRecord[];
  occupancy: JourneyMapOccupancyRecord[];
  resolvedConnectors: JourneyMapResolvedConnectorState[];
  expansionAttempts: JourneyMapExpansionAttempt[];
  step2PositionedScene: PositionedScene;
  provisionalPositionedScene: PositionedScene;
  finalBasicPositionedScene: PositionedScene;
  step3PositionedScene: PositionedScene;
  finalPositionedScene: PositionedScene;
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
  sameEndpointEdgesByKey: Map<string, MeasuredEdge[]>;
  outgoingTargetsByNodeId: Map<string, string[]>;
  outgoingEdgeIdsByNodeId: Map<string, string[]>;
  incomingEdgeIdsByNodeId: Map<string, string[]>;
}

interface JourneyMapCycleIndex {
  componentByEdgeId: Map<string, JourneyMapCycleComponentMetadata>;
  ordinaryEdges: MeasuredEdge[];
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
  duplicate?: {
    groupEdgeIds: string[];
    groupSize: number;
    groupOrdinal: number;
    laneIndex: number;
  };
  cycleComponent?: JourneyMapCycleComponentMetadata;
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
  const sameEndpointEdgesByKey = new Map<string, MeasuredEdge[]>();
  const outgoingTargetsByNodeId = new Map<string, string[]>();
  const outgoingEdgesByNodeId = new Map<string, MeasuredEdge[]>();
  const incomingEdgesByNodeId = new Map<string, MeasuredEdge[]>();
  for (const edge of edges) {
    outgoingByNodeId.set(edge.from.itemId, (outgoingByNodeId.get(edge.from.itemId) ?? 0) + 1);
    incomingByNodeId.set(edge.to.itemId, (incomingByNodeId.get(edge.to.itemId) ?? 0) + 1);
    const endpointKey = `${edge.from.itemId}\u0000${edge.to.itemId}`;
    sameEndpointCountByKey.set(endpointKey, (sameEndpointCountByKey.get(endpointKey) ?? 0) + 1);
    const sameEndpointEdges = sameEndpointEdgesByKey.get(endpointKey) ?? [];
    sameEndpointEdges.push(edge);
    sameEndpointEdgesByKey.set(endpointKey, sameEndpointEdges);
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
  for (const [endpointKey, sameEndpointEdges] of sameEndpointEdgesByKey) {
    sameEndpointEdgesByKey.set(
      endpointKey,
      [...sameEndpointEdges].sort(compareMeasuredEdgesByAuthoredOrder)
    );
  }
  return {
    incomingByNodeId,
    outgoingByNodeId,
    sameEndpointCountByKey,
    sameEndpointEdgesByKey,
    outgoingTargetsByNodeId,
    outgoingEdgeIdsByNodeId,
    incomingEdgeIdsByNodeId
  };
}

function canonicalCycleComponentId(nodeIds: readonly string[]): string {
  return `journey-cycle:${nodeIds.map((nodeId) => `${nodeId.length}:${nodeId}`).join("|")}`;
}

function buildJourneyMapCycleIndex(
  edges: readonly MeasuredEdge[],
  index: JourneyMapPositionedIndex
): JourneyMapCycleIndex {
  const visualOrderByNodeId = new Map(
    index.allNodes.map((node) => [node.node.id, node.metadata.globalStepOrder])
  );
  const compareNodeIds = (left: string, right: string): number =>
    (visualOrderByNodeId.get(left) ?? Number.MAX_SAFE_INTEGER)
      - (visualOrderByNodeId.get(right) ?? Number.MAX_SAFE_INTEGER)
    || left.localeCompare(right);
  const adjacency = new Map(index.allNodes.map((node) => [node.node.id, new Set<string>()]));
  for (const edge of edges) {
    if (edge.from.itemId !== edge.to.itemId
      && adjacency.has(edge.from.itemId)
      && adjacency.has(edge.to.itemId)) {
      adjacency.get(edge.from.itemId)!.add(edge.to.itemId);
    }
  }

  let nextSearchIndex = 0;
  const searchIndexByNodeId = new Map<string, number>();
  const lowLinkByNodeId = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const components: string[][] = [];
  const visit = (nodeId: string): void => {
    const searchIndex = nextSearchIndex;
    nextSearchIndex += 1;
    searchIndexByNodeId.set(nodeId, searchIndex);
    lowLinkByNodeId.set(nodeId, searchIndex);
    stack.push(nodeId);
    onStack.add(nodeId);

    for (const targetId of [...(adjacency.get(nodeId) ?? [])].sort(compareNodeIds)) {
      if (!searchIndexByNodeId.has(targetId)) {
        visit(targetId);
        lowLinkByNodeId.set(
          nodeId,
          Math.min(lowLinkByNodeId.get(nodeId)!, lowLinkByNodeId.get(targetId)!)
        );
      } else if (onStack.has(targetId)) {
        lowLinkByNodeId.set(
          nodeId,
          Math.min(lowLinkByNodeId.get(nodeId)!, searchIndexByNodeId.get(targetId)!)
        );
      }
    }

    if (lowLinkByNodeId.get(nodeId) !== searchIndexByNodeId.get(nodeId)) {
      return;
    }
    const component: string[] = [];
    while (stack.length > 0) {
      const memberId = stack.pop()!;
      onStack.delete(memberId);
      component.push(memberId);
      if (memberId === nodeId) {
        break;
      }
    }
    if (component.length > 1) {
      components.push(component.sort(compareNodeIds));
    }
  };

  for (const node of index.allNodes) {
    if (!searchIndexByNodeId.has(node.node.id)) {
      visit(node.node.id);
    }
  }
  components.sort((left, right) => compareNodeIds(left[0]!, right[0]!)
    || canonicalCycleComponentId(left).localeCompare(canonicalCycleComponentId(right)));

  const componentByEdgeId = new Map<string, JourneyMapCycleComponentMetadata>();
  const cycleSpecificEdgeIds = new Set<string>();
  components.forEach((componentNodeIds, componentOrdinal) => {
    const memberIds = new Set(componentNodeIds);
    const internalEdges = edges
      .filter((edge) => memberIds.has(edge.from.itemId) && memberIds.has(edge.to.itemId))
      .sort(compareMeasuredEdgesByAuthoredOrder);
    const nonSelfEdges = internalEdges.filter((edge) => edge.from.itemId !== edge.to.itemId);
    const endpointPairs = new Set(
      nonSelfEdges.map((edge) => `${edge.from.itemId}\u0000${edge.to.itemId}`)
    );
    const componentKind: JourneyMapCycleComponentKind = componentNodeIds.length === 2
      && nonSelfEdges.length === 2
      && endpointPairs.size === 2
      && nonSelfEdges[0]?.from.itemId === nonSelfEdges[1]?.to.itemId
      && nonSelfEdges[0]?.to.itemId === nonSelfEdges[1]?.from.itemId
      ? "simple_reciprocal"
      : "complex";
    const componentId = canonicalCycleComponentId(componentNodeIds);
    const componentEdgeIds = internalEdges.map((edge) => edge.id);
    internalEdges.forEach((edge, edgeOrdinal) => {
      const sourceOrder = visualOrderByNodeId.get(edge.from.itemId) ?? Number.MAX_SAFE_INTEGER;
      const targetOrder = visualOrderByNodeId.get(edge.to.itemId) ?? Number.MAX_SAFE_INTEGER;
      const role: JourneyMapCycleComponentRole = edge.from.itemId === edge.to.itemId
        ? "ordinary"
        : componentKind === "simple_reciprocal"
          ? sourceOrder < targetOrder ? "forward" : "return"
          : sourceOrder < targetOrder ? "ordinary" : "return";
      if (role === "forward" || role === "return") {
        cycleSpecificEdgeIds.add(edge.id);
      }
      componentByEdgeId.set(edge.id, {
        componentId,
        componentOrdinal,
        componentKind,
        componentNodeIds: [...componentNodeIds],
        componentEdgeIds: [...componentEdgeIds],
        edgeOrdinal,
        role
      });
    });
  });

  return {
    componentByEdgeId,
    ordinaryEdges: edges.filter((edge) => !cycleSpecificEdgeIds.has(edge.id))
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

export function journeyMapDuplicateLaneIndex(groupOrdinal: number): number {
  if (groupOrdinal === 0) {
    return 0;
  }
  const magnitude = Math.ceil(groupOrdinal / 2);
  return groupOrdinal % 2 === 1 ? -magnitude : magnitude;
}

function resolveRouteEligibility(
  edge: MeasuredEdge,
  index: JourneyMapPositionedIndex,
  fullDegrees: JourneyDegreeIndex,
  ordinaryDegrees: JourneyDegreeIndex,
  cycleComponent: JourneyMapCycleComponentMetadata | undefined
): RouteEligibility | undefined {
  const source = index.nodeById.get(edge.from.itemId);
  const target = index.nodeById.get(edge.to.itemId);
  if (!source || !target) {
    return undefined;
  }
  const endpointKey = `${source.node.id}\u0000${target.node.id}`;
  const sameEndpointCount = fullDegrees.sameEndpointCountByKey.get(endpointKey) ?? 0;
  if (sameEndpointCount < 1) {
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
  const sourceStepOrder = source.metadata.stepOrder;
  const targetStepOrder = target.metadata.stepOrder;
  if (sameEndpointCount > 1) {
    const metadata = edge.viewMetadata?.journeyMap;
    const groupEdges = fullDegrees.sameEndpointEdgesByKey.get(endpointKey) ?? [];
    const groupEdgeIds = groupEdges.map((member) => member.id);
    const sourceOutgoingIds = fullDegrees.outgoingEdgeIdsByNodeId.get(source.node.id) ?? [];
    const targetIncomingIds = fullDegrees.incomingEdgeIdsByNodeId.get(target.node.id) ?? [];
    const groupHasValidOrdinals = groupEdges.every((member, groupOrdinal) => {
      const memberMetadata = member.viewMetadata?.journeyMap;
      return memberMetadata !== undefined
        && Number.isInteger(memberMetadata.authorOrder)
        && memberMetadata.authorOrder >= 0
        && (groupOrdinal === 0
          || memberMetadata.authorOrder
            > groupEdges[groupOrdinal - 1]!.viewMetadata!.journeyMap!.authorOrder)
        && Number.isInteger(memberMetadata.sameEndpointOrdinal)
        && memberMetadata.sameEndpointOrdinal === groupOrdinal
        && Number.isInteger(memberMetadata.exactIdentityOrdinal)
        && memberMetadata.exactIdentityOrdinal >= 0;
    });
    const groupOrdinal = metadata?.sameEndpointOrdinal ?? -1;
    if (source.node.id !== target.node.id
      && !sourceStage
      && !targetStage
      && target.metadata.rootOrder === source.metadata.rootOrder + 1
      && cycleComponent === undefined
      && !hasPath(target.node.id, source.node.id, fullDegrees.outgoingTargetsByNodeId)
      && metadata !== undefined
      && groupEdges.length === sameEndpointCount
      && groupEdges.length > 1
      && new Set(groupEdgeIds).size === groupEdgeIds.length
      && JSON.stringify(sourceOutgoingIds) === JSON.stringify(groupEdgeIds)
      && JSON.stringify(targetIncomingIds) === JSON.stringify(groupEdgeIds)
      && groupHasValidOrdinals
      && groupOrdinal >= 0
      && groupEdges[groupOrdinal]?.id === edge.id) {
      return {
        archetype: "adjacent_forward_root_step",
        source,
        target,
        sourceStepOrder: 0,
        targetStepOrder: 0,
        duplicate: {
          groupEdgeIds,
          groupSize: groupEdges.length,
          groupOrdinal,
          laneIndex: journeyMapDuplicateLaneIndex(groupOrdinal)
        }
      };
    }
    return undefined;
  }
  if (source.node.id === target.node.id) {
    if (sourceStage
      && targetStage
      && sourceStage.stage.id === targetStage.stage.id
      && sourceStepOrder !== undefined
      && targetStepOrder !== undefined) {
      return {
        archetype: "self_loop",
        source,
        target,
        sourceStage,
        targetStage,
        sourceStepOrder,
        targetStepOrder
      };
    }
    return undefined;
  }
  const cycleRole = cycleComponent?.role;
  const isSimpleCycle = cycleComponent?.componentKind === "simple_reciprocal"
    && (cycleRole === "forward" || cycleRole === "return");
  const isComplexCycleReturn = cycleComponent?.componentKind === "complex"
    && cycleRole === "return";
  if (isSimpleCycle || isComplexCycleReturn) {
    if (sourceStage
      && targetStage
      && sourceStage.stage.id === targetStage.stage.id
      && sourceStepOrder !== undefined
      && targetStepOrder !== undefined) {
      return {
        archetype: cycleRole === "forward"
          ? "cycle_forward_same_stage"
          : "cycle_return_same_stage",
        source,
        target,
        sourceStage,
        targetStage,
        sourceStepOrder,
        targetStepOrder,
        cycleComponent
      };
    }
    if (isComplexCycleReturn
      && sourceStage
      && targetStage
      && sourceStage.stage.id !== targetStage.stage.id
      && sourceStepOrder !== undefined
      && targetStepOrder !== undefined) {
      return {
        archetype: "cycle_return_cross_stage",
        source,
        target,
        sourceStage,
        targetStage,
        sourceStepOrder,
        targetStepOrder,
        cycleComponent
      };
    }
    return undefined;
  }
  if (!cycleComponent
    && hasPath(target.node.id, source.node.id, fullDegrees.outgoingTargetsByNodeId)) {
    return undefined;
  }
  const routeDegrees = cycleComponent?.componentKind === "complex"
    && cycleComponent.role === "ordinary"
    ? ordinaryDegrees
    : fullDegrees;
  const sourceOutdegree = routeDegrees.outgoingByNodeId.get(source.node.id) ?? 0;
  const targetIndegree = routeDegrees.incomingByNodeId.get(target.node.id) ?? 0;
  const isBranch = sourceOutdegree > 1;
  const sourceOrdinal = isBranch
    ? (routeDegrees.outgoingEdgeIdsByNodeId.get(source.node.id) ?? []).indexOf(edge.id)
    : -1;
  if (isBranch && sourceOrdinal < 0) {
    return undefined;
  }
  const branch = isBranch ? { sourceOutdegree, sourceOrdinal } : undefined;
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
      ...(branch ? { branch } : {}),
      ...(cycleComponent ? { cycleComponent } : {})
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
      ...(cycleComponent ? { cycleComponent } : {})
    };
  }

  const isJoin = !isBranch && sourceOutdegree === 1 && targetIndegree > 1;
  if (!isBranch && !isJoin && (sourceOutdegree !== 1 || targetIndegree !== 1)) {
    return undefined;
  }
  const targetOrdinal = isJoin
    ? (routeDegrees.incomingEdgeIdsByNodeId.get(target.node.id) ?? []).indexOf(edge.id)
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
      ...(branch ? { branch } : {}),
      ...(cycleComponent ? { cycleComponent } : {})
    };
  }
  if (!sourceStage || !targetStage) {
    if (!branch || target.metadata.rootOrder <= source.metadata.rootOrder) {
      return undefined;
    }
    if (!sourceStage && targetStage) {
      const targetStepOrder = target.metadata.stepOrder;
      if (targetStage.metadata.rootOrder !== source.metadata.rootOrder + 1
        || targetStepOrder === undefined) {
        return undefined;
      }
      return {
        archetype: targetStepOrder === 0
          ? "adjacent_forward_root_to_contained"
          : "forward_root_to_contained_bypass",
        source,
        target,
        targetStage,
        sourceStepOrder: 0,
        targetStepOrder,
        branch,
        ...(cycleComponent ? { cycleComponent } : {})
      };
    }
    if (sourceStage && !targetStage) {
      const sourceStepOrder = source.metadata.stepOrder;
      if (target.metadata.rootOrder !== sourceStage.metadata.rootOrder + 1
        || sourceStepOrder === undefined) {
        return undefined;
      }
      return {
        archetype: sourceStepOrder === sourceStage.stepIds.length - 1
          ? "adjacent_forward_contained_to_root"
          : "forward_contained_to_root_bypass",
        source,
        target,
        sourceStage,
        sourceStepOrder,
        targetStepOrder: 0,
        branch,
        ...(cycleComponent ? { cycleComponent } : {})
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
      ...(join ? { join } : {}),
      ...(cycleComponent ? { cycleComponent } : {})
    };
  }

  if (targetStage.metadata.rootOrder <= sourceStage.metadata.rootOrder) {
    return undefined;
  }
  const isAdjacentDirectBridge = targetStage.metadata.rootOrder === sourceStage.metadata.rootOrder + 1
    && sourceStepOrder === sourceStage.stepIds.length - 1
    && targetStepOrder === 0;
  if (branch && !isAdjacentDirectBridge
    && cycleComponent?.componentKind !== "complex") {
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
    ...(branch ? { branch } : {}),
    ...(cycleComponent ? { cycleComponent } : {})
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

interface PreparedDuplicateFanRoute {
  source: JourneyMapResolvedEndpoint;
  target: JourneyMapResolvedEndpoint;
  route: PositionedRoute;
}

function duplicatePairHasOnlyTerminalStubs(
  left: PositionedRoute,
  right: PositionedRoute,
  source: JourneyMapResolvedEndpoint,
  target: JourneyMapResolvedEndpoint
): boolean {
  const overlaps: Array<{
    axis: "horizontal" | "vertical";
    coordinate: number;
    start: number;
    end: number;
  }> = [];
  for (const leftSegment of routeSegments(left)) {
    for (const rightSegment of routeSegments(right)) {
      const leftHorizontal = leftSegment.start.y === leftSegment.end.y;
      const rightHorizontal = rightSegment.start.y === rightSegment.end.y;
      if (leftHorizontal && rightHorizontal && leftSegment.start.y === rightSegment.start.y) {
        const start = Math.max(
          Math.min(leftSegment.start.x, leftSegment.end.x),
          Math.min(rightSegment.start.x, rightSegment.end.x)
        );
        const end = Math.min(
          Math.max(leftSegment.start.x, leftSegment.end.x),
          Math.max(rightSegment.start.x, rightSegment.end.x)
        );
        if (end > start) {
          overlaps.push({
            axis: "horizontal",
            coordinate: leftSegment.start.y,
            start,
            end
          });
        }
      } else if (!leftHorizontal && !rightHorizontal
        && leftSegment.start.x === rightSegment.start.x) {
        const start = Math.max(
          Math.min(leftSegment.start.y, leftSegment.end.y),
          Math.min(rightSegment.start.y, rightSegment.end.y)
        );
        const end = Math.min(
          Math.max(leftSegment.start.y, leftSegment.end.y),
          Math.max(rightSegment.start.y, rightSegment.end.y)
        );
        if (end > start) {
          overlaps.push({
            axis: "vertical",
            coordinate: leftSegment.start.x,
            start,
            end
          });
        }
      } else if (leftHorizontal !== rightHorizontal) {
        const horizontal = leftHorizontal ? leftSegment : rightSegment;
        const vertical = leftHorizontal ? rightSegment : leftSegment;
        const crossingX = vertical.start.x;
        const crossingY = horizontal.start.y;
        if (crossingX > Math.min(horizontal.start.x, horizontal.end.x)
          && crossingX < Math.max(horizontal.start.x, horizontal.end.x)
          && crossingY > Math.min(vertical.start.y, vertical.end.y)
          && crossingY < Math.max(vertical.start.y, vertical.end.y)) {
          return false;
        }
      }
    }
  }
  overlaps.sort((leftOverlap, rightOverlap) =>
    leftOverlap.axis.localeCompare(rightOverlap.axis)
    || leftOverlap.coordinate - rightOverlap.coordinate
    || leftOverlap.start - rightOverlap.start
    || leftOverlap.end - rightOverlap.end
  );
  const expected = [
    {
      axis: "horizontal" as const,
      coordinate: source.y,
      start: source.x,
      end: roundMetric(source.x + MIN_ARROW_MARKER_LEG)
    },
    {
      axis: "horizontal" as const,
      coordinate: target.y,
      start: roundMetric(target.x - MIN_ARROW_MARKER_LEG),
      end: target.x
    }
  ];
  return JSON.stringify(overlaps) === JSON.stringify(expected);
}

function duplicateGroupHasOnlyTerminalStubOverlap(
  prepared: readonly PreparedDuplicateFanRoute[]
): boolean {
  const first = prepared[0];
  if (!first || prepared.some((member) =>
    member.source.x !== first.source.x
    || member.source.y !== first.source.y
    || member.target.x !== first.target.x
    || member.target.y !== first.target.y
  )) {
    return false;
  }
  for (let left = 0; left < prepared.length; left += 1) {
    for (let right = left + 1; right < prepared.length; right += 1) {
      if (!duplicatePairHasOnlyTerminalStubs(
        prepared[left]!.route,
        prepared[right]!.route,
        first.source,
        first.target
      )) {
        return false;
      }
    }
  }
  return true;
}

function buildDuplicateGroupAdmission(
  measuredScene: MeasuredScene,
  root: PositionedContainer,
  index: JourneyMapPositionedIndex,
  degrees: JourneyDegreeIndex,
  ordinaryDegrees: JourneyDegreeIndex,
  cycleIndex: JourneyMapCycleIndex
): Map<string, boolean> {
  const admissionByEdgeId = new Map<string, boolean>();
  for (const groupEdges of degrees.sameEndpointEdgesByKey.values()) {
    if (groupEdges.length <= 1) {
      continue;
    }
    const prepared: PreparedDuplicateFanRoute[] = [];
    let admitted = true;
    for (const edge of groupEdges) {
      const eligibility = resolveRouteEligibility(
        edge,
        index,
        degrees,
        ordinaryDegrees,
        cycleIndex.componentByEdgeId.get(edge.id)
      );
      if (!eligibility?.duplicate) {
        admitted = false;
        break;
      }
      const edgeMetadata = edge.viewMetadata?.journeyMap;
      if (!edgeMetadata
        || edge.ownerContainerId !== root.id
        || edge.routing.sourcePortRole !== "journey_flow_out"
        || edge.routing.targetPortRole !== "journey_flow_in"
        || edge.markers?.start !== undefined
        || edge.markers?.end !== "arrow") {
        admitted = false;
        break;
      }
      const ignoredDiagnostics: RendererDiagnostic[] = [];
      const source = resolveEndpoint(
        edge,
        eligibility.source,
        "source",
        edge.routing.sourcePortRole,
        "east",
        ignoredDiagnostics
      );
      const target = resolveEndpoint(
        edge,
        eligibility.target,
        "target",
        edge.routing.targetPortRole,
        "west",
        ignoredDiagnostics
      );
      const fan = source && target
        ? buildDuplicateFan(eligibility, source, target, root, index)
        : undefined;
      const route = source && target && fan
        ? buildDuplicateFanRoute(source, target, fan)
        : undefined;
      if (!source || !target || !fan || !route) {
        admitted = false;
        break;
      }
      prepared.push({ source, target, route });
    }
    admitted = admitted
      && prepared.length === groupEdges.length
      && duplicateGroupHasOnlyTerminalStubOverlap(prepared);
    for (const edge of groupEdges) {
      admissionByEdgeId.set(edge.id, admitted);
    }
  }
  for (const edge of measuredScene.edges) {
    if (!admissionByEdgeId.has(edge.id)) {
      admissionByEdgeId.set(edge.id, true);
    }
  }
  return admissionByEdgeId;
}

function buildStageGates(
  eligibility: RouteEligibility,
  source: JourneyMapResolvedEndpoint,
  target: JourneyMapResolvedEndpoint
): JourneyMapStageGate[] {
  const stageTrackCoordinate = (
    stage: IndexedJourneyStage,
    firstStepOrder: number,
    lastStepOrder: number
  ): number | undefined => {
    const childrenById = new Map(
      stage.stage.children
        .filter((child): child is PositionedNode => child.kind === "node")
        .map((child) => [child.id, child])
    );
    const steps = stage.stepIds.slice(firstStepOrder, lastStepOrder + 1)
      .map((stepId) => childrenById.get(stepId))
      .filter((step): step is PositionedNode => step !== undefined);
    if (steps.length !== lastStepOrder - firstStepOrder + 1) {
      return undefined;
    }
    return roundMetric(Math.max(...steps.map((step) => step.y + step.height)) + MIN_ARROW_MARKER_LEG);
  };
  if (eligibility.archetype === "forward_root_to_contained_bypass"
    && eligibility.targetStage) {
    const gateY = stageTrackCoordinate(
      eligibility.targetStage,
      0,
      eligibility.targetStepOrder
    );
    return gateY === undefined ? [] : [{
      stageId: eligibility.targetStage.stage.id,
      side: "west",
      x: roundMetric(eligibility.targetStage.stage.x),
      y: gateY,
      order: 0,
      locked: true
    }];
  }
  if (eligibility.archetype === "forward_contained_to_root_bypass"
    && eligibility.sourceStage) {
    const gateY = stageTrackCoordinate(
      eligibility.sourceStage,
      eligibility.sourceStepOrder,
      eligibility.sourceStage.stepIds.length - 1
    );
    return gateY === undefined ? [] : [{
      stageId: eligibility.sourceStage.stage.id,
      side: "east",
      x: roundMetric(eligibility.sourceStage.stage.x + eligibility.sourceStage.stage.width),
      y: gateY,
      order: 0,
      locked: true
    }];
  }
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
    if (eligibility.branch) {
      const sourceGateY = eligibility.sourceStepOrder === eligibility.sourceStage.stepIds.length - 1
        ? source.y
        : stageTrackCoordinate(
          eligibility.sourceStage,
          eligibility.sourceStepOrder,
          eligibility.sourceStage.stepIds.length - 1
        );
      return sourceGateY === undefined ? [] : [
        {
          stageId: eligibility.sourceStage.stage.id,
          side: "east",
          x: roundMetric(eligibility.sourceStage.stage.x + eligibility.sourceStage.stage.width),
          y: sourceGateY,
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
  if (eligibility.archetype === "cycle_return_cross_stage"
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

function buildSelfLoopTrack(
  eligibility: RouteEligibility,
  source: JourneyMapResolvedEndpoint,
  target: JourneyMapResolvedEndpoint,
  index: JourneyMapPositionedIndex
): JourneyMapSelfLoopTrack | undefined {
  if (eligibility.archetype !== "self_loop"
    || eligibility.source.node.id !== eligibility.target.node.id
    || !eligibility.sourceStage
    || eligibility.sourceStage.stage.id !== eligibility.targetStage?.stage.id
    || source.itemId !== target.itemId
    || source.side !== "east"
    || target.side !== "west"
    || source.y !== target.y) {
    return undefined;
  }
  const node = eligibility.source.node;
  const stage = eligibility.sourceStage.stage;
  const rightControlX = roundMetric(source.x + MIN_ARROW_MARKER_LEG);
  const leftControlX = roundMetric(target.x - MIN_ARROW_MARKER_LEG);
  const nominalCoordinate = roundMetric(node.y - MIN_ARROW_MARKER_LEG);
  const headerBottom = roundMetric(stage.y + (stage.chrome.headerBandHeight ?? 0));
  const stageRight = roundMetric(stage.x + stage.width);
  if (leftControlX <= stage.x
    || rightControlX >= stageRight
    || nominalCoordinate <= headerBottom
    || rightControlX - source.x < MIN_ARROW_MARKER_LEG
    || target.x - leftControlX < MIN_ARROW_MARKER_LEG
    || nominalCoordinate >= source.y) {
    return undefined;
  }
  const controlSpan = {
    start: roundMetric(Math.min(source.y, nominalCoordinate)),
    end: roundMetric(Math.max(source.y, nominalCoordinate))
  };
  const track: JourneyMapSelfLoopTrack = {
    nodeId: node.id,
    loopSide: "north",
    axis: "horizontal",
    nominalCoordinate,
    span: {
      start: leftControlX,
      end: rightControlX
    },
    sourceControl: {
      axis: "vertical",
      nominalCoordinate: rightControlX,
      span: { ...controlSpan },
      order: 0,
      locked: false
    },
    targetControl: {
      axis: "vertical",
      nominalCoordinate: leftControlX,
      span: { ...controlSpan },
      order: 0,
      locked: false
    },
    order: 0,
    locked: false
  };
  const route = buildSelfLoopRoute(source, target, track);
  if (!route) {
    return undefined;
  }
  const headerRect: Rect = {
    id: stage.id,
    x: stage.x,
    y: stage.y,
    width: stage.width,
    height: stage.chrome.headerBandHeight ?? 0
  };
  if (intersectsRoute(route, headerRect)
    || stage.headerContent.some((block) => intersectsRoute(route, containerContentRect(stage, block)))) {
    return undefined;
  }
  const intersectsUnrelatedStage = index.allStages.some((candidate) =>
    candidate.stage.id !== stage.id
    && (intersectsRoute(route, {
      id: candidate.stage.id,
      x: candidate.stage.x,
      y: candidate.stage.y,
      width: candidate.stage.width,
      height: candidate.stage.height
    })
      || candidate.stage.headerContent.some((block) =>
        intersectsRoute(route, containerContentRect(candidate.stage, block))
      ))
  );
  if (intersectsUnrelatedStage) {
    return undefined;
  }
  const siblingNodes = stage.children.filter((child): child is PositionedNode =>
    child.kind === "node" && child.id !== node.id
  );
  if (siblingNodes.some((sibling) => intersectsRoute(route, {
    id: sibling.id,
    x: sibling.x,
    y: sibling.y,
    width: sibling.width,
    height: sibling.height
  }))) {
    return undefined;
  }
  return track;
}

function buildDuplicateFanRoute(
  source: JourneyMapResolvedEndpoint,
  target: JourneyMapResolvedEndpoint,
  fan: JourneyMapDuplicateFan
): PositionedRoute | undefined {
  if (source.itemId === target.itemId
    || source.side !== "east"
    || target.side !== "west"
    || source.y !== target.y
    || source.x >= target.x
    || fan.policy !== "distinct_nominal_fan"
    || fan.groupSize <= 1
    || fan.groupEdgeIds.length !== fan.groupSize
    || fan.groupOrdinal < 0
    || fan.groupOrdinal >= fan.groupSize
    || fan.laneIndex !== journeyMapDuplicateLaneIndex(fan.groupOrdinal)
    || fan.axis !== "horizontal"
    || fan.order !== 0
    || fan.locked !== false) {
    return undefined;
  }
  if (fan.laneIndex === 0) {
    if (fan.nominalCoordinate !== source.y
      || fan.segmentIndex !== 0
      || fan.span.start !== source.x
      || fan.span.end !== target.x
      || fan.sourceControl !== undefined
      || fan.targetControl !== undefined) {
      return undefined;
    }
    return {
      style: "orthogonal",
      points: cloneRoutePoints([source, target])
    };
  }
  const sourceControl = fan.sourceControl;
  const targetControl = fan.targetControl;
  const expectedControlSpan = {
    start: roundMetric(Math.min(source.y, fan.nominalCoordinate)),
    end: roundMetric(Math.max(source.y, fan.nominalCoordinate))
  };
  if (!sourceControl
    || !targetControl
    || fan.segmentIndex !== 2
    || fan.nominalCoordinate !== roundMetric(
      source.y + fan.laneIndex * JOURNEY_MAP_TRACK_SEPARATION
    )
    || fan.span.start !== sourceControl.nominalCoordinate
    || fan.span.end !== targetControl.nominalCoordinate
    || sourceControl.axis !== "vertical"
    || targetControl.axis !== "vertical"
    || sourceControl.nominalCoordinate - source.x !== MIN_ARROW_MARKER_LEG
    || target.x - targetControl.nominalCoordinate !== MIN_ARROW_MARKER_LEG
    || targetControl.nominalCoordinate - sourceControl.nominalCoordinate
      < JOURNEY_MAP_TRACK_SEPARATION
    || JSON.stringify(sourceControl.span) !== JSON.stringify(expectedControlSpan)
    || JSON.stringify(targetControl.span) !== JSON.stringify(expectedControlSpan)
    || sourceControl.segmentIndex !== 1
    || targetControl.segmentIndex !== 3
    || sourceControl.order !== 0
    || targetControl.order !== 0
    || sourceControl.locked !== false
    || targetControl.locked !== false) {
    return undefined;
  }
  return {
    style: "orthogonal",
    points: cloneRoutePoints([
      source,
      { x: sourceControl.nominalCoordinate, y: source.y },
      { x: sourceControl.nominalCoordinate, y: fan.nominalCoordinate },
      { x: targetControl.nominalCoordinate, y: fan.nominalCoordinate },
      { x: targetControl.nominalCoordinate, y: target.y },
      target
    ])
  };
}

function buildDuplicateFan(
  eligibility: RouteEligibility,
  source: JourneyMapResolvedEndpoint,
  target: JourneyMapResolvedEndpoint,
  root: PositionedContainer,
  index: JourneyMapPositionedIndex
): JourneyMapDuplicateFan | undefined {
  const duplicate = eligibility.duplicate;
  if (eligibility.archetype !== "adjacent_forward_root_step"
    || !duplicate
    || eligibility.sourceStage
    || eligibility.targetStage
    || eligibility.source.node.id === eligibility.target.node.id
    || source.itemId !== eligibility.source.node.id
    || target.itemId !== eligibility.target.node.id
    || source.side !== "east"
    || target.side !== "west"
    || source.y !== target.y
    || target.x - source.x
      < 2 * MIN_ARROW_MARKER_LEG + JOURNEY_MAP_TRACK_SEPARATION) {
    return undefined;
  }
  const nominalCoordinate = roundMetric(
    source.y + duplicate.laneIndex * JOURNEY_MAP_TRACK_SEPARATION
  );
  const sourceControlX = roundMetric(source.x + MIN_ARROW_MARKER_LEG);
  const targetControlX = roundMetric(target.x - MIN_ARROW_MARKER_LEG);
  const controlSpan = {
    start: roundMetric(Math.min(source.y, nominalCoordinate)),
    end: roundMetric(Math.max(source.y, nominalCoordinate))
  };
  const isCanonical = duplicate.laneIndex === 0;
  const fan: JourneyMapDuplicateFan = {
    policy: "distinct_nominal_fan",
    groupEdgeIds: [...duplicate.groupEdgeIds],
    groupSize: duplicate.groupSize,
    groupOrdinal: duplicate.groupOrdinal,
    laneIndex: duplicate.laneIndex,
    axis: "horizontal",
    nominalCoordinate,
    span: isCanonical
      ? { start: source.x, end: target.x }
      : { start: sourceControlX, end: targetControlX },
    segmentIndex: isCanonical ? 0 : 2,
    ...(!isCanonical ? {
      sourceControl: {
        axis: "vertical" as const,
        nominalCoordinate: sourceControlX,
        span: { ...controlSpan },
        segmentIndex: 1 as const,
        order: 0 as const,
        locked: false as const
      },
      targetControl: {
        axis: "vertical" as const,
        nominalCoordinate: targetControlX,
        span: { ...controlSpan },
        segmentIndex: 3 as const,
        order: 0 as const,
        locked: false as const
      }
    } : {}),
    order: 0,
    locked: false
  };
  const route = buildDuplicateFanRoute(source, target, fan);
  if (!route) {
    return undefined;
  }
  const rootRight = roundMetric(root.x + root.width);
  const rootBottom = roundMetric(root.y + root.height);
  if (route.points.some((point) =>
    point.x <= root.x || point.x >= rootRight || point.y <= root.y || point.y >= rootBottom
  )) {
    return undefined;
  }
  if (index.allNodes.some((candidate) => intersectsRoute(route, nodeRect(candidate)))) {
    return undefined;
  }
  for (const stage of index.allStages) {
    if (intersectsRoute(route, {
      id: stage.stage.id,
      x: stage.stage.x,
      y: stage.stage.y,
      width: stage.stage.width,
      height: stage.stage.height
    }) || stage.stage.headerContent.some((block) =>
      intersectsRoute(route, containerContentRect(stage.stage, block))
    )) {
      return undefined;
    }
  }
  if (root.headerContent.some((block) =>
    intersectsRoute(route, containerContentRect(root, block))
  )) {
    return undefined;
  }
  for (const candidate of index.allNodes) {
    for (const block of candidate.node.content.filter((item) => item.region === "secondary")) {
      if (intersectsRoute(route, contentRect(candidate.node, block))) {
        return undefined;
      }
    }
  }
  return fan;
}

function buildStageLocalBypass(
  eligibility: RouteEligibility,
  source: JourneyMapResolvedEndpoint,
  target: JourneyMapResolvedEndpoint
): JourneyMapStageLocalBypass | undefined {
  if ((eligibility.archetype !== "non_adjacent_forward_same_stage"
    && eligibility.archetype !== "backward_same_stage"
    && eligibility.archetype !== "cycle_forward_same_stage"
    && eligibility.archetype !== "cycle_return_same_stage")
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

function buildBoundaryStageLocalBypass(
  eligibility: RouteEligibility,
  root: PositionedContainer,
  source: JourneyMapResolvedEndpoint,
  target: JourneyMapResolvedEndpoint
): JourneyMapStageLocalBypass | undefined {
  const isContainedToRoot = eligibility.archetype === "forward_contained_to_root_bypass";
  const isLongCrossEgress = eligibility.archetype === "long_forward_cross_stage"
    && eligibility.branch !== undefined
    && eligibility.sourceStage !== undefined
    && eligibility.sourceStepOrder < eligibility.sourceStage.stepIds.length - 1;
  const isRootToContained = eligibility.archetype === "forward_root_to_contained_bypass";
  const boundaryRole = isRootToContained ? "ingress" : "egress";
  const stage = isRootToContained ? eligibility.targetStage : eligibility.sourceStage;
  if ((!isContainedToRoot && !isLongCrossEgress && !isRootToContained) || !stage) {
    return undefined;
  }
  const firstStepOrder = boundaryRole === "egress" ? eligibility.sourceStepOrder : 0;
  const lastStepOrder = boundaryRole === "egress"
    ? stage.stepIds.length - 1
    : eligibility.targetStepOrder;
  const stepIds = stage.stepIds.slice(firstStepOrder, lastStepOrder + 1);
  const childrenById = new Map(
    stage.stage.children
      .filter((child): child is PositionedNode => child.kind === "node")
      .map((child) => [child.id, child])
  );
  const spannedSteps = stepIds
    .map((stepId) => childrenById.get(stepId))
    .filter((step): step is PositionedNode => step !== undefined);
  if (spannedSteps.length !== stepIds.length || spannedSteps.length === 0) {
    return undefined;
  }
  const nominalCoordinate = roundMetric(
    Math.max(...spannedSteps.map((step) => step.y + step.height)) + MIN_ARROW_MARKER_LEG
  );
  if (nominalCoordinate >= stage.stage.y + stage.stage.height) {
    return undefined;
  }
  const obstacleSteps = boundaryRole === "egress"
    ? spannedSteps.slice(1)
    : spannedSteps.slice(0, -1);
  const firstObstacle = obstacleSteps[0];
  const stageBoundaryCoordinate = boundaryRole === "egress"
    ? roundMetric(stage.stage.x + stage.stage.width)
    : roundMetric(stage.stage.x);
  const departureCoordinate = boundaryRole === "egress"
    ? firstObstacle
      ? roundMetric((source.x + firstObstacle.x) / 2)
      : source.x
    : roundMetric((source.x + stageBoundaryCoordinate) / 2);
  const trackStart = boundaryRole === "egress"
    ? departureCoordinate
    : stageBoundaryCoordinate;
  const trackEnd = boundaryRole === "egress"
    ? stageBoundaryCoordinate
    : target.x;
  const sourceRootOrder = eligibility.source.metadata.rootOrder;
  const targetRootOrder = eligibility.target.metadata.rootOrder;
  const firstRootOrder = Math.min(sourceRootOrder, targetRootOrder);
  const lastRootOrder = Math.max(sourceRootOrder, targetRootOrder);
  const firstIntermediateRootItem = root.children.find((item) => {
    const rootOrder = rootOrderOf(item);
    return rootOrder !== undefined && rootOrder > firstRootOrder && rootOrder < lastRootOrder;
  });
  const rootNominalCoordinate = root.children.length > 0
    ? roundMetric(Math.max(...root.children.map((item) => item.y + item.height)) + MIN_ARROW_MARKER_LEG)
    : undefined;
  const boundaryTransition = isLongCrossEgress
    && firstIntermediateRootItem
    && rootNominalCoordinate !== undefined
    ? {
      axis: "vertical" as const,
      nominalCoordinate: roundMetric(
        (stageBoundaryCoordinate + firstIntermediateRootItem.x) / 2
      ),
      span: {
        start: roundMetric(Math.min(nominalCoordinate, rootNominalCoordinate)),
        end: roundMetric(Math.max(nominalCoordinate, rootNominalCoordinate))
      },
      stageBoundaryCoordinate,
      obstacleItemId: firstIntermediateRootItem.id,
      obstacleBoundaryCoordinate: roundMetric(firstIntermediateRootItem.x),
      order: 0 as const,
      locked: false as const
    }
    : undefined;
  return {
    stageId: stage.stage.id,
    boundaryRole,
    axis: "horizontal",
    nominalCoordinate,
    span: {
      start: roundMetric(Math.min(trackStart, trackEnd)),
      end: roundMetric(Math.max(trackStart, trackEnd))
    },
    endpointSpan: {
      start: roundMetric(Math.min(source.x, target.x)),
      end: roundMetric(Math.max(source.x, target.x))
    },
    intermediateStepIds: obstacleSteps.map((step) => step.id),
    obstacleControls: obstacleSteps.map((step) => ({
      stepId: step.id,
      entryX: roundMetric(step.x),
      exitX: roundMetric(step.x + step.width)
    })),
    ...(boundaryTransition ? { boundaryTransition } : {}),
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
    && eligibility.archetype !== "backward_root_step"
    && eligibility.archetype !== "cycle_return_cross_stage") {
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
  const branchDepartureAnchor = eligibility.branch && eligibility.sourceStage
    ? roundMetric(eligibility.sourceStage.stage.x + eligibility.sourceStage.stage.width)
    : source.x;
  const branchDepartureX = eligibility.branch && firstIntermediateRootItem
    ? roundMetric((branchDepartureAnchor + firstIntermediateRootItem.x) / 2)
    : undefined;
  if (eligibility.branch && (!firstIntermediateRootItem
    || branchDepartureX === undefined
    || branchDepartureX - branchDepartureAnchor < MIN_ARROW_MARKER_LEG
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
  const ingressBoundaryCoordinate = stageLocalBypass?.boundaryRole === "ingress"
    ? stageLocalBypass.span.start
    : undefined;
  const obstacleControl = ingressBoundaryCoordinate !== undefined
    ? {
      obstacleItemId: stageLocalBypass!.stageId,
      obstacleBoundaryCoordinate: ingressBoundaryCoordinate
    }
    : stageLocalBypass?.obstacleControls[0]
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
      nominalCoordinate: ingressBoundaryCoordinate !== undefined
        ? roundMetric((source.x + ingressBoundaryCoordinate) / 2)
        : bypass.span.start,
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

function buildSelfLoopRoute(
  source: JourneyMapResolvedEndpoint,
  target: JourneyMapResolvedEndpoint,
  track: JourneyMapSelfLoopTrack
): PositionedRoute | undefined {
  const sourceControl = track.sourceControl;
  const targetControl = track.targetControl;
  if (source.itemId !== target.itemId
    || track.nodeId !== source.itemId
    || source.side !== "east"
    || target.side !== "west"
    || source.y !== target.y
    || track.loopSide !== "north"
    || track.axis !== "horizontal"
    || track.order !== 0
    || track.locked !== false
    || sourceControl.axis !== "vertical"
    || targetControl.axis !== "vertical"
    || sourceControl.order !== 0
    || targetControl.order !== 0
    || sourceControl.locked !== false
    || targetControl.locked !== false
    || sourceControl.nominalCoordinate - source.x < MIN_ARROW_MARKER_LEG
    || target.x - targetControl.nominalCoordinate < MIN_ARROW_MARKER_LEG
    || track.nominalCoordinate >= source.y
    || track.span.start !== targetControl.nominalCoordinate
    || track.span.end !== sourceControl.nominalCoordinate
    || JSON.stringify(sourceControl.span) !== JSON.stringify({
      start: track.nominalCoordinate,
      end: source.y
    })
    || JSON.stringify(targetControl.span) !== JSON.stringify({
      start: track.nominalCoordinate,
      end: target.y
    })) {
    return undefined;
  }
  return {
    style: "orthogonal",
    points: cloneRoutePoints([
      source,
      { x: sourceControl.nominalCoordinate, y: source.y },
      { x: sourceControl.nominalCoordinate, y: track.nominalCoordinate },
      { x: targetControl.nominalCoordinate, y: track.nominalCoordinate },
      { x: targetControl.nominalCoordinate, y: target.y },
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
    const [sourceGate, targetGate] = stageGates;
    const branchGatesMatch = stageGates.length === 0
      || (stageGates.length === 2
        && sourceGate?.side === "east"
        && targetGate?.side === "south");
    if (source.side !== "east"
      || target.side !== "south"
      || !branchGatesMatch
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
        ...(includeControls && sourceGate ? [sourceGate] : []),
        { x: departure.nominalCoordinate, y: source.y },
        { x: departure.nominalCoordinate, y: bypass.nominalCoordinate },
        ...(includeControls
          ? bypass.obstacleControls.flatMap((control) => [
            { x: control.entryX, y: bypass.nominalCoordinate },
            { x: control.exitX, y: bypass.nominalCoordinate }
          ])
          : []),
        { x: target.x, y: bypass.nominalCoordinate },
        ...(includeControls && targetGate ? [targetGate] : []),
        target
      ])
    };
  }
  const [sourceGate, targetGate] = stageGates;
  const sourceBoundaryY = sourceGate?.y ?? source.y;
  const targetBoundaryY = targetGate?.y ?? target.y;
  const stageGatesMatch = stageGates.length === 0
    || (stageGates.length === 2
      && sourceGate?.side === "south"
      && targetGate?.side === "south");
  if (source.side !== "south"
    || target.side !== "south"
    || source.x === target.x
    || !stageGatesMatch
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

function buildBoundaryStageBypassRoute(
  source: JourneyMapResolvedEndpoint,
  target: JourneyMapResolvedEndpoint,
  bypass: JourneyMapStageLocalBypass,
  rootBypass: JourneyMapRootOuterBypass | undefined,
  stageGates: readonly JourneyMapStageGate[],
  branch: JourneyMapBranchPlan | undefined,
  includeControls: boolean
): PositionedRoute | undefined {
  const departure = branch?.departureControl;
  if (!departure || source.side !== "east" || target.side !== "south") {
    return undefined;
  }
  const obstaclePoints = bypass.obstacleControls.flatMap((control) => [
    { x: control.entryX, y: bypass.nominalCoordinate },
    { x: control.exitX, y: bypass.nominalCoordinate }
  ]);
  if (bypass.boundaryRole === "ingress") {
    const [targetStageGate] = stageGates;
    if (targetStageGate?.side !== "west"
      || source.x >= departure.nominalCoordinate
      || departure.nominalCoordinate >= targetStageGate.x
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
        ...(includeControls ? [targetStageGate, ...obstaclePoints] : []),
        { x: target.x, y: bypass.nominalCoordinate },
        target
      ])
    };
  }
  if (bypass.boundaryRole !== "egress") {
    return undefined;
  }
  const [sourceStageGate, targetStageGate] = stageGates;
  if (sourceStageGate?.side !== "east"
    || source.x >= departure.nominalCoordinate
    || departure.nominalCoordinate >= sourceStageGate.x) {
    return undefined;
  }
  const transitionX = bypass.boundaryTransition?.nominalCoordinate
    ?? roundMetric((sourceStageGate.x + (target.x - target.offset)) / 2);
  if (transitionX <= sourceStageGate.x || transitionX >= target.x) {
    return undefined;
  }
  if (!rootBypass) {
    return {
      style: "orthogonal",
      points: cloneRoutePoints([
        source,
        { x: departure.nominalCoordinate, y: source.y },
        { x: departure.nominalCoordinate, y: bypass.nominalCoordinate },
        ...(includeControls ? [...obstaclePoints, sourceStageGate] : []),
        { x: transitionX, y: bypass.nominalCoordinate },
        { x: target.x, y: bypass.nominalCoordinate },
        target
      ])
    };
  }
  if (!bypass.boundaryTransition
    || targetStageGate?.side !== "south"
    || rootBypass.nominalCoordinate <= bypass.nominalCoordinate
    || rootBypass.nominalCoordinate <= targetStageGate.y) {
    return undefined;
  }
  const rootObstaclePoints = rootBypass.obstacleControls.flatMap((control) => [
    { x: control.entryX, y: rootBypass.nominalCoordinate },
    { x: control.exitX, y: rootBypass.nominalCoordinate }
  ]);
  return {
    style: "orthogonal",
    points: cloneRoutePoints([
      source,
      { x: departure.nominalCoordinate, y: source.y },
      { x: departure.nominalCoordinate, y: bypass.nominalCoordinate },
      ...(includeControls ? [...obstaclePoints, sourceStageGate] : []),
      { x: transitionX, y: bypass.nominalCoordinate },
      { x: transitionX, y: rootBypass.nominalCoordinate },
      ...(includeControls ? rootObstaclePoints : []),
      { x: target.x, y: rootBypass.nominalCoordinate },
      ...(includeControls ? [targetStageGate] : []),
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
      || eligibility.archetype === "cycle_forward_same_stage"
      || eligibility.archetype === "cycle_return_same_stage"
      || eligibility.archetype === "cycle_return_cross_stage"
      || eligibility.archetype === "self_loop"
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

interface JourneyMapRouteSegmentRun {
  axis: JourneyMapOccupancyAxis;
  coordinate: number;
  span: {
    start: number;
    end: number;
  };
  routeSegmentIndexes: number[];
  segmentRunIndex: number;
}

function buildJourneyMapRouteSegmentRuns(route: PositionedRoute): JourneyMapRouteSegmentRun[] {
  const runs: JourneyMapRouteSegmentRun[] = [];
  for (const segment of routeSegments(route)) {
    const axis = segment.start.y === segment.end.y
      ? "horizontal"
      : segment.start.x === segment.end.x
        ? "vertical"
        : undefined;
    if (!axis) {
      continue;
    }
    const coordinate = roundMetric(axis === "horizontal" ? segment.start.y : segment.start.x);
    const segmentSpan = axis === "horizontal"
      ? { start: Math.min(segment.start.x, segment.end.x), end: Math.max(segment.start.x, segment.end.x) }
      : { start: Math.min(segment.start.y, segment.end.y), end: Math.max(segment.start.y, segment.end.y) };
    const previous = runs.at(-1);
    if (previous && previous.axis === axis && previous.coordinate === coordinate) {
      previous.span.start = roundMetric(Math.min(previous.span.start, segmentSpan.start));
      previous.span.end = roundMetric(Math.max(previous.span.end, segmentSpan.end));
      previous.routeSegmentIndexes.push(segment.index);
      continue;
    }
    runs.push({
      axis,
      coordinate,
      span: {
        start: roundMetric(segmentSpan.start),
        end: roundMetric(segmentSpan.end)
      },
      routeSegmentIndexes: [segment.index],
      segmentRunIndex: runs.length
    });
  }
  return runs;
}

function runContainsPoint(run: JourneyMapRouteSegmentRun, point: Point): boolean {
  const varyingCoordinate = run.axis === "horizontal" ? point.x : point.y;
  const fixedCoordinate = run.axis === "horizontal" ? point.y : point.x;
  return Math.abs(fixedCoordinate - run.coordinate) <= 0.001
    && varyingCoordinate >= run.span.start - 0.001
    && varyingCoordinate <= run.span.end + 0.001;
}

function spansOverlap(
  left: { start: number; end: number },
  right: { start: number; end: number }
): boolean {
  return Math.min(left.end, right.end) >= Math.max(left.start, right.start) - 0.001;
}

function normalCoordinateForSide(point: Point, side: PortSide): number {
  return side === "east" || side === "west" ? point.x : point.y;
}

function occupancyResourceKey(
  ownerContainerId: string,
  resource: JourneyMapOccupancyResource
): string {
  void ownerContainerId;
  switch (resource.kind) {
    case "node_side":
      return `node:${resource.nodeId}:${resource.side}`;
    case "adjacent_step_gap":
      return `step-gap:${resource.fromItemId}:${resource.toItemId}`;
    case "stage_local_bypass":
      return `stage-bypass:${resource.stageId}`;
    case "inter_root_item_gutter":
      return `root-gap:${resource.beforeRootItemId ?? "start"}:${resource.afterRootItemId ?? "end"}`;
    case "root_outer_bypass":
      return `root-outer:${resource.rootId}`;
    case "stage_boundary_gate":
      return `stage-gate:${resource.stageId}:${resource.side}:${resource.order}`;
    case "obstacle_swerve":
      return `obstacle:${resource.obstacleItemId}:${resource.side}`;
    case "departure_stem":
      return `stem:${resource.nodeId}:${resource.side}`;
    case "arrival_stem":
      return `stem:${resource.nodeId}:${resource.side}`;
  }
}

function findRootGutterResource(
  root: PositionedContainer,
  coordinate: number
): Extract<JourneyMapOccupancyResource, { kind: "inter_root_item_gutter" }> | undefined {
  const ordered = [...root.children].sort((left, right) =>
    left.x - right.x || left.id.localeCompare(right.id)
  );
  if (ordered.some((item) =>
    coordinate > item.x + 0.001 && coordinate < item.x + item.width - 0.001
  )) {
    return undefined;
  }
  const before = ordered
    .filter((item) => item.x + item.width <= coordinate + 0.001)
    .at(-1);
  const after = ordered.find((item) => item.x >= coordinate - 0.001);
  return {
    kind: "inter_root_item_gutter",
    ...(before ? { beforeRootItemId: before.id } : {}),
    ...(after ? { afterRootItemId: after.id } : {})
  };
}

function sideForObstacleControl(
  obstacle: PositionedItem | undefined,
  axis: JourneyMapOccupancyAxis,
  coordinate: number
): PortSide {
  if (!obstacle) {
    return axis === "vertical" ? "west" : "north";
  }
  if (axis === "vertical") {
    return coordinate < obstacle.x + obstacle.width / 2 ? "west" : "east";
  }
  return coordinate < obstacle.y + obstacle.height / 2 ? "north" : "south";
}

function obstacleResourceForRun(
  plan: JourneyMapConnectorPlan,
  run: JourneyMapRouteSegmentRun,
  positionedScene: PositionedScene,
  allowDisplacedCoordinate = false
): Extract<JourneyMapOccupancyResource, { kind: "obstacle_swerve" }> | undefined {
  const positionedItems = new Map(flattenItems(positionedScene.root).map((item) => [item.id, item] as const));
  const controls: Array<{ itemId: string; axis: JourneyMapOccupancyAxis; coordinate: number }> = [];
  for (const control of plan.stageLocalBypass?.obstacleControls ?? []) {
    controls.push(
      { itemId: control.stepId, axis: "vertical", coordinate: control.entryX },
      { itemId: control.stepId, axis: "vertical", coordinate: control.exitX }
    );
  }
  for (const control of plan.rootOuterBypass?.obstacleControls ?? []) {
    controls.push(
      { itemId: control.rootItemId, axis: "vertical", coordinate: control.entryX },
      { itemId: control.rootItemId, axis: "vertical", coordinate: control.exitX }
    );
  }
  if (plan.branch?.departureControl) {
    controls.push({
      itemId: plan.branch.departureControl.obstacleItemId,
      axis: plan.branch.departureControl.axis,
      coordinate: plan.branch.departureControl.nominalCoordinate
    });
  }
  if (plan.join?.arrivalControl) {
    controls.push({
      itemId: plan.join.arrivalControl.obstacleItemId,
      axis: plan.join.arrivalControl.axis,
      coordinate: plan.join.arrivalControl.nominalCoordinate
    });
  }
  if (plan.selfLoopTrack) {
    controls.push(
      {
        itemId: plan.selfLoopTrack.nodeId,
        axis: plan.selfLoopTrack.sourceControl.axis,
        coordinate: plan.selfLoopTrack.sourceControl.nominalCoordinate
      },
      {
        itemId: plan.selfLoopTrack.nodeId,
        axis: plan.selfLoopTrack.targetControl.axis,
        coordinate: plan.selfLoopTrack.targetControl.nominalCoordinate
      }
    );
  }
  const control = controls.find((candidate) =>
    candidate.axis === run.axis && Math.abs(candidate.coordinate - run.coordinate) <= 0.001
  );
  if (control) {
    return {
      kind: "obstacle_swerve",
      obstacleItemId: control.itemId,
      side: sideForObstacleControl(positionedItems.get(control.itemId), run.axis, run.coordinate)
    };
  }
  if (!allowDisplacedCoordinate) {
    return undefined;
  }
  const nearest = controls
    .filter((candidate) => candidate.axis === run.axis)
    .map((candidate) => {
      const obstacle = positionedItems.get(candidate.itemId);
      if (!obstacle) {
        return undefined;
      }
      const distance = run.axis === "vertical"
        ? run.coordinate <= obstacle.x
          ? obstacle.x - run.coordinate
          : run.coordinate >= obstacle.x + obstacle.width
            ? run.coordinate - (obstacle.x + obstacle.width)
            : Number.POSITIVE_INFINITY
        : run.coordinate <= obstacle.y
          ? obstacle.y - run.coordinate
          : run.coordinate >= obstacle.y + obstacle.height
            ? run.coordinate - (obstacle.y + obstacle.height)
            : Number.POSITIVE_INFINITY;
      return Number.isFinite(distance) ? { candidate, obstacle, distance } : undefined;
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== undefined)
    .sort((left, right) => left.distance - right.distance
      || left.candidate.itemId.localeCompare(right.candidate.itemId))[0];
  return nearest ? {
    kind: "obstacle_swerve",
    obstacleItemId: nearest.candidate.itemId,
    side: sideForObstacleControl(nearest.obstacle, run.axis, run.coordinate)
  } : undefined;
}

function primaryOccupancyResourceForRun(
  plan: JourneyMapConnectorPlan,
  run: JourneyMapRouteSegmentRun,
  positionedScene: PositionedScene
): JourneyMapOccupancyResource {
  const stage = plan.stageLocalBypass
    ? flattenItems(positionedScene.root).find((item): item is PositionedContainer =>
      item.kind === "container" && item.id === plan.stageLocalBypass?.stageId
    )
    : undefined;
  const overlappingStageChildren = stage?.children.filter((item) =>
    Math.min(run.span.end, item.x + item.width) - Math.max(run.span.start, item.x) > 0.001
  ) ?? [];
  const stageChildrenBottom = overlappingStageChildren.length > 0
    ? Math.max(...overlappingStageChildren.map((item) => item.y + item.height))
    : Number.POSITIVE_INFINITY;
  if (plan.stageLocalBypass
    && run.axis === plan.stageLocalBypass.axis
    && run.coordinate >= stageChildrenBottom + MIN_ARROW_MARKER_LEG - 0.001
    && spansOverlap(run.span, plan.stageLocalBypass.span)) {
    return { kind: "stage_local_bypass", stageId: plan.stageLocalBypass.stageId };
  }
  if (plan.rootOuterBypass
    && run.axis === plan.rootOuterBypass.axis
    && run.coordinate >= Math.max(...positionedScene.root.children.map((item) =>
      item.y + item.height
    )) + MIN_ARROW_MARKER_LEG - 0.001
    && spansOverlap(run.span, plan.rootOuterBypass.span)) {
    return { kind: "root_outer_bypass", rootId: positionedScene.root.id };
  }
  if (plan.selfLoopTrack
    && run.axis === plan.selfLoopTrack.axis
    && Math.abs(run.coordinate - plan.selfLoopTrack.nominalCoordinate) <= 0.001
    && spansOverlap(run.span, plan.selfLoopTrack.span)) {
    return { kind: "stage_local_bypass", stageId: plan.ownerContainerId };
  }
  if (plan.ownerContainerId === positionedScene.root.id && run.axis === "vertical") {
    const rootGutter = findRootGutterResource(positionedScene.root, run.coordinate);
    if (rootGutter) {
      return rootGutter;
    }
  }
  const obstacle = obstacleResourceForRun(plan, run, positionedScene);
  if (obstacle) {
    return obstacle;
  }
  return {
    kind: "adjacent_step_gap",
    fromItemId: plan.from,
    toItemId: plan.to
  };
}

function resolvedPrimaryOccupancyResourceForRun(
  plan: JourneyMapConnectorPlan,
  run: JourneyMapRouteSegmentRun,
  positionedScene: PositionedScene,
  resolvedState: JourneyMapResolvedConnectorState | undefined,
  nominalOccupancy: readonly JourneyMapOccupancyRecord[]
): JourneyMapOccupancyResource {
  const geometricResource = primaryOccupancyResourceForRun(plan, run, positionedScene);
  if (geometricResource.kind === "stage_local_bypass"
    || geometricResource.kind === "root_outer_bypass"
    || geometricResource.kind === "inter_root_item_gutter") {
    return geometricResource;
  }
  const segmentCoordinate = resolvedState?.segmentCoordinates.find((coordinate) =>
    coordinate.segmentRunIndex === run.segmentRunIndex && coordinate.axis === run.axis
  );
  if (segmentCoordinate) {
    const primaryKinds = new Set<JourneyMapOccupancyResource["kind"]>([
      "adjacent_step_gap",
      "stage_local_bypass",
      "inter_root_item_gutter",
      "root_outer_bypass",
      "obstacle_swerve"
    ]);
    const candidates = nominalOccupancy.filter((record) =>
      record.connectorId === plan.id
      && record.axis === run.axis
      && primaryKinds.has(record.resource.kind)
      && Math.abs(record.nominalCoordinate - segmentCoordinate.nominalCoordinate) <= 0.001
    ).sort((left, right) =>
      Number(right.segmentRunIndex === run.segmentRunIndex)
        - Number(left.segmentRunIndex === run.segmentRunIndex)
      || left.segmentRunIndex - right.segmentRunIndex
      || left.resourceKey.localeCompare(right.resourceKey)
    );
    if (candidates[0]) {
      return structuredClone(candidates[0].resource);
    }
  }
  const finalRunCount = resolvedState
    ? buildJourneyMapRouteSegmentRuns(resolvedState.finalRoute).length
    : 0;
  return run.segmentRunIndex > 0 && run.segmentRunIndex < finalRunCount - 1
    ? obstacleResourceForRun(plan, run, positionedScene, true) ?? geometricResource
    : geometricResource;
}

function isNormalRunForSide(run: JourneyMapRouteSegmentRun, side: PortSide): boolean {
  return side === "east" || side === "west"
    ? run.axis === "horizontal"
    : run.axis === "vertical";
}

function compareOccupancyRecords(
  left: JourneyMapOccupancyRecord,
  right: JourneyMapOccupancyRecord
): number {
  return left.resourceKey.localeCompare(right.resourceKey)
    || left.axis.localeCompare(right.axis)
    || left.segmentRunIndex - right.segmentRunIndex
    || comparePriorities(left.priority, right.priority)
    || left.routeSegmentIndex - right.routeSegmentIndex
    || left.connectorId.localeCompare(right.connectorId);
}

export function extractJourneyMapOccupancy(
  plans: readonly JourneyMapConnectorPlan[],
  positionedScene: PositionedScene,
  resolvedStates: readonly JourneyMapResolvedConnectorState[] = [],
  nominalOccupancy: readonly JourneyMapOccupancyRecord[] = []
): JourneyMapOccupancyRecord[] {
  const records: JourneyMapOccupancyRecord[] = [];
  const resolvedStateById = new Map(resolvedStates.map((state) => [state.connectorId, state] as const));
  const append = (
    plan: JourneyMapConnectorPlan,
    run: JourneyMapRouteSegmentRun,
    resource: JourneyMapOccupancyResource,
    lock: JourneyMapOccupancyLock = { kind: "none" }
  ): void => {
    records.push({
      connectorId: plan.id,
      resource: structuredClone(resource),
      resourceKey: occupancyResourceKey(plan.ownerContainerId, resource),
      ownerContainerId: plan.ownerContainerId,
      axis: run.axis,
      nominalCoordinate: run.coordinate,
      resolvedCoordinate: run.coordinate,
      span: { ...run.span },
      routeSegmentIndex: run.routeSegmentIndexes[0]!,
      segmentRunIndex: run.segmentRunIndex,
      archetype: plan.archetype,
      priority: { ...plan.priority },
      lock: structuredClone(lock)
    });
  };

  for (const plan of plans) {
    const runs = buildJourneyMapRouteSegmentRuns(plan.provisionalRoute);
    for (const run of runs) {
      append(plan, run, resolvedStates.length > 0
        ? resolvedPrimaryOccupancyResourceForRun(
          plan,
          run,
          positionedScene,
          resolvedStateById.get(plan.id),
          nominalOccupancy
        )
        : primaryOccupancyResourceForRun(plan, run, positionedScene));
    }

    const firstRun = runs[0];
    if (firstRun) {
      const lock: JourneyMapOccupancyLock = {
        kind: "endpoint_normal",
        itemId: plan.sourceEndpoint.itemId,
        portId: plan.sourceEndpoint.portId,
        side: plan.sourceEndpoint.side,
        normalCoordinate: normalCoordinateForSide(plan.sourceEndpoint, plan.sourceEndpoint.side)
      };
      append(plan, firstRun, {
        kind: "node_side",
        nodeId: plan.sourceEndpoint.itemId,
        side: plan.sourceEndpoint.side,
        endpointRole: "source"
      }, lock);
      append(plan, firstRun, {
        kind: "departure_stem",
        nodeId: plan.sourceEndpoint.itemId,
        side: plan.sourceEndpoint.side
      }, lock);
    }

    const lastRun = runs.at(-1);
    if (lastRun) {
      const lock: JourneyMapOccupancyLock = {
        kind: "endpoint_normal",
        itemId: plan.targetEndpoint.itemId,
        portId: plan.targetEndpoint.portId,
        side: plan.targetEndpoint.side,
        normalCoordinate: normalCoordinateForSide(plan.targetEndpoint, plan.targetEndpoint.side)
      };
      append(plan, lastRun, {
        kind: "node_side",
        nodeId: plan.targetEndpoint.itemId,
        side: plan.targetEndpoint.side,
        endpointRole: "target"
      }, lock);
      append(plan, lastRun, {
        kind: "arrival_stem",
        nodeId: plan.targetEndpoint.itemId,
        side: plan.targetEndpoint.side
      }, lock);
    }

    for (const gate of plan.stageGates) {
      const gatePoint = { x: gate.x, y: gate.y };
      const run = runs.find((candidate) =>
        isNormalRunForSide(candidate, gate.side) && runContainsPoint(candidate, gatePoint)
      );
      if (!run) {
        continue;
      }
      append(plan, run, {
        kind: "stage_boundary_gate",
        stageId: gate.stageId,
        side: gate.side,
        order: gate.order
      }, {
        kind: "boundary_normal",
        stageId: gate.stageId,
        side: gate.side,
        order: gate.order,
        normalCoordinate: normalCoordinateForSide(gatePoint, gate.side)
      });
    }
  }

  return records.sort(compareOccupancyRecords);
}

function resolvedEndpointAtTangentialCoordinate(
  endpoint: JourneyMapResolvedEndpoint,
  indexedNode: IndexedJourneyNode,
  coordinate: number
): JourneyMapResolvedEndpoint | undefined {
  if (endpoint.side === "east" || endpoint.side === "west") {
    if (coordinate <= indexedNode.node.y || coordinate >= indexedNode.node.y + indexedNode.node.height) {
      return undefined;
    }
    return {
      ...endpoint,
      y: roundMetric(coordinate),
      offset: roundMetric(coordinate - indexedNode.node.y)
    };
  }
  if (coordinate <= indexedNode.node.x || coordinate >= indexedNode.node.x + indexedNode.node.width) {
    return undefined;
  }
  return {
    ...endpoint,
    x: roundMetric(coordinate),
    offset: roundMetric(coordinate - indexedNode.node.x)
  };
}

function reconstructRouteFromResolvedRuns(
  route: PositionedRoute,
  runs: readonly JourneyMapRouteSegmentRun[],
  segmentCoordinates: readonly JourneyMapResolvedSegmentCoordinate[],
  sourceEndpoint: JourneyMapResolvedEndpoint,
  targetEndpoint: JourneyMapResolvedEndpoint
): PositionedRoute | undefined {
  if (runs.length === 0 || runs.length !== segmentCoordinates.length) {
    return undefined;
  }
  const coordinateByRunIndex = new Map(
    segmentCoordinates.map((entry) => [entry.segmentRunIndex, entry.resolvedCoordinate] as const)
  );
  const points: Point[] = [
    { x: sourceEndpoint.x, y: sourceEndpoint.y }
  ];
  for (let index = 1; index < runs.length; index += 1) {
    const previous = runs[index - 1]!;
    const current = runs[index]!;
    const previousCoordinate = coordinateByRunIndex.get(previous.segmentRunIndex);
    const currentCoordinate = coordinateByRunIndex.get(current.segmentRunIndex);
    if (previousCoordinate === undefined
      || currentCoordinate === undefined
      || previous.axis === current.axis) {
      return undefined;
    }
    points.push(previous.axis === "horizontal"
      ? { x: currentCoordinate, y: previousCoordinate }
      : { x: previousCoordinate, y: currentCoordinate });
  }
  points.push({ x: targetEndpoint.x, y: targetEndpoint.y });
  return {
    style: route.style,
    points: collapseRoutePoints(points.map((point) => ({
      x: roundMetric(point.x),
      y: roundMetric(point.y)
    })))
  };
}

function buildInitialResolvedConnectorState(
  plan: JourneyMapConnectorPlan,
  index: JourneyMapPositionedIndex
): JourneyMapResolvedConnectorState {
  const runs = buildJourneyMapRouteSegmentRuns(plan.provisionalRoute);
  let sourceEndpoint = structuredClone(plan.sourceEndpoint);
  let targetEndpoint = structuredClone(plan.targetEndpoint);
  const duplicateTrack = plan.duplicateFan?.nominalCoordinate;
  if (duplicateTrack !== undefined) {
    const source = index.nodeById.get(plan.from);
    const target = index.nodeById.get(plan.to);
    const resolvedSource = source
      ? resolvedEndpointAtTangentialCoordinate(sourceEndpoint, source, duplicateTrack)
      : undefined;
    const resolvedTarget = target
      ? resolvedEndpointAtTangentialCoordinate(targetEndpoint, target, duplicateTrack)
      : undefined;
    if (resolvedSource && resolvedTarget) {
      sourceEndpoint = resolvedSource;
      targetEndpoint = resolvedTarget;
    }
  }
  const segmentCoordinates = runs.map((run): JourneyMapResolvedSegmentCoordinate => ({
    segmentRunIndex: run.segmentRunIndex,
    axis: run.axis,
    nominalCoordinate: run.coordinate,
    resolvedCoordinate: duplicateTrack !== undefined && run.axis === "horizontal"
      ? roundMetric(duplicateTrack)
      : run.coordinate
  }));
  const reconstructed = duplicateTrack === undefined
    ? undefined
    : reconstructRouteFromResolvedRuns(
      plan.provisionalRoute,
      runs,
      segmentCoordinates,
      sourceEndpoint,
      targetEndpoint
    );
  const preparedRoute = reconstructed ?? structuredClone(plan.provisionalRoute);
  return {
    connectorId: plan.id,
    sourceEndpoint,
    targetEndpoint,
    stageGates: structuredClone(plan.stageGates),
    segmentCoordinates,
    preparedRoute,
    finalRoute: structuredClone(preparedRoute)
  };
}

function tangentialCoordinateForSide(point: Point, side: PortSide): number {
  return side === "east" || side === "west" ? point.y : point.x;
}

function preparedStemCoordinate(
  route: PositionedRoute,
  endpointRole: JourneyMapEndpointRole,
  side: PortSide
): number {
  const segmentDetails = routeSegments(route);
  const tangentialAxis: JourneyMapOccupancyAxis = side === "east" || side === "west"
    ? "vertical"
    : "horizontal";
  const ordered = endpointRole === "source" ? segmentDetails : [...segmentDetails].reverse();
  const segment = ordered.find(({ start, end }) =>
    tangentialAxis === "vertical" ? start.x === end.x : start.y === end.y
  );
  if (!segment) {
    const endpoint = endpointRole === "source" ? route.points[0] : route.points.at(-1);
    return endpoint ? tangentialCoordinateForSide(endpoint, side) : 0;
  }
  const point = endpointRole === "source" ? segment.end : segment.start;
  return tangentialCoordinateForSide(point, side);
}

function getBucketListsForSide(
  buckets: JourneyMapNodeEdgeBuckets,
  side: PortSide
): JourneyMapNodeEdgeBucketLists {
  return buckets[side];
}

interface JourneyMapEndpointOffsetAssignment {
  source?: number;
  target?: number;
}

function buildLateEndpointOffsetAssignments(
  plans: readonly JourneyMapConnectorPlan[],
  states: readonly JourneyMapResolvedConnectorState[],
  index: JourneyMapPositionedIndex
): Map<string, JourneyMapEndpointOffsetAssignment> {
  const assignments = new Map<string, JourneyMapEndpointOffsetAssignment>();
  const planById = new Map(plans.map((plan) => [plan.id, plan] as const));
  const stateById = new Map(states.map((state) => [state.connectorId, state] as const));
  const buckets = buildNodeEdgeBuckets(plans, index);
  const compareConnectorIds = (
    leftId: string,
    rightId: string,
    endpointRole: JourneyMapEndpointRole,
    side: PortSide
  ): number => {
    const leftState = stateById.get(leftId);
    const rightState = stateById.get(rightId);
    const leftPlan = planById.get(leftId);
    const rightPlan = planById.get(rightId);
    if (!leftState || !rightState || !leftPlan || !rightPlan) {
      return leftId.localeCompare(rightId);
    }
    const leftCoordinate = preparedStemCoordinate(leftState.preparedRoute, endpointRole, side);
    const rightCoordinate = preparedStemCoordinate(rightState.preparedRoute, endpointRole, side);
    return Math.abs(leftCoordinate - rightCoordinate) > 0.001
      ? leftCoordinate - rightCoordinate
      : comparePriorities(leftPlan.priority, rightPlan.priority) || leftId.localeCompare(rightId);
  };

  for (const nodeBuckets of buckets) {
    const indexedNode = index.nodeById.get(nodeBuckets.nodeId);
    if (!indexedNode) {
      continue;
    }
    for (const side of ["north", "south", "east", "west"] as const) {
      const sideBuckets = getBucketListsForSide(nodeBuckets, side);
      const incoming = [...sideBuckets.endingConnectorIds].sort((left, right) =>
        compareConnectorIds(left, right, "target", side)
      );
      const outgoing = [...sideBuckets.startingConnectorIds].sort((left, right) =>
        compareConnectorIds(left, right, "source", side)
      );
      const count = incoming.length + outgoing.length;
      if (count <= 1) {
        continue;
      }
      const sideLength = side === "north" || side === "south"
        ? indexedNode.node.width
        : indexedNode.node.height;
      const available = sideLength - JOURNEY_MAP_TRACK_SEPARATION;
      const required = (count - 1) * JOURNEY_MAP_TRACK_SEPARATION;
      if (required > available + 0.001) {
        const inset = JOURNEY_MAP_TRACK_SEPARATION / 4;
        const usable = sideLength - inset * 2;
        const spacing = count > 1 ? usable / (count - 1) : 0;
        const sideStart = side === "north" || side === "south"
          ? indexedNode.node.x
          : indexedNode.node.y;
        const orderedClaims = [
          ...outgoing.map((connectorId) => ({ connectorId, endpointRole: "source" as const })),
          ...incoming.map((connectorId) => ({ connectorId, endpointRole: "target" as const }))
        ];
        orderedClaims.forEach((claim, ordinal) => {
          const assignment = assignments.get(claim.connectorId) ?? {};
          assignment[claim.endpointRole] = roundMetric(sideStart + inset + ordinal * spacing);
          assignments.set(claim.connectorId, assignment);
        });
        continue;
      }
      const baseCoordinate = side === "north" || side === "south"
        ? indexedNode.node.x + indexedNode.node.width / 2
        : indexedNode.node.y + indexedNode.node.height / 2;
      if (incoming.length > 0 && outgoing.length > 0) {
        outgoing.forEach((connectorId, ordinal) => {
          const assignment = assignments.get(connectorId) ?? {};
          assignment.source = roundMetric(baseCoordinate - ordinal * JOURNEY_MAP_TRACK_SEPARATION);
          assignments.set(connectorId, assignment);
        });
        incoming.forEach((connectorId, ordinal) => {
          const assignment = assignments.get(connectorId) ?? {};
          assignment.target = roundMetric(baseCoordinate + (ordinal + 1) * JOURNEY_MAP_TRACK_SEPARATION);
          assignments.set(connectorId, assignment);
        });
        continue;
      }
      const connectorIds = incoming.length > 0 ? incoming : outgoing;
      connectorIds.forEach((connectorId, ordinal) => {
        const delta = (ordinal - (connectorIds.length - 1) / 2) * JOURNEY_MAP_TRACK_SEPARATION;
        const assignment = assignments.get(connectorId) ?? {};
        if (incoming.length > 0) {
          assignment.target = roundMetric(baseCoordinate + delta);
        } else {
          assignment.source = roundMetric(baseCoordinate + delta);
        }
        assignments.set(connectorId, assignment);
      });
    }
  }
  return assignments;
}

function rebuildStateWithLateEndpoints(
  plan: JourneyMapConnectorPlan,
  state: JourneyMapResolvedConnectorState,
  index: JourneyMapPositionedIndex,
  assignment: JourneyMapEndpointOffsetAssignment | undefined
): JourneyMapResolvedConnectorState {
  const sourceNode = index.nodeById.get(plan.from);
  const targetNode = index.nodeById.get(plan.to);
  const sourceEndpoint = assignment?.source !== undefined && sourceNode
    ? (resolvedEndpointAtTangentialCoordinate(
      state.sourceEndpoint,
      sourceNode,
      assignment.source
    ) ?? structuredClone(state.sourceEndpoint))
    : structuredClone(state.sourceEndpoint);
  const targetEndpoint = assignment?.target !== undefined && targetNode
    ? (resolvedEndpointAtTangentialCoordinate(
      state.targetEndpoint,
      targetNode,
      assignment.target
    ) ?? structuredClone(state.targetEndpoint))
    : structuredClone(state.targetEndpoint);
  const runs = buildJourneyMapRouteSegmentRuns(plan.provisionalRoute);
  let segmentCoordinates = structuredClone(state.segmentCoordinates);
  const firstRun = runs[0];
  const lastRun = runs.at(-1);
  const sourceCoordinate = tangentialCoordinateForSide(sourceEndpoint, sourceEndpoint.side);
  const targetCoordinate = tangentialCoordinateForSide(targetEndpoint, targetEndpoint.side);
  if (firstRun && isNormalRunForSide(firstRun, sourceEndpoint.side)) {
    const segment = segmentCoordinates.find((entry) => entry.segmentRunIndex === firstRun.segmentRunIndex);
    if (segment) {
      segment.resolvedCoordinate = roundMetric(sourceCoordinate);
    }
  }
  if (lastRun && isNormalRunForSide(lastRun, targetEndpoint.side)) {
    const segment = segmentCoordinates.find((entry) => entry.segmentRunIndex === lastRun.segmentRunIndex);
    if (segment && firstRun?.segmentRunIndex !== lastRun.segmentRunIndex) {
      segment.resolvedCoordinate = roundMetric(targetCoordinate);
    }
  }

  let preparedRoute: PositionedRoute | undefined;
  if (runs.length === 1
    && firstRun
    && Math.abs(sourceCoordinate - targetCoordinate) > 0.001) {
    if (firstRun.axis === "horizontal") {
      const bridge = roundMetric((sourceEndpoint.x + targetEndpoint.x) / 2);
      preparedRoute = {
        style: plan.provisionalRoute.style,
        points: collapseRoutePoints([
          { x: sourceEndpoint.x, y: sourceEndpoint.y },
          { x: bridge, y: sourceEndpoint.y },
          { x: bridge, y: targetEndpoint.y },
          { x: targetEndpoint.x, y: targetEndpoint.y }
        ])
      };
      segmentCoordinates = [
        { segmentRunIndex: 0, axis: "horizontal", nominalCoordinate: firstRun.coordinate, resolvedCoordinate: sourceEndpoint.y },
        { segmentRunIndex: 1, axis: "vertical", nominalCoordinate: bridge, resolvedCoordinate: bridge },
        { segmentRunIndex: 2, axis: "horizontal", nominalCoordinate: firstRun.coordinate, resolvedCoordinate: targetEndpoint.y }
      ];
    } else {
      const bridge = roundMetric((sourceEndpoint.y + targetEndpoint.y) / 2);
      preparedRoute = {
        style: plan.provisionalRoute.style,
        points: collapseRoutePoints([
          { x: sourceEndpoint.x, y: sourceEndpoint.y },
          { x: sourceEndpoint.x, y: bridge },
          { x: targetEndpoint.x, y: bridge },
          { x: targetEndpoint.x, y: targetEndpoint.y }
        ])
      };
      segmentCoordinates = [
        { segmentRunIndex: 0, axis: "vertical", nominalCoordinate: firstRun.coordinate, resolvedCoordinate: sourceEndpoint.x },
        { segmentRunIndex: 1, axis: "horizontal", nominalCoordinate: bridge, resolvedCoordinate: bridge },
        { segmentRunIndex: 2, axis: "vertical", nominalCoordinate: firstRun.coordinate, resolvedCoordinate: targetEndpoint.x }
      ];
    }
  } else {
    preparedRoute = reconstructRouteFromResolvedRuns(
      plan.provisionalRoute,
      runs,
      segmentCoordinates,
      sourceEndpoint,
      targetEndpoint
    );
  }
  const resolvedRoute = preparedRoute ?? structuredClone(state.preparedRoute);
  const canonicalSegmentCoordinates = buildJourneyMapRouteSegmentRuns(resolvedRoute).map((run) => {
    const prior = segmentCoordinates.find((coordinate) =>
      coordinate.segmentRunIndex === run.segmentRunIndex && coordinate.axis === run.axis
    ) ?? segmentCoordinates.find((coordinate) =>
      coordinate.axis === run.axis
      && Math.abs(coordinate.resolvedCoordinate - run.coordinate) <= 0.001
    );
    return {
      segmentRunIndex: run.segmentRunIndex,
      axis: run.axis,
      nominalCoordinate: prior?.nominalCoordinate ?? run.coordinate,
      resolvedCoordinate: run.coordinate
    };
  });
  return {
    ...structuredClone(state),
    sourceEndpoint,
    targetEndpoint,
    segmentCoordinates: canonicalSegmentCoordinates,
    preparedRoute: resolvedRoute,
    finalRoute: structuredClone(resolvedRoute)
  };
}

function applyLateEndpointOrdering(
  plans: readonly JourneyMapConnectorPlan[],
  states: readonly JourneyMapResolvedConnectorState[],
  index: JourneyMapPositionedIndex
): JourneyMapResolvedConnectorState[] {
  const assignmentByConnectorId = buildLateEndpointOffsetAssignments(plans, states, index);
  const stateById = new Map(states.map((state) => [state.connectorId, state] as const));
  return plans.flatMap((plan) => {
    const state = stateById.get(plan.id);
    return state
      ? [rebuildStateWithLateEndpoints(plan, state, index, assignmentByConnectorId.get(plan.id))]
      : [];
  });
}

function simpleReciprocalGroups(
  plans: readonly JourneyMapConnectorPlan[]
): JourneyMapConnectorPlan[][] {
  const grouped = new Map<string, JourneyMapConnectorPlan[]>();
  for (const plan of plans) {
    const component = plan.cycleComponent;
    if (component?.componentKind !== "simple_reciprocal") {
      continue;
    }
    grouped.set(component.componentId, [...(grouped.get(component.componentId) ?? []), plan]);
  }
  return [...grouped.values()]
    .filter((group) => group.length === 2)
    .map((group) => [...group].sort((left, right) => comparePriorities(left.priority, right.priority)))
    .sort((left, right) => left[0]!.priority.edgeId.localeCompare(right[0]!.priority.edgeId));
}

function resolveSimpleReciprocalTracks(
  plans: readonly JourneyMapConnectorPlan[],
  states: readonly JourneyMapResolvedConnectorState[],
  index: JourneyMapPositionedIndex
): JourneyMapPreparedStemResolution {
  const stateById = new Map(states.map((state) => [state.connectorId, state] as const));
  const resolvedById = new Map(states.map((state) => [state.connectorId, structuredClone(state)] as const));
  const expansionByStageId = new Map<string, JourneyMapExpansionRequest>();

  for (const [inner, outer] of simpleReciprocalGroups(plans)) {
    const innerState = stateById.get(inner.id);
    const outerState = stateById.get(outer.id);
    const innerBypass = inner.stageLocalBypass;
    const outerBypass = outer.stageLocalBypass;
    if (!innerState || !outerState || !innerBypass || !outerBypass
      || inner.ownerContainerId !== outer.ownerContainerId
      || innerBypass.stageId !== outerBypass.stageId
      || innerBypass.axis !== "horizontal"
      || outerBypass.axis !== "horizontal"
      || !spansOverlap(innerBypass.span, outerBypass.span)
      || Math.abs(innerBypass.nominalCoordinate - outerBypass.nominalCoordinate) > 0.001) {
      continue;
    }
    const runs = buildJourneyMapRouteSegmentRuns(outer.provisionalRoute);
    const trackRun = runs.find((run) => run.axis === "horizontal"
      && Math.abs(run.coordinate - outerBypass.nominalCoordinate) <= 0.001
      && spansOverlap(run.span, outerBypass.span));
    if (!trackRun) {
      continue;
    }
    const segmentCoordinates = structuredClone(outerState.segmentCoordinates);
    const trackCoordinate = segmentCoordinates.find((entry) =>
      entry.segmentRunIndex === trackRun.segmentRunIndex && entry.axis === "horizontal"
    );
    if (!trackCoordinate) {
      continue;
    }
    trackCoordinate.resolvedCoordinate = roundMetric(
      innerBypass.nominalCoordinate + JOURNEY_MAP_TRACK_SEPARATION
    );
    const preparedRoute = reconstructRouteFromResolvedRuns(
      outer.provisionalRoute,
      runs,
      segmentCoordinates,
      outerState.sourceEndpoint,
      outerState.targetEndpoint
    );
    if (preparedRoute) {
      resolvedById.set(outer.id, {
        ...structuredClone(outerState),
        segmentCoordinates,
        preparedRoute,
        finalRoute: structuredClone(preparedRoute)
      });
    }

    const stage = index.stageById.get(outerBypass.stageId);
    if (!stage) {
      continue;
    }
    const stageBottom = stage.stage.y + stage.stage.height;
    const minimumAcceptedMargin = JOURNEY_MAP_TRACK_SEPARATION / 2;
    const deficit = trackCoordinate.resolvedCoordinate + minimumAcceptedMargin - stageBottom;
    if (deficit > 0.001) {
      expansionByStageId.set(stage.stage.id, {
        kind: "stage_bypass_gutter",
        stageId: stage.stage.id,
        amount: roundedExpansionAmount(deficit)
      });
    }
  }

  return {
    resolvedConnectors: plans.flatMap((plan) => {
      const state = resolvedById.get(plan.id);
      return state ? [state] : [];
    }),
    expansionRequests: [...expansionByStageId.values()].sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right))
    )
  };
}

function applySimpleReciprocalEndpointOrdering(
  plans: readonly JourneyMapConnectorPlan[],
  states: readonly JourneyMapResolvedConnectorState[],
  index: JourneyMapPositionedIndex
): JourneyMapResolvedConnectorState[] {
  const stateById = new Map(states.map((state) => [state.connectorId, state] as const));
  for (const [inner, outer] of simpleReciprocalGroups(plans)) {
    const innerSource = index.nodeById.get(inner.from);
    const innerTarget = index.nodeById.get(inner.to);
    const innerState = stateById.get(inner.id);
    const outerState = stateById.get(outer.id);
    if (!innerSource || !innerTarget || !innerState || !outerState
      || inner.sourceEndpoint.side !== "south"
      || inner.targetEndpoint.side !== "south"
      || outer.sourceEndpoint.side !== "south"
      || outer.targetEndpoint.side !== "south"
      || innerSource.node.x >= innerTarget.node.x
      || outer.from !== inner.to
      || outer.to !== inner.from) {
      continue;
    }
    const leftBase = roundMetric(innerSource.node.x + innerSource.node.width / 2);
    const rightBase = roundMetric(innerTarget.node.x + innerTarget.node.width / 2);
    stateById.set(inner.id, rebuildStateWithLateEndpoints(
      inner,
      innerState,
      index,
      { source: leftBase + JOURNEY_MAP_TRACK_SEPARATION, target: rightBase }
    ));
    stateById.set(outer.id, rebuildStateWithLateEndpoints(
      outer,
      outerState,
      index,
      { source: rightBase + JOURNEY_MAP_TRACK_SEPARATION, target: leftBase }
    ));
  }
  return plans.flatMap((plan) => {
    const state = stateById.get(plan.id);
    return state ? [state] : [];
  });
}

type JourneyMapResolvableTrackResource = Extract<JourneyMapOccupancyResource, {
  kind: "stage_local_bypass"
    | "inter_root_item_gutter"
    | "root_outer_bypass"
    | "obstacle_swerve";
}>;

interface JourneyMapTrackOccupancyClaim {
  connectorId: string;
  resource: JourneyMapResolvableTrackResource;
  resourceKey: string;
  segmentRunIndex: number;
  axis: JourneyMapOccupancyAxis;
  nominalCoordinate: number;
  currentCoordinate: number;
  span: { start: number; end: number };
  priority: JourneyMapRoutePriority;
}

interface JourneyMapTrackOccupancyResolution {
  resolvedConnectors: JourneyMapResolvedConnectorState[];
  expansionRequests: JourneyMapExpansionRequest[];
}

function isResolvableTrackResource(
  resource: JourneyMapOccupancyResource
): resource is JourneyMapResolvableTrackResource {
  return resource.kind === "stage_local_bypass"
    || resource.kind === "inter_root_item_gutter"
    || resource.kind === "root_outer_bypass"
    || resource.kind === "obstacle_swerve";
}

function trackLaneOffset(
  resource: JourneyMapResolvableTrackResource,
  lane: number
): number {
  if (resource.kind === "stage_local_bypass" || resource.kind === "root_outer_bypass") {
    return lane;
  }
  if (lane === 0) {
    return 0;
  }
  const magnitude = Math.ceil(lane / 2);
  return lane % 2 === 1 ? -magnitude : magnitude;
}

function matchingPreparedRun(
  record: JourneyMapOccupancyRecord,
  state: JourneyMapResolvedConnectorState
): JourneyMapRouteSegmentRun | undefined {
  const runs = buildJourneyMapRouteSegmentRuns(state.preparedRoute);
  const indexed = runs[record.segmentRunIndex];
  if (indexed?.axis === record.axis) {
    return indexed;
  }
  return runs.find((run) => run.axis === record.axis
    && Math.abs(run.coordinate - record.nominalCoordinate) <= 0.001
    && spansOverlap(run.span, record.span));
}

function directRootItem(
  root: PositionedContainer,
  itemId: string | undefined
): PositionedItem | undefined {
  return itemId ? root.children.find((item) => item.id === itemId) : undefined;
}

function physicalTrackResource(
  resource: JourneyMapResolvableTrackResource,
  positionedScene: PositionedScene
): JourneyMapResolvableTrackResource | undefined {
  if (resource.kind === "inter_root_item_gutter") {
    return resource.beforeRootItemId && resource.afterRootItemId ? resource : undefined;
  }
  if (resource.kind !== "obstacle_swerve") {
    return resource;
  }
  const obstacle = directRootItem(positionedScene.root, resource.obstacleItemId);
  const obstacleOrder = obstacle ? rootOrderOf(obstacle) : undefined;
  if (!obstacle || obstacleOrder === undefined
    || (resource.side !== "west" && resource.side !== "east")) {
    return resource;
  }
  const adjacentOrder = resource.side === "west" ? obstacleOrder - 1 : obstacleOrder + 1;
  const adjacent = positionedScene.root.children.find((item) =>
    rootOrderOf(item) === adjacentOrder
  );
  if (!adjacent) {
    return resource;
  }
  return resource.side === "west"
    ? {
      kind: "inter_root_item_gutter",
      beforeRootItemId: adjacent.id,
      afterRootItemId: obstacle.id
    }
    : {
      kind: "inter_root_item_gutter",
      beforeRootItemId: obstacle.id,
      afterRootItemId: adjacent.id
    };
}

function expansionForResolvedTrackGroup(
  claims: readonly JourneyMapTrackOccupancyClaim[],
  resolvedCoordinates: readonly number[],
  positionedScene: PositionedScene,
  index: JourneyMapPositionedIndex
): JourneyMapExpansionRequest | undefined {
  const first = claims[0];
  if (!first || claims.length !== resolvedCoordinates.length) {
    return undefined;
  }
  const minimum = Math.min(...resolvedCoordinates);
  const maximum = Math.max(...resolvedCoordinates);
  const resource = first.resource;
  if (resource.kind === "stage_local_bypass") {
    const stage = index.stageById.get(resource.stageId);
    if (!stage) {
      return undefined;
    }
    const stageBottom = stage.stage.y + stage.stage.height;
    const retainedMargin = JOURNEY_MAP_TRACK_SEPARATION / 2;
    const deficit = maximum + retainedMargin - stageBottom;
    return deficit > 0.001 ? {
      kind: "stage_bypass_gutter",
      stageId: stage.stage.id,
      amount: roundedExpansionAmount(deficit)
    } : undefined;
  }
  if (resource.kind === "root_outer_bypass") {
    const rootBottom = positionedScene.root.y + positionedScene.root.height;
    const retainedMargin = MIN_ARROW_MARKER_LEG + JOURNEY_MAP_TRACK_SEPARATION / 2;
    const deficit = maximum + retainedMargin - rootBottom;
    return deficit > 0.001 ? {
      kind: "root_outer_gutter",
      ownerContainerId: positionedScene.root.id,
      amount: roundedExpansionAmount(deficit)
    } : undefined;
  }
  if (resource.kind === "inter_root_item_gutter") {
    const before = directRootItem(positionedScene.root, resource.beforeRootItemId);
    const after = directRootItem(positionedScene.root, resource.afterRootItemId);
    const beforeOrder = before ? rootOrderOf(before) : undefined;
    if (!before || !after || beforeOrder === undefined) {
      return undefined;
    }
    const leftDeficit = before.x + before.width + MIN_ARROW_MARKER_LEG - minimum;
    const rightDeficit = maximum + MIN_ARROW_MARKER_LEG - after.x;
    const deficit = Math.max(leftDeficit, rightDeficit) * 2;
    return deficit > 0.001 ? {
      kind: "root_item_gap",
      afterRootOrder: beforeOrder,
      amount: roundedExpansionAmount(deficit)
    } : undefined;
  }

  const obstacleNode = index.nodeById.get(resource.obstacleItemId);
  if (obstacleNode?.metadata.stageId !== undefined
    && obstacleNode.metadata.stepOrder !== undefined) {
    const stage = index.stageById.get(obstacleNode.metadata.stageId);
    const stepOrder = obstacleNode.metadata.stepOrder;
    if (!stage) {
      return undefined;
    }
    if (resource.side === "west" && stepOrder > 0) {
      const previousId = stage.stepIds[stepOrder - 1];
      const previous = previousId ? index.nodeById.get(previousId) : undefined;
      const previousRight = previous ? previous.node.x + previous.node.width : undefined;
      const leftDeficit = previousRight === undefined
        ? Number.NEGATIVE_INFINITY
        : previousRight + MIN_ARROW_MARKER_LEG - minimum;
      const rightDeficit = maximum + MIN_ARROW_MARKER_LEG - obstacleNode.node.x;
      const deficit = Math.max(leftDeficit, rightDeficit) * 2;
      return deficit > 0.001 ? {
        kind: "stage_step_gap",
        stageId: stage.stage.id,
        afterStepOrder: stepOrder - 1,
        amount: roundedExpansionAmount(deficit)
      } : undefined;
    }
    if (resource.side === "east" && stepOrder < stage.stepIds.length - 1) {
      const nextId = stage.stepIds[stepOrder + 1];
      const next = nextId ? index.nodeById.get(nextId) : undefined;
      const leftDeficit = obstacleNode.node.x + obstacleNode.node.width
        + MIN_ARROW_MARKER_LEG - minimum;
      const rightDeficit = next
        ? maximum + MIN_ARROW_MARKER_LEG - next.node.x
        : Number.NEGATIVE_INFINITY;
      const deficit = Math.max(leftDeficit, rightDeficit) * 2;
      return deficit > 0.001 ? {
        kind: "stage_step_gap",
        stageId: stage.stage.id,
        afterStepOrder: stepOrder,
        amount: roundedExpansionAmount(deficit)
      } : undefined;
    }
    return undefined;
  }

  const obstacle = directRootItem(positionedScene.root, resource.obstacleItemId);
  const obstacleOrder = obstacle ? rootOrderOf(obstacle) : undefined;
  if (!obstacle || obstacleOrder === undefined) {
    return undefined;
  }
  if (resource.side === "west" && obstacleOrder > 0) {
    const previous = positionedScene.root.children.find((item) =>
      rootOrderOf(item) === obstacleOrder - 1
    );
    const previousRight = previous ? previous.x + previous.width : undefined;
    const leftDeficit = previousRight === undefined
      ? Number.NEGATIVE_INFINITY
      : previousRight + MIN_ARROW_MARKER_LEG - minimum;
    const rightDeficit = maximum + MIN_ARROW_MARKER_LEG - obstacle.x;
    const deficit = Math.max(leftDeficit, rightDeficit) * 2;
    return deficit > 0.001 ? {
      kind: "root_item_gap",
      afterRootOrder: obstacleOrder - 1,
      amount: roundedExpansionAmount(deficit)
    } : undefined;
  }
  if (resource.side === "east") {
    const next = positionedScene.root.children.find((item) =>
      rootOrderOf(item) === obstacleOrder + 1
    );
    const leftDeficit = obstacle.x + obstacle.width + MIN_ARROW_MARKER_LEG - minimum;
    const rightDeficit = next
      ? maximum + MIN_ARROW_MARKER_LEG - next.x
      : Number.NEGATIVE_INFINITY;
    const deficit = Math.max(leftDeficit, rightDeficit) * 2;
    return deficit > 0.001 ? {
      kind: "root_item_gap",
      afterRootOrder: obstacleOrder,
      amount: roundedExpansionAmount(deficit)
    } : undefined;
  }
  return undefined;
}

function resolveJourneyMapTrackOccupancy(
  plans: readonly JourneyMapConnectorPlan[],
  states: readonly JourneyMapResolvedConnectorState[],
  nominalOccupancy: readonly JourneyMapOccupancyRecord[],
  positionedScene: PositionedScene,
  index: JourneyMapPositionedIndex
): JourneyMapTrackOccupancyResolution {
  const stateById = new Map(states.map((state) => [state.connectorId, state] as const));
  const claimsByResource = new Map<string, JourneyMapTrackOccupancyClaim[]>();
  const seenClaims = new Set<string>();
  for (const record of nominalOccupancy) {
    if (!isResolvableTrackResource(record.resource)) {
      continue;
    }
    const physicalResource = physicalTrackResource(record.resource, positionedScene);
    if (!physicalResource) {
      continue;
    }
    const state = stateById.get(record.connectorId);
    const run = state ? matchingPreparedRun(record, state) : undefined;
    if (!state || !run) {
      continue;
    }
    const identity = `${record.connectorId}|${record.resourceKey}|${run.segmentRunIndex}`;
    if (seenClaims.has(identity)) {
      continue;
    }
    seenClaims.add(identity);
    const storedCoordinate = state.segmentCoordinates.find((coordinate) =>
      coordinate.segmentRunIndex === run.segmentRunIndex && coordinate.axis === run.axis
    );
    const claim: JourneyMapTrackOccupancyClaim = {
      connectorId: record.connectorId,
      resource: structuredClone(physicalResource),
      resourceKey: occupancyResourceKey(record.ownerContainerId, physicalResource),
      segmentRunIndex: run.segmentRunIndex,
      axis: run.axis,
      nominalCoordinate: record.nominalCoordinate,
      currentCoordinate: storedCoordinate?.resolvedCoordinate ?? run.coordinate,
      span: { ...run.span },
      priority: { ...record.priority }
    };
    const groupKey = `${claim.resourceKey}|${run.axis}`;
    claimsByResource.set(groupKey, [...(claimsByResource.get(groupKey) ?? []), claim]);
  }

  const resolvedCoordinateByClaim = new Map<string, number>();
  const expansionRequests: JourneyMapExpansionRequest[] = [];
  for (const claims of claimsByResource.values()) {
    const ordered = [...claims].sort((left, right) =>
      comparePriorities(left.priority, right.priority)
      || left.segmentRunIndex - right.segmentRunIndex
      || left.connectorId.localeCompare(right.connectorId)
    );
    const assigned: Array<{ claim: JourneyMapTrackOccupancyClaim; coordinate: number }> = [];
    for (const claim of ordered) {
      const conflictsAt = (coordinate: number): boolean => assigned.some((entry) =>
        spansOverlap(claim.span, entry.claim.span)
        && Math.abs(coordinate - entry.coordinate) < JOURNEY_MAP_TRACK_SEPARATION - 0.001
      );
      let coordinate = claim.currentCoordinate;
      if (conflictsAt(coordinate)) {
        for (let lane = 0; lane <= ordered.length; lane += 1) {
          const candidate = roundMetric(
            claim.nominalCoordinate
              + trackLaneOffset(claim.resource, lane) * JOURNEY_MAP_TRACK_SEPARATION
          );
          if (!conflictsAt(candidate)) {
            coordinate = candidate;
            break;
          }
        }
      }
      assigned.push({ claim, coordinate });
      resolvedCoordinateByClaim.set(
        `${claim.connectorId}|${claim.segmentRunIndex}|${claim.axis}`,
        coordinate
      );
    }
    if (assigned.some((entry) =>
      Math.abs(entry.coordinate - entry.claim.currentCoordinate) > 0.001
    )) {
      const expansion = expansionForResolvedTrackGroup(
        assigned.map((entry) => entry.claim),
        assigned.map((entry) => entry.coordinate),
        positionedScene,
        index
      );
      if (expansion) {
        expansionRequests.push(expansion);
      }
    }
  }

  const resolvedConnectors = states.map((state) => {
    const runs = buildJourneyMapRouteSegmentRuns(state.preparedRoute);
    const segmentCoordinates = runs.map((run): JourneyMapResolvedSegmentCoordinate => ({
      segmentRunIndex: run.segmentRunIndex,
      axis: run.axis,
      nominalCoordinate: state.segmentCoordinates.find((coordinate) =>
        coordinate.segmentRunIndex === run.segmentRunIndex && coordinate.axis === run.axis
      )?.nominalCoordinate ?? run.coordinate,
      resolvedCoordinate: resolvedCoordinateByClaim.get(
        `${state.connectorId}|${run.segmentRunIndex}|${run.axis}`
      ) ?? state.segmentCoordinates.find((coordinate) =>
        coordinate.segmentRunIndex === run.segmentRunIndex && coordinate.axis === run.axis
      )?.resolvedCoordinate ?? run.coordinate
    }));
    const preparedRoute = reconstructRouteFromResolvedRuns(
      state.preparedRoute,
      runs,
      segmentCoordinates,
      state.sourceEndpoint,
      state.targetEndpoint
    );
    return preparedRoute ? {
      ...structuredClone(state),
      segmentCoordinates,
      preparedRoute,
      finalRoute: structuredClone(preparedRoute)
    } : structuredClone(state);
  });
  return { resolvedConnectors, expansionRequests };
}

interface JourneyMapPreparedStemClaim {
  connectorId: string;
  endpointRole: JourneyMapEndpointRole;
  nodeId: string;
  side: PortSide;
  segmentRunIndex: number;
  coordinate: number;
  span: { start: number; end: number };
}

interface JourneyMapPreparedStemResolution {
  resolvedConnectors: JourneyMapResolvedConnectorState[];
  expansionRequests: JourneyMapExpansionRequest[];
}

function preparedStemClaim(
  plan: JourneyMapConnectorPlan,
  state: JourneyMapResolvedConnectorState,
  endpointRole: JourneyMapEndpointRole
): JourneyMapPreparedStemClaim | undefined {
  const endpoint = endpointRole === "source" ? state.sourceEndpoint : state.targetEndpoint;
  const perpendicularAxis: JourneyMapOccupancyAxis = endpoint.side === "east" || endpoint.side === "west"
    ? "vertical"
    : "horizontal";
  const runs = buildJourneyMapRouteSegmentRuns(state.preparedRoute);
  const orderedRuns = endpointRole === "source" ? runs : [...runs].reverse();
  const run = orderedRuns.find((candidate) => candidate.axis === perpendicularAxis);
  return run ? {
    connectorId: plan.id,
    endpointRole,
    nodeId: endpoint.itemId,
    side: endpoint.side,
    segmentRunIndex: run.segmentRunIndex,
    coordinate: run.coordinate,
    span: { ...run.span }
  } : undefined;
}

function preparedStemClaimsConflict(
  left: JourneyMapPreparedStemClaim,
  right: JourneyMapPreparedStemClaim
): boolean {
  return left.connectorId !== right.connectorId
    && Math.abs(left.coordinate - right.coordinate) <= 0.001
    && spansOverlap(left.span, right.span);
}

function roundedExpansionAmount(deficit: number): number {
  return Math.ceil(deficit / JOURNEY_MAP_TRACK_SEPARATION) * JOURNEY_MAP_TRACK_SEPARATION;
}

function stageStepGapExpansionForClaims(
  claims: readonly JourneyMapPreparedStemClaim[],
  index: JourneyMapPositionedIndex
): JourneyMapExpansionRequest | undefined {
  const first = claims[0];
  if (!first) {
    return undefined;
  }
  const endpointNode = index.nodeById.get(first.nodeId);
  const stageId = endpointNode?.metadata.stageId;
  const endpointStepOrder = endpointNode?.metadata.stepOrder;
  const stage = stageId ? index.stageById.get(stageId) : undefined;
  if (!endpointNode || !stage || endpointStepOrder === undefined) {
    return undefined;
  }
  const requiredGap = MIN_ARROW_MARKER_LEG * 2
    + (claims.length - 1) * JOURNEY_MAP_TRACK_SEPARATION;
  if (first.endpointRole === "source" && first.side === "east"
    && endpointStepOrder < stage.stepIds.length - 1) {
    const nextStepId = stage.stepIds[endpointStepOrder + 1];
    const nextStep = nextStepId ? index.nodeById.get(nextStepId) : undefined;
    if (!nextStep) {
      return undefined;
    }
    const actualGap = nextStep.node.x - (endpointNode.node.x + endpointNode.node.width);
    const deficit = requiredGap - actualGap;
    return deficit > 0.001 ? {
      kind: "stage_step_gap",
      stageId: stage.stage.id,
      afterStepOrder: endpointStepOrder,
      amount: roundedExpansionAmount(deficit)
    } : undefined;
  }
  if (first.endpointRole !== "target" || first.side !== "west" || endpointStepOrder <= 0) {
    return undefined;
  }
  const precedingStepId = stage.stepIds[endpointStepOrder - 1];
  const precedingStep = precedingStepId ? index.nodeById.get(precedingStepId) : undefined;
  if (!precedingStep) {
    return undefined;
  }
  const actualGap = endpointNode.node.x - (precedingStep.node.x + precedingStep.node.width);
  const deficit = requiredGap - actualGap;
  return deficit > 0.001 ? {
    kind: "stage_step_gap",
    stageId: stage.stage.id,
    afterStepOrder: endpointStepOrder - 1,
    amount: roundedExpansionAmount(deficit)
  } : undefined;
}

function applyPreparedStemCoordinates(
  plans: readonly JourneyMapConnectorPlan[],
  states: readonly JourneyMapResolvedConnectorState[],
  claims: readonly JourneyMapPreparedStemClaim[]
): JourneyMapResolvedConnectorState[] {
  const planById = new Map(plans.map((plan) => [plan.id, plan] as const));
  const directDepartureRank = (claim: JourneyMapPreparedStemClaim): number => {
    const plan = planById.get(claim.connectorId);
    return claim.endpointRole === "source"
      && claim.side === "east"
      && (plan?.archetype === "adjacent_forward_same_stage"
        || plan?.archetype === "adjacent_forward_root_step"
        || plan?.archetype === "adjacent_forward_cross_stage"
        || plan?.archetype === "adjacent_forward_contained_to_root"
        || plan?.archetype === "adjacent_forward_root_to_contained")
      ? 1
      : 0;
  };
  const claimByConnectorId = new Map(
    [...claims]
      .sort((left, right) => {
        const leftPlan = planById.get(left.connectorId);
        const rightPlan = planById.get(right.connectorId);
        return directDepartureRank(left) - directDepartureRank(right)
          || (leftPlan && rightPlan
            ? comparePriorities(leftPlan.priority, rightPlan.priority)
            : left.connectorId.localeCompare(right.connectorId));
      })
      .map((claim, ordinal) => [claim.connectorId, { claim, ordinal }] as const)
  );
  return states.map((state) => {
    const assignment = claimByConnectorId.get(state.connectorId);
    if (!assignment) {
      return structuredClone(state);
    }
    const endpoint = assignment.claim.endpointRole === "source"
      ? state.sourceEndpoint
      : state.targetEndpoint;
    const normalCoordinate = normalCoordinateForSide(endpoint, endpoint.side);
    const direction = endpoint.side === "west" || endpoint.side === "north" ? -1 : 1;
    const resolvedStemCoordinate = roundMetric(
      normalCoordinate + direction * (
        MIN_ARROW_MARKER_LEG
        + assignment.ordinal * JOURNEY_MAP_TRACK_SEPARATION
      )
    );
    const runs = buildJourneyMapRouteSegmentRuns(state.preparedRoute);
    const segmentCoordinates = runs.map((run): JourneyMapResolvedSegmentCoordinate => ({
      segmentRunIndex: run.segmentRunIndex,
      axis: run.axis,
      nominalCoordinate: state.segmentCoordinates.find((coordinate) =>
        coordinate.segmentRunIndex === run.segmentRunIndex && coordinate.axis === run.axis
      )?.nominalCoordinate ?? run.coordinate,
      resolvedCoordinate: run.segmentRunIndex === assignment.claim.segmentRunIndex
        ? resolvedStemCoordinate
        : run.coordinate
    }));
    const finalRoute = reconstructRouteFromResolvedRuns(
      state.preparedRoute,
      runs,
      segmentCoordinates,
      state.sourceEndpoint,
      state.targetEndpoint
    );
    return finalRoute ? {
      ...structuredClone(state),
      segmentCoordinates,
      finalRoute
    } : structuredClone(state);
  });
}

function resolveCrowdedPreparedStems(
  plans: readonly JourneyMapConnectorPlan[],
  states: readonly JourneyMapResolvedConnectorState[],
  index: JourneyMapPositionedIndex
): JourneyMapPreparedStemResolution {
  const stateById = new Map(states.map((state) => [state.connectorId, state] as const));
  const grouped = new Map<string, JourneyMapPreparedStemClaim[]>();
  for (const plan of plans) {
    const state = stateById.get(plan.id);
    if (!state) {
      continue;
    }
    for (const endpointRole of ["source", "target"] as const) {
      const claim = preparedStemClaim(plan, state, endpointRole);
      if (!claim) {
        continue;
      }
      const key = `${claim.nodeId}:${claim.side}:${claim.endpointRole}`;
      grouped.set(key, [...(grouped.get(key) ?? []), claim]);
    }
  }

  let resolvedConnectors = states.map((state) => structuredClone(state));
  const expansionRequests: JourneyMapExpansionRequest[] = [];
  for (const claims of grouped.values()) {
    if (claims.length <= 1 || !claims.some((left, leftIndex) =>
      claims.some((right, rightIndex) => rightIndex > leftIndex
        && preparedStemClaimsConflict(left, right))
    )) {
      continue;
    }
    const expansion = stageStepGapExpansionForClaims(claims, index);
    if (expansion) {
      expansionRequests.push(expansion);
      continue;
    }
    resolvedConnectors = applyPreparedStemCoordinates(plans, resolvedConnectors, claims);
  }
  expansionRequests.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  return { resolvedConnectors, expansionRequests };
}

function positiveSpanOverlap(
  left: { start: number; end: number },
  right: { start: number; end: number }
): boolean {
  return Math.min(left.end, right.end) - Math.max(left.start, right.start) > 0.001;
}

function isAllowedOverloadedEndpointPair(
  leftState: JourneyMapResolvedConnectorState,
  leftRun: JourneyMapRouteSegmentRun,
  rightState: JourneyMapResolvedConnectorState,
  rightRun: JourneyMapRouteSegmentRun,
  states: readonly JourneyMapResolvedConnectorState[],
  index: JourneyMapPositionedIndex
): boolean {
  const endpointRole = leftRun.segmentRunIndex === 0 && rightRun.segmentRunIndex === 0
    ? "source"
    : leftRun.segmentRunIndex === buildJourneyMapRouteSegmentRuns(leftState.finalRoute).length - 1
        && rightRun.segmentRunIndex === buildJourneyMapRouteSegmentRuns(rightState.finalRoute).length - 1
      ? "target"
      : undefined;
  if (!endpointRole) {
    return false;
  }
  const leftEndpoint = endpointRole === "source" ? leftState.sourceEndpoint : leftState.targetEndpoint;
  const rightEndpoint = endpointRole === "source" ? rightState.sourceEndpoint : rightState.targetEndpoint;
  if (leftEndpoint.itemId !== rightEndpoint.itemId || leftEndpoint.side !== rightEndpoint.side) {
    return false;
  }
  const node = index.nodeById.get(leftEndpoint.itemId)?.node;
  if (!node) {
    return false;
  }
  const count = states.filter((state) => {
    const endpoint = endpointRole === "source" ? state.sourceEndpoint : state.targetEndpoint;
    return endpoint.itemId === leftEndpoint.itemId && endpoint.side === leftEndpoint.side;
  }).length;
  const sideLength = leftEndpoint.side === "north" || leftEndpoint.side === "south"
    ? node.width
    : node.height;
  return (count - 1) * JOURNEY_MAP_TRACK_SEPARATION
    > sideLength - JOURNEY_MAP_TRACK_SEPARATION + 0.001;
}

function routeSeparationConflictCount(
  connectorId: string,
  route: PositionedRoute,
  states: readonly JourneyMapResolvedConnectorState[],
  index: JourneyMapPositionedIndex
): number {
  const candidateState = states.find((state) => state.connectorId === connectorId);
  if (!candidateState) {
    return Number.POSITIVE_INFINITY;
  }
  const candidateRuns = buildJourneyMapRouteSegmentRuns(route);
  let conflicts = 0;
  for (const state of states) {
    if (state.connectorId === connectorId) {
      continue;
    }
    for (const left of candidateRuns) {
      for (const right of buildJourneyMapRouteSegmentRuns(state.finalRoute)) {
        if (left.axis !== right.axis
          || !positiveSpanOverlap(left.span, right.span)
          || Math.abs(left.coordinate - right.coordinate)
            >= JOURNEY_MAP_TRACK_SEPARATION - 0.001
          || isAllowedOverloadedEndpointPair(
            candidateState,
            left,
            state,
            right,
            states,
            index
          )) {
          continue;
        }
        conflicts += 1;
      }
    }
  }
  return conflicts;
}

function directDoglegWithBridge(
  state: JourneyMapResolvedConnectorState,
  axis: JourneyMapOccupancyAxis,
  bridge: number
): PositionedRoute {
  const source = state.sourceEndpoint;
  const target = state.targetEndpoint;
  return {
    style: state.finalRoute.style,
    points: collapseRoutePoints(axis === "horizontal"
      ? [
        { x: source.x, y: source.y },
        { x: bridge, y: source.y },
        { x: bridge, y: target.y },
        { x: target.x, y: target.y }
      ]
      : [
        { x: source.x, y: source.y },
        { x: source.x, y: bridge },
        { x: target.x, y: bridge },
        { x: target.x, y: target.y }
      ])
  };
}

function resolveLateDirectRunConflicts(
  plans: readonly JourneyMapConnectorPlan[],
  states: readonly JourneyMapResolvedConnectorState[],
  index: JourneyMapPositionedIndex
): JourneyMapResolvedConnectorState[] {
  const stateById = new Map(states.map((state) => [state.connectorId, state] as const));
  const resolved = states.map((state) => structuredClone(state));
  for (const plan of [...plans].sort((left, right) => comparePriorities(left.priority, right.priority))) {
    const state = stateById.get(plan.id);
    const nominalRuns = buildJourneyMapRouteSegmentRuns(plan.provisionalRoute);
    const finalRuns = state ? buildJourneyMapRouteSegmentRuns(state.finalRoute) : [];
    if (!state || nominalRuns.length !== 1 || finalRuns.length !== 3) {
      continue;
    }
    const axis = nominalRuns[0]!.axis;
    const currentBridge = finalRuns[1]!.coordinate;
    const direction = axis === "horizontal"
      ? Math.sign(state.targetEndpoint.x - state.sourceEndpoint.x)
      : Math.sign(state.targetEndpoint.y - state.sourceEndpoint.y);
    if (direction === 0) {
      continue;
    }
    const nearSource = axis === "horizontal"
      ? state.sourceEndpoint.x + direction * MIN_ARROW_MARKER_LEG
      : state.sourceEndpoint.y + direction * MIN_ARROW_MARKER_LEG;
    const nearTarget = axis === "horizontal"
      ? state.targetEndpoint.x - direction * MIN_ARROW_MARKER_LEG
      : state.targetEndpoint.y - direction * MIN_ARROW_MARKER_LEG;
    const candidates = [...new Set([currentBridge, roundMetric(nearSource), roundMetric(nearTarget)])]
      .map((bridge) => ({
        bridge,
        route: directDoglegWithBridge(state, axis, bridge)
      }))
      .map((candidate) => ({
        ...candidate,
        conflicts: routeSeparationConflictCount(plan.id, candidate.route, resolved, index)
      }))
      .sort((left, right) => left.conflicts - right.conflicts
        || Math.abs(left.bridge - currentBridge) - Math.abs(right.bridge - currentBridge)
        || left.bridge - right.bridge);
    const selected = candidates[0];
    const currentConflicts = routeSeparationConflictCount(plan.id, state.finalRoute, resolved, index);
    if (!selected || selected.conflicts >= currentConflicts) {
      continue;
    }
    const resolvedIndex = resolved.findIndex((candidate) => candidate.connectorId === plan.id);
    const selectedRuns = buildJourneyMapRouteSegmentRuns(selected.route);
    const nextState: JourneyMapResolvedConnectorState = {
      ...structuredClone(state),
      segmentCoordinates: selectedRuns.map((run) => ({
        segmentRunIndex: run.segmentRunIndex,
        axis: run.axis,
        nominalCoordinate: state.segmentCoordinates.find((coordinate) =>
          coordinate.segmentRunIndex === run.segmentRunIndex && coordinate.axis === run.axis
        )?.nominalCoordinate ?? finalRuns[run.segmentRunIndex]?.coordinate ?? run.coordinate,
        resolvedCoordinate: run.coordinate
      })),
      finalRoute: selected.route
    };
    if (resolvedIndex >= 0) {
      resolved[resolvedIndex] = nextState;
      stateById.set(plan.id, nextState);
    }
  }
  return resolved;
}

function shiftPositionedItemX(item: PositionedItem, amount: number): void {
  item.x = roundMetric(item.x + amount);
  if (item.kind === "node") {
    return;
  }
  item.children.forEach((child) => shiftPositionedItemX(child, amount));
}

function expansionRequestKey(request: JourneyMapExpansionRequest): string {
  switch (request.kind) {
    case "stage_step_gap":
      return `${request.kind}:${request.stageId}:${request.afterStepOrder}`;
    case "root_item_gap":
      return `${request.kind}:${request.afterRootOrder}`;
    case "stage_bypass_gutter":
      return `${request.kind}:${request.stageId}`;
    case "root_outer_gutter":
      return `${request.kind}:${request.ownerContainerId}`;
  }
}

function canonicalExpansionRequests(
  requests: readonly JourneyMapExpansionRequest[]
): JourneyMapExpansionRequest[] {
  const byKey = new Map<string, JourneyMapExpansionRequest>();
  for (const request of requests) {
    const key = expansionRequestKey(request);
    const existing = byKey.get(key);
    if (!existing || request.amount > existing.amount) {
      byKey.set(key, structuredClone(request));
    }
  }
  return [...byKey.values()].sort((left, right) =>
    expansionRequestKey(left).localeCompare(expansionRequestKey(right))
  );
}

function accumulatedExpansionRequests(
  applied: readonly JourneyMapExpansionRequest[],
  pending: readonly JourneyMapExpansionRequest[]
): JourneyMapExpansionRequest[] {
  const byKey = new Map<string, JourneyMapExpansionRequest>();
  for (const request of [...applied, ...pending]) {
    const key = expansionRequestKey(request);
    const existing = byKey.get(key);
    byKey.set(key, {
      ...structuredClone(request),
      amount: (existing?.amount ?? 0) + request.amount
    });
  }
  return [...byKey.values()].sort((left, right) =>
    expansionRequestKey(left).localeCompare(expansionRequestKey(right))
  );
}

export function validateJourneyMapExpansionBound(
  attempts: readonly JourneyMapExpansionAttempt[],
  pendingRequests: readonly JourneyMapExpansionRequest[]
): RendererDiagnostic[] {
  if (attempts.length < MAX_JOURNEY_MAP_EXPANSION_ATTEMPTS
    || pendingRequests.length === 0) {
    return [];
  }
  const ownerIds = [...new Set(pendingRequests.map((request) =>
    request.kind === "stage_step_gap" || request.kind === "stage_bypass_gutter"
      ? request.stageId
      : request.kind === "root_outer_gutter"
        ? request.ownerContainerId
        : `root-order:${request.afterRootOrder}`
  ))].sort((left, right) => left.localeCompare(right));
  return ownerIds.map((ownerId) => createRoutingDiagnostic(
    "renderer.routing.journey_map_gutter_expansion_exhausted",
    `Journey-map occupancy still requires gutter expansion after ${MAX_JOURNEY_MAP_EXPANSION_ATTEMPTS} attempts.`,
    ownerId,
    "warn",
    JSON.stringify({ relatedIds: [ownerId] })
  ));
}

function resolvedContractDiagnostic(
  message: string,
  targetId: string,
  relatedIds: readonly string[] = [targetId]
): RendererDiagnostic {
  return createRoutingDiagnostic(
    "renderer.routing.journey_map_archetype_fallback",
    message,
    targetId,
    "warn",
    JSON.stringify({ relatedIds })
  );
}

function resolvedPlansForFinalOccupancy(
  plans: readonly JourneyMapConnectorPlan[],
  states: readonly JourneyMapResolvedConnectorState[]
): JourneyMapConnectorPlan[] {
  const stateById = new Map(states.map((state) => [state.connectorId, state] as const));
  return plans.flatMap((plan) => {
    const state = stateById.get(plan.id);
    return state ? [{
      ...structuredClone(plan),
      sourceEndpoint: structuredClone(state.sourceEndpoint),
      targetEndpoint: structuredClone(state.targetEndpoint),
      stageGates: structuredClone(state.stageGates),
      provisionalRoute: structuredClone(state.finalRoute)
    }] : [];
  });
}

function compareResolvedOccupancyForValidation(
  left: JourneyMapOccupancyRecord,
  right: JourneyMapOccupancyRecord
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validateResolvedFinalGeometry(
  plans: readonly JourneyMapConnectorPlan[],
  states: readonly JourneyMapResolvedConnectorState[],
  finalPositionedScene: PositionedScene
): RendererDiagnostic[] {
  const diagnostics: RendererDiagnostic[] = [];
  const index = buildJourneyMapPositionedIndex(finalPositionedScene);
  const planById = new Map(plans.map((plan) => [plan.id, plan] as const));
  const edgeById = new Map(finalPositionedScene.edges.map((edge) => [edge.id, edge] as const));
  for (const state of states) {
    const plan = planById.get(state.connectorId);
    const edge = edgeById.get(state.connectorId);
    if (!plan || !edge) {
      diagnostics.push(createRoutingDiagnostic(
        "renderer.routing.journey_map_edge_omitted",
        `Resolved journey edge "${state.connectorId}" is missing its plan or final edge.`,
        state.connectorId,
        "error",
        JSON.stringify({ relatedIds: [state.connectorId] })
      ));
      continue;
    }
    const route = state.finalRoute;
    const routeRuns = buildJourneyMapRouteSegmentRuns(route);
    const routeParts = routeSegments(route);
    const source = index.nodeById.get(plan.from);
    const target = index.nodeById.get(plan.to);
    const first = route.points[0];
    const last = route.points.at(-1);
    if (!source || !target) {
      diagnostics.push(createRoutingDiagnostic(
        "renderer.routing.journey_map_unresolved_endpoint",
        `Resolved journey edge "${plan.id}" references a missing final endpoint.`,
        plan.id,
        "error",
        JSON.stringify({ relatedIds: [plan.id, !source ? plan.from : plan.to] })
      ));
      continue;
    }
    if (!first || !last
      || first.x !== state.sourceEndpoint.x || first.y !== state.sourceEndpoint.y
      || last.x !== state.targetEndpoint.x || last.y !== state.targetEndpoint.y
      || edge.from.x !== state.sourceEndpoint.x || edge.from.y !== state.sourceEndpoint.y
      || edge.to.x !== state.targetEndpoint.x || edge.to.y !== state.targetEndpoint.y) {
      pushGeometryDiagnostic(
        diagnostics,
        "renderer.routing.journey_map_endpoint_intrusion",
        `Resolved journey edge "${plan.id}" is disconnected from its stored endpoints.`,
        plan.id,
        [plan.id, plan.from, plan.to]
      );
    }
    if (routeParts.some(({ start, end }) => segmentLength(start, end) === undefined)) {
      pushGeometryDiagnostic(
        diagnostics,
        "renderer.routing.journey_map_non_orthogonal_route",
        `Resolved journey edge "${plan.id}" contains a non-orthogonal segment.`,
        plan.id,
        [plan.id]
      );
      continue;
    }
    if (!endpointIsOnExterior(state.sourceEndpoint, source.node)
      || !endpointIsOnExterior(state.targetEndpoint, target.node)
      || state.sourceEndpoint.itemId !== plan.sourceEndpoint.itemId
      || state.sourceEndpoint.portId !== plan.sourceEndpoint.portId
      || state.sourceEndpoint.side !== plan.sourceEndpoint.side
      || state.targetEndpoint.itemId !== plan.targetEndpoint.itemId
      || state.targetEndpoint.portId !== plan.targetEndpoint.portId
      || state.targetEndpoint.side !== plan.targetEndpoint.side) {
      pushGeometryDiagnostic(
        diagnostics,
        "renderer.routing.journey_map_endpoint_intrusion",
        `Resolved journey edge "${plan.id}" does not preserve legal semantic endpoints.`,
        plan.id,
        [plan.id, plan.from, plan.to]
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
        `Resolved journey edge "${plan.id}" intersects ${isEndpoint ? "endpoint" : "unrelated"} Step "${indexedNode.node.id}".`,
        plan.id,
        [plan.id, indexedNode.node.id]
      );
    }
    for (const indexedStage of index.allStages) {
      const headerRect: Rect = {
        id: indexedStage.stage.id,
        x: indexedStage.stage.x,
        y: indexedStage.stage.y,
        width: indexedStage.stage.width,
        height: indexedStage.stage.chrome.headerBandHeight ?? 0
      };
      const intersectingHeaderContent = indexedStage.stage.headerContent.find((block) =>
        intersectsRoute(route, containerContentRect(indexedStage.stage, block))
      );
      if (intersectsRoute(route, headerRect) || intersectingHeaderContent) {
        pushGeometryDiagnostic(
          diagnostics,
          "renderer.routing.journey_map_stage_header_intersection",
          `Resolved journey edge "${plan.id}" intersects Stage header "${indexedStage.stage.id}".`,
          plan.id,
          [plan.id, indexedStage.stage.id]
        );
      }
      if (indexedStage.stage.id !== source.metadata.stageId
        && indexedStage.stage.id !== target.metadata.stageId
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
          `Resolved journey edge "${plan.id}" intersects unrelated Stage "${indexedStage.stage.id}".`,
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
            `Resolved journey edge "${plan.id}" intersects badge "${block.id}".`,
            plan.id,
            [plan.id, indexedNode.node.id, block.id]
          );
        }
      }
    }
    const firstPart = routeParts[0];
    const lastPart = routeParts.at(-1);
    if (plan.markers?.start === "arrow"
      && (!firstPart || (segmentLength(firstPart.start, firstPart.end) ?? 0) < MIN_ARROW_MARKER_LEG)) {
      diagnostics.push(createRoutingDiagnostic(
        "renderer.routing.marker_leg_minimum_unmet",
        `Resolved journey edge "${plan.id}" has a short start marker leg.`,
        plan.id,
        "info",
        JSON.stringify({ relatedIds: [plan.id] })
      ));
    }
    if (plan.markers?.end === "arrow"
      && (!lastPart || (segmentLength(lastPart.start, lastPart.end) ?? 0) < MIN_ARROW_MARKER_LEG)) {
      diagnostics.push(createRoutingDiagnostic(
        "renderer.routing.marker_leg_minimum_unmet",
        `Resolved journey edge "${plan.id}" has a short end marker leg.`,
        plan.id,
        "info",
        JSON.stringify({ relatedIds: [plan.id] })
      ));
    }
    if (state.stageGates.length !== plan.stageGates.length
      || state.stageGates.some((gate, gateIndex) => {
        const accepted = plan.stageGates[gateIndex];
        const stage = index.stageById.get(gate.stageId)?.stage;
        const onBorder = stage && (gate.side === "east"
          ? gate.x === stage.x + stage.width
          : gate.side === "west"
            ? gate.x === stage.x
            : gate.side === "south"
              ? gate.y === stage.y + stage.height
              : gate.y === stage.y);
        return !accepted
          || gate.stageId !== accepted.stageId
          || gate.side !== accepted.side
          || gate.order !== accepted.order
          || gate.locked !== accepted.locked
          || !onBorder
          || !routeContainsPoint(route, gate);
      })) {
      diagnostics.push(createRoutingDiagnostic(
        "renderer.routing.journey_map_boundary_gate_fallback",
        `Resolved journey edge "${plan.id}" has an invalid or reordered Stage gate.`,
        plan.id,
        "warn",
        JSON.stringify({ relatedIds: [plan.id, ...state.stageGates.map((gate) => gate.stageId)] })
      ));
    }
    if (routeRuns.length !== state.segmentCoordinates.length
      || routeRuns.some((run) => {
        const coordinate = state.segmentCoordinates.find((candidate) =>
          candidate.segmentRunIndex === run.segmentRunIndex && candidate.axis === run.axis
        );
        return !coordinate || coordinate.resolvedCoordinate !== run.coordinate;
      })) {
      diagnostics.push(resolvedContractDiagnostic(
        `Resolved journey edge "${plan.id}" has orphaned or stale segment coordinates.`,
        plan.id
      ));
    }
    const preparedRuns = buildJourneyMapRouteSegmentRuns(state.preparedRoute);
    const reconstructed = reconstructRouteFromResolvedRuns(
      state.preparedRoute,
      preparedRuns,
      state.segmentCoordinates,
      state.sourceEndpoint,
      state.targetEndpoint
    );
    if (!reconstructed || JSON.stringify(reconstructed) !== JSON.stringify(state.finalRoute)) {
      diagnostics.push(resolvedContractDiagnostic(
        `Resolved journey edge "${plan.id}" does not reconstruct from its prepared route and coordinates.`,
        plan.id
      ));
    }
  }
  return diagnostics;
}

function validateResolvedTrackSeparation(
  states: readonly JourneyMapResolvedConnectorState[],
  finalPositionedScene: PositionedScene
): RendererDiagnostic[] {
  const diagnostics: RendererDiagnostic[] = [];
  const index = buildJourneyMapPositionedIndex(finalPositionedScene);
  const reported = new Set<string>();
  states.forEach((leftState, leftIndex) => {
    states.slice(leftIndex + 1).forEach((rightState) => {
      for (const leftRun of buildJourneyMapRouteSegmentRuns(leftState.finalRoute)) {
        for (const rightRun of buildJourneyMapRouteSegmentRuns(rightState.finalRoute)) {
          if (leftRun.axis !== rightRun.axis
            || !positiveSpanOverlap(leftRun.span, rightRun.span)
            || Math.abs(leftRun.coordinate - rightRun.coordinate)
              >= JOURNEY_MAP_TRACK_SEPARATION - 0.001
            || isAllowedOverloadedEndpointPair(
              leftState,
              leftRun,
              rightState,
              rightRun,
              states,
              index
            )) {
            continue;
          }
          const key = [leftState.connectorId, rightState.connectorId].sort().join("|");
          if (reported.has(key)) {
            continue;
          }
          reported.add(key);
          diagnostics.push(createRoutingDiagnostic(
            "renderer.routing.journey_map_track_separation_unmet",
            `Resolved journey tracks remain less than ${JOURNEY_MAP_TRACK_SEPARATION}px apart over an overlapping span.`,
            leftState.connectorId,
            "warn",
            JSON.stringify({ relatedIds: [leftState.connectorId, rightState.connectorId] })
          ));
        }
      }
    });
  });
  return diagnostics;
}

function validateJourneyMapExpansionHistory(
  attempts: readonly JourneyMapExpansionAttempt[],
  expansionBaselineScene: PositionedScene,
  finalPositionedScene: PositionedScene
): RendererDiagnostic[] {
  const diagnostics: RendererDiagnostic[] = [];
  let accumulated: JourneyMapExpansionRequest[] = [];
  attempts.forEach((attempt, index) => {
    const canonical = canonicalExpansionRequests(attempt.requests);
    if (attempt.attempt !== index + 1
      || JSON.stringify(canonical) !== JSON.stringify(attempt.requests)
      || attempt.requests.some((request) => request.amount <= 0
        || request.amount % JOURNEY_MAP_TRACK_SEPARATION !== 0)) {
      diagnostics.push(resolvedContractDiagnostic(
        "Journey-map expansion history is noncanonical or off the 16px grid.",
        expansionBaselineScene.root.id
      ));
    }
    accumulated = accumulatedExpansionRequests(accumulated, attempt.requests);
  });
  if (attempts.length > MAX_JOURNEY_MAP_EXPANSION_ATTEMPTS) {
    diagnostics.push(createRoutingDiagnostic(
      "renderer.routing.journey_map_gutter_expansion_exhausted",
      `Journey-map expansion exceeded ${MAX_JOURNEY_MAP_EXPANSION_ATTEMPTS} attempts.`,
      expansionBaselineScene.root.id,
      "warn",
      JSON.stringify({ relatedIds: [expansionBaselineScene.root.id] })
    ));
  }
  const expected = applyJourneyMapExpansionRequests(expansionBaselineScene, accumulated);
  if (!expected || JSON.stringify(expected.root) !== JSON.stringify(finalPositionedScene.root)) {
    diagnostics.push(resolvedContractDiagnostic(
      "Journey-map expansion geometry does not equal fresh-baseline aggregate application.",
      expansionBaselineScene.root.id
    ));
  }
  return diagnostics;
}

export function validateJourneyMapResolvedStages(
  plans: readonly JourneyMapConnectorPlan[],
  nominalOccupancy: readonly JourneyMapOccupancyRecord[],
  occupancy: readonly JourneyMapOccupancyRecord[],
  states: readonly JourneyMapResolvedConnectorState[],
  expansionAttempts: readonly JourneyMapExpansionAttempt[],
  expansionBaselineScene: PositionedScene,
  finalPositionedScene: PositionedScene
): RendererDiagnostic[] {
  const diagnostics: RendererDiagnostic[] = [];
  const planIds = plans.map((plan) => plan.id);
  const stateIds = states.map((state) => state.connectorId);
  const edgeIds = finalPositionedScene.edges.map((edge) => edge.id);
  if (new Set(planIds).size !== planIds.length
    || new Set(stateIds).size !== stateIds.length
    || new Set(edgeIds).size !== edgeIds.length) {
    diagnostics.push(createRoutingDiagnostic(
      "renderer.routing.journey_map_edge_duplicated",
      "Resolved journey state contains a duplicate connector occurrence.",
      [...stateIds, ...edgeIds].sort()[0] ?? "root",
      "error",
      JSON.stringify({ relatedIds: [...new Set([...stateIds, ...edgeIds])].sort() })
    ));
  }
  const canonicalIds = [...planIds].sort();
  if (JSON.stringify([...stateIds].sort()) !== JSON.stringify(canonicalIds)
    || JSON.stringify([...edgeIds].sort()) !== JSON.stringify(canonicalIds)) {
    diagnostics.push(createRoutingDiagnostic(
      "renderer.routing.journey_map_edge_omitted",
      "Resolved journey state does not contain exactly one final route per accepted plan.",
      canonicalIds[0] ?? "root",
      "error",
      JSON.stringify({ relatedIds: canonicalIds })
    ));
  }
  const recomputedOccupancy = buildFinalJourneyMapOccupancy(
    nominalOccupancy,
    states,
    plans,
    finalPositionedScene
  );
  if (occupancy.length !== recomputedOccupancy.length
    || occupancy.some((record, index) =>
      !recomputedOccupancy[index]
      || !compareResolvedOccupancyForValidation(record, recomputedOccupancy[index]!))) {
    const firstMismatch = occupancy.find((record, index) =>
      !recomputedOccupancy[index]
      || !compareResolvedOccupancyForValidation(record, recomputedOccupancy[index]!)
    );
    diagnostics.push(resolvedContractDiagnostic(
      "Final journey-map occupancy does not independently recompute from final routes.",
      firstMismatch?.connectorId ?? plans[0]?.id ?? "root"
    ));
  }
  const occupancyIdentities = occupancy.map((record) => JSON.stringify({
    connectorId: record.connectorId,
    resourceKey: record.resourceKey,
    axis: record.axis,
    segmentRunIndex: record.segmentRunIndex,
    resourceKind: record.resource.kind,
    lockKind: record.lock.kind
  }));
  if (new Set(occupancyIdentities).size !== occupancyIdentities.length) {
    diagnostics.push(resolvedContractDiagnostic(
      "Final journey-map occupancy contains a duplicate record identity.",
      occupancy[0]?.connectorId ?? "root"
    ));
  }
  diagnostics.push(
    ...validateResolvedFinalGeometry(plans, states, finalPositionedScene),
    ...validateResolvedTrackSeparation(states, finalPositionedScene),
    ...validateJourneyMapExpansionHistory(
      expansionAttempts,
      expansionBaselineScene,
      finalPositionedScene
    )
  );
  return sortRendererDiagnostics(diagnostics);
}

function applyJourneyMapExpansionRequests(
  scene: PositionedScene,
  requests: readonly JourneyMapExpansionRequest[]
): PositionedScene | undefined {
  const expanded = structuredClone(scene) as PositionedScene;
  const canonical = canonicalExpansionRequests(requests);
  for (const request of canonical.filter((candidate) => candidate.kind === "stage_step_gap")) {
    if (request.kind !== "stage_step_gap") {
      continue;
    }
    const stage = expanded.root.children.find((item): item is PositionedContainer =>
      item.kind === "container" && item.id === request.stageId
    );
    const stageMetadata = stage?.viewMetadata?.journeyMap;
    if (!stage || stageMetadata?.kind !== "stage") {
      return undefined;
    }
    for (const child of stage.children) {
      const childMetadata = child.viewMetadata?.journeyMap;
      if (childMetadata?.kind === "step"
        && childMetadata.stepOrder !== undefined
        && childMetadata.stepOrder > request.afterStepOrder) {
        shiftPositionedItemX(child, request.amount);
      }
    }
    stage.width = roundMetric(stage.width + request.amount);
    for (const rootItem of expanded.root.children) {
      const metadata = rootItem.viewMetadata?.journeyMap;
      const rootOrder = metadata?.kind === "stage" || metadata?.kind === "step"
        ? metadata.rootOrder
        : undefined;
      if (rootOrder !== undefined && rootOrder > stageMetadata.rootOrder) {
        shiftPositionedItemX(rootItem, request.amount);
      }
    }
    expanded.root.width = roundMetric(expanded.root.width + request.amount);
  }
  for (const request of canonical.filter((candidate) => candidate.kind === "root_item_gap")) {
    if (request.kind !== "root_item_gap") {
      continue;
    }
    for (const rootItem of expanded.root.children) {
      const rootOrder = rootOrderOf(rootItem);
      if (rootOrder !== undefined && rootOrder > request.afterRootOrder) {
        shiftPositionedItemX(rootItem, request.amount);
      }
    }
    expanded.root.width = roundMetric(expanded.root.width + request.amount);
  }

  const beforeMaximumRootItemBottom = expanded.root.children.length > 0
    ? Math.max(...expanded.root.children.map((item) => item.y + item.height))
    : expanded.root.y;
  for (const request of canonical.filter((candidate) => candidate.kind === "stage_bypass_gutter")) {
    if (request.kind !== "stage_bypass_gutter") {
      continue;
    }
    const stage = expanded.root.children.find((item): item is PositionedContainer =>
      item.kind === "container" && item.id === request.stageId
    );
    if (!stage) {
      return undefined;
    }
    stage.height = roundMetric(stage.height + request.amount);
  }
  const afterMaximumRootItemBottom = expanded.root.children.length > 0
    ? Math.max(...expanded.root.children.map((item) => item.y + item.height))
    : expanded.root.y;
  expanded.root.height = roundMetric(
    expanded.root.height + afterMaximumRootItemBottom - beforeMaximumRootItemBottom
  );

  for (const request of canonical.filter((candidate) => candidate.kind === "root_outer_gutter")) {
    if (request.kind !== "root_outer_gutter"
      || request.ownerContainerId !== expanded.root.id) {
      return undefined;
    }
    expanded.root.height = roundMetric(expanded.root.height + request.amount);
  }
  return expanded;
}

function finalOccupancyNominalCoordinate(
  record: JourneyMapOccupancyRecord,
  nominalOccupancy: readonly JourneyMapOccupancyRecord[],
  state: JourneyMapResolvedConnectorState | undefined
): number {
  const segmentNominal = state?.segmentCoordinates.find((coordinate) =>
    coordinate.segmentRunIndex === record.segmentRunIndex && coordinate.axis === record.axis
  )?.nominalCoordinate;
  if (segmentNominal !== undefined) {
    return segmentNominal;
  }
  const semanticMatch = nominalOccupancy.find((candidate) =>
    candidate.connectorId === record.connectorId
    && candidate.resourceKey === record.resourceKey
    && candidate.resource.kind === record.resource.kind
    && candidate.axis === record.axis
    && candidate.lock.kind === record.lock.kind
  );
  if (semanticMatch) {
    return semanticMatch.nominalCoordinate;
  }
  return record.nominalCoordinate;
}

function buildFinalJourneyMapOccupancy(
  nominalOccupancy: readonly JourneyMapOccupancyRecord[],
  resolvedStates: readonly JourneyMapResolvedConnectorState[],
  plans: readonly JourneyMapConnectorPlan[],
  finalPositionedScene: PositionedScene
): JourneyMapOccupancyRecord[] {
  const stateById = new Map(resolvedStates.map((state) => [state.connectorId, state] as const));
  const resolvedPlans = resolvedPlansForFinalOccupancy(plans, resolvedStates);
  return extractJourneyMapOccupancy(
    resolvedPlans,
    finalPositionedScene,
    resolvedStates,
    nominalOccupancy
  )
    .map((record) => {
      const state = stateById.get(record.connectorId);
      const run = state
        ? buildJourneyMapRouteSegmentRuns(state.finalRoute)[record.segmentRunIndex]
        : undefined;
      return {
        ...structuredClone(record),
        nominalCoordinate: finalOccupancyNominalCoordinate(
          record,
          nominalOccupancy,
          state
        ),
        resolvedCoordinate: run?.coordinate ?? record.resolvedCoordinate
      };
    })
    .sort(compareOccupancyRecords);
}

function resolvedStageGatesForRoute(
  state: JourneyMapResolvedConnectorState,
  index: JourneyMapPositionedIndex
): JourneyMapStageGate[] {
  const segments = routeSegments(state.finalRoute);
  return state.stageGates.map((gate) => {
    const stage = index.stageById.get(gate.stageId);
    if (!stage) {
      return structuredClone(gate);
    }
    const stageLeft = stage.stage.x;
    const stageRight = stage.stage.x + stage.stage.width;
    const stageTop = stage.stage.y;
    const stageBottom = stage.stage.y + stage.stage.height;
    const candidates: Point[] = [];
    for (const { start, end } of segments) {
      if (gate.side === "east" || gate.side === "west") {
        const borderX = gate.side === "east" ? stageRight : stageLeft;
        if (start.y === end.y
          && borderX >= Math.min(start.x, end.x) - 0.001
          && borderX <= Math.max(start.x, end.x) + 0.001
          && start.y >= stageTop - 0.001
          && start.y <= stageBottom + 0.001) {
          candidates.push({ x: borderX, y: start.y });
        }
      } else {
        const borderY = gate.side === "south" ? stageBottom : stageTop;
        if (start.x === end.x
          && borderY >= Math.min(start.y, end.y) - 0.001
          && borderY <= Math.max(start.y, end.y) + 0.001
          && start.x >= stageLeft - 0.001
          && start.x <= stageRight + 0.001) {
          candidates.push({ x: start.x, y: borderY });
        }
      }
    }
    const selected = candidates.sort((left, right) => {
      const leftDistance = gate.side === "east" || gate.side === "west"
        ? Math.abs(left.y - gate.y)
        : Math.abs(left.x - gate.x);
      const rightDistance = gate.side === "east" || gate.side === "west"
        ? Math.abs(right.y - gate.y)
        : Math.abs(right.x - gate.x);
      return leftDistance - rightDistance || left.x - right.x || left.y - right.y;
    })[0];
    return selected ? { ...gate, x: roundMetric(selected.x), y: roundMetric(selected.y) } : gate;
  });
}

function applyResolvedStageGates(
  states: readonly JourneyMapResolvedConnectorState[],
  index: JourneyMapPositionedIndex
): JourneyMapResolvedConnectorState[] {
  return states.map((state) => ({
    ...structuredClone(state),
    stageGates: resolvedStageGatesForRoute(state, index)
  }));
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

function containerContentRect(container: PositionedContainer, block: MeasuredContentBlock): Rect {
  return {
    id: block.id,
    x: container.x + block.x,
    y: container.y + block.y,
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
  const measuredCycleIndex = measuredScene
    ? buildJourneyMapCycleIndex(measuredScene.edges, index)
    : undefined;
  const ordinaryMeasuredDegrees = measuredCycleIndex
    ? buildDegreeIndex(measuredCycleIndex.ordinaryEdges)
    : undefined;
  const measuredDuplicateAdmission = measuredScene
    && measuredDegrees
    && ordinaryMeasuredDegrees
    && measuredCycleIndex
    ? buildDuplicateGroupAdmission(
      measuredScene,
      positionedScene.root,
      index,
      measuredDegrees,
      ordinaryMeasuredDegrees,
      measuredCycleIndex
    )
    : undefined;
  const measuredEdgeById = measuredScene
    ? new Map(measuredScene.edges.map((edge) => [edge.id, edge]))
    : undefined;
  for (const plan of plans) {
    const measuredEdge = measuredEdgeById?.get(plan.id);
    const expectedCycleComponent = measuredEdge?.from.itemId === measuredEdge?.to.itemId
      ? undefined
      : measuredCycleIndex?.componentByEdgeId.get(plan.id);
    const expectedEligibility = measuredEdge && measuredDegrees && ordinaryMeasuredDegrees
      ? resolveRouteEligibility(
        measuredEdge,
        index,
        measuredDegrees,
        ordinaryMeasuredDegrees,
        expectedCycleComponent
      )
      : undefined;
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
        height: headerBandHeight
      };
      const intersectingHeaderContent = indexedStage.stage.headerContent.find((block) =>
        intersectsRoute(route, containerContentRect(indexedStage.stage, block))
      );
      if (intersectsRoute(route, headerRect) || intersectingHeaderContent) {
        pushGeometryDiagnostic(
          diagnostics,
          "renderer.routing.journey_map_stage_header_intersection",
          `Journey edge "${plan.id}" intersects Stage header "${indexedStage.stage.id}".`,
          plan.id,
          [
            plan.id,
            indexedStage.stage.id,
            ...(intersectingHeaderContent ? [intersectingHeaderContent.id] : [])
          ]
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
    const expectedStageGates = expectedEligibility
      ? buildStageGates(expectedEligibility, plan.sourceEndpoint, plan.targetEndpoint)
      : undefined;
    const gateContractMatches = expectedStageGates
      ? JSON.stringify(plan.stageGates) === JSON.stringify(expectedStageGates)
      : (() => {
        const twoLockedGatesMatch = (
          sourceSide: PortSide,
          targetSide: PortSide
        ): boolean => plan.stageGates.length === 2
          && plan.stageGates[0]?.stageId === expectedSourceStageId
          && plan.stageGates[0]?.side === sourceSide
          && plan.stageGates[0]?.order === 0
          && plan.stageGates[0]?.locked === true
          && plan.stageGates[1]?.stageId === expectedTargetStageId
          && plan.stageGates[1]?.side === targetSide
          && plan.stageGates[1]?.order === 0
          && plan.stageGates[1]?.locked === true;
        if (plan.archetype === "adjacent_forward_cross_stage") {
          return twoLockedGatesMatch("east", "west");
        }
        if (plan.archetype === "long_forward_cross_stage") {
          return plan.branch
            ? twoLockedGatesMatch("east", "south")
            : twoLockedGatesMatch("south", "south");
        }
        if (plan.archetype === "cycle_return_cross_stage") {
          return twoLockedGatesMatch("south", "south");
        }
        const isTargetWestGate = plan.archetype === "adjacent_forward_root_to_contained"
          || plan.archetype === "forward_root_to_contained_bypass";
        if (isTargetWestGate) {
          return plan.stageGates.length === 1
            && plan.stageGates[0]?.stageId === expectedTargetStageId
            && plan.stageGates[0]?.side === "west"
            && plan.stageGates[0]?.order === 0
            && plan.stageGates[0]?.locked === true;
        }
        const isSourceEastGate = plan.archetype === "adjacent_forward_contained_to_root"
          || plan.archetype === "forward_contained_to_root_bypass";
        if (isSourceEastGate) {
          return plan.stageGates.length === 1
            && plan.stageGates[0]?.stageId === expectedSourceStageId
            && plan.stageGates[0]?.side === "east"
            && plan.stageGates[0]?.order === 0
            && plan.stageGates[0]?.locked === true;
        }
        return plan.stageGates.length === 0;
      })();
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
        ? stage.stage.y + (stage.stage.chrome.headerBandHeight ?? 0)
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
    const expectedStageLocalBypass = expectedEligibility
      ? buildStageLocalBypass(expectedEligibility, plan.sourceEndpoint, plan.targetEndpoint)
        ?? buildBoundaryStageLocalBypass(
          expectedEligibility,
          positionedScene.root,
          plan.sourceEndpoint,
          plan.targetEndpoint
        )
      : undefined;
    const bypassExpected = expectedEligibility
      ? expectedStageLocalBypass !== undefined
      : plan.archetype === "non_adjacent_forward_same_stage"
        || plan.archetype === "backward_same_stage"
        || plan.archetype === "cycle_forward_same_stage"
        || plan.archetype === "cycle_return_same_stage";
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
      const bypassContractMatches = expectedStageLocalBypass
        ? bypass !== undefined
          && JSON.stringify(bypass) === JSON.stringify(expectedStageLocalBypass)
          && routeHasProvisionalControls
          && routeContainsHorizontalSpan(
            route,
            expectedStageLocalBypass.nominalCoordinate,
            expectedStageLocalBypass.span.start,
            expectedStageLocalBypass.span.end
          )
        : bypass !== undefined
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
    const expectedRootOuterBypass = expectedEligibility
      ? buildRootOuterBypass(
        expectedEligibility,
        positionedScene.root,
        plan.sourceEndpoint,
        plan.targetEndpoint
      )
      : undefined;
    const rootBypassExpected = expectedEligibility
      ? expectedRootOuterBypass !== undefined
      : plan.archetype === "long_forward_cross_stage"
        || plan.archetype === "long_forward_root_step"
        || plan.archetype === "backward_root_step"
        || plan.archetype === "cycle_return_cross_stage";
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
      const rootBypassContractMatches = expectedRootOuterBypass
        ? rootBypass !== undefined
          && JSON.stringify(rootBypass) === JSON.stringify(expectedRootOuterBypass)
          && routeHasProvisionalControls
          && routeContainsHorizontalSpan(
            route,
            expectedRootOuterBypass.nominalCoordinate,
            expectedRootOuterBypass.span.start,
            expectedRootOuterBypass.span.end
          )
        : rootBypass !== undefined
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

    const isSelfLoopArchetype = plan.archetype === "self_loop";
    const expectedSelfLoopTrack = expectedEligibility
      ? buildSelfLoopTrack(expectedEligibility, plan.sourceEndpoint, plan.targetEndpoint, index)
      : undefined;
    const expectedSelfLoopRoute = expectedSelfLoopTrack
      ? buildSelfLoopRoute(plan.sourceEndpoint, plan.targetEndpoint, expectedSelfLoopTrack)
      : undefined;
    const measuredEdgeMetadata = measuredEdge?.viewMetadata?.journeyMap;
    const expectedSelfLoopPriority = measuredEdge && measuredEdgeMetadata && expectedEligibility
      ? buildPriority(measuredEdge, measuredEdgeMetadata, expectedEligibility)
      : undefined;
    const sourceFlowPort = source.node.ports.find((port) => port.role === "journey_flow_out");
    const targetFlowPort = target.node.ports.find((port) => port.role === "journey_flow_in");
    const usesExactSelfLoopEndpoints = sourceFlowPort !== undefined
      && targetFlowPort !== undefined
      && sourceFlowPort.side === "east"
      && targetFlowPort.side === "west"
      && plan.sourceEndpoint.portId === sourceFlowPort.id
      && plan.sourceEndpoint.side === "east"
      && plan.sourceEndpoint.x === roundMetric(source.node.x + sourceFlowPort.x)
      && plan.sourceEndpoint.y === roundMetric(source.node.y + sourceFlowPort.y)
      && plan.sourceEndpoint.offset === roundMetric(sourceFlowPort.y)
      && plan.targetEndpoint.portId === targetFlowPort.id
      && plan.targetEndpoint.side === "west"
      && plan.targetEndpoint.x === roundMetric(target.node.x + targetFlowPort.x)
      && plan.targetEndpoint.y === roundMetric(target.node.y + targetFlowPort.y)
      && plan.targetEndpoint.offset === roundMetric(targetFlowPort.y);
    const selfLoopContractMatches = measuredScene
      ? isSelfLoopArchetype
        ? expectedEligibility?.archetype === "self_loop"
          && expectedEligibility.source.node.id === expectedEligibility.target.node.id
          && plan.from === plan.to
          && plan.ownerContainerId === expectedEligibility.sourceStage?.stage.id
          && measuredEdgeMetadata !== undefined
          && plan.authorOrder === measuredEdgeMetadata.authorOrder
          && plan.sameEndpointOrdinal === measuredEdgeMetadata.sameEndpointOrdinal
          && plan.exactIdentityOrdinal === measuredEdgeMetadata.exactIdentityOrdinal
          && expectedSelfLoopPriority !== undefined
          && expectedSelfLoopPriority.archetypeRank === 6
          && JSON.stringify(plan.priority) === JSON.stringify(expectedSelfLoopPriority)
          && usesExactSelfLoopEndpoints
          && plan.stageGates.length === 0
          && plan.stageLocalBypass === undefined
          && plan.rootOuterBypass === undefined
          && plan.cycleComponent === undefined
          && plan.topologyModifiers === undefined
          && plan.branch === undefined
          && plan.join === undefined
          && expectedSelfLoopTrack !== undefined
          && JSON.stringify(plan.selfLoopTrack) === JSON.stringify(expectedSelfLoopTrack)
          && expectedSelfLoopRoute !== undefined
          && JSON.stringify(route) === JSON.stringify(expectedSelfLoopRoute)
        : expectedEligibility?.archetype !== "self_loop" && plan.selfLoopTrack === undefined
      : !isSelfLoopArchetype && plan.selfLoopTrack === undefined;
    if (!selfLoopContractMatches) {
      diagnostics.push(createRoutingDiagnostic(
        "renderer.routing.journey_map_archetype_fallback",
        `Journey edge "${plan.id}" does not expose its accepted self-loop topology contract.`,
        plan.id,
        "warn",
        JSON.stringify({ relatedIds: [plan.id, plan.from] })
      ));
    }

    const expectedDuplicateFan = expectedEligibility
      ? buildDuplicateFan(
        expectedEligibility,
        plan.sourceEndpoint,
        plan.targetEndpoint,
        positionedScene.root,
        index
      )
      : undefined;
    const expectedDuplicateRoute = expectedDuplicateFan
      ? buildDuplicateFanRoute(plan.sourceEndpoint, plan.targetEndpoint, expectedDuplicateFan)
      : undefined;
    const expectedDuplicatePriority = measuredEdge && measuredEdgeMetadata && expectedEligibility
      ? buildPriority(measuredEdge, measuredEdgeMetadata, expectedEligibility)
      : undefined;
    const usesExactDuplicateEndpoints = sourceFlowPort !== undefined
      && targetFlowPort !== undefined
      && sourceFlowPort.side === "east"
      && targetFlowPort.side === "west"
      && plan.sourceEndpoint.portId === sourceFlowPort.id
      && plan.sourceEndpoint.side === "east"
      && plan.sourceEndpoint.x === roundMetric(source.node.x + sourceFlowPort.x)
      && plan.sourceEndpoint.y === roundMetric(source.node.y + sourceFlowPort.y)
      && plan.sourceEndpoint.offset === roundMetric(sourceFlowPort.y)
      && plan.targetEndpoint.portId === targetFlowPort.id
      && plan.targetEndpoint.side === "west"
      && plan.targetEndpoint.x === roundMetric(target.node.x + targetFlowPort.x)
      && plan.targetEndpoint.y === roundMetric(target.node.y + targetFlowPort.y)
      && plan.targetEndpoint.offset === roundMetric(targetFlowPort.y);
    const duplicateContractMatches = measuredScene
      ? expectedEligibility?.duplicate
        ? plan.archetype === "adjacent_forward_root_step"
          && plan.ownerContainerId === positionedScene.root.id
          && measuredEdge !== undefined
          && measuredEdgeMetadata !== undefined
          && measuredDuplicateAdmission?.get(plan.id) === true
          && measuredEdge.ownerContainerId === positionedScene.root.id
          && measuredEdge.routing.sourcePortRole === "journey_flow_out"
          && measuredEdge.routing.targetPortRole === "journey_flow_in"
          && plan.authorOrder === measuredEdgeMetadata.authorOrder
          && plan.sameEndpointOrdinal === measuredEdgeMetadata.sameEndpointOrdinal
          && plan.exactIdentityOrdinal === measuredEdgeMetadata.exactIdentityOrdinal
          && expectedDuplicatePriority !== undefined
          && expectedDuplicatePriority.archetypeRank === 3
          && JSON.stringify(plan.priority) === JSON.stringify(expectedDuplicatePriority)
          && measuredEdge.markers?.start === undefined
          && measuredEdge.markers?.end === "arrow"
          && plan.markers?.start === undefined
          && plan.markers?.end === "arrow"
          && usesExactDuplicateEndpoints
          && plan.stageGates.length === 0
          && plan.stageLocalBypass === undefined
          && plan.rootOuterBypass === undefined
          && plan.selfLoopTrack === undefined
          && plan.cycleComponent === undefined
          && plan.topologyModifiers === undefined
          && plan.branch === undefined
          && plan.join === undefined
          && expectedDuplicateFan !== undefined
          && JSON.stringify(plan.duplicateFan) === JSON.stringify(expectedDuplicateFan)
          && expectedDuplicateRoute !== undefined
          && JSON.stringify(route) === JSON.stringify(expectedDuplicateRoute)
        : plan.duplicateFan === undefined
      : plan.duplicateFan === undefined;
    if (!duplicateContractMatches) {
      diagnostics.push(createRoutingDiagnostic(
        "renderer.routing.journey_map_archetype_fallback",
        `Journey edge "${plan.id}" does not expose its accepted duplicate-fan contract.`,
        plan.id,
        "warn",
        JSON.stringify({ relatedIds: [plan.id, plan.from, plan.to] })
      ));
    }

    const branch = plan.branch;
    const join = plan.join;
    const isBackwardArchetype = plan.archetype === "backward_same_stage"
      || plan.archetype === "backward_root_step";
    const expectedBranch = expectedEligibility
      ? buildBranchPlan(
        expectedEligibility,
        plan.sourceEndpoint,
        expectedStageLocalBypass,
        expectedRootOuterBypass
      )
      : undefined;
    const expectedJoin = expectedEligibility
      ? buildJoinPlan(expectedEligibility, plan.targetEndpoint, expectedStageLocalBypass)
      : undefined;
    const expectedTopologyModifiers = expectedBranch
      ? ["branch"] as const
      : expectedJoin
        ? ["join"] as const
        : undefined;
    const topologyModifiersMatch = expectedEligibility
      ? JSON.stringify(plan.topologyModifiers) === JSON.stringify(expectedTopologyModifiers)
      : branch
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
    const modifierDegrees = ordinaryMeasuredDegrees ?? measuredDegrees;
    const authoredOutgoingEdgeIds = modifierDegrees?.outgoingEdgeIdsByNodeId.get(plan.from);
    const expectedSourceOrdinal = authoredOutgoingEdgeIds?.indexOf(plan.id);
    const branchDegreeContractMatches = branch
      ? modifierDegrees
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
    const branchContractMatches = expectedEligibility
      ? JSON.stringify(branch) === JSON.stringify(expectedBranch)
        && topologyModifiersMatch
        && (expectedBranch
          ? plan.priority.archetypeRank === (isBackwardArchetype ? 6 : 4)
            && plan.sourceEndpoint.side === (isBackwardArchetype ? "south" : "east")
          : plan.priority.archetypeRank !== 4)
      : branch
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
    const authoredIncomingEdgeIds = modifierDegrees?.incomingEdgeIdsByNodeId.get(plan.to);
    const authoredJoinSourceEdgeIds = modifierDegrees?.outgoingEdgeIdsByNodeId.get(plan.from);
    const expectedTargetOrdinal = authoredIncomingEdgeIds?.indexOf(plan.id);
    const joinDegreeContractMatches = join
      ? modifierDegrees
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
    const joinContractMatches = expectedEligibility
      ? JSON.stringify(join) === JSON.stringify(expectedJoin)
        && topologyModifiersMatch
        && (expectedJoin
          ? plan.priority.archetypeRank === 5 && plan.targetEndpoint.side === "west"
          : plan.priority.archetypeRank !== 5)
      : join
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

    const isCycleArchetype = plan.archetype === "cycle_forward_same_stage"
      || plan.archetype === "cycle_return_same_stage"
      || plan.archetype === "cycle_return_cross_stage";
    const cycleContractMatches = measuredScene
      ? expectedEligibility !== undefined
        && plan.archetype === expectedEligibility.archetype
        && JSON.stringify(plan.cycleComponent) === JSON.stringify(expectedCycleComponent)
        && (isCycleArchetype
          ? plan.priority.archetypeRank === 6
            && plan.sourceEndpoint.side === "south"
            && plan.targetEndpoint.side === "south"
            && expectedCycleComponent !== undefined
            && (expectedCycleComponent.role === "forward"
              || expectedCycleComponent.role === "return")
          : expectedCycleComponent?.role === "ordinary"
            ? plan.priority.archetypeRank !== 6
            : plan.cycleComponent === undefined)
      : plan.cycleComponent === undefined && !isCycleArchetype;
    if (!cycleContractMatches) {
      diagnostics.push(createRoutingDiagnostic(
        "renderer.routing.journey_map_archetype_fallback",
        `Journey edge "${plan.id}" does not expose its accepted shape-aware cycle contract.`,
        plan.id,
        "warn",
        JSON.stringify({ relatedIds: [plan.id, plan.from, plan.to] })
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
      : isCycleArchetype || isSelfLoopArchetype || plan.priority.archetypeRank !== 6;
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

function positionedEdgeFromResolvedState(
  plan: JourneyMapConnectorPlan,
  resolved: JourneyMapResolvedConnectorState,
  route: PositionedRoute
): PositionedEdge {
  const positioned = positionedEdgeFromPlan(plan, route);
  return {
    ...positioned,
    from: {
      itemId: resolved.sourceEndpoint.itemId,
      portId: resolved.sourceEndpoint.portId,
      x: resolved.sourceEndpoint.x,
      y: resolved.sourceEndpoint.y
    },
    to: {
      itemId: resolved.targetEndpoint.itemId,
      portId: resolved.targetEndpoint.portId,
      x: resolved.targetEndpoint.x,
      y: resolved.targetEndpoint.y
    }
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

function withResolvedRoutes(
  scene: PositionedScene,
  plans: readonly JourneyMapConnectorPlan[],
  resolvedStates: readonly JourneyMapResolvedConnectorState[],
  routeForState: (state: JourneyMapResolvedConnectorState) => PositionedRoute,
  diagnostics: readonly RendererDiagnostic[]
): PositionedScene {
  const cloned = structuredClone(scene) as PositionedScene;
  const planById = new Map(plans.map((plan) => [plan.id, plan] as const));
  return {
    ...cloned,
    edges: resolvedStates.flatMap((state) => {
      const plan = planById.get(state.connectorId);
      return plan ? [positionedEdgeFromResolvedState(plan, state, routeForState(state))] : [];
    }),
    diagnostics: sortRendererDiagnostics([...scene.diagnostics, ...diagnostics])
  };
}

function buildJourneyMapRoutingStagesInternal(
  measuredScene: MeasuredScene,
  preRoutingPositionedScene: PositionedScene,
  expansionAttempts: JourneyMapExpansionAttempt[],
  expansionBaselineScene: PositionedScene,
  accumulatedRequests: JourneyMapExpansionRequest[]
): JourneyMapRoutingStages {
  const diagnostics: RendererDiagnostic[] = [];
  const index = buildJourneyMapPositionedIndex(preRoutingPositionedScene);
  const degrees = buildDegreeIndex(measuredScene.edges);
  const cycleIndex = buildJourneyMapCycleIndex(measuredScene.edges, index);
  const ordinaryDegrees = buildDegreeIndex(cycleIndex.ordinaryEdges);
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
  const duplicateGroupAdmission = buildDuplicateGroupAdmission(
    measuredScene,
    preRoutingPositionedScene.root,
    index,
    degrees,
    ordinaryDegrees,
    cycleIndex
  );

  for (const edge of measuredScene.edges) {
    if (duplicateEdgeIds.has(edge.id)) {
      continue;
    }
    const cycleComponent = cycleIndex.componentByEdgeId.get(edge.id);
    const eligibility = resolveRouteEligibility(
      edge,
      index,
      degrees,
      ordinaryDegrees,
      cycleComponent
    );
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
          deferredFamilies: classifyDeferredFamilies(edge, index, degrees),
          ...(cycleComponent ? { cycleComponent } : {})
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
    const isCyclePeripheral = eligibility.archetype === "cycle_forward_same_stage"
      || eligibility.archetype === "cycle_return_same_stage"
      || eligibility.archetype === "cycle_return_cross_stage";
    const isSelfLoop = eligibility.archetype === "self_loop";
    const isDuplicate = eligibility.duplicate !== undefined;
    const usesStageLocalBypass = eligibility.archetype === "non_adjacent_forward_same_stage"
      || eligibility.archetype === "backward_same_stage"
      || eligibility.archetype === "cycle_forward_same_stage"
      || eligibility.archetype === "cycle_return_same_stage"
      || eligibility.archetype === "forward_contained_to_root_bypass"
      || eligibility.archetype === "forward_root_to_contained_bypass"
      || (eligibility.archetype === "long_forward_cross_stage"
        && eligibility.branch !== undefined
        && eligibility.sourceStage !== undefined
        && eligibility.sourceStepOrder < eligibility.sourceStage.stepIds.length - 1);
    const usesRootOuterBypass = eligibility.archetype === "long_forward_cross_stage"
      || eligibility.archetype === "long_forward_root_step"
      || eligibility.archetype === "backward_root_step"
      || eligibility.archetype === "cycle_return_cross_stage";
    const sourceUsesSouthEndpoint = isBackward || isCyclePeripheral || (!eligibility.branch
      && (usesStageLocalBypass || usesRootOuterBypass));
    const targetUsesSouthEndpoint = isBackward || isCyclePeripheral || (!eligibility.join
      && (usesStageLocalBypass || usesRootOuterBypass));
    const sourceEndpoint = resolveEndpoint(
      edge,
      eligibility.source,
      "source",
      isSelfLoop
        ? "journey_flow_out"
        : sourceUsesSouthEndpoint ? "journey_escape_out" : edge.routing.sourcePortRole,
      sourceUsesSouthEndpoint ? "south" : "east",
      diagnostics
    );
    const targetEndpoint = resolveEndpoint(
      edge,
      eligibility.target,
      "target",
      isSelfLoop
        ? "journey_flow_in"
        : targetUsesSouthEndpoint ? "journey_escape_in" : edge.routing.targetPortRole,
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
    const stageLocalBypass = buildStageLocalBypass(
      eligibility,
      sourceEndpoint,
      targetEndpoint
    ) ?? buildBoundaryStageLocalBypass(
      eligibility,
      preRoutingPositionedScene.root,
      sourceEndpoint,
      targetEndpoint
    );
    const rootOuterBypass = buildRootOuterBypass(
      eligibility,
      preRoutingPositionedScene.root,
      sourceEndpoint,
      targetEndpoint
    );
    const selfLoopTrack = buildSelfLoopTrack(
      eligibility,
      sourceEndpoint,
      targetEndpoint,
      index
    );
    const duplicateFan = buildDuplicateFan(
      eligibility,
      sourceEndpoint,
      targetEndpoint,
      preRoutingPositionedScene.root,
      index
    );
    if (isDuplicate && (!duplicateFan || duplicateGroupAdmission.get(edge.id) !== true)) {
      diagnostics.push(createRoutingDiagnostic(
        "renderer.routing.journey_map_archetype_fallback",
        `Journey duplicate group for edge "${edge.id}" cannot construct its complete nominal fan.`,
        edge.id,
        "warn",
        JSON.stringify({ relatedIds: eligibility.duplicate?.groupEdgeIds ?? [edge.id] })
      ));
      diagnostics.push(createRoutingDiagnostic(
        "renderer.routing.journey_map_edge_omitted",
        `Journey duplicate edge "${edge.id}" was omitted because its group failed atomically.`,
        edge.id,
        "error",
        JSON.stringify({ relatedIds: eligibility.duplicate?.groupEdgeIds ?? [edge.id] })
      ));
      failedConnectorIds.push(edge.id);
      continue;
    }
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
    const usesBoundaryStageBypass = stageLocalBypass?.boundaryRole !== undefined;
    const step2Route = isSelfLoop && selfLoopTrack
      ? buildSelfLoopRoute(sourceEndpoint, targetEndpoint, selfLoopTrack)
      : isDuplicate && duplicateFan
        ? buildDuplicateFanRoute(sourceEndpoint, targetEndpoint, duplicateFan)
      : usesBoundaryStageBypass && stageLocalBypass
      ? buildBoundaryStageBypassRoute(
        sourceEndpoint,
        targetEndpoint,
        stageLocalBypass,
        rootOuterBypass,
        stageGates,
        branch,
        false
      )
      : usesStageLocalBypass && stageLocalBypass
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
    const provisionalRoute = isSelfLoop && selfLoopTrack
      ? buildSelfLoopRoute(sourceEndpoint, targetEndpoint, selfLoopTrack)
      : isDuplicate && duplicateFan
        ? buildDuplicateFanRoute(sourceEndpoint, targetEndpoint, duplicateFan)
      : usesBoundaryStageBypass && stageLocalBypass
      ? buildBoundaryStageBypassRoute(
        sourceEndpoint,
        targetEndpoint,
        stageLocalBypass,
        rootOuterBypass,
        stageGates,
        branch,
        true
      )
      : usesStageLocalBypass && stageLocalBypass
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
      ...(selfLoopTrack ? { selfLoopTrack } : {}),
      ...(duplicateFan ? { duplicateFan } : {}),
      ...(eligibility.cycleComponent
        ? { cycleComponent: structuredClone(eligibility.cycleComponent) }
        : {}),
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
  const nominalOccupancy = extractJourneyMapOccupancy(connectorPlans, preRoutingPositionedScene);
  const initialResolvedConnectors = connectorPlans.map((plan) =>
    buildInitialResolvedConnectorState(plan, index)
  );
  const reciprocalTrackResolution = resolveSimpleReciprocalTracks(
    connectorPlans,
    initialResolvedConnectors,
    index
  );
  const trackOccupancyResolution = resolveJourneyMapTrackOccupancy(
    connectorPlans,
    reciprocalTrackResolution.resolvedConnectors,
    nominalOccupancy,
    preRoutingPositionedScene,
    index
  );
  const lateOrderedConnectors = applyLateEndpointOrdering(
    connectorPlans,
    trackOccupancyResolution.resolvedConnectors,
    index
  );
  const topologyOrderedConnectors = applySimpleReciprocalEndpointOrdering(
    connectorPlans,
    lateOrderedConnectors,
    index
  );
  const preparedStemResolution = resolveCrowdedPreparedStems(
    connectorPlans,
    topologyOrderedConnectors,
    index
  );
  const lateSeparatedConnectors = resolveLateDirectRunConflicts(
    connectorPlans,
    preparedStemResolution.resolvedConnectors,
    index
  );
  const resolvedConnectors = applyResolvedStageGates(
    lateSeparatedConnectors,
    index
  );
  const expansionRequests = canonicalExpansionRequests([
    ...reciprocalTrackResolution.expansionRequests,
    ...trackOccupancyResolution.expansionRequests,
    ...preparedStemResolution.expansionRequests
  ]);
  const resolutionDiagnostics = sortRendererDiagnostics([
    ...sortedDiagnostics,
    ...validateJourneyMapExpansionBound(expansionAttempts, expansionRequests)
  ]);
  const step3PositionedScene = withResolvedRoutes(
    preRoutingPositionedScene,
    connectorPlans,
    resolvedConnectors,
    (state) => state.preparedRoute,
    resolutionDiagnostics
  );
  const finalPositionedScene = withResolvedRoutes(
    preRoutingPositionedScene,
    connectorPlans,
    resolvedConnectors,
    (state) => state.finalRoute,
    resolutionDiagnostics
  );
  const occupancy = buildFinalJourneyMapOccupancy(
    nominalOccupancy,
    resolvedConnectors,
    connectorPlans,
    finalPositionedScene
  );

  if (expansionRequests.length > 0
    && expansionAttempts.length < MAX_JOURNEY_MAP_EXPANSION_ATTEMPTS) {
    const nextAccumulatedRequests = accumulatedExpansionRequests(
      accumulatedRequests,
      expansionRequests
    );
    const expandedScene = applyJourneyMapExpansionRequests(
      expansionBaselineScene,
      nextAccumulatedRequests
    );
    if (expandedScene) {
      const nextAttempts = [
        ...expansionAttempts,
        {
          attempt: expansionAttempts.length + 1,
          requests: structuredClone(expansionRequests)
        }
      ];
      const expanded = buildJourneyMapRoutingStagesInternal(
        measuredScene,
        expandedScene,
        nextAttempts,
        expansionBaselineScene,
        nextAccumulatedRequests
      );
      const semanticSignature = (plans: readonly JourneyMapConnectorPlan[]) => plans.map((plan) => ({
        id: plan.id,
        from: plan.from,
        to: plan.to,
        ownerContainerId: plan.ownerContainerId,
        archetype: plan.archetype,
        priority: plan.priority,
        authorOrder: plan.authorOrder,
        sameEndpointOrdinal: plan.sameEndpointOrdinal,
        exactIdentityOrdinal: plan.exactIdentityOrdinal,
        source: {
          itemId: plan.sourceEndpoint.itemId,
          portId: plan.sourceEndpoint.portId,
          side: plan.sourceEndpoint.side
        },
        target: {
          itemId: plan.targetEndpoint.itemId,
          portId: plan.targetEndpoint.portId,
          side: plan.targetEndpoint.side
        },
        gates: plan.stageGates.map((gate) => ({
          stageId: gate.stageId, side: gate.side, order: gate.order, locked: gate.locked
        })),
        topologyModifiers: plan.topologyModifiers,
        cycleComponent: plan.cycleComponent,
        duplicateFan: plan.duplicateFan ? {
          policy: plan.duplicateFan.policy,
          groupEdgeIds: plan.duplicateFan.groupEdgeIds,
          groupSize: plan.duplicateFan.groupSize,
          groupOrdinal: plan.duplicateFan.groupOrdinal,
          laneIndex: plan.duplicateFan.laneIndex
        } : undefined,
        role: plan.role,
        classes: plan.classes,
        markers: plan.markers
      }));
      if (JSON.stringify(semanticSignature(expanded.connectorPlans))
        !== JSON.stringify(semanticSignature(connectorPlans))) {
        throw new Error("Journey-map expansion changed an accepted Gate 6 connector signature.");
      }
      return {
        connectorPlans,
        deferredConnectors,
        failedConnectorIds: [...new Set(failedConnectorIds)],
        nodeEdgeBuckets: buildNodeEdgeBuckets(connectorPlans, index),
        nominalOccupancy,
        occupancy: expanded.occupancy,
        resolvedConnectors: expanded.resolvedConnectors,
        expansionAttempts: expanded.expansionAttempts,
        step2PositionedScene,
        provisionalPositionedScene,
        finalBasicPositionedScene,
        step3PositionedScene: expanded.step3PositionedScene,
        finalPositionedScene: expanded.finalPositionedScene,
        diagnostics: expanded.diagnostics
      };
    }
  }

  const resolvedValidationDiagnostics = validateJourneyMapResolvedStages(
    connectorPlans,
    nominalOccupancy,
    occupancy,
    resolvedConnectors,
    expansionAttempts,
    expansionBaselineScene,
    finalPositionedScene
  );
  const terminalDiagnostics = sortRendererDiagnostics([
    ...resolutionDiagnostics,
    ...resolvedValidationDiagnostics
  ]);
  const validatedStep3PositionedScene = withResolvedRoutes(
    preRoutingPositionedScene,
    connectorPlans,
    resolvedConnectors,
    (state) => state.preparedRoute,
    terminalDiagnostics
  );
  const validatedFinalPositionedScene = withResolvedRoutes(
    preRoutingPositionedScene,
    connectorPlans,
    resolvedConnectors,
    (state) => state.finalRoute,
    terminalDiagnostics
  );

  return {
    connectorPlans,
    deferredConnectors,
    failedConnectorIds: [...new Set(failedConnectorIds)],
    nodeEdgeBuckets: buildNodeEdgeBuckets(connectorPlans, index),
    nominalOccupancy,
    occupancy,
    resolvedConnectors,
    expansionAttempts,
    step2PositionedScene,
    provisionalPositionedScene,
    finalBasicPositionedScene,
    step3PositionedScene: validatedStep3PositionedScene,
    finalPositionedScene: validatedFinalPositionedScene,
    diagnostics: sortRendererDiagnostics([
      ...preRoutingPositionedScene.diagnostics,
      ...terminalDiagnostics
    ])
  };
}

export function buildJourneyMapRoutingStages(
  measuredScene: MeasuredScene,
  preRoutingPositionedScene: PositionedScene
): JourneyMapRoutingStages {
  return buildJourneyMapRoutingStagesInternal(
    measuredScene,
    preRoutingPositionedScene,
    [],
    preRoutingPositionedScene,
    []
  );
}
