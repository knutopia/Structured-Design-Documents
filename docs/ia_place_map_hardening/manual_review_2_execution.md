# Manual review 2 execution

Date: 2026-10-14. Status: implemented; required numerical proofs, normal-scale
visual review, build and full-suite verification passed.
The accepted self-loop uses the permitted backward upper fallback. The ambitious
bottom placement is not claimed.

## Authority and baseline

This implements [the coordinated plan](manual_review_2_followup_plan.md) and
[the forward-port policy](forward_routing_port_policy.md). The machine authority is
[`bundle/v0.2/core/views.yaml`](../../bundle/v0.2/core/views.yaml); presentation
references continue to come from
[`core/contracts.yaml`](../../bundle/v0.2/core/contracts.yaml). Shared renderer
infrastructure owns geometry. Parser, compiler, validator, projection, v0.1,
LEGACY output, and unrelated view contracts remain unchanged. Bundle validation
was extended for the new fields; semantic validation remains unchanged.

The non-negotiable gates were exact selected occurrence coverage, hierarchy and
source order, complete annotation text, distinct navigation tracks, legal painted
ports/markers, owner bounds, 16px painted export clearance, backward loop traversal,
and independently certified whole-scene forward admission. The pre-hardening
BillSage SVG supplied reading direction only.

Baseline HEAD was `c1cd5d476370ebad496eece78c57517f53ea5f45`.
The existing user changes were the two edited review/execution documents and the
untracked forward policy and follow-up plan. They were preserved. Fourteen baseline
scenes were captured before the policies were enabled, including both details, named
selections, and the exact self-loop/incoming source mutations. Baseline geometry,
occurrence/text inventories, route costs, padding claims, HEAD, and initial status
are retained in the new evidence set. The initial inspection preceded delegation;
the separately retained baseline-capture status already includes early contract
scaffolding from the agents. These scenes retain the old routing/paint behavior.
Historical review and proof directories were not regenerated.

## Per-item outcomes

| Item | Outcome | Evidence |
| --- | --- | --- |
| Decorator duplication | Passed: id/type/type-id have equal item/container rectangles, ports, routes and label boxes for both BillSage sources and combined parallel, in both details. Plain remains a distinct density. | `summary.json` has six equivalence records and all mode propagation checks. |
| Readable export margins | Passed: all routed strokes, label-box strokes and arrow footprints have the shared readable gap on all four export sides. Root chrome and titles retain their existing containment rules. | Parallel, self-loop and incoming SVGs; independent inequalities, larger-paint and corruption tests. |
| Annotation-aware wrapping | Passed: invitation lines are exactly `[Accept invitation]` and `{invitation valid}`. Missing parts, long parts/tokens, duplicate names and literal delimiters retain canonical text. | Real-loader removal, formatter integrity, measured-size and final geometry tests. |
| Backward loop | Passed: distinct north ports depart to the right and arrive to the left; the exterior horizontal rail travels leftward and the arrival retains its arrow. | Both self-loop SVGs; real-loader direction mutation and corrupted-port tests. |
| Bottom loop alternative | Assessed bounded fallback: each south trial starts from its own original measured scene and demand state. Its label association/owner capacity and complete geometry do not pass within the shared allowance. The upper scene is fully audited. Top alignment and two straight cross-Area forward connectors are not claimed. | Independent north/south costs and explicit south rejection records in each loop trace. This is not a claim of geometric infeasibility. |
| BillSage forward shortcut | Passed for both unchanged sources, compact/detailed, plain/type-id: south/west `P-210 -> P-230` has two segments; `P-210 -> P-220` remains straight; all eight connectors and three returns remain; crossings stay zero. | Eight visual proofs, independent baseline witnesses and real-loader removal tests. |
| Parallel and DG-001 | Passed: four connectors, complete distinct labels, zero crossings and readable exterior return. | Both details, plain/type-id for combined. |
| DG-002 and DG-003 | Passed: exactly one selected occurrence and full label, one straight segment at aligned facing midpoints. | Both details for each selection. |
| Multiple incoming | Passed regression: five connectors, complete child-return label, hierarchy preserved, painted margins audited, one crossing retained. | Both details; no new crossing-reduction workstream. |

## Bundle and runtime paths

`loadBundle` validates all optional discriminators/combinations and rejects orphan
routing preferences, duplicate/nonperpendicular forward pairs, incompatible
progression, empty/duplicate/nontangent loop trials, and unsupported wrapping or
export policies. Omission retains previous staged behavior. `cloneViewMetadata`
deep-copies preferences and ownership; prepared acceptance policy is retained
independently of mutable scene metadata.

The loaded view enables:

- `routing_scope.export_clearance: readable_gap`;
- navigation presentation `wrapping: prefer_part_boundaries`;
- negative horizontal loop traversal with south/north side trials;
- same-owner positive-vertical south/west forward shortcuts.

Presentation preparation derives generic preferred offsets from the loaded
ordered templates and event-name resolution. `EdgeLabelSpec` carries canonical
text and break opportunities; shared `measureEdgeLabel` owns final line breaks and
actual dimensions. LEGACY formatting still receives the flattened text.

`buildIaPlaceMapRendererScene` carries policy intent through scene metadata.
`runIaPlaceMapRendererPipeline` consumes it through shared paint envelopes, port
capacity, ordered pairs, corridor measurement, reflow, label placement, and quality
selection. Intervals, coordinates, routes, and the finite immutable baseline
witness belong downstream of semantic scene preparation.

Forward trials preserve ordinary baseline groups whose membership is unchanged,
including structural reservations and facing reconciliation. Affected target
groups use ordinary allocation; movable sources are allocated separately.
Geometric intervals expose nearest feasible source attachment and compatibility
events. Shared selection applies baseline admission; repeat SVG acceptance
recomputes both route inventories/costs and audits policy/layout/labels/markers.
No off-centre flag or recorded cost grants permission by itself. Nested or cyclic
witness history is rejected before audit callbacks run. Ordinary endpoints sharing
a side with an ordered loop remain subject to independent allocation checks.

The plain compact BillSage interval is `[324,343]`, source midpoint `424`, chosen
coordinate `343`, displacement `81`. Scene bends fall from 12 to 11, with zero
crossings and identical baseline/proposed layout dimensions. Decorated geometry
translates these coordinates through normal measurement; no fixture coordinates
or identifier cases exist in production code. Witness attachments retain all
interval events and translate coherently with the baseline.

## Shared corrections and demand ownership

Strict margins exposed an endpoint bypass gap: a return leaving below a Place
must escape an intervening body before reaching its exterior rail. Shared
capacity now measures that perpendicular flank and distinguishes solid bodies
from axis-parallel container borders. Container interiors remain routable.

A label overflowing its own selected Area grows that Area. Charging the same
overflow to root padding would reserve space twice; root-owned paint supplies
root padding demand, while independent final export acceptance still checks every
painted envelope. This removes the duplicate right strip in the incoming proof.

Dense parallel regression exposed partial runs that left no label-sized opening,
even though no single rival covered the entire gutter. Shared row capacity now
checks interval coverage, retaining the previous full-gutter and narrow-owner
rules. Long-token regression exposed a final label audit that ignored a run
accepted by the router's axial tolerance. Label geometry now recognizes those
runs with that same shared tolerance. Neither failure was hidden by refreshing
snapshots or relaxing acceptance.

One live allowance covers ordinary routing, independent loop trials, reflow,
attachment intervals, labels, and forward comparisons: at most 4,096 candidates,
128 repairs, and four actual expansions. Optional work reserves capacity through
geometric eligibility and stable ordering. Evidence records actual consumption
and remaining candidates, repairs and expansions. An accepted constrained scene
can retain the existing comparison-limit warning; a margin/direction/text failure
cannot produce SVG or its derived PNG.

## Verification and visual review

Verification uses `TMPDIR=/tmp`. Passing focused commands include:

```sh
TMPDIR=/tmp pnpm exec vitest run tests/iaReview2ForwardShortcut.spec.ts
TMPDIR=/tmp pnpm exec vitest run tests/iaReview2ExportClearance.spec.ts tests/iaPlaceMapHardeningGeometry.spec.ts tests/iaPlaceMapBackwardLoop.spec.ts
TMPDIR=/tmp pnpm exec vitest run tests/connectorLabelLayout.spec.ts tests/iaPlaceMapHardeningGeometry.spec.ts
TMPDIR=/tmp pnpm exec vitest run tests/routingQualityBudgetAllowance.spec.ts tests/routingForwardWitness.spec.ts tests/routingExteriorCapacity.spec.ts
TMPDIR=/tmp pnpm exec vitest run tests/stagedIaPlaceMap.spec.ts tests/iaPlaceMapBackwardLoop.spec.ts tests/iaReview2ForwardShortcut.spec.ts tests/iaPlaceMapRoutingBoundary.spec.ts tests/iaPlaceMapHardeningBundle.spec.ts
```

Real-loader removal/mutation checks prove runtime consumption. Corrupted loaded
policy metadata, loop order, annotation text, painted margins, and stale/deleted/
cyclic forward witnesses are rejected. Shared tests cover interval rotation, translation,
larger paint, occupied ports, depleted allowance, and admission caching. Existing
API, CLI, helper, named/combined, `force`, SVG and SVG-derived PNG tests remain the
public-boundary coverage; required failures withhold artifacts.

Normal-scale review covered plain/type-id BillSage and parallel in both details,
named selections, backward loops and incoming returns. The two BillSage sources
have identical compact geometry; the real source omits the route/access metadata
present in the fixture, so their detailed layouts differ. Both detailed sources
were inspected. Decorator equivalence allows id/type visual de-duplication.
Private PNG rasterizations were used only to
inspect SVGs under `/tmp`; the published proof set contains SVGs, not PNG proofs.
Output is visually acceptable under the required gates; the bottom-loop ambition
remains the explicitly justified upper fallback.

The first full suite found the expected BillSage golden difference and three
geometry/audit regressions. The next run found only two existing shared-capacity
assertions, which were corrected by preserving full-gutter/narrow-owner behavior.
All affected focused tests passed afterward. Final `TMPDIR=/tmp pnpm test` passed
the TypeScript build and **182 files / 1,998 tests**. Supplemental checks passed
the real-loader export removal suite (17 tests), finite witness audit (4 tests),
and stale/deleted/cyclic witness rejection through SVG and derived PNG (one
targeted test). The full log is retained with the evidence.

Only the four affected v0.2 BillSage renderer/measured/positioned/SVG goldens were
refreshed after proof and visual acceptance. v0.1, projection, unrelated renderer,
LEGACY and historical proof snapshots remain unchanged.

## Evidence

The final evidence directory is `manual_review_2_evidence/`. It contains 22 SVG
proofs, 34 mode/selection records with source/bundle/artifact hashes, six decorator
equivalence records, exact source mutations, finite positioned witnesses, routing
traces, baseline metrics and initial repository status. The capture helper is
[`scripts/captureIaReview2Evidence.ts`](../../scripts/captureIaReview2Evidence.ts)
and always stages trials under `/tmp`; it emits no SVG for failed independent
acceptance or a missing required shortcut. Publication followed final numerical
and visual acceptance. All 22 fresh SVG hashes match the previously inspected
accepted geometry. The index below links every required proof; the evidence README
includes dimensions, root padding, complete budget consumption, remaining allowance,
and both independent loop comparison traces.

[Evidence index and budget table](manual_review_2_evidence/README.md),
[all proof records](manual_review_2_evidence/summary.json),
[loaded bundle policy](manual_review_2_evidence/bundle-policy.json),
[artifact hashes](manual_review_2_evidence/sha256.txt), and
[full verification log](manual_review_2_evidence/verification.log).

| Required visual proof | Compact | Detailed |
| --- | --- | --- |
| BillSage fixture, plain | [SVG](manual_review_2_evidence/billsage.compact.svg) | [SVG](manual_review_2_evidence/billsage.detailed.svg) |
| BillSage fixture, type-id | [SVG](manual_review_2_evidence/billsage.compact.type-id.svg) | [SVG](manual_review_2_evidence/billsage.detailed.type-id.svg) |
| BillSage real source, plain | [SVG](manual_review_2_evidence/billsage-real.compact.svg) | [SVG](manual_review_2_evidence/billsage-real.detailed.svg) |
| BillSage real source, type-id | [SVG](manual_review_2_evidence/billsage-real.compact.type-id.svg) | [SVG](manual_review_2_evidence/billsage-real.detailed.type-id.svg) |
| Combined parallel, plain | [SVG](manual_review_2_evidence/parallel.compact.svg) | [SVG](manual_review_2_evidence/parallel.detailed.svg) |
| Combined parallel, type-id | [SVG](manual_review_2_evidence/parallel.compact.type-id.svg) | [SVG](manual_review_2_evidence/parallel.detailed.type-id.svg) |
| DG-001 | [SVG](manual_review_2_evidence/DG-001.compact.svg) | [SVG](manual_review_2_evidence/DG-001.detailed.svg) |
| DG-002 | [SVG](manual_review_2_evidence/DG-002.compact.svg) | [SVG](manual_review_2_evidence/DG-002.detailed.svg) |
| DG-003 | [SVG](manual_review_2_evidence/DG-003.compact.svg) | [SVG](manual_review_2_evidence/DG-003.detailed.svg) |
| Backward upper-loop fallback | [SVG](manual_review_2_evidence/self-loop.compact.svg) | [SVG](manual_review_2_evidence/self-loop.detailed.svg) |
| Multiple incoming regression | [SVG](manual_review_2_evidence/multiple-incoming.compact.svg) | [SVG](manual_review_2_evidence/multiple-incoming.detailed.svg) |
