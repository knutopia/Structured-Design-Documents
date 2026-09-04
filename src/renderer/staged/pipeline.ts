import type {
  MeasuredScene,
  PositionedScene,
  RendererScene
} from "./contracts.js";
import { measureRendererScene } from "./microLayout.js";
import { positionMeasuredScene, positionMeasuredSceneBeforeRouting } from "./macroLayout.js";
import { createRoutingDiagnostic, sortRendererDiagnostics } from "./diagnostics.js";
import { positionEdgeLabel } from "./routing.js";
import {
  repairPositionedSceneRoutesAroundNodes,
  validatePositionedSceneRouting
} from "./routingCore/index.js";

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
      const originalRouteByEdgeId = new Map(
        positionedScene.edges.map((edge) => [edge.id, edge.route] as const)
      );
      positionedScene = repairPositionedSceneRoutesAroundNodes(positionedScene);
      positionedScene = {
        ...positionedScene,
        edges: positionedScene.edges.map((edge) => {
          const originalRoute = originalRouteByEdgeId.get(edge.id);
          if (!edge.label || !originalRoute
            || JSON.stringify(originalRoute.points) === JSON.stringify(edge.route.points)) {
            return edge;
          }
          return {
            ...edge,
            label: positionEdgeLabel(edge.label, edge.route)
          };
        })
      };
    }
    const edgeById = new Map(positionedScene.edges.map((edge) => [edge.id, edge] as const));
    const violations = validatePositionedSceneRouting(positionedScene, {
      sharedTrackGroup: scene.viewId === "ia_place_map"
        ? (edge) => edge.classes.includes("shared_trunk")
          ? `ia-trunk:${edge.from.itemId}`
          : undefined
        : undefined,
      policy: scene.viewId === "ui_contracts"
        ? {
          allowCollinearOverlap: (leftId, leftIndex, rightId, rightIndex) => {
            const left = edgeById.get(leftId);
            const right = edgeById.get(rightId);
            return left !== undefined
              && right !== undefined
              && left.to.itemId === right.to.itemId
              && leftIndex === left.route.points.length - 2
              && rightIndex === right.route.points.length - 2;
          }
        }
        : undefined
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
