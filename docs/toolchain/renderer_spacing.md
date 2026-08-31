# Staged renderer spacing

## Authority and acceptance

- [The bundle](../../bundle/v0.1/core/views.yaml) owns `renderer_defaults.cell_sizing` and Scenario Flow's `scenario_flow_layout.trailing_track_policy`. Bundle validation requires these settings for the two tiered grid backends; no renderer fallback supplies missing policy.
- [Renderer architecture](adding_staged_renderers.md#non-negotiable-invariants) keeps semantic projection separate from measurement, placement, routing, and target output. Node boxes stay measured to fit their content; tier allocation does not resize them. Legacy rendering is unchanged.
- The visual proof cases are `docs/sdd_app_planning/sdd_for_sdd.sdd`, `service_blueprint_slice.sdd` with extra parked policies, and `three_branch_journey.sdd` with extra uncontained branches. Geometry acceptance precedes snapshot refresh.

## Node tiers and physical rows

`cell_sizing.node_tier_scope` accepts `lane` or `diagram`.
`cell_sizing.stack_alignment` accepts `start` or `center`.

The shared runtime path is `resolveCellSizingPolicy` → `buildCellSlots` → micro-layout group measurement → macro-layout slot placement. `RendererScene` stores only slot intent. Measured and positioned containers store the resolved tier height.

For a tier group, `H` is the largest individual measured node height, with a floor from the theme's card minimum. For a cell with `n` nodes, its intrinsic content height is `max(1, n) * H + max(0, n - 1) * gap`. Add the cell's padding and header to obtain its intrinsic height. Full-height sharing applies only within a physical row. Empty cells reserve one tier. Routing may subsequently add genuine clearance.

| View | Default tier scope | Alignment | Additional bounds rule |
| --- | --- | --- | --- |
| Scenario Flow | Per lane | Start | Trim only trailing unused logical rows in each visible lane; retain leading/internal gaps and one row for a shown empty lane. |
| Service Blueprint | Whole diagram, including ungrouped | Center stack in row and node in tier | Grow only rows whose stacks require additional tiers. Preserve band, spill, and parking ownership. |
| Journey Map | Existing layout, unchanged | Existing layout, unchanged | After aligning uncontained Steps with Stage content, recompute root height from current children plus root padding/chrome, before routing. |

Scenario Flow also supports `trailing_track_policy: preserve`. Physical root row indices reflect retained lane sizes; semantic row indices and ids remain stable. Service Blueprint retains horizontal centering and common column widths. Journey Map retains Stage geometry, branch spacing, and root width; this is the chosen bounds-only option.

## Regression evidence

[View before/after images and source files for Journey Map and Service Blueprint](spacing_proofs/README.md).

| Compact proof case | Previous height | Corrected height |
| --- | ---: | ---: |
| `sdd_for_sdd.scenario_flow` | 2276 | 946 |
| Service Blueprint, four parked policies | 1688 | 932 |
| Service Blueprint, ten parked policies | 3848 | 1388 |
| Journey Map, three uncontained branches | 544 | 368 |
| Journey Map, eight uncontained branches | 984 | 788 |

The canonical Service Blueprint remains 704 px tall. The Scenario Flow proof retains all node coordinates. The Journey Map fix changes only obsolete root height after its existing alignment pass. A 52-render audit of the other view/example/detail combinations produces identical SVGs and diagnostics, including Outcome Opportunity Map, IA Place Map, and UI Contracts.

`stagedStackSlots.spec.ts` covers measurement, alignment, empty groups, unchanged node dimensions, cloning, and natural sizing for nonparticipants. `stagedSpacingRegression.spec.ts` covers proof geometry, preserved logical gaps and ids, bundle-driven behavior, bounds, and determinism. `bundleRenderDetails.spec.ts` covers malformed policy rejection and fingerprint changes.
