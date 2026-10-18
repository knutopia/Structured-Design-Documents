import { applyDiagramMetadata } from "./sceneBuilders.js";
import type { ViewSpec } from "../../bundle/types.js";
import type { CompiledGraph } from "../../compiler/types.js";
import type { Projection } from "../../projector/types.js";
import { buildUiContractsPresentationModel } from "../uiContractsPresentationModel.js";
import type { RendererScene, StagedRenderSettings } from "./contracts.js";
import { runStagedRendererPipeline, type StagedRendererPipelineResult } from "./pipeline.js";
import { UiContractsSceneBuilder } from "./uiContractsPresentationScene.js";
import { runUiContractsRendererPipeline, type UiRoutingOutcome } from "./uiContractsPipeline.js";
import { createRoutingDiagnostic, RendererArtifactError } from "./diagnostics.js";
import {
  renderPositionedSceneToPng,
  renderPositionedSceneToSvg,
  type StagedPngArtifact,
  type StagedSvgArtifact
} from "./svgBackend.js";

export interface UiContractsStagedSvgResult extends StagedRendererPipelineResult, StagedSvgArtifact { routingOutcome?: UiRoutingOutcome }
export interface UiContractsStagedPngResult extends StagedRendererPipelineResult, StagedPngArtifact { routingOutcome?: UiRoutingOutcome }

async function renderPipeline(projection: Projection, graph: CompiledGraph, view: ViewSpec, settings: StagedRenderSettings) {
  const model = buildUiContractsPresentationModel(projection, graph, view, settings.detailId);
  if (!model.routing) return runStagedRendererPipeline(buildUiContractsRendererScene(projection, graph, view, settings));
  const outcome = await runUiContractsRendererPipeline(model, settings);
  const revision = outcome.status === "accepted" ? outcome.revision : outcome.diagnosticRevision;
  if (outcome.status === "failed") {
    const diagnostics = [...outcome.violations, createRoutingDiagnostic(`renderer.routing.ui_contracts_${outcome.reason}`,
      `No accepted placement was found within the permitted search (${outcome.reason}).`, "ui_contracts", "error", JSON.stringify({ unresolved: outcome.unresolved, evidence: outcome.evidence }))];
    if (settings.artifactIntent !== "diagnostic" || !revision) throw new RendererArtifactError(diagnostics);
    revision.positionedScene.diagnostics = [...revision.positionedScene.diagnostics, ...diagnostics];
  }
  if (!revision) throw new Error("UI coordinator returned no coherent revision.");
  applyDiagramMetadata(revision.rendererScene, projection);
  const diagram = revision.rendererScene.root.viewMetadata?.diagram;
  if (diagram) for (const root of [revision.measuredScene.root, revision.positionedScene.root]) root.viewMetadata = { ...root.viewMetadata, diagram: { ...diagram } };
  return { ...revision, routingOutcome: outcome };
}

/** Public staged path. Legacy text/Graphviz continue to use their own render model. */
export function buildUiContractsRendererScene(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  settings: StagedRenderSettings
): RendererScene {
  const model = buildUiContractsPresentationModel(projection, graph, view, settings.detailId);
  const builder = new UiContractsSceneBuilder(settings.detailId, settings.nodeDecoratorMode ?? {
    id: "none", showNodeType: false, showNodeId: false
  }, settings.themeId);
  return applyDiagramMetadata(builder.complete(model), projection);
}

export async function renderUiContractsStagedSvg(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  settings: StagedRenderSettings
): Promise<UiContractsStagedSvgResult> {
  const pipeline = await renderPipeline(projection, graph, view, settings);
  const rendered = await renderPositionedSceneToSvg(pipeline.positionedScene, settings);

  return {
    ...pipeline,
    ...rendered
  };
}

export async function renderUiContractsStagedPng(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  settings: StagedRenderSettings
): Promise<UiContractsStagedPngResult> {
  const pipeline = await renderPipeline(projection, graph, view, settings);
  const rendered = await renderPositionedSceneToPng(pipeline.positionedScene, settings);

  return {
    ...pipeline,
    ...rendered
  };
}
