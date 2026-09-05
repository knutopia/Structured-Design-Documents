import { getSourceOrderedStructuralStream, getTopLevelNodeIdsInAuthorOrder } from "../compiler/authorOrder.js";
import type { CompiledGraph } from "../compiler/types.js";
import type { Projection } from "../projector/types.js";
import { resolvePlaceLabelDisplayOptions } from "./placeLabelLines.js";
import type { ResolvedDetailDisplayPolicy } from "./detailDisplay.js";
import type { SharedNodeAttribute } from "./staged/contracts.js";

export interface IaRenderArea {
  kind: "area";
  id: string;
  label: string;
  items: IaRenderItem[];
  orderAnchorId?: string;
}

export interface IaRenderPlace {
  kind: "place";
  id: string;
  title: string;
  attributes: SharedNodeAttribute[];
  items: IaRenderItem[];
  orderAnchorId: string;
}

export type IaRenderItem = IaRenderArea | IaRenderPlace;

export interface IaRenderEdge {
  from: string;
  to: string;
}

export interface IaPlaceMapRenderModel {
  rootItems: IaRenderItem[];
  edges: IaRenderEdge[];
  siblingOrderChains: string[][];
}

function collectSiblingOrderChains(items: IaRenderItem[]): string[][] {
  const chains: string[][] = [];
  const directAnchors = items
    .map((item) => item.orderAnchorId)
    .filter((anchorId): anchorId is string => typeof anchorId === "string");
  if (directAnchors.length > 1) {
    chains.push(directAnchors);
  }

  for (const item of items) {
    chains.push(...collectSiblingOrderChains(item.items));
  }

  return chains;
}

export function buildIaPlaceMapRenderModel(
  projection: Projection,
  graph: CompiledGraph,
  hierarchyEdgeTypes: string[],
  displayPolicy: ResolvedDetailDisplayPolicy
): IaPlaceMapRenderModel {
  const graphNodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const projectionNodesById = new Map(projection.nodes.map((node) => [node.id, node]));
  const annotationsByNodeId = new Map(
    projection.derived.node_annotations.map((annotation) => [annotation.node_id, annotation])
  );
  const displayOptions = resolvePlaceLabelDisplayOptions(displayPolicy);
  const visibleNodeIds = new Set(projection.nodes.map((node) => node.id));
  const visiblePlaceIds = new Set(projection.nodes.filter((candidate) => candidate.type === "Place").map((node) => node.id));
  const hierarchyTypeSet = new Set(hierarchyEdgeTypes);
  const structuralParentByChildId = new Map<string, string>();

  for (const edge of projection.edges.filter((candidate) => hierarchyTypeSet.has(candidate.type))) {
    const parentNode = projectionNodesById.get(edge.from);
    const childNode = projectionNodesById.get(edge.to);
    if (!parentNode || childNode?.type !== "Place") {
      continue;
    }
    if ((parentNode.type === "Area" || parentNode.type === "Place") && !structuralParentByChildId.has(childNode.id)) {
      structuralParentByChildId.set(childNode.id, parentNode.id);
    }
  }

  const placeItemsById = new Map<string, IaRenderPlace>();
  const areaItemsById = new Map<string, IaRenderArea>();

  const buildPlaceItem = (placeId: string): IaRenderPlace | undefined => {
    const existing = placeItemsById.get(placeId);
    if (existing) {
      return existing;
    }

    const projectionNode = projectionNodesById.get(placeId);
    if (!projectionNode || projectionNode.type !== "Place") {
      return undefined;
    }

    const graphNode = graphNodesById.get(placeId);
    const annotation = annotationsByNodeId.get(placeId);
    const display = annotation?.display;
    const attributes: SharedNodeAttribute[] = [];
    const routeOrKey = display?.subtitle ?? graphNode?.props.route_or_key;
    if (displayOptions.showPlaceRouteOrKey && routeOrKey) {
      attributes.push({
        groupId: "route_or_key",
        label: "route or key",
        value: routeOrKey
      });
    }
    const access = display?.badge ?? graphNode?.props.access;
    if (displayOptions.showPlaceAccess && access) {
      attributes.push({
        groupId: "access",
        label: "access",
        value: access
      });
    }
    for (const metadata of display?.metadata ?? []) {
      if (
        (metadata.key === "entry_points" && !displayOptions.showPlaceEntryPoints)
        || (metadata.key === "primary_nav" && !displayOptions.showPlacePrimaryNav)
      ) {
        continue;
      }
      attributes.push({
        groupId: metadata.key,
        label: metadata.key,
        value: metadata.value
      });
    }

    const childItems = getSourceOrderedStructuralStream(graph, placeId, hierarchyEdgeTypes, visiblePlaceIds)
      .filter((entry) => structuralParentByChildId.get(entry.to) === placeId)
      .map((entry) => buildPlaceItem(entry.to))
      .filter((item): item is IaRenderPlace => item !== undefined);

    const place: IaRenderPlace = {
      kind: "place",
      id: placeId,
      title: projectionNode.name,
      attributes,
      items: childItems,
      orderAnchorId: placeId
    };
    placeItemsById.set(placeId, place);
    return place;
  };

  const buildAreaItem = (areaId: string): IaRenderArea | undefined => {
    const existing = areaItemsById.get(areaId);
    if (existing) {
      return existing;
    }

    const projectionNode = projectionNodesById.get(areaId);
    if (!projectionNode || projectionNode.type !== "Area") {
      return undefined;
    }

    const items = getSourceOrderedStructuralStream(graph, areaId, hierarchyEdgeTypes, visiblePlaceIds)
      .filter((entry) => structuralParentByChildId.get(entry.to) === areaId)
      .map((entry) => buildPlaceItem(entry.to))
      .filter((item): item is IaRenderPlace => item !== undefined);

    const area: IaRenderArea = {
      kind: "area",
      id: areaId,
      label: projectionNode.name,
      items,
      orderAnchorId: items[0]?.orderAnchorId
    };
    areaItemsById.set(areaId, area);
    return area;
  };

  const rootNodeIds = projection.nodes
    .filter((node) => (node.type === "Area" || node.type === "Place") && !structuralParentByChildId.has(node.id))
    .map((node) => node.id);
  const rootItems = getTopLevelNodeIdsInAuthorOrder(graph, rootNodeIds)
    .map((nodeId) => {
      const node = projectionNodesById.get(nodeId);
      if (node?.type === "Area") {
        return buildAreaItem(nodeId);
      }
      if (node?.type === "Place") {
        return buildPlaceItem(nodeId);
      }
      return undefined;
    })
    .filter((item): item is IaRenderItem => item !== undefined);

  const edges = projection.edges
    .filter((edge) => edge.type === "NAVIGATES_TO" && visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to))
    .map((edge) => ({
      from: edge.from,
      to: edge.to
    }))
    .sort((left, right) => {
      const fromCompare = left.from.localeCompare(right.from);
      if (fromCompare !== 0) {
        return fromCompare;
      }
      return left.to.localeCompare(right.to);
    });

  return {
    rootItems,
    edges,
    siblingOrderChains: collectSiblingOrderChains(rootItems)
  };
}
