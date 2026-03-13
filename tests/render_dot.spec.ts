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
    expect(result.text).toContain('"P-010__title" [shape="plaintext", label="Billing\\l/billing\\l[auth]\\l"];');
    expect(result.text).not.toContain('"P-010__title" [shape="plaintext", label="Billing\\\\l/billing\\\\l[auth]\\\\l"];');
    expect(result.text).toContain('"VS-010a__title" [shape="plaintext", label="ViewState: Billing Editing\\ldata: PaymentMethod\\l"];');
    expect(result.text).not.toContain('"VS-010a__title" [shape="plaintext", label="ViewState: Billing Editing\\\\ldata: PaymentMethod\\\\l"];');
    expect(result.text).toContain("subgraph cluster_VS_010a {");
    expect(result.text).not.toContain("subgraph cluster_VS_010a__detail {");
    expect(result.text).not.toContain('"VS-010a" [shape="box", style="rounded,dashed", label="Billing Editing\\ndata: PaymentMethod"];');
    expect(result.text).toContain('"P-010__title" -> "P-011__title" [style=invis, weight=100];');
  });

  it("renders component containers only when ui_contracts detail is visible", async () => {
    const bundle = await loadBundle(manifestPath);
    const examplePath = path.join(repoRoot, "bundle/v0.1/examples/place_viewstate_transition.sdd");
    const input = {
      path: examplePath,
      text: await readFile(examplePath, "utf8")
    };

    const simple = renderSource(input, bundle, {
      viewId: "ui_contracts",
      format: "dot",
      profileId: "simple"
    });
    const permissive = renderSource(input, bundle, {
      viewId: "ui_contracts",
      format: "dot",
      profileId: "permissive"
    });

    expect(simple.text).not.toContain("subgraph cluster_C_010 {");
    expect(permissive.text).toContain("subgraph cluster_C_010 {");
    expect(permissive.text).toContain('"C-010__title" [shape="plaintext", label="Component: Billing Form\\l"];');
    expect(permissive.text).not.toContain('"C-010" [shape="box", style="rounded", label="Billing Form"];');
  });

  it("uses event names in ui_contracts transition labels when event annotations resolve", async () => {
    const bundle = await loadBundle(manifestPath);

    for (const exampleName of ["place_viewstate_transition", "ui_state_fallback"]) {
      const examplePath = path.join(repoRoot, "bundle/v0.1/examples", `${exampleName}.sdd`);
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
      expect(result.text).not.toContain("[E-010]");
      expect(result.text).not.toContain("[E-060]");
    }

    const placeExamplePath = path.join(repoRoot, "bundle/v0.1/examples/place_viewstate_transition.sdd");
    const placeResult = renderSource({
      path: placeExamplePath,
      text: await readFile(placeExamplePath, "utf8")
    }, bundle, {
      viewId: "ui_contracts",
      format: "dot",
      profileId: "permissive"
    });
    expect(placeResult.text).toContain("[Submit] {payment_valid} / SA-010");

    const fallbackExamplePath = path.join(repoRoot, "bundle/v0.1/examples/ui_state_fallback.sdd");
    const fallbackResult = renderSource({
      path: fallbackExamplePath,
      text: await readFile(fallbackExamplePath, "utf8")
    }, bundle, {
      viewId: "ui_contracts",
      format: "dot",
      profileId: "permissive"
    });
    expect(fallbackResult.text).toContain("[Submit Review] / SA-060");
    expect(fallbackResult.text).toContain("[Submit Review] {draft_ready}");
  });

  it("uses visible title nodes for containerized ui_contracts owners and keeps local support edges constrained", async () => {
    const bundle = await loadBundle(manifestPath);
    const examplePath = path.join(repoRoot, "bundle/v0.1/examples/ui_state_fallback.sdd");
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
    expect(result.text).toContain('"C-060__title" [shape="plaintext", label="Component: Review Panel\\l"];');
    expect(result.text).not.toContain('"C-060" [shape="box", style="rounded", label="Review Panel"];');
    expect(result.text).toContain('"C-060__title" -> "E-060" [label="emits", style="dashed", constraint=true];');
    expect(result.text).toContain('"P-060__title" -> "secondary_state_group:P-060__title" [style=invis, weight=100];');
    expect(result.text).not.toContain('"E-060" -> "SA-060" [style=invis, weight=100];');
    expect(result.text).not.toContain('"SA-060" -> "D-060" [style=invis, weight=100];');
  });
});
