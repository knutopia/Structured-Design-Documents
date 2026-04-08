# [Done] Parser Syntax Alignment Slice 1: Contract-Locking Parser Tests

## Goal

Slice 1 is a test-and-doc slice only.

Its purpose is to create the parser-contract proof-case harness that later
parser-alignment slices will turn green, without changing parser production
behavior in this slice.

## Acceptance Mapping

| Proof case | Contract field(s) | Expected lock |
| --- | --- | --- |
| comment-only input fails at parse | `document.minimum_top_level_blocks` | parse failure with `parse.minimum_top_level_blocks` |
| trailing comment on version declaration rejects | `lexical.trailing_comments_allowed`, `statements.version_decl` | parse failure with `parse.invalid_version_declaration` |
| edge suffix order is enforced | `statements.edge_line.fixed_order` | parse failure with `parse.invalid_edge_line` |
| whitespace before suffix groups is enforced | `statements.edge_line.sequence` | parse failure with `parse.invalid_edge_line` |
| whitespace before repeated edge properties is enforced | `statements.edge_line.sequence.repeat.separator.whitespace` | parse failure with `parse.invalid_edge_line` |
| invalid event text rejects | `atoms.event_atom` | parse failure with `parse.invalid_edge_line` |
| invalid effect text rejects | `atoms.effect_atom` | parse failure with `parse.invalid_edge_line` |
| quoted edge-property values with spaces parse | `atoms.edge_property`, `atoms.edge_property.sequence.capture.value.one_of[0].atom` | parse success with correct `EdgeProperty` fields |
| manifest examples remain parse-clean | current bundle examples plus Slice 1 guardrail | zero parse diagnostics for every manifest example |

## Implementation Steps

1. [Done] Add one dedicated parser-contract spec file at
   `tests/parserSyntaxAlignment.spec.ts`.

2. [Done] Add inline proof inputs for every confirmed mismatch listed above, and
   keep the test assertions locked to parse outcome, parse stage, and
   diagnostic code rather than full message text.
   The repeated-edge-property whitespace proof case uses a quoted effect before
   the property boundary so the failure is unambiguously about the missing
   separator rather than an invalid bare effect token.

3. [Done] Run verification in this order:
   - `TMPDIR=/tmp pnpm run build`
   - `TMPDIR=/tmp pnpm exec vitest run tests/parserSyntaxAlignment.spec.ts`
   - `TMPDIR=/tmp pnpm exec vitest run tests/diagnostics.spec.ts tests/compile.spec.ts`
   - `TMPDIR=/tmp pnpm test`

4. [Done] Accept the slice only if:
   - every confirmed divergence has a direct parser-facing proof case
   - the new parser-alignment spec fails only on real parser drift
   - manifest examples still parse cleanly
   - no parser production files were changed
   - the master plan can truthfully promote Slice 1 to `[Done]`

## Status

- Verification outcomes:
  - `TMPDIR=/tmp pnpm run build`: passed
  - `TMPDIR=/tmp pnpm exec vitest run tests/parserSyntaxAlignment.spec.ts`:
    failed as intended proof harness, with 1 passing test and 8 failing tests
  - `TMPDIR=/tmp pnpm exec vitest run tests/diagnostics.spec.ts tests/compile.spec.ts`:
    passed
  - `TMPDIR=/tmp pnpm test`: failed only because of
    `tests/parserSyntaxAlignment.spec.ts`; suite summary was 29 passing files, 1
    failing file, 191 passing tests, 8 failing tests
- Direct proof cases now exist for all confirmed divergences from the guidance.
- Existing parser/compile regressions remain green, which supports the claim that
  the new failures are parser-alignment drift rather than test harness defects.
- Manifest examples remain parse-clean under the new dedicated spec.
- No parser production files were changed in this slice.
- Slice 1 is now formally accepted as a completed test-and-doc harness slice.
- The master plan heading in
  `docs/parser_syntax_alignment_execution_plan.md` has been promoted to
  `[Done]`.
