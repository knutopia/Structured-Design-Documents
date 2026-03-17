import { describe, expect, it } from "vitest";
import {
  buildCardNode,
  buildCardinalPorts,
  buildContainerContractPorts,
  buildContractTargetPorts,
  buildDiagramRootContainer,
  buildIaPlaceMapPorts,
  buildTransitionPorts
} from "../src/renderer/staged/sceneBuilders.js";

describe("staged scene builders", () => {
  it("builds diagram roots with the shared staged metadata", () => {
    expect(buildDiagramRootContainer({
      viewId: "ui_contracts",
      layout: {
        strategy: "stack",
        direction: "vertical",
        gap: 24,
        crossAlignment: "stretch"
      },
      chrome: {
        padding: {
          top: 24,
          right: 24,
          bottom: 24,
          left: 24
        },
        gutter: 24,
        headerBandHeight: 0
      },
      children: []
    })).toEqual({
      kind: "container",
      id: "root",
      role: "diagram_root",
      primitive: "root",
      classes: ["diagram", "ui_contracts"],
      layout: {
        strategy: "stack",
        direction: "vertical",
        gap: 24,
        crossAlignment: "stretch"
      },
      chrome: {
        padding: {
          top: 24,
          right: 24,
          bottom: 24,
          left: 24
        },
        gutter: 24,
        headerBandHeight: 0
      },
      children: [],
      ports: []
    });
  });

  it("builds staged card nodes with the shared overflow default", () => {
    expect(buildCardNode({
      id: "P-010",
      role: "place",
      classes: ["place"],
      widthPolicy: {
        preferred: "narrow",
        allowed: ["narrow", "standard", "wide"]
      },
      content: [],
      ports: buildCardinalPorts()
    })).toEqual(expect.objectContaining({
      kind: "node",
      id: "P-010",
      role: "place",
      primitive: "card",
      classes: ["place"],
      widthPolicy: {
        preferred: "narrow",
        allowed: ["narrow", "standard", "wide"]
      },
      overflowPolicy: {
        kind: "escalate_width_band",
        maxLines: 2
      }
    }));
  });

  it("builds the shared reusable port families", () => {
    expect(buildCardinalPorts()).toEqual([
      { id: "north", role: "north", side: "north", offset: undefined, offsetPolicy: undefined },
      { id: "south", role: "south", side: "south", offset: undefined, offsetPolicy: undefined },
      { id: "east", role: "east", side: "east", offset: undefined, offsetPolicy: undefined },
      { id: "west", role: "west", side: "west", offset: undefined, offsetPolicy: undefined }
    ]);
    expect(buildIaPlaceMapPorts()).toEqual([
      { id: "north_chain", role: "north_chain", side: "north", offset: 24, offsetPolicy: undefined },
      { id: "south_chain", role: "south_chain", side: "south", offset: 24, offsetPolicy: undefined },
      { id: "east", role: "east", side: "east", offset: undefined, offsetPolicy: undefined },
      { id: "west", role: "west", side: "west", offset: undefined, offsetPolicy: undefined }
    ]);
    expect(buildTransitionPorts("VS-010")).toEqual([
      { id: "VS-010__transition_in", role: "transition_in", side: "west", offset: undefined, offsetPolicy: undefined },
      { id: "VS-010__transition_out", role: "transition_out", side: "east", offset: undefined, offsetPolicy: undefined }
    ]);
    expect(buildContainerContractPorts("C-010")).toEqual([
      { id: "C-010__contract_out", role: "contract_out", side: "west", offset: undefined, offsetPolicy: "content_start" }
    ]);
    expect(buildContractTargetPorts("SA-010")).toEqual([
      { id: "SA-010__contract_in", role: "contract_in", side: "west", offset: undefined, offsetPolicy: undefined }
    ]);
  });
});
