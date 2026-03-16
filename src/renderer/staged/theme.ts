import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  BoxSpacing,
  ContentBlockKind,
  SceneContainerPrimitive,
  SceneNodePrimitive,
  WidthBand
} from "./contracts.js";
import type { RendererDiagnostic } from "./diagnostics.js";

export interface TextStyleToken {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
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

export interface RendererTheme {
  id: string;
  revision: string;
  fontFamily: string;
  fontAssets: {
    measurement: string;
    svg: string;
    png: string;
  };
  widthBands: Record<WidthBand, number>;
  edgeLabelMaxWidth: number;
  textStyles: Record<string, TextStyleToken>;
  nodePrimitives: Record<SceneNodePrimitive, NodePrimitiveTheme>;
  containerPrimitives: Record<SceneContainerPrimitive, ContainerPrimitiveTheme>;
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
  revision: "public-sans-v0.1",
  fontFamily: "Public Sans",
  fontAssets: {
    measurement: path.resolve(bundledFontsRoot, "PublicSans-Regular.otf"),
    svg: path.resolve(bundledFontsRoot, "PublicSans-Regular.woff"),
    png: path.resolve(bundledFontsRoot, "PublicSans-Regular.otf")
  },
  widthBands: {
    chip: 96,
    narrow: 168,
    standard: 224,
    wide: 304
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
      textRule: {
        allowedKinds: ["text", "metadata"],
        movableSecondaryKinds: ["metadata"],
        maxBlocks: 2
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
  }
};

const themeRegistry = new Map<string, RendererTheme>([[defaultTheme.id, defaultTheme]]);

export interface ResolvedRendererTheme {
  theme: RendererTheme;
  diagnostics: RendererDiagnostic[];
}

export function resolveRendererTheme(themeId: string): ResolvedRendererTheme {
  const theme = themeRegistry.get(themeId);
  if (theme) {
    return {
      theme,
      diagnostics: []
    };
  }

  return {
    theme: defaultTheme,
    diagnostics: [
      {
        phase: "measure",
        code: "renderer.measure.unknown_theme",
        severity: "warn",
        message: `Unknown staged renderer theme "${themeId}". Falling back to "default".`
      }
    ]
  };
}

export function getRendererTheme(themeId: string): RendererTheme {
  return resolveRendererTheme(themeId).theme;
}
