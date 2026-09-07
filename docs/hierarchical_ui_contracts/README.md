# Component containment: B — enclosure overview and local context

## Current SVG proofs: headerless compact nodes and tighter spacing

The current **B3** set removes compact node headers, retains titled containers,
and tightens sequence and local containment gaps without shrinking nodes or text.
Read the [spacing review and routing findings](b3_spacing_review.md).

- Clean complete sheets: [compact SVG](b3_complete.compact.svg) and
  [detailed SVG](b3_complete.detailed.svg).
- Component scope: [compact SVG](b3_component.compact.svg) and
  [detailed SVG](b3_component.detailed.svg).
- Place scope: [compact SVG](b3_place.compact.svg) and
  [detailed SVG](b3_place.detailed.svg).
- Enclosure overview: [compact SVG](b3_overview.svg) and
  [detailed SVG](b3_overview.detailed.svg).
- Context Excerpts: [compact/detailed comparison](b3_detail.context.svg),
  [horizontal growth](b3_horizontal_growth.context.svg), and
  [overview explanation](b3_overview.context.svg).

The 51-node, 45-edge fixture is unchanged. These remain design proofs, not an
implementation of Component containment or a production routing change.

## Previous B2 SVG proofs: titled containers and render detail

The previous **B2** set follows the user's Figma container design, uses titled
outer containers, and compares proposed compact/detailed content. Read the
[detail policy and proof guide](b2_detail_policy.md).

- Clean complete sheets: [compact SVG](b2_complete.compact.svg) and
  [detailed SVG](b2_complete.detailed.svg).
- [Enclosure and H1 treatment](b2_overview.svg), including C-431's explicit inset
  enclosure; [annotated explanation](b2_overview.context.svg).
- [Compact/detailed local-context comparison](b2_detail.context.svg).
- [Horizontal width-growth proof](b2_horizontal_growth.context.svg).
- [Overview without node decorators](b2_overview.decorators-none.svg).

The fixture now has 51 nodes and 45 edges, including five-step State and ViewState
chains. Strict validation reports no errors and the one intentional C-430
multiple-parent warning. Renderer and bundle behavior remain unchanged.

## Previous B PNG proofs

The following **B1** set describes the earlier 41-node, 38-edge revision, before
the Figma container correction and the horizontal proofs. It remains available
as review history. Start with the
[B review guide](b_design_review.md), which pairs annotated Context Excerpts with
clean Complete Sheets. All visual deliverables are PNGs.

- [Clean complete sheet](b_complete_sheet.png).
- [Overview and reuse — Context Excerpt](b_01_overview_context.png).
- [Multiple parents and local contracts — Context Excerpt](b_05_shared_component_context.png).
- [Place scope — Context Excerpt](b_02_place_context.png).
- [Five-step and three-step State sequences — Context Excerpt](b_06_sequences_context.png).

That fixture revision has 41 nodes and 38 edges. C-470 Arrival Review reuses C-430 Seal
Check and its child C-431. Strict validation reports no errors and one intentional
multiple-parent warning. Production renderer code is unchanged.

## Historical A–D exploration

The following notes and their numbered PNGs describe the **previous 36-node,
34-edge fixture revision**, before component reuse and the five-step sequence
were added. They are retained as exploration history, not the current design.
In particular, their inline hierarchy annotations, mixed overview notation,
connector treatment, and editorial comments on complete sheets are superseded
by the B set above.

### Previous revised A–D studies

The original four hierarchy alternatives now all include the same two refinements:

1. Real shared-node rendering: standard 224px width, pale type/ID header, regular
   title and attribute formatting. No semantic node is stretched into a wide card.
2. Multiple, three-step sequences within one scope, for both ViewState and State.

Section headings and relationship captions use ordinary capitalization. Node
formatting comes from the existing shared renderer. Production code is unchanged.

## A–D remain the comparison

| Alternative | Context excerpt | Complete sheet | Hierarchy treatment |
| --- | --- | --- | --- |
| A | [PNG](01_outline_mobile.png) | [PNG](01_outline_full.png) | Outline overview plus parent/child attributes. |
| B | [PNG](02_enclosure_mobile.png) | [PNG](02_enclosure_full.png) | Enclosure overview plus the same parent/child attributes. |
| C | [PNG](03_local_context_mobile.png) | [PNG](03_local_context_full.png) | Local parent/child attributes only. |
| D | [PNG](04_tree_ledger_mobile.png) | [PNG](04_tree_ledger_full.png) | Continuous hierarchy gutter beside the component scopes. |

Every context excerpt includes the shared Place/ViewState scope, its hierarchy
context, and Load Workbench's two State sequences. D also includes Cargo Sheet so
its first containment branch can be evaluated. Complete sheets include every
component scope and the referenced-target register.

Optional close-ups are supplements, not additional hierarchy alternatives:

- [Parent and child contracts](05_owned_contracts_mobile.png): Cargo Sheet and
  Seal Check using the shared A–C local-context treatment.
- [Multiple ViewState sequences](06_scope_mobile.png): the Place scope common to A–D.
- [Multiple State sequences, portrait](07_multiple_sequences_mobile.png): the same
  Load Workbench topology arranged vertically for mobile review. This is an
  orientation proof, not a fifth hierarchy treatment.

PNGs are exported at 2× their logical layout dimensions. Nodes remain 224px wide
in diagram coordinates. D grows the sheet width rather than shrinking its nodes.
Full sheets are long and intended for zooming and scrolling.

## Shared nodes versus scope graphics

The existing `renderSharedNodesStagedSvg` harness produces every node fragment with
the standard theme and `type,id` decorators. Measurement, wrapping, header layout,
attribute grouping, and content-driven height therefore use production shared-node
rendering, not a hand-drawn approximation.

References: [accepted values](../good_node_rendering/shared_node_renderer_acceptance.md)
and [structural design](../good_node_rendering/solving_for_good_node_rendering.md).
The 224px width, 19px header, Public Sans typography, and normal attribute formatting
are unchanged.

Neutral grey frames are diagram scopes or hierarchy enclosures, not wide semantic
nodes. Component-detail scopes collect that component's own states and outgoing
contracts. Target nodes connected by blue contract arrows are references, not
component children. Only hierarchy marks and explicit parent/child attributes
encode component containment.

All alternatives hold a separate design choice constant: local target references
plus a shared detail register replace long connectors to distant shared targets.
This is an exploratory readability tradeoff, not an implemented routing fix.
Repeated IDs denote the same identity; judge whether sharing remains apparent.

## Stronger fixture

[departure_desk.sdd](departure_desk.sdd) retains its four-level component hierarchy,
independently owned child contracts, shared data/service targets, and the two
explicit composition references to Crew Note.

Place P-410 contains two disconnected three-step ViewState sequences:

- Staging → Released → Archived.
- Crew message → Crew review → Crew confirmation.

All six ViewStates have `place_id=P-410` and explicit Place containment edges.
Staging and Released remain the only ViewStates explicitly composed of Crew Note.
No additional use of that component is inferred.

Component C-410 owns two disconnected three-step State sequences:

- Assembling → Checking load → Ready to release.
- Checklist open → Checklist reviewed → Checklist filed.

All six States have `scope_id=C-410`. Cargo Sheet and Seal Check retain separate
two-state sequences of their own. State ownership is not inferred from containment.

Captions such as “Departure”, “Readiness”, and “Checklist” are reading labels, not
additional SDD nodes. Separate rows or columns imply neither simultaneous views
nor parallel execution. No connector joins disconnected sequences. The original
Staging → Released trigger, guard, and effect are preserved. New transitions do
not introduce new emission edges or effects.

There are 36 nodes and 34 explicit edges. Every complete sheet represents all
identities and relationships, including transition annotations and binding fields.
Metadata selection is consistent across alternatives; the images do not print
every owner, responsibility, description, or State invariant in the SDD.

## Verification and limits

The SDD helper's assessed edit workflow and final strict validation completed with
0 errors and 0 warnings. Projection preserves all 36 nodes and 34 edges, with no
omissions or diagnostics.

Validated source SHA-256:

```text
197bec59212becd30e43268d0dfab9ded3d5b511ebe5d38e19139cc462459bd7
```

All shared-node variants are checked for standard width and clean renderer
diagnostics. Full-sheet checks cover identity/edge coverage and canvas bounds;
exported PNGs are also inspected visually. Overall hierarchy and sequence placement
remains exploratory, not an accepted implementation or a production golden.

A prior baseline export exposed routing errors involving the C-420/C-430 bindings
to D-410 and C-450's dependency on SA-410. No renderer checks were weakened or
relationships removed to disguise them. The PNG studies do not claim to fix those
routing defects.

Compare A–D with the same reader tasks: find direct parentage; distinguish both
sequences within each scope; identify who emits versus uses Seal accepted; locate
Crew Note's two composition points; and recognize shared service/data targets.
Branches, merges, cycles, wider trees, and still longer sequences remain further
proof cases, not problems that these examples claim to have solved.
