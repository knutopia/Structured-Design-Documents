import type {
  PositionedContainer,
  PositionedDecoration,
  PositionedItem,
  PositionedScene
} from "./contracts.js";
import type {
  ScenarioFlowLaneGuide,
  ScenarioFlowMiddleLayerModel
} from "./scenarioFlowMiddleLayer.js";

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

function buildLaneClassToken(guide: Pick<ScenarioFlowLaneGuide, "laneId">): string {
  return `lane-${sanitizeToken(guide.laneId)}`;
}

function isScenarioFlowCell(item: PositionedItem): item is PositionedContainer {
  return item.kind === "container" && item.viewMetadata?.scenarioFlow?.kind === "cell";
}

function buildPositionedCellMap(scene: PositionedScene): ReadonlyMap<string, PositionedContainer> {
  return new Map(
    scene.root.children
      .filter(isScenarioFlowCell)
      .map((child) => [child.id, child] as const)
  );
}

function resolveLaneCells(
  cellById: ReadonlyMap<string, PositionedContainer>,
  guide: ScenarioFlowLaneGuide
): PositionedContainer[] {
  return [...cellById.values()]
    .filter((cell) => cell.viewMetadata?.scenarioFlow?.kind === "cell"
      && cell.viewMetadata.scenarioFlow.laneId === guide.laneId)
    .sort((left, right) => left.y - right.y || left.x - right.x || left.id.localeCompare(right.id));
}

export function buildScenarioFlowLaneDecorations(
  scene: PositionedScene,
  middleLayer: Pick<ScenarioFlowMiddleLayerModel, "laneGuides">
): PositionedDecoration[] {
  const decorations: PositionedDecoration[] = [];
  const cellById = buildPositionedCellMap(scene);
  const lineEndX = Math.max(LANE_SEPARATOR_START_X, scene.root.width - ROOT_RIGHT_INSET);

  [...middleLayer.laneGuides]
    .sort((left, right) => left.order - right.order || left.laneId.localeCompare(right.laneId))
    .forEach((guide, index, guides) => {
      const laneCells = resolveLaneCells(cellById, guide);
      if (laneCells.length === 0) {
        return;
      }

      const laneClass = buildLaneClassToken(guide);
      const minY = Math.min(...laneCells.map((cell) => cell.y));
      const maxY = Math.max(...laneCells.map((cell) => cell.y + cell.height));

      decorations.push({
        kind: "text",
        id: `${laneClass}__title`,
        classes: ["scenario_flow_lane_title", laneClass],
        paintGroup: "labels",
        x: LANE_LABEL_X,
        y: minY + Math.max(10, (maxY - minY) / 2 - 10),
        text: guide.label,
        textStyleRole: "label"
      });

      if (index === guides.length - 1) {
        return;
      }

      decorations.push({
        kind: "line",
        id: `${laneClass}__separator`,
        classes: ["scenario_flow_lane_separator", laneClass],
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

export function decorateScenarioFlowPositionedScene(
  scene: PositionedScene,
  middleLayer: Pick<ScenarioFlowMiddleLayerModel, "laneGuides">
): PositionedScene {
  return {
    ...scene,
    decorations: buildScenarioFlowLaneDecorations(scene, middleLayer)
  };
}
