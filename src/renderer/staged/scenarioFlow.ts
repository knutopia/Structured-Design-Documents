import type { ViewSpec } from "../../bundle/types.js";
import type { CompiledGraph } from "../../compiler/types.js";
import type { Projection } from "../../projector/types.js";
import { resolveProfileDisplayPolicy } from "../profileDisplay.js";
import {
  buildScenarioFlowRenderModel,
  type ScenarioFlowRenderNode
} from "../scenarioFlowRenderModel.js";
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
import { buildContentBlocksFromLabelLines } from "./labelLines.js";
import { positionMeasuredSceneBeforeRouting } from "./macroLayout.js";
import { measureScene } from "./pipeline.js";
import {
  buildCardNode,
  buildDiagramRootContainer,
  buildPortSpec
} from "./sceneBuilders.js";
import { decorateScenarioFlowPositionedScene } from "./scenarioFlowDecorations.js";
import {
  buildScenarioFlowMiddleLayer,
  type ScenarioFlowBand,
  type ScenarioFlowCell,
  type ScenarioFlowLaneId,
  type ScenarioFlowMiddleEdge,
  type ScenarioFlowMiddleLayerModel,
  type ScenarioFlowNodePlacement,
  type ScenarioFlowTrack
} from "./scenarioFlowMiddleLayer.js";
import {
  buildScenarioFlowRoutingStages,
  type ScenarioFlowRoutingStages
} from "./scenarioFlowRouting.js";
import { buildChromeStyleClasses, buildEdgeStyleClasses } from "./styleClasses.js";
import {
  renderPositionedSceneToPng,
  renderPositionedSceneToSvg,
  type StagedPngArtifact,
  type StagedSvgArtifact
} from "./svgBackend.js";

const ROOT_GAP = 24;
const ROOT_LEFT_GUTTER = 132;
const CELL_GAP = 10;
const CELL_PADDING = 10;

interface ScenarioFlowRenderContext {
  rendererScene: RendererScene;
  middleLayer: ScenarioFlowMiddleLayerModel;
}

interface SceneBuildContext {
  renderNodesById: ReadonlyMap<string, ScenarioFlowRenderNode>;
  placementByNodeId: ReadonlyMap<string, ScenarioFlowNodePlacement>;
}

interface RootGridCell {
  cell?: ScenarioFlowCell;
  laneId: ScenarioFlowLaneId;
  band: ScenarioFlowBand;
  track?: ScenarioFlowTrack;
  trackOrder: number;
  rowOrder: number;
  columnOrder: number;
}

export interface ScenarioFlowPreRoutingArtifactsResult {
  rendererScene: RendererScene;
  measuredScene: MeasuredScene;
  preRoutingPositionedScene: PositionedScene;
  diagnostics: RendererDiagnostic[];
  preRoutingSvg: string;
  preRoutingPng: Uint8Array;
  middleLayer: ScenarioFlowMiddleLayerModel;
}

export interface ScenarioFlowRoutingDebugArtifactsResult {
  rendererScene: RendererScene;
  measuredScene: MeasuredScene;
  preRoutingPositionedScene: PositionedScene;
  middleLayer: ScenarioFlowMiddleLayerModel;
  routingStages: ScenarioFlowRoutingStages;
  diagnostics: RendererDiagnostic[];
  step2PositionedScene: PositionedScene;
  step2Svg: string;
  step2Png: Uint8Array;
  step3PositionedScene: PositionedScene;
  step3Svg: string;
  step3Png: Uint8Array;
}

export interface ScenarioFlowStagedRenderResult {
  rendererScene: RendererScene;
  measuredScene: MeasuredScene;
  positionedScene: PositionedScene;
  middleLayer: ScenarioFlowMiddleLayerModel;
  routingStages: ScenarioFlowRoutingStages;
  diagnostics: RendererDiagnostic[];
}

export interface ScenarioFlowStagedSvgResult extends ScenarioFlowStagedRenderResult, StagedSvgArtifact {}
export interface ScenarioFlowStagedPngResult extends ScenarioFlowStagedRenderResult, StagedSvgArtifact, StagedPngArtifact {}

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
        preferred: "standard",
        allowed: ["narrow", "standard", "wide"]
      };
    case "Place":
    case "ViewState":
      return {
        preferred: "narrow",
        allowed: ["narrow", "standard", "wide"]
      };
    default:
      return {
        preferred: "standard",
        allowed: ["standard", "wide"]
      };
  }
}

function buildScenarioFlowNodePorts(): SceneNode["ports"] {
  return [
    buildPortSpec("flow_in", "flow_in", "west"),
    buildPortSpec("flow_out", "flow_out", "east"),
    buildPortSpec("mirror_in", "mirror_in", "west"),
    buildPortSpec("mirror_out", "mirror_out", "east"),
    buildPortSpec("realization_in", "realization_in", "north"),
    buildPortSpec("realization_out", "realization_out", "south")
  ];
}

function buildNodeClasses(node: ScenarioFlowRenderNode, placement: ScenarioFlowNodePlacement): string[] {
  return [
    "semantic_node",
    "scenario_flow_node",
    `scenario-flow-lane-${sanitizeToken(placement.laneId)}`,
    `scenario-flow-role-${sanitizeToken(placement.placementRole)}`,
    `shape-${sanitizeToken(node.shape)}`,
    `type-${sanitizeToken(node.type)}`,
    ...buildChromeStyleClasses(node.style)
  ];
}

function buildNodeViewMetadata(placement: ScenarioFlowNodePlacement): ViewMetadata {
  return {
    scenarioFlow: {
      kind: "semantic_node",
      laneId: placement.laneId,
      bandId: placement.bandId,
      trackId: placement.trackId,
      cellId: placement.cellId,
      placementRole: placement.placementRole
    }
  };
}

function buildScenarioFlowNode(
  node: ScenarioFlowRenderNode,
  placement: ScenarioFlowNodePlacement
): SceneNode {
  return {
    ...buildCardNode({
      id: node.id,
      role: node.type.toLowerCase(),
      classes: buildNodeClasses(node, placement),
      widthPolicy: buildNodeWidthPolicy(node.type),
      content: buildContentBlocksFromLabelLines(`${node.id}__content`, node.labelLines),
      ports: buildScenarioFlowNodePorts()
    }),
    viewMetadata: buildNodeViewMetadata(placement)
  };
}

function buildCellClasses(cell: RootGridCell): string[] {
  return [
    "scenario_flow_cell",
    `lane-${sanitizeToken(cell.laneId)}`,
    `band-${sanitizeToken(cell.band.label)}`,
    `band-kind-${sanitizeToken(cell.band.kind)}`,
    `track-${sanitizeToken(String(cell.trackOrder))}`,
    ...(cell.cell ? [] : ["scenario_flow_placeholder_cell"])
  ];
}

function buildCellViewMetadata(cell: RootGridCell): ViewMetadata {
  return {
    scenarioFlow: {
      kind: "cell",
      laneId: cell.laneId,
      bandId: cell.band.id,
      bandLabel: cell.band.label,
      bandKind: cell.band.kind,
      bandOrder: cell.band.bandOrder,
      trackId: cell.track?.id ?? `${cell.band.id}__placeholder_track:${cell.trackOrder}`,
      trackLabel: cell.track?.label ?? `T${cell.trackOrder}`,
      trackOrder: cell.trackOrder,
      rowOrder: cell.rowOrder,
      columnOrder: cell.columnOrder,
      placeholder: cell.cell === undefined ? true : undefined
    }
  };
}

function buildCellContainer(
  gridCell: RootGridCell,
  context: SceneBuildContext
): SceneContainer {
  const cellClasses = buildCellClasses(gridCell);
  const semanticNodes = (gridCell.cell?.nodeIds ?? [])
    .map((nodeId) => context.renderNodesById.get(nodeId))
    .filter((node): node is ScenarioFlowRenderNode => node !== undefined)
    .sort((left, right) => left.authorOrder - right.authorOrder || left.id.localeCompare(right.id))
    .map((node) => {
      const placement = context.placementByNodeId.get(node.id);
      if (!placement) {
        return undefined;
      }
      return buildScenarioFlowNode(node, placement);
    })
    .filter((node): node is SceneNode => node !== undefined);

  return {
    kind: "container",
    id: gridCell.cell?.id ?? `${gridCell.laneId}__placeholder_cell__${gridCell.band.id}__track:${gridCell.trackOrder}`,
    role: "scenario_flow_cell",
    primitive: "stack",
    classes: cellClasses,
    viewMetadata: buildCellViewMetadata(gridCell),
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
    children: semanticNodes,
    ports: [],
    sharedWidthGroup: gridCell.cell?.sharedWidthGroup ?? "scenario_flow:cell:placeholder",
    sharedHeightGroup: gridCell.cell?.sharedHeightGroup ?? `scenario_flow:lane:${gridCell.laneId}`
  };
}

function buildRootGridCells(middleLayer: ScenarioFlowMiddleLayerModel): RootGridCell[] {
  const bands = [...middleLayer.bands]
    .sort((left, right) => left.bandOrder - right.bandOrder || left.id.localeCompare(right.id));
  const laneGuides = [...middleLayer.laneGuides]
    .sort((left, right) => left.order - right.order || left.laneId.localeCompare(right.laneId));
  const trackByBandAndOrder = new Map(middleLayer.tracks.map((track) =>
    [`${track.bandId}::${track.trackOrder}`, track] as const
  ));
  const cellByLaneBandAndTrack = new Map(middleLayer.cells.map((cell) =>
    [`${cell.laneId}::${cell.bandId}::${cell.trackOrder}`, cell] as const
  ));
  const maxTrackOrder = Math.max(0, ...middleLayer.tracks.map((track) => track.trackOrder));
  const cells: RootGridCell[] = [];

  laneGuides.forEach((laneGuide, laneIndex) => {
    for (let trackOrder = 0; trackOrder <= maxTrackOrder; trackOrder += 1) {
      const rowOrder = laneIndex * (maxTrackOrder + 1) + trackOrder;
      bands.forEach((band) => {
        const track = trackByBandAndOrder.get(`${band.id}::${trackOrder}`);
        cells.push({
          cell: cellByLaneBandAndTrack.get(`${laneGuide.laneId}::${band.id}::${trackOrder}`),
          laneId: laneGuide.laneId,
          band,
          track,
          trackOrder,
          rowOrder,
          columnOrder: band.bandOrder
        });
      });
    }
  });

  return cells;
}

function buildRoutingIntent(edge: ScenarioFlowMiddleEdge): RoutingIntent {
  switch (edge.channel) {
    case "step_flow":
      return {
        style: "orthogonal",
        sourcePortRole: "flow_out",
        targetPortRole: "flow_in",
        labelPlacement: edge.label ? "segment" : undefined,
        authority: "flexible"
      };
    case "place_navigation":
    case "view_transition":
      return {
        style: "orthogonal",
        sourcePortRole: "mirror_out",
        targetPortRole: "mirror_in",
        authority: "flexible"
      };
    case "realization":
    default:
      return {
        style: "straight",
        sourcePortRole: "realization_out",
        targetPortRole: "realization_in",
        authority: "flexible"
      };
  }
}

function buildEdgeClasses(edge: ScenarioFlowMiddleEdge): string[] {
  return [
    "scenario_flow_edge",
    "scenario_flow_semantic_edge",
    `edge-type-${sanitizeToken(edge.type)}`,
    `edge-channel-${sanitizeToken(edge.channel)}`,
    ...buildEdgeStyleClasses(edge.type === "REALIZED_BY" ? "dotted" : undefined)
  ];
}

function buildSceneEdge(edge: ScenarioFlowMiddleEdge): SceneEdge {
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

function buildScenarioFlowRenderContext(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  profileId: string,
  themeId = "default"
): ScenarioFlowRenderContext {
  const displayPolicy = resolveProfileDisplayPolicy(view, profileId);
  const model = buildScenarioFlowRenderModel(projection, graph, displayPolicy);
  const middleLayer = buildScenarioFlowMiddleLayer(model);
  const context: SceneBuildContext = {
    renderNodesById: new Map(model.nodes.map((node) => [node.id, node] as const)),
    placementByNodeId: new Map(middleLayer.placements.map((placement) => [placement.nodeId, placement] as const))
  };
  const rootChildren: SceneItem[] = buildRootGridCells(middleLayer)
    .sort((left, right) =>
      left.rowOrder - right.rowOrder
      || left.columnOrder - right.columnOrder
      || left.laneId.localeCompare(right.laneId)
      || left.trackOrder - right.trackOrder
    )
    .map((cell) => buildCellContainer(cell, context));

  const rendererScene: RendererScene = {
    viewId: "scenario_flow",
    profileId,
    themeId,
    root: buildDiagramRootContainer({
      viewId: "scenario_flow",
      layout: {
        strategy: "grid",
        gap: ROOT_GAP,
        columns: Math.max(1, middleLayer.bands.length),
        crossAlignment: "stretch"
      },
      chrome: buildRootChrome(),
      children: rootChildren,
      classes: ["scenario_flow"]
    }),
    edges: middleLayer.edges.map((edge) => buildSceneEdge(edge)),
    diagnostics: middleLayer.diagnostics
  };

  return {
    rendererScene,
    middleLayer
  };
}

async function buildScenarioFlowPreRoutingPipeline(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  profileId: string,
  themeId = "default"
): Promise<{
  context: ScenarioFlowRenderContext;
  rendererScene: RendererScene;
  measuredScene: MeasuredScene;
  basePositionedScene: PositionedScene;
}> {
  const context = buildScenarioFlowRenderContext(projection, graph, view, profileId, themeId);
  const measuredScene = measureScene(context.rendererScene);
  const positionedScene = await positionMeasuredSceneBeforeRouting(measuredScene);
  const basePositionedScene = decorateScenarioFlowPositionedScene(positionedScene, context.middleLayer);

  return {
    context,
    rendererScene: context.rendererScene,
    measuredScene,
    basePositionedScene
  };
}

export function buildScenarioFlowRendererScene(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  profileId: string,
  themeId = "default"
): RendererScene {
  return buildScenarioFlowRenderContext(
    projection,
    graph,
    view,
    profileId,
    themeId
  ).rendererScene;
}

export async function renderScenarioFlowPreRoutingArtifacts(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  profileId: string,
  themeId = "default"
): Promise<ScenarioFlowPreRoutingArtifactsResult> {
  const pipeline = await buildScenarioFlowPreRoutingPipeline(
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
    diagnostics: preRoutingPositionedScene.diagnostics,
    preRoutingSvg: svgRendered.svg,
    preRoutingPng: pngRendered.png,
    middleLayer: pipeline.context.middleLayer
  };
}

async function buildScenarioFlowRoutedPipeline(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  profileId: string,
  themeId = "default"
): Promise<{
  rendererScene: RendererScene;
  measuredScene: MeasuredScene;
  preRoutingPositionedScene: PositionedScene;
  middleLayer: ScenarioFlowMiddleLayerModel;
  routingStages: ScenarioFlowRoutingStages;
}> {
  const pipeline = await buildScenarioFlowPreRoutingPipeline(
    projection,
    graph,
    view,
    profileId,
    themeId
  );
  const routingStages = buildScenarioFlowRoutingStages(
    pipeline.measuredScene,
    pipeline.basePositionedScene,
    pipeline.context.middleLayer
  );

  return {
    rendererScene: pipeline.rendererScene,
    measuredScene: pipeline.measuredScene,
    preRoutingPositionedScene: pipeline.basePositionedScene,
    middleLayer: pipeline.context.middleLayer,
    routingStages
  };
}

export async function renderScenarioFlowRoutingDebugArtifacts(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  profileId: string,
  themeId = "default"
): Promise<ScenarioFlowRoutingDebugArtifactsResult> {
  const pipeline = await buildScenarioFlowRoutedPipeline(
    projection,
    graph,
    view,
    profileId,
    themeId
  );
  const [step2Svg, step2Png, step3Svg, step3Png] = await Promise.all([
    renderPositionedSceneToSvg(pipeline.routingStages.step2PositionedScene),
    renderPositionedSceneToPng(pipeline.routingStages.step2PositionedScene),
    renderPositionedSceneToSvg(pipeline.routingStages.step3PositionedScene),
    renderPositionedSceneToPng(pipeline.routingStages.step3PositionedScene)
  ]);

  return {
    rendererScene: pipeline.rendererScene,
    measuredScene: pipeline.measuredScene,
    preRoutingPositionedScene: pipeline.preRoutingPositionedScene,
    middleLayer: pipeline.middleLayer,
    routingStages: pipeline.routingStages,
    diagnostics: pipeline.routingStages.finalPositionedScene.diagnostics,
    step2PositionedScene: pipeline.routingStages.step2PositionedScene,
    step2Svg: step2Svg.svg,
    step2Png: step2Png.png,
    step3PositionedScene: pipeline.routingStages.step3PositionedScene,
    step3Svg: step3Svg.svg,
    step3Png: step3Png.png
  };
}

export async function renderScenarioFlowStagedSvg(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  profileId: string,
  themeId = "default"
): Promise<ScenarioFlowStagedSvgResult> {
  const pipeline = await buildScenarioFlowRoutedPipeline(
    projection,
    graph,
    view,
    profileId,
    themeId
  );
  const rendered = await renderPositionedSceneToSvg(pipeline.routingStages.finalPositionedScene);

  return {
    rendererScene: pipeline.rendererScene,
    measuredScene: pipeline.measuredScene,
    positionedScene: pipeline.routingStages.finalPositionedScene,
    middleLayer: pipeline.middleLayer,
    routingStages: pipeline.routingStages,
    diagnostics: pipeline.routingStages.finalPositionedScene.diagnostics,
    svg: rendered.svg
  };
}

export async function renderScenarioFlowStagedPng(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  profileId: string,
  themeId = "default"
): Promise<ScenarioFlowStagedPngResult> {
  const renderedSvg = await renderScenarioFlowStagedSvg(
    projection,
    graph,
    view,
    profileId,
    themeId
  );
  const renderedPng = await renderPositionedSceneToPng(renderedSvg.positionedScene);

  return {
    ...renderedSvg,
    png: renderedPng.png
  };
}
