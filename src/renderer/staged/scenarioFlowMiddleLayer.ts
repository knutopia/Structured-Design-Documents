import type {
  ScenarioFlowRenderEdge,
  ScenarioFlowRenderModel,
  ScenarioFlowRenderNode
} from "../scenarioFlowRenderModel.js";
import {
  createSceneDiagnostic,
  sortRendererDiagnostics,
  type RendererDiagnostic
} from "./diagnostics.js";

export type ScenarioFlowLaneId = "step" | "place" | "view_state";
export type ScenarioFlowBandKind = "entry" | "linear" | "branch_target" | "join" | "parking";
export type ScenarioFlowPlacementRole =
  | "spine_step"
  | "branch_step"
  | "realized_place"
  | "realized_view_state"
  | "parking";
export type ScenarioFlowEdgeChannel =
  | "step_flow"
  | "place_navigation"
  | "view_transition"
  | "realization";

export interface ScenarioFlowBand {
  id: string;
  label: string;
  bandOrder: number;
  kind: ScenarioFlowBandKind;
}

export interface ScenarioFlowComponent {
  id: string;
  order: number;
  nodeIds: string[];
  rowStart: number;
  rowSpan: number;
  hasCycle: boolean;
}

export interface ScenarioFlowTrack {
  id: string;
  label: string;
  componentId: string;
  componentOrder: number;
  localTrackOrder: number;
  rowOrder: number;
}

export interface ScenarioFlowLineage {
  id: string;
  componentId: string;
  trackId: string;
  localTrackOrder: number;
  startBandOrder: number;
  endBandOrder: number;
  originatingDecisionNodeId?: string;
  branchLabel?: string;
  branchLabelSource?: string;
}

export interface ScenarioFlowLaneGuide {
  laneId: ScenarioFlowLaneId;
  label: string;
  order: number;
}

export interface ScenarioFlowCell {
  id: string;
  laneId: ScenarioFlowLaneId;
  bandId: string;
  trackId: string;
  componentId: string;
  lineageId?: string;
  rowOrder: number;
  columnOrder: number;
  trackOrder: number;
  nodeIds: string[];
  sharedWidthGroup: string;
  sharedHeightGroup: string;
}

export interface ScenarioFlowNodePlacement {
  nodeId: string;
  nodeType: string;
  laneId: ScenarioFlowLaneId;
  bandId: string;
  trackId: string;
  componentId: string;
  lineageId: string;
  trackOrder: number;
  rowOrder: number;
  cellId: string;
  placementRole: ScenarioFlowPlacementRole;
  sourceAuthorOrder: number;
}

export interface ScenarioFlowMiddleEdge {
  id: string;
  semanticEdgeIds: string[];
  channel: ScenarioFlowEdgeChannel;
  type: string;
  from: string;
  to: string;
  label?: string;
  branchLabel?: string;
  branchLabelSource?: string;
  authorOrder: number;
}

export interface ScenarioFlowConnectorPlan {
  id: string;
  edgeId: string;
  channel: ScenarioFlowEdgeChannel;
  fromPlacementId?: string;
  toPlacementId?: string;
  priority: number;
}

export interface ScenarioFlowMiddleLayerModel {
  bands: ScenarioFlowBand[];
  components: ScenarioFlowComponent[];
  tracks: ScenarioFlowTrack[];
  lineages: ScenarioFlowLineage[];
  totalTrackRows: number;
  componentGapRows: number;
  laneGuides: ScenarioFlowLaneGuide[];
  cells: ScenarioFlowCell[];
  placements: ScenarioFlowNodePlacement[];
  edges: ScenarioFlowMiddleEdge[];
  connectorPlans: ScenarioFlowConnectorPlan[];
  diagnostics: RendererDiagnostic[];
}

interface StepPlacementSeed {
  node: ScenarioFlowRenderNode;
  position: number;
  componentId: string;
  componentOrder: number;
  lineageId: string;
  trackId: string;
  trackOrder: number;
  rowOrder: number;
  originatingDecisionNodeId?: string;
  branchLabel?: string;
  branchLabelSource?: string;
}

function compareNodeOrder(
  left: Pick<ScenarioFlowRenderNode, "authorOrder" | "id">,
  right: Pick<ScenarioFlowRenderNode, "authorOrder" | "id">
): number {
  return left.authorOrder - right.authorOrder || left.id.localeCompare(right.id);
}

function compareEdgeOrder(
  left: Pick<ScenarioFlowRenderEdge, "authorOrder" | "to" | "id">,
  right: Pick<ScenarioFlowRenderEdge, "authorOrder" | "to" | "id">
): number {
  return left.authorOrder - right.authorOrder || left.to.localeCompare(right.to) || left.id.localeCompare(right.id);
}

function compareBranchEdges(
  left: ScenarioFlowRenderEdge,
  right: ScenarioFlowRenderEdge,
  nodeMap: ReadonlyMap<string, ScenarioFlowRenderNode>
): number {
  return left.authorOrder - right.authorOrder
    || (nodeMap.get(left.to)?.authorOrder ?? Number.MAX_SAFE_INTEGER)
      - (nodeMap.get(right.to)?.authorOrder ?? Number.MAX_SAFE_INTEGER)
    || left.to.localeCompare(right.to)
    || left.id.localeCompare(right.id);
}

function createNodeMap(nodes: readonly ScenarioFlowRenderNode[]): Map<string, ScenarioFlowRenderNode> {
  return new Map(nodes.map((node) => [node.id, node]));
}

function isLaneId(value: string): value is ScenarioFlowLaneId {
  return value === "step" || value === "place" || value === "view_state";
}

function buildLaneByNodeId(model: ScenarioFlowRenderModel): Map<string, ScenarioFlowLaneId> {
  const laneByNodeId = new Map<string, ScenarioFlowLaneId>();

  for (const lane of model.lanes) {
    if (!isLaneId(lane.id)) {
      continue;
    }
    for (const nodeId of lane.nodeIds) {
      laneByNodeId.set(nodeId, lane.id);
    }
  }

  return laneByNodeId;
}

function buildLaneGuides(model: ScenarioFlowRenderModel): ScenarioFlowLaneGuide[] {
  return model.lanes.map((lane, order) => ({
    laneId: lane.id,
    label: lane.label,
    order
  }));
}

function topologicalStepOrder(
  stepNodes: readonly ScenarioFlowRenderNode[],
  stepEdges: readonly ScenarioFlowRenderEdge[]
): {
  ordered: ScenarioFlowRenderNode[];
  hasCycle: boolean;
} {
  const nodeMap = createNodeMap(stepNodes);
  const indegree = new Map(stepNodes.map((node) => [node.id, 0]));
  const outgoing = new Map<string, ScenarioFlowRenderEdge[]>();

  for (const edge of stepEdges) {
    if (!nodeMap.has(edge.from) || !nodeMap.has(edge.to) || edge.from === edge.to) {
      continue;
    }
    const next = outgoing.get(edge.from) ?? [];
    next.push(edge);
    outgoing.set(edge.from, next);
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
  }

  const queue = [...stepNodes]
    .filter((node) => (indegree.get(node.id) ?? 0) === 0)
    .sort(compareNodeOrder);
  const ordered: ScenarioFlowRenderNode[] = [];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const node = queue.shift();
    if (!node || visited.has(node.id)) {
      continue;
    }
    visited.add(node.id);
    ordered.push(node);

    for (const edge of [...(outgoing.get(node.id) ?? [])].sort(compareEdgeOrder)) {
      const nextIndegree = (indegree.get(edge.to) ?? 0) - 1;
      indegree.set(edge.to, nextIndegree);
      if (nextIndegree === 0) {
        const target = nodeMap.get(edge.to);
        if (target) {
          queue.push(target);
          queue.sort(compareNodeOrder);
        }
      }
    }
  }

  return {
    ordered,
    hasCycle: ordered.length !== stepNodes.length
  };
}

interface StepComponentDraft {
  nodes: ScenarioFlowRenderNode[];
  edges: ScenarioFlowRenderEdge[];
}

interface LineageDraft {
  id: string;
  componentId: string;
  nodeIds: string[];
  startPosition: number;
  endPosition: number;
  localTrackOrder: number;
  originatingDecisionNodeId?: string;
  branchLabel?: string;
  branchLabelSource?: string;
  sourceOrder: number;
}

interface DerivedStepLayout {
  seeds: StepPlacementSeed[];
  components: ScenarioFlowComponent[];
  tracks: ScenarioFlowTrack[];
  lineages: ScenarioFlowLineage[];
  totalTrackRows: number;
}

function findStepComponents(
  nodes: readonly ScenarioFlowRenderNode[],
  edges: readonly ScenarioFlowRenderEdge[]
): StepComponentDraft[] {
  const nodeMap = createNodeMap(nodes);
  const adjacency = new Map(nodes.map((node) => [node.id, new Set<string>()]));
  for (const edge of edges) {
    if (!nodeMap.has(edge.from) || !nodeMap.has(edge.to)) {
      continue;
    }
    adjacency.get(edge.from)?.add(edge.to);
    adjacency.get(edge.to)?.add(edge.from);
  }

  const visited = new Set<string>();
  const components: StepComponentDraft[] = [];
  for (const root of [...nodes].sort(compareNodeOrder)) {
    if (visited.has(root.id)) {
      continue;
    }
    const queue = [root.id];
    const componentNodeIds = new Set<string>();
    visited.add(root.id);
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        continue;
      }
      componentNodeIds.add(current);
      const neighbors = [...(adjacency.get(current) ?? [])]
        .map((id) => nodeMap.get(id))
        .filter((node): node is ScenarioFlowRenderNode => node !== undefined)
        .sort(compareNodeOrder);
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.id)) {
          visited.add(neighbor.id);
          queue.push(neighbor.id);
        }
      }
    }
    components.push({
      nodes: [...componentNodeIds]
        .map((id) => nodeMap.get(id))
        .filter((node): node is ScenarioFlowRenderNode => node !== undefined)
        .sort(compareNodeOrder),
      edges: edges
        .filter((edge) => componentNodeIds.has(edge.from) && componentNodeIds.has(edge.to))
        .sort(compareEdgeOrder)
    });
  }
  return components;
}

function intervalsOverlap(
  left: Pick<LineageDraft, "startPosition" | "endPosition">,
  right: Pick<LineageDraft, "startPosition" | "endPosition">
): boolean {
  return left.startPosition <= right.endPosition && right.startPosition <= left.endPosition;
}

function deriveStepLayout(
  model: ScenarioFlowRenderModel,
  diagnostics: RendererDiagnostic[]
): DerivedStepLayout {
  const primaryLane = model.lanes.find((lane) => lane.id === model.layout.primary_lane_id);
  const primaryNodeIds = new Set(primaryLane?.nodeIds ?? []);
  const stepNodes = model.nodes
    .filter((node) => primaryNodeIds.has(node.id))
    .sort(compareNodeOrder);
  const orderingEdgeTypes = new Set(model.orderingEdgeTypes);
  const stepEdges = model.edges
    .filter((edge) => orderingEdgeTypes.has(edge.type)
      && primaryNodeIds.has(edge.from)
      && primaryNodeIds.has(edge.to))
    .sort(compareEdgeOrder);

  if (stepNodes.length === 0) {
    diagnostics.push(
      createSceneDiagnostic(
        "renderer.scene.scenario_flow_missing_step_spine",
        "Scenario flow projection did not include primary-lane nodes. Parking scoped nodes deterministically.",
        { severity: "info" }
      )
    );
    return { seeds: [], components: [], tracks: [], lineages: [], totalTrackRows: 0 };
  }

  if (stepEdges.length === 0) {
    diagnostics.push(
      createSceneDiagnostic(
        "renderer.scene.scenario_flow_no_step_flow",
        "Scenario flow projection did not include primary ordering edges. Treating primary-lane nodes as independent flows.",
        { severity: "info" }
      )
    );
  }

  const componentDrafts = findStepComponents(stepNodes, stepEdges);
  const seeds: StepPlacementSeed[] = [];
  const components: ScenarioFlowComponent[] = [];
  const tracks: ScenarioFlowTrack[] = [];
  const lineages: ScenarioFlowLineage[] = [];
  let rowCursor = 0;

  componentDrafts.forEach((componentDraft, componentOrder) => {
    const componentId = `component:${componentOrder + 1}`;
    const { ordered, hasCycle } = topologicalStepOrder(componentDraft.nodes, componentDraft.edges);
    const orderedNodes = hasCycle ? [...componentDraft.nodes].sort(compareNodeOrder) : ordered;
    const positionByNodeId = new Map<string, number>();
    const incomingByTargetId = new Map<string, ScenarioFlowRenderEdge[]>();
    const outgoingBySourceId = new Map<string, ScenarioFlowRenderEdge[]>();
    const componentNodeMap = createNodeMap(componentDraft.nodes);

    for (const edge of componentDraft.edges) {
      const incoming = incomingByTargetId.get(edge.to) ?? [];
      incoming.push(edge);
      incomingByTargetId.set(edge.to, incoming);
      const outgoing = outgoingBySourceId.get(edge.from) ?? [];
      outgoing.push(edge);
      outgoingBySourceId.set(edge.from, outgoing);
    }
    for (const edges of incomingByTargetId.values()) {
      edges.sort((left, right) => compareBranchEdges(left, right, componentNodeMap));
    }
    for (const edges of outgoingBySourceId.values()) {
      edges.sort((left, right) => compareBranchEdges(left, right, componentNodeMap));
    }

    if (hasCycle) {
      diagnostics.push(
        createSceneDiagnostic(
          "renderer.scene.scenario_flow_step_cycle",
          `Scenario flow component "${componentId}" contains a primary ordering cycle. Falling back to source-order chronology for that component.`,
          { targetId: orderedNodes[0]?.id, severity: "warn" }
        )
      );
      orderedNodes.forEach((node, index) => positionByNodeId.set(node.id, index));
    } else {
      for (const node of orderedNodes) {
        const incoming = incomingByTargetId.get(node.id) ?? [];
        const position = incoming.length === 0
          ? 0
          : Math.max(...incoming.map((edge) => (positionByNodeId.get(edge.from) ?? 0) + 1));
        positionByNodeId.set(node.id, position);
      }
    }

    const lineageDrafts: LineageDraft[] = [];
    const lineageByNodeId = new Map<string, LineageDraft>();
    if (hasCycle) {
      lineageDrafts.push({
        id: `${componentId}__lineage:1`,
        componentId,
        nodeIds: orderedNodes.map((node) => node.id),
        startPosition: 0,
        endPosition: Math.max(0, orderedNodes.length - 1),
        localTrackOrder: 0,
        sourceOrder: orderedNodes[0]?.authorOrder ?? 0
      });
      for (const node of orderedNodes) {
        lineageByNodeId.set(node.id, lineageDrafts[0]!);
      }
    } else {
      const continuationEdgeIds = new Set<string>();
      for (const edge of componentDraft.edges) {
        if (incomingByTargetId.get(edge.to)?.[0]?.id === edge.id
          && outgoingBySourceId.get(edge.from)?.[0]?.id === edge.id) {
          continuationEdgeIds.add(edge.id);
        }
      }

      for (const node of orderedNodes) {
        const incoming = incomingByTargetId.get(node.id) ?? [];
        const continuationEdge = incoming.find((edge) => continuationEdgeIds.has(edge.id));
        const inherited = continuationEdge ? lineageByNodeId.get(continuationEdge.from) : undefined;
        if (inherited) {
          inherited.nodeIds.push(node.id);
          inherited.endPosition = Math.max(inherited.endPosition, positionByNodeId.get(node.id) ?? 0);
          lineageByNodeId.set(node.id, inherited);
          continue;
        }

        const originEdge = incoming[0];
        const sourceOutgoing = originEdge ? outgoingBySourceId.get(originEdge.from) ?? [] : [];
        const position = positionByNodeId.get(node.id) ?? 0;
        const lineage: LineageDraft = {
          id: `${componentId}__lineage:${lineageDrafts.length + 1}`,
          componentId,
          nodeIds: [node.id],
          startPosition: position,
          endPosition: position,
          localTrackOrder: 0,
          originatingDecisionNodeId: sourceOutgoing.length > 1 ? originEdge?.from : undefined,
          branchLabel: sourceOutgoing.length > 1 ? originEdge?.branchLabel : undefined,
          branchLabelSource: sourceOutgoing.length > 1 ? originEdge?.branchLabelSource : undefined,
          sourceOrder: originEdge?.authorOrder ?? node.authorOrder
        };
        lineageDrafts.push(lineage);
        lineageByNodeId.set(node.id, lineage);
      }

      const assignedByTrack = new Map<number, LineageDraft[]>();
      for (const lineage of [...lineageDrafts].sort((left, right) =>
        left.startPosition - right.startPosition
        || left.sourceOrder - right.sourceOrder
        || left.id.localeCompare(right.id))) {
        let trackOrder = 0;
        while ((assignedByTrack.get(trackOrder) ?? []).some((assigned) => intervalsOverlap(assigned, lineage))) {
          trackOrder += 1;
        }
        lineage.localTrackOrder = trackOrder;
        const assigned = assignedByTrack.get(trackOrder) ?? [];
        assigned.push(lineage);
        assignedByTrack.set(trackOrder, assigned);
      }
    }

    const rowSpan = Math.max(1, ...lineageDrafts.map((lineage) => lineage.localTrackOrder + 1));
    const component: ScenarioFlowComponent = {
      id: componentId,
      order: componentOrder,
      nodeIds: orderedNodes.map((node) => node.id),
      rowStart: rowCursor,
      rowSpan,
      hasCycle
    };
    components.push(component);

    for (let localTrackOrder = 0; localTrackOrder < rowSpan; localTrackOrder += 1) {
      tracks.push({
        id: `${componentId}__track:${localTrackOrder}`,
        label: `T${localTrackOrder}`,
        componentId,
        componentOrder,
        localTrackOrder,
        rowOrder: rowCursor + localTrackOrder
      });
    }
    const trackByLocalOrder = new Map(tracks
      .filter((track) => track.componentId === componentId)
      .map((track) => [track.localTrackOrder, track] as const));
    for (const lineage of lineageDrafts) {
      const track = trackByLocalOrder.get(lineage.localTrackOrder)!;
      lineages.push({
        id: lineage.id,
        componentId,
        trackId: track.id,
        localTrackOrder: lineage.localTrackOrder,
        startBandOrder: lineage.startPosition,
        endBandOrder: lineage.endPosition,
        originatingDecisionNodeId: lineage.originatingDecisionNodeId,
        branchLabel: lineage.branchLabel,
        branchLabelSource: lineage.branchLabelSource
      });
    }
    for (const node of orderedNodes) {
      const lineage = lineageByNodeId.get(node.id)!;
      const track = trackByLocalOrder.get(lineage.localTrackOrder)!;
      seeds.push({
        node,
        position: positionByNodeId.get(node.id) ?? 0,
        componentId,
        componentOrder,
        lineageId: lineage.id,
        trackId: track.id,
        trackOrder: lineage.localTrackOrder,
        rowOrder: track.rowOrder,
        originatingDecisionNodeId: lineage.originatingDecisionNodeId,
        branchLabel: lineage.branchLabel,
        branchLabelSource: lineage.branchLabelSource
      });
    }

    rowCursor += rowSpan;
    if (componentOrder < componentDrafts.length - 1) {
      rowCursor += model.layout.component_gap_rows;
    }
  });

  return {
    seeds,
    components,
    tracks,
    lineages,
    totalTrackRows: Math.max(1, rowCursor)
  };
}

function buildBands(
  seeds: readonly StepPlacementSeed[],
  model: ScenarioFlowRenderModel
): ScenarioFlowBand[] {
  const positionSet = new Set(seeds.map((seed) => seed.position));
  const positionByStepId = new Map(seeds.map((seed) => [seed.node.id, seed.position]));
  const incomingByPosition = new Map<number, ScenarioFlowRenderEdge[]>();
  const incomingCountByStepId = new Map<string, number>();
  const outgoingCountByStepId = new Map<string, number>();

  const orderingEdgeTypes = new Set(model.orderingEdgeTypes);
  for (const edge of model.edges.filter((candidate) => orderingEdgeTypes.has(candidate.type))) {
    const targetPosition = positionByStepId.get(edge.to);
    if (targetPosition !== undefined) {
      const incoming = incomingByPosition.get(targetPosition) ?? [];
      incoming.push(edge);
      incomingByPosition.set(targetPosition, incoming);
      incomingCountByStepId.set(edge.to, (incomingCountByStepId.get(edge.to) ?? 0) + 1);
      outgoingCountByStepId.set(edge.from, (outgoingCountByStepId.get(edge.from) ?? 0) + 1);
    }
  }

  return [...positionSet]
    .sort((left, right) => left - right)
    .map<ScenarioFlowBand>((position, bandOrder) => {
      const incoming = incomingByPosition.get(position) ?? [];
      const hasJoin = incoming.some((edge) => (incomingCountByStepId.get(edge.to) ?? 0) > 1);
      const hasBranchTarget = incoming.some((edge) => (outgoingCountByStepId.get(edge.from) ?? 0) > 1);
      const kind: ScenarioFlowBand["kind"] = bandOrder === 0
        ? "entry"
        : hasJoin
          ? "join"
          : hasBranchTarget
            ? "branch_target"
            : "linear";
      return {
        id: `band:${bandOrder + 1}`,
        label: `C${bandOrder + 1}`,
        bandOrder,
        kind
      };
    });
}

function needsParkingBand(
  model: ScenarioFlowRenderModel,
  seeds: readonly StepPlacementSeed[]
): boolean {
  if (model.nodes.length === 0) {
    return false;
  }

  const placedStepIds = new Set(seeds.map((seed) => seed.node.id));
  const realizedTargetIds = new Set(
    model.edges
      .filter((edge) => edge.type === "REALIZED_BY" && placedStepIds.has(edge.from))
      .map((edge) => edge.to)
  );

  return model.nodes.some((node) => node.type === "Step"
    ? !placedStepIds.has(node.id)
    : !realizedTargetIds.has(node.id));
}

function resolveEdgeChannel(edge: ScenarioFlowRenderEdge): ScenarioFlowEdgeChannel {
  switch (edge.type) {
    case "PRECEDES":
      return "step_flow";
    case "NAVIGATES_TO":
      return "place_navigation";
    case "TRANSITIONS_TO":
      return "view_transition";
    case "REALIZED_BY":
    default:
      return "realization";
  }
}

function resolvePlacementRole(nodeType: string, trackOrder: number): ScenarioFlowPlacementRole {
  switch (nodeType) {
    case "Step":
      return trackOrder > 0 ? "branch_step" : "spine_step";
    case "Place":
      return "realized_place";
    case "ViewState":
      return "realized_view_state";
    default:
      return "parking";
  }
}

function buildCellsAndPlacements(
  model: ScenarioFlowRenderModel,
  nodeMap: ReadonlyMap<string, ScenarioFlowRenderNode>,
  laneByNodeId: ReadonlyMap<string, ScenarioFlowLaneId>,
  bands: readonly ScenarioFlowBand[],
  tracks: readonly ScenarioFlowTrack[],
  lineages: readonly ScenarioFlowLineage[],
  seeds: readonly StepPlacementSeed[],
  diagnostics: RendererDiagnostic[]
): {
  cells: ScenarioFlowCell[];
  placements: ScenarioFlowNodePlacement[];
} {
  const bandByPosition = new Map<number, ScenarioFlowBand>();
  [...new Set(seeds.map((seed) => seed.position))]
    .sort((left, right) => left - right)
    .forEach((position, index) => {
      const band = bands[index];
      if (band) {
        bandByPosition.set(position, band);
      }
    });
  const parkingBand = bands.find((band) => band.kind === "parking");
  const parkingTrack = parkingBand ? tracks[0] : undefined;
  const trackById = new Map(tracks.map((track) => [track.id, track] as const));
  const activeLineageByTrackAndBand = new Map<string, ScenarioFlowLineage>();
  for (const lineage of lineages) {
    for (let bandOrder = lineage.startBandOrder; bandOrder <= lineage.endBandOrder; bandOrder += 1) {
      activeLineageByTrackAndBand.set(`${lineage.trackId}::${bandOrder}`, lineage);
    }
  }
  const stepPlacementByNodeId = new Map<string, {
    bandId: string;
    trackId: string;
    componentId: string;
    lineageId: string;
    trackOrder: number;
    rowOrder: number;
  }>();

  for (const seed of seeds) {
    const band = bandByPosition.get(seed.position);
    const track = trackById.get(seed.trackId);
    if (!band || !track) {
      continue;
    }
    stepPlacementByNodeId.set(seed.node.id, {
      bandId: band.id,
      trackId: track.id,
      componentId: seed.componentId,
      lineageId: seed.lineageId,
      trackOrder: track.localTrackOrder,
      rowOrder: track.rowOrder
    });
  }

  const nodePlacementTargetByNodeId = new Map<string, {
    laneId: ScenarioFlowLaneId;
    bandId: string;
    trackId: string;
    componentId: string;
    lineageId: string;
    trackOrder: number;
    rowOrder: number;
    placementRole: ScenarioFlowPlacementRole;
  }>();

  for (const seed of seeds) {
    const placement = stepPlacementByNodeId.get(seed.node.id);
    if (!placement) {
      continue;
    }
    nodePlacementTargetByNodeId.set(seed.node.id, {
      laneId: "step",
      bandId: placement.bandId,
      trackId: placement.trackId,
      componentId: placement.componentId,
      lineageId: placement.lineageId,
      trackOrder: placement.trackOrder,
      rowOrder: placement.rowOrder,
      placementRole: resolvePlacementRole(seed.node.type, placement.trackOrder)
    });
  }

  const realizationEdges = model.edges
    .filter((edge) => edge.type === "REALIZED_BY")
    .sort(compareEdgeOrder);
  for (const edge of realizationEdges) {
    const sourcePlacement = stepPlacementByNodeId.get(edge.from);
    const target = nodeMap.get(edge.to);
    const laneId = laneByNodeId.get(edge.to);
    if (!sourcePlacement || !target || !laneId || laneId === "step") {
      continue;
    }
    nodePlacementTargetByNodeId.set(edge.to, {
      laneId,
      bandId: sourcePlacement.bandId,
      trackId: sourcePlacement.trackId,
      componentId: sourcePlacement.componentId,
      lineageId: sourcePlacement.lineageId,
      trackOrder: sourcePlacement.trackOrder,
      rowOrder: sourcePlacement.rowOrder,
      placementRole: resolvePlacementRole(target.type, sourcePlacement.trackOrder)
    });
  }

  for (const node of model.nodes) {
    if (nodePlacementTargetByNodeId.has(node.id)) {
      continue;
    }
    const laneId = laneByNodeId.get(node.id);
    if (!laneId) {
      continue;
    }
    diagnostics.push(
      createSceneDiagnostic(
        "renderer.scene.scenario_flow_disconnected_scoped_node",
        `Could not connect "${node.id}" to the Step spine through scenario-flow semantics. Assigning it to deterministic parking.`,
        {
          targetId: node.id,
          severity: "info"
        }
      )
    );
    if (parkingBand && parkingTrack) {
      nodePlacementTargetByNodeId.set(node.id, {
        laneId,
        bandId: parkingBand.id,
        trackId: parkingTrack.id,
        componentId: parkingTrack.componentId,
        lineageId: "lineage:parking",
        trackOrder: parkingTrack.localTrackOrder,
        rowOrder: parkingTrack.rowOrder,
        placementRole: "parking"
      });
    }
  }

  const nodesByCellId = new Map<string, ScenarioFlowRenderNode[]>();
  for (const [nodeId, target] of nodePlacementTargetByNodeId.entries()) {
    const node = nodeMap.get(nodeId);
    if (!node) {
      continue;
    }
    const cellId = `${target.laneId}__cell__${target.bandId}__${target.trackId}`;
    const nodes = nodesByCellId.get(cellId) ?? [];
    nodes.push(node);
    nodesByCellId.set(cellId, nodes);
  }

  const cells: ScenarioFlowCell[] = [];
  const placements: ScenarioFlowNodePlacement[] = [];

  for (const track of tracks) {
    for (const band of bands) {
      const activeLineage = activeLineageByTrackAndBand.get(`${track.id}::${band.bandOrder}`);
      if (!activeLineage) {
        continue;
      }
      for (const lane of model.lanes) {
        const cellId = `${lane.id}__cell__${band.id}__${track.id}`;
        const nodeIds = (nodesByCellId.get(cellId) ?? [])
          .sort(compareNodeOrder)
          .map((node) => node.id);
        const lineageId = nodeIds
          .map((nodeId) => nodePlacementTargetByNodeId.get(nodeId)?.lineageId)
          .find((value): value is string => value !== undefined) ?? activeLineage.id;
        cells.push({
          id: cellId,
          laneId: lane.id,
          bandId: band.id,
          trackId: track.id,
          componentId: track.componentId,
          lineageId,
          rowOrder: track.rowOrder,
          columnOrder: band.bandOrder,
          trackOrder: track.localTrackOrder,
          nodeIds,
          sharedWidthGroup: band.kind === "parking"
            ? "scenario_flow:cell:parking"
            : "scenario_flow:cell:semantic",
          sharedHeightGroup: `scenario_flow:lane:${lane.id}`
        });

        nodeIds.forEach((nodeId) => {
          const node = nodeMap.get(nodeId);
          const target = nodePlacementTargetByNodeId.get(nodeId);
          if (!node || !target) {
            return;
          }
          placements.push({
            nodeId,
            nodeType: node.type,
            laneId: target.laneId,
            bandId: target.bandId,
            trackId: target.trackId,
            componentId: target.componentId,
            lineageId: target.lineageId,
            trackOrder: target.trackOrder,
            rowOrder: target.rowOrder,
            cellId,
            placementRole: target.placementRole,
            sourceAuthorOrder: node.authorOrder
          });
        });
      }
    }
  }

  return {
    cells,
    placements
  };
}

function buildMiddleEdges(edges: readonly ScenarioFlowRenderEdge[]): ScenarioFlowMiddleEdge[] {
  return [...edges]
    .sort((left, right) => left.authorOrder - right.authorOrder || left.id.localeCompare(right.id))
    .map((edge) => ({
      id: edge.id,
      semanticEdgeIds: [edge.id],
      channel: resolveEdgeChannel(edge),
      type: edge.type,
      from: edge.from,
      to: edge.to,
      label: edge.label,
      branchLabel: edge.branchLabel,
      branchLabelSource: edge.branchLabelSource,
      authorOrder: edge.authorOrder
    }));
}

function connectorPriority(channel: ScenarioFlowEdgeChannel): number {
  switch (channel) {
    case "step_flow":
      return 0;
    case "place_navigation":
      return 1;
    case "view_transition":
      return 2;
    case "realization":
    default:
      return 3;
  }
}

function buildConnectorPlans(
  edges: readonly ScenarioFlowMiddleEdge[],
  placements: readonly ScenarioFlowNodePlacement[]
): ScenarioFlowConnectorPlan[] {
  const placementByNodeId = new Map(placements.map((placement) => [placement.nodeId, placement] as const));

  return [...edges]
    .sort((left, right) => connectorPriority(left.channel) - connectorPriority(right.channel)
      || left.authorOrder - right.authorOrder
      || left.id.localeCompare(right.id))
    .map((edge, index) => ({
      id: `connector:${index + 1}:${edge.id}`,
      edgeId: edge.id,
      channel: edge.channel,
      fromPlacementId: placementByNodeId.get(edge.from)?.cellId,
      toPlacementId: placementByNodeId.get(edge.to)?.cellId,
      priority: index
    }));
}

export function buildScenarioFlowMiddleLayer(
  model: ScenarioFlowRenderModel
): ScenarioFlowMiddleLayerModel {
  const nodeMap = createNodeMap(model.nodes);
  const laneByNodeId = buildLaneByNodeId(model);
  const diagnostics: RendererDiagnostic[] = [];
  const stepLayout = deriveStepLayout(model, diagnostics);
  const stepPlacementSeeds = stepLayout.seeds;
  const semanticBands = buildBands(stepPlacementSeeds, model);
  const parkingBand: ScenarioFlowBand[] = needsParkingBand(model, stepPlacementSeeds)
    ? [{
        id: "band:parking:1",
        label: "P1",
        bandOrder: semanticBands.length,
        kind: "parking"
      }]
    : [];
  const bands = [...semanticBands, ...parkingBand];
  const tracks = [...stepLayout.tracks];
  if (tracks.length === 0 && parkingBand.length > 0) {
    tracks.push({
      id: "component:parking__track:0",
      label: "T0",
      componentId: "component:parking",
      componentOrder: stepLayout.components.length,
      localTrackOrder: 0,
      rowOrder: 0
    });
  }
  const lineages = [...stepLayout.lineages];
  if (parkingBand.length > 0 && tracks[0]) {
    lineages.push({
      id: "lineage:parking",
      componentId: tracks[0].componentId,
      trackId: tracks[0].id,
      localTrackOrder: tracks[0].localTrackOrder,
      startBandOrder: parkingBand[0]!.bandOrder,
      endBandOrder: parkingBand[0]!.bandOrder
    });
  }
  const { cells, placements } = buildCellsAndPlacements(
    model,
    nodeMap,
    laneByNodeId,
    bands,
    tracks,
    lineages,
    stepPlacementSeeds,
    diagnostics
  );
  const edges = buildMiddleEdges(model.edges);
  const connectorPlans = buildConnectorPlans(edges, placements);

  return {
    bands,
    components: stepLayout.components,
    tracks,
    lineages,
    totalTrackRows: Math.max(stepLayout.totalTrackRows, tracks.length > 0 ? 1 : 0),
    componentGapRows: model.layout.component_gap_rows,
    laneGuides: buildLaneGuides(model),
    cells,
    placements,
    edges,
    connectorPlans,
    diagnostics: sortRendererDiagnostics(diagnostics)
  };
}
