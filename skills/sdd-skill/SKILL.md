---
name: sdd-skill
description: "(Structured Design Documents): search .sdd files, inspect structure, create documents, edit (plan/apply/undo), render previews, perform narrow .sdd-scoped git checks & commits."
---

# SDD Skill

Use this skill when the current workspace is this SDD repository, or a structurally compatible checkout, and the task involves `.sdd` documents.

This skill enables working with structured design documents. Use the bundled helper wrapper instead of raw file editing, so changes stay revision-bound, handle-based, and aligned to the shared authoring contracts.

## Resolve Helper First

Before any helper call, resolve one helper executable for this task:

1. If `skills/sdd-skill/scripts/run_helper.sh` exists from the repo root, use that.
2. Otherwise, use the installed skill wrapper at `<skill_dir>/scripts/run_helper.sh`.

Call the resolved executable `<helper>` in these instructions. For every later helper command, replace `<helper>` with the full resolved path. Do not run bare `scripts/run_helper.sh` from the repo root. `<helper>` is a documentation placeholder, not a shell variable.

## Start Here

First classify the task: new document; existing document (edit, inspect, validate, project, or render); search; helper-failure diagnosis; or a command that does not consume a bundle. For a task that consumes a bundle, complete this startup once.

### Bundle Startup Procedure

1. **Choose the initial bundle.** Honor a supplied manifest or requested shipped version; find and verify that version's manifest. Otherwise, select a matching available bundle for an existing document whose declaration is known. For a new document without a requested version, let the helper use its configured selection: saved global bundle preference, then repository fallback. Resolve any document/bundle mismatch before mutation; a document header does not select or migrate a bundle.
2. **Resolve the initial contract.** Obtain a bundle-resolved contract relevant to the next operation, including `--bundle` when the initial manifest is known. This initial resolution is required. See [workflow contract selection](references/workflow.md#contract-selection) for subjects and the inspect/search fallback.
3. **Retain the returned manifest.** Read the absolute `resolution.manifest_path`; use that returned path as `<manifest>` throughout the workflow, including custom manifests.
4. **Pass the retained manifest.** Every subsequent bundle-consuming helper command and saved `sdd show` command receives `--bundle <manifest>`, including later bundle-resolved contracts.
5. **Use the selected language authority.** SDD language semantics come from the selected manifest and its referenced core files and profiles. Request additional contract detail only when needed for request composition, allowed values, or formatting guidance.

Static help, `capabilities`, static contracts, and git-only operations bypass bundle setup.

- Helper discovery is the helper-command authority: use `<helper> capabilities` to confirm which helper commands exist. Use only commands returned by `<helper> capabilities`.
- Helper contract detail is the helper request/result authority: use `<helper> contract <subject_id>` for exact request shape, result shape, continuation semantics, helper constraints, and bundle-binding metadata for one helper command.
- Before composing the first `author` request, read `authoring_format_card` from the resolved author contract. If not already available, request it with `<helper> --bundle <manifest> contract helper.command.author --purpose request --resolve bundle`. Read the manifest's referenced syntax file when deeper language semantics are needed or the card is absent.
- Shared `assessment` answers whether to stop, continue, commit, or render.
- Use docs to explain a surface or investigate a mismatch. Use implementation code for implementation debugging, not normal helper request-shape recovery.
- For helper commands whose contract reports a JSON request body through `--request`, pass a request file path by default. Use `--request -` only when the JSON is piped in the same shell command.

## Branch Selector

### Create New Document

- Choose the repo-relative `.sdd` path directly. Default to the current working directory unless the user names or clearly implies another location.
- Do not search repo `.sdd` examples to pick a filename, infer syntax, or infer structure unless the user explicitly asks for comparison or example reuse.
- Run `create`, then continue from the returned `revision`; immediate `inspect` is not the normal next step because the empty bootstrap may still be parse-invalid.
- Prefer `author` for first-pass scaffold creation.
- Do not let "nesting is not semantic" become "avoid nesting". For child nodes with one clear local parent and no reuse or cross-cutting placement intent, prefer both the explicit semantic edge and nested source placement under the parent for readability.
- When nesting child nodes under a parent, keep the parent's semantic edge lines above nested child blocks. Prefer body order: properties, semantic edge lines, nested child blocks. Do not place relationship lines after the nested blocks they introduce.

### Edit Existing Document

- If the target `.sdd` is unknown, use `<helper> --bundle <manifest> search ...` only to locate the existing document or node.
- Once the target is known, use `<helper> --bundle <manifest> inspect <document_path>` to obtain the current `revision`, handles, and order data before handle-based changes.
- Prefer `author` for common scaffold creation and `apply` for surgical handle-based edits.
- Determine any needed bundle-defined relationship from the active bundle files before composing view-sensitive structure. Do not rely on nested source layout as semantic proof.
- Keep child nodes top-level only when nesting would mislead, such as reuse, multiple semantic parents, cross-cutting placement, or unclear ownership.
- Dry-run `author` or `apply` first. Commit only when `assessment.can_commit` is true and the user wants the real mutation.

### Read, Validate, Project, Or Render Existing Document

- If the document is already named, do not force a search or edit-oriented inspect step.
- Use `validate` and `project` for persisted-state semantic reads.
- For create, make, generate, render, draw, show, display, or view diagram requests, produce a saved file artifact by default.
- Use `sdd show` for saved user-facing diagram artifacts.
- When the user explicitly requests every applicable diagram type, use `sdd show --bundle <manifest> --view all`; detail-aware empty views are skipped and explicit output names receive per-view modifiers.
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

When using this skill, do not claim or rely on helper commands unless `<helper> capabilities` reports them; for example. `references/current-helper-gaps.md` tracks the current command inventory. 

## Reference Map

Read only what you need:

- `references/workflow.md` for the standard assessment-first helper workflow, preview branches, and helper-error diagnosis
- `references/change-set-recipes.md` for common `ChangeOperation` patterns
- `references/current-helper-gaps.md` for the current limits of the helper surface
- the selected manifest and its referenced core files when the task needs SDD-language semantics
