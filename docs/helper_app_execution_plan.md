# Helper App Execution Plan

## Purpose

This document operationalizes `docs/future_explorations/mcp_server/sdd_mcp_server_design.md` for the helper-first build.

It is sequencing and acceptance guidance, not a second design authority.

It is intentionally placed in `docs/` because the plan is active and expected to be executed soon.

## Planning Model

Use this document as the stable execution artifact for the helper-first build.

Execution cadence:

1. Select one checkpoint from this document.
2. Restate the checkpoint scope, invariants, files, and verification plan.
3. Implement and verify only that checkpoint.
4. Report satisfied invariants, violated invariants, residual risks, and the recommended next checkpoint.
5. Do not begin the next checkpoint until the current checkpoint is accepted.

Concurrency rule:

- use serial checkpoints rather than one long implementation thread
- allow at most one writing thread at a time across the shared authoring core and helper CLI
- keep read-only exploration and review separate from writing work

## Authority And Locked Decisions

Authority order for this milestone:

1. `docs/future_explorations/mcp_server/sdd_mcp_server_design.md`
2. bundle files under `bundle/v0.1/`
3. `docs/toolchain/architecture.md`
4. `docs/toolchain/development.md`
5. current code as evidence of behavior, not design authority

Locked decisions:

- place the shared helper-app domain core under `src/authoring/*`
- keep the helper CLI thin under `src/cli/*`
- store repo-local journal state in `.sdd-state/`
- require deterministic same-revision handle stability for repeated `inspect` reads
- keep comments and blank lines internal to rewrite ownership rather than exposing them in the public inspect contract
- reject `set_node_property` when duplicate keys already exist on the target node
- require exact current-revision match for committed undo
- journal `create_document` with `origin: "create_document"`, `document_effect: "created"`, and `base_revision: null`
- keep the helper contract JSON-first on stdout

## Non-Negotiable Invariants

- `.sdd` files remain authoritative
- reads remain aligned with the existing parse -> compile -> validate -> project -> render spine
- no public raw text replacement API is introduced
- all public paths remain repo-relative
- contract payloads, diagnostics, and summaries remain deterministic
- helper and future MCP surfaces share one domain model rather than adapter-specific logic

## Target Architecture

- add shared services in `src/authoring/*` for workspace scope, LF normalization, revisioning, inspect generation, change-set application, rewrite ownership, journal access, undo, search, and preview adapters
- keep `sdd-helper` responsible only for argument parsing, stdin request loading, service invocation, and JSON output
- reuse existing compile, project, validate, and preview exports rather than duplicating orchestration

## [Done] Checkpoint 1: Contracts, Workspace, Revisions, Journal

- add TypeScript contract types for inspect, change sets, helper errors, and helper command args/results
- implement repo-root path guards and LF-based revisioning
- implement the journal abstraction rooted at `.sdd-state/`
- verify repo-scope rejection, LF normalization stability, dry-run versus committed journal behavior, and `create_document` record shape

## [Done] Checkpoint 2: Inspect Model And Handles

- implement parse-backed inspect payload generation with `top_level_order`, `body_stream`, `structural_order_streams`, and stable same-revision handles
- keep comments and blank lines internal to rewrite ownership
- verify repeated inspect stability, handle invalidation after revision change, and inspect availability for parse-valid but compile-invalid documents

## [Done] Checkpoint 3: Rewrite Engine, Create, And Non-Ordering Mutations

- implement deterministic rewrite/serialization that preserves comments and blank lines
- implement `create_document`, `set_node_name`, `set_node_property`, `remove_node_property`, `insert_node_block`, `delete_node_block`, `insert_edge_line`, and `remove_edge_line`
- wire validate-profile and optional projection feedback into `apply`
- verify duplicate-property rejection, append/replace semantics, diagnostics on dry-run and commit, and create journaling with undo eligibility

## [Done] Checkpoint 4: Ordering Operations And Undo

- implement `reposition_top_level_node`, `reposition_structural_edge`, and `move_nested_node_block`
- implement dry-run and committed undo with the exact current-revision precondition
- implement undo of create as file deletion returning `document_effect: "deleted"`
- verify ordering summaries, the structural-versus-organizational ordering distinction, stale revision/handle rejection, undo rejection after external edits, and undo-create deletion behavior

## [Done] Checkpoint 5: Helper CLI Surface

- add `sdd-helper` commands for `inspect`, `search`, `create`, `apply`, `undo`, `preview`, `git-status`, and `git-commit`
- implement JSON stdout behavior and `HelperErrorResult`
- reuse shared search and preview services and keep git wrappers narrow and `.sdd`-scoped
- verify stdin request handling, success payloads, rejected payloads, non-zero helper errors, and `.sdd`-only git scope

## Implementation Log

### Checkpoint 1

Implemented: added the shared authoring foundation under `src/authoring/*`, including internal contracts, repo-scoped workspace path enforcement, LF normalization and content-derived revisions, committed journal persistence under `.sdd-state/`, and `.gitignore` coverage for the sidecar state directory.

Verified with: `TMPDIR=/tmp pnpm exec vitest run tests/authoringFoundation.spec.ts` and `TMPDIR=/tmp pnpm test`.

Checkpoint report:
- Satisfied invariants: `.sdd` write targets stayed repo-relative, LF normalization drove revision identity, committed journal state lived under `.sdd-state/`, diagnostics were sorted before persistence, and the create-document journal shape included delete-on-undo metadata.
- Violated invariants: none found.
- Residual risks: inspect generation, rewrite/apply behavior, real creation flows beyond the checkpoint-1 substrate, and undo execution were still intentionally deferred.

### Checkpoint 2

Implemented: added the parse-backed inspect service with deterministic revision-bound handles, deterministic `top_level_order`, `body_stream`, and `structural_order_streams`, plus internal rewrite-trivia ownership while keeping comments and blank lines out of the public inspect contract.

Verified with: `TMPDIR=/tmp pnpm exec vitest run tests/authoringInspect.spec.ts` and `TMPDIR=/tmp pnpm test`.

Checkpoint report:
- Satisfied invariants: public paths stayed repo-relative, inspect remained parse-backed, handles were stable within a revision and invalidated across revisions, payload ordering stayed deterministic, and public inspect output excluded trivia.
- Violated invariants: none found.
- Residual risks: rewrite/apply had not yet consumed the new rewrite-ownership metadata, so the inspect-time trivia ownership model was only verified directly by tests at that checkpoint.

### Checkpoint 3

Implemented: added the source-preserving rewrite layer, `create_document`, non-ordering `apply_change_set` operations, narrow bootstrap insert-on-empty-template behavior, post-change parse/compile/validate/projection feedback, and committed restore metadata to support later undo.

Verified with: `TMPDIR=/tmp pnpm exec vitest run tests/authoringMutations.spec.ts` and `TMPDIR=/tmp pnpm test`.

Checkpoint report:
- Satisfied invariants: repo-local `.sdd` writes only, LF-based revisioning, parse-backed handle resolution on valid documents, narrow bootstrap handling for the empty skeleton, preserved untouched comments and blank lines, and committed journal state with delete-on-create and restore-on-update inverse metadata.
- Violated invariants: none found.
- Residual risks: ordering operations and undo execution were still intentionally deferred beyond checkpoint 3.

### Checkpoint 4

Implemented: added `reposition_top_level_node`, `reposition_structural_edge`, and `move_nested_node_block`, plus dry-run and committed undo from journaled inverse metadata, with committed undo results marked terminal via `undo_eligible: false`.

Verified with: `TMPDIR=/tmp pnpm exec vitest run tests/authoringOrderingAndUndo.spec.ts` and `TMPDIR=/tmp pnpm test`.

Checkpoint report:
- Satisfied invariants: ordering operations resolved against base-revision inspect handles, moved items carried owned leading trivia, structural-edge summaries used structural-stream indices, nested-block summaries used full parent `body_stream` indices, undo enforced exact current-revision matches, and committed undo-create deleted the file while terminal undo records used `inverse.kind = "none"`.
- Violated invariants: none found.
- Residual risks: undo-of-undo and redo remain unsupported in v0.1, and top-level trailing-trivia ownership still relies on the checkpoint-3 document model rather than a richer top-level ownership scheme.

### Checkpoint 5

Implemented: added the separate `sdd-helper` JSON CLI, shared list/search/preview/git authoring services, strict JSON stdout behavior, file-or-stdin request loading, `.sdd`-scoped git wrappers, and focused helper/service/git coverage alongside the existing `sdd` CLI.

Verified with: `TMPDIR=/tmp pnpm run build`, `TMPDIR=/tmp pnpm exec vitest run tests/helperCli.spec.ts tests/authoringDirectoryServices.spec.ts tests/authoringGitHelpers.spec.ts`, and `TMPDIR=/tmp pnpm test`.

Checkpoint report:
- Satisfied invariants: `sdd-helper` remained separate from `sdd`, helper stdout stayed JSON-first, shared authoring services were reused instead of duplicated, preview stayed on the existing preview workflow, and git helpers remained repo-root scoped and `.sdd`-only.
- Violated invariants: none found.
- Residual risks: `listDocuments(...)` currently exists as shared infrastructure rather than a helper command surface, and parse-invalid files are skipped from list/search result bodies and surfaced through diagnostics rather than a richer partial-document contract.

## Acceptance Matrix

Implementation acceptance must cover at least one scenario each for:

- inspect
- create
- apply dry-run
- apply commit
- duplicate-property rejection
- top-level reorder
- structural-edge reorder
- nested-block move
- undo update
- undo create
- preview
- helper error JSON

Each checkpoint report must explicitly state:

- satisfied invariants
- violated invariants
- residual risks

## Deferred / Out Of Scope

- read-only MCP adapter work
- write-capable MCP adapter work
- multi-user collaboration
- generalized git or shell workflows
- renderer-internal public APIs
