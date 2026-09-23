# Scenario Flow clearance handoff repair

## Existing contract and reproduced loss

The placement policy remains in `bundle/v0.1/core/views.yaml`. This repair changes
renderer geometry mechanics, not projection, transition placement, or port permissions.
The existing final-route ownership and finite budgets in `design_decisions.md` remain.

Scenario preparation already builds 16px terminal stubs, 18px obstacle detours,
obstacle occupancy, and clearance-driven expansion. Tests in
`scenarioFlowRouting.spec.ts` already assert 18px on the wide-detour proof cases.

Tracing `tmp.sdd` with its former parked placement reproduced the missing handoff:
`VS-050 -> VS-060` was clear of `VS-006` before shared final routing, but accepted
repair put its horizontal run at Y=1398, exactly the top of `VS-006`. The final
context carried raw rectangles without their stand-off requirement. Candidate
generation proposed their borders, and interior-intersection validation accepted them.
This was not a missing detour algorithm.

## Repair

`RoutingBox.clearance` carries an adapter's existing obstacle margin through shared
candidate generation, validation, and expansion. Scenario supplies its existing
16px minimum spacing; its 18px detour construction remains intact. Other adapters
do not supply the field and retain their existing behavior. No new bundle policy
or shared default clearance is introduced.

The original node boundary still owns the attachment point. Only its incident
terminal leg can traverse its clearance envelope. Subsequent runs must clear the
source and target just as they clear unrelated nodes. Raw-box re-entry and marker
checks remain separate. Expansion cannot discard or reduce an obstacle margin.

Clearance-aware corridor recovery compares candidate tracks with settled routes,
rather than independently choosing the first node-safe corridor for every connector.
It retains the existing corridor generator, final coordinator, and search budgets.
Whole-route validation still decides acceptance; the recovery ordering is a heuristic.

A second missing connection became visible in the compact canonical branching
example. An obstacle detour and an endpoint track shared a 44px gap. Together they
require 48px: two 16px node margins and one 16px track separation. The existing local
expansion check compared only obstacle-owned tracks with each other.

The shared `measureRoutingCorridorDeficits` helper measures simultaneous physical
tracks regardless of their preparation ownership. Scenario passes the resulting
measured deficit to its existing row/column expansion owner, within its existing
eight-pass total ceiling. Sequential runs are not counted as simultaneous tracks;
explicit shared-track groups are counted once. No second expansion loop is added.

Lane dividers previously participated only in label placement. Scenario now passes
them to final routing with the same 16px clearance. A global horizontal barrier
keeps all parallel runs away from each divider while permitting vertical crossings.
A second barrier keeps long backward same-lane links and backward links into a
later row within their lane. Cross-lane connectors retain legal divider crossings.
The shared obstacle contract expresses the second barrier with
`appliesToConnectorIds`, which is retained by candidate generation, final validation,
and expansion. The frozen production proof checks both horizontal clearance and
ViewState transition containment against the emitted geometry.

## Regression evidence

- `tests/fixtures/render/scenario_transition_clearance.sdd` freezes the user's
  document. `scenarioFlowClearance.spec.ts` checks all eight detail/decorator
  combinations, retained transition placement, final emitted geometry, independent
  node distance, and independent parallel-conflict detection. A ninth case restores
  the formerly parked arrangement and verifies the same clearance guarantees.
- `routingNodeClearance.spec.ts` checks boundary contact, transposed geometry,
  endpoint re-entry margins, deterministic repair, unchanged callers without
  margins, finite failure, and margin preservation during expansion.
- `routingCorridorCapacity.spec.ts` checks both axes, mixed tracks, simultaneous
  occupancy, sharing, and intervening obstacles.
- The existing Scenario production matrix and 18px wide-detour tests remain gates.
  The compact canonical gate now asserts actual corridor capacity instead of
  requiring the final solver to perform bend repair after preparation.

The user's detailed/type,id CLI render succeeds without `--force`; a second run
produces a byte-identical SVG. Canonical Scenario stage snapshots and visual
acceptance checks pass. Other renderers' staged snapshot checks pass unchanged.

The Outcome production test's saved canvas-height assertion fails at 1066px versus
977px on both the pre-repair commit `a5b36da` and this repair. It is an existing
fixture mismatch; its fixture and assertion are left unchanged.

Two Scenario spacing tests also fail their existing 1508×880 canvas assertion
on the pre-repair commit (actual 1808×1300). With this repair the canvas is
1840×1306. Those assertions remain unchanged; later assertions in those two tests
are not reached. Separate production routing, visual acceptance, and middle-layer
tests pass. These three baseline failures prevent claiming an entirely green suite.
