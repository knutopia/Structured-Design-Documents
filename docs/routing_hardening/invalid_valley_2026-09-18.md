# Repair Search Cannot Cross an Invalid Valley — 2026-09-18

## Summary

The eight failing `scenario_flow` hardening gates on the frozen production fixture were
not caused by insufficient spacing, and not by expansion starvation. They were caused by
a **search-capability gap** in the shared routing core: the repair loop can only perturb
one existing segment coordinate at a time, so when the emitted route is already
structurally wrong it has no move that reaches a correct shape, and its queueing rule
refuses every intermediate state. The repair frontier dies at depth one.

This is a distinct defect from the expansion starvation recorded in
`routing_triage_2026-09-18.md`. Both are present on this fixture. Starvation is real but
is not what makes these gates fail: even with expansion budget available, the repair loop
cannot move.

**Fix 1 (corridor recovery) is implemented.** Six of the eight gates now pass; the two
remaining are budget-limited, not structurally blocked.

The first implementation caused **two real regressions** in existing acceptance-contract
tests, both found by running the full suite rather than only the target gates. Both were
genuine semantic violations and both are fixed; see "Two regressions the first
implementation caused". A permanent synthetic regression gate now pins the behaviour.

---

## The proof case

Connector `VS-006__transitions_to__VS-004` on
`tests/fixtures/render/sdd_for_sdd_frozen.sdd`, cell `compact` / `type,id`.

Both ports face the same 61px channel — between VS-006's east edge (x=1249) and the
VS-060/VS-004 column's west edge (x=1310). Source port `(1250, 1200)` on VS-006's
**east** edge; target port `(1310, 1266)` on VS-004's **west** edge. They are 66px apart
vertically, so the natural route is right–down–right and never leaves the channel.

Emitted route (8 points), which cuts through VS-004's body:

```
1250,1200 → 1292,1200 → 1292,1238 → 1552,1238
→ 1552,1200 → 1554,1200 → 1554,1266 → 1310,1266
```

The horizontal run at y=1238 is exactly VS-060's bottom (1220) plus the 18px obstacle
clearance. It satisfies VS-060 and violates VS-004, which spans y 1230–1302. That single
segment is the whole contradiction.

Channel route (4 points):

```
1250,1200 → 1292,1200 → 1292,1266 → 1310,1266
```

Measured against the real captured context (23 connectors, 23 boxes, 3 blockers, the
adapter's own policy) with `validateFinalRouteSet`:

| | violations implicating this connector | whole-scene total |
|---|---|---|
| emitted (8pt) | 5 | 25 |
| channel (4pt) | **0** | **20** |

The channel route removes four `endpoint_intrusion` and one `collinear_overlap` and adds
nothing. Its 18px terminal leg satisfies the target's `minLeg: 12`. It is not merely
locally clean — it improves the scene.

---

## Why the router did not choose it

Two mechanisms combine.

**1. The generator cannot change topology.** `buildTerminalTurnAlternatives`
(`routingCore/candidates.ts`) rewrites ONE existing segment's coordinate per yield. It
skips index 0 and the final segment (terminal legs) and only touches runs implicated by a
violation. It never inserts or deletes points except via `collapseRoutePoints`. Going
8pt → 4pt requires four points to collapse away, which means several segments aligned
simultaneously. No single move can do it.

**2. The queueing rule refuses every intermediate.** `routingCore/lifecycle.ts` declines
to queue any state carrying a violation outside the traversable set:

```ts
if (violations.some(v => v.kind !== "track_separation" && v.kind !== "collinear_overlap" && v.kind !== "perpendicular_crossing")) continue;
```

A bounded BFS replicating the lifecycle exactly (canonical dedupe over all connectors,
the prune rule above) measured:

```
depth 1 → 2312 alternatives generated
          2305 hard-pruned
          queuedSoftOnly: 0        ← the decisive number
          proposedFoundAtDepth: -1
frontier died at depth 1
```

`queuedSoftOnly: 0` means **every** one-move alternative carried a hard violation, so none
was queueable. The only 4-point route reachable in one move was
`1250,1200 → 1554,1200 → 1554,1266 → 1310,1266` — the far-right detour collapsed — itself
hard-invalid (`endpoint_intrusion`, `node_intersection`).

The clean route is two moves away, but the search is a single-move hill-climb that refuses
to step through invalid intermediates. It never explores the path.

**Consequence:** raising `maxCandidates` or `maxRepairRevisions` cannot help. The frontier
is *empty*, not exhausted.

---

## Census across all eight failing gates

The eight failing `routingHardeningScenario` gates are the frozen fixture crossed with
{`compact`, `detailed`} × {`none`, `type`, `id`, `type,id`}.

The signature is **completely uniform** — this is the dominant failure mode, not a one-off:

| cell | scene violations | failing connectors | one-move alternatives | queueable | classification |
|---|---|---|---|---|---|
| all 8 | 25 (27 for `none`) | 4 | 2312 (2418 for `none`) | **0** | `invalid_valley` ×4 |

Same four connectors in every cell: `VS-004→VS-006`, `VS-006→VS-004`, `VS-006→VS-010`,
`VS-006→VS-050`. 32 of 32 records classified `invalid_valley`; zero `one_move_reachable`;
zero `no_valid_route_found`.

`queueableOneMoveAlternatives: 0` in all eight cells — the repair frontier is empty
scene-wide, not just for the one edge.

`lockedRuns: 0` everywhere. No run constraints or shared track groups suppress
`collapseRoutePoints`, so the blocker is purely that one move cannot align four points.

Hard kind is `endpoint_intrusion` throughout, plus `terminal_leg_too_short` on
`VS-004→VS-006` in the two `none` cells.

### The routes compose, and the lifecycle then finishes unaided

A constructive port-to-port corridor generator (written in the probe, not in production at
that point) found a zero-hard-violation route for each of the four connectors.
Substituting all four simultaneously:

- Scene total **25 → 6** (27 → 8 for `none`), with **no hard kinds remaining** in all
  eight cells. Residuals are only traversable: `collinear_overlap` 1–2,
  `track_separation` 5–6.
- Running the real `runRoutingLifecycle` from that hard-clean context: **six of eight
  cells return `resolved` with zero violations** — `repairRevisions: 3`,
  `expansionPasses: 0`. No expansion needed at all.
- The two `none` cells return `failed / candidate_exhausted` with three traversable
  residuals: `candidates: 4096` (the cap), `repairRevisions: 3/128`,
  `repeatedStates: 103`. They were still improving when the budget ran out.

So the entire eight-gate failure traces to one search-capability gap. Given hard-clean
seed geometry, the existing repair loop finishes the job by itself.

---

## Fix 1 — corridor recovery (implemented)

### What changed

Three files in the shared routing core. No view-specific code was touched.

**`routingCore/geometry.ts`** — added `departsOutwardFromPort(side, from, to, epsilon)`.
This is now the single definition of port outwardness. `validateFinalRouteSet`'s local
`outward()` delegates to it, so acceptance and candidate construction cannot drift: a
proposed route can no longer be rejected for a reason its builder believed it had
satisfied.

**`routingCore/candidates.ts`** — added `buildPortCorridorCandidates(connector, context)`.
It supplies the capability the turn generator lacks by constructing routes from the two
**declared ports** rather than perturbing the emitted route. Both stubs step outward along
the declared side, so port outwardness and `minLeg` hold by construction for any middle
geometry.

Candidate shapes, ordered by increasing bend count so the simplest viable corridor is
proposed first: straight stub-to-stub, the two one-corner L shapes, then two-corner Z
shapes with a free middle run.

Middle-run coordinates come from the same event sources the turn generator uses — box
edges, other routes' points, and this route's own points — each with a ±`minSeparation`
variant. The last source matters most: the natural channel is frequently a coordinate the
emitted route already touches.

Determinism is preserved: events are collected into sets, then sorted by distance from the
coordinate the emitted route already used for its first internal run on the relevant axis,
with a numeric tiebreak. The same context always yields the same sequence.

Two guards:

- **`straight` routes are not eligible.** A `straight` route's geometry *is* its contract:
  the adapter asked for a direct line between two ports. Rebuilding it as a multi-bend
  corridor is not repair, it is substitution of a different rendering intent. Only
  `orthogonal` routes grant the router latitude over their shape. (This guard was added
  after it caused a real regression — see below.)
- Connectors owning `runConstraints` or `sharedTrackGroupBySegmentIndex` are **not
  eligible**. A fresh topology re-derives logical run IDs from the route, so ownership
  keyed to the previous topology would go stale, and acceptance reports that as
  `endpoint_mismatch`, which terminates the lifecycle outright. This mirrors the ownership
  guard the turn generator already applies before accepting a collapsed point count.
- `MAX_CORRIDOR_CANDIDATES_PER_CONNECTOR = 256`, split evenly across both axes. Coordinate
  events scale with scene density, so an uncapped enumeration would make recovery cost
  unbounded and order-dependent. Minimal-change-first ordering means the cap drops the
  least plausible candidates.

**`routingCore/lifecycle.ts`** — added `buildCorridorRecovery(context, violations)`, called
once per outer iteration to seed the repair queue, immediately after the seed state is
registered and before the turn-alternative loop.

It rebuilds **all** connectors implicated in blocking violations together. That grouping
is what makes it work: replacing one at a time leaves the others' blocking violations in
place, so no intermediate state would be queueable either. Applied as a group, the result
carries only traversable kinds and the existing repair loop finishes unaided.

Cost control: `validateFinalRouteSet` is quadratic in connector count, so running it on
every corridor candidate would dominate recovery. `SINGLE_EDGE_HARD_KINDS`
(`non_orthogonal_segment`, `endpoint_intrusion`, `node_intersection`,
`terminal_leg_too_short`) are provable from one edge plus the obstacle boxes alone and
never depend on other connectors, so a single-edge `validateRouting` check is an exact
necessary condition for them. The quadratic check is paid once, on the combined result.
Endpoint-box re-entry is checked separately, exactly as acceptance does.

The recovered state passes through the **same** queueing rule as every other candidate.
Recovery normally clears the blocking kinds outright, but it is not assumed to.

Recovery is also a **search step**, so it requires and consumes candidate budget exactly
like every other step (`trace.candidates < maxCandidates` before attempting it, and
`trace.candidates++` when it validates a result). Without that guard a caller setting
`maxCandidates: 1` to mean "accept the input as-is, do not search" would still get a
rebuilt route set. (Also added after a real regression — see below.)

The traversable-kind set was extracted to `TRAVERSABLE_VIOLATION_KINDS` and the inline
predicate to `hasBlockingViolation(...)`, so the queueing rule and the recovery trigger
share one definition.

### Two regressions the first implementation caused, and their fixes

The first version of this change passed the eight target gates but broke two existing
contract tests in `routingHardeningAcceptance.spec.ts`. Both were genuine semantic
violations, not test brittleness, and both were found by running the full suite rather
than only the target gates.

**1. It accepted a diagonal `straight` route that must be rejected.**

`accepts axis-aligned straight routes and still rejects diagonal straight geometry`
declares a `straight` route, displaces the target so the line becomes diagonal, and asserts
the lifecycle returns `failed`. Corridor recovery rebuilt it into an orthogonal corridor
and returned `resolved`.

The test was right and the fix was wrong. A `straight` route's geometry is the adapter's
stated intent; substituting a multi-bend path silently changes what was asked for, and it
would let a diagonal route pass an acceptance contract that exists specifically to reject
it. Fixed by making `straight` routes ineligible for corridor recovery.

**2. It searched when the caller had forbidden searching.**

`checks missing points, independent attachment, declared side, both marker legs, bounds,
and endpoint reentry` passes `maxCandidates: 1` and asserts that seven malformed inputs all
fail. Recovery ran anyway and resolved some of them, because it was placed after the
budget increment without re-checking the budget.

`maxCandidates: 1` means "accept the input as-is, do not search." Recovery is a search
step and must honour that. Fixed by gating recovery on remaining candidate budget and
charging it for the validation it performs.

Both fixes were verified to preserve the target result: `routingHardeningScenario.spec.ts`
remains at 17/19 after them.

**Methodological note.** These regressions were initially masked by a measurement error:
the first full-suite run was started, and then `src/` was stashed and restored *while it
was still running*, so files transformed during that window were compiled without the fix.
That produced three failures of which only some were real. The correct procedure — used
for the final numbers — is to run the suite to completion with `src/` untouched, then
stash and re-run only the specific failing files to establish a baseline. Any full-suite
number obtained while modifying `src/` concurrently should be discarded.

### Permanent regression gate

`tests/routingCorridorRecovery.spec.ts` pins the behaviour synthetically and fast (~2.7s,
no rendering), so the fix does not depend on the ~25s fixture render for protection.

It requires **two** valley instances, not one. This was itself a measured finding: with a
single implicated connector the turn generator *can* repair the route, because one
single-coordinate move suffices and nothing else keeps the state unqueueable. The valley
arises from **grouping** — the generator changes one connector per yield, so while it
repairs one, the other's blocking violations remain and the queueing rule refuses the
state. That is precisely why corridor recovery rebuilds all implicated connectors
together, and the test encodes that reason rather than just the outcome.

The discriminating assertion is a pair: no queueable one-move alternative exists, **yet**
the lifecycle resolves. That combination can only hold via corridor recovery, so the test
cannot be satisfied by the turn generator alone. Verified: all four cases fail with the
three source files stashed, and pass with them restored.

### Verification

`pnpm run build`: passes.

`tests/routingHardeningScenario.spec.ts`: **17 of 19 pass** (was 11 of 19).

| gate | before | after |
|---|---|---|
| frozen fixture / `compact` / `type` | fail | **pass** |
| frozen fixture / `compact` / `id` | fail | **pass** |
| frozen fixture / `compact` / `type,id` | fail | **pass** |
| frozen fixture / `detailed` / `type` | fail | **pass** |
| frozen fixture / `detailed` / `id` | fail | **pass** |
| frozen fixture / `detailed` / `type,id` | fail | **pass** |
| frozen fixture / `compact` / `none` | fail | fail (`candidate_exhausted`) |
| frozen fixture / `detailed` / `none` | fail | fail (`candidate_exhausted`) |
| `scenario_branching.sdd`, all 8 cells | pass | pass |
| irreparable-context rejection | pass | pass |
| marker-capacity expansion owner | pass | pass |
| marker clearance derivation | pass | pass |

The two remaining failures are exactly the two cells the census predicted would hit the
candidate cap. They are budget-limited, not structurally blocked: `candidates: 4096`
against `repairRevisions: 3/128`, with only traversable residuals remaining.

### Full suite

The shared routing core is used by all six views, so the target gates alone are not
sufficient. Full suite, run to completion with `src/` untouched:

```
Test Files  4 failed | 124 passed (128)
     Tests  6 failed | 1395 passed (1401)
```

All six failures are accounted for, and **none is a regression**. Each was baselined by
stashing the three changed files and re-running that file on the clean tree:

| failing test | status | baseline evidence |
|---|---|---|
| `routingHardeningScenario` / `compact` / `none` | expected | census predicted; hard-clean but `candidate_exhausted` |
| `routingHardeningScenario` / `detailed` / `none` | expected | census predicted; hard-clean but `candidate_exhausted` |
| `routingHardeningOutcome` / `detailed` / `type,id` | pre-existing | fails identically on clean tree; already recorded in `routing_triage_2026-09-18.md` |
| `uiContractsB5Replay` / preserves protected source | pre-existing | fails identically on clean tree |
| `stagedSpacingRegression` / trims Scenario Flow (compact) | pre-existing | fails identically on clean tree |
| `stagedSpacingRegression` / trims Scenario Flow (detailed) | pre-existing | fails identically on clean tree |

Note on `stagedSpacingRegression`: `routing_triage_2026-09-18.md` recorded these two as
`Test timed out in 5000ms`. They now fail on a **geometry assertion** instead
(`expected width 1508, height 880`), because Item 1 raised the vitest timeout to 180s, so
they run to completion rather than timing out. The failure mode changed but the failure is
not new — verified by baseline, where the clean tree produces the identical geometry
assertion.

### The starvation probe, re-measured

`tests/routingExpansionStarvationProbe.spec.ts` (committed, retained) now reports
`status: resolved` for `detailed` / `type,id` while every starvation metric is unchanged
(`preparationPasses 8`, `finalBudget 0`, `expandInvocations 0`, `expansionPasses 0`).
Starvation is still fully present and the geometry is correct anyway — the cleanest
available separation of the two defects. Its verdict label `"not starved — expansion ran"`
is misleading in this state, because `classify()` returns it whenever the route set
resolves; expansion did not run. The probe's header records this so the label is not
misread later.

---

## Honest limitations

**Route quality is proved for one connector only.** "Valid" in the census means zero hard
violations implicating that connector. Only `VS-006→VS-004` gets an elegant answer — the
4-point channel route. The other three constructive solutions are long way-arounds
(`VS-006→VS-010` loops out to x=398, y=1602). They are minimal-change *within the
candidate family*, not proven aesthetically optimal. Existence of a valid route is proved
for all four; existence of a *good* route is proved only for `VS-006→VS-004`.

The gates assert validity, not beauty, so they pass — but the rendered output for those
three connectors should be reviewed visually before this is called a quality improvement.

**Scope is one fixture and one view.** The census covers the frozen SDD-app document in
`scenario_flow` only. The mechanism is in the shared core, so it plausibly generalizes,
but that is not measured. `serviceBlueprintRouting.ts` and
`outcomeOpportunityMapRouting.ts` route through the same lifecycle and now inherit corridor
recovery; neither was starved before and neither regressed, but neither was independently
censused for this signature.

**The two `none` cells remain red.** Fix 1 makes them hard-clean but they exhaust
`maxCandidates: 4096` while still improving.

---

## Remaining follow-ups

Ordered by evidence strength.

1. **Raise `maxCandidates` above 4096 for the two `none` cells.** They exhaust the cap
   while still improving, with `repairRevisions` at 3 of 128, so this is a budget limit
   rather than a structural one. Cheapest remaining item. Must be weighed against the
   hang guard in `routingCore/occupancy.ts` (`OCCUPANCY_SOLVER_SEARCH_STATES = 250`) and
   the deterministic-cost guarantees — raising a search budget needs a measured cost
   bound, not just a larger number.

2. **Review the rendered quality of the three way-around routes.** The gates assert
   validity; they do not assert that a route looping out to x=398 is acceptable output.
   If it is not, the corridor candidate ordering needs a quality term, not just a
   minimal-change term.

3. **Emit a `warn` diagnostic when corridor recovery is the reason a route set resolved.**
   Required by the degrade-visibly contract: a route that only became valid because its
   topology was rebuilt from ports is materially different from one the adapter produced
   correctly, and that should be observable. Must be `warn`, not `error` —
   `src/renderer/previewWorkflow.ts` suppresses the artifact when `hasErrors(diagnostics)
   && !force`.

4. **Census the other views for the same signature.** The mechanism is shared. Measuring
   `service_blueprint`, `outcome_opportunity_map`, and `ui_contracts` would establish
   whether corridor recovery is fixing latent failures elsewhere or merely not breaking
   them.

5. **The two open defects from `routing_triage_2026-09-18.md` remain open** and are
   independent of this one: preparation is non-convergent (a constant 32px lane demand
   gutter growth cannot satisfy), and the expand callback has a deficit-model gap. Fix 1
   does not touch either. Note that `expansionPasses: 0` persists in the now-passing
   gates — they resolve without expansion, which is further evidence that starvation was
   not the operative defect here.

### Rejected alternatives

Two broader fixes were considered and **not** taken, because Fix 1 achieved the result
with a narrower change:

- **Let the turn generator propose topology-changing moves.** Broader blast radius; risks
  the deterministic-ordering and candidate-budget guarantees that the turn generator's
  single-coordinate discipline currently provides.
- **Relax the queueing rule so hard-invalid states can be queued as bounded stepping
  stones.** This would let the search traverse the valley directly, but it removes the
  guarantee that the loop never explores states whose violations cannot be undone by
  later turn changes. Higher regression risk across all six views for no measured gain
  over Fix 1.

Both remain available if Fix 1's limitations turn out to matter in practice.

---

## Reproduction

The two probes that produced these measurements were temporary and have been deleted, per
their own header instructions. `tests/routingCorridorRecovery.spec.ts` is the permanent
replacement and encodes the mechanism synthetically.

To reproduce the original measurements:

- The proof case and reachability BFS: spy on `runRoutingLifecycle`, capture the context
  for the call containing `VS-006__transitions_to__VS-004`, substitute the 4-point route,
  and compare `validateFinalRouteSet` totals. Enumerate
  `buildTerminalTurnAlternatives` and count how many alternatives carry only traversable
  kinds.
- The census: for each of the eight cells, classify every connector with a hard violation
  by whether a queueable one-move alternative exists and whether a constructive
  port-to-port corridor route exists. Then substitute all discovered routes at once and
  re-run the lifecycle.

Both require zero production changes and read only
`tests/fixtures/render/sdd_for_sdd_frozen.sdd`. A single `scenario_flow` render of this
fixture costs roughly 15–25s; the full eight-cell census runs about 150–255s.

### Verifying a change to the shared routing core

The shared core is used by all six views, so a change there needs the full suite, not just
the target gates. Two rules learned the hard way:

1. **Run the suite to completion with `src/` untouched.** Stashing or restoring source
   files while vitest is running contaminates the result: files transformed during that
   window compile against whichever version was on disk at that moment. Discard any
   full-suite number obtained that way.
2. **Establish a baseline per failing file, not per suite.** After a clean run, stash the
   change and re-run only the specific failing files. A failure that reproduces on the
   clean tree is pre-existing; one that does not is a regression. On this change that
   distinction separated one pre-existing failure from two real regressions that the
   target gates alone would never have surfaced.
