import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { formatJsonDiagnostics } from "../src/diagnostics/formatJson.js";
import { formatPrettyDiagnostics } from "../src/diagnostics/formatPretty.js";
import { validateGraph } from "../src/validator/validateGraph.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

async function fixtureInput(name: string) {
  const filePath = path.join(repoRoot, "tests/fixtures/invalid", name);
  return {
    path: filePath,
    text: await readFile(filePath, "utf8")
  };
}

describe("diagnostics", () => {
  it("reports syntax diagnostics for missing END", async () => {
    const bundle = await loadBundle(manifestPath);
    const result = compileSource(await fixtureInput("missing_end.sdd"), bundle);
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === "parse.missing_end")).toBe(true);
  });

  it("reports compile diagnostics for duplicate node ids", async () => {
    const bundle = await loadBundle(manifestPath);
    const result = compileSource(await fixtureInput("duplicate_node_id.sdd"), bundle);
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === "compile.duplicate_node_id")).toBe(true);
  });

  it("reports validation diagnostics for invalid place access", async () => {
    const bundle = await loadBundle(manifestPath);
    const compiled = compileSource(await fixtureInput("invalid_place_access.sdd"), bundle);
    expect(compiled.graph).toBeDefined();
    const validation = validateGraph(compiled.graph!, bundle, "recommended");
    expect(validation.diagnostics.some((diagnostic) => diagnostic.code === "validate.place_access_format")).toBe(true);
    expect(formatPrettyDiagnostics(validation.diagnostics)).toContain("validate.place_access_format");
    expect(formatJsonDiagnostics(validation.diagnostics)).toContain("\"validate.place_access_format\"");
  });
});

