import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  discoverCuratedRenderedExamplePairs,
  expandCuratedRenderedExampleVariants,
  getRenderedCorpusDebugOutputPath,
  getRenderedCorpusPreviewOutputPath,
  getRenderedCorpusRoot,
  getRenderedCorpusViewDirName,
  isPreviewOnlyRenderedCorpusView,
  planRenderedCorpusOutputPaths
} from "../src/examples/renderedCorpus.js";
import { loadBundle } from "../src/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

describe("rendered example corpus", () => {
  it("labels only preview-only rendered corpus view folders", async () => {
    expect(isPreviewOnlyRenderedCorpusView("outcome_opportunity_map")).toBe(true);
    expect(isPreviewOnlyRenderedCorpusView("journey_map")).toBe(true);
    expect(isPreviewOnlyRenderedCorpusView("scenario_flow")).toBe(true);
    expect(isPreviewOnlyRenderedCorpusView("ia_place_map")).toBe(false);
    expect(isPreviewOnlyRenderedCorpusView("ui_contracts")).toBe(false);
    expect(isPreviewOnlyRenderedCorpusView("service_blueprint")).toBe(false);

    expect(getRenderedCorpusViewDirName("outcome_opportunity_map")).toBe(
      "outcome_opportunity_map_diagram_type [preview_only]"
    );
    expect(getRenderedCorpusViewDirName("journey_map")).toBe(
      "journey_map_diagram_type [preview_only]"
    );
    expect(getRenderedCorpusViewDirName("scenario_flow")).toBe(
      "scenario_flow_diagram_type [preview_only]"
    );
    expect(getRenderedCorpusViewDirName("ia_place_map")).toBe("ia_place_map_diagram_type");
    expect(getRenderedCorpusViewDirName("ui_contracts")).toBe("ui_contracts_diagram_type");
    expect(getRenderedCorpusViewDirName("service_blueprint")).toBe("service_blueprint_diagram_type");
  });

  it("contains every committed artifact for each curated render pair", async () => {
    const bundle = await loadBundle(manifestPath);
    const discovery = await discoverCuratedRenderedExamplePairs(bundle);
    const variants = expandCuratedRenderedExampleVariants(bundle, discovery.pairs);

    await access(path.join(getRenderedCorpusRoot(bundle), "README.md"));

    for (const variant of variants) {
      const outputPaths = planRenderedCorpusOutputPaths(bundle, variant);
      expect(path.basename(path.dirname(outputPaths.exampleDir))).toBe(getRenderedCorpusViewDirName(variant.viewId));
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

  it("documents the preview-only rendered corpus label in the generated README", async () => {
    const bundle = await loadBundle(manifestPath);
    const readme = await readFile(path.join(getRenderedCorpusRoot(bundle), "README.md"), "utf8");

    expect(readme).toContain("Folders suffixed with `[preview_only]` are committed for inspection/reference during renderer migration and are not yet ready as polished example output.");
    expect(readme).toContain("outcome_opportunity_map_diagram_type [preview_only]/metric_event_instrumentation_example");
    expect(readme).toContain("journey_map_diagram_type [preview_only]/service_blueprint_slice_example");
    expect(readme).toContain("scenario_flow_diagram_type [preview_only]/scenario_branching_example");
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
      expect(defaultSvg).toContain("Line of Interaction");
      expect(defaultSvg).toContain("Line of Visibility");
      expect(defaultSvg).not.toContain("Line of Internal Interaction");

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

      await access(getRenderedCorpusDebugOutputPath(bundle, variant, "pre_routing", "svg"));
      await access(getRenderedCorpusDebugOutputPath(bundle, variant, "pre_routing", "png"));
      await access(getRenderedCorpusDebugOutputPath(bundle, variant, "routing_step_2_edges", "svg"));
      await access(getRenderedCorpusDebugOutputPath(bundle, variant, "routing_step_2_edges", "png"));
      await access(getRenderedCorpusDebugOutputPath(bundle, variant, "routing_step_3_gutters", "svg"));
      await access(getRenderedCorpusDebugOutputPath(bundle, variant, "routing_step_3_gutters", "png"));
    }
  });

  it("does not add service_blueprint-only debug corpus siblings for non-service_blueprint staged views", async () => {
    const bundle = await loadBundle(manifestPath);
    const discovery = await discoverCuratedRenderedExamplePairs(bundle);
    const variants = expandCuratedRenderedExampleVariants(bundle, discovery.pairs).filter(
      (variant) => variant.viewId !== "service_blueprint"
    );

    for (const variant of variants) {
      await expect(access(getRenderedCorpusDebugOutputPath(bundle, variant, "pre_routing", "svg"))).rejects.toThrow();
      await expect(access(getRenderedCorpusDebugOutputPath(bundle, variant, "pre_routing", "png"))).rejects.toThrow();
      await expect(access(getRenderedCorpusDebugOutputPath(bundle, variant, "routing_step_2_edges", "svg"))).rejects.toThrow();
      await expect(access(getRenderedCorpusDebugOutputPath(bundle, variant, "routing_step_2_edges", "png"))).rejects.toThrow();
      await expect(access(getRenderedCorpusDebugOutputPath(bundle, variant, "routing_step_3_gutters", "svg"))).rejects.toThrow();
      await expect(access(getRenderedCorpusDebugOutputPath(bundle, variant, "routing_step_3_gutters", "png"))).rejects.toThrow();
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
