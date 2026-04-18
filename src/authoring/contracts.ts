import type { Diagnostic } from "../types.js";

export type DocumentPath = string;
export type DocumentUri = string;
export type DocumentRevision = string;
export type ProfileId = "simple" | "permissive" | "strict";
export type ViewId = string;
export type ChangeSetId = string;
export type Handle = string;
export type ValueKind = "quoted_string" | "bare_value";
export type StructuralRelationshipType = "CONTAINS" | "COMPOSED_OF";
export type PreviewBackendId =
  | "legacy_graphviz_preview"
  | "staged_ia_place_map_preview"
  | "staged_ui_contracts_preview"
  | "staged_service_blueprint_preview";
export type ChangeSetOrigin =
  | "apply_change_set"
  | "apply_authoring_intent"
  | "undo_change_set"
  | "create_document";
export type DocumentEffect = "created" | "updated" | "deleted";
export type ChangeSetMode = "dry_run" | "commit";
export type ChangeSetStatus = "applied" | "rejected";

export interface DocumentResource {
  kind: "sdd-document";
  uri: DocumentUri;
  path: DocumentPath;
  revision: DocumentRevision;
  declared_version: string | null;
  effective_version: string;
  text: string;
  metadata: {
    top_level_block_count: number | null;
  };
  diagnostics: Diagnostic[];
}

export interface InspectNodeBlock {
  handle: Handle;
  node_type: string;
  node_id: string;
  name: string;
  parent_handle: Handle | null;
  body_stream: Handle[];
  structural_order_streams: Partial<Record<StructuralRelationshipType, Handle[]>>;
}

export interface InspectPropertyValue {
  key: string;
  value_kind: ValueKind;
  raw_value: string;
}

export interface InspectEdgeValue {
  rel_type: string;
  to: string;
  to_name: string | null;
  event: string | null;
  guard: string | null;
  effect: string | null;
  props: Record<string, string>;
  structural_order_index: number | null;
}

export interface InspectBodyItem {
  handle: Handle;
  kind: "property_line" | "edge_line" | "node_block";
  parent_handle: Handle;
  order_index: number;
  property?: InspectPropertyValue;
  edge?: InspectEdgeValue;
}

export interface InspectResource {
  kind: "sdd-document-inspect";
  uri: DocumentUri;
  path: DocumentPath;
  revision: DocumentRevision;
  effective_version: string;
  top_level_order: Handle[];
  nodes: InspectNodeBlock[];
  body_items: InspectBodyItem[];
  diagnostics: Diagnostic[];
}

export interface InspectDocumentArgs {
  path: DocumentPath;
}

export interface ParseResource {
  kind: "sdd-parse";
  uri: DocumentUri;
  path: DocumentPath;
  revision: DocumentRevision;
  document?: unknown;
  diagnostics: Diagnostic[];
}

export interface CompiledResource {
  kind: "sdd-compiled";
  uri: DocumentUri;
  path: DocumentPath;
  revision: DocumentRevision;
  graph?: unknown;
  diagnostics: Diagnostic[];
}

export interface ValidationResource {
  kind: "sdd-validation";
  uri: DocumentUri;
  path: DocumentPath;
  revision: DocumentRevision;
  profile_id: ProfileId;
  report?: {
    error_count: number;
    warning_count: number;
  };
  diagnostics: Diagnostic[];
}

export interface ProjectionResource {
  kind: "sdd-projection";
  uri: DocumentUri;
  path: DocumentPath;
  revision: DocumentRevision;
  view_id: ViewId;
  projection?: unknown;
  diagnostics: Diagnostic[];
}

export type PlacementMode = "before" | "after" | "first" | "last";
export type PlacementStream = "top_level" | "body";

export interface Placement {
  mode: PlacementMode;
  stream: PlacementStream;
  anchor_handle?: Handle;
  parent_handle?: Handle;
}

export interface ChangeSetSummary {
  node_insertions: Array<{ handle?: Handle; node_id: string; node_type: string }>;
  node_deletions: Array<{ handle: Handle; node_id?: string }>;
  node_renames: Array<{ handle: Handle; from: string; to: string }>;
  property_changes: Array<{ node_handle: Handle; key: string; from?: string; to?: string }>;
  edge_insertions: Array<{ handle?: Handle; parent_handle: Handle; rel_type: string; to: string }>;
  edge_deletions: Array<{ handle: Handle; parent_handle: Handle; rel_type: string; to: string }>;
  ordering_changes: Array<{
    kind: "top_level_node" | "structural_edge" | "nested_node_block";
    target_handle: Handle;
    parent_handle?: Handle;
    old_index: number;
    new_index: number;
  }>;
}

export interface ProjectionResultEntry {
  view_id: ViewId;
  projection?: unknown;
  diagnostics: Diagnostic[];
}

export interface ChangeSetResult {
  kind: "sdd-change-set";
  change_set_id: ChangeSetId;
  path: DocumentPath;
  origin: ChangeSetOrigin;
  document_effect: DocumentEffect;
  base_revision: DocumentRevision | null;
  resulting_revision?: DocumentRevision;
  mode: ChangeSetMode;
  status: ChangeSetStatus;
  undo_eligible: boolean;
  operations: ChangeOperation[];
  summary: ChangeSetSummary;
  diagnostics: Diagnostic[];
  projection_results?: ProjectionResultEntry[];
}

export type ChangeSetResource = ChangeSetResult;

export interface InsertNodeBlockOp {
  kind: "insert_node_block";
  node_type: string;
  node_id: string;
  name: string;
  placement: Placement;
}

export interface DeleteNodeBlockOp {
  kind: "delete_node_block";
  node_handle: Handle;
}

export interface SetNodeNameOp {
  kind: "set_node_name";
  node_handle: Handle;
  name: string;
}

export interface SetNodePropertyOp {
  kind: "set_node_property";
  node_handle: Handle;
  key: string;
  value_kind: ValueKind;
  raw_value: string;
}

export interface RemoveNodePropertyOp {
  kind: "remove_node_property";
  node_handle: Handle;
  key: string;
}

export interface InsertEdgeLineOp {
  kind: "insert_edge_line";
  parent_handle: Handle;
  rel_type: string;
  to: string;
  to_name?: string | null;
  event?: string | null;
  guard?: string | null;
  effect?: string | null;
  props?: Record<string, string>;
  placement?: Placement;
}

export interface RemoveEdgeLineOp {
  kind: "remove_edge_line";
  edge_handle: Handle;
}

export interface RepositionTopLevelNodeOp {
  kind: "reposition_top_level_node";
  node_handle: Handle;
  placement: Placement;
}

export interface RepositionStructuralEdgeOp {
  kind: "reposition_structural_edge";
  edge_handle: Handle;
  placement: Placement;
}

export interface MoveNestedNodeBlockOp {
  kind: "move_nested_node_block";
  node_handle: Handle;
  placement: Placement;
}

export type ChangeOperation =
  | InsertNodeBlockOp
  | DeleteNodeBlockOp
  | SetNodeNameOp
  | SetNodePropertyOp
  | RemoveNodePropertyOp
  | InsertEdgeLineOp
  | RemoveEdgeLineOp
  | RepositionTopLevelNodeOp
  | RepositionStructuralEdgeOp
  | MoveNestedNodeBlockOp;

export interface ListDocumentsArgs {
  under?: string;
  limit?: number;
}

export interface ListDocumentsResult {
  kind: "sdd-document-list";
  documents: Array<{
    path: DocumentPath;
    uri: DocumentUri;
    revision: DocumentRevision;
    effective_version: string;
    top_level_block_count: number;
  }>;
  diagnostics: Diagnostic[];
}

export interface SearchGraphArgs {
  query?: string;
  node_type?: string;
  node_id?: string;
  under?: string;
  limit?: number;
}

export interface SearchGraphResult {
  kind: "sdd-search-results";
  matches: Array<{
    path: DocumentPath;
    uri: DocumentUri;
    revision: DocumentRevision;
    node_id: string;
    node_type: string;
    name: string;
    matched_on: Array<"query" | "node_type" | "node_id">;
  }>;
  diagnostics: Diagnostic[];
}

export interface CreateDocumentArgs {
  path: DocumentPath;
  version?: "0.1";
}

export interface CreateDocumentResult {
  kind: "sdd-create-document";
  path: DocumentPath;
  uri: DocumentUri;
  revision: DocumentRevision;
  change_set: ChangeSetResult;
}

export interface ValidateDocumentArgs {
  path: DocumentPath;
  profile_id: ProfileId;
}

export interface ProjectDocumentArgs {
  path: DocumentPath;
  view_id: ViewId;
}

export interface ApplyChangeSetArgs {
  path: DocumentPath;
  base_revision: DocumentRevision;
  mode?: ChangeSetMode;
  operations: ChangeOperation[];
  validate_profile?: ProfileId;
  projection_views?: ViewId[];
}

export interface NodeSelector {
  kind: "node_id";
  node_id: string;
}

export type NodeRef =
  | { by: "handle"; handle: Handle }
  | { by: "local_id"; local_id: string }
  | { by: "selector"; selector: NodeSelector };

export interface InsertNodeScaffoldIntent {
  kind: "insert_node_scaffold";
  local_id: string;
  parent?: NodeRef;
  placement: {
    mode: PlacementMode;
    anchor?: NodeRef;
  };
  node: {
    node_type: string;
    node_id: string;
    name: string;
    props?: Array<{
      key: string;
      value_kind: ValueKind;
      raw_value: string;
    }>;
    edges?: Array<{
      local_id: string;
      rel_type: string;
      to: string;
      to_name?: string | null;
      event?: string | null;
      guard?: string | null;
      effect?: string | null;
      props?: Record<string, string>;
      placement?: {
        mode: "first" | "last";
      };
    }>;
    children?: InsertNodeScaffoldIntent[];
  };
}

export type AuthoringIntent = InsertNodeScaffoldIntent;

export interface ApplyAuthoringIntentArgs {
  path: DocumentPath;
  base_revision: DocumentRevision;
  mode?: ChangeSetMode;
  intents: AuthoringIntent[];
  validate_profile?: ProfileId;
  projection_views?: ViewId[];
}

export interface AuthoringIntentDiagnostic {
  intent_index: number;
  local_id?: string;
  field_path: string;
  code: string;
  message: string;
}

export interface ApplyAuthoringIntentResult {
  kind: "sdd-authoring-intent-result";
  path: DocumentPath;
  base_revision: DocumentRevision;
  resulting_revision?: DocumentRevision;
  mode: ChangeSetMode;
  status: ChangeSetStatus;
  intents: AuthoringIntent[];
  change_set: ChangeSetResult;
  created_targets: Array<{
    local_id: string;
    kind: "node" | "edge";
    handle: Handle;
    parent_local_id?: string;
  }>;
  diagnostics: Diagnostic[];
  intent_diagnostics?: AuthoringIntentDiagnostic[];
}

export interface UndoChangeSetArgs {
  change_set_id: ChangeSetId;
  mode?: ChangeSetMode;
  validate_profile?: ProfileId;
}

export interface RenderPreviewArgs {
  path: DocumentPath;
  view_id: ViewId;
  profile_id: ProfileId;
  format: "svg" | "png";
  backend_id?: PreviewBackendId;
  display_copy_name?: string;
}

export interface RenderPreviewResult {
  kind: "sdd-preview";
  path: DocumentPath;
  revision: DocumentRevision;
  view_id: ViewId;
  profile_id: ProfileId;
  backend_id: PreviewBackendId | string;
  display_copy_path?: string;
  notes: string[];
  diagnostics: Diagnostic[];
  artifact:
    | {
        format: "svg";
        mime_type: "image/svg+xml";
        text: string;
      }
    | {
        format: "png";
        mime_type: "image/png";
        base64: string;
      };
}

export interface HelperGitStatusArgs {
  paths?: DocumentPath[];
}

export interface HelperGitCommitArgs {
  message: string;
  paths: DocumentPath[];
}

export interface HelperGitStatusResult {
  kind: "sdd-git-status";
  paths: DocumentPath[];
  status: Array<{
    path: DocumentPath;
    index_status: string;
    worktree_status: string;
  }>;
}

export interface HelperGitCommitResult {
  kind: "sdd-git-commit";
  committed_paths: DocumentPath[];
  commit_sha: string;
}

export interface HelperErrorResult {
  kind: "sdd-helper-error";
  code: "invalid_args" | "invalid_json" | "runtime_error";
  message: string;
  diagnostics?: Diagnostic[];
}

export interface HelperHelpStubResult {
  kind: "sdd-helper-help";
  helper_name: "sdd-helper";
  summary: string;
  note: string;
  capabilities_command: "sdd-helper capabilities";
  commands: string[];
}

export interface HelperCapabilitiesResultCommand {
  name: string;
  invocation: string;
  summary: string;
  mutates_repo_state: "never" | "conditional" | "always";
  arguments: Array<{
    name: string;
    required: boolean;
    description: string;
  }>;
  options: Array<{
    flag: string;
    required: boolean;
    description: string;
    value_name?: string;
  }>;
  request_body?: {
    via_option: "--request";
    top_level_shape: "ApplyAuthoringIntentArgs" | "ApplyChangeSetArgs" | "UndoChangeSetArgs";
    source: "file_path_or_stdin_dash";
  };
  result_kind: string;
  constraints: string[];
  subject_id: ContractSubjectId;
  input_shape_id?: ContractShapeId;
  output_shape_id?: ContractShapeId;
  has_deep_introspection: true;
  detail_modes?: ContractResolutionMode[];
}

export interface HelperCapabilitiesResult {
  kind: "sdd-helper-capabilities";
  helper_name: "sdd-helper";
  summary: string;
  discovery: {
    bare_invocation: "returns_help_stub";
    help_flag: "returns_help_stub";
    canonical_introspection_command: "sdd-helper capabilities";
  };
  conventions: {
    stdout_success: "exactly_one_json_payload";
    helper_errors: "sdd-helper-error_non_zero_exit";
    domain_rejections: "structured_payload_exit_zero";
    path_scope: "repo_relative_sdd_paths";
    request_loading: Array<{
      command: "apply" | "author" | "undo";
      option: "--request";
      sources: Array<"file_path" | "stdin_dash">;
      top_level_shape: "ApplyAuthoringIntentArgs" | "ApplyChangeSetArgs" | "UndoChangeSetArgs";
    }>;
  };
  commands: HelperCapabilitiesResultCommand[];
}

export interface HelperContractArgs {
  subject_id: ContractSubjectId;
  resolve?: "bundle";
}

export type ContractSubjectId =
  | `helper.command.${string}`
  | `mcp.tool.${string}`
  | `mcp.resource.${string}`
  | `mcp.prompt.${string}`;

export type ContractShapeId = `shared.shape.${string}`;
export type ContractConstraintId = `shared.constraint.${string}`;
export type ContractBindingId = `shared.binding.${string}`;
export type ContractContinuationId = `shared.continuation.${string}`;

export type ContractSchemaFormat = "json_schema_2020_12";
export type ContractResolutionMode = "static" | "bundle_resolved";
export type ContractStability = "stable" | "experimental" | "deprecated";
export type ContractSurfaceKind = "helper_command" | "mcp_tool" | "mcp_resource" | "mcp_prompt";

export interface ContractIndex {
  kind: "sdd-contract-index";
  contract_version: "0.1";
  summary: string;
  subjects: ContractSubjectDescriptor[];
  shapes: ContractShapeDescriptor[];
}

export interface ContractSubjectDescriptor {
  subject_id: ContractSubjectId;
  surface_kind: ContractSurfaceKind;
  surface_name: string;
  summary: string;
  stability: ContractStability;
  mutates_repo_state?: "never" | "conditional" | "always";
  input_shape_id?: ContractShapeId;
  output_shape_id?: ContractShapeId;
  detail_modes: ContractResolutionMode[];
  has_deep_introspection: true;
}

export interface ContractSubjectDetail {
  kind: "sdd-contract-subject-detail";
  subject: ContractSubjectDescriptor;
  input_shape?: ContractShapeDescriptor;
  output_shape?: ContractShapeDescriptor;
  constraints: ContractConstraintSpec[];
  bindings: ContractBindingSpec[];
  continuation: ContractContinuationSpec[];
  examples?: ContractExampleSpec[];
  resolution: {
    mode: ContractResolutionMode;
    bundle_name?: string;
    bundle_version?: string;
    unresolved_binding_ids?: ContractBindingId[];
  };
}

export interface HelperContractDetailResult extends ContractSubjectDetail {}

export interface ContractShapeDescriptor {
  shape_id: ContractShapeId;
  summary: string;
  schema_format: ContractSchemaFormat;
  schema: object;
  stability: ContractStability;
}

export interface ContractConstraintSpec {
  constraint_id: ContractConstraintId;
  applies_to_shape_id: ContractShapeId;
  applies_to_json_pointers?: string[];
  kind:
    | "required_if"
    | "forbidden_if"
    | "unique_within_request"
    | "must_reference_earlier_local_id"
    | "same_revision_handle"
    | "commit_safe_continuation"
    | "dry_run_informational_only";
  parameters: Record<string, unknown>;
  summary: string;
}

export interface ContractResolvedAllowedValue {
  value: string;
  label?: string;
  metadata?: Record<string, unknown>;
}

export interface ContractBindingSpec {
  binding_id: ContractBindingId;
  applies_to_shape_id: ContractShapeId;
  applies_to_json_pointer: string;
  kind: "bundle_value_set";
  bundle_source: {
    artifact: "manifest_profiles" | "views_yaml" | "vocab_node_types" | "vocab_relationship_types";
    selector: string;
  };
  static_behavior: "reference_only";
  bundle_resolved_behavior: "expand_values";
  summary: string;
  resolved_values?: ContractResolvedAllowedValue[];
}

export interface ContractContinuationSpec {
  continuation_id: ContractContinuationId;
  applies_to_subject_id: ContractSubjectId;
  kind:
    | "result_revision_is_required_next_base_revision"
    | "commit_handles_are_safe_continuation_surfaces"
    | "dry_run_handles_are_informational_only"
    | "create_revision_is_bootstrap_continuation_surface"
    | "inspect_may_fail_on_empty_bootstrap";
  summary: string;
  parameters?: Record<string, unknown>;
}

export interface ContractExampleSpec {
  title: string;
  when_to_include: "explicit_request_only" | "essential_only";
  payload: unknown;
}
