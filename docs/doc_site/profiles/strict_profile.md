# Power of the Strict Profile

SDD’s `strict` profile turns a design model into a validated engineering reference for front-end implementation. It can capture and connect:

- Product rationale: outcomes, metrics, opportunities, and initiatives.
- User journeys and scenario branches.
- Information architecture, routes, navigation, entry points, and access rules.
- UI view states, component composition, and state machines.
- Events, guards, effects, and system dependencies.
- Component-to-data-field bindings.
- API/system actions, data entities, operational processes, and policies.
- Analytics instrumentation and implementation traceability.

Strict mode requires detailed metadata, validates references and relationship direction, rejects invalid endpoint combinations, and exposes the richer information in six operational diagram views. It is best understood as a strongly validated implementation contract and review checklist—not executable front-end code or a workflow engine.

The current authority is SDD-Text v0.1’s [strict profile](/home/knut/projects/sdd/bundle/v0.1/profiles/strict.yaml:1), [vocabulary](/home/knut/projects/sdd/bundle/v0.1/core/vocab.yaml:4), [endpoint contracts](/home/knut/projects/sdd/bundle/v0.1/core/contracts.yaml:3), and [view definitions](/home/knut/projects/sdd/bundle/v0.1/core/views.yaml:33).

## 1. Details required for each type

Every strict-profile node requires both `owner` and `description`. It then requires the following type-specific implementation information:

| SDD element | Required strict details | Front-end relevance |
|---|---|---|
| `Outcome` | `owner`, `description`, `time_horizon`, `scope`, `stakeholder` | Explains the intended user/business result and who benefits. |
| `Metric` | `owner`, `description`, `definition`, `source`, `cadence`, `metric_type` | Defines how implementation success will be measured and where the data comes from. |
| `Opportunity` | `owner`, `description`, `evidence`, `segment`, `severity` | Records the evidence-backed problem the UI should address. |
| `Initiative` | `owner`, `description`, `non_goals`, `status` | Establishes implementation boundaries and prevents accidental scope expansion. |
| `Stage` | `owner`, `description`, `order_index` | Organizes the broader user journey. |
| `Step` | `owner`, `description`, `actor`, `intent`, `success_criteria` | Describes a user action or intention independently of a particular screen. |
| `Area` | `owner`, `description`, `scope` | Defines a section of the information architecture. |
| `Place` | `owner`, `description`, `surface`, `route_or_key`, `access` | Defines a navigable product location, including route and authorization boundary. |
| `ViewState` | `owner`, `description`, `place_id`, `data_required` | Defines a distinct UI mode within a route, such as loading, editing, error, or success. |
| `Component` | `owner`, `description`, `responsibility`, `inputs`, `outputs` | Defines component boundaries and interface expectations. |
| `State` | `owner`, `description`, `scope_id`, `invariants` | Defines component- or place-scoped state-machine behavior and conditions that must remain true. |
| `Event` | `owner`, `description`, `source_kind`, `payload_schema` | Defines stable user/system triggers and their payload expectations. |
| `Process` | `owner`, `description`, `visibility`, `sla` | Describes operational work that supports the experience. |
| `SystemAction` | `owner`, `description`, `system_name`, `action`, `failure_modes` | Describes an API call or system operation, including expected failures. |
| `DataEntity` | `owner`, `description`, `fields`, `system_of_record` | Identifies the domain data used by the UI and its authoritative source. |
| `Policy` | `owner`, `description`, `policy_owner`, `enforcement_point` | Captures security, regulatory, or business constraints and where they are enforced. |

These exact requirements are defined in [strict.yaml](/home/knut/projects/sdd/bundle/v0.1/profiles/strict.yaml:37).

A particularly useful modeling distinction is:

- `Step` = what the user is trying to accomplish.
- `Place` = where the user can navigate.
- `ViewState` = the UI mode displayed within that place.

That avoids the common implementation mistake of treating every journey step as a separate page. SDD explicitly supports SPA-style products in which one route contains several interaction states.

## 2. Information architecture, routing, and access

SDD can specify:

- Areas and nested product locations.
- Parent/child route structure.
- Navigation between locations.
- `surface`, such as web or another client surface.
- `route_or_key`, such as `/billing`, a route name, or another navigation key.
- `access` policy:
  - `public`
  - `auth`
  - `role:<slug>`
- Optional `primary_nav=true|false`.
- Optional ingress metadata through `entry_points`, represented as comma-separated `kind:value` entries.
- Deep links, notifications, dashboard links, and cross-product handoffs as entry points.

Strict validation rejects malformed access values and entry-point structures. It also requires the route/key and access metadata to be present. The IA diagram displays route/key, access, entry points, and primary-navigation status under strict mode ([IA view configuration](/home/knut/projects/sdd/bundle/v0.1/core/views.yaml:192)).

This can directly guide:

- Router configuration.
- Route guards.
- Menu and primary-navigation construction.
- Deep-link handling.
- Authentication and role-based authorization boundaries.

## 3. UI structure and component contracts

SDD can model:

- A `Place` or `ViewState` composed of components.
- Nested component composition.
- Each component’s responsibility.
- Component inputs and outputs.
- A component’s dependency on a system action.
- A component’s binding to a particular field of a data entity.
- Events emitted by components or view states.

Examples of semantic connections include:

- `Place COMPOSED_OF Component`
- `ViewState COMPOSED_OF Component`
- `Component BINDS_TO DataEntity field=...`
- `Component DEPENDS_ON SystemAction`
- `Component EMITS Event`

Strict mode requires every `BINDS_TO` relationship to name the bound `field`. It also rejects circular component composition.

This creates a useful implementation checklist for:

- Component ownership and boundaries.
- Props/input design.
- Callback/output design.
- Form-field and view-model bindings.
- Query/mutation or API dependencies.
- Event contracts.

## 4. View states, state machines, and interaction behavior

SDD supports two related state levels:

- `ViewState`: an interaction/render mode within a `Place`.
- `State`: a more focused state machine scoped to a `Place` or `Component`.

Transitions can carry:

- An event.
- A guard/precondition.
- An effect.
- Additional edge properties.

For example, a transition can express the equivalent of:

> From editing to success, after `E-Submit`, when the form is valid, perform a system action.

Strict behavior includes:

- Transition events must reference existing `Event` node IDs; free-form event labels are not sufficient.
- `State.scope_id` must resolve to an existing `Place` or `Component`.
- Every `ViewState.place_id` must correspond to its containment relationship, either explicitly or through a marked derived containment.
- Containment and composition graphs must be acyclic.
- Relationships are directional; inverse relationships are never silently inferred.

The strict UI Contracts rendering includes:

- Route and access metadata.
- `ViewState.data_required`.
- Primary `ViewState` transitions.
- Secondary scoped `State` groups.
- Supporting event, data, and system-action contracts.
- Empty place containers, so omitted behavior remains visible as a possible specification gap.

See the [UI Contracts view](/home/knut/projects/sdd/bundle/v0.1/core/views.yaml:255).

## 5. User flows and branching scenarios

SDD distinguishes temporal flow from navigation:

- `Step PRECEDES Step` expresses the scenario or journey sequence.
- `Place NAVIGATES_TO Place` expresses navigation.
- `Step REALIZED_BY Place|ViewState|Process` connects intent to implementation.

Branching is represented by setting `kind=decision` on a `Step`. Branch labels use this precedence:

1. Guard
2. Event
3. Target-name hint

Strict mode:

- Requires every `Step` to have at least one `REALIZED_BY` connection.
- Permits `kind` only with the canonical value `decision`.
- Warns when a branching step is not marked as a decision.
- Displays branch labels in scenario diagrams.
- Validates `opportunity_refs` as references to real `Opportunity` IDs when the property is supplied.

This provides implementation guidance for happy paths, alternate paths, conditional routing, and failure/recovery flows without conflating the flow with the page hierarchy.

## 6. Data, APIs, and service dependencies

SDD can connect the front end to delivery and backend concerns:

- `SystemAction READS DataEntity`
- `SystemAction WRITES DataEntity`
- `Component BINDS_TO DataEntity`
- `Component DEPENDS_ON SystemAction`
- `ViewState DEPENDS_ON SystemAction`
- `Process DEPENDS_ON SystemAction`
- `Place`, `Process`, or `SystemAction CONSTRAINED_BY Policy`

Strict-required properties capture:

- API/system name and action.
- Failure modes.
- Data fields and system of record.
- View-state data requirements.
- Component inputs and outputs.
- Policy owner and enforcement point.
- Process SLA and visibility.

Processes must use one of the canonical visibility values:

- `frontstage`
- `backstage`
- `support`

The Service Blueprint view separates customer, frontstage, backstage, support, system, and policy lanes and displays secondary relationship labels in strict mode ([service blueprint configuration](/home/knut/projects/sdd/bundle/v0.1/core/views.yaml:159)).

For a front-end engineer, this makes hidden dependencies visible: required APIs, data ownership, loading requirements, failure cases, operational handoffs, and policy enforcement.

## 7. Product-to-implementation traceability

SDD supports an end-to-end chain such as:

`Opportunity → Outcome → Metric`

and:

`Initiative → Opportunity → Place/ViewState/Component/SystemAction`

The relevant relationships are:

- `Opportunity SUPPORTS Outcome`
- `Outcome MEASURED_BY Metric`
- `Initiative ADDRESSES Opportunity`
- `Initiative IMPLEMENTED_BY` a place, view state, component, process, or system action
- `Step REALIZED_BY` a place, view state, or process

Strict mode requires:

- Every `Outcome` to have a metric.
- Every `Initiative` to address at least one opportunity.
- Every `Step` to connect to an implementation realization.

This lets a reviewer move in either direction:

- From a UI component back to the initiative and opportunity that justify it.
- From an outcome or journey step forward to the route, state, process, or action expected to realize it.

## 8. Analytics and instrumentation

SDD can model:

- Named analytics or domain events.
- Event source type.
- Payload schema.
- Events emitted by components, view states, processes, or system actions.
- Metrics instrumented at a step, place, view state, or event.
- Metric definition, data source, cadence, and type.

Key relationships include:

- `Component|ViewState|Process|SystemAction EMITS Event`
- `Metric INSTRUMENTED_AT Step|Place|ViewState|Event`

Strict diagrams display instrumentation annotations that the low-noise profile suppresses. This can guide analytics hooks, event naming, payload construction, and where measurement should occur.

## 9. Structural and governance checks

Strict validation treats these as errors:

- Missing required metadata.
- Missing referenced nodes.
- Invalid relationship endpoint pairs.
- Incorrect relationship direction.
- Invalid type-specific ID prefixes.
- Circular containment.
- Circular UI composition.
- An outcome without a metric.
- An initiative without an addressed opportunity.
- A step without a realization.
- A transition event that is not an existing `Event`.
- A data binding without a field.
- Invalid access, entry-point, process-visibility, decision-kind, or state-scope values.
- Inconsistent `ViewState` parentage.

IDs are also coupled to types:

- `O-…` Outcome
- `M-…` Metric
- `OP-…` Opportunity
- `I-…` Initiative
- `G-…` Stage
- `J-…` Step
- `A-…` Area
- `P-…` Place
- `VS-…` ViewState
- `C-…` Component
- `ST-…` State
- `E-…` Event
- `PR-…` Process
- `SA-…` SystemAction
- `D-…` DataEntity
- `PL-…` Policy

Strict does retain some warnings rather than treating absolutely everything as an error. Examples include duplicate edges, multiple structural parents, unmarked branching steps, improperly annotated flow cycles, and policy-enforcement coverage. The detailed severities are in the [endpoint contract](/home/knut/projects/sdd/bundle/v0.1/core/contracts.yaml:3).

## 10. Available strict-profile views

One SDD graph can produce six focused implementation views:

- Outcome–Opportunity Map: rationale, initiatives, metrics, implementation targets, and instrumentation.
- Journey Map: stages, user steps, ordering, and opportunity references.
- Service Blueprint: customer behavior, operational processes, systems, data, and policies.
- IA Place Map: hierarchy, routes, navigation, access, and entry points.
- Scenario Flow: ordered user flow, navigation, view-state transitions, and decision branches.
- UI Contracts: places, view states, components, state machines, events, data bindings, and system dependencies.

Strict mode generally shows the richer annotations; it does not change the underlying syntax or projection scope. Profiles are validation overlays, not different document variants ([profile guidance](/home/knut/projects/sdd/docs/toolchain/profiles.md:1)).

## Important boundaries

Strict SDD is detailed, but v0.1 does not claim that every property is a deeply typed executable contract:

- Properties such as `inputs`, `outputs`, `fields`, `payload_schema`, and `failure_modes` are required to be present, but their internal format is not standardized by strict v0.1.
- Guard expressions are strings; SDD does not define a guard-expression language.
- Effects may reference system actions, but the document is not executable.
- SDD does not itself produce React, Vue, CSS, router, test, or API-client code.
- It provides the validated structure and traceability from which those implementation artifacts can be designed or generated.

The compiled representation deliberately permits general JSON property values ([compiled schema](/home/knut/projects/sdd/bundle/v0.1/core/schema.json:58)), and the v0.1 specification explicitly excludes executable semantics ([documented limits](/home/knut/projects/sdd/definitions/v0.1/readme_structured_design_diagrams_sdd_text_v_0_dot_1.md:218)).

In practical terms: a strict SDD document can be handed to a front-end engineer as a route map, state-and-event contract, component/data dependency map, analytics plan, acceptance checklist, and explanation of why the implementation exists.