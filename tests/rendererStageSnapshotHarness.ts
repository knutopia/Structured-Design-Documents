import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";
import { normalizeLineEndings } from "./textNormalization.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rendererStageGoldensRoot = path.join(repoRoot, "tests", "goldens", "renderer-stages");

export async function expectRendererStageSnapshot(snapshotFileName: string, value: unknown): Promise<void> {
  const expected = await readFile(path.join(rendererStageGoldensRoot, snapshotFileName), "utf8");
  expect(normalizeLineEndings(JSON.stringify(value, null, 2))).toBe(normalizeLineEndings(expected).trimEnd());
}
