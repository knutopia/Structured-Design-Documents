# Service Blueprint Support Placement Implementation Plan

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
- `docs/service_blueprint_layout_rules.md`
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

### Slice 1. Separate Semantic Ownership From Physical Realization

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

Use sequential multi-agent execution rather than overlapping parallel edits on
the core contract.

Recommended split:

- the main thread freezes the contract and owns middle-layer changes first
- worker 1 updates focused middle-layer and pre-routing tests after the
  contract is stable
- worker 2 updates routing ordering and only the route assertions made invalid
  by the new placement
- worker 3 refreshes snapshots and rendered artifacts last

Do not run multiple coding agents concurrently on:

- `src/renderer/staged/serviceBlueprintMiddleLayer.ts`
- `src/renderer/staged/serviceBlueprintRouting.ts`
- `src/renderer/staged/contracts.ts`

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
