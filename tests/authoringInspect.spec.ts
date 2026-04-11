import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import type { Bundle } from "../src/bundle/types.js";
import { inspectDocument, type InspectedDocument } from "../src/authoring/inspect.js";
import { createAuthoringWorkspace } from "../src/authoring/workspace.js";
import { loadBundle } from "../src/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

let bundle: Bundle;

beforeAll(async () => {
  bundle = await loadBundle(manifestPath);
});

async function withTempRepo(run: (repoRoot: string) => Promise<void>): Promise<void> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "sdd-authoring-inspect-"));
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

function expectInspectedDocument(result: Awaited<ReturnType<typeof inspectDocument>>): InspectedDocument {
  expect(result.kind).toBe("sdd-inspected-document");
  return result as InspectedDocument;
}

function commentTexts(document: InspectedDocument, handle: string, position: "leading" | "trailing"): string[] {
  return (document.rewriteOwnership.byHandle.get(handle)?.[position] ?? [])
    .filter((item) => item.kind === "CommentLine")
    .map((item) => item.rawText.trimStart());
}

function blankLineCount(document: InspectedDocument, handle: string, position: "leading" | "trailing"): number {
  return (document.rewriteOwnership.byHandle.get(handle)?.[position] ?? [])
    .filter((item) => item.kind === "BlankLine")
    .length;
}

describe("authoring inspect", () => {
  it("builds the parse-backed inspect model in deterministic source order without exposing trivia", async () => {
    await withTempRepo(async (tempRepoRoot) => {
      const documentPath = "docs/mixed.sdd";
      await writeTempDocument(
        tempRepoRoot,
        documentPath,
        [
          "# lead comment",
          "",
          "SDD-TEXT 0.1",
          "",
          "# after version",
          "Place P-100 \"Parent\"",
          "  # before owner",
          "  owner=Design",
          "",
          "  CONTAINS P-110 \"Child Place\"",
          "  MEASURED_BY M-001 \"Metric\"",
          "",
          "  # before child block",
          "  + Place P-110 \"Child Place\"",
          "    # child owner comment",
          "    owner=Ops",
          "  END",
          "",
          "  # before component edge",
          "  COMPOSED_OF C-120 \"Widget\"",
          "END",
          "",
          "# between top-level nodes",
          "Place P-200 \"Second\"",
          "  owner=Second",
          "END",
          "",
          "# trailing top-level comment",
          ""
        ].join("\n")
      );

      const workspace = createAuthoringWorkspace(tempRepoRoot);
      const inspected = expectInspectedDocument(await inspectDocument(workspace, bundle, documentPath));

      expect(inspected.resource.path).toBe(documentPath);
      expect(inspected.resource.uri).toBe(`sdd://document/${documentPath}/inspect`);
      expect(inspected.resource.effective_version).toBe("0.1");
      expect(inspected.resource.diagnostics).toEqual([]);

      expect(inspected.resource.top_level_order).toHaveLength(2);
      expect(inspected.resource.nodes.map((node) => node.node_id)).toEqual(["P-100", "P-110", "P-200"]);
      expect(inspected.resource.nodes.map((node) => node.parent_handle)).toEqual([
        null,
        inspected.resource.nodes[0]?.handle,
        null
      ]);

      const parentNode = inspected.resource.nodes[0]!;
      const childNode = inspected.resource.nodes[1]!;
      const secondTopLevelNode = inspected.resource.nodes[2]!;

      expect(parentNode.body_stream).toEqual(inspected.resource.body_items
        .filter((item) => item.parent_handle === parentNode.handle && item.order_index >= 0)
        .map((item) => item.handle));
      expect(parentNode.body_stream).toHaveLength(5);
      expect(parentNode.structural_order_streams).toEqual({
        CONTAINS: [parentNode.body_stream[1]!],
        COMPOSED_OF: [parentNode.body_stream[4]!]
      });
      expect(childNode.body_stream).toHaveLength(1);
      expect(childNode.structural_order_streams).toEqual({});
      expect(secondTopLevelNode.body_stream).toHaveLength(1);

      const parentBodyItems = inspected.resource.body_items.filter((item) => item.parent_handle === parentNode.handle);
      expect(parentBodyItems.map((item) => item.kind)).toEqual([
        "property_line",
        "edge_line",
        "edge_line",
        "node_block",
        "edge_line"
      ]);
      expect(parentBodyItems.map((item) => item.order_index)).toEqual([0, 1, 2, 3, 4]);
      expect(parentBodyItems[0]?.property).toEqual({
        key: "owner",
        value_kind: "bare_value",
        raw_value: "Design"
      });
      expect(parentBodyItems[1]?.edge?.rel_type).toBe("CONTAINS");
      expect(parentBodyItems[1]?.edge?.structural_order_index).toBe(0);
      expect(parentBodyItems[2]?.edge?.rel_type).toBe("MEASURED_BY");
      expect(parentBodyItems[2]?.edge?.structural_order_index).toBeNull();
      expect(parentBodyItems[3]).toEqual({
        handle: childNode.handle,
        kind: "node_block",
        parent_handle: parentNode.handle,
        order_index: 3
      });
      expect(parentBodyItems[4]?.edge?.rel_type).toBe("COMPOSED_OF");
      expect(parentBodyItems[4]?.edge?.structural_order_index).toBe(0);

      const childBodyItems = inspected.resource.body_items.filter((item) => item.parent_handle === childNode.handle);
      expect(childBodyItems).toEqual([
        {
          handle: childNode.body_stream[0],
          kind: "property_line",
          parent_handle: childNode.handle,
          order_index: 0,
          property: {
            key: "owner",
            value_kind: "bare_value",
            raw_value: "Ops"
          }
        }
      ]);

      expect(inspected.resource.body_items.some((item) => "rawText" in item)).toBe(false);
      expect(inspected.resource.body_items.every((item) => item.kind !== "comment_line")).toBe(true);

      expect(commentTexts(inspected, parentNode.handle, "leading")).toEqual(["lead comment", "after version"]);
      expect(blankLineCount(inspected, parentNode.handle, "leading")).toBe(2);
      expect(commentTexts(inspected, parentBodyItems[0]!.handle, "leading")).toEqual(["before owner"]);
      expect(blankLineCount(inspected, parentBodyItems[1]!.handle, "leading")).toBe(1);
      expect(commentTexts(inspected, childNode.handle, "leading")).toEqual(["before child block"]);
      expect(commentTexts(inspected, childBodyItems[0]!.handle, "leading")).toEqual(["child owner comment"]);
      expect(blankLineCount(inspected, parentBodyItems[4]!.handle, "leading")).toBe(1);
      expect(commentTexts(inspected, parentBodyItems[4]!.handle, "leading")).toEqual(["before component edge"]);
      expect(commentTexts(inspected, secondTopLevelNode.handle, "leading")).toEqual(["between top-level nodes"]);
      expect(blankLineCount(inspected, secondTopLevelNode.handle, "leading")).toBe(1);
      expect(commentTexts(inspected, secondTopLevelNode.handle, "trailing")).toEqual(["trailing top-level comment"]);
      expect(blankLineCount(inspected, secondTopLevelNode.handle, "trailing")).toBe(2);

      expect(Array.from(inspected.handleIndex.keys()).sort()).toEqual(
        [
          ...inspected.resource.nodes.map((node) => node.handle),
          ...inspected.resource.body_items
            .filter((item) => item.kind !== "node_block")
            .map((item) => item.handle)
        ].sort()
      );
    });
  });

  it("returns identical handles for repeated reads of the same revision", async () => {
    await withTempRepo(async (tempRepoRoot) => {
      const documentPath = "docs/repeated.sdd";
      await writeTempDocument(
        tempRepoRoot,
        documentPath,
        [
          "Place P-001 \"Home\"",
          "  owner=Design",
          "  CONTAINS P-002 \"Child\"",
          "  + Place P-002 \"Child\"",
          "    owner=Ops",
          "  END",
          "END",
          ""
        ].join("\n")
      );

      const workspace = createAuthoringWorkspace(tempRepoRoot);
      const firstRead = expectInspectedDocument(await inspectDocument(workspace, bundle, documentPath));
      const secondRead = expectInspectedDocument(await inspectDocument(workspace, bundle, documentPath));

      expect(secondRead.resource.revision).toBe(firstRead.resource.revision);
      expect(secondRead.resource.top_level_order).toEqual(firstRead.resource.top_level_order);
      expect(secondRead.resource.nodes.map((node) => node.handle)).toEqual(firstRead.resource.nodes.map((node) => node.handle));
      expect(secondRead.resource.body_items.map((item) => item.handle)).toEqual(firstRead.resource.body_items.map((item) => item.handle));
    });
  });

  it("invalidates the entire handle namespace when the revision changes", async () => {
    await withTempRepo(async (tempRepoRoot) => {
      const documentPath = "docs/revision-change.sdd";
      const originalText = [
        "Place P-001 \"Home\"",
        "  owner=Design",
        "END",
        ""
      ].join("\n");
      await writeTempDocument(tempRepoRoot, documentPath, originalText);

      const workspace = createAuthoringWorkspace(tempRepoRoot);
      const beforeChange = expectInspectedDocument(await inspectDocument(workspace, bundle, documentPath));

      await writeTempDocument(
        tempRepoRoot,
        documentPath,
        [
          "Place P-001 \"Home\"",
          "  owner=Design",
          "END",
          "",
          "# appended comment",
          ""
        ].join("\n")
      );

      const afterChange = expectInspectedDocument(await inspectDocument(workspace, bundle, documentPath));
      expect(afterChange.resource.revision).not.toBe(beforeChange.resource.revision);

      const beforeHandles = new Set([
        ...beforeChange.resource.nodes.map((node) => node.handle),
        ...beforeChange.resource.body_items.map((item) => item.handle)
      ]);
      const afterHandles = new Set([
        ...afterChange.resource.nodes.map((node) => node.handle),
        ...afterChange.resource.body_items.map((item) => item.handle)
      ]);
      const overlappingHandles = [...beforeHandles].filter((handle) => afterHandles.has(handle));

      expect(overlappingHandles).toEqual([]);
      expect(afterChange.resource.nodes[0]?.node_id).toBe(beforeChange.resource.nodes[0]?.node_id);
      expect(afterChange.resource.nodes[0]?.handle).not.toBe(beforeChange.resource.nodes[0]?.handle);
    });
  });

  it("inspects parse-valid compile-invalid documents without compile diagnostics or failures", async () => {
    const workspace = createAuthoringWorkspace(repoRoot);
    const inspected = expectInspectedDocument(
      await inspectDocument(workspace, bundle, "tests/fixtures/invalid/duplicate_node_id.sdd")
    );

    expect(inspected.resource.path).toBe("tests/fixtures/invalid/duplicate_node_id.sdd");
    expect(inspected.resource.diagnostics).toEqual([]);
    expect(inspected.resource.nodes.map((node) => node.node_id)).toEqual(["P-001", "P-001"]);
    expect(inspected.resource.top_level_order).toHaveLength(2);
  });

  it("returns an inspect load failure with repo-relative parse diagnostics when parsing fails", async () => {
    const workspace = createAuthoringWorkspace(repoRoot);
    const result = await inspectDocument(workspace, bundle, "tests/fixtures/invalid/missing_end.sdd");

    expect(result.kind).toBe("sdd-inspect-load-failure");
    if (result.kind !== "sdd-inspect-load-failure") {
      throw new Error("Expected inspect load failure.");
    }

    expect(result.path).toBe("tests/fixtures/invalid/missing_end.sdd");
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === "parse.missing_end")).toBe(true);
    expect(result.diagnostics.every((diagnostic) => diagnostic.file === "tests/fixtures/invalid/missing_end.sdd")).toBe(true);
    expect(result.revision).toBeTypeOf("string");
  });

  it("uses the checked-in duplicate-id fixture text unchanged for the compile-invalid inspect case", async () => {
    const fixtureText = await readFile(path.join(repoRoot, "tests/fixtures/invalid/duplicate_node_id.sdd"), "utf8");
    expect(fixtureText).toContain("Place P-001 \"Billing\"");
    expect(fixtureText).toContain("Place P-001 \"Billing Again\"");
  });
});
