# Diagram Type Node and Edge Reference

This page demonstrates the `dropdownSwitch` Markdown extension while providing
a compact reference for the diagram types currently supported by staged
renderers.

> [!IMPORTANT]
> This page is downstream documentation, not a normative source. Diagram node
> and edge inclusion comes from `bundle/v0.1/core/views.yaml`; relationship
> direction and endpoints come from `bundle/v0.1/core/contracts.yaml`.

Relationships are limited to the edge types included by the selected view.
Some counterpart node types are outside that view's visible node set because
cross-view relationships can still be represented by the projection as
annotations.

::: dropdownSwitch Diagram type
== Outcome-Opportunity Map

Available node types: `Outcome`, `Metric`, `Opportunity`, `Initiative`.

### `Outcome`

- `MEASURED_BY` → `Metric`

Incoming:

- `Opportunity` → `SUPPORTS`

### `Metric`

- `INSTRUMENTED_AT` → `Step`, `Place`, `ViewState`, `Event`

Incoming:

- `Outcome` → `MEASURED_BY`

### `Opportunity`

- `SUPPORTS` → `Outcome`

Incoming:

- `Initiative` → `ADDRESSES`

### `Initiative`

- `ADDRESSES` → `Opportunity`
- `IMPLEMENTED_BY` → `Place`, `ViewState`, `Component`, `Process`, `SystemAction`

== Journey Map

Available node types: `Stage`, `Step`.

### `Stage`

`CONTAINS` → `Step`

### `Step`

`PRECEDES` → `Step`  

<small>Incoming:</small>

`Stage` `CONTAINS` `Step`  
`Step` `PRECEDES` `Step`  

== Service Blueprint

Available node types: `Step`, `Process`, `SystemAction`, `DataEntity`, `Policy`.

### `Step`

- `PRECEDES` → `Step`
- `REALIZED_BY` → `Place`, `ViewState`, `Process`

Incoming:

- `Step` → `PRECEDES`

### `Process`

- `PRECEDES` → `Process`
- `DEPENDS_ON` → `Process`, `SystemAction`
- `CONSTRAINED_BY` → `Policy`

Incoming:

- `Process` → `PRECEDES`
- `Step` → `REALIZED_BY`
- `Process` → `DEPENDS_ON`

### `SystemAction`

- `CONSTRAINED_BY` → `Policy`
- `READS` → `DataEntity`
- `WRITES` → `DataEntity`

Incoming:

- `Process`, `ViewState`, `Component` → `DEPENDS_ON`

### `DataEntity`

Incoming:

- `SystemAction` → `READS`
- `SystemAction` → `WRITES`

### `Policy`

Incoming:

- `Place`, `Process`, `SystemAction` → `CONSTRAINED_BY`

== IA Place Map

Available node types: `Area`, `Place`.

### `Area`

- `CONTAINS` → `Place`

### `Place`

- `CONTAINS` → `Place`, `ViewState`
- `NAVIGATES_TO` → `Place`

Incoming:

- `Area`, `Place` → `CONTAINS`
- `Place` → `NAVIGATES_TO`

== Scenario Flow

Available node types: `Step`, `Place`, `ViewState`.

### `Step`

- `PRECEDES` → `Step`
- `REALIZED_BY` → `Place`, `ViewState`, `Process`

Incoming:

- `Step` → `PRECEDES`

### `Place`

- `NAVIGATES_TO` → `Place`

Incoming:

- `Place` → `NAVIGATES_TO`
- `Step` → `REALIZED_BY`

### `ViewState`

- `TRANSITIONS_TO` → `ViewState`

Incoming:

- `Step` → `REALIZED_BY`
- `ViewState` → `TRANSITIONS_TO`

== UI Contracts

Available node types: `Place`, `ViewState`, `Component`, `State`, `Event`, `DataEntity`, `SystemAction`.

### `Place`

- `CONTAINS` → `Place`, `ViewState`
- `COMPOSED_OF` → `Component`

Incoming:

- `Area`, `Place` → `CONTAINS`

### `ViewState`

- `COMPOSED_OF` → `Component`
- `TRANSITIONS_TO` → `ViewState`
- `EMITS` → `Event`
- `DEPENDS_ON` → `SystemAction`

Incoming:

- `Place` → `CONTAINS`
- `ViewState` → `TRANSITIONS_TO`

### `Component`

- `CONTAINS` → `Component`
- `EMITS` → `Event`
- `DEPENDS_ON` → `SystemAction`
- `BINDS_TO` → `DataEntity`

Incoming:

- `Component` → `CONTAINS`
- `Place`, `ViewState` → `COMPOSED_OF`

### `State`

- `TRANSITIONS_TO` → `State`

Incoming:

- `State` → `TRANSITIONS_TO`

### `Event`

Incoming:

- `Component`, `ViewState`, `Process`, `SystemAction` → `EMITS`

### `DataEntity`

Incoming:

- `Component` → `BINDS_TO`

### `SystemAction`

- `EMITS` → `Event`

Incoming:

- `Process`, `ViewState`, `Component` → `DEPENDS_ON`

:::
