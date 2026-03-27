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
  PositionedDecoration,
  PositionedItem,
  PositionedScene,
  RendererScene,
  RoutingIntent,
  SceneContainer,
  SceneEdge,
  SceneItem,
  SceneNode,
  WidthPolicy
} from "./contracts.js";
import type { RendererDiagnostic } from "./diagnostics.js";
import {
  buildServiceBlueprintMiddleLayer,
  type ServiceBlueprintMiddleCell,
  type ServiceBlueprintMiddleEdge
} from "./serviceBlueprintMiddleLayer.js";
import { buildContentBlocksFromLabelLines } from "./labelLines.js";
import {
  measureScene,
  positionSceneBeforeRouting,
  runStagedRendererPipeline,
  type StagedRendererPipelineResult
} from "./pipeline.js";
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

function buildBlueprintNode(node: ServiceBlueprintRenderNode, extraClasses: string[] = []): SceneNode {
  return buildCardNode({
    id: node.id,
    role: node.type.toLowerCase(),
    classes: buildNodeClasses(node, extraClasses),
    widthPolicy: buildNodeWidthPolicy(node.type),
    content: buildContentBlocksFromLabelLines(`${node.id}__content`, node.labelLines),
    ports: buildServiceBlueprintNodePorts()
  });
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
    .map((node) => buildBlueprintNode(node, cellClasses));
  const children: SceneItem[] = [...semanticNodes];

  return {
    kind: "container",
    id: cell.id,
    role: "service_blueprint_cell",
    primitive: "cluster",
    classes: cellClasses,
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
    case "helper":
      return {
        style: "straight",
        authority: "flexible"
      };
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
    edge.hidden ? "service_blueprint_helper" : "service_blueprint_semantic_edge",
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
    label: edge.hidden || !edge.label
      ? undefined
      : {
        text: edge.label,
        textStyleRole: "edge_label"
      },
    markers: edge.hidden
      ? undefined
      : {
        end: "arrow"
      },
    ownerContainerId: "root"
  };
}

function collectPositionedItemsByClass(
  children: PositionedItem[],
  className: string
): Array<Extract<PositionedItem, { kind: "container" }>> {
  const matches: Array<Extract<PositionedItem, { kind: "container" }>> = [];

  for (const child of children) {
    if (child.kind !== "container") {
      continue;
    }
    if (child.classes.includes(className)) {
      matches.push(child);
    }
    matches.push(...collectPositionedItemsByClass(child.children, className));
  }

  return matches;
}

function attachServiceBlueprintDecorations(scene: PositionedScene): PositionedScene {
  const decorations: PositionedDecoration[] = [];
  const labelX = 24;
  const lineStartX = 24;
  const lineEndX = Math.max(lineStartX, scene.root.width - 28);
  const laneOrder = [
    "lane-customer",
    "lane-frontstage",
    "lane-backstage",
    "lane-support",
    "lane-system",
    "lane-policy",
    "lane-ungrouped"
  ];
  const boundaryTargets = new Map<string, string>([
    ["lane-customer", "line_of_interaction"],
    ["lane-frontstage", "line_of_visibility"],
    ["lane-backstage", "line_of_internal_interaction"]
  ]);
  const rowEnvelopes = laneOrder.flatMap((laneClass) => {
    const laneCells = collectPositionedItemsByClass(scene.root.children, laneClass)
      .filter((item) => item.classes.includes("service_blueprint_cell"));
    if (laneCells.length === 0) {
      return [];
    }

    return [{
      laneClass,
      minY: Math.min(...laneCells.map((cell) => cell.y)),
      maxY: Math.max(...laneCells.map((cell) => cell.y + cell.height))
    }];
  });

  rowEnvelopes.forEach((lane) => {
    decorations.push({
      kind: "text",
      id: `${lane.laneClass}__title`,
      classes: ["service_blueprint_lane_title", lane.laneClass],
      paintGroup: "labels",
      x: labelX,
      y: lane.minY + Math.max(10, (lane.maxY - lane.minY) / 2 - 10),
      text: lane.laneClass.replace(/^lane-/, ""),
      textStyleRole: "label"
    });

    const boundaryRole = boundaryTargets.get(lane.laneClass);
    if (boundaryRole) {
      decorations.push({
        kind: "line",
        id: `${lane.laneClass}__separator`,
        classes: ["service_blueprint_separator", boundaryRole, lane.laneClass],
        paintGroup: "chrome",
        from: {
          x: lineStartX,
          y: lane.maxY
        },
        to: {
          x: lineEndX,
          y: lane.maxY
        }
      });
    }
  });

  return {
    ...scene,
    decorations
  };
}

async function buildServiceBlueprintPreRoutingPipeline(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  profileId: string,
  themeId = "default"
): Promise<{
  rendererScene: RendererScene;
  measuredScene: MeasuredScene;
  preRoutingPositionedScene: PositionedScene;
}> {
  const rendererScene = buildServiceBlueprintRendererScene(projection, graph, view, profileId, themeId);
  const measuredScene = measureScene(rendererScene);
  const preRoutingPositionedScene = attachServiceBlueprintDecorations(
    await positionSceneBeforeRouting(measuredScene)
  );

  return {
    rendererScene,
    measuredScene,
    preRoutingPositionedScene: {
      ...preRoutingPositionedScene,
      edges: []
    }
  };
}

export function buildServiceBlueprintRendererScene(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  profileId: string,
  themeId = "default"
): RendererScene {
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

  return {
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
  const [svgRendered, pngRendered] = await Promise.all([
    renderPositionedSceneToSvg(pipeline.preRoutingPositionedScene),
    renderPositionedSceneToPng(pipeline.preRoutingPositionedScene)
  ]);

  return {
    ...pipeline,
    preRoutingDiagnostics: pipeline.preRoutingPositionedScene.diagnostics,
    preRoutingSvg: svgRendered.svg,
    preRoutingPng: pngRendered.png
  };
}

export async function renderServiceBlueprintStagedSvg(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  profileId: string,
  themeId = "default"
): Promise<ServiceBlueprintStagedSvgResult> {
  const rendererScene = buildServiceBlueprintRendererScene(projection, graph, view, profileId, themeId);
  const pipeline = await runStagedRendererPipeline(rendererScene);
  const positionedScene = attachServiceBlueprintDecorations(pipeline.positionedScene);
  const rendered = await renderPositionedSceneToSvg(positionedScene);

  return {
    ...pipeline,
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
  const rendererScene = buildServiceBlueprintRendererScene(projection, graph, view, profileId, themeId);
  const pipeline = await runStagedRendererPipeline(rendererScene);
  const positionedScene = attachServiceBlueprintDecorations(pipeline.positionedScene);
  const rendered = await renderPositionedSceneToPng(positionedScene);

  return {
    ...pipeline,
    positionedScene,
    ...rendered
  };
}
