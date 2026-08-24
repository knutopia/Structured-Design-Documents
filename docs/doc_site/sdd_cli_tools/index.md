# SDD Command Line Tools

The command-line (CLI) tool `sdd` is the entrypoint for working with `.sdd` files in this repository. It guides additions, validates documents against profiles, compiles documents into canonical JSON, and generates diagrams.

(This is different from `sdd-helper`. `sdd` is the normal tool for people running straightforward CLI workflows. `sdd-helper` is the JSON-first tool for automation and structured mutation flows.)

## If You Are New To The Command Line

You do not need to learn the whole terminal to use the `sdd` CLI tool. You can copy and paste the example commands exactly.

- When you see `<input>`, it means “the path to your `.sdd` file”.
- When you use `--out`, you are choosing where the generated file should be written.
- If you omit `--out` with `sdd show`, the preview file is written beside the input file as `<source>.<view>.<detail>[.<backend>].<format>`.

If you want a visual result quickly, start with the next section and use the commands as written.

## Fastest Path To A Result

For most people, `sdd show` is the right first command. It compiles an SDD document, validates it, and generates a preview artifact for a chosen view.

SVG quick-start:

```bash
pnpm sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map --out ./outcome.svg
```

PNG quick-start:

```bash
pnpm sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map --format png --out ./outcome.png
```

(Inside this repository, use `pnpm sdd ...`; if the binary is on your `PATH`, the equivalent `sdd ...` commands work too.)

What to expect:

- `sdd show` renders a diagram.
- SVG is the default output format.
- PNG is available with `--format png`.
- `simple` is the default validation profile.
- `compact` is the default render detail.

For what it's worth, the [profile](../profiles.md) determines how much the completeness of an SDD is checked. The render detail determines how much detail is shown in the diagram.

## Public Commands At A Glance

Five most relevant subcommands:

- `sdd add <document_path>`: add nodes, relationships to an SDD
- `sdd show <input> --view <view>`: create a diagram
- `sdd validate <input>`: check that the SDD is self-consistent
- `sdd compile <input>`: create json from an SDD
- `sdd defaults show|set|unset`: inspect or manage persistent CLI preferences

To edit an SDD without getting an LLM incvolved, remember `sdd add`.
To make diagrams from SDD, remember `sdd show`.

## Command Reference

:::tabs

== sdd add
Examples:

```bash
pnpm sdd add docs/doc_site/small_app_example/small_app.sdd
pnpm sdd add name_of_a_nonexistent_file.sdd
pnpm sdd add bundle/v0.1/examples/outcome_to_ia_trace.sdd --node O-001
```

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

== sdd show
Examples:

```bash
pnpm sdd show real_world_exploration/billSage_example/billSage_structure.sdd --view ia_place_map --detail compact --out ./compact_example.svg
pnpm sdd show real_world_exploration/billSage_example/billSage_structure.sdd --view ia_place_map --detail detailed --out ./detailed_example.svg
pnpm sdd show bundle/v0.1/examples/service_blueprint_slice.sdd --view service_blueprint --out ./blueprint.svg
pnpm sdd show bundle/v0.1/examples/scenario_branching.sdd --view scenario_flow --profile simple --out ./scenario.svg
pnpm sdd show bundle/v0.1/examples/branching_journey.sdd --view journey_map --profile simple --out ./journey.svg
pnpm sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view all --out ./outcome.svg
```

- Purpose: compile, validate, and generate preview artifacts for one chosen view or every applicable view.
- Use when: you want a visible result, want to share diagrams, or want to check how a document renders at a given detail level.
- Invocation: `pnpm sdd show <input> --view <view>`
- Key inputs: an input `.sdd` file and a required `--view`; use `--view all` to consider every operational renderable view.
- Common options: `--profile`, `--detail`, `--format`, and `--out`.
- Output: SVG by default, or PNG when `--format png` is provided.

When `--profile` or `--detail` is omitted, `sdd show` resolves that setting from your user default and then the bundle fallback. The shipped v0.1 fallbacks are `simple` and `compact`; an explicit option overrides the saved preference for one invocation. Profile controls validation and detail controls rendering independently.

With `--view all`, `sdd show` generates only views that retain visible semantic content after the selected detail policy. Finding no applicable views is successful and writes no files. An explicit backend must support every available view, and `--dot-out` cannot be combined with `--view all`.

If you omit `--out`, `sdd show` writes output beside the input file using `<source>.<view>.<detail>[.<backend>].<format>`. With `--view all --out ./diagram.svg`, the output template becomes files such as `diagram.ia_place_map.svg` and `diagram.journey_map.svg`.

### Detail Choice

- `compact`: cleaner, easier-to-scan diagram
- `detailed`: adds supporting labels and context

== sdd validate

- Purpose: compile and validate a source `.sdd` file against a chosen profile.
- Use when: you want to check whether a document passes profile expectations, or you want to see what metadata or structure is still missing.
- Invocation: `pnpm sdd validate <input>`
- Key inputs: an input `.sdd` file, with optional `--profile`.
- Output: validation feedback and diagnostics in terminal output. A successful default-format run writes
  `Validated N nodes and M edges.` to stdout, including when non-blocking warnings are present. The human
  summary is suppressed with `--diagnostics json` so machine-oriented output remains free of plain text.

This is a good next step after drafting. A common pattern is to start by getting the structure right under `simple`, then move to `permissive` or `strict` as the document becomes more complete.

== sdd compile
Examples:

```bash
pnpm sdd compile bundle/v0.1/examples/outcome_to_ia_trace.sdd
pnpm sdd compile bundle/v0.1/examples/outcome_to_ia_trace.sdd --out ./outcome.json --diagnostics json
```

- Purpose: compile a source `.sdd` file to canonical graph JSON.
- Use when: you want machine-readable compiled output, want to inspect the normalized graph shape, or need JSON for another tool.
- Invocation: `pnpm sdd compile <input>`
- Key inputs: an input `.sdd` file.
- Output: canonical JSON to `stdout` by default, or to a file when `--out` is provided.

If you are just inspecting the output, `stdout` is often enough. If you want to save or compare the result, use `--out`.

== sdd defaults
See current global defaults:

```bash
pnpm sdd defaults show
```

To set a global default:

```bash
pnpm sdd defaults set profile simple
pnpm sdd defaults set detail compact
```

Revert to the bundle-provided values:

```bash
pnpm sdd defaults unset profile
pnpm sdd defaults unset detail
```

Validation profile is set to `simple` and render detail to `compact` as global defaults. Those global defaults are used by command line tools, unless a `--profile` or `--detail` setting is specified with the tool call.

Each setting resolves independently in this order:

1. `--profile` or `--detail` for the current invocation (command line option)
2. your user-global SDD configuration
3. the selected bundle's fallback

The global file is `${XDG_CONFIG_HOME}/sdd/config.yaml`, falling back to `~/.config/sdd/config.yaml`, on Linux and WSL. It is `~/Library/Application Support/sdd/config.yaml` on macOS and `%APPDATA%\sdd\config.yaml` on Windows.
:::

## Supported Diagrams

The diagram types in the CLI today are:

- `ia_place_map`
- `ui_contracts`
- `scenario_flow`
- `outcome_opportunity_map`
- `journey_map`
- `service_blueprint`

See [Diagram Types](../diagram_types/) for more information.

## Suggested Starter Flows

### I Want to Create an SDD from Scratch

Use `sdd add` with a file name for a new sdd file. The tool will create the empty file and ask you for a node type to add. If you have a specific diagram in mind, you can filter node types by the diagram types that use them. Re-run `sdd add` to add more nodes and relationships between nodes.

```bash
pnpm sdd add my_sdd_file.sdd
```

### I Want A Diagram Quickly

Start with `sdd show`, use `--profile simple --detail compact`, and stick with SVG unless you specifically need PNG.

```bash
pnpm sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map --profile simple --detail compact
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
