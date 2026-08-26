import { getTopLevelNodeIdsInAuthorOrder } from "../compiler/authorOrder.js";
import type { RendererScenarioFlowLayoutConfig, ViewSpec } from "../bundle/types.js";
import { getGraphAuthorOrder, type CompiledGraph } from "../compiler/types.js";
import type { Projection } from "../projector/types.js";
import type { ResolvedDetailDisplayPolicy } from "./detailDisplay.js";
import { readBooleanDetailDisplaySetting } from "./detailDisplay.js";

type ScenarioLaneId = "step" | "place" | "view_state";

export interface ScenarioFlowRenderNode {
  id: string;
  type: string;
  authorOrder: number;
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
  id: string;
  from: string;
  type: string;
  to: string;
  label?: string;
  branchLabel?: string;
  branchLabelSource?: string;
  authorOrder: number;
  style?: string;
  constraint?: boolean;
  weight?: number;
}

export interface ScenarioFlowRenderModel {
  layout: RendererScenarioFlowLayoutConfig;
  orderingEdgeTypes: string[];
  lanes: ScenarioFlowRenderLane[];
  nodes: ScenarioFlowRenderNode[];
  edges: ScenarioFlowRenderEdge[];
  siblingOrderChains: string[][];
}

interface ScenarioFlowDisplayOptions {
  showBranchLabels: boolean;
}

function readScenarioFlowLayout(view: ViewSpec): RendererScenarioFlowLayoutConfig {
  const layout = view.conventions.renderer_defaults?.scenario_flow_layout;
  if (!layout) {
    throw new Error(`View '${view.id}' does not declare renderer_defaults.scenario_flow_layout`);
  }
  return layout;
}

function orderNodeIds(graph: CompiledGraph, nodeIds: string[]): string[] {
  return getTopLevelNodeIdsInAuthorOrder(graph, nodeIds);
}

function buildAuthorOrderByNodeId(graph: CompiledGraph, projectedNodeIds: readonly string[]): Map<string, number> {
  return new Map(
    orderNodeIds(graph, [...projectedNodeIds]).map((nodeId, index) => [nodeId, index])
  );
}

function buildAuthorOrderByEdgeKey(graph: CompiledGraph): Map<string, number> {
  const graphAuthorOrder = getGraphAuthorOrder(graph);
  const orderByKey = new Map<string, number>();
  let nextOrder = 0;

  if (graphAuthorOrder) {
    for (const [from, edges] of graphAuthorOrder.edgeLineOrderByParentId.entries()) {
      for (const edge of edges) {
        const key = `${from}->${edge.type}->${edge.to}`;
        if (!orderByKey.has(key)) {
          orderByKey.set(key, nextOrder);
        }
        nextOrder += 1;
      }
    }
  }

  for (const edge of graph.edges) {
    const key = `${edge.from}->${edge.type}->${edge.to}`;
    if (!orderByKey.has(key)) {
      orderByKey.set(key, nextOrder);
      nextOrder += 1;
    }
  }

  return orderByKey;
}

function edgeAnnotationKey(from: string, to: string): string {
  return `${from}->${to}`;
}

function normalizeBranchLabelDisplay(label: string | undefined): string | undefined {
  const normalized = label?.trim().toLowerCase().replace(/_/g, " ");
  return normalized ? normalized : undefined;
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

function edgeDisplay(type: string, label?: string): Pick<ScenarioFlowRenderEdge, "label" | "style" | "constraint" | "weight"> {
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

function readScenarioFlowDisplayOptions(policy: ResolvedDetailDisplayPolicy): ScenarioFlowDisplayOptions {
  return {
    showBranchLabels: readBooleanDetailDisplaySetting(policy, "show_branch_labels")
  };
}

export function buildScenarioFlowRenderModel(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  displayPolicy: ResolvedDetailDisplayPolicy
): ScenarioFlowRenderModel {
  const layout = readScenarioFlowLayout(view);
  const displayOptions = readScenarioFlowDisplayOptions(displayPolicy);
  const projectionNodesById = new Map(projection.nodes.map((node) => [node.id, node]));
  const authorOrderByNodeId = buildAuthorOrderByNodeId(
    graph,
    projection.nodes.map((node) => node.id)
  );
  const authorOrderByEdgeKey = buildAuthorOrderByEdgeKey(graph);
  const nodeAnnotationsById = new Map(
    projection.derived.node_annotations.map((annotation) => [annotation.node_id, annotation])
  );
  const edgeAnnotationsById = new Map(
    projection.derived.edge_annotations
      .filter((annotation) => annotation.role === "branch_label")
      .map((annotation) => [edgeAnnotationKey(annotation.from, annotation.to), annotation])
  );

  const lanes = layout.lanes
    .map<ScenarioFlowRenderLane | undefined>((lane) => {
      const nodeIds = orderNodeIds(
        graph,
        projection.nodes.filter((node) => lane.node_types.includes(node.type)).map((node) => node.id)
      );
      if (nodeIds.length === 0 && layout.empty_lane_policy === "omit") {
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
      type: node.type,
      authorOrder: authorOrderByNodeId.get(node.id) ?? Number.MAX_SAFE_INTEGER,
      shape: display.shape,
      style: display.style,
      labelLines: [projectionNodesById.get(node.id)?.name ?? node.name]
    };
  });

  const edges = projection.edges.map<ScenarioFlowRenderEdge>((edge) => {
    const branchAnnotation = edgeAnnotationsById.get(edgeAnnotationKey(edge.from, edge.to));
    const branchLabel = normalizeBranchLabelDisplay(branchAnnotation?.display_label);
    return {
      id: `${edge.from}__${edge.type.toLowerCase()}__${edge.to}`,
      from: edge.from,
      type: edge.type,
      to: edge.to,
      ...edgeDisplay(edge.type, displayOptions.showBranchLabels ? branchLabel : undefined),
      branchLabel,
      branchLabelSource: branchAnnotation?.label_source,
      authorOrder: authorOrderByEdgeKey.get(`${edge.from}->${edge.type}->${edge.to}`) ?? Number.MAX_SAFE_INTEGER
    };
  });

  const siblingOrderChains = [
    ...(lanes.length > 1 ? [lanes.map((lane) => lane.headerId)] : []),
    ...lanes
      .map((lane) => [lane.headerId, ...lane.nodeIds])
      .filter((chain) => chain.length > 1)
  ];

  return {
    layout,
    orderingEdgeTypes: [...view.projection.ordering_edges],
    lanes,
    nodes,
    edges,
    siblingOrderChains
  };
}
