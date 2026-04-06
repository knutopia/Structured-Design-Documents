# Readme: Structured Design Documents

SDD-Text is a compact language for describing software product design as a structured map, so design elements and their relationships are explicit rather than spread across disconnected diagrams and documents. That makes product design structure easier for people, tools, and AI to understand, validate, and render consistently.

Technically, it is a DSL for authoring a structured graph of design information.

This repository contains the SDD-Text toolchain for compiling, validating, and rendering structured design documents. SDD-Text compiles deterministically into canonical JSON for tooling, while different views of the same unified graph can be rendered as diagrams.

## Quick Start

These commands install dependencies, build the toolchain, inspect the CLI, and render a sample view:

```bash
pnpm install
pnpm run build
pnpm sdd --help
pnpm sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map
```

If you hit temp-directory permission errors in some WSL setups, rerun commands with `TMPDIR=/tmp`. See [bundle/v0.1/examples/](bundle/v0.1/examples/) for additional sample `.sdd` inputs.

## A Simple, Well-Structured Language to Express Product Design

This project defines SDD-Text: a compact DSL (Domain-Specific Language) for authoring a typed product/design graph. SDD-Text is easy to read and write, for people and for LLMs.

Besides the language definition, the project also contains a basic toolchain to compile, validate and render SDD-Text diagrams.

SDD-Text is defined as a spec bundle that is meant to evolve. It compiles deterministically into canonical JSON for validation. This makes SDD-Text usable by software development tooling. The result can then be rendered as a diagram. Because rendering is separate from the source model, tools that work with design structure do not need graphical capabilities, while rendering tools can focus solely on presentation.

SDD-Text can create a unified "Product Design Graph", which captures a variety of product design perspectives as a single, interconnected set of nodes. Different aspects of the unified graph can then be shown (rendered) as diagrams.

## Diagram Types (Initial Targets)

- Outcome-Opportunity Map:
  Product intent, explicit and traceable: what the product solves, and how to know it works.

- Journey Map:
  Experience intent from above: stages and steps, needs, friction, moments of truth.

- Service Blueprint:
  Connects user experience steps to the layers needed to realize it.

- IA (Information Architecture) / Place Map:
  Source of truth for product structure: what exists, where it lives, and how it connects.

- Scenario Flow:
  Step-by-step UI-level activities (but *without* collapsing the world into screens).

- UI Contract:
  UI composition and state changes, per Place (and optionally per component).

## Orientation

For tooling, [bundle/v0.1/](bundle/v0.1/) is the machine-readable source of truth. [definitions/v0.1/](definitions/v0.1/) contains explanatory commentary and rationale, and should stay consistent with the bundle.

Original document outlining the idea:
[Structured Design Artifacts to Advance the Software Product Design Practice](<initial_concepts/Structured Design Artifacts to Advance the Software Product Design Practice.md>)

Core concepts:
- [Initial Concepts 1: a 6-Diagram Suite v0.1](<initial_concepts/Initial Concepts1 a 6-Diagram Suite v0dot1.md>)
- [Initial Concepts 2: One-page Schema v0.1](<initial_concepts/Initial Concepts2 One-page Schema v0dot1.md>)

Authoring Spec (human-oriented reference): [SDD-Text v0.1 — Authoring Spec (Type-first DSL)](definitions/v0.1/authoring_spec_type_first_dsl_sdd_text_v_0_dot_1.md)

Other folders:

- [bundle/](bundle/) (/vXXX) houses the tight, machine-readable specifications for version XXX (currently version 0.1). These specifications are the source of truth for tooling.
- [definitions/](definitions/) (/vXXX) houses explanatory definitions and rationale for version XXX (currently version 0.1), and should stay consistent with the bundle.

## Again, Why?

- To give designers a way to replace well-meaning but hard-to-consume, incomplete, quickly outdated insulated documents with something that integrates well with overall product process and with future tooling.

- To give any product person with a little coding talent a means to create and edit design diagrams (scary to designers but practical).

- To give product managers and their tools the opportunity to link product issues (epics, stories, tasks, bugs) to specific destinations (places, screens, etc.) in a "live" product design document.

- To give LLMs the capability to read design diagrams without burning tokens on deciphering blobs of pixels.

- To give LLMs the capability to express product design as output (instead of just creating pixel blobs and code blobs).

- To give graphical UI design tools and diagramming tools the means to maintain semantic content.

- To give LLMs, graphical UI design tools, and diagramming tools a way to interact, API-driven, with a future product design structure source of truth.

...in other words, to elevate product creation by properly integrating product design.

## Current State

- Solid v0.1 SDDT spec.
- Completed initial compile-validate-render pipeline.
- Completed usable SVG renderers for IA / Place Map, UI Contract and Service Blueprint

Needs work:
- Outcome-Opportunity Map, Journey Map and Scenario Flow renderers:
  - no usable SVG renderers yet
  - poor Graphviz renderers still in place
- Need to invest time in rendering templates
- Need to separate styles into CSS files
- Example Corpus needs to be strenghtend
- Author user guidance for graph structure, diagram types

Future:
- LLM integration (MCP)
- Standalone SDDT file server?+
