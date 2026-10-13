# Information architecture, evidence, and SDD

This module supports two different activities: describing an existing product faithfully, and proposing a structure for a new one. Its decision methods are an original synthesis of the references below. They are design guidance, not additions to SDD syntax or semantics. Source access and the local v0.2 bundle were checked on **2026-10-11**.

## IA-01 — Establish the authority and the question

The normative SDD contract is the [v0.2 vocabulary](../../../../bundle/v0.2/core/vocab.yaml), [relationship contracts](../../../../bundle/v0.2/core/contracts.yaml), and [view configuration](../../../../bundle/v0.2/core/views.yaml). The architectural guardrails are in [AGENTS.md](../../../../AGENTS.md): bundle governs machine behavior; projection separates semantics from rendering. The [step differentiation explanation](../../../../definitions/v0.2/step_differentiation.md) explains those contracts. Screenshots or prototypes are evidence and visual exemplars, never specification authority.

Before modeling, preserve these invariants:

- Existing-product claims retain their evidence and uncertainty.
- A grouping, a navigable location, an interaction mode, and a domain object remain distinguishable.
- Containment does not establish navigation; an authored forward link does not establish its reverse.
- A view selects an aspect of the model; it cannot prove complete product coverage.
- Design heuristics support a decision; they do not determine a unique screen geometry.

State the question first: “Where can a reviewer find returned expenses?” calls for different evidence than “What changes after submitting an expense?” Define audience, role, platform, task, and product version before choosing diagram scope.

## IA-02 — Ground existing-product analysis in an evidence ledger

Replace the seed's *literal surface principle* with **traceable claims about user experience and product behavior**. IA includes organization and naming that need not themselves be visible components. A screenshot also misses focus behavior, accessible names, hidden states, and paths requiring another role. NN/g distinguishes underlying organization from the navigation controls that expose it. [IA versus navigation](https://www.nngroup.com/articles/ia-vs-navigation/)

Keep a companion ledger with claim, status, source locator, observation conditions, and unresolved question. These are documentation fields proposed by this knowledge base, **not new SDD properties**.

| Status | Meaning | Example |
| --- | --- | --- |
| Observed | Directly supported by identified evidence under stated conditions | Recording at 02:14 shows “Return to employee” opening a comment dialog. |
| Reported | A person's account, not independently observed behavior | A reviewer says comments sometimes disappear after submission; reproduction is pending. |
| Inferred | Interpretation of evidence, with reasoning and an alternative | The dialog appears to be a mode of the expense detail location; independent navigation has not been tested. |
| Proposed | Intended future behavior or structure | Add a “Returned” filter to the employee expense list. |
| Unknown | Evidence is missing or contradictory | Whether a returned expense retains attachments after editing. |

Capture a URL or screen identifier, recording timestamp or screenshot reference, date/build, role and permissions, viewport, input method, and relevant data state. Record exact interface labels separately from your interpretation. For an inferred claim, record what observation could disprove it. A displayed success message is evidence of a message, not proof that every downstream transaction completed.

Inspect meaningful paths and variants: entry, success, validation failure, empty results, permission restrictions, interruption, and return. Record unvisited branches. Never upgrade “not seen in this session” to “does not exist.” Keep redesign proposals separate from the current-state description so later retrieval cannot mistake intention for observation.

## IA-03 — Choose the right conceptual unit

Use these distinctions from `vocab.yaml`'s `node_types`; the diagnostic questions are design advice.

| SDD type | Bundle meaning | Diagnostic question |
| --- | --- | --- |
| `Area` | Information architecture grouping | What useful category groups locations, without claiming the category is itself a destination? |
| `Place` | Navigable product location | Does the user arrive at a meaningful location with a recognizable purpose and context? |
| `ViewState` | Distinct render or interaction mode within a place | Is this the same location in an editing, loading, empty, or other meaningful mode? |
| `Component` | UI building block | Is this an assembled control or presentation unit within that location or mode? |
| `State` | State machine state | Are we describing a behavioral state rather than a location? |
| `Event` | Named user or system trigger | What occurrence initiates or announces behavior? |
| `DataEntity` | Domain object | Is this the thing managed, such as an expense, rather than its screen? |

A domain object may appear in a list, detail view, picker, and report. Do not make four domain objects merely because there are four representations, or make every domain object a place. A URL is useful evidence but not a complete classification rule: routes can encode filters, while a meaningful application location may lack a distinct URL.

Neither “every modal is a new place” nor “modals are always states” follows from SDD. Consider purpose, scope, history, independent access, and what remains the user's current context. Record uncertain classification. Separately inspect dialog interaction: W3C APG describes initial focus, contained tab navigation, dismissal, and focus restoration. A screenshot cannot establish these behaviors. [Modal-dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)

## IA-04 — Separate structure, movement, and behavior

The precise source is `contracts.yaml` → `relationships` → each `type` → `meaning`, `allowed_endpoints`, and `constraints`.

- `CONTAINS` expresses hierarchy or grouping. Relevant permitted pairs include `Area → Place`, `Place → Place`, and `Place → ViewState`. It does not say a user can click from parent to child.
- `NAVIGATES_TO` permits `Place → Place`; its optional `event` and `guard` describe trigger and precondition. Trace an observed path before asserting current behavior.
- `COMPOSED_OF` permits `Place → Component` and `ViewState → Component`; component nesting uses permitted `CONTAINS` relationships.
- `TRANSITIONS_TO` permits `ViewState → ViewState` or `State → State`, with supported event, guard, and effect annotations.
- `BINDS_TO` connects a `Component` to a `DataEntity` and requires a `field` property. Do not invent bindings from similar wording alone.

The `common_rules.no_implicit_inverse_edges` contract prohibits materializing inverse, transitive, or inherited edges. A back path therefore needs its own evidence and representation. Check cancellation, browser Back, in-product Back, and deep-link entry separately; their outcomes need not match.

## IA-05 — Select views by the decision they support

The following are the primary type selections in `views.yaml` → `views[id]` → `projection.include_node_types`; other declared references and rendering policies can add supporting context.

| View | Primary selection | Useful question |
| --- | --- | --- |
| `outcome_opportunity_map` | `Outcome`, `Metric`, `Opportunity`, `Initiative` | What change matters, what problem supports it, and how will it be evaluated? |
| `journey_map` | `Stage`, `JourneyStep` | What meaningful episodes make up the experience? |
| `service_blueprint` | `BlueprintStep`, `Process`, `SystemAction`, `DataEntity`, `Policy` | What delivery work and dependencies support the user's experience? |
| `scenario_flow` | `ScenarioStep`, `Place`, `ViewState` | What specific action or decision leads to what next behavior? |
| `ia_place_map` | `Area`, `Place` | How are product locations grouped and connected? |
| `ui_contracts` | `Place`, `ViewState`, `Component`, `State`, `Event`, `DataEntity`, `SystemAction` | What composition and behavior contracts explain the interaction? |

UI Contracts is not a generic data-mutation diagram. Its `projection.include_edge_types` selects `COMPOSED_OF`, `CONTAINS`, `TRANSITIONS_TO`, `EMITS`, `BINDS_TO`, and `DEPENDS_ON`. Its `conventions.normative_defaults` entry `ui_contract_scope` describes place/state containers for component and transition contracts. `READS` and `WRITES` exist in the global relationship contract but are not in this view's primary edge selection.

Named diagrams select explicitly included nodes and edge occurrences, also including the selected edges' endpoints, with no inferred ancestor or path closure: see `contracts.yaml.diagram_membership.selection` and the [named-diagram explanation](../../../../definitions/v0.2/diagram_separation.md). A clean diagram may simply omit important evidence. State its coverage.

## IA-06 — Translate functions into candidate structures

A feature list is input to design, not a menu specification. Begin with who needs an outcome, in what circumstances, and what stops them. GOV.UK recommends articulating evidence-backed needs independently of a predetermined solution. “Know whether my expense was accepted” leaves more options open than “receive an email.” [Learning about user needs](https://www.gov.uk/service-manual/user-research/start-by-learning-user-needs)

Use this synthesis sequence:

1. Identify users, desired outcomes, recurring objects, tasks, prerequisites, and constraints. Label assumptions.
2. Trace representative tasks end to end, including handoffs and recovery. Establish which information must remain available during decisions.
3. Compare plausible organizing principles: objects for repeated work on stable entities; tasks for goal-driven entry; stages for a genuinely sequential process; roles when responsibilities and access differ.
4. Propose locations, modes, and contextual actions. Shared actions do not automatically need separate destinations.
5. Evaluate alternatives against task frequency, consequence of error, findability, context switching, permission boundaries, and future content growth.
6. Record a provisional choice, rejected alternative, unresolved risk, and test that could reverse the choice.

These are comparison criteria, not universal algorithms. A task-based entry can lead into an object-based workspace. Role-specific entry can reuse the same underlying place. Avoid mirroring an organization chart or database schema without user evidence.

## IA-07 — Design labels and routes for recognition

Information scent depends on a user's goal, a link's wording and surrounding context, and prior knowledge. Assess a label in its actual task context; “Manage” may communicate less than “Review expenses,” but terminology must fit the audience. Check that the destination delivers what its entry label suggests. [Information scent](https://www.nngroup.com/articles/information-scent/)

Recognition reduces the need to retrieve details unaided. In design terms, provide identifying context for objects, current location, available actions, and previously selected values where needed. Search suggestions, recent items, and contextual controls are possible mechanisms, not obligations in every product. [Recognition and recall](https://www.nngroup.com/articles/recognition-and-recall/)

Preserve object identity and task context across routes. Multiple useful access paths need not duplicate content ownership. Progressive disclosure is a candidate when secondary detail obstructs a common task; it is costly when it hides information needed for comparison or safe decisions. The number of features alone does not establish how many screens, tabs, or menu items to create.

## IA-08 — Validate the uncertainty with the appropriate method

**Card sorting** explores how participants group and name representative content. Use it when candidate categories are uncertain. Investigate disagreement and confusing items; do not turn the largest cluster into a mandatory navigation category. Sorting lacks the full task and interface context, and does not supply a complete interaction architecture. [Card sorting](https://www.nngroup.com/articles/card-sorting-definition/)

**Tree testing** evaluates whether participants can find resources in a proposed hierarchy using task scenarios. Compare labels or locations without building the full UI. Record success, wrong turns, and explanations; avoid putting the target category's label into the task wording. A tree excludes much of the real interface, so combine it with task-based testing of the actual navigation and interactions. Small qualitative studies reveal problems, not precise population success rates. [Tree testing](https://www.nngroup.com/articles/tree-testing/)

For SDD review, ask whether each claim is supported, node type is appropriate, relationship means what the author intends, and view scope answers its stated question. Tool validation checks the machine contract. It cannot establish that users understand labels, that an observed product was captured completely, or that a proposed structure solves the right problem.

## IA-09 — Worked example: expense submission and review

**Hypothetical brief:** employees create expenses and submit receipts; reviewers approve or return them. The following is a design exercise, not a report about a real product and not executable SDD.

Suppose a supplied recording shows an employee opening “Expenses,” choosing one expense, editing it in an overlay, submitting it, and seeing “Pending review.” Record each observation with timestamps. Classify persistence, reviewer behavior, and retry after failure as unknown until supported; do not infer them from the successful path.

One candidate has separate “Create,” “Upload,” “Submit,” “Track,” and “Edit” destinations. Another centers on an Expenses collection and Expense detail, with contextual actions and modes. Provisionally choose the latter when evidence shows people repeatedly work on the same expense: it preserves context while they correct or inspect it. Keep a reviewer queue candidate because finding work needing attention differs from finding one's own expense. Test whether this role distinction needs another place or a mode of a shared collection.

The expense itself is a `DataEntity`; its detail location is a `Place`. Editing can be a `ViewState` if it remains within that place. “Submit expense” can be represented through a component and event; field bindings require actual knowledge of their targets. Grouping the collection and detail does not establish navigation between them. Add only justified navigation and transition relationships.

An outcome candidate is reduced uncertainty about reimbursement progress, not increased button clicks. Test employee tasks such as locating a returned expense and understanding the required correction; test reviewer tasks such as finding the next item and returning it with a useful reason. Observe whether participants retain context after cancellation and failure. If reviewers need cross-expense comparison, reconsider the detail-centric choice. The decision remains conditional on evidence.

## IA-10 — Scope and source notes

This module does not cover full content strategy, search relevance, localization, large-scale taxonomy governance, service operations, or detailed interaction/accessibility implementation. A place map cannot substitute for those analyses. Do not manufacture user research, numerical confidence, or coverage from a plausible model.

All seven external pages below were readable as public HTML on **2026-10-11**. These notes describe what was inspected; linked books, paid courses, and underlying studies were not independently reviewed here.

- **[Cardello, NN/g, IA versus navigation (2014)](https://www.nngroup.com/articles/ia-vs-navigation/):** practitioner explanation separating underlying organization from navigation. Useful conceptual reference, not an SDD contract or universal layout prescription.
- **[Budiu, NN/g, Information scent (2020)](https://www.nngroup.com/articles/information-scent/):** practitioner account of navigation cues and context. This module does not independently validate the underlying information-foraging research.
- **[Tankala and Sherwin, NN/g, Card sorting (2024)](https://www.nngroup.com/articles/card-sorting-definition/):** method guidance including interpretation limits. Participant groupings remain research evidence requiring design synthesis.
- **[NN/g, Tree testing](https://www.nngroup.com/articles/tree-testing/):** method guidance on hierarchy evaluation, comparison, and qualitative versus quantitative use. Not proof of overall usability.
- **[Budiu, NN/g, Recognition and recall (2024)](https://www.nngroup.com/articles/recognition-and-recall/):** cognitive explanation and interface examples. Does not prescribe a universal menu-size limit.
- **[GOV.UK Service Manual, Learning about user needs](https://www.gov.uk/service-manual/user-research/start-by-learning-user-needs):** government service practice for grounding needs in research. Applied here beyond its original organizational setting as guidance.
- **[W3C WAI, APG Modal-dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/):** authoritative implementation guidance for accessible dialog behavior. APG guidance does not determine SDD node classification or itself certify accessibility conformance.
