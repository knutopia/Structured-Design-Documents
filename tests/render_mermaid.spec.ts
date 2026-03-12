import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  discoverCuratedRenderedExamplePairs,
  expandCuratedRenderedExampleVariants,
  planRenderedCorpusOutputPaths
} from "../src/examples/renderedCorpus.js";
import { loadBundle, renderSource } from "../src/index.js";
import { normalizeLineEndings } from "./textNormalization.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

describe("renderSource mermaid", () => {
  it("renders curated manifest-backed views to stable Mermaid output", async () => {
    const bundle = await loadBundle(manifestPath);
    const discovery = await discoverCuratedRenderedExamplePairs(bundle);
    const variants = expandCuratedRenderedExampleVariants(bundle, discovery.pairs);

    for (const variant of variants) {
      const outputPaths = planRenderedCorpusOutputPaths(bundle, variant);
      const examplePath = variant.example.absolutePath;
      const input = {
        path: examplePath,
        text: await readFile(examplePath, "utf8")
      };
      const golden = await readFile(outputPaths.mermaidOutputPath, "utf8");
      const result = renderSource(input, bundle, {
        viewId: variant.viewId,
        format: "mermaid",
        profileId: variant.profileId
      });
      expect(result.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
      expect(normalizeLineEndings(result.text!)).toBe(normalizeLineEndings(golden).trimEnd());
    }
  });
});
