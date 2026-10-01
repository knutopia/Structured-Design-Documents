# Step Differentiation for SDD v0.2

## 1. Purpose, authority, and boundaries

Introduce `JourneyStep`, `BlueprintStep`, and `ScenarioStep`, together with explicit correspondence and refinement relationships. Preserve existing realization behavior, validation obligations, and diagram behavior while removing the unintended sharing of one authorable `Step` type.

This document records the implementation decisions. Do not reopen them or substitute simpler behavior to make tests pass.

**Planning evidence:** the published repository was inspected on October 1, 2026. Local filesystem access failed, so implementation must first verify the checkout against this plan. The published v0.2 bundle contains inherited examples; this work establishes its first Step Differentiation canonical examples.

### Sources and non-negotiable invariants

| Source | Authority and invariant |
|---|---|
| User decisions recorded below | Define the intended feature, migration policy, and exclusions. |
| [v0.2 manifest](https://github.com/knutopia/Structured-Design-Documents/blob/main/bundle/v0.2/manifest.yaml) and referenced artifacts | Govern vocabulary, parsing, validation, projection, authoring, and display conventions. |
| [v0.2 contracts](https://github.com/knutopia/Structured-Design-Documents/blob/main/bundle/v0.2/core/contracts.yaml) | Establish existing endpoint legality and obligations that must carry forward. |
| [v0.2 views](https://github.com/knutopia/Structured-Design-Documents/blob/main/bundle/v0.2/core/views.yaml) | Establish the existing differences between diagram projections and presentation. |
| Supplied `AGENTS.md` | Requires bundle authority, shared runtime machinery, deterministic behavior, and the staged rendering boundary. |
| Existing v0.1 canonical diagrams and renderer acceptance fixtures | Provide visual comparison evidence. They do not establish language rules. |

The implementation must preserve these invariants:

1. **Bundle governs behavior.** No production list of the three Step names may substitute for loaded vocabulary, contracts, or view configuration.
2. **Compilation remains literal.** Preserve authored nodes and edges; do not materialize inverse, transitive, inherited, or refinement-derived edges.
3. **Projection remains the semantic boundary.** Renderers receive resolved semantic content; layout, routing, wrapping, and SVG construction remain downstream.
4. **v0.1 remains a compatibility baseline.** Preserve its bundle, examples, snapshots, and rendered corpus.
5. **Existing obligations transfer.** This feature does not redesign `REALIZED_BY`, required properties, or validation-profile severity.
6. **Acceptance precedes snapshots.** Prove the behavior and inspect the focused rendered example before recording new goldens.

Out of scope: Diagram nodes and membership, links to scenario-flow Diagrams, templates, IA hierarchy changes, Outcome–Opportunity relationship additions, automatic document-version migration, and unrelated renderer improvements.

## 2. Locked language and migration decisions

### 2.1 Node types

| Authorable type | Meaning | Primary diagram | Suggested ID prefix |
|---|---|---|---|
| `JourneyStep` | A meaningful episode of user/customer intent or behavior | `journey_map` | `J` |
| `BlueprintStep` | User/customer behavior anchoring service-delivery work | `service_blueprint` | `BP` |
| `ScenarioStep` | A specific action or decision within a scenario | `scenario_flow` | `S` |

Use **`BlueprintStep`**, with this exact capitalization. `BluePrintStep` is not an alias.

Remove `Step` from the v0.2 authorable vocabulary and compiled-schema enum. Do not add contextual reinterpretation or a compatibility alias inside v0.2. The v0.1 bundle continues to support `Step`.

Store ID-prefix conventions in authoring metadata. Preserve the existing prefix-validation severity and suggestion algorithm.

### 2.2 Existing relationships and obligations

Apply this endpoint matrix:

| Relationship | v0.2 Step endpoints |
|---|---|
| `CONTAINS` | `Stage → JourneyStep` |
| `PRECEDES` | `JourneyStep → JourneyStep`; `BlueprintStep → BlueprintStep`; `ScenarioStep → ScenarioStep` |
| `REALIZED_BY` | Each of the three types → `Place`, `ViewState`, or `Process` |
| `INSTRUMENTED_AT` | `Metric` → any of the three types |

Preserve all unrelated endpoint pairs.

The existing contract permits all three `REALIZED_BY` target types globally. Preserve that legality. Separately preserve current diagram presentation: journey realization links remain outside its primary structure, blueprint displays its Process connections, and scenario flow displays its Place/ViewState connections.

Transfer the existing Step rules to all three new types:

- Required properties, including owner, description, actor, intent, and success criteria.
- Direct realization requirements.
- `opportunity_refs` validation.
- Optional decision-kind validation.
- Branching-step marker recommendations.
- Authoring forms and relevant guided-addition metadata.

Preserve each rule’s current profile applicability and severity. In particular, a mapping or refinement does **not** satisfy a direct realization requirement.

Use existing generic validation executors with bundle-declared rule instances. Do not create a TypeScript “all Step types” list to apply these rules.

### 2.3 Correspondence: `MAPS_TO`

Legal authored endpoints:

- `JourneyStep MAPS_TO BlueprintStep`
- `BlueprintStep MAPS_TO JourneyStep`

Semantics:

- Optional and many-to-many.
- Symmetric correspondence.
- Either authoring direction is sufficient.
- Reciprocal declarations express one semantic correspondence and produce no reciprocity warning.
- Repeating the exact same directed declaration still follows the existing duplicate-edge diagnostic policy.
- No transitive equivalence, identity merging, property inheritance, or inherited relationships.
- No same-type mappings or mappings involving `ScenarioStep`.

Keep both reciprocal declarations in the compiled graph when both were authored. Semantic lookup, annotation generation, and semantic counting coalesce them.

### 2.4 Refinement: `REFINED_BY`

Legal authored endpoints:

- `JourneyStep REFINED_BY ScenarioStep`
- `BlueprintStep REFINED_BY ScenarioStep`

Semantics:

- Directed, optional, and non-transitive.
- Describes partial elaboration; it does not claim exhaustive decomposition.
- A parent may reference several ScenarioSteps.
- A ScenarioStep may refine several parents.
- Does not establish containment, ownership, execution order, or inherited realization.
- ScenarioStep order comes from explicit `PRECEDES` relationships.
- Mapped JourneySteps and BlueprintSteps may have different refinements.

Do not permit reverse authored `ScenarioStep REFINED_BY …` edges. Incoming lookup is allowed and does not create an inverse edge.

Neither new relationship introduces relationship-specific properties or event/guard/effect semantics. Preserve existing handling of unsupported annotations and raw source data.

### 2.5 Canonical examples and migrated content

For authored content being established or explicitly migrated as v0.2:

| Source context | Replace `Step` with |
|---|---|
| Canonical journey-map example | `JourneyStep` |
| Canonical service-blueprint example | `BlueprintStep` |
| Other occurrences | `ScenarioStep` |

Apply this to the inherited v0.2 example copies:

- `outcome_to_ia_trace`, `branching_journey`, and `three_branch_journey`: JourneySteps.
- `service_blueprint_slice`: BlueprintSteps.
- `scenario_branching`, `flow_journey_topology_challenge`, and Steps in `metric_event_instrumentation`: ScenarioSteps.
- Any additional Step-bearing source follows the same context rule.

For the v0.2 service-blueprint canonical, remove its inherited journey-map projection entry. Demonstrate explicit cross-view correspondence in the new mixed example described below. Do not keep a journey projection populated by BlueprintSteps.

Update IDs and all structured references consistently. Retain numeric portions and suffixes when replacing a prefix; resolve collisions through the bundle’s normal ID-allocation policy. Do not blindly replace strings inside arbitrary prose.

These rules do not authorize a repository-wide conversion of v0.1 documents, historical documentation, tests, or archived artifacts.

## 3. Architectural implementation

### 3.1 Bundle and runtime ownership

Update the v0.2 core vocabulary, compiled schema, contracts, authoring metadata, views, and profiles together. Update the projection schema only where its existing constraints require it.

Parser changes must continue through:

`loadBundle(...) → createParserSyntaxRuntime(bundle) → existing generic parsing`

The new node and relationship tokens require vocabulary changes, not special parser branches or new edge syntax.

Extend bundle types, loading, and cross-artifact validation before using new contract fields.

### 3.2 Semantic relationship lookup

Add one shared relationship reader below projection, reusable by domain callers. Keep raw compiled-graph and source-inspection APIs literal.

Extend relationship contracts with an optional semantic descriptor containing:

- Directionality: directed or symmetric.
- Reciprocal-declaration handling: preserve or coalesce.
- Semantic identity fields.

For `MAPS_TO`, declare symmetric directionality, coalescing, and identity based on relationship type plus the unordered endpoint pair. For `REFINED_BY`, declare directed identity based on relationship type plus ordered endpoints.

Absent metadata preserves existing directed behavior. Resolve existing identity defaults from the loaded contract rather than inventing a separate identifier-specific policy.

The shared reader must:

- Support outgoing, incoming, and incident semantic lookup.
- Make a symmetric correspondence discoverable from either endpoint.
- Return one correspondence for reciprocal declarations.
- Retain association with the original declarations.
- Use deterministic identity and ordering.
- Perform no graph expansion or inference.

Do not implement symmetry in individual renderers, terminal adapters, or a `MAPS_TO` string comparison. Adjust the v0.2 common-rule wording to distinguish directed source declarations from symmetric semantic correspondence.

Do not introduce a new CLI command or change helper/workflow protocol versions for this feature.

### 3.3 Projection and rendering

Each view selects its corresponding Step type. Mapping and refinement references must not pull other Step types into the view’s primary node set.

Replace semantic checks against literal `"Step"` throughout the affected projection and rendering paths:

- Journey role selection derives from the view’s hierarchy relationships and legal endpoint types.
- Scenario role selection uses its existing lane configuration.
- Blueprint customer-step selection uses its existing lane mapping.
- Shared node decorators receive the actual projected node type.

Internal renderer roles such as `kind: "step"` may remain: they identify a rendering role, not an authorable language token.

Audit the complete path, including journey render models and decorators, blueprint action/spine selection, scenario lane selection, and legacy text emitters. Updating only `include_node_types` is insufficient.

Preserve existing layout strategies, ordering, ownership, routing, and detail policies. Fix newly exposed sizing issues through shared measurement infrastructure.

### 3.4 Cross-view references

Add bundle-configured relationship-reference annotations using the shared semantic reader and existing projection reference structures.

| Visible node | Relationship context | Display label |
|---|---|---|
| JourneyStep or BlueprintStep | Correspondence, regardless of authored direction | Maps to |
| JourneyStep or BlueprintStep | Outgoing refinement | Refined by |
| ScenarioStep | Incoming refinement | Refines |

Display policy:

- Include references in projection independently of render detail.
- Hide the new reference groups in compact output.
- Show them in detailed output.
- Show target name and ID; sort targets deterministically by ID.
- Coalesce reciprocal correspondence references.
- Preserve existing Opportunity-reference behavior and ordering.
- Keep referenced nodes outside the primary view.
- Use the semantic reader for new-relationship omission accounting so authored mapping direction does not change semantic output.

Put labels, relationship selection, and display switches in the bundle. Reuse shared node attributes and measurement for rendering; do not build view-specific badge geometry.

Carry the reference data through the shared render models into supported staged and legacy outputs. Preserve existing v0.1 outputs.

### 3.5 Authoring and editor integration

Update guided-addition coverage for the new types and legal endpoint triples across all views. Foreign-view Step relationships remain explicit bridge/reference choices.

Both authored directions of `MAPS_TO` must remain available. An existing reverse declaration must not trigger a reciprocal-duplicate warning or an automatic reverse-edge insertion.

Verify helper contract discovery, forms, ID suggestions, dry-run authoring, validation, projection, and preview against the selected bundle.

Regenerate the editor grammar from the selected v0.2 bundle. Retain independent v0.1 grammar-generation tests. Do not introduce a merged, multi-version grammar in this feature.

## 4. Implementation sequence and gates

### Step 0 — Verify the checkout and record the baseline

Read the current instructions and inspect existing changes. Confirm the selected bundle reaches parsing, validation, authoring, projection, and rendering without being replaced downstream.

Inventory Step-dependent bundle fields and runtime checks. Classify runtime occurrences as semantic selection, renderer-role terminology, diagnostics, or historical compatibility material.

Record the existing realization/profile rules and example classification before editing. Use explicit bundle selection for verification.

**Gate:** discrepancies with this plan are identified; no unresolved authority conflict remains.

### Step 1 — Extend generic contract support

Implement the relationship semantic descriptor, loader validation, and shared semantic relationship reader. Add focused tests using temporary bundle data.

Establish generic view-role resolution for the affected Step-dependent paths using existing bundle information. Preserve v0.1 behavior without modifying its bundle or adding hidden `Step` fallbacks.

**Gate:** symmetry is controlled by bundle data; directed behavior and raw graph preservation remain intact.

### Step 2 — Define the v0.2 language

Add the three types and two relationships. Apply the endpoint matrix, transferred profile rules, prefixes, forms, view filters, lane mappings, and reference-annotation configuration.

Update guided relationship coverage, instrumentation target lists, and related schema constraints. Remove v0.2 authorable `Step`.

Use temporary valid fixtures for focused tests; inherited examples will be migrated in Step 5.

**Gate:** the bundle loads; parsing and validation enforce the intended vocabulary and endpoints; changing bundle data changes behavior.

### Step 3 — Complete projection, rendering, and authoring consumers

Replace Step-specific semantic checks with resolved roles. Thread actual types and reference attributes through render models and scene builders.

Exercise the existing authoring/helper interfaces and generated highlighting. Do not add feature-specific semantics to adapters.

**Gate:** all three views select the correct Step type, references work in either mapping direction, and v0.1 compatibility tests pass.

### Step 4 — Prove one mixed example

Create `step_differentiation.sdd` as the focused v0.2 proof case, containing:

- Two JourneySteps, two BlueprintSteps, and three ScenarioSteps.
- A Stage containing the JourneySteps.
- Separate same-type `PRECEDES` sequences.
- Explicit direct realizations and inherited required properties.
- A JourneyStep mapping to two BlueprintSteps.
- A BlueprintStep mapping to two JourneySteps.
- One pair declared reciprocally.
- Different refinement sets for mapped parents, sharing one ScenarioStep.
- Metric instrumentation targeting all three Step types.

The relationships must demonstrate that correspondence does not imply equal refinements or inherited realization.

Test forward-only, reverse-only, and reciprocal variants for equivalent correspondence annotations and rendered results while retaining their different raw declarations.

Render the journey, blueprint, and scenario views in compact and detailed modes. Inspect actual SVG/PNG output for correct type identity, missing or leaked nodes, duplicate references, clipping, and routing degradation.

**Gate:** semantic assertions and visual inspection pass. Do not update snapshots to normalize a failing proof case.

### Step 5 — Establish the v0.2 canonical corpus

Migrate the inherited v0.2 examples using the locked classification and ID rules. Retain existing content wherever it remains valid.

Update the manifest’s intended example/view pairs and add all three projections of the mixed proof case. Remove only obsolete v0.2 snapshot entries.

Validate every canonical under simple, permissive, and strict profiles. Then capture compiled/projection snapshots and generate the versioned rendered corpus.

The published corpus generator defaults to v0.1 and replaces its selected output directory. Invoke it with an explicit v0.2 manifest and inspect the destination before generation. Preserve unrelated local work.

**Gate:** v0.2 canonicals demonstrate the feature; v0.1 examples, snapshots, and rendered artifacts remain unchanged.

### Step 6 — Make restrained documentation updates

Add one focused v0.2 definition explaining the new types, correspondence, refinement, and migration.

Update only documentation that would otherwise become incorrect or prevent discovery/use of the feature:

- The v0.2 definitions index.
- Canonical-example inventories and generated corpus index.
- Current node/edge references and executable v0.2 examples.
- Relevant authoring guidance where it explicitly assumes `Step`.

Retain historical v0.1 documentation and valid generic uses of the word “step.” Do not restructure pages, rewrite introductions, or replace unrelated examples.

**Gate:** documentation matches the bundle, and every manually edited documentation passage has a specific feature-related reason.

### Step 7 — Run final verification and report evidence

Run the complete test suite once after focused checks pass. Build the documentation site if its pages or generated highlighting changed.

Report:

- Governing bundle fields and consuming runtime entrypoints.
- Semantic, integration, visual, and compatibility checks performed.
- Migrated examples and generated artifacts.
- Any unresolved invariant or limitation.

Do not report completion while a core invariant remains violated.

## 5. Acceptance tests and completion criteria

### Language and validation

- v0.2 accepts the three exact type names and rejects `Step` and `BluePrintStep`.
- v0.1 continues accepting its original vocabulary and rejecting unsupported additions.
- All legal new endpoint pairs pass; illegal type combinations fail.
- Cross-subtype `PRECEDES`, reverse refinement, self-mapping, and same-type mapping fail.
- Existing properties, realization obligations, decision rules, and profile severities remain equivalent after type substitution.
- Mapping/refinement cannot satisfy missing direct realization.
- Metrics can target every new Step type.

### Correspondence and refinement

- Either mapping direction works independently.
- Reciprocal mappings cause no warning and count once semantically.
- Exact repeated directed declarations retain existing duplicate diagnostics.
- Many-to-many mapping and shared refinement targets work.
- No transitive mappings, inherited refinements, implicit containment, or inferred sequence appears.
- Raw declarations survive compilation unchanged.

### Bundle-authority proofs

Use coherent temporary bundle mutations, loaded through the real runtime:

- Rename a Step type and update its bundle references: parser, authoring, projection, rendering, and decorators follow the new token.
- Change a prefix: suggestions and validation follow the bundle.
- Remove an endpoint pair: validation and guided authoring follow the changed legality.
- Change correspondence directionality: semantic lookup follows the new contract.
- Change annotation labels/detail settings: rendering follows those settings.

A test passing only because production code recognizes the shipped identifiers is a failure.

### Projection, rendering, and workflows

- Each view contains only its own Step subtype in its primary structure.
- Incoming and outgoing references use the configured labels without importing counterpart nodes.
- Compact/detailed behavior is independent of validation profile.
- The mixed proof is readable and deterministic in SVG and PNG.
- Existing v0.1 staged and legacy acceptance evidence remains valid.
- A selected-v0.2 helper/guided-authoring lifecycle can create, inspect, validate, project, and preview the differentiated content.
- Canonical validation and corpus checks cover both versions explicitly.

Use `TMPDIR=/tmp` for verification. Relevant implementation-time commands include:

```bash
TMPDIR=/tmp pnpm run build
TMPDIR=/tmp pnpm exec vitest run <focused-test-files>
TMPDIR=/tmp pnpm run generate:textmate --bundle bundle/v0.2/manifest.yaml
TMPDIR=/tmp node dist/examples/generateRenderedExamples.js bundle/v0.2/manifest.yaml
TMPDIR=/tmp pnpm test
TMPDIR=/tmp pnpm run docs:build
```

Run generation only after its preceding acceptance gates. The corpus command retains the existing Graphviz requirement for legacy artifacts; do not change rendering backends to bypass it.

Completion requires bundle-owned behavior, generic runtime consumption, passing mutation proofs, accepted canonical diagrams, preserved v0.1 compatibility, and narrowly scoped documentation changes.
