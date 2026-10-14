# IA forward routing with movable source ports

Status: proposed policy, 2026-10-13. This document designs the change; it does not
enable it in the bundle or implement it in the renderer.

This is the forward-routing branch of the
[coordinated response to manual review 2](manual_review_2_followup_plan.md).
Establish its comparison baseline after that plan's export-margin corrections,
presentation-part measurement, and required backward-loop policy. Its expansion
restriction applies only to extra demands from the optional forward shortcut.

## Decision

Keep centred attachments as the default. Allow a forward navigation connector to
move its source attachment along the bottom edge when that produces a clean
two-segment bottom-to-left route and reduces the complete scene's bend count,
without adding crossings or requiring extra layout expansion. Choose the feasible
attachment closest to the bottom midpoint. Keep the target attachment under the
ordinary centred-port policy.

This is a specific exception to ordinary group symmetry: an admitted movable
source is allocated separately from the ordinary group, but still observes the
same inset, port separation, ownership, and painted-clearance requirements. It
must not pull another connector's attachment away from a good direct route.

## Authority and invariants

| Source and role | Requirement |
| --- | --- |
| [AGENTS.md](../../AGENTS.md), architecture and bundle authority | Geometry remains downstream of projection; shared geometry belongs in shared routing. New view conventions must be represented in the loaded v0.2 bundle. Preserve v0.1 and LEGACY paths. |
| [v0.2 view bundle](../../bundle/v0.2/core/views.yaml), machine authority | Preserve hierarchy, authored order, navigation occurrence identity, fusion, labels, and routing ownership. The proposed opt-in belongs under `renderer_defaults.ia_place_map.navigation`. |
| [Current IA contract](../diagrams/ia-place-map.md#final-acceptance), acceptance | Preserve painted clearance, legal ports, complete labels, owner/export bounds, and the prohibition on ordinary navigation track sharing. Complete scenes compete; isolated edges do not establish acceptance. |
| [Shared allocation contract](../diagrams/shared-routing.md#opt-in-ownership-and-readable-geometry), current default | Keep ordinary singleton centring, symmetric groups, fixed reservations, and facing-side reconciliation. Movable sources are an explicit new allocation class. |
| [Manual review](manual_review_2_routing_quality.md), requested direction | Prefer the intuitive downward departure and left arrival when it is clean and simpler. |
| [Pre-hardening BillSage SVG](../../real_world_exploration/billSage_example/billSage_simple_structure.ia_place_map.detailed.svg) and [canonical v0.1 SVG](../../examples/rendered/v0.1/ia_place_map_diagram_type/place_viewstate_transition_example/detailed_detail/place_viewstate_transition.ia_place_map.svg), visual exemplars | Recover the bottom-to-left reading direction. Their exact coordinates and shared trunks do not override current acceptance. |

The historical BillSage paths to `P-220` and `P-230` both start at `(336,146)` and
share a vertical run. The new policy must retain distinct navigation ports and
tracks. In particular, preserve the current straight `P-210 -> P-220` route while
considering a separate bottom-to-left shortcut for `P-210 -> P-230`.

## Eligibility and admission

An occurrence is eligible when all of the following hold:

1. It is independently routed navigation, rather than a structural/fused edge,
   fixed run, or self-loop.
2. Both endpoints have the same selected routing owner, with enough existing
   owned space. Compare their selected containing owners, not just their common
   ancestor: two different Areas sharing root remain cross-owner. Root may own
   both uncontained endpoints. Cross-owner and backward routes are ineligible for
   this exception and still receive the coordinated plan's other corrections.
3. The target lies wholly below the source, with room for a positive outward
   source leg, and the configured perpendicular side pair admits an outward
   one-turn route. For bottom-to-left this means descending first, then travelling
   right into the target's left edge.
4. The target's ordinary port allocation is feasible. Its midpoint is used for
   an unreserved singleton; ordinary grouped/reserved target ports retain their
   existing allocation rules. Only the source becomes movable.

Let `B` be the best fully accepted ordinary revision examined on the current
measured layout, ranked by the existing complete-scene costs, and `F` a complete
revision containing proposed shortcuts on that same layout. Here "ordinary"
means no movable forward sources; it includes the coordinated plan's enabled
margin, wrapping, facing-alignment, and loop policies. Use the normally selected
baseline, without forcing extra bends to make an exception qualify. Admit `F`
only when:

- Every shortcut has exactly two positive-length, perpendicular segments after
  duplicate-point/collinear normalization: one bend, the minimum possible for
  these perpendicular attachment sides. Its corresponding edge in `B` has more
  than two segments. Straight and existing one-bend routes are protected.
- `crossings(F) <= crossings(B)` and `bends(F) < bends(B)` for the complete route
  inventory. A zero-crossing baseline must therefore remain zero-crossing.
- For every other connector with zero or one bend in `B`, its bend count in `F`
  is at most its own count in `B`. In particular, a straight route must remain
  straight; merely remaining within the one-bend category is insufficient.
- No additional gap or owner padding is required relative to `B`. The shortcut
  must fit the layout already justified by ordinary routing and labels.
- Every existing final audit passes, including labels, marker geometry, endpoint
  directions, insets, port spacing, route separation, node/header clearance, and
  complete painted owner/export bounds.

An ordinary revision that fails acceptance cannot certify the exception. Continue
the normal bounded routing/reflow process; once an accepted baseline exists,
compare shortcuts in that geometry. Absence of a legal shortcut is an ordinary
fallback, not a renderer error.
The BillSage acceptance cases below still require an actual selected shortcut;
a runtime fallback or exhausted search does not complete those proof gates.

## Source placement

For a bottom-to-left candidate, let the source rectangle be `S`, the target's
allocated west attachment be `T = (tx, ty)`, and `x` the movable source coordinate.
The entire route is:

```text
(x, S.bottom) -> (x, ty) -> (tx, ty)
```

Compute feasible intervals of `x`, rather than sampling arbitrary pixel offsets:

1. Start with `[S.left + sourceInset, S.right - sourceInset]`.
2. Require `ty > S.bottom` and `x < tx`; apply the existing endpoint minimum legs,
   corner/inset policy, and marker envelope to both segments.
3. Intersect with the existing owner's legal content envelope, including paint
   and parallel-border stand-off.
4. Subtract intervals blocked by the swept vertical leg and horizontal arrival:
   node bodies, headers, applicable container borders, fixed structural runs,
   other routes, and measured labels. Use shared incident-endpoint exceptions;
   there is no whole-path clearance exemption for either endpoint node.
5. Exclude attachment intervals that violate paint-aware pitch to any occupied
   source port, including incoming ports and used structural reservations.

Build these intervals against the candidate revision. Remove superseded routes
of the occurrences being replaced; do not treat their old paths as obstacles to
their replacements. Recompute affected intervals when other provisional routes
or labels move, and always validate the complete result.

For every remaining interval, propose the projection of the source midpoint onto
that interval. Also expose geometry events needed for complete-scene compatibility
(interval endpoints and route/label clearance boundaries). Rank fully accepted
equal-quality placements by absolute source displacement, then length and stable
identity. Nearest feasibility refers to the complete accepted scene, not just
node avoidance. Empty intervals produce no shortcut.

All margins come from shared theme-aware geometry. There is no additional fixed
percentage-of-width displacement cap: the legal side inset already bounds the
motion, and the strict bend improvement justifies using its full usable span.
Increasing stroke/marker size must shrink feasible space rather than weakening
clearance. A tolerance is used for numerical comparisons, not to intentionally
place paint inside required margins.

## Multiple connectors and centring

For each proposed shortcut set, assign the configured source/target sides, remove
its sources from ordinary symmetric groups, and move its target requests into
the new target-side groups. Recompute affected ordinary groups with existing
fixed reservations and facing-side reconciliation, then freeze those attachments
for the trial. The target's *side* may change, but its *offset allocation* remains
ordinary. Allocate movable sources jointly against the resulting attachments
and each other; count all incoming/outgoing requests once.

This permits an ordinary centred/facing attachment and a separately movable
attachment on the same side. Do not translate the entire source group toward the
left corridor: that would destroy BillSage's straight Overview-to-Projection route.
Do not inflate port pitch for label width or merge navigation trunks.

For several left arrivals from one source, use geometric target order: a route
ending farther down uses an outer, more leftward track than a nearer route when
their spans overlap. Shared pitch and complete validation decide whether they fit;
authored occurrence order breaks geometric ties. Enumerate both singleton
shortcut sets and bounded joint sets. If the corridor accommodates only one,
retain ordinary routing for the others. No port squeezing or shared vertical run
is allowed.

Measure displacement per movable attachment from its side midpoint. Retain the
ordinary group's existing displacement metric, but do not let a group's centroid
hide two large opposite source movements.

The coordinated self-loop policy uses ordered same-side pairs and ordinary
reservation-driven translation. It does not inherit this forward-only exception
or its strict bend-improvement admission test.

## Selection, search, and fallback

Retain complete-scene ranking by crossings, bends, required expansion, displacement,
length, and stable identity. Admission supplies the stronger no-extra-expansion
gate for movable sources; displacement remains after bends, so a useful one-bend
shortcut can beat a centred two-bend detour. Equal-bend cosmetic alternatives do
not earn an off-centre exception.

Find and retain an accepted ordinary baseline before exposing bounded shortcut
trials. Reserve part of the existing live allowance for those trials and final
audits. Attachment interval evaluations, joint port trials, label probes, and
route comparisons consume the same 4,096 candidate / 128 repair / four expansion
pass allowance. No second solver budget and no exhaustive subset promise.

Do not repair a failed shortcut into a longer path and retain its movable-port
privilege. Either it passes the two-segment admission rule or ordinary routing
wins. Recompute intervals and all attachments after any ordinarily justified
reflow. If search stops, return the best fully audited revision and expose the
existing comparison-limit warning when appropriate; never claim global optimality.

Evidence should record the baseline revision, affected occurrence IDs, legal
intervals, source midpoint/chosen offset/displacement, before/after scene costs,
and explicit rejection reasons. An admitted exception is normal output and needs
no warning merely for being off centre.

## Bundle contract and module seam

Proposed addition to `bundle/v0.2/core/views.yaml`, inside the existing IA
`navigation` object:

```yaml
routing_preferences:
  forward_shortcut:
    scope: same_owner
    progression: { axis: y, direction: positive }
    side_pairs:
      - { source: south, target: west }
    source_offset: nearest_feasible
    admission: fewer_scene_bends_without_extra_crossings_or_expansion
```

This fragment is a proposed schema, not currently loadable bundle data. Omission
retains current behavior. Enabling it requires matching routing ownership.
The loader must validate shape, supported discriminators, unique perpendicular
side pairs, and compatibility of the source direction with progression; reject
unsupported values. Different configured side pairs must change proposals through
generic vector/interval geometry, rather than a hardcoded IA south/west branch.

The implementation path is:

`loadBundle` / `validateLoadedBundle` -> `RendererIaPlaceMapConfig` ->
`buildIaPlaceMapRendererScene` -> copied `ViewMetadata.iaPlaceMap` routing preferences
-> `runIaPlaceMapRendererPipeline` -> shared constrained attachment proposals ->
`selectRoutingQuality` -> `auditIaPlaceMapFinalScene` / SVG acceptance.

Extend `src/bundle/types.ts`, `src/bundle/validateLoadedBundle.ts`, and the scene
metadata copy contract in `src/renderer/staged/contracts.ts` before enabling the
bundle field. The scene carries policy intent only, never feasible intervals,
coordinates, or final paths. Keep ordinary `allocatePortOffsets` behavior intact.

Put interval construction and joint movable-port feasibility behind a shared
module interface accepting measured endpoint geometry, occupied ports, routing
context, configured side pairs, and a live budget. Return coherent attachment/route
proposals plus rejection evidence. IA supplies occurrence eligibility and ownership;
the shared module owns geometry. Extend shared selection with an optional
baseline-comparison admission callback; existing callers retain their behavior.
Audit the resulting exception independently of its proposal generator.

Retain an immutable downstream baseline witness with the relevant endpoint/route,
label, marker, and layout geometry. Final acceptance, including the SVG backend's
repeat audit, must recompute the baseline and proposed costs and verify admission
from that witness; recorded cost numbers or a `movable` flag are not sufficient
authorization. Bind it to the same occurrence inventory, loaded policy, measured
labels, and layout as the proposed scene; reflow invalidates it and whole-scene
translation must transform it coherently. Retain a finite baseline witness,
without recursive copies of earlier search histories.

Audit ordinary allocation against all existing legitimate exceptions: structural
reservations, facing-side reconciliation, and the coordinated loop-pair policy.
An unconditional midpoint/symmetry assertion would reject the intentionally
aligned `P-210 -> P-220` ports. Independently check each movable source's inset,
pitch, displacement, topology, and admission. The witness belongs to positioned
routing evidence, never projection or `RendererScene`.

## Acceptance before implementation evidence

1. **BillSage proof first within this branch:** compact/detailed, plain/type-id.
   Use `tests/fixtures/render/billSage_structure.sdd` and
   `real_world_exploration/billSage_example/billSage_simple_structure.sdd` under
   the loaded v0.2 bundle. `P-210 -> P-230` has
   south/west attachments and exactly two segments; `P-210 -> P-220` stays straight.
   Zero crossings, distinct bottom ports, complete occurrence coverage, no new
   expansion relative to the corrected ordinary baseline, and all painted-clearance,
   label, and ownership audits pass. Preserve eight connectors, including all
   three returns, in each source's combined selection.
2. **Independent interval proof:** in the current plain compact evidence, the
   logical source left edge is 312, width 224, and target/intervening Place left
   edge is 360. The current card port inset is 12px (the root's 16px port inset is
   a different token). With the 17px centreline-to-node margin, the raw inset and
   intervening-node constraints give `x` in `[324,343]`; midpoint 424 projects to 343.
   The candidate is `(343,146) -> (343,469) -> (360,469)`. This is a geometric
   hypothesis, not an accepted render: corner geometry, other routes, labels,
   markers, and owner paint bounds must be checked independently. Values come from
   evidence and theme geometry; production code must derive them.
3. **Admission failures:** blocked corridor, crowded port, border stand-off,
   additional crossing, no net bend improvement, extra label expansion, or
   damage to a straight companion all retain an audited ordinary route.
4. **Joint cases:** multiple near/far destinations, parallel occurrences, incoming
   reservations, occupied west targets, fixed structural ports, and a corridor
   too narrow for two shortcuts. Verify order, spacing, subset fallback, and
   per-attachment displacement with independent geometry assertions.
5. **Authority and stability:** remove/mutate the bundle policy through the real
   loader and demonstrate changed candidate behavior. Exercise detail/decorators,
   changed fonts/strokes/markers, translation, reflow, repeated states, and depleted
   budgets. Check v0.1, LEGACY, and unrelated renderer compatibility.
6. **Visual acceptance:** inspect the cited proof SVGs at normal scale before any
   golden refresh. Report satisfied and violated invariants explicitly; an interval
   calculation or green tests alone do not establish acceptance.

Design assessment: the proposed exception explicitly replaces symmetry only for
admitted movable sources; clearance, ownership, occurrence integrity, and good
direct routes remain required. Runtime and visual acceptance are still unproven
until implementation and the above proof cases pass.
