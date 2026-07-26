# Diagram Types

This page collects the current diagram families, their status, and links to available examples.

## IA (Information Architecture) / Place Map

  Source of truth for product structure: what exists, where it lives, and how it connects.

  This view shows Areas and Place nested with `CONTAINS`, with `NAVIGATES_TO` connections between Places.
  
  Examples:
  ::: details outcome_to_ia_trace_example <Badge type="info" text="Simple Profile" vertical="top" />
  
  :::tabs
  == Information Architecture Diagram
  ![svg](../../../examples/rendered/v0.1/ia_place_map_diagram_type/outcome_to_ia_trace_example/simple_profile/outcome_to_ia_trace.ia_place_map.svg)
  == Source
  Area- and Place nodes: 
  showRepoLink /examples/rendered/v0.1/ia_place_map_diagram_type/outcome_to_ia_trace_example
  showSource ../../../examples/rendered/v0.1/ia_place_map_diagram_type/outcome_to_ia_trace_example/outcome_to_ia_trace.sdd {69, 73, 74, 84, 90, 93} {lines 68-}
  :::

  ::: details place_viewstate_transition_example <Badge type="info" text="Strict Profile" vertical="top" />
  :::tabs
  == Information Architecture Diagram
  ![svg](../../../examples/rendered/v0.1/ia_place_map_diagram_type/place_viewstate_transition_example/strict_profile/place_viewstate_transition.ia_place_map.svg)
  == Source
  showRepoLink /examples/rendered/v0.1/ia_place_map_diagram_type/place_viewstate_transition_example  
  showSource ../../../examples/rendered/v0.1/ia_place_map_diagram_type/place_viewstate_transition_example/place_viewstate_transition.sdd {6, 18, 35}
  :::

  ::: details billSage app
  <Badge type="info" text="Simple Profile" vertical="top" />
  ![svg](../../../real_world_exploration/billSage_example/billSage_simple_structure.ia_place_map.simple.svg)
  <IconFile/>[Read SDD Source](../../../real_world_exploration/billSage_example/billSage_simple_structure.sdd) showRepoLink /real_world_exploration/billSage_example
  <br>
  <br>
  <Badge type="info" text="Strict Profile" vertical="middle" />
  ![svg](../../../real_world_exploration/billSage_example/billSage_structure.ia_place_map.strict.svg)
  *strict profile* <IconFile/>[Read SDD Source](../../../real_world_exploration/billSage_example/billSage_structure.sdd) showRepoLink /real_world_exploration/billSage_example
  ::: 

## UI Contracts

  UI composition and state changes, per Place (and optionally per component).

  In this view, Places and View States act as containers for UI structure; View State or component State transitions show behavior inside those scopes, with events, data bindings, and system dependencies shown as supporting contracts.

  Examples: 
  ::: details place_viewstate_transition_example <Badge type="info" text="Strict Profile" vertical="top" />
  
  :::tabs
  == UI Contracts Diagram
  ![svg](../../../examples/rendered/v0.1/ui_contracts_diagram_type/place_viewstate_transition_example/strict_profile/place_viewstate_transition.ui_contracts.svg)
  == Source
  showRepoLink /examples/rendered/v0.1/ui_contracts_diagram_type/place_viewstate_transition_example/
  showSource ../../../examples/rendered/v0.1/ui_contracts_diagram_type/place_viewstate_transition_example/place_viewstate_transition.sdd {6, 14-15,19-32, 66-73, 75-80, 43, 51-63, 82-89, 91-96}
  :::

  ::: details ui_state_fallback_example <Badge type="info" text="Strict Profile" vertical="top" />
  
  :::tabs
  == Ui Contracts Diagram
  ![svg](../../../examples/rendered/v0.1/ui_contracts_diagram_type/ui_state_fallback_example/strict_profile/ui_state_fallback.ui_contracts.svg)
  == Source
  showRepoLink /examples/rendered/v0.1/ui_contracts_diagram_type/ui_state_fallback_example/
  showSource ../../../examples/rendered/v0.1/ui_contracts_diagram_type/ui_state_fallback_example/ui_state_fallback.sdd {3, 9, 12, 16-20, 23, 26, 31, 34, 38, 41, 46, 49, 53-58, 60-66, 68-73}
  :::

## Scenario Flow

  Step-by-step UI-level activities (but *without* collapsing the world into screens). 

  The x-axis shows horizontal progressions ("bands"). The y-axis shows lanes for Steps, Places and View States, with tracks for branch alternatives.

  Example: 
  ::: details scenario_branching_example <Badge type="info" text="Simple Profile" vertical="top" />
  
  :::tabs
  == Diagram
  ![svg](../../../examples/rendered/v0.1/scenario_flow_diagram_type/scenario_branching_example/simple_profile/scenario_branching.scenario_flow.svg)
  == Source
  showRepoLink /examples/rendered/v0.1/scenario_flow_diagram_type/scenario_branching_example/
  showSource ../../../examples/rendered/v0.1/scenario_flow_diagram_type/scenario_branching_example/scenario_branching.sdd
  :::

## Outcome-Opportunity Map

  Product intent, explicit and traceable: what the product solves, and how to know it works.

  The x-axis shows columns for Initiatives, Opportunities, Outcomes, Metrics. The y-axis displays a band for each Outcome, stacking rows when a column contains multiple entries.

  Examples: 
  ::: details outcome_to_ia_trace_example <Badge type="info" text="Strict Profile" vertical="top" />
  
  :::tabs
  == Diagram
  ![svg](../../../examples/rendered/v0.1/outcome_opportunity_map_diagram_type/outcome_to_ia_trace_example/strict_profile/outcome_to_ia_trace.outcome_opportunity_map.svg)
  == Source
  showRepoLink /examples/rendered/v0.1/outcome_opportunity_map_diagram_type/outcome_to_ia_trace_example/
  showSource ../../../examples/rendered/v0.1/outcome_opportunity_map_diagram_type/outcome_to_ia_trace_example/outcome_to_ia_trace.sdd
  :::

  ::: details metric_event_instrumentation_example <Badge type="info" text="Simple Profile" vertical="top" />
  
  :::tabs
  == Diagram
  ![svg](../../../examples/rendered/v0.1/outcome_opportunity_map_diagram_type/metric_event_instrumentation_example/simple_profile/metric_event_instrumentation.outcome_opportunity_map.svg)
  == Source
  showRepoLink /examples/rendered/v0.1/outcome_opportunity_map_diagram_type/metric_event_instrumentation_example/
  showSource ../../../examples/rendered/v0.1/outcome_opportunity_map_diagram_type/metric_event_instrumentation_example/metric_event_instrumentation.sdd
  :::

  ::: details multiple_outcomes <Badge type="info" text="Simple Profile" vertical="top" />
  
  :::tabs
  == Diagram
  ![svg](../../../examples/rendered/v0.1/outcome_opportunity_map_diagram_type/multiple_outcomes_example/simple_profile/multiple_outcomes.outcome_opportunity_map.svg)
  == Source
  showRepoLink /examples/rendered/v0.1/outcome_opportunity_map_diagram_type/multiple_outcomes_example/
  showSource ../../../examples/rendered/v0.1/outcome_opportunity_map_diagram_type/multiple_outcomes_example/multiple_outcomes.sdd
  :::

## Service Blueprint:

  Connects user experience steps to the layers needed to realize it.

  The x-axis shows customer journey progression over time: Anchor bands (columns) for steps connect a customer step the frontstage and backstage operations that make the step happen. Steps are ordered by `PRECEDES`. Additional interstitial bands are shown for work that advances between customer steps. The y-axis shows fixed service lanes: customer, frontstage, backstage, support, system, and policy.

  Note: a single column is sometimes called a *slice*, but a slice can also be broader, covering an entire feature.

  Example:
  ::: details Service Blueprint Slice example <Badge type="info" text="Strict Profile" vertical="top" />
  
  :::tabs
  == Diagram
  ![svg](../../../examples/rendered/v0.1/service_blueprint_diagram_type/service_blueprint_slice_example/strict_profile/service_blueprint_slice.service_blueprint.svg)
  == Source
  showRepoLink /examples/rendered/v0.1/service_blueprint_diagram_type/service_blueprint_slice_example/
  showSource ../../../examples/rendered/v0.1/service_blueprint_diagram_type/service_blueprint_slice_example/service_blueprint_slice.sdd
  :::

## *Not yet Available:* Journey Map

  Experience intent from above: stages and steps, needs, friction, moments of truth.
