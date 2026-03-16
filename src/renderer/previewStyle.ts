import path from "node:path";
import type { Bundle, DotPreviewStyleConfig, ViewSpec } from "../bundle/types.js";

export interface LegacyDotPreviewStyle {
  fontFamily: string;
  svgFontAssetPath?: string;
  pngFontAssetPath?: string;
  dpi: number;
}

const fallbackLegacyDotPreviewStyle: LegacyDotPreviewStyle = {
  fontFamily: "Public Sans",
  dpi: 192
};

function resolveStyleOverride(
  config: DotPreviewStyleConfig | undefined,
  bundleRoot: string
): Partial<LegacyDotPreviewStyle> {
  if (!config) {
    return {};
  }

  const override: Partial<LegacyDotPreviewStyle> = {};

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

export function getFallbackLegacyDotPreviewStyle(): LegacyDotPreviewStyle {
  return { ...fallbackLegacyDotPreviewStyle };
}

export function resolveLegacyDotPreviewStyle(bundle: Bundle, view: ViewSpec): LegacyDotPreviewStyle {
  const bundleDefaults = resolveStyleOverride(bundle.views.preview_defaults?.dot, bundle.rootDir);
  const viewDefaults = resolveStyleOverride(view.conventions.renderer_defaults?.preview?.dot, bundle.rootDir);

  return {
    ...fallbackLegacyDotPreviewStyle,
    ...bundleDefaults,
    ...viewDefaults
  };
}

export type DotPreviewStyle = LegacyDotPreviewStyle;

export function getFallbackDotPreviewStyle(): DotPreviewStyle {
  return getFallbackLegacyDotPreviewStyle();
}

export function resolveDotPreviewStyle(bundle: Bundle, view: ViewSpec): DotPreviewStyle {
  return resolveLegacyDotPreviewStyle(bundle, view);
}
