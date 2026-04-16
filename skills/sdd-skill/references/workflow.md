# SDD Skill Workflow

This file gives the concrete helper-first workflow for the `sdd-skill`.

In the repo source tree, use `skills/sdd-skill/scripts/run_helper.sh`; in an installed skill copy, the same wrapper is available as `scripts/run_helper.sh` relative to the installed skill folder.

## 1. Confirm The Helper Surface

Use this when you suspect the helper surface may have changed:

```bash
skills/sdd-skill/scripts/run_helper.sh capabilities
```

The result is the canonical JSON command manifest for the helper.

## 2. Find A Target Document

If the user has not named a document, search first:

```bash
skills/sdd-skill/scripts/run_helper.sh search --query claim --under bundle/v0.1/examples --limit 5
```

Use the returned paths to choose the most likely document, then inspect that document.

## 3. Inspect Before Editing

Inspect is the normal starting point for edits:

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

## 4. Create A New Document

The current helper creates an empty bootstrap document:

```bash
skills/sdd-skill/scripts/run_helper.sh create example.sdd --version 0.1
```

This creates a bootstrap document only. A newly created empty document may still be parse-invalid or validation-incomplete until it is populated, so do not preview immediately after `create`.

When the user does not specify a location, default the new document path to the current working directory expressed as a repo-relative `.sdd` path. If the prompt names or clearly implies a location, honor that instead. Do not infer destinations from examples or documentation layout.

If the new document needs follow-on edits, use `author` for common scaffold creation or inspect it first and proceed with low-level `apply` requests.

## 5. Dry-Run A Helper Mutation

Use `author` or `apply` as a dry run by default. Omit `mode` or set `mode` to `"dry_run"`.
If you intend to preview under a profile later, include the same `validate_profile` here first.

Use `author` when the task is mostly scaffold creation or nested structure authoring.
Use `apply` when you need exact low-level `ChangeOperation` control from current handles.

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

If parse or validation errors remain, continue the inspect/author-or-apply cycle and do not preview yet.

## 6. Commit A Change Set

When the dry run is acceptable for the chosen profile and the user wants the change applied, resubmit the same validated request with:

```json
"mode": "commit"
```

The skill should not skip straight to commit unless the user clearly wants the real mutation carried out.
If further edits require fresh handles, either use committed `author` `created_targets`, committed `apply` insertion handles, or inspect the committed result and repeat the dry-run validation gate before previewing.

## 7. Validate Or Project A Committed Result

Use persisted-state semantic reads when you want confirmation after commit or when you do not need a mutation request at all:

```bash
skills/sdd-skill/scripts/run_helper.sh validate bundle/v0.1/examples/outcome_to_ia_trace.sdd --profile strict
skills/sdd-skill/scripts/run_helper.sh project bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map
```

These commands read the current on-disk document only. They do not inspect dry-run candidates.

## 8. Preview A Result

Interpret requests for a visible result semantically, not only from exact technical words. Phrases such as "show it", "render it", "draw it", "make a diagram", "show the information architecture", and "show the place map" should normally produce a saved user-facing artifact.

If the user wants a saved preview artifact, use `sdd show` after the last committed revision has already passed a clean dry-run validation under the same profile:

```bash
TMPDIR=/tmp pnpm sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd \
  --view ia_place_map \
  --profile strict
```

If the user did not request a specific output path, let `sdd show` write beside the `.sdd` using its default sibling filename `<source>.<view>.<profile>[.<backend>].<format>`. If the prompt names a destination or filename, pass `--out` and honor it.

For app areas, pages, navigation, or information architecture, default to `ia_place_map` when no other view is implied. If multiple views are equally plausible, ask one short clarifying question.

Use helper preview only when you need transient raw artifact output rather than the normal user-facing final deliverable:

```bash
skills/sdd-skill/scripts/run_helper.sh preview bundle/v0.1/examples/outcome_to_ia_trace.sdd \
  --view ia_place_map \
  --profile strict \
  --format svg \
  --backend staged_ia_place_map_preview
```

`sdd-helper preview` is for transient rendered confirmation, not for structured mutation or the default saved deliverable.
It is not a substitute for validation. The profile used for `sdd show` or `preview` should match the `validate_profile` used in the gating dry run, and the rendered output should come from that same committed state.
If preview returns `sdd-helper-error`, read the helper message and any attached `diagnostics`. An invalid intermediate document under the requested profile can fail in the helper-error lane even when the preview environment itself is healthy.

## 9. Undo A Helper-Managed Commit

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

## 10. Narrow Git Workflows

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
