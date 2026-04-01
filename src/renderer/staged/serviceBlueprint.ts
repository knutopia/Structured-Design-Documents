import type { ViewSpec } from "../../bundle/types.js";
import type { CompiledGraph } from "../../compiler/types.js";
import type { Projection } from "../../projector/types.js";
import { resolveProfileDisplayPolicy } from "../profileDisplay.js";
import {
  buildServiceBlueprintRenderModel,
  type ServiceBlueprintRenderNode
} from "../serviceBlueprintRenderModel.js";
import type {
  MeasuredScene,
  PositionedScene,
  RendererScene,
  RoutingIntent,
  SceneContainer,
  SceneEdge,
  SceneItem,
  SceneNode,
  ViewMetadata,
  WidthPolicy
} from "./contracts.js";
import type { RendererDiagnostic } from "./diagnostics.js";
import {
  buildServiceBlueprintMiddleLayer,
  type ServiceBlueprintMiddleCell,
  type ServiceBlueprintMiddleEdge,
  type ServiceBlueprintMiddleLayerModel
} from "./serviceBlueprintMiddleLayer.js";
import { decorateServiceBlueprintPositionedScene } from "./serviceBlueprintDecorations.js";
import { buildServiceBlueprintRoutingStages } from "./serviceBlueprintRouting.js";
import { buildContentBlocksFromLabelLines } from "./labelLines.js";
import {
  measureScene,
  type StagedRendererPipelineResult
} from "./pipeline.js";
import {
  normalizeServiceBlueprintCellContents,
  positionMeasuredSceneBeforeRouting,
  validateServiceBlueprintCellContents
} from "./macroLayout.js";
import { buildCardNode, buildDiagramRootContainer, buildPortSpec } from "./sceneBuilders.js";
import { buildChromeStyleClasses, buildEdgeStyleClasses } from "./styleClasses.js";
import {
  renderPositionedSceneToPng,
  renderPositionedSceneToSvg,
  type StagedPngArtifact,
  type StagedSvgArtifact
} from "./svgBackend.js";

const ROOT_GAP = 24;
const ROOT_LEFT_GUTTER = 132;
const COLUMN_GAP = 24;
const CELL_GAP = 12;
const CELL_PADDING = 12;

interface SceneBuildContext {
  renderNodesById: ReadonlyMap<string, ServiceBlueprintRenderNode>;
}

interface ServiceBlueprintRenderContext {
  rendererScene: RendererScene;
  middleLayer: ServiceBlueprintMiddleLayerModel;
  authorOrderByNodeId: ReadonlyMap<string, number>;
}

export interface ServiceBlueprintStagedSvgResult extends StagedRendererPipelineResult, StagedSvgArtifact {}
export interface ServiceBlueprintStagedPngResult extends StagedRendererPipelineResult, StagedPngArtifact {}
export interface ServiceBlueprintPreRoutingArtifactsResult {
  rendererScene: RendererScene;
  measuredScene: MeasuredScene;
  preRoutingPositionedScene: PositionedScene;
  preRoutingDiagnostics: RendererDiagnostic[];
  preRoutingSvg: string;
  preRoutingPng: Uint8Array;
}
export interface ServiceBlueprintRoutingDebugArtifactsResult {
  rendererScene: RendererScene;
  measuredScene: MeasuredScene;
  step2PositionedScene: PositionedScene;
  step2Diagnostics: RendererDiagnostic[];
  step2Svg: string;
  step2Png: Uint8Array;
  step3PositionedScene: PositionedScene;
  step3Diagnostics: RendererDiagnostic[];
  step3Svg: string;
  step3Png: Uint8Array;
}

function sanitizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unnamed";
}

function buildRootChrome(): SceneContainer["chrome"] {
  return {
    padding: {
      top: 28,
      right: 28,
      bottom: 28,
      left: ROOT_LEFT_GUTTER
    },
    gutter: ROOT_GAP,
    headerBandHeight: 0
  };
}

function buildNodeWidthPolicy(nodeType: string): WidthPolicy {
  switch (nodeType) {
    case "Step":
      return {
        preferred: "narrow",
        allowed: ["narrow", "standard", "wide"]
      };
    case "SystemAction":
    case "DataEntity":
      return {
        preferred: "standard",
        allowed: ["narrow", "standard", "wide"]
      };
    default:
      return {
        preferred: "standard",
        allowed: ["standard", "wide"]
      };
  }
}

function buildServiceBlueprintNodePorts(): SceneNode["ports"] {
  return [
    buildPortSpec("flow_in", "flow_in", "west"),
    buildPortSpec("flow_out", "flow_out", "east"),
    buildPortSpec("support_in", "support_in", "north"),
    buildPortSpec("support_out", "support_out", "south"),
    buildPortSpec("resource_in", "resource_in", "north", {
      offset: 36
    }),
    buildPortSpec("resource_out", "resource_out", "south", {
      offset: 36
    })
  ];
}

function buildNodeClasses(node: ServiceBlueprintRenderNode, extraClasses: string[] = []): string[] {
  return [
    "semantic_node",
    "service_blueprint_node",
    `shape-${sanitizeToken(node.shape)}`,
    `type-${sanitizeToken(node.type)}`,
    ...extraClasses,
    ...buildChromeStyleClasses(node.style)
  ];
}

function buildBlueprintNode(
  node: ServiceBlueprintRenderNode,
  cell: ServiceBlueprintMiddleCell,
  extraClasses: string[] = []
): SceneNode {
  return {
    ...buildCardNode({
      id: node.id,
      role: node.type.toLowerCase(),
      classes: buildNodeClasses(node, extraClasses),
      widthPolicy: buildNodeWidthPolicy(node.type),
      content: buildContentBlocksFromLabelLines(`${node.id}__content`, node.labelLines),
      ports: buildServiceBlueprintNodePorts()
    }),
    viewMetadata: {
      serviceBlueprint: {
        kind: "semantic_node",
        cellId: cell.id
      }
    }
  };
}

function buildCellViewMetadata(cell: ServiceBlueprintMiddleCell): ViewMetadata {
  return {
    serviceBlueprint: {
      kind: "cell",
      laneId: cell.laneId,
      laneShellId: cell.laneShellId,
      bandId: cell.bandId,
      bandLabel: cell.bandLabel,
      bandKind: cell.bandKind,
      rowOrder: cell.rowOrder,
      columnOrder: cell.columnOrder
    }
  };
}

function buildLaneClassToken(laneId: string): string {
  return sanitizeToken(laneId.replace(/^lane:\d+:/, ""));
}

function buildBandToken(bandLabel: string): string {
  return sanitizeToken(bandLabel);
}

function buildCellClasses(cell: Pick<ServiceBlueprintMiddleCell, "laneId" | "bandLabel" | "bandKind" | "columnOrder">): string[] {
  return [
    "service_blueprint_cell",
    `lane-${buildLaneClassToken(cell.laneId)}`,
    `band-${buildBandToken(cell.bandLabel)}`,
    `column-${sanitizeToken(String(cell.columnOrder + 1))}`,
    `cell-kind-${sanitizeToken(cell.bandKind)}`
  ];
}

function buildCellContainer(
  cell: ServiceBlueprintMiddleCell,
  context: SceneBuildContext
): SceneContainer {
  const cellClasses = buildCellClasses(cell);
  const semanticNodes = cell.nodeIds
    .map((nodeId) => context.renderNodesById.get(nodeId))
    .filter((node): node is ServiceBlueprintRenderNode => node !== undefined)
    .sort((left, right) => left.authorOrder - right.authorOrder || left.id.localeCompare(right.id))
    .map((node) => buildBlueprintNode(node, cell, cellClasses));
  const children: SceneItem[] = [...semanticNodes];

  return {
    kind: "container",
    id: cell.id,
    role: "service_blueprint_cell",
    primitive: "cluster",
    classes: cellClasses,
    viewMetadata: buildCellViewMetadata(cell),
    layout: {
      strategy: "stack",
      direction: "vertical",
      gap: CELL_GAP
    },
    chrome: {
      padding: {
        top: CELL_PADDING,
        right: CELL_PADDING,
        bottom: CELL_PADDING,
        left: CELL_PADDING
      },
      gutter: CELL_GAP,
      headerBandHeight: 0
    },
    children,
    ports: [],
    sharedWidthGroup: cell.sharedWidthGroup,
    sharedHeightGroup: cell.sharedHeightGroup
  };
}

function buildRoutingIntent(edge: ServiceBlueprintMiddleEdge): RoutingIntent {
  switch (edge.channel) {
    case "flow":
      return {
        style: "straight",
        sourcePortRole: "flow_out",
        targetPortRole: "flow_in",
        authority: "flexible"
      };
    case "support":
      return {
        style: "straight",
        sourcePortRole: "support_out",
        targetPortRole: "support_in",
        labelPlacement: edge.label ? "segment" : undefined,
        authority: "flexible"
      };
    case "resource_policy":
      return {
        style: "straight",
        sourcePortRole: "resource_out",
        targetPortRole: "resource_in",
        labelPlacement: edge.label ? "segment" : undefined,
        authority: "flexible"
      };
  }
}

function buildEdgeClasses(edge: ServiceBlueprintMiddleEdge): string[] {
  return [
    "service_blueprint_edge",
    "service_blueprint_semantic_edge",
    `edge-type-${sanitizeToken(edge.type)}`,
    `edge-channel-${sanitizeToken(edge.channel)}`,
    ...buildEdgeStyleClasses(edge.style)
  ];
}

function buildSceneEdge(edge: ServiceBlueprintMiddleEdge): SceneEdge {
  return {
    id: edge.id,
    role: edge.type.toLowerCase(),
    classes: buildEdgeClasses(edge),
    from: {
      itemId: edge.from
    },
    to: {
      itemId: edge.to
    },
    routing: buildRoutingIntent(edge),
    label: !edge.label
      ? undefined
      : {
        text: edge.label,
        textStyleRole: "edge_label"
      },
    markers: {
      end: "arrow"
    },
    ownerContainerId: "root"
  };
}

function applyServiceBlueprintPostLayoutStep(
  root: PositionedScene["root"],
  diagnostics: RendererDiagnostic[]
): void {
  normalizeServiceBlueprintCellContents(root);
  validateServiceBlueprintCellContents(root, diagnostics);
}

async function buildServiceBlueprintPreRoutingPipeline(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  profileId: string,
  themeId = "default"
): Promise<{
  context: ServiceBlueprintRenderContext;
  rendererScene: RendererScene;
  measuredScene: MeasuredScene;
  basePositionedScene: PositionedScene;
}> {
  const context = buildServiceBlueprintRenderContext(projection, graph, view, profileId, themeId);
  const measuredScene = measureScene(context.rendererScene);
  const positionedScene = await positionMeasuredSceneBeforeRouting(measuredScene);
  applyServiceBlueprintPostLayoutStep(positionedScene.root, positionedScene.diagnostics);
  const basePositionedScene = decorateServiceBlueprintPositionedScene(positionedScene, context.middleLayer);

  return {
    context,
    rendererScene: context.rendererScene,
    measuredScene,
    basePositionedScene
  };
}

function buildServiceBlueprintRenderContext(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  profileId: string,
  themeId = "default"
): ServiceBlueprintRenderContext {
  const displayPolicy = resolveProfileDisplayPolicy(view, profileId);
  const model = buildServiceBlueprintRenderModel(projection, graph, displayPolicy);
  const middleLayer = buildServiceBlueprintMiddleLayer(model);
  const context: SceneBuildContext = {
    renderNodesById: new Map(model.nodes.map((node) => [node.id, node]))
  };
  const rootChildren: SceneItem[] = [...middleLayer.cells]
    .sort((left, right) =>
      left.rowOrder - right.rowOrder
      || left.columnOrder - right.columnOrder
      || left.id.localeCompare(right.id)
    )
    .map((cell) => buildCellContainer(cell, context));
  const columnCount = [...middleLayer.bands, ...middleLayer.parkingBands].length;
  const rendererScene: RendererScene = {
    viewId: "service_blueprint",
    profileId,
    themeId,
    root: buildDiagramRootContainer({
      viewId: "service_blueprint",
      layout: {
        strategy: "grid",
        gap: COLUMN_GAP,
        columns: columnCount,
        crossAlignment: "stretch"
      },
      chrome: buildRootChrome(),
      children: rootChildren,
      classes: ["service_blueprint"]
    }),
    edges: middleLayer.edges.map((edge) => buildSceneEdge(edge)),
    diagnostics: middleLayer.diagnostics
  };

  return {
    rendererScene,
    middleLayer,
    authorOrderByNodeId: new Map(model.nodes.map((node) => [node.id, node.authorOrder]))
  };
}

export function buildServiceBlueprintRendererScene(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  profileId: string,
  themeId = "default"
): RendererScene {
  return buildServiceBlueprintRenderContext(
    projection,
    graph,
    view,
    profileId,
    themeId
  ).rendererScene;
}

export async function renderServiceBlueprintPreRoutingArtifacts(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  profileId: string,
  themeId = "default"
): Promise<ServiceBlueprintPreRoutingArtifactsResult> {
  const pipeline = await buildServiceBlueprintPreRoutingPipeline(
    projection,
    graph,
    view,
    profileId,
    themeId
  );
  const preRoutingPositionedScene = {
    ...pipeline.basePositionedScene,
    edges: []
  };
  const [svgRendered, pngRendered] = await Promise.all([
    renderPositionedSceneToSvg(preRoutingPositionedScene),
    renderPositionedSceneToPng(preRoutingPositionedScene)
  ]);

  return {
    rendererScene: pipeline.rendererScene,
    measuredScene: pipeline.measuredScene,
    preRoutingPositionedScene,
    preRoutingDiagnostics: preRoutingPositionedScene.diagnostics,
    preRoutingSvg: svgRendered.svg,
    preRoutingPng: pngRendered.png
  };
}

export async function renderServiceBlueprintRoutingDebugArtifacts(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  profileId: string,
  themeId = "default"
): Promise<ServiceBlueprintRoutingDebugArtifactsResult> {
  const pipeline = await buildServiceBlueprintPreRoutingPipeline(
    projection,
    graph,
    view,
    profileId,
    themeId
  );
  const routedStages = buildServiceBlueprintRoutingStages(
    pipeline.basePositionedScene,
    pipeline.context.rendererScene,
    pipeline.context.middleLayer,
    pipeline.context.authorOrderByNodeId
  );
  const step2PositionedScene = routedStages.step2.positionedScene;
  const step3PositionedScene = routedStages.step3.positionedScene;
  const [step2SvgRendered, step2PngRendered, step3SvgRendered, step3PngRendered] = await Promise.all([
    renderPositionedSceneToSvg(step2PositionedScene),
    renderPositionedSceneToPng(step2PositionedScene),
    renderPositionedSceneToSvg(step3PositionedScene),
    renderPositionedSceneToPng(step3PositionedScene)
  ]);

  return {
    rendererScene: pipeline.rendererScene,
    measuredScene: pipeline.measuredScene,
    step2PositionedScene,
    step2Diagnostics: step2PositionedScene.diagnostics,
    step2Svg: step2SvgRendered.svg,
    step2Png: step2PngRendered.png,
    step3PositionedScene,
    step3Diagnostics: step3PositionedScene.diagnostics,
    step3Svg: step3SvgRendered.svg,
    step3Png: step3PngRendered.png
  };
}

export async function renderServiceBlueprintStagedSvg(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  profileId: string,
  themeId = "default"
): Promise<ServiceBlueprintStagedSvgResult> {
  const pipeline = await buildServiceBlueprintPreRoutingPipeline(
    projection,
    graph,
    view,
    profileId,
    themeId
  );
  const routedStages = buildServiceBlueprintRoutingStages(
    pipeline.basePositionedScene,
    pipeline.context.rendererScene,
    pipeline.context.middleLayer,
    pipeline.context.authorOrderByNodeId
  );
  const positionedScene = routedStages.final.positionedScene;
  const rendered = await renderPositionedSceneToSvg(positionedScene);

  return {
    rendererScene: pipeline.rendererScene,
    measuredScene: pipeline.measuredScene,
    positionedScene,
    ...rendered
  };
}

export async function renderServiceBlueprintStagedPng(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  profileId: string,
  themeId = "default"
): Promise<ServiceBlueprintStagedPngResult> {
  const pipeline = await buildServiceBlueprintPreRoutingPipeline(
    projection,
    graph,
    view,
    profileId,
    themeId
  );
  const routedStages = buildServiceBlueprintRoutingStages(
    pipeline.basePositionedScene,
    pipeline.context.rendererScene,
    pipeline.context.middleLayer,
    pipeline.context.authorOrderByNodeId
  );
  const positionedScene = routedStages.final.positionedScene;
  const rendered = await renderPositionedSceneToPng(positionedScene);

  return {
    rendererScene: pipeline.rendererScene,
    measuredScene: pipeline.measuredScene,
    positionedScene,
    ...rendered
  };
}
