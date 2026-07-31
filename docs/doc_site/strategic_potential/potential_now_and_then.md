# Strategic Potential of SDD in the Product Lifecycle: Now and Then

**SDD is not just a way to draw diagrams. It is a maintainable product design graph that lets teams describe, inspect, align, and evolve product structure before, during, and after implementation.**

## Potential of SDD: Clarity and Better Signal for Product Work

SDD captures the rationale and design decisions that shape a product. It connects execution-relevant details to user-facing structure, to planning artifacts, to high-level outcomes. In doing so, SDD keeps product management connected to stakeholder concerns and to execution, through design.

With this explicit structure, a product team can keep exploration and execution aligned with with intentional product decisions, even as LLMs accellerate the process. SSD guides LLMs by making them aware of design structure, instead of allowing every prompt to invent the product anew.

Much of what SDD does has always been the promise of product design. But stale design deliverables, disconnected from product decision making and from product delivery, make product design easy to ignore, introducing design drift. SDD allows product design to deliver on its promise, by making product design information available in a dynamic, connected, impactful fashion.

## Using SDD Today

The current SDD tools rely on the command line, LLM prompting, and on handling a GitHub repo. Not many people combine those technical skills *and* product design / product management skills. 

But many of us, including designers and product managers, have been learning to use LLMs and command line tools like Claude Code, encountering formats like Markdown and Mermaid. With this experience, the gap to learning SDD is small.

SDDs are made by prompting the SDD skill with an LLM, or by manually writing a document in a text editor. Diagrams are created by rendering them, using the command line, or using the LLM skill.

When we accept that working with SDD takes some technical skill and manual steps, SDD does unlock some actual practical value.

### Practical Use: SDD as Prompt Context

An SDD can provide structural context to an LLM prompt, so the LLM won't simply guess a structure based on random training data. This is a matter of using a text editor to trim the SDD file to the relevant content, and then attaching the file. An SDD can also be referenced in context, such as in README.md, CODEX.md or CLAUDE.md files.

### Practical Use: Representing Rationale and Structure in Product Management

Traditional product management tools (like Jira, Aha, Confluence, others) capture product structure and decisions in oceans of data. Showing SDDs in this context can provide clarity, driving alignment and good product decisions. Today, showing an SDD in an external tool means rendering a diagram to a file and then attaching the file in the external tool. 

### More Specific Uses of SDD




## Possible Future

Evolving SDD:

- Users should have access to the value of SDD without requiring technicall skills. 
- LLMs should be able to access SDD without requiring a locally-installed github repo.
- The language itself should evolve to meet practical needs.
- Diagrams offered by SDD should evolve to meet practical needs.

## Future SDD App

A user-friendly app should provide friction-free access to SDD.

Possible offerings of an SDD app:
- Simple editing of SDDs
- Flexible visual design for diagrams
- Versioning of SDDs
- Reuse of common elements (templates)
- Preformatted "Packages" of SDD content that can be used for specific tasks
- Fluid browsing of an SDD's graph
- Focused (filtered) views of an SDD's graph
- Representation of links / external concerns in the context of SDD graph nodes

Such an app would unlock SDD to non-technical users, and to non-designers, so SDD can contribute value to in collaborative product definition and product management activities, integrating with existing tools.

## Future MCP Server

The current SDD Skill requires the SDD repository to be present locally. A future MCP server would enable an LLM to access equivalent functionality and more by relying on remote resources.

## Evolution of the Language

The current v0.1 of the language aims for a useful set of nodes and edges, but it is just a start. Practical use will show what works and what doesn't.

Known Language Opportunities:

- Templates: re-usable, instantiatable sections of SDD, to effectively use design patterns
- User Stories / Story Mapping: a powerful approach to product definition, worth representing.
- Personas: a commonly used solution to diiferentiate solutions for different types of users, worth representing.
- External linking: providing node-accurate link targets for external applications to link to SDD content, and providing internal representation of links to specific content items in other applications. This is a core foundation for bringing SDD value to existing tools and processes.
- Branching & versioning: allowing SDDs to track changes and represent alternative versions of branches. This is important for work that evolves over time and relies of exploration.

## Evolution of SDD Diagrams

The current set of diagrams aims to be practical and simple. 

Any specialist in design diagrams is likely to find shortcomings in the offering. Design diagrams, especially high-level ones, often carry a lot of detail and meaning, for good reasons. Missing diagrams can be added, and diagrams can evolve.

Known Diagram Opportunities:
- A level of manual layout control
- Flexible styling
- Sections: creating diagrams for part of a graph, instead of the entire graph
- Data visualization: showing information from external sources in the context of diagrams
- New "vertical" diagram types: 
    - Providing "rationale" traceability to low-level details by showing connected higher-level content
    - Providing "execution" traceability to high-level elements by showing connected lower-level content

## Potential 3rd Party Integrations

When linking SDD dontent to an external application makes sense, it is worth asking if a "better-than-links" closer integration, via API or plug-in makes *more* sense - and if it's worth it. 

Since SDD relies on diagrams, integrations with existing diagramming tools might make sense: Figma/ Figjam, Miro, etc. But a tool's capability to draw diagrams does not make it a natural integration fit. Practice will tell.