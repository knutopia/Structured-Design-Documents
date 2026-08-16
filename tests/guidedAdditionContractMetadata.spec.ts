import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020Import from "ajv/dist/2020.js";
import { beforeAll, describe, expect, it } from "vitest";
import {
  createContractIndex,
  createGuidedAdditionRuntimeV1,
  createGuidedDocumentSnapshot,
  getBundleResolvedContractSubjectDetail,
  getContractSubjectDetail,
  loadBundle,
  type Bundle,
  type ContractShapeId,
  type GuidedAdditionResultV1,
  type GuidedChoicePageV1,
  type GuidedDocumentSnapshot,
  type GuidedFieldValueV1
} from "../src/index.js";

const Ajv2020 = Ajv2020Import as unknown as new (options: Record<string, unknown>) => {
  compile(schema: object): ((value: unknown) => boolean) & { errors?: unknown };
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");
const fixturePath = path.join(repoRoot, "tests/fixtures/guided_addition_acceptance.sdd");

let bundle: Bundle;
let snapshot: GuidedDocumentSnapshot;

beforeAll(async () => {
  bundle = await loadBundle(manifestPath);
  snapshot = createGuidedDocumentSnapshot(bundle, {
    document_ref: "tests/fixtures/guided_addition_acceptance.sdd",
    path: "tests/fixtures/guided_addition_acceptance.sdd",
    text: fs.readFileSync(fixturePath, "utf8")
  });
});

function schema(shapeId: ContractShapeId): object {
  const descriptor = createContractIndex().shapes.find((candidate) => candidate.shape_id === shapeId);
  expect(descriptor, shapeId).toBeDefined();
  return descriptor!.schema;
}

function expectValid(shapeId: ContractShapeId, value: unknown): void {
  const validate = new Ajv2020({ strict: false, allErrors: true }).compile(schema(shapeId));
  expect(validate(value), JSON.stringify(validate.errors)).toBe(true);
}

function choicePage(result: GuidedAdditionResultV1): GuidedChoicePageV1 {
  expect(result.kind).toBe("sdd-guided-addition-step");
  const page = (result as Extract<GuidedAdditionResultV1, { kind: "sdd-guided-addition-step" }>).page;
  expect("choices" in page).toBe(true);
  return page as GuidedChoicePageV1;
}

function standaloneCompletion(): { begun: GuidedAdditionResultV1; action: GuidedChoicePageV1["choices"][number]["action"]; complete: Extract<GuidedAdditionResultV1, { kind: "sdd-guided-addition-complete" }> } {
  const runtime = createGuidedAdditionRuntimeV1(bundle);
  const begun = runtime.begin(snapshot, { workflow_version: "1.0" });
  const action = choicePage(begun).choices.find((choice) =>
    choice.action.kind === "choose_addition_kind" && choice.action.addition_kind === "standalone_node")!.action;
  let result = runtime.advance(snapshot, begun.state, action);
  result = runtime.advance(snapshot, result.state, choicePage(result).choices.find((choice) =>
    choice.action.kind === "choose_standalone_node_type" && choice.action.node_type === "Place")!.action);
  const values: GuidedFieldValueV1[] = [
    { field_id: "node_id", value_kind: "bare_value", raw_value: "P-301" },
    { field_id: "name", value_kind: "quoted_string", raw_value: "Settings" },
    { field_id: "node_property:description", value_kind: "quoted_string", raw_value: "Configuration and preferences" }
  ];
  result = runtime.advance(snapshot, result.state, {
    kind: "submit_new_node_fields", local_node_id: "node_1", field_group: "primary", values
  });
  result = runtime.advance(snapshot, result.state, choicePage(result).choices.find((choice) =>
    choice.action.kind === "set_node_detail_disclosure" && !choice.action.disclose)!.action);
  result = runtime.advance(snapshot, result.state, choicePage(result).choices.find((choice) =>
    choice.action.kind === "choose_same_level_order" && choice.action.order.kind === "top_level_last")!.action);
  expect(result.kind).toBe("sdd-guided-addition-complete");
  return { begun, action, complete: result as Extract<GuidedAdditionResultV1, { kind: "sdd-guided-addition-complete" }> };
}

describe("Guided Addition v1 contract metadata", () => {
  it("publishes the corrected v1 domain subjects and compilable schemas", () => {
    const subjects = createContractIndex().subjects.filter((subject) => subject.surface_kind === "domain_service");
    expect(subjects.map((subject) => subject.subject_id)).toEqual([
      "domain.service.guided_addition.begin",
      "domain.service.guided_addition.advance",
      "domain.service.addition_proposal.apply"
    ]);
    for (const id of createContractIndex().shapes.map((shape) => shape.shape_id)
      .filter((id) => id.includes("guided") || id.includes("addition_proposal"))) {
      expect(() => new Ajv2020({ strict: false }).compile(schema(id))).not.toThrow();
    }
  });

  it("validates real v1 snapshot, request, state, page, action, completion, proposal, and warning-aware apply values", () => {
    const { begun, action, complete } = standaloneCompletion();
    expectValid("shared.shape.guided_document_snapshot", snapshot);
    expectValid("shared.shape.begin_guided_addition_request", { workflow_version: "1.0" });
    expectValid("shared.shape.guided_addition_begin_args", {
      snapshot,
      request: { workflow_version: "1.0" }
    });
    expectValid("shared.shape.guided_addition_state", begun.state);
    expectValid("shared.shape.guided_addition_action", action);
    expectValid("shared.shape.guided_addition_advance_args", { snapshot, state: begun.state, action });
    expectValid("shared.shape.guided_addition_result", begun);
    expectValid("shared.shape.guided_addition_result", complete);
    expectValid("shared.shape.completed_addition_proposal", complete.proposal);
    expectValid("shared.shape.apply_addition_proposal_args", {
      proposal: complete.proposal,
      mode: "commit",
      validate_profile: "simple",
      accepted_warning_token: "warning_example"
    });
    expectValid("shared.shape.apply_addition_proposal_result", {
      kind: "sdd-addition-proposal-result",
      proposal: complete.proposal,
      base_revision: complete.proposal.document_context.base_revision,
      resulting_revision: complete.proposal.document_context.base_revision,
      mode: "dry_run",
      status: "applied",
      change_set: {
        kind: "sdd-change-set",
        change_set_id: "cs_metadata",
        path: complete.proposal.document_context.path,
        origin: "apply_addition_proposal",
        document_effect: "updated",
        base_revision: complete.proposal.document_context.base_revision,
        resulting_revision: complete.proposal.document_context.base_revision,
        mode: "dry_run",
        status: "applied",
        undo_eligible: false,
        operations: [],
        summary: {
          node_insertions: [], node_deletions: [], node_renames: [], property_changes: [],
          edge_insertions: [], edge_deletions: [], ordering_changes: []
        },
        diagnostics: []
      },
      created_targets: [],
      diagnostics: [],
      warning_review: { title: "Warning", lines: ["Human warning"], acceptance_token: "warning_example" }
    });
  });

  it("describes replay, exact effect, canonical identity, and bound warning constraints", () => {
    expect(getContractSubjectDetail("domain.service.guided_addition.advance")!.constraints.map((item) => item.kind)).toEqual([
      "same_document_revision",
      "same_bundle_fingerprint",
      "currently_offered_opaque_option",
      "exact_confirmation"
    ]);
    expect(getContractSubjectDetail("domain.service.addition_proposal.apply")!.constraints.map((item) => item.kind)).toEqual([
      "same_document_revision",
      "same_bundle_fingerprint",
      "exact_confirmation",
      "proposal_relationship_edge_consistency",
      "canonical_proposal_identity",
      "bound_warning_acceptance"
    ]);
  });

  it("contains no rejected initial-filter, placement-recommendation, or legacy workflow metadata", () => {
    const text = JSON.stringify(createContractIndex());
    expect(text).not.toMatch(/initial_filter|reason_code|recommendation_id|confirmed_effects|proposal_version\\?\":\\?\"0\.1|choose_operation|set_filter/);
    const begin = getContractSubjectDetail("domain.service.guided_addition.begin")!;
    expect(begin.bindings.map((binding) => binding.applies_to_json_pointer)).toContain("/request/anchor/node_type");
    expect(begin.bindings.map((binding) => binding.applies_to_json_pointer).join("\n")).not.toContain("initial_filter");
  });

  it("serializes the published static and bundle-resolved v1 contract surface", () => {
    const index = createContractIndex();
    const domainSubjectIds = index.subjects
      .filter((subject) => subject.surface_kind === "domain_service")
      .map((subject) => subject.subject_id);
    const resolved = domainSubjectIds.map((subjectId) =>
      getBundleResolvedContractSubjectDetail(subjectId, bundle)
    );
    const published = JSON.stringify({ index, resolved });

    expect(index.contract_version).toBe("0.1");
    expect(published).toContain('"workflow_version"');
    expect(published).toContain('"1.0"');
    expect(published).toContain("bound_warning_acceptance");
    expect(published).not.toMatch(
      /initial_filter|endpoint_strategy|reason_code|recommendation_id|confirmed_effects|choose_operation|set_filter/
    );
  });

  it("resolves v1 diagram, profile, node, and relationship bindings from a mutated bundle", () => {
    const mutated = structuredClone(bundle);
    mutated.views.views[0]!.id = "mutated_view";
    mutated.views.views[0]!.name = "Mutated View";
    mutated.manifest.profiles[0]!.id = "mutated_profile";
    mutated.manifest.profiles[0]!.intent = "Mutated profile intent";
    mutated.vocab.node_types[0]!.token = "MutatedNode";
    mutated.vocab.relationship_types[0]!.token = "MUTATED_RELATIONSHIP";

    const resolvedAdvance = getBundleResolvedContractSubjectDetail("domain.service.guided_addition.advance", mutated)!;
    expect(resolvedAdvance.bindings.find((entry) => entry.binding_id.endsWith("action_diagram_id"))?.resolved_values)
      .toEqual(expect.arrayContaining([expect.objectContaining({ value: "mutated_view", label: "Mutated View" })]));
    const resolvedApply = getBundleResolvedContractSubjectDetail("domain.service.addition_proposal.apply", mutated)!;
    expect(resolvedApply.bindings.find((entry) => entry.binding_id.endsWith("display_profile_id"))?.resolved_values)
      .toEqual(expect.arrayContaining([expect.objectContaining({ value: "mutated_profile" })]));
    expect(resolvedApply.bindings.find((entry) => entry.binding_id.endsWith("node_type"))?.resolved_values)
      .toEqual(expect.arrayContaining([expect.objectContaining({ value: "MutatedNode" })]));
    expect(resolvedApply.bindings.find((entry) => entry.binding_id.endsWith("relationship_type"))?.resolved_values)
      .toEqual(expect.arrayContaining([expect.objectContaining({ value: "MUTATED_RELATIONSHIP" })]));
  });
});
