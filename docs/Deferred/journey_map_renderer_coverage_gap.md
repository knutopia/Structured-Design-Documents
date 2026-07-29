# Journey Map Renderer Coverage Gap

Status: Deferred  
Recorded: 2026-07-28

## Summary

The staged `journey_map` renderer stacks branch options only when the
middle layer recognizes an exact same-Stage diamond:

`split → two or more contiguous options → common join`

Valid Journey Map topologies outside that shape currently fall back to
linear placement. In particular:

- a fan-out whose options do not rejoin;
- a fan-out whose options join in a later Stage;
- a branch where one option terminates and another continues.

This is a renderer coverage gap, not incomplete renderer execution. The
staged preview runs through final positioning and routing, but the middle
layer does not classify these shapes as diamond groups.

## Evidence

- `JM-RM-03` was accepted for the exact proof edges
  `J-201→J-202`, `J-201→J-203`, `J-202→J-204`, and
  `J-203→J-204`. See
  [`journey_map_visual_remediation_comparison_record.md`](../Done/%5BDone%5D%20journey_map_renderer_implementation/%5BDone%5D%20journey_map_visual_remediation_comparison_record.md#jm-rm-03--simple-diamond-stacks-options-and-minimizes-turns).
- `recognizeDiamondAt(...)` in
  [`journeyMapMiddleLayer.ts`](../../src/renderer/staged/journeyMapMiddleLayer.ts)
  requires the split, contiguous options, and following join to be members
  of the same Stage. Each option must have exactly one incoming edge from
  the split and exactly one outgoing edge to the common join.
- When recognition fails, the same middle layer assigns every affected
  Step `laneOrder: 0` with `placementRole: "linear"`.
- The focused `JM-RM-03` visual-acceptance test remains green, so the
  accepted same-Stage diamond behavior has not regressed.

## Impact

Authors can express these topologies with valid `PRECEDES` edges, but
branch options may appear sequentially in one row. Routing can therefore
require longer peripheral paths or crossings even though a stacked
presentation would be clearer.

Validation does not report this because the graph is semantically valid;
the gap belongs to renderer placement coverage.

## Deferred Work

Before implementation, decide which additional shapes should receive
stacked placement:

1. fan-out-only branches;
2. cross-Stage diamonds;
3. mixed terminal/continuing branches.

Then:

- add focused fixtures and visual-acceptance invariants for each selected
  topology;
- extend the Journey Map middle-layer placement model without changing
  parser, compiler, validator, or projection semantics;
- preserve the accepted `JM-RM-03` same-Stage diamond geometry;
- verify deterministic ordering, minimal-turn routing, Stage ownership,
  and diagnostics at final positioned-scene and SVG/PNG stages.

