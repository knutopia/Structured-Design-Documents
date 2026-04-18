# Change-Set Recipes

This file maps common authoring intents to the current `ChangeOperation` vocabulary in `src/authoring/contracts.ts`.

These recipes are workflow guidance only. The helper contract and the shared TypeScript types remain authoritative.

## General Rules

- Prefer `author` for common scaffold creation and nested structure work. Use these recipes when you specifically need low-level `apply` control.
- Inspect first and use fresh handles from the current `revision`.
- Prefer dry-run `apply` first.
- Keep public helper paths repo-relative.
- When an operation can affect semantics, include `validate_profile` and optionally `projection_views`.
- Keep the semantic edge explicit even when you also want readable nested source. For singly-owned children, prefer both the explicit relationship line and nested block placement.

## Rename A Node

Intent: change the display name of an existing node.

Use:

```json
{
  "kind": "set_node_name",
  "node_handle": "<node-handle>",
  "name": "New Name"
}
```

## Set Or Replace A Node Property

Intent: add or update a property on a node.

Use:

```json
{
  "kind": "set_node_property",
  "node_handle": "<node-handle>",
  "key": "description",
  "value_kind": "quoted_string",
  "raw_value": "Updated description"
}
```

Use `value_kind: "bare_value"` for unquoted scalar values such as `high` or `Q3` when that matches the intended source text.

## Remove A Node Property

Intent: remove a property line from a node.

Use:

```json
{
  "kind": "remove_node_property",
  "node_handle": "<node-handle>",
  "key": "description"
}
```

## Insert A New Top-Level Node

Intent: add a new node block at top level.

Use:

```json
{
  "kind": "insert_node_block",
  "node_type": "Outcome",
  "node_id": "O-999",
  "name": "New Outcome",
  "placement": {
    "mode": "last",
    "stream": "top_level"
  }
}
```

Choose the `placement` that matches the desired top-level order.

## Insert A Nested Child Block For Readability

Intent: insert a child node as a nested `+` block under a parent body stream while still authoring the explicit semantic edge separately.

Use:

```json
{
  "kind": "insert_node_block",
  "node_type": "Place",
  "node_id": "P-210",
  "name": "Projects Overview",
  "placement": {
    "mode": "last",
    "stream": "body",
    "parent_handle": "<area-handle>"
  }
}
```

Pair that with an explicit relationship line such as:

```json
{
  "kind": "insert_edge_line",
  "parent_handle": "<area-handle>",
  "rel_type": "CONTAINS",
  "to": "P-210",
  "to_name": "Projects Overview",
  "placement": {
    "mode": "last",
    "stream": "body",
    "parent_handle": "<area-handle>"
  }
}
```

Use this pattern when the child has one clear structural parent and is not intended for reuse elsewhere in the source.

## Delete A Node

Intent: remove an existing node block.

Use:

```json
{
  "kind": "delete_node_block",
  "node_handle": "<node-handle>"
}
```

Use this carefully when other relationships reference the node.

## Add A Relationship Line

Intent: insert a new edge line under a parent node.

Use:

```json
{
  "kind": "insert_edge_line",
  "parent_handle": "<parent-handle>",
  "rel_type": "CONTAINS",
  "to": "P-002",
  "to_name": "Review",
  "placement": {
    "mode": "last",
    "stream": "body",
    "parent_handle": "<parent-handle>"
  }
}
```

Include `event`, `guard`, `effect`, or `props` only when the target relationship shape needs them.

## Remove A Relationship Line

Intent: remove an existing edge line.

Use:

```json
{
  "kind": "remove_edge_line",
  "edge_handle": "<edge-handle>"
}
```

## Reorder Top-Level Nodes

Intent: change top-level declaration order.

Use:

```json
{
  "kind": "reposition_top_level_node",
  "node_handle": "<node-handle>",
  "placement": {
    "mode": "before",
    "stream": "top_level",
    "anchor_handle": "<other-top-level-node-handle>"
  }
}
```

## Reorder Structural Relationships

Intent: change the source order of structural relationship lines such as `CONTAINS` or `COMPOSED_OF`.

Use:

```json
{
  "kind": "reposition_structural_edge",
  "edge_handle": "<edge-handle>",
  "placement": {
    "mode": "after",
    "stream": "body",
    "anchor_handle": "<other-edge-handle>",
    "parent_handle": "<parent-handle>"
  }
}
```

## Move A Nested Node Block

Intent: move a nested `+` block within a parent body stream.

Use:

```json
{
  "kind": "move_nested_node_block",
  "node_handle": "<nested-node-handle>",
  "placement": {
    "mode": "last",
    "stream": "body",
    "parent_handle": "<parent-handle>"
  }
}
```

## Typical `ApplyChangeSetArgs` Envelope

Most mutation requests follow this shape:

```json
{
  "path": "<repo-relative-document-path>",
  "base_revision": "<revision-from-inspect>",
  "operations": [
    {
      "kind": "set_node_property",
      "node_handle": "<node-handle>",
      "key": "description",
      "value_kind": "quoted_string",
      "raw_value": "Updated description"
    }
  ],
  "validate_profile": "strict",
  "projection_views": ["ia_place_map"]
}
```

Add `"mode": "commit"` only when the change should actually be written.
