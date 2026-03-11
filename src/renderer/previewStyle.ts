import path from "node:path";
import type { Bundle, DotPreviewStyleConfig, ViewSpec } from "../bundle/types.js";

export interface DotPreviewStyle {
  fontFamily: string;
  svgFontAssetPath?: string;
  pngFontAssetPath?: string;
  dpi: number;
}

const fallbackDotPreviewStyle: DotPreviewStyle = {
  fontFamily: "Public Sans",
  dpi: 192
};

function resolveStyleOverride(config: DotPreviewStyleConfig | undefined, bundleRoot: string): Partial<DotPreviewStyle> {
  if (!config) {
    return {};
  }

  const override: Partial<DotPreviewStyle> = {};

  if (typeof config.font_family === "string" && config.font_family.trim()) {
    override.fontFamily = config.font_family;
  }

  if (typeof config.font_asset === "string" && config.font_asset.trim()) {
    const fontAssetPath = path.resolve(bundleRoot, config.font_asset);
    override.svgFontAssetPath = fontAssetPath;
    override.pngFontAssetPath = fontAssetPath;
  }

  if (typeof config.svg_font_asset === "string" && config.svg_font_asset.trim()) {
    override.svgFontAssetPath = path.resolve(bundleRoot, config.svg_font_asset);
  }

  if (typeof config.png_font_asset === "string" && config.png_font_asset.trim()) {
    override.pngFontAssetPath = path.resolve(bundleRoot, config.png_font_asset);
  }

  if (typeof config.dpi === "number" && Number.isFinite(config.dpi)) {
    override.dpi = config.dpi;
  }

  return override;
}

export function getFallbackDotPreviewStyle(): DotPreviewStyle {
  return { ...fallbackDotPreviewStyle };
}

export function resolveDotPreviewStyle(bundle: Bundle, view: ViewSpec): DotPreviewStyle {
  const bundleDefaults = resolveStyleOverride(bundle.views.preview_defaults?.dot, bundle.rootDir);
  const viewDefaults = resolveStyleOverride(view.conventions.renderer_defaults?.preview?.dot, bundle.rootDir);

  return {
    ...fallbackDotPreviewStyle,
    ...bundleDefaults,
    ...viewDefaults
  };
}
