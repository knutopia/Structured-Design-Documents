import { getTopLevelNodeIdsInAuthorOrder } from "../compiler/authorOrder.js";
import type { CompiledGraph } from "../compiler/types.js";
import type { Projection } from "../projector/types.js";

export interface ServiceBlueprintRenderNode {
  id: string;
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
  from: string;
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

function orderNodeIds(graph: CompiledGraph, nodeIds: string[]): string[] {
  return getTopLevelNodeIdsInAuthorOrder(graph, nodeIds);
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

function edgeDisplay(type: string): Omit<ServiceBlueprintRenderEdge, "from" | "to"> {
  switch (type) {
    case "PRECEDES":
      return {
        weight: 4
      };
    case "REALIZED_BY":
      return {
        label: "realized by",
        style: "dashed",
        constraint: false
      };
    case "DEPENDS_ON":
      return {
        label: "depends on",
        constraint: false
      };
    case "READS":
      return {
        label: "reads",
        style: "dashed",
        constraint: false
      };
    case "WRITES":
      return {
        label: "writes",
        style: "bold",
        constraint: false
      };
    case "CONSTRAINED_BY":
      return {
        label: "constrained by",
        style: "dotted",
        constraint: false
      };
    default:
      return {
        label: type.toLowerCase().replace(/_/g, " ")
      };
  }
}

export function buildServiceBlueprintRenderModel(
  projection: Projection,
  graph: CompiledGraph
): ServiceBlueprintRenderModel {
  const projectionNodesById = new Map(projection.nodes.map((node) => [node.id, node]));
  const laneGroups = projection.derived.node_groups.filter((group) => group.role === "lane");
  const groupedNodeIds = new Set(laneGroups.flatMap((group) => group.node_ids));

  const lanes = laneGroups.map<ServiceBlueprintRenderLane>((group) => ({
    id: group.id,
    label: group.label,
    headerId: `${group.id}__header`,
    nodeIds: orderNodeIds(graph, group.node_ids)
  }));

  const ungroupedNodeIds = orderNodeIds(
    graph,
    projection.nodes.map((node) => node.id).filter((nodeId) => !groupedNodeIds.has(nodeId))
  );

  const nodes = projection.nodes.map<ServiceBlueprintRenderNode>((node) => {
    const display = nodeDisplay(node.type);
    return {
      id: node.id,
      shape: display.shape,
      style: display.style,
      labelLines: [projectionNodesById.get(node.id)?.name ?? node.name]
    };
  });

  const edges = projection.edges.map<ServiceBlueprintRenderEdge>((edge) => ({
    from: edge.from,
    to: edge.to,
    ...edgeDisplay(edge.type)
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
