# [Done] Guided Addition Phase 5 Acceptance Report

Phase decision: **ACCEPT**

Human approval: **ACCEPTED on 2026-08-15**

Phase 5 adds the internal v1.0 proposal executor, translates accepted semantic organization into shared mutations, and repairs the exact source-organization failures assigned to this phase. The report keeps the technical decision distinct from the human approval now recorded above.

## UX Invariants In Scope

- A completed v1.0 proposal remains semantic: it contains node organization and accepted material effects, not edge-placement instructions or caller-authored mutations.
- Non-structural new endpoints use graph-consistent top-level order: outgoing destinations follow their origin and incoming sources precede their destination.
- Structural new targets may remain top-level or become nested exactly as selected.
- An existing target remains where it is unless the proposal contains its exact accepted movement effect.
- A new incoming structural source may take the existing target's current position and wrap its complete subtree.
- Adjacent top-level definitions have a blank boundary.
- New relationship content remains after properties and existing relationships, before a blank separator and nested children.
- Dry-run verification does not create another human decision or silently change the accepted proposal.

Accepted evidence: Phase 1 transcripts T03, T06, T09, T10, and T11; Phase 3 addendum cases A01, A02, and A03; issues 12 and 13 in the remediation acceptance matrix.

## UX Result

Satisfied:

- T03 and T06 apply the accepted direction-specific same-level order with exact blank top-level boundaries.
- T09 leaves the new structural target top-level while inserting its relationship before `P-100`'s nested child.
- A01 places `A-201` at `P-100`'s former position, moves the complete `P-100` subtree beneath it exactly once, and preserves `C-100` exactly once.
- A02 places the new source before `P-100` without moving `P-100`.
- A03 produces the relationship, blank separator, and only nested child exactly.
- Existing-target keep and move paths preserve the selected location; a forged or unaccepted move effect is rejected.
- No v1 proposal or application operation exposes relationship-line placement.

Violated: **none within the Phase 5 scope**.

## Technical Invariants In Scope

- The v1 executor consumes `CompletedAdditionProposalV1` directly and has no converter or dependency on legacy workflow, placement, or proposal-executor modules.
- Proposal kind/version, canonical identity, document path, revision, bundle fingerprint, node identities, node-ID uniqueness, fields, endpoint triple, route intent, display context, organization, sibling order, and material effects are reverified before translation.
- Semantic organization translates privately to node insertion and source-preserving reparent operations.
- Relationship insertion omits low-level placement and delegates to the loaded bundle policy.
- Shared source mutation owns serialization, persistence, temporary-handle remapping, dry-run/commit execution, journaling, and undo.
- Separator repair affects only a newly created top-level boundary or relationship-to-nested boundary; comments and existing trivia remain owned and ordered.
- The quarantined legacy executor remains operational for the Phase 6 cutover.

## Technical Result

Satisfied:

- `applyAdditionProposalV1(...)` is an internal, file-backed v1 executor outside the pure planner directory and outside the root package exports.
- Every accepted semantic organization kind translates through shared `ChangeOperation` values; `keep_existing_node` produces no movement operation.
- Wrapper replacement uses insertion immediately before the target in its current stream followed by one exact reparent operation.
- Deterministic `node_1` and `edge_1` targets are remapped through shared mutation execution, including `parent_local_id: node_1` for an edge authored by a new source.
- Dry-run and commit return identical resulting revision, operations, summary, diagnostics, and created-target mappings; dry-run performs no write.
- Commit and undo restore the original document exactly.
- First, last, before, and after top-level insertions add only missing blank boundaries while preserving adjacent comments.
- The active bundle policy inserts a placement-free relationship before nested content; a cloned bundle using explicit legacy `last` places the same operation at the body end.
- The existing explicit low-level edge-placement override remains covered by the shared mutation suite.
- Legacy proposal tests remain green with the corrected relationship-to-nested separator.

Violated: **none within the Phase 5 gate**.

## Bundle Authority And Consumers

| Bundle authority | Generic consumer | Phase 5 evidence |
| --- | --- | --- |
| `core/contracts.yaml` allowed endpoint triples | guidance catalog and v1 proposal verifier | forged or unavailable literal triples cannot translate |
| relationship `authoring.graph_role` and `source_organization` | v1 organization verifier | structural move/nest/wrap patterns are distinguished from non-structural same-level patterns without relationship-name checks |
| relationship edge-field support and required-property rules | shared form normalization used by the v1 verifier | proposal fields are canonical and current-bundle-valid before translation |
| `core/authoring.yaml: guided_addition.default_display_profile_id` | guidance catalog and v1 proposal verifier | stale display context is rejected |
| guided view definitions | guidance catalog and v1 proposal verifier | referenced non-null diagram filters must still exist |
| `core/authoring.yaml: placement_policies.default.edge_in_source_body` | shared mutation execution | bundle-only active-versus-legacy changes move the same placement-free edge operation |

No new bundle field was introduced. Blank definition boundaries are shared source-serializer behavior; relationship semantics and relationship-line placement remain bundle-controlled.

## Test Evidence

- `TMPDIR=/tmp pnpm run build`: passed.
- Focused Phase 5 suite: **101/101 passed** across the v1 planner and architecture boundary, native v1 executor, shared mutations, ordering/undo, legacy executor regression, bundle, catalog, placement, and snapshot tests.
- Full serial repository gate: **841/841 passed** across **92/92 files** with `TMPDIR=/tmp pnpm test --no-file-parallelism`.
- Exact source assertions cover T03, T06, T09, A01, A02, A03, existing-target keep/move, issues 12 and 13, dry-run/commit parity, and exact undo.
- No snapshot, golden, or rendered corpus artifact was updated.

## Residual Risks And Boundary

- `applyAdditionProposalV1(...)` intentionally remains internal. Root exports, public schemas, contract metadata, and the CLI still use the quarantined legacy contract until Phase 6.
- The legacy planner and executor are staged migration dependencies, not supported v1.0 compatibility.
- Client Save/Cancel orchestration and warning acceptance remain Phase 6 responsibilities.
- Public documentation and metadata cutover remain deferred to later phases.

Phase decision: **ACCEPT**

Human approval: **ACCEPTED on 2026-08-15**. Phase 6 planning is authorized; implementation requires an accepted Phase 6 plan.
