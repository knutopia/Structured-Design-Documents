import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import {
  applyAdditionProposal,
  computeBundleFingerprint,
  createGuidedAdditionRuntime,
  createGuidedDocumentSnapshot,
  loadBundle,
  type Bundle,
  type CompletedAdditionProposal,
  type ExistingNodeRef,
  type GuidedAdditionAction,
  type GuidedAdditionResult,
  type GuidedDocumentSnapshot,
  type GuidedStep
} from "../src/index.js";
import { createChangeSetJournal } from "../src/authoring/journal.js";
import { undoChangeSet } from "../src/authoring/undo.js";
import { createAuthoringWorkspace } from "../src/authoring/workspace.js";
import { createGuidedOpaqueId } from "../src/authoring/guidedAddition/identifiers.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

let bundle: Bundle;

beforeAll(async () => {
  bundle = await loadBundle(manifestPath);
});

async function withTempRepo(run: (tempRoot: string) => Promise<void>): Promise<void> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "sdd-addition-proposal-"));
  try {
    await run(tempRoot);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function writeDocument(root: string, documentPath: string, text: string): Promise<void> {
  const absolutePath = path.join(root, documentPath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, text, "utf8");
}

function snapshotFor(currentBundle: Bundle, documentPath: string, text: string): GuidedDocumentSnapshot {
  return createGuidedDocumentSnapshot(currentBundle, {
    document_ref: documentPath,
    path: documentPath,
    text
  });
}

function nodeRef(snapshot: GuidedDocumentSnapshot, nodeId: string): ExistingNodeRef {
  const node = snapshot.nodes.find((candidate) => candidate.node_id === nodeId)!;
  return { kind: "existing_node", handle: node.handle, node_id: node.node_id, node_type: node.node_type };
}

function step<K extends GuidedStep["kind"]>(result: GuidedAdditionResult, kind: K): Extract<GuidedStep, { kind: K }> {
  expect(result.kind).toBe("sdd-guided-addition-step");
  const current = (result as Extract<GuidedAdditionResult, { kind: "sdd-guided-addition-step" }>).step;
  expect(current.kind).toBe(kind);
  return current as Extract<GuidedStep, { kind: K }>;
}

function advance(
  currentBundle: Bundle,
  snapshot: GuidedDocumentSnapshot,
  result: GuidedAdditionResult,
  action: GuidedAdditionAction
): GuidedAdditionResult {
  return createGuidedAdditionRuntime(currentBundle).advance(snapshot, result.state, action);
}

function finish(
  currentBundle: Bundle,
  snapshot: GuidedDocumentSnapshot,
  initial: GuidedAdditionResult
): CompletedAdditionProposal {
  let result = initial;
  while (step(result, "review_placement")) {
    const review = step(result, "review_placement");
    const selected = new Set(result.state.selections.placements.map((item) => item.recommendation_id));
    const next = review.recommendations.find((item) => !selected.has(item.recommendation_id));
    if (!next) break;
    result = advance(currentBundle, snapshot, result, {
      kind: "select_placement",
      selection: { recommendation_id: next.recommendation_id, selected: next.recommended }
    });
    if ((result as any).step.kind !== "review_placement") break;
  }
  if ((result as any).step.kind === "confirm_effect") {
    const effect = step(result, "confirm_effect").effect;
    result = advance(currentBundle, snapshot, result, {
      kind: "confirm_effect",
      effect: { ...effect, confirmed: true }
    });
  }
  step(result, "review_proposal");
  result = advance(currentBundle, snapshot, result, { kind: "complete" });
  expect(result.kind).toBe("sdd-guided-addition-complete");
  return (result as Extract<GuidedAdditionResult, { kind: "sdd-guided-addition-complete" }>).proposal;
}

function standaloneProposal(
  currentBundle: Bundle,
  snapshot: GuidedDocumentSnapshot,
  nodeType: string,
  name: string
): CompletedAdditionProposal {
  const runtime = createGuidedAdditionRuntime(currentBundle);
  let result = runtime.begin(snapshot, {});
  result = runtime.advance(snapshot, result.state, { kind: "choose_operation", selection: { kind: "add_node" } });
  step(result, "choose_node_type");
  result = runtime.advance(snapshot, result.state, { kind: "choose_node_type", node_type: nodeType });
  const edit = step(result, "edit_new_node");
  result = runtime.advance(snapshot, result.state, {
    kind: "set_new_node_fields",
    fields: { ...edit.values, name }
  });
  return finish(currentBundle, snapshot, result);
}

function relationshipProposal(
  currentBundle: Bundle,
  snapshot: GuidedDocumentSnapshot,
  args: {
    anchor: string;
    direction: "outgoing" | "incoming";
    relationship: string;
    endpoint?: string;
    newName?: string;
    props?: Record<string, string>;
  }
): CompletedAdditionProposal {
  const runtime = createGuidedAdditionRuntime(currentBundle);
  let result = runtime.begin(snapshot, { anchor: nodeRef(snapshot, args.anchor) });
  result = runtime.advance(snapshot, result.state, {
    kind: "choose_operation",
    selection: {
      kind: "add_relationship",
      direction: args.direction,
      endpoint_strategy: args.endpoint ? "existing_only" : "existing_or_new"
    }
  });
  const relationship = step(result, "choose_relationship").options.find(
    (choice) => choice.relationship_type === args.relationship
  )!;
  result = runtime.advance(snapshot, result.state, { kind: "choose_relationship", choice_id: relationship.choice_id });
  const endpoint = step(result, "choose_endpoint");
  if (args.endpoint) {
    const selected = endpoint.options.find(
      (option) => option.kind === "existing" && option.node.node_id === args.endpoint
    );
    expect(selected?.kind).toBe("existing");
    result = runtime.advance(snapshot, result.state, {
      kind: "choose_existing_endpoint",
      node: (selected as Extract<typeof selected, { kind: "existing" }>).node
    });
  } else {
    result = runtime.advance(snapshot, result.state, { kind: "create_new_endpoint" });
    const edit = step(result, "edit_new_node");
    result = runtime.advance(snapshot, result.state, {
      kind: "set_new_node_fields",
      fields: { ...edit.values, name: args.newName ?? "New endpoint" }
    });
  }
  if ((result as any).step.kind === "edit_edge_fields") {
    const edge = step(result, "edit_edge_fields");
    result = runtime.advance(snapshot, result.state, {
      kind: "set_edge_fields",
      fields: { ...edge.values, props: args.props ?? {} }
    });
  }
  return finish(currentBundle, snapshot, result);
}

function withRecomputedId(proposal: CompletedAdditionProposal, mutate: (copy: CompletedAdditionProposal) => void): CompletedAdditionProposal {
  const copy = structuredClone(proposal);
  mutate(copy);
  const { proposal_id: _old, ...withoutId } = copy;
  copy.proposal_id = createGuidedOpaqueId("addp", withoutId);
  return copy;
}

function codes(result: Awaited<ReturnType<typeof applyAdditionProposal>>): string[] {
  return result.diagnostics.map((item) => item.code);
}

describe("addition proposal executor", () => {
  it("applies a standalone proposal with deterministic dry-run/commit parity, mappings, journal, and undo", async () => {
    await withTempRepo(async (tempRoot) => {
      const documentPath = "docs/standalone.sdd";
      const original = ["SDD-TEXT 0.1", "Place P-001 \"Home\"", "END", ""].join("\n");
      await writeDocument(tempRoot, documentPath, original);
      const snapshot = snapshotFor(bundle, documentPath, original);
      const proposal = standaloneProposal(bundle, snapshot, "Policy", "Retention policy");
      const reidentified = withRecomputedId(proposal, (copy) => {
        copy.new_nodes[0]!.properties.push({ key: "policy_owner", value_kind: "quoted_string", raw_value: "Legal" });
      });
      const workspace = createAuthoringWorkspace(tempRoot);
      const journal = createChangeSetJournal(workspace, {
        idFactory: (() => {
          const ids = ["chg_add_dry", "chg_add_commit", "chg_add_undo"];
          return () => ids.shift() ?? "chg_add_extra";
        })()
      });

      const dryRun = await applyAdditionProposal(workspace, bundle, { proposal: reidentified }, journal);
      expect(dryRun.status).toBe("applied");
      expect(dryRun.mode).toBe("dry_run");
      expect(await readFile(path.join(tempRoot, documentPath), "utf8")).toBe(original);

      const committed = await applyAdditionProposal(workspace, bundle, {
        proposal: reidentified,
        mode: "commit"
      }, journal);
      expect(committed.status).toBe("applied");
      expect(committed.change_set.origin).toBe("apply_addition_proposal");
      expect(committed.resulting_revision).toBe(dryRun.resulting_revision);
      expect(committed.change_set.operations).toEqual(dryRun.change_set.operations);
      expect(committed.change_set.summary).toEqual(dryRun.change_set.summary);
      expect(committed.created_targets).toEqual(dryRun.created_targets);
      expect(committed.created_targets).toEqual([
        { local_id: "node_1", kind: "node", handle: expect.stringMatching(/^hdl_/) }
      ]);
      expect(committed.change_set.operations.map((operation) => operation.kind)).toEqual([
        "insert_node_block",
        "set_node_property"
      ]);
      expect(await journal.getChangeSetRecord(committed.change_set.change_set_id)).toMatchObject({
        inverse: { kind: "restore_document", path: documentPath, text: original }
      });

      const undo = await undoChangeSet(workspace, bundle, {
        change_set_id: committed.change_set.change_set_id,
        mode: "commit"
      }, journal);
      expect(undo.status).toBe("applied");
      expect(await readFile(path.join(tempRoot, documentPath), "utf8")).toBe(original);
    });
  });

  it("creates a structural parent, edge, and confirmed reparent exactly once with temporary-handle remapping", async () => {
    await withTempRepo(async (tempRoot) => {
      const documentPath = "docs/new-parent.sdd";
      const original = [
        "SDD-TEXT 0.1",
        "Place P-001 \"Child\"",
        "  owner=Design",
        "END",
        "Place P-002 \"Other\"",
        "END",
        ""
      ].join("\n");
      await writeDocument(tempRoot, documentPath, original);
      const snapshot = snapshotFor(bundle, documentPath, original);
      const proposal = relationshipProposal(bundle, snapshot, {
        anchor: "P-001",
        direction: "incoming",
        relationship: "CONTAINS",
        newName: "New area"
      });
      expect(proposal.confirmed_effects).toHaveLength(1);
      const workspace = createAuthoringWorkspace(tempRoot);
      const applied = await applyAdditionProposal(workspace, bundle, { proposal, mode: "commit" });

      expect(applied.status).toBe("applied");
      expect(applied.change_set.operations.map((operation) => operation.kind)).toEqual([
        "insert_node_block",
        "insert_edge_line",
        "reparent_node_block"
      ]);
      expect(applied.created_targets.map((target) => [target.local_id, target.kind])).toEqual([
        ["node_1", "node"],
        ["edge_1", "edge"]
      ]);
      const insertedNodeHandle = applied.created_targets.find((target) => target.local_id === "node_1")!.handle;
      const reparent = applied.change_set.operations[2];
      expect(reparent).toMatchObject({
        kind: "reparent_node_block",
        placement: { parent_handle: insertedNodeHandle }
      });
      expect(applied.change_set.summary.edge_insertions).toHaveLength(1);
      expect(applied.change_set.summary.ordering_changes).toEqual([
        expect.objectContaining({
          kind: "reparented_node_block",
          old_parent_handle: null,
          new_parent_handle: insertedNodeHandle
        })
      ]);
      const text = await readFile(path.join(tempRoot, documentPath), "utf8");
      expect(text.match(/CONTAINS P-001/g)).toHaveLength(1);
      expect(text.match(/\+ Place P-001/g)).toHaveLength(1);
      expect(text).toContain([
        "Area A-001 \"New area\"",
        "  CONTAINS P-001 \"Child\"",
        "  + Place P-001 \"Child\"",
        "    owner=Design",
        "  END",
        "END"
      ].join("\n"));
    });
  });

  it("returns structured rejections for stale revision, changed fingerprint, mismatched edge, and invalid proposal ID", async () => {
    await withTempRepo(async (tempRoot) => {
      const documentPath = "docs/rejections.sdd";
      const source = [
        "SDD-TEXT 0.1",
        "Outcome O-001 \"Outcome\"",
        "END",
        "Metric M-001 \"Metric\"",
        "END",
        ""
      ].join("\n");
      await writeDocument(tempRoot, documentPath, source);
      const snapshot = snapshotFor(bundle, documentPath, source);
      const proposal = relationshipProposal(bundle, snapshot, {
        anchor: "O-001",
        direction: "outgoing",
        relationship: "MEASURED_BY",
        endpoint: "M-001"
      });
      const workspace = createAuthoringWorkspace(tempRoot);

      const valid = await applyAdditionProposal(workspace, bundle, { proposal });
      expect(valid.status).toBe("applied");
      expect(valid.change_set.operations.map((operation) => operation.kind)).toEqual(["insert_edge_line"]);

      const badId = structuredClone(proposal);
      badId.proposal_id = "addp_bad";
      expect(codes(await applyAdditionProposal(workspace, bundle, { proposal: badId }))).toContain(
        "guided_addition.choice_unavailable"
      );

      const mismatch = withRecomputedId(proposal, (copy) => {
        copy.new_edges[0]!.type = "SUPPORTS";
      });
      expect(codes(await applyAdditionProposal(workspace, bundle, { proposal: mismatch }))).toContain(
        "guided_addition.choice_unavailable"
      );

      const staleReference = withRecomputedId(proposal, (copy) => {
        copy.anchor!.handle = "hdl_stale";
      });
      expect(codes(await applyAdditionProposal(workspace, bundle, { proposal: staleReference }))).toContain(
        "guided_addition.state_stale"
      );

      const noPath = withRecomputedId(proposal, (copy) => {
        delete copy.document_context.path;
      });
      expect((await applyAdditionProposal(workspace, bundle, { proposal: noPath })).status).toBe("rejected");

      const changedBundle = structuredClone(bundle);
      changedBundle.authoring!.node_id_suggestions.prefix_by_type.Outcome = "OX";
      expect(computeBundleFingerprint(changedBundle)).not.toBe(proposal.document_context.bundle_fingerprint);
      expect(codes(await applyAdditionProposal(workspace, changedBundle, { proposal }))).toContain(
        "guided_addition.state_stale"
      );

      const changedEndpoints = structuredClone(bundle);
      const measured = changedEndpoints.contracts.relationships.find((item) => item.type === "MEASURED_BY")!;
      measured.allowed_endpoints = measured.allowed_endpoints.filter(
        (endpoint) => endpoint.from !== "Outcome" || endpoint.to !== "Metric"
      );
      expect(codes(await applyAdditionProposal(workspace, changedEndpoints, { proposal }))).toContain(
        "guided_addition.state_stale"
      );

      await writeDocument(tempRoot, documentPath, source.replace("Outcome O-001 \"Outcome\"", "Outcome O-001 \"Changed\""));
      expect(codes(await applyAdditionProposal(workspace, bundle, { proposal }))).toContain(
        "guided_addition.state_stale"
      );
    });
  });

  it("requires exact current confirmation and current required edge properties", async () => {
    await withTempRepo(async (tempRoot) => {
      const structuralPath = "docs/confirmation.sdd";
      const structuralSource = ["SDD-TEXT 0.1", "Place P-001 \"Child\"", "END", ""].join("\n");
      await writeDocument(tempRoot, structuralPath, structuralSource);
      const structuralSnapshot = snapshotFor(bundle, structuralPath, structuralSource);
      const structural = relationshipProposal(bundle, structuralSnapshot, {
        anchor: "P-001",
        direction: "incoming",
        relationship: "CONTAINS",
        newName: "Parent"
      });
      const workspace = createAuthoringWorkspace(tempRoot);
      const missing = withRecomputedId(structural, (copy) => {
        copy.confirmed_effects = [];
      });
      expect(codes(await applyAdditionProposal(workspace, bundle, { proposal: missing }))).toContain(
        "guided_addition.confirmation_required"
      );
      const stale = withRecomputedId(structural, (copy) => {
        copy.confirmed_effects[0]!.effect_id = `eff_${"0".repeat(64)}`;
      });
      expect(codes(await applyAdditionProposal(workspace, bundle, { proposal: stale }))).toContain(
        "guided_addition.confirmation_stale"
      );

      const nonStructuralBundle = structuredClone(bundle);
      nonStructuralBundle.contracts.relationships.find(
        (item) => item.type === "CONTAINS"
      )!.authoring!.source_organization = "unconstrained";
      const nonStructuralSnapshot = snapshotFor(nonStructuralBundle, structuralPath, structuralSource);
      const nonStructural = relationshipProposal(nonStructuralBundle, nonStructuralSnapshot, {
        anchor: "P-001",
        direction: "incoming",
        relationship: "CONTAINS",
        newName: "Parent"
      });
      expect(nonStructural.confirmed_effects).toEqual([]);
      expect((await applyAdditionProposal(workspace, nonStructuralBundle, { proposal: nonStructural })).status).toBe("applied");

      const bindsPath = "docs/binds.sdd";
      const bindsSource = [
        "SDD-TEXT 0.1",
        "Component C-001 \"Form\"",
        "END",
        "DataEntity D-001 \"Record\"",
        "END",
        ""
      ].join("\n");
      await writeDocument(tempRoot, bindsPath, bindsSource);
      const bindsSnapshot = snapshotFor(bundle, bindsPath, bindsSource);
      const binds = relationshipProposal(bundle, bindsSnapshot, {
        anchor: "C-001",
        direction: "outgoing",
        relationship: "BINDS_TO",
        endpoint: "D-001",
        props: { field: "email" }
      });
      const missingField = withRecomputedId(binds, (copy) => {
        copy.new_edges[0]!.props = {};
      });
      expect(codes(await applyAdditionProposal(workspace, bundle, { proposal: missingField }))).toContain(
        "guided_addition.required_field_missing"
      );

      const relaxedBundle = structuredClone(bundle);
      const bindsContract = relaxedBundle.contracts.relationships.find((item) => item.type === "BINDS_TO")!;
      bindsContract.constraints = bindsContract.constraints.filter(
        (rule) => rule.rule_logic?.kind !== "required_edge_property"
      );
      const relaxedSnapshot = snapshotFor(relaxedBundle, bindsPath, bindsSource);
      const relaxed = relationshipProposal(relaxedBundle, relaxedSnapshot, {
        anchor: "C-001",
        direction: "outgoing",
        relationship: "BINDS_TO",
        endpoint: "D-001"
      });
      expect(relaxed.new_edges[0]!.props).toEqual({});
      expect((await applyAdditionProposal(workspace, relaxedBundle, { proposal: relaxed })).status).toBe("applied");
    });
  });

  it("keeps serialization and persistence inside the shared mutation executor", async () => {
    const source = await readFile(path.join(repoRoot, "src/authoring/additionProposals.ts"), "utf8");
    expect(source).not.toContain("SDD-TEXT");
    expect(source).not.toMatch(/writeFile|writeCanonicalLfText|renderDocumentModel|quoteString/);
    expect(source.match(/executeChangeOperations\(/g)).toHaveLength(1);
  });
});
