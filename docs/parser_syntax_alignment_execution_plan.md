# Parser Syntax Alignment Execution Plan

## Purpose

This document turns `docs/parser_syntax_alignment_guidance.md` into an
detailed execution plan.

It is intentionally written for option `c`:

- one durable plan document
- followed by serial `Plan Mode` implementation slices
- with acceptance checks between slices

This is not a "fix the seven known mismatches and move on" plan. The target is
to make `bundle/v0.1/core/syntax.yaml` the executable parser contract for line
classification and statement/block parsing, while preserving valid existing
examples and avoiding a second generation of hard-coded parser drift.

## Planning Model

Use this document as the stable strategy artifact. Do not try to execute the
whole migration in one long implementation thread.

Execution cadence:

1. Select one slice from this document.
2. Enter `Plan Mode` for that slice only.
3. Restate the slice scope, invariants, files, and verification plan.
4. Implement and verify the slice.
5. Report:
   - satisfied invariants
   - violated invariants
   - residual risks
   - recommended next slice
6. Do not begin the next slice until the current slice is accepted.

Concurrency rule:

- use sequential execution for parser-core work
- allow at most one writing thread at a time on the parser core
- optional read-only sidecar review is acceptable between slices, but do not run
  concurrent coding agents on parser-core files

Parser-core files that should not be edited concurrently:

- `src/parser/classifyLine.ts`
- `src/parser/parseSource.ts`
- `src/parser/parseBlock.ts`
- `src/bundle/types.ts`

## Authority And Grounding

Authority order for this migration:

1. `docs/parser_syntax_alignment_guidance.md`
2. `bundle/v0.1/core/syntax.yaml`
3. `definitions/v0.1/ebnf_grammar_sdd_text_v_0_dot_1.md`
4. `definitions/v0.1/authoring_spec_type_first_dsl_sdd_text_v_0_dot_1.md`
5. `docs/toolchain/architecture.md`
6. current parser implementation as evidence of current behavior, not authority

Interpretation rules:

- the guidance document defines the mandate, acceptance target, and concrete
  mismatch list
- `syntax.yaml` is the machine-readable parser contract we are making
  executable
- the grammar and authoring spec explain how `syntax.yaml` should be read when a
  field meaning or precedence question needs clarification
- the architecture doc constrains implementation direction toward generic
  interpretation over bundle-owned syntax
- current parser code is useful for understanding spans, diagnostics, and output
  shape, but it does not override the syntax contract when they disagree

## Non-Negotiable Invariants

The implementation must preserve these invariants throughout the migration:

- `bundle/v0.1/core/syntax.yaml` becomes the executable parser contract for line
  classification and statement/block parsing
- changing the declared syntax contract in `syntax.yaml` changes parser behavior
  without editing parser grammar code
- the current parser/spec mismatches listed in the guidance are eliminated
- existing valid bundle examples continue to parse and compile
- parser tests are added for every currently confirmed divergence
- parser, compiler, validator, and projection behavior stay unchanged unless the
  syntax contract explicitly requires a parser-stage change
- no step may declare success by weakening the docs or deleting large parts of
  `syntax.yaml`
- no step may normalize divergence by relabeling executable syntax fields as
  "metadata only"

Repo-level operating invariants from `AGENTS.md` also apply:

- spec-first planning
- proof-case before generalization
- acceptance before snapshots or artifact refresh
- explicit mismatch reporting after each substantial pass
- stop instead of coding through contradictions

## Scope Boundary

This migration is about making the parser executable from the syntax contract,
not about broadening parsing into semantics owned elsewhere.

Fields that must become parser-driving for this migration:

- `token_sources.*`
- `document.version_declaration.*` where behavior is parser-relevant
- `document.leading_lines_allowed`
- `document.top_level_block_kind`
- `document.trailing_lines_allowed`
- `document.minimum_top_level_blocks`
- `line_kinds[*].precedence`
- `line_kinds[*].statement`
- `line_kinds[*].statements`
- `statements.*` fields needed for classification, comment policy, sequence
  parsing, and emitted parse-node fields
- `blocks.*`
- `atoms.event_atom`
- `atoms.effect_atom`
- `atoms.guard_text`
- `atoms.edge_property`

Fields that may remain metadata in this migration unless a later slice proves
they are needed for acceptance:

- `version`
- `artifact`
- `boundaries.*`
- `parse_output_contract.*`

Those metadata fields may still be used for tests, assertions, or future
hardening, but they do not need to become parser-driving before this migration
can be considered complete.

## Current Reality And Risks

The current parser is compact, but the drift is structural rather than local.

Current code concentration:

- `src/parser/classifyLine.ts` hard-codes line classification precedence,
  comment stripping, and direct token lookup behavior
- `src/parser/parseSource.ts` hard-codes version declaration handling and
  document structure behavior
- `src/parser/parseBlock.ts` hard-codes statement parsing, edge suffix parsing,
  atom behavior, and block structure

Current migration risks:

- `src/bundle/types.ts` models only a small subset of `syntax.yaml`, so the
  executable contract cannot be interpreted cleanly yet
- tests are mainly end-to-end compile or diagnostics tests, not direct
  parser-contract tests
- parse output feeds compilation immediately, so unnecessary parse-node shape
  churn can create wide regressions
- source spans and diagnostics must stay stable enough that parser fixes do not
  accidentally degrade downstream error reporting

## Success Criteria

This migration is complete only when all of the following are true:

1. line classification is driven by `line_kinds` plus `token_sources`
2. statement parsing is driven by `statements`
3. block parsing is driven by `blocks`
4. event/effect/property subgrammars are driven by `atoms`
5. the seven confirmed mismatches from the guidance are closed
6. valid bundle examples still compile cleanly
7. tests demonstrate that parser behavior changes when syntax-contract data
   changes
8. no remaining parser-core path bypasses executable `syntax.yaml` fields for
   the contract surface listed above

## Slice Overview

1. Contract-locking parser tests
2. Executable syntax runtime layer
3. Interpreter-driven line classification and token-source lookup
4. Interpreter-driven statement and atom parsing
5. Interpreter-driven document and block parsing
6. Hardening, proof tests, and closeout

## [Done] Slice 1: Contract-Locking Parser Tests

### Goal

Add parser-focused tests that lock the current acceptance target before the
interpreter refactor begins.

### Why This Slice Exists

The repo currently has strong end-to-end compile coverage, but weak direct
coverage of parser-contract behavior. This migration needs proof cases that
directly express the syntax contract and the known divergences.

### In Scope

- add direct parser or compile-level tests for every confirmed mismatch in the
  guidance
- add fixtures for inputs that should now succeed or fail at parse
- add regression coverage for valid manifest examples continuing to compile
- capture current diagnostic-code expectations where they are part of the
  contract

### Out Of Scope

- generic interpreter architecture
- bundle type expansion
- broad parser rewrites

### Required Proof Cases

At minimum, add explicit tests for:

- comment-only input failing at parse because of
  `document.minimum_top_level_blocks`
- version declaration with trailing comment rejecting or accepting strictly
  according to `syntax.yaml`
- out-of-order edge suffixes rejecting because of
  `statements.edge_line.fixed_order`
- missing whitespace between successive edge suffix parts rejecting because of
  `statements.edge_line.sequence`
- invalid event text rejecting because of `atoms.event_atom`
- invalid bare effect text rejecting because of `atoms.effect_atom`
- quoted edge-property values with spaces parsing successfully because of
  `atoms.edge_property`

### Deliverables

- one focused parser-contract test file or small test group dedicated to this
  migration
- minimal fixtures for the mismatch cases
- a documented acceptance list mapping each test to the contract field it proves

### Done When

- every confirmed divergence has a direct test
- the proof-case tests fail on current drift and are ready to turn green as the
  implementation advances
- valid bundle examples remain covered

## [Done] Slice 2: Executable Syntax Runtime Layer

### Goal

Create a runtime representation of the executable subset of `syntax.yaml` that
the parser can interpret directly.

### Why This Slice Exists

The current `SyntaxConfig` type only exposes a small subset of the syntax
contract. Without a richer runtime model, the parser refactor will either rely
on `any`-shaped access or duplicate the YAML structure in ad hoc helper code.

### In Scope

- expand `src/bundle/types.ts` or introduce a normalized parser-syntax runtime
  layer for the executable contract subset
- define typed access for:
  - token sources
  - line kinds and classifiers
  - statement sequences
  - block definitions
  - atom definitions
- add helper utilities for token-source resolution, regex lookup, and contract
  normalization where needed

### Out Of Scope

- full parser behavior change
- statement interpreter rollout
- block parser rewrite

### Deliverables

- parser-usable runtime types for the executable contract subset
- helper functions that resolve `token_sources` rather than bypassing them with
  direct `bundle.vocab` assumptions
- a clear boundary between executable syntax fields and metadata-only fields

### Done When

- parser code can read the executable syntax contract without untyped
  object-walking
- token lookup wiring can be resolved from `syntax.yaml`
- the runtime layer is ready to support later interpreter slices without another
  round of structure churn

## Slice 3: Interpreter-Driven Line Classification And Token-Source Lookup

### Goal

Make line classification flow from `line_kinds` and `token_sources` instead of
hard-coded precedence and direct `bundle.vocab` reads.

### Why This Slice Exists

The parser cannot claim `syntax.yaml` is executable while classification order,
statement mapping, and token-source behavior remain hard-coded in
`classifyLine.ts`.

### In Scope

- interpret `line_kinds[*].precedence`
- interpret `line_kinds[*].statement` and `line_kinds[*].statements`
- interpret classifier forms used by the current contract:
  - `trimmed_equals`
  - `first_non_whitespace`
  - `first_token_source`
  - `next_token_source`
  - `leading_identifier_before_equals`
  - `any_of`
- route token lookup through `token_sources`
- keep classification output stable enough for downstream parser phases

### Out Of Scope

- full statement sequence parsing
- block parser rewrite
- parse-output node redesign

### Deliverables

- interpreter-based line classification
- removal of direct `bundle.vocab.node_types[*].token` and
  `bundle.vocab.relationship_types[*].token` bypasses from classification logic
- tests proving precedence and statement mapping are coming from the syntax
  contract

### Done When

- classification order is data-driven
- token-source lookup is syntax-driven
- changing a relevant `line_kinds` or `token_sources` entry changes
  classification behavior without changing parser grammar code

## Slice 4: Interpreter-Driven Statement And Atom Parsing

### Goal

Replace the hand-written statement grammar in `parseSource.ts` and
`parseBlock.ts` with interpretation of `statements` and `atoms`.

### Why This Slice Exists

Most of the current parser promise drift lives here: edge suffix ordering,
whitespace handling, event/effect validation, trailing-comment policy, and
edge-property parsing are all currently expressed as code rather than as
interpreted syntax data.

### In Scope

- interpret statement sequences for:
  - `version_decl`
  - `top_node_header`
  - `nested_node_header`
  - `property_line`
  - `edge_line`
  - `end_line`
- interpret statement-level comment policy from `trailing_comment`
- interpret atom forms required by the current contract:
  - `quoted_string`
  - `event_atom`
  - `effect_atom`
  - `guard_text`
  - `edge_property`
- support the sequence features used in `syntax.yaml`:
  - `literal`
  - `whitespace`
  - `capture`
  - `pattern_ref`
  - `atom`
  - `one_of`
  - `optional`
  - `repeat`
  - `enclosure`

### Out Of Scope

- full block recursion rewrite
- broad parse-node model redesign
- compile-stage or schema-stage behavior changes unrelated to parser authority

### Deliverables

- generic statement-sequence interpreter
- generic atom interpreter for the currently used atom forms
- explicit closure of the mismatch cases involving:
  - version trailing comments
  - edge suffix fixed order
  - required whitespace before edge suffix groups
  - invalid event text
  - invalid effect text
  - quoted edge-property values with spaces

### Done When

- these statement forms are parsed from interpreted syntax data rather than
  bespoke grammar code
- the known mismatch cases above are green against the new tests
- parse-node output shape remains compatible with compilation unless the syntax
  contract explicitly requires a parser-stage change

## Slice 5: Interpreter-Driven Document And Block Parsing

### Goal

Move document structure and block structure under `document` and `blocks`
authority.

### Why This Slice Exists

Even with statement parsing improved, the parser still would not be genuinely
syntax-driven if top-level block rules, leading/trailing trivia rules, minimum
block count, and block header/body/terminator rules stayed hard-coded.

### In Scope

- interpret:
  - `document.version_declaration.allowed`
  - `document.version_declaration.required`
  - `document.version_declaration.statement_kind`
  - `document.leading_lines_allowed`
  - `document.top_level_block_kind`
  - `document.trailing_lines_allowed`
  - `document.minimum_top_level_blocks`
- interpret:
  - `blocks.top_node_block.*`
  - `blocks.nested_node_block.*`
- preserve source spans and diagnostic stability where possible
- ensure nested block recursion follows block definitions rather than hand-coded
  assumptions

### Out Of Scope

- semantic validation rules
- parse-output-contract-driven AST redesign
- unrelated compiler cleanup

### Deliverables

- syntax-driven document parser flow
- syntax-driven block parser flow
- closure of the remaining mismatch around
  `document.minimum_top_level_blocks`

### Done When

- comment-only input fails at parse because the syntax contract requires at
  least one top-level block
- top-level and nested block parsing follow `blocks` definitions
- document-level allowed/required rules are contract-driven rather than
  incidental code behavior

## Slice 6: Hardening, Proof Tests, And Closeout

### Goal

Prove that parser behavior now follows the syntax contract, remove stale
hard-coded bypasses, and close the migration with explicit evidence.

### Why This Slice Exists

It is not enough for the parser to "look more generic." This migration should
end with concrete proof that declarative contract edits drive parser behavior.

### In Scope

- remove stale hard-coded grammar paths that bypass executable syntax fields
- add proof tests that modify relevant syntax data in-memory and verify parser
  behavior changes accordingly
- add any necessary docs updates if the final implementation changes documented
  parser architecture or workflow
- perform a final pass for diagnostic wording, helper cleanup, and contract
  traceability

### Out Of Scope

- broad redesign of parse output shape
- opportunistic parser feature expansion beyond the current contract
- changing metadata-only syntax fields into executable fields without acceptance
  need

### Deliverables

- proof tests showing contract-driven behavior change
- removal of remaining direct grammar bypasses on the executable contract
  surface
- closeout note summarizing satisfied and unsatisfied invariants

### Done When

- at least one test demonstrates that changing syntax-contract data changes
  parser behavior without parser grammar edits
- no known parser-core bypass remains for the executable contract surface
- the bundle example corpus still compiles
- the migration can be described truthfully as removing the "partly executable"
  qualifier from parser behavior

## Verification Strategy

Run verification in increasing scope. Always set `TMPDIR=/tmp`.

Recommended order:

- `TMPDIR=/tmp pnpm run build`
- focused parser tests for the active slice
- `TMPDIR=/tmp pnpm exec vitest run tests/diagnostics.spec.ts tests/compile.spec.ts`
- `TMPDIR=/tmp pnpm test`

Additional acceptance checks:

- manifest example inputs still compile cleanly
- comment-only input now fails at parse, not only downstream
- no current valid example starts failing unless the syntax contract explicitly
  requires tightening and that tightening is documented
- no snapshot or artifact refresh is used to hide a parser-regression mismatch

## Stop Conditions

Stop and escalate instead of pushing through if any of the following occurs:

- the easiest path appears to be trimming `syntax.yaml` or weakening docs to fit
  current parser behavior
- a slice would require refreshing tests or snapshots to normalize behavior that
  still contradicts the guidance invariants
- the generic interpreter approach starts producing structurally different parse
  output without a contract-based reason
- token-source interpretation cannot be implemented cleanly with the current
  bundle-loading model and needs an architectural decision
- parse diagnostics or spans regress materially and the change is not clearly
  required by the syntax contract

## Per-Slice `Plan Mode` Checklist

Every implementation slice should begin by explicitly recording:

1. the selected slice and what is out of scope
2. the exact invariants being tested in that slice
3. the files expected to change
4. the focused verification commands for that slice
5. the conditions that would require stopping instead of broadening scope

Every slice should end by explicitly reporting:

1. satisfied invariants
2. violated invariants
3. files changed
4. commands run and outcomes
5. residual risks
6. whether the next slice is now safe to begin

## Recommended Starting Point

Start with Slice 1, not with parser refactoring.

Rationale:

- it creates the proof-case harness required by the guidance
- it reduces the chance of accidental "generic-looking" drift
- it gives later `Plan Mode` slices concrete green/red targets
- it makes acceptance decisions easier when the implementation touches all three
  parser-core files
