import {
  IA_LOCAL_ROUTE_PATTERNS,
  type MeasuredEdge,
  type MeasuredEdgeEndpoint,
  type MeasuredPort,
  type PortSide,
  type Point,
  type PositionedContainer,
  type PositionedEdgeEndpoint,
  type PositionedEdgeLabel,
  type PositionedItem,
  type PositionedRoute
} from "./contracts.js";
import { createRoutingDiagnostic, type RendererDiagnostic } from "./diagnostics.js";

export interface IndexedPositionedItem {
  item: PositionedItem;
  portsById: Map<string, MeasuredPort>;
}

interface ResolvedEdgeEndpoint extends PositionedEdgeEndpoint {
  side?: PortSide;
}

export interface SourceContractLaneAssignment {
  labelX: number;
  labelY: number;
  rowY: number;
  laneExitX: number;
  usableWidth: number;
}

const EDGE_LABEL_SEGMENT_CLEARANCE = 12;
const EDGE_LABEL_SEGMENT_OFFSET = 12;
const MIN_ARROW_MARKER_LEG = 12;
const TARGET_BIASED_BEND_SOURCE_CLEARANCE = 4;
const TARGET_APPROACH_ZONE = 24;
const TARGET_APPROACH_MIN_FINAL_LEG = 20;
const TARGET_APPROACH_SOURCE_CLEARANCE = 8;
const TARGET_APPROACH_ESCAPE_CLEARANCE = 8;

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}
export { createRoutingDiagnostic } from "./diagnostics.js";

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
  toCoordinate: number,
  bendPlacement: MeasuredEdge["routing"]["bendPlacement"] = "midpoint"
): number {
  if (bendPlacement !== "target_bias") {
    return roundMetric((fromCoordinate + toCoordinate) / 2);
  }

  const direction = fromCoordinate <= toCoordinate ? 1 : -1;
  const sourceBound = fromCoordinate + direction * TARGET_BIASED_BEND_SOURCE_CLEARANCE;
  const targetBound = toCoordinate - direction * MIN_ARROW_MARKER_LEG;
  return roundMetric(direction > 0 ? Math.max(sourceBound, targetBound) : Math.min(sourceBound, targetBound));
}

function getAxisAlignedSegmentLength(start: Point, end: Point): number | undefined {
  if (start.x === end.x) {
    return roundMetric(Math.abs(end.y - start.y));
  }

  if (start.y === end.y) {
    return roundMetric(Math.abs(end.x - start.x));
  }

  return undefined;
}

function buildOrthogonalRoutePoints(
  from: ResolvedEdgeEndpoint,
  to: ResolvedEdgeEndpoint,
  preferAxis: MeasuredEdge["routing"]["preferAxis"],
  bendPlacement: MeasuredEdge["routing"]["bendPlacement"]
): Point[] {
  if (from.x === to.x || from.y === to.y) {
    return [
      { x: from.x, y: from.y },
      { x: to.x, y: to.y }
    ];
  }

  if (isHorizontalSide(from.side) && isHorizontalSide(to.side)) {
    const bendX = resolveOrthogonalBendCoordinate(from.x, to.x, bendPlacement);
    return [
      { x: from.x, y: from.y },
      { x: bendX, y: from.y },
      { x: bendX, y: to.y },
      { x: to.x, y: to.y }
    ];
  }

  if (isVerticalSide(from.side) && isVerticalSide(to.side)) {
    const bendY = resolveOrthogonalBendCoordinate(from.y, to.y, bendPlacement);
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

  return buildOrthogonalRoutePoints(from, to, preferAxis, edge.routing.bendPlacement);
}

function canApplyVerticalTargetApproach(
  from: ResolvedEdgeEndpoint,
  to: ResolvedEdgeEndpoint
): boolean {
  if (!isVerticalSide(to.side)) {
    return false;
  }

  if (to.side === "north") {
    return from.y + TARGET_APPROACH_SOURCE_CLEARANCE <= to.y - TARGET_APPROACH_ZONE;
  }

  return from.y - TARGET_APPROACH_SOURCE_CLEARANCE >= to.y + TARGET_APPROACH_ZONE;
}

function applyVerticalTargetApproach(
  points: Point[],
  from: ResolvedEdgeEndpoint,
  to: ResolvedEdgeEndpoint
): Point[] | undefined {
  if (points.length < 2 || !isVerticalSide(to.side)) {
    return undefined;
  }

  const bendY = roundMetric(to.y + (to.side === "north" ? -TARGET_APPROACH_ZONE : TARGET_APPROACH_ZONE));
  if (canApplyVerticalTargetApproach(from, to)) {
    const sourceClearanceY = roundMetric(
      from.y + (to.side === "north" ? TARGET_APPROACH_SOURCE_CLEARANCE : -TARGET_APPROACH_SOURCE_CLEARANCE)
    );
    const adjusted: Point[] = [{ x: from.x, y: from.y }];
    let current = adjusted[0]!;

    if (current.y !== sourceClearanceY) {
      adjusted.push({
        x: current.x,
        y: sourceClearanceY
      });
      current = adjusted[adjusted.length - 1]!;
    }

    const routeWithoutTarget = points.slice(1, -1);
    for (const point of routeWithoutTarget) {
      adjusted.push({
        x: point.x,
        y: point.y
      });
      current = adjusted[adjusted.length - 1]!;
    }

    if (current.y !== bendY) {
      adjusted.push({
        x: current.x,
        y: bendY
      });
      current = adjusted[adjusted.length - 1]!;
    }

    if (current.x !== to.x) {
      adjusted.push({
        x: to.x,
        y: current.y
      });
    }

    adjusted.push({
      x: to.x,
      y: to.y
    });

    const finalLegLength = getAxisAlignedSegmentLength(adjusted[adjusted.length - 2]!, adjusted[adjusted.length - 1]!);
    if (finalLegLength !== undefined && finalLegLength >= TARGET_APPROACH_MIN_FINAL_LEG) {
      return collapseRoutePoints(adjusted);
    }
  }

  const escapeX = roundMetric(Math.min(from.x, to.x) - (TARGET_APPROACH_SOURCE_CLEARANCE + TARGET_APPROACH_ESCAPE_CLEARANCE));
  const escaped = collapseRoutePoints([
    { x: from.x, y: from.y },
    { x: escapeX, y: from.y },
    { x: escapeX, y: bendY },
    { x: to.x, y: bendY },
    { x: to.x, y: to.y }
  ]);
  const escapedFinalLegLength = getAxisAlignedSegmentLength(
    escaped[escaped.length - 2]!,
    escaped[escaped.length - 1]!
  );
  if (escapedFinalLegLength !== undefined && escapedFinalLegLength >= TARGET_APPROACH_MIN_FINAL_LEG) {
    return escaped;
  }

  return undefined;
}

function applyTargetApproach(
  edge: MeasuredEdge,
  points: Point[],
  from: ResolvedEdgeEndpoint,
  to: ResolvedEdgeEndpoint,
  diagnostics: RendererDiagnostic[]
): Point[] {
  if (edge.routing.targetApproach !== "vertical_child") {
    return points;
  }

  const adjusted = applyVerticalTargetApproach(points, from, to);
  if (adjusted) {
    return adjusted;
  }

  diagnostics.push(
    createRoutingDiagnostic(
      "renderer.routing.target_approach_unmet",
      `Edge "${edge.id}" could not satisfy the requested "${edge.routing.targetApproach}" target-approach geometry with the current route shape.`,
      edge.id,
      "info"
    )
  );
  return points;
}

function adjustEndMarkerLeg(points: Point[]): Point[] | undefined {
  if (points.length < 4) {
    return undefined;
  }

  const adjusted = points.map((point) => ({ ...point }));
  const target = adjusted[adjusted.length - 1];
  const bend = adjusted[adjusted.length - 2];
  const previousBend = adjusted[adjusted.length - 3];
  const currentLegLength = getAxisAlignedSegmentLength(bend, target);
  if (currentLegLength === undefined || currentLegLength >= MIN_ARROW_MARKER_LEG) {
    return adjusted;
  }

  if (bend.y === target.y && previousBend.x === bend.x) {
    const direction = bend.x <= target.x ? 1 : -1;
    const desiredX = roundMetric(target.x - direction * MIN_ARROW_MARKER_LEG);
    previousBend.x = desiredX;
    bend.x = desiredX;
    return adjusted;
  }

  if (bend.x === target.x && previousBend.y === bend.y) {
    const direction = bend.y <= target.y ? 1 : -1;
    const desiredY = roundMetric(target.y - direction * MIN_ARROW_MARKER_LEG);
    previousBend.y = desiredY;
    bend.y = desiredY;
    return adjusted;
  }

  return undefined;
}

function adjustStartMarkerLeg(points: Point[]): Point[] | undefined {
  if (points.length < 4) {
    return undefined;
  }

  const adjusted = points.map((point) => ({ ...point }));
  const source = adjusted[0];
  const bend = adjusted[1];
  const nextBend = adjusted[2];
  const currentLegLength = getAxisAlignedSegmentLength(source, bend);
  if (currentLegLength === undefined || currentLegLength >= MIN_ARROW_MARKER_LEG) {
    return adjusted;
  }

  if (source.y === bend.y && bend.x === nextBend.x) {
    const direction = source.x <= bend.x ? 1 : -1;
    const desiredX = roundMetric(source.x + direction * MIN_ARROW_MARKER_LEG);
    bend.x = desiredX;
    nextBend.x = desiredX;
    return adjusted;
  }

  if (source.x === bend.x && bend.y === nextBend.y) {
    const direction = source.y <= bend.y ? 1 : -1;
    const desiredY = roundMetric(source.y + direction * MIN_ARROW_MARKER_LEG);
    bend.y = desiredY;
    nextBend.y = desiredY;
    return adjusted;
  }

  return undefined;
}

function enforceMinimumMarkerLeg(
  points: Point[],
  edgeId: string,
  terminal: "start" | "end",
  diagnostics: RendererDiagnostic[]
): Point[] {
  const adjusted = terminal === "start" ? adjustStartMarkerLeg(points) : adjustEndMarkerLeg(points);
  if (adjusted) {
    return collapseRoutePoints(adjusted);
  }

  diagnostics.push(
    createRoutingDiagnostic(
      "renderer.routing.marker_leg_minimum_unmet",
      `Edge "${edgeId}" could not reserve the minimum ${MIN_ARROW_MARKER_LEG}px ${terminal} marker leg with the current route shape.`,
      edgeId,
      "info"
    )
  );
  return points;
}

function enforceMarkerLegs(
  edge: MeasuredEdge,
  points: Point[],
  diagnostics: RendererDiagnostic[]
): Point[] {
  let routedPoints = points;

  if (edge.markers?.start === "arrow") {
    const startLegLength = getAxisAlignedSegmentLength(routedPoints[0]!, routedPoints[1]!);
    if (startLegLength !== undefined && startLegLength < MIN_ARROW_MARKER_LEG) {
      routedPoints = enforceMinimumMarkerLeg(routedPoints, edge.id, "start", diagnostics);
    }
  }

  if (edge.markers?.end === "arrow") {
    const endLegLength = getAxisAlignedSegmentLength(
      routedPoints[routedPoints.length - 2]!,
      routedPoints[routedPoints.length - 1]!
    );
    if (endLegLength !== undefined && endLegLength < MIN_ARROW_MARKER_LEG) {
      routedPoints = enforceMinimumMarkerLeg(routedPoints, edge.id, "end", diagnostics);
    }
  }

  return routedPoints;
}

function buildIaDirectVerticalRoutePoints(
  from: ResolvedEdgeEndpoint,
  to: ResolvedEdgeEndpoint
): Point[] {
  return [
    { x: from.x, y: from.y },
    { x: to.x, y: to.y }
  ];
}

function buildIaSharedTrunkRoutePoints(
  from: ResolvedEdgeEndpoint,
  to: ResolvedEdgeEndpoint
): Point[] {
  return [
    { x: from.x, y: from.y },
    { x: from.x, y: to.y },
    { x: to.x, y: to.y }
  ];
}

export function buildLocalPatternRoute(
  edge: MeasuredEdge,
  from: ResolvedEdgeEndpoint,
  to: ResolvedEdgeEndpoint,
  diagnostics: RendererDiagnostic[]
): PositionedRoute | undefined {
  let points: Point[] | undefined;

  switch (edge.routing.localPattern) {
    case IA_LOCAL_ROUTE_PATTERNS.directVertical:
      points = buildIaDirectVerticalRoutePoints(from, to);
      break;
    case IA_LOCAL_ROUTE_PATTERNS.sharedTrunk:
      points = buildIaSharedTrunkRoutePoints(from, to);
      break;
    default:
      return undefined;
  }

  return {
    style: edge.routing.style,
    points: enforceMarkerLegs(
      edge,
      collapseRoutePoints(points),
      diagnostics
    )
  };
}

export function buildSharedRoute(
  edge: MeasuredEdge,
  from: ResolvedEdgeEndpoint,
  to: ResolvedEdgeEndpoint,
  diagnostics: RendererDiagnostic[]
): PositionedRoute {
  const routedPoints = collapseRoutePoints(
    buildSharedRoutePoints(edge, from, to)
  );

  return {
    style: edge.routing.style,
    points: enforceMarkerLegs(
      edge,
      applyTargetApproach(edge, routedPoints, from, to, diagnostics),
      diagnostics
    )
  };
}

export function buildSourceContractLaneRoute(
  edge: MeasuredEdge,
  from: ResolvedEdgeEndpoint,
  to: ResolvedEdgeEndpoint,
  lane: SourceContractLaneAssignment,
  diagnostics: RendererDiagnostic[]
): PositionedRoute {
  const lanePoints = collapseRoutePoints([
    { x: from.x, y: from.y },
    { x: from.x, y: lane.rowY },
    { x: lane.laneExitX, y: lane.rowY },
    { x: lane.laneExitX, y: to.y },
    { x: to.x, y: to.y }
  ]);

  return {
    style: edge.routing.style,
    points: enforceMarkerLegs(
      edge,
      applyTargetApproach(edge, lanePoints, from, to, diagnostics),
      diagnostics
    )
  };
}

export function buildRouteFromLocalHint(
  edge: MeasuredEdge,
  from: ResolvedEdgeEndpoint,
  to: ResolvedEdgeEndpoint,
  owner: PositionedContainer,
  localPoints: Point[],
  diagnostics: RendererDiagnostic[]
): PositionedRoute {
  const middlePoints = localPoints
    .slice(1, -1)
    .map((point) => ({
      x: roundMetric(owner.x + point.x),
      y: roundMetric(owner.y + point.y)
    }));

  return {
    style: edge.routing.style,
    points: enforceMarkerLegs(
      edge,
      applyTargetApproach(
        edge,
        collapseRoutePoints([
        { x: from.x, y: from.y },
        ...middlePoints,
        { x: to.x, y: to.y }
        ]),
        from,
        to,
        diagnostics
      ),
      diagnostics
    )
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

export function positionEdgeLabelInLane(
  label: NonNullable<MeasuredEdge["label"]>,
  lane: Pick<SourceContractLaneAssignment, "labelX" | "labelY">
): PositionedEdgeLabel {
  return {
    lines: [...label.lines],
    width: label.width,
    height: label.height,
    lineHeight: label.lineHeight,
    textStyleRole: label.textStyleRole,
    x: roundMetric(lane.labelX),
    y: roundMetric(lane.labelY)
  };
}
