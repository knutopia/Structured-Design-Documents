import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import {
  createGuidedAdditionRuntime,
  createGuidedDocumentSnapshot,
  GuidedAdditionDomainError,
  loadBundle,
  type Bundle,
  type ExistingNodeRef,
  type GuidedAdditionResult,
  type GuidedDocumentSnapshot,
  type GuidedStep
} from "../src/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");
const examplePath = path.join(repoRoot, "bundle/v0.1/examples/outcome_to_ia_trace.sdd");
const uiPath = path.join(repoRoot, "bundle/v0.1/examples/place_viewstate_transition.sdd");

let bundle: Bundle;
let source: string;
let uiSource: string;

beforeAll(async () => {
  bundle = await loadBundle(manifestPath);
  source = fs.readFileSync(examplePath, "utf8");
  uiSource = fs.readFileSync(uiPath, "utf8");
});

function snapshotFor(selected: Bundle, text = source): GuidedDocumentSnapshot {
  return createGuidedDocumentSnapshot(selected, { document_ref: "document.sdd", path: "document.sdd", text });
}

function ref(snapshot: GuidedDocumentSnapshot, id: string): ExistingNodeRef {
  const node = snapshot.nodes.find((candidate) => candidate.node_id === id)!;
  return { kind: "existing_node", handle: node.handle, node_id: node.node_id, node_type: node.node_type };
}

function step<K extends GuidedStep["kind"]>(result: GuidedAdditionResult, kind: K): Extract<GuidedStep, { kind: K }> {
  expect(result.kind).toBe("sdd-guided-addition-step");
  expect((result as any).step.kind).toBe(kind);
  return (result as any).step;
}

function chooseRelationship(
  selected: Bundle,
  snapshot: GuidedDocumentSnapshot,
  anchorId: string,
  direction: "outgoing" | "incoming",
  strategy: "existing_only" | "existing_or_new",
  filter = {}
): GuidedAdditionResult {
  const runtime = createGuidedAdditionRuntime(selected);
  let result = runtime.begin(snapshot, { anchor: ref(snapshot, anchorId), initial_filter: filter });
  result = runtime.advance(snapshot, result.state, {
    kind: "choose_operation",
    selection: { kind: "add_relationship", direction, endpoint_strategy: strategy }
  });
  return result;
}

describe("bundle-only guided behavior proofs", () => {
  it("changes offered relationship triples when allowed endpoints change", () => {
    const originalSnapshot = snapshotFor(bundle);
    const original = step(
      chooseRelationship(bundle, originalSnapshot, "G-001", "outgoing", "existing_or_new"),
      "choose_relationship"
    );
    expect(original.options.some((choice) => choice.relationship_type === "CONTAINS" && choice.to_type === "Step")).toBe(true);

    const changed = structuredClone(bundle);
    const endpoint = changed.contracts.relationships.find((relationship) => relationship.type === "CONTAINS")!
      .allowed_endpoints.find((candidate) => candidate.from === "Stage" && candidate.to === "Step")!;
    endpoint.to = "Place";
    for (const view of changed.views.views) {
      const entry = view.conventions.guided_addition!.relationships.find(
        (candidate) => candidate.from === "Stage" && candidate.type === "CONTAINS" && candidate.to === "Step"
      )!;
      entry.to = "Place";
    }
    const changedSnapshot = snapshotFor(changed);
    const choices = step(
      chooseRelationship(changed, changedSnapshot, "G-001", "outgoing", "existing_or_new"),
      "choose_relationship"
    ).options;
    expect(choices.some((choice) => choice.relationship_type === "CONTAINS" && choice.to_type === "Step")).toBe(false);
    expect(choices.some((choice) => choice.relationship_type === "CONTAINS" && choice.to_type === "Place")).toBe(true);
  });

  it("changes ID suggestions when prefix and width change", () => {
    const changed = structuredClone(bundle);
    changed.authoring!.node_id_suggestions.prefix_by_type.Policy = "PX";
    changed.authoring!.node_id_suggestions.minimum_digits = 4;
    const snapshot = snapshotFor(changed);
    const runtime = createGuidedAdditionRuntime(changed);
    let result = runtime.begin(snapshot, {});
    result = runtime.advance(snapshot, result.state, { kind: "choose_operation", selection: { kind: "add_node" } });
    result = runtime.advance(snapshot, result.state, { kind: "choose_node_type", node_type: "Policy" });
    expect(step(result, "edit_new_node").suggested_node_id).toBe("PX-0001");
  });

  it("changes filtering when view role and display data change", () => {
    const changed = structuredClone(bundle);
    const entry = changed.views.views.find((view) => view.id === "outcome_opportunity_map")!
      .conventions.guided_addition!.relationships.find(
        (relationship) => relationship.from === "Outcome" && relationship.type === "MEASURED_BY"
      )!;
    entry.role = "bridge";
    entry.display_by_profile.simple[0] = { presence: "hidden", label: "not_applicable" };
    const snapshot = snapshotFor(changed);
    const primary = step(
      chooseRelationship(changed, snapshot, "O-001", "outgoing", "existing_or_new", {
        view_id: "outcome_opportunity_map",
        roles: ["primary"]
      }),
      "choose_relationship"
    );
    expect(primary.options.some((choice) => choice.relationship_type === "MEASURED_BY")).toBe(false);
    const hidden = step(
      chooseRelationship(changed, snapshot, "O-001", "outgoing", "existing_or_new", {
        view_id: "outcome_opportunity_map",
        roles: ["bridge"],
        presences: ["hidden"]
      }),
      "choose_relationship"
    );
    expect(hidden.options.some((choice) => choice.relationship_type === "MEASURED_BY")).toBe(true);
  });

  it("changes edge forms and completion gates from support and required-property rules", () => {
    const changed = structuredClone(bundle);
    const contract = changed.contracts.relationships.find((relationship) => relationship.type === "BINDS_TO")!;
    const support = contract.constraints.find((rule) => rule.rule_logic?.kind === "edge_field_support")!.rule_logic!;
    support.properties = ["field", "format"];
    contract.constraints.find((rule) => rule.rule_logic?.kind === "required_edge_property")!.rule_logic!.property = "format";
    const snapshot = snapshotFor(changed, uiSource);
    const runtime = createGuidedAdditionRuntime(changed);
    let result = chooseRelationship(changed, snapshot, "C-010", "outgoing", "existing_only");
    const choice = step(result, "choose_relationship").options.find((item) => item.relationship_type === "BINDS_TO")!;
    expect(choice.required_edge_fields.map((field) => field.property)).toEqual(["format"]);
    expect(choice.optional_edge_fields.map((field) => field.property)).toContain("field");
    result = runtime.advance(snapshot, result.state, { kind: "choose_relationship", choice_id: choice.choice_id });
    const endpoint = step(result, "choose_endpoint").options.find(
      (item) => item.kind === "existing" && item.node.node_id === "D-010"
    )!;
    result = runtime.advance(snapshot, result.state, { kind: "choose_existing_endpoint", node: (endpoint as any).node });
    const edge = step(result, "edit_edge_fields");
    expect(() => runtime.advance(snapshot, result.state, { kind: "set_edge_fields", fields: edge.values }))
      .toThrowError(expect.objectContaining({ code: "guided_addition.required_field_missing" }));
    result = runtime.advance(snapshot, result.state, {
      kind: "set_edge_fields",
      fields: { ...edge.values, props: { format: "currency" } }
    });
    expect(step(result, "review_proposal").proposal.placements).toEqual([]);
  });
});

describe("pure planner architecture boundary", () => {
  it("reports older bundles without authoring metadata as unsupported", () => {
    const older = structuredClone(bundle);
    delete older.authoring;
    expect(() => createGuidedAdditionRuntime(older)).toThrowError(
      expect.objectContaining({ code: "guided_addition.unsupported_bundle" })
    );
  });

  it("imports no filesystem, mutation, journal, workspace-write, helper, or CLI modules", () => {
    const directory = path.join(repoRoot, "src/authoring/guidedAddition");
    const files = ["planner.ts", "placement.ts", "forms.ts", "identifiers.ts", "catalog.ts"];
    const text = files.map((file) => fs.readFileSync(path.join(directory, file), "utf8")).join("\n");
    expect(text).not.toMatch(/from\s+["']node:fs/);
    expect(text).not.toMatch(/authoring\/mutations|authoring\/journal|workspace\/write|helperProgram|\/cli\//);
    expect(text).not.toContain("ChangeOperation");
    expect(text).not.toContain("executeChangeOperations");
  });

  it("uses only the reserved proposal-local IDs and opaque digest prefixes", () => {
    const directory = path.join(repoRoot, "src/authoring/guidedAddition");
    const text = ["planner.ts", "placement.ts", "contracts.ts", "identifiers.ts"]
      .map((file) => fs.readFileSync(path.join(directory, file), "utf8"))
      .join("\n");
    const localIds = [...text.matchAll(/["']((?:node|edge)_\d+)["']/g)].map((match) => match[1]);
    expect(new Set(localIds)).toEqual(new Set(["node_1", "edge_1"]));
    expect(text).not.toMatch(/\b(?:CONTAINS|PRECEDES|BINDS_TO|Outcome|ViewState)\b/);
  });

  it("keeps workflow results, state, and proposals immutable and semantic-only", () => {
    const snapshot = snapshotFor(bundle);
    const runtime = createGuidedAdditionRuntime(bundle);
    const result = runtime.begin(snapshot, {});
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.state)).toBe(true);
    expect(Object.isFrozen(step(result, "choose_operation").options)).toBe(true);

    const json = JSON.stringify(result);
    expect(json).not.toContain(source);
    expect(json).not.toContain("ChangeOperation");
    expect(json).not.toContain("commit");
  });

  it("binds filters to bundle values and retains unchanged state on rejection", () => {
    const snapshot = snapshotFor(bundle);
    const runtime = createGuidedAdditionRuntime(bundle);
    const begun = runtime.begin(snapshot, {});
    try {
      runtime.advance(snapshot, begun.state, { kind: "set_filter", filter: { view_id: "missing" } });
      throw new Error("expected rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(GuidedAdditionDomainError);
      expect((error as GuidedAdditionDomainError).code).toBe("guided_addition.choice_unavailable");
      expect((error as GuidedAdditionDomainError).state).toBe(begun.state);
    }
  });
});
