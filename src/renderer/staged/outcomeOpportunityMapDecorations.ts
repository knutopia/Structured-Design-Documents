import type {
  OutcomeOpportunityItemMetadata,
  PositionedContainer,
  PositionedDecoration,
  PositionedItem,
  PositionedScene
} from "./contracts.js";

const COLUMN_HEADER_Y_OFFSET = 30;

type OutcomeOpportunityCellMetadata = Extract<OutcomeOpportunityItemMetadata, { kind: "cell" }>;
type PositionedOutcomeOpportunityCell = PositionedContainer & {
  viewMetadata: {
    outcomeOpportunity: OutcomeOpportunityCellMetadata;
  };
};

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

export function buildOutcomeOpportunityColumnHeaderDecorations(scene: PositionedScene): PositionedDecoration[] {
  const cells = scene.root.children.filter(isOutcomeOpportunityCell);
  const firstCellByColumn = new Map<number, PositionedOutcomeOpportunityCell>();

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
        x: cell.x + 4,
        y: Math.max(12, cell.y - COLUMN_HEADER_Y_OFFSET),
        text: metadata.columnLabel,
        textStyleRole: "label"
      } satisfies PositionedDecoration;
    });
}

export function decorateOutcomeOpportunityPositionedScene(scene: PositionedScene): PositionedScene {
  return {
    ...scene,
    decorations: buildOutcomeOpportunityColumnHeaderDecorations(scene)
  };
}
