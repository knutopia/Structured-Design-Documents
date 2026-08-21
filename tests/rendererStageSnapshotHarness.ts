import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";
import { normalizeLineEndings } from "./textNormalization.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rendererStageGoldensRoot = path.join(repoRoot, "tests", "goldens", "renderer-stages");

function stripStage4SceneIdentity(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripStage4SceneIdentity);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "profileId" && key !== "detailId")
        .map(([key, entry]) => [key, stripStage4SceneIdentity(entry)])
    );
  }
  return value;
}

function normalizeStage4SvgIdentity(value: string): string {
  return value
    .replace(/\sdata-(?:profile|detail)-id="[^"]*"/g, "")
    .replace(/class="([^"]*)"/g, (_match, classes: string) => {
      const retained = classes
        .split(/\s+/)
        .filter((token) => token && !token.startsWith("profile-") && !token.startsWith("detail-"));
      return `class="${retained.join(" ")}"`;
    });
}

export async function expectRendererStageSnapshot(snapshotFileName: string, value: unknown): Promise<void> {
  const expected = await readFile(path.join(rendererStageGoldensRoot, snapshotFileName), "utf8");
  expect(normalizeLineEndings(JSON.stringify(stripStage4SceneIdentity(value), null, 2))).toBe(
    normalizeLineEndings(JSON.stringify(stripStage4SceneIdentity(JSON.parse(expected)), null, 2))
  );
}

export async function expectRendererStageTextSnapshot(snapshotFileName: string, value: string): Promise<void> {
  const expected = await readFile(path.join(rendererStageGoldensRoot, snapshotFileName), "utf8");
  expect(normalizeLineEndings(normalizeStage4SvgIdentity(value))).toBe(
    normalizeLineEndings(normalizeStage4SvgIdentity(expected)).trimEnd()
  );
}
