# SDD Command Line Tools

The command-line (CLI) tool `sdd` is the entrypoint for working with `.sdd` files in this repository. It guides additions, validates documents against profiles, compiles documents into canonical JSON, and generates diagrams.

(This is different from `sdd-helper`. `sdd` is the normal tool for people running straightforward CLI workflows. `sdd-helper` is the JSON-first tool for automation and structured mutation flows.)

## If You Are New To The Command Line

You do not need to learn the whole terminal to use the `sdd` CLI tool. You can copy and paste the example commands exactly.

- When you see `<input>`, it means “the path to your `.sdd` file”.
- When you use `--out`, you are choosing where the generated file should be written.
- If you omit `--out` with `sdd show`, the preview file is written beside the input file as `<source>.<view>.<profile>[.<backend>].<format>`.

If you want a visual result quickly, start with the next section and use the commands as written.

## Fastest Path To A Result

For most people, `sdd show` is the right first command. It compiles an SDD document, validates it, and generates a preview artifact for a chosen view.

Start with the `simple` profile. The CLI default is `strict`, but `simple` is the better starting point for early work because it is lower-noise and better suited to drafting.

SVG quick-start:

```bash
pnpm sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map --profile simple --out ./outcome.svg
```

PNG quick-start:

```bash
pnpm sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map --profile simple --format png --out ./outcome.png
```

(Inside this repository, use `pnpm sdd ...`; if the binary is on your `PATH`, the equivalent `sdd ...` commands work too.)

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

This page focuses on the four public subcommands most people need:

- `sdd add <document_path>`
- `sdd show <input> --view <view>`
- `sdd validate <input>`
- `sdd compile <input>`

If you only remember one command from this page, make it `sdd show`.

## Command Reference

### `sdd add`

- Purpose: interactively add content to an SDD file.  Content can be an incoming/outgoing relationship added to an existing node, or a new standalone node.
- Use when: you want to create SDD content in a simple way, without writing source code from scratch.
- Invocation: `pnpm sdd add <document_path>`
- Common options: `--node <node_id>` supplies an exact starting-node anchor, and `--bundle <manifest>` selects a different bundle.
- Output: guided choices, a plain-language review, and one Save or Cancel decision.

`sdd add` will ask you what you want to add and where, presenting only correct choices.

If `<document_path>` does not exist, the command guides the first standalone node without creating an empty intermediate file. The new document is created atomically only after `Save`; `Cancel` and failed saves leave the path absent. In this first-node flow, the command begins at node-type selection and omits relationship and first/last placement questions because there are no existing nodes to relate to or order against. Missing parent directories are created as part of the successful save.

Without `--node`, the command offers a standalone node and, when the document contains nodes, a relationship. Choosing a relationship opens a starting-node browser; `--node` skips that browser by supplying the exact anchor. From a known starting node, outgoing and incoming relationships each support choosing the relationship type first or choosing an existing connected node first. Each choice constrains the next list.

Applicable node and relationship lists include an option to filter by a human-readable diagram type. You can select a diagram, change it, or return to all diagram types without leaving the current browse step. This filtering happens inside the guided interaction; `sdd add` does not accept a `--view` option. Primary fields appear first, and optional details are offered only when they apply.

When a structural relationship could place one node inside another, the command asks the specific nesting question. A new node can instead remain at top level, and an existing node stays where it is unless you explicitly choose and confirm moving it. Relationship-line placement is handled internally rather than presented as a user choice.

At the review, `Cancel` performs no verification and writes nothing. `Save` verifies the unchanged proposal with a dry run. If verification has no warnings, the command commits immediately without a second ordinary confirmation. A concrete warning offers `Save anyway` or `Go back`; `Save anyway` accepts only the exact warning set just reviewed, while `Go back` returns to the unchanged proposal review. If the document, bundle, candidate result, or warning set changed after review, saving is rejected without writing and the command must be restarted.

Examples:

```bash
pnpm sdd add docs/doc_site/small_app_example/small_app.sdd
pnpm sdd add tmp_app.sdd
pnpm sdd add bundle/v0.1/examples/outcome_to_ia_trace.sdd --node O-001
```

### `sdd show`

- Purpose: compile, validate, and generate a preview artifact for a chosen view.
- Use when: you want a visible result, want to share a diagram, or want to check how a document renders under a given profile.
- Invocation: `pnpm sdd show <input> --view <view>`
- Key inputs: an input `.sdd` file and a required `--view`.
- Common options: `--profile`, `--format`, and `--out`.
- Output: SVG by default, or PNG when `--format png` is provided.

By default, the profile is `strict`, but for getting started you should usually add `--profile simple`.

If you omit `--out`, `sdd show` writes the preview beside the input file using the default name `<source>.<view>.<profile>[.<backend>].<format>`. If you want the output somewhere specific, provide `--out`.

Examples:

```bash
pnpm sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map --profile simple
pnpm sdd show bundle/v0.1/examples/service_blueprint_slice.sdd --view service_blueprint --profile simple --out ./blueprint.svg
pnpm sdd show bundle/v0.1/examples/scenario_branching.sdd --view scenario_flow --profile simple --out ./scenario.svg
pnpm sdd show bundle/v0.1/examples/place_viewstate_transition.sdd --view ui_contracts --profile simple --out ./ui-contracts.svg
pnpm sdd show bundle/v0.1/examples/branching_journey.sdd --view journey_map --profile simple --out ./journey.svg
pnpm sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map --profile simple --format png --out ./outcome.png
```

Advanced note: all six v0.1 preview views default to staged SVG/PNG backends. `--backend legacy_graphviz_preview` selects preserved Graphviz output, for example:

```bash
pnpm sdd show bundle/v0.1/examples/branching_journey.sdd --view journey_map --backend legacy_graphviz_preview --out ./journey-legacy.svg
```

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

The preview-ready views in the CLI today are:

- `ia_place_map`
- `ui_contracts`
- `service_blueprint`
- `scenario_flow`
- `outcome_opportunity_map`
- `journey_map`

All six v0.1 views are preview-ready through `sdd show`.

Dense Journey Maps can remain difficult to trace. Residual crossings receive deterministic continuity bridges and `renderer.routing.journey_map_unavoidable_crossing` warnings; the artifact is still produced so the diagnosed topology can be reviewed.

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

- Use `pnpm sdd --help` for SDD help. 
- Use `pnpm sdd help <command>` for command-specific details.
- Since the sdd command looks for files in the project root directory, file paths have to be specified, as seen in the examples above. When using the SDD command from within another directory, use `$PWD` to point the command at the current directory without typing the path: `pnpm sdd show $PWD/input.sdd --view service_blueprint --out $PWD/output.svg`
- When there are temp-directory permission problems in a WSL setup, rerun commands with `TMPDIR=/tmp`.

## Contract And Behavior Sources

- CLI command surface: [`src/cli/program.ts`](../../../src/cli/program.ts)
- Profiles detail: [`docs/toolchain/profiles.md`](../../toolchain/profiles.md)
- Preview behavior background: [`docs/toolchain/architecture.md`](../../toolchain/architecture.md)
- Main README quick-start context: [`README.md`](../../../README.md)
