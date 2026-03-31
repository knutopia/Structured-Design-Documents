import { getTopLevelNodeIdsInAuthorOrder } from "../compiler/authorOrder.js";
import type { CompiledGraph } from "../compiler/types.js";
import type { Projection } from "../projector/types.js";
import type { ResolvedProfileDisplayPolicy } from "./profileDisplay.js";
import { readBooleanProfileDisplaySetting } from "./profileDisplay.js";

export interface ServiceBlueprintRenderNode {
  id: string;
  type: string;
  laneId?: string;
  authorOrder: number;
  shape: string;
  style?: string;
  labelLines: string[];
}

export interface ServiceBlueprintRenderLane {
  id: string;
  label: string;
  headerId: string;
  nodeIds: string[];
}

export interface ServiceBlueprintRenderEdge {
  id: string;
  from: string;
  type: string;
  to: string;
  label?: string;
  style?: string;
  constraint?: boolean;
  weight?: number;
}

export interface ServiceBlueprintRenderModel {
  lanes: ServiceBlueprintRenderLane[];
  nodes: ServiceBlueprintRenderNode[];
  edges: ServiceBlueprintRenderEdge[];
  siblingOrderChains: string[][];
  ungroupedNodeIds: string[];
}

interface ServiceBlueprintDisplayOptions {
  showSecondaryEdgeLabels: boolean;
}

function orderNodeIds(graph: CompiledGraph, nodeIds: readonly string[]): string[] {
  return getTopLevelNodeIdsInAuthorOrder(graph, nodeIds);
}

function buildAuthorOrderByNodeId(graph: CompiledGraph, projectedNodeIds: readonly string[]): Map<string, number> {
  return new Map(
    orderNodeIds(graph, projectedNodeIds).map((nodeId, index) => [nodeId, index])
  );
}

function nodeDisplay(type: string): Pick<ServiceBlueprintRenderNode, "shape" | "style"> {
  switch (type) {
    case "Step":
      return {
        shape: "box",
        style: "rounded"
      };
    case "SystemAction":
      return {
        shape: "component"
      };
    case "DataEntity":
      return {
        shape: "cylinder"
      };
    case "Policy":
      return {
        shape: "hexagon"
      };
    default:
      return {
        shape: "box"
      };
  }
}

function readServiceBlueprintDisplayOptions(policy: ResolvedProfileDisplayPolicy): ServiceBlueprintDisplayOptions {
  return {
    showSecondaryEdgeLabels: readBooleanProfileDisplaySetting(policy, "show_secondary_edge_labels", true)
  };
}

function edgeDisplay(
  type: string,
  showSecondaryEdgeLabels: boolean
): Omit<ServiceBlueprintRenderEdge, "id" | "from" | "to"> {
  switch (type) {
    case "PRECEDES":
      return {
        type,
        weight: 4
      };
    case "REALIZED_BY":
      return {
        type,
        ...(showSecondaryEdgeLabels ? { label: "realized by" } : {}),
        style: "dashed",
        constraint: false
      };
    case "DEPENDS_ON":
      return {
        type,
        ...(showSecondaryEdgeLabels ? { label: "depends on" } : {}),
        constraint: false
      };
    case "READS":
      return {
        type,
        ...(showSecondaryEdgeLabels ? { label: "reads" } : {}),
        style: "dashed",
        constraint: false
      };
    case "WRITES":
      return {
        type,
        ...(showSecondaryEdgeLabels ? { label: "writes" } : {}),
        constraint: false
      };
    case "CONSTRAINED_BY":
      return {
        type,
        ...(showSecondaryEdgeLabels ? { label: "constrained by" } : {}),
        style: "dotted",
        constraint: false
      };
    default:
      return {
        type,
        ...(showSecondaryEdgeLabels ? { label: type.toLowerCase().replace(/_/g, " ") } : {})
      };
  }
}

export function buildServiceBlueprintRenderModel(
  projection: Projection,
  graph: CompiledGraph,
  displayPolicy: ResolvedProfileDisplayPolicy = {}
): ServiceBlueprintRenderModel {
  const displayOptions = readServiceBlueprintDisplayOptions(displayPolicy);
  const projectionNodesById = new Map(projection.nodes.map((node) => [node.id, node]));
  const laneGroups = projection.derived.node_groups.filter((group) => group.role === "lane");
  const groupedNodeIds = new Set(laneGroups.flatMap((group) => group.node_ids));
  const authorOrderByNodeId = buildAuthorOrderByNodeId(
    graph,
    projection.nodes.map((node) => node.id)
  );

  const lanes = laneGroups.map<ServiceBlueprintRenderLane>((group) => ({
    id: group.id,
    label: group.label,
    headerId: `${group.id}__header`,
    nodeIds: orderNodeIds(graph, group.node_ids)
  }));
  const laneByNodeId = new Map<string, ServiceBlueprintRenderLane>();
  lanes.forEach((lane) => {
    lane.nodeIds.forEach((nodeId) => {
      laneByNodeId.set(nodeId, lane);
    });
  });

  const ungroupedNodeIds = orderNodeIds(
    graph,
    projection.nodes.map((node) => node.id).filter((nodeId) => !groupedNodeIds.has(nodeId))
  );

  const nodes = projection.nodes.map<ServiceBlueprintRenderNode>((node) => {
    const display = nodeDisplay(node.type);
    const lane = laneByNodeId.get(node.id);
    return {
      id: node.id,
      type: node.type,
      laneId: lane?.id,
      authorOrder: authorOrderByNodeId.get(node.id) ?? Number.MAX_SAFE_INTEGER,
      shape: display.shape,
      style: display.style,
      labelLines: [projectionNodesById.get(node.id)?.name ?? node.name]
    };
  });

  const edges = projection.edges.map<ServiceBlueprintRenderEdge>((edge) => ({
    id: `${edge.from}__${edge.type.toLowerCase()}__${edge.to}`,
    from: edge.from,
    to: edge.to,
    ...edgeDisplay(edge.type, displayOptions.showSecondaryEdgeLabels)
  }));

  const siblingOrderChains = [
    ...(lanes.length > 1 ? [lanes.map((lane) => lane.headerId)] : []),
    ...lanes
      .map((lane) => [lane.headerId, ...lane.nodeIds])
      .filter((chain) => chain.length > 1),
    ...(ungroupedNodeIds.length > 1 ? [ungroupedNodeIds] : [])
  ];

  return {
    lanes,
    nodes,
    edges,
    siblingOrderChains,
    ungroupedNodeIds
  };
}
