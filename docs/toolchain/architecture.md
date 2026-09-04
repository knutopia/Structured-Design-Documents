# Toolchain Architecture

## Goal

The v0.1 toolchain provides one shared TypeScript engine with four public thin CLI commands:

- `sdd add`
- `sdd compile`
- `sdd validate`
- `sdd show`

The bundle in `bundle/v0.1/` is the source of truth for language behavior. The engine implements generic interpreters for:

- syntax loading and parsing
- graph compilation and canonicalization
- rule execution
- view projection builders
- text rendering for renderable views

The engine does not hardcode v0.1 domain semantics beyond the generic primitives needed to execute the bundle.

## Pipeline

The engine runs this pipeline:

1. `loadBundle`
2. `parseSource`
3. `compileSource`
4. `validateGraph`
5. `projectView`
6. `renderSource`

The staged renderer migration also introduces an internal-only renderer pipeline after projection for staged SVG work:

1. `RendererScene`
2. `MeasuredScene`
3. `PositionedScene`

Each stage has a narrow responsibility:

- `loadBundle` resolves the v0.1 manifest and loads vocab, syntax, schema, contracts, profiles, views, and the optional authoring artifact, then runs deterministic cross-artifact validation.
- `parseSource` interprets `syntax.yaml` and produces a source-spanned parse document.
- `compileSource` flattens authoring blocks into canonical graph JSON, preserves author-order metadata for renderers, and validates the graph against `core/schema.json`.
- `validateGraph` executes generic validation rules from contracts plus the selected profile.
- `projectView` resolves the requested bundle view through a shared projector registry and creates the exported normalized projection envelope for that view.
- `projectSource` provides the exported source-to-projection convenience API by compiling source and then projecting through the same `projectView` boundary.
- `renderSource` resolves renderable views through a renderer registry and turns their projections into internal DOT or Mermaid text artifacts.

## Internal Forms

Lean v0.1 still keeps the public-facing semantic spine small:

- a parse document with source spans
- a canonical compiled graph with non-serialized author-order metadata attached for renderer use
- an exported projection envelope used as the semantic boundary between graph compilation and rendering

The renderer migration now adds internal staged-renderer forms under `src/renderer/staged/`:

- `RendererScene`, which maps projection semantics onto renderer-owned primitives without coordinates
- `MeasuredScene`, which records intrinsic content sizing and wrapped text without global placement
- `PositionedScene`, which records absolute placement and routed connector geometry for backend painting

These scene forms are internal contracts only. They are not new CLI outputs, and they do not change bundle or projection contracts. Internal DOT/Mermaid artifact flows remain available, Graphviz-backed preview remains selectable where preserved, and migrated views now use staged preview backends through the CLI preview layer.

Step 3 turns `MeasuredScene` into a real micro-layout boundary rather than a placeholder copy:

- staged measurement now resolves a shared renderer theme before sizing
- text is measured from vendored Public Sans font assets with a pure Node service
- width-band selection, text wrapping, explicit clamping, and secondary-area fallback happen before any macro-layout
- measured nodes now carry wrapped lines, local content block frames, local port offsets, and explicit overflow outcomes
- container child measurement is recursive, but container bounds and container-port offsets remain deferred until the macro-layout step

The staged artifact backend sits on top of those contracts:

- `src/renderer/staged/svgBackend.ts` renders hand-authored `PositionedScene` fixtures to deterministic SVG with shared paint-group ordering, class hooks, embedded font CSS, and marker definitions
- staged PNG output is now a rasterization step derived from that SVG backend, not a separate scene renderer
- backend-aware preview routing selects staged backends for accepted migrated views while keeping legacy backends selectable where preserved

The staged macro-layout boundary owns renderer-managed placement and shared routed-edge behavior. No staged view delegates placement or routing to ELK:

- `src/renderer/staged/macroLayout.ts` owns the recursive renderer-managed strategies for `stack`, `grid`, `lanes`, and `layered`; the layered strategy ranks strongly connected components and then places ranks deterministically
- container chrome, padding, header bands, bounds, and container-port offsets are resolved during layout rather than left at placeholder values
- staged routing now resolves explicit ports, role-based port fallbacks, default box anchors, container-origin ports, deterministic orthogonal/stepped routes, target-biased bends where requested, minimum marker-leg clearance for arrow-ended routes when geometry allows, and segment-aware edge-label placement before SVG emission
- `src/renderer/staged/routingCore/` owns backend-neutral route geometry, physical-segment claims, deterministic track solving, bounded solve/validate/repair coordination, and final validation; view adapters retain semantic topology and routing policy

Ports in those staged scene contracts are semantic routing anchors, not normal painted output. The staged SVG backend keeps explicit `connector_port` primitives visible when a view intentionally uses them, but ordinary node and container ports are internal geometry only.

## View Extension Pattern

View support now follows one internal pattern instead of adding one-off IA branches:

- `src/projector/projectView.ts` is the single entry point for projection.
- `src/projector/viewProjectors.ts` maps bundle `view_id` values to per-view projection builders.
- each projection builder owns bundle-driven semantics such as derived annotations, omission policy, node grouping, and projection notes.
- `src/renderer/viewRenderers.ts` separately maps renderable views to render-model and emitter adapters.

This keeps the architecture boundary explicit:

- bundle semantics belong in projection builders and render-model builders
- emitters only format already-derived render data
- `prepareProjectionForRender(...)` remains a renderer-internal layer on top of the public projection contract
- preview generation remains a CLI concern layered on top of DOT-backed renderers

That separation matters most for the non-IA views:

- service blueprints derive lane membership in projection, then let the render model translate those derived lane groups into row-oriented internal DOT structures
- scenario flows derive decision-node shape and branch-label precedence in projection, then let the render model decide which rendered edges surface those labels
- ui contracts derive transition-graph priority in projection, then let the render model decide whether `ViewState` remains primary or scoped `State` groups become the effective primary fallback
- emitters stay intentionally dumb so bundle semantics do not get duplicated across output formats

All bundle-defined v0.1 views still retain internal DOT and Mermaid text artifacts for tests, corpus generation, and debugging. Public CLI preview support centers on `sdd show`. v0.1 still does not expose a public `sdd project` command, but projection itself is now a supported exported library contract through `projectView(...)` and `projectSource(...)`.

## Bundle Ownership

The bundle owns:

- tokens and lexical rules
- line classification and block structure
- node and relationship vocabularies
- validation rule selection and rule configuration
- view scope plus view-specific projection and rendering conventions
- guided node forms, node-ID suggestion inputs, relationship authoring semantics, supported edge fields, and placement-policy inputs
- the complete endpoint-triple guidance role and display matrix for every authoring-enabled view

The engine owns:

- file I/O
- source span tracking
- canonical ordering
- generic rule execution
- projector and renderer registries
- output formatting for diagnostics and internal DOT/Mermaid emitters

The CLI owns preview artifact generation on top of those internal text renderers and staged preview backends through a backend-aware preview layer.

### Guided authoring bundle substrate

The current v0.1 manifest declares `core/authoring.yaml`. The loaded `Bundle.authoring` field remains optional so older bundles continue to compile, validate, project, and render. Guided consumers must report `guided_addition.unsupported_bundle` when it is absent; they do not substitute TypeScript defaults.

The guided-authoring bundle substrate is split by ownership:

- `authoring.yaml` owns node-ID sequence inputs, the canonical node-type prefix map, primary/advanced form prominence, authoring hints, the default display profile, relationship-field labels, duplicate-relationship warning templates, and source-placement policy.
- `contracts.yaml` retains endpoint triples as semantic authority and adds relationship graph role, source representation, source organization, and one explicit `edge_field_support` rule per relationship.
- profile rules retain validation severity but may resolve fields through generic `bundle_refs`. Strict and permissive prefix coupling both resolve `authoring#node_id_suggestions.prefix_by_type`; inline values remain supported only for older bundles, and a rule cannot declare both forms.
- `views.yaml` contains one `conventions.guided_addition` record for every allowed endpoint triple in every view. Each record owns its `primary`, `supporting`, or `bridge` role and explicit `simple`/`strict` display rules. `permissive` aliases `strict` in bundle data.

`validateLoadedBundle(...)` rejects unresolved bundle references, incomplete vocabulary/form/prefix/relationship/view coverage, duplicate or unknown endpoint triples, missing edge-field rules or labels, invalid warning templates or placeholders, invalid property references, unknown display predicates, invalid aliases, and display rule lists without a final unconditional rule. Diagnostics use the `bundle` stage and are sorted before being attached to `BundleValidationError`.

Generic, read-only accessors expose allowed endpoint triples, node-ID suggestion inputs, relationship authoring semantics, supported edge fields, field labels, warning presentation, placement inputs, view relationship records, and resolved conditional display. Downstream guided-domain code consumes these accessors instead of rereading YAML shapes or supplying relationship/view/profile fallbacks.

### Guided bundle fingerprint and catalog

`computeBundleFingerprint(...)` returns `bnd_` plus SHA-256 over recursively key-sorted canonical JSON. The fingerprint input contains the loaded manifest, vocabulary, syntax, core schema, projection schema, contracts, views, profiles represented in manifest order, and optional authoring configuration. Object-key order is insignificant, array order remains significant, and environment values such as `rootDir` and `manifestPath` are excluded.

`createGuidanceCatalog(...)` consumes the generic bundle accessors and produces one deeply frozen catalog. It indexes node types, endpoint triples, relationship/endpoint order, view/profile records, conditional display rules, syntax/schema constraints, profile rules, edge-field support/requiredness and display labels, and placement inputs. Private `Map` indexes accelerate lookup but are not serialized. The catalog contains no environment paths and no mutable reference back into the loaded bundle.

### Guided document snapshot

`createGuidedDocumentSnapshot(...)` is a pure source-text adapter. It reuses `inspectDocumentText(...)` for revision-bound handles, parentage, and body/source order, then reuses `compileSource(...)` to verify literal graph semantics. It does not run a validation profile, so governance completeness does not restrict choice browsing.

The public snapshot contains only document identity, revision, bundle fingerprint, effective version, source-ordered node/edge records, top-level/body order, and parse/compile warnings. Lookup indexes by handle, ID, type, direction, parent, and used ID remain private in a `WeakMap` and never serialize into caller-carried state. Incoming edges remain literal; the snapshot builder never infers an inverse.

Parse failures, duplicate IDs, schema failures, or other compile errors raise `GuidedAdditionV1DomainError` with code `guided_addition.document_unavailable`, the underlying sorted diagnostics, and an `authoring`-stage boundary diagnostic. A bundle without authoring guidance raises `guided_addition.unsupported_bundle`. The machine-readable shared diagnostic schema includes the `authoring` stage.

`createGuidedDocumentSnapshotFromWorkspace(...)` is the read-only file adapter. It normalizes the requested document through `AuthoringWorkspace`, reads it once, and assigns the same normalized repo-relative value to both `document_ref` and `path`.

### Pure guided addition domain

`createGuidedAdditionRuntimeV1(bundle)` constructs an immutable guidance catalog and retains only that catalog. Its `begin(snapshot, request)` and `advance(snapshot, state, action)` entry points are pure: the caller carries serializable v1 state, and the runtime performs no file access, workspace writes, mutation translation, journaling, helper invocation, or CLI work. Requests, state, and proposals use workflow/proposal version `1.0`.

Every advance rechecks document identity, revision, bundle fingerprint, exact existing-node identities, diagram filters, saved field values, endpoints, semantic organization, and accepted material effects against freshly recomputed offers. Expected rejection raises `GuidedAdditionV1DomainError` with sorted `authoring` diagnostics and the unchanged caller state. A state cannot bypass a page, form, or confirmation by carrying an unavailable or edited action.

The workflow supports standalone-node addition plus relationship addition with or without a preselected anchor. Anchored relationship work preserves four distinct routes: outgoing or incoming direction crossed with relationship-first or existing-node-first selection order. Each selected relationship or node constrains the next page through literal bundle-valid endpoint triples; incoming edges keep their literal direction, and no inverse is inferred.

Diagram filtering is a contextual workflow action, not a caller-supplied initial view. Applicable browse pages expose human-readable select, change, and clear choices. Selecting a diagram recomputes the same browse identity, orders regular relationships before understandable cross-diagram bridges, and clears unavailable downstream selections. The default display profile comes from `authoring.yaml`; profile completeness validation is not part of browsing.

The runtime returns display-ready choice pages, confirmations, forms, selected-value text, and proposal reviews. Choices carry the exact typed actions that clients return; clients do not translate labels back into semantics. Node forms combine authoring descriptors with syntax/schema constraints and profile-owned property formats. Relationship forms consume the selected relationship's field support, required-property rules, and bundle-owned labels. Optional empty values are omitted; prefix mismatch is advisory, while invalid, duplicate, or missing required content blocks progress.

Node organization is semantic and contextual. New nodes may be top-level or nested, existing nodes may remain or move, wrapper replacement is explicit, and sibling order appears only when meaningful. An existing node moves only after its exact material effect is accepted. Guided pages and proposals contain no relationship-line placement recommendation; placement-free relationship mutations delegate that source organization to the loaded bundle policy.

Completed proposals contain canonical nodes and relationships, semantic node organization, accepted material effects, and guidance context. They contain no source text, low-level authoring operations, or guided edge placement. Opaque deterministic identities bind state, actions, effects, and proposals to the document revision and bundle fingerprint; clients render the supplied human content rather than those identities.

### Guided addition proposal execution

`applyAdditionProposalV1(workspace, bundle, args)` is the only guided write-side adapter. It consumes `CompletedAdditionProposalV1` directly, requires a file-backed normalized path, verifies revision and bundle fingerprint, rebuilds the snapshot/catalog, and revalidates proposal identity, exact node references, endpoint triples, fields, route intent, semantic organization, and material effects. Expected stale or invalid proposals return a rejected `sdd-addition-proposal-result`; they do not invoke mutation execution.

Accepted semantic organization translates privately into shared node insertion and subtree-preserving movement operations. Relationship operations omit low-level placement so the shared mutation engine applies `edge_in_source_body`; explicit low-level placement remains available only to other mutation callers. Proposal-local nodes and relationships receive temporary handles and deterministic `node_1`/`edge_1` result mappings. The executor emits no SDD source and performs no direct persistence.

The low-level `reparent_node_block` operation moves an intact node model between top-level and body streams or between different body parents. It preserves the complete subtree, body content, owned comments, blank lines, and trailing comments while rebasing indentation and top-level/nested header form. It rejects stale handles/revisions, same-parent use, self/descendant cycles, missing destination parents, and relative anchors outside the destination stream. Its discriminated ordering summary records `old_parent_handle`, `new_parent_handle`, `old_index`, and `new_index`. Confirmation remains a guided proposal-executor concern; the low-level operation is confirmation-agnostic.

Dry-run computes the exact candidate revision and diagnostics. If warnings exist, the executor returns display-ready warning lines plus an opaque acceptance token bound to the proposal ID, normalized path, base and resulting revisions, bundle fingerprint, and sorted warning set. On commit, the shared generic pre-write guard rejects missing, altered, cross-proposal, or stale warning consent before persistence. Duplicate-relationship wording comes from required bundle templates, including the relationship-specific `NAVIGATES_TO` message.

The existing `sdd-helper apply` request contract still recognizes `reparent_node_block` as a surgical low-level operation. Guided Addition v1 remains a separate library boundary and adds no guided helper or MCP command.

### Interactive guided addition CLI

`sdd add <document_path> [--node <node_id>] [--bundle <manifest>]` is the human presentation adapter over Guided Addition v1. It discovers the repository root, normalizes the document path, loads the bundle, and creates one snapshot from either the existing source or a bundle-derived new-document bootstrap. A new snapshot carries `document_precondition: "must_not_exist"` through caller-carried state and the completed proposal. Existing snapshots omit that field and remain revision-bound as before. The CLI also resolves an optional exact starting-node anchor. Without `--node`, an existing document offers standalone-node or relationship addition and the starting-node browser. A new document begins directly at standalone node-type selection and automatically treats its first node as the only top-level node. Diagram selection, change, and clearing happen inside applicable guided browse pages; `sdd add` has no `--view` option.

The CLI generically renders API-supplied titles, lines, prompts, choices, descriptions, chosen-value text, confirmations, forms, proposal reviews, and warnings. It returns the exact action attached to a choice and sends the completed proposal unchanged to the executor. It does not inspect bundle contracts or views, build semantic choices, translate proposals, construct SDD source, or invoke low-level mutations.

The client owns one ordinary `Save` or `Cancel` decision. Cancel performs no proposal verification and no write, including when the target does not yet exist. Save dry-runs the unchanged proposal with the bundle-defined default display profile. For new documents the dry run uses the bundle-derived bootstrap only in memory; commit uses exclusive creation, creates missing parent directories, records delete-on-undo metadata, and rejects a target that appeared after review without overwriting it. Warning-free verification commits immediately. A concrete warning offers `Save anyway` or `Go back`; `Save anyway` passes the dry-run token with the same proposal, while `Go back` returns to the unchanged review. Stale commits fail without writing and require restarting the command.

Production prompting uses `readline/promises` behind an injected prompt interface. Planner, snapshot, workspace, proposal-executor, and prompt dependencies are injected through the CLI dependency surface so deterministic tests can verify transcripts, Save/Cancel call counts, and proposal identity without moving semantics into terminal code.

### Guided domain contract metadata

The shared contract index exposes three library-visible `domain_service` subjects after the unchanged helper subjects:

- `domain.service.guided_addition.begin`
- `domain.service.guided_addition.advance`
- `domain.service.addition_proposal.apply`

Their JSON Schema 2020-12 descriptors cover the guided snapshot, public begin request, caller-carried state, action/result unions, completed proposal, apply arguments/result, and complete begin/advance call envelopes. The metadata describes the existing TypeScript domain API; it does not create a transport, helper command, MCP tool, or alternate executor.

The shared contract index retains `contract_version: "0.1"`; that value versions the overall helper/domain metadata index and is independent of Guided Addition's `workflow_version: "1.0"` and `proposal_version: "1.0"`. Static detail contains only bundle references. Bundle-resolved detail expands diagram IDs, display-profile IDs, node types, relationship types, validation profiles, and projection views in bundle order. It does not duplicate endpoint triples, visibility rules, forms, warnings, or source-placement policy as static metadata.

Constraint metadata records workflow version, same-revision and same-bundle requirements, currently offered actions, canonical proposal identity, literal endpoint consistency, exact material-effect acceptance, and bound warning consent. Continuations record caller-carried state, completed-proposal handoff, and reuse of the exact proposal plus warning token from dry-run to commit. These entries remain descriptive contracts over existing runtime enforcement paths.

`sdd-helper capabilities` remains byte-compatible and lists only helper commands. `sdd-helper contract` accepts only `helper.command.*` subjects and rejects domain subjects before bundle loading, so library metadata cannot become an accidental helper adapter. A future helper or MCP exposure requires a separate implementation plan.

The engine also owns the internal staged-renderer contracts and snapshot-tested staged pipeline that migrated SVG work builds on, while keeping `renderSource` separate from backend-aware CLI preview selection.

Within that staged pipeline, renderer-owned measurement infrastructure is now shared rather than view-specific:

- `src/renderer/staged/sceneBuilders.ts` owns reusable root-container, card-node, and port-builder helpers for the migrated staged views
- `src/renderer/staged/theme.ts` owns staged theme resolution and measurement-affecting tokens
- `src/renderer/staged/primitives.ts` owns shared primitive flow rules and primitive-content validation
- `src/renderer/staged/textMeasurement.ts` owns deterministic font-backed width measurement
- `src/renderer/staged/microLayout.ts` owns intrinsic node sizing and edge-label wrapping
- `src/renderer/staged/macroLayout.ts` owns recursive manual container layout, container bounds, container ports, and simple staged routing
- `src/renderer/staged/svgBackend.ts` owns deterministic SVG emission from `PositionedScene`
- `src/renderer/svgArtifacts.ts` owns shared embedded-font and SVG-to-PNG helpers used by both staged and legacy preview paths

This keeps text sizing and width policy out of future view scene builders.
Measured-scene diagnostics are now reserved for actual degraded output or fallback behavior; expected container-port deferral remains internal until macro-layout resolves final container bounds.

Preview backends now split by view:

- `staged_ia_place_map_preview` is the default preview backend for `ia_place_map`; it owns staged projection-to-scene rendering, staged SVG emission, and staged PNG derivation from that SVG
- `staged_ui_contracts_preview` is the default preview backend for `ui_contracts`; it owns the routed and balanced staged projection-to-scene rendering, staged SVG emission, and staged PNG derivation from that SVG
- `staged_service_blueprint_preview` is the default selected preview backend for `service_blueprint`; it owns the renderer-derived middle layer, deterministic lane/column placement, custom staged routing, staged SVG emission, and staged PNG derivation from that SVG while explicit `legacy_graphviz_preview` remains available in parallel
- `staged_scenario_flow_preview` is the default selected preview backend for `scenario_flow`; it owns the accepted custom staged lane-and-routing SVG emission and staged PNG derivation from that SVG while explicit `legacy_graphviz_preview` remains available in parallel
- `staged_outcome_opportunity_map_preview` is the default selected preview backend for `outcome_opportunity_map`; it owns the staged semantic-lane scene, custom opportunity routing, staged SVG emission, and staged PNG derivation from that SVG while explicit `legacy_graphviz_preview` remains available in parallel
- `staged_journey_map_preview` is the default selected preview backend for `journey_map`; it owns source-ordered Stage/Step placement, dedicated orthogonal `PRECEDES` routing, deterministic crossing-continuity marks, staged SVG emission, and staged PNG derivation from that exact SVG
- `legacy_graphviz_preview` remains explicitly selectable for all six renderable views; it owns:

- Graphviz-driven DOT-to-SVG layout
- shared preview-style resolution from `views.yaml`
- Public Sans webfont embedding for portable SVG output
- SVG-to-PNG rasterization with a vendored desktop Public Sans font for image export

Profiles are validation overlays, not language variants or rendering modes. The core bundle defines syntax and compiled graph shape; profiles decide how much completeness and governance to enforce on top of that. Projection scope stays setting-agnostic, while render-model builders use the independent bundle-declared `compact` or `detailed` policy. Use `simple` for light-touch validation, `permissive` for warning-first completeness, and `strict` for strict authoring. See [profiles.md](./profiles.md).

## Renderable Views

The current end-to-end renderable set keeps two output layers:

- supported preview artifacts: SVG/PNG via `sdd show`
- retained internal text artifacts: DOT/Mermaid for tests, corpus generation, and debugging

Current CLI preview-ready views are `ia_place_map`, `ui_contracts`, `service_blueprint`, `scenario_flow`, `outcome_opportunity_map`, and `journey_map`.

These views share one pattern:

- each renderable view gets its own render-model builder
- preview capability is modeled per artifact, with all six renderable views defaulting SVG and PNG previews to staged backends and retaining explicit `legacy_graphviz_preview` alternatives
- internal DOT/Mermaid text artifacts remain parallel emitters for tests, corpus generation, and debugging, not a layout-parity contract with Graphviz

The per-view render models keep semantics centralized:

- IA organizes source-ordered area and place hierarchies plus place annotations
- journey maps turn `Stage CONTAINS Step` into stage containers and retain structured Step references for shared-node attributes
- outcome-opportunity maps turn type scope plus derived instrumentation annotations into deterministic semantic lanes
- service blueprints turn derived lane groups plus typed relationship styling into preview-friendly operational rows
- scenario flows turn decision-node annotations plus derived branch labels into readable step/place/view-state slices
- ui contracts turn place containment plus grouped `scope_id` state detail into place-scoped contract clusters while keeping fallback-to-state behavior outside the DOT emitter and inside the staged scene builder
- every eligible semantic leaf in these staged views uses the shared node component; structural containers, headers, connector labels, annotations, and routing-only items remain on their existing container or generic-content paths
- inside the staged renderer, `ia_place_map` now uses manual hub/follower grouping and bottom-up owned-scope sizing: explicit containment creates owned child scope, forward local navigation may create same-scope follower scope, and local structure connectors use deterministic direct-vertical or shared-trunk routing without IA-specific ELK fallback
- inside the staged renderer, `ui_contracts` now reserves internal gutter space for container-origin support edges, assigns those edges to an invisible label lane inside that gutter, and keeps containerized `ViewState` scopes visually aligned with leaf `ViewState` nodes
- inside the staged renderer, `scenario_flow` now uses a custom lane-and-band layout with staged branch routing and debug corpus artifacts for pre-routing, edge-side selection, and gutter occupancy
- inside the staged renderer, `outcome_opportunity_map` now uses deterministic semantic lanes plus staged opportunity routing with debug corpus artifacts for pre-routing, endpoint/template selection, and final gutter occupancy
- inside the staged renderer, `journey_map` preserves source-ordered Stage/Step placement and first-parent ownership; its adapter retains route archetypes, directional corridors, reciprocal-pair topology, Stage gates, bounded expansion ownership, late endpoint ordering, crossing minimization, and continuity marks while shared routing infrastructure aggregates physical-segment claims and assigns legal tracks

Inside the staged renderer, `journey_map`, `outcome_opportunity_map`, `ui_contracts`, and `scenario_flow` keep renderer-stage goldens as internal contract coverage, and their accepted staged paths also serve their public staged preview backends.

Dense Journey Maps may remain crossing-rich even when hard geometry passes; residual perpendicular crossings receive deterministic continuity marks and `renderer.routing.journey_map_unavoidable_crossing` warnings. Coincident logical crossings on the same painted segment share one physical continuity mark. The shared solver enforces track separation and bounded capacity, while reducing residual perpendicular crossings further remains a candidate/topology concern owned by the Journey adapter.

Preview artifacts build on top of a backend-aware preview layer rather than expanding the engine render contract. In v0.1:

- `renderSource` still returns only internal DOT or Mermaid text artifacts
- `sdd show` resolves preview output through a backend registry; all six renderable views default to staged preview backends
- `sdd show --format png` continues to derive PNG from SVG in both backend paths, with the vendored Public Sans desktop font keeping PNG export independent of user-installed fonts
- staged SVG viewports remain transparent outside the rounded root container; the opaque root geometry owns the visible canvas and provides the backdrop beneath all text
- `sdd show --dot-out` remains an internal/debug option and automatically selects a DOT-capable preview backend when the chosen default backend does not expose DOT intermediates
- preview styling defaults are bundle-owned, with shared defaults at the `views.yaml` level, optional per-view overrides, and separate SVG and PNG font asset paths
- the staged renderer contracts and staged SVG backend still exist in parallel with internal text artifacts and legacy preview outputs; all six renderable views exercise staged preview paths through the normal preview workflow and committed corpus, and legacy Graphviz preview remains explicitly available in parallel

## Determinism

Deterministic output is treated as a feature, not a side effect.

The engine enforces:

- stable node ordering
- stable edge ordering
- stable diagnostic ordering
- stable projection ordering
- stable internal DOT and Mermaid text output
- stable source-ordered structural rendering for hierarchy views
- stable bundle-owned preview styling defaults
- stable staged theme resolution and font-backed measurement
- canonical `LF` newlines for repo-stored text artifacts

This makes snapshots useful and keeps diffs reviewable.

Stable diffs and source-ordered structural rendering are intentionally separate concerns:

- compiled JSON stays canonically sorted for snapshots and tooling diffs
- renderer-facing author order is attached out-of-band and does not change the compiled schema
- reordering top-level declarations or hierarchy-edge lines is treated as an intentional structural edit, not tool instability

Repository text normalization is part of deterministic behavior, not a contributor-specific preference.

- `.gitattributes` defines `LF` as the canonical newline policy for repo text files
- compiler snapshots, renderer goldens, docs, and spec artifacts should be stored as `LF`
- CLI text output should remain canonically `LF` regardless of contributor platform

## Validation Modes

Validation runs on compiled graphs only. Profiles change rule selection and severity, but they do not change parsing, compilation, or rendering contracts.

- `simple` keeps structural checks strict while omitting completeness rules that add repetition during early modeling
- `permissive` keeps broad governance feedback active, mostly as warnings
- `strict` enforces production-grade completeness and policy expectations

## Testing Strategy

The test suite uses the bundle examples as conformance fixtures.

- compile tests assert stable compiled JSON against bundle snapshots after newline normalization
- validation tests assert zero errors for current manifest examples under `strict`
- projection tests assert targeted view behavior and manifest-wide snapshot parity for every declared projection snapshot
- render tests assert stable internal DOT and Mermaid output against the committed corpus in `examples/rendered/v0.1/`, using suffixed view/example/detail folders such as `ui_contracts_diagram_type/place_viewstate_transition_example/detailed_detail/`
- staged-renderer tests snapshot `RendererScene`, `MeasuredScene`, and `PositionedScene` JSON plus deterministic staged SVG and diagnostic fixtures under `tests/goldens/renderer-stages/` while preserving explicit legacy outputs; accepted Journey Map evidence includes meaningful pre-routing, step-2, step-3, and final stages
- staged micro-layout tests cover wrapping, width-band escalation, clamping, secondary-area handling, and unknown-theme fallback
- corpus completeness tests assert every curated manifest-backed render pair has a committed source `.sdd` plus per-detail internal `.dot`/`.mmd` artifacts alongside `.svg` and `.png` preview artifacts
- negative fixtures cover syntax, compile, and validation failures

Fixture and golden reads should normalize `CRLF` to `LF` before raw string comparison so mixed contributor environments do not create false negatives. The newline policy still lives in `.gitattributes`; test normalization exists to make assertions platform-tolerant, not to permit committed `CRLF` artifacts.

## Extension Direction

Contributors should extend the bundle first whenever possible.

Add engine code only when one of these is true:

- the bundle introduces a new generic primitive that needs an interpreter
- the engine needs infrastructure for deterministic behavior or better diagnostics
- a new view needs a projection builder, render model, or renderer adapter that keeps semantics out of emitters
