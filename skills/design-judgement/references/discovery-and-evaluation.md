# Product discovery and evaluation

This module helps an LLM decide **which problem a product should solve, what evidence supports a structural choice, and how that choice could be evaluated**. It applies both to analysing existing products and proposing structure from a functional brief. Use it to clarify the design decision, not to encode a document.

The `PD-*` identifiers are local reference anchors, not published standards. Source-backed principles are distinguished from this knowledge base's application guidance and invented examples. These are conditional decision aids: they cannot turn a plausible design into a validated one.

## PD-01 — Establish the need behind a requested feature

Describe who needs to accomplish what, in which circumstances, and why it matters. A request for a dashboard, chatbot, export, or notification is a candidate solution. GOV.UK's guidance distinguishes evidence-backed needs from implementation choices and recommends refining needs through continuing research. [Learning about users and their needs](https://www.gov.uk/service-manual/user-research/start-by-learning-user-needs).

**Application example:** A brief says “add a weekly CSV export.” Possible underlying needs include reconciling invoices, satisfying an audit, or transferring work into another tool. These imply different ownership, timing, information, and retention requirements. Preserve the export requirement if it is fixed, while identifying the uncertainty about its purpose.

**Counterexample:** Replacing the export with an attractive analytics page because “users want insights” invents both the need and the authority to change scope.

**Verify:** Trace significant features to evidence about a need or to an explicit stakeholder requirement. A stakeholder requirement is a legitimate constraint, but does not itself prove user benefit.

## PD-02 — Keep observation, explanation, and proposal separate

Contextual inquiry combines observation with questions in the setting where activity occurs. It can expose circumstances missed by recall alone, but interpretation still matters and the method does not establish product effectiveness. [Contextual inquiry](https://www.gov.uk/guidance/contextual-inquiry).

For product analysis, record the status of consequential claims in accompanying notes:

| Claim status | Example | Permitted conclusion |
|---|---|---|
| Observed | An administrator opens “Team” and sees invitations | This surface exists for this account and state |
| Reported | A participant says approvals often stall | A reported problem worth investigating |
| Inferred | The menu may be organised around administrator tasks | A tentative explanation |
| Proposed | Add an invitation status view | A design hypothesis |
| Unknown | Invitation expiry was not tested | No conclusion about expiry behavior |

This is a working convention, not a required document schema. Attach account role, environment, date, task, and evidence location where material. A screen recording establishes visible behavior; it cannot establish why all users behave that way. An unavailable state must remain unknown rather than becoming an invented screen or a claim of absence.

## PD-03 — Scope the whole user problem, then choose a deliverable increment

Service boundaries should follow what users need to accomplish across organisations and channels. Whole-problem thinking does not require a giant product or simultaneous delivery of every improvement. GOV.UK explicitly combines end-to-end scope with incremental change. [Solve a whole problem for users](https://www.gov.uk/service-manual/service-standard/point-2-solve-a-whole-problem).

**Application example:** A repair-booking product may need to address eligibility, appointment selection, access instructions, technician arrival, unsuccessful visits, and follow-up. The first release could improve appointment changes while relying on an existing telephone process for unusual access needs.

For analysis, record verified handoffs and unresolved dependencies. For synthesis, specify who owns the next step, what information crosses the boundary, and how the user recognises completion or failure. A polished booking confirmation is insufficient if nobody knows who resolves a missed appointment.

**Counterexample:** Adding every operational dependency as a page in an IA diagram confuses service delivery with navigation. Keep the wider service context available without claiming that every backstage activity is a user-facing place.

## PD-04 — Make prioritisation a visible judgment

Roadmaps should connect iterations to user value, draw on research and performance evidence, and expose priorities while allowing revision. They represent intended progress rather than an immutable feature promise. [Developing a roadmap](https://www.gov.uk/service-manual/agile-delivery/developing-a-roadmap).

For each material choice, compare affected users, severity, frequency, strategic relevance, uncertainty, dependencies, delivery effort, and ongoing operational cost. This comparison is this knowledge base's synthesis, not a universal scoring formula. Keep firm constraints distinguishable from preferences.

**Example:** Fixing a rare failure that prevents a user retrieving essential records may outrank improving a frequently used decorative chart. Conversely, a costly redesign of an awkward annual administrative step may lose priority to a modest improvement affecting daily work.

**Verify:** Name the alternative deferred, the value sacrificed, and the evidence that would change the decision. If a ranking depends on guessed reach or effort, show those estimates as assumptions. Numerical scoring can organise discussion; decimal precision does not make uncertain inputs accurate.

## PD-05 — Test the assumption that could invalidate the decision

Teresa Torres recommends exposing assumptions about desirability, viability, feasibility, usability, and potential harm; the categories help find risks rather than settle terminology. Prioritise assumptions important to success for which evidence is weak. Small assumption tests inform discovery but are not automatically controlled experiments. [Assumption Testing](https://www.producttalk.org/assumption-testing/).

**Application example:** “Add collaborative review” hides several claims: reviewers will participate, permission boundaries are workable, contributors can recognise unresolved issues, and the organisation can support the workflow. A clickable prototype might test issue recognition. It cannot prove reviewer participation over several weeks or verify the permission implementation.

Write the uncertain claim, available evidence, test activity, result that would challenge it, and decision affected. Choose an activity proportionate to the consequence of being wrong. Do not convert one encouraging test into “the feature is validated.” Some uncertainties require a pilot, operational investigation, or engineering work rather than another interface mockup.

## PD-06 — Choose research from the question

Define research questions before selecting activities; choose methods that can provide relevant evidence at reasonable cost, and revise the plan as understanding changes. [Plan user research for your service](https://www.gov.uk/service-manual/user-research/plan-user-research-for-your-service).

The following is a practical synthesis of method boundaries:

| Question | Useful activity | Important limit |
|---|---|---|
| What happens around the task? | Contextual observation and interviews | A few settings do not establish population prevalence |
| Can people understand and operate this design? | Task-based usability sessions | Completion does not prove demand |
| How often does a recorded event occur? | Inspect trustworthy usage data | Logs omit uninstrumented and offline activity |
| Why might people abandon this step? | Combine behavioral traces with targeted research | A funnel alone does not explain intention |
| Does a change cause a measured improvement? | Appropriately designed controlled experiment | Conclusions depend on assignment, measurement, and exposure |

An LLM-generated persona or simulated interview can help enumerate questions. It is not collected evidence about real people. Where user access is unavailable, describe the review as an expert assessment or hypothesis and retain the unanswered questions.

## PD-07 — Evaluate tasks without teaching the answer

Moderated usability testing observes likely users attempting relevant tasks. Task instructions should establish a realistic goal without revealing the intended route; observation and follow-up questions help locate misunderstandings. [Using moderated usability testing](https://www.gov.uk/service-manual/user-research/using-moderated-usability-testing).

**Example:** “You will be away next Thursday; arrange a different appointment” can test whether a change path is discoverable. “Click Manage, select Reschedule, then choose Friday” tests following instructions.

Record completion, mistaken interpretation, failed recovery, and moderator assistance. Assistance may enable learning about later steps, but assisted completion must remain distinguishable from independent completion. Include consequential alternative states: no suitable slot, incomplete information, interrupted work, or a permission restriction.

**Limit:** Prototype findings apply to the behavior actually represented. A prototype with instant success cannot establish that waiting, retries, saved drafts, or real data volumes are usable.

## PD-08 — Treat participant coverage as part of the finding

Recruit actual or likely users, including relevant access needs, skill levels, circumstances, and ways of reaching the service. Recruitment should be driven by research questions. GOV.UK gives small-round examples, but participant numbers depend on the research method. [Finding participants for user research](https://www.gov.uk/service-manual/user-research/find-user-research-participants).

**Application example:** A team invitation test involving only product employees cannot establish that occasional external collaborators understand the product's membership model. Testing only people who completed onboarding also misses those excluded before entry.

State which groups and situations were represented and absent. Do not generalise “three participants failed” into a population failure percentage. Equally, do not discard a severe issue because it appeared once: one observation can establish that a failure is possible, even when it cannot establish its frequency.

A finding should carry its task, participant context, and evidence, allowing later research to extend or challenge its scope.

## PD-09 — Derive measures from intended outcomes

Google's HEART work connects user-centered goals with measurement; its Goals–Signals–Metrics process moves from the desired result to indications of that result and then operational measures. It provides a planning approach, not a universal success score. [Rodden, Hutchinson, and Fu, CHI 2010](https://research.google/pubs/measuring-the-user-experience-on-a-large-scale-user-centered-metrics-for-web-applications/).

**Application example:** For “people can change appointments without losing their booking,” candidate signals include correct replacement bookings, understandable confirmation, and absence of accidental cancellation. Measures could include verified change completion and mistaken-cancellation reports over a specified period. Opening the scheduling page is only an intermediate event.

Define the eligible population, denominator, time window, and success condition before interpreting a number. Separate user outcomes from outputs such as “launched rescheduling.” Pair behavioral measures with research where interpretation remains uncertain. Less time in a task may indicate efficiency, while less time in an exploratory creative tool may mean something different; direction must follow the goal.

## PD-10 — Challenge favorable metrics before declaring success

Microsoft's experimentation research documents how instrumentation, changing denominators, and misread metric movements can produce incorrect decisions. It distinguishes overall evaluation, guardrail, diagnostic, and data-quality measures. Statistical significance alone cannot determine whether a change benefits users. [A Dirty Dozen, KDD 2017](https://www.microsoft.com/en-us/research/wp-content/uploads/2020/08/2017-08-KDDMetricInterpretationPitfalls.pdf).

**Application example:** A redesigned help page increases contact-button clicks. This could mean help became easier to reach, guidance became less clear, or the event started firing twice. Investigate the mechanism before choosing a story.

For a proposed change, record a desired effect and plausible adverse effects. A shorter cancellation flow may improve completion while producing more accidental cancellations; a guardrail should address that possibility. Compare segments relevant to the decision so an aggregate gain does not conceal a particular group's failure. Treat before/after comparisons as suggestive when other conditions changed. A valid causal effect on a metric still requires judgment about the metric's relevance.

## Applying the module to a structural brief

For a request to add “projects, comments, approvals, and reporting,” begin with the work: who prepares an item, who can decide, what makes a decision binding, and what happens after rejection? Keep unknown answers explicit. Compare plausible compositions, such as review within an item's workspace versus a cross-project review queue. The latter may help frequent approvers but introduce context-reconstruction costs.

Document the proposed structure alongside its decision rationale and unresolved assumptions. Evaluate representative tasks that discriminate between the alternatives. When analysing an existing product, preserve the observed structure first; attach an improvement proposal separately. Neither a neat diagram nor successful formal validation demonstrates that users can accomplish their goals.

## Annotated source notes

All sources checked **2026-10-11**. Links above are the consulted references; the notes below qualify their authority and access.

| Source | Type and use | Limits and access |
|---|---|---|
| GOV.UK: Learning about users and their needs | Official practice guidance; problem/solution distinction | Public full text; government service context |
| GOV.UK: Contextual inquiry | Official method guidance; situated behavior and interpretation | Public full text; digital-health framing, not an effectiveness study |
| GOV.UK: Solve a whole problem | Service standard; scope and cross-organisation continuity | Public full text; mandatory scope applies to relevant government services, not all products |
| GOV.UK: Developing a roadmap | Official product practice; priorities and adaptable intent | Public full text; cadence examples are contextual |
| Torres: Assumption Testing | Original practitioner method; identifying and reducing decision risk | Public full text; commercial training context, not universal empirical validation |
| GOV.UK: Plan user research | Official practice guidance; question-driven research planning | Public full text; not a complete methods textbook |
| GOV.UK: Moderated usability testing | Official method guidance; tasks and observation | Public full text; does not establish product demand or population rates |
| GOV.UK: Finding participants | Official practice guidance; recruitment and inclusion | Public full text; illustrative sample sizes are not universal adequacy thresholds |
| Rodden et al.: HEART | Original CHI 2010 paper; goals and user-centered metrics | Official abstract and indexed original-paper excerpts checked; direct PDF retrieval failed; no full-paper review claimed |
| Dmitriev et al.: A Dirty Dozen | Original KDD 2017 industry research; interpretation failures | Public full PDF; large-scale online experiments, not every research setting |

## Gaps requiring further collection

This module is strongest on digital-service discovery and evaluation. It needs deeper sources on longitudinal adoption, participatory design and power, cross-cultural research, multi-sided products, pricing and business-model research, and quantitative study design. Sector-specific safety or regulatory requirements need separate authoritative material. Commercial-product examples and counterexamples here are illustrative synthesis, not research results.
