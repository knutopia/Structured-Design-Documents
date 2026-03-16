import { describe, expect, it } from "vitest";
import type {
  MeasuredScene,
  PositionedContainer,
  PositionedItem,
  RendererScene,
  SceneContainer,
  SceneEdge,
  SceneNode
} from "../src/renderer/staged/contracts.js";
import { positionMeasuredScene } from "../src/renderer/staged/macroLayout.js";
import { runStagedRendererPipeline } from "../src/renderer/staged/pipeline.js";
import { expectRendererStageSnapshot } from "./rendererStageSnapshotHarness.js";
import { buildFixtureScene } from "./stagedRendererFixtures.js";

function buildRootScene(
  layout: SceneContainer["layout"],
  children: SceneContainer["children"],
  edges: SceneEdge[] = []
): RendererScene {
  return {
    viewId: "ia_place_map",
    profileId: "recommended",
    themeId: "default",
    root: {
      kind: "container",
      id: "root",
      role: "diagram_root",
      primitive: "root",
      classes: ["diagram", "test_scene"],
      layout,
      chrome: {
        padding: {
          top: 16,
          right: 16,
          bottom: 16,
          left: 16
        },
        gutter: 16
      },
      ports: [],
      children
    },
    edges,
    diagnostics: []
  };
}

function buildCardNode(
  id: string,
  widthBand: "chip" | "narrow" | "standard",
  title = id,
  ports: SceneNode["ports"] = []
): SceneNode {
  return {
    kind: "node",
    id,
    role: "place",
    primitive: "card",
    classes: ["place"],
    widthPolicy: {
      preferred: widthBand,
      allowed: [widthBand]
    },
    overflowPolicy: {
      kind: "grow_height"
    },
    content: [
      {
        id: `${id}-title`,
        kind: "text",
        text: title,
        textStyleRole: "title",
        priority: "primary"
      }
    ],
    ports
  };
}

function buildHybridElkScene(): RendererScene {
  return buildRootScene(
    {
      strategy: "stack",
      direction: "horizontal",
      gap: 24
    },
    [
      {
        kind: "container",
        id: "elk-zone",
        role: "elk_group",
        primitive: "cluster",
        classes: ["elk_group"],
        layout: {
          strategy: "elk_layered",
          direction: "vertical",
          gap: 20
        },
        chrome: {
          padding: {
            top: 12,
            right: 12,
            bottom: 12,
            left: 12
          },
          gutter: 12,
          headerBandHeight: 28
        },
        ports: [],
        children: [
          buildCardNode("elk-top", "narrow", "Top", [
            {
              id: "south",
              role: "primary_out",
              side: "south"
            }
          ]),
          buildCardNode("elk-bottom", "narrow", "Bottom", [
            {
              id: "north",
              role: "primary_in",
              side: "north"
            },
            {
              id: "east",
              role: "primary_out",
              side: "east"
            }
          ])
        ]
      },
      buildCardNode("peer", "standard", "Peer", [
        {
          id: "west",
          role: "primary_in",
          side: "west"
        }
      ])
    ],
    [
      {
        id: "elk-internal",
        role: "transition",
        classes: ["internal"],
        from: {
          itemId: "elk-top",
          portId: "south"
        },
        to: {
          itemId: "elk-bottom",
          portId: "north"
        },
        routing: {
          style: "orthogonal",
          preferAxis: "vertical",
          sourcePortRole: "primary_out",
          targetPortRole: "primary_in"
        }
      },
      {
        id: "elk-external",
        role: "navigation",
        classes: ["external"],
        from: {
          itemId: "elk-bottom",
          portId: "east"
        },
        to: {
          itemId: "peer",
          portId: "west"
        },
        routing: {
          style: "orthogonal",
          preferAxis: "horizontal",
          sourcePortRole: "primary_out",
          targetPortRole: "primary_in"
        }
      }
    ]
  );
}

function findPositionedItem(root: PositionedContainer, id: string): PositionedItem {
  const queue: PositionedItem[] = [...root.children];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    if (current.id === id) {
      return current;
    }
    if (current.kind === "container") {
      queue.push(...current.children);
    }
  }

  throw new Error(`Could not find positioned item "${id}".`);
}

describe("staged macro-layout", () => {
  it("places stack containers with chrome, resolved ports, and midpoint edge labels", async () => {
    const result = await runStagedRendererPipeline(buildFixtureScene());
    const area = findPositionedItem(result.positionedScene.root, "area-A-001");
    if (area.kind !== "container") {
      throw new Error("Expected area-A-001 to be a container.");
    }

    expect(area.x).toBe(16);
    expect(area.y).toBe(16);
    expect(area.width).toBe(248);
    expect(area.height).toBe(178);
    expect(area.children[0]?.y).toBe(56);
    expect(area.ports[0]).toEqual(expect.objectContaining({
      id: "south",
      x: 124,
      y: 178
    }));

    const edge = result.positionedScene.edges[0];
    expect(edge?.from).toEqual({
      itemId: "P-001",
      portId: "east",
      x: 252,
      y: 89
    });
    expect(edge?.to).toEqual({
      itemId: "P-003",
      portId: "west",
      x: 288,
      y: 52
    });
    expect(edge?.route.points).toHaveLength(4);
    expect(edge?.label?.x).toBeCloseTo(228.222, 3);
    expect(edge?.label?.y).toBeCloseTo(59.5, 3);
    expect(result.positionedScene.diagnostics).toContainEqual(expect.objectContaining({
      code: "renderer.routing.preference_fallback",
      targetId: "nav-001"
    }));
  });

  it("lays out fixed-column grids in row-major order", async () => {
    const scene = buildRootScene(
      {
        strategy: "grid",
        columns: 2,
        gap: 10,
        crossAlignment: "start"
      },
      [
        buildCardNode("grid-a", "narrow", "Grid A"),
        buildCardNode("grid-b", "standard", "Grid B"),
        buildCardNode("grid-c", "chip", "Grid C")
      ]
    );

    const result = await runStagedRendererPipeline(scene);
    const first = findPositionedItem(result.positionedScene.root, "grid-a");
    const second = findPositionedItem(result.positionedScene.root, "grid-b");
    const third = findPositionedItem(result.positionedScene.root, "grid-c");

    expect(result.positionedScene.root.width).toBe(434);
    expect(result.positionedScene.root.height).toBe(138);
    expect(first).toEqual(expect.objectContaining({ x: 16, y: 16, width: 168, height: 48 }));
    expect(second).toEqual(expect.objectContaining({ x: 194, y: 16, width: 224, height: 48 }));
    expect(third).toEqual(expect.objectContaining({ x: 16, y: 74, width: 96, height: 48 }));
  });

  it("stretches lane containers to a shared cross-axis width", async () => {
    const laneA: SceneContainer = {
      kind: "container",
      id: "lane-a",
      role: "lane",
      primitive: "lane",
      classes: ["lane"],
      layout: {
        strategy: "stack",
        direction: "vertical",
        gap: 8
      },
      chrome: {
        padding: {
          top: 12,
          right: 16,
          bottom: 12,
          left: 16
        }
      },
      ports: [],
      children: [buildCardNode("lane-a-node", "narrow", "Lane A")]
    };
    const laneB: SceneContainer = {
      kind: "container",
      id: "lane-b",
      role: "lane",
      primitive: "lane",
      classes: ["lane"],
      layout: {
        strategy: "stack",
        direction: "vertical",
        gap: 8
      },
      chrome: {
        padding: {
          top: 12,
          right: 16,
          bottom: 12,
          left: 16
        }
      },
      ports: [],
      children: [buildCardNode("lane-b-node", "standard", "Lane B")]
    };

    const scene = buildRootScene(
      {
        strategy: "lanes",
        gap: 14
      },
      [laneA, laneB]
    );
    const result = await runStagedRendererPipeline(scene);
    const firstLane = findPositionedItem(result.positionedScene.root, "lane-a");
    const secondLane = findPositionedItem(result.positionedScene.root, "lane-b");
    if (firstLane.kind !== "container" || secondLane.kind !== "container") {
      throw new Error("Expected lane items to remain containers.");
    }

    expect(firstLane.width).toBe(256);
    expect(secondLane.width).toBe(256);
    expect(firstLane.x).toBe(16);
    expect(firstLane.y).toBe(16);
    expect(secondLane.x).toBe(16);
    expect(secondLane.y).toBe(130);
    expect(result.positionedScene.root.width).toBe(288);
    expect(result.positionedScene.root.height).toBe(246);
  });

  it("falls back to a single-column grid when columns are invalid", async () => {
    const scene = buildRootScene(
      {
        strategy: "grid",
        columns: 0,
        gap: 10
      },
      [
        buildCardNode("grid-fallback-a", "chip", "A"),
        buildCardNode("grid-fallback-b", "chip", "B")
      ]
    );
    const result = await runStagedRendererPipeline(scene);
    const first = findPositionedItem(result.positionedScene.root, "grid-fallback-a");
    const second = findPositionedItem(result.positionedScene.root, "grid-fallback-b");

    expect(first).toEqual(expect.objectContaining({ x: 16, y: 16 }));
    expect(second).toEqual(expect.objectContaining({ x: 16, y: 74 }));
    expect(result.positionedScene.diagnostics).toContainEqual(expect.objectContaining({
      code: "renderer.layout.invalid_grid_columns",
      phase: "layout",
      targetId: "root"
    }));
  });

  it("resolves role-based ports before falling back to default anchors", async () => {
    const scene = buildRootScene(
      {
        strategy: "stack",
        direction: "horizontal",
        gap: 24
      },
      [
        buildCardNode("left", "narrow", "Left", [
          {
            id: "east",
            role: "primary_out",
            side: "east"
          }
        ]),
        buildCardNode("right", "narrow", "Right", [
          {
            id: "west",
            role: "primary_in",
            side: "west"
          }
        ])
      ],
      [
        {
          id: "edge-role",
          role: "navigation",
          classes: [],
          from: {
            itemId: "left"
          },
          to: {
            itemId: "right"
          },
          routing: {
            style: "straight",
            preferAxis: "horizontal",
            sourcePortRole: "primary_out",
            targetPortRole: "primary_in"
          }
        }
      ]
    );

    const result = await runStagedRendererPipeline(scene);
    const edge = result.positionedScene.edges[0];
    expect(edge?.from.portId).toBe("east");
    expect(edge?.to.portId).toBe("west");
    expect(edge?.route.points).toEqual([
      { x: 184, y: 40 },
      { x: 208, y: 40 }
    ]);
  });

  it("falls back from unsupported layout strategies and default box anchors deterministically", async () => {
    const scene = buildRootScene(
      {
        strategy: "manual",
        direction: "horizontal",
        gap: 20
      },
      [
        buildCardNode("manual-left", "chip", "Manual Left"),
        buildCardNode("manual-right", "chip", "Manual Right")
      ],
      [
        {
          id: "edge-anchor",
          role: "navigation",
          classes: [],
          from: {
            itemId: "manual-left"
          },
          to: {
            itemId: "manual-right"
          },
          routing: {
            style: "stepped",
            preferAxis: "horizontal"
          }
        }
      ]
    );

    const result = await runStagedRendererPipeline(scene);
    const edge = result.positionedScene.edges[0];
    expect(edge?.from).toEqual({
      itemId: "manual-left",
      portId: undefined,
      x: 112,
      y: 48
    });
    expect(edge?.to).toEqual({
      itemId: "manual-right",
      portId: undefined,
      x: 132,
      y: 48
    });
    expect(edge?.route.points).toEqual([
      { x: 112, y: 48 },
      { x: 132, y: 48 }
    ]);
    expect(result.positionedScene.diagnostics).toContainEqual(expect.objectContaining({
      code: "renderer.layout.strategy_fallback",
      phase: "layout",
      targetId: "root"
    }));
  });

  it("supports elk_layered containers with orthogonal bend-point routing", async () => {
    const scene = buildRootScene(
      {
        strategy: "elk_layered",
        direction: "vertical",
        gap: 20
      },
      [
        buildCardNode("top", "narrow", "Top", [
          {
            id: "south",
            role: "primary_out",
            side: "south"
          }
        ]),
        buildCardNode("left", "narrow", "Left", [
          {
            id: "north",
            role: "primary_in",
            side: "north"
          }
        ]),
        buildCardNode("right", "narrow", "Right", [
          {
            id: "north",
            role: "primary_in",
            side: "north"
          }
        ])
      ],
      [
        {
          id: "elk-left",
          role: "transition",
          classes: [],
          from: {
            itemId: "top",
            portId: "south"
          },
          to: {
            itemId: "left",
            portId: "north"
          },
          routing: {
            style: "orthogonal",
            preferAxis: "vertical",
            sourcePortRole: "primary_out",
            targetPortRole: "primary_in"
          }
        },
        {
          id: "elk-right",
          role: "transition",
          classes: [],
          from: {
            itemId: "top",
            portId: "south"
          },
          to: {
            itemId: "right",
            portId: "north"
          },
          routing: {
            style: "orthogonal",
            preferAxis: "vertical",
            sourcePortRole: "primary_out",
            targetPortRole: "primary_in"
          }
        }
      ]
    );

    const result = await runStagedRendererPipeline(scene);
    const top = findPositionedItem(result.positionedScene.root, "top");
    const left = findPositionedItem(result.positionedScene.root, "left");
    const right = findPositionedItem(result.positionedScene.root, "right");
    const edge = result.positionedScene.edges.find((candidate) => candidate.id === "elk-right");

    expect(top).toEqual(expect.objectContaining({ x: 16, y: 16 }));
    expect(left).toEqual(expect.objectContaining({ y: 86 }));
    expect(right).toEqual(expect.objectContaining({ x: 204, y: 86 }));
    expect(edge?.from.portId).toBe("south");
    expect(edge?.to.portId).toBe("north");
    expect(edge?.route.points).toEqual([
      { x: 100, y: 64 },
      { x: 100, y: 75 },
      { x: 288, y: 75 },
      { x: 288, y: 86 }
    ]);
    expect(result.positionedScene.diagnostics.some((diagnostic) => diagnostic.code === "renderer.routing.preference_fallback")).toBe(false);
  });

  it("routes mixed-region edges once after elk placement and matches the committed hybrid snapshot", async () => {
    const scene = buildHybridElkScene();
    const result = await runStagedRendererPipeline(scene);
    const elkZone = findPositionedItem(result.positionedScene.root, "elk-zone");
    const externalEdge = result.positionedScene.edges.find((candidate) => candidate.id === "elk-external");
    const internalEdge = result.positionedScene.edges.find((candidate) => candidate.id === "elk-internal");

    if (elkZone.kind !== "container") {
      throw new Error("Expected elk-zone to remain a container.");
    }

    expect(elkZone).toEqual(expect.objectContaining({ x: 16, y: 16, width: 193, height: 170 }));
    expect(internalEdge?.route.points).toEqual([
      { x: 112, y: 104 },
      { x: 112, y: 126 }
    ]);
    expect(externalEdge?.from.portId).toBe("east");
    expect(externalEdge?.to.portId).toBe("west");
    expect(externalEdge?.route.points).toEqual([
      { x: 196, y: 150 },
      { x: 214.5, y: 150 },
      { x: 214.5, y: 40 },
      { x: 233, y: 40 }
    ]);

    await expectRendererStageSnapshot("hybrid-elk.positioned-scene.json", result.positionedScene);
  });

  it("falls back from malformed elk scene data with an explicit diagnostic", async () => {
    const malformedMeasuredScene = {
      viewId: "ia_place_map",
      profileId: "recommended",
      themeId: "default",
      root: {
        kind: "container",
        id: "root",
        role: "diagram_root",
        primitive: "root",
        classes: ["diagram"],
        layout: {
          strategy: "elk_layered",
          direction: "horizontal",
          gap: 20
        },
        chrome: {
          padding: {
            top: 16,
            right: 16,
            bottom: 16,
            left: 16
          },
          gutter: 16,
          headerBandHeight: 0
        },
        ports: [],
        children: [
          {
            kind: "node",
            id: "broken",
            role: "place",
            primitive: "card",
            classes: ["place"],
            widthPolicy: {
              preferred: "narrow",
              allowed: ["narrow"]
            },
            widthBand: "narrow",
            overflowPolicy: {
              kind: "grow_height"
            },
            content: [],
            ports: [
              {
                id: "bad-port",
                role: "primary_out",
                side: "broken"
              }
            ],
            overflow: {
              status: "fits"
            },
            width: 120,
            height: 48
          }
        ],
        width: 0,
        height: 0
      },
      edges: [],
      diagnostics: []
    } as unknown as MeasuredScene;

    const positioned = await positionMeasuredScene(malformedMeasuredScene);

    expect(positioned.root.width).toBe(152);
    expect(positioned.root.height).toBe(80);
    expect(positioned.diagnostics).toContainEqual(expect.objectContaining({
      code: "renderer.layout.elk_failure",
      phase: "layout",
      targetId: "root"
    }));
  });
});
