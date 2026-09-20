# Routing Fragility Assessment

**Date:** 2026-09-18
**Context:** Response to the concern that "all routing is fragile, nothing generalizes,
real-world documents will inevitably break the diagrams — looks like a failed project."

This document records the assessment as given, so the reasoning survives the session.
It is an assessment, not a decision record. Decisions are tracked in
`routing_triage_2026-09-18.md`.

---

## The concern is warranted, but three problems are being conflated

The verdict "failed project" does not match what was measured during the
shared-candidate-explosion investigation. Three distinct problems are collapsed into
one verdict, and they have very different prognoses.

---

## 1. "All routing is fragile"

What was actually observed is the opposite of fragile in one specific sense: the routing
layer is **bounded and honest**.

- It has explicit budgets: `MAX_FINAL_ROUTING_ATTEMPTS = 8`
  (`scenarioFlowRouting.ts:246`), `MAX_GLOBAL_GUTTER_ATTEMPTS = 4`
  (`outcomeOpportunityMapRouting.ts:306`, `serviceBlueprintRouting.ts:47`).
- When it cannot satisfy the geometry it emits `expansion_exhausted` with a full trace
  naming the offending connectors, rather than silently publishing a bad diagram.

That is a mature design. Fragile systems fail silently; this one fails loudly and
identifies which connectors and why.

What is true is that it is **incomplete** for dense inputs. Incomplete is not the same
as fragile.

---

## 2. "Nothing generalizes"

Partly true, and the precise version points at the real problem.

**The shared core generalizes well.** The hang fix was one edit at one chokepoint
(`resolvePhysicalSegmentOccupancy` in `routingCore/occupancy.ts`) and it protected four
renderers simultaneously: `outcome_opportunity_map`, `service_blueprint`,
`scenario_flow`, and `ui_contracts`. `routingCore/` is small and clean.

**This was confirmed a second time on 2026-09-18.** The invalid-valley fix (see
`invalid_valley_2026-09-18.md`) landed as three edits in `routingCore/` — `geometry.ts`,
`candidates.ts`, `lifecycle.ts` — with **zero** changes to any per-view adapter, and took
`routingHardeningScenario.spec.ts` from 11/19 to 17/19. A ~13,000-line adapter layer was
not touched. Two independent fixes, both at the shared layer, both generalizing: the core
is genuinely the leverage point.

**The per-view adapters do not generalize.** Approximate sizes:

| File | Approx. lines |
| --- | --- |
| `scenarioFlowRouting.ts` | ~3,800 |
| `serviceBlueprintRouting.ts` | ~4,100 |
| `outcomeOpportunityMapRouting.ts` | ~5,100 |

That is where all the geometry-specific tuning lives.

So the architecture is a good core wrapped in three enormous adapters. That is a
legitimate critique, but it is a known-shape problem, not evidence of collapse.

---

## 3. "Real documents will inevitably break the diagrams"

**This is true — and it is not a project failure.**

Guaranteed-overlap-free orthogonal connector routing on dense graphs is an unsolved
problem industry-wide. Visio, draw.io, Lucidchart, Graphviz, and ELK all produce
overlapping and node-crossing connectors on dense real-world graphs. ELK was already
tried in this project and abandoned (see `AGENTS.md`, "No More Graphing with Elkjs").

The achievable contract was never "perfect routing for any document." It is
"route well when possible, and degrade *visibly* when not." This codebase already
implements that contract. The expectation is what is misaligned, not the code.

---

## The concrete lead: expansion starvation

**Status: VERIFIED — CONFIRMED (2026-09-18).** Measured evidence and the full decision
table are recorded in `routing_triage_2026-09-18.md`, "Item 3 verification record".

Every observed failure carried `expansionPasses: 0` — the lifecycle **never attempted
to expand**, despite having 8 passes available. Expansion is the one mechanism that
could help a dense document, because it grows the canvas to make room.

In `scenarioFlowRouting.ts`:

```
// line 3819
maxExpansionPasses: MAX_FINAL_ROUTING_ATTEMPTS - preparationExpansionPasses

// line 3826
if (preparationExpansionPasses + pass > MAX_FINAL_ROUTING_ATTEMPTS) return undefined;
```

If the **preparation** phase consumed all 8 passes, final routing receives a budget of
**zero** and its expand callback returns `undefined` on the first call. Expansion would
be structurally dead — which matches `expansionPasses: 0` exactly.

**Hypothesis:** budget starvation. Two phases share one ceiling, and the first can
exhaust it.

### Measured confirmation

A read-only probe (`tests/routingExpansionStarvationProbe.spec.ts`) recovered
`preparationExpansionPasses` without any production change, since it is exactly
`MAX_FINAL_ROUTING_ATTEMPTS - initial.policy.maxExpansionPasses`. On the frozen
production fixture (`detailed` / `type,id`):

- `preparationPasses: 8` — preparation consumed the entire shared ceiling
- `finalBudget: 0` — final routing received zero
- `expandInvocations: 0` — the expand callback was **never invoked**
- `reason: expansion_exhausted`, `expansionPasses: 0`

The hypothesis is confirmed. Three alternative causes of `expansionPasses: 0` were
separated and **excluded by evidence**: a deficit-model gap and a no-op expansion both
require the callback to have been invoked (it was not), and repair/candidate exhaustion
requires a budget to have been hit (`repairRevisions` was 1 of 128, `candidates` 2306 of
4096).

### One correction to the mechanism

Expansion does not die at line 3826 as originally described. With `maxExpansionPasses: 0`,
the shared lifecycle gate in `routingCore/lifecycle.ts` — the guard
`trace.expansionPasses >= policy.maxExpansionPasses` immediately preceding the
`options.expand(...)` call — evaluates `0 >= 0` → true and breaks **before** the adapter's
callback is ever invoked. Control never reaches line 3826. Both paths produce
`expansionPasses: 0`, but a fix aimed only at line 3826 would not restore expansion.

### Constraint on the fix

The shared ceiling is mandated by `contract_review.md` L71, `design_decisions.md` L13, and
implementation plan §5.5/L379, and is encoded executably in three tests. The chosen
resolution was to **partition** the single ceiling — bound preparation to a sub-budget so
final routing retains a floor, total still at or below 8 — rather than to introduce a
second independent ceiling, which the contract forbids.

**Update: the partition was measured and does not fix the geometry.** Bounding preparation
below 8 does relieve starvation (the expand callback goes from never-invoked to invoked),
but the callback then returns `undefined` because it can derive no measured deficit for
this document's violations, so no expansion pass is credited and the result still fails —
the reason merely changes from `expansion_exhausted` to `repeated_state`. Two distinct
defects were identified: preparation is **non-convergent** (a constant 32px lane demand
that gutter growth cannot satisfy, still unmet at a ceiling of 24), and the expand
callback has a **deficit-model gap**. Full measurements are in
`routing_triage_2026-09-18.md`, "Step 1 follow-up".

Note also `design_decisions.md` L25: the ceilings "do not assert completeness for
arbitrary diagrams." Starvation followed by honest failure is inside the documented
contract; the defect is that it is **silent**. Making it visible is required by the
degrade-visibly contract below regardless of whether any geometry fix lands — and it is
now the one follow-up that ships value independently of the two open defects.

---

## Suggested sequence

1. **Verify the expansion-starvation hypothesis.** DONE — confirmed. See above.
2. **Reclassify `sdd_for_sdd.sdd`.** DONE — see `routing_triage_2026-09-18.md` Item 2.
   The live document is no longer referenced by any test; a frozen fixture carries the
   coverage instead.
3. **Decide the contract explicitly.** "Best-effort routing with honest diagnostics" is a
   legitimate, shippable contract that most tools adopt. Chasing "no violations ever"
   is what will grind the project down, because it is not achievable.

Note that step 3 is now partly answered by the verification itself: the starvation case
already fails loudly with `expansion_exhausted` and a full trace, but emits nothing that
distinguishes "preparation consumed the budget" from any other failure. Closing that gap
is the concrete form of "degrade visibly" here.

---

## Correction: starvation was not the operative defect

The section above names expansion starvation as "the concrete lead." That framing was
wrong, and the correction matters for how the remaining work should be prioritized.

Starvation is **real** — preparation does consume the entire shared ceiling, and final
routing does receive a budget of zero. But it is not what made the eight
`routingHardeningScenario` gates fail. A third defect, in the shared routing core, was the
actual blocker: the repair loop can only perturb one existing segment coordinate at a
time, and its queueing rule refuses every state carrying a non-traversable violation. When
the emitted route is already structurally wrong, no single move reaches a correct shape,
so the **repair frontier dies at depth one**. Measured identically in all eight cells:
2312 one-move alternatives, zero queueable.

The decisive evidence is that the six gates which now pass do so with
`expansionPasses: 0` — they resolve **without** expansion. Starvation was never on their
critical path.

### The starvation probe, re-measured after the fix

`tests/routingExpansionStarvationProbe.spec.ts` (committed, retained) measures starvation
directly. Re-running it with corridor recovery in place gives the cleanest possible
separation of the two defects:

| metric | before fix | after fix |
|---|---|---|
| `preparationPasses` | 8 | **8** — unchanged |
| `finalBudget` | 0 | **0** — unchanged |
| `expandInvocations` | 0 | **0** — unchanged |
| `expansionPasses` | 0 | **0** — unchanged |
| `status` | `failed` | **`resolved`** |

Every starvation metric is identical. Only `status` changed. Starvation is still fully
present — preparation still consumes all eight passes, final routing still receives a
budget of zero, the expand callback is still never invoked — and the geometry is now
correct anyway.

One caution on reading that probe's output: its verdict label now prints
`"not starved — expansion ran"`, which is **misleading**. Expansion did not run
(`expansionPasses: 0`). The probe's `classify()` returns that label whenever
`status === "resolved"`, so it conflates "the route set resolved" with "expansion ran."
The cell resolved via corridor recovery. The probe's header now records this explicitly so
the label is not misread later.

This also explains why the ceiling-partition fix could not work. It relieves starvation,
but relieving starvation cannot help a search that has no legal move. Two of the three
defects now identified are independent of each other:

| Defect | Layer | Status |
|---|---|---|
| Repair search cannot cross an invalid valley | `routingCore/` (shared) | **FIXED** — 6 of 8 gates |
| Non-convergent preparation (constant 32px lane demand) | `scenarioFlowRouting.ts` | open |
| Deficit-model gap in the expand callback | `scenarioFlowRouting.ts` | open |

The lesson for triage method: a confirmed hypothesis is not necessarily the *operative*
cause. Starvation was verified, measured, and reproduced — and still was not what broke
the gates. The check that caught this was asking whether a *valid* route existed at all
before asking why the router failed to expand toward one.

---

## Counter-evidence to the "failed project" verdict

The hang fix landed cleanly, generalized across four renderers from a single
shared-layer edit, and turned an unmeasurable hang into honest diagnostics. That is a
session in which the architecture *worked*. A failed project does not do that.

The invalid-valley fix is a second instance, and a stronger one. It was found by
measurement rather than tuning: a probe established that a valid 4-point route existed and
lowered the whole-scene violation count, a census established the signature was uniform
across all eight gates rather than a one-off, and only then was code written. Three edits
in the shared core, no adapter changes, six gates green, no regressions. The remaining two
are budget-limited rather than structurally blocked.

That is the opposite of the "multiple layers of defects, nothing generalizes" picture. The
defects were real, but they were *findable*, *separable*, and *fixable at the shared
layer* — which is what a sound architecture looks like under stress.
