import type { BundleFingerprint } from "../../bundle/fingerprint.js";
import type { Diagnostic } from "../../types.js";
import type { DocumentRevision, Handle } from "../contracts.js";

export interface GuidedDocumentSnapshotInput {
  document_ref: string;
  path?: string;
  text: string;
}

export interface GuidedNewDocumentSnapshotInput {
  document_ref: string;
  path?: string;
}

export interface GuidedExistingNode {
  handle: Handle;
  node_id: string;
  node_type: string;
  name: string;
  parent_handle: Handle | null;
  source_order: number;
}

export interface GuidedExistingEdge {
  handle: Handle;
  parent_handle: Handle;
  from: string;
  type: string;
  to: string;
  source_order: number;
}

export interface GuidedDocumentSnapshot {
  kind: "sdd-guided-document-snapshot";
  document_ref: string;
  path?: string;
  document_precondition?: "must_not_exist";
  revision: DocumentRevision;
  bundle_fingerprint: BundleFingerprint;
  effective_version: string;
  nodes: GuidedExistingNode[];
  edges: GuidedExistingEdge[];
  top_level_order: Handle[];
  body_order_by_parent: Record<Handle, Handle[]>;
  diagnostics: Diagnostic[];
}
