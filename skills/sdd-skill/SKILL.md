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
- When creating a new `.sdd`, default to the current working directory expressed as a repo-relative path unless the user names or clearly implies another location.
- Use `skills/sdd-skill/scripts/run_helper.sh inspect <document_path>` before any edit to obtain fresh `revision` and handle data.
- Prefer `author` for common scaffold creation and `apply` for surgical handle-based edits.
- Dry-run `author` or `apply` first. Commit only when the user wants the mutation carried out.
- Use `validate` and `project` for persisted-state semantic reads after commit or when a standalone read is enough.
- Use `sdd show` for saved user-facing preview artifacts, and use `preview` only when you need transient helper preview output after a clean `author` or `apply` dry run under the same target profile.
- Use `undo` only for helper-managed committed change sets.

## Default Workflow

1. Orient:
   use `search` only if the target document is unknown; otherwise go straight to `inspect`.
2. Inspect:
   get the current `revision`, node handles, and body-item handles before planning a low-level change. For high-level scaffold work, inspect is still the safest default when you need broad context.
3. Plan:
   choose `ApplyAuthoringIntentArgs` when the task is mostly creating or extending common structure; choose `ApplyChangeSetArgs` when you need exact low-level control from fresh handles. Include `validate_profile` whenever the user wants confirmation under a specific profile, and add `projection_views` when structured semantic confirmation is helpful.
   When creating a new document, default the target path to the current working directory as a repo-relative `.sdd` path. Honor explicit or clearly implied output locations, and do not infer destinations from examples, walkthroughs, or documentation structure.
4. Dry run:
   submit `author` or `apply` with omitted `mode` or `mode: "dry_run"` and review the returned status, summary, and diagnostics. If parse or validation errors remain, continue the inspect/author-or-apply cycle and do not preview yet.
5. Commit:
   if the dry run is acceptable for the target profile and the user wants the change applied, resubmit that validated request with `mode: "commit"`.
6. Confirm:
   use `validate` or `project` for persisted-state semantic confirmation. If the user wants a visible artifact, save it with `TMPDIR=/tmp pnpm sdd show <document_path> --view <view_id> --profile <profile_id>` using the same committed, validated state. Use `preview` only for transient helper output or raw artifact confirmation.

## Edit Safety Rules

- Do not hand-edit `.sdd` structure when the helper supports the operation.
- Treat helper JSON result kinds as the public interface.
- Do not construct or parse handles manually.
- Do not reuse handles across later turns without a fresh `inspect`.
- Committed `author` `created_targets` and committed `apply` insertion handles are safe continuation surfaces for the returned `resulting_revision`. Dry-run handles and dry-run `created_targets` are informational only.
- Intermediate revisions are allowed during multi-pass helper authoring when fresh handles are needed. Treat them as staging checkpoints only; do not preview them or describe them as ready until the target profile is clean.
- Treat `sdd-change-set` with `status: "rejected"` as a domain result to interpret, not as a shell failure.
- Treat `sdd-helper-error` as a helper-layer failure that must be classified before continuing. Many cases are invocation or environment problems, but preview can also fail here when the document is still invalid or incomplete under the requested profile.
- Keep helper paths repo-relative and `.sdd`-scoped.

## Supported Helper Surface

This skill should refer only to the currently available helper commands:

- `inspect`
- `search`
- `create`
- `author`
- `apply`
- `undo`
- `validate`
- `project`
- `preview`
- `git-status`
- `git-commit`

Do not promise helper commands that still do not exist today, including `list documents`.

## When To Preview

Interpret visual-result intent semantically, not only from exact technical terms. Treat requests such as "show it", "render it", "draw it", "make a diagram", "show the information architecture", "show the place map", and similar wording as requests for a saved user-facing preview artifact.

If the user only needs structured semantic output, `project` may be enough and you do not need to force a saved preview artifact.

Use `sdd show` for persisted user-facing preview artifacts, especially for:

- committed states that already passed a clean `apply` dry run under the same profile
- view-sensitive structural changes
- renderer-facing proof checks
- confirming that a change has the intended visible effect

For app areas, pages, navigation, or information architecture, default to `ia_place_map` when no other view is implied. Ask one short clarifying question only when multiple views are equally plausible.

Use `preview` when you need transient helper output rather than the default final deliverable, especially for:

- committed states that already passed a clean `apply` dry run under the same profile
- view-sensitive structural changes
- renderer-facing proof checks
- raw artifact access for another tool or workflow

Do not confuse saved previews or helper preview output with semantic projection or validation. Use `validate` and `project` for standalone persisted-state semantic reads, and use inline `validate_profile` and `projection_views` on `author` or `apply` for pre-commit candidate feedback.
The profile for `sdd show` or `preview` should match the `validate_profile` that gated the document state, and the rendered output should come from that same committed state. Save the preview beside the `.sdd` by default unless the user requested a specific output path or filename.
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
