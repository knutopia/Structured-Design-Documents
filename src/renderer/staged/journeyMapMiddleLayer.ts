import type {
  JourneyMapRenderModel,
  JourneyRenderEdge,
  JourneyRenderStage
} from "../journeyMapRenderModel.js";
import type { GridCellPlacement, JourneyMapItemMetadata } from "./contracts.js";

export interface JourneyMapDiamondGroup {
  id: string;
  stageId: string;
  splitStepId: string;
  optionStepIds: string[];
  joinStepId: string;
}

export interface JourneyScenePlacement {
  metadataByItemId: ReadonlyMap<string, JourneyMapItemMetadata>;
  parentStageByStepId: ReadonlyMap<string, string>;
  gridPlacementsByStageId: ReadonlyMap<string, GridCellPlacement[]>;
  diamondGroups: JourneyMapDiamondGroup[];
  rootItemIds: string[];
  stageIds: string[];
  globalStepIds: string[];
}

interface EdgeIncidence {
  incomingByStepId: ReadonlyMap<string, JourneyRenderEdge[]>;
  outgoingByStepId: ReadonlyMap<string, JourneyRenderEdge[]>;
  outgoingTargetsByStepId: ReadonlyMap<string, string[]>;
}

function buildEdgeIncidence(edges: readonly JourneyRenderEdge[]): EdgeIncidence {
  const incomingByStepId = new Map<string, JourneyRenderEdge[]>();
  const outgoingByStepId = new Map<string, JourneyRenderEdge[]>();
  const outgoingTargetsByStepId = new Map<string, string[]>();
  for (const edge of edges) {
    const outgoing = outgoingByStepId.get(edge.from) ?? [];
    outgoing.push(edge);
    outgoingByStepId.set(edge.from, outgoing);
    const incoming = incomingByStepId.get(edge.to) ?? [];
    incoming.push(edge);
    incomingByStepId.set(edge.to, incoming);
    const targets = outgoingTargetsByStepId.get(edge.from) ?? [];
    targets.push(edge.to);
    outgoingTargetsByStepId.set(edge.from, targets);
  }
  return { incomingByStepId, outgoingByStepId, outgoingTargetsByStepId };
}

function hasPath(
  from: string,
  to: string,
  outgoingTargetsByStepId: ReadonlyMap<string, readonly string[]>
): boolean {
  const pending = [...(outgoingTargetsByStepId.get(from) ?? [])];
  const visited = new Set<string>([from]);
  while (pending.length > 0) {
    const current = pending.shift()!;
    if (current === to) {
      return true;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);
    pending.push(...(outgoingTargetsByStepId.get(current) ?? []));
  }
  return false;
}

function sameMembers(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length
    && new Set(actual).size === actual.length
    && expected.every((itemId) => actual.includes(itemId));
}

function diamondGroupId(stageId: string, splitStepId: string, joinStepId: string): string {
  const escapePart = (value: string): string => value
    .replaceAll("%", "%25")
    .replaceAll("_", "%5F");
  return `${escapePart(stageId)}__diamond__${escapePart(splitStepId)}__${escapePart(joinStepId)}`;
}

function recognizeDiamondAt(
  stage: JourneyRenderStage,
  splitOrder: number,
  incidence: EdgeIncidence
): JourneyMapDiamondGroup | undefined {
  const split = stage.items[splitOrder];
  if (split === undefined) {
    return undefined;
  }
  const stageStepOrderById = new Map(stage.items.map((step, order) => [step.id, order] as const));
  const splitOutgoing = incidence.outgoingByStepId.get(split.id) ?? [];
  const optionStepIds = splitOutgoing.map((edge) => edge.to);
  if (optionStepIds.length < 2 || new Set(optionStepIds).size !== optionStepIds.length) {
    return undefined;
  }
  const optionOrders = optionStepIds
    .map((stepId) => stageStepOrderById.get(stepId))
    .sort((left, right) => (left ?? Number.MAX_SAFE_INTEGER) - (right ?? Number.MAX_SAFE_INTEGER));
  if (optionOrders.some((order) => order === undefined)
    || optionOrders.some((order, optionOrder) => order !== splitOrder + optionOrder + 1)) {
    return undefined;
  }
  const authoredOptionStepIds = optionOrders.map((order) => stage.items[order!]!.id);
  if (!sameMembers(optionStepIds, authoredOptionStepIds)) {
    return undefined;
  }

  const joinOrder = splitOrder + authoredOptionStepIds.length + 1;
  const join = stage.items[joinOrder];
  if (join === undefined) {
    return undefined;
  }
  for (const optionStepId of authoredOptionStepIds) {
    const optionOutgoing = incidence.outgoingByStepId.get(optionStepId) ?? [];
    const optionIncoming = incidence.incomingByStepId.get(optionStepId) ?? [];
    if (optionOutgoing.length !== 1
      || optionOutgoing[0]!.to !== join.id
      || optionIncoming.length !== 1
      || optionIncoming[0]!.from !== split.id) {
      return undefined;
    }
  }
  const joinIncoming = (incidence.incomingByStepId.get(join.id) ?? []).map((edge) => edge.from);
  if (!sameMembers(joinIncoming, authoredOptionStepIds)
    || hasPath(join.id, split.id, incidence.outgoingTargetsByStepId)) {
    return undefined;
  }

  return {
    id: diamondGroupId(stage.id, split.id, join.id),
    stageId: stage.id,
    splitStepId: split.id,
    optionStepIds: authoredOptionStepIds,
    joinStepId: join.id
  };
}

function recognizeStageDiamonds(
  stage: JourneyRenderStage,
  incidence: EdgeIncidence
): JourneyMapDiamondGroup[] {
  const candidates = stage.items.flatMap((_, stepOrder) => {
    const group = recognizeDiamondAt(stage, stepOrder, incidence);
    return group ? [group] : [];
  });
  const participationCounts = new Map<string, number>();
  for (const group of candidates) {
    for (const stepId of [group.splitStepId, ...group.optionStepIds, group.joinStepId]) {
      participationCounts.set(stepId, (participationCounts.get(stepId) ?? 0) + 1);
    }
  }
  return [...participationCounts.values()].some((count) => count > 1)
    ? []
    : candidates;
}

export function buildJourneyScenePlacement(model: JourneyMapRenderModel): JourneyScenePlacement {
  const metadataByItemId = new Map<string, JourneyMapItemMetadata>();
  const parentStageByStepId = new Map<string, string>();
  const gridPlacementsByStageId = new Map<string, GridCellPlacement[]>();
  const diamondGroups: JourneyMapDiamondGroup[] = [];
  const rootItemIds = model.rootItems.map((item) => item.id);
  const stageIds: string[] = [];
  const globalStepIds: string[] = [];
  const incidence = buildEdgeIncidence(model.edges);
  let stageOrder = 0;

  for (const [rootOrder, item] of model.rootItems.entries()) {
    if (item.kind === "stage") {
      const currentStageOrder = stageOrder++;
      stageIds.push(item.id);
      metadataByItemId.set(item.id, {
        kind: "stage",
        rootOrder,
        stageOrder: currentStageOrder
      });

      const stageDiamonds = recognizeStageDiamonds(item, incidence);
      diamondGroups.push(...stageDiamonds);
      const diamondBySplitId = new Map(stageDiamonds.map((group) => [group.splitStepId, group] as const));
      const stageGridPlacements: GridCellPlacement[] = [];
      let progressionColumn = 0;
      let stepOrder = 0;
      while (stepOrder < item.items.length) {
        const group = diamondBySplitId.get(item.items[stepOrder]!.id);
        const placements = group === undefined
          ? [{
            step: item.items[stepOrder]!,
            stepOrder,
            progressionColumn,
            laneOrder: 0,
            placementRole: "linear" as const,
            branchGroupId: undefined
          }]
          : [
            {
              step: item.items[stepOrder]!,
              stepOrder,
              progressionColumn,
              laneOrder: 0,
              placementRole: "diamond_split" as const,
              branchGroupId: group.id
            },
            ...group.optionStepIds.map((optionStepId, laneOrder) => ({
              step: item.items[stepOrder + laneOrder + 1]!,
              stepOrder: stepOrder + laneOrder + 1,
              progressionColumn: progressionColumn + 1,
              laneOrder,
              placementRole: "diamond_option" as const,
              branchGroupId: group.id
            })),
            {
              step: item.items[stepOrder + group.optionStepIds.length + 1]!,
              stepOrder: stepOrder + group.optionStepIds.length + 1,
              progressionColumn: progressionColumn + 2,
              laneOrder: 0,
              placementRole: "diamond_join" as const,
              branchGroupId: group.id
            }
          ];

        for (const placement of placements) {
          const globalStepOrder = globalStepIds.length;
          globalStepIds.push(placement.step.id);
          parentStageByStepId.set(placement.step.id, item.id);
          metadataByItemId.set(placement.step.id, {
            kind: "step",
            rootOrder,
            stageId: item.id,
            stageOrder: currentStageOrder,
            stepOrder: placement.stepOrder,
            globalStepOrder,
            uncontained: false,
            progressionColumn: placement.progressionColumn,
            laneOrder: placement.laneOrder,
            placementRole: placement.placementRole,
            ...(placement.branchGroupId ? { branchGroupId: placement.branchGroupId } : {})
          });
          stageGridPlacements.push({
            itemId: placement.step.id,
            row: placement.laneOrder,
            column: placement.progressionColumn
          });
        }

        if (group === undefined) {
          stepOrder += 1;
          progressionColumn += 1;
        } else {
          stepOrder += group.optionStepIds.length + 2;
          progressionColumn += 3;
        }
      }
      if (stageDiamonds.length > 0) {
        gridPlacementsByStageId.set(item.id, stageGridPlacements);
      }
      continue;
    }

    const globalStepOrder = globalStepIds.length;
    globalStepIds.push(item.id);
    metadataByItemId.set(item.id, {
      kind: "step",
      rootOrder,
      globalStepOrder,
      uncontained: true
    });
  }

  return {
    metadataByItemId,
    parentStageByStepId,
    gridPlacementsByStageId,
    diamondGroups,
    rootItemIds,
    stageIds,
    globalStepIds
  };
}
