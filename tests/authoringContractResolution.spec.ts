import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { loadBundle } from "../src/bundle/loadBundle.js";
import type { Bundle } from "../src/bundle/types.js";
import { getContractSubjectDetail } from "../src/authoring/contractMetadata.js";
import {
  getBundleResolvedContractSubjectDetail,
  getBundleResolvedContractSubjectDetailForPurpose
} from "../src/authoring/contractResolution.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

describe("authoring contract resolution", () => {
  let bundle: Bundle;

  beforeAll(async () => {
    bundle = await loadBundle(manifestPath);
  });

  it("resolves preview bindings while preserving structural schemas", () => {
    const staticDetail = getContractSubjectDetail("helper.command.preview");
    const resolvedDetail = getBundleResolvedContractSubjectDetail("helper.command.preview", bundle);

    expect(staticDetail).toBeDefined();
    expect(resolvedDetail).toBeDefined();
    expect(resolvedDetail?.input_shape).toEqual(staticDetail?.input_shape);
    expect(resolvedDetail?.output_shape).toEqual(staticDetail?.output_shape);
    expect(resolvedDetail?.resolution).toEqual({
      mode: "bundle_resolved",
      bundle_name: bundle.manifest.bundle_name,
      bundle_version: bundle.manifest.bundle_version
    });

    const resolvedViewBinding = resolvedDetail?.bindings.find(
      (binding) => binding.binding_id === "shared.binding.render_preview.view_id"
    );
    const resolvedProfileBinding = resolvedDetail?.bindings.find(
      (binding) => binding.binding_id === "shared.binding.render_preview.profile_id"
    );
    const resolvedDetailBinding = resolvedDetail?.bindings.find(
      (binding) => binding.binding_id === "shared.binding.render_preview.detail_id"
    );

    expect(resolvedViewBinding?.resolved_values).toEqual(
      bundle.views.views.map((view) => ({
        value: view.id,
        label: view.name,
        metadata: {
          status: view.status
        }
      }))
    );
    expect(resolvedProfileBinding?.resolved_values).toEqual(
      bundle.manifest.profiles.map((profile) => ({
        value: profile.id,
        metadata: {
          intent: profile.intent
        }
      }))
    );
    expect(resolvedDetailBinding?.resolved_values).toEqual(
      bundle.manifest.render_details.map((detail) => ({
        value: detail.id,
        metadata: {
          intent: detail.intent
        }
      }))
    );
  });

  it("resolves validate and project bindings in bundle order", () => {
    const validateDetail = getBundleResolvedContractSubjectDetail("helper.command.validate", bundle);
    const projectDetail = getBundleResolvedContractSubjectDetail("helper.command.project", bundle);

    expect(validateDetail?.bindings[0]?.resolved_values?.map((value) => value.value)).toEqual(
      bundle.manifest.profiles.map((profile) => profile.id)
    );
    expect(projectDetail?.bindings[0]?.resolved_values?.map((value) => value.value)).toEqual(
      bundle.views.views.map((view) => view.id)
    );
  });

  it("returns resolved author request-purpose detail without result schemas", () => {
    const fullResolvedDetail = getBundleResolvedContractSubjectDetail("helper.command.author", bundle);
    const requestDetail = getBundleResolvedContractSubjectDetailForPurpose("helper.command.author", bundle, "request");

    expect(fullResolvedDetail).toBeDefined();
    expect(requestDetail).toBeDefined();
    expect(requestDetail?.resolution).toEqual({
      mode: "bundle_resolved",
      bundle_name: bundle.manifest.bundle_name,
      bundle_version: bundle.manifest.bundle_version
    });
    expect(requestDetail?.input_shape?.shape_id).toBe("shared.shape.apply_authoring_intent_args");
    expect(requestDetail).not.toHaveProperty("output_shape");
    expect(requestDetail?.authoring_format_card).toMatchObject({
      card_id: "sdd.v0_1.author_json_quick_format"
    });
    expect(requestDetail?.continuation).toEqual([]);
    expect(JSON.stringify(requestDetail)).not.toContain("sdd-authoring-outcome-assessment");
    expect(JSON.stringify(requestDetail).length).toBeLessThan(JSON.stringify(fullResolvedDetail).length / 2);
  });

  it("returns resolved apply request-purpose detail with command-specific format guidance only", () => {
    const requestDetail = getBundleResolvedContractSubjectDetailForPurpose("helper.command.apply", bundle, "request");
    const requestJson = JSON.stringify(requestDetail);

    expect(requestDetail).toBeDefined();
    expect(requestDetail?.resolution).toEqual({
      mode: "bundle_resolved",
      bundle_name: bundle.manifest.bundle_name,
      bundle_version: bundle.manifest.bundle_version
    });
    expect(requestDetail?.input_shape?.shape_id).toBe("shared.shape.apply_change_set_args");
    expect(requestDetail?.request_body?.top_level_shape).toBe("ApplyChangeSetArgs");
    expect(requestDetail).not.toHaveProperty("output_shape");
    expect(requestDetail?.constraints.map((constraint) => constraint.constraint_id)).toEqual([
      "shared.constraint.apply_change_set.handles_are_revision_bound"
    ]);
    expect(requestDetail?.bindings.map((binding) => binding.binding_id)).toEqual([
      "shared.binding.apply_change_set.validate_profile",
      "shared.binding.apply_change_set.projection_views"
    ]);
    expect(requestDetail?.bindings[0]?.resolved_values?.map((value) => value.value)).toEqual(
      bundle.manifest.profiles.map((profile) => profile.id)
    );
    expect(requestDetail?.bindings[1]?.resolved_values?.map((value) => value.value)).toEqual(
      bundle.views.views.map((view) => view.id)
    );
    expect(requestDetail?.authoring_format_card).toMatchObject({
      card_id: "sdd.v0_1.apply_json_quick_format",
      field_hints: expect.arrayContaining([
        expect.objectContaining({
          hint_id: "sdd.v0_1.node_id",
          applies_to_json_pointers: ["/operations/*/node_id", "/operations/*/to"]
        }),
        expect.objectContaining({
          hint_id: "sdd.v0_1.node_type",
          applies_to_json_pointers: ["/operations/*/node_type"]
        }),
        expect.objectContaining({
          hint_id: "sdd.v0_1.rel_type",
          applies_to_json_pointers: ["/operations/*/rel_type"]
        }),
        expect.objectContaining({
          hint_id: "sdd.v0_1.event_atom",
          applies_to_json_pointers: ["/operations/*/event"]
        }),
        expect.objectContaining({
          hint_id: "sdd.v0_1.effect_atom",
          applies_to_json_pointers: ["/operations/*/effect"]
        }),
        expect.objectContaining({
          hint_id: "sdd.v0_1.value_kind",
          applies_to_json_pointers: ["/operations/*/value_kind"]
        }),
        expect.objectContaining({
          hint_id: "sdd.v0_1.raw_value",
          applies_to_json_pointers: ["/operations/*/raw_value"]
        })
      ])
    });
    expect(requestDetail?.continuation).toEqual([]);
    expect(requestJson).not.toContain("/intents/*");
    expect(requestJson).not.toContain("sdd-change-set");
    expect(requestJson).not.toContain("sdd-authoring-intent-result");
    expect(requestJson).not.toContain("sdd-authoring-outcome-assessment");
    expect(requestJson).not.toContain("blocking_diagnostics");
    expect(requestJson).not.toContain("created_targets");
    expect(requestJson).not.toContain("commit_handles_are_safe_continuation_surfaces");
    expect(requestJson).not.toContain("dry_run_handles_are_informational_only");
  });

  it("returns resolved undo request-purpose detail with validate-profile values and no result schemas", () => {
    const requestDetail = getBundleResolvedContractSubjectDetailForPurpose("helper.command.undo", bundle, "request");
    const requestJson = JSON.stringify(requestDetail);

    expect(requestDetail).toBeDefined();
    expect(requestDetail?.resolution).toEqual({
      mode: "bundle_resolved",
      bundle_name: bundle.manifest.bundle_name,
      bundle_version: bundle.manifest.bundle_version
    });
    expect(requestDetail?.subject.detail_modes).toEqual(["static", "bundle_resolved"]);
    expect(requestDetail?.input_shape?.shape_id).toBe("shared.shape.undo_change_set_args");
    expect(requestDetail?.request_body?.top_level_shape).toBe("UndoChangeSetArgs");
    expect(requestDetail).not.toHaveProperty("output_shape");
    expect(requestDetail?.constraints).toHaveLength(1);
    expect(requestDetail?.constraints[0]).toMatchObject({
      kind: "undo_change_set_eligibility",
      applies_to_json_pointers: ["/change_set_id"],
      parameters: {
        target_record_required: true,
        required_target_change_set: {
          mode: "commit",
          status: "applied",
          undo_eligible: true
        },
        supported_inverse_kinds: ["restore_document", "delete_document"],
        current_document_revision_must_equal: "target.change_set.resulting_revision",
        default_mode: "dry_run"
      }
    });
    expect(requestDetail?.bindings).toHaveLength(1);
    expect(requestDetail?.bindings[0]).toMatchObject({
      binding_id: "shared.binding.undo_change_set.validate_profile",
      applies_to_json_pointer: "/validate_profile",
      resolved_values: bundle.manifest.profiles.map((profile) => ({
        value: profile.id,
        metadata: {
          intent: profile.intent
        }
      }))
    });
    expect(requestDetail?.continuation).toEqual([]);
    expect(requestJson).not.toContain("sdd-change-set");
    expect(requestJson).not.toContain("sdd-authoring-outcome-assessment");
    expect(requestJson).not.toContain("blocking_diagnostics");
    expect(requestJson).not.toContain("\"operations\"");
    expect(requestJson).not.toContain("\"path\"");
    expect(requestJson).not.toContain("base_revision");
  });

  it("returns undefined for unknown subjects", () => {
    expect(getBundleResolvedContractSubjectDetail("helper.command.unknown" as never, bundle)).toBeUndefined();
  });
});
