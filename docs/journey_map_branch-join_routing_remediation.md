# Journey Map Branch-Join Routing Remediation

8-26-26

## Summary

Complete Journey Map branch stacking by carrying persistent branch lineage from placement into routing. Support three-way, uneven, and nested common joins without changing source-order semantics, disconnected-component behavior, or the established two-way diamond geometry.

This is Journey-specific remediation informed by Scenario Flow, not a cross-renderer rewrite.

## Implementation Changes

- Extend the Journey middle layer with backend-agnostic branch metadata:
  - Stable lineage ID and branch path for every stacked Step.
  - Branch-group catalog containing split, targets, optional join, entry/return lineage, source-ordered arm ordinals, and visual row/column envelope.
  - The first arm inherits the split’s lineage; subsequent arms receive nested lineage paths.
  - A join explicitly returns to the split’s entry lineage; nested joins resolve from the innermost group outward.
- Add edge-level route intent:
  - `continuation` for edges within one lineage.
  - `fork` for departures into another lineage.
  - `join_return` for noncanonical arms returning to the join lineage.
  - Preserve authored edge identity and ordering unchanged.
- Route using visual lineage rather than source adjacency:
  - Allow same-lineage continuation to remain horizontal across empty visual columns. This fixes cases such as `J-210 → J-290`.
  - Keep existing fork routing for stacked arms.
  - Route `join_return` edges east from the terminal arm, horizontally to a reserved track in the gap before the join, vertically toward the join row, then west into the join.
  - Allocate join tracks monotonically: top-to-bottom arm order maps left-to-right across the pre-join gap, with matching target endpoint order.
  - Preserve the current constrained-diamond route path before applying generic branch-join logic, keeping its geometry and edge identities unchanged.
- Integrate join corridors with existing Journey occupancy and expansion:
  - Record join-track claims as normal routing resources.
  - Use existing Stage progression-gap or root-item-gap expansion when the pre-join gap cannot provide required separation.
  - Revalidate resolved routes after displacement. A new node intersection must trigger an alternate join-track assignment or bounded expansion, not only a terminal diagnostic.
  - Emit the existing hard routing error only after the current bounded expansion limit is exhausted.
- Leave unsupported topology on the existing silent `source_row` fallback. Open branches, cross-scope edges, disconnected source-sequential content, and `branch_placement: inline` retain current behavior.

## Interfaces and Compatibility

- Extend `JourneyMapItemMetadata`, `JourneyMapEdgeMetadata`, and `JourneyScenePlacement` with lineage, branch-group, and route-role data; deep-clone new arrays and group records through scene stages.
- Add no SDD syntax, projection, bundle-policy, CLI, or diagram-instance changes. Existing `journey_map_layout.branch_order: source` remains the ordering authority.
- Do not register any candidate SDD as a canonical example or corpus artifact.
- Preserve unrelated working-tree content, including the untracked cross-renderer routing document.

## Test Plan

- Add reduced inline integration fixtures—not new `.sdd` artifacts—for:
  - Three unequal arms with a common join.
  - Nested inner and outer joins.
  - Two-way join, three-plus-way join, sequential joins, and root-level joins.
  - Insufficient pre-join space that requires deterministic expansion.
- Assert:
  - Canonical-arm joins use direct horizontal continuation across empty columns.
  - Lower-arm joins use ordered pre-join tracks and west-side arrivals.
  - No connector intersects a non-endpoint Step, enters endpoint boxes, overlaps another track, or retains an unmarked crossing.
  - Nested joins return to the correct parent lineage.
  - Repeated renders are byte-deterministic.
- Confirm unchanged behavior for:
  - Existing simple branching-journey SVG geometry and edge identities.
  - The topology-challenge open branches.
  - Inline policy, linear journeys, duplicate authored edges, unsupported fallbacks, and disconnected source-sequential content.
- Run focused middle-layer, Journey routing, staged-renderer, and visual-acceptance tests in compact and detailed modes. Do not refresh goldens to conceal regressions.
- Finish with the full suite using `TMPDIR=/tmp`.

## Assumptions

- The first source-ordered arm is the canonical continuation and owns the join’s return lineage.
- Visual branch metadata may contain columns, rows, lineages, and envelopes, but never final coordinates or SVG-specific data.
- Shared geometry and solve–validate–repair extraction remains future cross-renderer work; this change may reuse existing helpers but will not begin a broad router consolidation.
