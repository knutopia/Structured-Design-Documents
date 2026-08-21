import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Bundle, ViewSpec } from "../src/bundle/types.js";
import {
  resolveLegacyDotPreviewStyle,
  resolveStagedPreviewStyle
} from "../src/renderer/previewStyle.js";
import { createMockSyntaxConfig } from "./mockSyntaxConfig.js";

function createView(rendererDefaults: ViewSpec["conventions"]["renderer_defaults"] = {}): ViewSpec {
  return {
    id: "ia_place_map",
    name: "IA Place Map",
    status: "operational",
    projection: {
      include_node_types: [],
      include_edge_types: [],
      hierarchy_edges: [],
      ordering_edges: []
    },
    conventions: {
      renderer_defaults: rendererDefaults
    }
  };
}

function createBundle(view: ViewSpec): Bundle {
  return {
    rootDir: "/repo/bundle/v0.1",
    manifestPath: "/repo/bundle/v0.1/manifest.yaml",
    manifest: {
      bundle_name: "test",
      bundle_version: "0.1.0",
      language: "sdd",
      language_version: "0.1",
      core: {
        vocab: "core/vocab.yaml",
        syntax: "core/syntax.yaml",
        schema: "core/schema.json",
        contracts: "core/contracts.yaml",
        projection_schema: "core/projection_schema.json",
        views: "core/views.yaml"
      },
      tool_defaults: {
        validation_profile_id: "simple",
        render_detail_id: "compact"
      },
      profiles: [],
      render_details: [
        { id: "compact", intent: "low noise" },
        { id: "detailed", intent: "full detail" }
      ],
      examples: [],
      compatibility: {
        requires_compiler_min: "0.1.0",
        notes: []
      }
    },
    vocab: {
      version: "0.1",
      closed_vocab: true,
      node_types: [],
      relationship_types: []
    },
    syntax: createMockSyntaxConfig(),
    schema: {},
    projectionSchema: {},
    contracts: {
      version: "0.1",
      common_rules: [],
      relationships: []
    },
    views: {
      version: "0.1",
      preview_defaults: {
        dot: {
          font_family: "Public Sans",
          svg_font_asset: "assets/fonts/PublicSans-Regular.woff",
          png_font_asset: "assets/fonts/PublicSans-Regular.otf",
          dpi: 192
        },
        staged: {
          font_family: "Public Sans",
          width_bands: {
            chip: 96,
            narrow: 168,
            standard: 224,
            wide: 308
          },
          font_faces: [
            {
              font_weight: 400,
              measurement_font_asset: "assets/fonts/PublicSans-Regular.otf",
              svg_font_asset: "assets/fonts/PublicSans-Regular.woff",
              png_font_asset: "assets/fonts/PublicSans-Regular.otf"
            },
            {
              font_weight: 600,
              measurement_font_asset: "assets/fonts/PublicSans-SemiBold.otf",
              svg_font_asset: "assets/fonts/PublicSans-SemiBold.woff",
              png_font_asset: "assets/fonts/PublicSans-SemiBold.otf"
            }
          ],
          dpi: 192
        }
      },
      views: [view]
    },
    profiles: {}
  };
}

describe("resolveLegacyDotPreviewStyle", () => {
  it("applies bundle-level preview defaults", () => {
    const view = createView();
    const bundle = createBundle(view);

    expect(resolveLegacyDotPreviewStyle(bundle, view)).toEqual({
      fontFamily: "Public Sans",
      svgFontAssetPath: path.resolve("/repo/bundle/v0.1", "assets/fonts/PublicSans-Regular.woff"),
      pngFontAssetPath: path.resolve("/repo/bundle/v0.1", "assets/fonts/PublicSans-Regular.otf"),
      dpi: 192
    });
  });

  it("lets per-view target-specific preview overrides win", () => {
    const view = createView({
      preview: {
        dot: {
          font_family: "Public Sans Display",
          png_font_asset: "assets/fonts/PublicSansDisplay-Regular.otf",
          dpi: 288
        }
      }
    });
    const bundle = createBundle(view);

    expect(resolveLegacyDotPreviewStyle(bundle, view)).toEqual({
      fontFamily: "Public Sans Display",
      svgFontAssetPath: path.resolve("/repo/bundle/v0.1", "assets/fonts/PublicSans-Regular.woff"),
      pngFontAssetPath: path.resolve("/repo/bundle/v0.1", "assets/fonts/PublicSansDisplay-Regular.otf"),
      dpi: 288
    });
  });

  it("falls back to the legacy shared font_asset for both targets", () => {
    const view = createView();
    const bundle = {
      ...createBundle(view),
      views: {
        version: "0.1",
        preview_defaults: {
          dot: {
            font_family: "Public Sans",
            font_asset: "assets/fonts/LegacyPublicSans-Regular.woff",
            dpi: 192
          }
        },
        views: [view]
      }
    } satisfies Bundle;

    expect(resolveLegacyDotPreviewStyle(bundle, view)).toEqual({
      fontFamily: "Public Sans",
      svgFontAssetPath: path.resolve("/repo/bundle/v0.1", "assets/fonts/LegacyPublicSans-Regular.woff"),
      pngFontAssetPath: path.resolve("/repo/bundle/v0.1", "assets/fonts/LegacyPublicSans-Regular.woff"),
      dpi: 192
    });
  });
});

describe("resolveStagedPreviewStyle", () => {
  it("resolves bundle-owned font faces in deterministic weight order", () => {
    const view = createView();
    const bundle = createBundle(view);

    expect(resolveStagedPreviewStyle(bundle, view)).toEqual({
      fontFamily: "Public Sans",
      fontFaces: [
        {
          fontWeight: 400,
          measurementFontAssetPath: path.resolve(
            "/repo/bundle/v0.1",
            "assets/fonts/PublicSans-Regular.otf"
          ),
          svgFontAssetPath: path.resolve(
            "/repo/bundle/v0.1",
            "assets/fonts/PublicSans-Regular.woff"
          ),
          pngFontAssetPath: path.resolve(
            "/repo/bundle/v0.1",
            "assets/fonts/PublicSans-Regular.otf"
          )
        },
        {
          fontWeight: 600,
          measurementFontAssetPath: path.resolve(
            "/repo/bundle/v0.1",
            "assets/fonts/PublicSans-SemiBold.otf"
          ),
          svgFontAssetPath: path.resolve(
            "/repo/bundle/v0.1",
            "assets/fonts/PublicSans-SemiBold.woff"
          ),
          pngFontAssetPath: path.resolve(
            "/repo/bundle/v0.1",
            "assets/fonts/PublicSans-SemiBold.otf"
          )
        }
      ],
      widthBands: {
        chip: 96,
        narrow: 168,
        standard: 224,
        wide: 308
      },
      dpi: 192
    });
  });

  it("merges per-view staged face overrides by weight", () => {
    const view = createView({
      preview: {
        staged: {
          font_faces: [
            {
              font_weight: 600,
              svg_font_asset: "assets/fonts/Custom-SemiBold.woff"
            }
          ],
          dpi: 288
        }
      }
    });
    const bundle = createBundle(view);

    expect(resolveStagedPreviewStyle(bundle, view)).toEqual(
      expect.objectContaining({
        dpi: 288,
        widthBands: {
          chip: 96,
          narrow: 168,
          standard: 224,
          wide: 308
        },
        fontFaces: [
          expect.objectContaining({
            fontWeight: 400,
            svgFontAssetPath: path.resolve(
              "/repo/bundle/v0.1",
              "assets/fonts/PublicSans-Regular.woff"
            )
          }),
          {
            fontWeight: 600,
            measurementFontAssetPath: path.resolve(
              "/repo/bundle/v0.1",
              "assets/fonts/PublicSans-SemiBold.otf"
            ),
            svgFontAssetPath: path.resolve(
              "/repo/bundle/v0.1",
              "assets/fonts/Custom-SemiBold.woff"
            ),
            pngFontAssetPath: path.resolve(
              "/repo/bundle/v0.1",
              "assets/fonts/PublicSans-SemiBold.otf"
            )
          }
        ]
      })
    );
  });
});
