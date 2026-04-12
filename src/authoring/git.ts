import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import type { DocumentPath, HelperGitCommitResult, HelperGitStatusResult } from "./contracts.js";
import { collectDocumentPaths } from "./documentPaths.js";
import type { AuthoringWorkspace } from "./workspace.js";

const execFile = promisify(execFileCallback);

export class AuthoringGitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthoringGitError";
  }
}

export interface AuthoringGitDeps {
  execFile?: typeof execFile;
}

interface GitRunResult {
  stdout: Buffer;
  stderr: Buffer;
}

async function runGit(
  workspace: AuthoringWorkspace,
  args: string[],
  deps: AuthoringGitDeps = {}
): Promise<GitRunResult> {
  const runner = deps.execFile ?? execFile;

  try {
    const result = await runner("git", args, {
      cwd: workspace.repoRoot,
      encoding: "buffer",
      maxBuffer: 10 * 1024 * 1024
    });

    return {
      stdout: result.stdout as Buffer,
      stderr: result.stderr as Buffer
    };
  } catch (error) {
    const execError = error as NodeJS.ErrnoException & {
      stdout?: Buffer | string;
      stderr?: Buffer | string;
    };
    const stderr = Buffer.isBuffer(execError.stderr)
      ? execError.stderr.toString("utf8")
      : typeof execError.stderr === "string"
        ? execError.stderr
        : "";
    const stdout = Buffer.isBuffer(execError.stdout)
      ? execError.stdout.toString("utf8")
      : typeof execError.stdout === "string"
        ? execError.stdout
        : "";
    const detail = stderr.trim() || stdout.trim() || execError.message;
    throw new AuthoringGitError(detail);
  }
}

function normalizeExplicitDocumentPaths(
  workspace: AuthoringWorkspace,
  paths: DocumentPath[]
): DocumentPath[] {
  return [...new Set(paths.map((documentPath) => workspace.normalizeDocumentPath(documentPath)))];
}

function parseStatusEntries(output: Buffer): HelperGitStatusResult["status"] {
  const entries: HelperGitStatusResult["status"] = [];
  let offset = 0;

  while (offset < output.length) {
    const recordTerminator = output.indexOf(0x00, offset);
    if (recordTerminator === -1) {
      break;
    }

    const record = output.subarray(offset, recordTerminator).toString("utf8");
    if (record.length < 3) {
      break;
    }

    const indexStatus = record[0] ?? " ";
    const worktreeStatus = record[1] ?? " ";
    let pathText = record.slice(3);
    offset = recordTerminator + 1;

    if (indexStatus === "R" || indexStatus === "C") {
      const sourceTerminator = output.indexOf(0x00, offset);
      if (sourceTerminator === -1) {
        break;
      }
      offset = sourceTerminator + 1;
    }

    if (pathText.startsWith("\"") && pathText.endsWith("\"")) {
      pathText = JSON.parse(pathText) as string;
    }

    entries.push({
      path: pathText,
      index_status: indexStatus,
      worktree_status: worktreeStatus
    });
  }

  return entries;
}

export async function getGitStatus(
  workspace: AuthoringWorkspace,
  paths: DocumentPath[] = [],
  deps: AuthoringGitDeps = {}
): Promise<HelperGitStatusResult> {
  const normalizedPaths = normalizeExplicitDocumentPaths(workspace, paths);
  const args = ["status", "--porcelain=1", "-z"];
  if (normalizedPaths.length > 0) {
    args.push("--", ...normalizedPaths);
  }

  const { stdout } = await runGit(workspace, args, deps);
  const entries = parseStatusEntries(stdout).filter((entry) =>
    normalizedPaths.length > 0 ? normalizedPaths.includes(entry.path) : entry.path.endsWith(".sdd")
  );
  const allPaths =
    normalizedPaths.length > 0
      ? normalizedPaths
      : [
          ...new Set([
            ...(await collectDocumentPaths(workspace)),
            ...entries.map((entry) => entry.path)
          ])
        ].sort((left, right) => left.localeCompare(right));

  return {
    kind: "sdd-git-status",
    paths: allPaths,
    status: entries
  };
}

export async function gitCommit(
  workspace: AuthoringWorkspace,
  message: string,
  paths: DocumentPath[],
  deps: AuthoringGitDeps = {}
): Promise<HelperGitCommitResult> {
  const normalizedPaths = normalizeExplicitDocumentPaths(workspace, paths);

  if (normalizedPaths.length === 0) {
    throw new AuthoringGitError("At least one explicit .sdd path is required for git-commit.");
  }

  await runGit(workspace, ["add", "--", ...normalizedPaths], deps);
  await runGit(workspace, ["commit", "--message", message, "--", ...normalizedPaths], deps);
  const { stdout } = await runGit(workspace, ["rev-parse", "HEAD"], deps);

  return {
    kind: "sdd-git-commit",
    committed_paths: normalizedPaths,
    commit_sha: stdout.toString("utf8").trim()
  };
}
