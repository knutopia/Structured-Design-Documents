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

export interface ScenarioFlowTrack {
  id: string;
  label: string;
  bandId: string;
  trackOrder: number;
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
  tracks: ScenarioFlowTrack[];
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
  trackOrder: number;
  originatingDecisionNodeId?: string;
  branchLabel?: string;
  branchLabelSource?: string;
}

const FIXED_LANES: Array<{ id: ScenarioFlowLaneId; label: string }> = [
  { id: "step", label: "Steps" },
  { id: "place", label: "Places" },
  { id: "view_state", label: "View States" }
];

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

function compareBranchEdges(left: ScenarioFlowRenderEdge, right: ScenarioFlowRenderEdge): number {
  return (left.branchLabelSource ?? "").localeCompare(right.branchLabelSource ?? "")
    || left.authorOrder - right.authorOrder
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

function fallbackLaneForType(nodeType: string): ScenarioFlowLaneId | undefined {
  switch (nodeType) {
    case "Step":
      return "step";
    case "Place":
      return "place";
    case "ViewState":
      return "view_state";
    default:
      return undefined;
  }
}

function buildLaneGuides(): ScenarioFlowLaneGuide[] {
  return FIXED_LANES.map((lane, order) => ({
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

function deriveStepPlacementSeeds(
  model: ScenarioFlowRenderModel,
  nodeMap: ReadonlyMap<string, ScenarioFlowRenderNode>,
  diagnostics: RendererDiagnostic[]
): StepPlacementSeed[] {
  const stepNodes = model.nodes
    .filter((node) => node.type === "Step")
    .sort(compareNodeOrder);
  const stepNodeIds = new Set(stepNodes.map((node) => node.id));
  const stepEdges = model.edges
    .filter((edge) => edge.type === "PRECEDES" && stepNodeIds.has(edge.from) && stepNodeIds.has(edge.to))
    .sort(compareEdgeOrder);

  if (stepNodes.length === 0) {
    diagnostics.push(
      createSceneDiagnostic(
        "renderer.scene.scenario_flow_missing_step_spine",
        "Scenario flow projection did not include Step nodes. Parking scoped nodes deterministically.",
        { severity: "info" }
      )
    );
    return [];
  }

  if (stepEdges.length === 0) {
    diagnostics.push(
      createSceneDiagnostic(
        "renderer.scene.scenario_flow_no_step_flow",
        "Scenario flow projection did not include Step PRECEDES edges. Falling back to author-order chronology.",
        { severity: "info" }
      )
    );
    return stepNodes.map((node, index) => ({
      node,
      position: index,
      trackOrder: 0
    }));
  }

  const { ordered, hasCycle } = topologicalStepOrder(stepNodes, stepEdges);
  if (hasCycle) {
    diagnostics.push(
      createSceneDiagnostic(
        "renderer.scene.scenario_flow_step_cycle",
        "Scenario flow Step PRECEDES edges contain a cycle. Falling back to author-order chronology.",
        { severity: "warn" }
      )
    );
    return stepNodes.map((node, index) => ({
      node,
      position: index,
      trackOrder: 0
    }));
  }

  const incomingCountByNodeId = new Map(stepNodes.map((node) => [node.id, 0]));
  const outgoingBySourceId = new Map<string, ScenarioFlowRenderEdge[]>();
  for (const edge of stepEdges) {
    incomingCountByNodeId.set(edge.to, (incomingCountByNodeId.get(edge.to) ?? 0) + 1);
    const outgoing = outgoingBySourceId.get(edge.from) ?? [];
    outgoing.push(edge);
    outgoingBySourceId.set(edge.from, outgoing);
  }

  const positionByNodeId = new Map<string, number>();
  for (const node of ordered) {
    if ((incomingCountByNodeId.get(node.id) ?? 0) === 0) {
      positionByNodeId.set(node.id, 0);
    }
    const sourcePosition = positionByNodeId.get(node.id) ?? 0;
    for (const edge of [...(outgoingBySourceId.get(node.id) ?? [])].sort(compareEdgeOrder)) {
      const candidate = sourcePosition + 1;
      const current = positionByNodeId.get(edge.to);
      if (current === undefined || candidate > current) {
        positionByNodeId.set(edge.to, candidate);
      }
    }
  }

  const branchSeedByTargetId = new Map<string, Pick<StepPlacementSeed,
    "trackOrder" | "originatingDecisionNodeId" | "branchLabel" | "branchLabelSource"
  >>();
  for (const [sourceId, outgoing] of outgoingBySourceId.entries()) {
    if (outgoing.length < 2) {
      continue;
    }
    [...outgoing].sort(compareBranchEdges).forEach((edge, index) => {
      branchSeedByTargetId.set(edge.to, {
        trackOrder: index,
        originatingDecisionNodeId: sourceId,
        branchLabel: edge.branchLabel,
        branchLabelSource: edge.branchLabelSource
      });
    });
  }

  const connectedStepIds = new Set(stepEdges.flatMap((edge) => [edge.from, edge.to]));
  for (const node of stepNodes) {
    if (!connectedStepIds.has(node.id)) {
      diagnostics.push(
        createSceneDiagnostic(
          "renderer.scene.scenario_flow_disconnected_step",
          `Step "${node.id}" is disconnected from the Step PRECEDES spine. Placing it deterministically in chronology.`,
          {
            targetId: node.id,
            severity: "info"
          }
        )
      );
    }
  }

  return stepNodes.map((node) => {
    const branchSeed = branchSeedByTargetId.get(node.id);
    return {
      node,
      position: positionByNodeId.get(node.id) ?? 0,
      trackOrder: branchSeed?.trackOrder ?? 0,
      originatingDecisionNodeId: branchSeed?.originatingDecisionNodeId,
      branchLabel: branchSeed?.branchLabel,
      branchLabelSource: branchSeed?.branchLabelSource
    };
  });
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

  for (const edge of model.edges.filter((candidate) => candidate.type === "PRECEDES")) {
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

function buildTracks(
  bands: readonly ScenarioFlowBand[],
  seeds: readonly StepPlacementSeed[]
): ScenarioFlowTrack[] {
  const bandByPosition = new Map<number, ScenarioFlowBand>();
  [...new Set(seeds.map((seed) => seed.position))]
    .sort((left, right) => left - right)
    .forEach((position, index) => {
      const band = bands[index];
      if (band) {
        bandByPosition.set(position, band);
      }
    });

  const trackSeedByKey = new Map<string, StepPlacementSeed>();
  for (const seed of seeds) {
    const band = bandByPosition.get(seed.position);
    if (!band) {
      continue;
    }
    const key = `${band.id}::${seed.trackOrder}`;
    const existing = trackSeedByKey.get(key);
    if (!existing || compareNodeOrder(seed.node, existing.node) < 0) {
      trackSeedByKey.set(key, seed);
    }
  }

  return [...trackSeedByKey.entries()]
    .sort((left, right) => {
      const [leftBandId, leftTrackOrder] = left[0].split("::");
      const [rightBandId, rightTrackOrder] = right[0].split("::");
      const leftBand = bands.find((band) => band.id === leftBandId);
      const rightBand = bands.find((band) => band.id === rightBandId);
      return (leftBand?.bandOrder ?? 0) - (rightBand?.bandOrder ?? 0)
        || Number(leftTrackOrder) - Number(rightTrackOrder);
    })
    .map(([key, seed]) => {
      const [bandId, trackOrderText] = key.split("::");
      const trackOrder = Number(trackOrderText);
      return {
        id: `${bandId}__track:${trackOrder}`,
        label: `T${trackOrder}`,
        bandId,
        trackOrder,
        originatingDecisionNodeId: seed.originatingDecisionNodeId,
        branchLabel: seed.branchLabel,
        branchLabelSource: seed.branchLabelSource
      } satisfies ScenarioFlowTrack;
    });
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
  const trackByBandAndOrder = new Map(tracks.map((track) => [`${track.bandId}::${track.trackOrder}`, track] as const));
  const parkingBand = bands.find((band) => band.kind === "parking");
  const parkingTrack = parkingBand ? tracks.find((track) => track.bandId === parkingBand.id) : undefined;
  const stepPlacementByNodeId = new Map<string, { bandId: string; trackId: string; trackOrder: number }>();

  for (const seed of seeds) {
    const band = bandByPosition.get(seed.position);
    const track = band ? trackByBandAndOrder.get(`${band.id}::${seed.trackOrder}`) : undefined;
    if (!band || !track) {
      continue;
    }
    stepPlacementByNodeId.set(seed.node.id, {
      bandId: band.id,
      trackId: track.id,
      trackOrder: track.trackOrder
    });
  }

  const nodePlacementTargetByNodeId = new Map<string, {
    laneId: ScenarioFlowLaneId;
    bandId: string;
    trackId: string;
    trackOrder: number;
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
      trackOrder: placement.trackOrder,
      placementRole: resolvePlacementRole(seed.node.type, placement.trackOrder)
    });
  }

  const realizationEdges = model.edges
    .filter((edge) => edge.type === "REALIZED_BY")
    .sort(compareEdgeOrder);
  for (const edge of realizationEdges) {
    const sourcePlacement = stepPlacementByNodeId.get(edge.from);
    const target = nodeMap.get(edge.to);
    const laneId = laneByNodeId.get(edge.to) ?? (target ? fallbackLaneForType(target.type) : undefined);
    if (!sourcePlacement || !target || !laneId || laneId === "step") {
      continue;
    }
    nodePlacementTargetByNodeId.set(edge.to, {
      laneId,
      bandId: sourcePlacement.bandId,
      trackId: sourcePlacement.trackId,
      trackOrder: sourcePlacement.trackOrder,
      placementRole: resolvePlacementRole(target.type, sourcePlacement.trackOrder)
    });
  }

  for (const node of model.nodes) {
    if (nodePlacementTargetByNodeId.has(node.id)) {
      continue;
    }
    const laneId = laneByNodeId.get(node.id) ?? fallbackLaneForType(node.type);
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
        trackOrder: parkingTrack.trackOrder,
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
    const cellId = `${target.laneId}__cell__${target.trackId}`;
    const nodes = nodesByCellId.get(cellId) ?? [];
    nodes.push(node);
    nodesByCellId.set(cellId, nodes);
  }

  const laneOrderById = new Map(FIXED_LANES.map((lane, index) => [lane.id, index] as const));
  const bandById = new Map(bands.map((band) => [band.id, band] as const));
  const cells: ScenarioFlowCell[] = [];
  const placements: ScenarioFlowNodePlacement[] = [];

  for (const track of tracks) {
    const band = bandById.get(track.bandId);
    if (!band) {
      continue;
    }
    for (const lane of FIXED_LANES) {
      const cellId = `${lane.id}__cell__${track.id}`;
      const nodeIds = (nodesByCellId.get(cellId) ?? [])
        .sort(compareNodeOrder)
        .map((node) => node.id);
      cells.push({
        id: cellId,
        laneId: lane.id,
        bandId: track.bandId,
        trackId: track.id,
        rowOrder: laneOrderById.get(lane.id) ?? 0,
        columnOrder: band.bandOrder,
        trackOrder: track.trackOrder,
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
          cellId,
          placementRole: target.placementRole,
          sourceAuthorOrder: node.authorOrder
        });
      });
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
  const stepPlacementSeeds = deriveStepPlacementSeeds(model, nodeMap, diagnostics);
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
  const semanticTracks = buildTracks(semanticBands, stepPlacementSeeds);
  const parkingTracks: ScenarioFlowTrack[] = parkingBand.map((band) => ({
    id: `${band.id}__track:0`,
    label: "T0",
    bandId: band.id,
    trackOrder: 0
  }));
  const tracks = [...semanticTracks, ...parkingTracks];
  const { cells, placements } = buildCellsAndPlacements(
    model,
    nodeMap,
    laneByNodeId,
    bands,
    tracks,
    stepPlacementSeeds,
    diagnostics
  );
  const edges = buildMiddleEdges(model.edges);
  const connectorPlans = buildConnectorPlans(edges, placements);

  return {
    bands,
    tracks,
    laneGuides: buildLaneGuides(),
    cells,
    placements,
    edges,
    connectorPlans,
    diagnostics: sortRendererDiagnostics(diagnostics)
  };
}
