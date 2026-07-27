import { describe, expect, it } from "vitest";
import type {
  JourneyMapRenderModel,
  JourneyRenderEdge,
  JourneyRenderStep
} from "../src/renderer/journeyMapRenderModel.js";
import {
  buildJourneyMapRendererSceneFromModel,
  positionJourneyMapMeasuredSceneBeforeRouting
} from "../src/renderer/staged/journeyMap.js";
import { buildJourneyScenePlacement } from "../src/renderer/staged/journeyMapMiddleLayer.js";
import { measureScene } from "../src/renderer/staged/pipeline.js";

function step(id: string): JourneyRenderStep {
  return {
    kind: "step",
    id,
    labelLines: [id],
    badges: [],
    orderAnchorId: id
  };
}

function edge(from: string, to: string, authorOrder: number): JourneyRenderEdge {
  return {
    id: `${from}__PRECEDES__${to}__${authorOrder}`,
    from,
    type: "PRECEDES",
    to,
    authorOrder,
    sameEndpointOrdinal: 0,
    semanticIdentityKey: `${from}:${to}:${authorOrder}`,
    exactIdentityOrdinal: 0
  };
}

function model(stepIds: string[], pairs: Array<[string, string]>): JourneyMapRenderModel {
  return {
    rootItems: [
      {
        kind: "stage",
        id: "G",
        label: "Stage",
        anchorId: "G",
        orderAnchorId: "G",
        items: stepIds.map(step)
      }
    ],
    edges: pairs.map(([from, to], authorOrder) => edge(from, to, authorOrder)),
    siblingOrderChains: [["G", ...stepIds]]
  };
}

const simpleDiamondPairs: Array<[string, string]> = [
  ["S", "A"],
  ["S", "B"],
  ["A", "J"],
  ["B", "J"]
];

describe("Journey middle-layer placement", () => {
  it("recognizes a simple diamond without changing authored child order", () => {
    const renderModel = model(["S", "A", "B", "J"], simpleDiamondPairs);
    const placement = buildJourneyScenePlacement(renderModel);
    const scene = buildJourneyMapRendererSceneFromModel(renderModel, "strict");
    const stage = scene.root.children[0];

    expect(placement.diamondGroups).toEqual([
      {
        id: "G__diamond__S__J",
        stageId: "G",
        splitStepId: "S",
        optionStepIds: ["A", "B"],
        joinStepId: "J"
      }
    ]);
    expect(stage.kind).toBe("container");
    if (stage.kind !== "container") {
      return;
    }
    expect(stage.children.map((child) => child.id)).toEqual(["S", "A", "B", "J"]);
    expect(stage.layout).toEqual({
      strategy: "grid",
      columns: 4,
      gap: 24,
      crossAlignment: "start",
      grid: {
        placements: [
          { itemId: "S", row: 0, column: 0 },
          { itemId: "A", row: 0, column: 1 },
          { itemId: "B", row: 1, column: 1 },
          { itemId: "J", row: 0, column: 2 }
        ]
      }
    });
    expect(stage.children.map((child) => child.viewMetadata?.journeyMap)).toEqual([
      expect.objectContaining({ stepOrder: 0, globalStepOrder: 0, progressionColumn: 0, laneOrder: 0, placementRole: "diamond_split" }),
      expect.objectContaining({ stepOrder: 1, globalStepOrder: 1, progressionColumn: 1, laneOrder: 0, placementRole: "diamond_option" }),
      expect.objectContaining({ stepOrder: 2, globalStepOrder: 2, progressionColumn: 1, laneOrder: 1, placementRole: "diamond_option" }),
      expect.objectContaining({ stepOrder: 3, globalStepOrder: 3, progressionColumn: 2, laneOrder: 0, placementRole: "diamond_join" })
    ]);
  });

  it("recognizes multiple disjoint authored diamonds with stable group IDs", () => {
    const renderModel = model(
      ["S1", "A1", "B1", "J1", "S2", "A2", "B2", "J2"],
      [
        ["S1", "A1"], ["S1", "B1"], ["A1", "J1"], ["B1", "J1"],
        ["J1", "S2"],
        ["S2", "A2"], ["S2", "B2"], ["A2", "J2"], ["B2", "J2"]
      ]
    );
    const placement = buildJourneyScenePlacement(renderModel);

    expect(placement.diamondGroups.map((group) => group.id)).toEqual([
      "G__diamond__S1__J1",
      "G__diamond__S2__J2"
    ]);
    expect(placement.gridPlacementsByStageId.get("G")).toEqual([
      { itemId: "S1", row: 0, column: 0 },
      { itemId: "A1", row: 0, column: 1 },
      { itemId: "B1", row: 1, column: 1 },
      { itemId: "J1", row: 0, column: 2 },
      { itemId: "S2", row: 0, column: 3 },
      { itemId: "A2", row: 0, column: 4 },
      { itemId: "B2", row: 1, column: 4 },
      { itemId: "J2", row: 0, column: 5 }
    ]);
  });

  it("rejects an entire Stage when recognized diamonds share a join/split", () => {
    const renderModel = model(
      ["S", "A", "B", "J", "C", "D", "K"],
      [
        ["S", "A"], ["S", "B"], ["A", "J"], ["B", "J"],
        ["J", "C"], ["J", "D"], ["C", "K"], ["D", "K"]
      ]
    );
    const placement = buildJourneyScenePlacement(renderModel);
    expect(placement.diamondGroups).toEqual([]);
    expect(placement.gridPlacementsByStageId.has("G")).toBe(false);
  });

  it("escapes delimiter-bearing semantic IDs so group IDs remain distinct", () => {
    const renderModel = model(
      ["S__X", "A1", "B1", "J", "S", "A2", "B2", "X__J"],
      [
        ["S__X", "A1"], ["S__X", "B1"], ["A1", "J"], ["B1", "J"],
        ["J", "S"],
        ["S", "A2"], ["S", "B2"], ["A2", "X__J"], ["B2", "X__J"]
      ]
    );
    const placement = buildJourneyScenePlacement(renderModel);
    const groupIds = placement.diamondGroups.map((group) => group.id);

    expect(groupIds).toEqual([
      "G__diamond__S%5F%5FX__J",
      "G__diamond__S__X%5F%5FJ"
    ]);
    expect(new Set(groupIds).size).toBe(groupIds.length);
  });

  it("keeps component-boundary underscores injective", () => {
    const renderModel = model(
      ["S__X_", "A1", "B1", "J", "S__X", "A2", "B2", "_J"],
      [
        ["S__X_", "A1"], ["S__X_", "B1"], ["A1", "J"], ["B1", "J"],
        ["J", "S__X"],
        ["S__X", "A2"], ["S__X", "B2"], ["A2", "_J"], ["B2", "_J"]
      ]
    );
    const groupIds = buildJourneyScenePlacement(renderModel).diamondGroups.map((group) => group.id);

    expect(groupIds).toEqual([
      "G__diamond__S%5F%5FX%5F__J",
      "G__diamond__S%5F%5FX__%5FJ"
    ]);
    expect(new Set(groupIds).size).toBe(groupIds.length);
  });

  it.each([
    ["duplicate", ["S", "A", "B", "J"], [...simpleDiamondPairs, ["S", "A"]]],
    ["cycle", ["S", "A", "B", "J"], [...simpleDiamondPairs, ["J", "S"]]],
    ["incomplete option", ["S", "A", "B", "J"], simpleDiamondPairs.slice(0, -1)],
    ["non-contiguous options", ["S", "X", "A", "B", "J"], simpleDiamondPairs],
    ["cross-stage target", ["S", "A", "B", "J"], [...simpleDiamondPairs, ["S", "OUTSIDE"]]],
    ["nested option", ["S", "A", "B", "J"], [...simpleDiamondPairs, ["A", "B"]]]
  ] as const)("keeps %s topology on the existing horizontal stack", (_name, stepIds, pairs) => {
    const renderModel = model([...stepIds], [...pairs] as Array<[string, string]>);
    const placement = buildJourneyScenePlacement(renderModel);
    const scene = buildJourneyMapRendererSceneFromModel(renderModel, "strict");
    const stage = scene.root.children[0];

    expect(placement.diamondGroups).toEqual([]);
    expect(placement.gridPlacementsByStageId.has("G")).toBe(false);
    expect(stage.kind).toBe("container");
    if (stage.kind === "container") {
      expect(stage.layout).toEqual({
        strategy: "stack",
        direction: "horizontal",
        gap: 24,
        crossAlignment: "start"
      });
    }
    expect(scene.diagnostics).toEqual([]);
  });

  it("falls back from malformed Journey grid intent to the former one-row geometry", async () => {
    const diamondModel = model(["S", "A", "B", "J"], simpleDiamondPairs);
    const invalidGridScene = buildJourneyMapRendererSceneFromModel(diamondModel, "strict");
    const invalidStage = invalidGridScene.root.children[0];
    if (invalidStage.kind !== "container" || invalidStage.layout.grid === undefined) {
      throw new Error("Expected the proof Stage to use explicit grid placement.");
    }
    invalidStage.layout.grid.placements = invalidStage.layout.grid.placements.slice(0, -1);

    const horizontalScene = buildJourneyMapRendererSceneFromModel(
      { ...diamondModel, edges: [] },
      "strict"
    );
    const invalidMeasured = measureScene(invalidGridScene);
    const horizontalMeasured = measureScene(horizontalScene);
    const invalidPositioned = await positionJourneyMapMeasuredSceneBeforeRouting(invalidMeasured);
    const horizontalPositioned = await positionJourneyMapMeasuredSceneBeforeRouting(horizontalMeasured);
    const invalidPositionedStage = invalidPositioned.root.children[0];
    const horizontalPositionedStage = horizontalPositioned.root.children[0];

    expect(invalidPositionedStage.kind).toBe("container");
    expect(horizontalPositionedStage.kind).toBe("container");
    if (invalidPositionedStage.kind !== "container" || horizontalPositionedStage.kind !== "container") {
      return;
    }
    expect(invalidPositionedStage.children.map(({ x, y, width, height }) => ({ x, y, width, height }))).toEqual(
      horizontalPositionedStage.children.map(({ x, y, width, height }) => ({ x, y, width, height }))
    );
    expect(invalidPositioned.diagnostics).toContainEqual(expect.objectContaining({
      code: "renderer.layout.invalid_grid_placements",
      severity: "warn",
      targetId: "G"
    }));
  });
});
