# [Done] Parser Syntax Alignment Slice 2: Executable Syntax Runtime Layer

## Goal

Slice 2 is an infrastructure slice.

Its purpose is to make the raw `syntax.yaml` contract fully typable in the
bundle layer and to add a parser-owned runtime helper that resolves and
validates the executable subset of that contract, without changing parser
behavior yet.

## Acceptance Mapping

| Deliverable | Evidence |
| --- | --- |
| `SyntaxConfig` can represent the full current raw `syntax.yaml` shape | `src/bundle/types.ts` models parsing model, token sources, lexical, document, line kinds, statements, blocks, atoms, boundaries, and parse output contract |
| parser-owned runtime helper exists | `src/parser/syntaxRuntime.ts` exports `ParserSyntaxRuntime`, `createParserSyntaxRuntime`, and typed lookup helpers |
| runtime resolves token sources and lexical patterns | `tests/parserSyntaxRuntime.spec.ts` covers resolved token sources and precompiled regexes |
| runtime validates contract cross-references | `tests/parserSyntaxRuntime.spec.ts` covers unknown token source, pattern ref, atom ref, statement ref, block ref, and invalid line-kind declarations |
| parser behavior remains unchanged in Slice 2 | `tests/parserSyntaxAlignment.spec.ts` still reports the same intended drift failures |
| existing regression tests remain stable | focused diagnostics/compile tests continue to pass |

## Implementation Steps

1. [Done] Expand `SyntaxConfig` to model the full current raw `syntax.yaml`
   structure without changing `Bundle` shape or exporting a parser runtime from
   `src/index.ts`.

2. [Done] Add `src/parser/syntaxRuntime.ts` with:
   - `ParserSyntaxRuntime`
   - `createParserSyntaxRuntime(bundle)`
   - helper accessors for token sources, patterns, statements, blocks, and atoms

3. [Done] Update the minimal fake bundle syntax objects used by tests so they
   satisfy the widened raw syntax shape without changing test intent.

4. [Done] Add `tests/parserSyntaxRuntime.spec.ts` to cover successful runtime
   construction and invalid-reference failure cases.

5. [Done] Run verification in this order:
   - `TMPDIR=/tmp pnpm run build`
   - `TMPDIR=/tmp pnpm exec vitest run tests/parserSyntaxRuntime.spec.ts`
   - `TMPDIR=/tmp pnpm exec vitest run tests/parserSyntaxAlignment.spec.ts`
   - `TMPDIR=/tmp pnpm exec vitest run tests/diagnostics.spec.ts tests/compile.spec.ts`
   - `TMPDIR=/tmp pnpm test`

6. [Done] Accept the slice only if:
   - the runtime helper builds from the real bundle
   - fake bundle tests still pass after the expanded typing
   - Slice 1 proof harness remains unchanged in outcome
   - no parser production behavior changed
   - the master plan can truthfully promote Slice 2 to `[Done]`

## Status

- Verification outcomes:
  - `TMPDIR=/tmp pnpm run build`: passed
  - `TMPDIR=/tmp pnpm exec vitest run tests/parserSyntaxRuntime.spec.ts`:
    passed
  - `TMPDIR=/tmp pnpm exec vitest run tests/parserSyntaxAlignment.spec.ts`:
    failed with the same intended 8 Slice 1 drift cases and 1 passing manifest
    regression
  - `TMPDIR=/tmp pnpm exec vitest run tests/diagnostics.spec.ts tests/compile.spec.ts`:
    passed
  - `TMPDIR=/tmp pnpm test`: failed only because of
    `tests/parserSyntaxAlignment.spec.ts`; suite summary was 30 passing files, 1
    failing file, 203 passing tests, 8 failing tests
- The raw `SyntaxConfig` surface now models the current `syntax.yaml` shape.
- The parser-owned runtime helper builds cleanly from the real bundle and
  validates cross-references before later interpreter slices use them.
- The fake bundle tests remained green after the expanded syntax typing.
- No parser production behavior was changed in this slice.
- Slice 2 is now formally accepted as a completed infrastructure slice.
- The master plan heading in
  `docs/parser_syntax_alignment_execution_plan.md` has been promoted to
  `[Done]`.
