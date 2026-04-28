import type {
  MeasuredEdgeLabel,
  Point,
  PositionedEdgeLabel,
  PositionedRoute,
  PositionedScene
} from "./contracts.js";
import {
  createRoutingDiagnostic,
  type RendererDiagnostic,
  type RendererDiagnosticSeverity
} from "./diagnostics.js";

export const FIXED_LABEL_DISTANCE = 12;
export const FIXED_LABEL_CLEARANCE = FIXED_LABEL_DISTANCE * 2;

export interface LabelBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BlockingBox extends LabelBox {
  itemId?: string;
}

interface ConnectorMidpointSegment {
  segment: RouteSegmentDetail;
  point: Point;
  segmentIndex: number;
  midpointDistance: number;
}

export interface RouteSegmentDetail {
  routeSegmentIndex: number;
  orientation: "vertical" | "horizontal";
  coordinate: number;
  start: Point;
  end: Point;
}

export interface ConnectorRouteSegmentDetail extends RouteSegmentDetail {
  connectorId: string;
}

export interface HorizontalLineSegment {
  coordinate: number;
  spanStart: number;
  spanEnd: number;
}

interface ConnectorLabelAnchorCandidate {
  segment: RouteSegmentDetail;
  point: Point;
  routeDistanceFromMidpoint: number;
}

interface ConnectorLabelPlacementResult {
  label: PositionedEdgeLabel;
  box: LabelBox;
  fallback: boolean;
  distanceFromAnchor: number;
}

interface VerticalLabelPlacementCandidate {
  box: LabelBox;
  distanceFromAnchor: number;
  tierRank: number;
  clearanceImbalance: number;
  minimumCorridorClearance: number;
}

interface HorizontalLabelPlacementCandidate {
  box: LabelBox;
  distanceFromAnchor: number;
  tierRank: number;
  minimumBlockerClearance: number;
}

export interface ConnectorLabelDiagnosticsPolicy {
  omittedCode: string;
  fallbackCode: string;
  severity?: RendererDiagnosticSeverity;
  noAnchorMessage: (connectorId: string) => string;
  noCandidateMessage: (connectorId: string) => string;
  fallbackMessage: (connectorId: string) => string;
}

export interface ConnectorLabelPlacementOptions {
  connectorId: string;
  measuredLabel: MeasuredEdgeLabel;
  route: PositionedRoute;
  connectorSegmentsById: ReadonlyMap<string, readonly ConnectorRouteSegmentDetail[]>;
  blockedBoxes: readonly BlockingBox[];
  separatorSegments: readonly HorizontalLineSegment[];
  scene: PositionedScene;
  diagnostics: RendererDiagnostic[];
  diagnosticsPolicy: ConnectorLabelDiagnosticsPolicy;
  connectorBlockMode?: "vertical_only" | "all_segments";
  separatorBlockMode?: "vertical_stem" | "box";
  horizontalPlacementMode?: "service_shift_right" | "scenario_side_offsets";
}

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function sortNumericAscending(values: Iterable<number>): number[] {
  return [...values].sort((left, right) => left - right);
}

export function buildRouteSegmentDetails(route: PositionedRoute): RouteSegmentDetail[] {
  const details: RouteSegmentDetail[] = [];

  for (let index = 1; index < route.points.length; index += 1) {
    const start = route.points[index - 1]!;
    const end = route.points[index]!;
    if (start.x === end.x) {
      details.push({
        routeSegmentIndex: index - 1,
        orientation: "vertical",
        coordinate: start.x,
        start,
        end
      });
      continue;
    }
    if (start.y === end.y) {
      details.push({
        routeSegmentIndex: index - 1,
        orientation: "horizontal",
        coordinate: start.y,
        start,
        end
      });
    }
  }

  return details;
}

export function buildConnectorRouteSegmentsById<T>(
  connectors: readonly T[],
  getConnectorId: (connector: T) => string,
  getRoute: (connector: T) => PositionedRoute
): Map<string, ConnectorRouteSegmentDetail[]> {
  return new Map(
    connectors.map((connector) => {
      const connectorId = getConnectorId(connector);
      return [
        connectorId,
        buildRouteSegmentDetails(getRoute(connector)).map((segment) => ({
          ...segment,
          connectorId
        }))
      ] as const;
    })
  );
}

function getRouteSegmentLength(segment: RouteSegmentDetail): number {
  return segment.orientation === "vertical"
    ? Math.abs(segment.end.y - segment.start.y)
    : Math.abs(segment.end.x - segment.start.x);
}

function getRouteSegmentMidpoint(segment: RouteSegmentDetail): Point {
  return {
    x: roundMetric((segment.start.x + segment.end.x) / 2),
    y: roundMetric((segment.start.y + segment.end.y) / 2)
  };
}

function getPointAlongRouteSegment(segment: RouteSegmentDetail, distance: number): Point {
  if (segment.orientation === "vertical") {
    const direction = segment.end.y >= segment.start.y ? 1 : -1;
    return {
      x: roundMetric(segment.start.x),
      y: roundMetric(segment.start.y + direction * distance)
    };
  }

  const direction = segment.end.x >= segment.start.x ? 1 : -1;
  return {
    x: roundMetric(segment.start.x + direction * distance),
    y: roundMetric(segment.start.y)
  };
}

function resolveConnectorMidpointSegment(route: PositionedRoute): ConnectorMidpointSegment | undefined {
  const details = buildRouteSegmentDetails(route)
    .filter((segment) => getRouteSegmentLength(segment) > 0.5);
  if (details.length === 0) {
    return undefined;
  }

  let traversedLength = 0;
  for (const segment of details) {
    traversedLength += getRouteSegmentLength(segment);
  }

  const totalLength = traversedLength;
  const midpointDistance = totalLength / 2;
  let traversed = 0;

  for (let index = 0; index < details.length; index += 1) {
    const segment = details[index]!;
    const segmentLength = getRouteSegmentLength(segment);
    const boundary = traversed + segmentLength;

    if (midpointDistance < boundary - 0.001) {
      return {
        segment,
        point: getPointAlongRouteSegment(segment, midpointDistance - traversed),
        segmentIndex: index,
        midpointDistance
      };
    }

    if (Math.abs(midpointDistance - boundary) <= 0.001) {
      const next = details[index + 1];
      if (!next) {
        return {
          segment,
          point: getRouteSegmentMidpoint(segment),
          segmentIndex: index,
          midpointDistance
        };
      }

      const nextLength = getRouteSegmentLength(next);
      const chosen = nextLength >= segmentLength ? next : segment;
      const chosenIndex = chosen === next ? index + 1 : index;
      return {
        segment: chosen,
        point: getRouteSegmentMidpoint(chosen),
        segmentIndex: chosenIndex,
        midpointDistance
      };
    }

    traversed = boundary;
  }

  const last = details[details.length - 1]!;
  return {
    segment: last,
    point: getRouteSegmentMidpoint(last),
    segmentIndex: details.length - 1,
    midpointDistance
  };
}

export function buildLabelBox(x: number, y: number, width: number, height: number): LabelBox {
  return {
    x: roundMetric(x),
    y: roundMetric(y),
    width: roundMetric(width),
    height: roundMetric(height)
  };
}

export function buildPositionedEdgeLabelFromBox(
  measuredLabel: MeasuredEdgeLabel,
  box: LabelBox
): PositionedEdgeLabel {
  return {
    lines: [...measuredLabel.lines],
    width: measuredLabel.width,
    height: measuredLabel.height,
    lineHeight: measuredLabel.lineHeight,
    textStyleRole: measuredLabel.textStyleRole,
    x: box.x,
    y: box.y
  };
}

function buildVerticalLabelBox(
  stemX: number,
  topY: number,
  measuredLabel: MeasuredEdgeLabel,
  side: "right" | "left"
): LabelBox {
  return buildLabelBox(
    side === "right"
      ? stemX + FIXED_LABEL_DISTANCE
      : stemX - FIXED_LABEL_DISTANCE - measuredLabel.width,
    topY,
    measuredLabel.width,
    measuredLabel.height
  );
}

function buildHorizontalLabelBox(
  anchorPoint: Point,
  measuredLabel: MeasuredEdgeLabel
): LabelBox {
  return buildLabelBox(
    anchorPoint.x - measuredLabel.width / 2,
    anchorPoint.y - measuredLabel.height / 2,
    measuredLabel.width,
    measuredLabel.height
  );
}

export function boxesOverlap(left: LabelBox, right: LabelBox): boolean {
  return left.x < right.x + right.width - 0.5
    && left.x + left.width > right.x + 0.5
    && left.y < right.y + right.height - 0.5
    && left.y + left.height > right.y + 0.5;
}

function boxIntersectsBoxes(
  box: LabelBox,
  blockedBoxes: readonly BlockingBox[]
): boolean {
  return blockedBoxes.some((blockedBox) => boxesOverlap(box, blockedBox));
}

function measureBoxClearance(
  left: LabelBox,
  right: { x: number; y: number; width: number; height: number }
): number {
  const horizontalGap = Math.max(
    right.x - (left.x + left.width),
    left.x - (right.x + right.width),
    0
  );
  const verticalGap = Math.max(
    right.y - (left.y + left.height),
    left.y - (right.y + right.height),
    0
  );
  return Math.hypot(horizontalGap, verticalGap);
}

function measureMinimumBoxClearance(
  box: LabelBox,
  blockedBoxes: readonly BlockingBox[]
): number {
  if (blockedBoxes.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  return blockedBoxes.reduce(
    (minimum, blockedBox) => Math.min(minimum, measureBoxClearance(box, blockedBox)),
    Number.POSITIVE_INFINITY
  );
}

function buildConnectorLabelAnchorCandidates(route: PositionedRoute): ConnectorLabelAnchorCandidate[] | undefined {
  const details = buildRouteSegmentDetails(route)
    .filter((segment) => getRouteSegmentLength(segment) > 0.5);
  const midpoint = resolveConnectorMidpointSegment(route);
  if (!midpoint || details.length === 0) {
    return undefined;
  }

  const startDistances: number[] = [];
  let traversed = 0;
  for (const segment of details) {
    startDistances.push(traversed);
    traversed += getRouteSegmentLength(segment);
  }

  const candidates: ConnectorLabelAnchorCandidate[] = [{
    segment: midpoint.segment,
    point: midpoint.point,
    routeDistanceFromMidpoint: 0
  }];
  const previous = details[midpoint.segmentIndex - 1];
  const next = details[midpoint.segmentIndex + 1];
  const midpointSegmentLength = getRouteSegmentLength(midpoint.segment);
  const isLocalHorizontalSwerve = midpoint.segment.orientation === "horizontal"
    && previous?.orientation === "vertical"
    && next?.orientation === "vertical"
    && midpointSegmentLength <= Math.max(
      getRouteSegmentLength(previous),
      getRouteSegmentLength(next)
    ) * 2;

  if (!isLocalHorizontalSwerve) {
    return candidates;
  }

  for (const candidateIndex of [midpoint.segmentIndex - 1, midpoint.segmentIndex + 1]) {
    const segment = details[candidateIndex];
    if (!segment) {
      continue;
    }
    const anchorDistance = startDistances[candidateIndex]! + getRouteSegmentLength(segment) / 2;
    candidates.push({
      segment,
      point: getRouteSegmentMidpoint(segment),
      routeDistanceFromMidpoint: Math.abs(anchorDistance - midpoint.midpointDistance)
    });
  }

  return candidates;
}

function isLabelBoxWithinScene(scene: PositionedScene, box: LabelBox): boolean {
  return box.x >= scene.root.x - 0.5
    && box.y >= scene.root.y - 0.5
    && box.x + box.width <= scene.root.x + scene.root.width + 0.5
    && box.y + box.height <= scene.root.y + scene.root.height + 0.5;
}

function spansOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return Math.min(endA, endB) - Math.max(startA, startB) > 0.5;
}

function boxIntersectsConnectorSegments(
  box: LabelBox,
  connectorId: string,
  connectorSegmentsById: ReadonlyMap<string, readonly ConnectorRouteSegmentDetail[]>,
  blockMode: "vertical_only" | "all_segments"
): boolean {
  for (const [candidateConnectorId, segments] of connectorSegmentsById.entries()) {
    if (candidateConnectorId === connectorId) {
      continue;
    }
    if (segments.some((segment) => {
      if (segment.orientation === "vertical") {
        return segment.coordinate >= box.x - 0.5
          && segment.coordinate <= box.x + box.width + 0.5
          && spansOverlap(
            Math.min(segment.start.y, segment.end.y),
            Math.max(segment.start.y, segment.end.y),
            box.y,
            box.y + box.height
          );
      }

      return blockMode === "all_segments"
        && segment.coordinate >= box.y - 0.5
        && segment.coordinate <= box.y + box.height + 0.5
        && spansOverlap(
          Math.min(segment.start.x, segment.end.x),
          Math.max(segment.start.x, segment.end.x),
          box.x,
          box.x + box.width
        );
    })) {
      return true;
    }
  }

  return false;
}

function boxIntersectsHorizontalLineSegments(
  box: LabelBox,
  separatorSegments: readonly HorizontalLineSegment[]
): boolean {
  return separatorSegments.some((separator) =>
    separator.coordinate >= box.y - 0.5
    && separator.coordinate <= box.y + box.height + 0.5
    && spansOverlap(separator.spanStart, separator.spanEnd, box.x, box.x + box.width)
  );
}

function findHorizontalCrossingsForVerticalLabel(
  box: LabelBox,
  stemX: number,
  connectorId: string,
  connectorSegmentsById: ReadonlyMap<string, readonly ConnectorRouteSegmentDetail[]>,
  separatorSegments: readonly HorizontalLineSegment[],
  clearance: number = FIXED_LABEL_CLEARANCE
): number[] {
  const crossings: number[] = [];

  for (const [candidateConnectorId, segments] of connectorSegmentsById.entries()) {
    if (candidateConnectorId === connectorId) {
      continue;
    }
    for (const segment of segments) {
      if (segment.orientation !== "horizontal") {
        continue;
      }
      if (segment.coordinate <= box.y - clearance + 0.5
        || segment.coordinate >= box.y + box.height + clearance - 0.5) {
        continue;
      }
      if (stemX < Math.min(segment.start.x, segment.end.x) - 0.5 || stemX > Math.max(segment.start.x, segment.end.x) + 0.5) {
        continue;
      }
      crossings.push(segment.coordinate);
    }
  }

  for (const separator of separatorSegments) {
    if (separator.coordinate <= box.y - clearance + 0.5
      || separator.coordinate >= box.y + box.height + clearance - 0.5) {
      continue;
    }
    if (stemX < separator.spanStart - 0.5 || stemX > separator.spanEnd + 0.5) {
      continue;
    }
    crossings.push(separator.coordinate);
  }

  return sortNumericAscending(crossings);
}

function isVerticalLabelSideBlocked(
  box: LabelBox,
  connectorId: string,
  connectorSegmentsById: ReadonlyMap<string, readonly ConnectorRouteSegmentDetail[]>,
  blockedBoxes: readonly BlockingBox[],
  separatorSegments: readonly HorizontalLineSegment[],
  scene: PositionedScene,
  connectorBlockMode: "vertical_only" | "all_segments",
  separatorBlockMode: "vertical_stem" | "box"
): boolean {
  return !isLabelBoxWithinScene(scene, box)
    || boxIntersectsConnectorSegments(box, connectorId, connectorSegmentsById, connectorBlockMode)
    || boxIntersectsBoxes(box, blockedBoxes)
    || (separatorBlockMode === "box" && boxIntersectsHorizontalLineSegments(box, separatorSegments));
}

function isHorizontalLabelBlocked(
  box: LabelBox,
  connectorId: string,
  connectorSegmentsById: ReadonlyMap<string, readonly ConnectorRouteSegmentDetail[]>,
  blockedBoxes: readonly BlockingBox[],
  separatorSegments: readonly HorizontalLineSegment[],
  scene: PositionedScene,
  connectorBlockMode: "vertical_only" | "all_segments",
  separatorBlockMode: "vertical_stem" | "box"
): boolean {
  return !isLabelBoxWithinScene(scene, box)
    || boxIntersectsConnectorSegments(box, connectorId, connectorSegmentsById, connectorBlockMode)
    || boxIntersectsBoxes(box, blockedBoxes)
    || (separatorBlockMode === "box" && boxIntersectsHorizontalLineSegments(box, separatorSegments));
}

function isVerticalLabelCandidateClear(
  box: LabelBox,
  stemX: number,
  connectorId: string,
  connectorSegmentsById: ReadonlyMap<string, readonly ConnectorRouteSegmentDetail[]>,
  blockedBoxes: readonly BlockingBox[],
  separatorSegments: readonly HorizontalLineSegment[],
  scene: PositionedScene,
  connectorBlockMode: "vertical_only" | "all_segments",
  separatorBlockMode: "vertical_stem" | "box"
): boolean {
  return !isVerticalLabelSideBlocked(
      box,
      connectorId,
      connectorSegmentsById,
      blockedBoxes,
      separatorSegments,
      scene,
      connectorBlockMode,
      separatorBlockMode
    )
    && findHorizontalCrossingsForVerticalLabel(
      box,
      stemX,
      connectorId,
      connectorSegmentsById,
      separatorSegments
    ).length === 0;
}

function isCompressedVerticalLabelCandidateClear(
  box: LabelBox,
  stemX: number,
  connectorId: string,
  connectorSegmentsById: ReadonlyMap<string, readonly ConnectorRouteSegmentDetail[]>,
  blockedBoxes: readonly BlockingBox[],
  separatorSegments: readonly HorizontalLineSegment[],
  scene: PositionedScene,
  connectorBlockMode: "vertical_only" | "all_segments",
  separatorBlockMode: "vertical_stem" | "box"
): boolean {
  return !isVerticalLabelSideBlocked(
      box,
      connectorId,
      connectorSegmentsById,
      blockedBoxes,
      separatorSegments,
      scene,
      connectorBlockMode,
      separatorBlockMode
    )
    && findHorizontalCrossingsForVerticalLabel(
      box,
      stemX,
      connectorId,
      connectorSegmentsById,
      separatorSegments,
      0
    ).length === 0;
}

function collectHorizontalBlockerCoordinatesForVerticalStem(
  stemX: number,
  connectorId: string,
  connectorSegmentsById: ReadonlyMap<string, readonly ConnectorRouteSegmentDetail[]>,
  separatorSegments: readonly HorizontalLineSegment[]
): number[] {
  const coordinates: number[] = [];

  for (const [candidateConnectorId, segments] of connectorSegmentsById.entries()) {
    if (candidateConnectorId === connectorId) {
      continue;
    }
    for (const segment of segments) {
      if (segment.orientation !== "horizontal") {
        continue;
      }
      if (stemX < Math.min(segment.start.x, segment.end.x) - 0.5 || stemX > Math.max(segment.start.x, segment.end.x) + 0.5) {
        continue;
      }
      coordinates.push(roundMetric(segment.coordinate));
    }
  }

  for (const separator of separatorSegments) {
    if (stemX < separator.spanStart - 0.5 || stemX > separator.spanEnd + 0.5) {
      continue;
    }
    coordinates.push(roundMetric(separator.coordinate));
  }

  return [...new Set(coordinates)].sort((left, right) => left - right);
}

function buildVerticalLabelPreferredCandidates(
  stemX: number,
  anchorY: number,
  measuredLabel: MeasuredEdgeLabel,
  side: "right" | "left",
  connectorId: string,
  connectorSegmentsById: ReadonlyMap<string, readonly ConnectorRouteSegmentDetail[]>,
  separatorSegments: readonly HorizontalLineSegment[]
): VerticalLabelPlacementCandidate[] {
  const initialTopY = roundMetric(anchorY - measuredLabel.height / 2);
  const initialBox = buildVerticalLabelBox(stemX, initialTopY, measuredLabel, side);
  const topYs = new Set<number>([initialTopY]);
  const crossings = findHorizontalCrossingsForVerticalLabel(
    initialBox,
    stemX,
    connectorId,
    connectorSegmentsById,
    separatorSegments
  );

  for (const crossing of crossings) {
    topYs.add(roundMetric(crossing + FIXED_LABEL_CLEARANCE));
    topYs.add(roundMetric(crossing - FIXED_LABEL_CLEARANCE - measuredLabel.height));
  }

  return [...topYs]
    .map((topY) => ({
      box: buildVerticalLabelBox(stemX, topY, measuredLabel, side),
      distanceFromAnchor: Math.abs(topY - initialTopY),
      tierRank: 0,
      clearanceImbalance: Number.POSITIVE_INFINITY,
      minimumCorridorClearance: Number.POSITIVE_INFINITY
    }))
    .sort((left, right) => {
      if (Math.abs(left.distanceFromAnchor - right.distanceFromAnchor) > 0.001) {
        return left.distanceFromAnchor - right.distanceFromAnchor;
      }

      const leftBelowPreference = left.box.y >= initialTopY - 0.001 ? 0 : 1;
      const rightBelowPreference = right.box.y >= initialTopY - 0.001 ? 0 : 1;
      if (leftBelowPreference !== rightBelowPreference) {
        return leftBelowPreference - rightBelowPreference;
      }

      return left.box.y - right.box.y;
    });
}

function buildVerticalLabelCompressedGapCandidates(
  stemX: number,
  anchorY: number,
  measuredLabel: MeasuredEdgeLabel,
  side: "right" | "left",
  connectorId: string,
  connectorSegmentsById: ReadonlyMap<string, readonly ConnectorRouteSegmentDetail[]>,
  separatorSegments: readonly HorizontalLineSegment[],
  blockedBoxes: readonly BlockingBox[],
  scene: PositionedScene
): VerticalLabelPlacementCandidate[] {
  const initialTopY = roundMetric(anchorY - measuredLabel.height / 2);
  const fixedSideBox = buildVerticalLabelBox(stemX, initialTopY, measuredLabel, side);
  const xStart = fixedSideBox.x;
  const xEnd = fixedSideBox.x + fixedSideBox.width;
  const blockers = [
    { start: scene.root.y, end: scene.root.y },
    { start: scene.root.y + scene.root.height, end: scene.root.y + scene.root.height },
    ...blockedBoxes
      .filter((blockedBox) => spansOverlap(xStart, xEnd, blockedBox.x, blockedBox.x + blockedBox.width))
      .map((blockedBox) => ({
        start: blockedBox.y,
        end: blockedBox.y + blockedBox.height
      })),
    ...collectHorizontalBlockerCoordinatesForVerticalStem(
      stemX,
      connectorId,
      connectorSegmentsById,
      separatorSegments
    ).map((coordinate) => ({
      start: coordinate,
      end: coordinate
    }))
  ].sort((left, right) => {
    if (Math.abs(left.start - right.start) > 0.001) {
      return left.start - right.start;
    }
    return left.end - right.end;
  });

  const mergedBlockers = blockers.reduce<Array<{ start: number; end: number }>>((accumulator, blocker) => {
    const previous = accumulator[accumulator.length - 1];
    if (!previous || blocker.start > previous.end + 0.5) {
      accumulator.push({ ...blocker });
      return accumulator;
    }

    previous.end = Math.max(previous.end, blocker.end);
    return accumulator;
  }, []);

  const candidates: VerticalLabelPlacementCandidate[] = [];
  for (let index = 0; index < mergedBlockers.length - 1; index += 1) {
    const upperBlocker = mergedBlockers[index]!;
    const lowerBlocker = mergedBlockers[index + 1]!;
    const minimumTop = upperBlocker.end;
    const maximumTop = lowerBlocker.start - measuredLabel.height;
    if (maximumTop + 0.001 < minimumTop) {
      continue;
    }

    const centeredTop = roundMetric(minimumTop + (maximumTop - minimumTop) / 2);
    const topY = Math.min(Math.max(centeredTop, minimumTop), maximumTop);
    const box = buildVerticalLabelBox(stemX, topY, measuredLabel, side);
    const freeSpaceAbove = Math.max(box.y - upperBlocker.end, 0);
    const freeSpaceBelow = Math.max(lowerBlocker.start - (box.y + box.height), 0);
    candidates.push({
      box,
      distanceFromAnchor: Math.abs(box.y - initialTopY),
      tierRank: 1,
      clearanceImbalance: Math.abs(freeSpaceAbove - freeSpaceBelow),
      minimumCorridorClearance: Math.min(freeSpaceAbove, freeSpaceBelow)
    });
  }

  return candidates;
}

function buildVerticalLabelSearchCandidates(
  stemX: number,
  anchorY: number,
  measuredLabel: MeasuredEdgeLabel,
  side: "right" | "left",
  connectorId: string,
  connectorSegmentsById: ReadonlyMap<string, readonly ConnectorRouteSegmentDetail[]>,
  separatorSegments: readonly HorizontalLineSegment[],
  blockedBoxes: readonly BlockingBox[],
  scene: PositionedScene
): VerticalLabelPlacementCandidate[] {
  const initialTopY = roundMetric(anchorY - measuredLabel.height / 2);
  return [
    ...buildVerticalLabelPreferredCandidates(
      stemX,
      anchorY,
      measuredLabel,
      side,
      connectorId,
      connectorSegmentsById,
      separatorSegments
    ),
    ...buildVerticalLabelCompressedGapCandidates(
      stemX,
      anchorY,
      measuredLabel,
      side,
      connectorId,
      connectorSegmentsById,
      separatorSegments,
      blockedBoxes,
      scene
    )
  ].sort((left, right) => {
    if (left.tierRank !== right.tierRank) {
      return left.tierRank - right.tierRank;
    }
    if (Math.abs(left.distanceFromAnchor - right.distanceFromAnchor) > 0.001) {
      return left.distanceFromAnchor - right.distanceFromAnchor;
    }
    if (left.tierRank === 0) {
      const leftBelowPreference = left.box.y >= initialTopY - 0.001 ? 0 : 1;
      const rightBelowPreference = right.box.y >= initialTopY - 0.001 ? 0 : 1;
      if (leftBelowPreference !== rightBelowPreference) {
        return leftBelowPreference - rightBelowPreference;
      }
      return left.box.y - right.box.y;
    }
    if (Math.abs(left.clearanceImbalance - right.clearanceImbalance) > 0.001) {
      return left.clearanceImbalance - right.clearanceImbalance;
    }
    if (left.minimumCorridorClearance > right.minimumCorridorClearance + 0.001) {
      return -1;
    }
    if (right.minimumCorridorClearance > left.minimumCorridorClearance + 0.001) {
      return 1;
    }
    return left.box.y - right.box.y;
  });
}

function resolveVerticalLabelPlacementOnSide(
  connectorId: string,
  measuredLabel: MeasuredEdgeLabel,
  segment: RouteSegmentDetail,
  anchorPoint: Point,
  side: "right" | "left",
  connectorSegmentsById: ReadonlyMap<string, readonly ConnectorRouteSegmentDetail[]>,
  blockedBoxes: readonly BlockingBox[],
  separatorSegments: readonly HorizontalLineSegment[],
  scene: PositionedScene,
  connectorBlockMode: "vertical_only" | "all_segments",
  separatorBlockMode: "vertical_stem" | "box"
): ConnectorLabelPlacementResult {
  const candidates = buildVerticalLabelSearchCandidates(
    segment.coordinate,
    anchorPoint.y,
    measuredLabel,
    side,
    connectorId,
    connectorSegmentsById,
    separatorSegments,
    blockedBoxes,
    scene
  );

  for (const candidate of candidates) {
    const isClear = candidate.tierRank === 0
      ? isVerticalLabelCandidateClear(
          candidate.box,
          segment.coordinate,
          connectorId,
          connectorSegmentsById,
          blockedBoxes,
          separatorSegments,
          scene,
          connectorBlockMode,
          separatorBlockMode
        )
      : isCompressedVerticalLabelCandidateClear(
          candidate.box,
          segment.coordinate,
          connectorId,
          connectorSegmentsById,
          blockedBoxes,
          separatorSegments,
          scene,
          connectorBlockMode,
          separatorBlockMode
        );
    if (isClear) {
      return {
        label: buildPositionedEdgeLabelFromBox(measuredLabel, candidate.box),
        box: candidate.box,
        fallback: false,
        distanceFromAnchor: candidate.distanceFromAnchor
      };
    }
  }

  const fallback = [...candidates].sort((left, right) => {
    if (Math.abs(left.distanceFromAnchor - right.distanceFromAnchor) > 0.001) {
      return left.distanceFromAnchor - right.distanceFromAnchor;
    }
    if (left.tierRank !== right.tierRank) {
      return left.tierRank - right.tierRank;
    }
    return left.box.y - right.box.y;
  })[0] ?? {
    box: buildVerticalLabelBox(segment.coordinate, anchorPoint.y - measuredLabel.height / 2, measuredLabel, side),
    distanceFromAnchor: 0
  };
  return {
    label: buildPositionedEdgeLabelFromBox(measuredLabel, fallback.box),
    box: fallback.box,
    fallback: true,
    distanceFromAnchor: fallback.distanceFromAnchor
  };
}

function resolveVerticalLabelPlacement(
  connectorId: string,
  measuredLabel: MeasuredEdgeLabel,
  segment: RouteSegmentDetail,
  anchorPoint: Point,
  connectorSegmentsById: ReadonlyMap<string, readonly ConnectorRouteSegmentDetail[]>,
  blockedBoxes: readonly BlockingBox[],
  separatorSegments: readonly HorizontalLineSegment[],
  scene: PositionedScene,
  connectorBlockMode: "vertical_only" | "all_segments",
  separatorBlockMode: "vertical_stem" | "box"
): ConnectorLabelPlacementResult {
  const rightCandidate = buildVerticalLabelBox(
    segment.coordinate,
    anchorPoint.y - measuredLabel.height / 2,
    measuredLabel,
    "right"
  );
  const leftCandidate = buildVerticalLabelBox(
    segment.coordinate,
    anchorPoint.y - measuredLabel.height / 2,
    measuredLabel,
    "left"
  );
  const rightBlocked = boxIntersectsConnectorSegments(
    rightCandidate,
    connectorId,
    connectorSegmentsById,
    connectorBlockMode
  );
  const leftBlocked = boxIntersectsConnectorSegments(
    leftCandidate,
    connectorId,
    connectorSegmentsById,
    connectorBlockMode
  );
  const preferredSide: "right" | "left" = rightBlocked && !leftBlocked ? "left" : "right";
  const alternateSide: "right" | "left" = preferredSide === "right" ? "left" : "right";
  const preferredPlacement = resolveVerticalLabelPlacementOnSide(
    connectorId,
    measuredLabel,
    segment,
    anchorPoint,
    preferredSide,
    connectorSegmentsById,
    blockedBoxes,
    separatorSegments,
    scene,
    connectorBlockMode,
    separatorBlockMode
  );

  if (!preferredPlacement.fallback) {
    return preferredPlacement;
  }

  const alternatePlacement = resolveVerticalLabelPlacementOnSide(
    connectorId,
    measuredLabel,
    segment,
    anchorPoint,
    alternateSide,
    connectorSegmentsById,
    blockedBoxes,
    separatorSegments,
    scene,
    connectorBlockMode,
    separatorBlockMode
  );

  if (!alternatePlacement.fallback) {
    return alternatePlacement;
  }

  return alternatePlacement.distanceFromAnchor < preferredPlacement.distanceFromAnchor
    ? alternatePlacement
    : preferredPlacement;
}

function resolveServiceHorizontalLabelPlacement(
  connectorId: string,
  measuredLabel: MeasuredEdgeLabel,
  anchorPoint: Point,
  connectorSegmentsById: ReadonlyMap<string, readonly ConnectorRouteSegmentDetail[]>,
  blockedBoxes: readonly BlockingBox[],
  separatorSegments: readonly HorizontalLineSegment[],
  scene: PositionedScene,
  connectorBlockMode: "vertical_only" | "all_segments",
  separatorBlockMode: "vertical_stem" | "box"
): ConnectorLabelPlacementResult {
  const initialCandidate = buildHorizontalLabelBox(anchorPoint, measuredLabel);
  let candidate = initialCandidate;
  let lastInBounds = initialCandidate;

  for (let attempt = 0; attempt < 16; attempt += 1) {
    if (!isHorizontalLabelBlocked(
      candidate,
      connectorId,
      connectorSegmentsById,
      blockedBoxes,
      separatorSegments,
      scene,
      connectorBlockMode,
      separatorBlockMode
    )) {
      return {
        label: buildPositionedEdgeLabelFromBox(measuredLabel, candidate),
        box: candidate,
        fallback: false,
        distanceFromAnchor: Math.abs(candidate.x - initialCandidate.x)
      };
    }
    if (isLabelBoxWithinScene(scene, candidate)) {
      lastInBounds = candidate;
    }

    const shifted = buildLabelBox(
      candidate.x + FIXED_LABEL_CLEARANCE,
      candidate.y,
      measuredLabel.width,
      measuredLabel.height
    );
    if (!isLabelBoxWithinScene(scene, shifted)) {
      break;
    }
    candidate = shifted;
  }

  return {
    label: buildPositionedEdgeLabelFromBox(measuredLabel, lastInBounds),
    box: lastInBounds,
    fallback: true,
    distanceFromAnchor: Math.abs(lastInBounds.x - initialCandidate.x)
  };
}

function buildScenarioHorizontalLabelSearchCandidates(
  measuredLabel: MeasuredEdgeLabel,
  segment: RouteSegmentDetail,
  anchorPoint: Point,
  blockedBoxes: readonly BlockingBox[]
): HorizontalLabelPlacementCandidate[] {
  const xBase = anchorPoint.x - measuredLabel.width / 2;
  const xOffsets: number[] = [0];
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    xOffsets.push(attempt * FIXED_LABEL_CLEARANCE);
    xOffsets.push(-attempt * FIXED_LABEL_CLEARANCE);
  }

  const yCandidates: Array<{ y: number; tierRank: number }> = [];
  for (let attempt = 0; attempt <= 6; attempt += 1) {
    const extra = attempt * FIXED_LABEL_CLEARANCE;
    yCandidates.push({
      y: roundMetric(segment.coordinate + FIXED_LABEL_CLEARANCE + extra),
      tierRank: attempt * 2
    });
    yCandidates.push({
      y: roundMetric(segment.coordinate - FIXED_LABEL_CLEARANCE - measuredLabel.height - extra),
      tierRank: attempt * 2 + 1
    });
  }
  yCandidates.push({
    y: roundMetric(anchorPoint.y - measuredLabel.height / 2),
    tierRank: 100
  });

  const seen = new Set<string>();
  const candidates: HorizontalLabelPlacementCandidate[] = [];
  for (const yCandidate of yCandidates) {
    for (const xOffset of xOffsets) {
      const box = buildLabelBox(
        xBase + xOffset,
        yCandidate.y,
        measuredLabel.width,
        measuredLabel.height
      );
      const key = `${box.x}|${box.y}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      candidates.push({
        box,
        distanceFromAnchor: Math.hypot(
          box.x + box.width / 2 - anchorPoint.x,
          box.y + box.height / 2 - anchorPoint.y
        ),
        tierRank: yCandidate.tierRank,
        minimumBlockerClearance: measureMinimumBoxClearance(box, blockedBoxes)
      });
    }
  }

  return candidates.sort((left, right) => {
    if (left.tierRank !== right.tierRank) {
      return left.tierRank - right.tierRank;
    }
    if (Math.abs(left.distanceFromAnchor - right.distanceFromAnchor) > 0.001) {
      return left.distanceFromAnchor - right.distanceFromAnchor;
    }
    if (left.minimumBlockerClearance > right.minimumBlockerClearance + 0.001) {
      return -1;
    }
    if (right.minimumBlockerClearance > left.minimumBlockerClearance + 0.001) {
      return 1;
    }
    return left.box.x - right.box.x || left.box.y - right.box.y;
  });
}

function resolveScenarioHorizontalLabelPlacement(
  connectorId: string,
  measuredLabel: MeasuredEdgeLabel,
  segment: RouteSegmentDetail,
  anchorPoint: Point,
  connectorSegmentsById: ReadonlyMap<string, readonly ConnectorRouteSegmentDetail[]>,
  blockedBoxes: readonly BlockingBox[],
  separatorSegments: readonly HorizontalLineSegment[],
  scene: PositionedScene,
  connectorBlockMode: "vertical_only" | "all_segments",
  separatorBlockMode: "vertical_stem" | "box"
): ConnectorLabelPlacementResult {
  const candidates = buildScenarioHorizontalLabelSearchCandidates(
    measuredLabel,
    segment,
    anchorPoint,
    blockedBoxes
  );

  for (const candidate of candidates) {
    if (!isHorizontalLabelBlocked(
      candidate.box,
      connectorId,
      connectorSegmentsById,
      blockedBoxes,
      separatorSegments,
      scene,
      connectorBlockMode,
      separatorBlockMode
    )) {
      return {
        label: buildPositionedEdgeLabelFromBox(measuredLabel, candidate.box),
        box: candidate.box,
        fallback: false,
        distanceFromAnchor: candidate.distanceFromAnchor
      };
    }
  }

  const fallback = candidates.find((candidate) => isLabelBoxWithinScene(scene, candidate.box)) ?? candidates[0];
  if (!fallback) {
    const box = buildHorizontalLabelBox(anchorPoint, measuredLabel);
    return {
      label: buildPositionedEdgeLabelFromBox(measuredLabel, box),
      box,
      fallback: true,
      distanceFromAnchor: 0
    };
  }

  return {
    label: buildPositionedEdgeLabelFromBox(measuredLabel, fallback.box),
    box: fallback.box,
    fallback: true,
    distanceFromAnchor: fallback.distanceFromAnchor
  };
}

function compareAnchorPlacementCandidates(
  left: {
    anchor: ConnectorLabelAnchorCandidate;
    placement: ConnectorLabelPlacementResult;
    minimumBlockerClearance: number;
  },
  right: {
    anchor: ConnectorLabelAnchorCandidate;
    placement: ConnectorLabelPlacementResult;
    minimumBlockerClearance: number;
  }
): number {
  if (left.placement.fallback !== right.placement.fallback) {
    return left.placement.fallback ? 1 : -1;
  }
  if (left.minimumBlockerClearance > right.minimumBlockerClearance + 0.001) {
    return -1;
  }
  if (right.minimumBlockerClearance > left.minimumBlockerClearance + 0.001) {
    return 1;
  }
  if (left.anchor.routeDistanceFromMidpoint + 0.001 < right.anchor.routeDistanceFromMidpoint) {
    return -1;
  }
  if (right.anchor.routeDistanceFromMidpoint + 0.001 < left.anchor.routeDistanceFromMidpoint) {
    return 1;
  }

  const leftSegmentLength = getRouteSegmentLength(left.anchor.segment);
  const rightSegmentLength = getRouteSegmentLength(right.anchor.segment);
  if (leftSegmentLength > rightSegmentLength + 0.001) {
    return -1;
  }
  if (rightSegmentLength > leftSegmentLength + 0.001) {
    return 1;
  }
  return right.anchor.segment.routeSegmentIndex - left.anchor.segment.routeSegmentIndex;
}

export function positionConnectorLabel(
  options: ConnectorLabelPlacementOptions
): PositionedEdgeLabel | undefined {
  const {
    connectorId,
    measuredLabel,
    route,
    connectorSegmentsById,
    blockedBoxes,
    separatorSegments,
    scene,
    diagnostics,
    diagnosticsPolicy
  } = options;
  const connectorBlockMode = options.connectorBlockMode ?? "vertical_only";
  const separatorBlockMode = options.separatorBlockMode ?? "vertical_stem";
  const horizontalPlacementMode = options.horizontalPlacementMode ?? "service_shift_right";
  const diagnosticSeverity = diagnosticsPolicy.severity ?? "info";

  const anchorCandidates = buildConnectorLabelAnchorCandidates(route);
  if (!anchorCandidates || anchorCandidates.length === 0) {
    diagnostics.push(
      createRoutingDiagnostic(
        diagnosticsPolicy.omittedCode,
        diagnosticsPolicy.noAnchorMessage(connectorId),
        connectorId,
        diagnosticSeverity
      )
    );
    return undefined;
  }

  const scoredCandidates = anchorCandidates.map((anchor) => {
    const placement = anchor.segment.orientation === "vertical"
      ? resolveVerticalLabelPlacement(
          connectorId,
          measuredLabel,
          anchor.segment,
          anchor.point,
          connectorSegmentsById,
          blockedBoxes,
          separatorSegments,
          scene,
          connectorBlockMode,
          separatorBlockMode
        )
      : horizontalPlacementMode === "scenario_side_offsets"
        ? resolveScenarioHorizontalLabelPlacement(
            connectorId,
            measuredLabel,
            anchor.segment,
            anchor.point,
            connectorSegmentsById,
            blockedBoxes,
            separatorSegments,
            scene,
            connectorBlockMode,
            separatorBlockMode
          )
        : resolveServiceHorizontalLabelPlacement(
            connectorId,
            measuredLabel,
            anchor.point,
            connectorSegmentsById,
            blockedBoxes,
            separatorSegments,
            scene,
            connectorBlockMode,
            separatorBlockMode
          );

    return {
      anchor,
      placement,
      minimumBlockerClearance: measureMinimumBoxClearance(placement.box, blockedBoxes)
    };
  }).sort(compareAnchorPlacementCandidates);

  const chosen = scoredCandidates[0];
  if (!chosen) {
    diagnostics.push(
      createRoutingDiagnostic(
        diagnosticsPolicy.omittedCode,
        diagnosticsPolicy.noCandidateMessage(connectorId),
        connectorId,
        diagnosticSeverity
      )
    );
    return undefined;
  }

  if (chosen.placement.fallback) {
    diagnostics.push(
      createRoutingDiagnostic(
        diagnosticsPolicy.fallbackCode,
        diagnosticsPolicy.fallbackMessage(connectorId),
        connectorId,
        diagnosticSeverity
      )
    );
  }

  return chosen.placement.label;
}
