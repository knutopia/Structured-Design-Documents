import path from "node:path";
import type { ErrorObject } from "ajv";
import Ajv2020Import from "ajv/dist/2020.js";
import type { Bundle, ViewSpec } from "../bundle/types.js";
import { getGraphSourcePath, type CompiledGraph } from "../compiler/types.js";
import { sortDiagnostics } from "../diagnostics/types.js";
import type { Diagnostic } from "../types.js";
import type {
  Projection,
  ProjectionNode,
  ProjectionNodeAnnotation,
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

type NodeAnnotationDisplay = NonNullable<ProjectionNodeAnnotation["display"]>;

function createDiagnostic(file: string, code: string, message: string): Diagnostic {
  return {
    stage: "project",
    code,
    severity: "error",
    message,
    file
  };
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

function buildOmissions(graph: CompiledGraph, includedNodeIds: Set<string>, view: ViewSpec, graphNodesById: Map<string, { type: string }>): ProjectionOmission[] {
  const includedEdgeTypes = new Set(view.projection.include_edge_types);
  const omissions: ProjectionOmission[] = [];
  for (const edge of graph.edges) {
    if (!includedNodeIds.has(edge.from)) {
      continue;
    }
    const targetNode = graphNodesById.get(edge.to);
    if (!includedEdgeTypes.has(edge.type)) {
      omissions.push({
        kind: "edge",
        from: edge.from,
        type: edge.type,
        to: edge.to,
        reason: "relationship_not_in_scope",
        detail: `${edge.type} is outside the ${view.id} edge scope.`
      });
      continue;
    }
    if (!includedNodeIds.has(edge.to)) {
      omissions.push({
        kind: "edge",
        from: edge.from,
        type: edge.type,
        to: edge.to,
        reason: "endpoint_out_of_scope",
        detail: `Target node type ${targetNode?.type ?? "unknown"} is outside the ${view.id} node scope.`
      });
    }
  }

  return omissions.sort((left, right) => {
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

export function buildIaPlaceMapProjection(graph: CompiledGraph, bundle: Bundle, view: ViewSpec): ProjectionResult {
  const file = getGraphSourcePath(graph) ?? "<compiled>";
  const graphNodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const includedNodeTypes = new Set(view.projection.include_node_types);
  const includedEdgeTypes = new Set(view.projection.include_edge_types);

  const nodes = graph.nodes
    .filter((node) => includedNodeTypes.has(node.type))
    .map<ProjectionNode>((node) => ({
      id: node.id,
      type: node.type,
      name: node.name
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const includedNodeIds = new Set(nodes.map((node) => node.id));

  const edges = graph.edges
    .filter((edge) => includedEdgeTypes.has(edge.type) && includedNodeIds.has(edge.from) && includedNodeIds.has(edge.to))
    .map((edge) => ({
      from: edge.from,
      type: edge.type,
      to: edge.to
    }))
    .sort((left, right) => {
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

  const nodeAnnotations = buildNodeAnnotations(graph, nodes, view);
  const omissions = buildOmissions(graph, includedNodeIds, view, graphNodesById);
  const notes = [
    ...(view.conventions.normative_defaults?.map((entry) => entry.description) ?? []),
    ...(nodeAnnotations.length > 0 ? ["Node annotations are derived from IA renderer defaults."] : [])
  ];

  const projection: Projection = {
    schema: "sdd-text-view-projection",
    version: graph.version,
    view_id: view.id,
    source_example: sourceExampleName(graph),
    nodes,
    edges,
    derived: {
      node_annotations: nodeAnnotations,
      edge_annotations: [],
      node_groups: [],
      view_metadata: {}
    },
    omissions,
    notes
  };

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
