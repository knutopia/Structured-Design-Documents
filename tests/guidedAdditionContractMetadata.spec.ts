import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020Import from "ajv/dist/2020.js";
import { beforeAll, describe, expect, it } from "vitest";
import {
  createContractIndex,
  createGuidedAdditionRuntime,
  createGuidedDocumentSnapshot,
  getBundleResolvedContractSubjectDetail,
  getContractSubjectDetail,
  loadBundle,
  type Bundle,
  type CompletedAdditionProposal,
  type ContractShapeId,
  type GuidedAdditionAction,
  type GuidedAdditionResult,
  type GuidedDocumentSnapshot
} from "../src/index.js";

const Ajv2020 = Ajv2020Import as unknown as new (options: Record<string, unknown>) => {
  compile(schema: object): ((value: unknown) => boolean) & { errors?: unknown };
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");
const examplePath = path.join(repoRoot, "bundle/v0.1/examples/outcome_to_ia_trace.sdd");

let bundle: Bundle;
let snapshot: GuidedDocumentSnapshot;

beforeAll(async () => {
  bundle = await loadBundle(manifestPath);
  snapshot = createGuidedDocumentSnapshot(bundle, {
    document_ref: "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
    path: "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
    text: fs.readFileSync(examplePath, "utf8")
  });
});

function shape(shapeId: ContractShapeId): object {
  const descriptor = createContractIndex().shapes.find((candidate) => candidate.shape_id === shapeId);
  expect(descriptor, shapeId).toBeDefined();
  expect(descriptor?.schema_format).toBe("json_schema_2020_12");
  return descriptor!.schema;
}

function expectValid(shapeId: ContractShapeId, value: unknown): void {
  const validate = new Ajv2020({ strict: false, allErrors: true }).compile(shape(shapeId));
  expect(validate(value), JSON.stringify(validate.errors)).toBe(true);
}

function standaloneProposal(): {
  begun: GuidedAdditionResult;
  action: GuidedAdditionAction;
  proposal: CompletedAdditionProposal;
} {
  const runtime = createGuidedAdditionRuntime(bundle);
  const begun = runtime.begin(snapshot, {});
  const action: GuidedAdditionAction = { kind: "choose_operation", selection: { kind: "add_node" } };
  let result = runtime.advance(snapshot, begun.state, action);
  result = runtime.advance(snapshot, result.state, { kind: "choose_node_type", node_type: "Outcome" });
  expect(result.kind).toBe("sdd-guided-addition-step");
  const nodeStep = (result as Extract<GuidedAdditionResult, { kind: "sdd-guided-addition-step" }>).step;
  expect(nodeStep.kind).toBe("edit_new_node");
  const suggested = (nodeStep as Extract<typeof nodeStep, { kind: "edit_new_node" }>).suggested_node_id;
  result = runtime.advance(snapshot, result.state, {
    kind: "set_new_node_fields",
    fields: { node_id: suggested, name: "Metadata proof", properties: [] }
  });
  while (result.kind === "sdd-guided-addition-step" && result.step.kind === "review_placement") {
    const selected = new Set(result.state.selections.placements.map((entry) => entry.recommendation_id));
    const recommendation = result.step.recommendations.find((entry) => !selected.has(entry.recommendation_id))!;
    result = runtime.advance(snapshot, result.state, {
      kind: "select_placement",
      selection: { recommendation_id: recommendation.recommendation_id, selected: recommendation.recommended }
    });
  }
  expect(result.kind).toBe("sdd-guided-addition-step");
  expect((result as any).step.kind).toBe("review_proposal");
  result = runtime.advance(snapshot, result.state, { kind: "complete" });
  expect(result.kind).toBe("sdd-guided-addition-complete");
  return {
    begun,
    action,
    proposal: (result as Extract<GuidedAdditionResult, { kind: "sdd-guided-addition-complete" }>).proposal
  };
}

describe("guided addition contract metadata", () => {
  it("appends three library-visible domain service subjects without disturbing helper order", () => {
    const subjects = createContractIndex().subjects;
    expect(subjects.filter((subject) => subject.surface_kind === "domain_service")).toEqual([
      expect.objectContaining({
        subject_id: "domain.service.guided_addition.begin",
        surface_kind: "domain_service",
        input_shape_id: "shared.shape.guided_addition_begin_args",
        output_shape_id: "shared.shape.guided_addition_result",
        mutates_repo_state: "never"
      }),
      expect.objectContaining({
        subject_id: "domain.service.guided_addition.advance",
        input_shape_id: "shared.shape.guided_addition_advance_args",
        output_shape_id: "shared.shape.guided_addition_result",
        mutates_repo_state: "never"
      }),
      expect.objectContaining({
        subject_id: "domain.service.addition_proposal.apply",
        input_shape_id: "shared.shape.apply_addition_proposal_args",
        output_shape_id: "shared.shape.apply_addition_proposal_result",
        mutates_repo_state: "conditional"
      })
    ]);
    expect(subjects.slice(0, 13).every((subject) => subject.surface_kind === "helper_command")).toBe(true);
  });

  it("publishes all required public shapes plus complete begin and advance call envelopes", () => {
    const shapeIds = createContractIndex().shapes.map((entry) => entry.shape_id);
    expect(shapeIds).toEqual(expect.arrayContaining([
      "shared.shape.guided_document_snapshot",
      "shared.shape.begin_guided_addition_request",
      "shared.shape.guided_addition_begin_args",
      "shared.shape.guided_addition_state",
      "shared.shape.guided_addition_action",
      "shared.shape.guided_addition_advance_args",
      "shared.shape.guided_addition_result",
      "shared.shape.completed_addition_proposal",
      "shared.shape.apply_addition_proposal_args",
      "shared.shape.apply_addition_proposal_result"
    ]));
    for (const shapeId of shapeIds.filter((id) => id.includes("guided") || id.includes("addition_proposal"))) {
      expect(() => new Ajv2020({ strict: false }).compile(shape(shapeId))).not.toThrow();
    }
  });

  it("validates real snapshot, state, action, result, proposal, and apply payloads", () => {
    const { begun, action, proposal } = standaloneProposal();
    expectValid("shared.shape.guided_document_snapshot", snapshot);
    expectValid("shared.shape.begin_guided_addition_request", {});
    expectValid("shared.shape.guided_addition_begin_args", { snapshot, request: {} });
    expectValid("shared.shape.guided_addition_state", begun.state);
    expectValid("shared.shape.guided_addition_action", action);
    expectValid("shared.shape.guided_addition_advance_args", { snapshot, state: begun.state, action });
    expectValid("shared.shape.guided_addition_result", begun);
    expectValid("shared.shape.completed_addition_proposal", proposal);
    expectValid("shared.shape.apply_addition_proposal_args", {
      proposal,
      mode: "dry_run",
      validate_profile: "simple",
      projection_views: ["outcome_opportunity_map"]
    });
    expectValid("shared.shape.apply_addition_proposal_result", {
      kind: "sdd-addition-proposal-result",
      proposal,
      base_revision: proposal.document_context.base_revision,
      mode: "dry_run",
      status: "rejected",
      change_set: {
        kind: "sdd-change-set",
        change_set_id: "cs_metadata",
        path: proposal.document_context.path,
        origin: "apply_addition_proposal",
        document_effect: "updated",
        base_revision: proposal.document_context.base_revision,
        mode: "dry_run",
        status: "rejected",
        undo_eligible: false,
        operations: [],
        summary: {
          node_insertions: [],
          node_deletions: [],
          node_renames: [],
          property_changes: [],
          edge_insertions: [],
          edge_deletions: [],
          ordering_changes: []
        },
        diagnostics: []
      },
      created_targets: [],
      diagnostics: []
    });
  });

  it("describes revision, fingerprint, offered-option, confirmation, and edge-consistency invariants", () => {
    const advance = getContractSubjectDetail("domain.service.guided_addition.advance")!;
    const apply = getContractSubjectDetail("domain.service.addition_proposal.apply")!;
    expect(advance.constraints.map((constraint) => constraint.kind)).toEqual([
      "same_document_revision",
      "same_bundle_fingerprint",
      "currently_offered_opaque_option",
      "exact_confirmation"
    ]);
    expect(apply.constraints.map((constraint) => constraint.kind)).toEqual([
      "same_document_revision",
      "same_bundle_fingerprint",
      "exact_confirmation",
      "proposal_relationship_edge_consistency"
    ]);
    expect(advance.continuation.map((entry) => entry.kind)).toEqual([
      "caller_carried_state",
      "completed_proposal_handoff"
    ]);
    expect(apply.continuation.map((entry) => entry.kind)).toEqual(["dry_run_to_commit_same_proposal"]);
    expectValid("shared.shape.contract_subject_detail", advance);
    expectValid("shared.shape.contract_subject_detail", apply);
  });

  it("keeps static detail reference-only and opaque IDs outside bundle-value bindings", () => {
    for (const subjectId of [
      "domain.service.guided_addition.begin",
      "domain.service.guided_addition.advance",
      "domain.service.addition_proposal.apply"
    ] as const) {
      const detail = getContractSubjectDetail(subjectId)!;
      expect(detail.resolution.mode).toBe("static");
      expect(detail.bindings.length).toBeGreaterThan(0);
      expect(detail.bindings.every((binding) => binding.resolved_values === undefined)).toBe(true);
      expect(detail.resolution.unresolved_binding_ids).toEqual(detail.bindings.map((binding) => binding.binding_id));
      const pointers = detail.bindings.map((binding) => binding.applies_to_json_pointer).join("\n");
      expect(pointers).not.toMatch(/choice_id|option_id|recommendation_id|effect_id|proposal_id|local_id/);
    }
  });

  it("resolves mutated bundle view, profile, and node-type values without changing static metadata", () => {
    const mutated = structuredClone(bundle);
    mutated.views.views[0]!.id = "mutated_view";
    mutated.views.views[0]!.name = "Mutated View";
    mutated.manifest.profiles[0]!.id = "mutated_profile";
    mutated.manifest.profiles[0]!.intent = "Mutated profile intent";
    mutated.vocab.node_types[0]!.token = "MutatedNode";
    mutated.vocab.node_types[0]!.description = "Mutated node description";

    const staticDetail = getContractSubjectDetail("domain.service.guided_addition.begin")!;
    const resolved = getBundleResolvedContractSubjectDetail("domain.service.guided_addition.begin", mutated)!;
    expect(JSON.stringify(staticDetail)).not.toContain("mutated_view");
    expect(JSON.stringify(staticDetail)).not.toContain("mutated_profile");
    expect(JSON.stringify(staticDetail)).not.toContain("MutatedNode");
    expect(resolved.bindings.find((entry) => entry.binding_id.endsWith("view_id"))?.resolved_values?.[0]).toMatchObject({
      value: "mutated_view",
      label: "Mutated View"
    });
    expect(resolved.bindings.find((entry) => entry.binding_id.endsWith("display_profile_id"))?.resolved_values?.[0]).toMatchObject({
      value: "mutated_profile",
      metadata: { intent: "Mutated profile intent" }
    });
    expect(resolved.bindings.find((entry) => entry.binding_id.endsWith("anchor_node_type"))?.resolved_values?.[0]).toMatchObject({
      value: "MutatedNode",
      label: "Mutated node description"
    });
  });
});
