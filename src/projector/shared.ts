import path from "node:path";
import type { ErrorObject } from "ajv";
import Ajv2020Import from "ajv/dist/2020.js";
import type { Bundle, ViewSpec } from "../bundle/types.js";
import { getGraphSourcePath, type CompiledEdge, type CompiledGraph, type CompiledNode } from "../compiler/types.js";
import { sortDiagnostics } from "../diagnostics/types.js";
import type { Diagnostic } from "../types.js";
import type {
  Projection,
  ProjectionEdge,
  ProjectionEdgeAnnotation,
  ProjectionNode,
  ProjectionNodeAnnotation,
  ProjectionNodeGroup,
  ProjectionOmission,
  ProjectionResult
} from "./types.js";

const Ajv2020 = Ajv2020Import as unknown as new (options: Record<string, unknown>) => {
  addSchema(schema: object): void;
  compile(schema: object): {
    (data: unknown): boolean;
    errors?: ErrorObject[] | null;
  };
};

export interface ProjectionBuilderContext {
  file: string;
  sourceExample: string;
  graph: CompiledGraph;
  bundle: Bundle;
  view: ViewSpec;
  graphNodesById: Map<string, CompiledNode>;
  projectedNodes: ProjectionNode[];
  projectedEdges: ProjectionEdge[];
  projectedNodeIds: Set<string>;
  includedNodeTypes: Set<string>;
  includedEdgeTypes: Set<string>;
}

export interface ProjectionBuilderOutput {
  derived?: Projection["derived"];
  omissions?: ProjectionOmission[];
  notes?: string[];
}

function projectionSchemaDiagnostics(file: string, errors: ErrorObject[] | null | undefined): Diagnostic[] {
  return (
    errors?.map((error) => ({
      stage: "project" as const,
      code: "project.schema_validation_failed",
      severity: "error" as const,
      message: `${error.instancePath || "/"} ${error.message ?? "projection schema validation failed"}`,
      file
    })) ?? []
  );
}

function sourceExampleName(graph: CompiledGraph): string {
  const sourcePath = getGraphSourcePath(graph);
  return sourcePath ? path.basename(sourcePath, path.extname(sourcePath)) : "unknown";
}

function sortProjectionEdges(edges: ProjectionEdge[]): ProjectionEdge[] {
  return [...edges].sort((left, right) => {
    const fromCompare = left.from.localeCompare(right.from);
    if (fromCompare !== 0) {
      return fromCompare;
    }
    const typeCompare = left.type.localeCompare(right.type);
    if (typeCompare !== 0) {
      return typeCompare;
    }
    return left.to.localeCompare(right.to);
  });
}

export function createProjectionBuilderContext(
  graph: CompiledGraph,
  bundle: Bundle,
  view: ViewSpec
): ProjectionBuilderContext {
  const includedNodeTypes = new Set(view.projection.include_node_types);
  const includedEdgeTypes = new Set(view.projection.include_edge_types);
  const projectedNodes = graph.nodes
    .filter((node) => includedNodeTypes.has(node.type))
    .map<ProjectionNode>((node) => ({
      id: node.id,
      type: node.type,
      name: node.name
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const projectedNodeIds = new Set(projectedNodes.map((node) => node.id));
  const projectedEdges = sortProjectionEdges(
    graph.edges
      .filter((edge) => includedEdgeTypes.has(edge.type) && projectedNodeIds.has(edge.from) && projectedNodeIds.has(edge.to))
      .map((edge) => ({
        from: edge.from,
        type: edge.type,
        to: edge.to
      }))
  );

  return {
    file: getGraphSourcePath(graph) ?? "<compiled>",
    sourceExample: sourceExampleName(graph),
    graph,
    bundle,
    view,
    graphNodesById: new Map(graph.nodes.map((node) => [node.id, node])),
    projectedNodes,
    projectedEdges,
    projectedNodeIds,
    includedNodeTypes,
    includedEdgeTypes
  };
}

export function createEmptyDerived(): Projection["derived"] {
  return {
    node_annotations: [],
    edge_annotations: [],
    node_groups: [],
    view_metadata: {}
  };
}

export function sortProjectionNodeAnnotations(annotations: ProjectionNodeAnnotation[]): ProjectionNodeAnnotation[] {
  return [...annotations].sort((left, right) => left.node_id.localeCompare(right.node_id));
}

export function sortProjectionEdgeAnnotations(annotations: ProjectionEdgeAnnotation[]): ProjectionEdgeAnnotation[] {
  return [...annotations].sort((left, right) => {
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
    const roleCompare = left.role.localeCompare(right.role);
    if (roleCompare !== 0) {
      return roleCompare;
    }
    const labelCompare = left.display_label.localeCompare(right.display_label);
    if (labelCompare !== 0) {
      return labelCompare;
    }
    return left.label_source.localeCompare(right.label_source);
  });
}

export function sortProjectionNodeGroups(groups: ProjectionNodeGroup[]): ProjectionNodeGroup[] {
  return [...groups].sort((left, right) => left.id.localeCompare(right.id));
}

export function sortProjectionOmissions(omissions: ProjectionOmission[]): ProjectionOmission[] {
  return [...omissions].sort((left, right) => {
    const fromCompare = left.from.localeCompare(right.from);
    if (fromCompare !== 0) {
      return fromCompare;
    }
    const typeCompare = left.type.localeCompare(right.type);
    if (typeCompare !== 0) {
      return typeCompare;
    }
    return left.to.localeCompare(right.to);
  });
}

export function createEndpointOutOfScopeOmission(
  edge: Pick<CompiledEdge, "from" | "type" | "to">,
  targetNode: Pick<CompiledNode, "type"> | undefined,
  viewId: string
): ProjectionOmission {
  return {
    kind: "edge",
    from: edge.from,
    type: edge.type,
    to: edge.to,
    reason: "endpoint_out_of_scope",
    detail: `Target node type ${targetNode?.type ?? "unknown"} is outside the ${viewId} node scope.`
  };
}

export function createRelationshipNotInScopeOmission(
  edge: Pick<CompiledEdge, "from" | "type" | "to">,
  viewId: string
): ProjectionOmission {
  return {
    kind: "edge",
    from: edge.from,
    type: edge.type,
    to: edge.to,
    reason: "relationship_not_in_scope",
    detail: `${edge.type} is outside the ${viewId} edge scope.`
  };
}

export function createDerivedAnnotationOmission(
  edge: Pick<CompiledEdge, "from" | "type" | "to">,
  detail: string
): ProjectionOmission {
  return {
    kind: "edge",
    from: edge.from,
    type: edge.type,
    to: edge.to,
    reason: "derived_annotation_instead_of_edge",
    detail
  };
}

export function validateProjection(bundle: Bundle, projection: Projection, file: string): ProjectionResult {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false
  });
  ajv.addSchema(bundle.schema);
  const validate = ajv.compile(bundle.projectionSchema);
  const valid = validate(projection);
  if (!valid) {
    return {
      diagnostics: sortDiagnostics(projectionSchemaDiagnostics(file, validate.errors))
    };
  }

  return {
    projection,
    diagnostics: []
  };
}

export function buildProjectionResult(
  context: ProjectionBuilderContext,
  output: ProjectionBuilderOutput = {}
): ProjectionResult {
  const derived = output.derived ?? createEmptyDerived();
  const projection: Projection = {
    schema: "sdd-text-view-projection",
    version: context.graph.version,
    view_id: context.view.id,
    source_example: context.sourceExample,
    nodes: context.projectedNodes,
    edges: context.projectedEdges,
    derived: {
      node_annotations: sortProjectionNodeAnnotations(derived.node_annotations),
      edge_annotations: sortProjectionEdgeAnnotations(derived.edge_annotations),
      node_groups: sortProjectionNodeGroups(derived.node_groups),
      view_metadata: { ...derived.view_metadata }
    },
    omissions: sortProjectionOmissions(output.omissions ?? []),
    notes: [...(output.notes ?? [])]
  };

  return validateProjection(context.bundle, projection, context.file);
}
