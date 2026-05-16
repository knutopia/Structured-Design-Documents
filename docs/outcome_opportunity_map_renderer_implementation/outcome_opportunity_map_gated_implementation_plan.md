# Outcome-Opportunity Map Staged Renderer Gated Implementation Plan

Status: completed gated implementation plan for `docs/outcome_opportunity_map_renderer_implementation/outcome_opportunity_map_renderer_design.md`

Audience: orchestration threads and sequential implementation subagents

Purpose: implement custom staged `outcome_opportunity_map` rendering through gated work, one gate at a time, with explicit authority, write scopes, proof tasks, verification, and stop conditions.

Note: the gate sections preserve the historical entry criteria and baseline state that each gate used during execution.

## 1. Summary

This plan turns `outcome_opportunity_map_renderer_design.md` into an implementation sequence.

The implementation target is a custom staged renderer for `outcome_opportunity_map`:

- no Elk, no ELK adapter, no Graphviz, no Mermaid, and no external layout engine for staged node placement or connector routing
- staged pipeline remains `Projection -> RendererScene -> MeasuredScene -> PositionedScene -> SVG -> PNG`
- semantic columns are fixed left-to-right: `Initiatives`, `Opportunities`, `Outcomes`, `Metrics`
- outcome bands are the primary vertical anchors; parking bands are terminal fallback rows
- routing must include explicit ports, endpoint offsets, keyed occupancy, segment separation, global gutter expansion, final label placement, and diagnostics from the first accepted routing implementation
- debug outputs must exist for `pre_routing`, `routing_step_2_edges`, `routing_step_3_gutters`, and final staged SVG/PNG
- legacy DOT, Mermaid, and `legacy_graphviz_preview` remain available after staged output is accepted and intentionally promoted

This plan must be executed gate by gate. A later gate must not begin until the orchestration thread verifies the previous gate against its acceptance criteria and stop conditions.

## 2. Source Evidence

Use these sources by role:

| Role | Source |
| --- | --- |
| Design authority for this plan | `docs/outcome_opportunity_map_renderer_implementation/outcome_opportunity_map_renderer_design.md` |
| Repo-wide renderer constraints and bundle authority | `AGENTS.md` |
| View scope and bundle-owned defaults | `bundle/v0.1/core/views.yaml` |
| Bundle typing and loading path | `src/bundle/types.ts`, `src/bundle/loadBundle.ts` |
| Projection builder and derived instrumentation annotations | `src/projector/outcomeOpportunityMap.ts` |
| Current legacy render model | `src/renderer/outcomeOpportunityMapRenderModel.ts` |
| Current text renderers and capability registry | `src/renderer/viewRenderers.ts`, `src/renderer/dot.ts`, `src/renderer/mermaid.ts` |
| Preview backend registry | `src/renderer/previewBackends.ts`, `src/renderer/renderArtifacts.ts`, `src/renderer/previewWorkflow.ts` |
| Staged renderer internal contracts | `src/renderer/staged/contracts.ts`, `src/renderer/staged/pipeline.ts`, `src/renderer/staged/microLayout.ts`, `src/renderer/staged/macroLayout.ts` |
| Shared staged scene primitives and backend | `src/renderer/staged/sceneBuilders.ts`, `src/renderer/staged/svgBackend.ts`, `src/renderer/staged/connectorLabelPlacement.ts` |
| Service-blueprint staged routing exemplar | `src/renderer/staged/serviceBlueprint.ts`, `src/renderer/staged/serviceBlueprintMiddleLayer.ts`, `src/renderer/staged/serviceBlueprintRouting.ts` |
| Scenario-flow custom routing precedent | `src/renderer/staged/scenarioFlow.ts`, `src/renderer/staged/scenarioFlowMiddleLayer.ts`, `src/renderer/staged/scenarioFlowRouting.ts` |
| Scenario-flow routing rescue lesson | `docs/Done/[Done] scenario_flow_renderer_implementation/[Done] scenario_flow_routing_parity_plan.md` |
| Renderer migration architecture | `docs/toolchain/renderer_migration_guidance.md`, `docs/toolchain/architecture.md`, `docs/toolchain/development.md` |
| Canonical proof-case sources | `bundle/v0.1/examples/outcome_to_ia_trace.sdd`, `bundle/v0.1/examples/metric_event_instrumentation.sdd` |
| Canonical proof-case projections | `bundle/v0.1/snapshots/outcome_to_ia_trace.outcome_opportunity_map.projection.json`, `bundle/v0.1/snapshots/metric_event_instrumentation.outcome_opportunity_map.projection.json` |
| Visual evidence only, not geometry authority | `examples/rendered/v0.1/outcome_opportunity_map_diagram_type/outcome_to_ia_trace_example`, `examples/rendered/v0.1/outcome_opportunity_map_diagram_type/metric_event_instrumentation_example` |
| Current Elk background, context only | `https://github.com/kieler/elkjs`, `https://eclipse.dev/elk/reference.html` |

Current Elk documentation is context for recognizing stale or conflicting guidance. It is not implementation authority for this view. The design explicitly forbids Elk and other external layout engines for staged `outcome_opportunity_map` placement or routing.

## 3. Non-Negotiable Invariants

1. `outcome_opportunity_map` staged rendering must not use Elk, the ELK adapter, Graphviz, Mermaid, or any external layout engine for placement or routing.
2. Projection remains the semantic boundary. Parser, compiler, validator, and projection behavior remain unchanged unless a gate stops on a bundle-authority gap and extends the bundle contract first.
3. Renderer-owned layout consumes projection and bundle renderer defaults. It must not rediscover semantics from raw `.sdd` text.
4. Bundle-owned conventions must be encoded in `bundle/v0.1/core/views.yaml` and consumed through typed or generic bundle-loading/runtime paths.
5. `RendererScene` must not contain final coordinates, final line breaks, route polylines, SVG strings, DOT text, Mermaid text, or external layout JSON.
6. `MeasuredScene` owns text wrapping, node/card sizing, annotation block sizing, port offsets, edge-label measurement, and overflow diagnostics.
7. `PositionedScene` owns absolute placement, routed connectors, label positions, decorations, paint order, and renderer diagnostics.
8. Proof cases must be structurally correct before snapshots, goldens, rendered corpus artifacts, or public docs are refreshed.
9. Debug artifacts must expose meaningful stage differences for pre-routing placement, endpoint/template routing, gutter/occupancy routing, and final routed output.
10. A gate is not accepted just because tests pass. The cited invariants must also be satisfied by source, tests, docs, and visual proof where relevant.
11. Legacy DOT, Mermaid, and Graphviz-backed preview paths remain selectable until staged output is accepted and intentionally promoted.
12. Routing gates must not land a simplified "route then hope" implementation. Endpoint offsets, keyed occupancy, segment spacing, and global gutter expansion are baseline requirements, not a later parity rescue.

## 4. Orchestration Thread Protocol

The orchestration thread owns sequencing, verification, and handoff. It may delegate implementation to one subagent per gate, but it must not let two gates proceed concurrently.

### 4.1 Required Orchestrator Behavior

For each gate:

1. Re-read this plan section and `outcome_opportunity_map_renderer_design.md`.
2. Re-inspect the source files listed in the gate before spawning the subagent.
3. Spawn exactly one implementation subagent for the gate.
4. Tell the subagent that they are not alone in the codebase and must not revert unrelated edits.
5. Give the subagent the gate goal, read scope, write scope, forbidden scope, invariants, proof tasks, verification commands, and stop conditions.
6. Require the subagent to stop and report if a stop condition is hit.
7. Review the subagent's diff before running verification.
8. Run the gate verification commands with `TMPDIR=/tmp` where tests or temporary files are involved.
9. Manually check the gate acceptance criteria against the diff, test output, and any generated visual artifacts.
10. Record satisfied invariants, violated invariants, tests run, and skipped verification with exact reasons.
11. Spawn the next gate only after the current gate is accepted.

### 4.2 Mandatory Subagent Instruction

Every implementation subagent must receive this instruction, adapted to the current gate:

```text
You are implementing only Gate <N> from
docs/outcome_opportunity_map_renderer_implementation/outcome_opportunity_map_gated_implementation_plan.md.
You are not alone in the codebase: do not revert unrelated edits, and keep your changes inside the gate write scope.

Stick to the design. Do not simplify or collapse renderer pipeline steps.
Do not put final coordinates, final line breaks, route polylines, SVG strings, DOT text, Mermaid text, or external layout JSON into RendererScene.
Do not route from CSS classes or raw .sdd text; use typed metadata, middle-layer data, measured ports, and PositionedScene geometry.
Do not use Elk, the ELK adapter, Graphviz, Mermaid, or any external layout engine for staged placement or routing.
Do not land no-op gutters, no-op occupancy, or a "route then hope" router. If this gate cannot satisfy its routing mechanics, stop and report why.
Do not update snapshots, goldens, or rendered corpus artifacts until this gate's structural acceptance criteria are satisfied.
Return changed file paths, tests run, satisfied invariants, violated invariants, and any skipped checks with exact reasons.
```

### 4.3 Gate Handoff Checklist

The orchestration thread may hand off to the next gate only when all items are true:

- the subagent stayed inside the gate write scope
- the diff contains no unrelated refactor
- required source files were read or re-read in the subagent thread
- proof tasks are implemented or explicitly proven unnecessary by direct source evidence
- verification commands passed, or skipped commands have a concrete environment reason
- acceptance criteria are satisfied by source, tests, docs, and artifacts where relevant
- no stop condition remains unresolved
- the gate final note names satisfied and violated invariants

If any checklist item fails, keep the same gate open and repair or report the blocker. Do not spawn the next gate.

## 5. Gate Sequence Overview

1. Gate 0: Baseline And Authority Inventory
2. Gate 1: Bundle Renderer Defaults And Authority Alignment
3. Gate 2: Middle-Layer Contract And Placement Proofs
4. Gate 3: RendererScene Builder, Measurement, And Pre-Routing Debug
5. Gate 4: Routing Stage 2 Endpoint Buckets And Connector Templates
6. Gate 5: Routing Stage 3 Gutters, Occupancy, Final Routes, And Labels
7. Gate 6: Staged SVG/PNG Preview Backend Registration
8. Gate 7: Snapshot And Renderer-Stage Golden Capture
9. Gate 8: Rendered Corpus, CLI, And Documentation Promotion
10. Gate 9: Final Visual Acceptance And Closeout

## 6. Gate 0: Baseline And Authority Inventory

### Goal

Confirm the current repository state before implementation and record the exact authority surface for later gates.

### Read Scope

- `docs/outcome_opportunity_map_renderer_implementation/outcome_opportunity_map_renderer_design.md`
- `AGENTS.md`
- `bundle/v0.1/core/views.yaml`
- `bundle/v0.1/examples/outcome_to_ia_trace.sdd`
- `bundle/v0.1/examples/metric_event_instrumentation.sdd`
- `bundle/v0.1/snapshots/outcome_to_ia_trace.outcome_opportunity_map.projection.json`
- `bundle/v0.1/snapshots/metric_event_instrumentation.outcome_opportunity_map.projection.json`
- `src/projector/outcomeOpportunityMap.ts`
- `src/renderer/outcomeOpportunityMapRenderModel.ts`
- `src/renderer/viewRenderers.ts`
- `src/renderer/previewBackends.ts`
- `src/renderer/renderArtifacts.ts`
- `src/renderer/staged/contracts.ts`
- `src/renderer/staged/serviceBlueprintMiddleLayer.ts`
- `src/renderer/staged/serviceBlueprintRouting.ts`
- `src/renderer/staged/scenarioFlowMiddleLayer.ts`
- `src/renderer/staged/scenarioFlowRouting.ts`
- `docs/toolchain/renderer_migration_guidance.md`
- `docs/toolchain/architecture.md`
- `docs/toolchain/development.md`

### Write Scope

No file edits.

### Forbidden Scope

- no source edits
- no bundle edits
- no generated artifact refresh
- no snapshot or golden updates

### Proof Tasks

1. Record the current `outcome_opportunity_map` node scope, edge scope, hierarchy edges, ordering edges, instrumentation annotation defaults, and profile display defaults from `views.yaml`.
2. Record the current legacy render model hardcoded conventions: lane order, node-type-to-lane mapping, shape choices, edge labels, and sibling order chains.
3. Record the canonical proof-case projection facts for:
   - `outcome_to_ia_trace`
   - `metric_event_instrumentation`
4. Record current preview capability for `outcome_opportunity_map`, including default `legacy_graphviz_preview` SVG/PNG and retained DOT/Mermaid text artifacts.
5. Record docs that still conflict with the design, especially `docs/toolchain/renderer_migration_guidance.md` guidance that mentions ELK-managed routing for `outcome_opportunity_map`.
6. Record the exact files later gates are expected to touch.

### Verification Commands

```bash
git status --short
TMPDIR=/tmp pnpm exec vitest run tests/viewProjectionSemantics.spec.ts tests/render_profile_display.spec.ts tests/viewRenderers.spec.ts
rg -n -i "may mix semantic lanes with elk|elk-managed routing|outcome_opportunity_map.*elk_layered|elk_layered.*outcome_opportunity_map" docs src bundle tests --glob '!docs/outcome_opportunity_map_renderer_implementation/outcome_opportunity_map_gated_implementation_plan.md'
```

### Stop Conditions

Stop if:

- canonical projection output differs from the design's expected semantic contract
- another active design or plan claims conflicting authority over staged `outcome_opportunity_map`
- uncommitted changes exist in later gate write scopes and the orchestrator cannot safely distinguish them
- the repo lacks the staged renderer primitives required by the design

### Acceptance Criteria

- no files changed
- baseline findings are recorded in the gate final note
- conflicting docs are identified for Gate 1
- next gate write scopes remain viable

## 7. Gate 1: Bundle Renderer Defaults And Authority Alignment

### Goal

Encode view-owned renderer conventions in the bundle and align stale documentation before staged renderer code begins.

### Read Scope

- Gate 0 baseline notes
- `docs/outcome_opportunity_map_renderer_implementation/outcome_opportunity_map_renderer_design.md`
- `bundle/v0.1/core/views.yaml`
- `src/bundle/types.ts`
- `src/bundle/loadBundle.ts`
- `src/renderer/outcomeOpportunityMapRenderModel.ts`
- `src/renderer/viewRenderers.ts`
- `src/renderer/profileDisplay.ts`
- `tests/render_profile_display.spec.ts`
- `tests/render_dot.spec.ts`
- `tests/render_mermaid.spec.ts`
- `docs/toolchain/renderer_migration_guidance.md`

### Write Scope

- `bundle/v0.1/core/views.yaml`
- `src/bundle/types.ts`
- `src/bundle/loadBundle.ts`, only if runtime validation/loading needs new typed support
- `src/renderer/outcomeOpportunityMapRenderModel.ts`
- `src/renderer/viewRenderers.ts`
- focused tests proving bundle authority
- `docs/toolchain/renderer_migration_guidance.md`

### Forbidden Scope

- no staged renderer files for outcome-opportunity yet
- no projection behavior changes
- no parser, compiler, or validator changes
- no public preview backend registration
- no snapshot, golden, or rendered corpus updates
- no promotion of `outcome_opportunity_map` out of preview-only status

### Proof Tasks

1. Add outcome-opportunity renderer defaults under `outcome_opportunity_map.conventions.renderer_defaults` for conventions that the design identifies as bundle-owned, including:
   - fixed semantic column order and labels
   - node type to semantic column mapping
   - node chrome or visual role mapping
   - edge type to connector channel mapping
   - connector priority order
   - default visible edge label behavior, unless the design explicitly keeps labels render-model-owned for this gate
2. Add typed bundle interfaces where needed. Keep generic `RendererDefaultsConfig` compatibility, but expose a typed reader for outcome-opportunity defaults instead of scattering casts and literal lists.
3. Validate the fixed-column contract at the bundle reader or render-model boundary: staged outcome-opportunity rendering must receive exactly four semantic columns in this order: `Initiatives`, `Opportunities`, `Outcomes`, `Metrics`.
4. Update `buildOutcomeOpportunityMapRenderModel(...)` so current lane order, node-type mapping, shape/chrome role, edge labels, and instrumentation profile display are driven by bundle defaults.
5. Update callers so the render model receives the view/defaults it needs. Legacy DOT/Mermaid output should remain semantically equivalent.
6. Add tests that prove allowed bundle-only changes affect render-model output, such as altered column labels, altered chrome roles, or altered edge-channel metadata. Do not treat column reordering as an allowed positive case.
7. Add tests that invalid bundle configurations with missing, extra, or reordered outcome-opportunity semantic columns fail explicitly before staged placement or routing.
8. Preserve existing `simple`, `permissive`, and `strict` instrumentation annotation behavior.
9. Revise stale active documentation that suggests ELK-managed routing for `outcome_opportunity_map`, pointing it to this custom staged design instead.

### Verification Commands

```bash
TMPDIR=/tmp pnpm exec vitest run tests/render_profile_display.spec.ts tests/render_dot.spec.ts tests/render_mermaid.spec.ts tests/viewRenderers.spec.ts
TMPDIR=/tmp pnpm exec vitest run tests/viewProjectionSemantics.spec.ts
rg -n -i "may mix semantic lanes with elk|elk-managed routing|outcome_opportunity_map.*elk_layered|elk_layered.*outcome_opportunity_map" docs/toolchain
git diff --check
```

### Stop Conditions

Stop if:

- a required renderer convention cannot be expressed in `views.yaml` without extending the bundle contract
- render-model behavior still depends on hidden hardcoded column, node-type, chrome, edge-channel, or priority lists after the gate
- invalid missing, extra, or reordered semantic columns are accepted silently
- projection or validation output changes
- docs remain in active conflict about using ELK for staged `outcome_opportunity_map`

### Acceptance Criteria

- bundle defaults encode the relevant renderer conventions
- invalid fixed-column configurations are rejected before staged placement or routing
- TypeScript consumes those defaults through a typed or generic bundle-loading path
- tests prove bundle-only edits can change render-model behavior
- legacy DOT/Mermaid behavior remains equivalent for current bundle data
- active docs no longer direct implementers toward ELK for this view

## 8. Gate 2: Middle-Layer Contract And Placement Proofs

### Goal

Create the renderer-owned outcome-opportunity middle layer and prove semantic placement before any staged scene or routing code exists.

### Read Scope

- `docs/outcome_opportunity_map_renderer_implementation/outcome_opportunity_map_renderer_design.md`
- `bundle/v0.1/core/views.yaml`
- `bundle/v0.1/examples/outcome_to_ia_trace.sdd`
- `bundle/v0.1/examples/metric_event_instrumentation.sdd`
- `src/renderer/outcomeOpportunityMapRenderModel.ts`
- `src/renderer/staged/serviceBlueprintMiddleLayer.ts`
- `src/renderer/staged/scenarioFlowMiddleLayer.ts`
- `tests/stagedServiceBlueprint.spec.ts`
- `tests/stagedScenarioFlow.spec.ts`

### Write Scope

- `src/renderer/staged/outcomeOpportunityMapMiddleLayer.ts`
- `src/renderer/outcomeOpportunityMapRenderModel.ts`, only for fields the middle layer needs and Gate 1 did not add
- `tests/outcomeOpportunityMapMiddleLayer.spec.ts`
- `tests/fixtures/render/outcome_opportunity_map_*.sdd`, if fixture files are preferred over inline test sources

### Forbidden Scope

- no `RendererScene` builder
- no routing implementation
- no preview backend registration
- no SVG/PNG backend changes
- no snapshot, golden, or rendered corpus updates
- no parser, compiler, validator, or projection changes

### Proof Tasks

1. Define middle-layer types for:
   - `OutcomeOpportunityColumn`
   - `OutcomeOpportunityBand`
   - `OutcomeOpportunityPhysicalSlot`
   - `OutcomeOpportunityCell`
   - `OutcomeOpportunityNodePlacement`
   - `OutcomeOpportunityMiddleEdge`
   - `OutcomeOpportunityConnectorPlan`
   - renderer diagnostics
2. Preserve separation between semantic ownership and physical realization:
   - semantic column id
   - semantic band id
   - anchor outcome id, when present
   - physical row/slot order
   - placement role
   - source author order
3. Implement canonical anchoring rules:
   - `Outcome` owns its outcome band
   - `Opportunity` anchors to first supported outcome by `SUPPORTS`
   - `Initiative` anchors to first addressed opportunity by `ADDRESSES`
   - `Metric` anchors to first measured outcome by `MEASURED_BY`
   - unanchored nodes go to deterministic parking bands after all outcome bands
4. Implement connector channels from bundle defaults:
   - `opportunity_support`
   - `initiative_addressing`
   - `outcome_measurement`
   - `implementation_reference`
   - `instrumentation_reference`
5. Prove canonical cases:
   - `outcome_to_ia_trace`: `I-001`, `OP-001`, `O-001`, `M-001` share one outcome band
   - `metric_event_instrumentation`: `I-050`, `OP-050`, `O-050`, `M-050`, `M-051` share one outcome band, with metrics in stable slots
6. Add synthetic proof cases required by the design:
   - multiple outcomes with independent bands
   - one opportunity supporting multiple outcomes
   - one initiative addressing opportunities in different outcome bands
   - one metric measuring multiple outcomes
   - dense metric fan-out from one outcome
   - missing outcome anchor requiring deterministic parking
7. Prove shared nodes are not duplicated solely to shorten edges.
8. Prove source order is a tie-breaker, not a timeline.

### Verification Commands

```bash
TMPDIR=/tmp pnpm exec vitest run tests/outcomeOpportunityMapMiddleLayer.spec.ts tests/render_profile_display.spec.ts
TMPDIR=/tmp pnpm exec vitest run tests/viewProjectionSemantics.spec.ts
git diff --check
```

### Stop Conditions

Stop if:

- placement requires reconstructing semantics from raw `.sdd` text
- placement depends on CSS classes or future scene structure
- canonical proof cases cannot match the design placement tables
- a needed placement convention belongs in bundle defaults but is not expressible there
- shared nodes are duplicated to shorten edges

### Acceptance Criteria

- middle-layer contract exists and is renderer-owned
- all canonical and required synthetic placement proofs pass
- placement and connector channels consume bundle/render-model data
- parser, compiler, validator, projection, DOT, Mermaid, and preview capability remain unchanged

## 9. Gate 3: RendererScene Builder, Measurement, And Pre-Routing Debug

### Goal

Build the staged `RendererScene`, measure it, and emit a meaningful pre-routing debug artifact without final routes.

### Read Scope

- Gate 2 middle-layer implementation and tests
- `src/renderer/staged/contracts.ts`
- `src/renderer/staged/sceneBuilders.ts`
- `src/renderer/staged/pipeline.ts`
- `src/renderer/staged/microLayout.ts`
- `src/renderer/staged/macroLayout.ts`
- `src/renderer/staged/scenarioFlow.ts`
- `src/renderer/staged/serviceBlueprint.ts`
- `src/renderer/staged/labelLines.ts`
- `src/renderer/staged/svgBackend.ts`
- `tests/stagedScenarioFlow.spec.ts`
- `tests/stagedServiceBlueprint.spec.ts`
- `tests/stagedVisualHarness.ts`

### Write Scope

- `src/renderer/staged/contracts.ts`
- `src/renderer/staged/outcomeOpportunityMap.ts`
- `src/renderer/staged/outcomeOpportunityMapMiddleLayer.ts`, only for metadata fields proven necessary by scene construction
- focused staged tests, such as `tests/stagedOutcomeOpportunityMap.spec.ts`
- focused visual harness updates that only add `outcome_opportunity_map` support

### Forbidden Scope

- no custom routing implementation yet
- no final route polylines
- no public preview backend registration
- no snapshot, golden, or rendered corpus updates
- no raw SVG strings for node chrome
- no final coordinates in `RendererScene`

### Proof Tasks

1. Add outcome-opportunity view metadata to staged contracts:
   - cell metadata with column, band, physical slot, row, and parking fields
   - semantic node metadata with placement role, column, band, cell, and anchor outcome
2. Build `buildOutcomeOpportunityMapRendererScene(...)` through:
   - `resolveProfileDisplayPolicy(...)`
   - `buildOutcomeOpportunityMapRenderModel(...)`
   - `buildOutcomeOpportunityMapMiddleLayer(...)`
3. Build root grid cells sorted by physical row/slot order, column order, then stable id.
4. Add restrained column headers for `Initiatives`, `Opportunities`, `Outcomes`, and `Metrics`.
5. Build semantic nodes with shared staged card primitives and bundle-derived chrome roles.
6. Use standard classed staged cards as the fallback chrome for `Opportunity`, `Outcome`, and `Metric` when shared hexagon-like, pill/ellipse, or note-corner primitives do not already exist.
7. Add advanced visual treatments only through shared staged primitive/backend support with focused tests; do not fake them with raw SVG strings or view-specific backend bypasses.
8. Represent metric instrumentation annotations as measured secondary content blocks. Do not bake pre-wrapped annotation lines into final coordinates.
9. Declare explicit ports on semantic nodes:
   - `intent_in`
   - `intent_out`
   - `measure_in`
   - `measure_out`
   - `secondary_in`
   - `secondary_out`
10. Build scene edges with routing intents but without final polylines.
11. Add `renderOutcomeOpportunityMapPreRoutingArtifacts(...)` that returns:
   - `rendererScene`
   - `measuredScene`
   - `preRoutingPositionedScene`
   - `middleLayer`
   - diagnostics
   - `preRoutingSvg`
   - `preRoutingPng`
12. In the pre-routing artifact, omit semantic edges and show columns, outcome bands, parking bands, headers, and nodes.

### Verification Commands

```bash
TMPDIR=/tmp pnpm exec vitest run tests/outcomeOpportunityMapMiddleLayer.spec.ts tests/stagedOutcomeOpportunityMap.spec.ts
TMPDIR=/tmp pnpm exec vitest run tests/stagedSceneBuilders.spec.ts tests/stagedSvgBackend.spec.ts
git diff --check
```

### Stop Conditions

Stop if:

- `RendererScene` contains final x/y coordinates, final line breaks, route polylines, SVG strings, DOT text, Mermaid text, or external layout JSON
- scene construction reconstructs placement instead of consuming the middle layer
- node chrome requires raw SVG strings or view-specific backend bypasses
- metric annotation sizing bypasses staged measurement
- node ports fall back to box centers instead of explicit roles
- pre-routing output cannot distinguish semantic bands from physical slots

### Acceptance Criteria

- `RendererScene` and `MeasuredScene` preserve staged pipeline boundaries
- pre-routing artifact is meaningful and has no semantic routes
- canonical proof-case nodes appear in correct columns and bands after pre-routing placement
- instrumentation profile display still matches bundle defaults
- no public preview behavior changes yet

## 10. Gate 4: Routing Stage 2 Endpoint Buckets And Connector Templates

### Goal

Implement the typed connector-plan and endpoint/template routing foundation, producing the `routing_step_2_edges` debug stage without pretending final routing is complete.

### Read Scope

- `docs/outcome_opportunity_map_renderer_implementation/outcome_opportunity_map_renderer_design.md`, especially section 11
- Gate 3 staged scene builder
- `src/renderer/staged/serviceBlueprintRouting.ts`
- `src/renderer/staged/scenarioFlowRouting.ts`
- `src/renderer/staged/routing.ts`
- `src/renderer/staged/connectorLabelPlacement.ts`
- `src/renderer/staged/diagnostics.ts`
- `tests/stagedVisualHarness.ts`
- `tests/stagedVisualAcceptance.spec.ts`

### Write Scope

- `src/renderer/staged/outcomeOpportunityMapRouting.ts`
- `src/renderer/staged/outcomeOpportunityMap.ts`
- `src/renderer/staged/outcomeOpportunityMapMiddleLayer.ts`, only for connector-plan metadata required by routing
- focused routing tests, such as `tests/outcomeOpportunityMapRouting.spec.ts`
- focused visual harness updates for outcome-opportunity staged routes

### Forbidden Scope

- no public preview backend registration
- no snapshot, golden, or rendered corpus updates
- no no-op gutter or occupancy APIs
- no CSS-class parsing to infer semantics
- no raw source reconstruction
- no final-route acceptance claim until Gate 5

### Proof Tasks

1. Add connector plans with deterministic priority:
   - `SUPPORTS`
   - `ADDRESSES`
   - `MEASURED_BY`
   - projected `IMPLEMENTED_BY`
   - projected `INSTRUMENTED_AT`
2. Tie-break by the design order:
   - source semantic band order
   - source physical slot order
   - source column order
   - source author order
   - outgoing order from source node
   - target stable id
3. Build node-side edge buckets from typed ports and middle-layer connector plans.
4. Resolve endpoint sides and exterior endpoint offsets from measured/positioned node boxes:
   - same-band `ADDRESSES`: initiative east to opportunity west
   - same-band `SUPPORTS`: opportunity east to outcome west
   - same-band `MEASURED_BY`: outcome east to metric west
   - same-band stacked metrics: outcome east, measured-column gutter track, metric west
   - cross-band connectors: horizontal departure, vertical bridge in a gutter, horizontal terminal approach
   - parking connectors: deterministic orthogonal fallback plus diagnostic
5. Treat parking bands as terminal for placement and ordering, not as disconnected nodes. Projected edges involving parking nodes must receive deterministic parking connectors with diagnostics.
6. Use endpoint displacement on crowded node edges only when it satisfies no-crossing, spacing, and label-clearance tests. If displacement alone cannot satisfy those tests, add type-specific ports with focused tests instead of tuning coordinates.
7. Produce a `step2PositionedScene` with endpoint sides, node-edge buckets, and initial route templates.
8. Prove routes leave and enter endpoint nodes from the exterior side for canonical proof cases.
9. Preserve labels as measured edge labels, but do not place final labels before final routing geometry exists.

### Verification Commands

```bash
TMPDIR=/tmp pnpm exec vitest run tests/outcomeOpportunityMapMiddleLayer.spec.ts tests/stagedOutcomeOpportunityMap.spec.ts tests/outcomeOpportunityMapRouting.spec.ts
git diff --check
```

### Stop Conditions

Stop if:

- a route endpoint is resolved by box-center fallback
- a route endpoint enters the interior of its source or target node
- routing infers channel, side, or priority from CSS classes
- step 2 includes placeholder gutters or occupancy records that are not consumed by the routing algorithm
- crowded ports can only be made to pass through coordinate tuning instead of endpoint displacement or typed ports
- projected parking-node edges are silently dropped or treated as disconnected without diagnostics
- the implementation claims final route acceptance before Gate 5

### Acceptance Criteria

- step-2 routing exposes meaningful endpoint/template routes
- endpoint sides and route priorities are deterministic and typed
- canonical proof-case endpoint approaches are exterior to source and target boxes
- crowded endpoints are handled by proven displacement or type-specific ports
- parking-node edge handling is deterministic and diagnosed
- labels remain deferred until final routing
- no public preview behavior changes yet

## 11. Gate 5: Routing Stage 3 Gutters, Occupancy, Final Routes, And Labels

### Goal

Complete the custom router with service-blueprint-equivalent gutter, occupancy, displacement, global expansion, final labels, and diagnostics.

### Read Scope

- Gate 4 routing foundation
- `docs/Done/[Done] scenario_flow_renderer_implementation/[Done] scenario_flow_routing_parity_plan.md`
- `src/renderer/staged/serviceBlueprintRouting.ts`
- `src/renderer/staged/scenarioFlowRouting.ts`
- `src/renderer/staged/connectorLabelPlacement.ts`
- `src/renderer/staged/diagnostics.ts`
- `tests/stagedVisualHarness.ts`
- `tests/stagedVisualAcceptance.spec.ts`

### Write Scope

- `src/renderer/staged/outcomeOpportunityMapRouting.ts`
- `src/renderer/staged/outcomeOpportunityMap.ts`
- `tests/outcomeOpportunityMapRouting.spec.ts`
- `tests/stagedOutcomeOpportunityMap.spec.ts`
- `tests/stagedVisualAcceptance.spec.ts`
- `tests/stagedVisualHarness.ts`, only for reusable route/label assertions needed by this view

### Forbidden Scope

- no public preview backend registration until this gate is accepted
- no snapshot, golden, or rendered corpus updates
- no no-op gutter stage
- no "route then hope" shortcut
- no proof-case-specific hardcoded coordinates
- no rewrite of accepted Gate 4 endpoint/template generation except for narrow final-routing necessities; any such change must rerun Gate 4 acceptance checks
- no service-blueprint or scenario-flow behavior changes unless a tiny shared extraction is proven behavior-preserving

### Proof Tasks

1. Implement service-blueprint-equivalent routing mechanics:
   - node-side edge buckets
   - per-node right and bottom gutter availability
   - global column gutter expansion
   - global band/row gutter expansion
   - keyed occupancy records by node, column, band/row, edge-local segment, and obstacle-local segment
   - deterministic local bundle resolution
   - endpoint coordinate displacement on crowded node edges
   - segment coordinate displacement for overlapping same-orientation spans
   - bounded iterative rerouting after global gutter expansion
2. Keep the Gate 4 endpoint/template model as the foundation. If final routing requires changing it, document why and rerun the Gate 4 acceptance checks in this gate.
3. Use endpoint displacement on crowded node edges only when it satisfies no-crossing, spacing, and label-clearance tests. If displacement alone cannot satisfy those tests, add type-specific ports with focused tests instead of tuning coordinates.
4. Route projected parking-node edges through deterministic parking connectors with diagnostics. If no acceptable no-crossing route exists, degrade or omit the edge with an explicit diagnostic; never silently drop it.
5. Produce `routing_step_3_gutters` with obstacle-aware provisional connector routes, gutter occupancy, endpoint displacement, and segment spacing before final expansion.
6. Produce final routed `PositionedScene` through the full stage sequence.
7. Place edge labels only after final route geometry is known.
8. Emit diagnostics for degraded routes or label fallbacks. Do not silently accept node crossings or label collisions.
9. Prove `outcome_to_ia_trace`:
   - all four nodes share one outcome band
   - connector direction reads left to right
   - no connector crosses a non-endpoint node
   - labels do not overlap nodes, column headers, or each other
   - `simple` hides metric instrumentation annotations
   - `permissive` and `strict` show the expected instrumentation annotations
10. Prove `metric_event_instrumentation`:
   - `M-050` and `M-051` occupy stable same-band metric slots
   - `MEASURED_BY` connectors fan out from `O-050` through distinct endpoint tracks
   - same-orientation segments are separated by the staged routing layer's fixed spacing
   - labels for both measured-by connectors are readable and collision-free
   - the second metric route does not slice across the first metric node or the outcome node
11. Prove synthetic dense and cross-band cases:
   - shared opportunity across outcomes routes back to one canonical node
   - shared initiative across bands routes without duplication
   - shared metric across outcomes routes without duplication
   - dense metric fan-out expands gutters rather than overlapping routes
   - parking-band routes are deterministic and diagnosed when degraded

### Verification Commands

```bash
TMPDIR=/tmp pnpm exec vitest run tests/outcomeOpportunityMapMiddleLayer.spec.ts tests/stagedOutcomeOpportunityMap.spec.ts tests/outcomeOpportunityMapRouting.spec.ts tests/stagedVisualAcceptance.spec.ts
TMPDIR=/tmp pnpm exec vitest run tests/render_profile_display.spec.ts tests/stagedScenarioFlow.spec.ts tests/stagedServiceBlueprint.spec.ts
git diff --check
```

### Stop Conditions

Stop if:

- final routes cross non-endpoint node boxes in either canonical proof case
- endpoint routes enter source or target interiors
- same-orientation overlapping segments are not separated by the fixed connector spacing used by the staged routing layer
- crowded ports can only be made to pass through coordinate tuning instead of endpoint displacement or typed ports
- projected parking-node edges are silently dropped or treated as disconnected without diagnostics
- labels can only be made readable through hardcoded proof-case coordinates
- step 3 does not expose real gutter/occupancy information
- diagnostics hide structural routing failures as acceptable output
- the current strategy is producing structurally wrong output and further tuning is speculative

### Acceptance Criteria

- final routing satisfies canonical and synthetic proof cases
- debug stage 2 and stage 3 artifacts are both meaningful and structurally different
- route geometry tests prove no endpoint intrusion, no non-endpoint node crossings, and sufficient segment separation
- label placement tests prove no label/node/header/label collisions in proof cases
- no forbidden routing diagnostics are present in accepted proof cases
- service-blueprint and scenario-flow tests still pass

## 12. Gate 6: Staged SVG/PNG Preview Backend Registration

### Goal

Register staged `outcome_opportunity_map` SVG/PNG preview after routing acceptance, while preserving legacy text artifacts and explicit legacy Graphviz preview.

### Read Scope

- Gate 5 routing implementation and acceptance notes
- `src/renderer/previewBackends.ts`
- `src/renderer/renderArtifacts.ts`
- `src/renderer/viewRenderers.ts`
- `src/renderer/previewWorkflow.ts`
- `src/cli/main.ts`
- `src/cli/helperMain.ts`, if helper preview types need backend id coverage
- `tests/viewRenderers.spec.ts`
- `tests/previewWorkflow.spec.ts`
- `tests/cli.spec.ts`
- `tests/helperCli.spec.ts`

### Write Scope

- `src/renderer/previewBackends.ts`
- `src/renderer/renderArtifacts.ts`
- `src/renderer/viewRenderers.ts`
- `src/renderer/staged/outcomeOpportunityMap.ts`
- preview workflow, CLI, and helper tests required by backend registration

### Forbidden Scope

- no rendered corpus refresh
- no user-facing docs promotion
- no removal of DOT/Mermaid text artifacts
- no removal of `legacy_graphviz_preview`
- no snapshot/golden refresh unless Gate 7 is being executed separately

### Proof Tasks

1. Add backend id `staged_outcome_opportunity_map_preview`.
2. Register staged SVG and PNG render functions that derive PNG from staged SVG.
3. Make staged SVG/PNG the default preview backend for `outcome_opportunity_map` only after Gate 5 acceptance.
4. Preserve DOT and Mermaid text artifacts.
5. Preserve explicit `legacy_graphviz_preview` selection.
6. Update CLI and preview workflow tests so:
   - default SVG/PNG use staged backend
   - explicit `--backend legacy_graphviz_preview` still works
   - `--dot-out` can still choose a DOT-capable backend when needed

### Verification Commands

```bash
TMPDIR=/tmp pnpm exec vitest run tests/viewRenderers.spec.ts tests/previewWorkflow.spec.ts tests/cli.spec.ts tests/helperCli.spec.ts
TMPDIR=/tmp pnpm exec vitest run tests/stagedOutcomeOpportunityMap.spec.ts tests/outcomeOpportunityMapRouting.spec.ts
git diff --check
```

### Stop Conditions

Stop if:

- staged backend registration requires weakening preview backend typing
- legacy Graphviz preview is no longer explicitly selectable
- DOT or Mermaid text artifacts change unexpectedly
- backend registration bypasses projection-source rendering and falls back to DOT or Mermaid

### Acceptance Criteria

- `outcome_opportunity_map` supports staged SVG and PNG previews
- staged SVG/PNG are the default preview backend for the view
- `legacy_graphviz_preview` remains available in parallel
- DOT and Mermaid text renderers remain unchanged except for expected render-model bundle-authority effects from Gate 1

## 13. Gate 7: Snapshot And Renderer-Stage Golden Capture

### Goal

Capture focused renderer-stage snapshots and goldens only after structural acceptance has passed.

### Read Scope

- Gate 5 and Gate 6 acceptance notes
- `tests/rendererStageSnapshotHarness.ts`
- `tests/stagedOutcomeOpportunityMap.spec.ts`
- `tests/goldens/renderer-stages/`
- canonical proof-case sources and projections

### Write Scope

- `tests/stagedOutcomeOpportunityMap.spec.ts`
- `tests/goldens/renderer-stages/outcome-opportunity-map.*.json`
- `tests/goldens/renderer-stages/outcome-opportunity-map.*.svg`

### Forbidden Scope

- no rendered corpus refresh
- no docs promotion
- no broad snapshot churn
- no snapshot update to normalize failed acceptance
- no unrelated renderer-stage golden updates

### Proof Tasks

1. Add renderer-stage snapshots for canonical proof cases, covering:
   - `RendererScene`
   - `MeasuredScene`
   - pre-routing `PositionedScene`
   - routing step 2 `PositionedScene`
   - routing step 3 `PositionedScene`
   - final `PositionedScene`
   - final SVG
   - debug step SVGs where useful
2. After canonical acceptance, add a small selected synthetic renderer-stage golden set for:
   - dense metric fan-out
   - shared multi-outcome node routing
   - parking fallback routing
3. Keep remaining synthetic fixtures as structural and routing tests, not renderer-stage goldens or corpus artifacts.
4. Add structural assertions before snapshot assertions in the tests:
   - expected bands and slots
   - expected route count and edge ids
   - no forbidden diagnostics
   - no endpoint intrusion
   - no non-endpoint node crossings
   - no label collisions
5. Keep snapshots deterministic with canonical `LF` line endings.

### Verification Commands

```bash
TMPDIR=/tmp pnpm exec vitest run tests/stagedOutcomeOpportunityMap.spec.ts tests/outcomeOpportunityMapRouting.spec.ts tests/stagedVisualAcceptance.spec.ts
git diff --check
```

### Stop Conditions

Stop if:

- snapshot changes are needed because acceptance invariants still fail
- snapshots include external layout JSON, DOT text, Mermaid text, or SVG strings inside `RendererScene`
- broad unrelated goldens change
- synthetic goldens expand beyond the selected regression set without a concrete accepted routing risk
- debug snapshots do not show meaningful stage differences

### Acceptance Criteria

- focused renderer-stage goldens exist for accepted staged output
- selected synthetic renderer-stage goldens cover dense fan-out, shared multi-outcome routing, and parking fallback
- structural assertions fail before snapshots would normalize a problem
- snapshots are deterministic and limited to outcome-opportunity staged artifacts

## 14. Gate 8: Rendered Corpus, CLI, And Documentation Promotion

### Goal

Promote accepted staged output through generated examples, CLI-facing status, and user-facing docs.

### Read Scope

- Gate 7 snapshots and acceptance notes
- `src/examples/renderedCorpus.ts`
- `src/examples/generateRenderedExamples.ts`
- `tests/renderedCorpus.spec.ts`
- `examples/rendered/v0.1/`
- `docs/toolchain/architecture.md`
- `docs/toolchain/development.md`
- `docs/readme_support_docs/diagram_types/README.md`
- `docs/readme_support_docs/sdd_cli_tools/README.md`
- `examples/rendered/v0.1/README.md`

### Write Scope

- `src/examples/renderedCorpus.ts`
- `src/examples/generateRenderedExamples.ts`
- `tests/renderedCorpus.spec.ts`
- `examples/rendered/v0.1/`
- `docs/toolchain/architecture.md`
- `docs/toolchain/development.md`
- `docs/readme_support_docs/diagram_types/README.md`
- `docs/readme_support_docs/sdd_cli_tools/README.md`
- `examples/rendered/v0.1/README.md`

### Forbidden Scope

- no renderer behavior changes except fixes required by failed promotion tests
- no corpus refresh before accepted staged output exists
- no removal of legacy Graphviz siblings
- no status docs that claim more than the implemented behavior proves

### Proof Tasks

1. Remove `outcome_opportunity_map` from preview-only rendered corpus labeling only if the staged view is accepted as preview-ready.
2. Generate staged default SVG/PNG corpus artifacts for canonical outcome-opportunity examples.
3. Preserve legacy Graphviz preview siblings for side-by-side comparison.
4. Generate debug siblings:
   - `.pre_routing.svg` and `.pre_routing.png`
   - `.routing_step_2_edges.svg` and `.routing_step_2_edges.png`
   - `.routing_step_3_gutters.svg` and `.routing_step_3_gutters.png`
5. Update corpus README visual checklist to describe the staged outcome-opportunity view and required debug artifacts.
6. Update toolchain docs to describe:
   - custom staged outcome-opportunity backend
   - no external layout engine
   - legacy Graphviz still selectable
   - debug artifact commands or corpus locations
7. Update CLI/user-facing docs only to the level of behavior implemented by Gates 6 and 7.

### Verification Commands

```bash
TMPDIR=/tmp pnpm run generate:rendered-examples
TMPDIR=/tmp pnpm exec vitest run tests/renderedCorpus.spec.ts tests/cli.spec.ts tests/viewRenderers.spec.ts tests/previewWorkflow.spec.ts
git diff --check
```

### Stop Conditions

Stop if:

- generated staged corpus output violates proof-case placement, routing, label, or profile-display invariants
- corpus refresh would hide a quality regression
- docs imply `outcome_opportunity_map` is promoted before staged output is accepted
- legacy Graphviz siblings disappear
- debug corpus siblings are missing or visually indistinguishable from final output

### Acceptance Criteria

- rendered corpus uses staged artifacts as default for `outcome_opportunity_map`
- legacy preview siblings remain present
- debug artifacts are generated with required names
- docs accurately describe current behavior and no longer call the view preview-only if promoted

## 15. Gate 9: Final Visual Acceptance And Closeout

### Goal

Run final acceptance across code, tests, docs, generated artifacts, and visual proof cases.

### Read Scope

- all files changed by Gates 1 through 8
- `docs/outcome_opportunity_map_renderer_implementation/outcome_opportunity_map_renderer_design.md`
- this plan
- generated staged and legacy corpus artifacts for canonical proof cases
- `docs/toolchain/architecture.md`
- `docs/toolchain/development.md`
- `docs/readme_support_docs/diagram_types/README.md`
- `examples/rendered/v0.1/README.md`

### Write Scope

- narrow cleanup only
- this plan, only if recording final accepted gate summaries is part of the orchestrator's closeout convention
- docs with stale comments discovered during closeout

### Forbidden Scope

- no broad refactors
- no new behavior beyond final cleanup
- no snapshot or corpus churn unless a failed acceptance issue is fixed and reverified
- no removal of legacy preview support

### Proof Tasks

1. Run full build and tests.
2. Run rendered example generation from the target workspace.
3. Inspect canonical staged SVG/PNG artifacts:
   - `outcome_to_ia_trace`
   - `metric_event_instrumentation`
4. Confirm debug artifacts exist and show meaningful stage differences.
5. Confirm current active docs agree:
   - no Elk or external layout for staged `outcome_opportunity_map`
   - staged backend id is `staged_outcome_opportunity_map_preview`
   - legacy Graphviz remains explicitly selectable
   - SVG is first-class and PNG derives from SVG
6. Scan source and docs for stale no-longer-true claims.
7. Confirm no forbidden diagnostics are present in canonical proof cases.
8. Confirm no changes were made outside intended scopes.

### Verification Commands

```bash
TMPDIR=/tmp pnpm run generate:rendered-examples
TMPDIR=/tmp pnpm test
TMPDIR=/tmp pnpm run build
rg -n -i "may mix semantic lanes with elk|elk-managed routing|outcome_opportunity_map.*elk_layered|elk_layered.*outcome_opportunity_map|preview-only / not-yet-usable.*outcome_opportunity_map" docs src tests examples --glob '!docs/outcome_opportunity_map_renderer_implementation/outcome_opportunity_map_gated_implementation_plan.md'
git status --short
git diff --check
```

### Stop Conditions

Stop if:

- final visual output violates canonical proof-case invariants
- full tests pass but acceptance invariants fail
- docs and runtime behavior disagree
- any accepted routed output depends on external layout engines
- generated artifacts were refreshed from a temporary worktree instead of the target workspace
- unexplained unrelated diffs are present

### Acceptance Criteria

- staged `outcome_opportunity_map` is acceptance-ready
- canonical and synthetic tests pass
- full build and test suite pass
- rendered corpus and docs agree with implemented behavior
- no active doc points implementers toward Elk for this view
- the closeout note records satisfied invariants, violated invariants, tests run, skipped checks, and residual risks

## 16. Global Stop Conditions

Stop implementation and report the mismatch immediately if any gate encounters one of these conditions:

- staged layout or routing appears to require Elk, Graphviz, Mermaid, or another external layout engine
- a needed behavior belongs in bundle renderer defaults but cannot yet be expressed by the bundle
- placement depends on CSS classes instead of typed metadata or middle-layer data
- routing starts reconstructing semantic placement rather than consuming the middle layer
- final routes cross non-endpoint node boxes in either canonical proof case
- labels can only be made readable through hardcoded proof-case coordinates
- tests pass but visual output violates proof-case invariants
- snapshots or rendered corpus artifacts would need updating while proof-case output is still structurally wrong
- a subagent proposes collapsing `RendererScene`, `MeasuredScene`, and `PositionedScene` responsibilities for convenience

## 17. Acceptance Evidence Template

Each gate final note should use this shape:

```markdown
Gate <N> acceptance note:

- Changed files:
- Verification commands run:
- Verification commands skipped, with reasons:
- Satisfied invariants:
- Violated invariants:
- Proof cases checked:
- Generated artifacts touched:
- Residual risks:
- Handoff recommendation:
```

The orchestrator must not advance when `Violated invariants` is non-empty unless the item is explicitly outside the current gate and is recorded as a blocker for a later named gate.
