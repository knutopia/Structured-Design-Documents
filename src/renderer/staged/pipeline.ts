import type {
  MeasuredScene,
  PositionedScene,
  RendererScene
} from "./contracts.js";
import { measureRendererScene } from "./microLayout.js";
import { positionMeasuredScene } from "./macroLayout.js";

export interface StagedRendererPipelineResult {
  rendererScene: RendererScene;
  measuredScene: MeasuredScene;
  positionedScene: PositionedScene;
}

export function measureScene(scene: RendererScene): MeasuredScene {
  return measureRendererScene(scene);
}

export async function positionScene(measuredScene: MeasuredScene): Promise<PositionedScene> {
  return positionMeasuredScene(measuredScene);
}

export async function runStagedRendererPipeline(scene: RendererScene): Promise<StagedRendererPipelineResult> {
  const measuredScene = measureScene(scene);
  const positionedScene = await positionScene(measuredScene);

  return {
    rendererScene: scene,
    measuredScene,
    positionedScene
  };
}
