# Outcome-Opportunity Map Routing — Diagnosis & Fix Handoff

08-20-26

## 1. Artifacts under discussion

| Role | File |
|---|---|
| Routing implementation | `outcomeOpportunityMapRouting.ts` (~5034 lines) |
| "Good" canonical example | `multiple_outcomes.sdd` → `examples/rendered/.../multiple_outcomes.outcome_opportunity_map.svg` |
| "Bad" original case | `sdd_for_sdd.sdd` → `sdd_for_sdd.outcome_opportunity_map.simple.svg` |
| Reduced case A (I-012 disabled) | `sdd_for_sdd_simplifiedA.sdd` |
| Reduced case B (I-012 + I-010 disabled) | `sdd_for_sdd_simplifiedB.sdd` |

The `outcome_opportunity_map` view routes four channels; the failing one is `initiative_addressing` (Initiative → Opportunity, source side `east`, target side `west`).

## 2. What the three cases show

**Original (`sdd_for_sdd`)** — 8 addressing connectors, OP nodes 48px tall at x=507.336. Two collinear overlaps: `I-030→OP-010`'s long vertical (x=443.336, y 138–682) overlaps `I-012`'s stem (x=443.336, y 98–298), and its x=459.336 segment overlaps `I-011`'s stem (x=459.336, y 82–202). Endpoints land on the node's top/bottom corners (y=66/82/98/114).

**simplifiedA** — 7 connectors, OP at x=539.336. Still a collinear overlap at x=491.336 (`I-030→OP-010` y 106–586 vs `I-030→OP-020` y 226–250), plus a crossing at (443.336, 250).

**simplifiedB** — 6 connectors, OP at x=475.336 (narrowest gutter, 213px). No overlap, but `I-020→OP-020` crosses `I-021→OP-020` twice: at (411.336, 202) and (427.336, 194) — a "staircase" crossing caused by lane-order reversal.

**Key correction to the "threshold" hypothesis:** simplifiedB's gutter is the *narrowest*, not the widest. The clean/dirty boundary is driven by **connector count**, not gutter width. The left ~130px of the gutter is empty in *all three* cases.

## 3. Root cause (single function, two responsibilities)

The target-adjacent vertical lanes of `initiative_addressing` connectors are owned by **`resolveTargetEdgeLocalCompaction`** (line 2974), not by the bridge/displacement passes. Evidence:

- `buildEdgeLocalOccupancyForEndpoint` (2339) classifies the segment adjacent to the target node as `edge_local` with `endpointRole: "target"`.
- `resolveTargetEdgeLocalCompaction` (2974) consumes those entries and writes into `endpointCoordinateByEndpointKey` / `segmentCoordinateBySegmentKey`.
- `buildFinalRoute` (4196) consults `bundleSegmentCoordinateBySegmentKey` **before** `displacementBySegmentKey`, so this pass wins over `resolveOccupancyDisplacements` (3441) for these lanes.

Inside `resolveTargetEdgeLocalCompaction`, two defects:

1. **Lane assignment (→ overlap).** Lanes start at `getObstacleLocalBaseCoordinate(node, "west")` = `node.x − 16` (line 437) and push **outward/leftward by 16px** each (`buildAssignedCoordinatesForOrder`, ~line 3120). It never consults the full gutter width, so lanes cluster against the node and, past a count, reuse a lane.

2. **Lane ordering (→ staircase crossing).** For `initiative_addressing` it sorts by `compareByTargetEndpointOrder` (`shouldOrderComponentByTargetEndpoint`, ~line 3070) and assigns lanes in that order — but the assignment direction (outward from node) is the *reverse* of the natural top-to-bottom fan order, so the top connector gets the rightmost lane and threads back across the connector below. The crossing-minimization machinery (`chooseCrossingMinimizedOrder`, `remapSameTargetCrossingMinimizedCoordinates`) exists but is gated to `opportunity_support` via `shouldOrderComponentByCrossingScore` (~line 3090), so `initiative_addressing` never gets it.

**Secondary contributor:** `buildPreferredEndpointSideOrderOverrides` (1571) controls the endpoint **y-order** on the node side; it must stay consistent with the lane **x-order** for a crossing-free fan.

## 4. Why the earlier-proposed levers are wrong

- **`resolveBridgeX` (912)** only sets the *nominal* `step3Route` template; the final lane coordinates come from the bundle/compaction/displacement maps that override it. Spreading turn coordinates there would not survive to output.
- **`resolveOccupancyDisplacements` (3441)** is the wrong pass for these lanes (see §3), and making it bidirectional would not fix the addressing overlap.

## 5. Recommended solution

Fix **`resolveTargetEdgeLocalCompaction`** (2974) to do two things for the `initiative_addressing` west-side fan:

1. **Spread lanes across the full gutter width** — replace the "start at `node.x − 16`, push leftward" assignment with one that distributes lanes across the available gap between the Initiative column right edge and the Opportunity column left edge (the `column:0:right` gutter rect already modeled in `buildGutterRects`/`buildPhysicalGutterOccupancy`). This eliminates lane reuse (overlap) regardless of connector count.

2. **Order lanes monotonically with connector order** — assign lanes so the top-to-bottom connector order maps to a consistent left-to-right (or right-to-left) lane order, and extend the existing crossing-minimization (`chooseCrossingMinimizedOrder`) to `initiative_addressing` (currently gated to `opportunity_support`). This eliminates the staircase crossing.

3. **Keep `buildPreferredEndpointSideOrderOverrides` (1571) consistent** with the new lane order so endpoint y-order and lane x-order don't fight.

### Verification plan (no code yet)

- Re-render `sdd_for_sdd.sdd`, `sdd_for_sdd_simplifiedA.sdd`, `sdd_for_sdd_simplifiedB.sdd` and confirm: no collinear vertical overlaps, no staircase crossings, endpoints within node side bounds.
- Re-render `multiple_outcomes.sdd` (the canonical "good" case) and confirm **no regression** — its `supports`/`measured_by` fans must remain unchanged.
- Confirm the left gutter is actually used (lanes spread) rather than clustered against the node.

### Acceptance invariants (from `AGENTS.md`)

- Behavior must flow through the bundle (`v0.1`) and generic runtime, not hardcoded keyword lists — the fix is in the generic routing machinery, which is correct, but any new constants/thresholds should be bundle-owned if they encode spec behavior.
- Do not update snapshots/goldens until the cited invariants (no overlap, no staircase crossing, no regression to `multiple_outcomes`) are satisfied.
- Preserve deterministic ordering and the staged pipeline (`projection → … → SVG`); this is a routing-layer change only.