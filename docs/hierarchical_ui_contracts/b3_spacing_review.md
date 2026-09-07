# B3: headerless compact nodes and measured spacing

This pass refines the B2 SVG proofs; it does not change the SDD, renderer, bundle,
or CLI. B2 remains available as review history. Its
[detail-policy analysis](b2_detail_policy.md) still applies, except that B3's
compact proofs now consistently use headerless nodes.

## Review set

| Focus | Compact — clean | Detailed — clean |
| --- | --- | --- |
| Complete sheet | [SVG](b3_complete.compact.svg) | [SVG](b3_complete.detailed.svg) |
| Component scope | [SVG](b3_component.compact.svg) | [SVG](b3_component.detailed.svg) |
| Place scope | [SVG](b3_place.compact.svg) | [SVG](b3_place.detailed.svg) |
| Enclosure overview | [SVG](b3_overview.svg) | [SVG](b3_overview.detailed.svg) |

Editorial comments appear only in Context Excerpts:
[detail comparison](b3_detail.context.svg),
[horizontal growth](b3_horizontal_growth.context.svg), and
[overview](b3_overview.context.svg).

## Acceptance invariants

The [shared-node acceptance reference](../good_node_rendering/shared_node_renderer_acceptance.md)
governs native node appearance; the user's titled Figma container remains the
container exemplar. The [CLI guide](../doc_site/sdd_cli_tools/index.md),
[manifest](../../bundle/v0.1/manifest.yaml), and
[view bundle](../../bundle/v0.1/core/views.yaml) distinguish detail from decorators
and govern existing display policy. The repository AGENTS.md keeps layout and
routing in the renderer, not projection.

- Compact nodes have no decorator headers. Outer container titles and H1 headers
  remain. The proof settings are compact with `decorators=none`, and detailed
  with `decorators=type,id`; this does not couple those independent CLI options.
- All semantic nodes remain 224px wide, with native typography and padding.
  Content fitting comes from measurement and wrapping, not smaller text.
- Enclosure, C-431's own inset enclosure, earliest-source H1 expansion, and all
  immediate parents and children remain unchanged between detail modes.
- Each incoming/outgoing containment group retains a visible `Contains` label.
- Five-step sequences remain horizontal. All visible trigger, guard, and effect
  text is retained. Separate sequences remain separate.
- Local composition and outgoing-contract geometry stays left-anchored when
  longer sequences widen its surrounding scope.

## What changed

All dimensions below are SVG logical pixels, not screen-scaled pixels.

| Spacing | B2 | B3 |
| --- | --- | --- |
| Horizontal sequence node-to-node gap | Fixed 220 | Measured 108–156 in this fixture |
| Parent bottom to focal Component top | 122 | 70 |
| Focal Component bottom to first child top | About 134 | 64 |
| Complete-sheet width | 2096 | 1804 |

The complete sheet is about 14% narrower. The five-step Seal Check State scope
is about 20% narrower (2048 to 1648). This is a spacing reduction, not a reduction
in node width, font size, or semantic content. Compact also loses node headers.

Sequence labels use the native 12px text and 14px line height. The proof prefers
a 120px text-wrap width, widens for unbreakable words, measures the resulting
label box, and allocates that width plus at least 12px on each side. Gaps round
up to a 4px increment, with a 64px floor. The observed range is not a universal
maximum: longer labels must be allowed to increase spacing. Above-row clearance
also responds to measured label height instead of a fixed large spacer.

Vertical gaps budget for the 22px `Contains` label, the incoming junction where
needed, and clearance around the label and arrow. More complex fan-in/fan-out,
larger labels, or intervening obstacles may require more room.

Place composition keeps its 112px gap and 224px description width. Outgoing
contracts keep their 192px local gap. Those groups are unchanged by the two-step
versus five-step comparison; they do not stretch to the scope's right edge.

## Does unified routing require the previous whitespace?

**No, not as a blanket requirement.** B2 used manually chosen fixed gaps. Its
node and connector appearance came from shared rendering, but the proof's
placement and routing geometry did not come from the unified layout solver.

There is nevertheless a production-layout contributor worth addressing:

- `resolveLayerGap` in
  [macroLayout.ts](../../src/renderer/staged/macroLayout.ts) takes the largest
  label span across the container's owned edges and adds the base gap. For a
  horizontal layered group, one wide label can therefore enlarge every layer
  gap. This is a macro-layout policy, not an intrinsic router minimum.
- [uiContracts.ts](../../src/renderer/staged/uiContracts.ts) currently sets
  `TRANSITION_GRAPH_GAP` to 24 for the horizontal transition graph containers.
- [routing.ts](../../src/renderer/staged/routing.ts) uses 12px label-segment
  clearance and a 12px label offset. Its label placement tests measured label
  width or height against an available segment.
- The [routing-core policy](../../src/renderer/staged/routingCore/contracts.ts)
  defaults to 16px minimum separation and 12px minimum terminal legs. These
  local requirements are not a universal safe node-to-node gap: labels,
  arrowheads, obstacles, and branching must also fit.

The implementation direction to investigate is **measured spacing per adjacent
layer**, considering the labels and routes that actually use that gap, rather
than the widest label in the entire sequence group. For a simple chain this
becomes per-connection spacing. Branching graphs need joint constraints; the
proof's arithmetic is not a complete general layout algorithm.

This belongs in shared measurement/layout/routing infrastructure. Do not fix it
by changing graph semantics, truncating transition labels, or bypassing routing
validation. Retain explicit expansion or diagnostics when constraints cannot fit.

## Verification and limits

The [verification record](b3_verification.json) records native node dimensions,
decorators, represented identities/relations, sequence gaps, containment gaps,
and width-growth comparisons. The proof checks found no node overlaps,
label/node or label/label overlaps, out-of-bounds content, or connector paths
through node/label interiors. Native node/backend diagnostics were empty.
Representative overview, compact/detailed Component, detailed Place, and detail
comparison images were also visually inspected.

The complete detailed proof represents all 51 identities and 45 explicit
relations. The complete compact proof retains 17 identities and 24 relations
under the documented detail policy; hidden supporting content is intentional.
The source SHA remains
`fec1fc5b356be868944b67eb2d6134bd6d70f0ca2f290fc515662f061f45fbff`.
Fresh strict validation reports zero errors and the one intentional warning for
C-430's two containment parents.

Satisfied: the design invariants above and the stated geometric proof checks.
No violations were found by those checks. The proofs are suitable for this
spacing review. Not established: production layout reproducibility, general
branching-graph behavior, or full unified routing-core acceptance, including
edge-to-edge track separation. The production solver was not run on these
manually positioned proof routes. Earlier proposed detail additions and known
bundle/runtime display gaps remain unresolved as described in B2.
