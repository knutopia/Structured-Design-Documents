declare module "fontkit" {
  export interface GlyphPosition {
    xAdvance: number;
    yAdvance: number;
    xOffset: number;
    yOffset: number;
  }

  export interface GlyphRun {
    positions: GlyphPosition[];
  }

  export interface Font {
    familyName: string;
    subfamilyName: string;
    fullName: string;
    postscriptName: string;
    version: string;
    unitsPerEm: number;
    ascent: number;
    descent: number;
    lineGap: number;
    "OS/2": {
      usWeightClass: number;
    };
    layout(text: string, features?: string[] | Record<string, boolean>): GlyphRun;
  }

  export function openSync(filename: string, postscriptName?: string | null): Font;
}
