import { applyDiagramMetadata, completeExactSceneConnections } from "./sceneBuilders.js";
import type { Bundle, ViewSpec } from "../../bundle/types.js";
import type { CompiledGraph } from "../../compiler/types.js";
import type { Projection } from "../../projector/types.js";
import { resolveDetailDisplayPolicy } from "../detailDisplay.js";
import {
  buildIaPlaceMapRenderModel,
  resolveIaPlaceMapRelationshipRuntime,
  type IaRenderArea,
  type IaRenderItem,
  type IaRenderPlace
} from "../iaPlaceMapRenderModel.js";
import type {
  LocalRoutePattern,
  NodeDecoratorMode,
  RendererScene,
  SceneContainer,
  SceneEdge,
  SceneItem,
  SceneNode,
  StagedRenderSettings
} from "./contracts.js";
import type { RendererDiagnostic } from "./diagnostics.js";
import { IA_LOCAL_ROUTE_PATTERNS } from "./contracts.js";
import type { StagedRendererPipelineResult } from "./pipeline.js";
import { runIaPlaceMapRendererPipeline } from "./iaPlaceMapRouting.js";
import {
  buildIaPlaceMapPorts,
  buildDiagramRootContainer,
  buildSharedNode
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
  nodeDecoratorMode: NodeDecoratorMode;
  navigationTargetsBySourceId: ReadonlyMap<string, ReadonlySet<string>>;
  placeOrderById: ReadonlyMap<string, number>;
  edges: SceneEdge[];
  occurrencePolicyEnabled: boolean;
  containmentFusionRelationship?: string;
  structuralSourceIdsByTriple?: ReadonlyMap<string, string[]>;
  sourceIds?: ReadonlyMap<string, string[]>;
}

export interface IaPlaceMapStagedSvgResult extends StagedRendererPipelineResult, StagedSvgArtifact {}
export interface IaPlaceMapStagedPngResult extends StagedRendererPipelineResult, StagedPngArtifact {}

function buildPlaceNode(
  place: IaRenderPlace,
  depth: number,
  context: SceneBuildContext
): SceneNode {
  return buildSharedNode({
    title: place.title,
    decoratorMode: context.nodeDecoratorMode,
    nodeType: "Place",
    nodeId: place.id,
    attributes: place.attributes
  }, {
    classes: ["place", depth === 0 ? "root_place" : "nested_place", `depth-${depth}`],
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
      mergedNavigation: !context.occurrencePolicyEnabled && hasForwardNavigation(ownerPlaceId, entry.place.id, context)
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

function createLocalStructureEdge(sourceId: string, edgePlan: PlannedLocalStructureEdge, context: SceneBuildContext): SceneEdge | undefined {
  if (context.occurrencePolicyEnabled && edgePlan.relation === "follower") {
    return undefined;
  }
  const isDirectVertical = edgePlan.localPattern === IA_LOCAL_ROUTE_PATTERNS.directVertical;
  const structuralSourceIds = context.occurrencePolicyEnabled && edgePlan.relation === "contains" && context.containmentFusionRelationship
    ? context.structuralSourceIdsByTriple?.get(JSON.stringify([sourceId, context.containmentFusionRelationship, edgePlan.targetId])) ?? []
    : [];
  const edgeId = context.occurrencePolicyEnabled
    ? `${sourceId}__contains__${edgePlan.targetId}${structuralSourceIds.length ? `__${structuralSourceIds.join("__")}` : ""}`
    : edgePlan.relation === "contains" && !edgePlan.mergedNavigation
      ? `${sourceId}__contains__${edgePlan.targetId}`
      : `${sourceId}__nav__${edgePlan.targetId}`;
  const sourceEdgeIds = context.occurrencePolicyEnabled
    ? structuralSourceIds
    : context.sourceIds?.get(`${sourceId}->${edgePlan.targetId}`) ?? [];

  return {
    id: !context.occurrencePolicyEnabled && sourceEdgeIds.length ? `${edgeId}__${sourceEdgeIds.join("__")}` : edgeId,
    ...(sourceEdgeIds.length ? { viewMetadata: { sourceEdgeIds: [...sourceEdgeIds] } } : {}),
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
  context: SceneBuildContext
): SceneItem {
  return entry.kind === "area"
    ? buildAreaScene(entry.area, scopeId, context)
    : buildPlaceGroup(entry.place, entry.followers, scopeId, depth, context);
}

function buildPlaceGroup(
  place: IaRenderPlace,
  followers: readonly IaRenderPlace[],
  scopeId: string,
  depth: number,
  context: SceneBuildContext
): SceneContainer {
  const ownedScope = planOwnedScope(place, followers, context);
  const explicitChildren = ownedScope.explicitEntries.map((entry) =>
    buildSceneItemFromScopeEntry(entry, `${scopeId}/${place.id}`, depth + 1, context)
  );
  const followerChildren = ownedScope.followers.map((follower) =>
    buildPlaceGroup(follower, [], `${scopeId}/${place.id}__followers`, depth + 1, context)
  );
  const ownedChildren = [...explicitChildren, ...followerChildren];
  for (const edgePlan of ownedScope.edgePlans) {
    const edge = createLocalStructureEdge(place.id, edgePlan, context);
    if (edge) context.edges.push(edge);
  }

  const children: SceneItem[] = [buildPlaceNode(place, depth, context)];
  if (ownedScope.kind) {
    children.push(buildOwnedScopeContainer(place.id, ownedScope.kind, ownedChildren));
  }

  return buildPlaceGroupContainer(place.id, depth, children);
}

function buildAreaScene(
  area: IaRenderArea,
  scopeId: string,
  context: SceneBuildContext
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
    children: buildScopeSceneItems(area.items, `${scopeId}/${area.id}`, 0, context),
    ports: []
  };
}

function buildScopeSceneItems(
  items: readonly IaRenderItem[],
  scopeId: string,
  depth: number,
  context: SceneBuildContext
): SceneItem[] {
  return planScopeEntries(items, context).map((entry) =>
    buildSceneItemFromScopeEntry(entry, scopeId, depth, context)
  );
}

function resolveRoutingScopeContainerIds(root: SceneContainer, projection: Projection, nodeTypes: readonly string[]): string[] {
  const selected = new Set(projection.nodes.filter((node) => nodeTypes.includes(node.type)).map((node) => node.id));
  const ids: string[] = [];
  const visit = (container: SceneContainer): void => {
    if (selected.has(container.id)) ids.push(container.id);
    for (const item of container.children) if (item.kind === "container") visit(item);
  };
  visit(root);
  return ids;
}

export function buildIaPlaceMapRendererScene(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  settings: StagedRenderSettings,
  bundle?: Bundle
): RendererScene {
  const displayPolicy = resolveDetailDisplayPolicy(view, settings.detailId);
  const rendererConfig = view.conventions.renderer_defaults?.ia_place_map;
  const relationshipRuntime = rendererConfig && bundle
    ? resolveIaPlaceMapRelationshipRuntime(bundle, rendererConfig)
    : undefined;
  if (rendererConfig && !bundle) {
    throw new Error("IA occurrence-complete rendering requires the loaded bundle in the staged renderer.");
  }
  if (rendererConfig?.navigation.presentation.parts.some((part) => part.resolve_node_name)) {
    if (!bundle) {
      throw new Error("IA name-resolved relationship labels require the loaded bundle in the staged renderer.");
    }
    const missingReferenceDescriptor = rendererConfig.navigation.presentation.parts.some((part) =>
      part.resolve_node_name && !relationshipRuntime?.annotationReferenceTypes[part.field]
    );
    if (missingReferenceDescriptor) {
      throw new Error(`IA label policy for '${rendererConfig.navigation.relationship}' has no presentation reference descriptor.`);
    }
  }
  const model = buildIaPlaceMapRenderModel(
    projection,
    graph,
    view.projection.hierarchy_edges ?? [],
    displayPolicy,
    rendererConfig,
    settings.detailId,
    relationshipRuntime
  );
  const placeOrderById = new Map<string, number>();
  buildPlaceOrderIndex(model.rootItems, placeOrderById, { next: 0 });

  const structuralSourceIdsByTriple = new Map<string, string[]>();
  if (rendererConfig) {
    for (const edge of model.structuralEdges) {
      if (!edge.source_edge_id) continue;
      const key = JSON.stringify([edge.from, edge.type, edge.to]);
      const ids = structuralSourceIdsByTriple.get(key) ?? [];
      ids.push(edge.source_edge_id);
      structuralSourceIdsByTriple.set(key, ids);
    }
  }

  const context: SceneBuildContext = {
    nodeDecoratorMode: settings.nodeDecoratorMode ?? {
      id: "none",
      showNodeType: false,
      showNodeId: false
    },
    ...(projection.diagram_id ? { sourceIds: new Map(projection.edges.map(edge => {
      const key = `${edge.from}->${edge.to}`;
      return [key, projection.edges.filter(candidate => candidate.from === edge.from && candidate.to === edge.to).map(candidate => candidate.source_edge_id!)];
    })) } : {}),
    navigationTargetsBySourceId: buildNavigationTargetsBySourceId(model.edges),
    placeOrderById,
    edges: [],
    occurrencePolicyEnabled: model.occurrencePolicyEnabled,
    ...(rendererConfig ? {
      containmentFusionRelationship: rendererConfig.navigation.containment_fusion.relationship,
      structuralSourceIdsByTriple
    } : {})
  };
  const rootChildren = buildScopeSceneItems(model.rootItems, "root", 0, context);
  const exactConnectionDiagnostics: RendererDiagnostic[] = model.occurrencePolicyEnabled
    ? []
    : completeExactSceneConnections(context.edges,
      model.edges.map(edge => ({ ...edge, role: "navigation" })));
  const connectorIdByNavigationSourceId = new Map<string, string>();

  if (rendererConfig) {
    const fusedNavigationIds = new Set<string>();
    for (const structuralEdge of context.edges.filter((edge) => edge.role === "contains_place")) {
      const sourceId = structuralEdge.from.itemId;
      const targetId = structuralEdge.to.itemId;
      const containmentOccurrences = model.structuralEdges.filter((edge) =>
        edge.from === sourceId
        && edge.to === targetId
        && edge.type === rendererConfig.navigation.containment_fusion.relationship
      );
      const navigationOccurrences = model.edges.filter((edge) => edge.from === sourceId && edge.to === targetId);
      if (containmentOccurrences.length !== 1 || navigationOccurrences.length !== 1) continue;
      const containmentId = containmentOccurrences[0]?.source_edge_id;
      const navigation = navigationOccurrences[0];
      if (!containmentId || !navigation?.source_edge_id || navigation.annotated) continue;
      structuralEdge.role = "contains_navigation";
      structuralEdge.classes = [...structuralEdge.classes, "merged_navigation"];
      structuralEdge.viewMetadata = { sourceEdgeIds: [containmentId, navigation.source_edge_id] };
      fusedNavigationIds.add(navigation.source_edge_id);
      connectorIdByNavigationSourceId.set(navigation.source_edge_id, structuralEdge.id);
    }

    for (const edge of model.edges) {
      if (!edge.source_edge_id) {
        exactConnectionDiagnostics.push({
          phase: "scene",
          code: "renderer.scene.ia_missing_navigation_occurrence_id",
          severity: "error",
          message: `IA navigation occurrence ${edge.from} ${rendererConfig.navigation.relationship} ${edge.to} has no exact source ID.`
        });
        continue;
      }
      if (fusedNavigationIds.has(edge.source_edge_id)) continue;
      context.edges.push({
        id: edge.id,
        role: "navigation",
        classes: ["ia_navigation", "navigation_occurrence"],
        from: { itemId: edge.from, portId: "east" },
        to: { itemId: edge.to, portId: "west" },
        routing: { style: "orthogonal", preferAxis: "horizontal" },
        ...(edge.label ? { label: { text: edge.label, textStyleRole: "edge_label" } } : {}),
        markers: { end: "arrow" },
        viewMetadata: { sourceEdgeIds: [edge.source_edge_id] }
      });
      connectorIdByNavigationSourceId.set(edge.source_edge_id, edge.id);
    }
  }

  const scene: RendererScene = {
    viewId: "ia_place_map",
    detailId: settings.detailId,
    themeId: settings.themeId ?? "default",
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
    diagnostics: exactConnectionDiagnostics
  };
  if (rendererConfig) {
    scene.root.viewMetadata = {
      ...scene.root.viewMetadata,
      iaPlaceMap: {
        ...(rendererConfig.routing_scope ? { routingScope: {
          containerIds: resolveRoutingScopeContainerIds(scene.root, projection, rendererConfig.routing_scope.container_node_types),
          internalRoutes: rendererConfig.routing_scope.internal_routes,
          crossOwnerRoutes: rendererConfig.routing_scope.cross_owner_routes
        } } : {}),
        expectedNavigationOccurrences: model.edges.flatMap((edge) => edge.source_edge_id ? [{
          id: edge.id,
          sourceEdgeId: edge.source_edge_id,
          connectorId: connectorIdByNavigationSourceId.get(edge.source_edge_id) ?? edge.id,
          from: edge.from,
          to: edge.to,
          ...(edge.label ? { label: edge.label } : {}),
          markers: { ...context.edges.find(candidate => candidate.id === connectorIdByNavigationSourceId.get(edge.source_edge_id!))?.markers },
          sourceOrder: edge.sourceOrder,
          fromAncestryIds: [...edge.fromAncestryIds],
          toAncestryIds: [...edge.toAncestryIds]
        }] : []),
        expectedStructuralEdges: context.edges.flatMap((edge) => {
          if (edge.role !== "contains_place" && edge.role !== "contains_navigation") return [];
          return [{
            id: edge.id,
            sourceEdgeIds: [...(edge.viewMetadata?.sourceEdgeIds ?? [])],
            from: edge.from.itemId,
            to: edge.to.itemId,
            role: edge.role,
            markers: { ...edge.markers }
          }];
        })
      }
    };
  }
  return applyDiagramMetadata(scene, projection);
}

export async function renderIaPlaceMapStagedSvg(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  settings: StagedRenderSettings,
  bundle?: Bundle
): Promise<IaPlaceMapStagedSvgResult> {
  const rendererScene = buildIaPlaceMapRendererScene(projection, graph, view, settings, bundle);
  const pipeline = await runIaPlaceMapRendererPipeline(rendererScene);
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
  settings: StagedRenderSettings,
  bundle?: Bundle
): Promise<IaPlaceMapStagedPngResult> {
  const rendererScene = buildIaPlaceMapRendererScene(projection, graph, view, settings, bundle);
  const pipeline = await runIaPlaceMapRendererPipeline(rendererScene);
  const rendered = await renderPositionedSceneToPng(pipeline.positionedScene);

  return {
    ...pipeline,
    ...rendered
  };
}
