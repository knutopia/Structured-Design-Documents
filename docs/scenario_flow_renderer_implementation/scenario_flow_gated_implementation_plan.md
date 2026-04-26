# Scenario Flow Staged Renderer Gated Implementation Plan

Status: active gated implementation plan for `docs/scenario_flow_renderer_implementation/scenario_flow_renderer_design.md`

Audience: orchestration threads and sequential implementation sub-agents

Purpose: implement custom staged `scenario_flow` rendering through gated work, one gate at a time, with explicit authority, write scopes, proof tasks, verification, and stop conditions.

## 1. Summary

This plan turns `scenario_flow_renderer_design.md` into an implementation sequence.

The implementation target is a custom staged renderer for `scenario_flow`:

- no Elk and no external layout engine
- staged pipeline remains `Projection -> RendererScene -> MeasuredScene -> PositionedScene -> SVG -> PNG`
- the proof case is `bundle/v0.1/examples/scenario_branching.sdd`
- service-blueprint renderer structure guides middle-layer design, node-edge ports, gutter-aware routing, debug outputs, diagnostics, and acceptance language
- legacy Graphviz remains available until staged `scenario_flow` is acceptance-ready

This plan must be executed gate by gate. A later gate must not begin until the orchestration thread verifies the previous gate against its acceptance criteria and stop conditions.

## 2. Source Evidence

The implementation must use these sources by role:

| Role | Source |
| --- | --- |
| Design authority for this plan | `docs/scenario_flow_renderer_implementation/scenario_flow_renderer_design.md` |
| Repo-wide renderer constraints | `AGENTS.md` |
| View scope and bundle-owned defaults | `bundle/v0.1/core/views.yaml` |
| Proof-case source | `bundle/v0.1/examples/scenario_branching.sdd` |
| Proof-case projection snapshot | `bundle/v0.1/snapshots/scenario_branching.scenario_flow.projection.json` |
| Projection builder | `src/projector/scenarioFlow.ts` |
| Existing render model | `src/renderer/scenarioFlowRenderModel.ts` |
| Staged renderer contracts | `src/renderer/staged/contracts.ts` |
| Shared staged scene builders | `src/renderer/staged/sceneBuilders.ts` |
| Shared staged pipeline | `src/renderer/staged/pipeline.ts` |
| Shared staged measurement/layout/routing | `src/renderer/staged/microLayout.ts`, `src/renderer/staged/macroLayout.ts`, `src/renderer/staged/routing.ts` |
| Staged SVG/PNG backend | `src/renderer/staged/svgBackend.ts` |
| Service-blueprint implementation exemplar | `src/renderer/staged/serviceBlueprint.ts`, `src/renderer/staged/serviceBlueprintMiddleLayer.ts`, `src/renderer/staged/serviceBlueprintRouting.ts` |
| Service-blueprint routing and visual rules | `docs/service_blueprint_renderer_implementation/Service Blueprint Routing Rules.md`, `docs/service_blueprint_renderer_implementation/reference/Service Blueprint Reference Design Notes.md` |
| Preview backend registry | `src/renderer/previewBackends.ts`, `src/renderer/renderArtifacts.ts`, `src/renderer/viewRenderers.ts` |
| Rendered corpus generation | `src/examples/generateRenderedExamples.ts`, `src/examples/renderedCorpus.ts` |

## 3. Non-Negotiable Invariants

1. `scenario_flow` must not use Elk or any external layout engine for staged placement or routing.
2. Projection remains the semantic boundary.
3. Parser, compiler, validator, and projection behavior are out of scope unless a gate explicitly stops on a design gap.
4. Bundle-owned view defaults stay bundle-owned.
5. `RendererScene` must not contain final x/y coordinates, route polylines, SVG strings, DOT text, Mermaid text, or external layout JSON.
6. Proof-case structure must match `scenario_flow_renderer_design.md` before snapshots or rendered artifacts are refreshed.
7. Debug artifacts must exist for pre-routing, step-2 endpoints/templates, and step-3 gutters/occupancy.
8. Staged SVG is the vector truth source; PNG is derived from SVG.
9. Legacy Graphviz preview must remain explicitly selectable after staged preview registration.
10. A gate is not accepted just because tests pass. The cited invariants must also be satisfied.

## 4. Orchestration Thread Protocol

The orchestration thread owns sequencing, verification, and handoff. It may delegate implementation to one sub-agent per gate, but it must not let two gates proceed concurrently.

### 4.1 Required Orchestrator Behavior

For each gate:

1. Re-read this plan section and the scenario-flow design doc.
2. Re-inspect the source files listed in the gate before spawning the sub-agent.
3. Spawn exactly one implementation sub-agent for the gate.
4. Tell the sub-agent that they are not alone in the codebase and must not revert unrelated edits.
5. Give the sub-agent the gate goal, read scope, write scope, forbidden scope, invariants, proof tasks, verification commands, and stop conditions.
6. Require the sub-agent to stop and report if a stop condition is hit.
7. Review the sub-agent's diff before running verification.
8. Run the gate verification commands with `TMPDIR=/tmp` where tests or temporary files are involved.
9. Manually check the gate acceptance criteria against the diff and output.
10. Record satisfied invariants, violated invariants, tests run, and skipped verification with exact reasons.
11. Spawn the next gate only after the current gate is accepted.

### 4.2 Gate Handoff Checklist

The orchestration thread may hand off to the next gate only when all items are true:

- the sub-agent stayed inside the gate write scope
- the diff contains no unrelated refactor
- required source files were read or re-read in the sub-agent thread
- proof tasks are implemented or explicitly proven unnecessary by direct source evidence
- verification commands passed, or skipped commands have a concrete environment reason
- acceptance criteria are satisfied by source, tests, docs, and artifacts where relevant
- no stop condition remains unresolved
- the gate final note names satisfied and violated invariants

If any checklist item fails, keep the same gate open and repair or report the blocker. Do not spawn the next gate.

## 5. Gate Sequence Overview

1. Gate 0: Baseline And Authority Inventory
2. Gate 1: Design-Doc Closeout And Doc Authority Alignment
3. Gate 2: Middle-Layer Contract And Proof-Case Placement Tests
4. Gate 3: RendererScene Builder And Pre-Routing Debug Artifact
5. Gate 4: Custom Routing Stages And Gutter Diagnostics
6. Gate 5: SVG/PNG Staged Backend Wiring And Preview Backend Registration
7. Gate 6: Snapshot/Golden Refresh After Acceptance Only
8. Gate 7: Rendered Corpus, CLI, And Docs Promotion From Preview-Only
9. Gate 8: Final Visual Acceptance And Cleanup

## 6. Gate 0 [Done]: Baseline And Authority Inventory

### Goal

Confirm current repository state before implementation.

### Read Scope

- `docs/scenario_flow_renderer_implementation/scenario_flow_renderer_design.md`
- `AGENTS.md`
- `bundle/v0.1/core/views.yaml`
- `bundle/v0.1/examples/scenario_branching.sdd`
- `bundle/v0.1/snapshots/scenario_branching.scenario_flow.projection.json`
- `src/projector/scenarioFlow.ts`
- `src/renderer/scenarioFlowRenderModel.ts`
- `src/renderer/staged/contracts.ts`
- `src/renderer/staged/serviceBlueprint.ts`
- `src/renderer/staged/serviceBlueprintMiddleLayer.ts`
- `src/renderer/staged/serviceBlueprintRouting.ts`
- `docs/toolchain/renderer_migration_guidance.md`

### Write Scope

No file edits.

### Forbidden Scope

- no source edits
- no generated artifact refresh
- no snapshot updates

### Proof Tasks

1. Record the current `scenario_flow` view scope and renderer defaults from `views.yaml`.
2. Record the proof-case projection's decision nodes and branch labels.
3. Record current preview capability for `scenario_flow`.
4. Record any current docs that still recommend Elk or `elk_layered` for `scenario_flow`.
5. Record the exact code paths that will be touched by later gates.

### Verification Commands

```bash
git status --short
TMPDIR=/tmp pnpm exec vitest run tests/viewProjectionSemantics.spec.ts tests/render_profile_display.spec.ts tests/viewRenderers.spec.ts
```

### Stop Conditions

Stop if:

- current projection output differs from the expected proof-case semantics in the design doc
- there are uncommitted changes in later gate write scopes that the orchestrator cannot safely distinguish
- repo docs or code reveal a newer scenario-flow design that conflicts with this plan

### Acceptance Criteria

- no files changed
- baseline findings are recorded in the gate final note
- next gate write scopes remain viable

### Completion Summary

Gate 0 accepted on 2026-04-25. The baseline confirmed that `scenario_flow`
scope and renderer defaults are bundle-owned in `bundle/v0.1/core/views.yaml`,
the proof-case projection matches the design decision nodes and branch labels,
and current preview capability remains legacy DOT/Mermaid plus explicit
`legacy_graphviz_preview` SVG/PNG. The only stale Elk guidance found is in
`docs/toolchain/renderer_migration_guidance.md`; no files were changed by the
gate worker. Verification passed with
`TMPDIR=/tmp pnpm exec vitest run tests/viewProjectionSemantics.spec.ts tests/render_profile_display.spec.ts tests/viewRenderers.spec.ts`.

## 7. Gate 1 [Done]: Design-Doc Closeout And Doc Authority Alignment

### Goal

Align active documentation authority before code changes begin.

### Read Scope

- `docs/scenario_flow_renderer_implementation/scenario_flow_renderer_design.md`
- `docs/toolchain/renderer_migration_guidance.md`
- `docs/toolchain/architecture.md`
- `docs/toolchain/development.md`
- `docs/readme_support_docs/diagram_types/README.md`

### Write Scope

- `docs/scenario_flow_renderer_implementation/scenario_flow_renderer_design.md`
- `docs/toolchain/renderer_migration_guidance.md`

### Forbidden Scope

- no TypeScript code changes
- no preview backend changes
- no corpus or snapshot updates
- no promotion of `scenario_flow` out of preview-only status

### Proof Tasks

1. Remove or revise the outdated guidance that `scenario_flow` likely benefits from `elk_layered`.
2. Ensure the active design doc explicitly says no Elk and no external layout engine.
3. Ensure the design doc still names the proof-case placement table and acceptance gates.
4. Keep architecture/development docs unchanged unless they would otherwise contradict the design before implementation.

### Verification Commands

```bash
rg "scenario_flow.*elk|elk_layered.*scenario|external layout" docs/scenario_flow_renderer_implementation docs/toolchain/renderer_migration_guidance.md
git diff --check
```

### Stop Conditions

Stop if:

- resolving the outdated Elk guidance requires changing broader renderer migration policy
- another doc claims active authority over `scenario_flow` staged layout and conflicts with this design

### Acceptance Criteria

- active docs no longer direct implementers toward Elk for `scenario_flow`
- no behavior is changed
- design authority remains clear

### Completion Summary

Gate 1 accepted on 2026-04-25. The migration guidance no longer recommends
`elk_layered` for scenario branches or `scenario_flow`; it now points to the
active custom staged lane-and-band design and explicitly prohibits Elk or other
external layout engines for staged placement and routing. The design document
retains the proof-case placement table and acceptance gates, and no code,
backend, corpus, snapshot, or preview-status files were changed. Verification
passed with the Gate 1 `rg` drift check and `git diff --check`; remaining
matches are no-Elk/no-external-layout assertions or gated-plan references.

## 8. Gate 2 [Done]: Middle-Layer Contract And Proof-Case Placement Tests

### Goal

Introduce the renderer-owned middle-layer contract and prove proof-case semantic placement without rendering SVG.

### Read Scope

- `docs/scenario_flow_renderer_implementation/scenario_flow_renderer_design.md`
- `src/renderer/scenarioFlowRenderModel.ts`
- `src/renderer/staged/serviceBlueprintMiddleLayer.ts`
- `tests/serviceBlueprintMiddleLayer.spec.ts`
- `bundle/v0.1/examples/scenario_branching.sdd`
- `bundle/v0.1/core/views.yaml`

### Write Scope

- new `src/renderer/staged/scenarioFlowMiddleLayer.ts`
- new focused test file for scenario-flow middle-layer behavior
- minimal exported types only if needed by the new middle-layer tests

### Forbidden Scope

- no staged scene builder yet
- no routing implementation
- no preview backend registration
- no snapshot or rendered artifact updates
- no parser/compiler/validator/projection changes

### Proof Tasks

1. Define bands, tracks, lane guides, cells, node placements, middle edges, and diagnostics.
2. Consume `ScenarioFlowRenderModel`; do not consume raw source text.
3. Place the proof case exactly as:
   - `C1/T0`: `J-030`, `P-030`, `VS-030a`
   - `C2/T0`: `J-031`, `P-031`, `VS-031a`
   - `C2/T1`: `J-032`, `P-032`, `VS-032a`
   - `C3/T0`: `J-033`, `P-033`, `VS-033a`
   - `C4/T0`: `J-034`, `P-034`, `VS-034a`
   - `C4/T1`: `J-035`, `P-035`, `VS-035a`
4. Classify edge channels as `step_flow`, `place_navigation`, `view_transition`, and `realization`.
5. Emit diagnostics for degraded cases such as missing Step spine, disconnected scoped nodes, or cycles.

### Verification Commands

```bash
TMPDIR=/tmp pnpm exec vitest run tests/render_profile_display.spec.ts tests/viewProjectionSemantics.spec.ts <new-scenario-middle-layer-test>
TMPDIR=/tmp pnpm run build
```

### Stop Conditions

Stop if:

- proof-case placement cannot be derived without changing projection behavior
- branch-track semantics require bundle fields that do not exist
- the middle layer starts reconstructing semantics from DOT, Mermaid, SVG, or CSS classes

### Acceptance Criteria

- proof-case middle-layer placement matches the design table
- diagnostics are deterministic
- no rendering path changes yet

### Completion Summary

Gate 2 accepted on 2026-04-25. Added the renderer-owned
`scenarioFlowMiddleLayer` contract with semantic bands, tracks, lane guides,
cells, placements, normalized middle edges, connector-plan metadata, and
deterministic diagnostics. `ScenarioFlowRenderModel` now exposes only the
minimal internal metadata needed by the middle layer, including node type and
author order plus edge id, type, author order, and branch-label source. The
proof case places exactly at `C1/T0`, `C2/T0`, `C2/T1`, `C3/T0`, `C4/T0`, and
`C4/T1`; edge channels normalize to `step_flow`, `place_navigation`,
`view_transition`, and `realization`. Verification passed with
`TMPDIR=/tmp pnpm exec vitest run tests/render_profile_display.spec.ts tests/viewProjectionSemantics.spec.ts tests/scenarioFlowMiddleLayer.spec.ts`,
`TMPDIR=/tmp pnpm run build`, and `git diff --check`.

## 9. Gate 3 [Done]: RendererScene Builder And Pre-Routing Debug Artifact

### Goal

Build the staged `RendererScene`, measure and place nodes, decorate lanes, and emit pre-routing debug SVG/PNG without semantic edges.

### Read Scope

- `src/renderer/staged/scenarioFlowMiddleLayer.ts`
- `src/renderer/staged/serviceBlueprint.ts`
- `src/renderer/staged/serviceBlueprintDecorations.ts`
- `src/renderer/staged/sceneBuilders.ts`
- `src/renderer/staged/contracts.ts`
- `src/renderer/staged/svgBackend.ts`
- `tests/serviceBlueprintPreRouting.spec.ts`
- `tests/stagedServiceBlueprint.spec.ts`

### Write Scope

- new `src/renderer/staged/scenarioFlow.ts`
- optional new `src/renderer/staged/scenarioFlowDecorations.ts`
- scenario-flow staged pre-routing tests
- staged contract metadata additions only if typed metadata is needed

### Forbidden Scope

- no final routing implementation
- no preview backend registration
- no rendered corpus changes
- no snapshot refresh outside the new pre-routing proof files
- no broad SVG backend styling refactor

### Proof Tasks

1. Build `buildScenarioFlowRendererScene(...)`.
2. Add explicit ports for flow, mirror flow, and realization.
3. Build invisible cell containers and semantic nodes using shared staged primitives.
4. Add lane labels and light lane separators.
5. Add `renderScenarioFlowPreRoutingArtifacts(...)` returning renderer scene, measured scene, pre-routing positioned scene, SVG, PNG, and diagnostics.
6. Assert no semantic edges appear in the pre-routing positioned scene.

### Verification Commands

```bash
TMPDIR=/tmp pnpm exec vitest run <new-scenario-middle-layer-test> <new-scenario-pre-routing-test>
TMPDIR=/tmp pnpm run build
```

### Stop Conditions

Stop if:

- fixed proof-case placement requires final coordinates in `RendererScene`
- shared grid/stack layout cannot express the needed layout without a shared layout extension
- diamond shape support becomes necessary and cannot be added without SVG string hacks

### Acceptance Criteria

- pre-routing proof-case nodes are in correct lanes, bands, and tracks
- cells remain invisible or visually subordinate in normal output
- lane decorations render deterministically
- no semantic routes are drawn in the pre-routing artifact

### Completion Summary

Gate 3 accepted on 2026-04-25. Added staged `scenario_flow` scene
construction and pre-routing artifact rendering, with typed scenario-flow
metadata in staged contracts, explicit node ports for flow, mirror flow, and
realization, invisible `stack` cell containers, and deterministic lane labels
and separators. The root grid keeps chronology bands as columns and branch
tracks as vertical sub-rows through empty placeholder cells, without final
coordinates in `RendererScene`. `renderScenarioFlowPreRoutingArtifacts(...)`
returns the renderer scene, measured scene, pre-routing positioned scene, SVG,
PNG, diagnostics, and middle-layer evidence; the positioned pre-routing artifact
omits semantic edges. Verification passed with
`TMPDIR=/tmp pnpm exec vitest run tests/scenarioFlowMiddleLayer.spec.ts tests/scenarioFlowPreRouting.spec.ts`,
`TMPDIR=/tmp pnpm run build`, and `git diff --check`.

## 10. Gate 4 [Done]: Custom Routing Stages And Gutter Diagnostics

### Goal

Implement custom scenario-flow routing stages and debug artifacts.

### Read Scope

- `docs/scenario_flow_renderer_implementation/scenario_flow_renderer_design.md`
- `src/renderer/staged/scenarioFlow.ts`
- `src/renderer/staged/serviceBlueprintRouting.ts`
- `src/renderer/staged/routing.ts`
- `tests/stagedServiceBlueprint.spec.ts`
- `tests/stagedVisualHarness.ts`

### Write Scope

- new `src/renderer/staged/scenarioFlowRouting.ts`
- `src/renderer/staged/scenarioFlow.ts`
- scenario-flow routing tests
- shared visual harness extensions only if needed for scenario-flow assertions

### Forbidden Scope

- no Elk or external layout engine
- no preview backend registration
- no generated corpus changes
- no broad rewrite of shared routing
- no changes to service-blueprint routing unless a shared helper extraction is tiny and behavior-preserving

### Proof Tasks

1. Build connector plans ordered by `PRECEDES`, `NAVIGATES_TO`, `TRANSITIONS_TO`, `REALIZED_BY`.
2. Resolve endpoint sides and node-edge buckets.
3. Build step-2 routes from templates.
4. Build step-3 gutter occupancy and obstacle swerves.
5. Build final routes with global gutter expansion where needed.
6. Place branch labels after final route geometry.
7. Emit diagnostics for unresolved ports, fallback routes, node intersections, and label fallback.
8. Add `renderScenarioFlowRoutingDebugArtifacts(...)` with step-2 and step-3 SVG/PNG outputs.

### Verification Commands

```bash
TMPDIR=/tmp pnpm exec vitest run <new-scenario-routing-test> <new-scenario-pre-routing-test>
TMPDIR=/tmp pnpm run build
```

### Stop Conditions

Stop if:

- route generation requires using Elk
- final routes cross non-endpoint node boxes in the proof case
- labels can only be made readable by hardcoded proof-case coordinates
- routing duplicates placement semantics instead of consuming the middle layer

### Acceptance Criteria

- proof-case routes use explicit node-edge endpoints
- Step `PRECEDES` connectors have priority and clearer geometry than explanatory realization connectors
- Place and ViewState mirror connectors do not overpower Step flow
- no non-endpoint node box intersections remain
- step-2 and step-3 debug artifacts are available

### Completion Summary

Gate 4 accepted on 2026-04-25. Added custom `scenario_flow` routing stages
without Elk or external layout: connector plans are ordered by channel priority
and middle-layer lane/band/track metadata, endpoints resolve through explicit
node ports, step-2 routes use deterministic templates, step-3 records gutter
and obstacle occupancy, and final routes place branch labels after geometry.
`renderScenarioFlowRoutingDebugArtifacts(...)` now returns step-2 and step-3
positioned scenes plus SVG/PNG debug outputs, and staged final SVG/PNG render
functions are available for later backend registration. Proof-case tests verify
priority, mirror-routing behavior, profile-aware branch labels, debug artifacts,
and no non-endpoint node-box intersections. Verification passed with
`TMPDIR=/tmp pnpm exec vitest run tests/scenarioFlowRouting.spec.ts tests/scenarioFlowPreRouting.spec.ts`,
`TMPDIR=/tmp pnpm run build`, and `git diff --check`.

## 11. Gate 5 [Done]: SVG/PNG Staged Backend Wiring And Preview Backend Registration

### Goal

Register staged `scenario_flow` SVG/PNG preview while preserving legacy Graphviz.

### Read Scope

- `src/renderer/staged/scenarioFlow.ts`
- `src/renderer/previewBackends.ts`
- `src/renderer/renderArtifacts.ts`
- `src/renderer/viewRenderers.ts`
- `tests/viewRenderers.spec.ts`
- `tests/cli.spec.ts`
- `src/renderer/staged/svgBackend.ts`

### Write Scope

- `src/renderer/previewBackends.ts`
- `src/renderer/renderArtifacts.ts`
- `src/renderer/viewRenderers.ts`
- CLI and capability tests for staged scenario-flow preview
- `src/renderer/staged/svgBackend.ts` only for narrow scenario-flow styling or supported node shape rendering

### Forbidden Scope

- no rendered corpus refresh
- no removal of legacy preview
- no DOT/Mermaid behavior changes
- no promotion docs beyond backend availability

### Proof Tasks

1. Add `staged_scenario_flow_preview` as a preview backend id.
2. Register staged SVG and PNG render functions.
3. Make staged preview the default for `scenario_flow` only after Gate 4 acceptance.
4. Preserve explicit `legacy_graphviz_preview`.
5. Keep text artifacts on `legacy_dot` and `legacy_mermaid`.
6. Add tests proving default and explicit legacy backend behavior.

### Verification Commands

```bash
TMPDIR=/tmp pnpm exec vitest run tests/viewRenderers.spec.ts tests/cli.spec.ts <new-scenario-routing-test>
TMPDIR=/tmp pnpm run build
```

### Stop Conditions

Stop if:

- staged output is not acceptance-ready but default backend promotion is required for tests
- legacy preview cannot remain selectable
- backend registration requires changing public text render contracts

### Acceptance Criteria

- `scenario_flow` supports staged SVG and PNG preview
- legacy Graphviz remains explicitly selectable
- DOT/Mermaid outputs remain unchanged

### Completion Summary

Gate 5 accepted on 2026-04-25. Added `staged_scenario_flow_preview` to the
preview backend id set, registered staged SVG/PNG projection-source rendering,
and made staged SVG/PNG the default `scenario_flow` preview while preserving
explicit `legacy_graphviz_preview`. DOT and Mermaid text artifacts remain on
`legacy_dot` and `legacy_mermaid`, and `--dot-out` still auto-selects the
legacy DOT-backed backend. Verification passed with
`TMPDIR=/tmp pnpm exec vitest run tests/viewRenderers.spec.ts tests/cli.spec.ts tests/scenarioFlowRouting.spec.ts`,
`TMPDIR=/tmp pnpm run build`, and `git diff --check`. Additional smoke checks
rendered staged `scenario_flow` SVG and PNG through `pnpm sdd show` to
`/tmp/scenario_flow_gate5.svg` and `/tmp/scenario_flow_gate5.png`.

## 12. Gate 6 [Done]: Snapshot/Golden Refresh After Acceptance Only

### Goal

Capture staged renderer evidence only after proof-case placement and routing acceptance pass.

### Read Scope

- scenario-flow staged tests from Gates 2-5
- `tests/rendererStageSnapshotHarness.ts`
- `tests/goldens/renderer-stages/`
- current proof-case staged outputs

### Write Scope

- scenario-flow renderer-stage goldens under `tests/goldens/renderer-stages/`
- scenario-flow snapshot tests

### Forbidden Scope

- no implementation logic changes except tiny test harness fixes
- no rendered corpus refresh
- no service-blueprint or IA golden refresh
- no snapshot update to hide failed acceptance

### Proof Tasks

1. Add renderer-scene, measured-scene, final positioned-scene snapshots.
2. Add step-2 and step-3 positioned-scene snapshots.
3. Add final staged SVG snapshot.
4. Add step-2 and step-3 debug SVG snapshots.
5. Confirm snapshots encode the accepted proof-case behavior.

### Verification Commands

```bash
TMPDIR=/tmp pnpm exec vitest run <new-scenario-staged-test>
TMPDIR=/tmp pnpm run build
```

### Stop Conditions

Stop if:

- proof-case acceptance is not already satisfied
- snapshots differ because routes are unstable
- snapshot refresh would normalize collisions, fallback diagnostics, or wrong band/track placement

### Acceptance Criteria

- scenario-flow stage snapshots are deterministic
- snapshots are evidence of accepted behavior, not substitutes for acceptance

### Completion Summary

Gate 6 accepted on 2026-04-25. Added a focused staged `scenario_flow` snapshot
test for `scenario_branching` strict profile and eight scenario-flow
renderer-stage goldens: renderer scene, measured scene, final positioned scene,
step-2 positioned scene, step-3 positioned scene, final SVG, step-2 SVG, and
step-3 SVG. The snapshots encode the accepted placement, routing, label,
metadata, class, and diagnostics behavior without refreshing unrelated
goldens or rendered corpus artifacts. Verification passed with
`TMPDIR=/tmp pnpm exec vitest run tests/stagedScenarioFlow.spec.ts` twice,
`TMPDIR=/tmp pnpm run build`, and `git diff --check`.

## 13. Gate 7 [Done]: Rendered Corpus, CLI, And Docs Promotion From Preview-Only

### Goal

Promote staged `scenario_flow` through generated examples and user-facing docs after staged preview is accepted.

### Read Scope

- `src/examples/renderedCorpus.ts`
- `src/examples/generateRenderedExamples.ts`
- `tests/renderedCorpus.spec.ts`
- `examples/rendered/v0.1/README.md`
- `docs/toolchain/architecture.md`
- `docs/toolchain/development.md`
- `docs/readme_support_docs/diagram_types/README.md`

### Write Scope

- rendered corpus generator code and tests
- generated scenario-flow rendered example artifacts
- relevant docs that describe preview readiness

### Forbidden Scope

- no renderer logic changes
- no unrelated rendered example refresh
- no broad README rewrite
- no removal of legacy Graphviz artifacts unless explicitly designed

### Proof Tasks

1. Remove `scenario_flow` from preview-only corpus labeling when staged output is accepted.
2. Generate default staged SVG/PNG corpus artifacts.
3. Preserve or document legacy Graphviz siblings as appropriate.
4. Update docs to describe staged `scenario_flow` preview path.
5. Update CLI/development examples if default backend behavior changed.

### Verification Commands

```bash
TMPDIR=/tmp pnpm run generate:rendered-examples
TMPDIR=/tmp pnpm exec vitest run tests/renderedCorpus.spec.ts tests/cli.spec.ts tests/viewRenderers.spec.ts
TMPDIR=/tmp pnpm run build
```

### Stop Conditions

Stop if:

- generated scenario-flow artifacts reveal visual regression not caught by tests
- generated corpus would refresh unrelated diagrams unexpectedly
- docs would claim preview readiness before visual acceptance is complete

### Acceptance Criteria

- rendered corpus reflects the staged backend accurately
- docs no longer describe `scenario_flow` as planned or preview-only if promoted
- no unrelated corpus churn occurs

### Completion Summary

Gate 7 accepted on 2026-04-25. Removed `scenario_flow` from preview-only
rendered corpus labeling, regenerated the expected scenario-flow corpus move to
`scenario_flow_diagram_type/`, and added staged default SVG/PNG artifacts,
legacy Graphviz backend-suffixed SVG/PNG siblings, and debug siblings for
`pre_routing`, `routing_step_2_edges`, and `routing_step_3_gutters`. Updated the
corpus generator, rendered-corpus tests, generated corpus README, architecture
docs, development docs, and diagram-type support docs to reflect staged
scenario-flow preview readiness while keeping `journey_map` and
`outcome_opportunity_map` preview-only. Verification passed with
`TMPDIR=/tmp pnpm run generate:rendered-examples`,
`TMPDIR=/tmp pnpm exec vitest run tests/renderedCorpus.spec.ts tests/cli.spec.ts tests/viewRenderers.spec.ts`,
`TMPDIR=/tmp pnpm run build`, and `git diff --check`; rendered corpus churn was
limited to the expected scenario-flow move and README update.

## 14. Gate 8 [Done]: Final Visual Acceptance And Cleanup

### Goal

Run final acceptance checks, remove stale migration wording, and close the implementation.

### Read Scope

- all scenario-flow staged implementation files
- scenario-flow tests and goldens
- `tests/stagedVisualAcceptance.spec.ts`
- `tests/stagedVisualHarness.ts`
- `docs/scenario_flow_renderer_implementation/scenario_flow_renderer_design.md`
- `docs/scenario_flow_renderer_implementation/scenario_flow_gated_implementation_plan.md`
- `docs/toolchain/architecture.md`
- `docs/toolchain/development.md`
- `docs/toolchain/renderer_migration_guidance.md`

### Write Scope

- visual acceptance tests
- narrow cleanup in scenario-flow staged files
- docs closeout updates

### Forbidden Scope

- no new features
- no broad shared renderer refactor
- no late projection changes
- no snapshot refresh unless a prior accepted deterministic output changed due to intentional cleanup

### Proof Tasks

1. Add or update visual acceptance tests for staged `scenario_flow`.
2. Confirm no forbidden diagnostics appear for the proof case.
3. Confirm no semantic route intersects non-endpoint node boxes.
4. Confirm labels do not overlap node boxes or other labels in the proof case.
5. Confirm profile display behavior for branch labels remains covered.
6. Remove stale comments or docs that imply Elk is expected for `scenario_flow`.
7. Record final satisfied and violated invariants.

### Verification Commands

```bash
TMPDIR=/tmp pnpm exec vitest run <new-scenario-tests> tests/stagedVisualAcceptance.spec.ts tests/viewRenderers.spec.ts tests/cli.spec.ts tests/renderedCorpus.spec.ts
TMPDIR=/tmp pnpm test
TMPDIR=/tmp pnpm run build
```

### Stop Conditions

Stop if:

- full test run passes but visual acceptance invariants fail
- any route or label acceptance issue requires speculative tuning
- cleanup changes behavior outside `scenario_flow` without explicit proof

### Acceptance Criteria

- staged `scenario_flow` is acceptance-ready
- docs, backend registration, corpus, and tests agree on the current status
- no unresolved stop condition remains

### Completion Summary

Gate 8 accepted on 2026-04-26. Added `scenario_flow` support to the staged
visual acceptance harness and a proof-case visual acceptance test for
`scenario_branching.sdd` under the strict profile. The test verifies no
forbidden routing diagnostics, no error diagnostics, no semantic route
intersections with non-endpoint node boxes, and no branch-label overlap with
node boxes or other branch labels; existing scenario-flow routing tests continue
to cover strict, permissive, and simple branch-label display behavior. Active
toolchain and strategic docs now agree that `scenario_flow` is a staged,
preview-ready view while `journey_map` and `outcome_opportunity_map` remain
preview-only. Verification passed with the focused Gate 8 Vitest suite,
`TMPDIR=/tmp pnpm run build`, `git diff --check`, and full
`TMPDIR=/tmp pnpm test`.

## 15. Final Closeout Criteria

The overall implementation is complete only when:

- all gates are accepted in order
- no gate has unresolved stop conditions
- proof-case placement matches the design table
- staged SVG/PNG preview works without Elk or external layout
- legacy Graphviz preview remains selectable
- branch labels obey profile display policy
- debug artifacts exist for pre-routing, step 2, and step 3
- visual acceptance tests pass
- documentation no longer points implementers toward Elk for `scenario_flow`
- final notes name satisfied invariants, violated invariants, tests run, and any remaining risk
