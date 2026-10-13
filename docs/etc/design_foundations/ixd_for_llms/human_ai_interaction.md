# Human–AI interaction

Use this module when the **product being designed contains AI-mediated behavior**: predictions, recommendations, generated material, adaptive interfaces, or delegated actions. An LLM authoring an SDD document does not make the resulting product an AI product. General usability and accessibility references still apply.

This synthesis draws on Microsoft HAX and Google PAIR practices, not normative requirements. Examples are hypothetical.

## Correct reference map for Microsoft's guidelines

The seed knowledge base renumbered and omitted parts of Microsoft's framework. The following coverage map preserves the original identifiers and phases; descriptions are paraphrases, not the official titles. Consult Table 1 of the [2019 CHI paper](https://www.microsoft.com/en-us/research/wp-content/uploads/2019/01/Guidelines-for-Human-AI-Interaction-camera-ready.pdf) and the [HAX Design Library](https://www.microsoft.com/en-us/haxtoolkit/library/) for authoritative wording.

| Original phase | Coverage by original ID |
| --- | --- |
| Initially | G1: capabilities; G2: expected fallibility |
| During interaction | G3: timing; G4: relevance; G5: social expectations; G6: unfair stereotypes and bias |
| When wrong | G7: requesting assistance; G8: rejecting assistance; G9: repairing results; G10: ambiguity and reduced scope; G11: explanations |
| Over time | G12: recent context; G13: adaptation from behavior; G14: restrained changes; G15: specific feedback; G16: feedback consequences; G17: overall controls; G18: change notification |

Evaluation included 49 practitioners examining 20 products, supporting the guidelines' usefulness for inspection rather than universal causal claims. The paper predates today's widespread generative assistants. [Research publication](https://www.microsoft.com/en-us/research/publication/guidelines-for-human-ai-interaction/)

## AI-01 — Establish whether AI improves the task

**Decision:** Describe the user's desired outcome, current workflow, and the part AI would change. Compare automation, assistance, and a conventional implementation. Account for the effort to prepare inputs, inspect output, repair mistakes, and maintain skills. A fast generation step may still create a slower end-to-end task. [PAIR: user needs](https://pair.withgoogle.com/chapter/user-needs/)

**Example and tradeoff:** Suggesting tags for a large document collection may save effort. Requiring people to converse with an assistant to set a known date can add unnecessary uncertainty. Creative work may benefit from alternatives and editing more than an automatically selected final answer.

**Verify:** Compare successful task completion and total effort against the existing approach, including failures. Do not use acceptance rate as the sole success measure: acceptance may reflect genuine usefulness, poor review, or a missing alternative.

## AI-02 — Build an accurate working model of the feature

**Decision:** Explain the useful capability, needed input, accessible context, and important limits at the point where they affect action. Give people a low-consequence way to learn. Avoid implying that the system sees information it cannot access or that fluent output proves understanding. A one-time introduction cannot carry every later expectation. [PAIR: mental models](https://pair.withgoogle.com/chapter/mental-models/)

**Example and tradeoff:** A meeting-summary feature can identify which transcript it used and allow the user to inspect it. If attachments were excluded, make that limitation discoverable before the user relies on a purportedly comprehensive summary. Explain enough to support the decision; continuous technical detail can obscure the work.

**Verify:** Ask users to predict behavior with missing, conflicting, or changed inputs. Record mismatches between expectations and results as design findings.

## AI-03 — Support calibrated reliance rather than maximum trust

**Decision:** Help users judge whether a particular result is usable for their purpose. Provide inspectable evidence, relevant limitations, and a useful next step when uncertainty matters. Distinguish a source excerpt, a system-generated interpretation, and an explanation of process. An explanation can be persuasive without being correct. PAIR explicitly discusses the risks of misunderstood confidence displays. [PAIR: explainability and trust](https://pair.withgoogle.com/chapter/explainability-trust/)

**Example and tradeoff:** For an extracted invoice total, show the source region and allow correction. Do not invent “92% confident” because a UI mockup needs a badge. A score requires a defined measurement, empirical validation for its intended context, and evidence that people interpret it usefully. Without those, communicate concrete limitations such as missing pages or unresolved alternatives.

**Verify:** Include plausible wrong answers in evaluation. Test whether users catch errors and appropriately accept correct results; a questionnaire reporting increased trust is insufficient. Evidence displays that consume more effort than manual work may defeat the feature's purpose.

## AI-04 — Separate preparation, review, and consequential action

**Decision:** Make the boundary between proposing something and changing the world understandable. Choose the amount of user control according to consequence, reversibility, error detectability, and demonstrated reliability. Review should expose the content and scope needed to make a real decision. Avoid routine confirmations that users learn to dismiss. This is an application of PAIR's automation/control tradeoff, rather than a universal requirement to approve every AI step. [PAIR: feedback and control](https://pair.withgoogle.com/chapter/feedback-controls/)

**Example and tradeoff:** An assistant can draft replies in a batch. Before sending, a review should reveal recipients, messages, attachments, and exceptions. A reversible formatting suggestion may need only immediate undo. A background routine needs an understandable delegation scope and a way to suspend future work.

**Verify:** Ask users what has already happened, what will happen next, and how to change course. Test cancellation during partial execution. Stopping a process and reversing its completed effects are different product promises.

## AI-05 — Make correction cheaper than starting over

**Decision:** Distinguish wrong interpretation, wrong output, unsuitable timing, service failure, and missing context. Offer a recovery action that addresses the specific problem: edit a result, select an alternative, narrow the request, provide a missing input, retry, or continue manually. Repeatedly regenerating the whole answer is often an expensive substitute for correction. [PAIR: errors and graceful failure](https://pair.withgoogle.com/chapter/errors-failing/)

**Example and tradeoff:** When a summarizer assigns an action to the wrong person, allow correction of that assignment without discarding reviewed sections. If an action cannot be completed, retain useful draft work and state which effects occurred. Ask a focused clarification when alternative interpretations materially change the result; unnecessary questions can make assistance burdensome.

**Verify:** Deliberately supply ambiguous input and introduce partial failures. Measure recovery time and whether accepted work survives. Provide a path for users who cannot diagnose the model's internal failure.

## AI-06 — Give adaptation a visible scope and controls

**Decision:** Distinguish temporary conversational context, saved preferences, behavioral personalization, and feedback intended for later product improvement. Do not imply that a correction trains the model immediately. Explain which controls affect the current result and which affect future behavior. Global settings should complement local correction. [HAX G17](https://www.microsoft.com/en-us/haxtoolkit/guideline/provide-global-controls/)

**Example and tradeoff:** Rejecting one suggested document should not silently establish a permanent subject preference. A saved writing preference needs a place to inspect, change, or reset it. Personalization may reduce repeated input while making behavior harder to predict; notify people about changes that materially alter expectations. This applies HAX G12–G18 to a concrete lifecycle. [HAX Design Library](https://www.microsoft.com/en-us/haxtoolkit/library/)

**Verify:** Test return visits, preference changes, reset, shared-device use, and changes in model behavior. Compare actual data use and persistence with the interface's claims. Do not promise deletion, isolation, or learning behavior without implementation evidence.

## AI-07 — Evaluate whose failures the aggregate hides

**Decision:** Include relevant languages, abilities, contexts, and populations in evaluation. Assess the consequences of different error types, not only aggregate accuracy. A feature may perform acceptably overall while repeatedly failing a particular group. Data selection and evaluation choices shape those outcomes. [PAIR: data collection and evaluation](https://pair.withgoogle.com/chapter/data-collection/)

**Example and tradeoff:** Speech-assisted entry should accommodate correction when a name or accent is misrecognized. A manual alternative helps recovery but does not justify leaving a systematic performance gap unexamined. Better average performance can conceal worse outcomes for a smaller group.

**Verify:** Examine task outcomes and recovery burden across relevant groups with appropriate consent and data practices. When evidence is missing, record that gap; an LLM-generated persona is not a substitute for participation or measured performance.

## Annotated sources and limits

Primary sources checked **2026-10-11**; chapters were available as public HTML and the paper as a public PDF.

| Source | Practical value | Evidence/access limits |
| --- | --- | --- |
| Amershi et al., CHI 2019 paper | Original numbering, phases, development and evaluation method | Practitioner evaluation of guidelines, not universal causal evidence or current model capability evidence |
| Microsoft HAX library and G17 | Patterns, examples, and traceable original guideline IDs | Industry-maintained guidance; examples are candidates to assess, not requirements to copy |
| Google PAIR, user needs and mental models | Deciding where AI adds value and setting expectations | Practitioner synthesis; validate transfer to the actual audience and workflow |
| Google PAIR, explainability and trust | Reliance, evidence, and confidence-display tradeoffs | Does not establish that any particular score or explanation is faithful |
| Google PAIR, feedback/control and errors | Delegation, feedback consequences, and repair | Recovery depends on real product capabilities; UI promises require verification |
| Google PAIR, data collection/evaluation | Representativeness and outcome evaluation | Does not replace domain-specific evaluation or affected-community participation |

Further collection should address longitudinal reliance, collaborative review, multi-party consequences of agent actions, and empirical evaluation of generative-output explanations. For SDD work, record observable or proposed behavior and unresolved questions using supported notation; this reference introduces no AI-specific SDD fields or guarantees.
