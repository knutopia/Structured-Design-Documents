import type {
  MeasuredEdge,
  MeasuredEdgeEndpoint,
  MeasuredPort,
  PortSide,
  Point,
  PositionedContainer,
  PositionedEdgeEndpoint,
  PositionedEdgeLabel,
  PositionedItem,
  PositionedRoute
} from "./contracts.js";
import type { RendererDiagnostic, RendererDiagnosticSeverity } from "./diagnostics.js";

export interface IndexedPositionedItem {
  item: PositionedItem;
  portsById: Map<string, MeasuredPort>;
}

interface ResolvedEdgeEndpoint extends PositionedEdgeEndpoint {
  side?: PortSide;
}

const EDGE_LABEL_SEGMENT_CLEARANCE = 12;
const EDGE_LABEL_SEGMENT_OFFSET = 12;

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function createRoutingDiagnostic(
  code: string,
  message: string,
  targetId: string,
  severity: RendererDiagnosticSeverity = "warn"
): RendererDiagnostic {
  return {
    phase: "routing",
    code,
    severity,
    message,
    targetId
  };
}

function cloneMeasuredPort(port: MeasuredPort): MeasuredPort {
  return {
    id: port.id,
    role: port.role,
    side: port.side,
    offset: port.offset,
    offsetPolicy: port.offsetPolicy,
    x: port.x,
    y: port.y
  };
}

export function buildPositionedIndex(
  container: PositionedContainer,
  index = new Map<string, IndexedPositionedItem>()
): Map<string, IndexedPositionedItem> {
  index.set(container.id, {
    item: container,
    portsById: new Map(container.ports.map((port) => [port.id, port]))
  });

  for (const child of container.children) {
    if (child.kind === "container") {
      buildPositionedIndex(child, index);
      continue;
    }

    index.set(child.id, {
      item: child,
      portsById: new Map(child.ports.map((port) => [port.id, port]))
    });
  }

  return index;
}

function getItemCenter(item: PositionedItem): Point {
  return {
    x: roundMetric(item.x + item.width / 2),
    y: roundMetric(item.y + item.height / 2)
  };
}

function getPortAbsolutePoint(item: PositionedItem, port: MeasuredPort): Point {
  return {
    x: roundMetric(item.x + port.x),
    y: roundMetric(item.y + port.y)
  };
}

function chooseFallbackSide(
  item: PositionedItem,
  oppositeItem: PositionedItem | undefined,
  preferAxis: MeasuredEdge["routing"]["preferAxis"]
): MeasuredPort["side"] {
  if (!oppositeItem) {
    if (preferAxis === "vertical") {
      return "south";
    }

    return "east";
  }

  const itemCenter = getItemCenter(item);
  const oppositeCenter = getItemCenter(oppositeItem);
  const dx = oppositeCenter.x - itemCenter.x;
  const dy = oppositeCenter.y - itemCenter.y;

  if (preferAxis === "horizontal" || (preferAxis === undefined && Math.abs(dx) >= Math.abs(dy))) {
    return dx >= 0 ? "east" : "west";
  }

  return dy >= 0 ? "south" : "north";
}

function getFallbackAnchor(item: PositionedItem, side: MeasuredPort["side"]): Point {
  switch (side) {
    case "north":
      return {
        x: roundMetric(item.x + item.width / 2),
        y: roundMetric(item.y)
      };
    case "south":
      return {
        x: roundMetric(item.x + item.width / 2),
        y: roundMetric(item.y + item.height)
      };
    case "east":
      return {
        x: roundMetric(item.x + item.width),
        y: roundMetric(item.y + item.height / 2)
      };
    case "west":
      return {
        x: roundMetric(item.x),
        y: roundMetric(item.y + item.height / 2)
      };
  }
}

function findPortByRole(item: Pick<PositionedItem, "ports">, role: string): MeasuredPort | undefined {
  return item.ports.find((port) => port.role === role);
}

export function resolvePortOnItem(
  item: Pick<PositionedItem, "ports">,
  endpoint: Pick<MeasuredEdgeEndpoint, "portId">,
  preferredRole: string | undefined
): MeasuredPort | undefined {
  if (endpoint.portId) {
    const explicitPort = item.ports.find((port) => port.id === endpoint.portId);
    if (explicitPort) {
      return cloneMeasuredPort(explicitPort);
    }
  }

  if (!preferredRole) {
    return undefined;
  }

  const rolePort = findPortByRole(item, preferredRole);
  return rolePort ? cloneMeasuredPort(rolePort) : undefined;
}

function resolveEndpointPort(
  endpoint: MeasuredEdgeEndpoint,
  preferredRole: string | undefined,
  edgeId: string,
  indexedItem: IndexedPositionedItem,
  oppositeItem: PositionedItem | undefined,
  preferAxis: MeasuredEdge["routing"]["preferAxis"],
  diagnostics: RendererDiagnostic[]
): ResolvedEdgeEndpoint {
  if (endpoint.portId) {
    const explicitPort = indexedItem.portsById.get(endpoint.portId);
    if (explicitPort) {
      const point = getPortAbsolutePoint(indexedItem.item, explicitPort);
      return {
        itemId: endpoint.itemId,
        portId: explicitPort.id,
        side: explicitPort.side,
        x: point.x,
        y: point.y
      };
    }

    diagnostics.push(
      createRoutingDiagnostic(
        "renderer.routing.unresolved_port",
        `Could not resolve port "${endpoint.portId}" on item "${endpoint.itemId}". Falling back to another anchor.`,
        edgeId
      )
    );
  }

  if (preferredRole) {
    const rolePort = findPortByRole(indexedItem.item, preferredRole);
    if (rolePort) {
      const point = getPortAbsolutePoint(indexedItem.item, rolePort);
      return {
        itemId: endpoint.itemId,
        portId: rolePort.id,
        side: rolePort.side,
        x: point.x,
        y: point.y
      };
    }

    diagnostics.push(
      createRoutingDiagnostic(
        "renderer.routing.unresolved_port_role",
        `Could not resolve port role "${preferredRole}" on item "${endpoint.itemId}". Falling back to a box anchor.`,
        edgeId,
        "info"
      )
    );
  }

  const side = chooseFallbackSide(indexedItem.item, oppositeItem, preferAxis);
  const point = getFallbackAnchor(indexedItem.item, side);
  return {
    itemId: endpoint.itemId,
    portId: undefined,
    side,
    x: point.x,
    y: point.y
  };
}

export function resolveEdgeEndpoint(
  endpoint: MeasuredEdgeEndpoint,
  preferredRole: string | undefined,
  edgeId: string,
  index: ReadonlyMap<string, IndexedPositionedItem>,
  oppositeItem: PositionedItem | undefined,
  preferAxis: MeasuredEdge["routing"]["preferAxis"],
  diagnostics: RendererDiagnostic[]
): ResolvedEdgeEndpoint {
  const indexedItem = index.get(endpoint.itemId);
  if (!indexedItem) {
    diagnostics.push(
      createRoutingDiagnostic(
        "renderer.routing.unresolved_item",
        `Could not resolve routed item "${endpoint.itemId}". Falling back to the scene origin.`,
        edgeId,
        "error"
      )
    );
    return {
      itemId: endpoint.itemId,
      portId: endpoint.portId,
      side: undefined,
      x: 0,
      y: 0
    };
  }

  return resolveEndpointPort(
    endpoint,
    preferredRole,
    edgeId,
    indexedItem,
    oppositeItem,
    preferAxis,
    diagnostics
  );
}

export function collapseRoutePoints(points: Point[]): Point[] {
  const deduped: Point[] = [];

  for (const point of points) {
    const rounded = {
      x: roundMetric(point.x),
      y: roundMetric(point.y)
    };
    const last = deduped[deduped.length - 1];
    if (!last || last.x !== rounded.x || last.y !== rounded.y) {
      deduped.push(rounded);
    }
  }

  const collapsed: Point[] = [];
  for (const point of deduped) {
    collapsed.push(point);
    while (collapsed.length >= 3) {
      const tail = collapsed.length - 1;
      const previous = collapsed[tail - 2];
      const current = collapsed[tail - 1];
      const next = collapsed[tail];
      const isCollinearHorizontal = previous.y === current.y && current.y === next.y;
      const isCollinearVertical = previous.x === current.x && current.x === next.x;
      if (!isCollinearHorizontal && !isCollinearVertical) {
        break;
      }

      collapsed.splice(tail - 1, 1);
    }
  }

  if (collapsed.length === 1) {
    collapsed.push({
      ...collapsed[0]
    });
  }

  return collapsed;
}

function isHorizontalSide(side: PortSide | undefined): side is "east" | "west" {
  return side === "east" || side === "west";
}

function isVerticalSide(side: PortSide | undefined): side is "north" | "south" {
  return side === "north" || side === "south";
}

function resolveOrthogonalBendCoordinate(
  fromCoordinate: number,
  toCoordinate: number
): number {
  return roundMetric((fromCoordinate + toCoordinate) / 2);
}

function buildOrthogonalRoutePoints(
  from: ResolvedEdgeEndpoint,
  to: ResolvedEdgeEndpoint,
  preferAxis: MeasuredEdge["routing"]["preferAxis"]
): Point[] {
  if (from.x === to.x || from.y === to.y) {
    return [
      { x: from.x, y: from.y },
      { x: to.x, y: to.y }
    ];
  }

  if (isHorizontalSide(from.side) && isHorizontalSide(to.side)) {
    const bendX = resolveOrthogonalBendCoordinate(from.x, to.x);
    return [
      { x: from.x, y: from.y },
      { x: bendX, y: from.y },
      { x: bendX, y: to.y },
      { x: to.x, y: to.y }
    ];
  }

  if (isVerticalSide(from.side) && isVerticalSide(to.side)) {
    const bendY = resolveOrthogonalBendCoordinate(from.y, to.y);
    return [
      { x: from.x, y: from.y },
      { x: from.x, y: bendY },
      { x: to.x, y: bendY },
      { x: to.x, y: to.y }
    ];
  }

  return preferAxis === "horizontal"
    ? [
        { x: from.x, y: from.y },
        { x: to.x, y: from.y },
        { x: to.x, y: to.y }
      ]
    : [
        { x: from.x, y: from.y },
        { x: from.x, y: to.y },
        { x: to.x, y: to.y }
      ];
}

function buildSharedRoutePoints(
  edge: MeasuredEdge,
  from: ResolvedEdgeEndpoint,
  to: ResolvedEdgeEndpoint
): Point[] {
  if (edge.routing.style === "straight") {
    return [
      { x: from.x, y: from.y },
      { x: to.x, y: to.y }
    ];
  }

  const preferAxis = edge.routing.preferAxis
    ?? (Math.abs(to.x - from.x) >= Math.abs(to.y - from.y) ? "horizontal" : "vertical");

  if (edge.routing.style === "stepped") {
    return preferAxis === "horizontal"
      ? [
          { x: from.x, y: from.y },
          { x: to.x, y: from.y },
          { x: to.x, y: to.y }
        ]
      : [
          { x: from.x, y: from.y },
          { x: from.x, y: to.y },
          { x: to.x, y: to.y }
        ];
  }

  return buildOrthogonalRoutePoints(from, to, preferAxis);
}

export function buildSharedRoute(
  edge: MeasuredEdge,
  from: ResolvedEdgeEndpoint,
  to: ResolvedEdgeEndpoint
): PositionedRoute {
  return {
    style: edge.routing.style,
    points: collapseRoutePoints(
      buildSharedRoutePoints(edge, from, to)
    )
  };
}

export function buildRouteFromLocalHint(
  edge: MeasuredEdge,
  from: ResolvedEdgeEndpoint,
  to: ResolvedEdgeEndpoint,
  owner: PositionedContainer,
  localPoints: Point[]
): PositionedRoute {
  const middlePoints = localPoints
    .slice(1, -1)
    .map((point) => ({
      x: roundMetric(owner.x + point.x),
      y: roundMetric(owner.y + point.y)
    }));

  return {
    style: edge.routing.style,
    points: collapseRoutePoints([
      { x: from.x, y: from.y },
      ...middlePoints,
      { x: to.x, y: to.y }
    ])
  };
}

function getPolylineLength(points: Point[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    total += Math.hypot(current.x - previous.x, current.y - previous.y);
  }
  return total;
}

interface RouteSegment {
  start: Point;
  end: Point;
  length: number;
  orientation: "horizontal" | "vertical";
}

function getRouteSegments(route: PositionedRoute): RouteSegment[] {
  const segments: RouteSegment[] = [];

  for (let index = 1; index < route.points.length; index += 1) {
    const start = route.points[index - 1];
    const end = route.points[index];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) {
      continue;
    }

    segments.push({
      start,
      end,
      length: roundMetric(length),
      orientation: Math.abs(dx) >= Math.abs(dy) ? "horizontal" : "vertical"
    });
  }

  return segments;
}

function getPointAtDistance(points: Point[], distance: number): Point {
  if (points.length === 0) {
    return { x: 0, y: 0 };
  }

  let traversed = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const segment = Math.hypot(current.x - previous.x, current.y - previous.y);
    if (segment === 0) {
      continue;
    }
    if (traversed + segment >= distance) {
      const ratio = (distance - traversed) / segment;
      return {
        x: roundMetric(previous.x + (current.x - previous.x) * ratio),
        y: roundMetric(previous.y + (current.y - previous.y) * ratio)
      };
    }
    traversed += segment;
  }

  return {
    ...points[points.length - 1]
  };
}

function chooseLabelSegment(
  label: NonNullable<MeasuredEdge["label"]>,
  route: PositionedRoute
): RouteSegment | undefined {
  const segments = getRouteSegments(route);
  const usableSegments = segments.filter((segment) => {
    const requiredLength = segment.orientation === "horizontal"
      ? label.width + EDGE_LABEL_SEGMENT_CLEARANCE
      : label.height + EDGE_LABEL_SEGMENT_CLEARANCE;
    return segment.length >= requiredLength;
  });

  if (usableSegments.length === 0) {
    return undefined;
  }

  return usableSegments.reduce((selected, candidate) =>
    candidate.length > selected.length ? candidate : selected
  );
}

export function positionEdgeLabel(
  label: NonNullable<MeasuredEdge["label"]>,
  route: PositionedRoute,
  diagnostics?: RendererDiagnostic[],
  edgeId?: string
): PositionedEdgeLabel {
  const segment = chooseLabelSegment(label, route);
  if (segment) {
    const midpoint = {
      x: roundMetric((segment.start.x + segment.end.x) / 2),
      y: roundMetric((segment.start.y + segment.end.y) / 2)
    };

    return segment.orientation === "horizontal"
      ? {
          lines: [...label.lines],
          width: label.width,
          height: label.height,
          lineHeight: label.lineHeight,
          textStyleRole: label.textStyleRole,
          x: roundMetric(midpoint.x - label.width / 2),
          y: roundMetric(midpoint.y - label.height - EDGE_LABEL_SEGMENT_OFFSET)
        }
      : {
          lines: [...label.lines],
          width: label.width,
          height: label.height,
          lineHeight: label.lineHeight,
          textStyleRole: label.textStyleRole,
          x: roundMetric(midpoint.x + EDGE_LABEL_SEGMENT_OFFSET),
          y: roundMetric(midpoint.y - label.height / 2)
        };
  }

  if (diagnostics && edgeId) {
    diagnostics.push(
      createRoutingDiagnostic(
        "renderer.routing.edge_label_segment_fallback",
        `Edge label placement for "${edgeId}" could not find a long enough route segment. Falling back to midpoint placement.`,
        edgeId,
        "info"
      )
    );
  }

  const totalLength = getPolylineLength(route.points);
  const midpoint = getPointAtDistance(route.points, totalLength / 2);

  return {
    lines: [...label.lines],
    width: label.width,
    height: label.height,
    lineHeight: label.lineHeight,
    textStyleRole: label.textStyleRole,
    x: roundMetric(midpoint.x - label.width / 2),
    y: roundMetric(midpoint.y - label.height / 2)
  };
}
