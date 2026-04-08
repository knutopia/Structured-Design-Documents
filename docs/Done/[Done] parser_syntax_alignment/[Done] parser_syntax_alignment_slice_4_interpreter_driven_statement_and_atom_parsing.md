# [Done] Parser Syntax Alignment Slice 4: Interpreter-Driven Statement And Atom Parsing

## Goal

Slice 4 moves parser statement and atom syntax under the executable
`statements` and `atoms` contract while deliberately leaving document and block
authority for Slice 5.

This slice is intentionally bounded:

- statement parsing is now interpreter-driven
- atom parsing for the current contract surface is now interpreter-driven
- document flow and block ownership are still manual in `parseSource` and
  `parseNodeBlock`
- the only remaining Slice 1 drift case is the Slice 5
  `minimum_top_level_blocks` document rule

## Acceptance Mapping

| Deliverable | Evidence |
| --- | --- |
| parser-internal statement interpreter exists | `src/parser/statementInterpreter.ts` interprets statement sequences, atoms, and statement normalization rules |
| `version_decl`, node headers, property lines, edge lines, and `END` parse from syntax data rather than bespoke helpers | `src/parser/parseSource.ts` and `src/parser/parseBlock.ts` call `interpretStatement(...)` instead of hand-written parsers |
| statement-owned emitted fields are interpreted from syntax data | property, edge, and edge-property fields come from interpreted captures plus `emits.fields` / `defaults` |
| edge mismatch cases are closed by syntax-driven parsing | `tests/parserSyntaxAlignment.spec.ts` now passes every edge-related proof case |
| direct statement/atom proof tests exist | `tests/parserStatementParsing.spec.ts` covers version, header, property, edge, and end-line parsing |
| only the Slice 5 document-level drift remains | `tests/parserSyntaxAlignment.spec.ts` now fails only the comment-only input case for `parse.minimum_top_level_blocks` |

## Implementation Steps

1. [Done] Add `src/parser/statementInterpreter.ts` to interpret the currently
   used statement sequence features and atom forms from runtime syntax data.

2. [Done] Replace manual version-declaration parsing in `parseSource` with an
   interpreter-driven `version_decl` pass while keeping post-parse version
   support checks in `parseSource`.

3. [Done] Replace manual header, property, edge, and terminator parsing in
   `parseBlock` with interpreter-driven statement parsing.

4. [Done] Remove the obsolete hand-written parsing helpers for quoted strings,
   value atoms, property lines, edge properties, node headers, and edge lines.

5. [Done] Add `tests/parserStatementParsing.spec.ts` to lock direct
   statement-level behavior for the syntax-driven interpreter.

6. [Done] Run verification in this order:
   - `TMPDIR=/tmp pnpm run build`
   - `TMPDIR=/tmp pnpm exec vitest run tests/parserSyntaxRuntime.spec.ts tests/parserLineClassification.spec.ts tests/parserStatementParsing.spec.ts`
   - `TMPDIR=/tmp pnpm exec vitest run tests/parserSyntaxAlignment.spec.ts`
   - `TMPDIR=/tmp pnpm exec vitest run tests/diagnostics.spec.ts tests/compile.spec.ts`
   - `TMPDIR=/tmp pnpm test`

7. [Done] Accept the slice only if:
   - statement parsing for `version_decl`, `top_node_header`,
     `nested_node_header`, `property_line`, `edge_line`, and `end_line` is
     interpreter-driven
   - atom parsing for `quoted_string`, `event_atom`, `effect_atom`,
     `guard_text`, and `edge_property` is interpreter-driven
   - `parseBlock.ts` no longer directly reads bundle vocab or lexical regexes
     for these statements
   - `tests/parserSyntaxAlignment.spec.ts` fails only the comment-only
     `minimum_top_level_blocks` case
   - full `pnpm test` fails only because of that remaining Slice 5 proof case

## Status

- Verification outcomes:
  - `TMPDIR=/tmp pnpm run build`: passed
  - `TMPDIR=/tmp pnpm exec vitest run tests/parserSyntaxRuntime.spec.ts tests/parserLineClassification.spec.ts tests/parserStatementParsing.spec.ts`:
    passed
  - `TMPDIR=/tmp pnpm exec vitest run tests/parserSyntaxAlignment.spec.ts`:
    failed only the comment-only input case for
    `parse.minimum_top_level_blocks`
  - `TMPDIR=/tmp pnpm exec vitest run tests/diagnostics.spec.ts tests/compile.spec.ts`:
    passed
  - `TMPDIR=/tmp pnpm test`: failed only because of the remaining
    `parse.minimum_top_level_blocks` proof case; suite summary was 32 passing
    files, 1 failing file, 224 passing tests, 1 failing test
- Statement parsing is now interpreter-driven for version declarations, node
  headers, property lines, edge lines, and end lines.
- Atom parsing is now interpreter-driven for quoted strings, event/effect
  choices, guard text, and edge properties.
- `parseBlock.ts` no longer directly parses tokens or regex-driven statement
  syntax for the Slice 4 statements.
- Slice 1 drift is now closed everywhere except the document-level
  `minimum_top_level_blocks` rule, which remains Slice 5 work.
- Slice 4 is now formally accepted as complete.
- The master plan heading in
  `docs/parser_syntax_alignment_execution_plan.md` has been promoted to
  `[Done]`.
