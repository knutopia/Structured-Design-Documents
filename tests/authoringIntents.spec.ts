import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import type { Bundle } from "../src/bundle/types.js";
import { applyAuthoringIntent } from "../src/authoring/authoringIntents.js";
import { applyChangeSet, createDocument } from "../src/authoring/mutations.js";
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
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "sdd-authoring-intents-"));
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

function expectInspectedDocument(result: Awaited<ReturnType<typeof inspectDocument>>): InspectedDocument {
  expect(result.kind).toBe("sdd-inspected-document");
  return result as InspectedDocument;
}

describe("authoring intents", () => {
  it("bootstraps newly created empty documents via author and returns derived operations plus created targets", async () => {
    await withTempRepo(async (tempRepoRoot) => {
      const workspace = createAuthoringWorkspace(tempRepoRoot);
      const created = await createDocument(workspace, bundle, {
        path: "docs/author-bootstrap.sdd"
      });

      const result = await applyAuthoringIntent(workspace, bundle, {
        path: "docs/author-bootstrap.sdd",
        base_revision: created.revision,
        intents: [
          {
            kind: "insert_node_scaffold",
            local_id: "place-home",
            placement: {
              mode: "last"
            },
            node: {
              node_type: "Place",
              node_id: "P-001",
              name: "Home",
              props: [
                {
                  key: "owner",
                  value_kind: "bare_value",
                  raw_value: "Design"
                }
              ],
              children: [
                {
                  kind: "insert_node_scaffold",
                  local_id: "place-child",
                  placement: {
                    mode: "last"
                  },
                  node: {
                    node_type: "Place",
                    node_id: "P-010",
                    name: "Child"
                  }
                }
              ]
            }
          }
        ]
      });

      expect(result.status).toBe("applied");
      expect(result.change_set.origin).toBe("apply_authoring_intent");
      expect(result.change_set.operations.map((operation) => operation.kind)).toEqual([
        "insert_node_block",
        "set_node_property",
        "insert_node_block"
      ]);
      expect(result.created_targets.map((target) => target.local_id)).toEqual(["place-home", "place-child"]);
      expect(result.created_targets.every((target) => typeof target.handle === "string")).toBe(true);
      expect(result.change_set.operations[2]).toMatchObject({
        kind: "insert_node_block",
        placement: {
          stream: "body",
          parent_handle: result.created_targets[0]?.handle
        }
      });
      expect(await readTempDocument(tempRepoRoot, "docs/author-bootstrap.sdd")).toBe("SDD-TEXT 0.1\n");
    });
  });

  it("supports backward local_id refs across intents and allows follow-on low-level apply after commit", async () => {
    await withTempRepo(async (tempRepoRoot) => {
      const workspace = createAuthoringWorkspace(tempRepoRoot);
      const created = await createDocument(workspace, bundle, {
        path: "docs/author-continue.sdd"
      });

      const authored = await applyAuthoringIntent(workspace, bundle, {
        path: "docs/author-continue.sdd",
        base_revision: created.revision,
        mode: "commit",
        intents: [
          {
            kind: "insert_node_scaffold",
            local_id: "place-root",
            placement: {
              mode: "last"
            },
            node: {
              node_type: "Place",
              node_id: "P-001",
              name: "Root"
            }
          },
          {
            kind: "insert_node_scaffold",
            local_id: "place-child",
            parent: {
              by: "local_id",
              local_id: "place-root"
            },
            placement: {
              mode: "last"
            },
            node: {
              node_type: "Place",
              node_id: "P-010",
              name: "Child"
            }
          }
        ]
      });

      expect(authored.status).toBe("applied");
      const rootHandle = authored.created_targets.find((target) => target.local_id === "place-root")?.handle;
      expect(rootHandle).toEqual(expect.any(String));
      expect(authored.change_set.operations[1]).toMatchObject({
        kind: "insert_node_block",
        placement: {
          stream: "body",
          parent_handle: rootHandle
        }
      });

      const continued = await applyChangeSet(workspace, bundle, {
        path: "docs/author-continue.sdd",
        base_revision: authored.resulting_revision!,
        mode: "commit",
        operations: [
          {
            kind: "set_node_property",
            node_handle: rootHandle!,
            key: "owner",
            value_kind: "bare_value",
            raw_value: "Ops"
          }
        ]
      });

      expect(continued.status).toBe("applied");
      expect(await readTempDocument(tempRepoRoot, "docs/author-continue.sdd")).toContain("owner=Ops");
    });
  });

  it("rejects duplicate local_ids and forward local_id refs with intent-local diagnostics", async () => {
    await withTempRepo(async (tempRepoRoot) => {
      const workspace = createAuthoringWorkspace(tempRepoRoot);
      const created = await createDocument(workspace, bundle, {
        path: "docs/author-invalid.sdd"
      });

      const duplicate = await applyAuthoringIntent(workspace, bundle, {
        path: "docs/author-invalid.sdd",
        base_revision: created.revision,
        intents: [
          {
            kind: "insert_node_scaffold",
            local_id: "place-dup",
            placement: {
              mode: "last"
            },
            node: {
              node_type: "Place",
              node_id: "P-001",
              name: "One"
            }
          },
          {
            kind: "insert_node_scaffold",
            local_id: "place-dup",
            placement: {
              mode: "last"
            },
            node: {
              node_type: "Place",
              node_id: "P-002",
              name: "Two"
            }
          }
        ]
      });

      expect(duplicate.status).toBe("rejected");
      expect(duplicate.intent_diagnostics?.[0]).toMatchObject({
        code: "sdd.duplicate_local_id",
        local_id: "place-dup"
      });

      const forwardRef = await applyAuthoringIntent(workspace, bundle, {
        path: "docs/author-invalid.sdd",
        base_revision: created.revision,
        intents: [
          {
            kind: "insert_node_scaffold",
            local_id: "place-child",
            parent: {
              by: "local_id",
              local_id: "place-root"
            },
            placement: {
              mode: "last"
            },
            node: {
              node_type: "Place",
              node_id: "P-010",
              name: "Child"
            }
          },
          {
            kind: "insert_node_scaffold",
            local_id: "place-root",
            placement: {
              mode: "last"
            },
            node: {
              node_type: "Place",
              node_id: "P-001",
              name: "Root"
            }
          }
        ]
      });

      expect(forwardRef.status).toBe("rejected");
      expect(forwardRef.intent_diagnostics?.[0]).toMatchObject({
        code: "sdd.local_id_not_found",
        local_id: "place-child"
      });
    });
  });

  it("rejects missing and ambiguous selectors using parse-backed inspect data", async () => {
    await withTempRepo(async (tempRepoRoot) => {
      const workspace = createAuthoringWorkspace(tempRepoRoot);

      await writeTempDocument(
        tempRepoRoot,
        "docs/selector.sdd",
        ["SDD-TEXT 0.1", "Place P-001 \"Root\"", "END", ""].join("\n")
      );
      const inspected = expectInspectedDocument(await inspectDocument(workspace, bundle, "docs/selector.sdd"));

      const missing = await applyAuthoringIntent(workspace, bundle, {
        path: "docs/selector.sdd",
        base_revision: inspected.resource.revision,
        intents: [
          {
            kind: "insert_node_scaffold",
            local_id: "place-child",
            parent: {
              by: "selector",
              selector: {
                kind: "node_id",
                node_id: "missing-node"
              }
            },
            placement: {
              mode: "last"
            },
            node: {
              node_type: "Place",
              node_id: "P-010",
              name: "Child"
            }
          }
        ]
      });

      expect(missing.status).toBe("rejected");
      expect(missing.intent_diagnostics?.[0]?.code).toBe("sdd.selector_not_found");

      await copyFixture(tempRepoRoot, "tests/fixtures/invalid/duplicate_node_id.sdd", "docs/duplicate.sdd");
      const duplicateInspected = expectInspectedDocument(await inspectDocument(workspace, bundle, "docs/duplicate.sdd"));
      const ambiguous = await applyAuthoringIntent(workspace, bundle, {
        path: "docs/duplicate.sdd",
        base_revision: duplicateInspected.resource.revision,
        intents: [
          {
            kind: "insert_node_scaffold",
            local_id: "place-child",
            parent: {
              by: "selector",
              selector: {
                kind: "node_id",
                node_id: duplicateInspected.resource.nodes[0]!.node_id
              }
            },
            placement: {
              mode: "last"
            },
            node: {
              node_type: "Place",
              node_id: "P-010",
              name: "Child"
            }
          }
        ]
      });

      expect(ambiguous.status).toBe("rejected");
      expect(ambiguous.intent_diagnostics?.[0]?.code).toBe("sdd.selector_ambiguous");
    });
  });

  it("rejects scaffold edge placement outside the v1 first-or-last contract", async () => {
    await withTempRepo(async (tempRepoRoot) => {
      const workspace = createAuthoringWorkspace(tempRepoRoot);
      const created = await createDocument(workspace, bundle, {
        path: "docs/author-edge-placement.sdd"
      });

      const result = await applyAuthoringIntent(workspace, bundle, {
        path: "docs/author-edge-placement.sdd",
        base_revision: created.revision,
        intents: [
          {
            kind: "insert_node_scaffold",
            local_id: "place-root",
            placement: {
              mode: "last"
            },
            node: {
              node_type: "Place",
              node_id: "P-001",
              name: "Root",
              edges: [
                {
                  local_id: "edge-invalid",
                  rel_type: "CONTAINS",
                  to: "P-010",
                  placement: {
                    mode: "before" as never
                  }
                }
              ]
            }
          }
        ]
      });

      expect(result.status).toBe("rejected");
      expect(result.intent_diagnostics?.[0]).toMatchObject({
        code: "sdd.invalid_placement",
        local_id: "edge-invalid"
      });
    });
  });
});
