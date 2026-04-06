import type { ViewSpec } from "../../bundle/types.js";
import type { CompiledGraph } from "../../compiler/types.js";
import type { Projection } from "../../projector/types.js";
import { resolveProfileDisplayPolicy } from "../profileDisplay.js";
import {
  buildUiContractsRenderData,
  type UiContractsComponentItem,
  type UiContractsLeafNodeItem,
  type UiContractsRenderEdge,
  type UiContractsRenderModel,
  type UiContractsRenderNode,
  type UiContractsRootItem,
  type UiContractsStateGroupItem,
  type UiContractsSupportingGroupItem,
  type UiContractsViewStateItem
} from "../uiContractsRenderModel.js";
import type {
  ContentBlock,
  RendererScene,
  SceneContainer,
  SceneEdge,
  SceneItem,
  SceneNode,
  PortSpec,
  WidthPolicy
} from "./contracts.js";
import { createSceneDiagnostic, type RendererDiagnostic } from "./diagnostics.js";
import { buildContentBlocksFromLabelLines } from "./labelLines.js";
import { runStagedRendererPipeline, type StagedRendererPipelineResult } from "./pipeline.js";
import {
  buildCardNode,
  buildContainerContractPorts,
  buildContractTargetPorts,
  buildDiagramRootContainer,
  buildTransitionPorts
} from "./sceneBuilders.js";
import { buildChromeStyleClasses, buildEdgeStyleClasses } from "./styleClasses.js";
import {
  renderPositionedSceneToPng,
  renderPositionedSceneToSvg,
  type StagedPngArtifact,
  type StagedSvgArtifact
} from "./svgBackend.js";

const ROOT_GAP = 28;
const SCOPE_GAP = 16;
const SUPPORT_GAP = 12;
const TRANSITION_GRAPH_GAP = 24;
const CONTRACT_GUTTER_WIDTH = 128;

type UiContractsSceneSource =
  | UiContractsRootItem
  | UiContractsViewStateItem
  | UiContractsComponentItem
  | UiContractsStateGroupItem
  | UiContractsSupportingGroupItem
  | UiContractsLeafNodeItem;

interface UiContractsSemanticEdge {
  type: string;
  from: string;
  to: string;
}

interface SceneBuildContext {
  diagnostics: RendererDiagnostic[];
  projectionNodesById: ReadonlyMap<string, Projection["nodes"][number]>;
  renderNodesById: ReadonlyMap<string, UiContractsRenderNode>;
  endpointSceneIdByModelId: Map<string, string>;
  containerSceneIdBySemanticNodeId: Map<string, string>;
  sceneItemKindById: Map<string, SceneItem["kind"]>;
  renderedLeafNodeIds: Set<string>;
}

export interface UiContractsStagedSvgResult extends StagedRendererPipelineResult, StagedSvgArtifact {}
export interface UiContractsStagedPngResult extends StagedRendererPipelineResult, StagedPngArtifact {}

function buildRootChrome(): SceneContainer["chrome"] {
  return {
    padding: {
      top: 24,
      right: 24,
      bottom: 24,
      left: 24
    },
    gutter: ROOT_GAP,
    headerBandHeight: 0
  };
}

function buildScopeChrome(): SceneContainer["chrome"] {
  return {
    padding: {
      top: 12,
      right: 12,
      bottom: 12,
      left: 12
    },
    gutter: SCOPE_GAP
  };
}

function buildRenderableNodeWidthPolicy(
  projectionNodeType: string | undefined
): WidthPolicy {
  switch (projectionNodeType) {
    case "Event":
      return {
        preferred: "chip",
        allowed: ["chip", "narrow", "standard"]
      };
    case "DataEntity":
    case "SystemAction":
      return {
        preferred: "standard",
        allowed: ["narrow", "standard", "wide"]
      };
    default:
      return {
        preferred: "narrow",
        allowed: ["narrow", "standard", "wide"]
      };
  }
}

function buildLeafNodeContent(node: UiContractsRenderNode): ContentBlock[] {
  return buildContentBlocksFromLabelLines(`${node.id}__content`, node.labelLines);
}

function buildLeafNodeClasses(node: UiContractsRenderNode): string[] {
  return [
    "semantic_node",
    `shape-${node.shape.toLowerCase()}`,
    ...buildChromeStyleClasses(node.style)
  ];
}

function registerSceneItemKind(
  itemId: string,
  kind: SceneItem["kind"],
  context: SceneBuildContext
): void {
  context.sceneItemKindById.set(itemId, kind);
}

function buildLeafNodePorts(
  nodeId: string,
  projectionNodeType: string | undefined
): PortSpec[] {
  switch (projectionNodeType) {
    case "State":
    case "ViewState":
      return buildTransitionPorts(nodeId);
    case "Event":
    case "DataEntity":
    case "SystemAction":
      return buildContractTargetPorts(nodeId);
    default:
      return [];
  }
}

function buildRenderableLeafNode(
  nodeId: string,
  context: SceneBuildContext
): SceneNode {
  const renderNode = context.renderNodesById.get(nodeId);
  const projectionNode = context.projectionNodesById.get(nodeId);

  if (!renderNode) {
    context.diagnostics.push(
      createSceneDiagnostic(
        "renderer.scene.ui_contracts_missing_render_node",
        `Could not resolve render-node metadata for "${nodeId}". Falling back to a generic node label.`,
        { targetId: nodeId }
      )
    );
  }

  context.renderedLeafNodeIds.add(nodeId);

  const node = buildCardNode({
    id: nodeId,
    role: projectionNode?.type?.toLowerCase() ?? "node",
    classes: renderNode ? buildLeafNodeClasses(renderNode) : ["semantic_node", "fallback_node"],
    widthPolicy: buildRenderableNodeWidthPolicy(projectionNode?.type),
    content: renderNode
      ? buildLeafNodeContent(renderNode)
      : buildContentBlocksFromLabelLines(`${nodeId}__content`, [projectionNode?.name ?? nodeId]),
    ports: buildLeafNodePorts(nodeId, projectionNode?.type)
  });

  registerSceneItemKind(node.id, node.kind, context);
  return node;
}

function createScopeContainer(
  id: string,
  role: string,
  classes: string[],
  headerLines: readonly string[],
  children: SceneItem[],
  layout: SceneContainer["layout"],
  ports: SceneContainer["ports"] = []
): SceneContainer {
  return {
    kind: "container",
    id,
    role,
    primitive: "cluster",
    classes,
    layout,
    chrome: buildScopeChrome(),
    headerContent: buildContentBlocksFromLabelLines(`${id}__header`, headerLines),
    children,
    ports
  };
}

function buildContractGutterContent(
  scopeSceneId: string,
  children: SceneItem[]
): SceneContainer {
  return {
    kind: "container",
    id: `${scopeSceneId}__content`,
    role: "contract_gutter",
    primitive: "stack",
    classes: ["contract_gutter"],
    layout: {
      strategy: "stack",
      direction: "vertical",
      gap: SCOPE_GAP,
      crossAlignment: "stretch"
    },
    chrome: {
      padding: {
        top: 0,
        right: 0,
        bottom: 0,
        left: CONTRACT_GUTTER_WIDTH
      },
      gutter: SCOPE_GAP,
      headerBandHeight: 0
    },
    children,
    ports: []
  };
}

function wrapScopedChildrenForContractGutter(
  scopeSceneId: string,
  children: SceneItem[],
  hasLocalSupportChildren: boolean
): SceneItem[] {
  return hasLocalSupportChildren ? [buildContractGutterContent(scopeSceneId, children)] : children;
}

function normalizeViewStateHeaderLines(
  headerLines: readonly string[] | undefined,
  fallbackId: string
): string[] {
  if (!headerLines || headerLines.length === 0) {
    return [fallbackId];
  }

  const [firstLine, ...rest] = headerLines;
  return [firstLine.replace(/^ViewState:\s*/, ""), ...rest];
}

function registerContainerEndpoint(
  semanticNodeId: string | undefined,
  endpointId: string | undefined,
  sceneId: string,
  context: SceneBuildContext
): void {
  if (semanticNodeId) {
    context.containerSceneIdBySemanticNodeId.set(semanticNodeId, sceneId);
  }
  if (endpointId) {
    context.endpointSceneIdByModelId.set(endpointId, sceneId);
  }
}

function buildViewStateGraphContainer(
  scopeSceneId: string,
  items: UiContractsViewStateItem[],
  context: SceneBuildContext
): SceneContainer {
  const id = `view_state_graph:${scopeSceneId}`;
  const container = createScopeContainer(
    id,
    "view_state_graph",
    ["synthetic", "transition_graph", "view_state_graph"],
    ["ViewState Graph"],
    items.map((item) => buildViewStateScene(item, context)),
    {
      strategy: "elk_layered",
      direction: "horizontal",
      gap: TRANSITION_GRAPH_GAP,
      crossAlignment: "start"
    }
  );

  registerSceneItemKind(container.id, container.kind, context);
  return container;
}

function buildStateGroupScene(
  item: UiContractsStateGroupItem,
  context: SceneBuildContext
): SceneContainer {
  registerContainerEndpoint(undefined, item.endpointId, item.id, context);

  const container = createScopeContainer(
    item.id,
    "state_graph",
    ["synthetic", "transition_graph", "state_graph", ...buildChromeStyleClasses(item.style)],
    item.labelLines,
    item.nodeIds.map((nodeId) => buildRenderableLeafNode(nodeId, context)),
    {
      strategy: "elk_layered",
      direction: "horizontal",
      gap: TRANSITION_GRAPH_GAP,
      crossAlignment: "start"
    }
  );

  registerSceneItemKind(container.id, container.kind, context);
  return container;
}

function buildSupportGroupScene(
  item: UiContractsSupportingGroupItem,
  context: SceneBuildContext
): SceneContainer {
  registerContainerEndpoint(undefined, item.endpointId, item.id, context);

  const container = createScopeContainer(
    item.id,
    "support_group",
    ["synthetic", "support_group", ...buildChromeStyleClasses(item.style)],
    item.labelLines,
    item.nodeIds.map((nodeId) => buildRenderableLeafNode(nodeId, context)),
    {
      strategy: "stack",
      direction: "vertical",
      gap: SUPPORT_GAP,
      crossAlignment: "stretch"
    }
  );

  registerSceneItemKind(container.id, container.kind, context);
  return container;
}

function buildViewStateScene(
  item: UiContractsViewStateItem,
  context: SceneBuildContext
): SceneItem {
  if (item.childItems.length === 0) {
    return buildRenderableLeafNode(item.nodeId, context);
  }

  registerContainerEndpoint(item.nodeId, item.endpointId, item.id, context);
  const hasLocalSupportChildren = item.childItems.some((child) => child.kind === "node");
  const children = wrapScopedChildrenForContractGutter(
    item.id,
    buildScopedSceneItems(item.childItems, item.id, context),
    hasLocalSupportChildren
  );

  const container = createScopeContainer(
    item.id,
    "view_state",
    ["view_state", "scope", ...buildChromeStyleClasses(item.style)],
    normalizeViewStateHeaderLines(item.labelLines, item.nodeId),
    children,
    {
      strategy: "stack",
      direction: "vertical",
      gap: SCOPE_GAP,
      crossAlignment: "stretch"
    },
    [
      ...buildTransitionPorts(item.id),
      ...buildContainerContractPorts(item.id)
    ]
  );

  registerSceneItemKind(container.id, container.kind, context);
  return container;
}

function buildComponentScene(
  item: UiContractsComponentItem,
  context: SceneBuildContext
): SceneItem {
  if (item.childItems.length === 0) {
    return buildRenderableLeafNode(item.nodeId, context);
  }

  registerContainerEndpoint(item.nodeId, item.endpointId, item.id, context);
  const hasLocalSupportChildren = item.childItems.some((child) => child.kind === "node");
  const children = wrapScopedChildrenForContractGutter(
    item.id,
    buildScopedSceneItems(item.childItems, item.id, context),
    hasLocalSupportChildren
  );

  const container = createScopeContainer(
    item.id,
    "component",
    ["component", "scope", ...buildChromeStyleClasses(item.style)],
    item.labelLines ?? [item.nodeId],
    children,
    {
      strategy: "stack",
      direction: "vertical",
      gap: SCOPE_GAP,
      crossAlignment: "stretch"
    },
    buildContainerContractPorts(item.id)
  );

  registerSceneItemKind(container.id, container.kind, context);
  return container;
}

function isTransitionGraphContainer(item: SceneItem): item is SceneContainer {
  return item.kind === "container" && (item.role === "view_state_graph" || item.role === "state_graph");
}

function resolvePlaceLayout(children: SceneItem[]): SceneContainer["layout"] {
  const hasTransitionGraph = children.some(isTransitionGraphContainer);
  const hasNonTransitionSibling = children.some((child) => !isTransitionGraphContainer(child));

  if (hasTransitionGraph && hasNonTransitionSibling) {
    return {
      strategy: "grid",
      columns: 2,
      gap: SCOPE_GAP,
      crossAlignment: "stretch"
    };
  }

  return {
    strategy: "stack",
    direction: "vertical",
    gap: SCOPE_GAP,
    crossAlignment: "stretch"
  };
}

function buildPlaceScene(
  item: Extract<UiContractsRootItem, { kind: "place" }>,
  context: SceneBuildContext
): SceneContainer {
  registerContainerEndpoint(item.id, item.endpointId, item.id, context);
  const children = buildScopedSceneItems(item.childItems, item.id, context);

  const container = createScopeContainer(
    item.id,
    "place",
    ["place", "scope"],
    item.labelLines,
    children,
    resolvePlaceLayout(children),
    buildContainerContractPorts(item.id)
  );

  registerSceneItemKind(container.id, container.kind, context);
  return container;
}

function buildSceneItem(
  item: UiContractsSceneSource,
  context: SceneBuildContext
): SceneItem {
  switch (item.kind) {
    case "place":
      return buildPlaceScene(item, context);
    case "view_state":
      return buildViewStateScene(item, context);
    case "component":
      return buildComponentScene(item, context);
    case "state_group":
      return buildStateGroupScene(item, context);
    case "support_group":
      return buildSupportGroupScene(item, context);
    case "node":
      return buildRenderableLeafNode(item.nodeId, context);
  }
}

function buildScopedSceneItems(
  items: readonly UiContractsSceneSource[],
  scopeSceneId: string,
  context: SceneBuildContext
): SceneItem[] {
  const sceneItems: SceneItem[] = [];
  const viewStateItems = items.filter(
    (item): item is UiContractsViewStateItem => item.kind === "view_state"
  );
  let viewStateGraphInserted = false;

  for (const item of items) {
    if (item.kind === "view_state") {
      if (!viewStateGraphInserted) {
        sceneItems.push(buildViewStateGraphContainer(scopeSceneId, viewStateItems, context));
        viewStateGraphInserted = true;
      }
      continue;
    }

    sceneItems.push(buildSceneItem(item, context));
  }

  return sceneItems;
}

function resolveModelEndpointToSceneItemId(
  itemId: string,
  context: SceneBuildContext
): string {
  const mapped = context.endpointSceneIdByModelId.get(itemId);
  if (mapped) {
    return mapped;
  }

  if (itemId.endsWith("__anchor")) {
    return itemId.slice(0, -"__anchor".length);
  }

  return itemId;
}

function isRenderedSemanticEndpoint(nodeId: string, context: SceneBuildContext): boolean {
  return context.renderedLeafNodeIds.has(nodeId) || context.containerSceneIdBySemanticNodeId.has(nodeId);
}

function resolveSemanticEndpointToSceneItemId(
  nodeId: string,
  context: SceneBuildContext
): string {
  return context.containerSceneIdBySemanticNodeId.get(nodeId) ?? nodeId;
}

function buildSemanticRenderableEdges(
  projection: Projection,
  context: SceneBuildContext
): UiContractsSemanticEdge[] {
  return projection.edges
    .filter(
      (edge) =>
        edge.type !== "COMPOSED_OF" &&
        edge.type !== "CONTAINS" &&
        isRenderedSemanticEndpoint(edge.from, context) &&
        isRenderedSemanticEndpoint(edge.to, context)
    )
    .map((edge) => ({
      type: edge.type,
      from: resolveSemanticEndpointToSceneItemId(edge.from, context),
      to: resolveSemanticEndpointToSceneItemId(edge.to, context)
    }));
}

function buildRoutingIntent(
  role: string,
  fromKind: SceneItem["kind"] | undefined,
  toKind: SceneItem["kind"] | undefined,
  useSourceContractLane: boolean
): SceneEdge["routing"] {
  if (role === "transitions_to") {
    return {
      style: "orthogonal",
      preferAxis: "horizontal",
      avoidNodeBoxes: true,
      sourcePortRole: "transition_out",
      targetPortRole: "transition_in"
    };
  }

  if (role === "emits" || role === "depends_on" || role === "binds_to") {
    const sourceIsContainer = fromKind === "container";
    return {
      style: "orthogonal",
      preferAxis: "horizontal",
      bendPlacement: "target_bias",
      labelPlacement: sourceIsContainer && useSourceContractLane ? "source_contract_lane" : "segment",
      sourcePortRole: sourceIsContainer ? "contract_out" : undefined,
      targetPortRole: toKind === "node" ? "contract_in" : undefined
    };
  }

  return {
    style: "orthogonal",
    preferAxis: "horizontal"
  };
}

function buildSceneEdges(
  projection: Projection,
  model: UiContractsRenderModel,
  context: SceneBuildContext
): SceneEdge[] {
  const semanticEdges = buildSemanticRenderableEdges(projection, context);

  if (semanticEdges.length !== model.edges.length) {
    context.diagnostics.push(
      createSceneDiagnostic(
        "renderer.scene.ui_contracts_edge_alignment",
        `Expected ${semanticEdges.length} semantic ui_contracts edge(s), but the render model produced ${model.edges.length}. Falling back to generic edge roles.`
      )
    );
  }

  return model.edges.map((edge, index) => buildSceneEdge(edge, semanticEdges[index], context));
}

function buildSceneEdge(
  edge: UiContractsRenderEdge,
  semanticEdge: UiContractsSemanticEdge | undefined,
  context: SceneBuildContext
): SceneEdge {
  const from = resolveModelEndpointToSceneItemId(edge.from, context);
  const to = resolveModelEndpointToSceneItemId(edge.to, context);
  const role = semanticEdge?.type?.toLowerCase() ?? "relationship";
  const fromKind = context.sceneItemKindById.get(from);
  const toKind = context.sceneItemKindById.get(to);
  const edgeClasses = [
    ...buildEdgeStyleClasses(edge.style),
    edge.constraint === true ? "constraint_edge" : "free_edge"
  ];

  if (semanticEdge && (semanticEdge.from !== from || semanticEdge.to !== to)) {
    context.diagnostics.push(
      createSceneDiagnostic(
        "renderer.scene.ui_contracts_endpoint_alignment",
        `The staged ui_contracts scene resolved "${edge.from}" -> "${from}" and "${edge.to}" -> "${to}", which differs from the semantic edge mapping "${semanticEdge.from}" -> "${semanticEdge.to}".`,
        { targetId: semanticEdge.type }
      )
    );
  }

  return {
    id: `${role}:${from}->${to}`,
    role,
    classes: edgeClasses,
    from: {
      itemId: from
    },
    to: {
      itemId: to
    },
    routing: buildRoutingIntent(role, fromKind, toKind, edge.constraint === true),
    label: edge.label
      ? {
          text: edge.label,
          textStyleRole: "edge_label"
        }
      : undefined,
    markers: {
      end: "arrow"
    }
  };
}

export function buildUiContractsRendererScene(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  profileId: string,
  themeId = "default"
): RendererScene {
  const prepared = buildUiContractsRenderData(
    projection,
    graph,
    resolveProfileDisplayPolicy(view, profileId)
  );
  const context: SceneBuildContext = {
    diagnostics: [],
    projectionNodesById: new Map(prepared.projection.nodes.map((node) => [node.id, node])),
    renderNodesById: new Map(prepared.model.nodes.map((node) => [node.id, node])),
    endpointSceneIdByModelId: new Map(),
    containerSceneIdBySemanticNodeId: new Map(),
    sceneItemKindById: new Map(),
    renderedLeafNodeIds: new Set()
  };
  const rootChildren = buildScopedSceneItems(prepared.model.rootItems, "root", context);

  return {
    viewId: "ui_contracts",
    profileId,
    themeId,
    root: buildDiagramRootContainer({
      viewId: "ui_contracts",
      layout: {
        strategy: "stack",
        direction: "vertical",
        gap: ROOT_GAP,
        crossAlignment: "stretch"
      },
      chrome: buildRootChrome(),
      children: rootChildren
    }),
    edges: buildSceneEdges(prepared.projection, prepared.model, context),
    diagnostics: [...context.diagnostics]
  };
}

export async function renderUiContractsStagedSvg(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  profileId: string,
  themeId = "default"
): Promise<UiContractsStagedSvgResult> {
  const rendererScene = buildUiContractsRendererScene(projection, graph, view, profileId, themeId);
  const pipeline = await runStagedRendererPipeline(rendererScene);
  const rendered = await renderPositionedSceneToSvg(pipeline.positionedScene);

  return {
    ...pipeline,
    ...rendered
  };
}

export async function renderUiContractsStagedPng(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  profileId: string,
  themeId = "default"
): Promise<UiContractsStagedPngResult> {
  const rendererScene = buildUiContractsRendererScene(projection, graph, view, profileId, themeId);
  const pipeline = await runStagedRendererPipeline(rendererScene);
  const rendered = await renderPositionedSceneToPng(pipeline.positionedScene);

  return {
    ...pipeline,
    ...rendered
  };
}
