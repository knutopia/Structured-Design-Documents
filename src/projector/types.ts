import type { Diagnostic } from "../types.js";

export interface ProjectionNode {
  id: string;
  type: string;
  name: string;
}

export interface ProjectionEdge {
  from: string;
  type: string;
  to: string;
}

export interface ProjectionNodeAnnotation {
  node_id: string;
  display?: {
    subtitle?: string;
    badge?: string;
    shape?: string;
    metadata?: Array<{
      key: string;
      value: string;
    }>;
  };
  references?: Array<{
    role: string;
    target_id: string;
    target_type?: string;
    target_name?: string;
    group?: string;
    source_prop?: string;
  }>;
}

export interface ProjectionEdgeAnnotation {
  from: string;
  type: string;
  to: string;
  role: string;
  display_label: string;
  label_source: string;
}

export interface ProjectionNodeGroup {
  id: string;
  role: string;
  label: string;
  node_ids: string[];
  scope_id?: string;
}

export interface ProjectionOmission {
  kind: "edge";
  from: string;
  type: string;
  to: string;
  reason: "endpoint_out_of_scope" | "relationship_not_in_scope" | "derived_annotation_instead_of_edge";
  detail?: string;
}

export interface Projection {
  schema: "sdd-text-view-projection";
  version: string;
  view_id: string;
  source_example: string;
  nodes: ProjectionNode[];
  edges: ProjectionEdge[];
  derived: {
    node_annotations: ProjectionNodeAnnotation[];
    edge_annotations: ProjectionEdgeAnnotation[];
    node_groups: ProjectionNodeGroup[];
    view_metadata: Record<string, unknown>;
  };
  omissions: ProjectionOmission[];
  notes: string[];
}

export interface ProjectionResult {
  projection?: Projection;
  diagnostics: Diagnostic[];
}

