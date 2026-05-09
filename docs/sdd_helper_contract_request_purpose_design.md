# SDD Helper Contract Request Purpose Design

Status: implementation target

Audience: maintainers extending the shared authoring contract layer, `sdd-helper`,
and the `sdd-skill` workflow

Purpose: define the smallest additive contract selector needed to stop routine
agent request-composition calls from receiving irrelevant result schemas.

This design follows the payload problem described in
[`sdd_helper_contract_payload_subdivision.md`](./sdd_helper_contract_payload_subdivision.md),
but narrows the solution. The goal is not a new contract view framework. The
goal is one small answer to one common question:

> How do I make the next valid request?

## Summary

Add one public selector to the helper contract command:

```bash
sdd-helper contract <subject_id> --purpose request [--resolve bundle]
```

No `--purpose` keeps today's full contract payload. The only supported purpose
in this slice is `request`.

The selector is named `--purpose`, not `--detail`, because the current contract
surface already uses `detail_modes` to describe static versus bundle-resolved
contract resolution. The new selector is a caller intent, not another resolution
mode. It is also not called "request shape" because `input_shape`,
`output_shape`, and shape ids already own the word "shape" in this contract.

This design covers the `Critical` and `High` priority helper subjects:

- `helper.command.author`
- `helper.command.apply`
- `helper.command.create`
- `helper.command.undo`

Implementation should land and prove `author` first. If that slice works, apply
the same constrained rule to `apply`, `create`, and `undo`.

## Non-Goals

- Do not add `--include`.
- Do not add `--purpose result` in this slice.
- Do not change the no-purpose default.
- Do not use `--resolve` values as section selectors.
- Do not add file caching or generated contract cache files.
- Do not move helper contract authority into docs.
- Do not change SDD language semantics, bundle authority, parser behavior,
  validation behavior, authoring behavior, or result semantics.
- Do not make the future MCP server call `sdd-helper`.

## Public Contract

### CLI

Supported:

```bash
sdd-helper contract helper.command.author --purpose request --resolve bundle
sdd-helper contract helper.command.apply --purpose request
sdd-helper contract helper.command.create --purpose request
sdd-helper contract helper.command.undo --purpose request
```

Compatibility behavior:

- `sdd-helper contract <subject_id>` continues to return the full static
  contract payload.
- `sdd-helper contract <subject_id> --resolve bundle` continues to return the
  full bundle-resolved contract payload.
- `--resolve bundle` keeps its current meaning: resolve bundle-owned references
  against the active bundle.
- Unsupported `--purpose` values return `sdd-helper-error` with code
  `invalid_args`.

### Discovery Metadata

Do not add `request` to the existing `detail_modes` field.

If discovery metadata is needed, add a separate field such as:

```json
{
  "contract_purposes": ["request"]
}
```

This keeps the existing resolution metadata separate from the new caller-purpose
selector.

## Request-Purpose Payload

`--purpose request` is a lossy read over existing shared contract metadata. It
has no independent contract authority.

The payload should include only the fields needed before invoking the selected
command:

- `kind`
- `subject`
- `input_shape`
- `request_body`, when the command uses `--request`
- request-relevant `constraints`
- request-relevant `bindings`
- request-relevant `continuation`
- `resolution`
- `authoring_format_card` for `helper.command.author` when paired with
  `--resolve bundle`

The payload must exclude:

- `output_shape`
- full result schemas
- full assessment schemas
- full diagnostic schemas
- result-only continuation notes
- result-only constraints

If a field does not help compose the next valid request, exclude it.

## Subject Design

### `helper.command.author`

Primary implementation target.

Command:

```bash
sdd-helper contract helper.command.author --purpose request --resolve bundle
```

Include:

- request loading rules for `--request <file-or-stdin>`
- `ApplyAuthoringIntentArgs` as `input_shape`
- request-side constraints for placement, local ids, local-id references, and
  handle revision binding
- bundle-owned request bindings when present and resolved by `--resolve bundle`
- `authoring_format_card` when `--resolve bundle` is supplied

Exclude:

- `sdd-authoring-intent-result` as `output_shape`
- result-side `created_targets` continuation schema
- full assessment and diagnostic result schemas

The returned payload should be small enough for the skill to read routinely
before composing an `author` request.

### `helper.command.apply`

Command:

```bash
sdd-helper contract helper.command.apply --purpose request
```

Include:

- request loading rules for `--request <file-or-stdin>`
- `ApplyChangeSetArgs` as `input_shape`
- low-level operation shape through the input schema
- handle and revision-binding constraints needed to compose a valid change set

Exclude:

- `sdd-change-set` as `output_shape`
- result-side insertion handle continuation schemas
- full assessment and diagnostic result schemas

### `helper.command.create`

Command:

```bash
sdd-helper contract helper.command.create --purpose request
```

Include:

- invocation metadata for `create <document_path> [--version <version>]`
- `CreateDocumentArgs` as `input_shape`
- bootstrap continuation notes needed before the next mutation

Exclude:

- `sdd-create-document` as `output_shape`
- embedded change-set result structure
- full assessment and diagnostic result schemas

`create` does not use `--request`, so absence of `request_body` is expected.

### `helper.command.undo`

Command:

```bash
sdd-helper contract helper.command.undo --purpose request
```

Include:

- request loading rules for `--request <file-or-stdin>`
- `UndoChangeSetArgs` as `input_shape`
- current-revision and change-set eligibility rules needed to compose a valid
  undo request

Exclude:

- undo result `sdd-change-set` as `output_shape`
- result-side assessment and diagnostic schemas

If current-revision or undo-eligibility requirements are not represented well
enough in the existing metadata, add the minimum request-facing constraint or
continuation metadata needed. Do not add a general rule framework for this.

## Shared Code Boundary

The selector should live in the shared contract/authorship code that already
feeds `sdd-helper`. The helper CLI should parse `--purpose request`, load bundle
state only when `--resolve bundle` is present, and delegate to shared contract
selection.

This matters for the future MCP server: the MCP server should be able to reuse
the same shared selection function, but it should not call `sdd-helper`.

The implementation should avoid a second source of truth. Request-purpose output
is derived from the same subject descriptors, shapes, constraints, bindings,
continuation entries, and bundle-derived format card used by the full contract
payload.

## Acceptance Criteria

For `author`:

- `contract helper.command.author --purpose request --resolve bundle` returns
  valid JSON.
- The payload includes `input_shape`, `request_body`, request-side constraints,
  `resolution.mode = "bundle_resolved"`, and `authoring_format_card`.
- The payload does not include `output_shape`.
- The payload does not include the full assessment or diagnostic result schema.
- The payload is materially smaller than
  `contract helper.command.author --resolve bundle`.
- `contract helper.command.author --resolve bundle` without `--purpose` remains
  full and compatible.

For CLI errors:

- `contract helper.command.author --purpose banana` returns `sdd-helper-error`
  with code `invalid_args`.
- Existing invalid `--resolve` behavior remains unchanged.

For `apply`, `create`, and `undo`:

- `--purpose request` excludes `output_shape`.
- Each payload includes the subject-specific request content listed above.
- No subject gains new command semantics as part of this work.

## Rollout

1. Add the shared request-purpose selection for `author`.
2. Add CLI parsing for `--purpose request`.
3. Add focused metadata and CLI tests for `author`.
4. Update the skill to use
   `contract helper.command.author --purpose request --resolve bundle` for
   normal pre-authoring guidance.
5. Extend the same selector to `apply`, `create`, and `undo` if the `author`
   slice satisfies the acceptance criteria without growing a broader framework.

Do not update snapshots, examples, or downstream docs to normalize a larger
payload. The success condition is that the helper returns less irrelevant JSON
for the request-composition path.
