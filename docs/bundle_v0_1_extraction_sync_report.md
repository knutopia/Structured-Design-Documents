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
- `bundle/v0.1/core/syntax.yaml`
  - Sources: `definitions/v0.1/ebnf_grammar_sdd_text_v_0_dot_1.md`, `definitions/v0.1/authoring_spec_type_first_dsl_sdd_text_v_0_dot_1.md`
  - Method: normalized extraction of normative source syntax into a machine-loadable, line-oriented parser contract; canonical token inventories remain referenced from `bundle/v0.1/core/vocab.yaml` to avoid duplication.
- `bundle/v0.1/core/contracts.yaml`
  - Source: `definitions/v0.1/endpoint_contracts_semantic_rules_sdd_text_v_0_dot_1.md`
  - Method: endpoint pairs and constraints encoded as machine-loadable rules with profile-aware severities.
- `bundle/v0.1/core/projection_schema.json`
  - Source: normalized projection contract decisions derived from `bundle/v0.1/core/views.yaml` and the projection snapshots themselves.
  - Method: new downstream-only schema for renderer-facing projection JSON; no source-authoring impact.
- `bundle/v0.1/core/views.yaml`
  - Sources: `definitions/v0.1/readme_structured_design_diagrams_sdd_text_v_0_dot_1.md`, `initial_concepts/Initial Concepts1 a 6-Diagram Suite v0dot1.md`, `initial_concepts/Initial Concepts2 One-page Schema v0dot1.md`
  - Method: operational projection definitions with executable include filters and renderer defaults for resolved view conventions.
- `bundle/v0.1/profiles/permissive.yaml`
  - Sources: endpoint contract conformance guidance plus governance recommendations from `initial_concepts/Initial Concepts2 One-page Schema v0dot1.md`.
- `bundle/v0.1/profiles/recommended.yaml`
  - Sources: same as permissive, with strict severity escalation and explicit policy checks.
- `bundle/v0.1/examples/*.sdd` and `bundle/v0.1/snapshots/*`
  - Source basis: grammar and authoring rules from `definitions/v0.1/authoring_spec_type_first_dsl_sdd_text_v_0_dot_1.md` and `definitions/v0.1/ebnf_grammar_sdd_text_v_0_dot_1.md`.

## Ambiguities Encountered and Resolutions

- Source-of-truth tension between top-level readmes and extraction guidance.
  - Resolution: transitional split encoded in docs; markdown is normative input for extraction, bundle governs machine behavior post-extraction.
- Grammar and authoring spec are intentionally compatible but distribute syntax detail differently because they serve different audiences.
  - Resolution: `core/syntax.yaml` treats the grammar doc as primary for formal structure, lexical precision, and parse precedence, and uses the authoring spec for operational clarifications such as default version behavior and fixed edge-element order.
- View definitions were initially less operational than syntax/contracts.
  - Resolution: `core/views.yaml` now encodes explicit renderer defaults for metric annotations, opportunity references, lane mapping, IA metadata, branching decisions, and ViewState-vs-State precedence.
- Projection snapshots had view-specific top-level shapes that were harder to consume consistently.
  - Resolution: projection outputs now share `core/projection_schema.json` plus a common envelope with `derived`, `omissions`, and `notes`; normalization remains downstream-only.
- Concept docs mention non-canonical relationship aliases.
  - Resolution: aliases recorded under `aliases_informative` in vocab; no additions to canonical relationship token set.
- Event annotation strictness (`[Event]` as label vs ID).
  - Resolution: permissive profile allows labels with warning; recommended profile requires Event node ID references for `TRANSITIONS_TO`.
- Unknown backslash escapes in quoted source strings.
  - Resolution: `core/syntax.yaml` preserves `\\"` and `\\\\` as standardized escapes and treats other backslash sequences as literal characters for v0.1 parser behavior.
- `ViewState` parentage (`place_id` vs `CONTAINS`).
  - Resolution: `place_id` treated as authoritative field; recommended profile requires explicit `CONTAINS` or explicitly marked derived containment.

## Markdown Sync Edits Applied

- `Readme.md`
  - Corrected wording and added explicit transitional source-of-truth policy.
- `Readme - role of definitions and spec bundle files.md`
  - Clarified extraction-time and post-extraction governance responsibilities.
- `definitions/v0.1/readme_structured_design_diagrams_sdd_text_v_0_dot_1.md`
  - Added `v0.1 Bundle Alignment` section, profile-aware validation note, and short design-note rationale for downstream projection normalization.
- `definitions/v0.1/ebnf_grammar_sdd_text_v_0_dot_1.md`
  - Added machine-readable extraction target note and clarified its primary role for formal structure, lexical precision, and parse precedence during `core/syntax.yaml` extraction.
- `definitions/v0.1/authoring_spec_type_first_dsl_sdd_text_v_0_dot_1.md`
  - Added machine-readable extraction target note and clarified its companion role for operational authoring and canonical-compilation guidance during `core/syntax.yaml` extraction.
- `definitions/v0.1/json_schema_sdd_text_v_0_dot_1.md`
  - Added machine-readable extraction target path note.
- `definitions/v0.1/endpoint_contracts_semantic_rules_sdd_text_v_0_dot_1.md`
  - Added machine-readable extraction target path note.
- `docs/bundle_creation_guidance_sdd_text_v_0_dot_1.md`
  - Updated artifact inventory and projection snapshot guidance to include the normalized projection contract.

## Projection Normalization Rationale

- Shared projection envelope
  - Problem: projection snapshots used different top-level layouts by view.
  - Refinement: all projections now use one envelope with `schema`, `version`, `view_id`, `source_example`, `nodes`, `edges`, `derived`, `omissions`, and `notes`.
  - Boundary: this is a renderer-facing contract only; `.sdd` authoring stays unchanged.
- Structured omissions
  - Problem: omitted edges were previously explained only in freeform note text.
  - Refinement: material filtered edges now use structured `omissions` records with explicit reasons.
  - Boundary: omission records describe projection behavior after compilation; they do not add source syntax.
- Common derived-data container
  - Problem: annotations, lanes, branch labels, and graph-priority hints were scattered across view-specific JSON fields.
  - Refinement: all non-literal render data now lives under `derived`.
  - Boundary: source models remain literal; only downstream projection artifacts carry derived render information.
- Deterministic ordering for derived output
  - Problem: derived arrays had no explicit cross-view ordering contract.
  - Refinement: projection outputs now sort nodes, edges, derived arrays, and omission records deterministically.
  - Boundary: ordering rules stabilize tooling and diffs only; authors do not need to write differently.
- Formal projection schema
  - Problem: projection JSON had no standalone contract for future tools to target.
  - Refinement: `core/projection_schema.json` now defines the normalized projection output shape.
  - Boundary: the new schema constrains projection artifacts only, not `.sdd` source files.

## Determinism Notes

- Compiled snapshot JSON files use stable node ordering by `id` and deterministic edge ordering by `(from, type, to, event, guard, effect, props)`.
- Projection snapshots now share a normalized envelope and deterministic ordering for nodes, edges, derived arrays, and omission records.
