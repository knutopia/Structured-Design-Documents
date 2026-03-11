import type { Bundle, ViewSpec } from "../bundle/types.js";
import type { CompiledGraph } from "../compiler/types.js";
import type { ProjectionNodeGroup, ProjectionOmission, ProjectionResult } from "./types.js";
import {
  buildProjectionResult,
  createEmptyDerived,
  createEndpointOutOfScopeOmission,
  createProjectionBuilderContext,
  createRelationshipNotInScopeOmission
} from "./shared.js";

interface TransitionGraphPriorityConfig {
  primary?: string;
  secondary?: string;
  secondaryRenderMode?: string;
  fallbackToSecondaryWhenPrimaryAbsent: boolean;
}

function readTransitionGraphPriorityConfig(view: ViewSpec): TransitionGraphPriorityConfig {
  const defaults = (view.conventions.renderer_defaults?.transition_graph_priority ?? {}) as Record<string, unknown>;

  return {
    primary: typeof defaults.primary === "string" ? defaults.primary : undefined,
    secondary: typeof defaults.secondary === "string" ? defaults.secondary : undefined,
    secondaryRenderMode: typeof defaults.secondary_render_mode === "string" ? defaults.secondary_render_mode : undefined,
    fallbackToSecondaryWhenPrimaryAbsent: defaults.fallback_to_secondary_when_primary_absent === true
  };
}

function buildSecondaryStateGroups(
  graph: CompiledGraph,
  projectedNodeIds: Set<string>,
  secondaryType: string | undefined
): ProjectionNodeGroup[] {
  if (!secondaryType) {
    return [];
  }

  const nodeIdsByScopeId = new Map<string, string[]>();
  for (const node of graph.nodes) {
    if (!projectedNodeIds.has(node.id) || node.type !== secondaryType) {
      continue;
    }

    const scopeId = node.props.scope_id;
    if (!scopeId) {
      continue;
    }

    const nodeIds = nodeIdsByScopeId.get(scopeId) ?? [];
    nodeIds.push(node.id);
    nodeIdsByScopeId.set(scopeId, nodeIds);
  }

  return [...nodeIdsByScopeId.entries()].map(([scopeId, nodeIds]) => ({
    id: `secondary_state_group:${scopeId}`,
    role: "secondary_state_group",
    label: scopeId,
    node_ids: [...nodeIds].sort((left, right) => left.localeCompare(right)),
    scope_id: scopeId
  }));
}

function buildOmissions(
  graph: CompiledGraph,
  projectedNodeIds: Set<string>,
  graphNodesById: Map<string, { type: string }>,
  includedEdgeTypes: Set<string>,
  viewId: string
): ProjectionOmission[] {
  const omissions: ProjectionOmission[] = [];
  for (const edge of graph.edges) {
    if (!projectedNodeIds.has(edge.from)) {
      continue;
    }

    if (projectedNodeIds.has(edge.to)) {
      if (!includedEdgeTypes.has(edge.type)) {
        omissions.push(createRelationshipNotInScopeOmission(edge, viewId));
      }
      continue;
    }

    omissions.push(createEndpointOutOfScopeOmission(edge, graphNodesById.get(edge.to), viewId));
  }

  return omissions;
}

export function buildUiContractsProjection(graph: CompiledGraph, bundle: Bundle, view: ViewSpec): ProjectionResult {
  const context = createProjectionBuilderContext(graph, bundle, view);
  const config = readTransitionGraphPriorityConfig(view);
  const nodeGroups = buildSecondaryStateGroups(graph, context.projectedNodeIds, config.secondary);
  const notes: string[] = [];

  if (
    config.primary &&
    config.secondary &&
    config.fallbackToSecondaryWhenPrimaryAbsent &&
    !context.projectedNodes.some((node) => node.type === config.primary) &&
    context.projectedNodes.some((node) => node.type === config.secondary)
  ) {
    notes.push("No ViewState nodes are present in this example; State acts as the effective primary transition graph.");
  }

  return buildProjectionResult(context, {
    derived: {
      ...createEmptyDerived(),
      node_groups: nodeGroups,
      view_metadata: {
        transition_graph_priority: {
          primary_node_type: config.primary,
          secondary_node_type: config.secondary,
          secondary_render_mode: config.secondaryRenderMode,
          fallback_to_secondary_when_primary_absent: config.fallbackToSecondaryWhenPrimaryAbsent
        }
      }
    },
    omissions: buildOmissions(
      graph,
      context.projectedNodeIds,
      context.graphNodesById,
      context.includedEdgeTypes,
      view.id
    ),
    notes
  });
}
