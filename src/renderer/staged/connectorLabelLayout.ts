import type { MeasuredEdgeLabel, PositionedEdge, PositionedEdgeLabel, PositionedItem, PositionedScene } from "./contracts.js";
import {
  buildConnectorRouteSegmentsById, buildRouteSegmentDetails, FIXED_LABEL_CLEARANCE,
  FIXED_LABEL_DISTANCE, positionConnectorLabel,
  type BlockingBox, type HorizontalLineSegment, type LabelBox, type RouteSegmentDetail
} from "./connectorLabelPlacement.js";
import { labelBoxDistanceToSegment, labelBoxIntersectsSegment, labelBoxesOverlap } from "./labelCollisionGeometry.js";
import { arrowMarkerFootprintBox } from "./markerGeometry.js";
import { resolveRendererTheme } from "./theme.js";
import { createTextMeasurementService } from "./textMeasurement.js";

const EPSILON = 0.5;
const metric = (value: number): number => Math.round(value * 1000) / 1000;
export type ConnectorLabelProblemKind = "missing" | "detached" | "node" | "header" | "separator" | "label" | "connector" | "marker" | "bounds";
export interface ConnectorLabelProblem { connectorId: string; kind: ConnectorLabelProblemKind; obstacleId?: string }
export interface ConnectorLabelObstacle extends BlockingBox { kind: "node" | "header" | "marker"; id: string }
export interface ConnectorLabelLayoutInput {
  scene: PositionedScene;
  expectedLabels: ReadonlyMap<string, MeasuredEdgeLabel>;
  /** Adapter-owned geometric envelopes, never semantic identifiers. */
  scopeByConnectorId?: ReadonlyMap<string, LabelBox>;
  separators?: readonly HorizontalLineSegment[];
}
export interface ConnectorLabelAssessment {
  labels: ReadonlyMap<string, PositionedEdgeLabel>;
  anchorByConnectorId: ReadonlyMap<string, RouteSegmentDetail>;
  problems: readonly ConnectorLabelProblem[];
  comparisonKey: readonly number[];
}

export function labelAssociatedWithSegment(box: LabelBox, segment: RouteSegmentDetail): boolean {
  const horizontal = segment.orientation === "horizontal";
  const axis = horizontal ? "x" : "y", extent = horizontal ? "width" : "height";
  const start = Math.min(segment.start[axis], segment.end[axis]);
  const end = Math.max(segment.start[axis], segment.end[axis]);
  if (end - start <= EPSILON) return false;
  const overlap = Math.min(box[axis] + box[extent], end) - Math.max(box[axis], start);
  return overlap >= Math.min(FIXED_LABEL_CLEARANCE, box[extent], end - start) - EPSILON
    && labelBoxDistanceToSegment(box, segment) <= FIXED_LABEL_DISTANCE + EPSILON;
}

function contains(outer: LabelBox, inner: LabelBox): boolean {
  return inner.x >= outer.x - EPSILON && inner.y >= outer.y - EPSILON
    && inner.x + inner.width <= outer.x + outer.width + EPSILON
    && inner.y + inner.height <= outer.y + outer.height + EPSILON;
}
function inflate(box: LabelBox, clearance: number): LabelBox {
  return { x: metric(box.x - clearance), y: metric(box.y - clearance),
    width: metric(box.width + clearance * 2), height: metric(box.height + clearance * 2) };
}

export function collectConnectorLabelObstacles(scene: PositionedScene): ConnectorLabelObstacle[] {
  const obstacles: ConnectorLabelObstacle[] = [];
  const visit = (item: PositionedItem): void => {
    if (item.kind === "node") {
      obstacles.push({ ...inflate(item, FIXED_LABEL_DISTANCE), id: item.id, itemId: item.id, kind: "node" });
      return;
    }
    if (item.chrome.headerBandHeight && item.chrome.headerBandHeight > 0) obstacles.push({ id: `${item.id}:header`, kind: "header",
      x: item.x, y: item.y, width: item.width, height: item.chrome.headerBandHeight });
    for (const block of item.headerContent) obstacles.push({ id: block.id, kind: "header",
      x: item.x + block.x, y: item.y + block.y, width: block.width, height: block.height });
    item.children.forEach(visit);
  };
  visit(scene.root);
  const theme = resolveRendererTheme(scene.themeId).theme;
  const measure = createTextMeasurementService(theme.fontFaces);
  for (const decoration of scene.decorations) if (decoration.kind === "text") {
    const style = theme.textStyles[decoration.textStyleRole] ?? theme.textStyles.label!;
    obstacles.push({ id: decoration.id, kind: "header", x: decoration.x, y: decoration.y,
      width: measure.measureText(decoration.text, style), height: style.lineHeight });
  }
  for (const edge of scene.edges) {
    const points = edge.route.points;
    if (points.length < 2) continue;
    for (const end of ["start", "end"] as const) {
      if (edge.markers?.[end] !== "arrow") continue;
      const tip = end === "start" ? points[0]! : points.at(-1)!;
      const neighbor = end === "start" ? points[1]! : points.at(-2)!;
      const box = arrowMarkerFootprintBox(tip, neighbor, theme.paint.arrowSize, theme.paint.edgeStrokeWidth);
      if (box) obstacles.push({ ...box, id: `${edge.id}:${end}`, kind: "marker" });
    }
  }
  return obstacles;
}

function buildAudit(input: ConnectorLabelLayoutInput) {
  const segments = buildConnectorRouteSegmentsById(input.scene.edges, edge => edge.id, edge => edge.route);
  const obstacles = collectConnectorLabelObstacles(input.scene);
  const problemsFor = (id: string, box: PositionedEdgeLabel | undefined,
    labels: ReadonlyMap<string, PositionedEdgeLabel>): ConnectorLabelProblem[] => {
    if (!box) return [{ connectorId: id, kind: "missing" }];
    const problems: ConnectorLabelProblem[] = [];
    const add = (kind: ConnectorLabelProblemKind, obstacleId?: string) => problems.push({ connectorId: id, kind, obstacleId });
    if (!contains(input.scene.root, box) || !contains(input.scopeByConnectorId?.get(id) ?? input.scene.root, box)) add("bounds");
    if (!(segments.get(id) ?? []).some(segment => labelAssociatedWithSegment(box, segment))) add("detached");
    for (const obstacle of obstacles) if (labelBoxesOverlap(box, obstacle)) add(obstacle.kind, obstacle.id);
    for (const [otherId, other] of labels) if (otherId !== id && labelBoxesOverlap(box, inflate(other, FIXED_LABEL_DISTANCE))) add("label", otherId);
    for (const [otherId, details] of segments) if (otherId !== id && details.some(segment => labelBoxIntersectsSegment(box, segment))) add("connector", otherId);
    for (const separator of input.separators ?? []) if (labelBoxIntersectsSegment(box, {
      routeSegmentIndex: 0, orientation: "horizontal", coordinate: separator.coordinate,
      start: { x: separator.spanStart, y: separator.coordinate }, end: { x: separator.spanEnd, y: separator.coordinate }
    })) add("separator");
    return problems;
  };
  return { segments, obstacles, problemsFor };
}

/** Independent audit of the exact scene to be emitted; never trusts placement flags. */
export function auditConnectorLabels(input: ConnectorLabelLayoutInput): ConnectorLabelAssessment {
  const audit = buildAudit(input);
  const labels = new Map(input.scene.edges.flatMap(edge => edge.label ? [[edge.id, edge.label] as const] : []));
  const problems = [...input.expectedLabels.keys()].flatMap(id => audit.problemsFor(id, labels.get(id), labels));
  const anchors = new Map<string, RouteSegmentDetail>();
  let distance = 0;
  for (const [id, label] of labels) {
    const details = (audit.segments.get(id) ?? []).filter(segment =>
      Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y) > EPSILON);
    const sorted = [...details].sort((a, b) =>
      Number(labelAssociatedWithSegment(label, b)) - Number(labelAssociatedWithSegment(label, a))
      || labelBoxDistanceToSegment(label, a) - labelBoxDistanceToSegment(label, b)
      || a.routeSegmentIndex - b.routeSegmentIndex);
    if (sorted[0]) {
      anchors.set(id, sorted[0]);
      if (!labelAssociatedWithSegment(label, sorted[0])) distance += labelBoxDistanceToSegment(label, sorted[0]);
    }
  }
  const count = (kind: ConnectorLabelProblemKind) => problems.filter(problem => problem.kind === kind).length;
  return { labels, anchorByConnectorId: anchors, problems,
    comparisonKey: [count("missing"), problems.filter(p => p.kind !== "missing" && p.kind !== "detached").length,
      count("detached"), metric(distance), metric(input.scene.root.width * input.scene.root.height)] };
}

/** Retains valid placements; only opting-in adapters use the stronger search. */
export function assessConnectorLabels(input: ConnectorLabelLayoutInput): ConnectorLabelAssessment {
  const audit = buildAudit(input);
  const original = new Map(input.scene.edges.flatMap(edge => edge.label ? [[edge.id, edge.label] as const] : []));
  const retained = new Map<string, PositionedEdgeLabel>();
  const pending: PositionedEdge[] = [];
  for (const edge of input.scene.edges) {
    if (!input.expectedLabels.has(edge.id)) continue;
    if (edge.label && !audit.problemsFor(edge.id, edge.label, original).length) retained.set(edge.id, edge.label);
    else pending.push(edge);
  }
  for (const edge of pending) {
    const measured = input.expectedLabels.get(edge.id)!;
    const segments = buildRouteSegmentDetails(edge.route).filter(segment =>
      Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y) > EPSILON);
    const candidates: PositionedEdgeLabel[] = [];
    for (const segment of segments) {
      const label = positionConnectorLabel({
        connectorId: edge.id, measuredLabel: measured,
        route: { ...edge.route, points: [segment.start, segment.end] }, connectorSegmentsById: audit.segments,
        blockedBoxes: [...audit.obstacles, ...[...retained.values()].map(box => inflate(box, FIXED_LABEL_DISTANCE))],
        separatorSegments: input.separators ?? [], scene: input.scene, diagnostics: [],
        connectorBlockMode: "all_segments", separatorBlockMode: "box", horizontalPlacementMode: "scenario_side_offsets",
        horizontalSideLabelDistance: FIXED_LABEL_DISTANCE, includeAdjacentHorizontalLabelAnchors: true,
        horizontalLabelAssociationPolicy: { maxDetachedDistance: FIXED_LABEL_DISTANCE,
          minStrongOverlap: FIXED_LABEL_CLEARANCE, maxStrongDetachedDistance: FIXED_LABEL_DISTANCE },
        isCandidateAcceptable: box => labelAssociatedWithSegment(box, segment)
          && !audit.problemsFor(edge.id, { ...measured, ...box }, retained).length,
        diagnosticsPolicy: { omittedCode: "unused", fallbackCode: "unused", noAnchorMessage: id => id,
          noCandidateMessage: id => id, fallbackMessage: id => id }
      });
      if (label && !audit.problemsFor(edge.id, label, retained).length) candidates.push(label);
    }
    // Prefer minimal displacement from an existing label, then canonical geometry.
    const old = original.get(edge.id);
    candidates.sort((a, b) => (old ? Math.hypot(a.x - old.x, a.y - old.y) - Math.hypot(b.x - old.x, b.y - old.y) : 0)
      || a.x - b.x || a.y - b.y);
    const fallback = old ?? { ...measured, x: edge.route.points[0]?.x ?? input.scene.root.x,
      y: edge.route.points[0]?.y ?? input.scene.root.y };
    retained.set(edge.id, candidates[0] ?? fallback);
  }
  return auditConnectorLabels({ ...input, scene: { ...input.scene,
    edges: input.scene.edges.map(edge => ({ ...edge, label: retained.get(edge.id) ?? edge.label })) } });
}

export interface ConnectorLabelCorridor {
  owner: string;
  axis: "x" | "y";
  bounds: LabelBox;
  /** Connectors traversing this physical gap, supplied by the layout owner. */
  connectorIds: readonly string[];
  margin: number;
}
export interface ConnectorLabelCapacityRequest {
  owner: string; axis: "x" | "y"; availableSize: number; requiredSize: number; connectorIds: string[];
}
export interface ConnectorLabelCapacityClaim {
  owner: string; connectorId: string; priority: number; spanStart: number; spanEnd: number; thickness: number;
}

/** First-fit interval packing. Disjoint spans reuse a track; duplicate claims merge. */
export function measureConnectorLabelCapacity(corridors: readonly ConnectorLabelCorridor[],
  claims: readonly ConnectorLabelCapacityClaim[], separation: number): ConnectorLabelCapacityRequest[] {
  const requests = new Map<string, ConnectorLabelCapacityRequest>();
  for (const corridor of corridors) {
    const byId = new Map<string, ConnectorLabelCapacityClaim>();
    for (const claim of claims.filter(c => c.owner === corridor.owner)) {
      const old = byId.get(claim.connectorId);
      byId.set(claim.connectorId, old ? { ...old, spanStart: Math.min(old.spanStart, claim.spanStart),
        spanEnd: Math.max(old.spanEnd, claim.spanEnd), thickness: Math.max(old.thickness, claim.thickness) } : { ...claim });
    }
    const ordered = [...byId.values()].sort((a, b) => a.priority - b.priority || a.connectorId.localeCompare(b.connectorId));
    const tracks: { claims: ConnectorLabelCapacityClaim[]; thickness: number }[] = [];
    for (const claim of ordered) {
      let track = tracks.find(track => track.claims.every(other =>
        Math.min(other.spanEnd, claim.spanEnd) - Math.max(other.spanStart, claim.spanStart) <= EPSILON));
      if (!track) { track = { claims: [], thickness: 0 }; tracks.push(track); }
      track.claims.push(claim); track.thickness = Math.max(track.thickness, claim.thickness);
    }
    const requiredSize = metric(corridor.margin * 2 + tracks.reduce((sum, t) => sum + t.thickness, 0)
      + Math.max(0, tracks.length - 1) * separation);
    const availableSize = corridor.axis === "x" ? corridor.bounds.width : corridor.bounds.height;
    if (!ordered.length || requiredSize <= availableSize + EPSILON) continue;
    const key = `${corridor.axis}:${corridor.owner}`;
    const existing = requests.get(key);
    if (!existing || requiredSize - availableSize > existing.requiredSize - existing.availableSize) requests.set(key,
      { owner: corridor.owner, axis: corridor.axis, availableSize, requiredSize,
        connectorIds: ordered.map(claim => claim.connectorId) });
  }
  return [...requests.values()].sort((a, b) => a.axis.localeCompare(b.axis) || a.owner.localeCompare(b.owner));
}

/** One chosen anchor per label. The supporting route and label share one claim. */
export function connectorLabelCapacityClaims(input: ConnectorLabelLayoutInput,
  assessment: ConnectorLabelAssessment, corridors: readonly ConnectorLabelCorridor[]): ConnectorLabelCapacityClaim[] {
  const unresolved = new Set(assessment.problems.map(problem => problem.connectorId));
  // Choose one prospective anchor once, before projecting demand into either axis.
  const anchorById = new Map(assessment.anchorByConnectorId);
  for (const edge of input.scene.edges) if (unresolved.has(edge.id)) {
    const details = buildRouteSegmentDetails(edge.route).filter(segment =>
      Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y) > EPSILON);
    const length = (segment: RouteSegmentDetail) => Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y);
    details.sort((a, b) => length(b) - length(a) || a.routeSegmentIndex - b.routeSegmentIndex);
    if (details[0]) anchorById.set(edge.id, details[0]);
  }
  const claims: ConnectorLabelCapacityClaim[] = [];
  for (const corridor of corridors) {
    if (!corridor.connectorIds.some(id => unresolved.has(id))) continue;
    for (const [priority, edge] of input.scene.edges.entries()) {
      if (!corridor.connectorIds.includes(edge.id)) continue;
      const label = input.expectedLabels.get(edge.id);
      const anchor = anchorById.get(edge.id);
      const axis = corridor.axis === "x" ? "y" : "x";
      const extent = axis === "x" ? "width" : "height";
      const details = buildRouteSegmentDetails(edge.route);
      const low = corridor.bounds[corridor.axis];
      const high = low + (corridor.axis === "x" ? corridor.bounds.width : corridor.bounds.height);
      const runs = details.filter(segment => Math.max(segment.start[corridor.axis], segment.end[corridor.axis]) > low + EPSILON
        && Math.min(segment.start[corridor.axis], segment.end[corridor.axis]) < high - EPSILON);
      if (!runs.length) continue;
      const anchorPosition = anchor ? (anchor.start[corridor.axis] + anchor.end[corridor.axis]) / 2 : undefined;
      const ownsLabel = !!label && anchorPosition !== undefined && anchorPosition >= low - EPSILON && anchorPosition <= high + EPSILON;
      const start = Math.min(...runs.flatMap(segment => [segment.start[axis], segment.end[axis]]));
      const end = Math.max(...runs.flatMap(segment => [segment.start[axis], segment.end[axis]]));
      const center = anchor ? (anchor.start[axis] + anchor.end[axis]) / 2 : (start + end) / 2;
      const alongLabel = ownsLabel ? label![extent] + FIXED_LABEL_CLEARANCE : 0;
      claims.push({ owner: corridor.owner, connectorId: edge.id, priority,
        spanStart: Math.min(start, center - alongLabel / 2), spanEnd: Math.max(end, center + alongLabel / 2),
        thickness: ownsLabel ? (corridor.axis === "x" ? label!.width : label!.height) + FIXED_LABEL_CLEARANCE : 0 });
    }
  }
  return claims;
}
