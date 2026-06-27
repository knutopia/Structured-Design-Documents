# Shown and Hidden Edges per Node per Renderer

6-26-26

I reviewed the staged preview renderers only: `ia_place_map`, `ui_contracts`, `service_blueprint`, `scenario_flow`, and `outcome_opportunity_map`. `journey_map` has a render model, but no staged preview backend registered, so I excluded it.

I’m using “not rendered” to mean: valid bundle edge types incident to that node type that are not emitted as visible staged connectors. Structural containment and annotations are called out explicitly.

Sources: [views.yaml](/home/knut/projects/sdd/bundle/v0.1/core/views.yaml:17), [contracts.yaml](/home/knut/projects/sdd/bundle/v0.1/core/contracts.yaml:56), [viewRenderers.ts](/home/knut/projects/sdd/src/renderer/viewRenderers.ts:101).

## Outcome Opportunity Map

- `Outcome`
  - Rendered: `SUPPORTS`, `MEASURED_BY`
  - Not rendered: none
- `Opportunity`
  - Rendered: `SUPPORTS`, `ADDRESSES`
  - Not rendered: none
- `Initiative`
  - Rendered: `ADDRESSES`
  - Not rendered: `IMPLEMENTED_BY` because its valid targets are outside this view’s node set
- `Metric`
  - Rendered: `MEASURED_BY`
  - Not rendered as edge: `INSTRUMENTED_AT`; it is represented as metric text annotations in permissive/strict profiles

## IA Place Map

- `Area`
  - Rendered: `CONTAINS` as structural area containment
  - Not rendered: none
- `Place`
  - Rendered: `CONTAINS` as structure/local connector, `NAVIGATES_TO` only for local forward parent-child or same-scope follower cases
  - Not rendered: `COMPOSED_OF`, `CONSTRAINED_BY`, `IMPLEMENTED_BY`, `INSTRUMENTED_AT`, `REALIZED_BY`; arbitrary `NAVIGATES_TO` edges outside the local-chain planner are also not emitted

## Scenario Flow

- `Step`
  - Rendered: `PRECEDES`, `REALIZED_BY` to rendered `Place`/`ViewState`
  - Not rendered: `CONTAINS`, `INSTRUMENTED_AT`; `REALIZED_BY` to `Process` is outside this view
- `Place`
  - Rendered: `REALIZED_BY`, `NAVIGATES_TO`
  - Not rendered: `COMPOSED_OF`, `CONSTRAINED_BY`, `CONTAINS`, `IMPLEMENTED_BY`, `INSTRUMENTED_AT`
- `ViewState`
  - Rendered: `REALIZED_BY`, `TRANSITIONS_TO`
  - Not rendered: `COMPOSED_OF`, `CONTAINS`, `DEPENDS_ON`, `EMITS`, `IMPLEMENTED_BY`, `INSTRUMENTED_AT`

## Service Blueprint

- `Step`
  - Rendered: `PRECEDES`, `REALIZED_BY` to `Process`
  - Not rendered: `CONTAINS`, `INSTRUMENTED_AT`; `REALIZED_BY` to `Place`/`ViewState` is outside this view
- `Process`
  - Rendered: `PRECEDES`, `REALIZED_BY`, `DEPENDS_ON`, `CONSTRAINED_BY`
  - Not rendered: `EMITS`, `IMPLEMENTED_BY`
- `SystemAction`
  - Rendered: `DEPENDS_ON`, `READS`, `WRITES`, `CONSTRAINED_BY`
  - Not rendered: `EMITS`, `IMPLEMENTED_BY`
- `DataEntity`
  - Rendered: `READS`, `WRITES`; same-pair read/write can merge as `READS_WRITES`
  - Not rendered: `BINDS_TO`
- `Policy`
  - Rendered: `CONSTRAINED_BY`
  - Not rendered: none

## UI Contracts

- `Place`
  - Rendered: `CONTAINS` to `ViewState` structurally, `COMPOSED_OF` to `Component` structurally
  - Not rendered: `CONTAINS` for `Place -> Place`, `CONSTRAINED_BY`, `IMPLEMENTED_BY`, `INSTRUMENTED_AT`, `NAVIGATES_TO`, `REALIZED_BY`
- `ViewState`
  - Rendered: `CONTAINS` incoming structurally, `COMPOSED_OF` structurally, `TRANSITIONS_TO`, `EMITS`, `DEPENDS_ON`
  - Not rendered: `IMPLEMENTED_BY`, `INSTRUMENTED_AT`, `REALIZED_BY`
- `Component`
  - Rendered: `COMPOSED_OF` structurally, `BINDS_TO`, `DEPENDS_ON`, `EMITS`
  - Not rendered: `CONTAINS` for `Component -> Component`, `IMPLEMENTED_BY`
- `State`
  - Rendered: `TRANSITIONS_TO`
  - Not rendered: `PRECEDES`
- `Event`
  - Rendered: `EMITS`
  - Not rendered: `INSTRUMENTED_AT`
- `DataEntity`
  - Rendered: `BINDS_TO`
  - Not rendered: `READS`, `WRITES`
- `SystemAction`
  - Rendered: `DEPENDS_ON`, `EMITS` when both endpoints are rendered
  - Not rendered: `CONSTRAINED_BY`, `IMPLEMENTED_BY`, `READS`, `WRITES`

## Caveat

One important profile caveat: UI contracts can hide supporting contract nodes in simple-profile cases, so `EMITS`, `DEPENDS_ON`, and `BINDS_TO` may be renderer-supported but absent from a specific output when their endpoints are suppressed.