# Project Achievements

This document records completed project milestones and the initial toolchain background that followed from them. It is historical context, not active subagent guidance for the current renderer migration.

## 1. [DONE] Created a well-defined set of specs for version 0.1 in `bundle/v0.1/`

See:

- `docs/Done/[Done] bundle_creation_guidance_sdd_text_v_0_dot_1.md`
- `docs/Done/[Done] bundle_v0_1_extraction_sync_report.md`

## 2. [DONE] Created the initial Compiler, Validator, and Renderer toolchain

See:

- `docs/toolchain`
- `docs/Done/[Done] bundle_v0_1_extraction_sync_report.md`

The initial TypeScript toolchain is in place at repo root as package `sdd-toolchain`.

### Initial scope

- one shared engine with three CLI commands: `compile`, `validate`, and `render`
- spec-driven parsing, compilation, validation, projection, and multi-view rendering against `bundle/v0.1/`
- machine-readable extraction target for source parsing behavior: `bundle/v0.1/core/syntax.yaml`
- renderable views: `ia_place_map`, `journey_map`, `outcome_opportunity_map`, `service_blueprint`, `scenario_flow`, and `ui_contracts`
- render targets: DOT, Mermaid, SVG, and PNG for all renderable views through the initial toolchain
- preview path: `sdd show` for the initial DOT-backed SVG and PNG preview artifacts
- committed rendered example corpus: `examples/rendered/v0.1/` with suffixed view/example/profile folders such as `ia_place_map_diagram_type/outcome_to_ia_trace_example/strict_profile`, where `simple_profile` omits lower-priority overlays including place route, access, and entry-point fields

`bundle/v0.1/core/syntax.yaml` is intentionally compatible with the EBNF grammar. For extraction into `core/syntax.yaml`, it provides human-oriented operational clarifications such as default version behavior, fixed edge-element order, and canonical compilation expectations, while the grammar remains primary for formal parse structure and lexical precision.

### Contributor reference docs

- `docs/toolchain/architecture.md`
- `docs/toolchain/decisions.md`
- `docs/toolchain/development.md`
- `docs/toolchain/deferred_items.md`

### Common commands

- `pnpm build`
- `pnpm test`
- `pnpm run check:graphviz`
- `pnpm run generate:rendered-examples`
- `pnpm sdd compile bundle/v0.1/examples/outcome_to_ia_trace.sdd`
- `pnpm sdd validate bundle/v0.1/examples/outcome_to_ia_trace.sdd`
- `pnpm sdd render bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map --format dot`
- `pnpm sdd render bundle/v0.1/examples/outcome_to_ia_trace.sdd --view journey_map --format mermaid`
- `pnpm sdd render bundle/v0.1/examples/place_viewstate_transition.sdd --view ui_contracts --format dot`
- `pnpm sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view outcome_opportunity_map --out /tmp/outcome-map.svg`

## 3. [Done] Created better "staged" rendering pipeline for subset of diagram types

Created staged SVG renderer architecture for `ia_place_map`, `ui_contracts`, `service_blueprint`. This new renderer architecture overcomes the limitations encountered with mermaid, graphviz and elk.
