import { describe, expect, it } from "vitest";
import {
  getPreviewArtifactCapabilities,
  getPreviewArtifactCapability,
  getViewRenderCapability
} from "../src/renderer/viewRenderers.js";

describe("view render capabilities", () => {
  it("defaults ia_place_map previews to the staged backend while preserving legacy preview support", () => {
    const capability = getViewRenderCapability("ia_place_map");

    expect(capability).toBeDefined();
    expect(capability?.textArtifacts).toEqual([
      {
        format: "dot",
        backendId: "legacy_dot",
        backendClass: "legacy"
      },
      {
        format: "mermaid",
        backendId: "legacy_mermaid",
        backendClass: "legacy"
      }
    ]);
    expect(getPreviewArtifactCapabilities(capability!, "svg")).toEqual([
      {
        format: "svg",
        backendId: "staged_ia_place_map_preview",
        backendClass: "staged"
      },
      {
        format: "svg",
        backendId: "legacy_graphviz_preview",
        backendClass: "legacy"
      }
    ]);
    expect(getPreviewArtifactCapabilities(capability!, "png")).toEqual([
      {
        format: "png",
        backendId: "staged_ia_place_map_preview",
        backendClass: "staged"
      },
      {
        format: "png",
        backendId: "legacy_graphviz_preview",
        backendClass: "legacy"
      }
    ]);
    expect(getPreviewArtifactCapability(capability!, "svg")).toEqual({
      format: "svg",
      backendId: "staged_ia_place_map_preview",
      backendClass: "staged"
    });
    expect(getPreviewArtifactCapability(capability!, "png")).toEqual({
      format: "png",
      backendId: "staged_ia_place_map_preview",
      backendClass: "staged"
    });
  });

  it("keeps the remaining views on legacy preview backends", () => {
    for (const viewId of [
      "journey_map",
      "outcome_opportunity_map",
      "service_blueprint",
      "scenario_flow",
      "ui_contracts"
    ]) {
      expect(getViewRenderCapability(viewId)).toEqual({
        textArtifacts: [
          {
            format: "dot",
            backendId: "legacy_dot",
            backendClass: "legacy"
          },
          {
            format: "mermaid",
            backendId: "legacy_mermaid",
            backendClass: "legacy"
          }
        ],
        previewArtifacts: [
          {
            format: "svg",
            backendId: "legacy_graphviz_preview",
            backendClass: "legacy"
          },
          {
            format: "png",
            backendId: "legacy_graphviz_preview",
            backendClass: "legacy"
          }
        ],
        defaultPreviewFormat: "svg",
        defaultPreviewBackends: {
          svg: "legacy_graphviz_preview",
          png: "legacy_graphviz_preview"
        }
      });
    }
  });
});
