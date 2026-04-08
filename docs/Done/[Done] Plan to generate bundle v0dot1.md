# [Done:] Plan: Generate `bundle/v0.1` for SDD-Text with a Typed `views` Stub

This plan was executed on 3-04-26.

## Summary
Create a complete, machine-loadable v0.1 spec bundle from `definitions/v0.1` and supporting `initial_concepts` docs, then perform targeted markdown sync edits so prose and bundle are mutually consistent.  
The `views` artifact will be a **typed projection stub**: executable inclusion/exclusion rules are present, while less-defined layout/convention details are represented as explicit TODO placeholders.

## Locked Decisions
1. `core/views.yaml` will be **Typed Projections** (not minimal skeleton, not near-operational layout spec).
2. Source-of-truth policy is **Transitional Split**:
   - Extraction source now: `definitions/v0.1/*.md`.
   - Post-sync policy: `bundle/v0.1` is machine source of truth; markdown is explanatory/rationale.
3. Scope includes both guidance tasks in one plan:
   - Phase A: bundle generation.
   - Phase B: markdown sync edits.
4. Profiles to deliver: **both** `profiles/strict.yaml` and `profiles/permissive.yaml`.
5. Projection snapshots format: **deterministic JSON projection** (no Mermaid baseline).

## Deliverables
1. `bundle/v0.1/manifest.yaml`
2. `bundle/v0.1/core/vocab.yaml`
3. `bundle/v0.1/core/schema.json`
4. `bundle/v0.1/core/contracts.yaml`
5. `bundle/v0.1/core/views.yaml` (typed stub)
6. `bundle/v0.1/profiles/strict.yaml`
7. `bundle/v0.1/profiles/permissive.yaml`
8. `bundle/v0.1/examples/*.sdd` (3 examples)
9. `bundle/v0.1/snapshots/*` (compiled IR + JSON projections)
10. Targeted edits in:
   - `Readme.md`
   - `Readme - role of definitions and spec bundle files.md`
   - `definitions/v0.1/*.md` only where needed for consistency/clarity
11. Final extraction+ambiguity+sync report in markdown (repo-local report file)

## Public Interfaces / Types (Normative Bundle Shapes)
1. `manifest.yaml` keys:
   - `bundle_name`, `bundle_version`, `language`, `language_version`
   - `core` with `vocab`, `schema`, `contracts`, `views` relative paths
   - `profiles` list with `id`, `path`, `intent`
   - `compatibility` with `requires_compiler_min`, `notes`
2. `core/vocab.yaml` keys:
   - `node_types` array of objects: `token`, `group`, `description`
   - `relationship_types` array of objects: `token`, `group`, `description`
   - `closed_vocab: true`
   - `aliases_informative` map for non-canonical terms from concept docs
3. `core/contracts.yaml` keys:
   - `relationships` array; each item has `type`, `meaning`, `allowed_endpoints`, `constraints`
   - `constraints` entries use `id`, `description`, `severity_by_profile`, `rule_logic`
   - source-doc permissive/strict conformance concepts are operationalized through those per-profile severities plus profile configs, not a separate top-level key
4. `core/views.yaml` keys:
   - `views` array; each view has `id`, `name`, `status: stub`, `projection`, `conventions`
   - `projection` has `include_node_types`, `include_edge_types`, `hierarchy_edges`, `ordering_edges`
   - `conventions` has `normative_defaults` and `todo_placeholders`
5. `profiles/permissive.yaml` keys:
   - `id`, `extends: core`, `severity_defaults`
   - rule overrides to `warn` for governance constraints
6. `profiles/strict.yaml` keys:
   - `id`, `extends: core`, `severity_defaults`
   - explicit governance rules for required props, prefix↔type, event-reference strictness, ViewState parentage checks

## Phase A: Bundle Generation Plan
1. Create folder structure exactly as defined in guidance under `bundle/v0.1/`.
2. Extract canonical vocab from schema enums + readme/authoring summaries:
   - Node tokens and relationship tokens must be identical across `schema`, `ebnf`, `authoring`, `vocab`.
   - No new tokens added from initial concepts.
3. Build `core/schema.json` by lifting JSON block from `definitions/v0.1/json_schema...md` with formatting-only normalization.
4. Build `core/contracts.yaml` from endpoint contracts doc:
   - Encode all relationship contracts and allowed `(from_type,to_type)` pairs.
   - Encode shared semantic rules for referential integrity, duplicate-edge logic, directionality.
   - Encode special strict checks: `BINDS_TO.field`, event reference policy by profile.
5. Build `core/views.yaml` typed stub:
   - Define all 6 views with executable type filters and edge filters.
   - Keep layout/lane/grouping as TODO placeholders unless clearly normative.
   - Mark each view `status: stub` with `missing_details` fields.
6. Build profiles:
   - `permissive.yaml`: syntax+referential integrity baseline; governance mostly warnings.
   - `strict.yaml`: required node props, ID prefix↔type coupling, strict event reference where specified, ViewState parentage policy.
7. Create examples (3 files) with broad coverage:
   - `examples/outcome_to_ia_trace.sdd`
   - `examples/place_viewstate_transition.sdd`
   - `examples/service_blueprint_slice.sdd`
8. Generate deterministic snapshots:
   - `snapshots/<example>.compiled.json`
   - `snapshots/<example>.<view_id>.projection.json` for at least two views per example.
9. Add `manifest.yaml` last, with all relative paths and profile metadata finalized.

## `views` Stub Definition (Decision-Complete)
| view_id | include_node_types | include_edge_types | hierarchy_edges | ordering_edges | stub TODO placeholders |
|---|---|---|---|---|---|
| `outcome_opportunity_map` | `Outcome, Metric, Opportunity, Initiative` | `MEASURED_BY, SUPPORTS, ADDRESSES, IMPLEMENTED_BY, INSTRUMENTED_AT` | none | none | metric placement grouping policy |
| `journey_map` | `Stage, Step` | `CONTAINS, PRECEDES` | `CONTAINS` | `PRECEDES` | optional Opportunity reference rendering |
| `service_blueprint` | `Step, Process, SystemAction, DataEntity, Policy` | `REALIZED_BY, DEPENDS_ON, READS, WRITES, CONSTRAINED_BY, PRECEDES` | none | `PRECEDES` | lane mapping by `visibility` |
| `ia_place_map` | `Area, Place` | `CONTAINS, NAVIGATES_TO` | `CONTAINS` | none | entry-point and access annotation display |
| `scenario_flow` | `Step, Place, ViewState` | `PRECEDES, REALIZED_BY, NAVIGATES_TO, TRANSITIONS_TO` | none | `PRECEDES` | decision-node rendering convention |
| `ui_contracts` | `Place, ViewState, Component, State, Event, DataEntity, SystemAction` | `COMPOSED_OF, CONTAINS, TRANSITIONS_TO, EMITS, BINDS_TO, DEPENDS_ON` | `COMPOSED_OF, CONTAINS` | `TRANSITIONS_TO` | state-vs-viewstate emphasis policy |

## Phase B: Markdown Sync Plan
1. Clarify source-of-truth phrasing:
   - `definitions/v0.1/*.md` are normative input for v0.1 extraction.
   - `bundle/v0.1` becomes machine-readable governing artifact after extraction.
2. Align vocabulary lists in prose with `core/vocab.yaml`.
3. Align endpoint contract tables/descriptions with `core/contracts.yaml`.
4. Align view descriptions with `core/views.yaml` stub semantics and explicit TODO markers.
5. Clarify core vs profile boundaries in docs:
   - Core: syntax, schema, endpoint legality, deterministic compilation.
   - Profiles: governance rules and stricter organizational conventions.
6. Keep edits minimal and non-semantic; no introduction of new tokens.

## Validation and Test Scenarios
1. Schema extraction test:
   - `core/schema.json` parses as valid JSON and still matches documented `$schema`, `$id`, enums, patterns.
2. Vocabulary consistency test:
   - token set equality across `schema.json`, `vocab.yaml`, `ebnf`, `authoring`.
3. Contract coverage test:
   - every relationship token has an entry in `contracts.yaml` with non-empty allowed endpoints.
4. Profile severity test:
   - same invalid model yields warnings in permissive and errors in strict for governance rules.
5. Event reference strictness test:
   - `[Event]` label accepted in permissive, rejected in strict when ID requirement applies.
6. ViewState parentage test:
   - `place_id` without `CONTAINS` handled per profile rule; strict must enforce explicit edge or derived marker.
7. Determinism test:
   - compiling same `.sdd` twice yields byte-identical `compiled.json`.
8. Snapshot regression test:
   - projection outputs stable and ordered deterministically.
9. Negative tests:
   - unknown token, bad ID pattern, invalid endpoint pair, missing `BINDS_TO.field`, dangling edge refs.

## Acceptance Criteria
1. `bundle/v0.1` contains all required files plus 3 examples and snapshots.
2. `core/views.yaml` is executable for type-filter projection and explicitly marked as stub for missing conventions.
3. No v0.1 vocab expansion beyond canonical token sets.
4. Profiles behave differently and intentionally (`permissive` warn-oriented, `strict` strict governance).
5. Markdown and bundle semantics are aligned with a concise ambiguity report.

## Assumptions and Defaults
1. Canonical JSON compilation remains literal; no inferred inverse edges in compiled output.
2. Prop values in core remain permissive per schema; typed-field enforcement belongs to profiles.
3. Non-canonical relationship aliases from concept docs are informative only and not admitted to core vocab.
4. `permissive.yaml` is explicit even if partially redundant, to stabilize tool configuration contracts.
5. View conventions lacking strict normative language remain TODO placeholders, not enforced rules.
