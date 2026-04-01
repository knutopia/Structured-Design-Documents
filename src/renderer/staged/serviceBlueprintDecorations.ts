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
import { createTextMeasurementService } from "./textMeasurement.js";
import { getRendererTheme } from "./theme.js";

const LANE_LABEL_X = 24;
const LANE_SEPARATOR_START_X = 24;
const ROOT_RIGHT_INSET = 28;
const SEPARATOR_TITLE_X = 24;
const SEPARATOR_TITLE_GAP_TEXT = " ";

const SEPARATOR_TITLE_BY_ROLE = {
  line_of_interaction: "Line of Interaction",
  line_of_visibility: "Line of Visibility"
} as const satisfies Partial<Record<NonNullable<ServiceBlueprintLaneGuide["separatorAfter"]>, string>>;

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

function resolveSeparatorTitle(
  guide: Pick<ServiceBlueprintLaneGuide, "separatorAfter">
): string | undefined {
  if (!guide.separatorAfter || !(guide.separatorAfter in SEPARATOR_TITLE_BY_ROLE)) {
    return undefined;
  }

  return SEPARATOR_TITLE_BY_ROLE[guide.separatorAfter as keyof typeof SEPARATOR_TITLE_BY_ROLE];
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
  const theme = getRendererTheme(scene.themeId, "measure");
  const separatorTitleStyle = theme.textStyles.edge_label;
  const measureText = createTextMeasurementService(theme.fontAssets.measurement);
  const separatorTitleGapWidth = measureText.measureText(SEPARATOR_TITLE_GAP_TEXT, separatorTitleStyle);
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
    const separatorTitle = resolveSeparatorTitle(guide);
    const titledSeparatorStartX = !separatorTitle
      ? LANE_SEPARATOR_START_X
      : SEPARATOR_TITLE_X
        + measureText.measureText(separatorTitle, separatorTitleStyle)
        + separatorTitleGapWidth;

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

    if (separatorTitle) {
      decorations.push({
        kind: "text",
        id: `${laneClass}__separator_title`,
        classes: ["service_blueprint_separator_title", guide.separatorAfter, laneClass],
        paintGroup: "labels",
        x: SEPARATOR_TITLE_X,
        y: maxY - separatorTitleStyle.fontSize,
        text: separatorTitle,
        textStyleRole: "edge_label"
      });
    }

    decorations.push({
      kind: "line",
      id: `${laneClass}__separator`,
      classes: ["service_blueprint_separator", guide.separatorAfter, laneClass],
      paintGroup: "chrome",
      from: {
        x: separatorTitle ? titledSeparatorStartX : LANE_SEPARATOR_START_X,
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
