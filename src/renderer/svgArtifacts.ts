import { readFile } from "node:fs/promises";
import { Resvg } from "@resvg/resvg-js";

export interface SvgFontFaceOptions {
  fontFamily: string;
  fontAssetPath?: string;
  fontStyle?: "normal" | "italic";
  fontWeight?: number;
}

export interface SvgRasterizationOptions {
  dpi?: number;
  fontFamily: string;
  pngFontAssetPath?: string;
  pngFontAssetPaths?: string[];
}

const embeddedFontFaceCssCache = new Map<string, Promise<string>>();

function escapeCssString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function inferFontMimeType(fontPath: string): { mimeType: string; format: string } {
  if (fontPath.endsWith(".woff2")) {
    return {
      mimeType: "font/woff2",
      format: "woff2"
    };
  }

  if (fontPath.endsWith(".woff")) {
    return {
      mimeType: "font/woff",
      format: "woff"
    };
  }

  if (fontPath.endsWith(".otf")) {
    return {
      mimeType: "font/otf",
      format: "opentype"
    };
  }

  return {
    mimeType: "font/ttf",
    format: "truetype"
  };
}

export async function buildEmbeddedFontFaceCss(options: SvgFontFaceOptions): Promise<string | undefined> {
  if (!options.fontAssetPath) {
    return undefined;
  }

  const cacheKey = JSON.stringify({
    fontFamily: options.fontFamily,
    fontAssetPath: options.fontAssetPath,
    fontStyle: options.fontStyle ?? "normal",
    fontWeight: options.fontWeight ?? 400
  });
  const cached = embeddedFontFaceCssCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const css = readFile(options.fontAssetPath).then((fontBuffer) => {
    const { mimeType, format } = inferFontMimeType(options.fontAssetPath!);
    const fontData = fontBuffer.toString("base64");
    return [
      "@font-face {",
      `  font-family: '${escapeCssString(options.fontFamily)}';`,
      `  src: url("data:${mimeType};base64,${fontData}") format('${format}');`,
      `  font-style: ${options.fontStyle ?? "normal"};`,
      `  font-weight: ${options.fontWeight ?? 400};`,
      "}"
    ].join("\n");
  });
  embeddedFontFaceCssCache.set(cacheKey, css);
  return css;
}

export async function buildEmbeddedFontFaceStyleElement(options: SvgFontFaceOptions): Promise<string | undefined> {
  const css = await buildEmbeddedFontFaceCss(options);
  if (!css) {
    return undefined;
  }

  return `<style><![CDATA[\n${css}\n]]></style>`;
}

export async function buildEmbeddedFontFaceStyleElements(
  faces: readonly SvgFontFaceOptions[]
): Promise<string[]> {
  const elements = await Promise.all(
    [...faces]
      .sort((left, right) => (left.fontWeight ?? 400) - (right.fontWeight ?? 400))
      .map((face) => buildEmbeddedFontFaceStyleElement(face))
  );
  return elements.filter((element): element is string => element !== undefined);
}

export async function embedSvgFontFace(svg: string, options: SvgFontFaceOptions): Promise<string> {
  const styleElement = await buildEmbeddedFontFaceStyleElement(options);
  if (!styleElement) {
    return svg;
  }

  const svgOpenTagMatch = svg.match(/<svg\b[^>]*>/);
  if (!svgOpenTagMatch) {
    return svg;
  }

  const insertionOffset = svgOpenTagMatch.index! + svgOpenTagMatch[0].length;
  return `${svg.slice(0, insertionOffset)}\n${styleElement}\n${svg.slice(insertionOffset)}`;
}

export async function renderSvgToPng(svg: string, options: SvgRasterizationOptions): Promise<Uint8Array> {
  const fontFiles = [
    ...(options.pngFontAssetPaths ?? []),
    ...(options.pngFontAssetPath ? [options.pngFontAssetPath] : [])
  ].filter((fontPath, index, allPaths) => allPaths.indexOf(fontPath) === index);
  const resvgOptions: ConstructorParameters<typeof Resvg>[1] = {
    dpi: options.dpi ?? 192,
    font: {
      ...(fontFiles.length > 0 ? { fontFiles } : {}),
      loadSystemFonts: false,
      defaultFontFamily: options.fontFamily,
      sansSerifFamily: options.fontFamily,
      serifFamily: options.fontFamily,
      monospaceFamily: options.fontFamily
    }
  };
  const resvg = new Resvg(svg, resvgOptions);

  return resvg.render().asPng();
}
