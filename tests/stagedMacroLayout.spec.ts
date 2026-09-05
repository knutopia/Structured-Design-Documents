import { describe, expect, it } from "vitest";
import type {
  MeasuredScene,
  PositionedContainer,
  Point,
  PositionedItem,
  RendererScene,
  SceneContainer,
  SceneEdge,
  SceneNode
} from "../src/renderer/staged/contracts.js";
import { positionMeasuredScene } from "../src/renderer/staged/macroLayout.js";
import {
  measureScene,
  positionSceneBeforeRouting,
  runStagedRendererPipeline
} from "../src/renderer/staged/pipeline.js";
import { expectRendererStageSnapshot } from "./rendererStageSnapshotHarness.js";
import { buildFixtureScene } from "./stagedRendererFixtures.js";

function buildRootScene(
  layout: SceneContainer["layout"],
  children: SceneContainer["children"],
  edges: SceneEdge[] = []
): RendererScene {
  return {
    viewId: "ia_place_map",
    detailId: "detailed",
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

function buildSharedSizeCell(
  id: string,
  title: string,
  sharedWidthGroup: string,
  sharedHeightGroup: string
): SceneContainer {
  return {
    kind: "container",
    id,
    role: "cell",
    primitive: "cluster",
    classes: ["shared_cell"],
    layout: {
      strategy: "stack",
      direction: "vertical",
      gap: 8
    },
    chrome: {
      padding: {
        top: 12,
        right: 12,
        bottom: 12,
        left: 12
      },
      gutter: 8,
      headerBandHeight: 0
    },
    ports: [],
    children: [buildCardNode(`${id}__node`, title.length > 12 ? "standard" : "narrow", title)],
    sharedWidthGroup,
    sharedHeightGroup
  };
}

function buildHybridLayeredScene(): RendererScene {
  return buildRootScene(
    {
      strategy: "stack",
      direction: "horizontal",
      gap: 24
    },
    [
      {
        kind: "container",
        id: "layered-zone",
        role: "layered_group",
        primitive: "cluster",
        classes: ["layered_group"],
        layout: {
          strategy: "layered",
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
          buildCardNode("layered-top", "narrow", "Top", [
            {
              id: "south",
              role: "primary_out",
              side: "south"
            }
          ]),
          buildCardNode("layered-bottom", "narrow", "Bottom", [
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
        id: "layered-internal",
        role: "transition",
        classes: ["internal"],
        from: {
          itemId: "layered-top",
          portId: "south"
        },
        to: {
          itemId: "layered-bottom",
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
        id: "layered-external",
        role: "navigation",
        classes: ["external"],
        from: {
          itemId: "layered-bottom",
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

function getTerminalSegment(edge: { route: { points: Point[] } }): { dx: number; dy: number; length: number } {
  const points = edge.route.points;
  const end = points[points.length - 1];
  const beforeEnd = points[points.length - 2];
  if (!end || !beforeEnd) {
    throw new Error("Expected a routed edge with at least two points.");
  }

  const dx = end.x - beforeEnd.x;
  const dy = end.y - beforeEnd.y;
  return {
    dx,
    dy,
    length: Math.hypot(dx, dy)
  };
}

describe("staged macro-layout", () => {
  it("places stack containers with chrome, resolved ports, and segment-aware edge labels", async () => {
    const result = await runStagedRendererPipeline(buildFixtureScene());
    const area = findPositionedItem(result.positionedScene.root, "area-A-001");
    if (area.kind !== "container") {
      throw new Error("Expected area-A-001 to be a container.");
    }

    expect(area.x).toBe(16);
    expect(area.y).toBe(16);
    expect(area.width).toBe(248);
    expect(area.height).toBe(190);
    expect(area.children[0]?.y).toBe(68);
    expect(area.ports[0]).toEqual(expect.objectContaining({
      id: "south",
      x: 124,
      y: 190
    }));

    const edge = result.positionedScene.edges[0];
    expect(edge?.from).toEqual({
      itemId: "P-001",
      portId: "east",
      x: 252,
      y: 101
    });
    expect(edge?.to).toEqual({
      itemId: "P-003",
      portId: "west",
      x: 288,
      y: 52
    });
    expect(edge?.route.points).toHaveLength(4);
    expect(edge?.label?.x).toBeCloseTo(282, 3);
    expect(edge?.label?.y).toBeCloseTo(65.5, 3);
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

  it("normalizes shared width and height groups before macro-layout", async () => {
    const scene = buildRootScene(
      {
        strategy: "grid",
        columns: 2,
        gap: 10,
        crossAlignment: "start"
      },
      [
        buildSharedSizeCell("cell-a1", "Short", "col-a", "row-1"),
        buildSharedSizeCell("cell-b1", "A much longer title", "col-b", "row-1"),
        buildSharedSizeCell("cell-a2", "Medium title", "col-a", "row-2"),
        buildSharedSizeCell("cell-b2", "Tiny", "col-b", "row-2")
      ]
    );

    const measured = measureScene(scene);
    const measuredCells = measured.root.children.filter(
      (child): child is MeasuredScene["root"]["children"][number] & { kind: "container" } => child.kind === "container"
    );
    const measuredA1 = measuredCells.find((cell) => cell.id === "cell-a1");
    const measuredA2 = measuredCells.find((cell) => cell.id === "cell-a2");
    const measuredB1 = measuredCells.find((cell) => cell.id === "cell-b1");
    const measuredB2 = measuredCells.find((cell) => cell.id === "cell-b2");

    expect(measuredA1?.width).toBe(measuredA2?.width);
    expect(measuredB1?.width).toBe(measuredB2?.width);
    expect(measuredA1?.height).toBe(measuredB1?.height);
    expect(measuredA2?.height).toBe(measuredB2?.height);

    const positioned = await runStagedRendererPipeline(scene);
    const positionedA1 = findPositionedItem(positioned.positionedScene.root, "cell-a1");
    const positionedA2 = findPositionedItem(positioned.positionedScene.root, "cell-a2");
    const positionedB1 = findPositionedItem(positioned.positionedScene.root, "cell-b1");
    const positionedB2 = findPositionedItem(positioned.positionedScene.root, "cell-b2");

    expect(positionedA1).toEqual(expect.objectContaining({ width: positionedA2.width }));
    expect(positionedB1).toEqual(expect.objectContaining({ width: positionedB2.width }));
    expect(positionedA1).toEqual(expect.objectContaining({ height: positionedB1.height }));
    expect(positionedA2).toEqual(expect.objectContaining({ height: positionedB2.height }));
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

  it("translates nested container subtrees without compounding intermediate offsets", async () => {
    const nestedBranch: SceneContainer = {
      kind: "container",
      id: "nested-branch",
      role: "branch",
      primitive: "cluster",
      classes: ["branch"],
      layout: {
        strategy: "stack",
        direction: "vertical",
        gap: 8
      },
      chrome: {
        padding: {
          top: 10,
          right: 10,
          bottom: 10,
          left: 10
        }
      },
      ports: [],
      children: [buildCardNode("nested-leaf", "chip", "Nested Leaf")]
    };

    const nestedArea: SceneContainer = {
      kind: "container",
      id: "nested-area",
      role: "area",
      primitive: "cluster",
      classes: ["area"],
      layout: {
        strategy: "stack",
        direction: "vertical",
        gap: 12
      },
      chrome: {
        padding: {
          top: 12,
          right: 12,
          bottom: 12,
          left: 12
        }
      },
      ports: [],
      children: [nestedBranch]
    };

    const scene = buildRootScene(
      {
        strategy: "stack",
        direction: "vertical",
        gap: 16
      },
      [nestedArea]
    );

    const result = await runStagedRendererPipeline(scene);
    const area = findPositionedItem(result.positionedScene.root, "nested-area");
    const branch = findPositionedItem(result.positionedScene.root, "nested-branch");
    const leaf = findPositionedItem(result.positionedScene.root, "nested-leaf");

    if (area.kind !== "container" || branch.kind !== "container") {
      throw new Error("Expected nested items to remain containers.");
    }

    expect(result.positionedScene.root.width).toBe(172);
    expect(result.positionedScene.root.height).toBe(196);
    expect(area).toEqual(expect.objectContaining({ x: 16, y: 16, width: 140, height: 164 }));
    expect(branch).toEqual(expect.objectContaining({ x: 28, y: 56, width: 116, height: 112 }));
    expect(leaf).toEqual(expect.objectContaining({ x: 38, y: 94, width: 96, height: 64 }));
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

  it("supports renderer-owned layered containers with orthogonal routing", async () => {
    const scene = buildRootScene(
      {
        strategy: "layered",
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
          id: "layered-left",
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
          id: "layered-right",
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
    const edge = result.positionedScene.edges.find((candidate) => candidate.id === "layered-right");

    expect(top).toEqual(expect.objectContaining({ x: 16, y: 16 }));
    expect(left).toEqual(expect.objectContaining({ y: 84 }));
    expect(right).toEqual(expect.objectContaining({ x: 204, y: 84 }));
    expect(edge?.from.portId).toBe("south");
    expect(edge?.to.portId).toBe("north");
    expect(edge?.route.points).toEqual([
      { x: 100, y: 64 },
      { x: 100, y: 74 },
      { x: 288, y: 74 },
      { x: 288, y: 84 }
    ]);
    expect(result.positionedScene.diagnostics.some((diagnostic) => diagnostic.code === "renderer.routing.preference_fallback")).toBe(false);
  });

  it("ranks cycles, self-loops, and disconnected components deterministically", async () => {
    const edge = (id: string, from: string, to: string): SceneEdge => ({
      id,
      role: "transition",
      classes: [],
      from: { itemId: from },
      to: { itemId: to },
      routing: { style: "orthogonal", preferAxis: "horizontal" }
    });
    const scene = buildRootScene(
      { strategy: "layered", direction: "horizontal", gap: 20 },
      ["cycle-a", "cycle-b", "after-cycle", "self-loop", "disconnected"].map((id) =>
        buildCardNode(id, "narrow")
      ),
      [
        edge("a-to-b", "cycle-a", "cycle-b"),
        edge("b-to-a", "cycle-b", "cycle-a"),
        edge("b-to-c", "cycle-b", "after-cycle"),
        edge("self", "self-loop", "self-loop")
      ]
    );

    const first = await positionSceneBeforeRouting(measureScene(scene));
    const second = await positionSceneBeforeRouting(measureScene(structuredClone(scene)));
    const cycleA = findPositionedItem(first.root, "cycle-a");
    const cycleB = findPositionedItem(first.root, "cycle-b");
    const afterCycle = findPositionedItem(first.root, "after-cycle");
    const selfLoop = findPositionedItem(first.root, "self-loop");
    const disconnected = findPositionedItem(first.root, "disconnected");

    expect(cycleA.x).toBe(cycleB.x);
    expect(cycleA.y).toBeLessThan(cycleB.y);
    expect(afterCycle.x).toBeGreaterThan(cycleA.x + cycleA.width);
    expect(selfLoop.x).toBe(cycleA.x);
    expect(disconnected.x).toBe(cycleA.x);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("preserves item view metadata through layered subtree positioning", async () => {
    const top = buildCardNode("metadata-layered-top", "narrow", "Top", [
      {
        id: "south",
        role: "primary_out",
        side: "south"
      }
    ]);
    const bottom = buildCardNode("metadata-layered-bottom", "narrow", "Bottom", [
      {
        id: "north",
        role: "primary_in",
        side: "north"
      }
    ]);
    const cellMetadata = {
      serviceBlueprint: {
        kind: "cell" as const,
        laneId: "lane:02:frontstage",
        laneShellId: "lane:02:frontstage__shell",
        bandId: "band:anchor:1",
        bandLabel: "A1",
        bandKind: "anchor" as const,
        rowOrder: 1,
        columnOrder: 0
      }
    };
    const nodeMetadata = {
      serviceBlueprint: {
        kind: "semantic_node" as const,
        cellId: "lane:02:frontstage__shell__cell__band:anchor:1"
      }
    };

    top.viewMetadata = nodeMetadata;

    const scene = buildRootScene(
      {
        strategy: "stack",
        direction: "horizontal",
        gap: 24
      },
      [
        {
          kind: "container",
          id: "metadata-layered-zone",
          role: "layered_group",
          primitive: "cluster",
          classes: ["layered_group"],
          viewMetadata: cellMetadata,
          layout: {
            strategy: "layered",
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
            headerBandHeight: 0
          },
          ports: [],
          children: [top, bottom]
        }
      ],
      [
        {
          id: "metadata-layered-internal",
          role: "transition",
          classes: ["internal"],
          from: {
            itemId: "metadata-layered-top",
            portId: "south"
          },
          to: {
            itemId: "metadata-layered-bottom",
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
    const measuredLayeredZone = result.measuredScene.root.children[0];
    const positionedLayeredZone = findPositionedItem(result.positionedScene.root, "metadata-layered-zone");
    const positionedTop = findPositionedItem(result.positionedScene.root, "metadata-layered-top");

    if (!measuredLayeredZone || measuredLayeredZone.kind !== "container") {
      throw new Error("Expected the measured scene to include the layered container.");
    }
    if (positionedLayeredZone.kind !== "container") {
      throw new Error("Expected the positioned scene to include the layered container.");
    }
    if (positionedTop.kind !== "node") {
      throw new Error("Expected the positioned scene to include the layered node.");
    }

    expect(measuredLayeredZone.viewMetadata).toEqual(cellMetadata);
    expect(positionedLayeredZone.viewMetadata).toEqual(cellMetadata);
    expect(positionedTop.viewMetadata).toEqual(nodeMetadata);

    expect(measuredLayeredZone.viewMetadata).not.toBe(cellMetadata);
    expect(positionedLayeredZone.viewMetadata).not.toBe(cellMetadata);
    expect(positionedTop.viewMetadata).not.toBe(nodeMetadata);

    expect(measuredLayeredZone.viewMetadata?.serviceBlueprint).not.toBe(cellMetadata.serviceBlueprint);
    expect(positionedLayeredZone.viewMetadata?.serviceBlueprint).not.toBe(cellMetadata.serviceBlueprint);
    expect(positionedTop.viewMetadata?.serviceBlueprint).not.toBe(nodeMetadata.serviceBlueprint);
  });

  it("applies the stronger vertical target-approach rule to manually routed orthogonal edges", async () => {
    const scene = buildRootScene(
      {
        strategy: "stack",
        direction: "vertical",
        gap: 56
      },
      [
        buildCardNode("manual-top", "narrow", "Manual Top", [
          {
            id: "south",
            role: "chain_out",
            side: "south"
          }
        ]),
        buildCardNode("manual-bottom", "narrow", "Manual Bottom", [
          {
            id: "north",
            role: "chain_in",
            side: "north"
          }
        ])
      ],
      [
        {
          id: "manual-target-approach",
          role: "navigation",
          classes: ["within_chain"],
          from: {
            itemId: "manual-top",
            portId: "south"
          },
          to: {
            itemId: "manual-bottom",
            portId: "north"
          },
          routing: {
            style: "orthogonal",
            preferAxis: "vertical",
            bendPlacement: "target_bias",
            targetApproach: "vertical_child",
            sourcePortRole: "chain_out",
            targetPortRole: "chain_in"
          },
          markers: {
            end: "arrow"
          }
        }
      ]
    );

    const result = await runStagedRendererPipeline(scene);
    const edge = result.positionedScene.edges[0];
    const terminal = getTerminalSegment(edge!);

    expect(terminal.dx).toBe(0);
    expect(terminal.length).toBeGreaterThanOrEqual(20);
    expect(result.positionedScene.diagnostics.some((diagnostic) => diagnostic.code === "renderer.routing.target_approach_unmet")).toBe(false);
  });

  it("applies the stronger vertical target-approach rule after layered placement", async () => {
    const scene = buildRootScene(
      {
        strategy: "layered",
        direction: "vertical",
        gap: 20
      },
      [
        buildCardNode("layered-top-approach", "narrow", "Top", [
          {
            id: "south",
            role: "chain_out",
            side: "south"
          }
        ]),
        buildCardNode("layered-bottom-approach", "narrow", "Bottom", [
          {
            id: "north",
            role: "chain_in",
            side: "north"
          }
        ])
      ],
      [
        {
          id: "layered-target-approach",
          role: "navigation",
          classes: ["within_chain"],
          from: {
            itemId: "layered-top-approach",
            portId: "south"
          },
          to: {
            itemId: "layered-bottom-approach",
            portId: "north"
          },
          routing: {
            style: "orthogonal",
            preferAxis: "vertical",
            targetApproach: "vertical_child",
            sourcePortRole: "chain_out",
            targetPortRole: "chain_in"
          },
          markers: {
            end: "arrow"
          }
        }
      ]
    );

    const result = await runStagedRendererPipeline(scene);
    const edge = result.positionedScene.edges[0];
    const terminal = getTerminalSegment(edge!);

    expect(terminal.dx).toBe(0);
    expect(terminal.length).toBeGreaterThanOrEqual(20);
    expect(result.positionedScene.diagnostics.some((diagnostic) => diagnostic.code === "renderer.routing.target_approach_unmet")).toBe(false);
  });

  it("routes mixed-region edges once after layered placement and matches the committed hybrid snapshot", async () => {
    const scene = buildHybridLayeredScene();
    const result = await runStagedRendererPipeline(scene);
    const layeredZone = findPositionedItem(result.positionedScene.root, "layered-zone");
    const externalEdge = result.positionedScene.edges.find((candidate) => candidate.id === "layered-external");
    const internalEdge = result.positionedScene.edges.find((candidate) => candidate.id === "layered-internal");

    if (layeredZone.kind !== "container") {
      throw new Error("Expected layered-zone to remain a container.");
    }

    expect(layeredZone).toEqual(expect.objectContaining({ x: 16, y: 16, width: 192, height: 168 }));
    expect(internalEdge?.route.points).toEqual([
      { x: 112, y: 104 },
      { x: 112, y: 124 }
    ]);
    expect(externalEdge?.from.portId).toBe("east");
    expect(externalEdge?.to.portId).toBe("west");
    expect(externalEdge?.route.points).toEqual([
      { x: 196, y: 148 },
      { x: 214, y: 148 },
      { x: 214, y: 40 },
      { x: 232, y: 40 }
    ]);

    await expectRendererStageSnapshot("hybrid-layered.positioned-scene.json", result.positionedScene);
  });

  it("keeps malformed layered scene data from crashing the positioned-scene fallback path", async () => {
    const malformedMeasuredScene = {
      viewId: "ia_place_map",
      detailId: "detailed",
      themeId: "default",
      root: {
        kind: "container",
        id: "root",
        role: "diagram_root",
        primitive: "root",
        classes: ["diagram"],
        layout: {
          strategy: "layered",
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
        headerContent: [],
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
    expect(positioned.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
  });
});
