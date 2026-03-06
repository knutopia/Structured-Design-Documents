# Initial Concepts 2: One-page Schema (v0.1)

This schema defines a **single typed graph** that can be rendered as multiple diagram “views” (Outcome map, Journey, Blueprint, IA, Scenario flows, State/Component specs). The goal is **traceability** from product intent → experience intent → product structure → UI behavior → service delivery.

---

## 1) Global conventions

### IDs (stable, unique, human-friendly)

**Format:** `<PREFIX>-<3+ digits>` (optionally add a short slug in tooling, but keep the ID stable)

Recommended prefixes:

* `O` Outcome, `M` Metric, `OP` Opportunity, `I` Initiative
* `G` Stage, `J` Step
* `A` Area, `P` Place, `VS` ViewState
* `C` Component, `ST` State, `E` Event
* `PR` Process, `SA` SystemAction, `D` DataEntity, `PL` Policy

Examples: `O-003`, `J-014`, `P-020`, `VS-020a`, `C-112`, `SA-009`.

### Base node fields (required on *every* node)

* `id` (as above)
* `type` (one of the types below)
* `name` (short label, imperative or noun phrase)
* `description` (1–3 lines; what it *is* / why it exists)
* `owner` (role/team, e.g., Product, Design, Eng, Ops)

### Edge annotation grammar (use consistently)

For edges where it matters (flows/state transitions), annotate as:

`A -> B : RELATION [event] {guard} / effect`

* `[event]` = the triggering event label or Event node ID
* `{guard}` = boolean condition (optional)
* `/ effect` = side-effect label (optional; can reference `SA-*`)

---

## 2) Node types and required properties

### Product intent

**Outcome (`O`)**: desired change in user/business reality
Required: `time_horizon`, `scope` (product/area), `stakeholder`

**Metric (`M`)**: how an outcome is measured (KPI/guardrail)
Required: `definition`, `source`, `cadence`, `metric_type` (kpi/guardrail/diagnostic)

**Opportunity (`OP`)**: evidence-backed problem or leverage point
Required: `evidence` (link or summary), `segment` (persona/market), `severity`

**Initiative (`I`)**: planned solution theme/release slice
Required: `non_goals`, `status` (proposed/active/shipped), `release_target` (optional date)

---

### Experience

**Stage (`G`)**: coarse journey phase
Required: `order_index`

**Step (`J`)**: unit of user intent/behavior (NOT a screen)
Required: `actor`, `intent`, `success_criteria`
Recommended: `channel/touchpoint`, `pain_points` (descriptive refs), `instrumentation_notes`, `opportunity_refs` (comma-separated Opportunity IDs)

---

### Structure

**Area (`A`)**: IA grouping (product section, domain area)
Required: `scope`

**Place (`P`)**: navigable/product location (route, destination, conceptual area)
Required: `surface` (web/iOS/android/etc.), `route_or_key`, `access` (`public`, `auth`, or `role:<slug>`)
Recommended: `primary_nav` (`true`/`false`), `entry_points` (comma-separated `kind:value` entries such as `link:/billing,notification:payment_failed`)

---

### UI behavior

**ViewState (`VS`)**: distinct render/interaction mode within a Place
Required: `place_id` (parent `P-*`), `data_required`
Recommended: `variants` (loading/empty/error), `entry_actions`, `exit_actions`

**Component (`C`)**: UI building block
Required: `responsibility`, `inputs` (props), `outputs` (events/callbacks)
Recommended: `a11y_constraints`, `telemetry_events`

**State (`ST`)**: state machine state (when needed)
Required: `scope_id` (Place/Component), `invariants` (what must be true)
Recommended: render as nested detail when a ViewState graph already exists for the same Place

**Event (`E`)**: named trigger (user/system)
Required: `source_kind` (user/system/timer), `payload_schema` (lightweight)

---

### Service delivery

**Process (`PR`)**: operational activity (front/back/support)
Required: `visibility` (frontstage/backstage/support), `sla` (if any)
Rendering default: `SystemAction` and `DataEntity` occupy a derived `system` lane and `Policy` occupies a derived `policy` lane

**SystemAction (`SA`)**: discrete system operation/API call
Required: `system_name`, `action` (verb), `failure_modes`

**DataEntity (`D`)**: domain object (Order, Subscription, Ticket…)
Required: `fields` (key fields), `system_of_record`

**Policy (`PL`)**: rule/constraint (eligibility, compliance, pricing, security)
Required: `policy_owner` (Legal/Risk/Product/etc.), `enforcement_point` (where applied)

---

## 3) Relationship types and allowed endpoints (contract)

### Structure

* `CONTAINS`: `G -> J`, `A -> P`, `P -> P`, `C -> C`
* `COMPOSED_OF`: `P -> C`, `VS -> C`

### Temporal / ordering

* `PRECEDES`: `J -> J`, `PR -> PR`
  *(Do not store `SUCCEEDS`; derive inverse in rendering.)*

### Navigation

* `NAVIGATES_TO`: `P -> P` *(optionally annotate with `[event]` and `{guard}`)*

### Traceability / realization

* `MEASURED_BY`: `O -> M`
* `SUPPORTS`: `OP -> O`
* `ADDRESSES`: `I -> OP`
* `IMPLEMENTED_BY`: `I -> P|VS|PR|SA`
* `REALIZED_BY`: `J -> P|VS|PR` *(at least one required; see governance)*

### Behavior

* `TRANSITIONS_TO`: `VS -> VS`, `ST -> ST`
  *(use `[event] {guard} / effect` annotations)*
* `EMITS`: `C|PR|SA -> E` *(event definitions live as `E` nodes)*

### Dependency & constraints

* `DEPENDS_ON`: `PR -> PR|SA`, `VS -> SA`, `C -> SA` *(keep dependencies explicit)*
* `CONSTRAINED_BY`: `P|PR|SA -> PL`

### Data

* `READS`: `SA -> D`
* `WRITES`: `SA -> D`
* `BINDS_TO`: `C -> D.field` *(store `field` in edge annotation or edge property)*

### Measurement placement

* `INSTRUMENTED_AT`: `M -> J|P|VS|E`

---

## 4) Governance rules (the “don’t drift” checklist)

**Required**

1. Every `O-*` has ≥1 `MEASURED_BY` to `M-*`.
2. Every `I-*` `ADDRESSES` ≥1 `OP-*`.
3. Every `J-*` has ≥1 `REALIZED_BY` to `P-*` **or** `VS-*` (or `PR-*` for service-only steps).
4. Every `P-*` belongs under an `A-*` (directly or via `P CONTAINS P`).

**Recommended**
5) Key `M-*` nodes have ≥1 `INSTRUMENTED_AT` to the exact `J/P/VS/E` where measured.
6) Any `PL-*` has at least one explicit `CONSTRAINED_BY` edge from its enforcement point(s).
7) Any async/error-prone Place has a `VS` transition model (at least: normal/loading/error).

---

## 5) Rendering guidance (what each view “projects”)

* **Outcome Map:** `O, M, OP, I` with `MEASURED_BY, SUPPORTS, ADDRESSES, IMPLEMENTED_BY` and grouped Metric instrumentation annotations when `INSTRUMENTED_AT` targets are out of scope
* **Journey:** `G, J` with `CONTAINS, PRECEDES` plus `Step.props.opportunity_refs` annotations to `OP`
* **Service Blueprint:** `J, PR, SA, D, PL` with `REALIZED_BY, DEPENDS_ON, READS/WRITES, CONSTRAINED_BY`, rendered in canonical customer/frontstage/backstage/support/system/policy lanes
* **IA Map:** `A, P` with `CONTAINS, NAVIGATES_TO` plus route/access/entry metadata annotations
* **Scenario Flow:** `J` + subset `P/VS` with `PRECEDES, REALIZED_BY, NAVIGATES_TO`, where branching Steps use `kind=decision`
* **UI Contracts:** `P/VS/C` and optionally `ST/E` with `COMPOSED_OF, TRANSITIONS_TO, EMITS, BINDS_TO`, with `ViewState` primary and `State` nested by `scope_id`

---

If you want, I can also provide a **machine-checkable JSON Schema** version of this (node + edge validation), but the above is the “handable” one-pager teams can follow without tooling.
