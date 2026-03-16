import * as fontkit from "fontkit";
import type { Font } from "fontkit";
import type { TextStyleToken } from "./theme.js";

export interface TextMeasurementService {
  measureText(text: string, style: TextStyleToken): number;
}

const FONT_MEASUREMENT_PRECISION = 1000;

const fontCache = new Map<string, Font>();

function roundMetric(value: number): number {
  return Math.round(value * FONT_MEASUREMENT_PRECISION) / FONT_MEASUREMENT_PRECISION;
}

function getFont(fontPath: string): Font {
  const cached = fontCache.get(fontPath);
  if (cached) {
    return cached;
  }

  const font = fontkit.openSync(fontPath);
  fontCache.set(fontPath, font);
  return font;
}

export function createTextMeasurementService(fontPath: string): TextMeasurementService {
  const font = getFont(fontPath);

  return {
    measureText(text: string, style: TextStyleToken): number {
      if (text.length === 0) {
        return 0;
      }

      const glyphRun = font.layout(text);
      const advance = glyphRun.positions.reduce((sum, position) => sum + position.xAdvance, 0);
      return roundMetric((advance / font.unitsPerEm) * style.fontSize);
    }
  };
}
