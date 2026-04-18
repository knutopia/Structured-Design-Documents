import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import type { Bundle } from "../src/bundle/types.js";
import { listDocuments, searchGraph } from "../src/authoring/listing.js";
import { renderPreview } from "../src/authoring/preview.js";
import { DEFAULT_PREVIEW_ARTIFACT_ROOT } from "../src/authoring/previewMaterialization.js";
import { createAuthoringWorkspace } from "../src/authoring/workspace.js";
import { loadBundle } from "../src/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

let bundle: Bundle;

beforeAll(async () => {
  bundle = await loadBundle(manifestPath);
});

async function withTempRepo(run: (repoRootPath: string) => Promise<void>): Promise<void> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "sdd-authoring-directory-services-"));
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

async function copyFixture(repoRootPath: string, fixtureRelativePath: string, destinationPath: string): Promise<void> {
  const fixtureText = await readFile(path.join(repoRoot, fixtureRelativePath), "utf8");
  await writeTempDocument(repoRootPath, destinationPath, fixtureText);
}

describe("authoring directory services", () => {
  it("lists parseable .sdd documents in sorted order and surfaces diagnostics for skipped parse-invalid files", async () => {
    await withTempRepo(async (tempRepoRoot) => {
      await writeTempDocument(
        tempRepoRoot,
        "docs/b.sdd",
        ["SDD-TEXT 0.1", "Place P-002 \"Two\"", "END", ""].join("\n")
      );
      await writeTempDocument(
        tempRepoRoot,
        "docs/a.sdd",
        ["SDD-TEXT 0.1", "Place P-001 \"One\"", "END", ""].join("\n")
      );
      await writeTempDocument(
        tempRepoRoot,
        "docs/bad.sdd",
        ["SDD-TEXT 0.1", "Place P-003 \"Broken\"", ""].join("\n")
      );

      const workspace = createAuthoringWorkspace(tempRepoRoot);
      const result = await listDocuments(workspace, bundle, { under: "docs" });

      expect(result.documents.map((document) => document.path)).toEqual(["docs/a.sdd", "docs/b.sdd"]);
      expect(result.documents.map((document) => document.top_level_block_count)).toEqual([1, 1]);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics.every((diagnostic) => diagnostic.file === "docs/bad.sdd")).toBe(true);
    });
  });

  it("searches compile-valid graph content, skips compile-invalid files, and sorts matches deterministically", async () => {
    await withTempRepo(async (tempRepoRoot) => {
      await writeTempDocument(
        tempRepoRoot,
        "docs/b.sdd",
        ["SDD-TEXT 0.1", "Place P-002 \"Second Home\"", "END", ""].join("\n")
      );
      await writeTempDocument(
        tempRepoRoot,
        "docs/a.sdd",
        ["SDD-TEXT 0.1", "Place P-001 \"Home\"", "END", ""].join("\n")
      );
      await copyFixture(tempRepoRoot, "tests/fixtures/invalid/duplicate_node_id.sdd", "docs/duplicate.sdd");

      const workspace = createAuthoringWorkspace(tempRepoRoot);
      const result = await searchGraph(workspace, bundle, {
        query: "home",
        under: "docs"
      });

      expect(result.matches.map((match) => `${match.path}:${match.node_id}`)).toEqual([
        "docs/a.sdd:P-001",
        "docs/b.sdd:P-002"
      ]);
      expect(result.matches.every((match) => match.matched_on.includes("query"))).toBe(true);
      expect(result.diagnostics.some((diagnostic) => diagnostic.code === "compile.duplicate_node_id")).toBe(true);
    });
  });

  it("renders preview payloads with mapped svg and png artifacts", async () => {
    await withTempRepo(async (tempRepoRoot) => {
      await copyFixture(
        tempRepoRoot,
        "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
        "docs/outcome_to_ia_trace.sdd"
      );

      const workspace = createAuthoringWorkspace(tempRepoRoot);
      const svgResult = await renderPreview(workspace, bundle, {
        path: "docs/outcome_to_ia_trace.sdd",
        view_id: "ia_place_map",
        profile_id: "strict",
        format: "svg"
      });
      expect(svgResult.kind).toBe("sdd-preview");
      expect(Object.keys(svgResult)).toEqual([
        "kind",
        "path",
        "revision",
        "view_id",
        "profile_id",
        "backend_id",
        "format",
        "mime_type",
        "artifact_path",
        "notes",
        "diagnostics"
      ]);
      expect(svgResult.format).toBe("svg");
      expect(svgResult.mime_type).toBe("image/svg+xml");
      expect(svgResult.artifact_path.startsWith(`${DEFAULT_PREVIEW_ARTIFACT_ROOT}/`)).toBe(true);
      expect(path.basename(svgResult.artifact_path)).toBe("outcome_to_ia_trace.ia_place_map.strict.svg");
      expect(await readFile(svgResult.artifact_path, "utf8")).toContain("<svg");
      await rm(path.dirname(svgResult.artifact_path), { recursive: true, force: true });

      const pngResult = await renderPreview(workspace, bundle, {
        path: "docs/outcome_to_ia_trace.sdd",
        view_id: "ia_place_map",
        profile_id: "strict",
        format: "png"
      });
      expect(Object.keys(pngResult)).toEqual([
        "kind",
        "path",
        "revision",
        "view_id",
        "profile_id",
        "backend_id",
        "format",
        "mime_type",
        "artifact_path",
        "notes",
        "diagnostics"
      ]);
      expect(pngResult.format).toBe("png");
      expect(pngResult.mime_type).toBe("image/png");
      expect(pngResult.artifact_path.startsWith(`${DEFAULT_PREVIEW_ARTIFACT_ROOT}/`)).toBe(true);
      expect(path.basename(pngResult.artifact_path)).toBe("outcome_to_ia_trace.ia_place_map.strict.png");
      expect((await readFile(pngResult.artifact_path)).subarray(0, 4).toString("hex")).toBe("89504e47");
      await rm(path.dirname(pngResult.artifact_path), { recursive: true, force: true });

      const explicitBackendResult = await renderPreview(workspace, bundle, {
        path: "docs/outcome_to_ia_trace.sdd",
        view_id: "ia_place_map",
        profile_id: "strict",
        format: "svg",
        backend_id: "staged_ia_place_map_preview"
      });
      expect(path.basename(explicitBackendResult.artifact_path)).toBe(
        "outcome_to_ia_trace.ia_place_map.strict.staged_ia_place_map_preview.svg"
      );
      await rm(path.dirname(explicitBackendResult.artifact_path), { recursive: true, force: true });
    });
  });
});
