# B: enclosure overview and local context

Historical B1 PNG review, based on the 41-node / 38-edge source revision below.
The H1 treatment and portrait-only proofs are superseded by the
[B2 SVG proofs and detail-policy discussion](b2_detail_policy.md). The current
SDD has since been extended; these PNGs have not been regenerated.

Design studies for review, not an implementation or production-renderer output.
The selected direction is held constant; these are complementary views, not new
A–D alternatives. Earlier numbered PNGs remain unchanged as exploration history.

## Review pairs

Context Excerpts contain editorial explanations. Complete Sheets contain only
diagram content, headings, and necessary relationship/reference labels. Source
descriptions are diagram content, not editorial comments.

| Focus | Context Excerpt — annotated | Complete Sheet — clean |
| --- | --- | --- |
| Enclosure overview and repeated hierarchy | [PNG](b_01_overview_context.png) | [PNG](b_01_overview_complete.png) |
| Multiple parents, immediate child, local contracts | [PNG](b_05_shared_component_context.png) | [PNG](b_05_shared_component_complete.png) |
| Place composition and multiple ViewState sequences | [PNG](b_02_place_context.png) | [PNG](b_02_place_complete.png) |
| Five-step and three-step State sequences in one scope | [PNG](b_06_sequences_context.png) | [PNG](b_06_sequences_complete.png) |

The [single clean complete sheet](b_complete_sheet.png) includes the overview,
Place scope, every Component scope, and the referenced-target register. For
shorter downloads and easier mobile zooming, its four sections are also saved as
[overview](b_01_overview_complete.png), [Place](b_02_place_complete.png),
[all Component scopes](b_03_components_complete.png), and
[referenced targets](b_04_targets_complete.png).

All PNGs use 2× export. Nodes are exactly 224px wide in logical diagram
coordinates, not enlarged or stretched to fill their enclosing sections.

## Source-backed proof

[departure_desk.sdd](departure_desk.sdd) now includes:

- C-410 Load Workbench containing C-420 Cargo Sheet, C-440 Release Lever,
  C-450 Trail Lens, and C-470 Arrival Review, in that source order.
- C-420 and C-470 both containing the same C-430 Seal Check, which contains
  C-431 Seal Code Input.
- Two State sequences owned by C-410: a five-step readiness/release chain and
  a separate three-step checklist chain. C-420 and C-430 retain their own
  two-step State sequences.
- Two separate three-step ViewState sequences in P-410. Only Staging and Released
  are composed of C-460 Crew Note; component parentage is not inferred from this.
- The existing explicit event emission, data-field binding, and service dependency
  relationships. Using an event on a transition does not imply emitting it.

The five-step State chain is Assembling → Checking load → Ready to release →
Release recorded → Handoff complete. Sequence captions are reading labels, not
additional modeled nodes. Separate columns assert neither concurrency nor a
transition between sequences.

## Shared-structure reference convention under review

The earliest source-ordered containment occurrence expands the complete subtree.
Later occurrences keep the same normal component node in their actual parent
enclosure, followed by an external reference footer.

In this fixture:

1. C-430 under C-420 expands to C-431. Its enclosure has the locator **H1** beside
   the node, outside the shared node card.
2. C-430 under C-470 shows **Structure at H1**, followed by **C-420 / C-430**.
   The footer is presentation material, not an added component property or child.
3. H1 is a location within this exported overview, not a new SDD identity. It
   grants no privileged ownership to C-420. Both parents remain visible in the
   C-430 local scope.

The reference deliberately uses no connector or arrow: it points to a displayed
expansion without introducing a second visual encoding for containment. It works
in a static PNG without interaction. C-431 appears once in the overview; C-430
appears twice. Different IDs with matching structure are not deduplicated.

Source order must select the expansion before layout. The C-420 → C-430 edge
precedes C-470 → C-430 in the persisted source. For deeper reuse, implementation
planning still needs to formalize source-ordered occurrence-path traversal and
tie-breaking; component declarations, alphabetic order, IDs, and eventual screen
coordinates must not silently replace the user's source-order rule. Locators and
references must be regenerated together after a source edit.

## Layout and connector treatment

The overview uses enclosure for every Component containment level, including
C-430 → C-431. Nested frames have visible inset on both sides. The frames are
hierarchy scaffolding; every actual component uses the standard shared node.

Local neighborhoods show all immediate parents above the focal Component and
immediate children below. Neighbors are name/ID references, not recursively
expanded detail scopes. The four-child neighborhood uses an ordinary structural
tree trunk; it does not stretch into a four-column row. Containment arrows use
the established unlabeled structural-arrow appearance.

Composition pairs are left-anchored, with a 112px connector span between standard
nodes. The Place description is constrained to 224px below the Place. Outgoing
contract groups have their own content-sized node/label/target lanes. Neither
group calculates its width or target position from the scope's right boundary.
Longer sequences grow downward in their own lanes, not horizontally through
these relationship groups. This trades width for height; the split PNGs make that
tradeoff reviewable on mobile.

Shared node fragments come from the production `renderSharedNodesStagedSvg`
harness. Connectors and label boxes are emitted by the production
`renderPositionedSceneToSvg` backend from hand-positioned study routes:

| Relationship | Preserved visual vocabulary |
| --- | --- |
| Emission | Dashed arrow, `emits` |
| Data binding | Dotted arrow, `binds field contents`, `binds field seal_code`, or `binds field status` |
| Dependency | Solid arrow, `depends on` |
| ViewState transition | Solid arrow, `[Event name] {guard} / effect` when present |
| Secondary State transition | Dashed arrow, the same transition-label syntax |
| Component containment in local context | Solid, unlabeled structural arrow |

Native arrowheads, blue stroke, dash patterns, Public Sans typography, and native
label-box formatting are reused. The temporary drawing process does not invent
new arrowhead shapes or put labels on detached line segments.

The existing `ui_contracts` renderer currently suppresses visible `COMPOSED_OF`
connectors. Thus the solid connector with the generic lowercase label
`composed of` is a **proposed display**, not an assertion about current output.
Likewise, portrait transition ports, local reference occurrences, neighborhood
layout, and enclosure placement are study choices—not claims that the production
layout or routing policy already implements them. Rich component and target
detail appears once per identity in the complete sheet; local references repeat
only the standard name/ID node.

## Verification and limits

The SDD skill's assessed author/apply workflow and final persisted strict
validation returned **0 errors, 1 intentional warning**:
`contains_single_parent_recommended` for C-430. Assessment permits rendering
(`can_render=true`, `should_stop=false`). The `ui_contracts` projection has no
diagnostics. Totals are 41 nodes and 38 explicit edges.

Validated source SHA-256:

```text
116db13b239bcc79f8ef7b8eeeb6888ec85c49d05c13a24ca36bc387deb0a90e
```

Artifact checks cover identity and explicit-edge representation, 224px node
widths, native node/backend diagnostics, canvas bounds, node/label collisions,
and routes through node or label interiors. The main clean complete sheet covers
all 41 identities and 38 edges, including relationships encoded by enclosure and
transition annotations. "Complete" means graph coverage, not printing every
source property. PNGs were also visually inspected for hierarchy clarity,
reference resolution, attached connectors, and separation of editorial content.

These are bounded design proofs, not a general layout algorithm or production
goldens. Extreme depth, many parents, many sequence lanes, branching/merging
transitions, cycles, and nested/shared-subtree ordering still need separate
acceptance cases. Production renderer code, bundle behavior, routing checks, and
the earlier routing-remediation handoff are unchanged. These studies do not
claim to fix the baseline renderer's previously reported routing defects.
