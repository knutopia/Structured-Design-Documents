import { describe, expect, it } from "vitest";
import type {
  PositionedContainer,
  PositionedItem,
  RendererScene,
  SceneContainer,
  SceneEdge,
  SceneNode
} from "../src/renderer/staged/contracts.js";
import { runStagedRendererPipeline } from "../src/renderer/staged/pipeline.js";
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
  it("places stack containers with chrome, resolved ports, and midpoint edge labels", () => {
    const result = runStagedRendererPipeline(buildFixtureScene());
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

  it("lays out fixed-column grids in row-major order", () => {
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

    const result = runStagedRendererPipeline(scene);
    const first = findPositionedItem(result.positionedScene.root, "grid-a");
    const second = findPositionedItem(result.positionedScene.root, "grid-b");
    const third = findPositionedItem(result.positionedScene.root, "grid-c");

    expect(result.positionedScene.root.width).toBe(434);
    expect(result.positionedScene.root.height).toBe(138);
    expect(first).toEqual(expect.objectContaining({ x: 16, y: 16, width: 168, height: 48 }));
    expect(second).toEqual(expect.objectContaining({ x: 194, y: 16, width: 224, height: 48 }));
    expect(third).toEqual(expect.objectContaining({ x: 16, y: 74, width: 96, height: 48 }));
  });

  it("stretches lane containers to a shared cross-axis width", () => {
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
    const result = runStagedRendererPipeline(scene);
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

  it("falls back to a single-column grid when columns are invalid", () => {
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
    const result = runStagedRendererPipeline(scene);
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

  it("resolves role-based ports before falling back to default anchors", () => {
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

    const result = runStagedRendererPipeline(scene);
    const edge = result.positionedScene.edges[0];
    expect(edge?.from.portId).toBe("east");
    expect(edge?.to.portId).toBe("west");
    expect(edge?.route.points).toEqual([
      { x: 184, y: 40 },
      { x: 208, y: 40 }
    ]);
  });

  it("falls back from unsupported layout strategies and default box anchors deterministically", () => {
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

    const result = runStagedRendererPipeline(scene);
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
});
