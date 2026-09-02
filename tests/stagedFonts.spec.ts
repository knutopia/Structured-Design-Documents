import path from "node:path";
import { fileURLToPath } from "node:url";
import * as fontkit from "fontkit";
import { describe, expect, it } from "vitest";
import {
  calculateAlphabeticBaselineOffset,
  createTextMeasurementService
} from "../src/renderer/staged/textMeasurement.js";
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

  it("exposes scaled vertical metrics and exact shared-node baseline offsets", () => {
    const theme = getRendererTheme("default");
    const measurement = createTextMeasurementService(theme.fontFaces);

    const titleMetrics = measurement.getVerticalMetrics(theme.textStyles.shared_node_title);
    const valueMetrics = measurement.getVerticalMetrics(theme.textStyles.shared_node_attribute_value);
    const labelMetrics = measurement.getVerticalMetrics(theme.textStyles.shared_node_attribute_label);
    const decoratorMetrics = measurement.getVerticalMetrics(theme.textStyles.shared_node_decorator);

    expect(titleMetrics).toEqual({ ascent: 15.2, descent: -3.6, lineGap: 0 });
    expect(valueMetrics).toEqual({ ascent: 11.4, descent: -2.7, lineGap: 0 });
    expect(labelMetrics).toEqual({ ascent: 9.5, descent: -2.25, lineGap: 0 });
    expect(decoratorMetrics).toEqual({ ascent: 9.5, descent: -2.25, lineGap: 0 });
    expect(calculateAlphabeticBaselineOffset(titleMetrics, 19)).toBe(15.3);
    expect(calculateAlphabeticBaselineOffset(valueMetrics, 14)).toBe(11.35);
    expect(calculateAlphabeticBaselineOffset(labelMetrics, 12)).toBe(9.625);
    expect(calculateAlphabeticBaselineOffset(decoratorMetrics, 12)).toBe(9.625);
  });

  it("keeps measurement, embedded SVG, and PNG faces metrically conformant", () => {
    const theme = getRendererTheme("default");
    const representativeText = "API iOS Review 0123";

    for (const face of theme.fontFaces) {
      const measurementFont = fontkit.openSync(face.measurementFontAssetPath);
      const svgFont = fontkit.openSync(face.svgFontAssetPath);
      const pngFont = fontkit.openSync(face.pngFontAssetPath);
      const expected = measurementFont.layout(representativeText);

      for (const font of [svgFont, pngFont]) {
        expect({
          unitsPerEm: font.unitsPerEm,
          ascent: font.ascent,
          descent: font.descent,
          lineGap: font.lineGap,
          glyphs: font.layout(representativeText).glyphs.map((glyph) => glyph.id),
          advances: font.layout(representativeText).positions.map((position) => position.xAdvance)
        }).toEqual({
          unitsPerEm: measurementFont.unitsPerEm,
          ascent: measurementFont.ascent,
          descent: measurementFont.descent,
          lineGap: measurementFont.lineGap,
          glyphs: expected.glyphs.map((glyph) => glyph.id),
          advances: expected.positions.map((position) => position.xAdvance)
        });
      }
    }
  });
});
