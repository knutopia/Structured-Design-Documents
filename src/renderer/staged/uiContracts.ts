import type { ViewSpec } from "../../bundle/types.js";
import type { CompiledGraph } from "../../compiler/types.js";
import type { Projection } from "../../projector/types.js";
import { buildUiContractsPresentationModel } from "../uiContractsPresentationModel.js";
import type { RendererScene, StagedRenderSettings } from "./contracts.js";
import { runStagedRendererPipeline, type StagedRendererPipelineResult } from "./pipeline.js";
import { UiContractsSceneBuilder } from "./uiContractsPresentationScene.js";
import {
  renderPositionedSceneToPng,
  renderPositionedSceneToSvg,
  type StagedPngArtifact,
  type StagedSvgArtifact
} from "./svgBackend.js";

export interface UiContractsStagedSvgResult extends StagedRendererPipelineResult, StagedSvgArtifact {}
export interface UiContractsStagedPngResult extends StagedRendererPipelineResult, StagedPngArtifact {}

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
  return builder.complete(model);
}

export async function renderUiContractsStagedSvg(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  settings: StagedRenderSettings
): Promise<UiContractsStagedSvgResult> {
  const rendererScene = buildUiContractsRendererScene(projection, graph, view, settings);
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
  settings: StagedRenderSettings
): Promise<UiContractsStagedPngResult> {
  const rendererScene = buildUiContractsRendererScene(projection, graph, view, settings);
  const pipeline = await runStagedRendererPipeline(rendererScene);
  const rendered = await renderPositionedSceneToPng(pipeline.positionedScene);

  return {
    ...pipeline,
    ...rendered
  };
}
