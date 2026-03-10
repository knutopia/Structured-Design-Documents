import path from "node:path";
import { describe, expect, it } from "vitest";
import { embedSvgFont } from "../src/cli/previewArtifacts.js";

const repoRoot = "/home/knut/projects/sdd";

describe("embedSvgFont", () => {
  it("injects an embedded Public Sans font face into SVG output", async () => {
    const result = await embedSvgFont(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><text font-family="Public Sans">Hello</text></svg>',
      {
        fontFamily: "Public Sans",
        fontAssetPath: path.join(repoRoot, "bundle/v0.1/assets/fonts/public-sans-latin-400-normal.woff"),
        dpi: 192
      }
    );

    expect(result).toContain("@font-face");
    expect(result).toContain("Public Sans");
    expect(result).toContain("data:font/woff;base64,");
  });
});
