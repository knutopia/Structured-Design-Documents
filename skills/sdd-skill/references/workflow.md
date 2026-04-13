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

Build change requests from that returned `revision` and those handles. Do not invent handles.

## 4. Create A New Document

The current helper supports an empty-template create flow:

```bash
skills/sdd-skill/scripts/run_helper.sh create docs/example.sdd --template empty --version 0.1
```

If the new document needs follow-on edits, inspect it first and then proceed with normal `apply` requests.

## 5. Dry-Run A Change Set

Use `apply` as a dry run by default. Omit `mode` or set `mode` to `"dry_run"`.

Example request shape:

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

## 6. Commit A Change Set

When the dry run is acceptable and the user wants the change applied, resubmit the same request with:

```json
"mode": "commit"
```

The skill should not skip straight to commit unless the user clearly wants the real mutation carried out.

## 7. Preview A Result

Use preview when rendered confirmation is helpful:

```bash
skills/sdd-skill/scripts/run_helper.sh preview bundle/v0.1/examples/outcome_to_ia_trace.sdd \
  --view ia_place_map \
  --profile strict \
  --format svg \
  --backend staged_ia_place_map_preview
```

Preview is for rendered confirmation, not for structured mutation.

## 8. Undo A Helper-Managed Commit

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

## 9. Narrow Git Workflows

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
