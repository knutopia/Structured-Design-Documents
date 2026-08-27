import { describe, expect, it } from "vitest";
import type { RendererJourneyMapLayoutConfig } from "../src/bundle/types.js";
import type {
  JourneyMapRenderModel,
  JourneyRenderEdge,
  JourneyRenderStep
} from "../src/renderer/journeyMapRenderModel.js";
import {
  buildJourneyMapRendererSceneFromModel as buildJourneyMapRendererSceneFromModelWithLayout,
  positionJourneyMapMeasuredSceneBeforeRouting
} from "../src/renderer/staged/journeyMap.js";
import { buildJourneyScenePlacement as buildJourneyScenePlacementWithLayout } from "../src/renderer/staged/journeyMapMiddleLayer.js";
import { measureScene } from "../src/renderer/staged/pipeline.js";

const STACKED_LAYOUT: RendererJourneyMapLayoutConfig = {
  branch_placement: "stacked",
  branch_order: "source",
  scope: "sibling_steps",
  disconnected_components: "source_sequential",
  unsupported_branch_fallback: "source_row"
};

function buildJourneyScenePlacement(
  renderModel: JourneyMapRenderModel,
  layout: RendererJourneyMapLayoutConfig = STACKED_LAYOUT
) {
  return buildJourneyScenePlacementWithLayout(renderModel, layout);
}

function buildJourneyMapRendererSceneFromModel(
  renderModel: JourneyMapRenderModel,
  detailId: string
) {
  return buildJourneyMapRendererSceneFromModelWithLayout(renderModel, detailId, STACKED_LAYOUT);
}

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

  it("stacks sequential splits even when the first join is the next split", () => {
    const renderModel = model(
      ["S", "A", "B", "J", "C", "D", "K"],
      [
        ["S", "A"], ["S", "B"], ["A", "J"], ["B", "J"],
        ["J", "C"], ["J", "D"], ["C", "K"], ["D", "K"]
      ]
    );
    const placement = buildJourneyScenePlacement(renderModel);
    expect(placement.diamondGroups).toEqual([]);
    expect(placement.branchGroups.map((group) => group.splitStepId)).toEqual(["S", "J"]);
    expect(placement.gridPlacementsByStageId.get("G")).toEqual([
      { itemId: "S", row: 0, column: 0 },
      { itemId: "A", row: 0, column: 1 },
      { itemId: "B", row: 1, column: 1 },
      { itemId: "J", row: 0, column: 2 },
      { itemId: "C", row: 0, column: 3 },
      { itemId: "D", row: 1, column: 3 },
      { itemId: "K", row: 0, column: 4 }
    ]);
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
    ["cycle", ["S", "A", "B", "J"], [...simpleDiamondPairs, ["J", "S"]]],
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

  it.each([
    ["duplicate edge occurrence", ["S", "A", "B", "J"], [...simpleDiamondPairs, ["S", "A"]]],
    ["open branch", ["S", "A", "B", "J"], simpleDiamondPairs.slice(0, -1)],
    ["source-interleaved unrelated Step", ["S", "X", "A", "B", "J"], simpleDiamondPairs]
  ] as const)("stacks %s without inventing another branch target", (_name, stepIds, pairs) => {
    const placement = buildJourneyScenePlacement(
      model([...stepIds], [...pairs] as Array<[string, string]>)
    );
    expect(placement.gridPlacementsByStageId.has("G")).toBe(true);
    expect(placement.branchGroups[0]?.targetStepIds).toEqual(["A", "B"]);
  });

  it("allocates nested branch rows before the next outer arm", () => {
    const placement = buildJourneyScenePlacement(model(
      ["S", "A", "B", "B1", "B2", "C"],
      [["S", "A"], ["S", "B"], ["S", "C"], ["B", "B1"], ["B", "B2"]]
    ));
    expect(placement.gridPlacementsByStageId.get("G")).toEqual([
      { itemId: "S", row: 0, column: 0 },
      { itemId: "A", row: 0, column: 1 },
      { itemId: "B", row: 1, column: 1 },
      { itemId: "B1", row: 1, column: 2 },
      { itemId: "B2", row: 2, column: 2 },
      { itemId: "C", row: 3, column: 1 }
    ]);
  });

  it("keeps the bundle-selectable inline policy on the source row", () => {
    const renderModel = model(["S", "A", "B", "J"], simpleDiamondPairs);
    const placement = buildJourneyScenePlacement(renderModel, {
      ...STACKED_LAYOUT,
      branch_placement: "inline"
    });
    expect(placement.gridPlacementsByStageId.has("G")).toBe(false);
    expect(placement.branchGroups).toEqual([]);
  });

  it("stacks the topology-challenge branches while keeping the disconnected journey sequential", () => {
    const stepIds = [
      "J-010", "J-020", "J-040", "J-041", "J-042", "J-043",
      "J-021", "J-022", "J-030", "J-031", "J-032"
    ];
    const renderModel: JourneyMapRenderModel = {
      rootItems: [
        {
          kind: "stage",
          id: "G-001",
          label: "Maintain Product Map",
          anchorId: "G-001",
          orderAnchorId: "G-001",
          items: []
        },
        ...stepIds.map(step)
      ],
      edges: [
        ["J-010", "J-020"], ["J-010", "J-040"],
        ["J-020", "J-021"], ["J-021", "J-022"],
        ["J-040", "J-041"], ["J-040", "J-042"], ["J-040", "J-043"],
        ["J-030", "J-031"], ["J-031", "J-032"]
      ].map(([from, to], authorOrder) => edge(from!, to!, authorOrder)),
      siblingOrderChains: [["G-001", ...stepIds]]
    };

    const placement = buildJourneyScenePlacement(renderModel);
    expect(placement.rootGridPlacements).toEqual([
      { itemId: "G-001", row: 0, column: 0 },
      { itemId: "J-010", row: 0, column: 1 },
      { itemId: "J-020", row: 0, column: 2 },
      { itemId: "J-040", row: 1, column: 2 },
      { itemId: "J-041", row: 1, column: 3 },
      { itemId: "J-042", row: 2, column: 3 },
      { itemId: "J-043", row: 3, column: 3 },
      { itemId: "J-021", row: 0, column: 3 },
      { itemId: "J-022", row: 0, column: 4 },
      { itemId: "J-030", row: 0, column: 5 },
      { itemId: "J-031", row: 0, column: 6 },
      { itemId: "J-032", row: 0, column: 7 }
    ]);
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
