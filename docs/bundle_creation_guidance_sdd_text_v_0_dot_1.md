# Goal

Create a \*\*Spec Bundle\*\* for for \*\*\*\*\*\*SDD-Text v0.1\*\* from the existing markdown source-of-truth documents, and then update the markdown language where needed so the docs and bundle are mutually consistent.

This bundle will enable a **compile → validate → render** toolchain for Structured Design Diagrams (SDD): a compact, human- and LLM-friendly DSL for authoring **design intent + product structure** as a **typed graph**.

You (Codex) have access to the same markdown files as the author. Treat the **markdown documents as the source of truth** for v0.1 semantics and vocabulary.

---

# Background and rationale

We have a set of v0.1 markdown specs describing:

- The **authoring DSL** (SDD-Text), including syntax, nesting, and edge notation.
- A canonical **JSON intermediate representation (IR)**.
- A **JSON Schema** for structural correctness.
- **Endpoint contracts** (semantic rules) defining allowed relationship endpoints and additional constraints.
- A set of **diagram views** (projections) that can be rendered from the typed graph.

However, prose specs alone are not ideal for tool implementation because:

- Tools need **machine-loadable** artifacts (schemas, vocabularies, contracts, view projections) rather than re-parsing prose.
- Version evolution should minimize tool churn: core tooling should load **versioned bundles**.

Therefore, the next step is to extract the prose spec into an **executable spec bundle** (Option A), with:

- A **core** sub-bundle (the minimum normative rules every tool must implement)
- One or more **profiles** (e.g., “recommended”) that impose stricter governance, conventions, and additional validations without changing the core language.

This structure enables:

- Stable compiler output (canonical JSON IR)
- Predictable validation (schema + semantic rules)
- Deterministic rendering projections (views)
- Future extensibility (v0.2+ can add profiles or new bundles)

---

# Spec Bundle (target output)

Create the following directory and files:

```
bundle/v0.1/ (existing folder - find it!)
  manifest.yaml

  core/
    vocab.yaml
    schema.json
    contracts.yaml
    projection_schema.json
    views.yaml

  profiles/
    recommended.yaml
    permissive.yaml  # optional; can be omitted if redundant

  examples/
    (2–3 realistic .sdd models)

  snapshots/
    (expected compiled JSON + expected view projections)
```

## What each file must contain

### 1) bundle/v0.1/manifest.yaml

A machine-readable manifest that declares:

- bundle name, version
- paths to core artifacts (vocab/schema/contracts/projection schema/views)
- available profiles and their intent
- compatibility notes (optional)

### 2) bundle/v0.1/core/vocab.yaml

A **single source of truth** for:

- Node types (token strings)
- Relationship types (token strings)
- Minimal metadata per token (category/grouping, short description)

This should be derived from the README + JSON Schema enums + endpoint contracts.

### 3) bundle/v0.1/core/schema.json

Extract the JSON Schema from the markdown schema doc into a standalone `.json` file.

- Keep it identical to the spec, except for purely mechanical formatting.
- Ensure `$schema` and any `id`/`$id` are correct/consistent.

### 4) bundle/v0.1/core/contracts.yaml

A machine-readable version of the endpoint contract rules:

- For each relationship type:
  - allowed `(from_type, to_type)` pairs
  - a short meaning/description
  - additional constraints as rule entries (with IDs and severity levels)
- Include conformance levels where present (e.g., permissive vs strict) as fields.

### 5) bundle/v0.1/core/views.yaml

Operational **projection definitions** for the v0.1 diagram views. For each view:

- view id + name
- included node types
- included edge types
- hierarchy rule (if any), ordering rule (if any)
- optional grouping conventions if explicitly normative

### 5a) bundle/v0.1/core/projection_schema.json

A machine-readable schema for normalized **projection snapshot outputs**.

- governs downstream renderer-facing projection JSON only
- does not change `.sdd` authoring or compiled canonical JSON
- should define a shared envelope so projection snapshots stay consistent across views

### 6) bundle/v0.1/profiles/recommended.yaml

A stricter governance profile that can be enabled in validation:

- required properties on nodes (e.g., `owner`, `description`) if defined as required in the “Initial Concepts” docs
- ID prefix ↔ node type enforcement if defined
- stricter event reference rules (where “recommended now / required later” is described)
- view conventions (lane defaults, grouping, visibility conventions) if they are intended as enforceable conventions

### 7) bundle/v0.1/examples/ and snapshots/

Provide 2–3 example `.sdd` models that cover multiple node/edge types and at least 2 views. For each example:

- snapshot compiled canonical JSON IR (deterministic ordering)
- snapshot of at least one view projection output (format can be JSON projection or a text format like Mermaid)
- JSON projection snapshots should use a shared envelope with `schema`, `version`, `view_id`, `source_example`, `nodes`, `edges`, `derived`, `omissions`, and `notes`

The goal is conformance testing: a tool can run compile+validate+render and match snapshots.

---

# Source-of-truth markdown documents (what they are)

You must read and extract from these files. Treat them as authoritative.
These documents live in the folder definitions/v0.1/

## A) readme\_structured\_design\_diagrams\_sdd\_text\_v\_0\_dot\_1.md

High-level overview:

- What SDD is and why it exists
- Pipeline concept (author → compile → validate → render)
- Lists and descriptions of node/relationship types (often grouped)
- High-level description of “Core Diagram Views”

Use this for:

- vocab metadata (grouping + descriptions)
- view inventory and purpose

## B) authoring\_spec\_type\_first\_dsl\_sdd\_text\_v\_0\_dot\_1.md

The authoring DSL spec:

- File format, version declaration rules, node block syntax
- Properties (`@key value`) and edge lines, including optional naming hints
- Nesting semantics (`+`) for containment blocks
- Any rules for compilation into canonical JSON

Use this for:

- parser expectations
- compile behavior, especially how text becomes IR
- edge annotation / human-readable target names

## C) ebnf\_grammar\_sdd\_text\_v\_0\_dot\_1.md

Normative grammar:

- EBNF for parsing SDD-Text
- Notes about parsing vs semantics

Use this for:

- parser implementation
- ensuring any syntax in examples is valid

## D) json\_schema\_sdd\_text\_v\_0\_dot\_1.md

Structural JSON Schema:

- Canonical JSON shape (`schema`, `version`, `nodes`, `edges`)
- Node + edge schema definitions
- Enums for node types and relationship types
- Pattern rules for IDs

Use this for:

- core/schema.json extraction
- vocab token lists (enums)

## E) endpoint\_contracts\_semantic\_rules\_sdd\_text\_v\_0\_dot\_1.md

Semantic endpoint contracts:

- For each relationship: meaning + allowed endpoints (from\_type → to\_type)
- Additional constraints beyond schema (referential integrity, event semantics, etc.)
- Conformance levels and “strict vs permissive” guidance

Use this for:

- core/contracts.yaml
- profile rules (strictness)

# Earlier Concept Documents Driving the Source-of-Truth Markdown Files

Thes following documents served as input  for the source-of-truth markdown files.
You must read and extract from these files. Treat them as informative guidance.
These documents live in the folder initial_concepts/

## F) Initial Concepts1 a 6-Diagram Suite v0dot1.md

Foundational conceptual framework:

- The 6-diagram suite and how views relate
- Composition details and conventions (e.g., lane/grouping notions)

Use this for:

- view definitions and any enforceable conventions
- deciding what belongs in core/views vs profiles/recommended

## G) Initial Concepts2 One-page Schema v0dot1.md

Foundational schema summary:

- Recommended base fields (e.g., `owner`, `description`)
- Prefix conventions per node type
- Per-type “required fields” modeling guidance

Use this for:

- profiles/recommended.yaml governance rules

## H) Structured Design Artifacts to Advance the Software Product Design Practice

The original foundational paper/doc:

- Rationale and conceptual grounding for structured artifacts and typed graphs

Use this for:

- explanatory alignment if needed
- but do not introduce new tokens/rules unless already reflected in v0.1 markdown specs

---

# Tactical guidance: critical bundle-gating decisions (apply while authoring core + profiles)

The markdown specs are the source of truth, but some areas still require **explicit operationalization** so the bundle artifacts are deterministic and implementable. While generating the bundle, handle the following as *tactical decision points*. If the markdown is explicit, follow it. If it’s ambiguous, apply the suggested default, encode it in the bundle (core or recommended profile as indicated), and document the choice in the final report.

## 1) Deterministic typing for `props` values (no silent coercion)

- **Problem:** different implementations may coerce `@key true` into boolean, `@key 123` into number, etc., which breaks canonical JSON determinism.
- **Bundle guidance:**
  - **Core default (recommended):** treat all prop values as **strings** unless the language provides an explicit typed literal mechanism. No implicit coercion.
  - **Profile option:** a profile may add *typed-field validation* (e.g., “this prop must be an integer”) without changing core compilation.

## 2) Core language vs governance profile (what is REQUIRED?)

- **Problem:** some documents describe “recommended base fields” (e.g., `owner`, `description`) and per-type required fields; this is governance, not necessarily core DSL.
- **Bundle guidance:**
  - Keep the **core** permissive and aligned with the canonical IR schema.
  - Put “required props,” “style rules,” and “org conventions” into `profiles/recommended.yaml`.

## 3) Opportunity ↔ Journey/Step traceability without expanding tokens

- **Problem:** early conceptual docs may mention verbs/relationships not in the v0.1 vocab.
- **Bundle guidance:**
  - **Do not expand v0.1 relationship tokens** to accommodate conceptual linkage.
  - Prefer **properties** for traceability in v0.1 (e.g., a list of Opportunity IDs on a Step), and reserve new relationship tokens for a later version if usage proves consistent.

## 4) Aliases vs real tokens (avoid accidental vocab drift)

- **Problem:** conceptual docs may include alternate relationship words (aliases) that are not part of the canonical vocab.
- **Bundle guidance:**
  - Treat non-vocab verbs as **informative aliases only**.
  - If you want ergonomics, tooling can optionally accept aliases and **rewrite** them to canonical tokens, but the bundle’s `core/vocab.yaml` stays closed.

## 5) ViewState parentage: `place_id` vs `CONTAINS Place → ViewState`

- **Problem:** the spec includes both an explicit parent reference (`place_id`) and an explicit containment edge. Implementations need an authoritative rule.
- **Bundle guidance (suggested):**
  - Treat `place_id` as the **authoritative parent reference**.
  - In **recommended** profile strict mode, require either:
    - an explicit `CONTAINS Place → ViewState` edge exists, **or**
    - the compiler materializes a **derived** containment edge (clearly marked as derived so diffs are explainable).

## 6) Strict-mode rules for `[Event]` references

- **Problem:** `[Event]` can be a label or an ID reference; for some relationships it should refer to an `Event` node.
- **Bundle guidance:**
  - **Core:** permissive—allow labels; optionally warn.
  - **Recommended:** require `[Event]` to reference an existing `Event` node ID for the relationships where the contracts imply this is the intended direction.

## 7) Derived semantics: keep compiled graph literal; derive only in views/render

- **Problem:** conceptual docs may suggest inferred inverses (e.g., SUCCEEDS from PRECEDES). Inference can create mismatched graphs and break contract logic.
- **Bundle guidance:**
  - **Core compilation must be literal**: do not materialize inverse edges.
  - Renderers and view projections may compute derived traversals **without emitting** new edges.

## 8) How “operational” should `views.yaml` be?

- **Problem:** you need views that are executable and consistent across renderers.
- **Bundle guidance:**
  - In `core/views.yaml`, encode **projection rules** (node/edge inclusion, hierarchy edges, ordering edges).
  - Keep **layout** renderer-specific.
  - If a view has explicit conventions (e.g., lanes, grouping, visibility rules), either:
    - put them in `views.yaml` as defaults if you want them normative, or
    - put them into `profiles/recommended.yaml` as enforceable conventions.

## 9) ID prefix ↔ node type enforcement (governance)

- **Problem:** prefix/type coupling improves readability, but it’s not purely structural.
- **Bundle guidance:**
  - Put prefix↔type enforcement into `profiles/recommended.yaml` (warn in permissive; error in recommended strict).

---

# Task 1: Generate bundle structure A from existing markdown

1. Create the directory/file structure exactly as specified.
2. Populate `core/*` from the existing v0.1 markdown specs, minimizing interpretation.
3. Populate `profiles/recommended.yaml` from “Initial Concepts 2” and any explicitly recommended strict rules in endpoint contracts.
4. Create 2–3 examples that are valid per EBNF + authoring spec, and compile cleanly to the JSON Schema.
5. Create snapshots for compilation and at least one view projection.

**Design constraint:** avoid expanding the v0.1 vocabulary (node types / relationship types). If “Initial Concepts” mentions additional verbs not in v0.1, treat them as informative only unless the v0.1 vocab includes them.

---

# Task 2: Update markdown language to match the bundle

After bundle generation:

1. Identify any places where prose in markdown should be clarified to align with bundle semantics (e.g., “normative vs informative”, determinism, profiles).
2. Apply small edits that:

- do not change intended meaning
- reduce ambiguity
- explicitly point to bundle artifacts as the machine-readable source

Specifically:

- Make it clear which rules are “core” vs “recommended profile” governance.
- Ensure vocabulary lists match `core/vocab.yaml`.
- Ensure endpoint contract tables match `core/contracts.yaml`.
- Ensure view definitions in prose match `core/views.yaml`.

---

# Output expectations

Deliver:

- The full `bundle/v0.1` structure populated.
- A concise report of:
  - what was extracted from where
  - any ambiguities encountered
  - the minimal edits made to markdown docs to sync with the bundle

---

# Notes

- The primary objective is **tool readiness**: artifacts should be loadable by a compiler/validator/renderer without special-casing prose.
- Maintain determinism: sorting rules, stable IDs, and canonicalization must lead to stable snapshots.
- Do not rely on prior chat as normative input; use only the markdown docs listed above.
