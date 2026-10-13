import type { EdgeMarkers, PositionedItem, PositionedScene } from "./contracts.js";
import type { FinalRoutingConnector, RoutingBox } from "./routingCore/index.js";
import { DEFAULT_ROUTING_POLICY } from "./routingCore/index.js";
import { arrowMarkerFootprintBox } from "./markerGeometry.js";
import { buildRouteSegmentDetails, type LabelBox } from "./connectorLabelPlacement.js";
import { labelBoxIntersectsSegment, labelBoxesOverlap } from "./labelCollisionGeometry.js";
import { createRoutingDiagnostic, sortRendererDiagnostics, type RendererDiagnostic } from "./diagnostics.js";
import { getRendererTheme } from "./theme.js";

/** Marker direction follows declared port sides, including before route repair. */
export function buildEndpointMarkerRoutingBlockers(
  connectors: readonly FinalRoutingConnector[],
  markersById: ReadonlyMap<string, EdgeMarkers | undefined>,
  arrowSize: number,
  strokeWidth: number
): RoutingBox[] {
  return connectors.flatMap(connector => (["start", "end"] as const).flatMap(end => {
    if (markersById.get(connector.id)?.[end] !== "arrow") return [];
    const endpoint = end === "start" ? connector.source : connector.target;
    const vector = endpoint.side === "north" ? { x: 0, y: -1 } : endpoint.side === "south" ? { x: 0, y: 1 }
      : endpoint.side === "east" ? { x: 1, y: 0 } : { x: -1, y: 0 };
    const box = arrowMarkerFootprintBox(endpoint.point,
      { x: endpoint.point.x + vector.x, y: endpoint.point.y + vector.y }, arrowSize, strokeWidth);
    return box ? [{ ...box, id: `${connector.id}:${end}:marker`,
      clearance: strokeWidth / 2 + DEFAULT_ROUTING_POLICY.epsilon,
      appliesToConnectorIds: connectors.filter(other => other.id !== connector.id).map(other => other.id) }] : [];
  }));
}

/** Audit painted marker footprints independently of route centreline acceptance. */
export function auditPositionedSceneMarkers(scene: PositionedScene): RendererDiagnostic[] {
  const theme = getRendererTheme(scene.themeId, "routing");
  const obstacles: Array<LabelBox & { id: string }> = [];
  const visit = (item: PositionedItem): void => {
    if (item.kind === "node") { obstacles.push(item); return; }
    if ((item.chrome.headerBandHeight ?? 0) > 0) obstacles.push({
      id: `${item.id}:header`, x: item.x, y: item.y, width: item.width, height: item.chrome.headerBandHeight!
    });
    for (const block of item.headerContent) obstacles.push({ id: block.id,
      x: item.x + block.x, y: item.y + block.y, width: block.width, height: block.height });
    item.children.forEach(visit);
  };
  visit(scene.root);
  const markers = scene.edges.flatMap(edge => (["start", "end"] as const).flatMap(end => {
    if (edge.markers?.[end] !== "arrow" || edge.route.points.length < 2) return [];
    const tip = end === "start" ? edge.route.points[0]! : edge.route.points.at(-1)!;
    const neighbor = end === "start" ? edge.route.points[1]! : edge.route.points.at(-2)!;
    const box = arrowMarkerFootprintBox(tip, neighbor, theme.paint.arrowSize, theme.paint.edgeStrokeWidth);
    return box ? [{ ...box, id: `${edge.id}:${end}`, edgeId: edge.id,
      attachedItemId: end === "start" ? edge.from.itemId : edge.to.itemId,
      terminalIndex: end === "start" ? 0 : edge.route.points.length - 2 }] : [];
  }));
  const diagnostics: RendererDiagnostic[] = [];
  const fail = (marker: typeof markers[number], kind: string, obstacleId: string) => diagnostics.push(createRoutingDiagnostic(
    `renderer.routing.marker_${kind}`, `Marker "${marker.id}" conflicts with "${obstacleId}".`, marker.edgeId, "error"
  ));
  const root = scene.root;
  const epsilon = DEFAULT_ROUTING_POLICY.epsilon;
  for (const marker of markers) {
    if (marker.x < root.x - epsilon || marker.y < root.y - epsilon
      || marker.x + marker.width > root.x + root.width + epsilon
      || marker.y + marker.height > root.y + root.height + epsilon) fail(marker, "bounds", root.id);
    // The arrow tip is attached to its own endpoint's boundary. Every other
    // node/header remains solid; container interiors remain routable.
    for (const box of obstacles) if (box.id !== marker.attachedItemId && labelBoxesOverlap(marker, box)) fail(marker, "obstacle", box.id);
    for (const edge of scene.edges) {
      for (const segment of buildRouteSegmentDetails(edge.route)) {
        if (edge.id === marker.edgeId && segment.routeSegmentIndex === marker.terminalIndex) continue;
        if (labelBoxIntersectsSegment(marker, segment)) fail(marker, "connector", edge.id);
      }
      if (edge.label && labelBoxesOverlap(marker, edge.label)) fail(marker, "label", edge.id);
    }
  }
  for (let left = 0; left < markers.length; left++) for (let right = left + 1; right < markers.length; right++) {
    if (labelBoxesOverlap(markers[left]!, markers[right]!)) fail(markers[left]!, "marker", markers[right]!.id);
  }
  return sortRendererDiagnostics(diagnostics);
}
