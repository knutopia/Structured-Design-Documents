# Interaction Design for LLMs

**kg:**

Resources that help an LLM understand principles of interaction design

**Google:**

Top resources that help an LLM (or a developer/designer teaching an LLM) understand the principles of interaction design and human-AI collaboration include foundational industry toolkits, research-backed guidelines, and pattern libraries:

## Human-AI Interaction & Design Toolkits

* Google PAIR AI Guidebook: A foundational, human-centered guide for designing AI products, covering user needs, mental models, and setting appropriate expectations. [1] 
* Microsoft HAX Toolkit: Features 18 research-validated guidelines across four distinct interaction phases (initial, during interaction, when wrong, and over time) to plan for uncertainty and failure. [1] 
* [Shape of AI](https://www.youtube.com/watch?v=0prKrBhfYww): A curated UX design pattern library by Emily Campbell that maps the entire AI interaction lifecycle—from onboarding to handling non-deterministic outputs. [1] 
* [39 Principles for Designing Human–AI Interaction](https://syntaxstream.substack.com/p/42-principles-for-designing-humanai): A framework synthesizing probabilistic foundations, calibrated trust, transparency, and graceful failure into actionable parameters. [2] 

## Classic Interaction & Interface Design Foundations
------------------------------


[The Design of Everyday Things* Published: 1988](https://www.google.com/search?q=the+design+of+everyday+things&kgmid=/m/0hn9571)
The quintessential guide to affordances, feedback, signifiers, and human-centered design principles.
------------------------------


[About Face: The Essentials of Interaction Design* Author: Robert Reimann* Published: 2014](https://www.google.com/search?q=about+face:+the+essentials+of+interaction+design&kgmid=/g/11g_xzmp7m)
Provides deep methodologies for digital interface architecture, user behaviors, and goal-directed design.
------------------------------
NN/g (Nielsen Norman Group) Interaction Guidance


Industry-standard research and heuristic evaluations for component properties, usability, and digital workflows. [3, 4] 
## LLM-Specific Interface & System Architecture
------------------------------
The Anatomy of Current LLM Interfaces

* 

Breaks down conversation threads, input/multimodal systems, streaming/loading states, and progressive disclosure patterns.
------------------------------
System Prompt & Physics Design Guides (e.g., Josh Clark’s LLM Guide)

* 

Teaches how to write system prompts that define the "physics" and behavioral constraints of a non-deterministic AI universe rather than hardcoding static screens. [5, 6] 
If you are trying to teach an LLM these principles via system prompts/RAG or design an interface for users interacting with an LLM, let me know your specific focus so I can narrow down the right framework.

[1] [https://www.youtube.com](https://www.youtube.com/watch?v=0prKrBhfYww)
[2] [https://syntaxstream.substack.com](https://syntaxstream.substack.com/p/42-principles-for-designing-humanai)
[3] [https://www.figma.com](https://www.figma.com/resource-library/interaction-design/)
[4] [https://www.reddit.com](https://www.reddit.com/r/userexperience/comments/1165cnc/recommendations_for_resources_that_go_deep_on/)
[5] [https://medium.com](https://medium.com/design-bootcamp/the-anatomy-of-current-llm-interfaces-a-designers-complete-guide-150eca860819)
[6] [https://www.linkedin.com](https://www.linkedin.com/posts/joshclark_intelligent-interfaces-make-real-time-design-activity-7381677669844938752-OR44)

**kg:**

Yes: I am attempting to assemble some sort of locally-available knowledge base that allows an LLM to be somewhat less blind to the issues of UX design, user-centered design, usability etc so that the LLM can take design considerations into account for product structure / UX / UI decisions.

**Google:**

To allow an LLM to take structural product, UX, and UI decisions into account, it needs more than high-level prose—it needs an actionable, operational framework that translates design heuristics into systemic variables it can reason against.

Here is the file: 
[ux_principles_kb.md](ux_principles_kg.md)

This markdown document is structured specifically to serve as a high-density, locally-injectable Knowledge Base or RAG chunk. It organizes abstract UX concepts into structured, pseudo-deterministic parameters that an LLM can parse and apply when analyzing user flows, layout constraints, or product feature sets.

## How to use this file with your LLM:

   1. Inject as Context (RAG): Load this file into your document embeddings index or system context window.
   2. Operational Prompting: Instruct the model to audit its own code generation, wireframes, or product definitions against this specific document. For example:
   
   "Analyze the proposed checkout user flow. Cross-reference the steps explicitly against Section 1 (Heuristic #3 and #5) and Section 4 (Hick's Law) of the provided ux_principles_kb.md file. Output a breakdown of where the design fails or succeeds."
   
   
## Key Sections inside the Knowledge Base:

* 
* The 10 Nielsen Heuristics: Translated into specific operational requirements for digital software (e.g., matching the "Visibility of System Status" to explicit async state animations).
* Norman's Interaction Principles: Teaching the LLM how to reason about interface physics (affordances, signifiers, and semantic feedback loops).
* Microsoft HAX Framework Integration: Specifically targeted for human-AI interaction parameters, instructing the LLM on how to structurally accommodate failure states, error correction, and probabilistic uncertainty.
* UI Architecture Laws: Quantifiable structural rules including Fitts's Law, Hick's Law (and how it maps directly to progressive disclosure), and Miller's Law for data chunking and information hierarchy.
* 

Would you like me to build a System Prompt template that accompanies this knowledge base file, explicitly defining exactly how the LLM should act as a senior UX Auditor using these rules?

**kg:**

Sure, please suggest a prompt template. There are two primary tasks (that might inform your prompt):

- analysis of existing products & websites, capturing IA/Place Map and UI Contracts diagrams (for example) in a meaningful way (where LLMs tend to be tempted to stray and capture abstract structures instead of sticking close to reality)
- synthesis of product structure, creating information architecture and other product composition elements in response to a prompt that specifies features or function rather than structure.

Both of these tasks are done using SDD (Structured Design Documents):
https://knutopia.github.io/Structured-Design-Documents
https://github.com/knutopia/Structured-Design-Documents

**Google:**

This System Prompt Template is built specifically to address the core blind spots LLMs face when executing these two exact tasks.
LLMs natively struggle with grounding (they hallucinate abstract conceptual schemas rather than documenting raw UI reality) and structural synthesis (they treat architecture as a narrative text rather than a rigid relational graph). This prompt explicitly weaponizes the deterministic rules of SDD (Structured Design Documents) to force the LLM into a grounding and structural mindset.

------------------------------

# SYSTEM INSTRUCTIONS: SENIOR PRODUCT ARCHITECT & SDD REASONING ENGINE
You are an expert Senior Product Architect specialized in Human-Centered Design, Systems Architecture, and Interface Ergonomics. Your primary mechanism for reasoning, documenting, and validating software architectures is **SDD (Structured Design Documents)**. 

You look at digital products not as abstract concepts, but as deterministic state machines composed of explicit information architectures, physical boundaries, and transactional user contracts.
---## 🛑 THE GOLDEN RULES OF GROUNDING (ANTI-ABSTRACT GUARDRAILS)1. **NO CONCEPTUAL HALLUCINATIONS:** When analyzing existing interfaces, you MUST capture *what is physically on the screen*, not the high-level business philosophy behind it. If a button says "Submit Expense," it is an action node tied to a transactional boundary, not an abstract "Financial Optimization Node."
2. **THE LITERAL SURFACE PRINCIPLE:** If a human user cannot physically see it, click it, hover over it, or navigate to it, it DOES NOT EXIST in your `ia_place_map` or `ui_contracts`. 3. **RELATIONAL INTEGRITY:** You do not invent soft relationships. Nodes are linked only by explicit traversal paths (for IA) or hard data mutations/hierarchies (for UI Contracts).
---## 🛠️ TASK PROTOCOLS### TASK 1: Reverse-Engineering & Deconstruction (Analysis Mode)Your goal is to parse a raw description, DOM structure, or user narrative of an existing product and map it strictly into concrete SDD schemas (`ia_place_map` or `ui_contracts`).
*   **IA/Place Map Execution:** Document the physical topology. Identify static places, dynamic views, and explicit transit paths. If a user has to click a modal to see data, that modal is a distinct sub-view state with an explicit entrance and exit edge.*   **UI Contracts Execution:** Focus on inputs, outputs, states, and action triggers. Capture the exact parameters exchanged across boundaries. Never abstract away a text field into "user data"—specify fields explicitly.
### TASK 2: Functional Synthesis & Translation (Composition Mode)Your goal is to take unstructured product requirements, feature descriptions, or functional briefs and synthesize a completely new, rigorous product structural architecture in raw SDD syntax.
*   **Structural Manifestation:** Translate functional intents into interface geometry and spatial hierarchies using established UX laws (Hick’s Law for choice architecture, Fitts’s Law for target weighting, Miller’s Law for content chunking).*   **Progressive Disclosure Enforcement:** If a feature brief describes a complex multi-step settings panel, do not collapse it into a single bloated screen. Mechanistically break it into parent containers and conditional child views using valid structural nesting.
---## 📐 THE SDD SYNTAX & SPECIFICATION CONSTRAINT
You must strictly output syntactic design structures compatible with the `sdd` toolchain specifications. Ensure you adhere to version rules regarding node-type mapping, step differentiation across diagrams, and structural nesting protocols.
### Active Viewports & Visual Engines:When outputting architecture, you must format data models to explicitly satisfy the constraints of these visual layers:
- `ia_place_map` (For structural routes, physical views, parent-child spatial layout)
- `ui_contracts` (For strict interface boundaries, field states, structural input/output nodes)
- `scenario_flow` | `journey_map` | `service_blueprint` | `outcome_opportunity_map`
---## 📥 INTERACTION WORKFLOW
Whenever the user prompts you to analyze or synthesize a design system, you must structure your response according to this exact schema:
1.  **UX Grounding Rationale:** A brief, 3-sentence maximum technical justification of why you are structuring the nodes this way based on strict cognitive ergonomics (e.g., "To avoid cognitive overloads under Hick's Law, the profile onboarding is decoupled from the main workspace place...").
2.  **SDD Document block:** A single clean code-block containing valid, self-consistent SDD text ready to be run directly against `pnpm sdd compile` or `pnpm sdd show`.
3.  **Validation Check:** A rigorous self-audit listing any potential edge-crossings or deep nesting complexities that the `sdd validate` profile might flag.

------------------------------

## Why this template works for SDD:

* Restricts the Language Model's Scope: By stating "If a human user cannot physically see it... it DOES NOT EXIST," it stops the LLM from inventing invisible "database layers" or "business logic nodes" that ruin an interface layout map.
* Integrates with the sdd CLI: It directly mentions ia_place_map, ui_contracts, and compiler hooks (pnpm sdd compile), priming the LLM's internal token weights to think in terms of the tool's codebase constraints.

Would you like to walk through a concrete example where we feed a messy, raw feature description into this prompt to see how it synthesizes a compliant SDD syntax block?

