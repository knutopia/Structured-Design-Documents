# [Done] B4: spacing demonstrated through the unchanged shared pipeline

> B5 supersedes the visible junction markers and container-header painting in
> these SVGs. Its explicit decorator variants also clarify that B4's detailed
> examples selected `type,id` separately, not as an effect of detailed content.
> The verified spacing remains unchanged. See the [B5 review guide](b5_visual_refinements.md).

B3's spacing conclusions are withdrawn. B4 uses real scene inputs and runs
`runStagedRendererPipeline` followed by `renderPositionedSceneToSvg`. Shared
measurement, layout, routing, validation, theme, and SVG-backend source files
were not modified. The pipeline's resulting node positions, routes, and connector
label positions are not adjusted afterward.

## Focused SVG proofs

| Case | Compact | Detailed |
| --- | --- | --- |
| Seal Check: two parents and one child | [SVG](b4_component.compact.svg) | [SVG with five-step State sequence](b4_component.detailed.svg) |
| Load Workbench: four children | [SVG](b4_children.compact.svg) | [SVG with five-step and three-step State sequences](b4_children.detailed.svg) |
| Departure Desk: local composition and two ViewState sequences | [SVG](b4_place.compact.svg) | [SVG](b4_place.detailed.svg) |

The [shortened Place control](b4_place.short.detailed.svg) retains two steps in
each sequence, to compare against the five-step/three-step detailed proof.

These are **spacing excerpts**, not Complete Sheets: the overview, outgoing
contracts, ViewState composition references, and other component scopes are out
of this pass's scope. Their omission is not a proposed detail-policy change.
Editorial explanations are in this guide; the SVGs are clean.

## Contract and acceptance

The [shared-node acceptance reference](../good_node_rendering/shared_node_renderer_acceptance.md)
governs node width and typography. The user's titled-container exemplar governs
the proof's outer-header appearance. Existing detail/decorator policy is grounded
in the [CLI guide](../doc_site/sdd_cli_tools/index.md),
[manifest](../../bundle/v0.1/manifest.yaml), and
[ui_contracts view definition](../../bundle/v0.1/core/views.yaml).

Required invariants for this pass:

- No shared renderer or bundle changes; no post-layout coordinate or route edits.
- Native 224px semantic nodes, native label measurement/wrapping, and unchanged
  transition text. Compact has no node headers; outer container titles remain.
- Horizontal sequences use the existing common-gap layered layout. No
  per-connector gaps, forced narrower wrapping, or splitting a chain into pairs.
- Vertical hierarchy shows actual parent/child references, with one `Contains`
  label on each common stem. Synthetic routing junctions are not semantic nodes.
- Multiple parents, four children, and multiple sequences are exercised.
- Pipeline diagnostics, independent routing validation, and geometric label
  checks must all pass. A visually overlapping label is a failure even if routing
  diagnostics are empty.

The new hierarchy scene assembly remains a proposal, not current CLI output.
Future integration still needs the bundle-owned display contract and view scene
assembly; it does not require a change to the shared layout/routing algorithms.

## Horizontal solution: keep the existing common gap

The sequence container uses the existing `layered` strategy, horizontal direction,
and 24px base gap, as current `ui_contracts` does. The native label measurement
uses the unchanged theme's wrapping policy. `resolveLayerGap` adds the widest
measured label to the base gap and applies that result throughout the group.

| Group | Widest measured label box | Base gap | Actual node-to-node gap |
| --- | --- | --- | --- |
| Departure Desk ViewStates, both sequences together | 163.704px | 24px | 187.704px |
| Seal Check States | 165.36px | 24px | 189.36px |
| Load Workbench States, both sequences together | 165.36px | 24px | 189.36px |

The shorter labels consequently retain some unused horizontal room. B4 accepts
that existing behavior. It does not promise B3's 108–156px per-connection spacing.
The manually chosen B2 220px gap is unnecessary for these measured groups.

Native label boxes can extend above a row. The scene supplies padding for the
measured outset plus a normal 16px separation; it does not add the old fixed
70px heading spacer. Disconnected sequences remain in the same layered group,
with the native 24px row gap, rather than acquiring large separate panels.

There is also **existing pipeline frame overhead**: measurement initially
estimates a layered container as a linear arrangement, and layout retains the
larger of the measured and positioned extents. Thus the eight-node ViewState
group retains 1960px width although its positioned node span is 1870.816px.
That remaining 89.184px is visible in the proof, not cropped or hidden. Eliminating
it while preserving this grouping would require addressing existing pipeline
behavior, which is outside the authorized scope. No extra fixed-width shell is
added by the proof.

## Vertical solution: a compact context stack with explicit junctions

The local neighborhood uses the existing centered vertical **stack** strategy,
not a modified layered algorithm. Parent and child rows use existing horizontal
stacks. The shared scene's connector-port primitive supplies zero-extent routing
junctions; its native small circles are visible. The junctions add no Component
identities or containment levels.

The connecting bar is represented by distinct, non-overlapping edge segments.
This avoids drawing the same bar several times and avoids any new overlap waiver.
The shared router computes every segment from normal typed endpoints. One labeled
stem joins the focal Component to each multi-node group. Each actual child has
its own arrow; parents feed the incoming stem.

| Dimension | Proof setting | Basis |
| --- | --- | --- |
| Labeled vertical stem | 34px | Native 22px label height + native 12px segment clearance |
| Branch from a node to the connecting bar | 12px | Native minimum terminal-leg length |
| Total node-to-node gap for a multi-parent/child group | 46px | 12px branch + 34px labeled stem |
| Direct single-parent/child gap | 34px | No branch bar needed |
| Side-by-side nodes | 24px | Existing base graph gap |

These are **scene layout inputs actually exercised by the unchanged pipeline**,
not assertions that today's CLI already builds this neighborhood or that every
vertical graph should use 34px. More complex arrangements or changed typography
must be measured and checked again.

Boundary controls confirm why reducing these particular settings is unhelpful:

- At a 33px stem, native label placement falls back and the label crosses its
  connector. The proof rejects this result.
- At an 11px branch, native routing repairs the short terminal leg with long
  detours. It may report no diagnostic, but it loses the direct compact geometry.
  The 12px setting retains straight branch legs with no repair detours.

## Local alignment survives width growth

The Place composition is its own native layered group. Existing typed port
offsets align the taller Place with the shorter Component reference, so the
connector stays horizontal without extra bend space. The anchor offset is
derived from shared node measurement, not assigned after positioning.

Across compact, detailed, and the shortened detailed control:

- Place x = 32px; Component x = 363.622px.
- Local composition gap = 107.622px; label x = 268px.
- The composition connector has the same two endpoints and remains left-anchored.

Longer sequences widen their own region and the enclosing scope; they do not
stretch this local relationship. Outgoing-contract alignment was not retested
in B4, so this result is not presented as evidence for those sections.

## Evidence and limits

[b4_pipeline_evidence.json](b4_pipeline_evidence.json) stores each complete
`RendererScene` input, its unmodified `PositionedScene` output, actual gap metrics,
negative-control results, and hashes of the eight shared implementation files
used. Each saved input can be passed directly to `runStagedRendererPipeline` to
reproduce the geometry, then to `renderPositionedSceneToSvg` for native output.

The sole presentation overlay supplies the requested 10px container-title text
and container colors. Its 19px header bands are reserved in the input scene.
It does not alter node geometry, routing, or connector-label measurement or
placement. The native container-header text composition has a larger minimum
height, so this Figma-like header treatment remains a presentation proposal,
not evidence that the current header builder already implements it.

All seven saved proofs have:

- Zero pipeline/backend diagnostics and zero independent shared routing
  validation violations, with default validation policy and no overlap exemptions.
- No semantic-node overlaps, label/node overlaps, label/label overlaps,
  connector/label intersections, or out-of-bounds nodes, labels, or routes.
- Native semantic-node width of 224px. Representative compact/detailed parent,
  child, State, and ViewState outputs were visually inspected.

The persisted source is unchanged at revision
`rev_fec1fc5b356be868944b67eb2d6134bd6d70f0ca2f290fc515662f061f45fbff`.
Strict validation reports zero errors and the intentional two-parent warning.
Proposed Component description/input/output display and the previously documented
Place metadata policy/runtime mismatch remain as described in B2; this pass does
not resolve them.

**Acceptance:** the scoped spacing invariants pass for these fixtures. B4 is
pipeline-backed evidence for these layouts, not a claim of a globally minimal
layout, complete-sheet coverage, or implemented Component containment. The
remaining native horizontal gap and frame overhead are retained explicitly.
