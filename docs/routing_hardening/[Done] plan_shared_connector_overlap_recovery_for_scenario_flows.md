# [Done] Shared connector-overlap recovery for scenario flows

A.k.a. yet another routing optimization

## Implementation progress — 2026-10-07

- [x] Read the saved plan, routing contracts, and repository guardrails. The only pre-existing workspace change is this user-supplied plan file.
- [x] Step A: add regressions and record failures before changing production routing.
- [x] Steps B–C: add private shared overlap alternatives and integrate them into the bounded lifecycle.
- [x] Verify synthetic recovery, the eight scenario render configurations, and renderer compatibility.
- [x] Run the build/full suite, inspect SVG/PNG proof artifacts, and record evidence in the routing documentation.

Current assessment: **the planned routing implementation is complete**. Shared geometric invariants, integration, compatibility, and incremental visual acceptance pass. The repository suite has two independently reproduced pre-existing input failures, detailed below, and is not claimed green. The existing shared-contract baseline passed **42/42 tests** (6.65s). Before the production edit, the expanded shared regressions had **12 expected failures and 4 passing protection tests**; the scenario matrix and PNG test had **9/9 expected failures**. Compilation, simple validation, and named-diagram projection passed. After the edit, **58/58 shared tests pass** (new 16 plus existing 42), and TypeScript builds successfully. Independent code review found no correctness issues. Logs: `/tmp/sdd-overlap-core-red.log`, `/tmp/sdd-overlap-core-green.log`, `/tmp/sdd-overlap-compatibility.log`. The implementation offers shared corridor alternatives after existing assignment/turn successes, with the same full-context evaluator and counters.

Integration progress: **9/9 scenario tests pass**, covering all eight emitted-geometry/SVG configurations and the PNG preview. Every configuration resolves in **1 revision / 154 candidates / 0 expansion passes**; independent conflicts are zero and nodes/endpoints/bounds are retained. Artifacts and initial/final traces are in `/tmp/sdd-scenario-overlap-recovery`. The eight-mode contact sheet and PNG have been inspected for connector separation, arrow attachment, and clipping. The before/after comparison confirms cross-link labels were already detached outside the node rows in the unrepaired preparation; one reflows after repair. Existing visual-harness checks now pass for label-label/node/header collisions, other-route label crossings, and root containment in all eight configurations. The incremental routing output is accepted with this existing label-association limitation documented.

Compatibility progress: **85/85 tests in nine files pass** (116.69s), including existing adopter proofs, marker expansion, UI routing optimization, Scenario snapshots, visual acceptance, and named-diagram CLI/projection. Routing decisions and execution evidence have been updated. The build/full repository suite completed with the existing timeout and two-worker limit; no snapshots or goldens were changed.

Full-suite result: **1,675 passed / 2 failed across 153 files (151 passed / 2 failed)**, 586.55s; TypeScript builds successfully. Log: `/tmp/sdd-overlap-full-suite.log`. Both failures are pre-existing and independently reproduced:

- `tests/diagramTypeNodeEdgeReference.spec.ts` reads missing `docs/doc_site/diagram_types/node_edge_reference.md`; `git cat-file -e HEAD:docs/doc_site/diagram_types/node_edge_reference.md` confirms that file is absent from HEAD. The targeted rerun reproduces ENOENT (`/tmp/sdd-overlap-unrelated-doc-failure.log`).
- `tests/scenarioFlowBottomExit.spec.ts` forces the v0.1 bundle/header onto a planning source already using v0.2 `ScenarioStep` declarations. It fails compilation before invoking routing. The test, planning source, parser/compiler, and v0.1 bundle are unchanged from HEAD, and the targeted rerun reproduces the parse errors (`/tmp/sdd-overlap-bottom-exit-failure.log`).

The full result, invariant assessment, and remaining label-association limitation are recorded in [the execution ledger](implementation_status.md#shared-scenario-overlap-recovery--2026-10-07). Required routing acceptance is satisfied; the unrelated repository failures remain visible and no golden updates hide them. `git diff --check` passes.

## 1. Objective and evidence

Improve the shared routing lifecycle so it can resolve connector overlaps that require adding bends. Use the existing corridor candidate generator and retain complete geometry validation.

The reproduced failure is a seven-node scenario flow with two cross-linked branches. Its source validates, but staged rendering fails across all eight combinations of render detail and node decorators. The original user document is unavailable, so this work addresses the reproduced failure class; it cannot establish the exact cause of that original incident.

The investigation identified a specific gap:

- `buildTerminalTurnAlternatives` moves existing bends but cannot introduce the additional bends needed here.
- `buildPortCorridorCandidates` already generates valid replacements. For each conflicting connector in the scenario proof, 14 of its 28 alternatives pass complete route-set validation.
- The lifecycle invokes corridor reconstruction for blocking violations, but excludes `collinear_overlap` and `track_separation` from that recovery path.

**Implement the missing orchestration in shared routing code. A new routing algorithm is unnecessary.**

## 2. Required contracts and scope

Use these sources as the implementation authority:

- [AGENTS.md](/home/knut/projects/sdd/AGENTS.md): shared renderer ownership, projection boundary, deterministic output, and proof before snapshot updates.
- [Routing contract decisions](/home/knut/projects/sdd/docs/routing_hardening/design_decisions.md): complete final validation, search budgets, endpoint constraints, crossing policy, and failure behavior.
- [Shared lifecycle](/home/knut/projects/sdd/src/renderer/staged/routingCore/lifecycle.ts): current acceptance and search implementation.
- [Candidate generation](/home/knut/projects/sdd/src/renderer/staged/routingCore/candidates.ts): existing route reconstruction and eligibility restrictions.

The implementation must satisfy these invariants:

1. Every accepted candidate passes `validateFinalRouteSet` against the complete connector set.
2. For the reproduced fixture, repair succeeds without moving nodes, endpoints, or canvas bounds and without requesting expansion.
3. Endpoint sides, terminal clearance, node clearance, blockers, resource constraints, and crossing policy remain enforced.
4. Already-valid input retains its geometry and returns without repair.
5. Search stays deterministic and within the existing default limits: 4,096 candidates and 128 repair revisions, shared across expansion passes.
6. Failed routing continues to expose diagnostics without an accepted route map or published preview artifact.
7. Existing atomic recovery for multiple blocking violations continues to work.

This is renderer geometry work under existing port permissions. It requires **no bundle changes, public API additions, CLI options, diagnostic codes, or trace fields**.

Keep endpoint reassignment, new capacity expansion, intentional shared trunks, Journey migration, and changes to legacy rendering outside this implementation.

## 3. Implementation steps

### Step A — Establish the regression before changing production code

Create:

- `tests/fixtures/render/scenario_overlap_reconvergence.sdd`
- `tests/routingOverlapRecovery.spec.ts`
- `tests/scenarioFlowOverlap.spec.ts`

Use the complete scenario fixture below. It must be checked into the repository; tests must not depend on the temporary investigation files.

```text
SDD-TEXT 0.2
ScenarioStep S-001 "Choose an option"
  PRECEDES S-002 {option 1} diagrams=DG-001
END

ScenarioStep S-002 "Action 002"
  kind=decision
  PRECEDES S-003 {option 1} diagrams=DG-001
  PRECEDES S-004 {option 2} diagrams=DG-001
END

ScenarioStep S-003 "Action 003"
  kind=decision
  PRECEDES S-005 {option 1} diagrams=DG-001
  PRECEDES S-006 {option 2} diagrams=DG-001
END

ScenarioStep S-004 "Action 004"
  kind=decision
  PRECEDES S-005 {option 1} diagrams=DG-001
  PRECEDES S-006 {option 2} diagrams=DG-001
END

ScenarioStep S-005 "Action 005"
  PRECEDES S-099 {option 1} diagrams=DG-001
END

ScenarioStep S-006 "Action 006"
  PRECEDES S-099 {option 1} diagrams=DG-001
END

ScenarioStep S-099 "Action 099"
END

Diagram DG-001 "Probe"
  diagram_type=scenario_flow
END
```

Write tests expressing the desired successful outcome and run them before the fix. Record their failures; do not commit tests whose final expectation is that routing remains broken.

The existing focused baseline is 42 passing tests across corridor recovery, lifecycle, acceptance, and node clearance. Recheck that baseline if the implementation starts from a different revision.

### Step B — Add a private overlap-alternative generator

Add this private helper in `lifecycle.ts`:

```ts
function* buildOverlapCorridorAlternatives(
  context: FinalRoutingContext,
  violations: readonly RoutingViolation[]
): Generator<readonly FinalRoutingConnector[]>
```

Required behavior:

1. Return immediately if the context contains any blocking violation according to the existing `hasBlockingViolation`.
2. Select connector IDs mentioned in `collinear_overlap` or `track_separation` violations.
3. Deduplicate those IDs and sort their connectors by ascending priority, then connector ID.
4. For each selected connector, iterate `buildPortCorridorCandidates(connector, context)`.
5. Yield a complete connector array replacing that connector’s route points only.
6. Clone replacement points and preserve the connector’s remaining metadata.
7. Clear `markedCrossings` on every connector in the yielded revision, following the existing turn-repair convention. Marks describe the old geometry.
8. Preserve the input context and connector objects.

Use the existing generator’s restrictions directly. It already excludes straight routes and connectors with topology-bound run constraints or shared-track ownership. Do not remove constraints to make those connectors eligible.

Keep the helper private. Do not export it through the routing barrel.

### Step C — Integrate alternatives into the existing search

Modify the per-state repair loop in `runRoutingLifecycle`.

Keep assignment preparation and existing atomic blocking recovery unchanged. For each popped queue state:

```text
Increment the existing repair-revision counter.

Evaluate existing terminal-turn alternatives.
Use the existing assignment candidate and valid-turn preference.

If a valid result was found:
    Return the preferred valid result.

If candidate budget remains:
    Evaluate overlap corridor alternatives for this same state.

If a valid corridor result was found:
    Return the preferred valid result.

Continue with the existing queue and expansion behavior.
```

This gives current assignment and single-turn successes precedence. Corridor reconstruction becomes available during the current repair revision, before later queued revisions can exhaust the search.

Both candidate families must use the same evaluation behavior:

1. Check the remaining candidate budget.
2. Construct the complete next context.
3. Calculate its existing canonical key.
4. Skip previously seen geometry and increment `repeatedStates`.
5. For a new candidate, increment `candidates`.
6. Run complete validation and increment `validations`.
7. Calculate the existing score and update the best diagnostic state.
8. Retain valid results using the existing comparator.
9. Enqueue invalid results only when they contain no blocking violations.

A small local evaluator may remove duplication between these two loops. Keep that refactor confined to the lifecycle.

Allow corridor alternatives that repair one overlap while leaving another traversable conflict to enter the queue. This is necessary for diagrams containing multiple independent conflicts.

Do not:

- Expand `TRAVERSABLE_VIOLATION_KINDS`.
- Broaden the old atomic `buildCorridorRecovery` helper to handle overlaps.
- Add a separate retry loop or reset search counters.
- Change scoring, canonical ordering, expansion ownership, or failure-reason precedence.
- Disable validation to accept a route.
- Add a scenario-specific repair pass.

The old blocking recovery must remain atomic: repairing only one connector can leave other hard-invalid connectors that prevent intermediate states from entering the queue.

## 4. Regression tests

### Shared routing tests

Build a view-independent context with two orthogonal connectors:

| Connector | Route points | Priority |
|---|---|---:|
| A | `(0,0) → (50,0) → (50,100) → (100,100)` | 0 |
| B | `(0,100) → (50,100) → (50,0) → (100,0)` | 1 |

For both connectors:

- Source side: `east`; source minimum leg: `0`.
- Target side: `west`; target minimum leg: `12`.
- Endpoint points equal the route’s first and last points.
- Distinct endpoint node IDs.
- Bounds: `{ minX: -64, minY: -44, maxX: 164, maxY: 144 }`.
- Policy: separation `16`, epsilon `0.5`, crossing treatment `penalize`, expansion passes `0`.
- No expansion callback.

This context currently fails after 128 repair revisions despite the existing corridor generator offering valid routes.

Test these cases:

| Case | Required assertion |
|---|---|
| Base overlap, no boxes | Resolves; full validator and independent overlap oracle report zero conflicts. |
| Endpoint clearance | Same result with the endpoint boxes below, each carrying clearance `16`. |
| Near-parallel tracks | Replace B with `(0,108) → (58,108) → (58,8) → (100,8)`; verify initial spacing violations and successful repair. |
| Two independent overlap pairs | Add a second pair translated down by `200`, with unique IDs and extended bounds; both pairs resolve through composed repairs. |
| Geometric variants | Transpose coordinates and port sides; reverse routes and swap endpoints; translate the fixture. Each remains valid after repair. |
| Determinism | Repeat identical input and reorder the connector array while preserving IDs and priorities; compare accepted routes by connector ID. |
| Unaffected geometry | Add a distant valid connector; its route remains unchanged. |
| Budget exhaustion | With `maxCandidates: 1`, and separately `maxRepairRevisions: 0`, the unresolved base fixture fails within budget and exposes no accepted route map. |
| Valid-input fast path | Run the accepted context again; geometry remains equal and repair counters remain zero. |

Endpoint boxes for the clearance case:

| ID | Rectangle `(x, y, width, height)` |
|---|---|
| A source | `(-40, -20, 40, 40)` |
| A target | `(100, 80, 40, 40)` |
| B source | `(-40, 80, 40, 40)` |
| B target | `(100, -20, 40, 40)` |

For every successful case, assert:

- Complete validation succeeds.
- `independentParallelConflicts` returns zero.
- Endpoint positions and declarations, boxes, and bounds are preserved.
- Expansion count is zero.
- Input geometry was not mutated.

Retain the existing tests covering straight-route restrictions, run locks, shared-track ownership, stale crossing marks, blockers, and atomic blocking recovery. Add a focused regression only where those suites do not exercise the new path.

### Scenario integration tests

Follow the real-renderer spy pattern in [routingHardeningScenario.spec.ts](/home/knut/projects/sdd/tests/routingHardeningScenario.spec.ts).

Load the v0.2 bundle, compile the fixture, validate with `simple`, and select `DG-001` through `projectDiagram`.

Run all eight combinations:

| Render detail | Decorator modes |
|---|---|
| `compact` | `none`, `type`, `id`, `type,id` |
| `detailed` | `none`, `type`, `id`, `type,id` |

For each combination:

1. Render through `renderScenarioFlowStagedSvg` using the real lifecycle.
2. Assert no error diagnostics and a resolved lifecycle result.
3. Reconstruct the validation context using routes from the emitted `positionedScene`.
4. Validate that emitted geometry and run the independent conflict oracle.
5. Compare accepted endpoints, node boxes, and bounds with the initial lifecycle context.
6. Assert zero final expansion passes.

Also exercise `renderSourcePreview` with `diagramId: "DG-001"`:

- SVG artifacts succeed for all eight combinations.
- Repeated identical rendering produces identical SVG text with LF newlines.
- Diagram identity and title are retained.
- One `detailed` / `type,id` PNG render succeeds through the staged SVG-derived path.

Keep the existing irreparable-context test proving that routing failure prevents artifact publication. Use the normal staged backend without `force` or Graphviz fallback.

Avoid assertions tied to exact coordinates, candidate counts, or a particular winning connector. Those are implementation details; valid deterministic geometry is the acceptance criterion.

## 5. Verification, documentation, and completion

Run commands from the repository root with `TMPDIR=/tmp`.

First run the new regressions and focused shared-contract suites:

```bash
TMPDIR=/tmp pnpm exec vitest run \
  tests/routingOverlapRecovery.spec.ts \
  tests/scenarioFlowOverlap.spec.ts \
  tests/routingCorridorRecovery.spec.ts \
  tests/routingHardeningLifecycle.spec.ts \
  tests/routingHardeningAcceptance.spec.ts \
  tests/routingNodeClearance.spec.ts \
  --maxWorkers=2 --minWorkers=1
```

Then run renderer compatibility checks:

```bash
TMPDIR=/tmp pnpm exec vitest run \
  tests/routingHardeningScenario.spec.ts \
  tests/routingHardeningOutcome.spec.ts \
  tests/routingHardeningOutcomeExpansion.spec.ts \
  tests/routingHardeningService.spec.ts \
  tests/uiContractsRoutingOptimization.spec.ts \
  tests/stagedScenarioFlow.spec.ts \
  tests/stagedVisualAcceptance.spec.ts \
  tests/diagramSeparationCli.spec.ts \
  tests/diagramSeparationProjection.spec.ts \
  --maxWorkers=2 --minWorkers=1
```

Finally run the build and complete suite:

```bash
TMPDIR=/tmp pnpm test --maxWorkers=2 --minWorkers=1
```

Use the existing test timeout. Investigate new failures instead of increasing timeouts or routing budgets.

Render the eight proof SVGs and one PNG into a temporary evidence directory. Inspect the actual repaired output for connector ambiguity, arrow attachment, label collisions, and clipping. The routing validator alone does not establish overall visual quality.

Update `docs/routing_hardening/design_decisions.md` to explain the two recovery paths:

- Atomic reconstruction for blocking violations.
- Queued corridor alternatives for traversable overlap and spacing conflicts.

Append dated evidence to `docs/routing_hardening/implementation_status.md`, including the fixture, test results, actual search traces, visual assessment, and the limitation that the original incident source remains unavailable.

**Completion criteria**

- The proof renders successfully in all eight configurations.
- The shared synthetic cases pass complete and independent geometry checks.
- Existing hard-recovery, budget, failure-publication, and renderer compatibility tests pass.
- Visual inspection finds no new readability defect.
- Documentation describes the implemented behavior and its bounded-search limits.

Do not refresh existing snapshots or goldens until those criteria hold. If success appears to require weakened validation, new semantic permissions, larger budgets, or speculative scenario-specific tuning, stop and report the failing invariant before broadening this change.
