# SDD-Text v0.1 — Endpoint Contracts (Semantic Rules)

This document defines the **semantic contract** for SDD-Text relationships: which node types are allowed on each endpoint, what the relationship means, and what additional constraints/annotations apply.

**Scope:** These rules apply **after parsing** (EBNF) and **after compilation** to canonical JSON. They are designed to be enforced by tooling (e.g., JSON Schema + additional validators).

Machine-readable extraction target: `bundle/v0.1/core/contracts.yaml`.

---

## 1) Conformance Levels

Tooling SHOULD support at least two validation modes:

- **Permissive:** validate syntax + referential integrity (IDs exist, types are known), warn on contract violations.
- **Strict:** enforce all endpoint contracts and required edge metadata; fail validation on violations.

Unless specified otherwise, the rules below are intended for **Strict** mode.

---

## 2) Common Semantic Rules

### 2.1 Referential integrity
- Every edge `from` and `to` MUST reference an existing node ID.
- `to_name` (optional name hint) MUST NOT affect semantics.
  - Tooling MAY warn/error if `to_name` does not match the resolved node `name`.

### 2.2 Directionality
Relationships are directed. Tooling MUST NOT infer inverse edges.

### 2.3 Edge annotation support
In v0.1, edge annotations are syntactic affordances that only have defined semantics for certain relationships:

- `[Event] {Guard} / Effect` annotations have defined semantics for:
  - `TRANSITIONS_TO`
  - `NAVIGATES_TO` (optional)
  - (Optionally) `PRECEDES` when used for conditional flows; otherwise discouraged

For other relationships, annotations are allowed syntactically (to keep the grammar simple) but SHOULD be treated as edge properties (or ignored) unless your project standardizes them.

### 2.4 Multi-edges
Multiple edges of the same type between the same endpoints are allowed.
- Tooling MAY warn on duplicates (same `from`, `type`, `to`, `event`, `guard`, `effect`, and edge props).

---

## 3) Relationship Contracts

Each relationship below defines:
- **Meaning** (normative)
- **Allowed endpoints** (normative)
- **Additional constraints** (normative unless marked “recommended”)

> Notation: `A → B` means `from` type A, `to` type B.

---

### CONTAINS
**Meaning:** Hierarchical containment / grouping (IA, journey structure, UI hierarchy).

**Allowed endpoints:**
- `Stage → Step`
- `Area → Place`
- `Place → Place`
- `Place → ViewState`
- `Component → Component`

**Additional constraints:**
- Containment SHOULD be acyclic.
- A node SHOULD have at most one structural parent via `CONTAINS` (recommended). If multiple parents exist, the model becomes a graph of reuse rather than a tree; tooling SHOULD surface this explicitly.

---

### COMPOSED_OF
**Meaning:** Composition relationship used for UI/building-block assembly (rendering/composition tree or DAG).

**Allowed endpoints:**
- `Place → Component`
- `ViewState → Component`

**Additional constraints:**
- `COMPOSED_OF` SHOULD be acyclic.
- For reusable components, prefer `Component CONTAINS Component` (structural) + reference at composition points via `COMPOSED_OF` (recommended practice).

---

### PRECEDES
**Meaning:** Temporal ordering / sequence in a scenario, journey, or process.

**Allowed endpoints:**
- `Step → Step`
- `Process → Process`
- `State → State` (allowed but discouraged; prefer `TRANSITIONS_TO` for state machines)

**Additional constraints:**
- If `PRECEDES` is used to represent a *linear* flow, tooling MAY warn on cycles.
- For loops (retry/recovery), cycles are allowed but SHOULD be annotated (e.g., edge prop `kind=loop`) (recommended).

---

### NAVIGATES_TO
**Meaning:** Navigation between product locations (routing, deep links, primary nav).

**Allowed endpoints:**
- `Place → Place`

**Additional constraints:**
- `[Event]` MAY represent a user/system trigger (e.g., `ClickBilling`, `DeepLink`).
- `{Guard}` MAY represent navigation preconditions (e.g., `isAuthenticated`).
- Navigation within a single Place (e.g., SPA tab/wizard state) SHOULD be modeled as `ViewState TRANSITIONS_TO ViewState` (recommended).

---

### MEASURED_BY
**Meaning:** A metric measures an outcome.

**Allowed endpoints:**
- `Outcome → Metric`

**Additional constraints:**
- Each `Outcome` SHOULD have ≥ 1 outgoing `MEASURED_BY` edge (recommended as a governance rule).

---

### SUPPORTS
**Meaning:** An opportunity supports (contributes to) an outcome.

**Allowed endpoints:**
- `Opportunity → Outcome`

---

### ADDRESSES
**Meaning:** An initiative addresses an opportunity.

**Allowed endpoints:**
- `Initiative → Opportunity`

---

### IMPLEMENTED_BY
**Meaning:** An initiative is implemented by concrete deliverables (experience structure, UI, process, system work).

**Allowed endpoints:**
- `Initiative → Place`
- `Initiative → ViewState`
- `Initiative → Component`
- `Initiative → Process`
- `Initiative → SystemAction`

**Additional constraints:**
- Use `IMPLEMENTED_BY` for “work produces artifact.”
- Use `REALIZED_BY` for “experience step is realized by artifact.”

---

### REALIZED_BY
**Meaning:** A user/customer Step is realized by product structure, UI state, and/or service delivery actions.

**Allowed endpoints:**
- `Step → Place`
- `Step → ViewState`
- `Step → Process`

**Additional constraints:**
- Every `Step` SHOULD have ≥ 1 `REALIZED_BY` edge (recommended as a governance rule).
- If a `Step` maps to a Place, but also requires explicit within-place UI states, include both:
  - `Step REALIZED_BY Place` and `Step REALIZED_BY ViewState` (recommended).

---

### TRANSITIONS_TO
**Meaning:** A transition within a state model, driven by an event, optionally guarded, optionally producing an effect.

**Allowed endpoints:**
- `ViewState → ViewState`
- `State → State`

**Additional constraints:**
- If `[Event]` is present, it SHOULD reference an `Event` node ID (recommended in v0.1; planned to become strict in v0.2+).
- `{Guard}` is a boolean condition string.
- `/ Effect` MAY reference a `SystemAction` ID (e.g., `SA-009`) or be a label.

---

### EMITS
**Meaning:** Declares that an entity emits/produces an event.

**Allowed endpoints:**
- `Component → Event`
- `ViewState → Event`
- `Process → Event`
- `SystemAction → Event`

**Additional constraints:**
- If using strict analytics/instrumentation semantics, emitted events SHOULD have unique IDs and stable payload schemas (recommended).

---

### DEPENDS_ON
**Meaning:** Declares a dependency (execution depends on another process or system action).

**Allowed endpoints:**
- `Process → Process`
- `Process → SystemAction`
- `ViewState → SystemAction`
- `Component → SystemAction`

**Additional constraints:**
- Use `DEPENDS_ON` when the dependency is required for correctness.
- For “reads/writes” of domain objects, prefer explicit `READS/WRITES` on `SystemAction` (recommended).

---

### CONSTRAINED_BY
**Meaning:** Declares that an element is constrained by a policy/rule.

**Allowed endpoints:**
- `Place → Policy`
- `Process → Policy`
- `SystemAction → Policy`

**Additional constraints:**
- `Policy.enforcement_point` SHOULD correspond to at least one incoming `CONSTRAINED_BY` edge (recommended).

---

### READS
**Meaning:** A system action reads a domain entity.

**Allowed endpoints:**
- `SystemAction → DataEntity`

---

### WRITES
**Meaning:** A system action writes/creates/updates a domain entity.

**Allowed endpoints:**
- `SystemAction → DataEntity`

---

### BINDS_TO
**Meaning:** A UI component binds to a domain entity field (data binding / input/output mapping).

**Allowed endpoints:**
- `Component → DataEntity`

**Additional constraints:**
- A `BINDS_TO` edge MUST include an edge property `field=<fieldName>`.
  - Example: `BINDS_TO D-002 "Subscription" field="status"`
- Tooling MAY allow `field` to be a dotted path (e.g., `billing.address.zip`).

---

### INSTRUMENTED_AT
**Meaning:** A metric is instrumented/observed at a specific experience/structure/event node.

**Allowed endpoints:**
- `Metric → Step`
- `Metric → Place`
- `Metric → ViewState`
- `Metric → Event`

**Additional constraints:**
- Use `INSTRUMENTED_AT Metric → Event` when the metric is computed from event streams.
- Use `INSTRUMENTED_AT Metric → Step/Place/ViewState` when the metric is conceptually tied to a moment in the experience (recommended).
- If a renderer filters out the instrumentation target type, it MAY surface `INSTRUMENTED_AT` as grouped Metric annotations instead of visible edges.

---

## 4) Cross-field Consistency Rules (Recommended)

These are not strictly endpoint contracts, but they prevent common drift.

### 4.1 ViewState placement
If a `ViewState` has `place_id=P-###`, then one of the following SHOULD be true:
- the model includes `CONTAINS P-### → VS-###`, OR
- tooling treats `place_id` as the authoritative parent and auto-materializes (or verifies) the containment.

### 4.2 IA vs within-place behavior
- Navigation across Places: `Place NAVIGATES_TO Place`
- Within-place mode changes: `ViewState TRANSITIONS_TO ViewState`

### 4.3 Avoiding “screen = step” collapse
- `Step` is behavioral/intentful.
- `Place` is structural.
- `ViewState` is behavioral UI mode within a Place.

Tooling SHOULD flag models where most `Step` nodes map 1:1 to Places without ViewStates in complex flows (heuristic warning).

### 4.4 Journey opportunity traceability
- Prefer `Step.props.opportunity_refs` as a comma-separated list of `Opportunity` IDs when a journey view needs machine-resolved opportunity references.
- `pain_points` MAY remain descriptive, but tooling SHOULD use `opportunity_refs` for resolvable traceability.

### 4.5 Service blueprint visibility values
- `Process.visibility` canonical values are `frontstage`, `backstage`, and `support`.
- Renderers MAY treat `customer-visible` as an alias for `frontstage` and `not-visible` as an alias for `backstage` in permissive mode, but those labels are non-canonical.
- `SystemAction` and `DataEntity` occupy a derived `system` lane, and `Policy` occupies a derived `policy` lane.

### 4.6 IA place metadata
- `Place.access` SHOULD be `public`, `auth`, or `role:<slug>`.
- `Place.entry_points` MAY be serialized in v0.1 as comma-separated `kind:value` entries.

### 4.7 Scenario branching without new tokens
- Represent decision points as `Step.props.kind=decision` rather than adding a `Decision` node type in v0.1.
- When both `{Guard}` and `[Event]` are present on a branching edge, renderers SHOULD prefer the guard text as the branch label.

### 4.8 UI contracts graph precedence
- When both `ViewState` and `State` graphs are present, treat `ViewState` as the primary graph and `State` as scoped secondary detail.
- `State.scope_id` SHOULD resolve to an existing `Place` or `Component`.

---

## 5) Notes on Extension (Non-normative)

- If you later add `Decision` as a node type, prefer modeling it as a `Step` subtype (type tag or prop) and keep the endpoint contracts unchanged.
- If you add `IMPLIES` nesting (v0.2+), define it as an authoring-time rule that materializes explicit edges conforming to the contracts above.
