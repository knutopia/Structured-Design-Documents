import type {
  MeasuredPort,
  Point,
  PositionedContainer,
  PositionedEdge,
  PositionedItem,
  PositionedNode,
  PositionedScene,
  PortSide
} from "./contracts.js";
import { createRoutingDiagnostic, sortRendererDiagnostics, type RendererDiagnostic } from "./diagnostics.js";
import { markerRoutingClearance } from "./markerGeometry.js";
import { resolveRendererTheme } from "./theme.js";
import {
  runRoutingLifecycle,
  buildPortCorridorCandidates,
  validateFinalRouteSet,
  validatePositionedSceneRouting,
  type FinalRoutingContext,
  type FinalRoutingConnector,
  type FinalRoutingEndpoint
} from "./routingCore/index.js";
import { DEFAULT_ROUTING_POLICY, type RoutingBox } from "./routingCore/contracts.js";
import {
  compareRouteCosts,
  resolveHorizontalSharedY,
  routeCost,
  routeCrossings,
  swapSouthboundSourceAttachments
} from "./routingCore/optimization.js";

function flattenItems(item: PositionedItem): PositionedItem[] {
  return [item, ...(item.kind === "container" ? item.children.flatMap(flattenItems) : [])];
}

function collectNodeBoxes(root: PositionedContainer): RoutingBox[] {
  return flattenItems(root)
    .filter((item): item is PositionedItem & { kind: "node" } => item.kind === "node")
    .map((node) => ({ id: node.id, x: node.x, y: node.y, width: node.width, height: node.height }));
}


const EPSILON = DEFAULT_ROUTING_POLICY.epsilon;
const BOTTOM_PORT_SEPARATION = DEFAULT_ROUTING_POLICY.minSeparation;

function clonePositionedItem(item: PositionedItem): PositionedItem {
  if (item.kind === "node") {
    return { ...item, ports: item.ports.map((port) => ({ ...port })) };
  }
  return {
    ...item,
    ports: item.ports.map((port) => ({ ...port })),
    children: item.children.map(clonePositionedItem),
    headerContent: item.headerContent.map((block) => ({ ...block }))
  };
}

function clonePositionedScene(scene: PositionedScene): PositionedScene {
  return {
    ...scene,
    root: clonePositionedItem(scene.root) as PositionedContainer,
    edges: scene.edges.map((edge) => ({
      ...edge,
      from: { ...edge.from },
      to: { ...edge.to },
      route: { ...edge.route, points: edge.route.points.map((point) => ({ ...point })) },
      label: edge.label ? { ...edge.label, lines: [...edge.label.lines] } : undefined,
      classes: [...edge.classes]
    }))
  };
}

function collectPositionedNodes(root: PositionedContainer): Map<string, PositionedNode> {
  return new Map(flattenItems(root)
    .filter((item): item is PositionedNode => item.kind === "node")
    .map((node) => [node.id, node] as const));
}

function horizontalSide(side: PortSide): side is "east" | "west" {
  return side === "east" || side === "west";
}

function pointOnPort(item: PositionedNode, port: MeasuredPort): Point {
  return { x: item.x + port.x, y: item.y + port.y };
}

function setPortCrossAxis(item: PositionedNode, portId: string, y: number): Point | undefined {
  const port = item.ports.find((candidate) => candidate.id === portId);
  if (!port || !horizontalSide(port.side)) return undefined;
  const offset = y - item.y;
  if (offset < -EPSILON || offset > item.height + EPSILON) return undefined;
  port.offset = offset;
  port.y = offset;
  return pointOnPort(item, port);
}

function segmentCrossesNodeInterior(start: Point, end: Point, box: RoutingBox): boolean {
  if (Math.abs(start.y - end.y) <= EPSILON) {
    const y = start.y;
    return y > box.y + EPSILON && y < box.y + box.height - EPSILON
      && Math.min(start.x, end.x) < box.x + box.width - EPSILON
      && Math.max(start.x, end.x) > box.x + EPSILON;
  }
  if (Math.abs(start.x - end.x) <= EPSILON) {
    const x = start.x;
    return x > box.x + EPSILON && x < box.x + box.width - EPSILON
      && Math.min(start.y, end.y) < box.y + box.height - EPSILON
      && Math.max(start.y, end.y) > box.y + EPSILON;
  }
  return true;
}

function isPlainNodeTransition(edge: PositionedEdge, nodes: ReadonlyMap<string, PositionedNode>): boolean {
  return edge.role === "transition"
    && nodes.has(edge.from.itemId)
    && nodes.has(edge.to.itemId)
    && edge.from.itemId !== edge.to.itemId;
}

/** Align one fan-out/fan-in singleton with its multi-connector counterpart. */
function alignHorizontalTransitions(scene: PositionedScene): { scene: PositionedScene; changedEdgeIds: Set<string> } {
  const result = clonePositionedScene(scene);
  const nodes = collectPositionedNodes(result.root);
  const candidates = result.edges.filter((edge) => {
    if (!isPlainNodeTransition(edge, nodes)) return false;
    return deriveSideFromRoute(edge.route, "source") === "east"
      && deriveSideFromRoute(edge.route, "target") === "west";
  });
  const sideCounts = new Map<string, number>();
  for (const edge of candidates) {
    const sourceSide = deriveSideFromRoute(edge.route, "source");
    const targetSide = deriveSideFromRoute(edge.route, "target");
    sideCounts.set(edge.from.itemId + ":" + sourceSide, (sideCounts.get(edge.from.itemId + ":" + sourceSide) ?? 0) + 1);
    sideCounts.set(edge.to.itemId + ":" + targetSide, (sideCounts.get(edge.to.itemId + ":" + targetSide) ?? 0) + 1);
  }
  const boxes = collectNodeBoxes(result.root);
  const changedEdgeIds = new Set<string>();
  for (const edge of candidates) {
    const source = nodes.get(edge.from.itemId)!;
    const target = nodes.get(edge.to.itemId)!;
    const sourceCount = sideCounts.get(source.id + ":east") ?? 0;
    const targetCount = sideCounts.get(target.id + ":west") ?? 0;
    if ((sourceCount > 1) === (targetCount > 1)) continue;
    const sharedY = resolveHorizontalSharedY({
      source,
      target,
      sourcePoint: edge.from,
      targetPoint: edge.to,
      sourceCount,
      targetCount,
      blocked: (start, end) => boxes.some((box) =>
        box.id !== source.id && box.id !== target.id && segmentCrossesNodeInterior(start, end, box))
    });
    if (sharedY === undefined) continue;
    const start = { x: source.x + source.width, y: sharedY };
    const end = { x: target.x, y: sharedY };
    const singletonItem = sourceCount === 1 ? source : target;
    const singletonEndpoint = sourceCount === 1 ? edge.from : edge.to;
    const point = setPortCrossAxis(singletonItem, singletonEndpoint.portId ?? "", sharedY);
    if (!point) continue;
    if (sourceCount === 1) edge.from = { ...edge.from, x: point.x, y: point.y };
    else edge.to = { ...edge.to, x: point.x, y: point.y };
    edge.route = { style: "orthogonal", points: [start, end] };
    changedEdgeIds.add(edge.id);
  }
  return { scene: result, changedEdgeIds };
}

interface BottomPortAllocation { portId: string; point: Point }

function allocateBottomPorts(
  candidates: readonly PositionedEdge[],
  nodes: ReadonlyMap<string, PositionedNode>
): Map<string, BottomPortAllocation> {
  const bySource = new Map<string, PositionedEdge[]>();
  for (const edge of candidates) {
    const source = nodes.get(edge.from.itemId);
    const target = nodes.get(edge.to.itemId);
    if (!source || !target) continue;
    const targetBelowOrBack = target.y + target.height / 2 > source.y + source.height / 2 + EPSILON
      || target.x + target.width / 2 < source.x + source.width / 2 - EPSILON;
    if (!targetBelowOrBack || deriveSideFromRoute(edge.route, "source") !== "east" || deriveSideFromRoute(edge.route, "target") !== "west") continue;
    const group = bySource.get(source.id) ?? [];
    group.push(edge);
    bySource.set(source.id, group);
  }
  const allocations = new Map<string, BottomPortAllocation>();
  for (const [sourceId, edges] of bySource) {
    const source = nodes.get(sourceId)!;
    const existing = source.ports.find((port) => port.side === "south");
    if (!existing) continue;
    const ports = edges.length === 1
      ? [{ id: existing.id, offset: existing.offset ?? source.width / 2 }]
      : edges.map((_, index) => ({
        id: source.id + ":ui-routing-south:" + index,
        offset: Math.max(16, Math.min(source.width - 16,
          source.width / 2 + (index - (edges.length - 1) / 2) * BOTTOM_PORT_SEPARATION))
      }));
    for (const port of ports) {
      const current = source.ports.find((candidate) => candidate.id === port.id);
      if (current) {
        current.offset = port.offset;
        current.x = port.offset;
        current.y = source.height;
      } else {
        source.ports.push({ ...existing, id: port.id, offset: port.offset, x: port.offset, y: source.height });
      }
    }
    edges.forEach((edge, index) => {
      const port = ports[index]!;
      allocations.set(edge.id, { portId: port.id, point: { x: source.x + port.offset, y: source.y + source.height } });
    });
  }
  return allocations;
}

function selectUiBottomExits(
  scene: PositionedScene,
  initialContext: FinalRoutingContext,
  allocations: ReadonlyMap<string, BottomPortAllocation>
): { scene: PositionedScene; context: FinalRoutingContext; changedEdgeIds: Set<string> } {
  let workingScene = scene;
  let workingContext = initialContext;
  const changedEdgeIds = new Set<string>();
  const candidates = workingScene.edges
    .filter((edge) => allocations.has(edge.id))
    .sort((left, right) => left.id.localeCompare(right.id));
  for (const edge of candidates) {
    const allocation = allocations.get(edge.id)!;
    const current = workingContext.connectors.find((connector) => connector.id === edge.id);
    if (!current || current.source.side !== "east" || current.target.side !== "west") continue;
    const sourcePoint = allocation.point;
    const targetPoint = current.target.point;
    const initialRoute = {
      style: "orthogonal" as const,
      points: [
        sourcePoint,
        { x: sourcePoint.x, y: targetPoint.y },
        targetPoint
      ]
    };
    const trialConnector: FinalRoutingConnector = {
      ...current,
      source: { ...current.source, side: "south", point: sourcePoint },
      route: initialRoute
    };
    const trialBase: FinalRoutingContext = {
      ...workingContext,
      connectors: workingContext.connectors.map((connector) =>
        connector.id === edge.id ? trialConnector : connector)
    };
    const baselineViolations = validateFinalRouteSet(workingContext);
    const baselineScore = [
      baselineViolations.length,
      ...routeCost(workingContext.connectors)
    ];
    let bestContext = trialBase;
    let bestScore: number[] = [
      validateFinalRouteSet(trialBase).length,
      ...routeCost(trialBase.connectors)
    ];
    const candidatesForRoute = [
      initialRoute.points,
      ...buildPortCorridorCandidates(trialConnector, trialBase)
    ];
    for (const points of candidatesForRoute.slice(0, 65)) {
      const candidateContext: FinalRoutingContext = {
        ...trialBase,
        connectors: trialBase.connectors.map((connector) => connector.id === edge.id
          ? { ...connector, route: { style: "orthogonal", points } }
          : connector)
      };
      const violations = validateFinalRouteSet(candidateContext);
      const score = [violations.length, ...routeCost(candidateContext.connectors)];
      if (compareRouteCosts(score, bestScore) < 0) {
        bestContext = candidateContext;
        bestScore = score;
      }
    }
    if (compareRouteCosts(bestScore, baselineScore) >= 0) continue;
    const selected = bestContext.connectors.find((connector) => connector.id === edge.id)!;
    workingContext = bestContext;
    workingScene = {
      ...workingScene,
      edges: workingScene.edges.map((candidate) => candidate.id === edge.id
        ? {
            ...candidate,
            from: { ...candidate.from, portId: allocation.portId, x: sourcePoint.x, y: sourcePoint.y },
            route: { ...selected.route, points: selected.route.points.map((point) => ({ ...point })) }
          }
        : candidate)
    };
    changedEdgeIds.add(edge.id);
  }
  return { scene: workingScene, context: workingContext, changedEdgeIds };
}

interface SouthExitSwapCandidate {
  leftId: string;
  rightId: string;
  context: FinalRoutingContext;
}

/** Reorder selected south ports where an atomic swap removes route crossings. */
function optimizeSouthExitAssignments(
  scene: PositionedScene,
  initialContext: FinalRoutingContext,
  nodes: ReadonlyMap<string, PositionedNode>
): { scene: PositionedScene; context: FinalRoutingContext; changedEdgeIds: Set<string> } {
  let workingScene = scene;
  let workingContext = initialContext;
  const changedEdgeIds = new Set<string>();

  while (true) {
    const bySource = new Map<string, PositionedEdge[]>();
    for (const edge of workingScene.edges) {
      if (!isPlainNodeTransition(edge, nodes)) continue;
      const connector = workingContext.connectors.find((candidate) => candidate.id === edge.id);
      if (!connector || connector.source.side !== "south") continue;
      const source = nodes.get(edge.from.itemId);
      const port = source?.ports.find((candidate) => candidate.id === edge.from.portId && candidate.side === "south");
      if (!source || !port) continue;
      const group = bySource.get(source.id) ?? [];
      group.push(edge);
      bySource.set(source.id, group);
    }

    const baselineViolations = validateFinalRouteSet(workingContext);
    const baselineCost = routeCost(workingContext.connectors);
    let best: SouthExitSwapCandidate | undefined;
    let bestScore: number[] | undefined;
    for (const [sourceId, edges] of bySource) {
      if (edges.length < 2) continue;
      edges.sort((left, right) => left.id.localeCompare(right.id));
      const source = nodes.get(sourceId)!;
      const sourceRows = edges.map((edge) => {
        const port = source.ports.find((candidate) => candidate.id === edge.from.portId)!;
        return { edge, port, point: pointOnPort(source, port) };
      });
      const occupiedRows = workingContext.connectors.flatMap((connector) => {
        if (connector.source.nodeId !== sourceId || connector.source.side !== "south") return [];
        const edge = workingScene.edges.find((candidate) => candidate.id === connector.id);
        const port = edge && source.ports.find((candidate) =>
          candidate.id === edge.from.portId && candidate.side === "south");
        return port ? [{ point: pointOnPort(source, port) }] : [];
      });
      const offsets = occupiedRows.map(({ point }) => point.x - source.x).sort((a, b) => a - b);
      const cornerClearance = DEFAULT_ROUTING_POLICY.minSeparation;
      if (offsets.some((offset, index) =>
        offset < cornerClearance - EPSILON
        || offset > source.width - cornerClearance + EPSILON
        || (index > 0 && offset - offsets[index - 1]! < DEFAULT_ROUTING_POLICY.minSeparation - EPSILON))) continue;

      for (let leftIndex = 0; leftIndex < sourceRows.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < sourceRows.length; rightIndex += 1) {
          const left = sourceRows[leftIndex]!;
          const right = sourceRows[rightIndex]!;
          if (left.port.id === right.port.id || left.port.role !== right.port.role) continue;
          const proposed = swapSouthboundSourceAttachments(workingContext.connectors, {
            leftConnectorId: left.edge.id,
            rightConnectorId: right.edge.id,
            leftPoint: right.point,
            rightPoint: left.point
          });
          if (!proposed) continue;
          const trialViolations = validateFinalRouteSet({ ...workingContext, connectors: proposed });
          const changed = new Set([left.edge.id, right.edge.id]);
          if (trialViolations.some((violation) => violation.connectorIds.some((id) => changed.has(id)))) continue;
          const baselineCounts = new Map<string, number>();
          for (const violation of baselineViolations) {
            const key = JSON.stringify([violation.kind, [...violation.connectorIds].sort(), violation.boxId ?? ""]);
            baselineCounts.set(key, (baselineCounts.get(key) ?? 0) + 1);
          }
          let introducedViolation = false;
          for (const violation of trialViolations) {
            const key = JSON.stringify([violation.kind, [...violation.connectorIds].sort(), violation.boxId ?? ""]);
            const count = baselineCounts.get(key) ?? 0;
            if (count === 0) {
              introducedViolation = true;
              break;
            }
            baselineCounts.set(key, count - 1);
          }
          if (introducedViolation) continue;

          const candidateContext: FinalRoutingContext = { ...workingContext, connectors: proposed };
          const trialCost = routeCost(proposed);
          if (trialCost[0] >= baselineCost[0]) continue;
          const unaffected = workingContext.connectors.filter((connector) => !changed.has(connector.id));
          if (unaffected.some((connector) =>
            routeCrossings(proposed.find((candidate) => candidate.id === left.edge.id)!, connector)
              > routeCrossings(workingContext.connectors.find((candidate) => candidate.id === left.edge.id)!, connector)
            || routeCrossings(proposed.find((candidate) => candidate.id === right.edge.id)!, connector)
              > routeCrossings(workingContext.connectors.find((candidate) => candidate.id === right.edge.id)!, connector))) continue;

          const score = [...trialCost];
          const order = bestScore ? compareRouteCosts(score, bestScore) : -1;
          const stableTie = order === 0 && best !== undefined
            && `${left.edge.id}\u0000${right.edge.id}` < `${best.leftId}\u0000${best.rightId}`;
          if (!bestScore || order < 0 || stableTie) {
            best = { leftId: left.edge.id, rightId: right.edge.id, context: candidateContext };
            bestScore = score;
          }
        }
      }
    }

    if (!best) break;
    const changed = new Set([best.leftId, best.rightId]);
    const connectorById = new Map(best.context.connectors.map((connector) => [connector.id, connector] as const));
    const edgeById = new Map(workingScene.edges.map((edge) => [edge.id, edge] as const));
    workingScene = {
      ...workingScene,
      edges: workingScene.edges.map((edge) => {
        if (!changed.has(edge.id)) return edge;
        const connector = connectorById.get(edge.id)!;
        const otherId = edge.id === best!.leftId ? best!.rightId : best!.leftId;
        const other = edgeById.get(otherId)!;
        return {
          ...edge,
          from: { ...edge.from, portId: other.from.portId, x: connector.source.point.x, y: connector.source.point.y },
          route: { ...connector.route, points: connector.route.points.map((point) => ({ ...point })) }
        };
      })
    };
    workingContext = best.context;
    for (const id of changed) changedEdgeIds.add(id);
  }

  return { scene: workingScene, context: workingContext, changedEdgeIds };
}

/**
 * Derives the endpoint side from the route's actual terminal segment direction.
 * This is more robust than the port's declared side for ui_contracts, whose
 * return-channel edges route through frame ports whose declared side does not
 * always match the actual departure direction.
 */
function deriveSideFromRoute(route: PositionedEdge["route"], role: "source" | "target"): PortSide {
  const points = route.points;
  const endpoint = role === "source" ? points[0]! : points[points.length - 1]!;
  const neighbour = role === "source" ? points[1]! : points[points.length - 2]!;
  const dx = neighbour.x - endpoint.x;
  const dy = neighbour.y - endpoint.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "east" : "west";
  }
  return dy >= 0 ? "south" : "north";
}

function buildEndpoint(
  root: PositionedContainer,
  edge: PositionedEdge,
  role: "source" | "target",
  arrowSize: number,
  strokeWidth: number
): FinalRoutingEndpoint {
  const endpoint = role === "source" ? edge.from : edge.to;
  const marker = role === "source" ? edge.markers?.start : edge.markers?.end;
  return {
    point: { x: endpoint.x, y: endpoint.y },
    side: deriveSideFromRoute(edge.route, role),
    nodeId: endpoint.itemId,
    minLeg: markerRoutingClearance(marker, arrowSize, strokeWidth)
  };
}

/**
 * Routes ui_contracts connectors through the shared final-routing lifecycle.
 *
 * The scene builder already fans out per-connector endpoint offsets; this step
 * resolves residual collinear overlaps and crossings by moving internal segments
 * to distinct coordinates (via the occupancy solver) instead of the greedy
 * first-candidate repair that previously routed connectors the wrong way around.
 */
export function routeUiContractsScene(
  positionedScene: PositionedScene,
  onChangedEdgeIds?: (edgeIds: ReadonlySet<string>) => void
): PositionedScene {
  const theme = resolveRendererTheme(positionedScene.themeId, "routing").theme;
  const aligned = alignHorizontalTransitions(positionedScene);
  let optimizedScene = aligned.scene;
  const nodes = collectPositionedNodes(optimizedScene.root);
  const bottomCandidates = optimizedScene.edges.filter((edge) => isPlainNodeTransition(edge, nodes));
  const allocations = allocateBottomPorts(bottomCandidates, nodes);
  const boxes = collectNodeBoxes(optimizedScene.root);
  const buildContext = (scene: PositionedScene): FinalRoutingContext => ({
    connectors: scene.edges.map((edge, priority) => ({
      id: edge.id,
      route: edge.route,
      source: buildEndpoint(scene.root, edge, "source", theme.paint.arrowSize, theme.paint.edgeStrokeWidth),
      target: buildEndpoint(scene.root, edge, "target", theme.paint.arrowSize, theme.paint.edgeStrokeWidth),
      priority
    })),
    boxes,
    bounds: {
      minX: scene.root.x,
      minY: scene.root.y,
      maxX: scene.root.x + scene.root.width,
      maxY: scene.root.y + scene.root.height
    },
    policy: {
      minSeparation: DEFAULT_ROUTING_POLICY.minSeparation,
      epsilon: DEFAULT_ROUTING_POLICY.epsilon,
      crossingTreatment: "penalize"
    }
  });
  const selectedBottom = selectUiBottomExits(optimizedScene, buildContext(optimizedScene), allocations);
  const southExitOptimized = optimizeSouthExitAssignments(
    selectedBottom.scene, selectedBottom.context, collectPositionedNodes(selectedBottom.scene.root)
  );
  optimizedScene = southExitOptimized.scene;
  const changedEdgeIds = new Set([
    ...aligned.changedEdgeIds,
    ...selectedBottom.changedEdgeIds,
    ...southExitOptimized.changedEdgeIds
  ]);
  const context = southExitOptimized.context;
  onChangedEdgeIds?.(changedEdgeIds);
  const result = runRoutingLifecycle(context);
  const cleanDiagnostics = optimizedScene.diagnostics.filter((diagnostic) =>
    !(diagnostic.code === "renderer.routing.edge_label_segment_fallback"
      && diagnostic.targetId
      && changedEdgeIds.has(diagnostic.targetId)));
  const apply = (routeById: ReadonlyMap<string, PositionedEdge["route"]>, finalContext: FinalRoutingContext): PositionedScene => {
    const connectorById = new Map(finalContext.connectors.map((connector) => [connector.id, connector] as const));
    return {
      ...optimizedScene,
      edges: optimizedScene.edges.map((edge) => {
        const connector = connectorById.get(edge.id);
        const route = routeById.get(edge.id);
        return connector && route
          ? {
              ...edge,
              from: { ...edge.from, x: connector.source.point.x, y: connector.source.point.y },
              to: { ...edge.to, x: connector.target.point.x, y: connector.target.point.y },
              route
            }
          : edge;
      }),
      diagnostics: cleanDiagnostics
    };
  };

  if (result.status === "resolved") {
    return apply(result.routeByConnectorId, result.context);
  }

  const diagnostics: RendererDiagnostic[] = result.violations.map((violation) =>
    createRoutingDiagnostic(
      "renderer.routing.ui_contracts_" + violation.kind,
      violation.message,
      violation.connectorIds[0] ?? "ui_contracts",
      "error"
    )
  );
  return {
    ...optimizedScene,
    diagnostics: sortRendererDiagnostics([...cleanDiagnostics, ...diagnostics])
  };
}

/** Keep intentional terminal sharing identical in the pipeline and final output audit. */
export function validateUiContractsRoutes(scene: PositionedScene) {
  const edgeById = new Map(scene.edges.map((edge) => [edge.id, edge] as const));
  return validatePositionedSceneRouting(scene, {
    policy: {
      allowCollinearOverlap: (leftId, leftIndex, rightId, rightIndex) => {
        const left = edgeById.get(leftId);
        const right = edgeById.get(rightId);
        return left !== undefined && right !== undefined
          && left.to.itemId === right.to.itemId
          && leftIndex === left.route.points.length - 2
          && rightIndex === right.route.points.length - 2;
      }
    }
  });
}
