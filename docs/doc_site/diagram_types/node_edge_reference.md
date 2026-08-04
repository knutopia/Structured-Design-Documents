# Diagram Node and Edge Reference

Compact reference of content relationships per diagram type, listing available nodes and edges (relationships).

> [!IMPORTANT]
> In technical terms, this page is downstream documentation, 
> not a normative source. Diagram node and edge inclusion comes 
> from `bundle/v0.1/core/views.yaml`; relationship direction 
> and endpoints come from `bundle/v0.1/core/contracts.yaml`.

::: dropdownSwitch Choose Diagram Type:
== IA Place Map

Available node types: `Area`, `Place`

```sdd
Area A-001 "Area Name"
  CONTAINS P-001 "a Place"
END

Place P-001 "Place Name"
  CONTAINS P-002 "a Place"
  CONTAINS VS-001 "a ViewState" # (hidden)
  NAVIGATES_TO P-002 "a Place"
END

# Incoming edges for Place:
# Area, Place CONTAINS Place
# Place NAVIGATES_TO Place
```

== UI Contracts

Available node types: `Place`, `ViewState`, `Component`, `State`, `Event`, `DataEntity`, `SystemAction`

```sdd
Place P-001 "Place Name"
  CONTAINS P-002 "a Place" # (hidden)
  CONTAINS VS-001 "a ViewState"
  COMPOSED_OF C-001 "a Component"
END

# Incoming edges for Place:
# Area, Place CONTAINS Place

ViewState VS-001 "ViewState Name"
  COMPOSED_OF C-001 "a Component"
  TRANSITIONS_TO VS-002 "a ViewState"
  EMITS E-001 "an Event" # (shown with strict profile)
  DEPENDS_ON SA-001 "a SystemAction" # (shown with strict profile)
END

# Incoming edges for ViewState:
# Place CONTAINS ViewState
# ViewState TRANSITIONS_TO ViewState

Component C-001 "Component Name"
  CONTAINS C-002 "a Component" # (hidden)
  EMITS E-001 "an Event" # (shown with strict profile)
  DEPENDS_ON SA-001 "a SystemAction" # (shown with strict profile)
  BINDS_TO D-001 "a DataEntity" # (shown with strict profile)
END

# Incoming edges for Component:
# Component CONTAINS Component
# Place, ViewState COMPOSED_OF Component

State ST-001 "State Name"
  TRANSITIONS_TO ST-002 "a State" # (shown with strict profile)
END

# Incoming edges for State:
# State TRANSITIONS_TO State

Event E-001 "Event Name"
END

# Incoming edges for Event:
# Component, ViewState, Process, SystemAction EMITS Event

DataEntity D-001 "DataEntity Name"
END

# Incoming edges for DataEntity:
# Component BINDS_TO DataEntity

SystemAction SA-001 "SystemAction Name"
  EMITS E-001 "an Event" # (shown with strict profile)
END

# Incoming edges for SystemAction:
# Process, ViewState, Component DEPENDS_ON SystemAction
```

== Scenario Flow

Available node types: `Step`, `Place`, `ViewState`

```sdd
Step J-001 "Step Name"
  PRECEDES J-002 "a Step"
  REALIZED_BY P-001 "a Place"
  REALIZED_BY VS-001 "a ViewState"
  REALIZED_BY PR-001 "a Process" # (hidden)
END

# Incoming edges for Step:
# Step PRECEDES Step

Place P-001 "Place Name"
  NAVIGATES_TO P-002 "a Place"
END

# Incoming edges for Place:
# Place NAVIGATES_TO Place
# Step REALIZED_BY Place

ViewState VS-001 "ViewState Name"
  TRANSITIONS_TO VS-002 "a ViewState"
END

# Incoming edges for ViewState:
# Step REALIZED_BY ViewState
# ViewState TRANSITIONS_TO ViewState
```

== Journey Map

Available node types: `Stage`, `Step`

```sdd
Stage G-001 "Stage Name"
  CONTAINS J-001 "a Step"
END

Step J-001 "Step Name"
  PRECEDES J-002 "a Step"
END

# Incoming edges for Step:
# Stage CONTAINS Step
# Step PRECEDES Step
```

== Outcome-Opportunity Map

Available node types: `Outcome`, `Metric`, `Opportunity`, `Initiative`

```sdd
Outcome O-001 "Outcome Name"
  MEASURED_BY M-001 "a Metric"
END

# Incoming edges for Outcome:
# Opportunity SUPPORTS Outcome

Metric M-001 "Metric Name"
  INSTRUMENTED_AT J-001 "a Step" # (shown with strict profile)
  INSTRUMENTED_AT P-001 "a Place" # (shown with strict profile)
  INSTRUMENTED_AT VS-001 "a ViewState" # (shown with strict profile)
  INSTRUMENTED_AT E-001 "an Event" # (shown with strict profile)
END

# Incoming edges for Metric:
# Outcome MEASURED_BY Metric

Opportunity OP-001 "Opportunity Name"
  SUPPORTS O-001 "an Outcome"
END

# Incoming edges for Opportunity:
# Initiative ADDRESSES Opportunity

Initiative I-001 "Initiative Name"
  ADDRESSES OP-001 "an Opportunity"
  IMPLEMENTED_BY P-001 "a Place" # (shown with strict profile)
  IMPLEMENTED_BY VS-001 "a ViewState" # (shown with strict profile)
  IMPLEMENTED_BY C-001 "a Component" # (shown with strict profile)
  IMPLEMENTED_BY PR-001 "a Process" # (shown with strict profile)
  IMPLEMENTED_BY SA-001 "a SystemAction" # (shown with strict profile)
END
```

== Service Blueprint

Available node types: `Step`, `Process`, `SystemAction`, `DataEntity`, `Policy`

```sdd
Step J-001 "Step Name"
  PRECEDES J-002 "a Step"
  REALIZED_BY P-001 "a Place" # (hidden)
  REALIZED_BY VS-001 "a ViewState" # (hidden)
  REALIZED_BY PR-001 "a Process"
END

# Incoming edges for Step:
# Step PRECEDES Step

Process PR-001 "Process Name"
  PRECEDES PR-002 "a Process"
  DEPENDS_ON PR-002 "a Process"
  DEPENDS_ON SA-001 "a SystemAction"
  CONSTRAINED_BY PL-001 "a Policy"
END

# Incoming edges for Process:
# Process PRECEDES Process
# Step REALIZED_BY Process
# Process DEPENDS_ON Process

SystemAction SA-001 "SystemAction Name"
  CONSTRAINED_BY PL-001 "a Policy"
  READS D-001 "a DataEntity"
  WRITES D-001 "a DataEntity"
END

# Incoming edges for SystemAction:
# Process, ViewState, Component DEPENDS_ON SystemAction

DataEntity D-001 "DataEntity Name"
END

# Incoming edges for DataEntity:
# SystemAction READS DataEntity
# SystemAction WRITES DataEntity

Policy PL-001 "Policy Name"
END

# Incoming edges for Policy:
# Place, Process, SystemAction CONSTRAINED_BY Policy
```

:::

To create readable diagrams, not all diagrams *do* show all edges that they *could* show. For technical users, [Hidden Edge Reference](hidden_edge_reference.md) shows which edge types are suppressed per diagram type with more detail.
