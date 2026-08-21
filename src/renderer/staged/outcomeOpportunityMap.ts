import type { ViewSpec } from "../../bundle/types.js";
import type { CompiledGraph } from "../../compiler/types.js";
import type { Projection } from "../../projector/types.js";
import {
  buildOutcomeOpportunityMapRenderModel,
  type OutcomeOpportunityRenderNode
} from "../outcomeOpportunityMapRenderModel.js";
import { resolveDetailDisplayPolicy } from "../detailDisplay.js";
import type {
  ContentBlock,
  MeasuredScene,
  PositionedScene,
  RendererScene,
  RoutingIntent,
  SceneContainer,
  SceneEdge,
  SceneItem,
  SceneNode,
  ViewMetadata,
  WidthPolicy,
  TransitionalStagedRenderSettings
} from "./contracts.js";
import type { RendererDiagnostic } from "./diagnostics.js";
import { buildContentBlocksFromLabelLines } from "./labelLines.js";
import {
  buildOutcomeOpportunityMapMiddleLayer,
  type OutcomeOpportunityCell,
  type OutcomeOpportunityColumn,
  type OutcomeOpportunityMiddleEdge,
  type OutcomeOpportunityMiddleLayerModel,
  type OutcomeOpportunityNodePlacement
} from "./outcomeOpportunityMapMiddleLayer.js";
import { decorateOutcomeOpportunityPositionedScene } from "./outcomeOpportunityMapDecorations.js";
import {
  buildOutcomeOpportunityMapRoutingStages,
  type OutcomeOpportunityRoutingStages
} from "./outcomeOpportunityMapRouting.js";
import { positionMeasuredSceneBeforeRouting } from "./macroLayout.js";
import { measureScene } from "./pipeline.js";
import {
  buildCardNode,
  buildDiagramRootContainer,
  buildPortSpec
} from "./sceneBuilders.js";
import {
  renderPositionedSceneToPng,
  renderPositionedSceneToSvg,
  type StagedPngArtifact,
  type StagedSvgArtifact
} from "./svgBackend.js";

const ROOT_GAP = 28;
const ROOT_TOP_GUTTER = 56;
const CELL_GAP = 10;
const CELL_PADDING = 10;

interface OutcomeOpportunityRenderContext {
  rendererScene: RendererScene;
  middleLayer: OutcomeOpportunityMiddleLayerModel;
}

interface SceneBuildContext {
  renderNodesById: ReadonlyMap<string, OutcomeOpportunityRenderNode>;
  placementByNodeId: ReadonlyMap<string, OutcomeOpportunityNodePlacement>;
  columnById: ReadonlyMap<string, OutcomeOpportunityColumn>;
}

export interface OutcomeOpportunityMapPreRoutingArtifactsResult {
  rendererScene: RendererScene;
  measuredScene: MeasuredScene;
  preRoutingPositionedScene: PositionedScene;
  middleLayer: OutcomeOpportunityMiddleLayerModel;
  diagnostics: RendererDiagnostic[];
  preRoutingSvg: string;
  preRoutingPng: Uint8Array;
}

export interface OutcomeOpportunityMapRoutingDebugArtifactsResult {
  rendererScene: RendererScene;
  measuredScene: MeasuredScene;
  preRoutingPositionedScene: PositionedScene;
  middleLayer: OutcomeOpportunityMiddleLayerModel;
  routingStages: OutcomeOpportunityRoutingStages;
  diagnostics: RendererDiagnostic[];
  step2PositionedScene: PositionedScene;
  step2Svg: string;
  step2Png: Uint8Array;
  step3PositionedScene: PositionedScene;
  step3Svg: string;
  step3Png: Uint8Array;
  finalPositionedScene: PositionedScene;
}

export interface OutcomeOpportunityMapStagedRenderResult {
  rendererScene: RendererScene;
  measuredScene: MeasuredScene;
  positionedScene: PositionedScene;
  middleLayer: OutcomeOpportunityMiddleLayerModel;
  routingStages: OutcomeOpportunityRoutingStages;
  diagnostics: RendererDiagnostic[];
}

export interface OutcomeOpportunityMapStagedSvgResult extends OutcomeOpportunityMapStagedRenderResult, StagedSvgArtifact {}
export interface OutcomeOpportunityMapStagedPngResult extends OutcomeOpportunityMapStagedRenderResult, StagedSvgArtifact, StagedPngArtifact {}

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
      top: ROOT_TOP_GUTTER,
      right: 28,
      bottom: 28,
      left: 28
    },
    gutter: ROOT_GAP,
    headerBandHeight: 0
  };
}

function buildNodeWidthPolicy(nodeType: string): WidthPolicy {
  switch (nodeType) {
    case "Initiative":
    case "Metric":
      return {
        preferred: "standard",
        allowed: ["narrow", "standard", "wide"]
      };
    case "Opportunity":
    case "Outcome":
    default:
      return {
        preferred: "standard",
        allowed: ["standard", "wide"]
      };
  }
}

function buildOutcomeOpportunityNodePorts(): SceneNode["ports"] {
  return [
    buildPortSpec("intent_in", "intent_in", "west"),
    buildPortSpec("intent_out", "intent_out", "east"),
    buildPortSpec("measure_in", "measure_in", "west"),
    buildPortSpec("measure_out", "measure_out", "east"),
    buildPortSpec("secondary_in", "secondary_in", "north"),
    buildPortSpec("secondary_out", "secondary_out", "south")
  ];
}

function buildNodeClasses(
  node: OutcomeOpportunityRenderNode,
  placement: OutcomeOpportunityNodePlacement
): string[] {
  return [
    "semantic_node",
    "outcome_opportunity_node",
    `type-${sanitizeToken(node.type)}`,
    `visual-role-${sanitizeToken(node.visualRole)}`,
    `shape-${sanitizeToken(node.shape)}`,
    `column-${sanitizeToken(placement.semanticColumnId)}`,
    `placement-role-${sanitizeToken(placement.placementRole)}`,
    `band-${sanitizeToken(placement.semanticBandId)}`,
    ...(placement.parking ? ["parking-node"] : [])
  ];
}

function buildNodeContent(node: OutcomeOpportunityRenderNode): ContentBlock[] {
  return buildContentBlocksFromLabelLines(`${node.id}__content`, node.labelLines, {
    titleTextStyleRole: node.type === "Outcome" ? "title" : "label",
    defaultTextStyleRole: "metadata"
  });
}

function buildNodeViewMetadata(placement: OutcomeOpportunityNodePlacement): ViewMetadata {
  return {
    outcomeOpportunity: {
      kind: "semantic_node",
      placementRole: placement.placementRole,
      semanticColumnId: placement.semanticColumnId,
      semanticBandId: placement.semanticBandId,
      physicalSlotId: placement.physicalSlotId,
      cellId: placement.cellId,
      anchorOutcomeId: placement.anchorOutcomeId,
      parking: placement.parking
    }
  };
}

function buildOutcomeOpportunityNode(
  node: OutcomeOpportunityRenderNode,
  placement: OutcomeOpportunityNodePlacement
): SceneNode {
  return {
    ...buildCardNode({
      id: node.id,
      role: node.type.toLowerCase(),
      classes: buildNodeClasses(node, placement),
      widthPolicy: buildNodeWidthPolicy(node.type),
      content: buildNodeContent(node),
      ports: buildOutcomeOpportunityNodePorts(),
      overflowPolicy: node.type === "Metric"
        ? {
          kind: "secondary_area",
          maxLines: 1
        }
        : {
          kind: "escalate_width_band",
          maxLines: 3
        }
    }),
    viewMetadata: buildNodeViewMetadata(placement)
  };
}

function buildCellViewMetadata(
  cell: OutcomeOpportunityCell,
  column: OutcomeOpportunityColumn
): ViewMetadata {
  return {
    outcomeOpportunity: {
      kind: "cell",
      columnId: cell.columnId,
      columnLabel: column.label,
      bandId: cell.bandId,
      bandLabel: cell.bandKind === "outcome" ? `Band ${cell.bandOrder + 1}` : `Parking ${cell.bandOrder + 1}`,
      bandKind: cell.bandKind,
      bandOrder: cell.bandOrder,
      physicalSlotId: cell.physicalSlotId,
      rowOrder: cell.rowOrder,
      columnOrder: cell.columnOrder,
      slotOrderWithinBand: cell.slotOrderWithinBand,
      slotKind: cell.slotKind,
      anchorOutcomeId: cell.anchorOutcomeId,
      parking: cell.bandKind === "parking"
    }
  };
}

function buildCellClasses(cell: OutcomeOpportunityCell): string[] {
  return [
    "outcome_opportunity_cell",
    `column-${sanitizeToken(cell.columnId)}`,
    `band-kind-${sanitizeToken(cell.bandKind)}`,
    `band-${sanitizeToken(cell.bandId)}`,
    `slot-kind-${sanitizeToken(cell.slotKind)}`,
    `row-${sanitizeToken(String(cell.rowOrder))}`,
    ...(cell.nodeIds.length === 0 ? ["empty-cell"] : []),
    ...(cell.bandKind === "parking" ? ["parking-cell"] : [])
  ];
}

function buildCellContainer(
  cell: OutcomeOpportunityCell,
  context: SceneBuildContext
): SceneContainer {
  const column = context.columnById.get(cell.columnId);
  if (!column) {
    throw new Error(`Could not resolve outcome-opportunity column "${cell.columnId}".`);
  }

  const semanticNodes = cell.nodeIds
    .map((nodeId) => context.renderNodesById.get(nodeId))
    .filter((node): node is OutcomeOpportunityRenderNode => node !== undefined)
    .sort((left, right) => left.authorOrder - right.authorOrder || left.id.localeCompare(right.id))
    .map((node) => {
      const placement = context.placementByNodeId.get(node.id);
      if (!placement) {
        return undefined;
      }
      return buildOutcomeOpportunityNode(node, placement);
    })
    .filter((node): node is SceneNode => node !== undefined);

  return {
    kind: "container",
    id: cell.id,
    role: "outcome_opportunity_cell",
    primitive: "stack",
    classes: buildCellClasses(cell),
    viewMetadata: buildCellViewMetadata(cell, column),
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
    sharedWidthGroup: cell.sharedWidthGroup,
    sharedHeightGroup: cell.sharedHeightGroup
  };
}

function buildRoutingIntent(edge: OutcomeOpportunityMiddleEdge): RoutingIntent {
  switch (edge.channel) {
    case "initiative_addressing":
    case "opportunity_support":
      return {
        style: "orthogonal",
        sourcePortRole: "intent_out",
        targetPortRole: "intent_in",
        labelPlacement: edge.label ? "segment" : undefined,
        authority: "flexible"
      };
    case "outcome_measurement":
      return {
        style: "orthogonal",
        sourcePortRole: "measure_out",
        targetPortRole: "measure_in",
        labelPlacement: edge.label ? "segment" : undefined,
        authority: "flexible"
      };
    case "implementation_reference":
    case "instrumentation_reference":
    default:
      return {
        style: "orthogonal",
        sourcePortRole: "secondary_out",
        targetPortRole: "secondary_in",
        labelPlacement: edge.label ? "segment" : undefined,
        authority: "flexible"
      };
  }
}

function buildEdgeClasses(edge: OutcomeOpportunityMiddleEdge): string[] {
  return [
    "outcome_opportunity_edge",
    "outcome_opportunity_semantic_edge",
    `edge-type-${sanitizeToken(edge.type)}`,
    `edge-channel-${sanitizeToken(edge.channel)}`
  ];
}

function buildSceneEdge(edge: OutcomeOpportunityMiddleEdge): SceneEdge {
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

function buildOutcomeOpportunityRenderContext(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  settings: TransitionalStagedRenderSettings
): OutcomeOpportunityRenderContext {
  const displayPolicy = resolveDetailDisplayPolicy(view, settings.detailId);
  const model = buildOutcomeOpportunityMapRenderModel(projection, graph, view, displayPolicy);
  const middleLayer = buildOutcomeOpportunityMapMiddleLayer(model);
  const context: SceneBuildContext = {
    renderNodesById: new Map(model.nodes.map((node) => [node.id, node] as const)),
    placementByNodeId: new Map(middleLayer.placements.map((placement) => [placement.nodeId, placement] as const)),
    columnById: new Map(middleLayer.columns.map((column) => [column.id, column] as const))
  };
  const rootChildren: SceneItem[] = [...middleLayer.cells]
    .sort((left, right) =>
      left.rowOrder - right.rowOrder
      || left.columnOrder - right.columnOrder
      || left.id.localeCompare(right.id)
    )
    .map((cell) => buildCellContainer(cell, context));

  const rendererScene: RendererScene = {
    viewId: "outcome_opportunity_map",
    profileId: settings.profileId,
    themeId: settings.themeId ?? "default",
    root: buildDiagramRootContainer({
      viewId: "outcome_opportunity_map",
      layout: {
        strategy: "grid",
        gap: ROOT_GAP,
        columns: Math.max(1, middleLayer.columns.length),
        crossAlignment: "stretch"
      },
      chrome: buildRootChrome(),
      children: rootChildren,
      classes: ["outcome_opportunity_map"]
    }),
    edges: middleLayer.edges.map((edge) => buildSceneEdge(edge)),
    diagnostics: middleLayer.diagnostics
  };

  return {
    rendererScene,
    middleLayer
  };
}

export function buildOutcomeOpportunityMapRendererScene(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  settings: TransitionalStagedRenderSettings
): RendererScene {
  return buildOutcomeOpportunityRenderContext(
    projection,
    graph,
    view,
    settings
  ).rendererScene;
}

async function buildOutcomeOpportunityPreRoutingPipeline(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  settings: TransitionalStagedRenderSettings
): Promise<{
  context: OutcomeOpportunityRenderContext;
  rendererScene: RendererScene;
  measuredScene: MeasuredScene;
  basePositionedScene: PositionedScene;
}> {
  const context = buildOutcomeOpportunityRenderContext(projection, graph, view, settings);
  const measuredScene = measureScene(context.rendererScene);
  const basePositionedScene = decorateOutcomeOpportunityPositionedScene(
    await positionMeasuredSceneBeforeRouting(measuredScene)
  );

  return {
    context,
    rendererScene: context.rendererScene,
    measuredScene,
    basePositionedScene
  };
}

export async function renderOutcomeOpportunityMapPreRoutingArtifacts(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  settings: TransitionalStagedRenderSettings
): Promise<OutcomeOpportunityMapPreRoutingArtifactsResult> {
  const pipeline = await buildOutcomeOpportunityPreRoutingPipeline(
    projection,
    graph,
    view,
    settings
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
    middleLayer: pipeline.context.middleLayer,
    diagnostics: preRoutingPositionedScene.diagnostics,
    preRoutingSvg: svgRendered.svg,
    preRoutingPng: pngRendered.png
  };
}

export async function renderOutcomeOpportunityMapRoutingDebugArtifacts(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  settings: TransitionalStagedRenderSettings
): Promise<OutcomeOpportunityMapRoutingDebugArtifactsResult> {
  const pipeline = await buildOutcomeOpportunityPreRoutingPipeline(
    projection,
    graph,
    view,
    settings
  );
  const preRoutingPositionedScene = {
    ...pipeline.basePositionedScene,
    edges: []
  };
  const routingStages = buildOutcomeOpportunityMapRoutingStages(
    pipeline.measuredScene,
    pipeline.basePositionedScene,
    pipeline.context.middleLayer
  );
  const [step2Svg, step2Png, step3Svg, step3Png] = await Promise.all([
    renderPositionedSceneToSvg(routingStages.step2PositionedScene),
    renderPositionedSceneToPng(routingStages.step2PositionedScene),
    renderPositionedSceneToSvg(routingStages.step3PositionedScene),
    renderPositionedSceneToPng(routingStages.step3PositionedScene)
  ]);

  return {
    rendererScene: pipeline.rendererScene,
    measuredScene: pipeline.measuredScene,
    preRoutingPositionedScene,
    middleLayer: pipeline.context.middleLayer,
    routingStages,
    diagnostics: routingStages.diagnostics,
    step2PositionedScene: routingStages.step2PositionedScene,
    step2Svg: step2Svg.svg,
    step2Png: step2Png.png,
    step3PositionedScene: routingStages.step3PositionedScene,
    step3Svg: step3Svg.svg,
    step3Png: step3Png.png,
    finalPositionedScene: routingStages.finalPositionedScene
  };
}

async function renderOutcomeOpportunityMapStaged(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  settings: TransitionalStagedRenderSettings
): Promise<OutcomeOpportunityMapStagedRenderResult> {
  const pipeline = await buildOutcomeOpportunityPreRoutingPipeline(
    projection,
    graph,
    view,
    settings
  );
  const routingStages = buildOutcomeOpportunityMapRoutingStages(
    pipeline.measuredScene,
    pipeline.basePositionedScene,
    pipeline.context.middleLayer
  );

  return {
    rendererScene: pipeline.rendererScene,
    measuredScene: pipeline.measuredScene,
    positionedScene: routingStages.finalPositionedScene,
    middleLayer: pipeline.context.middleLayer,
    routingStages,
    diagnostics: routingStages.finalPositionedScene.diagnostics
  };
}

export async function renderOutcomeOpportunityMapStagedSvg(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  settings: TransitionalStagedRenderSettings
): Promise<OutcomeOpportunityMapStagedSvgResult> {
  const rendered = await renderOutcomeOpportunityMapStaged(projection, graph, view, settings);
  const svgRendered = await renderPositionedSceneToSvg(rendered.positionedScene);

  return {
    ...rendered,
    ...svgRendered
  };
}

export async function renderOutcomeOpportunityMapStagedPng(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  settings: TransitionalStagedRenderSettings
): Promise<OutcomeOpportunityMapStagedPngResult> {
  const renderedSvg = await renderOutcomeOpportunityMapStagedSvg(projection, graph, view, settings);
  const pngRendered = await renderPositionedSceneToPng(renderedSvg.positionedScene);

  return {
    ...renderedSvg,
    ...pngRendered
  };
}
