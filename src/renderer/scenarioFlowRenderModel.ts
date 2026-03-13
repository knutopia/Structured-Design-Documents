import { getTopLevelNodeIdsInAuthorOrder } from "../compiler/authorOrder.js";
import type { CompiledGraph } from "../compiler/types.js";
import type { Projection } from "../projector/types.js";
import type { ResolvedProfileDisplayPolicy } from "./profileDisplay.js";
import { readBooleanProfileDisplaySetting } from "./profileDisplay.js";

type ScenarioLaneId = "step" | "place" | "view_state";

export interface ScenarioFlowRenderNode {
  id: string;
  shape: string;
  style?: string;
  labelLines: string[];
}

export interface ScenarioFlowRenderLane {
  id: ScenarioLaneId;
  label: string;
  headerId: string;
  nodeIds: string[];
}

export interface ScenarioFlowRenderEdge {
  from: string;
  to: string;
  label?: string;
  style?: string;
  constraint?: boolean;
  weight?: number;
}

export interface ScenarioFlowRenderModel {
  lanes: ScenarioFlowRenderLane[];
  nodes: ScenarioFlowRenderNode[];
  edges: ScenarioFlowRenderEdge[];
  siblingOrderChains: string[][];
}

interface ScenarioFlowDisplayOptions {
  showBranchLabels: boolean;
}

const laneSpecs: Array<{ id: ScenarioLaneId; label: string; type: string }> = [
  { id: "step", label: "Steps", type: "Step" },
  { id: "place", label: "Places", type: "Place" },
  { id: "view_state", label: "View States", type: "ViewState" }
];

function orderNodeIds(graph: CompiledGraph, nodeIds: string[]): string[] {
  return getTopLevelNodeIdsInAuthorOrder(graph, nodeIds);
}

function edgeAnnotationKey(from: string, to: string): string {
  return `${from}->${to}`;
}

function nodeDisplay(type: string, shapeOverride?: string): Pick<ScenarioFlowRenderNode, "shape" | "style"> {
  if (shapeOverride) {
    return {
      shape: shapeOverride
    };
  }

  switch (type) {
    case "Place":
      return {
        shape: "box",
        style: "rounded"
      };
    case "ViewState":
      return {
        shape: "box",
        style: "rounded,dashed"
      };
    default:
      return {
        shape: "box",
        style: "rounded"
      };
  }
}

function edgeDisplay(type: string, label?: string): Omit<ScenarioFlowRenderEdge, "from" | "to"> {
  switch (type) {
    case "PRECEDES":
      return {
        label,
        weight: 4
      };
    case "REALIZED_BY":
      return {
        style: "dotted",
        constraint: false
      };
    case "NAVIGATES_TO":
      return {
        style: "solid",
        weight: 3
      };
    case "TRANSITIONS_TO":
      return {
        style: "dashed",
        weight: 3
      };
    default:
      return {
        label
      };
  }
}

function readScenarioFlowDisplayOptions(policy: ResolvedProfileDisplayPolicy): ScenarioFlowDisplayOptions {
  return {
    showBranchLabels: readBooleanProfileDisplaySetting(policy, "show_branch_labels", true)
  };
}

export function buildScenarioFlowRenderModel(
  projection: Projection,
  graph: CompiledGraph,
  displayPolicy: ResolvedProfileDisplayPolicy = {}
): ScenarioFlowRenderModel {
  const displayOptions = readScenarioFlowDisplayOptions(displayPolicy);
  const projectionNodesById = new Map(projection.nodes.map((node) => [node.id, node]));
  const nodeAnnotationsById = new Map(
    projection.derived.node_annotations.map((annotation) => [annotation.node_id, annotation])
  );
  const edgeAnnotationsById = new Map(
    projection.derived.edge_annotations
      .filter((annotation) => annotation.role === "branch_label")
      .map((annotation) => [edgeAnnotationKey(annotation.from, annotation.to), annotation])
  );

  const lanes = laneSpecs
    .map<ScenarioFlowRenderLane | undefined>((lane) => {
      const nodeIds = orderNodeIds(
        graph,
        projection.nodes.filter((node) => node.type === lane.type).map((node) => node.id)
      );
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
    .filter((lane): lane is ScenarioFlowRenderLane => lane !== undefined);

  const nodes = projection.nodes.map<ScenarioFlowRenderNode>((node) => {
    const annotation = nodeAnnotationsById.get(node.id);
    const display = nodeDisplay(node.type, annotation?.display?.shape);
    return {
      id: node.id,
      shape: display.shape,
      style: display.style,
      labelLines: [projectionNodesById.get(node.id)?.name ?? node.name]
    };
  });

  const edges = projection.edges.map<ScenarioFlowRenderEdge>((edge) => {
    const branchLabel = displayOptions.showBranchLabels
      ? edgeAnnotationsById.get(edgeAnnotationKey(edge.from, edge.to))?.display_label
      : undefined;
    return {
      from: edge.from,
      to: edge.to,
      ...edgeDisplay(edge.type, branchLabel)
    };
  });

  const siblingOrderChains = [
    ...(lanes.length > 1 ? [lanes.map((lane) => lane.headerId)] : []),
    ...lanes
      .map((lane) => [lane.headerId, ...lane.nodeIds])
      .filter((chain) => chain.length > 1)
  ];

  return {
    lanes,
    nodes,
    edges,
    siblingOrderChains
  };
}
