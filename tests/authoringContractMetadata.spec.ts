import { describe, expect, it } from "vitest";
import {
  createContractIndex,
  getContractSubjectDescriptor,
  getContractSubjectDetail
} from "../src/authoring/contractMetadata.js";

describe("authoring contract metadata", () => {
  it("returns all current helper command subject ids in stable order", () => {
    const index = createContractIndex();

    expect(index.kind).toBe("sdd-contract-index");
    expect(index.contract_version).toBe("0.1");
    expect(index.subjects.map((subject) => subject.subject_id)).toEqual([
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
      "helper.command.capabilities"
    ]);
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

  it("returns create detail with bootstrap continuation semantics", () => {
    const detail = getContractSubjectDetail("helper.command.create");

    expect(detail?.continuation.map((entry) => entry.kind)).toEqual([
      "create_revision_is_bootstrap_continuation_surface",
      "inspect_may_fail_on_empty_bootstrap"
    ]);
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
      "commit_safe_continuation",
      "dry_run_informational_only",
      "forbidden_if",
      "must_reference_earlier_local_id",
      "required_if",
      "same_revision_handle",
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
