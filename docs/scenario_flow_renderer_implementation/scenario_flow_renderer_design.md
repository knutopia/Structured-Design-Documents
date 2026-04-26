# Scenario Flow Staged Renderer Design

Status: active design reference for future implementation

Audience: maintainers and implementation agents working on staged rendering for `scenario_flow`

Purpose: define the comprehensive ground truth for implementing a custom staged `scenario_flow` renderer without Elk or any other external layout engine.

## 1. Summary

`scenario_flow` should become a first-class staged SVG/PNG preview path using the same renderer architecture and discipline that now works for `service_blueprint`.

The renderer must be custom and deterministic:

- no Elk, no ELK adapter, and no other external layout engine may be used for `scenario_flow`
- projection remains the semantic boundary
- staged rendering remains explicit: `Projection -> RendererScene -> MeasuredScene -> PositionedScene -> SVG -> PNG`
- node placement, connector endpoint selection, gutter reservation, route refinement, label placement, debug artifacts, and renderer diagnostics are owned by the staged renderer
- legacy Graphviz preview remains available until staged `scenario_flow` is acceptance-ready

The target visual model is a lane-and-band diagram:

- top-to-bottom lanes: `Steps`, `Places`, `View States`
- left-to-right chronology bands derived from the Step `PRECEDES` spine
- branch tracks within a band for decision fan-out
- aligned Step/Place/ViewState triples whenever the source models a Step realized by a Place and ViewState
- connector routing that uses node edges and gutters, following the service-blueprint routing style

## 2. Authority And Grounding

Use these sources by role.

| Role | Source |
| --- | --- |
| View scope and bundle-owned renderer defaults | `bundle/v0.1/core/views.yaml` |
| Projection derivation for decision nodes and branch labels | `src/projector/scenarioFlow.ts` |
| Existing text-render model and profile display behavior | `src/renderer/scenarioFlowRenderModel.ts` |
| Staged renderer internal contracts | `src/renderer/staged/contracts.ts` |
| Staged measurement and layout boundaries | `src/renderer/staged/pipeline.ts`, `src/renderer/staged/microLayout.ts`, `src/renderer/staged/macroLayout.ts` |
| Reusable scene primitives and ports | `src/renderer/staged/sceneBuilders.ts` |
| SVG/PNG backend behavior | `src/renderer/staged/svgBackend.ts` |
| Service-blueprint staged implementation guide | `src/renderer/staged/serviceBlueprint.ts`, `src/renderer/staged/serviceBlueprintMiddleLayer.ts`, `src/renderer/staged/serviceBlueprintRouting.ts` |
| Service-blueprint semantic layout guidance | `docs/service_blueprint_renderer_implementation/service_blueprint_layout_rules.md` |
| Service-blueprint connector routing guidance | `docs/service_blueprint_renderer_implementation/Service Blueprint Routing Rules.md` |
| Service-blueprint visual routing exemplar | `docs/service_blueprint_renderer_implementation/reference/Service Blueprint Reference Design Notes.md` |
| Proof-case SDD source | `bundle/v0.1/examples/scenario_branching.sdd` |
| Proof-case projection snapshot | `bundle/v0.1/snapshots/scenario_branching.scenario_flow.projection.json` |

`docs/toolchain/renderer_migration_guidance.md` now aligns with this design: `scenario_flow` uses custom staged lane-and-band layout, not Elk, an ELK adapter, or any other external layout engine.

## 3. Non-Negotiable Invariants

These invariants are acceptance gates, not suggestions.

1. `scenario_flow` must not use Elk or any other external layout engine for node placement or connector routing.
2. Parser, compiler, validator, and projection behavior must remain unchanged unless a separate explicit task changes them.
3. Bundle-owned behavior stays bundle-owned. Decision-node property names, decision values, branch-label precedence, included node types, included edge types, and profile display defaults come from `bundle/v0.1/core/views.yaml`.
4. Projection owns semantic scope, derived node annotations, derived edge annotations, omissions, and notes.
5. `RendererScene` may declare primitives, classes, ordered children, ports, routing intent, layout intent, width policy, and overflow policy, but must not contain final coordinates, final line breaks, SVG strings, DOT text, Mermaid text, or external layout JSON.
6. `MeasuredScene` owns text wrapping, intrinsic node sizes, port offsets, edge-label measurement, and overflow diagnostics.
7. `PositionedScene` owns absolute node/container placement, routed connector geometry, label positions, decorations, diagnostics, and paint order.
8. SVG is the first-class vector artifact. PNG is derived from staged SVG.
9. Proof-case layout must be structurally correct before snapshots, goldens, or rendered corpus artifacts are refreshed.
10. Passing tests are not sufficient if proof-case output violates the placement and routing invariants in this document.
11. Legacy Graphviz preview remains selectable until staged `scenario_flow` is acceptance-ready and explicitly promoted.

## 4. Current Semantic Contract

From `bundle/v0.1/core/views.yaml`, the current `scenario_flow` view includes:

- node types: `Step`, `Place`, `ViewState`
- edge types: `PRECEDES`, `REALIZED_BY`, `NAVIGATES_TO`, `TRANSITIONS_TO`
- hierarchy edges: none
- ordering edges: `PRECEDES`

Current renderer defaults:

- decision nodes are identified by `kind=decision`
- decision nodes render as `diamond`
- branch-label precedence is `guard`, then `event`, then `to_name`
- `simple` hides branch labels
- `permissive` and `strict` show branch labels

Projection already derives:

- node annotations for decision-node shape
- edge annotations for branch labels on `PRECEDES` edges from decision Steps
- omissions for relationships outside the view scope, such as `CONTAINS`

The staged renderer must consume these derived projection results. It must not rediscover decision semantics from raw source text or hardcode branch-label precedence in renderer code.

## 5. Visual Model

### 5.1 Lanes

`scenario_flow` has three fixed visible lanes:

1. `Steps`
2. `Places`
3. `View States`

The lane order is semantic. It must not be changed by graph shape, node count, or connector minimization.

Lane labels should follow the visual restraint of service-blueprint lane labels:

- left aligned in the root left gutter
- small label typography
- secondary text color
- not framed as heavy visible row containers

Lane separators should be light horizontal guides. They are visual reading aids, not semantic boundaries like the service-blueprint lines of interaction and visibility. They should be less visually dominant than node cards and connectors.

### 5.2 Chronology Bands

Left-to-right chronology is driven by Step `PRECEDES`.

The renderer should derive chronology bands from the Step flow spine:

- each source-ordered primary Step position gets a chronology band
- decision fan-out targets can share the next chronology band as branch tracks
- a later Step that joins from a branch target moves to a later chronology band
- if the Step graph is disconnected or cyclic, use deterministic degraded placement with diagnostics

Chronology bands are semantic time positions. Physical columns may include branch tracks and gutter expansion, but those physical details must not create new semantic chronology.

### 5.3 Branch Tracks

Decision fan-out is represented by branch tracks inside the target chronology band.

Branch tracks must:

- preserve the source decision Step as the branch origin
- keep branch targets in stable order based on branch-label source, author order, then stable target id
- align related Place and ViewState targets to the same branch track as their corresponding Step target when a relationship exists
- avoid crossing branch tracks where deterministic ordering can prevent it

The first or most canonical branch should use track `T0`. Additional branches use `T1`, `T2`, and so on.

### 5.4 Node Shape And Styling

Use shared staged renderer card primitives and existing theme tokens.

Expected classes and visual roles:

- all semantic nodes carry `semantic_node` and `scenario_flow_node`
- Step nodes carry `type-step`
- Place nodes carry `type-place`
- ViewState nodes carry `type-viewstate`
- decision Step nodes carry `shape-diamond` from projection annotations
- non-decision Step and Place nodes render as rounded cards
- ViewState nodes render as rounded dashed cards, preserving the current text-render model convention

The current SVG backend renders all card primitives as rectangles. If diamond chrome requires backend support, add it as a staged primitive/backend enhancement in the implementation gate that owns node rendering. Do not fake diamond rendering through SVG strings in the scene builder.

## 6. Proof Case: `scenario_branching`

The first proof case is `bundle/v0.1/examples/scenario_branching.sdd`.

The expected semantic placement is:

| Band / Track | Step | Place | View State |
| --- | --- | --- | --- |
| `C1/T0` | `J-030` | `P-030` | `VS-030a` |
| `C2/T0` | `J-031` | `P-031` | `VS-031a` |
| `C2/T1` | `J-032` | `P-032` | `VS-032a` |
| `C3/T0` | `J-033` | `P-033` | `VS-033a` |
| `C4/T0` | `J-034` | `P-034` | `VS-034a` |
| `C4/T1` | `J-035` | `P-035` | `VS-035a` |

### 6.1 Proof-Case Reading

`J-030` is the first decision:

- `delivery_selected` leads to `J-031`, `P-031`, and `VS-031a` on `C2/T0`
- `pickup_selected` leads to `J-032`, `P-032`, and `VS-032a` on `C2/T1`

`J-031` continues to `J-033`, which starts the second decision:

- event `E-032` leads to `J-034`, `P-034`, and `VS-034a` on `C4/T0`
- fallback target-name branch `Review Pickup Instructions` leads to `J-035`, `P-035`, and `VS-035a` on `C4/T1`

The staged renderer should make this reading obvious before connector labels are inspected.

### 6.2 Proof-Case Acceptance

The proof case is structurally correct only when:

- the three lanes appear in fixed top-to-bottom order
- Step, Place, and ViewState nodes in the same row of the table above share the same band and track
- `J-030` and `J-033` render with decision-node visual treatment
- branch labels appear in `strict` and `permissive`, and are absent in `simple`
- primary Step `PRECEDES` connectors are more visually prominent and straighter than realization connectors
- navigation and transition connectors mirror the Step branch structure without fighting it
- no semantic connector crosses the interior of a non-endpoint node
- labels do not overlap nodes, lane labels, or other edge labels in the proof case

## 7. Runtime Contract

Implement a future `scenarioFlowMiddleLayer` before building the staged scene.

The middle layer should be a renderer-owned contract, not a public projection shape. It should separate semantic placement from physical geometry in the same spirit as `serviceBlueprintMiddleLayer`.

### 7.1 Middle-Layer Concepts

Required concepts:

- `ScenarioFlowBand`
- `ScenarioFlowTrack`
- `ScenarioFlowLaneGuide`
- `ScenarioFlowCell`
- `ScenarioFlowNodePlacement`
- `ScenarioFlowMiddleEdge`
- `ScenarioFlowConnectorPlan`
- renderer diagnostics

### 7.2 Bands

A band represents a semantic chronology position.

Required fields:

- stable id, for example `band:1`
- label, for example `C1`
- zero-based `bandOrder`
- `kind`: `entry`, `linear`, `branch_target`, `join`, or `parking`

The exact type names can vary, but implementation must preserve the concept that chronology is separate from physical x-position.

### 7.3 Tracks

A track represents a branch row within a band.

Required fields:

- stable id, for example `band:2__track:1`
- owning band id
- zero-based `trackOrder`
- optional originating decision node id
- optional branch label source

Track order is physical vertical order inside all lanes for that band. It does not create a new chronology position.

### 7.4 Cells

A cell is the physical placement slot for one lane, band, and track.

Required fields:

- stable id
- lane id
- band id
- track id
- row order
- column order
- track order
- node ids assigned to the cell
- shared width group
- shared height group

Cells should be invisible in normal SVG output, following the service-blueprint cell pattern.

### 7.5 Node Placements

Placements map semantic nodes to cells and should carry:

- node id
- node type
- lane id
- band id
- track id
- cell id
- placement role: `spine_step`, `branch_step`, `realized_place`, `realized_view_state`, `parking`
- source author order

Do not reconstruct this metadata from CSS classes during routing. Use typed metadata or the middle layer directly.

### 7.6 Edges

Middle edges should normalize projection edges into renderer-owned channels:

| Edge type | Channel | Primary visual role |
| --- | --- | --- |
| `PRECEDES` | `step_flow` | primary chronology and branch flow |
| `NAVIGATES_TO` | `place_navigation` | place-level mirror of branch/navigation flow |
| `TRANSITIONS_TO` | `view_transition` | view-state mirror of branch/transition flow |
| `REALIZED_BY` | `realization` | explanatory vertical alignment from Step to Place/ViewState |

Edge ids should be stable and match the existing text-render style where possible, for example `J-030__precedes__J-031`.

## 8. Scene Construction

Implement `src/renderer/staged/scenarioFlow.ts` after the middle layer exists.

Scene construction should:

- resolve profile display policy through `resolveProfileDisplayPolicy`
- call `buildScenarioFlowRenderModel`
- build the scenario middle layer
- build root grid cells sorted by row order, column order, track order, then stable id
- build semantic nodes with shared staged card primitives
- attach scenario-flow typed metadata to cells and semantic nodes
- declare node ports explicitly
- declare edge routing intents without final polylines

### 8.1 Root Layout

Use a custom fixed grid pattern similar to service blueprint:

- root layout strategy: `grid`
- columns: number of physical band/track columns needed by the middle layer
- cross alignment: `stretch`
- root left gutter large enough for lane labels
- row and column gaps chosen from service-blueprint spacing as the starting point

The grid strategy may need focused extension if branch tracks require row spans or per-band track stacking. If the current shared grid cannot express the placement without hacks, extend shared staged layout deliberately rather than pushing coordinates into `RendererScene`.

### 8.2 Ports

Scenario nodes should expose named ports:

- `flow_in`: west edge, for incoming `PRECEDES`
- `flow_out`: east edge, for outgoing `PRECEDES`
- `mirror_in`: west edge, for incoming `NAVIGATES_TO` and `TRANSITIONS_TO`
- `mirror_out`: east edge, for outgoing `NAVIGATES_TO` and `TRANSITIONS_TO`
- `realization_in`: north edge, for incoming realization from Step
- `realization_out`: south edge, for outgoing realization from Step

If Place and ViewState need separate mirror ports to avoid same-edge contention, add `navigation_in/out` and `transition_in/out` in the routing gate. Do not decide that through ad hoc fallback anchors.

## 9. Routing Policy

Routing must follow the service-blueprint style:

- endpoint side selection is semantic and explicit
- outgoing connectors leave perpendicular to the originating node edge
- incoming connectors approach perpendicular to the target node edge
- connectors never cross the interior of source, target, or non-endpoint nodes
- parallel connector segments are separated by a fixed distance
- labels are positioned after route geometry is known
- diagnostics report degraded routing or unresolved geometry

### 9.1 Connector Priority

Route connectors in this deterministic order:

1. `PRECEDES`
2. `NAVIGATES_TO`
3. `TRANSITIONS_TO`
4. `REALIZED_BY`

Within that order, tie-break by:

1. source lane order
2. source band order
3. source track order
4. source author order
5. outgoing order from the source node
6. target stable id

This priority keeps Step flow as the primary reading path while allowing Place and ViewState flow to mirror it.

### 9.2 Connector Templates

Expected templates:

- same-track forward flow: direct east-to-west horizontal route
- cross-track branch flow: east departure, horizontal gutter segment, vertical bridge in a band gutter, horizontal terminal approach
- realization edge: vertical or near-vertical south-to-north route from Step to Place or ViewState
- same-band realization pair: prefer straight vertical route when x coordinates align
- parking or degraded edge: deterministic orthogonal route with diagnostic

### 9.3 Gutters

Use service-blueprint-style routing structures:

- per-node right gutter
- per-node bottom gutter
- global column gutter expansion
- global lane gutter expansion
- connector occupancy records
- route states per connector

Scenario-specific gutter behavior:

- primary Step flow owns the most canonical tracks
- Place and ViewState mirror edges may be displaced farther from the node centerline
- realization edges should use vertical corridors between lanes and should not obscure lane labels
- cross-track branch bridges should prefer shared band gutters over arbitrary detours

### 9.4 Labels

Branch labels apply only to `PRECEDES` edges because projection currently derives branch labels for decision Step ordering edges.

Rules:

- `simple` profile hides branch labels
- `permissive` and `strict` show branch labels
- labels are measured through the staged edge-label measurement service
- labels are placed after routing
- labels must not overlap node boxes or lane labels in the proof case
- label fallback emits diagnostics instead of silently colliding

## 10. Debug Artifacts

Match the service-blueprint debugging pattern.

Required staged outputs:

1. pre-routing artifact
   - positioned nodes, cells, lane labels, and lane guides
   - semantic edges omitted
2. routing step 2 artifact
   - connector endpoint sides and initial route templates
   - no final labels required
3. routing step 3 artifact
   - gutter occupancy, swerves, and spacing before final expansion
   - no final labels required
4. final staged artifact
   - final routes, labels, diagnostics, SVG, and PNG

Rendered corpus debug names should follow service-blueprint style, adapted to scenario flow:

- `pre_routing`
- `routing_step_2_edges`
- `routing_step_3_gutters`

## 11. Preview Backend And Promotion

Add a staged preview backend only after the proof case is structurally correct.

Target backend id:

- `staged_scenario_flow_preview`

Promotion requirements:

- register the backend for SVG and PNG
- keep DOT and Mermaid text artifacts unchanged
- preserve explicit `legacy_graphviz_preview`
- do not remove legacy preview support
- update CLI tests to show staged preview is default only after staged acceptance
- update rendered corpus labels only when `scenario_flow` is no longer preview-only

## 12. Testing And Acceptance

### 12.1 Required Test Families

Add tests in focused stages:

- middle-layer proof-case placement tests
- RendererScene construction snapshots
- MeasuredScene snapshots
- pre-routing PositionedScene and SVG snapshots
- routing stage 2 and stage 3 snapshots
- final PositionedScene and SVG snapshots
- profile-display tests for branch labels
- preview backend capability tests
- CLI preview default tests
- rendered corpus tests after promotion
- visual acceptance tests for node crossings and label collisions

### 12.2 Acceptance Before Snapshots

Do not refresh snapshots or goldens until:

- proof-case placement matches the table in this document
- route priority and endpoint sides match this document
- final proof-case routes avoid non-endpoint node boxes
- branch-label profile behavior is correct
- no diagnostics hide structural failures as acceptable output

Snapshot refresh is evidence capture, not a way to normalize failure.

### 12.3 Stop Conditions

Stop implementation and report the mismatch if:

- achieving the proof case appears to require changing projection semantics
- a needed semantic rule cannot be expressed through current bundle-owned view defaults
- a routing approach starts encoding final geometry in `RendererScene`
- the proof case only works by using Elk or another external layout engine
- snapshots would need to be updated while core placement or routing invariants are still violated
- tests pass but the rendered proof case is visually or structurally wrong

## 13. Documentation Updates During Implementation

When implementation lands, update:

- `docs/toolchain/renderer_migration_guidance.md` only if implementation reveals new renderer migration guidance beyond the no-Elk scenario-flow decision already recorded there
- `docs/toolchain/architecture.md` to describe the staged `scenario_flow` backend
- `docs/toolchain/development.md` to show staged `scenario_flow` preview commands
- `docs/readme_support_docs/diagram_types/README.md` when `scenario_flow` is promoted out of planned/preview-only status
- rendered corpus README generation if the preview-only label changes

Do not update these docs ahead of behavior except where explicitly called for by the gated implementation plan.
