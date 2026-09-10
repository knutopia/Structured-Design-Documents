# [Done] Shared Node Renderer Acceptance Reference

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

## Emphasized Nodes

Callers opt in per node with `emphasized: true` on `SharedNodeRequest` (or
`SharedNodeContent` when constructing scenes directly). Omitted and `false`
retain regular rendering. Emphasis does not select semantic nodes automatically.

Default emphasis changes only the title to Public Sans Bold (`700`) and the
inside outline to `2px`. The default width remains `224px`; the text interior
is `192px` wide after the outline and body padding. Bold metrics and the reduced
interior participate in wrapping and automatic height. A one-line plain node
remains `224 × 48`; a one-line decorated node becomes `224 × 54`.

The visual exemplar is [Emphasized Node](<node_visual_reference/emphasized_node_visuals/Emphasized Node@2x.png>).

```ts
const result = await renderSharedNodesStagedSvg([
  { ...nodeRequest, emphasized: true }
], { detailId: "detailed" });
```

Global customization uses the existing registered renderer theme. The optional
`sharedNodeEmphasis` section is a recursively partial delta over `sharedNode`;
its `textStyles` section accepts partial tokens for `title`, `decorator`,
`attributeLabel`, and `attributeValue`.

```ts
const theme = structuredClone(getRendererTheme("default"));
theme.id = "my-node-theme";
theme.sharedNode.fill = "#fffaf0"; // Inherited by regular and emphasized nodes.
theme.sharedNodeEmphasis = {
  strokeWidth: 3,
  body: { padding: { left: 18 } }, // Other padding inherits regular values.
  textStyles: {
    title: { fontWeight: 600, letterSpacing: 0 } // Replaces default Bold.
  }
};
registerRendererTheme(theme);
const result = await renderSharedNodesStagedSvg([
  { ...nodeRequest, emphasized: true }
], { detailId: "detailed", themeId: theme.id });
```

Resolution order is regular styling, default emphasis, then custom emphasis.
Text deltas inherit the configured regular text-style roles (or an explicitly
overridden role). Missing fields, including `undefined`, inherit; numeric zero
is an explicit replacement. Register any custom font weights with matching
measurement, SVG, and PNG faces, as for regular styling.

Both chrome and labels expose `shared-node--emphasized`. The complete resolved
style is described by `--sdd-shared-node-emphasized-*` CSS properties, parallel
to the regular properties. Existing structural classes remain available for
CSS targeting. As with regular nodes, the emitted properties document resolved
geometry; changing them in an exported SVG does not remeasure it. Register
geometry or typography changes in the theme before rendering. Paint rules can
be edited directly, for example:

```css
.shared-node--emphasized .shared-node__outline { stroke: #8b4513; }
```

The emphasis state survives shared-height allocation and positioning. Existing
dashed outlines remain dashed. PNG uses the same SVG and vendored Bold font;
ordinary SVGs do not embed an unused Bold face.
