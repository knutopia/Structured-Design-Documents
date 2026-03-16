import { describe, expect, it } from "vitest";
import { getViewRenderCapability } from "../src/renderer/viewRenderers.js";

describe("view render capabilities", () => {
  it("classifies all current renderable views under explicit legacy backends", () => {
    for (const viewId of [
      "ia_place_map",
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
        defaultPreviewFormat: "svg"
      });
    }
  });
});
