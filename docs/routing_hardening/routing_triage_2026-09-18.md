# Routing Triage — 2026-09-18

Three items, in the order they should be worked.

Companion document: `routing_fragility_assessment.md` (the broader assessment this
triage came out of).

**Status: Items 1 and 2 IMPLEMENTED (2026-09-18). Item 3 deferred to a later session.**
See "Implementation record" at the end of this document.

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

**Status: NOT VERIFIED.** First step is to instrument `preparationExpansionPasses` and
confirm whether preparation is in fact exhausting the shared budget.

Deferred until Items 1 and 2 are done.

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
