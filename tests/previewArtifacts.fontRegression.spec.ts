import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { renderSvgToPng } from "../src/cli/previewArtifacts.js";

const repoRoot = "/home/knut/projects/sdd";
const outputPath = "/tmp/preview-public-sans-regression.png";

describe("previewArtifacts PNG font regression", () => {
  afterEach(async () => {
    await rm(outputPath, { force: true });
  });

  it("renders text with the vendored Public Sans desktop font", async () => {
    await renderSvgToPng(
      [
        '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80">',
        '<rect width="240" height="80" fill="white"/>',
        '<text x="12" y="50" font-family="Public Sans" font-size="32" fill="#111111">Hello</text>',
        "</svg>"
      ].join(""),
      outputPath,
      {
        fontFamily: "Public Sans",
        svgFontAssetPath: path.join(repoRoot, "bundle/v0.1/assets/fonts/PublicSans-Regular.woff"),
        pngFontAssetPath: path.join(repoRoot, "bundle/v0.1/assets/fonts/PublicSans-Regular.otf"),
        dpi: 192
      }
    );

    const actual = await readFile(outputPath);
    const expected = await readFile(path.join(repoRoot, "tests/goldens/preview-public-sans-text.png"));

    expect(actual).toEqual(expected);
  });
});
