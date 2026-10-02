# Hidden Edge Reference by Diagram Type

Reference for relationships that are hidden, represented as annotations, or
shown with less detail in the v0.2 staged SVG/PNG renderers. The tables compare
`--detail compact` with `--detail detailed`. Validation profiles (`simple`,
`permissive`, and `strict`) govern validation; they do not select render detail.

> [!IMPORTANT]
> In technical terms, this page is downstream documentation. The
> [v0.2 view configuration](https://github.com/knutopia/Structured-Design-Documents/blob/main/bundle/v0.2/core/views.yaml)
> governs node and edge inclusion, reference annotations, and render-detail
> policies. The
> [v0.2 relationship contracts](https://github.com/knutopia/Structured-Design-Documents/blob/main/bundle/v0.2/core/contracts.yaml)
> govern legal endpoints and relationship directionality.

Each section covers legal endpoint triples with at least one node type in that
view. A relationship can be valid in the document and still be entirely hidden in a
particular view.

The bundle also contains a complete guided-authoring matrix with `primary`,
`supporting`, and `bridge` roles and historical `simple`/`strict` display
classifications (`permissive` aliases `strict`). Those guidance records do not
select the current renderer's detail policy. The tables below describe the
staged renderers using `renderer_defaults.detail_display` and, for UI Contracts,
`ui_contracts_presentation`.

## Legend

| Marker | Meaning |
| --- | --- |
| **A — entirely hidden** | The relationship has no connector, structural presentation, or reference annotation in either detail. An endpoint may be outside the view, or the relationship may be excluded from its presentation. |
| **B — detailed annotation** | Hidden in compact output; detailed output shows an in-node reference annotation. The counterpart remains outside the primary node set. |
| **C — detailed label** | The connector is visible in both details. Its branch or relationship label appears only in detailed output. |
| **D\* — conditional node** | Detailed output shows the secondary or supporting nodes and their connectors. Compact output hides them unless UI Contracts uses its State-only fallback: no `ViewState` nodes and at least one `State` node. |

::: dropdownSwitch Diagram Type
== IA Place Map

Available node types: `Area`, `Place`

| Node in this view | Edge | `compact` | `detailed` |
| --- | --- | --- | --- |
| `Place` | `Place CONTAINS ViewState` | Target `ViewState` is outside the view | **A — entirely hidden** |
| `Place` | `Place COMPOSED_OF Component` | Target `Component` is outside the view | **A — entirely hidden** |
| `Place` | `Place CONSTRAINED_BY Policy` | Target `Policy` is outside the view | **A — entirely hidden** |
| `Place` | `Initiative IMPLEMENTED_BY Place` | Source `Initiative` is outside the view | **A — entirely hidden** |
| `Place` | `JourneyStep REALIZED_BY Place`<br>`BlueprintStep REALIZED_BY Place`<br>`ScenarioStep REALIZED_BY Place` | Source Step types are outside the view | **A — entirely hidden** |
| `Place` | `Metric INSTRUMENTED_AT Place` | Source `Metric` is outside the view | **A — entirely hidden** |

The following relationships are visible in both details:

- `Area CONTAINS Place`
- `Place CONTAINS Place`
- `Place NAVIGATES_TO Place`

IA Place Map has no detailed-only relationship annotations or edge labels.
Its detail policy changes Place metadata, such as route and access information.

== UI Contracts

Available node types: `Place`, `ViewState`, `Component`, `State`, `Event`, `DataEntity`, `SystemAction`

### Entirely hidden relationships

| Node in this view | Edge | `compact` | `detailed` |
| --- | --- | --- | --- |
| `Place` | `Area CONTAINS Place` | Source `Area` is outside the view | **A — entirely hidden** |
| `Place` | `Place CONTAINS Place` | No UI presentation rule selects this hierarchy | **A — entirely hidden** |
| `Place` | `Place NAVIGATES_TO Place` | Relationship is outside the view's edge set | **A — entirely hidden** |
| `State` | `State PRECEDES State` | Relationship is outside the view's edge set | **A — entirely hidden** |
| `Place`, `ViewState`, `Component`, `SystemAction` | `Initiative IMPLEMENTED_BY Place`<br>`Initiative IMPLEMENTED_BY ViewState`<br>`Initiative IMPLEMENTED_BY Component`<br>`Initiative IMPLEMENTED_BY SystemAction` | Source `Initiative` is outside the view | **A — entirely hidden** |
| `Place` | `JourneyStep REALIZED_BY Place`<br>`BlueprintStep REALIZED_BY Place`<br>`ScenarioStep REALIZED_BY Place` | Source Step types are outside the view | **A — entirely hidden** |
| `ViewState` | `JourneyStep REALIZED_BY ViewState`<br>`BlueprintStep REALIZED_BY ViewState`<br>`ScenarioStep REALIZED_BY ViewState` | Source Step types are outside the view | **A — entirely hidden** |
| `Event` | `Process EMITS Event` | Source `Process` is outside the view | **A — entirely hidden** |
| `SystemAction` | `Process DEPENDS_ON SystemAction` | Source `Process` is outside the view | **A — entirely hidden** |
| `Place`, `SystemAction` | `Place CONSTRAINED_BY Policy`<br>`SystemAction CONSTRAINED_BY Policy` | Target `Policy` is outside the view | **A — entirely hidden** |
| `SystemAction`, `DataEntity` | `SystemAction READS DataEntity`<br>`SystemAction WRITES DataEntity` | Relationships are outside the view's edge set | **A — entirely hidden** |
| `Place`, `ViewState`, `Event` | `Metric INSTRUMENTED_AT Place`<br>`Metric INSTRUMENTED_AT ViewState`<br>`Metric INSTRUMENTED_AT Event` | Source `Metric` is outside the view | **A — entirely hidden** |

### Secondary and supporting content

| Node in this view | Edge | `compact` | `detailed` |
| --- | --- | --- | --- |
| `ViewState`, `Event` | `ViewState EMITS Event` | Supporting `Event` suppressed | **D\* — conditional node** |
| `ViewState`, `SystemAction` | `ViewState DEPENDS_ON SystemAction` | Supporting `SystemAction` suppressed | **D\* — conditional node** |
| `Component`, `Event` | `Component EMITS Event` | Supporting `Event` suppressed except in State-only fallback | **D\* — conditional node** |
| `Component`, `SystemAction` | `Component DEPENDS_ON SystemAction` | Supporting `SystemAction` suppressed except in State-only fallback | **D\* — conditional node** |
| `Component`, `DataEntity` | `Component BINDS_TO DataEntity` | Supporting `DataEntity` suppressed except in State-only fallback | **D\* — conditional node** |
| `State` | `State TRANSITIONS_TO State` | Secondary State graph suppressed except in State-only fallback | **D\* — conditional node** |
| `SystemAction`, `Event` | `SystemAction EMITS Event` | Supporting nodes suppressed except in State-only fallback | **D\* — conditional node** |

The State-only fallback cannot apply to a relationship sourced by `ViewState`,
because that source itself establishes the primary ViewState graph. Merely
having no ViewStates does not enable the fallback: a State node must exist.
The controlling switches are
`show_secondary_state_groups_when_primary_view_state` and
`show_supporting_contract_lane_when_primary_view_state`.

The following relationships remain visible in both details:

- `Component CONTAINS Component`: the enclosure overview shows the hierarchy;
  local scopes draw labeled parent/child connectors.
- `Place CONTAINS ViewState`: represented through scope membership.
- `Place COMPOSED_OF Component` and `ViewState COMPOSED_OF Component`: labeled
  connectors to lightweight Component references.
- `ViewState TRANSITIONS_TO ViewState`: the primary transition graph.

Compact output can omit empty Place containers and simple scopes according to
the bundle's scope policy. Legacy DOT/Mermaid and Graphviz retain their earlier
structural presentation. See [UI Contracts](./index.md#ui-contracts).

== Scenario Flow

Available node types: `ScenarioStep`, `Place`, `ViewState`

### Entirely hidden relationships

| Node in this view | Edge | `compact` | `detailed` |
| --- | --- | --- | --- |
| `ScenarioStep` | `ScenarioStep REALIZED_BY Process` | Target `Process` is outside the view | **A — entirely hidden** |
| `Place` | `Area CONTAINS Place` | Source `Area` is outside the view | **A — entirely hidden** |
| `Place`, `ViewState` | `Place CONTAINS Place`<br>`Place CONTAINS ViewState` | Containment is outside the view's edge set | **A — entirely hidden** |
| `Place`, `ViewState` | `Place COMPOSED_OF Component`<br>`ViewState COMPOSED_OF Component` | Target `Component` is outside the view | **A — entirely hidden** |
| `Place`, `ViewState` | `Initiative IMPLEMENTED_BY Place`<br>`Initiative IMPLEMENTED_BY ViewState` | Source `Initiative` is outside the view | **A — entirely hidden** |
| `Place` | `JourneyStep REALIZED_BY Place`<br>`BlueprintStep REALIZED_BY Place` | Other Step types are outside the view | **A — entirely hidden** |
| `ViewState` | `JourneyStep REALIZED_BY ViewState`<br>`BlueprintStep REALIZED_BY ViewState` | Other Step types are outside the view | **A — entirely hidden** |
| `ViewState` | `ViewState EMITS Event` | Target `Event` is outside the view | **A — entirely hidden** |
| `ViewState` | `ViewState DEPENDS_ON SystemAction` | Target `SystemAction` is outside the view | **A — entirely hidden** |
| `Place` | `Place CONSTRAINED_BY Policy` | Target `Policy` is outside the view | **A — entirely hidden** |
| `ScenarioStep`, `Place`, `ViewState` | `Metric INSTRUMENTED_AT ScenarioStep`<br>`Metric INSTRUMENTED_AT Place`<br>`Metric INSTRUMENTED_AT ViewState` | Source `Metric` is outside the view | **A — entirely hidden** |

### Incoming refinement references

| Node in this view | Edge | `compact` | `detailed` |
| --- | --- | --- | --- |
| `ScenarioStep` | `JourneyStep REFINED_BY ScenarioStep` | Reference hidden | **B — detailed annotation**: **Refines** lists the JourneyStep parent |
| `ScenarioStep` | `BlueprintStep REFINED_BY ScenarioStep` | Reference hidden | **B — detailed annotation**: **Refines** lists the BlueprintStep parent |

The parent nodes remain outside the view. Incoming lookup does not create a
reverse authored relationship. `MAPS_TO` does not supply additional parents or
ScenarioStep sequence edges.

The following relationships have visible connectors in both details when their
endpoints are visible:

- `ScenarioStep PRECEDES ScenarioStep`
- `ScenarioStep REALIZED_BY Place`
- `ScenarioStep REALIZED_BY ViewState`
- `Place NAVIGATES_TO Place`
- `ViewState TRANSITIONS_TO ViewState`

| Node in this view | Edge | `compact` | `detailed` |
| --- | --- | --- | --- |
| Decision `ScenarioStep` (`kind=decision`) | `ScenarioStep PRECEDES ScenarioStep` | Connector visible; branch label hidden | **C — detailed label**, selected from `guard`, then `event`, then `to_name`, when present |

Compact output hides Places with no projected edge to another node; detailed
output includes them (`show_disconnected_places`). An excluded relationship,
such as `Place CONTAINS ViewState`, does not make a Place connected for this
purpose. A self-edge alone does not either. `show_branch_labels` controls the
branch-label difference.

== Journey Map

Available node types: `Stage`, `JourneyStep`

| Node in this view | Edge | `compact` | `detailed` |
| --- | --- | --- | --- |
| `JourneyStep` | `JourneyStep REALIZED_BY Place`<br>`JourneyStep REALIZED_BY ViewState`<br>`JourneyStep REALIZED_BY Process` | Realization targets are outside the view | **A — entirely hidden** |
| `JourneyStep` | `Metric INSTRUMENTED_AT JourneyStep` | Source `Metric` is outside the view | **A — entirely hidden** |
| `JourneyStep` | `JourneyStep MAPS_TO BlueprintStep` | Reference hidden | **B — detailed annotation**: **Maps to** lists the BlueprintStep counterpart |
| `JourneyStep` | `BlueprintStep MAPS_TO JourneyStep` | Reference hidden | **B — detailed annotation**: the same **Maps to** reference |
| `JourneyStep` | `JourneyStep REFINED_BY ScenarioStep` | Reference hidden | **B — detailed annotation**: **Refined by** lists the ScenarioStep |

The primary relationships remain visible in both details:

- `Stage CONTAINS JourneyStep` is visible structurally.
- `JourneyStep PRECEDES JourneyStep` is visible as the ordering connector.

`show_relationship_references` controls the new reference groups. Detailed
output also shows existing Opportunity reference badges when a JourneyStep has
`opportunity_refs`, under `show_reference_badges`. That property is not a
relationship edge and retains its existing Opportunity-reference behavior.

== Outcome-Opportunity Map

Available node types: `Outcome`, `Metric`, `Opportunity`, `Initiative`

| Node in this view | Edge | `compact` | `detailed` |
| --- | --- | --- | --- |
| `Metric` | `Metric INSTRUMENTED_AT JourneyStep` | Reference hidden | **B — detailed annotation** |
| `Metric` | `Metric INSTRUMENTED_AT BlueprintStep` | Reference hidden | **B — detailed annotation** |
| `Metric` | `Metric INSTRUMENTED_AT ScenarioStep` | Reference hidden | **B — detailed annotation** |
| `Metric` | `Metric INSTRUMENTED_AT Place` | Reference hidden | **B — detailed annotation** |
| `Metric` | `Metric INSTRUMENTED_AT ViewState` | Reference hidden | **B — detailed annotation** |
| `Metric` | `Metric INSTRUMENTED_AT Event` | Reference hidden | **B — detailed annotation** |
| `Initiative` | `Initiative IMPLEMENTED_BY Place` | Reference hidden | **B — detailed annotation** |
| `Initiative` | `Initiative IMPLEMENTED_BY ViewState` | Reference hidden | **B — detailed annotation** |
| `Initiative` | `Initiative IMPLEMENTED_BY Component` | Reference hidden | **B — detailed annotation** |
| `Initiative` | `Initiative IMPLEMENTED_BY Process` | Reference hidden | **B — detailed annotation** |
| `Initiative` | `Initiative IMPLEMENTED_BY SystemAction` | Reference hidden | **B — detailed annotation** |

The targets remain outside the primary node set. Detailed output displays their
references on the source Metric or Initiative under
`show_instrumentation_annotations` and `show_implementation_annotations`.
The three Step types, Place, and ViewState are in the instrumentation
`experience` group; Event is in its `event` group.

The following relationships remain visible in both details:

- `Outcome MEASURED_BY Metric`
- `Opportunity SUPPORTS Outcome`
- `Initiative ADDRESSES Opportunity`

== Service Blueprint

Available node types: `BlueprintStep`, `Process`, `SystemAction`, `DataEntity`, `Policy`

### Entirely hidden cross-view edges

| Node in this view | Edge | `compact` | `detailed` |
| --- | --- | --- | --- |
| `BlueprintStep` | `BlueprintStep REALIZED_BY Place`<br>`BlueprintStep REALIZED_BY ViewState` | Realization targets are outside the view | **A — entirely hidden** |
| `Process` | `JourneyStep REALIZED_BY Process`<br>`ScenarioStep REALIZED_BY Process` | Other Step types are outside the view | **A — entirely hidden** |
| `Process`, `SystemAction` | `Initiative IMPLEMENTED_BY Process`<br>`Initiative IMPLEMENTED_BY SystemAction` | Source `Initiative` is outside the view | **A — entirely hidden** |
| `Process`, `SystemAction` | `Process EMITS Event`<br>`SystemAction EMITS Event` | Target `Event` is outside the view | **A — entirely hidden** |
| `SystemAction` | `ViewState DEPENDS_ON SystemAction`<br>`Component DEPENDS_ON SystemAction` | Sources `ViewState` and `Component` are outside the view | **A — entirely hidden** |
| `DataEntity` | `Component BINDS_TO DataEntity` | Source `Component` is outside the view | **A — entirely hidden** |
| `Policy` | `Place CONSTRAINED_BY Policy` | Source `Place` is outside the view | **A — entirely hidden** |
| `BlueprintStep` | `Metric INSTRUMENTED_AT BlueprintStep` | Source `Metric` is outside the view | **A — entirely hidden** |

### Correspondence and refinement references

| Node in this view | Edge | `compact` | `detailed` |
| --- | --- | --- | --- |
| `BlueprintStep` | `JourneyStep MAPS_TO BlueprintStep` | Reference hidden | **B — detailed annotation**: **Maps to** lists the JourneyStep counterpart |
| `BlueprintStep` | `BlueprintStep MAPS_TO JourneyStep` | Reference hidden | **B — detailed annotation**: the same **Maps to** reference |
| `BlueprintStep` | `BlueprintStep REFINED_BY ScenarioStep` | Reference hidden | **B — detailed annotation**: **Refined by** lists the ScenarioStep |

`show_relationship_references` controls these groups. JourneyStep and
ScenarioStep targets remain outside the primary node set.

### Connectors visible in compact, labels visible only in detailed

These are **C — detailed label** cases. `show_secondary_edge_labels` controls
the relationship labels; the connectors are visible in both details.

| Node in this view | Edge |
| --- | --- |
| `BlueprintStep`, `Process` | `BlueprintStep REALIZED_BY Process` |
| `Process` | `Process DEPENDS_ON Process` |
| `Process`, `SystemAction` | `Process DEPENDS_ON SystemAction` |
| `Process`, `Policy` | `Process CONSTRAINED_BY Policy` |
| `SystemAction`, `Policy` | `SystemAction CONSTRAINED_BY Policy` |
| `SystemAction`, `DataEntity` | `SystemAction READS DataEntity` |
| `SystemAction`, `DataEntity` | `SystemAction WRITES DataEntity` |

`BlueprintStep PRECEDES BlueprintStep` and `Process PRECEDES Process`
connectors remain visible without a relationship label in both details.

:::
