import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  discoverCuratedRenderedExamplePairs,
  expandCuratedRenderedExampleVariants,
  getRenderedCorpusRoot,
  planRenderedCorpusOutputPaths
} from "../src/examples/renderedCorpus.js";
import { loadBundle } from "../src/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

describe("rendered example corpus", () => {
  it("contains every committed artifact for each curated render pair", async () => {
    const bundle = await loadBundle(manifestPath);
    const discovery = await discoverCuratedRenderedExamplePairs(bundle);
    const variants = expandCuratedRenderedExampleVariants(bundle, discovery.pairs);

    await access(path.join(getRenderedCorpusRoot(bundle), "README.md"));

    for (const variant of variants) {
      const outputPaths = planRenderedCorpusOutputPaths(bundle, variant);
      expect(path.basename(path.dirname(outputPaths.exampleDir))).toMatch(/_diagram_type$/);
      expect(path.basename(outputPaths.exampleDir)).toMatch(/_example$/);
      expect(path.basename(outputPaths.profileDir)).toMatch(/_profile$/);
      await access(outputPaths.sourceOutputPath);
      await access(outputPaths.dotOutputPath);
      await access(outputPaths.mermaidOutputPath);
      await access(outputPaths.svgOutputPath);
      await access(outputPaths.pngOutputPath);

      const copiedSource = await readFile(outputPaths.sourceOutputPath, "utf8");
      const canonicalSource = await readFile(variant.example.absolutePath, "utf8");
      expect(copiedSource).toBe(canonicalSource);
    }
  });

  it("keeps committed ui_contracts SVG previews free of visible newline escapes", async () => {
    const bundle = await loadBundle(manifestPath);
    const discovery = await discoverCuratedRenderedExamplePairs(bundle);
    const variants = expandCuratedRenderedExampleVariants(bundle, discovery.pairs);
    const targetVariant = variants.find((variant) => (
      variant.viewId === "ui_contracts"
      && variant.example.name === "place_viewstate_transition"
      && variant.profileId === "permissive"
    ));

    expect(targetVariant).toBeDefined();

    const outputPaths = planRenderedCorpusOutputPaths(bundle, targetVariant!);
    const svg = await readFile(outputPaths.svgOutputPath, "utf8");
    expect(svg).not.toContain("Billing\\n/billing\\n[auth]");
    expect(svg).not.toContain("Billing Editing\\ndata: PaymentMethod");
  });
});
