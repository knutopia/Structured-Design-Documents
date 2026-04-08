# [Done] Parser Syntax Alignment Slice 6: Hardening, Proof Tests, And Closeout

## Goal

Slice 6 closes the parser-syntax alignment migration by removing the remaining
parser-facing name assumptions, hardening executable-contract validation, and
adding end-to-end proof tests that show parser behavior changes from in-memory
syntax-contract edits rather than parser grammar edits.

This slice is intentionally bounded:

- parser-facing statement and header names are no longer fixed to current
  v0.1 identifiers
- runtime validation now rejects invalid executable emit and `fixed_order`
  references during syntax-runtime construction
- the final proof suite demonstrates contract-driven behavior changes across
  classification, statement parsing, block parsing, comment policy, atom
  parsing, and emitted parse-node fields
- public parse-node shapes remain unchanged except that `NodeBlock.headerKind`
  is now `string`

## Acceptance Mapping

| Deliverable | Evidence |
| --- | --- |
| parser-facing header names are no longer hard-coded | `src/parser/types.ts` widens `NodeBlock.headerKind` to `string`, and `src/parser/parseBlock.ts` now accepts emitted `header_kind` strings without an `asHeaderKind(...)` gate |
| classification and document/block trivia logic no longer depend on fixed statement-name unions | `src/parser/classifyLine.ts`, `src/parser/parseSource.ts`, and `src/parser/parseBlock.ts` now resolve trivia and body-item behavior from resolved statement kinds and emitted statement kinds |
| top-level block diagnostics use neutral names | `src/parser/parseSource.ts` emits `parse.expected_top_level_block`, and `src/parser/parseBlock.ts` emits `parse.unexpected_top_level_block_header` |
| executable emit refs and `fixed_order` refs fail fast when malformed | `src/parser/syntaxRuntime.ts` validates `statements.*.fixed_order`, statement/atom emit refs, and block emit refs during `createParserSyntaxRuntime(...)` |
| contract edits change parser behavior without grammar edits | `tests/parserContractMutationProof.spec.ts` mutates header names, trivia statement names, trailing-comment policy, edge syntax order, atom alternatives, and emitted fields and proves the parser follows those edits |
| the original parser-alignment proof harness remains green | `tests/parserSyntaxAlignment.spec.ts` now passes fully under the hardened parser/runtime |

## Implementation Steps

1. [Done] Remove the remaining parser-facing name assumptions by widening
   `NodeBlock.headerKind`, widening internal classified statement names, and
   neutralizing the remaining top-level-block diagnostic codes.

2. [Done] Harden `createParserSyntaxRuntime(...)` so invalid executable
   `fixed_order` refs, statement emit refs, atom emit refs, and block emit refs
   fail immediately with runtime-construction errors.

3. [Done] Add `tests/parserContractMutationProof.spec.ts` to prove that syntax
   contract edits change parser behavior without parser grammar edits.

4. [Done] Update existing parser tests where needed for the neutralized
   diagnostics and the widened parser-facing types.

5. [Done] Run verification in this order:
   - `TMPDIR=/tmp pnpm run build`
   - `TMPDIR=/tmp pnpm exec vitest run tests/parserSyntaxRuntime.spec.ts tests/parserLineClassification.spec.ts tests/parserStatementParsing.spec.ts tests/parserDocumentBlockParsing.spec.ts tests/parserContractMutationProof.spec.ts`
   - `TMPDIR=/tmp pnpm exec vitest run tests/parserSyntaxAlignment.spec.ts`
   - `TMPDIR=/tmp pnpm exec vitest run tests/diagnostics.spec.ts tests/compile.spec.ts`
   - `TMPDIR=/tmp pnpm test`

6. [Done] Accept the slice only if:
   - no remaining parser-core name-specific typing blocks renamed executable
     statement/header refs on the parser surface
   - the remaining top-level-block diagnostics use neutral names
   - executable emit refs and `fixed_order` refs are runtime-validated rather
     than silently degrading
   - the new proof suite demonstrates behavior changes from contract edits in
     classification, statement parsing, block parsing, comment policy, atom
     parsing, and emits
   - manifest examples still parse and compile cleanly
   - the full test suite passes

## Status

- Verification outcomes:
  - `TMPDIR=/tmp pnpm run build`: passed
  - `TMPDIR=/tmp pnpm exec vitest run tests/parserSyntaxRuntime.spec.ts tests/parserLineClassification.spec.ts tests/parserStatementParsing.spec.ts tests/parserDocumentBlockParsing.spec.ts tests/parserContractMutationProof.spec.ts`:
    passed
  - `TMPDIR=/tmp pnpm exec vitest run tests/parserSyntaxAlignment.spec.ts`:
    passed
  - `TMPDIR=/tmp pnpm exec vitest run tests/diagnostics.spec.ts tests/compile.spec.ts`:
    passed
  - `TMPDIR=/tmp pnpm test`: passed; suite summary was 35 passing files,
    240 passing tests, 0 failures
- The parser surface no longer hard-codes current v0.1 statement/header names
  where executable syntax refs are supposed to drive behavior.
- Runtime construction now rejects malformed executable emit references and
  malformed `fixed_order` references before parsing begins.
- The final proof suite demonstrates that changing executable syntax-contract
  data changes parser behavior without parser grammar edits.
- Manifest examples still parse and compile cleanly.
- Slice 6 is now formally accepted as complete.
- The master plan heading in
  `docs/parser_syntax_alignment_execution_plan.md` has been promoted to
  `[Done]`.
