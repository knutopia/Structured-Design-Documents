# B2: titled containers, horizontal proofs, and render detail

These are **proposed design proofs**, not output claiming that the current CLI
implements Component containment. No renderer, projection, bundle, or preference
behavior was changed. Earlier A–D and B1 artifacts remain review history.

## SVG review set

| Focus | Compact — clean | Detailed — clean |
| --- | --- | --- |
| Complete sheet at that detail level | [SVG](b2_complete.compact.svg) | [SVG](b2_complete.detailed.svg) |
| Shared Component scope: both parents and immediate child | [SVG](b2_component.compact.svg) | [SVG](b2_component.detailed.svg) |
| Place composition and multiple horizontal ViewState chains | [SVG](b2_place.compact.svg) | [SVG](b2_place.detailed.svg) |

The [clean hierarchy overview](b2_overview.svg) uses the same content policy in
both modes. A separate [no-decorators version](b2_overview.decorators-none.svg)
tests whether the H1 reference remains usable without type/ID headers on nodes.

Editorial comments appear only in Context Excerpts:

- [The corrected enclosure and H1 treatment](b2_overview.context.svg).
- [What compact removes and detailed adds](b2_detail.context.svg).
- [Horizontal width-growth proof](b2_horizontal_growth.context.svg).

The clean complete sheets include every section applicable at the selected
proposed detail level. “Complete compact” does not mean every semantic node is
visible; deliberate detail-based omissions remain omissions.

## Contract, guardrails, and exemplar

The [CLI guide](../doc_site/sdd_cli_tools/index.md) separates validation profiles,
render detail, and node decorators. The machine-readable authority is
[manifest.yaml](../../bundle/v0.1/manifest.yaml), particularly `tool_defaults`,
`render_details`, and `node_decorator_modes`, plus the `ui_contracts` entry in
[views.yaml](../../bundle/v0.1/core/views.yaml), especially
`renderer_defaults.transition_graph_priority` and `detail_display`.

Architectural guardrails remain those in the repository AGENTS.md: projection is
the semantic boundary; presentation policy belongs in the loaded bundle; layout
belongs to the renderer; new scene contracts must stay backend-independent.

The visual exemplar is the user's
[Figma container design, node 2041:2553](https://www.figma.com/design/XugYvQ9C0qi0Hwl88k43Wm/SDD-Node-Visuals?node-id=2041-2553),
particularly the right-hand titled variant. Node measurement and typography
follow the [shared-node acceptance reference](../good_node_rendering/shared_node_renderer_acceptance.md).

The non-negotiable invariants for these proofs are:

1. Every actual node retains the 224px shared-node width. Containers are distinct
   presentation structures, not stretched node cards.
2. The overview uses explicit enclosure, including C-431's inset enclosure.
   H1 is a named region with a header in both expanded and reference occurrences.
3. Both overview and Component Scope use titled outer containers. The scope title
   identifies a contextual view: its parent references are not contained children.
4. All immediate Component parents and children remain visible in both modes.
   One `Contains` label belongs to each incoming/outgoing connector group.
5. The earliest source-ordered occurrence expands; later occurrences reference
   it. Detail and decorator changes must not choose a different expansion parent.
6. Horizontal sequence growth may widen the sequence region and the overall
   sheet, but must not stretch local composition or contract groups, descriptions,
   labels, or node widths. Switching to portrait is not a substitute for this proof.
7. Existing detail-based visibility rules must be distinguished from proposed
   additions. Neither detail selection nor decorator selection changes the SDD.

## What compact and detailed mean today

The relevant bundle settings are at `views.yaml:3129–3156`. Their current consumer
is [uiContractsRenderModel.ts](../../src/renderer/uiContractsRenderModel.ts):
`readUiContractsDisplayOptions`, `getEffectiveTransitionNodeType`, and
`buildUiContractsRenderData`, reached through the generic
[detail policy resolver](../../src/renderer/detailDisplay.ts).

For the mixed State/ViewState fixture used here:

| Content | Current compact policy | Current detailed policy |
| --- | --- | --- |
| Primary ViewState sequences | Retained | Retained |
| Trigger, guard, effect labels on retained transitions | Retained | Retained |
| Secondary State groups | Hidden | Shown |
| Event, DataEntity, and SystemAction nodes; supporting contract connectors | Hidden | Shown |
| Place route/key and access | Hidden | Shown |
| ViewState data required | Hidden | Shown |
| Empty Place containers | Omitted with a coverage note | Retained |
| Component-to-Component containment | Not displayed | Not displayed |

**The important exception:** when no ViewState is present but States are, State
becomes primary. Both compact and detailed then retain State graphs and supporting
contracts. This decision currently applies across the projection, not separately
to each component. Therefore “compact always hides States/contracts” is wrong.

An Event node can be hidden while its event name remains on a visible transition.
Compact should not delete the trigger, guard, or effect of a retained transition.

Detailed does not currently mean “print all properties.” Current `ui_contracts`
does not add Component descriptions, inputs, outputs, responsibilities, or target
payload descriptions to its leaf-node attributes. The earlier studies added some
of those as exploratory content, not as evidence of current `--detail detailed`.

There is also an existing policy/runtime mismatch: the bundle declares Place
entry-point and primary-navigation switches, but `buildPlaceLabelLines` passes
only name, route, and access to the shared label builder. The two metadata fields
therefore do not currently appear in `ui_contracts`. These proofs follow the
declared flags: primary navigation appears in both modes, entry points in detailed.
That is a visual proof of the declared policy, not a claim the runtime gap is fixed.

## Proposed policy for the new hierarchy treatment

Recommendation: **compact reduces supporting content, not the truth of the
Component hierarchy.**

| New or extended content | Proposed compact | Proposed detailed |
| --- | --- | --- |
| Named, titled hierarchy overview | Present, name-only nodes | Same structure and name-only nodes |
| First expansion, H1 reference, source order | Identical rule | Identical rule |
| All immediate parents and children | Present as references | Present as references |
| Incoming/outgoing `Contains` labels | Present | Present |
| Component scope title | Present even when State/support content is hidden | Present |
| Focal Component description, inputs, outputs | Omitted | Present when supplied |
| Place description below the Place node | Omitted | Present, constrained to 224px |
| Neighbor and contract-target references | Name only | Name only; no recursive detail expansion |
| State/support display | Existing conditional rule | Existing conditional rule |

The new Component/Place descriptions are **proposed policy additions**, not
existing bundle switches. Their inclusion is deliberately narrow: detailed should
add useful contract context, not indiscriminately dump every property. In a future
implementation, these selections and the new hierarchy visibility must be encoded
in the bundle and consumed through generic renderer mechanisms before they become
behavior. This proof pass does not change the bundle.

I recommend keeping the overview name-only even in detailed. Otherwise the same
component descriptions would repeat in both the overview and local scopes, and
deep hierarchies would become disproportionately large. Complete local detail
belongs once per identity; neighbors remain lightweight references.

The current empty-Place rule is not permission to erase a structure-only
Component scope. A compact scope that still communicates parentage has useful
content even when its States and support lane are omitted.

## Detail and decorators are independent

The compact/detailed pairs explicitly hold `type,id` decorators constant. They
should not be mistaken for output using the shipped `none` decorator fallback.
Detailed must not implicitly turn on decorators; compact must not turn off an
explicitly selected decorator mode.

Container titles are presentation labels, not node decorators. H1 remains a
named hierarchy region when node decorators are disabled. Its later header reads
`H1 · See Cargo Sheet`; it does not depend on seeing `C-420` elsewhere. H1 is the
unique location marker; the parent name adds orientation. The no-decorators proof
keeps the same occurrence counts and reference selection.

For more complex reuse, source-ordered occurrence-path traversal and duplicate
name handling still need explicit implementation acceptance cases. H1 is a
locator within the export, not an SDD node or privileged parent relationship.

## Horizontal width proof

The fixture now has a five-step Departure ViewState sequence and a five-step
Seal Check State sequence. Both retain their original relationships and extend
at the end. The Load Workbench five-step and three-step State sequences and the
separate Crew three-step ViewState sequence remain.

The growth Context Excerpt compares the first two steps with all five, clearly
labeling the shorter versions as **excerpts**. It does not pretend that the source
declares only two steps. Both versions use the same horizontal layout, font sizes,
node widths, and local relationship positions.

| Measurement | Two-step excerpt | Five-step chain |
| --- | --- | --- |
| Scope width | 716px | 2048px |
| Node width | 224px | 224px |
| Place composition connector span | 112px | 112px |
| Place description width | 224px | 224px |
| Outgoing contract connector horizontal span | 192px | 192px |
| Contract source x / target x | 48 / 464 | 48 / 464 |
| Contract label-lane x | 322 | 322 |

The three contract routes are backed by C-430's actual EMITS, DEPENDS_ON, and
BINDS_TO edges. No contract was invented on C-410 merely to construct a proof.

This demonstrates the intended geometry and records exact checks for these
hand-positioned scenes. It is **not** evidence that a general production layout
algorithm has been implemented or verified. Longer branching graphs, many lanes,
and the State-only fallback remain distinct future proof cases.

## Validation and acceptance evidence

The SDD skill's assessed mutation workflow preserved all prior nodes, properties,
source parents, and edges. Final strict validation has 0 errors and the one
intentional `contains_single_parent_recommended` warning for C-430. Persisted
assessment permits rendering; the `ui_contracts` projection has no diagnostics.

- Source: [departure_desk.sdd](departure_desk.sdd).
- Final model: 51 nodes and 45 explicit edges.
- Detailed complete proof: all 51 identities and 45 explicit relationships,
  including enclosure and transition encodings.
- Compact complete proof: 17 visible node identities and 24 visible relationships;
  State/support omissions follow the conditional mixed-fixture policy. Transition
  trigger/effect text remains present even without separate supporting nodes.
- All native node variants are 224px wide; native node/edge backend diagnostics
  are empty. Bounds, node/label collisions, and routes through node/label interiors
  were checked. Scope titles and H1 references were visually reviewed.
- Clean proofs contain no editorial containers. Context Excerpts hold the
  explanations and short-chain excerpt labels.
- [Machine-readable verification](b2_verification.json) records positions,
  visible identities/relationships, container roles, and width-growth checks.

Validated source SHA-256:

```text
fec1fc5b356be868944b67eb2d6134bd6d70f0ca2f290fc515662f061f45fbff
```

The cited visual invariants pass for these proof cases. Generalized layout,
State-only fallback rendering, arbitrary-depth reuse, and the existing Place
metadata delivery gap are not claimed solved. The current renderer's earlier
routing failures are also not remediated by these study artifacts.
