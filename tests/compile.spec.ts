import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

describe("compileSource", () => {
  it("matches the compiled snapshots for all manifest examples", async () => {
    const bundle = await loadBundle(manifestPath);

    for (const example of bundle.manifest.examples) {
      const examplePath = path.join(bundle.rootDir, example.path);
      const snapshotPath = path.join(bundle.rootDir, example.compiled_snapshot);
      const input = {
        path: examplePath,
        text: await readFile(examplePath, "utf8")
      };
      const expectedSnapshot = await readFile(snapshotPath, "utf8");

      const result = compileSource(input, bundle);
      expect(result.diagnostics).toEqual([]);
      expect(JSON.stringify(result.graph, null, 2)).toBe(expectedSnapshot.trimEnd());
    }
  });
});

