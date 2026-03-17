import type { ViewSpec } from "../../bundle/types.js";
import type { CompiledGraph } from "../../compiler/types.js";
import type { Projection, ProjectionNodeAnnotation } from "../../projector/types.js";
import { resolvePlaceLabelDisplayOptions } from "../placeLabelLines.js";
import { resolveProfileDisplayPolicy } from "../profileDisplay.js";
import { buildIaPlaceMapRenderModel, type IaRenderArea, type IaRenderItem, type IaRenderPlace } from "../iaPlaceMapRenderModel.js";
import type {
  ContentBlock,
  RendererScene,
  SceneContainer,
  SceneEdge,
  SceneItem,
  SceneNode
} from "./contracts.js";
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
const PLACE_BRANCH_GAP = 16;
const DESCENDANT_GAP = 12;
const DESCENDANT_INDENT = 40;
const CHAIN_PORT_OFFSET = 24;

interface PlaceRoutingContext {
  chainId: string;
  chainOrder: number;
}

interface SceneBuildContext {
  projectionNodesById: ReadonlyMap<string, Projection["nodes"][number]>;
  annotationsByNodeId: ReadonlyMap<string, ProjectionNodeAnnotation>;
  placeRoutingById: Map<string, PlaceRoutingContext>;
  nextChainOrder: number;
}

export interface IaPlaceMapStagedSvgResult extends StagedRendererPipelineResult, StagedSvgArtifact {}
export interface IaPlaceMapStagedPngResult extends StagedRendererPipelineResult, StagedPngArtifact {}

function createRootSceneItemId(scopeId: string, placeId: string): string {
  return `chain-${scopeId}-${placeId}`;
}

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
  chainId: string,
  displayOptions: ReturnType<typeof resolvePlaceLabelDisplayOptions>
): SceneNode {
  context.placeRoutingById.set(place.id, {
    chainId,
    chainOrder: context.nextChainOrder
  });
  context.nextChainOrder += 1;

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

function buildDescendantsContainer(
  place: IaRenderPlace,
  descendants: SceneItem[]
): SceneContainer {
  return {
    kind: "container",
    id: `${place.id}__descendants`,
    role: "place_descendants",
    primitive: "stack",
    classes: ["place_descendants"],
    layout: {
      strategy: "stack",
      direction: "vertical",
      gap: DESCENDANT_GAP,
      crossAlignment: "start"
    },
    chrome: {
      padding: {
        top: 0,
        right: 0,
        bottom: 0,
        left: DESCENDANT_INDENT
      },
      gutter: DESCENDANT_GAP,
      headerBandHeight: 0
    },
    children: descendants,
    ports: []
  };
}

function buildPlaceBranch(
  place: IaRenderPlace,
  descendants: SceneItem[],
  depth: number,
  context: SceneBuildContext,
  chainId: string,
  displayOptions: ReturnType<typeof resolvePlaceLabelDisplayOptions>
): SceneContainer {
  const children: SceneItem[] = [buildPlaceNode(place, depth, context, chainId, displayOptions)];
  if (descendants.length > 0) {
    children.push(buildDescendantsContainer(place, descendants));
  }

  return {
    kind: "container",
    id: `${place.id}__branch`,
    role: "place_branch",
    primitive: "stack",
    classes: ["place_branch", depth === 0 ? "branch_root" : "branch_nested", `depth-${depth}`],
    layout: {
      strategy: "stack",
      direction: "vertical",
      gap: PLACE_BRANCH_GAP,
      crossAlignment: "start"
    },
    chrome: {
      padding: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
      },
      gutter: PLACE_BRANCH_GAP,
      headerBandHeight: 0
    },
    children,
    ports: []
  };
}

function buildPlaceBranchFromSequence(
  items: IaRenderItem[],
  startIndex: number,
  scopeId: string,
  depth: number,
  context: SceneBuildContext,
  displayOptions: ReturnType<typeof resolvePlaceLabelDisplayOptions>,
  chainId?: string
): { item: SceneContainer; nextIndex: number } {
  const current = items[startIndex];
  if (!current || current.kind !== "place") {
    throw new Error(`Expected a place item at index ${startIndex}.`);
  }

  const resolvedChainId = chainId ?? createRootSceneItemId(scopeId, current.id);
  const explicitDescendants = buildSceneItemsFromSequence(
    current.items,
    `${scopeId}/${current.id}`,
    depth + 1,
    context,
    displayOptions,
    resolvedChainId
  );

  let nextIndex = startIndex + 1;
  const descendants = [...explicitDescendants];
  if (nextIndex < items.length && items[nextIndex]?.kind === "place") {
    const implicitDescendant = buildPlaceBranchFromSequence(
      items,
      nextIndex,
      scopeId,
      depth + 1,
      context,
      displayOptions,
      resolvedChainId
    );
    descendants.push(implicitDescendant.item);
    nextIndex = implicitDescendant.nextIndex;
  }

  return {
    item: buildPlaceBranch(current, descendants, depth, context, resolvedChainId, displayOptions),
    nextIndex
  };
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
    children: buildSceneItemsFromSequence(area.items, `${scopeId}/${area.id}`, 0, context, displayOptions),
    ports: []
  };
}

function buildSceneItemsFromSequence(
  items: IaRenderItem[],
  scopeId: string,
  depth: number,
  context: SceneBuildContext,
  displayOptions: ReturnType<typeof resolvePlaceLabelDisplayOptions>,
  chainId?: string
): SceneItem[] {
  const built: SceneItem[] = [];
  let index = 0;

  while (index < items.length) {
    const item = items[index];
    if (!item) {
      break;
    }

    if (item.kind === "area") {
      built.push(buildAreaScene(item, scopeId, context, displayOptions));
      index += 1;
      continue;
    }

    const branch = buildPlaceBranchFromSequence(items, index, scopeId, depth, context, displayOptions, chainId);
    built.push(branch.item);
    index = branch.nextIndex;
  }

  return built;
}

function buildNavigationEdges(
  modelEdges: ReturnType<typeof buildIaPlaceMapRenderModel>["edges"],
  placeRoutingById: ReadonlyMap<string, PlaceRoutingContext>
): SceneEdge[] {
  return modelEdges.map((edge) => {
    const sourceRouting = placeRoutingById.get(edge.from);
    const targetRouting = placeRoutingById.get(edge.to);
    const sameChain = sourceRouting?.chainId && targetRouting?.chainId && sourceRouting.chainId === targetRouting.chainId;
    const isDownwardSameChain = sameChain
      && sourceRouting !== undefined
      && targetRouting !== undefined
      && sourceRouting.chainOrder > targetRouting.chainOrder;

    return {
      id: `${edge.from}__nav__${edge.to}`,
      role: "navigation",
      classes: [sameChain ? "within_chain" : "cross_chain"],
      from: {
        itemId: edge.from,
        portId: sameChain ? (isDownwardSameChain ? "south_chain" : "north_chain") : "east"
      },
      to: {
        itemId: edge.to,
        portId: sameChain ? (isDownwardSameChain ? "north_chain" : "south_chain") : "west"
      },
      routing: {
        style: "orthogonal",
        preferAxis: sameChain ? "vertical" : "horizontal",
        bendPlacement: sameChain ? "target_bias" : undefined
      },
      markers: {
        end: "arrow"
      }
    };
  });
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
  const context: SceneBuildContext = {
    projectionNodesById: new Map(projection.nodes.map((node) => [node.id, node])),
    annotationsByNodeId: new Map(projection.derived.node_annotations.map((annotation) => [annotation.node_id, annotation])),
    placeRoutingById: new Map(),
    nextChainOrder: 0
  };
  const rootChildren = buildSceneItemsFromSequence(model.rootItems, "root", 0, context, displayOptions);

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
    edges: buildNavigationEdges(model.edges, context.placeRoutingById),
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
