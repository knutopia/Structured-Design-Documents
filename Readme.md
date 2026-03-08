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

- file:///definitions/vXXX/ houses definitions and rationale for version XXX (currently version 0.1)
- file:///bundle/vXXX/ houses tight, machine-readable specifications for version XXX (currently version 0.1). These specifications are meant to drive tooling (so that encoding of actual language spec is done outside tooling).

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
- spec-driven parsing, compilation, validation, and IA view rendering against `bundle/v0.1/`
- first supported end-to-end render slice: `ia_place_map`
- render targets: DOT and Mermaid source text

Contributor reference docs:

- `docs/toolchain/architecture.md`
- `docs/toolchain/decisions.md`
- `docs/toolchain/development.md`
- `docs/toolchain/deferred_items.md`

Common commands:

- `pnpm build`
- `pnpm test`
- `pnpm sdd compile bundle/v0.1/examples/outcome_to_ia_trace.sdd`
- `pnpm sdd validate bundle/v0.1/examples/outcome_to_ia_trace.sdd`
- `pnpm sdd render bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map --format dot`

## Current Project Goals

### 2.2 Test & Run the New Toolchain
- Install required local tooling (Node 22 and `pnpm`)
- Install optional local tooling (Mermaid and Graphviz visualization capability)
- Actually test the toolchain locally
- Generate rendered mermaid & graphviz output from .sdd sources

### 2.3 Create Command Line Actions
- Create command line actions to run toolchain and execute mermaid / graphviz visualization as PNG

### 2.4 Expand the New Toolchain to Cover Remaining View Types

