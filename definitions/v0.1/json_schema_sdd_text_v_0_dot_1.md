# SDD-Text v0.1 — JSON Schema (Compiled Canonical JSON)

This schema validates the **compiled canonical JSON** output described in the Authoring Spec (the output of parsing SDD-Text source text).

**Important limitations (JSON Schema alone):**
- Cannot reliably enforce **unique node IDs** by `id` within `nodes`.
- Cannot fully enforce **endpoint contracts** (edge type vs from/to node types) unless the compiler emits redundant `from_type`/`to_type` on edges.

Recommendation: validate with this JSON Schema first, then run a small semantic validator to enforce uniqueness, referential integrity, and endpoint contracts.

---

## 1) Core Schema (draft 2020-12)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.org/sdd-text/0.1/schema.json",
  "title": "SDD-Text Compiled Graph (v0.1)",
  "type": "object",
  "additionalProperties": false,

  "required": ["schema", "version", "nodes", "edges"],

  "properties": {
    "schema": {
      "const": "sdd-text"
    },
    "version": {
      "const": "0.1"
    },

    "nodes": {
      "type": "array",
      "items": { "$ref": "#/$defs/node" },
      "minItems": 1
    },

    "edges": {
      "type": "array",
      "items": { "$ref": "#/$defs/edge" },
      "minItems": 0
    }
  },

  "$defs": {
    "id": {
      "type": "string",
      "pattern": "^[A-Z]{1,3}-[0-9]{3,}([a-z][a-z0-9]*)?$"
    },

    "nodeType": {
      "type": "string",
      "enum": [
        "Outcome", "Metric", "Opportunity", "Initiative",
        "Stage", "Step",
        "Area", "Place", "ViewState",
        "Component", "State", "Event",
        "Process", "SystemAction", "DataEntity", "Policy"
      ]
    },

    "relType": {
      "type": "string",
      "enum": [
        "CONTAINS", "COMPOSED_OF", "PRECEDES", "NAVIGATES_TO",
        "MEASURED_BY", "SUPPORTS", "ADDRESSES", "IMPLEMENTED_BY", "REALIZED_BY",
        "TRANSITIONS_TO", "EMITS", "DEPENDS_ON", "CONSTRAINED_BY",
        "READS", "WRITES", "BINDS_TO", "INSTRUMENTED_AT"
      ]
    },

    "jsonValue": {
      "description": "Permissive value type for props. Tighten in project schemas if desired.",
      "oneOf": [
        { "type": "string" },
        { "type": "number" },
        { "type": "integer" },
        { "type": "boolean" },
        { "type": "null" },
        { "type": "array" },
        { "type": "object" }
      ]
    },

    "props": {
      "type": "object",
      "additionalProperties": { "$ref": "#/$defs/jsonValue" }
    },

    "node": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "type", "name", "props"],
      "properties": {
        "id": { "$ref": "#/$defs/id" },
        "type": { "$ref": "#/$defs/nodeType" },
        "name": { "type": "string", "minLength": 1 },
        "props": { "$ref": "#/$defs/props" }
      }
    },

    "edge": {
      "type": "object",
      "additionalProperties": false,
      "required": ["from", "type", "to", "props"],
      "properties": {
        "from": { "$ref": "#/$defs/id" },
        "type": { "$ref": "#/$defs/relType" },
        "to": { "$ref": "#/$defs/id" },

        "to_name": { "type": ["string", "null"], "minLength": 1 },

        "event": { "type": ["string", "null"] },
        "guard": { "type": ["string", "null"] },
        "effect": { "type": ["string", "null"] },

        "props": { "$ref": "#/$defs/props" },

        "from_type": {
          "description": "Optional redundant type emitted by tooling to enable endpoint-contract validation. If present, should match the resolved node type of `from`.",
          "$ref": "#/$defs/nodeType"
        },
        "to_type": {
          "description": "Optional redundant type emitted by tooling to enable endpoint-contract validation. If present, should match the resolved node type of `to`.",
          "$ref": "#/$defs/nodeType"
        }
      }
    }
  }
}
```

---

## 2) Optional: Contract Enforcement (Requires `from_type` + `to_type`)

If your compiler emits `from_type` and `to_type` on every edge, you can extend the schema to enforce endpoint contracts using `if/then` blocks.

**Approach:**
- Add `"required": ["from_type", "to_type"]` in the `edge` definition.
- Add an `allOf` array with one rule per relationship, e.g.:

```json
{
  "allOf": [
    {
      "if": { "properties": { "type": { "const": "NAVIGATES_TO" } }, "required": ["type"] },
      "then": {
        "properties": {
          "from_type": { "const": "Place" },
          "to_type": { "const": "Place" }
        },
        "required": ["from_type", "to_type"]
      }
    }
  ]
}
```

This is mechanically derivable from the **Endpoint Contracts** document.

---

## 3) Recommended Post-schema Checks (Semantic Validator)

Even with JSON Schema, a lightweight semantic validator SHOULD enforce:

1) **Unique IDs** across nodes (no duplicates).
2) **Referential integrity** for edges (`from`/`to` exist).
3) **Endpoint contracts** (edge relationship types vs node types), using:
   - node lookup by ID; and optionally
   - `from_type`/`to_type` if present.
4) Governance rules (project policy), such as:
   - Every `Outcome` has ≥ 1 `MEASURED_BY`.
   - Every `Step` has ≥ 1 `REALIZED_BY`.
   - `BINDS_TO` edges include `props.field`.

---

## 4) Project-Specific Schema Profiles (Pattern)

Keep this schema as a **core** format validator. For required properties per node type, create a project schema that adds constraints on `node.props` based on `node.type`.

Example pattern:

- If `type = Place`, then `props` must include: `surface`, `route_or_key`, `access`.

This is doable in JSON Schema using `allOf` + `if/then` conditions on each `node`.

