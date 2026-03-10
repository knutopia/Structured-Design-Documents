import { attachGraphAuthorOrder, getGraphAuthorOrder, type CompiledEdge, type CompiledGraph, type CompiledNode } from "./types.js";

function sortProps<T extends Record<string, string>>(props: T): T {
  const sorted = Object.fromEntries(Object.entries(props).sort(([left], [right]) => left.localeCompare(right)));
  return sorted as T;
}

function propsStableString(props: Record<string, string>): string {
  return JSON.stringify(sortProps(props));
}

function compareNullableString(left: string | null, right: string | null): number {
  return (left ?? "").localeCompare(right ?? "");
}

export function canonicalizeNode(node: CompiledNode): CompiledNode {
  return {
    ...node,
    props: sortProps(node.props)
  };
}

export function canonicalizeEdge(edge: CompiledEdge): CompiledEdge {
  return {
    ...edge,
    props: sortProps(edge.props)
  };
}

export function canonicalizeGraph(graph: CompiledGraph): CompiledGraph {
  const nodes = graph.nodes.map(canonicalizeNode).sort((left, right) => left.id.localeCompare(right.id));
  const edges = graph.edges
    .map(canonicalizeEdge)
    .sort((left, right) => {
      const fromCompare = left.from.localeCompare(right.from);
      if (fromCompare !== 0) {
        return fromCompare;
      }
      const typeCompare = left.type.localeCompare(right.type);
      if (typeCompare !== 0) {
        return typeCompare;
      }
      const toCompare = left.to.localeCompare(right.to);
      if (toCompare !== 0) {
        return toCompare;
      }
      const eventCompare = compareNullableString(left.event, right.event);
      if (eventCompare !== 0) {
        return eventCompare;
      }
      const guardCompare = compareNullableString(left.guard, right.guard);
      if (guardCompare !== 0) {
        return guardCompare;
      }
      const effectCompare = compareNullableString(left.effect, right.effect);
      if (effectCompare !== 0) {
        return effectCompare;
      }
      return propsStableString(left.props).localeCompare(propsStableString(right.props));
    });

  const canonicalGraph: CompiledGraph = {
    ...graph,
    nodes,
    edges
  };
  const authorOrder = getGraphAuthorOrder(graph);
  if (authorOrder) {
    attachGraphAuthorOrder(canonicalGraph, authorOrder);
  }

  return canonicalGraph;
}
