import type {
  PositionedContainer, PositionedEdge, PositionedEdgeLabel, PositionedItem, PositionedNode, PositionedScene
} from "./contracts.js";
import {
  FIXED_LABEL_DISTANCE,
  buildConnectorRouteSegmentsById,
  positionConnectorLabel,
  type BlockingBox,
  type ConnectorRouteSegmentDetail,
  type LabelBox
} from "./connectorLabelPlacement.js";
import { createRoutingDiagnostic, sortRendererDiagnostics, type RendererDiagnostic } from "./diagnostics.js";
import { labelBoxDistanceToSegment, labelBoxIntersectsSegment, labelBoxesOverlap } from "./labelCollisionGeometry.js";
import { arrowMarkerFootprintBox } from "./markerGeometry.js";
import { resolveRendererTheme } from "./theme.js";
import { validateUiContractsRoutes } from "./uiContractsRouting.js";

interface LabelObstacle extends BlockingBox { id: string; kind: "node" | "header" | "marker" }
interface LabelContext {
  obstacles: LabelObstacle[];
  nodeById: Map<string, PositionedNode>;
  scopeByEdgeId: Map<string, PositionedContainer>;
  segmentsById: Map<string, ConnectorRouteSegmentDetail[]>;
}

function contains(outer: LabelBox, inner: LabelBox): boolean {
  const epsilon = 0.5;
  return inner.x >= outer.x - epsilon && inner.y >= outer.y - epsilon
    && inner.x + inner.width <= outer.x + outer.width + epsilon
    && inner.y + inner.height <= outer.y + outer.height + epsilon;
}

function buildContext(scene: PositionedScene): LabelContext {
  const obstacles: LabelObstacle[] = [];
  const nodeById = new Map<string, PositionedNode>();
  const ancestorsByItemId = new Map<string, PositionedContainer[]>();
  const visit = (item: PositionedItem, ancestors: PositionedContainer[]): void => {
    if (item.kind === "node") {
      nodeById.set(item.id, item);
      ancestorsByItemId.set(item.id, ancestors);
      obstacles.push({ kind: "node", id: item.id, itemId: item.id,
        x: item.x, y: item.y, width: item.width, height: item.height });
      return;
    }
    const chain = [...ancestors, item];
    ancestorsByItemId.set(item.id, chain);
    for (const block of item.headerContent) {
      obstacles.push({ kind: "header", id: block.id, x: item.x + block.x, y: item.y + block.y,
        width: block.width, height: block.height });
    }
    if (item.chrome.headerBandHeight && item.chrome.headerBandHeight > 0) {
      obstacles.push({ kind: "header", id: `${item.id}:header-band`, x: item.x, y: item.y,
        width: item.width, height: item.chrome.headerBandHeight });
    }
    item.children.forEach((child) => visit(child, chain));
  };
  visit(scene.root, []);

  const theme = resolveRendererTheme(scene.themeId, "routing").theme;
  for (const edge of scene.edges) {
    const points = edge.route.points;
    for (const end of ["start", "end"] as const) {
      if (edge.markers?.[end] !== "arrow" || points.length < 2) continue;
      const tip = end === "start" ? points[0]! : points[points.length - 1]!;
      const neighbor = end === "start" ? points[1]! : points[points.length - 2]!;
      const box = arrowMarkerFootprintBox(tip, neighbor, theme.paint.arrowSize, theme.paint.edgeStrokeWidth);
      if (box) obstacles.push({ ...box, kind: "marker", id: `${edge.id}:${end}` });
    }
  }

  const scopeByEdgeId = new Map<string, PositionedContainer>();
  for (const edge of scene.edges) {
    const from = ancestorsByItemId.get(edge.from.itemId) ?? [scene.root];
    const to = ancestorsByItemId.get(edge.to.itemId) ?? [scene.root];
    const shared = from.filter((candidate) => to.includes(candidate));
    scopeByEdgeId.set(edge.id, shared[shared.length - 1] ?? scene.root);
  }
  return {
    obstacles, nodeById, scopeByEdgeId,
    segmentsById: buildConnectorRouteSegmentsById(scene.edges, (edge) => edge.id, (edge) => edge.route)
  };
}

function labelProblems(
  scene: PositionedScene,
  context: LabelContext,
  edge: PositionedEdge,
  label: PositionedEdgeLabel,
  otherLabels: readonly { id: string; box: LabelBox }[]
): string[] {
  const problems: string[] = [];
  const scope = context.scopeByEdgeId.get(edge.id) ?? scene.root;
  if (!contains(scene.root, label) || !contains(scope, label)) problems.push("bounds");
  for (const obstacle of context.obstacles) {
    if (labelBoxesOverlap(label, obstacle)) problems.push(`${obstacle.kind}:${obstacle.id}`);
  }
  for (const other of otherLabels) {
    if (other.id !== edge.id && labelBoxesOverlap(label, other.box)) problems.push(`label:${other.id}`);
  }
  const ownSegments = context.segmentsById.get(edge.id) ?? [];
  if (!ownSegments.some((segment) => labelBoxDistanceToSegment(label, segment)
    <= FIXED_LABEL_DISTANCE * 4)) problems.push("association");
  for (const [connectorId, segments] of context.segmentsById) {
    if (connectorId === edge.id) continue;
    if (segments.some((segment) => labelBoxIntersectsSegment(label, segment))) {
      problems.push(`connector:${connectorId}`);
    }
  }
  return problems;
}

function scopeBlockingBoxes(scene: PositionedScene, scope: PositionedContainer): BlockingBox[] {
  const root = scene.root;
  return [
    { x: root.x, y: root.y, width: Math.max(0, scope.x - root.x), height: root.height },
    { x: scope.x + scope.width, y: root.y,
      width: Math.max(0, root.x + root.width - scope.x - scope.width), height: root.height },
    { x: scope.x, y: root.y, width: scope.width, height: Math.max(0, scope.y - root.y) },
    { x: scope.x, y: scope.y + scope.height,
      width: scope.width, height: Math.max(0, root.y + root.height - scope.y - scope.height) }
  ].filter((box) => box.width > 0 && box.height > 0);
}

function horizontalLane(edge: PositionedEdge, context: LabelContext): { leftX: number } | undefined {
  const source = context.nodeById.get(edge.from.itemId);
  const target = context.nodeById.get(edge.to.itemId);
  if (!edge.label || !source || !target || source.x + source.width >= target.x) return undefined;
  const leftX = source.x + source.width + FIXED_LABEL_DISTANCE;
  return leftX + edge.label.width <= target.x - FIXED_LABEL_DISTANCE + 0.5
    ? { leftX }
    : undefined;
}

/** Leaves already valid labels and all non-label geometry untouched. */
export function repairUiContractsLabels(scene: PositionedScene): PositionedScene {
  const context = buildContext(scene);
  const retained: Array<{ id: string; box: LabelBox }> = [];
  const pending: PositionedEdge[] = [];
  for (const edge of scene.edges) {
    if (!edge.label) continue;
    if (labelProblems(scene, context, edge, edge.label, retained).length === 0) {
      retained.push({ id: edge.id, box: edge.label });
    } else {
      pending.push(edge);
    }
  }
  const diagnostics: RendererDiagnostic[] = [];
  const replacementById = new Map<string, PositionedEdgeLabel>();
  for (const edge of pending) {
    const scope = context.scopeByEdgeId.get(edge.id) ?? scene.root;
    const lane = horizontalLane(edge, context);
    const candidate = positionConnectorLabel({
      connectorId: edge.id,
      measuredLabel: edge.label!,
      route: edge.route,
      connectorSegmentsById: context.segmentsById,
      blockedBoxes: [
        ...context.obstacles.map((obstacle): BlockingBox => obstacle.kind === "node"
          ? { itemId: obstacle.id, x: obstacle.x - FIXED_LABEL_DISTANCE,
              y: obstacle.y - FIXED_LABEL_DISTANCE,
              width: obstacle.width + FIXED_LABEL_DISTANCE * 2,
              height: obstacle.height + FIXED_LABEL_DISTANCE * 2 }
          : obstacle),
        ...retained.map(({ id, box }) => ({ ...box, itemId: id })),
        ...scopeBlockingBoxes(scene, scope)
      ],
      separatorSegments: [],
      scene,
      diagnostics,
      connectorBlockMode: "all_segments",
      horizontalPlacementMode: "scenario_side_offsets",
      horizontalSideLabelDistance: FIXED_LABEL_DISTANCE,
      includeAdjacentHorizontalLabelAnchors: true,
      preferHorizontalAnchors: lane !== undefined,
      preferEarlierHorizontalAnchors: lane !== undefined,
      preferHorizontalSidePlacement: lane !== undefined,
      maxVerticalLabelAnchorDistance: lane ? FIXED_LABEL_DISTANCE * 2 : undefined,
      horizontalLabelLanePreference: lane,
      horizontalLabelAssociationPolicy: lane ? {
        maxDetachedDistance: FIXED_LABEL_DISTANCE * 4,
        minStrongOverlap: FIXED_LABEL_DISTANCE * 2,
        maxStrongDetachedDistance: FIXED_LABEL_DISTANCE
      } : undefined,
      diagnosticsPolicy: {
        omittedCode: "renderer.routing.ui_contracts_edge_label_omitted",
        fallbackCode: "renderer.routing.ui_contracts_edge_label_fallback",
        severity: "info",
        noAnchorMessage: (id) => `Label for ${id} has no usable connector anchor.`,
        noCandidateMessage: (id) => `Label for ${id} has no placement candidate.`,
        fallbackMessage: (id) => `Label for ${id} used fallback placement.`
      }
    });
    const problems = candidate ? labelProblems(scene, context, edge, candidate, retained) : ["no-candidate"];
    if (!candidate || problems.length > 0) {
      diagnostics.push(createRoutingDiagnostic(
        "renderer.routing.ui_contracts_edge_label_unresolved",
        `Label for ${edge.id} remains obstructed: ${problems.join(", ")}.`, edge.id, "error"
      ));
      retained.push({ id: edge.id, box: edge.label! });
    } else {
      replacementById.set(edge.id, candidate);
      retained.push({ id: edge.id, box: candidate });
    }
  }
  return {
    ...scene,
    edges: scene.edges.map((edge) => replacementById.has(edge.id)
      ? { ...edge, label: replacementById.get(edge.id) } : edge),
    diagnostics: sortRendererDiagnostics([...scene.diagnostics, ...diagnostics])
  };
}

/** Read-only audit of the exact scene about to be serialized. */
export function auditUiContractsFinalScene(scene: PositionedScene): RendererDiagnostic[] {
  const context = buildContext(scene);
  const diagnostics: RendererDiagnostic[] = [];
  for (const violation of validateUiContractsRoutes(scene)) {
    diagnostics.push(createRoutingDiagnostic(
      `renderer.routing.ui_contracts_${violation.kind}`,
      violation.message, violation.connectorIds[0] ?? scene.viewId, "error"
    ));
  }
  const visited: Array<{ id: string; box: LabelBox }> = [];
  for (const edge of scene.edges) {
    if (!edge.label) continue;
    for (const problem of labelProblems(scene, context, edge, edge.label, visited)) {
      diagnostics.push(createRoutingDiagnostic(
        `renderer.routing.ui_contracts_label_${problem.split(":")[0]}`,
        `Label for ${edge.id} conflicts with ${problem}.`, edge.id, "error"
      ));
    }
    visited.push({ id: edge.id, box: edge.label });
  }
  return sortRendererDiagnostics(diagnostics);
}
