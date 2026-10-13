# ia_place_map Hardening Implementation Plan

**ACTUAL STATUS: REJECTED AFTER MANUAL REVIEW.**
See [routing failures](manual_review_routing_failures.md)

Status:implemented and verified 2026-10-12. See
[implementation evidence and accepted visual proofs](implementation_evidence.md).
The sequence below records the reviewed implementation plan.
Inspected 2026-10-12 at Git HEAD `b15b348a7accc4e56a09405317ee1c9bfbd995e3`.
All paths below are repository-relative. Re-read the current files before execution.

## Objective and boundaries

Make v0.2 IA navigation occurrence-complete and readable in **combined views and individual named diagrams**, including parallel navigation with different events/guards. Selection mode must not determine whether occurrences are merged, omitted, or rejected.

Include compact/detailed staged SVG and SVG-derived PNG, public API/CLI/helper paths, and a narrowly scoped legacy DOT/Mermaid/Graphviz label-parity change. `--view all` enumerates combined view types; `--diagram all --view ia_place_map` enumerates named IA diagrams. They are not interchangeable. Failures in other view types are separate findings, not evidence that IA failed.

Preserve v0.1 bundle behavior, other diagram types, global validation, source syntax, containment semantics, and source ordering. Do not fix journey/service/scenario renderer deficiencies discovered during earlier investigation. Do not keep an `.old.ts` copy: Git preserves source history; baseline artifacts preserve visual evidence. A retained compatibility path must be selected by bundle capability, not a hardcoded version check.

## Authority and non-negotiable invariants

| Authority | Requirement |
| --- | --- |
| [AGENTS.md](../../AGENTS.md), Bundle Authority | Bundle governs spec behavior; extend types, loading/validation, and generic consumers before using new conventions. Prove behavior with real-loader bundle mutations. |
| `bundle/v0.2/core/contracts.yaml`, `diagram_membership.selection` and `duplicate_edge_detection` | Preserve exact selected occurrences; membership is nonsemantic. Identical duplicates remain warnings, not renderer rejection grounds. |
| Same file, `NAVIGATES_TO` contract | Supported semantic annotations are **event and guard**; the only supported property is membership metadata `diagrams`. Do not introduce effects or arbitrary properties. |
| `bundle/v0.2/core/views.yaml`, IA projection and normative defaults | Hierarchy comes from `CONTAINS`; retain authored structural ordering. Navigation completeness must not create containment or duplicate Place nodes. |
| AGENTS.md, Renderer Constraints | Keep `projection → RendererScene → MeasuredScene → PositionedScene → SVG → PNG`; geometry/wrapping belong downstream of projection. No ELK. Shared measurement, routing, label layout, and diagnostics remain shared infrastructure. |
| AGENTS.md, Quality And Drift Control | Accept the meaningful proof before generalization or golden refresh; report satisfied/violated invariants after each substantial pass. Green tests alone are insufficient. |

Existing IA source-order/recursive-chain goldens and `tests/fixtures/render/billSage_structure.sdd` are **visual references**, not semantic authority. `docs/diagrams/ia-place-map.md` describes architecture. The old diagram-separation plan/report deliberately permitted rejection of parallel IA occurrences; this plan supersedes that exception for enabled v0.2 IA rendering only.

## Confirmed gaps and implementation locations

Bare staged filenames below are under `src/renderer/staged/`; `dot.ts`, `mermaid.ts`, `viewRenderers.ts`, `renderView.ts`, and `previewBackends.ts` are under `src/renderer/`. Source identity is implemented in `src/relationships/edgeIdentity.ts`; public projection selection enters through `src/projector/projectView.ts:projectView/projectDiagram`.

| Gap | Actual code / consequence |
| --- | --- |
| Combined identity | `src/projector/shared.ts:createProjectionBuilderContext` emits `source_edge_id` only for named diagrams. `src/projector/edgeOccurrences.ts:resolveProjectionEdge` otherwise returns the first matching triple; unsafe for distinct parallel labels. |
| No navigation labels | `src/renderer/iaPlaceMapRenderModel.ts:IaRenderEdge` retains only endpoints/reference; `src/projector/iaPlaceMap.ts` produces node annotations only. IA has no renderer-owned label policy. Guided-addition `label: hidden` is authoring metadata, not an artifact-label implementation. |
| Coverage coupled to placement | `src/renderer/staged/iaPlaceMap.ts:buildNavigationTargetsBySourceId` uses target sets; follower planning selects a forward subset. Existing combined tests intentionally omit second-hub, cross-boundary, and return connections. |
| Named failure / identity conflation | `sceneBuilders.ts:completeExactSceneConnections` rejects parallels and ignores missing-reference combined edges. IA's `sourceIds` groups by endpoints alone, potentially combining containment and navigation identities. |
| Coincident paths | `sceneBuilders.ts:buildIaPlaceMapPorts` fixes chain/cardinal ports. `macroLayout.ts:positionMeasuredEdge` bypasses parallel offsets for local-pattern routes. Merely duplicating scene edges does not separate them. |
| Inadequate labels/space | `routing.ts:positionEdgeLabel` uses longest-segment/midpoint placement without obstacle-aware search. IA uses fixed stack gaps; `pipeline.ts:runStagedRendererPipeline` has no IA repair/expansion loop. |
| Weak final acceptance | IA's same-source trunk exemption covers every segment. `routingCore/sceneValidation.ts` collects node obstacles, not all header/label reservations. `svgBackend.ts` currently adds a specialized final audit only for UI Contracts. |
| Legacy labels missing | `dot.ts:renderIaPlaceMapDot` and `mermaid.ts:renderIaPlaceMapMermaid` iterate occurrences but emit no navigation labels. |

## Architectural decisions

1. **Opt-in bundle contract, no version branch.** Extend `bundle/v0.2/core/views.yaml` with typed policies for exact projection references, navigation relationship selection, complete occurrence coverage, label parts/detail visibility, and permitted containment/navigation fusion. Field names are new API to define in step 2; do not assume they already exist. Absence retains existing behavior. `core/contracts.yaml` remains the semantic identity/field-support authority. Geometry algorithms and numeric clearances stay in shared renderer policy/theme, not YAML keyword lists.

2. **Explicit combined references.** Enable the existing optional `source_edge_id` on all v0.2 IA projected edges, including combined output. This is the intentional projection metadata change; topology is unchanged. Use the existing bundle-driven `createSourceEdgeIndex`, not endpoint queues, duplicate parsers, or hidden array-order matching. `core/projection_schema.json` already permits these references; inspect it and extend only if the final contract needs more. Preserve other views' combined serialization.

3. **One navigation occurrence, one connector identity.** Keep the containment/follower placement plan, but build navigation connectors from the complete projected occurrence inventory independently. Include backward, cross-Area, and multiple-incoming navigation. Do not duplicate nodes to simplify routing. Preserve singleton, unannotated containment/navigation fusion only under an explicit bundle rule and exact association to both roles; with multiple navigation occurrences or annotations, keep navigation separate from structural connectors. Never treat `CONTAINS` as a second navigation occurrence.

4. **Labels express authored distinctions.** Bundle templates select event then guard, e.g. `[event name] {guard}`, in both compact and detailed modes. Empty annotations produce no invented label. For distinct Event IDs with identical display names, include IDs to disambiguate; retain ID fallback when no display name is available. Event references may supply names without expanding projected topology. Identical duplicates retain identical text and separate occurrence identities. Use a generic formatter patterned on `uiContractsPresentationModel.ts`'s template consumption; do not copy its UI-specific selectors. Keep the same prepared label payload across staged and legacy outputs.

5. **IA adapter over shared geometry.** Retain existing stack/containment placement as the initial geometry. Introduce an IA routing adapter invoked by `renderIaPlaceMapStagedSvg/Png`; do not clone scenario/journey routing engines. Reuse `measureScene`, `positionSceneBeforeRouting`, `routingCore/runRoutingLifecycle`, `validateFinalRouteSet`, `measureRoutingCorridorDeficits`, and `connectorLabelLayout.ts` assessment/capacity/audit functions. General extensions needed for gaps, ports, labels, or collision checks belong in shared infrastructure, with IA supplying ownership and preferred route shapes.

6. **Bounded joint route/label layout.** Allocate endpoints/tracks in stable authored occurrence order, measure labels using vendored fonts, route, place labels, measure deficits, and reflow affected gaps. Map each deficit to an actual sibling gap/indentation/Area padding using ancestor ownership; reflow ancestors and later siblings. Rebuild from the original measured geometry plus absolute demands, not cumulative arbitrary offsets. Prefer existing valid port sides; evaluate alternate legal sides before freezing a routing context. Respect node-side capacity and arrowhead legs; never attach outside a node. Extend shared minimum-size constraints if genuine port capacity demands it. Share a finite expansion budget across route and label passes (use existing routing-policy limits), detect repeated states, and emit actionable failure diagnostics after exhaustion.

7. **Final independent acceptance.** Permit sharing only on explicitly identified structural trunk segments, never entire parallel paths or distinguishing label/arrowhead sections. Treat Area headers as blockers, not entire container interiors. Audit exact occurrence coverage, text, label-to-own-route association, competing-route ambiguity, node/header/label/marker collisions, endpoint validity, and root bounds on the final scene. Missing required labels or unresolved geometry withhold the artifact in combined and named public paths, including `force`; merely enlarging the SVG viewport is not a spacing repair. PNG must derive from that same accepted SVG.

## Ordered implementation and gates

### 1. Establish baseline and proof inventory

- Inspect `git status`; preserve unrelated work. At planning time `progress.md` was modified and `docs/etc/design_foundations/` untracked. Record the actual baseline commit and relevant source/bundle hashes; do not sweep unrelated changes into a checkpoint. Use a dedicated branch when beginning implementation.
- Run the focused baseline commands below without updating goldens. Record failures separately from new failures. Save reference renders outside canonical golden paths.
- Add dedicated `tests/iaPlaceMapHardening.spec.ts` (coverage, geometry, public-path matrix) and `tests/iaPlaceMapHardeningBundle.spec.ts` (real-loader mutations and negative contracts); these are proposed new files, not existing tests.
- Add the planned proof fixture `tests/fixtures/render/ia_parallel_navigation_v02.sdd` and explicit expected inventories. Author a coherent workspace-navigation example: Dashboard → Workspace home via **Open current workspace / workspace selected** and **Accept invitation / invitation valid**, with real Event declarations, two Areas, an ordinary neighboring connection, and a return route. Supply `DG-001` selecting the full IA and `DG-002`/`DG-003` selecting one parallel occurrence each, with explicit relevant containment memberships. Combined and `DG-001` must select equivalent IA content; Events remain reference-only.
- Start with the two labeled connectors and containment proof; add the neighboring/return constraints after this core is correct. Keep a one-edge control. Do not use two anonymous Places without meaning as the visual acceptance exemplar.

Gate: independent expected node IDs, navigation occurrence identities, labels, and containment ownership are recorded. Proof artifacts do not yet count as accepted.

### 2. Extend bundle contract and exact-reference boundary first

- Change `bundle/v0.2/core/views.yaml`, `src/bundle/types.ts`, and `src/bundle/validateLoadedBundle.ts` through `loadBundle`. Validate policy shapes, relationship/field references against loaded contracts, detail keys, template fields, and coherent capability absence. Ensure bundle fingerprints include the changes. Do not add hardcoded annotation/relationship conventions to IA code.
- Update `src/projector/shared.ts`, `projectView.ts`, and `edgeOccurrences.ts` to supply and verify exact combined references under the new policy. Keep compiled semantics and selection rules unchanged.
- Generalize the **named-only** preflight conditions in `src/renderer/renderView.ts:renderPreparedProjectionText` and `previewBackends.ts:renderPreviewArtifact`. Required-reference checks must derive from bundle policy, not from whether any references happen to remain in input. A combined projection with all references removed must fail, not evade checking. Reconstruct the source index from the supplied graph/bundle at public boundaries.
- Test missing/wrong/stale references, same-triple substitutions, omitted/extra occurrences, and serialization round-trips. Use existing named corruption tests as a pattern. Real-loader mutations must prove annotation template/order/detail changes and coherent opt-out affect runtime; malformed combinations must fail load. Do not weaken global validation.

Gate: every supported public preparation path associates each IA edge with the correct compiled occurrence in both modes; v0.1 and unrelated combined projections are unchanged.

### 3. Build labels and complete scene coverage

- Extend `buildIaPlaceMapRenderModel` and its callers in `viewRenderers.ts` and staged `iaPlaceMap.ts` to consume loaded presentation policy and exact source associations. Preserve event/guard label data without doing geometry in projection.
- Separate structure placement from navigation emission; retain authored node order and hierarchy. Replace endpoint-keyed source-ID aggregation with occurrence/type-aware association. Adapt or retire IA's use of `completeExactSceneConnections`; do not merely delete its rejection check.
- Capture expected navigation IDs and required labels before layout; retain that independent inventory through routing/final audit. Make placement incapable of silently dropping an expected connector.

Gate: the full proof and each named subset have exact scene inventories and correct labels, including containment plus parallel navigation. No geometry/golden acceptance yet.

### 4. Route and label the proof, then generalize

- Implement decision 5–7 using shared measurement, occupancy, route search, and label assessment. Existing `connectorLabelLayout.ts:labelAssociatedWithSegment` is not sufficient by itself to prove that a label belongs unambiguously to one of two close parallel paths; add shared competing-route checks.
- Wire measured label/track demands to IA stack reflow. Recompute ports, routes, blockers, label anchors, container bounds, and final audit after every geometry change. Preserve unaffected valid geometry where possible; do not copy another view's lane/grid semantics.
- Separate target arrowheads and labeled route sections. Do not allow blanket shared-trunk exemptions to legitimize coincident parallels. Resolve direct vertical, follower, cross-Area, and return shapes with actual obstacles.
- Render and visually inspect SVG-derived PNGs for combined/full named/separate named selections in both details. Check readability and association at normal viewing scale, not just numerical nonintersection. Save intermediate diagnostics when the proof fails.

Gate: the proof passes independent geometry/semantic checks and visual inspection. Only then broaden to three-plus parallels, identical duplicates, same event/different guard, different events/same display name, long labels/tokens, decorators, nested Areas, multiple incoming sources, reciprocal navigation, and navigation self-loops. Cyclic containment is not part of this work.

### 5. Public outputs, compatibility, documentation

- Extend v0.2 IA DOT/Mermaid emission to include the common prepared labels while retaining every occurrence; test quoting/escaping. Graphviz retains its own layout. Preserve v0.1 and unrelated legacy output. Do not promise pixel-identical staged/legacy geometry.
- Test API, `show`, named batches, combined batches, and `src/authoring/preview.ts` through existing harnesses. Generalize fatal-diagnostic artifact gating in `previewBackends.ts` for enabled combined IA as well as named IA. Check helper materialization cannot publish a failed artifact.
- Replace the deliberate parallel-rejection assertion in `tests/diagramSeparationViews.spec.ts` only after successful proof. Preserve v0.1 omission tests in `stagedIaPlaceMap.spec.ts`; its BillSage case explicitly loads **v0.2**, so its missing-return-edge expectations intentionally change. Keep hierarchy/order/geometry quality assertions instead of removing the whole test.
- Update `definitions/v0.2/diagram_separation.md`, `docs/diagrams/ia-place-map.md`, and concise user-facing named-diagram guidance. Add a dated supersession note to the diagram-separation implementation report rather than rewriting its historical claim. Align guided authoring label metadata if changed presentation makes it misleading.
- Refresh only affected v0.2 projection/render goldens after acceptance; inspect every changed artifact. `rendererStageSnapshotHarness.ts` reads checked-in files: do not assume Vitest `-u` regenerates these. Do not regenerate the entire corpus to normalize failures.

## Acceptance checklist

- Equivalent combined/full-named selections have equal navigation multiplicity and label content; each separately named occurrence remains correct. Unassigned occurrences do not leak into named output. Exact duplicates are visible separately and keep duplicate warnings.
- Both details preserve authored event/guard distinctions, even where Place metadata differs. Labels neither disappear, truncate away distinctions, overlap obstacles, nor ambiguously attach to another parallel route.
- Final IDs/coverage match the independently declared inventory; complete paths, arrowheads, labels, and scopes fit the exported bounds. Intentional trunk sharing is segment-specific. Mutated/corrupted projections and exhausted-capacity failures produce diagnostics and no public artifact, including under `force`.
- Stable input/bundle/settings produce deterministic geometry, label ordering, SVG/LF text, and PNG derived from the accepted SVG. Bundle mutations demonstrably change behavior. No new parser branch, inferred topology, or ELK dependency.
- v0.1 compatibility and unaffected views pass; intentional v0.2 differences are enumerated and visually justified. Batch failures remain per-target: another view's failure must not delete a successful IA artifact.

## Verification commands (repository root, during implementation)

Use Node 22/pnpm; if unavailable, `source ~/.nvm/nvm.sh`. Set `TMPDIR=/tmp` for tests/CLI. Do not run implementation commands merely to author this plan.

```bash
git status --short
TMPDIR=/tmp pnpm run build
TMPDIR=/tmp pnpm exec vitest run tests/stagedIaPlaceMap.spec.ts tests/iaPlaceMapSharedNode.spec.ts tests/project_ia_place_map.spec.ts tests/diagramSeparationViews.spec.ts tests/diagramSeparationProjection.spec.ts tests/diagramSeparationCli.spec.ts tests/diagramHelperIntegration.spec.ts tests/connectorLabelLayout.spec.ts tests/connectorLabelPlacement.spec.ts tests/routingCore.spec.ts tests/render_dot.spec.ts tests/render_mermaid.spec.ts --maxWorkers=4 --minWorkers=4
# Run after creating these planned tests:
TMPDIR=/tmp pnpm exec vitest run tests/iaPlaceMapHardening.spec.ts tests/iaPlaceMapHardeningBundle.spec.ts --maxWorkers=4 --minWorkers=4
TMPDIR=/tmp pnpm exec vitest run tests/stagedVisualAcceptance.spec.ts tests/projectionSnapshots.spec.ts tests/projectionServicePublicApi.spec.ts tests/previewWorkflow.spec.ts tests/previewArtifacts.spec.ts tests/bundleRenderDetails.spec.ts --maxWorkers=4 --minWorkers=4
pnpm run check:graphviz
dot -V
```

After creating the proof fixture, use these representative commands; repeat the staged commands for `--detail compact`, `--format png`, and decorators `none`, `type`, `id`, `type,id`. Explicit `/tmp` outputs avoid accidental corpus writes.

```bash
TMPDIR=/tmp pnpm sdd show tests/fixtures/render/ia_parallel_navigation_v02.sdd --bundle bundle/v0.2/manifest.yaml --profile simple --detail detailed --view ia_place_map --out /tmp/ia-combined.svg
TMPDIR=/tmp pnpm sdd show tests/fixtures/render/ia_parallel_navigation_v02.sdd --bundle bundle/v0.2/manifest.yaml --profile simple --detail detailed --diagram DG-001 --out /tmp/ia-named.svg
TMPDIR=/tmp pnpm sdd show tests/fixtures/render/ia_parallel_navigation_v02.sdd --bundle bundle/v0.2/manifest.yaml --profile simple --detail detailed --diagram all --view ia_place_map --out /tmp/ia-named-batch.svg
TMPDIR=/tmp pnpm sdd show tests/fixtures/render/ia_parallel_navigation_v02.sdd --bundle bundle/v0.2/manifest.yaml --profile simple --detail detailed --view all --out /tmp/ia-combined-batch.svg
TMPDIR=/tmp pnpm sdd show tests/fixtures/render/ia_parallel_navigation_v02.sdd --bundle bundle/v0.2/manifest.yaml --profile simple --detail detailed --view ia_place_map --backend legacy_graphviz_preview --out /tmp/ia-legacy.svg
TMPDIR=/tmp pnpm sdd render tests/fixtures/render/ia_parallel_navigation_v02.sdd --bundle bundle/v0.2/manifest.yaml --profile simple --detail detailed --view ia_place_map --format dot --out /tmp/ia.dot
TMPDIR=/tmp pnpm sdd render tests/fixtures/render/ia_parallel_navigation_v02.sdd --bundle bundle/v0.2/manifest.yaml --profile simple --detail detailed --diagram DG-001 --format mermaid --out /tmp/ia.mmd
TMPDIR=/tmp pnpm test --maxWorkers=4 --minWorkers=4
TMPDIR=/tmp pnpm run docs:build
git diff --check
git diff --name-only
```

Repeat legacy commands for the other selection mode. For `--view all`, inspect the IA artifact and per-target diagnostics; the IA-only proof is not a scenario-flow acceptance example. Record unrelated batch failures separately. Review docs-build generated changes rather than committing them blindly.

## Original execution gates and stop conditions

At plan creation, no missing product decision prevented steps 1–3. However, the **new visual proof is not yet authored/accepted**, the **IA gap-owner/port-capacity adapter is not yet demonstrated**, and the **current full test baseline/Graphviz availability were not executed for this planning task**. These were explicit execution gates, not claims of solved geometry. Their accepted implementation and verification are recorded in the evidence report. Existing shared capacity helpers did not by themselves implement nested IA reflow.

Stop and report the exact invariant/proof when: required semantics cannot be represented by the proposed bundle contract (extend that contract first); a source occurrence cannot be associated exactly; the proof loses topology/labels or needs speculative layout tuning; ownership/reflow cannot be justified from containment; compatibility would require changing v0.1 or unrelated views; or golden updates would hide a regression. Do not weaken audits, widen overlap exemptions, suppress required labels, merge occurrences, or increase retry budgets to make tests pass. If a broader layout redesign becomes necessary, present the concrete failing case and revised architecture before proceeding. Report incomplete work as incomplete even if tests are green.
