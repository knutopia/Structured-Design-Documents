import { readdir } from "node:fs/promises";
import path from "node:path";
import type { DocumentPath } from "./contracts.js";
import type { AuthoringWorkspace } from "./workspace.js";

const IGNORED_DIRECTORY_NAMES = new Set([".git", ".sdd-state", "node_modules", "dist"]);

export async function collectDocumentPaths(
  workspace: AuthoringWorkspace,
  relativeDirectory = "."
): Promise<DocumentPath[]> {
  const startPath = path.join(workspace.repoRoot, relativeDirectory === "." ? "" : relativeDirectory);
  const discovered: DocumentPath[] = [];

  async function walk(currentPath: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(currentPath, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return;
      }

      throw error;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORY_NAMES.has(entry.name)) {
          continue;
        }

        await walk(path.join(currentPath, entry.name));
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith(".sdd")) {
        continue;
      }

      discovered.push(workspace.toPublicPath(path.join(currentPath, entry.name)));
    }
  }

  await walk(startPath);
  return discovered.sort((left, right) => left.localeCompare(right));
}
