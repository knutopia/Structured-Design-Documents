import type { Bundle, ViewSpec } from "../bundle/types.js";
import type { CompiledGraph } from "../compiler/types.js";
import type { ProjectionEdgeAnnotation, ProjectionNodeAnnotation, ProjectionOmission, ProjectionResult } from "./types.js";
import {
  buildProjectionResult,
  createEmptyDerived,
  createProjectionBuilderContext,
  createRelationshipNotInScopeOmission
} from "./shared.js";

interface DecisionNodeConfig {
  kindProp?: string;
  decisionValue?: string;
  branchLabelPrecedence: string[];
  renderShape?: string;
}

function readDecisionNodeConfig(view: ViewSpec): DecisionNodeConfig {
  const defaults = (view.conventions.renderer_defaults?.decision_nodes ?? {}) as Record<string, unknown>;

  return {
    kindProp: typeof defaults.kind_prop === "string" ? defaults.kind_prop : undefined,
    decisionValue: typeof defaults.decision_value === "string" ? defaults.decision_value : undefined,
    branchLabelPrecedence: Array.isArray(defaults.branch_label_precedence)
      ? defaults.branch_label_precedence.filter((value): value is string => typeof value === "string")
      : [],
    renderShape: typeof defaults.render_shape === "string" ? defaults.render_shape : undefined
  };
}

function buildDecisionNodeAnnotations(
  graph: CompiledGraph,
  projectedNodeIds: Set<string>,
  config: DecisionNodeConfig
): ProjectionNodeAnnotation[] {
  if (!config.kindProp || !config.decisionValue || !config.renderShape) {
    return [];
  }

  return graph.nodes
    .filter((node) => projectedNodeIds.has(node.id) && node.props[config.kindProp!] === config.decisionValue)
    .map((node) => ({
      node_id: node.id,
      display: {
        shape: config.renderShape
      }
    }));
}

function branchLabel(edge: { guard: string | null; event: string | null; to_name: string | null }, config: DecisionNodeConfig): {
  displayLabel?: string;
  labelSource?: string;
} {
  for (const source of config.branchLabelPrecedence) {
    if (source === "guard" && edge.guard) {
      return {
        displayLabel: edge.guard,
        labelSource: "guard"
      };
    }
    if (source === "event" && edge.event) {
      return {
        displayLabel: edge.event,
        labelSource: "event"
      };
    }
    if (source === "to_name" && edge.to_name) {
      return {
        displayLabel: edge.to_name,
        labelSource: "to_name"
      };
    }
  }

  return {};
}

function buildBranchLabelAnnotations(
  graph: CompiledGraph,
  decisionNodeIds: Set<string>,
  projectedNodeIds: Set<string>,
  orderingEdgeTypes: Set<string>,
  config: DecisionNodeConfig
): ProjectionEdgeAnnotation[] {
  return graph.edges
    .filter(
      (edge) =>
        decisionNodeIds.has(edge.from) &&
        orderingEdgeTypes.has(edge.type) &&
        projectedNodeIds.has(edge.from) &&
        projectedNodeIds.has(edge.to)
    )
    .map((edge) => {
      const label = branchLabel(edge, config);
      if (!label.displayLabel || !label.labelSource) {
        return undefined;
      }

      return {
        from: edge.from,
        type: edge.type,
        to: edge.to,
        role: "branch_label",
        display_label: label.displayLabel,
        label_source: label.labelSource
      } satisfies ProjectionEdgeAnnotation;
    })
    .filter((annotation): annotation is ProjectionEdgeAnnotation => annotation !== undefined);
}

function buildOmissions(
  graph: CompiledGraph,
  projectedNodeIds: Set<string>,
  includedEdgeTypes: Set<string>,
  viewId: string
): ProjectionOmission[] {
  return graph.edges
    .filter((edge) => projectedNodeIds.has(edge.from) && projectedNodeIds.has(edge.to) && !includedEdgeTypes.has(edge.type))
    .map((edge) => createRelationshipNotInScopeOmission(edge, viewId));
}

export function buildScenarioFlowProjection(graph: CompiledGraph, bundle: Bundle, view: ViewSpec): ProjectionResult {
  const context = createProjectionBuilderContext(graph, bundle, view);
  const config = readDecisionNodeConfig(view);
  const nodeAnnotations = buildDecisionNodeAnnotations(graph, context.projectedNodeIds, config);
  const decisionNodeIds = new Set(nodeAnnotations.map((annotation) => annotation.node_id));
  const edgeAnnotations = buildBranchLabelAnnotations(
    graph,
    decisionNodeIds,
    context.projectedNodeIds,
    new Set(view.projection.ordering_edges),
    config
  );

  return buildProjectionResult(context, {
    derived: {
      ...createEmptyDerived(),
      node_annotations: nodeAnnotations,
      edge_annotations: edgeAnnotations
    },
    omissions: buildOmissions(graph, context.projectedNodeIds, context.includedEdgeTypes, view.id)
  });
}
