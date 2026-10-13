# UX and product design knowledge for SDD

A locally readable reference for an LLM helping with product structure, information architecture, interaction, and UI decisions. It supports two tasks: **describing an existing product faithfully** and **proposing a product structure from a functional brief**.

Status: first curated collection, researched on **2026-10-11** and reviewed on **2026-10-12**. This is design knowledge, not an SDD specification or a packaged system prompt/skill. The summaries and worked examples are original synthesis; external sources are linked at the point of use. The original model-generated material is preserved in [seed/](seed/README.md).

## Start with the decision

| Decision or uncertainty | Read | What it contributes |
| --- | --- | --- |
| What problem should this product solve, for whom, and how will we know? | [Product discovery and evaluation](product_discovery_and_evaluation.md) | Needs, outcomes, research, prioritization, experiments, measurement, service boundaries |
| What can we claim about the product we inspected? | [Evidence and decision records](evidence_and_decision_records.md) | Provenance, uncertainty, analysis versus proposals, reviewable rationale |
| What belongs together, where does it live, and how do people get there? | [Information architecture and SDD](information_architecture_and_sdd.md) | Organization, navigation, place/state distinctions, analysis and synthesis examples, bundle references |
| How should an interaction behave and communicate? | [Core interaction principles](ux_principles_kb.md) | Usability heuristics, conceptual models, feedback, error recovery, disclosure, visual hierarchy, limits of cognitive laws |
| Who might be excluded or unable to complete the task? | [Inclusive interaction and content](inclusive_interaction_and_content.md) | Accessibility, keyboard/focus, forms, language, responsive behavior, consent and control |
| Does the product itself use AI? | [Human–AI interaction](human_ai_interaction.md) | Correct HAX coverage, uncertainty, correction, meaningful review, ongoing control |
| Where should deeper research begin? | [Reading map and collection backlog](reading_map.md) | Source roles, verified reading routes, book candidates, missing coverage, collection policy |

For **analysis**, start with evidence and IA, then consult the interaction and accessibility modules for the observed task. Record proposed improvements separately from the description of the current product.

For **synthesis**, start with discovery, generate plausible structural alternatives using IA, and examine their interaction and inclusion costs. State assumptions and the next useful test. Use AI-specific guidance only if the proposed product actually includes AI; an LLM author does not make every product an AI product.

## Authority and acceptance invariants

These are editorial constraints for this collection, established before expansion:

1. **SDD meanings come from the selected bundle.** For v0.2, use the [manifest](../../../../bundle/v0.2/manifest.yaml), [vocabulary](../../../../bundle/v0.2/core/vocab.yaml), [contracts](../../../../bundle/v0.2/core/contracts.yaml), and [views](../../../../bundle/v0.2/core/views.yaml). The [repository instructions](../../../../AGENTS.md) and [v0.2 explanation](../../../../definitions/v0.2/README.md) establish that authority. This collection adds no node types, properties, validation rules, or renderer behavior. Older documents retain their own bundle semantics.
2. **A design hypothesis is not an observation.** Preserve source, role, state, device/context, and inspection limits. Describe unsupported behavior as unknown; keep proposed changes visibly separate.
3. **Match the force of a claim to its source.** Accessibility standards, bounded research findings, heuristics, vendor patterns, and our own design advice have different roles. A heuristic suggests what to examine; it does not prove a screen must have a particular shape. Nielsen explicitly describes his principles as rules of thumb ([source](https://www.nngroup.com/articles/ten-usability-heuristics/)).
4. **Advice must support a decision.** Include its situation, reasoning, relevant alternative or failure case, and a way to evaluate it. A named principle alone is insufficient justification.
5. **Sources must be traceable.** Distinguish material actually consulted from books only identified through author/publisher descriptions. Keep concise local synthesis, not unlicensed full-text copies.
6. **A valid diagram is not proof of a good experience.** Bundle validation checks representation under the selected profile. Task observation, prototypes, accessibility evaluation, and product evidence answer different questions.

Normative contracts: the selected SDD bundle and explicitly applicable accessibility requirements. Architectural guardrails: repository instructions. Visual exemplars: no product screenshot or rendered diagram was supplied for this collection; its examples are hypothetical and should not be mistaken for an inspected product.

## How to use an entry

Each module has stable identifiers such as `UX-03`, `IA-02`, or `PD-01` for reference. These are documentation identifiers, not SDD syntax. Read an entry together with its limits and sources. Retrieve the relevant module, rather than treating every guideline as a mandatory checklist for every task.

A useful decision explanation connects **evidence → user/task need → alternatives → choice and cost → validation**. For example, “Approvers compare receipts repeatedly, so keep the receipt beside the editable amount; test whether this reduces cross-page checking” is more useful than “Use fewer screens because of Hick’s law.” See the [decision record](evidence_and_decision_records.md) for a fuller example.

## Corrections to the seed

| Seed claim | Curated treatment |
| --- | --- |
| Design principles supply deterministic parameters | Principles inform judgments under uncertainty; user evidence and context select among alternatives |
| Nothing outside the visible screen belongs in IA/UI contracts | Ground claims in observed behavior and other identified evidence, including keyboard interaction; follow each view’s bundle scope |
| Every modal necessarily becomes a new place | Distinguish navigable locations from modes, components, and state; see the IA module |
| UI contracts describe only hard data mutations | Use the bundle’s actual composition and behavior model |
| “7 ± 2” caps menu or group size | The memory research does not establish a UI item quota; see `UX-03` |
| Hick’s law mandates progressive disclosure | Disclosure is a contextual pattern, with discovery and comparison costs; see `UX-04` |
| Fitts’s law determines product geometry | It concerns pointing performance under specified conditions; see `UX-05` |
| The seed’s ten numbered items represent HAX | The original framework has eighteen guidelines; the AI module preserves their grouping and numbering |
| Async actions always need an animation; mistakes always need confirmation | Match feedback and safeguards to duration, consequence, reversibility, and user context |

## Scope of this first collection

The core now includes practical guidance as well as sources, with emphasis on SDD’s two authoring tasks. It is suitable as a reference draft for review. It has **not** been evaluated for whether it improves LLM decisions, and it is not a complete UX library. The [backlog](reading_map.md#collection-backlog) makes the next research areas explicit. Prompt design, retrieval implementation, and skill packaging remain later decisions.
