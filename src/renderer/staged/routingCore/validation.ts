import {
  DEFAULT_ROUTING_POLICY,
  createRoutingSegmentId,
  type RoutingBox,
  type RoutingCrossingTreatment,
  type RoutingSegment,
  type RoutingValidationEdge,
  type RoutingValidationPolicy,
  type RoutingViolation
} from "./contracts.js";
import {
  buildCrossingKey,
  buildRoutingSegments,
  endpointDepartsIntoBox,
  getSegmentAxis,
  perpendicularSegmentsCross,
  pointsEqual,
  routingSegmentKey,
  segmentIntersectsBoxInterior,
  segmentLength,
  spanOverlapLength
} from "./geometry.js";

export interface RoutingValidationInput {
  edges: readonly RoutingValidationEdge[];
  boxes?: readonly RoutingBox[];
  policy?: Partial<RoutingValidationPolicy>;
  includeEdgeInteractions?: boolean;
}

interface EdgeSegments {
  edge: RoutingValidationEdge;
  segments: RoutingSegment[];
}

function violationForSegment(
  kind: RoutingViolation["kind"],
  message: string,
  connectorId: string,
  segment: RoutingSegment,
  boxId?: string
): RoutingViolation {
  return {
    kind,
    message,
    connectorIds: [connectorId],
    segmentIds: [segment.id],
    routeSegmentIndexes: [segment.routeSegmentIndex],
    boxId
  };
}

function buildEdgeSegments(edge: RoutingValidationEdge): EdgeSegments {
  return {
    edge,
    segments: buildRoutingSegments(edge.id, edge.points, {
      candidateId: "validation",
      sharedTrackGroupBySegmentIndex: edge.sharedTrackGroupBySegmentIndex
    })
  };
}

function crossingTreatment(
  policy: RoutingValidationPolicy,
  leftConnectorId: string,
  rightConnectorId: string
): RoutingCrossingTreatment {
  return policy.crossingTreatmentForPair?.(leftConnectorId, rightConnectorId)
    ?? policy.crossingTreatment;
}

function validateSingleEdge(
  edgeSegments: EdgeSegments,
  boxById: ReadonlyMap<string, RoutingBox>,
  boxes: readonly RoutingBox[],
  policy: RoutingValidationPolicy
): RoutingViolation[] {
  const { edge, segments } = edgeSegments;
  const violations: RoutingViolation[] = [];

  for (let index = 0; index < edge.points.length - 1; index += 1) {
    const start = edge.points[index]!;
    const end = edge.points[index + 1]!;
    if (edge.style === "orthogonal" && !getSegmentAxis(start, end, policy.epsilon)) {
      const segmentId = createRoutingSegmentId(edge.id, "validation", `run-${index}`);
      violations.push({
        kind: "non_orthogonal_segment",
        message: `Connector "${edge.id}" segment ${index} is not orthogonal.`,
        connectorIds: [edge.id],
        segmentIds: [segmentId],
        routeSegmentIndexes: [index]
      });
    }
  }

  const firstPoint = edge.points[0];
  const lastPoint = edge.points[edge.points.length - 1];
  if (edge.expectedSourcePoint && firstPoint
    && !pointsEqual(firstPoint, edge.expectedSourcePoint, policy.epsilon)) {
    violations.push({
      kind: "endpoint_mismatch",
      message: `Connector "${edge.id}" does not begin at its resolved source endpoint.`,
      connectorIds: [edge.id],
      segmentIds: segments[0] ? [segments[0].id] : []
    });
  }
  if (edge.expectedTargetPoint && lastPoint
    && !pointsEqual(lastPoint, edge.expectedTargetPoint, policy.epsilon)) {
    violations.push({
      kind: "endpoint_mismatch",
      message: `Connector "${edge.id}" does not end at its resolved target endpoint.`,
      connectorIds: [edge.id],
      segmentIds: segments[segments.length - 1] ? [segments[segments.length - 1]!.id] : []
    });
  }

  const sourceBox = boxById.get(edge.sourceItemId);
  if (sourceBox && edge.points.length >= 2
    && endpointDepartsIntoBox(edge.points[0]!, edge.points[1]!, sourceBox, policy.epsilon)) {
    const first = segments[0];
    violations.push({
      kind: "endpoint_intrusion",
      message: `Connector "${edge.id}" departs into source box "${sourceBox.id}".`,
      connectorIds: [edge.id],
      segmentIds: first ? [first.id] : [],
      routeSegmentIndexes: first ? [first.routeSegmentIndex] : undefined,
      boxId: sourceBox.id
    });
  }
  const targetBox = boxById.get(edge.targetItemId);
  if (targetBox && edge.points.length >= 2
    && endpointDepartsIntoBox(
      edge.points[edge.points.length - 1]!,
      edge.points[edge.points.length - 2]!,
      targetBox,
      policy.epsilon
    )) {
    const last = segments[segments.length - 1];
    violations.push({
      kind: "endpoint_intrusion",
      message: `Connector "${edge.id}" arrives through target box "${targetBox.id}".`,
      connectorIds: [edge.id],
      segmentIds: last ? [last.id] : [],
      routeSegmentIndexes: last ? [last.routeSegmentIndex] : undefined,
      boxId: targetBox.id
    });
  }

  for (const segment of segments) {
    for (const box of boxes) {
      if (box.id === edge.sourceItemId || box.id === edge.targetItemId) {
        continue;
      }
      if (segmentIntersectsBoxInterior(segment.start, segment.end, box, policy.epsilon)) {
        violations.push(violationForSegment(
          "node_intersection",
          `Connector "${edge.id}" segment ${segment.routeSegmentIndex} intersects non-endpoint box "${box.id}".`,
          edge.id,
          segment,
          box.id
        ));
      }
    }
  }

  const terminal = segments[segments.length - 1];
  if (terminal && segmentLength(terminal.start, terminal.end) < policy.minTerminalLeg - policy.epsilon) {
    violations.push(violationForSegment(
      "terminal_leg_too_short",
      `Connector "${edge.id}" terminal leg is shorter than ${policy.minTerminalLeg}px.`,
      edge.id,
      terminal
    ));
  }

  return violations;
}

function overlapAllowed(
  policy: RoutingValidationPolicy,
  leftEdge: RoutingValidationEdge,
  leftSegment: RoutingSegment,
  rightEdge: RoutingValidationEdge,
  rightSegment: RoutingSegment
): boolean {
  if (leftSegment.sharedTrackGroupId
    && leftSegment.sharedTrackGroupId === rightSegment.sharedTrackGroupId) {
    return true;
  }
  return policy.allowCollinearOverlap?.(
    leftEdge.id,
    leftSegment.routeSegmentIndex,
    rightEdge.id,
    rightSegment.routeSegmentIndex
  ) ?? false;
}

function validateEdgePair(
  left: EdgeSegments,
  right: EdgeSegments,
  policy: RoutingValidationPolicy
): RoutingViolation[] {
  const violations: RoutingViolation[] = [];
  for (const leftSegment of left.segments) {
    for (const rightSegment of right.segments) {
      if (leftSegment.axis === rightSegment.axis) {
        const overlap = spanOverlapLength(
          leftSegment.spanStart,
          leftSegment.spanEnd,
          rightSegment.spanStart,
          rightSegment.spanEnd
        );
        if (overlap <= policy.epsilon || overlapAllowed(
          policy,
          left.edge,
          leftSegment,
          right.edge,
          rightSegment
        )) {
          continue;
        }
        const distance = Math.abs(leftSegment.coordinate - rightSegment.coordinate);
        if (distance >= policy.minSeparation - policy.epsilon) {
          continue;
        }
        const kind = distance <= policy.epsilon ? "collinear_overlap" : "track_separation";
        violations.push({
          kind,
          message: `Connectors "${left.edge.id}" and "${right.edge.id}" have ${overlap}px of overlapping ${leftSegment.axis} span at ${distance}px separation.`,
          connectorIds: [left.edge.id, right.edge.id],
          segmentIds: [leftSegment.id, rightSegment.id],
          routeSegmentIndexes: [leftSegment.routeSegmentIndex, rightSegment.routeSegmentIndex]
        });
        continue;
      }

      if (!perpendicularSegmentsCross(leftSegment, rightSegment, policy.epsilon)) {
        continue;
      }
      const treatment = crossingTreatment(policy, left.edge.id, right.edge.id);
      if (treatment === "allow" || treatment === "penalize") {
        continue;
      }
      const key = buildCrossingKey(
        left.edge.id,
        leftSegment.routeSegmentIndex,
        right.edge.id,
        rightSegment.routeSegmentIndex
      );
      if (treatment === "require_mark"
        && (left.edge.markedCrossings?.has(key) || right.edge.markedCrossings?.has(key))) {
        continue;
      }
      violations.push({
        kind: "perpendicular_crossing",
        message: `Connectors "${left.edge.id}" and "${right.edge.id}" cross without an allowed policy outcome.`,
        connectorIds: [left.edge.id, right.edge.id],
        segmentIds: [leftSegment.id, rightSegment.id],
        routeSegmentIndexes: [leftSegment.routeSegmentIndex, rightSegment.routeSegmentIndex]
      });
    }
  }
  return violations;
}

function compareViolations(left: RoutingViolation, right: RoutingViolation): number {
  return left.kind.localeCompare(right.kind)
    || left.connectorIds.join("|").localeCompare(right.connectorIds.join("|"))
    || (left.routeSegmentIndexes ?? []).join("|").localeCompare((right.routeSegmentIndexes ?? []).join("|"))
    || (left.boxId ?? "").localeCompare(right.boxId ?? "")
    || left.segmentIds.map(routingSegmentKey).join("|").localeCompare(
      right.segmentIds.map(routingSegmentKey).join("|")
    );
}

export function validateRouting(input: RoutingValidationInput): RoutingViolation[] {
  const policy: RoutingValidationPolicy = {
    ...DEFAULT_ROUTING_POLICY,
    ...input.policy
  };
  const boxes = input.boxes ?? [];
  const boxById = new Map(boxes.map((box) => [box.id, box] as const));
  const edges = [...input.edges]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(buildEdgeSegments);
  const violations: RoutingViolation[] = [];

  for (const edge of edges) {
    violations.push(...validateSingleEdge(edge, boxById, boxes, policy));
  }
  if (input.includeEdgeInteractions ?? true) {
    for (let leftIndex = 0; leftIndex < edges.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < edges.length; rightIndex += 1) {
        violations.push(...validateEdgePair(edges[leftIndex]!, edges[rightIndex]!, policy));
      }
    }
  }

  return violations.sort(compareViolations);
}
