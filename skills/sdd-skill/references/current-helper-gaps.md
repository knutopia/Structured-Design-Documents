# Current Helper Gaps

This file records the limits of the current helper surface so the skill does not quietly promise more than the repo supports today.

## Supported Today

The current helper exposes:

- `diagrams`
- `inspect`
- `search`
- `create`
- `apply`
- `author`
- `undo`
- `validate`
- `project`
- `preview`
- `git-status`
- `git-commit`
- `contract`
- `capabilities`

These are the only helper commands the skill should present as available.
`capabilities` and `contract` are introspection commands for helper discovery and
helper contract detail; they do not add new standalone SDD document-authoring
semantics. `capabilities` remains static. Bundle-resolved `contract` reports the
loaded manifest path and language version for subsequent `--bundle` calls.

## Finding Semantic Confirmation

When the skill needs semantic confirmation after a change, it should use:

- `author` or `apply` with `validate_profile` for pre-commit candidate validation
- `author` or `apply` with `projection_views` for combined-view candidate projection feedback or `projection_diagrams` for named Diagram IDs
- standalone `validate` for current persisted-state validation
- standalone `project` for current persisted-state projection
- `preview` when rendered confirmation is more useful than structured data

## Current Create Limits

The current `create` flow is intentionally narrow:

- create always bootstraps an empty document skeleton
- the selected bundle supplies the creation version; optional `--version` asserts that value

The skill should not promise richer bootstrap or starter-pack flows until the helper actually exposes them.

## Why This Matters

The helper is the machine-facing contract for the skill. If the skill teaches commands or flows that the helper does not actually support, the skill becomes misleading and harder to trust.

When in doubt, resolve `<helper>` as described in the main skill file, then verify against:

- `<helper> capabilities`
- `docs/doc_site/sdd-helper/index.md`
- `src/authoring/contracts.ts`

## Named Diagrams

The v0.2 helper supports declaration and membership authoring through existing node operations and generic `set_edge_property` / `remove_edge_property` edits. Discover names and counts through `diagrams`, and inspect exact inventories with `diagrams --details`; select a named ID with `project --diagram` or `preview --diagram`. A view is inferred, and an optional `--view` must agree. Unknown IDs, invalid memberships, and empty visible named content never fall back to combined content.

Read the active bundle’s declaration type, type property, membership property, enabled views, and reference delimiter. Use fresh revision-bound edge handles for edge membership, inspect the result, and validate the full document. Existing guided diagram filters retain view-type semantics; named membership is not assigned automatically.
