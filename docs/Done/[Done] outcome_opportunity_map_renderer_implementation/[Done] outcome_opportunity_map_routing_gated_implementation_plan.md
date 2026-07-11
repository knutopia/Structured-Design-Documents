# [Done] Outcome-Opportunity Map Routing Gated Implementation Plan

Status: routing-specific orchestration handoff plan

Audience: a new orchestration thread improving staged `outcome_opportunity_map` connector routing

Purpose: upgrade outcome-opportunity routing by adapting the service-blueprint routing mechanics identified in `outcome_opportunity_service_blueprint_routing_architecture.md`, while keeping production code changes inside the outcome-opportunity renderer.

## 1. Scope Summary

The current outcome-opportunity map renderer already has the right staged shape, but dense multi-outcome examples expose three accepted routing defects:

1. cross-band vertical bridge tracks collapse onto the same x-coordinate
2. some routes marked `orthogonal` contain diagonal two-point segments
3. same-edge node arrivals are clustered instead of deterministically spaced

The implementation must solve those defects with the same staged responsibilities used by service-blueprint:

`template routes -> prepared routes -> occupancy extraction -> local bundle resolution -> late endpoint ordering -> segment displacement -> bounded gutter expansion -> final route reconstruction -> label placement`

The production code write scope is intentionally narrow:

- Default production write scope: `src/renderer/staged/outcomeOpportunityMapRouting.ts`
- Allowed only with explicit gate justification: other `src/renderer/staged/outcomeOpportunityMap*.ts` files
- Forbidden production write scope: all non-outcome-opportunity renderer code, including `serviceBlueprintRouting.ts`, `serviceBlueprint.ts`, `connectorLabelPlacement.ts`, `routing.ts`, `contracts.ts`, parser/compiler/validator/projector code, bundle files, preview backend registration, and CLI code

Test and evidence updates may be made only in outcome-opportunity-specific test cases and generated artifacts, and only where a gate allows them. Do not extract shared helpers in this plan. If a shared helper appears necessary, stop and report that the scope would violate this plan.

## 2. Source Roles

| Role | Source |
| --- | --- |
| Repo-wide constraints | `AGENTS.md` |
| Routing architecture authority for this effort | `docs/outcome_opportunity_map_renderer_implementation/outcome_opportunity_service_blueprint_routing_architecture.md` |
| Active renderer design | `docs/outcome_opportunity_map_renderer_implementation/outcome_opportunity_map_renderer_design.md` |
| Prior staged implementation plan | `docs/outcome_opportunity_map_renderer_implementation/outcome_opportunity_map_gated_implementation_plan.md` |
| Current routing target | `src/renderer/staged/outcomeOpportunityMapRouting.ts` |
| Outcome-opportunity stage wrapper | `src/renderer/staged/outcomeOpportunityMap.ts` |
| Outcome-opportunity middle-layer context | `src/renderer/staged/outcomeOpportunityMapMiddleLayer.ts` |
| Service-blueprint control-flow exemplar, read-only | `src/renderer/staged/serviceBlueprintRouting.ts` |
| Service-blueprint ports and intent exemplar, read-only | `src/renderer/staged/serviceBlueprint.ts` |
| Shared label engine, read-only | `src/renderer/staged/connectorLabelPlacement.ts` |
| Outcome-opportunity routing tests | `tests/outcomeOpportunityMapRouting.spec.ts` |
| Outcome-opportunity staged snapshot tests | `tests/stagedOutcomeOpportunityMap.spec.ts` |
| Visual acceptance harness | `tests/stagedVisualAcceptance.spec.ts`, `tests/stagedVisualHarness.ts` |
| Service-blueprint assertion patterns, read-only | `tests/stagedServiceBlueprint.spec.ts` |
| Disposable evidence only | `outcome_opportunity_map_disposable.svg` |

The disposable SVG may guide fixture design, but it is not a canonical artifact and must not be promoted unless a later thread intentionally creates a cleaned-up fixture.

## 3. Non-Negotiable Invariants

1. Do not use Elk, the ELK adapter, Graphviz, Mermaid, or any external layout engine for staged placement or routing.
2. Preserve parser, compiler, validator, projection, bundle, and middle-layer semantics unless a gate stops on an explicit authority gap.
3. Keep projection as the semantic boundary. Do not route from raw `.sdd` text or CSS classes.
4. Keep final coordinates, route polylines, SVG strings, DOT text, Mermaid text, and external layout JSON out of `RendererScene`.
5. `MeasuredScene` owns measured dimensions. `PositionedScene` owns absolute positions, final routes, labels, and diagnostics.
6. Step-2, step-3, and final routes must be geometrically orthogonal: every adjacent point pair must share x or y.
7. Parallel same-orientation segments with overlapping spans must be separated by the fixed routing spacing, currently 16px, unless a diagnostic explicitly reports degraded output.
8. Same-edge arrivals and departures must use deterministic endpoint ordering and 16px spacing after prepared route stems are known.
9. Labels are placed only after final route reconstruction and must not be used to disguise merged connector tracks.
10. Do not update snapshots, goldens, or rendered corpus artifacts while diagonal routes, merged bridge tracks, or clustered same-edge arrivals remain.

## 4. Orchestration Protocol

The new orchestration thread executes one gate at a time. Do not run gates concurrently.

For every gate, the orchestrator must:

1. Re-read this plan and the relevant sections of `outcome_opportunity_service_blueprint_routing_architecture.md`.
2. Inspect the listed read scope before editing.
3. Keep production code edits inside the allowed outcome-opportunity renderer scope.
4. Keep service-blueprint and shared renderer files read-only.
5. Run the gate verification with `TMPDIR=/tmp` for tests.
6. Report satisfied invariants, violated invariants, tests run, skipped checks, and whether the gate is accepted.
7. Stop instead of refreshing snapshots if acceptance invariants fail.

Mandatory subagent instruction:

```text
You are implementing only Gate <N> from
docs/outcome_opportunity_map_renderer_implementation/outcome_opportunity_map_routing_gated_implementation_plan.md.

Do not revert unrelated edits. Keep production code changes inside the outcome-opportunity renderer, preferably
src/renderer/staged/outcomeOpportunityMapRouting.ts. Treat service-blueprint and shared renderer files as read-only.

Do not use external layout engines. Do not route from raw .sdd text or CSS classes.
Do not update snapshots, goldens, or rendered corpus artifacts until this gate's structural acceptance criteria are satisfied.
If the gate appears to require production code outside outcome-opportunity renderer scope, stop and report the blocker.

Return changed file paths, tests run, satisfied invariants, violated invariants, and skipped checks with reasons.
```

## 5. Gate Overview

1. Gate 0: Baseline And Failure Lock
2. Gate 1: Routing Test Harness And Dense Fixture
3. Gate 2: Orthogonal Templates And Route-State Scaffolding
4. Gate 3: Operational Occupancy Extraction
5. Gate 4: Local Bundle Resolution
6. Gate 5: Late Endpoint Ordering
7. Gate 6: Segment Displacement And Bounded Expansion
8. Gate 7: Final Route Reconstruction, Labels, And Diagnostics
9. Gate 8: Golden And Corpus Evidence Capture

## 6. Gate 0: Baseline And Failure Lock

Goal: prove the current failure surface without changing files.

Read scope:

- `outcome_opportunity_service_blueprint_routing_architecture.md`
- `outcomeOpportunityMapRouting.ts`
- `tests/outcomeOpportunityMapRouting.spec.ts`
- `tests/stagedOutcomeOpportunityMap.spec.ts`
- `tests/stagedVisualAcceptance.spec.ts`
- `serviceBlueprintRouting.ts`, read-only, focusing on the functions named in section 8.3 of the architecture note

Write scope: none.

Proof tasks:

- Record the current step-2, step-3, and final route lifecycle in `buildOutcomeOpportunityMapRoutingStages(...)`.
- Confirm that `buildEastWestTemplate(...)` can return a diagonal two-point route when vertical spans do not overlap.
- Confirm that `buildGutterOccupancy(...)` is built from final routes but does not assign final track coordinates.
- Confirm that `resolveBridgeX(...)` still uses midpoint plus `outgoingOrder * ENDPOINT_SPACING`.
- Identify the existing synthetic tests that should be extended instead of creating a separate test framework.

Verification:

```bash
git status --short
TMPDIR=/tmp pnpm exec vitest run tests/outcomeOpportunityMapRouting.spec.ts tests/stagedOutcomeOpportunityMap.spec.ts tests/stagedVisualAcceptance.spec.ts
```

Acceptance:

- no files changed
- baseline notes identify which existing tests pass despite the routing deficits
- next gate can add failing assertions without touching production code

Stop if:

- the repo state contains unrelated uncommitted changes in outcome-opportunity routing files that cannot be distinguished safely
- the observed failures require projection or bundle behavior changes

## 7. Gate 1: Routing Test Harness And Dense Fixture

Goal: add focused outcome-opportunity routing assertions that fail on the known defects and can prove the fix.

Allowed write scope:

- `tests/outcomeOpportunityMapRouting.spec.ts`
- `tests/stagedOutcomeOpportunityMap.spec.ts`, only if renderer-stage fixture coverage is needed

Forbidden scope:

- production code
- non-outcome-opportunity tests unless only reading them for patterns
- snapshots, goldens, and rendered corpus artifacts

Implementation tasks:

- Add or extend a minimal synthetic multi-outcome fixture covering:
  - shared opportunity supporting multiple outcomes
  - shared initiative addressing opportunities in different outcome bands
  - metric measuring multiple outcomes
  - dense same-edge arrivals on outcome west edges
  - visible `ADDRESSES`, `SUPPORTS`, and `MEASURED_BY` labels
- Add an `expectOrthogonalRoute(...)` helper equivalent to the service-blueprint assertion and apply it to step-2, step-3, and final outcome-opportunity routes.
- Add assertions for shared column-gap bridge tracks:
  - competing vertical bridge segments in the same column gap do not all share one x-coordinate
  - same-axis overlapping spans are at least 16px apart
- Add assertions for same-edge arrivals and departures:
  - same node side endpoints are at least 16px apart after final routing
  - final order is deterministic

Verification:

```bash
TMPDIR=/tmp pnpm exec vitest run tests/outcomeOpportunityMapRouting.spec.ts
```

Acceptance:

- new tests fail for the current routing defects or are explicitly marked with `it.todo` plus exact unblock conditions
- no production code changed
- the fixture is intentional and minimal; it is not a raw promotion of `outcome_opportunity_map_disposable.svg`

Stop if:

- the test can pass without checking actual route geometry
- the only way to express the fixture is through unsupported parser/projection behavior

## 8. Gate 2: Orthogonal Templates And Route-State Scaffolding

Goal: make route templates geometrically orthogonal and introduce local route-state scaffolding for later gates.

Allowed production write scope:

- `src/renderer/staged/outcomeOpportunityMapRouting.ts`

Allowed test write scope:

- `tests/outcomeOpportunityMapRouting.spec.ts`

Implementation tasks:

- Add local route segment helpers similar in responsibility to service-blueprint's route segment detail extraction.
- Add local segment and endpoint key helpers for outcome-opportunity routing.
- Introduce an internal route-state structure that can hold:
  - route
  - bridge coordinates where applicable
  - occupied gutter records
  - prepared endpoint and segment coordinate ownership
- Fix `buildEastWestTemplate(...)` so it emits a two-point route only when the points are truly horizontal.
- For non-alignable same-band and all cross-band east-west routes, emit horizontal departure, vertical bridge, and horizontal approach.
- Preserve deterministic parking fallback behavior and diagnostics.

Verification:

```bash
TMPDIR=/tmp pnpm exec vitest run tests/outcomeOpportunityMapRouting.spec.ts
```

Acceptance:

- every step-2 route in the routing test suite is geometrically orthogonal
- same-band direct routes remain direct only when endpoint y-coordinates legally align
- route-state scaffolding is local to `outcomeOpportunityMapRouting.ts`
- no service-blueprint or shared helper files changed

Stop if:

- the fix marks a diagonal route as orthogonal instead of changing its points
- the implementation requires editing shared routing utilities

## 9. Gate 3: Operational Occupancy Extraction

Goal: make occupancy records an input to routing decisions rather than final-route decoration.

Allowed production write scope:

- `src/renderer/staged/outcomeOpportunityMapRouting.ts`

Implementation tasks:

- Extract occupancy from prepared step-3 routes before final reconstruction.
- Group occupancy by key and axis.
- Ensure occupancy records capture:
  - connector id
  - segment index
  - axis and nominal coordinate
  - span start/end
  - column or row ownership when applicable
  - node-side endpoint ownership where applicable
  - locked endpoint records
- Make `routing_step_3_gutters` expose occupancy corresponding to step-3 geometry, not only final geometry.
- Keep node-gutter and global-gutter types outcome-opportunity-specific.

Verification:

```bash
TMPDIR=/tmp pnpm exec vitest run tests/outcomeOpportunityMapRouting.spec.ts
```

Acceptance:

- tests can inspect step-3 occupancy for real column, row, node-right, node-bottom, and edge-local entries where present
- occupancy grouping has deterministic sort order
- no final coordinate assignment is hidden in debug-only records

Stop if:

- occupancy still cannot affect route reconstruction in later gates
- route decisions depend on rendered SVG or CSS classes

## 10. Gate 4: Local Bundle Resolution

Goal: assign distinct local coordinates for competing tracks inside outcome-opportunity gutters.

Allowed production write scope:

- `src/renderer/staged/outcomeOpportunityMapRouting.ts`

Implementation tasks:

- Implement outcome-opportunity-local bundle resolution for:
  - opportunity-to-outcome support bridges
  - initiative-to-opportunity addressing bridges
  - outcome-to-metric measured-by bridges
  - dense metric fan-out
  - parking fallback routes where they occupy shared gaps
- For each gutter-local bundle:
  - group competing entries by key and axis
  - detect spans that touch or overlap
  - assign coordinates at fixed 16px spacing
  - record endpoint coordinate locks when an endpoint stem and route segment must move together
  - record segment coordinate locks for bundle-owned bridge segments
  - compute required column or row expansion when assigned coordinates exceed available gutter space
- Prefer service-blueprint control-flow shape, but keep names and types outcome-opportunity-specific.

Verification:

```bash
TMPDIR=/tmp pnpm exec vitest run tests/outcomeOpportunityMapRouting.spec.ts
```

Acceptance:

- overlapping vertical bridge tracks in a shared column gap receive distinct x-coordinates
- overlapping horizontal tracks in a shared row or band gap receive distinct y-coordinates
- fixed spacing is at least 16px unless a diagnostic explicitly marks degraded output
- bundle coordinate maps are consumed by prepared/final route reconstruction, not just recorded

Stop if:

- midpoint bridge coordinates remain final authority for competing tracks
- the implementation requires modifying `serviceBlueprintRouting.ts` or shared helpers

## 11. Gate 5: Late Endpoint Ordering

Goal: reorder endpoint offsets after prepared stems are known.

Allowed production write scope:

- `src/renderer/staged/outcomeOpportunityMapRouting.ts`

Implementation tasks:

- Add an outcome-opportunity version of service-blueprint's prepared stem coordinate inspection.
- Build endpoint side order overrides from prepared routes:
  - group by node id and side
  - sort incoming connectors by target-adjacent stem coordinate
  - sort outgoing connectors by source-adjacent stem coordinate
  - use deterministic connector priority as fallback
- Rebuild endpoint offsets with the overrides.
- Rebuild prepared routes after endpoint ordering.

Verification:

```bash
TMPDIR=/tmp pnpm exec vitest run tests/outcomeOpportunityMapRouting.spec.ts
```

Acceptance:

- same-edge arrivals and departures are spaced by at least 16px in final routes
- endpoint order follows adjacent prepared stem order where that prevents inversions
- deterministic priority remains the fallback for equal or unavailable stem coordinates
- no endpoint is pushed into node interiors

Stop if:

- endpoints are merely clamped closer together to fit short node edges without a diagnostic
- ordering depends on raw source order alone when prepared stems differ

## 12. Gate 6: Segment Displacement And Bounded Expansion

Goal: displace remaining overlapping same-axis segments and drive global gutter expansion from real overflow.

Allowed production write scope:

- `src/renderer/staged/outcomeOpportunityMapRouting.ts`

Implementation tasks:

- Implement local `resolveOccupancyDisplacements(...)` for non-bundle overlapping segments:
  - group by occupancy key and axis
  - detect overlapping spans
  - keep locked bundle segments fixed
  - displace movable segments by fixed 16px increments
  - use connector priority and segment index for deterministic ordering
- Update `resolveRequiredGlobalGutterState(...)` so required expansion includes:
  - bundle overflow
  - segment displacement overflow
  - existing endpoint and label pressure that remains valid
- Keep the bounded reroute loop, but make each pass:
  - build index for the current expanded scene
  - rebuild prepared routes
  - resolve bundles and late endpoints
  - resolve segment displacements
  - compute expansion from resolved geometry
- Preserve `MAX_GLOBAL_GUTTER_ATTEMPTS` behavior and emit diagnostics if a structural overflow remains.

Verification:

```bash
TMPDIR=/tmp pnpm exec vitest run tests/outcomeOpportunityMapRouting.spec.ts
```

Acceptance:

- overlapping same-orientation segments in the same gutter are separated by at least 16px after final routing
- global column and row expansion is computed from occupancy/displacement overflow, not only endpoint counts or label size
- rerouting is bounded and deterministic
- accepted proof cases have no hidden structural routing diagnostics

Stop if:

- the loop only reruns midpoint templates after expansion
- segment displacement breaks endpoint locks or creates diagonal segments

## 13. Gate 7: Final Route Reconstruction, Labels, And Diagnostics

Goal: reconstruct final routes from resolved route state, then place labels against final geometry.

Allowed production write scope:

- `src/renderer/staged/outcomeOpportunityMapRouting.ts`

Implementation tasks:

- Implement `buildFinalRoute(...)` for outcome-opportunity routes using:
  - final endpoint offsets
  - bundle endpoint coordinates
  - bundle segment coordinates
  - generic segment displacements
  - step-3 route topology
- Ensure final reconstruction handles:
  - direct single horizontal or vertical routes
  - multi-segment east-west bridges
  - north/south secondary reference routes
  - parking fallback routes
- Extract final occupancy after route reconstruction for diagnostics and debug artifacts.
- Place labels only after final routes are reconstructed.
- Tighten diagnostics:
  - error or blocker-level test failure for accepted proof-case diagonal route segments
  - warning for node intersections, endpoint intrusion, fallback label placement, and bounded expansion exhaustion
  - info for deterministic parking fallback

Verification:

```bash
TMPDIR=/tmp pnpm exec vitest run tests/outcomeOpportunityMapRouting.spec.ts tests/stagedVisualAcceptance.spec.ts
```

Acceptance:

- final routes preserve intended topology while using resolved coordinates
- no final route contains diagonal adjacent point pairs
- final routes do not cross non-endpoint node boxes or enter endpoint interiors in accepted proof cases
- labels are present for primary connectors unless a specific diagnostic explains omission
- labels do not overlap nodes, column headers, other labels, or nearby connector segments in accepted proof cases

Stop if:

- label placement is the only mechanism preventing unreadable merged tracks
- final route reconstruction ignores bundle or displacement coordinate maps

## 14. Gate 8: Golden And Corpus Evidence Capture

Goal: refresh evidence only after structural acceptance is satisfied.

Allowed write scope:

- outcome-opportunity renderer-stage goldens under `tests/goldens/renderer-stages/`
- outcome-opportunity rendered corpus artifacts under `examples/rendered/v0.1/outcome_opportunity_map_diagram_type/`
- outcome-opportunity docs in `docs/outcome_opportunity_map_renderer_implementation/`, if a concise status note is needed

Forbidden scope:

- production code
- service-blueprint or scenario-flow artifacts unless their tests fail from an allowed outcome-opportunity change, which should be unexpected and investigated before updating anything

Verification before artifact refresh:

```bash
TMPDIR=/tmp pnpm exec vitest run tests/outcomeOpportunityMapRouting.spec.ts tests/stagedOutcomeOpportunityMap.spec.ts tests/stagedVisualAcceptance.spec.ts
```

Artifact refresh commands should use existing repo scripts or test update flags. Do not hand-edit generated artifacts.

Verification after artifact refresh:

```bash
TMPDIR=/tmp pnpm exec vitest run tests/outcomeOpportunityMapRouting.spec.ts tests/stagedOutcomeOpportunityMap.spec.ts tests/stagedVisualAcceptance.spec.ts
TMPDIR=/tmp pnpm exec vitest run tests/stagedServiceBlueprint.spec.ts
git status --short
```

Acceptance:

- refreshed artifacts show no diagonal route segments
- competing vertical bridge tracks are visibly separated
- same-edge arrivals and departures use deterministic 16px spacing
- labels are readable and collision-free in accepted proof cases
- service-blueprint files remain unchanged

Stop if:

- any artifact refresh would normalize one of the three known failures
- service-blueprint behavior changes despite the forbidden production scope

## 15. Final Success Definition

The implementation is complete when all of these are true:

- step-2, step-3, and final outcome-opportunity routes are geometrically orthogonal
- shared column-gap bridge tracks do not collapse to one x-coordinate
- shared row/band tracks do not collapse to one y-coordinate
- same-edge arrivals and departures are deterministically spaced at 16px
- final labels are readable and collision-free for accepted proof cases
- debug artifacts show meaningful differences between template routing, gutter/occupancy routing, and final routed labels
- no production code outside the outcome-opportunity renderer changed
- snapshots and rendered artifacts were refreshed only after structural acceptance
