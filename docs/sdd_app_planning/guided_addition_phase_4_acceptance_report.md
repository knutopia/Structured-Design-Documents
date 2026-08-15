# Guided Addition Phase 4 Acceptance Report

Status: **ACCEPTED**

Technical recommendation: **ACCEPT**

Human phase decision: **ACCEPTED on 2026-08-15**

Phase 4 implements and proves the pure Guided Addition v1.0 planner. Human review accepted the composer's generated starting-node order and `P-300: Reports (Place)` spelling as corrections to erroneous T19 reference details.

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

Accepted reference corrections:

- The composer's generated starting-node list order is accepted in place of T19's erroneous reference ordering.
- The composer's `P-300: Reports (Place)` list item is accepted in place of T19's malformed `P-300: Reports — Place)` reference text.

Violated: **none identified after the accepted T19 reference corrections**.

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
| T19 | no-anchor relationship path, composer-generated starting-node order and spelling, filter select/change/clear, then route selection |
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

- The historical T19 transcript retains the superseded ordering and malformed label as reference history; the human acceptance recorded here makes the composer's generated behavior authoritative for implementation evidence.
- The rejected `0.1` planner remains quarantined because the Phase 5 executor and Phase 6 CLI/public contracts still depend on it; it is not supported v1.0 compatibility.
- v1.0 remains an internal Phase 4 entrypoint and is intentionally absent from root exports and the CLI until the Phase 6 cutover.
- Phase 4 proposals are semantic only. Translation, verification, exact source effects, dry-run/commit parity, and undo evidence belong to Phase 5.
- The default parallel full-suite run can exceed existing Journey Map per-test timeouts under concurrent renderer load; the complete serial run is green.

## Decision

Decision: **ACCEPT Phase 4**.

Phase 5 planning is authorized. Phase 5 implementation remains gated by an accepted Phase 5 plan.
