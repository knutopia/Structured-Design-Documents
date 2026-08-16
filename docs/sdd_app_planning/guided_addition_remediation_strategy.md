# Guided Addition Remediation Strategy

Status: remediation authority for the failed Guided Addition milestone

Current status: **REMEDIATION COMPLETE — Phase 7 accepted on 2026-08-15**. The accepted [Phase 7 Acceptance Report](./guided_addition_phase_7_acceptance_report.md) records the technical and human `ACCEPT` decisions. Deployment, publication, release, and adapter work remain unauthorized.

Purpose: record why the initial implementation failed, identify what can be salvaged, and define an acceptance-gated path to a UX-brief-conformant Guided Addition API and `sdd add` client.

This strategy gated corrective architecture and implementation through the phase sequence below. Technical and human closeout are complete. Any future adapter, deployment, publication, merge, or release work requires separate authorization.

## 1. Authority And Evidence

Authority is, in order:

1. [UX Brief for a Guided Addition API](./ux_brief_guided_addition_api.md) — normative product interaction and responsibility boundaries.
2. [SDD-Add: Observed Usability Issues](./sdd-add_observed_usability_issues.md) — concrete failure evidence and clarifications of the intended interaction.
3. `AGENTS.md` — bundle authority, source-organization, acceptance, and stop-condition guardrails.
4. The loaded bundle under `bundle/v0.1/` — machine-readable language and authoring behavior.
5. [Guided Addition UX Acceptance Transcripts](./guided_addition_ux_acceptance_transcripts.md) — accepted Phase 1 UX proof.
6. This remediation strategy — recovery sequencing and acceptance gates.
7. [Guided Addition API Architecture](./guided_addition_api_architecture.md) and [Guided Addition API Implementation Plan](./guided_addition_api_implementation_plan.md) — rejected historical evidence only.

When a lower source conflicts with a higher source, the lower source must change. Existing code and green tests are implementation evidence, never authority over the UX brief.

## 2. Non-Negotiable UX Invariants

These invariants are extracted from the UX brief and the observed-issues clarification. Every remediation design, implementation checkpoint, transcript, and acceptance report must cite and test them.

### 2.1 Preserve the four known-node decision trees

With anchor node `A`, the API must preserve these distinct user intents:

1. Outgoing, relationship first: choose a valid `A → relationship → node type` combination, then choose an existing matching destination or create a new destination.
2. Outgoing, existing node first: choose an existing destination node, then choose a relationship constrained by `A` and that destination's exact types.
3. Incoming, relationship first: choose a valid `node type → relationship → A` combination, then choose an existing matching origin or create a new origin.
4. Incoming, existing node first: choose an existing origin node, then choose a relationship constrained by that origin and `A`.

The distinction is choice order and user intent, not merely whether the eventual endpoint already exists. Two routes may yield the same semantic proposal, but they must not be collapsed before the human decisions are complete.

### 2.2 Each choice constrains the next choice

- Relationship-first selection constrains existing-node choices to the selected endpoint type and direction.
- Existing-node-first selection constrains relationship choices to exact bundle-allowed triples for the anchor and selected node.
- The client must render only options returned for the current step; it must not reconstruct or locally recombine semantic choices.
- Diagram/view filtering may rank, annotate, or narrow the currently relevant options without changing the route's decision order.

### 2.3 Diagram-type filtering is part of guided browsing

At every browse point identified by the UX brief, the user may optionally choose a diagram type to narrow or prioritize the current choices. This applies to:

- standalone node-type browsing;
- initial starting-node browsing when adding a relationship without a preselected node;
- outgoing relationship-first combinations;
- outgoing existing-node-first choices;
- incoming relationship-first combinations;
- incoming existing-node-first choices.

The guided flow must let the user browse diagram types by human-readable name, select one, change it, and return to all diagram types. A caller-supplied raw `view_id` or CLI-only `--view` option is not a substitute for this interaction.

Filtering must preserve the route's choice order. It recomputes the current option set, prioritizes regular relationships, retains cross-view bridge relationships with understandable annotation unless explicitly excluded, and clears downstream selections that are no longer available.

### 2.4 Shield users from internal complexity

User-facing output must not expose:

- internal reason codes such as `fallback_append` or `same_source_target_order`;
- opaque choice, placement, effect, or proposal hashes unless explicitly requested for diagnostics;
- source-model terms such as `body`, `stream`, `endpoint strategy`, or `reparent` as ordinary instructions;
- raw display metadata such as `role: primary`, `presence: connector`, or `label: hidden` without plain-language translation;
- implementation phases such as `dry run: applied` as ordinary commit choices.

Advanced or uncommon choices remain available through contextual progressive disclosure. “Advanced” is not itself an explanation.

### 2.5 Placement is a set of contextual semantic decisions

Placement must not be presented as one generic list of technically legal source positions.

For a new target in a structural relationship:

```text
Nest <new target> in <source>?
  1. yes: place <new target> in <source>
  2. no: place <new target> at top level
```

For an existing target in a structural relationship:

```text
Nest <existing target> in <source>?
  1. yes: move <existing target> into <source>
  2. no: leave <existing target> where it is
```

Only after choosing nesting may the client ask first/last ordering within that parent, and only when at least one nested sibling already exists. Moving an existing node is always explicit and effect-specific.

For a non-structural relationship:

- no nesting question is shown;
- an existing node remains where it is;
- a new node receives a predictable, graph-consistent recommendation;
- an outgoing destination is not offered before its origin merely because that position is syntactically legal.

Edge-line source organization is not normally a user decision. Relationship lines belong with other relationship lines, after properties and before nested node blocks. A new top-level node is separated from the previous top-level node by a blank line.

### 2.6 One ordinary Save decision

The client owns Save/Cancel. Save may internally dry-run and verify the proposal before committing it, but technical verification does not create a second ordinary commit moment. A second user decision is permitted only for a concrete warning, changed effect, or other material condition that requires informed consent.

### 2.7 Guidance remains content delivery

The guided API remains pure and read-only. It returns a semantic proposal bound to document context. A separate authoring service verifies and applies that proposal through shared mutation machinery.

## 3. Failure Analysis

### 3.1 Architecture failure

The rejected architecture treated interaction routes as reducible implementation state. It normalized the four routes into:

```text
direction: outgoing | incoming
endpoint_strategy: existing_only | existing_or_new
```

This representation cannot answer the question that controls the UX: does the user want to choose a relationship first or choose an existing node first? The architecture then provided only `choose_relationship → choose_endpoint`, making the missing routes impossible for every client.

This was not a harmless internal normalization. A safe normalization may occur after the selections converge into a proposal; it must not erase distinctions that determine the next human choice.

### 3.2 Planning and acceptance failure

The implementation plan copied the incorrect architecture into exact contract requirements. Its scenario matrix classified routes only by direction and existing/new outcome. Tests proved that proposals had correct final endpoints, but never proved that the decision tree followed the brief.

The plan also lacked human-facing acceptance gates. Deterministic prompt adapters proved repeatability, not usability. Because no gate prohibited internal reason codes, required node names, distinguished nesting from edge ordering, or limited confirmation moments, a green suite coexisted with a failed product.

The plan also misclassified `--view` initialization as diagram-type filtering. The API accepts a caller-known `view_id`, but its step contract does not return diagram-type choices. The CLI can alter role/presence only after a view was supplied externally; it cannot select or clear the diagram type at any browse point. This omits a repeated, explicit part of the UX brief rather than merely choosing a simpler terminal presentation.

### 3.3 Placement failure

The design reduced different concepts to `stream + mode`:

- whether a node should be nested;
- whether an existing node should move;
- where a new node should appear among siblings;
- where an edge line should appear within a source block.

The planner then enumerated first/last/before/after alternatives. That exposed meaningless choices, made edge placement look like containment, and permitted graph-inconsistent positions.

The bundle's `edge_in_source_body: last` policy also cannot express the required source organization: after existing relationship lines but before nested child blocks. Per bundle-authority rules, this gap must be corrected in the bundle contract before runtime behavior is changed.

### 3.4 Review failure

The checkpoint reports repeatedly said “no violated invariants” because they audited technical properties while omitting the UX brief's decision-tree and language invariants. Preserving the UX and architecture documents unchanged was reported as evidence of success even though the implemented architecture contradicted the UX document.

This remediation therefore requires independent UX acceptance evidence before broad regression evidence can count toward completion.

## 4. Salvage Boundary

### 4.1 Retain unless a focused audit finds coupling

- bundle loading and cross-artifact validation;
- guidance catalog foundations unrelated to rejected placement values;
- document snapshots, revision binding, and bundle fingerprints;
- literal relationship direction and endpoint-triple validation;
- view filtering and relationship visibility metadata;
- node forms, field validation, and collision-safe ID suggestion;
- pure caller-carried workflow infrastructure;
- semantic proposal and stale-proposal protection;
- low-level source-preserving reparent operation;
- proposal executor boundary and shared mutation execution;
- repository discovery and injected prompt infrastructure.

### 4.2 Redesign before reuse

- operation/route selection contracts;
- workflow selections, steps, and actions;
- existing-node-first choice data;
- placement recommendation and selection contracts;
- effect confirmation sequencing;
- diagram-type discovery, selection, change, and clear actions within each applicable browse route;
- CLI prompt text, summaries, progressive disclosure, and Save flow;
- all UX-facing and workflow contract tests;
- domain-service schemas and metadata that describe the rejected workflow.

### 4.3 Remove or replace

- `endpoint_strategy` as a substitute for relationship-first versus node-first intent;
- the claim that four friendly labels can sit on one relationship-first semantic branch;
- generic user-facing placement lists built from all syntactically legal positions;
- user-facing reason codes and source-model language;
- mandatory edge-placement prompts in ordinary flows;
- `--view` as the only practical way to establish a diagram-type filter;
- routine Save followed by routine commit confirmation;
- `edge_in_source_body: last` as the guided authoring rule;
- milestone and checkpoint acceptance claims invalidated by this review.

## 5. Corrective Contract Direction

This section defines the minimum capabilities the corrected architecture must express. Exact type names are decided in the corrective architecture, after transcript acceptance.

### 5.1 Route intent is explicit

The workflow must retain both direction and selection order, for example:

```text
direction: outgoing | incoming
selection_order: relationship_first | existing_node_first
```

This is not an instruction to preserve the old union with one more flag blindly. The corrective architecture must demonstrate the resulting step graph for all four routes before choosing final types.

### 5.2 Relationship-first step graph

```text
choose route
→ choose relationship + endpoint type combination
→ choose a named matching existing node or create a new node
→ edit new node when applicable
→ edit required or explicitly disclosed relationship details
→ resolve contextual node organization
→ review proposal
```

### 5.3 Existing-node-first step graph

```text
choose route
→ choose a named existing destination/origin node
→ choose a relationship constrained by the exact anchor/selected-node types and direction
→ edit required or explicitly disclosed relationship details
→ resolve contextual node organization without moving the existing node by default
→ review proposal
```

Existing-node choices must include the node ID, name, and type. Relationship annotations must be direction-aware and phrased for people.

### 5.4 Diagram-type filters are discoverable workflow actions

The corrected API must return the available diagram types, including stable identifiers plus human-readable names and descriptions, through a client-neutral guided surface. The workflow must accept select/change/clear actions at every applicable browse step and return the recomputed choices for that same route and selection order.

The client must not inspect `views.yaml` or invent diagram-type options. Internal view IDs remain machine values; user-facing presentation uses bundle-derived names and concise explanations.

### 5.5 Placement decisions are typed by meaning

The corrected contract must distinguish at least:

- source organization: nest new node, move existing node, keep existing node, or keep/create at top level/current level;
- sibling order within the already chosen organization;
- internal edge-line insertion owned by authoring machinery.

The client must never infer that `body` means nesting or that `last` means after all kinds of body content. The proposal carries semantic node organization and accepted material effects, not low-level relationship-line placement; the executor translates verified semantics privately.

### 5.6 One-outcome continuations do not become prompts

When only one valid continuation exists, the workflow advances without displaying a no-op choice. Explicit user choice remains required for moving an existing node and for any other material effect identified by the accepted UX.

## 6. Remediation Sequence And Gates

Only one phase may be active at a time. A green technical suite cannot advance a phase when its UX acceptance evidence fails.

### Phase 0 — Contain the failed milestone

Status: **ACCEPT — containment and cutover audit complete**. Branch isolation contained the failed milestone, and Phase 7 corrected and audited the current public documentation before remediation closeout.

Actions completed:

- marked the architecture rejected and the implementation plan failed;
- treated the rejected Guided Addition domain metadata as unstable until its v1 replacement;
- added no helper, MCP, app, or other adapter over the rejected workflow;
- withheld ready or usable `sdd add` claims until the Phase 7 documentation audit.

Gate:

- the failed implementation remains isolated on the remediation branch, no downstream adapter is added over it, and no release or publication claim is made before the Phase 7 documentation audit.

### Phase 1 — Approve UX proof transcripts

Status: **ACCEPT — explicitly accepted by the human reviewer**.

Accepted proof artifact: [Guided Addition UX Acceptance Transcripts](./guided_addition_ux_acceptance_transcripts.md). Its semantic-action descriptions remain provisional and do not establish final API type or field names.

Before corrective architecture or code, write exact user-facing transcripts for:

- standalone node;
- outgoing relationship-first to existing target;
- outgoing relationship-first to new target;
- outgoing existing-node-first;
- incoming relationship-first from existing origin;
- incoming relationship-first from new origin;
- incoming existing-node-first;
- standalone browsing with diagram-type selection and clearing;
- initial starting-node browsing with diagram-type selection, changing, and clearing;
- relationship-first browsing with diagram-type selection and changing;
- existing-node-first browsing with diagram-type selection and changing;
- structural new target with and without nesting;
- structural existing target with `move` and `leave where it is`;
- non-structural new target;
- no-op sibling-order cases with zero existing siblings;
- warning during Save.

Every transcript must state the option set at each step and why the next set is constrained. Include both displayed text and semantic action. Use real node IDs and names from one controlled fixture.

Gate:

- explicit human acceptance that prompt order, labels, options, placement decisions, proposal review, and Save behavior match the UX brief and observed-issues clarifications.

Stop condition:

- if a transcript requires a choice the proposed shared API cannot express, correct the API design; do not implement the choice in the CLI.

### Phase 2 — Correct bundle expressiveness

Status: **ACCEPT**. See the [Phase 2 Acceptance Report](./guided_addition_phase_2_acceptance_report.md).

Actions:

- replace the edge-last policy with a bundle-expressible semantic insertion policy: after relationship content and before nested node blocks;
- determine whether source-organization preferences need additional bundle fields for nest versus same-level recommendations;
- extend bundle types, loader validation, catalog accessors, and mutation proofs before runtime use;
- preserve relationship endpoint triples and structural authoring semantics as bundle authority.

Gate:

- bundle-only mutations demonstrably change edge/source organization behavior;
- no TypeScript relationship names or hidden placement defaults establish the rule;
- the current controlled fixture produces properties, relationship lines, a blank separator where present, then nested children.

### Phase 3 — Approve corrective API architecture

Status: **ACCEPT — explicitly accepted by the human reviewer**.

Accepted supplemental proof artifact: [Guided Addition Phase 3 UX Addendum](./guided_addition_phase_3_ux_addendum.md). The accepted Phase 1 transcripts remain authoritative and unchanged; the accepted addendum covers only previously unproven semantic classes.

Accepted architecture artifact: [Guided Addition API v1.0 Architecture](./guided_addition_api_v1_architecture.md).

Acceptance evidence: [Guided Addition Phase 3 Acceptance Report](./guided_addition_phase_3_acceptance_report.md).

Actions:

- define route, step, action, state, and choice contracts that reproduce every accepted transcript;
- specify existing-node-first constraints explicitly;
- expose bundle-derived diagram-type choices and select/change/clear actions at applicable browse steps;
- separate semantic source organization from sibling order and internal edge insertion;
- define which recommendations are automatic and which effects require user confirmation;
- decide versioning for workflow state and machine-readable contracts. The corrected workflow must not masquerade as the rejected stable contract;
- retain the content-delivery and authoring-executor boundary.

Gate:

- traceability table from every UX invariant and accepted transcript step to an API result/action;
- no client-side semantic reconstruction is needed;
- no normalized state removes a distinction that changes the next user choice;
- architecture review explicitly lists satisfied and violated UX invariants.

### Phase 4 — Rebuild planner behavior

Status: **ACCEPTED — implementation and gate approved on 2026-08-15**.

Planning artifact: [Guided Addition Phase 4 Implementation Plan](./guided_addition_phase_4_implementation_plan.md).

Gate artifact: [Guided Addition Phase 4 Acceptance Report](./guided_addition_phase_4_acceptance_report.md).

Actions:

- implement the corrected four-route state graph;
- reuse forms, filtering, IDs, snapshots, and catalog components only after focused coupling audits;
- implement node-first option construction and relationship constraint propagation;
- implement diagram-type selection, change, clear, and current-step recomputation without altering route order;
- replace generic placement enumeration with contextual decisions;
- add proposal equivalence tests showing that different routes may converge without sharing the wrong intermediate steps.

Gate:

- semantic step tests match every accepted transcript in order;
- negative tests prove node-first routes do not show relationship choices first;
- relationship-first routes do not show unconstrained existing nodes;
- existing-node-first relationships are constrained by both exact node types and direction;
- node and relationship browse steps can select, change, and clear diagram type without client-side semantic filtering;
- regular and bridge choices follow the UX brief's ranking and annotation rules after each filter change;
- existing nodes never move without an explicit accepted effect.

### Phase 5 — Repair proposal application and source organization

Status: **ACCEPTED — implementation and gate approved on 2026-08-15**.

Evidence: the accepted [Phase 5 Acceptance Report](./guided_addition_phase_5_acceptance_report.md) records the native internal v1 executor, semantic organization verification and translation, exact source proofs, dry-run/commit parity, undo, focused **101/101**, and full serial **841/841** verification.

Actions:

- make proposal verification understand the corrected organization decisions;
- ensure top-level node insertion preserves a blank line between definitions;
- ensure inserted relationship lines remain adjacent to relationship content and before nested children;
- retain stale revision/fingerprint/effect verification and source-preserving reparenting;
- prove dry-run and commit candidate parity.

Gate:

- explicit source-text assertions cover issues 12 and 13;
- structural and non-structural proof cases preserve intended node location;
- no snapshot or golden is updated to conceal formatting or ordering failure.

### Phase 6 — Replace `sdd add` interaction

Status: **ACCEPTED — implementation and gate approved on 2026-08-15**.

Evidence: the accepted [Phase 6 Acceptance Report](./guided_addition_phase_6_acceptance_report.md) records the v1 public cutover, thin CLI delivery, bound warning consent, bundle-owned warning presentation, legacy removal, focused **95/95**, and full serial **794/794** verification.

Actions:

- implement only the accepted transcripts over the corrected API;
- use direction-aware prompts and include node ID, name, and type;
- offer diagram-type filtering in the guided interaction using human-readable diagram names, including change and clear choices;
- translate bundle metadata into concise human explanations;
- eliminate reason codes, opaque IDs, source-model language, and unnecessary placement prompts;
- use one ordinary Save decision, with additional confirmation only for concrete warnings or material effects;
- show a plain-language proposal summary that distinguishes adding a node, adding a relationship, nesting, and moving an existing node.

Gate:

- transcript tests match accepted wording and step order;
- a forbidden-language test rejects known internal tokens and patterns;
- singular/plural tests cover zero, one, and multiple existing relationships;
- transcript tests cover diagram-type selection, change, and clear for standalone, initial starting-node, relationship-first, and existing-node-first browsing;
- cancellation before Save performs no write; Save verifies and commits the reviewed proposal once;
- a manual usability replay of every proof transcript is accepted before broader release claims.

### Phase 7 — Regenerate downstream artifacts and document the cutover

Status: **ACCEPTED — implementation and gate approved on 2026-08-15**.

Evidence: the accepted [Phase 7 Acceptance Report](./guided_addition_phase_7_acceptance_report.md) records corrected public and maintainer documentation, serialized static and bundle-resolved v1 metadata, emitted declaration checks, focused **183/183**, VitePress build, and full serial **799/799** verification. No checked-in metadata cache, adapter, deployment, publication, merge, or release was added.

Actions:

- regenerate downstream and published contract schemas and metadata from the corrected live public API;
- update explanatory toolchain, CLI, README, and helper documentation;
- audit all claims that the rejected API is stable, complete, or available;
- only then consider future helper, MCP, or app adapters.

Gate:

- metadata validates real corrected workflow values;
- all public documentation uses the corrected mental model;
- full regression passes after UX proof cases pass;
- the final report cites satisfied and violated UX invariants separately from technical invariants.

## 7. Required Acceptance Matrix

| Observed issue | Required remediation owner | Acceptance evidence |
| --- | --- | --- |
| 1 and 9 — internal reason codes | CLI presentation | Forbidden-language transcript test; no internal reason code displayed. |
| 2 — “Review complete” | CLI presentation | Proposal review ends in a meaningful Save/Cancel question. |
| 3 — two commit moments | Client orchestration | One ordinary Save; extra confirmation only for a displayed warning/effect. |
| 4 — relationship-first versus node-first | API contract and planner | Four distinct step-order tests matching the UX brief. |
| 5 and 7 — endpoint language and missing names | API choices and CLI | Direction-aware prompt; every existing-node option includes ID, name, and type; correct plurality. |
| 6 — nesting decision and existing-node movement | Placement contract and planner | Explicit nest/no-nest step; `no` leaves existing node unchanged; sibling order appears only when needed. |
| 8 — advanced fields | Forms and CLI | Contextual disclosure wording; no disclosure prompt when no optional fields exist. |
| 10 — contradictory node positions | Placement planner | No outgoing destination-before-origin alternative without an independently justified semantic rule. |
| 11 — non-structural containment confusion | Placement contract and CLI | No nesting prompt for non-structural relationships; internal edge placement is not presented as containment. |
| 12 — missing blank line | Shared mutation engine | Exact committed source contains a blank line between adjacent top-level node definitions. |
| 13 — edge after nested nodes | Bundle policy and mutation path | Exact committed source places the new edge after existing edge content and before the first nested node. |
| 14 — absent diagram-type filters | API workflow and CLI | Standalone, initial starting-node, and all four known-node routes can browse, select, change, and clear diagram type by human-readable name; choices are recomputed and ranked according to the UX brief. |

## 8. Review And Reporting Rules

Every remediation phase report must contain:

- the exact UX invariants in scope;
- the accepted transcript or proof case used;
- satisfied UX invariants;
- violated UX invariants;
- satisfied technical invariants;
- violated technical invariants;
- bundle fields and generic consumers involved;
- exact test evidence;
- residual risks;
- an explicit `ACCEPT`, `REJECT`, or `BLOCKED` phase decision.

“Tests pass,” “architecture preserved,” “deterministic,” and “bundle-driven” are never substitutes for UX acceptance. A phase is rejected if its proof transcript is wrong even when every automated technical test is green.

## 9. Completion Criteria

Remediation is complete only when:

- all four known-node decision trees follow the UX brief in both API steps and client prompts;
- every next choice is constrained by the user's previous semantic choice;
- diagram-type filters are available inside every applicable guided browse flow and preserve that flow's selection order;
- all observed issues have passing acceptance evidence in section 7;
- nesting and existing-node movement are explicit, contextual decisions;
- irrelevant placement choices and internal implementation language are absent;
- committed source has correct top-level spacing and edge-before-child organization;
- Save/Cancel remains client-owned with one ordinary Save decision;
- the guided API remains pure and the authoring executor remains the only write path;
- corrected machine-readable metadata describes the accepted API;
- no unresolved UX invariant is hidden by passing regressions, snapshots, or implementation-bound tests.
