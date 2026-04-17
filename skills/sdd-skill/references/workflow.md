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
- read, validate, or preview an existing document

Use the matching branch below instead of forcing every request through one linear search/inspect path.

## 3. Create A New Document

Choose the repo-relative output path directly. When the user does not specify a location, default the new document path to the current working directory expressed as a repo-relative `.sdd` path. If the prompt names or clearly implies a location, honor that instead. Do not infer destinations from examples or documentation layout.

For new-document authoring, do not use `search` to pick a filename or to hunt repo `.sdd` examples. Only use repo `.sdd` examples when the user explicitly asks for comparison or example reuse.

The current helper creates an empty bootstrap document:

```bash
skills/sdd-skill/scripts/run_helper.sh create example.sdd --version 0.1
```

This creates a bootstrap document only. A newly created empty document may still be parse-invalid or validation-incomplete until it is populated, so do not preview immediately after `create`.

Use the `revision` returned by `create` as the continuation surface for the next mutation request. Immediate `inspect` is not the normal next step after `create`, because the empty bootstrap may still be parse-invalid.

If the bootstrap continuation rule matters for planning the next step, fetch the subject detail explicitly:

```bash
skills/sdd-skill/scripts/run_helper.sh contract helper.command.create
```

For first-pass scaffold creation, prefer `author`. Before composing the request, determine whether the intended result requires explicit semantic relationships for structure, flow, navigation, ordering, or other view-relevant meaning. Do not rely on nesting alone for semantics; author the bundle-defined relationship explicitly when the intended outcome depends on it. If later follow-on work needs exact handle-based changes, inspect the now-parseable committed result and proceed with low-level `apply` requests.

## 4. Edit An Existing Document

If the target existing `.sdd` document is unknown, search first:

```bash
skills/sdd-skill/scripts/run_helper.sh search --query claim --under bundle/v0.1/examples --limit 5
```

Use the returned paths to choose the most likely existing document, then inspect that document.

Inspect is the normal starting point for existing-document edits:

```bash
skills/sdd-skill/scripts/run_helper.sh inspect bundle/v0.1/examples/outcome_to_ia_trace.sdd
```

Inspect returns:

- the current `revision`
- node handles
- body-item handles
- top-level order
- structural-order streams

Build low-level change requests from that returned `revision` and those handles. Do not invent handles.

Use `author` when the task is mostly scaffold creation or nested structure authoring. Use `apply` when you need exact low-level `ChangeOperation` control from current handles.

Before composing either request, determine whether the intended result depends on explicit semantic relationships rather than nesting alone. Nesting is an authoring affordance, not a semantic relationship. When the change should affect hierarchy, flow, navigation, ordering, or other projected meaning, resolve the bundle-defined relationship first and author it explicitly.

Before composing complex nested `author`, `apply`, or `undo` JSON, fetch the current subject detail in static mode rather than spelunking code or tests for normal request-shape knowledge:

```bash
skills/sdd-skill/scripts/run_helper.sh contract helper.command.author
skills/sdd-skill/scripts/run_helper.sh contract helper.command.apply
skills/sdd-skill/scripts/run_helper.sh contract helper.command.undo
```

## 5. Read, Validate, Or Preview An Existing Document

If the document is already named and the user only needs a read, validation, projection, or preview result, do not `search`.

Use persisted-state semantic reads when you want confirmation without issuing a mutation request:

```bash
skills/sdd-skill/scripts/run_helper.sh validate bundle/v0.1/examples/outcome_to_ia_trace.sdd --profile strict
skills/sdd-skill/scripts/run_helper.sh project bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map
```

If the relevant `view_id` or `profile_id` is not already known, resolve the active bundle-owned values first:

```bash
skills/sdd-skill/scripts/run_helper.sh contract helper.command.validate --resolve bundle
skills/sdd-skill/scripts/run_helper.sh contract helper.command.project --resolve bundle
skills/sdd-skill/scripts/run_helper.sh contract helper.command.preview --resolve bundle
```

If the user wants a saved preview artifact, use `sdd show` after the relevant committed revision has already passed a clean dry-run validation under the same profile:

```bash
TMPDIR=/tmp pnpm sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd \
  --view ia_place_map \
  --profile strict
```

If the response will embed that preview inline in chat, derive the saved artifact basename and request a display copy with helper `preview`:

```bash
skills/sdd-skill/scripts/run_helper.sh preview bundle/v0.1/examples/outcome_to_ia_trace.sdd \
  --view ia_place_map \
  --profile strict \
  --format svg \
  --display-copy-name outcome_to_ia_trace.ia_place_map.strict.svg
```

Use the saved sibling artifact for file links and the returned `display_copy_path` for the Markdown image. This rationale is deliberate: the sibling file is the canonical artifact, while the temp copy under `/tmp/unique-previews` exists only because chat may cache local image content by absolute path.

If the user wants transient raw artifact output instead, use helper `preview`.

## 6. Dry-Run A Helper Mutation

Use `author` or `apply` as a dry run by default. Omit `mode` or set `mode` to `"dry_run"`.
If you intend to preview under a profile later, include the same `validate_profile` here first.

If you need nested request-shape detail, semantic constraints, or continuation rules before composing the mutation payload, fetch the static subject detail with `contract` first.
If helper discovery and contract detail are still insufficient to determine the needed semantic relationship, read the authoritative bundle/spec material before relying on examples.

Example low-level `apply` request shape:

```json
{
  "path": "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
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
  "validate_profile": "strict",
  "projection_views": ["ia_place_map"]
}
```

Submit it with:

```bash
skills/sdd-skill/scripts/run_helper.sh apply --request /tmp/request.json
```

Review:

- `status`
- `summary`
- `diagnostics`
- optional `projection_results`
- committed-only continuation handles from successful `summary.node_insertions` and `summary.edge_insertions`

A dry run is acceptable for preview gating only when:

- `status` is `applied`
- the selected `validate_profile` reports no parse or validation errors
- for view-sensitive structural work, the relevant `projection_results` reflect the intended semantic hierarchy, flow, navigation, or ordering rather than only a structurally valid request

If parse or validation errors remain, or if the selected projection does not reflect the intended semantic structure, continue the relevant create/author-or-inspect/author-or-apply cycle and do not preview yet.

## 7. Commit A Change Set

When the dry run is acceptable for the chosen profile and the user wants the change applied, resubmit the same validated request with:

```json
"mode": "commit"
```

The skill should not skip straight to commit unless the user clearly wants the real mutation carried out.
If further edits require fresh handles, either use committed `author` `created_targets`, committed `apply` insertion handles, or inspect the committed result and repeat the dry-run validation gate before previewing.

## 8. Validate Or Project A Committed Result

Use persisted-state semantic reads when you want confirmation after commit or when you do not need a mutation request at all:

```bash
skills/sdd-skill/scripts/run_helper.sh validate bundle/v0.1/examples/outcome_to_ia_trace.sdd --profile strict
skills/sdd-skill/scripts/run_helper.sh project bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map
```

These commands read the current on-disk document only. They do not inspect dry-run candidates.

## 9. Preview A Result

Interpret requests for a visible result semantically, not only from exact technical words. Phrases such as "show it", "render it", "draw it", "make a diagram", "show the information architecture", and "show the place map" should normally produce a saved user-facing artifact.

If the user wants a saved preview artifact, use `sdd show` after the last committed revision has already passed a clean dry-run validation under the same profile and the gating dry run confirmed the intended semantics through projection:

```bash
TMPDIR=/tmp pnpm sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd \
  --view ia_place_map \
  --profile strict
```

If the user did not request a specific output path, let `sdd show` write beside the `.sdd` using its default sibling filename `<source>.<view>.<profile>[.<backend>].<format>`. If the prompt names a destination or filename, pass `--out` and honor it.

If the response will also embed the preview inline in chat, derive the basename from the actual saved artifact path and request a temp display copy:

```bash
skills/sdd-skill/scripts/run_helper.sh preview bundle/v0.1/examples/outcome_to_ia_trace.sdd \
  --view ia_place_map \
  --profile strict \
  --format svg \
  --display-copy-name outcome_to_ia_trace.ia_place_map.strict.svg
```

Use the canonical sibling file for file links and the returned `display_copy_path` for the Markdown image. Keep the rationale visible in your reasoning: the temp copy under `/tmp/unique-previews` is only a presentation workaround for chat path caching, while the sibling artifact remains the real preview identity.

For app areas, pages, navigation, or information architecture, default to `ia_place_map` when no other view is implied. If multiple views are equally plausible, ask one short clarifying question.

If the relevant `view_id` or `profile_id` is unknown, resolve the active bundle-owned values first with `contract --resolve bundle` before choosing arguments for `preview` or `sdd show`.

Use helper preview when you need transient raw artifact output or a chat-safe display copy rather than the normal saved deliverable:

```bash
skills/sdd-skill/scripts/run_helper.sh preview bundle/v0.1/examples/outcome_to_ia_trace.sdd \
  --view ia_place_map \
  --profile strict \
  --format svg \
  --backend staged_ia_place_map_preview
```

`sdd-helper preview` is for transient rendered confirmation, not for structured mutation or the default saved deliverable.
It is not a substitute for validation or projection. The profile used for `sdd show` or `preview` should match the `validate_profile` used in the gating dry run, and the rendered output should come from that same committed state whose projection already reflected the intended semantics. If `--display-copy-name` is used, treat the returned `display_copy_path` as a temp presentation path only, not as the canonical preview artifact path.
If preview returns `sdd-helper-error`, read the helper message and any attached `diagnostics`. An invalid intermediate document under the requested profile can fail in the helper-error lane even when the preview environment itself is healthy.

## 10. Undo A Helper-Managed Commit

Undo works from a `change_set_id` returned by a prior committed helper-managed change set.

Example request shape:

```json
{
  "change_set_id": "<change-set-id>",
  "mode": "dry_run",
  "validate_profile": "strict"
}
```

Submit it with:

```bash
skills/sdd-skill/scripts/run_helper.sh undo --request /tmp/undo-request.json
```

## 11. Narrow Git Workflows

Use helper git commands only when the user wants `.sdd`-scoped git behavior.

Status:

```bash
skills/sdd-skill/scripts/run_helper.sh git-status bundle/v0.1/examples/outcome_to_ia_trace.sdd
```

Commit explicit `.sdd` paths:

```bash
skills/sdd-skill/scripts/run_helper.sh git-commit --message "Update example SDD" \
  bundle/v0.1/examples/outcome_to_ia_trace.sdd
```

These commands are intentionally narrow. They do not replace general-purpose Git work.

## 12. Retrieval Policy

Use `capabilities` for helper orientation and command discovery.

Use `contract` in static mode when:

- composing nested `author`, `apply`, or `undo` JSON
- checking semantic constraints that are not safely inferable from top-level discovery
- checking continuation rules such as bootstrap revision handling or dry-run versus committed continuation surfaces

Use `contract --resolve bundle` only when:

- the task needs active bundle-owned values for `view_id` or `profile_id`
- the relevant values are not already known from the user request or current workflow context

Treat the fallback order as `capabilities -> contract -> code/docs only if still insufficient`.
Do not inspect TypeScript contracts, tests, or repo `.sdd` examples to recover normal helper request-shape knowledge when helper contract introspection already provides it.

## 13. Guide Follow-Up Inventory

When later revising `docs/readme_support_docs/sdd-skill/README.md`, align it to this task-kind-first workflow:

- make the "start with an app idea" section clearly read as create-new-document flow rather than search-first flow
- make omitted filenames read as direct path/name selection, not document/example search
- make the follow-up edit examples explicitly read as existing-document edit flows
- split any wording that still implies one linear workflow for both creation and editing
- review example artifact references later for consistency with the current `sdd show` default naming convention and chosen profile wording
