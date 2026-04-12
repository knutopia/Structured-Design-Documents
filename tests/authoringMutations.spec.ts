import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import type { Bundle } from "../src/bundle/types.js";
import type { Diagnostic } from "../src/diagnostics/types.js";
import { applyChangeSet, AuthoringMutationError, createDocument } from "../src/authoring/mutations.js";
import { createChangeSetJournal } from "../src/authoring/journal.js";
import { inspectDocument, type InspectedDocument } from "../src/authoring/inspect.js";
import { createAuthoringWorkspace } from "../src/authoring/workspace.js";
import { loadBundle } from "../src/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

let bundle: Bundle;

beforeAll(async () => {
  bundle = await loadBundle(manifestPath);
});

async function withTempRepo(run: (repoRootPath: string) => Promise<void>): Promise<void> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "sdd-authoring-mutations-"));
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

async function copyFixture(repoRootPath: string, fixtureRelativePath: string, destinationPath: string): Promise<void> {
  const fixtureText = await readFile(path.join(repoRoot, fixtureRelativePath), "utf8");
  await writeTempDocument(repoRootPath, destinationPath, fixtureText);
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

async function expectMutationError(
  action: Promise<unknown>,
  expectedCode: string
): Promise<AuthoringMutationError> {
  try {
    await action;
    throw new Error("Expected authoring mutation to reject.");
  } catch (error) {
    expect(error).toBeInstanceOf(AuthoringMutationError);
    const mutationError = error as AuthoringMutationError;
    const diagnostics = mutationError.changeSet?.diagnostics ?? mutationError.diagnostics;
    expect(diagnostics.some((diagnostic) => diagnostic.code === expectedCode)).toBe(true);
    return mutationError;
  }
}

function diagnosticCodes(diagnostics: Diagnostic[]): string[] {
  return diagnostics.map((diagnostic) => diagnostic.code);
}

describe("authoring mutations", () => {
  it("creates empty documents, returns parse diagnostics, and journals delete-on-undo metadata", async () => {
    await withTempRepo(async (tempRepoRoot) => {
      const workspace = createAuthoringWorkspace(tempRepoRoot);
      const journal = createChangeSetJournal(workspace, {
        idFactory: () => "chg_create_001",
        clock: () => new Date("2026-04-11T18:00:00.000Z")
      });

      const result = await createDocument(workspace, bundle, {
        path: "docs/new.sdd",
        template_id: "empty"
      }, journal);

      expect(result.kind).toBe("sdd-create-document");
      expect(result.uri).toBe("sdd://document/docs/new.sdd");
      expect(result.revision).toBe(result.change_set.resulting_revision);
      expect(result.change_set.origin).toBe("create_document");
      expect(result.change_set.document_effect).toBe("created");
      expect(result.change_set.mode).toBe("commit");
      expect(result.change_set.status).toBe("applied");
      expect(result.change_set.undo_eligible).toBe(true);
      expect(diagnosticCodes(result.change_set.diagnostics)).toContain("parse.minimum_top_level_blocks");
      expect(await readTempDocument(tempRepoRoot, "docs/new.sdd")).toBe("SDD-TEXT 0.1\n");

      const record = await journal.getChangeSetRecord("chg_create_001");
      expect(record?.inverse).toEqual({
        kind: "delete_document",
        path: "docs/new.sdd"
      });
    });
  });

  it("rejects existing create targets and unsupported templates with structured diagnostics", async () => {
    await withTempRepo(async (tempRepoRoot) => {
      const workspace = createAuthoringWorkspace(tempRepoRoot);
      await writeTempDocument(tempRepoRoot, "docs/existing.sdd", "SDD-TEXT 0.1\n");

      const existingError = await expectMutationError(
        createDocument(workspace, bundle, {
          path: "docs/existing.sdd",
          template_id: "empty"
        }),
        "sdd.document_exists"
      );
      expect(existingError.changeSet?.status).toBe("rejected");

      await expectMutationError(
        createDocument(workspace, bundle, {
          path: "docs/unsupported.sdd",
          template_id: "starter"
        }),
        "sdd.unsupported_template"
      );
    });
  });

  it("bootstraps the first top-level insert on the empty template and rejects other parse-invalid edits", async () => {
    await withTempRepo(async (tempRepoRoot) => {
      const workspace = createAuthoringWorkspace(tempRepoRoot);
      const journal = createChangeSetJournal(workspace, {
        idFactory: (() => {
          const ids = ["chg_create_bootstrap", "chg_apply_bootstrap_dry", "chg_apply_bootstrap_commit"];
          return () => ids.shift() ?? "chg_unused";
        })()
      });
      const created = await createDocument(workspace, bundle, {
        path: "docs/bootstrap.sdd",
        template_id: "empty"
      }, journal);

      const rejected = await applyChangeSet(workspace, bundle, {
        path: "docs/bootstrap.sdd",
        base_revision: created.revision,
        operations: [
          {
            kind: "set_node_name",
            node_handle: "hdl_missing",
            name: "Renamed"
          }
        ]
      }, journal);
      expect(rejected.status).toBe("rejected");
      expect(diagnosticCodes(rejected.diagnostics)).toContain("sdd.parse_invalid_for_apply");
      expect(diagnosticCodes(rejected.diagnostics)).toContain("parse.minimum_top_level_blocks");

      const dryRun = await applyChangeSet(workspace, bundle, {
        path: "docs/bootstrap.sdd",
        base_revision: created.revision,
        operations: [
          {
            kind: "insert_node_block",
            node_type: "Place",
            node_id: "P-001",
            name: "Home",
            placement: {
              mode: "last",
              stream: "top_level"
            }
          }
        ]
      }, journal);

      expect(dryRun.status).toBe("applied");
      expect(dryRun.mode).toBe("dry_run");
      expect(await readTempDocument(tempRepoRoot, "docs/bootstrap.sdd")).toBe("SDD-TEXT 0.1\n");

      const committed = await applyChangeSet(workspace, bundle, {
        path: "docs/bootstrap.sdd",
        base_revision: created.revision,
        mode: "commit",
        operations: [
          {
            kind: "insert_node_block",
            node_type: "Place",
            node_id: "P-001",
            name: "Home",
            placement: {
              mode: "last",
              stream: "top_level"
            }
          }
        ]
      }, journal);

      expect(committed.status).toBe("applied");
      expect(committed.resulting_revision).toBeDefined();
      expect(committed.summary.node_insertions).toEqual([
        {
          node_id: "P-001",
          node_type: "Place"
        }
      ]);
      expect(await readTempDocument(tempRepoRoot, "docs/bootstrap.sdd")).toBe(
        ["SDD-TEXT 0.1", "Place P-001 \"Home\"", "END", ""].join("\n")
      );
    });
  });

  it("preserves header/property comments, appends properties before edges, keeps dry-runs local, and journals restore metadata on commit", async () => {
    await withTempRepo(async (tempRepoRoot) => {
      const documentPath = "docs/rewrite.sdd";
      const originalText = [
        "SDD-TEXT 0.1",
        "",
        "Place P-001 \"Home\" # keep header",
        "  # before owner",
        "  owner=Design # keep owner",
        "  NAVIGATES_TO P-002 \"Next\"",
        "END",
        "",
        "# trailing",
        ""
      ].join("\n");
      await writeTempDocument(tempRepoRoot, documentPath, originalText);

      const workspace = createAuthoringWorkspace(tempRepoRoot);
      const journal = createChangeSetJournal(workspace, {
        idFactory: (() => {
          const ids = ["chg_dry_001", "chg_commit_001"];
          return () => ids.shift() ?? "chg_unused";
        })(),
        clock: () => new Date("2026-04-11T19:30:00.000Z")
      });
      const inspected = expectInspectedDocument(await inspectDocument(workspace, bundle, documentPath));
      const nodeHandle = inspected.resource.nodes[0]!.handle;

      const dryRun = await applyChangeSet(workspace, bundle, {
        path: documentPath,
        base_revision: inspected.resource.revision,
        operations: [
          {
            kind: "set_node_name",
            node_handle: nodeHandle,
            name: "Start"
          },
          {
            kind: "set_node_property",
            node_handle: nodeHandle,
            key: "owner",
            value_kind: "bare_value",
            raw_value: "Ops"
          },
          {
            kind: "set_node_property",
            node_handle: nodeHandle,
            key: "priority",
            value_kind: "bare_value",
            raw_value: "high"
          }
        ]
      }, journal);

      expect(dryRun.status).toBe("applied");
      expect(await readTempDocument(tempRepoRoot, documentPath)).toBe(originalText);
      expect(await journal.getChangeSetRecord("chg_dry_001")).toBeDefined();
      expect(
        await exists(path.join(tempRepoRoot, ".sdd-state", "change-sets", "chg_dry_001.json"))
      ).toBe(false);

      const committed = await applyChangeSet(workspace, bundle, {
        path: documentPath,
        base_revision: inspected.resource.revision,
        mode: "commit",
        operations: [
          {
            kind: "set_node_name",
            node_handle: nodeHandle,
            name: "Start"
          },
          {
            kind: "set_node_property",
            node_handle: nodeHandle,
            key: "owner",
            value_kind: "bare_value",
            raw_value: "Ops"
          },
          {
            kind: "set_node_property",
            node_handle: nodeHandle,
            key: "priority",
            value_kind: "bare_value",
            raw_value: "high"
          }
        ]
      }, journal);

      expect(committed.status).toBe("applied");
      expect(await readTempDocument(tempRepoRoot, documentPath)).toBe(
        [
          "SDD-TEXT 0.1",
          "",
          "Place P-001 \"Start\" # keep header",
          "  # before owner",
          "  owner=Ops # keep owner",
          "  priority=high",
          "  NAVIGATES_TO P-002 \"Next\"",
          "END",
          "",
          "# trailing",
          ""
        ].join("\n")
      );

      const committedRecord = await journal.getChangeSetRecord("chg_commit_001");
      expect(committedRecord?.inverse).toEqual({
        kind: "restore_document",
        path: documentPath,
        revision: inspected.resource.revision,
        text: originalText
      });
    });
  });

  it("rejects ambiguous properties, wrong-kind handles, and stale revisions", async () => {
    await withTempRepo(async (tempRepoRoot) => {
      const documentPath = "docs/duplicate-props.sdd";
      await writeTempDocument(
        tempRepoRoot,
        documentPath,
        [
          "SDD-TEXT 0.1",
          "Place P-001 \"Home\"",
          "  owner=Design",
          "  owner=Ops",
          "END",
          ""
        ].join("\n")
      );

      const workspace = createAuthoringWorkspace(tempRepoRoot);
      const inspected = expectInspectedDocument(await inspectDocument(workspace, bundle, documentPath));
      const nodeHandle = inspected.resource.nodes[0]!.handle;
      const propertyHandle = inspected.resource.body_items[0]!.handle;

      const ambiguous = await applyChangeSet(workspace, bundle, {
        path: documentPath,
        base_revision: inspected.resource.revision,
        operations: [
          {
            kind: "set_node_property",
            node_handle: nodeHandle,
            key: "owner",
            value_kind: "bare_value",
            raw_value: "One"
          }
        ]
      });
      expect(ambiguous.status).toBe("rejected");
      expect(diagnosticCodes(ambiguous.diagnostics)).toContain("sdd.ambiguous_target");

      const wrongKind = await applyChangeSet(workspace, bundle, {
        path: documentPath,
        base_revision: inspected.resource.revision,
        operations: [
          {
            kind: "set_node_name",
            node_handle: propertyHandle,
            name: "Wrong"
          }
        ]
      });
      expect(wrongKind.status).toBe("rejected");
      expect(diagnosticCodes(wrongKind.diagnostics)).toContain("sdd.invalid_handle");

      const stale = await applyChangeSet(workspace, bundle, {
        path: documentPath,
        base_revision: "rev_stale",
        operations: []
      });
      expect(stale.status).toBe("rejected");
      expect(diagnosticCodes(stale.diagnostics)).toContain("sdd.revision_mismatch");
    });
  });

  it("inserts edges at the default position and removes edges and nested nodes on commit", async () => {
    await withTempRepo(async (tempRepoRoot) => {
      const documentPath = "docs/edge-ops.sdd";
      await writeTempDocument(
        tempRepoRoot,
        documentPath,
        [
          "SDD-TEXT 0.1",
          "Place P-001 \"Home\"",
          "  owner=Design",
          "",
          "  + Place P-010 \"Child\"",
          "  END",
          "END",
          ""
        ].join("\n")
      );

      const workspace = createAuthoringWorkspace(tempRepoRoot);
      let inspected = expectInspectedDocument(await inspectDocument(workspace, bundle, documentPath));
      const parentHandle = inspected.resource.nodes[0]!.handle;

      const inserted = await applyChangeSet(workspace, bundle, {
        path: documentPath,
        base_revision: inspected.resource.revision,
        mode: "commit",
        operations: [
          {
            kind: "insert_edge_line",
            parent_handle: parentHandle,
            rel_type: "CONTAINS",
            to: "P-010",
            to_name: "Child"
          }
        ]
      });

      expect(inserted.status).toBe("applied");
      expect(await readTempDocument(tempRepoRoot, documentPath)).toBe(
        [
          "SDD-TEXT 0.1",
          "Place P-001 \"Home\"",
          "  owner=Design",
          "  CONTAINS P-010 \"Child\"",
          "",
          "  + Place P-010 \"Child\"",
          "  END",
          "END",
          ""
        ].join("\n")
      );

      inspected = expectInspectedDocument(await inspectDocument(workspace, bundle, documentPath));
      const edgeHandle = inspected.resource.body_items.find((item) => item.kind === "edge_line")!.handle;
      const childHandle = inspected.resource.nodes[1]!.handle;

      const removed = await applyChangeSet(workspace, bundle, {
        path: documentPath,
        base_revision: inspected.resource.revision,
        mode: "commit",
        operations: [
          {
            kind: "remove_edge_line",
            edge_handle: edgeHandle
          },
          {
            kind: "delete_node_block",
            node_handle: childHandle
          }
        ]
      });

      expect(removed.status).toBe("applied");
      expect(await readTempDocument(tempRepoRoot, documentPath)).toBe(
        [
          "SDD-TEXT 0.1",
          "Place P-001 \"Home\"",
          "  owner=Design",
          "END",
          ""
        ].join("\n")
      );
    });
  });

  it("keeps compile diagnostics on compile-invalid apply results and returns validation/projection feedback", async () => {
    await withTempRepo(async (tempRepoRoot) => {
      const duplicatePath = "docs/duplicate.sdd";
      await copyFixture(tempRepoRoot, "tests/fixtures/invalid/duplicate_node_id.sdd", duplicatePath);

      const workspace = createAuthoringWorkspace(tempRepoRoot);
      const duplicateInspected = expectInspectedDocument(await inspectDocument(workspace, bundle, duplicatePath));
      const duplicateHandle = duplicateInspected.resource.nodes[0]!.handle;
      const duplicateResult = await applyChangeSet(workspace, bundle, {
        path: duplicatePath,
        base_revision: duplicateInspected.resource.revision,
        operations: [
          {
            kind: "set_node_property",
            node_handle: duplicateHandle,
            key: "priority",
            value_kind: "bare_value",
            raw_value: "high"
          }
        ]
      });

      expect(duplicateResult.status).toBe("applied");
      expect(diagnosticCodes(duplicateResult.diagnostics)).toContain("compile.duplicate_node_id");

      const validatePath = "docs/validate.sdd";
      await copyFixture(tempRepoRoot, "tests/fixtures/invalid/invalid_place_access.sdd", validatePath);
      const validateInspected = expectInspectedDocument(await inspectDocument(workspace, bundle, validatePath));
      const validateResult = await applyChangeSet(workspace, bundle, {
        path: validatePath,
        base_revision: validateInspected.resource.revision,
        operations: [],
        validate_profile: "strict",
        projection_views: ["ia_place_map"]
      });

      expect(validateResult.status).toBe("applied");
      expect(diagnosticCodes(validateResult.diagnostics)).toContain("validate.place_access_format");
      expect(validateResult.projection_results).toHaveLength(1);
      expect(validateResult.projection_results?.[0]?.view_id).toBe("ia_place_map");
    });
  });
});
