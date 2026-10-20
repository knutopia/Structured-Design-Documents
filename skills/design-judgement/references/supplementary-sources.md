# Supplementary sources and skill precedents

Read the relevant section when synthesising research, reasoning across service boundaries, or evaluating an analytics feature. These additions deepen selected gaps in the curated collection; they are not a survey of UX practice. All URLs were checked on **2026-10-20**. Summaries and examples below are original. This file supports offline reasoning; following links is optional unless a current requirement or detailed claim needs verification.

The source-backed observations and this skill's adaptations are identified separately. A published conceptual model informs questions and evaluation choices; it does not prove a design will work. A public skill demonstrates packaging and prompted behaviour; it is not evidence that those behaviours improve design outcomes.

## SUP-01 — Research synthesis that preserves differences

**Source:** GOV.UK User research community, [Analyse a research session](https://www.gov.uk/service-manual/user-research/analyse-a-research-session), published/updated 24 May 2016. **Role:** original practitioner guidance. **Access:** public page consulted: observation, finding, and action sections.

**Source contribution:** Separate what was seen or heard from its interpretation and from the action proposed. Review recordings when available; group observations, develop findings, and discuss what to change or research next. Collaborative analysis can expose individual interpretations.

**Skill adaptation:** Retain an evidence locator and relevant participant/task context for consequential findings. Examine whether apparent contradictions reflect different goals, roles, access needs, or conditions. Preserve a serious isolated failure even when it fits no common cluster. The source allows discarding isolated notes; this skill does not adopt isolation alone as a reason to discard evidence.

**Example:** Frequent reviewers want a compact queue; occasional reviewers need explanatory context. “Users want simplicity” erases a useful distinction. Compare a shared review structure with adjustable context against separate workflows.

**Limit and test:** This practical affinity-analysis approach is not every form of qualitative analysis. Participant counts describe the supplied sample and comparable opportunities to observe; they do not establish population prevalence. Check the finding against supporting and contradictory cases before choosing a structure.

## SUP-02 — Keep materially different journeys visible

**Source:** GOV.UK User research community, [Creating an experience map](https://www.gov.uk/service-manual/user-research/creating-an-experience-map), published 21 February 2017. **Role:** original practitioner guidance. **Access:** public page consulted: applicability and common-stage sections.

**Source contribution:** Experience mapping considers activities, thoughts, and feelings over time, including channels and interdependencies. Consolidate similar journeys; use separate maps where groups pass through substantially different stages and steps. Base maps on captured experiences and review them with people who know the service.

**Skill adaptation:** When evaluating a proposed product boundary, track the trigger, recipient, information transferred, expected acknowledgement, and recovery owner at consequential handoffs. Keep delivery responsibilities distinguishable from the user's navigation. A dependency does not automatically justify another screen.

**Example:** A customer submits a repair request; a dispatcher assigns it; a technician needs access instructions; the customer later challenges completion. A customer-only booking flow can miss the unresolved handoff. Compare shared case status with role-specific actions against disconnected portals.

**Limit and test:** Mapping is useful where time, channels, or actors create dependencies; a short single-person task may need only a task walkthrough. Invented emotions are hypotheses. Trace a real exception across roles and check whether each person knows who acts next and how failure becomes visible.

## SUP-03 — Evaluate analytics before choosing a chart

**Source:** Tamara Munzner, [A Nested Model for Visualization Design and Validation](https://www.cs.ubc.ca/labs/imager/tr/2009/NestedModel/), *IEEE Transactions on Visualization and Computer Graphics* 15(6), 921–928, 2009; [public paper](https://www.cs.ubc.ca/labs/imager/tr/2009/NestedModel/NestedModel.pdf). **Role:** original conceptual research. **Access:** author-hosted abstract and paper consulted, especially sections 2–3.

**Source contribution:** Distinguish domain problem/data, abstract operations/data types, visual encoding/interaction, and algorithm. Upstream errors propagate: clear graphics cannot repair the wrong abstraction. Evaluation should address the level of the claim. The model supports iteration, not a mandatory sequence.

**Skill adaptation:** For a dashboard or analytics proposal, first identify the decision, meaningful comparison, data unit, aggregation, and uncertainty. Then compare views and interactions that support it. Inspect whether the product needs an overview, exact lookup, comparison, investigation, or action on an exception.

**Example:** A support manager must reassign overdue cases. An average-resolution chart may hide the cases requiring action; compare an actionable age/ownership queue with a trend summary linked to cases.

**Limit and test:** This is not a universal chart selector or a reason to require visualisation. Exact lookup can suit a table. Test whether representative users find the relevant exception and make the intended decision; rendering performance answers a different question from usefulness.

## Related public skills: inspected, selectively learned from

Both entries below are authored by Anthropic in the public `anthropics/knowledge-work-plugins` repository. The complete linked `SKILL.md` sources, including their raw text, were inspected on 2026-10-20. Links target `main`, which can change; the observations describe that inspected state. No plugin was installed and no instructions were copied.

### Research synthesis

[Source skill](https://github.com/anthropics/knowledge-work-plugins/blob/main/design/skills/research-synthesis/SKILL.md) · [raw source](https://raw.githubusercontent.com/anthropics/knowledge-work-plugins/main/design/skills/research-synthesis/SKILL.md)

**Learned:** Name accepted evidence, associate themes with supporting material, connect findings to product implications, and retain research limitations. These are useful output affordances for a human designer reviewing a synthesis.

**Not adopted:** Mandatory report headings, automatically generated segment percentages, or prioritisation that assumes impact/effort estimates exist. Counts need comparable elicitation and remain sample descriptions. Quotes need exact provenance and appropriate treatment of identifying material. Analytics can challenge an interpretation without automatically validating it. Connector availability does not authorise publication or fetching unrelated material; this design-judgement skill grants neither.

### Design critique

[Source skill](https://github.com/anthropics/knowledge-work-plugins/blob/main/design/skills/design-critique/SKILL.md) · [raw source](https://raw.githubusercontent.com/anthropics/knowledge-work-plugins/main/design/skills/design-critique/SKILL.md)

**Learned:** Establish audience, purpose, design stage, and review focus. Make feedback specific, explain its consequence, offer an alternative, and recognise useful properties that a change might damage.

**Not adopted:** A fixed first-impression duration, mandatory styling critique for every task, severity colours as evidence, or accessibility pass/fail from an unmeasured screenshot. Structural evidence supports structural conclusions; visual appearance cannot establish focus behaviour, accessible names, responsive states, or completion by users. Critique remains bounded by the artifact and states actually available.

## Applying the additions together

Use these lenses only when the task calls for them. A research theme may reveal different role needs; a service walkthrough may locate the consequential handoff; an analytics comparison may reveal that the proposed metric hides the very cases those roles must resolve. Keep that reasoning in ordinary design language and identify the next observation that could change it. These additions define no SDD vocabulary, editing workflow, or conformance rule.
