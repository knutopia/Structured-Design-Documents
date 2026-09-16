# [Done] B5: connector and header refinement

This pass addresses the user's annotated screenshot without changing shared
layout, routing, measurement, or backend source code. B4 remains the spacing
baseline. The saved B4 scene inputs survived the crash and were used to recover
the work; no incomplete B5 output was present before recovery.

## Review SVGs

| Focus | Compact, decorators none | Detailed, decorators none | Detailed, decorators type,id |
| --- | --- | --- | --- |
| Two parents and one child | [SVG](b5_component.compact.svg) | [SVG](b5_component.detailed.svg) | [SVG](b5_component.detailed.decorators-type-id.svg) |
| Four children, with State sequences in detailed | [SVG](b5_children.compact.svg) | [SVG](b5_children.detailed.svg) | [SVG](b5_children.detailed.decorators-type-id.svg) |
| Place composition and ViewState sequences | [SVG](b5_place.compact.svg) | [SVG](b5_place.detailed.svg) | [SVG](b5_place.detailed.decorators-type-id.svg) |

Additional controls:

- [Compact with type and ID decorators](b5_component.compact.decorators-type-id.svg),
  demonstrating that decorators are independent in both directions.
- Shortened Place sequence: [no decorators](b5_place.short.detailed.svg) and
  [type and ID decorators](b5_place.short.detailed.decorators-type-id.svg).

These are clean, focused excerpts, not complete UI-contract sheets. The overview,
outgoing-contract sections, and ViewState composition references remain outside
this proof pass. Editorial explanations are confined to this guide.

## Connector turns

B4's circles were painted by the native `connector_port` node primitive; they
were not necessary to communicate containment. B5 replaces those scene items
with empty, invisible stack containers carrying typed ports at offset zero.
This is an existing scene capability, not a new router or a CSS workaround that
hides unwanted marks. The anchors have no semantic identity and no layout extent.

At matching detail and decorator settings, every semantic node and every routed
edge—including its connector label—matches B4's saved positioned output exactly.
The connecting bars still consist of non-overlapping routed segments, with one
`Contains` label on each common stem. No visible junction circles remain.

## Container headers

The previous pill-shaped header fill is replaced by an inset rectangular band
clipped to the container's interior. Only the top corners follow the outer
rounding; the lower edge is flat. The full outline is painted last, so the fill
cannot obscure it.

The treatment uses the established shared-node reference values: 14px corner
radius, 1.5px inside stroke, 19px header fill, `#dbe4f0`, and Public Sans SemiBold
10px title text with 14px horizontal inset. Container body and outline colors
remain distinct from semantic nodes. See the
[shared-node acceptance reference](../good_node_rendering/shared_node_renderer_acceptance.md).

This remains a proof-only container-paint treatment applied to the container
boxes produced by the pipeline. It does not move or resize those boxes or modify
the shared backend. The earlier 19px header reservation remains in the scene.
The Figma tool was rate-limited during this pass, so the shape was checked against
the user's screenshot and the recorded reference values, not a fresh Figma export.

## Detail does not enable decorators

`--detail detailed` selects content. `--decorators type,id` selects node headers.
Neither setting implies the other. The actual CLI flag is `--detail` (singular).
When decorators are omitted, the existing independent user preference and then
bundle fallback apply; detail must not override that resolution.

The B5 plain filenames explicitly represent `decorators=none`; filenames ending
in `.decorators-type-id.svg` represent an explicit `type,id` selection. Thus the
detailed plain proof includes richer content without type/ID headers. No CLI,
bundle, or user preference was changed. This follows the existing
[CLI option contract](../doc_site/sdd_cli_tools/index.md).

## Right-edge space: confirmed shared-pipeline behavior

The extra width is from shared measurement/layout, not connector routing clearance
and not a fixed width added by the proof. Measurement estimates a layered group
as a single linear row; layout retains that estimated width when it exceeds the
actual layered arrangement:

- [microLayout.ts](../../src/renderer/staged/microLayout.ts):
  `estimateContainerContentSize`, `estimateLinearContentSize`.
- [macroLayout.ts](../../src/renderer/staged/macroLayout.ts):
  `layoutContainer`, where positioned width retains `container.width`.

| Affected group | Retained group width | Actual node span | Extra width, before normal scope padding |
| --- | --- | --- | --- |
| Load Workbench, two State sequences | 1960px | 1877.44px | 82.56px |
| Departure Desk, two ViewState sequences | 1960px | 1870.816px | 89.184px |

The visible gap to the scope edge includes another 16px of ordinary padding.
The shortened two-sequence control shows the same mechanism more strongly:
968px retained width versus a 635.704px node span.

B5 retains these extents under the unchanged-shared-pipeline constraint. It does
not crop them, shrink the measured boxes afterward, or regroup the sequences to
make the problem disappear. This is a documented remaining pipeline limitation,
not a claim that the blank area is desirable or needed by the connector geometry.

## Verification

[b5_pipeline_evidence.json](b5_pipeline_evidence.json) records all twelve scene
inputs, unmodified positioned outputs, decorator choices, width measurements,
and shared-source hashes. Every saved input was rerun and reproduced its saved
positioned output exactly (JSON-normalized).

All twelve proofs pass native pipeline/backend diagnostics, independent shared
routing validation, semantic-node and label overlap checks, route/label checks,
and node/label bounds checks. Native semantic nodes remain 224px wide. The seven
configurations matching B4's settings additionally preserve its semantic node
geometry, connector geometry, and canvas dimensions exactly. Representative
compact, detailed decorated, and detailed undecorated outputs were visually
inspected; none contain SVG circle elements.

Satisfied: removal of circles, intact flat-bottomed headers, decorator/detail
independence, and preservation of verified spacing. Remaining limitation: the
explicitly measured native right-edge excess. No shared source or SDD changes
were made. Existing B4/B2 content-policy proposals and implementation caveats
still apply; these SVGs are not current CLI containment output.
