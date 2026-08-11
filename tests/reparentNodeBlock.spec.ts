import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import type { Bundle } from "../src/bundle/types.js";
import { createChangeSetJournal } from "../src/authoring/journal.js";
import { inspectDocument, type InspectedDocument } from "../src/authoring/inspect.js";
import { applyChangeSet } from "../src/authoring/mutations.js";
import { createAuthoringWorkspace } from "../src/authoring/workspace.js";
import { loadBundle } from "../src/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

let bundle: Bundle;

beforeAll(async () => {
  bundle = await loadBundle(manifestPath);
});

async function withTempRepo(run: (tempRoot: string) => Promise<void>): Promise<void> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "sdd-reparent-node-"));
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

function inspected(result: Awaited<ReturnType<typeof inspectDocument>>): InspectedDocument {
  expect(result.kind).toBe("sdd-inspected-document");
  return result as InspectedDocument;
}

function nodeHandle(document: InspectedDocument, nodeId: string): string {
  return document.resource.nodes.find((node) => node.node_id === nodeId)!.handle;
}

function diagnosticCodes(result: Awaited<ReturnType<typeof applyChangeSet>>): string[] {
  return result.diagnostics.map((diagnostic) => diagnostic.code);
}

describe("reparent_node_block", () => {
  it("moves a complete top-level subtree under another node and rebases all owned source", async () => {
    await withTempRepo(async (tempRoot) => {
      const documentPath = "docs/top-to-nested.sdd";
      const source = [
        "SDD-TEXT 0.1",
        "Area A-001 \"Parent\"",
        "  CONTAINS P-001 \"Child\"",
        "END",
        "",
        "# child lead",
        "Place P-001 \"Child\" # header tail",
        "  owner=Design # property tail",
        "  NAVIGATES_TO P-002 \"Next\" # edge tail",
        "",
        "  # before nested",
        "  + ViewState VS-001 \"Nested\"",
        "    description=\"kept\"",
        "  END",
        "  # child trailing",
        "END # end tail",
        "Place P-002 \"Next\"",
        "END",
        ""
      ].join("\n");
      await writeDocument(tempRoot, documentPath, source);
      const workspace = createAuthoringWorkspace(tempRoot);
      const initial = inspected(await inspectDocument(workspace, bundle, documentPath));
      const parentHandle = nodeHandle(initial, "A-001");
      const childHandle = nodeHandle(initial, "P-001");
      const journal = createChangeSetJournal(workspace, {
        idFactory: (() => {
          const ids = ["chg_reparent_dry", "chg_reparent_commit"];
          return () => ids.shift() ?? "chg_reparent_extra";
        })()
      });
      const operation = {
        kind: "reparent_node_block" as const,
        node_handle: childHandle,
        placement: { mode: "last" as const, stream: "body" as const, parent_handle: parentHandle }
      };

      const dryRun = await applyChangeSet(workspace, bundle, {
        path: documentPath,
        base_revision: initial.resource.revision,
        operations: [operation]
      }, journal);
      expect(dryRun.status).toBe("applied");
      expect(await readFile(path.join(tempRoot, documentPath), "utf8")).toBe(source);

      const committed = await applyChangeSet(workspace, bundle, {
        path: documentPath,
        base_revision: initial.resource.revision,
        mode: "commit",
        operations: [operation]
      }, journal);
      expect(committed.status).toBe("applied");
      expect(committed.resulting_revision).toBe(dryRun.resulting_revision);
      expect(committed.summary).toEqual(dryRun.summary);
      expect(committed.summary.ordering_changes).toEqual([
        {
          kind: "reparented_node_block",
          target_handle: childHandle,
          old_parent_handle: null,
          new_parent_handle: parentHandle,
          old_index: 1,
          new_index: 1
        }
      ]);
      expect(await readFile(path.join(tempRoot, documentPath), "utf8")).toBe([
        "SDD-TEXT 0.1",
        "Area A-001 \"Parent\"",
        "  CONTAINS P-001 \"Child\"",
        "",
        "  # child lead",
        "  + Place P-001 \"Child\" # header tail",
        "    owner=Design # property tail",
        "    NAVIGATES_TO P-002 \"Next\" # edge tail",
        "",
        "    # before nested",
        "    + ViewState VS-001 \"Nested\"",
        "      description=\"kept\"",
        "    END",
        "    # child trailing",
        "  END # end tail",
        "END",
        "Place P-002 \"Next\"",
        "END",
        ""
      ].join("\n"));
    });
  });

  it("moves nested nodes between parents and back to the top-level stream", async () => {
    await withTempRepo(async (tempRoot) => {
      const documentPath = "docs/cross-stream.sdd";
      await writeDocument(tempRoot, documentPath, [
        "SDD-TEXT 0.1",
        "Area A-001 \"One\"",
        "  + Place P-001 \"Child\"",
        "  END",
        "END",
        "Area A-002 \"Two\"",
        "END",
        "Place P-999 \"Last\"",
        "END",
        ""
      ].join("\n"));
      const workspace = createAuthoringWorkspace(tempRoot);
      const first = inspected(await inspectDocument(workspace, bundle, documentPath));
      const child = nodeHandle(first, "P-001");
      const parentTwo = nodeHandle(first, "A-002");

      const moved = await applyChangeSet(workspace, bundle, {
        path: documentPath,
        base_revision: first.resource.revision,
        mode: "commit",
        operations: [{
          kind: "reparent_node_block",
          node_handle: child,
          placement: { mode: "first", stream: "body", parent_handle: parentTwo }
        }]
      });
      expect(moved.status).toBe("applied");
      expect(moved.summary.ordering_changes[0]).toMatchObject({
        kind: "reparented_node_block",
        old_parent_handle: nodeHandle(first, "A-001"),
        new_parent_handle: parentTwo,
        old_index: 0,
        new_index: 0
      });

      const second = inspected(await inspectDocument(workspace, bundle, documentPath));
      const movedChild = nodeHandle(second, "P-001");
      const last = nodeHandle(second, "P-999");
      const topLevel = await applyChangeSet(workspace, bundle, {
        path: documentPath,
        base_revision: second.resource.revision,
        mode: "commit",
        operations: [{
          kind: "reparent_node_block",
          node_handle: movedChild,
          placement: { mode: "before", stream: "top_level", anchor_handle: last }
        }]
      });
      expect(topLevel.status).toBe("applied");
      expect(topLevel.summary.ordering_changes[0]).toMatchObject({
        kind: "reparented_node_block",
        old_parent_handle: nodeHandle(second, "A-002"),
        new_parent_handle: null,
        old_index: 0,
        new_index: 2
      });
      expect(await readFile(path.join(tempRoot, documentPath), "utf8")).toBe([
        "SDD-TEXT 0.1",
        "Area A-001 \"One\"",
        "END",
        "Area A-002 \"Two\"",
        "END",
        "Place P-001 \"Child\"",
        "END",
        "Place P-999 \"Last\"",
        "END",
        ""
      ].join("\n"));
    });
  });

  it("rejects self/descendant cycles, invalid destination anchors, same-parent use, and stale handles", async () => {
    await withTempRepo(async (tempRoot) => {
      const documentPath = "docs/rejections.sdd";
      await writeDocument(tempRoot, documentPath, [
        "SDD-TEXT 0.1",
        "Area A-001 \"Root\"",
        "  + Place P-001 \"Child\"",
        "    + ViewState VS-001 \"Grandchild\"",
        "    END",
        "  END",
        "END",
        "Area A-002 \"Other\"",
        "END",
        ""
      ].join("\n"));
      const workspace = createAuthoringWorkspace(tempRoot);
      const initial = inspected(await inspectDocument(workspace, bundle, documentPath));
      const root = nodeHandle(initial, "A-001");
      const child = nodeHandle(initial, "P-001");
      const grandchild = nodeHandle(initial, "VS-001");
      const other = nodeHandle(initial, "A-002");

      for (const parent of [root, grandchild]) {
        const rejected = await applyChangeSet(workspace, bundle, {
          path: documentPath,
          base_revision: initial.resource.revision,
          operations: [{
            kind: "reparent_node_block",
            node_handle: root,
            placement: { mode: "last", stream: "body", parent_handle: parent }
          }]
        });
        expect(rejected.status).toBe("rejected");
        expect(diagnosticCodes(rejected)).toContain("sdd.invalid_placement");
      }

      const sameParent = await applyChangeSet(workspace, bundle, {
        path: documentPath,
        base_revision: initial.resource.revision,
        operations: [{
          kind: "reparent_node_block",
          node_handle: child,
          placement: { mode: "last", stream: "body", parent_handle: root }
        }]
      });
      expect(sameParent.status).toBe("rejected");

      const wrongAnchor = await applyChangeSet(workspace, bundle, {
        path: documentPath,
        base_revision: initial.resource.revision,
        operations: [{
          kind: "reparent_node_block",
          node_handle: child,
          placement: { mode: "before", stream: "body", parent_handle: other, anchor_handle: grandchild }
        }]
      });
      expect(wrongAnchor.status).toBe("rejected");
      expect(diagnosticCodes(wrongAnchor)).toContain("sdd.invalid_placement");

      const stale = await applyChangeSet(workspace, bundle, {
        path: documentPath,
        base_revision: initial.resource.revision,
        mode: "commit",
        operations: [{
          kind: "set_node_name",
          node_handle: other,
          name: "Changed"
        }]
      });
      expect(stale.status).toBe("applied");
      const staleHandle = await applyChangeSet(workspace, bundle, {
        path: documentPath,
        base_revision: stale.resulting_revision!,
        operations: [{
          kind: "reparent_node_block",
          node_handle: child,
          placement: { mode: "last", stream: "top_level" }
        }]
      });
      expect(staleHandle.status).toBe("rejected");
      expect(diagnosticCodes(staleHandle)).toContain("sdd.invalid_handle");

      const staleRevision = await applyChangeSet(workspace, bundle, {
        path: documentPath,
        base_revision: initial.resource.revision,
        operations: [{
          kind: "reparent_node_block",
          node_handle: child,
          placement: { mode: "last", stream: "top_level" }
        }]
      });
      expect(staleRevision.status).toBe("rejected");
      expect(diagnosticCodes(staleRevision)).toContain("sdd.revision_mismatch");
    });
  });
});
