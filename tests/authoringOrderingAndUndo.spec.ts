import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import type { Bundle } from "../src/bundle/types.js";
import type { ChangeSetResult } from "../src/authoring/contracts.js";
import type { Diagnostic } from "../src/diagnostics/types.js";
import { createRestoreDocumentInverse, createChangeSetJournal } from "../src/authoring/journal.js";
import { inspectDocument, type InspectedDocument } from "../src/authoring/inspect.js";
import { applyChangeSet, createDocument } from "../src/authoring/mutations.js";
import { undoChangeSet } from "../src/authoring/undo.js";
import { createAuthoringWorkspace } from "../src/authoring/workspace.js";
import { loadBundle } from "../src/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

let bundle: Bundle;

beforeAll(async () => {
  bundle = await loadBundle(manifestPath);
});

async function withTempRepo(run: (repoRootPath: string) => Promise<void>): Promise<void> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "sdd-authoring-ordering-undo-"));
  try {
    await run(tempRoot);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function writeTempDocument(repoRootPath: string, documentPath: string, text: string): Promise<void> {
  const absolutePath = path.join(repoRootPath, documentPath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, text, "utf8");
}

async function readTempDocument(repoRootPath: string, documentPath: string): Promise<string> {
  return readFile(path.join(repoRootPath, documentPath), "utf8");
}

async function exists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function expectInspectedDocument(result: Awaited<ReturnType<typeof inspectDocument>>): InspectedDocument {
  expect(result.kind).toBe("sdd-inspected-document");
  return result as InspectedDocument;
}

function diagnosticCodes(diagnostics: Diagnostic[]): string[] {
  return diagnostics.map((diagnostic) => diagnostic.code);
}

function createIdFactory(prefix: string): () => string {
  let counter = 0;
  return () => {
    counter += 1;
    return `chg_${prefix}_${counter.toString().padStart(3, "0")}`;
  };
}

function createEmptySummary(): ChangeSetResult["summary"] {
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

describe("authoring ordering and undo", () => {
  it("reorders top-level nodes, moves leading trivia with the target, and rejects stale or invalid placements", async () => {
    await withTempRepo(async (tempRepoRoot) => {
      const documentPath = "docs/top-level.sdd";
      await writeTempDocument(
        tempRepoRoot,
        documentPath,
        [
          "SDD-TEXT 0.1",
          "# before alpha",
          "Place P-100 \"Alpha\"",
          "END",
          "",
          "# before beta",
          "Place P-200 \"Beta\"",
          "END",
          "Place P-300 \"Gamma\"",
          "END",
          ""
        ].join("\n")
      );

      const workspace = createAuthoringWorkspace(tempRepoRoot);
      const journal = createChangeSetJournal(workspace, {
        idFactory: createIdFactory("top_level")
      });
      const inspected = expectInspectedDocument(await inspectDocument(workspace, bundle, documentPath));
      const [alphaHandle, betaHandle] = inspected.resource.top_level_order;

      const invalidParent = await applyChangeSet(workspace, bundle, {
        path: documentPath,
        base_revision: inspected.resource.revision,
        operations: [
          {
            kind: "reposition_top_level_node",
            node_handle: betaHandle!,
            placement: {
              mode: "before",
              stream: "top_level",
              anchor_handle: alphaHandle!,
              parent_handle: alphaHandle!
            }
          }
        ]
      }, journal);
      expect(invalidParent.status).toBe("rejected");
      expect(diagnosticCodes(invalidParent.diagnostics)).toContain("sdd.invalid_placement");

      const dryRun = await applyChangeSet(workspace, bundle, {
        path: documentPath,
        base_revision: inspected.resource.revision,
        operations: [
          {
            kind: "reposition_top_level_node",
            node_handle: betaHandle!,
            placement: {
              mode: "before",
              stream: "top_level",
              anchor_handle: alphaHandle!
            }
          }
        ]
      }, journal);

      expect(dryRun.status).toBe("applied");
      expect(dryRun.mode).toBe("dry_run");
      expect(dryRun.resulting_revision).not.toBe(inspected.resource.revision);
      expect(dryRun.summary.ordering_changes).toEqual([
        {
          kind: "top_level_node",
          target_handle: betaHandle!,
          old_index: 1,
          new_index: 0
        }
      ]);
      expect(await readTempDocument(tempRepoRoot, documentPath)).toBe(
        [
          "SDD-TEXT 0.1",
          "# before alpha",
          "Place P-100 \"Alpha\"",
          "END",
          "",
          "# before beta",
          "Place P-200 \"Beta\"",
          "END",
          "Place P-300 \"Gamma\"",
          "END",
          ""
        ].join("\n")
      );

      const committed = await applyChangeSet(workspace, bundle, {
        path: documentPath,
        base_revision: inspected.resource.revision,
        mode: "commit",
        operations: [
          {
            kind: "reposition_top_level_node",
            node_handle: betaHandle!,
            placement: {
              mode: "before",
              stream: "top_level",
              anchor_handle: alphaHandle!
            }
          }
        ]
      }, journal);

      expect(committed.status).toBe("applied");
      expect(await readTempDocument(tempRepoRoot, documentPath)).toBe(
        [
          "SDD-TEXT 0.1",
          "",
          "# before beta",
          "Place P-200 \"Beta\"",
          "END",
          "# before alpha",
          "Place P-100 \"Alpha\"",
          "END",
          "Place P-300 \"Gamma\"",
          "END",
          ""
        ].join("\n")
      );

      const staleHandleResult = await applyChangeSet(workspace, bundle, {
        path: documentPath,
        base_revision: committed.resulting_revision!,
        operations: [
          {
            kind: "reposition_top_level_node",
            node_handle: betaHandle!,
            placement: {
              mode: "last",
              stream: "top_level"
            }
          }
        ]
      }, journal);
      expect(staleHandleResult.status).toBe("rejected");
      expect(diagnosticCodes(staleHandleResult.diagnostics)).toContain("sdd.invalid_handle");
    });
  });

  it("reorders only structural CONTAINS and COMPOSED_OF edges and rejects invalid structural placements", async () => {
    await withTempRepo(async (tempRepoRoot) => {
      const documentPath = "docs/structural-edges.sdd";
      await writeTempDocument(
        tempRepoRoot,
        documentPath,
        [
          "SDD-TEXT 0.1",
          "Place P-001 \"Parent\"",
          "  owner=Design",
          "  # before alpha edge",
          "  CONTAINS P-010 \"Alpha\"",
          "  MEASURED_BY M-001 \"Metric\"",
          "  # before beta edge",
          "  CONTAINS P-020 \"Beta\"",
          "  COMPOSED_OF C-001 \"Widget\"",
          "END",
          "Place P-999 \"Other\"",
          "END",
          ""
        ].join("\n")
      );

      const workspace = createAuthoringWorkspace(tempRepoRoot);
      const journal = createChangeSetJournal(workspace, {
        idFactory: createIdFactory("structural")
      });
      const inspected = expectInspectedDocument(await inspectDocument(workspace, bundle, documentPath));
      const parentNode = inspected.resource.nodes.find((node) => node.node_id === "P-001")!;
      const otherNode = inspected.resource.nodes.find((node) => node.node_id === "P-999")!;
      const containsHandles = parentNode.structural_order_streams.CONTAINS ?? [];
      const measuredHandle = inspected.resource.body_items.find(
        (item) => item.parent_handle === parentNode.handle && item.edge?.rel_type === "MEASURED_BY"
      )!.handle;
      const composedHandle = inspected.resource.body_items.find(
        (item) => item.parent_handle === parentNode.handle && item.edge?.rel_type === "COMPOSED_OF"
      )!.handle;

      const nonStructural = await applyChangeSet(workspace, bundle, {
        path: documentPath,
        base_revision: inspected.resource.revision,
        operations: [
          {
            kind: "reposition_structural_edge",
            edge_handle: measuredHandle,
            placement: {
              mode: "first",
              stream: "body",
              parent_handle: parentNode.handle
            }
          }
        ]
      }, journal);
      expect(nonStructural.status).toBe("rejected");
      expect(diagnosticCodes(nonStructural.diagnostics)).toContain("sdd.invalid_placement");

      const wrongAnchor = await applyChangeSet(workspace, bundle, {
        path: documentPath,
        base_revision: inspected.resource.revision,
        operations: [
          {
            kind: "reposition_structural_edge",
            edge_handle: containsHandles[1]!,
            placement: {
              mode: "before",
              stream: "body",
              parent_handle: parentNode.handle,
              anchor_handle: composedHandle
            }
          }
        ]
      }, journal);
      expect(wrongAnchor.status).toBe("rejected");
      expect(diagnosticCodes(wrongAnchor.diagnostics)).toContain("sdd.invalid_placement");

      const wrongParent = await applyChangeSet(workspace, bundle, {
        path: documentPath,
        base_revision: inspected.resource.revision,
        operations: [
          {
            kind: "reposition_structural_edge",
            edge_handle: containsHandles[1]!,
            placement: {
              mode: "first",
              stream: "body",
              parent_handle: otherNode.handle
            }
          }
        ]
      }, journal);
      expect(wrongParent.status).toBe("rejected");
      expect(diagnosticCodes(wrongParent.diagnostics)).toContain("sdd.invalid_placement");

      const committed = await applyChangeSet(workspace, bundle, {
        path: documentPath,
        base_revision: inspected.resource.revision,
        mode: "commit",
        operations: [
          {
            kind: "reposition_structural_edge",
            edge_handle: containsHandles[1]!,
            placement: {
              mode: "first",
              stream: "body",
              parent_handle: parentNode.handle
            }
          }
        ]
      }, journal);

      expect(committed.status).toBe("applied");
      expect(committed.summary.ordering_changes).toEqual([
        {
          kind: "structural_edge",
          target_handle: containsHandles[1]!,
          parent_handle: parentNode.handle,
          old_index: 1,
          new_index: 0
        }
      ]);
      expect(await readTempDocument(tempRepoRoot, documentPath)).toBe(
        [
          "SDD-TEXT 0.1",
          "Place P-001 \"Parent\"",
          "  owner=Design",
          "  # before beta edge",
          "  CONTAINS P-020 \"Beta\"",
          "  # before alpha edge",
          "  CONTAINS P-010 \"Alpha\"",
          "  MEASURED_BY M-001 \"Metric\"",
          "  COMPOSED_OF C-001 \"Widget\"",
          "END",
          "Place P-999 \"Other\"",
          "END",
          ""
        ].join("\n")
      );

      const reordered = expectInspectedDocument(await inspectDocument(workspace, bundle, documentPath));
      const reorderedParent = reordered.resource.nodes.find((node) => node.node_id === "P-001")!;
      expect(reorderedParent.structural_order_streams.CONTAINS).toEqual([
        reordered.resource.body_items.find(
          (item) => item.parent_handle === reorderedParent.handle && item.edge?.to === "P-020"
        )!.handle,
        reordered.resource.body_items.find(
          (item) => item.parent_handle === reorderedParent.handle && item.edge?.to === "P-010"
        )!.handle
      ]);
    });
  });

  it("moves nested node blocks within the parent body stream without changing structural streams", async () => {
    await withTempRepo(async (tempRepoRoot) => {
      const documentPath = "docs/nested-move.sdd";
      await writeTempDocument(
        tempRepoRoot,
        documentPath,
        [
          "SDD-TEXT 0.1",
          "Place P-001 \"Parent\"",
          "  owner=Design",
          "  CONTAINS P-010 \"Alpha\"",
          "  CONTAINS P-020 \"Beta\"",
          "  + Place P-010 \"Alpha\"",
          "  END",
          "",
          "  # before beta block",
          "  + Place P-020 \"Beta\"",
          "  END",
          "END",
          "Place P-999 \"Other\"",
          "  owner=Other",
          "END",
          ""
        ].join("\n")
      );

      const workspace = createAuthoringWorkspace(tempRepoRoot);
      const journal = createChangeSetJournal(workspace, {
        idFactory: createIdFactory("nested")
      });
      const inspected = expectInspectedDocument(await inspectDocument(workspace, bundle, documentPath));
      const parentNode = inspected.resource.nodes.find((node) => node.node_id === "P-001")!;
      const otherTopLevel = inspected.resource.nodes.find((node) => node.node_id === "P-999")!;
      const alphaNested = inspected.resource.nodes.find(
        (node) => node.parent_handle === parentNode.handle && node.node_id === "P-010"
      )!;
      const betaNested = inspected.resource.nodes.find(
        (node) => node.parent_handle === parentNode.handle && node.node_id === "P-020"
      )!;
      const otherPropertyHandle = inspected.resource.body_items.find(
        (item) => item.parent_handle === otherTopLevel.handle && item.kind === "property_line"
      )!.handle;

      const topLevelTarget = await applyChangeSet(workspace, bundle, {
        path: documentPath,
        base_revision: inspected.resource.revision,
        operations: [
          {
            kind: "move_nested_node_block",
            node_handle: otherTopLevel.handle,
            placement: {
              mode: "last",
              stream: "body",
              parent_handle: parentNode.handle
            }
          }
        ]
      }, journal);
      expect(topLevelTarget.status).toBe("rejected");
      expect(diagnosticCodes(topLevelTarget.diagnostics)).toContain("sdd.invalid_placement");

      const wrongParentAnchor = await applyChangeSet(workspace, bundle, {
        path: documentPath,
        base_revision: inspected.resource.revision,
        operations: [
          {
            kind: "move_nested_node_block",
            node_handle: alphaNested.handle,
            placement: {
              mode: "before",
              stream: "body",
              parent_handle: parentNode.handle,
              anchor_handle: otherPropertyHandle
            }
          }
        ]
      }, journal);
      expect(wrongParentAnchor.status).toBe("rejected");
      expect(diagnosticCodes(wrongParentAnchor.diagnostics)).toContain("sdd.invalid_placement");

      const committed = await applyChangeSet(workspace, bundle, {
        path: documentPath,
        base_revision: inspected.resource.revision,
        mode: "commit",
        operations: [
          {
            kind: "move_nested_node_block",
            node_handle: betaNested.handle,
            placement: {
              mode: "first",
              stream: "body",
              parent_handle: parentNode.handle
            }
          }
        ]
      }, journal);

      expect(committed.status).toBe("applied");
      expect(committed.summary.ordering_changes).toEqual([
        {
          kind: "nested_node_block",
          target_handle: betaNested.handle,
          parent_handle: parentNode.handle,
          old_index: 4,
          new_index: 0
        }
      ]);
      const committedText = await readTempDocument(tempRepoRoot, documentPath);
      expect(committedText).toContain(
        [
          "Place P-001 \"Parent\"",
          "",
          "  # before beta block",
          "  + Place P-020 \"Beta\"",
          "  END",
          "  owner=Design"
        ].join("\n")
      );

      const reordered = expectInspectedDocument(await inspectDocument(workspace, bundle, documentPath));
      const reorderedParent = reordered.resource.nodes.find((node) => node.node_id === "P-001")!;
      const reorderedBeta = reordered.resource.nodes.find(
        (node) => node.parent_handle === reorderedParent.handle && node.node_id === "P-020"
      )!;
      expect(reorderedParent.body_stream[0]).toBe(reorderedBeta.handle);
      expect(
        (reorderedParent.structural_order_streams.CONTAINS ?? []).map(
          (handle) => reordered.resource.body_items.find((item) => item.handle === handle)?.edge?.to
        )
      ).toEqual(["P-010", "P-020"]);
    });
  });

  it("undoes committed document updates in dry-run and commit mode and rejects revision mismatches after external edits", async () => {
    await withTempRepo(async (tempRepoRoot) => {
      const documentPath = "docs/undo-update.sdd";
      const originalText = [
        "SDD-TEXT 0.1",
        "Place P-001 \"Home\"",
        "  owner=Design",
        "END",
        ""
      ].join("\n");
      await writeTempDocument(tempRepoRoot, documentPath, originalText);

      const workspace = createAuthoringWorkspace(tempRepoRoot);
      const journal = createChangeSetJournal(workspace, {
        idFactory: createIdFactory("undo_update")
      });
      const originalInspection = expectInspectedDocument(await inspectDocument(workspace, bundle, documentPath));
      const nodeHandle = originalInspection.resource.nodes[0]!.handle;

      const updated = await applyChangeSet(workspace, bundle, {
        path: documentPath,
        base_revision: originalInspection.resource.revision,
        mode: "commit",
        operations: [
          {
            kind: "set_node_name",
            node_handle: nodeHandle,
            name: "Renamed"
          }
        ]
      }, journal);

      const dryRunUndo = await undoChangeSet(workspace, bundle, {
        change_set_id: updated.change_set_id,
        validate_profile: "strict"
      }, journal);
      expect(dryRunUndo.status).toBe("applied");
      expect(dryRunUndo.mode).toBe("dry_run");
      expect(dryRunUndo.origin).toBe("undo_change_set");
      expect(dryRunUndo.document_effect).toBe("updated");
      expect(dryRunUndo.undo_eligible).toBe(false);
      expect(dryRunUndo.resulting_revision).toBe(originalInspection.resource.revision);
      expect(await readTempDocument(tempRepoRoot, documentPath)).toBe(
        [
          "SDD-TEXT 0.1",
          "Place P-001 \"Renamed\"",
          "  owner=Design",
          "END",
          ""
        ].join("\n")
      );

      const committedUndo = await undoChangeSet(workspace, bundle, {
        change_set_id: updated.change_set_id,
        mode: "commit",
        validate_profile: "strict"
      }, journal);
      expect(committedUndo.status).toBe("applied");
      expect(committedUndo.resulting_revision).toBe(originalInspection.resource.revision);
      expect(await readTempDocument(tempRepoRoot, documentPath)).toBe(originalText);

      const undoRecord = await journal.getChangeSetRecord(committedUndo.change_set_id);
      expect(undoRecord?.change_set.undo_eligible).toBe(false);
      expect(undoRecord?.inverse).toEqual({
        kind: "none"
      });

      const restoredInspection = expectInspectedDocument(await inspectDocument(workspace, bundle, documentPath));
      const secondUpdate = await applyChangeSet(workspace, bundle, {
        path: documentPath,
        base_revision: restoredInspection.resource.revision,
        mode: "commit",
        operations: [
          {
            kind: "set_node_name",
            node_handle: restoredInspection.resource.nodes[0]!.handle,
            name: "Edited Again"
          }
        ]
      }, journal);

      await writeTempDocument(
        tempRepoRoot,
        documentPath,
        [
          "SDD-TEXT 0.1",
          "Place P-001 \"Externally Edited\"",
          "  owner=Design",
          "END",
          ""
        ].join("\n")
      );

      const mismatchDryRun = await undoChangeSet(workspace, bundle, {
        change_set_id: secondUpdate.change_set_id
      }, journal);
      expect(mismatchDryRun.status).toBe("rejected");
      expect(diagnosticCodes(mismatchDryRun.diagnostics)).toContain("sdd.undo_revision_mismatch");

      const mismatchCommit = await undoChangeSet(workspace, bundle, {
        change_set_id: secondUpdate.change_set_id,
        mode: "commit"
      }, journal);
      expect(mismatchCommit.status).toBe("rejected");
      expect(diagnosticCodes(mismatchCommit.diagnostics)).toContain("sdd.undo_revision_mismatch");
      expect(await readTempDocument(tempRepoRoot, documentPath)).toBe(
        [
          "SDD-TEXT 0.1",
          "Place P-001 \"Externally Edited\"",
          "  owner=Design",
          "END",
          ""
        ].join("\n")
      );
    });
  });

  it("undoes committed creates as deletions and records terminal undo entries", async () => {
    await withTempRepo(async (tempRepoRoot) => {
      const documentPath = "docs/undo-create.sdd";
      const workspace = createAuthoringWorkspace(tempRepoRoot);
      const journal = createChangeSetJournal(workspace, {
        idFactory: createIdFactory("undo_create")
      });

      const created = await createDocument(workspace, bundle, {
        path: documentPath,
        template_id: "empty"
      }, journal);

      const dryRunUndo = await undoChangeSet(workspace, bundle, {
        change_set_id: created.change_set.change_set_id
      }, journal);
      expect(dryRunUndo.status).toBe("applied");
      expect(dryRunUndo.document_effect).toBe("deleted");
      expect(dryRunUndo.resulting_revision).toBeUndefined();
      expect(await exists(path.join(tempRepoRoot, documentPath))).toBe(true);

      const committedUndo = await undoChangeSet(workspace, bundle, {
        change_set_id: created.change_set.change_set_id,
        mode: "commit"
      }, journal);
      expect(committedUndo.status).toBe("applied");
      expect(committedUndo.document_effect).toBe("deleted");
      expect(committedUndo.resulting_revision).toBeUndefined();
      expect(await exists(path.join(tempRepoRoot, documentPath))).toBe(false);

      const undoRecord = await journal.getChangeSetRecord(committedUndo.change_set_id);
      expect(undoRecord?.change_set.undo_eligible).toBe(false);
      expect(undoRecord?.inverse).toEqual({
        kind: "none"
      });
    });
  });

  it("rejects unknown, dry-run, non-eligible, and legacy-inverse undo targets", async () => {
    await withTempRepo(async (tempRepoRoot) => {
      const documentPath = "docs/undo-rejections.sdd";
      const documentText = [
        "SDD-TEXT 0.1",
        "Place P-001 \"Home\"",
        "  owner=Design",
        "END",
        ""
      ].join("\n");
      await writeTempDocument(tempRepoRoot, documentPath, documentText);

      const workspace = createAuthoringWorkspace(tempRepoRoot);
      const journal = createChangeSetJournal(workspace, {
        idFactory: createIdFactory("undo_reject")
      });
      const inspected = expectInspectedDocument(await inspectDocument(workspace, bundle, documentPath));

      const unknown = await undoChangeSet(workspace, bundle, {
        change_set_id: "chg_missing_target"
      }, journal);
      expect(unknown.status).toBe("rejected");
      expect(diagnosticCodes(unknown.diagnostics)).toContain("sdd.undo_unknown_change_set");

      const dryRunApply = await applyChangeSet(workspace, bundle, {
        path: documentPath,
        base_revision: inspected.resource.revision,
        operations: []
      }, journal);
      const notCommitted = await undoChangeSet(workspace, bundle, {
        change_set_id: dryRunApply.change_set_id
      }, journal);
      expect(notCommitted.status).toBe("rejected");
      expect(diagnosticCodes(notCommitted.diagnostics)).toContain("sdd.undo_not_committed");

      await journal.recordChangeSet(
        {
          kind: "sdd-change-set",
          change_set_id: "chg_not_eligible_001",
          path: documentPath,
          origin: "apply_change_set",
          document_effect: "updated",
          base_revision: inspected.resource.revision,
          resulting_revision: inspected.resource.revision,
          mode: "commit",
          status: "applied",
          undo_eligible: false,
          operations: [],
          summary: createEmptySummary(),
          diagnostics: []
        },
        {
          inverse: createRestoreDocumentInverse(documentPath, inspected.resource.revision, documentText)
        }
      );

      const notEligible = await undoChangeSet(workspace, bundle, {
        change_set_id: "chg_not_eligible_001"
      }, journal);
      expect(notEligible.status).toBe("rejected");
      expect(diagnosticCodes(notEligible.diagnostics)).toContain("sdd.undo_not_eligible");

      await journal.recordChangeSet(
        {
          kind: "sdd-change-set",
          change_set_id: "chg_unsupported_none_001",
          path: documentPath,
          origin: "apply_change_set",
          document_effect: "updated",
          base_revision: inspected.resource.revision,
          resulting_revision: inspected.resource.revision,
          mode: "commit",
          status: "applied",
          undo_eligible: true,
          operations: [],
          summary: createEmptySummary(),
          diagnostics: []
        },
        {
          inverse: { kind: "none" }
        }
      );

      const unsupportedNone = await undoChangeSet(workspace, bundle, {
        change_set_id: "chg_unsupported_none_001"
      }, journal);
      expect(unsupportedNone.status).toBe("rejected");
      expect(diagnosticCodes(unsupportedNone.diagnostics)).toContain("sdd.undo_unsupported_inverse");

      await journal.recordChangeSet(
        {
          kind: "sdd-change-set",
          change_set_id: "chg_unsupported_apply_001",
          path: documentPath,
          origin: "apply_change_set",
          document_effect: "updated",
          base_revision: inspected.resource.revision,
          resulting_revision: inspected.resource.revision,
          mode: "commit",
          status: "applied",
          undo_eligible: true,
          operations: [],
          summary: createEmptySummary(),
          diagnostics: []
        },
        {
          inverse: {
            kind: "apply_inverse_change_set",
            operations: []
          }
        }
      );

      const unsupportedApply = await undoChangeSet(workspace, bundle, {
        change_set_id: "chg_unsupported_apply_001"
      }, journal);
      expect(unsupportedApply.status).toBe("rejected");
      expect(diagnosticCodes(unsupportedApply.diagnostics)).toContain("sdd.undo_unsupported_inverse");
    });
  });
});
