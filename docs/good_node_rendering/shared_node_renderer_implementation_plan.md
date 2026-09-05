# Shared Node Renderer Implementation Plan

## Implementation Status

Phases 1 through 6 are implemented. The canonical Figma metrics, structured contracts, renderer theme, measurement, SVG composition, and standalone production-path harness are in place. `ui_contracts`, `scenario_flow`, `service_blueprint`, `outcome_opportunity_map`, `ia_place_map`, and `journey_map` now use the shared component for every eligible semantic leaf, and each renderer's migration proof has been visually accepted before its goldens were refreshed.

Phase 7 cleanup removed the unconsumed generic `buildCardNode` formatting helper and
documented the final semantic-leaf/container boundary. Its final verification exposed
a real outcome-opportunity routing invariant violation in `multiple_outcomes.sdd`.
That defect is now resolved through the shared routing architecture and verified as
recorded in
[`outcome_opportunity_routing_overlap_remediation_handoff.md`](outcome_opportunity_routing_overlap_remediation_handoff.md).
The unchanged visual oracle passes, corrected artifacts were accepted before refresh,
and the final repository run passes all 1,040 tests. The separately recorded dense
Journey Map readability debt remains outside this migration and is not reclassified
by the routing correction.

## Objective

Build one renderer-owned node component that accepts structured semantic content and produces a fully composed, measured, and drawable node for every staged diagram renderer.

The caller supplies only:

- title
- decorator mode
- node type
- node ID
- ordered attributes

The shared node renderer owns:

- decorator selection and formatting
- consolidation of repeated attributes under one label
- title and attribute wrapping
- typography and line heights
- plain-versus-dense behavior
- internal spacing and alignment
- node dimensions
- internal element geometry
- local connection anchors
- SVG structure, classes, and styling hooks

Diagram-level layout continues to own placement of the completed node among other scene items and routing of relationships between nodes.

## Source Roles and Authority

Use the supporting materials according to the following hierarchy:

1. `solving_for_good_node_rendering.md` defines the intended structural behavior and composition.
2. The Figma **Components** section defines canonical component parameters, including explicit line heights. When a composed example uses Figma's `Auto` line height, use the corresponding value from the Components section.
3. The Figma **Node Reference Visuals** section is the visual exemplar and acceptance matrix for composed nodes.
4. `unified_node.sdd` is a supporting topology overview only. It is not the source of visual, layout, cardinality, or styling behavior.
5. Renderer architecture and pipeline constraints in `AGENTS.md` remain mandatory.

Node presentation is renderer-owned. Do not move these conventions into the SDD bundle unless a separate change genuinely alters the semantic view contract.

## Non-Negotiable Invariants

- Callers do not select plain or dense rendering.
- Callers do not provide line breaks, line counts, dimensions, padding, typography, colors, or other visual formatting.
- Repeated attributes are grouped and formatted by the shared renderer, not by caller-built strings.
- All staged diagram renderers use the same node composition, typography, wrapping, and internal-layout machinery after adoption.
- The staged pipeline remains explicit:

  `projection -> RendererScene -> MeasuredScene -> PositionedScene -> SVG -> PNG`

- The standalone proof uses production scene, measurement, positioning, font, and SVG paths. It must not introduce a parallel `Node -> SVG` shortcut.
- Geometry-affecting style values are resolved before measurement.
- Canonical line heights come from the Figma Components section and are exposed through the renderer's CSS/theme surface.
- Public Sans Regular and SemiBold faces used for measurement, SVG, and PNG remain deterministic and complete.
- Multiline SVG text uses deterministic `<tspan>` structure and explicit resolved line heights.
- Stored text artifacts use canonical LF newlines.
- Existing legacy Graphviz and Mermaid outputs remain unchanged unless a later step explicitly includes them.
- Goldens and corpus artifacts are updated only after the relevant acceptance invariants pass.

## Target Architecture

### Semantic Request

Define a renderer-owned shared-node request containing semantic content rather than preformatted display lines.

Attributes should retain enough structure for the renderer to group them deterministically. Each attribute needs a stable grouping identity, display label, value, and source order. The renderer should preserve the first occurrence of each group and preserve value order within that group.

Decorator mode should be a closed semantic choice:

- `none`
- `type`
- `id`
- `type,id`

The shared renderer validates required content for the selected mode and produces diagnostics for missing type or ID data rather than silently constructing malformed header text.

### Staged Ownership

Keep shared-node behavior aligned with the existing stages:

- **RendererScene:** structured node content and semantic roles; no final coordinates or final line breaks.
- **MeasuredScene:** resolved text lines, natural sizes, minimum sizes, and measured internal regions.
- **PositionedScene:** final node allocation and finalized internal positions, including handling of surplus height imposed by macro layout or shared-height groups.
- **SVG backend:** stable SVG elements, classes, embedded fonts, and CSS generated from the same resolved theme used during measurement.

The node component may coordinate these stages behind a focused internal API, but it must not collapse or bypass their contracts.

### Theme and CSS Ownership

Place shared-node design values in the renderer-owned theme layer. Add a dedicated shared-node theme section or factor it into a renderer-owned module that is included by `RendererTheme`.

Organize the values by structural role:

- node container
- decorator header
- node body
- node title
- attribute group
- attribute label
- attribute content

The theme must cover every design-defining value listed in `solving_for_good_node_rendering.md`, including:

- font family
- font size
- font weight
- letter spacing
- line height
- padding
- gaps
- minimum height
- header height
- node width
- corner radius
- stroke width
- stroke placement
- text colors
- container and header backgrounds
- stroke colors

Expose stable SVG classes and CSS custom properties for these roles. CSS is an output and customization surface over the resolved renderer theme; it is not a second backend-only source of geometry.

Paint-only overrides may be applied without remeasurement. Any override affecting font metrics, wrapping, width, height, padding, gaps, or other geometry must be resolved into the effective theme before measurement.

## Phase 1: Freeze Acceptance Inputs

Before implementation, extract and record the exact Figma Components values for every shared-node role.

Create an acceptance matrix covering at least:

- plain single-line title without a header
- single-line title with a header
- multiline title without a header
- multiline title with a header
- each decorator mode
- one attribute group with one value
- one attribute group with multiple values
- multiple attribute groups
- repeated attributes consolidated under one label
- long attribute labels
- wrapped attribute values
- the most content-dense Figma example

For each case, record:

- semantic input
- expected grouping
- expected wrapped lines
- expected width and height
- expected internal region sizes and positions
- expected typography and line heights
- expected visible decorator content
- expected CSS classes and variables

### Phase 1 Exit Criteria

- Every Figma example maps to one unambiguous semantic request.
- Every Figma `Auto` line height has a canonical explicit value from the Components section.
- Every geometry- and paint-affecting value has one renderer-theme owner.
- No acceptance rule depends on a caller choosing a visual variant.

## Phase 2: Define Shared Contracts

Extend the renderer-owned scene contracts so node content remains structured through the measurement boundary.

The contracts must represent:

- optional decorator region
- node body
- title
- zero or more attribute groups
- one or more values per attribute group
- semantic text-style roles
- natural and minimum sizing information
- local connection-anchor requirements

Avoid encoding node structure as punctuation-sensitive strings or inferred label lines. Existing callers should be adapted to provide structured content.

Define diagnostics for:

- missing data required by decorator mode
- unsupported or empty attribute data
- unavailable font weight
- invalid or incomplete shared-node theme values
- overflow or degraded wrapping

### Phase 2 Exit Criteria

- A caller can describe every acceptance case without supplying presentation data.
- Scene contracts remain backend-agnostic.
- Changing structured input changes grouping and display without caller-side formatting.
- Changing the effective theme changes measurement behavior.

## Phase 3: Implement Shared Measurement and Internal Layout

Implement the composition inside-out:

1. Normalize and group ordered attributes.
2. Resolve visible decorator items from decorator mode.
3. Resolve the effective node theme and font faces.
4. Compute the available inner widths.
5. Measure and wrap title, labels, and values using the production text-measurement service.
6. Measure attribute groups from their child content.
7. Measure the node body from the title and attribute groups.
8. Measure the optional fixed-height decorator header.
9. Enclose the measured regions in the node container.
10. Apply minimum-height behavior and finalize internal vertical alignment.

Plain/dense behavior must be a layout result, not an input flag:

- A title-only node whose natural body is shorter than the minimum allocation expands to the minimum height and vertically centers the title.
- Nodes with a header, wrapped title, or attribute groups use normal content flow and hug measured content unless a later layout stage allocates additional height.

Shared-height groups and other macro-layout policies can enlarge a node after natural measurement. The shared node component must therefore finalize surplus-space alignment after the final box allocation is known. Macro layout supplies the allocation; it does not decide how the shared node arranges its internal content.

### Phase 3 Exit Criteria

- Line wrapping is deterministic for the vendored fonts.
- Repeated attributes consolidate deterministically.
- All decorator modes render the correct items.
- Plain title centering is automatic.
- Dense nodes grow solely from measured content.
- Additional allocated height does not produce accidental top-alignment or clipping.
- Stroke placement and inner dimensions match the Figma model.

## Phase 4: Build a Standalone Production-Path Harness

Create a focused harness that renders one or more shared nodes at known origins while using the real production stages.

The harness should produce inspectable SVG artifacts for the acceptance matrix and expose intermediate scene data for tests:

- structured RendererScene node
- measured node
- positioned node
- final SVG

Test at three levels:

### Contract and Unit Tests

- attribute grouping and order
- decorator selection
- missing decorator data diagnostics
- width calculation
- wrapping boundaries
- minimum-height threshold behavior
- plain-title centering
- multiline positioning
- long unbroken tokens and Unicode graphemes

### Measurement and Structure Tests

- exact expected node dimensions
- exact internal region dimensions
- exact resolved line heights
- CSS/theme overrides affecting measurement
- all required font weights resolving to complete assets
- stable SVG class names and `<tspan>` structure

### Visual Proofs

- one artifact corresponding to each Figma acceptance case
- side-by-side review against the Figma Node Reference Visuals
- no cropped text, overlap, incorrect centering, or inconsistent spacing

### Phase 4 Exit Criteria

- The explicitly referenced Figma proof cases are visually acceptable.
- Structural and measurement tests pass without snapshot-only normalization.
- Theme/CSS changes that affect geometry are proven to remeasure the node.
- The harness uses no implementation path unavailable to real diagram renderers.

## Phase 5: Adopt in One Existing Renderer

Use `ui_contracts` as the first integration proof case unless repository inspection at implementation time reveals a materially simpler and more representative staged renderer.

The linked `unified_node.sdd` can serve as one integration fixture because it already exercises component titles, descriptions, type/ID decorators, and the `ui_contracts` projection. Add or select fixtures that also exercise repeated attributes and wrapped content; do not rely on that document alone for complete coverage.

For the proof renderer:

1. Adapt projected semantic data into the shared-node request.
2. Remove caller-side line formatting and style selection for migrated nodes.
3. Route node measurement and internal positioning through the shared component.
4. Preserve macro placement, ports, routing, containers, and view semantics.
5. Compare standalone and integrated rendering for equivalent node inputs.
6. Inspect variable heights, shared-height behavior, edge attachment, and routing.

### Phase 5 Exit Criteria

- The selected renderer uses the shared node path for all eligible semantic nodes.
- No local node typography, centering, or attribute-formatting branch remains for migrated nodes.
- Projection behavior is unchanged.
- Macro layout and routing remain acceptable.
- The integration proof case satisfies the same node invariants as the standalone harness.
- Goldens are refreshed only after the proof is accepted.

## Phase 6: Incremental Adoption Across Staged Renderers

Migrate remaining staged renderers one at a time, ordered from least to most coupled to specialized grid, lane, or hierarchy layout.

For each renderer:

1. Inventory its current node inputs, annotations, width policies, ports, and layout coupling.
2. Map semantic data into the shared request without preformatting strings.
3. Identify any apparent gap in the shared component.
4. Fix genuine shared-layer gaps in the shared contracts, theme, measurement, or SVG layer.
5. Do not add renderer-specific internal-layout branches to reproduce accidental legacy variation.
6. Prove one renderer-specific fixture before regenerating broader artifacts.
7. Run focused tests, then the full staged-renderer and corpus suites.

Intentional semantic differences may affect the supplied content or external placement. They should not produce independent typography, padding, wrapping, or plain/dense rules.

### Phase 6 Exit Criteria

- All eligible staged semantic nodes use the shared component.
- Diagram builders provide semantic requests rather than presentation instructions.
- Shared node appearance and typography are consistent across diagram types.
- Specialized macro layout, containers, routing, and ports remain renderer-specific where appropriate.
- Duplicated node-formatting and internal-layout code is removed only after all consumers have migrated.

## Phase 7: Documentation, Cleanup, and Final Verification

Document:

- the semantic caller contract
- the shared node composition
- the renderer-owned theme and CSS variables
- the rule that Figma Components supply canonical line heights
- plain/dense automatic behavior
- the boundary between node internal layout and diagram macro layout
- how geometry-affecting CSS customization triggers remeasurement

Complete final verification:

- focused shared-node tests
- staged renderer tests
- font regression tests
- deterministic SVG tests
- rendered corpus tests
- PNG derivation from SVG
- comparison of representative nodes across all diagram types
- confirmation that legacy paths are unchanged

### Phase 7 Verification Record

Verification on 2026-09-03 established the following state:

- TypeScript compilation passes.
- Focused shared-node, renderer-stage, routing, preview, SVG/PNG, and rendered-corpus coverage for the migrated behavior passes across all adopted renderers. The sole known visual-invariant exception is the managed outcome-opportunity overlap described below.
- The Journey suites affected by the final migration pass in focused and serial runs. During the fully parallel repository run, six individual Journey tests exceeded their 5-second timeout under load; all six passed when the four affected files were rerun serially (`98/98`). These are load-related timeouts, not assertion failures.
- The broad repository run produced `1006` passing tests and one substantive assertion failure: the managed `multiple_outcomes.sdd` route overlap recorded in [`outcome_opportunity_routing_overlap_remediation_handoff.md`](outcome_opportunity_routing_overlap_remediation_handoff.md). The remaining six failures in that run were the serially cleared timeouts above.
- Legacy DOT and Mermaid suites pass. Preview backend selection, vendored-font regression, deterministic staged SVG, rendered-corpus inventory, and SVG-derived PNG coverage pass.
- No outcome-opportunity golden or public corpus artifact was refreshed after discovery of the overlap.

At the 2026-09-03 Phase 7 checkpoint, the documentation and cleanup work assigned to
the adoption thread was complete, but the repository-wide all-tests-green completion
gate remained explicitly unsatisfied pending the managed routing remediation.

Resolution addendum, 2026-09-05: the managed outcome-opportunity defect was corrected
through shared physical-segment aggregation, deterministic assignment,
reconstruction, and final validation. The focused routing and unchanged visual suites
pass, the accepted public proof was regenerated, and the repository-wide completion
gate is now satisfied with 109 test files and 1,040 tests passing. The preceding Phase
7 verification bullets are retained as the historical pre-remediation record.

## Acceptance and Stop Conditions

After every substantial phase, report:

- satisfied invariants
- violated invariants
- whether the proof output is acceptable
- whether broader adoption or golden refresh is allowed

Stop rather than generalize when:

- a Figma proof case is structurally or visually wrong
- CSS output and measurement use different effective values
- line-height or font metrics remain ambiguous
- a caller must provide line breaks, line counts, or plain/dense state
- repeated attributes still require caller-side formatting
- shared-height allocation produces incorrect internal alignment
- a golden update would conceal a regression
- a proposed change would bypass the staged pipeline
- implementation begins to place renderer-owned presentation conventions in the bundle

## Deliverables

- acceptance matrix derived from Figma
- renderer-owned shared-node theme and CSS contract
- structured shared-node scene contracts
- shared measurement and internal-layout implementation
- standalone production-path harness
- contract, measurement, SVG-structure, and visual tests
- one accepted integration proof renderer
- incremental migrations for remaining staged renderers
- updated documentation
- final accepted rendered corpus evidence
