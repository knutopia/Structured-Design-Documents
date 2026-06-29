# Outcome-Opportunity Routing Enhancement Architecture

Status: architecture handoff for a follow-up implementation-planning thread

Audience: maintainers and implementation agents enhancing the staged `outcome_opportunity_map` renderer

Purpose: define the problem, goals, and required architecture for upgrading the outcome-opportunity routing pipeline with the service-blueprint routing mechanics that already solved the same class of connector and label failures.

This document is an input to a new thread. It is not a canonical example, snapshot approval, or implementation patch.

## 1. Executive Summary

The staged `outcome_opportunity_map` renderer has the right broad pipeline shape, but its current router is still missing the route-preparation, gutter-local bundle resolution, segment displacement, late endpoint ordering, and final-route reconstruction mechanics that make the service-blueprint renderer reliable.

The recent disposable multi-outcome proof case exposed three concrete failures:

1. cross-band vertical connector segments share the same x-coordinate and visually merge
2. some connectors become diagonal two-point routes instead of orthogonal lane routes
3. multiple connectors arriving at the same destination edge are clustered instead of maintaining fixed spacing

These are not new unsolved problems. The service-blueprint renderer solved the same routing class with a staged custom router:

`placement -> connector plans -> orthogonal templates -> swerves/occupancy -> gutter-local bundle resolution -> endpoint ordering -> segment displacement -> global gutter expansion -> final route reconstruction -> label placement`

The outcome-opportunity renderer should reuse that logic structure. It may keep outcome-specific types and simpler domain rules, but it must adopt the same architectural mechanics. A smaller router is acceptable; a no-op occupancy stage or midpoint bridge router is not.

## 2. Authority And Source Evidence

Use these sources by role:

| Role | Source |
| --- | --- |
| Repo-wide constraints | `AGENTS.md` |
| Active outcome-opportunity renderer design | `docs/outcome_opportunity_map_renderer_implementation/outcome_opportunity_map_renderer_design.md` |
| Existing outcome-opportunity implementation plan | `docs/outcome_opportunity_map_renderer_implementation/outcome_opportunity_map_gated_implementation_plan.md` |
| Current outcome-opportunity routing code | `src/renderer/staged/outcomeOpportunityMapRouting.ts` |
| Current outcome-opportunity middle layer | `src/renderer/staged/outcomeOpportunityMapMiddleLayer.ts` |
| Service-blueprint routing exemplar | `src/renderer/staged/serviceBlueprintRouting.ts` |
| Service-blueprint scene ports and routing intents | `src/renderer/staged/serviceBlueprint.ts` |
| Shared label-placement engine | `src/renderer/staged/connectorLabelPlacement.ts` |
| Service-blueprint routing rules | `docs/Done/[Done] service_blueprint_renderer_implementation/Service Blueprint Routing Rules.md` |
| Service-blueprint reset note | `docs/Done/[Done] service_blueprint_renderer_implementation/[Done] Second Service Blueprint Renderer Reset.md` |
| Service-blueprint visual reference rules | `docs/Done/[Done] service_blueprint_renderer_implementation/reference/Service Blueprint Reference Design Notes.md` |
| Service-blueprint regression tests | `tests/stagedServiceBlueprint.spec.ts` |
| Disposable observed failure artifact | `outcome_opportunity_map_disposable.svg` |

The disposable SVG is evidence only. It must not become a canonical corpus artifact unless a later thread intentionally promotes a cleaned-up fixture.

## 3. Non-Negotiable Invariants

These invariants come from the active design and repo constraints:

1. Do not use Elk, the ELK adapter, Graphviz, Mermaid, or any external graph layout engine for staged placement or routing.
2. Keep projection as the semantic boundary. Do not reconstruct semantics from raw `.sdd` text or CSS classes.
3. Keep final coordinates, final line breaks, route polylines, SVG strings, DOT text, Mermaid text, and external layout JSON out of `RendererScene`.
4. `MeasuredScene` owns measured node and label dimensions. `PositionedScene` owns absolute positions, routes, labels, and diagnostics.
5. Debug artifacts must remain meaningful for `pre_routing`, `routing_step_2_edges`, `routing_step_3_gutters`, and final output.
6. Routes must be orthogonal unless a connector is genuinely a single horizontal or vertical segment.
7. Parallel same-orientation segments with overlapping spans must be separated by the staged routing layer's fixed spacing, currently 16px.
8. Crowded node-edge arrivals and departures must use deterministic endpoint spacing and late ordering against adjacent route stems.
9. Labels must be placed after final route geometry is known and must not overlap nodes, column headers, other labels, or nearby connector segments in accepted proof cases.
10. Do not update snapshots, goldens, or rendered corpus artifacts while the proof output still contains the failures listed in this document.

## 4. Confirmed Problems In The Current SVG

The disposable artifact `outcome_opportunity_map_disposable.svg` confirms all three reported failures.

### 4.1 Shared Vertical Tracks

Several support connectors use the same vertical bridge coordinate:

- `OP-001 -> O-002`: `M 603.336 102 L 674.053 102 L 674.053 388 L 712.77 388`
- `OP-002 -> O-003`: `M 603.336 206 L 674.053 206 L 674.053 716 L 712.77 716`
- `OP-007 -> O-002`: `M 603.336 310 L 674.053 310 L 674.053 394 L 712.77 394`
- `OP-006 -> O-003`: `M 603.336 630 L 674.053 630 L 674.053 732 L 712.77 732`

These all place the cross-band vertical bridge at `x=674.053`. The visual result is a merged vertical trunk where separate connectors and their labels are hard to distinguish.

The same issue occurs in other column gaps:

- addressing connectors share `x=336.668`
- measured-by connectors share `x=1018.647`

### 4.2 Diagonal Connectors

Some routes are emitted as two-point diagonals, despite being marked as staged connector routes:

- `OP-002 -> O-001`: `M 603.336 190 L 712.77 90`
- `OP-007 -> O-001`: `M 603.336 294 L 712.77 104`
- `OP-004 -> O-002`: `M 603.336 518 L 712.77 426`
- `OP-006 -> O-002`: `M 603.336 614 L 712.77 432`
- `OP-008 -> O-003`: `M 603.336 858 L 712.77 764`
- `I-001 -> OP-007`: `M 262 98 L 379.336 294`
- `I-004 -> OP-006`: `M 262 522 L 379.336 614`
- `I-005 -> OP-008`: `M 262 734 L 379.336 858`

These routes should use horizontal departure, vertical gutter bridge, and horizontal terminal approach. A route cannot be considered orthogonal merely because its route object says `style: "orthogonal"`; each segment must actually be horizontal or vertical.

### 4.3 Clustered Same-Edge Arrivals

Multiple connectors arrive at the same destination edge with inconsistent and insufficient spacing:

- `O-001` west-edge support arrivals cluster around y-values `86`, `90`, and `104`
- `O-002` west-edge support arrivals cluster around y-values `388`, `394`, `406`, `426`, and `432`
- `O-003` west-edge support arrivals cluster around y-values `716`, `726`, `732`, and `764`

Some gaps are only 6px. The service-blueprint standard is fixed 16px spacing for competing tracks and endpoints.

## 5. Current Outcome-Opportunity Router Diagnosis

The current router has useful scaffolding but stops short of the service-blueprint mechanics.

### 5.1 Existing Strengths

The current `outcomeOpportunityMapRouting.ts` already has:

- semantic endpoint side selection by edge channel
- connector plans with deterministic priority fields
- node-edge buckets
- endpoint offsets with 16px nominal spacing
- node gutter and global gutter state types
- provisional route stages
- label placement after route calculation through `positionConnectorLabel(...)`
- debug occupancy records

These should be preserved and evolved, not replaced with a generic graphing library.

### 5.2 Missing Mechanics

The current implementation fails because key mechanics are incomplete or not consumed:

- `buildEastWestTemplate(...)` can return a two-point route between east and west endpoints when source and target vertical spans do not overlap. That creates diagonal same-band or lane-crossing connectors.
- `resolveBridgeX(...)` chooses a midpoint plus `outgoingOrder * ENDPOINT_SPACING`. Many connectors have the same outgoing order in a shared column gap, so they reuse the same bridge x-coordinate.
- `buildGutterOccupancy(...)` records final occupancy, but that occupancy is not used to assign tracks or displace route segments.
- `resolveRequiredGlobalGutterState(...)` expands space from endpoint counts and label sizes, but it does not compute required expansion from competing occupied segments.
- Endpoint offsets are assigned before route stems are resolved. There is no service-blueprint-style late endpoint side ordering against prepared stem coordinates.
- Final routes are recomputed from simple templates after gutter expansion instead of being reconstructed from resolved endpoint, bundle, and displacement coordinates.
- Label placement happens after routing, but the final geometry still contains merged segments and clustered stems, so the label placer is asked to solve a geometry problem the router should have prevented.

## 6. Service-Blueprint Mechanics To Reuse

The service-blueprint renderer solved these same problems with the following architecture.

### 6.1 Explicit Ports And Routing Intent

`serviceBlueprint.ts` declares semantic ports such as `flow_in`, `flow_out`, `support_in`, `support_out`, `resource_in`, and `resource_out`. Routing intent is derived from middle-layer edge channels, not from CSS classes or raw source text.

Outcome-opportunity already has semantic ports such as `intent_in`, `intent_out`, `measure_in`, `measure_out`, `secondary_in`, and `secondary_out`. The follow-up implementation should keep this model and only add type-specific ports if same-edge contention cannot be solved by endpoint displacement alone.

### 6.2 Deterministic Connector Plans

Service-blueprint builds connector plans with:

- edge family and channel
- source and target sides
- source and target port ids
- deterministic ordering key
- step-2 route
- step-3 route
- final route
- occupied gutters

Outcome-opportunity should continue using its connector plan shape, but add the missing final-route state needed for prepared coordinates, locked segment keys, and occupied gutter ownership.

### 6.3 Orthogonal Templates

Service-blueprint templates only emit two-point routes when the segment is truly horizontal or truly vertical. Otherwise they emit orthogonal multi-point templates with stubs and bridge segments.

Outcome-opportunity must adopt the same rule:

- same-band routes may be direct only when source and target endpoint y-coordinates can be aligned without entering node interiors
- if y-alignment is impossible, route through an orthogonal bridge
- cross-band routes must always use horizontal departure, vertical bridge, and horizontal approach
- parking fallback routes must remain deterministic and orthogonal, with diagnostics

### 6.4 Gutter Occupancy As Input, Not Decoration

Service-blueprint extracts occupancy records for node-right gutters, node-bottom gutters, column/lane gutters, edge-local segments, and obstacle-local swerves. These records drive spacing and expansion.

Outcome-opportunity already defines occupancy types such as `node_right`, `node_bottom`, `column`, `band`, `edge_local`, and obstacle variants. The enhancement must make those records operational:

- extract occupancy from provisional routes
- group entries by key and axis
- compare overlapping spans
- assign distinct coordinates for competing tracks
- lock local bundle coordinates where route stems and endpoints must remain aligned
- compute required column or row expansion from assigned coordinates that exceed available gutter space

### 6.5 Gutter-Local Bundle Resolution

Service-blueprint's core solution is local bundle resolution inside a gutter. It treats local departures, local arrivals, and pass-through swerves as a single bundle. It then assigns coordinates at fixed separation and records endpoint and segment coordinates that must stay locked together.

Outcome-opportunity needs the same concept for:

- support bridges between Opportunities and Outcomes
- addressing bridges between Initiatives and Opportunities
- measured-by bridges between Outcomes and Metrics
- shared multi-outcome nodes that create cross-band connectors
- dense metric fan-out from one outcome
- parking-band fallback connectors

This directly addresses the shared-x failure. Vertical bridges in the same column gap with overlapping or visually competing spans must not reuse the same x-coordinate.

### 6.6 Segment Displacement

Service-blueprint runs `resolveOccupancyDisplacements(...)` after extracting occupancy. It groups same-axis segments, detects overlapping spans, keeps locked segments fixed, and minimally displaces movable segments by fixed increments.

Outcome-opportunity needs the same step. Midpoint bridge coordinates cannot be the final authority. The final authority must be the displacement/bundle coordinate maps produced from occupancy.

### 6.7 Late Endpoint Ordering

Service-blueprint first prepares routes, then reorders endpoint offsets based on adjacent stem coordinates. This avoids visual inversions and clustered arrivals when several connectors enter the same node edge.

Outcome-opportunity must implement the same late ordering:

- start with deterministic endpoint buckets
- build prepared routes
- inspect the first or last route stem adjacent to the node edge
- reorder incoming and outgoing connectors on each side by prepared stem coordinate
- assign final offsets at fixed spacing
- rebuild prepared and final routes with the ordered offsets

This directly addresses the clustered-arrival failure.

### 6.8 Bounded Global Gutter Expansion

Service-blueprint assigns local tracks, computes overflow, expands global column/lane gutters, shifts later cells, and reroutes in a bounded loop.

Outcome-opportunity already has a bounded expansion loop. It must be upgraded so expansion is driven by real occupancy and displacement overflow, not only endpoint counts and label widths.

### 6.9 Final Route Reconstruction

Service-blueprint does not simply rerun the original template and call it final. It reconstructs final routes from:

- source and target endpoint offsets
- bundle endpoint coordinates
- bundle segment coordinates
- generic segment displacements
- the step-3 route segment sequence

Outcome-opportunity needs this same final reconstruction. The route template establishes topology; final route reconstruction applies resolved coordinates.

### 6.10 Label Placement After Final Geometry

Service-blueprint places labels after final route reconstruction, using `connectorLabelPlacement.ts`. The label placer sees final connector segments and already-placed labels, then chooses collision-aware candidates.

Outcome-opportunity should keep using the shared label placer, but only after route geometry has been made readable by the router. Label placement must not be used as a substitute for track assignment.

## 7. Target Outcome-Opportunity Routing Architecture

The target architecture is:

1. Build the outcome-opportunity middle layer.
2. Build `RendererScene` with typed node metadata, semantic ports, and edge routing intent.
3. Measure nodes and edge labels.
4. Build pre-routing `PositionedScene` with columns, bands, parking bands, nodes, and no semantic edges.
5. Build connector plans from middle-layer edges and measured scene edges.
6. Build node-edge buckets.
7. Assign initial endpoint offsets.
8. Build step-2 orthogonal route templates.
9. Build step-3 provisional routes with obstacle-aware swerves where needed.
10. Extract occupancy from step-3 routes.
11. Resolve gutter-local bundles and edge-local fan-out coordinates.
12. Rebuild prepared routes with bundle endpoint and segment coordinates.
13. Apply late endpoint ordering from prepared stem coordinates.
14. Rebuild prepared routes again with ordered endpoint offsets.
15. Resolve generic segment displacements.
16. Compute required global column and row expansions from bundle overflow and displacement overflow.
17. Expand global gutters and reroute in a bounded loop.
18. Reconstruct final routes from resolved endpoint, bundle, and displacement coordinates.
19. Extract final occupancy for diagnostics and debug artifacts.
20. Place final labels using shared label placement.
21. Emit errors or warnings for any remaining node intersections, segment collisions, endpoint intrusion, or label fallback.

The implementation may collapse steps that are provably identical for outcome-opportunity, but it must not remove their responsibilities.

## 8. Specific Approach For Reusing Service-Blueprint Structure

The follow-up thread should plan implementation around structural reuse, not blind copy-paste.

### 8.1 Keep Domain-Specific Types

Keep outcome-specific names and metadata where they reflect domain concepts:

- semantic columns: Initiatives, Opportunities, Outcomes, Metrics
- outcome bands and parking bands
- edge channels: `initiative_addressing`, `opportunity_support`, `outcome_measurement`, secondary references
- route patterns: same-band, stacked measurement, cross-band bridge, secondary reference, parking fallback

Do not force service-blueprint lane/band terminology into public outcome-opportunity types.

### 8.2 Extract Shared Helpers Only When Behavior Is Identical

Candidate helpers for extraction or direct adaptation:

- route segment detail extraction
- segment displacement keys
- endpoint keys
- fixed-separation coordinate assignment
- overlap/span predicates
- global expansion accumulation
- final-route reconstruction patterns
- orthogonality and label collision test helpers

Do not change service-blueprint behavior unless the extraction is tiny, behavior-preserving, and covered by existing service-blueprint tests.

### 8.3 Mirror The Proven Control Flow

The follow-up implementation should mirror these service-blueprint control-flow seams:

- `buildConnectorPlans(...)`
- `buildNodeEdgeBuckets(...)`
- `buildStep3ConnectorPlansForScene(...)`
- prepared route construction
- late endpoint ordering
- obstacle or gutter compaction
- `resolveOccupancyDisplacements(...)`
- `applyGlobalGutterExpansions(...)`
- `buildFinalRoute(...)`
- final positioned edges with labels

Outcome-opportunity can implement smaller variants, but each seam must have a real responsibility and tests.

### 8.4 Do Not Rely On Midpoint Bridges

The final x-coordinate of a vertical bridge must not come from only:

```text
(source.x + target.x) / 2 + outgoingOrder * 16
```

That rule is insufficient because connectors from different sources can still compete in the same gutter with the same outgoing order. The final coordinate must come from occupancy grouping and bundle/segment coordinate resolution.

### 8.5 Do Not Mark Diagonals As Orthogonal

A route with two points whose x and y both differ is diagonal, even if the route style says `orthogonal`.

The implementation must add tests equivalent to service-blueprint's `expectOrthogonalRoute(...)`:

```text
for every adjacent point pair:
  start.x === end.x || start.y === end.y
```

The test must run against step-2, step-3, and final outcome-opportunity routes.

### 8.6 Use Late Endpoint Ordering For Same-Edge Contention

Endpoint offsets should not be final until prepared route stems are known. For each node side:

1. group incoming and outgoing connector ids
2. inspect each connector's adjacent stem coordinate
3. order connectors by stem coordinate with deterministic priority fallback
4. assign offsets at 16px spacing
5. rebuild routes with those offsets

This should replace clustered destination arrivals such as y-values `388`, `394`, `406`, `426`, and `432` on the same outcome edge.

## 9. Implementation Planning Units For The New Thread

The new thread should create a plan with these units. It should not start by updating snapshots.

### Unit A: Baseline Failure Tests

Add or identify a focused synthetic route fixture that captures:

- multiple outcomes
- one shared opportunity supporting multiple outcomes
- one initiative addressing opportunities in different outcome bands
- one metric measuring multiple outcomes
- dense same-edge arrivals
- visible connector labels

The existing disposable example can inform the fixture, but keep test fixtures intentional and minimal.

Expected tests before the fix may fail or be marked as pending in a planning branch. The important point is that the implementation target is explicit.

### Unit B: Orthogonal Template Correction

Fix step-2 route templates so no east-west connector can become diagonal.

Acceptance:

- all step-2 route segments are horizontal or vertical
- same-band connectors remain direct only when endpoints can share a legal y-coordinate
- otherwise, same-band connectors use an orthogonal bridge

### Unit C: Operational Occupancy Extraction

Make gutter occupancy drive routing decisions.

Acceptance:

- occupancy records are extracted from provisional routes before final route reconstruction
- competing same-axis overlapping spans are grouped by key
- debug `routing_step_3_gutters` exposes real occupancy that corresponds to route geometry

### Unit D: Bundle And Segment Coordinate Resolution

Implement service-blueprint-equivalent local bundle and segment displacement for outcome-opportunity.

Acceptance:

- overlapping vertical bridge segments in the same column gap receive distinct x-coordinates
- overlapping horizontal segments in the same row/band gap receive distinct y-coordinates
- fixed spacing is at least 16px unless a diagnostic explicitly marks degraded output
- required global expansions are computed from overflow

### Unit E: Late Endpoint Ordering

Add prepared-route-based endpoint side ordering.

Acceptance:

- crowded arrivals on the same node edge are spaced at 16px
- endpoint order follows adjacent route stem order when that reduces crossings or visual inversions
- deterministic priority remains the fallback

### Unit F: Final Route Reconstruction

Rebuild final routes from resolved endpoint, bundle, and displacement coordinates.

Acceptance:

- final routes preserve intended route topology
- final routes use resolved coordinates rather than midpoint templates
- final route reconstruction handles single-segment and multi-segment templates

### Unit G: Final Label Placement And Diagnostics

Keep labels deferred until final routes are reconstructed.

Acceptance:

- labels for primary `ADDRESSES`, `SUPPORTS`, and `MEASURED_BY` connectors are present unless a specific diagnostic explains omission
- labels do not overlap nodes, column headers, other labels, or connector segments in accepted proof cases
- diagnostics distinguish omitted labels, fallback label placement, node intersections, and route degradation

### Unit H: Golden Capture Only After Structural Acceptance

Refresh snapshots, renderer-stage goldens, and rendered corpus artifacts only after Units B-G satisfy route and label acceptance.

## 10. Required Acceptance Tests

The implementation plan should include tests for these conditions:

1. every step-2, step-3, and final route is orthogonal
2. no final route crosses a non-endpoint node box
3. source departures and target arrivals stay exterior to endpoint nodes
4. same-orientation overlapping segments in the same gutter are separated by at least 16px
5. vertical bridge tracks in a shared column gap do not collapse to one x-coordinate
6. horizontal tracks in a shared band or row gap do not collapse to one y-coordinate
7. same-edge arrivals and departures are spaced by at least 16px after late endpoint ordering
8. final labels do not overlap nodes, column headers, other labels, or route segments
9. final diagnostics contain no hidden structural routing failure for accepted proof cases
10. existing service-blueprint tests still pass
11. existing scenario-flow tests still pass where shared routing helpers are touched

Service-blueprint already has useful assertion patterns in `tests/stagedServiceBlueprint.spec.ts`, including:

- orthogonal-route verification for every semantic edge
- step-2 and step-3 debug route assertions
- obstacle clearance assertions
- gutter occupancy assertions
- fixed 16px separation assertions
- label node-clearance assertions

Outcome-opportunity tests should use the same style.

## 11. Diagnostics Policy

The renderer should emit diagnostics instead of silently accepting degraded geometry.

Errors should be used for:

- final route intersects a non-endpoint node
- final route enters source or target interior
- accepted proof case still contains diagonal route segments

Warnings may be used for:

- label omitted because no collision-free candidate exists
- fallback label placement used
- parking fallback route used
- bounded global gutter expansion reached its attempt limit

Info diagnostics may be used for:

- deterministic parking fallback when the source model lacks an outcome anchor

Warnings must not be used to normalize a structurally failed proof case. If the goal is an accepted renderer-stage artifact, structural routing failures are blockers.

## 12. Stop Conditions

The new implementation thread should stop and report rather than code through these conditions:

- the desired behavior appears to require parser, compiler, validator, or projection changes
- a convention belongs in bundle renderer defaults but cannot be expressed by the bundle
- route decisions start depending on CSS classes or raw `.sdd` text
- final route quality depends on hardcoded proof-case coordinates
- the implementation can only fix labels by moving labels around merged connector tracks
- service-blueprint behavior changes unintentionally
- snapshots or rendered corpus artifacts would need to be updated while any of the three confirmed failures remain visible
- a route is represented as `orthogonal` while containing diagonal point pairs

## 13. Success Definition

The enhancement is successful when a complex multi-outcome outcome-opportunity map demonstrates all of the following:

- no diagonal connector segments
- no merged vertical bridge tracks for competing cross-band connectors
- same-edge arrivals and departures use deterministic 16px spacing
- final labels are readable and collision-free for accepted proof cases
- debug artifacts expose the transition from templates to occupancy-aware routing to final routed labels
- service-blueprint and scenario-flow regressions remain green
- snapshots and rendered artifacts are refreshed only after the structural behavior is correct

The architectural target is not merely to improve the disposable diagram. The target is to make the outcome-opportunity router use the same proven staged mechanics that already made service-blueprint routing reliable.
