# Adding Staged Renderers

This guide is for contributors and LLM agents adding or extending staged renderers.
It is the operational companion to [renderer_migration_guidance.md](renderer_migration_guidance.md):
use that document for architecture background, and use this one to decide where
new renderer behavior belongs.

The goal is not to make every diagram look the same. The goal is to keep every
renderer on the same semantic and layout boundaries so future views, visuals,
and artifact targets can share infrastructure instead of growing one-off
rendering paths.

## First Decision

Start by identifying which kind of work this is.

| Work type | Start here | Main proof |
| --- | --- | --- |
| New visual for an existing diagram/view | Projection output and staged scene builder | A proof-case staged artifact is readable, deterministic, and covered by stage goldens |
| New staged renderer for a new diagram/view | Bundle view definition, projection builder, examples, then renderer | Projection is specified and tested before renderer output is accepted |
| Renderer infrastructure improvement | Shared staged layer that owns the concern | Existing renderer behavior is preserved or intentionally migrated with evidence |
| Future non-SVG target adapter | `PositionedScene` or an explicit backend-neutral post-positioning export | Target-specific loss and capabilities are declared, with no target payload leaking into earlier stages |

If the feature requires a new source-level convention, parser behavior,
validation rule, view scope, or renderer default, resolve the bundle contract
first. Do not hide spec behavior inside renderer code.

## Non-Negotiable Invariants

- `bundle/v0.1/` governs machine-readable spec and view behavior.
- Projection is the semantic boundary between graph semantics and rendering technology.
- The staged path remains `Projection -> RendererScene -> MeasuredScene -> PositionedScene -> target adapter`.
- `RendererScene` contains renderer-owned primitives and intent, not final geometry.
- `MeasuredScene` owns intrinsic measurement, text wrapping, content block frames, local ports, and overflow outcomes.
- `PositionedScene` owns absolute positions, routed connector geometry, final label positions, decorations, paint order, and renderer diagnostics.
- SVG is the current first-class artifact target.
- PNG is derived from SVG, not from a separate parallel scene renderer.
- Future targets must not leak Figma, Miro, Mural, PPTX, API payloads, external layout JSON, DOT, Mermaid, or SVG strings into `RendererScene`.
- Renderer changes must preserve parser, compiler, validator, and projection behavior unless the task explicitly changes those layers.
- Snapshot or golden updates are evidence capture only. They do not define acceptance.

Legacy DOT, Mermaid, and Graphviz-backed preview paths may still exist. New
renderer authoring should not be designed around replacing those paths unless a
specific migration task asks for that.

## Responsibility Boundaries

Put new behavior in the layer that owns it.

| Layer | Owns | Must not own |
| --- | --- | --- |
| Bundle | Machine-readable view conventions, renderer defaults, profiles, contracts | Hidden TypeScript-only spec rules |
| Projection | Scope, groups, derived annotations, omissions, projection notes | Pixel sizes, wrapping, coordinates, routes, SVG |
| Scene builder | Primitives, hierarchy, order hints, semantic classes, layout intent, width and overflow policies, port declarations, edge routing preferences | Text measurement, final coordinates, route polylines, target payloads |
| Micro-layout | Font-backed measurement, wrapping, width-band escalation, content block frames, local node ports, overflow diagnostics | Global placement, route selection |
| Macro-layout | Recursive placement, container bounds, absolute positions, container-port resolution | Semantic derivation, target-specific emission |
| Routing | Port selection, connector paths, label placement, route fallback diagnostics | Parser/projection semantics, SVG string assembly |
| Decorations | Positioned visual chrome such as lane titles, separators, and background bands | Semantic derivation that belongs in projection |
| Target adapter | File or API output from positioned geometry | Measurement, placement, routing, hidden spec conventions |
| Preview registry | Backend capability and default preview routing | Renderer semantics or layout policy |

When a change seems to cross more than one layer, split it. For example, a new
annotation may require projection data, scene-builder mapping, micro-layout
measurement, and SVG emission. Do not solve that by reading raw graph edges in
the SVG backend.

## Input Expectations

Renderer code may use:

- the exported `Projection` for semantic view data
- the compiled graph for renderer-supporting lookup where existing staged
  renderers already use it
- the `ViewSpec` from the loaded bundle
- the selected profile id and display policy
- staged theme tokens
- author-order metadata that compilation attaches for renderer use

Renderer code must not use:

- raw `.sdd` source text
- parser internals
- validation-rule internals
- literal keyword lists, node kind lists, edge kind lists, profile ids, or view
  conventions that should come from the bundle
- target-specific payload formats before the target adapter

For a new diagram/view, implement and test projection before renderer output.
The renderer should consume the projection contract; it should not compensate
for missing projection semantics by rediscovering them from lower-level data.

## Staged Scene Authoring

Build `RendererScene` as a backend-agnostic visual intent tree.

Use stable ids. Element ids should be deterministic across runs and should make
stage snapshots useful. Avoid ids based on traversal accidents that could change
when unrelated source content moves.

Use shared primitives and helpers first. The staged renderer contracts live in
`src/renderer/staged/contracts.ts`, common builders live in
`src/renderer/staged/sceneBuilders.ts`, primitive rules live in
`src/renderer/staged/primitives.ts`, and theme tokens live in
`src/renderer/staged/theme.ts`.

Declare layout intent, not geometry. A scene builder may choose a layout strategy
and routing preferences, but it should not compute final coordinates, final line
breaks, measured dimensions, or route polylines.

Declare ports as semantic routing anchors. Ordinary node and container ports are
internal geometry, not visible dots. Only use visible `connector_port`
primitives when the view intentionally exposes ports as part of the diagram.

Use semantic classes and theme roles. Do not put raw style decisions throughout
view-specific builders when a theme token or shared primitive rule can own the
choice.

Use width and overflow policies explicitly. Text-bearing primitives should say
whether they can grow taller, escalate width bands, clamp with ellipsis, move
secondary content, or emit diagnostics.

Treat external layout engines as exceptional. New work should prefer the shared
staged placement and routing infrastructure. Do not add or expand external
layout-engine use unless a task explicitly includes that architectural decision.

## Measurement, Placement, And Routing

Measurement happens before global placement.

- Measure with the shared staged text measurement service and vendored fonts.
- Wrap text by measured width, not character count.
- Use width bands rather than arbitrary per-node widths.
- Emit diagnostics for clamping, overflow, unsupported primitive combinations,
  or degraded measurement outcomes.
- Never let text silently collide with borders or adjacent content.

Placement happens recursively.

- Lay out children before parent bounds are finalized.
- Reserve container chrome, header bands, padding, and gutters in macro-layout.
- Keep absolute x/y positions out of `RendererScene`.
- Keep final route geometry out of `MeasuredScene`.
- Keep target-specific drawing details out of macro-layout.

Routing happens after placement.

- Resolve declared ports or documented fallback anchors.
- Keep arrowheads readable by preserving terminal leg clearance where geometry allows.
- Avoid node and label collisions before accepting output.
- Prefer deterministic route ordering and deterministic fallback behavior.
- Emit renderer diagnostics when routing degrades.

## Visual Quality Checklist

Rendering quality is an acceptance criterion, not a side effect of tests.

Before broadening a renderer or refreshing goldens, inspect the proof case for:

- readable labels at normal preview size
- no clipped text
- no incoherent overlaps between labels, nodes, decorations, or connectors
- consistent alignment of related items
- intentional whitespace and gutters
- minimal avoidable connector crossings
- arrowheads that are not cramped against bends or node borders
- labels placed near the relationship they describe
- decoration chrome that clarifies structure without dominating content
- stable ordering that matches source order, semantic order, or an explicitly documented view order
- diagnostics for any fallback, clamping, parking, or degraded route behavior

For LLM-authored changes, prefer one strong proof case over broad golden churn.
Do not update snapshots to normalize output that still violates these checks.

## Target Adapters Beyond SVG

The current primary path is `PositionedScene -> SVG`, with PNG derived from SVG.
Future targets may include file formats or API handoffs such as Figma plugins,
Miro, Mural, slide decks, or other diagramming systems.

A future target should consume `PositionedScene` or a deliberately introduced
backend-neutral post-positioning export. It must not reach back into parsing,
compilation, validation, or projection to recover semantics.

Ask these questions before designing a target adapter:

- Is the target static, editable, or synchronized?
- Is the output a file artifact, API handoff, or live update?
- Does the target support grouped or layered objects?
- Does it support native connectors, or only paths?
- Does it support precomputed text lines, native text wrapping, or both?
- Does it support arrow markers, rounded rectangles, clipping, opacity, and embedded fonts?
- Does it preserve stable object ids across exports?
- Does it need semantic metadata for inspection, round-tripping, or later synchronization?
- Which staged features will be exact, approximated, or dropped?

Target adapters must declare loss. Examples:

- SVG should prioritize visual fidelity and deterministic static output.
- PNG is raster-only and loses editability and semantic object identity.
- Editable diagramming targets may preserve groups and native shapes while
  approximating typography, connector routing, or arrow markers.
- API targets may need target-owned object ids, but those ids belong in adapter
  state or handoff metadata, not in `RendererScene`.

If a target needs information missing from `PositionedScene`, classify the gap:

- semantic data belongs in the bundle and projection
- visual or layout data belongs in staged scene, measurement, positioning,
  routing, diagnostics, or theme
- target-specific data belongs only in the target adapter

## Integration Points

For an existing view with a new staged visual:

1. Confirm projection already exposes the semantics the renderer needs.
2. Build or update the staged scene builder.
3. Reuse shared measurement, macro-layout, routing, decorations, and target adapters where possible.
4. Register preview capability and default backend through the renderer capability plumbing.
5. Add proof-case stage and artifact coverage.

For a new diagram/view:

1. Add the view and downstream conventions to `bundle/v0.1/`.
2. Add example coverage and projection snapshots through the bundle manifest.
3. Implement and register a projection builder.
4. Only then implement staged renderer scene construction.
5. Register renderability and preview support after projection and renderer tests prove the path.

For renderer infrastructure:

1. Identify the shared staged layer that owns the behavior.
2. Prove the change on the smallest renderer or fixture that exercises the gap.
3. Preserve existing renderer outputs unless the task explicitly changes them.
4. Refresh wider goldens only after acceptance invariants pass.

## Evidence And Tests

Use evidence that matches the risk of the change.

Expected coverage for a new staged renderer includes:

- `RendererScene` snapshot
- `MeasuredScene` snapshot
- pre-routing `PositionedScene` snapshot where routing is complex
- final `PositionedScene` snapshot
- SVG or future target artifact golden
- diagnostics coverage for fallback or degraded output
- CLI or rendered-corpus proof case when public preview behavior changes

Keep tests focused until the proof case is acceptable. Then broaden coverage to
representative examples, profiles, and dense cases.

Do not refresh snapshots before checking the visual output against the quality
checklist. If tests pass but the proof case is visually confusing, clipped,
overlapping, or semantically misleading, the renderer is not done.

## Author Checklist

Before implementing:

- Identify whether the work is an existing-view visual, new-view renderer,
  infrastructure change, or target adapter.
- List the non-negotiable invariants that apply.
- Name the bundle files that encode any machine-readable spec behavior.
- Name the projection entrypoint that should supply renderer semantics.
- Choose the staged layer that owns each behavior change.
- Pick one proof case and define what acceptable output means.

Before finishing:

- Verify no target-specific payload leaked before the target adapter.
- Verify no hidden bundle convention was duplicated in renderer code.
- Verify text measurement, placement, routing, and emission stayed in their stages.
- Verify diagnostics expose fallback or degraded output.
- Verify stage snapshots and artifact goldens demonstrate the accepted behavior.
- Verify the proof case passes human visual review.
