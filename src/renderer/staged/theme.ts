import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StagedPreviewStyle } from "../previewStyle.js";
import type {
  BoxSpacing,
  ContentBlockKind,
  SceneContainerPrimitive,
  SceneNodePrimitive,
  WidthBand
} from "./contracts.js";
import {
  createRendererDiagnostic,
  type RendererDiagnostic,
  type RendererDiagnosticPhase
} from "./diagnostics.js";

export interface TextStyleToken {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  /** Resolved pixel spacing added between adjacent glyphs. */
  letterSpacing?: number;
}

export interface SharedNodeTheme {
  width: number;
  minHeight: number;
  container: {
    padding: BoxSpacing;
    gap: number;
  };
  cornerRadius: number;
  strokeWidth: number;
  strokePlacement: "inside";
  fill: string;
  stroke: string;
  text: string;
  decorator: {
    height: number;
    padding: BoxSpacing;
    gap: number;
    fill: string;
    textStyleRole: string;
  };
  body: {
    padding: BoxSpacing;
    gap: number;
  };
  titleTextStyleRole: string;
  attribute: {
    padding: BoxSpacing;
    gap: number;
    labelTextStyleRole: string;
    valueTextStyleRole: string;
  };
}

export interface PrimitiveTextRule {
  allowedKinds: ContentBlockKind[];
  movableSecondaryKinds: ContentBlockKind[];
  maxBlocks?: number;
}

export interface NodePrimitiveTheme {
  padding: BoxSpacing;
  blockGap: number;
  secondaryGap: number;
  minHeight: number;
  portInset: number;
  badgePadding?: BoxSpacing;
  textRule: PrimitiveTextRule;
}

export interface ContainerPrimitiveTheme {
  defaultPadding: BoxSpacing;
  defaultGutter: number;
  defaultHeaderBandHeight: number;
  portInset: number;
}

export interface PrimitiveCornerRadii {
  container: Record<SceneContainerPrimitive, number>;
  node: Record<SceneNodePrimitive, number>;
}

export interface RendererPaintPalette {
  canvas: string;
  containerFill: string;
  containerStroke: string;
  headerBandFill: string;
  nodeFill: string;
  nodeStroke: string;
  badgeFill: string;
  badgeStroke: string;
  connectorPortFill: string;
  connectorPortStroke: string;
  text: string;
  secondaryText: string;
  edge: string;
  edgeLabelFill: string;
  edgeLabelStroke: string;
}

export interface RendererPaintTheme {
  canvasBackground: string;
  strokeWidth: number;
  edgeStrokeWidth: number;
  portRadius: number;
  arrowSize: number;
  cornerRadii: PrimitiveCornerRadii;
  palette: RendererPaintPalette;
}

export interface RendererFontFace {
  fontWeight: number;
  fontStyle: "normal";
  measurementFontAssetPath: string;
  svgFontAssetPath: string;
  pngFontAssetPath: string;
}

export interface RendererTheme {
  id: string;
  revision: string;
  fontFamily: string;
  fontFaces: RendererFontFace[];
  dpi: number;
  widthBands: Record<WidthBand, number>;
  edgeLabelMaxWidth: number;
  textStyles: Record<string, TextStyleToken>;
  sharedNode: SharedNodeTheme;
  nodePrimitives: Record<SceneNodePrimitive, NodePrimitiveTheme>;
  containerPrimitives: Record<SceneContainerPrimitive, ContainerPrimitiveTheme>;
  paint: RendererPaintTheme;
}

export const WIDTH_BAND_ORDER: WidthBand[] = ["chip", "narrow", "standard", "wide"];

const defaultBoxSpacing = (top: number, right = top, bottom = top, left = right): BoxSpacing => ({
  top,
  right,
  bottom,
  left
});

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const bundledFontsRoot = path.resolve(repoRoot, "bundle/v0.1/assets/fonts");

const defaultTheme: RendererTheme = {
  id: "default",
  revision: "public-sans-v0.2",
  fontFamily: "Public Sans",
  fontFaces: [
    {
      fontWeight: 400,
      fontStyle: "normal",
      measurementFontAssetPath: path.resolve(bundledFontsRoot, "PublicSans-Regular.otf"),
      svgFontAssetPath: path.resolve(bundledFontsRoot, "PublicSans-Regular.woff"),
      pngFontAssetPath: path.resolve(bundledFontsRoot, "PublicSans-Regular.otf")
    },
    {
      fontWeight: 600,
      fontStyle: "normal",
      measurementFontAssetPath: path.resolve(bundledFontsRoot, "PublicSans-SemiBold.otf"),
      svgFontAssetPath: path.resolve(bundledFontsRoot, "PublicSans-SemiBold.woff"),
      pngFontAssetPath: path.resolve(bundledFontsRoot, "PublicSans-SemiBold.otf")
    }
  ],
  dpi: 192,
  widthBands: {
    chip: 96,
    narrow: 168,
    standard: 224,
    wide: 308
  },
  edgeLabelMaxWidth: 180,
  textStyles: {
    title: {
      fontFamily: "Public Sans",
      fontSize: 16,
      fontWeight: 600,
      lineHeight: 20
    },
    subtitle: {
      fontFamily: "Public Sans",
      fontSize: 13,
      fontWeight: 400,
      lineHeight: 16
    },
    badge: {
      fontFamily: "Public Sans",
      fontSize: 12,
      fontWeight: 600,
      lineHeight: 14
    },
    metadata: {
      fontFamily: "Public Sans",
      fontSize: 12,
      fontWeight: 400,
      lineHeight: 16
    },
    label: {
      fontFamily: "Public Sans",
      fontSize: 13,
      fontWeight: 400,
      lineHeight: 16
    },
    edge_label: {
      fontFamily: "Public Sans",
      fontSize: 12,
      fontWeight: 400,
      lineHeight: 14
    },
    shared_node_decorator: {
      fontFamily: "Public Sans",
      fontSize: 10,
      fontWeight: 600,
      lineHeight: 12,
      letterSpacing: 0
    },
    shared_node_title: {
      fontFamily: "Public Sans",
      fontSize: 16,
      fontWeight: 600,
      lineHeight: 19,
      letterSpacing: -0.32
    },
    shared_node_attribute_label: {
      fontFamily: "Public Sans",
      fontSize: 10,
      fontWeight: 400,
      lineHeight: 12,
      letterSpacing: 0
    },
    shared_node_attribute_value: {
      fontFamily: "Public Sans",
      fontSize: 12,
      fontWeight: 400,
      lineHeight: 14,
      letterSpacing: 0
    }
  },
  sharedNode: {
    width: 224,
    minHeight: 48,
    container: {
      padding: defaultBoxSpacing(0),
      gap: 0
    },
    cornerRadius: 14,
    strokeWidth: 1.5,
    strokePlacement: "inside",
    fill: "#ffffff",
    stroke: "#387575",
    text: "#0f172a",
    decorator: {
      height: 19,
      padding: defaultBoxSpacing(0, 14, 0, 14),
      gap: 4,
      fill: "#dbe4f0",
      textStyleRole: "shared_node_decorator"
    },
    body: {
      padding: defaultBoxSpacing(6, 14, 6, 14),
      gap: 4
    },
    titleTextStyleRole: "shared_node_title",
    attribute: {
      padding: defaultBoxSpacing(0),
      gap: 2,
      labelTextStyleRole: "shared_node_attribute_label",
      valueTextStyleRole: "shared_node_attribute_value"
    }
  },
  nodePrimitives: {
    card: {
      padding: defaultBoxSpacing(12),
      blockGap: 6,
      secondaryGap: 10,
      minHeight: 48,
      portInset: 12,
      badgePadding: defaultBoxSpacing(4, 8, 4, 8),
      textRule: {
        allowedKinds: ["text", "badge_text", "metadata"],
        movableSecondaryKinds: ["badge_text", "metadata"]
      }
    },
    header: {
      padding: defaultBoxSpacing(10, 12, 10, 12),
      blockGap: 4,
      secondaryGap: 8,
      minHeight: 36,
      portInset: 10,
      badgePadding: defaultBoxSpacing(4, 8, 4, 8),
      textRule: {
        allowedKinds: ["text", "badge_text", "metadata"],
        movableSecondaryKinds: ["badge_text", "metadata"]
      }
    },
    badge: {
      padding: defaultBoxSpacing(4, 8, 4, 8),
      blockGap: 0,
      secondaryGap: 0,
      minHeight: 22,
      portInset: 8,
      badgePadding: defaultBoxSpacing(4, 8, 4, 8),
      textRule: {
        allowedKinds: ["badge_text", "text"],
        movableSecondaryKinds: ["badge_text"],
        maxBlocks: 1
      }
    },
    label: {
      padding: defaultBoxSpacing(0),
      blockGap: 4,
      secondaryGap: 6,
      minHeight: 16,
      portInset: 8,
      textRule: {
        allowedKinds: ["text", "metadata"],
        movableSecondaryKinds: ["metadata"]
      }
    },
    annotation_list: {
      padding: defaultBoxSpacing(8, 10, 8, 10),
      blockGap: 4,
      secondaryGap: 8,
      minHeight: 24,
      portInset: 8,
      textRule: {
        allowedKinds: ["metadata", "text"],
        movableSecondaryKinds: ["metadata"]
      }
    },
    edge_label: {
      padding: defaultBoxSpacing(4, 6, 4, 6),
      blockGap: 0,
      secondaryGap: 0,
      minHeight: 18,
      portInset: 6,
      textRule: {
        allowedKinds: ["edge_label", "text"],
        movableSecondaryKinds: [],
        maxBlocks: 1
      }
    },
    connector_port: {
      padding: defaultBoxSpacing(0),
      blockGap: 0,
      secondaryGap: 0,
      minHeight: 8,
      portInset: 0,
      textRule: {
        allowedKinds: [],
        movableSecondaryKinds: [],
        maxBlocks: 0
      }
    }
  },
  containerPrimitives: {
    root: {
      defaultPadding: defaultBoxSpacing(16),
      defaultGutter: 24,
      defaultHeaderBandHeight: 0,
      portInset: 16
    },
    cluster: {
      defaultPadding: defaultBoxSpacing(12),
      defaultGutter: 12,
      defaultHeaderBandHeight: 28,
      portInset: 12
    },
    lane: {
      defaultPadding: defaultBoxSpacing(12, 16, 12, 16),
      defaultGutter: 16,
      defaultHeaderBandHeight: 28,
      portInset: 12
    },
    stack: {
      defaultPadding: defaultBoxSpacing(0),
      defaultGutter: 12,
      defaultHeaderBandHeight: 0,
      portInset: 8
    },
    grid: {
      defaultPadding: defaultBoxSpacing(0),
      defaultGutter: 12,
      defaultHeaderBandHeight: 0,
      portInset: 8
    }
  },
  paint: {
    canvasBackground: "transparent",
    strokeWidth: 1.5,
    edgeStrokeWidth: 2,
    portRadius: 4,
    arrowSize: 10,
    cornerRadii: {
      container: {
        root: 18,
        cluster: 16,
        lane: 16,
        stack: 0,
        grid: 0
      },
      node: {
        card: 14,
        header: 12,
        badge: 999,
        label: 6,
        annotation_list: 10,
        edge_label: 8,
        connector_port: 999
      }
    },
    palette: {
      canvas: "#f7f8fb",
      containerFill: "#eef2f7",
      containerStroke: "#94a3b8",
      headerBandFill: "#dbe4f0",
      nodeFill: "#ffffff",
      nodeStroke: "#64748b",
      badgeFill: "#dbeafe",
      badgeStroke: "#2563eb",
      connectorPortFill: "#ffffff",
      connectorPortStroke: "#2563eb",
      text: "#0f172a",
      secondaryText: "#475569",
      edge: "#1d4ed8",
      edgeLabelFill: "#ffffff",
      edgeLabelStroke: "#93c5fd"
    }
  }
};

interface RendererThemeRegistryEntry {
  theme: RendererTheme;
  unknownThemeId?: string;
  incompleteFontWeights: number[];
}

const themeRegistry = new Map<string, RendererThemeRegistryEntry>([[
  defaultTheme.id,
  {
    theme: defaultTheme,
    incompleteFontWeights: []
  }
]]);

export interface ResolvedRendererTheme {
  theme: RendererTheme;
  diagnostics: RendererDiagnostic[];
}

function getRequiredFontWeights(theme: RendererTheme): number[] {
  return [...new Set(
    Object.values(theme.textStyles).map((style) => style.fontWeight)
  )].sort((left, right) => left - right);
}

/** Registers a fully resolved renderer-owned theme for measurement and backend use. */
export function registerRendererTheme(theme: RendererTheme): string {
  if (!theme.id.trim()) {
    throw new Error("Renderer themes require a non-empty id.");
  }
  const copied = structuredClone(theme);
  const availableWeights = new Set(copied.fontFaces.map((face) => face.fontWeight));
  const incompleteFontWeights = getRequiredFontWeights(copied).filter(
    (fontWeight) => !availableWeights.has(fontWeight)
  );
  themeRegistry.set(copied.id, {
    theme: copied,
    incompleteFontWeights
  });
  return copied.id;
}

function isCompleteStagedFontFace(
  face: StagedPreviewStyle["fontFaces"][number] | undefined
): boolean {
  return Boolean(
    face?.measurementFontAssetPath &&
    face.svgFontAssetPath &&
    face.pngFontAssetPath
  );
}

export function registerStagedRendererTheme(
  requestedThemeId: string,
  style: StagedPreviewStyle
): string {
  const baseEntry = themeRegistry.get(requestedThemeId);
  const baseTheme = baseEntry?.theme ?? defaultTheme;
  const overrideFaces = [...style.fontFaces].sort((left, right) => left.fontWeight - right.fontWeight);
  const registryHash = createHash("sha256")
    .update(JSON.stringify({
      requestedThemeId,
      fontFamily: style.fontFamily,
      fontFaces: overrideFaces,
      widthBands: style.widthBands,
      dpi: style.dpi
    }))
    .digest("hex")
    .slice(0, 16);
  const registryId = `${requestedThemeId}@fonts-${registryHash}`;
  if (themeRegistry.has(registryId)) {
    return registryId;
  }

  const overridesByWeight = new Map(overrideFaces.map((face) => [face.fontWeight, face] as const));
  const mergedFacesByWeight = new Map(
    baseTheme.fontFaces.map((face) => [face.fontWeight, { ...face }] as const)
  );

  for (const override of overrideFaces) {
    const fallback = mergedFacesByWeight.get(override.fontWeight);
    if (!fallback) {
      if (!isCompleteStagedFontFace(override)) {
        continue;
      }
      mergedFacesByWeight.set(override.fontWeight, {
        fontWeight: override.fontWeight,
        fontStyle: "normal",
        measurementFontAssetPath: override.measurementFontAssetPath!,
        svgFontAssetPath: override.svgFontAssetPath!,
        pngFontAssetPath: override.pngFontAssetPath!
      });
      continue;
    }

    mergedFacesByWeight.set(override.fontWeight, {
      ...fallback,
      ...(override.measurementFontAssetPath
        ? { measurementFontAssetPath: override.measurementFontAssetPath }
        : {}),
      ...(override.svgFontAssetPath
        ? { svgFontAssetPath: override.svgFontAssetPath }
        : {}),
      ...(override.pngFontAssetPath
        ? { pngFontAssetPath: override.pngFontAssetPath }
        : {})
    });
  }

  const incompleteFontWeights = getRequiredFontWeights(baseTheme).filter((fontWeight) =>
    !isCompleteStagedFontFace(overridesByWeight.get(fontWeight))
  );
  const theme: RendererTheme = {
    ...baseTheme,
    fontFamily: style.fontFamily,
    fontFaces: [...mergedFacesByWeight.values()].sort(
      (left, right) => left.fontWeight - right.fontWeight
    ),
    widthBands: {
      ...baseTheme.widthBands,
      ...(style.widthBands ?? {})
    },
    dpi: style.dpi
  };

  themeRegistry.set(registryId, {
    theme,
    ...(baseEntry ? {} : { unknownThemeId: requestedThemeId }),
    incompleteFontWeights
  });
  return registryId;
}

export function getRendererFontFace(theme: RendererTheme, fontWeight: number): RendererFontFace {
  const face = theme.fontFaces.find((candidate) => candidate.fontWeight === fontWeight);
  if (!face) {
    throw new Error(
      `Staged renderer theme "${theme.id}" does not provide font weight ${fontWeight}.`
    );
  }
  return face;
}

export function resolveRendererTheme(
  themeId: string,
  diagnosticPhase: RendererDiagnosticPhase = "measure"
): ResolvedRendererTheme {
  const entry = themeRegistry.get(themeId);
  if (entry) {
    const diagnostics: RendererDiagnostic[] = [];
    if (entry.unknownThemeId) {
      diagnostics.push(createRendererDiagnostic(
        diagnosticPhase,
        `renderer.${diagnosticPhase}.unknown_theme`,
        "warn",
        `Unknown staged renderer theme "${entry.unknownThemeId}". Falling back to "default".`
      ));
    }
    for (const fontWeight of entry.incompleteFontWeights) {
      diagnostics.push(createRendererDiagnostic(
        diagnosticPhase,
        `renderer.${diagnosticPhase}.incomplete_font_weight`,
        "warn",
        `Configured staged font weight ${fontWeight} is incomplete. Falling back to the theme's vendored face.`
      ));
    }
    return {
      theme: entry.theme,
      diagnostics
    };
  }

  return {
    theme: defaultTheme,
    diagnostics: [
      createRendererDiagnostic(
        diagnosticPhase,
        `renderer.${diagnosticPhase}.unknown_theme`,
        "warn",
        `Unknown staged renderer theme "${themeId}". Falling back to "default".`
      )
    ]
  };
}

export function getRendererTheme(themeId: string, diagnosticPhase: RendererDiagnosticPhase = "measure"): RendererTheme {
  return resolveRendererTheme(themeId, diagnosticPhase).theme;
}
