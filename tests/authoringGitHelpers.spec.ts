import { execFile as execFileCallback } from "node:child_process";
import { mkdir, mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { getGitStatus, gitCommit } from "../src/authoring/git.js";
import { createAuthoringWorkspace } from "../src/authoring/workspace.js";

const execFile = promisify(execFileCallback);

async function withTempRepo(run: (repoRootPath: string) => Promise<void>): Promise<void> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "sdd-authoring-git-helpers-"));
  try {
    await run(tempRoot);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function runGit(repoRootPath: string, args: string[]): Promise<string> {
  const result = await execFile("git", args, {
    cwd: repoRootPath,
    encoding: "utf8"
  });
  return result.stdout;
}

async function writeRepoFile(repoRootPath: string, relativePath: string, content: string): Promise<void> {
  const absolutePath = path.join(repoRootPath, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, "utf8");
}

describe("authoring git helpers", () => {
  it("reports all in-scope .sdd paths while keeping status entries sparse and destination-oriented", async () => {
    await withTempRepo(async (tempRepoRoot) => {
      await runGit(tempRepoRoot, ["init", "-q"]);
      await runGit(tempRepoRoot, ["config", "user.email", "test@example.com"]);
      await runGit(tempRepoRoot, ["config", "user.name", "Test User"]);
      await writeRepoFile(tempRepoRoot, "docs/one.sdd", "SDD-TEXT 0.1\nPlace P-001 \"One\"\nEND\n");
      await writeRepoFile(tempRepoRoot, "docs/clean.sdd", "SDD-TEXT 0.1\nPlace P-010 \"Clean\"\nEND\n");
      await writeRepoFile(tempRepoRoot, "docs/deleted.sdd", "SDD-TEXT 0.1\nPlace P-020 \"Deleted\"\nEND\n");
      await writeRepoFile(tempRepoRoot, "notes.txt", "hello\n");
      await runGit(tempRepoRoot, ["add", "docs/one.sdd", "docs/clean.sdd", "docs/deleted.sdd", "notes.txt"]);
      await runGit(tempRepoRoot, ["commit", "-q", "-m", "init"]);

      await runGit(tempRepoRoot, ["mv", "docs/one.sdd", "docs/two.sdd"]);
      await unlink(path.join(tempRepoRoot, "docs/deleted.sdd"));
      await writeRepoFile(tempRepoRoot, "notes.txt", "changed\n");

      const workspace = createAuthoringWorkspace(tempRepoRoot);
      const status = await getGitStatus(workspace);

      expect(status.kind).toBe("sdd-git-status");
      expect(status.paths).toEqual(["docs/clean.sdd", "docs/deleted.sdd", "docs/two.sdd"]);
      expect(status.status).toEqual([
        {
          path: "docs/deleted.sdd",
          index_status: " ",
          worktree_status: "D"
        },
        {
          path: "docs/two.sdd",
          index_status: "R",
          worktree_status: " "
        }
      ]);
    });
  });

  it("keeps explicit git-status scope unchanged", async () => {
    await withTempRepo(async (tempRepoRoot) => {
      await runGit(tempRepoRoot, ["init", "-q"]);
      await runGit(tempRepoRoot, ["config", "user.email", "test@example.com"]);
      await runGit(tempRepoRoot, ["config", "user.name", "Test User"]);
      await writeRepoFile(tempRepoRoot, "docs/clean.sdd", "SDD-TEXT 0.1\nPlace P-001 \"Clean\"\nEND\n");
      await writeRepoFile(tempRepoRoot, "docs/changed.sdd", "SDD-TEXT 0.1\nPlace P-002 \"Changed\"\nEND\n");
      await runGit(tempRepoRoot, ["add", "docs/clean.sdd", "docs/changed.sdd"]);
      await runGit(tempRepoRoot, ["commit", "-q", "-m", "init"]);

      await writeRepoFile(tempRepoRoot, "docs/changed.sdd", "SDD-TEXT 0.1\nPlace P-002 \"Updated\"\nEND\n");

      const workspace = createAuthoringWorkspace(tempRepoRoot);
      const status = await getGitStatus(workspace, ["docs/clean.sdd"]);

      expect(status).toEqual({
        kind: "sdd-git-status",
        paths: ["docs/clean.sdd"],
        status: []
      });
    });
  });

  it("commits only explicit .sdd paths and leaves unrelated changes untouched", async () => {
    await withTempRepo(async (tempRepoRoot) => {
      await runGit(tempRepoRoot, ["init", "-q"]);
      await runGit(tempRepoRoot, ["config", "user.email", "test@example.com"]);
      await runGit(tempRepoRoot, ["config", "user.name", "Test User"]);
      await writeRepoFile(tempRepoRoot, "docs/example.sdd", "SDD-TEXT 0.1\nPlace P-001 \"One\"\nEND\n");
      await writeRepoFile(tempRepoRoot, "notes.txt", "hello\n");
      await runGit(tempRepoRoot, ["add", "docs/example.sdd", "notes.txt"]);
      await runGit(tempRepoRoot, ["commit", "-q", "-m", "init"]);

      await writeRepoFile(tempRepoRoot, "docs/example.sdd", "SDD-TEXT 0.1\nPlace P-001 \"Two\"\nEND\n");
      await writeRepoFile(tempRepoRoot, "notes.txt", "changed\n");
      await runGit(tempRepoRoot, ["add", "notes.txt"]);

      const workspace = createAuthoringWorkspace(tempRepoRoot);
      const committed = await gitCommit(workspace, "update sdd", ["docs/example.sdd"]);

      expect(committed.kind).toBe("sdd-git-commit");
      expect(committed.committed_paths).toEqual(["docs/example.sdd"]);
      expect(committed.commit_sha).toMatch(/^[0-9a-f]{40}$/u);

      const headNames = await runGit(tempRepoRoot, ["show", "--format=", "--name-only", "HEAD"]);
      expect(headNames.trim().split("\n")).toEqual(["docs/example.sdd"]);

      const statusAfter = await runGit(tempRepoRoot, ["status", "--short"]);
      expect(statusAfter).toContain("M  notes.txt");
      expect(statusAfter).not.toContain("docs/example.sdd");
    });
  });
});
