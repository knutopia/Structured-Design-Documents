# [Done] Parser Syntax Alignment Slice 3: Interpreter-Driven Line Classification And Token-Source Lookup

## Goal

Slice 3 makes parser line classification flow from the accepted Slice 2 runtime
layer instead of from hard-coded precedence and direct vocabulary reads.

This slice is intentionally narrow:

- classification is now interpreter-driven
- token-source lookup is now runtime-driven
- statement parsing and block parsing remain hand-written in this slice
- the accepted Slice 1 drift harness remains unchanged in outcome

## Acceptance Mapping

| Deliverable | Evidence |
| --- | --- |
| parser creates the syntax runtime once per parse and reuses it through block parsing | `src/parser/parseSource.ts` constructs `createParserSyntaxRuntime(bundle)` once and passes it through `parseNodeBlock` |
| line classification is driven by `line_kinds[*].precedence` and classifier clauses | `src/parser/classifyLine.ts` iterates `runtime.lineKindsInPrecedenceOrder` and interprets `trimmed_equals`, `first_non_whitespace`, `first_token_source`, `next_token_source`, `leading_identifier_before_equals`, and `any_of` |
| statement-kind resolution is driven by `line_kinds[*].statement` / `statements` plus `statement.match` | `src/parser/classifyLine.ts` resolves single-statement and multi-statement line kinds, including `blank_or_comment` |
| classification token lookup uses `token_sources` instead of direct vocab bypasses | `src/parser/classifyLine.ts` resolves token membership through `getTokenSource(runtime, ...)` |
| downstream parser behavior remains stable in this slice | `tests/parserSyntaxAlignment.spec.ts` still reports the same intended 8 Slice 1 drift failures |
| dedicated classification proof tests exist | `tests/parserLineClassification.spec.ts` covers real-bundle classification and mutation-based contract proofs |

## Implementation Steps

1. [Done] Create the parser syntax runtime once per parse and thread it through
   `parseSource` and `parseNodeBlock` without caching it on `Bundle`.

2. [Done] Refactor `classifyLine` to interpret the current `line_kinds`
   contract from the runtime instead of using hard-coded classification order.

3. [Done] Add `lineKindKind` to `ClassifiedLine` so classification preserves
   both the resolved statement kind and the originating line-kind id.

4. [Done] Resolve multi-statement line kinds through `statement.match` and keep
   trailing-comment stripping limited to statements that explicitly allow it.

5. [Done] Remove direct `bundle.vocab.node_types[*].token` and
   `bundle.vocab.relationship_types[*].token` reads from classification logic.

6. [Done] Add `tests/parserLineClassification.spec.ts` to prove precedence,
   statement mapping, multi-statement resolution, and token-source wiring are
   contract-driven.

7. [Done] Run verification in this order:
   - `TMPDIR=/tmp pnpm run build`
   - `TMPDIR=/tmp pnpm exec vitest run tests/parserSyntaxRuntime.spec.ts tests/parserLineClassification.spec.ts`
   - `TMPDIR=/tmp pnpm exec vitest run tests/parserSyntaxAlignment.spec.ts`
   - `TMPDIR=/tmp pnpm exec vitest run tests/diagnostics.spec.ts tests/compile.spec.ts`
   - `TMPDIR=/tmp pnpm test`

8. [Done] Accept the slice only if:
   - classification order is runtime-driven from `line_kinds[*].precedence`
   - statement resolution is runtime-driven from `line_kinds[*].statement` /
     `statements` plus `statement.match`
   - token lookup in classification uses `token_sources`
   - `parseSource` / `parseBlock` behavior is unchanged aside from classifier
     plumbing
   - Slice 1 proof cases remain the same accepted 8 drift failures

## Status

- Verification outcomes:
  - `TMPDIR=/tmp pnpm run build`: passed
  - `TMPDIR=/tmp pnpm exec vitest run tests/parserSyntaxRuntime.spec.ts tests/parserLineClassification.spec.ts`:
    passed
  - `TMPDIR=/tmp pnpm exec vitest run tests/parserSyntaxAlignment.spec.ts`:
    failed with the same intended 8 Slice 1 drift cases and 1 passing manifest
    regression
  - `TMPDIR=/tmp pnpm exec vitest run tests/diagnostics.spec.ts tests/compile.spec.ts`:
    passed
  - `TMPDIR=/tmp pnpm test`: failed only because of the accepted Slice 1
    parser-alignment proof cases; suite summary was 31 passing files, 1 failing
    file, 212 passing tests, 8 failing tests
- Classification precedence is now driven by the syntax runtime rather than a
  hard-coded branch order.
- `blank_or_comment` now resolves through `statements.blank_line.match` and
  `statements.comment_line.match` instead of dedicated special-case code.
- Classification token-source lookup now flows through `token_sources`.
- `parseSource` still keeps version-declaration handling manual, and
  `parseBlock` still keeps statement parsing manual, by design for Slice 3.
- Slice 3 is now formally accepted as complete.
- The master plan heading in
  `docs/parser_syntax_alignment_execution_plan.md` has been promoted to
  `[Done]`.
