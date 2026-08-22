import path from "node:path";
import { describe, expect, it } from "vitest";
import {
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
});
