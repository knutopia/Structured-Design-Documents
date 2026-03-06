# Structured Design Diagrams (SDD-Text)

SDD-Text is a compact, human- and LLM-friendly way to author **design intent + product structure** as a **typed graph**. You write nodes and relationships once, then generate:

- **Diagram views** (Journey, IA, Service Blueprint, etc.)
- **Machine-checkable structure** (compile to canonical JSON → validate)
- A **traceability spine** from outcomes → experience → structure → UI behavior → service delivery

The goal is to reduce the gap between:
- product management intent (“why / what outcome”),
- design intent (“what experience should happen”), and
- implementation reality (“what structure/state/process actually delivers it”).

---

## v0.1 Bundle Alignment

For v0.1, this markdown document is explanatory and normative for extraction, while the bundle under `bundle/v0.1/` is the machine-readable artifact for tooling.

- Core machine artifacts: `core/vocab.yaml`, `core/schema.json`, `core/contracts.yaml`, `core/views.yaml`
- Governance overlays: `profiles/permissive.yaml`, `profiles/recommended.yaml`
- `core/views.yaml` now contains executable projection filters plus renderer defaults for annotations, lane mapping, branching, and state-emphasis conventions.

---

## Why a Typed Graph

Most teams maintain multiple diagram types that partially overlap (journeys, flows, IA, blueprints, state charts). Drift is common because each diagram is authored independently.

SDD-Text flips the approach:

- Maintain **one underlying graph** (nodes + relationships + minimal properties)
- Render **multiple projections** of that graph as diagrams
- Validate **structural integrity** with contracts + schema

---

## Core Diagram Views

SDD-Text supports multiple diagram “views” over the same graph. The recommended core set:

1. **Outcome–Opportunity Map**
   - Answers: *Why are we doing this? How will we measure success?*
   - Uses: `Outcome`, `Metric`, `Opportunity`, `Initiative`
   - `INSTRUMENTED_AT` context may render as grouped metric annotations when targets are outside the view scope.

2. **Journey Map**
   - Answers: *What steps happen over time, from the user’s perspective?*
   - Uses: `Stage`, `Step` (`PRECEDES`)
   - Opportunity traceability is rendered from `Step.props.opportunity_refs`, not a separate v0.1 relationship.

3. **Service Blueprint**
   - Answers: *What frontstage/backstage/system/policy work delivers each step?*
   - Uses: `Step`, `Process`, `SystemAction`, `Policy`, `DataEntity`
   - Lanes derive from `Process.visibility` plus node-type defaults for system and policy.

4. **IA / Place Map**
   - Answers: *What are the places in the product and how do they connect?*
   - Uses: `Area`, `Place` (`CONTAINS`, `NAVIGATES_TO`)
   - `route_or_key`, `access`, and optional entry metadata render as node annotations.

5. **Scenario Flow**
   - Answers: *How does a scenario traverse Steps and Places?*
   - Uses: `Step`, `Place`, optional `ViewState`
   - Branch points are modeled as `Step.props.kind=decision`.

6. **UI Contracts**
   - Answers: *What states and components exist within a Place, and how do they transition?*
   - Uses: `Place`, `ViewState`, `Component`, optional `State`, `Event`
   - `ViewState` is the primary graph; `State` is scoped secondary detail.

---

## Design principle: Step ≠ Screen

SDD-Text avoids conflating “what happens” with “where it happens.”

- **Step** = unit of user intent/behavior (experience semantics)
- **Place** = navigable/product location (IA semantics)
- **ViewState** = render/interaction mode within a Place (UI semantics)

This supports SPA / “single-screen” products: one `Place` can realize many `Step`s through multiple `ViewState`s.

---

## Node Types at a Glance

### Product intent
- `Outcome` — desired change in user/business reality
- `Metric` — how outcomes are measured
- `Opportunity` — evidence-backed leverage point / problem
- `Initiative` — solution theme / release slice

### Experience
- `Stage` — coarse journey phase
- `Step` — unit of user intent/behavior

### Structure
- `Area` — IA grouping
- `Place` — navigable destination / product location

### UI behavior
- `ViewState` — within-place behavior mode
- `Component` — UI building block
- `State` — state machine state (when needed)
- `Event` — named trigger (user/system)

### Service delivery
- `Process` — operational activity (front/back/support)
- `SystemAction` — discrete system operation/API call
- `DataEntity` — domain object
- `Policy` — rule/constraint

---

## Relationship Types at a Glance

A small, reusable set keeps tooling and authoring stable:

- **Structure:** `CONTAINS`, `COMPOSED_OF`
- **Ordering:** `PRECEDES`
- **Navigation:** `NAVIGATES_TO`
- **Traceability:** `MEASURED_BY`, `SUPPORTS`, `ADDRESSES`, `IMPLEMENTED_BY`, `REALIZED_BY`
- **Behavior:** `TRANSITIONS_TO`, `EMITS`
- **Dependency/constraints:** `DEPENDS_ON`, `CONSTRAINED_BY`
- **Data:** `READS`, `WRITES`, `BINDS_TO`
- **Measurement placement:** `INSTRUMENTED_AT`

---

## Authoring Format

SDD-Text v0.1 is a **type-first DSL**:

- The first **non-whitespace** token is the **node type** or **relationship** (except nested node headers, which begin with `+` followed by the node type).
- Leading indentation is allowed for readability and MUST be ignored by parsers.
- Node blocks end explicitly with `END`.
- Optional nesting uses `+` and is for authoring convenience (nesting does not imply relationships unless you add edges).

Example:

```text
Place P-020 "Billing"
  surface=web
  route_or_key="/billing"
  access=auth
  NAVIGATES_TO P-021 "Review" [ClickReview] {hasPlanSelected}

  + ViewState VS-020a "Billing:Editing"
    place_id=P-020
    data_required="PaymentMethod"
    TRANSITIONS_TO VS-020b "Billing:Success" [Submit] {paymentValid} / SA-009
  END
END
```

---

## Pipeline

1. **Author** `.sdd` (SDD-Text)
2. **Compile** → canonical JSON (`nodes[]`, `edges[]`)
3. **Validate** with:
   - Endpoint contracts (allowed type-pairs per relationship)
   - JSON Schema (required properties, structural constraints)
   - Optional profile governance (permissive or recommended)
4. **Render** diagram views (by filtering/projecting node/edge types)

---

## Documents in This Spec Set

- **SDD-Text v0.1 — Authoring Spec**: human-readable syntax + compilation rules
- **SDD-Text v0.1 — Endpoint Contracts**: semantic rules (which node types may connect via which relationships)
- **SDD-Text v0.1 — Grammar (EBNF)**: precise syntax definition
- **SDD-Text v0.1 — JSON Schema**: machine validation of compiled JSON

---

## Design Goals and Non-Goals

### Goals
- Compact enough for humans and LLMs to write correctly
- Deterministic compilation for stable diffs
- Strong validation (fail fast on structural drift)
- Supports both “from above” and “from below” modeling

### Non-Goals for v0.1
- No multi-line strings
- No standardized guard language
- No executable semantics (this is design structure, not a workflow engine)

---

## How to Contribute

- Keep the vocabularies small and stable.
- Add new node/edge types only when they enable a new view or prevent recurring ambiguity.
- Prefer adding properties over adding relationship types (until you need new semantics).
- If you change syntax, update EBNF + compiler tests first.
