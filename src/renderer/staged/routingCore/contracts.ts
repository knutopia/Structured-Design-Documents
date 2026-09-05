import type { Point, PositionedRoute, RoutingStyle } from "../contracts.js";

export type RoutingAxis = "horizontal" | "vertical";
export type RoutingDirection = -1 | 1;
export type RoutingCrossingTreatment = "allow" | "penalize" | "forbid" | "require_mark";
export type RoutingEndpointRole = "source" | "target" | "internal";

declare const routingSegmentIdBrand: unique symbol;
export type RoutingSegmentId = string & { readonly [routingSegmentIdBrand]: true };

export interface RoutingBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RoutingSegment {
  id: RoutingSegmentId;
  connectorId: string;
  candidateId: string;
  logicalRunId: string;
  routeSegmentIndex: number;
  axis: RoutingAxis;
  coordinate: number;
  spanStart: number;
  spanEnd: number;
  start: Point;
  end: Point;
  endpointRole?: RoutingEndpointRole;
  movable: boolean;
  priority: number;
  sharedTrackGroupId?: string;
}

export interface RoutingResource {
  id: string;
  axis: RoutingAxis;
  minCoordinate: number;
  maxCoordinate: number;
  expansionOwnerId?: string;
  currentSize?: number;
}

export interface RoutingCoordinateRange {
  min: number;
  max: number;
}

export interface RoutingObservation {
  segmentId: RoutingSegmentId;
  resourceId?: string;
  obstacleId?: string;
  allowedRange?: RoutingCoordinateRange;
  forbiddenRanges?: RoutingCoordinateRange[];
  lockedCoordinate?: number;
  movable?: boolean;
  priority?: number;
  sharedTrackGroupId?: string;
}

export interface RoutingTrackClaim {
  segment: RoutingSegment;
  resourceIds: string[];
  obstacleIds: string[];
  allowedRange: RoutingCoordinateRange;
  forbiddenRanges: RoutingCoordinateRange[];
  lockedCoordinate?: number;
  movable: boolean;
  priority: number;
  sharedTrackGroupId?: string;
  observations: RoutingObservation[];
}

export interface RoutingAssignment {
  segmentId: RoutingSegmentId;
  coordinate: number;
  displacement: number;
}

export interface RoutingExpansionRequest {
  ownerId: string;
  resourceId: string;
  axis: RoutingAxis;
  requiredMinCoordinate?: number;
  requiredMaxCoordinate?: number;
  requiredSize?: number;
  segmentIds: RoutingSegmentId[];
  reason: RoutingViolationKind;
}

export type RoutingViolationKind =
  | "non_orthogonal_segment"
  | "endpoint_mismatch"
  | "endpoint_intrusion"
  | "node_intersection"
  | "terminal_leg_too_short"
  | "track_separation"
  | "collinear_overlap"
  | "perpendicular_crossing"
  | "conflicting_locks"
  | "empty_coordinate_range"
  | "missing_segment"
  | "assignment_exhausted"
  | "expansion_exhausted";

export interface RoutingViolation {
  kind: RoutingViolationKind;
  message: string;
  connectorIds: string[];
  segmentIds: RoutingSegmentId[];
  resourceIds?: string[];
  obstacleIds?: string[];
  boxId?: string;
  routeSegmentIndexes?: number[];
}

export interface RoutingPolicy {
  minSeparation: number;
  epsilon: number;
  minTerminalLeg: number;
  maxExpansionPasses: number;
  crossingTreatment: RoutingCrossingTreatment;
}

export interface RoutingCandidate<TMetadata = unknown> {
  id: string;
  connectorId: string;
  route: PositionedRoute;
  segments: RoutingSegment[];
  metadata: TMetadata;
}

export interface RoutingValidationEdge {
  id: string;
  sourceItemId: string;
  targetItemId: string;
  style: RoutingStyle;
  points: Point[];
  expectedSourcePoint?: Point;
  expectedTargetPoint?: Point;
  sharedTrackGroupBySegmentIndex?: ReadonlyMap<number, string>;
  markedCrossings?: ReadonlySet<string>;
}

export interface RoutingValidationPolicy extends RoutingPolicy {
  crossingTreatmentForPair?: (
    leftConnectorId: string,
    rightConnectorId: string
  ) => RoutingCrossingTreatment;
  allowCollinearOverlap?: (
    leftConnectorId: string,
    leftSegmentIndex: number,
    rightConnectorId: string,
    rightSegmentIndex: number
  ) => boolean;
}

export type RoutingSolveResult =
  | {
      status: "resolved";
      assignments: Map<RoutingSegmentId, RoutingAssignment>;
      violations: [];
    }
  | {
      status: "needs_expansion";
      assignments: Map<RoutingSegmentId, RoutingAssignment>;
      expansionRequests: RoutingExpansionRequest[];
      violations: RoutingViolation[];
    }
  | {
      status: "needs_alternate_candidate";
      assignments: Map<RoutingSegmentId, RoutingAssignment>;
      violations: RoutingViolation[];
    }
  | {
      status: "unsatisfiable";
      assignments: Map<RoutingSegmentId, RoutingAssignment>;
      violations: RoutingViolation[];
    };

export const DEFAULT_ROUTING_POLICY: RoutingPolicy = {
  minSeparation: 16,
  epsilon: 0.5,
  minTerminalLeg: 12,
  maxExpansionPasses: 4,
  crossingTreatment: "penalize"
};

export function createRoutingSegmentId(
  connectorId: string,
  candidateId: string,
  logicalRunId: string
): RoutingSegmentId {
  return `${connectorId}\u0000${candidateId}\u0000${logicalRunId}` as RoutingSegmentId;
}

export function formatRoutingSegmentId(id: RoutingSegmentId): string {
  return id.split("\u0000").join(":");
}
