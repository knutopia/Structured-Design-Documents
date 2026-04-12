---
name: sdd-skill
description: Use when working with Structured Design Documents in this repository through sdd-helper: search repo-relative .sdd files, inspect structure, create documents, plan and apply structured change sets, render previews, undo helper-managed changes, and perform narrow .sdd-scoped git checks and commits without raw file editing.
---

# SDD Skill

Use this skill when the current workspace is this SDD repository, or a structurally compatible checkout, and the task involves `.sdd` documents.

This skill is helper-first. For structural SDD authoring, prefer `scripts/run_helper.sh` over raw file editing so the workflow stays revision-bound, handle-based, and aligned to the shared authoring contracts.

## Quick Start

- Use `scripts/run_helper.sh capabilities` if you need to confirm the current helper surface.
- Use `scripts/run_helper.sh search ...` when the user has not named a target `.sdd` document yet.
- Use `scripts/run_helper.sh inspect <document_path>` before any edit to obtain fresh `revision` and handle data.
- Prefer `apply` as a dry run first. Commit only when the user wants the mutation carried out.
- Use `preview` when rendered confirmation helps verify the change.
- Use `undo` only for helper-managed committed change sets.

## Default Workflow

1. Orient:
   use `search` only if the target document is unknown; otherwise go straight to `inspect`.
2. Inspect:
   get the current `revision`, node handles, and body-item handles before planning a change.
3. Plan:
   build an `ApplyChangeSetArgs` request from fresh handles. Use `validate_profile` and `projection_views` when semantic confirmation is helpful.
4. Dry run:
   submit `apply` with omitted `mode` or `mode: "dry_run"` and review the returned summary and diagnostics.
5. Commit:
   if the dry run is acceptable and the user wants the change applied, resubmit with `mode: "commit"`.
6. Confirm:
   use `preview` when a rendered view is the clearest proof that the change did what was intended.

## Edit Safety Rules

- Do not hand-edit `.sdd` structure when the helper supports the operation.
- Treat helper JSON result kinds as the public interface.
- Do not construct or parse handles manually.
- Do not reuse handles across later turns without a fresh `inspect`.
- Treat `sdd-change-set` with `status: "rejected"` as a domain result to interpret, not as a shell failure.
- Treat `sdd-helper-error` as an invocation or environment failure that should be fixed before continuing.
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

- view-sensitive structural changes
- renderer-facing proof checks
- confirming that a change has the intended visible effect

Do not confuse preview with semantic projection. Preview is a render artifact.

## When To Use Helper Git Commands

Use helper git commands only for narrow `.sdd`-scoped workflows:

- `git-status` to inspect SDD-local git state
- `git-commit` to commit only explicit `.sdd` paths

Do not treat helper git commands as a replacement for general Git usage in the repo.

## Reference Map

Read only what you need:

- `references/workflow.md` for the standard helper-first operating sequence
- `references/change-set-recipes.md` for common `ChangeOperation` patterns
- `references/current-helper-gaps.md` for the current limits of the helper surface
