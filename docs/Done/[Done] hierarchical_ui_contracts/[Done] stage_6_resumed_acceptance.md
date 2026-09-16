# [Done] Stage 6 resumed: visual corrections and accepted limitation

Status: accepted for Stage 7. The five original transition failures and the
additional visual issues have been corrected. The user explicitly accepted
long-ID overflow for this port and requested a future `(long ID)` replacement
outside its scope. Shared semantic-node rendering remains unchanged.

## Authority and implementation boundary

The [implementation plan](staged_ui_contracts_b5_implementation_plan.md) governs
semantics, staged execution and the frozen shared-code boundary. The user's
[Stage 6 visual guidance](stage_6_visual_issues_solutions.md), including its local
Figma exports, supplies the return-channel, sibling-enclosure and arrow treatment.
Figma MCP returned its plan/tool limit, so the supplied local exports were used.

No placement, routing, repair, validation, spacing, semantic-node measurement,
font or theme algorithm changed. Return and branch geometry is represented by
scene containers, measured padding, typed ports and independent connector
segments. The existing pipeline positions and routes all of those segments.

The requested SVG import correction adds a narrow paint dispatch for sheets
marked with UI-contract metadata. Its view-owned painter emits the existing
arrow geometry as ordinary filled SVG paths. Unmarked sheets retain their
existing marker paint. Actual Figma import remains unverified; native SVG/PNG
and marker-independent arrow presence were checked.

## Corrected visual cases

| Case | Accepted treatment | Evidence (`detailed`, `type,id`) |
| --- | --- | --- |
| Branch | One source, separate labeled branches, each bar segment painted once | [SVG](implementation_evidence/stage6_resumed/branch.detailed.type-id.svg) |
| Merge | Independently labeled incoming transitions, segmented bar and one arrival arrow | [SVG](implementation_evidence/stage6_resumed/merge.detailed.type-id.svg) |
| Diamond | Horizontal source/branch/target columns with distinct fork and merge bars | [SVG](implementation_evidence/stage6_resumed/diamond.detailed.type-id.svg) |
| Cycle | Horizontal forward sequence and an explicitly reserved return region above it | [SVG](implementation_evidence/stage6_resumed/cycle.detailed.type-id.svg) |
| Self-loop | Above-node return region with clear east departure and west arrival | [SVG](implementation_evidence/stage6_resumed/self_loop.detailed.type-id.svg) |
| Hierarchy siblings | One shared sibling enclosure; alternating inset and `#f1f5f9` hierarchy bodies | [SVG](implementation_evidence/stage6_resumed/three_parents_children.detailed.type-id.svg) |

Return relationships are selected in semantic traversal order before layout and
owned by the outer reservation region. Forward transitions remain in the native
horizontal layered group. Thus the return edge does not collapse the sequence
into one strongly connected layout rank. Every return segment retains the
authored relationship identity; only the horizontal segment carries its label.

The child legs in multi-child neighborhoods now reserve 18px instead of 12px,
leaving visible room behind the arrowhead. The twelve focused B5 comparisons
allow precisely that approved six-pixel downstream translation. Other node,
connector and label geometry still matches; the 33px-stem and 11px-branch negative
controls remain rejected. Immutable B5 inputs and positioned records were not
rewritten.

The topology matrix also covers disconnected sequences, nested reuse and deeper
hierarchies, disconnected roots, duplicate names, source-order edits, missing
author-order metadata, multiple composition targets, a Component reused by
ViewStates, parallel binding fields, contracts from supporting sources, empty
Places and empty projections. Long names, descriptions, attribute values and
transition annotations pass. All fifteen fixture families are exercised in all
eight detail/decorator combinations. The separate two-step/five-step comparison
still proves that local composition, description and contract rectangles remain
fixed relative to the scope origin.

Identity and relationship coverage are checked separately from occurrences and
routed segments. Independent shared routing validation has no exemptions.
Container headers remain measured before placement, with complete outlines and
flat lower band edges. Normal-size PNGs of cycles, self-loops, diamonds, the
three-parent/three-child hierarchy, nested reuse and long content were inspected.

## Accepted limitation: long semantic IDs

The valid [long-ID input](implementation_evidence/stage6_resumed/long_ids.sdd)
uses `C-123456789012345678901234567890` and its child. It compiles, projects and
[validates with the simple profile](implementation_evidence/stage6_resumed/long_ids.validation.json)
without errors or warnings. The required renderer combinations fail as follows:

| Detail | Decorators | Result |
| --- | --- | --- |
| compact and detailed | none or type | Pass |
| compact and detailed | id | Shared-node decorator exceeds its available text width |
| compact and detailed | type,id | Decorator text extends outside the semantic node and, in places, the sheet |

The native shared-node measurer deliberately measures each decorator as a single
unwrapped line. In the combined mode, the ID starts at local x=74.08 and measures
193.92px wide: its right edge is x=268 in a 224px node. It emits
`renderer.measure.shared_node_decorator_overflow`. The independent acceptance
checker now also checks decorator text against its measured header rectangle.
The [PNG](implementation_evidence/stage6_resumed/long_ids.detailed.type-id.png)
confirms actual overflow; this is not merely a conservative warning.

Relevant frozen implementation:
[`measureDecorator`](../../src/renderer/staged/sharedNode.ts) measures with an
unbounded wrapping width and a fixed-height decorator region. A view-only fix
would have to suppress or change the requested semantic ID, replace native node
measurement/paint, or widen the native node. Those options contradict the plan's
semantic identity, decorator independence or shared-node preservation invariants.
Changing shared placement or routing would not address this text overflow.

These were four ordinary failing tests when first reported. After the user
explicitly accepted this limitation, the test now permits only the native
decorator overflow warning and its corresponding decorator-bounds finding for
this long-ID fixture. It still records the raw issues and rejects all other
geometry or coverage failures. No shared routing validator was relaxed. Public
integration and artifact refresh proceeded only after that acceptance.

## Verification and resume point

The focused run passed 152 tests and failed the four long-ID combinations. The
[focused log](implementation_evidence/stage6_resumed/focused-tests.log) includes
the immutable B5 replay, complete eight-option sheet, production scope/header,
presentation-model and topology suites.

`TMPDIR=/tmp pnpm test` built successfully and ran all 1,206 tests: 1,201 passed,
the four long-ID acceptance tests failed, and one unchanged IA Place Map visual
test timed out under the parallel run. Its complete five-test suite passed on a
single-worker rerun. No timeout or validator threshold was changed. The full run
covered legacy text/Graphviz behavior, helper previews, CLI defaults and artifact
paths, shared nodes, SVG paint, routing, unrelated staged views and projection
snapshots. See [the full log](implementation_evidence/stage6_resumed/full-tests.log)
and [the isolated rerun](implementation_evidence/stage6_resumed/timeout-recheck.log).

All 49 frozen source hashes, 49 visual reference hashes and 156 original golden
hashes still match the starting baseline. The Departure Desk checksum also
matches. See the [protected-file audit](implementation_evidence/stage6_resumed/protected_file_audit.json).
Models, scene stages, SVGs, option selections, coverage and geometry reports are
retained in [the resumed evidence directory](implementation_evidence/stage6_resumed/).
Updated complete-sheet evidence is under its `departure_desk` subdirectory.

Satisfied: the user's five original topology corrections, sibling grouping,
arrow clearance, native container titles, marker-independent SVG arrows,
coverage, option independence and frozen placement/routing. Retained with the
user's explicit acceptance: long-ID semantic decorator overflow. Stage 6 is
acceptable for Stage 7 with that limitation.

The user's decision was: “The long-ID-overflow is acceptable.” Replacing a long
ID with `(long ID)` is future shared-node work. See the implementation ledger for
the subsequent public integration and final verification.
