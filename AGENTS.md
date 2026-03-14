# AGENTS.md

## Workspace Notes

- This repository is typically worked on inside WSL.
- Non-interactive login shells should have `node` (version 22 LTS) and `pnpm` available via `nvm` from `~/.profile`.
- If a shell still does not see `node` or `pnpm`, use:
  `source ~/.nvm/nvm.sh && <command>`

### Optional Local Tooling: Graphviz for Previews

Graphviz is not required to compile and validate SDD content, but it is needed to preview or post-process `.dot` output, as well as `.svg` and `.png` output (which depend on `.dot`.)

Install Graphviz in the environment where this workspace runs:

- VS Code Remote - WSL, WSL/Ubuntu, or native Linux: install Graphviz inside that Linux environment, typically with `sudo apt install graphviz`
- Native Windows-side execution: install Graphviz on Windows and ensure `dot.exe` is on `PATH`

Verify Graphviz setup with:

- `pnpm run check:graphviz`
- `dot -V`

## v0.1 Source-of-Truth Policy

- Files in `bundle/v0.1/` are the machine-readable source of truth for tools.
- Markdown files in `definitions/v0.1/` remains explanatory commentary and rationale, and should stay consistent with the bundle. (Originally the definitions files served as the normative input to create the bundles.)

## Test And CLI Commands

- Prefer running Node-based commands from repo root.
- For Vitest and any command that may create temporary files, set:
  `TMPDIR=/tmp`
- Recommended examples:
  `TMPDIR=/tmp pnpm test`
  `TMPDIR=/tmp pnpm sdd --help`
  `TMPDIR=/tmp pnpm sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map`

## Known Environment Quirk

- In this WSL setup, default temp resolution may point at `/mnt/c/TEMP`, which can fail with `EACCES`.
- `TMPDIR=/tmp` avoids that problem and should be the default for test runs.

## Current Project Goals

### Replace failed SVG / DOT with better quality rendering output

While we have achieved rendering Grapviz & Mermaid rendering coverage for all diagram types, most output is so badly mangled that it is unusable as a visual communications artifact. Experimenting with potential improvements, it is clear that the root cause is a combination of a) severe limitations of DOT and MMD capabilities and b) blindness of Codex the authoring LLM to anything related to design quality.

To move forward, we will re-implement rendering with a new, more grid-based layout system, since designs that produce usable diagrams do rely on grids.

## Project Achievements

### 1. [DONE] Created a well-defined set of specs for version 0.1, in folder bundle/v0.1/
See 
`docs/Done/[Done] bundle_creation_guidance_sdd_text_v_0_dot_1.md`
`docs/bundle_v0_1_extraction_sync_report.md`

### 2. [DONE] Created initial Compiler, Validator, Renderer toolchain

See:
`docs\toolchain`
`docs/Done/[Done] bundle_v0_1_extraction_sync_report.md`

The initial TypeScript toolchain is now in place at repo root as package `sdd-toolchain`.

Current scope:

- one shared engine with three CLI commands: `compile`, `validate`, and `render`

- spec-driven parsing, compilation, validation, projection, and multi-view rendering against `bundle/v0.1/`
  - machine-readable extraction target for source parsing behavior: `bundle/v0.1/core/syntax.yaml`.
    This document is intentionally compatible with the EBNF grammar. For extraction into `core/syntax.yaml`, it provides human-oriented operational clarifications such as default version behavior, fixed edge-element order, and canonical compilation expectations; the grammar remains primary for formal parse structure and lexical precision.

- renderable views: `ia_place_map`, `journey_map`, `outcome_opportunity_map`, `service_blueprint`, `scenario_flow`, and `ui_contracts`

- render targets: DOT, Mermaid, SVG, PNG for all renderable views

- preview path: `sdd show` for DOT-backed SVG/PNG artifacts

- committed rendered example corpus: `examples/rendered/v0.1/` with suffixed view/example/profile folders such as `ia_place_map_diagram_type/outcome_to_ia_trace_example/recommended_profile`, where `simple_profile` omits lower-priority overlays including place route/access/entry-point fields

Contributor reference docs:

- `docs/toolchain/architecture.md`
- `docs/toolchain/decisions.md`
- `docs/toolchain/development.md`
- `docs/toolchain/deferred_items.md`

Common commands:

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
