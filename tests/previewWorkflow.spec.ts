import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadBundle } from "../src/index.js";
import { renderSourcePreview } from "../src/renderer/previewWorkflow.js";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

async function loadInput(fileName: string): Promise<{ path: string; text: string }> {
  const filePath = path.join(repoRoot, "bundle/v0.1/examples", fileName);
  return {
    path: filePath,
    text: await readFile(filePath, "utf8")
  };
}

describe("preview workflow", () => {
  it("renders ia_place_map SVG previews through the staged backend by default", async () => {
    const bundle = await loadBundle(manifestPath);
    const input = await loadInput("outcome_to_ia_trace.sdd");
    const result = await renderSourcePreview(input, bundle, {
      viewId: "ia_place_map",
      format: "svg",
      profileId: "recommended"
    });

    expect(result.previewCapability.backendId).toBe("staged_ia_place_map_preview");
    expect(result.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(result.artifact?.format).toBe("svg");
    if (!result.artifact || result.artifact.format !== "svg") {
      throw new Error("Expected staged SVG artifact.");
    }

    expect(result.artifact.text).toContain('class="staged-svg');
    expect(result.artifact.text).toContain("Checkout Area");
    expect(result.artifact.sourceArtifacts?.dot).toBeUndefined();
  });

  it("renders ia_place_map PNG previews through the staged backend by default", async () => {
    const bundle = await loadBundle(manifestPath);
    const input = await loadInput("place_viewstate_transition.sdd");
    const result = await renderSourcePreview(input, bundle, {
      viewId: "ia_place_map",
      format: "png",
      profileId: "simple"
    });

    expect(result.previewCapability.backendId).toBe("staged_ia_place_map_preview");
    expect(result.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(result.artifact?.format).toBe("png");
    if (!result.artifact || result.artifact.format !== "png") {
      throw new Error("Expected staged PNG artifact.");
    }

    expect(Array.from(result.artifact.bytes.slice(0, PNG_SIGNATURE.length))).toEqual(PNG_SIGNATURE);
    expect(result.artifact.bytes.length).toBeGreaterThan(32);
    expect(result.artifact.sourceArtifacts?.dot).toBeUndefined();
  });

  it("renders outcome_to_ia_trace permissive PNG previews through the staged backend without overflow errors", async () => {
    const bundle = await loadBundle(manifestPath);
    const input = await loadInput("outcome_to_ia_trace.sdd");
    const result = await renderSourcePreview(input, bundle, {
      viewId: "ia_place_map",
      format: "png",
      profileId: "permissive"
    });

    expect(result.previewCapability.backendId).toBe("staged_ia_place_map_preview");
    expect(result.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(result.artifact?.format).toBe("png");
    if (!result.artifact || result.artifact.format !== "png") {
      throw new Error("Expected staged PNG artifact.");
    }

    expect(Array.from(result.artifact.bytes.slice(0, PNG_SIGNATURE.length))).toEqual(PNG_SIGNATURE);
    expect(result.artifact.bytes.length).toBeGreaterThan(32);
    expect(result.artifact.sourceArtifacts?.dot).toBeUndefined();
  });

  it("renders ui_contracts SVG previews through the staged backend by default", async () => {
    const bundle = await loadBundle(manifestPath);
    const input = await loadInput("place_viewstate_transition.sdd");
    const result = await renderSourcePreview(input, bundle, {
      viewId: "ui_contracts",
      format: "svg",
      profileId: "recommended"
    });

    expect(result.previewCapability.backendId).toBe("staged_ui_contracts_preview");
    expect(result.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(result.artifact?.format).toBe("svg");
    if (!result.artifact || result.artifact.format !== "svg") {
      throw new Error("Expected staged SVG artifact.");
    }

    expect(result.artifact.text).toContain('class="staged-svg');
    expect(result.artifact.text).toContain("ViewState Graph");
    expect(result.artifact.sourceArtifacts?.dot).toBeUndefined();
  });

  it("renders ui_contracts PNG previews through the staged backend by default", async () => {
    const bundle = await loadBundle(manifestPath);
    const input = await loadInput("ui_state_fallback.sdd");
    const result = await renderSourcePreview(input, bundle, {
      viewId: "ui_contracts",
      format: "png",
      profileId: "recommended"
    });

    expect(result.previewCapability.backendId).toBe("staged_ui_contracts_preview");
    expect(result.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(result.artifact?.format).toBe("png");
    if (!result.artifact || result.artifact.format !== "png") {
      throw new Error("Expected staged PNG artifact.");
    }

    expect(Array.from(result.artifact.bytes.slice(0, PNG_SIGNATURE.length))).toEqual(PNG_SIGNATURE);
    expect(result.artifact.bytes.length).toBeGreaterThan(32);
    expect(result.artifact.sourceArtifacts?.dot).toBeUndefined();
  });

  it("renders service_blueprint SVG previews through the staged backend by default", async () => {
    const bundle = await loadBundle(manifestPath);
    const input = await loadInput("service_blueprint_slice.sdd");
    const result = await renderSourcePreview(input, bundle, {
      viewId: "service_blueprint",
      format: "svg",
      profileId: "recommended"
    });

    expect(result.previewCapability.backendId).toBe("staged_service_blueprint_preview");
    expect(result.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(result.artifact?.format).toBe("svg");
    if (!result.artifact || result.artifact.format !== "svg") {
      throw new Error("Expected staged SVG artifact.");
    }

    expect(result.artifact.text).toContain('class="staged-svg');
    expect(result.artifact.text).toContain("Submit Claim");
    expect(result.artifact.text).toContain("Retention Policy");
    expect(result.artifact.text).toContain('class="scene-edge');
    expect(result.artifact.text).toContain("reads, writes");
    expect(result.artifact.text).toContain('dominant-baseline="middle"');
    expect(result.artifact.sourceArtifacts?.dot).toBeUndefined();
  });

  it("omits service_blueprint secondary edge labels in simple staged SVG previews", async () => {
    const bundle = await loadBundle(manifestPath);
    const input = await loadInput("service_blueprint_slice.sdd");
    const result = await renderSourcePreview(input, bundle, {
      viewId: "service_blueprint",
      format: "svg",
      profileId: "simple"
    });

    expect(result.previewCapability.backendId).toBe("staged_service_blueprint_preview");
    expect(result.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(result.artifact?.format).toBe("svg");
    if (!result.artifact || result.artifact.format !== "svg") {
      throw new Error("Expected staged SVG artifact.");
    }

    expect(result.artifact.text).toContain('class="staged-svg');
    expect(result.artifact.text).toContain("Submit Claim");
    expect(result.artifact.text).not.toContain("realized by");
    expect(result.artifact.text).not.toContain("depends on");
    expect(result.artifact.text).not.toContain("constrained by");
    expect(result.artifact.text).not.toContain("reads, writes");
    expect(result.artifact.text).toContain('class="scene-edge');
    expect(result.artifact.sourceArtifacts?.dot).toBeUndefined();
  });

  it("renders service_blueprint PNG previews through the staged backend by default", async () => {
    const bundle = await loadBundle(manifestPath);
    const input = await loadInput("service_blueprint_slice.sdd");
    const result = await renderSourcePreview(input, bundle, {
      viewId: "service_blueprint",
      format: "png",
      profileId: "recommended"
    });

    expect(result.previewCapability.backendId).toBe("staged_service_blueprint_preview");
    expect(result.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(result.artifact?.format).toBe("png");
    if (!result.artifact || result.artifact.format !== "png") {
      throw new Error("Expected staged PNG artifact.");
    }

    expect(Array.from(result.artifact.bytes.slice(0, PNG_SIGNATURE.length))).toEqual(PNG_SIGNATURE);
    expect(result.artifact.bytes.length).toBeGreaterThan(32);
    expect(result.artifact.sourceArtifacts?.dot).toBeUndefined();
  });

  it("renders service_blueprint SVG previews through the explicit legacy backend", async () => {
    const bundle = await loadBundle(manifestPath);
    const input = await loadInput("service_blueprint_slice.sdd");
    const result = await renderSourcePreview(input, bundle, {
      viewId: "service_blueprint",
      format: "svg",
      profileId: "recommended",
      backendId: "legacy_graphviz_preview"
    });

    expect(result.previewCapability.backendId).toBe("legacy_graphviz_preview");
    expect(result.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(result.artifact?.format).toBe("svg");
    if (!result.artifact || result.artifact.format !== "svg") {
      throw new Error("Expected legacy SVG artifact.");
    }

    expect(result.artifact.text).toContain("<svg");
    expect(result.artifact.sourceArtifacts?.dot).toContain("digraph service_blueprint");
  });

  it("renders service_blueprint PNG previews through the explicit legacy backend", async () => {
    const bundle = await loadBundle(manifestPath);
    const input = await loadInput("service_blueprint_slice.sdd");
    const result = await renderSourcePreview(input, bundle, {
      viewId: "service_blueprint",
      format: "png",
      profileId: "recommended",
      backendId: "legacy_graphviz_preview"
    });

    expect(result.previewCapability.backendId).toBe("legacy_graphviz_preview");
    expect(result.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(result.artifact?.format).toBe("png");
    if (!result.artifact || result.artifact.format !== "png") {
      throw new Error("Expected legacy PNG artifact.");
    }

    expect(Array.from(result.artifact.bytes.slice(0, PNG_SIGNATURE.length))).toEqual(PNG_SIGNATURE);
    expect(result.artifact.bytes.length).toBeGreaterThan(32);
    expect(result.artifact.sourceArtifacts?.dot).toContain("digraph service_blueprint");
  });
});
