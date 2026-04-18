# SDD Helper

`sdd-helper` is the JSON-first companion CLI for SDD authoring workflows. Its target user is an agentic skill (Codex skill, Claude skill, Gemini skill). It is designed for structured automation, not for interactive terminal narration: successful commands return exactly one JSON payload, and the command surface stays narrow, repo-local, and focused on `.sdd` documents.

This page documents the helper for three audiences:

- SDD users who want to know what the helper is for.
- LLMs and automation authors who need a human-readable explanation of the helper's capabilities and constraints.
- Future contributors who need to keep the documentation aligned with the actual helper contract.

`sdd-helper` is not a second version of `sdd`. The main `sdd` CLI is a broader human-oriented toolchain entrypoint for compiling, validating, and rendering. `sdd-helper` is the machine-facing companion surface for inspecting SDD structure, submitting structured change requests, generating previews, and performing narrow `.sdd`-scoped git actions without falling back to raw file editing.

## Quick Orientation

Inside this repository, invoke the helper as `pnpm sdd-helper ...`. If the binary is on your `PATH`, the equivalent `sdd-helper ...` commands work too.

Bare invocation and `--help` both return a short JSON stub rather than text help:

```bash
pnpm sdd-helper --help
pnpm sdd-helper
```

That stub is intentionally brief. It tells callers that the helper is JSON-first and points them at the deeper discovery command:

```bash
pnpm sdd-helper capabilities
```

Use `capabilities` for lightweight discovery: command names, invocation patterns, result kinds, and pointers to deeper contract detail. Use `contract` when you need the full nested request or result shape, semantic constraints, continuation semantics, or bundle-binding metadata for one subject:

```bash
pnpm sdd-helper contract helper.command.author
pnpm sdd-helper contract helper.command.preview --resolve bundle
```

Use this page when you want the same surface explained in practical terms.

## Core Operating Conventions

- Successful commands write exactly one JSON payload to `stdout`.
- Helper-level failures return `sdd-helper-error` and exit non-zero. This covers malformed arguments, malformed JSON request bodies, and runtime failures. Some helper errors, especially preview failures, also include optional `diagnostics`.
- Domain-level rejections stay structured. For example, a rejected change set still comes back as a normal JSON result and still exits zero.
- Public path inputs are repo-relative and `.sdd`-focused.
- Direct helper execution works from anywhere inside the repo checkout; bundle-backed commands resolve the repo root at runtime rather than assuming the current directory is the repo root.
- `apply`, `author`, and `undo` load request bodies through `--request <file>` or `--request -` for stdin.
- `stderr` is not part of the public helper contract.

## Worked Workflow: Dry-Run Editing

The helper is especially useful when you want to plan a structural edit without committing it yet.

### 1. Discover the helper surface

```bash
pnpm sdd-helper capabilities
```

This returns the static helper manifest: command names, invocation patterns, result kinds, key constraints, and the subject and shape ids needed to fetch deeper detail.

If the next step requires nested request-shape detail, semantic constraints, or continuation rules, fetch deep contract detail for that specific subject before composing JSON:

```bash
pnpm sdd-helper contract helper.command.apply
```

### 2. Find a target document

If you know the document already, go straight to `inspect`. If you need to locate one first, use `search`:

```bash
pnpm sdd-helper search --query claim --under bundle/v0.1/examples --limit 5
```

Search works across compile-valid `.sdd` documents and returns matches plus diagnostics for anything skipped.

### 3. Inspect the document to obtain revision and handle context

```bash
pnpm sdd-helper inspect <document_path>
```

The `sdd-document-inspect` result gives you the current document revision plus stable same-revision handles for nodes and body items. Those handles are what later mutation requests refer to.

### 4. Submit a dry-run request

Use `author` when the task is common scaffold creation or nested structure authoring. Use `apply` when you already know the exact low-level handles and operations you want.

Create a compact `ApplyChangeSetArgs` request like this:

```json
{
  "path": "<document_path>",
  "base_revision": "<base_revision_from_inspect>",
  "operations": [
    {
      "kind": "set_node_property",
      "node_handle": "<node_handle_from_inspect>",
      "key": "description",
      "value_kind": "quoted_string",
      "raw_value": "Updated description from helper dry run"
    }
  ]
}
```

Then submit it through `apply`:

```bash
pnpm sdd-helper apply --request request.json
```

If another tool is generating the JSON stream directly, stdin is still supported:

```bash
pnpm sdd-helper apply --request -
```

Because `mode` is omitted, this is a dry run by default. The same dry-run default also applies to `author`.

### 5. Interpret the returned `sdd-change-set`

The returned change-set payload tells you whether the request was applied or rejected, what summary of changes it computed, and what diagnostics it produced. That gives you a structured review point before you decide whether to submit the same request with commit mode.

If you commit a change and want persisted-state semantic confirmation afterward, use `validate` and `project`. If you need rendered confirmation, use `preview` after the committed revision has already passed the intended validation gate.

## Command Reference

### Discovery And Read Workflows

#### `sdd-helper capabilities`

- Purpose: return the full machine-readable helper capability manifest.
- Use when: you need canonical command discovery, especially from automation or a skill.
- Invocation: `pnpm sdd-helper capabilities`
- Key inputs: none.
- Result kind: `sdd-helper-capabilities`
- Important constraints: the payload is static and does not require repo inspection or bundle loading.
- Practical notes: treat this as the surfaced command inventory; if the helper grows or changes, this payload and this page should stay aligned.

```ts
interface HelperCapabilitiesResultCommand {
  name: string;
  invocation: string;
  summary: string;
  mutates_repo_state: "never" | "conditional" | "always";
  subject_id: string;
  input_shape_id?: string;
  output_shape_id?: string;
  has_deep_introspection: true;
  detail_modes?: Array<"static" | "bundle_resolved">;
  result_kind: string;
  constraints: string[];
}
```

#### `sdd-helper contract <subject_id> [--resolve bundle]`

- Purpose: return full shared contract detail for one helper subject.
- Use when: you need the full input or output shape, semantic constraints, continuation rules, or bundle-binding metadata for a specific helper command.
- Invocation: `pnpm sdd-helper contract <subject_id> [--resolve bundle]`
- Key inputs: one helper `subject_id`, plus optional `--resolve bundle`.
- Result kind: `sdd-contract-subject-detail`
- Important constraints: static detail is the default and does not require bundle loading; `--resolve bundle` is opt-in and expands only bundle-bound allowed values such as `view_id` and `profile_id`.
- Practical notes: use `capabilities` first to discover the command and its `subject_id`, then use `contract` only for the specific subject that needs deep detail.

#### `sdd-helper inspect <document_path>`

- Purpose: inspect one parseable repo-relative `.sdd` document as structured document data.
- Use when: you need revision information, node handles, body-item handles, or stable structural reads before making a mutation request.
- Invocation: `pnpm sdd-helper inspect <document_path>`
- Key inputs: one repo-relative `.sdd` document path.
- Result kind: `sdd-document-inspect`
- Important constraints: the path must resolve to a repo-relative `.sdd` file; parse-invalid documents return `sdd-helper-error` with `code: "runtime_error"`.
- Practical notes: `inspect` is the usual precursor to `apply`, because its revision and handle data are what keep change requests revision-bound and structured.

#### `sdd-helper search`

- Purpose: search compile-valid graph content across repo-local `.sdd` documents.
- Use when: you need to find likely documents or nodes before inspecting a specific file.
- Invocation: `pnpm sdd-helper search --query <query> --node-type <node_type> --node-id <node_id> --under <path> --limit <count>`
- Key inputs: at least one of `--query`, `--node-type`, or `--node-id`; optional `--under` scope and `--limit`.
- Result kind: `sdd-search-results`
- Important constraints: at least one search filter is required; compile-invalid documents are skipped and surfaced through diagnostics.
- Practical notes: `--query` is a case-insensitive substring search over node id, type, and name; `--under` lets you narrow the search to a repo-relative directory.

### Authoring And Change Management

#### `sdd-helper create <document_path> [--version <version>]`

- Purpose: create a new `.sdd` document through the shared authoring core.
- Use when: you want a repo-safe way to bootstrap a new document instead of hand-creating the file.
- Invocation: `pnpm sdd-helper create <document_path> [--version <version>]`
- Key inputs: a repo-relative document path and an optional version.
- Result kind: `sdd-create-document`
- Important constraints: create always bootstraps an empty document skeleton; the current implementation supports version `0.1`.
- Practical notes: the result includes a nested `change_set`, so creation is still described in the same structured change model as later edits.

#### `sdd-helper apply --request <file-or-stdin>`

- Purpose: apply or dry-run a structured change-set request.
- Use when: you want to submit precise structural edits without doing raw text replacement.
- Invocation: `pnpm sdd-helper apply --request <file-or-stdin>`
- Key inputs: an `ApplyChangeSetArgs` JSON body loaded from a file path or from stdin via `--request -`.
- Result kind: `sdd-change-set`
- Important constraints: dry-run is the default when `mode` is omitted; rejected change sets remain structured and still exit zero.
- Practical notes: the request usually includes `path`, `base_revision`, and `operations`, with optional validation and projection requests; successful insertions now populate returned node and edge handles when deterministically knowable; dry-run first is the safest default for both humans and LLMs.

#### `sdd-helper author --request <file-or-stdin>`

- Purpose: apply or dry-run high-level authoring intents through the shared authoring core.
- Use when: you want to create or extend common SDD structure without spelling out every low-level `ChangeOperation` by hand.
- Invocation: `pnpm sdd-helper author --request <file-or-stdin>`
- Key inputs: an `ApplyAuthoringIntentArgs` JSON body loaded from a file path or from stdin via `--request -`.
- Result kind: `sdd-authoring-intent-result`
- Important constraints: dry-run is the default when `mode` is omitted; committed results are the continuation-safe source of `created_targets`; dry-run `created_targets` are informational previews only.
- Practical notes: the result includes both the high-level `created_targets` mapping and a nested derived `sdd-change-set`; use inline `validate_profile` and `projection_views` here for pre-commit candidate feedback.

#### `sdd-helper undo --request <file-or-stdin>`

- Purpose: undo a committed change set through a structured request.
- Use when: you need to reverse a helper-managed committed change through the same structured mutation system.
- Invocation: `pnpm sdd-helper undo --request <file-or-stdin>`
- Key inputs: an `UndoChangeSetArgs` JSON body loaded from a file path or stdin.
- Result kind: `sdd-change-set`
- Important constraints: only committed and undo-eligible change sets can be undone; rejected undo results remain structured and still exit zero.
- Practical notes: like `apply`, `undo` supports dry-run versus commit behavior, which makes it possible to inspect an undo before carrying it out.

#### `sdd-helper validate <document_path> --profile <profile_id>`

- Purpose: return validation diagnostics for the current persisted document revision.
- Use when: you want structured semantic confirmation of the on-disk document state after a commit or outside a mutation request.
- Invocation: `pnpm sdd-helper validate <document_path> --profile <profile_id>`
- Key inputs: a repo-relative document path and a validation profile id.
- Result kind: `sdd-validation`
- Important constraints: this reads the current persisted document only; it does not inspect dry-run candidates.
- Practical notes: use inline `validate_profile` on `apply` or `author` when you need pre-commit candidate feedback. If a caller needs the active bundle-owned `profile_id` values first, use `pnpm sdd-helper contract helper.command.validate --resolve bundle`.

#### `sdd-helper project <document_path> --view <view_id>`

- Purpose: return a structured projection for the current persisted document revision.
- Use when: you want the current read-side semantic projection without issuing a write request.
- Invocation: `pnpm sdd-helper project <document_path> --view <view_id>`
- Key inputs: a repo-relative document path and a projection view id.
- Result kind: `sdd-projection`
- Important constraints: this reads the current persisted document only; it does not inspect dry-run candidates.
- Practical notes: use inline `projection_views` on `apply` or `author` when you need pre-commit candidate feedback. If a caller needs the active bundle-owned `view_id` values first, use `pnpm sdd-helper contract helper.command.project --resolve bundle`.

### Preview Generation

#### `sdd-helper preview <document_path> --view <view_id> --profile <profile_id> --format <svg|png> [--backend <backend_id>]`

- Purpose: render a preview artifact for a repo-relative `.sdd` document.
- Use when: another tool, UI, or workflow needs preview output directly from the helper surface.
- Invocation: `pnpm sdd-helper preview <document_path> --view <view_id> --profile <profile_id> --format <svg|png> [--backend <backend_id>]`
- Key inputs: document path, `view`, `profile`, and `format`, with optional `backend`.
- Result kind: `sdd-preview`
- Important constraints: if preview generation cannot produce or materialize an artifact, the helper returns `sdd-helper-error` with `code: "runtime_error"`, a stage-specific message, and any available diagnostics.
- Practical notes: SVG and PNG previews are materialized to a helper-owned temp file and returned through `artifact_path`; the helper no longer returns inline SVG text or base64 PNG data. `artifact_path` is an absolute, ephemeral local path under `/tmp/unique-previews/<timestamp-and-suffix>/<basename>`, with a unique parent directory for every successful preview invocation and a basename matching the `sdd show` default naming convention. This temp path is for immediate tool/UI consumption and is not the canonical saved preview artifact. Preview helper errors can also reflect an invalid intermediate document state under the requested profile, so callers should inspect the returned message and diagnostics before assuming the preview environment is broken. If a caller needs the active bundle-owned `view_id` or `profile_id` values first, use `pnpm sdd-helper contract helper.command.preview --resolve bundle`.

### Narrow Git Workflows

#### `sdd-helper git-status [<document_path> ...]`

- Purpose: inspect narrow `.sdd`-scoped git status.
- Use when: you want a structured view of SDD-related git changes without exposing general git plumbing.
- Invocation: `pnpm sdd-helper git-status [<document_path> ...]`
- Key inputs: optional explicit repo-relative `.sdd` document paths.
- Result kind: `sdd-git-status`
- Important constraints: `paths` is the exhaustive `.sdd` reporting scope for the request, while `status` is the sparse list of actual git status entries within that scope.
- Practical notes: with no arguments, the helper reports the full repo-local `.sdd` scope; with explicit paths, it narrows the scope to those documents only.

#### `sdd-helper git-commit --message <message> <document_path>...`

- Purpose: stage and commit only explicit repo-relative `.sdd` paths.
- Use when: you want to commit helper-managed document work without sweeping in unrelated files.
- Invocation: `pnpm sdd-helper git-commit --message <message> <document_path>...`
- Key inputs: a commit message plus one or more explicit `.sdd` document paths.
- Result kind: `sdd-git-commit`
- Important constraints: at least one explicit `.sdd` path is required, and the helper keeps commit scope narrow to the supplied `.sdd` paths plus any paired rename sources needed to complete those renames.
- Practical notes: this is intentionally narrow. It exists to support helper-centric document workflows, not to replace general-purpose git usage.

## Result Kinds At A Glance

- `sdd-helper-help`: the short JSON help stub returned by bare invocation and `--help`.
- `sdd-helper-capabilities`: the full static discovery payload for the helper command surface.
- `sdd-contract-subject-detail`: deep static or bundle-resolved contract detail for one helper subject.
- `sdd-document-inspect`: structured document inspection data, including revision and handles.
- `sdd-search-results`: cross-document search matches plus diagnostics.
- `sdd-create-document`: document creation result, including the creation change set.
- `sdd-authoring-intent-result`: the structured result for `author`, including `created_targets` plus a nested derived change set.
- `sdd-change-set`: the structured result for `apply` and `undo`, whether applied or rejected.
- `sdd-validation`: validation diagnostics for the current persisted document revision.
- `sdd-projection`: projection output for the current persisted document revision.
- `sdd-preview`: preview metadata plus an ephemeral local `artifact_path` for the materialized SVG or PNG file.
- `sdd-git-status`: narrow `.sdd`-scoped git status information.
- `sdd-git-commit`: the commit result for helper-scoped `.sdd` commits.
- `sdd-helper-error`: the helper-level error payload for invalid args, invalid JSON, and runtime failures, with optional structured diagnostics.

## Guidance By Audience

### For SDD Users

- Use `search` to find relevant documents or nodes, then use `inspect` before you plan a structured edit.
- Prefer `author` or `apply` dry-run before commit, especially when you are generating requests programmatically.
- Use `validate` and `project` when you need persisted-state semantic reads without wrapping them in a mutation request.
- Use `preview` when you need a rendered artifact as helper output rather than through the main `sdd` CLI.
- Use the helper git commands only when you specifically want `.sdd`-scoped behavior.

### For LLMs And Automation

- Start with `capabilities`; it is the canonical discovery surface.
- Use `contract` when you need nested request-shape detail, semantic constraints, continuation semantics, or binding metadata for one subject.
- Use `contract --resolve bundle` only when you need active bundle-owned values such as `view_id` or `profile_id`.
- Treat JSON as the public interface. Do not expect human-readable CLI text.
- Keep path inputs repo-relative and `.sdd`-focused.
- Use `inspect` to obtain current `revision` and stable same-revision handles before constructing low-level mutation requests.
- Use committed `author` `created_targets` and committed `apply` insertion handles as continuation surfaces for later requests at the returned `resulting_revision`.
- Treat dry-run insertion handles and dry-run `created_targets` as review aids only.
- Distinguish helper errors from structured domain rejections: non-zero `sdd-helper-error` means the helper could not complete the request transport or execution path; a zero-exit rejected change set means the request was understood and rejected within the domain model.
- Do not assume every helper error is a permanent environment failure. Preview can fail in the helper-error lane for an invalid intermediate document state, and those cases should be classified from the helper message plus any attached diagnostics.
- Treat the fallback order as `capabilities -> contract -> code/docs only if still insufficient`. Do not inspect code, tests, or repo `.sdd` examples for normal request-shape knowledge when helper contract introspection already provides it.

### For Future Contributors

- Keep this page aligned with `pnpm sdd-helper capabilities`, `src/cli/helperDiscovery.ts`, `src/cli/helperProgram.ts`, and `src/authoring/contracts.ts`.
- Treat `capabilities` as the thin orientation surface and `contract` as the deep contract surface; keep both aligned to the implemented helper behavior.
- When behavior changes, update both the machine-readable discovery surface and this human-readable page.
- Document current implementation limits explicitly. Do not quietly broaden the docs ahead of the implementation.
- Preserve the distinction between helper-level error behavior and structured domain-level results.

## Contract Sources

- Helper capability manifest: [`src/cli/helperDiscovery.ts`](../../../src/cli/helperDiscovery.ts)
- Runtime command wiring: [`src/cli/helperProgram.ts`](../../../src/cli/helperProgram.ts)
- Shared request and result contracts: [`src/authoring/contracts.ts`](../../../src/authoring/contracts.ts)
- Helper design intent: [`docs/future_explorations/mcp_server/sdd_mcp_server_design.md`](../../future_explorations/mcp_server/sdd_mcp_server_design.md)

When in doubt, the machine-readable capability payload and the shared contract types govern the command surface. This page exists to explain that surface, not to redefine it.
