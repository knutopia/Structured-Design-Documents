# SDD-Text v0.1 — Authoring Spec (Type-first DSL)

SDD-Text is a compact, human- and LLM-friendly DSL for authoring a typed product/design graph. It compiles deterministically into canonical JSON for validation (e.g., JSON Schema) and rendering into multiple diagram views.

Machine-readable extraction target for source parsing behavior: `bundle/v0.1/core/syntax.yaml`.

This document is intentionally compatible with the EBNF grammar. For extraction into `core/syntax.yaml`, it provides human-oriented operational clarifications such as default version behavior, fixed edge-element order, and canonical compilation expectations; the grammar remains primary for formal parse structure and lexical precision.

---

## 0. Versioning

A file MAY declare its version at the top:

```text
SDD-TEXT 0.1
```

If omitted, tooling MUST assume `0.1`.

---

## 1. Lexical rules

### 1.1 Lines

- One statement per line.
- Leading/trailing whitespace is ignored.
- Blank lines are allowed.
- Comments start with `#` and run to end of line.

### 1.2 Tokens

- **Identifiers (IDs):** `[A-Z]{1,3}-[0-9]{3,}` (examples: `P-020`, `VS-020a` is allowed only if your ID regex permits suffixes; see §1.3)
- **Type tokens:** `Outcome`, `Metric`, `Opportunity`, `Initiative`, `Stage`, `Step`, `Area`, `Place`, `ViewState`, `Component`, `State`, `Event`, `Process`, `SystemAction`, `DataEntity`, `Policy`
- **Relationship tokens:** `CONTAINS`, `COMPOSED_OF`, `PRECEDES`, `NAVIGATES_TO`, `MEASURED_BY`, `SUPPORTS`, `ADDRESSES`, `IMPLEMENTED_BY`, `REALIZED_BY`, `TRANSITIONS_TO`, `EMITS`, `DEPENDS_ON`, `CONSTRAINED_BY`, `READS`, `WRITES`, `BINDS_TO`, `INSTRUMENTED_AT`

Tooling MUST treat the NodeType vocabulary and Relationship vocabulary as **disjoint**.

### 1.3 ID formats (recommended)

To support nested and sub-states cleanly, v0.1 RECOMMENDS allowing optional suffixes:

- Base: `PREFIX-###` (e.g., `VS-020`)
- Suffix: `PREFIX-###<suffix>` where `<suffix>` is `[a-z][a-z0-9]*` (e.g., `VS-020a`, `VS-020error`)

If suffixes are allowed, tooling MUST enforce uniqueness across the full ID string.

### 1.4 Strings

- Names MUST be double-quoted: `"..."`
- Property values MAY be unquoted if they contain only: `[A-Za-z0-9_./:-]+`
- Otherwise property values MUST be double-quoted.

No multi-line strings in v0.1.

---

## 2. File structure

A file consists of one or more **Node Blocks**.

A Node Block is:

1. A **Node Header** line
2. Zero or more **Body** lines (properties, edges, or nested nodes)
3. A required terminator: `END`

Indentation is optional for parsing but RECOMMENDED for readability.

---

## 3. Node Blocks

### 3.1 Node Header

```text
<NodeType> <ID> "<Name>"
```

Example:

```text
Place P-020 "Billing"
```

### 3.2 Node Body — allowed line kinds

Inside a node block (before `END`), the following lines are allowed:

A) **Property line**

```text
<key>=<value>
```

B) **Edge line (outgoing edge from current node)**

```text
<REL> <ToID> "<ToName>" [<Event>] {<Guard>} / <Effect> <key>=<value>...
```

- `"<ToName>"` is OPTIONAL. If present, it MUST appear immediately after `<ToID>`.
- `"<ToName>"` is a human-readable hint only; it MUST NOT affect edge semantics.

C) **Nested Node block (v0.1.1 mitigation, included in v0.1)** Nested nodes MUST begin with an explicit marker `+`:

```text
+ <NodeType> <ID> "<Name>"
```

Nested nodes MUST end with their own `END`. They are logically independent nodes; the `+` only indicates nesting for authoring and does not itself imply a relationship.

If you want the nesting to imply containment, you MUST still specify it explicitly via `CONTAINS` or `COMPOSED_OF`.

---

## 4. Properties

### 4.1 Keys

- Keys are case-sensitive.
- Keys SHOULD be snake\_case.

### 4.2 Values

- Unquoted tokens (see §1.4) are treated as strings.
- Tooling MAY additionally coerce `true/false` to booleans and digits to numbers.

### 4.3 Reserved keys (recommended)

- `owner` (team/role)
- `description`

Type-specific required properties are governed by your project schema (recommended to validate post-compilation).

---

## 5. Edges

### 5.1 Edge syntax

```text
<REL> <ToID> "<ToName>" [<Event>] {<Guard>} / <Effect> <key>=<value>...
```

- `<REL>` is a relationship token (e.g., `NAVIGATES_TO`).
- `<ToID>` is the destination node ID.
- `"<ToName>"` is OPTIONAL and is a **target name hint** for human readability.
  - Tooling SHOULD resolve `<ToID>` and MAY validate that `<ToName>` matches the referenced node’s `name` (warning or error by policy).
- `[<Event>]` is OPTIONAL and MUST be enclosed in `[]`.
- `{<Guard>}` is OPTIONAL and MUST be enclosed in `{}`.
- `/ <Effect>` is OPTIONAL and MUST begin with `/`.
- Optional trailing `key=value` pairs are edge properties.

Order is fixed: `REL ToID` then optional `"<ToName>"` then optional `[Event]` then optional `{Guard}` then optional `/ Effect` then optional properties.

### 5.2 Event and Guard conventions

- Event text SHOULD match an `Event` node ID (`E-###`) OR a short label. Tooling MAY enforce that labels resolve to `Event` nodes.
- Guard text is an expression string; v0.1 does not standardize its language.

### 5.3 Effect conventions

- Effects MAY reference a `SystemAction` ID (e.g., `SA-009`) or be a short label.

### 5.4 Edge identity

SDD-Text does not assign IDs to edges in v0.1. Canonical JSON output MAY add an `edge_id` for tooling but MUST not require it in authoring.

Tooling SHOULD treat two edges as **duplicates** if they have the same `from`, `type`, `to`, `event`, `guard`, `effect`, **and identical edge `props`**. The optional `to_name` hint MUST be ignored for duplicate detection.

---

## 6. Nesting (explicit marker `+`)

### 6.1 Purpose

Nesting is purely an authoring affordance: it helps writers place related nodes near each other.

### 6.2 Parsing rule

Within a node body, a line whose **first non-whitespace character** is `+` starts a nested node header. The nested node continues until its `END`.

### 6.3 Semantic rule

Nesting does NOT imply any relationship. If you want containment/composition, add edges explicitly:

- Structural containment: `CONTAINS <child>`
- UI composition: `COMPOSED_OF <component>`

---

## 7. Deterministic compilation to JSON (canonical form)

Tooling MUST compile to a canonical JSON document:

```json
{
  "schema": "sdd-text",
  "version": "0.1",
  "nodes": [
    {"id": "P-020", "type": "Place", "name": "Billing", "props": {"surface": "web"}},
    ...
  ],
  "edges": [
    {"from":"P-020","type":"NAVIGATES_TO","to":"P-021","to_name":"Review","event":"ClickReview","guard":"hasPlanSelected","effect":null,"props":{}},
    {"from":"P-020","type":"NAVIGATES_TO","to":"P-022","event":"ClickOptions","guard":"hasPlanSelected","effect":null,"props":{}},
    ...
  ]
}
```

### 7.1 Canonicalization requirements

To keep diffs stable:

- Nodes MUST be sorted by `id` ascending.
- Node `props` keys MUST be sorted lexicographically.
- Edges MUST be sorted by `(from, type, to, event, guard, effect, props)` where `props` is compared by the lexicographically-sorted sequence of `(key, value_as_json)`, and `value_as_json` is the minified JSON encoding of the value with any object keys sorted lexicographically.
- `to_name` MUST NOT affect sort order (it is a hint only).
- Edge `props` keys MUST be sorted lexicographically.

### 7.2 Forward references

Edges MAY reference nodes defined later. Tooling MUST resolve references after parsing all nodes.

### 7.3 Optional named edges

In the compiled JSON, edges MAY include:

- `to_name` (string | null): copied from the optional `"<ToName>"` hint.

### 7.4 Validation

After compilation, tooling SHOULD validate:

- IDs unique
- Relationship tokens valid
- Endpoint types allowed (if you enforce an edge contract)
- Required node properties per type (project schema)

---

## 8. Examples

### 8.1 Place with nested ViewStates (authoring adjacency)

```text
Place P-020 "Billing"
  surface=web
  route_or_key="/billing"
  access=auth
  entry_points="link:/billing,notification:payment_failed"
  primary_nav=true
  NAVIGATES_TO P-021 [ClickReview] {hasPlanSelected}
  CONSTRAINED_BY PL-004

  + ViewState VS-020a "Billing:Editing"
    place_id=P-020
    data_required="PaymentMethod"
    TRANSITIONS_TO VS-020b [Submit] {paymentValid} / SA-009
  END

  + ViewState VS-020b "Billing:Success"
    place_id=P-020
    data_required="Subscription"
  END
END
```

### 8.2 Step mapped to a Place (steps ≠ screens)

```text
Step J-014 "Enter payment details"
  actor=Customer
  intent="Add a valid payment method"
  success_criteria="Payment method stored and usable"
  REALIZED_BY P-020 "Billing"
END
```

### 8.3 Journey step with opportunity references and branching

```text
Step J-015 "Choose fulfillment"
  actor=Customer
  intent="Select delivery or pickup"
  success_criteria="A fulfillment route is selected"
  opportunity_refs="OP-001,OP-002"
  kind=decision
  PRECEDES J-016 [E-010] {delivery_selected}
  PRECEDES J-017 [E-011] {pickup_selected}
END
```

### 8.4 State machine scoped to a component

```text
State ST-020a "Form Ready"
  scope_id=C-010
  invariants="All required fields valid"
  TRANSITIONS_TO ST-020b [E-010] {canSubmit} / SA-010
END
```

---

## 9. Non-goals (v0.1)

- No multi-line strings.
- No inline node definitions on edge lines.
- No mandatory edge IDs.
- No standardized guard expression language.

---

## 10. Suggested next increment (v0.2)

- Formal EBNF grammar.
- Optional `IMPLIES` nesting rules. Context: v0.1 treats nesting (`+`) as a pure authoring affordance. In practice, authors almost always intend a relationship when they nest (e.g., a `Place` that “contains” nested `ViewState`s, or a `Place` that “composes” nested `Component`s). An opt-in `IMPLIES` mechanism lets tooling auto-add the most likely edge (e.g., nesting a `ViewState` under a `Place` implies `CONTAINS`) to reduce repetitive edge authoring—while still allowing explicit overrides (e.g., suppress the implied edge or choose `COMPOSED_OF` instead of `CONTAINS`).
- Standardized `Event` references (require `E-*` nodes). Context: v0.1 allows `[<Event>]` to be either a freeform label or an `Event` node ID. Standardizing on explicit `Event` nodes improves referential integrity, reuse (the same event used across multiple transitions), and downstream tooling (instrumentation mapping, analytics taxonomies, test generation). A practical compromise for authoring is to allow tooling to auto-materialize missing `E-*` nodes from inline labels (with a warning) in “permissive” mode, and require explicit `E-*` references in “strict” mode.
- Strict endpoint contracts (allowed type pairs per relationship).
