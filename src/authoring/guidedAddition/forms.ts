import type { ProfileRule, RuleLogic } from "../../bundle/types.js";
import type { Diagnostic } from "../../types.js";
import type { ValueKind } from "../contracts.js";
import type { GuidanceCatalog, GuidanceNodeTypeRecord, GuidanceRelationshipRecord } from "./catalog.js";
import type { GuidedDocumentSnapshot } from "./sharedContracts.js";

export interface GuidedFieldDefinition {
  field_id: string;
  source: "node_id" | "name" | "node_property" | "edge_event" | "edge_guard" | "edge_effect" | "edge_property";
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

export interface GuidedNodeFieldValues {
  node_id: string;
  name: string;
  properties: Array<{ key: string; value_kind: ValueKind; raw_value: string }>;
}

export interface GuidedEdgeFieldValues {
  event?: string | null;
  guard?: string | null;
  effect?: string | null;
  props: Record<string, string>;
}

interface JsonSchemaRecord {
  [key: string]: unknown;
}

export interface NormalizedNodeFieldsResult {
  fields: GuidedNodeFieldValues;
  diagnostics: Diagnostic[];
}

export interface NormalizedEdgeFieldsResult {
  fields: GuidedEdgeFieldValues;
  diagnostics: Diagnostic[];
}

function isRecord(value: unknown): value is JsonSchemaRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function schemaDefinition(catalog: GuidanceCatalog, name: string): JsonSchemaRecord | undefined {
  const definitions = catalog.schema.$defs;
  return isRecord(definitions) && isRecord(definitions[name]) ? definitions[name] : undefined;
}

function schemaPattern(catalog: GuidanceCatalog, name: string): string | undefined {
  const definition = schemaDefinition(catalog, name);
  return typeof definition?.pattern === "string" ? definition.pattern : undefined;
}

function nodeNameMinimum(catalog: GuidanceCatalog): number {
  const node = schemaDefinition(catalog, "node");
  const properties = isRecord(node?.properties) ? node.properties : undefined;
  const name = properties && isRecord(properties.name) ? properties.name : undefined;
  return typeof name?.minLength === "number" ? name.minLength : 1;
}

function ruleForProperty(
  catalog: GuidanceCatalog,
  profileId: string | undefined,
  nodeType: string,
  property: string
): ProfileRule | undefined {
  const profile = catalog.getProfile(profileId ?? catalog.default_display_profile_id);
  return profile?.rules.find((rule) => {
    const logic = rule.rule_logic;
    return logic?.node_type === nodeType && logic.property === property;
  });
}

function buildDelimitedKeyValuePattern(logic: RuleLogic): string | undefined {
  const delimiter = typeof logic.delimiter === "string" ? logic.delimiter : undefined;
  const entryDelimiter = typeof logic.entry_delimiter === "string" ? logic.entry_delimiter : undefined;
  const keyPattern = typeof logic.key_pattern === "string" ? logic.key_pattern : undefined;
  const valuePattern = typeof logic.value_pattern === "string" ? logic.value_pattern : undefined;
  if (!delimiter || !entryDelimiter || !keyPattern || !valuePattern) {
    return undefined;
  }
  const stripAnchors = (pattern: string): string => pattern.replace(/^\^/, "").replace(/\$$/, "");
  const separator = escapeRegExp(delimiter);
  const pairSeparator = escapeRegExp(entryDelimiter);
  const pair = `(?:${stripAnchors(keyPattern)})${pairSeparator}(?:${stripAnchors(valuePattern)})`;
  return `^${pair}(?:${separator}${pair})*$`;
}

function fieldFormat(rule: ProfileRule | undefined): Pick<
  GuidedFieldDefinition,
  "format" | "allowed_values" | "pattern" | "allowed_target_types"
> {
  const logic = rule?.rule_logic;
  if (!logic) {
    return { format: "free_text" };
  }
  if (logic.kind === "enum_property" && Array.isArray(logic.allowed_values)) {
    return {
      format: "enum",
      allowed_values: logic.allowed_values.filter((value): value is string => typeof value === "string")
    };
  }
  if (logic.kind === "pattern_property" && typeof logic.pattern === "string") {
    return { format: "pattern", pattern: logic.pattern };
  }
  if (logic.kind === "delimited_key_value_property") {
    const pattern = buildDelimitedKeyValuePattern(logic);
    return pattern ? { format: "pattern", pattern } : { format: "free_text" };
  }
  if (logic.kind === "node_reference_property" || logic.kind === "delimited_node_references") {
    const targets = Array.isArray(logic.allowed_target_types)
      ? logic.allowed_target_types
      : typeof logic.target_type === "string"
        ? [logic.target_type]
        : [];
    return {
      format: "node_reference",
      ...(targets.length > 0
        ? { allowed_target_types: targets.filter((value): value is string => typeof value === "string") }
        : {})
    };
  }
  return { format: "free_text" };
}

function descriptorSource(source: string): GuidedFieldDefinition["source"] {
  if (source === "node_id" || source === "name") {
    return source;
  }
  return "node_property";
}

export function createNodeFieldDefinitions(
  catalog: GuidanceCatalog,
  nodeType: GuidanceNodeTypeRecord,
  profileId?: string
): GuidedFieldDefinition[] {
  return [...nodeType.form.common_fields, ...nodeType.form.type_fields].map((descriptor) => {
    const source = descriptorSource(descriptor.source);
    const property = descriptor.property;
    const format =
      source === "node_id"
        ? { format: "sdd_node_id" as const, pattern: schemaPattern(catalog, "id") ?? catalog.syntax.id_pattern }
        : source === "name"
          ? { format: "non_empty_text" as const }
          : fieldFormat(property ? ruleForProperty(catalog, profileId, nodeType.node_type, property) : undefined);
    return {
      field_id: property ? `node_property:${property}` : source,
      source,
      ...(property ? { property } : {}),
      ...(descriptor.label ? { label: descriptor.label } : {}),
      ...(descriptor.description ? { description: descriptor.description } : {}),
      ...(descriptor.input_hint ? { input_hint: descriptor.input_hint } : {}),
      value_kind: source === "node_id" ? "bare_value" : "quoted_string",
      required: source === "node_id" || source === "name",
      prominence: descriptor.prominence,
      ...format
    };
  });
}

function edgeAnnotationSource(annotation: string): GuidedFieldDefinition["source"] {
  return `edge_${annotation}` as GuidedFieldDefinition["source"];
}

export function createEdgeFieldDefinitions(relationship: GuidanceRelationshipRecord): GuidedFieldDefinition[] {
  const annotations = relationship.edge_fields.annotations.map((annotation) => ({
    field_id: `edge_annotation:${annotation}`,
    source: edgeAnnotationSource(annotation),
    property: annotation,
    value_kind: "quoted_string" as const,
    required: false,
    prominence: "advanced" as const,
    format: "free_text" as const
  }));
  const properties = relationship.edge_fields.properties.map((property) => ({
    field_id: `edge_property:${property}`,
    source: "edge_property" as const,
    property,
    value_kind: "quoted_string" as const,
    required: relationship.required_edge_properties.includes(property),
    prominence: "advanced" as const,
    format: "free_text" as const
  }));
  return [...annotations, ...properties];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function suggestNodeId(
  snapshot: GuidedDocumentSnapshot,
  nodeType: GuidanceNodeTypeRecord,
  proposalLocalIds: Iterable<string> = []
): string {
  if (nodeType.id_suggestion.sequence_policy !== "max_numeric_plus_one") {
    throw new Error(`Unsupported guided node ID sequence policy '${nodeType.id_suggestion.sequence_policy}'`);
  }
  const used = new Set([...snapshot.nodes.map((node) => node.node_id), ...proposalLocalIds]);
  const prefix = nodeType.id_suggestion.prefix;
  const numeric = new RegExp(`^${escapeRegExp(prefix)}-(\\d+)`);
  let greatest = 0;
  for (const id of used) {
    const match = numeric.exec(id);
    if (match) {
      greatest = Math.max(greatest, Number.parseInt(match[1], 10));
    }
  }
  let next = greatest + 1;
  let suggested = `${prefix}-${String(next).padStart(nodeType.id_suggestion.minimum_digits, "0")}`;
  while (used.has(suggested)) {
    next += 1;
    suggested = `${prefix}-${String(next).padStart(nodeType.id_suggestion.minimum_digits, "0")}`;
  }
  return suggested;
}

function diagnostic(
  snapshot: GuidedDocumentSnapshot,
  code: string,
  severity: Diagnostic["severity"],
  message: string
): Diagnostic {
  return {
    stage: "authoring",
    code,
    severity,
    message,
    file: snapshot.path ?? snapshot.document_ref
  };
}

function validateValueKind(
  catalog: GuidanceCatalog,
  snapshot: GuidedDocumentSnapshot,
  valueKind: ValueKind,
  rawValue: string,
  label: string
): Diagnostic[] {
  if (valueKind !== "quoted_string" && valueKind !== "bare_value") {
    return [diagnostic(snapshot, "guided_addition.invalid_field_value", "error", `${label} has an unavailable value kind`)];
  }
  if (valueKind !== "bare_value") {
    return [];
  }
  return new RegExp(catalog.syntax.bare_value_pattern).test(rawValue)
    ? []
    : [diagnostic(snapshot, "guided_addition.invalid_field_value", "error", `${label} is not a valid bare value`)] ;
}

function validatePropertyFormat(
  catalog: GuidanceCatalog,
  snapshot: GuidedDocumentSnapshot,
  nodeType: string,
  definition: GuidedFieldDefinition,
  rawValue: string,
  profileId?: string
): Diagnostic[] {
  if (definition.format === "enum" && !definition.allowed_values?.includes(rawValue)) {
    return [diagnostic(snapshot, "guided_addition.invalid_field_value", "error", `${definition.property} is not an allowed value`)];
  }
  if (definition.format === "pattern" && definition.pattern && !new RegExp(definition.pattern).test(rawValue)) {
    return [diagnostic(snapshot, "guided_addition.invalid_field_value", "error", `${definition.property} does not match its required format`)];
  }
  if (definition.format !== "node_reference") {
    return [];
  }
  const rule = definition.property ? ruleForProperty(catalog, profileId, nodeType, definition.property) : undefined;
  const delimiter = typeof rule?.rule_logic?.delimiter === "string" ? rule.rule_logic.delimiter : undefined;
  const ids = delimiter ? rawValue.split(delimiter).map((value) => value.trim()).filter(Boolean) : [rawValue];
  const idPattern = typeof rule?.rule_logic?.id_pattern === "string"
    ? rule.rule_logic.id_pattern
    : schemaPattern(catalog, "id") ?? catalog.syntax.id_pattern;
  const nodesById = new Map(snapshot.nodes.map((node) => [node.node_id, node]));
  const invalid = ids.find((id) => {
    const node = nodesById.get(id);
    return !new RegExp(idPattern).test(id) || !node ||
      (definition.allowed_target_types?.length && !definition.allowed_target_types.includes(node.node_type));
  });
  return invalid
    ? [diagnostic(snapshot, "guided_addition.invalid_field_value", "error", `${definition.property} contains unavailable node reference '${invalid}'`)]
    : [];
}

export function normalizeAndValidateNodeFields(
  catalog: GuidanceCatalog,
  snapshot: GuidedDocumentSnapshot,
  nodeType: GuidanceNodeTypeRecord,
  values: GuidedNodeFieldValues,
  profileId?: string
): NormalizedNodeFieldsResult {
  const definitions = createNodeFieldDefinitions(catalog, nodeType, profileId);
  const diagnostics: Diagnostic[] = [];
  const idPattern = schemaPattern(catalog, "id") ?? catalog.syntax.id_pattern;
  if (!values.node_id || !new RegExp(idPattern).test(values.node_id)) {
    diagnostics.push(diagnostic(snapshot, "guided_addition.invalid_node_id", "error", "Node ID violates the bundle schema format"));
  } else if (snapshot.nodes.some((node) => node.node_id === values.node_id)) {
    diagnostics.push(diagnostic(snapshot, "guided_addition.node_id_collision", "error", `Node ID '${values.node_id}' already exists`));
  }
  const expectedPrefix = `${nodeType.id_suggestion.prefix}-`;
  if (values.node_id && !values.node_id.startsWith(expectedPrefix)) {
    diagnostics.push(diagnostic(snapshot, "guided_addition.node_id_prefix_mismatch", "warn", `Node ID does not use the suggested '${nodeType.id_suggestion.prefix}' prefix`));
  }
  if (values.name.trim().length < nodeNameMinimum(catalog)) {
    diagnostics.push(diagnostic(snapshot, "guided_addition.required_field_missing", "error", "Node name is required"));
  }

  const definitionsByProperty = new Map(
    definitions.filter((field) => field.source === "node_property" && field.property).map((field) => [field.property!, field])
  );
  const seen = new Set<string>();
  const properties: GuidedNodeFieldValues["properties"] = [];
  for (const property of values.properties) {
    const definition = definitionsByProperty.get(property.key);
    if (!definition || seen.has(property.key)) {
      diagnostics.push(diagnostic(snapshot, "guided_addition.choice_unavailable", "error", `Node property '${property.key}' is not currently offered`));
      continue;
    }
    seen.add(property.key);
    if (property.raw_value === "") {
      continue;
    }
    diagnostics.push(...validateValueKind(catalog, snapshot, property.value_kind, property.raw_value, property.key));
    diagnostics.push(...validatePropertyFormat(catalog, snapshot, nodeType.node_type, definition, property.raw_value, profileId));
    properties.push({ ...property });
  }

  return {
    fields: { node_id: values.node_id, name: values.name, properties },
    diagnostics
  };
}

export function normalizeAndValidateEdgeFields(
  snapshot: GuidedDocumentSnapshot,
  relationship: GuidanceRelationshipRecord,
  values: GuidedEdgeFieldValues
): NormalizedEdgeFieldsResult {
  const supportedAnnotations = new Set(relationship.edge_fields.annotations);
  const annotationValues: Record<string, string | null | undefined> = {
    event: values.event,
    guard: values.guard,
    effect: values.effect
  };
  const diagnostics: Diagnostic[] = [];
  for (const [annotation, value] of Object.entries(annotationValues)) {
    if (value != null && value !== "" && !supportedAnnotations.has(annotation)) {
      diagnostics.push(diagnostic(snapshot, "guided_addition.choice_unavailable", "error", `Edge annotation '${annotation}' is not currently offered`));
    }
  }

  const supportedProperties = new Set(relationship.edge_fields.properties);
  const props: Record<string, string> = {};
  for (const property of relationship.edge_fields.properties) {
    const value = values.props[property];
    if (value !== undefined && value !== "") {
      props[property] = value;
    }
  }
  for (const property of Object.keys(values.props)) {
    if (!supportedProperties.has(property)) {
      diagnostics.push(diagnostic(snapshot, "guided_addition.choice_unavailable", "error", `Edge property '${property}' is not currently offered`));
    }
  }
  for (const property of relationship.required_edge_properties) {
    if (!props[property]) {
      diagnostics.push(diagnostic(snapshot, "guided_addition.required_field_missing", "error", `Edge property '${property}' is required`));
    }
  }

  const normalize = (annotation: string): string | null => {
    const value = annotationValues[annotation];
    return supportedAnnotations.has(annotation) && value ? value : null;
  };
  return {
    fields: {
      event: normalize("event"),
      guard: normalize("guard"),
      effect: normalize("effect"),
      props
    },
    diagnostics
  };
}
