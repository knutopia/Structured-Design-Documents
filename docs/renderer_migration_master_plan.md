# Renderer Migration Master Plan

## Purpose

This document breaks the renderer migration into a sequence of well-defined steps.

Each step is intended to be used as input to a separate, sequential implementation thread. In each of those threads, the step should be turned into a specific implementation plan and then executed.

This master plan focuses first on achieving SVG rendering for:

- `ia_place_map`
- `ui_contracts`

All other diagram types are intentionally deferred until the architecture has been proven on those two views.

## Reference Documents

Every step in this plan should be read together with:

- `docs/toolchain/renderer_migration_guidance.md`
- `docs/Specific Layout Concerns per Diagram Type.md`

The migration guidance defines the target renderer architecture. The diagram-type concerns document identifies layout constraints that must shape implementation choices for specific views.

## LEGACY Classification

For this master plan, `LEGACY` includes all renderer paths that predate the staged scene-based SVG renderer.

That explicitly includes:

- legacy DOT text rendering
- legacy Graphviz-backed DOT preview rendering for SVG and PNG
- legacy Mermaid text rendering

In other words, Mermaid is not part of the new staged renderer path. It remains a supported legacy renderer path during migration, alongside the existing DOT and Graphviz-driven paths.

## Planning Rules

- Steps are sequential. Do not start a later step until the earlier one is complete and merged.
- Each step should preserve parser, compiler, validator, and projection behavior unless the step explicitly says otherwise.
- Each step should preserve all `LEGACY` renderer outputs unless the step explicitly says otherwise.
- Each step should produce code, tests, and any needed documentation updates, not just design notes.
- Do not broaden scope to other diagram types before the `ia_place_map` and `ui_contracts` SVG paths are proven.
- If a step reveals an architectural gap, fix the shared architecture first rather than patching the current view with one-off logic.

## How To Use Each Step In A Separate Thread

Each future implementation thread should:

1. restate the selected step and confirm its scope
2. inspect the current repository state and any changes since this plan was written
3. create a step-specific implementation plan
4. execute that plan
5. run the relevant verification
6. update docs if the implementation changes the documented architecture or workflow

## Sequence Overview

1. Backend-aware renderer plumbing
2. Internal renderer contracts and test harness
3. Shared theme, primitives, and text measurement
4. SVG backend foundation
5. Manual macro-layout strategy registry
6. ELK adapter and hybrid routing
7. `ia_place_map` scene builder and SVG implementation
8. `ia_place_map` hardening and preview integration
9. `ui_contracts` scene builder scaffolding
10. `ui_contracts` routing and balance implementation
11. Shared hardening after the first two views
12. Re-plan and execute the remaining views

## Step 1: Backend-Aware Renderer Plumbing

### Goal

Remove the assumption that SVG and PNG previews must come from DOT, while keeping current behavior unchanged and preserving all `LEGACY` renderer paths.

### Why This Step Exists

The new renderer cannot become first-class while preview capability, CLI preview routing, and rendered corpus generation still assume DOT as the only preview source, and while legacy backends are not clearly modeled as legacy backends.

### In Scope

- generalize renderer capability modeling so preview artifacts are backend-aware
- classify DOT, Graphviz preview, and Mermaid paths explicitly under `LEGACY` renderer handling
- isolate Graphviz-specific preview code as a legacy backend path
- preserve all current DOT, Mermaid, SVG, and PNG behavior
- keep corpus generation working with legacy outputs

### Out Of Scope

- new scene contracts
- new SVG backend
- ELK integration
- view-specific migration work

### Primary Deliverables

- backend-aware preview capability interfaces
- explicit `LEGACY` classification in renderer capability and backend terminology
- Graphviz preview path isolated behind a legacy backend boundary
- unchanged legacy behavior verified by existing tests and artifacts

### Done When

- legacy DOT and Mermaid outputs are unchanged
- legacy SVG and PNG previews still work
- preview routing no longer assumes DOT by architecture

## Step 2: Internal Renderer Contracts And Test Harness

### Goal

Introduce the renderer-owned internal forms described in the migration guidance:

- `RendererScene`
- `MeasuredScene`
- `PositionedScene`

### Why This Step Exists

Future work needs explicit contracts between scene construction, micro-layout, macro-layout, and backend rendering. Without those contracts, the implementation will drift back toward view-specific emitters.

### In Scope

- define the internal renderer contracts
- define renderer diagnostics for scene, measurement, layout, and routing failures
- add test harness support for snapshotting renderer-stage artifacts
- wire a no-op or stub path through the new stages without changing any view behavior yet

### Out Of Scope

- real text measurement
- real SVG generation
- real ELK placement
- migrating any view

### Primary Deliverables

- stable internal types or interfaces for the new stages
- renderer-stage snapshot test support
- clear separation between legacy backends and the new staged renderer path

### Done When

- the repo can represent the new renderer stages explicitly
- renderer-stage snapshots can be added in later steps
- no view has to bypass these contracts once migration begins

## Step 3: Shared Theme, Primitives, And Text Measurement

### Goal

Build the shared micro-layout substrate that all future SVG views will rely on.

### Why This Step Exists

The migration guidance treats text measurement and wrapping as shared infrastructure. This step is where that becomes real.

### In Scope

- define theme tokens that affect measurement and placement
- define shared renderer primitives such as `card`, `cluster`, `lane`, `header`, and `badge`
- implement width-band policy and overflow policy handling
- implement a `TextMeasurementService`
- ensure measurement uses vendored font assets and deterministic rules
- emit explicit overflow outcomes rather than silent clipping

### Out Of Scope

- macro-layout and routing
- ELK
- real view scene builders
- final SVG backend

### Primary Deliverables

- shared primitive library
- text measurement service
- micro-layout logic for intrinsic node sizing
- tests for wrapping, width escalation, overflow handling, and deterministic measurement

### Done When

- a scene node can be measured into a deterministic width, height, wrapped text, and overflow result
- measurement does not depend on character-count heuristics
- the same font assets can be used for both measurement and final rendering

## Step 4: SVG Backend Foundation

### Goal

Implement SVG as the first-class backend for `PositionedScene`.

### Why This Step Exists

The new renderer needs its own vector output path before any view can use it end-to-end.

### In Scope

- render `PositionedScene` to SVG
- support layered paint order, classes, markers, arrowheads, and embedded style hooks
- keep PNG as a rasterization step derived from SVG
- make SVG serialization deterministic

### Out Of Scope

- view-specific scene building
- macro-layout strategy implementation
- ELK integration

### Primary Deliverables

- SVG backend for positioned nodes, containers, labels, and routed edges
- deterministic SVG serialization tests
- PNG derivation still flowing from SVG

### Done When

- a hand-authored `PositionedScene` can render to stable SVG
- the backend is not responsible for text wrapping or layout
- PNG continues to derive from SVG rather than from a separate scene renderer

## Step 5: Manual Macro-Layout Strategy Registry

### Goal

Implement the first shared macro-layout strategies that do not require ELK.

### Why This Step Exists

Some diagram regions are better served by manual, deterministic layout strategies than by graph-layout engines. This is especially important for grid, strip, and lane semantics.

### In Scope

- implement a recursive layout strategy registry
- implement at minimum:
  - `stack`
  - `grid`
  - `lanes`
- handle container chrome, padding, and child ordering
- support explicit ports and anchor offsets
- support declared routing preferences, even if the full routing implementation comes later

### Out Of Scope

- ELK-backed layout
- migrated views
- solving the hardest container-edge routing cases

### Primary Deliverables

- strategy registry
- recursive placement for manual containers
- tests for deterministic placement and container-bound calculation

### Done When

- manual containers can place measured children deterministically
- container bounds and ports are resolved without SVG involvement
- the architecture can mix manual strategies with future ELK strategies

## Step 6: ELK Adapter And Hybrid Routing

### Goal

Add ELK-backed macro-layout and make it work alongside manual strategies.

### Why This Step Exists

The architecture depends on hybrid layouts, not on a single global layout engine.

### In Scope

- implement an ELK adapter for eligible scene subgraphs
- support `elk_layered` as the first ELK-backed strategy
- translate scene nodes, containers, ports, and edges into ELK input where appropriate
- translate ELK output back into `PositionedScene`
- integrate routing behavior for ELK-managed and manually-managed regions

### Out Of Scope

- full migration of any view
- defaulting every view to ELK
- polishing every routing edge case

### Primary Deliverables

- ELK-backed layout strategy
- hybrid layout support across manual and ELK-managed containers
- routing tests for mixed scenes

### Done When

- the renderer can lay out a hybrid scene with both manual and ELK-managed regions
- ports and connectors survive the round-trip cleanly
- ELK is a strategy implementation, not the renderer's primary scene format

## Step 7: `ia_place_map` Scene Builder And SVG Implementation

### Goal

Implement the new staged SVG renderer path for `ia_place_map`.

### Why This Step Exists

`ia_place_map` is one of the first two proof views and carries important hierarchical and indentation concerns that will validate the architecture.

### Key References

- `docs/toolchain/renderer_migration_guidance.md`
- `docs/Specific Layout Concerns per Diagram Type.md`, section `ia_place_map`

### Specific Layout Concerns To Satisfy

- horizontal top-level layout with clean vertical alignment
- no content visually above top-level nodes
- mixed top-level `Place` and `Area` handling
- vertical layout within `Area` containers
- rightward indentation for lower-level place hierarchy inside an area
- rightward indentation for top-level implicit lower-level place sequences
- visible node-type differentiation across profiles, including `simple`

### In Scope

- build the `ia_place_map` scene builder from projection to shared primitives
- choose the correct mix of manual and ELK strategies for IA structure
- implement the view's port and routing policy
- generate end-to-end SVG for `ia_place_map`
- add renderer-stage tests and SVG goldens for the view

### Out Of Scope

- switching default renderer behavior globally
- `ui_contracts`
- other diagram types

### Primary Deliverables

- `ia_place_map` scene builder
- end-to-end staged SVG renderer path for `ia_place_map`
- rendered examples and tests that prove the target layout behavior

### Done When

- `ia_place_map` renders to usable SVG through the new staged path
- the layout concerns listed above are materially addressed
- legacy outputs remain available in parallel

## Step 8: `ia_place_map` Hardening And Preview Integration

### Goal

Turn the new `ia_place_map` path into a fully exercised repo workflow rather than an isolated implementation.

### Why This Step Exists

The first view should prove not only the architecture, but also the operational integration around previews, artifacts, and review quality.

### In Scope

- integrate the new `ia_place_map` SVG path into CLI preview flows
- add or update rendered corpus generation for the new backend
- add visual review guidance specific to `ia_place_map`
- harden diagnostics and regressions found while exercising the new view

### Out Of Scope

- `ui_contracts`
- generalizing to all views

### Primary Deliverables

- CLI-accessible `ia_place_map` SVG preview path
- committed artifact coverage for the new backend where appropriate
- hardened regression coverage

### Done When

- the new `ia_place_map` path is easy to exercise in normal repo workflows
- regressions can be caught by tests or corpus checks rather than manual memory

## Step 9: `ui_contracts` Scene Builder Scaffolding

### Goal

Implement the structural scene-building layer for `ui_contracts` before tackling its hardest routing cases.

### Why This Step Exists

`ui_contracts` is one of the most complex views. It needs a structural pass first so later routing work has a stable scene to operate on.

### Key References

- `docs/toolchain/renderer_migration_guidance.md`
- `docs/Specific Layout Concerns per Diagram Type.md`, section `ui_contracts`

### Specific Layout Concerns To Satisfy In This Step

- support `Place` and `Component` nodes with nested state content
- introduce synthetic containers for `ViewState Graph` and `State Graph`
- handle very dense and very sparse place content without collapsing the scene model
- decide and implement an initial top-level placement bias for balance

### In Scope

- build the `ui_contracts` scene builder from projection to shared primitives
- represent synthetic state-graph containers explicitly in the scene
- map internal content onto shared primitives and width policies
- generate initial staged SVG for structural `ui_contracts` cases

### Out Of Scope

- solving all hard container-edge routing
- final polish of transition routing
- other diagram types

### Primary Deliverables

- `ui_contracts` scene builder
- structural SVG path for `ui_contracts`
- tests that prove the scene model can represent complex nested content

### Done When

- `ui_contracts` can render structurally through the new staged path
- synthetic state-graph containers exist as first-class scene elements
- the remaining hard work is mostly about routing and balance, not missing scene structure

## Step 10: `ui_contracts` Routing And Balance Implementation

### Goal

Solve the hard routing and balance problems that make `ui_contracts` a difficult view.

### Why This Step Exists

This is the step that proves the renderer can handle container-originated relationships and dense nested state graphs without degrading the surrounding layout.

### Key References

- `docs/toolchain/renderer_migration_guidance.md`
- `docs/Specific Layout Concerns per Diagram Type.md`, section `ui_contracts`

### Specific Layout Concerns To Satisfy

- `TRANSITIONS_TO` inside synthetic state containers should read as horizontal graphs with labeled connectors
- `EMITS`, `BINDS_TO`, and `DEPENDS_ON` may need to emerge from a container rather than a simple node
- those container-emergent relationships should interfere as little as possible with sibling grid placement
- top-level placement should retain visual balance despite extreme variation in place density

### In Scope

- implement container-origin routing support where needed
- refine transition graph layout and labeling inside synthetic state containers
- refine top-level balance strategy for dense and sparse places
- harden the end-to-end SVG output and tests for `ui_contracts`

### Out Of Scope

- migrating remaining diagram types
- changing SDD semantics

### Primary Deliverables

- end-to-end usable SVG rendering for `ui_contracts`
- routing and layout logic that handles the hard cases above
- regression coverage for dense and container-origin edge cases

### Done When

- `ui_contracts` renders to usable SVG through the new staged path
- the major hard cases from the concerns document are materially addressed
- view-specific fixes are implemented through shared layout or routing infrastructure wherever possible

## Step 11: Shared Hardening After The First Two Views

### Goal

Extract and stabilize the shared infrastructure revealed by `ia_place_map` and `ui_contracts`.

### Why This Step Exists

The first two views will surface missing primitives, missing diagnostics, and duplicated logic. Those need to be cleaned up before other views are attempted.

### In Scope

- extract duplicated logic into shared primitives, layout strategies, routing helpers, or diagnostics
- simplify or regularize view builders where the shared system is now strong enough
- tighten documentation and test coverage based on real migration lessons
- decide whether any architecture updates are needed before expanding to other views

### Out Of Scope

- migrating additional views
- changing the language or projection semantics

### Primary Deliverables

- cleaner shared renderer infrastructure
- reduced view-specific duplication
- updated docs reflecting any architecture refinements

### Done When

- the first two migrated views do not depend on obviously duplicated generic logic
- the renderer architecture is stronger after the first-wave implementations than it was before them

## Step 12: Re-Plan And Execute The Remaining Views

### Goal

Use the proven architecture from the first two views to plan and migrate the remaining diagram types.

### Why This Step Exists

The remaining views should benefit from the lessons of the first wave rather than being forced into an early, speculative sequence now.

### In Scope

- review lessons from steps 1 through 11
- choose the next migration order for the remaining views
- create a second-wave master plan or a sequence of view-specific implementation steps
- begin execution only after that re-plan is accepted

### Recommended Next Candidates

- `service_blueprint`, because it aligns well with manual lane and grid strategies
- `journey_map`, because it should benefit from shared lane and strip infrastructure
- `outcome_opportunity_map`, because it can likely reuse lane plus routing patterns
- `scenario_flow`, because its branching and routing complexity may make it a better late-stage migration

### Out Of Scope

- assuming the first-wave lessons in advance
- migrating all remaining views in a single step

### Primary Deliverables

- a second-wave migration sequence grounded in the first-wave results
- if approved, the first executed migration step for the next view

### Done When

- the remaining view order is based on proven architecture rather than early guesswork
- the next-wave work can proceed without destabilizing the first two migrated views

## Review Gates

Use these review points to decide whether to continue as planned or adjust:

- after Step 4: confirm the staged renderer can produce SVG from `PositionedScene`
- after Step 6: confirm hybrid manual plus ELK layout is viable before migrating views
- after Step 8: confirm `ia_place_map` proves the architecture rather than just a special-case implementation
- after Step 10: confirm `ui_contracts` proves the hardest routing and balance cases
- after Step 11: confirm the shared architecture is ready for broader rollout

## Success Condition For The First Wave

The first wave is successful when all of the following are true:

- `ia_place_map` renders to usable SVG through the new staged renderer path
- `ui_contracts` renders to usable SVG through the new staged renderer path
- both views rely on shared measurement, layout, and backend infrastructure rather than isolated emitters
- legacy DOT and Mermaid outputs still exist in parallel
- the repo has enough tests, artifacts, and documentation to continue migration view by view with confidence
