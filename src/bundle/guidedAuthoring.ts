import type {
  AuthoringConfig,
  AuthoringFieldDescriptor,
  Bundle,
  GuidedDisplayRule,
  GuidedViewRelationship,
  RelationshipAuthoringConfig
} from "./types.js";

export interface AllowedEndpointTriple {
  from: string;
  type: string;
  to: string;
}

export interface NodeIdSuggestionInputs {
  node_type: string;
  prefix: string;
  sequence_policy: AuthoringConfig["node_id_suggestions"]["sequence_policy"];
  minimum_digits: number;
}

export interface EdgeFieldSupport {
  annotations: string[];
  properties: string[];
}

export interface NodeAuthoringForm {
  common_fields: AuthoringFieldDescriptor[];
  type_fields: AuthoringFieldDescriptor[];
}

export interface GuidedViewDefinition {
  view_id: string;
  name: string;
  included_node_types: string[];
  profile_aliases: Record<string, string>;
  relationships: GuidedViewRelationship[];
}

export interface GuidedDisplayContext {
  document_node_types?: Iterable<string>;
}

export interface ResolvedGuidedRelationshipDisplay {
  profile_id: string;
  resolved_profile_id: string;
  rule: GuidedDisplayRule;
}

export class GuidedAdditionUnsupportedBundleError extends Error {
  readonly code = "guided_addition.unsupported_bundle";

  constructor() {
    super("The loaded bundle does not declare guided authoring metadata");
    this.name = "GuidedAdditionUnsupportedBundleError";
  }
}

function requireAuthoring(bundle: Bundle): AuthoringConfig {
  if (!bundle.authoring) {
    throw new GuidedAdditionUnsupportedBundleError();
  }
  return bundle.authoring;
}

function tripleKey(triple: AllowedEndpointTriple): string {
  return `${triple.from}\u0000${triple.type}\u0000${triple.to}`;
}

export function hasGuidedAdditionSupport(bundle: Bundle): boolean {
  return bundle.authoring !== undefined;
}

export function getGuidedAdditionDefaultDisplayProfileId(bundle: Bundle): string {
  return requireAuthoring(bundle).guided_addition.default_display_profile_id;
}

export function listAllowedEndpointTriples(bundle: Bundle): AllowedEndpointTriple[] {
  return bundle.contracts.relationships.flatMap((relationship) =>
    relationship.allowed_endpoints.map((endpoint) => ({
      from: endpoint.from,
      type: relationship.type,
      to: endpoint.to
    }))
  );
}

export function getNodeIdSuggestionInputs(bundle: Bundle, nodeType: string): NodeIdSuggestionInputs | undefined {
  const suggestions = requireAuthoring(bundle).node_id_suggestions;
  const prefix = suggestions.prefix_by_type[nodeType];
  return prefix
    ? {
        node_type: nodeType,
        prefix,
        sequence_policy: suggestions.sequence_policy,
        minimum_digits: suggestions.minimum_digits
      }
    : undefined;
}

function cloneField(descriptor: AuthoringFieldDescriptor): AuthoringFieldDescriptor {
  return { ...descriptor };
}

export function getNodeAuthoringForm(bundle: Bundle, nodeType: string): NodeAuthoringForm | undefined {
  const authoring = requireAuthoring(bundle);
  const form = authoring.node_forms.by_type[nodeType];
  if (!form) {
    return undefined;
  }
  return {
    common_fields: authoring.node_forms.common_fields.map(cloneField),
    type_fields: form.properties.map(cloneField)
  };
}

export function getRelationshipAuthoringSemantics(
  bundle: Bundle,
  relationshipType: string
): RelationshipAuthoringConfig | undefined {
  requireAuthoring(bundle);
  const value = bundle.contracts.relationships.find((relationship) => relationship.type === relationshipType)?.authoring;
  return value ? { ...value } : undefined;
}

export function getRelationshipEdgeFieldSupport(bundle: Bundle, relationshipType: string): EdgeFieldSupport | undefined {
  requireAuthoring(bundle);
  const relationship = bundle.contracts.relationships.find((candidate) => candidate.type === relationshipType);
  const logic = relationship?.constraints.find((constraint) => constraint.rule_logic?.kind === "edge_field_support")?.rule_logic;
  if (!logic) {
    return undefined;
  }
  return {
    annotations: Array.isArray(logic.annotations) ? logic.annotations.filter((value): value is string => typeof value === "string") : [],
    properties: Array.isArray(logic.properties) ? logic.properties.filter((value): value is string => typeof value === "string") : []
  };
}

export function getRelationshipRequiredEdgeProperties(bundle: Bundle, relationshipType: string): string[] | undefined {
  requireAuthoring(bundle);
  const relationship = bundle.contracts.relationships.find((candidate) => candidate.type === relationshipType);
  if (!relationship) {
    return undefined;
  }
  return relationship.constraints.flatMap((constraint) =>
    constraint.rule_logic?.kind === "required_edge_property" && typeof constraint.rule_logic.property === "string"
      ? [constraint.rule_logic.property]
      : []
  );
}

export function getPlacementPolicyInputs(bundle: Bundle): AuthoringConfig["placement_policies"]["default"] {
  return { ...requireAuthoring(bundle).placement_policies.default };
}

export function listGuidedViewRelationships(bundle: Bundle, viewId: string): GuidedViewRelationship[] | undefined {
  requireAuthoring(bundle);
  const guided = bundle.views.views.find((view) => view.id === viewId)?.conventions.guided_addition;
  return guided?.relationships.map((relationship) => ({
    ...relationship,
    display_by_profile: Object.fromEntries(
      Object.entries(relationship.display_by_profile).map(([profile, rules]) => [
        profile,
        rules.map((rule) => ({ ...rule, when: rule.when ? { ...rule.when } : undefined }))
      ])
    )
  }));
}

export function listGuidedViewDefinitions(bundle: Bundle): GuidedViewDefinition[] {
  requireAuthoring(bundle);
  return bundle.views.views.map((view) => ({
    view_id: view.id,
    name: view.name,
    included_node_types: [...view.projection.include_node_types],
    profile_aliases: { ...(view.conventions.guided_addition?.profile_aliases ?? {}) },
    relationships: listGuidedViewRelationships(bundle, view.id) ?? []
  }));
}

function resolveAlias(aliases: Record<string, string> | undefined, profileId: string): string {
  let current = profileId;
  const visited = new Set<string>();
  while (aliases?.[current]) {
    if (visited.has(current)) {
      throw new Error(`Guided display profile alias cycle at '${current}'`);
    }
    visited.add(current);
    current = aliases[current];
  }
  return current;
}

function predicateMatches(rule: GuidedDisplayRule, documentNodeTypes: Set<string>): boolean {
  if (!rule.when) {
    return true;
  }
  return rule.when.kind === "document_has_node_type" && documentNodeTypes.has(rule.when.node_type);
}

export function resolveGuidedRelationshipDisplay(
  bundle: Bundle,
  viewId: string,
  triple: AllowedEndpointTriple,
  profileId: string,
  context: GuidedDisplayContext = {}
): ResolvedGuidedRelationshipDisplay {
  requireAuthoring(bundle);
  const view = bundle.views.views.find((candidate) => candidate.id === viewId);
  const guided = view?.conventions.guided_addition;
  if (!guided) {
    throw new Error(`View '${viewId}' does not declare guided addition metadata`);
  }

  const relationship = guided.relationships.find((candidate) => tripleKey(candidate) === tripleKey(triple));
  if (!relationship) {
    throw new Error(`View '${viewId}' does not declare guided display for '${triple.from} ${triple.type} ${triple.to}'`);
  }

  const resolvedProfileId = resolveAlias(guided.profile_aliases, profileId);
  const rules = relationship.display_by_profile[resolvedProfileId];
  if (!rules) {
    throw new Error(`View '${viewId}' does not declare guided display profile '${resolvedProfileId}'`);
  }

  const documentNodeTypes = new Set(context.document_node_types ?? []);
  const rule = rules.find((candidate) => predicateMatches(candidate, documentNodeTypes));
  if (!rule) {
    throw new Error(`View '${viewId}' has no matching guided display rule for profile '${resolvedProfileId}'`);
  }

  return {
    profile_id: profileId,
    resolved_profile_id: resolvedProfileId,
    rule: { ...rule, when: rule.when ? { ...rule.when } : undefined }
  };
}
