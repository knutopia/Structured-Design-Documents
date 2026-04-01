import type {
  PositionedContainer,
  PositionedDecoration,
  PositionedItem,
  PositionedScene
} from "./contracts.js";
import type {
  ServiceBlueprintLaneGuide,
  ServiceBlueprintMiddleLayerModel
} from "./serviceBlueprintMiddleLayer.js";

const LANE_LABEL_X = 24;
const LANE_SEPARATOR_START_X = 24;
const ROOT_RIGHT_INSET = 28;

function sanitizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unnamed";
}

function buildLaneClassToken(guide: Pick<ServiceBlueprintLaneGuide, "label">): string {
  return `lane-${sanitizeToken(guide.label)}`;
}

function isServiceBlueprintCell(item: PositionedItem): item is PositionedContainer {
  return item.kind === "container" && item.viewMetadata?.serviceBlueprint?.kind === "cell";
}

function buildPositionedCellMap(
  scene: PositionedScene
): ReadonlyMap<string, PositionedContainer> {
  return new Map(
    scene.root.children
      .filter(isServiceBlueprintCell)
      .map((child) => [child.id, child] as const)
  );
}

export function buildServiceBlueprintLaneDecorations(
  scene: PositionedScene,
  middleLayer: Pick<ServiceBlueprintMiddleLayerModel, "laneGuides" | "laneShells">
): PositionedDecoration[] {
  const decorations: PositionedDecoration[] = [];
  const cellById = buildPositionedCellMap(scene);
  const laneShellById = new Map(middleLayer.laneShells.map((laneShell) => [laneShell.id, laneShell] as const));
  const lineEndX = Math.max(LANE_SEPARATOR_START_X, scene.root.width - ROOT_RIGHT_INSET);

  middleLayer.laneGuides.forEach((guide) => {
    const laneShell = laneShellById.get(guide.laneShellId);
    if (!laneShell) {
      return;
    }

    const laneCells = laneShell.cellIds
      .map((cellId) => cellById.get(cellId))
      .filter((cell): cell is PositionedContainer => cell !== undefined);
    if (laneCells.length === 0) {
      return;
    }

    const laneClass = buildLaneClassToken(guide);
    const minY = Math.min(...laneCells.map((cell) => cell.y));
    const maxY = Math.max(...laneCells.map((cell) => cell.y + cell.height));

    decorations.push({
      kind: "text",
      id: `${laneClass}__title`,
      classes: ["service_blueprint_lane_title", laneClass],
      paintGroup: "labels",
      x: LANE_LABEL_X,
      y: minY + Math.max(10, (maxY - minY) / 2 - 10),
      text: guide.label,
      textStyleRole: "label"
    });

    if (!guide.separatorAfter) {
      return;
    }

    decorations.push({
      kind: "line",
      id: `${laneClass}__separator`,
      classes: ["service_blueprint_separator", guide.separatorAfter, laneClass],
      paintGroup: "chrome",
      from: {
        x: LANE_SEPARATOR_START_X,
        y: maxY
      },
      to: {
        x: lineEndX,
        y: maxY
      }
    });
  });

  return decorations;
}

export function decorateServiceBlueprintPositionedScene(
  scene: PositionedScene,
  middleLayer: Pick<ServiceBlueprintMiddleLayerModel, "laneGuides" | "laneShells">
): PositionedScene {
  return {
    ...scene,
    decorations: buildServiceBlueprintLaneDecorations(scene, middleLayer)
  };
}
