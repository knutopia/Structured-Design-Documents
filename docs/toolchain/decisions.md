# Toolchain Decisions

## Lean v0.1 Decisions

- One root TypeScript package, not a monorepo.
- One shared engine, not separate tool codebases.
- Three public commands: `compile`, `validate`, and `render`.
- Projection stays internal in v0.1.
- Only source `.sdd` input is supported in the CLI.
- Only `ia_place_map` is rendered in v0.1.
- Renderer outputs text artifacts only: DOT and Mermaid source.
- Preview artifacts are a CLI concern layered on top of DOT: SVG by default, PNG on demand.

## Spec-Driven Boundaries

- `syntax.yaml` and `vocab.yaml` drive parsing.
- `schema.json` defines the compiled graph contract.
- `contracts.yaml` and profile files drive validation.
- `views.yaml` drives IA projection scope and renderer-facing conventions.

The TypeScript code should not contain hardcoded checks for specific node or edge semantics when a bundle rule already expresses that behavior.

## Minimal Internal Forms

No extra generalized IR was added.

The implementation keeps:

- a parse document for syntax-aware compilation and diagnostics
- a compiled graph for validation and rendering

This is enough for v0.1 and avoids building abstraction layers before they are needed.

## String-First Property Policy

Compiled properties remain strings in v0.1.

Reasons:

- current snapshots are string-oriented
- silent coercion would add hidden semantics to the compiler
- property validation already belongs in the validation stage

If future versions need typed values, that change should be explicit in the spec bundle and the compiled schema.

## Compilation Boundary

Compilation is responsible for:

- parsing source
- flattening authoring blocks
- building canonical graph JSON
- validating that graph against the bundle schema

Compilation is not responsible for:

- profile enforcement
- inferred edge generation
- view-specific derivation
- renderer-specific formatting

Compilation may attach non-serialized metadata that preserves author order for later renderer use, but that metadata is not part of the compiled JSON contract.

## Validation Policy

Validation runs on compiled graphs only.

It is split into:

- generic contract rule execution
- relationship endpoint enforcement
- selected profile checks

Unknown rule kinds fail closed. The engine should not silently ignore bundle features it does not understand.

## Notes And IA Projection Policy

IA projection notes are treated as semantic guidance, not byte-for-byte golden text.

Reason:

- current snapshots do not capture every note that can be derived from `views.yaml`
- renderer defaults can legitimately produce additional explanatory notes without changing graph semantics

Projection annotations for IA are derived from renderer defaults in `views.yaml`, including subtitle, badge, and metadata props.

## Renderer Policy

The renderer uses:

- the compiled graph
- the normalized IA projection
- IA view conventions from the bundle

This allows the bundle to define what matters in the view, while the renderer remains a thin presentation layer over DOT and Mermaid syntax.

Preview generation remains outside the core renderer contract:

- Graphviz is used only for DOT-to-SVG layout
- SVG and PNG artifacts are produced by the CLI preview pipeline
- shared preview typography and DPI defaults live in `views.yaml`, with per-view overrides only when needed

## Source-Ordered Structural Rendering

Structural rendering uses two different order models on purpose:

- canonical JSON sort order for stored compiled artifacts
- author order metadata for hierarchy-aware rendering

Rules:

- top-level rendered nodes follow top-level source declaration order after view filtering
- sibling nodes under a structural parent follow the source order of hierarchy edge lines such as `CONTAINS` and `COMPOSED_OF`
- nesting placement of `+` blocks does not define structural order
- flow order remains the job of explicit ordering edges such as `PRECEDES` and `TRANSITIONS_TO`

This keeps snapshots stable while still letting renderers honor meaningful source order. Reordering top-level declarations or hierarchy-edge lines is treated as an intentional semantic change to rendered structure.

## Diagnostics And Exit Codes

Diagnostics are structured and stage-aware.

Each diagnostic includes:

- `stage`
- `code`
- `severity`
- `message`
- `file`
- optional source span and rule metadata

CLI exit behavior:

- `0` for success and warnings-only
- `1` for any error diagnostic
- `2` for usage or unsupported-option failures
