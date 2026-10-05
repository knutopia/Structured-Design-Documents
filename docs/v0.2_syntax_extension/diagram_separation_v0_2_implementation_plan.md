# Diagram Separation for SDD v0.2

## 1. Purpose, authority, and implementation discipline

Allow several named diagrams of the same type to coexist in one document, sharing semantic nodes and edges where appropriate. Preserve the existing combined, whole-document diagram for each type. Implement the capability through the v0.2 bundle, shared projection infrastructure, renderers, CLI, and helper APIs.

This is an implementation plan, not evidence that the feature exists. Repository inspection and user decisions were recorded on October 3, 2026. Complete the gates in order. Do not simplify the contract to accommodate an incomplete implementation, and do not substitute snapshot agreement for acceptance.

### 1.1 Sources and their roles

| Source | Role |
| --- | --- |
| User decisions in this planning conversation | Establish the feature, compatibility behavior, scope, and exclusions recorded below. |
| [v0.2 manifest](../../bundle/v0.2/manifest.yaml) and its referenced bundle artifacts | Current normative machine contract; this implementation must extend it before relying on new behavior. |
| [AGENTS.md](../../AGENTS.md) | Architectural guardrails: bundle authority, projection boundary, deterministic rendering, and acceptance before snapshots. |
| [Step differentiation definition](../../definitions/v0.2/step_differentiation.md) | Explains the existing JourneyStep, BlueprintStep, and ScenarioStep distinction. Diagram separation must preserve it. |
| Existing staged and LEGACY renderer fixtures | Compatibility and visual evidence; not language authority. |
| The four temporary scenario-flow planning files supplied by the user | Visual and conceptual exemplars of three named flows plus one combined view. They are unstable and must never become test, build, or generation dependencies. |

The temporary files are `tmp_scenario_flows_steps_only.sdd`, `tmp_scenario_flows_add_relationship.sdd`, `tmp_scenario_flows_create_new_view.sdd`, and `tmp_scenario_flows_node_pivot.sdd`, under the scenario-flow variant planning directory. Their comments and contents are reference material, not implementation instructions. Do not repair, migrate, import, or regenerate them as part of this feature.

### 1.2 Non-negotiable acceptance invariants

| ID | Invariant |
| --- | --- |
| I1 | **Combined views remain combined.** Selecting a view type ignores membership for selection and includes all content selected by that view's existing rules, including untagged content. |
| I2 | **Named diagrams select exact edges.** Two included endpoints never authorize importing another edge between them. |
| I3 | **Endpoint inclusion is additive.** Named membership is explicitly assigned edges, their endpoints, and explicitly assigned nodes. No reachability or structural closure is inferred. |
| I4 | **One authored membership representation.** The `diagrams` property is authoritative. Inventories and inclusion explanations are derived; no second inventory is stored on Diagram nodes. |
| I5 | **Shared meaning stays shared.** Membership does not clone identities, override properties, change semantic edge identity, or remove document-wide semantic obligations. |
| I6 | **References do not expand topology.** Only bundle-declared supporting annotations may resolve outside the selected content. Their targets and relationships are not automatically rendered as members. |
| I7 | **Bundle governs behavior.** Tokens, property names, reference-list rules, type eligibility, identity exclusions, and display conventions are loaded data, not identifier-specific TypeScript defaults. |
| I8 | **Projection owns semantic selection.** Layout, routing, wrapping, measurement, and SVG remain downstream in `projection -> RendererScene -> MeasuredScene -> PositionedScene -> SVG -> PNG`. |
| I9 | **Selection survives every public path.** Core APIs, helper projection/preview, CLI, text renderers, and preview backends must use the same resolved selection. |
| I10 | **Artifacts cannot collide.** Named outputs carry their Diagram ID in resource/artifact identity; existing combined output names remain unchanged. |
| I11 | **Compatibility is preserved.** Keep v0.1 semantics and existing unannotated v0.2 rendering. Preserve LEGACY output behavior for existing inputs. |
| I12 | **Evidence follows acceptance.** Establish exact semantic expectations, inspect the proof render, and pass compatibility checks before refreshing snapshots or generating wider corpus evidence. |

After every gate, record which invariants are satisfied, violated, or not yet tested. A gate with an unresolved required invariant is not passed.

## 2. Decisions and precise feature behavior

### 2.1 User-selected decisions

- Membership uses a `diagrams` property on nodes and edges, containing validated Diagram references.
- Support all six current diagram types. Use scenario flow as the first proof, then verify the other five through the same architecture.
- Structural context is explicit. There is no automatic inclusion of Stages, ancestors, siblings, children, or connecting containment edges.
- Implement core APIs, CLI, and helper creation/editing/discovery/projection/preview support. Do not add a guided named-diagram workflow or automatic assignment during guided addition.
- Preserve document-wide semantic validation. Diagram selection changes presentation scope, not the underlying semantic context.
- Keep the default combined per-type views alongside named diagrams. The combined view is not the union of named diagrams and needs no authored Diagram declaration.
- Do not use the unstable planning examples as test fixtures.

The remaining details below are design defaults fixed by this plan. They are not claims that the user separately selected every API name or diagnostic policy.

### 2.2 Diagram declarations

Add `Diagram` to the v0.2 vocabulary and compiled schema. A declaration has the ordinary stable node ID and nonempty name, and a required `diagram_type` property referencing an enabled view ID in the loaded bundle. Suggest prefix `DG` through authoring metadata; retain the existing ID syntax and allocation policy.

Description is optional. Do not transfer Step-specific actor, intent, realization, or other domain obligations onto the metadata node.

Use the existing view IDs: `outcome_opportunity_map`, `journey_map`, `service_blueprint`, `ia_place_map`, `scenario_flow`, and `ui_contracts`. Runtime code must discover these from the bundle instead of introducing another six-item list.

- Permit any number of diagrams of the same type, including identical display names. IDs distinguish them.
- Diagram nodes are metadata. Exclude them from ordinary rendered content, semantic endpoint offerings, and visible-node applicability counts.
- Add no semantic relationship with Diagram as an endpoint. Membership is not a graph edge.
- Diagram nodes cannot themselves have `diagrams` membership. Diagram nesting, inheritance, per-diagram semantic overrides, root inventories, and entry-point semantics are out of scope.
- Physical source nesting remains source organization only; it supplies neither membership nor containment. Do not introduce a new nesting shorthand.
- Reuse the existing renderer root container. It remains a renderer structure, not an authored semantic root or an inventory owner.
- The Diagram name is the display title in discovery and result metadata. Carry it into the named SVG's accessible title through shared renderer metadata; do not add a visible title band or change combined diagram geometry in this feature.

### 2.3 Membership representation

Use the existing property syntax. A node property assigns that node; an edge property on an edge line assigns that particular edge declaration. A single ID may be bare or quoted. Multiple IDs use one quoted, comma-separated string. For example, the property value represented by `diagrams="DG-001,DG-002"` assigns both diagrams. This is proposed v0.2 notation, not a claim about current support.

Contract details:

1. Trim whitespace around references. Membership is an unordered set; reference order has no display or layout meaning.
2. Each reference must match the loaded ID syntax, resolve to a Diagram declaration, and be compatible with the assigned content.
3. Repeated IDs within one list produce a warning and are resolved once. Preserve the authored value in raw compilation; generated/edited values use unique IDs sorted ascending.
4. An absent property means no explicit membership. An empty value, empty list element, malformed ID, missing target, or wrong target type is an error. Remove the property to clear membership.
5. More than one membership property on the same node or edge is an error before graph assembly collapses property keys. Repeated `diagram_type` on a Diagram is also an error. Do not change duplicate handling for unrelated existing properties.
6. Forward references are legal. Resolve membership after the complete document is available.
7. Do not introduce `USED_BY` as an alias, modifier, or relationship.

Compilation stays literal: preserve declarations and property values, including membership metadata. Compute normalized membership in a separate reader/index. Do not materialize synthetic membership edges, implied memberships, or inventories into the compiled graph.

### 2.4 Selection algorithm and eligibility

For named Diagram D, first resolve its view V and validate its assignments. Let E(D) be the exact edge declarations whose resolved membership contains D. Let N(D) be explicitly assigned nodes union both endpoints of E(D).

Return exactly E(D) and N(D) as the primary semantic selection. Reuse V's existing annotation, group, and presentation logic subject to the restrictions below.

- An explicitly assigned node must be eligible under V's primary node-type selection.
- An assigned edge must satisfy the existing global endpoint contract, V's included relationship types, and V's node eligibility for both endpoints. A globally legal but incompatible assignment is an error; do not silently filter it out.
- Check every listed Diagram independently. A node or edge can belong to different diagram types when it is eligible for each.
- Node membership never limits endpoint inclusion. A node assigned explicitly to D1 still appears in D2 if a D2 edge uses it.
- Node membership never assigns incident edges. Structural grouping requires the appropriate assigned structural edge.
- No component discovery, traversal from starts, induced-subgraph completion, inheritance, or membership propagation is allowed.
- All grouping, branch labels, hierarchy, local fallback conditions, and source-order filtering must use selected structural content. Excluded edges may not influence those results.
- Membership does not override compact/detailed presentation policy. An eligible isolated node remains in raw projection even when an existing detail policy hides it in rendering. Report that through the existing presentation diagnostics/notes.

For a combined view, run the existing whole-document view selection with Diagram metadata excluded from content. Ignore `diagrams` when deciding which nodes and edges to select. Existing detail policy and global validation still apply. “Ignore membership” does not mean accepting malformed reserved metadata during validation.

### 2.5 Supporting references and omissions

Keep the full document available for explicit reference lookup. Existing bundle-configured Opportunity references, `MAPS_TO`, `REFINED_BY`, event-name resolution, and view-specific supporting annotations may describe selected nodes without importing their targets into primary structure.

- Resolve only existing, bundle-declared reference/annotation categories; do not add a catch-all traversal of incident edges.
- Preserve the current semantic directionality and reciprocal-coalescing rules.
- A supporting reference to a shared node may appear in several diagrams because that node has shared meaning. This is intentional annotation behavior.
- An edge that is only an external reference for a view is not a legal primary membership assignment to that view. Authors leave that reference global; the view's declared annotation policy controls it.
- Visible structural connections such as scenario `REALIZED_BY` still require explicit edge membership.
- Do not emit a warning or omission for every unrelated, unselected edge. Omission reporting covers the selected diagram's presentation and the existing configured reference behavior.
- Discovery supplies inclusion reasons for inventory inspection: explicit node assignment, endpoint of an assigned edge, or both. Do not write these reasons into authored source.

### 2.6 Validation, duplicates, and empty diagrams

Retain existing global semantic rules, applicability, and severities. Do not validate only a filtered graph. In particular, a shared node's branches can require its global decision marker even when a named subset contains only one branch. Containment and direct-realization obligations are not relaxed by separation.

| Condition | Required behavior |
| --- | --- |
| Unknown/missing Diagram type; unresolved/wrong-type reference; incompatible node/edge assignment; malformed/empty membership | Error in every profile. Include affected source location and IDs where available. |
| Duplicate reserved property occurrence in source | Source-aware compile error before information is lost. |
| Repeated ID inside one membership list | Warning; effective membership is deduplicated. |
| Exact semantic duplicate edge declarations differing only in membership | Preserve the existing duplicate-edge warning severity. Keep raw declarations; do not silently merge them or combine their memberships. |
| Empty Diagram declaration | Legal draft; discoverable, with zero counts. Validation emits a warning; raw projection can return an empty projection. |
| Single-diagram render with no visible content after detail policy | Return a clear no-visible-content diagnostic and no artifact; the command fails rather than falling back to the combined view. |
| Named batch contains empty/non-visible diagrams | Skip those with recorded warnings; render the remaining valid diagrams. Report failure if no artifact is produced or any diagram has an error. |

An invalid selector, invalid membership, or unresolved source-edge reference must never cause fallback to an aggregate view. `--force` does not authorize an invented or ambiguously selected graph.

## 3. Architecture and bundle ownership

### 3.1 Required contract changes

Use an optional `diagram_membership` section in the existing contracts artifact, plus per-view enablement and the existing vocabulary/schema/authoring artifacts. Do not create a parallel configuration file or version switch in runtime code.

| Bundle location | Contract to encode | Runtime consumption |
| --- | --- | --- |
| `bundle/v0.2/core/vocab.yaml`, `core/schema.json` | Diagram token and metadata role; ordinary ID/name/property representation | `loadBundle(...)`, `createParserSyntaxRuntime(bundle)`, compilation/schema validation |
| `core/contracts.yaml`: new `diagram_membership` descriptor | Declaration type; type property; membership property; reference delimiter/trimming/set semantics; duplicate-field and invalid-reference policies; explicit selection and endpoint inclusion; no closure; metadata-only status; diagnostic policies | Source-property checks, shared membership resolver, `validateGraph(...)`, projection selection, helper contract resolution |
| `core/contracts.yaml`: common duplicate-identity contract | Generic exclusion of declared nonsemantic edge properties; resolve the membership key from the descriptor rather than embedding it in consumers | One shared identity implementation used by validation, semantic relationship lookup, rendering identity, and authoring duplicate checks |
| `core/views.yaml`: `projection.named_diagrams.enabled` for all current views | Which views accept named instances; eligibility reuses existing node/edge selectors; supporting-reference policy reuses the existing view declarations | Resolver, projection builders, discovery, forms and authoring choices |
| `core/projection_schema.json` | Optional named-diagram identity/title and exact source-edge references; required source references on named primary edges and their edge annotations | Projection schema validation and serialized projection consumers |
| `core/authoring.yaml` and profiles | DG prefix; Diagram form; bundle-resolved diagram-type choices; membership fields and validation rule activation | Authoring catalog, resolved helper contracts, ID suggestions and profile checks |
| `core/syntax.yaml` | Existing property and edge-property grammar remains authoritative | Existing syntax runtime; no new statement grammar is required |

Extend `Bundle` contract types and `validateLoadedBundle(...)` with these fields before using them. Validate all referenced tokens, property roles, view references, enum values, and identity-exclusion bindings. Fail on inconsistent descriptors. An absent descriptor preserves old-bundle behavior; named operations report unsupported capability. Do not infer support from a version string or from recognizing the literal word Diagram.

If the existing bundle-reference mechanism cannot express a required lookup, extend that generic mechanism. For example, deriving IDs from the loaded view registry must not become a hidden enum in a validator or form.

Keep the existing fingerprint path: the contracts, views, schema, and authoring artifacts already participate in bundle fingerprints. Verify that all new fields affect the fingerprint and stale authoring contexts are rejected normally.

### 3.2 Shared membership and selection service

Introduce one shared document-diagram resolver below projection. It accepts a compiled graph and loaded bundle, builds a normalized membership index, validates assignments, enumerates declarations, and resolves either a combined view or a named Diagram.

Keep three responsibilities explicit:

1. **Source occurrence checks:** inspect parsed properties before `buildGraph` overwrites duplicate keys. Consume reserved-field multiplicity from the bundle; do not add ad hoc parser recognition of Diagram or diagrams.
2. **Document membership resolution:** resolve declaration IDs, view types, normalized reference sets, exact member edges, and derived inventories. No layout or rendering dependencies.
3. **Projection orchestration:** construct one context containing the selected nodes/edges and a separately named full-document reference lookup. Existing view projectors consume that context rather than independently filtering or reconstructing it.

Refactor `createProjectionBuilderContext(...)` and projector entrypoints so the resolved selection is supplied once. Preserve the existing `projectView` behavior for old callers. The global graph is available for validation and authorized reference lookup; selected structural content is the only source of visible topology.

Do not pass a truncated graph to global validation, and do not hand unrestricted graph traversal to code that constructs named topology. Preserve source ordering, source spans, and original edge associations through projection and renderer preparation.

### 3.3 Semantic identity versus exact edge occurrence

These are different contracts and both are required:

- **Semantic identity** follows the bundle's existing identity fields and relationship semantics, excluding only bundle-declared nonsemantic metadata such as membership. Event, guard, effect, and meaningful properties remain significant. Preserve `to_name`'s existing exclusion from semantic identity.
- **Source occurrence identity** identifies one concrete compiled edge declaration for projection, annotation, and rendering. It must distinguish separate guards and duplicate declarations without inventing authored edge IDs.

Add an opaque `source_edge_id` reference to named projection edges and edge-derived annotations. Build a shared index using a hash of the canonical directed declaration-identity key, excluding membership, plus an occurrence ordinal for repeated keys in canonical compiled-edge order. Maintain the exact association to the original compiled edge. These references are scoped to the supplied compiled graph/revision and are not durable authoring handles.

Use directed declaration identity for this index even when a semantic relationship is symmetric. Semantic coalescing must not destroy the declaration associations needed for selection. Resolve references against the same compiled graph; a mismatched or missing reference is an error, never a triple-based fallback.

Emit these new source references for named projections. Keep them optional and absent in existing combined projection serialization so old snapshots and APIs retain their shape. Existing combined render IDs and ordering remain compatible; use the shared membership-independent identity policy wherever a renderer currently hashes properties.

For named paths, carry occurrence identity through all label maps, model-edge IDs, and scene-edge IDs. Do not key a named branch label only by endpoints, find the first compiled edge with a matching triple, or consume a queue constructed from all graph edges. Multiple selected occurrences must not overwrite one another.

Known audit targets in this checkout include the scenario projection's scan of `graph.edges`, scenario label maps, journey compiled-edge queues/identity hashing, UI Contracts compiled-edge matching, and model IDs built only from endpoint triples. Inspect all six models and both LEGACY text paths; fixing one projector is insufficient.

Do not broaden this work into a redesign of existing parallel-edge layout. The mandatory new behavior is exact identity, labels, and membership, including separate guarded edges selected into separate diagrams. Any renderer limitation when several parallel occurrences are selected together must be explicit, must not silently substitute an occurrence, and must not be hidden by a golden refresh.

Where an existing backend cannot represent the selected parallel occurrences without loss, return an error diagnostic and no artifact for that target. Test that failure instead of collapsing the edges. This does not excuse failure of the mandatory separate-diagram guarded-edge proof, and must not remove parallel-occurrence support that an existing backend already provides.

### 3.4 Renderer integration

Renderers must not parse `diagrams`, discover Diagram declarations, or reimplement membership selection. They consume the resolved projection, exact compiled-edge associations, and authorized node/reference metadata.

Preserve the staged pipeline and current rendering capability registry. SVG remains primary; PNG rasterizes the resulting SVG. Do not introduce ELK, a second layout pipeline, or a graph-rewriting shortcut.

Resolve scoped conditions, hierarchy, branch labels, lane grouping, and source order from selected content. In particular, an unrelated ViewState elsewhere in the document must not suppress a named UI Contracts State fallback; an excluded Stage relationship must not group a selected JourneyStep.

Both LEGACY DOT/Mermaid and Graphviz preview consume the same semantic selection. Preserve their existing outputs for old inputs. Do not widen the selected graph to make a LEGACY backend work.

## 4. Public interfaces, tooling, and compatibility

### 4.1 Core and helper interfaces

- Preserve existing signatures as valid calls. Extend `projectView(graph, bundle, viewId, options?)` and `projectSource(input, bundle, viewId, options?)` with optional `diagramId` in options; when supplied, it must resolve to that view type.
- Export `projectDiagram(graph, bundle, diagramId)` and `projectDiagramSource(input, bundle, diagramId)` convenience entrypoints, and `listDiagrams(graph, bundle)`. They delegate to the same resolver and projection path; they are not additional implementations.
- Add optional `diagramId` to existing resolved text/preview render options, which continue to carry the resolved `viewId`. CLI/helper entrypoints can accept a Diagram alone and resolve its view before invoking those options.
- Named projections carry top-level `diagram_id` and `diagram_name` in addition to `view_id`. Combined projections omit them. Mirror these optional fields in successful helper projection/preview resources and relevant render results.
- Extend helper `project_document` and `render_preview` inputs with `diagram_id`. Require at least one of `view_id` or `diagram_id`; infer the former when omitted. When both are supplied, reject disagreement. Return structured diagnostics through the existing helper error envelope if target resolution fails; do not fabricate a view ID.
- Add helper `list_diagrams` and `sdd-helper diagrams <document_path>`. Return document revision, ID, name, view ID, resolved node/edge counts, and diagnostics, sorted by Diagram ID. Counts describe semantic membership before render detail. Invalid declarations remain discoverable with diagnostics and no fabricated counts.
- Provide an optional details mode on discovery that includes member IDs, exact edge references, and node inclusion reasons. The ordinary listing remains compact. Include ordinary document/version/bundle context through existing resource conventions.
- Keep validation document-wide. Keep old `projection_views` change-set evaluation working; add `projection_diagrams` for named post-change projection requests and identify named entries in results.
- Update exported types, request/response schemas, helper discovery, contract subjects/bindings/continuations, and error assessment together. A command that works but is absent from the discoverable contract is incomplete.

There is an existing naming collision: guided-addition state uses `browse_filters.*.diagram_id` to mean a **view type**. Preserve that field's meaning and existing serialized workflow compatibility. Do not repurpose it for a named Diagram ID. This feature does not add named-diagram pickers or automatic membership assignment to guided addition.

### 4.2 Editing through the helper

Create Diagram declarations and node memberships through existing node operations and bundle-resolved forms. Edge insertion already supports properties. Add generic `set_edge_property` and `remove_edge_property` operations for editing an existing edge in place, addressed by its current revision-scoped edge handle.

The set operation follows existing property value conventions: edge handle, key, value kind, and raw value. Preserve endpoints, relation, event, guard, effect, target-name hint, source position, and comments. Do not remove/reinsert an edge or replace a document merely to update membership.

Extend mutation validation, summaries, contract metadata, and undo for these operations. Preserve stale-revision rejection and atomic change sets. Test membership edits with comma-containing quoted values and with unrelated semantic properties on the same edge. Deleting a Diagram must not silently clear references; a caller can clear assignments and delete it atomically. Dangling references are reported through normal validation.

Membership fields and available Diagram types must come from loaded metadata. Do not hardcode them in helper request validation or introduce a new guided workflow. Existing guided type filtering and unannotated authoring behavior must remain unchanged.

### 4.3 CLI selectors and outputs

| Invocation intent | Required behavior |
| --- | --- |
| `sdd show <input> --view scenario_flow` | Existing combined scenario flow, regardless of named declarations. |
| `sdd show <input> --view all` | Existing combined outputs for applicable view types; do not silently add named outputs. |
| `sdd show <input> --diagram DG-001` | Render that named diagram; infer its type. |
| `sdd show <input> --diagram all` | Render declared named diagrams only, in ID order, with per-diagram outcomes. |
| `sdd diagrams <input>` | List declared named diagrams; expose structured JSON and optional membership details. |
| Helper project/preview or internal text render with `--diagram <id>` | Use the same named selection and inferred type. |

For single targets, permit both view and Diagram only as a consistency assertion and reject mismatches. Reject combinations involving `all` and another selector. Missing selectors and unknown IDs fail clearly; never select the first declaration automatically. Internal text rendering and helper project/preview remain single-target; named batching belongs to `show` in this iteration.

Compile and validate the full document before batch rendering, following existing global error handling. Invalid membership anywhere in the document blocks rendering rather than producing a misleading partial success. Once the document passes validation, a target-specific backend failure may coexist with successful artifacts for other targets, but the batch result records each outcome and exits unsuccessfully.

Preserve current combined artifact basenames. For named output, insert a safely encoded `diagram-<ID>` component after the view and before detail/decorator/backend components. Example shape: `<source>.<view>.diagram-<ID>.<detail>[.decorators-<mode>][.<backend>].<format>`.

For a single target, an explicit `--out` remains the requested path. For named batches, insert both resolved view and Diagram ID before the requested extension. Never use display names as unique identifiers or write several diagrams to the same path. Keep existing batch incompatibilities such as single-intermediate `--dot-out` explicit.

Resource URIs and any cache/materialization keys include named identity plus the existing document revision, bundle, view, detail, backend, and format context. Renaming a Diagram changes its displayed title but not its ID-based file naming. Independent named outputs must never reuse the combined projection or artifact by mistake.

### 4.4 Compatibility boundaries

- Do not edit the v0.1 bundle, examples, snapshots, or render corpus. Absence of the membership descriptor means no new membership semantics. Existing arbitrary v0.1 properties retain their existing treatment.
- Existing v0.2 documents need no Diagram declarations and keep their current behavior.
- For a valid document, adding only Diagram declarations and memberships must not change combined topology, labels, geometry, or semantic identity. Metadata can appear in compiled output and discovery because it was authored.
- Do not migrate the user's temporary v0.1 planning documents. Stable v0.2 proof content uses ScenarioStep rather than Step.
- Do not add root/start requirements, new semantic endpoint pairs, alternate-world semantics, runtime renderer flags keyed on Diagram tokens, or implicit cleanup/migration behavior.

## 5. Implementation gates and required evidence

Do not run later artifact-generation gates while an earlier correctness gate is failing. The implementer may perform ordinary independent reads and preparation, but must not normalize failed output by updating expectations.

### Gate 0 — Establish baseline and proof expectations

**Work**

1. Read current repository instructions and recheck the named bundle/runtime paths against this plan.
2. Record working-tree state; protect unrelated changes. Record baseline build and relevant semantic/projection/renderer/helper checks. Attribute existing failures rather than assuming a clean baseline.
3. Define the acceptance assertions before implementation. Create an independent, stable v0.2 proof source for scenario separation, not a runtime copy/import of the planning files. Keep its future annotated form outside canonical generation until vocabulary support exists; use the unannotated control for baseline rendering.
4. Use three named diagrams and one derived combined output. The base content has 11 ScenarioSteps and 9 active PRECEDES edges: Add relationship has 5 nodes/4 edges; Node pivot has 4 nodes/3 edges; Create new view has 3 nodes/2 edges. The first two share one node. No edge is shared in this base case.
5. Keep an unannotated control with the same content and author order. Use the simple profile for this minimal visual proof; exercise stricter semantic obligations in dedicated tests rather than weakening them to fit the fixture.

**Acceptance**

- An explicit expected node/edge inventory exists for all four outputs, independent of snapshots.
- The baseline combined graph renders acceptably using the current renderer.
- Tests/generation do not read any temporary planning file.
- Baseline failures and applicable invariants are recorded. A known relevant failure blocks subsequent claims until resolved or its scope is explicitly established.

### Gate 1 — Extend and validate the bundle contract

**Work**

1. Add the metadata node and membership descriptor, view enablement, schema support, profile rules, and authoring metadata described above.
2. Extend bundle types/load-time consistency checks and generic bundle-reference resolution where needed.
3. Add focused positive/negative loader tests and mutation proofs for load-time consistency, parser token discovery, and authoring metadata. Specify the later resolver/projection/render mutation assertions now, but require them at the gates that implement those consumers.
4. Confirm ordinary property grammar is sufficient; keep parsing on `loadBundle -> createParserSyntaxRuntime -> parseSource`.

**Acceptance**

- The shipped v0.2 bundle loads with coherent metadata; old bundles still load without the descriptor.
- Invalid descriptor references fail at bundle load with useful diagnostics.
- Coherently renaming the Diagram token, membership key, type-property key, or prefix in a temporary bundle changes loaded metadata, parser token recognition where applicable, and the corresponding available authoring descriptors. Resolver and selection proofs are required at Gates 2-5, not falsely reported as passed here.
- No production token list, string branch, or renderer switch substitutes for loaded conventions.
- No snapshots or rendered goldens are refreshed.

### Gate 2 — Implement source checks, membership resolution, and identity

**Work**

1. Reject repeated reserved fields while source occurrences still exist; preserve unrelated property behavior.
2. Build the normalized document membership index with forward references, derived inventory, eligibility, and source-associated diagnostics.
3. Centralize property-aware semantic identity and make validation, semantic readers, authoring duplicate checks, and renderer identity consumers use it.
4. Build exact source-edge occurrence references and validate their associations independently of rendering.
5. Keep raw declarations and global semantic validation intact.

**Acceptance**

- Every condition in section 2.6 has a focused test, including source duplicates versus duplicate IDs within one list.
- Membership changes alone do not change semantic identity or satisfy an existing semantic obligation.
- An edge shared through one list is one declaration; duplicate declarations remain literal and retain the duplicate warning.
- Event/guard/effect/meaningful-property differences remain distinguishable.
- Normalization is deterministic, preserves raw compiled values, and does not mutate the compiled graph.

### Gate 3 — Prove projection isolation on the scenario case

**Work**

1. Resolve selection once and pass it through the shared projection context.
2. Implement named and combined public paths, schema validation, diagram metadata, exact edge references, and controlled full-document annotation lookup.
3. Fix annotation generation to use selected edge occurrences rather than endpoint membership alone.
4. Add property-based or explicit metamorphic checks for changes to excluded content; do not rely only on expected snapshots.

**Acceptance**

- The four base inventories exactly match Gate 0. The shared node appears once in each named output; each output contains only its assigned outgoing edge.
- Adding an untagged edge between already included endpoints affects only the combined structural projection.
- Add dedicated cases for a shared edge, isolated node, disconnected members, and a cycle. Membership requires no root; existing cycle diagnostics still apply.
- Two differently guarded edges with the same endpoints assigned to different diagrams yield the correct edge and annotation in each, including when compiled ordering differs from source ordering.
- Adding unrelated nodes, unselected structural edges, or another Diagram does not alter the selected structural nodes, edges, groups, or labels. Deliberate changes to allowed shared-reference annotations are not isolation failures.
- Graph/source convenience APIs agree; empty and invalid selections never fall back to combined content.
- No raw projection depends on render detail or validation profile.

### Gate 4 — Accept the first rendered proof

**Work**

1. Route named projections through existing scenario render models, preparation, staged SVG, and SVG-derived PNG.
2. Fix exact-occurrence label and scene-ID plumbing in shared paths before adding view-specific workarounds.
3. Render the three named outputs and the combined output in compact and detailed modes; inspect actual artifacts.
4. Exercise LEGACY DOT/Mermaid and Graphviz preview using the same selection.

**Acceptance**

- Named outputs show the intended independent flows with the right shared-node branch, no leaked edges/labels, no duplicate node, and no clipped labels or new routing degradation.
- The combined output remains visually equivalent to the unannotated control, including disconnected content.
- Guarded-edge selection is correct through rendered text and SVG, not only in raw projection.
- Repeated runs are deterministic with the repository's fonts and LF text conventions.
- Named titles/IDs are carried correctly without adding Diagram nodes to the drawing.
- The proof is explicitly judged acceptable before progressing. Do not broaden from a failing proof or tune layout speculatively to mask wrong topology.

### Gate 5 — Verify all remaining views through the shared contract

**Work**

Add small independent fixtures for each remaining view. Reuse the resolver and occurrence reader; do not create a second membership algorithm per renderer.

| View | Mandatory proof |
| --- | --- |
| Journey map | Shared JourneyStep; distinct assigned Stage/CONTAINS context; no sibling or ancestor expansion; Opportunity/refinement annotations remain references. |
| Service blueprint | Only assigned realization/dependency/data/policy edges; lane groups contain selected members; unselected Process relationships do not leak. |
| IA place map | Explicit hierarchy and navigation; including parent and child alone does not create containment; excluded sibling edges do not reorder or expand membership. |
| Outcome-opportunity map | Selected intent structure plus existing configured external implementation/instrumentation annotations, without promoting targets to primary members. |
| UI contracts | Selected ownership/composition/containment; exact guarded transition occurrence; State fallback determined by selected primary content; unrelated ViewStates do not change it. |

**Acceptance**

- Every view passes raw selection, compact/detailed presentation, named SVG/PNG, and supported LEGACY selection checks.
- All primary memberships are independent of reference-only targets.
- One legal edge/node can be assigned to different compatible types; incompatible assignments fail.
- Combined outputs and v0.1 compatibility evidence remain valid.
- There is no view-local interpretation of the membership property.

### Gate 6 — Complete CLI, helper, and artifact integration

**Work**

1. Add named selection and discovery to core exports, helper contracts, CLI, and evaluation results.
2. Implement generic in-place edge-property edits and undo; support declaration and node membership editing through existing operations.
3. Add naming/resource identity and deterministic named batching.
4. Keep guided type-filter semantics and versioned workflow state intact.

**Acceptance**

- A helper lifecycle can create a Diagram, assign node/edge membership, inspect/list it, validate the full document, project and preview it, edit membership, and undo the edit.
- An edge-membership edit preserves its other fields and comments; stale revisions and invalid assignments are rejected through existing structured mechanisms.
- Core, CLI, and helper agree on selected nodes/edges and resolved view/Diagram identity.
- Contract discovery accurately describes every new field, command, mutation, and error condition.
- Existing combined commands and filenames are unchanged. Named and combined artifacts coexist; duplicate titles cannot collide.
- `--view all` and `--diagram all` enumerate their distinct documented sets. Empty, unknown, conflicting, and unsupported selections have tested outcomes.
- Invalid memberships never produce a falsely successful combined preview, including through force paths.

### Gate 7 — Record documentation and accepted evidence

**Work**

1. Add a v0.2 diagram-separation definition and documentation-site authoring/CLI guidance. Explain combined versus named views, explicit grouping, global validation, and reference annotations with a small example.
2. Update helper usage/contract documentation and only relevant repository-owned skill guidance; do not change an installed user-global skill.
3. Add the accepted stable scenario proof to v0.2 canonical examples and register combined/named projection evidence. Existing manifest snapshot paths can remain strings; snapshot readers must honor the expected projection's optional `diagram_id` rather than always invoking combined projection.
4. Teach corpus generation to produce distinct named artifacts alongside existing combined artifacts for applicable examples, using shared target discovery. Never derive language semantics from filenames or goldens.
5. Generate highlighting from the selected bundle if adding the token affects shipped grammar. Update only related generated assets.

**Acceptance**

- Definitions and docs match the bundle and public behavior; no documentation claims inferred starts, implicit grouping, or diagram-local semantic validation.
- New golden/snapshot content records previously passed inventories and accepted renders.
- Old v0.1 files remain unchanged. Any changed existing v0.2 artifact has an explicit, reviewed feature-related reason; aggregate regressions are not acceptable reasons.
- Stable fixtures are self-contained and do not depend on the planning exemplars.

### Gate 8 — Final verification and closeout

Run focused checks as each gate changes behavior. Once they pass, run the complete suite once; repeat only for new edits, failures, or unresolved concerns. Use Node commands from the repository root and `TMPDIR=/tmp`.

Relevant commands, executed at their appropriate gate:

- `TMPDIR=/tmp pnpm run build`
- `TMPDIR=/tmp pnpm exec vitest run <focused-test-files>`
- `TMPDIR=/tmp pnpm test`
- `TMPDIR=/tmp pnpm run docs:build`
- `TMPDIR=/tmp pnpm run generate:textmate --bundle bundle/v0.2/manifest.yaml` when recording approved highlighting changes
- `TMPDIR=/tmp node dist/examples/generateRenderedExamples.js bundle/v0.2/manifest.yaml` only after visual and semantic gates pass
- `pnpm run check:graphviz` and `dot -V` when exercising the current LEGACY Graphviz path
- `git diff --check` and a narrow audit of preserved v0.1 artifacts and unrelated working-tree changes

Do not install or adopt another layout engine to get through verification. If Graphviz is unavailable, report the affected LEGACY checks as unverified; do not claim those gates passed.

**Required closeout evidence**

Create a companion implementation report recording:

1. Each invariant I1-I12 and each gate, its status, and the evidence that supports it.
2. Governing bundle fields and the generic runtime paths that consume them.
3. Bundle-mutation proofs, exact-inventory proofs, guarded-edge identity proofs, workflow checks, and compatibility results.
4. Paths to inspected scenario and cross-view SVG/PNG artifacts, plus the explicit visual acceptance judgment.
5. Focused and final test results, baseline failures, generated evidence, and any remaining limitation.

Do not report completion if only tests pass while selection, visual output, bundle authority, a required public path, or compatibility remains wrong.

## 6. Additional adversarial checks and stop conditions

### 6.1 Bundle-authority tests

Load coherent temporary bundles through the real loader and prove:

- Renaming Diagram, `diagram_type`, or `diagrams` changes parsing/resolution/forms/selection; old spellings have no hidden special behavior.
- Changing the reference delimiter changes membership interpretation, including helper serialization of lists.
- Disabling named support for a view rejects assignments to that view while its combined rendering remains available.
- Changing primary node/edge eligibility changes membership validation and selection without editing production code.
- Changing the configured metadata identity exclusion changes duplicate/semantic identity behavior; meaningful properties are still included.
- Changing the DG prefix changes suggestions and configured prefix validation.
- Changing a supported reference annotation label/detail rule affects annotations without expanding primary topology.
- Coherently removing the membership descriptor and its dependent enablement/bindings yields explicit unsupported named operations rather than hardcoded v0.2 behavior. Removing it while leaving inconsistent dependent fields must fail bundle validation instead.

Temporary bundle mutation tests may change fixtures coherently. They must not rewrite the shipped bundle, broaden expectations to fit a failure, or rely on a second literal convention list inside test setup to establish production behavior.

### 6.2 Practical implementation traps

- **Filtering nodes only:** imports unassigned edges between shared endpoints. Assert exact selected edge declarations.
- **Filtering the entire graph once:** loses valid global reference labels and accidentally changes validation scope. Separate selected structure from controlled document reference lookup.
- **Keeping full graph scans in render models:** reintroduces grouping, labels, fallback decisions, or ordering from another diagram. Audit every structural consumer.
- **Using only endpoint triples:** selects the wrong guard/label or overwrites parallel occurrences. Preserve exact source-edge references.
- **Hashing all props:** changes identity when membership changes. Use the shared bundle-driven exclusion policy.
- **Assuming repeated properties accumulate:** current graph assembly collapses them. Reject reserved duplicates before collapse.
- **Treating global warnings as diagram-local errors to fix:** would change semantic meaning. Preserve the chosen global validation contract.
- **Treating visible nodes as the inventory:** render detail may hide some members. Discovery reports semantic membership; presentation reports visibility separately.
- **Using existing guided `diagram_id` fields for named IDs:** breaks established type-filter semantics. Keep these domains distinct.
- **Adding per-diagram renderer implementations:** duplicates policy and violates the shared projection boundary. Fix the shared input/identity layer.
- **Refreshing all artifacts early:** can normalize leakage or regressions. Record evidence only after the required gates pass.

Stop and surface the specific failed invariant when the bundle cannot express the behavior, exact source association is ambiguous, the proof topology is wrong, required parallel-occurrence handling silently loses information, or a golden refresh would hide a regression. Extend the shared contract or architecture before continuing. Do not compensate with source rewriting, renderer-specific membership exceptions, altered validation severity, speculative routing changes, or edits to the user's temporary planning files.
