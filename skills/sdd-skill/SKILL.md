---
name: sdd-skill
description: "(Structured Design Documents): search .sdd files, inspect structure, create documents, edit (plan/apply/undo), render previews, perform narrow .sdd-scoped git checks & commits."
---

# SDD Skill

Use this skill when the current workspace is this SDD repository, or a structurally compatible checkout, and the task involves `.sdd` documents.

This skill enables working with structured design documents. In this repo source tree, the bundled helper wrapper lives at `skills/sdd-skill/scripts/run_helper.sh`. In an installed skill copy, the same wrapper is available as `scripts/run_helper.sh` relative to the installed skill directory. Use the repo-visible path in this checkout as the stable entrypoint to the `sdd-helper` utility instead of raw file editing, so changes stay revision-bound, handle-based, and aligned to the shared authoring contracts.

## Start Here

- Helper discovery is the helper-command authority: use `skills/sdd-skill/scripts/run_helper.sh capabilities` to confirm which helper commands exist.
- Helper contract detail is the helper request/result authority: use `skills/sdd-skill/scripts/run_helper.sh contract <subject_id>` for exact request shape, result shape, continuation semantics, helper constraints, and bundle-binding metadata for one helper command.
- SDD language semantics come from `bundle/v0.1/manifest.yaml` plus the active core bundle files, including `bundle/v0.1/core/syntax.yaml`, `bundle/v0.1/core/vocab.yaml`, `bundle/v0.1/core/contracts.yaml`, and `bundle/v0.1/core/views.yaml`.
- Shared `assessment` answers whether to stop, continue, commit, or render.
- Use docs to explain a surface or investigate a mismatch. Use implementation code for implementation debugging, not normal helper request-shape recovery.
- For helper commands whose contract reports a JSON request body through `--request`, pass a request file path by default. Use `--request -` only when the JSON is piped in the same shell command.
- First choose one branch: create a new document; edit an existing document; read, validate, project, or render an existing document; diagnose helper failure; or use helper git commands.

## Branch Selector

### Create New Document

- Choose the repo-relative `.sdd` path directly. Default to the current working directory unless the user names or clearly implies another location.
- Do not search repo `.sdd` examples to pick a filename, infer syntax, or infer structure unless the user explicitly asks for comparison or example reuse.
- Run `create`, then continue from the returned `revision`; immediate `inspect` is not the normal next step because the empty bootstrap may still be parse-invalid.
- Prefer `author` for first-pass scaffold creation. Use `contract helper.command.create` or `contract helper.command.author` when bootstrap continuation or request-shape detail matters.
- Do not let "nesting is not semantic" become "avoid nesting". For child nodes with one clear local parent and no reuse or cross-cutting placement intent, prefer both the explicit semantic edge and nested source placement under the parent for readability.

### Edit Existing Document

- If the target `.sdd` is unknown, use `skills/sdd-skill/scripts/run_helper.sh search ...` only to locate the existing document or node.
- Once the target is known, use `skills/sdd-skill/scripts/run_helper.sh inspect <document_path>` to obtain the current `revision`, handles, and order data before handle-based changes.
- Prefer `author` for common scaffold creation and `apply` for surgical handle-based edits.
- Determine any needed bundle-defined relationship from the active bundle files before composing view-sensitive structure. Do not rely on nested source layout as semantic proof.
- Keep child nodes top-level only when nesting would mislead, such as reuse, multiple semantic parents, cross-cutting placement, or unclear ownership.
- Dry-run `author` or `apply` first. Commit only when `assessment.can_commit` is true and the user wants the real mutation.

### Read, Validate, Project, Or Render Existing Document

- If the document is already named, do not force a search or edit-oriented inspect step.
- Use `validate` and `project` for persisted-state semantic reads.
- Use `contract --resolve bundle` only when active bundle-owned values such as `<view_id>` or `<profile_id>` are needed and not already known.
- For create, make, generate, render, draw, show, display, or view diagram requests, produce a saved file artifact by default.
- Use `sdd show` for saved user-facing diagram artifacts.
- Use helper `preview` only for transient helper output, raw artifact access, or a chat-safe `artifact_path` for inline image display.
- If no output path is specified, save beside the `.sdd`; do not invent a new output directory.
- Render only from a committed persisted state whose returned assessment says `assessment.can_render` is true.

### Diagnose Helper Failure

- Treat `sdd-change-set` rejections as structured domain results, not shell failures.
- Treat `sdd-helper-error` as a helper-layer result that must be classified before continuing.
- Read `assessment.layer`, `assessment.should_stop`, `assessment.next_action`, and `assessment.blocking_diagnostics` before deciding whether to retry, revise the request, report a blocker, or inspect environment state.
- Preview can fail in the helper-error lane when the document is invalid or incomplete under the requested profile; do not assume every preview helper error is an environment failure.

### Use Helper Git Commands

- Use helper git commands only for narrow `.sdd`-scoped workflows.
- Use `git-status` to inspect SDD-local git state.
- Use `git-commit` to commit only explicit `.sdd` paths.
- Do not treat helper git commands as a replacement for general-purpose Git work in the repo.

## Hard Stops

- Do not hand-edit `.sdd` structure when the helper supports the operation.
- Use request files by default for helper commands whose contract reports a JSON body through `--request`.
- Use `--request -` only when JSON is piped in the same shell command.
- Inspect before handle-based edits to existing documents.
- Use the `revision` returned by `create` for fresh-document bootstrap follow-on authoring.
- Dry-run mutations before commit.
- Do not render before clean committed validation and persisted-state assessment.
- Do not finish a diagram/render request with only helper `preview` output unless the user explicitly requested preview-only or inline-only output.
- Save diagram/render outputs beside the `.sdd` by default; create no new output directory unless the user explicitly requested that directory.
- Defer acceptance judgment to shared `assessment`.
- Use `assessment.should_stop`, `assessment.next_action`, and `assessment.blocking_diagnostics` for stop/report decisions.
- Commit only when dry-run `assessment.can_commit` is true and the user wants a real mutation.
- Render only when persisted-state `assessment.can_render` is true.
- Do not treat result `status` as the acceptance gate.
- If an expected `assessment` is missing from a relevant helper payload, stop and verify helper/contract surface instead of reimplementing acceptance logic in the skill.
- Do not construct or parse handles manually.
- Do not reuse handles across later turns without a fresh `inspect` or committed continuation handle for the returned `resulting_revision`.
- Do not inspect TypeScript contracts, tests, or repo `.sdd` examples to recover normal helper request-shape knowledge when `capabilities` and `contract` already provide it.

## Supported Helper Surface

This skill should refer only to the currently available helper commands:

- `capabilities`
- `contract`
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

## Reference Map

Read only what you need:

- `references/workflow.md` for the standard assessment-first helper workflow, preview branches, and helper-error diagnosis
- `references/change-set-recipes.md` for common `ChangeOperation` patterns
- `references/current-helper-gaps.md` for the current limits of the helper surface
- `bundle/v0.1/manifest.yaml` plus active core bundle files when the task needs SDD-language semantics
