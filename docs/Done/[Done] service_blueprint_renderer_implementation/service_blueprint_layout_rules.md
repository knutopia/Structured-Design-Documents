# Service Blueprint Layout Rules

Status: de-elked

This document is meant to define the layout rules that a `service_blueprint` implementation must honor. 

This document initially targeted Elk for layout and routing. The Elk implementation has failed in practice. The document remains to provide service blueprint relevant information.

## Purpose

`service_blueprint` is not just "a graph with lanes".

It is a journey-anchored matrix:

- time runs left to right
- visibility / responsibility runs top to bottom
- customer actions define the narrative spine
- supporting actions explain how each customer step is delivered
- data and policy are supporting elements in lower support rows, not the main storyline

The goal of these rules is to provide a semantic target before we decide exact graph encoding details.

## Grounding Inputs

Local source-of-truth inputs:

- `examples/rendered/v0.1/journey_map_diagram_type [preview_only]/service_blueprint_slice_example/service_blueprint_slice.sdd`
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
7. Some blueprints include optional secondary elements such as physical evidence / touchpoints or
   policy / regulation context, but those elements vary by blueprint and are not all currently
   modeled in SDD.

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

Within `system`, distinguish two conceptual sublanes for rendering and readability:

- `system_action` for `SystemAction`
- `system_resource` for `DataEntity`

These sublanes share the same chronology bands and do not create new semantic time steps.

That distinction matters for placement. `DataEntity` and `Policy` nodes should remain visually secondary within their support rows or sublanes and should not be allowed to consume the same visual role as primary action nodes unless a local readability exception is explicitly chosen.

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

- occupies `system_action`
- inherits its preferred band from the upstream `Process` that depends on it
- same-band placement is the default
- move to the next interstitial band only when needed to express a genuine internal sequence

#### `DataEntity`

- occupies `system_resource`
- is not a primary timeline node
- use one canonical node per entity in a blueprint slice
- anchor it by first write; if there is no write, anchor by first read
- keep later accesses connected back to that anchored node rather than duplicating the entity across multiple bands
- do not move the canonical node to a later band merely to shorten later edges

#### `Policy`

- is not a primary timeline node
- stays in `policy` as a support element, not a primary action node
- use one canonical node per policy in a blueprint slice
- anchor it by first constrained occurrence
- if every constrained occurrence falls within one semantic band, align the policy node to that band; otherwise keep one canonical policy node at its anchored band and route later constraints back to it

### 9. Keep shared support nodes canonical within support rows

Shared `DataEntity` and `Policy` nodes should remain single canonical support nodes in their support rows or sublanes, aligned to a stable semantic band derived from their anchoring relation.

Why:

- it keeps the action narrative readable
- it preserves the layered structure described by service blueprint sources
- it prevents data and policy nodes from stealing customer-step columns
- it turns repeated `READS`, `WRITES`, and `CONSTRAINED_BY` edges into readable links back to stable support nodes rather than random graph clutter

Physical realization:

- a semantic band is a chronology column, not an arbitrary x-position
- a renderer may use more than one physical placement slot to realize one semantic band when needed for readability
- those physical placement slots do not create new semantic bands or new chronology
- support-node collisions are allowed; they do not make the diagram invalid
- if multiple support nodes land in the same semantic band and support row or sublane, the renderer should first realize them using stable local packing within that same band
- if local packing would become unreadable, the renderer may introduce one or more auxiliary spill slots immediately to the right of the owning semantic band
- an auxiliary spill slot remains semantically attached to its owning band; it is a physical realization aid, not a new chronological step
- tie-breaking for local packing and spill-slot order should follow:
  1. anchoring relation
  2. author order
  3. stable ID order
- do not duplicate the same `DataEntity` or `Policy` across multiple bands solely to shorten edges

Authoring guidance:

- authors should prefer simple slices with a readable number of support nodes per band
- dense support-node collisions should be treated as a readability warning, not as illegal input

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

`READS` and `WRITES` connect action nodes to canonical support resources in the `system_resource` sublane of the `system` support row.

- they should usually route from action bands to the anchored `DataEntity` node while preserving that node's stable band alignment
- when the renderer realizes that node in an auxiliary spill slot, the connector should still read as targeting the canonical support node owned by the original semantic band
- `READS` and `WRITES` on the same entity must stay semantically distinct even if they touch the same target node
- a single `DataEntity` node should aggregate repeated access from multiple system actions

### 15. `CONSTRAINED_BY` is a policy relation

`CONSTRAINED_BY` should read as "this action is governed by that policy", not as sequence.

- it should not compete visually with `PRECEDES`
- it should route toward the canonical policy node in the `policy` row while preserving that node's semantic-band ownership
- repeated constraints to the same policy should converge on one policy node

## Example: `service_blueprint_slice`

Using the current example slice, the semantic banding should look roughly like this:

| Band | Role | Preferred contents |
| --- | --- | --- |
| `A1` | customer anchor | `J-020`, `PR-020`, `SA-020`, canonical `D-020` support anchor, canonical `PL-020` support anchor |
| `I1` | interstitial | `PR-021`, `SA-021` |
| `A2` | customer anchor | `J-021`, `PR-022`, `SA-022` |

Key reading:

- `J-020` anchors the first service moment
- `PR-020` and `SA-020` belong with that moment
- `PR-021` and `SA-021` happen after that first moment but before the confirmation moment
- `J-021` and `PR-022` share the confirmation band
- `PL-020` is a policy support node aligned to the first service moment because all constrained
  occurrences in the slice happen in `A1`
- `D-020` is a shared support resource aligned to `A1` because its first write occurs there, and later reads route back to that canonical node
- physical realization may use either a primary local support slot in `A1` or an auxiliary spill slot owned by `A1`; neither choice creates a new semantic band

## [Deprecated:] Middle-Layer ELK Encoding Contract

Elk has failed.

## Open Questions for Future SDD Semantics

These do not block the current rules, but they matter:

1. Should SDD eventually model a first-class `Evidence` / `Touchpoint` lane above `customer`?
2. Should `system_action` and `system_resource` eventually become first-class SDD semantics rather than renderer-level concepts?
3. Should `Event` remain out of scope for `service_blueprint`, or become an annotation / supporting element?
4. When a step has multiple `REALIZED_BY` targets across multiple operational lanes, do we need a notion of "primary realization" versus "supporting realization"?

## Short Version

The layout target is:

- fixed semantic rows, with conceptual support sublanes where needed for readability
- customer-step anchor columns
- optional interstitial operational columns
- band-aligned canonical support nodes for data and policy
- physical placement slots that may realize one semantic band without creating new chronology
- local support-node packing first, auxiliary spill slots second
- straight primary chronology
- secondary support and resource routing

That is the mental model future ELK code should implement.
