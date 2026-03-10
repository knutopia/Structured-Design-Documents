# Toolchain Development

## Prerequisites

Required local tooling:

- Node.js 22 LTS
- `pnpm`

The implementation work for v0.1 was done against a workspace-local Node 22 runtime because the machine default was Node 6 and `pnpm` was not installed. A normal contributor setup should install Node 22 and `pnpm` system-wide or through a version manager.

Optional local tooling:

- Graphviz, for previewing or post-processing `.dot` output and for VS Code extensions or other tools that shell out to `dot`

Graphviz is not required for the core v0.1 build and test flow because the renderer emits `.dot` and `.mmd` source files. It is required once you want local DOT rendering, PNG generation, or editor integrations that invoke the Graphviz binary.

Install Graphviz in the same environment that runs the workspace tooling:

- VS Code Remote - WSL, WSL/Ubuntu, or native Linux: `sudo apt update` then `sudo apt install graphviz`
- Native Windows-side execution: install Graphviz on Windows and ensure `dot.exe` is on `PATH`

Verify the setup with:

```bash
pnpm run check:graphviz
```

## Install

From repo root:

```bash
pnpm install
```

## Build

```bash
pnpm build
```

## Test

```bash
pnpm test
```

## CLI Usage

Compile a source file:

```bash
pnpm sdd compile bundle/v0.1/examples/outcome_to_ia_trace.sdd
```

Validate with the default profile:

```bash
pnpm sdd validate bundle/v0.1/examples/outcome_to_ia_trace.sdd
```

Validate an early draft with the low-noise profile:

```bash
pnpm sdd validate real_world_exploration/billSage_simple_structure.sdd --profile simple
```

Render IA Place Map to DOT:

```bash
pnpm sdd render bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map --format dot
```

Render IA Place Map to Mermaid:

```bash
pnpm sdd render bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map --format mermaid
```

Write render output to a file:

```bash
pnpm sdd render bundle/v0.1/examples/place_viewstate_transition.sdd --view ia_place_map --format mermaid --out /tmp/place_viewstate_transition.mmd
```

Profile guidance lives in [profiles.md](./profiles.md).

## Structure

- `src/bundle/`: bundle loading and runtime guards
- `src/parser/`: syntax-driven line classification and block parsing
- `src/compiler/`: graph construction, canonicalization, schema validation
- `src/validator/`: generic rule execution and profile validation
- `src/projector/`: internal view projection
- `src/renderer/`: IA render model plus DOT and Mermaid emitters
- `src/diagnostics/`: structured diagnostics and formatting
- `src/cli/`: thin command wiring
- `tests/`: conformance, regression, and negative fixtures

## Adding A New Validation Primitive

1. Extend the executor set in `src/validator/ruleExecutors.ts`.
2. Register the executor in `src/validator/ruleRegistry.ts`.
3. Add positive or negative fixtures that exercise the new rule kind.
4. Prefer expressing the new behavior in the bundle first, then teaching the engine how to execute it.

## Adding A New Renderer Format

1. Reuse the existing IA render model in `src/renderer/iaPlaceMapRenderModel.ts`.
2. Add a new emitter beside `dot.ts` and `mermaid.ts`.
3. Keep all view semantics in projection and render-model construction, not in the emitter.
4. Add stable golden tests for the new text output.

## Adding A New View

1. Add the view to the bundle.
2. Extend the internal projection layer if the view needs new projection semantics.
3. Add a render model only if the current IA model is insufficient.
4. Add explicit CLI support only after the projection and rendering path is proven by tests.
