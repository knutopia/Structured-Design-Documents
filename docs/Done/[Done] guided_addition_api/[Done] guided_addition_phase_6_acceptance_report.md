# [Done] Guided Addition Phase 6 Acceptance Report

Phase decision: **ACCEPT**

Human approval: **ACCEPTED on 2026-08-15**

Phase 6 replaces the rejected `sdd add` workflow with the accepted Guided Addition v1 runtime and executor. The CLI is now a thin renderer of API-supplied interaction content, warned writes require proposal-bound consent, the public package and live contract index describe v1, and the legacy workflow has been removed.

This report records the technical decision separately from the human approval now recorded above.

## UX Invariants In Scope

- The four relationship routes remain distinct through the human choice sequence.
- Diagram filtering is a contextual select/change/clear interaction at every applicable browse point; `--view` is not a substitute.
- The client renders API-supplied titles, prompts, choices, descriptions, selected-value text, forms, reviews, and warnings without rebuilding relationship or organization semantics.
- Ordinary output contains human-facing names and excludes reason codes, opaque identifiers, hashes, raw display metadata, source-stream terms, and movement implementation terminology.
- Cancel performs no proposal verification and no write.
- Save dry-runs the unchanged proposal and commits immediately when verification is warning-free.
- A concrete warning creates exactly one informed decision: `Save anyway` or `Go back`.
- `Go back` returns to the unchanged review; `Save anyway` commits only the proposal and warning set that were reviewed.

## UX Result

Satisfied:

- T01–T15 and T19 retain the accepted v1 composer wording and step order. The public CLI renders those same page and action contracts generically; it does not contain a second decision tree.
- The accepted T19 composer order and `P-300: Reports (Place)` spelling remain the implementation authority recorded in Phase 4.
- T16 contains one warning-free `Save these changes?` decision, prints `Chosen: Save changes`, and writes exactly once.
- T17 displays exactly `P-210: Projects Overview already has this exact navigation to P-100: Dashboard.`, then offers `Save anyway` and `Go back`.
- T18 selects Cancel, invokes no executor, performs no write, and ends with `Canceled. No changes were made.`
- The CLI proof selects and clears contextual diagram filters using API-supplied human-readable choices.
- API proofs cover outgoing and incoming filtering plus zero, one, and multiple existing-relationship wording.
- The transcript scan rejects known internal reason codes, proposal/effect/placement identifiers, hashes, raw role/presence output, source-stream language, and reparent terminology.
- `sdd add --view` is rejected as an unknown option; `--node` remains an exact node-ID anchor.

Violated: **none within the Phase 6 scope**.

## Technical Invariants In Scope

- Root exports expose only the versioned v1 runtime, executor, contracts, shared snapshot contracts, and v1 domain error for Guided Addition.
- No runtime, CLI, test, root-export, or live metadata dependency remains on the rejected workflow.
- Warning review content is display-ready and carries an opaque token that is never printed by the CLI.
- The token binds the proposal ID, normalized document path, base revision, resulting revision, bundle fingerprint, and exact sorted warning diagnostics.
- A generic shared pre-write guard rejects absent or invalid consent before persistence.
- Duplicate-relationship warning wording is bundle-owned, typed, validated, and consumed without a TypeScript wording fallback.
- The live contract index describes actual v1 state, page, action, proposal, review, executor, and warning-consent values.
- Downstream generated artifacts and public explanatory documentation remain deferred to Phase 7.

## Technical Result

Satisfied:

- `createGuidedAdditionRuntimeV1(...)`, `applyAdditionProposalV1(...)`, `GuidedAdditionV1DomainError`, and the v1/shared contracts are public root exports; the legacy unversioned exports are absent.
- The legacy planner, placement recommender, workflow contracts, proposal executor, and their obsolete tests are deleted.
- Shared forms and snapshot services depend on legacy-independent shared contracts.
- The CLI advances only actions returned by the v1 runtime and sends the completed proposal unchanged to the v1 executor.
- Warning-free Save performs one dry-run and one commit. Cancel performs neither. Warning refusal performs no commit.
- Missing and forged tokens fail before writing. A token from a different proposal fails. A token replayed after a successful write fails on the changed revision without a second write. A bundle-mutated warning configuration produces changed presentation and a different token; the old token fails.
- The pre-write guard runs after the exact candidate result and diagnostics are computed but before the document write or commit journal entry.
- Bundle validation rejects missing templates, unknown placeholders, unmatched braces, unknown relationship overrides, and incomplete edge-field labels.
- Real v1 runtime values compile against the published live schemas; rejected `0.1` workflow and placement vocabulary is absent.
- Architecture scans prove the deleted legacy modules are absent and the pure v1 planner remains independent of workspace and mutation modules.

Violated: **none within the Phase 6 gate**.

## Accepted Transcript Evidence

| Transcript scope | Evidence |
| --- | --- |
| T01 | no-anchor standalone route, contextual node filtering, bundle-derived forms, semantic ordering, and API review |
| T02–T07 | all outgoing and incoming relationship-first/existing-node-first routes, exact endpoint constraints, names/types, and route convergence |
| T08–T12 | contextual nest/leave/move/order decisions and direction-consistent non-structural ordering |
| T13–T14 | relationship-first and existing-node-first diagram-filter select/change/clear behavior |
| T15 | contextual node and relationship detail disclosure with bundle-derived fields |
| T16 | exact warning-free CLI Save tail and one write |
| T17 | exact duplicate-navigation warning, bound consent token, and one write after `Save anyway` |
| T18 | exact Cancel tail, zero executor calls, and zero writes |
| T19 | no-anchor relationship route, accepted generated starting-node order/spelling, and starting-node filter select/change/clear |

## Bundle Authority And Consumers

| Bundle authority | Generic consumer | Phase 6 evidence |
| --- | --- | --- |
| `core/authoring.yaml: guided_addition.warning_messages.duplicate_edge.default` | warning formatter in the v1 executor | every duplicate relationship has required bundle-owned wording; no code fallback exists |
| `core/authoring.yaml: guided_addition.warning_messages.duplicate_edge.by_relationship` | warning formatter in the v1 executor | `NAVIGATES_TO` supplies the exact accepted navigation sentence; a bundle-only change alters presentation and token identity |
| `core/authoring.yaml: guided_addition.edge_field_labels` | guidance catalog and v1 relationship form composer | Event, Condition, Effect, and Field labels are loaded and coverage-validated |
| `core/authoring.yaml: guided_addition.default_display_profile_id` | planner, CLI verification request, and proposal verifier | the CLI does not hardcode a display profile default |
| `core/views.yaml` guided diagram definitions | v1 browse pages and scoped filters | clients receive names, descriptions, select/change/clear actions, and recomputed options |
| `core/contracts.yaml` endpoint triples and relationship authoring metadata | v1 planner and executor | route constraints, field availability, and organization semantics remain bundle-owned |
| `core/authoring.yaml: placement_policies.default.edge_in_source_body` | shared mutation engine | placement-free v1 relationship operations retain bundle-controlled source organization |

## Public Cutover Evidence

- The package root exports the versioned v1 surface and no unversioned Guided Addition workflow surface.
- `sdd add` uses the v1 runtime and executor directly and exposes `--node` and `--bundle`, but not `--view`.
- The live contract index publishes v1 workflow, action, proposal, review, application-result, and warning-consent subjects and constraints.
- Deleted-module and import scans find no production dependency on the legacy workflow.
- No public documentation or downstream generated metadata artifact was changed in Phase 6.

## Test Evidence

- Focused Phase 6 gate: **95/95 passed** across **9/9 files**, covering bundle validation, catalog composition, snapshots, v1 planning, v1 execution and warnings, CLI transcripts, live contract metadata, architecture boundaries, and shared mutations.
- Additional warning-token replay and bundle-change proof: **11/11 passed** in the v1 executor suite.
- Full serial repository gate: **794/794 passed** across **88/88 files** with `TMPDIR=/tmp pnpm test --no-file-parallelism`.
- The full test command included a successful TypeScript build.
- The first full pass exposed one expected-list drift in the contract-metadata registry test. The expected v1 constraint categories were corrected; no snapshot, golden, rendered corpus, or public documentation artifact was refreshed.
- `git diff --check` passed, and production-source scans found no legacy Guided Addition imports or rejected metadata vocabulary.

## Residual Risks And Boundary

- Public explanatory documentation and downstream generated/published metadata still describe the pre-cutover release until Phase 7 updates them.
- The bundle currently supplies a relationship-specific duplicate warning only for `NAVIGATES_TO`; the required generic template covers all other relationship types.
- The terminal adapter is intentionally line-oriented. Other future clients must render the same v1 content contract rather than infer semantics from it.
- Phase 7 is authorized only through its separately accepted implementation plan.

## Decision

Phase decision: **ACCEPT**

Human approval: **ACCEPTED on 2026-08-15**. Phase 7 is authorized through its accepted implementation plan.
