# Readme: Structured Design Documents

This project aims to define a way to capture structure in product design diagrams, using a simple language. 

That makes such diagrams easy to author, to maintain and to integrate with, by people (including non-designers) and by LLMs. 

This in turn gives LLMs (and design-aware people in the product loop) a way to work with product design in an expressive way, making product design information a first-class citizen in LLM workflows.

Structured design documents also will integrate well, on a node-level, with concerns of the larger product creation / product management process (think "jira-issue-to-screen" mapping.)

## A simple, Well-Stuctured Language to Express Product Design

This project defines SDD-Text: a compact DSL (Domain-Specific Language) for authoring a typed product/design graph. SDD-text is easy read and to write, for people and for LLMs.

Besides the language definition, the project also contains a basic toolchain to compile, validate and render SDD-Text diagrams.

SDD-Text is defined as a spec bundle that is meant to evolve. It compiles deterministically into canonical JSON for validation (e.g., JSON Schema). This makes SDD-Text usable by software development tooling.

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
  Step-by-step UI-level activities (but *without* collapsing the world into screens)

- UI Contract:
  UI composition and state changes, per Place (and optionally per component)

## Orientation

Original document outlining the idea:
[Structured Design Artifacts to Advance the Software Product Design Practice](<initial_concepts/Structured Design Artifacts to Advance the Software Product Design Practice.md>)

Core concepts:
- [Initial Concepts 1: a 6-Diagram Suite v0.1](<initial_concepts/Initial Concepts1 a 6-Diagram Suite v0dot1.md>)
- [Initial Concepts 2: One-page Schema v0.1](<initial_concepts/Initial Concepts2 One-page Schema v0dot1.md>)


Authoring Spec: [SDD-Text v0.1 — Authoring Spec (Type-first DSL)](definitions/v0.1/authoring_spec_type_first_dsl_sdd_text_v_0_dot_1.md)

Other folders:

- [definitions/](definitions/) (/vXXX) houses definitions and rationale for version XXX (currently version 0.1)
- [bundle/](bundle/) (/vXXX) houses tight, machine-readable specifications for version XXX (currently version 0.1). These specifications are meant to drive tooling (so that encoding of actual language spec is done outside tooling).

## Again, Why?

- To give designers a way to replace well-meaning but hard-to-consume, incomplete, quickly-outdated insulated documents with something that integrates well with overall product process and with future tooling. 

- To give any product person with a little coding talent a means to create and edit design diagrams (scary to designers but practical)

- To give product managers and their tools the opportunity to link product issues (epics, stories, tasks, bugs) to specific destinations (places, screens etc) in a "live" product design document

- To give LLMs the capability to read design diagrams without burning tokens on deciphering blobs of pixels

- To give LLMs the capability to express product design as output (instead of just creating pixel blobs and code blobs)

- To give graphical UI design tools and diagramming tools the means to maintain semantic content

- To give LLMs, graphical UI design tools, and diagramming tools a way to interact, API-driven, with a future product design structure source of truth.

...in other words, to elevate product creation by properly integrating product design.

## Current State

-Solid v0.1 SDDT spec.
-Completed initial compile-validate-render pipeline

Needs work:
-Rendering output is poor. 
  -Need to replace graphviz with more suitabe engine
  -Need to invest time in rendering templates / rules per diagram typr
-Examples are mostly low-quality
  -Need to invest time in example authoring
