import type { RendererScene, StagedRenderSettings } from "./contracts.js";
import { runStagedRendererPipeline, type StagedRendererPipelineResult } from "./pipeline.js";
import {
  buildDiagramRootContainer,
  buildSharedNode,
  type SharedNodeRequest
} from "./sceneBuilders.js";
import {
  renderPositionedSceneToPng,
  renderPositionedSceneToSvg,
  type StagedPngArtifact,
  type StagedSvgArtifact
} from "./svgBackend.js";

export interface SharedNodeRendererOptions extends StagedRenderSettings {
  gap?: number;
  columns?: number;
}

export interface SharedNodeStagedSvgResult extends StagedRendererPipelineResult, StagedSvgArtifact {}
export interface SharedNodeStagedPngResult extends StagedRendererPipelineResult, StagedPngArtifact {}

export function buildSharedNodeRendererScene(
  requests: readonly SharedNodeRequest[],
  options: SharedNodeRendererOptions
): RendererScene {
  return {
    viewId: "shared_node",
    detailId: options.detailId,
    themeId: options.themeId ?? "default",
    root: buildDiagramRootContainer({
      viewId: "shared_node",
      classes: ["standalone_node_harness"],
      layout: options.columns
        ? {
          strategy: "grid",
          columns: options.columns,
          gap: options.gap ?? 24,
          crossAlignment: "start",
          grid: {
            placements: requests.map((request, index) => ({
              itemId: request.nodeId,
              row: Math.floor(index / options.columns!),
              column: index % options.columns!
            }))
          }
        }
        : {
          strategy: "stack",
          direction: "horizontal",
          gap: options.gap ?? 24,
          crossAlignment: "start"
        },
      chrome: {
        padding: {
          top: 16,
          right: 16,
          bottom: 16,
          left: 16
        },
        headerBandHeight: 0
      },
      children: requests.map((request) => buildSharedNode(request))
    }),
    edges: [],
    diagnostics: []
  };
}

export async function renderSharedNodesStagedSvg(
  requests: readonly SharedNodeRequest[],
  options: SharedNodeRendererOptions
): Promise<SharedNodeStagedSvgResult> {
  const rendererScene = buildSharedNodeRendererScene(requests, options);
  const pipeline = await runStagedRendererPipeline(rendererScene);
  const rendered = await renderPositionedSceneToSvg(pipeline.positionedScene);
  return {
    ...pipeline,
    ...rendered
  };
}

export async function renderSharedNodesStagedPng(
  requests: readonly SharedNodeRequest[],
  options: SharedNodeRendererOptions
): Promise<SharedNodeStagedPngResult> {
  const renderedSvg = await renderSharedNodesStagedSvg(requests, options);
  const renderedPng = await renderPositionedSceneToPng(renderedSvg.positionedScene);
  return {
    ...renderedSvg,
    ...renderedPng
  };
}
