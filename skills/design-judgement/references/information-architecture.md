# Information architecture and product structure

Design concepts and conditional methods · IDs: `IA-*` · [Provenance](provenance.md)

Use this reference to analyse how people understand, find, and move through work, or to propose an organization from a brief. The distinctions below are conceptual design guidance, not SDD types, relationship rules, or view definitions.

## IA-01 — Separate organization from its visible controls

Information architecture includes underlying grouping, naming, and relationships. Navigation exposes routes into that organization. A sidebar is evidence of one navigation surface, not the complete IA. Search, deep links, contextual links, and other channels may expose different paths to the same content. [NN/g: IA versus navigation](https://www.nngroup.com/articles/ia-vs-navigation/)

Establish the question: “Where can a reviewer find returned expenses?” needs different evidence from “What happens after submitting an expense?” Identify roles, tasks, platform, and inspected conditions. Preserve evidence as described in [evidence and decisions](evidence-and-decisions.md).

## IA-02 — Keep conceptual units distinguishable

| Concept | Question to investigate | Example |
| --- | --- | --- |
| Grouping | What useful category organizes things? Is it also an actual destination? | Finance groups several work areas |
| Navigable location | Does arrival establish a meaningful purpose and context? | A review queue or an expense detail |
| Mode or presentation state | Is this the same context with a different activity or condition? | Editing, loading, empty results |
| UI building block | Is this an assembled control or presentation unit? | A receipt viewer or filter control |
| Domain object | What thing persists independently of its representations? | The expense appearing in a queue and detail |
| Behavioral state | What condition changes what actions or results are possible? | Submitted or returned for correction |
| Trigger | What occurrence starts or announces a change? | A person submits; a background check finishes |

These are diagnostic distinctions, not an algorithm for classifying every surface. A URL can encode a filter; an application location can lack a separate URL. One domain object can appear in many representations without becoming many different objects.

An overlay may be a local mode or a substantial independent task. Investigate purpose, scope, entry, history, return, and whether people need independent access. Separately examine keyboard entry, dismissal, and focus restoration; appearance does not establish behavior. [W3C APG: modal dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)

## IA-03 — Separate grouping, movement, and behavior

A hierarchy does not prove a clickable path. A forward path does not prove a return path. A transition in work status does not necessarily change the current location. Inspect or propose each relationship according to the task it supports.

For analysis, preserve observed awkward routes rather than silently simplifying them. Check browser Back, in-product Back, cancellation, deep-link entry, and re-entry independently when they matter. Record unvisited branches as unknown; one successful route does not establish role access or recovery behavior.

For synthesis, ask what must survive movement: selected item, filters, draft data, comparison evidence, permissions, or progress. A new page can improve room and independent access while increasing the cost of reconstructing context. A mode can retain context while making history or re-entry less clear.

## IA-04 — Translate functions into candidate structures

A feature list does not determine a menu. Identify users, desired outcomes, recurring objects, tasks, prerequisites, and constraints. Preserve fixed requirements while separating them from unverified needs. [GOV.UK: learning about user needs](https://www.gov.uk/service-manual/user-research/start-by-learning-user-needs)

Compare plausible organizing principles:

| Candidate | Useful when | Cost to examine |
| --- | --- | --- |
| Objects and their workspaces | People repeatedly work on stable entities | Cross-object work may become fragmented |
| Tasks or queues | People need to find the next thing requiring action | Context may need rebuilding for each item |
| Process stages | Work has meaningful sequence or dependencies | Exceptions and return visits may not fit the sequence |
| Role-specific entry | Responsibilities and access differ | Duplicated navigation can obscure shared ownership |

This comparison is original application guidance, not a published taxonomy or universal selection rule. A task entry can lead into an object workspace. Role-specific entry can reuse shared content. Shared actions do not automatically need separate destinations. An organization chart or database schema needs a user rationale before becoming navigation.

Trace representative tasks through candidate structures, including handoffs and recovery. Compare findability, repeated work, comparison needs, context switching, permission boundaries, and future content growth. Record a provisional choice and the evidence that would reverse it.

## IA-05 — Make labels and routes carry useful cues

Assess a label against the user's goal, surrounding context, and vocabulary. “Manage” may be less informative than “Review expenses,” but specialist terminology may be appropriate for an expert audience. Check that the destination delivers what its entry label suggests. [NN/g: information scent](https://www.nngroup.com/articles/information-scent/)

Preserve object identity and task context across access routes. Multiple entrances need not duplicate the underlying content or ownership. Provide identifying context and previously selected values where the task needs recognition. [NN/g: recognition and recall](https://www.nngroup.com/articles/recognition-and-recall/)

Secondary disclosure is useful when it clears irrelevant choices from a common task. It is costly when it hides comparison evidence or information needed before commitment. Feature count alone does not establish a screen, tab, or menu quota. See [interaction](interaction.md#ux-04--disclose-according-to-relevance-and-dependency).

## IA-06 — Test finding and understanding separately

**Card sorting** explores how participants group and name representative content. Investigate confusing items and disagreements. The largest cluster is not automatically a navigation category; the activity lacks much of the real task and interaction context. [NN/g: card sorting](https://www.nngroup.com/articles/card-sorting-definition/)

**Tree testing** examines finding tasks in a hierarchy without the full UI. Avoid giving the category name away in the task. Record success, wrong turns, and explanations; combine it with task-based evaluation of actual navigation and interactions. Small qualitative studies can expose problems without establishing precise population rates. [NN/g: tree testing](https://www.nngroup.com/articles/tree-testing/)

An IA diagram can clarify relationships while omitting important work. State the tasks, roles, and paths it covers. Machine validation cannot establish that labels are understood or the current product was captured faithfully.

## IA-07 — Worked comparison: expense submission and review

**Hypothetical brief:** employees create expenses with receipts; reviewers approve or return them. Suppose a recording shows an employee opening an expense, editing it in an overlay, submitting it, and seeing “Pending review.” Those observations support that path under the recording's conditions. Persistence, reviewer behavior, and failure recovery remain unknown.

One proposal has separate Create, Upload, Submit, Track, and Edit destinations. Another centers on an expense collection and detail, with contextual actions and modes. Prefer the latter provisionally if repeated work on the same expense is central: people can correct and inspect it with less reconstruction. A reviewer queue remains a useful candidate because finding work needing attention differs from finding one's own expense.

That choice has costs. A detail-centered design can slow cross-expense comparison; an overlay can hide a receipt or complicate narrow-screen use. Test employees finding a returned expense and understanding the required correction, and reviewers finding the next item and comparing discrepant amounts. Include cancellation, failure, and return. If cross-expense work dominates, reconsider the detail-centered choice.

An outcome candidate is reduced uncertainty about reimbursement progress. More clicks on the expense list would not by itself demonstrate that outcome. The example is design reasoning, not evidence about a real product.

## Source notes and boundaries

The original curated collection reported all seven linked sources readable as public HTML on **2026-10-11**. These access notes are inherited; this adaptation does not claim a new review of every underlying source.

- NN/g's IA/navigation, scent, and recognition articles are originator-published practitioner explanations. They support distinctions and candidate mechanisms, not a mandatory structure.
- NN/g's card-sorting and tree-testing articles are method guidance. Findings need interpretation and do not establish complete usability.
- GOV.UK's user-needs guidance is official service practice; transfer its rationale with attention to context.
- W3C APG is informative interaction guidance. It neither classifies product locations nor certifies accessibility conformance.

This reference is not a full treatment of search relevance, taxonomy governance, content lifecycle, collaboration, or service operations. For cross-actor journeys and handoffs, see [supplementary sources](supplementary-sources.md). Avoid filling those gaps with invented rules.
