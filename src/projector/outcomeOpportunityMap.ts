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

interface ImplementationConfig {
  sourceEdgeType?: string;
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

function readImplementationConfig(view: ViewSpec): ImplementationConfig {
  const defaults = (view.conventions.renderer_defaults?.implementation_annotations ?? {}) as Record<string, unknown>;
  const display = (defaults.display ?? {}) as Record<string, unknown>;

  return {
    sourceEdgeType: typeof defaults.source_edge_type === "string" ? defaults.source_edge_type : undefined,
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

function sortOutcomeOpportunityReferences(
  references: NonNullable<ProjectionNodeAnnotation["references"]>,
  instrumentationConfig: InstrumentationConfig,
  implementationConfig: ImplementationConfig
): NonNullable<ProjectionNodeAnnotation["references"]> {
  const instrumentationGroupOrder = new Map(instrumentationConfig.groupOrder.map((group, index) => [group, index]));
  const instrumentationTargetTypeOrder = new Map(instrumentationConfig.targetTypeOrder.map((targetType, index) => [targetType, index]));
  const implementationTargetTypeOrder = new Map(implementationConfig.targetTypeOrder.map((targetType, index) => [targetType, index]));
  const roleOrder = new Map([
    ["implemented_by", 0],
    ["instrumented_at", 1]
  ]);

  return [...references].sort((left, right) => {
    const leftRoleRank = roleOrder.get(left.role) ?? Number.MAX_SAFE_INTEGER;
    const rightRoleRank = roleOrder.get(right.role) ?? Number.MAX_SAFE_INTEGER;
    if (leftRoleRank !== rightRoleRank) {
      return leftRoleRank - rightRoleRank;
    }

    const leftGroupRank = instrumentationGroupOrder.get(left.group ?? "") ?? Number.MAX_SAFE_INTEGER;
    const rightGroupRank = instrumentationGroupOrder.get(right.group ?? "") ?? Number.MAX_SAFE_INTEGER;
    if (leftGroupRank !== rightGroupRank) {
      return leftGroupRank - rightGroupRank;
    }

    const targetTypeOrder = left.role === "implemented_by"
      ? implementationTargetTypeOrder
      : instrumentationTargetTypeOrder;
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

function buildImplementationOmission(edge: Pick<CompiledEdge, "from" | "type" | "to">, targetType: string): ProjectionOmission {
  return createDerivedAnnotationOmission(
    edge,
    `Rendered as an implementation annotation because the target node type ${targetType} is outside the view node scope.`
  );
}

export function buildOutcomeOpportunityMapProjection(
  graph: CompiledGraph,
  bundle: Bundle,
  view: ViewSpec
): ProjectionResult {
  const context = createProjectionBuilderContext(graph, bundle, view);
  const instrumentationConfig = readInstrumentationConfig(view);
  const implementationConfig = readImplementationConfig(view);
  const referencesByNodeId = new Map<string, NonNullable<ProjectionNodeAnnotation["references"]>>();
  const omissions: ProjectionOmission[] = [];

  for (const edge of graph.edges) {
    if (!context.projectedNodeIds.has(edge.from) || context.projectedNodeIds.has(edge.to)) {
      continue;
    }

    const targetNode = context.graphNodesById.get(edge.to);
    if (edge.type === instrumentationConfig.sourceEdgeType) {
      const group = instrumentationGroupForTarget(targetNode?.type, instrumentationConfig);
      if (group) {
        const references = referencesByNodeId.get(edge.from) ?? [];
        references.push({
          role: "instrumented_at",
          group,
          target_id: instrumentationConfig.includeTargetId ? edge.to : "",
          target_type: targetNode?.type,
          target_name: instrumentationConfig.includeTargetNameWhenAvailable ? targetNode?.name : undefined
        });
        referencesByNodeId.set(edge.from, references);
        omissions.push(buildInstrumentationOmission(edge, group, targetNode?.type ?? "unknown"));
        continue;
      }
    }

    if (
      edge.type === implementationConfig.sourceEdgeType &&
      targetNode?.type &&
      implementationConfig.targetTypeOrder.includes(targetNode.type)
    ) {
      const references = referencesByNodeId.get(edge.from) ?? [];
      references.push({
        role: "implemented_by",
        target_id: implementationConfig.includeTargetId ? edge.to : "",
        target_type: targetNode.type,
        target_name: implementationConfig.includeTargetNameWhenAvailable ? targetNode.name : undefined
      });
      referencesByNodeId.set(edge.from, references);
      omissions.push(buildImplementationOmission(edge, targetNode.type));
      continue;
    }

    if (context.includedEdgeTypes.has(edge.type)) {
      omissions.push(createEndpointOutOfScopeOmission(edge, targetNode, view.id));
    }
  }

  const nodeAnnotations: ProjectionNodeAnnotation[] = [...referencesByNodeId.entries()]
    .map(([nodeId, references]) => ({
      node_id: nodeId,
      references: sortOutcomeOpportunityReferences(
        references.filter((reference) => reference.target_id.length > 0),
        instrumentationConfig,
        implementationConfig
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
