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
- User acceptance received on 2026-08-11. Checkpoint 1 was committed as `63d249e` (`Checkpoint 1 done`), authorizing Checkpoint 2.

### 2026-08-11 — Checkpoint 2: Fingerprint, catalog, and document snapshot

Working-tree identifier: uncommitted Checkpoint 2 implementation based on commit `63d249e` (`Checkpoint 1 done`). No Checkpoint 2 commit was created.

Implemented scope:

- Added recursive canonical JSON utilities and deterministic `bnd_<sha256>` bundle fingerprinting.
- Added a deeply frozen guidance catalog with private profile, node-type, endpoint-triple, view, and view/triple indexes.
- Added normalized catalog records for syntax/schema constraints, profile rules/order, node forms and ID suggestion inputs, relationship/endpoint order, authoring semantics, edge-field support/requiredness, view roles/display rules/aliases, and placement inputs.
- Added pure source-text guided snapshot construction from `inspectDocumentText(...)` and `compileSource(...)`.
- Added a read-only workspace adapter that normalizes file-backed `document_ref` and `path` to the same repo-relative path.
- Added private snapshot indexes for nodes by handle/ID/type, incoming/outgoing edges, children, body order, and used IDs without serializing those indexes.
- Added `GuidedAdditionDomainError`, stable unsupported/document-unavailable diagnostics, and the public `authoring` diagnostic stage in TypeScript and machine-readable diagnostic metadata.
- Added root public exports for fingerprint, catalog, snapshot, contracts, and diagnostic stage types.

Explicitly deferred:

- Checkpoint 3 workflow state, transitions, relationship choices, filters, forms runtime, ID generation, placement alternatives/effects, confirmations, and completed proposals.
- All mutation execution, reparenting, proposal execution, CLI prompts, Save/Cancel behavior, and guided domain-service metadata.
- Any new helper or MCP command.

Canonical fingerprint input:

| Ordered top-level field | Included value | Notes |
| --- | --- | --- |
| `manifest` | Loaded manifest | Manifest paths and declared ordering remain semantic input. |
| `vocab` | Vocabulary artifact | Array order remains significant. |
| `syntax` | Syntax artifact | Recursively key-sorted. |
| `schema` | Core schema | Recursively key-sorted. |
| `projection_schema` | Projection schema | Recursively key-sorted. |
| `contracts` | Contract artifact | Relationship and endpoint array order remain significant. |
| `views` | View artifact | View, triple, and rule array order remain significant. |
| `profiles` | `{id, profile}` records in manifest order | Environment paths are absent. |
| `authoring` | Authoring artifact or `null` | `rootDir` and `manifestPath` are excluded. |

Bundle field → generic consumer → focused test → mutation proof:

| Bundle field | Generic consumer | Focused test | Bundle-only proof |
| --- | --- | --- | --- |
| All fingerprint artifacts above | `createBundleFingerprintInput(...)`, `computeBundleFingerprint(...)` | `guidedAdditionCatalog.spec.ts` artifact inclusion cases | Mutating each artifact changes the fingerprint; changing `rootDir`/`manifestPath` does not. |
| Arbitrary object keys and ordered arrays | `canonicalizeJson(...)`, `stringifyCanonicalJson(...)` | key/array ordering case | Reordering object keys preserves the fingerprint; swapping an array element changes it. |
| Vocabulary node records + authoring forms/prefixes | `createGuidanceCatalog(...)`, node-type index | immutable catalog and authoring mutation cases | Prefix/width mutations change the indexed node record without code changes. |
| `allowed_endpoints` | relationship/triple catalog index | endpoint catalog mutation case | A coordinated endpoint/matrix mutation removes the old triple and adds the new triple. |
| Relationship `authoring` and contract order | relationship catalog records | deterministic catalog case | Graph role/source semantics and relationship/endpoint order are copied through generic accessors. |
| `edge_field_support` / `required_edge_property` | relationship edge-field catalog record | field-support/requiredness mutation case | Changing supported and required properties changes the catalog record. |
| View roles, display rules, aliases, and predicates | view catalog/index and `resolveDisplay(...)` | role/display and conditional alias cases | Role/display mutations change records; simple conditional and permissive alias resolution come from catalog data. |
| `placement_policies.default` | frozen catalog placement record | authoring placement mutation case | Changing placement data changes the catalog record. |
| Source text structure | `inspectDocumentText(...)` within snapshot builder | snapshot source-order/revision cases | Source edits change revision/handles while preserving bundle identity. |
| Compiled graph semantics | `compileSource(...)` within snapshot builder | literal-edge and duplicate-ID cases | Literal edge direction/order is preserved; duplicate IDs and compile failures block snapshot creation. |

Repeat-run fingerprint and snapshot evidence:

- Current fingerprint repeated identically: `bnd_37f9a7ff4e2e8fa75c9d36b2c4bf4c2ef5092f744b620c1493a0e6fd3def29ba`.
- `outcome_to_ia_trace.sdd` snapshot revision: `rev_97935b9a59dcdee194023bbc1cd03a15b106f9ba55769f9f442f71344ac2747a`.
- Snapshot counts: 11 nodes and 14 literal edges.
- Node order begins `O-001`, `M-001`, `OP-001`, `I-001`, `G-001` and follows source traversal through `P-002`.
- Edge order begins `O-001 MEASURED_BY M-001`, preserves authored instrumentation/support/addressing order, and ends `P-001 NAVIGATES_TO P-002`.
- Source mutation tests changed revision and all revision-bound handles without changing the bundle fingerprint.
- Bundle mutation tests changed the bundle fingerprint without changing source revision, nodes, or edges.

Exact verification:

- `TMPDIR=/tmp pnpm exec vitest run tests/guidedAdditionCatalog.spec.ts tests/guidedAdditionSnapshot.spec.ts tests/authoringInspect.spec.ts tests/compile.spec.ts --no-file-parallelism --reporter=dot` — 4/4 files passed; 28/28 tests passed.
- `TMPDIR=/tmp pnpm run build` — passed, TypeScript compilation exit 0.
- First `TMPDIR=/tmp pnpm exec vitest run --no-file-parallelism --reporter=dot` — 81/82 files and 734/735 tests passed; one unrelated journey-routing test exceeded its existing 5-second timeout at 5.158 seconds.
- `TMPDIR=/tmp pnpm exec vitest run tests/journeyMapRouting.spec.ts -t "retains the isolated ordering skip while later accepted families are added" --no-file-parallelism --reporter=dot` — isolated case passed in 4.421 seconds.
- Repeated exact `TMPDIR=/tmp pnpm exec vitest run --no-file-parallelism --reporter=dot` — 82/82 files passed; 735/735 tests passed in 332.93 seconds.
- `TMPDIR=/tmp pnpm docs:build` — passed; VitePress build completed in 9.44 seconds.
- `git diff --check` — passed with no whitespace errors.

Satisfied invariants:

- Same loaded bundle produces a byte-identical recursively canonical fingerprint; environment relocation does not affect it.
- Same bundle/source produces byte-identical frozen snapshots, including after LF/CRLF normalization.
- Catalog construction consumes the bundle-authority accessors and retains no mutable bundle references.
- Catalog and snapshot lookup indexes are private and absent from serialization.
- Snapshot nodes and edges preserve literal direction and source traversal order rather than compiled canonical order.
- Parse and compile errors, including duplicate IDs, block snapshot creation with stable sorted guided-domain diagnostics.
- Validation/profile completeness is not a snapshot prerequisite.
- Source-text snapshot construction imports no mutation, journal, workspace-write, helper, CLI, or filesystem-write path.
- The workspace adapter performs only normalized path resolution and a single read.
- No planner, state transition, mutation operation, proposal, helper command, or CLI behavior was introduced.

Violated invariants:

- None observed. The first broad-run timeout was a non-reproducing timing failure in an unrelated existing renderer test; the isolated case and repeated exact full serial suite passed.

Residual risks:

- Snapshot private indexes are intentionally process-local `WeakMap` state. Serialized snapshots remain portable, and a later runtime must rebuild or retrieve indexes within the same process rather than expect them in caller state.
- The catalog deliberately carries frozen schema and profile-rule metadata so Checkpoint 3 can remain bundle-independent. Checkpoint 3 must consume those normalized catalog records and must not reintroduce direct bundle-shape reads.
- The existing journey-routing test remains close enough to its 5-second timeout to exhibit machine-load sensitivity, although it is unrelated to this checkpoint and passed on isolated and repeated full runs.

Documentation updated:

- `docs/toolchain/architecture.md`
- This implementation plan and log

Snapshot/golden audit:

- No compiled snapshots, projection snapshots, renderer-stage snapshots, goldens, or rendered corpus artifacts were changed or refreshed.
- Compile snapshots, projection snapshots, renderer-stage goldens, and rendered-corpus tests passed in the repeated full suite.

Unrelated-worktree preservation audit:

- Checkpoint 2 began from clean committed Checkpoint 1 base `63d249e`.
- Only Checkpoint 2 fingerprint/catalog/snapshot/types/tests and allowed documentation files are modified.
- No CLI, helper program, mutation, journal, workspace, renderer, snapshot, golden, or corpus file was changed.

Checkpoint acceptance decision and next-checkpoint authorization:

- Technical acceptance assessment: **PASS**. Checkpoint 2 meets its determinism, catalog mutation, snapshot/error-boundary, import-boundary, focused/full regression, documentation, and stop-condition requirements.
- Unsupported bundle cases: authoring metadata absence is reported as `guided_addition.unsupported_bundle`; no unresolved supported-bundle case remains.
- Checkpoint 3 authorization: **withheld pending explicit user acceptance of the Checkpoint 2 report**. No Checkpoint 3 code has started.
- User acceptance received on 2026-08-11. Checkpoint 2 was committed as `bc5fcdb` (`Checkpoint 2 done`), authorizing Checkpoint 3.

### 2026-08-11 — Checkpoint 3: Planner, forms, filtering, placement, and proposals

Working-tree identifier: uncommitted Checkpoint 3 implementation based on commit `bc5fcdb` (`Checkpoint 2 done`). No Checkpoint 3 commit was created.

Implemented scope:

- Added the complete pure guided workflow and public contracts for standalone node creation plus outgoing/incoming relationships to existing or new endpoints.
- Added immutable state transitions for operation selection, relationship filters and choices, endpoint strategy and selection, node and edge forms, placement review, exact effect confirmation, proposal review, and completion.
- Added generic node/edge form construction and validation from catalog-carried syntax, schema, profile-rule, authoring-form, edge-support, and required-property metadata.
- Added deterministic ID suggestions and opaque identifiers for choices, endpoint options, placements, effects, and completed proposals.
- Added catalog-driven relationship ordering, view-role/display metadata, profile aliases, conditional display evaluation, and caller-requested role/presence/label filtering.
- Added deterministic, bounded, de-duplicated node and edge placement alternatives, including structural reparent effects and exact confirmation binding.
- Added public root exports and focused planner, placement, architecture-boundary, determinism, scenario, and bundle-mutation tests.

Explicitly deferred:

- Checkpoint 4 cross-stream `reparent_node_block`, proposal verification/translation, mutation execution, journaling, and undo integration.
- All filesystem writes, CLI prompts, Save/Cancel behavior, and guided domain-service metadata.
- Any new helper or MCP command.

Route terminal proposal evidence:

| Route | Terminal semantic proposal |
| --- | --- |
| Standalone | One `node_1`; no relationship and no edge. |
| Outgoing + existing | No proposed node; relationship source is the anchor, target is the selected existing node, and `edge_1` matches those literal endpoints. |
| Outgoing + new | One `node_1`; relationship source is the anchor, target is `node_1`, and `edge_1` matches. |
| Incoming + existing | No proposed node; relationship source is the selected existing node, target is the anchor, and `edge_1` matches. |
| Incoming + new | One `node_1`; relationship source is `node_1`, target is the anchor, and `edge_1` matches. |

Bundle field → generic consumer → focused test → mutation proof:

| Bundle/catalog field | Generic consumer | Focused test | Bundle-only proof |
| --- | --- | --- | --- |
| Endpoint triples and relationship order | planner relationship-choice builder | `guidedAdditionPlanner.spec.ts` route and endpoint-mutation cases | Changing an allowed endpoint changes the offered relationship choices without planner edits. |
| Node prefixes, minimum width, and sequence policy | `suggestGuidedNodeId(...)` | `guidedAdditionPlanner.spec.ts` ID matrix | Prefix/width mutations change suggestions; empty, numeric, suffixed, edited, collision, invalid, and duplicate cases are covered. |
| Node forms plus syntax/schema/profile rules | node form builder and value validator | planner form and architecture cases | Form inventory and formats are resolved from catalog metadata; no node type or property table exists in the planner. |
| View roles, display rules, aliases, and predicates | choice metadata, ordering, and filters | planner display/filter cases | Role/display mutations change metadata, order, and filtering; simple, strict, permissive alias, and conditional UI behavior are covered. |
| Edge-field support | edge form builder | optional PRECEDES and mutated-support cases | Adding/removing supported annotation or property fields changes the form and proposal content. |
| `required_edge_property` rules | edge form completion gate | required BINDS_TO and mutation cases | Requiredness mutations change whether the same field values can complete. |
| Relationship `authoring.graph_role` / `source_organization` | placement planner and effect builder | `guidedAdditionPlacement.spec.ts` structural mutation cases | Changing structural authoring semantics changes nesting/reparent requirements. |
| Placement policy sequence, fallback, structural, edge, and name-hint values | placement recommendation builder | placement policy mutation cases | Policy-only mutations change recommendation kinds, ordering, effects, edge placement, and target-name hints. |

Determinism, filtering, placement, and effect evidence:

- Identical inputs produce byte-identical states, steps, completed proposals, and opaque identifiers: `relc_<sha256>`, `ntc_<sha256>`, `epc_<sha256>`, `plc_<sha256>`, `eff_<sha256>`, and `addp_<sha256>`.
- Existing endpoint strategy is omitted when no matching endpoint exists; unavailable, stale, mismatched-anchor, invalid-field, duplicate-ID, and tampered caller-state actions are rejected with the unchanged caller state.
- Relationship choices retain bridge entries unless filters exclude them and are ordered primary, supporting, then bridge using catalog relationship order as the stable tie-breaker.
- Placement covers structural nesting, outgoing/incoming sequence placement, same-source target ordering, fallback append, same-level alternatives, and only offers before/after when the anchor belongs to that destination stream.
- A reparent effect is bound to document revision, bundle fingerprint, relationship choice, target, old parent, new parent, and placement. Exact confirmation advances; stale or mismatched confirmation is rejected; a non-reparenting alternative clears the effect.
- Completed proposals reserve only `node_1` and `edge_1` and contain semantic content rather than source text or mutation operations.

Import and semantic-boundary audit:

- Guided runtime modules import only guided contracts/catalog/snapshot support, bundle types, diagnostics, canonical JSON/crypto utilities, and pure helpers.
- They do not import filesystem, workspace-write, mutation, journal, helper, CLI, or proposal-executor modules.
- Source audits and architecture tests found no relationship name, node type, view ID, profile ID, prefix, or property-name fallback in planner/forms/placement code.
- No workflow transition performs I/O, serializes SDD, or creates `ChangeOperation[]`.

Exact verification:

- `TMPDIR=/tmp pnpm exec vitest run tests/guidedAdditionPlanner.spec.ts tests/guidedAdditionPlacement.spec.ts tests/guidedAdditionCatalog.spec.ts tests/guidedAdditionArchitecture.spec.ts --no-file-parallelism --reporter=dot` — 4/4 files passed; 46/46 tests passed in 9.61 seconds.
- `TMPDIR=/tmp pnpm run build` — passed, TypeScript compilation exit 0.
- `TMPDIR=/tmp pnpm exec vitest run --no-file-parallelism --reporter=dot` — 85/85 files passed; 771/771 tests passed in 343.80 seconds.
- `TMPDIR=/tmp pnpm docs:build` — passed; VitePress build completed in 8.58 seconds.
- `git diff --check` — passed with no whitespace errors before this log entry and is rerun after it.

Satisfied invariants:

- The guided workflow is pure, stateless between calls, serializable, deterministic, and read-only.
- The runtime consumes only the immutable guidance catalog established by Checkpoint 2 and does not reread bundle YAML shapes.
- Bundle data controls relationship and endpoint choices, form inventory and formats, display classification and filtering, ID suggestions, supported/required edge fields, and placement inputs.
- Every advance rechecks revision and bundle fingerprint, recomputes the currently offered option set, and rejects unavailable or tampered selections.
- Incoming relationships remain literal and completed proposal relationship/edge endpoints match exactly.
- Profile completeness is not enforced while browsing choices.
- Reparent confirmation is exact, revision/fingerprint-bound, and invalidated when the selected placement changes.
- Proposals contain no source text or `ChangeOperation[]`; no execution or persistence path was added.
- The architecture and UX authority documents remain unchanged.

Violated invariants:

- None observed.

Residual risks:

- Completed proposals are intentionally non-executable until Checkpoint 4 adds the sole verified adapter to shared mutation machinery.
- Form format resolution covers the currently declared generic profile rule kinds; a future format-rule kind requires a typed catalog/runtime extension before bundle use.
- Placement policy values remain closed typed values. A future policy value requires a generic contract and planner extension before it can be declared in a bundle.

Documentation updated:

- `docs/toolchain/architecture.md`
- This implementation plan and log

Snapshot/golden audit:

- No parser/compiler snapshots, projection snapshots, renderer-stage snapshots, goldens, rendered corpus artifacts, or `.sdd` examples were changed or refreshed.
- The full snapshot, golden, and rendered-corpus regression suite passed without normalization.

Unrelated-worktree preservation audit:

- Checkpoint 3 began from clean committed Checkpoint 2 base `bc5fcdb`.
- Only guided planner/contracts/forms/identifiers/placement code, root exports, focused tests, and the allowed documentation files are modified.
- No bundle artifact, parser, compiler, validator, projection, renderer, mutation, journal, workspace, CLI, helper, snapshot, golden, corpus, architecture-authority, or UX-authority file was changed.

Checkpoint acceptance decision and next-checkpoint authorization:

- Technical acceptance assessment: **PASS**. Checkpoint 3 meets its route coverage, determinism, bundle-authority proofs, filtering/display, forms, placement/effect, import-boundary, focused/full regression, documentation, and stop-condition requirements.
- Unsupported supported-bundle cases: none observed. Bundles without authoring metadata remain explicitly unsupported for guided addition.
- Checkpoint 4 authorization: **withheld pending explicit user acceptance of the Checkpoint 3 report**. No Checkpoint 4 code has started.
- User acceptance received on 2026-08-11. Checkpoint 3 was committed as `8f73d0e` (`Checkpoint 3 done`), authorizing Checkpoint 4.

### 2026-08-11 — Checkpoint 4: Reparenting primitive and proposal executor

Working-tree identifier: uncommitted Checkpoint 4 implementation based on commit `8f73d0e` (`Checkpoint 3 done`). No Checkpoint 4 commit was created.

Implemented scope:

- Added `reparent_node_block` as a separate low-level mutation operation while retaining `move_nested_node_block` as the backward-compatible same-parent reorder operation.
- Added source-model movement across top-level and body streams, recursive indentation/header rebasing, self/descendant-cycle prevention, destination-anchor validation, and old/new parent/index summaries.
- Made ordering summaries a discriminated union and added `apply_addition_proposal` as a change-set origin.
- Added `ApplyAdditionProposalArgs`, `ApplyAdditionProposalResult`, and `applyAdditionProposal(...)` as the sole guided write-side adapter.
- Added proposal path/revision/fingerprint/reference/ID/endpoint/field/view-role/placement/confirmation verification, deterministic operation translation, temporary local-handle mapping, and one call to `executeChangeOperations(...)`.
- Added the low-level reparent operation to existing helper apply request validation and static contract metadata without adding a helper command.
- Added focused reparent, proposal executor, helper validation, metadata, source-preservation, mutation-regression, journaling, and undo tests.

Explicitly deferred:

- Checkpoint 5 interactive `sdd add`, prompt adapters, review UI, Save/Cancel, warning acceptance, and client-owned confirmation refusal/alternative selection.
- Checkpoint 6 shared guided-domain service metadata.
- Any guided helper or MCP command.

Bundle field → generic consumer → focused test → mutation proof:

| Bundle/catalog field | Generic consumer | Focused test | Bundle-only proof |
| --- | --- | --- | --- |
| Current bundle fingerprint input, including authoring and contracts | `applyAdditionProposal(...)` preflight | `additionProposals.spec.ts` stale bundle cases | Changing the canonical Outcome prefix or removing an allowed endpoint makes a completed proposal stale before mutation execution. |
| Allowed endpoint triples | proposal relationship verifier through `GuidanceCatalog.getRelationship(...)` | relationship/edge and endpoint mutation cases | Current triple must resolve from the catalog; the proposal carries no executor-side relationship allow-list. |
| Relationship `authoring.graph_role` / `source_organization` | recomputed placement/effect verification | structural-semantics mutation case | Changing only `CONTAINS.source_organization` makes the same semantic new-parent addition complete without a reparent effect. |
| Placement policies | `createPlacementRecommendations(...)`, `selectPlacement(...)`, `effectForSelections(...)` reused by executor | exact placement/confirmation cases | Executor accepts only recomputed currently offered placements/effects; there is no mutation-side placement fallback. |
| Edge-field support and `required_edge_property` | `normalizeAndValidateEdgeFields(...)` | BINDS_TO required/relaxed cases | Removing only the required-property rule lets the same empty `BINDS_TO.props` proposal complete and apply under the mutated bundle. |
| Node authoring forms and syntax/schema/profile formats | `normalizeAndValidateNodeFields(...)` | standalone property and proposal verification cases | Proposal nodes must normalize exactly against current catalog form/format metadata before translation. |
| View/triple role records and profile inventory | proposal guidance-context verifier | proposal verification coverage | Any supplied view role and display-profile identifier must resolve from current catalog records; the executor carries no view/profile table. |

Reparent before/after source evidence:

```text
# before: top-level child with a nested subtree
Place P-001 "Child" # header tail
  owner=Design # property tail
  NAVIGATES_TO P-002 "Next" # edge tail

  # before nested
  + ViewState VS-001 "Nested"
    description="kept"
  END
  # child trailing
END # end tail

# after: complete block nested under Area A-001
  + Place P-001 "Child" # header tail
    owner=Design # property tail
    NAVIGATES_TO P-002 "Next" # edge tail

    # before nested
    + ViewState VS-001 "Nested"
      description="kept"
    END
    # child trailing
  END # end tail
```

The corresponding summary records `old_parent_handle: null`, the Area handle as `new_parent_handle`, `old_index: 1`, and `new_index: 1`. Separate focused cases record nested→different-parent and nested→top-level moves. Self, descendant, same-parent, invalid destination anchor, stale handle, and stale revision cases are rejected.

Proposal translation and execution evidence:

- Standalone node with one property translates as `insert_node_block`, then `set_node_property`.
- New structural parent plus existing child translates as `insert_node_block`, `insert_edge_line`, then `reparent_node_block`.
- The structural edge is inserted once and the existing child block is moved once; explicit source assertions find exactly one `CONTAINS` line and one nested child header.
- Temporary node and edge handles remap to returned `hdl_*` created targets. The reparent operation's destination parent remaps to the exact created node handle.
- Dry-run and commit produce identical candidate revision, operations, summary, and created-target mappings; only mode/change-set identity and persistence differ.
- A committed proposal records a restore-document inverse and the shared undo path restores the exact original source.
- Missing confirmation reports `guided_addition.confirmation_required`; an altered effect reports `guided_addition.confirmation_stale`.
- Stale revision/fingerprint/reference, invalid proposal ID, missing file-backed path, and relationship/edge mismatch return rejected `sdd-addition-proposal-result` values rather than expected-domain exceptions.
- Source audit confirms `additionProposals.ts` contains no SDD literal/emitter/write routine and contains exactly one `executeChangeOperations(...)` call.

Exact verification:

- `TMPDIR=/tmp pnpm exec vitest run tests/reparentNodeBlock.spec.ts tests/additionProposals.spec.ts tests/authoringMutations.spec.ts tests/authoringOrderingAndUndo.spec.ts tests/authoringIntents.spec.ts tests/helperCli.spec.ts --no-file-parallelism --reporter=dot` — 6/6 files passed; 93/93 tests passed in 18.96 seconds.
- Additional metadata/integration verification: `tests/authoringContractMetadata.spec.ts`, `tests/authoringContractResolution.spec.ts`, and `tests/helperCli.integration.spec.ts` — 3/3 files and 27/27 tests passed; subsequent metadata/helper focused run passed 83/83 tests.
- `TMPDIR=/tmp pnpm run build` — passed, TypeScript compilation exit 0.
- `TMPDIR=/tmp pnpm exec vitest run --no-file-parallelism --reporter=dot` — 87/87 files passed; 781/781 tests passed in 375.65 seconds.
- `TMPDIR=/tmp pnpm docs:build` — passed twice; the final post-log VitePress build completed in 8.54 seconds.
- `git diff --check` — passed with no whitespace errors, including after this log entry.

Satisfied invariants:

- Existing mutation operations remain behaviorally compatible; cross-stream movement is an additive operation and has a distinct summary discriminant.
- Reparenting moves the complete source-model subtree and preserves properties, edges, comments, blank lines, trailing comments, and relative nesting while rebasing indentation.
- Reparenting rejects self/descendant cycles, stale revision/handles, invalid destination parents/anchors, and same-parent misuse.
- Guided confirmation is enforced only by the proposal executor; the low-level reparent operation remains confirmation-agnostic.
- Proposal verification recomputes revision, bundle fingerprint, snapshot references, bundle-owned semantics, placements, effects, required fields, and canonical identifiers.
- Proposal relationship and edge endpoints must match exactly and incoming direction remains literal.
- Translation order is nodes, properties, edges, then reparenting, and proposal-local parents work through temporary-handle remapping.
- `applyAdditionProposal(...)` invokes the shared executor once and performs no source serialization or direct persistence.
- Dry-run/commit candidate parity, journaling, undo, and created-target mappings are demonstrated.
- Existing helper command inventory is unchanged; only the existing low-level apply contract gained the reparent operation.
- The architecture and UX authority documents remain unchanged.

Violated invariants:

- None observed.

Residual risks:

- Reparent indentation rebasing follows the mutation engine's existing two-space emitted depth convention. Non-semantic unusual indentation remains parseable, but a moved header is normalized to the canonical top-level/nested form.
- Proposal verification deliberately rereads the current file before delegating to the shared executor, which rereads and rechecks revision at mutation time. This closes the race boundary but performs two reads in the non-stale case.
- The current file adapter requires `proposal.document_context.path`; alternative storage resolution remains future adapter work.
- Guided proposal metadata is not yet represented as domain-service contract subjects; that remains Checkpoint 6 by design.

Documentation updated:

- `docs/toolchain/architecture.md`
- `docs/doc_site/sdd-helper/index.md`
- `definitions/v0.1/authoring_spec_type_first_dsl_sdd_text_v_0_dot_1.md`
- This implementation plan and log

Snapshot/golden audit:

- No parser/compiler snapshots, projection snapshots, renderer-stage snapshots, goldens, rendered corpus artifacts, or `.sdd` examples were changed or refreshed.
- The full compile, projection, renderer-stage, visual-acceptance, and rendered-corpus tests passed without normalization.

Unrelated-worktree preservation audit:

- Checkpoint 4 began from clean committed Checkpoint 3 base `8f73d0e`.
- A contemporaneous external modification added `Checkpoint 4 done` to `progress.md`; this implementation did not create, edit, stage, or revert that change.
- Only the Checkpoint 3 acceptance line, reparent/proposal contracts and implementation, existing helper apply validation/metadata, focused tests, and allowed explanatory documentation are part of the Checkpoint 4 scope.
- No bundle artifact, parser, compiler, validator, projection, renderer, journal implementation, workspace implementation, CLI command inventory, snapshot, golden, corpus, architecture-authority, or UX-authority file was changed.

Checkpoint acceptance decision and next-checkpoint authorization:

- Technical acceptance assessment: **PASS**. Checkpoint 4 meets its source-preservation, cycle/stale rejection, proposal verification, bundle-authority proof, confirmation, translation-order, shared-executor, parity, journaling/undo, helper-compatibility, documentation, and regression requirements.
- Unresolved proposal-executor gaps: none for the supported v1 proposal shapes.
- Checkpoint 5 authorization: **withheld pending explicit user acceptance of the Checkpoint 4 report**. No Checkpoint 5 CLI code has started.
- User acceptance received on 2026-08-11. Checkpoint 4 was committed as `a8e7634` (`Checkpoint 4 done`), authorizing Checkpoint 5.

### 2026-08-11 — Checkpoint 5: Interactive `sdd add`

Working-tree identifier: uncommitted Checkpoint 5 implementation based on commit `a8e7634` (`Checkpoint 4 done`). No Checkpoint 5 commit was created.

Implemented scope:

- Added public `sdd add <document_path> [--node <node_id>] [--view <view_id>] [--bundle <manifest>]` registration and command help.
- Added a production `readline/promises` prompt adapter behind an injected, deterministic prompt contract.
- Added repository-root discovery, repo-relative workspace normalization, one initial bundle/source load, file-backed snapshot construction, exact anchor resolution, and planner-owned view validation.
- Added thin presentation for standalone and all four anchored operation routes, relationship/view metadata, planner filter actions, existing/new endpoints, primary and explicitly disclosed advanced fields, placement review, exact effect confirmation, refusal-to-alternative routing, and plain-language proposal/change summaries.
- Added Save/Cancel orchestration: dry-run with `validate_profile: simple`, error blocking, explicit warning acceptance, final commit acceptance, exact proposal-object reuse, and stale-restart reporting.
- Added deterministic CLI tests covering injected I/O, transcripts, route completion, bundle-only presentation mutations, no-write Cancel, dry-run/commit call identity, invalid inputs, warnings, confirmation, stale drift, and semantic-boundary source audits.
- Updated the human CLI guide, toolchain architecture, and README quick start/current status.

Explicitly deferred:

- Checkpoint 6 machine-readable guided domain-service subjects, shapes, bindings, constraints, and continuations.
- Any guided `sdd-helper` or MCP command or execution adapter.
- Any graphical authoring client or JSON contract for human terminal output.

Bundle field → generic consumer → focused test → mutation proof:

| Bundle/catalog field | Generic consumer | Focused test | Bundle-only proof |
| --- | --- | --- | --- |
| Vocabulary node descriptions | `createGuidanceCatalog(...)` → planner `GuidedNodeTypeChoice.description` → CLI node-type menu | `guidedAdditionCli.spec.ts` bundle-only presentation case | Changing only the Outcome description changes the menu description; the CLI does not read `bundle.vocab`. |
| View/triple roles and display rules | catalog display resolver → planner `RelationshipChoice.role_by_view` / `display_by_view` and ordering → CLI relationship menu | view/filter transcript and bundle-only presentation cases | Changing only `Outcome MEASURED_BY Metric` to bridge/hidden changes the displayed bridge annotation, role, presence, and label status through planner results. |
| Authoring node prefix | catalog node ID inputs → planner form suggestion → CLI field default | bundle-only presentation case | Changing only the Outcome prefix from `O` to `OX` changes the displayed node-ID suggestion to an `OX...` value. |
| Authoring field descriptions, prominence, formats, and allowed values | planner `GuidedFieldDefinition[]` → primary/advanced disclosure and prompt kind | advanced-field and form transcript cases | CLI iterates returned field descriptors; it contains no node/property inventory or format table. |
| Relationship endpoint triples and endpoint availability | planner relationship/endpoint option lists → CLI choice menus | five route cases and invalid-choice domain coverage | Standalone plus outgoing/incoming existing/new flows render and submit only offered opaque choices; CLI contains no endpoint allow-list. |
| Placement policy and relationship authoring semantics | planner placement recommendations/effects → CLI placement/effect prompts | placement mutation and structural confirmation/refusal cases | Changing only fallback placement from `last` to `first` changes the first displayed placement; structural semantics produce exact confirmation and a planner-offered non-reparenting alternative. |
| Edge-field support and required-property rules | planner edge form/completion gates → CLI required/optional field prompts | advanced edge-field route and executor regression | Required fields are always prompted; optional edge fields require disclosure, with no relationship/property branch in CLI code. |

Representative deterministic prompt transcripts:

- Standalone Cancel: `operation → node_type → disclose_node_advanced → field:node_id → field:name → field:description → placement → save_or_cancel`; executor calls: 0.
- Anchored view/filter route: `operation → relationship → filter_role → filter_presence → relationship → endpoint → disclose_node_advanced → node fields → placement(s) → save_or_cancel`. The relationship menu contains bundle-derived `role: primary`, `presence: connector`, label status, and descriptions.
- Structural new-parent/existing-child acceptance: route/form/placement prompts followed by `confirm_effect → save_or_cancel` using the exact planner effect.
- Structural refusal: `confirm_effect → reparent_refusal`, then the selected planner alternative clears the effect and returns to proposal review; refusal state is not stored as a confirmation.
- Save with warning: proposal review followed by `save_or_cancel → accept_warnings → confirm_commit`; the dry-run and commit call arguments reference the same proposal object.

Exact verification:

- `TMPDIR=/tmp pnpm run build` — passed after the final CLI/test changes; TypeScript compilation exit 0.
- `TMPDIR=/tmp pnpm exec vitest run tests/guidedAdditionCli.spec.ts tests/cli.spec.ts tests/additionProposals.spec.ts tests/helperCli.spec.ts --no-file-parallelism --reporter=dot` — 4/4 files passed; 131/131 tests passed in 17.44 seconds.
- `TMPDIR=/tmp pnpm exec vitest run --no-file-parallelism --reporter=dot` — 88/88 files passed; 794/794 tests passed in 372.28 seconds.
- `TMPDIR=/tmp pnpm docs:build` — passed twice; the final post-log VitePress build completed in 9.76 seconds.
- `TMPDIR=/tmp pnpm sdd add --help` — passed and displayed the new required argument plus `--node`, `--view`, and `--bundle` options.
- `TMPDIR=/tmp pnpm sdd-helper --help` — passed; unchanged helper inventory is `inspect`, `search`, `create`, `apply`, `author`, `undo`, `validate`, `project`, `preview`, `git-status`, `git-commit`, `contract`, and `capabilities`.
- `git diff --check` — passed with no whitespace errors before this log entry.

Satisfied invariants:

- The CLI is a presentation and Save/Cancel adapter over the shared snapshot, planner, workspace, and proposal-executor APIs.
- Bundle-derived planner results control descriptions, node/relationship choices, role/display ordering and classification, field forms, ID suggestions, and placement/effect prompts.
- `--node` resolves exactly against the immutable snapshot; `--view` is validated through planner filter normalization.
- Filter changes are planner actions; profile completeness is not applied while browsing.
- Primary fields precede optional advanced disclosure, while required edge fields remain unavoidable completion gates.
- Incoming relationships remain literal and the CLI submits only normalized direction/endpoint strategy values.
- Reparent confirmation uses the exact planner-returned effect. Refusal selects a planner-provided alternative or Cancel, and the CLI stores no independent confirmation state.
- Cancel, warning refusal, and final-commit refusal invoke no commit. Save always dry-runs with `simple`, displays diagnostics, and commits the same proposal object only after acceptance.
- Stale revision or bundle fingerprint rejection blocks commit and tells the user to restart.
- CLI source contains no bundle contract/view/authoring inspection, raw SDD construction, `ChangeOperation[]`, mutation translation, or direct mutation execution.
- Existing helper commands, helper JSON contracts, and capabilities remain unchanged; no guided helper/MCP command was added.
- The architecture and UX authority documents remain unchanged.

Violated invariants:

- None observed.

Residual risks:

- The production prompt adapter intentionally provides simple numbered terminal interaction; richer terminal controls or a graphical client remain future presentation work.
- The CLI rereads through the proposal executor during dry-run and commit, as required for currentness. External changes between those calls correctly reject the commit and require restart rather than attempting an in-place workflow recovery.
- Field input currently presents enum values as choices and other formats as text; semantic format validation and retry diagnostics remain planner-owned. A rejected entry is shown and the unchanged planner step is prompted again.
- The file-backed client requires the document to be inside a discoverable repository with `package.json` and `bundle/v0.1/manifest.yaml`; future storage adapters may use `document_ref` differently.

Documentation updated:

- `docs/toolchain/architecture.md`
- `docs/doc_site/sdd_cli_tools/index.md`
- `README.md`
- This implementation plan and log

Snapshot/golden audit:

- No parser/compiler snapshots, projection snapshots, renderer-stage snapshots, goldens, rendered corpus artifacts, or `.sdd` examples were changed or refreshed.
- The full compiled snapshot, projection snapshot, renderer-stage snapshot, visual acceptance, and rendered-corpus suites passed without normalization.

Unrelated-worktree preservation audit:

- Checkpoint 5 began from clean committed Checkpoint 4 base `a8e7634`.
- A contemporaneous external modification added `Checkpoint 5 done` to `progress.md`; this implementation did not create, edit, stage, or revert that change.
- Only the Checkpoint 4 acceptance line, human CLI implementation/tests, allowed explanatory documentation, and this log are part of Checkpoint 5 scope.
- No bundle artifact, definition, parser, compiler, validator, projection, renderer, guided planner/catalog/snapshot, proposal executor, mutation, journal, workspace, helper program/metadata, snapshot, golden, corpus, architecture-authority, or UX-authority file was changed.

Checkpoint acceptance decision and next-checkpoint authorization:

- Technical acceptance assessment: **PASS**. Checkpoint 5 meets its serial dependency, presentation-boundary, bundle-authority, route, filtering, form, placement/confirmation, Save/Cancel, warning, exact-proposal reuse, stale-rejection, documentation, helper-inventory, and regression requirements.
- Unresolved CLI semantic-boundary gaps: none for the supported v1 guided workflow.
- Checkpoint 6 authorization: **withheld pending explicit user acceptance of the Checkpoint 5 report**. No Checkpoint 6 domain metadata code has started.
