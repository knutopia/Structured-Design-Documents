import type {
  ContractBindingSpec,
  ContractConstraintSpec,
  ContractContinuationSpec,
  ContractIndex,
  ContractPurpose,
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
    stage: stringSchema(["bundle", "authoring", "parse", "compile", "validate", "project", "render", "cli"]),
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
    ordering_changes: arraySchema({
      oneOf: [
        objectSchema(
          {
            kind: stringSchema(["top_level_node"]),
            target_handle: stringSchema(),
            old_index: integerSchema(),
            new_index: integerSchema()
          },
          ["kind", "target_handle", "old_index", "new_index"]
        ),
        objectSchema(
          {
            kind: stringSchema(["structural_edge", "nested_node_block"]),
            target_handle: stringSchema(),
            parent_handle: stringSchema(),
            old_index: integerSchema(),
            new_index: integerSchema()
          },
          ["kind", "target_handle", "parent_handle", "old_index", "new_index"]
        ),
        objectSchema(
          {
            kind: stringSchema(["reparented_node_block"]),
            target_handle: stringSchema(),
            old_parent_handle: { type: ["string", "null"] },
            new_parent_handle: { type: ["string", "null"] },
            old_index: integerSchema(),
            new_index: integerSchema()
          },
          ["kind", "target_handle", "old_parent_handle", "new_parent_handle", "old_index", "new_index"]
        )
      ]
    })
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

const reparentNodeBlockOpSchema = objectSchema(
  {
    kind: stringSchema(["reparent_node_block"]),
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
    moveNestedNodeBlockOpSchema,
    reparentNodeBlockOpSchema
  ]
};

const changeSetResultSchema = objectSchema(
  {
    kind: stringSchema(["sdd-change-set"]),
    change_set_id: stringSchema(),
    path: stringSchema(),
    origin: stringSchema(["apply_change_set", "apply_authoring_intent", "apply_addition_proposal", "undo_change_set", "create_document"]),
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
    detail_modes: arraySchema(stringSchema(["static", "bundle_resolved"])),
    contract_purposes: arraySchema(stringSchema(["request"]))
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

const nullableHandleSchema: JsonSchema = { type: ["string", "null"] };

const guidedExistingNodeRefSchema = objectSchema(
  {
    kind: stringSchema(["existing_node"]),
    handle: stringSchema(),
    node_id: stringSchema(),
    node_type: stringSchema(),
    name: stringSchema()
  },
  ["kind", "handle", "node_id", "node_type", "name"]
);

const beginGuidedAdditionRequestSchema = objectSchema(
  { workflow_version: stringSchema(["1.0"]), anchor: guidedExistingNodeRefSchema },
  ["workflow_version"]
);

const guidedExistingNodeSchema = objectSchema(
  {
    handle: stringSchema(),
    node_id: stringSchema(),
    node_type: stringSchema(),
    name: stringSchema(),
    parent_handle: nullableHandleSchema,
    source_order: integerSchema()
  },
  ["handle", "node_id", "node_type", "name", "parent_handle", "source_order"]
);

const guidedExistingEdgeSchema = objectSchema(
  {
    handle: stringSchema(),
    parent_handle: stringSchema(),
    from: stringSchema(),
    type: stringSchema(),
    to: stringSchema(),
    source_order: integerSchema()
  },
  ["handle", "parent_handle", "from", "type", "to", "source_order"]
);

const guidedDocumentSnapshotSchema = objectSchema(
  {
    kind: stringSchema(["sdd-guided-document-snapshot"]),
    document_ref: stringSchema(),
    path: stringSchema(),
    revision: stringSchema(),
    bundle_fingerprint: stringSchema(),
    effective_version: stringSchema(),
    nodes: arraySchema(guidedExistingNodeSchema),
    edges: arraySchema(guidedExistingEdgeSchema),
    top_level_order: stringArraySchema,
    body_order_by_parent: objectSchema({}, [], arraySchema(stringSchema())),
    diagnostics: arraySchema(diagnosticSchema)
  },
  [
    "kind",
    "document_ref",
    "revision",
    "bundle_fingerprint",
    "effective_version",
    "nodes",
    "edges",
    "top_level_order",
    "body_order_by_parent",
    "diagnostics"
  ]
);

const guidedFieldValueSchema = objectSchema(
  {
    field_id: stringSchema(),
    value_kind: stringSchema(["quoted_string", "bare_value"]),
    raw_value: stringSchema()
  },
  ["field_id", "value_kind", "raw_value"]
);

const guidedNewNodeRefSchema = objectSchema(
  {
    kind: stringSchema(["new_node"]),
    local_node_id: stringSchema(["node_1"])
  },
  ["kind", "local_node_id"]
);

const guidedNodeRefSchema: JsonSchema = {
  oneOf: [guidedExistingNodeRefSchema, guidedNewNodeRefSchema]
};

const endpointTripleSchema = objectSchema(
  {
    from_type: stringSchema(),
    relationship_type: stringSchema(),
    to_type: stringSchema()
  },
  ["from_type", "relationship_type", "to_type"]
);

const semanticSameLevelOrderSchema: JsonSchema = {
  oneOf: [
    objectSchema({ kind: stringSchema(["top_level_first"]) }, ["kind"]),
    objectSchema({ kind: stringSchema(["top_level_last"]) }, ["kind"]),
    objectSchema({ kind: stringSchema(["before_existing"]), node: guidedExistingNodeRefSchema }, ["kind", "node"]),
    objectSchema({ kind: stringSchema(["after_existing"]), node: guidedExistingNodeRefSchema }, ["kind", "node"])
  ]
};

const semanticNodeOrganizationSchema: JsonSchema = {
  oneOf: [
    objectSchema(
      { kind: stringSchema(["add_new_node_top_level"]), node: guidedNewNodeRefSchema, order: semanticSameLevelOrderSchema },
      ["kind", "node", "order"]
    ),
    objectSchema(
      {
        kind: stringSchema(["add_new_node_nested"]),
        node: guidedNewNodeRefSchema,
        parent: guidedNodeRefSchema,
        order: stringSchema(["only", "first", "last"])
      },
      ["kind", "node", "parent", "order"]
    ),
    objectSchema(
      {
        kind: stringSchema(["place_new_source_at_target_position"]),
        source: guidedNewNodeRefSchema,
        target: guidedExistingNodeRefSchema
      },
      ["kind", "source", "target"]
    ),
    objectSchema(
      { kind: stringSchema(["keep_existing_node"]), node: guidedExistingNodeRefSchema },
      ["kind", "node"]
    ),
    objectSchema(
      {
        kind: stringSchema(["move_existing_node"]),
        node: guidedExistingNodeRefSchema,
        destination_parent: guidedNodeRefSchema,
        order: stringSchema(["only", "first", "last"]),
        accepted_effect_id: stringSchema()
      },
      ["kind", "node", "destination_parent", "order", "accepted_effect_id"]
    )
  ]
};

const materialEffectSchema = objectSchema(
  {
    effect_id: stringSchema(),
    kind: stringSchema(["move_existing_node"]),
    node: guidedExistingNodeRefSchema,
    from_parent: { oneOf: [guidedExistingNodeRefSchema, { type: "null" }] },
    destination_parent: guidedNodeRefSchema,
    order: stringSchema(["only", "first", "last"]),
    accepted: booleanSchema()
  },
  ["effect_id", "kind", "node", "from_parent", "destination_parent", "order", "accepted"]
);

const proposedNodeSchema = objectSchema(
  {
    ref: guidedNewNodeRefSchema,
    node_type: stringSchema(),
    node_id: stringSchema(),
    name: stringSchema(),
    fields: arraySchema(guidedFieldValueSchema)
  },
  ["ref", "node_type", "node_id", "name", "fields"]
);

const proposedRelationshipSchema = objectSchema(
  {
    from: guidedNodeRefSchema,
    triple: endpointTripleSchema,
    to: guidedNodeRefSchema,
    fields: arraySchema(guidedFieldValueSchema)
  },
  ["from", "triple", "to", "fields"]
);

const completedAdditionProposalSchema = objectSchema(
  {
    kind: stringSchema(["sdd-addition-proposal"]),
    proposal_version: stringSchema(["1.0"]),
    proposal_id: stringSchema(),
    document_context: objectSchema(
      {
        document_ref: stringSchema(),
        path: stringSchema(),
        base_revision: stringSchema(),
        bundle_fingerprint: stringSchema()
      },
      ["document_ref", "base_revision", "bundle_fingerprint"]
    ),
    intent: objectSchema(
      {
        addition_kind: stringSchema(["standalone_node", "relationship"]),
        direction: stringSchema(["outgoing", "incoming"]),
        selection_order: stringSchema(["relationship_first", "existing_node_first"])
      },
      ["addition_kind"]
    ),
    guidance_context: objectSchema(
      {
        diagram_filters: arraySchema(objectSchema(
          { browse_id: stringSchema(), diagram_id: { type: ["string", "null"] } },
          ["browse_id", "diagram_id"]
        )),
        display_profile_id: stringSchema()
      },
      ["diagram_filters", "display_profile_id"]
    ),
    addition: {
      oneOf: [
        objectSchema(
          { kind: stringSchema(["standalone_node"]), node: proposedNodeSchema },
          ["kind", "node"]
        ),
        objectSchema(
          { kind: stringSchema(["relationship"]), relationship: proposedRelationshipSchema, new_node: proposedNodeSchema },
          ["kind", "relationship"]
        )
      ]
    },
    node_organization: arraySchema(semanticNodeOrganizationSchema),
    accepted_material_effects: arraySchema(materialEffectSchema)
  },
  [
    "kind", "proposal_version", "proposal_id", "document_context", "intent", "guidance_context",
    "addition", "node_organization", "accepted_material_effects"
  ]
);

const guidedAdditionActionSchema: JsonSchema = {
  oneOf: [
    objectSchema(
      { kind: stringSchema(["choose_addition_kind"]), addition_kind: stringSchema(["standalone_node", "relationship"]) },
      ["kind", "addition_kind"]
    ),
    objectSchema(
      { kind: stringSchema(["choose_starting_node"]), node: guidedExistingNodeRefSchema },
      ["kind", "node"]
    ),
    objectSchema(
      {
        kind: stringSchema(["choose_relationship_route"]),
        direction: stringSchema(["outgoing", "incoming"]),
        selection_order: stringSchema(["relationship_first", "existing_node_first"])
      },
      ["kind", "direction", "selection_order"]
    ),
    objectSchema(
      { kind: stringSchema(["open_diagram_filter"]), browse_id: stringSchema() },
      ["kind", "browse_id"]
    ),
    objectSchema(
      { kind: stringSchema(["set_diagram_filter"]), browse_id: stringSchema(), diagram_id: stringSchema() },
      ["kind", "browse_id", "diagram_id"]
    ),
    objectSchema(
      { kind: stringSchema(["clear_diagram_filter"]), browse_id: stringSchema() },
      ["kind", "browse_id"]
    ),
    objectSchema(
      { kind: stringSchema(["choose_standalone_node_type"]), node_type: stringSchema() },
      ["kind", "node_type"]
    ),
    objectSchema(
      { kind: stringSchema(["choose_relationship_combination"]), triple: endpointTripleSchema },
      ["kind", "triple"]
    ),
    objectSchema(
      { kind: stringSchema(["choose_existing_endpoint"]), node: guidedExistingNodeRefSchema, triple: endpointTripleSchema },
      ["kind", "node"]
    ),
    objectSchema(
      { kind: stringSchema(["create_new_endpoint"]), node_type: stringSchema() },
      ["kind", "node_type"]
    ),
    objectSchema(
      { kind: stringSchema(["choose_relationship_for_endpoint"]), triple: endpointTripleSchema },
      ["kind", "triple"]
    ),
    objectSchema(
      {
        kind: stringSchema(["submit_new_node_fields"]),
        local_node_id: stringSchema(["node_1"]),
        field_group: stringSchema(["primary", "additional"]),
        values: arraySchema(guidedFieldValueSchema)
      },
      ["kind", "local_node_id", "field_group", "values"]
    ),
    objectSchema(
      {
        kind: stringSchema(["submit_relationship_fields"]),
        local_edge_id: stringSchema(["edge_1"]),
        field_group: stringSchema(["required", "additional"]),
        values: arraySchema(guidedFieldValueSchema)
      },
      ["kind", "local_edge_id", "field_group", "values"]
    ),
    objectSchema(
      { kind: stringSchema(["set_node_detail_disclosure"]), disclose: booleanSchema() },
      ["kind", "disclose"]
    ),
    objectSchema(
      { kind: stringSchema(["set_relationship_detail_disclosure"]), disclose: booleanSchema() },
      ["kind", "disclose"]
    ),
    objectSchema(
      { kind: stringSchema(["choose_new_target_organization"]), organization: stringSchema(["nested", "top_level"]) },
      ["kind", "organization"]
    ),
    objectSchema(
      {
        kind: stringSchema(["choose_existing_target_organization"]),
        organization: stringSchema(["move_under_source", "leave_current"])
      },
      ["kind", "organization"]
    ),
    objectSchema(
      {
        kind: stringSchema(["choose_new_source_organization"]),
        organization: stringSchema(["wrap_target", "leave_target_current"])
      },
      ["kind", "organization"]
    ),
    objectSchema(
      { kind: stringSchema(["choose_sibling_order"]), order: stringSchema(["first", "last"]) },
      ["kind", "order"]
    ),
    objectSchema(
      { kind: stringSchema(["choose_same_level_order"]), order: semanticSameLevelOrderSchema },
      ["kind", "order"]
    ),
    objectSchema(
      { kind: stringSchema(["confirm_material_effect"]), effect_id: stringSchema() },
      ["kind", "effect_id"]
    ),
    objectSchema(
      { kind: stringSchema(["go_back"]), target_page_id: stringSchema() },
      ["kind", "target_page_id"]
    )
  ]
};

const guidedAdditionStateSchema = objectSchema(
  {
    kind: stringSchema(["sdd-guided-addition-state"]),
    workflow_version: stringSchema(["1.0"]),
    document_context: objectSchema(
      {
        document_ref: stringSchema(),
        revision: stringSchema(),
        bundle_fingerprint: stringSchema()
      },
      ["document_ref", "revision", "bundle_fingerprint"]
    ),
    anchor: guidedExistingNodeRefSchema,
    browse_filters: objectSchema({}, [], objectSchema({ diagram_id: { type: ["string", "null"] } }, ["diagram_id"])),
    progress: objectSchema({ kind: stringSchema() }, ["kind"], true),
    accepted_material_effects: arraySchema(materialEffectSchema)
  },
  ["kind", "workflow_version", "document_context", "browse_filters", "progress", "accepted_material_effects"]
);

const guidedFieldDefinitionSchema = objectSchema(
  {
    field_id: stringSchema(),
    label: stringSchema(),
    description: stringSchema(),
    required: booleanSchema(),
    prominence: stringSchema(["primary", "advanced"]),
    value_kind: stringSchema(["quoted_string", "bare_value"]),
    suggested_raw_value: stringSchema(),
    allowed_values: stringArraySchema
  },
  ["field_id", "label", "required", "prominence", "value_kind"]
);

const guidedPageContentSchema = objectSchema(
  { title: stringSchema(), prompt: stringSchema(), lines: stringArraySchema },
  ["title", "lines"]
);

const guidedChoiceSchema = objectSchema(
  {
    choice_id: stringSchema(),
    display: stringSchema(),
    description: stringSchema(),
    chosen: stringSchema(),
    recommended: booleanSchema(),
    action: guidedAdditionActionSchema
  },
  ["choice_id", "display", "chosen", "recommended", "action"]
);

const guidedChoicePageSchema = objectSchema(
  {
    page_id: stringSchema(),
    page_kind: stringSchema([
      "choose_addition_kind", "browse_starting_node", "choose_relationship_route", "browse_standalone_node_type",
      "browse_relationship_combination", "browse_relationship_endpoint", "browse_existing_endpoint",
      "choose_relationship_for_endpoint", "choose_node_detail_disclosure", "choose_relationship_detail_disclosure",
      "choose_new_target_organization", "choose_existing_target_organization", "choose_new_source_organization",
      "choose_sibling_order", "choose_same_level_order", "confirm_material_effect", "browse_diagram_filter"
    ]),
    content: guidedPageContentSchema,
    choices: arraySchema(guidedChoiceSchema)
  },
  ["page_id", "page_kind", "content", "choices"]
);

const guidedFormPageSchema = objectSchema(
  {
    page_id: stringSchema(),
    page_kind: stringSchema(["edit_new_node", "edit_relationship_details"]),
    content: guidedPageContentSchema,
    fields: arraySchema(guidedFieldDefinitionSchema),
    submit_action: guidedAdditionActionSchema
  },
  ["page_id", "page_kind", "content", "fields", "submit_action"]
);

const guidedAdditionResultSchema: JsonSchema = {
  oneOf: [
    objectSchema(
      {
        kind: stringSchema(["sdd-guided-addition-step"]),
        api_version: stringSchema(["1.0"]),
        state: guidedAdditionStateSchema,
        page: { oneOf: [guidedChoicePageSchema, guidedFormPageSchema] },
        diagnostics: arraySchema(diagnosticSchema)
      },
      ["kind", "api_version", "state", "page", "diagnostics"]
    ),
    objectSchema(
      {
        kind: stringSchema(["sdd-guided-addition-complete"]),
        api_version: stringSchema(["1.0"]),
        state: guidedAdditionStateSchema,
        proposal: completedAdditionProposalSchema,
        review: objectSchema(
          { title: stringSchema(["Review proposed addition"]), lines: stringArraySchema },
          ["title", "lines"]
        ),
        diagnostics: arraySchema(diagnosticSchema)
      },
      ["kind", "api_version", "state", "proposal", "review", "diagnostics"]
    )
  ]
};

const guidedAdditionBeginArgsSchema = objectSchema(
  {
    snapshot: guidedDocumentSnapshotSchema,
    request: beginGuidedAdditionRequestSchema
  },
  ["snapshot", "request"]
);

const guidedAdditionAdvanceArgsSchema = objectSchema(
  {
    snapshot: guidedDocumentSnapshotSchema,
    state: guidedAdditionStateSchema,
    action: guidedAdditionActionSchema
  },
  ["snapshot", "state", "action"]
);

const applyAdditionProposalArgsSchema = objectSchema(
  {
    proposal: completedAdditionProposalSchema,
    mode: stringSchema(["dry_run", "commit"]),
    validate_profile: stringSchema(),
    projection_views: stringArraySchema,
    accepted_warning_token: stringSchema()
  },
  ["proposal"]
);

const applyAdditionProposalResultSchema = objectSchema(
  {
    kind: stringSchema(["sdd-addition-proposal-result"]),
    proposal: completedAdditionProposalSchema,
    base_revision: stringSchema(),
    resulting_revision: stringSchema(),
    mode: stringSchema(["dry_run", "commit"]),
    status: stringSchema(["applied", "rejected"]),
    change_set: changeSetResultSchema,
    created_targets: arraySchema(createdTargetSchema),
    diagnostics: arraySchema(diagnosticSchema),
    warning_review: objectSchema(
      {
        title: stringSchema(["Warning"]),
        lines: stringArraySchema,
        acceptance_token: stringSchema()
      },
      ["title", "lines", "acceptance_token"]
    )
  },
  ["kind", "proposal", "base_revision", "mode", "status", "change_set", "created_targets", "diagnostics"]
);

const contractSubjectDescriptorSchema = objectSchema(
  {
    subject_id: stringSchema(),
    surface_kind: stringSchema(["helper_command", "domain_service", "mcp_tool", "mcp_resource", "mcp_prompt"]),
    surface_name: stringSchema(),
    summary: stringSchema(),
    stability: stringSchema(["stable", "experimental", "deprecated"]),
    mutates_repo_state: stringSchema(["never", "conditional", "always"]),
    input_shape_id: stringSchema(),
    output_shape_id: stringSchema(),
    detail_modes: arraySchema(stringSchema(["static", "bundle_resolved"])),
    contract_purposes: arraySchema(stringSchema(["request"])),
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
      "undo_change_set_eligibility",
      "commit_safe_continuation",
      "dry_run_informational_only",
      "same_document_revision",
      "same_bundle_fingerprint",
      "currently_offered_opaque_option",
      "exact_confirmation",
      "proposal_relationship_edge_consistency",
      "canonical_proposal_identity",
      "bound_warning_acceptance"
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
      "inspect_may_fail_on_empty_bootstrap",
      "caller_carried_state",
      "completed_proposal_handoff",
      "dry_run_to_commit_same_proposal"
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

const contractFieldFormatHintSchema = objectSchema(
  {
    hint_id: stringSchema(),
    applies_to_shape_id: stringSchema(),
    applies_to_json_pointers: stringArraySchema,
    source: stringSchema(),
    accepted_pattern: stringSchema(),
    accepted_forms: stringArraySchema,
    examples: stringArraySchema,
    json_examples: arraySchema(
      objectSchema(
        {
          json: stringSchema(),
          renders: stringSchema()
        },
        ["json", "renders"]
      )
    ),
    concise: stringSchema()
  },
  ["hint_id", "applies_to_shape_id", "applies_to_json_pointers", "source", "concise"]
);

const contractAuthoringFormatCardSchema = objectSchema(
  {
    card_id: stringSchema(),
    summary: stringSchema(),
    source: stringSchema(),
    lines: stringArraySchema,
    field_hints: arraySchema(contractFieldFormatHintSchema)
  },
  ["card_id", "summary", "source", "lines", "field_hints"]
);

const contractSubjectDetailSchema = objectSchema(
  {
    kind: stringSchema(["sdd-contract-subject-detail"]),
    subject: contractSubjectDescriptorSchema,
    invocation: stringSchema(),
    input_shape: contractShapeDescriptorSchema,
    output_shape: contractShapeDescriptorSchema,
    request_body: helperRequestBodySpecSchema,
    constraints: arraySchema(contractConstraintSpecSchema),
    bindings: arraySchema(contractBindingSpecSchema),
    continuation: arraySchema(contractContinuationSpecSchema),
    examples: arraySchema(contractExampleSpecSchema),
    authoring_format_card: contractAuthoringFormatCardSchema,
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

const CONTRACT_PURPOSES: readonly ContractPurpose[] = ["request"];

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
    shape_id: "shared.shape.guided_document_snapshot",
    summary: "Immutable guided document snapshot bound to one source revision and bundle fingerprint.",
    schema_format: "json_schema_2020_12",
    schema: guidedDocumentSnapshotSchema,
    stability: "stable"
  },
  {
    shape_id: "shared.shape.begin_guided_addition_request",
    summary: "Versioned v1 Guided Addition request with an optional exact starting-node anchor.",
    schema_format: "json_schema_2020_12",
    schema: beginGuidedAdditionRequestSchema,
    stability: "stable"
  },
  {
    shape_id: "shared.shape.guided_addition_begin_args",
    summary: "Complete argument envelope for GuidedAdditionRuntime.begin(snapshot, request).",
    schema_format: "json_schema_2020_12",
    schema: guidedAdditionBeginArgsSchema,
    stability: "stable"
  },
  {
    shape_id: "shared.shape.guided_addition_state",
    summary: "Serializable caller-carried guided addition workflow state.",
    schema_format: "json_schema_2020_12",
    schema: guidedAdditionStateSchema,
    stability: "stable"
  },
  {
    shape_id: "shared.shape.guided_addition_action",
    summary: "One normalized action submitted against the currently offered guided step.",
    schema_format: "json_schema_2020_12",
    schema: guidedAdditionActionSchema,
    stability: "stable"
  },
  {
    shape_id: "shared.shape.guided_addition_advance_args",
    summary: "Complete argument envelope for GuidedAdditionRuntime.advance(snapshot, state, action).",
    schema_format: "json_schema_2020_12",
    schema: guidedAdditionAdvanceArgsSchema,
    stability: "stable"
  },
  {
    shape_id: "shared.shape.guided_addition_result",
    summary: "Guided workflow step or completed-proposal result.",
    schema_format: "json_schema_2020_12",
    schema: guidedAdditionResultSchema,
    stability: "stable"
  },
  {
    shape_id: "shared.shape.completed_addition_proposal",
    summary: "Completed v1 semantic proposal with organization decisions and exact accepted material effects.",
    schema_format: "json_schema_2020_12",
    schema: completedAdditionProposalSchema,
    stability: "stable"
  },
  {
    shape_id: "shared.shape.apply_addition_proposal_args",
    summary: "Write-side guided proposal application arguments.",
    schema_format: "json_schema_2020_12",
    schema: applyAdditionProposalArgsSchema,
    stability: "stable"
  },
  {
    shape_id: "shared.shape.apply_addition_proposal_result",
    summary: "Structured applied or rejected guided proposal result.",
    schema_format: "json_schema_2020_12",
    schema: applyAdditionProposalResultSchema,
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
        resolve: stringSchema(["bundle"]),
        purpose: stringSchema(["request"])
      },
      ["subject_id"]
    ),
    stability: "stable"
  },
  {
    shape_id: "shared.shape.contract_subject_detail",
    summary: "Deep static contract detail for one helper, domain, or future MCP subject.",
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
    contract_purposes: [...CONTRACT_PURPOSES],
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
    detail_modes: ["static", "bundle_resolved"],
    contract_purposes: [...CONTRACT_PURPOSES],
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
    detail_modes: ["static", "bundle_resolved"],
    contract_purposes: [...CONTRACT_PURPOSES],
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
    detail_modes: ["static", "bundle_resolved"],
    contract_purposes: [...CONTRACT_PURPOSES],
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
  },
  {
    subject_id: "domain.service.guided_addition.begin",
    surface_kind: "domain_service",
    surface_name: "guided_addition.begin",
    summary: "Begin the pure guided addition workflow from an immutable snapshot and normalized request.",
    stability: "stable",
    mutates_repo_state: "never",
    input_shape_id: "shared.shape.guided_addition_begin_args",
    output_shape_id: "shared.shape.guided_addition_result",
    detail_modes: ["static", "bundle_resolved"],
    has_deep_introspection: true
  },
  {
    subject_id: "domain.service.guided_addition.advance",
    surface_kind: "domain_service",
    surface_name: "guided_addition.advance",
    summary: "Advance the pure guided addition workflow with caller-carried state and one offered action.",
    stability: "stable",
    mutates_repo_state: "never",
    input_shape_id: "shared.shape.guided_addition_advance_args",
    output_shape_id: "shared.shape.guided_addition_result",
    detail_modes: ["static", "bundle_resolved"],
    has_deep_introspection: true
  },
  {
    subject_id: "domain.service.addition_proposal.apply",
    surface_kind: "domain_service",
    surface_name: "addition_proposal.apply",
    summary: "Verify and apply or dry-run one completed guided addition proposal through shared mutation machinery.",
    stability: "stable",
    mutates_repo_state: "conditional",
    input_shape_id: "shared.shape.apply_addition_proposal_args",
    output_shape_id: "shared.shape.apply_addition_proposal_result",
    detail_modes: ["static", "bundle_resolved"],
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

const REQUEST_INVOCATIONS = new Map<ContractSubjectId, string>([
  ["helper.command.create", "sdd-helper create <document_path> [--version <version>]"]
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
    constraint_id: "shared.constraint.undo_change_set.target_is_eligible_current_revision",
    applies_to_shape_id: "shared.shape.undo_change_set_args",
    applies_to_json_pointers: ["/change_set_id"],
    kind: "undo_change_set_eligibility",
    parameters: {
      change_set_id_pointer: "/change_set_id",
      record_source: "helper_change_set_journal",
      target_record_required: true,
      change_set_id_is_opaque: true,
      caller_must_use_prior_helper_result_id: true,
      dry_run_records_are_not_undo_targets: true,
      required_target_change_set: {
        mode: "commit",
        status: "applied",
        undo_eligible: true
      },
      supported_inverse_kinds: ["restore_document", "delete_document"],
      target_resulting_revision_required: true,
      current_document_revision_must_equal: "target.change_set.resulting_revision",
      target_path_source: "target.change_set.path",
      expected_revision_source: "target.change_set.resulting_revision",
      default_mode: "dry_run",
      commit_guidance: "Dry-run first; commit only when the returned assessment permits it."
    },
    summary:
      "Undo targets must be existing committed, applied, undo-eligible helper change-set records whose supported inverse still matches the current document revision."
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
  },
  {
    constraint_id: "shared.constraint.guided_addition.begin.same_bundle_fingerprint",
    applies_to_shape_id: "shared.shape.guided_addition_begin_args",
    applies_to_json_pointers: ["/snapshot/bundle_fingerprint"],
    kind: "same_bundle_fingerprint",
    parameters: {
      must_equal: "runtime.guidance_catalog.bundle_fingerprint"
    },
    summary: "The snapshot bundle fingerprint must match the immutable catalog used by the guided runtime."
  },
  {
    constraint_id: "shared.constraint.guided_addition.advance.same_document_revision",
    applies_to_shape_id: "shared.shape.guided_addition_advance_args",
    applies_to_json_pointers: ["/snapshot/revision", "/state/document_context/revision"],
    kind: "same_document_revision",
    parameters: {
      equality_group: ["/snapshot/revision", "/state/document_context/revision"]
    },
    summary: "Caller-carried state is valid only for the exact snapshot document revision."
  },
  {
    constraint_id: "shared.constraint.guided_addition.advance.same_bundle_fingerprint",
    applies_to_shape_id: "shared.shape.guided_addition_advance_args",
    applies_to_json_pointers: ["/snapshot/bundle_fingerprint", "/state/document_context/bundle_fingerprint"],
    kind: "same_bundle_fingerprint",
    parameters: {
      equality_group: ["/snapshot/bundle_fingerprint", "/state/document_context/bundle_fingerprint"],
      must_equal: "runtime.guidance_catalog.bundle_fingerprint"
    },
    summary: "Snapshot, state, and guided runtime must share one bundle fingerprint."
  },
  {
    constraint_id: "shared.constraint.guided_addition.advance.currently_offered_action",
    applies_to_shape_id: "shared.shape.guided_addition_advance_args",
    applies_to_json_pointers: ["/action"],
    kind: "currently_offered_opaque_option",
    parameters: {
      offered_by: "runtime.advance_recomputed_current_step",
      opaque_id_pointers: [
        "/action/browse_id",
        "/action/effect_id",
        "/action/target_page_id"
      ]
    },
    summary: "Actions and opaque identifiers must be present in the options recomputed for the exact current step."
  },
  {
    constraint_id: "shared.constraint.guided_addition.advance.exact_confirmation",
    applies_to_shape_id: "shared.shape.guided_addition_advance_args",
    applies_to_json_pointers: ["/action/effect_id", "/state/accepted_material_effects/*"],
    kind: "exact_confirmation",
    parameters: {
      action_kind: "confirm_material_effect",
      must_equal: "recomputed_current_effect",
      accepted_literal: true
    },
    summary: "A confirmation must be the exact current effect bound to revision, bundle, relationship, target, parents, and placement."
  },
  {
    constraint_id: "shared.constraint.addition_proposal.apply.same_document_revision",
    applies_to_shape_id: "shared.shape.apply_addition_proposal_args",
    applies_to_json_pointers: ["/proposal/document_context/base_revision"],
    kind: "same_document_revision",
    parameters: {
      must_equal: "current_document.revision"
    },
    summary: "A proposal applies only to the current persisted document revision."
  },
  {
    constraint_id: "shared.constraint.addition_proposal.apply.same_bundle_fingerprint",
    applies_to_shape_id: "shared.shape.apply_addition_proposal_args",
    applies_to_json_pointers: ["/proposal/document_context/bundle_fingerprint"],
    kind: "same_bundle_fingerprint",
    parameters: {
      must_equal: "current_bundle.fingerprint"
    },
    summary: "A proposal applies only under the exact bundle fingerprint against which it completed."
  },
  {
    constraint_id: "shared.constraint.addition_proposal.apply.exact_confirmation",
    applies_to_shape_id: "shared.shape.apply_addition_proposal_args",
    applies_to_json_pointers: ["/proposal/accepted_material_effects/*"],
    kind: "exact_confirmation",
    parameters: {
      must_equal: "recomputed_required_effects",
      confirmation_required_for_each_effect: true
    },
    summary: "All currently required effects must carry exact current confirmations and no stale confirmations."
  },
  {
    constraint_id: "shared.constraint.addition_proposal.apply.relationship_edge_consistency",
    applies_to_shape_id: "shared.shape.apply_addition_proposal_args",
    applies_to_json_pointers: ["/proposal/addition/relationship"],
    kind: "proposal_relationship_edge_consistency",
    parameters: {
      equality_fields: ["from", "triple", "to"],
      relationship_absent_requires_standalone_intent: true
    },
    summary: "Relationship proposals must carry one canonical endpoint triple consistent with their intent and organization."
  },
  {
    constraint_id: "shared.constraint.addition_proposal.apply.canonical_identity",
    applies_to_shape_id: "shared.shape.apply_addition_proposal_args",
    applies_to_json_pointers: ["/proposal/proposal_id"],
    kind: "canonical_proposal_identity",
    parameters: { canonical_input: "proposal_without_proposal_id" },
    summary: "proposal_id must be the canonical identity of the complete v1 proposal payload."
  },
  {
    constraint_id: "shared.constraint.addition_proposal.apply.bound_warning_acceptance",
    applies_to_shape_id: "shared.shape.apply_addition_proposal_args",
    applies_to_json_pointers: ["/accepted_warning_token"],
    kind: "bound_warning_acceptance",
    parameters: {
      required_when: "commit_candidate_has_warnings",
      binds: ["proposal_id", "document_path", "base_revision", "bundle_fingerprint", "resulting_revision", "sorted_warning_set"]
    },
    summary: "A warned commit requires the token returned for the exact proposal, revisions, bundle, result, and warning set."
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
  },
  {
    binding_id: "shared.binding.apply_change_set.validate_profile",
    applies_to_shape_id: "shared.shape.apply_change_set_args",
    applies_to_json_pointer: "/validate_profile",
    kind: "bundle_value_set",
    bundle_source: {
      artifact: "manifest_profiles",
      selector: "profiles"
    },
    static_behavior: "reference_only",
    bundle_resolved_behavior: "expand_values",
    summary: "Apply validate_profile is bundle-owned and must be resolved from the active bundle profiles list."
  },
  {
    binding_id: "shared.binding.apply_change_set.projection_views",
    applies_to_shape_id: "shared.shape.apply_change_set_args",
    applies_to_json_pointer: "/projection_views/*",
    kind: "bundle_value_set",
    bundle_source: {
      artifact: "views_yaml",
      selector: "views"
    },
    static_behavior: "reference_only",
    bundle_resolved_behavior: "expand_values",
    summary: "Apply projection_views entries are bundle-owned and must be resolved from the active bundle views list."
  },
  {
    binding_id: "shared.binding.undo_change_set.validate_profile",
    applies_to_shape_id: "shared.shape.undo_change_set_args",
    applies_to_json_pointer: "/validate_profile",
    kind: "bundle_value_set",
    bundle_source: {
      artifact: "manifest_profiles",
      selector: "profiles"
    },
    static_behavior: "reference_only",
    bundle_resolved_behavior: "expand_values",
    summary: "Undo validate_profile is optional, bundle-owned, and must be resolved from the active bundle profiles list when supplied."
  },
  {
    binding_id: "shared.binding.guided_addition.begin.anchor_node_type",
    applies_to_shape_id: "shared.shape.guided_addition_begin_args",
    applies_to_json_pointer: "/request/anchor/node_type",
    kind: "bundle_value_set",
    bundle_source: { artifact: "vocab_node_types", selector: "node_types" },
    static_behavior: "reference_only",
    bundle_resolved_behavior: "expand_values",
    summary: "An exact anchor carries a bundle-defined node type."
  },
  {
    binding_id: "shared.binding.guided_addition.advance.action_diagram_id",
    applies_to_shape_id: "shared.shape.guided_addition_advance_args",
    applies_to_json_pointer: "/action/diagram_id",
    kind: "bundle_value_set",
    bundle_source: { artifact: "views_yaml", selector: "views" },
    static_behavior: "reference_only",
    bundle_resolved_behavior: "expand_values",
    summary: "A diagram-filter action may select only a bundle-defined diagram."
  },
  {
    binding_id: "shared.binding.guided_addition.advance.node_type",
    applies_to_shape_id: "shared.shape.guided_addition_advance_args",
    applies_to_json_pointer: "/action/node_type",
    kind: "bundle_value_set",
    bundle_source: { artifact: "vocab_node_types", selector: "node_types" },
    static_behavior: "reference_only",
    bundle_resolved_behavior: "expand_values",
    summary: "A choose_node_type action references a bundle-defined node type returned by the planner."
  },
  {
    binding_id: "shared.binding.guided_addition.result.display_profile_id",
    applies_to_shape_id: "shared.shape.guided_addition_result",
    applies_to_json_pointer: "/proposal/guidance_context/display_profile_id",
    kind: "bundle_value_set",
    bundle_source: { artifact: "manifest_profiles", selector: "profiles" },
    static_behavior: "reference_only",
    bundle_resolved_behavior: "expand_values",
    summary: "Completed guided results record the bundle-defined display profile used for guidance."
  },
  {
    binding_id: "shared.binding.guided_addition.result.diagram_id",
    applies_to_shape_id: "shared.shape.guided_addition_result",
    applies_to_json_pointer: "/proposal/guidance_context/diagram_filters/*/diagram_id",
    kind: "bundle_value_set",
    bundle_source: { artifact: "views_yaml", selector: "views" },
    static_behavior: "reference_only",
    bundle_resolved_behavior: "expand_values",
    summary: "Completed guided results record only bundle-defined diagram filters."
  },
  {
    binding_id: "shared.binding.addition_proposal.apply.diagram_id",
    applies_to_shape_id: "shared.shape.apply_addition_proposal_args",
    applies_to_json_pointer: "/proposal/guidance_context/diagram_filters/*/diagram_id",
    kind: "bundle_value_set",
    bundle_source: { artifact: "views_yaml", selector: "views" },
    static_behavior: "reference_only",
    bundle_resolved_behavior: "expand_values",
    summary: "Proposal guidance context may reference only bundle-defined diagrams."
  },
  {
    binding_id: "shared.binding.addition_proposal.apply.display_profile_id",
    applies_to_shape_id: "shared.shape.apply_addition_proposal_args",
    applies_to_json_pointer: "/proposal/guidance_context/display_profile_id",
    kind: "bundle_value_set",
    bundle_source: { artifact: "manifest_profiles", selector: "profiles" },
    static_behavior: "reference_only",
    bundle_resolved_behavior: "expand_values",
    summary: "Proposal guidance context may reference a bundle-defined display profile."
  },
  {
    binding_id: "shared.binding.addition_proposal.apply.node_type",
    applies_to_shape_id: "shared.shape.apply_addition_proposal_args",
    applies_to_json_pointer: "/proposal/addition/node/node_type",
    kind: "bundle_value_set",
    bundle_source: { artifact: "vocab_node_types", selector: "node_types" },
    static_behavior: "reference_only",
    bundle_resolved_behavior: "expand_values",
    summary: "Standalone proposed node types are resolved from the active bundle vocabulary."
  },
  {
    binding_id: "shared.binding.addition_proposal.apply.relationship_type",
    applies_to_shape_id: "shared.shape.apply_addition_proposal_args",
    applies_to_json_pointer: "/proposal/addition/relationship/triple/relationship_type",
    kind: "bundle_value_set",
    bundle_source: { artifact: "vocab_relationship_types", selector: "relationship_types" },
    static_behavior: "reference_only",
    bundle_resolved_behavior: "expand_values",
    summary: "Proposed relationship types are resolved from the active bundle vocabulary."
  },
  {
    binding_id: "shared.binding.addition_proposal.apply.validate_profile",
    applies_to_shape_id: "shared.shape.apply_addition_proposal_args",
    applies_to_json_pointer: "/validate_profile",
    kind: "bundle_value_set",
    bundle_source: { artifact: "manifest_profiles", selector: "profiles" },
    static_behavior: "reference_only",
    bundle_resolved_behavior: "expand_values",
    summary: "Proposal validation feedback uses a bundle-defined validation profile."
  },
  {
    binding_id: "shared.binding.addition_proposal.apply.projection_views",
    applies_to_shape_id: "shared.shape.apply_addition_proposal_args",
    applies_to_json_pointer: "/projection_views/*",
    kind: "bundle_value_set",
    bundle_source: { artifact: "views_yaml", selector: "views" },
    static_behavior: "reference_only",
    bundle_resolved_behavior: "expand_values",
    summary: "Requested proposal projections use bundle-defined view identifiers."
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
  },
  {
    continuation_id: "shared.continuation.guided_addition.begin.caller_carried_state",
    applies_to_subject_id: "domain.service.guided_addition.begin",
    kind: "caller_carried_state",
    summary: "The caller carries the returned immutable state into the next advance call with the same snapshot.",
    parameters: {
      state_pointer: "/state",
      next_subject_id: "domain.service.guided_addition.advance"
    }
  },
  {
    continuation_id: "shared.continuation.guided_addition.advance.caller_carried_state",
    applies_to_subject_id: "domain.service.guided_addition.advance",
    kind: "caller_carried_state",
    summary: "Each step result returns the complete state required for the next advance call.",
    parameters: {
      state_pointer: "/state",
      same_snapshot_required: true
    }
  },
  {
    continuation_id: "shared.continuation.guided_addition.advance.completed_proposal_handoff",
    applies_to_subject_id: "domain.service.guided_addition.advance",
    kind: "completed_proposal_handoff",
    summary: "A completed result hands the exact proposal to the shared addition-proposal apply service.",
    parameters: {
      when_result_kind: "sdd-guided-addition-complete",
      proposal_pointer: "/proposal",
      next_subject_id: "domain.service.addition_proposal.apply"
    }
  },
  {
    continuation_id: "shared.continuation.addition_proposal.apply.dry_run_to_commit_same_proposal",
    applies_to_subject_id: "domain.service.addition_proposal.apply",
    kind: "dry_run_to_commit_same_proposal",
    summary: "Commit reuses the exact dry-run proposal and, when warned, the acceptance token bound to that exact candidate.",
    parameters: {
      dry_run_mode: "dry_run",
      commit_mode: "commit",
      proposal_identity: "same_object_or_byte_identical_canonical_value",
      warning_acceptance: "exact_dry_run_warning_token_when_warnings_exist"
    }
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
    summary: "Static shared contract index for helper, domain service, and future MCP surfaces.",
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

export function selectContractSubjectDetailForPurpose(
  detail: ContractSubjectDetail,
  purpose: ContractPurpose
): ContractSubjectDetail | undefined {
  if (!detail.subject.contract_purposes?.includes(purpose)) {
    return undefined;
  }

  if (purpose === "request") {
    const requestShapeIds = new Set<ContractShapeId>();
    if (detail.input_shape) {
      requestShapeIds.add(detail.input_shape.shape_id);
    }

    const selected: ContractSubjectDetail = {
      kind: "sdd-contract-subject-detail",
      subject: detail.subject,
      ...(REQUEST_INVOCATIONS.has(detail.subject.subject_id)
        ? { invocation: REQUEST_INVOCATIONS.get(detail.subject.subject_id) }
        : {}),
      ...(detail.input_shape ? { input_shape: detail.input_shape } : {}),
      ...(detail.request_body ? { request_body: detail.request_body } : {}),
      constraints: detail.constraints.filter((constraint) => requestShapeIds.has(constraint.applies_to_shape_id)),
      bindings: detail.bindings.filter((binding) => requestShapeIds.has(binding.applies_to_shape_id)),
      continuation:
        detail.subject.subject_id === "helper.command.create"
          ? detail.continuation
          : [],
      ...(detail.authoring_format_card ? { authoring_format_card: detail.authoring_format_card } : {}),
      resolution: detail.resolution
    };

    return cloneValue(selected);
  }

  return undefined;
}

export function getContractSubjectDetailForPurpose(
  subjectId: ContractSubjectId,
  purpose: ContractPurpose
): ContractSubjectDetail | undefined {
  const detail = getContractSubjectDetail(subjectId);
  return detail ? selectContractSubjectDetailForPurpose(detail, purpose) : undefined;
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
