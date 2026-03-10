import { getGraphAuthorOrder, type AuthorOrderedEdge, type CompiledGraph } from "./types.js";

function filterOrderedIds(candidateIds: Iterable<string>, preferredIds: Iterable<string>, fallbackIds: Iterable<string>): string[] {
  const remaining = new Set(candidateIds);
  const ordered: string[] = [];

  for (const id of preferredIds) {
    if (remaining.delete(id)) {
      ordered.push(id);
    }
  }

  for (const id of fallbackIds) {
    if (remaining.delete(id)) {
      ordered.push(id);
    }
  }

  return ordered;
}

export function getTopLevelNodeIdsInAuthorOrder(graph: CompiledGraph, candidateIds: Iterable<string>): string[] {
  const authorOrder = getGraphAuthorOrder(graph);
  return filterOrderedIds(
    candidateIds,
    authorOrder?.topLevelNodeIds ?? [],
    graph.nodes.map((node) => node.id)
  );
}

export function getSourceOrderedStructuralStream(
  graph: CompiledGraph,
  parentId: string,
  hierarchyEdgeTypes: Iterable<string>,
  candidateIds?: Iterable<string>
): AuthorOrderedEdge[] {
  const hierarchyTypeSet = new Set(hierarchyEdgeTypes);
  const candidateIdSet = candidateIds ? new Set(candidateIds) : undefined;
  const authorOrder = getGraphAuthorOrder(graph);
  const fallbackEdges = graph.edges
    .filter((edge) => edge.from === parentId && hierarchyTypeSet.has(edge.type))
    .map<AuthorOrderedEdge>((edge) => ({
      type: edge.type,
      to: edge.to
    }));
  const orderedEdges = authorOrder?.edgeLineOrderByParentId.get(parentId) ?? fallbackEdges;

  return orderedEdges.filter((edge) => hierarchyTypeSet.has(edge.type) && (!candidateIdSet || candidateIdSet.has(edge.to)));
}

export function getSourceOrderedChildrenForRelationship(
  graph: CompiledGraph,
  parentId: string,
  relationshipType: string,
  candidateIds?: Iterable<string>
): string[] {
  return getSourceOrderedStructuralStream(graph, parentId, [relationshipType], candidateIds)
    .filter((edge) => edge.type === relationshipType)
    .map((edge) => edge.to);
}
