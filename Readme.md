# Readme: Structured Design Documentation Project Overview

This project aims to 
-define a way to capture structure in interaction design diagrams, 
-provide ways to produce and consume such "Structured Design Documents" as part of (software-) product creation work,
-enabling people (designers and other product-creation participants) and LLMs to meaningfully harness interaction design as a contributing domain in product creation.

For orientation, read the documents

- file:"///initial_concepts/Structured Design Artifacts to Advance the Software Product Design Practice.md"
- file:"///initial_concepts/Initial Concepts1 a 6-Diagram Suite v0dot1.md"
- file:"///initial_concepts/Initial Concepts2 One-page Schema v0dot1.md"

Other folders:

- file:///definitions (/vXXX) houses definitions and rationale for version XXX (currently version 0.1)
- file:///bundle (/vXXX) houses tight, machine-readable specifications for version XXX (currently version 0.1). These specifications are meant to drive tooling (so that encoding of actual language spec is done outside tooling).

## v0.1 Source-of-Truth Policy

- Files in `bundle/v0.1/` are the machine-readable source of truth for tools.
- Markdown files in `definitions/v0.1/` remains explanatory commentary and rationale, and should stay consistent with the bundle. (Originally the definitions files served as the normative input to create the bundles.)

## Project Achievements

### 1. [DONE] Create a well-defined set of specs for version 0.1, in folder bundle/v0.1/
See 
file:"///docs/Done/[Done] bundle_creation_guidance_sdd_text_v_0_dot_1.md"
file:"///docs/bundle_v0_1_extraction_sync_report.md"

### 2.1 [DONE] Created initial Compiler, Validator, Renderer toolchain
See:
file:\\\docs\toolchain
file:\\\docs\bundle_v0_1_extraction_sync_report.md

The initial TypeScript toolchain is now in place at repo root as package `sdd-toolchain`.

Current scope:

- one shared engine with three CLI commands: `compile`, `validate`, and `render`
- spec-driven parsing, compilation, validation, projection, and multi-view rendering against `bundle/v0.1/`
- renderable views: `ia_place_map`, `journey_map`, `outcome_opportunity_map`, `service_blueprint`, `scenario_flow`, and `ui_contracts`
- render targets: DOT for all renderable views, plus Mermaid for `ia_place_map`
- preview path: `sdd show` for DOT-backed SVG/PNG artifacts

Contributor reference docs:

- `docs/toolchain/architecture.md`
- `docs/toolchain/decisions.md`
- `docs/toolchain/development.md`
- `docs/toolchain/deferred_items.md`

Common commands:

- `pnpm build`
- `pnpm test`
- `pnpm run check:graphviz`
- `pnpm sdd compile bundle/v0.1/examples/outcome_to_ia_trace.sdd`
- `pnpm sdd validate bundle/v0.1/examples/outcome_to_ia_trace.sdd`
- `pnpm sdd render bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map --format dot`
- `pnpm sdd render bundle/v0.1/examples/outcome_to_ia_trace.sdd --view journey_map --format dot`
- `pnpm sdd render bundle/v0.1/examples/place_viewstate_transition.sdd --view ui_contracts --format dot`
- `pnpm sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view outcome_opportunity_map --out /tmp/outcome-map.svg`

## Structural Ordering Guidance

For humans and LLMs authoring diagrams:

- If you want sibling order in a structural view, write `CONTAINS` and `COMPOSED_OF` lines in that order.
- Do not rely on nested `+` block placement for ordering; nesting groups authoring context only.
- Use `PRECEDES` and `TRANSITIONS_TO` for actual flow/state order, not for sibling arrangement.

Example:

```text
Area A-200 "Projections"
  CONTAINS P-210 "Overview"
  CONTAINS P-220 "Projection"
  CONTAINS P-230 "Create New Projection"
END
```

In hierarchy-aware renderers, the expected sibling order is `Overview`, then `Projection`, then `Create New Projection`, even though compiled JSON remains canonically sorted for stable diffs.

## UI Contracts Authoring Guidance

- Use `ViewState` for within-place UI mode changes such as tabs, wizards, or success/error screens. In `ui_contracts`, that transition graph is primary whenever `ViewState` nodes are present.
- Use `State` only when you need scoped state-machine detail on a `Place` or `Component`, such as a form lifecycle or panel-local dirty/ready/submitting states.
- Set `State.scope_id` to the owning `Place` or `Component` id. A place-scoped state describes container-wide behavior; a component-scoped state describes local widget behavior.
- If a slice has no `ViewState` nodes, `ui_contracts` falls back to the grouped `State` transitions as the effective primary graph rather than rendering an empty view-state layer.

## Local Tooling Prerequisites

Required local tooling:

- Node.js 22 LTS
- `pnpm`

Optional local tooling:

- Graphviz, when you want to preview or post-process `.dot` output or use editor integrations that shell out to `dot`

Install Graphviz in the environment where this workspace runs:

- VS Code Remote - WSL, WSL/Ubuntu, or native Linux: install Graphviz inside that Linux environment, typically with `sudo apt install graphviz`
- Native Windows-side execution: install Graphviz on Windows and ensure `dot.exe` is on `PATH`

Verify Graphviz setup with:

- `pnpm run check:graphviz`
- `dot -V`

## Current Project Goals

### Expand the New Toolchain to Cover Remaining View Types

Execution-ready prompts for the four planned implementation phases are in:

- `docs/view_implementation_execution_prompts.md`
