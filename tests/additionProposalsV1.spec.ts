import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { loadBundle } from "../src/bundle/loadBundle.js";
import type { Bundle } from "../src/bundle/types.js";
import { applyAdditionProposalV1 } from "../src/authoring/additionProposalsV1.js";
import { createChangeSetJournal } from "../src/authoring/journal.js";
import { undoChangeSet } from "../src/authoring/undo.js";
import { createAuthoringWorkspace } from "../src/authoring/workspace.js";
import { createGuidedOpaqueId } from "../src/authoring/guidedAddition/identifiers.js";
import {
  createGuidedDocumentSnapshot,
  createNewGuidedDocumentSnapshot
} from "../src/authoring/guidedAddition/snapshot.js";
import type { GuidedDocumentSnapshot } from "../src/authoring/guidedAddition/sharedContracts.js";
import type {
  CompletedAdditionProposalV1,
  ExistingNodeRefV1,
  GuidedAdditionActionV1,
  GuidedAdditionResultV1,
  GuidedChoicePageV1,
  GuidedFieldValueV1
} from "../src/authoring/guidedAddition/v1/contracts.js";
import { createGuidedAdditionRuntimeV1 } from "../src/authoring/guidedAddition/v1/planner.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");
const fixture = fs.readFileSync(path.join(repoRoot, "tests/fixtures/guided_addition_acceptance.sdd"), "utf8");

let bundle: Bundle;

beforeAll(async () => {
  bundle = await loadBundle(manifestPath);
});

interface Harness {
  bundle: Bundle;
  snapshot: GuidedDocumentSnapshot;
}

async function withTempDocument(run: (args: {
  root: string;
  documentPath: string;
  original: string;
  harness: Harness;
}) => Promise<void>, source = fixture, currentBundle = bundle): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "sdd-addition-proposal-v1-"));
  const documentPath = "docs/guided.sdd";
  try {
    await mkdir(path.join(root, "docs"), { recursive: true });
    await writeFile(path.join(root, documentPath), source, "utf8");
    const snapshot = createGuidedDocumentSnapshot(currentBundle, {
      document_ref: documentPath,
      path: documentPath,
      text: source
    });
    await run({ root, documentPath, original: source, harness: { bundle: currentBundle, snapshot } });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function ref(harness: Harness, id: string): ExistingNodeRefV1 {
  const node = harness.snapshot.nodes.find((candidate) => candidate.node_id === id)!;
  return {
    kind: "existing_node",
    handle: node.handle,
    node_id: node.node_id,
    node_type: node.node_type,
    name: node.name
  };
}

function choices(result: GuidedAdditionResultV1): GuidedChoicePageV1 {
  expect(result.kind).toBe("sdd-guided-addition-step");
  const page = (result as Extract<GuidedAdditionResultV1, { kind: "sdd-guided-addition-step" }>).page;
  expect("choices" in page).toBe(true);
  return page as GuidedChoicePageV1;
}

function choose(
  harness: Harness,
  result: GuidedAdditionResultV1,
  predicate: (action: GuidedAdditionActionV1) => boolean
): GuidedAdditionResultV1 {
  const selected = choices(result).choices.find((candidate) => predicate(candidate.action));
  expect(selected, "expected offered v1 action").toBeDefined();
  return createGuidedAdditionRuntimeV1(harness.bundle).advance(harness.snapshot, result.state, selected!.action);
}

function begin(harness: Harness, anchor?: string): GuidedAdditionResultV1 {
  return createGuidedAdditionRuntimeV1(harness.bundle).begin(harness.snapshot, {
    workflow_version: "1.0",
    ...(anchor ? { anchor: ref(harness, anchor) } : {})
  });
}

function primaryValues(id: string, name: string, description: string): GuidedFieldValueV1[] {
  return [
    { field_id: "node_id", value_kind: "bare_value", raw_value: id },
    { field_id: "name", value_kind: "quoted_string", raw_value: name },
    { field_id: "node_property:description", value_kind: "quoted_string", raw_value: description }
  ];
}

function submitNewNode(
  harness: Harness,
  result: GuidedAdditionResultV1,
  id: string,
  name: string,
  description: string
): GuidedAdditionResultV1 {
  result = createGuidedAdditionRuntimeV1(harness.bundle).advance(harness.snapshot, result.state, {
    kind: "submit_new_node_fields",
    local_node_id: "node_1",
    field_group: "primary",
    values: primaryValues(id, name, description)
  });
  return choose(harness, result, (action) => action.kind === "set_node_detail_disclosure" && !action.disclose);
}

function complete(result: GuidedAdditionResultV1): CompletedAdditionProposalV1 {
  expect(result.kind).toBe("sdd-guided-addition-complete");
  return (result as Extract<GuidedAdditionResultV1, { kind: "sdd-guided-addition-complete" }>).proposal;
}

function newDocumentProposal(documentPath: string, currentBundle = bundle): CompletedAdditionProposalV1 {
  const newSnapshot = createNewGuidedDocumentSnapshot(currentBundle, {
    document_ref: documentPath,
    path: documentPath
  });
  const harness = { bundle: currentBundle, snapshot: newSnapshot };
  let result = begin(harness);
  result = choose(harness, result, (action) => action.kind === "choose_standalone_node_type" && action.node_type === "Place");
  result = submitNewNode(harness, result, "P-001", "Home", "Starting place");
  return complete(result);
}

function route(
  harness: Harness,
  anchor: string,
  direction: "outgoing" | "incoming",
  fromType: string,
  relationshipType: string,
  toType: string
): GuidedAdditionResultV1 {
  let result = begin(harness, anchor);
  result = choose(harness, result, (action) => action.kind === "choose_relationship_route" &&
    action.direction === direction && action.selection_order === "relationship_first");
  return choose(harness, result, (action) => action.kind === "choose_relationship_combination" &&
    action.triple.from_type === fromType &&
    action.triple.relationship_type === relationshipType &&
    action.triple.to_type === toType);
}

function chooseNewEndpoint(harness: Harness, result: GuidedAdditionResultV1): GuidedAdditionResultV1 {
  return choose(harness, result, (action) => action.kind === "create_new_endpoint");
}

function declineRelationshipDetails(harness: Harness, result: GuidedAdditionResultV1): GuidedAdditionResultV1 {
  return choose(harness, result, (action) => action.kind === "set_relationship_detail_disclosure" && !action.disclose);
}

function newNavigationProposal(harness: Harness, direction: "outgoing" | "incoming"): CompletedAdditionProposalV1 {
  let result = route(harness, "P-100", direction, "Place", "NAVIGATES_TO", "Place");
  result = chooseNewEndpoint(harness, result);
  result = submitNewNode(
    harness,
    result,
    "P-301",
    direction === "outgoing" ? "Settings" : "Activity",
    direction === "outgoing" ? "Configuration and preferences" : "Recent project activity"
  );
  result = declineRelationshipDetails(harness, result);
  result = choose(harness, result, (action) => action.kind === "choose_same_level_order" &&
    action.order.kind === (direction === "outgoing" ? "after_existing" : "before_existing"));
  return complete(result);
}

function existingNavigationProposal(harness: Harness): CompletedAdditionProposalV1 {
  let result = route(harness, "P-100", "outgoing", "Place", "NAVIGATES_TO", "Place");
  result = choose(harness, result, (action) => action.kind === "choose_existing_endpoint" && action.node.node_id === "P-300");
  result = declineRelationshipDetails(harness, result);
  return complete(result);
}

function duplicateIncomingNavigationProposal(
  harness: Harness,
  selectionOrder: "relationship_first" | "existing_node_first" = "relationship_first"
): CompletedAdditionProposalV1 {
  let result = begin(harness, "P-100");
  result = choose(harness, result, (action) => action.kind === "choose_relationship_route" &&
    action.direction === "incoming" && action.selection_order === selectionOrder);
  if (selectionOrder === "relationship_first") {
    result = choose(harness, result, (action) => action.kind === "choose_relationship_combination" &&
      action.triple.from_type === "Place" && action.triple.relationship_type === "NAVIGATES_TO" && action.triple.to_type === "Place");
    result = choose(harness, result, (action) => action.kind === "choose_existing_endpoint" && action.node.node_id === "P-210");
  } else {
    result = choose(harness, result, (action) => action.kind === "choose_existing_endpoint" && action.node.node_id === "P-210");
    result = choose(harness, result, (action) => action.kind === "choose_relationship_for_endpoint" &&
      action.triple.relationship_type === "NAVIGATES_TO");
  }
  result = declineRelationshipDetails(harness, result);
  return complete(result);
}

function structuralNewTargetProposal(harness: Harness, nested: boolean): CompletedAdditionProposalV1 {
  let result = route(harness, nested ? "P-300" : "P-100", "outgoing", "Place", "CONTAINS", "Place");
  result = chooseNewEndpoint(harness, result);
  result = submitNewNode(harness, result, "P-301", "Settings", "Configuration and preferences");
  result = choose(harness, result, (action) => action.kind === "choose_new_target_organization" &&
    action.organization === (nested ? "nested" : "top_level"));
  if (!nested) {
    result = choose(harness, result, (action) => action.kind === "choose_same_level_order" && action.order.kind === "top_level_last");
  }
  return complete(result);
}

function structuralWrapperProposal(harness: Harness): CompletedAdditionProposalV1 {
  let result = route(harness, "P-100", "incoming", "Area", "CONTAINS", "Place");
  result = chooseNewEndpoint(harness, result);
  result = submitNewNode(harness, result, "A-201", "Dashboard Workspace", "Area containing the dashboard");
  result = choose(harness, result, (action) => action.kind === "choose_new_source_organization" && action.organization === "wrap_target");
  result = choose(harness, result, (action) => action.kind === "confirm_material_effect");
  return complete(result);
}

function structuralNewSourceLeaveProposal(harness: Harness): CompletedAdditionProposalV1 {
  let result = route(harness, "P-100", "incoming", "Area", "CONTAINS", "Place");
  result = chooseNewEndpoint(harness, result);
  result = submitNewNode(harness, result, "A-201", "Dashboard Workspace", "Area containing the dashboard");
  result = choose(harness, result, (action) => action.kind === "choose_new_source_organization" && action.organization === "leave_target_current");
  result = choose(harness, result, (action) => action.kind === "choose_same_level_order" && action.order.kind === "before_existing");
  return complete(result);
}

function existingStructuralProposal(harness: Harness, move: boolean): CompletedAdditionProposalV1 {
  let result = route(harness, "P-100", "outgoing", "Place", "CONTAINS", "ViewState");
  result = choose(harness, result, (action) => action.kind === "choose_existing_endpoint" && action.node.node_id === "VS-100");
  result = choose(harness, result, (action) => action.kind === "choose_existing_target_organization" &&
    action.organization === (move ? "move_under_source" : "leave_current"));
  if (move) {
    result = choose(harness, result, (action) => action.kind === "choose_sibling_order" && action.order === "last");
    result = choose(harness, result, (action) => action.kind === "confirm_material_effect");
  }
  return complete(result);
}

function reidentify(proposal: CompletedAdditionProposalV1): CompletedAdditionProposalV1 {
  const copy = structuredClone(proposal);
  const { proposal_id: _old, ...withoutId } = copy;
  copy.proposal_id = createGuidedOpaqueId("addp", withoutId);
  return copy;
}

describe("Guided Addition v1 proposal executor", () => {
  it("dry-runs an absent target, atomically creates it on commit, and records delete-on-undo", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "sdd-addition-new-v1-"));
    const documentPath = "nested/app.sdd";
    const absolutePath = path.join(root, documentPath);
    try {
      const workspace = createAuthoringWorkspace(root);
      const proposal = newDocumentProposal(documentPath);
      const dryRun = await applyAdditionProposalV1(workspace, bundle, { proposal, mode: "dry_run" });
      expect(dryRun.status).toBe("applied");
      expect(dryRun.change_set).toMatchObject({ document_effect: "created", base_revision: null, mode: "dry_run" });
      await expect(readFile(absolutePath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });

      const committed = await applyAdditionProposalV1(workspace, bundle, { proposal, mode: "commit" });
      expect(committed.status).toBe("applied");
      expect(committed.change_set).toMatchObject({ document_effect: "created", base_revision: null, mode: "commit" });
      expect(committed.resulting_revision).toBe(dryRun.resulting_revision);
      expect(committed.change_set.operations).toEqual(dryRun.change_set.operations);
      expect(committed.created_targets).toEqual(dryRun.created_targets);
      expect(await readFile(absolutePath, "utf8")).toBe([
        "SDD-TEXT 0.1",
        'Place P-001 "Home"',
        '  description="Starting place"',
        "END",
        ""
      ].join("\n"));

      const undone = await undoChangeSet(workspace, bundle, {
        change_set_id: committed.change_set.change_set_id,
        mode: "commit"
      });
      expect(undone.status).toBe("applied");
      expect(undone.document_effect).toBe("deleted");
      await expect(readFile(absolutePath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a new-document proposal when the target appears and preserves its bytes", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "sdd-addition-new-stale-v1-"));
    const documentPath = "app.sdd";
    const absolutePath = path.join(root, documentPath);
    try {
      const workspace = createAuthoringWorkspace(root);
      const proposal = newDocumentProposal(documentPath);
      const dryRun = await applyAdditionProposalV1(workspace, bundle, { proposal, mode: "dry_run" });
      expect(dryRun.status).toBe("applied");
      const external = "externally created\n";
      await writeFile(absolutePath, external, "utf8");

      const committed = await applyAdditionProposalV1(workspace, bundle, { proposal, mode: "commit" });
      expect(committed.status).toBe("rejected");
      expect(committed.diagnostics.map((item) => item.code)).toContain("guided_addition.state_stale");
      expect(await readFile(absolutePath, "utf8")).toBe(external);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("applies outgoing and incoming non-structural source order with exact blank boundaries", async () => {
    for (const direction of ["outgoing", "incoming"] as const) {
      await withTempDocument(async ({ root, documentPath, harness }) => {
        const proposal = newNavigationProposal(harness, direction);
        const applied = await applyAdditionProposalV1(
          createAuthoringWorkspace(root),
          harness.bundle,
          { proposal, mode: "commit" }
        );
        expect(applied.status).toBe("applied");
        expect(applied.change_set.operations.every((operation) =>
          operation.kind !== "insert_edge_line" || operation.placement === undefined)).toBe(true);
        const text = await readFile(path.join(root, documentPath), "utf8");
        if (direction === "outgoing") {
          expect(text).toContain([
            "Place P-100 \"Dashboard\"",
            "  COMPOSED_OF C-100 \"Status Card\"",
            "  NAVIGATES_TO P-301 \"Settings\"",
            "",
            "  + Component C-100 \"Status Card\"",
            "  END",
            "END",
            "",
            "Place P-301 \"Settings\"",
            "  description=\"Configuration and preferences\"",
            "END",
            "",
            "Area A-200 \"Projects\""
          ].join("\n"));
        } else {
          expect(text).toContain([
            "Place P-301 \"Activity\"",
            "  description=\"Recent project activity\"",
            "  NAVIGATES_TO P-100 \"Dashboard\"",
            "END",
            "",
            "Place P-100 \"Dashboard\""
          ].join("\n"));
        }
      });
    }
  });

  it("applies T09 top-level and A03 nested structural targets exactly", async () => {
    await withTempDocument(async ({ root, documentPath, harness }) => {
      const proposal = structuralNewTargetProposal(harness, false);
      const applied = await applyAdditionProposalV1(createAuthoringWorkspace(root), harness.bundle, { proposal, mode: "commit" });
      expect(applied.status).toBe("applied");
      const text = await readFile(path.join(root, documentPath), "utf8");
      expect(text).toContain([
        "Place P-100 \"Dashboard\"",
        "  COMPOSED_OF C-100 \"Status Card\"",
        "  CONTAINS P-301 \"Settings\"",
        "",
        "  + Component C-100 \"Status Card\""
      ].join("\n"));
      expect(text.endsWith([
        "",
        "Place P-301 \"Settings\"",
        "  description=\"Configuration and preferences\"",
        "END",
        ""
      ].join("\n"))).toBe(true);
    });

    await withTempDocument(async ({ root, documentPath, harness }) => {
      const proposal = structuralNewTargetProposal(harness, true);
      const applied = await applyAdditionProposalV1(createAuthoringWorkspace(root), harness.bundle, { proposal, mode: "commit" });
      expect(applied.status).toBe("applied");
      expect(await readFile(path.join(root, documentPath), "utf8")).toContain([
        "Place P-300 \"Reports\"",
        "  CONTAINS P-301 \"Settings\"",
        "",
        "  + Place P-301 \"Settings\"",
        "    description=\"Configuration and preferences\"",
        "  END",
        "END"
      ].join("\n"));
    });
  });

  it("applies A01 wrapper replacement and preserves the complete target subtree exactly once", async () => {
    await withTempDocument(async ({ root, documentPath, harness }) => {
      const proposal = structuralWrapperProposal(harness);
      const applied = await applyAdditionProposalV1(createAuthoringWorkspace(root), harness.bundle, { proposal, mode: "commit" });
      expect(applied.status).toBe("applied");
      expect(applied.change_set.operations.map((operation) => operation.kind)).toEqual([
        "insert_node_block",
        "set_node_property",
        "insert_edge_line",
        "reparent_node_block"
      ]);
      const text = await readFile(path.join(root, documentPath), "utf8");
      expect(text).toContain([
        "Area A-201 \"Dashboard Workspace\"",
        "  description=\"Area containing the dashboard\"",
        "  CONTAINS P-100 \"Dashboard\"",
        "",
        "  + Place P-100 \"Dashboard\"",
        "    COMPOSED_OF C-100 \"Status Card\"",
        "",
        "    + Component C-100 \"Status Card\"",
        "    END",
        "  END",
        "END",
        "",
        "Area A-200 \"Projects\""
      ].join("\n"));
      expect(text.match(/(?:Place|\+ Place) P-100 /g)).toHaveLength(1);
      expect(text.match(/(?:Component|\+ Component) C-100 /g)).toHaveLength(1);
    });
  });

  it("applies A02 new-source placement while leaving the existing target unchanged", async () => {
    await withTempDocument(async ({ root, documentPath, harness }) => {
      const proposal = structuralNewSourceLeaveProposal(harness);
      const applied = await applyAdditionProposalV1(createAuthoringWorkspace(root), harness.bundle, { proposal, mode: "commit" });
      expect(applied.status).toBe("applied");
      expect(applied.change_set.operations.map((operation) => operation.kind)).toEqual([
        "insert_node_block",
        "set_node_property",
        "insert_edge_line"
      ]);
      const text = await readFile(path.join(root, documentPath), "utf8");
      expect(text).toContain([
        "Area A-201 \"Dashboard Workspace\"",
        "  description=\"Area containing the dashboard\"",
        "  CONTAINS P-100 \"Dashboard\"",
        "END",
        "",
        "Place P-100 \"Dashboard\""
      ].join("\n"));
      expect(text).not.toContain("+ Place P-100");
      expect(text.match(/Place P-100 /g)).toHaveLength(1);
    });
  });

  it("requires exact effects for moves and leaves existing targets in place", async () => {
    await withTempDocument(async ({ root, documentPath, harness, original }) => {
      const workspace = createAuthoringWorkspace(root);
      const keep = existingStructuralProposal(harness, false);
      const keepApplied = await applyAdditionProposalV1(workspace, harness.bundle, { proposal: keep, mode: "commit" });
      expect(keepApplied.status).toBe("applied");
      let text = await readFile(path.join(root, documentPath), "utf8");
      expect(text.indexOf("ViewState VS-100 \"Summary\"")).toBeGreaterThan(text.indexOf("Place P-300 \"Reports\""));
      expect(text).not.toContain("+ ViewState VS-100");

      await writeFile(path.join(root, documentPath), original, "utf8");
      const move = existingStructuralProposal(harness, true);
      const forged = structuredClone(move);
      forged.accepted_material_effects[0]!.accepted = false;
      const rejected = await applyAdditionProposalV1(workspace, harness.bundle, { proposal: reidentify(forged) });
      expect(rejected.status).toBe("rejected");
      expect(rejected.diagnostics.map((item) => item.code)).toContain("guided_addition.confirmation_stale");

      const moved = await applyAdditionProposalV1(workspace, harness.bundle, { proposal: move, mode: "commit" });
      expect(moved.status).toBe("applied");
      text = await readFile(path.join(root, documentPath), "utf8");
      expect(text).toContain("  + ViewState VS-100 \"Summary\"");
      expect(text.match(/(?:ViewState|\+ ViewState) VS-100 /g)).toHaveLength(1);
    });
  });

  it("proves dry-run/commit parity, deterministic targets, and exact undo", async () => {
    await withTempDocument(async ({ root, documentPath, harness, original }) => {
      let result = begin(harness);
      result = choose(harness, result, (action) => action.kind === "choose_addition_kind" && action.addition_kind === "standalone_node");
      result = choose(harness, result, (action) => action.kind === "choose_standalone_node_type" && action.node_type === "Policy");
      result = submitNewNode(harness, result, "PL-101", "Retention Policy", "Keep records for seven years");
      result = choose(harness, result, (action) => action.kind === "choose_same_level_order" && action.order.kind === "top_level_first");
      const proposal = complete(result);
      const workspace = createAuthoringWorkspace(root);
      const journal = createChangeSetJournal(workspace, {
        idFactory: (() => {
          const ids = ["chg_v1_dry", "chg_v1_commit", "chg_v1_undo"];
          return () => ids.shift() ?? "chg_v1_extra";
        })()
      });
      const dry = await applyAdditionProposalV1(workspace, harness.bundle, { proposal }, journal);
      expect(dry.status).toBe("applied");
      expect(await readFile(path.join(root, documentPath), "utf8")).toBe(original);
      const commit = await applyAdditionProposalV1(workspace, harness.bundle, { proposal, mode: "commit" }, journal);
      expect(commit.status).toBe("applied");
      expect(commit.resulting_revision).toBe(dry.resulting_revision);
      expect(commit.change_set.operations).toEqual(dry.change_set.operations);
      expect(commit.change_set.summary).toEqual(dry.change_set.summary);
      expect(commit.created_targets).toEqual(dry.created_targets);
      expect(commit.diagnostics).toEqual(dry.diagnostics);
      const undo = await undoChangeSet(workspace, harness.bundle, {
        change_set_id: commit.change_set.change_set_id,
        mode: "commit"
      }, journal);
      expect(undo.status).toBe("applied");
      expect(await readFile(path.join(root, documentPath), "utf8")).toBe(original);
    });
  });

  it("uses the loaded bundle policy for the same placement-free v1 relationship operation", async () => {
    const legacy = structuredClone(bundle);
    legacy.authoring!.placement_policies.default.edge_in_source_body = "last";
    const positions: number[] = [];
    for (const currentBundle of [bundle, legacy]) {
      await withTempDocument(async ({ root, documentPath, harness }) => {
        const proposal = existingNavigationProposal(harness);
        const applied = await applyAdditionProposalV1(
          createAuthoringWorkspace(root),
          harness.bundle,
          { proposal, mode: "commit" }
        );
        expect(applied.status).toBe("applied");
        const text = await readFile(path.join(root, documentPath), "utf8");
        positions.push(text.indexOf("  NAVIGATES_TO P-300 \"Reports\""));
        const nested = text.indexOf("  + Component C-100 \"Status Card\"");
        if (currentBundle.authoring!.placement_policies.default.edge_in_source_body === "last") {
          expect(positions.at(-1)).toBeGreaterThan(nested);
        } else {
          expect(positions.at(-1)).toBeLessThan(nested);
        }
      }, fixture, currentBundle);
    }
    expect(positions[0]).not.toBe(positions[1]);
  });

  it("binds concrete warning acceptance to the exact proposal, bundle, revisions, result, and warning set", async () => {
    await withTempDocument(async ({ root, documentPath, harness, original }) => {
      const workspace = createAuthoringWorkspace(root);
      const proposal = duplicateIncomingNavigationProposal(harness);
      const dry = await applyAdditionProposalV1(workspace, harness.bundle, { proposal, mode: "dry_run", validate_profile: "simple" });
      expect(dry.status).toBe("applied");
      expect(dry.warning_review).toMatchObject({
        title: "Warning",
        lines: ["P-210: Projects Overview already has this exact navigation to P-100: Dashboard."]
      });
      expect(dry.warning_review?.acceptance_token).toMatch(/^warning_[a-f0-9]{64}$/);
      expect(await readFile(path.join(root, documentPath), "utf8")).toBe(original);

      for (const accepted_warning_token of [undefined, "warning_forged"] as const) {
        const rejected = await applyAdditionProposalV1(workspace, harness.bundle, {
          proposal,
          mode: "commit",
          validate_profile: "simple",
          ...(accepted_warning_token ? { accepted_warning_token } : {})
        });
        expect(rejected.status).toBe("rejected");
        expect(rejected.diagnostics.map((item) => item.code)).toContain("guided_addition.warning_acceptance_required");
        expect(await readFile(path.join(root, documentPath), "utf8")).toBe(original);
      }

      const otherProposal = duplicateIncomingNavigationProposal(harness, "existing_node_first");
      expect(otherProposal.proposal_id).not.toBe(proposal.proposal_id);
      const replayed = await applyAdditionProposalV1(workspace, harness.bundle, {
        proposal: otherProposal,
        mode: "commit",
        validate_profile: "simple",
        accepted_warning_token: dry.warning_review!.acceptance_token
      });
      expect(replayed.status).toBe("rejected");
      expect(await readFile(path.join(root, documentPath), "utf8")).toBe(original);

      const committed = await applyAdditionProposalV1(workspace, harness.bundle, {
        proposal,
        mode: "commit",
        validate_profile: "simple",
        accepted_warning_token: dry.warning_review!.acceptance_token
      });
      expect(committed.status).toBe("applied");
      const committedText = await readFile(path.join(root, documentPath), "utf8");
      expect(committedText.match(/NAVIGATES_TO P-100 "Dashboard"/g)).toHaveLength(2);

      const staleReplay = await applyAdditionProposalV1(workspace, harness.bundle, {
        proposal,
        mode: "commit",
        validate_profile: "simple",
        accepted_warning_token: dry.warning_review!.acceptance_token
      });
      expect(staleReplay.status).toBe("rejected");
      expect(staleReplay.diagnostics.map((item) => item.code)).toContain("guided_addition.state_stale");
      expect(await readFile(path.join(root, documentPath), "utf8")).toBe(committedText);
    });
  });

  it("changes warning wording from bundle-only metadata", async () => {
    let originalToken = "";
    await withTempDocument(async ({ root, harness }) => {
      const proposal = duplicateIncomingNavigationProposal(harness);
      const dry = await applyAdditionProposalV1(createAuthoringWorkspace(root), harness.bundle, {
        proposal,
        validate_profile: "simple"
      });
      originalToken = dry.warning_review!.acceptance_token;
    });

    const changed = structuredClone(bundle);
    changed.authoring!.guided_addition.warning_messages.duplicate_edge.by_relationship.NAVIGATES_TO =
      "{source} has the bundle-mutated duplicate route to {target}.";
    await withTempDocument(async ({ root, documentPath, harness, original }) => {
      const proposal = duplicateIncomingNavigationProposal(harness);
      const dry = await applyAdditionProposalV1(createAuthoringWorkspace(root), harness.bundle, {
        proposal,
        validate_profile: "simple"
      });
      expect(dry.warning_review?.lines).toEqual([
        "P-210: Projects Overview has the bundle-mutated duplicate route to P-100: Dashboard."
      ]);
      expect(dry.warning_review?.acceptance_token).not.toBe(originalToken);

      const rejected = await applyAdditionProposalV1(createAuthoringWorkspace(root), harness.bundle, {
        proposal,
        mode: "commit",
        validate_profile: "simple",
        accepted_warning_token: originalToken
      });
      expect(rejected.status).toBe("rejected");
      expect(rejected.diagnostics.map((item) => item.code)).toContain("guided_addition.warning_acceptance_required");
      expect(await readFile(path.join(root, documentPath), "utf8")).toBe(original);
    }, fixture, changed);
  });

  it("rejects stale identity, duplicate IDs, forged organization, and invalid canonical IDs", async () => {
    await withTempDocument(async ({ root, harness }) => {
      const workspace = createAuthoringWorkspace(root);
      const proposal = newNavigationProposal(harness, "outgoing");

      const badId = structuredClone(proposal);
      badId.proposal_id = "addp_bad";
      expect((await applyAdditionProposalV1(workspace, harness.bundle, { proposal: badId })).status).toBe("rejected");

      const stale = structuredClone(proposal);
      const source = stale.addition.kind === "relationship" ? stale.addition.relationship.from : undefined;
      if (source?.kind === "existing_node") source.name = "Changed";
      expect((await applyAdditionProposalV1(workspace, harness.bundle, { proposal: reidentify(stale) })).diagnostics
        .map((item) => item.code)).toContain("guided_addition.state_stale");

      const duplicate = structuredClone(proposal);
      if (duplicate.addition.kind === "relationship" && duplicate.addition.new_node) {
        duplicate.addition.new_node.node_id = "P-300";
        duplicate.addition.new_node.fields.find((field) => field.field_id === "node_id")!.raw_value = "P-300";
      }
      expect((await applyAdditionProposalV1(workspace, harness.bundle, { proposal: reidentify(duplicate) })).diagnostics
        .map((item) => item.code)).toContain("guided_addition.node_id_collision");

      const forged = structuredClone(proposal);
      forged.node_organization = [{
        kind: "add_new_node_top_level",
        node: { kind: "new_node", local_node_id: "node_1" },
        order: { kind: "before_existing", node: ref(harness, "P-100") }
      }];
      expect((await applyAdditionProposalV1(workspace, harness.bundle, { proposal: reidentify(forged) })).status).toBe("rejected");

      const invalidTriple = structuredClone(proposal);
      if (invalidTriple.addition.kind === "relationship") {
        invalidTriple.addition.relationship.triple.relationship_type = "UNAVAILABLE_RELATIONSHIP";
      }
      expect((await applyAdditionProposalV1(workspace, harness.bundle, { proposal: reidentify(invalidTriple) })).status).toBe("rejected");

      const invalidField = structuredClone(proposal);
      if (invalidField.addition.kind === "relationship") {
        invalidField.addition.relationship.fields.push({
          field_id: "edge_property:unavailable",
          value_kind: "quoted_string",
          raw_value: "forged"
        });
      }
      expect((await applyAdditionProposalV1(workspace, harness.bundle, { proposal: reidentify(invalidField) })).status).toBe("rejected");

      const staleFingerprint = structuredClone(proposal);
      staleFingerprint.document_context.bundle_fingerprint = "bfp_stale";
      expect((await applyAdditionProposalV1(workspace, harness.bundle, { proposal: reidentify(staleFingerprint) })).diagnostics
        .map((item) => item.code)).toContain("guided_addition.state_stale");

      const staleRevision = structuredClone(proposal);
      staleRevision.document_context.base_revision = "rev_stale";
      expect((await applyAdditionProposalV1(workspace, harness.bundle, { proposal: reidentify(staleRevision) })).diagnostics
        .map((item) => item.code)).toContain("guided_addition.state_stale");
    });
  });

  it("keeps the native executor independent of legacy workflow and placement modules", async () => {
    const source = await readFile(path.join(repoRoot, "src/authoring/additionProposalsV1.ts"), "utf8");
    expect(source).not.toMatch(/from ["'][^"']*guidedAddition\/contracts\.js["']/);
    expect(source).not.toMatch(/from ["'][^"']*guidedAddition\/placement\.js["']/);
    expect(source).not.toMatch(/from ["'][^"']*additionProposals\.js["']/);
    expect(source.match(/executeChangeOperations\(/g)).toHaveLength(1);
  });
});
