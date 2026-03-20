import { describe, expect, it } from "vitest";
import { renderPositionedSceneToPng, renderPositionedSceneToSvg } from "../src/renderer/staged/svgBackend.js";
import { expectRendererStageTextSnapshot } from "./rendererStageSnapshotHarness.js";
import { buildPositionedSvgFixture } from "./stagedSvgFixtures.js";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];

describe("staged SVG backend", () => {
  it("matches the committed SVG snapshot for the synthetic positioned scene", async () => {
    const scene = buildPositionedSvgFixture();
    const rendered = await renderPositionedSceneToSvg(scene);

    expect(rendered.diagnostics.some((diagnostic) => diagnostic.severity === "error")).toBe(false);
    await expectRendererStageTextSnapshot("fixture.positioned-scene.svg", rendered.svg);
  });

  it("renders byte-identical SVG for repeated runs on the same scene", async () => {
    const scene = buildPositionedSvgFixture();
    const first = await renderPositionedSceneToSvg(scene);
    const second = await renderPositionedSceneToSvg(scene);

    expect(first).toEqual(second);
  });

  it("emits layered paint groups, embedded font CSS, and split arrow marker defs", async () => {
    const scene = buildPositionedSvgFixture();
    const { svg } = await renderPositionedSceneToSvg(scene);

    expect(svg).toContain("@font-face");
    expect(svg.match(/id="scene-marker-arrow-end"/g)).toHaveLength(1);
    expect(svg.match(/id="scene-marker-arrow-start"/g)).toHaveLength(1);
    expect(svg).toContain('markerUnits="userSpaceOnUse"');
    expect(svg).not.toContain('orient="auto-start-reverse"');
    expect(svg).toContain('data-paint-group="chrome"');
    expect(svg.indexOf('data-paint-group="chrome"')).toBeLessThan(svg.indexOf('data-paint-group="nodes"'));
    expect(svg.indexOf('data-paint-group="nodes"')).toBeLessThan(svg.indexOf('data-paint-group="labels"'));
    expect(svg.indexOf('data-paint-group="labels"')).toBeLessThan(svg.indexOf('data-paint-group="edges"'));
    expect(svg.indexOf('data-paint-group="edges"')).toBeLessThan(svg.indexOf('data-paint-group="edge_labels"'));
    expect(svg).toContain('marker-end="url(#scene-marker-arrow-end)"');
    expect(svg).not.toContain('class="scene-port');
  });

  it("derives PNG from the staged SVG output", async () => {
    const scene = buildPositionedSvgFixture();
    const svgArtifact = await renderPositionedSceneToSvg(scene);
    const pngArtifact = await renderPositionedSceneToPng(scene);

    expect(pngArtifact.svg).toBe(svgArtifact.svg);
    expect(Array.from(pngArtifact.png.slice(0, PNG_SIGNATURE.length))).toEqual(PNG_SIGNATURE);
    expect(pngArtifact.png.length).toBeGreaterThan(32);
  });

  it("reports unknown staged themes in the backend phase", async () => {
    const scene = buildPositionedSvgFixture("mystery");
    const rendered = await renderPositionedSceneToSvg(scene);

    expect(rendered.diagnostics).toContainEqual(expect.objectContaining({
      code: "renderer.backend.unknown_theme",
      phase: "backend",
      severity: "warn"
    }));
  });

  it("renders edge-label text with the default first-line baseline while leaving other text unchanged", async () => {
    const singleLineScene = buildPositionedSvgFixture();
    const { svg: singleLineSvg } = await renderPositionedSceneToSvg(singleLineScene);

    expect(singleLineSvg).toContain('<text class="scene-text text-role-edge_label block-kind-edge_label" x="230" y="92">');
    expect(singleLineSvg).toContain('<text class="scene-text text-role-title block-kind-text block-region-primary" x="36" y="50">');

    const multiLineScene = buildPositionedSvgFixture();
    const edgeLabel = multiLineScene.edges[0]?.label;
    if (!edgeLabel) {
      throw new Error("Synthetic SVG fixture is missing its edge label.");
    }
    edgeLabel.lines = ["Primary path", "With approval"];
    edgeLabel.height = 36;

    const { svg: multiLineSvg } = await renderPositionedSceneToSvg(multiLineScene);
    expect(multiLineSvg).toContain('<text class="scene-text text-role-edge_label block-kind-edge_label" x="230" y="92">');
    expect(multiLineSvg).toContain('<tspan x="230" dy="14">With approval</tspan>');
  });
});
