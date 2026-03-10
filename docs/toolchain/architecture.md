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
- IA view projection
- text rendering

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
- `projectView` creates a normalized projection envelope for the requested view.
- `renderSource` turns the IA Place Map projection into DOT or Mermaid text.

## Internal Forms

Lean v0.1 keeps only two meaningful internal forms:

- a parse document with source spans
- a canonical compiled graph with non-serialized author-order metadata attached for renderer use

Projection is treated as a renderer-facing internal artifact, not a public CLI contract in v0.1.

This keeps the implementation small while still separating syntax, semantics, and rendering.

## Bundle Ownership

The bundle owns:

- tokens and lexical rules
- line classification and block structure
- node and relationship vocabularies
- validation rule selection and rule configuration
- view scope and IA rendering conventions

The engine owns:

- file I/O
- source span tracking
- canonical ordering
- generic rule execution
- output formatting for diagnostics, DOT, and Mermaid

The CLI owns preview artifact generation on top of those text renderers:

- Graphviz-driven DOT-to-SVG layout
- shared preview-style resolution from `views.yaml`
- Public Sans font embedding for portable SVG output
- SVG-to-PNG rasterization for image export

Profiles are validation overlays, not language variants. The core bundle defines syntax and compiled graph shape; profiles decide how much completeness and governance to enforce on top of that. Use `simple` for low-noise drafts, `permissive` for warning-first completeness, and `recommended` for strict authoring. See [profiles.md](./profiles.md).

## IA Place Map Proof Slice

The first end-to-end proof slice is `ia_place_map`.

Why this slice was chosen:

- it exercises bundle-driven parsing, compilation, validation, projection, and rendering
- it uses both hierarchy (`CONTAINS`) and navigational flow (`NAVIGATES_TO`)
- it is small enough to keep fixtures and render outputs stable

The renderer currently supports only this view, but it targets two textual formats:

- DOT
- Mermaid flowchart

Both formats are generated from the same IA render model so view semantics stay centralized.

Preview artifacts build on top of DOT rather than expanding the engine render contract. In v0.1:

- `renderSource` still returns only DOT or Mermaid text
- `sdd show` uses Graphviz to turn DOT into SVG
- `sdd show --format png` rasterizes that SVG after embedding the bundled font
- preview styling defaults are bundle-owned, with shared defaults at the `views.yaml` level and optional per-view overrides

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
- projection tests assert structural IA behavior, including omissions and renderer-derived annotations
- render tests assert stable DOT and Mermaid output after newline normalization
- negative fixtures cover syntax, compile, and validation failures

Fixture and golden reads should normalize `CRLF` to `LF` before raw string comparison so mixed contributor environments do not create false negatives. The newline policy still lives in `.gitattributes`; test normalization exists to make assertions platform-tolerant, not to permit committed `CRLF` artifacts.

## Extension Direction

Contributors should extend the bundle first whenever possible.

Add engine code only when one of these is true:

- the bundle introduces a new generic primitive that needs an interpreter
- the engine needs infrastructure for deterministic behavior or better diagnostics
- a new renderer format needs a presentation adapter over an existing projection
