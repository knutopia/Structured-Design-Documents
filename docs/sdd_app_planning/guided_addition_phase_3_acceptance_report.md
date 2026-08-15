# Guided Addition Phase 3 Acceptance Report

Status: **ACCEPTED**

Phase decision: **ACCEPT**

Human approval: **ACCEPTED on 2026-08-14**

Phase 3 establishes the accepted supplemental UX proof and proposes the corrective Guided Addition API v1.0 architecture. It does not implement that architecture or authorize Phase 4.

## UX Invariants

Satisfied by the proposed architecture:

- all four known-node direction and selection-order routes remain explicit;
- no-node launch, standalone node addition, and initial starting-node filtering are represented;
- each relationship-first or existing-node-first choice constrains the next page without client reconstruction;
- diagram filters are discoverable select/change/clear actions scoped to the current browse page;
- API content is display-ready and choices carry exact typed actions;
- structural organization separates nest/top-level, move/leave, sibling order, and material confirmation;
- zero-sibling order and single-relationship disambiguation skip meaningless pages;
- non-structural new nodes receive only direction-consistent same-level choices;
- existing nodes remain where they are unless an accepted, effect-specific move is confirmed;
- proposal review is part of the completed result; Save/Cancel remains client-owned and only a concrete warning adds a decision;
- relationship-line placement is neither user-facing nor present in the v1.0 proposal.

Violated: **none identified in the proposed contract**.

Human acceptance confirms these architecture claims. Implementation evidence remains required in the later remediation gates.

## Technical Invariants

Satisfied by the proposed architecture:

- workflow and proposal versions reset to `1.0`; rejected `0.1` payloads have no implicit compatibility path;
- the runtime remains pure, stateless from the service perspective, and caller-carried;
- every state and proposal is bound to document revision and bundle fingerprint;
- literal incoming/outgoing triples remain bundle-derived and no inverse relationship is inferred;
- progress is a discriminated route-specific union rather than a sparse normalized selection bag;
- proposal organization is semantic; low-level mutation placement is private to the executor;
- stale actions, confirmations, filters, and proposals are rejected after recomputation;
- verification and write remain behind the shared proposal-executor boundary.

Violated: **none identified in the proposed contract**.

## Bundle Fields And Consumers

| Behavior | Bundle authority | Consumer |
| --- | --- | --- |
| Exact relationship compatibility and direction | `core/contracts.yaml` allowed endpoints | Candidate builder and proposal verifier |
| Structural organization and relationship fields | Relationship authoring/rule metadata | Organization and form builders |
| Node/relationship names and descriptions | `core/vocab.yaml` | Display content composer |
| Diagram choices and relationship display relevance | `core/views.yaml` | Filter page, ranking, and annotation composer |
| ID suggestions and node forms | `core/authoring.yaml` | Form builder and verifier |
| Directional and structural recommendation inputs | `core/authoring.yaml` placement policies | Semantic organization builder |
| Relationship-line insertion | `edge_in_source_body` | Shared mutation engine only |
| Display profile default | Proposed `guided_addition.default_display_profile_id` | Filter normalization and display evaluator |

The explicit display-profile default is the one new bundle-contract requirement identified by Phase 3. Phase 4 must add its type, validation, accessor, bundle value, and bundle-mutation proof before runtime use.

## Architecture Evidence

- [Guided Addition API v1.0 Architecture](./guided_addition_api_v1_architecture.md) sections 6–12 define route, page, choice, action, state, proposal, source-organization, and executor boundaries.
- Its section 15 maps every remediation UX invariant to a v1.0 contract surface and later proof.
- Its section 16 traces every accepted T01–T19 and A01–A04 interaction to an exact page/action sequence or client/executor result.
- The accepted [Phase 3 UX Addendum](./guided_addition_phase_3_ux_addendum.md) supplies the previously missing incoming structural, zero-sibling, and one-relationship proof cases.
- The rejected architecture and failed implementation plan remain unchanged historical evidence.

No runtime tests are claimed for Phase 3 because this phase is architecture-only. No snapshots, goldens, public documentation, runtime code, CLI code, or contract metadata were changed.

## Residual Risks And Required Later Proof

- The repository still executes the rejected `0.1` workflow until the authorized implementation phases replace it.
- Display-ready copy composition and typed action replay require new focused contract tests.
- The new bundle-owned display-profile default requires a contract extension before planner implementation.
- Semantic organization translation, especially A01's wrapper replacement, requires exact mutation proofs in Phase 5.
- The `sdd add` client must be rebuilt against supplied page content; adapting the current prompt loop is not evidence of conformance.
- Machine-readable public contract metadata remains stale until its authorized replacement phase.
- Phase 3 acceptance does not constitute implementation evidence or authorize bypassing the later remediation gates.

## Decision

Decision: **ACCEPT the v1.0 architecture and authorize Phase 4 planning**.

Phase decision: **ACCEPT**
