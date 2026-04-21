# Current Helper Gaps 4-13-26

This file records the limits of the current helper surface so the skill does not quietly promise more than the repo supports today.

## Supported Today

The current helper exposes:

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
semantics.

## Not Exposed As Standalone Helper Commands

The helper still does not currently expose standalone commands for:

- list-documents discovery

When the skill needs semantic confirmation after a change, it should use:

- `author` or `apply` with `validate_profile` for pre-commit candidate validation
- `author` or `apply` with `projection_views` for pre-commit candidate projection feedback
- standalone `validate` for current persisted-state validation
- standalone `project` for current persisted-state projection
- `preview` when rendered confirmation is more useful than structured data

## Current Create Limits

The current `create` flow is intentionally narrow:

- create always bootstraps an empty document skeleton
- version `0.1` is the documented supported version

The skill should not promise richer bootstrap or starter-pack flows until the helper actually exposes them.

## Why This Matters

The helper is the machine-facing contract for the skill. If the skill teaches commands or flows that the helper does not actually support, the skill becomes misleading and harder to trust.

When in doubt, verify against:

- `skills/sdd-skill/scripts/run_helper.sh capabilities`
- `docs/readme_support_docs/sdd-helper/README.md`
- `src/authoring/contracts.ts`
