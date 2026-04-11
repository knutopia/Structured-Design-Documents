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

## Checkpoint 1: Contracts, Workspace, Revisions, Journal

- add TypeScript contract types for inspect, change sets, helper errors, and helper command args/results
- implement repo-root path guards and LF-based revisioning
- implement the journal abstraction rooted at `.sdd-state/`
- verify repo-scope rejection, LF normalization stability, dry-run versus committed journal behavior, and `create_document` record shape

## Checkpoint 2: Inspect Model And Handles

- implement parse-backed inspect payload generation with `top_level_order`, `body_stream`, `structural_order_streams`, and stable same-revision handles
- keep comments and blank lines internal to rewrite ownership
- verify repeated inspect stability, handle invalidation after revision change, and inspect availability for parse-valid but compile-invalid documents

## Checkpoint 3: Rewrite Engine, Create, And Non-Ordering Mutations

- implement deterministic rewrite/serialization that preserves comments and blank lines
- implement `create_document`, `set_node_name`, `set_node_property`, `remove_node_property`, `insert_node_block`, `delete_node_block`, `insert_edge_line`, and `remove_edge_line`
- wire validate-profile and optional projection feedback into `apply`
- verify duplicate-property rejection, append/replace semantics, diagnostics on dry-run and commit, and create journaling with undo eligibility

## Checkpoint 4: Ordering Operations And Undo

- implement `reposition_top_level_node`, `reposition_structural_edge`, and `move_nested_node_block`
- implement dry-run and committed undo with the exact current-revision precondition
- implement undo of create as file deletion returning `document_effect: "deleted"`
- verify ordering summaries, the structural-versus-organizational ordering distinction, stale revision/handle rejection, undo rejection after external edits, and undo-create deletion behavior

## Checkpoint 5: Helper CLI Surface

- add `sdd-helper` commands for `inspect`, `search`, `create`, `apply`, `undo`, `preview`, `git-status`, and `git-commit`
- implement JSON stdout behavior and `HelperErrorResult`
- reuse shared search and preview services and keep git wrappers narrow and `.sdd`-scoped
- verify stdin request handling, success payloads, rejected payloads, non-zero helper errors, and `.sdd`-only git scope

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
