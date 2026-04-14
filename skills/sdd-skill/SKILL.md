---
name: sdd-skill
description: "(Structured Design Documents): search .sdd files, inspect structure, create documents, edit (plan/apply/undo), render previews, perform narrow .sdd-scoped git checks & commits."
---

# SDD Skill

Use this skill when the current workspace is this SDD repository, or a structurally compatible checkout, and the task involves `.sdd` documents.

This skill enables working with structured design documents. In this repo source tree, the bundled helper wrapper lives at `skills/sdd-skill/scripts/run_helper.sh`. In an installed skill copy, the same wrapper is available as `scripts/run_helper.sh` relative to the installed skill directory. Use the repo-visible path in this checkout as the stable entrypoint to the `sdd-helper` utility instead of raw file editing, so changes stay revision-bound, handle-based, and aligned to the shared authoring contracts.

## Quick Start

- Use `skills/sdd-skill/scripts/run_helper.sh capabilities` if you need to confirm the current helper surface.
- Use `skills/sdd-skill/scripts/run_helper.sh search ...` when the user has not named a target `.sdd` document yet.
- Use `skills/sdd-skill/scripts/run_helper.sh inspect <document_path>` before any edit to obtain fresh `revision` and handle data.
- Prefer `apply` as a dry run first. Commit only when the user wants the mutation carried out.
- Use `preview` only after a clean `apply` dry run under the same target profile. Preview confirms a committed, validated state; it does not decide readiness.
- Use `undo` only for helper-managed committed change sets.

## Default Workflow

1. Orient:
   use `search` only if the target document is unknown; otherwise go straight to `inspect`.
2. Inspect:
   get the current `revision`, node handles, and body-item handles before planning a change.
3. Plan:
   build an `ApplyChangeSetArgs` request from fresh handles. Include `validate_profile` whenever the user wants confirmation under a specific profile, and add `projection_views` when structured semantic confirmation is helpful.
4. Dry run:
   submit `apply` with omitted `mode` or `mode: "dry_run"` and review the returned status, summary, and diagnostics. If parse or validation errors remain, continue the inspect/apply cycle and do not preview yet.
5. Commit:
   if the dry run is acceptable for the target profile and the user wants the change applied, resubmit that validated request with `mode: "commit"`.
6. Confirm:
   use `preview` only for the committed revision that already passed a clean dry run under the same profile.

## Edit Safety Rules

- Do not hand-edit `.sdd` structure when the helper supports the operation.
- Treat helper JSON result kinds as the public interface.
- Do not construct or parse handles manually.
- Do not reuse handles across later turns without a fresh `inspect`.
- Intermediate revisions are allowed during multi-pass helper authoring when fresh handles are needed. Treat them as staging checkpoints only; do not preview them or describe them as ready until the target profile is clean.
- Treat `sdd-change-set` with `status: "rejected"` as a domain result to interpret, not as a shell failure.
- Treat `sdd-helper-error` as a helper-layer failure that must be classified before continuing. Many cases are invocation or environment problems, but preview can also fail here when the document is still invalid or incomplete under the requested profile.
- Keep helper paths repo-relative and `.sdd`-scoped.

## Supported Helper Surface

This skill should refer only to the currently available helper commands:

- `inspect`
- `search`
- `create`
- `apply`
- `undo`
- `preview`
- `git-status`
- `git-commit`

Do not promise standalone helper commands that do not exist today, including `project`, `validate`, or `list documents`.

## When To Preview

Use `preview` when the user needs visible confirmation, especially for:

- committed states that already passed a clean `apply` dry run under the same profile
- view-sensitive structural changes
- renderer-facing proof checks
- confirming that a change has the intended visible effect

Do not confuse preview with semantic projection or validation. Preview is a render artifact.
The preview profile should match the `validate_profile` that gated the document state, and the previewed revision should be the same committed state that passed that dry run.
If preview returns `sdd-helper-error`, inspect the message and any attached `diagnostics` before assuming the helper environment is broken.

## When To Use Helper Git Commands

Use helper git commands only for narrow `.sdd`-scoped workflows:

- `git-status` to inspect SDD-local git state
- `git-commit` to commit only explicit `.sdd` paths

Do not treat helper git commands as a replacement for general Git usage in the repo.

## Reference Map

Read only what you need:

- `references/workflow.md` for the standard helper-based operating sequence
- `references/change-set-recipes.md` for common `ChangeOperation` patterns
- `references/current-helper-gaps.md` for the current limits of the helper surface
