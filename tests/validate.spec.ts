import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle, validateGraph } from "../src/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

describe("validateGraph", () => {
  it("validates all manifest examples under the recommended profile with zero errors", async () => {
    const bundle = await loadBundle(manifestPath);

    for (const example of bundle.manifest.examples) {
      const examplePath = path.join(bundle.rootDir, example.path);
      const input = {
        path: examplePath,
        text: await readFile(examplePath, "utf8")
      };
      const compiled = compileSource(input, bundle);
      expect(compiled.graph).toBeDefined();
      expect(compiled.diagnostics).toEqual([]);

      const validation = validateGraph(compiled.graph!, bundle, "recommended");
      expect(validation.errorCount).toBe(0);
    }
  });
});

