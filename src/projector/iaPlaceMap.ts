import type { Bundle, ViewSpec } from "../bundle/types.js";
import type { CompiledGraph } from "../compiler/types.js";
import type {
  ProjectionNode,
  ProjectionNodeAnnotation,
  ProjectionResult
} from "./types.js";
import {
  buildProjectionResult,
  createEmptyDerived,
  createEndpointOutOfScopeOmission,
  createProjectionBuilderContext,
  createRelationshipNotInScopeOmission
} from "./shared.js";

type NodeAnnotationDisplay = NonNullable<ProjectionNodeAnnotation["display"]>;

function buildNodeAnnotations(graph: CompiledGraph, nodes: ProjectionNode[], view: ViewSpec): ProjectionNodeAnnotation[] {
  const defaults = (view.conventions.renderer_defaults?.node_annotations ?? {}) as Record<string, unknown>;
  const subtitleProp = typeof defaults.subtitle_prop === "string" ? defaults.subtitle_prop : undefined;
  const badgeProp = typeof defaults.badge_prop === "string" ? defaults.badge_prop : undefined;
  const metadataProps = Array.isArray(defaults.metadata_props)
    ? defaults.metadata_props.filter((value): value is string => typeof value === "string")
    : [];
  const graphNodesById = new Map(graph.nodes.map((node) => [node.id, node]));

  const annotations: ProjectionNodeAnnotation[] = [];
  for (const node of nodes.filter((candidate) => candidate.type === "Place")) {
    const sourceNode = graphNodesById.get(node.id);
    if (!sourceNode) {
      continue;
    }
    const subtitle = subtitleProp ? sourceNode.props[subtitleProp] : undefined;
    const badge = badgeProp ? sourceNode.props[badgeProp] : undefined;
    const metadata = metadataProps
      .map((property) => {
        const value = sourceNode.props[property];
        return value ? { key: property, value } : undefined;
      })
      .filter((entry): entry is { key: string; value: string } => entry !== undefined);

    if (!subtitle && !badge && metadata.length === 0) {
      continue;
    }

    const display: NodeAnnotationDisplay = {};
    if (subtitle) {
      display.subtitle = subtitle;
    }
    if (badge) {
      display.badge = badge;
    }
    display.metadata = metadata;

    annotations.push({
      node_id: node.id,
      display
    });
  }

  return annotations.sort((left, right) => left.node_id.localeCompare(right.node_id));
}

export function buildIaPlaceMapProjection(graph: CompiledGraph, bundle: Bundle, view: ViewSpec): ProjectionResult {
  const context = createProjectionBuilderContext(graph, bundle, view);
  const nodeAnnotations = buildNodeAnnotations(graph, context.projectedNodes, view);
  const omissions = [];

  for (const edge of graph.edges) {
    if (!context.projectedNodeIds.has(edge.from)) {
      continue;
    }
    const targetNode = context.graphNodesById.get(edge.to);
    if (!context.includedEdgeTypes.has(edge.type)) {
      omissions.push(createRelationshipNotInScopeOmission(edge, view.id));
      continue;
    }
    if (!context.projectedNodeIds.has(edge.to)) {
      omissions.push(createEndpointOutOfScopeOmission(edge, targetNode, view.id));
    }
  }

  return buildProjectionResult(context, {
    derived: {
      ...createEmptyDerived(),
      node_annotations: nodeAnnotations
    },
    omissions,
    notes:
      nodeAnnotations.length > 0
        ? ["Place route, access, and entry metadata are rendered as node annotations."]
        : ["Hierarchy for IA view is driven by CONTAINS."]
  });
}
