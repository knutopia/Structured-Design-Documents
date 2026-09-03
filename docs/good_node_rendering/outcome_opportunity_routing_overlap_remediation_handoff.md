# Outcome-Opportunity Routing Overlap Remediation Handoff

## Status

**Managed handoff; defect remains unresolved.**

This document records the routing defect exposed during the shared-node renderer adoption, the evidence gathered in the adoption thread, the applicable architectural constraints, and the acceptance conditions for a separate remediation thread.

The defect is considered managed for purposes of continuing and closing the shared-node adoption work because it now has a durable, scoped handoff. It must not be described as fixed, accepted, or harmless. The routing remediation is complete only when the final routed scene satisfies the existing separation invariant without weakening tests or hiding the failure in refreshed artifacts.

Investigation began against Phase 5 commit `1a58a1b524a035754e602079202caff168c583ee` plus the shared-node Phase 7 cleanup then present in the adoption thread. That combined state, including this handoff, was subsequently captured in commit `a7a367ff5153240d8f1e3c2137fd40ea463dc88e`. The cleanup does not modify `outcomeOpportunityMapRouting.ts`; the routing failure is reproducible from the current renderer path.

## Executive Summary

The detailed staged `outcome_opportunity_map` rendering of `bundle/v0.1/examples/multiple_outcomes.sdd` contains a 32px collinear overlap between:

- `OP-003__supports__O-002`, horizontal segment 2; and
- `OP-004__supports__O-002`, horizontal segment 2.

Both segments occupy `y = 411.5` over `x = 840.77..872.77`. Because the strokes have identical styling, the overlap looks like one ordinary connector in an unannotated rendering.

The shared-node migration exposed the defect by changing measured node heights, vertical packing, endpoints, and route tracks. It did **not** consume the horizontal opportunity-to-outcome routing corridor:

- relevant node widths were 224px before and after migration;
- the corridor width remained exactly `253.434px` before and after migration; and
- the failure is therefore not evidence that the shared node is too wide or that a renderer-specific node variant is needed.

The working diagnosis is a late-displacement/final-validation gap in the outcome-opportunity occupancy resolver. One connector is displaced by one 16px routing interval to avoid an earlier conflict, but that move lands on a coordinate already occupied by another connector. Conflict components are formed from pre-displacement effective coordinates, and the final occupancy extraction is not followed by another separation-resolution pass. This allows a displacement-created collision to survive into `finalPositionedScene`.

## Authority and Supporting Documents

Use these sources in the following roles.

### Repository-wide architectural and quality constraints

- [`../../AGENTS.md`](../../AGENTS.md) is authoritative for the staged renderer pipeline, routing ownership, determinism, SVG-first output, PNG derivation, quality gates, and stop conditions.
- [`../toolchain/architecture.md`](../toolchain/architecture.md) records the current architecture. In particular, `staged_outcome_opportunity_map_preview` owns custom opportunity routing, and projection remains the semantic boundary.
- [`../toolchain/renderer_migration_guidance.md`](../toolchain/renderer_migration_guidance.md) assigns measured allocations, placement, ports, and relationship routing to macro layout while assigning internal composition to the shared node. Its outcome-opportunity guidance requires fixed semantic columns, explicit ports, and custom gutter/occupancy routing without ELK.

### Shared-node adoption contract

- [`shared_node_renderer_adoption_plan.md`](shared_node_renderer_adoption_plan.md) is authoritative for the adoption boundary. Its width-and-overflow rule requires the accepted 224px shared width and explicitly says that a fixed-width-exposed routing problem must be corrected in shared macro layout or routing, not by adding a renderer-specific node variant.
- [`shared_node_renderer_implementation_plan.md`](shared_node_renderer_implementation_plan.md) records shared-node ownership and the current managed remediation status.
- [`solving_for_good_node_rendering.md`](solving_for_good_node_rendering.md) defines shared-node composition.
- [`shared_node_renderer_acceptance.md`](shared_node_renderer_acceptance.md) records the accepted node measurements and visual contract.

### Executable acceptance authority

- [`../../tests/stagedVisualAcceptance.spec.ts`](../../tests/stagedVisualAcceptance.spec.ts) applies diagram-level visual invariants to the canonical outcome-opportunity examples. The relevant case starts at the test named `keeps outcome_opportunity_map proof cases free of forbidden diagnostics, node-crossing routes, and label collisions`.
- [`../../tests/stagedVisualHarness.ts`](../../tests/stagedVisualHarness.ts) defines `expectSameOrientationSegmentsSeparated`. Collinear segments with a positive shared span must be separated by at least 16px, allowing the existing epsilon.
- [`../../tests/outcomeOpportunityMapRouting.spec.ts`](../../tests/outcomeOpportunityMapRouting.spec.ts) contains focused routing assertions and should receive regression coverage for the displacement-created collision.
- [`../../src/renderer/staged/outcomeOpportunityMapRouting.ts`](../../src/renderer/staged/outcomeOpportunityMapRouting.ts) owns the affected routing and occupancy logic.

Existing SVGs and snapshots are evidence, not normative authority. Never weaken an invariant merely to preserve them.

## Reproduction

From the repository root, run:

```bash
TMPDIR=/tmp pnpm exec vitest run tests/stagedVisualAcceptance.spec.ts
```

Observed result on 2026-09-03:

```text
tests/stagedVisualAcceptance.spec.ts (5 tests | 1 failed)

OP-003__supports__O-002 segment 2
OP-004__supports__O-002 segment 2
horizontal overlap 32:
expected 0 to be greater than or equal to 15.5
```

The other four tests in that focused file passed. The failure originates at:

```text
tests/stagedVisualHarness.ts:420
tests/stagedVisualAcceptance.spec.ts:274
```

The exact current route geometry is also present in:

- [`../../tests/goldens/renderer-stages/outcome-opportunity-map.multiple-outcomes.svg`](../../tests/goldens/renderer-stages/outcome-opportunity-map.multiple-outcomes.svg)
- [`../../tests/goldens/renderer-stages/outcome-opportunity-map.multiple-outcomes.positioned-scene.json`](../../tests/goldens/renderer-stages/outcome-opportunity-map.multiple-outcomes.positioned-scene.json)

Do not update either artifact before the invariant passes. The current SVG golden is useful evidence of the failing output; its existence does not constitute acceptance.

## Exact Failing Geometry

The current final routes are:

```text
OP-007__supports__O-002
  M 699.336 310.5
  L 824.77  310.5
  L 824.77  395.5
  L 952.77  395.5

OP-003__supports__O-002
  M 699.336 395.5
  L 715.336 395.5
  L 715.336 411.5
  L 872.77  411.5  <-- overlaps OP-004 over final 32px
  L 872.77  363.5
  L 952.77  363.5

OP-004__supports__O-002
  M 699.336 506
  L 840.77  506
  L 840.77  411.5
  L 952.77  411.5  <-- overlaps OP-003 over first 32px
```

Intersection of the two horizontal spans:

```text
max(715.336, 840.77) = 840.77
min(872.77,  952.77) = 872.77
872.77 - 840.77       = 32px
```

Their coordinate distance is zero, while the required separation is 16px subject to the test epsilon.

## Comparison with Pre-Adoption Geometry

The following values come from the positioned-scene golden immediately before the shared-node outcome-map artifacts were refreshed (`ac93966^`) and the refreshed shared-node artifact (`ac93966`). The shared-node implementation itself landed in `06c5d02`; the outcome-map goldens were refreshed in the following phase commit, `ac93966`.

| Node | Pre-adoption bounds | Shared-node bounds | Material change |
| --- | --- | --- | --- |
| `OP-003` | `x=491.336, y=378, w=224, h=56` | `x=475.336, y=369, w=224, h=53` | 3px shorter; vertically repacked |
| `OP-004` | `x=491.336, y=490, w=224, h=56` | `x=475.336, y=470, w=224, h=72` | 16px taller; vertically repacked |
| `O-002` | `x=968.77, y=378, w=224, h=64` | `x=952.77, y=369, w=224, h=53` | 11px shorter; vertically repacked |

The opportunity-to-outcome corridor did not shrink:

```text
pre-adoption:  968.77 - (491.336 + 224) = 253.434
shared node:   952.77 - (475.336 + 224) = 253.434
```

The pre-adoption routes were separated:

```text
OP-003__supports__O-002
  M 715.336 406 L 840.77 406 L 840.77 378 L 968.77 378

OP-004__supports__O-002
  M 715.336 518 L 856.77 518 L 856.77 426 L 968.77 426
```

This comparison supports two conclusions:

1. Rendering is not merely paint in this staged pipeline. Shared-node composition determines measured height; macro layout consumes that allocation; routing consumes the resulting positions and ports.
2. The failure is a routing robustness defect exposed by valid measured-geometry changes, not a violation of the accepted shared-node width.

## Staged Evidence: Where the Collision Appears

The stored step-2 and step-3 debug SVGs do not yet contain the final overlap:

```text
step 2 / step 3, OP-003__supports__O-002
  M 534 395.5 L 582 395.5

step 2 / step 3, OP-004__supports__O-002
  M 534 506 L 558 506 L 558 411.5 L 582 411.5
```

The extra dogleg and coincident run appear during final expansion, local compaction, and occupancy displacement. This narrows the remediation target: do not change projection, shared-node measurement, initial endpoint/template selection, or SVG serialization to solve this failure.

## Final Occupancy Evidence

An isolated render diagnostic of the current production path reported these relevant final occupancy entries:

```text
connector:7:OP-003__supports__O-002
  key: row:3:inside
  axis: horizontal
  nominalCoordinate: 411.5
  span: 715.336..872.77
  routeSegmentIndex: 2
  ownershipRank: 2

connector:8:OP-004__supports__O-002
  key: row:3:inside
  axis: horizontal
  nominalCoordinate: 411.5
  span: 840.77..952.77
  routeSegmentIndex: 2
  ownershipRank: 2
```

The same two final horizontal segments are also represented in the expanded column occupancy group:

```text
key: column:1:expanded
axis: horizontal
coordinate: 411.5
```

Therefore the final scene and final occupancy both know about the collision. The issue is not missing final geometry extraction. The issue is that the extracted final collision is not fed back into a successful separation step.

Relevant vertical and edge-local occupancies remain individually separated:

```text
OP-007 target/local vertical: x=824.77
OP-004 target/local vertical: x=840.77
OP-003 target/local vertical: x=872.77
```

Those tracks demonstrate that the corridor has usable capacity. A fix should preserve their deterministic ordering unless a better globally valid ordering is deliberately established.

## Working Root-Cause Analysis

`resolveOccupancyDisplacements(...)` currently:

1. groups occupancy entries;
2. constructs connected conflict components using their current effective coordinates;
3. processes each component independently;
4. moves movable entries away from coordinates occupied within that component; and
5. returns one displacement map.

The overlap predicate treats entries exactly 16px apart as non-conflicting:

```ts
Math.abs(getEffectiveCoordinate(left) - getEffectiveCoordinate(right)) < ENDPOINT_SPACING
```

That is correct for the initial state: 16px is the required separation. The defect arises when processing one component moves an entry by 16px onto the coordinate of an entry that was excluded from that component based on the earlier coordinates.

The observed route sequence is consistent with this failure mode:

1. `OP-007 -> O-002` occupies the target approach at `y=395.5`.
2. `OP-003 -> O-002` originates at `y=395.5` and needs an obstacle-avoidance dogleg to the `O-002` target track at `y=363.5`.
3. Occupancy resolution moves the long internal horizontal part of `OP-003` down by one `ENDPOINT_SPACING` interval to `y=411.5` to separate it from the `OP-007` run.
4. `OP-004 -> O-002` already has its target approach at `y=411.5`.
5. `OP-003` and `OP-004` were not necessarily members of the same pre-displacement conflict component because their earlier coordinates were at the permitted 16px separation.
6. The late move creates the 32px collinear overlap.

At the final call site, the pipeline performs:

```text
prepared occupancy
  -> resolveOccupancyDisplacements
  -> build final route states with those displacements
  -> extract final occupancy
  -> emit final scene
```

It does **not** perform another resolve/rebuild cycle after extracting `finalOccupancyResult`. See `buildOutcomeOpportunityMapRoutingStages(...)` near the final calls to `resolveOccupancyDisplacements`, `buildRouteStatesForPlans`, and `extractGutterOccupancyByConnector`.

This is a working diagnosis, not permission to insert an arbitrary retry. The remediation thread should instrument or expose the prepared-versus-final occupancy state in a focused test to prove the exact displacement chain before choosing the algorithmic correction.

## Why Existing Focused Tests Did Not Prevent This

`outcomeOpportunityMapRouting.spec.ts` already checks:

- orthogonality and endpoint preservation;
- selected support-route vertical segment separation;
- minimum support corridor width;
- obstacle occupancy existence;
- separation within selected movable obstacle-local groups; and
- a relaxed maximum point count for `OP-003 -> O-002`, acknowledging one shared-width-induced dogleg.

Those checks do not apply the final all-semantic-edge, same-orientation separation invariant to this canonical route set. The broader visual harness does, which is why final verification caught the defect.

The remediation should add a focused regression that fails for the current final `OP-003`/`OP-004` overlap. Retain the broader visual-acceptance test as the diagram-level backstop.

## Remediation Requirements

The remediation must:

1. preserve the shared node's accepted 224px width and measured grow-height behavior;
2. preserve the staged boundary `projection -> RendererScene -> MeasuredScene -> PositionedScene -> SVG -> PNG`;
3. remain inside outcome-opportunity macro-layout/routing ownership unless investigation proves a genuinely shared routing abstraction is the right owner;
4. preserve existing semantic ports, endpoint identities, edge ordering, classes, labels, markers, bundle-driven behavior, and deterministic serialization;
5. preserve node-box avoidance and endpoint-box entry invariants;
6. keep required same-orientation separation at 16px subject only to the existing epsilon;
7. handle collisions created by displacement, not only collisions present in nominal occupancy;
8. consider all final geometrically competing segments even when they originated in different occupancy classifications, components, or local ownership passes;
9. converge deterministically with an explicit bound or a construction that guarantees a valid final assignment; and
10. produce an explicit diagnostic and stop if capacity is genuinely insufficient rather than silently emitting coincident routes.

Do not:

- special-case `multiple_outcomes`, `OP-003`, `OP-004`, `O-002`, or any current semantic ID;
- shrink, widen, or otherwise variantize shared nodes to restore the old route;
- move routing behavior into parsing, compilation, validation, projection, or SVG emission;
- introduce ELK or another external layout engine;
- weaken `expectSameOrientationSegmentsSeparated`;
- accept the overlap because identical strokes make it visually subtle;
- update goldens or rendered corpus artifacts before focused and broad acceptance pass; or
- treat a changed route shape as a regression solely because it differs from the old golden.

## Candidate Algorithmic Directions to Evaluate

These are investigation directions, not settled design decisions.

### Bounded fixed-point resolution

After applying a displacement map, rebuild routes, re-extract occupancy, and resolve any newly created conflicts until:

- no displacement changes;
- all final separation postconditions pass; or
- a deterministic iteration/capacity bound is reached and a diagnostic is emitted.

Risks to address include oscillation, cumulative displacement, locked-segment semantics, order dependence, and expansion requests based on intermediate rather than final coordinates.

### Component construction that anticipates displacement

Avoid freezing conflict components solely from nominal coordinates. A group-level assignment may place all span-overlapping tracks together, or component membership may account for coordinates reachable during the current displacement pass.

Risks include unnecessary spreading of unrelated segments and loss of compactness.

### Global final-segment postcondition and repair

Treat final axis-aligned segments as the postcondition domain, detect any collinear conflicts after all local ownership passes, and feed those conflicts into a deterministic repair/expansion mechanism.

Risks include disconnecting a moved segment from adjacent bends or violating local ownership/terminal constraints if repair is not performed through route-state reconstruction.

Whichever direction is selected must preserve the relationship between segment coordinates, adjacent bend coordinates, endpoint compaction, obstacle clearance, and global gutter expansion. Directly mutating one final polyline segment is unlikely to be safe.

## Required Regression Coverage

At minimum, add or strengthen tests that prove:

1. the current `multiple_outcomes` detailed rendering has no collinear overlap between any distinct semantic edges;
2. a displacement needed to resolve conflict A cannot create unresolved conflict B at the destination coordinate;
3. exactly-16px initial separation remains valid when neither entry moves;
4. a moved segment is reconsidered against entries originally outside its conflict component;
5. locked and movable entries interact predictably;
6. adjacent bends remain orthogonal and connected after any second-stage displacement;
7. routes do not enter node boxes or cross non-endpoint nodes;
8. results are deterministic across repeated runs; and
9. insufficient capacity produces an intentional diagnostic rather than overlap.

Prefer a small synthetic occupancy/route fixture for the algorithmic regression plus the canonical `multiple_outcomes` integration case. The synthetic case should not encode current semantic IDs.

## Verification Sequence

Run focused tests first:

```bash
TMPDIR=/tmp pnpm exec vitest run tests/outcomeOpportunityMapRouting.spec.ts
TMPDIR=/tmp pnpm exec vitest run tests/stagedVisualAcceptance.spec.ts
TMPDIR=/tmp pnpm exec vitest run tests/stagedOutcomeOpportunityMap.spec.ts
```

Then run any directly affected staged renderer and snapshot suites identified by the code change. Run the full repository test suite only after focused behavior is correct:

```bash
TMPDIR=/tmp pnpm test
```

Before changing goldens or corpus artifacts:

1. render the exact current `multiple_outcomes` detailed proof through the production staged path;
2. inspect SVG and PNG derived from that same SVG;
3. confirm the two affected connectors are visually distinct and readable;
4. confirm no replacement overlap, node crossing, cramped terminal, or label collision was introduced;
5. report satisfied and violated invariants explicitly; and
6. obtain visual acceptance if the remediation materially changes routing.

Only after those checks pass should affected renderer-stage goldens and public rendered examples be refreshed.

## Artifact Drift Warning

The committed public corpus artifact below is stale relative to the current shared-node renderer-stage output:

```text
examples/rendered/v0.1/outcome_opportunity_map_diagram_type/
  multiple_outcomes_example/detailed_detail/
  multiple_outcomes.outcome_opportunity_map.svg
```

It contains the pre-adoption separated routes at `y=378` and `y=426` and therefore does not reproduce the blocker. This stale artifact caused an incorrect visual to be shown during diagnosis.

Use the current production render or the current renderer-stage golden when reproducing the defect. After the routing fix is accepted, regenerate the affected public SVG and PNG from the corrected production path so the corpus no longer disagrees with the renderer-stage output. Do not refresh it earlier merely to make the defect visible.

## Completion Criteria

The remediation may be called complete only when all of the following are true:

- the focused visual-acceptance test passes unchanged;
- `OP-003__supports__O-002` and `OP-004__supports__O-002` no longer overlap;
- all distinct final semantic-edge collinear runs satisfy the existing minimum separation;
- no node-crossing, endpoint-entry, label, terminal-leg, or forbidden-diagnostic invariant regresses;
- the chosen resolution is deterministic and generic rather than ID-specific;
- focused outcome-opportunity routing and renderer-stage suites pass;
- the final SVG and derived PNG receive visual inspection before artifact refresh;
- affected goldens are refreshed only as evidence of the passing behavior;
- the stale public outcome-opportunity corpus artifacts are regenerated after acceptance; and
- this handoff and the shared-node implementation status are updated from **managed/unresolved** to **resolved**, with the remediation approach and tests cited.
