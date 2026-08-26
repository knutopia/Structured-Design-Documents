import type { RendererJourneyMapLayoutConfig } from "../../bundle/types.js";
import type {
  JourneyMapRenderModel,
  JourneyRenderEdge,
  JourneyRenderStage,
  JourneyRenderStep
} from "../journeyMapRenderModel.js";
import type { GridCellPlacement, JourneyMapItemMetadata } from "./contracts.js";

export interface JourneyMapDiamondGroup {
  id: string;
  stageId: string;
  splitStepId: string;
  optionStepIds: string[];
  joinStepId: string;
}

export interface JourneyMapBranchGroup {
  id: string;
  scopeId: string;
  stageId?: string;
  splitStepId: string;
  targetStepIds: string[];
  joinStepId?: string;
}

export interface JourneyScenePlacement {
  metadataByItemId: ReadonlyMap<string, JourneyMapItemMetadata>;
  parentStageByStepId: ReadonlyMap<string, string>;
  gridPlacementsByStageId: ReadonlyMap<string, GridCellPlacement[]>;
  rootGridPlacements?: GridCellPlacement[];
  diamondGroups: JourneyMapDiamondGroup[];
  branchGroups: JourneyMapBranchGroup[];
  rootItemIds: string[];
  stageIds: string[];
  globalStepIds: string[];
}

interface ScopeEdge {
  from: string;
  to: string;
  authorOrder: number;
}

interface ScopeComponent {
  stepIds: string[];
  edges: ScopeEdge[];
}

interface ScopeStepPlacement {
  stepId: string;
  column: number;
  row: number;
  placementRole: Extract<JourneyMapItemMetadata, { kind: "step" }>["placementRole"];
  branchGroupId?: string;
}

interface ScopeLayout {
  placements: ScopeStepPlacement[];
  width: number;
  hasStacking: boolean;
  branchGroups: JourneyMapBranchGroup[];
  diamondGroups: JourneyMapDiamondGroup[];
}

function escapeGroupPart(value: string): string {
  return value.replaceAll("%", "%25").replaceAll("_", "%5F");
}

function diamondGroupId(scopeId: string, splitStepId: string, joinStepId: string): string {
  return `${escapeGroupPart(scopeId)}__diamond__${escapeGroupPart(splitStepId)}__${escapeGroupPart(joinStepId)}`;
}

function branchComponentId(scopeId: string, splitStepId: string): string {
  return `${escapeGroupPart(scopeId)}__branch__${escapeGroupPart(splitStepId)}`;
}

function uniqueScopeEdges(
  stepIdSet: ReadonlySet<string>,
  edges: readonly JourneyRenderEdge[]
): ScopeEdge[] {
  const seen = new Set<string>();
  const result: ScopeEdge[] = [];
  for (const edge of edges) {
    if (!stepIdSet.has(edge.from) || !stepIdSet.has(edge.to)) {
      continue;
    }
    const key = `${edge.from}\u0000${edge.to}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push({ from: edge.from, to: edge.to, authorOrder: edge.authorOrder });
  }
  return result;
}

function findScopeComponents(
  stepIds: readonly string[],
  edges: readonly ScopeEdge[]
): ScopeComponent[] {
  const sourceOrder = new Map(stepIds.map((stepId, index) => [stepId, index] as const));
  const adjacency = new Map(stepIds.map((stepId) => [stepId, new Set<string>()] as const));
  for (const edge of edges) {
    adjacency.get(edge.from)?.add(edge.to);
    adjacency.get(edge.to)?.add(edge.from);
  }

  const visited = new Set<string>();
  const components: ScopeComponent[] = [];
  for (const rootId of stepIds) {
    if (visited.has(rootId)) {
      continue;
    }
    const pending = [rootId];
    const componentIds = new Set<string>();
    visited.add(rootId);
    while (pending.length > 0) {
      const current = pending.shift()!;
      componentIds.add(current);
      const neighbors = [...(adjacency.get(current) ?? [])]
        .sort((left, right) => (sourceOrder.get(left) ?? 0) - (sourceOrder.get(right) ?? 0));
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          pending.push(neighbor);
        }
      }
    }
    components.push({
      stepIds: stepIds.filter((stepId) => componentIds.has(stepId)),
      edges: edges.filter((edge) => componentIds.has(edge.from) && componentIds.has(edge.to))
    });
  }
  return components;
}

function buildIncidence(
  stepIds: readonly string[],
  edges: readonly ScopeEdge[],
  sourceOrder: ReadonlyMap<string, number>
): {
  incoming: Map<string, ScopeEdge[]>;
  outgoing: Map<string, ScopeEdge[]>;
} {
  const incoming = new Map(stepIds.map((stepId) => [stepId, [] as ScopeEdge[]] as const));
  const outgoing = new Map(stepIds.map((stepId) => [stepId, [] as ScopeEdge[]] as const));
  for (const edge of edges) {
    incoming.get(edge.to)?.push(edge);
    outgoing.get(edge.from)?.push(edge);
  }
  for (const values of incoming.values()) {
    values.sort((left, right) =>
      (sourceOrder.get(left.from) ?? Number.MAX_SAFE_INTEGER)
        - (sourceOrder.get(right.from) ?? Number.MAX_SAFE_INTEGER)
      || left.authorOrder - right.authorOrder
      || left.from.localeCompare(right.from));
  }
  for (const values of outgoing.values()) {
    values.sort((left, right) =>
      (sourceOrder.get(left.to) ?? Number.MAX_SAFE_INTEGER)
        - (sourceOrder.get(right.to) ?? Number.MAX_SAFE_INTEGER)
      || left.authorOrder - right.authorOrder
      || left.to.localeCompare(right.to));
  }
  return { incoming, outgoing };
}

function topologicalOrder(
  stepIds: readonly string[],
  incidence: ReturnType<typeof buildIncidence>,
  sourceOrder: ReadonlyMap<string, number>
): string[] | undefined {
  const indegree = new Map(stepIds.map((stepId) => [stepId, incidence.incoming.get(stepId)?.length ?? 0] as const));
  const queue = stepIds.filter((stepId) => (indegree.get(stepId) ?? 0) === 0);
  const ordered: string[] = [];
  while (queue.length > 0) {
    queue.sort((left, right) => (sourceOrder.get(left) ?? 0) - (sourceOrder.get(right) ?? 0));
    const current = queue.shift()!;
    ordered.push(current);
    for (const edge of incidence.outgoing.get(current) ?? []) {
      const next = (indegree.get(edge.to) ?? 0) - 1;
      indegree.set(edge.to, next);
      if (next === 0) {
        queue.push(edge.to);
      }
    }
  }
  return ordered.length === stepIds.length ? ordered : undefined;
}

function hasPath(
  from: string,
  to: string,
  outgoing: ReadonlyMap<string, readonly ScopeEdge[]>
): boolean {
  const pending = [...(outgoing.get(from) ?? [])].map((edge) => edge.to);
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
    pending.push(...(outgoing.get(current) ?? []).map((edge) => edge.to));
  }
  return false;
}

function compareBranchPath(left: readonly number[], right: readonly number[]): number {
  const sharedLength = Math.min(left.length, right.length);
  for (let index = 0; index < sharedLength; index += 1) {
    if (left[index] !== right[index]) {
      return left[index]! - right[index]!;
    }
  }
  return left.length - right.length;
}

function firstCommonJoin(
  targets: readonly string[],
  ordered: readonly string[],
  outgoing: ReadonlyMap<string, readonly ScopeEdge[]>
): string | undefined {
  const reachableFrom = (start: string): Set<string> => {
    const reached = new Set<string>();
    const pending = [start];
    while (pending.length > 0) {
      const current = pending.shift()!;
      if (reached.has(current)) {
        continue;
      }
      reached.add(current);
      pending.push(...(outgoing.get(current) ?? []).map((edge) => edge.to));
    }
    return reached;
  };
  const reachability = targets.map(reachableFrom);
  return ordered.find((stepId) => reachability.every((reachable) => reachable.has(stepId)));
}

function recognizeDiamondGroups(
  scopeId: string,
  stageId: string | undefined,
  stepIds: readonly string[],
  incidence: ReturnType<typeof buildIncidence>
): JourneyMapDiamondGroup[] {
  if (stageId === undefined) {
    return [];
  }
  const groups: JourneyMapDiamondGroup[] = [];
  for (const [splitOrder, splitStepId] of stepIds.entries()) {
    const options = incidence.outgoing.get(splitStepId) ?? [];
    if (options.length < 2) {
      continue;
    }
    const optionStepIds = options.map((edge) => edge.to);
    if (!optionStepIds.every((stepId, index) => stepIds[splitOrder + index + 1] === stepId)) {
      continue;
    }
    const joinStepId = stepIds[splitOrder + optionStepIds.length + 1];
    if (joinStepId === undefined
      || optionStepIds.some((optionId) => {
        const outgoing = incidence.outgoing.get(optionId) ?? [];
        const incoming = incidence.incoming.get(optionId) ?? [];
        return outgoing.length !== 1
          || outgoing[0]?.to !== joinStepId
          || incoming.length !== 1
          || incoming[0]?.from !== splitStepId;
      })) {
      continue;
    }
    const joinSources = (incidence.incoming.get(joinStepId) ?? []).map((edge) => edge.from);
    if (joinSources.length !== optionStepIds.length
      || optionStepIds.some((optionId) => !joinSources.includes(optionId))) {
      continue;
    }
    groups.push({
      id: diamondGroupId(scopeId, splitStepId, joinStepId),
      stageId,
      splitStepId,
      optionStepIds,
      joinStepId
    });
  }
  const participation = new Map<string, number>();
  for (const group of groups) {
    for (const stepId of [group.splitStepId, ...group.optionStepIds, group.joinStepId]) {
      participation.set(stepId, (participation.get(stepId) ?? 0) + 1);
    }
  }
  return [...participation.values()].some((count) => count > 1) ? [] : groups;
}

function componentCanStack(
  component: ScopeComponent,
  scopeStepIdSet: ReadonlySet<string>,
  allEdges: readonly JourneyRenderEdge[],
  incidence: ReturnType<typeof buildIncidence>,
  sourceOrder: ReadonlyMap<string, number>,
  ordered: readonly string[] | undefined
): boolean {
  if (ordered === undefined
    || component.edges.some((edge) =>
      (sourceOrder.get(edge.to) ?? -1) <= (sourceOrder.get(edge.from) ?? -1))) {
    return false;
  }
  const componentSet = new Set(component.stepIds);
  const entryStepIds = new Set(component.stepIds.filter(
    (stepId) => (incidence.incoming.get(stepId) ?? []).length === 0
  ));
  const terminalStepIds = new Set(component.stepIds.filter(
    (stepId) => (incidence.outgoing.get(stepId) ?? []).length === 0
  ));
  if (allEdges.some((edge) => {
    const leavesScope = componentSet.has(edge.from) && !scopeStepIdSet.has(edge.to);
    const entersScope = !scopeStepIdSet.has(edge.from) && componentSet.has(edge.to);
    return (leavesScope && !terminalStepIds.has(edge.from))
      || (entersScope && !entryStepIds.has(edge.to));
  })) {
    return false;
  }
  if (component.stepIds.filter((stepId) => (incidence.incoming.get(stepId) ?? []).length === 0).length !== 1) {
    return false;
  }
  for (const stepId of component.stepIds) {
    const sources = (incidence.incoming.get(stepId) ?? []).map((edge) => edge.from);
    for (let left = 0; left < sources.length; left += 1) {
      for (let right = left + 1; right < sources.length; right += 1) {
        if (hasPath(sources[left]!, sources[right]!, incidence.outgoing)
          || hasPath(sources[right]!, sources[left]!, incidence.outgoing)) {
          return false;
        }
      }
    }
  }
  return true;
}

function layoutStepScope(
  scopeId: string,
  stageId: string | undefined,
  steps: readonly JourneyRenderStep[],
  allEdges: readonly JourneyRenderEdge[],
  layout: RendererJourneyMapLayoutConfig
): ScopeLayout {
  const stepIds = steps.map((step) => step.id);
  const stepIdSet = new Set(stepIds);
  const sourceOrder = new Map(stepIds.map((stepId, index) => [stepId, index] as const));
  const scopeEdges = uniqueScopeEdges(stepIdSet, allEdges);
  const components = findScopeComponents(stepIds, scopeEdges);
  const placements: ScopeStepPlacement[] = [];
  const branchGroups: JourneyMapBranchGroup[] = [];
  const diamondGroups: JourneyMapDiamondGroup[] = [];
  let columnCursor = 0;
  let hasStacking = false;

  for (const component of components) {
    const incidence = buildIncidence(component.stepIds, component.edges, sourceOrder);
    const splitStepIds = component.stepIds.filter((stepId) => (incidence.outgoing.get(stepId) ?? []).length > 1);
    const ordered = splitStepIds.length > 0 && layout.branch_placement === "stacked"
      ? topologicalOrder(component.stepIds, incidence, sourceOrder)
      : undefined;
    const canStack = splitStepIds.length > 0
      && layout.branch_placement === "stacked"
      && componentCanStack(component, stepIdSet, allEdges, incidence, sourceOrder, ordered);

    if (!canStack || ordered === undefined) {
      component.stepIds.forEach((stepId, index) => placements.push({
        stepId,
        column: columnCursor + index,
        row: 0,
        placementRole: "linear"
      }));
      columnCursor += component.stepIds.length;
      continue;
    }

    const componentGroupId = branchComponentId(scopeId, splitStepIds[0]!);
    const positionByStepId = new Map<string, number>();
    const branchPathByStepId = new Map<string, number[]>();
    for (const stepId of ordered) {
      const incoming = incidence.incoming.get(stepId) ?? [];
      const position = incoming.length === 0
        ? 0
        : Math.max(...incoming.map((edge) => (positionByStepId.get(edge.from) ?? 0) + 1));
      positionByStepId.set(stepId, position);

      const candidatePaths = incoming.map((edge) => {
        const sourcePath = branchPathByStepId.get(edge.from) ?? [];
        const sourceOutgoing = incidence.outgoing.get(edge.from) ?? [];
        const ordinal = sourceOutgoing.findIndex((candidate) => candidate.to === stepId);
        return ordinal <= 0 ? sourcePath : [...sourcePath, ordinal];
      }).sort(compareBranchPath);
      branchPathByStepId.set(stepId, candidatePaths[0] ?? []);
    }

    const pathKeys = [...new Set(ordered.map((stepId) =>
      JSON.stringify(branchPathByStepId.get(stepId) ?? [])))]
      .map((key) => JSON.parse(key) as number[])
      .sort(compareBranchPath);
    const rowByPathKey = new Map(pathKeys.map((path, row) => [JSON.stringify(path), row] as const));
    const componentDiamondGroups = recognizeDiamondGroups(scopeId, stageId, stepIds, incidence);
    diamondGroups.push(...componentDiamondGroups);
    const diamondByStepId = new Map<string, { group: JourneyMapDiamondGroup; role: ScopeStepPlacement["placementRole"] }>();
    for (const group of componentDiamondGroups) {
      diamondByStepId.set(group.splitStepId, { group, role: "diamond_split" });
      for (const optionId of group.optionStepIds) {
        diamondByStepId.set(optionId, { group, role: "diamond_option" });
      }
      diamondByStepId.set(group.joinStepId, { group, role: "diamond_join" });
    }

    for (const splitStepId of splitStepIds) {
      const targets = (incidence.outgoing.get(splitStepId) ?? []).map((edge) => edge.to);
      const joinStepId = firstCommonJoin(targets, ordered, incidence.outgoing);
      branchGroups.push({
        id: branchComponentId(scopeId, splitStepId),
        scopeId,
        ...(stageId ? { stageId } : {}),
        splitStepId,
        targetStepIds: targets,
        ...(joinStepId ? { joinStepId } : {})
      });
    }

    for (const stepId of component.stepIds) {
      const diamond = diamondByStepId.get(stepId);
      const outgoingCount = (incidence.outgoing.get(stepId) ?? []).length;
      const incomingCount = (incidence.incoming.get(stepId) ?? []).length;
      const genericRole: ScopeStepPlacement["placementRole"] = outgoingCount > 1
        ? "branch_split"
        : incomingCount > 1
          ? "branch_join"
          : "branch_step";
      placements.push({
        stepId,
        column: columnCursor + (positionByStepId.get(stepId) ?? 0),
        row: rowByPathKey.get(JSON.stringify(branchPathByStepId.get(stepId) ?? [])) ?? 0,
        placementRole: diamond?.role ?? genericRole,
        branchGroupId: diamond?.group.id ?? componentGroupId
      });
    }
    const componentWidth = Math.max(...component.stepIds.map((stepId) => positionByStepId.get(stepId) ?? 0)) + 1;
    columnCursor += componentWidth;
    hasStacking = true;
  }

  return {
    placements,
    width: columnCursor,
    hasStacking,
    branchGroups,
    diamondGroups
  };
}

function rootStepRuns(model: JourneyMapRenderModel): Array<{ start: number; steps: JourneyRenderStep[] }> {
  const runs: Array<{ start: number; steps: JourneyRenderStep[] }> = [];
  let current: { start: number; steps: JourneyRenderStep[] } | undefined;
  for (const [rootOrder, item] of model.rootItems.entries()) {
    if (item.kind === "step") {
      if (!current) {
        current = { start: rootOrder, steps: [] };
        runs.push(current);
      }
      current.steps.push(item);
    } else {
      current = undefined;
    }
  }
  return runs;
}

export function buildJourneyScenePlacement(
  model: JourneyMapRenderModel,
  layout: RendererJourneyMapLayoutConfig
): JourneyScenePlacement {
  const metadataByItemId = new Map<string, JourneyMapItemMetadata>();
  const parentStageByStepId = new Map<string, string>();
  const gridPlacementsByStageId = new Map<string, GridCellPlacement[]>();
  const diamondGroups: JourneyMapDiamondGroup[] = [];
  const branchGroups: JourneyMapBranchGroup[] = [];
  const rootItemIds = model.rootItems.map((item) => item.id);
  const stageIds = model.rootItems.filter((item): item is JourneyRenderStage => item.kind === "stage").map((stage) => stage.id);
  const globalStepIds = model.rootItems.flatMap((item) => item.kind === "stage"
    ? item.items.map((step) => step.id)
    : [item.id]);
  const globalStepOrderById = new Map(globalStepIds.map((stepId, order) => [stepId, order] as const));
  const stageOrderById = new Map(stageIds.map((stageId, order) => [stageId, order] as const));

  for (const [rootOrder, item] of model.rootItems.entries()) {
    if (item.kind === "stage") {
      const stageOrder = stageOrderById.get(item.id)!;
      metadataByItemId.set(item.id, { kind: "stage", rootOrder, stageOrder });
      const scopeLayout = layoutStepScope(item.id, item.id, item.items, model.edges, layout);
      diamondGroups.push(...scopeLayout.diamondGroups);
      branchGroups.push(...scopeLayout.branchGroups);
      const placementByStepId = new Map(scopeLayout.placements.map((placement) => [placement.stepId, placement] as const));
      for (const [stepOrder, step] of item.items.entries()) {
        const placement = placementByStepId.get(step.id)!;
        parentStageByStepId.set(step.id, item.id);
        metadataByItemId.set(step.id, {
          kind: "step",
          rootOrder,
          stageId: item.id,
          stageOrder,
          stepOrder,
          globalStepOrder: globalStepOrderById.get(step.id)!,
          uncontained: false,
          progressionColumn: placement.column,
          laneOrder: placement.row,
          placementRole: placement.placementRole,
          ...(placement.branchGroupId ? { branchGroupId: placement.branchGroupId } : {})
        });
      }
      if (scopeLayout.hasStacking) {
        gridPlacementsByStageId.set(item.id, scopeLayout.placements.map((placement) => ({
          itemId: placement.stepId,
          row: placement.row,
          column: placement.column
        })));
      }
      continue;
    }
    metadataByItemId.set(item.id, {
      kind: "step",
      rootOrder,
      globalStepOrder: globalStepOrderById.get(item.id)!,
      uncontained: true
    });
  }

  const rootPlacements: GridCellPlacement[] = [];
  const rootStepPlacementById = new Map<string, ScopeStepPlacement>();
  let rootColumn = 0;
  let rootHasStacking = false;
  const runByStart = new Map(rootStepRuns(model).map((run) => [run.start, run] as const));
  let rootOrder = 0;
  while (rootOrder < model.rootItems.length) {
    const item = model.rootItems[rootOrder]!;
    if (item.kind === "stage") {
      rootPlacements.push({ itemId: item.id, row: 0, column: rootColumn++ });
      rootOrder += 1;
      continue;
    }
    const run = runByStart.get(rootOrder)!;
    const scopeId = `root:${rootOrder}`;
    const scopeLayout = layoutStepScope(scopeId, undefined, run.steps, model.edges, layout);
    branchGroups.push(...scopeLayout.branchGroups);
    rootHasStacking ||= scopeLayout.hasStacking;
    for (const placement of scopeLayout.placements) {
      const offsetPlacement = { ...placement, column: placement.column + rootColumn };
      rootStepPlacementById.set(placement.stepId, offsetPlacement);
      rootPlacements.push({
        itemId: placement.stepId,
        row: placement.row,
        column: offsetPlacement.column
      });
    }
    rootColumn += scopeLayout.width;
    rootOrder += run.steps.length;
  }

  if (rootHasStacking) {
    for (const item of model.rootItems) {
      if (item.kind !== "step") {
        continue;
      }
      const placement = rootStepPlacementById.get(item.id)!;
      const metadata = metadataByItemId.get(item.id);
      if (metadata?.kind !== "step") {
        continue;
      }
      metadataByItemId.set(item.id, {
        ...metadata,
        progressionColumn: placement.column,
        laneOrder: placement.row,
        placementRole: placement.placementRole,
        ...(placement.branchGroupId ? { branchGroupId: placement.branchGroupId } : {})
      });
    }
  }

  return {
    metadataByItemId,
    parentStageByStepId,
    gridPlacementsByStageId,
    ...(rootHasStacking ? { rootGridPlacements: rootPlacements } : {}),
    diamondGroups,
    branchGroups,
    rootItemIds,
    stageIds,
    globalStepIds
  };
}
