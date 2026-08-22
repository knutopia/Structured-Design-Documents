import { describe, expect, it } from "vitest";
import type {
  GridCellPlacement,
  LayoutIntent,
  PositionedItem,
  RendererScene,
  SceneNode
} from "../src/renderer/staged/contracts.js";
import { resolveGridCells } from "../src/renderer/staged/gridLayout.js";
import { positionMeasuredScene } from "../src/renderer/staged/macroLayout.js";
import { measureScene, runStagedRendererPipeline } from "../src/renderer/staged/pipeline.js";

function buildNode(id: string, width: "chip" | "narrow" | "standard"): SceneNode {
  return {
    kind: "node",
    id,
    role: "place",
    primitive: "card",
    classes: ["grid_test"],
    widthPolicy: {
      preferred: width,
      allowed: [width]
    },
    overflowPolicy: {
      kind: "grow_height"
    },
    content: [
      {
        id: `${id}__title`,
        kind: "text",
        text: id,
        textStyleRole: "title",
        priority: "primary"
      }
    ],
    ports: []
  };
}

function buildGridScene(
  placements: GridCellPlacement[],
  options: { columns?: number; crossAlignment?: "start" | "center" } = {}
): RendererScene {
  return {
    viewId: "grid_test",
    detailId: "detailed",
    themeId: "default",
    root: {
      kind: "container",
      id: "root",
      role: "diagram_root",
      primitive: "root",
      classes: ["diagram", "grid_test"],
      layout: {
        strategy: "grid",
        columns: options.columns ?? 2,
        gap: 10,
        crossAlignment: options.crossAlignment ?? "start",
        grid: { placements }
      },
      chrome: {
        padding: { top: 16, right: 16, bottom: 16, left: 16 },
        gutter: 16
      },
      ports: [],
      children: [
        buildNode("grid-a", "chip"),
        buildNode("grid-b", "standard"),
        buildNode("grid-c", "narrow")
      ]
    },
    edges: [],
    diagnostics: []
  };
}

function findItem(items: readonly PositionedItem[], id: string): PositionedItem {
  const item = items.find((candidate) => candidate.id === id);
  if (item === undefined) {
    throw new Error(`Missing positioned item '${id}'.`);
  }
  return item;
}

describe("shared explicit grid placement", () => {
  it("resolves sparse explicit cells independently of layout.columns", async () => {
    const scene = buildGridScene(
      [
        { itemId: "grid-a", row: 0, column: 0 },
        { itemId: "grid-b", row: 2, column: 2 },
        { itemId: "grid-c", row: 2, column: 0 }
      ],
      { columns: 0 }
    );

    const result = await runStagedRendererPipeline(scene);
    const first = findItem(result.positionedScene.root.children, "grid-a");
    const second = findItem(result.positionedScene.root.children, "grid-b");
    const third = findItem(result.positionedScene.root.children, "grid-c");

    expect(result.measuredScene.root).toEqual(expect.objectContaining({ width: 444, height: 148 }));
    expect(result.positionedScene.root).toEqual(expect.objectContaining({ width: 444, height: 148 }));
    expect(first).toEqual(expect.objectContaining({ x: 16, y: 16 }));
    expect(second).toEqual(expect.objectContaining({ x: 204, y: 84 }));
    expect(third).toEqual(expect.objectContaining({ x: 16, y: 84 }));
    expect(result.positionedScene.diagnostics).not.toContainEqual(expect.objectContaining({
      code: "renderer.layout.invalid_grid_columns"
    }));
  });

  it("honors start and center alignment for uneven explicit cells", async () => {
    const placements = [
      { itemId: "grid-a", row: 0, column: 0 },
      { itemId: "grid-b", row: 1, column: 0 },
      { itemId: "grid-c", row: 0, column: 1 }
    ];
    const started = await runStagedRendererPipeline(buildGridScene(placements, { crossAlignment: "start" }));
    const centered = await runStagedRendererPipeline(buildGridScene(placements, { crossAlignment: "center" }));

    expect(findItem(started.positionedScene.root.children, "grid-a").x).toBe(16);
    expect(findItem(centered.positionedScene.root.children, "grid-a").x).toBe(80);
    expect(started.positionedScene.root).toEqual(expect.objectContaining({ width: 434, height: 138 }));
    expect(centered.positionedScene.root).toEqual(expect.objectContaining({ width: 434, height: 138 }));
  });

  it.each([
    {
      name: "missing child",
      placements: [
        { itemId: "grid-a", row: 0, column: 0 },
        { itemId: "grid-b", row: 0, column: 1 }
      ]
    },
    {
      name: "unknown child",
      placements: [
        { itemId: "grid-a", row: 0, column: 0 },
        { itemId: "grid-b", row: 0, column: 1 },
        { itemId: "grid-c", row: 1, column: 0 },
        { itemId: "grid-unknown", row: 1, column: 1 }
      ]
    },
    {
      name: "duplicate child",
      placements: [
        { itemId: "grid-a", row: 0, column: 0 },
        { itemId: "grid-a", row: 1, column: 1 },
        { itemId: "grid-b", row: 0, column: 1 },
        { itemId: "grid-c", row: 1, column: 0 }
      ]
    },
    {
      name: "duplicate cell",
      placements: [
        { itemId: "grid-a", row: 0, column: 0 },
        { itemId: "grid-b", row: 0, column: 0 },
        { itemId: "grid-c", row: 1, column: 0 }
      ]
    },
    {
      name: "negative index",
      placements: [
        { itemId: "grid-a", row: -1, column: 0 },
        { itemId: "grid-b", row: 0, column: 1 },
        { itemId: "grid-c", row: 1, column: 0 }
      ]
    },
    {
      name: "fractional index",
      placements: [
        { itemId: "grid-a", row: 0.5, column: 0 },
        { itemId: "grid-b", row: 0, column: 1 },
        { itemId: "grid-c", row: 1, column: 0 }
      ]
    }
  ])("warns once and reproduces row-major placement for $name", async ({ placements }) => {
    const result = await runStagedRendererPipeline(buildGridScene(placements));
    const diagnostics = result.positionedScene.diagnostics.filter(
      (diagnostic) => diagnostic.code === "renderer.layout.invalid_grid_placements"
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toEqual(expect.objectContaining({
      severity: "warn",
      phase: "layout",
      targetId: "root"
    }));
    expect(findItem(result.positionedScene.root.children, "grid-a")).toEqual(
      expect.objectContaining({ x: 16, y: 16 })
    );
    expect(findItem(result.positionedScene.root.children, "grid-b")).toEqual(
      expect.objectContaining({ x: 194, y: 16 })
    );
    expect(findItem(result.positionedScene.root.children, "grid-c")).toEqual(
      expect.objectContaining({ x: 16, y: 74 })
    );
  });

  it("deep-clones placement arrays through measurement and positioning", async () => {
    const scene = buildGridScene([
      { itemId: "grid-a", row: 0, column: 0 },
      { itemId: "grid-b", row: 0, column: 1 },
      { itemId: "grid-c", row: 1, column: 0 }
    ]);
    const measured = measureScene(scene);
    const sourceLayout = scene.root.layout as LayoutIntent & { grid: NonNullable<LayoutIntent["grid"]> };
    const measuredLayout = measured.root.layout as LayoutIntent & { grid: NonNullable<LayoutIntent["grid"]> };

    sourceLayout.grid.placements[0].row = 9;
    expect(measuredLayout.grid.placements[0].row).toBe(0);

    const positioned = await positionMeasuredScene(measured);
    measuredLayout.grid.placements[0].row = 8;
    expect(positioned.root.layout.grid?.placements[0].row).toBe(0);
  });

  it("returns deterministic validation details from the pure resolver", () => {
    const resolution = resolveGridCells(
      ["a", "b"],
      {
        strategy: "grid",
        columns: 2,
        grid: {
          placements: [
            { itemId: "a", row: -1, column: 0 },
            { itemId: "unknown", row: 0, column: 0 }
          ]
        }
      }
    );

    expect(resolution).toEqual(expect.objectContaining({
      source: "row_major",
      invalidPlacementReasons: ["invalid_cell_index", "missing_item_id", "unknown_item_id"],
      invalidPlacementItemIds: ["a", "b", "unknown"]
    }));
  });
});
