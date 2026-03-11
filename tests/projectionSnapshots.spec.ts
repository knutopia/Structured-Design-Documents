import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import { normalizeLineEndings } from "./textNormalization.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

describe("projectView projection snapshots", () => {
  it("matches every manifest-declared projection snapshot", async () => {
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

      for (const snapshotRelativePath of example.projection_snapshots ?? []) {
        const snapshotPath = path.join(bundle.rootDir, snapshotRelativePath);
        const expectedSnapshotText = await readFile(snapshotPath, "utf8");
        const expectedSnapshot = JSON.parse(expectedSnapshotText) as { view_id: string };
        const projected = projectView(compiled.graph!, bundle, expectedSnapshot.view_id);

        expect(projected.diagnostics).toEqual([]);
        expect(normalizeLineEndings(JSON.stringify(projected.projection, null, 2))).toBe(
          normalizeLineEndings(JSON.stringify(expectedSnapshot, null, 2)).trimEnd()
        );
      }
    }
  });
});
