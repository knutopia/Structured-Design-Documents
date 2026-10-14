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

/** Wrapping may split a word; only source whitespace at a line boundary may disappear. */
export function wrappedLabelPreservesText(lines: readonly string[], sourceText: string): boolean {
  const expected = sourceText.replace(/\s+/g, " ").trim();
  let cursor = 0;
  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (!expected.startsWith(line, cursor)) return false;
    cursor += line.length;
    if (index < lines.length - 1 && expected[cursor] === " ") cursor++;
  }
  return cursor === expected.length;
}
export type ConnectorLabelProblemKind = "missing" | "detached" | "ambiguous" | "node" | "header" | "separator" | "label" | "connector" | "marker" | "bounds";
export interface ConnectorLabelProblem { connectorId: string; kind: ConnectorLabelProblemKind; obstacleId?: string }
export interface ConnectorLabelObstacle extends BlockingBox { kind: "node" | "header" | "marker"; id: string }
export interface ConnectorLabelLayoutInput {
  scene: PositionedScene;
  expectedLabels: ReadonlyMap<string, MeasuredEdgeLabel>;
  /** Adapter-owned geometric envelopes, never semantic identifiers. */
  scopeByConnectorId?: ReadonlyMap<string, LabelBox>;
  separators?: readonly HorizontalLineSegment[];
  /** Reject a label that associates at least as closely with a competing route. */
  rejectAmbiguousAssociation?: boolean;
  eventBasedHorizontalSearch?: boolean;
  /** Require the label beside a segment at FIXED_LABEL_DISTANCE, never over its stroke. */
  requireAdjacentLabels?: boolean;
  /** Cheap complete-revision assessment: probe the two adjacent rows per
   * segment instead of local offset search. Requires requireAdjacentLabels;
   * unresolved probes must undergo full assessment before final acceptance. */
  adjacentProbeOnly?: boolean;
  /** A partial-scene scorer may reserve offset-event probes for complete scenes.
   * Default true; false keeps prospective assessment to two rows per segment. */
  prospectiveOffsetEvents?: boolean;
  /** Partial-revision scoring may search only new connectors. Other supplied
   * labels remain in place and are still independently audited for conflicts. */
  searchConnectorIds?: ReadonlySet<string>;
  /** Minimum Euclidean box-to-segment distance for every unrelated route. */
  unrelatedRouteClearance?: number;
  /** Adapter-selected prospective anchors, also used when placement is unresolved. */
  preferredAnchorByConnectorId?: ReadonlyMap<string, RouteSegmentDetail>;
  /** Mutable shared remaining allowance; independent auditing never consumes it. */
  searchBudget?: { candidates: number };
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
    const ownAnchors = (segments.get(id) ?? []).filter(segment => labelAssociatedWithSegment(box, segment));
    const ownDistance = Math.min(...(segments.get(id) ?? []).map(segment => labelBoxDistanceToSegment(box, segment)));
    if (!ownAnchors.length || (input.requireAdjacentLabels
      && Math.abs(ownDistance - FIXED_LABEL_DISTANCE) > EPSILON)) add("detached");
    if (input.rejectAmbiguousAssociation && ownAnchors.length) {
      const ownDistance = Math.min(...ownAnchors.map(segment => labelBoxDistanceToSegment(box, segment)));
      for (const [otherId, details] of segments) {
        if (otherId !== id && details.some(segment => (input.requireAdjacentLabels || labelAssociatedWithSegment(box, segment))
          && labelBoxDistanceToSegment(box, segment) <= ownDistance + EPSILON)) add("ambiguous", otherId);
      }
    }
    for (const obstacle of obstacles) if (labelBoxesOverlap(box, obstacle)) add(obstacle.kind, obstacle.id);
    for (const [otherId, other] of labels) if (otherId !== id && labelBoxesOverlap(box, inflate(other, FIXED_LABEL_DISTANCE))) add("label", otherId);
    for (const [otherId, details] of segments) if (otherId !== id && details.some(segment => labelBoxIntersectsSegment(box, segment)
      || (input.unrelatedRouteClearance !== undefined && labelBoxDistanceToSegment(box, segment) < input.unrelatedRouteClearance - EPSILON))) add("connector", otherId);
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

/** Both adjacent rows are obstructed regardless of along-segment offset.
 * A partial rival span never establishes this proof: local search may escape it. */
function adjacentRowsBlockedAcrossBounds(input: ConnectorLabelLayoutInput, connectorId: string,
  anchor: RouteSegmentDetail, label: MeasuredEdgeLabel, bounds: LabelBox): boolean {
  const clearance = input.unrelatedRouteClearance;
  if (!input.requireAdjacentLabels || !clearance) return false;
  const horizontal = anchor.orientation === "horizontal";
  const axis = horizontal ? "x" : "y";
  const low = bounds[axis], high = low + (horizontal ? bounds.width : bounds.height);
  const alongExtent = horizontal ? label.width : label.height;
  const rivals = input.scene.edges.filter(other => other.id !== connectorId)
    .flatMap(other => buildRouteSegmentDetails(other.route));
  const spanning = rivals.filter(segment => segment.orientation === anchor.orientation
    && Math.min(segment.start[axis], segment.end[axis]) <= low + EPSILON
    && Math.max(segment.start[axis], segment.end[axis]) >= high - EPSILON);
  const spansRow = (side: number) => {
    const adjacent = anchor.coordinate + (side < 0 ? -FIXED_LABEL_DISTANCE
      - (horizontal ? label.height : label.width) : FIXED_LABEL_DISTANCE);
    const row = horizontal ? { x: low, y: adjacent, width: high-low, height: label.height }
      : { x: adjacent, y: low, width: label.width, height: high-low };
    return spanning.some(segment => labelBoxDistanceToSegment(row, segment) < clearance - EPSILON);
  };
  if (spansRow(-1) && spansRow(1)) return true;
  // A narrow owner can grow around partial runs. Once the label fits its current
  // width, also detect the absence of a label-sized opening between such runs.
  if (high - low < alongExtent - EPSILON) return false;
  const blocked = (side: number): boolean => {
    const normalExtent = horizontal ? label.height : label.width;
    const adjacentStart = anchor.coordinate + (side < 0 ? -FIXED_LABEL_DISTANCE - normalExtent : FIXED_LABEL_DISTANCE);
    const adjacentEnd = adjacentStart + normalExtent;
    const overlap = Math.min(FIXED_LABEL_CLEARANCE, alongExtent,
      Math.abs(anchor.end[axis] - anchor.start[axis]));
    const domainLow = Math.max(low, Math.min(anchor.start[axis], anchor.end[axis]) + overlap - alongExtent);
    const domainHigh = Math.min(high - alongExtent, Math.max(anchor.start[axis], anchor.end[axis]) - overlap);
    if (domainHigh < domainLow - EPSILON) return true;
    const normalAxis = horizontal ? "y" : "x";
    const forbidden = rivals.flatMap(segment => {
      const normalLow = Math.min(segment.start[normalAxis], segment.end[normalAxis]);
      const normalHigh = Math.max(segment.start[normalAxis], segment.end[normalAxis]);
      const distance = Math.max(normalLow - adjacentEnd, adjacentStart - normalHigh, 0);
      const required = clearance - EPSILON;
      if (distance >= required) return [];
      const reach = Math.sqrt(required * required - distance * distance);
      return [[Math.min(segment.start[axis], segment.end[axis]) - reach - alongExtent,
        Math.max(segment.start[axis], segment.end[axis]) + reach] as const];
    });
    const events = [domainLow, domainHigh, ...forbidden.flatMap(interval => [...interval])]
      .filter(value => value >= domainLow && value <= domainHigh).sort((a,b) => a-b);
    const legal = (offset: number) => forbidden.every(([a,b]) => offset <= a || offset >= b);
    return !events.some((event,index) => legal(event)
      || index > 0 && legal((events[index-1]! + event)/2));
  };
  return blocked(-1) && blocked(1);
}

/** Retains valid placements; only opting-in adapters use the stronger search. */
export function assessConnectorLabels(input: ConnectorLabelLayoutInput): ConnectorLabelAssessment {
  const audit = buildAudit(input);
  const original = new Map(input.scene.edges.flatMap(edge => edge.label ? [[edge.id, edge.label] as const] : []));
  const retained = new Map<string, PositionedEdgeLabel>();
  const pending: PositionedEdge[] = [];
  for (const edge of input.scene.edges) {
    if (!input.expectedLabels.has(edge.id)) continue;
    if (input.searchConnectorIds && !input.searchConnectorIds.has(edge.id)) {
      if (edge.label) retained.set(edge.id, edge.label);
      continue;
    }
    if (edge.label && !audit.problemsFor(edge.id, edge.label, original).length) retained.set(edge.id, edge.label);
    else pending.push(edge);
  }
  for (const edge of pending) {
    const measured = input.expectedLabels.get(edge.id)!;
    const segments = buildRouteSegmentDetails(edge.route).filter(segment =>
      Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y) > EPSILON);
    const candidates: PositionedEdgeLabel[] = [];
    const scope = input.scopeByConnectorId?.get(edge.id) ?? input.scene.root;
    const impossibleScope = input.requireAdjacentLabels && (scope.width + EPSILON * 2 < measured.width
      || scope.height + EPSILON * 2 < measured.height);
    for (const segment of impossibleScope || (input.requireAdjacentLabels && input.adjacentProbeOnly) ? [] : segments) {
      if (input.searchBudget && input.searchBudget.candidates <= 0) break;
      if (adjacentRowsBlockedAcrossBounds(input, edge.id, segment, measured, scope)) continue;
      const label = positionConnectorLabel({
        connectorId: edge.id, measuredLabel: measured, searchBudget: input.searchBudget,
        route: { ...edge.route, points: [segment.start, segment.end] }, connectorSegmentsById: audit.segments,
        blockedBoxes: [...audit.obstacles, ...[...retained.values()].map(box => inflate(box, FIXED_LABEL_DISTANCE))],
        separatorSegments: input.separators ?? [], scene: input.requireAdjacentLabels && input.scopeByConnectorId?.has(edge.id)
          ? { ...input.scene, root: { ...input.scene.root, ...input.scopeByConnectorId.get(edge.id)! } } : input.scene, diagnostics: [],
        connectorBlockMode: "all_segments", separatorBlockMode: "box", horizontalPlacementMode: "scenario_side_offsets",
        horizontalSideLabelDistance: FIXED_LABEL_DISTANCE, includeAdjacentHorizontalLabelAnchors: true,
        preferHorizontalSidePlacement: input.requireAdjacentLabels,
        eventBasedHorizontalSearch: input.eventBasedHorizontalSearch,
        eventBasedVerticalSearch: input.requireAdjacentLabels,
        includeScopeBoundaryEvents: input.requireAdjacentLabels,
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
    // Even when the gutter is too narrow, preserve a prospective *row* that
    // satisfies owning/competing-route association. Reflow grows that corridor;
    // reusing the old overlapping fallback would incorrectly sum label widths.
    const prospective: PositionedEdgeLabel[] = [];
    if (input.requireAdjacentLabels && !candidates.length && (!input.searchBudget || input.searchBudget.candidates > 0)) {
      const scope = input.scopeByConnectorId?.get(edge.id) ?? input.scene.root;
      const verticalDistances = new Map<PositionedEdgeLabel, number>();
      for (const segment of segments) {
        if (input.searchBudget && input.searchBudget.candidates <= 0) break;
        const horizontal = segment.orientation === "horizontal";
        const center = horizontal ? scope.x + scope.width / 2 : scope.y + scope.height / 2;
        const centerTop = center - measured.height / 2;
        const centers: PositionedEdgeLabel[] = [];
        const probe = (side: number, top: number): void => {
          if (input.searchBudget) {
            if (input.searchBudget.candidates <= 0) return;
            input.searchBudget.candidates--;
          }
          const box = { ...measured,
            x: horizontal ? center - measured.width / 2
              : segment.coordinate + (side < 0 ? -FIXED_LABEL_DISTANCE - measured.width : FIXED_LABEL_DISTANCE),
            y: horizontal ? segment.coordinate + (side < 0 ? -FIXED_LABEL_DISTANCE - measured.height : FIXED_LABEL_DISTANCE) : top };
          if (!labelAssociatedWithSegment(box, segment)) return;
          prospective.push(box);
          if (!horizontal) verticalDistances.set(box, Math.abs(top - centerTop));
          if (top === centerTop) centers.push(box);
        };
        for (const side of [-1, 1]) probe(side, centerTop);
        if (!horizontal && input.prospectiveOffsetEvents !== false && centers.length === 2
          && !adjacentRowsBlockedAcrossBounds(input, edge.id, segment, measured, scope)
          && centers.every(box => audit.problemsFor(edge.id, box, retained).some(problem => problem.kind !== "bounds"))) {
          // Narrow X scopes still need a feasible prospective Y envelope. Use
          // actual clearance events instead of keeping a blocked midpoint row.
          const clearance = input.unrelatedRouteClearance ?? FIXED_LABEL_CLEARANCE;
          const events = new Set([scope.y, scope.y + scope.height - measured.height,
            Math.min(segment.start.y, segment.end.y), Math.max(segment.start.y, segment.end.y) - measured.height]);
          for (const [otherId, details] of audit.segments) if (otherId !== edge.id) for (const rival of details) {
            if (rival.orientation === "horizontal") {
              events.add(rival.coordinate + clearance);
              events.add(rival.coordinate - clearance - measured.height);
            } else {
              events.add(Math.max(rival.start.y, rival.end.y) + clearance);
              events.add(Math.min(rival.start.y, rival.end.y) - clearance - measured.height);
            }
          }
          events.delete(centerTop);
          for (const top of [...events].sort((a, b) => Math.abs(a - centerTop) - Math.abs(b - centerTop) || a - b)) {
            if (input.searchBudget && input.searchBudget.candidates <= 0) break;
            for (const side of [-1, 1]) probe(side, top);
          }
        }
      }
      const score = (box: PositionedEdgeLabel): readonly number[] => {
        const problems = audit.problemsFor(edge.id, box, retained);
        return [problems.filter(problem => problem.kind === "node" || problem.kind === "marker" || problem.kind === "detached").length,
          problems.filter(problem => problem.kind === "connector" || problem.kind === "ambiguous" || problem.kind === "label").length,
          problems.filter(problem => problem.kind === "bounds" || problem.kind === "header").length];
      };
      const scores = new Map(prospective.map(box => [box, score(box)]));
      prospective.sort((a, b) => scores.get(a)!.reduce((difference, value, index) => difference || value - scores.get(b)![index]!, 0)
        || (verticalDistances.has(a) && verticalDistances.has(b) ? verticalDistances.get(a)! - verticalDistances.get(b)! : 0)
        || a.y - b.y || a.x - b.x);
    }
    retained.set(edge.id, candidates[0] ?? prospective[0] ?? fallback);
  }
  return auditConnectorLabels({ ...input, scene: { ...input.scene,
    edges: input.scene.edges.map(edge => ({ ...edge, label: retained.get(edge.id) ?? edge.label })) } });
}

export interface ConnectorLabelRelativeClearanceDeficit {
  connectorId: string;
  otherConnectorId: string;
  axis: "x" | "y";
  direction: -1 | 1;
  deficit: number;
}

/** Measure the residual label displacement against adapter-supplied geometric
 * limits for competing tracks. Only whole-scope parallel coverage proves that
 * an along-segment label offset cannot escape. Mapping to reflow ownership
 * remains the adapter's responsibility. */
export function measureConnectorLabelRelativeClearanceDeficits(input: ConnectorLabelLayoutInput,
  assessment: ConnectorLabelAssessment,
  constrainedSegments: ReadonlyMap<string, readonly RouteSegmentDetail[]>): ConnectorLabelRelativeClearanceDeficit[] {
  const clearance = input.unrelatedRouteClearance;
  if (!clearance || !Number.isFinite(clearance) || clearance <= 0) return [];
  const records = new Map<string, ConnectorLabelRelativeClearanceDeficit>();
  for (const edge of input.scene.edges) {
    const measured = input.expectedLabels.get(edge.id), label = assessment.labels.get(edge.id);
    if (!measured || !label || label.width !== measured.width || label.height !== measured.height) continue;
    const scope = input.scopeByConnectorId?.get(edge.id) ?? input.scene.root;
    const ownSegments = buildRouteSegmentDetails(edge.route);
    if (input.requireAdjacentLabels && Math.abs(Math.min(...ownSegments.map(segment => labelBoxDistanceToSegment(label, segment)))
      - FIXED_LABEL_DISTANCE) > EPSILON) continue;
    const ownAnchors = ownSegments.filter(segment => labelAssociatedWithSegment(label, segment)
      && (!input.requireAdjacentLabels || Math.abs(labelBoxDistanceToSegment(label, segment) - FIXED_LABEL_DISTANCE) <= EPSILON));
    for (const own of ownAnchors) {
      const horizontal = own.orientation === "horizontal";
      const alongAxis = horizontal ? "x" : "y", alongExtent = horizontal ? "width" : "height";
      const axis = horizontal ? "y" : "x", extent = horizontal ? "height" : "width";
      for (const [otherConnectorId, segments] of constrainedSegments) {
        if (otherConnectorId === edge.id) continue;
        for (const segment of segments) {
          if (segment.orientation !== own.orientation
            || Math.min(segment.start[alongAxis], segment.end[alongAxis]) > scope[alongAxis] + EPSILON
            || Math.max(segment.start[alongAxis], segment.end[alongAxis]) < scope[alongAxis] + scope[alongExtent] - EPSILON) continue;
          const coordinate = segment.coordinate;
          const direction: -1 | 1 | undefined = label[axis] >= coordinate - EPSILON ? 1
            : label[axis] + label[extent] <= coordinate + EPSILON ? -1 : undefined;
          if (direction === undefined) continue;
          const gap = direction === 1 ? label[axis] - coordinate : coordinate - label[axis] - label[extent];
          const deficit = metric(clearance - Math.max(0, gap));
          if (!Number.isFinite(deficit) || deficit <= EPSILON) continue;
          const key = `${edge.id}\0${otherConnectorId}\0${axis}\0${direction}`;
          const old = records.get(key);
          if (!old || deficit > old.deficit) records.set(key, { connectorId: edge.id, otherConnectorId, axis, direction, deficit });
        }
      }
    }
  }
  return [...records.values()];
}

export interface ConnectorLabelMinimumScopeDeficit {
  connectorId: string;
  axis: "x" | "y";
  deficit: number;
}

/** Necessary measured-text size bound, independent of placement and search.
 * Adapters must combine deficits sharing a physical owner by maximum, never
 * sum: separate rows can reuse the same width. Association/rail clearance is
 * deliberately left to subsequent anchored capacity assessment. */
export function measureConnectorLabelMinimumScopeDeficits(input: ConnectorLabelLayoutInput): ConnectorLabelMinimumScopeDeficit[] {
  const deficits: ConnectorLabelMinimumScopeDeficit[] = [];
  for (const [connectorId, label] of input.expectedLabels) {
    const scope = input.scopeByConnectorId?.get(connectorId) ?? input.scene.root;
    for (const [axis, required, available] of [["x", label.width, scope.width], ["y", label.height, scope.height]] as const) {
      // Malformed geometry cannot establish a sound reflow demand. The normal
      // scene/measurement validation remains responsible for its rejection.
      if (!Number.isFinite(required) || !Number.isFinite(available) || required < 0 || available < 0) continue;
      const deficit = required - available;
      if (deficit > EPSILON * 2) deficits.push({ connectorId, axis, deficit: metric(deficit) });
    }
  }
  return deficits;
}

export interface ConnectorLabelScopeDeficit {
  connectorId: string;
  side: "left" | "right" | "top" | "bottom";
  deficit: number;
}

/**
 * Measure only selected, adjacent label envelopes whose sole failure is scope
 * containment. The adapter must supply a legal route revision and map the
 * geometric side to a real reflow owner; widening a gutter cannot fix its top.
 * Rival/marker/header/node conflicts require another candidate, not expansion
 * inferred from this function.
 */
export function measureConnectorLabelScopeDeficits(input: ConnectorLabelLayoutInput,
  assessment: ConnectorLabelAssessment): ConnectorLabelScopeDeficit[] {
  if (!input.requireAdjacentLabels) return [];
  const scene = { ...input.scene, edges: input.scene.edges.map(edge => ({ ...edge,
    label: assessment.labels.get(edge.id) ?? edge.label })) };
  const audited = auditConnectorLabels({ ...input, scene });
  const deficits: ConnectorLabelScopeDeficit[] = [];
  for (const [connectorId, measured] of input.expectedLabels) {
    const label = assessment.labels.get(connectorId);
    const scope = input.scopeByConnectorId?.get(connectorId) ?? input.scene.root;
    const problems = audited.problems.filter(problem => problem.connectorId === connectorId);
    if (!label || label.width !== measured.width || label.height !== measured.height
      || problems.some(problem => problem.kind !== "bounds") || !problems.length) continue;
    const sides: Array<[ConnectorLabelScopeDeficit["side"], number]> = [
      ["left", scope.x - label.x], ["right", label.x + label.width - scope.x - scope.width],
      ["top", scope.y - label.y], ["bottom", label.y + label.height - scope.y - scope.height]
    ];
    for (const [side, deficit] of sides) if (deficit > EPSILON) deficits.push({ connectorId, side, deficit: metric(deficit) });
  }
  return deficits;
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
export interface ConnectorLabelPhysicalRail {
  coordinate: number;
  spanStart: number;
  spanEnd: number;
}

/** Coalesce geometric observations of one physical rail without filling disjoint gaps.
 * Callers supply already validated parallel segments and use coordinate as identity. */
export function coalesceConnectorLabelPhysicalRails(rails: readonly ConnectorLabelPhysicalRail[]): ConnectorLabelPhysicalRail[] {
  if (rails.some(rail => ![rail.coordinate, rail.spanStart, rail.spanEnd].every(Number.isFinite))) {
    throw new RangeError("Physical label rails require finite geometry.");
  }
  const ordered = rails.map(rail => ({ coordinate: rail.coordinate, spanStart: Math.min(rail.spanStart, rail.spanEnd),
    spanEnd: Math.max(rail.spanStart, rail.spanEnd) })).sort((a, b) => a.coordinate - b.coordinate
      || a.spanStart - b.spanStart || a.spanEnd - b.spanEnd);
  const result: ConnectorLabelPhysicalRail[] = [];
  for (const rail of ordered) {
    const previous = result.at(-1);
    if (previous?.coordinate === rail.coordinate && rail.spanStart <= previous.spanEnd) previous.spanEnd = Math.max(previous.spanEnd, rail.spanEnd);
    else result.push({ ...rail });
  }
  return result;
}

export function measureConnectorLabelCapacity(corridors: readonly ConnectorLabelCorridor[],
  claims: readonly ConnectorLabelCapacityClaim[], separation: number,
  options: { mode?: "interval_peak" } = {}): ConnectorLabelCapacityRequest[] {
  const requests = new Map<string, ConnectorLabelCapacityRequest>();
  for (const corridor of corridors) {
    if (options.mode === "interval_peak") {
      const matching = claims.filter(claim => claim.owner === corridor.owner);
      const spanMin = corridor.axis === "x" ? corridor.bounds.y : corridor.bounds.x;
      const spanMax = spanMin + (corridor.axis === "x" ? corridor.bounds.height : corridor.bounds.width);
      if (![spanMin, spanMax, corridor.margin, separation, corridor.bounds.width, corridor.bounds.height].every(Number.isFinite)
        || corridor.margin < 0 || separation < 0 || corridor.bounds.width < 0 || corridor.bounds.height < 0
        || matching.some(claim => ![claim.spanStart, claim.spanEnd, claim.thickness].every(Number.isFinite) || claim.thickness < 0)) {
        throw new RangeError("Interval label capacity requires finite nonnegative measured geometry.");
      }
      const events = new Set<number>([spanMin, spanMax]);
      for (const claim of matching) for (const endpoint of [claim.spanStart, claim.spanEnd]) {
        if (endpoint > spanMin && endpoint < spanMax) events.add(endpoint);
      }
      const orderedEvents = [...events].sort((a, b) => a - b);
      let requiredSize = 0;
      for (let index = 1; index < orderedEvents.length; index++) {
        const start = orderedEvents[index - 1]!, end = orderedEvents[index]!;
        const active = new Map<string, number>();
        for (const claim of matching) if (Math.min(claim.spanStart, claim.spanEnd) < end
          && Math.max(claim.spanStart, claim.spanEnd) > start) {
          // Explicit physical identities coalesce duplicate observations only
          // where actually active; disjoint spans do not reserve their gap.
          active.set(claim.connectorId, Math.max(active.get(claim.connectorId) ?? 0, claim.thickness));
        }
        if (active.size) requiredSize = Math.max(requiredSize, corridor.margin * 2
          + [...active.values()].reduce((sum, thickness) => sum + thickness, 0)
          + Math.max(0, active.size - 1) * separation);
      }
      requiredSize = metric(requiredSize);
      const availableSize = corridor.axis === "x" ? corridor.bounds.width : corridor.bounds.height;
      if (requiredSize <= availableSize + EPSILON) continue;
      const key = `${corridor.axis}:${corridor.owner}`;
      const existing = requests.get(key);
      if (!existing || requiredSize - availableSize > existing.requiredSize - existing.availableSize) requests.set(key,
        { owner: corridor.owner, axis: corridor.axis, availableSize, requiredSize,
          connectorIds: [...new Set(matching.map(claim => claim.connectorId))].sort() });
      continue;
    }
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

/** Failed placements use a prospective route anchor rather than their detached fallback position. */
export function connectorLabelCapacityAnchors(input: ConnectorLabelLayoutInput,
  assessment: ConnectorLabelAssessment): ReadonlyMap<string, RouteSegmentDetail> {
  const unresolved = new Set(assessment.problems.map(problem => problem.connectorId));
  // Choose one prospective anchor once, before projecting demand into either axis.
  const anchorById = new Map(assessment.anchorByConnectorId);
  for (const edge of input.scene.edges) if (unresolved.has(edge.id)) {
    const selected = input.preferredAnchorByConnectorId?.get(edge.id);
    if (selected) { anchorById.set(edge.id, selected); continue; }
    // Stronger adapters retain the assessed anchor whenever it can carry the label
    // inside the same scope used by placement; do not grow a different corridor.
    const scope = input.scopeByConnectorId?.get(edge.id);
    const usable = (segment: RouteSegmentDetail): boolean => {
      if (!scope) return true;
      const axis = segment.orientation === "horizontal" ? "x" : "y";
      const extent = axis === "x" ? "width" : "height";
      return Math.min(Math.max(segment.start[axis], segment.end[axis]), scope[axis] + scope[extent])
        - Math.max(Math.min(segment.start[axis], segment.end[axis]), scope[axis]) > EPSILON
        && segment.coordinate >= scope[axis === "x" ? "y" : "x"] - EPSILON
        && segment.coordinate <= scope[axis === "x" ? "y" : "x"] + scope[axis === "x" ? "height" : "width"] + EPSILON;
    };
    if (input.requireAdjacentLabels && anchorById.has(edge.id) && usable(anchorById.get(edge.id)!)) continue;
    const details = buildRouteSegmentDetails(edge.route).filter(segment =>
      Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y) > EPSILON);
    const length = (segment: RouteSegmentDetail) => Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y);
    details.sort((a, b) => (input.requireAdjacentLabels ? Number(usable(b)) - Number(usable(a)) : 0)
      || length(b) - length(a) || a.routeSegmentIndex - b.routeSegmentIndex);
    if (details[0]) anchorById.set(edge.id, details[0]);
  }
  return anchorById;
}

/** One chosen anchor per label. The supporting route and label share one claim. */
export function connectorLabelCapacityClaims(input: ConnectorLabelLayoutInput,
  assessment: ConnectorLabelAssessment, corridors: readonly ConnectorLabelCorridor[]): ConnectorLabelCapacityClaim[] {
  const unresolved = new Set(assessment.problems.map(problem => problem.connectorId));
  const anchorById = connectorLabelCapacityAnchors(input, assessment);
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
      const scope = input.scopeByConnectorId?.get(edge.id);
      const scopeLow = scope?.[corridor.axis] ?? low;
      const scopeHigh = scope ? scopeLow + (corridor.axis === "x" ? scope.width : scope.height) : high;
      let ownsLabel = !!label && anchorPosition !== undefined && (input.requireAdjacentLabels && anchor
        ? Math.max(Math.min(anchor.start[corridor.axis], anchor.end[corridor.axis]), low, scopeLow)
          <= Math.min(Math.max(anchor.start[corridor.axis], anchor.end[corridor.axis]), high, scopeHigh) + EPSILON
        : anchorPosition >= low - EPSILON && anchorPosition <= high + EPSILON);
      if (ownsLabel && anchor && label && anchor.orientation === (corridor.axis === "x" ? "horizontal" : "vertical")
        && adjacentRowsBlockedAcrossBounds(input, edge.id, anchor, label, corridor.bounds)) ownsLabel = false;
      const start = Math.min(...runs.flatMap(segment => [segment.start[axis], segment.end[axis]]));
      const end = Math.max(...runs.flatMap(segment => [segment.start[axis], segment.end[axis]]));
      const center = anchor ? (anchor.start[axis] + anchor.end[axis]) / 2 : (start + end) / 2;
      const alongLabel = ownsLabel ? label![extent] + FIXED_LABEL_CLEARANCE : 0;
      const placed = assessment.labels.get(edge.id);
      if (input.requireAdjacentLabels && ownsLabel) {
        // A horizontal gap is consumed over the label's vertical envelope, not
        // every bend of its connector. Disjoint rows consequently reuse width.
        const labelCenter = placed ? placed[axis] + placed[extent] / 2 : center;
        claims.push({ owner: corridor.owner, connectorId: edge.id, priority,
          spanStart: labelCenter - alongLabel / 2, spanEnd: labelCenter + alongLabel / 2,
          thickness: corridor.axis === "x" ? label!.width : label!.height + FIXED_LABEL_CLEARANCE });
        continue;
      }
      claims.push({ owner: corridor.owner, connectorId: edge.id, priority,
        spanStart: Math.min(start, center - alongLabel / 2), spanEnd: Math.max(end, center + alongLabel / 2),
        thickness: ownsLabel ? (corridor.axis === "x" ? label!.width : label!.height) + FIXED_LABEL_CLEARANCE : 0 });
    }
  }
  return claims;
}
