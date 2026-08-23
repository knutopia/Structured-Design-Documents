import { sortDiagnostics } from "../diagnostics/types.js";
import type { Diagnostic } from "../types.js";
import { resolveBundleFieldReference, resolveProfileRuleField } from "./bundleReferences.js";
import type {
  AuthoringFieldDescriptor,
  Bundle,
  GuidedDisplayRule,
  ProfileRule,
  RuleLogic
} from "./types.js";

const GRAPH_ROLES = new Set(["structural", "ordering", "reference", "dependency", "behavioral", "data"]);
const SOURCE_REPRESENTATIONS = new Set(["edge_line"]);
const SOURCE_ORGANIZATIONS = new Set(["nest_target_under_source", "same_level", "unconstrained"]);
const GUIDED_ROLES = new Set(["primary", "supporting", "bridge"]);
const DISPLAY_PRESENCES = new Set(["connector", "structural", "annotation", "hidden"]);
const DISPLAY_LABELS = new Set(["visible", "hidden", "not_applicable"]);
const EDGE_ANNOTATION_FIELDS = new Set(["event", "guard", "effect"]);
const SUPPORTED_PREDICATES = new Set(["document_has_node_type"]);

function tripleKey(from: string, type: string, to: string): string {
  return `${from}\u0000${type}\u0000${to}`;
}

function sameStringSet(left: Iterable<string>, right: Iterable<string>): boolean {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return leftSet.size === rightSet.size && [...leftSet].every((value) => rightSet.has(value));
}

function strings(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : undefined;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function duplicateValues(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }
  return [...duplicates].sort();
}

function caseInsensitiveTokenCollisions(bundle: Bundle): Array<{ source: string; tokens: string[] }> {
  if (bundle.syntax.parsing_model.case_sensitive) {
    return [];
  }

  const vocabulary = bundle.vocab as unknown as Record<string, unknown>;
  const collisions: Array<{ source: string; tokens: string[] }> = [];
  for (const [source, config] of Object.entries(bundle.syntax.token_sources)) {
    const entries = vocabulary[config.key];
    if (!Array.isArray(entries)) {
      continue;
    }

    const byFoldedValue = new Map<string, Set<string>>();
    for (const entry of entries) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        continue;
      }
      const token = (entry as Record<string, unknown>)[config.token_field];
      if (typeof token !== "string") {
        continue;
      }
      const folded = token.toLowerCase();
      const values = byFoldedValue.get(folded) ?? new Set<string>();
      values.add(token);
      byFoldedValue.set(folded, values);
    }

    for (const tokens of byFoldedValue.values()) {
      if (tokens.size > 1) {
        collisions.push({ source, tokens: [...tokens].sort() });
      }
    }
  }

  return collisions.sort((left, right) =>
    left.source.localeCompare(right.source) || left.tokens.join("\0").localeCompare(right.tokens.join("\0"))
  );
}

export class BundleValidationError extends Error {
  readonly code = "bundle.invalid";
  readonly diagnostics: Diagnostic[];

  constructor(diagnostics: Diagnostic[]) {
    const sorted = sortDiagnostics(diagnostics);
    super(`Loaded bundle is invalid (${sorted.length} diagnostic${sorted.length === 1 ? "" : "s"})`);
    this.name = "BundleValidationError";
    this.diagnostics = sorted;
  }
}

function expectedNodeProperties(bundle: Bundle): Map<string, Set<string>> {
  const result = new Map(bundle.vocab.node_types.map(({ token }) => [token, new Set<string>()]));

  for (const profile of Object.values(bundle.profiles)) {
    for (const rule of profile.rules) {
      for (const [nodeType, properties] of Object.entries(rule.required_props ?? {})) {
        const set = result.get(nodeType);
        for (const property of properties) {
          set?.add(property);
        }
      }

      const logic = rule.rule_logic;
      if (!logic) {
        continue;
      }
      const nodeType = typeof logic.node_type === "string" ? logic.node_type : undefined;
      if (nodeType && typeof logic.property === "string") {
        result.get(nodeType)?.add(logic.property);
      }
      if (nodeType && typeof logic.marker_property === "string") {
        result.get(nodeType)?.add(logic.marker_property);
      }
    }
  }

  return result;
}

function validateFieldDescriptor(
  descriptor: AuthoringFieldDescriptor,
  label: string,
  add: (code: string, message: string) => void
): void {
  if (!(["node_id", "name", "property"] as unknown[]).includes(descriptor.source)) {
    add("bundle.authoring.invalid_field_source", `${label} has unknown source '${String(descriptor.source)}'`);
  }
  if (!(["primary", "advanced"] as unknown[]).includes(descriptor.prominence)) {
    add("bundle.authoring.invalid_field_prominence", `${label} has unknown prominence '${String(descriptor.prominence)}'`);
  }
  if (descriptor.source === "property" && !descriptor.property) {
    add("bundle.authoring.missing_property_reference", `${label} uses source 'property' without a property name`);
  }
  if (descriptor.source !== "property" && descriptor.property !== undefined) {
    add("bundle.authoring.unexpected_property_reference", `${label} may declare a property only when source is 'property'`);
  }
}

function validateBundleReferences(bundle: Bundle, add: (code: string, message: string) => void): void {
  for (const [profileId, profile] of Object.entries(bundle.profiles)) {
    for (const rule of profile.rules) {
      for (const [field, reference] of Object.entries(rule.bundle_refs ?? {})) {
        if (Object.prototype.hasOwnProperty.call(rule, field)) {
          add(
            "bundle.reference.inline_conflict",
            `Profile '${profileId}' rule '${rule.id}' declares both inline '${field}' and bundle_refs.${field}`
          );
        }
        if (!reference || typeof reference.artifact !== "string" || typeof reference.selector !== "string") {
          add("bundle.reference.invalid", `Profile '${profileId}' rule '${rule.id}' has an invalid reference for '${field}'`);
          continue;
        }
        if (resolveBundleFieldReference(bundle, reference) === undefined) {
          add(
            "bundle.reference.unresolved",
            `Profile '${profileId}' rule '${rule.id}' cannot resolve '${reference.artifact}#${reference.selector}'`
          );
        }
      }
    }
  }
}

function validateDisplayRules(
  bundle: Bundle,
  viewId: string,
  triple: string,
  profileId: string,
  rules: GuidedDisplayRule[],
  nodeTypes: Set<string>,
  add: (code: string, message: string) => void
): void {
  const label = `View '${viewId}' triple '${triple}' profile '${profileId}'`;
  if (!Array.isArray(rules) || rules.length === 0) {
    add("bundle.guided_view.empty_display_rules", `${label} must declare at least one display rule`);
    return;
  }

  rules.forEach((rule, index) => {
    if (!DISPLAY_PRESENCES.has(rule.presence)) {
      add("bundle.guided_view.unknown_presence", `${label} has unknown presence '${String(rule.presence)}'`);
    }
    if (!DISPLAY_LABELS.has(rule.label)) {
      add("bundle.guided_view.unknown_label", `${label} has unknown label '${String(rule.label)}'`);
    }
    if (index < rules.length - 1 && !rule.when) {
      add("bundle.guided_view.unreachable_display_rule", `${label} has an unconditional rule before the end of the list`);
    }
    if (index === rules.length - 1 && rule.when) {
      add("bundle.guided_view.missing_unconditional_rule", `${label} must end with an unconditional display rule`);
    }
    if (rule.when) {
      if (!SUPPORTED_PREDICATES.has(rule.when.kind)) {
        add("bundle.guided_view.unknown_predicate", `${label} uses unknown predicate '${String(rule.when.kind)}'`);
      }
      if (!nodeTypes.has(rule.when.node_type)) {
        add(
          "bundle.guided_view.unknown_predicate_node_type",
          `${label} predicate references unknown node type '${rule.when.node_type}'`
        );
      }
    }
  });
}

function validateProfileAliases(
  viewId: string,
  aliases: Record<string, string>,
  profileIds: Set<string>,
  add: (code: string, message: string) => void
): void {
  for (const [alias, target] of Object.entries(aliases)) {
    if (!profileIds.has(alias)) {
      add("bundle.guided_view.unknown_alias_profile", `View '${viewId}' aliases unknown profile '${alias}'`);
    }
    if (!profileIds.has(target)) {
      add("bundle.guided_view.unknown_alias_target", `View '${viewId}' alias '${alias}' targets unknown profile '${target}'`);
    }

    const visited = new Set<string>();
    let current: string | undefined = alias;
    while (current && aliases[current]) {
      if (visited.has(current)) {
        add("bundle.guided_view.alias_cycle", `View '${viewId}' has a profile alias cycle containing '${current}'`);
        break;
      }
      visited.add(current);
      current = aliases[current];
    }
  }
}

export function collectBundleDiagnostics(bundle: Bundle): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const add = (code: string, message: string): void => {
    diagnostics.push({
      stage: "bundle",
      code,
      severity: "error",
      message,
      file: bundle.manifestPath
    });
  };

  const nodeTokens = bundle.vocab.node_types.map(({ token }) => token);
  const relationshipTokens = bundle.vocab.relationship_types.map(({ token }) => token);
  const nodeTypes = new Set(nodeTokens);
  const relationshipTypes = new Set(relationshipTokens);

  for (const collision of caseInsensitiveTokenCollisions(bundle)) {
    add(
      "bundle.syntax.case_insensitive_token_collision",
      `Token source '${collision.source}' has case-insensitive collision between ${collision.tokens
        .map((token) => `'${token}'`)
        .join(" and ")}`
    );
  }

  for (const duplicate of duplicateValues(nodeTokens)) {
    add("bundle.vocab.duplicate_node_type", `Node type '${duplicate}' is declared more than once`);
  }
  for (const duplicate of duplicateValues(relationshipTokens)) {
    add("bundle.vocab.duplicate_relationship_type", `Relationship type '${duplicate}' is declared more than once`);
  }

  const contractRelationshipTypes = bundle.contracts.relationships.map(({ type }) => type);
  for (const duplicate of duplicateValues(contractRelationshipTypes)) {
    add("bundle.contracts.duplicate_relationship", `Relationship contract '${duplicate}' is declared more than once`);
  }
  if (!sameStringSet(contractRelationshipTypes, relationshipTokens)) {
    add("bundle.contracts.relationship_coverage", "Relationship contracts must cover the relationship vocabulary exactly");
  }

  const triples: string[] = [];
  for (const relationship of bundle.contracts.relationships) {
    if (!relationshipTypes.has(relationship.type)) {
      add("bundle.contracts.unknown_relationship", `Relationship contract uses unknown token '${relationship.type}'`);
    }
    for (const endpoint of relationship.allowed_endpoints) {
      if (!nodeTypes.has(endpoint.from)) {
        add(
          "bundle.contracts.unknown_endpoint_node_type",
          `Relationship '${relationship.type}' has unknown from node type '${endpoint.from}'`
        );
      }
      if (!nodeTypes.has(endpoint.to)) {
        add(
          "bundle.contracts.unknown_endpoint_node_type",
          `Relationship '${relationship.type}' has unknown to node type '${endpoint.to}'`
        );
      }
      triples.push(tripleKey(endpoint.from, relationship.type, endpoint.to));
    }
  }
  for (const duplicate of duplicateValues(triples)) {
    add("bundle.contracts.duplicate_endpoint_triple", `Allowed endpoint triple '${duplicate.replaceAll("\u0000", " ")}' is duplicated`);
  }

  const declaredProfileIds = bundle.manifest.profiles.map(({ id }) => id);
  const profileIds = new Set(declaredProfileIds);
  for (const duplicate of duplicateValues(declaredProfileIds)) {
    add("bundle.profiles.duplicate_manifest_id", `Manifest profile '${duplicate}' is declared more than once`);
  }
  if (!sameStringSet(Object.keys(bundle.profiles), declaredProfileIds)) {
    add("bundle.profiles.loaded_coverage", "Loaded profiles must match manifest profile declarations exactly");
  }

  const renderDetailEntries = Array.isArray(bundle.manifest.render_details)
    ? bundle.manifest.render_details
    : undefined;
  const declaredRenderDetailIds: string[] = [];
  if (!renderDetailEntries) {
    add("bundle.render_details.shape", "render_details must be an array");
  } else {
    for (const [index, rawEntry] of renderDetailEntries.entries()) {
      const entry = record(rawEntry);
      if (!entry || !sameStringSet(Object.keys(entry), ["id", "intent"])) {
        add("bundle.render_details.shape", `render_details[${index}] must contain exactly id and intent`);
        continue;
      }
      const id = entry.id;
      if (typeof id !== "string" || id.trim().length === 0) {
        add("bundle.render_details.invalid_id", `render_details[${index}].id must be a non-empty string`);
      } else {
        declaredRenderDetailIds.push(id);
      }
      if (typeof entry.intent !== "string" || entry.intent.trim().length === 0) {
        add("bundle.render_details.invalid_intent", `Render detail '${String(id)}' must have a non-empty intent`);
      }
    }
    for (const duplicate of duplicateValues(declaredRenderDetailIds)) {
      add("bundle.render_details.duplicate_id", `Render detail '${duplicate}' is declared more than once`);
    }
  }
  const renderDetailIds = new Set(declaredRenderDetailIds);

  const toolDefaults = record(bundle.manifest.tool_defaults);
  if (!toolDefaults || !sameStringSet(Object.keys(toolDefaults), ["validation_profile_id", "render_detail_id"])) {
    add(
      "bundle.tool_defaults.shape",
      "tool_defaults must contain exactly validation_profile_id and render_detail_id"
    );
  }
  if (toolDefaults) {
    const validationProfileId = toolDefaults.validation_profile_id;
    if (typeof validationProfileId !== "string" || validationProfileId.trim().length === 0) {
      add(
        "bundle.tool_defaults.invalid_validation_profile_id",
        "tool_defaults.validation_profile_id must be a non-empty string"
      );
    } else if (!profileIds.has(validationProfileId)) {
      add(
        "bundle.tool_defaults.unknown_validation_profile",
        `Tool validation profile '${validationProfileId}' is not declared by the bundle`
      );
    }
    const renderDetailId = toolDefaults.render_detail_id;
    if (typeof renderDetailId !== "string" || renderDetailId.trim().length === 0) {
      add(
        "bundle.tool_defaults.invalid_render_detail_id",
        "tool_defaults.render_detail_id must be a non-empty string"
      );
    } else if (!renderDetailIds.has(renderDetailId)) {
      add(
        "bundle.tool_defaults.unknown_render_detail",
        `Tool render detail '${renderDetailId}' is not declared by the bundle`
      );
    }
  }

  for (const view of bundle.views.views) {
    if (view.conventions.renderer_defaults === undefined) {
      continue;
    }
    const rendererDefaults = record(view.conventions.renderer_defaults);
    const detailDisplay = record(rendererDefaults?.detail_display);
    if (!rendererDefaults || !detailDisplay) {
      add(
        "bundle.render_details.policy_shape",
        `Rendering view '${view.id}' must declare renderer_defaults.detail_display as an object`
      );
      continue;
    }
    for (const policyId of Object.keys(detailDisplay)) {
      if (!renderDetailIds.has(policyId)) {
        add(
          "bundle.render_details.unknown_policy_id",
          `Rendering view '${view.id}' declares policy for unknown render detail '${policyId}'`
        );
      }
    }
    for (const detailId of declaredRenderDetailIds) {
      if (!Object.prototype.hasOwnProperty.call(detailDisplay, detailId)) {
        add(
          "bundle.render_details.policy_coverage",
          `Rendering view '${view.id}' is missing detail_display policy '${detailId}'`
        );
        continue;
      }
      const policy = record(detailDisplay[detailId]);
      if (!policy) {
        add(
          "bundle.render_details.policy_shape",
          `Rendering view '${view.id}' detail_display.${detailId} must be an object`
        );
        continue;
      }
      for (const [setting, value] of Object.entries(policy)) {
        if (typeof value !== "boolean") {
          add(
            "bundle.render_details.invalid_display_value",
            `Rendering view '${view.id}' detail_display.${detailId}.${setting} must be boolean`
          );
        }
      }
    }
  }

  validateBundleReferences(bundle, add);

  if (!bundle.authoring) {
    return sortDiagnostics(diagnostics);
  }

  const authoring = bundle.authoring;
  if (!sameStringSet(Object.keys(authoring), ["version", "guided_addition", "node_id_suggestions", "node_forms", "placement_policies"])) {
    add("bundle.authoring.artifact_shape", "Authoring artifact must contain only the declared v0.1 sections");
  }
  const guidedAddition = record(authoring.guided_addition);
  if (!guidedAddition || !sameStringSet(Object.keys(guidedAddition), ["default_display_profile_id", "warning_messages", "edge_field_labels"])) {
    add("bundle.authoring.guided_addition_shape", "guided_addition has unexpected or missing fields");
  }
  const defaultDisplayProfileId = typeof guidedAddition?.default_display_profile_id === "string"
    ? guidedAddition.default_display_profile_id
    : "";
  if (!profileIds.has(defaultDisplayProfileId)) {
    add(
      "bundle.authoring.unknown_default_display_profile",
      `Guided Addition default display profile '${defaultDisplayProfileId}' is not declared by the bundle`
    );
  }
  const warningMessages = record(guidedAddition?.warning_messages);
  const duplicateEdge = record(warningMessages?.duplicate_edge);
  const duplicateDefault = duplicateEdge?.default;
  const duplicateOverrides = record(duplicateEdge?.by_relationship);
  if (!warningMessages || !sameStringSet(Object.keys(warningMessages), ["duplicate_edge"])) {
    add("bundle.authoring.warning_messages_shape", "guided_addition.warning_messages must contain only duplicate_edge");
  }
  if (!duplicateEdge || !sameStringSet(Object.keys(duplicateEdge), ["default", "by_relationship"])) {
    add("bundle.authoring.duplicate_edge_warning_shape", "duplicate_edge warning metadata has unexpected or missing fields");
  }
  const validateWarningTemplate = (
    value: unknown,
    label: string,
    requiredPlaceholders: string[]
  ): void => {
    if (typeof value !== "string" || value.trim().length === 0) {
      add("bundle.authoring.invalid_warning_template", `${label} must be a non-empty string`);
      return;
    }
    const placeholders = [...value.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1]!);
    const allowed = new Set(["source", "relationship", "target"]);
    const unmatchedBraces = value.replaceAll(/\{[^{}]+\}/g, "").includes("{") ||
      value.replaceAll(/\{[^{}]+\}/g, "").includes("}");
    if (unmatchedBraces || placeholders.some((placeholder) => !allowed.has(placeholder))) {
      add("bundle.authoring.invalid_warning_placeholder", `${label} contains an unsupported placeholder`);
    }
    for (const placeholder of requiredPlaceholders) {
      if (!placeholders.includes(placeholder)) {
        add("bundle.authoring.missing_warning_placeholder", `${label} must contain {${placeholder}}`);
      }
    }
  };
  validateWarningTemplate(duplicateDefault, "The default duplicate-edge warning", ["source", "relationship", "target"]);
  if (!duplicateOverrides) {
    add("bundle.authoring.duplicate_edge_warning_overrides", "duplicate_edge.by_relationship must be an object");
  } else {
    const relationshipTypes = new Set(bundle.contracts.relationships.map((relationship) => relationship.type));
    for (const [relationshipType, template] of Object.entries(duplicateOverrides)) {
      if (!relationshipTypes.has(relationshipType)) {
        add("bundle.authoring.unknown_warning_relationship", `Duplicate-edge warning references unknown relationship '${relationshipType}'`);
      }
      validateWarningTemplate(template, `Duplicate-edge warning for '${relationshipType}'`, ["source", "target"]);
    }
  }
  const edgeFieldLabels = record(guidedAddition?.edge_field_labels);
  const expectedEdgeFields = new Set<string>();
  for (const relationship of bundle.contracts.relationships) {
    for (const constraint of relationship.constraints) {
      const logic = constraint.rule_logic;
      if (logic?.kind === "edge_field_support") {
        (strings(logic.annotations) ?? []).forEach((value) => expectedEdgeFields.add(value));
        (strings(logic.properties) ?? []).forEach((value) => expectedEdgeFields.add(value));
      }
    }
  }
  if (!edgeFieldLabels || !sameStringSet(Object.keys(edgeFieldLabels), [...expectedEdgeFields])) {
    add("bundle.authoring.edge_field_label_coverage", "guided_addition.edge_field_labels must cover every supported edge field exactly");
  } else {
    for (const [field, label] of Object.entries(edgeFieldLabels)) {
      if (typeof label !== "string" || label.trim().length === 0) {
        add("bundle.authoring.invalid_edge_field_label", `Guided edge field '${field}' must have a non-empty label`);
      }
    }
  }
  if (
    !sameStringSet(Object.keys(authoring.node_id_suggestions), ["sequence_policy", "minimum_digits", "prefix_by_type"])
  ) {
    add("bundle.authoring.id_suggestion_shape", "node_id_suggestions has unexpected or missing fields");
  }
  if (authoring.node_id_suggestions.sequence_policy !== "max_numeric_plus_one") {
    add(
      "bundle.authoring.unknown_sequence_policy",
      `Unknown node ID sequence policy '${String(authoring.node_id_suggestions.sequence_policy)}'`
    );
  }
  if (!Number.isInteger(authoring.node_id_suggestions.minimum_digits) || authoring.node_id_suggestions.minimum_digits < 1) {
    add("bundle.authoring.invalid_minimum_digits", "node_id_suggestions.minimum_digits must be a positive integer");
  }

  if (!sameStringSet(Object.keys(authoring.node_id_suggestions.prefix_by_type), nodeTokens)) {
    add("bundle.authoring.prefix_coverage", "Authoring ID prefixes must cover the node vocabulary exactly");
  }
  for (const [nodeType, prefix] of Object.entries(authoring.node_id_suggestions.prefix_by_type)) {
    if (!nodeTypes.has(nodeType)) {
      add("bundle.authoring.unknown_prefix_node_type", `Authoring ID prefix references unknown node type '${nodeType}'`);
    }
    if (typeof prefix !== "string" || prefix.length === 0) {
      add("bundle.authoring.invalid_prefix", `Authoring ID prefix for '${nodeType}' must be a non-empty string`);
    }
  }
  for (const duplicate of duplicateValues(Object.values(authoring.node_id_suggestions.prefix_by_type))) {
    add("bundle.authoring.duplicate_prefix", `Authoring ID prefix '${duplicate}' is assigned to more than one node type`);
  }

  if (!sameStringSet(Object.keys(authoring.node_forms), ["common_fields", "by_type"])) {
    add("bundle.authoring.node_forms_shape", "node_forms has unexpected or missing fields");
  }

  const commonFields = authoring.node_forms.common_fields;
  commonFields.forEach((descriptor, index) => validateFieldDescriptor(descriptor, `Common authoring field ${index}`, add));
  const commonSources = commonFields.map((descriptor) =>
    descriptor.source === "property" ? `property:${descriptor.property ?? ""}` : descriptor.source
  );
  if (!sameStringSet(commonSources, ["node_id", "name", "property:description"])) {
    add("bundle.authoring.common_field_coverage", "Common authoring fields must be node_id, name, and property description");
  }
  if (commonFields.some((descriptor) => descriptor.prominence !== "primary")) {
    add("bundle.authoring.common_field_prominence", "All common authoring fields must be primary");
  }

  if (!sameStringSet(Object.keys(authoring.node_forms.by_type), nodeTokens)) {
    add("bundle.authoring.form_coverage", "Authoring node forms must cover the node vocabulary exactly");
  }

  const knownProperties = expectedNodeProperties(bundle);
  const commonProperties = new Set(
    commonFields.filter((descriptor) => descriptor.source === "property" && descriptor.property).map((descriptor) => descriptor.property!)
  );
  for (const nodeType of nodeTokens) {
    const form = authoring.node_forms.by_type[nodeType];
    if (!form) {
      continue;
    }
    if (!sameStringSet(Object.keys(form), ["properties"])) {
      add("bundle.authoring.node_form_shape", `Authoring form for '${nodeType}' has unexpected or missing fields`);
    }
    form.properties.forEach((descriptor, index) =>
      validateFieldDescriptor(descriptor, `Authoring field ${nodeType}[${index}]`, add)
    );
    if (form.properties.some((descriptor) => descriptor.source !== "property" || descriptor.prominence !== "advanced")) {
      add("bundle.authoring.advanced_field_shape", `Authoring fields for '${nodeType}' must be advanced property fields`);
    }
    const expected = [...(knownProperties.get(nodeType) ?? [])].filter((property) => !commonProperties.has(property));
    const actual = form.properties.map((descriptor) => descriptor.property ?? "");
    if (!sameStringSet(actual, expected)) {
      add(
        "bundle.authoring.property_coverage",
        `Authoring properties for '${nodeType}' must match bundle-known properties (expected: ${expected.sort().join(", ")})`
      );
    }
    for (const duplicate of duplicateValues(actual)) {
      add("bundle.authoring.duplicate_property", `Authoring property '${nodeType}.${duplicate}' is declared more than once`);
    }
  }

  if (!sameStringSet(Object.keys(authoring.placement_policies), ["default"])) {
    add("bundle.authoring.placement_policies_shape", "placement_policies must contain only the default policy");
  }
  const placement = authoring.placement_policies.default;
  const supportedPlacementValues: Record<string, readonly string[]> = {
    fallback: ["last"],
    outgoing_sequence: ["after_anchor"],
    incoming_sequence: ["before_anchor"],
    structural_new_target: ["nested_last"],
    structural_existing_target: ["reparent_with_confirmation"],
    edge_in_source_body: ["after_relationships_before_nested_nodes", "last"],
    edge_to_name_hint: ["target_name"]
  };
  if (!sameStringSet(Object.keys(placement), Object.keys(supportedPlacementValues))) {
    add("bundle.authoring.placement_policy_shape", "The default placement policy has unexpected or missing fields");
  }
  for (const [field, supported] of Object.entries(supportedPlacementValues)) {
    const actual = (placement as unknown as Record<string, unknown>)[field];
    if (!supported.includes(String(actual))) {
      add(
        "bundle.authoring.unknown_placement_policy_value",
        `Default placement field '${field}' must use a supported v0.1 value (${supported.join(", ")})`
      );
    }
  }

  for (const [profileId, profile] of Object.entries(bundle.profiles)) {
    for (const rule of profile.rules) {
      if (rule.rule_logic?.kind !== "id_prefix_type_coupling") {
        continue;
      }
      let resolved: Record<string, string> | undefined;
      try {
        resolved = resolveProfileRuleField<Record<string, string>>(bundle, rule, "prefix_map");
      } catch {
        continue;
      }
      if (!resolved || !sameStringSet(Object.keys(resolved), nodeTokens)) {
        add("bundle.authoring.profile_prefix_coverage", `Profile '${profileId}' prefix rule must cover every node type`);
      }
    }
  }

  for (const relationship of bundle.contracts.relationships) {
    const semantics = relationship.authoring;
    if (!semantics) {
      add("bundle.authoring.missing_relationship_semantics", `Relationship '${relationship.type}' lacks authoring semantics`);
    } else {
      if (!sameStringSet(Object.keys(semantics), ["graph_role", "source_representation", "source_organization"])) {
        add("bundle.authoring.relationship_semantics_shape", `Relationship '${relationship.type}' authoring metadata has unexpected fields`);
      }
      if (!GRAPH_ROLES.has(semantics.graph_role)) {
        add("bundle.authoring.unknown_graph_role", `Relationship '${relationship.type}' has unknown graph role '${semantics.graph_role}'`);
      }
      if (!SOURCE_REPRESENTATIONS.has(semantics.source_representation)) {
        add(
          "bundle.authoring.unknown_source_representation",
          `Relationship '${relationship.type}' has unknown source representation '${semantics.source_representation}'`
        );
      }
      if (!SOURCE_ORGANIZATIONS.has(semantics.source_organization)) {
        add(
          "bundle.authoring.unknown_source_organization",
          `Relationship '${relationship.type}' has unknown source organization '${semantics.source_organization}'`
        );
      }
    }

    const supportRules = relationship.constraints.filter((constraint) => constraint.rule_logic?.kind === "edge_field_support");
    if (supportRules.length !== 1) {
      add(
        "bundle.authoring.edge_field_support_coverage",
        `Relationship '${relationship.type}' must declare exactly one edge_field_support rule`
      );
      continue;
    }
    const support = supportRules[0].rule_logic as RuleLogic;
    const annotations = strings(support.annotations);
    const properties = strings(support.properties);
    if (!annotations || !properties) {
      add(
        "bundle.authoring.invalid_edge_field_support",
        `Relationship '${relationship.type}' edge_field_support must declare annotation and property arrays`
      );
      continue;
    }
    for (const annotation of annotations) {
      if (!EDGE_ANNOTATION_FIELDS.has(annotation)) {
        add(
          "bundle.authoring.unknown_edge_annotation",
          `Relationship '${relationship.type}' supports unknown edge annotation '${annotation}'`
        );
      }
    }
    if (duplicateValues(annotations).length > 0 || duplicateValues(properties).length > 0) {
      add("bundle.authoring.duplicate_edge_field", `Relationship '${relationship.type}' declares a supported edge field more than once`);
    }

    for (const constraint of relationship.constraints) {
      const logic = constraint.rule_logic;
      if (logic?.kind === "required_edge_property") {
        if (logic.relationship !== relationship.type) {
          add(
            "bundle.authoring.required_edge_property_relationship",
            `Relationship '${relationship.type}' required_edge_property rule must reference its owning relationship`
          );
        }
        if (typeof logic.property !== "string" || !properties.includes(logic.property)) {
          add(
            "bundle.authoring.required_edge_property_support",
            `Relationship '${relationship.type}' requires an edge property that is not explicitly supported`
          );
        }
      }
      if (logic?.kind === "optional_annotations") {
        const optional = strings(logic.supports);
        if (!optional || optional.some((field) => !annotations.includes(field))) {
          add(
            "bundle.authoring.optional_annotation_support",
            `Relationship '${relationship.type}' optional annotations must be included in edge_field_support`
          );
        }
      }
    }
  }

  const expectedTriples = new Set(triples);
  for (const view of bundle.views.views) {
    const guided = view.conventions.guided_addition;
    if (!guided) {
      add("bundle.guided_view.missing", `View '${view.id}' lacks guided addition metadata`);
      continue;
    }

    if (!sameStringSet(Object.keys(guided), ["profile_aliases", "relationships"])) {
      add("bundle.guided_view.shape", `View '${view.id}' guided addition metadata has unexpected or missing fields`);
    }

    const aliases = guided.profile_aliases ?? {};
    validateProfileAliases(view.id, aliases, profileIds, add);
    let resolvedDefaultProfile = defaultDisplayProfileId;
    const defaultVisited = new Set<string>();
    while (aliases[resolvedDefaultProfile]) {
      if (defaultVisited.has(resolvedDefaultProfile)) break;
      defaultVisited.add(resolvedDefaultProfile);
      resolvedDefaultProfile = aliases[resolvedDefaultProfile];
    }
    const explicitProfiles = declaredProfileIds.filter((profileId) => aliases[profileId] === undefined);
    const actualTriples = guided.relationships.map((relationship) => tripleKey(relationship.from, relationship.type, relationship.to));
    if (!sameStringSet(actualTriples, expectedTriples)) {
      add("bundle.guided_view.incomplete_triple_coverage", `View '${view.id}' must explicitly cover every allowed endpoint triple`);
    }
    for (const duplicate of duplicateValues(actualTriples)) {
      add(
        "bundle.guided_view.duplicate_triple",
        `View '${view.id}' declares triple '${duplicate.replaceAll("\u0000", " ")}' more than once`
      );
    }

    for (const relationship of guided.relationships) {
      const key = tripleKey(relationship.from, relationship.type, relationship.to);
      const readableTriple = `${relationship.from} ${relationship.type} ${relationship.to}`;
      if (!sameStringSet(Object.keys(relationship), ["from", "type", "to", "role", "display_by_profile"])) {
        add("bundle.guided_view.relationship_shape", `View '${view.id}' triple '${readableTriple}' has unexpected or missing fields`);
      }
      if (!expectedTriples.has(key)) {
        add("bundle.guided_view.unknown_triple", `View '${view.id}' declares unknown triple '${readableTriple}'`);
      }
      if (!GUIDED_ROLES.has(relationship.role)) {
        add("bundle.guided_view.unknown_role", `View '${view.id}' triple '${readableTriple}' has unknown role '${relationship.role}'`);
      }
      if (!sameStringSet(Object.keys(relationship.display_by_profile), explicitProfiles)) {
        add(
          "bundle.guided_view.profile_coverage",
          `View '${view.id}' triple '${readableTriple}' must declare each non-aliased profile exactly`
        );
      }
      if (!relationship.display_by_profile[resolvedDefaultProfile]) {
        add(
          "bundle.guided_view.default_profile_unresolvable",
          `View '${view.id}' triple '${readableTriple}' cannot resolve Guided Addition default profile '${defaultDisplayProfileId}'`
        );
      }
      for (const [profileId, rules] of Object.entries(relationship.display_by_profile)) {
        if (!profileIds.has(profileId)) {
          add(
            "bundle.guided_view.unknown_display_profile",
            `View '${view.id}' triple '${readableTriple}' declares unknown profile '${profileId}'`
          );
        }
        validateDisplayRules(bundle, view.id, readableTriple, profileId, rules, nodeTypes, add);
      }
    }
  }

  return sortDiagnostics(diagnostics);
}

export function validateLoadedBundle(bundle: Bundle): void {
  const diagnostics = collectBundleDiagnostics(bundle);
  if (diagnostics.length > 0) {
    throw new BundleValidationError(diagnostics);
  }
}
