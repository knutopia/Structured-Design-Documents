import { getSourceOrderedStructuralStream, getTopLevelNodeIdsInAuthorOrder } from "../compiler/authorOrder.js";
import type { CompiledGraph } from "../compiler/types.js";
import type { Projection } from "../projector/types.js";

export interface JourneyRenderStep {
  kind: "step";
  id: string;
  labelLines: string[];
  orderAnchorId: string;
}

export interface JourneyRenderStage {
  kind: "stage";
  id: string;
  label: string;
  anchorId: string;
  orderAnchorId: string;
  items: JourneyRenderStep[];
}

export type JourneyRenderItem = JourneyRenderStage | JourneyRenderStep;

export interface JourneyRenderEdge {
  from: string;
  to: string;
}

export interface JourneyMapRenderModel {
  rootItems: JourneyRenderItem[];
  edges: JourneyRenderEdge[];
  siblingOrderChains: string[][];
}

function collectSiblingOrderChains(items: JourneyRenderItem[]): string[][] {
  const chains: string[][] = [];
  const rootAnchors = items.map((item) => item.orderAnchorId);
  if (rootAnchors.length > 1) {
    chains.push(rootAnchors);
  }

  for (const item of items) {
    if (item.kind !== "stage") {
      continue;
    }

    const childAnchors = item.items.map((child) => child.orderAnchorId);
    if (childAnchors.length > 0) {
      chains.push([item.anchorId, ...childAnchors]);
    }
  }

  return chains;
}

function buildReferenceBadge(targetId: string, targetName?: string): string {
  return `[${targetName && targetName.length > 0 ? targetName : targetId}]`;
}

export function buildJourneyMapRenderModel(
  projection: Projection,
  graph: CompiledGraph,
  hierarchyEdgeTypes: string[],
  orderingEdgeTypes: string[]
): JourneyMapRenderModel {
  const projectionNodesById = new Map(projection.nodes.map((node) => [node.id, node]));
  const annotationsByNodeId = new Map(
    projection.derived.node_annotations.map((annotation) => [annotation.node_id, annotation])
  );
  const visibleNodeIds = new Set(projection.nodes.map((node) => node.id));
  const visibleStepIds = new Set(
    projection.nodes.filter((candidate) => candidate.type === "Step").map((node) => node.id)
  );
  const hierarchyTypeSet = new Set(hierarchyEdgeTypes);
  const orderingTypeSet = new Set(orderingEdgeTypes);
  const structuralParentByStepId = new Map<string, string>();

  for (const edge of projection.edges.filter((candidate) => hierarchyTypeSet.has(candidate.type))) {
    const parentNode = projectionNodesById.get(edge.from);
    const childNode = projectionNodesById.get(edge.to);
    if (parentNode?.type !== "Stage" || childNode?.type !== "Step" || structuralParentByStepId.has(childNode.id)) {
      continue;
    }
    structuralParentByStepId.set(childNode.id, parentNode.id);
  }

  const buildStepItem = (stepId: string): JourneyRenderStep | undefined => {
    const projectionNode = projectionNodesById.get(stepId);
    if (!projectionNode || projectionNode.type !== "Step") {
      return undefined;
    }

    const labelLines = [projectionNode.name];
    for (const reference of annotationsByNodeId.get(stepId)?.references ?? []) {
      labelLines.push(buildReferenceBadge(reference.target_id, reference.target_name));
    }

    return {
      kind: "step",
      id: stepId,
      labelLines,
      orderAnchorId: stepId
    };
  };

  const buildStageItem = (stageId: string): JourneyRenderStage | undefined => {
    const projectionNode = projectionNodesById.get(stageId);
    if (!projectionNode || projectionNode.type !== "Stage") {
      return undefined;
    }

    const items = getSourceOrderedStructuralStream(graph, stageId, hierarchyEdgeTypes, visibleStepIds)
      .filter((entry) => structuralParentByStepId.get(entry.to) === stageId)
      .map((entry) => buildStepItem(entry.to))
      .filter((item): item is JourneyRenderStep => item !== undefined);

    return {
      kind: "stage",
      id: stageId,
      label: projectionNode.name,
      anchorId: `${stageId}__anchor`,
      orderAnchorId: `${stageId}__anchor`,
      items
    };
  };

  const rootNodeIds = projection.nodes
    .filter((node) => (node.type === "Stage" || node.type === "Step") && !structuralParentByStepId.has(node.id))
    .map((node) => node.id);
  const rootItems = getTopLevelNodeIdsInAuthorOrder(graph, rootNodeIds)
    .map((nodeId) => {
      const node = projectionNodesById.get(nodeId);
      if (node?.type === "Stage") {
        return buildStageItem(nodeId);
      }
      if (node?.type === "Step") {
        return buildStepItem(nodeId);
      }
      return undefined;
    })
    .filter((item): item is JourneyRenderItem => item !== undefined);

  const edges = projection.edges
    .filter(
      (edge) => orderingTypeSet.has(edge.type) && visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to)
    )
    .map((edge) => ({
      from: edge.from,
      to: edge.to
    }));

  return {
    rootItems,
    edges,
    siblingOrderChains: collectSiblingOrderChains(rootItems)
  };
}
