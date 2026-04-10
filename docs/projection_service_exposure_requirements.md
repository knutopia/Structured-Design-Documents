# Requirements: Expose a Stable Projection Service 04-10-26

## Status

Draft requirements for a separate planning and implementation thread.

This document is the ground truth for the milestone "expose a stable projection service" that should precede helper-app authoring workflows and any MCP-server work that depends on projection output.

## Purpose

Expose projection as a stable in-process TypeScript service that downstream tools can call directly without going through CLI shelling or renderer internals.

This milestone is specifically about a library/service boundary inside the current repo. It is not the MCP server itself, and it is not a database-backed projection system.

Primary downstream consumers:

- a future helper app for low-level document tooling
- a future Codex skill that can inspect and reason over projections
- a future MCP server that can return projection resources and projection-oriented tool results

## Why This Milestone Exists

Today projection is architecturally important but still treated as an internal contract:

- the toolchain pipeline explicitly includes internal `projectView` after validation and before rendering
- renderers consume normalized projections as their semantic input
- contributor guidance still says v0.1 has no public `sdd project` command and that projection remains internal

That is a mismatch for future LLM-facing integrations. A helper app or MCP server should not have to reach into renderer code or duplicate projection orchestration in order to get a normalized view projection.

## Normative Inputs

These sources define the authority hierarchy for this milestone.

### Normative contract and architectural guardrails

- `bundle/v0.1/core/views.yaml`
- `bundle/v0.1/core/projection_schema.json`
- `docs/toolchain/architecture.md`
- `docs/toolchain/decisions.md`
- `docs/toolchain/development.md`

### Current implementation references

- `src/projector/projectView.ts`
- `src/projector/shared.ts`
- `src/projector/types.ts`
- `src/projector/viewProjectors.ts`
- `src/index.ts`
- `src/renderer/renderView.ts`
- `src/renderer/previewWorkflow.ts`

### Existing behavioral evidence

- `tests/project_*.spec.ts`
- `tests/viewProjectionSemantics.spec.ts`
- bundle projection snapshots declared in `bundle/v0.1/manifest.yaml`

## Non-Negotiable Invariants

The implementation thread must preserve these invariants unless a separate explicit decision changes them.

1. Projection remains the semantic boundary between the compiled graph and rendering technology.

2. Projection exposure must not push renderer concerns into projection.
   Projection must not gain layout coordinates, routing geometry, SVG structure, DOT text, Mermaid text, ELK JSON, or backend-specific formatting.

3. Projection semantics remain bundle-driven.
   `views.yaml` and `projection_schema.json` remain the source of truth for projection scope and projection contract shape.

4. Exposing projection must not change parser, compiler, validator, or renderer behavior.
   This milestone is an exposure/refactoring milestone, not a semantics-change milestone.

5. Projection remains profile-agnostic in this milestone.
   Validation profiles may continue to affect validation and renderer display policy, but they must not become inputs that change projection scope or projection contract shape unless a separate explicit decision says otherwise.

6. Determinism must be preserved.
   Stable ordering, stable diagnostics ordering, and stable JSON-serializable output remain required.

7. Projection schema validation remains mandatory.
   A public projection service must continue to validate projection output against `bundle.projectionSchema` before reporting success.

8. The milestone exposes a stable library/service API, not necessarily a public CLI command.
   A new public `sdd project` command is not required for this milestone and should not be treated as the goal.

## Current State

Current repo state, to be treated as the baseline:

- `projectView(graph, bundle, viewId)` exists internally and returns `ProjectionResult`
- projection output is schema-validated in `src/projector/shared.ts`
- projection types already exist in `src/projector/types.ts`
- render and preview flows call internal projection code
- root package exports do not currently expose projection APIs or types
- contributor docs still describe projection as internal in v0.1

## Required Outcome

After this milestone, the repo must provide a stable, documented, test-covered projection service that:

- can be called directly from TypeScript without shelling out to the CLI
- can project from an already-compiled graph
- can project directly from source input through a convenience API
- returns deterministic, schema-valid projection objects and structured diagnostics
- is explicitly documented as a supported library contract
- does not require any renderer or preview module in order to obtain projections

## Required Pre-Step: Isolate Renderer-Owned Projection Preparation

Before exposing the public projection service, the implementation must isolate renderer-owned projection preparation from the public projection contract.

Renderer-owned projection preparation includes any post-projection shaping performed for display policy, preview backend expectations, staged-renderer convenience, or other rendering-specific needs. That includes preparation that reshapes, augments, filters, or annotates projection data after the schema-validated projection boundary has already been produced.

That preparation may consume the public projection service output, but it must not define, replace, or expand the public projection service contract. The public projection service remains the schema-validated, deterministic projection boundary described by `views.yaml` and `projection_schema.json`.

This requirement exists to prevent FR-9 from being satisfied by moving renderer-owned preparation into the public projection service just to create a single exposed API. A current motivating class of issue is preview-side preparation that further shapes projection data for rendering convenience, such as the current `ui_contracts` preview-side preparation path, but the requirement is general and must apply repo-wide rather than being treated as a view-specific exception.

Acceptance condition for this pre-step:

- public callers receive the same projection contract exposed at the package boundary
- renderer-owned projection preparation remains a separate internal renderer concern layered on top of that contract

## Scope

### In Scope

- expose stable projection types and service functions from the package
- add a convenience source-to-projection API
- ensure projection outputs remain schema-validated
- document the public library contract and its boundaries
- add tests that prove the exposed service contract
- update docs that currently describe projection as purely internal

### Out Of Scope

- building an MCP server
- building the helper app
- adding projection-based document mutation
- adding a database or persistent projection store
- adding a public end-user `sdd project` CLI command
- changing projection semantics for any view
- changing projection schema shape
- changing render-model or preview output semantics

## Functional Requirements

### FR-1: Public Type Exports

The package must publicly export stable projection types at the root package boundary.

At minimum, the public exports must include:

- `Projection`
- `ProjectionResult`
- `ProjectionNode`
- `ProjectionEdge`
- `ProjectionNodeAnnotation`
- `ProjectionEdgeAnnotation`
- `ProjectionNodeGroup`
- `ProjectionOmission`

These should be exported from the root package entry point so downstream callers do not need to deep-import internal files.

### FR-2: Public Graph-to-Projection Service

The package must publicly expose a stable graph-to-projection function.

Required capability:

- accept a compiled graph, a loaded bundle, and a `viewId`
- return `ProjectionResult`
- preserve current semantics for unknown views, unsupported views, schema validation failures, and successful projection

The current internal `projectView(graph, bundle, viewId)` function may be promoted as the public contract if its signature and semantics are retained and documented as stable.

### FR-3: Public Source-to-Projection Convenience Service

The package must publicly expose a source-to-projection convenience API so downstream tools do not need to manually orchestrate parse/compile/project for the common case.

Required capability:

- accept `SourceInput`, `Bundle`, and `viewId`
- compile source using the existing compile pipeline
- stop on compile failure and return sorted diagnostics
- project successful compiled graphs using the same projection service as FR-2
- return a deterministic result shape suitable for helper-app and MCP-server callers

The exact function name may be chosen in implementation planning, but the capability is required.

### FR-4: Support All Registered Projection Views

The public projection service must support every currently registered projector in `src/projector/viewProjectors.ts`, including views that are not yet preview-ready in the CLI.

Projection exposure must not be limited only to the currently preview-ready views.

### FR-5: Schema-Validated Success Contract

Successful projection results must continue to be validated against `bundle.projectionSchema`.

Required behavior:

- invalid projections surface `project.schema_validation_failed` diagnostics
- callers do not receive a successful `projection` object when schema validation fails
- projection schema validation uses the bundle currently supplied by the caller, not a duplicated or hardcoded schema

### FR-6: Deterministic Output Contract

The public projection service must preserve deterministic behavior.

At minimum:

- projected nodes remain deterministically ordered
- projected edges remain deterministically ordered
- derived annotations, node groups, and omissions remain deterministically ordered
- diagnostics remain sorted
- returned projections are directly JSON-serializable without extra normalization

### FR-7: Source Provenance Behavior

The exposed service must preserve existing projection provenance behavior.

At minimum:

- `source_example` remains populated from the graph source path basename when available
- projection diagnostics continue to report the source file path where available
- source-to-projection convenience flow must preserve the same file-path behavior as the current compile pipeline

### FR-8: Renderer Independence

The public projection service must not depend on render-model builders, preview backends, staged renderer modules, or CLI-only preview workflows in order to project a view.

Allowed dependency direction:

- renderers may depend on the projection service
- the projection service may depend on bundle loading, compiler types, shared projector helpers, and projector registries

Forbidden dependency direction:

- the projection service must not depend on preview backends or renderer-stage contracts

### FR-9: Single Shared Projection Orchestration Path

The repo must have one shared projection orchestration path for public callers and internal render/preview consumers.

This requirement exists to avoid drift between:

- internal renderer projection behavior
- helper-app projection behavior
- future MCP-server projection behavior

The follow-on implementation should not create a second projection pipeline just to expose the service.

### FR-10: No Public CLI Requirement In This Milestone

This milestone must not require introducing a new public `sdd project` command.

If an implementation thread decides to add a temporary internal harness for testing or debugging, that harness must not redefine the public contract and must not become the primary acceptance artifact for this milestone.

## Documentation Requirements

### DR-1: Clarify Projection Status

Docs that currently describe projection as internal must be updated to reflect the new state precisely:

- projection becomes a stable exported library contract
- projection may still remain a non-public CLI surface in v0.1 unless a later milestone changes that
- the implementation must update the current internal-only projection statements in `docs/toolchain/architecture.md`, `docs/toolchain/development.md`, and `docs/toolchain/decisions.md`
- those updates must state that projection is now a stable exported library/service contract, while `sdd project` remains a non-public CLI surface in v0.1 unless a later milestone changes that

### DR-2: Document Service Boundaries

The public documentation for this milestone must clearly state:

- what the projection service does
- what inputs it accepts
- what outputs it returns
- what it does not do
- that projection remains the semantic boundary before rendering

### DR-3: Document Intended Downstream Use

Documentation should explicitly note that this service exists to support:

- helper-app work
- Codex-skill work
- future MCP-server work

without requiring those downstream consumers to invoke the CLI.

## Test Requirements

### TR-1: Existing Projection Semantics Must Remain Green

Existing projection tests must continue to pass without semantic regression, including:

- targeted per-view projection tests
- `tests/viewProjectionSemantics.spec.ts`
- any existing snapshot-backed projection coverage

### TR-2: Public Export Coverage

Add tests that prove the root package exposes the required projection types and functions without deep imports.

### TR-3: Source-to-Projection Coverage

Add tests for the new source-to-projection convenience service, including:

- successful projection from source input
- compile failure path
- unknown view path
- schema-validation failure path if practical through a focused test double or fixture

### TR-4: Internal Consumer Reuse

Add or adjust tests so that internal renderer/preview code paths are proven to use the shared projection orchestration path rather than maintaining duplicated behavior.

The exact test shape is implementation-dependent, but the anti-goal is hidden orchestration drift.

## Acceptance Criteria

This milestone is complete only when all of the following are true.

1. A stable projection API is exported at the root package boundary.

2. A source-to-projection convenience API exists and is documented.

3. Projection outputs remain schema-valid and deterministic.

4. Existing projection semantics and snapshots remain acceptable without hidden drift.

5. Internal render/preview consumers use the same projection service contract or shared orchestration path.

6. Docs are updated so projection is no longer described ambiguously as internal-only.

7. The current internal-only projection statements in `docs/toolchain/architecture.md`, `docs/toolchain/development.md`, and `docs/toolchain/decisions.md` are revised so they describe projection as a stable exported library/service contract while still clarifying that v0.1 does not yet expose a public `sdd project` CLI command.

8. The result is usable by a separate helper-app or MCP-server thread without requiring CLI shelling or deep-importing internal modules.

## Explicit Non-Goals And Stop Conditions

### Non-Goals

- do not add document editing
- do not add file mutation helpers
- do not add persistence beyond current bundle/source inputs
- do not redesign projection schema
- do not conflate projection exposure with public CLI design

### Stop Conditions

Stop and surface the issue instead of coding through it if:

- exposing projection requires changing projection semantics rather than exposing them
- the chosen approach introduces renderer-specific data into the projection contract
- the only way to expose the service is to treat renderer-owned projection preparation as part of the public projection contract
- the only way to finish is to duplicate projection logic in a second orchestration path
- documentation, tests, or snapshots would need to be loosened merely to hide semantic drift

## Recommended Deliverable Shape

The exact implementation plan belongs in the separate thread, but the resulting milestone should likely include:

- public exports for projection service and projection types
- one shared orchestration path for graph-to-projection and source-to-projection use
- tests for public contract exposure and behavior
- doc updates across architecture/development/decision material where projection status is described

## Future Work Unlocked By This Milestone

This milestone should make the following later work straightforward:

- helper CLI commands such as `inspect`, `project`, or `validate`
- Codex skills that inspect a projection without using renderer internals
- MCP resources such as `sdd://projection/{path}?view=...`
- MCP tools that return normalized projection data as structured content

It should not attempt to solve those later milestones directly.
