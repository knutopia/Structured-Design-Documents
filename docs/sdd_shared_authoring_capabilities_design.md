# Shared Authoring Capabilities Design

Status: active near-future design for leveling up shared SDD authoring capabilities

Audience: maintainers extending the shared authoring core, `sdd-helper`, `sdd-skill`, and the future MCP server

Purpose: define a small, implementation-ready capability lift for SDD authoring that reduces current workflow friction without changing the repository's source-of-truth model or creating helper-only semantics

Authority:

- This document complements and proposes additive revisions to [future_explorations/mcp_server/sdd_mcp_server_design.md](./future_explorations/mcp_server/sdd_mcp_server_design.md).
- It is not a replacement authority for existing v0.1 behavior.
- Until the referenced MCP/helper design is revised and implemented, the current v0.1 contracts remain authoritative.

## 1. Summary

The current shared authoring substrate is safe, deterministic, and structurally correct, but common authoring work is still too low-level for efficient LLM-driven use.

This design introduces four additive capabilities:

1. a shared authoring-intent layer for common multi-step authoring work
2. explicit post-mutation handle discovery so follow-on edits do not always require another `inspect`
3. first-class helper reads for validation and projection
4. selector-based targeting for high-level authoring intents only

These changes are intentionally narrow. They do not introduce template expansion, starter packs, preview transport changes, raw text editing, or generalized session-state workflows.

## 2. Observed Authoring Friction

Current helper-first authoring has four recurring inefficiencies:

- Common authoring slices require too many primitive `ChangeOperation`s. Even a small place or component often needs a sequence of `insert_node_block`, repeated `set_node_property`, optional `insert_edge_line`, and later nested-block insertions.
- Follow-on edits often require a second `inspect` pass only to recover handles for nodes and edges that were just created by a successful dry run or commit.
- Validation and projection reads exist semantically in the shared domain model, but the helper does not expose them as first-class reads. The skill therefore has to overload `apply(... validate_profile/projection_views ...)` for both mutation and feedback.
- Handle-only targeting is correct at the low level, but it is awkward as the only author-facing targeting model. For common authoring work, an exact `node_id` reference is often the more natural input.

None of these problems justify replacing the low-level change-set contract. They justify adding a higher-level shared authoring layer that compiles into that contract.

## 3. Non-Negotiable Constraints

The following constraints remain locked:

- `.sdd` files remain the authoritative authored artifact.
- Projection remains the stable public read-side semantic contract.
- Low-level writes remain revision-bound, handle-based change sets.
- Raw text editing does not become a public authoring API.
- New capabilities must be implemented in the shared domain core first and then surfaced consistently through `sdd-helper` and MCP.
- All additions must be backward-compatible with the current `create_document`, `apply_change_set`, `undo_change_set`, `inspect`, validation, projection, and preview contracts.
- Deterministic rejection remains preferred over heuristic convenience.

## 4. Capability Design

### 4.1 Compound Structured Authoring Intents

Plain-language subtitle: Create common node structures in one request

#### Intent

Add a shared authoring-intent layer above `ChangeOperation[]` for common authoring work that is currently expressed as a long sequence of primitive operations.

The initial scope is intentionally narrow:

- one new shared entrypoint: `applyAuthoringIntent(...)`
- one initial intent kind: `insert_node_scaffold`

The low-level change-set contract remains normative. Authoring intents are a compilation layer, not a second mutation engine.

#### Proposed shared types

```ts
interface ApplyAuthoringIntentArgs {
  path: DocumentPath;
  base_revision: DocumentRevision;
  mode?: ChangeSetMode;
  intents: AuthoringIntent[];
  validate_profile?: ProfileId;
  projection_views?: ViewId[];
}

interface ApplyAuthoringIntentResult {
  kind: "sdd-authoring-intent-result";
  path: DocumentPath;
  base_revision: DocumentRevision;
  resulting_revision?: DocumentRevision;
  mode: ChangeSetMode;
  status: ChangeSetStatus;
  intents: AuthoringIntent[];
  change_set: ChangeSetResult;
  created_targets: Array<{
    local_id: string;
    kind: "node" | "edge";
    handle: Handle;
    parent_local_id?: string;
  }>;
  diagnostics: Diagnostic[];
}

type AuthoringIntent = InsertNodeScaffoldIntent;

type NodeRef =
  | { by: "handle"; handle: Handle }
  | { by: "selector"; selector: NodeSelector };

interface NodeSelector {
  kind: "node_id";
  node_id: string;
}

interface InsertNodeScaffoldIntent {
  kind: "insert_node_scaffold";
  local_id: string;
  parent?: NodeRef;
  placement: {
    mode: PlacementMode;
    anchor?: NodeRef;
  };
  node: {
    node_type: string;
    node_id: string;
    name: string;
    properties?: Array<{
      key: string;
      value_kind: ValueKind;
      raw_value: string;
      local_id?: string;
    }>;
    edges?: Array<{
      local_id: string;
      rel_type: string;
      to: string;
      to_name?: string | null;
      event?: string | null;
      guard?: string | null;
      effect?: string | null;
      props?: Record<string, string>;
      placement?: {
        mode: PlacementMode;
        anchor?: NodeRef;
      };
    }>;
    children?: InsertNodeScaffoldIntent[];
  };
}
```

#### Behavioral rules

- Every authoring intent resolves all `NodeRef` values against `base_revision` before any low-level operations are compiled.
- If any selector or handle target cannot be resolved, the entire request is rejected.
- Authoring intents compile to ordinary low-level `ChangeOperation[]`, then execute through the same rewrite, validation, projection, journal, and undo path as `apply_change_set`.
- `ApplyAuthoringIntentResult.change_set` is the canonical low-level effect record. Journaled behavior, undo eligibility, and `change_set_id` continue to be owned by that nested `ChangeSetResult`.
- `insert_node_scaffold` is allowed to compile into multiple primitive operations, but the authoring-intent surface must preserve a deterministic mapping from caller-supplied `local_id` values to created handles.
- Primitive operations remain the only public mutation substrate used by undo and by any tooling that needs surgical control.

#### Surface impacts

Helper impact:

- Add `sdd-helper author --request <file-or-stdin>`.
- Input body: `ApplyAuthoringIntentArgs`.
- Output payload: `ApplyAuthoringIntentResult`.

MCP impact:

- Add `sdd.apply_authoring_intent` as an additive tool.
- Keep `sdd.apply_change_set` unchanged and fully supported.
- Do not expose authoring intents as write-capable resources.

Skill impact:

- Update the skill to prefer `author` for common authoring slices such as creating a place with initial properties, edges, and nested nodes.
- Keep `apply` as the preferred surface for surgical edits, targeted repair work, and cases where the model already has the precise low-level handle context it needs.

### 4.2 Post-Mutation Target Discovery

Plain-language subtitle: Keep editing without another inspect

#### Intent

Successful insertions should expose the resulting handles whenever those handles are deterministically knowable from the post-change structure.

The current contracts already allow optional insertion handles in `ChangeSetSummary`. This design turns that optional field into a stronger behavioral requirement for successful insertions.

#### Behavioral rules

- On any successful `apply_change_set` result, `summary.node_insertions[].handle` must be populated when the inserted node exists in the post-change structural model.
- On any successful `apply_change_set` result, `summary.edge_insertions[].handle` must be populated when the inserted edge exists in the post-change structural model.
- This requirement applies to both `mode: "dry_run"` and `mode: "commit"`, because both modes compute a post-change result.
- The TypeScript shape can remain optional for backward compatibility, but the implementation behavior should treat the field as required whenever the handle is deterministically knowable.
- `ApplyAuthoringIntentResult.created_targets` must provide a stable mapping from caller-supplied `local_id` values to created handles. This mapping is the high-level continuation surface for `author`.
- Returned handles remain revision-bound. They are valid only for the `resulting_revision` of that result.

#### Surface impacts

Helper impact:

- `sdd-helper apply` results become immediately more useful for chained edits because insertions now return handles wherever possible.
- `sdd-helper author` returns both the nested `change_set` and `created_targets`, allowing follow-on requests without an automatic `inspect`.

MCP impact:

- `ChangeSetSummary` semantics in the MCP design should be tightened to require populated insertion handles where available.
- `sdd.apply_authoring_intent` should expose `created_targets` in addition to the nested `ChangeSetResult`.

Skill impact:

- After `author` or `apply`, the skill may continue from returned handles within the same `resulting_revision`.
- A fresh `inspect` remains the fallback when the model has crossed revisions, lost continuation context, or needs broader document structure than the returned result exposes.

### 4.3 First-Class Author Feedback Surfaces

Plain-language subtitle: Read validation and projection directly

#### Intent

Expose validation and projection as direct helper reads so that authoring workflows do not have to overload mutation requests merely to obtain semantic feedback.

No new semantic payload shapes are required. The shared authoring core already defines `ValidationResource` and `ProjectionResource`.

#### Behavioral rules

- Add shared helper-facing read services that return the same logical payloads as the existing validation and projection resources.
- `validate` must return the same `ValidationResource` shape already defined by the shared contracts.
- `project` must return the same `ProjectionResource` shape already defined by the shared contracts.
- `apply_change_set(... validate_profile/projection_views ...)` remains supported. It continues to be the correct inline confirmation mechanism when the caller wants edit execution and semantic feedback in one request.
- Direct validation and projection reads do not change revision semantics. They operate on the currently loaded LF-normalized document text and return the current revision in their result payloads.

#### Surface impacts

Helper impact:

- Add `sdd-helper validate <document_path> --profile <profile_id>`.
- Add `sdd-helper project <document_path> --view <view_id>`.
- Both commands should be documented and advertised through `sdd-helper capabilities`.

MCP impact:

- No new resource types are needed. The existing validation and projection resources remain authoritative.
- The MCP design should be revised to make it explicit that helper parity now includes direct read mirrors for validation and projection.
- Prompt guidance should prefer direct validation/projection reads during multi-step review loops when mutation is not needed in the same request.

Skill impact:

- Update the skill's default workflow to use direct `validate` and `project` during orient and review loops.
- Keep `apply(... validate_profile/projection_views ...)` as the preferred pattern when a mutation request should return immediate semantic feedback under the same request envelope.
- Remove the current skill prohibition on standalone validation and projection reads.

### 4.4 Semantic Target Resolution

Plain-language subtitle: Refer to nodes by meaningful selectors

#### Intent

Provide a narrowly scoped selector-resolution layer for high-level authoring intents so the caller can refer to an existing node by exact `node_id` rather than always by opaque handle.

This capability is intentionally limited to high-level authoring. It does not replace handle-based low-level mutation.

#### Proposed shared behavior

- `NodeSelector` supports exactly one kind in the first slice: `{ kind: "node_id"; node_id: string }`.
- Selectors resolve within the single document identified by `path` and the single revision identified by `base_revision`.
- Resolution occurs before authoring-intent compilation.
- Exact-match semantics apply. There is no fuzzy matching, substring matching, path matching, or hierarchy-aware lookup in this slice.
- If zero nodes match the selector, reject the entire request.
- If multiple nodes match the selector, reject the entire request.
- Body-item selectors, property selectors, edge selectors, and path-like selectors are explicitly deferred.

#### Diagnostics

This design recommends two new shared diagnostic codes:

- `sdd.selector_not_found`
- `sdd.selector_ambiguous`

These should be emitted as domain diagnostics rather than helper-only text errors.

#### Surface impacts

Helper impact:

- Selector-based targeting is available only inside `sdd-helper author` requests.
- `sdd-helper apply` remains handle-based because it targets the low-level change-set contract directly.

MCP impact:

- Selector-based targeting is available only inside `sdd.apply_authoring_intent`.
- No new write-capable resource is introduced.
- The MCP design should extend its diagnostics section to account for selector-resolution failures.

Skill impact:

- Update `SKILL.md` to teach selectors as a convenience available through `author`.
- Keep the skill explicit that low-level `apply` still requires fresh handles and remains the authoritative precise-edit surface.

## 5. Required Accommodations In Existing Design Authorities

### 5.1 Additive revisions needed in `sdd_mcp_server_design.md`

The following accommodations are required for the future MCP server to benefit fully from these capabilities:

Section 4:

- Add `NodeSelector` and `NodeRef` to the common-type discussion for the new authoring-intent layer.
- Extend diagnostic coverage with `sdd.selector_not_found` and `sdd.selector_ambiguous`.

Section 7:

- Keep `ChangeSetSummary` structurally backward-compatible, but tighten its behavioral contract so insertion handles are populated wherever deterministically knowable.

Section 9:

- Add a new tool: `sdd.apply_authoring_intent`.
- Keep `sdd.create_document` unchanged.
- Do not use this design as a vehicle for template expansion.

Section 10:

- Revise prompt guidance so `sdd.author_new_document`, `sdd.extend_document`, and `sdd.repair_document` may prefer `sdd.apply_authoring_intent` for common authoring slices.
- Revise prompt guidance so prompts may direct callers to use direct validation and projection reads during non-mutating feedback loops.

Section 11:

- Add `sdd-helper author --request <file-or-stdin>`.
- Add `sdd-helper validate <document_path> --profile <profile_id>`.
- Add `sdd-helper project <document_path> --view <view_id>`.
- Update the helper command-set discussion so the helper mirrors validation and projection as direct reads, while continuing to share the same domain contracts as MCP.

No changes are needed to the current read-resource model beyond clarifying that helper parity now includes direct CLI mirrors for the already-defined validation and projection payloads.

### 5.2 Required updates in `skills/sdd-skill/SKILL.md`

`SKILL.md` should be updated in these exact areas:

Quick Start:

- Add `author`, `validate`, and `project`.

Default Workflow:

- Change the primary workflow from `inspect -> apply dry-run -> commit -> preview if needed`
- To `inspect -> author/apply dry-run -> validate/project as needed -> commit -> preview if needed`

Edit Safety Rules:

- Allow continued editing from returned handles within the same `resulting_revision`.
- Keep fresh `inspect` as the fallback when revision context changes or broader structure is needed.

Supported Helper Surface:

- Add `author`
- Add `validate`
- Add `project`

Standalone feedback guidance:

- Remove the current prohibition on standalone `project` and `validate`.

### 5.3 Required follow-on updates in other skill docs

The following docs should be updated when these capabilities land:

- `skills/sdd-skill/references/current-helper-gaps.md`
  Remove the claim that projection-only and validation-only readouts are not exposed as standalone helper commands.
- `skills/sdd-skill/references/workflow.md`
  Add `author`, `validate`, and `project` to the canonical helper-first workflow.
- `docs/sdd_skill_v0_implementation_plan.md`
  Remove the assumption that standalone validation and projection reads are unavailable, and update the listed supported helper surface accordingly.

## 6. Worked Scenarios

### 6.1 Author a nested node scaffold under an existing parent

Goal:

- insert a nested `place` under an existing parent selected by exact `node_id`
- seed the new node with initial properties
- seed one nested child node

Example request:

```json
{
  "path": "docs/example.sdd",
  "base_revision": "<revision-from-inspect>",
  "intents": [
    {
      "kind": "insert_node_scaffold",
      "local_id": "place-open-shifts",
      "parent": {
        "by": "selector",
        "selector": {
          "kind": "node_id",
          "node_id": "volunteer_scheduling"
        }
      },
      "placement": {
        "mode": "last"
      },
      "node": {
        "node_type": "place",
        "node_id": "open_shifts",
        "name": "Open Shifts",
        "properties": [
          {
            "key": "description",
            "value_kind": "quoted_string",
            "raw_value": "Shows volunteer shifts that still need coverage."
          },
          {
            "key": "route_or_key",
            "value_kind": "quoted_string",
            "raw_value": "/volunteers/shifts/open"
          }
        ],
        "children": [
          {
            "kind": "insert_node_scaffold",
            "local_id": "component-open-shift-list",
            "placement": {
              "mode": "last"
            },
            "node": {
              "node_type": "component",
              "node_id": "open_shift_list",
              "name": "Open Shift List"
            }
          }
        ]
      }
    }
  ],
  "mode": "dry_run",
  "validate_profile": "strict",
  "projection_views": ["ui_contracts"]
}
```

Expected outcome:

- the request resolves `volunteer_scheduling` against `base_revision`
- the intent compiles into low-level insert/property operations
- the result returns a canonical nested `change_set`
- `created_targets` contains handles for `place-open-shifts` and `component-open-shift-list`

### 6.2 Continue editing from returned handles without re-`inspect`

Goal:

- use handles returned by a prior successful authoring result to perform a targeted follow-on edit within the same resulting revision

Example follow-on request:

```json
{
  "path": "docs/example.sdd",
  "base_revision": "<resulting_revision-from-author>",
  "operations": [
    {
      "kind": "set_node_property",
      "node_handle": "<handle-for-place-open-shifts>",
      "key": "responsibility",
      "value_kind": "quoted_string",
      "raw_value": "Allow volunteers to browse and claim open shifts."
    }
  ],
  "mode": "dry_run",
  "validate_profile": "strict"
}
```

Expected outcome:

- no second `inspect` is required solely to recover the handle for the newly created place
- the returned handle remains valid because the follow-on request uses the exact `resulting_revision` from the prior result

### 6.3 Run direct validation and projection reads around an authoring loop

Goal:

- read validation and projection without embedding those reads into every mutation request

Example sequence:

```bash
sdd-helper author --request /tmp/author-request.json
sdd-helper validate docs/example.sdd --profile strict
sdd-helper project docs/example.sdd --view ui_contracts
```

Expected outcome:

- the authoring request performs the structural edit
- validation returns `ValidationResource`
- projection returns `ProjectionResource`
- the skill can decide whether further edits are needed before preview

### 6.4 Reject ambiguous or missing selector targets deterministically

Goal:

- ensure selector-based authoring fails safely and explicitly

Example failure classes:

- the requested `node_id` does not exist in `base_revision`
- the requested `node_id` resolves to multiple nodes in `base_revision`

Expected outcome:

- the entire authoring request is rejected
- diagnostics include `sdd.selector_not_found` or `sdd.selector_ambiguous`
- no partial low-level mutation is applied

## 7. Acceptance Criteria

This design is acceptable only if the first implementation slice can be built without the implementer making policy decisions about capability boundaries, compatibility posture, or surface ownership.

At minimum, the implemented first slice should satisfy these tests:

- `sdd-helper capabilities` advertises `author`, `validate`, and `project`
- `sdd-helper validate` returns the same logical shape as `ValidationResource`
- `sdd-helper project` returns the same logical shape as `ProjectionResource`
- successful `apply_change_set` insertions populate node and edge handles where deterministically knowable
- successful `author` results expose `created_targets` mapped by caller-supplied `local_id`
- selector resolution accepts exact single-match `node_id` references and rejects zero-match or multi-match selectors deterministically
- `sdd-skill` can execute a normal `inspect -> author/apply -> validate/project -> preview if needed` workflow without promising helper-only semantics or bypassing the shared authoring core

## 8. Explicitly Deferred

This design does not attempt to solve:

- create-time template expansion
- starter packs or domain packs
- component catalogs or import systems
- preview artifact transport redesign
- raw text subtree replacement
- generalized session-state features such as "commit last dry run"

Those topics require separate design work and are intentionally excluded here.

## 9. Serial Implementation Order

Implement in this order:

1. standalone helper `validate` and `project`
2. guaranteed insertion-handle returns for `apply_change_set`
3. shared authoring-intent service plus `sdd-helper author` and `sdd.apply_authoring_intent`
4. node-only selector resolution inside authoring intents
