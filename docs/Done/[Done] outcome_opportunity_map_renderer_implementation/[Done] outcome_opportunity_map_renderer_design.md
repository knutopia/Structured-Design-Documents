# [Done] Outcome-Opportunity Map Staged Renderer Design

Status: active design authority for the staged renderer implementation and gated plan

Audience: maintainers and implementation agents working on staged rendering for `outcome_opportunity_map`

Purpose: define the ground truth for the custom staged `outcome_opportunity_map` renderer and its implementation plan.

## 1. Summary

`outcome_opportunity_map` is a first-class staged SVG/PNG preview path using a custom deterministic layout. It must not use Elk, Graphviz, Mermaid, or any other external layout engine for staged node placement or connector routing.

The target visual model is an outcome-centered intent map:

- fixed semantic columns from left to right: `Initiatives`, `Opportunities`, `Outcomes`, `Metrics`
- vertical outcome bands, with each `Outcome` acting as the primary anchor for its supporting opportunities, addressing initiatives, and measuring metrics
- secondary parking bands for scoped nodes that cannot be anchored to an outcome
- custom orthogonal connector routing through explicit node-edge ports and gutters
- debug artifacts after each renderer step, matching the service-blueprint and scenario-flow debugging style

The staged pipeline remains:

`Projection -> RendererScene -> MeasuredScene -> PositionedScene -> SVG -> PNG`

Legacy DOT, Mermaid, and Graphviz-backed preview outputs remain available after staged output is accepted and explicitly promoted.

## 2. Authority And Grounding

Use these sources by role.

| Role | Source |
| --- | --- |
| Repo-wide renderer constraints and bundle authority | `AGENTS.md` |
| View scope and current renderer defaults | `bundle/v0.1/core/views.yaml` |
| Bundle typing and loading path, if renderer defaults need extension | `src/bundle/types.ts`, `src/bundle/loadBundle.ts` |
| Projection derivation for instrumentation annotations | `src/projector/outcomeOpportunityMap.ts` |
| Current legacy render model and profile-display behavior | `src/renderer/outcomeOpportunityMapRenderModel.ts` |
| Current text renderers and legacy preview registration | `src/renderer/viewRenderers.ts`, `src/renderer/dot.ts`, `src/renderer/mermaid.ts` |
| Projection proof snapshots | `bundle/v0.1/snapshots/outcome_to_ia_trace.outcome_opportunity_map.projection.json`, `bundle/v0.1/snapshots/metric_event_instrumentation.outcome_opportunity_map.projection.json` |
| Proof-case SDD sources | `bundle/v0.1/examples/outcome_to_ia_trace.sdd`, `bundle/v0.1/examples/metric_event_instrumentation.sdd` |
| Staged renderer internal contracts | `src/renderer/staged/contracts.ts`, `src/renderer/staged/pipeline.ts`, `src/renderer/staged/microLayout.ts`, `src/renderer/staged/macroLayout.ts` |
| Shared staged scene primitives and backend | `src/renderer/staged/sceneBuilders.ts`, `src/renderer/staged/svgBackend.ts` |
| Service-blueprint layout and routing guide | `docs/[Done] service_blueprint_renderer_implementation/service_blueprint_layout_rules.md`, `docs/[Done] service_blueprint_renderer_implementation/Service Blueprint Routing Rules.md`, `docs/[Done] service_blueprint_renderer_implementation/reference/Service Blueprint Reference Design Notes.md` |
| Scenario-flow no-Elk staged renderer precedent | `docs/scenario_flow_renderer_implementation/[Done]  scenario_flow_renderer_design.md`, `docs/scenario_flow_renderer_implementation/scenario_flow_routing_parity_plan.md` |
| Renderer migration architecture | `docs/toolchain/renderer_migration_guidance.md`, `docs/toolchain/architecture.md` |
| Current staged and legacy corpus evidence | `examples/rendered/v0.1/outcome_opportunity_map_diagram_type/outcome_to_ia_trace_example`, `examples/rendered/v0.1/outcome_opportunity_map_diagram_type/metric_event_instrumentation_example` |

The preserved Graphviz outputs are semantic evidence, not visual authority. They prove scoped nodes, edge labels, profile-driven instrumentation annotations, and legacy corpus shape. They do not define accepted staged geometry.

## 3. History Lessons To Encode

The Codex Desktop history for service-blueprint and scenario-flow renderer work exposed recurring failure modes. This design treats them as implementation constraints:

- Service-blueprint support placement showed that middle-layer authority drift is expensive. Semantic ownership and physical realization must be separate from the start.
- Service-blueprint label work showed that labels can exist in projection, render models, and scene edges but still disappear in routed output. Final routing must preserve and place measured labels explicitly.
- Service-blueprint profile debugging showed that `simple` profile suppression is intentional when bundle-owned, and bugs often appear as inconsistent bypasses of that policy.
- Scenario-flow routing initially landed with a smaller explicit router, then required a parity pass for endpoint offsets, keyed occupancy, segment separation, and global gutter expansion. Outcome-opportunity routing must include those mechanics in the design baseline, not as a later rescue.
- Generated artifacts in a temporary worktree caused confusion during service-blueprint label work. Future gates must refresh artifacts only in the target workspace and only after acceptance invariants are satisfied.

## 4. Non-Negotiable Invariants

These are acceptance gates, not suggestions.

1. `outcome_opportunity_map` staged rendering must not use Elk, the ELK adapter, Graphviz, Mermaid, or any external layout engine for placement or routing.
2. Parser, compiler, validator, and projection behavior remain unchanged unless a future gate explicitly identifies a bundle-authority gap and extends the bundle contract first.
3. Projection remains the semantic boundary. It owns scoped nodes, scoped edges, derived instrumentation annotations, omissions, and projection notes.
4. Renderer-owned layout must consume projection and bundle renderer defaults. It must not rediscover semantics from raw `.sdd` text.
5. `RendererScene` must not contain final coordinates, final line breaks, route polylines, SVG strings, DOT text, Mermaid text, or external layout JSON.
6. `MeasuredScene` owns text wrapping, node/card sizing, annotation block sizing, port offsets, edge-label measurement, and overflow diagnostics.
7. `PositionedScene` owns absolute node placement, routed connectors, label positions, decorations, paint order, and renderer diagnostics.
8. SVG is the first-class vector artifact. PNG is derived from staged SVG.
9. Proof cases must be structurally correct before snapshots, goldens, rendered corpus artifacts, or README corpus references are refreshed.
10. Passing tests are not sufficient if proof-case output violates placement, routing, profile-display, label, or no-node-crossing invariants.
11. Legacy DOT, Mermaid, and Graphviz-backed previews remain selectable until staged output is accepted and intentionally promoted.
12. Debug artifacts must exist for pre-routing placement, endpoint/template routing, gutter/occupancy routing, and final routed output.

## 5. Bundle Authority Requirement

The existing `outcome_opportunity_map` render model hardcodes column order, node-type-to-column mapping, and shape choices. That is acceptable as current legacy implementation history, but a new staged renderer must not deepen that hidden convention.

Before implementation, the multi-gate plan must include an early authority check:

- If fixed columns, node type placement, node chrome, connector channel priority, or profile-display behavior are considered view conventions, encode them in `bundle/v0.1/core/views.yaml` under `outcome_opportunity_map.conventions.renderer_defaults`.
- If new renderer-default fields are added, update `src/bundle/types.ts` and consume them through generic bundle-loading/runtime paths.
- Staged code consumes those fields in `buildOutcomeOpportunityMapRenderModel(...)` and `buildOutcomeOpportunityMapMiddleLayer(...)`.
- Bundle-only changes to the relevant renderer defaults must be able to change staged behavior. If changing bundle data would not affect staged behavior, the implementation has failed the bundle-authority policy.

Current bundle fields already own:

- included node types: `Outcome`, `Metric`, `Opportunity`, `Initiative`
- included edge types: `MEASURED_BY`, `SUPPORTS`, `ADDRESSES`, `IMPLEMENTED_BY`, `INSTRUMENTED_AT`
- no hierarchy edges
- no ordering edges
- `INSTRUMENTED_AT` annotation behavior for out-of-scope experience and event targets
- profile display for instrumentation annotations

## 6. Current Semantic Contract

From `bundle/v0.1/core/views.yaml`, the view scope is:

- nodes: `Outcome`, `Metric`, `Opportunity`, `Initiative`
- edges: `MEASURED_BY`, `SUPPORTS`, `ADDRESSES`, `IMPLEMENTED_BY`, `INSTRUMENTED_AT`
- hierarchy edges: none
- ordering edges: none

The absence of ordering edges is important. This diagram is not a chronology view. The renderer must not invent time from source order or from the left-to-right visual chain. Source order is a deterministic tie-breaker, not a semantic timeline.

Projection currently derives instrumentation annotations:

- `INSTRUMENTED_AT` from a projected `Metric` to an out-of-scope `Step`, `Place`, `ViewState`, or `Event` is rendered as a metric annotation when the target type is configured in bundle renderer defaults.
- annotations are grouped by configured `group_order`, currently `experience` then `event`.
- target type order is configured as `Step`, `Place`, `ViewState`, `Event`.
- `simple` hides instrumentation annotations.
- `permissive` and `strict` show instrumentation annotations.

The staged renderer must consume these projection annotations. It must not scan raw graph edges to rebuild annotation text behind projection's back.

## 7. Visual Model

### 7.1 Fixed Semantic Columns

The staged view has four fixed semantic columns:

1. `Initiatives`
2. `Opportunities`
3. `Outcomes`
4. `Metrics`

These columns are semantic. They do not reorder to reduce connector length or crossings. Column headers should be restrained, using small header typography and shared staged decoration primitives rather than large Graphviz-style labels.

### 7.2 Outcome Bands

`Outcome` nodes define the primary vertical bands.

- Each `Outcome` gets one outcome band.
- Outcome bands are ordered by source author order, then stable id.
- The outcome node occupies the `Outcomes` column in its own band.
- Related opportunities, initiatives, and metrics prefer the same outcome band.
- Physical slots inside a band may be added for local packing, but they do not create new semantics.

This is analogous to service-blueprint separating semantic bands from physical spill slots. For this view, the semantic anchor is an outcome band rather than a customer-step chronology band.

### 7.3 Node Placement

Placement rules:

- `Outcome`: own outcome band, `Outcomes` column.
- `Opportunity`: anchor to the first supported outcome by `SUPPORTS`; if it supports multiple outcomes, keep one canonical node anchored to the first supported outcome and route later support edges back to it.
- `Initiative`: anchor to the band of the first addressed opportunity by `ADDRESSES`; if it addresses multiple opportunities in multiple bands, keep one canonical node anchored to the first addressed opportunity and route later addresses edges back to it.
- `Metric`: anchor to the first measured outcome by `MEASURED_BY`; if it measures multiple outcomes, keep one canonical node anchored to the first measured outcome and route later measured-by edges back to it.
- Nodes without an anchoring path to an outcome go to deterministic parking bands after all outcome bands.

Tie-breakers:

1. semantic anchoring relation
2. source author order
3. stable id

Do not duplicate shared `Opportunity`, `Initiative`, or `Metric` nodes solely to shorten edges.

### 7.4 Physical Slot Realization

A semantic band can have multiple physical slots when needed for readability.

- Same-band metrics should stack in stable order inside the `Metrics` column.
- Same-band initiatives and opportunities should stack only when the source has genuine fan-in or fan-out.
- The outcome node remains visually central within its band.
- If local stacking would create unreadable connector bundles, add physical spill slots owned by the same outcome band.
- Parking bands stay terminal and must not affect the outcome-band order.

Semantic ownership fields must remain distinct from physical row/slot fields in the middle layer.

### 7.5 Node Chrome

Use shared staged card primitives and theme tokens.

Expected visual roles:

- `Initiative`: work/action card, rectangular.
- `Opportunity`: problem/opportunity card, visually distinct but not Graphviz-specific. A hexagon-like primitive may be added only as a shared staged primitive/backend enhancement; do not fake it with raw SVG strings.
- `Outcome`: anchor card with stronger emphasis. An ellipse/pill treatment may be added as a shared primitive/backend enhancement; otherwise use a classed card with outcome emphasis.
- `Metric`: evidence card with secondary annotation lines. A note-corner primitive may be added only through shared staged primitive/backend support.

Metric annotations should render as measured secondary content blocks, not as pre-wrapped literal lines baked into final coordinates.

## 8. Proof Cases

### 8.1 `outcome_to_ia_trace`

Source: `bundle/v0.1/examples/outcome_to_ia_trace.sdd`

Expected semantic placement:

| Band | Initiative | Opportunity | Outcome | Metric |
| --- | --- | --- | --- | --- |
| `B1` | `I-001` | `OP-001` | `O-001` | `M-001` |

Expected reading:

- `I-001` addresses `OP-001`
- `OP-001` supports `O-001`
- `O-001` is measured by `M-001`
- `M-001` shows no instrumentation annotations in `simple`
- `M-001` shows `Experience: J-002 Confirm Payment` and `Event: E-001 Payment Submitted` in `permissive` and `strict`

Acceptance:

- all four nodes share one outcome band
- connector direction reads left to right
- no connector crosses a non-endpoint node
- edge labels do not overlap nodes, column headers, or each other
- profile-display behavior matches bundle renderer defaults

### 8.2 `metric_event_instrumentation`

Source: `bundle/v0.1/examples/metric_event_instrumentation.sdd`

Expected semantic placement:

| Band | Initiative | Opportunity | Outcome | Metrics |
| --- | --- | --- | --- | --- |
| `B1` | `I-050` | `OP-050` | `O-050` | `M-050`, `M-051` |

Expected reading:

- `I-050` addresses `OP-050`
- `OP-050` supports `O-050`
- `O-050` is measured by both `M-050` and `M-051`
- `M-050` event annotations remain ordered by bundle-derived instrumentation sort
- `M-051` shows experience annotation before event annotation in `permissive` and `strict`

Acceptance:

- `M-050` and `M-051` occupy stable same-band metric slots
- `MEASURED_BY` connectors fan out from `O-050` through distinct endpoint tracks
- parallel or nearby measured-by segments are separated by the fixed connector spacing used by the staged routing layer
- labels for the two measured-by connectors remain readable and do not collide
- the second metric route must not slice across the first metric node or across the outcome node

### 8.3 Required Synthetic Proof Cases

The implementation plan should add focused synthetic cases before promotion:

- multiple outcomes with independent bands
- one opportunity supporting multiple outcomes
- one initiative addressing opportunities in different outcome bands
- one metric measuring multiple outcomes
- dense metric fan-out from one outcome
- missing outcome anchor, requiring deterministic parking

These synthetic cases should prove the middle layer and routing mechanics. They should not drive corpus refresh until the canonical proof cases pass.

## 9. Runtime Contract

Implement a future `outcomeOpportunityMapMiddleLayer` before building the staged scene.

The middle layer is renderer-owned. It is not a public projection shape.

Required concepts:

- `OutcomeOpportunityColumn`
- `OutcomeOpportunityBand`
- `OutcomeOpportunityPhysicalSlot`
- `OutcomeOpportunityCell`
- `OutcomeOpportunityNodePlacement`
- `OutcomeOpportunityMiddleEdge`
- `OutcomeOpportunityConnectorPlan`
- renderer diagnostics

Required placement fields:

- node id and type
- semantic column id
- semantic band id
- anchor outcome id, when present
- physical row/slot order
- placement role, such as `anchor_outcome`, `supporting_opportunity`, `addressing_initiative`, `measuring_metric`, `parking`
- source author order

Required edge channels:

| Edge type | Channel | Primary role |
| --- | --- | --- |
| `SUPPORTS` | `opportunity_support` | central intent relation from opportunity to outcome |
| `ADDRESSES` | `initiative_addressing` | left-side intervention relation from initiative to opportunity |
| `MEASURED_BY` | `outcome_measurement` | right-side evidence relation from outcome to metric |
| `IMPLEMENTED_BY` | `implementation_reference` | secondary relation only when both endpoints are projected |
| `INSTRUMENTED_AT` | `instrumentation_reference` | connector only when projection includes both endpoints; otherwise metric annotation |

Do not reconstruct placement or edge-channel meaning from CSS classes during routing. Use typed metadata or the middle layer directly.

## 10. Scene Construction

Implement a future staged scene builder after the middle layer exists.

Scene construction should:

- resolve profile display policy through `resolveProfileDisplayPolicy(...)`
- call `buildOutcomeOpportunityMapRenderModel(...)`
- build the outcome-opportunity middle layer
- build root grid cells sorted by physical row/slot order, column order, then stable id
- build semantic nodes with shared staged card primitives
- attach typed outcome-opportunity metadata to cells and semantic nodes
- declare node ports explicitly
- declare edge routing intents without final polylines

Expected node ports:

- `intent_in`: west edge, for incoming `ADDRESSES` or `SUPPORTS`
- `intent_out`: east edge, for outgoing `ADDRESSES` or `SUPPORTS`
- `measure_out`: east edge, for outgoing `MEASURED_BY`
- `measure_in`: west edge, for incoming `MEASURED_BY`
- `secondary_in`: north or south edge, for future projected secondary references
- `secondary_out`: north or south edge, for future projected secondary references

If same-edge contention becomes high, add type-specific ports in a routing gate. Do not decide endpoint sides through ad hoc box-center fallback.

## 11. Routing Policy

Routing must follow the service-blueprint and scenario-flow staged style:

- endpoint side selection is semantic and explicit
- outgoing connectors leave perpendicular to the selected node edge
- incoming connectors approach perpendicular to the selected node edge
- connectors never cross source, target, or non-endpoint node interiors
- parallel same-orientation segments with overlapping spans are separated by fixed connector spacing
- route labels are placed after final route geometry is known
- degraded routes emit diagnostics

### 11.1 Connector Priority

Route connectors in this deterministic order:

1. `SUPPORTS`
2. `ADDRESSES`
3. `MEASURED_BY`
4. projected `IMPLEMENTED_BY`, if any
5. projected `INSTRUMENTED_AT`, if any

Within that order, tie-break by:

1. source semantic band order
2. source physical slot order
3. source column order
4. source author order
5. outgoing order from the source node
6. target stable id

`SUPPORTS` comes first because it binds the opportunity to the outcome anchor. `ADDRESSES` and `MEASURED_BY` should read as left and right extensions of that anchor, not as forces that move the outcome band.

### 11.2 Connector Templates

Expected templates:

- same-band `ADDRESSES`: east-to-west horizontal route from initiative to opportunity
- same-band `SUPPORTS`: east-to-west horizontal route from opportunity to outcome
- same-band `MEASURED_BY`: east-to-west horizontal route from outcome to metric
- same-band fan-out to stacked metrics: east departure, measured-column gutter track, then west terminal approach
- cross-band connector: horizontal departure, vertical bridge in a column/band gutter, horizontal terminal approach
- parking connector: deterministic orthogonal fallback with diagnostic

### 11.3 Gutters And Occupancy

The routing implementation must include service-blueprint-equivalent mechanics:

- node-side edge buckets
- per-node right and bottom gutter availability
- global column gutter expansion
- global band/row gutter expansion
- keyed occupancy records by node, column, band/row, edge-local segment, and obstacle-local segment
- deterministic local bundle resolution
- endpoint coordinate displacement on crowded node edges
- segment coordinate displacement for overlapping same-orientation spans
- bounded iterative rerouting after global gutter expansion

The outcome-opportunity router may be smaller than service-blueprint, but it may not use a no-op gutter stage or a "route then hope" shortcut. If final routes still cross node interiors or overlap same-orientation segments, the gate must stop instead of refreshing snapshots.

### 11.4 Labels

Connector labels should be built from the render model's current edge labels unless bundle renderer defaults are extended to own label text.

Rules:

- `ADDRESSES`, `SUPPORTS`, and `MEASURED_BY` labels are visible in all profiles unless future bundle defaults say otherwise.
- Instrumentation annotations obey current profile display: hidden in `simple`, visible in `permissive` and `strict`.
- labels are measured through the staged edge-label measurement service
- labels are placed after routing
- labels must not overlap node boxes, column headers, or other edge labels in the proof cases
- if a fallback is required, emit a diagnostic; do not silently accept a collision

## 12. Debug Artifacts

Required staged outputs:

1. `pre_routing`
   - positioned columns, outcome bands, nodes, headers, and parking bands
   - semantic edges omitted
2. `routing_step_2_edges`
   - endpoint sides, node-edge buckets, and initial route templates
   - no final labels required
3. `routing_step_3_gutters`
   - gutter occupancy, obstacle swerves, endpoint displacement, and segment spacing before final expansion
   - no final labels required
4. final staged artifact
   - final routes, labels, diagnostics, SVG, and PNG

Rendered corpus debug names should follow the service-blueprint and scenario-flow style:

- `pre_routing`
- `routing_step_2_edges`
- `routing_step_3_gutters`

## 13. Preview Backend And Promotion

Add a staged preview backend only after the proof cases are structurally correct.

Suggested backend id:

- `staged_outcome_opportunity_map_preview`

Promotion requirements:

- register the staged backend for SVG and PNG
- keep DOT and Mermaid text artifacts unchanged
- preserve explicit `legacy_graphviz_preview`
- do not remove legacy preview support
- update CLI tests only after staged acceptance
- update rendered corpus preview-only labeling only when `outcome_opportunity_map` is no longer preview-only

## 14. Testing And Acceptance

Required test families:

- bundle renderer-default authority tests if new defaults are added
- projection snapshot preservation tests
- render-model profile-display tests for instrumentation annotations
- middle-layer proof-case placement tests
- RendererScene construction snapshots
- MeasuredScene snapshots, including metric annotation wrapping
- pre-routing PositionedScene and SVG snapshots
- routing step 2 and step 3 snapshots
- final PositionedScene and SVG snapshots
- route geometry tests for endpoint sides, node intersections, and segment separation
- label placement tests for node and label collisions
- preview backend capability tests after registration
- CLI preview default tests after promotion
- rendered corpus tests after promotion

Acceptance before snapshots:

- the two canonical proof cases match the placement tables in this document
- profile display for instrumentation annotations matches bundle renderer defaults
- final proof-case routes avoid non-endpoint node boxes
- route labels are readable and collision-free in the proof cases
- debug artifacts expose meaningful stage differences
- no diagnostics hide structural failures as acceptable output

Snapshot refresh is evidence capture, not a way to normalize failure.

## 15. Stop Conditions

Stop implementation and report the mismatch if:

- staged layout or routing appears to require Elk, Graphviz, Mermaid, or another external layout engine
- a needed behavior belongs in bundle renderer defaults but cannot yet be expressed by the bundle
- placement depends on CSS classes instead of typed metadata or middle-layer data
- routing starts reconstructing semantic placement rather than consuming the middle layer
- final routes cross non-endpoint node boxes in either canonical proof case
- labels can only be made readable through hardcoded proof-case coordinates
- tests pass but visual output violates the proof-case invariants
- snapshots or rendered corpus artifacts would need updating while proof-case output is still structurally wrong

## 16. Documentation Updates During Implementation

When implementation lands, update docs only after behavior exists:

- `docs/toolchain/renderer_migration_guidance.md` for staged outcome-opportunity status
- `docs/toolchain/architecture.md` for the new staged backend
- `docs/toolchain/development.md` with preview/debug commands
- `docs/doc_site/diagram_types/README.md` when the view is promoted out of planned/preview-only status
- `examples/rendered/v0.1/README.md` after corpus artifacts are refreshed

Do not update status docs ahead of behavior except where the future gated implementation plan explicitly calls for an authority-alignment gate.
