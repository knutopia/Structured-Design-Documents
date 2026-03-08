import type { CompiledGraph } from "../compiler/types.js";
import type { Projection } from "../projector/types.js";

export interface IaRenderArea {
  id: string;
  label: string;
  placeIds: string[];
}

export interface IaRenderPlace {
  id: string;
  labelLines: string[];
}

export interface IaRenderEdge {
  from: string;
  to: string;
}

export interface IaPlaceMapRenderModel {
  areas: IaRenderArea[];
  topLevelPlaces: IaRenderPlace[];
  placesById: Map<string, IaRenderPlace>;
  edges: IaRenderEdge[];
}

export function buildIaPlaceMapRenderModel(projection: Projection, graph: CompiledGraph): IaPlaceMapRenderModel {
  const graphNodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const annotationsByNodeId = new Map(
    projection.derived.node_annotations.map((annotation) => [annotation.node_id, annotation])
  );
  const placesById = new Map<string, IaRenderPlace>();
  const parentAreaByPlaceId = new Map<string, string>();
  const areas: IaRenderArea[] = [];

  for (const edge of projection.edges.filter((candidate) => candidate.type === "CONTAINS")) {
    const parentNode = projection.nodes.find((node) => node.id === edge.from);
    const childNode = projection.nodes.find((node) => node.id === edge.to);
    if (parentNode?.type === "Area" && childNode?.type === "Place") {
      parentAreaByPlaceId.set(childNode.id, parentNode.id);
    }
  }

  for (const node of projection.nodes.filter((candidate) => candidate.type === "Place")) {
    const graphNode = graphNodesById.get(node.id);
    const annotation = annotationsByNodeId.get(node.id);
    const labelLines = [node.name];
    const display = annotation?.display;
    if (display?.subtitle) {
      labelLines.push(display.subtitle);
    } else if (graphNode?.props.route_or_key) {
      labelLines.push(graphNode.props.route_or_key);
    }
    if (display?.badge) {
      labelLines.push(`[${display.badge}]`);
    } else if (graphNode?.props.access) {
      labelLines.push(`[${graphNode.props.access}]`);
    }
    for (const metadata of display?.metadata ?? []) {
      labelLines.push(`${metadata.key}: ${metadata.value}`);
    }
    placesById.set(node.id, {
      id: node.id,
      labelLines
    });
  }

  for (const node of projection.nodes.filter((candidate) => candidate.type === "Area")) {
    const placeIds = [...parentAreaByPlaceId.entries()]
      .filter(([, parentAreaId]) => parentAreaId === node.id)
      .map(([placeId]) => placeId)
      .sort();
    areas.push({
      id: node.id,
      label: node.name,
      placeIds
    });
  }

  areas.sort((left, right) => left.id.localeCompare(right.id));

  const topLevelPlaces = [...placesById.values()]
    .filter((place) => !parentAreaByPlaceId.has(place.id))
    .sort((left, right) => left.id.localeCompare(right.id));

  const edges = projection.edges
    .filter((edge) => edge.type === "NAVIGATES_TO")
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
    areas,
    topLevelPlaces,
    placesById,
    edges
  };
}

