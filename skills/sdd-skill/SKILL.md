---
name: sdd-skill
description: "(Structured Design Documents): search .sdd files, inspect structure, create documents, edit (plan/apply/undo), render previews, perform narrow .sdd-scoped git checks & commits."
---

# SDD Skill

Use this skill when the current workspace is this SDD repository, or a structurally compatible checkout, and the task involves `.sdd` documents.

This skill enables working with structured design documents. In this repo source tree, the bundled helper wrapper lives at `skills/sdd-skill/scripts/run_helper.sh`. In an installed skill copy, the same wrapper is available as `scripts/run_helper.sh` relative to the installed skill directory. Use the repo-visible path in this checkout as the stable entrypoint to the `sdd-helper` utility instead of raw file editing, so changes stay revision-bound, handle-based, and aligned to the shared authoring contracts.

## Quick Start

- Use `skills/sdd-skill/scripts/run_helper.sh capabilities` if you need to confirm the current helper surface.
- Use `skills/sdd-skill/scripts/run_helper.sh contract <subject_id>` when you need full request or result shape detail, semantic constraints, continuation rules, or bundle-binding metadata for one helper command.
- First classify the task as: create a new document, edit an existing document, or read/preview an existing document.
- For a new `.sdd`, choose the repo-relative path directly. Default to the current working directory unless the user names or clearly implies another location.
- Use `skills/sdd-skill/scripts/run_helper.sh search ...` only to locate an existing target `.sdd` document or node when the user has not named it yet.
- For existing-document edits, use `skills/sdd-skill/scripts/run_helper.sh inspect <document_path>` to obtain fresh `revision` and handle data before handle-based changes.
- For fresh-document bootstrap work, use `create` first and continue from the returned `revision`; use `skills/sdd-skill/scripts/run_helper.sh contract helper.command.create` when you need the bootstrap continuation caveats explicitly. Immediate `inspect` is not the normal first step because the empty bootstrap may still be parse-invalid.
- Prefer `author` for common scaffold creation and `apply` for surgical handle-based edits.
- Before composing `author` or `apply` requests for node-to-node structure that should matter to validation, projection, or rendering, determine the bundle-defined semantic relationship rather than assuming nesting is sufficient.
- Express structural, flow, navigation, and similar graph semantics through the bundle-defined mechanism. Treat nesting as authoring adjacency only unless the active language version explicitly defines an implication rule.
- Do not let "nesting is not semantic" drift into "avoid nesting". When a child has one clear structural parent and is not meant for reuse, prefer source that keeps the explicit edge and also nests the child block under that parent for readability.
- Dry-run `author` or `apply` first. Commit only when the user wants the mutation carried out.
- Use `validate` and `project` for persisted-state semantic reads after commit or when a standalone read is enough; use `contract --resolve bundle` only when you need active bundle-owned `view_id` or `profile_id` values first.
- Use `sdd show` for saved user-facing preview artifacts. Use helper `preview` when the final chat response needs a unique temp image path or another tool needs transient rendered output. Preview success payloads do not include inline SVG text or base64 PNG data; they return `artifact_path`, an ephemeral absolute path under `/tmp/unique-previews` whose parent directory is unique per invocation. If the final response embeds an inline image, use `artifact_path` as the Markdown image source while the sibling `sdd show` artifact remains the canonical file.
- Use `undo` only for helper-managed committed change sets.
- For new-document authoring, do not search repo `.sdd` examples to infer syntax or structure unless the user explicitly asks for comparison or example reuse.
- Use the fallback order `capabilities -> contract -> code/docs only if still insufficient`.

## Default Workflow

1. Identify the task kind:
   decide whether the user wants to create a new document, edit an existing document, or read/preview an existing document. Do not start with `search` or `inspect` until that branch is clear.
2. Create a new document:
   choose the repo-relative output path directly, defaulting to the current working directory unless the prompt names or clearly implies another location. Do not use `search` to pick a filename or to hunt examples, and do not infer the destination from examples, walkthroughs, or documentation layout.
   run `create`, then use the returned `revision` as the continuation surface. Prefer `author` for first-pass scaffold creation. Before composing the request, determine whether the intended result requires explicit semantic relationships and author them through the bundle-defined mechanism rather than relying on nesting alone. When a created child has one clear structural parent and no reuse intent, prefer source output that also nests the child block under that parent while keeping the explicit edge. Use `contract helper.command.create` when the bootstrap continuation rules matter for the next step. Immediate `inspect` is not the normal next step because the empty bootstrap document may still be parse-invalid.
3. Edit an existing document:
   if the target existing `.sdd` is unknown, use `search` to locate it. Once the target is known, use `inspect` to obtain the current `revision`, node handles, and body-item handles before planning handle-based changes.
   choose `ApplyAuthoringIntentArgs` when the task is mostly creating or extending common structure; choose `ApplyChangeSetArgs` when you need exact low-level control from fresh handles. Before composing the request, determine whether view-relevant structure, ordering, navigation, or other graph meaning must be expressed explicitly rather than through nesting alone. Keep the explicit relationship either way, but when a child has one clear structural parent and no reuse intent, prefer readable source that also nests the child block under that parent. Use `contract` in static mode before composing nested `author`, `apply`, or `undo` JSON when request-shape detail, semantic constraints, or continuation rules matter.
4. Read, validate, or preview an existing document:
   if the document is already named, do not `search`. Use `validate`, `project`, `sdd show`, or `preview` as appropriate without forcing an edit-oriented `inspect` step. Use `contract --resolve bundle` only when the relevant `view_id` or `profile_id` is not already known.
5. Dry run mutations:
   submit `author` or `apply` with omitted `mode` or `mode: "dry_run"` and review the returned status, summary, and diagnostics. Include `validate_profile` whenever the user wants confirmation under a specific profile, and add `projection_views` when structured semantic confirmation is helpful.
   if parse or validation errors remain, or if the selected projection does not reflect the intended semantic structure for a view-sensitive change, continue the create/author-or-inspect/author-or-apply cycle and do not preview yet.
6. Commit and confirm:
   if the dry run is acceptable for the target profile and the user wants the change applied, resubmit that validated request with `mode: "commit"`.
   if follow-on edits need fresh handles after commit, use committed continuation handles when available or re-`inspect` the committed result.
   use `validate` or `project` for persisted-state semantic confirmation. If the user wants a visible artifact, save it with `TMPDIR=/tmp pnpm sdd show <document_path> --view <view_id> --profile <profile_id>` using the same committed, validated state. If the final response will also embed the image inline in chat, call helper `preview` with the same document, view, profile, and format, then use the returned `artifact_path` as the Markdown image source while the file link stays canonical. Use helper `preview` otherwise only for transient helper output or raw artifact confirmation.

## Edit Safety Rules

- Do not hand-edit `.sdd` structure when the helper supports the operation.
- Treat helper JSON result kinds as the public interface.
- Treat `capabilities` as the thin discovery surface and `contract` as the deep contract surface.
- Do not construct or parse handles manually.
- Do not reuse handles across later turns without a fresh `inspect`.
- Committed `author` `created_targets` and committed `apply` insertion handles are safe continuation surfaces for the returned `resulting_revision`. Dry-run handles and dry-run `created_targets` are informational only.
- Intermediate revisions are allowed during multi-pass helper authoring when fresh handles are needed. Treat them as staging checkpoints only; do not preview them or describe them as ready until the target profile is clean.
- Do not assume nested scaffold `children` or nested `+` blocks create containment, composition, ordering, navigation, or any other semantic relationship. Nesting is an authoring affordance, not a semantic relationship.
- When a change is view-sensitive or semantically structural, confirm the bundle-defined relationship first and author that explicit relationship rather than relying on nesting alone.
- Prefer explicit edges plus readable nesting for singly-owned children such as `Area -> Place`, `Place -> ViewState`, and similar local structure. Omit nesting only when reuse, multiple parents, or cross-cutting placement would make a nested source layout misleading.
- Treat `sdd-change-set` with `status: "rejected"` as a domain result to interpret, not as a shell failure.
- Treat `sdd-helper-error` as a helper-layer failure that must be classified before continuing. Many cases are invocation or environment problems, but preview can also fail here when the document is still invalid or incomplete under the requested profile.
- Keep helper paths repo-relative and `.sdd`-scoped.
- For new-document authoring, do not use repo `.sdd` examples as a shortcut for syntax or structure inference unless the user explicitly asks for comparison or example reuse.
- Do not inspect TypeScript contracts, tests, or repo `.sdd` examples to recover normal helper request-shape knowledge when `capabilities` and `contract` already provide it.
- If helper discovery and contract data are insufficient to determine the semantic relationship needed for a change, fall back to authoritative bundle/spec docs before examples, while preserving the rule that the bundle governs machine behavior.
- Code/docs lookup remains acceptable only for implementation questions, contract/runtime mismatch debugging, genuine helper gaps, or authoritative bundle/spec reads needed to resolve semantics.

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

## When To Preview

Interpret visual-result intent semantically, not only from exact technical terms. Treat requests such as "show it", "render it", "draw it", "make a diagram", "show the information architecture", "show the place map", and similar wording as requests for a saved user-facing preview artifact.

If the user only needs structured semantic output, `project` may be enough and you do not need to force a saved preview artifact.

Use `sdd show` for persisted user-facing preview artifacts, especially for:

- committed states that already passed a clean `apply` dry run under the same profile
- view-sensitive structural changes
- renderer-facing proof checks
- confirming that a change has the intended visible effect

For app areas, pages, navigation, or information architecture, default to `ia_place_map` when no other view is implied. Ask one short clarifying question only when multiple views are equally plausible.

Use `preview` when you need transient helper output or a chat-safe unique artifact path rather than the default final deliverable, especially for:

- committed states that already passed a clean `apply` dry run under the same profile
- view-sensitive structural changes
- renderer-facing proof checks
- raw artifact access for another tool or workflow
- inline chat image display after `sdd show` already wrote the canonical preview beside the `.sdd`

Do not confuse saved previews or helper preview output with semantic projection or validation. Use `validate` and `project` for standalone persisted-state semantic reads, and use inline `validate_profile` and `projection_views` on `author` or `apply` for pre-commit candidate feedback.
Preview decision rules:

- If the user wants a visible preview artifact, use `sdd show`.
- If the final response will embed an inline image, call helper `preview` and use the returned `artifact_path` as the Markdown image source.
- Preview success payloads expose `format`, `mime_type`, and `artifact_path`; they do not include inline SVG text or base64 PNG data.
- Canonical file links always point at the saved sibling artifact from `sdd show`; the temp `artifact_path` is never the canonical artifact.
- Raw helper `preview` remains allowed only for transient helper output, chat-safe image embedding, or raw artifact workflows that can read the returned file.

The profile for `sdd show` or `preview` should match the `validate_profile` that gated the document state, and the rendered output should come from that same committed state. Save the preview beside the `.sdd` by default unless the user requested a specific output path or filename; `sdd show` will use `<source>.<view>.<profile>[.<backend>].<format>` for the default sibling filename. If you need an inline chat image, keep that sibling file as the canonical artifact and use helper `preview` only to get a temp `artifact_path` under `/tmp/unique-previews`. Chat may cache local images by absolute path, but the helper gives each preview invocation a unique parent directory so repeated renders remain display-safe.
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
- `bundle/v0.1/core/contracts.yaml` and `bundle/v0.1/core/views.yaml` when you must resolve bundle-owned semantic relationships for a specific task
- `definitions/v0.1/authoring_spec_type_first_dsl_sdd_text_v_0_dot_1.md` when you need the normative nesting-versus-semantics authoring rule
