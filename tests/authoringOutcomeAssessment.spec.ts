import { describe, expect, it } from "vitest";
import type { Diagnostic } from "../src/types.js";
import type {
  ApplyAuthoringIntentResult,
  ChangeSetResult,
  CreateDocumentResult,
  HelperErrorResult,
  ProjectionResource,
  RenderPreviewResult,
  ValidationResource
} from "../src/authoring/contracts.js";
import {
  assessApplyAuthoringIntentResult,
  assessAuthoringOutcome,
  assessChangeSetResult,
  assessCreateDocumentResult,
  assessHelperError,
  assessProjectionResource,
  assessRenderPreviewResult,
  assessValidationResource
} from "../src/authoring/outcomeAssessment.js";

function diagnostic(overrides: Partial<Diagnostic> = {}): Diagnostic {
  return {
    stage: "validate",
    code: "validate.example",
    severity: "error",
    message: "Example diagnostic.",
    file: "docs/example.sdd",
    ...overrides
  };
}

function emptySummary(): ChangeSetResult["summary"] {
  return {
    node_insertions: [],
    node_deletions: [],
    node_renames: [],
    property_changes: [],
    edge_insertions: [],
    edge_deletions: [],
    ordering_changes: []
  };
}

function changeSet(overrides: Partial<ChangeSetResult> = {}): ChangeSetResult {
  return {
    kind: "sdd-change-set",
    change_set_id: "chg_example",
    path: "docs/example.sdd",
    origin: "apply_change_set",
    document_effect: "updated",
    base_revision: "rev_base",
    resulting_revision: "rev_result",
    mode: "dry_run",
    status: "applied",
    undo_eligible: false,
    operations: [],
    summary: emptySummary(),
    diagnostics: [],
    ...overrides
  };
}

function helperError(overrides: Partial<HelperErrorResult>): HelperErrorResult {
  return {
    kind: "sdd-helper-error",
    code: "invalid_json",
    message: "Unexpected end of JSON input",
    ...overrides
  };
}

function authoringIntentResult(change_set: ChangeSetResult): ApplyAuthoringIntentResult {
  return {
    kind: "sdd-authoring-intent-result",
    path: change_set.path,
    base_revision: change_set.base_revision ?? "rev_base",
    resulting_revision: change_set.resulting_revision,
    mode: change_set.mode,
    status: change_set.status,
    intents: [],
    change_set,
    created_targets: [],
    diagnostics: change_set.diagnostics
  };
}

function createResult(change_set: ChangeSetResult): CreateDocumentResult {
  return {
    kind: "sdd-create-document",
    path: change_set.path,
    uri: `sdd://document/${change_set.path}`,
    revision: change_set.resulting_revision ?? "rev_created",
    change_set
  };
}

function validationResource(diagnostics: Diagnostic[] = []): ValidationResource {
  return {
    kind: "sdd-validation",
    uri: "sdd://document/docs/example.sdd/validation/strict",
    path: "docs/example.sdd",
    revision: "rev_validation",
    profile_id: "strict",
    report: {
      error_count: diagnostics.filter((entry) => entry.severity === "error").length,
      warning_count: diagnostics.filter((entry) => entry.severity === "warn").length
    },
    diagnostics
  };
}

function projectionResource(diagnostics: Diagnostic[] = []): ProjectionResource {
  return {
    kind: "sdd-projection",
    uri: "sdd://document/docs/example.sdd/projection/ia_place_map",
    path: "docs/example.sdd",
    revision: "rev_projection",
    view_id: "ia_place_map",
    projection: {},
    diagnostics
  };
}

function previewResult(diagnostics: Diagnostic[] = []): RenderPreviewResult {
  return {
    kind: "sdd-preview",
    path: "docs/example.sdd",
    revision: "rev_preview",
    view_id: "ia_place_map",
    profile_id: "strict",
    backend_id: "staged_ia_place_map_preview",
    format: "svg",
    mime_type: "image/svg+xml",
    artifact_path: "/tmp/unique-previews/example/example.ia_place_map.strict.svg",
    notes: [],
    diagnostics
  };
}

describe("authoring outcome assessment", () => {
  it("classifies empty stdin helper errors as transport failures", () => {
    const assessment = assessHelperError(helperError({}), {
      request_source: "stdin_dash",
      request_body_empty: true
    });

    expect(assessment).toMatchObject({
      kind: "sdd-authoring-outcome-assessment",
      outcome: "blocked",
      layer: "transport",
      can_commit: false,
      can_render: false,
      should_stop: true,
      blocking_diagnostics: []
    });
    expect(assessment.next_action).toContain("non-empty JSON body");
  });

  it("classifies malformed non-empty JSON and invalid request shape as request-shape failures", () => {
    expect(assessHelperError(helperError({
      code: "invalid_json",
      message: "Expected property name or '}' in JSON"
    }), {
      request_source: "file_path",
      request_body_empty: false
    })).toMatchObject({
      outcome: "blocked",
      layer: "request_shape",
      can_commit: false,
      can_render: false,
      should_stop: true
    });

    expect(assessHelperError(helperError({
      code: "invalid_args",
      message: "Request body does not match ApplyChangeSetArgs: path must be a string."
    }))).toMatchObject({
      outcome: "blocked",
      layer: "request_shape",
      can_commit: false,
      can_render: false,
      should_stop: true
    });
  });

  it("classifies structured rejected change sets as domain rejections", () => {
    const blocking = diagnostic({ code: "sdd.invalid_handle", stage: "cli" });
    const assessment = assessChangeSetResult(changeSet({
      status: "rejected",
      diagnostics: [blocking]
    }));

    expect(assessment).toMatchObject({
      outcome: "blocked",
      layer: "domain_rejection",
      can_commit: false,
      can_render: false,
      should_stop: true,
      blocking_diagnostics: [blocking]
    });
  });

  it("classifies applied dry runs with direct error diagnostics as candidate diagnostics", () => {
    const blocking = diagnostic({ code: "validate.place_access_format" });
    const assessment = assessChangeSetResult(changeSet({
      mode: "dry_run",
      status: "applied",
      diagnostics: [blocking]
    }));

    expect(assessment).toMatchObject({
      outcome: "blocked",
      layer: "candidate_diagnostics",
      can_commit: false,
      can_render: false,
      should_stop: true,
      blocking_diagnostics: [blocking]
    });
  });

  it("classifies applied dry runs with nested projection errors as candidate diagnostics", () => {
    const info = diagnostic({ code: "project.note", severity: "info", stage: "project" });
    const blocking = diagnostic({ code: "project.failed", stage: "project" });
    const assessment = assessChangeSetResult(changeSet({
      mode: "dry_run",
      status: "applied",
      diagnostics: [],
      projection_results: [
        {
          view_id: "ia_place_map",
          diagnostics: [info, blocking]
        }
      ]
    }));

    expect(assessment).toMatchObject({
      outcome: "blocked",
      layer: "candidate_diagnostics",
      can_commit: false,
      can_render: false,
      should_stop: true,
      blocking_diagnostics: [blocking]
    });
  });

  it("classifies warning-only and info-only diagnostics as review-required without stopping", () => {
    const warningAssessment = assessChangeSetResult(changeSet({
      diagnostics: [diagnostic({ severity: "warn", code: "validate.warning" })]
    }));
    const infoAssessment = assessRenderPreviewResult(previewResult([
      diagnostic({ severity: "info", code: "render.coverage_note", stage: "render" })
    ]));

    expect(warningAssessment).toMatchObject({
      outcome: "review_required",
      layer: "success",
      can_commit: true,
      can_render: false,
      should_stop: false,
      blocking_diagnostics: []
    });
    expect(infoAssessment).toMatchObject({
      outcome: "review_required",
      layer: "success",
      can_commit: false,
      can_render: true,
      should_stop: false,
      blocking_diagnostics: []
    });
  });

  it("classifies clean applied dry runs as commit-eligible", () => {
    expect(assessChangeSetResult(changeSet({
      mode: "dry_run",
      status: "applied",
      diagnostics: []
    }))).toMatchObject({
      outcome: "acceptable",
      layer: "success",
      can_commit: true,
      can_render: false,
      should_stop: false,
      blocking_diagnostics: []
    });
  });

  it("classifies clean committed mutations as render-eligible", () => {
    expect(assessChangeSetResult(changeSet({
      mode: "commit",
      status: "applied",
      diagnostics: []
    }))).toMatchObject({
      outcome: "acceptable",
      layer: "success",
      can_commit: false,
      can_render: true,
      should_stop: false,
      blocking_diagnostics: []
    });
  });

  it("classifies create empty-bootstrap parse diagnostics as non-stopping review-required success", () => {
    const assessment = assessCreateDocumentResult(createResult(changeSet({
      origin: "create_document",
      document_effect: "created",
      base_revision: null,
      mode: "commit",
      status: "applied",
      diagnostics: [
        diagnostic({
          stage: "parse",
          code: "parse.minimum_top_level_blocks",
          message: "Document must contain at least one top-level block."
        })
      ]
    })));

    expect(assessment).toMatchObject({
      outcome: "review_required",
      layer: "success",
      can_commit: false,
      can_render: false,
      should_stop: false,
      blocking_diagnostics: []
    });
    expect(assessment.next_action).toContain("Author initial content");
  });

  it("delegates non-bootstrap create and authoring-intent results through nested change sets", () => {
    const rejected = changeSet({
      status: "rejected",
      diagnostics: [diagnostic({ code: "sdd.document_exists", stage: "cli" })]
    });
    const cleanCommit = changeSet({
      origin: "apply_authoring_intent",
      mode: "commit",
      diagnostics: []
    });

    expect(assessCreateDocumentResult(createResult(rejected))).toEqual(assessChangeSetResult(rejected));
    expect(assessApplyAuthoringIntentResult(authoringIntentResult(cleanCommit))).toEqual(
      assessChangeSetResult(cleanCommit)
    );
  });

  it("maps validation, projection, and preview diagnostic stages", () => {
    const validationBlocking = diagnostic({ stage: "validate", code: "validate.required_props_by_type" });
    const projectionBlocking = diagnostic({ stage: "project", code: "project.invalid" });
    const renderBlocking = diagnostic({ stage: "render", code: "render.failed" });

    expect(assessValidationResource(validationResource([validationBlocking]))).toMatchObject({
      outcome: "blocked",
      layer: "persisted_validation",
      can_render: false,
      blocking_diagnostics: [validationBlocking]
    });
    expect(assessProjectionResource(projectionResource([projectionBlocking]))).toMatchObject({
      outcome: "blocked",
      layer: "projection",
      can_render: false,
      blocking_diagnostics: [projectionBlocking]
    });
    expect(assessRenderPreviewResult(previewResult([renderBlocking]))).toMatchObject({
      outcome: "blocked",
      layer: "render",
      can_render: false,
      blocking_diagnostics: [renderBlocking]
    });
    expect(assessHelperError(helperError({
      code: "runtime_error",
      message: "Preview validate failure.",
      diagnostics: [validationBlocking]
    }))).toMatchObject({
      outcome: "blocked",
      layer: "persisted_validation",
      blocking_diagnostics: [validationBlocking]
    });
  });

  it("classifies clean and warning-only validation and projection reads as render-eligible", () => {
    expect(assessValidationResource(validationResource())).toMatchObject({
      outcome: "acceptable",
      layer: "success",
      can_render: true,
      should_stop: false
    });
    expect(assessProjectionResource(projectionResource([
      diagnostic({ severity: "warn", stage: "project", code: "project.warning" })
    ]))).toMatchObject({
      outcome: "review_required",
      layer: "projection",
      can_render: true,
      should_stop: false
    });
  });

  it("routes every supported result kind through the dispatcher", () => {
    const helper = helperError({
      code: "invalid_json",
      message: "Unexpected end of JSON input"
    });
    const change = changeSet();
    const author = authoringIntentResult(change);
    const created = createResult(changeSet({
      origin: "create_document",
      document_effect: "created",
      base_revision: null,
      mode: "commit",
      status: "applied",
      diagnostics: []
    }));
    const validation = validationResource();
    const projection = projectionResource();
    const preview = previewResult();

    expect(assessAuthoringOutcome(helper, {
      request_source: "stdin_dash",
      request_body_empty: true
    })).toEqual(assessHelperError(helper, {
      request_source: "stdin_dash",
      request_body_empty: true
    }));
    expect(assessAuthoringOutcome(change)).toEqual(assessChangeSetResult(change));
    expect(assessAuthoringOutcome(author)).toEqual(assessApplyAuthoringIntentResult(author));
    expect(assessAuthoringOutcome(created)).toEqual(assessCreateDocumentResult(created));
    expect(assessAuthoringOutcome(validation)).toEqual(assessValidationResource(validation));
    expect(assessAuthoringOutcome(projection)).toEqual(assessProjectionResource(projection));
    expect(assessAuthoringOutcome(preview)).toEqual(assessRenderPreviewResult(preview));
  });
});
