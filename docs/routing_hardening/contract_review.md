# Routing hardening: independent contract review

**2026-09-12 — Proposed Stage 1 decisions; no implementation gate accepted.** This review reads the current core and three adopter finalization paths. It does not reproduce or accept the captured geometry, implement the API below, or substitute for Stage 0 evidence or executable Stage 1 tests.

## Authority and non-negotiable acceptance

- [AGENTS.md](../../AGENTS.md), Renderer Constraints and Bundle Authority, governs renderer boundaries and semantic ownership (H1/H7).
- [Implementation plan](routing_hardening_implementation_plan.md), §§2.2 and 5, requires complete reconstructed geometry, immutable surrounding context, independent endpoints, explicit ownership, bounded failure, and actual adoption (H2–H6/H10).
- The loaded [view bundle](../../bundle/v0.1/core/views.yaml) owns channels, priority and display semantics. Pixel geometry, terminal dependencies and finite search are renderer mechanics.
- The captured Outcome H–V–H case is the first proof; established Outcome visual fixtures are appearance references. Neither authorizes exemptions (H8/H9).

## Current discrepancies that the final API must close

1. `routingCore/lifecycle.ts::runRoutingLifecycle` accepts one connector's candidate and adapter-defined validation. Repairs append observations against the same segments. There is no built-in complete scene acceptance or changed-span rebuild.
2. `occupancy.ts::resolveRouteSegmentOccupancy` filters fixed sections unless they overlap a movable section of the same axis. `solver.ts::claimsCompete` tests overlapping coordinate domains rather than clearance-close domains. Both can miss the captured terminal conflicts. Removing only the filter cannot fix frozen-span reconstruction.
3. The occupancy input drops directional bounds, resource definitions, endpoint identity/side and lock reasons. Its failure wrapper exposes unchanged routes through `routeByConnectorId`; failure must not share the accepted-route shape.
4. `validation.ts` has no side/resource checks; endpoint points are optional and an empty point array can evade mismatch checks. It skips both endpoint boxes for every section, allowing later reentry. Terminal-leg validation checks only the last segment with one scalar. `sceneValidation.ts` does not carry marker requirements.
5. Outcome supplies no `lockedSegmentKeys` to its final occupancy call and ends with filtered diagnostics. Service excludes terminal occupancy and final edge interactions. Scenario excludes final edge interactions. All three override `minTerminalLeg: 0`. None is final lifecycle adoption.

## Proposed final entrypoint and context

Refactor `runRoutingLifecycle` to own route-set resolution and expose `resolveFinalRouteSet` only as a delegating facade if useful. Keep Journey's `solveRoutingClaims` API assignment-only. Retire/delegate the old per-connector final lifecycle contract in the same change; do not retain two definitions of final success.

The following is a design sketch, **not an exported or tested TypeScript API**:

```ts
type FinalRouteResult =
  | { status: "resolved"; accepted: AcceptedRouteSet; violations: []; trace: Trace }
  | { status: "failed"; reason: FailureReason; violations: RoutingViolation[];
      debugCandidate?: RejectedRouteSet; trace: Trace };

type FailureReason = "invalid_context" | "candidate_exhausted" |
  "repair_exhausted" | "search_exhausted" | "repeated_state" |
  "expansion_unavailable" | "expansion_exhausted";
```

Only the coordinator constructs `AcceptedRouteSet`, after shared validation. It contains a readonly route map, context/geometry revision, and acceptance policy identity. Do not place `routeByConnectorId` on the failure arm. Clone/freeze accepted points so later route changes require a new resolution. Lower-level `unsatisfiable` means a contradictory supplied track problem or bounded search failure, distinguished by reason; it does not prove the route-set problem geometrically impossible.

Required context is one complete scene route set, independently resolved endpoints `{point, side, nodeId, markerClearance}` for both ends, node boxes, explicitly blocking rectangles/segments, finite corridor/resource limits, sharing declarations on logical runs, pair crossing policy, connector priority, and optional expansion owner. Endpoint declarations must originate from the adapter's port/node geometry before rebuilding candidate points. Missing routes, missing endpoints, nonfinite geometry and a route with fewer than two distinct points reject the context. An entire container is not automatically a blocking rectangle.

Validation checks attachment and outward terminal direction, all current sections against declared blockers and resource limits, endpoint-box reentry after the permitted incident attachment, terminal clearance, and every route pair. It runs with all sections, including immutable surrounding routes. It cannot accept an `includeEdgeInteractions: false` option. Keep existing less-complete validation APIs for callers outside this adoption scope until separately audited.

## Proposed turn/span representation: deterministic alternatives

Use deterministic candidate generation with rebuilt claims, rather than attempting to solve changing spans inside the existing frozen-span track solver. This is the narrower extension of the current subsystem allowed by §5.3.

Within a candidate, identify each logical run by `(connectorId, topologyCandidateId, logicalRunId)` and each assignment by that identity plus geometry revision. A run's transverse coordinate is one scalar variable or hard lock. Its longitudinal endpoints are references to the adjacent perpendicular runs' coordinate variables, or to an immutable endpoint coordinate. Segment indexes are regenerated reconstruction metadata. Topology change/normalization that removes runs creates a new topology identity; no stale index lock or assignment survives it.

For the first Outcome H–V–H candidate, keep both ports and terminal Y coordinates fixed and move the internal vertical-run X variable. Reconstruct both adjacent corners together from that variable. For two too-close parallel sections, generate the two interval-disjoint ordering alternatives, discarding those outside resources or inconsistent with endpoint departure/arrival direction. A relation may require moving both neighbouring turns; enumerating only one connector's alternative misses that possibility. Generate paired assignments for the implicated component.

Derive coordinate events from nominal coordinates, legal resource endpoints, endpoint marker-stub limits, obstacle boundaries/clearances, neighbouring turn coordinates and required separation. Include nearest coordinates satisfying either span ordering, not only the solver's existing transverse separation lattice. Sort by preservation, displacement and stable IDs, then deduplicate. No fixture coordinates, semantic IDs, global fan reversal or canvas growth is needed to express these alternatives. Reverse direction and transpose use the same interval/reference mechanism.

For every alternative: reconstruct, normalize, re-extract physical spans and observations, rebuild competition components, and validate the complete route set. A newly encountered neighbour joins the affected dependency set before subsequent repair. Rejected fixed-span assignment is a reason to try a different span alternative, not immediate final failure. Repeating the normalized geometry is no progress. Candidate-specific constraints never leak into the next topology. Keep an unchanged nominal baseline for displacement scoring.

Use hard locks only for endpoint invariants, adapter-declared fixed ownership, or required directional resources. Prepared/heuristic lane choices become preferences unless the adapter supplies an actual invariant and reason. One coordinate variable owns one physical run; view passes cannot overwrite it after acceptance (H5).

## Tolerance, crossings, markers and blocking policy

Preserve the existing interval rule exactly: competing parallel spans overlap by more than `epsilon = 0.5`; their coordinate distance must be at least `16 - epsilon`. Actual selected-coordinate compatibility and final geometry use the same rule. The broad phase may include extra pairs; it may exclude a pair only when all allowed assignments are safely separated. Preserve the independent oracle's own math rather than calling production validation from it.

Sharing is explicitly scoped to logical runs and mapped anew after reconstruction. Same-target identity alone does not authorize sharing. Preserve `allow`, `forbid`, `require_mark` and `penalize` distinctions. `penalize` counts crossings in candidate score; marks must refer to the accepted geometry. A globally valid original route set returns unchanged even if another valid arrangement would score better. After hard rejection, prefer zero expansion and no unrelated movement, then priority-weighted displacement, crossing cost, bends, length and stable tie-break. These are ordered preferences, not weights that excuse hard violations.

**Marker proposal:** give both endpoints a clearance value derived from actual marker kind and shared rendering metrics. For current `arrow`, preserve the existing 12px routing minimum and raise it if the arrow footprint requires more. `svgBackend.ts::buildArrowMarkerDef` uses `arrowSize - 1` as the inward axial extent for either end (10px default size, 9px inward extent); include stroke allowance. Put the geometric marker metric in shared renderer infrastructure consumed by both clearance calculation and SVG serialization, rather than copying SVG constants into routing. `none` may have zero marker-specific leg requirement because it paints no footprint; attachment, direction, nondegeneracy, obstacles and any port-owned stub requirement still apply. This is a proposed renderer policy that needs both-end tests and rendered proof; it is not justification for existing blanket zero overrides.

Bounds/blockers are declared by the adapter's existing topology/layout owner: nodes are solid except the attachment itself; lane headers, separators and reserved tracks are blockers only where the view already prohibits crossing them. Do not infer such prohibition from appearance alone. Reserve actual segments or rectangles, not an entire lane/container. Revalidate these bounds after every reconstruction and after expansion.

## Finite budgets and ownership proposal

Freeze separate counters before implementing: at most **256 distinct route-set candidates**, **64 repaired geometry revisions**, and **1,000,000 total assignment search states** per final call, with the current **100,000 per-solve ceiling** as a subordinate limit. A generated candidate consumes a candidate slot when first reconstructed; a repair consumes a repair slot when it changes an existing candidate's geometry/constraints. Duplicate canonical states stop that branch without repeatedly consuming solver work. Global counters do not reset during expansion. These provisional numerical limits need proof-based review; exhausting one reports its exact counter and residual violations, never impossibility.

Outcome/Service retain at most four expansion applications; Scenario retains eight. An initial layout is not an expansion. Existing preparation and final-resolution expansion must share one owner and one ceiling, not nest independent loops. Requests specify absolute minima/maxima/size relative to the original layout baseline; merge with `max`, rebuild context, and reject non-growing or repeated expansion. No owner means `expansion_unavailable` if every permitted non-expanding attempt fails. For the mandatory captured Outcome gate, node/port/canvas fingerprints must remain unchanged; successful expansion does not satisfy that particular proof.

## Production boundary and policy audit

Outcome acceptance belongs after `buildRouteStatesForPlans` constructs the complete provisional final route set and before final occupancy extraction, intersection diagnostics, aggregate labels and `placeLabels`. Existing earlier compaction stays candidate preparation; final accepted points replace the current occupancy reconstruction exactly once.

After Outcome is accepted, Service's compacted/step3 alternatives become candidate input, with acceptance replacing its final occupancy call before labels. Scenario's `buildPreparedRoutes` remains the last topology preparation, followed by shared acceptance before labels. Its existing expansion owner must incorporate requests from final validation without another eight-pass loop.

| Adapter input | Ownership / proposed disposition |
| --- | --- |
| Outcome channel and priority | Existing `core/views.yaml` → loaded `ViewSpec` → `outcomeOpportunityMapRenderModel.ts`; retain unchanged. |
| Current node/port geometry and route topology | Adapter topology derived from existing semantics; do not infer endpoints from candidate points. |
| 16px spacing, 0.5px tolerance, interval events, budgets | Shared renderer mechanics; no bundle edit required. |
| Arrow footprint and marker leg | Shared renderer/theme mechanics based on resolved marker kind; both-end checks required. |
| Sharing or crossing permission specific to semantic channel/type | Bundle-owned if required. No new semantic exception is justified by this review. |
| Header/separator/reserved-lane prohibition | Audit actual existing ownership; if semantic and missing from bundle, add typed policy before consuming it. |

The captured H–V–H repair appears expressible with existing semantics and shared geometry, so no concrete bundle extension is required yet. A requested same-target sharing exception, channel-specific port rule, or semantic crossing exception would be a policy gate, with foundation in `core/views.yaml`, `src/bundle/types.ts`, `validateLoadedBundle.ts`, loaded runtime consumption and a mutation test. Do not introduce an exception merely because Service/Scenario baseline validation exposes errors.

## Reviewer disposition and next executable evidence

No production files changed and no acceptance tests ran in this review. H1/H7/H8/H9 are preserved by this read-only production review; H2–H6/H10 remain unaccepted. This document proposes a narrow implementation path, not a completed Stage 1 gate.

Before accepting Stage 1, add independent reduced H–V–H and V–H–V acceptance cases, the reported 1.5/14.5/16px and tolerance boundaries, an invalid empty/endpoint-reentering route, real both-end marker cases, a changed-span interaction with an unchanged route, and failure-arm consumption tests. Stage 3 then needs changed-geometry repair/rejection through this coordinator against the captured full Outcome context. Stage 4 must prove production invocation plus unchanged node/port/canvas geometry, independent acceptance and SVG/derived-PNG appearance. Service/Scenario implementation remains downstream of that gate.
