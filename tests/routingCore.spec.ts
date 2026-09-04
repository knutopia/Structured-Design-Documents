import { describe, expect, it } from "vitest";
import type { PositionedRoute } from "../src/renderer/staged/contracts.js";
import {
  DEFAULT_ROUTING_POLICY,
  aggregateRoutingObservations,
  buildRoutingSegments,
  createRoutingSegmentId,
  reconstructRouteFromAssignments,
  runRoutingLifecycle,
  selectRouteCandidate,
  segmentIntersectsBoxInterior,
  solveRoutingClaims,
  validateRouting,
  type RoutingCandidate,
  type RoutingObservation,
  type RoutingResource,
  type RoutingSegment,
  type RoutingTrackClaim,
  type RoutingViolation
} from "../src/renderer/staged/routingCore/index.js";

function route(points: Array<{ x: number; y: number }>): PositionedRoute {
  return { style: "orthogonal", points };
}

function oneSegment(
  connectorId: string,
  y: number,
  options: {
    movable?: boolean;
    priority?: number;
    minX?: number;
    maxX?: number;
  } = {}
): RoutingSegment {
  return buildRoutingSegments(connectorId, route([
    { x: options.minX ?? 0, y },
    { x: options.maxX ?? 100, y }
  ]), {
    movableBySegmentIndex: new Map([[0, options.movable ?? true]]),
    priority: options.priority ?? 0
  })[0]!;
}

function claimsFor(
  segments: readonly RoutingSegment[],
  observations: readonly RoutingObservation[] = []
): RoutingTrackClaim[] {
  const aggregated = aggregateRoutingObservations(segments, observations);
  expect(aggregated.violations).toEqual([]);
  return aggregated.claims;
}

describe("shared routing core geometry", () => {
  it("distinguishes box-boundary contact from an interior traversal", () => {
    const box = { id: "box", x: 20, y: 20, width: 40, height: 40 };
    expect(segmentIntersectsBoxInterior(
      { x: 0, y: 20 },
      { x: 80, y: 20 },
      box
    )).toBe(false);
    expect(segmentIntersectsBoxInterior(
      { x: 0, y: 40 },
      { x: 80, y: 40 },
      box
    )).toBe(true);
  });

  it("reports non-orthogonal routes, node traversals, and final collinear overlap", () => {
    const violations = validateRouting({
      edges: [
        {
          id: "a",
          sourceItemId: "source-a",
          targetItemId: "target-a",
          style: "orthogonal",
          points: [{ x: 10, y: 30 }, { x: 90, y: 30 }]
        },
        {
          id: "b",
          sourceItemId: "source-b",
          targetItemId: "target-b",
          style: "orthogonal",
          points: [{ x: 20, y: 30 }, { x: 100, y: 30 }]
        },
        {
          id: "diagonal",
          sourceItemId: "source-c",
          targetItemId: "target-c",
          style: "orthogonal",
          points: [{ x: 0, y: 0 }, { x: 10, y: 10 }]
        }
      ],
      boxes: [{ id: "blocker", x: 40, y: 20, width: 20, height: 20 }],
      policy: { minTerminalLeg: 0 }
    });
    expect(violations.map((violation) => violation.kind)).toEqual(expect.arrayContaining([
      "collinear_overlap",
      "node_intersection",
      "non_orthogonal_segment"
    ]));
  });

  it("accepts exactly 16px separation and an explicitly shared track", () => {
    const separated = validateRouting({
      edges: [
        { id: "a", sourceItemId: "a1", targetItemId: "a2", style: "orthogonal", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
        { id: "b", sourceItemId: "b1", targetItemId: "b2", style: "orthogonal", points: [{ x: 0, y: 16 }, { x: 100, y: 16 }] }
      ],
      policy: { minTerminalLeg: 0 }
    });
    expect(separated.filter((violation) =>
      violation.kind === "track_separation" || violation.kind === "collinear_overlap"
    )).toEqual([]);

    const shared = validateRouting({
      edges: [
        {
          id: "a",
          sourceItemId: "a1",
          targetItemId: "a2",
          style: "orthogonal",
          points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
          sharedTrackGroupBySegmentIndex: new Map([[0, "intentional-trunk"]])
        },
        {
          id: "b",
          sourceItemId: "b1",
          targetItemId: "b2",
          style: "orthogonal",
          points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
          sharedTrackGroupBySegmentIndex: new Map([[0, "intentional-trunk"]])
        }
      ],
      policy: { minTerminalLeg: 0 }
    });
    expect(shared.filter((violation) => violation.kind === "collinear_overlap")).toEqual([]);
  });
});

describe("shared routing claim aggregation", () => {
  it("aggregates every obstacle observation into one physical-segment claim", () => {
    const segment = oneSegment("edge", 50);
    const result = aggregateRoutingObservations([segment], [
      {
        segmentId: segment.id,
        obstacleId: "first",
        resourceId: "corridor",
        allowedRange: { min: 0, max: 100 },
        forbiddenRanges: [{ min: 40, max: 45 }]
      },
      {
        segmentId: segment.id,
        obstacleId: "second",
        resourceId: "corridor",
        allowedRange: { min: 20, max: 80 },
        forbiddenRanges: [{ min: 44, max: 48 }]
      }
    ]);
    expect(result.violations).toEqual([]);
    expect(result.claims).toHaveLength(1);
    expect(result.claims[0]).toEqual(expect.objectContaining({
      resourceIds: ["corridor"],
      obstacleIds: ["first", "second"],
      allowedRange: { min: 20, max: 80 },
      forbiddenRanges: [{ min: 40, max: 48 }]
    }));
    expect(result.claims[0]!.observations).toHaveLength(2);
  });

  it("rejects conflicting locks rather than accepting the last writer", () => {
    const segment = oneSegment("edge", 50);
    const result = aggregateRoutingObservations([segment], [
      { segmentId: segment.id, obstacleId: "first", lockedCoordinate: 32 },
      { segmentId: segment.id, obstacleId: "second", lockedCoordinate: 64 }
    ]);
    expect(result.violations).toEqual([
      expect.objectContaining({ kind: "conflicting_locks" })
    ]);
  });
});

describe("shared routing track solver", () => {
  it("considers the destination coordinate and avoids a displacement-created collision", () => {
    const fixedZero = oneSegment("fixed-zero", 0, { movable: false, priority: 0 });
    const fixedSixteen = oneSegment("fixed-sixteen", 16, { movable: false, priority: 0 });
    const movable = oneSegment("movable", 0, { priority: 1 });
    const observations: RoutingObservation[] = [
      { segmentId: fixedZero.id, lockedCoordinate: 0, allowedRange: { min: -32, max: 32 } },
      { segmentId: fixedSixteen.id, lockedCoordinate: 16, allowedRange: { min: -32, max: 32 } },
      { segmentId: movable.id, allowedRange: { min: -32, max: 32 } }
    ];
    const result = solveRoutingClaims(claimsFor(
      [fixedZero, fixedSixteen, movable],
      observations
    ));
    expect(result.status).toBe("resolved");
    if (result.status !== "resolved") {
      return;
    }
    expect(result.assignments.get(movable.id)?.coordinate).toBe(-16);
  });

  it("keeps an already valid exact-spacing assignment unchanged", () => {
    const first = oneSegment("first", 0);
    const second = oneSegment("second", 16);
    const result = solveRoutingClaims(claimsFor([first, second]));
    expect(result.status).toBe("resolved");
    if (result.status !== "resolved") {
      return;
    }
    expect(result.assignments.get(first.id)?.coordinate).toBe(0);
    expect(result.assignments.get(second.id)?.coordinate).toBe(16);
  });

  it("requests absolute resource expansion when bounded capacity is insufficient", () => {
    const segments = [
      oneSegment("first", 0),
      oneSegment("second", 0),
      oneSegment("third", 0)
    ];
    const resource: RoutingResource = {
      id: "corridor",
      axis: "horizontal",
      minCoordinate: 0,
      maxCoordinate: 16,
      expansionOwnerId: "row-1",
      currentSize: 16
    };
    const observations = segments.map((segment): RoutingObservation => ({
      segmentId: segment.id,
      resourceId: resource.id,
      allowedRange: { min: 0, max: 16 }
    }));
    const result = solveRoutingClaims(claimsFor(segments, observations), {
      resources: [resource]
    });
    expect(result.status).toBe("needs_expansion");
    if (result.status !== "needs_expansion") {
      return;
    }
    expect(result.expansionRequests).toEqual([
      expect.objectContaining({
        ownerId: "row-1",
        resourceId: "corridor",
        requiredSize: 32,
        requiredMaxCoordinate: 32
      })
    ]);
  });

  it("is deterministic when claim input order changes", () => {
    const segments = [
      oneSegment("third", 0, { priority: 2 }),
      oneSegment("first", 0, { priority: 0 }),
      oneSegment("second", 0, { priority: 1 })
    ];
    const solve = (ordered: RoutingSegment[]): string => {
      const result = solveRoutingClaims(claimsFor(ordered));
      expect(result.status).toBe("resolved");
      if (result.status !== "resolved") {
        return "";
      }
      return [...result.assignments.values()]
        .sort((left, right) => String(left.segmentId).localeCompare(String(right.segmentId)))
        .map((assignment) => `${assignment.segmentId}=${assignment.coordinate}`)
        .join("|");
    };
    expect(solve(segments)).toBe(solve([...segments].reverse()));
  });

  it("keeps a deterministic feasible incumbent when bounded optimization is exhausted", () => {
    const segments = Array.from({ length: 14 }, (_, index) =>
      oneSegment(`dense-${String(index).padStart(2, "0")}`, 0, { priority: index })
    );
    const observations = segments.map((segment): RoutingObservation => ({
      segmentId: segment.id,
      resourceId: "dense-corridor",
      allowedRange: { min: 0, max: (segments.length - 1) * 16 }
    }));
    const solve = (ordered: RoutingSegment[]): string => {
      const result = solveRoutingClaims(claimsFor(ordered, observations), {
        maxSearchStates: 1
      });
      expect(result.status).toBe("resolved");
      if (result.status !== "resolved") {
        return "";
      }
      const coordinates = [...result.assignments.values()]
        .map((assignment) => assignment.coordinate)
        .sort((left, right) => left - right);
      expect(coordinates).toEqual(Array.from({ length: 14 }, (_, index) => index * 16));
      return [...result.assignments.values()]
        .sort((left, right) => String(left.segmentId).localeCompare(String(right.segmentId)))
        .map((assignment) => `${assignment.segmentId}=${assignment.coordinate}`)
        .join("|");
    };
    expect(solve(segments)).toBe(solve([...segments].reverse()));
  });

  it("reconstructs adjacent bends from segment assignments", () => {
    const original = route([
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 80 },
      { x: 100, y: 80 }
    ]);
    const segments = buildRoutingSegments("edge", original);
    const assignments = new Map([
      [segments[1]!.id, { segmentId: segments[1]!.id, coordinate: 56, displacement: 16 }]
    ]);
    expect(reconstructRouteFromAssignments(original, segments, assignments).points).toEqual([
      { x: 0, y: 0 },
      { x: 56, y: 0 },
      { x: 56, y: 80 },
      { x: 100, y: 80 }
    ]);
  });
});

describe("shared routing lifecycle", () => {
  it("selects a semantic-ID-independent alternate around multiple blockers", () => {
    const selected = selectRouteCandidate({
      connectorId: "connector",
      sourceItemId: "source",
      targetItemId: "target",
      boxes: [
        { id: "first-blocker", x: 30, y: 10, width: 20, height: 20 },
        { id: "second-blocker", x: 60, y: 10, width: 20, height: 20 }
      ],
      policy: { minTerminalLeg: 0 },
      candidates: [
        { id: "direct", route: route([{ x: 0, y: 20 }, { x: 100, y: 20 }]) },
        {
          id: "above",
          route: route([
            { x: 0, y: 20 },
            { x: 10, y: 20 },
            { x: 10, y: 0 },
            { x: 90, y: 0 },
            { x: 90, y: 20 },
            { x: 100, y: 20 }
          ])
        }
      ]
    });
    expect(selected.status).toBe("resolved");
    expect(selected.candidate?.id).toBe("above");
  });

  it("tries the next candidate when final validation rejects a topology", () => {
    const buildCandidate = (id: string): RoutingCandidate<{ valid: boolean }> & {
      observations: RoutingObservation[];
      resources: RoutingResource[];
      reconstruct: () => string;
    } => {
      const candidateRoute = route([{ x: 0, y: 0 }, { x: 40, y: 0 }]);
      return {
        id,
        connectorId: "edge",
        route: candidateRoute,
        segments: buildRoutingSegments("edge", candidateRoute, { candidateId: id }),
        metadata: { valid: id === "valid" },
        observations: [],
        resources: [],
        reconstruct: () => id
      };
    };
    const rejected: RoutingViolation = {
      kind: "node_intersection",
      message: "rejected candidate",
      connectorIds: ["edge"],
      segmentIds: [createRoutingSegmentId("edge", "invalid", "run-0")]
    };
    const result = runRoutingLifecycle(
      {},
      {
        buildCandidates: () => [buildCandidate("invalid"), buildCandidate("valid")],
        validate: (_output, candidate) => candidate.metadata.valid ? [] : [rejected]
      },
      DEFAULT_ROUTING_POLICY
    );
    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.output).toBe("valid");
    }
  });
});
