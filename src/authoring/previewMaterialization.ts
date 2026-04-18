import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PreviewArtifactResult } from "../renderer/previewBackends.js";

export const DEFAULT_PREVIEW_ARTIFACT_ROOT = "/tmp/unique-previews";
export const DEFAULT_PREVIEW_ARTIFACT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface PreviewArtifactMaterializationOptions {
  tempRoot?: string;
  now?: Date;
  maxArtifactAgeMs?: number;
}

export class PreviewMaterializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PreviewMaterializationError";
  }
}

function buildTimestampPrefix(now: Date): string {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z").replace("T", "-");
}

export function validatePreviewArtifactBasename(
  artifactBasename: string,
  format: PreviewArtifactResult["format"]
): string | undefined {
  if (artifactBasename.length === 0) {
    return "artifact basename must be a non-empty basename.";
  }
  if (artifactBasename.includes("/") || artifactBasename.includes("\\")) {
    return "artifact basename must be a basename without path separators.";
  }
  if (artifactBasename === "." || artifactBasename === ".." || artifactBasename.includes("..")) {
    return "artifact basename must not contain '..'.";
  }

  const expectedExtension = `.${format}`;
  if (path.extname(artifactBasename).toLowerCase() !== expectedExtension) {
    return `artifact basename must end with '${expectedExtension}' to match format '${format}'.`;
  }

  return undefined;
}

async function pruneStalePreviewArtifacts(
  tempRoot: string,
  now: Date,
  maxArtifactAgeMs: number
): Promise<void> {
  const entries = await readdir(tempRoot, { withFileTypes: true });
  const cutoffMs = now.getTime() - maxArtifactAgeMs;

  await Promise.all(entries.map(async (entry) => {
    if (!entry.isDirectory()) {
      return;
    }

    const entryPath = path.join(tempRoot, entry.name);
    const entryStat = await stat(entryPath);
    if (entryStat.mtimeMs < cutoffMs) {
      await rm(entryPath, { recursive: true, force: true });
    }
  }));
}

export async function materializePreviewArtifact(
  artifact: PreviewArtifactResult,
  artifactBasename: string,
  options: PreviewArtifactMaterializationOptions = {}
): Promise<string> {
  const tempRoot = options.tempRoot ?? DEFAULT_PREVIEW_ARTIFACT_ROOT;
  const now = options.now ?? new Date();
  const maxArtifactAgeMs = options.maxArtifactAgeMs ?? DEFAULT_PREVIEW_ARTIFACT_MAX_AGE_MS;
  const validationError = validatePreviewArtifactBasename(artifactBasename, artifact.format);
  if (validationError) {
    throw new PreviewMaterializationError(validationError);
  }

  await mkdir(tempRoot, { recursive: true });
  try {
    await pruneStalePreviewArtifacts(tempRoot, now, maxArtifactAgeMs);
  } catch {
    // Cleanup is best-effort; a stale temp file should not block the current preview.
  }

  const materializationDir = await mkdtemp(path.join(tempRoot, `${buildTimestampPrefix(now)}-`));
  const artifactPath = path.join(materializationDir, artifactBasename);

  if (artifact.format === "svg") {
    await writeFile(artifactPath, artifact.text, "utf8");
  } else {
    await writeFile(artifactPath, artifact.bytes);
  }

  return artifactPath;
}
