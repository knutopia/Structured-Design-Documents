import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import {
  createGuidedAdditionRuntime,
  createGuidedDocumentSnapshot,
  GuidedAdditionDomainError,
  loadBundle,
  type BeginGuidedAdditionRequest,
  type Bundle,
  type CompletedAdditionProposal,
  type ExistingNodeRef,
  type GuidedAdditionAction,
  type GuidedAdditionResult,
  type GuidedDocumentSnapshot,
  type GuidedOperationSelection,
  type GuidedStep
} from "../src/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");
const examplePath = path.join(repoRoot, "bundle/v0.1/examples/outcome_to_ia_trace.sdd");
const uiExamplePath = path.join(repoRoot, "bundle/v0.1/examples/place_viewstate_transition.sdd");

let bundle: Bundle;
let snapshot: GuidedDocumentSnapshot;
let uiSnapshot: GuidedDocumentSnapshot;

beforeAll(async () => {
  bundle = await loadBundle(manifestPath);
  snapshot = createGuidedDocumentSnapshot(bundle, {
    document_ref: "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
    path: "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
    text: fs.readFileSync(examplePath, "utf8")
  });
  uiSnapshot = createGuidedDocumentSnapshot(bundle, {
    document_ref: "bundle/v0.1/examples/place_viewstate_transition.sdd",
    path: "bundle/v0.1/examples/place_viewstate_transition.sdd",
    text: fs.readFileSync(uiExamplePath, "utf8")
  });
});

function nodeRef(current: GuidedDocumentSnapshot, id: string): ExistingNodeRef {
  const node = current.nodes.find((candidate) => candidate.node_id === id)!;
  return { kind: "existing_node", handle: node.handle, node_id: node.node_id, node_type: node.node_type };
}

function expectStep<K extends GuidedStep["kind"]>(
  result: GuidedAdditionResult,
  kind: K
): Extract<GuidedStep, { kind: K }> {
  expect(result.kind).toBe("sdd-guided-addition-step");
  const step = (result as Extract<GuidedAdditionResult, { kind: "sdd-guided-addition-step" }>).step;
  expect(step.kind).toBe(kind);
  return step as Extract<GuidedStep, { kind: K }>;
}

function advance(
  current: GuidedDocumentSnapshot,
  result: GuidedAdditionResult,
  action: GuidedAdditionAction
): GuidedAdditionResult {
  return createGuidedAdditionRuntime(bundle).advance(current, result.state, action);
}

function chooseOperation(
  current: GuidedDocumentSnapshot,
  request: BeginGuidedAdditionRequest,
  selection: GuidedOperationSelection
): GuidedAdditionResult {
  const runtime = createGuidedAdditionRuntime(bundle);
  const begun = runtime.begin(current, request);
  expectStep(begun, "choose_operation");
  return runtime.advance(current, begun.state, { kind: "choose_operation", selection });
}

function selectAllRecommended(current: GuidedDocumentSnapshot, initial: GuidedAdditionResult): GuidedAdditionResult {
  let result = initial;
  while (expectStep(result, "review_placement")) {
    const step = expectStep(result, "review_placement");
    const selectedIds = new Set(result.state.selections.placements.map((selection) => selection.recommendation_id));
    const recommendation = step.recommendations.find((candidate) => !selectedIds.has(candidate.recommendation_id));
    if (!recommendation) break;
    result = advance(current, result, {
      kind: "select_placement",
      selection: {
        recommendation_id: recommendation.recommendation_id,
        selected: recommendation.recommended
      }
    });
    if ((result as Extract<GuidedAdditionResult, { kind: "sdd-guided-addition-step" }>).step.kind !== "review_placement") {
      break;
    }
  }
  return result;
}

function finish(current: GuidedDocumentSnapshot, initial: GuidedAdditionResult): CompletedAdditionProposal {
  let result = selectAllRecommended(current, initial);
  const possibleEffect = expectStep(result, (result as any).step.kind);
  if (possibleEffect.kind === "confirm_effect") {
    result = advance(current, result, { kind: "confirm_effect", effect: { ...possibleEffect.effect, confirmed: true } });
  }
  expectStep(result, "review_proposal");
  result = advance(current, result, { kind: "complete" });
  expect(result.kind).toBe("sdd-guided-addition-complete");
  return (result as Extract<GuidedAdditionResult, { kind: "sdd-guided-addition-complete" }>).proposal;
}

function relationshipRoute(
  current: GuidedDocumentSnapshot,
  anchorId: string,
  selection: Extract<GuidedOperationSelection, { kind: "add_relationship" }>,
  relationshipType: string,
  endpointId?: string
): GuidedAdditionResult {
  let result = chooseOperation(current, { anchor: nodeRef(current, anchorId) }, selection);
  const relationships = expectStep(result, "choose_relationship");
  const relationship = relationships.options.find((choice) => choice.relationship_type === relationshipType)!;
  result = advance(current, result, { kind: "choose_relationship", choice_id: relationship.choice_id });
  const endpoints = expectStep(result, "choose_endpoint");
  if (endpointId) {
    const endpoint = endpoints.options.find((option) => option.kind === "existing" && option.node.node_id === endpointId)!;
    expect(endpoint.kind).toBe("existing");
    result = advance(current, result, { kind: "choose_existing_endpoint", node: (endpoint as any).node });
  } else {
    expect(endpoints.options.at(-1)?.kind).toBe("create_new");
    result = advance(current, result, { kind: "create_new_endpoint" });
    const edit = expectStep(result, "edit_new_node");
    result = advance(current, result, {
      kind: "set_new_node_fields",
      fields: { ...edit.values, name: `New ${edit.fields[0] ? result.state.selections.endpoint!.node_type : "node"}` }
    });
  }
  if ((result as any).step.kind === "edit_edge_fields") {
    const edge = expectStep(result, "edit_edge_fields");
    const required = Object.fromEntries(
      edge.fields.filter((field) => field.required && field.property).map((field) => [field.property!, "value"])
    );
    result = advance(current, result, {
      kind: "set_edge_fields",
      fields: { ...edge.values, props: required }
    });
  }
  return result;
}

describe("guided addition planner routes", () => {
  it("completes a standalone node proposal", () => {
    let result = chooseOperation(snapshot, {}, { kind: "add_node" });
    const types = expectStep(result, "choose_node_type");
    expect(types.options).toHaveLength(16);
    result = advance(snapshot, result, { kind: "choose_node_type", node_type: "Policy" });
    const edit = expectStep(result, "edit_new_node");
    expect(edit.suggested_node_id).toBe("PL-001");
    result = advance(snapshot, result, {
      kind: "set_new_node_fields",
      fields: { ...edit.values, node_id: "PL-001", name: "Retention policy" }
    });
    const proposal = finish(snapshot, result);
    expect(proposal).toMatchObject({
      kind: "sdd-addition-proposal",
      new_nodes: [{ local_id: "node_1", node_type: "Policy", node_id: "PL-001" }],
      new_edges: []
    });
    expect(proposal).not.toHaveProperty("relationship");
    expect(proposal.proposal_id).toMatch(/^addp_[a-f0-9]{64}$/);
  });

  it.each([
    ["outgoing existing", "O-001", { kind: "add_relationship", direction: "outgoing", endpoint_strategy: "existing_only" }, "MEASURED_BY", "M-001", "O-001", "M-001", 0],
    ["outgoing new", "O-001", { kind: "add_relationship", direction: "outgoing", endpoint_strategy: "existing_or_new" }, "MEASURED_BY", undefined, "O-001", undefined, 1],
    ["incoming existing", "O-001", { kind: "add_relationship", direction: "incoming", endpoint_strategy: "existing_only" }, "SUPPORTS", "OP-001", "OP-001", "O-001", 0],
    ["incoming new", "O-001", { kind: "add_relationship", direction: "incoming", endpoint_strategy: "existing_or_new" }, "SUPPORTS", undefined, undefined, "O-001", 1]
  ] as const)("completes the %s route with literal direction", (_name, anchor, operation, rel, endpoint, from, to, newNodes) => {
    const proposal = finish(snapshot, relationshipRoute(snapshot, anchor, operation, rel, endpoint));
    expect(proposal.new_nodes).toHaveLength(newNodes);
    expect(proposal.new_edges).toHaveLength(1);
    expect(proposal.relationship?.type).toBe(rel);
    expect(proposal.relationship?.from.node_id).toBe(from ?? proposal.new_nodes[0].node_id);
    expect(proposal.relationship?.to.node_id).toBe(to ?? proposal.new_nodes[0].node_id);
    expect(proposal.new_edges[0]).toMatchObject({
      from: proposal.relationship?.from,
      type: proposal.relationship?.type,
      to: proposal.relationship?.to
    });
  });

  it("omits endpoint triples in existing-only mode when no endpoint exists", () => {
    const result = chooseOperation(
      snapshot,
      { anchor: nodeRef(snapshot, "I-001") },
      { kind: "add_relationship", direction: "outgoing", endpoint_strategy: "existing_only" }
    );
    const choices = expectStep(result, "choose_relationship");
    expect(choices.options.some((choice) => choice.to_type === "Process")).toBe(false);
  });
});

describe("guided filtering, display metadata, and forms", () => {
  it("orders primary, supporting, then bridge while retaining bridges", () => {
    const result = chooseOperation(
      uiSnapshot,
      { anchor: nodeRef(uiSnapshot, "P-010"), initial_filter: { view_id: "ui_contracts" } },
      { kind: "add_relationship", direction: "outgoing", endpoint_strategy: "existing_or_new" }
    );
    const choices = expectStep(result, "choose_relationship").options;
    const roles = choices.map((choice) => choice.role_by_view.ui_contracts!);
    expect(roles).toContain("primary");
    expect(roles).toContain("supporting");
    expect(roles).toContain("bridge");
    expect(roles.map((role) => ({ primary: 0, supporting: 1, bridge: 2 })[role])).toEqual(
      [...roles].map((role) => ({ primary: 0, supporting: 1, bridge: 2 })[role]).sort((a, b) => a - b)
    );
  });

  it("uses simple, strict, permissive alias, and document-conditional display", () => {
    const run = (profile: string) => {
      const result = chooseOperation(
        uiSnapshot,
        {
          anchor: nodeRef(uiSnapshot, "ST-010a"),
          initial_filter: { view_id: "ui_contracts", display_profile_id: profile }
        },
        { kind: "add_relationship", direction: "outgoing", endpoint_strategy: "existing_or_new" }
      );
      return expectStep(result, "choose_relationship").options.find(
        (choice) => choice.from_type === "State" && choice.relationship_type === "TRANSITIONS_TO"
      )!;
    };
    const simple = run("simple");
    const strict = run("strict");
    const permissive = run("permissive");
    expect(simple.display_by_view.ui_contracts!.simple.presence).toBe("hidden");
    expect(strict.display_by_view.ui_contracts!.strict).toMatchObject({ presence: "connector", label: "visible" });
    expect(permissive.display_by_view.ui_contracts!.permissive).toEqual(strict.display_by_view.ui_contracts!.strict);

    const withoutViewState = createGuidedDocumentSnapshot(bundle, {
      document_ref: "state-only.sdd",
      text: [
        "SDD-TEXT 0.1",
        "",
        "Component C-001 \"Component\"",
        "  + State ST-001 \"Ready\"",
        "  END",
        "  + State ST-002 \"Busy\"",
        "  END",
        "END",
        ""
      ].join("\n")
    });
    const visible = chooseOperation(
      withoutViewState,
      {
        anchor: nodeRef(withoutViewState, "ST-001"),
        initial_filter: { view_id: "ui_contracts", display_profile_id: "simple" }
      },
      { kind: "add_relationship", direction: "outgoing", endpoint_strategy: "existing_or_new" }
    );
    const visibleChoice = expectStep(visible, "choose_relationship").options.find(
      (choice) => choice.from_type === "State" && choice.relationship_type === "TRANSITIONS_TO"
    )!;
    expect(visibleChoice.display_by_view.ui_contracts!.simple.presence).toBe("connector");
  });

  it("applies explicit role and presence filters without profile completeness", () => {
    const result = chooseOperation(
      uiSnapshot,
      {
        anchor: nodeRef(uiSnapshot, "P-010"),
        initial_filter: { view_id: "ui_contracts", roles: ["bridge"], presences: ["hidden"] }
      },
      { kind: "add_relationship", direction: "outgoing", endpoint_strategy: "existing_or_new" }
    );
    const choices = expectStep(result, "choose_relationship").options;
    expect(choices.length).toBeGreaterThan(0);
    expect(choices.every((choice) => choice.role_by_view.ui_contracts === "bridge")).toBe(true);
    expect(choices.every((choice) => choice.display_by_view.ui_contracts!.simple.presence === "hidden")).toBe(true);
  });

  it("recomputes offers and clears downstream selections after a filter change", () => {
    const runtime = createGuidedAdditionRuntime(bundle);
    let result = chooseOperation(
      uiSnapshot,
      { anchor: nodeRef(uiSnapshot, "P-010"), initial_filter: { view_id: "ui_contracts" } },
      { kind: "add_relationship", direction: "outgoing", endpoint_strategy: "existing_or_new" }
    );
    const primary = expectStep(result, "choose_relationship").options.find(
      (choice) => choice.role_by_view.ui_contracts === "primary"
    )!;
    result = runtime.advance(uiSnapshot, result.state, { kind: "choose_relationship", choice_id: primary.choice_id });
    expectStep(result, "choose_endpoint");
    result = runtime.advance(uiSnapshot, result.state, {
      kind: "set_filter",
      filter: { view_id: "ui_contracts", roles: ["bridge"] }
    });
    expectStep(result, "choose_relationship");
    expect(result.state.selections.relationship_choice_id).toBeUndefined();
    expect(result.state.selections.endpoint).toBeUndefined();
  });

  it("derives required BINDS_TO.field and optional annotations from contracts", () => {
    const runtime = createGuidedAdditionRuntime(bundle);
    let result = chooseOperation(
      uiSnapshot,
      { anchor: nodeRef(uiSnapshot, "C-010") },
      { kind: "add_relationship", direction: "outgoing", endpoint_strategy: "existing_only" }
    );
    const binds = expectStep(result, "choose_relationship").options.find(
      (choice) => choice.relationship_type === "BINDS_TO"
    )!;
    expect(binds.required_edge_fields.map((field) => field.property)).toEqual(["field"]);
    result = runtime.advance(uiSnapshot, result.state, { kind: "choose_relationship", choice_id: binds.choice_id });
    const data = expectStep(result, "choose_endpoint").options.find(
      (option) => option.kind === "existing" && option.node.node_id === "D-010"
    )!;
    result = runtime.advance(uiSnapshot, result.state, { kind: "choose_existing_endpoint", node: (data as any).node });
    const required = expectStep(result, "edit_edge_fields");
    expect(() => runtime.advance(uiSnapshot, result.state, { kind: "set_edge_fields", fields: required.values }))
      .toThrowError(expect.objectContaining({ code: "guided_addition.required_field_missing" }));
    result = runtime.advance(uiSnapshot, result.state, {
      kind: "set_edge_fields",
      fields: { ...required.values, props: { field: "status" } }
    });
    expectStep(result, "review_placement");

    result = relationshipRoute(
      snapshot,
      "P-001",
      { kind: "add_relationship", direction: "outgoing", endpoint_strategy: "existing_only" },
      "NAVIGATES_TO",
      "P-002"
    );
    expect(result.state.selections.edge_fields).toEqual({ event: null, guard: null, effect: null, props: {} });

    let annotations = chooseOperation(
      snapshot,
      { anchor: nodeRef(snapshot, "J-001") },
      { kind: "add_relationship", direction: "outgoing", endpoint_strategy: "existing_only" }
    );
    const precedes = expectStep(annotations, "choose_relationship").options.find(
      (choice) => choice.relationship_type === "PRECEDES"
    )!;
    annotations = runtime.advance(snapshot, annotations.state, { kind: "choose_relationship", choice_id: precedes.choice_id });
    const target = expectStep(annotations, "choose_endpoint").options.find(
      (option) => option.kind === "existing" && option.node.node_id === "J-002"
    )!;
    annotations = runtime.advance(snapshot, annotations.state, {
      kind: "choose_existing_endpoint",
      node: (target as any).node
    });
    const annotationFields = expectStep(annotations, "edit_edge_fields");
    expect(annotationFields.fields.map((field) => field.source)).toEqual(["edge_event", "edge_guard", "edge_effect"]);
    annotations = runtime.advance(snapshot, annotations.state, {
      kind: "set_edge_fields",
      fields: { event: "E-001", guard: "ready", effect: "advance", props: {} }
    });
    const proposal = finish(snapshot, annotations);
    expect(proposal.new_edges[0]).toMatchObject({ event: "E-001", guard: "ready", effect: "advance" });
  });

  it("derives profile formats for advanced node properties", () => {
    let result = chooseOperation(snapshot, {}, { kind: "add_node" });
    result = advance(snapshot, result, { kind: "choose_node_type", node_type: "Place" });
    const fields = expectStep(result, "edit_new_node").fields;
    expect(fields.find((field) => field.property === "access")).toMatchObject({ format: "pattern", pattern: expect.any(String) });
    expect(fields.find((field) => field.property === "primary_nav")).toMatchObject({
      format: "enum",
      allowed_values: ["true", "false"]
    });
  });
});

describe("guided IDs, state binding, and determinism", () => {
  it("handles suffixed numeric IDs and user-edited valid IDs", () => {
    let result = chooseOperation(uiSnapshot, {}, { kind: "add_node" });
    result = advance(uiSnapshot, result, { kind: "choose_node_type", node_type: "State" });
    const edit = expectStep(result, "edit_new_node");
    expect(edit.suggested_node_id).toBe("ST-011");
    result = advance(uiSnapshot, result, {
      kind: "set_new_node_fields",
      fields: { ...edit.values, node_id: "ST-099x", name: "Edited state" }
    });
    expectStep(result, "review_placement");
  });

  it("rejects invalid and duplicate IDs with unchanged caller state", () => {
    let result = chooseOperation(snapshot, {}, { kind: "add_node" });
    result = advance(snapshot, result, { kind: "choose_node_type", node_type: "Outcome" });
    const edit = expectStep(result, "edit_new_node");
    for (const [id, code] of [["", "guided_addition.invalid_node_id"], ["bad", "guided_addition.invalid_node_id"], ["O-001", "guided_addition.node_id_collision"]] as const) {
      try {
        advance(snapshot, result, { kind: "set_new_node_fields", fields: { ...edit.values, node_id: id, name: "Name" } });
        throw new Error("expected rejection");
      } catch (error) {
        expect(error).toBeInstanceOf(GuidedAdditionDomainError);
        expect((error as GuidedAdditionDomainError).code).toBe(code);
        expect((error as GuidedAdditionDomainError).state).toBe(result.state);
        expect(result.state.selections.new_node_fields).toBeUndefined();
      }
    }
  });

  it("rejects stale states and actions that were not offered", () => {
    const runtime = createGuidedAdditionRuntime(bundle);
    const begun = runtime.begin(snapshot, {});
    const stale = structuredClone(snapshot);
    stale.revision = `${snapshot.revision}-changed`;
    expect(() => runtime.advance(stale, begun.state, { kind: "choose_operation", selection: { kind: "add_node" } }))
      .toThrowError(expect.objectContaining({ code: "guided_addition.state_stale" }));
    const changedBundle = structuredClone(snapshot);
    changedBundle.bundle_fingerprint = `bnd_${"0".repeat(64)}`;
    expect(() => runtime.advance(changedBundle, begun.state, { kind: "choose_operation", selection: { kind: "add_node" } }))
      .toThrowError(expect.objectContaining({ code: "guided_addition.state_stale" }));
    expect(() => runtime.advance(snapshot, begun.state, { kind: "choose_node_type", node_type: "Place" }))
      .toThrowError(expect.objectContaining({ code: "guided_addition.choice_unavailable" }));
    const mismatchedAnchor = { ...nodeRef(snapshot, "O-001"), node_id: "O-999" };
    expect(() => runtime.begin(snapshot, { anchor: mismatchedAnchor }))
      .toThrowError(expect.objectContaining({ code: "guided_addition.choice_unavailable" }));
  });

  it("revalidates caller-carried selections on every advance", () => {
    let result = chooseOperation(snapshot, {}, { kind: "add_node" });
    result = advance(snapshot, result, { kind: "choose_node_type", node_type: "Policy" });
    const edit = expectStep(result, "edit_new_node");
    result = advance(snapshot, result, {
      kind: "set_new_node_fields",
      fields: { ...edit.values, name: "Policy" }
    });
    const placement = expectStep(result, "review_placement").recommendations[0];
    const tampered = structuredClone(result.state);
    tampered.selections.new_node_fields!.node_id = "invalid";
    expect(() => createGuidedAdditionRuntime(bundle).advance(snapshot, tampered, {
      kind: "select_placement",
      selection: { recommendation_id: placement.recommendation_id, selected: placement.recommended }
    })).toThrowError(expect.objectContaining({ code: "guided_addition.invalid_node_id" }));
  });

  it("produces byte-identical transitions and proposal IDs", () => {
    const firstStart = relationshipRoute(
      snapshot,
      "O-001",
      { kind: "add_relationship", direction: "outgoing", endpoint_strategy: "existing_only" },
      "MEASURED_BY",
      "M-001"
    );
    const secondStart = relationshipRoute(
      snapshot,
      "O-001",
      { kind: "add_relationship", direction: "outgoing", endpoint_strategy: "existing_only" },
      "MEASURED_BY",
      "M-001"
    );
    expect(JSON.stringify(secondStart)).toBe(JSON.stringify(firstStart));
    const first = finish(snapshot, firstStart);
    const second = finish(snapshot, secondStart);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(second.proposal_id).toBe(first.proposal_id);
  });
});
