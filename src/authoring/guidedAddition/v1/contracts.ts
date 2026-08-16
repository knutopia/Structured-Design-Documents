import type { BundleFingerprint } from "../../../bundle/fingerprint.js";
import type { Diagnostic } from "../../../types.js";
import type { DocumentRevision, Handle, ValueKind } from "../../contracts.js";
import type { GuidedDocumentSnapshot } from "../sharedContracts.js";

export interface ExistingNodeRefV1 {
  kind: "existing_node";
  handle: Handle;
  node_id: string;
  node_type: string;
  name: string;
}

export interface NewNodeRefV1 {
  kind: "new_node";
  local_node_id: "node_1";
}

export type NodeRefV1 = ExistingNodeRefV1 | NewNodeRefV1;

export interface EndpointTripleV1 {
  from_type: string;
  relationship_type: string;
  to_type: string;
}

export interface RelationshipRouteV1 {
  addition_kind: "relationship";
  direction: "outgoing" | "incoming";
  selection_order: "relationship_first" | "existing_node_first";
}

export interface GuidedFieldValueV1 {
  field_id: string;
  value_kind: ValueKind;
  raw_value: string;
}

export interface GuidedFieldDefinitionV1 {
  field_id: string;
  label: string;
  description?: string;
  required: boolean;
  prominence: "primary" | "advanced";
  value_kind: ValueKind;
  suggested_raw_value?: string;
  allowed_values?: string[];
}

export type SemanticSameLevelOrderV1 =
  | { kind: "top_level_first" }
  | { kind: "top_level_last" }
  | { kind: "before_existing"; node: ExistingNodeRefV1 }
  | { kind: "after_existing"; node: ExistingNodeRefV1 };

export type SemanticNodeOrganizationV1 =
  | { kind: "add_new_node_top_level"; node: NewNodeRefV1; order: SemanticSameLevelOrderV1 }
  | {
      kind: "add_new_node_nested";
      node: NewNodeRefV1;
      parent: NodeRefV1;
      order: "only" | "first" | "last";
    }
  | { kind: "place_new_source_at_target_position"; source: NewNodeRefV1; target: ExistingNodeRefV1 }
  | { kind: "keep_existing_node"; node: ExistingNodeRefV1 }
  | {
      kind: "move_existing_node";
      node: ExistingNodeRefV1;
      destination_parent: NodeRefV1;
      order: "only" | "first" | "last";
      accepted_effect_id: string;
    };

export interface MaterialEffectV1 {
  effect_id: string;
  kind: "move_existing_node";
  node: ExistingNodeRefV1;
  from_parent: ExistingNodeRefV1 | null;
  destination_parent: NodeRefV1;
  order: "only" | "first" | "last";
  accepted: boolean;
}

export interface ProposedNodeV1 {
  ref: NewNodeRefV1;
  node_type: string;
  node_id: string;
  name: string;
  fields: GuidedFieldValueV1[];
}

export interface ProposedRelationshipV1 {
  from: NodeRefV1;
  triple: EndpointTripleV1;
  to: NodeRefV1;
  fields: GuidedFieldValueV1[];
}

export type GuidedAdditionContentV1 =
  | { kind: "standalone_node"; node: ProposedNodeV1 }
  | { kind: "relationship"; relationship: ProposedRelationshipV1; new_node?: ProposedNodeV1 };

export interface CompletedAdditionProposalV1 {
  kind: "sdd-addition-proposal";
  proposal_version: "1.0";
  proposal_id: string;
  document_context: {
    document_ref: string;
    path?: string;
    document_precondition?: "must_not_exist";
    base_revision: DocumentRevision;
    bundle_fingerprint: BundleFingerprint;
  };
  intent: {
    addition_kind: "standalone_node" | "relationship";
    direction?: "outgoing" | "incoming";
    selection_order?: "relationship_first" | "existing_node_first";
  };
  guidance_context: {
    diagram_filters: Array<{ browse_id: string; diagram_id: string | null }>;
    display_profile_id: string;
  };
  addition: GuidedAdditionContentV1;
  node_organization: SemanticNodeOrganizationV1[];
  accepted_material_effects: MaterialEffectV1[];
}

export interface GuidedPageContentV1 {
  title: string;
  prompt?: string;
  lines: string[];
}

export interface GuidedChoiceV1 {
  choice_id: string;
  display: string;
  description?: string;
  chosen: string;
  recommended: boolean;
  action: GuidedAdditionActionV1;
}

export type GuidedChoicePageKindV1 =
  | "choose_addition_kind"
  | "browse_starting_node"
  | "choose_relationship_route"
  | "browse_standalone_node_type"
  | "browse_relationship_combination"
  | "browse_relationship_endpoint"
  | "browse_existing_endpoint"
  | "choose_relationship_for_endpoint"
  | "choose_node_detail_disclosure"
  | "choose_relationship_detail_disclosure"
  | "choose_new_target_organization"
  | "choose_existing_target_organization"
  | "choose_new_source_organization"
  | "choose_sibling_order"
  | "choose_same_level_order"
  | "confirm_material_effect"
  | "browse_diagram_filter";

export interface GuidedChoicePageV1 {
  page_id: string;
  page_kind: GuidedChoicePageKindV1;
  content: GuidedPageContentV1;
  choices: GuidedChoiceV1[];
}

export interface GuidedFormPageV1 {
  page_id: string;
  page_kind: "edit_new_node" | "edit_relationship_details";
  content: GuidedPageContentV1;
  fields: GuidedFieldDefinitionV1[];
  submit_action:
    | { kind: "submit_new_node_fields"; local_node_id: "node_1"; field_group: "primary" | "additional" }
    | { kind: "submit_relationship_fields"; local_edge_id: "edge_1"; field_group: "required" | "additional" };
}

export type GuidedPageV1 = GuidedChoicePageV1 | GuidedFormPageV1;

export interface RelationshipDraftV1 {
  route: RelationshipRouteV1;
  anchor: ExistingNodeRefV1;
  triple?: EndpointTripleV1;
  candidate_triples?: EndpointTripleV1[];
  remote_endpoint?: NodeRefV1;
  new_node?: ProposedNodeV1;
  relationship_fields: GuidedFieldValueV1[];
  node_organization: SemanticNodeOrganizationV1[];
  pending_effect?: MaterialEffectV1;
}

export type GuidedProgressV1 =
  | { kind: "choose_addition_kind" }
  | { kind: "browse_starting_node" }
  | { kind: "choose_relationship_route"; anchor: ExistingNodeRefV1 }
  | { kind: "browse_diagram_filter"; browse_id: string; return_progress: Exclude<GuidedProgressV1, { kind: "browse_diagram_filter" }> }
  | { kind: "standalone.browse_node_type" }
  | { kind: "standalone.edit_primary"; node_type: string }
  | { kind: "standalone.choose_details"; node: ProposedNodeV1 }
  | { kind: "standalone.edit_additional"; node: ProposedNodeV1 }
  | { kind: "standalone.choose_order"; node: ProposedNodeV1 }
  | { kind: "standalone.ready"; node: ProposedNodeV1; node_organization: SemanticNodeOrganizationV1[] }
  | { kind: "relationship_first.browse_combination"; route: RelationshipRouteV1; anchor: ExistingNodeRefV1 }
  | { kind: "relationship_first.browse_endpoint"; draft: RelationshipDraftV1 }
  | { kind: "existing_node_first.browse_endpoint"; route: RelationshipRouteV1; anchor: ExistingNodeRefV1 }
  | { kind: "existing_node_first.choose_relationship"; draft: RelationshipDraftV1 }
  | { kind: "relationship.edit_new_node"; draft: RelationshipDraftV1; node_type: string }
  | { kind: "relationship.choose_node_details"; draft: RelationshipDraftV1 }
  | { kind: "relationship.edit_node_details"; draft: RelationshipDraftV1 }
  | { kind: "relationship.choose_details"; draft: RelationshipDraftV1 }
  | { kind: "relationship.edit_details"; draft: RelationshipDraftV1 }
  | { kind: "relationship.choose_organization"; draft: RelationshipDraftV1 }
  | { kind: "relationship.choose_order"; draft: RelationshipDraftV1; order_context: "nested" | "top_level" }
  | { kind: "relationship.confirm_effect"; draft: RelationshipDraftV1 }
  | { kind: "relationship.ready"; draft: RelationshipDraftV1 };

export interface GuidedAdditionStateV1 {
  kind: "sdd-guided-addition-state";
  workflow_version: "1.0";
  document_context: {
    document_ref: string;
    document_precondition?: "must_not_exist";
    revision: DocumentRevision;
    bundle_fingerprint: BundleFingerprint;
  };
  anchor?: ExistingNodeRefV1;
  browse_filters: Record<string, { diagram_id: string | null }>;
  progress: GuidedProgressV1;
  accepted_material_effects: MaterialEffectV1[];
}

export type GuidedAdditionActionV1 =
  | { kind: "choose_addition_kind"; addition_kind: "standalone_node" | "relationship" }
  | { kind: "choose_starting_node"; node: ExistingNodeRefV1 }
  | {
      kind: "choose_relationship_route";
      direction: "outgoing" | "incoming";
      selection_order: "relationship_first" | "existing_node_first";
    }
  | { kind: "open_diagram_filter"; browse_id: string }
  | { kind: "set_diagram_filter"; browse_id: string; diagram_id: string }
  | { kind: "clear_diagram_filter"; browse_id: string }
  | { kind: "choose_standalone_node_type"; node_type: string }
  | { kind: "choose_relationship_combination"; triple: EndpointTripleV1 }
  | { kind: "choose_existing_endpoint"; node: ExistingNodeRefV1; triple?: EndpointTripleV1 }
  | { kind: "create_new_endpoint"; node_type: string }
  | { kind: "choose_relationship_for_endpoint"; triple: EndpointTripleV1 }
  | {
      kind: "submit_new_node_fields";
      local_node_id: "node_1";
      field_group: "primary" | "additional";
      values: GuidedFieldValueV1[];
    }
  | {
      kind: "submit_relationship_fields";
      local_edge_id: "edge_1";
      field_group: "required" | "additional";
      values: GuidedFieldValueV1[];
    }
  | { kind: "set_node_detail_disclosure"; disclose: boolean }
  | { kind: "set_relationship_detail_disclosure"; disclose: boolean }
  | { kind: "choose_new_target_organization"; organization: "nested" | "top_level" }
  | { kind: "choose_existing_target_organization"; organization: "move_under_source" | "leave_current" }
  | { kind: "choose_new_source_organization"; organization: "wrap_target" | "leave_target_current" }
  | { kind: "choose_sibling_order"; order: "first" | "last" }
  | { kind: "choose_same_level_order"; order: SemanticSameLevelOrderV1 }
  | { kind: "confirm_material_effect"; effect_id: string }
  | { kind: "go_back"; target_page_id: string };

export interface GuidedProposalReviewV1 {
  title: "Review proposed addition";
  lines: string[];
}

export type GuidedAdditionResultV1 =
  | {
      kind: "sdd-guided-addition-step";
      api_version: "1.0";
      state: GuidedAdditionStateV1;
      page: GuidedPageV1;
      diagnostics: Diagnostic[];
    }
  | {
      kind: "sdd-guided-addition-complete";
      api_version: "1.0";
      state: GuidedAdditionStateV1;
      proposal: CompletedAdditionProposalV1;
      review: GuidedProposalReviewV1;
      diagnostics: Diagnostic[];
    };

export interface BeginGuidedAdditionRequestV1 {
  workflow_version: "1.0";
  anchor?: ExistingNodeRefV1;
}

export interface GuidedAdditionRuntimeV1 {
  begin(snapshot: GuidedDocumentSnapshot, request: BeginGuidedAdditionRequestV1): GuidedAdditionResultV1;
  advance(
    snapshot: GuidedDocumentSnapshot,
    state: GuidedAdditionStateV1,
    action: GuidedAdditionActionV1
  ): GuidedAdditionResultV1;
}

export class GuidedAdditionV1DomainError extends Error {
  readonly code: string;
  readonly diagnostics: Diagnostic[];
  readonly state?: GuidedAdditionStateV1;

  constructor(code: string, message: string, diagnostics: Diagnostic[], state?: GuidedAdditionStateV1) {
    super(message);
    this.name = "GuidedAdditionV1DomainError";
    this.code = code;
    this.diagnostics = diagnostics;
    this.state = state;
  }
}
