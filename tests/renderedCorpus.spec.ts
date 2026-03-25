import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  discoverCuratedRenderedExamplePairs,
  expandCuratedRenderedExampleVariants,
  getRenderedCorpusPreviewOutputPath,
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

  it("keeps staged ia_place_map previews as the default corpus artifacts while preserving legacy preview siblings", async () => {
    const bundle = await loadBundle(manifestPath);
    const discovery = await discoverCuratedRenderedExamplePairs(bundle);
    const variants = expandCuratedRenderedExampleVariants(bundle, discovery.pairs).filter(
      (variant) => variant.viewId === "ia_place_map"
    );

    for (const variant of variants) {
      const outputPaths = planRenderedCorpusOutputPaths(bundle, variant);
      const defaultSvg = await readFile(outputPaths.svgOutputPath, "utf8");
      expect(defaultSvg).toContain('class="staged-svg');

      const legacySvgPath = getRenderedCorpusPreviewOutputPath(
        bundle,
        variant,
        "svg",
        "legacy_graphviz_preview",
        "staged_ia_place_map_preview"
      );
      const legacyPngPath = getRenderedCorpusPreviewOutputPath(
        bundle,
        variant,
        "png",
        "legacy_graphviz_preview",
        "staged_ia_place_map_preview"
      );

      await access(legacySvgPath);
      await access(legacyPngPath);

      const legacySvg = await readFile(legacySvgPath, "utf8");
      expect(legacySvg).not.toContain('class="staged-svg');
    }
  });

  it("keeps staged ui_contracts previews as the default corpus artifacts while preserving legacy preview siblings", async () => {
    const bundle = await loadBundle(manifestPath);
    const discovery = await discoverCuratedRenderedExamplePairs(bundle);
    const variants = expandCuratedRenderedExampleVariants(bundle, discovery.pairs).filter(
      (variant) => variant.viewId === "ui_contracts"
    );

    for (const variant of variants) {
      const outputPaths = planRenderedCorpusOutputPaths(bundle, variant);
      const defaultSvg = await readFile(outputPaths.svgOutputPath, "utf8");
      expect(defaultSvg).toContain('class="staged-svg');

      const legacySvgPath = getRenderedCorpusPreviewOutputPath(
        bundle,
        variant,
        "svg",
        "legacy_graphviz_preview",
        "staged_ui_contracts_preview"
      );
      const legacyPngPath = getRenderedCorpusPreviewOutputPath(
        bundle,
        variant,
        "png",
        "legacy_graphviz_preview",
        "staged_ui_contracts_preview"
      );

      await access(legacySvgPath);
      await access(legacyPngPath);

      const legacySvg = await readFile(legacySvgPath, "utf8");
      expect(legacySvg).not.toContain('class="staged-svg');
    }

    await expect(access(path.join(
      repoRoot,
      "examples/rendered/v0.1/ui_contracts_diagram_type/ui_state_fallback_example/recommended_profile/ui_state_fallback.ui_contracts_BROKEN.svg"
    ))).rejects.toThrow();
    await expect(access(path.join(
      repoRoot,
      "examples/rendered/v0.1/ui_contracts_diagram_type/place_viewstate_transition_example/recommended_profile/place_viewstate_transition.ui_contracts.external_anchor_experiment.svg"
    ))).rejects.toThrow();
    await expect(access(path.join(
      repoRoot,
      "examples/rendered/v0.1/ui_contracts_diagram_type/place_viewstate_transition_example/recommended_profile/place_viewstate_transition.ui_contracts.external_anchor_experiment.png"
    ))).rejects.toThrow();
    await expect(access(path.join(
      repoRoot,
      "examples/rendered/v0.1/ui_contracts_diagram_type/place_viewstate_transition_example/recommended_profile/place_viewstate_transition.ui_contracts.external_anchor_experiment.dot"
    ))).rejects.toThrow();
  });

  it("keeps staged service_blueprint previews as the default corpus artifacts while preserving legacy preview siblings", async () => {
    const bundle = await loadBundle(manifestPath);
    const discovery = await discoverCuratedRenderedExamplePairs(bundle);
    const variants = expandCuratedRenderedExampleVariants(bundle, discovery.pairs).filter(
      (variant) => variant.viewId === "service_blueprint"
    );

    for (const variant of variants) {
      const outputPaths = planRenderedCorpusOutputPaths(bundle, variant);
      const defaultSvg = await readFile(outputPaths.svgOutputPath, "utf8");
      expect(defaultSvg).toContain('class="staged-svg');
      expect(defaultSvg).toContain("Submit Claim");

      const legacySvgPath = getRenderedCorpusPreviewOutputPath(
        bundle,
        variant,
        "svg",
        "legacy_graphviz_preview",
        "staged_service_blueprint_preview"
      );
      const legacyPngPath = getRenderedCorpusPreviewOutputPath(
        bundle,
        variant,
        "png",
        "legacy_graphviz_preview",
        "staged_service_blueprint_preview"
      );

      await access(legacySvgPath);
      await access(legacyPngPath);

      const legacySvg = await readFile(legacySvgPath, "utf8");
      expect(legacySvg).not.toContain('class="staged-svg');
      expect(legacySvg).toContain("<svg");
    }
  });

  it("keeps forbidden place routing and access fields out of simple rendered corpus artifacts", async () => {
    const bundle = await loadBundle(manifestPath);
    const discovery = await discoverCuratedRenderedExamplePairs(bundle);
    const variants = expandCuratedRenderedExampleVariants(bundle, discovery.pairs).filter(
      (variant) => variant.profileId === "simple"
    );

    for (const variant of variants) {
      const outputPaths = planRenderedCorpusOutputPaths(bundle, variant);
      const dot = await readFile(outputPaths.dotOutputPath, "utf8");
      const mermaid = await readFile(outputPaths.mermaidOutputPath, "utf8");

      for (const text of [dot, mermaid]) {
        expect(text).not.toContain("entry_points:");
        expect(text).not.toContain("[auth]");
        expect(text).not.toContain("[role:");
        expect(text).not.toContain("/billing");
        expect(text).not.toContain("/checkout/");
        expect(text).not.toContain("/cases/review");
      }
    }

    const iaVariant = variants.find((variant) => (
      variant.viewId === "ia_place_map"
      && variant.example.name === "place_viewstate_transition"
    ));
    expect(iaVariant).toBeDefined();

    const iaDot = await readFile(planRenderedCorpusOutputPaths(bundle, iaVariant!).dotOutputPath, "utf8");
    expect(iaDot).toContain("primary_nav: true");
  });
});
