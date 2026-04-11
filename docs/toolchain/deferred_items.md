# Deferred Items

These items were intentionally deferred to keep v0.1 lean and focused on a working spec-driven pipeline.

## Bundle Meta-Validation

- JSON Schemas for the bundle YAML files themselves
- stronger bundle self-consistency checks beyond the runtime guards currently used by `loadBundle`

## Public Projection Tooling

Projection service exposure is no longer deferred in v0.1. The root package now exports the schema-validated projection service through `projectView(...)` and `projectSource(...)`.

The remaining deferred items in this area are:

- a public `sdd project` command
- projection-first CLI workflows
- compiled projection snapshots as a first-class artifact outside tests

## Renderer Expansion

- high-quality views beyond `ia_place_map`, `ui_contracts`, `service_blueprint`
- richer styling themes
- layout tuning options

## Input Expansion

- compiled JSON input support in the CLI
- incremental compilation
- watch mode

## Value Semantics

- typed value coercion for properties
- richer property normalization
- schema-driven scalar interpretation

## Packaging And Distribution

- published npm package
- standalone release binaries
- CI release automation

## Developer Experience

- shell completions
- editor integration
- richer diagnostic suggestions and fix hints

## Future Architectural Review Triggers

Revisit the lean architecture only if one of these becomes true:

- the bundle introduces new primitives that need stronger internal abstraction
- the public projection service needs richer capabilities than the current `projectView(...)` and `projectSource(...)` contract
- render backends need capabilities that no longer fit the current thin-adapter design
- typed values become normative in the compiled schema
