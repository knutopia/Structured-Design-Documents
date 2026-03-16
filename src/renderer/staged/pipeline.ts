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

export function positionScene(measuredScene: MeasuredScene): PositionedScene {
  return positionMeasuredScene(measuredScene);
}

export function runStagedRendererPipeline(scene: RendererScene): StagedRendererPipelineResult {
  const measuredScene = measureScene(scene);
  const positionedScene = positionScene(measuredScene);

  return {
    rendererScene: scene,
    measuredScene,
    positionedScene
  };
}
