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
exhaust it. This is specific, falsifiable, and would explain why dense documents cannot
recover.

**Status: NOT VERIFIED.** Confirming it requires instrumenting
`preparationExpansionPasses`. It is a lead, not a finding.

---

## Suggested sequence

1. **Verify the expansion-starvation hypothesis.** Cheap, and if true it is a genuine
   fix that helps dense documents broadly.
2. **Reclassify `sdd_for_sdd.sdd`.** It is a stress test, not a conformance gate. Keep
   it visible; stop letting it block. This also resolves the authority conflict
   described in `routing_triage_2026-09-18.md`.
3. **Decide the contract explicitly.** "Best-effort routing with honest diagnostics" is
   a legitimate, shippable contract that most tools adopt. Chasing "no violations ever"
   is what will grind the project down, because it is not achievable.

---

## Counter-evidence to the "failed project" verdict

The hang fix landed cleanly, generalized across four renderers from a single
shared-layer edit, and turned an unmeasurable hang into honest diagnostics. That is a
session in which the architecture *worked*. A failed project does not do that.
