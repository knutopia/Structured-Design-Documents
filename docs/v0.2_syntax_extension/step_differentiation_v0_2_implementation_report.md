# Step differentiation v0.2 implementation evidence

## Governing contract and runtime consumption

The [implementation plan](step_differentiation_v0_2_implementation_plan.md) fixes the language and migration decisions. The v0.2 bundle governs machine behavior; repository renderer constraints govern architecture. Existing v0.1 diagrams and renderer fixtures provide compatibility and visual comparison evidence.

| Governing fields | Consuming path |
| --- | --- |
| `core/vocab.yaml` node/relationship tokens; `core/schema.json` enums | `loadBundle` → `createParserSyntaxRuntime` → generic parser and compiler schema checks |
| `core/contracts.yaml` endpoint pairs and per-type realization rules; `profiles/*.yaml` property/reference/decision/prefix rules | Existing `validateGraph` rule registry and generic executors |
| Relationship `semantics.directionality`, `reciprocal_declarations`, `identity_fields` | `createSemanticRelationshipReader`; absent descriptors use directed declarations and the common duplicate-identity fields |
| `core/views.yaml` primary node sets and hierarchy/lane configuration | Projection filtering; `resolveHierarchyRoles`; journey, blueprint, and scenario render models and placement roles |
| View `relationship_references` selectors, directions, roles, labels and detail-switch names | Shared projection reference builder using the semantic reader; shared reference attributes and existing node measurement in staged and legacy outputs |
| `core/authoring.yaml` prefixes/forms; complete guided endpoint matrices in views | Guidance catalog, ID suggestions, guided-addition planner, helper resolved contracts and authoring |
| Selected bundle vocabulary and syntax | TextMate grammar generator; shipped editor grammar now selects v0.2 |

Loader checks validate semantic descriptors, symmetric endpoint coverage, reference selectors, view/node scope, projection reference roles/groups, and configured detail switches. No production list of the three Step tokens or relationship-specific symmetry branch supplies the behavior.

Compilation and raw inspection stay literal. Semantic lookup retains the original declarations, supports outgoing/incoming/incident lookup, coalesces reciprocal correspondence, and performs no graph expansion. Projection owns cross-view reference content; measurement, layout, routing, SVG and PNG remain downstream.

## Acceptance and visual evidence

Focused tests exercise exact vocabulary and illegal endpoints, all legal realization/instrumentation pairs, transferred rule applicability and severity, duplicate declarations, many-to-many correspondence, shared refinement, absent-descriptor directed defaults, declaration associations, and absence of inherited relationships or realizations.

Temporary bundle mutations are loaded through `loadBundle` and prove:

- Each Step type can be coherently renamed; parsing, forms, projection, rendering and decorators follow it.
- A relationship token can be renamed; lookup and annotations follow the selected contract and view configuration.
- Prefix suggestions and prefix validation follow changed authoring metadata.
- Removing an endpoint pair changes validation and guided relationship coverage.
- Directionality changes semantic lookup and counting.
- Reference labels and detail switches change legacy and staged output.

The canonical `step_differentiation.sdd` was created by helper `create` and strict `author` dry-run/commit. Its committed assessment is render-eligible. Helper `inspect`, strict `validate`, `project`, and detailed `preview` were exercised against the retained absolute v0.2 manifest. Automated guided workflows offer and apply both mapping directions without reciprocity warnings or automatic edges.

Forward-only, reverse-only and reciprocal variants yield equal projections, legacy DOT/Mermaid, and deterministic SVG/PNG for journey, blueprint and scenario views in both details, while compilation retains their different declarations.

Actual SVG and PNG proof output was inspected in all six view/detail combinations with type/ID decorators enabled. Journey shows only JourneySteps under the Stage; blueprint shows BlueprintSteps and their Process connections; scenario shows ScenarioSteps and direct Place/ViewState connections. Detailed references have distinct groups and sorted names/IDs, reciprocal references appear once, compact output hides the new groups, and no clipping, leaked primary nodes or routing degradation was observed. The proof passed before snapshot and corpus generation.

## Canonicals and compatibility

Seven inherited Step-bearing sources were explicitly migrated:

- Journey: `outcome_to_ia_trace`, `branching_journey`, `three_branch_journey`.
- Blueprint: `service_blueprint_slice`; its obsolete journey projection snapshot and manifest entry were removed.
- Scenario: `scenario_branching`, `flow_journey_topology_challenge`, `metric_event_instrumentation`.

Migration changed parsed node-header tokens, IDs and structured edge references. Numbers/suffixes and prose were retained; no ID collisions occurred. This is a scoped corpus migration, not an automatic version-migration feature.

The mixed proof adds all three intended projections. Every canonical was validated under `simple`, `permissive` and `strict` before v0.2 compiled/projection snapshots were captured. The selected v0.2 corpus contains 17 view/example pairs, 34 view/detail variants, and 318 files, including staged SVG/PNG, legacy text/Graphviz comparisons and supported routing-stage artifacts. Graphviz was verified before generation. Its generated index records an explicit v0.2 regeneration command.

A baseline hash inventory covers 484 files across `bundle/v0.1`, `examples/rendered/v0.1`, and `tests/goldens`. None changed. Independent v0.1 parser, grammar-generation, compiled/projection snapshots, staged acceptance and legacy goldens remain part of verification. A synthetic journey render-model fixture was updated to provide the newly explicit semantic type; its historical `Step` content and layout expectations were preserved.

Two historical test guards required explicit scope corrections. The bottom-exit routing proof reads a planning document with a v0.2 header and historical Step content using the v0.1 bundle; the test now normalizes that header in memory and asserts compilation succeeds, retaining every routing assertion and leaving the document untouched. The B5 source-hash guard exempts only the three projector files this plan necessarily changes (`journeyMap.ts`, `shared.ts`, and `types.ts`). Its historical hash manifest, design references, twelve exact scene replays and independent geometry assertions remain unchanged. Versioned projection snapshots and the compatibility inventory guard v0.1 behavior.

## Restrained documentation changes

- Added the focused v0.2 definition and its definitions-index entry.
- Updated the v0.2 canonical inventory and generated corpus index.
- Updated the current node/edge reference to the v0.2 bundle and differentiated tokens; its contract test now reads that bundle.
- Added a discoverable documentation page with the mixed proof and explicit-bundle rendering command.
- Updated the diagram index's active sources and illustrations to v0.2, regenerated the decorated Departure Desk and BillSage previews with the selected bundle, and commented out the obsolete Journey Map view of the service-blueprint canonical.
- Updated the hidden-edge reference to v0.2: legal endpoint coverage per view, compact/detailed visibility, Step correspondence and refinement annotations, all three instrumentation targets, and conditional UI/Scenario presentation rules.
- Added focused discovery links in the repository README and selected-bundle helper guidance.

No helper/workflow protocol version, CLI command, rendering backend, parser grammar branch, validation executor, unrelated endpoint pair, or v0.1 source was changed.

## Final verification

- `TMPDIR=/tmp pnpm test`: TypeScript build and all **1,532 tests across 143 files passed**.
- `TMPDIR=/tmp pnpm run docs:build`: documentation site built successfully; only the existing bundle-size advisory was emitted.
- Focused semantic, loaded-bundle mutation, authoring lifecycle and render-equivalence checks passed; the complete suite includes these checks.
- All v0.1 and v0.2 canonicals passed all three validation profiles, and both versioned rendered-corpus inventories passed.
- A read-only comparison against the original v0.2 contracts confirmed all inherited endpoint rules are preserved after the specified substitutions: 52 endpoint pairs across 17 existing relationships.
- Final SHA-256 comparison: **484 compatibility files checked, zero changes**. `git diff --check` passed.
- Production-source audit found no literal checks for `Step`, the three new type tokens, `MAPS_TO`, or `REFINED_BY` supplying feature behavior.
- Follow-up hidden-edge documentation audit checked all 119 legal endpoint/view combinations touching the six views against the loaded v0.2 bundle, including hidden, annotation and conditional-node classifications. All 47 focused semantic, projection, render-detail, UI presentation and disconnected-Place tests passed, and the documentation site rebuilt successfully.

All acceptance invariants are satisfied and the focused visual output is acceptable. No unresolved feature limitation remains. Legacy comparison generation retains its existing Graphviz dependency. No snapshot or historical golden was refreshed to conceal a failed acceptance invariant.
