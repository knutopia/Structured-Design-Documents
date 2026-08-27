# Diagram Types

This page collects the current diagram families, their status, and links to available examples.

## IA (Information Architecture) / Place Map

  Source of truth for product structure: what exists, where it lives, and how it connects.

  This view shows Areas and Place nested with `CONTAINS`, with `NAVIGATES_TO` connections between Places.
  
  Examples: [outcome_to_ia_trace_example](../../../examples/rendered/v0.1/ia_place_map_diagram_type/outcome_to_ia_trace_example/), [place_viewstate_transition_example](../../../examples/rendered/v0.1/ia_place_map_diagram_type/place_viewstate_transition_example/), [billSage_simple_structure](../../../real_world_exploration/billSage_example/billSage_simple_structure.ia_place_map.compact.svg), [billSage_structure](../../../real_world_exploration/billSage_example/billSage_structure.ia_place_map.detailed.svg)

## UI Contract

  UI composition and state changes, per Place (and optionally per component).

  In this view, Places and View States act as containers for UI structure; View State or component State transitions show behavior inside those scopes, with events, data bindings, and system dependencies shown as supporting contracts.

  Examples: [place_viewstate_transition_example](../../../examples/rendered/v0.1/ui_contracts_diagram_type/place_viewstate_transition_example/), [ui_state_fallback_example](../../../examples/rendered/v0.1/ui_contracts_diagram_type/ui_state_fallback_example/)

## Scenario Flow

  Step-by-step UI-level activities (but *without* collapsing the world into screens). 

  The x-axis shows horizontal progressions ("bands"). The y-axis shows lanes for Steps, Places and View States, with tracks for branch alternatives.

  Example: [scenario_branching_example](../../../examples/rendered/v0.1/scenario_flow_diagram_type/scenario_branching_example/)

## Outcome-Opportunity Map

  Product intent, explicit and traceable: what the product solves, and how to know it works.

  The x-axis shows columns for Initiatives, Opportunities, Outcomes, Metrics. The y-axis displays a band for each Outcome, stacking rows when a column contains multiple entries.

  Examples: [multiple_outcomes](../../../examples/rendered/v0.1/outcome_opportunity_map_diagram_type/multiple_outcomes_example/), [outcome_to_ia_trace_example](../../../examples/rendered/v0.1/outcome_opportunity_map_diagram_type/outcome_to_ia_trace_example/), [metric_event_instrumentation_example](../../../examples/rendered/v0.1/outcome_opportunity_map_diagram_type/metric_event_instrumentation_example/)

## Service Blueprint:

  Connects user experience steps to the layers needed to realize it.

  The x-axis shows customer journey progression over time: Step anchor bands ordered by `PRECEDES`, with interstitial bands for operational work that advances between customer steps. The y-axis shows fixed service lanes: customer, frontstage, backstage, support, system, and policy.

  Example: [Service Blueprint Slice example](../service_blueprint_slice_example/)


## Journey Map

  Experience intent from above: stages and steps, needs, friction, moments of truth.

  Stages contain source-ordered Steps, while `PRECEDES` relationships overlay journey flow and resolved `opportunity_refs` appear as detail-controlled inline badges.

  Examples: [home_energy_upgrade_example](../../../examples/rendered/v0.1/journey_map_diagram_type/home_energy_upgrade_example/), [branching_journey_example](../../../examples/rendered/v0.1/journey_map_diagram_type/branching_journey_example/), [outcome_to_ia_trace_example](../../../examples/rendered/v0.1/journey_map_diagram_type/outcome_to_ia_trace_example/), [service_blueprint_slice_example](../../../examples/rendered/v0.1/journey_map_diagram_type/service_blueprint_slice_example/)

  Dense topologies may remain difficult to trace; residual crossings are bridged deterministically and reported through renderer diagnostics.
