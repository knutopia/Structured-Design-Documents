import type {
  ServiceBlueprintRenderEdge,
  ServiceBlueprintRenderModel,
  ServiceBlueprintRenderNode
} from "../serviceBlueprintRenderModel.js";
import { createSceneDiagnostic, type RendererDiagnostic } from "./diagnostics.js";

export type ServiceBlueprintNodeClassification = "action" | "sidecar";
export type ServiceBlueprintBandKind = "anchor" | "interstitial" | "sidecar" | "parking";
export type ServiceBlueprintEdgeChannel = "flow" | "support" | "resource_policy" | "helper";

export interface ServiceBlueprintMiddleBand {
  id: string;
  label: string;
  kind: Exclude<ServiceBlueprintBandKind, "parking">;
  order: number;
  shared: true;
}

export interface ServiceBlueprintParkingBand {
  id: string;
  label: string;
  kind: "parking";
  order: number;
  ownerLaneShellId: string;
  ownerLaneId: string;
}

export interface ServiceBlueprintMiddleLaneShell {
  id: string;
  laneId: string;
  label: string;
  index: number;
  cellIds: string[];
}

export interface ServiceBlueprintMiddleCell {
  id: string;
  bandId: string;
  laneShellId: string;
  laneId: string;
  bandLabel: string;
  bandKind: ServiceBlueprintBandKind;
  rowOrder: number;
  columnOrder: number;
  nodeIds: string[];
  anchorNodeId: string;
  sharedWidthGroup: string;
  sharedHeightGroup: string;
}

export interface ServiceBlueprintNodePlacement {
  nodeId: string;
  laneShellId: string;
  cellId: string;
  bandId: string;
  classification: ServiceBlueprintNodeClassification;
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
  strictRoute: boolean;
  hidden: boolean;
}

export interface ServiceBlueprintMiddleLayerModel {
  bands: ServiceBlueprintMiddleBand[];
  laneShells: ServiceBlueprintMiddleLaneShell[];
  parkingBands: ServiceBlueprintParkingBand[];
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
const SIDECAR_NODE_TYPES = new Set(["DataEntity", "Policy"]);

function compareNodeOrder(
  left: Pick<ServiceBlueprintRenderNode, "authorOrder" | "id">,
  right: Pick<ServiceBlueprintRenderNode, "authorOrder" | "id">
): number {
  return left.authorOrder - right.authorOrder || left.id.localeCompare(right.id);
}

function createNodeMap(nodes: readonly ServiceBlueprintRenderNode[]): Map<string, ServiceBlueprintRenderNode> {
  return new Map(nodes.map((node) => [node.id, node]));
}

function classifyNode(node: ServiceBlueprintRenderNode): ServiceBlueprintNodeClassification {
  return SIDECAR_NODE_TYPES.has(node.type) ? "sidecar" : "action";
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
        "Service blueprint projection did not include customer Step nodes. Deriving a deterministic action spine for degraded ELK layout."
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
        order: bands.length,
        shared: true
      });
      anchorIndex += 1;
      continue;
    }

    bands.push({
      id: `band:interstitial:${interstitialIndex}`,
      label: `I${interstitialIndex}`,
      kind: "interstitial",
      order: bands.length,
      shared: true
    });
    interstitialIndex += 1;
  }

  bands.push({
    id: "band:sidecar:1",
    label: "R*",
    kind: "sidecar",
    order: bands.length,
    shared: true
  });

  return bands;
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

function buildParkingBands(
  model: ServiceBlueprintRenderModel,
  nodeMap: ReadonlyMap<string, ServiceBlueprintRenderNode>,
  laneShells: readonly ServiceBlueprintMiddleLaneShell[],
  parkedNodeIds: ReadonlySet<string>,
  sharedColumnCount: number
): ServiceBlueprintParkingBand[] {
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
      label: "P1",
      kind: "parking",
      order: sharedColumnCount,
      ownerLaneShellId: laneShell.id,
      ownerLaneId: laneShell.laneId
    } satisfies ServiceBlueprintParkingBand];
  }).map((band, index) => ({
    ...band,
    order: sharedColumnCount + index
  }));
}

function buildCellsAndPlacements(
  model: ServiceBlueprintRenderModel,
  nodeMap: ReadonlyMap<string, ServiceBlueprintRenderNode>,
  laneShells: ServiceBlueprintMiddleLaneShell[],
  bands: ServiceBlueprintMiddleBand[],
  parkingBands: readonly ServiceBlueprintParkingBand[],
  positionByNodeId: ReadonlyMap<string, number>,
  parkedNodeIds: ReadonlySet<string>
): {
  cells: ServiceBlueprintMiddleCell[];
  placements: ServiceBlueprintNodePlacement[];
} {
  const orderedColumns = [...bands, ...parkingBands].sort((left, right) => left.order - right.order);
  const sharedBandByPosition = new Map<number, ServiceBlueprintMiddleBand>();
  const nonSidecarBands = bands.filter((band) => band.kind !== "sidecar");
  [...new Set(positionByNodeId.values())]
    .sort((left, right) => left - right)
    .forEach((position, index) => {
      const band = nonSidecarBands[index];
      if (band) {
        sharedBandByPosition.set(position, band);
      }
    });

  const sidecarBand = bands.find((band) => band.kind === "sidecar");
  if (!sidecarBand) {
    throw new Error("Service blueprint middle layer requires a sidecar band.");
  }

  const parkingBandByLaneShellId = new Map(parkingBands.map((band) => [band.ownerLaneShellId, band]));
  const laneShellByLaneId = new Map(laneShells.map((laneShell) => [laneShell.laneId, laneShell]));
  const nodesByCellId = new Map<string, ServiceBlueprintRenderNode[]>();

  for (const node of model.nodes) {
    const laneId = node.laneId ?? (model.ungroupedNodeIds.includes(node.id) ? "lane:99:ungrouped" : undefined);
    const laneShell = laneId ? laneShellByLaneId.get(laneId) : undefined;
    if (!laneShell) {
      continue;
    }

    let targetBandId: string | undefined;
    if (parkedNodeIds.has(node.id)) {
      targetBandId = parkingBandByLaneShellId.get(laneShell.id)?.id;
    } else if (classifyNode(node) === "sidecar") {
      targetBandId = sidecarBand.id;
    } else {
      targetBandId = sharedBandByPosition.get(positionByNodeId.get(node.id) ?? -1)?.id;
    }

    if (!targetBandId) {
      continue;
    }

    const cellId = `${laneShell.id}__cell__${targetBandId}`;
    const existing = nodesByCellId.get(cellId) ?? [];
    existing.push(node);
    nodesByCellId.set(cellId, existing);
  }

  const cells: ServiceBlueprintMiddleCell[] = [];
  const placements: ServiceBlueprintNodePlacement[] = [];

  for (const column of orderedColumns) {
    for (const laneShell of laneShells) {
      const cellId = `${laneShell.id}__cell__${column.id}`;
      const nodeIds = (nodesByCellId.get(cellId) ?? [])
        .sort(compareNodeOrder)
        .map((node) => node.id);
      const cell: ServiceBlueprintMiddleCell = {
        id: cellId,
        bandId: column.id,
        laneShellId: laneShell.id,
        laneId: laneShell.laneId,
        bandLabel: column.label,
        bandKind: column.kind,
        rowOrder: laneShell.index,
        columnOrder: column.order,
        nodeIds,
        anchorNodeId: `${cellId}__anchor`,
        sharedWidthGroup: `service_blueprint:column:${column.id}`,
        sharedHeightGroup: `service_blueprint:row:${laneShell.id}`
      };
      cells.push(cell);
      laneShell.cellIds.push(cell.id);

      nodeIds.forEach((nodeId, order) => {
        const node = nodeMap.get(nodeId);
        if (!node) {
          return;
        }
        placements.push({
          nodeId,
          laneShellId: laneShell.id,
          cellId: cell.id,
          bandId: column.id,
          classification: classifyNode(node),
          order
        });
      });
    }
  }

  return {
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
    const canonical = [...group].sort((left, right) => left.id.localeCompare(right.id))[0]!;
    const readWriteTypes = new Set(group.map((edge) => edge.type));
    const mergedReadWrite = readWriteTypes.has("READS")
      && readWriteTypes.has("WRITES")
      && readWriteTypes.size === group.length
      && group.every((edge) => edge.from === canonical.from && edge.to === canonical.to);

    return {
      id: mergedReadWrite
        ? `${canonical.from}__reads_writes__${canonical.to}`
        : canonical.id,
      semanticEdgeIds: group.map((edge) => edge.id).sort(),
      channel: resolveEdgeChannel(canonical),
      type: mergedReadWrite ? "READS_WRITES" : canonical.type,
      from: canonical.from,
      to: canonical.to,
      label: mergedReadWrite ? "reads, writes" : canonical.label,
      style: mergedReadWrite ? "dashed,bold" : canonical.style,
      strictRoute: true,
      hidden: false
    } satisfies ServiceBlueprintMiddleEdge;
  });
}

function buildHelperEdges(
  laneShells: readonly ServiceBlueprintMiddleLaneShell[],
  bands: readonly ServiceBlueprintMiddleBand[],
  parkingBands: readonly ServiceBlueprintParkingBand[],
  cellsById: ReadonlyMap<string, ServiceBlueprintMiddleCell>
): ServiceBlueprintMiddleEdge[] {
  const edges: ServiceBlueprintMiddleEdge[] = [];
  const orderedColumns = [...bands, ...parkingBands].sort((left, right) => left.order - right.order);

  for (const column of orderedColumns) {
    let previousAnchorId: string | undefined;

    for (const laneShell of laneShells) {
      const cell = cellsById.get(`${laneShell.id}__cell__${column.id}`);
      if (!cell) {
        continue;
      }

      if (previousAnchorId) {
        edges.push({
          id: `${previousAnchorId}__helper__${cell.id}`,
          semanticEdgeIds: [],
          channel: "helper",
          type: "HELPER_COLUMN_ORDER",
          from: previousAnchorId,
          to: cell.id,
          strictRoute: false,
          hidden: true
        });
      }
      previousAnchorId = cell.id;

      const stackIds = cell.nodeIds.length > 0
        ? [cell.id, ...cell.nodeIds]
        : [cell.id];
      for (let index = 1; index < stackIds.length; index += 1) {
        const from = stackIds[index - 1];
        const to = stackIds[index];
        if (!from || !to) {
          continue;
        }
        edges.push({
          id: `${from}__helper__${to}`,
          semanticEdgeIds: [],
          channel: "helper",
          type: "HELPER_CELL_STACK",
          from,
          to,
          strictRoute: false,
          hidden: true
        });
      }
    }
  }

  for (const laneShell of laneShells) {
    let previousCellId: string | undefined;

    for (const column of orderedColumns) {
      const cell = cellsById.get(`${laneShell.id}__cell__${column.id}`);
      if (!cell) {
        continue;
      }

      if (previousCellId) {
        edges.push({
          id: `${previousCellId}__helper__${cell.id}__row`,
          semanticEdgeIds: [],
          channel: "helper",
          type: "HELPER_ROW_ORDER",
          from: previousCellId,
          to: cell.id,
          strictRoute: false,
          hidden: true
        });
      }

      previousCellId = cell.id;
    }
  }

  return edges;
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
  const parkingBands = buildParkingBands(
    model,
    nodeMap,
    laneShells,
    parkedNodeIds,
    bands.length
  );
  const { cells, placements } = buildCellsAndPlacements(
    model,
    nodeMap,
    laneShells,
    bands,
    parkingBands,
    positionByNodeId,
    parkedNodeIds
  );
  const cellsById = new Map(cells.map((cell) => [cell.id, cell]));
  const helperEdges = buildHelperEdges(laneShells, bands, parkingBands, cellsById);
  const semanticEdges = buildMergedSemanticEdges(model.edges);

  return {
    bands,
    laneShells,
    parkingBands,
    cells,
    placements,
    edges: [...helperEdges, ...semanticEdges],
    diagnostics
  };
}
