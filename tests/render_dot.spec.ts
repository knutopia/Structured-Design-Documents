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

describe("renderSource dot", () => {
  it("renders curated manifest-backed views to stable DOT output", async () => {
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
      const golden = await readFile(outputPaths.dotOutputPath, "utf8");
      const result = renderSource(input, bundle, {
        viewId: variant.viewId,
        format: "dot",
        profileId: variant.profileId
      });
      expect(result.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
      expect(normalizeLineEndings(result.text!)).toBe(normalizeLineEndings(golden).trimEnd());
    }
  });

  it("single-escapes multiline ui_contracts labels in DOT output", async () => {
    const bundle = await loadBundle(manifestPath);
    const examplePath = path.join(repoRoot, "bundle/v0.1/examples/place_viewstate_transition.sdd");
    const input = {
      path: examplePath,
      text: await readFile(examplePath, "utf8")
    };

    const result = renderSource(input, bundle, {
      viewId: "ui_contracts",
      format: "dot",
      profileId: "permissive"
    });

    expect(result.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(result.text).toContain('label="Billing\\n/billing\\n[auth]"');
    expect(result.text).not.toContain('label="Billing\\\\n/billing\\\\n[auth]"');
    expect(result.text).toContain('label="Billing Editing\\ndata: PaymentMethod"');
    expect(result.text).not.toContain('label="Billing Editing\\\\ndata: PaymentMethod"');
  });
});
