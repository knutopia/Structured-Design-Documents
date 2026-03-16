# Toolchain Architecture

## Goal

The v0.1 toolchain provides one shared TypeScript engine with three thin CLI commands:

- `sdd compile`
- `sdd validate`
- `sdd render`

The bundle in `bundle/v0.1/` is the source of truth for language behavior. The engine implements generic interpreters for:

- syntax loading and parsing
- graph compilation and canonicalization
- rule execution
- view projection builders
- text rendering for renderable views

The engine does not hardcode v0.1 domain semantics beyond the generic primitives needed to execute the bundle.

## Pipeline

The engine runs this pipeline:

1. `loadBundle`
2. `parseSource`
3. `compileSource`
4. `validateGraph`
5. internal `projectView`
6. `renderSource`

The staged renderer migration also introduces an internal-only renderer pipeline after projection for staged SVG work:

1. `RendererScene`
2. `MeasuredScene`
3. `PositionedScene`

Each stage has a narrow responsibility:

- `loadBundle` resolves the v0.1 manifest and loads vocab, syntax, schema, contracts, profiles, and views.
- `parseSource` interprets `syntax.yaml` and produces a source-spanned parse document.
- `compileSource` flattens authoring blocks into canonical graph JSON, preserves author-order metadata for renderers, and validates the graph against `core/schema.json`.
- `validateGraph` executes generic validation rules from contracts plus the selected profile.
- `projectView` resolves the requested bundle view through a shared projector registry and creates a normalized projection envelope for that view.
- `renderSource` resolves renderable views through a renderer registry and turns their projections into DOT or Mermaid text.

## Internal Forms

Lean v0.1 still keeps the public-facing semantic spine small:

- a parse document with source spans
- a canonical compiled graph with non-serialized author-order metadata attached for renderer use
- a renderer-facing projection envelope used as the semantic input to rendering

The renderer migration now adds internal staged-renderer forms under `src/renderer/staged/`:

- `RendererScene`, which maps projection semantics onto renderer-owned primitives without coordinates
- `MeasuredScene`, which records intrinsic content sizing and wrapped text without global placement
- `PositionedScene`, which records absolute placement and routed connector geometry for backend painting

These scene forms are internal contracts only. They are not new CLI outputs, they do not change bundle or projection contracts, and the current DOT, Mermaid, and Graphviz-backed preview flows remain the active execution path.

Step 3 turns `MeasuredScene` into a real micro-layout boundary rather than a placeholder copy:

- staged measurement now resolves a shared renderer theme before sizing
- text is measured from vendored Public Sans font assets with a pure Node service
- width-band selection, text wrapping, explicit clamping, and secondary-area fallback happen before any macro-layout
- measured nodes now carry wrapped lines, local content block frames, local port offsets, and explicit overflow outcomes
- container child measurement is recursive, but container bounds and container-port offsets remain deferred until the macro-layout step

Step 4 adds the first staged artifact backend on top of those contracts:

- `src/renderer/staged/svgBackend.ts` renders hand-authored `PositionedScene` fixtures to deterministic SVG with shared paint-group ordering, class hooks, embedded font CSS, and marker definitions
- staged PNG output is now a rasterization step derived from that SVG backend, not a separate scene renderer
- preview routing is still unchanged; no CLI path selects the staged backend yet

Step 5 turns `PositionedScene` into a real manual macro-layout boundary:

- `src/renderer/staged/macroLayout.ts` owns the recursive strategy registry for `stack`, `grid`, and `lanes`
- container chrome, padding, header bands, bounds, and container-port offsets are now resolved during layout rather than left at placeholder values
- staged routing now resolves explicit ports, role-based port fallbacks, default box anchors, and simple deterministic route geometry before SVG emission
- unsupported strategies such as `elk_layered` still fall back to deterministic stack placement until the ELK step lands

## View Extension Pattern

View support now follows one internal pattern instead of adding one-off IA branches:

- `src/projector/projectView.ts` is the single entry point for projection.
- `src/projector/viewProjectors.ts` maps bundle `view_id` values to per-view projection builders.
- each projection builder owns bundle-driven semantics such as derived annotations, omission policy, node grouping, and projection notes.
- `src/renderer/viewRenderers.ts` separately maps renderable views to render-model and emitter adapters.

This keeps the architecture boundary explicit:

- bundle semantics belong in projection builders and render-model builders
- emitters only format already-derived render data
- preview generation remains a CLI concern layered on top of DOT-backed renderers

That separation matters most for the non-IA views:

- service blueprints derive lane membership in projection, then let the render model translate those derived lane groups into row-oriented DOT structures
- scenario flows derive decision-node shape and branch-label precedence in projection, then let the render model decide which rendered edges surface those labels
- ui contracts derive transition-graph priority in projection, then let the render model decide whether `ViewState` remains primary or scoped `State` groups become the effective primary fallback
- emitters stay intentionally dumb so bundle semantics do not get duplicated across output formats

All bundle-defined v0.1 views are now renderable as DOT and Mermaid text. v0.1 still does not expose a public `sdd project` command, so projection remains an internal contract exercised through tests and renderer inputs.

## Bundle Ownership

The bundle owns:

- tokens and lexical rules
- line classification and block structure
- node and relationship vocabularies
- validation rule selection and rule configuration
- view scope plus view-specific projection and rendering conventions

The engine owns:

- file I/O
- source span tracking
- canonical ordering
- generic rule execution
- projector and renderer registries
- output formatting for diagnostics, DOT, and Mermaid emitters

The CLI owns preview artifact generation on top of those text renderers through a backend-aware preview layer.

The engine also owns the internal staged-renderer contracts and snapshot-tested staged pipeline that future SVG work will build on, while keeping that pipeline separate from the current legacy renderer path until view migration begins.

Within that staged pipeline, renderer-owned measurement infrastructure is now shared rather than view-specific:

- `src/renderer/staged/theme.ts` owns staged theme resolution and measurement-affecting tokens
- `src/renderer/staged/primitives.ts` owns shared primitive flow rules and primitive-content validation
- `src/renderer/staged/textMeasurement.ts` owns deterministic font-backed width measurement
- `src/renderer/staged/microLayout.ts` owns intrinsic node sizing and edge-label wrapping
- `src/renderer/staged/macroLayout.ts` owns recursive manual container layout, container bounds, container ports, and simple staged routing
- `src/renderer/staged/svgBackend.ts` owns deterministic SVG emission from `PositionedScene`
- `src/renderer/svgArtifacts.ts` owns shared embedded-font and SVG-to-PNG helpers used by both staged and legacy preview paths

This keeps text sizing and width policy out of future view scene builders.

Preview backends now split by view:

- `staged_ia_place_map_preview` is the default preview backend for `ia_place_map`; it owns staged projection-to-scene rendering, staged SVG emission, and staged PNG derivation from that SVG
- `legacy_graphviz_preview` remains the default preview backend for the remaining views and remains selectable for `ia_place_map`; it owns:

- Graphviz-driven DOT-to-SVG layout
- shared preview-style resolution from `views.yaml`
- Public Sans webfont embedding for portable SVG output
- SVG-to-PNG rasterization with a vendored desktop Public Sans font for image export

Profiles are validation overlays, not language variants. The core bundle defines syntax and compiled graph shape; profiles decide how much completeness and governance to enforce on top of that. Projection scope stays profile-agnostic, while render-model builders may use profile-specific display policy to suppress optional overlays in `simple`, including hiding place route/access/entry-point fields while leaving existing `primary_nav` annotations intact. Use `simple` for low-noise drafts, `permissive` for warning-first completeness, and `recommended` for strict authoring. See [profiles.md](./profiles.md).

## Renderable Views

The current end-to-end renderable set is:

- `ia_place_map` via DOT, Mermaid, and SVG/PNG previews
- `journey_map` via DOT, Mermaid, and SVG/PNG previews
- `outcome_opportunity_map` via DOT, Mermaid, and SVG/PNG previews
- `service_blueprint` via DOT, Mermaid, and SVG/PNG previews
- `scenario_flow` via DOT, Mermaid, and SVG/PNG previews
- `ui_contracts` via DOT, Mermaid, and SVG/PNG previews

These views share one pattern:

- each renderable view gets its own render-model builder
- preview capability is modeled per artifact, with `ia_place_map` now defaulting SVG and PNG previews to `staged_ia_place_map_preview` while the remaining views still route those previews through `legacy_graphviz_preview`
- Mermaid is a parallel readable text contract, not a layout-parity contract with Graphviz

The per-view render models keep semantics centralized:

- IA organizes source-ordered area and place hierarchies plus place annotations
- journey maps turn `Stage CONTAINS Step` into stage containers and inline `opportunity_refs` badges
- outcome-opportunity maps turn type scope plus derived instrumentation annotations into deterministic semantic lanes
- service blueprints turn derived lane groups plus typed relationship styling into preview-friendly operational rows
- scenario flows turn decision-node annotations plus derived branch labels into readable step/place/view-state slices
- ui contracts turn place containment plus grouped `scope_id` state detail into place-scoped contract clusters while keeping fallback-to-state behavior outside the DOT emitter

Preview artifacts build on top of a backend-aware preview layer rather than expanding the engine render contract. In v0.1:

- `renderSource` still returns only DOT or Mermaid text
- `sdd show` resolves preview output through a backend registry; `ia_place_map` now defaults to `staged_ia_place_map_preview`, while the remaining views still default to `legacy_graphviz_preview`
- `sdd show --format png` continues to derive PNG from SVG in both backend paths, with the vendored Public Sans desktop font keeping PNG export independent of user-installed fonts
- `sdd show --dot-out` automatically selects a DOT-capable preview backend when the chosen default backend does not expose DOT intermediates
- preview styling defaults are bundle-owned, with shared defaults at the `views.yaml` level, optional per-view overrides, and separate SVG and PNG font asset paths
- the staged renderer contracts and staged SVG backend still exist in parallel with legacy text and preview outputs, and `ia_place_map` now exercises that staged path through the normal preview workflow and committed corpus

## Determinism

Deterministic output is treated as a feature, not a side effect.

The engine enforces:

- stable node ordering
- stable edge ordering
- stable diagnostic ordering
- stable projection ordering
- stable DOT and Mermaid text output
- stable source-ordered structural rendering for hierarchy views
- stable bundle-owned preview styling defaults
- stable staged theme resolution and font-backed measurement
- canonical `LF` newlines for repo-stored text artifacts

This makes snapshots useful and keeps diffs reviewable.

Stable diffs and source-ordered structural rendering are intentionally separate concerns:

- compiled JSON stays canonically sorted for snapshots and tooling diffs
- renderer-facing author order is attached out-of-band and does not change the compiled schema
- reordering top-level declarations or hierarchy-edge lines is treated as an intentional structural edit, not tool instability

Repository text normalization is part of deterministic behavior, not a contributor-specific preference.

- `.gitattributes` defines `LF` as the canonical newline policy for repo text files
- compiler snapshots, renderer goldens, docs, and spec artifacts should be stored as `LF`
- CLI text output should remain canonically `LF` regardless of contributor platform

## Validation Modes

Validation runs on compiled graphs only. Profiles change rule selection and severity, but they do not change parsing, compilation, or rendering contracts.

- `simple` keeps structural checks strict while omitting completeness rules that add repetition during early modeling
- `permissive` keeps broad governance feedback active, mostly as warnings
- `recommended` enforces production-grade completeness and policy expectations

## Testing Strategy

The test suite uses the bundle examples as conformance fixtures.

- compile tests assert stable compiled JSON against bundle snapshots after newline normalization
- validation tests assert zero errors for current manifest examples under `recommended`
- projection tests assert targeted view behavior and manifest-wide snapshot parity for every declared projection snapshot
- render tests assert stable DOT and Mermaid output against the committed corpus in `examples/rendered/v0.1/`, using suffixed view/example/profile folders such as `ui_contracts_diagram_type/place_viewstate_transition_example/permissive_profile/`
- staged-renderer tests snapshot `RendererScene`, `MeasuredScene`, and `PositionedScene` JSON plus deterministic staged SVG fixtures under `tests/goldens/renderer-stages/` without changing current legacy outputs
- staged micro-layout tests cover wrapping, width-band escalation, clamping, secondary-area handling, and unknown-theme fallback
- corpus completeness tests assert every curated manifest-backed render pair has a committed source `.sdd` plus per-profile `.dot`, `.mmd`, `.svg`, and `.png` artifacts
- negative fixtures cover syntax, compile, and validation failures

Fixture and golden reads should normalize `CRLF` to `LF` before raw string comparison so mixed contributor environments do not create false negatives. The newline policy still lives in `.gitattributes`; test normalization exists to make assertions platform-tolerant, not to permit committed `CRLF` artifacts.

## Extension Direction

Contributors should extend the bundle first whenever possible.

Add engine code only when one of these is true:

- the bundle introduces a new generic primitive that needs an interpreter
- the engine needs infrastructure for deterministic behavior or better diagnostics
- a new view needs a projection builder, render model, or renderer adapter that keeps semantics out of emitters
