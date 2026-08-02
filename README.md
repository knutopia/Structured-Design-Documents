# README: Structured Design Documents

SDD-Text is a compact language for describing software product design as a structured map. SDD-Text is easy to read and write, for people and for LLMs.

## Quick Start

Prerequisites: [Git](https://github.com/git/git), [Node.js 22 LTS](https://github.com/nodejs/node), and [pnpm](https://github.com/pnpm/pnpm). Install Node.js 22 first; `pnpm` will be activated via Corepack in the steps below.

```bash
git clone https://github.com/knutopia/Structured-Design-Documents.git
cd Structured-Design-Documents
scripts/setup-corepack.sh       # Mac, WSL, Linux
# .\scripts\setup-corepack.ps1  # on Windows, use this instead (in Powershell)
pnpm install
pnpm run build
pnpm sdd --help
pnpm sdd show docs/doc_site/small_app_example/small_app.sdd --profile simple --view ia_place_map --out my_first_ia.svg
```

Notes:

- The setup scripts activate the repo-pinned `pnpm` version declared in `package.json`.
- In WSL, if future shells route Corepack through `/mnt/c/...`, run `scripts/setup-corepack.sh --write-profile` or add `export COREPACK_HOME="$HOME/.cache/corepack"` to `~/.profile`.
- If you hit temp-directory permission errors in some WSL setups, rerun commands with `TMPDIR=/tmp`. For more environment details, see [docs/toolchain/development.md](/home/knut/projects/sdd/docs/toolchain/development.md). See [bundle/v0.1/examples/](bundle/v0.1/examples/) for additional sample `.sdd` inputs.

## Syntax Highlighting

Install the [textmate grammar for SDD](editors/vscode-sdd/README.md) for syntax highlighting in VS Code. (The grammar is not in the VS Code extensions marketplace yet.)

This probably works with other editors too. The grammar is used for source code display in the [project documentation site.](https://knutopia.github.io/Structured-Design-Documents/)

## Orientation

- [bundle/v0.1/](bundle/v0.1/) houses the tight, machine-readable specifications for version 0.1. These specifications are the source of truth for tooling.

- [definitions/v0.1/](definitions/v0.1/) houses explanatory definitions and rationale for version 0.1 and should stay consistent with the bundle.

### Learn More

- Using SDD-Skill with an LLM: [SDD Skill Guide](docs/doc_site/sdd-skill/)

- SDD CLI Guide ("sdd show" etc): [SDD CLI User Guide](docs/doc_site/sdd_cli_tools/)

- SDD Helper Guide (JSON-first companion for the skill): [SDD Helper Guide](docs/doc_site/sdd-helper/)

- Authoring Spec: [SDD-Text v0.1 — Authoring Spec (Type-first DSL)](definitions/v0.1/authoring_spec_type_first_dsl_sdd_text_v_0_dot_1.md)

- [Initial Concepts 1: a 6-Diagram Suite v0.1](<docs/doc_site/initial_concepts/Initial Concepts1 a 6-Diagram Suite v0dot1.md>)

- [Initial Concepts 2: One-page Schema v0.1](<docs/doc_site/initial_concepts/Initial Concepts2 One-page Schema v0dot1.md>)

- Original document outlining the idea: [Structured Design Artifacts to Advance the Software Product Design Practice](<initial_concepts/Structured Design Artifacts to Advance the Software Product Design Practice.md>)

- [Strategic Potential of SDD in the Product Lifecycle](<docs/doc_site/strategic_potential/README.md>)

## Current Status

### Working Now

- Solid v0.1 SDDT spec bundle
- Completed initial compile-validate-render pipeline.
- Completed usable staged SVG renderers for IA / Place Map, UI Contract, Service Blueprint, Scenario Flow, Outcome-Opportunity Map, and Journey Map
- sdd-helper app available to assist agentic skills

### Known Limitations

- Dense or highly connected Journey Maps can remain difficult to trace; residual crossings use deterministic continuity bridges and emit `renderer.routing.journey_map_unavoidable_crossing` warnings.
- Across staged renderers, connectors between unobstructed horizontally adjacent nodes can still use multi-segment doglegs and distracting vertical offsets instead of one straight horizontal segment; a global routing simplification is deferred.
- Styling for renderers lives in TypeScript source and should be in CSS files
- Example corpus is spotty
- No "simple" non-technical user guidance available yet

### Current Focus

- LLM integration (Skills, MCP Server)

## Planned Additions

- Possibly standalone SDDT file server?

## License And Contributions

- License: this project is available under the [MIT License](LICENSE).
- Contributing: please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening an issue or pull request. This repository is currently coordination-first and is not accepting unsolicited pull requests.
- Contributor License Agreement: accepted outside contributions also require written acceptance of the [CLA](CLA.md) before implementation or merge.
