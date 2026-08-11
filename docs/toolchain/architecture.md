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

The staged macro-layout boundary now owns both manual placement and the first shared routed edge behaviors:

- `src/renderer/staged/macroLayout.ts` owns the recursive strategy registry for `stack`, `grid`, `lanes`, and `elk_layered`
- container chrome, padding, header bands, bounds, and container-port offsets are resolved during layout rather than left at placeholder values
- staged routing now resolves explicit ports, role-based port fallbacks, default box anchors, container-origin ports, deterministic orthogonal/stepped routes, target-biased bends where requested, minimum marker-leg clearance for arrow-ended routes when geometry allows, and segment-aware edge-label placement before SVG emission
- `elk_layered` spacing now reserves room for owned edge labels so horizontal transition graphs can remain readable without view-specific SVG hacks

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

- `authoring.yaml` owns node-ID sequence inputs, the canonical node-type prefix map, primary/advanced form prominence, authoring hints, and default placement inputs.
- `contracts.yaml` retains endpoint triples as semantic authority and adds relationship graph role, source representation, source organization, and one explicit `edge_field_support` rule per relationship.
- profile rules retain validation severity but may resolve fields through generic `bundle_refs`. Strict and permissive prefix coupling both resolve `authoring#node_id_suggestions.prefix_by_type`; inline values remain supported only for older bundles, and a rule cannot declare both forms.
- `views.yaml` contains one `conventions.guided_addition` record for every allowed endpoint triple in every view. Each record owns its `primary`, `supporting`, or `bridge` role and explicit `simple`/`strict` display rules. `permissive` aliases `strict` in bundle data.

`validateLoadedBundle(...)` rejects unresolved bundle references, incomplete vocabulary/form/prefix/relationship/view coverage, duplicate or unknown endpoint triples, missing edge-field rules, invalid property references, unknown display predicates, invalid aliases, and display rule lists without a final unconditional rule. Diagnostics use the `bundle` stage and are sorted before being attached to `BundleValidationError`.

Generic, read-only accessors expose allowed endpoint triples, node-ID suggestion inputs, relationship authoring semantics, supported edge fields, placement inputs, view relationship records, and resolved conditional display. Downstream guided-domain code must consume these accessors instead of rereading YAML shapes or supplying relationship/view/profile fallbacks.

### Guided bundle fingerprint and catalog

`computeBundleFingerprint(...)` returns `bnd_` plus SHA-256 over recursively key-sorted canonical JSON. The fingerprint input contains the loaded manifest, vocabulary, syntax, core schema, projection schema, contracts, views, profiles represented in manifest order, and optional authoring configuration. Object-key order is insignificant, array order remains significant, and environment values such as `rootDir` and `manifestPath` are excluded.

`createGuidanceCatalog(...)` consumes the generic bundle accessors and produces one deeply frozen catalog. It indexes node types, endpoint triples, relationship/endpoint order, view/profile records, conditional display rules, syntax/schema constraints, profile rules, edge-field support/requiredness, and placement inputs. Private `Map` indexes accelerate lookup but are not serialized. The catalog contains no environment paths and no mutable reference back into the loaded bundle.

### Guided document snapshot

`createGuidedDocumentSnapshot(...)` is a pure source-text adapter. It reuses `inspectDocumentText(...)` for revision-bound handles, parentage, and body/source order, then reuses `compileSource(...)` to verify literal graph semantics. It does not run a validation profile, so governance completeness does not restrict choice browsing.

The public snapshot contains only document identity, revision, bundle fingerprint, effective version, source-ordered node/edge records, top-level/body order, and parse/compile warnings. Lookup indexes by handle, ID, type, direction, parent, and used ID remain private in a `WeakMap` and never serialize into caller-carried state. Incoming edges remain literal; the snapshot builder never infers an inverse.

Parse failures, duplicate IDs, schema failures, or other compile errors raise `GuidedAdditionDomainError` with code `guided_addition.document_unavailable`, the underlying sorted diagnostics, and an `authoring`-stage boundary diagnostic. A bundle without authoring guidance raises `guided_addition.unsupported_bundle`. The machine-readable shared diagnostic schema includes the new `authoring` stage.

`createGuidedDocumentSnapshotFromWorkspace(...)` is the read-only file adapter. It normalizes the requested document through `AuthoringWorkspace`, reads it once, and assigns the same normalized repo-relative value to both `document_ref` and `path`.

### Pure guided addition domain

`createGuidedAdditionRuntime(bundle)` constructs an immutable guidance catalog and retains only that catalog. Its `begin(snapshot, request)` and `advance(snapshot, state, action)` entry points are pure: the caller carries the serializable workflow state, and the runtime performs no file access, workspace writes, mutation translation, journaling, helper invocation, or CLI work.

Every advance rechecks the document reference, revision, bundle fingerprint, exact anchor, normalized filters, saved field values, endpoints, placements, and confirmations against freshly recomputed offers. Expected rejection raises `GuidedAdditionDomainError` with sorted `authoring` diagnostics and the unchanged caller state. A state cannot bypass a form or completion gate by carrying an unavailable or edited selection.

The workflow supports one standalone-node route and the four normalized anchored routes formed by outgoing/incoming direction and existing-only/existing-or-new endpoint strategy. Relationship choices remain indivisible endpoint triples. Existing endpoint options precede the create-new option, incoming edges keep their literal direction, and no inverse is inferred.

View filtering consumes the explicit view/triple matrix. It orders relationship choices by primary, supporting, then bridge role and retains bridge choices unless an explicit role filter removes them. Presence filters use the resolved ordered display rules for the selected profile and current snapshot node types. The default display profile is the first profile in bundle order; current v0.1 therefore selects `simple` without a planner-side profile fallback. Profile completeness validation is not part of browsing.

Node forms combine the catalog's authoring descriptors with syntax/schema ID and name constraints and profile-owned property formats. ID suggestions consume the configured prefix, sequence policy, and minimum width, including suffixed numeric IDs when finding the next value. Edge forms consume only the selected relationship's `edge_field_support` and `required_edge_property` metadata. Optional empty properties are omitted; prefix mismatch is advisory, while invalid, duplicate, or missing required content blocks progress.

Placement is a separate pure advisor. Relationship authoring roles and source organization select structural nesting, graph-sequence, same-source target ordering, or fallback precedence; authoring placement-policy fields supply the concrete modes. Recommendations expose a deterministic default and deduplicated bounded alternatives. Edge placement remains a separate recommendation in the literal source node's body.

A structural new-parent/existing-child default proposes an explicit `reparent_existing_node` effect. Its `eff_<sha256>` identity binds the bundle, revision, target, old/new parent, placement, and literal relationship. Choosing a non-reparenting alternative clears the effect. Proposal review remains blocked until the exact current effect is confirmed.

Completed proposals contain semantic nodes, literal edges, placement selections, and exact confirmations only. They contain no source text or authoring operations. Relationship proposals carry identical canonical `from`/`type`/`to` values in their relationship and edge records. Opaque deterministic identifiers use `relc_`, `ntc_`, `epc_`, `plc_`, `eff_`, and `addp_` prefixes; v1 reserves only `node_1` and `edge_1` as proposal-local IDs.

### Guided addition proposal execution

`applyAdditionProposal(workspace, bundle, args)` is the only guided write-side adapter. It requires a file-backed proposal path, normalizes that path through `AuthoringWorkspace`, verifies the current revision and recomputed bundle fingerprint, rebuilds the guided snapshot/catalog, and revalidates every existing/local reference, endpoint triple, node/edge field, view role, placement, canonical proposal ID, and exact confirmation. Expected stale or invalid proposals return a rejected `sdd-addition-proposal-result`; they do not throw or invoke mutation execution.

Accepted proposals translate deterministically in node, node-property, edge, then confirmed-reparent order. Proposal-local nodes and edges receive internal temporary handles so an inserted node can own an inserted edge and become the destination parent of an existing node in the same change set. The adapter invokes `executeChangeOperations(...)` once with origin `apply_addition_proposal`; it emits no SDD source and performs no direct persistence. Returned `created_targets` resolve proposal-local IDs to candidate handles, with committed handles serving as the persisted continuation surface.

The low-level `reparent_node_block` operation moves an intact node model between top-level and body streams or between different body parents. It preserves the complete subtree, body content, owned comments, blank lines, and trailing comments while rebasing indentation and top-level/nested header form. It rejects stale handles/revisions, same-parent use, self/descendant cycles, missing destination parents, and relative anchors outside the destination stream. Its discriminated ordering summary records `old_parent_handle`, `new_parent_handle`, `old_index`, and `new_index`. Confirmation remains a guided proposal-executor concern; the low-level operation is confirmation-agnostic.

The existing `sdd-helper apply` request contract recognizes `reparent_node_block` as a surgical low-level operation, and its machine-readable operation/summary schemas describe the new discriminants. This milestone adds no guided helper or MCP command.

### Interactive guided addition CLI

`sdd add <document_path> [--node <node_id>] [--view <view_id>] [--bundle <manifest>]` is the human presentation adapter over the pure guided domain. It discovers the repository root, normalizes the document to a repo-relative workspace path, loads the selected bundle and source once for the initial snapshot, resolves an optional anchor exactly, and lets the planner validate the optional bundle-defined view.

The CLI renders only planner-returned options and fields. Its friendly route labels map to the normalized outgoing/incoming and existing-only/existing-or-new operation values; relationship descriptions, role, presence, label visibility, bridge classification, form hints, ID suggestions, and placement recommendations come from planner results. Filter changes are submitted as `set_filter` actions. Primary node fields are shown first, while optional advanced node and edge fields require explicit disclosure. Required edge fields remain completion gates even when optional advanced fields stay hidden.

Reparent confirmation is caller-owned but planner-bound: the CLI displays the exact current effect and submits that exact effect with `confirmed: true`. Refusal offers the planner's alternative placement or Cancel, and the CLI stores no independent confirmation flag. It does not inspect bundle contracts/views/authoring records, construct SDD source, translate proposals into operations, or invoke the mutation engine directly.

Save first calls `applyAdditionProposal(...)` in `dry_run` mode with `validate_profile: simple`. This profile supplies validation feedback for the candidate; it is not used to restrict relationship browsing. Errors block commit. Warnings are displayed and require explicit acceptance. Final acceptance calls the executor again with the same completed proposal object in `commit` mode. Revision or bundle-fingerprint drift returns a stale rejection and requires restarting `sdd add`. Cancel and declined warning/commit prompts exit successfully without a commit call; successful commits exit 0 and domain/runtime failures exit 1.

Production prompting uses `readline/promises` behind an injected prompt interface. Planner, snapshot, workspace, proposal-executor, and prompt dependencies are injected through the CLI dependency surface so deterministic tests can verify transcripts, Save/Cancel call counts, and proposal identity without moving semantics into terminal code.

### Guided domain contract metadata

The shared contract index exposes three library-visible `domain_service` subjects after the unchanged helper subjects:

- `domain.service.guided_addition.begin`
- `domain.service.guided_addition.advance`
- `domain.service.addition_proposal.apply`

Their JSON Schema 2020-12 descriptors cover the guided snapshot, public begin request, caller-carried state, action/result unions, completed proposal, apply arguments/result, and complete begin/advance call envelopes. The metadata describes the existing TypeScript domain API; it does not create a transport, helper command, MCP tool, or alternate executor.

Static detail contains only bundle references. Bundle-resolved detail expands view IDs, display-profile IDs, node types, validation profiles, and projection views in bundle order. It never copies relationship endpoint triples, visibility rules, field inventories, prefixes, or placement policy into metadata. Opaque choice/effect/proposal IDs and proposal-local IDs are deliberately not bundle-value bindings.

Constraint metadata records same-revision and same-bundle-fingerprint requirements, currently offered opaque actions, exact confirmation, and proposal relationship/edge consistency. Continuations record caller-carried state, completed-proposal handoff to the apply service, and reuse of the exact proposal from dry-run to commit. These entries remain descriptive contracts over the existing runtime enforcement paths.

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
- `staged_service_blueprint_preview` is the default selected preview backend for `service_blueprint`; it owns the renderer-derived middle layer, ELK-authoritative staged SVG emission, and staged PNG derivation from that SVG while explicit `legacy_graphviz_preview` remains available in parallel
- `staged_scenario_flow_preview` is the default selected preview backend for `scenario_flow`; it owns the accepted custom staged lane-and-routing SVG emission and staged PNG derivation from that SVG while explicit `legacy_graphviz_preview` remains available in parallel
- `staged_outcome_opportunity_map_preview` is the default selected preview backend for `outcome_opportunity_map`; it owns the staged semantic-lane scene, custom opportunity routing, staged SVG emission, and staged PNG derivation from that SVG while explicit `legacy_graphviz_preview` remains available in parallel
- `staged_journey_map_preview` is the default selected preview backend for `journey_map`; it owns source-ordered Stage/Step placement, dedicated orthogonal `PRECEDES` routing, deterministic crossing-continuity marks, staged SVG emission, and staged PNG derivation from that exact SVG
- `legacy_graphviz_preview` remains explicitly selectable for all six renderable views; it owns:

- Graphviz-driven DOT-to-SVG layout
- shared preview-style resolution from `views.yaml`
- Public Sans webfont embedding for portable SVG output
- SVG-to-PNG rasterization with a vendored desktop Public Sans font for image export

Profiles are validation overlays, not language variants. The core bundle defines syntax and compiled graph shape; profiles decide how much completeness and governance to enforce on top of that. Projection scope stays profile-agnostic, while render-model builders may use profile-specific display policy to suppress optional overlays in `simple`, including hiding place route/access/entry-point fields while leaving existing `primary_nav` annotations intact. Use `simple` for low-noise drafts, `permissive` for warning-first completeness, and `strict` for strict authoring. See [profiles.md](./profiles.md).

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
- journey maps turn `Stage CONTAINS Step` into stage containers and inline `opportunity_refs` badges
- outcome-opportunity maps turn type scope plus derived instrumentation annotations into deterministic semantic lanes
- service blueprints turn derived lane groups plus typed relationship styling into preview-friendly operational rows
- scenario flows turn decision-node annotations plus derived branch labels into readable step/place/view-state slices
- ui contracts turn place containment plus grouped `scope_id` state detail into place-scoped contract clusters while keeping fallback-to-state behavior outside the DOT emitter and inside the staged scene builder
- inside the staged renderer, `ia_place_map` now uses manual hub/follower grouping and bottom-up owned-scope sizing: explicit containment creates owned child scope, forward local navigation may create same-scope follower scope, and local structure connectors use deterministic direct-vertical or shared-trunk routing without IA-specific ELK fallback
- inside the staged renderer, `ui_contracts` now reserves internal gutter space for container-origin support edges, assigns those edges to an invisible label lane inside that gutter, and keeps containerized `ViewState` scopes visually aligned with leaf `ViewState` nodes
- inside the staged renderer, `scenario_flow` now uses a custom lane-and-band layout with staged branch routing and debug corpus artifacts for pre-routing, edge-side selection, and gutter occupancy
- inside the staged renderer, `outcome_opportunity_map` now uses deterministic semantic lanes plus staged opportunity routing with debug corpus artifacts for pre-routing, endpoint/template selection, and final gutter occupancy
- inside the staged renderer, `journey_map` preserves source-ordered Stage/Step placement and first-parent ownership, then applies dedicated journey-only orthogonal routing, occupancy, bounded expansion, late endpoint ordering, and final crossing-continuity marks without an external routing engine

Inside the staged renderer, `journey_map`, `outcome_opportunity_map`, `ui_contracts`, and `scenario_flow` keep renderer-stage goldens as internal contract coverage, and their accepted staged paths also serve their public staged preview backends.

Dense Journey Maps may remain visually poor even when hard geometry passes; residual perpendicular crossings receive deterministic continuity marks and `renderer.routing.journey_map_unavoidable_crossing` warnings. A later shared-routing task must prefer a straight, single horizontal segment between unobstructed horizontally adjacent nodes. That is global staged-routing debt, not a journey-only patch.

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
- render tests assert stable internal DOT and Mermaid output against the committed corpus in `examples/rendered/v0.1/`, using suffixed view/example/profile folders such as `ui_contracts_diagram_type/place_viewstate_transition_example/permissive_profile/`
- staged-renderer tests snapshot `RendererScene`, `MeasuredScene`, and `PositionedScene` JSON plus deterministic staged SVG and diagnostic fixtures under `tests/goldens/renderer-stages/` while preserving explicit legacy outputs; accepted Journey Map evidence includes meaningful pre-routing, step-2, step-3, and final stages
- staged micro-layout tests cover wrapping, width-band escalation, clamping, secondary-area handling, and unknown-theme fallback
- corpus completeness tests assert every curated manifest-backed render pair has a committed source `.sdd` plus per-profile internal `.dot`/`.mmd` artifacts alongside `.svg` and `.png` preview artifacts
- negative fixtures cover syntax, compile, and validation failures

Fixture and golden reads should normalize `CRLF` to `LF` before raw string comparison so mixed contributor environments do not create false negatives. The newline policy still lives in `.gitattributes`; test normalization exists to make assertions platform-tolerant, not to permit committed `CRLF` artifacts.

## Extension Direction

Contributors should extend the bundle first whenever possible.

Add engine code only when one of these is true:

- the bundle introduces a new generic primitive that needs an interpreter
- the engine needs infrastructure for deterministic behavior or better diagnostics
- a new view needs a projection builder, render model, or renderer adapter that keeps semantics out of emitters
