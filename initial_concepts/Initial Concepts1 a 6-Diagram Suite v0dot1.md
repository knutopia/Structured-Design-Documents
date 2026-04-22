# Initial Concepts 1: A 6-Diagram Suite (v0.1)

Below is a **6-diagram suite** that (a) treats *steps ≠ screens*, (b) gives you a **global IA structure** as a source of truth, and (c) preserves **end-to-end traceability** from product intent → experience intent → structure → UI behavior.

The key move is a unified taxonomy centered on **Step**, **Place**, and **ViewState**:

* **Step** = unit of user intent/behavior (“what happens”)
* **Place** = unit of product structure/navigation (“where in the product”)
* **ViewState** = unit of UI state within a place (“what’s currently rendered/active”)

Everything else is layered on top.

---

# 0) Unified notation (one graph, multiple projections)

## Canonical node types (minimal, but complete)

**Product intent**

* `Outcome`
* `Metric`
* `Opportunity`
* `Initiative` (or “SolutionTheme”)

**Experience**

* `Stage`
* `Step`

**Structure**

* `Area` (optional grouping)
* `Place`

**UI behavior**

* `ViewState`
* `Component`
* `State` (state machine state)
* `Event`

**Service delivery (ops/tech)**

* `Process`
* `SystemAction`
* `DataEntity`
* `Policy`

You don’t need all of these on day 1; but if you adopt the IDs and relationship vocabulary now, you won’t have to refactor later.

## Canonical relationship types

Keep these few and reuse everywhere:

**Structure**

* `CONTAINS` (parent → child)
* `COMPOSED_OF` (UI composition; Place/ViewState → Component)

**Temporal / scenario ordering**

* `PRECEDES` (Step/State → Step/State)

  * Don’t store `SUCCEEDS`; derive it.

**Realization / traceability**

* `SUPPORTS` (Opportunity → Outcome)
* `ADDRESSES` (Initiative → Opportunity)
* `REALIZED_BY` (Step → Place or Step → ViewState)
* `IMPLEMENTED_BY` (Initiative → Place/ViewState/Process)

**Navigation**

* `NAVIGATES_TO` (Place → Place)

**Behavior**

* `EMITS` / `TRIGGERS` (Component/ViewState/Process → Event)
* `TRANSITIONS_TO` (State/ViewState → State/ViewState)

**Dependency & constraints**

* `DEPENDS_ON` (Frontstage → Backstage/Support/SystemAction)
* `CONSTRAINED_BY` (Process/SystemAction/Place → Policy)

**Data**

* `READS` / `WRITES` (SystemAction/Component → DataEntity)
* `BINDS_TO` (Component → DataEntity.field)

**Measurement**

* `MEASURED_BY` (Outcome → Metric)
* `INSTRUMENTED_AT` (Metric → Step/Place/ViewState)

## Edge annotation grammar (so you can express guards, events, effects)

Use one consistent inline convention:

* `A -> B : RELATION [event] {guard} / effect`

Examples:

* `VS-Checkout -> VS-CheckoutError : TRANSITIONS_TO [Submit] {cardDeclined} / showError`
* `ST-AddPayment -> ST-Review : PRECEDES {paymentValid}`
* `P-Settings -> P-Billing : NAVIGATES_TO [ClickBilling]`

This answers your “guard” question: the `{guard}` is the boolean condition on the transition.

---

# 1) Diagram: Outcome–Opportunity Map (Product intent view)

## Purpose

Make product intent explicit and traceable: **why** you’re building things, and **how you’ll know** it worked.

## Nodes used

* `Outcome`, `Metric`, `Opportunity`, `Initiative`

## Key edges

* `Outcome MEASURED_BY Metric`
* `Opportunity SUPPORTS Outcome`
* `Initiative ADDRESSES Opportunity`
* `Metric INSTRUMENTED_AT Step/Place/ViewState` (optional but powerful)

If an `INSTRUMENTED_AT` target is outside the outcome-map node scope, renderers should surface it as grouped Metric annotations rather than pull the target node into the view.

## Minimal node properties

* Outcome: `statement`, `time_horizon`, `owner`
* Metric: `definition`, `source`, `cadence`, `guardrail?`
* Opportunity: `problem`, `segment`, `severity`, `evidence`
* Initiative: `scope`, `non_goals`, `release_slice`

---

# 2) Diagram: Journey Map (Experience over time view)

## Purpose

Define **experience intent from above**: stages and steps, needs, friction, moments of truth.

## Nodes used

* `Stage`, `Step`

## Key edges

* `Stage CONTAINS Step`
* `Step PRECEDES Step`
* `Step HAS_* properties` (see below)
* Optional: `Step.props.opportunity_refs` as a comma-separated list of Opportunity IDs for inline annotations

## Step properties (this is your “node contract” for the experience layer)

* `actor`
* `intent`
* `success_criteria`
* `opportunity_refs` (optional machine-resolved Opportunity IDs)
* `touchpoint/channel` (if relevant)
* `pain_points` (descriptive refs)
* `emotion` (optional)
* `time/effort` (optional)
* `instrumentation_hooks` (optional)

**Important:** A Journey Step does *not* assume a screen. It’s a behavioral unit.

---

# 3) Diagram: Service Blueprint (Delivery reality view)

## Purpose

Bind experience steps to **frontstage/backstage/system/policy** so design intent is feasible and operable.

## Nodes used

* `Step` (reused), `Process`, `SystemAction`, `Policy`, `DataEntity`

## Key edges

* `Step REALIZED_BY Process` (frontstage process)
* `Process DEPENDS_ON Process` (backstage/support)
* `Process CALLS SystemAction` (you can model this as `DEPENDS_ON` if you want fewer verbs)
* `SystemAction READS/WRITES DataEntity`
* `Process/SystemAction CONSTRAINED_BY Policy`
* Optional: `Process PRECEDES Process` for internal sequencing

## Blueprint lane convention (rendering rule, not new semantics)

* Canonical `Process.visibility` values are `frontstage`, `backstage`, and `support`.
* Render lanes in the order: `customer`, `frontstage`, `backstage`, `support`, `system`, `policy`.
* Map node types to lanes as follows:
  * `Step` → `customer`
  * `Process` → lane from `visibility`
  * `SystemAction`, `DataEntity` → `system`
  * `Policy` → `policy`
* Treat `customer-visible` and `not-visible` as legacy aliases for `frontstage` and `backstage`.

---

# 4) Diagram: IA / Place Map (Global product structure view)

## Purpose

Your “classical IA map” as a **source of truth** for product structure: what exists, where it lives, and how it connects.

## Nodes used

* `Area` (optional), `Place`

## Key edges

* `Area CONTAINS Place` (or `Place CONTAINS Place` for nested structure)
* `Place NAVIGATES_TO Place` (global navigation graph)

## Place properties (structure contract)

* `route_or_key` (e.g., `/billing`, `billing.settings`)
* `surface` (web, iOS, Android, kiosk)
* `access` (`public`, `auth`, or `role:<slug>`)
* `primary_nav?` (`true`/`false`)
* `entry_points` (serialized in v0.1 as comma-separated `kind:value` entries such as `link:/billing,notification:payment_failed`)
* `canonical_owner` (design/product/eng)

**How this solves SPA / single-screen paradigms**

* “Single Screen Application” often means **one shell Place** (e.g., `P-App`) that **CONTAINS** sub-Places (areas/panels) or hosts multiple `ViewState`s.
* You can represent “no route change” transitions as `ViewState TRANSITIONS_TO ViewState` under one Place.

---

# 5) Diagram: Scenario Flow (Step-to-Place mapping view)

## Purpose

Show a **specific scenario slice** (a flow), but *without* collapsing the world into screens. This is where Steps map onto Places and ViewStates.

## Nodes used

* `Step` (`kind=decision` when it is a branch point), `Place`, `ViewState` (optional)

## Key edges

* `Step PRECEDES Step` (scenario ordering)
* `Step REALIZED_BY Place` (or by `ViewState` when needed)
* Optional: `Place NAVIGATES_TO Place` (only the traversed subset)

## Why this is different from IA

* IA is **global structure**.
* Scenario flow is **a path through structure**, ordered by Steps.

This is the bridge artifact that both PM and design/eng can read without argument over “screen vs step.”

When a branching Step carries both event and guard annotations, use the guard text as the primary branch label.

---

# 6) Diagram: UI Contract (UI composition + state model view)

This is your “from below” foundation. Do it **per Place** (and optionally per key component).

Authoring Guidance:

- Use `ViewState` for within-place UI mode changes such as tabs, wizards, or success/error screens. In `ui_contracts`, that transition graph is primary whenever `ViewState` nodes are present.
- Use `State` only when you need scoped state-machine detail on a `Place` or `Component`, such as a form lifecycle or panel-local dirty/ready/submitting states.
- Set `State.scope_id` to the owning `Place` or `Component` id. A place-scoped state describes container-wide behavior; a component-scoped state describes local widget behavior.
- If a slice has no `ViewState` nodes, `ui_contracts` falls back to the grouped `State` transitions as the effective primary graph rather than rendering an empty view-state layer.

## 6A) ViewState map (within a Place)

**Nodes:** `ViewState`, `Event`
**Edges:** `ViewState TRANSITIONS_TO ViewState [event] {guard} / effect`

ViewState properties:

* `data_required`
* `empty/loading/error variants`
* `entry_actions`
* `exit_actions`

## 6B) Component composition (within Place or ViewState)

**Nodes:** `Component`, `DataEntity`
**Edges:**

* `Place/ViewState COMPOSED_OF Component`
* `Component CONTAINS Component`
* `Component BINDS_TO DataEntity.field`
* `Component EMITS Event`

Component properties:

* `responsibility`
* `inputs/outputs` (props)
* `a11y_constraints`
* `telemetry` (events)

## 6C) State machine (only where warranted)

**Nodes:** `State`, `Event`
**Edges:** `State TRANSITIONS_TO State [event] {guard} / effect`

This is where “guard” belongs formally.

If a Place has both a ViewState map and a scoped State machine, treat the ViewState map as the primary UI-contract view and render the State machine as nested detail by `scope_id`.

---

# How the six diagrams connect (traceability rules)

These are the “must-have” mapping edges that prevent drift:

1. **Opportunity ↔ Journey**

* At least one Step SHOULD reference Opportunity IDs through `opportunity_refs`

2. **Journey ↔ Structure**

* Every Step must have: `Step REALIZED_BY Place` (or by ViewState)

  * If a step occurs across multiple places, allow multiple edges.

3. **Structure ↔ UI behavior**

* Every Place must have: `Place COMPOSED_OF Component` and/or `Place CONTAINS ViewState`

4. **Experience ↔ Service delivery**

* Key Steps should map to: `Step REALIZED_BY Process`
* If Steps have SLAs or compliance: `Process/SystemAction CONSTRAINED_BY Policy`

5. **Outcome ↔ Instrumentation**

* Every Outcome must have: `Outcome MEASURED_BY Metric`
* Metrics should map to where measured: `Metric INSTRUMENTED_AT Step/Place/ViewState`

---

# Practical modeling rules (to keep the system sane)

**When to create a Place**

* User can “be there” as a destination (route, nav item, deep link, distinct permission boundary), OR
* It’s a stable conceptual area of the product (even if SPA route doesn’t change).

**When to create a Step**

* User intent changes, or success criteria changes, or a meaningful decision occurs.

**When to create a ViewState**

* Same Place, different rendered/interactive mode that affects behavior (loading/edit/error/empty/wizard-step-within-place).

**When to create a state machine**

* Non-trivial transitions, retries, async effects, cancellation, optimistic updates, or bugs keep recurring.
