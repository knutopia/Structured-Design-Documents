import { describe, expect, it } from "vitest";
import type { PositionedRoute } from "../src/renderer/staged/contracts.js";
import {
  buildPortCorridorCandidates,
  buildTerminalTurnAlternatives,
  runRoutingLifecycle,
  validateFinalRouteSet,
  type FinalRoutingConnector,
  type FinalRoutingContext,
  type RoutingBox,
  type RoutingViolation
} from "../src/renderer/staged/routingCore/index.js";

/**
 * Regression gate for corridor recovery.
 *
 * The defect this pins: `buildTerminalTurnAlternatives` rewrites ONE existing segment
 * coordinate per yield, so it preserves the emitted topology. When the emitted route is
 * already structurally wrong, every one-move neighbour still intersects a box, the
 * lifecycle's queueing rule refuses all of them, and the repair frontier dies at depth
 * one. No budget increase can help, because the frontier is empty rather than exhausted.
 *
 * The discriminating assertion is the PAIR below: no queueable one-move alternative
 * exists, yet the lifecycle resolves. That combination can only hold via corridor
 * recovery, so this test cannot be satisfied by the turn generator alone.
 *
 * Synthetic and fast — it does not render, so it does not depend on the ~25s
 * `scenario_flow` fixture render that `routingHardeningScenario.spec.ts` uses.
 * Background and measurements: docs/routing_hardening/invalid_valley_2026-09-18.md.
 */

function route(points: Array<[number, number]>): PositionedRoute {
  return { style: "orthogonal", points: points.map(([x, y]) => ({ x, y })) };
}

/** Violation kinds the lifecycle's queueing rule tolerates. */
const TRAVERSABLE = new Set(["track_separation", "collinear_overlap", "perpendicular_crossing"]);

function hasBlocking(violations: readonly RoutingViolation[]): boolean {
  return violations.some((v) => !TRAVERSABLE.has(v.kind));
}

/**
 * One valley instance: source box on the left, obstacle and target stacked in a column on
 * the right, leaving a 60px channel between them. Both ports face that channel, so the
 * correct route is right–down–right and never leaves it.
 *
 *   x=0        x=100   x=130   x=160        x=260
 *      ┌──────────┐      │      ┌──────────┐   y=0
 *      │  source  ├──────┐      │ obstacle │
 *      └──────────┘      │      └──────────┘   y=40
 *                        │           ↕ 10px
 *                        │      ┌──────────┐   y=50
 *                        └─────►│  target  │   y=90
 *                               └──────────┘
 *
 * TWO instances are required, not one. Measured: with a single implicated connector the
 * turn generator CAN repair it, because one single-coordinate move suffices and nothing
 * else keeps the state unqueueable. The valley arises from GROUPING — the generator
 * changes one connector per yield, so while it repairs one, the other's blocking
 * violations remain and the queueing rule refuses the state. That is exactly why corridor
 * recovery rebuilds all implicated connectors together.
 */
function valleyInstance(yOffset: number, suffix: string): {
  boxes: RoutingBox[];
  connector: FinalRoutingConnector;
  emitted: Array<[number, number]>;
} {
  const y = (n: number): number => n + yOffset;
  const boxes: RoutingBox[] = [
    { id: `source-${suffix}`, x: 0, y: y(0), width: 100, height: 40 },
    { id: `obstacle-${suffix}`, x: 160, y: y(0), width: 100, height: 40 },
    { id: `target-${suffix}`, x: 160, y: y(50), width: 100, height: 40 }
  ];
  // Emitted route: a six-point detour running right at y+60, straight through the target
  // box's interior, then doubling back to the target's west port. Structurally wrong — the
  // correct shape has four points, so no single-coordinate edit reaches it.
  const emitted: Array<[number, number]> = [
    [100, y(20)], [120, y(20)], [120, y(60)], [200, y(60)], [200, y(70)], [160, y(70)]
  ];
  const connector: FinalRoutingConnector = {
    id: `source-${suffix}__to__target-${suffix}`,
    route: route(emitted),
    source: { point: { x: 100, y: y(20) }, side: "east", nodeId: `source-${suffix}`, minLeg: 0 },
    target: { point: { x: 160, y: y(70) }, side: "west", nodeId: `target-${suffix}`, minLeg: 12 },
    priority: 0
  };
  return { boxes, connector, emitted };
}

const INSTANCE_A = valleyInstance(0, "a");
const INSTANCE_B = valleyInstance(200, "b");
const BOXES: readonly RoutingBox[] = [...INSTANCE_A.boxes, ...INSTANCE_B.boxes];
const BOUNDS = { minX: -40, minY: -40, maxX: 320, maxY: 360 };
const EMITTED_POINT_COUNT = INSTANCE_A.emitted.length;

function buildContext(): FinalRoutingContext {
  return {
    connectors: [INSTANCE_A.connector, INSTANCE_B.connector],
    boxes: BOXES,
    bounds: BOUNDS
  };
}

describe("corridor recovery across an invalid valley", () => {
  it("proposes a channel route the turn generator cannot reach", () => {
    const context = buildContext();
    const connector = INSTANCE_A.connector;

    const emittedViolations = validateFinalRouteSet(context);
    // Precondition: the emitted route set is genuinely broken, and broken in a way the
    // queueing rule refuses to explore.
    expect(hasBlocking(emittedViolations)).toBe(true);

    // The turn generator cannot produce a blocking-free route set. It changes one
    // connector per yield, so the other instance's blocking violations always remain.
    let turnAlternatives = 0;
    let queueableTurnAlternative = false;
    for (const connectors of buildTerminalTurnAlternatives(context, emittedViolations)) {
      turnAlternatives += 1;
      if (!hasBlocking(validateFinalRouteSet({ ...context, connectors }))) {
        queueableTurnAlternative = true;
        break;
      }
    }
    expect(turnAlternatives).toBeGreaterThan(0);
    expect(queueableTurnAlternative).toBe(false);

    // The corridor generator can. It builds from the declared ports, so it is not
    // constrained to the emitted topology.
    const corridorRoutes: Array<readonly { x: number; y: number }[]> = [];
    let blockingFreeCorridor: readonly { x: number; y: number }[] | undefined;
    for (const points of buildPortCorridorCandidates(connector, context)) {
      corridorRoutes.push(points);
      const substituted: FinalRoutingContext = {
        ...context,
        connectors: context.connectors.map((c) => c.id === connector.id
          ? { ...c, route: { style: "orthogonal", points: points.map((p) => ({ ...p })) } }
          : c)
      };
      // This connector alone is clean; the other instance still blocks the scene, which
      // is the point — recovery has to rebuild both together.
      const own = validateFinalRouteSet(substituted).filter((v) => v.connectorIds.includes(connector.id));
      if (!hasBlocking(own)) {
        blockingFreeCorridor = points;
        break;
      }
    }
    expect(corridorRoutes.length).toBeGreaterThan(0);
    expect(blockingFreeCorridor, "a corridor route with no blocking violation").toBeDefined();
    // It stays inside the channel and is simpler than the detour it replaces.
    expect(blockingFreeCorridor!.length).toBeLessThan(EMITTED_POINT_COUNT);
    expect(blockingFreeCorridor!.every((p) => p.x >= 100 && p.x <= 160)).toBe(true);
  });

  it("resolves a route set whose repair frontier would otherwise die at depth one", () => {
    const context = buildContext();

    // Precondition, restated: no queueable one-move alternative exists, so without
    // corridor recovery the frontier is empty and no budget can help.
    const emittedViolations = validateFinalRouteSet(context);
    expect(hasBlocking(emittedViolations)).toBe(true);
    for (const connectors of buildTerminalTurnAlternatives(context, emittedViolations)) {
      expect(hasBlocking(validateFinalRouteSet({ ...context, connectors }))).toBe(true);
    }

    const result = runRoutingLifecycle(context);
    expect(result.status, JSON.stringify(result)).toBe("resolved");
    if (result.status !== "resolved") return;

    expect(result.violations).toEqual([]);
    expect(validateFinalRouteSet(result.context)).toEqual([]);
    for (const instance of [INSTANCE_A, INSTANCE_B]) {
      const resolved = result.routeByConnectorId.get(instance.connector.id)!;
      // Endpoints are preserved exactly; the topology is what changed.
      expect(resolved.points[0]).toEqual(instance.connector.source.point);
      expect(resolved.points.at(-1)).toEqual(instance.connector.target.point);
      expect(resolved.points.length).toBeLessThan(EMITTED_POINT_COUNT);
    }
    // Recovery is not expansion: the canvas bounds are untouched.
    expect(result.trace.expansionPasses).toBe(0);
    expect(result.context.bounds).toEqual(BOUNDS);
  });

  it("leaves a connector owning run constraints ineligible for topology rebuild", () => {
    const context = buildContext();
    // A fresh topology re-derives logical run IDs from the route, so ownership keyed to
    // the previous topology would go stale and acceptance would report endpoint_mismatch,
    // which terminates the lifecycle outright. Such connectors must be skipped.
    const owned: FinalRoutingConnector = {
      ...INSTANCE_A.connector,
      runConstraints: new Map([["source-terminal-horizontal", { lockedCoordinate: 20, lockReason: "resource" as const }]])
    };
    expect([...buildPortCorridorCandidates(owned, { ...context, connectors: [owned] })]).toEqual([]);
  });

  it("is deterministic for a given context", () => {
    const context = buildContext();
    const connector = INSTANCE_A.connector;
    const first = [...buildPortCorridorCandidates(connector, context)].map((p) => JSON.stringify(p));
    const second = [...buildPortCorridorCandidates(connector, context)].map((p) => JSON.stringify(p));
    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(0);
  });
});
