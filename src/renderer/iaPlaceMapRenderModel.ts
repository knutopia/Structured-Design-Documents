import { graphForProjection } from "../projector/edgeOccurrences.js";
import { resolveProjectionEdge } from "../projector/edgeOccurrences.js";
import { getSourceOrderedStructuralStream, getTopLevelNodeIdsInAuthorOrder } from "../compiler/authorOrder.js";
import { getCompiledEdgeSourceSpan, type CompiledGraph } from "../compiler/types.js";
import type { Projection } from "../projector/types.js";
import type { Bundle, RendererIaPlaceMapConfig } from "../bundle/types.js";
import { resolvePlaceLabelDisplayOptions } from "./placeLabelLines.js";
import type { ResolvedDetailDisplayPolicy } from "./detailDisplay.js";
import type { SharedNodeAttribute } from "./staged/contracts.js";
import { prepareRelationshipLabels } from "./relationshipLabelFormatter.js";

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
  id: string;
  source_edge_id?: string;
  from: string;
  to: string;
  label?: string;
  preferredBreaks?: number[];
  annotated: boolean;
  sourceOrder: number;
  fromAncestryIds: string[];
  toAncestryIds: string[];
}

export interface IaRenderStructuralEdge {
  source_edge_id?: string;
  from: string;
  to: string;
  type: string;
}

export interface IaPlaceMapRenderModel {
  rootItems: IaRenderItem[];
  edges: IaRenderEdge[];
  structuralEdges: IaRenderStructuralEdge[];
  occurrencePolicyEnabled: boolean;
  siblingOrderChains: string[][];
}

export interface IaPlaceMapRelationshipRuntime {
  supportedAnnotationFields: string[];
  annotationReferenceTypes: Record<string, string>;
}

/** Resolve presentation-only annotation metadata from the loaded contract. */
export function resolveIaPlaceMapRelationshipRuntime(
  bundle: Bundle,
  rendererConfig: RendererIaPlaceMapConfig
): IaPlaceMapRelationshipRuntime {
  const relationship = bundle.contracts.relationships.find((candidate) => candidate.type === rendererConfig.navigation.relationship);
  if (!relationship) {
    throw new Error(`IA renderer policy selects unknown relationship '${rendererConfig.navigation.relationship}'.`);
  }
  const supportedAnnotationFields = relationship.constraints.flatMap((constraint) => {
    const logic = constraint.rule_logic;
    if (logic?.kind !== "edge_field_support" || !Array.isArray(logic.annotations)) return [];
    return logic.annotations.filter((field): field is string => typeof field === "string");
  });
  return {
    supportedAnnotationFields,
    annotationReferenceTypes: relationship.presentation_annotation_references
      ? Object.fromEntries(Object.entries(relationship.presentation_annotation_references).map(([field, reference]) => [field, reference.node_type]))
      : {}
  };
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
  displayPolicy: ResolvedDetailDisplayPolicy,
  rendererConfig?: RendererIaPlaceMapConfig,
  detailId?: string,
  relationshipRuntime?: IaPlaceMapRelationshipRuntime
): IaPlaceMapRenderModel {
  const documentGraph = graph;
  graph = graphForProjection(projection, graph);
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

  const ancestryByPlaceId = new Map<string, string[]>();
  const collectAncestry = (items: readonly IaRenderItem[], ancestry: readonly string[]): void => {
    for (const item of items) {
      if (item.kind === "area") {
        collectAncestry(item.items, [...ancestry, item.id]);
      } else {
        const nextAncestry = [...ancestry, item.id];
        ancestryByPlaceId.set(item.id, nextAncestry);
        collectAncestry(item.items, nextAncestry);
      }
    }
  };
  collectAncestry(rootItems, []);

  const occurrencePolicyEnabled = rendererConfig !== undefined;
  const navigationRelationship = rendererConfig?.navigation.relationship ?? "NAVIGATES_TO";
  const selectedNavigationEdges = projection.edges.filter((edge) =>
    edge.type === navigationRelationship && visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to)
  );
  const compiledNavigationEdges = selectedNavigationEdges.map((edge) => {
    if (occurrencePolicyEnabled && !edge.source_edge_id) {
      throw new Error(`IA navigation occurrence ${edge.from} ${edge.type} ${edge.to} has no exact source_edge_id.`);
    }
    return resolveProjectionEdge(edge, graph, Boolean(projection.diagram_id))!;
  });
  const orderedNavigationEdges = selectedNavigationEdges.map((edge, index) => ({
    edge,
    compiledEdge: compiledNavigationEdges[index]!,
    projectionOrder: index,
    sourceOffset: getCompiledEdgeSourceSpan(compiledNavigationEdges[index]!)?.startOffset
  }));
  if (occurrencePolicyEnabled) {
    const documentEdgeOrder = new Map(documentGraph.edges.map((edge, index) => [edge, index]));
    orderedNavigationEdges.sort((left, right) =>
      (left.sourceOffset ?? documentEdgeOrder.get(left.compiledEdge) ?? left.projectionOrder)
      - (right.sourceOffset ?? documentEdgeOrder.get(right.compiledEdge) ?? right.projectionOrder)
      || left.projectionOrder - right.projectionOrder
    );
  }
  const orderedCompiledNavigationEdges = orderedNavigationEdges.map(({ compiledEdge }) => compiledEdge);
  const labels = rendererConfig
    ? prepareRelationshipLabels(
      orderedCompiledNavigationEdges,
      new Map(documentGraph.nodes
        .filter((node) => rendererConfig.navigation.presentation.parts.some((part) =>
          part.resolve_node_name
          && relationshipRuntime?.annotationReferenceTypes[part.field] === node.type
        ))
        .map((node) => [node.id, node.name])),
      rendererConfig.navigation.presentation,
      detailId ?? "",
      documentGraph.edges.filter((edge) => edge.type === navigationRelationship)
    )
    : orderedCompiledNavigationEdges.map(() => undefined);
  const sourceOccurrences = new Map<string, number>();
  const edges = orderedNavigationEdges.map(({ edge }, index) => {
    const compiledEdge = orderedCompiledNavigationEdges[index]!;
    const triple = JSON.stringify([edge.from, edge.type, edge.to]);
    const ordinal = sourceOccurrences.get(triple) ?? 0;
    sourceOccurrences.set(triple, ordinal + 1);
    const sourceId = edge.source_edge_id;
    const preparedLabel = labels[index];
    const label = preparedLabel?.text;
    return {
      id: sourceId ? `navigation:${sourceId}` : `navigation:${encodeURIComponent(triple)}:${ordinal}`,
      from: edge.from,
      to: edge.to,
      annotated: (relationshipRuntime?.supportedAnnotationFields ?? []).some((field) => {
        const value = (compiledEdge as unknown as Record<string, unknown>)[field];
        return typeof value === "string" && value.length > 0;
      }),
      sourceOrder: index,
      fromAncestryIds: [...(ancestryByPlaceId.get(edge.from) ?? [])],
      toAncestryIds: [...(ancestryByPlaceId.get(edge.to) ?? [])],
      ...(sourceId ? { source_edge_id: sourceId } : {}),
      ...(label ? { label, ...(preparedLabel?.preferredBreaks ? { preferredBreaks: [...preparedLabel.preferredBreaks] } : {}) } : {})
    };
  });
  if (!occurrencePolicyEnabled) {
    edges.sort((left, right) => {
      const fromCompare = left.from.localeCompare(right.from);
      if (fromCompare !== 0) return fromCompare;
      return left.to.localeCompare(right.to);
    });
  }

  const structuralEdges = projection.edges
    .filter((edge) => hierarchyTypeSet.has(edge.type) && visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to))
    .map((edge) => {
      if (occurrencePolicyEnabled && !edge.source_edge_id) {
        throw new Error(`IA structural occurrence ${edge.from} ${edge.type} ${edge.to} has no exact source_edge_id.`);
      }
      if (occurrencePolicyEnabled) resolveProjectionEdge(edge, graph, Boolean(projection.diagram_id));
      return {
        from: edge.from,
        to: edge.to,
        type: edge.type,
        ...(edge.source_edge_id ? { source_edge_id: edge.source_edge_id } : {})
      };
    });

  return {
    rootItems,
    edges,
    structuralEdges,
    occurrencePolicyEnabled,
    siblingOrderChains: collectSiblingOrderChains(rootItems)
  };
}
