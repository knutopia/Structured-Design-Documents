# Guided Addition Phase 2 Acceptance Report

Phase decision: **ACCEPT**

Phase 2 corrects bundle expressiveness and shared relationship-line insertion only. Phase 3 corrective API architecture remains unauthorized.

## UX Invariants In Scope

- Accepted transcript status and initial starting-node filtering remain represented consistently in the remediation authority.
- Relationship-line source placement is internal and is not presented as a human placement decision.
- New relationship lines appear after properties and existing relationship content, before the blank separator and nested node blocks.
- Guided proposal construction remains read-only; shared authoring mutation machinery owns source insertion.

Accepted evidence: the Phase 1 transcripts, especially T02, T19, and the exact source-organization proof in section 6.2.

## UX Result

Satisfied:

- Phase 1 is explicitly recorded as accepted without promoting provisional semantic-action names into an API contract.
- Initial starting-node filtering appears in the filtering invariant, Phase 1 checklist, future CLI test gate, and issue 14 acceptance entry.
- Guided placement recommendations contain node-organization decisions only; relationship-line insertion is no longer exposed.
- The exact `P-100: Dashboard` proof places `NAVIGATES_TO P-300` after the existing relationship and before the nested `C-100` block while preserving the blank separator.

Violated: **none within the Phase 2 scope**.

## Technical Result

Satisfied:

- `bundle/v0.1/core/authoring.yaml` owns the active `after_relationships_before_nested_nodes` policy.
- Bundle types and validation accept the active semantic token and the explicit legacy `last` token, and reject unknown tokens.
- Runtime consumption is `getPlacementPolicyInputs(...)` → shared change execution → edge insertion. No relationship name or hidden TypeScript fallback establishes the rule.
- The same placement-free operation changes exact source output when only the bundle policy changes.
- Explicit low-level placement overrides the bundle default. Without authoring metadata, placement-free edge insertion is rejected rather than silently defaulted.
- Guided proposals omit edge placements and still apply through shared mutation machinery.
- No additional nest-versus-same-level bundle field was added: existing relationship authoring semantics and structural/directional inputs are sufficient until the Phase 3 interaction contract is designed.

Violated: **none within the Phase 2 gate**.

## Test Evidence

- Build and final combined Phase 2/guided replay: **65/65 passed** across bundle, mutation, placement, proposal, planner, and architecture tests.
- Final full repository run: **805/806 passed**. The sole failure was the unrelated five-second timeout in `journeyMapRouting.spec.ts` for “retains the isolated ordering skip while later accepted families are added.” The unchanged test passed independently: **1/1 in 3.76 seconds**.
- No snapshots, goldens, or rendered corpus artifacts were refreshed.

## Residual Risks And Boundary

- The repository-wide journey routing test remains sensitive to full-suite load; this is outside Guided Addition and was not altered.
- The rejected workflow contract still exists and is intentionally deferred to Phase 3 redesign.
- Legacy `edge_in_source_body: last` remains readable only as an explicit compatibility behavior and bundle-authority proof; it is not active and is never a fallback.
- Public-documentation and metadata cutover work remains deferred to Phase 7.

Phase decision: **ACCEPT**
