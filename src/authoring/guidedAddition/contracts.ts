import type { BundleFingerprint } from "../../bundle/fingerprint.js";
import type { Diagnostic } from "../../types.js";
import type { DocumentRevision, Handle, ValueKind } from "../contracts.js";

export interface GuidedDocumentSnapshotInput {
  document_ref: string;
  path?: string;
  text: string;
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
  revision: DocumentRevision;
  bundle_fingerprint: BundleFingerprint;
  effective_version: string;
  nodes: GuidedExistingNode[];
  edges: GuidedExistingEdge[];
  top_level_order: Handle[];
  body_order_by_parent: Record<Handle, Handle[]>;
  diagnostics: Diagnostic[];
}

export interface ExistingNodeRef {
  kind: "existing_node";
  handle: Handle;
  node_id: string;
  node_type: string;
}

export interface BeginGuidedAdditionRequest {
  anchor?: ExistingNodeRef;
  initial_filter?: GuidedAdditionFilter;
}

export type GuidedRelationshipRole = "primary" | "supporting" | "bridge";
export type GuidedRelationshipPresence = "connector" | "structural" | "annotation" | "hidden";
export type GuidedRelationshipLabel = "visible" | "hidden" | "not_applicable";

export interface RelationshipDisplay {
  presence: GuidedRelationshipPresence;
  label: GuidedRelationshipLabel;
  explanation?: string;
}

export interface GuidedAdditionFilter {
  view_id?: string;
  display_profile_id?: string;
  roles?: GuidedRelationshipRole[];
  presences?: GuidedRelationshipPresence[];
}

export interface RelationshipIntentSelection {
  direction: "outgoing" | "incoming";
  endpoint_strategy: "existing_only" | "existing_or_new";
}

export type GuidedOperationSelection =
  | { kind: "add_node" }
  | ({ kind: "add_relationship" } & RelationshipIntentSelection);

export interface GuidedFieldDefinition {
  field_id: string;
  source:
    | "node_id"
    | "name"
    | "node_property"
    | "edge_event"
    | "edge_guard"
    | "edge_effect"
    | "edge_property";
  property?: string;
  label?: string;
  description?: string;
  input_hint?: string;
  value_kind: ValueKind;
  required: boolean;
  prominence: "primary" | "advanced";
  format: "sdd_node_id" | "non_empty_text" | "free_text" | "enum" | "pattern" | "node_reference";
  allowed_values?: string[];
  pattern?: string;
  allowed_target_types?: string[];
}

export interface RelationshipChoice {
  choice_id: string;
  from_type: string;
  relationship_type: string;
  to_type: string;
  direction_relative_to_anchor?: "outgoing" | "incoming";
  meaning?: string;
  role_by_view: Partial<Record<string, GuidedRelationshipRole>>;
  display_by_view: Partial<Record<string, Record<string, RelationshipDisplay>>>;
  existing_endpoint_count: number;
  required_edge_fields: GuidedFieldDefinition[];
  optional_edge_fields: GuidedFieldDefinition[];
}

export interface GuidedNodeTypeChoice {
  option_id: string;
  node_type: string;
  group?: string;
  description?: string;
  view_role?: "native" | "bridge";
}

export type GuidedEndpointChoice =
  | {
      option_id: string;
      kind: "existing";
      node: ExistingNodeRef;
      existing_edge_count_for_triple_and_endpoints: number;
    }
  | {
      option_id: string;
      kind: "create_new";
      node_type: string;
      local_id: "node_1";
    };

export interface GuidedNodeFieldValues {
  node_id: string;
  name: string;
  properties: Array<{
    key: string;
    value_kind: ValueKind;
    raw_value: string;
  }>;
}

export interface GuidedEdgeFieldValues {
  event?: string | null;
  guard?: string | null;
  effect?: string | null;
  props: Record<string, string>;
}

export type ExistingOrNewNodeRef =
  | ExistingNodeRef
  | { kind: "new_node"; local_id: string; node_id: string; node_type: string };

export interface ProposedPlacement {
  stream: "top_level" | "body";
  mode: "before" | "after" | "first" | "last";
  parent?: ExistingOrNewNodeRef;
  anchor?: ExistingNodeRef;
}

export interface ReparentExistingNodeEffect {
  kind: "reparent_existing_node";
  effect_id: string;
  document_revision: DocumentRevision;
  target: ExistingNodeRef;
  old_parent_handle: Handle | null;
  new_parent: { kind: "new_node"; local_id: string } | ExistingNodeRef;
  placement: ProposedPlacement;
  relationship: {
    from: ExistingOrNewNodeRef;
    type: string;
    to: ExistingOrNewNodeRef;
  };
}

export interface ConfirmedProposalEffect extends ReparentExistingNodeEffect {
  confirmed: true;
}

export type ProposedConfirmableEffect = ReparentExistingNodeEffect;

export interface PlacementRecommendation {
  recommendation_id: string;
  target: ExistingOrNewNodeRef;
  recommended: ProposedPlacement;
  alternatives: ProposedPlacement[];
  reason_code:
    | "structural_nesting"
    | "outgoing_graph_sequence"
    | "incoming_graph_sequence"
    | "same_source_target_order"
    | "fallback_append";
  required_effect?: ProposedConfirmableEffect;
}

export interface PlacementSelection {
  recommendation_id: string;
  selected: ProposedPlacement;
}

export interface SelectedPlacement extends PlacementSelection {
  target:
    | { kind: "node"; node: ExistingOrNewNodeRef }
    | { kind: "edge"; local_id: "edge_1" };
  selected_by: "recommended_default" | "user";
}

export interface GuidedAdditionSelections {
  operation?: GuidedOperationSelection;
  node_type?: string;
  relationship_choice_id?: string;
  endpoint?:
    | { kind: "existing"; node: ExistingNodeRef }
    | { kind: "create_new"; local_id: "node_1"; node_type: string };
  new_node_fields?: GuidedNodeFieldValues;
  edge_fields?: GuidedEdgeFieldValues;
  placements: PlacementSelection[];
}

export interface GuidedAdditionState {
  kind: "sdd-guided-addition-state";
  workflow_version: "0.1";
  document_context: {
    document_ref: string;
    revision: DocumentRevision;
    bundle_fingerprint: BundleFingerprint;
  };
  anchor?: ExistingNodeRef;
  filter: GuidedAdditionFilter;
  selections: GuidedAdditionSelections;
  confirmed_effects: ConfirmedProposalEffect[];
}

export interface ProposedNode {
  local_id: "node_1";
  node_type: string;
  node_id: string;
  name: string;
  properties: Array<{
    key: string;
    value_kind: ValueKind;
    raw_value: string;
  }>;
}

export interface ProposedEdge {
  local_id: "edge_1";
  from: ExistingOrNewNodeRef;
  type: string;
  to: ExistingOrNewNodeRef;
  to_name: string | null;
  event: string | null;
  guard: string | null;
  effect: string | null;
  props: Record<string, string>;
}

export interface ProposedRelationship {
  type: string;
  from: ExistingOrNewNodeRef;
  to: ExistingOrNewNodeRef;
  direction_relative_to_anchor?: "outgoing" | "incoming";
}

export interface CompletedAdditionProposal {
  kind: "sdd-addition-proposal";
  proposal_version: "0.1";
  proposal_id: string;
  document_context: {
    document_ref: string;
    path?: string;
    base_revision: DocumentRevision;
    bundle_fingerprint: BundleFingerprint;
  };
  anchor?: ExistingNodeRef;
  guidance_context: {
    view_id?: string;
    display_profile_id?: string;
    relationship_role?: GuidedRelationshipRole;
  };
  relationship?: ProposedRelationship;
  new_nodes: ProposedNode[];
  new_edges: ProposedEdge[];
  placements: SelectedPlacement[];
  confirmed_effects: ConfirmedProposalEffect[];
}

export type GuidedStepKind =
  | "choose_operation"
  | "choose_node_type"
  | "choose_relationship"
  | "choose_endpoint"
  | "edit_new_node"
  | "edit_edge_fields"
  | "review_placement"
  | "confirm_effect"
  | "review_proposal";

export type GuidedStep =
  | { kind: "choose_operation"; options: GuidedOperationSelection[] }
  | { kind: "choose_node_type"; options: GuidedNodeTypeChoice[] }
  | { kind: "choose_relationship"; options: RelationshipChoice[] }
  | { kind: "choose_endpoint"; options: GuidedEndpointChoice[] }
  | {
      kind: "edit_new_node";
      local_id: "node_1";
      fields: GuidedFieldDefinition[];
      values: GuidedNodeFieldValues;
      suggested_node_id: string;
    }
  | {
      kind: "edit_edge_fields";
      local_id: "edge_1";
      fields: GuidedFieldDefinition[];
      values: GuidedEdgeFieldValues;
    }
  | { kind: "review_placement"; recommendations: PlacementRecommendation[] }
  | { kind: "confirm_effect"; effect: ProposedConfirmableEffect }
  | { kind: "review_proposal"; proposal: CompletedAdditionProposal };

export type GuidedAdditionAction =
  | { kind: "set_filter"; filter: GuidedAdditionFilter }
  | { kind: "choose_operation"; selection: GuidedOperationSelection }
  | { kind: "choose_node_type"; node_type: string }
  | { kind: "choose_relationship"; choice_id: string }
  | { kind: "choose_existing_endpoint"; node: ExistingNodeRef }
  | { kind: "create_new_endpoint" }
  | { kind: "set_new_node_fields"; fields: GuidedNodeFieldValues }
  | { kind: "set_edge_fields"; fields: GuidedEdgeFieldValues }
  | { kind: "select_placement"; selection: PlacementSelection }
  | { kind: "confirm_effect"; effect: ConfirmedProposalEffect }
  | { kind: "complete" };

export type GuidedAdditionResult =
  | {
      kind: "sdd-guided-addition-step";
      state: GuidedAdditionState;
      step: GuidedStep;
      diagnostics: Diagnostic[];
    }
  | {
      kind: "sdd-guided-addition-complete";
      state: GuidedAdditionState;
      proposal: CompletedAdditionProposal;
      diagnostics: Diagnostic[];
    };

export interface GuidedAdditionRuntime {
  begin(snapshot: GuidedDocumentSnapshot, request: BeginGuidedAdditionRequest): GuidedAdditionResult;
  advance(
    snapshot: GuidedDocumentSnapshot,
    state: GuidedAdditionState,
    action: GuidedAdditionAction
  ): GuidedAdditionResult;
}

export class GuidedAdditionDomainError extends Error {
  readonly code: string;
  readonly diagnostics: Diagnostic[];
  readonly state?: GuidedAdditionState;

  constructor(code: string, message: string, diagnostics: Diagnostic[], state?: GuidedAdditionState) {
    super(message);
    this.name = "GuidedAdditionDomainError";
    this.code = code;
    this.diagnostics = diagnostics;
    this.state = state;
  }
}
