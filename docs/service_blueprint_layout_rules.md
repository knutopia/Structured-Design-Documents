# Service Blueprint Layout Rules for ELK Input

Status: working draft

This document is meant to define the layout rules that an ELK-backed `service_blueprint` implementation must honor. Older local `service_blueprint` ELK / architecture notes are intentionally not treated as authoritative here.

## Purpose

`service_blueprint` is not just "a graph with lanes".

It is a journey-anchored matrix:

- time runs left to right
- visibility / responsibility runs top to bottom
- customer actions define the narrative spine
- supporting actions explain how each customer step is delivered
- data and policy are supporting sidecars, not the main storyline

The goal of these rules is to give future ELK layout code a semantic target before we decide exact graph encoding details.

## Grounding Inputs

Local source-of-truth inputs:

- `examples/rendered/v0.1/journey_map_diagram_type/service_blueprint_slice_example/service_blueprint_slice.sdd`
- `bundle/v0.1/core/views.yaml`
- `definitions/v0.1/endpoint_contracts_semantic_rules_sdd_text_v_0_dot_1.md`
- `docs/service_blueprint_renderer_implementation/reference/service_blueprint_slice.service_blueprint.tight_routing.png`
- `docs/service_blueprint_renderer_implementation/reference/service_blueprint_slice.service_blueprint.tight_routing.svg`

Current external references:

- NN/g, "Service Blueprints: Definition"  
  https://www.nngroup.com/articles/service-blueprints-definition/
- Service Design Tools, "Service Blueprint"  
  https://servicedesigntools.org/tools/service-blueprint
- Precursive, "What is Service Blueprinting?"  
  https://www.precursive.com/post/what-is-service-blueprinting
- TheyDo, "The service blueprint template explained"  
  https://www.theydo.com/best-practices/the-service-blueprint-template-explained
- TheyDo, "Service blueprint template"  
  https://www.theydo.com/templates/service-blueprint-template
- ELK Layered reference  
  https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html
- ELK reference index  
  https://eclipse.dev/elk/reference.html

## Current SDD Semantics to Honor

From `bundle/v0.1/core/views.yaml`, the current `service_blueprint` view includes:

- node types: `Step`, `Process`, `SystemAction`, `DataEntity`, `Policy`
- edge types: `REALIZED_BY`, `DEPENDS_ON`, `READS`, `WRITES`, `CONSTRAINED_BY`, `PRECEDES`
- ordering edge: `PRECEDES`

Current lane defaults are:

| Lane | Meaning in current SDD |
| --- | --- |
| `customer` | `Step` |
| `frontstage` | `Process visibility=frontstage` |
| `backstage` | `Process visibility=backstage` |
| `support` | `Process visibility=support` |
| `system` | `SystemAction`, `DataEntity` |
| `policy` | `Policy` |

Current visibility aliases are:

- `customer-visible -> frontstage`
- `not-visible -> backstage`

Important current scope limits:

- `Event` is currently out of scope for `service_blueprint`
- `EMITS` is therefore not a layout driver for this view today
- there is no explicit `physical evidence` / `touchpoint` node type in current SDD semantics

## What External Service Blueprint Sources Agree On

Across the external references, the consistent structure is:

1. A service blueprint is tied to a specific customer journey, not an undifferentiated process map.
2. The horizontal axis expresses sequence over time.
3. The vertical axis separates customer-visible from not-visible work.
4. The customer journey is the anchor, and internal work is organized in relation to it.
5. Frontstage, backstage, and supporting processes are distinct layers.
6. Dependencies matter and should be visible.
7. Many blueprints include a physical evidence / touchpoint layer, but that layer is optional and
   not currently modeled in SDD.

The main implication for layout code is simple:

`service_blueprint` must optimize for human reading structure first and graph compactness second.

## Layout Priorities

When layout tradeoffs conflict, use this priority order:

1. Preserve semantic lane order and separator meaning.
2. Preserve the left-to-right customer journey spine.
3. Preserve local chronological order within operational flows.
4. Align directly related actions into the same or adjacent concurrency bands.
5. Keep the main `PRECEDES` flow straighter than support/resource edges.
6. Push data and policy clutter away from the main action flow.
7. Minimize crossings, but never by destroying the blueprint reading model.

## Required Layout Invariants

### 1. Journey-first

A valid `service_blueprint` layout is organized around customer `Step` nodes.

- If `Step` nodes exist, they define the top narrative spine.
- If no `Step` nodes exist, the renderer is in a degraded case and should still be deterministic,
  but the output is closer to an operational support map than a true service blueprint.

### 2. Fixed macro-lane order

Top-to-bottom lane order is fixed:

1. `customer`
2. `frontstage`
3. `backstage`
4. `support`
5. `system`
6. `policy`

This order is semantic, not cosmetic.

### 3. Separator lines are part of meaning

The layout should visually preserve these boundaries:

- between `customer` and `frontstage`: line of interaction
- between `frontstage` and `backstage`: line of visibility
- between `backstage` and `support`: line of internal interaction

`system` and `policy` sit below the internal-interaction boundary as infrastructure-support rows.

### 4. Distinguish action lanes from resource lanes

These lanes participate differently in chronology:

- action lanes: `customer`, `frontstage`, `backstage`, `support`
- resource lanes: `system`, `policy`

Within `system`, `SystemAction` is action-like. `DataEntity` is resource-like.

That distinction matters for placement. `DataEntity` and `Policy` nodes should not be allowed to consume the same visual role as primary action nodes unless a local exception is explicitly chosen.

### 5. Stable ordering

When several placements satisfy the same semantic rule, break ties with:

1. semantic dependency order
2. author order from the source document
3. stable ID order

The same input must produce the same band assignment and the same relative ordering every time.

## Column and Band Rules

The layout needs a notion of vertical concurrency bands. A band is a semantic column, not just an
arbitrary x-position.

### 6. Customer steps create anchor bands

`Step -> Step` `PRECEDES` order defines the anchor bands of the blueprint.

- Each customer step gets a primary anchor band.
- If customer `PRECEDES` is absent, fall back to author order.
- Anchor bands must appear in customer order from left to right.

### 7. Operational work may create interstitial bands

Operational `Process` and `SystemAction` nodes can require extra bands between customer anchor bands.

Use interstitial bands when:

- a `Process -> Process` `PRECEDES` chain advances work between two customer steps
- chained `SystemAction` work would otherwise collapse unrelated actions into one crowded column
- keeping all operational work in the customer step's anchor band would destroy readability

Do not create empty or speculative bands. Interstitial bands must correspond to actual semantic progression.

### 8. Band assignment by node type

#### `Step`

- always occupies its own anchor band in `customer`

#### `Process`

- if directly `REALIZED_BY` a `Step`, prefer that step's anchor band
- if a process chain continues beyond the originating step, later processes may move into interstitial bands
- if a process is also the direct realization target of a later customer step, it should align to that later step's anchor band rather than float between steps

#### `SystemAction`

- inherits its preferred band from the upstream `Process` that depends on it
- same-band placement is the default
- move to the next interstitial band only when needed to express a genuine internal sequence

#### `DataEntity`

- is not a primary timeline node
- default placement is a resource sidecar position, not a primary action slot
- use one canonical node per entity in a blueprint slice
- anchor it by first write; if there is no write, anchor by first read

#### `Policy`

- is not a primary timeline node
- default placement is a policy sidecar position, not a primary action slot
- use one canonical node per policy in a blueprint slice
- anchor it by first constrained occurrence

### 9. Prefer a right-side resource rail for shared sidecars

For shared `DataEntity` and `Policy` nodes, the default layout should use a right-side sidecar rail or sidecar subcolumns rather than mixing them into the main action flow.

Why:

- it keeps the action narrative readable
- it prevents data and policy nodes from stealing customer-step columns
- it turns repeated `READS`, `WRITES`, and `CONSTRAINED_BY` edges into "fan-out to support resources" rather than random graph clutter

Local exception:

- if a resource is only used within a single band and colocating it clearly improves readability, it may occupy a local sidecar subcolumn adjacent to that band

### 10. Orphans and disconnected nodes

Disconnected or weakly connected nodes should not destabilize the main blueprint.

- Keep connected customer-journey structure first.
- Place disconnected nodes in terminal parking bands at the far right of their own lane.
- Preserve author order within that parking region.
- Only use a synthetic `ungrouped` lane as a diagnostic fallback when semantic lane derivation fails.

## Edge Family Rules

### 11. `PRECEDES` is the primary flow family

`PRECEDES` is the main chronology driver.

- `Step -> Step` has the highest straightness priority
- `Process -> Process` is secondary chronology and must not pull customer steps out of order
- forward left-to-right flow is the default
- loops are allowed, but they are exceptions and should be visibly secondary

### 12. `REALIZED_BY` is an explanatory vertical relation

`REALIZED_BY` explains how a customer step is delivered.

- it should usually connect a step to a process in the same band
- if the realizing process is in a lower lane, the preferred visual reading is vertical or near-vertical
- it must not become a stronger ordering force than customer-step `PRECEDES`

### 13. `DEPENDS_ON` is a support descent

`DEPENDS_ON` usually connects an operational action to lower-layer support work.

- prefer same-band or next-band placement
- prefer downward or downward-diagonal reading
- avoid sending it backward to earlier bands unless the model truly encodes a loop

### 14. `READS` and `WRITES` are resource access relations

`READS` and `WRITES` connect action nodes to resource sidecars.

- they should usually route from action bands to a sidecar rail or local sidecar subcolumn
- `READS` and `WRITES` on the same entity must stay semantically distinct even if they touch the same target node
- a single `DataEntity` node should aggregate repeated access from multiple system actions

### 15. `CONSTRAINED_BY` is a policy relation

`CONSTRAINED_BY` should read as "this action is governed by that policy", not as sequence.

- it should not compete visually with `PRECEDES`
- it should route toward policy sidecars
- repeated constraints to the same policy should converge on one policy node

## Example: `service_blueprint_slice`

Using the current example slice, the semantic banding should look roughly like this:

| Band | Role | Preferred contents |
| --- | --- | --- |
| `A1` | customer anchor | `J-020`, `PR-020`, `SA-020` |
| `I1` | interstitial | `PR-021`, `SA-021` |
| `A2` | customer anchor | `J-021`, `PR-022`, `SA-022` |
| `R*` | sidecar rail | `D-020`, `PL-020` |

Key reading:

- `J-020` anchors the first service moment
- `PR-020` and `SA-020` belong with that moment
- `PR-021` and `SA-021` happen after that first moment but before the confirmation moment
- `J-021` and `PR-022` share the confirmation band
- `D-020` and `PL-020` support the flow but are not themselves part of the customer-visible
  storyline

## Middle-Layer ELK Encoding Contract

This section defines the middle layer between service-blueprint semantics and final ELK layout.

It is the missing translation contract between:

- the semantic rules above
- the staged-renderer architecture in `docs/toolchain/renderer_migration_guidance.md`
- the `service_blueprint` reset constraints in
  `docs/service_blueprint_renderer_implementation/Service Blueprint Renderer Reset.md`

The intent is to make future implementation planning decision-ready without freezing exact ELK JSON
or exact route choreography.

### Purpose Of The Middle Layer

The middle layer translates service-blueprint semantics into ELK-visible structure before ELK
computes final geometry.

Its responsibilities are:

- turn semantic lanes into lane shells
- turn semantic chronology into anchor bands, interstitial bands, sidecar rails, and parking bands
- turn edge families into explicit edge channels and port roles
- hand ELK one coherent, deterministic layout problem

The middle layer is renderer-owned, deterministic, and pre-ELK.

It exists specifically to avoid the rejected two-pass pattern of:

- asking ELK for approximate ordering
- snapping nodes into rigid rows afterward
- rerouting or repairing edges after the fact

### Ownership Boundary

Ownership is split as follows:

- projection owns semantic scope, included nodes and edges, lane membership inputs, omissions, and
  author order
- the middle layer owns derived bands, sidecar-rail decisions, parking-band decisions, ELK-visible
  containers or partitions, edge channels, port roles, and ordering or priority hints
- ELK owns final coordinates, final bend points, and final routed sections in one coherent run
- SVG and backend code consume final geometry and paint it; they must not reinterpret
  service-blueprint semantics or repair layout decisions after ELK

The middle layer may derive additional structural objects that are not first-class SDD semantics,
but those objects must remain renderer-internal and must not leak back into projection as fake graph
semantics.

### ELK-Visible Object Model

The middle layer must materialize the following objects before ELK runs:

| Semantic concept | Middle-layer object | ELK-visible representation | Notes |
| --- | --- | --- | --- |
| Whole blueprint | `blueprint root` | one root graph or top-level compound container | owns overall direction, hierarchy handling, and top-level sequencing context |
| Semantic lane | `lane shell` | one ELK-visible structural container per lane | lanes are structural objects, not post-layout y-snaps |
| Customer-step band | `anchor band` | one ELK-visible sequencing object in left-to-right order | anchor bands carry the primary service moments |
| Operational between-step band | `interstitial band` | one ELK-visible sequencing object inserted between anchor bands | created only for real semantic progression |
| Disconnected far-right placement | `parking band` | one ELK-visible terminal sequencing object in a lane | preserves main blueprint first while keeping orphans deterministic |
| Shared resource area | `sidecar rail` | one ELK-visible sidecar region to the right of action bands | structurally distinct from action bands |
| Local sidecar exception | `local sidecar subcolumn` | one ELK-visible local sidecar region adjacent to a band | used only when the local exception is explicitly justified |
| Node placement decision | `semantic node placement` | membership of one node in exactly one lane shell and one band or sidecar region | the middle layer decides this before ELK |
| Edge family routing intent | `edge channel` / `port role` | explicit source and target attachment roles, and any needed ordering hints | keeps primary flow from fighting with support or sidecar access |
| Meaningful lane boundary | `separator lines` | renderer-painted artifacts derived from final lane-shell geometry | not primary ELK drivers and not a substitute for lane shells |

Important consequences:

- lane shells are required ELK-visible structure
- anchor bands, interstitial bands, parking bands, and sidecar rails are required ELK-visible
  sequencing structure, not incidental x-positions that happen to emerge
- separator lines are painted from resolved lane-shell boundaries after layout; they preserve
  meaning, but they are not themselves the thing that ELK optimizes

### Normative Encoding Rules

Before ELK runs, the middle layer must produce these assignments:

- every in-scope node belongs to exactly one lane shell
- every action-like node belongs to exactly one anchor band, interstitial band, or parking band
- every sidecar node belongs either to the shared right-side sidecar rail or to an explicitly
  justified local sidecar subcolumn
- disconnected or weakly connected nodes go to parking bands at the far right of their own lane
- customer-step order defines anchor-band order
- interstitial bands are created only from real semantic progression and not as speculative
  spacing placeholders

For current `service_blueprint` semantics:

- `Step`, `Process`, and chronology-participating `SystemAction` nodes are action-like for band
  assignment
- `DataEntity` and `Policy` nodes are sidecar nodes by default
- `SystemAction` may be placed in a sidecar-like local exception only if a future rule explicitly
  allows it; the default contract keeps it in the action chronology

Edge families must be encoded as distinct edge channels with distinct port roles:

- `PRECEDES` uses primary-flow channels
- `REALIZED_BY` and `DEPENDS_ON` use support channels
- `READS`, `WRITES`, and `CONSTRAINED_BY` use resource or policy channels

Further rules:

- semantic edges remain distinct in the middle layer even if a later visual treatment lets nearby
  routes share corridors
- `READS`, `WRITES`, and `CONSTRAINED_BY` must not collapse into one undifferentiated sidecar edge
  family before routing
- band derivation and sidecar placement are middle-layer decisions made before ELK, not something
  ELK is expected to infer from raw edges alone

### Allowed ELK Mechanism Families

The middle layer may use the following ELK mechanism families as tools:

- hierarchy and compound containers
- layout partitioning for left-to-right band sequencing
- model-order preservation
- in-layer predecessor or successor constraints
- explicit ports with fixed-side or fixed-order behavior
- edge-family straightness and shortness priorities

These are allowed tools, not the contract itself.

The contract is semantic and renderer-owned:

- the middle layer decides which lane shell, band, sidecar rail, edge channel, and port role exist
- implementation may use different ELK option combinations over time as long as the contract above
  is preserved
- exact option values, exact tuning, and exact JSON shape are implementation details for the later
  implementation plan

### Worked Encoding Sketch: `service_blueprint_slice`

Using the current example, the middle layer should derive these lane shells:

- `customer`: `J-020`, `J-021`
- `frontstage`: `PR-020`
- `backstage`: `PR-021`
- `support`: `PR-022`
- `system`: `SA-020`, `SA-021`, `SA-022`, `D-020`
- `policy`: `PL-020`

It should derive these sequencing objects:

- `A1` anchor band: `J-020`, `PR-020`, `SA-020`
- `I1` interstitial band: `PR-021`, `SA-021`
- `A2` anchor band: `J-021`, `PR-022`, `SA-022`
- `R*` sidecar rail: `D-020`, `PL-020`

It should derive these edge-channel and port-role expectations:

- `J-020 -> J-021` and `PR-020 -> PR-021 -> PR-022` use primary-flow channels
- `J-020 REALIZED_BY PR-020` and `J-021 REALIZED_BY PR-022` use support channels with
  same-band or near-vertical reading
- `PR-020 DEPENDS_ON SA-020`, `PR-021 DEPENDS_ON SA-021`, and `PR-022 DEPENDS_ON SA-022` use
  support channels aimed downward into lower lane shells
- `SA-020 READS D-020`, `SA-020 WRITES D-020`, `SA-021 READS D-020`, `SA-022 READS D-020`, and
  `PR-020 CONSTRAINED_BY PL-020`, `SA-020 CONSTRAINED_BY PL-020` use resource or policy channels
  toward the sidecar rail

This sketch is conceptual on purpose.

It defines which ELK-visible structure must exist and which routing intents must be preserved, but
it does not prescribe full ELK JSON or exact bend points.

### Non-Goals And Prohibited Shortcuts

The middle-layer contract does not require:

- exact column widths
- exact row heights
- exact bend-point choreography from the reference SVG or PNG
- literal ELK JSON in the documentation
- projection storing final coordinates or final route geometry
- ELK becoming the renderer scene format

The middle-layer contract explicitly forbids:

- post-layout snapping of nodes into lane rows
- renderer-side routing fallback on the staged `service_blueprint` path
- treating semantic lanes or bands as purely cosmetic overlays
- using the reference design notes as a bend-for-bend routing contract

The reference image and reference design notes remain valuable acceptance exemplars for reading
structure, edge-family emphasis, and overall visual discipline. They are not a license to re-create
the rejected handcrafted repair path.

## ELK Input Requirements Derived from These Rules

These are hard constraints derived from the semantic rules above and the middle-layer contract.

They summarize what later implementation work must preserve.

### 16. Lanes and bands must be ELK-visible

If ELK is used for final geometry, lane shells, bands, and any sidecar rail placements must exist
as ELK-visible structure before layout.

Do not expect ELK to infer blueprint rows, service moments, or sidecar policy from raw edges alone.

### 17. No post-layout snapping contract

Final node placement and final route geometry must come from one coherent layout pass or one
coherent composed layout system.

The middle-layer decisions above must therefore be encoded before or during ELK layout, not patched
in afterward.

### 18. Explicit ports by edge family

The ELK input should expose different edge channels and port roles for at least:

- primary flow
- support dependencies
- resource / policy sidecar access

Primary chronology must not fight for the same attachment roles as support or sidecar edges.

### 19. Use ELK as a constrained solver, not as the semantic author

The blueprint rules and middle-layer contract in this document define lane order, band meaning,
sidecar policy, edge channels, and ownership boundaries.

ELK should solve positions and routes within that contract, not invent it.

### 20. Use current ELK features as hints, not as substitutes for semantics

Current ELK mechanism families that may help include:

- model-order preservation
- explicit ports and orthogonal routing
- in-layer constraints
- hierarchy handling
- layout partitioning for left-to-right band sequencing

Those mechanisms are admissible tools, but none of them replaces explicit middle-layer derivation of
lane shells, anchor bands, interstitial bands, parking bands, or sidecar rails.

### 21. Labels are secondary

Edge labels such as `depends on`, `reads`, `writes`, and `constrained by` are useful, but they are
secondary to preserving clean blueprint structure.

If label placement destabilizes geometry, prefer:

- keeping structure readable first
- placing or refining some labels after the main geometry is known

## Open Questions for Future SDD Semantics

These do not block the current rules, but they matter:

1. Should SDD eventually model a first-class `Evidence` / `Touchpoint` lane above `customer`?
2. Should `system` split into separate action and resource sublanes for `SystemAction` and `DataEntity`?
3. Should `Event` remain out of scope for `service_blueprint`, or become an annotation / sidecar?
4. When a step has multiple `REALIZED_BY` targets across multiple operational lanes, do we need a notion of "primary realization" versus "supporting realization"?

## Short Version

The layout target is:

- fixed semantic rows
- customer-step anchor columns
- optional interstitial operational columns
- sidecar resource rails for data and policy
- straight primary chronology
- secondary support and resource routing

That is the mental model future ELK code should implement.
