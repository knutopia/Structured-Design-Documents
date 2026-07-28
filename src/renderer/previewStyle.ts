import path from "node:path";
import type {
  Bundle,
  DotPreviewStyleConfig,
  StagedPreviewFontFaceConfig,
  StagedPreviewStyleConfig,
  ViewSpec
} from "../bundle/types.js";

export interface LegacyDotPreviewStyle {
  fontFamily: string;
  svgFontAssetPath?: string;
  pngFontAssetPath?: string;
  dpi: number;
}

export interface StagedPreviewFontFace {
  fontWeight: number;
  measurementFontAssetPath?: string;
  svgFontAssetPath?: string;
  pngFontAssetPath?: string;
}

export interface StagedPreviewStyle {
  fontFamily: string;
  fontFaces: StagedPreviewFontFace[];
  widthBands?: {
    chip?: number;
    narrow?: number;
    standard?: number;
    wide?: number;
  };
  dpi: number;
}

const fallbackLegacyDotPreviewStyle: LegacyDotPreviewStyle = {
  fontFamily: "Public Sans",
  dpi: 192
};

const fallbackStagedPreviewStyle: StagedPreviewStyle = {
  fontFamily: "Public Sans",
  fontFaces: [],
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

function resolveStagedFontFace(
  config: StagedPreviewFontFaceConfig,
  bundleRoot: string
): StagedPreviewFontFace | undefined {
  if (!Number.isFinite(config.font_weight) || config.font_weight <= 0) {
    return undefined;
  }

  const face: StagedPreviewFontFace = {
    fontWeight: config.font_weight
  };

  if (typeof config.measurement_font_asset === "string" && config.measurement_font_asset.trim()) {
    face.measurementFontAssetPath = path.resolve(bundleRoot, config.measurement_font_asset);
  }
  if (typeof config.svg_font_asset === "string" && config.svg_font_asset.trim()) {
    face.svgFontAssetPath = path.resolve(bundleRoot, config.svg_font_asset);
  }
  if (typeof config.png_font_asset === "string" && config.png_font_asset.trim()) {
    face.pngFontAssetPath = path.resolve(bundleRoot, config.png_font_asset);
  }

  return face;
}

function resolveStagedStyleOverride(
  config: StagedPreviewStyleConfig | undefined,
  bundleRoot: string
): Partial<Omit<StagedPreviewStyle, "fontFaces">> & { fontFaces?: StagedPreviewFontFace[] } {
  if (!config) {
    return {};
  }

  const override: Partial<Omit<StagedPreviewStyle, "fontFaces">> & {
    fontFaces?: StagedPreviewFontFace[];
  } = {};

  if (typeof config.font_family === "string" && config.font_family.trim()) {
    override.fontFamily = config.font_family;
  }
  if (Array.isArray(config.font_faces)) {
    override.fontFaces = config.font_faces
      .map((face) => resolveStagedFontFace(face, bundleRoot))
      .filter((face): face is StagedPreviewFontFace => face !== undefined);
  }
  if (config.width_bands && typeof config.width_bands === "object") {
    override.widthBands = Object.fromEntries(
      Object.entries(config.width_bands).filter(([, value]) =>
        typeof value === "number" && Number.isFinite(value) && value > 0
      )
    );
  }
  if (typeof config.dpi === "number" && Number.isFinite(config.dpi)) {
    override.dpi = config.dpi;
  }

  return override;
}

function mergeStagedFontFaces(
  ...faceSets: Array<StagedPreviewFontFace[] | undefined>
): StagedPreviewFontFace[] {
  const mergedByWeight = new Map<number, StagedPreviewFontFace>();

  for (const faces of faceSets) {
    for (const face of faces ?? []) {
      mergedByWeight.set(face.fontWeight, {
        ...mergedByWeight.get(face.fontWeight),
        ...face
      });
    }
  }

  return [...mergedByWeight.values()].sort((left, right) => left.fontWeight - right.fontWeight);
}

export function getFallbackStagedPreviewStyle(): StagedPreviewStyle {
  return {
    ...fallbackStagedPreviewStyle,
    fontFaces: []
  };
}

export function resolveStagedPreviewStyle(bundle: Bundle, view: ViewSpec): StagedPreviewStyle {
  const bundleDefaults = resolveStagedStyleOverride(bundle.views.preview_defaults?.staged, bundle.rootDir);
  const viewDefaults = resolveStagedStyleOverride(
    view.conventions.renderer_defaults?.preview?.staged,
    bundle.rootDir
  );

  return {
    ...fallbackStagedPreviewStyle,
    ...bundleDefaults,
    ...viewDefaults,
    widthBands: {
      ...(bundleDefaults.widthBands ?? {}),
      ...(viewDefaults.widthBands ?? {})
    },
    fontFaces: mergeStagedFontFaces(bundleDefaults.fontFaces, viewDefaults.fontFaces)
  };
}
