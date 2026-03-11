import { getTopLevelNodeIdsInAuthorOrder } from "../compiler/authorOrder.js";
import type { CompiledGraph } from "../compiler/types.js";
import type { Projection } from "../projector/types.js";

type OutcomeOpportunityLaneId = "initiative" | "opportunity" | "outcome" | "metric";

export interface OutcomeOpportunityRenderNode {
  id: string;
  laneId: OutcomeOpportunityLaneId;
  shape: string;
  labelLines: string[];
}

export interface OutcomeOpportunityRenderLane {
  id: OutcomeOpportunityLaneId;
  label: string;
  headerId: string;
  nodeIds: string[];
}

export interface OutcomeOpportunityRenderEdge {
  from: string;
  to: string;
  label: string;
}

export interface OutcomeOpportunityMapRenderModel {
  lanes: OutcomeOpportunityRenderLane[];
  nodes: OutcomeOpportunityRenderNode[];
  edges: OutcomeOpportunityRenderEdge[];
  siblingOrderChains: string[][];
}

const laneOrder: Array<{ id: OutcomeOpportunityLaneId; label: string; type: string }> = [
  { id: "initiative", label: "Initiatives", type: "Initiative" },
  { id: "opportunity", label: "Opportunities", type: "Opportunity" },
  { id: "outcome", label: "Outcomes", type: "Outcome" },
  { id: "metric", label: "Metrics", type: "Metric" }
];

function capitalize(text: string | undefined): string {
  if (!text || text.length === 0) {
    return "Reference";
  }
  return `${text[0].toUpperCase()}${text.slice(1)}`;
}

function formatReferenceTarget(targetId: string, targetName?: string): string {
  if (targetName && targetName.length > 0 && targetName !== targetId) {
    return `${targetId} ${targetName}`;
  }

  return targetName && targetName.length > 0 ? targetName : targetId;
}

function edgeDisplayLabel(edgeType: string): string {
  return edgeType.toLowerCase().replace(/_/g, " ");
}

function shapeForNodeType(type: string): string {
  switch (type) {
    case "Outcome":
      return "ellipse";
    case "Metric":
      return "note";
    case "Opportunity":
      return "hexagon";
    default:
      return "box";
  }
}

export function buildOutcomeOpportunityMapRenderModel(
  projection: Projection,
  graph: CompiledGraph
): OutcomeOpportunityMapRenderModel {
  const projectionNodesById = new Map(projection.nodes.map((node) => [node.id, node]));
  const annotationsByNodeId = new Map(
    projection.derived.node_annotations.map((annotation) => [annotation.node_id, annotation])
  );
  const orderedProjectionNodeIds = getTopLevelNodeIdsInAuthorOrder(
    graph,
    projection.nodes.map((node) => node.id)
  );
  const nodeRankById = new Map(orderedProjectionNodeIds.map((nodeId, index) => [nodeId, index]));

  const nodes = laneOrder.flatMap((lane) => {
    const laneNodeIds = projection.nodes
      .filter((node) => node.type === lane.type)
      .map((node) => node.id)
      .sort((left, right) => (nodeRankById.get(left) ?? Number.MAX_SAFE_INTEGER) - (nodeRankById.get(right) ?? Number.MAX_SAFE_INTEGER));

    return laneNodeIds.map<OutcomeOpportunityRenderNode>((nodeId) => {
      const node = projectionNodesById.get(nodeId)!;
      const labelLines = [node.name];
      for (const reference of annotationsByNodeId.get(nodeId)?.references ?? []) {
        labelLines.push(`${capitalize(reference.group)}: ${formatReferenceTarget(reference.target_id, reference.target_name)}`);
      }

      return {
        id: node.id,
        laneId: lane.id,
        shape: shapeForNodeType(node.type),
        labelLines
      };
    });
  });

  const nodesByLaneId = new Map<OutcomeOpportunityLaneId, string[]>();
  for (const node of nodes) {
    const laneNodes = nodesByLaneId.get(node.laneId) ?? [];
    laneNodes.push(node.id);
    nodesByLaneId.set(node.laneId, laneNodes);
  }

  const lanes = laneOrder
    .map<OutcomeOpportunityRenderLane | undefined>((lane) => {
      const nodeIds = nodesByLaneId.get(lane.id) ?? [];
      if (nodeIds.length === 0) {
        return undefined;
      }

      return {
        id: lane.id,
        label: lane.label,
        headerId: `lane_${lane.id}`,
        nodeIds
      };
    })
    .filter((lane): lane is OutcomeOpportunityRenderLane => lane !== undefined);

  const siblingOrderChains = [
    ...(lanes.length > 1 ? [lanes.map((lane) => lane.headerId)] : []),
    ...lanes
      .map((lane) => [lane.headerId, ...lane.nodeIds])
      .filter((chain) => chain.length > 1)
  ];

  const edges = projection.edges.map((edge) => ({
    from: edge.from,
    to: edge.to,
    label: edgeDisplayLabel(edge.type)
  }));

  return {
    lanes,
    nodes,
    edges,
    siblingOrderChains
  };
}
