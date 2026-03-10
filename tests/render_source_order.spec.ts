import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadBundle, renderSource } from "../src/index.js";
import { normalizeLineEndings } from "./textNormalization.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");
const fixturePath = path.join(repoRoot, "tests/fixtures/render/source_order_ia.sdd");

describe("source-ordered IA rendering", () => {
  it("renders DOT using source order for top-level and contained siblings", async () => {
    const bundle = await loadBundle(manifestPath);
    const input = {
      path: fixturePath,
      text: await readFile(fixturePath, "utf8")
    };
    const golden = await readFile(path.join(repoRoot, "tests/goldens/source_order_ia.dot"), "utf8");

    const result = renderSource(input, bundle, {
      viewId: "ia_place_map",
      format: "dot",
      profileId: "simple"
    });

    expect(result.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(result.text).toContain(`[style=invis, weight=100]`);
    expect(normalizeLineEndings(result.text!)).toBe(normalizeLineEndings(golden).trimEnd());
  });

  it("renders Mermaid using source order for top-level and contained siblings", async () => {
    const bundle = await loadBundle(manifestPath);
    const input = {
      path: fixturePath,
      text: await readFile(fixturePath, "utf8")
    };
    const golden = await readFile(path.join(repoRoot, "tests/goldens/source_order_ia.mmd"), "utf8");

    const result = renderSource(input, bundle, {
      viewId: "ia_place_map",
      format: "mermaid",
      profileId: "simple"
    });

    expect(result.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(normalizeLineEndings(result.text!)).toBe(normalizeLineEndings(golden).trimEnd());
  });
});
