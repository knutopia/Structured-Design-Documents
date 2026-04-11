# [Done] Projection Service Exposure Execution Plan

## Purpose

This document turns `docs/[Done] projection_service_exposure_requirements.md` into a
detailed execution plan.

It is intentionally written for the "1-thread, 3-checkpoint milestone" shape:

- one durable milestone plan document
- followed by serial `Plan Mode` checkpoint executions
- with acceptance checks between checkpoints
- with no concurrent writing threads on projector or render-orchestration code

This is not a "export a couple of symbols and move on" plan. The target is to
expose projection as a stable in-process TypeScript service while preserving the
existing semantic boundary between projection and rendering, isolating
renderer-owned post-projection shaping, and avoiding a second generation of
projection-service drift.

Suggested durable plan-doc path:

- `docs/[Done] projection_service_exposure_execution_plan.md`

## Planning Model

Use this document as the stable strategy artifact. Do not try to execute the
whole milestone in one long implementation thread.

Execution cadence:

1. Select one checkpoint from this document.
2. Enter `Plan Mode` for that checkpoint only.
3. Restate the checkpoint scope, invariants, files, and verification plan.
4. Implement and verify only that checkpoint.
5. Report:
   - satisfied invariants
   - violated invariants
   - residual risks
   - recommended next checkpoint
6. Do not begin the next checkpoint until the current checkpoint is accepted.

Concurrency rule:

- use sequential execution for projector and render-orchestration work
- allow at most one writing thread at a time across:
  - `src/projector/*`
  - `src/index.ts`
  - `src/renderer/renderView.ts`
  - `src/renderer/previewWorkflow.ts`
  - `src/renderer/viewRenderers.ts`
  - the new renderer-side projection-preparation helper
- optional read-only sidecar review is acceptable between checkpoints
- do not run concurrent coding agents on projector core or render-orchestration
  files

## Authority And Locked Decisions

Authority order for this milestone:

1. `docs/[Done] projection_service_exposure_requirements.md`
2. `bundle/v0.1/core/views.yaml`
3. `bundle/v0.1/core/projection_schema.json`
4. `docs/toolchain/architecture.md`
5. `docs/toolchain/decisions.md`
6. `docs/toolchain/development.md`
7. current projection and render code as evidence of current behavior, not
   authority

Locked implementation decisions:

- keep `projectView(graph, bundle, viewId): ProjectionResult` as the public
  graph-to-projection API
- export `projectView` from `src/index.ts`
- add `projectSource(input, bundle, viewId): ProjectionResult` as the public
  source-to-projection convenience API
- implement `projectSource` in a new `src/projector/projectSource.ts` module
- keep the public source-to-projection API projection-focused: it returns
  `ProjectionResult` only, not the compiled graph
- keep validation outside the public projection service:
  `renderSource(...)` and `renderSourcePreview(...)` continue to own
  profile-aware validation before rendering
- do not force render or preview flows through a helper that projects source
  before validation; reuse for those flows stays at the shared `projectView(...)`
  and renderer-preparation layers
- treat renderer-owned projection preparation as a separate internal renderer
  layer that may consume a projection but must not define the public projection
  contract
- implement the renderer-owned preparation layer in
  `src/renderer/prepareProjectionForRender.ts`
- expose one renderer-side entry point named
  `prepareProjectionForRender(view, projection, graph, profileId)` that returns
  `{ projection: Projection; notes: string[] }`
- route both `src/renderer/viewRenderers.ts` and
  `src/renderer/previewWorkflow.ts` through
  `prepareProjectionForRender(...)` rather than calling view-specific
  post-projection shaping directly
- add one public-contract spec file at
  `tests/projectionServicePublicApi.spec.ts`
- do not add a public `sdd project` CLI command in this milestone

## Non-Negotiable Invariants

The implementation must preserve these invariants throughout the milestone:

- projection remains the semantic boundary between the compiled graph and
  rendering technology
- the public projection service must not gain layout coordinates, routing
  geometry, SVG structure, DOT text, Mermaid text, ELK JSON, or backend-specific
  formatting
- `views.yaml` and `projection_schema.json` remain the source of truth for
  projection scope and projection contract shape
- exposing projection must not change parser, compiler, validator, or renderer
  behavior
- the public projection service remains profile-agnostic
- projection success remains schema-validated against `bundle.projectionSchema`
- deterministic ordering of projected nodes, edges, annotations, node groups,
  omissions, and diagnostics must be preserved
- no checkpoint may declare success by moving renderer-owned preparation into the
  public projection contract
- no checkpoint may declare success by broadening scope into MCP, helper-app, or
  CLI command work

## Current Reality And Risks

Current reality:

- `projectView(...)` already exists as the single graph-to-projection entry
  point
- projection types already exist
- projection results are already schema-validated and deterministically ordered
- root exports do not yet expose projection APIs or projection types
- `renderSource(...)` and `renderSourcePreview(...)` still own overlapping
  compile, validate, and project orchestration
- preview currently contains renderer-owned post-projection shaping, especially
  in the `ui_contracts` path
- docs still describe projection as internal-only
- tests are strong on projection semantics and projection snapshots, but weak on
  public export coverage and public source-to-projection coverage

Main risks:

- accidentally folding renderer-owned preparation into the public projection
  contract
- creating a second compile and project orchestration path instead of sharing
  the right layers
- introducing profile-aware behavior into the public projection service
- forcing render or preview flows through projection-before-validation behavior
  that changes current renderer execution order
- treating doc updates as optional cleanup instead of acceptance criteria

## Public API And Boundary Shape

Public root exports required by this milestone:

- `projectView`
- `projectSource`
- `Projection`
- `ProjectionResult`
- `ProjectionNode`
- `ProjectionEdge`
- `ProjectionNodeAnnotation`
- `ProjectionEdgeAnnotation`
- `ProjectionNodeGroup`
- `ProjectionOmission`

Behavioral contract:

- `projectView(...)` remains the schema-valid, deterministic
  graph-to-projection boundary
- `projectSource(...)` performs `compileSource(...)` and then projects via
  `projectView(...)`
- on compile failure, `projectSource(...)` returns no `projection` and returns
  sorted compile diagnostics
- on projection failure, `projectSource(...)` returns sorted projection
  diagnostics and no `projection`
- `projectSource(...)` does not run profile validation
- renderer-owned preparation is explicitly not part of either public API

Internal helper split:

- `src/projector/projectSource.ts` should contain a private helper named
  `compileAndProjectSource(...)` that returns
  `{ graph?: CompiledGraph; projection?: Projection; diagnostics: Diagnostic[] }`
- public `projectSource(...)` should call `compileAndProjectSource(...)` and
  then discard the internal `graph` from the returned shape
- `renderSource(...)` and `renderSourcePreview(...)` should not call
  `compileAndProjectSource(...)` because they must keep validation ownership and
  current validation-before-render behavior
- render and preview flows should instead share `projectView(...)` plus
  `prepareProjectionForRender(...)`

## Success Criteria

This milestone is complete only when all of the following are true:

1. renderer-owned projection preparation is explicitly isolated before public
   API exposure
2. `projectView` is exported at the root package boundary
3. `projectSource` exists, is documented, and remains profile-agnostic
4. the required projection types are exported at the root package boundary
5. existing projection semantics and projection snapshots remain green
6. internal render and preview consumers do not maintain hidden
   source-to-projection or renderer-preparation drift
7. the required toolchain docs are updated to remove internal-only projection
   language
8. no public CLI projection command is added
9. the result is usable by helper-app or MCP work without CLI shelling or deep
   imports

## Checkpoint Overview

1. Boundary hardening and contract locking
2. Public service exposure and shared orchestration
3. Consumer reuse, docs, and closeout

## [Done] Checkpoint 1: Boundary Hardening And Contract Locking

### Goal

Isolate renderer-owned projection preparation before exposing any new public
projection API surface.

### Why This Checkpoint Exists

The requirements now contain a mandatory pre-step that keeps renderer-owned
post-projection shaping separate from the public projection service. Current
preview behavior already demonstrates why this matters.

### In Scope

- add `src/renderer/prepareProjectionForRender.ts`
- introduce `prepareProjectionForRender(view, projection, graph, profileId)`
  as the single renderer-owned projection-preparation entry point
- move current preview-side `ui_contracts` preparation into
  `prepareProjectionForRender(...)`
- update the `ui_contracts` text-renderer path in
  `src/renderer/viewRenderers.ts` to use `prepareProjectionForRender(...)`
  instead of calling `buildUiContractsRenderData(...)` directly
- update `src/renderer/previewWorkflow.ts` to use
  `prepareProjectionForRender(...)` instead of inlining view-specific
  preparation
- keep raw `projectView(...)` output as the only public projection contract
  candidate
- add or adjust tests that lock the distinction between raw projection and
  renderer-owned preparation

### Out Of Scope

- root-package export changes
- the new `projectSource(...)` public API
- toolchain doc updates

### Deliverables

- one explicit renderer-side projection-preparation module
- preview and text-renderer flows using that module
- unchanged raw projection snapshots and projection semantics

### Verification

Run in this order:

- `TMPDIR=/tmp pnpm run build`
- `TMPDIR=/tmp pnpm exec vitest run tests/projectionSnapshots.spec.ts tests/viewProjectionSemantics.spec.ts`
- `TMPDIR=/tmp pnpm exec vitest run tests/uiContractsRenderModel.spec.ts tests/render_profile_display.spec.ts tests/previewWorkflow.spec.ts`

### Done When

- raw `projectView(...)` output is unchanged
- preview behavior is unchanged
- text-renderer behavior is unchanged
- renderer-owned preparation is explicit and no longer embedded in the public
  projection-service candidate path

## [Done] Checkpoint 2: Public Service Exposure And Shared Orchestration

### Goal

Expose a stable root-level projection API and introduce one shared
source-to-projection orchestration path without changing projection semantics.

### Why This Checkpoint Exists

Most projector logic already exists. The missing work is making it public,
convenient, and non-drifting.

### In Scope

- add `src/projector/projectSource.ts`
- implement private `compileAndProjectSource(...)`
- implement public `projectSource(...)` on top of that helper
- export `projectView` and all required projection types from `src/index.ts`
- export `projectSource` from `src/index.ts`
- preserve current semantics for unknown view, unsupported view, schema
  validation failure, provenance, and deterministic ordering
- keep render and preview flows on their current compile, validate, then render
  order
- add `tests/projectionServicePublicApi.spec.ts`

### Out Of Scope

- CLI expansion
- projection-schema changes
- profile-aware behavior in the public projection API
- doc updates at the required toolchain locations

### Required Test Coverage

`tests/projectionServicePublicApi.spec.ts` must cover:

- root-package export coverage for all required projection APIs and types
- `projectSource(...)` success path
- compile failure path
- unknown view path
- schema-validation failure path

Schema-validation failure implementation choice:

- use a focused bundle test double rather than changing a fixture
- clone a loaded bundle in-memory and replace `projectionSchema` with a schema
  that rejects the otherwise-valid projection result
- assert `project.schema_validation_failed` and absence of `projection`

### Deliverables

- root-level public projection API
- new public `projectSource(...)` API
- no deep-import requirement for downstream projection callers
- one shared private source-to-projection orchestration path for the public API

### Verification

Run in this order:

- `TMPDIR=/tmp pnpm run build`
- `TMPDIR=/tmp pnpm exec vitest run tests/project_ia_place_map.spec.ts tests/projectionSnapshots.spec.ts tests/viewProjectionSemantics.spec.ts`
- `TMPDIR=/tmp pnpm exec vitest run tests/projectionServicePublicApi.spec.ts`
- `TMPDIR=/tmp pnpm exec vitest run tests/previewWorkflow.spec.ts tests/render_profile_display.spec.ts`

### Done When

- downstream callers can import projection APIs and types from the root package
  only
- `projectSource(...)` is public, profile-agnostic, and projection-only
- public source-to-projection behavior is shared through one private helper
- no existing projection or render behavior changes

## [Done] Checkpoint 3: Consumer Reuse, Docs, And Closeout

### Goal

Close the milestone by proving internal consumer reuse, updating the
internal-only docs, and locking the public contract with final acceptance
coverage.

### Why This Checkpoint Exists

The milestone is only complete when docs, internal-consumer reuse, and
acceptance criteria all line up with the new public boundary.

### In Scope

- add or adjust tests that explicitly guard against hidden orchestration drift
- prove that:
  - raw projection semantics still come from `projectView(...)`
  - source convenience projection comes from `projectSource(...)`
  - renderer-owned preparation comes from `prepareProjectionForRender(...)`
- update:
  - `docs/toolchain/architecture.md`
  - `docs/toolchain/decisions.md`
  - `docs/toolchain/development.md`
- update those docs so projection is described as a stable exported
  library/service contract rather than an internal-only artifact
- keep the docs explicit that `sdd project` remains non-public in v0.1
- add minimal root-import examples for `projectView(...)` and `projectSource(...)`
  only if needed to make the public contract clear

### Out Of Scope

- helper-app implementation
- MCP server work
- CLI contract expansion
- projection semantics changes

### Deliverables

- docs updated at the three required toolchain locations
- orchestration-reuse tests in place
- milestone acceptance criteria satisfied end-to-end

### Verification

Run in this order:

- `TMPDIR=/tmp pnpm run build`
- `TMPDIR=/tmp pnpm exec vitest run tests/projectionServicePublicApi.spec.ts tests/projectionSnapshots.spec.ts tests/viewProjectionSemantics.spec.ts`
- `TMPDIR=/tmp pnpm exec vitest run tests/previewWorkflow.spec.ts tests/render_profile_display.spec.ts tests/cli.spec.ts`
- `TMPDIR=/tmp pnpm test`

### Done When

- docs no longer describe projection as internal-only
- the public projection API is documented and test-covered
- internal render and preview paths are proven to use the shared orchestration
  layers where intended
- the full suite passes with no projection snapshot drift and no render-behavior
  regression

## Stop Rules

Stop and surface the issue instead of coding through it if:

- exposing the service requires changing projection semantics rather than
  exposing them
- the only way to reduce drift is to move renderer-owned preparation into the
  public projection contract
- the only way to finish is to create a second compile and project pipeline
- preserving render validation ordering conflicts with the chosen helper design
- tests or snapshots would need to be loosened merely to hide semantic drift

## Assumptions

- the durable implementation-plan document lives at
  `docs/[Done] projection_service_exposure_execution_plan.md`
- the public source-to-projection API returns `ProjectionResult` only
- any richer result shape needed for render or preview reuse remains internal
- checkpoint execution stays serial, with one writing thread on projector and
  render-orchestration code at a time
