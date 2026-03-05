# SDD-Text v0.1 Bundle Extraction and Sync Report

## Summary

This report documents how `bundle/v0.1` was generated from v0.1 markdown sources, which ambiguities were resolved, and which markdown edits were applied to keep prose and bundle aligned.

## Extraction Map

- `bundle/v0.1/core/schema.json`
  - Source: `definitions/v0.1/json_schema_sdd_text_v_0_dot_1.md`
  - Method: direct extraction of the normative JSON code block with formatting-only normalization.
- `bundle/v0.1/core/vocab.yaml`
  - Sources: `definitions/v0.1/readme_structured_design_diagrams_sdd_text_v_0_dot_1.md`, `definitions/v0.1/authoring_spec_type_first_dsl_sdd_text_v_0_dot_1.md`, `definitions/v0.1/ebnf_grammar_sdd_text_v_0_dot_1.md`, `definitions/v0.1/json_schema_sdd_text_v_0_dot_1.md`
  - Method: closed token set from canonical enums/token lists; no token expansion.
- `bundle/v0.1/core/contracts.yaml`
  - Source: `definitions/v0.1/endpoint_contracts_semantic_rules_sdd_text_v_0_dot_1.md`
  - Method: endpoint pairs and constraints encoded as machine-loadable rules with profile-aware severities.
- `bundle/v0.1/core/views.yaml`
  - Sources: `definitions/v0.1/readme_structured_design_diagrams_sdd_text_v_0_dot_1.md`, `initial_concepts/Initial Concepts1 a 6-Diagram Suite v0dot1.md`, `initial_concepts/Initial Concepts2 One-page Schema v0dot1.md`
  - Method: typed projection stub with executable include filters and TODO placeholders for under-specified conventions.
- `bundle/v0.1/profiles/permissive.yaml`
  - Sources: endpoint contract conformance guidance plus governance recommendations from `initial_concepts/Initial Concepts2 One-page Schema v0dot1.md`.
- `bundle/v0.1/profiles/recommended.yaml`
  - Sources: same as permissive, with strict severity escalation and explicit policy checks.
- `bundle/v0.1/examples/*.sdd` and `bundle/v0.1/snapshots/*`
  - Source basis: grammar and authoring rules from `definitions/v0.1/authoring_spec_type_first_dsl_sdd_text_v_0_dot_1.md` and `definitions/v0.1/ebnf_grammar_sdd_text_v_0_dot_1.md`.

## Ambiguities Encountered and Resolutions

- Source-of-truth tension between top-level readmes and extraction guidance.
  - Resolution: transitional split encoded in docs; markdown is normative input for extraction, bundle governs machine behavior post-extraction.
- View definitions are less operational than syntax/contracts.
  - Resolution: `core/views.yaml` implemented as typed projection stub with explicit `status: stub` and `todo_placeholders`.
- Concept docs mention non-canonical relationship aliases.
  - Resolution: aliases recorded under `aliases_informative` in vocab; no additions to canonical relationship token set.
- Event annotation strictness (`[Event]` as label vs ID).
  - Resolution: permissive profile allows labels with warning; recommended profile requires Event node ID references for `TRANSITIONS_TO`.
- `ViewState` parentage (`place_id` vs `CONTAINS`).
  - Resolution: `place_id` treated as authoritative field; recommended profile requires explicit `CONTAINS` or explicitly marked derived containment.

## Markdown Sync Edits Applied

- `Readme.md`
  - Corrected wording and added explicit transitional source-of-truth policy.
- `Readme - role of definitions and spec bundle files.md`
  - Clarified extraction-time and post-extraction governance responsibilities.
- `definitions/v0.1/readme_structured_design_diagrams_sdd_text_v_0_dot_1.md`
  - Added `v0.1 Bundle Alignment` section and profile-aware validation note.
- `definitions/v0.1/json_schema_sdd_text_v_0_dot_1.md`
  - Added machine-readable extraction target path note.
- `definitions/v0.1/endpoint_contracts_semantic_rules_sdd_text_v_0_dot_1.md`
  - Added machine-readable extraction target path note.

## Determinism Notes

- Compiled snapshot JSON files use stable node ordering by `id` and deterministic edge ordering by `(from, type, to, event, guard, effect, props)`.
- Projection snapshots are JSON-only and deterministic, with explicit note lines when edges are omitted due to node-type filtering.
