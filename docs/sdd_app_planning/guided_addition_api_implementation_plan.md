# Guided Addition API Implementation Plan

## 1. Summary and authority

Implement the architecture in six strictly serial checkpoints. Only one checkpoint may be active at a time, and the next checkpoint may not start until the current checkpoint has passed its focused tests, full serial regression, documentation review, bundle-authority proof, and checkpoint acceptance.

Authority order:

1. `docs/sdd_app_planning/ux_brief_guided_addition_api.md`
2. `docs/sdd_app_planning/guided_addition_api_architecture.md`
3. `bundle/v0.1/`
4. `AGENTS.md` and `docs/toolchain/architecture.md`
5. Current code as implementation evidence only

The architecture and UX brief remain unchanged. No planner, mutation, helper, or CLI behavior may override their decisions.

Current audit baseline:

- `manifest.yaml` has no `core.authoring`; bundle types and loader do not model authoring guidance.
- `loadBundle(...)` performs only shallow manifest validation and no cross-artifact validation.
- Endpoint triples and `required_edge_property` exist in `contracts.yaml`, but relationship authoring roles and complete supported edge-field metadata do not.
- View rendering behavior exists in `views.yaml`, but endpoint-triple guidance roles, visibility rules, profile aliases, and predicates do not.
- Strict and permissive profiles duplicate `prefix_map`; `idPrefixTypeCoupling` consumes the inline copies.
- `inspectDocumentText(...)` and `compileSource(...)` provide the required snapshot ingredients.
- Existing mutation machinery preserves source and supports temporary-handle remapping, but `move_nested_node_block` only reorders within one parent. Cross-stream reparenting is absent.
- Shared authoring/helper contracts are manually described in `contracts.ts` and `contractMetadata.ts`; no guided state, proposal, or proposal-executor metadata exists.
- `sdd-helper` has no guided commands. Per the selected scope, this milestone adds domain metadata only and leaves new helper/MCP commands deferred.
- The human `sdd` CLI has no interactive authoring I/O, workspace integration, Save/Cancel flow, or proposal executor.
- Baseline verification on 2026-08-11 passed `TMPDIR=/tmp pnpm run build` and 170 architecture-relevant tests across 10 files.
- Preserve unrelated existing worktree changes in `AGENTS.md`, `progress.md`, and the deleted service-blueprint-local `AGENTS.md`.

Global invariants:

- Bundle data controls choices, forms, formats, relationship direction, display classification, ID suggestions, and placement inputs.
- Guidance remains pure, stateless, serializable, and read-only.
- The planner never imports filesystem-write, mutation, journal, workspace-write, helper, or CLI modules.
- A completed proposal contains semantic content, not source text or `ChangeOperation[]`.
- Only `executeChangeOperations(...)` serializes or persists `.sdd` changes.
- Incoming relationships remain literal; no inverse is inferred.
- Profile completeness is not enforced during choice browsing.
- Reparenting requires confirmation bound to the exact revision, bundle fingerprint, relationship, target, old parent, new parent, and placement.
- No snapshots, goldens, or rendered corpus artifacts may be refreshed to conceal regressions.

## 2. Bundle population decisions

### Authoring artifact

Add optional `manifest.core.authoring` and declare it in the current v0.1 manifest as `core/authoring.yaml`. `Bundle.authoring` remains optional for compatibility; guided APIs return `guided_addition.unsupported_bundle` when it is absent.

The new artifact contains exactly:

- `version`
- `node_id_suggestions.sequence_policy`
- `node_id_suggestions.minimum_digits`
- `node_id_suggestions.prefix_by_type`
- `node_forms.common_fields`
- `node_forms.by_type`
- `placement_policies.default`

Use:

- `sequence_policy: max_numeric_plus_one`
- `minimum_digits: 3`
- Prefixes: `Outcome=O`, `Metric=M`, `Opportunity=OP`, `Initiative=I`, `Stage=G`, `Step=J`, `Area=A`, `Place=P`, `ViewState=VS`, `Component=C`, `State=ST`, `Event=E`, `Process=PR`, `SystemAction=SA`, `DataEntity=D`, `Policy=PL`.
- Primary common fields: `node_id`, `name`, and property `description`.
- All other known properties are advanced and optional in the guided flow.

Per-type advanced properties:

| Type | Properties |
| --- | --- |
| Outcome | owner, time_horizon, scope, stakeholder |
| Metric | owner, definition, source, cadence, metric_type |
| Opportunity | owner, evidence, segment, severity |
| Initiative | owner, non_goals, status |
| Stage | owner, order_index |
| Step | owner, actor, intent, success_criteria, opportunity_refs, kind |
| Area | owner, scope |
| Place | owner, surface, route_or_key, access, entry_points, primary_nav |
| ViewState | owner, place_id, data_required |
| Component | owner, responsibility, inputs, outputs |
| State | owner, scope_id, invariants |
| Event | owner, source_kind, payload_schema |
| Process | owner, visibility, sla |
| SystemAction | owner, system_name, action, failure_modes |
| DataEntity | owner, fields, system_of_record |
| Policy | owner, policy_owner, enforcement_point |

Each field descriptor records `source`, optional `property`, `prominence`, and bundle-owned authoring hints. Formats, patterns, enums, and reference target types are resolved from syntax and profile/contract rule metadata rather than copied into `authoring.yaml`.

Placement values are exactly:

```yaml
fallback: last
outgoing_sequence: after_anchor
incoming_sequence: before_anchor
structural_new_target: nested_last
structural_existing_target: reparent_with_confirmation
edge_in_source_body: last
edge_to_name_hint: target_name
```

### Relationship authoring metadata

Every current relationship receives `authoring.graph_role`, `authoring.source_representation`, and `authoring.source_organization`. All use `source_representation: edge_line`.

| Relationships | graph_role | source_organization |
| --- | --- | --- |
| CONTAINS, COMPOSED_OF | structural | nest_target_under_source |
| PRECEDES | ordering | same_level |
| NAVIGATES_TO, TRANSITIONS_TO | behavioral | same_level |
| EMITS | behavioral | unconstrained |
| MEASURED_BY, SUPPORTS, ADDRESSES, IMPLEMENTED_BY, REALIZED_BY, INSTRUMENTED_AT | reference | unconstrained |
| DEPENDS_ON, CONSTRAINED_BY | dependency | unconstrained |
| READS, WRITES, BINDS_TO | data | unconstrained |

Add one generic `edge_field_support` rule per relationship. Explicit support is:

- `PRECEDES`: event, guard, effect
- `NAVIGATES_TO`: event, guard
- `TRANSITIONS_TO`: event, guard, effect
- `BINDS_TO`: property `field`
- All other relationships: explicit empty annotation/property lists

`BINDS_TO.field` remains required only through the existing `required_edge_property` rule.

### Canonical profile reference

Replace the duplicated strict/permissive `prefix_map` fields with:

```yaml
bundle_refs:
  prefix_map:
    artifact: authoring
    selector: node_id_suggestions.prefix_by_type
```

Add a generic `BundleFieldReference` type and `resolveProfileRuleField(...)` runtime. Retain inline fields only for older bundles; reject a rule that declares both the inline field and its reference.

### View guidance matrix

Every authoring-enabled view must explicitly contain all 42 allowed endpoint triples, producing 252 view/triple entries. Runtime code has no missing-entry fallback.

Each entry contains:

- `from`
- `type`
- `to`
- `role`
- `display_by_profile`

Every view declares `profile_aliases.permissive: strict`. Simple and strict rules are explicit; aliases must be acyclic and target declared profiles.

Initial role decisions:

- IA Place Map primary: `Area CONTAINS Place`, `Place CONTAINS Place`, `Place NAVIGATES_TO Place`.
- Journey Map primary: `Stage CONTAINS Step`, `Step PRECEDES Step`.
- Scenario Flow primary: `Step PRECEDES Step`, `Step REALIZED_BY Place`, `Step REALIZED_BY ViewState`, `Place NAVIGATES_TO Place`, `ViewState TRANSITIONS_TO ViewState`.
- Outcome-Opportunity primary: `Outcome MEASURED_BY Metric`, `Opportunity SUPPORTS Outcome`, `Initiative ADDRESSES Opportunity`.
- Service Blueprint primary: both `PRECEDES` triples in scope, `Step REALIZED_BY Process`, both in-scope `DEPENDS_ON` triples, both in-scope `CONSTRAINED_BY` triples, `READS`, and `WRITES`.
- UI Contracts primary: `Place CONTAINS ViewState`, both `COMPOSED_OF` triples, and `ViewState TRANSITIONS_TO ViewState`.
- UI Contracts supporting: `Place CONTAINS Place`, `Component CONTAINS Component`, `State TRANSITIONS_TO State`, in-scope `EMITS`, in-scope `DEPENDS_ON`, and `Component BINDS_TO DataEntity`.
- All remaining entries are explicitly `bridge`.

Display decisions:

- Hierarchy relationships rendered through containment use `presence: structural`, `label: not_applicable`.
- Outcome primary connectors have visible labels in simple and strict.
- Outcome `IMPLEMENTED_BY` and `INSTRUMENTED_AT` bridge triples are hidden in simple and annotations with visible labels in strict.
- Service Blueprint secondary connectors are visible with hidden labels in simple and visible labels in strict; `PRECEDES` labels remain hidden.
- Scenario `Step PRECEDES Step` is a connector with hidden simple label and visible strict label; other primary connectors have no displayed relationship label.
- UI supporting D* relationships use ordered simple rules: hide when the document has a `ViewState`, otherwise show the connector; strict always shows the connector.
- UI `Place CONTAINS Place` and `Component CONTAINS Component` remain hidden in both profiles.
- Other bridge relationships remain hidden in both profiles.
- `document_has_node_type` is the only v1 predicate, and each rule list ends with an unconditional rule.

## 3. Serial checkpoints

### Checkpoint 1 — Bundle contract, validation, and authority

Dependencies and scope:

- No prior checkpoint.
- This is the mandatory gate for all subsequent work.
- Add bundle expressiveness, typed loading, cross-reference validation, canonical profile references, and read-only bundle guidance accessors.
- Do not add snapshots, workflow state, planner behavior, proposal execution, or CLI code.

Generic consumers:

- `loadBundle(...)` loads optional `core.authoring`.
- `validateLoadedBundle(...)` checks complete node/form/prefix coverage; relationship tokens and endpoint triples; 252 view/triple entries; profiles and aliases; supported predicates; property references; edge-field rules; and bundle references.
- `resolveProfileRuleField(...)` supplies the canonical prefix map to `idPrefixTypeCoupling`.
- Read-only accessors expose allowed triples, ID suggestion inputs, relationship authoring semantics, resolved display rules, and placement policy inputs. Checkpoint 2 must consume these accessors rather than rereading YAML shapes.

Affected areas:

- `bundle/v0.1/manifest.yaml`, new `core/authoring.yaml`, contracts, views, strict/permissive profiles
- `src/bundle/types.ts`, `loadBundle.ts`, and new validation/reference/accessor modules
- `src/validator/ruleExecutors.ts` and validator tests
- Explanatory bundle and view documentation

Public contract changes:

- Add optional `BundleManifest.core.authoring` and `Bundle.authoring`.
- Add typed authoring, relationship-authoring, guided-view, predicate, display, and bundle-reference contracts.
- Add a deterministic bundle-validation error carrying sorted `bundle` diagnostics.
- Older bundles without authoring metadata remain usable for compile, validation, projection, and rendering.

Focused tests:

```text
TMPDIR=/tmp pnpm exec vitest run \
  tests/guidedAdditionBundle.spec.ts \
  tests/validate.spec.ts \
  tests/parserContractMutationProof.spec.ts \
  tests/render_profile_display.spec.ts \
  tests/diagramTypeNodeEdgeReference.spec.ts \
  --no-file-parallelism --reporter=dot
```

Bundle-only proofs:

- Mutating one `allowed_endpoints` entry changes the allowed-triple accessor.
- Mutating one canonical prefix changes validator prefix diagnostics without profile edits.
- Mutating one display rule changes profile/conditional resolution.
- Mutating one placement-policy field changes the returned placement input.
- Removing authoring metadata leaves ordinary bundle consumers working but makes guided support unavailable.
- Alias cycle, missing profile, unknown predicate, unknown token, missing form/prefix, duplicate triple, and incomplete display coverage are rejected.

Acceptance and stop conditions:

- Accept only when current v0.1 coverage is complete and the strict/permissive prefix maps have one canonical source.
- Stop if any needed behavior cannot be expressed without a TypeScript relationship, view, profile, prefix, property, or visibility fallback.
- Stop if parser/compiler/validator/projection/render snapshots change.
- Checkpoint 2 remains blocked until this checkpoint is accepted.

Documentation:

- Update `docs/toolchain/architecture.md`.
- Synchronize the relevant v0.1 authoring and endpoint explanatory definitions.
- Update hidden-edge and node/edge references only after the bundle matrix passes its proofs.
- Do not change the architecture or UX authority documents.

Checkpoint report and implementation log:

- Record every new bundle field, its generic consumer, and its focused mutation proof.
- Record 16/16 node prefix and form coverage, 17/17 relationship semantics, 42 allowed triples, and 252 view/triple entries.
- Report satisfied invariants, violated invariants, unresolved bundle gaps, exact commands/results, documentation changes, and whether Checkpoint 2 is unblocked.

### Checkpoint 2 — Fingerprint, catalog, and document snapshot

Dependencies and scope:

- Requires accepted Checkpoint 1.
- Implement deterministic bundle fingerprinting, the immutable guidance catalog, and source-text snapshot construction.
- Do not implement workflow transitions, proposal completion, mutations, or CLI prompts.

Generic consumers:

- `computeBundleFingerprint(bundle)` hashes canonical recursively key-sorted JSON containing manifest, vocab, syntax, both schemas, contracts, views, profiles in manifest order, and authoring configuration; paths are excluded.
- `createGuidanceCatalog(bundle)` indexes the Checkpoint 1 accessors by node type, endpoint triple, view/profile, and relationship order.
- `createGuidedDocumentSnapshot(bundle, {document_ref, path?, text})` reuses `inspectDocumentText(...)` for structure and `compileSource(...)` for graph semantics.
- Parse or compile errors raise `guided_addition.document_unavailable`; warnings remain attached.
- Snapshot indexes remain private and are never serialized into state.

Affected areas:

- `src/authoring/guidedAddition/contracts.ts`
- `src/authoring/guidedAddition/catalog.ts`
- `src/authoring/guidedAddition/snapshot.ts`
- Bundle fingerprint/canonical JSON utilities and root public exports

Public contract changes:

- Export `GuidedDocumentSnapshot`, `GuidedExistingNode`, `GuidedExistingEdge`, fingerprint helpers, catalog construction, and snapshot construction.
- Add an `authoring` diagnostic stage for guided-domain failures and reflect it in machine-readable diagnostic metadata.
- File-backed snapshot adapters set both `document_ref` and `path` to the normalized repo-relative document path.

Focused tests:

```text
TMPDIR=/tmp pnpm exec vitest run \
  tests/guidedAdditionCatalog.spec.ts \
  tests/guidedAdditionSnapshot.spec.ts \
  tests/authoringInspect.spec.ts \
  tests/compile.spec.ts \
  --no-file-parallelism --reporter=dot
```

Bundle-only proofs:

- Mutating each included artifact changes the fingerprint; changing `rootDir` or `manifestPath` does not.
- Endpoint, role, display, field-support, and placement mutations change catalog records without code changes.
- Reordering object keys does not change the fingerprint; array order remains significant.

Acceptance and stop conditions:

- Same bundle/source produces byte-identical fingerprints and snapshots.
- Snapshot edges preserve literal direction and source order.
- Duplicate IDs or compile failure block snapshot creation.
- Validation/profile completeness is never run as a snapshot prerequisite.
- Stop if catalog or snapshot code imports mutation, journal, CLI, helper, or filesystem-write modules.

Documentation and reporting:

- Document fingerprint contents, path exclusions, snapshot construction, and error boundary in `docs/toolchain/architecture.md`.
- Record the canonical fingerprint input shape, repeat-run fingerprint, snapshot counts/order, stale revision/fingerprint test results, import-boundary proof, exact regression results, and whether Checkpoint 3 may start.

### Checkpoint 3 — Planner, forms, filtering, placement, and proposals

Dependencies and scope:

- Requires accepted Checkpoint 2.
- Implement the complete pure guided workflow: standalone node, incoming/outgoing relationship, existing/new endpoint, filters, forms, ID suggestions, edge fields, placement review, effect confirmation, and proposal completion.
- No filesystem access or mutation execution.

Generic consumers:

- `createGuidedAdditionRuntime(bundle)` uses only the immutable catalog.
- `begin(snapshot, request)` and `advance(snapshot, state, action)` implement the architecture’s exact state, step, action, and result unions.
- Each advance rechecks document revision and bundle fingerprint, recomputes offered options, and rejects actions not currently offered.
- Syntax/schema metadata validates IDs and names; contract/profile rule metadata supplies field formats and required edge properties.
- View filtering uses explicit role/display entries and profile aliases; bridge entries remain unless excluded.
- Placement uses relationship authoring semantics plus `placement_policies.default`.

Deterministic identifiers:

- Fingerprints: `bnd_<sha256>`
- Relationship choices: `relc_<sha256>`
- Node-type options: `ntc_<sha256>`
- Endpoint options: `epc_<sha256>`
- Placement recommendations: `plc_<sha256>`
- Confirmable effects: `eff_<sha256>`
- Proposals: `addp_<sha256>`

Clients treat all identifiers as opaque.

Placement alternatives are deterministic and bounded:

- Recommended placement first.
- Append-last at the same relevant level next.
- Same-level first next.
- Before/after the anchor only when the anchor is in that destination stream.
- Structural recommendations additionally offer same-level append so a user may avoid reparenting.
- Duplicate equivalent placements are removed.
- Selecting a reparenting placement requires confirmation; selecting a non-reparenting alternative clears that effect.

ID suggestions follow the architecture algorithm exactly, including suffixed numeric IDs and collision retries.

Affected areas:

- `src/authoring/guidedAddition/planner.ts`
- `src/authoring/guidedAddition/placement.ts`
- Guided contracts/catalog and root exports
- Pure import-boundary tests

Public contract changes:

- Export the architecture’s `GuidedAdditionRuntime`, requests, state, filters, choices, fields, steps, actions, placement contracts, effects, proposal types, and diagnostics.
- Successful transitions return only the documented step/complete result union.
- Expected rejected transitions raise a guided-domain error containing stable sorted diagnostics and the unchanged caller state; they never mutate state or source.
- V1 reserves only `node_1` and `edge_1`.

Focused tests:

```text
TMPDIR=/tmp pnpm exec vitest run \
  tests/guidedAdditionPlanner.spec.ts \
  tests/guidedAdditionPlacement.spec.ts \
  tests/guidedAdditionCatalog.spec.ts \
  tests/guidedAdditionArchitecture.spec.ts \
  --no-file-parallelism --reporter=dot
```

Required scenarios:

- Standalone node and all four incoming/outgoing existing/new routes.
- Existing-only omission when no matching endpoint exists.
- Primary/supporting/bridge ordering and explicit role/presence filters.
- Simple, strict, permissive alias, and conditional UI display behavior.
- Empty, sequential, suffixed, collision, edited-valid, invalid, and duplicate IDs.
- Required `BINDS_TO.field`; optional event/guard/effect fields.
- Structural nesting, sequence placement, same-source target order, fallback append.
- New-parent/existing-child confirmation and confirmation invalidation.
- Stale state, unavailable action, deterministic proposal bytes and IDs.
- No I/O or mutation imports.

Bundle-only proofs:

- Endpoint mutation changes offered relationship choices.
- Prefix/width mutation changes suggested IDs.
- Display/role mutation changes metadata, order, and filtering.
- Placement-policy or relationship-authoring mutation changes recommendations/effect requirements.
- Edge-field-support and required-property mutations change forms/completion gates.

Acceptance and stop conditions:

- Repeated transitions against identical inputs are byte-identical.
- No invalid or unavailable choice can advance.
- No profile-completeness rule becomes a browsing requirement.
- Proposal relationship and edge endpoints match exactly.
- Stop if a relationship name, node type, view, profile, prefix, field, or display fallback appears in planner code.
- Stop if any workflow transition performs I/O or creates authoring operations.

Documentation and reporting:

- Add the pure guided-domain contract and placement behavior to `docs/toolchain/architecture.md`; do not publish the CLI as available yet.
- Record each route’s terminal proposal shape, proposal ID determinism, filter/display proof, placement/effect proof, import audit, exact tests, and any unsupported bundle case.

### Checkpoint 4 — Reparenting primitive and proposal executor

Dependencies and scope:

- Requires accepted Checkpoint 3.
- Add cross-stream node-block reparenting and the only write-side proposal adapter.
- Preserve existing operations and authoring-intent behavior.

Generic consumers:

- `reparent_node_block` operates on the mutation engine’s source-preserving document model.
- It supports top-level↔nested and nested↔different-parent moves, validates destination stream/anchors, prevents self/descendant cycles, and rebases indentation while preserving subtree content, comments, blank lines, and trailing comments.
- `applyAdditionProposal(...)` verifies revision, fingerprint, references, endpoint triple, field requirements, proposal ID, semantic-edge equality, placements, and confirmations.
- Translation order is nodes, properties, edges, then reparenting.
- The executor invokes `executeChangeOperations(...)` once and never emits SDD strings.

Affected areas:

- `src/authoring/contracts.ts`
- `src/authoring/mutations.ts`
- New `src/authoring/additionProposals.ts`
- Helper apply request validation and existing contract metadata for the new low-level operation
- Authoring mutation/undo/helper regression tests

Public contract changes:

- Add `ReparentNodeBlockOp` to `ChangeOperation`.
- Add `apply_addition_proposal` to `ChangeSetOrigin`.
- Make ordering summaries discriminated; reparent summaries contain `old_parent_handle`, `new_parent_handle`, `old_index`, and `new_index`.
- Add `ApplyAdditionProposalArgs/Result` and `applyAdditionProposal(...)`.
- The current file executor requires `proposal.document_context.path`; future storage adapters may resolve `document_ref` differently.
- Expected stale/invalid proposal failures return a rejected `sdd-addition-proposal-result`, not an exception.
- Guided confirmation is checked here; the low-level reparent operation remains confirmation-agnostic.

Focused tests:

```text
TMPDIR=/tmp pnpm exec vitest run \
  tests/reparentNodeBlock.spec.ts \
  tests/additionProposals.spec.ts \
  tests/authoringMutations.spec.ts \
  tests/authoringOrderingAndUndo.spec.ts \
  tests/authoringIntents.spec.ts \
  tests/helperCli.spec.ts \
  --no-file-parallelism --reporter=dot
```

Required scenarios and bundle proofs:

- Reparent top-level to nested, nested to another parent, and nested to top-level.
- Preserve the full subtree, properties, edges, comments, blank lines, and relative indentation.
- Reject self, descendant, stale handle/revision, invalid destination anchor, and no-longer-current confirmation.
- New parent plus existing child applies the structural edge and move exactly once; temporary new-parent handle remapping works.
- Dry-run and commit candidate source/summary parity, excluding mode/change-set identifiers.
- Journaling, undo, created-target mappings, stale proposal/fingerprint rejection, and relationship/proposal-edge mismatch rejection.
- Changing structural authoring semantics changes reparenting; changing required edge-property metadata changes acceptance; changing the prefix or endpoint triple invalidates a proposal through fingerprint or semantic verification.

Acceptance and stop conditions:

- Existing mutation tests remain byte-stable except for additive summary typing.
- Source preservation must be demonstrated with explicit before/after text assertions.
- Stop on data loss, duplicate edge insertion, confirmation bypass, dry-run/commit candidate drift, or direct serialization in `additionProposals.ts`.
- Do not proceed to CLI while any proposal can bypass the shared mutation executor.

Documentation and reporting:

- Update toolchain authoring architecture, explanatory authoring definitions, helper apply documentation, and metadata for `reparent_node_block`; do not add guided helper commands.
- Record source evidence, parent/index summaries, cycle rejections, operation order, confirmation proof, parity, journaling/undo, and exact tests.

### Checkpoint 5 — Interactive `sdd add`

Dependencies and scope:

- Requires accepted Checkpoint 4.
- Add `sdd add <document_path> [--node <node_id>] [--view <view_id>] [--bundle <manifest>]`.
- Keep the CLI a presentation and Save/Cancel adapter only.

CLI behavior:

- Discover the repo root, normalize the document to a repo-relative workspace path, load the bundle and source once, and create one initial snapshot.
- Resolve `--node` exactly; reject missing/ambiguous anchors.
- Validate `--view` through bundle-derived values.
- Use friendly four-route operation labels for anchored flows but send only normalized direction/endpoint strategy.
- Offer filter changes through planner actions, not local filtering.
- Prompt primary fields first; advanced node/edge fields require explicit disclosure.
- Show bundle-derived descriptions, role, presence, label status, and bridge annotation.
- Review placement and route reparent refusal to an alternative placement or Cancel.
- Show a plain-language proposal summary.
- Cancel exits successfully without invoking the executor.
- Save runs `applyAdditionProposal(..., mode: dry_run, validate_profile: simple)`.
- Error diagnostics block commit; warnings are shown and require acceptance.
- Final acceptance commits the identical proposal. Revision or fingerprint drift returns a stale rejection and requires restarting the command.

Implementation structure:

- Add an injected prompt adapter using `readline/promises` in production.
- Add planner, snapshot, workspace, proposal-executor, and prompt dependencies to `CliDeps`.
- Keep labels, menu layout, formatting, and exit codes in CLI modules; keep all semantic validation in shared domain code.
- Exit `0` for successful commit or explicit Cancel, `1` for runtime/domain failure, and Commander’s existing usage code for invalid arguments.

Affected areas:

- `src/cli/program.ts`
- New `src/cli/guidedAddition.ts` or equivalent thin presentation module
- CLI dependency injection and tests
- Human CLI documentation

Public contract changes:

- New public `sdd add` command.
- No JSON contract is defined by its terminal output.
- No helper or MCP commands are added.

Focused tests:

```text
TMPDIR=/tmp pnpm exec vitest run \
  tests/guidedAdditionCli.spec.ts \
  tests/cli.spec.ts \
  tests/additionProposals.spec.ts \
  tests/helperCli.spec.ts \
  --no-file-parallelism --reporter=dot
```

Required scenarios and bundle proofs:

- Standalone, four anchored routes, view filter, advanced fields, existing/new endpoint.
- Save, Cancel, warning acceptance, confirmation, confirmation refusal, alternate placement.
- Dry-run rejection, stale revision between review and commit, invalid anchor/view, unsupported bundle, invalid document.
- Cancel performs no executor call; commit uses the exact reviewed proposal object.
- Source/import assertions show no bundle-file inspection, endpoint logic, placement policy, or mutation translation in CLI code.
- Bundle descriptions/roles/display ordering, prefix, and placement policy mutations change presentation only through planner results.

Acceptance and stop conditions:

- The CLI remains usable with injected deterministic I/O.
- Save/Cancel and confirmation ownership remain client-side.
- Stop if CLI code reads contracts/views/authoring bundle structures directly, constructs raw SDD, builds `ChangeOperation[]`, or remembers confirmation.
- Helper command inventory must remain unchanged.

Documentation and reporting:

- Update `docs/doc_site/sdd_cli_tools/index.md`, `docs/toolchain/architecture.md`, and relevant README quick-start material.
- Document `simple` as dry-run validation feedback, stale-proposal restart behavior, and explicit reparent confirmation.
- Record prompt transcripts, Save/Cancel calls, proposal identity, stale rejection, boundary audit, docs build, and regressions.

### Checkpoint 6 — Shared machine-readable domain metadata only

Dependencies and scope:

- Requires accepted Checkpoint 5 and stable domain contracts.
- Add machine-readable metadata for shared guided-domain APIs.
- Do not add helper or MCP commands in this milestone.

Metadata changes:

- Extend contract subject IDs with `domain.service.*` and surface kind with `domain_service`.
- Add subjects:
  - `domain.service.guided_addition.begin`
  - `domain.service.guided_addition.advance`
  - `domain.service.addition_proposal.apply`
- Add shapes for snapshot, begin request, state, action, result, completed proposal, apply args, and apply result.
- Add bundle bindings for view IDs, display-profile IDs, node types, validate profiles, and projection views.
- Add constraint kinds for same revision, same bundle fingerprint, currently offered opaque option, exact confirmation, and proposal relationship/edge consistency.
- Add continuation metadata for caller-carried state, completed-proposal handoff, and dry-run-to-commit reuse of the same proposal.
- Keep `sdd-helper capabilities` unchanged.
- Make the existing helper `contract` command reject non-helper subjects so domain metadata remains library-visible rather than becoming an accidental helper adapter.

Affected areas:

- `src/authoring/contracts.ts`
- `src/authoring/contractMetadata.ts`
- `src/authoring/contractResolution.ts`
- Contract index/accessor exports
- Helper contract guard and metadata tests

Public contract changes:

- Add domain service subjects and JSON Schema 2020-12 descriptors.
- Preserve every existing helper subject, shape, order, invocation, result kind, request-body contract, and exit behavior.
- New helper/MCP adapters require a later implementation plan.

Focused tests:

```text
TMPDIR=/tmp pnpm exec vitest run \
  tests/guidedAdditionContractMetadata.spec.ts \
  tests/authoringContractMetadata.spec.ts \
  tests/authoringContractResolution.spec.ts \
  tests/helperCli.spec.ts \
  tests/helperCli.integration.spec.ts \
  --no-file-parallelism --reporter=dot
```

Bundle-only proofs:

- Bundle-resolved domain detail reflects changed view/profile/node-type values.
- Static detail contains references only and loads no bundle.
- Guided choice IDs and proposal-local IDs remain opaque rather than becoming bundle-value bindings.

Acceptance and stop conditions:

- Every public guided type is represented without weakening existing schemas.
- Helper discovery output remains byte-for-byte compatible except for unrelated pre-existing drift.
- Stop if metadata duplicates semantic endpoint, visibility, field, prefix, or placement values.
- Stop if a new helper/MCP execution path appears in this checkpoint.

Documentation and reporting:

- Document domain metadata in `docs/toolchain/architecture.md`.
- Update helper documentation only to clarify that guided domain metadata does not add guided helper commands; leave skill behavior unchanged.
- Record subjects, shapes, bindings, constraints, continuations, schema validation, bundle-resolution proof, unchanged helper inventory, and the adapter deferral.

## 4. Regression, reporting, and completion

After each checkpoint, run serially:

```text
TMPDIR=/tmp pnpm run build
TMPDIR=/tmp pnpm exec vitest run --no-file-parallelism --reporter=dot
TMPDIR=/tmp pnpm docs:build
git diff --check
```

If documentation is untouched in a checkpoint, `docs:build` may be recorded as not applicable; all implementation checkpoints otherwise require it.

Append an `Implementation Log` section to this plan with one entry per checkpoint. Each entry must contain:

- date and commit or working-tree identifier;
- exact implemented scope and explicitly deferred work;
- bundle field → generic consumer → focused test → mutation-proof table;
- exact commands and pass/fail counts;
- satisfied invariants;
- violated invariants;
- residual risks;
- documentation updated;
- snapshot/golden audit;
- unrelated-worktree preservation audit;
- checkpoint acceptance decision and next-checkpoint authorization.

Each user-facing checkpoint report must reproduce the satisfied invariants, violated invariants, residual risks, exact verification results, and next gate. A green test suite does not authorize the next checkpoint when a bundle-authority or architectural invariant still fails.

The milestone is complete only when:

- all six checkpoints are accepted in order;
- current bundle data controls all guided behavior;
- all required bundle-only proofs pass;
- guidance is pure and read-only;
- proposal execution exclusively uses shared mutation machinery;
- reparenting is confirmation-bound and source-preserving;
- `sdd add` owns Save/Cancel without owning semantics;
- machine-readable domain metadata is complete;
- no new helper/MCP command was introduced;
- full serial tests, build, docs build, and whitespace checks pass without snapshot normalization.

## Implementation Log

Checkpoint entries are appended only after the checkpoint has completed its focused verification, full serial regression, documentation review, bundle-authority proofs, and acceptance assessment.

### 2026-08-11 — Checkpoint 1: Bundle contract, validation, and authority

Working-tree identifier: uncommitted Checkpoint 1 implementation on the current working tree. No commit was created.

Implemented scope:

- Added optional `manifest.core.authoring`, typed `Bundle.authoring`, and current v0.1 `core/authoring.yaml` data.
- Added complete node prefix/form coverage, relationship authoring semantics, explicit edge-field support, canonical profile bundle references, and the complete guided view matrix.
- Added generic bundle-reference resolution, deterministic cross-artifact validation, read-only guided bundle accessors, and root public exports.
- Routed strict/permissive prefix validation through the canonical authoring prefix map.
- Added focused bundle-authority, compatibility, completeness, invalid-bundle, conditional-display, and mutation-proof tests.
- Updated explanatory toolchain, authoring, endpoint, hidden-edge, and node/edge documentation.

Explicitly deferred:

- Checkpoint 2 fingerprinting, catalog construction, and document snapshots.
- All workflow/planner state, forms runtime, proposal construction, placement planning, mutations, proposal execution, interactive CLI behavior, and guided domain metadata.
- Any new helper or MCP command.

Coverage recorded:

- Node prefix coverage: 16/16.
- Node form coverage: 16/16.
- Relationship authoring semantics and edge-field support: 17/17.
- Allowed endpoint triples: 42.
- Explicit guided view/triple records: 252/252 across six views.
- Canonical prefix maps: one authoring source referenced by strict and permissive rules; no inline current-bundle copies.

Bundle field → generic consumer → focused test → mutation proof:

| Bundle field | Generic consumer | Focused test | Bundle-only proof |
| --- | --- | --- | --- |
| `manifest.core.authoring` / `Bundle.authoring` | `loadBundle(...)`, `hasGuidedAdditionSupport(...)` | `guidedAdditionBundle.spec.ts` older-bundle case | Removing authoring metadata while restoring legacy inline profile data leaves compile/validate usable and makes guided access report `guided_addition.unsupported_bundle`. |
| `node_id_suggestions.prefix_by_type` | `getNodeIdSuggestionInputs(...)`, `resolveProfileRuleField(...)`, `idPrefixTypeCoupling` | canonical-prefix and prefix-diagnostic cases | Changing `Place` from `P` to `PX` changes strict validator diagnostics without a profile edit. |
| `node_id_suggestions.sequence_policy` / `minimum_digits` | `getNodeIdSuggestionInputs(...)`, `validateLoadedBundle(...)` | coverage/shape case | Accessor returns the bundle values; invalid sequence or width data is rejected rather than defaulted. |
| `node_forms.common_fields` / `by_type` | `validateLoadedBundle(...)` | complete coverage and invalid form cases | Missing a node form or property coverage produces deterministic bundle diagnostics. |
| `placement_policies.default.*` | `getPlacementPolicyInputs(...)` | placement mutation case | Changing only `fallback` changes the returned placement input; runtime supplies no fallback. |
| `relationships[].allowed_endpoints` | `listAllowedEndpointTriples(...)`, `validateLoadedBundle(...)` | endpoint mutation/invalid token cases | Changing one endpoint changes the accessor; unknown tokens and duplicate triples are rejected. |
| `relationships[].authoring.*` | `getRelationshipAuthoringSemantics(...)`, `validateLoadedBundle(...)` | relationship semantics coverage case | Removing semantics is rejected; accessor behavior comes from the relationship record. |
| `edge_field_support` | `getRelationshipEdgeFieldSupport(...)`, `validateLoadedBundle(...)` | complete edge-field matrix and missing-rule cases | PRECEDES/NAVIGATES_TO/TRANSITIONS_TO/BINDS_TO support resolves from rules; missing support or unsupported required properties are rejected. |
| `profiles[].rules[].bundle_refs` | `resolveBundleFieldReference(...)`, `resolveProfileRuleField(...)` | canonical-reference and inline-conflict cases | Unresolved references and inline/reference conflicts are rejected. |
| `views[].conventions.guided_addition.relationships` | `listGuidedViewRelationships(...)`, `resolveGuidedRelationshipDisplay(...)` | role matrix, display mutation, conditional UI cases | Changing one display rule changes resolution; missing/duplicate coverage has no runtime fallback and is rejected. |
| `profile_aliases` / `document_has_node_type` | display resolver and bundle validator | alias, conditional display, invalid alias/predicate cases | `permissive` resolves through `strict`; alias cycles, missing targets, unknown predicates, and non-terminal conditionals are rejected. |

Exact verification:

- `TMPDIR=/tmp pnpm run build` — passed, TypeScript compilation exit 0.
- `TMPDIR=/tmp pnpm exec vitest run tests/guidedAdditionBundle.spec.ts tests/validate.spec.ts tests/parserContractMutationProof.spec.ts tests/render_profile_display.spec.ts tests/diagramTypeNodeEdgeReference.spec.ts --no-file-parallelism --reporter=dot` — 5/5 files passed; 37/37 tests passed.
- `TMPDIR=/tmp pnpm exec vitest run --no-file-parallelism --reporter=dot` — 80/80 files passed; 714/714 tests passed in 345.90 seconds.
- `TMPDIR=/tmp pnpm docs:build` — passed; VitePress build completed in 10.98 seconds.
- `git diff --check` — passed with no whitespace errors.

Satisfied invariants:

- Bundle data now expresses and controls current guided choices, form inventory, relationship authoring semantics, supported edge fields, display classification, ID suggestion inputs, and placement inputs.
- The current prefix map has one bundle authority and changes validator behavior through a generic reference resolver.
- Runtime accessors contain no literal relationship, view, profile, prefix, property, or visibility fallback.
- The view matrix is complete and missing entries are bundle errors rather than runtime defaults.
- Incoming relationship direction remains literal; no inverse behavior was added.
- Older bundles without authoring metadata retain ordinary compile/validate support through their legacy inline profile fields.
- Checkpoint 1 added no snapshot, planner, mutation, proposal executor, helper command, or CLI behavior.
- The UX brief and architecture authority documents remain unchanged.

Violated invariants:

- None observed.

Residual risks:

- The 252-entry matrix is intentionally large static bundle data. Cross-artifact validation and exact role/display tests control drift, but later specification changes must update all affected explicit entries.
- The current accessors expose the Checkpoint 1 substrate only. Deterministic immutable catalog construction and bundle fingerprinting remain Checkpoint 2 work.
- Extending the v0.1 primitive value sets (new display predicate, source representation, sequence policy, or placement value) requires a typed contract and generic validator/evaluator extension before bundle use.

Documentation updated:

- `docs/toolchain/architecture.md`
- `definitions/v0.1/authoring_spec_type_first_dsl_sdd_text_v_0_dot_1.md`
- `definitions/v0.1/endpoint_contracts_semantic_rules_sdd_text_v_0_dot_1.md`
- `docs/doc_site/diagram_types/hidden_edge_reference.md`
- `docs/doc_site/diagram_types/node_edge_reference.md`
- This implementation plan and log

Snapshot/golden audit:

- No compiled snapshots, projection snapshots, renderer-stage snapshots, goldens, or rendered corpus artifacts were changed or refreshed.
- The full compile, projection-snapshot, renderer-snapshot, render-profile, and rendered-corpus tests passed without normalization.

Unrelated-worktree preservation audit:

- Preserved the pre-existing modification to `AGENTS.md`.
- Preserved the pre-existing modification to `progress.md`.
- Preserved the pre-existing deletion of `docs/Done/[Done] service_blueprint_renderer_implementation/AGENTS.md`.
- No implementation patch targeted those files.

Checkpoint acceptance decision and next-checkpoint authorization:

- Technical acceptance assessment: **PASS**. Checkpoint 1 meets its scope, bundle-authority proofs, focused/full regression, documentation, and stop-condition requirements.
- Unresolved bundle gaps: none for Checkpoint 1.
- Checkpoint 2 authorization: **withheld pending explicit user acceptance of the Checkpoint 1 report**. No Checkpoint 2 code has started.
