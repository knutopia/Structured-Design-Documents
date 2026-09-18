import type {
  PositionedContainer,
  PositionedEdge,
  PositionedItem,
  PositionedScene,
  PortSide
} from "./contracts.js";
import { createRoutingDiagnostic, sortRendererDiagnostics, type RendererDiagnostic } from "./diagnostics.js";
import { markerRoutingClearance } from "./markerGeometry.js";
import { resolveRendererTheme } from "./theme.js";
import {
  runRoutingLifecycle,
  type FinalRoutingContext,
  type FinalRoutingConnector,
  type FinalRoutingEndpoint
} from "./routingCore/index.js";
import { DEFAULT_ROUTING_POLICY, type RoutingBox } from "./routingCore/contracts.js";

function flattenItems(item: PositionedItem): PositionedItem[] {
  return [item, ...(item.kind === "container" ? item.children.flatMap(flattenItems) : [])];
}

function collectNodeBoxes(root: PositionedContainer): RoutingBox[] {
  return flattenItems(root)
    .filter((item): item is PositionedItem & { kind: "node" } => item.kind === "node")
    .map((node) => ({ id: node.id, x: node.x, y: node.y, width: node.width, height: node.height }));
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
export function routeUiContractsScene(positionedScene: PositionedScene): PositionedScene {
  const theme = resolveRendererTheme(positionedScene.themeId, "routing").theme;
  const boxes = collectNodeBoxes(positionedScene.root);
  const connectors: FinalRoutingConnector[] = positionedScene.edges.map((edge, priority) => ({
    id: edge.id,
    route: edge.route,
    source: buildEndpoint(positionedScene.root, edge, "source", theme.paint.arrowSize, theme.paint.edgeStrokeWidth),
    target: buildEndpoint(positionedScene.root, edge, "target", theme.paint.arrowSize, theme.paint.edgeStrokeWidth),
    priority
  }));

  const context: FinalRoutingContext = {
    connectors,
    boxes,
    bounds: {
      minX: positionedScene.root.x,
      minY: positionedScene.root.y,
      maxX: positionedScene.root.x + positionedScene.root.width,
      maxY: positionedScene.root.y + positionedScene.root.height
    },
    policy: {
      minSeparation: DEFAULT_ROUTING_POLICY.minSeparation,
      epsilon: DEFAULT_ROUTING_POLICY.epsilon,
      crossingTreatment: "penalize"
    }
  };

  const result = runRoutingLifecycle(context);

  if (result.status === "resolved") {
    const routeById = result.routeByConnectorId;
    return {
      ...positionedScene,
      edges: positionedScene.edges.map((edge) => {
        const route = routeById.get(edge.id);
        return route ? { ...edge, route } : edge;
      })
    };
  }

  const diagnostics: RendererDiagnostic[] = result.violations.map((violation) =>
    createRoutingDiagnostic(
      `renderer.routing.ui_contracts_${violation.kind}`,
      violation.message,
      violation.connectorIds[0] ?? "ui_contracts",
      "error"
    )
  );
  return {
    ...positionedScene,
    diagnostics: sortRendererDiagnostics([...positionedScene.diagnostics, ...diagnostics])
  };
}
