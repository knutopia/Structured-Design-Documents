# [Done] Service Blueprint Support Placement Implementation Plan


..we executed this, it misaligned the support columns, we fixed it in a sub-branch..

## Purpose

This note exists to guide the implementation thread that will replace the
current sidecar/right-rail support placement with anchored support-band
ownership plus physical spill-slot realization.

The target is:

- new middle-layer placement behavior
- minimal routing adaptation
- no unnecessary routing redesign

## Authority And Grounding

Authority order for this implementation:

- `docs/service_blueprint_renderer_implementation/AGENTS.md`
- `docs/service_blueprint_renderer_implementation/service_blueprint_layout_rules.md`
- `docs/service_blueprint_renderer_implementation/Second Service Blueprint Renderer Reset.md`
- `docs/service_blueprint_renderer_implementation/Service Blueprint Routing Rules.md`

Interpretation:

- the layout rules define semantic ownership
- the reset guards architecture
- the routing rules fill routing detail but must not re-own placement semantics

## Current Problem

The current implementation still expresses support-node placement through a
forced sidecar model:

- the middle layer encodes a semantic `R*` sidecar column
- semantic band ownership and physical x-placement are collapsed into one
  column model
- routing consumes `columnOrder` as both semantic order and physical order
- the current layout rules now require canonical support anchoring without
  forcing same-cell occupancy

Primary production files implicated by that mismatch:

- `src/renderer/staged/serviceBlueprintMiddleLayer.ts`
- `src/renderer/staged/serviceBlueprintRouting.ts`
- `src/renderer/staged/serviceBlueprint.ts`

## Contract And Interface Decisions

The implementation direction is locked as follows:

- semantic bands are only `anchor`, `interstitial`, and `parking`; there is no
  semantic sidecar band
- `columnOrder` remains the physical x-order used by layout and routing
- semantic ownership must be represented separately from physical column order
- slice 1 keeps the visible `system` lane unchanged
- `system_action` and `system_resource` are slice-1 placement concepts and
  metadata only
- slice 1 uses conservative spill
- each visible row/band cell has one primary visible slot
- action nodes win the primary slot over support nodes
- if the primary visible row/band cell already has an action node, support
  nodes spill immediately
- if only support nodes compete, one support node may keep the primary slot and
  the rest spill
- routing must keep using physical geometry for same-row and same-column
  decisions
- only ordering logic may be adapted to distinguish semantic band order from
  physical slot order

## Intended Runtime Contract

The implementation must introduce a runtime contract that separates semantic
ownership from physical realization.

Required concepts:

- semantic `bandOrder`
- physical `columnOrder`
- `slotKind`
- `slotOrderWithinBand`
- support-node ownership by semantic band
- spill columns owned by a semantic band

Implementation rule:

- these concepts must be introduced as type and interface changes in staged
  contracts and middle-layer metadata
- they must not be reintroduced indirectly through CSS-class parsing or
  view-specific backdoors

Runtime interpretation:

- semantic bands define chronology
- physical columns define realized x-position
- spill columns belong to a semantic band but do not create new chronology
- parking columns remain outside semantic chronology and stay terminal

## Implementation Slices

After completing a slice, mark it by prepending [Done] to its title. 

### [Done] Slice 1. Separate Semantic Ownership From Physical Realization

Goals:

- remove semantic sidecar from the middle layer
- make bands purely semantic
- introduce physical spill-slot realization owned by semantic bands
- keep visible lane guides unchanged
- keep parking after all semantic primary and spill columns

Required outcomes:

- support nodes are anchored to semantic bands by the current layout rules
- semantic bands remain `A1 / I1 / A2 / ...`
- proof-case physical realization may still contain four columns, but that
  fourth column must be an `A1` spill column rather than a semantic `R*`
  column

Done when:

- proof-case semantic ownership is correct
- no semantic sidecar remains in middle-layer outputs
- no routing code has been redesigned

### Slice 2. Minimal Routing Adaptation

Goals:

- adapt connector ordering to use semantic band order first and physical slot
  order second
- keep route templates, swerving, gutter allocation, and label logic intact
  unless a focused test proves a necessary adjustment

Required outcomes:

- routing continues to consume physical placement geometry
- only ordering and any narrowly justified follow-on fixes change
- routing does not become a second placement engine

Done when:

- routes still pass structural invariants
- no broad routing churn is required to support the new placement model

### Slice 3. Snapshot And Artifact Refresh

Goals:

- refresh service-blueprint stage goldens only after semantic ownership and
  focused routing tests are green
- refresh rendered example artifacts after goldens

Done when:

- committed goldens describe the new support-placement model
- rendered proof-case artifacts match the committed runtime behavior

### Slice 4. Cleanup Pass

Goals:

- remove stale `sidecar` and `shared_right_rail` vocabulary from remaining
  staged contracts and tests
- keep the cleanup narrow and only after behavior is green

Done when:

- stale sidecar vocabulary no longer shapes the staged service-blueprint path
- cleanup does not broaden scope into unrelated routing or styling work

## Test And Verification Plan

Run verification in this order:

- `TMPDIR=/tmp pnpm run build`
- `TMPDIR=/tmp pnpm exec vitest run tests/serviceBlueprintMiddleLayer.spec.ts`
- `TMPDIR=/tmp pnpm exec vitest run tests/serviceBlueprintPreRouting.spec.ts tests/stagedServiceBlueprint.spec.ts`
- refresh committed service-blueprint stage goldens and rendered proof-case artifacts
- `TMPDIR=/tmp pnpm test`
- `TMPDIR=/tmp pnpm run generate:rendered-examples`

Validation gates:

- no semantic `R*` remains
- proof-case semantic bands are exactly `A1 / I1 / A2`
- `D-020` and `PL-020` are both owned by semantic `A1`
- `D-020` is realized via an `A1` spill slot in slice 1
- parking remains terminal
- no new route or node intersection regressions appear
- routing remains mostly unchanged outside ordering and any narrowly justified
  fixes

## Multi-Agent Execution

Slice 1 is complete. Treat the current support-placement contract as the frozen
baseline for all remaining work.

Execution model:

- use sequential execution: one coordinator plus at most one coding worker at a
  time
- an optional read-only review/check worker may run between slices, but do not
  run two writing agents at once
- the coordinator owns slice boundaries, acceptance decisions, and any decision
  to reopen Slice 1 files

Frozen baseline:

- treat `src/renderer/staged/contracts.ts`,
  `src/renderer/staged/serviceBlueprintMiddleLayer.ts`, and the Slice 1
  support-placement metadata path as frozen
- Slice 2 may read that contract freely but must not change it unless a blocker
  proves the contract is insufficient
- if such a blocker appears, stop, document the mismatch, make one narrow
  coordinator-approved contract patch, then continue; do not let routing grow a
  placement backdoor

Global rules for remaining slices:

- do not run concurrent coding agents on:
  - `src/renderer/staged/serviceBlueprintMiddleLayer.ts`
  - `src/renderer/staged/serviceBlueprintRouting.ts`
  - `src/renderer/staged/contracts.ts`
- do not refresh goldens or rendered artifacts before Slice 2 behavioral gates
  pass
- preserve routing as a consumer of physical placement; ordering may use
  semantic band order plus local slot order, but same-row and same-column logic
  must still come from physical geometry
- after each slice, the owner must hand off:
  - files changed
  - commands run and results
  - acceptance gates satisfied / violated
  - unresolved blockers or residual risks
- do not begin the next slice until the coordinator accepts the current slice
  handoff

### Slice 2 Owner: Minimal Routing Adaptation

Ownership:

- primary write scope: `src/renderer/staged/serviceBlueprintRouting.ts`
- secondary write scope only if required by assertions:
  `tests/serviceBlueprintPreRouting.spec.ts`,
  `tests/stagedServiceBlueprint.spec.ts`
- read-only inputs: the frozen Slice 1 metadata and middle-layer outputs

Task:

- adapt connector ordering to use semantic band order first and physical slot
  order second
- keep route templates, swerving, gutter allocation, label logic, and merge
  behavior intact unless a focused failing test proves a narrow follow-on fix is
  necessary
- do not reintroduce semantic sidecar logic, CSS-class parsing, or
  routing-owned placement logic

Required output:

- routing uses `bandOrder` and `slotOrderWithinBand` only for ordering and
  tie-breaking
- physical geometry remains the source of same-row and same-column behavior
- test edits are limited to route assertions invalidated by the new
  owned-spill model

Focused verification:

- `TMPDIR=/tmp pnpm run build`
- `TMPDIR=/tmp pnpm exec vitest run tests/serviceBlueprintMiddleLayer.spec.ts`
- `TMPDIR=/tmp pnpm exec vitest run tests/serviceBlueprintPreRouting.spec.ts`
- `TMPDIR=/tmp pnpm exec vitest run tests/stagedServiceBlueprint.spec.ts -t "builds a fixed root grid|renders routing stages|expands the lane gutter|merges routing-compatible same-node connectors|keeps incompatible same-node connectors separate|appends a synthetic ungrouped lane shell|keeps disconnected scene construction deterministic"`

Slice 2 gate:

- all focused non-snapshot service-blueprint tests are green
- no new `renderer.routing.service_blueprint_node_intersection` failures appear
- no broad routing churn is needed
- no Slice 1 contract reopening occurred without explicit approval

### Slice 3 Owner: Snapshot And Artifact Refresh

Prerequisite:

- Slice 2 gate is green

Ownership:

- `tests/goldens/renderer-stages/service-blueprint.slice.*`
- proof-case rendered outputs under
  `examples/rendered/v0.1/service_blueprint_diagram_type/service_blueprint_slice_example/`

Task:

- refresh only the committed stage goldens and rendered proof-case artifacts
  that now legitimately differ because of the Slice 1 plus Slice 2 model
- do not mix in unrelated renderer-stage golden churn or unrelated example
  churn

Verification order:

- confirm the Slice 2 focused suite is still green
- refresh the eight `service-blueprint.slice.*` stage goldens used by
  `tests/stagedServiceBlueprint.spec.ts`
- `TMPDIR=/tmp pnpm exec vitest run tests/stagedServiceBlueprint.spec.ts`
- `TMPDIR=/tmp pnpm test`
- `TMPDIR=/tmp pnpm run generate:rendered-examples`

Slice 3 gate:

- the snapshot subtest in `tests/stagedServiceBlueprint.spec.ts` is green
- the full repo test suite is green
- generated rendered examples match committed runtime behavior for the proof
  case
- artifact churn is limited to service-blueprint outputs justified by the new
  placement model

### Slice 4 Owner: Cleanup Pass

Prerequisite:

- Slice 3 gate is green

Ownership:

- remaining active-path service-blueprint staged files and tests that still use
  stale `sidecar` or `shared_right_rail` vocabulary

Task:

- remove only stale terminology that still shapes active staged behavior or
  assertions
- keep cleanup narrow; do not rewrite historical problem statements, reference
  notes, or legacy artifact names whose purpose is to describe the old model

Suggested search seed:

- `rg -n "sidecar|shared_right_rail|band_aligned_support|R\\*" src/renderer/staged tests`

Verification:

- `TMPDIR=/tmp pnpm run build`
- `TMPDIR=/tmp pnpm exec vitest run tests/serviceBlueprintMiddleLayer.spec.ts tests/serviceBlueprintPreRouting.spec.ts tests/stagedServiceBlueprint.spec.ts`
- `TMPDIR=/tmp pnpm test`

Slice 4 gate:

- no stale sidecar/right-rail vocabulary remains in the active staged
  service-blueprint path
- behavior is unchanged from Slice 3 except for terminology cleanup
- cleanup does not broaden into unrelated routing, styling, or non-service-
  blueprint work

Recommended sequence:

1. coordinator freezes the Slice 1 baseline and assigns Slice 2
2. Slice 2 worker lands routing ordering and focused test updates
3. optional read-only reviewer checks that Slice 2 stayed within ordering-only
   scope
4. Slice 3 worker refreshes stage goldens and proof-case rendered artifacts
5. optional read-only reviewer checks artifact churn scope
6. Slice 4 worker removes stale active-path vocabulary and reruns the
   service-blueprint suite

## New Thread Handoff

Implement the service-blueprint support-placement update by separating semantic
band ownership from physical slot realization.

Locked decisions:

- no semantic `R*` sidecar band
- semantic bands remain `A1 / I1 / A2 / ...`
- slice 1 keeps a single visible `system` lane
- `system_action` and `system_resource` exist only as placement concepts and
  metadata in slice 1
- slice 1 uses conservative spill
- routing must remain a consumer of physical placement, not a second placement
  engine

Execution order:

- slice 1: middle-layer semantic ownership plus physical spill slots
- slice 2: minimal routing-order adaptation
- slice 3: snapshots and artifact refresh
- slice 4: cleanup

Acceptance gates:

- no semantic `R*`
- proof-case bands exactly `A1 / I1 / A2`
- `D-020` and `PL-020` both owned by semantic `A1`
- `D-020` realized as an `A1` spill slot in slice 1
- parking remains terminal
- no new route or node intersection regressions
