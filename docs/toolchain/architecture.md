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

Each stage has a narrow responsibility:

- `loadBundle` resolves the v0.1 manifest and loads vocab, syntax, schema, contracts, profiles, and views.
- `parseSource` interprets `syntax.yaml` and produces a source-spanned parse document.
- `compileSource` flattens authoring blocks into canonical graph JSON, preserves author-order metadata for renderers, and validates the graph against `core/schema.json`.
- `validateGraph` executes generic validation rules from contracts plus the selected profile.
- `projectView` resolves the requested bundle view through a shared projector registry and creates a normalized projection envelope for that view.
- `renderSource` resolves renderable views through a renderer registry and turns their projections into DOT or Mermaid text.

## Internal Forms

Lean v0.1 keeps only two meaningful internal forms:

- a parse document with source spans
- a canonical compiled graph with non-serialized author-order metadata attached for renderer use

Projection is treated as a renderer-facing internal artifact, not a public CLI contract in v0.1.

This keeps the implementation small while still separating syntax, semantics, and rendering.

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

Not every projected view is renderable yet, and that is intentional. Projection coverage can land before CLI rendering support. v0.1 still does not expose a public `sdd project` command.

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

The CLI owns preview artifact generation on top of those text renderers:

- Graphviz-driven DOT-to-SVG layout
- shared preview-style resolution from `views.yaml`
- Public Sans webfont embedding for portable SVG output
- SVG-to-PNG rasterization with a vendored desktop Public Sans font for image export

Profiles are validation overlays, not language variants. The core bundle defines syntax and compiled graph shape; profiles decide how much completeness and governance to enforce on top of that. Use `simple` for low-noise drafts, `permissive` for warning-first completeness, and `recommended` for strict authoring. See [profiles.md](./profiles.md).

## Renderable Views

The current end-to-end renderable set is:

- `ia_place_map` via DOT, Mermaid, and SVG/PNG previews
- `journey_map` via DOT and SVG/PNG previews
- `outcome_opportunity_map` via DOT and SVG/PNG previews

These views share one pattern:

- each renderable view gets its own render-model builder
- DOT is the minimum rendering contract for previewable views
- Mermaid support is optional and should only be added when the result stays readable

The per-view render models keep semantics centralized:

- IA organizes source-ordered area and place hierarchies plus place annotations
- journey maps turn `Stage CONTAINS Step` into stage containers and inline `opportunity_refs` badges
- outcome-opportunity maps turn type scope plus derived instrumentation annotations into deterministic semantic lanes

Preview artifacts build on top of DOT rather than expanding the engine render contract. In v0.1:

- `renderSource` still returns only DOT or Mermaid text
- `sdd show` uses Graphviz to turn DOT into SVG with the vendored Public Sans webfont available for layout, then embeds that webfont into the output SVG
- `sdd show --format png` rasterizes that SVG with the vendored Public Sans desktop font so PNG export does not depend on user-installed fonts
- preview styling defaults are bundle-owned, with shared defaults at the `views.yaml` level, optional per-view overrides, and separate SVG and PNG font asset paths

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
- render tests assert stable DOT and Mermaid output after newline normalization
- negative fixtures cover syntax, compile, and validation failures

Fixture and golden reads should normalize `CRLF` to `LF` before raw string comparison so mixed contributor environments do not create false negatives. The newline policy still lives in `.gitattributes`; test normalization exists to make assertions platform-tolerant, not to permit committed `CRLF` artifacts.

## Extension Direction

Contributors should extend the bundle first whenever possible.

Add engine code only when one of these is true:

- the bundle introduces a new generic primitive that needs an interpreter
- the engine needs infrastructure for deterministic behavior or better diagnostics
- a new view needs a projection builder, render model, or renderer adapter that keeps semantics out of emitters
