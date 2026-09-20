# Routing Triage — 2026-09-18

Three items, in the order they should be worked.

Companion document: `routing_fragility_assessment.md` (the broader assessment this
triage came out of).

**Status: Items 1 and 2 IMPLEMENTED (2026-09-18). Item 3 VERIFIED — CONFIRMED
(2026-09-18). Follow-up measurement found the proposed ceiling-partition fix ineffective;
STOP CONDITION reached, two distinct defects identified.**
See "Implementation record", "Item 3 verification record", and "Step 1 follow-up" below.

---

## Item 1 — Timeout-based testing (must resolve; options explained)

### The problem in plain terms

Two tests added with the hang fix assert **wall-clock time**:

| Test | File | Assertion |
| --- | --- | --- |
| `bounds a dense competing component so the search cannot run away` | `tests/routingCore.spec.ts` | `expect(Date.now() - started).toBeLessThan(5_000)` |
| `resolves a dense movable claim set through the occupancy path without running away` | `tests/routingHardeningAssignment.spec.ts` | `expect(Date.now() - started).toBeLessThan(5_000)` |

Both build a dense 28-claim component — the shape that caused the hang — and assert it
finishes in under 5 seconds.

**Why this is unsatisfactory:**

- *It can flake.* "Under 5 seconds" depends on machine load. A busy CI runner can fail
  a correct build.
- *It measures the wrong thing.* What we actually care about is "the search budget is
  small." Time is only an indirect proxy for that.

**Why it is not useless, though:** the dense component *exhausts* whatever budget it is
given rather than pruning early. Measured: budget 2000 → 535 ms (~0.27 ms/state). So a
revert to the old 100,000 default would take ~27 s and would fail the assertion. The
guard does work — it is just probabilistic and load-sensitive.

### The options

**Option A — Assert the constant directly (recommended).**

```ts
expect(OCCUPANCY_SOLVER_SEARCH_STATES).toBeLessThanOrEqual(250);
```

- Deterministic. No clock, no flake.
- Catches exactly the regression that matters: someone raising or removing the budget.
- No API change. The constant is already exported.
- `tests/routingCore.spec.ts` already does the analogous thing for
  `DEFAULT_SOLVER_SEARCH_STATES < 100_000`; the occupancy constant is the one still
  unguarded, and it is the one that actually fixes the hang.

**Option B — Expose a visited-state count from the solver.**

Assert `visited <= budget` instead of time. Fully deterministic and measures the real
quantity.

- Cost: `RoutingSolveResult` (in `routingCore/contracts.ts`) currently exposes only
  `status`, `assignments`, `violations`, and `expansionRequests`. Adding `visited` is a
  **change to a shared public contract**, made purely to support a test.
- Not recommended: real API surface change for less benefit than Option A.

**Option C — Keep the wall-clock assertion but loosen it.**

Raise the threshold (e.g. 20 s) so it only trips on a true blow-up.

- Still load-sensitive, just less often.
- Weakens the guard: a 20 s threshold tolerates a lot of regression.

**Option D — Drop the timing assertion entirely.**

Rely on the correctness assertions (`status === "resolved"`, separation holds,
deterministic under input reversal) plus vitest's own `testTimeout` (default 5000 ms) as
an implicit backstop.

- Simplest. Vitest's own timeout would still fail a 27 s blow-up.
- But the failure message becomes a generic timeout rather than a pointed one.

### Recommendation

**Option A, plus keep the correctness assertions.** Add the constant assertion, and
either drop the wall-clock check or keep it at a generous threshold as a smoke test.
Result: a deterministic guard, no flake risk, no contract change.

### Note on a trap to avoid

Do **not** "fix" this by passing an explicit small `maxSearchStates` *inside the test*.
That bounds runtime by construction, but it stops catching the regression: if the
production constant were reverted to 100,000, a test supplying its own budget would
still pass. The guard would be testing nothing.

---

## Item 2 — `sdd_for_sdd.sdd` LIVE must NOT be used in tests

### Decision

The live, work-in-progress document at `docs/sdd_app_planning/sdd_for_sdd.sdd` must not
be read by tests. It is an evolving asset; coupling tests to it makes their pass/fail
state change whenever the document is edited, independent of any code change.

### Current violations (all read the live file)

| Test file | How it resolves |
| --- | --- |
| `tests/routingHardeningScenario.spec.ts:13` | `const exact = "docs/sdd_app_planning/sdd_for_sdd.sdd"` |
| `tests/routingHardeningOutcome.spec.ts:12` | same pattern |
| `tests/routingHardeningService.spec.ts:13` | same pattern |
| `tests/stagedServiceBlueprint.spec.ts:368` | `loadDocumentationInput("sdd_app_planning/sdd_for_sdd.sdd")` → `path.join(repoRoot, "docs", ...)` |
| `tests/stagedSpacingRegression.spec.ts:21` | `readFile(path.join(repoRoot, "docs/sdd_app_planning/sdd_for_sdd.sdd"))` |

No fixture copy of this document exists. Sibling variants
(`sdd_for_sdd_simplifiedA.sdd`, `sdd_for_sdd_simplifiedB.sdd`,
`sdd_for_sdd_rendering_issues.sdd`) exist but are referenced by no test.

### The authority conflict that must be resolved first

`docs/routing_hardening/routing_hardening_implementation_plan.md` §8.1 **mandates** the
live document as required coverage:

> | Exact production input | `docs/sdd_app_planning/sdd_for_sdd.sdd` in Outcome,
> Service, and Scenario; each with `compact` and `detailed`, crossed with `none`,
> `type`, `id`, and `type,id` decorators. |

Stage 0 adds: *"Preserve exact production reproduction separately; do not trim its
source to make it pass."*

So the plan requires testing against the live file while this decision forbids it.
**This conflict is why a prior decoupling instruction was never carried out.** The
instruction was given three times and no commit ever removed the reference:

| Session | When | Instruction |
| --- | --- | --- |
| `f58cb568` | 2026-09-16 20:46 | "do preserve the current @file:sdd_for_sdd.sdd as it is an evolving, not-stable file" |
| `cb3a2389` | 2026-09-17 05:23 | "cannot be considered a stable asset. Other tests in the past had to be refactored after this file evolved." |
| `c1dd41bf` | 2026-09-17 21:03 | "Make sure that tests don't permanently rely on the current version of @file:sdd_for_sdd.sdd" |

`git log -S` on the live-document reference across all branches returns exactly one
commit — `d46f92b`, which **added** it. None removed it. The session receiving the
strongest instruction produced commit `ae2e943`, which touched only `tests/cli.spec.ts`.

Per `AGENTS.md`: *"If the authority hierarchy is unclear, stop and resolve it before
coding."* That did not happen. **Resolve the plan conflict before editing the tests**,
or the same thing will happen again.

### Proposed resolution

The plan already anticipates the answer — Stage 0 asks for *"a reduced geometry fixture
with neutral IDs"* **alongside** exact production reproduction. The fixture half already
exists (`tests/fixtures/render/*`, `bundle/v0.1/examples/scenario_branching.sdd`).

So:

1. **Amend §8.1** of the implementation plan: exact-production coverage becomes
   *informational*, not a hard gate. Record the amendment so the authority is explicit.
2. **Freeze a fixture** — copy the current document to `tests/fixtures/` and point the
   five test files at it. Gates become hermetic; only code changes turn them red.
3. **Keep one informational check** against the live document that is permitted to be
   red, preserving the "real document must render" signal without letting it block.

This satisfies both the plan and the decision, and makes "document drifted"
distinguishable from "renderer regressed" — which is currently impossible.

### Secondary defect found while investigating

The three `routingHardening*` files use a bare relative path
(`readFile("docs/...")`), resolving against `process.cwd()`, while the other two anchor
to `repoRoot` explicitly. The relative ones silently depend on vitest running from the
repo root. Worth normalizing during the same work.

---

## Item 3 — Expansion starvation (pursue after Items 1 and 2)

See `routing_fragility_assessment.md`, section "The concrete lead: expansion
starvation".

**Hypothesis:** in `scenarioFlowRouting.ts`, the preparation phase and final routing
share one ceiling (`MAX_FINAL_ROUTING_ATTEMPTS = 8`). If preparation consumes all 8,
final routing gets `maxExpansionPasses: 0` (line 3819) and its expand callback returns
`undefined` immediately (line 3826). Expansion becomes structurally dead.

This matches the observed `expansionPasses: 0` on every failure.

**Status: VERIFIED — CONFIRMED (2026-09-18).** See "Item 3 verification record" below.

### Correction to the mechanism as originally described

The hypothesis named line 3826 as the point where expansion dies. It does not. With
`maxExpansionPasses: 0`, the shared lifecycle gate in `routingCore/lifecycle.ts` —
the guard `if (!options.expand || trace.expansionPasses >= policy.maxExpansionPasses || ...)
break;` immediately preceding the `options.expand(copyForExpansion(...))` call — evaluates
`0 >= 0` → true and `break`s **before** the adapter's callback is ever invoked. The
callback is never called at all — measured `expandInvocations: 0`.

Both paths yield `expansionPasses: 0`, but the distinction matters for any fix: patching
line 3826 alone would not restore expansion, because control never reaches it.

(Line numbers in `lifecycle.ts` drift: this gate is at L258-259 at HEAD and L273-274 in the
working tree described below. Cite it by its condition, not its line.)

A second correction: the budget can never go negative. The preparation loop is bounded at
8 iterations with at most one increment each, so `preparationExpansionPasses ∈ [0,8]` and
`maxExpansionPasses ∈ [0,8]`. `validateFinalRouteSet` rejects only `< 0`, so starvation
surfaces as budget-0, never as `invalid_context`.

---

## Status of the hang fix (already landed)

Commit `1c75171` — "Bound the shared routing solver search so dense scenes cannot hang".

- `routingCore/occupancy.ts`: `OCCUPANCY_SOLVER_SEARCH_STATES = 250` +
  `searchOrder: "most_constrained"` at the single chokepoint.
- `routingCore/solver.ts`: `DEFAULT_SOLVER_SEARCH_STATES = 2_000` replaces the 100,000
  default.
- Two synthetic regression tests (no `.sdd` fixture dependency).

Verified budget-independent: 250 and 2000 produce identical results; 20000 restores the
hang. A candidate-enumeration cap was tried and **reverted** — nearest-K truncation
removed the far-out coordinates needed to pack competing tracks, turning resolvable
components into `needs_alternate_candidate`.

This fix also unhangs `tests/routingHardeningScenario.spec.ts`, which previously
produced zero results in 30 minutes. That file now completes and reports the
pre-existing `scenario_flow` routing defect on `sdd_for_sdd.sdd` that the hang had been
masking. That geometry defect is separate and unaddressed — it is what Item 3 targets.

---

## Implementation record (2026-09-18)

### Item 1 — done (Option A)

Wall-clock assertions removed from both tests; replaced with deterministic constant
assertions.

- `tests/routingCore.spec.ts`: `Date.now()` check dropped from the dense-component test.
  The former `exposes a bounded solver search default` test became
  `keeps the solver search budget bounded`, asserting
  `DEFAULT_SOLVER_SEARCH_STATES <= 2_000` (was `< 100_000`).
- `tests/routingHardeningAssignment.spec.ts`: `Date.now()` check dropped; new test
  `keeps the occupancy solver search budget bounded` asserts
  `OCCUPANCY_SOLVER_SEARCH_STATES <= 250`.

Correctness assertions retained in both dense-component tests (`status === "resolved"`,
pairwise separation, determinism under input reversal). Option B (exposing `visited`)
was rejected as an unnecessary public-contract change.

### Item 2 — done

**Fixture frozen:** `tests/fixtures/render/sdd_for_sdd_frozen.sdd`, a byte-identical copy
of the live document taken 2026-09-18
(sha256 `c43579920b85102b129067b88a022ec27397b829a1b59999acf2763590c242d8`).

**Five test files repointed** to the fixture:

| File | Change |
| --- | --- |
| `tests/routingHardeningScenario.spec.ts` | `exact` → fixture path |
| `tests/routingHardeningOutcome.spec.ts` | `exact` → fixture path |
| `tests/routingHardeningService.spec.ts` | `exact` → fixture path |
| `tests/stagedSpacingRegression.spec.ts` | `readFile(repoRoot + fixture)` |
| `tests/stagedServiceBlueprint.spec.ts` | `loadDocumentationInput` replaced by `loadFixtureInput` (anchors to `tests/fixtures/render`) |

The `loadDocumentationInput` helper was removed rather than left unused. This also
eliminates the bare-relative-path defect noted above: all five now anchor to `repoRoot`.

**Plan amended:** `routing_hardening_implementation_plan.md` §8.1 "Exact production
input" now names the frozen fixture, with an amendment note recording the authority
resolution and the fixture hash. §8.2 verification commands repointed to the fixture.
§3.1 left as a historical record of the original defect report.

**Informational live-document check: NOT added**, per maintainer decision — the live
document will change and its containing folder will disappear, so nothing may reference
it. Verified: zero references to `docs/sdd_app_planning/sdd_for_sdd.sdd` remain in
`tests/`.

### Verification

- `pnpm run build`: passes.
- All 33 hardening-gate test names now reference the frozen fixture; zero live-document
  references.
- `routingHardeningService.spec.ts`: **19/19 pass** (was 1 failing on the clean tree).
- `routingHardeningOutcome.spec.ts`: 1 failing (`detailed / type,id`) — same test failed
  on the clean baseline.
- `routingHardeningScenario.spec.ts`: 8 failing on the frozen fixture — the
  `scenario_flow` geometry defect. On the clean tree this file **hung** and produced zero
  results, so these were masked, not absent.
- `stagedSpacingRegression.spec.ts`: 2 failing with `Test timed out in 5000ms` —
  identical reason on the clean baseline.

### Remaining red is the Item 3 target

The 8 `routingHardeningScenario` failures and the 2 `stagedSpacingRegression` timeouts
are the `scenario_flow` routing/geometry defect on this document, now hermetically
reproducible from the frozen fixture. They are not caused by Items 1 or 2.

---

## Item 3 verification record (2026-09-18)

### Method

`expansionPasses: 0` has four candidate causes, not one. A probe was written to separate
them rather than assuming the hypothesis:

| | Cause | Distinguishing signature |
| --- | --- | --- |
| (a) | budget starvation — preparation consumed the whole shared ceiling | `preparationPasses === 8`, callback never invoked |
| (b) | deficit-model gap — budget available, but the adapter's expand callback found no measured deficit and returned `undefined` | `preparationPasses < 8`, callback invoked, returned `undefined` |
| (c) | repair/candidate budgets exhausted before the expansion gate was reached | `candidate_exhausted` / `repair_exhausted` |
| (d) | no-op expansion — callback returned a context the lifecycle rejected as non-growing or canonical-identical | callback invoked and returned a context, yet no pass credited |

No production change was required. `preparationExpansionPasses` is not exported, but it is
exactly recoverable from the context the adapter hands to the shared lifecycle, because
`scenarioFlowRouting.ts` L3819 builds that policy as
`maxExpansionPasses: MAX_FINAL_ROUTING_ATTEMPTS - preparationExpansionPasses`:

```
preparationExpansionPasses = MAX_FINAL_ROUTING_ATTEMPTS - initial.policy.maxExpansionPasses
```

Probe: `tests/routingExpansionStarvationProbe.spec.ts` (temporary; delete or convert once
Item 3 is resolved). It wraps the adapter's `expand` callback to count invocations and
`undefined` returns, which is what separates (a)/(c) from (b)/(d). It asserts only that the
lifecycle ran, so it cannot go red on the geometry defect it investigates.

Input: the frozen fixture `tests/fixtures/render/sdd_for_sdd_frozen.sdd`, one combination
only (`detailed` / `type,id`) — the failing cell. The full 8-way matrix was deliberately
not run: one render costs ~12s and the matrix adds no discriminating information for the
starvation question.

Command: `TMPDIR=/tmp pnpm vitest run tests/routingExpansionStarvationProbe.spec.ts`

Working-tree state at measurement time: the tree carried an **uncommitted** change to
`routingCore/lifecycle.ts` from a separate thread — a memoization of `buildRoutingSegments`
inside `score()`, addressing the 2.37M-call non-linearity. It was verified not to confound
this measurement: its diff hunks are confined to the import line and `score()`, the
expansion gate is untouched, and memoizing a pure function changes call count only, never
values, so lifecycle decisions are identical with or without it. It does explain the
observed ~12s render versus the ~33s previously recorded for this fixture.

### Measured result

| Field | Value |
| --- | --- |
| `lifecycleCalls` | 1 |
| `preparationPasses` | **8** |
| `finalBudget` (`maxExpansionPasses`) | **0** |
| `status` | `failed` |
| `reason` | `expansion_exhausted` |
| `expansionPasses` | 0 |
| `expandInvocations` | **0** |
| `expandReturnedCtx` | 0 |
| `validations` | 2306 |
| `candidates` | 2306 (of 4096) |
| `repairRevisions` | **1** (of 128) |
| `repeatedStates` | 7 |

Violation kinds: `collinear_overlap`, `endpoint_intrusion`, `track_separation`.
Emitted routing errors additionally include `scenario_flow_node_intersection`.

### Verdict: (a) budget starvation CONFIRMED

Preparation consumed all 8 passes; final routing received a budget of 0; the lifecycle
gate broke before the expand callback was ever invoked. Expansion was structurally dead,
exactly as hypothesized.

Causes (b), (c) and (d) are **excluded by evidence**, not merely unobserved:

- (b) and (d) require the callback to have been invoked. `expandInvocations: 0`.
- (c) requires a budget to have been exhausted. `repairRevisions` was 1 of 128 and
  `candidates` 2306 of 4096 — both far from their caps. The repair search had ample
  budget remaining when the expansion gate terminated it.

### Secondary observation — CLOSED as by-design, not a defect

`repairRevisions: 1` with `repeatedStates: 7` and 2306 candidates generated. The inner
repair loop performed a single revision and then drained. The mechanism is the
queue-admission filter in `routingCore/lifecycle.ts`: a candidate state is only queued if
all its violations are `track_separation`, `collinear_overlap`, or
`perpendicular_crossing`. This document's violation set includes `endpoint_intrusion`,
which is not queueable, so states carrying it are dropped and the queue empties after one
revision.

On review this is **deliberate**, not a defect. The filter carries the comment
*"Irreversible endpoint/resource violations cannot be fixed by unrelated later turn
changes."* Turn alternatives genuinely cannot repair an `endpoint_intrusion`, because the
endpoint is declared by the adapter's port geometry and is not movable by a turn change.
Draining the queue is the design working correctly rather than wasting search on
candidates that cannot help.

The consequence is worth recording, though: this document's violation profile
(`endpoint_intrusion`, `node_intersection`) is **repair-resistant by design**, which makes
expansion the only mechanism that could improve it — and expansion is exactly what
starvation disabled. That strengthens the case that starvation mattered, while Finding 4
above shows that relieving starvation alone still does not help, because the expand
callback cannot derive a deficit either.

No work item arises from this observation.

### Authority constraint on any fix

The shared ceiling is **mandated**, not accidental. Four sources require it:

| Source | Requirement |
| --- | --- |
| `contract_review.md` L71 | "Existing preparation and final-resolution expansion must share one owner and one ceiling, not nest independent loops." |
| `design_decisions.md` L13 | "Requests/application counts are absolute, monotonic and share the existing owner/ceiling: four Outcome/Service, eight Scenario." |
| `routing_hardening_implementation_plan.md` §5.5 L195 | "Preserve the current expansion ceilings: four for Outcome and Service, eight for Scenario" |
| `routing_hardening_implementation_plan.md` L379 | "Coordinate geometric expansion through the existing owner with absolute state and the preserved eight-pass ceiling. Avoid nesting two independent expansion loops that multiply attempts" |

It is also encoded executably in `tests/routingHardeningScenario.spec.ts` L81
(`prep + expansionPasses <= 8`), `tests/routingHardeningService.spec.ts` L81, and
`tests/routingHardeningOutcomeExpansion.spec.ts` L51-52, and in the test name "uses one
production expansion owner". `stage4_review.md` L29 records this as a review blocker that
was corrected: "Do not add another independent four-pass loop."

Note that `journey_map` is **not** a counter-example. Its exported
`MAX_JOURNEY_MAP_EXPANSION_ATTEMPTS` is a separate ceiling, but `journeyMapRouting.ts`
L5925 calls `solveRoutingClaims` directly and never `runRoutingLifecycle`;
`design_decisions.md` L5 and plan §5.5 explicitly carve it out as an assignment-only API
that "retains its existing bounds".

**Resolution chosen: partition the single ceiling.** Bound preparation to a sub-budget so
final routing always retains a floor, keeping the total at or below 8. This satisfies all
four cited sources — one owner, one ceiling, no attempt multiplication — while removing
the starvation. Genuinely separate ceilings would require amending the contract and the
three encoding tests, and were rejected for that reason.

Also relevant: `design_decisions.md` L25 states the ceilings "bound recomputation passes,
not the size of a measured capacity increment, and do not assert completeness for arbitrary
diagrams." Starvation followed by honest failure is therefore inside the documented
contract. The defect is that it is **silent** — no diagnostic distinguishes "preparation
consumed the budget" from any other failure. Making that degradation visible is required
by the "route well when possible, degrade visibly when not" contract in
`routing_fragility_assessment.md`, independent of whether the partition fix lands.

### Step 1 follow-up: preparation convergence (2026-09-18)

The verification above established that preparation consumed all 8 passes. It left open
whether preparation **converged** at 8 or was **cut off** at 8 — the two have very
different implications for any fix. This was measured with temporary env-gated
instrumentation in the preparation loop (`SDD_SCENARIO_PREP_PROBE`,
`SDD_SCENARIO_PREP_CEILING`), since reverted; `git diff` confirms zero remnants.

The instrumentation was verified inert when the env var is unset: the probe reproduced the
original measurement byte-identically (`preparationPasses 8`, `finalBudget 0`,
`expandInvocations 0`, `candidates 2306`, `repairRevisions 1`, `repeatedStates 7`).

**Finding 1 — preparation was cut off, not converged.** At the production ceiling of 8 it
exits `ceiling_exhausted`, never reaching the convergence `break`.

**Finding 2 — preparation never converges.** Raised to a ceiling of 24, it still exits
`ceiling_exhausted` after 24 passes. Demand reaches a steady state at attempt 2 and stays
there while the gutter grows without bound:

| Attempt | columnTotal | laneTotal | gutterColumns | gutterLanes |
| --- | --- | --- | --- | --- |
| 0 | 80 | 48 | 0 | 0 |
| 1 | 48 | 48 | 80 | 48 |
| 2 | 16 | 48 | 128 | 96 |
| 3 | 16 | 48 | 144 | 144 |
| 7 | 16 | 48 | 208 | 336 |
| 12 | 16 | 32 | 288 | 576 |
| 14 | 0 | 32 | 320 | 656 |
| 23 | 0 | 32 | 320 | 944 |

Growing the canvas does **not** reduce the demand. This is a non-convergent loop, not a
slow-converging one.

**Finding 3 — the steady-state demand is a single source.** At attempt 14 the entire
residual demand is `preparedLanes: 32` (from `nominalPrepared.requiredLaneExpansions`);
every other source is 0. A constant 32px lane demand that gutter growth cannot satisfy.

**Finding 4 — the ceiling partition does NOT fix the geometry.** Bounding preparation
below 8 *is* the partition proposed in Decision 2, so it was measured directly:

| Prep ceiling | Final budget | expandInvocations | returnedContext | expansionPasses | reason |
| --- | --- | --- | --- | --- | --- |
| 8 (production) | 0 | 0 | – | 0 | `expansion_exhausted` |
| 7 | 1 | 1 | **false** | 0 | `repeated_state` |
| 6 | 2 | 1 | **false** | 0 | `repeated_state` |
| 4 | 4 | 1 | **false** | 0 | `repeated_state` |

The partition does restore the callback — `expandInvocations` goes from 0 to 1, so
starvation is genuinely relieved. But the callback returns `undefined`
(`returnedContext: false`) despite being handed 21 violations, so no expansion pass is
credited and the result still fails.

**This converts cause (a) into cause (b).** Starvation was real, but it was masking a
second, independent defect: the adapter's expand callback cannot derive a measured deficit
for this document's violations. Its deficit model only considers source/target side plus
cell-order relationships, while the actual violations are `collinear_overlap`,
`endpoint_intrusion`, `track_separation`, and `node_intersection`.

### Stop condition reached

Per `AGENTS.md`: *"stop and surface the problem instead of coding through it when the
current strategy is producing structurally wrong output and further tuning is speculative."*

The partition fix (Decision 2) is **not** the remedy. It would relieve starvation, change
the failure reason from `expansion_exhausted` to `repeated_state`, and leave the diagram
exactly as broken — while touching contract-adjacent code and three tests that encode the
shared ceiling. Implementing it now would be speculative tuning against a defect whose
real cause lies elsewhere.

Two defects are now distinguished, and they need separate treatment:

1. **Non-convergent preparation** — a constant 32px lane demand that gutter growth cannot
   satisfy. Preparation burns its entire budget chasing an unsatisfiable requirement.
2. **Deficit-model gap in the expand callback** — even with budget available, the callback
   finds no measured deficit for these violation kinds and returns `undefined`.

Defect 1 is the reason preparation consumes the budget; defect 2 is the reason relieving
that consumption does not help. Both must be addressed for expansion to actually improve
this document.

### Follow-ups (revised)

Still valid and unaffected:

1. Export `MAX_FINAL_ROUTING_ATTEMPTS` from `scenarioFlowRouting.ts` and repoint the
   hardcoded `8` in `tests/routingHardeningScenario.spec.ts` L81 and in the probe.
2. Emit a `warn`-severity routing diagnostic when the final budget is reduced to 0, with a
   JSON `details` payload. It must be `warn`, not `error`:
   `src/renderer/previewWorkflow.ts` L267 suppresses the artifact when
   `hasErrors(diagnostics) && !force`, so an error-severity diagnostic would change
   artifact behavior. This is required by the degrade-visibly contract regardless of
   whether any geometry fix lands, and it is the one item that ships value on its own.
3. Expose `preparationExpansionPasses` on `ScenarioFlowRoutingStages`, following the
   existing `finalResolutionTrace` precedent. It already flows out through
   `renderScenarioFlowStagedSvg` → `routingStages`, which tests already read.

**Deferred pending the two defects above:**

4. ~~Partition the ceiling so preparation cannot starve final routing.~~ Measured to be
   ineffective on its own. Revisit only after defect 2 is addressed, at which point
   relieving starvation may become worthwhile.

**New items:**

5. Investigate the non-convergent `preparedLanes: 32` demand — why does
   `requiredLaneExpansions` keep requesting 32px that gutter growth cannot satisfy?
6. Investigate the expand callback's deficit model — why does it derive no deficit from
   `collinear_overlap` / `endpoint_intrusion` / `track_separation` / `node_intersection`?

Scope note: the identical pattern exists in `serviceBlueprintRouting.ts`
(L3958/4001/4122/4129, ceiling 4) and `outcomeOpportunityMapRouting.ts` (L5055/5109,
ceiling 4). Neither is starved today — both pass their expansion gates with
`expansionPasses > 0`. Deferred per the proof-case-first rule in `AGENTS.md`.

---

## Item 4 — the eight gates were not blocked by starvation (2026-09-18)

Full record: `invalid_valley_2026-09-18.md`.

Item 3 established that expansion was structurally dead. It left open whether that was
*why* the eight `routingHardeningScenario` gates fail. It is not.

A third defect was found, in the shared routing core rather than in any adapter: the
repair loop can only perturb one existing segment coordinate at a time
(`buildTerminalTurnAlternatives`), and its queueing rule refuses any state carrying a
violation outside the traversable set. When the emitted route is already structurally
wrong, no single move reaches a correct shape and every intermediate is refused, so the
**repair frontier dies at depth one**. Measured: 2312 one-move alternatives, zero
queueable, identically in all eight cells. Raising `maxCandidates` or
`maxRepairRevisions` cannot help — the frontier is empty, not exhausted.

This is why the partition fix (follow-up 4) could not work: it relieves starvation, but
starvation was never the operative blocker for these gates. Corroborating evidence — the
six gates that now pass do so with `expansionPasses: 0`, i.e. **without** expansion.

**Fix 1 (corridor recovery) is implemented** in `routingCore/geometry.ts`,
`routingCore/candidates.ts`, and `routingCore/lifecycle.ts`. It seeds the repair search
with routes constructed from the two declared ports, rebuilding all implicated connectors
together. Result: `routingHardeningScenario.spec.ts` goes from 11/19 to **17/19**. The two
remaining failures are the `none` cells, which are now hard-clean but exhaust
`maxCandidates: 4096` while still improving — a budget limit, not a structural one.

`routingHardeningOutcome.spec.ts` `detailed / type,id` still fails and is **pre-existing**:
verified by stashing the three changed files and re-running, it fails identically on the
clean tree.

Items 5 and 6 above remain open and independent. Fix 1 touches neither.
