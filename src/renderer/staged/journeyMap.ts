import type { Bundle, RendererJourneyMapLayoutConfig, ViewSpec } from "../../bundle/types.js";
import type { CompiledGraph } from "../../compiler/types.js";
import type { Projection } from "../../projector/types.js";
import {
  buildJourneyMapRenderModel,
  type JourneyMapRenderModel,
  type JourneyRenderEdge,
  type JourneyRenderStage,
  type JourneyRenderStep
} from "../journeyMapRenderModel.js";
import { resolveDetailDisplayPolicy } from "../detailDisplay.js";
import type {
  JourneyMapItemMetadata,
  MeasuredScene,
  NodeDecoratorMode,
  PositionedScene,
  RendererScene,
  SceneContainer,
  SceneEdge,
  SceneItem,
  SceneNode,
  StagedRenderSettings
} from "./contracts.js";
import {
  createSceneDiagnostic,
  sortRendererDiagnostics,
  type RendererDiagnostic
} from "./diagnostics.js";
import {
  buildJourneyScenePlacement,
  type JourneyScenePlacement
} from "./journeyMapMiddleLayer.js";
import { positionMeasuredSceneBeforeRouting } from "./macroLayout.js";
import {
  buildJourneyMapRoutingStages,
  type JourneyMapRoutingStages
} from "./journeyMapRouting.js";
import { measureScene } from "./pipeline.js";
import { buildDiagramRootContainer, buildPortSpec, buildSharedNode } from "./sceneBuilders.js";
import {
  renderPositionedSceneToPng,
  renderPositionedSceneToSvg,
  type StagedPngArtifact,
  type StagedSvgArtifact
} from "./svgBackend.js";

const ROOT_GAP = 40;
const STAGE_GAP = 24;

export interface JourneyMapPreRoutingArtifactsResult {
  rendererScene: RendererScene;
  measuredScene: MeasuredScene;
  preRoutingPositionedScene: PositionedScene;
  diagnostics: RendererDiagnostic[];
  preRoutingSvg: string;
  preRoutingPng: Uint8Array;
}

export interface JourneyMapRoutingArtifactsResult extends JourneyMapPreRoutingArtifactsResult {
  routingStages: JourneyMapRoutingStages;
  step2Svg: string;
  step2Png: Uint8Array;
  provisionalSvg: string;
  provisionalPng: Uint8Array;
  finalBasicSvg: string;
  finalBasicPng: Uint8Array;
  step3Svg: string;
  step3Png: Uint8Array;
  finalSvg: string;
  finalPng: Uint8Array;
}

export interface JourneyMapStagedRenderResult {
  rendererScene: RendererScene;
  measuredScene: MeasuredScene;
  positionedScene: PositionedScene;
  routingStages: JourneyMapRoutingStages;
  diagnostics: RendererDiagnostic[];
}

export interface JourneyMapStagedSvgResult extends JourneyMapStagedRenderResult, StagedSvgArtifact {}
export interface JourneyMapStagedPngResult extends JourneyMapStagedRenderResult, StagedSvgArtifact, StagedPngArtifact {}

export type JourneyMapBasicRoutingArtifactsResult = JourneyMapRoutingArtifactsResult;

function buildRootChrome(): SceneContainer["chrome"] {
  return {
    padding: {
      top: 32,
      right: 32,
      bottom: 32,
      left: 32
    },
    gutter: ROOT_GAP
  };
}

function buildStageChrome(): SceneContainer["chrome"] {
  return {
    padding: {
      top: 20,
      right: 20,
      bottom: 20,
      left: 20
    },
    gutter: STAGE_GAP,
    headerBandHeight: 40
  };
}

function buildJourneyStep(
  step: JourneyRenderStep,
  metadata: JourneyMapItemMetadata,
  nodeDecoratorMode: NodeDecoratorMode
): SceneNode {
  if (metadata.kind !== "step") {
    throw new Error(`Journey Step ${step.id} received non-Step placement metadata.`);
  }

  return {
    ...buildSharedNode({
      title: step.title,
      decoratorMode: nodeDecoratorMode,
      nodeType: "Step",
      nodeId: step.id,
      attributes: step.references.map(({ groupId, label, value }) => ({ groupId, label, value }))
    }, {
      classes: [
        "journey_map",
        "journey_step",
        metadata.uncontained ? "journey_step_root" : "journey_step_contained"
      ],
      ports: [
        buildPortSpec(`${step.id}__flow_in`, "journey_flow_in", "west"),
        buildPortSpec(`${step.id}__flow_out`, "journey_flow_out", "east"),
        buildPortSpec(`${step.id}__escape_in`, "journey_escape_in", "south"),
        buildPortSpec(`${step.id}__escape_out`, "journey_escape_out", "south")
      ]
    }),
    viewMetadata: {
      journeyMap: metadata
    }
  };
}

function buildJourneyStage(
  stage: JourneyRenderStage,
  placement: JourneyScenePlacement,
  nodeDecoratorMode: NodeDecoratorMode
): SceneContainer {
  const metadata = placement.metadataByItemId.get(stage.id);
  if (!metadata || metadata.kind !== "stage") {
    throw new Error(`Missing journey Stage placement metadata for ${stage.id}.`);
  }
  const gridPlacements = placement.gridPlacementsByStageId.get(stage.id);

  return {
    kind: "container",
    id: stage.id,
    role: "journey_stage",
    primitive: "cluster",
    classes: ["journey_map", "journey_stage"],
    viewMetadata: {
      journeyMap: metadata
    },
    layout: gridPlacements
      ? {
        strategy: "grid",
        columns: stage.items.length,
        gap: STAGE_GAP,
        crossAlignment: "start",
        grid: {
          placements: gridPlacements.map((cell) => ({ ...cell }))
        }
      }
      : {
        strategy: "stack",
        direction: "horizontal",
        gap: STAGE_GAP,
        crossAlignment: "start"
      },
    chrome: buildStageChrome(),
    headerContent: [
      {
        id: `${stage.id}__header`,
        kind: "text",
        text: stage.label,
        textStyleRole: "title",
        priority: "primary"
      }
    ],
    children: stage.items.map((step) => {
      const stepMetadata = placement.metadataByItemId.get(step.id);
      if (!stepMetadata || stepMetadata.kind !== "step") {
        throw new Error(`Missing journey Step placement metadata for ${step.id}.`);
      }
      return buildJourneyStep(step, stepMetadata, nodeDecoratorMode);
    }),
    ports: []
  };
}

function buildJourneyRootItem(
  item: JourneyMapRenderModel["rootItems"][number],
  placement: JourneyScenePlacement,
  nodeDecoratorMode: NodeDecoratorMode
): SceneItem {
  if (item.kind === "stage") {
    return buildJourneyStage(item, placement, nodeDecoratorMode);
  }
  const metadata = placement.metadataByItemId.get(item.id);
  if (!metadata || metadata.kind !== "step") {
    throw new Error(`Missing journey Step placement metadata for ${item.id}.`);
  }
  return buildJourneyStep(item, metadata, nodeDecoratorMode);
}

function buildJourneyEdge(edge: JourneyRenderEdge, placement: JourneyScenePlacement): SceneEdge {
  const sourceStageId = placement.parentStageByStepId.get(edge.from);
  const targetStageId = placement.parentStageByStepId.get(edge.to);
  const routeIntent = placement.edgeRouteIntentByEdgeId.get(edge.id);
  return {
    id: edge.id,
    role: "precedes",
    classes: ["journey_map", "journey_precedes"],
    from: {
      itemId: edge.from
    },
    to: {
      itemId: edge.to
    },
    routing: {
      style: "orthogonal",
      avoidNodeBoxes: true,
      preferAxis: "horizontal",
      sourcePortRole: "journey_flow_out",
      targetPortRole: "journey_flow_in"
    },
    markers: {
      end: "arrow"
    },
    ownerContainerId: sourceStageId !== undefined && sourceStageId === targetStageId
      ? sourceStageId
      : "root",
    viewMetadata: {
      journeyMap: {
        kind: "precedes",
        authorOrder: edge.authorOrder,
        sameEndpointOrdinal: edge.sameEndpointOrdinal,
        exactIdentityOrdinal: edge.exactIdentityOrdinal,
        ...(routeIntent
          ? {
            branchRouteRole: routeIntent.role,
            ...(routeIntent.branchGroupId ? { branchGroupId: routeIntent.branchGroupId } : {}),
            sourceLineageId: routeIntent.sourceLineageId,
            targetLineageId: routeIntent.targetLineageId,
            ...(routeIntent.branchArmOrdinal !== undefined
              ? { branchArmOrdinal: routeIntent.branchArmOrdinal }
              : {}),
            ...(routeIntent.branchArmCount !== undefined
              ? { branchArmCount: routeIntent.branchArmCount }
              : {})
          }
          : {})
      }
    }
  };
}

function buildDuplicateEdgeIdDiagnostics(edges: readonly SceneEdge[]): RendererDiagnostic[] {
  const counts = new Map<string, number>();
  for (const edge of edges) {
    counts.set(edge.id, (counts.get(edge.id) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([edgeId]) => createSceneDiagnostic(
      "renderer.scene.journey_map_duplicate_edge_id",
      `Journey scene edge ID ${edgeId} occurs more than once.`,
      {
        severity: "error",
        targetId: edgeId,
        details: JSON.stringify({ relatedIds: [edgeId] })
      }
    ));
}

function buildFirstParentDiagnostics(
  projection: Projection,
  view: ViewSpec,
  placement: JourneyScenePlacement
): RendererDiagnostic[] {
  const nodesById = new Map(projection.nodes.map((node) => [node.id, node] as const));
  const hierarchyEdgeTypes = new Set(view.projection.hierarchy_edges);
  const parentsByStepId = new Map<string, string[]>();
  for (const edge of projection.edges) {
    if (!hierarchyEdgeTypes.has(edge.type)
      || nodesById.get(edge.from)?.type !== "Stage"
      || nodesById.get(edge.to)?.type !== "Step") {
      continue;
    }
    const parents = parentsByStepId.get(edge.to) ?? [];
    if (!parents.includes(edge.from)) {
      parents.push(edge.from);
    }
    parentsByStepId.set(edge.to, parents);
  }

  const diagnostics: RendererDiagnostic[] = [];
  for (const stepId of placement.globalStepIds) {
    const parents = parentsByStepId.get(stepId) ?? [];
    if (parents.length < 2) {
      continue;
    }
    const selectedStageId = placement.parentStageByStepId.get(stepId);
    if (selectedStageId === undefined) {
      continue;
    }
    diagnostics.push(createSceneDiagnostic(
      "renderer.scene.journey_map_first_parent_selected",
      `Journey Step ${stepId} uses projected Stage ${selectedStageId} as its first structural parent.`,
      {
        severity: "info",
        targetId: stepId,
        details: JSON.stringify({ relatedIds: [stepId, ...parents], selectedStageId })
      }
    ));
  }
  return diagnostics;
}

function hasDirectedCycle(stepIds: readonly string[], edges: readonly JourneyRenderEdge[]): boolean {
  const adjacency = new Map(stepIds.map((stepId) => [stepId, [] as string[]]));
  for (const edge of edges) {
    if (edge.from === edge.to) {
      return true;
    }
    adjacency.get(edge.from)?.push(edge.to);
  }
  const stateByStepId = new Map<string, "visiting" | "visited">();
  const visit = (stepId: string): boolean => {
    const state = stateByStepId.get(stepId);
    if (state === "visiting") {
      return true;
    }
    if (state === "visited") {
      return false;
    }
    stateByStepId.set(stepId, "visiting");
    for (const targetId of adjacency.get(stepId) ?? []) {
      if (visit(targetId)) {
        return true;
      }
    }
    stateByStepId.set(stepId, "visited");
    return false;
  };
  return stepIds.some((stepId) => visit(stepId));
}

function buildDisconnectedChainDiagnostics(
  model: JourneyMapRenderModel,
  placement: JourneyScenePlacement
): RendererDiagnostic[] {
  const stepIds = placement.globalStepIds;
  if (stepIds.length === 0 || hasDirectedCycle(stepIds, model.edges)) {
    return [];
  }

  const incidentStepIds = new Set<string>();
  const neighbors = new Map(stepIds.map((stepId) => [stepId, new Set<string>()]));
  for (const edge of model.edges) {
    incidentStepIds.add(edge.from);
    incidentStepIds.add(edge.to);
    neighbors.get(edge.from)?.add(edge.to);
    neighbors.get(edge.to)?.add(edge.from);
  }
  if (stepIds.some((stepId) => !incidentStepIds.has(stepId))) {
    return [];
  }

  const remaining = new Set(stepIds);
  const components: string[][] = [];
  for (const firstStepId of stepIds) {
    if (!remaining.has(firstStepId)) {
      continue;
    }
    const component: string[] = [];
    const pending = [firstStepId];
    remaining.delete(firstStepId);
    while (pending.length > 0) {
      const stepId = pending.shift()!;
      component.push(stepId);
      for (const neighborId of neighbors.get(stepId) ?? []) {
        if (remaining.delete(neighborId)) {
          pending.push(neighborId);
        }
      }
    }
    const componentSet = new Set(component);
    if (!model.edges.some((edge) => componentSet.has(edge.from) && componentSet.has(edge.to))) {
      return [];
    }
    components.push(component);
  }

  if (components.length !== 2) {
    return [];
  }
  const mainStepId = stepIds[0]!;
  const secondary = components.find((component) => !component.includes(mainStepId));
  if (!secondary || secondary.length === 0) {
    return [];
  }
  const secondarySet = new Set(secondary);
  const orderedSecondary = stepIds.filter((stepId) => secondarySet.has(stepId));
  return [createSceneDiagnostic(
    "renderer.scene.journey_map_disconnected_chain",
    "Journey map contains a disconnected secondary PRECEDES chain.",
    {
      severity: "info",
      targetId: orderedSecondary[0],
      details: JSON.stringify({ relatedIds: orderedSecondary })
    }
  )];
}

function buildStepOnlyDiagnostics(placement: JourneyScenePlacement): RendererDiagnostic[] {
  if (placement.stageIds.length > 0 || placement.globalStepIds.length === 0) {
    return [];
  }
  return [createSceneDiagnostic(
    "renderer.scene.journey_map_step_only",
    "Journey map contains Steps without any Stage container.",
    {
      severity: "info",
      targetId: placement.globalStepIds[0],
      details: JSON.stringify({ relatedIds: placement.globalStepIds })
    }
  )];
}

function alignUncontainedStepsWithStageContent(root: PositionedScene["root"]): void {
  const stageContentTops = root.children
    .flatMap((item) => item.kind === "container" && item.viewMetadata?.journeyMap?.kind === "stage"
      ? [item.y + item.chrome.padding.top + (item.chrome.headerBandHeight ?? 0)]
      : []);
  const uncontainedByLane = new Map<number, PositionedScene["root"]["children"]>();
  for (const item of root.children) {
    if (item.kind !== "node") {
      continue;
    }
    const metadata = item.viewMetadata?.journeyMap;
    if (metadata?.kind !== "step" || !metadata.uncontained) {
      continue;
    }
    const laneOrder = metadata.laneOrder ?? 0;
    const laneItems = uncontainedByLane.get(laneOrder) ?? [];
    laneItems.push(item);
    uncontainedByLane.set(laneOrder, laneItems);
  }
  if (uncontainedByLane.size === 0) {
    return;
  }

  const firstLaneItems = uncontainedByLane.get(Math.min(...uncontainedByLane.keys())) ?? [];
  let laneTop = stageContentTops.length > 0
    ? Math.max(...stageContentTops)
    : Math.min(...firstLaneItems.map((item) => item.y));
  for (const laneOrder of [...uncontainedByLane.keys()].sort((left, right) => left - right)) {
    const laneItems = uncontainedByLane.get(laneOrder) ?? [];
    for (const item of laneItems) {
      item.y = laneTop;
    }
    laneTop += Math.max(...laneItems.map((item) => item.height)) + ROOT_GAP;
  }

  const contentBottom = Math.max(...root.children.map((item) => item.y + item.height));
  // Alignment can move branches upward. Refit before routing, which owns any
  // subsequent clearance expansion; the old grid extent is no longer a floor.
  root.height = Math.max(
    root.chrome.padding.top + (root.chrome.headerBandHeight ?? 0),
    contentBottom - root.y
  ) + root.chrome.padding.bottom;
}

export async function positionJourneyMapMeasuredSceneBeforeRouting(
  measuredScene: MeasuredScene
): Promise<PositionedScene> {
  return positionMeasuredSceneBeforeRouting(
    measuredScene,
    alignUncontainedStepsWithStageContent
  );
}

export function buildJourneyMapRendererSceneFromModel(
  model: JourneyMapRenderModel,
  detailId: string,
  layout: RendererJourneyMapLayoutConfig,
  themeId = "default",
  diagnostics: readonly RendererDiagnostic[] = [],
  nodeDecoratorMode: NodeDecoratorMode = {
    id: "none",
    showNodeType: false,
    showNodeId: false
  }
): RendererScene {
  const placement = buildJourneyScenePlacement(model, layout);
  const edges = model.edges.map((edge) => buildJourneyEdge(edge, placement));
  const rootLayout: SceneContainer["layout"] = placement.rootGridPlacements
    ? {
      strategy: "grid",
      columns: Math.max(...placement.rootGridPlacements.map((cell) => cell.column)) + 1,
      gap: ROOT_GAP,
      crossAlignment: "start",
      grid: {
        placements: placement.rootGridPlacements.map((cell) => ({ ...cell }))
      }
    }
    : {
      strategy: "stack",
      direction: "horizontal",
      gap: ROOT_GAP,
      crossAlignment: "start"
    };
  const root = {
    ...buildDiagramRootContainer({
      viewId: "journey_map",
      layout: rootLayout,
      chrome: buildRootChrome(),
      children: model.rootItems.map((item) => buildJourneyRootItem(item, placement, nodeDecoratorMode)),
      classes: ["journey_map"]
    }),
    viewMetadata: {
      journeyMap: {
        kind: "root" as const,
        rootItemIds: [...placement.rootItemIds],
        stageIds: [...placement.stageIds],
        globalStepIds: [...placement.globalStepIds],
        ...(placement.branchGroups.length > 0
          ? {
            branchGroups: placement.branchGroups.map((group) => ({
              ...group,
              targetStepIds: [...group.targetStepIds],
              arms: group.arms.map((arm) => ({ ...arm, branchPath: [...arm.branchPath] })),
              envelope: { ...group.envelope }
            })),
            branchLineages: placement.branchLineages.map((lineage) => ({
              ...lineage,
              branchPath: [...lineage.branchPath]
            }))
          }
          : {})
      }
    }
  };

  return {
    viewId: "journey_map",
    detailId,
    themeId,
    root,
    edges,
    diagnostics: sortRendererDiagnostics([
      ...diagnostics,
      ...buildDuplicateEdgeIdDiagnostics(edges)
    ])
  };
}

export function buildJourneyMapRendererScene(
  projection: Projection,
  graph: CompiledGraph,
  bundle: Bundle,
  view: ViewSpec,
  settings: StagedRenderSettings
): RendererScene {
  const layout = view.conventions.renderer_defaults?.journey_map_layout;
  if (layout === undefined) {
    throw new Error("Journey-map rendering requires renderer_defaults.journey_map_layout from the loaded bundle.");
  }
  const model = buildJourneyMapRenderModel(
    projection,
    graph,
    bundle,
    view.projection.hierarchy_edges,
    view.projection.ordering_edges,
    resolveDetailDisplayPolicy(view, settings.detailId)
  );
  const placement = buildJourneyScenePlacement(model, layout);
  return buildJourneyMapRendererSceneFromModel(
    model,
    settings.detailId,
    layout,
    settings.themeId ?? "default",
    [
      ...buildFirstParentDiagnostics(projection, view, placement),
      ...buildStepOnlyDiagnostics(placement),
      ...buildDisconnectedChainDiagnostics(model, placement)
    ],
    settings.nodeDecoratorMode
  );
}

async function buildJourneyMapPreRoutingPipeline(
  projection: Projection,
  graph: CompiledGraph,
  bundle: Bundle,
  view: ViewSpec,
  settings: StagedRenderSettings
): Promise<{
  rendererScene: RendererScene;
  measuredScene: MeasuredScene;
  preRoutingPositionedScene: PositionedScene;
}> {
  const rendererScene = buildJourneyMapRendererScene(
    projection,
    graph,
    bundle,
    view,
    settings
  );
  const measuredScene = measureScene(rendererScene);
  const preRoutingPositionedScene = await positionJourneyMapMeasuredSceneBeforeRouting(measuredScene);
  return {
    rendererScene,
    measuredScene,
    preRoutingPositionedScene
  };
}

async function buildJourneyMapRoutedPipeline(
  projection: Projection,
  graph: CompiledGraph,
  bundle: Bundle,
  view: ViewSpec,
  settings: StagedRenderSettings
): Promise<JourneyMapStagedRenderResult> {
  const pipeline = await buildJourneyMapPreRoutingPipeline(
    projection,
    graph,
    bundle,
    view,
    settings
  );
  const routingStages = buildJourneyMapRoutingStages(
    pipeline.measuredScene,
    pipeline.preRoutingPositionedScene
  );
  return {
    rendererScene: pipeline.rendererScene,
    measuredScene: pipeline.measuredScene,
    positionedScene: routingStages.finalPositionedScene,
    routingStages,
    diagnostics: routingStages.finalPositionedScene.diagnostics
  };
}

export async function renderJourneyMapPreRoutingArtifacts(
  projection: Projection,
  graph: CompiledGraph,
  bundle: Bundle,
  view: ViewSpec,
  settings: StagedRenderSettings
): Promise<JourneyMapPreRoutingArtifactsResult> {
  const pipeline = await buildJourneyMapPreRoutingPipeline(
    projection,
    graph,
    bundle,
    view,
    settings
  );
  const rendered = await renderPositionedSceneToPng(pipeline.preRoutingPositionedScene);

  return {
    ...pipeline,
    diagnostics: rendered.diagnostics,
    preRoutingSvg: rendered.svg,
    preRoutingPng: rendered.png
  };
}

export async function renderJourneyMapRoutingArtifacts(
  projection: Projection,
  graph: CompiledGraph,
  bundle: Bundle,
  view: ViewSpec,
  settings: StagedRenderSettings
): Promise<JourneyMapRoutingArtifactsResult> {
  const preRouting = await renderJourneyMapPreRoutingArtifacts(
    projection,
    graph,
    bundle,
    view,
    settings
  );
  const routingStages = buildJourneyMapRoutingStages(
    preRouting.measuredScene,
    preRouting.preRoutingPositionedScene
  );
  const [step2Rendered, provisionalRendered, finalBasicRendered, step3Rendered, finalRendered] = await Promise.all([
    renderPositionedSceneToPng(routingStages.step2PositionedScene),
    renderPositionedSceneToPng(routingStages.provisionalPositionedScene),
    renderPositionedSceneToPng(routingStages.finalBasicPositionedScene),
    renderPositionedSceneToPng(routingStages.step3PositionedScene),
    renderPositionedSceneToPng(routingStages.finalPositionedScene)
  ]);
  return {
    ...preRouting,
    routingStages,
    diagnostics: finalRendered.diagnostics,
    step2Svg: step2Rendered.svg,
    step2Png: step2Rendered.png,
    provisionalSvg: provisionalRendered.svg,
    provisionalPng: provisionalRendered.png,
    finalBasicSvg: finalBasicRendered.svg,
    finalBasicPng: finalBasicRendered.png,
    step3Svg: step3Rendered.svg,
    step3Png: step3Rendered.png,
    finalSvg: finalRendered.svg,
    finalPng: finalRendered.png
  };
}

export async function renderJourneyMapStagedSvg(
  projection: Projection,
  graph: CompiledGraph,
  bundle: Bundle,
  view: ViewSpec,
  settings: StagedRenderSettings
): Promise<JourneyMapStagedSvgResult> {
  const pipeline = await buildJourneyMapRoutedPipeline(
    projection,
    graph,
    bundle,
    view,
    settings
  );
  const rendered = await renderPositionedSceneToSvg(pipeline.positionedScene);
  return {
    ...pipeline,
    ...rendered
  };
}

export async function renderJourneyMapStagedPng(
  projection: Projection,
  graph: CompiledGraph,
  bundle: Bundle,
  view: ViewSpec,
  settings: StagedRenderSettings
): Promise<JourneyMapStagedPngResult> {
  const renderedSvg = await renderJourneyMapStagedSvg(
    projection,
    graph,
    bundle,
    view,
    settings
  );
  const renderedPng = await renderPositionedSceneToPng(renderedSvg.positionedScene);
  return {
    ...renderedSvg,
    ...renderedPng
  };
}

export async function renderJourneyMapBasicRoutingArtifacts(
  projection: Projection,
  graph: CompiledGraph,
  bundle: Bundle,
  view: ViewSpec,
  settings: StagedRenderSettings
): Promise<JourneyMapBasicRoutingArtifactsResult> {
  return renderJourneyMapRoutingArtifacts(
    projection,
    graph,
    bundle,
    view,
    settings
  );
}
