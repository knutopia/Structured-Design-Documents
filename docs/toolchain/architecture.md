# Toolchain Architecture

## Goal

The v0.1 toolchain provides one shared TypeScript engine with three public thin CLI commands:

- `sdd compile`
- `sdd validate`
- `sdd show`

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
- `renderSource` resolves renderable views through a renderer registry and turns their projections into internal DOT or Mermaid text artifacts.

## Internal Forms

Lean v0.1 still keeps the public-facing semantic spine small:

- a parse document with source spans
- a canonical compiled graph with non-serialized author-order metadata attached for renderer use
- a renderer-facing projection envelope used as the semantic input to rendering

The renderer migration now adds internal staged-renderer forms under `src/renderer/staged/`:

- `RendererScene`, which maps projection semantics onto renderer-owned primitives without coordinates
- `MeasuredScene`, which records intrinsic content sizing and wrapped text without global placement
- `PositionedScene`, which records absolute placement and routed connector geometry for backend painting

These scene forms are internal contracts only. They are not new CLI outputs, they do not change bundle or projection contracts, and the current internal DOT/Mermaid artifact flows plus Graphviz-backed preview flows remain the active execution path.

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

The staged macro-layout boundary now owns both manual placement and the first shared routed edge behaviors:

- `src/renderer/staged/macroLayout.ts` owns the recursive strategy registry for `stack`, `grid`, `lanes`, and `elk_layered`
- container chrome, padding, header bands, bounds, and container-port offsets are resolved during layout rather than left at placeholder values
- staged routing now resolves explicit ports, role-based port fallbacks, default box anchors, container-origin ports, deterministic orthogonal/stepped routes, target-biased bends where requested, minimum marker-leg clearance for arrow-ended routes when geometry allows, and segment-aware edge-label placement before SVG emission
- `elk_layered` spacing now reserves room for owned edge labels so horizontal transition graphs can remain readable without view-specific SVG hacks

Ports in those staged scene contracts are semantic routing anchors, not normal painted output. The staged SVG backend keeps explicit `connector_port` primitives visible when a view intentionally uses them, but ordinary node and container ports are internal geometry only.

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

- service blueprints derive lane membership in projection, then let the render model translate those derived lane groups into row-oriented internal DOT structures
- scenario flows derive decision-node shape and branch-label precedence in projection, then let the render model decide which rendered edges surface those labels
- ui contracts derive transition-graph priority in projection, then let the render model decide whether `ViewState` remains primary or scoped `State` groups become the effective primary fallback
- emitters stay intentionally dumb so bundle semantics do not get duplicated across output formats

All bundle-defined v0.1 views still retain internal DOT and Mermaid text artifacts for tests, corpus generation, and debugging. Public CLI preview support centers on `sdd show`. v0.1 still does not expose a public `sdd project` command, so projection remains an internal contract exercised through tests and renderer inputs.

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
- output formatting for diagnostics and internal DOT/Mermaid emitters

The CLI owns preview artifact generation on top of those internal text renderers and staged preview backends through a backend-aware preview layer.

The engine also owns the internal staged-renderer contracts and snapshot-tested staged pipeline that future SVG work will build on, while keeping that pipeline separate from the current legacy renderer path until view migration begins.

Within that staged pipeline, renderer-owned measurement infrastructure is now shared rather than view-specific:

- `src/renderer/staged/sceneBuilders.ts` owns reusable root-container, card-node, and port-builder helpers for the migrated staged views
- `src/renderer/staged/theme.ts` owns staged theme resolution and measurement-affecting tokens
- `src/renderer/staged/primitives.ts` owns shared primitive flow rules and primitive-content validation
- `src/renderer/staged/textMeasurement.ts` owns deterministic font-backed width measurement
- `src/renderer/staged/microLayout.ts` owns intrinsic node sizing and edge-label wrapping
- `src/renderer/staged/macroLayout.ts` owns recursive manual container layout, container bounds, container ports, and simple staged routing
- `src/renderer/staged/svgBackend.ts` owns deterministic SVG emission from `PositionedScene`
- `src/renderer/svgArtifacts.ts` owns shared embedded-font and SVG-to-PNG helpers used by both staged and legacy preview paths

This keeps text sizing and width policy out of future view scene builders.
Measured-scene diagnostics are now reserved for actual degraded output or fallback behavior; expected container-port deferral remains internal until macro-layout resolves final container bounds.

Preview backends now split by view:

- `staged_ia_place_map_preview` is the default preview backend for `ia_place_map`; it owns staged projection-to-scene rendering, staged SVG emission, and staged PNG derivation from that SVG
- `staged_ui_contracts_preview` is the default preview backend for `ui_contracts`; it owns the routed and balanced staged projection-to-scene rendering, staged SVG emission, and staged PNG derivation from that SVG
- `staged_service_blueprint_preview` is the default selected preview backend for `service_blueprint`; it owns the renderer-derived middle layer, ELK-authoritative staged SVG emission, and staged PNG derivation from that SVG while explicit `legacy_graphviz_preview` remains available in parallel
- `legacy_graphviz_preview` remains the default preview backend for the remaining views and remains selectable for `ia_place_map`, `service_blueprint`, and `ui_contracts`; it owns:

- Graphviz-driven DOT-to-SVG layout
- shared preview-style resolution from `views.yaml`
- Public Sans webfont embedding for portable SVG output
- SVG-to-PNG rasterization with a vendored desktop Public Sans font for image export

Profiles are validation overlays, not language variants. The core bundle defines syntax and compiled graph shape; profiles decide how much completeness and governance to enforce on top of that. Projection scope stays profile-agnostic, while render-model builders may use profile-specific display policy to suppress optional overlays in `simple`, including hiding place route/access/entry-point fields while leaving existing `primary_nav` annotations intact. Use `simple` for low-noise drafts, `permissive` for warning-first completeness, and `strict` for strict authoring. See [profiles.md](./profiles.md).

## Renderable Views

The current end-to-end renderable set keeps two output layers:

- supported preview artifacts: SVG/PNG via `sdd show`
- retained internal text artifacts: DOT/Mermaid for tests, corpus generation, and debugging

Current CLI preview status by view:

- preview-ready: `ia_place_map`, `ui_contracts`, `service_blueprint`
- preview-only / not yet usable: `journey_map`, `outcome_opportunity_map`, `scenario_flow`

These views share one pattern:

- each renderable view gets its own render-model builder
- preview capability is modeled per artifact, with `ia_place_map`, `service_blueprint`, and `ui_contracts` now defaulting SVG and PNG previews to staged backends and the remaining views routing those previews through `legacy_graphviz_preview`
- internal DOT/Mermaid text artifacts remain parallel emitters for tests, corpus generation, and debugging, not a layout-parity contract with Graphviz

The per-view render models keep semantics centralized:

- IA organizes source-ordered area and place hierarchies plus place annotations
- journey maps turn `Stage CONTAINS Step` into stage containers and inline `opportunity_refs` badges
- outcome-opportunity maps turn type scope plus derived instrumentation annotations into deterministic semantic lanes
- service blueprints turn derived lane groups plus typed relationship styling into preview-friendly operational rows
- scenario flows turn decision-node annotations plus derived branch labels into readable step/place/view-state slices
- ui contracts turn place containment plus grouped `scope_id` state detail into place-scoped contract clusters while keeping fallback-to-state behavior outside the DOT emitter and inside the staged scene builder
- inside the staged renderer, `ia_place_map` now uses manual hub/follower grouping and bottom-up owned-scope sizing: explicit containment creates owned child scope, forward local navigation may create same-scope follower scope, and local structure connectors use deterministic direct-vertical or shared-trunk routing without IA-specific ELK fallback
- inside the staged renderer, `ui_contracts` now reserves internal gutter space for container-origin support edges, assigns those edges to an invisible label lane inside that gutter, and keeps containerized `ViewState` scopes visually aligned with leaf `ViewState` nodes

Inside the staged renderer, `ui_contracts` still keeps its renderer-stage goldens as internal contract coverage, but the routed and balanced staged path now also serves the public `staged_ui_contracts_preview` backend.

Preview artifacts build on top of a backend-aware preview layer rather than expanding the engine render contract. In v0.1:

- `renderSource` still returns only internal DOT or Mermaid text artifacts
- `sdd show` resolves preview output through a backend registry; `ia_place_map`, `service_blueprint`, and `ui_contracts` now default to staged preview backends, and the remaining views still default to `legacy_graphviz_preview`
- `sdd show --format png` continues to derive PNG from SVG in both backend paths, with the vendored Public Sans desktop font keeping PNG export independent of user-installed fonts
- `sdd show --dot-out` remains an internal/debug option and automatically selects a DOT-capable preview backend when the chosen default backend does not expose DOT intermediates
- preview styling defaults are bundle-owned, with shared defaults at the `views.yaml` level, optional per-view overrides, and separate SVG and PNG font asset paths
- the staged renderer contracts and staged SVG backend still exist in parallel with internal text artifacts and legacy preview outputs; `ia_place_map`, `service_blueprint`, and `ui_contracts` now exercise staged preview paths through the normal preview workflow and committed corpus, and legacy Graphviz preview remains explicitly available in parallel

## Determinism

Deterministic output is treated as a feature, not a side effect.

The engine enforces:

- stable node ordering
- stable edge ordering
- stable diagnostic ordering
- stable projection ordering
- stable internal DOT and Mermaid text output
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
- `strict` enforces production-grade completeness and policy expectations

## Testing Strategy

The test suite uses the bundle examples as conformance fixtures.

- compile tests assert stable compiled JSON against bundle snapshots after newline normalization
- validation tests assert zero errors for current manifest examples under `strict`
- projection tests assert targeted view behavior and manifest-wide snapshot parity for every declared projection snapshot
- render tests assert stable internal DOT and Mermaid output against the committed corpus in `examples/rendered/v0.1/`, using suffixed view/example/profile folders such as `ui_contracts_diagram_type/place_viewstate_transition_example/permissive_profile/`
- staged-renderer tests snapshot `RendererScene`, `MeasuredScene`, and `PositionedScene` JSON plus deterministic staged SVG fixtures under `tests/goldens/renderer-stages/` without changing current legacy outputs
- staged micro-layout tests cover wrapping, width-band escalation, clamping, secondary-area handling, and unknown-theme fallback
- corpus completeness tests assert every curated manifest-backed render pair has a committed source `.sdd` plus per-profile internal `.dot`/`.mmd` artifacts alongside `.svg` and `.png` preview artifacts
- negative fixtures cover syntax, compile, and validation failures

Fixture and golden reads should normalize `CRLF` to `LF` before raw string comparison so mixed contributor environments do not create false negatives. The newline policy still lives in `.gitattributes`; test normalization exists to make assertions platform-tolerant, not to permit committed `CRLF` artifacts.

## Extension Direction

Contributors should extend the bundle first whenever possible.

Add engine code only when one of these is true:

- the bundle introduces a new generic primitive that needs an interpreter
- the engine needs infrastructure for deterministic behavior or better diagnostics
- a new view needs a projection builder, render model, or renderer adapter that keeps semantics out of emitters
