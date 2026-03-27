# AGENTS.md

## Workspace Notes

- This repository is typically worked on inside WSL.
- Non-interactive login shells should have `node` (version 22 LTS) and `pnpm` available via `nvm` from `~/.profile`.
- If a shell still does not see `node` or `pnpm`, use:
  `source ~/.nvm/nvm.sh && <command>`

### Optional Local Tooling: Graphviz for Current Legacy Previews

Graphviz is not required to compile and validate SDD content. It is currently needed for legacy preview flows that turn `.dot` output into `.svg` and `.png` artifacts.

During the renderer migration, treat this as a current legacy workflow detail, not as an architectural requirement for all future SVG or PNG rendering paths.

Install Graphviz in the environment where this workspace runs:

- VS Code Remote - WSL, WSL/Ubuntu, or native Linux: install Graphviz inside that Linux environment, typically with `sudo apt install graphviz`
- Native Windows-side execution: install Graphviz on Windows and ensure `dot.exe` is on `PATH`

Verify Graphviz setup with:

- `pnpm run check:graphviz`
- `dot -V`

### Graphing with Elkjs

Some diagram types use the Elkjs (Eclipse Layout Kernel) layout engine. When encountering Elkjs-related tasks, DO review current Elkjs online documentation - do not guess - know your choices.
Elkjs project & readme: https://github.com/kieler/elkjs
Elk documentation: https://eclipse.dev/elk/reference.html

## v0.1 Source-of-Truth Policy

- Files in `bundle/v0.1/` are the machine-readable source of truth for tools.
- Markdown files in `definitions/v0.1/` remain explanatory commentary and rationale, and should stay consistent with the bundle. (Originally the definitions files served as the normative input to create the bundles.)

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

## Current Project Goal: Service Blueprint Rendering

The current migration focus is to complete the staged SVG renderer architecture on `service_blueprint`.

Do also follow the local instructions in `docs/service_blueprint_renderer_implementation/AGENTS.md`.

## Renderer Constraints

- Preserve parser, compiler, validator, and projection behavior unless the selected migration step explicitly says otherwise.
- Keep projection as the semantic boundary between graph semantics and rendering technology. Do not push layout, routing, text wrapping, or SVG structure into parsing, compilation, validation, or projection.
- Keep the staged renderer pipeline explicit: `projection -> RendererScene -> MeasuredScene -> PositionedScene -> SVG -> PNG`.
- Keep renderer-owned scene contracts backend-agnostic. Do not store final coordinates, final line breaks, ELK JSON, DOT text, Mermaid text, or SVG strings in `RendererScene`.
- Treat DOT text rendering, Mermaid text rendering, and Graphviz-backed preview rendering as `LEGACY` renderer paths during the migration.
- Preserve `LEGACY` outputs unless the selected migration step explicitly changes that behavior.
- Make SVG the first-class artifact backend for the new staged path. Keep PNG as rasterization derived from SVG rather than a separate scene renderer.
- Treat text measurement, text wrapping, width-band policy, overflow policy, theme tokens, layout strategies, routing, and renderer diagnostics as shared renderer infrastructure. If a view exposes a gap, fix the shared layer rather than patching the view with one-off logic.
- Avoid the failed-in-practice use of ELK as a macro-layout strategy for eligible scene subgraphs.
- Preserve deterministic behavior: stable ordering, vendored font usage, canonical `LF` newlines for stored text artifacts, deterministic measurement and layout, deterministic SVG serialization, and explicit renderer diagnostics for degraded output.
- Each migration step should land code, tests, and any required documentation updates, not just design notes.

## Quality And Drift Control

- Spec-first for doc-driven work:
  extract a short list of cited, non-negotiable invariants before planning or coding.
- Separate sources by role:
  identify the normative contract, architectural guardrails, and visual exemplar before implementation.
- If the authority hierarchy is unclear, stop and resolve it before coding.

- Acceptance before snapshots:
  do not update snapshots, goldens, or rendered corpus artifacts until the cited acceptance invariants are satisfied.
- Snapshot refresh is evidence capture, not a way to normalize failure.
- If tests are green but acceptance invariants still fail, report the work as incomplete.

- Proof-case before generalization:
  for visually complex or migration work, get the explicitly referenced proof case right before broadening shared infrastructure or regenerating wider goldens.
- Do not generalize from a failing or low-quality proof case.

- Explicit mismatch reporting:
  after each substantial pass, report satisfied invariants, violated invariants, and whether the output is acceptable.
- Do not describe output as implemented, complete, successful, materially better, or ready when core invariants still fail.

- Decision traceability:
  any non-obvious placement, routing, ownership, or fallback decision must be justified against the cited contract, not only against tests or local convenience.

- Stop conditions:
  stop and surface the problem instead of coding through it when output contradicts cited invariants, when goldens would need updating to hide quality regressions, or when the current strategy is producing structurally wrong output and further tuning is speculative.

For completed project milestones and legacy toolchain background, see `docs/Done/project_achievements.md`.
