# SDD MCP Server And Helper App Design

Status: working contract for local-first v0.1 SDD MCP and helper-app design

Audience: maintainers and future contributors designing SDD-aware LLM tooling for this repository

This document is the default design authority for future SDD MCP and helper-app discussions unless a later document explicitly supersedes it.

## 1. Purpose And Scope

This repository already has the core semantic pipeline for SDD:

- `.sdd` files are the source of truth for authored design information.
- the bundle in `bundle/v0.1/` is the source of truth for language behavior
- `projectView(...)` and `projectSource(...)` are now public projection services
- author order is semantically consequential for some rendering output

This design defines a local-first v0.1 MCP server and a companion command-line helper app that let LLMs and automation:

- consume SDD documents and bundle metadata
- inspect SDD source structure without raw line editing
- author and edit `.sdd` documents through structured change sets
- render previews through the existing repo rendering pipeline
- undo committed changes recorded by the SDD tooling

This document focuses on design, public contracts, and policy. It does not prescribe implementation sequencing.

### 1.1 In Scope

- file-backed `.sdd` authoring within the current repository
- stdio-first MCP
- bundle-aware read resources
- change-set-based mutation tools
- helper-app commands that share the same domain contracts
- source-sequence-sensitive reordering operations

### 1.2 Out Of Scope

- database-backed source of truth
- multi-user live collaboration
- hosted multi-tenant HTTP service design
- remote auth and SaaS integration
- renderer-stage internals such as `RendererScene`, `MeasuredScene`, or `PositionedScene` as public API
- generic shell execution or generic git execution through MCP
- generalized document collaboration features outside `.sdd` files

## 2. Repo Facts This Design Treats As Ground Truth

The design in this document inherits the following repo-specific facts:

- The public semantic spine is file input -> parse -> compile -> validate -> project -> render.
- Projection is the stable public semantic boundary for downstream consumers.
- Compiled JSON is canonicalized and intentionally does not serialize author-order metadata.
- Author order still matters for rendering:
  - top-level rendered nodes follow top-level declaration order after view filtering
  - sibling structural order follows the source order of structural relationship lines such as `CONTAINS` and `COMPOSED_OF`
  - nested `+` block placement alone does not define structural rendering order
- Preview generation remains an explicit render/preview concern, not part of the edit substrate.

This design therefore treats two things as first-class:

1. projection as the stable read-side semantic contract
2. source structure plus source order as the stable write-side authoring contract

## 3. Design Principles

### 3.1 Local Files Remain Authoritative

`.sdd` files remain the normative authored artifact. The MCP server and helper app exist to expose structured read/write operations over those files, not to replace them with a database.

### 3.2 Shared Domain Core, Two Companion Surfaces

The MCP server and helper app are sibling surfaces over the same shared SDD domain services.

- The MCP server does not shell out to the helper app at runtime.
- The helper app does not define a separate data model.
- Both surfaces use the same inspect model, change-set model, revision model, ordering model, and diagnostic model.

### 3.3 Structured Mutation, Not Raw Text Editing

Writes happen through explicit change-set operations against revision-bound handles. Raw text replacement is not part of the v0.1 contract.

### 3.4 Read Resources, Write Tools

Resources expose structured data for bundle metadata, documents, parse output, compiled graphs, validation, projection, and change-set records. Writes occur only through tools or helper commands.

### 3.5 Determinism Over Cleverness

The design prefers stable output, explicit failure, and reproducible behavior over heuristic convenience:

- ambiguous targets fail
- stale revisions fail
- unsupported reorder semantics fail
- dry runs show the same summary shape as commits
- paths are repo-relative in public contracts

## 4. Public Identifiers And Common Types

### 4.1 Common Identifiers

- `document_path`: repo-relative UTF-8 path ending in `.sdd`
- `document_uri`: `sdd://document/{document_path}`
- `document_revision`: opaque revision token for the document's canonical LF text
- `profile_id`: `simple | permissive | strict`
- `view_id`: current bundle view IDs from `bundle/v0.1/core/views.yaml`
- `change_set_id`: opaque ID for a dry run or committed change set
- `handle`: opaque, revision-bound structural identifier returned by `inspect`

### 4.2 Revision Semantics

`document_revision` is defined over the document's canonical LF text representation.

- read operations normalize document text to LF before computing revision identity
- write operations persist LF text
- handles are valid only for the revision that produced them
- changing document text always creates a new revision token
- `document_revision` is not a git commit, filesystem mtime, or bundle version
- a document that does not yet exist has no revision token
- committed create records therefore use `base_revision: null`

### 4.3 Handle Semantics

Handles are opaque strings. Clients must not construct or parse them.

Handles are revision-bound and are returned only from `inspect`.

The inspect surface returns handles for:

- top-level node blocks
- nested node blocks
- property lines
- edge lines

Within one document revision, repeated `inspect` reads must return the same handle for the same structural element.

A new document revision establishes a new handle namespace even when some structural elements remain textually unchanged.

If a client needs to mutate structure reliably, it should resolve fresh handles from the current revision before building a change set.

### 4.4 Diagnostics

All semantic diagnostics reuse the current repository diagnostic model:

```ts
interface Diagnostic {
  stage: "bundle" | "parse" | "compile" | "validate" | "project" | "render" | "cli";
  code: string;
  severity: "error" | "warn" | "info";
  message: string;
  file: string;
  span?: {
    line: number;
    column: number;
    endLine: number;
    endColumn: number;
    startOffset: number;
    endOffset: number;
  };
  ruleId?: string;
  profileId?: string;
  relatedIds?: string[];
}
```

For this design, control-plane edit failures also surface as diagnostics using `stage: "cli"` with codes such as:

- `sdd.path_out_of_scope`
- `sdd.revision_mismatch`
- `sdd.handle_stale`
- `sdd.ambiguous_target`
- `sdd.unsupported_template`
- `sdd.invalid_reposition_target`

## 5. System Architecture

The SDD MCP server and helper app sit on top of one shared domain core:

```text
User / LLM host / skill
  |
  +-- MCP server (resources, tools, prompts)
  |
  +-- sdd-helper (JSON-first CLI)
          |
          v
    Shared SDD domain services
      - bundle access
      - document loading / LF normalization / revisioning
      - inspect model generation
      - change-set application
      - change journal / undo records
      - parse / compile / validate / project / preview adapters
          |
          v
      Repo files + bundle + existing TypeScript engine
```

### 5.1 Bundle Boundary

The server/helper must read bundle metadata from the existing repo bundle rather than duplicating vocab, syntax, contracts, views, or profiles into a separate schema registry.

### 5.2 Journal Boundary

Undo requires a local change journal. The journal is allowed as a sidecar store, but it is not a new source of truth. The file content remains authoritative; the journal only records change provenance and inverse change sets for committed operations.

For v0.1, journal state lives in a repo-local, gitignored sidecar directory rooted at `.sdd-state/`.

- committed change sets must be durably recorded there
- dry-run change sets may be recorded ephemerally there or kept process-local and may expire
- the internal file layout and storage format remain implementation-defined

### 5.3 Source Trivia And Rewrite Ownership

Comments and blank lines are preserved by the rewrite layer but are not part of the public inspect or change-set contract.

- public `inspect` remains structural and exposes node blocks, property lines, and edge lines only
- reposition operations are defined over structural streams, not raw source line numbers
- the implementation may attach comments and blank lines to nearby structural items internally in order to preserve stable rewrites

## 6. Resource Model

All MCP resources in this design are read-oriented and return structured JSON payloads. No v0.1 resource supports direct mutation.

### 6.1 Canonical Resource URIs

Bundle resources:

- `sdd://bundle/v0.1/manifest`
- `sdd://bundle/v0.1/vocab`
- `sdd://bundle/v0.1/syntax`
- `sdd://bundle/v0.1/contracts`
- `sdd://bundle/v0.1/views`
- `sdd://bundle/v0.1/profiles/{profile_id}`

Document resources:

- `sdd://document/{document_path}`
- `sdd://document/{document_path}/inspect`
- `sdd://document/{document_path}/parse`
- `sdd://document/{document_path}/compiled`
- `sdd://document/{document_path}/validation?profile={profile_id}`
- `sdd://document/{document_path}/projection?view={view_id}`

Change-set resource:

- `sdd://change-set/{change_set_id}`

### 6.2 Resource Templates

The server should expose resource templates for:

- document path parameterization
- validation profile parameterization
- projection view parameterization

The server should not attempt to list every possible parameterized resource instance up front.

### 6.3 Resource Payloads

#### 6.3.1 `sdd://document/{document_path}`

Purpose: retrieve canonical LF text plus lightweight metadata for a single `.sdd` file.

```ts
interface DocumentResource {
  kind: "sdd-document";
  uri: string;
  path: string;
  revision: string;
  declared_version: string | null;
  effective_version: string;
  text: string;
  metadata: {
    top_level_block_count: number | null;
  };
  diagnostics: Diagnostic[];
}
```

Notes:

- `text` is LF-normalized
- `diagnostics` are parse diagnostics only
- if the document is not parseable, this resource still returns `text` and diagnostics

#### 6.3.2 `sdd://document/{document_path}/inspect`

Purpose: retrieve the editable source-structure model used for structured authoring.

This resource is parse-backed, not compile-backed. It is available for any parseable `.sdd` file, including files that do not compile or validate cleanly.

```ts
interface InspectNodeBlock {
  handle: string;
  node_type: string;
  node_id: string;
  name: string;
  parent_handle: string | null;
  body_stream: string[];
  structural_order_streams: Partial<Record<"CONTAINS" | "COMPOSED_OF", string[]>>;
}

interface InspectBodyItem {
  handle: string;
  kind: "property_line" | "edge_line" | "node_block";
  parent_handle: string;
  order_index: number;
  property?: {
    key: string;
    value_kind: "quoted_string" | "bare_value";
    raw_value: string;
  };
  edge?: {
    rel_type: string;
    to: string;
    to_name: string | null;
    event: string | null;
    guard: string | null;
    effect: string | null;
    props: Record<string, string>;
    structural_order_index: number | null;
  };
}

interface InspectResource {
  kind: "sdd-document-inspect";
  uri: string;
  path: string;
  revision: string;
  effective_version: string;
  top_level_order: string[];
  nodes: InspectNodeBlock[];
  body_items: InspectBodyItem[];
  diagnostics: Diagnostic[];
}
```

Inspect guarantees:

- `top_level_order` preserves top-level declaration order
- `body_stream` preserves the literal body order within a node block
- `structural_order_streams.CONTAINS` and `.COMPOSED_OF` preserve semantically consequential structural order
- nested node blocks appear in `body_stream`, but their position is organizational unless paired with structural-edge ordering changes

#### 6.3.3 `sdd://document/{document_path}/parse`

Purpose: expose the parse document and parse diagnostics.

```ts
interface ParseResource {
  kind: "sdd-parse";
  uri: string;
  path: string;
  revision: string;
  document?: unknown;
  diagnostics: Diagnostic[];
}
```

The `document` field uses the current public parse-document shape.

#### 6.3.4 `sdd://document/{document_path}/compiled`

Purpose: expose the compiled graph and compile diagnostics.

```ts
interface CompiledResource {
  kind: "sdd-compiled";
  uri: string;
  path: string;
  revision: string;
  graph?: unknown;
  diagnostics: Diagnostic[];
}
```

If compilation fails, `graph` is omitted and diagnostics explain why.

#### 6.3.5 `sdd://document/{document_path}/validation?profile={profile_id}`

Purpose: expose validation output for a chosen profile.

```ts
interface ValidationResource {
  kind: "sdd-validation";
  uri: string;
  path: string;
  revision: string;
  profile_id: "simple" | "permissive" | "strict";
  report?: {
    error_count: number;
    warning_count: number;
  };
  diagnostics: Diagnostic[];
}
```

If compilation fails, `report` is omitted and diagnostics include compile errors.

#### 6.3.6 `sdd://document/{document_path}/projection?view={view_id}`

Purpose: expose the stable public projection for a chosen view.

```ts
interface ProjectionResource {
  kind: "sdd-projection";
  uri: string;
  path: string;
  revision: string;
  view_id: string;
  projection?: unknown;
  diagnostics: Diagnostic[];
}
```

The `projection` field uses the current public projection shape exported by the package root.

#### 6.3.7 `sdd://change-set/{change_set_id}`

Purpose: retrieve the record for a previously created dry-run or committed change set.

```ts
interface ChangeSetResource {
  kind: "sdd-change-set";
  change_set_id: string;
  path: string;
  origin: "apply_change_set" | "undo_change_set" | "create_document";
  document_effect: "created" | "updated" | "deleted";
  base_revision: string | null;
  resulting_revision?: string;
  mode: "dry_run" | "commit";
  status: "applied" | "rejected";
  undo_eligible: boolean;
  operations: ChangeOperation[];
  summary: ChangeSetSummary;
  diagnostics: Diagnostic[];
}
```

Retention policy:

- committed change sets must be journaled and addressable
- dry-run change sets may be session-local and may expire
- `undo_change_set` is defined only for committed change sets with `undo_eligible: true`

## 7. Change-Set Contract

The change-set contract is the single normative write model shared by MCP tools and the helper app.

### 7.1 Change Set Envelope

```ts
type PlacementMode = "before" | "after" | "first" | "last";
type PlacementStream = "top_level" | "body";

interface Placement {
  mode: PlacementMode;
  stream: PlacementStream;
  anchor_handle?: string;
  parent_handle?: string;
}

interface ChangeSetSummary {
  node_insertions: Array<{ handle?: string; node_id: string; node_type: string }>;
  node_deletions: Array<{ handle: string; node_id?: string }>;
  node_renames: Array<{ handle: string; from: string; to: string }>;
  property_changes: Array<{ node_handle: string; key: string; from?: string; to?: string }>;
  edge_insertions: Array<{ handle?: string; parent_handle: string; rel_type: string; to: string }>;
  edge_deletions: Array<{ handle: string; parent_handle: string; rel_type: string; to: string }>;
  ordering_changes: Array<{
    kind: "top_level_node" | "structural_edge" | "nested_node_block";
    target_handle: string;
    parent_handle?: string;
    old_index: number;
    new_index: number;
  }>;
}

interface ChangeSetResult {
  kind: "sdd-change-set";
  change_set_id: string;
  path: string;
  origin: "apply_change_set" | "undo_change_set" | "create_document";
  document_effect: "created" | "updated" | "deleted";
  base_revision: string | null;
  resulting_revision?: string;
  mode: "dry_run" | "commit";
  status: "applied" | "rejected";
  undo_eligible: boolean;
  operations: ChangeOperation[];
  summary: ChangeSetSummary;
  diagnostics: Diagnostic[];
  projection_results?: Array<{
    view_id: string;
    projection?: unknown;
    diagnostics: Diagnostic[];
  }>;
}
```

### 7.2 Mutation Rules

- Operations are applied in array order.
- The entire change set targets exactly one document.
- All operations resolve against `base_revision`.
- If any operation is rejected, the whole change set is rejected.
- `status: "rejected"` returns structured diagnostics and no `resulting_revision`.
- `mode: "dry_run"` never writes the document.
- `mode: "commit"` writes the document, records a committed change-set record, and returns `resulting_revision`.
- If `projection_views` is supplied, the result also includes per-view projection results derived from the post-change text.
- `apply_change_set` returns `document_effect: "updated"`.
- `create_document` returns `origin: "create_document"`, `document_effect: "created"`, and `base_revision: null`.
- `undo_change_set` may return `document_effect: "updated"` or `document_effect: "deleted"`.
- committed `document_effect: "deleted"` results omit `resulting_revision`.

### 7.3 Validation Rules

`apply_change_set` and `undo_change_set` always return parse and compile diagnostics.

If `validate_profile` is provided, the result also includes validation diagnostics for that profile.

Omitting `validate_profile` does not disable diagnostics; it only skips profile validation.

## 8. Mutation Operations

The v0.1 operation set is intentionally small and explicit.

```ts
type ChangeOperation =
  | InsertNodeBlockOp
  | DeleteNodeBlockOp
  | SetNodeNameOp
  | SetNodePropertyOp
  | RemoveNodePropertyOp
  | InsertEdgeLineOp
  | RemoveEdgeLineOp
  | RepositionTopLevelNodeOp
  | RepositionStructuralEdgeOp
  | MoveNestedNodeBlockOp;
```

### 8.1 `insert_node_block`

Insert a new empty node block at top level or into a parent body stream.

```ts
interface InsertNodeBlockOp {
  kind: "insert_node_block";
  node_type: string;
  node_id: string;
  name: string;
  placement: Placement;
}
```

Rules:

- `placement.stream = "top_level"` inserts a top-level block and must not include `parent_handle`
- `placement.stream = "body"` inserts a nested `+` block and must include `parent_handle`
- the new block is created with no properties, no edges, and no nested blocks

### 8.2 `delete_node_block`

Delete a node block and its body content.

```ts
interface DeleteNodeBlockOp {
  kind: "delete_node_block";
  node_handle: string;
}
```

Rules:

- deleting a node block may leave dangling references; diagnostics must report the resulting issues

### 8.3 `set_node_name`

Rename a node block header.

```ts
interface SetNodeNameOp {
  kind: "set_node_name";
  node_handle: string;
  name: string;
}
```

### 8.4 `set_node_property`

Insert or replace a property line on a node block.

```ts
interface SetNodePropertyOp {
  kind: "set_node_property";
  node_handle: string;
  key: string;
  value_kind: "quoted_string" | "bare_value";
  raw_value: string;
}
```

Rules:

- if the property already exists, its value is replaced in place
- if the property does not exist, a new property line is appended after the last existing property line in that node body
- if multiple properties with the same key already exist on the target node, the operation is rejected as ambiguous

### 8.5 `remove_node_property`

Remove a property line by key.

```ts
interface RemoveNodePropertyOp {
  kind: "remove_node_property";
  node_handle: string;
  key: string;
}
```

Rules:

- if multiple identical keys exist, the operation is rejected as ambiguous

### 8.6 `insert_edge_line`

Insert a new edge line into a node body stream.

```ts
interface InsertEdgeLineOp {
  kind: "insert_edge_line";
  parent_handle: string;
  rel_type: string;
  to: string;
  to_name?: string | null;
  event?: string | null;
  guard?: string | null;
  effect?: string | null;
  props?: Record<string, string>;
  placement?: Placement;
}
```

Rules:

- `placement.stream` must be `"body"`
- `placement.parent_handle` must match `parent_handle` when provided
- if `placement` is omitted, the edge line is appended after the last existing edge line in the parent body

### 8.7 `remove_edge_line`

Remove an existing edge line.

```ts
interface RemoveEdgeLineOp {
  kind: "remove_edge_line";
  edge_handle: string;
}
```

### 8.8 `reposition_top_level_node`

Move a top-level node block within the top-level declaration stream.

```ts
interface RepositionTopLevelNodeOp {
  kind: "reposition_top_level_node";
  node_handle: string;
  placement: Placement;
}
```

Rules:

- `placement.stream` must be `"top_level"`
- `placement.parent_handle` must be omitted
- `placement.anchor_handle` is required for `before` and `after`

### 8.9 `reposition_structural_edge`

Move a structural edge line within a parent node's body stream.

```ts
interface RepositionStructuralEdgeOp {
  kind: "reposition_structural_edge";
  edge_handle: string;
  placement: Placement;
}
```

Rules:

- only `CONTAINS` and `COMPOSED_OF` edge handles are valid targets
- `placement.stream` must be `"body"`
- `placement.parent_handle` is required
- the target edge must already belong to that parent body stream

This operation is semantically consequential because the source order of structural relationship lines affects structural rendering order.

### 8.10 `move_nested_node_block`

Move a nested `+` node block within a parent node's body stream.

```ts
interface MoveNestedNodeBlockOp {
  kind: "move_nested_node_block";
  node_handle: string;
  placement: Placement;
}
```

Rules:

- `placement.stream` must be `"body"`
- `placement.parent_handle` is required
- this operation reorders source organization only
- it does not by itself change structural rendering order
- if the user wants structural rendering order to change, they must also reposition the relevant structural edge lines

### 8.11 Placement Rules

For all reposition operations:

- `placement.mode`: `before | after | first | last`
- `placement.anchor_handle` is required for `before | after`
- `placement.parent_handle` is required for `reposition_structural_edge` and `move_nested_node_block`
- `placement.stream`: `top_level | body`

All ambiguous placements fail. The system never guesses.

## 9. Tool Model

### 9.1 `sdd.list_documents`

Purpose: list repo-local `.sdd` documents.

Arguments:

```ts
interface ListDocumentsArgs {
  under?: string;
  limit?: number;
}
```

Result:

```ts
interface ListDocumentsResult {
  kind: "sdd-document-list";
  documents: Array<{
    path: string;
    uri: string;
    revision: string;
    effective_version: string;
    top_level_block_count: number;
  }>;
  diagnostics: Diagnostic[];
}
```

Rules:

- results are sorted by `path` ascending
- `under` is a repo-relative directory prefix
- only `.sdd` files are returned

### 9.2 `sdd.search_graph`

Purpose: search compile-valid graph content across repo-local `.sdd` files.

Arguments:

```ts
interface SearchGraphArgs {
  query?: string;
  node_type?: string;
  node_id?: string;
  under?: string;
  limit?: number;
}
```

Result:

```ts
interface SearchGraphResult {
  kind: "sdd-search-results";
  matches: Array<{
    path: string;
    uri: string;
    revision: string;
    node_id: string;
    node_type: string;
    name: string;
    matched_on: Array<"query" | "node_type" | "node_id">;
  }>;
  diagnostics: Diagnostic[];
}
```

Rules:

- at least one of `query`, `node_type`, or `node_id` must be provided
- only compile-valid documents participate in search
- compile-invalid documents are skipped rather than partially searched
- results are sorted by `path` ascending, then `node_id` ascending

### 9.3 `sdd.create_document`

Purpose: create a new `.sdd` document and commit it immediately.

Arguments:

```ts
interface CreateDocumentArgs {
  path: string;
  template_id: string;
  version?: "0.1";
}
```

Result:

```ts
interface CreateDocumentResult {
  kind: "sdd-create-document";
  path: string;
  uri: string;
  revision: string;
  change_set: ChangeSetResult;
}
```

Rules:

- v0.1 requires support for `template_id = "empty"`
- `empty` produces a zero-body skeleton with `SDD-TEXT 0.1` followed by a trailing newline
- additional template IDs are allowed but are not part of the v0.1 working contract
- create fails if the target path already exists
- successful create records a committed change-set record in the same journal used by other committed mutations
- that record uses `origin: "create_document"`, `document_effect: "created"`, `base_revision: null`, and `undo_eligible: true`
- undo of a create record is defined as deleting the created file, subject to the normal undo revision precondition

### 9.4 `sdd.apply_change_set`

Purpose: apply a structured edit to one document.

Arguments:

```ts
interface ApplyChangeSetArgs {
  path: string;
  base_revision: string;
  mode?: "dry_run" | "commit";
  operations: ChangeOperation[];
  validate_profile?: "simple" | "permissive" | "strict";
  projection_views?: string[];
}
```

Result:

- `ChangeSetResult`

Rules:

- default `mode` is `"dry_run"`
- `projection_views` is optional and, when supplied, returns post-change projection results for the requested views
- stale `base_revision` rejects the entire change set

### 9.5 `sdd.undo_change_set`

Purpose: dry-run or commit the inverse of a previously committed change set.

Arguments:

```ts
interface UndoChangeSetArgs {
  change_set_id: string;
  mode?: "dry_run" | "commit";
  validate_profile?: "simple" | "permissive" | "strict";
}
```

Result:

- `ChangeSetResult`

Rules:

- only committed, undo-eligible change sets can be undone
- default `mode` is `"dry_run"`
- committed undo requires the current document revision to exactly match the target change set's `resulting_revision`
- if the target record has `document_effect: "created"`, committed undo deletes the file and returns `document_effect: "deleted"` with no `resulting_revision`
- otherwise committed undo returns `document_effect: "updated"`

### 9.6 `sdd.render_preview`

Purpose: produce preview output through the existing render/preview pipeline.

Arguments:

```ts
interface RenderPreviewArgs {
  path: string;
  view_id: string;
  profile_id: "simple" | "permissive" | "strict";
  format: "svg" | "png";
  backend_id?:
    | "legacy_graphviz_preview"
    | "staged_ia_place_map_preview"
    | "staged_ui_contracts_preview"
    | "staged_service_blueprint_preview";
}
```

Result:

```ts
interface RenderPreviewResult {
  kind: "sdd-preview";
  path: string;
  revision: string;
  view_id: string;
  profile_id: "simple" | "permissive" | "strict";
  backend_id: string;
  artifact:
    | {
        format: "svg";
        mime_type: "image/svg+xml";
        text: string;
      }
    | {
        format: "png";
        mime_type: "image/png";
        base64: string;
      };
  notes: string[];
  diagnostics: Diagnostic[];
}
```

Default backend resolution:

- `ia_place_map` -> `staged_ia_place_map_preview`
- `ui_contracts` -> `staged_ui_contracts_preview`
- `service_blueprint` -> `staged_service_blueprint_preview`
- `journey_map` -> `legacy_graphviz_preview`
- `outcome_opportunity_map` -> `legacy_graphviz_preview`
- `scenario_flow` -> `legacy_graphviz_preview`

Rules:

- incompatible `backend_id` and `view_id` combinations fail
- preview is a tool output, not a persistent resource

## 10. Prompt Model

Prompts are assistive only. They do not mutate documents directly.

Each prompt should accept structured arguments and produce MCP prompt messages that steer the model toward the concrete resources and tools in this document.

### 10.1 `sdd.author_new_document`

Arguments:

```ts
interface AuthorNewDocumentPromptArgs {
  target_path: string;
  goal: string;
  template_id?: string;
  validate_profile?: "simple" | "permissive" | "strict";
  projection_views?: string[];
}
```

Intent:

- create a new SDD document from scratch
- instruct the model to use `sdd.create_document`, `sdd.apply_change_set`, and optional projection reads

### 10.2 `sdd.extend_document`

Arguments:

```ts
interface ExtendDocumentPromptArgs {
  document_uri: string;
  revision: string;
  goal: string;
  validate_profile?: "simple" | "permissive" | "strict";
  projection_views?: string[];
}
```

Intent:

- extend an existing document using `inspect`, `apply_change_set`, and optional projection feedback

### 10.3 `sdd.repair_document`

Arguments:

```ts
interface RepairDocumentPromptArgs {
  document_uri: string;
  revision: string;
  validate_profile?: "simple" | "permissive" | "strict";
  focus?: "parse" | "compile" | "validate" | "projection";
}
```

Intent:

- center diagnostics
- instruct the model to inspect structure, draft a dry-run change set, review diagnostics, then commit if acceptable

### 10.4 `sdd.explain_projection`

Arguments:

```ts
interface ExplainProjectionPromptArgs {
  document_uri: string;
  revision: string;
  view_id: string;
  audience?: "author" | "engineer" | "agent";
}
```

Intent:

- explain the public projection surface and its semantics
- explicitly avoid renderer-stage internal contracts

## 11. Helper App Design

The helper app is a first-class companion surface for automation and skills.

Binary name:

- `sdd-helper`

Design goals:

- JSON-first by default
- repo-local and `.sdd`-focused
- shares the exact domain contracts defined above
- safe to use from skills and other automation without raw file editing

### 11.1 Command Set

- `sdd-helper inspect`
- `sdd-helper search`
- `sdd-helper create`
- `sdd-helper apply`
- `sdd-helper undo`
- `sdd-helper preview`
- `sdd-helper git-status`
- `sdd-helper git-commit`

### 11.2 Command Contracts

#### 11.2.1 JSON I/O Conventions

```ts
interface HelperErrorResult {
  kind: "sdd-helper-error";
  code: "invalid_args" | "invalid_json" | "runtime_error";
  message: string;
}
```

Rules:

- `sdd-helper` writes exactly one JSON payload to stdout for every successfully interpreted command
- domain-level rejections are represented in that payload and do not switch the helper into an unstructured error mode
- malformed arguments, malformed JSON request bodies, and unexpected runtime failures return `HelperErrorResult`
- `HelperErrorResult` writes to stdout and exits non-zero
- stderr is reserved for optional crash/debug output and is not part of the public contract

#### `sdd-helper inspect <document_path>`

Returns the same payload as the MCP `inspect` resource.

#### `sdd-helper search`

Accepts the same filters as `sdd.search_graph` and returns the same payload shape.

#### `sdd-helper create <document_path> --template <template_id> [--version 0.1]`

Returns the same logical result as `sdd.create_document`.

#### `sdd-helper apply --request <file-or-stdin>`

Input:

- JSON request body matching `ApplyChangeSetArgs`

Output:

- `ChangeSetResult`

#### `sdd-helper undo --request <file-or-stdin>`

Input:

- JSON request body matching `UndoChangeSetArgs`

Output:

- `ChangeSetResult`

#### `sdd-helper preview <document_path> --view <view_id> --profile <profile_id> --format <svg|png> [--backend <backend_id>]`

Returns the same logical result as `sdd.render_preview`.

#### `sdd-helper git-status [<document_path> ...]`

Purpose:

- narrow, `.sdd`-oriented repository status inspection for automation

Result:

```ts
interface HelperGitStatusResult {
  kind: "sdd-git-status";
  paths: string[];
  status: Array<{
    path: string;
    index_status: string;
    worktree_status: string;
  }>;
}
```

Rules:

- it reports repository status for the supplied `.sdd` paths or all `.sdd` files when no paths are supplied
- it does not expose arbitrary git plumbing

#### `sdd-helper git-commit --message <message> [<document_path> ...]`

Purpose:

- narrow, explicit git commit support for `.sdd` work created through the helper

Result:

```ts
interface HelperGitCommitResult {
  kind: "sdd-git-commit";
  committed_paths: string[];
  commit_sha: string;
}
```

Rules:

- only explicit `.sdd` paths are eligible for staging/commit
- non-`.sdd` files are out of scope for this helper contract

### 11.3 Skill Use

A Codex skill can target the helper app directly without MCP.

That is intentional. The helper app is a usable automation surface on its own, while the MCP server exists to provide the same domain capabilities through MCP-native resources, tools, and prompts.

## 12. Ordering And Repositioning Semantics

Source sequence is not cosmetic in this repository. The design therefore distinguishes three different order concepts that future work must not conflate.

### 12.1 Top-Level Declaration Order

This is the order of top-level node blocks in source. It affects top-level rendered node order after view filtering.

Mutation:

- `reposition_top_level_node`

Inspect exposure:

- `top_level_order`

### 12.2 Structural Edge Order

This is the order of hierarchy-relevant relationship lines in a parent body stream.

For v0.1, the public structurally consequential relationship types are:

- `CONTAINS`
- `COMPOSED_OF`

This order affects structural rendering order for children.

Mutation:

- `reposition_structural_edge`

Inspect exposure:

- `structural_order_streams.CONTAINS`
- `structural_order_streams.COMPOSED_OF`

### 12.3 Nested Block Placement

This is the source location of nested `+` blocks in a parent body stream.

This order is organizational. It does not by itself control structural rendering order.

Mutation:

- `move_nested_node_block`

Inspect exposure:

- `body_stream`

Rule:

- if a user wants rendered child order to change, they must reposition the structural relationship lines, not only the nested block bodies

## 13. Policy

### 13.1 Workspace And Path Scope

- the MCP server and helper app operate within one configured repo root
- all public paths are repo-relative
- reads are limited to repo-local bundle and `.sdd` content required by these contracts
- writes are limited to `.sdd` files

### 13.2 Concurrency

- committed mutations require exact `base_revision` match
- stale revisions reject the entire change set
- stale handles reject the entire change set

### 13.3 Ambiguity

- ambiguous mutation targets reject
- ambiguous removals reject
- ambiguous reposition anchors reject
- the system never picks an arbitrary match

### 13.4 Undo

- undo is guaranteed only for committed change sets recorded by the SDD change journal
- undo is not defined for ad hoc external edits that bypass the journal
- dry-run change sets are never undo-eligible
- committed undo is defined only when the current document revision exactly matches the target change set's `resulting_revision`

### 13.5 Determinism

- public results use repo-relative paths
- diagnostics are sorted deterministically
- list and search results are deterministically ordered
- change-set summaries report ordering changes explicitly
- public contracts do not expose unstable renderer-internal forms

### 13.6 Preview

- preview remains a deliberate tool/helper action
- preview output is derived from the existing render pipeline and current preview backends
- preview data is not part of the core inspect/change-set substrate

## 14. Canonical Examples

The examples below are normative examples of the public contract shape. They are intentionally small.

### 14.1 Read: Inspect A Document

Resource:

- `sdd://document/bundle/v0.1/examples/outcome_to_ia_trace.sdd/inspect`

Example payload excerpt:

```json
{
  "kind": "sdd-document-inspect",
  "path": "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
  "revision": "rev_01H...",
  "effective_version": "0.1",
  "top_level_order": ["hdl_1", "hdl_2", "hdl_3"],
  "nodes": [
    {
      "handle": "hdl_1",
      "node_type": "Outcome",
      "node_id": "O-001",
      "name": "Reduce Abandonment",
      "parent_handle": null,
      "body_stream": ["hdl_1_p1", "hdl_1_p2", "hdl_1_e1"],
      "structural_order_streams": {}
    }
  ],
  "body_items": [
    {
      "handle": "hdl_1_e1",
      "kind": "edge_line",
      "parent_handle": "hdl_1",
      "order_index": 2,
      "edge": {
        "rel_type": "MEASURED_BY",
        "to": "M-001",
        "to_name": "Checkout Completion Rate",
        "event": null,
        "guard": null,
        "effect": null,
        "props": {},
        "structural_order_index": null
      }
    }
  ],
  "diagnostics": []
}
```

### 14.2 Dry Run: Add A Property

Tool call:

```json
{
  "path": "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
  "base_revision": "rev_01H...",
  "mode": "dry_run",
  "operations": [
    {
      "kind": "set_node_property",
      "node_handle": "hdl_1",
      "key": "priority",
      "value_kind": "bare_value",
      "raw_value": "high"
    }
  ],
  "validate_profile": "strict"
}
```

Result excerpt:

```json
{
  "kind": "sdd-change-set",
  "origin": "apply_change_set",
  "document_effect": "updated",
  "mode": "dry_run",
  "status": "applied",
  "undo_eligible": false,
  "summary": {
    "node_insertions": [],
    "node_deletions": [],
    "node_renames": [],
    "property_changes": [
      {
        "node_handle": "hdl_1",
        "key": "priority",
        "to": "high"
      }
    ],
    "edge_insertions": [],
    "edge_deletions": [],
    "ordering_changes": []
  },
  "diagnostics": []
}
```

### 14.3 Commit: Add A Property

The same request with `"mode": "commit"` returns:

```json
{
  "kind": "sdd-change-set",
  "change_set_id": "chg_01H...",
  "path": "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
  "origin": "apply_change_set",
  "document_effect": "updated",
  "base_revision": "rev_01H...",
  "resulting_revision": "rev_01J...",
  "mode": "commit",
  "status": "applied",
  "undo_eligible": true,
  "summary": {
    "node_insertions": [],
    "node_deletions": [],
    "node_renames": [],
    "property_changes": [
      {
        "node_handle": "hdl_1",
        "key": "priority",
        "to": "high"
      }
    ],
    "edge_insertions": [],
    "edge_deletions": [],
    "ordering_changes": []
  },
  "diagnostics": []
}
```

### 14.4 Node Reorder: Reposition A Top-Level Node

```json
{
  "path": "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
  "base_revision": "rev_01H...",
  "mode": "dry_run",
  "operations": [
    {
      "kind": "reposition_top_level_node",
      "node_handle": "hdl_P_002",
      "placement": {
        "mode": "before",
        "stream": "top_level",
        "anchor_handle": "hdl_A_001"
      }
    }
  ]
}
```

Dry-run summary excerpt:

```json
{
  "summary": {
    "ordering_changes": [
      {
        "kind": "top_level_node",
        "target_handle": "hdl_P_002",
        "old_index": 10,
        "new_index": 7
      }
    ]
  }
}
```

### 14.5 Structural Reorder: Reposition A `CONTAINS` Edge

```json
{
  "path": "docs/readme_support_docs/small_app_example/small_app.sdd",
  "base_revision": "rev_01H...",
  "mode": "dry_run",
  "operations": [
    {
      "kind": "reposition_structural_edge",
      "edge_handle": "hdl_P100_contains_C900",
      "placement": {
        "mode": "first",
        "stream": "body",
        "parent_handle": "hdl_P100"
      }
    }
  ]
}
```

This changes the structural child ordering stream for that parent. It is semantically meaningful for rendering.

### 14.6 Undo: Invert A Prior Commit

```json
{
  "change_set_id": "chg_01H...",
  "mode": "dry_run",
  "validate_profile": "strict"
}
```

Result excerpt:

```json
{
  "kind": "sdd-change-set",
  "origin": "undo_change_set",
  "document_effect": "updated",
  "mode": "dry_run",
  "status": "applied",
  "undo_eligible": false,
  "diagnostics": []
}
```

### 14.7 Helper Example: Apply A Change Set

Shell usage:

```bash
cat change-set.json | sdd-helper apply --request -
```

Where `change-set.json` contains exactly the `ApplyChangeSetArgs` payload used by MCP.

### 14.8 Preview Example

```json
{
  "path": "bundle/v0.1/examples/place_viewstate_transition.sdd",
  "view_id": "ui_contracts",
  "profile_id": "strict",
  "format": "svg"
}
```

Result excerpt:

```json
{
  "kind": "sdd-preview",
  "view_id": "ui_contracts",
  "backend_id": "staged_ui_contracts_preview",
  "artifact": {
    "format": "svg",
    "mime_type": "image/svg+xml",
    "text": "<svg ..."
  },
  "notes": [],
  "diagnostics": []
}
```

## 15. Final Design Position

The v0.1 SDD MCP server is a local-first MCP surface over the existing repo and bundle. Its read-side public semantic contract is projection. Its write-side public authoring contract is a revision-bound, handle-based change-set model grounded in source structure and source order.

The helper app is a companion surface over that same model, not a separate system and not a runtime dependency of the MCP server.

This design is intentionally strong where the repo already has strong semantics:

- projection is public and stable
- author order matters
- `.sdd` files are the source of truth
- preview is explicit
- structured edits are safer than raw text edits

This design is intentionally narrow where the repo does not need platform complexity:

- no database-first source of truth
- no generic remote platform design
- no generic shell or git exposure through MCP
- no renderer-stage internals as public API

That is the working contract for future SDD MCP and helper-app design in this repository.

## Appendix A. MCP Runtime Notes

This appendix defines the MCP runtime stance for the v0.1 local-first design and complements the domain contracts already defined above.

### A.1 Runtime Profile

This design is a local-context MCP server in the sense described by the generic MCP primer: it exposes repo-local files, bundle metadata, and domain behaviors to a host over MCP.

The server is a protocol adapter over shared SDD domain services, not the domain system itself.

The preferred transport for v0.1 is `stdio`.

Streamable HTTP is out of scope for the v0.1 working contract. That omission is a scoping choice for this design, not a permanent architectural prohibition.

### A.2 Lifecycle And Session Semantics

The server follows normal MCP session lifecycle:

- `initialize`
- `operation`
- `shutdown`

The server must not process normal capability calls before successful initialization.

Capability advertisement happens during initialization and defines the effective runtime surface for the session.

This design does not require session-persistent edit state beyond the revision and handle semantics already defined in the main document.

### A.3 Capability Advertisement And Discovery

The server advertises tools, resources and resource templates, and prompts as first-class MCP capabilities.

Resource templates are preferred over pre-enumerating all document-derived URIs.

The v0.1 design expects normal MCP discovery flows:

- tools can be listed and called
- resources can be listed and read
- prompts can be listed and materialized

Capability metadata must stay crisp, narrow, and schema-backed, matching the contracts defined in the main body of this document.

### A.4 Explicitly Unsupported Or Deferred MCP Features

The following are not part of the v0.1 working contract:

- resource subscriptions or change notifications
- prompts or tools that bypass the structured change-set model
- remote HTTP transport design
- multi-session collaborative locking
- background tasks or long-running job orchestration

Omission from v0.1 means "not designed here", not "architecturally impossible".

### A.5 Safety And Host Interaction Notes

The runtime posture inherits the least-privilege path scope, revision checks, handle checks, ambiguity rejection, and structured mutation rules defined in the main document.

Mutating tools are designed for host-mediated authorization or confirmation where the host supports that interaction model.

The server treats model-generated arguments as untrusted input and validates them against tool schemas plus repository and domain policy.

Read-only and mutating capabilities remain clearly separated.

### A.6 Observability And Error Mapping

The runtime should provide structured logs for:

- tool calls
- resource reads
- rejected mutations
- undo attempts

Runtime and protocol failures should be mapped cleanly into MCP errors.

Domain failures should use the structured diagnostic model already defined in the main body of this document.

Support for MCP Inspector or equivalent debugging tooling is expected during development, but this appendix does not define implementation tooling choices.

### A.7 Relationship To The Main Design

The main body of this document remains the authority for SDD-specific schemas, URIs, tools, prompts, helper commands, and mutation semantics.

This appendix only supplies the MCP runtime posture needed to align that domain design with the generic MCP architecture described in the primer.

## Appendix B. Helper-App Execution Plan

Implementation sequencing for the helper-first build is maintained in `docs/helper_app_execution_plan.md`.

That companion document is subordinate to this design. It may refine implementation order, internal module boundaries, and checkpoint structure, but it must not redefine the public contracts, identifier semantics, helper I/O rules, or undo policy established in the main body of this document.
