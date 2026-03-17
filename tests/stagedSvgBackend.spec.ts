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

  it("emits layered paint groups, embedded font CSS, and shared marker defs", async () => {
    const scene = buildPositionedSvgFixture();
    const { svg } = await renderPositionedSceneToSvg(scene);

    expect(svg).toContain("@font-face");
    expect(svg).toContain('id="scene-marker-arrow"');
    expect(svg).toContain('markerUnits="userSpaceOnUse"');
    expect(svg).toContain('data-paint-group="chrome"');
    expect(svg.indexOf('data-paint-group="chrome"')).toBeLessThan(svg.indexOf('data-paint-group="nodes"'));
    expect(svg.indexOf('data-paint-group="nodes"')).toBeLessThan(svg.indexOf('data-paint-group="labels"'));
    expect(svg.indexOf('data-paint-group="labels"')).toBeLessThan(svg.indexOf('data-paint-group="edges"'));
    expect(svg.indexOf('data-paint-group="edges"')).toBeLessThan(svg.indexOf('data-paint-group="edge_labels"'));
    expect(svg).toContain('marker-end="url(#scene-marker-arrow)"');
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
});
