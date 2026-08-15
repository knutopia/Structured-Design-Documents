# Guided Addition Phase 4 Acceptance Report

Status: **REVIEW READY — BLOCKED**

Technical recommendation: **BLOCKED**

Human phase decision: **PENDING**

This recommendation reports the Phase 4 gate; it does not claim human acceptance. The v1.0 planner implementation and technical verification are complete, but one accepted T19 presentation invariant cannot be implemented generically from the accepted controlled fixture without clarification.

## UX Invariants

Satisfied:

- no-anchor launch exposes standalone-node and relationship paths;
- anchored relationship addition preserves all four literal direction and selection-order routes;
- relationship-first constrains named endpoints by the selected exact triple;
- existing-node-first presents named compatible endpoints before exact relationship disambiguation;
- one remaining relationship and zero-sibling order advance automatically;
- all six applicable browse contexts expose scoped diagram-filter actions that select, change, clear, and return to the same browse identity;
- standalone-node filtering follows the bundle view's ordered node scope;
- relationship filtering ranks primary, supporting, then bridge choices and gives bridges the accepted `Cross-diagram connection` annotation;
- node and relationship forms are separate, bundle-derived pages; blank optional values normalize away;
- structural organization distinguishes nest/top-level, move/leave, sibling order, wrapper replacement, and exact material-effect confirmation;
- non-structural new nodes receive only direction-consistent same-level order choices;
- existing declarations remain in place unless the exact movement effect is accepted;
- completion directly returns a v1.0 semantic proposal and display-ready review with no planner-owned Save, Cancel, `review_proposal`, or `complete` action;
- accepted T16 and T17 review wording is returned for the controlled standalone and duplicate incoming-navigation cases.

Violated or unresolved:

- T19's accepted all-diagram starting-node list orders the exact fixture as `P-100, VS-100, O-100, C-100, A-200, C-200, P-210, P-300`. Parsing the exact accepted fixture yields source order `P-100, C-100, A-200, P-210, P-300, VS-100, C-200, O-100`. Neither the bundle nor the accepted architecture declares a generic starting-node ordering policy that produces the transcript order.
- The T19 IA and UI filtered lists contain `P-300: Reports — Place)`, while the generic display composer correctly returns `P-300: Reports (Place)`.

The implementation deliberately does not hardcode controlled-fixture node IDs, invent a hidden TypeScript ordering convention, or reproduce malformed display text. Resolving this gate requires deciding whether T19 should use parsed source order, another bundle-expressed generic ordering rule, or corrected accepted transcript order/text.

## Technical Invariants

Satisfied:

- `workflow_version`, API results, and proposals are v1.0 only;
- v1 state uses route-specific discriminated progress and action-bearing choices;
- state, actions, confirmations, and proposal identity are revision- and bundle-bound;
- v1 proposals contain semantic node organization and accepted material effects but no generic placement, edge placement, source-body stream, or placement reason;
- the pure v1 graph is split into contracts, content, filtering, organization, and planner modules;
- an import-boundary test rejects legacy workflow, legacy placement, proposal application, mutation, CLI, and workspace imports;
- no v1 adapter or converter to the quarantined `0.1` workflow exists;
- existing legacy planner, CLI, contract metadata, and proposal-application tests remain green;
- the exact controlled fixture byte-matches the accepted transcript source block and validates under `simple` with zero errors and warnings;
- no snapshot or golden was refreshed.

Violated: **none identified**.

## Bundle Fields And Consumers

| Bundle authority | Runtime consumer | Proven behavior |
| --- | --- | --- |
| `core/authoring.yaml: guided_addition.default_display_profile_id` | accessor, validation, guidance catalog, v1 forms and proposal guidance context | explicit `simple` default; declared `strict` is accepted; missing, unknown, and unresolvable values fail |
| `core/views.yaml: projection.include_node_types` | guided view catalog, node-type/start-node filtering, scope-description composer | bundle-only scope/order changes alter filtered types and descriptions |
| `core/views.yaml: conventions.guided_addition` roles and display rules | v1 filter ranking and catalog display resolution | primary/supporting/bridge ordering and profile resolution remain bundle-controlled |
| `core/contracts.yaml: allowed_endpoints` | v1 relationship-first and existing-node-first candidate builders | exact literal direction/type constraint propagation |
| relationship `authoring` semantics | v1 organization graph | structural versus same-level organization without relationship-name placement checks |
| relationship edge-field support and required-property rules | v1 relationship forms | exact-triple optional/required disclosure |
| `core/authoring.yaml: node_forms` and ID suggestions | shared form utilities used by v1 | primary/additional grouping, validation, editable collision-safe suggestions |
| loaded document snapshot structure | v1 organization module | existing parent/children, meaningful sibling order, and concrete movement effects |

The existing `edge_in_source_body` policy remains owned and consumed by the shared mutation engine. The Phase 4 planner neither reads nor exposes relationship-line placement.

## Test Evidence

| Accepted evidence | Focused proof |
| --- | --- |
| T01 | no-anchor standalone path; node filter select/change/clear; primary/additional forms; top-level-last completion and exact review |
| T02–T04 | outgoing relationship-first/new/existing and existing-node-first; exact endpoint constraint and relationship disambiguation; route convergence |
| T05–T07 | incoming relationship-first/new and existing-node-first; duplicate annotation; no inversion; route convergence and exact review |
| T08–T11 | new structural target nest/top-level; meaningful/automatic order; existing-target move/leave; exact effect confirmation |
| T12 | outgoing after-anchor and incoming before-anchor semantic same-level choices |
| T13–T14 | relationship-first and existing-node-first select/change/clear; exact IA/UI ranking and bridge annotation |
| T15 | contextual node and relationship fields, accepted disclosures, blank normalization, rejected forged form submissions |
| T16–T18 planner scope | completion returns review content directly and exposes no Save/Cancel action |
| T19 | no-anchor relationship path, starting-node filter select/change/clear, then route selection; exact list ordering remains blocked as recorded above |
| A01–A04 | wrapper replacement and exact confirmation; leave-current order; zero-sibling auto-order; one-relationship auto-advance |

Commands and results:

- `TMPDIR=/tmp pnpm run build`: passed.
- exact fixture comparison against the first accepted transcript SDD block: passed.
- SDD helper validation under `simple`: 0 errors, 0 warnings.
- focused Guided Addition, bundle, legacy-quarantine, CLI, placement, snapshot, contract, and proposal suites on the final tree: 123/123 passed; the v1 planner subset is 22/22.
- `TMPDIR=/tmp pnpm test`: 823/830 passed; seven unrelated Journey Map tests timed out under concurrent renderer load with no assertion failure.
- serial rerun of the four timed-out Journey Map files: 91/91 passed.
- `TMPDIR=/tmp pnpm test --no-file-parallelism`: 831/831 passed.

## Residual Risks

- T19 starting-node order and two malformed filtered labels require an authority decision before the UX gate can be accepted.
- The rejected `0.1` planner remains quarantined because the Phase 5 executor and Phase 6 CLI/public contracts still depend on it; it is not supported v1.0 compatibility.
- v1.0 remains an internal Phase 4 entrypoint and is intentionally absent from root exports and the CLI until the Phase 6 cutover.
- Phase 4 proposals are semantic only. Translation, verification, exact source effects, dry-run/commit parity, and undo evidence belong to Phase 5.
- The default parallel full-suite run can exceed existing Journey Map per-test timeouts under concurrent renderer load; the complete serial run is green.

## Decision

Recommendation: **BLOCKED pending clarification of T19 starting-node ordering and malformed labels**.

Phase 5 planning and implementation must not begin until that UX authority mismatch is resolved and the Phase 4 gate receives explicit human acceptance.
