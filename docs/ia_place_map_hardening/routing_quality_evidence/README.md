# Accepted routing recovery SVG proofs

Captured 2026-10-13 after independent numerical acceptance and normal-scale review. This directory contains **26 SVG proofs and no PNG proofs**. The user's SVG-only instruction overrides the recovery plan's PNG proof commands. Historical rejected evidence remains in `../evidence/`; it is preserved for comparison.

The proofs preserve exact selected occurrences, full annotation text, balanced ordinary attachments, structural source order and declared trunks. Independent tests verify ownership, 16px painted stand-off, 12px own-label adjacency, 24px unrelated-route label clearance, and complete marker/export bounds. Singleton named selections are straight; combined parallel selections have distinct forward labels and an exterior return; BillSage keeps eight connections and three contained returns without avoidable double crossings. Loop and incoming variants satisfy the same final audits.

| SVG proof | Edges | Candidates / repairs | Best accepted cost | Warnings |
| --- | --- | --- | --- | --- |
| [billsage.compact.id](billsage.compact.id.svg) | 8 | 1722 / 10 | 0, 12, 72, 190, 2162.5 | none |
| [billsage.compact](billsage.compact.svg) | 8 | 1722 / 10 | 0, 12, 72, 190, 2047.5 | none |
| [billsage.compact.type-id](billsage.compact.type-id.svg) | 8 | 1722 / 10 | 0, 12, 72, 190, 2162.5 | none |
| [billsage.compact.type](billsage.compact.type.svg) | 8 | 1722 / 10 | 0, 12, 72, 190, 2162.5 | none |
| [billsage.detailed.id](billsage.detailed.id.svg) | 8 | 4096 / 19 | 0, 12, 76, 190, 2863.5 | none |
| [billsage.detailed](billsage.detailed.svg) | 8 | 4096 / 19 | 0, 12, 76, 190, 2692.5 | none |
| [billsage.detailed.type-id](billsage.detailed.type-id.svg) | 8 | 4096 / 19 | 0, 12, 76, 190, 2863.5 | none |
| [billsage.detailed.type](billsage.detailed.type.svg) | 8 | 4096 / 19 | 0, 12, 76, 190, 2863.5 | none |
| [multiple-incoming.compact](multiple-incoming.compact.svg) | 5 | 2649 / 2 | 1, 6, 349.664, 0, 1574.964 | none |
| [multiple-incoming.detailed](multiple-incoming.detailed.svg) | 5 | 3856 / 8 | 1, 6, 333.664, 0, 1724.964 | renderer.routing.ia_quality_comparison_limited |
| [parallel.compact.DG-001](parallel.compact.DG-001.svg) | 4 | 357 / 3 | 0, 4, 148.988, 0, 1458.964 | none |
| [parallel.compact.DG-002](parallel.compact.DG-002.svg) | 1 | 4 / 0 | 0, 0, 131.676, 0, 211.676 | none |
| [parallel.compact.DG-003](parallel.compact.DG-003.svg) | 1 | 4 / 0 | 0, 0, 146.988, 0, 226.988 | none |
| [parallel.compact.id](parallel.compact.id.svg) | 4 | 351 / 3 | 0, 4, 148.988, 0, 1468.964 | none |
| [parallel.compact](parallel.compact.svg) | 4 | 357 / 3 | 0, 4, 148.988, 0, 1458.964 | none |
| [parallel.compact.type-id](parallel.compact.type-id.svg) | 4 | 351 / 3 | 0, 4, 148.988, 0, 1468.964 | none |
| [parallel.compact.type](parallel.compact.type.svg) | 4 | 351 / 3 | 0, 4, 148.988, 0, 1468.964 | none |
| [parallel.detailed.DG-001](parallel.detailed.DG-001.svg) | 4 | 964 / 5 | 0, 4, 148.988, 0, 1558.964 | none |
| [parallel.detailed.DG-002](parallel.detailed.DG-002.svg) | 1 | 4 / 0 | 0, 0, 131.676, 0, 211.676 | none |
| [parallel.detailed.DG-003](parallel.detailed.DG-003.svg) | 1 | 4 / 0 | 0, 0, 146.988, 0, 226.988 | none |
| [parallel.detailed.id](parallel.detailed.id.svg) | 4 | 964 / 5 | 0, 4, 148.988, 0, 1596.964 | none |
| [parallel.detailed](parallel.detailed.svg) | 4 | 964 / 5 | 0, 4, 148.988, 0, 1558.964 | none |
| [parallel.detailed.type-id](parallel.detailed.type-id.svg) | 4 | 964 / 5 | 0, 4, 148.988, 0, 1596.964 | none |
| [parallel.detailed.type](parallel.detailed.type.svg) | 4 | 964 / 5 | 0, 4, 148.988, 0, 1596.964 | none |
| [self-loop.compact](self-loop.compact.svg) | 5 | 1758 / 0 | 0, 10, 225.488, 0, 1602.964 | none |
| [self-loop.detailed](self-loop.detailed.svg) | 5 | 1989 / 3 | 0, 10, 214.988, 0, 1681.964 | none |

Cost columns are crossings, bends, measured owned expansion (px), port displacement (px), and route length (px). [Routing decisions](routing-traces.md) retain accepted costs, rejected alternatives, each expansion's owner/deficit and selected port groups. [SVG hashes](sha256.txt), [source hashes](source-sha256.txt) and [stage golden hashes](stage-sha256.txt) identify these bytes.

The detailed incoming variant carries `renderer.routing.ia_quality_comparison_limited`: its final scene passes all acceptance audits, but the bounded comparison did not exhaust all alternatives. These proofs establish the specified geometry, not global optimality for arbitrary graphs.

Numerical acceptance: **154/154 across eight files**, including independent proof geometry, bundle mutation, public fatal-boundary corruption, broader IA variants, labels and interval capacity. The four affected BillSage stage goldens passed **9/9**. Final full suite: **174 files / 1,932 tests passed**, including the build, in 578.64 seconds. Full verification is recorded in [execution evidence](../routing_quality_execution.md).

Reproduce base and decorated proofs by loading `bundle/v0.2/manifest.yaml`, compiling the unchanged fixtures, projecting `ia_place_map`, building the scene with the desired detail/decorator policy and invoking `runIaPlaceMapRendererPipeline` then `renderPositionedSceneToSvg`. Named selections use the existing projection diagram selection. Loop/incoming source mutations are exactly those in `tests/iaPlaceMapHardeningGeometry.spec.ts` and the final [variant checks](../../../tests/iaPlaceMapRoutingVariants.spec.ts). Run from the repository root:

```bash
TMPDIR=/tmp pnpm run build
TMPDIR=/tmp pnpm sdd show tests/fixtures/render/ia_parallel_navigation_v02.sdd --bundle bundle/v0.2/manifest.yaml --profile simple --detail compact --decorators none --view ia_place_map --out /tmp/ia-quality.parallel.compact.svg
TMPDIR=/tmp pnpm sdd show tests/fixtures/render/billSage_structure.sdd --bundle bundle/v0.2/manifest.yaml --profile simple --detail detailed --decorators none --view ia_place_map --out /tmp/ia-quality.billsage.detailed.svg
TMPDIR=/tmp pnpm test --maxWorkers=4 --minWorkers=4
```
