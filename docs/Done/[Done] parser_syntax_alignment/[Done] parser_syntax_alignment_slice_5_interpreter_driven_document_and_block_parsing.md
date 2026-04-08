# [Done] Parser Syntax Alignment Slice 5: Interpreter-Driven Document And Block Parsing

## Goal

Slice 5 moves document flow and block ownership under the executable
`document` and `blocks` contract, closing the final remaining Slice 1 drift
case around `document.minimum_top_level_blocks`.

This slice is intentionally bounded:

- document flow is now driven by `document.version_declaration.*`,
  `leading_lines_allowed`, `top_level_block_kind`,
  `trailing_lines_allowed`, and `minimum_top_level_blocks`
- block parsing is now driven by `blocks.*.header_statement`,
  `body_item_kinds`, `terminator_statement`, and `emits.fields`
- public parse-node shapes remain unchanged
- compile-stage and validation-stage behavior remain outside this slice

## Acceptance Mapping

| Deliverable | Evidence |
| --- | --- |
| document flow is syntax-driven | `src/parser/parseSource.ts` now consumes `runtime.syntax.document` rather than hard-coded top-node assumptions |
| top-level block selection comes from `document.top_level_block_kind` | `parseSource(...)` resolves the configured top-level block and passes that block name into `parseNodeBlock(...)` |
| block parsing is block-name-driven rather than header-kind-driven | `src/parser/parseBlock.ts` resolves block config through `getBlock(runtime, blockName)` |
| block body ownership comes from `body_item_kinds` | `parseNodeBlock(...)` derives allowed statements and nested blocks from configured body items |
| block assembly comes from block emits | `buildNodeBlockFromSyntax(...)` resolves `header_kind`, `node_type`, `id`, `name`, and `body_items` from `blocks.*.emits.fields` |
| document minimum block count is enforced | `tests/parserSyntaxAlignment.spec.ts` now passes the comment-only proof case with `parse.minimum_top_level_blocks` |
| direct document/block authority proof tests exist | `tests/parserDocumentBlockParsing.spec.ts` covers minimum blocks, version rules, renamed block refs, body-item legality, and renamed terminators |

## Implementation Steps

1. [Done] Refactor `parseSource` so document flow is driven by
   `runtime.syntax.document`, including version declaration rules, top-level
   block selection, document trivia policy, and minimum top-level block count.

2. [Done] Refactor `parseNodeBlock` so block parsing is driven by block names
   and `blocks.*` config instead of hard-coded `top_node_header` and
   `nested_node_header` expectations.

3. [Done] Make block emits drive `NodeBlock` construction by resolving
   `blocks.*.emits.fields` against header captures and parsed body items.

4. [Done] Add `tests/parserDocumentBlockParsing.spec.ts` to lock the document-
   and block-authority behavior directly against cloned syntax contracts.

5. [Done] Run verification in this order:
   - `TMPDIR=/tmp pnpm run build`
   - `TMPDIR=/tmp pnpm exec vitest run tests/parserSyntaxRuntime.spec.ts tests/parserLineClassification.spec.ts tests/parserStatementParsing.spec.ts tests/parserDocumentBlockParsing.spec.ts`
   - `TMPDIR=/tmp pnpm exec vitest run tests/parserSyntaxAlignment.spec.ts`
   - `TMPDIR=/tmp pnpm exec vitest run tests/diagnostics.spec.ts tests/compile.spec.ts`
   - `TMPDIR=/tmp pnpm test`

6. [Done] Accept the slice only if:
   - `parseSource` uses `document.version_declaration.*`,
     `leading_lines_allowed`, `top_level_block_kind`,
     `trailing_lines_allowed`, and `minimum_top_level_blocks`
   - `parseNodeBlock` uses `blocks.*.header_statement`, `body_item_kinds`,
     `terminator_statement`, and `emits.fields`
   - `tests/parserSyntaxAlignment.spec.ts` is fully green
   - manifest examples still parse and compile cleanly
   - the full test suite passes with no remaining parser-alignment failures

## Status

- Verification outcomes:
  - `TMPDIR=/tmp pnpm run build`: passed
  - `TMPDIR=/tmp pnpm exec vitest run tests/parserSyntaxRuntime.spec.ts tests/parserLineClassification.spec.ts tests/parserStatementParsing.spec.ts tests/parserDocumentBlockParsing.spec.ts`:
    passed
  - `TMPDIR=/tmp pnpm exec vitest run tests/parserSyntaxAlignment.spec.ts`:
    passed
  - `TMPDIR=/tmp pnpm exec vitest run tests/diagnostics.spec.ts tests/compile.spec.ts`:
    passed
  - `TMPDIR=/tmp pnpm test`: passed; suite summary was 34 passing files,
    232 passing tests, 0 failures
- Document parsing is now driven by the executable `document` config rather
  than hard-coded top-level parser assumptions.
- Block parsing is now driven by executable `blocks` config, including block
  ownership, nested recursion, terminator selection, and block emits.
- The remaining Slice 1 proof case is now closed, and
  `tests/parserSyntaxAlignment.spec.ts` is fully green.
- Slice 5 is now formally accepted as complete.
- The master plan heading in
  `docs/parser_syntax_alignment_execution_plan.md` has been promoted to
  `[Done]`.
