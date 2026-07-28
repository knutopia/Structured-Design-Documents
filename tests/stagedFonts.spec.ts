import path from "node:path";
import { fileURLToPath } from "node:url";
import * as fontkit from "fontkit";
import { describe, expect, it } from "vitest";
import { createTextMeasurementService } from "../src/renderer/staged/textMeasurement.js";
import { getRendererTheme } from "../src/renderer/staged/theme.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fontsRoot = path.join(repoRoot, "bundle/v0.1/assets/fonts");

describe("staged renderer font faces", () => {
  it.each([
    ["PublicSans-SemiBold.woff", "Version 2.001; ttfautohint (v1.8.3)"],
    ["PublicSans-SemiBold.otf", "Version 2.001"]
  ])("vendors an official static weight-600 %s face", (fileName, expectedVersion) => {
    const font = fontkit.openSync(path.join(fontsRoot, fileName));

    expect(font.postscriptName).toBe("PublicSans-SemiBold");
    expect(font["OS/2"].usWeightClass).toBe(600);
    expect(font.unitsPerEm).toBe(2000);
    expect(font.version).toBe(expectedVersion);
  });

  it("measures weight-600 text with Semibold metrics", () => {
    const theme = getRendererTheme("default");
    const measureText = createTextMeasurementService(theme.fontFaces);
    const regularWidth = measureText.measureText("Checkout Area", theme.textStyles.subtitle);
    const semiboldWidth = measureText.measureText("Checkout Area", theme.textStyles.title);
    const semiboldAtSubtitleSize = measureText.measureText("Checkout Area", {
      ...theme.textStyles.subtitle,
      fontWeight: 600
    });

    expect(regularWidth).toBe(89.557);
    expect(semiboldWidth).toBe(111.8);
    expect(semiboldAtSubtitleSize).toBe(90.837);
  });
});
