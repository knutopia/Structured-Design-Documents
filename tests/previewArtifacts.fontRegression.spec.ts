import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderLegacySvgToPng } from "../src/renderer/legacyGraphvizPreviewBackend.js";

const repoRoot = "/home/knut/projects/sdd";

describe("legacyGraphvizPreviewBackend PNG font regression", () => {
  it("renders text with the vendored Public Sans desktop font", async () => {
    const actual = await renderLegacySvgToPng(
      [
        '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80">',
        '<rect width="240" height="80" fill="white"/>',
        '<text x="12" y="50" font-family="Public Sans" font-size="32" fill="#111111">Hello</text>',
        "</svg>"
      ].join(""),
      {
        fontFamily: "Public Sans",
        svgFontAssetPath: path.join(repoRoot, "bundle/v0.1/assets/fonts/PublicSans-Regular.woff"),
        pngFontAssetPath: path.join(repoRoot, "bundle/v0.1/assets/fonts/PublicSans-Regular.otf"),
        dpi: 192
      }
    );

    const expected = await readFile(path.join(repoRoot, "tests/goldens/preview-public-sans-text.png"));

    expect(Buffer.from(actual)).toEqual(expected);
  });
});
