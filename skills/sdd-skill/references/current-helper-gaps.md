# Current Helper Gaps

This file records the limits of the current helper surface so the skill does not quietly promise more than the repo supports today.

## Supported Today

The current helper exposes:

- `inspect`
- `search`
- `create`
- `apply`
- `undo`
- `preview`
- `git-status`
- `git-commit`

These are the only helper commands the skill should present as available.

## Not Exposed As Standalone Helper Commands

The helper does not currently expose standalone commands for:

- projection readout
- validation-only readout
- list-documents discovery

When the skill needs semantic confirmation after a change, it should use:

- `apply` with `validate_profile`
- `apply` with `projection_views`
- `preview` when rendered confirmation is more useful than structured data

## Current Create Limits

The current `create` flow is intentionally narrow:

- `template_id=empty` is the documented supported template
- version `0.1` is the documented supported version

The skill should not promise richer templates until the helper actually exposes them.

## Why This Matters

The helper is the machine-facing contract for the skill. If the skill teaches commands or flows that the helper does not actually support, the skill becomes misleading and harder to trust.

When in doubt, verify against:

- `scripts/run_helper.sh capabilities`
- `docs/readme_support_docs/sdd-helper/README.md`
- `src/authoring/contracts.ts`
