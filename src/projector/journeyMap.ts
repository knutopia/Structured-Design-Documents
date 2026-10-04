import { resolveHierarchyRoles } from "../bundle/viewRoles.js";
import type { Bundle, ViewSpec } from "../bundle/types.js";
import type { CompiledGraph } from "../compiler/types.js";
import type { ProjectionNodeAnnotation, ProjectionResult } from "./types.js";
import {
  type ProjectionBuilderOptions,
  buildProjectionResult,
  createEmptyDerived,
  createProjectionBuilderContext
} from "./shared.js";

function splitReferenceIds(value: string | undefined, sort: unknown): string[] {
  if (!value) {
    return [];
  }

  const referenceIds = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return sort === "id_ascending"
    ? referenceIds.sort((left, right) => left.localeCompare(right))
    : referenceIds;
}

function referenceRole(sourceProp: string): string {
  return sourceProp.endsWith("_refs") ? `${sourceProp.slice(0, -1)}` : `${sourceProp}_ref`;
}

function buildReferenceAnnotations(
  graph: CompiledGraph,
  bundle: Bundle,
  view: ViewSpec,
  graphNodesById: Map<string, { id: string; type: string; name: string; props: Record<string, string> }>,
  projectedNodeIds: Set<string>
): ProjectionNodeAnnotation[] {
  const defaults = (view.conventions.renderer_defaults?.reference_annotations ?? {}) as Record<string, unknown>;
  const sourceProp = typeof defaults.source_prop === "string" ? defaults.source_prop : undefined;
  const targetType = typeof defaults.target_type === "string" ? defaults.target_type : undefined;
  const sort = defaults.sort;
  if (!sourceProp || !targetType) {
    return [];
  }

  const role = referenceRole(sourceProp);
  const roles = resolveHierarchyRoles(bundle, view);
  const annotations: ProjectionNodeAnnotation[] = [];
  for (const node of graph.nodes) {
    if (!roles.childTypes.has(node.type) || !projectedNodeIds.has(node.id)) {
      continue;
    }

    const references: NonNullable<ProjectionNodeAnnotation["references"]> = [];
    for (const targetId of splitReferenceIds(node.props[sourceProp], sort)) {
      const targetNode = graphNodesById.get(targetId);
      if (!targetNode || targetNode.type !== targetType) {
        continue;
      }

      references.push({
        role,
        target_id: targetNode.id,
        target_type: targetNode.type,
        target_name: targetNode.name,
        source_prop: sourceProp
      });
    }

    if (references.length === 0) {
      continue;
    }

    annotations.push({
      node_id: node.id,
      references
    });
  }

  return annotations;
}

export function buildJourneyMapProjection(graph: CompiledGraph, bundle: Bundle, view: ViewSpec, options?: ProjectionBuilderOptions): ProjectionResult {
  const context = createProjectionBuilderContext(graph, bundle, view, options);
  const nodeAnnotations = buildReferenceAnnotations(graph, bundle, view, context.graphNodesById, context.projectedNodeIds);
  const roles = resolveHierarchyRoles(bundle, view);
  const stepName = [...roles.childTypes][0];
  const notes: string[] = [];
  const referenceSourceProp = (view.conventions.renderer_defaults?.reference_annotations as Record<string, unknown> | undefined)?.source_prop;

  if (nodeAnnotations.length > 0 && typeof referenceSourceProp === "string") {
    notes.push(`Opportunity references are rendered as step annotations driven by ${stepName}.props.${referenceSourceProp}.`);
  }
  if (!context.projectedNodes.some((node) => roles.parentTypes.has(node.type))) {
    notes.push(`No Stage nodes are present in this example; journey projection remains valid with ${stepName}-only sequence.`);
  }

  return buildProjectionResult(context, {
    derived: {
      ...createEmptyDerived(),
      node_annotations: nodeAnnotations
    },
    notes
  });
}
