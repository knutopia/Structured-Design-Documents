import type { Bundle, ViewSpec } from "../bundle/types.js";
import type { CompiledGraph } from "../compiler/types.js";
import type { ProjectionNodeAnnotation, ProjectionResult } from "./types.js";
import {
  buildProjectionResult,
  createEmptyDerived,
  createProjectionBuilderContext
} from "./shared.js";

function splitReferenceIds(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .sort((left, right) => left.localeCompare(right));
}

function referenceRole(sourceProp: string): string {
  return sourceProp.endsWith("_refs") ? `${sourceProp.slice(0, -1)}` : `${sourceProp}_ref`;
}

function buildReferenceAnnotations(
  graph: CompiledGraph,
  view: ViewSpec,
  graphNodesById: Map<string, { id: string; type: string; name: string; props: Record<string, string> }>,
  projectedNodeIds: Set<string>
): ProjectionNodeAnnotation[] {
  const defaults = (view.conventions.renderer_defaults?.reference_annotations ?? {}) as Record<string, unknown>;
  const sourceProp = typeof defaults.source_prop === "string" ? defaults.source_prop : undefined;
  const targetType = typeof defaults.target_type === "string" ? defaults.target_type : undefined;
  if (!sourceProp || !targetType) {
    return [];
  }

  const role = referenceRole(sourceProp);
  const annotations: ProjectionNodeAnnotation[] = [];
  for (const node of graph.nodes) {
    if (node.type !== "Step" || !projectedNodeIds.has(node.id)) {
      continue;
    }

    const references: NonNullable<ProjectionNodeAnnotation["references"]> = [];
    for (const targetId of splitReferenceIds(node.props[sourceProp])) {
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

export function buildJourneyMapProjection(graph: CompiledGraph, bundle: Bundle, view: ViewSpec): ProjectionResult {
  const context = createProjectionBuilderContext(graph, bundle, view);
  const nodeAnnotations = buildReferenceAnnotations(graph, view, context.graphNodesById, context.projectedNodeIds);
  const notes: string[] = [];
  const referenceSourceProp = (view.conventions.renderer_defaults?.reference_annotations as Record<string, unknown> | undefined)?.source_prop;

  if (nodeAnnotations.length > 0 && typeof referenceSourceProp === "string") {
    notes.push(`Opportunity references are rendered as step annotations driven by Step.props.${referenceSourceProp}.`);
  }
  if (!context.projectedNodes.some((node) => node.type === "Stage")) {
    notes.push("No Stage nodes are present in this example; journey projection remains valid with Step-only sequence.");
  }

  return buildProjectionResult(context, {
    derived: {
      ...createEmptyDerived(),
      node_annotations: nodeAnnotations
    },
    notes
  });
}
