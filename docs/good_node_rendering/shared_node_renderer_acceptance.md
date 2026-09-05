# Shared Node Renderer Acceptance Reference

This file records the design values and proof cases used to implement the shared staged node renderer. The structural contract comes from `solving_for_good_node_rendering.md`; the values below come from the Figma **Components** section. The Figma **Node Reference Visuals** section remains the visual exemplar.

## Canonical Component Values

| Role | Values |
| --- | --- |
| Node | width `224px`; minimum height `48px`; inside stroke `1.5px`; radius `14px`; fill `#ffffff`; stroke `#387575` |
| Node container layout | vertical; padding `0`; gap `0` |
| Decorator header | height `19px`; horizontal padding `14px`; item gap `4px`; fill `#dbe4f0` |
| Decorator text | Public Sans SemiBold; `10px`; line height `12px`; letter spacing `0` |
| Body | vertical padding `6px`; horizontal padding `14px`; item gap `4px` |
| Title | Public Sans SemiBold; `16px`; line height `19px`; letter spacing `-2%` (`-0.32px`) |
| Attribute group | padding `0`; item gap `2px` |
| Attribute label | Public Sans Regular; `10px`; line height `12px`; letter spacing `0` |
| Attribute value | Public Sans Regular; `12px`; line height `14px`; letter spacing `0` |

The inside stroke leaves a `221px` interior. Body padding leaves `193px` for title, label, and value text. All line heights are explicit even where composed Figma examples display `Auto`.

## Deterministic Size Proofs

| Semantic content | Header | Result |
| --- | --- | --- |
| One-line title, no attributes | none | plain, `224 × 48`; title centered vertically |
| One-line title, no attributes | type or ID | dense, `224 × 53` |
| Two-line title, no attributes | none | dense, `224 × 53` |
| Two-line title, no attributes | type or ID | dense, `224 × 72` |
| Two-line title, two attribute groups with three total values | type and ID | dense, `224 × 152` |

Repeated attributes with the same `groupId` form one group. Group order follows first occurrence; value order follows source order. The caller does not supply line breaks, line counts, dimensions, or a plain/dense variant.

## Implementation Surface

- `sharedNode.ts` owns normalization, grouping, measurement, and automatic plain/dense layout.
- `sharedNodeRenderer.ts` is the standalone production-path harness. It uses the regular RendererScene, measurement, macro-layout, SVG, and SVG-to-PNG stages.
- `uiContracts.ts` is the first existing renderer adoption.
- `theme.ts` owns all geometry, typography, and paint values.
- `svgBackend.ts` emits stable structural classes and `--sdd-shared-node-*` CSS values, including all four canonical line heights.

The SVG classes are the editable CSS targeting surface. Geometry-affecting customization must be resolved into a registered renderer theme before measurement; the emitted CSS values then describe that same effective theme.
