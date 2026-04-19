import type {
  ContractBindingSpec,
  ContractConstraintSpec,
  ContractContinuationSpec,
  ContractIndex,
  ContractShapeDescriptor,
  ContractShapeId,
  ContractSubjectDescriptor,
  ContractSubjectDetail,
  ContractSubjectId,
  HelperRequestBodySpec
} from "./contracts.js";

type JsonSchema = object;

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

function stringSchema(enumValues?: readonly string[]): JsonSchema {
  return enumValues ? { type: "string", enum: [...enumValues] } : { type: "string" };
}

function integerSchema(): JsonSchema {
  return { type: "integer" };
}

function numberSchema(): JsonSchema {
  return { type: "number" };
}

function booleanSchema(): JsonSchema {
  return { type: "boolean" };
}

function arraySchema(items: JsonSchema): JsonSchema {
  return { type: "array", items };
}

function objectSchema(
  properties: Record<string, JsonSchema>,
  required: string[] = [],
  additionalProperties: boolean | JsonSchema = false
): JsonSchema {
  const schema: Record<string, unknown> = {
    type: "object",
    properties,
    additionalProperties
  };
  if (required.length > 0) {
    schema.required = required;
  }
  return schema;
}

const anySchema: JsonSchema = {};
const stringArraySchema = arraySchema(stringSchema());

const sourceSpanSchema = objectSchema(
  {
    line: numberSchema(),
    column: numberSchema(),
    endLine: numberSchema(),
    endColumn: numberSchema(),
    startOffset: numberSchema(),
    endOffset: numberSchema()
  },
  ["line", "column", "endLine", "endColumn", "startOffset", "endOffset"]
);

const diagnosticSchema = objectSchema(
  {
    stage: stringSchema(["bundle", "parse", "compile", "validate", "project", "render", "cli"]),
    code: stringSchema(),
    severity: stringSchema(["error", "warn", "info"]),
    message: stringSchema(),
    file: stringSchema(),
    span: sourceSpanSchema,
    ruleId: stringSchema(),
    profileId: stringSchema(),
    relatedIds: stringArraySchema
  },
  ["stage", "code", "severity", "message", "file"]
);

const authoringOutcomeAssessmentSchema = objectSchema(
  {
    kind: stringSchema(["sdd-authoring-outcome-assessment"]),
    outcome: stringSchema(["acceptable", "blocked", "review_required"]),
    layer: stringSchema([
      "transport",
      "request_shape",
      "domain_rejection",
      "candidate_diagnostics",
      "persisted_validation",
      "projection",
      "render",
      "success"
    ]),
    can_commit: booleanSchema(),
    can_render: booleanSchema(),
    should_stop: booleanSchema(),
    next_action: stringSchema(),
    blocking_diagnostics: arraySchema(diagnosticSchema),
    summary: stringSchema()
  },
  [
    "kind",
    "outcome",
    "layer",
    "can_commit",
    "can_render",
    "should_stop",
    "next_action",
    "blocking_diagnostics",
    "summary"
  ]
);

const placementSchema = objectSchema(
  {
    mode: stringSchema(["before", "after", "first", "last"]),
    stream: stringSchema(["top_level", "body"]),
    anchor_handle: stringSchema(),
    parent_handle: stringSchema()
  },
  ["mode", "stream"]
);

const changeSetSummarySchema = objectSchema(
  {
    node_insertions: arraySchema(
      objectSchema(
        {
          handle: stringSchema(),
          node_id: stringSchema(),
          node_type: stringSchema()
        },
        ["node_id", "node_type"]
      )
    ),
    node_deletions: arraySchema(
      objectSchema(
        {
          handle: stringSchema(),
          node_id: stringSchema()
        },
        ["handle"]
      )
    ),
    node_renames: arraySchema(
      objectSchema(
        {
          handle: stringSchema(),
          from: stringSchema(),
          to: stringSchema()
        },
        ["handle", "from", "to"]
      )
    ),
    property_changes: arraySchema(
      objectSchema(
        {
          node_handle: stringSchema(),
          key: stringSchema(),
          from: stringSchema(),
          to: stringSchema()
        },
        ["node_handle", "key"]
      )
    ),
    edge_insertions: arraySchema(
      objectSchema(
        {
          handle: stringSchema(),
          parent_handle: stringSchema(),
          rel_type: stringSchema(),
          to: stringSchema()
        },
        ["parent_handle", "rel_type", "to"]
      )
    ),
    edge_deletions: arraySchema(
      objectSchema(
        {
          handle: stringSchema(),
          parent_handle: stringSchema(),
          rel_type: stringSchema(),
          to: stringSchema()
        },
        ["handle", "parent_handle", "rel_type", "to"]
      )
    ),
    ordering_changes: arraySchema(
      objectSchema(
        {
          kind: stringSchema(["top_level_node", "structural_edge", "nested_node_block"]),
          target_handle: stringSchema(),
          parent_handle: stringSchema(),
          old_index: integerSchema(),
          new_index: integerSchema()
        },
        ["kind", "target_handle", "old_index", "new_index"]
      )
    )
  },
  [
    "node_insertions",
    "node_deletions",
    "node_renames",
    "property_changes",
    "edge_insertions",
    "edge_deletions",
    "ordering_changes"
  ]
);

const projectionResultEntrySchema = objectSchema(
  {
    view_id: stringSchema(),
    projection: anySchema,
    diagnostics: arraySchema(diagnosticSchema)
  },
  ["view_id", "diagnostics"]
);

const insertNodeBlockOpSchema = objectSchema(
  {
    kind: stringSchema(["insert_node_block"]),
    node_type: stringSchema(),
    node_id: stringSchema(),
    name: stringSchema(),
    placement: placementSchema
  },
  ["kind", "node_type", "node_id", "name", "placement"]
);

const deleteNodeBlockOpSchema = objectSchema(
  {
    kind: stringSchema(["delete_node_block"]),
    node_handle: stringSchema()
  },
  ["kind", "node_handle"]
);

const setNodeNameOpSchema = objectSchema(
  {
    kind: stringSchema(["set_node_name"]),
    node_handle: stringSchema(),
    name: stringSchema()
  },
  ["kind", "node_handle", "name"]
);

const setNodePropertyOpSchema = objectSchema(
  {
    kind: stringSchema(["set_node_property"]),
    node_handle: stringSchema(),
    key: stringSchema(),
    value_kind: stringSchema(["quoted_string", "bare_value"]),
    raw_value: stringSchema()
  },
  ["kind", "node_handle", "key", "value_kind", "raw_value"]
);

const removeNodePropertyOpSchema = objectSchema(
  {
    kind: stringSchema(["remove_node_property"]),
    node_handle: stringSchema(),
    key: stringSchema()
  },
  ["kind", "node_handle", "key"]
);

const insertEdgeLineOpSchema = objectSchema(
  {
    kind: stringSchema(["insert_edge_line"]),
    parent_handle: stringSchema(),
    rel_type: stringSchema(),
    to: stringSchema(),
    to_name: stringSchema(),
    event: stringSchema(),
    guard: stringSchema(),
    effect: stringSchema(),
    props: objectSchema({}, [], stringSchema()),
    placement: placementSchema
  },
  ["kind", "parent_handle", "rel_type", "to"]
);

const removeEdgeLineOpSchema = objectSchema(
  {
    kind: stringSchema(["remove_edge_line"]),
    edge_handle: stringSchema()
  },
  ["kind", "edge_handle"]
);

const repositionTopLevelNodeOpSchema = objectSchema(
  {
    kind: stringSchema(["reposition_top_level_node"]),
    node_handle: stringSchema(),
    placement: placementSchema
  },
  ["kind", "node_handle", "placement"]
);

const repositionStructuralEdgeOpSchema = objectSchema(
  {
    kind: stringSchema(["reposition_structural_edge"]),
    edge_handle: stringSchema(),
    placement: placementSchema
  },
  ["kind", "edge_handle", "placement"]
);

const moveNestedNodeBlockOpSchema = objectSchema(
  {
    kind: stringSchema(["move_nested_node_block"]),
    node_handle: stringSchema(),
    placement: placementSchema
  },
  ["kind", "node_handle", "placement"]
);

const changeOperationSchema: JsonSchema = {
  oneOf: [
    insertNodeBlockOpSchema,
    deleteNodeBlockOpSchema,
    setNodeNameOpSchema,
    setNodePropertyOpSchema,
    removeNodePropertyOpSchema,
    insertEdgeLineOpSchema,
    removeEdgeLineOpSchema,
    repositionTopLevelNodeOpSchema,
    repositionStructuralEdgeOpSchema,
    moveNestedNodeBlockOpSchema
  ]
};

const changeSetResultSchema = objectSchema(
  {
    kind: stringSchema(["sdd-change-set"]),
    change_set_id: stringSchema(),
    path: stringSchema(),
    origin: stringSchema(["apply_change_set", "apply_authoring_intent", "undo_change_set", "create_document"]),
    document_effect: stringSchema(["created", "updated", "deleted"]),
    base_revision: stringSchema(),
    resulting_revision: stringSchema(),
    mode: stringSchema(["dry_run", "commit"]),
    status: stringSchema(["applied", "rejected"]),
    undo_eligible: booleanSchema(),
    operations: arraySchema(changeOperationSchema),
    summary: changeSetSummarySchema,
    diagnostics: arraySchema(diagnosticSchema),
    projection_results: arraySchema(projectionResultEntrySchema),
    assessment: authoringOutcomeAssessmentSchema
  },
  [
    "kind",
    "change_set_id",
    "path",
    "origin",
    "document_effect",
    "mode",
    "status",
    "undo_eligible",
    "operations",
    "summary",
    "diagnostics"
  ]
);

const nodeSelectorSchema = objectSchema(
  {
    kind: stringSchema(["node_id"]),
    node_id: stringSchema()
  },
  ["kind", "node_id"]
);

const nodeRefHandleSchema = objectSchema(
  {
    by: stringSchema(["handle"]),
    handle: stringSchema()
  },
  ["by", "handle"]
);

const nodeRefLocalIdSchema = objectSchema(
  {
    by: stringSchema(["local_id"]),
    local_id: stringSchema()
  },
  ["by", "local_id"]
);

const nodeRefSelectorSchema = objectSchema(
  {
    by: stringSchema(["selector"]),
    selector: nodeSelectorSchema
  },
  ["by", "selector"]
);

const nodeRefSchema: JsonSchema = {
  oneOf: [nodeRefHandleSchema, nodeRefLocalIdSchema, nodeRefSelectorSchema]
};

const scaffoldPlacementSchema = objectSchema(
  {
    mode: stringSchema(["before", "after", "first", "last"]),
    anchor: nodeRefSchema
  },
  ["mode"]
);

const scaffoldPropSchema = objectSchema(
  {
    key: stringSchema(),
    value_kind: stringSchema(["quoted_string", "bare_value"]),
    raw_value: stringSchema()
  },
  ["key", "value_kind", "raw_value"]
);

const scaffoldEdgeSchema = objectSchema(
  {
    local_id: stringSchema(),
    rel_type: stringSchema(),
    to: stringSchema(),
    to_name: stringSchema(),
    event: stringSchema(),
    guard: stringSchema(),
    effect: stringSchema(),
    props: objectSchema({}, [], stringSchema()),
    placement: objectSchema(
      {
        mode: stringSchema(["first", "last"])
      },
      ["mode"]
    )
  },
  ["local_id", "rel_type", "to"]
);

const insertNodeScaffoldIntentSchema: JsonSchema = {
  $ref: "#/$defs/insert_node_scaffold_intent",
  $defs: {
    node_selector: nodeSelectorSchema,
    node_ref: nodeRefSchema,
    scaffold_prop: scaffoldPropSchema,
    scaffold_edge: scaffoldEdgeSchema,
    insert_node_scaffold_intent: objectSchema(
      {
        kind: stringSchema(["insert_node_scaffold"]),
        local_id: stringSchema(),
        parent: { $ref: "#/$defs/node_ref" },
        placement: scaffoldPlacementSchema,
        node: objectSchema(
          {
            node_type: stringSchema(),
            node_id: stringSchema(),
            name: stringSchema(),
            props: arraySchema({ $ref: "#/$defs/scaffold_prop" }),
            edges: arraySchema({ $ref: "#/$defs/scaffold_edge" }),
            children: arraySchema({ $ref: "#/$defs/insert_node_scaffold_intent" })
          },
          ["node_type", "node_id", "name"]
        )
      },
      ["kind", "local_id", "placement", "node"]
    )
  }
};

const authoringIntentDiagnosticSchema = objectSchema(
  {
    intent_index: integerSchema(),
    local_id: stringSchema(),
    field_path: stringSchema(),
    code: stringSchema(),
    message: stringSchema()
  },
  ["intent_index", "field_path", "code", "message"]
);

const createdTargetSchema = objectSchema(
  {
    local_id: stringSchema(),
    kind: stringSchema(["node", "edge"]),
    handle: stringSchema(),
    parent_local_id: stringSchema()
  },
  ["local_id", "kind", "handle"]
);

const applyAuthoringIntentResultSchema = objectSchema(
  {
    kind: stringSchema(["sdd-authoring-intent-result"]),
    path: stringSchema(),
    base_revision: stringSchema(),
    resulting_revision: stringSchema(),
    mode: stringSchema(["dry_run", "commit"]),
    status: stringSchema(["applied", "rejected"]),
    intents: arraySchema(insertNodeScaffoldIntentSchema),
    change_set: changeSetResultSchema,
    created_targets: arraySchema(createdTargetSchema),
    diagnostics: arraySchema(diagnosticSchema),
    intent_diagnostics: arraySchema(authoringIntentDiagnosticSchema),
    assessment: authoringOutcomeAssessmentSchema
  },
  ["kind", "path", "base_revision", "mode", "status", "intents", "change_set", "created_targets", "diagnostics"]
);

const inspectPropertyValueSchema = objectSchema(
  {
    key: stringSchema(),
    value_kind: stringSchema(["quoted_string", "bare_value"]),
    raw_value: stringSchema()
  },
  ["key", "value_kind", "raw_value"]
);

const inspectEdgeValueSchema = objectSchema(
  {
    rel_type: stringSchema(),
    to: stringSchema(),
    to_name: stringSchema(),
    event: stringSchema(),
    guard: stringSchema(),
    effect: stringSchema(),
    props: objectSchema({}, [], stringSchema()),
    structural_order_index: numberSchema()
  },
  ["rel_type", "to", "props"]
);

const inspectBodyItemSchema = objectSchema(
  {
    handle: stringSchema(),
    kind: stringSchema(["property_line", "edge_line", "node_block"]),
    parent_handle: stringSchema(),
    order_index: integerSchema(),
    property: inspectPropertyValueSchema,
    edge: inspectEdgeValueSchema
  },
  ["handle", "kind", "parent_handle", "order_index"]
);

const inspectNodeBlockSchema = objectSchema(
  {
    handle: stringSchema(),
    node_type: stringSchema(),
    node_id: stringSchema(),
    name: stringSchema(),
    parent_handle: stringSchema(),
    body_stream: stringArraySchema,
    structural_order_streams: objectSchema(
      {
        CONTAINS: stringArraySchema,
        COMPOSED_OF: stringArraySchema
      },
      [],
      false
    )
  },
  ["handle", "node_type", "node_id", "name", "body_stream", "structural_order_streams"]
);

const inspectResourceSchema = objectSchema(
  {
    kind: stringSchema(["sdd-document-inspect"]),
    uri: stringSchema(),
    path: stringSchema(),
    revision: stringSchema(),
    effective_version: stringSchema(),
    top_level_order: stringArraySchema,
    nodes: arraySchema(inspectNodeBlockSchema),
    body_items: arraySchema(inspectBodyItemSchema),
    diagnostics: arraySchema(diagnosticSchema)
  },
  ["kind", "uri", "path", "revision", "effective_version", "top_level_order", "nodes", "body_items", "diagnostics"]
);

const searchGraphResultSchema = objectSchema(
  {
    kind: stringSchema(["sdd-search-results"]),
    matches: arraySchema(
      objectSchema(
        {
          path: stringSchema(),
          uri: stringSchema(),
          revision: stringSchema(),
          node_id: stringSchema(),
          node_type: stringSchema(),
          name: stringSchema(),
          matched_on: arraySchema(stringSchema(["query", "node_type", "node_id"]))
        },
        ["path", "uri", "revision", "node_id", "node_type", "name", "matched_on"]
      )
    ),
    diagnostics: arraySchema(diagnosticSchema)
  },
  ["kind", "matches", "diagnostics"]
);

const createDocumentResultSchema = objectSchema(
  {
    kind: stringSchema(["sdd-create-document"]),
    path: stringSchema(),
    uri: stringSchema(),
    revision: stringSchema(),
    change_set: changeSetResultSchema,
    assessment: authoringOutcomeAssessmentSchema
  },
  ["kind", "path", "uri", "revision", "change_set"]
);

const validationResourceSchema = objectSchema(
  {
    kind: stringSchema(["sdd-validation"]),
    uri: stringSchema(),
    path: stringSchema(),
    revision: stringSchema(),
    profile_id: stringSchema(),
    report: objectSchema(
      {
        error_count: integerSchema(),
        warning_count: integerSchema()
      },
      ["error_count", "warning_count"]
    ),
    diagnostics: arraySchema(diagnosticSchema),
    assessment: authoringOutcomeAssessmentSchema
  },
  ["kind", "uri", "path", "revision", "profile_id", "diagnostics"]
);

const projectionResourceSchema = objectSchema(
  {
    kind: stringSchema(["sdd-projection"]),
    uri: stringSchema(),
    path: stringSchema(),
    revision: stringSchema(),
    view_id: stringSchema(),
    projection: anySchema,
    diagnostics: arraySchema(diagnosticSchema),
    assessment: authoringOutcomeAssessmentSchema
  },
  ["kind", "uri", "path", "revision", "view_id", "diagnostics"]
);

const renderPreviewResultSchema = objectSchema(
  {
    kind: stringSchema(["sdd-preview"]),
    path: stringSchema(),
    revision: stringSchema(),
    view_id: stringSchema(),
    profile_id: stringSchema(),
    backend_id: stringSchema(),
    format: stringSchema(["svg", "png"]),
    mime_type: stringSchema(["image/svg+xml", "image/png"]),
    artifact_path: stringSchema(),
    notes: stringArraySchema,
    diagnostics: arraySchema(diagnosticSchema),
    assessment: authoringOutcomeAssessmentSchema
  },
  [
    "kind",
    "path",
    "revision",
    "view_id",
    "profile_id",
    "backend_id",
    "format",
    "mime_type",
    "artifact_path",
    "notes",
    "diagnostics"
  ]
);

const helperErrorResultSchema = objectSchema(
  {
    kind: stringSchema(["sdd-helper-error"]),
    code: stringSchema(["invalid_args", "invalid_json", "runtime_error"]),
    message: stringSchema(),
    diagnostics: arraySchema(diagnosticSchema),
    assessment: authoringOutcomeAssessmentSchema
  },
  ["kind", "code", "message"]
);

const helperGitStatusResultSchema = objectSchema(
  {
    kind: stringSchema(["sdd-git-status"]),
    paths: stringArraySchema,
    status: arraySchema(
      objectSchema(
        {
          path: stringSchema(),
          index_status: stringSchema(),
          worktree_status: stringSchema()
        },
        ["path", "index_status", "worktree_status"]
      )
    )
  },
  ["kind", "paths", "status"]
);

const helperGitCommitResultSchema = objectSchema(
  {
    kind: stringSchema(["sdd-git-commit"]),
    committed_paths: stringArraySchema,
    commit_sha: stringSchema()
  },
  ["kind", "committed_paths", "commit_sha"]
);

const helperRequestBodySpecSchema = objectSchema(
  {
    via_option: stringSchema(["--request"]),
    top_level_shape: stringSchema(["ApplyAuthoringIntentArgs", "ApplyChangeSetArgs", "UndoChangeSetArgs"]),
    source: stringSchema(["file_path_or_stdin_dash"]),
    stdin_dash: objectSchema(
      {
        read_mode: stringSchema(["read_all_stdin_until_eof"]),
        empty_input_error: objectSchema(
          {
            kind: stringSchema(["sdd-helper-error"]),
            code: stringSchema(["invalid_json"]),
            message: stringSchema(["Unexpected end of JSON input"])
          },
          ["kind", "code", "message"]
        )
      },
      ["read_mode", "empty_input_error"]
    )
  },
  ["via_option", "top_level_shape", "source", "stdin_dash"]
);

const helperCapabilitiesCommandSchema = objectSchema(
  {
    name: stringSchema(),
    invocation: stringSchema(),
    summary: stringSchema(),
    mutates_repo_state: stringSchema(["never", "conditional", "always"]),
    arguments: arraySchema(
      objectSchema(
        {
          name: stringSchema(),
          required: booleanSchema(),
          description: stringSchema()
        },
        ["name", "required", "description"]
      )
    ),
    options: arraySchema(
      objectSchema(
        {
          flag: stringSchema(),
          required: booleanSchema(),
          description: stringSchema(),
          value_name: stringSchema()
        },
        ["flag", "required", "description"]
      )
    ),
    request_body: helperRequestBodySpecSchema,
    result_kind: stringSchema(),
    constraints: stringArraySchema,
    subject_id: stringSchema(),
    input_shape_id: stringSchema(),
    output_shape_id: stringSchema(),
    has_deep_introspection: booleanSchema(),
    detail_modes: arraySchema(stringSchema(["static", "bundle_resolved"]))
  },
  [
    "name",
    "invocation",
    "summary",
    "mutates_repo_state",
    "arguments",
    "options",
    "result_kind",
    "constraints",
    "subject_id",
    "has_deep_introspection"
  ]
);

const helperCapabilitiesResultSchema = objectSchema(
  {
    kind: stringSchema(["sdd-helper-capabilities"]),
    helper_name: stringSchema(["sdd-helper"]),
    summary: stringSchema(),
    discovery: objectSchema(
      {
        bare_invocation: stringSchema(["returns_help_stub"]),
        help_flag: stringSchema(["returns_help_stub"]),
        canonical_introspection_command: stringSchema(["sdd-helper capabilities"])
      },
      ["bare_invocation", "help_flag", "canonical_introspection_command"]
    ),
    conventions: objectSchema(
      {
        stdout_success: stringSchema(["exactly_one_json_payload"]),
        helper_errors: stringSchema(["sdd-helper-error_non_zero_exit"]),
        domain_rejections: stringSchema(["structured_payload_exit_zero"]),
        path_scope: stringSchema(["repo_relative_sdd_paths"]),
        request_loading: arraySchema(
          objectSchema(
            {
              command: stringSchema(["apply", "author", "undo"]),
              option: stringSchema(["--request"]),
              sources: arraySchema(stringSchema(["file_path", "stdin_dash"])),
              top_level_shape: stringSchema(["ApplyAuthoringIntentArgs", "ApplyChangeSetArgs", "UndoChangeSetArgs"])
            },
            ["command", "option", "sources", "top_level_shape"]
          )
        )
      },
      ["stdout_success", "helper_errors", "domain_rejections", "path_scope", "request_loading"]
    ),
    commands: arraySchema(helperCapabilitiesCommandSchema)
  },
  ["kind", "helper_name", "summary", "discovery", "conventions", "commands"]
);

const contractSubjectDescriptorSchema = objectSchema(
  {
    subject_id: stringSchema(),
    surface_kind: stringSchema(["helper_command", "mcp_tool", "mcp_resource", "mcp_prompt"]),
    surface_name: stringSchema(),
    summary: stringSchema(),
    stability: stringSchema(["stable", "experimental", "deprecated"]),
    mutates_repo_state: stringSchema(["never", "conditional", "always"]),
    input_shape_id: stringSchema(),
    output_shape_id: stringSchema(),
    detail_modes: arraySchema(stringSchema(["static", "bundle_resolved"])),
    has_deep_introspection: booleanSchema()
  },
  ["subject_id", "surface_kind", "surface_name", "summary", "stability", "detail_modes", "has_deep_introspection"]
);

const contractShapeDescriptorSchema = objectSchema(
  {
    shape_id: stringSchema(),
    summary: stringSchema(),
    schema_format: stringSchema(["json_schema_2020_12"]),
    schema: anySchema,
    stability: stringSchema(["stable", "experimental", "deprecated"])
  },
  ["shape_id", "summary", "schema_format", "schema", "stability"]
);

const contractConstraintSpecSchema = objectSchema(
  {
    constraint_id: stringSchema(),
    applies_to_shape_id: stringSchema(),
    applies_to_json_pointers: stringArraySchema,
    kind: stringSchema([
      "required_if",
      "forbidden_if",
      "unique_within_request",
      "must_reference_earlier_local_id",
      "same_revision_handle",
      "commit_safe_continuation",
      "dry_run_informational_only"
    ]),
    parameters: anySchema,
    summary: stringSchema()
  },
  ["constraint_id", "applies_to_shape_id", "kind", "parameters", "summary"]
);

const contractResolvedAllowedValueSchema = objectSchema(
  {
    value: stringSchema(),
    label: stringSchema(),
    metadata: objectSchema({}, [], true)
  },
  ["value"]
);

const contractBindingSpecSchema = objectSchema(
  {
    binding_id: stringSchema(),
    applies_to_shape_id: stringSchema(),
    applies_to_json_pointer: stringSchema(),
    kind: stringSchema(["bundle_value_set"]),
    bundle_source: objectSchema(
      {
        artifact: stringSchema(["manifest_profiles", "views_yaml", "vocab_node_types", "vocab_relationship_types"]),
        selector: stringSchema()
      },
      ["artifact", "selector"]
    ),
    static_behavior: stringSchema(["reference_only"]),
    bundle_resolved_behavior: stringSchema(["expand_values"]),
    summary: stringSchema(),
    resolved_values: arraySchema(contractResolvedAllowedValueSchema)
  },
  [
    "binding_id",
    "applies_to_shape_id",
    "applies_to_json_pointer",
    "kind",
    "bundle_source",
    "static_behavior",
    "bundle_resolved_behavior",
    "summary"
  ]
);

const contractContinuationSpecSchema = objectSchema(
  {
    continuation_id: stringSchema(),
    applies_to_subject_id: stringSchema(),
    kind: stringSchema([
      "result_revision_is_required_next_base_revision",
      "commit_handles_are_safe_continuation_surfaces",
      "dry_run_handles_are_informational_only",
      "create_revision_is_bootstrap_continuation_surface",
      "inspect_may_fail_on_empty_bootstrap"
    ]),
    summary: stringSchema(),
    parameters: anySchema
  },
  ["continuation_id", "applies_to_subject_id", "kind", "summary"]
);

const contractExampleSpecSchema = objectSchema(
  {
    title: stringSchema(),
    when_to_include: stringSchema(["explicit_request_only", "essential_only"]),
    payload: anySchema
  },
  ["title", "when_to_include", "payload"]
);

const contractSubjectDetailSchema = objectSchema(
  {
    kind: stringSchema(["sdd-contract-subject-detail"]),
    subject: contractSubjectDescriptorSchema,
    input_shape: contractShapeDescriptorSchema,
    output_shape: contractShapeDescriptorSchema,
    request_body: helperRequestBodySpecSchema,
    constraints: arraySchema(contractConstraintSpecSchema),
    bindings: arraySchema(contractBindingSpecSchema),
    continuation: arraySchema(contractContinuationSpecSchema),
    examples: arraySchema(contractExampleSpecSchema),
    resolution: objectSchema(
      {
        mode: stringSchema(["static", "bundle_resolved"]),
        bundle_name: stringSchema(),
        bundle_version: stringSchema(),
        unresolved_binding_ids: stringArraySchema
      },
      ["mode"]
    )
  },
  ["kind", "subject", "constraints", "bindings", "continuation", "resolution"]
);

const SHAPES: readonly ContractShapeDescriptor[] = [
  {
    shape_id: "shared.shape.inspect_document_args",
    summary: "Input payload for helper inspect operations.",
    schema_format: "json_schema_2020_12",
    schema: objectSchema({ path: stringSchema() }, ["path"]),
    stability: "stable"
  },
  {
    shape_id: "shared.shape.inspect_resource",
    summary: "Inspect resource returned for parseable SDD documents.",
    schema_format: "json_schema_2020_12",
    schema: inspectResourceSchema,
    stability: "stable"
  },
  {
    shape_id: "shared.shape.search_graph_args",
    summary: "Search filters for helper graph search.",
    schema_format: "json_schema_2020_12",
    schema: objectSchema(
      {
        query: stringSchema(),
        node_type: stringSchema(),
        node_id: stringSchema(),
        under: stringSchema(),
        limit: integerSchema()
      },
      []
    ),
    stability: "stable"
  },
  {
    shape_id: "shared.shape.search_graph_result",
    summary: "Search results returned by helper graph search.",
    schema_format: "json_schema_2020_12",
    schema: searchGraphResultSchema,
    stability: "stable"
  },
  {
    shape_id: "shared.shape.authoring_outcome_assessment",
    summary: "Shared assessment attached to authoring helper outcomes.",
    schema_format: "json_schema_2020_12",
    schema: authoringOutcomeAssessmentSchema,
    stability: "stable"
  },
  {
    shape_id: "shared.shape.create_document_args",
    summary: "Create-document request payload.",
    schema_format: "json_schema_2020_12",
    schema: objectSchema(
      {
        path: stringSchema(),
        version: stringSchema(["0.1"])
      },
      ["path"]
    ),
    stability: "stable"
  },
  {
    shape_id: "shared.shape.create_document_result",
    summary: "Create-document result payload.",
    schema_format: "json_schema_2020_12",
    schema: createDocumentResultSchema,
    stability: "stable"
  },
  {
    shape_id: "shared.shape.apply_change_set_args",
    summary: "Structured low-level mutation request payload.",
    schema_format: "json_schema_2020_12",
    schema: objectSchema(
      {
        path: stringSchema(),
        base_revision: stringSchema(),
        mode: stringSchema(["dry_run", "commit"]),
        operations: arraySchema(changeOperationSchema),
        validate_profile: stringSchema(),
        projection_views: stringArraySchema
      },
      ["path", "base_revision", "operations"]
    ),
    stability: "stable"
  },
  {
    shape_id: "shared.shape.apply_change_set_result",
    summary: "Low-level mutation result payload.",
    schema_format: "json_schema_2020_12",
    schema: changeSetResultSchema,
    stability: "stable"
  },
  {
    shape_id: "shared.shape.apply_authoring_intent_args",
    summary: "High-level authoring intent request payload.",
    schema_format: "json_schema_2020_12",
    schema: objectSchema(
      {
        path: stringSchema(),
        base_revision: stringSchema(),
        mode: stringSchema(["dry_run", "commit"]),
        intents: arraySchema(insertNodeScaffoldIntentSchema),
        validate_profile: stringSchema(),
        projection_views: stringArraySchema
      },
      ["path", "base_revision", "intents"]
    ),
    stability: "stable"
  },
  {
    shape_id: "shared.shape.apply_authoring_intent_result",
    summary: "High-level authoring intent result payload.",
    schema_format: "json_schema_2020_12",
    schema: applyAuthoringIntentResultSchema,
    stability: "stable"
  },
  {
    shape_id: "shared.shape.undo_change_set_args",
    summary: "Undo request payload.",
    schema_format: "json_schema_2020_12",
    schema: objectSchema(
      {
        change_set_id: stringSchema(),
        mode: stringSchema(["dry_run", "commit"]),
        validate_profile: stringSchema()
      },
      ["change_set_id"]
    ),
    stability: "stable"
  },
  {
    shape_id: "shared.shape.undo_change_set_result",
    summary: "Undo result payload.",
    schema_format: "json_schema_2020_12",
    schema: changeSetResultSchema,
    stability: "stable"
  },
  {
    shape_id: "shared.shape.validate_document_args",
    summary: "Validate-document request payload.",
    schema_format: "json_schema_2020_12",
    schema: objectSchema(
      {
        path: stringSchema(),
        profile_id: stringSchema()
      },
      ["path", "profile_id"]
    ),
    stability: "stable"
  },
  {
    shape_id: "shared.shape.validation_resource",
    summary: "Validation resource payload.",
    schema_format: "json_schema_2020_12",
    schema: validationResourceSchema,
    stability: "stable"
  },
  {
    shape_id: "shared.shape.project_document_args",
    summary: "Project-document request payload.",
    schema_format: "json_schema_2020_12",
    schema: objectSchema(
      {
        path: stringSchema(),
        view_id: stringSchema()
      },
      ["path", "view_id"]
    ),
    stability: "stable"
  },
  {
    shape_id: "shared.shape.projection_resource",
    summary: "Projection resource payload.",
    schema_format: "json_schema_2020_12",
    schema: projectionResourceSchema,
    stability: "stable"
  },
  {
    shape_id: "shared.shape.render_preview_args",
    summary: "Preview-render request payload.",
    schema_format: "json_schema_2020_12",
    schema: objectSchema(
      {
        path: stringSchema(),
        view_id: stringSchema(),
        profile_id: stringSchema(),
        format: stringSchema(["svg", "png"]),
        backend_id: stringSchema()
      },
      ["path", "view_id", "profile_id", "format"]
    ),
    stability: "stable"
  },
  {
    shape_id: "shared.shape.render_preview_result",
    summary: "Preview-render result payload.",
    schema_format: "json_schema_2020_12",
    schema: renderPreviewResultSchema,
    stability: "stable"
  },
  {
    shape_id: "shared.shape.helper_git_status_args",
    summary: "Helper git-status input payload.",
    schema_format: "json_schema_2020_12",
    schema: objectSchema(
      {
        paths: stringArraySchema
      },
      []
    ),
    stability: "stable"
  },
  {
    shape_id: "shared.shape.helper_git_status_result",
    summary: "Helper git-status result payload.",
    schema_format: "json_schema_2020_12",
    schema: helperGitStatusResultSchema,
    stability: "stable"
  },
  {
    shape_id: "shared.shape.helper_git_commit_args",
    summary: "Helper git-commit input payload.",
    schema_format: "json_schema_2020_12",
    schema: objectSchema(
      {
        message: stringSchema(),
        paths: stringArraySchema
      },
      ["message", "paths"]
    ),
    stability: "stable"
  },
  {
    shape_id: "shared.shape.helper_git_commit_result",
    summary: "Helper git-commit result payload.",
    schema_format: "json_schema_2020_12",
    schema: helperGitCommitResultSchema,
    stability: "stable"
  },
  {
    shape_id: "shared.shape.helper_error_result",
    summary: "Helper-layer error payload returned on non-zero helper exits.",
    schema_format: "json_schema_2020_12",
    schema: helperErrorResultSchema,
    stability: "stable"
  },
  {
    shape_id: "shared.shape.helper_capabilities_result",
    summary: "Machine-readable helper capabilities payload.",
    schema_format: "json_schema_2020_12",
    schema: helperCapabilitiesResultSchema,
    stability: "stable"
  },
  {
    shape_id: "shared.shape.helper_contract_args",
    summary: "Input payload for helper contract introspection.",
    schema_format: "json_schema_2020_12",
    schema: objectSchema(
      {
        subject_id: stringSchema(),
        resolve: stringSchema(["bundle"])
      },
      ["subject_id"]
    ),
    stability: "stable"
  },
  {
    shape_id: "shared.shape.contract_subject_detail",
    summary: "Deep static contract detail for one helper or MCP subject.",
    schema_format: "json_schema_2020_12",
    schema: contractSubjectDetailSchema,
    stability: "stable"
  }
] as const;

const SUBJECTS: readonly ContractSubjectDescriptor[] = [
  {
    subject_id: "helper.command.inspect",
    surface_kind: "helper_command",
    surface_name: "inspect",
    summary: "Return the inspect payload for a parseable repo-relative .sdd document.",
    stability: "stable",
    mutates_repo_state: "never",
    input_shape_id: "shared.shape.inspect_document_args",
    output_shape_id: "shared.shape.inspect_resource",
    detail_modes: ["static"],
    has_deep_introspection: true
  },
  {
    subject_id: "helper.command.search",
    surface_kind: "helper_command",
    surface_name: "search",
    summary: "Search compile-valid graph content across repo-local .sdd documents.",
    stability: "stable",
    mutates_repo_state: "never",
    input_shape_id: "shared.shape.search_graph_args",
    output_shape_id: "shared.shape.search_graph_result",
    detail_modes: ["static"],
    has_deep_introspection: true
  },
  {
    subject_id: "helper.command.create",
    surface_kind: "helper_command",
    surface_name: "create",
    summary: "Create a new .sdd document through the authoring core.",
    stability: "stable",
    mutates_repo_state: "always",
    input_shape_id: "shared.shape.create_document_args",
    output_shape_id: "shared.shape.create_document_result",
    detail_modes: ["static"],
    has_deep_introspection: true
  },
  {
    subject_id: "helper.command.apply",
    surface_kind: "helper_command",
    surface_name: "apply",
    summary: "Apply or dry-run a structured change set request.",
    stability: "stable",
    mutates_repo_state: "conditional",
    input_shape_id: "shared.shape.apply_change_set_args",
    output_shape_id: "shared.shape.apply_change_set_result",
    detail_modes: ["static"],
    has_deep_introspection: true
  },
  {
    subject_id: "helper.command.author",
    surface_kind: "helper_command",
    surface_name: "author",
    summary: "Apply or dry-run high-level authoring intents through the shared authoring core.",
    stability: "stable",
    mutates_repo_state: "conditional",
    input_shape_id: "shared.shape.apply_authoring_intent_args",
    output_shape_id: "shared.shape.apply_authoring_intent_result",
    detail_modes: ["static"],
    has_deep_introspection: true
  },
  {
    subject_id: "helper.command.undo",
    surface_kind: "helper_command",
    surface_name: "undo",
    summary: "Undo a committed change set through a structured request.",
    stability: "stable",
    mutates_repo_state: "conditional",
    input_shape_id: "shared.shape.undo_change_set_args",
    output_shape_id: "shared.shape.undo_change_set_result",
    detail_modes: ["static"],
    has_deep_introspection: true
  },
  {
    subject_id: "helper.command.validate",
    surface_kind: "helper_command",
    surface_name: "validate",
    summary: "Return validation diagnostics for the current persisted document revision.",
    stability: "stable",
    mutates_repo_state: "never",
    input_shape_id: "shared.shape.validate_document_args",
    output_shape_id: "shared.shape.validation_resource",
    detail_modes: ["static", "bundle_resolved"],
    has_deep_introspection: true
  },
  {
    subject_id: "helper.command.project",
    surface_kind: "helper_command",
    surface_name: "project",
    summary: "Return a structured projection for the current persisted document revision.",
    stability: "stable",
    mutates_repo_state: "never",
    input_shape_id: "shared.shape.project_document_args",
    output_shape_id: "shared.shape.projection_resource",
    detail_modes: ["static", "bundle_resolved"],
    has_deep_introspection: true
  },
  {
    subject_id: "helper.command.preview",
    surface_kind: "helper_command",
    surface_name: "preview",
    summary: "Render a preview artifact for a repo-relative .sdd document.",
    stability: "stable",
    mutates_repo_state: "never",
    input_shape_id: "shared.shape.render_preview_args",
    output_shape_id: "shared.shape.render_preview_result",
    detail_modes: ["static", "bundle_resolved"],
    has_deep_introspection: true
  },
  {
    subject_id: "helper.command.git-status",
    surface_kind: "helper_command",
    surface_name: "git-status",
    summary: "Return narrow git status for SDD-scoped paths.",
    stability: "stable",
    mutates_repo_state: "never",
    input_shape_id: "shared.shape.helper_git_status_args",
    output_shape_id: "shared.shape.helper_git_status_result",
    detail_modes: ["static"],
    has_deep_introspection: true
  },
  {
    subject_id: "helper.command.git-commit",
    surface_kind: "helper_command",
    surface_name: "git-commit",
    summary: "Create a narrow git commit for explicit SDD paths.",
    stability: "stable",
    mutates_repo_state: "always",
    input_shape_id: "shared.shape.helper_git_commit_args",
    output_shape_id: "shared.shape.helper_git_commit_result",
    detail_modes: ["static"],
    has_deep_introspection: true
  },
  {
    subject_id: "helper.command.contract",
    surface_kind: "helper_command",
    surface_name: "contract",
    summary: "Return full shared contract detail for one helper subject.",
    stability: "stable",
    mutates_repo_state: "never",
    input_shape_id: "shared.shape.helper_contract_args",
    output_shape_id: "shared.shape.contract_subject_detail",
    detail_modes: ["static", "bundle_resolved"],
    has_deep_introspection: true
  },
  {
    subject_id: "helper.command.capabilities",
    surface_kind: "helper_command",
    surface_name: "capabilities",
    summary: "Return the full machine-readable helper capability manifest.",
    stability: "stable",
    mutates_repo_state: "never",
    output_shape_id: "shared.shape.helper_capabilities_result",
    detail_modes: ["static"],
    has_deep_introspection: true
  }
] as const;

function createRequestBodySpec(topLevelShape: HelperRequestBodySpec["top_level_shape"]): HelperRequestBodySpec {
  return {
    via_option: "--request",
    top_level_shape: topLevelShape,
    source: "file_path_or_stdin_dash",
    stdin_dash: {
      read_mode: "read_all_stdin_until_eof",
      empty_input_error: {
        kind: "sdd-helper-error",
        code: "invalid_json",
        message: "Unexpected end of JSON input"
      }
    }
  };
}

const REQUEST_BODIES = new Map<ContractSubjectId, HelperRequestBodySpec>([
  ["helper.command.apply", createRequestBodySpec("ApplyChangeSetArgs")],
  ["helper.command.author", createRequestBodySpec("ApplyAuthoringIntentArgs")],
  ["helper.command.undo", createRequestBodySpec("UndoChangeSetArgs")]
]);

const CONSTRAINTS: readonly ContractConstraintSpec[] = [
  {
    constraint_id: "shared.constraint.authoring_intent.anchor_required_for_before_after",
    applies_to_shape_id: "shared.shape.apply_authoring_intent_args",
    applies_to_json_pointers: ["/intents/*/placement/anchor"],
    kind: "required_if",
    parameters: {
      if: {
        pointer: "/intents/*/placement/mode",
        equals_one_of: ["before", "after"]
      }
    },
    summary: "Authoring placement.anchor is required when placement.mode is before or after."
  },
  {
    constraint_id: "shared.constraint.authoring_intent.anchor_forbidden_for_first_last",
    applies_to_shape_id: "shared.shape.apply_authoring_intent_args",
    applies_to_json_pointers: ["/intents/*/placement/anchor"],
    kind: "forbidden_if",
    parameters: {
      if: {
        pointer: "/intents/*/placement/mode",
        equals_one_of: ["first", "last"]
      }
    },
    summary: "Authoring placement.anchor must be omitted when placement.mode is first or last."
  },
  {
    constraint_id: "shared.constraint.authoring_intent.local_id_unique_within_request",
    applies_to_shape_id: "shared.shape.apply_authoring_intent_args",
    applies_to_json_pointers: ["/intents/*/local_id", "/intents/*/node/edges/*/local_id"],
    kind: "unique_within_request",
    parameters: {
      scope: "entire_request"
    },
    summary: "All scaffold and scaffold-edge local_id values must be unique within one authoring request."
  },
  {
    constraint_id: "shared.constraint.authoring_intent.local_id_references_must_point_earlier",
    applies_to_shape_id: "shared.shape.apply_authoring_intent_args",
    applies_to_json_pointers: ["/intents/*/parent", "/intents/*/placement/anchor"],
    kind: "must_reference_earlier_local_id",
    parameters: {
      local_id_reference_paths: ["/intents/*/parent", "/intents/*/placement/anchor"],
      resolution_scope: "earlier_created_request_nodes"
    },
    summary: "Authoring local_id references must resolve to nodes created earlier in the same request."
  },
  {
    constraint_id: "shared.constraint.apply_change_set.handles_are_revision_bound",
    applies_to_shape_id: "shared.shape.apply_change_set_args",
    applies_to_json_pointers: [
      "/operations/*/node_handle",
      "/operations/*/edge_handle",
      "/operations/*/parent_handle",
      "/operations/*/placement/anchor_handle"
    ],
    kind: "same_revision_handle",
    parameters: {
      base_revision_pointer: "/base_revision"
    },
    summary: "All handles in a low-level change-set request are valid only for the supplied base_revision."
  },
  {
    constraint_id: "shared.constraint.apply_authoring_intent.handles_are_revision_bound",
    applies_to_shape_id: "shared.shape.apply_authoring_intent_args",
    applies_to_json_pointers: ["/intents/*/parent", "/intents/*/placement/anchor"],
    kind: "same_revision_handle",
    parameters: {
      base_revision_pointer: "/base_revision",
      reference_mode: "by_handle"
    },
    summary: "Handle-based authoring references are valid only against the supplied base_revision."
  },
  {
    constraint_id: "shared.constraint.apply_change_set.commit_handles_are_continuation_safe",
    applies_to_shape_id: "shared.shape.apply_change_set_result",
    applies_to_json_pointers: ["/summary/node_insertions/*/handle", "/summary/edge_insertions/*/handle"],
    kind: "commit_safe_continuation",
    parameters: {
      safe_when: {
        mode: "commit",
        status: "applied"
      },
      revision_pointer: "/resulting_revision"
    },
    summary: "Committed insertion handles from apply results are safe continuation surfaces only for the returned resulting_revision."
  },
  {
    constraint_id: "shared.constraint.apply_authoring_intent.commit_created_targets_are_continuation_safe",
    applies_to_shape_id: "shared.shape.apply_authoring_intent_result",
    applies_to_json_pointers: ["/created_targets/*/handle"],
    kind: "commit_safe_continuation",
    parameters: {
      safe_when: {
        mode: "commit",
        status: "applied"
      },
      revision_pointer: "/resulting_revision"
    },
    summary: "Committed created_targets from author results are safe continuation surfaces only for the returned resulting_revision."
  },
  {
    constraint_id: "shared.constraint.apply_change_set.dry_run_handles_are_informational_only",
    applies_to_shape_id: "shared.shape.apply_change_set_result",
    applies_to_json_pointers: ["/summary/node_insertions/*/handle", "/summary/edge_insertions/*/handle"],
    kind: "dry_run_informational_only",
    parameters: {
      informational_when: {
        mode: "dry_run"
      }
    },
    summary: "Dry-run insertion handles from apply results are informational only and must not be reused in later requests."
  },
  {
    constraint_id: "shared.constraint.apply_authoring_intent.dry_run_created_targets_are_informational_only",
    applies_to_shape_id: "shared.shape.apply_authoring_intent_result",
    applies_to_json_pointers: ["/created_targets/*/handle"],
    kind: "dry_run_informational_only",
    parameters: {
      informational_when: {
        mode: "dry_run"
      }
    },
    summary: "Dry-run created_targets from author results are informational only and must not be reused in later requests."
  }
] as const;

const BINDINGS: readonly ContractBindingSpec[] = [
  {
    binding_id: "shared.binding.validate_document.profile_id",
    applies_to_shape_id: "shared.shape.validate_document_args",
    applies_to_json_pointer: "/profile_id",
    kind: "bundle_value_set",
    bundle_source: {
      artifact: "manifest_profiles",
      selector: "profiles"
    },
    static_behavior: "reference_only",
    bundle_resolved_behavior: "expand_values",
    summary: "profile_id is bundle-owned and must be resolved from the active bundle profiles list."
  },
  {
    binding_id: "shared.binding.project_document.view_id",
    applies_to_shape_id: "shared.shape.project_document_args",
    applies_to_json_pointer: "/view_id",
    kind: "bundle_value_set",
    bundle_source: {
      artifact: "views_yaml",
      selector: "views"
    },
    static_behavior: "reference_only",
    bundle_resolved_behavior: "expand_values",
    summary: "view_id is bundle-owned and must be resolved from the active bundle views list."
  },
  {
    binding_id: "shared.binding.render_preview.view_id",
    applies_to_shape_id: "shared.shape.render_preview_args",
    applies_to_json_pointer: "/view_id",
    kind: "bundle_value_set",
    bundle_source: {
      artifact: "views_yaml",
      selector: "views"
    },
    static_behavior: "reference_only",
    bundle_resolved_behavior: "expand_values",
    summary: "Preview view_id is bundle-owned and must be resolved from the active bundle views list."
  },
  {
    binding_id: "shared.binding.render_preview.profile_id",
    applies_to_shape_id: "shared.shape.render_preview_args",
    applies_to_json_pointer: "/profile_id",
    kind: "bundle_value_set",
    bundle_source: {
      artifact: "manifest_profiles",
      selector: "profiles"
    },
    static_behavior: "reference_only",
    bundle_resolved_behavior: "expand_values",
    summary: "Preview profile_id is bundle-owned and must be resolved from the active bundle profiles list."
  }
] as const;

const CONTINUATIONS: readonly ContractContinuationSpec[] = [
  {
    continuation_id: "shared.continuation.create_document.bootstrap_revision",
    applies_to_subject_id: "helper.command.create",
    kind: "create_revision_is_bootstrap_continuation_surface",
    summary: "The revision returned by create is the correct next base_revision for follow-on mutations."
  },
  {
    continuation_id: "shared.continuation.create_document.inspect_may_fail_on_empty_bootstrap",
    applies_to_subject_id: "helper.command.create",
    kind: "inspect_may_fail_on_empty_bootstrap",
    summary: "Immediate inspect after create may fail because the empty bootstrap document can still be parse-invalid."
  },
  {
    continuation_id: "shared.continuation.apply_change_set.resulting_revision_next_base_revision",
    applies_to_subject_id: "helper.command.apply",
    kind: "result_revision_is_required_next_base_revision",
    summary: "When apply returns a resulting_revision, that revision is the next valid base_revision for follow-on work."
  },
  {
    continuation_id: "shared.continuation.apply_change_set.commit_handles_safe",
    applies_to_subject_id: "helper.command.apply",
    kind: "commit_handles_are_safe_continuation_surfaces",
    summary: "Committed insertion handles from apply are safe continuation surfaces only for the returned resulting_revision."
  },
  {
    continuation_id: "shared.continuation.apply_change_set.dry_run_handles_informational",
    applies_to_subject_id: "helper.command.apply",
    kind: "dry_run_handles_are_informational_only",
    summary: "Dry-run insertion handles from apply are informational only and must not be reused in later requests."
  },
  {
    continuation_id: "shared.continuation.apply_authoring_intent.resulting_revision_next_base_revision",
    applies_to_subject_id: "helper.command.author",
    kind: "result_revision_is_required_next_base_revision",
    summary: "When author returns a resulting_revision, that revision is the next valid base_revision for follow-on work."
  },
  {
    continuation_id: "shared.continuation.apply_authoring_intent.commit_handles_safe",
    applies_to_subject_id: "helper.command.author",
    kind: "commit_handles_are_safe_continuation_surfaces",
    summary: "Committed created_targets from author are safe continuation surfaces only for the returned resulting_revision."
  },
  {
    continuation_id: "shared.continuation.apply_authoring_intent.dry_run_handles_informational",
    applies_to_subject_id: "helper.command.author",
    kind: "dry_run_handles_are_informational_only",
    summary: "Dry-run created_targets from author are informational only and must not be reused in later requests."
  }
] as const;

const SHAPE_BY_ID = new Map<ContractShapeId, ContractShapeDescriptor>(SHAPES.map((shape) => [shape.shape_id, shape]));
const SUBJECT_BY_ID = new Map<ContractSubjectId, ContractSubjectDescriptor>(SUBJECTS.map((subject) => [subject.subject_id, subject]));

function getShape(shapeId: ContractShapeId | undefined): ContractShapeDescriptor | undefined {
  return shapeId ? SHAPE_BY_ID.get(shapeId) : undefined;
}

export function createContractIndex(): ContractIndex {
  return cloneValue({
    kind: "sdd-contract-index",
    contract_version: "0.1",
    summary: "Static shared contract index for helper and future MCP surfaces.",
    subjects: [...SUBJECTS],
    shapes: [...SHAPES]
  });
}

export function getContractSubjectDescriptor(subjectId: ContractSubjectId): ContractSubjectDescriptor | undefined {
  const subject = SUBJECT_BY_ID.get(subjectId);
  return subject ? cloneValue(subject) : undefined;
}

export function getContractSubjectRequestBody(subjectId: ContractSubjectId): HelperRequestBodySpec | undefined {
  const requestBody = REQUEST_BODIES.get(subjectId);
  return requestBody ? cloneValue(requestBody) : undefined;
}

export function getContractSubjectDetail(subjectId: ContractSubjectId): ContractSubjectDetail | undefined {
  const subject = SUBJECT_BY_ID.get(subjectId);
  if (!subject) {
    return undefined;
  }

  const inputShape = getShape(subject.input_shape_id);
  const outputShape = getShape(subject.output_shape_id);
  const applicableShapeIds = new Set<ContractShapeId>();
  if (inputShape) {
    applicableShapeIds.add(inputShape.shape_id);
  }
  if (outputShape) {
    applicableShapeIds.add(outputShape.shape_id);
  }

  const constraints = CONSTRAINTS.filter((constraint) => applicableShapeIds.has(constraint.applies_to_shape_id));
  const bindings = BINDINGS.filter((binding) => applicableShapeIds.has(binding.applies_to_shape_id));
  const continuation = CONTINUATIONS.filter((entry) => entry.applies_to_subject_id === subjectId);
  const requestBody = REQUEST_BODIES.get(subjectId);

  return cloneValue({
    kind: "sdd-contract-subject-detail",
    subject,
    input_shape: inputShape,
    output_shape: outputShape,
    request_body: requestBody,
    constraints,
    bindings,
    continuation,
    resolution: {
      mode: "static",
      unresolved_binding_ids: bindings.length > 0 ? bindings.map((binding) => binding.binding_id) : undefined
    }
  });
}
