import type {
  ServiceBlueprintRenderEdge,
  ServiceBlueprintRenderModel,
  ServiceBlueprintRenderNode
} from "../serviceBlueprintRenderModel.js";
import { createSceneDiagnostic, type RendererDiagnostic } from "./diagnostics.js";

export type ServiceBlueprintNodeClassification = "action" | "band_support" | "shared_resource";
export type ServiceBlueprintBandKind = "anchor" | "interstitial" | "parking";
export type ServiceBlueprintSlotKind = "primary" | "spill" | "parking";
export type ServiceBlueprintEdgeChannel = "flow" | "support" | "resource_policy";
export type ServiceBlueprintPlacementMode =
  | "action_band"
  | "band_primary_support"
  | "band_spill_support"
  | "parking";
export type ServiceBlueprintLaneSeparatorRole =
  | "line_of_interaction"
  | "line_of_visibility"
  | "line_of_internal_interaction";

export interface ServiceBlueprintMiddleBand {
  id: string;
  label: string;
  kind: Exclude<ServiceBlueprintBandKind, "parking">;
  bandOrder: number;
  shared: true;
}

export interface ServiceBlueprintPhysicalColumn {
  id: string;
  bandId: string;
  label: string;
  bandKind: ServiceBlueprintBandKind;
  bandOrder?: number;
  columnOrder: number;
  slotKind: ServiceBlueprintSlotKind;
  slotOrderWithinBand: number;
  ownerLaneShellId?: string;
  ownerLaneId?: string;
}

export interface ServiceBlueprintMiddleLaneShell {
  id: string;
  laneId: string;
  label: string;
  index: number;
  cellIds: string[];
}

export interface ServiceBlueprintLaneGuide {
  laneShellId: string;
  laneId: string;
  label: string;
  order: number;
  separatorAfter?: ServiceBlueprintLaneSeparatorRole;
}

export interface ServiceBlueprintMiddleCell {
  id: string;
  columnId: string;
  bandId: string;
  laneShellId: string;
  laneId: string;
  bandLabel: string;
  bandKind: ServiceBlueprintBandKind;
  bandOrder?: number;
  rowOrder: number;
  columnOrder: number;
  slotKind: ServiceBlueprintSlotKind;
  slotOrderWithinBand: number;
  nodeIds: string[];
  anchorNodeId: string;
  sharedWidthGroup: string;
  sharedHeightGroup: string;
}

export interface ServiceBlueprintNodePlacement {
  nodeId: string;
  laneShellId: string;
  cellId: string;
  columnId: string;
  bandId: string;
  bandOrder?: number;
  classification: ServiceBlueprintNodeClassification;
  placementMode: ServiceBlueprintPlacementMode;
  columnOrder: number;
  slotKind: ServiceBlueprintSlotKind;
  slotOrderWithinBand: number;
  order: number;
}

export interface ServiceBlueprintMiddleEdge {
  id: string;
  semanticEdgeIds: string[];
  channel: ServiceBlueprintEdgeChannel;
  type: string;
  from: string;
  to: string;
  label?: string;
  style?: string;
}

export interface ServiceBlueprintMiddleLayerModel {
  bands: ServiceBlueprintMiddleBand[];
  columns: ServiceBlueprintPhysicalColumn[];
  laneShells: ServiceBlueprintMiddleLaneShell[];
  laneGuides: ServiceBlueprintLaneGuide[];
  cells: ServiceBlueprintMiddleCell[];
  placements: ServiceBlueprintNodePlacement[];
  edges: ServiceBlueprintMiddleEdge[];
  diagnostics: RendererDiagnostic[];
}

const FIXED_LANE_ORDER = [
  "customer",
  "frontstage",
  "backstage",
  "support",
  "system",
  "policy"
] as const;

const ACTION_NODE_TYPES = new Set(["Step", "Process", "SystemAction"]);
const SHARED_RESOURCE_NODE_TYPES = new Set(["DataEntity"]);

function compareNodeOrder(
  left: Pick<ServiceBlueprintRenderNode, "authorOrder" | "id">,
  right: Pick<ServiceBlueprintRenderNode, "authorOrder" | "id">
): number {
  return left.authorOrder - right.authorOrder || left.id.localeCompare(right.id);
}

function createNodeMap(nodes: readonly ServiceBlueprintRenderNode[]): Map<string, ServiceBlueprintRenderNode> {
  return new Map(nodes.map((node) => [node.id, node]));
}

function isActionNode(node: ServiceBlueprintRenderNode | undefined): node is ServiceBlueprintRenderNode {
  return !!node && ACTION_NODE_TYPES.has(node.type);
}

function isStepNode(node: ServiceBlueprintRenderNode | undefined): node is ServiceBlueprintRenderNode {
  return !!node && node.type === "Step";
}

function stableTopologicalOrder(
  nodes: readonly ServiceBlueprintRenderNode[],
  edges: readonly ServiceBlueprintRenderEdge[]
): ServiceBlueprintRenderNode[] {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const indegree = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map<string, string[]>();

  for (const edge of edges) {
    if (!nodeMap.has(edge.from) || !nodeMap.has(edge.to) || edge.from === edge.to) {
      continue;
    }
    const next = outgoing.get(edge.from) ?? [];
    next.push(edge.to);
    outgoing.set(edge.from, next);
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
  }

  const sortedQueue = [...nodes]
    .filter((node) => (indegree.get(node.id) ?? 0) === 0)
    .sort(compareNodeOrder);
  const ordered: ServiceBlueprintRenderNode[] = [];
  const visited = new Set<string>();

  while (sortedQueue.length > 0) {
    const node = sortedQueue.shift();
    if (!node || visited.has(node.id)) {
      continue;
    }

    visited.add(node.id);
    ordered.push(node);

    for (const targetId of outgoing.get(node.id) ?? []) {
      const nextIndegree = (indegree.get(targetId) ?? 0) - 1;
      indegree.set(targetId, nextIndegree);
      if (nextIndegree === 0) {
        const target = nodeMap.get(targetId);
        if (target) {
          sortedQueue.push(target);
          sortedQueue.sort(compareNodeOrder);
        }
      }
    }
  }

  return [
    ...ordered,
    ...nodes
      .filter((node) => !visited.has(node.id))
      .sort(compareNodeOrder)
  ];
}

function buildLaneShells(model: ServiceBlueprintRenderModel): {
  laneShells: ServiceBlueprintMiddleLaneShell[];
  diagnostics: RendererDiagnostic[];
} {
  const diagnostics: RendererDiagnostic[] = [];
  const groupedLanes = [...model.lanes].sort((left, right) => (
    FIXED_LANE_ORDER.indexOf(left.label as typeof FIXED_LANE_ORDER[number])
    - FIXED_LANE_ORDER.indexOf(right.label as typeof FIXED_LANE_ORDER[number])
  ));
  const laneShells = groupedLanes.map<ServiceBlueprintMiddleLaneShell>((lane, index) => ({
    id: `${lane.id}__shell`,
    laneId: lane.id,
    label: lane.label,
    index,
    cellIds: []
  }));

  if (model.ungroupedNodeIds.length > 0) {
    diagnostics.push(
      createSceneDiagnostic(
        "renderer.scene.service_blueprint_ungrouped_lane",
        `Service blueprint projection produced ${model.ungroupedNodeIds.length} ungrouped node(s). Appending a synthetic "ungrouped" lane shell for staged rendering.`
      )
    );
    laneShells.push({
      id: "lane:99:ungrouped__shell",
      laneId: "lane:99:ungrouped",
      label: "ungrouped",
      index: laneShells.length,
      cellIds: []
    });
  }

  return {
    laneShells,
    diagnostics
  };
}

function buildAdjacency(
  edges: readonly ServiceBlueprintRenderEdge[],
  nodeMap: ReadonlyMap<string, ServiceBlueprintRenderNode>,
  includedTypes: ReadonlySet<string>
): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();

  for (const edge of edges) {
    if (!includedTypes.has(edge.type)) {
      continue;
    }
    if (!isActionNode(nodeMap.get(edge.from)) || !isActionNode(nodeMap.get(edge.to))) {
      continue;
    }

    const fromNext = adjacency.get(edge.from) ?? new Set<string>();
    fromNext.add(edge.to);
    adjacency.set(edge.from, fromNext);

    const toNext = adjacency.get(edge.to) ?? new Set<string>();
    toNext.add(edge.from);
    adjacency.set(edge.to, toNext);
  }

  return adjacency;
}

function resolveLaneSeparatorRole(
  laneId: string
): ServiceBlueprintLaneSeparatorRole | undefined {
  switch (laneId.replace(/^lane:\d+:/, "")) {
    case "customer":
      return "line_of_interaction";
    case "frontstage":
      return "line_of_visibility";
    case "backstage":
      return "line_of_internal_interaction";
    default:
      return undefined;
  }
}

function buildLaneGuides(
  laneShells: readonly ServiceBlueprintMiddleLaneShell[]
): ServiceBlueprintLaneGuide[] {
  return laneShells
    .map((laneShell) => ({
      laneShellId: laneShell.id,
      laneId: laneShell.laneId,
      label: laneShell.label,
      order: laneShell.index,
      separatorAfter: resolveLaneSeparatorRole(laneShell.laneId)
    }))
    .sort((left, right) => left.order - right.order || left.laneShellId.localeCompare(right.laneShellId));
}

function findActionComponents(
  actionNodes: readonly ServiceBlueprintRenderNode[],
  edges: readonly ServiceBlueprintRenderEdge[],
  nodeMap: ReadonlyMap<string, ServiceBlueprintRenderNode>
): Map<string, number> {
  const adjacency = buildAdjacency(edges, nodeMap, new Set(["PRECEDES", "REALIZED_BY", "DEPENDS_ON"]));
  const componentByNodeId = new Map<string, number>();
  let nextComponentId = 1;

  for (const node of [...actionNodes].sort(compareNodeOrder)) {
    if (componentByNodeId.has(node.id)) {
      continue;
    }

    const queue = [node.id];
    componentByNodeId.set(node.id, nextComponentId);

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        continue;
      }

      for (const neighbor of adjacency.get(current) ?? []) {
        if (componentByNodeId.has(neighbor)) {
          continue;
        }
        componentByNodeId.set(neighbor, nextComponentId);
        queue.push(neighbor);
      }
    }

    nextComponentId += 1;
  }

  return componentByNodeId;
}

function resolveOrderedSteps(
  actionNodes: readonly ServiceBlueprintRenderNode[],
  edges: readonly ServiceBlueprintRenderEdge[]
): ServiceBlueprintRenderNode[] {
  const steps = actionNodes.filter((node) => node.type === "Step");
  const stepIds = new Set(steps.map((node) => node.id));

  return stableTopologicalOrder(
    steps,
    edges.filter((edge) => edge.type === "PRECEDES" && stepIds.has(edge.from) && stepIds.has(edge.to))
  );
}

function resolveNoStepSpine(
  actionNodes: readonly ServiceBlueprintRenderNode[],
  edges: readonly ServiceBlueprintRenderEdge[]
): ServiceBlueprintRenderNode[] {
  const actionIds = new Set(actionNodes.map((node) => node.id));

  return stableTopologicalOrder(
    actionNodes,
    edges.filter((edge) => edge.type === "PRECEDES" && actionIds.has(edge.from) && actionIds.has(edge.to))
  );
}

function deriveActionBandPositions(
  model: ServiceBlueprintRenderModel,
  actionNodes: readonly ServiceBlueprintRenderNode[],
  nodeMap: ReadonlyMap<string, ServiceBlueprintRenderNode>,
  diagnostics: RendererDiagnostic[]
): {
  positionByNodeId: Map<string, number>;
  parkedNodeIds: Set<string>;
  anchorPositionSet: Set<number>;
} {
  const positionByNodeId = new Map<string, number>();
  const fixedPositions = new Set<string>();
  const parkedNodeIds = new Set<string>();
  const actionEdges = model.edges.filter((edge) => {
    const from = nodeMap.get(edge.from);
    const to = nodeMap.get(edge.to);
    return isActionNode(from) && isActionNode(to);
  });
  const orderedSteps = resolveOrderedSteps(actionNodes, model.edges);
  const hasSteps = orderedSteps.length > 0;
  const anchorSpine = hasSteps
    ? orderedSteps
    : resolveNoStepSpine(actionNodes, model.edges);
  const anchorPositionSet = new Set<number>();

  if (!hasSteps) {
    diagnostics.push(
      createSceneDiagnostic(
        "renderer.scene.service_blueprint_degraded_no_steps",
        "Service blueprint projection did not include customer Step nodes. Deriving a deterministic action spine."
      )
    );
  }

  anchorSpine.forEach((node, index) => {
    const position = hasSteps ? index * 2 : index;
    positionByNodeId.set(node.id, position);
    fixedPositions.add(node.id);
    anchorPositionSet.add(position);
  });

  for (const edge of model.edges) {
    if (edge.type !== "REALIZED_BY") {
      continue;
    }
    const from = nodeMap.get(edge.from);
    const to = nodeMap.get(edge.to);
    if (!isStepNode(from) || !isActionNode(to) || to.type !== "Process") {
      continue;
    }

    const anchor = positionByNodeId.get(from.id);
    if (anchor === undefined) {
      continue;
    }

    const existing = positionByNodeId.get(to.id);
    positionByNodeId.set(to.id, existing === undefined ? anchor : Math.max(existing, anchor));
    fixedPositions.add(to.id);
  }

  const componentByNodeId = findActionComponents([...actionNodes], model.edges, nodeMap);
  const anchoredComponents = new Set<number>();
  for (const step of anchorSpine) {
    const componentId = componentByNodeId.get(step.id);
    if (componentId !== undefined) {
      anchoredComponents.add(componentId);
    }
  }

  for (const node of [...actionNodes].sort(compareNodeOrder)) {
    if (node.type === "Step") {
      continue;
    }
    const componentId = componentByNodeId.get(node.id);
    if (hasSteps && componentId !== undefined && !anchoredComponents.has(componentId)) {
      parkedNodeIds.add(node.id);
    }
  }

  const precedenceEdges = actionEdges.filter((edge) => edge.type === "PRECEDES");
  const dependencyEdges = actionEdges.filter((edge) => edge.type === "DEPENDS_ON");
  const maxIterations = Math.max(actionNodes.length * 4, 4);

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    let changed = false;

    for (const edge of dependencyEdges) {
      if (parkedNodeIds.has(edge.from) || parkedNodeIds.has(edge.to)) {
        continue;
      }
      const source = nodeMap.get(edge.from);
      const target = nodeMap.get(edge.to);
      if (!source || !target || target.type !== "SystemAction") {
        continue;
      }

      const sourcePosition = positionByNodeId.get(source.id);
      if (sourcePosition === undefined || fixedPositions.has(target.id)) {
        continue;
      }

      if (positionByNodeId.get(target.id) !== sourcePosition) {
        positionByNodeId.set(target.id, sourcePosition);
        changed = true;
      }
    }

    for (const edge of precedenceEdges) {
      if (parkedNodeIds.has(edge.from) || parkedNodeIds.has(edge.to)) {
        continue;
      }
      const sourcePosition = positionByNodeId.get(edge.from);
      if (sourcePosition === undefined || fixedPositions.has(edge.to)) {
        continue;
      }

      const candidate = sourcePosition + 1;
      const current = positionByNodeId.get(edge.to);
      if (current === undefined || candidate > current) {
        positionByNodeId.set(edge.to, candidate);
        changed = true;
      }
    }

    if (!changed) {
      break;
    }
  }

  let fallbackCursor = Math.max(-1, ...positionByNodeId.values());
  for (const node of [...actionNodes].sort(compareNodeOrder)) {
    if (parkedNodeIds.has(node.id) || positionByNodeId.has(node.id)) {
      continue;
    }

    fallbackCursor += 1;
    positionByNodeId.set(node.id, fallbackCursor);
    diagnostics.push(
      createSceneDiagnostic(
        "renderer.scene.service_blueprint_band_fallback",
        `Could not derive a semantic chronology band for "${node.id}". Falling back to a deterministic renderer-owned action position.`,
        {
          targetId: node.id,
          severity: "info"
        }
      )
    );
  }

  return {
    positionByNodeId,
    parkedNodeIds,
    anchorPositionSet
  };
}

function buildBands(
  positionByNodeId: ReadonlyMap<string, number>,
  anchorPositionSet: ReadonlySet<number>
): ServiceBlueprintMiddleBand[] {
  const sharedPositions = [...new Set(positionByNodeId.values())].sort((left, right) => left - right);
  const bands: ServiceBlueprintMiddleBand[] = [];
  let anchorIndex = 1;
  let interstitialIndex = 1;

  for (const position of sharedPositions) {
    if (anchorPositionSet.has(position)) {
      bands.push({
        id: `band:anchor:${anchorIndex}`,
        label: `A${anchorIndex}`,
        kind: "anchor",
        bandOrder: bands.length,
        shared: true
      });
      anchorIndex += 1;
      continue;
    }

    bands.push({
      id: `band:interstitial:${interstitialIndex}`,
      label: `I${interstitialIndex}`,
      kind: "interstitial",
      bandOrder: bands.length,
      shared: true
    });
    interstitialIndex += 1;
  }

  return bands;
}

function buildSharedBandByPosition(
  positionByNodeId: ReadonlyMap<string, number>,
  bands: readonly ServiceBlueprintMiddleBand[]
): Map<number, ServiceBlueprintMiddleBand> {
  const sharedBandByPosition = new Map<number, ServiceBlueprintMiddleBand>();

  [...new Set(positionByNodeId.values())]
    .sort((left, right) => left - right)
    .forEach((position, index) => {
      const band = bands[index];
      if (band) {
        sharedBandByPosition.set(position, band);
      }
    });

  return sharedBandByPosition;
}

function resolveEdgeChannel(edge: ServiceBlueprintRenderEdge): ServiceBlueprintEdgeChannel {
  switch (edge.type) {
    case "PRECEDES":
      return "flow";
    case "REALIZED_BY":
    case "DEPENDS_ON":
      return "support";
    case "READS":
    case "WRITES":
    case "CONSTRAINED_BY":
      return "resource_policy";
    default:
      return "support";
  }
}

function resolveNodeClassification(
  node: ServiceBlueprintRenderNode
): ServiceBlueprintNodeClassification {
  if (ACTION_NODE_TYPES.has(node.type)) {
    return "action";
  }
  if (SHARED_RESOURCE_NODE_TYPES.has(node.type)) {
    return "shared_resource";
  }
  return "band_support";
}

function resolvePlacementMode(
  node: ServiceBlueprintRenderNode,
  slotKind: ServiceBlueprintSlotKind
): ServiceBlueprintPlacementMode {
  if (slotKind === "parking") {
    return "parking";
  }
  if (ACTION_NODE_TYPES.has(node.type)) {
    return "action_band";
  }
  return slotKind === "spill" ? "band_spill_support" : "band_primary_support";
}

interface ServiceBlueprintSupportBandCandidate {
  bandId: string;
  bandOrder: number;
  relationRank: number;
  sourceAuthorOrder: number;
  sourceId: string;
}

function compareSupportBandCandidates(
  left: ServiceBlueprintSupportBandCandidate,
  right: ServiceBlueprintSupportBandCandidate
): number {
  return left.relationRank - right.relationRank
    || left.bandOrder - right.bandOrder
    || left.sourceAuthorOrder - right.sourceAuthorOrder
    || left.sourceId.localeCompare(right.sourceId);
}

function resolveSupportBandByNodeId(
  model: ServiceBlueprintRenderModel,
  nodeMap: ReadonlyMap<string, ServiceBlueprintRenderNode>,
  positionByNodeId: ReadonlyMap<string, number>,
  sharedBandByPosition: ReadonlyMap<number, ServiceBlueprintMiddleBand>,
  targetType: "DataEntity" | "Policy",
  edgeTypes: ReadonlySet<string>,
  relationRank: (edgeType: string) => number
): Map<string, string> {
  const candidateByNodeId = new Map<string, ServiceBlueprintSupportBandCandidate>();

  for (const edge of model.edges) {
    if (!edgeTypes.has(edge.type)) {
      continue;
    }

    const source = nodeMap.get(edge.from);
    const target = nodeMap.get(edge.to);
    if (!isActionNode(source) || !target || target.type !== targetType) {
      continue;
    }

    const sourcePosition = positionByNodeId.get(source.id);
    const band = sourcePosition === undefined
      ? undefined
      : sharedBandByPosition.get(sourcePosition);
    if (!band) {
      continue;
    }

    const candidate: ServiceBlueprintSupportBandCandidate = {
      bandId: band.id,
      bandOrder: band.bandOrder,
      relationRank: relationRank(edge.type),
      sourceAuthorOrder: source.authorOrder,
      sourceId: source.id
    };
    const existing = candidateByNodeId.get(target.id);
    if (!existing || compareSupportBandCandidates(candidate, existing) < 0) {
      candidateByNodeId.set(target.id, candidate);
    }
  }

  return new Map(
    [...candidateByNodeId.entries()].map(([nodeId, candidate]) => [nodeId, candidate.bandId] as const)
  );
}

function resolveSupportBandByNodeIdForSliceOne(
  model: ServiceBlueprintRenderModel,
  nodeMap: ReadonlyMap<string, ServiceBlueprintRenderNode>,
  positionByNodeId: ReadonlyMap<string, number>,
  sharedBandByPosition: ReadonlyMap<number, ServiceBlueprintMiddleBand>
): Map<string, string> {
  const dataEntityBands = resolveSupportBandByNodeId(
    model,
    nodeMap,
    positionByNodeId,
    sharedBandByPosition,
    "DataEntity",
    new Set(["WRITES", "READS"]),
    (edgeType) => edgeType === "WRITES" ? 0 : 1
  );
  const policyBands = resolveSupportBandByNodeId(
    model,
    nodeMap,
    positionByNodeId,
    sharedBandByPosition,
    "Policy",
    new Set(["CONSTRAINED_BY"]),
    () => 0
  );

  return new Map([
    ...dataEntityBands.entries(),
    ...policyBands.entries()
  ]);
}

function buildParkingColumns(
  model: ServiceBlueprintRenderModel,
  nodeMap: ReadonlyMap<string, ServiceBlueprintRenderNode>,
  laneShells: readonly ServiceBlueprintMiddleLaneShell[],
  parkedNodeIds: ReadonlySet<string>,
  startColumnOrder: number
): ServiceBlueprintPhysicalColumn[] {
  const parkedNodesByLaneShellId = new Map<string, ServiceBlueprintRenderNode[]>();
  const laneShellByLaneId = new Map(laneShells.map((laneShell) => [laneShell.laneId, laneShell]));

  for (const nodeId of parkedNodeIds) {
    const node = nodeMap.get(nodeId);
    if (!node) {
      continue;
    }

    const laneId = node.laneId ?? (model.ungroupedNodeIds.includes(node.id) ? "lane:99:ungrouped" : undefined);
    const laneShell = laneId ? laneShellByLaneId.get(laneId) : undefined;
    if (!laneShell) {
      continue;
    }

    const existing = parkedNodesByLaneShellId.get(laneShell.id) ?? [];
    existing.push(node);
    parkedNodesByLaneShellId.set(laneShell.id, existing);
  }

  return laneShells.flatMap((laneShell) => {
    const parkedNodes = parkedNodesByLaneShellId.get(laneShell.id);
    if (!parkedNodes || parkedNodes.length === 0) {
      return [];
    }

    return [{
      id: `band:parking:${laneShell.laneId}:1`,
      bandId: `band:parking:${laneShell.laneId}:1`,
      label: "P1",
      bandKind: "parking",
      columnOrder: startColumnOrder,
      slotKind: "parking",
      slotOrderWithinBand: 0,
      ownerLaneShellId: laneShell.id,
      ownerLaneId: laneShell.laneId
    } satisfies ServiceBlueprintPhysicalColumn];
  }).map((column, index) => ({
    ...column,
    columnOrder: startColumnOrder + index
  }));
}

function buildCellsAndPlacements(
  model: ServiceBlueprintRenderModel,
  nodeMap: ReadonlyMap<string, ServiceBlueprintRenderNode>,
  laneShells: ServiceBlueprintMiddleLaneShell[],
  bands: ServiceBlueprintMiddleBand[],
  positionByNodeId: ReadonlyMap<string, number>,
  parkedNodeIds: ReadonlySet<string>,
  diagnostics: RendererDiagnostic[]
): {
  columns: ServiceBlueprintPhysicalColumn[];
  cells: ServiceBlueprintMiddleCell[];
  placements: ServiceBlueprintNodePlacement[];
} {
  const sharedBandByPosition = buildSharedBandByPosition(positionByNodeId, bands);
  const supportBandByNodeId = resolveSupportBandByNodeIdForSliceOne(
    model,
    nodeMap,
    positionByNodeId,
    sharedBandByPosition
  );
  const laneShellByLaneId = new Map(laneShells.map((laneShell) => [laneShell.laneId, laneShell]));
  const semanticBandByNodeId = new Map<string, ServiceBlueprintMiddleBand>();
  for (const node of model.nodes) {
    if (parkedNodeIds.has(node.id)) {
      continue;
    }

    if (ACTION_NODE_TYPES.has(node.type)) {
      const position = positionByNodeId.get(node.id);
      const band = position === undefined ? undefined : sharedBandByPosition.get(position);
      if (band) {
        semanticBandByNodeId.set(node.id, band);
      }
      continue;
    }

    const bandId = supportBandByNodeId.get(node.id);
    const band = bandId ? bands.find((candidate) => candidate.id === bandId) : undefined;
    if (band) {
      semanticBandByNodeId.set(node.id, band);
    }
  }

  const allParkedNodeIds = new Set(parkedNodeIds);
  for (const node of model.nodes) {
    if (allParkedNodeIds.has(node.id) || semanticBandByNodeId.has(node.id)) {
      continue;
    }
    allParkedNodeIds.add(node.id);
    diagnostics.push(
      createSceneDiagnostic(
        "renderer.scene.service_blueprint_support_parking_fallback",
        `Could not derive a semantic support band for "${node.id}". Assigning it to deterministic terminal parking.`,
        {
          targetId: node.id,
          severity: "info"
        }
      )
    );
  }

  const nodesByLaneBandId = new Map<string, ServiceBlueprintRenderNode[]>();
  for (const node of model.nodes) {
    if (allParkedNodeIds.has(node.id)) {
      continue;
    }

    const band = semanticBandByNodeId.get(node.id);
    if (!band) {
      continue;
    }

    const laneId = node.laneId ?? (model.ungroupedNodeIds.includes(node.id) ? "lane:99:ungrouped" : undefined);
    const laneShell = laneId ? laneShellByLaneId.get(laneId) : undefined;
    if (!laneShell) {
      continue;
    }

    const key = `${laneShell.id}::${band.id}`;
    const existing = nodesByLaneBandId.get(key) ?? [];
    existing.push(node);
    nodesByLaneBandId.set(key, existing);
  }

  const spillCountByBandId = new Map<string, number>();
  for (const band of bands) {
    let maxSpillCount = 0;
    for (const laneShell of laneShells) {
      const key = `${laneShell.id}::${band.id}`;
      const nodes = (nodesByLaneBandId.get(key) ?? []).sort(compareNodeOrder);
      const actionNodes = nodes.filter((node) => ACTION_NODE_TYPES.has(node.type));
      const supportNodes = nodes.filter((node) => !ACTION_NODE_TYPES.has(node.type));
      const spillCount = actionNodes.length > 0
        ? supportNodes.length
        : Math.max(supportNodes.length - 1, 0);
      maxSpillCount = Math.max(maxSpillCount, spillCount);
    }
    spillCountByBandId.set(band.id, maxSpillCount);
  }

  const primaryColumns: ServiceBlueprintPhysicalColumn[] = [];
  const spillColumns: ServiceBlueprintPhysicalColumn[] = [];
  const semanticColumns: ServiceBlueprintPhysicalColumn[] = [];
  let nextColumnOrder = 0;
  for (const band of [...bands].sort((left, right) => left.bandOrder - right.bandOrder || left.id.localeCompare(right.id))) {
    const primaryColumn: ServiceBlueprintPhysicalColumn = {
      id: band.id,
      bandId: band.id,
      label: band.label,
      bandKind: band.kind,
      bandOrder: band.bandOrder,
      columnOrder: nextColumnOrder,
      slotKind: "primary",
      slotOrderWithinBand: 0
    };
    primaryColumns.push(primaryColumn);
    semanticColumns.push(primaryColumn);
    nextColumnOrder += 1;

    const spillCount = spillCountByBandId.get(band.id) ?? 0;
    for (let spillIndex = 1; spillIndex <= spillCount; spillIndex += 1) {
      const spillColumn: ServiceBlueprintPhysicalColumn = {
        id: `${band.id}:spill:${spillIndex}`,
        bandId: band.id,
        label: band.label,
        bandKind: band.kind,
        bandOrder: band.bandOrder,
        columnOrder: nextColumnOrder,
        slotKind: "spill",
        slotOrderWithinBand: spillIndex
      };
      spillColumns.push(spillColumn);
      semanticColumns.push(spillColumn);
      nextColumnOrder += 1;
    }
  }
  const parkingColumns = buildParkingColumns(
    model,
    nodeMap,
    laneShells,
    allParkedNodeIds,
    semanticColumns.length
  );
  const columns = [...semanticColumns, ...parkingColumns];

  const primaryColumnByBandId = new Map(primaryColumns.map((column) => [column.bandId, column] as const));
  const spillColumnsByBandId = new Map<string, ServiceBlueprintPhysicalColumn[]>();
  for (const column of spillColumns) {
    const existing = spillColumnsByBandId.get(column.bandId) ?? [];
    existing.push(column);
    spillColumnsByBandId.set(column.bandId, existing);
  }
  const parkingColumnByLaneShellId = new Map(
    parkingColumns.flatMap((column) =>
      column.ownerLaneShellId ? [[column.ownerLaneShellId, column] as const] : []
    )
  );
  const nodesByCellId = new Map<string, ServiceBlueprintRenderNode[]>();
  const placementByNodeId = new Map<string, {
    targetBandId: string;
    targetBandOrder?: number;
    targetColumnId: string;
    targetColumnOrder: number;
    classification: ServiceBlueprintNodeClassification;
    placementMode: ServiceBlueprintPlacementMode;
    slotKind: ServiceBlueprintSlotKind;
    slotOrderWithinBand: number;
  }>();

  for (const node of model.nodes) {
    const laneId = node.laneId ?? (model.ungroupedNodeIds.includes(node.id) ? "lane:99:ungrouped" : undefined);
    const laneShell = laneId ? laneShellByLaneId.get(laneId) : undefined;
    if (!laneShell) {
      continue;
    }

    if (allParkedNodeIds.has(node.id)) {
      const parkingColumn = parkingColumnByLaneShellId.get(laneShell.id);
      if (!parkingColumn) {
        continue;
      }
      const cellId = `${laneShell.id}__cell__${parkingColumn.id}`;
      const existing = nodesByCellId.get(cellId) ?? [];
      existing.push(node);
      nodesByCellId.set(cellId, existing);
      placementByNodeId.set(node.id, {
        targetBandId: parkingColumn.bandId,
        targetBandOrder: parkingColumn.bandOrder,
        targetColumnId: parkingColumn.id,
        targetColumnOrder: parkingColumn.columnOrder,
        classification: resolveNodeClassification(node),
        placementMode: resolvePlacementMode(node, parkingColumn.slotKind),
        slotKind: parkingColumn.slotKind,
        slotOrderWithinBand: parkingColumn.slotOrderWithinBand
      });
    }
  }

  for (const band of bands) {
    const primaryColumn = primaryColumnByBandId.get(band.id);
    if (!primaryColumn) {
      continue;
    }

    for (const laneShell of laneShells) {
      const key = `${laneShell.id}::${band.id}`;
      const nodes = (nodesByLaneBandId.get(key) ?? []).sort(compareNodeOrder);
      const actionNodes = nodes.filter((node) => ACTION_NODE_TYPES.has(node.type));
      const supportNodes = nodes.filter((node) => !ACTION_NODE_TYPES.has(node.type));
      const primaryNodes = actionNodes.length > 0 ? actionNodes : supportNodes.slice(0, 1);
      const spillNodes = actionNodes.length > 0 ? supportNodes : supportNodes.slice(1);

      for (const node of primaryNodes) {
        const cellId = `${laneShell.id}__cell__${primaryColumn.id}`;
        const existing = nodesByCellId.get(cellId) ?? [];
        existing.push(node);
        nodesByCellId.set(cellId, existing);
        placementByNodeId.set(node.id, {
          targetBandId: band.id,
          targetBandOrder: band.bandOrder,
          targetColumnId: primaryColumn.id,
          targetColumnOrder: primaryColumn.columnOrder,
          classification: resolveNodeClassification(node),
          placementMode: resolvePlacementMode(node, primaryColumn.slotKind),
          slotKind: primaryColumn.slotKind,
          slotOrderWithinBand: primaryColumn.slotOrderWithinBand
        });
      }

      spillNodes.forEach((node, spillIndex) => {
        const spillColumn = spillColumnsByBandId.get(band.id)?.[spillIndex];
        if (!spillColumn) {
          return;
        }
        const cellId = `${laneShell.id}__cell__${spillColumn.id}`;
        const existing = nodesByCellId.get(cellId) ?? [];
        existing.push(node);
        nodesByCellId.set(cellId, existing);
        placementByNodeId.set(node.id, {
          targetBandId: band.id,
          targetBandOrder: band.bandOrder,
          targetColumnId: spillColumn.id,
          targetColumnOrder: spillColumn.columnOrder,
          classification: resolveNodeClassification(node),
          placementMode: resolvePlacementMode(node, spillColumn.slotKind),
          slotKind: spillColumn.slotKind,
          slotOrderWithinBand: spillColumn.slotOrderWithinBand
        });
      });
    }
  }

  const cells: ServiceBlueprintMiddleCell[] = [];
  const placements: ServiceBlueprintNodePlacement[] = [];

  for (const column of columns) {
    for (const laneShell of laneShells) {
      const cellId = `${laneShell.id}__cell__${column.id}`;
      const nodeIds = (nodesByCellId.get(cellId) ?? [])
        .sort(compareNodeOrder)
        .map((node) => node.id);
      const cell: ServiceBlueprintMiddleCell = {
        id: cellId,
        columnId: column.id,
        bandId: column.bandId,
        laneShellId: laneShell.id,
        laneId: laneShell.laneId,
        bandLabel: column.label,
        bandKind: column.bandKind,
        bandOrder: column.bandOrder,
        rowOrder: laneShell.index,
        columnOrder: column.columnOrder,
        slotKind: column.slotKind,
        slotOrderWithinBand: column.slotOrderWithinBand,
        nodeIds,
        anchorNodeId: `${cellId}__anchor`,
        sharedWidthGroup: column.slotKind === "parking"
          ? "service_blueprint:column:parking"
          : "service_blueprint:column:semantic",
        sharedHeightGroup: laneShell.laneId === "lane:99:ungrouped"
          ? "service_blueprint:row:ungrouped"
          : "service_blueprint:row:semantic"
      };
      cells.push(cell);
      laneShell.cellIds.push(cell.id);

      nodeIds.forEach((nodeId, order) => {
        const placement = placementByNodeId.get(nodeId);
        if (!placement) {
          return;
        }
        placements.push({
          nodeId,
          laneShellId: laneShell.id,
          cellId: cell.id,
          columnId: placement.targetColumnId,
          bandId: placement.targetBandId,
          bandOrder: placement.targetBandOrder,
          classification: placement.classification,
          placementMode: placement.placementMode,
          columnOrder: placement.targetColumnOrder,
          slotKind: placement.slotKind,
          slotOrderWithinBand: placement.slotOrderWithinBand,
          order
        });
      });
    }
  }

  return {
    columns,
    cells,
    placements
  };
}

function buildMergedSemanticEdges(
  edges: readonly ServiceBlueprintRenderEdge[]
): ServiceBlueprintMiddleEdge[] {
  const grouped = new Map<string, ServiceBlueprintRenderEdge[]>();

  for (const edge of edges) {
    const key = [
      edge.from,
      edge.to,
      edge.type === "READS" || edge.type === "WRITES" ? "READWRITE_GROUP" : edge.type
    ].join("|");
    const existing = grouped.get(key) ?? [];
    existing.push(edge);
    grouped.set(key, existing);
  }

  return [...grouped.values()].map((group) => {
    const sortedGroup = [...group].sort((left, right) => left.id.localeCompare(right.id));
    const canonical = sortedGroup[0]!;
    const readWriteTypes = new Set(group.map((edge) => edge.type));
    const mergedReadWrite = readWriteTypes.has("READS")
      && readWriteTypes.has("WRITES")
      && readWriteTypes.size === group.length
      && group.every((edge) => edge.from === canonical.from && edge.to === canonical.to);
    const labels = sortedGroup.flatMap((edge) => {
      const label = edge.label?.trim();
      return label ? [label] : [];
    }).filter((label, index, allLabels) => allLabels.indexOf(label) === index);

    return {
      id: mergedReadWrite
        ? `${canonical.from}__reads_writes__${canonical.to}`
        : canonical.id,
      semanticEdgeIds: group.map((edge) => edge.id).sort(),
      channel: resolveEdgeChannel(canonical),
      type: mergedReadWrite ? "READS_WRITES" : canonical.type,
      from: canonical.from,
      to: canonical.to,
      label: mergedReadWrite ? labels.join(", ") || undefined : canonical.label,
      style: mergedReadWrite ? "dashed" : canonical.style
    } satisfies ServiceBlueprintMiddleEdge;
  });
}

export function buildServiceBlueprintMiddleLayer(
  model: ServiceBlueprintRenderModel
): ServiceBlueprintMiddleLayerModel {
  const nodeMap = createNodeMap(model.nodes);
  const actionNodes = model.nodes.filter((node) => ACTION_NODE_TYPES.has(node.type));
  const { laneShells, diagnostics: laneDiagnostics } = buildLaneShells(model);
  const diagnostics: RendererDiagnostic[] = [...laneDiagnostics];

  const {
    positionByNodeId,
    parkedNodeIds,
    anchorPositionSet
  } = deriveActionBandPositions(model, actionNodes, nodeMap, diagnostics);
  const bands = buildBands(positionByNodeId, anchorPositionSet);
  const { columns, cells, placements } = buildCellsAndPlacements(
    model,
    nodeMap,
    laneShells,
    bands,
    positionByNodeId,
    parkedNodeIds,
    diagnostics
  );
  const semanticEdges = buildMergedSemanticEdges(model.edges);
  const laneGuides = buildLaneGuides(laneShells);

  return {
    bands,
    columns,
    laneShells,
    laneGuides,
    cells,
    placements,
    edges: semanticEdges,
    diagnostics
  };
}
