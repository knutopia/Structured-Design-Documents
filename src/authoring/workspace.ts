import { access } from "node:fs/promises";
import path from "node:path";

const SDD_EXTENSION = ".sdd";
const STATE_ROOT_NAME = ".sdd-state";
const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[A-Za-z]:\//;

export class WorkspacePathError extends Error {
  readonly code = "sdd.path_out_of_scope";

  constructor(message: string) {
    super(message);
    this.name = "WorkspacePathError";
  }
}

export interface PublicPathOptions {
  allowDirectory?: boolean;
  requireSddExtension?: boolean;
}

export interface ResolvedWorkspacePath {
  publicPath: string;
  absolutePath: string;
}

export interface AuthoringWorkspace {
  readonly repoRoot: string;
  readonly stateRoot: string;
  normalizePublicPath(publicPath: string, options?: PublicPathOptions): string;
  normalizeDocumentPath(documentPath: string): string;
  resolvePublicPath(publicPath: string, options?: PublicPathOptions): ResolvedWorkspacePath;
  resolveDocumentPath(documentPath: string): ResolvedWorkspacePath;
  resolveStatePath(relativePath: string): string;
  toPublicPath(absolutePath: string): string;
}

export type RepoRootExists = (candidatePath: string) => Promise<boolean>;

function assertNonEmptyPath(candidate: string, description: string): void {
  if (candidate.trim().length === 0) {
    throw new WorkspacePathError(`${description} must not be empty.`);
  }
}

function assertRepoRelativePath(candidate: string, description: string): void {
  if (candidate.startsWith("/") || candidate.startsWith("//") || WINDOWS_ABSOLUTE_PATH_PATTERN.test(candidate)) {
    throw new WorkspacePathError(`${description} must be repo-relative.`);
  }
}

function assertWithinBase(basePath: string, targetPath: string, description: string): void {
  const relative = path.relative(basePath, targetPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new WorkspacePathError(`${description} escapes the configured repo root.`);
  }
}

function normalizeRelativePath(candidate: string, description: string, options: PublicPathOptions = {}): string {
  assertNonEmptyPath(candidate, description);
  const slashNormalized = candidate.replace(/\\/g, "/");
  assertRepoRelativePath(slashNormalized, description);

  const normalized = path.posix.normalize(slashNormalized);
  if (normalized === ".." || normalized.startsWith("../")) {
    throw new WorkspacePathError(`${description} must stay within the configured repo root.`);
  }

  if (normalized === "." && !options.allowDirectory) {
    throw new WorkspacePathError(`${description} must identify a repo-relative path.`);
  }

  if (options.requireSddExtension && !normalized.endsWith(SDD_EXTENSION)) {
    throw new WorkspacePathError(`${description} must target a ${SDD_EXTENSION} file.`);
  }

  return normalized;
}

function resolveFromBase(basePath: string, relativePath: string, description: string): string {
  const segments = relativePath === "." ? [] : relativePath.split("/");
  const absolutePath = path.resolve(basePath, ...segments);
  assertWithinBase(basePath, absolutePath, description);
  return absolutePath;
}

async function defaultPathExists(candidatePath: string): Promise<boolean> {
  try {
    await access(candidatePath);
    return true;
  } catch {
    return false;
  }
}

export async function looksLikeAuthoringRepoRoot(
  candidatePath: string,
  pathExists: RepoRootExists = defaultPathExists
): Promise<boolean> {
  return (
    (await pathExists(path.join(candidatePath, "package.json"))) &&
    (await pathExists(path.join(candidatePath, "bundle/v0.1/manifest.yaml")))
  );
}

export async function findAuthoringRepoRoot(
  startDir: string,
  pathExists: RepoRootExists = defaultPathExists
): Promise<string | null> {
  let currentDir = path.resolve(startDir);

  while (currentDir !== path.dirname(currentDir)) {
    if (await looksLikeAuthoringRepoRoot(currentDir, pathExists)) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }

  return (await looksLikeAuthoringRepoRoot(currentDir, pathExists)) ? currentDir : null;
}

export function createAuthoringWorkspace(repoRoot: string): AuthoringWorkspace {
  const normalizedRepoRoot = path.resolve(repoRoot);
  const stateRoot = path.join(normalizedRepoRoot, STATE_ROOT_NAME);

  function normalizePublicPath(publicPath: string, options: PublicPathOptions = {}): string {
    return normalizeRelativePath(publicPath, "Public path", options);
  }

  function normalizeDocumentPath(documentPath: string): string {
    return normalizePublicPath(documentPath, { requireSddExtension: true });
  }

  function resolvePublicPath(publicPath: string, options: PublicPathOptions = {}): ResolvedWorkspacePath {
    const normalizedPath = normalizePublicPath(publicPath, options);
    return {
      publicPath: normalizedPath,
      absolutePath: resolveFromBase(normalizedRepoRoot, normalizedPath, "Public path")
    };
  }

  function resolveDocumentPath(documentPath: string): ResolvedWorkspacePath {
    return resolvePublicPath(documentPath, { requireSddExtension: true });
  }

  function resolveStatePath(relativePath: string): string {
    const normalizedPath = normalizeRelativePath(relativePath, "State path");
    return resolveFromBase(stateRoot, normalizedPath, "State path");
  }

  function toPublicPath(absolutePath: string): string {
    const resolvedPath = path.resolve(absolutePath);
    assertWithinBase(normalizedRepoRoot, resolvedPath, "Absolute path");
    const relativePath = path.relative(normalizedRepoRoot, resolvedPath);
    return relativePath.split(path.sep).join("/");
  }

  return {
    repoRoot: normalizedRepoRoot,
    stateRoot,
    normalizePublicPath,
    normalizeDocumentPath,
    resolvePublicPath,
    resolveDocumentPath,
    resolveStatePath,
    toPublicPath
  };
}
