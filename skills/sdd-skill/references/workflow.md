# SDD Skill Workflow

This file gives the concrete helper-first workflow for the `sdd-skill`.

In the repo source tree, use `skills/sdd-skill/scripts/run_helper.sh`; in an installed skill copy, the same wrapper is available as `scripts/run_helper.sh` relative to the installed skill folder.

## 1. Confirm The Helper Surface

Use this when you suspect the helper surface may have changed:

```bash
skills/sdd-skill/scripts/run_helper.sh capabilities
```

The result is the canonical JSON command manifest for the helper.

Use deep helper introspection only when the current task needs it:

```bash
skills/sdd-skill/scripts/run_helper.sh contract helper.command.author
skills/sdd-skill/scripts/run_helper.sh contract helper.command.preview --resolve bundle
```

Treat `capabilities` as the thin orientation surface and `contract` as the deep contract surface.

## 2. Choose The Task Kind

Start by classifying the request as one of:

- create a new document
- edit an existing document
- read, validate, project, or render an existing document
- diagnose helper failure
- use helper git commands

Use the matching branch below instead of forcing every request through one linear search/inspect path.

## 3. Targeted Bundle Reading And Language Authority

Use helper `capabilities` and helper `contract` for helper mechanics: command availability, request shape, result shape, request transport, continuation semantics, and helper constraints. Use the active bundle files for SDD language semantics: source syntax, node and relationship vocabulary, relationship endpoint validity, projection behavior, and profile behavior.

For implementation audits of bundle authority, the parser path loads bundle data with `loadBundle(...)` and consumes syntax through `createParserSyntaxRuntime(bundle)`. This is evidence of the runtime path, not a normal authoring fallback for helper request shapes.

Do not turn this into a broad preflight for every task. Read only the bundle files that answer the current semantic question:

- read `bundle/v0.1/manifest.yaml` first for fresh authoring or when active core files need confirmation
- read `bundle/v0.1/core/syntax.yaml` for node IDs, node headers, edge lines, property lines, nesting, and source syntax
- read `bundle/v0.1/core/vocab.yaml` for node and relationship token selection
- read `bundle/v0.1/core/contracts.yaml` for relationship endpoint validity
- read `bundle/v0.1/core/views.yaml` for projection scope, hierarchy edges, ordering edges, view-specific annotations, and rendered-view behavior
- read profile files only when profile behavior is needed beyond profile IDs exposed by helper contract resolution

Prompt words are input language. Bundle vocabulary and contracts decide SDD language. A user word that resembles a node or relationship token still needs token selection from `vocab.yaml` and endpoint validation from `contracts.yaml` before it becomes authored source.

Nesting is source organization and readability. Explicit bundle-defined relationships carry graph semantics. Nesting alone does not establish graph semantics.

Projection checks and rendered views are checks and presentation boundaries; they do not replace graph authoring targets. If projection output shows that intended meaning is absent, revise the graph using bundle-authorized syntax, vocabulary, contracts, and view semantics, then check again.

Examples, snapshots, and goldens are downstream evidence only. Do not inspect `.sdd` examples to infer language rules; use them only for comparison, regression investigation, or user-requested reuse after bundle authority is known.

`contract --resolve bundle` expands active helper-exposed values such as `view_id` and `profile_id` for commands that declare those bundle bindings. It does not replace the bundle files as the general authority for node or relationship vocabulary, relationship endpoint rules, source syntax, or view behavior.

## 4. Read Outcome Assessment

Relevant helper success payloads and `sdd-helper-error` payloads may include `assessment`. Treat that shared assessment as the workflow gate.

Use:

- `assessment.should_stop` to decide whether the current branch must stop before continuing
- `assessment.next_action` as the immediate repair, retry, report, or continuation instruction
- `assessment.blocking_diagnostics` as the error-severity diagnostics to surface when blocked
- `assessment.can_commit` to decide whether a dry-run mutation is eligible for commit
- `assessment.can_render` to decide whether the persisted state is eligible for rendering

Use `status`, `summary`, `diagnostics`, and `projection_results` as supporting detail for review and explanation. Do not treat result `status` as the acceptance gate.

If an expected assessment is missing from a relevant helper payload, stop and verify helper capability or contract detail before continuing. Do not recreate assessment rules in the skill prose.

## 5. Create A New Document

Choose the repo-relative output path directly. When the user does not specify a location, default the new document path to the current working directory expressed as a repo-relative `.sdd` path. If the prompt names or clearly implies a location, honor that instead. Do not infer destinations from examples or documentation layout.

For new-document authoring, do not use `search` to pick a filename or to hunt repo `.sdd` examples. Only use repo `.sdd` examples when the user explicitly asks for comparison or example reuse.

The current helper creates an empty bootstrap document:

```bash
skills/sdd-skill/scripts/run_helper.sh create <document_path> --version 0.1
```

This creates a bootstrap document only. A newly created empty document may still be parse-invalid or validation-incomplete until it is populated, so do not preview immediately after `create`.

Use the `revision` returned by `create` as the continuation surface for the next mutation request. Immediate `inspect` is not the normal next step after `create`, because the empty bootstrap may still be parse-invalid. If the returned `assessment.next_action` gives a more specific bootstrap instruction, follow it.

If the bootstrap continuation rule matters for planning the next step, fetch the subject detail explicitly:

```bash
skills/sdd-skill/scripts/run_helper.sh contract helper.command.create
```

For first-pass scaffold creation, prefer `author`. Before composing the request, determine whether the intended result requires a bundle-defined relationship for structure, flow, navigation, ordering, or other view-relevant meaning. Do not rely on nesting alone for semantics. If later follow-on work needs exact handle-based changes, inspect the now-parseable committed result and proceed with low-level `apply` requests.

## 6. Edit An Existing Document

If the target existing `.sdd` document is unknown, search first:

```bash
skills/sdd-skill/scripts/run_helper.sh search --query <query> --under <repo_relative_directory> --limit <count>
```

Use the returned paths to choose the most likely existing document, then inspect that document.

Inspect is the normal starting point for existing-document edits:

```bash
skills/sdd-skill/scripts/run_helper.sh inspect <document_path>
```

Inspect returns:

- the current `revision`
- node handles
- body-item handles
- top-level order
- structural-order streams

Build low-level change requests from that returned `revision` and those handles. Do not invent handles.

Use `author` when the task is mostly scaffold creation or nested structure authoring. Use `apply` when you need exact low-level `ChangeOperation` control from current handles.

Before composing either request, determine whether the intended result depends on a bundle-defined relationship rather than nesting alone. Nesting is an authoring affordance, not semantic proof. When the change should affect projected meaning, resolve the bundle-defined relationship first and author it explicitly.

Before composing complex nested `author`, `apply`, or `undo` JSON, fetch the current subject detail in static mode rather than spelunking code or tests for normal request-shape knowledge:

```bash
skills/sdd-skill/scripts/run_helper.sh contract helper.command.author
skills/sdd-skill/scripts/run_helper.sh contract helper.command.apply
skills/sdd-skill/scripts/run_helper.sh contract helper.command.undo
```

## 7. Read, Validate, Project, Or Render An Existing Document

If the document is already named and the user only needs a read, validation, projection, or preview result, do not `search`.

Use persisted-state semantic reads when you want confirmation without issuing a mutation request:

```bash
skills/sdd-skill/scripts/run_helper.sh validate <document_path> --profile <profile_id>
skills/sdd-skill/scripts/run_helper.sh project <document_path> --view <view_id>
```

Read the returned assessment before proceeding. Use `assessment.can_render` as the render gate for persisted-state diagram artifact work.

If the relevant `view_id` or `profile_id` is not already known, use `contract --resolve bundle` to expand the active helper-exposed values before choosing command arguments:

```bash
skills/sdd-skill/scripts/run_helper.sh contract helper.command.validate --resolve bundle
skills/sdd-skill/scripts/run_helper.sh contract helper.command.project --resolve bundle
skills/sdd-skill/scripts/run_helper.sh contract helper.command.preview --resolve bundle
```

For normal human-facing diagram requests, produce a durable saved file. Use `sdd show` only after the relevant committed persisted state returns `assessment.can_render` for the requested profile and view:

```bash
TMPDIR=/tmp pnpm sdd show <document_path> \
  --view <view_id> \
  --profile <profile_id>
```

If the user did not request a specific output path, let `sdd show` write beside the `.sdd` using its default sibling filename. If the prompt names a destination or filename, pass `--out` and honor it. Do not create a new output directory unless the user explicitly named that directory in the requested output path.

Use one of these branches and stop after the one that matches the final response:

File-link-only branch:

- run `sdd show`
- link the saved sibling artifact in the response
- stop there; do not call helper `preview`

Inline-image branch:

- run `sdd show`
- link the saved sibling artifact in the response
- call helper `preview` with the same document, view, profile, and format
- use the returned `artifact_path` as the Markdown image source in the final response
- keep the saved sibling artifact as the canonical file link

Inline-image command:

```bash
skills/sdd-skill/scripts/run_helper.sh preview <document_path> \
  --view <view_id> \
  --profile <profile_id> \
  --format <format>
```

Helper `preview` returns `artifact_path`, an ephemeral absolute temp path under `/tmp/unique-previews` with a unique parent directory per invocation. Preview success payloads do not include inline SVG text or base64 PNG data. Do not present `artifact_path` as the real saved artifact. The saved sibling artifact is the canonical file for file links, while `artifact_path` is only a presentation/workflow path because chat may cache local image content by absolute path.

If the user wants transient raw artifact output instead, use helper `preview` and consume the file at `artifact_path`.

## 8. Dry-Run A Helper Mutation

Use `author` or `apply` as a dry run by default. Omit `mode` or set `mode` to `"dry_run"`.
If you intend to preview under a profile later, include the same `validate_profile` here first.

If you need nested request-shape detail, helper constraints, or continuation rules before composing the mutation payload, fetch the static subject detail with `contract` first.
If the mutation depends on SDD language semantics, read the targeted bundle files in section 3 before choosing node tokens, relationship tokens, endpoint pairs, source syntax, profile behavior, or view behavior.

Example low-level `apply` request shape:

```json
{
  "path": "<document_path>",
  "base_revision": "<revision-from-inspect>",
  "operations": [
    {
      "kind": "set_node_property",
      "node_handle": "<node-handle-from-inspect>",
      "key": "description",
      "value_kind": "quoted_string",
      "raw_value": "Updated description from dry run"
    }
  ],
  "validate_profile": "<profile_id>",
  "projection_views": ["<view_id>"]
}
```

Submit it with:

```bash
skills/sdd-skill/scripts/run_helper.sh apply --request <request_file>
```

Review assessment first:

- if `assessment.should_stop` is true, stop and follow `assessment.next_action`
- if `assessment.blocking_diagnostics` is non-empty, report those diagnostics as the blocker
- if `assessment.can_commit` is false, do not submit the same request with commit mode
- if `assessment.can_commit` is true and the user wants the real mutation, the request is commit-eligible

Then use supporting fields for explanation and review:

- `status`
- `summary`
- `diagnostics`
- optional `projection_results`
- committed-only continuation handles from successful `summary.node_insertions` and `summary.edge_insertions`

Use `projection_results` to review whether the result matches the user's intended structure, not to replace assessment-based acceptance. If the result is structurally valid but does not match the user's intent, revise and dry-run again.

## 9. Keep Bundle Semantics And Readable Source Separate

Treat semantic correctness and source readability as separate concerns:

- semantic truth comes from the bundle-defined relationship or other bundle-owned mechanism
- readable local grouping comes from nesting a child block under a local parent when that layout is not misleading
- nested source layout by itself is not semantic proof

Preferred helper stance:

- use `author` nested `children` by default for first-pass scaffold creation when a child has one clear local parent
- when using low-level `apply`, author the bundle-defined relationship explicitly when the intended result depends on it
- keep children top-level when reuse, multiple semantic parents, or cross-cutting placement would make nesting misleading

Readable source pass:

- choose node and edge semantics from bundle authority
- author explicit semantic edges
- nest singly-owned children under the local parent for readability
- keep top-level placement when reuse, multiple semantic parents, cross-cutting placement, or misleading nesting makes local nesting inappropriate

Use `contract --resolve bundle` for active helper-exposed `view_id` and `profile_id` values. Use the targeted bundle files in section 3 for bundle-owned relationship names, node tokens, endpoint rules, source syntax, profile behavior, and view semantics.

## 10. Commit A Change Set

When dry-run `assessment.can_commit` is true and the user wants the change applied, resubmit the same request with:

```json
"mode": "commit"
```

The skill should not skip straight to commit unless the user clearly wants the real mutation carried out.
Read the committed result assessment. If further edits require fresh handles, either use committed `author` `created_targets`, committed `apply` insertion handles, or inspect the committed result and repeat the dry-run assessment gate before previewing.

## 11. Validate Or Project A Committed Result

Use persisted-state semantic reads when you want confirmation after commit or when you do not need a mutation request at all:

```bash
skills/sdd-skill/scripts/run_helper.sh validate <document_path> --profile <profile_id>
skills/sdd-skill/scripts/run_helper.sh project <document_path> --view <view_id>
```

These commands read the current on-disk document only. They do not inspect dry-run candidates. Use their returned assessment to decide whether the persisted state is blocked, needs review, or can be rendered.

## 12. Produce A Diagram Artifact

Interpret requests for a visible result semantically, not only from exact technical words. General requests such as "create a diagram", "make a diagram", "generate a diagram", "render it", "draw it", "show it", "display it", or "view it" produce a saved user-facing diagram artifact by default. A helper preview is a display aid; it is not the deliverable unless the user explicitly asks for preview-only, inline-only, or transient helper output.

Use `sdd show` after the last committed persisted-state assessment has `assessment.can_render` set to true:

```bash
TMPDIR=/tmp pnpm sdd show <document_path> \
  --view <view_id> \
  --profile <profile_id>
```

If the user did not request a specific output path, let `sdd show` write beside the `.sdd` using its default sibling filename `<source>.<view>.<profile>[.<backend>].<format>`. If the prompt names a destination or filename, pass `--out` and honor it. Do not create a new output directory unless the user explicitly named that directory in the requested output path.

If the current workflow already has a matching helper `preview` `artifact_path` and the user asks to save the diagram, copy that artifact to the durable output path instead of rerendering. A preview matches only when it came from the same document, committed revision, view, profile, format, and backend in the same workflow context. If matching metadata is unavailable, use `sdd show` instead of copying. The default durable path still stays beside the `.sdd`.

Use one of these branches and stop after the one that matches the final response:

File-link-only branch:

- run `sdd show`
- link the saved sibling artifact in the response
- stop there; do not call helper `preview`

Inline-image branch:

- run `sdd show`
- link the saved sibling artifact in the response
- call helper `preview` with the same document, view, profile, and format
- use the returned `artifact_path` as the Markdown image source in the final response
- keep the saved sibling artifact as the canonical file link

Inline-image command:

```bash
skills/sdd-skill/scripts/run_helper.sh preview <document_path> \
  --view <view_id> \
  --profile <profile_id> \
  --format <format>
```

Do not present `artifact_path` as the real saved artifact. Use the canonical sibling file for file links and the returned `artifact_path` for the Markdown image. The temp preview artifact under `/tmp/unique-previews` is only a presentation/workflow path for chat path caching and transient consumers, while the sibling artifact remains the real preview identity.

If the relevant `view_id` or `profile_id` is unknown, use `contract --resolve bundle` to expand the active helper-exposed values before choosing arguments for `preview` or `sdd show`. Read `views.yaml` or profile files when you need behavior beyond the IDs.

Use helper preview alone only when the user explicitly asks for preview-only, inline-only, transient raw artifact output, or a chat-safe artifact path rather than the normal saved deliverable:

```bash
skills/sdd-skill/scripts/run_helper.sh preview <document_path> \
  --view <view_id> \
  --profile <profile_id> \
  --format <format> \
  --backend <backend_id>
```

`sdd-helper preview` is for transient rendered confirmation, not for structured mutation or the default saved deliverable.
It is not a substitute for validation or projection. The profile used for `sdd show` or `preview` should match the profile used in the persisted-state assessment gate, and the rendered output should come from that same committed state. Treat the returned `artifact_path` as a temp presentation/workflow path only, not as the canonical preview artifact path.
If preview returns `sdd-helper-error`, read `assessment.layer`, `assessment.next_action`, and any attached `diagnostics`. An invalid intermediate document under the requested profile can fail in the helper-error lane even when the preview environment itself is healthy.

## 13. Undo A Helper-Managed Commit

Undo works from a `change_set_id` returned by a prior committed helper-managed change set.

Example request shape:

```json
{
  "change_set_id": "<change-set-id>",
  "mode": "dry_run",
  "validate_profile": "<profile_id>"
}
```

Submit it with:

```bash
skills/sdd-skill/scripts/run_helper.sh undo --request <request_file>
```

Read the undo dry-run assessment before committing an undo. Commit only when `assessment.can_commit` is true and the user wants the undo applied.

## 14. Diagnose Helper Failure

When a command returns `sdd-helper-error`, do not immediately treat it as an environment failure.

Use:

- `assessment.layer` to identify the failing layer
- `assessment.should_stop` to decide whether the branch must stop
- `assessment.next_action` to choose the immediate follow-up
- `assessment.blocking_diagnostics` to report concrete blockers

Malformed arguments, malformed JSON, and empty stdin are helper/request-boundary failures. Structured domain rejections remain normal JSON results and should be read through their own assessment. Preview can also fail in the helper-error lane when the document is not valid or renderable for the requested profile.

For request-loading commands, request files remain the safest default. Use `--request -` only when the JSON body is piped in the same shell command; empty stdin should be treated as a transport-layer helper failure.

## 15. Narrow Git Workflows

Use helper git commands only when the user wants `.sdd`-scoped git behavior.

Status:

```bash
skills/sdd-skill/scripts/run_helper.sh git-status <document_path>
```

Commit explicit `.sdd` paths:

```bash
skills/sdd-skill/scripts/run_helper.sh git-commit --message "Update example SDD" \
  <document_path>
```

These commands are intentionally narrow. They do not replace general-purpose Git work.

## 16. Retrieval Policy

Use `capabilities` for helper orientation and command discovery.

Use `contract` in static mode when:

- composing nested `author`, `apply`, or `undo` JSON
- checking helper constraints that are not safely inferable from top-level discovery
- checking continuation rules such as bootstrap revision handling or dry-run versus committed continuation surfaces

Use `contract --resolve bundle` only when:

- the task needs active helper-exposed values for `view_id` or `profile_id`
- the relevant values are not already known from the user request or current workflow context

Use docs to explain a surface or investigate a mismatch. Use implementation code for implementation debugging, not normal helper request-shape recovery. Do not inspect TypeScript contracts, tests, or repo `.sdd` examples to recover normal helper request-shape knowledge when helper contract introspection already provides it.

For SDD language questions, use the targeted bundle files in section 3 instead of treating helper discovery, tests, implementation literals, examples, snapshots, or goldens as language authority.

## 17. Guide Follow-Up Inventory

When later revising `docs/readme_support_docs/sdd-skill/README.md`, align it to this task-kind-first workflow:

- make the "start with an app idea" section clearly read as create-new-document flow rather than search-first flow
- make omitted filenames read as direct path/name selection, not document/example search
- make the follow-up edit examples explicitly read as existing-document edit flows
- split any wording that still implies one linear workflow for both creation and editing
- review example artifact references later for consistency with the current `sdd show` default naming convention and chosen profile wording
