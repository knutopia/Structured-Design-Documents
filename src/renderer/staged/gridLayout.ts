import type { LayoutIntent } from "./contracts.js";

export interface ResolvedGridCell {
  itemId: string;
  row: number;
  column: number;
}

export interface GridCellResolution {
  cells: ResolvedGridCell[];
  rowCount: number;
  columnCount: number;
  source: "explicit" | "row_major";
  invalidPlacementReasons: string[];
  invalidPlacementItemIds: string[];
  invalidColumns: boolean;
}

interface ExplicitPlacementValidation {
  cells?: ResolvedGridCell[];
  rowCount?: number;
  columnCount?: number;
  reasons: string[];
  itemIds: string[];
}

function validateExplicitPlacements(
  childIds: readonly string[],
  layout: LayoutIntent
): ExplicitPlacementValidation | undefined {
  if (layout.grid === undefined) {
    return undefined;
  }

  const placements = layout.grid.placements;
  const childIdSet = new Set(childIds);
  const seenItemIds = new Set<string>();
  const seenCells = new Map<string, string>();
  const reasons = new Set<string>();
  const relatedItemIds = new Set<string>();

  for (const placement of placements) {
    const itemId = placement.itemId;
    const validCoordinates = Number.isInteger(placement.row)
      && placement.row >= 0
      && Number.isInteger(placement.column)
      && placement.column >= 0;

    if (!childIdSet.has(itemId)) {
      reasons.add("unknown_item_id");
      relatedItemIds.add(itemId);
    }
    if (seenItemIds.has(itemId)) {
      reasons.add("duplicate_item_id");
      relatedItemIds.add(itemId);
    }
    seenItemIds.add(itemId);

    if (!validCoordinates) {
      reasons.add("invalid_cell_index");
      relatedItemIds.add(itemId);
      continue;
    }

    const cellKey = `${placement.row}:${placement.column}`;
    const priorItemId = seenCells.get(cellKey);
    if (priorItemId !== undefined) {
      reasons.add("duplicate_cell");
      relatedItemIds.add(priorItemId);
      relatedItemIds.add(itemId);
    } else {
      seenCells.set(cellKey, itemId);
    }
  }

  for (const childId of childIds) {
    if (!seenItemIds.has(childId)) {
      reasons.add("missing_item_id");
      relatedItemIds.add(childId);
    }
  }

  if (reasons.size > 0) {
    return {
      reasons: [...reasons].sort(),
      itemIds: [...relatedItemIds].sort()
    };
  }

  const cellsByItemId = new Map(
    placements.map((placement) => [placement.itemId, placement] as const)
  );
  const cells = childIds.map((itemId) => {
    const placement = cellsByItemId.get(itemId);
    if (placement === undefined) {
      throw new Error(`Validated grid placement is missing child '${itemId}'.`);
    }
    return {
      itemId,
      row: placement.row,
      column: placement.column
    };
  });

  return {
    cells,
    rowCount: cells.length === 0 ? 0 : Math.max(...cells.map((cell) => cell.row)) + 1,
    columnCount: cells.length === 0 ? 0 : Math.max(...cells.map((cell) => cell.column)) + 1,
    reasons: [],
    itemIds: []
  };
}

function resolveRowMajorCells(
  childIds: readonly string[],
  columns: number | undefined
): Omit<GridCellResolution, "source" | "invalidPlacementReasons" | "invalidPlacementItemIds"> {
  if (childIds.length === 0) {
    return {
      cells: [],
      rowCount: 0,
      columnCount: 0,
      invalidColumns: false
    };
  }

  const invalidColumns = !Number.isInteger(columns) || (columns ?? 0) < 1;
  const requestedColumns = invalidColumns ? 1 : columns ?? 1;
  const columnCount = Math.min(requestedColumns, childIds.length);

  return {
    cells: childIds.map((itemId, index) => ({
      itemId,
      row: Math.floor(index / columnCount),
      column: index % columnCount
    })),
    rowCount: Math.ceil(childIds.length / columnCount),
    columnCount,
    invalidColumns
  };
}

export function resolveGridCells(
  childIds: readonly string[],
  layout: LayoutIntent
): GridCellResolution {
  const explicit = validateExplicitPlacements(childIds, layout);
  if (explicit?.cells !== undefined) {
    return {
      cells: explicit.cells,
      rowCount: explicit.rowCount ?? 0,
      columnCount: explicit.columnCount ?? 0,
      source: "explicit",
      invalidPlacementReasons: [],
      invalidPlacementItemIds: [],
      invalidColumns: false
    };
  }

  const fallback = resolveRowMajorCells(childIds, layout.columns);
  return {
    ...fallback,
    source: "row_major",
    invalidPlacementReasons: explicit?.reasons ?? [],
    invalidPlacementItemIds: explicit?.itemIds ?? []
  };
}
