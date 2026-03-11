import type { Bundle, ViewSpec } from "../bundle/types.js";
import type { CompiledEdge, CompiledGraph } from "../compiler/types.js";
import type { ProjectionNodeAnnotation, ProjectionOmission, ProjectionResult } from "./types.js";
import {
  buildProjectionResult,
  createDerivedAnnotationOmission,
  createEmptyDerived,
  createEndpointOutOfScopeOmission,
  createProjectionBuilderContext
} from "./shared.js";

interface InstrumentationConfig {
  sourceEdgeType?: string;
  groupOrder: string[];
  experienceTargetTypes: string[];
  eventTargetTypes: string[];
  targetTypeOrder: string[];
  includeTargetId: boolean;
  includeTargetNameWhenAvailable: boolean;
}

function readInstrumentationConfig(view: ViewSpec): InstrumentationConfig {
  const defaults = (view.conventions.renderer_defaults?.instrumentation_annotations ?? {}) as Record<string, unknown>;
  const display = (defaults.display ?? {}) as Record<string, unknown>;

  return {
    sourceEdgeType: typeof defaults.source_edge_type === "string" ? defaults.source_edge_type : undefined,
    groupOrder: Array.isArray(defaults.group_order)
      ? defaults.group_order.filter((value): value is string => typeof value === "string")
      : [],
    experienceTargetTypes: Array.isArray(defaults.experience_target_types)
      ? defaults.experience_target_types.filter((value): value is string => typeof value === "string")
      : [],
    eventTargetTypes: Array.isArray(defaults.event_target_types)
      ? defaults.event_target_types.filter((value): value is string => typeof value === "string")
      : [],
    targetTypeOrder: Array.isArray(defaults.target_type_order)
      ? defaults.target_type_order.filter((value): value is string => typeof value === "string")
      : [],
    includeTargetId: display.include_target_id !== false,
    includeTargetNameWhenAvailable: display.include_target_name_when_available !== false
  };
}

function instrumentationGroupForTarget(targetType: string | undefined, config: InstrumentationConfig): string | undefined {
  if (!targetType) {
    return undefined;
  }
  if (config.experienceTargetTypes.includes(targetType)) {
    return "experience";
  }
  if (config.eventTargetTypes.includes(targetType)) {
    return "event";
  }
  return undefined;
}

function sortInstrumentationReferences(
  references: NonNullable<ProjectionNodeAnnotation["references"]>,
  config: InstrumentationConfig
): NonNullable<ProjectionNodeAnnotation["references"]> {
  const groupOrder = new Map(config.groupOrder.map((group, index) => [group, index]));
  const targetTypeOrder = new Map(config.targetTypeOrder.map((targetType, index) => [targetType, index]));

  return [...references].sort((left, right) => {
    const leftGroupRank = groupOrder.get(left.group ?? "") ?? Number.MAX_SAFE_INTEGER;
    const rightGroupRank = groupOrder.get(right.group ?? "") ?? Number.MAX_SAFE_INTEGER;
    if (leftGroupRank !== rightGroupRank) {
      return leftGroupRank - rightGroupRank;
    }

    const leftTypeRank = targetTypeOrder.get(left.target_type ?? "") ?? Number.MAX_SAFE_INTEGER;
    const rightTypeRank = targetTypeOrder.get(right.target_type ?? "") ?? Number.MAX_SAFE_INTEGER;
    if (leftTypeRank !== rightTypeRank) {
      return leftTypeRank - rightTypeRank;
    }

    return left.target_id.localeCompare(right.target_id);
  });
}

function buildInstrumentationOmission(edge: Pick<CompiledEdge, "from" | "type" | "to">, group: string, targetType: string): ProjectionOmission {
  return createDerivedAnnotationOmission(
    edge,
    `Rendered as an ${group}-group metric annotation because the target node type ${targetType} is outside the view node scope.`
  );
}

export function buildOutcomeOpportunityMapProjection(
  graph: CompiledGraph,
  bundle: Bundle,
  view: ViewSpec
): ProjectionResult {
  const context = createProjectionBuilderContext(graph, bundle, view);
  const config = readInstrumentationConfig(view);
  const referencesByNodeId = new Map<string, NonNullable<ProjectionNodeAnnotation["references"]>>();
  const omissions: ProjectionOmission[] = [];

  for (const edge of graph.edges) {
    if (!context.projectedNodeIds.has(edge.from) || context.projectedNodeIds.has(edge.to)) {
      continue;
    }

    const targetNode = context.graphNodesById.get(edge.to);
    if (edge.type === config.sourceEdgeType) {
      const group = instrumentationGroupForTarget(targetNode?.type, config);
      if (group) {
        const references = referencesByNodeId.get(edge.from) ?? [];
        references.push({
          role: "instrumented_at",
          group,
          target_id: config.includeTargetId ? edge.to : "",
          target_type: targetNode?.type,
          target_name: config.includeTargetNameWhenAvailable ? targetNode?.name : undefined
        });
        referencesByNodeId.set(edge.from, references);
        omissions.push(buildInstrumentationOmission(edge, group, targetNode?.type ?? "unknown"));
        continue;
      }
    }

    if (context.includedEdgeTypes.has(edge.type)) {
      omissions.push(createEndpointOutOfScopeOmission(edge, targetNode, view.id));
    }
  }

  const nodeAnnotations: ProjectionNodeAnnotation[] = [...referencesByNodeId.entries()]
    .map(([nodeId, references]) => ({
      node_id: nodeId,
      references: sortInstrumentationReferences(
        references.filter((reference) => reference.target_id.length > 0),
        config
      )
    }))
    .filter((annotation) => annotation.references && annotation.references.length > 0);

  return buildProjectionResult(context, {
    derived: {
      ...createEmptyDerived(),
      node_annotations: nodeAnnotations
    },
    omissions
  });
}
