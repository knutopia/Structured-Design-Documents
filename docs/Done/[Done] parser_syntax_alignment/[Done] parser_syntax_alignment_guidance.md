# [Done] Parser / Syntax Alignment Guidance

This document is for the thread that will fulfill the parser promise: make `bundle/v0.1/core/syntax.yaml` the actually executable parser contract it is currently described as being.

This is not a "trim the docs to match today's parser" brief. The mandate is the opposite: bring parser behavior under the authority of `syntax.yaml` so the bundle claim becomes true in implementation, not just in prose.

## 1. Reviewer-risk memo

### Current reviewer-facing promise

The repo currently tells a consistent story in multiple places:

- `definitions/v0.1/ebnf_grammar_sdd_text_v_0_dot_1.md` says `bundle/v0.1/core/syntax.yaml` is the machine-readable extraction target for parsing behavior and the primary source for formal parse structure, lexical precision, and line-classification precedence.
- `definitions/v0.1/authoring_spec_type_first_dsl_sdd_text_v_0_dot_1.md` says the same file is the machine-readable extraction target for source parsing behavior.
- `docs/Done/[Done] bundle_v0_1_extraction_sync_report.md` describes `core/syntax.yaml` as a machine-loadable, line-oriented parser contract.
- `docs/toolchain/architecture.md` says the bundle is the source of truth for language behavior and that the engine implements generic interpreters for syntax loading and parsing.

An external reviewer can reasonably infer from those statements that:

1. `core/syntax.yaml` is the parser contract.
2. parser behavior is derived from that contract.
3. editing the declarative grammar/classification structure in `syntax.yaml` changes parser behavior without touching parser code.

### Current implementation reality

That inference is only partly true today.

- The parser does read a subset of syntax-bundle data directly.
- The parser does not interpret most of the declarative grammar/classification structures in `syntax.yaml`.
- Several current parser behaviors diverge from the contract written in `syntax.yaml`.

### Why this is reviewer-risky

This creates the appearance of architectural overclaim:

- strong declarative parser-contract language in docs
- rich declarative syntax contract in the bundle
- a hand-written parser that only partially honors it

That combination is exactly the kind of thing a careful reviewer will label as half-finished architecture or "looks more generic than it really is."

### What the new thread should and should not do

The new thread should:

- make parser behavior flow from `syntax.yaml`
- close the concrete parser/spec mismatches listed below
- preserve current valid `.sdd` examples unless the syntax contract explicitly requires tightening
- add tests that lock parser behavior to `syntax.yaml`

The new thread should NOT:

- solve this by deleting large parts of `syntax.yaml`
- weaken the docs first and leave the parser architecture unchanged
- normalize current parser divergence as "acceptable metadata"

## 2. High-level description of Parser-to-Syntax disconnect

### Historical shape

The sequence in git history matters:

- commit `712e2c0` added `bundle/v0.1/core/syntax.yaml` with the message `Added syntax.yaml to get parser-ready`
- commit `f9b1cba` added the first parser implementation (`src/parser/classifyLine.ts`, `src/parser/parseSource.ts`, `src/parser/parseBlock.ts`)

So `syntax.yaml` existed first as the intended parser contract. The first parser implementation did not become a generic interpreter of that contract. It became a hand-written parser that consumes selected fields from the bundle and hard-codes the rest of the grammar in TypeScript.

### The current split

Today the parser operates in three modes at once:

1. direct-use-of-syntax
   - some syntax fields are read directly and do affect parser behavior
2. rule-expressed-as-code
   - some syntax rules are not read as data, but are manually recreated in parser code
3. declarative-but-non-executable
   - some syntax fields are carried in `syntax.yaml`, described in docs, and not actually consulted by the parser at all

### Why that matters

This means `syntax.yaml` is currently:

- partly authoritative
- partly duplicated by code
- partly aspirational

That is the parser-to-syntax disconnect this thread must remove.

## 3. Documentation of Parser-to-Syntax disconnect: which fields, exactly?

This section is intentionally exact. It avoids "fields like" and "for example."

### 3.1 Capture use-of-syntax vs rule-expressed-as-code

#### 3.1.0 Direct use of `syntax.yaml`

These fields are read directly by the parser today:

| `syntax.yaml` field | Current code path | Current status |
| --- | --- | --- |
| `lexical.identifier_pattern` | `src/parser/classifyLine.ts`, `src/parser/parseBlock.ts` | directly used |
| `lexical.id_pattern` | `src/parser/parseBlock.ts` | directly used |
| `lexical.version_number_pattern` | `src/parser/parseSource.ts` | directly used |
| `lexical.bare_value_pattern` | `src/parser/parseBlock.ts` | directly used |
| `document.version_declaration.literal` | `src/parser/parseSource.ts` | directly used |
| `document.version_declaration.post_parse_supported_versions` | `src/parser/parseSource.ts` | directly used |
| `document.version_declaration.default_effective_version` | `src/parser/parseSource.ts` | directly used |

Important bypass:

- `token_sources.node_types.path`
- `token_sources.node_types.key`
- `token_sources.node_types.token_field`
- `token_sources.relationship_types.path`
- `token_sources.relationship_types.key`
- `token_sources.relationship_types.token_field`

The parser does not use those fields. It reads `bundle.vocab.node_types[*].token` and `bundle.vocab.relationship_types[*].token` directly.

#### 3.1.1 Rule-expressed-as-code: code diverges-from-syntax vs code-matches-syntax

##### 3.1.1.1 Code diverges from syntax

| `syntax.yaml` field(s) | Contract written in `syntax.yaml` | Current parser behavior | Impact on existing `.sdd` example files |
| --- | --- | --- | --- |
| `document.minimum_top_level_blocks` | parse requires at least one top-level block | parser does not enforce this; empty/comment-only input reaches compile/schema validation instead of failing in parse | no current repo-tracked `.sdd` example file is empty or comment-only; no current example semantics change, but error stage would change for empty/comment-only inputs |
| `lexical.trailing_comments_allowed` and `statements.version_decl` | `version_decl` does not declare `trailing_comment: allowed`, and `lexical.trailing_comments_allowed` does not include `version_decl` | parser accepts trailing comments on version declarations because `parseVersionDeclaration` receives comment-stripped content from `classifyLine` | no current repo-tracked `.sdd` example file has a trailing comment on the `SDD-TEXT` line |
| `statements.edge_line.fixed_order` | edge suffix order is fixed: `to_name`, then `event`, then `guard`, then `effect`, then `props` | parser accepts later suffixes before earlier suffixes once parsing has entered the suffix loop; confirmed with `[Click] "Target Name"` compiling successfully | no current repo-tracked `.sdd` example file uses out-of-order edge suffixes; current bundle examples already use `to_name -> event -> guard -> effect` |
| `statements.edge_line.sequence` optional `whitespace: required` before `to_name` / `event` / `guard` / `effect`, and `statements.edge_line.sequence.repeat.separator.whitespace: required` before `props` | whitespace is required before each optional suffix group and before each repeated edge property | parser does not verify that whitespace was present between successive suffix parts once it is inside the suffix loop | no current repo-tracked `.sdd` example file omits required whitespace between successive edge suffix parts or before edge props |
| `atoms.event_atom` | event text must match `id_pattern`, `identifier_pattern`, or `quoted_string` | parser accepts any bracket contents, trimmed, without validating against `event_atom`; confirmed with `[not valid !]` compiling successfully | no current repo-tracked `.sdd` example file uses free-text event payloads with spaces or punctuation; current examples use IDs such as `E-001`, `E-010`, `E-030`, `E-060` |
| `atoms.effect_atom` | effect text must match `id_pattern`, `identifier_pattern`, or `quoted_string` | parser uses `parseValueAtom`, which allows `quoted_string` or `lexical.bare_value_pattern`; confirmed with `/ 123` compiling successfully | no current repo-tracked `.sdd` example file uses a bare effect outside the `id_pattern` / `identifier_pattern` subset; current examples use IDs such as `SA-010` and `SA-060` |
| `statements.edge_line.sequence.repeat.capture.props.atom` and `atoms.edge_property.sequence.capture.value.one_of[0].atom` | edge properties may use `quoted_string` values, including quoted values with spaces | parser splits each edge property candidate at the next whitespace before parsing it, so quoted edge-property values containing spaces fail; confirmed with `label=\"hello world\"` producing `parse.invalid_edge_line` / `Unterminated quoted string` | no current repo-tracked `.sdd` example file uses quoted edge-property values; current example edge props are bare values such as `field=status` |

##### 3.1.1.2 Code matches syntax, but by hard-coded logic rather than by interpreting the declared field

These fields currently match the implementation, but the match is hard-coded. Editing the YAML would not automatically change parser behavior.

| `syntax.yaml` field(s) | Current code path | Current status |
| --- | --- | --- |
| `parsing_model.case_sensitive` | `src/parser/classifyLine.ts`, `src/parser/parseBlock.ts`, `src/parser/parseSource.ts` | matched by hard-coded behavior |
| `parsing_model.indentation_semantic` | `src/parser/classifyLine.ts`, `src/parser/parseBlock.ts` | matched by hard-coded behavior |
| `parsing_model.line_oriented` | `src/parser/parseSource.ts` | matched by hard-coded behavior |
| `parsing_model.block_terminated_by_end` | `src/parser/parseBlock.ts` | matched by hard-coded behavior |
| `lexical.newline_sequences` | `src/parser/parseSource.ts` | matched by hard-coded behavior (`\n` and `\r\n`) |
| `lexical.whitespace_chars` | `src/parser/parseBlock.ts` | matched by hard-coded behavior (`space`, `tab`) |
| `lexical.leading_whitespace_ignored` | `src/parser/classifyLine.ts`, `src/parser/parseBlock.ts`, `src/parser/parseSource.ts` | matched by hard-coded behavior |
| `lexical.trailing_whitespace_ignored` | `src/parser/classifyLine.ts`, `src/parser/parseBlock.ts`, `src/parser/parseSource.ts` | matched by hard-coded behavior |
| `lexical.comment_prefix` | `src/parser/classifyLine.ts` | matched by hard-coded behavior (`#`) |
| `lexical.quoted_string.delimiter` | `src/parser/parseBlock.ts` | matched by hard-coded behavior (`"`) |
| `lexical.quoted_string.multiline` | `src/parser/parseBlock.ts` | matched by hard-coded behavior |
| `lexical.quoted_string.standardized_escapes` | `src/parser/parseBlock.ts` | matched by hard-coded behavior for `\"` and `\\` |
| `lexical.quoted_string.other_backslash_sequences` | `src/parser/parseBlock.ts` | matched by hard-coded behavior (other backslashes preserved literally) |
| `document.version_declaration.allowed` | `src/parser/parseSource.ts` | currently matched only because the code path makes version declarations optional/permitted |
| `document.version_declaration.required` | `src/parser/parseSource.ts` | currently matched only because the code path does not require a version declaration |
| `document.leading_lines_allowed` | `src/parser/parseSource.ts` | matched by hard-coded behavior (blank/comment only) |
| `document.top_level_block_kind` | `src/parser/parseSource.ts` | matched by hard-coded behavior (`top_node_header`) |
| `document.trailing_lines_allowed` | `src/parser/parseSource.ts` | matched by hard-coded behavior (blank/comment only) |
| `line_kinds[0].classifier.trimmed_equals` | `src/parser/classifyLine.ts` | matched by hard-coded behavior (`END`) |
| `line_kinds[1].classifier.first_non_whitespace` | `src/parser/classifyLine.ts` | matched by hard-coded behavior (`+`) |
| `line_kinds[1].classifier.next_token_source` | `src/parser/classifyLine.ts` plus direct `bundle.vocab` reads | matched by hard-coded behavior |
| `line_kinds[2].classifier.first_token_source` | `src/parser/classifyLine.ts` plus direct `bundle.vocab` reads | matched by hard-coded behavior |
| `line_kinds[3].classifier.first_token_source` | `src/parser/classifyLine.ts` plus direct `bundle.vocab` reads | matched by hard-coded behavior |
| `line_kinds[4].classifier.leading_identifier_before_equals` | `src/parser/classifyLine.ts` | matched by hard-coded behavior |
| `line_kinds[5].classifier.any_of[0].trimmed_equals` | `src/parser/classifyLine.ts` | matched by hard-coded behavior |
| `line_kinds[5].classifier.any_of[1].first_non_whitespace` | `src/parser/classifyLine.ts` | matched by hard-coded behavior |
| `statements.top_node_header.sequence` | `src/parser/parseBlock.ts` | matched by hard-coded behavior |
| `statements.nested_node_header.sequence` | `src/parser/parseBlock.ts` | matched by hard-coded behavior |
| `statements.property_line.sequence` | `src/parser/parseBlock.ts` | matched by hard-coded behavior |
| `blocks.top_node_block.header_statement` | `src/parser/parseSource.ts`, `src/parser/parseBlock.ts` | matched by hard-coded behavior |
| `blocks.top_node_block.body_item_kinds` | `src/parser/parseBlock.ts` | matched by hard-coded behavior |
| `blocks.top_node_block.terminator_statement` | `src/parser/parseBlock.ts` | matched by hard-coded behavior |
| `blocks.nested_node_block.header_statement` | `src/parser/parseBlock.ts` | matched by hard-coded behavior |
| `blocks.nested_node_block.body_item_kinds` | `src/parser/parseBlock.ts` | matched by hard-coded behavior |
| `blocks.nested_node_block.terminator_statement` | `src/parser/parseBlock.ts` | matched by hard-coded behavior |
| `atoms.guard_text` | `src/parser/parseBlock.ts` | matched by hard-coded behavior |

#### 3.1.2 Declared in `syntax.yaml`, but not currently consumed and not currently interpreted

These fields exist in the parser contract file but are not currently parser-driving fields:

| `syntax.yaml` field(s) | Current status |
| --- | --- |
| `version` | carried metadata only |
| `artifact` | carried metadata only |
| `token_sources.node_types.path` | not consumed |
| `token_sources.node_types.key` | not consumed |
| `token_sources.node_types.token_field` | not consumed |
| `token_sources.relationship_types.path` | not consumed |
| `token_sources.relationship_types.key` | not consumed |
| `token_sources.relationship_types.token_field` | not consumed |
| `document.version_declaration.statement_kind` | not consumed |
| `line_kinds[*].precedence` | not consumed |
| `line_kinds[*].statement` and `line_kinds[*].statements` | not consumed |
| `statements.*.role` | not consumed |
| `statements.*.leading_whitespace` | not consumed as data |
| `statements.*.trailing_comment` | not consumed as data |
| `statements.*.emits` | not consumed as data |
| `blocks.*.emits` | not consumed as data |
| `boundaries.excluded_from_syntax_scope` | explanatory only |
| `boundaries.notes` | explanatory only |
| `parse_output_contract.normalized_nodes` | not consumed |
| `parse_output_contract.preserved_statement_nodes` | not consumed |

## 4. Guidance for the implementation thread

### Required end state

The implementation thread should treat this as the acceptance target:

1. `bundle/v0.1/core/syntax.yaml` becomes the executable parser contract for line classification and statement/block parsing.
2. Changing the declared syntax contract in `syntax.yaml` changes parser behavior without editing parser grammar code.
3. The current parser/spec mismatches listed in section `3.1.1.1` are eliminated.
4. Existing valid bundle examples continue to parse and compile.
5. The parser test suite gains coverage for every currently confirmed divergence.

### Architectural direction

The thread should move parser logic toward "generic interpreter over syntax contract" rather than "larger hand-written parser with more YAML-shaped comments."

That means:

- interpret `line_kinds` instead of manually re-coding line classification precedence
- interpret `statements` instead of manually re-coding header/property/edge/version parsing
- interpret `blocks` instead of manually re-coding block structure
- interpret `atoms` instead of manually re-coding event/effect/property subgrammars
- use `token_sources` as the source of token lookup wiring rather than bypassing it with direct `bundle.vocab` assumptions

### Minimum mismatch-closing test set

At a minimum, add tests for:

- comment-only input failing at parse because of `document.minimum_top_level_blocks`
- version declaration with trailing comment rejecting or accepting strictly according to `syntax.yaml`
- out-of-order edge suffixes rejecting because of `statements.edge_line.fixed_order`
- missing whitespace between successive edge suffix parts rejecting because of `statements.edge_line.sequence`
- invalid event text in `[...]` rejecting because of `atoms.event_atom`
- invalid bare effect text rejecting because of `atoms.effect_atom`
- edge-property quoted string with spaces parsing successfully because of `atoms.edge_property`

### Non-goal

Do not declare victory by merely documenting that `syntax.yaml` is only "partly executable." The point of this thread is to remove that qualifier.
