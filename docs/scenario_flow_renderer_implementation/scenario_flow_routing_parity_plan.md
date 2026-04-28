# Scenario Flow Routing Sophistication Parity Plan

## Summary

Goal: bring staged `scenario_flow` routing to sophistication parity with the proven `service_blueprint` routing pipeline, specifically eliminating endpoint-node pass-through, parallel segment overlap/near-overlap, and missing row/column gutter expansion.

Authoritative design goals:

- Preserve staged boundaries: `Projection -> RendererScene -> MeasuredScene -> PositionedScene -> SVG -> PNG`; never put final coordinates or route polylines in `RendererScene`.
- `scenario_flow` must use no Elk or external layout engine.
- Every connector must leave and enter endpoint nodes from the exterior side of the selected port edge; source, target, and non-endpoint node interiors must never be crossed.
- Same-orientation connector segments whose spans overlap must be separated by at least `16px`, matching `FIXED_SEPARATION_DISTANCE` in `src/renderer/staged/serviceBlueprintRouting.ts`.
- Scenario-flow routing must implement the service-blueprint mechanics represented by `buildNodeEdgeBuckets`, `buildNodeGutters`, `buildGutterRects`, `buildGutterLocalBundleResolution`, `resolveOccupancyDisplacements`, `applyGlobalGutterExpansions`, and the iterative final routing loop in `buildServiceBlueprintRoutingStages`.
- Existing scenario-flow semantic placement, branch-label profile behavior, debug artifacts, staged SVG/PNG backend registration, and legacy Graphviz selection remain in scope and must keep working.

## Key Changes

- Replace the simplified final-routing path in `src/renderer/staged/scenarioFlowRouting.ts` with a service-blueprint-equivalent phase model:
  - side buckets for all node sides
  - endpoint offsets per node side
  - per-node right/bottom gutter availability
  - gutter occupancy records keyed by node, lane, column, obstacle, and edge-local segment
  - bundle-local segment separation
  - global column/lane expansion when local spacing does not fit
  - rerouting after each expansion pass
  - final endpoint and node-intersection diagnostics

- Extend scenario-flow routing stage data to expose parity evidence:
  - `nodeGutters`
  - `globalGutterState`
  - final `gutterOccupancy` with `key`, `nominalCoordinate`, `axis`, `kind`, `columnOrder`, `laneOrder`, `routeSegmentIndex`, and optional `ownershipRank`
  - retain existing `step2PositionedScene`, `step3PositionedScene`, `finalPositionedScene`, `connectorPlans`, and debug SVG/PNG flows for compatibility.

- Add reusable test helpers for:
  - endpoint exterior approach by side
  - source/target/non-endpoint node interior intersection
  - same-orientation segment overlap and near-overlap
  - minimum segment separation of `16px`
  - row/column expansion evidence.

## Gates

### Gate 0: Authority And Failing-Surface Inventory [Done]

- Document exact current gaps in `scenarioFlowRouting.ts` compared with `serviceBlueprintRouting.ts`.
- Record the authoritative service-blueprint functions named above and the scenario-flow design invariants they satisfy.
- No implementation changes beyond saving this plan.
- Verification: `git diff --check`.

Implementation summary: recorded the parity plan and the service-blueprint mechanisms that scenario-flow routing must match, with endpoint exterior routing, keyed occupancy, displacement, and global expansion as non-negotiable design goals.

### Gate 1: Endpoint Exterior Approach [Done]

- Add visual/geometry tests proving every final scenario-flow edge approaches source and target from outside the selected side.
- Update routing endpoint resolution so final route endpoints are side-offset points derived from node boxes and node-side buckets, not shared raw port-center points.
- Acceptance:
  - no connector segment enters the interior of its source or target node
  - existing branch-label and non-endpoint crossing tests still pass.
- Verification: scenario-flow routing tests plus `tests/stagedVisualAcceptance.spec.ts`.

Implementation summary: final scenario-flow endpoints now use side-offset exterior points derived from node boxes and node-side buckets. Focused routing and staged visual acceptance tests assert that final routes do not enter source or target node interiors.

### Gate 2: Service-Blueprint-Style Gutter Model [Done]

- Add scenario-flow `nodeGutters`, `globalGutterState`, and full keyed occupancy records.
- Build gutter rects for node-right, node-bottom, global column, global lane, obstacle-local, and edge-local occupancy.
- Keep step-2 and step-3 debug artifacts meaningful: step 2 shows endpoint/template routes; step 3 shows gutter occupancy before final expansion.
- Acceptance:
  - tests can assert per-node gutter availability and occupancy keys for `scenario_branching.sdd`
  - no final scene behavior depends on CSS class parsing or raw source reconstruction.
- Verification: scenario-flow routing/debug tests and staged snapshots.

Implementation summary: routing stages now expose `nodeGutters`, `globalGutterState`, and keyed `gutterOccupancy` records for node, column, lane, edge-local, and obstacle-local claims while preserving step-2/step-3 debug scenes and artifacts.

### Gate 3: Segment Separation And Bundle Resolution [Done]

- Port/adapt service-blueprint bundle mechanics for scenario-flow:
  - local bundle claim ordering
  - endpoint-coordinate displacement
  - segment-coordinate displacement
  - locked segment keys
  - obstacle-local compaction.
- Add tests that fail on horizontal or vertical segment overlap/near-overlap.
- Acceptance:
  - overlapping same-orientation route spans are separated by at least `16px`
  - higher-priority `PRECEDES` routes keep canonical tracks before navigation, transition, and realization routes.
- Verification: focused routing tests plus visual acceptance.

Implementation summary: scenario-flow now resolves local and global occupancy with deterministic priority ordering, locked endpoint approach segments, source/segment coordinate displacement, and reusable tests requiring overlapping same-orientation segments to be at least `16px` apart.

### Gate 4: Global Row/Column Gutter Expansion [Done]

- Implement iterative final routing like `buildServiceBlueprintRoutingStages`:
  - prepare routes
  - compute occupancy displacements
  - compute required column/lane expansions
  - apply global gutter expansions to cells/nodes
  - rebuild index and reroute
  - repeat with a bounded attempt count.
- Add compressed-layout tests modeled on the service-blueprint crowded-gutter test.
- Acceptance:
  - constrained horizontal space expands columns
  - constrained vertical space expands lanes
  - expansion shifts whole later columns/rows, not individual routes only
  - final output has no endpoint intrusion and no segment overlap.
- Verification: compressed scenario-flow test, full scenario-flow suite, staged visual acceptance.

Implementation summary: final routing now iterates through route preparation, occupancy displacement, required column/lane expansion, positioned-cell translation, index rebuild, and reroute with a bounded attempt count. Tests assert row/column expansion evidence and final absence of endpoint intrusion or segment overlap.

### Gate 5: Goldens, Corpus, And Closeout [Done]

- Refresh only scenario-flow renderer-stage goldens and rendered corpus artifacts after Gates 1-4 pass.
- Update the scenario-flow design/plan docs to say parity is achieved only through endpoint offsets, keyed occupancy, displacement, and global expansion.
- Run the full suite.
- Acceptance:
  - final SVG/PNG is visually acceptable against the parity goals
  - all docs, tests, debug artifacts, and corpus outputs agree
  - no service-blueprint behavior changes.
- Verification:
  - `TMPDIR=/tmp pnpm exec vitest run tests/scenarioFlowMiddleLayer.spec.ts tests/scenarioFlowPreRouting.spec.ts tests/scenarioFlowRouting.spec.ts tests/stagedScenarioFlow.spec.ts tests/stagedVisualAcceptance.spec.ts tests/viewRenderers.spec.ts tests/cli.spec.ts tests/renderedCorpus.spec.ts`
  - `TMPDIR=/tmp pnpm run generate:rendered-examples`
  - `TMPDIR=/tmp pnpm test`
  - `TMPDIR=/tmp pnpm run build`
  - `git diff --check`

Implementation summary: scenario-flow renderer-stage goldens were refreshed after the parity gates passed. The rendered corpus and full test/build verification are part of closeout evidence for this implementation.

## Assumptions

- Do not mutate `serviceBlueprintRouting.ts` except for tiny, behavior-preserving extraction if absolutely necessary; prefer scenario-flow-specific adaptation first.
- Use `16px` as the required connector separation distance to match service-blueprint.
- Keep all routing sophistication inside the staged renderer after placement; parser, compiler, validator, projection, and bundle semantics are out of scope.
- The proof case remains `bundle/v0.1/examples/scenario_branching.sdd`, with additional synthetic/compressed tests allowed only to prove gutter expansion mechanics.
