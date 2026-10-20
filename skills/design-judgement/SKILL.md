---
name: design-judgement
description: "Apply interaction and product design judgement to existing-product analysis, research synthesis, proposed product structures, and design critique, especially alongside SDD. Use for evidence, user needs, information architecture, task flows, interaction tradeoffs, inclusion, and evaluation. Excludes SDD authoring and editing, and purely visual styling or implementation tasks."
---

# Design Judgement

Help a human designer understand the experience, make a consequential choice, or identify what needs learning next. Connect evidence to the user's task, the design mechanism, its costs, and a useful evaluation. A polished description, plausible hierarchy, or valid diagram alone does not establish a good experience.

## Frame the work

Distinguish **analysis** of an existing product, **synthesis** of a proposed experience, and **evaluation** of either. Mixed requests can use all three; keep current behavior and recommendations distinguishable. Here, synthesis includes interpreting research and composing a product from a brief.

Establish the decision, people and roles, task or desired outcome, context, available evidence, and fixed requirements. For critique, also establish the design's maturity and review focus. Infer what the supplied material supports; expose material unknowns. Ask only when a missing answer would change the direction, otherwise proceed with an explicit provisional assumption. Preserve required features while investigating their purpose.

Match the force of a claim to its basis:

- Product observations establish behavior under the inspected conditions. Mark consequential claims as observed, reported, inferred, proposed, or unknown, with a source locator where available.
- Applicable standards establish requirements within their stated scope. Research findings retain their study limits. Heuristics and design-system patterns generate questions and candidates; they do not prove a layout is right.
- Original examples and this skill's advice support reasoning; they are not user research. Simulated people, invented quotes, and numerical confidence are not collected evidence.

## Read for the decision

Load only the references that address the task. Each contains usable local guidance, examples, limits, and source links; routine use does not require browsing or the original collection.

| Decision | Read |
| --- | --- |
| What can be claimed from screenshots, walkthroughs, requirements, interviews, or mixed evidence? How should a recommendation be justified? | [Evidence and decisions](references/evidence-and-decisions.md) |
| What need matters, what to prioritize, and how to test or measure the outcome? | [Discovery and evaluation](references/discovery-and-evaluation.md) |
| What belongs together, what is a destination or mode, and how do people find and move through work? | [Information architecture](references/information-architecture.md) |
| What should actions communicate; how should feedback, disclosure, comparison, and recovery work? | [Interaction](references/interaction.md) |
| Who may be excluded; what about keyboard access, forms, language, resizing, localization, or informed choice? | [Inclusion and content](references/inclusion-and-content.md) |
| Does the product itself use AI, and how should reliance, correction, delegation, and adaptation work? | [Human–AI interaction](references/human-ai.md) |
| How to interpret qualitative themes, handoffs across actors, or an analytics feature before choosing charts? | [Supplementary sources](references/supplementary-sources.md) |
| Where did this knowledge come from, what was actually reviewed, or where does coverage end? | [Provenance](references/provenance.md), then source notes in the relevant module |

Choose the starting references by the decision's scope:

- Existing-product claims: evidence and the relevant task reference.
- Research synthesis: evidence and [SUP-01](references/supplementary-sources.md#sup-01--research-synthesis-that-preserves-differences); add discovery when choosing what to learn or measure next.
- Proposed product structure: discovery and IA.
- A focused interaction, content, or critique request: the relevant topic module; broaden into discovery or IA when the decision depends on them.

Use the AI module only when the product contains AI behavior. Verify current authoritative wording when a decision depends on a standard, platform rule, or other changing external fact; distinguish that fresh check from inherited source notes.

## Exercise judgement

**Analysis:** preserve exact labels where meaningful, roles, states, paths, and inspection limits. Separate what an interface shows from what it proves: a success message alone does not establish durable storage or delivery. An unvisited path remains unknown. If research is supplied, retain disagreements and participant context rather than turning repeated comments into population rates.

**Synthesis:** translate requirements into user work before allocating screens. Compare materially different structures when the decision warrants it: for example, an object workspace, a task queue, or a staged process. Explain the primary task and what each alternative makes easier or harder. Include consequential exceptions, handoffs, interruption, and recovery; do not invent every possible state to make the model look complete.

**Evaluation:** distinguish a demonstrated failure, an applicable standards issue, a predicted heuristic risk, and an aesthetic preference. Explain who encounters the issue, the triggering condition, and its consequence. Prioritize using severity, exposure, recoverability, and confidence in the evidence; avoid fabricated scores. Accessibility and control are task quality, not an optional final polish pass.

Use principles conditionally. “Seven items,” “fewer clicks,” “always a modal,” and “hide advanced choices” are not decision rules. State the mechanism: what people need to notice, understand, compare, remember, decide, or recover. Match the next check to the uncertainty; usability testing cannot establish demand, and a funnel cannot establish motivation.

## Make the result useful to a designer

Adapt to the requested deliverable. Prefer a clear judgement with its evidence and limits over an exhaustive checklist or a list of named principles. For consequential recommendations, include the affected task, viable alternative, provisional choice and cost, unresolved assumption, and a check that could change the choice. Compact prose or a comparison table is usually sufficient; do not force every small observation into a template.

The result should let a designer distinguish what is known, why the choice follows, who bears its costs, and what remains unresolved. A credible evidence gap can be the finding; avoid manufacturing a novel insight or declaring a proposal validated.

## Boundary with SDD

This skill supplies design reasoning in ordinary prose or tables. It contains no SDD syntax, authoring, editing, validation, rendering, or helper procedures. When an authorized task also needs those operations, use the separate **sdd-skill** for them and obtain language semantics from the selected bundle. Keep the design rationale and evidence available for that handoff; never invent model fields or treat formal validity as proof of fidelity or UX quality. This skill can also be used without SDD or that other skill installed.
