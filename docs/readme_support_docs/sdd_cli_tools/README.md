# SDD CLI Tools

`sdd` is the main command-line entrypoint for working with `.sdd` files in this repository. It is the human-facing CLI for previewing diagrams, validating documents against profiles, and compiling SDD source into canonical JSON.

This is different in tone and purpose from `sdd-helper`. `sdd` is the normal tool for people running straightforward CLI workflows. `sdd-helper` is the JSON-first companion surface for automation and structured mutation flows.

## If You Are New To The Command Line

You do not need to learn the whole terminal to use this page. You can copy and paste the example commands exactly.

- When you see `<input>`, it means “the path to your `.sdd` file”.
- When you use `--out`, you are choosing where the generated file should be written.
- If you omit `--out` with `sdd show`, the preview file is written beside the input file.

If you want a visual result quickly, start with the next section and use the commands as written.

## Fastest Path To A Result

For most people, `sdd show` is the right first command. It compiles the document, validates it, and generates a preview artifact for a chosen view.

Start with the `simple` profile. The CLI default is `strict`, but `simple` is the better starting point for early work because it is lower-noise and better suited to drafting.

SVG quick-start:

```bash
pnpm sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map --profile simple
```

PNG quick-start:

```bash
pnpm sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map --profile simple --format png --out ./outcome.png
```

What to expect:

- `sdd show` is the preferred preview command.
- SVG is the default output format.
- PNG is available with `--format png`.
- `simple` is the best starting profile for early diagrams and drafts.

## Profiles In Plain Language

One of the options is `--profile`. Profiles are validation and display overlays, not different SDD languages. You do not rewrite your `.sdd` file to switch profiles. Instead, you choose how much completeness, governance, and optional display detail you want the toolchain to apply to the same source.

In practice:

- `simple`: low-noise drafting and the best starting point for most new work
- `permissive`: warning-first completeness when you want guidance without as much blocking
- `strict`: strict governance and the current CLI default

`simple` is especially useful early because it emphasizes design structure without pushing as hard for fuller metadata, and it can reduce visual noise in supported rendering where configured.

For the fuller profile explanation, see [profiles.md](../../toolchain/profiles.md).

## Public Commands At A Glance

This page focuses on the three public commands most people need:

- `sdd show <input> --view <view>`
- `sdd validate <input>`
- `sdd compile <input>`

If you only remember one command from this page, make it `sdd show`.

## Command Reference

### `sdd show`

- Purpose: compile, validate, and generate a preview artifact for a chosen view.
- Use when: you want a visible result, want to share a diagram, or want to check how a document renders under a given profile.
- Invocation: `pnpm sdd show <input> --view <view>`
- Key inputs: an input `.sdd` file and a required `--view`.
- Common options: `--profile`, `--format`, and `--out`.
- Output: SVG by default, or PNG when `--format png` is provided.

By default, the profile is `strict`, but for getting started you should usually add `--profile simple`.

If you omit `--out`, `sdd show` writes the preview beside the input file. If you want the output somewhere specific, provide `--out`.

Examples:

```bash
pnpm sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map --profile simple
pnpm sdd show bundle/v0.1/examples/service_blueprint_slice.sdd --view service_blueprint --profile simple --out ./blueprint.svg
pnpm sdd show bundle/v0.1/examples/place_viewstate_transition.sdd --view ui_contracts --profile simple --out ./ui-contracts.svg
pnpm sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map --profile simple --format png --out ./outcome.png
```

Advanced note: `--backend` is a public override for preview backend selection, but it is not part of the normal quick-start path for most users.

### `sdd validate`

- Purpose: compile and validate a source `.sdd` file against a chosen profile.
- Use when: you want to check whether a document passes profile expectations, or you want to see what metadata or structure is still missing.
- Invocation: `pnpm sdd validate <input>`
- Key inputs: an input `.sdd` file, with optional `--profile`.
- Output: validation feedback and diagnostics in terminal output.

This is a good next step after drafting. A common pattern is to start by getting the structure right under `simple`, then move to `permissive` or `strict` as the document becomes more complete.

Examples:

```bash
pnpm sdd validate bundle/v0.1/examples/outcome_to_ia_trace.sdd --profile simple
pnpm sdd validate bundle/v0.1/examples/outcome_to_ia_trace.sdd --profile permissive
pnpm sdd validate bundle/v0.1/examples/outcome_to_ia_trace.sdd --profile strict
```

### `sdd compile`

- Purpose: compile a source `.sdd` file to canonical graph JSON.
- Use when: you want machine-readable compiled output, want to inspect the normalized graph shape, or need JSON for another tool.
- Invocation: `pnpm sdd compile <input>`
- Key inputs: an input `.sdd` file.
- Output: canonical JSON to `stdout` by default, or to a file when `--out` is provided.

If you are just inspecting the output, `stdout` is often enough. If you want to save or compare the result, use `--out`.

Examples:

```bash
pnpm sdd compile bundle/v0.1/examples/outcome_to_ia_trace.sdd
pnpm sdd compile bundle/v0.1/examples/outcome_to_ia_trace.sdd --out ./outcome.json --diagnostics json
```

## Supported Preview Views

The only preview-ready views in the CLI today are:

- `ia_place_map`
- `ui_contracts`
- `service_blueprint`

These are the views you should expect to work with `sdd show`. Other bundle-defined views may exist, but they are not preview-ready in the CLI yet.

## Suggested Starter Flows

### I Want A Diagram Quickly

Start with `sdd show`, use `--profile simple`, and stick with SVG unless you specifically need PNG.

```bash
pnpm sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map --profile simple
```

### I Want To Check Whether My File Is In Good Shape

Start with `sdd validate`. Use `simple` for early drafts, then move to `permissive` or `strict` as the document matures.

```bash
pnpm sdd validate bundle/v0.1/examples/outcome_to_ia_trace.sdd --profile simple
```

### I Want Structured JSON Output

Use `sdd compile`. Print to `stdout` for quick inspection, or use `--out` when you want a saved artifact.

```bash
pnpm sdd compile bundle/v0.1/examples/outcome_to_ia_trace.sdd --out ./outcome.json
```

## Practical Notes

- If you hit temp-directory permission problems in this WSL setup, rerun commands with `TMPDIR=/tmp`.
- Use `pnpm sdd --help`, `pnpm sdd help <command>`, or `pnpm sdd <command> --help` for command-specific details.

## Contract And Behavior Sources

- CLI command surface: [`src/cli/program.ts`](../../../src/cli/program.ts)
- Profiles detail: [`docs/toolchain/profiles.md`](../../toolchain/profiles.md)
- Preview behavior background: [`docs/toolchain/architecture.md`](../../toolchain/architecture.md)
- Main README quick-start context: [`README.md`](../../../README.md)
