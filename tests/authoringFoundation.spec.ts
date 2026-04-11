import { access, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { sortDiagnostics, type Diagnostic } from "../src/diagnostics/types.js";
import type { ChangeSetResult } from "../src/authoring/contracts.js";
import {
  createChangeSetJournal,
  createDeleteDocumentInverse,
  type JournalInverseMetadata
} from "../src/authoring/journal.js";
import {
  computeDocumentRevision,
  normalizeTextToLf,
  writeCanonicalLfText
} from "../src/authoring/revisions.js";
import {
  createAuthoringWorkspace,
  WorkspacePathError
} from "../src/authoring/workspace.js";

async function withTempRepo(run: (repoRoot: string) => Promise<void>): Promise<void> {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "sdd-authoring-foundation-"));
  try {
    await run(repoRoot);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
}

async function exists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function createDiagnostic(overrides: Partial<Diagnostic>): Diagnostic {
  return {
    stage: "cli",
    code: "sdd.test",
    severity: "info",
    message: "test diagnostic",
    file: "docs/example.sdd",
    ...overrides
  };
}

function createEmptySummary() {
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

function createChangeSetResult(overrides: Partial<ChangeSetResult> = {}): ChangeSetResult {
  return {
    kind: "sdd-change-set",
    change_set_id: "chg_test_record",
    path: "docs/example.sdd",
    origin: "apply_change_set",
    document_effect: "updated",
    base_revision: "rev_base",
    resulting_revision: "rev_result",
    mode: "dry_run",
    status: "applied",
    undo_eligible: false,
    operations: [],
    summary: createEmptySummary(),
    diagnostics: [],
    ...overrides
  };
}

function assertPathError(fn: () => unknown, expectedMessagePart: string): void {
  try {
    fn();
    throw new Error("Expected path rejection.");
  } catch (error) {
    expect(error).toBeInstanceOf(WorkspacePathError);
    expect((error as WorkspacePathError).code).toBe("sdd.path_out_of_scope");
    expect((error as Error).message).toContain(expectedMessagePart);
  }
}

describe("authoring foundation", () => {
  it("resolves repo-relative .sdd paths and rejects out-of-scope or non-.sdd public write targets", async () => {
    await withTempRepo(async (repoRoot) => {
      const workspace = createAuthoringWorkspace(repoRoot);

      const resolvedDocument = workspace.resolveDocumentPath("docs\\nested\\example.sdd");
      expect(resolvedDocument.publicPath).toBe("docs/nested/example.sdd");
      expect(resolvedDocument.absolutePath).toBe(path.join(repoRoot, "docs", "nested", "example.sdd"));

      expect(workspace.normalizePublicPath("./docs/reference", { allowDirectory: true })).toBe("docs/reference");
      expect(workspace.resolveStatePath("change-sets/chg_test_record.json")).toBe(
        path.join(repoRoot, ".sdd-state", "change-sets", "chg_test_record.json")
      );
      expect(workspace.toPublicPath(path.join(repoRoot, "docs", "nested", "example.sdd"))).toBe(
        "docs/nested/example.sdd"
      );

      assertPathError(() => workspace.resolveDocumentPath("/tmp/outside.sdd"), "repo-relative");
      assertPathError(() => workspace.resolveDocumentPath("../outside.sdd"), "configured repo root");
      assertPathError(() => workspace.resolveDocumentPath("docs/example.txt"), ".sdd file");
      assertPathError(() => workspace.resolveStatePath("../escape.json"), "configured repo root");
    });
  });

  it("normalizes LF line endings, keeps revision identity stable, and persists LF-only text", async () => {
    await withTempRepo(async (repoRoot) => {
      const canonicalText = [
        "SDD-TEXT 0.1",
        "",
        "Place P-001 \"Home\"",
        "END",
        ""
      ].join("\n");
      const crlfText = canonicalText.replace(/\n/g, "\r\n");
      const outputPath = path.join(repoRoot, "docs", "example.sdd");
      await mkdir(path.dirname(outputPath), { recursive: true });

      expect(normalizeTextToLf(crlfText)).toBe(canonicalText);
      expect(computeDocumentRevision(canonicalText)).toBe(computeDocumentRevision(crlfText));

      const persistedText = await writeCanonicalLfText(outputPath, crlfText);
      expect(persistedText).toBe(canonicalText);

      const onDiskText = await readFile(outputPath, "utf8");
      expect(onDiskText).toBe(canonicalText);
      expect(onDiskText.includes("\r")).toBe(false);
    });
  });

  it("keeps dry-run journal records process-local and persists committed records with sorted diagnostics", async () => {
    await withTempRepo(async (repoRoot) => {
      const workspace = createAuthoringWorkspace(repoRoot);
      const issuedIds = ["chg_dry_record", "chg_commit_record"];
      const journal = createChangeSetJournal(workspace, {
        idFactory: () => issuedIds.shift() ?? "chg_unused",
        clock: () => new Date("2026-04-11T15:30:00.000Z")
      });

      const dryRunId = journal.createChangeSetId();
      const dryRunResult = createChangeSetResult({
        change_set_id: dryRunId,
        diagnostics: [createDiagnostic({ code: "sdd.dry-run", severity: "warn" })]
      });

      const dryRunRecord = await journal.recordChangeSet(dryRunResult);
      expect(dryRunRecord.change_set.change_set_id).toBe(dryRunId);
      expect(await journal.getChangeSetRecord(dryRunId)).toEqual(dryRunRecord);
      expect(
        await exists(path.join(repoRoot, ".sdd-state", "change-sets", `${dryRunId}.json`))
      ).toBe(false);

      const commitId = journal.createChangeSetId();
      const unsortedDiagnostics = [
        createDiagnostic({
          severity: "warn",
          code: "sdd.z_warning",
          message: "warning diagnostic",
          span: {
            line: 5,
            column: 1,
            endLine: 5,
            endColumn: 10,
            startOffset: 40,
            endOffset: 49
          }
        }),
        createDiagnostic({
          severity: "error",
          code: "sdd.a_error",
          message: "error diagnostic"
        })
      ];
      const unsortedProjectionDiagnostics = [
        createDiagnostic({
          stage: "project",
          severity: "warn",
          code: "project.z_note",
          message: "projection warning"
        }),
        createDiagnostic({
          stage: "project",
          severity: "error",
          code: "project.a_error",
          message: "projection error"
        })
      ];
      const committedResult = createChangeSetResult({
        change_set_id: commitId,
        mode: "commit",
        undo_eligible: true,
        diagnostics: unsortedDiagnostics,
        projection_results: [
          {
            view_id: "ia_place_map",
            projection: { schema: "projection" },
            diagnostics: unsortedProjectionDiagnostics
          }
        ]
      });

      const committedRecord = await journal.recordChangeSet(committedResult, {
        inverse: {
          kind: "apply_inverse_change_set",
          operations: []
        }
      });

      const committedPath = path.join(repoRoot, ".sdd-state", "change-sets", `${commitId}.json`);
      expect(await exists(committedPath)).toBe(true);
      expect(committedRecord.created_at).toBe("2026-04-11T15:30:00.000Z");
      expect(committedRecord.change_set.diagnostics).toEqual(sortDiagnostics(unsortedDiagnostics));
      expect(committedRecord.change_set.projection_results?.[0]?.diagnostics).toEqual(
        sortDiagnostics(unsortedProjectionDiagnostics)
      );

      const loadedRecord = await journal.getChangeSetRecord(commitId);
      expect(loadedRecord).toEqual(committedRecord);

      const rawCommittedText = await readFile(committedPath, "utf8");
      expect(rawCommittedText.endsWith("\n")).toBe(true);
      expect(rawCommittedText.includes("\r")).toBe(false);
    });
  });

  it("persists the checkpoint-1 create_document journal shape with delete-on-undo metadata", async () => {
    await withTempRepo(async (repoRoot) => {
      const workspace = createAuthoringWorkspace(repoRoot);
      const journal = createChangeSetJournal(workspace, {
        idFactory: () => "chg_create_document",
        clock: () => new Date("2026-04-11T16:00:00.000Z")
      });
      const changeSetId = journal.createChangeSetId();
      const inverse = createDeleteDocumentInverse("docs/new-document.sdd");
      const createDocumentResult = createChangeSetResult({
        change_set_id: changeSetId,
        path: "docs/new-document.sdd",
        origin: "create_document",
        document_effect: "created",
        base_revision: null,
        resulting_revision: "rev_created",
        mode: "commit",
        status: "applied",
        undo_eligible: true,
        operations: [],
        summary: createEmptySummary()
      });

      const record = await journal.recordChangeSet(createDocumentResult, { inverse });

      expect(record.change_set.origin).toBe("create_document");
      expect(record.change_set.document_effect).toBe("created");
      expect(record.change_set.base_revision).toBeNull();
      expect(record.change_set.undo_eligible).toBe(true);
      expect(record.change_set.mode).toBe("commit");
      expect(record.change_set.status).toBe("applied");
      expect(record.change_set.operations).toEqual([]);
      expect(record.change_set.summary).toEqual(createEmptySummary());

      const expectedInverse: JournalInverseMetadata = {
        kind: "delete_document",
        path: "docs/new-document.sdd"
      };
      expect(record.inverse).toEqual(expectedInverse);
      expect(await journal.getChangeSetRecord(changeSetId)).toEqual(record);
    });
  });
});
