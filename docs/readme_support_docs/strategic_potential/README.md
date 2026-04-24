# Strategic Potential of SDD in the Product Lifecycle

**SDD is not just a way to draw diagrams. It is a maintainable product design graph that lets teams describe, inspect, align, and evolve product structure before, during, and after implementation.**

## Product Design Graph

SDD captures the structural elements of a design and their relationships in a unified **product design graph**. The range of the graph covers high-level *why* (outcomes) all the way to low-level *how* (UI contracts), with everything linked together. From an SDD document that contains a range of content, different [diagrams](../diagram_types/README.md) can be rendered to show a specific perspective.

The product graph can raise product quality: 

- As a tool for design exploration, it provides clarity, versatility, and the opportunity to let LLMs "speak design structure". 
- As a source of truth for development, it provides predictability, ensuring that the structure actually ships. Other design deliverables (wireframes, "screens", prototypes and isolated structural diagrams) only contain product design structure implicitly, making it easy for team members and LLMs to miss. 

Because SDD is text-based, validated, and incrementally editable, keeping the graph current can be lighter than maintaining disconnected diagrams in traditional tools, and LLMs can participate.

## Product Lifecycle

Product processes everywhere are getting reshaped by the presence of LLMs. Generally, they involve strategy, tactical preparation, implementation, and analysis. Design process plugs into product process.

SDD is process-agnostic. It does not come with a process recipe. SDD is built on the belief that a deliberate, clear, shared view of design structure is beneficial.

(That belief is neither new nor controversial, but it is hard to follow through on without something like SDD.)

Here is how that plays out in the product lifecycle:

With SDD,
- product structure becomes intentional
- concerns of different stakeholders can be mapped to design structure
- design proposals get connected to desired outcomes
- traditional product management artifacts (bugs, tasks, stories) can get enriched with stable design references
- agentic workflows can "stay on the rails", following existing product structure
- agentic workflows can create product structure (without "baking" it into code)
- designers, developers, PMs, and agents share the same product structure target

Outcomes and opportunities become connected to the product structures where they are expected to show up. That makes goals less like slide-deck intent and more like traceable product structure.

Product structure explorations remain aligned with product structure, or new structures can be explored and captured explicitly - even when working with LLMs.

This informs shared, well-grounded product decisions.

Product structure becomes an explicit input to implementation, keeping code generation aligned with the structure.

SDD is not a magic bullet to make communication issues and team dysfunction go away. It provides an opportunity to make well-informed decisions about product structure. As a code-generation input, it keeps the product on track to actually use that structure. 

This can be critical while more people generate more code with LLMs: product process is catching up with prompt-driven code that otherwise simply makes up its own product structure. In the struggle between "I can ship this idea right now" and "we are stewards of a well-structured, thoughtful solution", SDD can add some sanity.

## Current Capability and Future Surface

Rendered views:
- Current usable views: IA / Place Map, UI Contracts, Service Blueprint.
- Not yet available: Outcome-Opportunity Map, Journey Map, Scenario Flow.

Core language:
- v0.1 language definition provides a usable set of node types and edge (connection) types
- Not yet available: template mechanism, external links

LLM integration tooling:
- Codex Skill
- Not tested: Skill use in Claude
- Not yet available: MCP server

This is a new project. Version 0.1 is meant to provide a useful starting point for the language definition and its tooling. The definition is intentionally separated from tooling code, so that either can evolve.

## What SDD Is Not

SDD is not:
- a magic bullet
- a fix for broken process
- a replacement for visual design & layout tools
- a mature platform yet

...but it may be useful when treated as an opportunity.
