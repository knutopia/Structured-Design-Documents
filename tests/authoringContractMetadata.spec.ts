import { describe, expect, it } from "vitest";
import {
  createContractIndex,
  getContractSubjectDescriptor,
  getContractSubjectDetail,
  getContractSubjectDetailForPurpose
} from "../src/authoring/contractMetadata.js";
import type { ContractShapeId, ContractSubjectId } from "../src/authoring/contracts.js";

type JsonSchemaObject = {
  properties?: Record<string, unknown>;
  required?: string[];
};

const ASSESSMENT_REQUIRED_FIELDS = [
  "kind",
  "outcome",
  "layer",
  "can_commit",
  "can_render",
  "should_stop",
  "next_action",
  "blocking_diagnostics",
  "summary"
];

const ASSESSMENT_LAYER_VALUES = [
  "transport",
  "request_shape",
  "domain_rejection",
  "candidate_diagnostics",
  "persisted_validation",
  "projection",
  "render",
  "success"
];

function getShapeSchema(shapeId: ContractShapeId): JsonSchemaObject {
  const shape = createContractIndex().shapes.find((candidate) => candidate.shape_id === shapeId);
  expect(shape).toBeDefined();
  return shape!.schema as JsonSchemaObject;
}

function expectOptionalAssessment(schema: JsonSchemaObject): void {
  expect(schema.properties?.assessment).toMatchObject({
    type: "object",
    properties: {
      kind: {
        type: "string",
        enum: ["sdd-authoring-outcome-assessment"]
      }
    },
    required: ASSESSMENT_REQUIRED_FIELDS
  });
  expect(schema.required ?? []).not.toContain("assessment");
}

describe("authoring contract metadata", () => {
  it("returns all current helper command subject ids in stable order", () => {
    const index = createContractIndex();

    expect(index.kind).toBe("sdd-contract-index");
    expect(index.contract_version).toBe("0.1");
    expect(index.subjects.filter((subject) => subject.surface_kind === "helper_command").map((subject) => subject.subject_id)).toEqual([
      "helper.command.inspect",
      "helper.command.search",
      "helper.command.create",
      "helper.command.apply",
      "helper.command.author",
      "helper.command.undo",
      "helper.command.validate",
      "helper.command.project",
      "helper.command.preview",
      "helper.command.git-status",
      "helper.command.git-commit",
      "helper.command.contract",
      "helper.command.capabilities"
    ]);
  });

  it("exposes the shared authoring outcome assessment shape", () => {
    const schema = getShapeSchema("shared.shape.authoring_outcome_assessment");

    expect(schema).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: ASSESSMENT_REQUIRED_FIELDS,
      properties: {
        kind: {
          type: "string",
          enum: ["sdd-authoring-outcome-assessment"]
        },
        outcome: {
          type: "string",
          enum: ["acceptable", "blocked", "review_required"]
        },
        layer: {
          type: "string",
          enum: ASSESSMENT_LAYER_VALUES
        },
        can_commit: {
          type: "boolean"
        },
        can_render: {
          type: "boolean"
        },
        should_stop: {
          type: "boolean"
        },
        next_action: {
          type: "string"
        },
        blocking_diagnostics: {
          type: "array",
          items: {
            type: "object",
            properties: {
              severity: {
                type: "string",
                enum: ["error", "warn", "info"]
              }
            }
          }
        },
        summary: {
          type: "string"
        }
      }
    });
  });

  it("marks assessment optional on assessment-bearing result schemas", () => {
    const shapeIds: ContractShapeId[] = [
      "shared.shape.create_document_result",
      "shared.shape.apply_change_set_result",
      "shared.shape.apply_authoring_intent_result",
      "shared.shape.undo_change_set_result",
      "shared.shape.validation_resource",
      "shared.shape.projection_resource",
      "shared.shape.render_preview_result"
    ];

    for (const shapeId of shapeIds) {
      expectOptionalAssessment(getShapeSchema(shapeId));
    }
  });

  it("describes reparent operations and discriminated reparent summaries", () => {
    const applySchema = getShapeSchema("shared.shape.apply_change_set_args") as any;
    const operationKinds = applySchema.properties.operations.items.oneOf.map(
      (operation: any) => operation.properties.kind.enum[0]
    );
    expect(operationKinds).toContain("reparent_node_block");
    const reparentOperation = applySchema.properties.operations.items.oneOf.find(
      (operation: any) => operation.properties.kind.enum[0] === "reparent_node_block"
    );
    expect(reparentOperation.required).toEqual(["kind", "node_handle", "placement"]);

    const resultSchema = getShapeSchema("shared.shape.apply_change_set_result") as any;
    const summaryVariants = resultSchema.properties.summary.properties.ordering_changes.items.oneOf;
    const reparentSummary = summaryVariants.find(
      (variant: any) => variant.properties.kind.enum[0] === "reparented_node_block"
    );
    expect(reparentSummary.required).toEqual([
      "kind",
      "target_handle",
      "old_parent_handle",
      "new_parent_handle",
      "old_index",
      "new_index"
    ]);
  });

  it("exposes helper error result schema with optional diagnostics and assessment", () => {
    const schema = getShapeSchema("shared.shape.helper_error_result");

    expect(schema).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: ["kind", "code", "message"],
      properties: {
        kind: {
          type: "string",
          enum: ["sdd-helper-error"]
        },
        code: {
          type: "string",
          enum: ["invalid_args", "invalid_json", "runtime_error"]
        },
        message: {
          type: "string"
        },
        diagnostics: {
          type: "array"
        }
      }
    });
    expectOptionalAssessment(schema);
    expect(schema.required ?? []).not.toContain("diagnostics");
  });

  it("exposes optional assessment through author and apply deep introspection", () => {
    const subjectIds: ContractSubjectId[] = ["helper.command.author", "helper.command.apply"];

    for (const subjectId of subjectIds) {
      const detail = getContractSubjectDetail(subjectId);
      expect(detail).toBeDefined();
      expectOptionalAssessment(detail!.output_shape!.schema as JsonSchemaObject);
    }
  });

  it("returns author detail with static shapes, constraints, and continuation metadata", () => {
    const detail = getContractSubjectDetail("helper.command.author");

    expect(detail).toBeDefined();
    expect(detail?.resolution.mode).toBe("static");
    expect(detail?.subject.input_shape_id).toBe("shared.shape.apply_authoring_intent_args");
    expect(detail?.subject.output_shape_id).toBe("shared.shape.apply_authoring_intent_result");
    expect(detail?.input_shape?.shape_id).toBe("shared.shape.apply_authoring_intent_args");
    expect(detail?.output_shape?.shape_id).toBe("shared.shape.apply_authoring_intent_result");
    expect(detail?.constraints.map((constraint) => constraint.kind)).toEqual(
      expect.arrayContaining([
        "required_if",
        "forbidden_if",
        "unique_within_request",
        "must_reference_earlier_local_id",
        "same_revision_handle",
        "commit_safe_continuation",
        "dry_run_informational_only"
      ])
    );
    expect(detail?.continuation.map((entry) => entry.kind)).toEqual(
      expect.arrayContaining([
        "result_revision_is_required_next_base_revision",
        "commit_handles_are_safe_continuation_surfaces",
        "dry_run_handles_are_informational_only"
      ])
    );
  });

  it("returns author request-purpose detail without result schemas", () => {
    const fullDetail = getContractSubjectDetail("helper.command.author");
    const requestDetail = getContractSubjectDetailForPurpose("helper.command.author", "request");

    expect(fullDetail).toBeDefined();
    expect(requestDetail).toBeDefined();
    expect(requestDetail?.subject.detail_modes).toEqual(["static", "bundle_resolved"]);
    expect(requestDetail?.subject.detail_modes).not.toContain("request");
    expect(requestDetail?.subject.contract_purposes).toEqual(["request"]);
    expect(requestDetail?.input_shape?.shape_id).toBe("shared.shape.apply_authoring_intent_args");
    expect(requestDetail).not.toHaveProperty("output_shape");
    expect(requestDetail?.request_body?.top_level_shape).toBe("ApplyAuthoringIntentArgs");
    expect(requestDetail?.constraints.map((constraint) => constraint.kind)).toEqual([
      "required_if",
      "forbidden_if",
      "unique_within_request",
      "must_reference_earlier_local_id",
      "same_revision_handle"
    ]);
    expect(requestDetail?.bindings).toEqual([]);
    expect(requestDetail?.continuation).toEqual([]);
    expect(JSON.stringify(requestDetail)).not.toContain("sdd-authoring-outcome-assessment");
    expect(JSON.stringify(requestDetail).length).toBeLessThan(JSON.stringify(fullDetail).length / 2);
  });

  it("returns apply request-purpose detail with request-side constraints and bindings only", () => {
    const requestDetail = getContractSubjectDetailForPurpose("helper.command.apply", "request");
    const requestJson = JSON.stringify(requestDetail);

    expect(requestDetail).toBeDefined();
    expect(requestDetail?.subject.detail_modes).toEqual(["static", "bundle_resolved"]);
    expect(requestDetail?.subject.detail_modes).not.toContain("request");
    expect(requestDetail?.subject.contract_purposes).toEqual(["request"]);
    expect(requestDetail?.input_shape?.shape_id).toBe("shared.shape.apply_change_set_args");
    expect(requestDetail?.request_body?.top_level_shape).toBe("ApplyChangeSetArgs");
    expect(requestDetail).not.toHaveProperty("output_shape");
    expect(requestDetail?.constraints.map((constraint) => constraint.constraint_id)).toEqual([
      "shared.constraint.apply_change_set.handles_are_revision_bound"
    ]);
    expect(requestDetail?.constraints[0]).toMatchObject({
      kind: "same_revision_handle",
      parameters: {
        base_revision_pointer: "/base_revision"
      }
    });
    expect(requestDetail?.bindings.map((binding) => binding.binding_id)).toEqual([
      "shared.binding.apply_change_set.validate_profile",
      "shared.binding.apply_change_set.projection_views"
    ]);
    expect(requestDetail?.continuation).toEqual([]);
    expect(requestJson).not.toContain("sdd-change-set");
    expect(requestJson).not.toContain("sdd-authoring-outcome-assessment");
    expect(requestJson).not.toContain("commit_handles_are_safe_continuation_surfaces");
    expect(requestJson).not.toContain("dry_run_handles_are_informational_only");
  });

  it("returns create detail with bootstrap continuation semantics", () => {
    const detail = getContractSubjectDetail("helper.command.create");

    expect(detail?.continuation.map((entry) => entry.kind)).toEqual([
      "create_revision_is_bootstrap_continuation_surface",
      "inspect_may_fail_on_empty_bootstrap"
    ]);
  });

  it("returns create request-purpose detail with path/version shape and bootstrap continuation", () => {
    const requestDetail = getContractSubjectDetailForPurpose("helper.command.create", "request");
    const fullDetail = getContractSubjectDetail("helper.command.create");
    const requestJson = JSON.stringify(requestDetail);

    expect(requestDetail).toBeDefined();
    expect(requestDetail?.subject.detail_modes).toEqual(["static"]);
    expect(requestDetail?.subject.detail_modes).not.toContain("request");
    expect(requestDetail?.subject.contract_purposes).toEqual(["request"]);
    expect(requestDetail?.invocation).toBe("sdd-helper create <document_path> [--version <version>]");
    expect(requestDetail?.input_shape).toMatchObject({
      shape_id: "shared.shape.create_document_args",
      summary: "Create-document request payload.",
      schema: {
        type: "object",
        required: ["path"],
        properties: {
          path: {
            type: "string"
          },
          version: {
            type: "string",
            enum: ["0.1"]
          }
        }
      }
    });
    expect(requestDetail).not.toHaveProperty("request_body");
    expect(requestDetail).not.toHaveProperty("output_shape");
    expect(requestDetail?.constraints).toEqual([]);
    expect(requestDetail?.bindings).toEqual([]);
    expect(requestDetail?.continuation.map((entry) => entry.kind)).toEqual([
      "create_revision_is_bootstrap_continuation_surface",
      "inspect_may_fail_on_empty_bootstrap"
    ]);
    expect(requestDetail?.resolution).toEqual({ mode: "static" });
    expect(requestJson).not.toContain("sdd-create-document");
    expect(requestJson).not.toContain("sdd-change-set");
    expect(requestJson).not.toContain("sdd-authoring-outcome-assessment");
    expect(requestJson).not.toContain("blocking_diagnostics");
    expect(fullDetail).not.toHaveProperty("invocation");
  });

  it("returns undo request-purpose detail with eligibility and current-revision guidance only", () => {
    const requestDetail = getContractSubjectDetailForPurpose("helper.command.undo", "request");
    const requestJson = JSON.stringify(requestDetail);

    expect(requestDetail).toBeDefined();
    expect(requestDetail?.subject.detail_modes).toEqual(["static", "bundle_resolved"]);
    expect(requestDetail?.subject.detail_modes).not.toContain("request");
    expect(requestDetail?.subject.contract_purposes).toEqual(["request"]);
    expect(requestDetail?.input_shape).toMatchObject({
      shape_id: "shared.shape.undo_change_set_args",
      schema: {
        type: "object",
        required: ["change_set_id"],
        properties: {
          change_set_id: {
            type: "string"
          },
          mode: {
            type: "string",
            enum: ["dry_run", "commit"]
          },
          validate_profile: {
            type: "string"
          }
        }
      }
    });
    expect(requestDetail?.request_body?.top_level_shape).toBe("UndoChangeSetArgs");
    expect(requestDetail).not.toHaveProperty("output_shape");
    expect(requestDetail?.constraints).toHaveLength(1);
    expect(requestDetail?.constraints[0]).toMatchObject({
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
        default_mode: "dry_run"
      }
    });
    expect(requestDetail?.bindings.map((binding) => binding.binding_id)).toEqual([
      "shared.binding.undo_change_set.validate_profile"
    ]);
    expect(requestDetail?.bindings[0]).toMatchObject({
      applies_to_json_pointer: "/validate_profile",
      bundle_source: {
        artifact: "manifest_profiles",
        selector: "profiles"
      }
    });
    expect(requestDetail?.continuation).toEqual([]);
    expect(requestJson).not.toContain("\"output_shape\":");
    expect(requestJson).not.toContain("sdd-change-set");
    expect(requestJson).not.toContain("sdd-authoring-outcome-assessment");
    expect(requestJson).not.toContain("blocking_diagnostics");
    expect(requestJson).not.toContain("\"operations\"");
    expect(requestJson).not.toContain("\"path\"");
    expect(requestJson).not.toContain("base_revision");
    expect(requestJson).not.toContain("handle");
  });

  it("exposes request body stdin semantics for helper request-loading commands", () => {
    const applyDetail = getContractSubjectDetail("helper.command.apply");
    const authorDetail = getContractSubjectDetail("helper.command.author");
    const undoDetail = getContractSubjectDetail("helper.command.undo");

    expect(applyDetail?.request_body).toMatchObject({
      via_option: "--request",
      top_level_shape: "ApplyChangeSetArgs",
      source: "file_path_or_stdin_dash",
      stdin_dash: {
        read_mode: "read_all_stdin_until_eof",
        empty_input_error: {
          kind: "sdd-helper-error",
          code: "invalid_json",
          message: "Unexpected end of JSON input"
        }
      }
    });
    expect(authorDetail?.request_body).toMatchObject({
      via_option: "--request",
      top_level_shape: "ApplyAuthoringIntentArgs",
      source: "file_path_or_stdin_dash",
      stdin_dash: applyDetail?.request_body?.stdin_dash
    });
    expect(undoDetail?.request_body).toMatchObject({
      via_option: "--request",
      top_level_shape: "UndoChangeSetArgs",
      source: "file_path_or_stdin_dash",
      stdin_dash: applyDetail?.request_body?.stdin_dash
    });
  });

  it("exposes static bundle-binding references for preview, validate, and project inputs", () => {
    const previewDetail = getContractSubjectDetail("helper.command.preview");
    const validateDetail = getContractSubjectDetail("helper.command.validate");
    const projectDetail = getContractSubjectDetail("helper.command.project");

    expect(previewDetail?.bindings.map((binding) => binding.binding_id)).toEqual([
      "shared.binding.render_preview.view_id",
      "shared.binding.render_preview.profile_id"
    ]);
    expect(previewDetail?.resolution.unresolved_binding_ids).toEqual([
      "shared.binding.render_preview.view_id",
      "shared.binding.render_preview.profile_id"
    ]);
    expect(
      ((previewDetail?.input_shape?.schema as { properties?: Record<string, unknown> })?.properties ?? {})
    ).not.toHaveProperty("display_copy_name");
    expect(previewDetail?.output_shape?.schema).toMatchObject({
      properties: {
        format: {
          type: "string",
          enum: ["svg", "png"]
        },
        mime_type: {
          type: "string",
          enum: ["image/svg+xml", "image/png"]
        },
        artifact_path: {
          type: "string"
        }
      }
    });
    const previewOutputProperties =
      ((previewDetail?.output_shape?.schema as { properties?: Record<string, unknown> })?.properties ?? {});
    expect(previewOutputProperties).not.toHaveProperty("display_copy_path");
    expect(previewOutputProperties).not.toHaveProperty("artifact");
    expect(
      Object.keys(
        previewOutputProperties
      )
    ).toEqual([
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
      "diagnostics",
      "assessment"
    ]);

    expect(validateDetail?.bindings.map((binding) => binding.binding_id)).toEqual([
      "shared.binding.validate_document.profile_id"
    ]);
    expect(projectDetail?.bindings.map((binding) => binding.binding_id)).toEqual([
      "shared.binding.project_document.view_id"
    ]);
  });

  it("can represent every required constraint category across the registry", () => {
    const kinds = new Set(
      createContractIndex().subjects.flatMap((subject) =>
        getContractSubjectDetail(subject.subject_id)?.constraints.map((constraint) => constraint.kind) ?? []
      )
    );

    expect([...kinds].sort()).toEqual([
      "bound_warning_acceptance",
      "canonical_proposal_identity",
      "commit_safe_continuation",
      "currently_offered_opaque_option",
      "document_presence_precondition",
      "dry_run_informational_only",
      "exact_confirmation",
      "forbidden_if",
      "must_reference_earlier_local_id",
      "proposal_relationship_edge_consistency",
      "required_if",
      "same_bundle_fingerprint",
      "same_document_revision",
      "same_revision_handle",
      "undo_change_set_eligibility",
      "unique_within_request"
    ]);
  });

  it("returns immutable copies from accessors", () => {
    const descriptor = getContractSubjectDescriptor("helper.command.author");
    const detail = getContractSubjectDetail("helper.command.author");

    expect(descriptor).toBeDefined();
    expect(detail).toBeDefined();

    descriptor!.summary = "mutated";
    detail!.subject.summary = "mutated-again";

    expect(getContractSubjectDescriptor("helper.command.author")?.summary).toBe(
      "Apply or dry-run high-level authoring intents through the shared authoring core."
    );
    expect(getContractSubjectDetail("helper.command.author")?.subject.summary).toBe(
      "Apply or dry-run high-level authoring intents through the shared authoring core."
    );
  });

  it("returns undefined for unknown subject ids", () => {
    expect(getContractSubjectDescriptor("helper.command.unknown" as never)).toBeUndefined();
    expect(getContractSubjectDetail("helper.command.unknown" as never)).toBeUndefined();
  });
});
