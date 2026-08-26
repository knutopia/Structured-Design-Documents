import type { Severity } from "../types.js";

export interface BundleManifestProfileEntry {
  id: string;
  path: string;
  intent: string;
}

export interface BundleManifestRenderDetailEntry {
  id: string;
  intent: string;
}

export interface BundleManifestExample {
  path: string;
  compiled_snapshot: string;
  projection_snapshots?: string[];
}

export interface BundleManifestToolDefaults {
  validation_profile_id: string;
  render_detail_id: string;
}

export interface BundleManifest {
  bundle_name: string;
  bundle_version: string;
  language: string;
  language_version: string;
  core: {
    vocab: string;
    syntax: string;
    schema: string;
    contracts: string;
    projection_schema: string;
    views: string;
    authoring?: string;
  };
  tool_defaults: BundleManifestToolDefaults;
  profiles: BundleManifestProfileEntry[];
  render_details: BundleManifestRenderDetailEntry[];
  examples: BundleManifestExample[];
  compatibility: {
    requires_compiler_min: string;
    notes: string[];
  };
}

export interface VocabularyToken {
  token: string;
  group?: string;
  description?: string;
}

export interface Vocabulary {
  version: string;
  closed_vocab: boolean;
  node_types: VocabularyToken[];
  relationship_types: VocabularyToken[];
  aliases_informative?: Record<string, string | null>;
}

export interface SyntaxParsingModel {
  style: string;
  case_sensitive: boolean;
  indentation_semantic: boolean;
  line_oriented: boolean;
  block_terminated_by_end: boolean;
}

export interface SyntaxTokenSource {
  path: string;
  key: string;
  token_field: string;
}

export type SyntaxTokenSources = Record<string, SyntaxTokenSource>;

export interface SyntaxLexicalEscape {
  literal: string;
  value: string;
}

export interface SyntaxQuotedStringConfig {
  delimiter: string;
  multiline: boolean;
  standardized_escapes: SyntaxLexicalEscape[];
  other_backslash_sequences: string;
}

export interface SyntaxLexicalConfig {
  newline_sequences: string[];
  whitespace_chars: string[];
  leading_whitespace_ignored: boolean;
  trailing_whitespace_ignored: boolean;
  comment_prefix: string;
  trailing_comments_allowed: string[];
  identifier_pattern: string;
  id_pattern: string;
  version_number_pattern: string;
  bare_value_pattern: string;
  quoted_string: SyntaxQuotedStringConfig;
}

export interface SyntaxDocumentVersionDeclaration {
  allowed: boolean;
  required: boolean;
  literal: string;
  statement_kind: string;
  default_effective_version: string;
  post_parse_supported_versions: string[];
}

export interface SyntaxDocumentConfig {
  version_declaration: SyntaxDocumentVersionDeclaration;
  leading_lines_allowed: string[];
  top_level_block_kind: string;
  trailing_lines_allowed: string[];
  minimum_top_level_blocks: number;
}

export interface SyntaxClassifierTrimmedEquals {
  trimmed_equals: string;
}

export interface SyntaxClassifierFirstNonWhitespace {
  first_non_whitespace: string;
}

export interface SyntaxClassifierFirstTokenSource {
  first_token_source: string;
}

export interface SyntaxClassifierNextTokenSource {
  next_token_source: string;
}

export interface SyntaxClassifierLeadingIdentifierBeforeEquals {
  leading_identifier_before_equals: boolean;
}

export interface SyntaxClassifierAnyOf {
  any_of: SyntaxLineClassifierClause[];
}

export type SyntaxLineClassifierClause =
  | SyntaxClassifierTrimmedEquals
  | SyntaxClassifierFirstNonWhitespace
  | SyntaxClassifierFirstTokenSource
  | SyntaxClassifierNextTokenSource
  | SyntaxClassifierLeadingIdentifierBeforeEquals
  | SyntaxClassifierAnyOf;

export interface SyntaxLineKindDefinition {
  precedence: number;
  kind: string;
  statement?: string;
  statements?: string[];
  classifier: SyntaxLineClassifierClause;
}

export interface SyntaxLiteralSequenceItem {
  literal: string;
}

export interface SyntaxWhitespaceSequenceItem {
  whitespace: "required" | "optional";
}

export interface SyntaxEnclosureSpec {
  open: string;
  close: string;
  trim_inner_whitespace: boolean;
  inner_atom: string;
}

export interface SyntaxChoiceAlternative {
  atom?: string;
  pattern_ref?: string;
  value_kind?: string;
}

export interface SyntaxCapturePatternSequenceItem {
  capture: string;
  pattern_ref: string;
}

export interface SyntaxCaptureTokenSourceSequenceItem {
  capture: string;
  token_source: string;
}

export interface SyntaxCaptureAtomSequenceItem {
  capture: string;
  atom: string;
}

export interface SyntaxCaptureOneOfSequenceItem {
  capture: string;
  one_of: SyntaxChoiceAlternative[];
}

export interface SyntaxCaptureEnclosureSequenceItem {
  capture: string;
  enclosure: SyntaxEnclosureSpec;
}

export type SyntaxCaptureSequenceItem =
  | SyntaxCapturePatternSequenceItem
  | SyntaxCaptureTokenSourceSequenceItem
  | SyntaxCaptureAtomSequenceItem
  | SyntaxCaptureOneOfSequenceItem
  | SyntaxCaptureEnclosureSequenceItem;

export interface SyntaxOptionalSequenceItem {
  optional: SyntaxSequenceItem[];
}

export interface SyntaxRepeatSpec {
  separator: SyntaxWhitespaceSequenceItem;
  capture: string;
  atom: string;
}

export interface SyntaxRepeatSequenceItem {
  repeat: SyntaxRepeatSpec;
}

export type SyntaxSequenceItem =
  | SyntaxLiteralSequenceItem
  | SyntaxWhitespaceSequenceItem
  | SyntaxCaptureSequenceItem
  | SyntaxOptionalSequenceItem
  | SyntaxRepeatSequenceItem;

export interface SyntaxEmitConstValue {
  const: string;
}

export type SyntaxEmitFieldValue = string | SyntaxEmitConstValue;

export interface SyntaxEmitDefinition {
  kind: string;
  fields?: Record<string, SyntaxEmitFieldValue>;
  defaults?: Record<string, unknown>;
}

export interface SyntaxStatementDefinition {
  role: string;
  leading_whitespace?: "ignored";
  trailing_whitespace?: "ignored";
  trailing_comment?: "allowed";
  fixed_order?: string[];
  sequence?: SyntaxSequenceItem[];
  match?: SyntaxLineClassifierClause;
  emits?: SyntaxEmitDefinition;
}

export type SyntaxStatementsConfig = Record<string, SyntaxStatementDefinition>;

export interface SyntaxBlockDefinition {
  header_statement: string;
  body_item_kinds: string[];
  terminator_statement: string;
  emits: SyntaxEmitDefinition;
}

export type SyntaxBlocksConfig = Record<string, SyntaxBlockDefinition>;

export interface SyntaxChoiceAtomDefinition {
  one_of: SyntaxChoiceAlternative[];
}

export interface SyntaxGuardTextAtomDefinition {
  terminator: string;
  line_breaks_allowed: boolean;
  raw_text_preserved: boolean;
  accepts_any_character_except: string[];
}

export interface SyntaxSequenceAtomDefinition {
  sequence: SyntaxSequenceItem[];
  emits: SyntaxEmitDefinition;
}

export type SyntaxAtomDefinition =
  | SyntaxChoiceAtomDefinition
  | SyntaxGuardTextAtomDefinition
  | SyntaxSequenceAtomDefinition;

export type SyntaxAtomsConfig = Record<string, SyntaxAtomDefinition>;

export interface SyntaxBoundariesConfig {
  excluded_from_syntax_scope: string[];
  notes: string[];
}

export interface SyntaxNormalizedNodeContract {
  kind: string;
  fields?: string[];
  defaults?: Record<string, unknown>;
  item_kinds?: string[];
  header_kinds?: string[];
  body_item_kinds?: string[];
  value_kinds?: string[];
}

export interface SyntaxPreservedStatementNodeContract {
  kind: string;
}

export interface SyntaxParseOutputContract {
  normalized_nodes: SyntaxNormalizedNodeContract[];
  preserved_statement_nodes: SyntaxPreservedStatementNodeContract[];
}

export interface SyntaxConfig {
  version: string;
  artifact: string;
  parsing_model: SyntaxParsingModel;
  token_sources: SyntaxTokenSources;
  lexical: SyntaxLexicalConfig;
  document: SyntaxDocumentConfig;
  line_kinds: SyntaxLineKindDefinition[];
  statements: SyntaxStatementsConfig;
  blocks: SyntaxBlocksConfig;
  atoms: SyntaxAtomsConfig;
  boundaries: SyntaxBoundariesConfig;
  parse_output_contract: SyntaxParseOutputContract;
}

export interface RuleLogic {
  kind: string;
  loop_annotation_target?: "edge" | "node";
  loop_annotation_prop?: string;
  loop_annotation_value?: string;
  loop_annotation_coverage?: "each_cyclic_component" | "any_cyclic_component";
  [key: string]: unknown;
}

export type AuthoringGraphRole = "structural" | "ordering" | "reference" | "dependency" | "behavioral" | "data";

export type AuthoringSourceRepresentation = "edge_line";

export type AuthoringSourceOrganization = "nest_target_under_source" | "same_level" | "unconstrained";

export interface RelationshipAuthoringConfig {
  graph_role: AuthoringGraphRole;
  source_representation: AuthoringSourceRepresentation;
  source_organization: AuthoringSourceOrganization;
}

export interface ContractRule {
  id: string;
  description?: string;
  severity_by_profile?: Record<string, Severity>;
  rule_logic?: RuleLogic;
}

export interface DotPreviewStyleConfig {
  font_family?: string;
  font_asset?: string;
  svg_font_asset?: string;
  png_font_asset?: string;
  dpi?: number;
}

export interface StagedPreviewFontFaceConfig {
  font_weight: number;
  measurement_font_asset?: string;
  svg_font_asset?: string;
  png_font_asset?: string;
}

export interface StagedPreviewStyleConfig {
  font_family?: string;
  font_faces?: StagedPreviewFontFaceConfig[];
  width_bands?: {
    chip?: number;
    narrow?: number;
    standard?: number;
    wide?: number;
  };
  dpi?: number;
}

export interface PreviewDefaultsConfig {
  dot?: DotPreviewStyleConfig;
  staged?: StagedPreviewStyleConfig;
}

export interface RendererSemanticColumnConfig {
  id: string;
  label: string;
}

export interface RendererSemanticColumnsConfig {
  fixed_order?: RendererSemanticColumnConfig[];
  node_type_columns?: Record<string, string>;
}

export interface RendererNodeChromeConfig {
  visual_role?: string;
  legacy_dot_shape?: string;
  [key: string]: unknown;
}

export interface RendererConnectorLabelConfig {
  visible?: boolean;
  text?: string;
  [key: string]: unknown;
}

export interface RendererConnectorChannelConfig {
  channel?: string;
  label?: RendererConnectorLabelConfig;
  [key: string]: unknown;
}

export interface RendererConnectorsConfig {
  edge_type_channels?: Record<string, RendererConnectorChannelConfig>;
  priority_order?: string[];
  [key: string]: unknown;
}

export interface RendererBatchApplicabilityConfig {
  kind: "visible_semantic_node_count";
  minimum: number;
}

export interface RendererScenarioFlowLaneConfig {
  id: "step" | "place" | "view_state";
  label: string;
  node_types: string[];
}

export interface RendererScenarioFlowLayoutConfig {
  primary_lane_id: "step" | "place" | "view_state";
  lanes: RendererScenarioFlowLaneConfig[];
  empty_lane_policy: "omit" | "show";
  component_order: "source";
  component_gap_rows: number;
  branch_order: "source";
}

export interface RendererDefaultsConfig {
  preview?: PreviewDefaultsConfig;
  semantic_columns?: RendererSemanticColumnsConfig;
  node_chrome?: Record<string, RendererNodeChromeConfig>;
  connectors?: RendererConnectorsConfig;
  batch_applicability?: RendererBatchApplicabilityConfig;
  scenario_flow_layout?: RendererScenarioFlowLayoutConfig;
  [key: string]: unknown;
}

export interface RelationshipContract {
  type: string;
  meaning?: string;
  authoring?: RelationshipAuthoringConfig;
  allowed_endpoints: Array<{
    from: string;
    to: string;
  }>;
  constraints: ContractRule[];
}

export type GuidedRelationshipRole = "primary" | "supporting" | "bridge";

export type GuidedRelationshipPresence = "connector" | "structural" | "annotation" | "hidden";

export type GuidedRelationshipLabel = "visible" | "hidden" | "not_applicable";

export interface GuidedDocumentHasNodeTypePredicate {
  kind: "document_has_node_type";
  node_type: string;
}

export type GuidedDisplayPredicate = GuidedDocumentHasNodeTypePredicate;

export interface GuidedDisplayRule {
  when?: GuidedDisplayPredicate;
  presence: GuidedRelationshipPresence;
  label: GuidedRelationshipLabel;
  explanation?: string;
}

export interface GuidedViewRelationship {
  from: string;
  type: string;
  to: string;
  role: GuidedRelationshipRole;
  display_by_profile: Record<string, GuidedDisplayRule[]>;
}

export interface GuidedAdditionViewConfig {
  profile_aliases?: Record<string, string>;
  relationships: GuidedViewRelationship[];
}

export interface ContractsConfig {
  version: string;
  common_rules: ContractRule[];
  relationships: RelationshipContract[];
}

export interface ViewSpec {
  id: string;
  name: string;
  status: string;
  projection: {
    include_node_types: string[];
    include_edge_types: string[];
    hierarchy_edges: string[];
    ordering_edges: string[];
  };
  conventions: {
    normative_defaults?: Array<{
      id: string;
      description: string;
    }>;
    renderer_defaults?: RendererDefaultsConfig;
    guided_addition?: GuidedAdditionViewConfig;
  };
}

export interface ViewsConfig {
  version: string;
  preview_defaults?: PreviewDefaultsConfig;
  views: ViewSpec[];
}

export interface ProfileRule {
  id: string;
  source: string;
  severity: Severity;
  applies_to?: string;
  required_props?: Record<string, string[]>;
  prefix_map?: Record<string, string>;
  bundle_refs?: Record<string, BundleFieldReference>;
  authoritative_field?: string;
  requirement?: string;
  derived_edge_policy?: Record<string, unknown>;
  rule_logic?: RuleLogic;
  [key: string]: unknown;
}

export interface BundleFieldReference {
  artifact: string;
  selector: string;
}

export type AuthoringFieldSource = "node_id" | "name" | "property";

export type AuthoringFieldProminence = "primary" | "advanced";

export interface AuthoringFieldDescriptor {
  source: AuthoringFieldSource;
  property?: string;
  prominence: AuthoringFieldProminence;
  label?: string;
  description?: string;
  input_hint?: string;
}

export interface AuthoringNodeForm {
  properties: AuthoringFieldDescriptor[];
}

export interface AuthoringConfig {
  version: string;
  guided_addition: {
    default_display_profile_id: string;
    warning_messages: {
      duplicate_edge: {
        default: string;
        by_relationship: Record<string, string>;
      };
    };
    edge_field_labels: Record<string, string>;
  };
  node_id_suggestions: {
    sequence_policy: "max_numeric_plus_one";
    minimum_digits: number;
    prefix_by_type: Record<string, string>;
  };
  node_forms: {
    common_fields: AuthoringFieldDescriptor[];
    by_type: Record<string, AuthoringNodeForm>;
  };
  placement_policies: {
    default: {
      fallback: "last";
      outgoing_sequence: "after_anchor";
      incoming_sequence: "before_anchor";
      structural_new_target: "nested_last";
      structural_existing_target: "reparent_with_confirmation";
      edge_in_source_body: "after_relationships_before_nested_nodes" | "last";
      edge_to_name_hint: "target_name";
    };
  };
}

export interface ProfileConfig {
  id: string;
  version: string;
  extends: string;
  intent: string;
  severity_defaults?: Record<string, Severity>;
  rules: ProfileRule[];
}

export type JsonSchema = Record<string, unknown>;

export interface Bundle {
  rootDir: string;
  manifestPath: string;
  manifest: BundleManifest;
  vocab: Vocabulary;
  syntax: SyntaxConfig;
  schema: JsonSchema;
  projectionSchema: JsonSchema;
  contracts: ContractsConfig;
  views: ViewsConfig;
  profiles: Record<string, ProfileConfig>;
  authoring?: AuthoringConfig;
}
