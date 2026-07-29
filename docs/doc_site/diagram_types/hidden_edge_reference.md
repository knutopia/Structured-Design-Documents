# Hidden Edge Reference by Diagram Type

*This is a technical documentation page.*
Reference for relationships that are not fully visible when a diagram is
rendered with `profile=simple`, together with how those relationships appear
when the same diagram is rendered with `profile=strict`.

> [!IMPORTANT]
> This page is downstream documentation, not a normative source. Diagram node
> and edge inclusion comes from `bundle/v0.1/core/views.yaml`; relationship
> direction and endpoints come from `bundle/v0.1/core/contracts.yaml`.

## Legend

| Marker | Meaning |
| --- | --- |
| **A — entirely hidden** | The relationship is not shown in either `simple` or `strict` for this diagram type. This normally occurs because an endpoint is outside the view or the staged renderer does not emit that relationship. |
| **B — strict annotation** | The relationship is hidden in `simple` and appears as an in-node annotation in `strict`. |
| **C — strict label** | The connector is visible in `simple`, but its label is hidden. The label appears in `strict`. |
| **D — strict node** | The relationship is hidden in `simple`; `strict` shows its endpoint node and normally the connector as well. |
| **D\* — conditional strict node** | The same behavior as **D**, but only when a `ViewState` is the primary UI transition graph. If no `ViewState` exists, UI Contracts can fall back to the `State` graph and the item need not be hidden in `simple`. |

Structural relationships shown through containment or nesting count as visible
even when the renderer does not draw a separate connector.

::: dropdownSwitch Diagram Type
== IA Place Map

Available node types: `Area`, `Place`

| Node | Edge | `simple` | `strict` |
| --- | --- | --- | --- |
| `Place` | `Place CONTAINS ViewState` | Invisible because `ViewState` is outside the view | **A — entirely hidden** |

The following relationships are visible in `simple` and therefore are not
invisible edges:

- `Area CONTAINS Place`
- `Place CONTAINS Place`
- `Place NAVIGATES_TO Place`

IA Place Map has no strict-only relationship annotations or edge labels.

== UI Contracts

Available node types: `Place`, `ViewState`, `Component`, `State`, `Event`,
`DataEntity`, `SystemAction`

| Node | Edge | `simple` | `strict` |
| --- | --- | --- | --- |
| `Place` | `Area CONTAINS Place` | Source `Area` is outside the view | **A — entirely hidden** |
| `Place` | `Place CONTAINS Place` | The staged renderer does not emit this hierarchy | **A — entirely hidden** |
| `ViewState` | `ViewState EMITS Event` | Supporting contract suppressed | **D\* — conditional strict node** |
| `ViewState` | `ViewState DEPENDS_ON SystemAction` | Supporting contract suppressed | **D\* — conditional strict node** |
| `Component` | `Component CONTAINS Component` | The staged renderer does not emit this hierarchy | **A — entirely hidden** |
| `Component` | `Component EMITS Event` | Supporting contract suppressed | **D\* — conditional strict node** |
| `Component` | `Component DEPENDS_ON SystemAction` | Supporting contract suppressed | **D\* — conditional strict node** |
| `Component` | `Component BINDS_TO DataEntity` | Supporting contract suppressed | **D\* — conditional strict node** |
| `State` | `State TRANSITIONS_TO State` | Secondary state group suppressed | **D\* — conditional strict node** |
| `Event` | `Component EMITS Event` | `Event` node suppressed | **D\* — conditional strict node** |
| `Event` | `ViewState EMITS Event` | `Event` node suppressed | **D\* — conditional strict node** |
| `Event` | `SystemAction EMITS Event` | Supporting-contract nodes suppressed | **D\* — conditional strict node** |
| `Event` | `Process EMITS Event` | Source `Process` is outside the view | **A — entirely hidden** |
| `DataEntity` | `Component BINDS_TO DataEntity` | `DataEntity` node suppressed | **D\* — conditional strict node** |
| `SystemAction` | `ViewState DEPENDS_ON SystemAction` | `SystemAction` node suppressed | **D\* — conditional strict node** |
| `SystemAction` | `Component DEPENDS_ON SystemAction` | `SystemAction` node suppressed | **D\* — conditional strict node** |
| `SystemAction` | `Process DEPENDS_ON SystemAction` | Source `Process` is outside the view | **A — entirely hidden** |
| `SystemAction` | `SystemAction EMITS Event` | Supporting-contract nodes suppressed | **D\* — conditional strict node** |

`Place CONTAINS ViewState` and `Place` or `ViewState COMPOSED_OF Component`
are visible structurally as containment rather than as drawn connectors.

The **D\*** behavior is controlled by
`show_secondary_state_groups_when_primary_view_state` and
`show_supporting_contract_lane_when_primary_view_state`. Both settings are
disabled in `simple` and enabled in `strict`.

== Scenario Flow

Available node types: `Step`, `Place`, `ViewState`

| Node | Edge | `simple` | `strict` |
| --- | --- | --- | --- |
| `Step` | `Step REALIZED_BY Process` | Target `Process` is outside the view | **A — entirely hidden** |

All endpoint-compatible relationships have visible connectors in `simple`:

- `Step PRECEDES Step`
- `Step REALIZED_BY Place`
- `Step REALIZED_BY ViewState`
- `Place NAVIGATES_TO Place`
- `ViewState TRANSITIONS_TO ViewState`

One profile-dependent case affects a label rather than connector visibility:

| Node | Edge | `simple` | `strict` |
| --- | --- | --- | --- |
| Decision `Step` | Annotated `Step PRECEDES Step` | Connector visible; branch label hidden | **C — strict label**, selected from `guard`, then `event`, then `to_name` |

== Outcome-Opportunity Map

Available node types: `Outcome`, `Metric`, `Opportunity`, `Initiative`

| Node | Edge | `simple` | `strict` |
| --- | --- | --- | --- |
| `Metric` | `Metric INSTRUMENTED_AT Step` | Invisible | **B — strict annotation** |
| `Metric` | `Metric INSTRUMENTED_AT Place` | Invisible | **B — strict annotation** |
| `Metric` | `Metric INSTRUMENTED_AT ViewState` | Invisible | **B — strict annotation** |
| `Metric` | `Metric INSTRUMENTED_AT Event` | Invisible | **B — strict annotation** |
| `Initiative` | `Initiative IMPLEMENTED_BY Place` | Invisible | **B — strict annotation** |
| `Initiative` | `Initiative IMPLEMENTED_BY ViewState` | Invisible | **B — strict annotation** |
| `Initiative` | `Initiative IMPLEMENTED_BY Component` | Invisible | **B — strict annotation** |
| `Initiative` | `Initiative IMPLEMENTED_BY Process` | Invisible | **B — strict annotation** |
| `Initiative` | `Initiative IMPLEMENTED_BY SystemAction` | Invisible | **B — strict annotation** |

The targets of these relationships are outside the Outcome-Opportunity Map
node set. In `strict`, the renderer converts them into annotations on the
source `Metric` or `Initiative` node instead of drawing their target nodes.

`Outcome`, `Opportunity`, and the `MEASURED_BY`, `SUPPORTS`, and `ADDRESSES`
relationships have no invisible cases.

== Service Blueprint

Available node types: `Step`, `Process`, `SystemAction`, `DataEntity`, `Policy`

### Entirely hidden cross-view edges

| Node | Edge | `simple` | `strict` |
| --- | --- | --- | --- |
| `Step` | `Step REALIZED_BY Place` | Target `Place` is outside the view | **A — entirely hidden** |
| `Step` | `Step REALIZED_BY ViewState` | Target `ViewState` is outside the view | **A — entirely hidden** |
| `SystemAction` | `ViewState DEPENDS_ON SystemAction` | Source `ViewState` is outside the view | **A — entirely hidden** |
| `SystemAction` | `Component DEPENDS_ON SystemAction` | Source `Component` is outside the view | **A — entirely hidden** |
| `Policy` | `Place CONSTRAINED_BY Policy` | Source `Place` is outside the view | **A — entirely hidden** |

### Connectors visible in `simple`, labels visible only in `strict`

These are **C — strict label** cases rather than fully invisible edges.

| Node | Edge |
| --- | --- |
| `Step`, `Process` | `Step REALIZED_BY Process` |
| `Process` | `Process DEPENDS_ON Process` |
| `Process`, `SystemAction` | `Process DEPENDS_ON SystemAction` |
| `Process`, `Policy` | `Process CONSTRAINED_BY Policy` |
| `SystemAction`, `Policy` | `SystemAction CONSTRAINED_BY Policy` |
| `SystemAction`, `DataEntity` | `SystemAction READS DataEntity` |
| `SystemAction`, `DataEntity` | `SystemAction WRITES DataEntity` |

`PRECEDES` connectors remain visible without a relationship label in both
profiles. The profile-dependent labels above are controlled by
`show_secondary_edge_labels`.

== Journey Map

Available node types: `Stage`, `Step`

There are no invisible relationship edges:

- `Stage CONTAINS Step` is visible structurally.
- `Step PRECEDES Step` is visible as the ordering connector.

`strict` can add Opportunity reference badges to a `Step`, but
`opportunity_refs` is a node property rather than a relationship edge.

:::
