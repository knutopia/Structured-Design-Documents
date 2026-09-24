import type {
  MeasuredScene,
  PositionedScene,
  RendererScene
} from "./contracts.js";
import { measureRendererScene } from "./microLayout.js";
import { positionMeasuredScene, positionMeasuredSceneBeforeRouting } from "./macroLayout.js";
import { createRoutingDiagnostic, sortRendererDiagnostics } from "./diagnostics.js";
import {
  repairPositionedSceneRoutesAroundNodes,
  validatePositionedSceneRouting
} from "./routingCore/index.js";
import { routeUiContractsScene, validateUiContractsRoutes } from "./uiContractsRouting.js";
import { repairUiContractsLabels } from "./uiContractsLabels.js";

export interface StagedRendererPipelineResult {
  rendererScene: RendererScene;
  measuredScene: MeasuredScene;
  positionedScene: PositionedScene;
}

export function measureScene(scene: RendererScene): MeasuredScene {
  return measureRendererScene(scene);
}

export async function positionSceneBeforeRouting(measuredScene: MeasuredScene): Promise<PositionedScene> {
  return positionMeasuredSceneBeforeRouting(measuredScene);
}

export async function positionScene(measuredScene: MeasuredScene): Promise<PositionedScene> {
  return positionMeasuredScene(measuredScene);
}

export async function runStagedRendererPipeline(scene: RendererScene): Promise<StagedRendererPipelineResult> {
  const measuredScene = measureScene(scene);
  let positionedScene = await positionScene(measuredScene);
  if (scene.viewId === "ia_place_map" || scene.viewId === "ui_contracts") {
    if (scene.viewId === "ui_contracts") {
      // First separate collinear segments via the shared lifecycle, then route
      // around intermediate nodes via the candidate-based repair. The lifecycle
      // alone does not avoid node boxes; the repair alone greedily picks the
      // first candidate (routing connectors the wrong way around). Together they
      // cover both concerns.
      positionedScene = routeUiContractsScene(positionedScene);
      positionedScene = repairPositionedSceneRoutesAroundNodes(positionedScene);
      positionedScene = repairUiContractsLabels(positionedScene);
    }
    const violations = scene.viewId === "ui_contracts"
      ? validateUiContractsRoutes(positionedScene)
      : validatePositionedSceneRouting(positionedScene, {
          sharedTrackGroup: (edge) => edge.classes.includes("shared_trunk")
            ? `ia-trunk:${edge.from.itemId}` : undefined
        });
    if (violations.length > 0) {
      positionedScene = {
        ...positionedScene,
        diagnostics: sortRendererDiagnostics([
          ...positionedScene.diagnostics,
          ...violations.map((violation) => createRoutingDiagnostic(
            `renderer.routing.${scene.viewId}_${violation.kind}`,
            violation.message,
            violation.connectorIds[0] ?? scene.viewId,
            "error"
          ))
        ])
      };
    }
  }

  return {
    rendererScene: scene,
    measuredScene,
    positionedScene
  };
}
