import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import type { Bundle } from "../src/bundle/types.js";
import { projectDocument, validateDocument } from "../src/authoring/readServices.js";
import { createAuthoringWorkspace } from "../src/authoring/workspace.js";
import { loadBundle } from "../src/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

let bundle: Bundle;

beforeAll(async () => {
  bundle = await loadBundle(manifestPath);
});

async function withTempRepo(run: (repoRootPath: string) => Promise<void>): Promise<void> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "sdd-authoring-read-services-"));
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

describe("authoring read services", () => {
  it("returns ValidationResource for the current persisted document", async () => {
    await withTempRepo(async (tempRepoRoot) => {
      const workspace = createAuthoringWorkspace(tempRepoRoot);
      await copyFixture(tempRepoRoot, "tests/fixtures/invalid/invalid_place_access.sdd", "docs/validate.sdd");

      const result = await validateDocument(workspace, bundle, {
        path: "docs/validate.sdd",
        profile_id: "strict"
      });

      expect(result).toMatchObject({
        kind: "sdd-validation",
        path: "docs/validate.sdd",
        profile_id: "strict",
        report: {
          error_count: expect.any(Number),
          warning_count: expect.any(Number)
        }
      });
      expect(result.diagnostics.some((diagnostic) => diagnostic.code === "validate.place_access_format")).toBe(true);
    });
  });

  it("keeps parse-invalid validation reads structured instead of throwing helper-style errors", async () => {
    await withTempRepo(async (tempRepoRoot) => {
      const workspace = createAuthoringWorkspace(tempRepoRoot);
      await writeTempDocument(
        tempRepoRoot,
        "docs/parse-invalid.sdd",
        ["SDD-TEXT 0.1", "Place P-001 \"Broken\"", "  owner=Team"].join("\n")
      );

      const result = await validateDocument(workspace, bundle, {
        path: "docs/parse-invalid.sdd",
        profile_id: "strict"
      });

      expect(result.kind).toBe("sdd-validation");
      expect(result.report).toBeUndefined();
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics.some((diagnostic) => diagnostic.stage === "parse")).toBe(true);
    });
  });

  it("keeps compile-invalid projection reads structured instead of throwing helper-style errors", async () => {
    await withTempRepo(async (tempRepoRoot) => {
      const workspace = createAuthoringWorkspace(tempRepoRoot);
      await copyFixture(tempRepoRoot, "tests/fixtures/invalid/duplicate_node_id.sdd", "docs/duplicate.sdd");

      const result = await projectDocument(workspace, bundle, {
        path: "docs/duplicate.sdd",
        view_id: "ia_place_map"
      });

      expect(result).toMatchObject({
        kind: "sdd-projection",
        path: "docs/duplicate.sdd",
        view_id: "ia_place_map"
      });
      expect(result.projection).toBeUndefined();
      expect(result.diagnostics.some((diagnostic) => diagnostic.code === "compile.duplicate_node_id")).toBe(true);
    });
  });
});
