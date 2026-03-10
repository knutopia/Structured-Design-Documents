import type { Severity } from "../types.js";

export interface BundleManifestProfileEntry {
  id: string;
  path: string;
  intent: string;
  default_severity_mode: string;
}

export interface BundleManifestExample {
  path: string;
  compiled_snapshot: string;
  projection_snapshots?: string[];
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
  };
  profiles: BundleManifestProfileEntry[];
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

export interface SyntaxConfig {
  version: string;
  artifact: string;
  lexical: {
    identifier_pattern: string;
    id_pattern: string;
    version_number_pattern: string;
    bare_value_pattern: string;
  };
  document: {
    version_declaration: {
      allowed: boolean;
      required: boolean;
      literal: string;
      default_effective_version: string;
      post_parse_supported_versions: string[];
    };
  };
  line_kinds: Array<{
    kind: string;
    precedence: number;
  }>;
}

export interface RuleLogic {
  kind: string;
  [key: string]: unknown;
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
  dpi?: number;
}

export interface PreviewDefaultsConfig {
  dot?: DotPreviewStyleConfig;
}

export interface RendererDefaultsConfig {
  preview?: PreviewDefaultsConfig;
  [key: string]: unknown;
}

export interface RelationshipContract {
  type: string;
  meaning?: string;
  allowed_endpoints: Array<{
    from: string;
    to: string;
  }>;
  constraints: ContractRule[];
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
  authoritative_field?: string;
  requirement?: string;
  derived_edge_policy?: Record<string, unknown>;
  rule_logic?: RuleLogic;
  [key: string]: unknown;
}

export interface ProfileConfig {
  id: string;
  version: string;
  extends: string;
  intent: string;
  default_severity_mode: string;
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
}
