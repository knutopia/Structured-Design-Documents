# [Done] Staged Journey Map Renderer Architecture

Status: architecture reference for a future implementation-planning thread

Audience: maintainers and implementation agents adding the staged `journey_map` renderer

Purpose: define the semantic boundary, scene structure, layout model, routing architecture, reuse strategy, diagnostics, and acceptance evidence for a staged journey-map renderer. This document is not an implementation plan, code patch, or approval to refresh snapshots.

## 1. Executive Decision

The staged journey-map renderer should be implemented as a projection-backed, source-ordered container renderer with a dedicated `PRECEDES` routing phase:

`Projection -> RendererScene -> MeasuredScene -> pre-routing PositionedScene -> routed PositionedScene -> SVG -> PNG`

The scene and artifact path can closely follow the staged IA place-map renderer. Cross-container endpoint ownership can follow the UI Contracts pattern. Connector planning, occupancy, endpoint ordering, gutter expansion, final-route reconstruction, and debug stages should adapt the proven control-flow structure used by Service Blueprint, Scenario Flow, and Outcome-Opportunity routing.

The implementation must not modify those existing renderer modules. Their code, tests, and documentation are exemplars. Journey-specific policy should live in new journey-map files; genuinely generic additions to shared staged infrastructure must be additive and behavior-preserving for existing views.

The central design constraint is:

> Source order owns Stage and Step placement. `PRECEDES` is an explicit routed overlay and must never silently become the placement authority.

Journey map is therefore structurally small but not routing-trivial. Its semantic shape is a shallow, source-ordered container forest with a potentially arbitrary directed Step-to-Step graph overlaid on it.

## 2. Authority And Reference Hierarchy

Use these sources by role. When they disagree, the higher source in this table wins.

| Role | Authority or reference |
| --- | --- |
| Repository constraints and current renderer direction | [`AGENTS.md`](../../AGENTS.md) |
| Machine-readable view contract | [`bundle/v0.1/core/views.yaml`](../../bundle/v0.1/core/views.yaml) |
| Relationship endpoints and validation policy | [`bundle/v0.1/core/contracts.yaml`](../../bundle/v0.1/core/contracts.yaml) |
| Active journey projection | [`src/projector/journeyMap.ts`](../../src/projector/journeyMap.ts) |
| Active journey render model | [`src/renderer/journeyMapRenderModel.ts`](../../src/renderer/journeyMapRenderModel.ts) |
| General staged-renderer authoring rules | [`docs/toolchain/adding_staged_renderers.md`](../toolchain/adding_staged_renderers.md) |
| Staged pipeline architecture | [`docs/toolchain/architecture.md`](../toolchain/architecture.md) |
| Migration background | [`docs/toolchain/renderer_migration_guidance.md`](../toolchain/renderer_migration_guidance.md) |
| Prior journey-map topology comparison | [`# Deriving a Staged Journey Map Renderer.md`](%23%20Deriving%20a%20Staged%20Journey%20Map%20Renderer.md) |
| Proven human-oriented connector rules | [`Service Blueprint Routing Rules.md`](<../Done/[Done] service_blueprint_renderer_implementation/Service Blueprint Routing Rules.md>) |
| Proven occupancy-routing architecture | [`Outcome-Opportunity Routing Enhancement Architecture`](<../Done/[Done] outcome_opportunity_map_renderer_implementation/[Done] outcome_opportunity_service_blueprint_routing_architecture.md>) |
| Proven routing-parity gates | [`Scenario Flow Routing Sophistication Parity Plan`](<../Done/[Done] scenario_flow_renderer_implementation/[Done] scenario_flow_routing_parity_plan.md>) |
| Journey-first visual priority precedent | [`service_blueprint_layout_rules.md`](<../Done/[Done] service_blueprint_renderer_implementation/service_blueprint_layout_rules.md>) |
| Legacy-removal context | [`Path to Replacing Legacy Rendering Pipeline with Staged Renderers.md`](../future_explorations/Path%20to%20Replacing%20Legacy%20Rendering%20Pipeline%20with%20Staged%20Renderers.md) |

Some migration guidance still describes possible ELK-based strategies. The current repository rule is authoritative: do not use or expand ELK for this renderer. Graphviz, Mermaid, DOT, and any other external layout engine are also outside the staged journey-map path.

## 3. Non-Negotiable Invariants

The future implementation plan must cite and preserve these invariants.

### 3.1 Bundle and semantic invariants

1. `bundle/v0.1/` remains the machine-readable source of truth.
2. Journey-map scope remains bundle-driven: `Stage`, `Step`, `CONTAINS`, and `PRECEDES`.
3. `CONTAINS` defines Stage-to-Step structure; nesting or source proximity does not replace the semantic edge.
4. The selected profile controls opportunity-reference badge visibility through the bundle's `profile_display` settings.
5. Projection remains the semantic boundary. Layout and routing must not be pushed into parsing, compilation, validation, or projection.
6. No new node type, relationship type, profile identifier, badge property, or view convention may be hidden as a TypeScript-only spec rule.

No bundle change is currently required for the requested staged visual. If implementation discovers a machine-behavior convention that should be configurable or normative but cannot be expressed by the bundle, stop and extend the bundle contract before hardcoding it.

### 3.2 Ordering invariants

1. Root Stages and uncontained root Steps remain in deterministic top-level author order.
2. Steps inside a Stage remain in the source order of that Stage's qualifying `CONTAINS` edge lines.
3. `PRECEDES` must not topologically reorder Stages or Steps.
4. When source order contradicts temporal edge direction, placement stays source-ordered and routing makes the contradiction visible.
5. Stable ID order is only a final deterministic fallback; it is not a replacement for author order.

The existing author-order functions in [`src/compiler/authorOrder.ts`](../../src/compiler/authorOrder.ts) and the existing journey render model already implement the first-parent and source-order behavior that the staged renderer should preserve.

### 3.3 Staged pipeline invariants

1. `RendererScene` owns hierarchy, semantic content blocks, layout intent, port declarations, routing intent, typed view metadata, and stable element IDs.
2. `RendererScene` must not contain final coordinates, measured dimensions, final line breaks, route polylines, SVG, DOT, Mermaid, or external-engine payloads.
3. `MeasuredScene` owns font-backed measurement, wrapping, width-band escalation, block frames, local ports, and overflow outcomes.
4. `PositionedScene` owns absolute bounds, final connector routes, final label positions, decorations, paint order, and routing diagnostics.
5. SVG is the first-class artifact.
6. PNG is rasterized from the generated SVG and is not rendered through a parallel scene backend.
7. Stored stage snapshots and SVG goldens use deterministic ordering and canonical LF newlines.

### 3.4 Quality invariants

1. A passing test suite is not sufficient if the proof artifact is visually confusing.
2. Snapshots and goldens are evidence capture, not acceptance authority.
3. Accepted proof cases must contain no silent node intersection, endpoint intrusion, clipped content, collapsed connector tracks, or misleading Stage traversal.
4. Degraded routing must produce explicit renderer diagnostics.
5. If the proof case contradicts the visual acceptance contract, stop rather than update goldens.

## 4. Semantic And Topological Model

### 4.1 Structural graph

The semantic containment relation is shallow:

- `Stage CONTAINS Step`
- a Step may be uncontained and render at the root
- a Stage may be empty
- a Stage may contain one or many Steps
- Stage-to-Stage and Step-to-Stage containment are out of scope

The validation contract recommends at most one incoming `CONTAINS` edge but only warns on multiple parents. The existing render model resolves a Step to the first qualifying Stage parent encountered. The staged renderer should preserve that behavior rather than inventing a second hierarchy policy.

`CONTAINS` is structural in the rendered scene. It should create Stage membership and Stage chrome, not a visible connector.

### 4.2 Ordering overlay

`PRECEDES` connects Step to Step. The contract permits the following topology:

- a simple linear chain
- multiple disconnected chains
- branch fan-out
- join fan-in
- cross-Stage edges
- edges that skip intermediate source-ordered Steps
- edges directed backward relative to source order
- cycles, including intentional loops
- duplicate same-endpoint relationships that differ in annotations or properties

Cycles are warning-level under the current contract. The renderer must therefore route them; it may not assume a DAG or fail because a topological sort is impossible.

### 4.3 Complexity consequence

Journey map has the smallest semantic inventory of the six views, but the `PRECEDES` overlay can approach Scenario Flow's connector complexity. It is simpler overall because it has:

- one semantic leaf node type
- one visible edge family
- no edge labels in the current journey render model
- one shallow container level
- no decision shapes, semantic lanes, mirrored flows, resource rows, or fixed columns

The architecture should exploit that simplicity without assuming that all journeys are linear.

## 5. Existing Semantic Assets To Preserve

The staged renderer should consume and, where necessary, narrowly evolve the existing journey semantic path rather than reconstructing it.

### 5.1 Projection

[`buildJourneyMapProjection(...)`](../../src/projector/journeyMap.ts) already:

- filters the bundle-defined node and edge scope through the common projection machinery
- derives resolved opportunity-reference annotations from the bundle-owned source property and target type
- sorts reference IDs deterministically
- emits the Step-only projection note when no Stage exists

The staged renderer should not read `opportunity_refs` directly from raw source or infer unresolved references itself.

### 5.2 Render model

[`buildJourneyMapRenderModel(...)`](../../src/renderer/journeyMapRenderModel.ts) already:

- resolves first-parent Stage membership
- builds source-ordered Stage children
- builds source-ordered root items
- preserves empty and single-Step Stages
- exposes uncontained root Steps
- applies profile-controlled reference visibility
- extracts visible `PRECEDES` edges

The future plan may evolve only the journey render model to make staged rendering safer. Two narrow improvements are architecturally justified:

1. Expose typed opportunity badge data on `JourneyRenderStep` while retaining legacy `labelLines` for the legacy emitters. The staged builder must not parse bracketed label text to rediscover badge semantics.
2. Give every `JourneyRenderEdge` a deterministic ID, edge type, and author-order value. Same-endpoint duplicates need a stable occurrence ordinal so scene IDs do not collide.

Those changes remain inside the journey semantic/render adapter and do not require modifying any other renderer.

## 6. Proposed Renderer Components

The implementation should introduce a small journey-specific surface and continue using the shared staged contracts.

### 6.1 Suggested production modules

| Module | Responsibility |
| --- | --- |
| `src/renderer/staged/journeyMap.ts` | Build the scene, orchestrate measurement/placement/routing, and expose SVG/PNG entrypoints |
| `src/renderer/staged/journeyMapRouting.ts` | Classify `PRECEDES` edges, plan ports and route archetypes, resolve occupancy, reconstruct final routes, and expose debug stages |
| Existing `journeyMapRenderModel.ts` | Preserve semantic hierarchy/order and expose typed staged inputs |
| Existing shared staged modules | Measurement, primitives, theme, basic route geometry, diagnostics, SVG emission, and SVG-to-PNG rasterization |

A separate `journeyMapMiddleLayer.ts` is not required merely for symmetry with other renderers. Introduce one only if typed renderer-owned placement metadata becomes substantial enough to deserve an explicit contract. Do not create a semantic duplicate of the existing render model.

### 6.2 Typed journey metadata

Routing must not parse CSS class names to recover structure. The scene or a thin journey layout model should expose typed metadata such as:

- root item order
- Stage ID and Stage order
- Step order within Stage
- flattened global Step order
- containing Stage ID, if any
- whether a Step is uncontained
- edge author order and duplicate ordinal

This metadata is renderer-owned ordering and ownership context. It is not final geometry and may safely exist before positioning.

## 7. RendererScene Design

### 7.1 Root layout

The root should be a source-ordered horizontal stack of journey root items:

- Stage containers
- uncontained Step cards

This preserves the established left-to-right journey reading direction and supports interleaving root Steps with Stages without inventing a synthetic Stage.

Root layout intent should declare spacing and alignment only. Final widths, heights, and coordinates remain downstream.

### 7.2 Stage containers

Each Stage should render as a titled `cluster`-style container with:

- stable ID equal to the Stage semantic ID
- semantic role and classes identifying it as a journey Stage
- header content containing the Stage name
- a horizontal, source-ordered child stack of Step cards
- padding sufficient for header, card chrome, and baseline local routing clearance
- typed Stage order metadata

Empty Stage containers must remain visible. Their measured width must accommodate the header and padding even when they have no children.

Stage containers should align at a common top edge. Equal-height Stage chrome may be used when it materially improves scanning, but it must be proven against empty, single-Step, long-label, and mixed root-Step cases before becoming a fixed rule.

### 7.3 Step cards

Every Step should use the shared card primitive with:

- title content for the Step name
- typed badge content for resolved opportunity references when the selected profile permits it
- semantic classes for Step and contained/root status
- width and overflow policies expressed through shared staged contracts
- declared flow and escape ports

Recommended starting policy:

- preferred width band: `standard`
- allowed escalation: `standard -> wide`
- title growth before clamping
- badges in the secondary content region
- diagnostics rather than silent clipping after allowed policies are exhausted

The final width/overflow policy is a proof-case decision. It must use shared measurement infrastructure rather than character-count heuristics.

### 7.4 Ports

Step cards should expose semantic ports sufficient for both primary and exceptional routes:

- west-side flow input
- east-side flow output
- south-side escape/return input and output, or equivalent cardinal ports with semantic roles

North-side escape ports may be added only if the accepted visual design uses a distinct upper return corridor without interfering with Stage headers.

Multiple connectors may share a port role but must receive distinct final endpoint offsets when they compete on the same node side. Ordinary ports remain invisible in SVG output.

### 7.5 Edges

Each projected `PRECEDES` relationship must produce exactly one scene edge with:

- a stable unique edge ID
- role `precedes`
- source and target Step IDs
- orthogonal routing intent
- semantic source/target port preferences
- arrow marker at the target
- typed author-order and route-priority metadata available to the routing phase

Source-order adjacency must never create an extra visible edge. Conversely, a source-order gap must not suppress a real `PRECEDES` edge.

## 8. Placement Architecture

Placement is intentionally simpler than routing.

### 8.1 Placement authority

The scene tree and author order determine placement:

1. measure Step cards and Stage headers
2. place Steps horizontally inside each Stage in source order
3. compute each Stage's bounds from its measured children and chrome
4. place root items horizontally in source order
5. reserve baseline routing gutters without consulting edge topology for node reordering

`PRECEDES` may influence reserved routing space but may not change relative Stage or Step order.

### 8.2 Routing space

The pre-routing positioned scene should expose four kinds of usable whitespace:

1. **Adjacent Step gap:** direct local space between neighboring cards.
2. **Stage-local bypass gutter:** space below the Step row for non-adjacent same-Stage routes, fan-out, and fan-in.
3. **Inter-Stage gutter:** horizontal space between neighboring Stage/root items for clean boundary departure and arrival.
4. **Root outer bypass gutter:** peripheral space below the Stage row for long cross-Stage, backward, and cyclic routes.

Baseline gutters should be modest. When occupancy cannot fit at the required separation, the routing phase may request bounded Stage or root gutter expansion and then reroute. Expansion must shift whole affected structures consistently rather than moving individual nodes off their source-ordered alignment.

### 8.3 Edge ownership

Use the lowest common container as the routing owner:

- same-Stage edge: that Stage container
- edge involving Steps in different Stages: root
- edge involving a root Step and a contained Step: root
- edge between root Steps: root

The shared macro-layout index already demonstrates lowest-common-container ownership. Journey routing should use typed ownership directly and must not rediscover it from SVG or class strings.

## 9. Human Readability Contract For Routing

Routing should optimize for human reading structure before compactness. The following order is lexicographic: a lower item must not compensate for violating a higher item.

1. Preserve semantic endpoints and source-ordered placement.
2. Keep routes outside source, target, and non-endpoint node interiors.
3. Keep routes out of Stage headers, badge blocks, and unrelated Stage interiors.
4. Preserve clear exterior departure and arrival with readable arrowhead terminal legs.
5. Keep competing same-orientation segments and endpoints visibly separated.
6. Minimize connector crossings.
7. Prefer the conventional left-to-right reading direction for forward edges.
8. Minimize Stage-boundary crossings and avoid traversing unrelated Stages.
9. Minimize bends and backtracking.
10. Minimize total route length.
11. Prefer balanced whitespace, stable parallel tracks, and visually consistent port usage.

This ordering prevents a shortest-path rule from choosing a compact but unreadable route.

## 10. Route Archetypes

Classify every edge before assigning geometry. Classification uses Stage membership and source-order positions; it does not change semantics or placement.

| Archetype | Preferred visual treatment |
| --- | --- |
| Adjacent forward, same Stage | Direct east-to-west route when geometrically unobstructed |
| Non-adjacent forward, same Stage | Stage-local bypass track, normally below the Step row |
| Adjacent forward, cross-Stage | Direct inter-Stage bridge when source and target have legal clear approaches; otherwise root bypass |
| Long forward, cross-Stage | Root outer bypass track with explicit source Stage egress and target Stage entry |
| Root-Step transition | Root-owned direct or bypass route using the same obstacle rules |
| Branch fan-out | Stable source-side endpoint ordering, short independent departure stems, then separated tracks |
| Join fan-in | Stable target-side ordering derived from target-adjacent stem coordinates |
| Backward edge | Peripheral return route, visually secondary to forward flow |
| Cycle or self-loop | Outermost deterministic return/loop track with clear arrow direction |

No archetype may use a two-point diagonal while claiming orthogonal routing. A two-point route is valid only when the segment is exactly horizontal or vertical.

Backward and cyclic edges are exceptional but valid. They should be routed peripherally instead of forcing forward edges away from canonical tracks.

## 11. Deterministic Routing Priority

Routing priority controls endpoint order, canonical track ownership, and displacement. It does not create semantic priority.

Recommended deterministic sequence:

1. adjacent forward same-Stage edges
2. adjacent forward cross-Stage edges
3. non-adjacent forward same-Stage edges
4. long forward cross-Stage and root-Step edges
5. branch and join alternatives not already covered above
6. backward and cyclic edges
7. source root-item order
8. source Step order within its owner
9. author order among the source Step's outgoing edges
10. target root/Step order
11. stable edge ID and duplicate ordinal

Higher-priority edges retain more canonical tracks. Lower-priority edges are displaced minimally when they compete.

The router may recognize source-adjacent edges as better candidates for straightness, but it must not describe them as semantically primary unless the bundle later introduces such a distinction.

## 12. Routing Pipeline

Journey routing should use an explicit staged custom-router control flow. A smaller implementation than the existing dense routers is expected, but each responsibility below must be real rather than decorative.

### 12.1 Target control flow

1. Build a positioned index of Stages, Steps, ports, and bounds.
2. Classify every `PRECEDES` edge into a route archetype.
3. Build deterministic connector plans with owner, sides, ports, priority, and route-stage fields.
4. Build per-node-side incoming and outgoing edge buckets.
5. Assign initial endpoint offsets.
6. Build step-2 orthogonal route templates without considering all competition.
7. Add obstacle-aware swerves and Stage/root boundary gates to create step-3 provisional routes.
8. Extract occupancy from provisional routes.
9. Resolve Stage-local, inter-Stage, root-bypass, edge-local, and obstacle-local bundles.
10. Assign distinct coordinates to competing parallel segments at fixed separation.
11. Build prepared routes from resolved bundle and segment coordinates.
12. Reorder crowded endpoint offsets from adjacent prepared stem coordinates.
13. Rebuild prepared routes with the late endpoint order.
14. Compute required Stage/root gutter expansion from actual occupancy overflow.
15. Expand in a bounded loop, rebuild the positioned index, and reroute.
16. Reconstruct final routes from endpoint, boundary-gate, bundle, and displacement coordinates.
17. Validate final orthogonality, exterior approaches, obstacle clearance, Stage traversal, and track separation.
18. Emit final occupancy and diagnostics for tests and debug artifacts.

The route template establishes topology. Occupancy and displacement establish final coordinates. Re-running a midpoint template after expansion is not final-route reconstruction.

### 12.2 Occupancy model

At minimum, track:

- node-side endpoint occupancy
- adjacent Step-gap occupancy
- Stage-local bypass occupancy
- inter-Stage gutter occupancy
- root outer-bypass occupancy
- Stage-boundary gate occupancy
- obstacle-local swerve occupancy
- edge-local departure and arrival stems

Every occupancy record should identify:

- connector ID
- owner container
- axis
- nominal coordinate
- occupied span
- route segment index
- route archetype
- deterministic priority
- whether the coordinate is locked to an endpoint or boundary gate

Occupancy is an input to route resolution, not debug decoration added after routes are already final.

### 12.3 Separation

Use the existing staged-router baseline of 16px between competing same-orientation segments whose spans overlap. The same baseline applies to crowded endpoint offsets unless measurement or theme policy establishes a larger requirement.

A branch may share the exact source endpoint, but independent semantic edges should separate before occupying a shared gutter. Do not create long visually merged trunks unless a later design explicitly introduces semantic bundling and proves that edge identity remains clear.

### 12.4 Boundary gates

Cross-Stage routes need deterministic points at which they leave and enter Stage chrome. These gates are routing geometry, not semantic nodes.

The router should:

- assign gates in Stage-border order
- separate competing gates
- avoid the header band
- avoid entering unrelated Stage interiors
- minimize the number of boundary crossings
- keep each semantic edge visually continuous through its gates

Boundary gate coordinates belong in the positioned/routing stage, not in `RendererScene`.

### 12.5 Endpoint ordering

Initial source order is deterministic but may produce visual inversions. Follow the proven late-ordering pattern:

1. create provisional routes
2. inspect the first or last stem adjacent to each crowded node side
3. order connectors by stem coordinate when that reduces inversion
4. use routing priority as the deterministic fallback
5. assign final offsets at fixed separation
6. rebuild routes

This is especially important for branch fan-out and join fan-in.

### 12.6 Gutter expansion

When the required track bundle cannot fit:

- expand the owning Stage-local gutter for same-Stage routes
- expand the relevant inter-Stage gap for boundary-local contention
- expand the root outer gutter for long, backward, or cyclic routes
- shift whole later root structures or grow aligned Stage bounds consistently
- rebuild the positioned index and reroute

Expansion must be bounded and deterministic. Reaching the attempt limit emits a diagnostic; it must not silently accept merged tracks.

## 13. Reuse And Replication Matrix

The future implementation should reuse shared modules directly and replicate proven view-specific structures without modifying those renderer modules.

| Existing path | Reuse or replicate | Do not copy |
| --- | --- | --- |
| [`iaPlaceMapRenderModel.ts`](../../src/renderer/iaPlaceMapRenderModel.ts) and [`staged/iaPlaceMap.ts`](../../src/renderer/staged/iaPlaceMap.ts) | Root-item/container/leaf model shape; source-order handling; card/cluster scene construction; thin pipeline and SVG/PNG wrappers | Forward-navigation follower grouping; containment/navigation merging; recursive Place-specific local patterns |
| [`staged/uiContracts.ts`](../../src/renderer/staged/uiContracts.ts) | Titled scope containers; leaf-or-container endpoint mapping; explicit semantic edges across nested scopes; generic pipeline orchestration | `elk_layered`; UI contract gutters and labels; transition-priority semantics; heterogeneous scope reconstruction |
| [`staged/macroLayout.ts`](../../src/renderer/staged/macroLayout.ts) | Recursive placement; lowest-common-owner logic; container bounds; positioned index patterns | Simple routing fallback as proof of collision-free journey routing |
| [`staged/scenarioFlowMiddleLayer.ts`](../../src/renderer/staged/scenarioFlowMiddleLayer.ts) | Topology classification ideas; cycle/disconnected diagnostics; deterministic edge ordering | PRECEDES-driven topological placement, chronology bands, decision tracks, or mirrored semantic lanes |
| [`staged/scenarioFlowRouting.ts`](../../src/renderer/staged/scenarioFlowRouting.ts) | Node-side buckets; endpoint exterior approach; occupancy; late ordering; bundle displacement; global expansion; debug stages | Scenario lanes, branch labels, route channels, and scenario-specific placement metadata |
| [`staged/serviceBlueprintRouting.ts`](../../src/renderer/staged/serviceBlueprintRouting.ts) | Proven routing control-flow seams; node gutters; bundle resolution; locked segments; bounded expansion; final reconstruction | Service lanes, chronology bands, support/resource channels, separators, and parking semantics |
| [`staged/outcomeOpportunityMapRouting.ts`](../../src/renderer/staged/outcomeOpportunityMapRouting.ts) | Orthogonal template rules; shared-gap bridge separation; occupancy as input; final-route validation | Fixed semantic columns, outcome bands, connector labels, aggregate labels, and domain-specific route patterns |
| [`staged/routing.ts`](../../src/renderer/staged/routing.ts) | Port resolution, basic orthogonal geometry, marker-leg protection, and shared route primitives | Treating the generic fallback as sufficient without journey proof evidence |
| [`staged/sceneBuilders.ts`](../../src/renderer/staged/sceneBuilders.ts) | Root containers, card nodes, and reusable ports | New journey-only copies of shared primitive builders |
| [`staged/diagnostics.ts`](../../src/renderer/staged/diagnostics.ts) | Structured phases, severity, and deterministic sorting | Console-only warnings or silent fallbacks |
| [`staged/svgBackend.ts`](../../src/renderer/staged/svgBackend.ts) | Deterministic SVG and SVG-first PNG derivation | Journey-specific SVG assembly or direct PNG drawing |

### 13.1 Existing renderer isolation

The journey-map work should not edit:

- `iaPlaceMap.ts` or its routing behavior
- `uiContracts.ts`
- `scenarioFlow*.ts`
- `serviceBlueprint*.ts`
- `outcomeOpportunityMap*.ts`

If the journey implementation needs a generic routing mechanism that does not yet exist in shared infrastructure, add an additive shared helper or contract that leaves existing renderer outputs unchanged. Do not combine journey implementation with a refactor that migrates established renderers onto the new helper.

## 14. Profile And Badge Behavior

The bundle currently defines:

- `simple`: hide reference badges
- `permissive`: show reference badges
- `strict`: show reference badges

The staged scene must consume the resolved display policy and projection annotations. It must not hardcode profile names in the scene builder.

Badge requirements:

- one typed badge content block per resolved opportunity reference
- deterministic ID order inherited from projection
- target name when available, otherwise target ID
- badge measurement included in Step card height/overflow policy
- no badge overlap with title, card border, connector endpoint, or route segment
- permissive and strict should be visually identical for badge visibility unless the bundle later distinguishes them

Unresolved-reference handling remains a validation/profile responsibility. The renderer displays only resolved projection annotations and does not invent an unresolved badge state.

## 15. Diagnostics Policy

Diagnostics must identify the routing phase and target edge or item.

### 15.1 Errors

Use errors for structural renderer failures such as:

- unresolved Step endpoint in the final scene
- final route enters a non-endpoint Step interior
- final route enters the interior of its source or target after leaving/approaching the selected side
- final route crosses a Stage header or unrelated Stage interior
- an edge declared orthogonal contains a diagonal segment
- duplicate scene edge IDs
- a projected `PRECEDES` edge is omitted or rendered more than once

### 15.2 Warnings

Use warnings for degraded but still inspectable output such as:

- bounded gutter expansion reached its limit
- unavoidable connector crossing remains after deterministic alternatives were evaluated
- competing tracks could not maintain required separation
- exceptional fallback boundary gate or port was used
- route topology fell back from its preferred archetype

Warnings must not be used to normalize a failed proof case.

### 15.3 Information diagnostics

Information diagnostics may explain:

- Step-only rendering with no Stages
- disconnected Step chains placed solely by source order
- intentional peripheral handling of backward or cyclic edges
- deterministic first-parent selection already accompanied by validation feedback

Do not emit noisy diagnostics for normal direct routes.

## 16. Routing Acceptance Contract

### 16.1 Hard geometric assertions

Accepted proof cases must establish:

1. every adjacent point pair in every orthogonal route is horizontal or vertical
2. no route intersects a non-endpoint Step box
3. routes do not enter endpoint interiors
4. no route intersects a Stage header or badge block
5. no cross-Stage route traverses an unrelated Stage interior
6. every arrow-ended route has the shared minimum readable terminal leg when geometry allows
7. competing same-orientation overlapping spans are separated by at least 16px
8. crowded endpoints are separated and ordered against adjacent stems
9. every projected `PRECEDES` edge has one stable final route
10. Stage and Step placement remains source-ordered

### 16.2 Soft visual assertions

Human review should judge:

- whether the journey reads left to right without explanation
- whether forward edges retain the most direct tracks
- whether branches visibly separate and joins visibly converge
- whether backward and cyclic edges remain peripheral
- whether edge identity remains clear at crossings and crowded endpoints
- whether Stage chrome clarifies grouping without dominating the cards
- whether empty and single-Step Stages look intentional
- whether long labels and badges remain readable at normal preview size
- whether whitespace feels deliberate rather than accidental
- whether routes use consistent ports and boundary gates

The reviewer should report satisfied invariants, violated invariants, and whether the proof output is acceptable after every substantial routing pass.

## 17. Proof Corpus

The existing journey examples are insufficient to retire the legacy fallback. Build a focused proof corpus before broad golden regeneration.

| Proof case | Required evidence |
| --- | --- |
| Basic multi-Stage chain | ordered Stage containers, ordered cards, direct local and adjacent cross-Stage edges |
| Cross-Stage skip | root bypass route that avoids intermediate Stage interiors |
| Long labels and badges | width escalation, wrapping, no clipping, simple/permissive/strict profile difference |
| Empty and single-Step Stages | visible intentional chrome and stable root alignment |
| Root Steps mixed with Stages | exact interleaved source order and root-owned routing |
| Same-Stage branch and join | endpoint spacing, local bypass bundle, no merged tracks |
| Cross-Stage branch and join | boundary gate ordering, root occupancy, clear convergence/divergence |
| Backward edge | peripheral return route without reordering cards |
| Cycle and self-loop | deterministic loop handling and clear arrow direction |
| Source order contradicts PRECEDES | source order preserved; temporal contradiction visible in routing |
| Multiply-contained Step | preserved first-parent rendering plus validation evidence |
| Duplicate same-endpoint PRECEDES | unique stable edge IDs and distinct routes or explicit coincident-edge policy |
| Dense compressed layout | real Stage/root gutter expansion and bounded rerouting |

Start with one primary multi-Stage proof case that includes a cross-Stage edge, long label, badge, branch, join, empty Stage, and root Step without becoming so dense that individual failures cannot be diagnosed. Use smaller synthetic fixtures for backward, cycle, duplicate, and compressed-gutter mechanics.

## 18. Test And Artifact Strategy

### 18.1 Required stage evidence

For the primary proof case, capture:

- `RendererScene` snapshot
- `MeasuredScene` snapshot
- pre-routing `PositionedScene` snapshot
- step-2 route-template `PositionedScene` and SVG
- step-3 occupancy/gutter `PositionedScene` and SVG
- final `PositionedScene` snapshot
- final deterministic SVG golden
- PNG generation assertion derived from final SVG
- sorted diagnostics snapshot where fallbacks are intentionally exercised

Debug artifacts must show meaningful differences between stages. A step-3 artifact that merely repeats final geometry does not prove occupancy-driven routing.

### 18.2 Geometry tests

Reuse the assertion style and, where already generic, helpers from:

- [`tests/stagedVisualAcceptance.spec.ts`](../../tests/stagedVisualAcceptance.spec.ts)
- [`tests/stagedServiceBlueprint.spec.ts`](../../tests/stagedServiceBlueprint.spec.ts)
- [`tests/scenarioFlowRouting.spec.ts`](../../tests/scenarioFlowRouting.spec.ts)
- [`tests/outcomeOpportunityMapRouting.spec.ts`](../../tests/outcomeOpportunityMapRouting.spec.ts)
- [`tests/rendererStageSnapshotHarness.ts`](../../tests/rendererStageSnapshotHarness.ts)

Journey tests should add Stage-header, badge, Stage-interior, boundary-gate, and source-order assertions that the other views do not need.

### 18.3 Integration coverage

After the renderer itself is accepted, the future plan should cover:

- staged preview backend registration in [`previewBackends.ts`](../../src/renderer/previewBackends.ts)
- staged SVG/PNG capability and default selection in [`viewRenderers.ts`](../../src/renderer/viewRenderers.ts)
- CLI/helper preview behavior
- rendered corpus promotion from preview-only status
- preservation of selectable legacy preview support until a separate cutover task removes it

Do not combine initial routing proof with broad legacy deletion.

## 19. Suggested Planning Gates

This architecture is not the implementation plan, but a future gated plan should roughly separate these risks:

1. **Authority and proof-case lock:** cite invariants, select fixtures, and record visual acceptance before code.
2. **Typed journey render inputs:** stable badge and edge identity without changing existing semantics.
3. **Scene construction:** root order, Stage containers, Step cards, root Steps, profiles, and stage snapshots with no edges.
4. **Measurement and pre-routing placement:** long labels, badges, empty Stages, and reserved gutters.
5. **Basic explicit PRECEDES routing:** adjacent and simple cross-Stage routes, exterior endpoints, orthogonality.
6. **Occupancy and route archetypes:** branches, joins, skips, boundary gates, backward edges, and cycles.
7. **Late endpoint ordering and gutter expansion:** compressed/dense proof cases and fixed separation.
8. **Final validation and diagnostics:** hard geometry assertions and human visual acceptance.
9. **SVG/PNG, registry, CLI, and corpus integration:** only after the proof renderer is acceptable.
10. **Golden capture and closeout:** snapshots after acceptance, followed by focused and full verification.

Each gate should stop if it would require hiding bundle semantics in code, changing existing renderer behavior, or updating goldens to conceal a visual defect.

## 20. Non-Goals

This architecture does not authorize:

- changing `.sdd` syntax, the v0.1 vocabulary, or relationship contracts
- changing journey projection scope or validation behavior
- inferring visible `PRECEDES` edges from source adjacency
- letting `PRECEDES` reorder source-authored Stage or Step structure
- displaying PRECEDES annotations or labels that the current journey view does not specify
- duplicating Steps across Stages to shorten connectors
- using ELK, Graphviz, Mermaid, DOT, or another external layout/routing engine
- refactoring or behaviorally changing an existing staged renderer
- removing legacy journey rendering or switching the canonical public render API
- broad corpus or legacy-pipeline cleanup before journey routing is accepted

## 21. Stop Conditions

Stop and report rather than code through any of these conditions:

- the desired visual requires parser, compiler, validator, or projection changes not explicitly approved
- a machine-readable convention belongs in the bundle but cannot currently be expressed
- routing starts depending on raw `.sdd` text, CSS classes, or SVG geometry recovery
- source order must be changed to make routing appear clean
- an external layout engine appears necessary
- route quality depends on proof-case-specific coordinates
- occupancy is recorded but does not influence final tracks
- labels or Stage chrome are moved merely to hide merged or intersecting routes
- accepted proof cases still contain diagonal orthogonal routes, node intrusion, Stage-header crossings, or collapsed tracks
- existing renderer behavior would need modification as part of the journey implementation
- snapshots would need updating before the cited acceptance invariants pass

## 22. Success Definition

The staged journey-map renderer is architecturally successful when:

- bundle-owned Stage/Step, containment, ordering, and profile behavior is preserved
- the existing journey projection remains the semantic boundary
- Stage and Step placement is deterministic and source-ordered
- empty, single-Step, multi-Step, and Step-only/root-Step structures render intentionally
- all `PRECEDES` edges are explicit and stable within and across Stages
- branches, joins, skips, backward edges, and cycles route without structural failures in their proof cases
- opportunity badges are typed, measured, and profile-controlled
- no accepted proof case contains hidden node, header, badge, or unrelated-Stage intersections
- connector occupancy, separation, endpoint ordering, and expansion are deterministic and inspectable
- SVG is the vector truth and PNG is derived from it
- renderer diagnostics explain every degraded fallback
- stage snapshots and SVG goldens are captured only after human visual acceptance
- existing staged renderers remain behaviorally unchanged

Journey-map completion removes the final view-level blocker to a later, separate decision about retiring the legacy rendering pipeline. It does not itself authorize that cutover.
