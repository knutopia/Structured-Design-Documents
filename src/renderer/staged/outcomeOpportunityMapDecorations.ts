import type {
  OutcomeOpportunityItemMetadata,
  PositionedContainer,
  PositionedDecoration,
  PositionedItem,
  PositionedNode,
  PositionedScene
} from "./contracts.js";

const COLUMN_HEADER_Y_OFFSET = 30;
const FALLBACK_COLUMN_CONTENT_OFFSET = 12;

type OutcomeOpportunityCellMetadata = Extract<OutcomeOpportunityItemMetadata, { kind: "cell" }>;
type PositionedOutcomeOpportunityCell = PositionedContainer & {
  viewMetadata: {
    outcomeOpportunity: OutcomeOpportunityCellMetadata;
  };
};

export type OutcomeOpportunityColumnTitleMode = "plural" | "singular";

export interface OutcomeOpportunityDecorationOptions {
  columnTitleMode?: OutcomeOpportunityColumnTitleMode;
  aggregateLabels?: readonly PositionedDecoration[];
}

function sanitizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unnamed";
}

function isOutcomeOpportunityCell(item: PositionedItem): item is PositionedOutcomeOpportunityCell {
  return item.kind === "container" && item.viewMetadata?.outcomeOpportunity?.kind === "cell";
}

function collectPositionedNodes(item: PositionedItem): PositionedNode[] {
  if (item.kind === "node") {
    return [item];
  }

  return item.children.flatMap((child) => collectPositionedNodes(child));
}

function getNodeContentLeft(node: PositionedNode): number {
  return node.x + Math.min(
    ...node.content.map((block) => block.x),
    FALLBACK_COLUMN_CONTENT_OFFSET
  );
}

function getColumnTitleText(columnId: string, fallbackLabel: string, mode: OutcomeOpportunityColumnTitleMode): string {
  if (mode === "plural") {
    return fallbackLabel;
  }

  switch (columnId) {
    case "initiative":
      return "Initiative";
    case "opportunity":
      return "Opportunity";
    case "outcome":
      return "Outcome";
    case "metric":
      return "Metric";
    default:
      return fallbackLabel;
  }
}

function getColumnTitleX(cell: PositionedOutcomeOpportunityCell): number {
  const nodes = collectPositionedNodes(cell);
  if (nodes.length === 0) {
    return cell.x + cell.chrome.padding.left + FALLBACK_COLUMN_CONTENT_OFFSET;
  }

  return Math.min(...nodes.map((node) => getNodeContentLeft(node)));
}

export function buildOutcomeOpportunityColumnHeaderDecorations(
  scene: PositionedScene,
  options: OutcomeOpportunityDecorationOptions = {}
): PositionedDecoration[] {
  const cells = scene.root.children.filter(isOutcomeOpportunityCell);
  const firstCellByColumn = new Map<number, PositionedOutcomeOpportunityCell>();
  const columnTitleMode = options.columnTitleMode ?? "plural";

  for (const cell of cells) {
    const metadata = cell.viewMetadata.outcomeOpportunity;
    const existing = firstCellByColumn.get(metadata.columnOrder);
    if (!existing || cell.y < existing.y || (cell.y === existing.y && cell.x < existing.x)) {
      firstCellByColumn.set(metadata.columnOrder, cell);
    }
  }

  return [...firstCellByColumn.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([, cell]) => {
      const metadata = cell.viewMetadata.outcomeOpportunity;
      return {
        kind: "text",
        id: `outcome-opportunity-column-${sanitizeToken(metadata.columnId)}__title`,
        classes: ["outcome_opportunity_column_title", `column-${sanitizeToken(metadata.columnId)}`],
        paintGroup: "labels",
        x: getColumnTitleX(cell),
        y: Math.max(12, cell.y - COLUMN_HEADER_Y_OFFSET),
        text: getColumnTitleText(metadata.columnId, metadata.columnLabel, columnTitleMode),
        textStyleRole: "label"
      } satisfies PositionedDecoration;
    });
}

export function decorateOutcomeOpportunityPositionedScene(
  scene: PositionedScene,
  options: OutcomeOpportunityDecorationOptions = {}
): PositionedScene {
  return {
    ...scene,
    decorations: [
      ...buildOutcomeOpportunityColumnHeaderDecorations(scene, options),
      ...(options.aggregateLabels ?? [])
    ]
  };
}
