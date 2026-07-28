import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderPositionedSceneToPng, renderPositionedSceneToSvg } from "../src/renderer/staged/svgBackend.js";
import { expectRendererStageTextSnapshot } from "./rendererStageSnapshotHarness.js";
import { buildPositionedSvgFixture } from "./stagedSvgFixtures.js";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

  it("renders deterministic positioned continuity marks without changing route points", async () => {
    const scene = buildPositionedSvgFixture();
    const edge = scene.edges[0]!;
    const originalPoints = structuredClone(edge.route.points);
    edge.continuityMarks = [{
      id: "journey-crossover:nav-001:0:under-001:0",
      segmentIndex: 0,
      point: { x: 228, y: 104 },
      halfSpan: 3,
      rise: 3,
      normalDirection: -1,
      underEdgeId: "under-001"
    }];

    const first = await renderPositionedSceneToSvg(scene);
    const second = await renderPositionedSceneToSvg(scene);

    expect(first).toEqual(second);
    expect(first.svg).toContain(
      'd="M 208 104 L 225 104 Q 228 101 231 104 L 248 104 L 248 136 L 320 136 L 320 104"'
    );
    expect(edge.route.points).toEqual(originalPoints);
    expect(first.diagnostics.some((diagnostic) => diagnostic.severity === "error")).toBe(false);
  });

  it("emits layered paint groups, embedded font CSS, and split arrow marker defs", async () => {
    const scene = buildPositionedSvgFixture();
    const { svg } = await renderPositionedSceneToSvg(scene);
    const regularWoff = await readFile(
      path.join(repoRoot, "bundle/v0.1/assets/fonts/PublicSans-Regular.woff")
    );
    const semiboldWoff = await readFile(
      path.join(repoRoot, "bundle/v0.1/assets/fonts/PublicSans-SemiBold.woff")
    );

    expect(svg.match(/@font-face/g)).toHaveLength(2);
    expect(svg).toContain(`base64,${regularWoff.toString("base64")}`);
    expect(svg).toContain(`base64,${semiboldWoff.toString("base64")}`);
    expect(svg.indexOf("font-weight: 400")).toBeLessThan(svg.indexOf("font-weight: 600"));
    expect(svg).toContain(".staged-svg { background: transparent; }");
    expect(svg).toContain(".scene-container.primitive-root .scene-container__chrome { fill: #f7f8fb; }");
    expect(svg).toContain(
      '<rect class="scene-container__chrome" x="0" y="0" width="560" height="280" rx="18" ry="18"/>'
    );
    expect(svg).not.toContain("isolation: isolate");
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

  it("renders edge-label text with centered baseline handling while leaving other text unchanged", async () => {
    const singleLineScene = buildPositionedSvgFixture();
    const { svg: singleLineSvg } = await renderPositionedSceneToSvg(singleLineScene);

    expect(singleLineSvg).toContain('<text class="scene-text text-role-edge_label block-kind-edge_label" x="230" y="87" dominant-baseline="middle">');
    expect(singleLineSvg).toContain('<text class="scene-text text-role-title block-kind-text block-region-primary" x="36" y="50">');

    const multiLineScene = buildPositionedSvgFixture();
    const edgeLabel = multiLineScene.edges[0]?.label;
    if (!edgeLabel) {
      throw new Error("Synthetic SVG fixture is missing its edge label.");
    }
    edgeLabel.lines = ["Primary path", "With approval"];
    edgeLabel.height = 36;

    const { svg: multiLineSvg } = await renderPositionedSceneToSvg(multiLineScene);
    expect(multiLineSvg).toContain('<text class="scene-text text-role-edge_label block-kind-edge_label" x="230" y="87" dominant-baseline="middle">');
    expect(multiLineSvg).toContain('<tspan x="230" dy="14">With approval</tspan>');
  });
});
