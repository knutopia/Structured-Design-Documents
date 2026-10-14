# Accepted review-2 evidence

Date: 2026-10-14. Build and full suite passed: 182 files, 1,998 tests. All 34 numerical proof records and six id/type/type-id equivalence checks pass. The 22 SVG hashes match the inspected accepted artifacts. No PNG proof set is published.

The backward upper self-loop is the accepted fallback. Bottom alternatives were assessed independently and rejected; this is no claim of geometric infeasibility or of top alignment/two straight cross-Area forward routes.

Reproduce trials from repository root:

```sh
TMPDIR=/tmp node --import tsx scripts/captureIaReview2Evidence.ts --out /tmp/ia-review2-new-trial
TMPDIR=/tmp pnpm test
```

The helper stages trials only; acceptance and visual review are required before a future publication. Each SVG has exact `.sdd` source, positioned `.json` geometry/finite witnesses, and `.trace.json` routing evidence beside it. `summary.json` binds sources, bundle fingerprints, geometry and SVG hashes. `bundle-policy.json` records the loaded fields. `bundle-files.sha256` and `runtime-source.sha256` bind all bundle/runtime source files; `sha256.txt` binds this evidence directory.

The fixture and real BillSage source share compact geometry. Detailed fixture metadata produces a larger layout than the real source; both were reviewed.

## Proof inventory and actual allowance

Consumed and remaining columns are candidates / repairs / expansions. The live maximum is 4096 / 128 / 4 across ordinary routing, reflow, independent loop trials, labels and forward comparison. Canvas/root padding are the accepted final values, not per-trial expansion increments.

| SVG | Canvas | Root padding T/R/B/L | Connectors | Crossings | Bends | Consumed C/R/E | Remaining C/R/E |
| --- | --- | --- | ---: | ---: | ---: | --- | --- |
| [billsage.compact](billsage.compact.svg) | 1938 × 533 | 24 / 24 / 24 / 24 | 8 | 0 | 11 | 1746 / 10 / 1 | 2350 / 118 / 3 |
| [billsage.compact.type-id](billsage.compact.type-id.svg) | 1938 × 586 | 24 / 24 / 24 / 24 | 8 | 0 | 11 | 1746 / 10 / 1 | 2350 / 118 / 3 |
| [billsage.detailed](billsage.detailed.svg) | 1940 × 887 | 24 / 24 / 24 / 24 | 8 | 0 | 11 | 3611 / 16 / 2 | 485 / 112 / 2 |
| [billsage.detailed.type-id](billsage.detailed.type-id.svg) | 1940 × 982 | 24 / 24 / 24 / 24 | 8 | 0 | 11 | 3611 / 16 / 2 | 485 / 112 / 2 |
| [billsage-real.compact](billsage-real.compact.svg) | 1938 × 533 | 24 / 24 / 24 / 24 | 8 | 0 | 11 | 1746 / 10 / 1 | 2350 / 118 / 3 |
| [billsage-real.compact.type-id](billsage-real.compact.type-id.svg) | 1938 × 586 | 24 / 24 / 24 / 24 | 8 | 0 | 11 | 1746 / 10 / 1 | 2350 / 118 / 3 |
| [billsage-real.detailed](billsage-real.detailed.svg) | 1938 × 533 | 24 / 24 / 24 / 24 | 8 | 0 | 11 | 1746 / 10 / 1 | 2350 / 118 / 3 |
| [billsage-real.detailed.type-id](billsage-real.detailed.type-id.svg) | 1938 × 586 | 24 / 24 / 24 / 24 | 8 | 0 | 11 | 1746 / 10 / 1 | 2350 / 118 / 3 |
| [parallel.compact](parallel.compact.svg) | 749.676 × 260 | 24 / 34 / 34 / 24 | 4 | 0 | 4 | 420 / 3 / 2 | 3676 / 125 / 2 |
| [parallel.compact.type-id](parallel.compact.type-id.svg) | 749.676 × 270 | 24 / 34 / 34 / 24 | 4 | 0 | 4 | 414 / 3 / 2 | 3682 / 125 / 2 |
| [parallel.detailed](parallel.detailed.svg) | 749.676 × 360 | 24 / 34 / 34 / 24 | 4 | 0 | 4 | 1674 / 7 / 2 | 2422 / 121 / 2 |
| [parallel.detailed.type-id](parallel.detailed.type-id.svg) | 749.676 × 398 | 24 / 34 / 34 / 24 | 4 | 0 | 4 | 1674 / 7 / 2 | 2422 / 121 / 2 |
| [DG-001.compact](DG-001.compact.svg) | 749.676 × 260 | 24 / 34 / 34 / 24 | 4 | 0 | 4 | 420 / 3 / 2 | 3676 / 125 / 2 |
| [DG-001.detailed](DG-001.detailed.svg) | 749.676 × 360 | 24 / 34 / 34 / 24 | 4 | 0 | 4 | 1674 / 7 / 2 | 2422 / 121 / 2 |
| [DG-002.compact](DG-002.compact.svg) | 739.676 × 168 | 24 / 24 / 24 / 24 | 1 | 0 | 0 | 21 / 0 / 1 | 4075 / 128 / 3 |
| [DG-002.detailed](DG-002.detailed.svg) | 739.676 × 218 | 24 / 24 / 24 / 24 | 1 | 0 | 0 | 21 / 0 / 1 | 4075 / 128 / 3 |
| [DG-003.compact](DG-003.compact.svg) | 696.992 × 168 | 24 / 24 / 24 / 24 | 1 | 0 | 0 | 21 / 0 / 1 | 4075 / 128 / 3 |
| [DG-003.detailed](DG-003.detailed.svg) | 696.992 × 218 | 24 / 24 / 24 / 24 | 1 | 0 | 0 | 21 / 0 / 1 | 4075 / 128 / 3 |
| [self-loop.compact](self-loop.compact.svg) | 749.676 × 270.5 | 24 / 34 / 34 / 24 | 5 | 0 | 10 | 3019 / 4 / 4 | 1077 / 124 / 0 |
| [self-loop.detailed](self-loop.detailed.svg) | 749.676 × 360 | 24 / 34 / 34 / 24 | 5 | 0 | 10 | 2946 / 7 / 4 | 1150 / 121 / 0 |
| [multiple-incoming.compact](multiple-incoming.compact.svg) | 950.352 × 260 | 24 / 34 / 34 / 24 | 5 | 1 | 6 | 2169 / 2 / 4 | 1927 / 126 / 0 |
| [multiple-incoming.detailed](multiple-incoming.detailed.svg) | 934.352 × 360 | 24 / 34 / 34 / 24 | 5 | 1 | 6 | 4096 / 8 / 4 | 0 / 120 / 0 |

## Independent loop comparisons

Costs below are crossings / bends / measured expansion / port displacement / route length. A rejected scene can have a shorter route cost while failing label, marker, body, border or owner acceptance. Only north is accepted; the JSON trace retains each precise rejection and expansion request.

### self-loop.compact

[Full trace](self-loop.compact.trace.json)

- `independent-loop-north`: 0 / 10 / 164.176 / 0 / 1557.03; accepted. Remaining candidates / repairs: 1261 / 124.
- `independent-loop-south`: 1 / 4 / 131.676 / 23 / 982.028; rejected. Remaining candidates / repairs: 1077 / 124.

### self-loop.detailed

[Full trace](self-loop.detailed.trace.json)

- `independent-loop-north`: 0 / 10 / 153.676 / 0 / 1636.03; accepted. Remaining candidates / repairs: 2417 / 124.
- `independent-loop-south`: 0 / 2 / 153.676 / 0 / 726.028; rejected. Remaining candidates / repairs: 1150 / 121.

Compact bottom rejection includes an extra crossing, ambiguous/bounds/connector label failures and route/marker capacity. Detailed bottom rejection includes ambiguous/bounds/connector label failures. Required upper proofs pass every final gate. Detailed multiple-incoming reaches the candidate limit with an accepted scene and the existing comparison-limit warning; its baseline one crossing is retained.

## Baseline and verification

[Pre-policy baselines](baseline/README.md), [baseline metrics](baseline/metrics.md), [initial inspection](initial-inspection.json), [full-suite log](verification.log), [export loader removal](export-loader-removal.log), [witness SVG/PNG rejection](witness-png-rejection.log).
