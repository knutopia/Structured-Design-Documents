# Guided Addition Phase 4 Implementation Plan

Status: **ACCEPTED**

Phase decision: **ACCEPT**

Human approval: **ACCEPTED on 2026-08-15**

## 1. Objective And Authority

Phase 4 will implement and prove the pure Guided Addition v1.0 planner defined by the accepted [Guided Addition API v1.0 Architecture](./guided_addition_api_v1_architecture.md). It will reproduce the planner-owned portions of accepted transcripts T01–T19 and A01–A04 without rebuilding the CLI or applying v1.0 proposals to source.

Authority, in order:

1. [UX Brief for a Guided Addition API](./ux_brief_guided_addition_api.md).
2. [SDD-Add: Observed Usability Issues](./sdd-add_observed_usability_issues.md).
3. `AGENTS.md`.
4. The loaded bundle under `bundle/v0.1/`.
5. The accepted [Guided Addition UX Acceptance Transcripts](./guided_addition_ux_acceptance_transcripts.md).
6. The accepted [Guided Addition Phase 3 UX Addendum](./guided_addition_phase_3_ux_addendum.md).
7. The accepted [Guided Addition API v1.0 Architecture](./guided_addition_api_v1_architecture.md).
8. [Guided Addition Remediation Strategy](./guided_addition_remediation_strategy.md).

The rejected architecture and failed historical implementation plan remain evidence only.

## 2. Non-Negotiable Phase 4 Invariants

- `workflow_version` and planner results are v1.0 only; v1 code has no `0.1` adapter.
- The four relationship routes retain literal direction and selection order in discriminated state.
- Relationship-first never offers unconstrained existing nodes.
- Existing-node-first shows grouped named nodes before relationship disambiguation and constrains relationships by exact source type, target type, and direction.
- Every choice carries the exact typed action that advances it.
- The API supplies display-ready titles, prompts, options, chosen text, annotations, confirmations, and proposal-review lines.
- Diagram selection, change, and clearing are scoped actions inside each applicable browse page and rerender that same page.
- The display profile default comes from the bundle, never profile array order or a TypeScript literal.
- Regular relationships rank before bridge relationships; bridges remain available with the accepted plain-language annotation.
- Structural placement is expressed only as organization, sibling order, and material movement. Generic placement recommendations and edge placements do not enter v1 state or proposals.
- Zero-sibling order and one-relationship disambiguation advance automatically.
- Semantically distinct order intentions such as `before existing target` and `top-level first` remain distinct when the accepted transcript offers both, even if the controlled fixture currently resolves them to the same physical index.
- Existing declarations remain in place unless an exact accepted movement effect is confirmed.
- The final planner selection directly returns a completed proposal and review; no `review_proposal` page or `complete` action exists.
- The planner remains pure and cannot import CLI, workspace-write, journal, mutation, or proposal-application modules.

## 3. Phase Boundary

### 3.1 Included

- the narrow bundle contract needed by the accepted v1.0 planner;
- reusable read-only catalog, snapshot, ID, form, immutability, and opaque-ID foundations after coupling cleanup;
- v1.0 contract types, state, steps, actions, pages, choice content, and completed semantic proposals;
- all four route graphs and no-node launch;
- relationship-first and existing-node-first candidate construction;
- diagram-filter pages and same-page recomputation;
- progressive node and relationship forms;
- contextual semantic source-organization pages and material-effect confirmation;
- completed review content;
- transcript-level, negative, bundle-authority, state-integrity, and proposal-equivalence tests;
- a Phase 4 acceptance report.

### 3.2 Deferred

| Deferred work | Owning phase |
| --- | --- |
| Verification and application of v1.0 semantic organization | Phase 5 |
| Exact committed source proofs and dry-run/commit parity | Phase 5 |
| Rebuilding `sdd add` against display-ready pages | Phase 6 |
| Save/Cancel and concrete-warning client interaction | Phase 6 |
| Replacing public domain-service schemas and contract metadata | Phase 6 |
| Removing the quarantined rejected runtime and cutting public exports to v1.0 | Phase 6 |
| Public documentation and release/cutover claims | Phase 7 |

Phase 4 must not modify `src/cli/guidedAddition.ts`, `src/cli/program.ts`, `src/authoring/additionProposals.ts`, shared source mutation behavior, or Guided Addition contract metadata except for an unavoidable import-only refactor that preserves existing behavior. Any such need must be reported before proceeding.

## 4. Current-Code Audit And Salvage Decision

| Current component | Decision | Reason and condition |
| --- | --- | --- |
| `guidedAddition/catalog.ts` | Reuse after extension | Bundle-derived triples, forms, views, display rules, fingerprint, and ordering are sound; add the explicit default profile and diagram node scope/description input |
| `guidedAddition/snapshot.ts` and `snapshotFiles.ts` | Reuse | Read-only revision-bound structure and graph semantics already satisfy the accepted boundary |
| `guidedAddition/forms.ts` | Reuse after decoupling | ID suggestion and normalization are useful; remove reliance on caller filter state/profile-array fallback and expose primary/additional groups for v1 |
| `guidedAddition/identifiers.ts` and `immutability.ts` | Reuse | Opaque identity and immutable result behavior are route-neutral |
| `guidedAddition/contracts.ts` | Do not reuse for v1 workflow | It encodes `endpoint_strategy`, sparse selections, generic placements, `review_proposal`, and `complete` |
| `guidedAddition/planner.ts` | Replace for v1 | It implements relationship-first-only normalization and generic placement progression |
| `guidedAddition/placement.ts` | Prohibited from v1 imports | Its public abstraction is the rejected generic `stream + mode` model |
| `additionProposals.ts` | Leave unchanged in Phase 4 | v1 proposal verification and translation belong to Phase 5 |
| CLI and `program.ts` | Leave unchanged in Phase 4 | Display-ready client rebuilding belongs to Phase 6 |
| `contractMetadata.ts` | Leave unchanged in Phase 4 | Machine-readable public contract cutover belongs to Phase 6 |

### 4.1 Focused form-coupling correction

The current form builder falls back to `catalog.profiles[0]` and receives the current display filter's profile. V1 must instead use the bundle's explicit Guided Addition default consistently, regardless of whether the current browse page has a diagram filter. Diagram selection must not silently change node-field formats.

Profile-completeness enforcement remains out of scope. Bundle rules may supply input formats and allowed values, but the planner must not turn validation-profile completeness into required browsing fields.

## 5. Bundle-First Prerequisite

Before v1 planner code consumes a display profile, extend `core/authoring.yaml` with:

```yaml
guided_addition:
  default_display_profile_id: simple
```

Required changes:

1. Add the field to `AuthoringConfig`.
2. Validate the exact `guided_addition` shape.
3. Require the value to identify a declared bundle profile.
4. Require every guided diagram to resolve that profile directly or through its declared alias.
5. Add a generic read-only accessor.
6. Include the field in the guidance catalog.
7. Remove `profiles[0]` as Guided Addition's implicit default.

The accepted architecture also requires human-readable diagram descriptions. The current view records provide names and bundle-owned node scope but no prose description field. Phase 4 will not introduce a second authored field. The catalog will expose the view's `projection.include_node_types`, and the content layer will form a deterministic scope description such as `Includes Area and Place nodes.` This keeps the description bundle-derived and changes when only bundle view scope changes.

Bundle proof tests must show:

- `simple` loads as the current value;
- another declared, resolvable profile value loads and changes planner display resolution;
- missing, unknown, or unresolvable defaults fail bundle validation;
- changing only a diagram's node scope changes its returned scope description;
- changing only guided relationship display metadata changes ranking or annotation without code changes.

Stop if any required behavior cannot be expressed through these generic bundle inputs. Do not add a diagram ID, profile ID, relationship name, or node-type list to planner code.

## 6. Migration Seam During Phases 4–6

The current CLI and proposal executor compile against the rejected `0.1` contracts. Replacing those public shapes in Phase 4 would either break the repository or pull Phase 5–6 work forward. Phase 4 will therefore use a temporary, quarantined v1 module boundary:

```text
src/authoring/guidedAddition/
  sharedContracts.ts       # snapshot/ref/field/error primitives only
  v1/
    contracts.ts           # v1 workflow/proposal contracts
    content.ts             # display-ready content composition
    filters.ts             # scoped diagram filtering and ranking
    organization.ts        # semantic organization decisions
    planner.ts             # v1 state machine
```

Rules for this seam:

- v1 modules may import the shared catalog, snapshot primitives, form utilities, opaque IDs, and immutability utilities.
- v1 modules must not import legacy `planner.ts`, legacy workflow types, or `placement.ts`.
- legacy `contracts.ts` may re-export shared primitives so current Phase 5–6 dependants continue to compile; v1 workflow types are never re-exported through the legacy module.
- there is no state or proposal converter in either direction.
- `createGuidedAdditionRuntimeV1` remains an internal Phase 4 export used by focused tests; `src/index.ts` and CLI wiring remain on the quarantined legacy path until Phase 6.
- a source-boundary test must fail if v1 imports any prohibited legacy, write-side, or client module.
- the Phase 4 report must list the remaining legacy path as an explicit cutover risk, not as supported compatibility.

Phase 6 must remove the legacy workflow after its dependants are rebuilt. The coexistence is a staged implementation boundary, not part of the v1.0 contract.

## 7. Implementation Slices

Each slice must pass its focused tests before the next slice begins. Do not update snapshots or goldens to hide a mismatch.

### Slice 4.1 — Bundle Default And Catalog Inputs

Implement the bundle-first prerequisite in section 5.

Catalog output must include:

- the explicit Guided Addition default display profile;
- diagram ID, name, source order, and included node types;
- bundle-derived diagram scope description;
- exact relationship triples, authoring semantics, field support, meanings, and per-diagram display data.

Gate:

- bundle mutation tests prove behavior changes from bundle-only edits;
- invalid defaults fail before planner construction;
- no `profiles[0]` Guided Addition fallback remains.

### Slice 4.2 — Shared Primitives And V1 Contract Skeleton

Extract only route-neutral primitives needed by both temporary paths. Add the accepted v1 contract shapes, including:

- action-bearing display-ready choices;
- choice and form pages;
- explicit relationship route identity;
- route-specific discriminated progress;
- scoped browse filters;
- semantic node organization;
- material effects;
- completed proposal plus review result;
- `workflow_version: "1.0"` and `proposal_version: "1.0"`.

Gate:

- representative state, page, action, and proposal values type-check and deep-freeze;
- the v1 contract has no `endpoint_strategy`, generic placement, edge placement, `review_proposal`, or `complete` action;
- unsupported version and tampered-context tests fail deterministically;
- current legacy tests remain unchanged and green.

### Slice 4.3 — Content Composer And Entry Graph

Add the code-owned product-copy composer. It may interpolate bundle-derived and snapshot-derived content but must never classify semantics from display strings.

Implement:

- no-anchor Add a standalone node/Add a relationship page;
- anchor validation including node name;
- starting-node browse page;
- exact four-choice direction/selection-order page;
- standalone node-type browse page;
- action echo content.

Gate:

- T01 and T19 match exact accepted prompt and option order through route selection;
- ordinary copy contains no opaque IDs, reason codes, source-model terms, raw display metadata, or technical verification phases;
- each selectable choice contains its exact action and chosen text.

### Slice 4.4 — Four Relationship Routes

Implement relationship candidate construction independently for the two selection orders.

Relationship-first:

- return exact direction-relative relationship/node-type combinations;
- after selection, return only matching named existing endpoints plus the new-node option;
- carry the selected literal triple into later state.

Existing-node-first:

- return one option per valid named existing endpoint with ID, name, type, direction, and grouped relationship display;
- after node selection, recompute exact triples from both endpoint types and literal direction;
- skip disambiguation when exactly one triple remains;
- show only the exact constrained relationship choices when more than one remains.

Gate:

- T02–T07 and A04 match the accepted step order and content;
- negative tests prove the two selection orders never show each other's first page;
- an incoming route never inverts a relationship;
- bundle-only endpoint-triple changes alter the offered choices.

### Slice 4.5 — Scoped Diagram Filtering

Implement filter control as the first choice inside all six applicable browse contexts:

1. standalone node type;
2. initial starting node;
3. outgoing relationship-first;
4. incoming relationship-first;
5. outgoing existing-node-first;
6. incoming existing-node-first.

`open_diagram_filter`, `set_diagram_filter`, and `clear_diagram_filter` must preserve the same `browse_id`, route, direction, and selection order. Set/clear recomputes that page and invalidates only downstream selections no longer offered.

Gate:

- T01, T13, T14, and T19 select, change, and clear exactly as accepted;
- incoming variants have equivalent focused proof;
- node filters use bundle diagram node scope;
- relationship filters use exact per-diagram triple display metadata;
- regular options precede bridge options, which retain `Cross-diagram connection`;
- changing only the default profile or diagram metadata changes results.

### Slice 4.6 — Forms And Progressive Disclosure

Implement primary and additional field groups without making the client split one generic form.

Required behavior:

- primary node fields appear in ID, name, description order;
- collision-safe ID suggestions remain editable;
- optional node details appear only when available and accepted;
- relationship details appear only for the selected exact triple when fields are supported or required;
- blank optional values normalize away;
- submitted form actions are validated against the recomputed current page;
- a relationship with no optional fields advances without a disclosure page.

Gate:

- T03, T06, T08, T15, and T19 match the accepted field/disclosure sequence;
- bundle-only form and relationship-field mutations change the form;
- diagram filter selection does not change form constraints;
- profile completeness is not enforced during browsing.

### Slice 4.7 — Semantic Organization And Confirmation

Implement a new organization module from bundle relationship semantics, direction, endpoint existence, and snapshot structure. Do not call or copy the legacy generic placement enumerator.

It must cover:

- standalone top-level order;
- new structural target: nest/top-level, followed by sibling order only when meaningful;
- existing structural target: move/leave, followed by order and exact confirmation only for movement;
- new incoming structural source: wrap target or leave target current;
- A01 wrapper replacement at the target's former position;
- graph-consistent new non-structural outgoing and incoming placement;
- automatic keep-current for existing non-structural endpoints;
- automatic `only` order for zero siblings;
- confirmation invalidation after any upstream change.

Gate:

- T08–T12 and A01–A03 match exact organization page order and display content;
- A04 leave-current completes without movement;
- negative tests prove no existing declaration moves without the offered choice and exact confirmation;
- no v1 state, action, page, or proposal contains `stream`, source `body`, edge placement, or a generic placement reason.

### Slice 4.8 — Completion, Review, And Route Equivalence

Build a canonical v1.0 semantic proposal after the last meaningful decision and return it together with display-ready review content.

Required behavior:

- no completion action or review step;
- proposal retains route intent for traceability;
- proposal includes semantic node organization and accepted material effects;
- proposal omits low-level operations and relationship-line placement;
- review lines match the accepted review wording;
- two routes reaching the same graph addition have equivalent semantic content after excluding route trace, while their intermediate pages remain different.

Gate:

- planner-owned portions of T16–T18 return the accepted review and expose no Save/Cancel action;
- T02/T04-style and T05/T07-style convergences have equal semantic additions and distinct route traces;
- proposal identity is deterministic and changes with semantic content, revision, or bundle fingerprint;
- the pure planner import boundary remains intact.

### Slice 4.9 — Phase Verification And Report

Run the focused suites and then the full repository suite. Produce `guided_addition_phase_4_acceptance_report.md` with:

- UX invariants satisfied and violated, listed separately;
- technical invariants satisfied and violated, listed separately;
- bundle fields and their exact consumers;
- transcript/test evidence by T/A identifier;
- retained legacy quarantine and other residual risks;
- an `ACCEPT`, `REJECT`, or `BLOCKED` recommendation pending human approval.

Stop after the report. Phase 5 planning begins only after explicit Phase 4 acceptance.

## 8. Test Layout And Traceability

Add one exact controlled fixture copied from the accepted transcript source and a small action-driven v1 harness that selects returned choices by their typed action, never by array position or reconstructed semantics.

Proposed focused files:

```text
tests/fixtures/guided_addition_acceptance.sdd
tests/guidedAdditionV1Contracts.spec.ts
tests/guidedAdditionV1Routes.spec.ts
tests/guidedAdditionV1Filtering.spec.ts
tests/guidedAdditionV1Forms.spec.ts
tests/guidedAdditionV1Organization.spec.ts
tests/guidedAdditionV1Completion.spec.ts
tests/guidedAdditionV1Architecture.spec.ts
```

| Accepted evidence | Phase 4 proof |
| --- | --- |
| T01 | No-anchor standalone, filter select/change/clear, node form, top-level order, completion |
| T02–T03 | Outgoing relationship-first to existing/new target |
| T04 | Outgoing existing-node-first before exact relationship selection |
| T05–T06 | Incoming relationship-first from existing/new source |
| T07 | Incoming existing-node-first before exact relationship selection |
| T08–T09 | Structural new target nest/top-level and meaningful order |
| T10–T11 | Existing target move/leave and exact confirmation boundary |
| T12 | Direction-consistent non-structural same-level choices |
| T13–T14 | Relationship-first and node-first filter select/change/clear |
| T15 | Contextual primary/additional node and relationship forms |
| T16–T18 | Completed planner result supplies review and no Save/Cancel action; client/executor remainder deferred to Phase 6 |
| T19 | No-node relationship launch and starting-node filter |
| A01–A02 | Incoming structural new source wrap/leave paths |
| A03 | Zero-sibling automatic order |
| A04 | Single exact relationship automatic progression |

Negative matrices must additionally cover:

- all four route identities and prohibited first pages;
- exact-type/direction constraints for every endpoint pair in the controlled fixture;
- all six filter contexts, including incoming variants;
- unavailable, forged, replayed, or stale actions;
- filter invalidation without route mutation;
- effect invalidation after organization/order change;
- unsupported `0.1` state at the v1 boundary;
- prohibited imports and prohibited user-facing terminology.

## 9. Verification Commands

From the repository root:

```text
TMPDIR=/tmp pnpm run build
TMPDIR=/tmp pnpm exec vitest run tests/guidedAdditionBundle.spec.ts tests/guidedAdditionCatalog.spec.ts tests/guidedAdditionSnapshot.spec.ts tests/guidedAdditionV1Contracts.spec.ts tests/guidedAdditionV1Routes.spec.ts tests/guidedAdditionV1Filtering.spec.ts tests/guidedAdditionV1Forms.spec.ts tests/guidedAdditionV1Organization.spec.ts tests/guidedAdditionV1Completion.spec.ts tests/guidedAdditionV1Architecture.spec.ts --no-file-parallelism --reporter=dot
TMPDIR=/tmp pnpm test
```

Also rerun the unchanged legacy planner, placement, proposal, CLI, and metadata suites during the full run to prove that the temporary migration seam did not accidentally cut over later phases.

No snapshot, golden, rendered corpus, or public documentation refresh is authorized in Phase 4.

## 10. Stop Conditions

Stop and report rather than coding through the mismatch if:

- any accepted prompt sequence requires a state or action the v1 contract cannot express;
- relationship-first and existing-node-first would need to share a preselection page;
- exact existing-node constraints require client-side grouping or bundle inspection;
- diagram filtering would require a TypeScript view/profile/node/relationship list;
- a display profile default is inferred from profile order;
- generic placement or edge placement re-enters v1 state, actions, or proposals;
- a move can occur without an exact accepted effect;
- Phase 4 requires proposal application, CLI behavior, public metadata, or another later-phase responsibility;
- a golden or snapshot update would be needed to conceal an acceptance mismatch;
- focused tests pass while an accepted transcript still differs.

## 11. Acceptance Gate

Phase 4 is acceptable only when:

- every planner-owned accepted transcript step has exact action/page evidence;
- all four route orders and their negative assertions pass;
- every applicable filter context supports select/change/clear through bundle-derived actions;
- exact relationship constraint, ranking, and bridge annotation proofs pass;
- contextual organization and confirmation proofs pass;
- proposal equivalence does not collapse intermediate route intent;
- v1 has no prohibited legacy or write-side dependency;
- bundle mutation proofs demonstrate actual runtime authority;
- focused and full suites pass without acceptance-concealing artifact refreshes;
- the Phase 4 report separately lists satisfied and violated UX and technical invariants;
- the human reviewer explicitly accepts the result.

The explicit acceptance above authorizes the bounded Phase 4 implementation described by this plan.

Phase decision: **ACCEPT**
