# Reading map and collection backlog

[Reference index](index.md) · Collected 2026-10-11; reviewed 2026-10-12

The topic modules contain the locally usable content and their annotated sources. This page explains where to go deeper and what still needs collecting. It is a curated route through the material, not a claim to cover all UX practice.

## Source roles

| Role | What it can establish | How to use it here |
| --- | --- | --- |
| Standard or local machine contract | Requirements within its declared scope | Check exact version, applicability, criterion, and exceptions |
| Original empirical research | Findings under stated methods and conditions | Preserve task, population, and measurement limits |
| Research review or conceptual theory | Explanatory models and synthesis | Use the model to ask better questions; distinguish findings from inference |
| Original practitioner guidance | Methods, patterns, and experience-based advice | Treat as a strong starting point, then examine context and alternatives |
| Official design-system pattern | Behavior and rationale for an ecosystem | Transfer the rationale carefully; verify the local implementation |
| Product observation | Behavior under observed conditions | Preserve role, state, version, and source locator |
| This KB's synthesis | Proposed application of the preceding sources | Keep examples hypothetical and recommendations testable |

“Primary” means close to the origin of the work, not automatically correct or universally applicable. A publisher's book description is primary evidence about a book's identity and advertised scope; it is not evidence that we reviewed its arguments. A public source also does not imply permission to redistribute its entire text.

## Read these routes first

Links in this table were consulted during this collection; more detailed source/access notes live in the linked modules. The table gives each source a research purpose, without replacing its full context.

| Design question | Starting source | Local synthesis |
| --- | --- | --- |
| Are we solving an evidenced need? | [GOV.UK: learning about user needs](https://www.gov.uk/service-manual/user-research/start-by-learning-user-needs) | [Product discovery](product_discovery_and_evaluation.md) |
| Which assumption most threatens the idea? | [Torres: assumption testing](https://www.producttalk.org/assumption-testing/) | [Product discovery](product_discovery_and_evaluation.md) |
| How do we measure a useful result? | [Google: HEART publication](https://research.google/pubs/measuring-the-user-experience-on-a-large-scale-user-centered-metrics-for-web-applications/) | [Product discovery](product_discovery_and_evaluation.md); access limitation noted there |
| Why might a favorable metric be misleading? | [Microsoft: metric interpretation pitfalls](https://www.microsoft.com/en-us/research/wp-content/uploads/2020/08/2017-08-KDDMetricInterpretationPitfalls.pdf) | [Product discovery](product_discovery_and_evaluation.md) |
| What should an interaction review examine? | [Nielsen's heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) | [Core interaction](ux_principles_kb.md) |
| Can people perceive how an action works? | [Norman: signifiers](https://jnd.org/signifiers-not-affordances/) | [Core interaction](ux_principles_kb.md) |
| Which cognitive models are being overextended? | [Miller's original paper](https://psychclassics.yorku.ca/Miller/), [MacKenzie's Fitts review](https://www.yorku.ca/mack/hci1992.html) | [Core interaction](ux_principles_kb.md) |
| What is organization versus navigation? | [NN/g: IA versus navigation](https://www.nngroup.com/articles/ia-vs-navigation/) | [IA and SDD](information_architecture_and_sdd.md) |
| How do we explore and test categories? | [NN/g: card sorting](https://www.nngroup.com/articles/card-sorting-definition/), [tree testing](https://www.nngroup.com/articles/tree-testing/) | [IA and SDD](information_architecture_and_sdd.md) |
| What accessibility requirements apply? | [W3C: WCAG 2.2](https://www.w3.org/TR/WCAG22/) | [Inclusive interaction](inclusive_interaction_and_content.md) |
| How should a modal behave across input modes? | [W3C: APG dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | [Inclusive interaction](inclusive_interaction_and_content.md) |
| How should uncertainty and correction work in AI? | [Microsoft: HAX guidelines](https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/), [Google: PAIR guidebook](https://pair.withgoogle.com/guidebook/) | [Human–AI interaction](human_ai_interaction.md) |

The public collection currently leans toward NN/g, W3C, GOV.UK, Microsoft Research, and Google. They contribute useful but different forms of authority. Government-service and large-technology-company experience should not be mistaken for coverage of every commercial, cultural, or specialist context.

## Books for depth: identified, not fully reviewed

Only the linked author/publisher material was checked, on **2026-10-11–12**. No full-text copy of these books has been added, and no module claims to summarize their unread chapters. The proposed extraction questions are this collection's research agenda.

| Book and verified reference | Why it belongs on the reading list | Question for a later licensed reading |
| --- | --- | --- |
| Don Norman, *The Design of Everyday Things*, revised and expanded edition (2013). [Author's description and contents](https://jnd.org/books/the-design-of-everyday-things-revised-and-expanded-edition/) | Conceptual foundations; complements the author's public essays already used | How do conceptual models, constraints, feedback, and real product-development tradeoffs connect in worked cases? |
| Alan Cooper, Robert Reimann, David Cronin, Christopher Noessel, *About Face*, 4th edition (2014). [Publisher announcement](https://newsroom.wiley.com/press-releases/press-release-details/2014/About-Face-The-Essentials-of-Interaction-Design-4th-Edition/default.aspx) | Goal-directed interaction design; deeper treatment than a heuristic checklist | How should user goals and usage patterns inform product organization and interaction behavior? |
| Louis Rosenfeld, Peter Morville, Jorge Arango, *Information Architecture: For the Web and Beyond*, 4th edition (2015). [Publisher contents](https://www.oreilly.com/library/view/information-architecture-4th/9781491913529/) | Organization, labels, finding, understanding, and cross-channel coherence | How should navigation, search, metadata, and governance work together as content grows? |
| Indi Young, *Mental Models: Aligning Design Strategy with Human Behavior* (2008). [Publisher description](https://rosenverse.rosenfeldmedia.com/books/mental-models), [author's bibliography](https://indiyoung.com/books/) | A research-led route from people's thinking and behavior to product strategy | How can evidence-based models avoid becoming speculative personas or a disguised feature taxonomy? |

These are established depth candidates, not a claim that the editions are the newest available or that every recommendation transfers unchanged to current platforms. Prefer reading selected relevant chapters carefully over generating second-hand book summaries.

## Standards for deeper reference

Two further bibliographic leads were checked against ISO's public catalog on **2026-10-12**. Their full texts were not consulted or added to this collection; no clause-level advice or conformance claim is derived from them here.

- **[ISO 9241-11:2018](https://www.iso.org/standard/63500.html):** a reference for usability terminology and conceptual scope. Consult it when the project needs precise shared definitions for design and evaluation.
- **[ISO 9241-210:2019](https://www.iso.org/standard/77520.html):** a reference for planning human-centred design across a system's life cycle. Consult it when the design process itself needs formal grounding.

These are references for further reading, not full-text retrieval material. The public practice sources already summarized in the topic modules remain the usable local starting point.

## How the seed sources were treated

Nielsen and Norman remain central, with direct source links and bounded claims. Microsoft HAX and Google PAIR are retained in the AI module, where their scope is explicit. The books remain leads until their contents can be consulted.

The seed's general search links, Reddit recommendations, video citations, Medium overview, social-media post, and numbered Substack framework were not promoted to foundational authority. This is a provenance decision, not a finding that every item is poor. Several seed citations point to a different resource from the claim they accompany. They need a separate source-by-source review before reuse. The original transcript remains available under [seed/](seed/README.md).

## Collection backlog

Priority here means likely value for the user's SDD analysis and synthesis tasks, not a universal ordering of design disciplines.

| Priority | Missing depth | Next content to collect | Evidence that the addition is useful |
| --- | --- | --- | --- |
| First | Richer IA and content models | Search/browse strategies, facets, labels, metadata, ownership, taxonomy change; licensed reading from the IA book | A case that compares alternative structures as content and roles grow |
| First | Product composition in complex work | Expert workflows, bulk actions, exceptions, multi-role collaboration, shared state and permissions | A case where a plausible feature-to-screen mapping fails a real task |
| First | Goal-directed synthesis | Deeper original research/method sources and selected *About Face* material | Trace a functional brief through alternatives to a provisional structure and discriminating test |
| Next | Content design and lifecycle | Terminology research, help, notifications, editorial ownership, stale content | Examples of misunderstanding and recovery beyond button microcopy |
| Next | Service design and adoption | Cross-channel handoffs, operational failure, longitudinal use, onboarding and offboarding | A blueprint case that distinguishes user experience from delivery responsibilities |
| Next | Perception, aesthetics, and data presentation | Direct manipulation, visual comparison, data visualization, motion, emotional response | Comparative cases with evidence beyond preference or trend |
| Next | Research coverage and ethics | Participatory design, cross-cultural and multilingual use, recruitment power and consent, lived disability experience | Explicitly different conclusions for different populations or circumstances |
| Next | Product strategy and viability | Demand, adoption, pricing/value research, operational cost, ecosystem effects | Examples separating usefulness, willingness to adopt, usability, and sustainable delivery |
| Later | Domain-specific constraints | Relevant sector standards and specialist practice, selected for actual projects | Applicability established before adding obligations to general guidance |
| Later | LLM usefulness evaluation | A small set of analysis/synthesis tasks with human-reviewed reference judgments | Better grounding, clearer alternatives, fewer false laws, and more accurate SDD distinctions |

For an LLM evaluation, compare outputs using the same brief and evidence, both with and without relevant reference material. Review representational fidelity, justification, uncertainty, and task coverage separately. Passing a syntax check or citing more sources is insufficient evidence of improvement. This is a proposed evaluation direction, not a completed study.

## Collection policy

For each addition, record the source's author/organization, title, direct URL, publication/version where available, date checked, source role, access status, and relevant section. Write a short original synthesis that states the decision it informs, an example, a limitation or counterexample, and a way to test it. Keep its source close to its claim.

Do not bulk-import whole copyrighted books or articles, copy snippets from search results as established findings, or describe an inaccessible source as reviewed. Record an abstract-only or partial review explicitly. Remove or qualify unsupported precision, universal thresholds, and claims that a pattern is optimal independent of context.

Keep a stable ID when an entry is refined; document a substantive change in meaning. Recheck time-sensitive standards and platform patterns when they affect a real implementation. Recheck local bundle links and meanings when SDD's selected version changes. Packaging this collection as a prompt or skill should preserve source and limit information rather than stripping it down to commands.
