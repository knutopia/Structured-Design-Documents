import type {
  PositionedContainer,
  PositionedEdge,
  PositionedItem,
  PositionedScene
} from "../contracts.js";
import type {
  RoutingBox,
  RoutingValidationEdge,
  RoutingValidationPolicy,
  RoutingViolation
} from "./contracts.js";
import { validateRouting } from "./validation.js";
import { buildExteriorOrthogonalCandidates } from "./candidates.js";

export interface PositionedSceneRoutingValidationOptions {
  policy?: Partial<RoutingValidationPolicy>;
  sharedTrackGroup?: (edge: PositionedEdge, routeSegmentIndex: number) => string | undefined;
  includeEdgeInteractions?: boolean;
}

function collectNodeBoxes(item: PositionedItem, boxes: RoutingBox[]): void {
  if (item.kind === "node") {
    boxes.push({ id: item.id, x: item.x, y: item.y, width: item.width, height: item.height });
    return;
  }
  for (const child of item.children) {
    collectNodeBoxes(child, boxes);
  }
}

function validationEdge(
  edge: PositionedEdge,
  options: PositionedSceneRoutingValidationOptions
): RoutingValidationEdge {
  const sharedTrackGroupBySegmentIndex = new Map<number, string>();
  for (let index = 0; index < edge.route.points.length - 1; index += 1) {
    const group = options.sharedTrackGroup?.(edge, index);
    if (group) {
      sharedTrackGroupBySegmentIndex.set(index, group);
    }
  }
  return {
    id: edge.id,
    sourceItemId: edge.from.itemId,
    targetItemId: edge.to.itemId,
    style: edge.route.style,
    points: edge.route.points,
    expectedSourcePoint: { x: edge.from.x, y: edge.from.y },
    expectedTargetPoint: { x: edge.to.x, y: edge.to.y },
    sharedTrackGroupBySegmentIndex: sharedTrackGroupBySegmentIndex.size > 0
      ? sharedTrackGroupBySegmentIndex
      : undefined
  };
}

export function validatePositionedSceneRouting(
  scene: PositionedScene,
  options: PositionedSceneRoutingValidationOptions = {}
): RoutingViolation[] {
  const boxes: RoutingBox[] = [];
  collectNodeBoxes(scene.root as PositionedContainer, boxes);
  const edges = scene.edges.map((edge) => validationEdge(edge, options));
  return validateRouting({
    edges,
    boxes,
    policy: options.policy,
    includeEdgeInteractions: options.includeEdgeInteractions
  });
}

export function repairPositionedSceneRoutesAroundNodes(scene: PositionedScene): PositionedScene {
  const boxes: RoutingBox[] = [];
  collectNodeBoxes(scene.root, boxes);
  const repairedValidationEdges: RoutingValidationEdge[] = [];
  const edges = scene.edges.map((edge) => {
    const validation = validationEdge(edge, {});
    const blocking: ReadonlySet<RoutingViolation["kind"]> = new Set([
        "non_orthogonal_segment",
        "endpoint_mismatch",
        "endpoint_intrusion",
        "node_intersection",
        "terminal_leg_too_short",
        "collinear_overlap",
        "track_separation"
      ]);
    for (const candidate of buildExteriorOrthogonalCandidates(validation, boxes)) {
      const candidateEdge: RoutingValidationEdge = { ...validation, style: candidate.route.style, points: candidate.route.points };
      const edgeById = new Map(
        [...repairedValidationEdges, candidateEdge].map((item) => [item.id, item] as const)
      );
      const violations = validateRouting({
        edges: [...repairedValidationEdges, candidateEdge],
        boxes,
        policy: {
          minTerminalLeg: 12,
          allowCollinearOverlap: (leftId, leftIndex, rightId, rightIndex) => {
            const left = edgeById.get(leftId);
            const right = edgeById.get(rightId);
            return left !== undefined
              && right !== undefined
              && left.targetItemId === right.targetItemId
              && leftIndex === left.points.length - 2
              && rightIndex === right.points.length - 2;
          }
        }
      }).filter((violation) =>
        violation.connectorIds.includes(edge.id) && blocking.has(violation.kind)
      );
      if (violations.length === 0) {
        repairedValidationEdges.push(candidateEdge);
        return { ...edge, route: candidate.route };
      }
    }
    repairedValidationEdges.push(validation);
    return edge;
  });
  return { ...scene, edges };
}
