import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildExplicitBatchPreviewOutputPath,
  buildPreviewArtifactBasename,
  buildShowPreviewOutputPath
} from "../src/previewArtifactPaths.js";

describe("preview artifact paths", () => {
  it("uses render detail as the default artifact identity", () => {
    expect(buildPreviewArtifactBasename("design.sdd", {
      viewId: "ia_place_map",
      detailId: "compact",
      format: "svg"
    })).toBe("design.ia_place_map.compact.svg");

    expect(buildShowPreviewOutputPath("/work/design.sdd", {
      viewId: "ia_place_map",
      detailId: "compact",
      format: "svg"
    })).toBe(path.join("/work", "design.ia_place_map.compact.svg"));
  });

  it("places an explicit backend after detail", () => {
    expect(buildPreviewArtifactBasename("design.sdd", {
      viewId: "journey_map",
      detailId: "detailed",
      backendId: "legacy_graphviz_preview",
      format: "png"
    })).toBe("design.journey_map.detailed.legacy_graphviz_preview.png");
  });

  it("adds canonical decorator identity while preserving none", () => {
    expect(buildPreviewArtifactBasename("design.sdd", {
      viewId: "ia_place_map",
      detailId: "compact",
      nodeDecoratorModeId: "none",
      format: "svg"
    })).toBe("design.ia_place_map.compact.svg");

    for (const [mode, suffix] of [
      ["type", "type"],
      ["id", "id"],
      ["type,id", "type-id"]
    ] as const) {
      expect(buildPreviewArtifactBasename("design.sdd", {
        viewId: "ia_place_map",
        detailId: "compact",
        nodeDecoratorModeId: mode,
        format: "svg"
      })).toBe(`design.ia_place_map.compact.decorators-${suffix}.svg`);
    }
  });

  it("places decorator identity before an explicit backend", () => {
    expect(buildPreviewArtifactBasename("design.sdd", {
      viewId: "journey_map",
      detailId: "detailed",
      nodeDecoratorModeId: "type,id",
      backendId: "legacy_graphviz_preview",
      format: "png"
    })).toBe("design.journey_map.detailed.decorators-type-id.legacy_graphviz_preview.png");
  });

  it("inserts a batch view modifier before an explicit extension", () => {
    expect(buildExplicitBatchPreviewOutputPath("/work/diagram.svg", "journey_map"))
      .toBe(path.join("/work", "diagram.journey_map.svg"));
    expect(buildExplicitBatchPreviewOutputPath("/work/diagram", "ia_place_map"))
      .toBe(path.join("/work", "diagram.ia_place_map"));
  });
});
