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

interface LaneMappingConfig {
  laneOrder: string[];
  aliases: Record<string, string>;
  nodeTypeDefaults: Record<string, string>;
}

function readLaneMappingConfig(view: ViewSpec): LaneMappingConfig {
  const defaults = (view.conventions.renderer_defaults?.lane_mapping ?? {}) as Record<string, unknown>;
  const aliases = (defaults.aliases ?? {}) as Record<string, unknown>;
  const nodeTypeDefaults = (defaults.node_type_defaults ?? {}) as Record<string, unknown>;

  return {
    laneOrder: Array.isArray(defaults.lane_order)
      ? defaults.lane_order.filter((value): value is string => typeof value === "string")
      : [],
    aliases: Object.fromEntries(
      Object.entries(aliases).filter((entry): entry is [string, string] => typeof entry[1] === "string")
    ),
    nodeTypeDefaults: Object.fromEntries(
      Object.entries(nodeTypeDefaults).filter((entry): entry is [string, string] => typeof entry[1] === "string")
    )
  };
}

function resolveLaneId(node: { type: string; props: Record<string, string> }, config: LaneMappingConfig): string | undefined {
  const rule = config.nodeTypeDefaults[node.type];
  if (!rule) {
    return undefined;
  }
  if (rule !== "by_visibility") {
    return rule;
  }

  const visibility = node.props.visibility;
  if (!visibility) {
    return undefined;
  }

  return config.aliases[visibility] ?? visibility;
}

function buildLaneGroups(
  graph: CompiledGraph,
  projectedNodeIds: Set<string>,
  config: LaneMappingConfig
): ProjectionNodeGroup[] {
  const nodeIdsByLaneId = new Map<string, string[]>();

  for (const node of graph.nodes) {
    if (!projectedNodeIds.has(node.id)) {
      continue;
    }

    const laneId = resolveLaneId(node, config);
    if (!laneId) {
      continue;
    }

    const nodeIds = nodeIdsByLaneId.get(laneId) ?? [];
    nodeIds.push(node.id);
    nodeIdsByLaneId.set(laneId, nodeIds);
  }

  return config.laneOrder
    .map((laneId, index) => {
      const nodeIds = nodeIdsByLaneId.get(laneId);
      if (!nodeIds || nodeIds.length === 0) {
        return undefined;
      }

      return {
        id: `lane:${String(index + 1).padStart(2, "0")}:${laneId}`,
        role: "lane",
        label: laneId,
        node_ids: [...nodeIds].sort((left, right) => left.localeCompare(right))
      } satisfies ProjectionNodeGroup;
    })
    .filter((group): group is ProjectionNodeGroup => group !== undefined);
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

export function buildServiceBlueprintProjection(graph: CompiledGraph, bundle: Bundle, view: ViewSpec): ProjectionResult {
  const context = createProjectionBuilderContext(graph, bundle, view);
  const config = readLaneMappingConfig(view);

  return buildProjectionResult(context, {
    derived: {
      ...createEmptyDerived(),
      node_groups: buildLaneGroups(graph, context.projectedNodeIds, config)
    },
    omissions: buildOmissions(
      graph,
      context.projectedNodeIds,
      context.graphNodesById,
      context.includedEdgeTypes,
      view.id
    )
  });
}
