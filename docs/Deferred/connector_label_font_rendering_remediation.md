# Connector Label Font Rendering Remediation

9-02-26

## Purpose

This note is a handoff for a future task to correct vertical font rendering in staged-renderer connector labels. The shared-node remediation has demonstrated a deterministic approach that renders well as live SVG text in Firefox, VS Code, PNG rasterization, and native SVG-to-Figma import. Apply that approach to connector labels deliberately; do not broaden the work to unrelated text unless new evidence requires it.

## Current Situation

Connector labels are the remaining intentional user of `renderCenteredTextBlock(...)` in `src/renderer/staged/svgBackend.ts`. That serializer currently:

- positions the `<text>` element at the visual center of the label box;
- relies on `dominant-baseline="middle"`;
- uses cumulative `dy` values for subsequent lines.

This delegates vertical alignment to each SVG consumer. Font engines and importers can interpret the middle baseline differently, producing the same proportional upward shift that previously affected shared-node text.

The shared-node implementation now provides the proven alternative:

- `TextMeasurementService.getVerticalMetrics(style)` returns `ascent`, negative `descent`, and `lineGap` in scaled pixels from the same weight-specific vendored font used for horizontal measurement.
- `calculateAlphabeticBaselineOffset(metrics, lineHeight)` centers the font ascent/descent box within the explicit line-height box.
- Shared SVG text emits absolute alphabetic `y` coordinates for every line and does not depend on `middle`, `central`, or cumulative `dy` behavior.

Public Sans 2.001 static OTF/WOFF faces remain the intended fonts. Existing conformance tests prove that the measurement, embedded SVG, and PNG faces agree on units per em, vertical metrics, glyph mapping, and representative advances.

## Required Scope

Change connector-label text rendering only. Preserve:

- connector routing, label placement, collision avoidance, and box geometry;
- `PositionedEdgeLabel` and caller-facing contracts;
- label wrapping, line count, explicit line height, padding, and width measurement;
- live SVG text and the current Public Sans assets;
- edge-label paint order, background rectangle, styling, and semantic classes;
- all shared-node behavior already accepted.

Do not compensate by changing font weight, font size, label-box dimensions, padding, or route geometry. Do not convert text to paths.

## Recommended Implementation

1. Resolve the connector label's effective `TextStyleToken` with the existing backend fallback and diagnostics path.
2. Use the existing renderer `TextMeasurementService` instance rather than opening or selecting another font in the connector-label code.
3. Calculate each line box from the positioned label bounds and its explicit `lineHeight`.
4. Center the complete set of line boxes vertically inside the label box, preserving the current single-line and multiline layout policy.
5. For each line, calculate its alphabetic baseline as:

   `lineBoxTop + calculateAlphabeticBaselineOffset(verticalMetrics, lineHeight)`

6. Emit an absolute `y` on every connector-label `<tspan>`. Remove `dominant-baseline="middle"` and cumulative `dy` from connector labels.
7. Keep the generic/shared-node serializers separated if that makes scope and regression control clearer. Consolidate them only when their contracts genuinely match.

Explicit theme line height remains authoritative. `lineGap` should stay exposed as a font metric, but it must not be added a second time when centering the ascent/descent box within the explicit line height.

## Acceptance Invariants

- Connector-label text has no proportional upward or downward shift at different font sizes.
- Single-line text is optically centered in its existing label box.
- Multiline labels retain their exact configured line spacing and are centered as one block.
- Connector-label SVG contains no `dominant-baseline="middle"`, `dominant-baseline="central"`, or cumulative `dy` positioning.
- Every connector-label line has an explicit absolute alphabetic `y` coordinate.
- Label text, wrapping, widths, heights, padding, routes, endpoints, and collision results remain unchanged.
- Shared-node SVG output remains byte-stable unless a separately approved change requires otherwise.
- SVG and PNG continue to use metrically conformant Public Sans faces.

## Test Plan

- Add focused backend assertions for single-line and multiline connector labels using exact baseline coordinates derived from the configured edge-label font size and line height.
- Assert that consecutive multiline baselines differ by exactly the configured line height.
- Assert absence of `middle`, `central`, and connector-label `dy` dependencies.
- Retain or strengthen assertions for label rectangle bounds, padding, paint order, and semantic classes.
- Prove that `PositionedEdgeLabel` geometry and routed edges are unchanged before updating SVG goldens.
- Run connector-label placement, staged SVG backend, routing, visual-acceptance, and preview-workflow tests.
- Refresh affected SVG goldens only after numeric and structural assertions pass. JSON scene goldens should not change unless the implementation has unintentionally crossed the SVG-backend boundary.
- Compare representative single-line and multiline labels at 100% in Firefox, VS Code, production PNG output, and native SVG-to-Figma import.

Acceptance requires consistent vertical alignment across all four consumers, with no route movement, label-box resizing, altered wrapping, or new collisions.

## Likely Files

- `src/renderer/staged/svgBackend.ts`
- `src/renderer/staged/textMeasurement.ts` only if a genuinely reusable helper is missing
- `tests/stagedSvgBackend.spec.ts`
- `tests/connectorLabelPlacement.spec.ts`
- relevant staged routing and visual-acceptance SVG goldens

Treat broad golden churn, positioned-scene changes, or route changes as evidence of unintended scope expansion rather than expected remediation fallout.
