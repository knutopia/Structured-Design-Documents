import type { ViewSpec } from "../../bundle/types.js";
import type { CompiledGraph } from "../../compiler/types.js";
import type { Projection, ProjectionNodeAnnotation } from "../../projector/types.js";
import { resolvePlaceLabelDisplayOptions } from "../placeLabelLines.js";
import { resolveProfileDisplayPolicy } from "../profileDisplay.js";
import { buildIaPlaceMapRenderModel, type IaRenderArea, type IaRenderItem, type IaRenderPlace } from "../iaPlaceMapRenderModel.js";
import type {
  ContentBlock,
  LocalRoutePattern,
  RendererScene,
  SceneContainer,
  SceneEdge,
  SceneItem,
  SceneNode
} from "./contracts.js";
import { IA_LOCAL_ROUTE_PATTERNS } from "./contracts.js";
import { runStagedRendererPipeline, type StagedRendererPipelineResult } from "./pipeline.js";
import {
  buildIaPlaceMapPorts,
  buildCardNode,
  buildDiagramRootContainer
} from "./sceneBuilders.js";
import {
  renderPositionedSceneToPng,
  renderPositionedSceneToSvg,
  type StagedPngArtifact,
  type StagedSvgArtifact
} from "./svgBackend.js";

const ROOT_GAP = 48;
const AREA_GAP = 20;
const PLACE_GROUP_GAP = 32;
const OWNED_SCOPE_GAP = 32;
const OWNED_SCOPE_INDENT = 48;
const CHAIN_PORT_OFFSET = 24;

type OwnedScopeKind = "contains_scope_single" | "contains_scope_branch" | "follower_scope";
type LocalStructureRelation = "contains" | "follower";
type ScopeEntry =
  | {
    kind: "area";
    area: IaRenderArea;
  }
  | {
    kind: "place";
    place: IaRenderPlace;
    followers: IaRenderPlace[];
  };

interface PlannedLocalStructureEdge {
  targetId: string;
  relation: LocalStructureRelation;
  localPattern: LocalRoutePattern;
  mergedNavigation: boolean;
}

interface OwnedScopePlan {
  explicitEntries: ScopeEntry[];
  followers: readonly IaRenderPlace[];
  kind: OwnedScopeKind | undefined;
  edgePlans: PlannedLocalStructureEdge[];
}

interface SceneBuildContext {
  projectionNodesById: ReadonlyMap<string, Projection["nodes"][number]>;
  annotationsByNodeId: ReadonlyMap<string, ProjectionNodeAnnotation>;
  navigationTargetsBySourceId: ReadonlyMap<string, ReadonlySet<string>>;
  placeOrderById: ReadonlyMap<string, number>;
  edges: SceneEdge[];
}

export interface IaPlaceMapStagedSvgResult extends StagedRendererPipelineResult, StagedSvgArtifact {}
export interface IaPlaceMapStagedPngResult extends StagedRendererPipelineResult, StagedPngArtifact {}

function shouldIncludeMetadata(
  key: string,
  displayOptions: ReturnType<typeof resolvePlaceLabelDisplayOptions>
): boolean {
  switch (key) {
    case "entry_points":
      return displayOptions.showPlaceEntryPoints;
    case "primary_nav":
      return displayOptions.showPlacePrimaryNav;
    default:
      return true;
  }
}

function buildPlaceContentBlocks(
  placeId: string,
  context: SceneBuildContext,
  displayOptions: ReturnType<typeof resolvePlaceLabelDisplayOptions>
): ContentBlock[] {
  const projectionNode = context.projectionNodesById.get(placeId);
  if (!projectionNode) {
    return [];
  }

  const blocks: ContentBlock[] = [
    {
      id: `${placeId}__title`,
      kind: "text",
      text: projectionNode.name,
      textStyleRole: "title",
      priority: "primary"
    }
  ];
  const annotation = context.annotationsByNodeId.get(placeId)?.display;

  if (displayOptions.showPlaceRouteOrKey && annotation?.subtitle) {
    blocks.push({
      id: `${placeId}__subtitle`,
      kind: "text",
      text: annotation.subtitle,
      textStyleRole: "subtitle",
      priority: "secondary"
    });
  }

  if (displayOptions.showPlaceAccess && annotation?.badge) {
    blocks.push({
      id: `${placeId}__badge`,
      kind: "badge_text",
      text: annotation.badge,
      textStyleRole: "badge",
      priority: "secondary"
    });
  }

  annotation?.metadata
    ?.filter((entry) => shouldIncludeMetadata(entry.key, displayOptions))
    .forEach((entry, index) => {
      blocks.push({
        id: `${placeId}__metadata__${entry.key}__${index}`,
        kind: "metadata",
        text: `${entry.key}: ${entry.value}`,
        textStyleRole: "metadata",
        priority: "secondary"
      });
    });

  return blocks;
}

function buildPlaceNode(
  place: IaRenderPlace,
  depth: number,
  context: SceneBuildContext,
  displayOptions: ReturnType<typeof resolvePlaceLabelDisplayOptions>
): SceneNode {
  return buildCardNode({
    id: place.id,
    role: "place",
    classes: ["place", depth === 0 ? "root_place" : "nested_place", `depth-${depth}`],
    widthPolicy: {
      preferred: "narrow",
      allowed: ["narrow", "standard", "wide"]
    },
    content: buildPlaceContentBlocks(place.id, context, displayOptions),
    ports: buildIaPlaceMapPorts(CHAIN_PORT_OFFSET)
  });
}

function buildPlaceOrderIndex(items: readonly IaRenderItem[], placeOrderById: Map<string, number>, state: { next: number }): void {
  for (const item of items) {
    if (item.kind === "area") {
      buildPlaceOrderIndex(item.items, placeOrderById, state);
      continue;
    }

    placeOrderById.set(item.id, state.next);
    state.next += 1;
    buildPlaceOrderIndex(item.items, placeOrderById, state);
  }
}

function buildNavigationTargetsBySourceId(edges: readonly { from: string; to: string }[]): Map<string, ReadonlySet<string>> {
  const targetsBySourceId = new Map<string, Set<string>>();

  for (const edge of edges) {
    const existing = targetsBySourceId.get(edge.from);
    if (existing) {
      existing.add(edge.to);
      continue;
    }

    targetsBySourceId.set(edge.from, new Set([edge.to]));
  }

  return new Map(
    [...targetsBySourceId.entries()].map(([sourceId, targets]) => [sourceId, new Set(targets) as ReadonlySet<string>])
  );
}

function hasForwardNavigation(sourceId: string, targetId: string, context: SceneBuildContext): boolean {
  const sourceOrder = context.placeOrderById.get(sourceId);
  const targetOrder = context.placeOrderById.get(targetId);
  if (sourceOrder === undefined || targetOrder === undefined || sourceOrder >= targetOrder) {
    return false;
  }

  return context.navigationTargetsBySourceId.get(sourceId)?.has(targetId) ?? false;
}

function collectFollowerPlaces(
  hubPlace: IaRenderPlace,
  items: readonly IaRenderItem[],
  startIndex: number,
  claimedFollowerIds: Set<string>,
  context: SceneBuildContext
): IaRenderPlace[] {
  const followers: IaRenderPlace[] = [];

  for (let candidateIndex = startIndex + 1; candidateIndex < items.length; candidateIndex += 1) {
    const candidate = items[candidateIndex];
    if (!candidate || candidate.kind !== "place") {
      break;
    }
    if (claimedFollowerIds.has(candidate.id)) {
      continue;
    }
    if (!hasForwardNavigation(hubPlace.id, candidate.id, context)) {
      continue;
    }

    followers.push(candidate);
    claimedFollowerIds.add(candidate.id);
  }

  return followers;
}

function planScopeEntries(items: readonly IaRenderItem[], context: SceneBuildContext): ScopeEntry[] {
  const planned: ScopeEntry[] = [];
  const claimedFollowerIds = new Set<string>();

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!item) {
      continue;
    }

    if (item.kind === "area") {
      planned.push({ kind: "area", area: item });
      continue;
    }

    if (claimedFollowerIds.has(item.id)) {
      continue;
    }

    planned.push({
      kind: "place",
      place: item,
      followers: collectFollowerPlaces(item, items, index, claimedFollowerIds, context)
    });
  }

  return planned;
}

function buildOwnedScopeContainer(
  ownerPlaceId: string,
  kind: OwnedScopeKind,
  children: SceneItem[]
): SceneContainer {
  return {
    kind: "container",
    id: `${ownerPlaceId}__${kind}`,
    role: kind,
    primitive: "stack",
    classes: ["owned_scope", kind],
    layout: {
      strategy: "stack",
      direction: "vertical",
      gap: OWNED_SCOPE_GAP,
      crossAlignment: "start"
    },
    chrome: {
      padding: {
        top: 0,
        right: 0,
        bottom: 0,
        left: kind === "contains_scope_single" ? 0 : OWNED_SCOPE_INDENT
      },
      gutter: OWNED_SCOPE_GAP,
      headerBandHeight: 0
    },
    children,
    ports: []
  };
}

function buildPlaceGroupContainer(placeId: string, depth: number, children: SceneItem[]): SceneContainer {
  return {
    kind: "container",
    id: `${placeId}__group`,
    role: "place_group",
    primitive: "stack",
    classes: ["place_group", depth === 0 ? "group_root" : "group_nested", `depth-${depth}`],
    layout: {
      strategy: "stack",
      direction: "vertical",
      gap: PLACE_GROUP_GAP,
      crossAlignment: "start"
    },
    chrome: {
      padding: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
      },
      gutter: PLACE_GROUP_GAP,
      headerBandHeight: 0
    },
    children,
    ports: []
  };
}

function resolveOwnedScopeKind(explicitEntryCount: number, followerCount: number): OwnedScopeKind | undefined {
  if (explicitEntryCount + followerCount === 0) {
    return undefined;
  }

  if (followerCount > 0) {
    return "follower_scope";
  }

  return explicitEntryCount === 1 ? "contains_scope_single" : "contains_scope_branch";
}

function getContainsLocalPattern(kind: OwnedScopeKind): LocalRoutePattern {
  return kind === "contains_scope_single"
    ? IA_LOCAL_ROUTE_PATTERNS.directVertical
    : IA_LOCAL_ROUTE_PATTERNS.sharedTrunk;
}

function planOwnedScopeEdgePlans(
  ownerPlaceId: string,
  explicitEntries: readonly ScopeEntry[],
  followers: readonly IaRenderPlace[],
  ownedScopeKind: OwnedScopeKind | undefined,
  context: SceneBuildContext
): PlannedLocalStructureEdge[] {
  if (!ownedScopeKind) {
    return [];
  }

  const edgePlans: PlannedLocalStructureEdge[] = [];
  const containsLocalPattern = getContainsLocalPattern(ownedScopeKind);

  for (const entry of explicitEntries) {
    if (entry.kind !== "place") {
      continue;
    }

    edgePlans.push({
      targetId: entry.place.id,
      relation: "contains",
      localPattern: containsLocalPattern,
      mergedNavigation: hasForwardNavigation(ownerPlaceId, entry.place.id, context)
    });
  }

  for (const follower of followers) {
    edgePlans.push({
      targetId: follower.id,
      relation: "follower",
      localPattern: IA_LOCAL_ROUTE_PATTERNS.sharedTrunk,
      mergedNavigation: true
    });
  }

  return edgePlans;
}

function planOwnedScope(
  place: IaRenderPlace,
  followers: readonly IaRenderPlace[],
  context: SceneBuildContext
): OwnedScopePlan {
  const explicitEntries = planScopeEntries(place.items, context);
  const kind = resolveOwnedScopeKind(explicitEntries.length, followers.length);

  return {
    explicitEntries,
    followers,
    kind,
    edgePlans: planOwnedScopeEdgePlans(place.id, explicitEntries, followers, kind, context)
  };
}

function createLocalStructureEdge(sourceId: string, edgePlan: PlannedLocalStructureEdge): SceneEdge {
  const isDirectVertical = edgePlan.localPattern === IA_LOCAL_ROUTE_PATTERNS.directVertical;
  const edgeId = edgePlan.relation === "contains" && !edgePlan.mergedNavigation
    ? `${sourceId}__contains__${edgePlan.targetId}`
    : `${sourceId}__nav__${edgePlan.targetId}`;

  return {
    id: edgeId,
    role: edgePlan.relation === "contains"
      ? (edgePlan.mergedNavigation ? "contains_navigation" : "contains_place")
      : "navigation",
    classes: [
      "ia_local_structure",
      edgePlan.relation === "contains" ? "contains_edge" : "follower_edge",
      edgePlan.mergedNavigation ? "merged_navigation" : "structural_only",
      isDirectVertical ? "direct_vertical" : "shared_trunk"
    ],
    from: {
      itemId: sourceId,
      portId: "south_chain"
    },
    to: {
      itemId: edgePlan.targetId,
      portId: isDirectVertical ? "north_chain" : "west"
    },
    routing: {
      style: "orthogonal",
      preferAxis: isDirectVertical ? "vertical" : "horizontal",
      localPattern: edgePlan.localPattern
    },
    markers: {
      end: "arrow"
    }
  };
}

function buildSceneItemFromScopeEntry(
  entry: ScopeEntry,
  scopeId: string,
  depth: number,
  context: SceneBuildContext,
  displayOptions: ReturnType<typeof resolvePlaceLabelDisplayOptions>
): SceneItem {
  return entry.kind === "area"
    ? buildAreaScene(entry.area, scopeId, context, displayOptions)
    : buildPlaceGroup(entry.place, entry.followers, scopeId, depth, context, displayOptions);
}

function buildPlaceGroup(
  place: IaRenderPlace,
  followers: readonly IaRenderPlace[],
  scopeId: string,
  depth: number,
  context: SceneBuildContext,
  displayOptions: ReturnType<typeof resolvePlaceLabelDisplayOptions>
): SceneContainer {
  const ownedScope = planOwnedScope(place, followers, context);
  const explicitChildren = ownedScope.explicitEntries.map((entry) =>
    buildSceneItemFromScopeEntry(entry, `${scopeId}/${place.id}`, depth + 1, context, displayOptions)
  );
  const followerChildren = ownedScope.followers.map((follower) =>
    buildPlaceGroup(follower, [], `${scopeId}/${place.id}__followers`, depth + 1, context, displayOptions)
  );
  const ownedChildren = [...explicitChildren, ...followerChildren];
  context.edges.push(...ownedScope.edgePlans.map((edgePlan) => createLocalStructureEdge(place.id, edgePlan)));

  const children: SceneItem[] = [buildPlaceNode(place, depth, context, displayOptions)];
  if (ownedScope.kind) {
    children.push(buildOwnedScopeContainer(place.id, ownedScope.kind, ownedChildren));
  }

  return buildPlaceGroupContainer(place.id, depth, children);
}

function buildAreaScene(
  area: IaRenderArea,
  scopeId: string,
  context: SceneBuildContext,
  displayOptions: ReturnType<typeof resolvePlaceLabelDisplayOptions>
): SceneContainer {
  return {
    kind: "container",
    id: area.id,
    role: "area",
    primitive: "cluster",
    classes: ["area"],
    layout: {
      strategy: "stack",
      direction: "vertical",
      gap: AREA_GAP,
      crossAlignment: "start"
    },
    chrome: {
      padding: {
        top: 16,
        right: 16,
        bottom: 16,
        left: 16
      },
      gutter: AREA_GAP
    },
    headerContent: [
      {
        id: `${area.id}__header`,
        kind: "text",
        text: area.label,
        textStyleRole: "title",
        priority: "primary"
      }
    ],
    children: buildScopeSceneItems(area.items, `${scopeId}/${area.id}`, 0, context, displayOptions),
    ports: []
  };
}

function buildScopeSceneItems(
  items: readonly IaRenderItem[],
  scopeId: string,
  depth: number,
  context: SceneBuildContext,
  displayOptions: ReturnType<typeof resolvePlaceLabelDisplayOptions>
): SceneItem[] {
  return planScopeEntries(items, context).map((entry) =>
    buildSceneItemFromScopeEntry(entry, scopeId, depth, context, displayOptions)
  );
}

export function buildIaPlaceMapRendererScene(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  profileId: string,
  themeId = "default"
): RendererScene {
  const displayOptions = resolvePlaceLabelDisplayOptions(resolveProfileDisplayPolicy(view, profileId));
  const model = buildIaPlaceMapRenderModel(projection, graph, view.projection.hierarchy_edges ?? []);
  const placeOrderById = new Map<string, number>();
  buildPlaceOrderIndex(model.rootItems, placeOrderById, { next: 0 });

  const context: SceneBuildContext = {
    projectionNodesById: new Map(projection.nodes.map((node) => [node.id, node])),
    annotationsByNodeId: new Map(projection.derived.node_annotations.map((annotation) => [annotation.node_id, annotation])),
    navigationTargetsBySourceId: buildNavigationTargetsBySourceId(model.edges),
    placeOrderById,
    edges: []
  };
  const rootChildren = buildScopeSceneItems(model.rootItems, "root", 0, context, displayOptions);

  return {
    viewId: "ia_place_map",
    profileId,
    themeId,
    root: buildDiagramRootContainer({
      viewId: "ia_place_map",
      layout: {
        strategy: "stack",
        direction: "horizontal",
        gap: ROOT_GAP,
        crossAlignment: "start"
      },
      chrome: {
        padding: {
          top: 24,
          right: 24,
          bottom: 24,
          left: 24
        },
        gutter: ROOT_GAP,
        headerBandHeight: 0
      },
      children: rootChildren
    }),
    edges: context.edges,
    diagnostics: []
  };
}

export async function renderIaPlaceMapStagedSvg(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  profileId: string,
  themeId = "default"
): Promise<IaPlaceMapStagedSvgResult> {
  const rendererScene = buildIaPlaceMapRendererScene(projection, graph, view, profileId, themeId);
  const pipeline = await runStagedRendererPipeline(rendererScene);
  const rendered = await renderPositionedSceneToSvg(pipeline.positionedScene);

  return {
    ...pipeline,
    ...rendered
  };
}

export async function renderIaPlaceMapStagedPng(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  profileId: string,
  themeId = "default"
): Promise<IaPlaceMapStagedPngResult> {
  const rendererScene = buildIaPlaceMapRendererScene(projection, graph, view, profileId, themeId);
  const pipeline = await runStagedRendererPipeline(rendererScene);
  const rendered = await renderPositionedSceneToPng(pipeline.positionedScene);

  return {
    ...pipeline,
    ...rendered
  };
}
