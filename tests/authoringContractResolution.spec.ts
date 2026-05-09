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

  it("returns undefined for unknown subjects", () => {
    expect(getBundleResolvedContractSubjectDetail("helper.command.unknown" as never, bundle)).toBeUndefined();
  });
});
