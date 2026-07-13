# Staged Journey Map Renderer — Gated Implementation Plan

Status: implementation-ready planning contract; no renderer implementation is authorized by this document

Audience: the single implementation agent, reviewers, and maintainers responsible for accepting a staged `journey_map` renderer

Purpose: deliver a deterministic, visually excellent journey-map renderer through narrow, sequential, proof-driven gates. Correct semantics, obstacle-free routing, connector identity, visual readability, and reviewability outrank implementation speed.

## 1. Completion definition

This plan is complete when it gives a future implementation thread enough exact repository context, gate criteria, artifacts, commands, and stop conditions to work without rediscovering the architecture. The renderer implementation is complete only after every gate below has been accepted in order, with at most one gate in progress, and Gate 10 closeout evidence is reviewed.

Implementation success means all bundle-owned journey semantics remain intact; Stage and Step placement remains source-ordered; every projected `PRECEDES` relationship has one stable, explicit, orthogonal route; all proof archetypes meet hard geometry assertions and blocking human visual review; SVG is the vector truth and PNG derives from it; degraded routing is diagnosed; staged preview becomes the default while legacy remains selectable; and existing staged renderer output is unchanged.

Green tests alone never complete a gate that produces visual output.

## 2. Authority hierarchy and source roles

Resolve conflicts in this order. Higher authority wins.

| Role | Exact source | Planning use |
| --- | --- | --- |
| Repository policy | [`AGENTS.md`](../../AGENTS.md) | Bundle authority, renderer boundaries, determinism, quality policy, no-ELK rule, stop conditions |
| Normative view contract | [`bundle/v0.1/core/views.yaml`](../../bundle/v0.1/core/views.yaml) | `journey_map` scope, hierarchy/ordering edges, reference annotations, profile badge display |
| Normative relationship contract | [`bundle/v0.1/core/contracts.yaml`](../../bundle/v0.1/core/contracts.yaml) | `CONTAINS`/`PRECEDES` endpoints, cycle severity, recommended single parent, duplicate identity |
| Semantic boundary | [`src/projector/journeyMap.ts`](../../src/projector/journeyMap.ts) | `buildJourneyMapProjection(...)` and resolved opportunity-reference annotations |
| Existing journey adapter | [`src/renderer/journeyMapRenderModel.ts`](../../src/renderer/journeyMapRenderModel.ts) | `buildJourneyMapRenderModel(...)`, first parent, source ordering, roots, badges, ordering edges |
| General staged authoring guardrails | [`docs/toolchain/adding_staged_renderers.md`](../toolchain/adding_staged_renderers.md) | Layer ownership, proof requirements, artifact policy |
| Current toolchain architecture | [`docs/toolchain/architecture.md`](../toolchain/architecture.md) | Pipeline and public integration surfaces |
| Journey architecture authority | [`staged_journey_map_renderer_architecture.md`](staged_journey_map_renderer_architecture.md) | Journey scene, placement, dedicated routing, diagnostics, proof corpus, acceptance and stops |
| Implementation exemplars | Existing files under [`src/renderer/staged/`](../../src/renderer/staged/) | Structures to leverage or replicate, never authority for journey semantics |
| Visual evidence | Focused proof fixtures, stage snapshots, SVGs, PNGs, and human review created by later gates | Evidence after acceptance; never normative authority |

Older ELK migration guidance is historical. Do not use or expand ELK, Graphviz, Mermaid, DOT, or any other external engine for staged journey placement or routing. Existing legacy text/Graphviz support remains selectable until a separate cutover.

## 3. Current-state inventory and drift

### 3.1 Bundle and projection readiness

- `views.yaml` currently scopes `journey_map` to `Stage`, `Step`, `CONTAINS`, and `PRECEDES`; declares `CONTAINS` hierarchy and `PRECEDES` ordering; and owns `opportunity_refs` resolution, `Opportunity` targets, `inline_step_badges`, ID-ascending sorting, validation-owned unresolved references, and simple-hidden/permissive-visible/strict-visible badges.
- `contracts.yaml` permits `Stage -> Step` containment and `Step -> Step` precedence. Multiple incoming `CONTAINS` edges warn rather than invalidate. `PRECEDES` cycles warn in every profile and recognize `props.kind=loop`; cycles are renderable topology.
- `buildJourneyMapProjection(...)` uses common bundle-driven projection scope, resolves typed reference annotations, omits unresolved/wrong-type targets, emits Step-only notes, and stays profile-independent.
- Existing manifest projection evidence is [`outcome_to_ia_trace.journey_map.projection.json`](../../bundle/v0.1/snapshots/outcome_to_ia_trace.journey_map.projection.json) and [`service_blueprint_slice.journey_map.projection.json`](../../bundle/v0.1/snapshots/service_blueprint_slice.journey_map.projection.json), exercised through `tests/projectionSnapshots.spec.ts`.
- Drift to resolve before changing projection: `views.yaml` declares `sort: id_ascending`, while `splitReferenceIds(...)` currently always locale-sorts without visibly consuming that field. Gate 2 must prove bundle dependence. If a projection change is required, stop for explicit approval because projection behavior is protected by default.

### 3.2 Render-model readiness and narrow gaps

`buildJourneyMapRenderModel(...)` already provides:

- first qualifying Stage parent in projected hierarchy-edge order;
- Stage children through `getSourceOrderedStructuralStream(...)` and qualifying `CONTAINS` edge-line order;
- root Stages and uncontained root Steps through `getTopLevelNodeIdsInAuthorOrder(...)`;
- empty and single-Step Stages;
- profile-controlled visible opportunity references; and
- projected `PRECEDES` edges in stable array order, including duplicates.

Two narrow, additive gaps are confirmed:

1. `JourneyRenderStep` exposes bracketed `labelLines`, not typed badges. Add typed resolved badge data while retaining legacy `labelLines` byte-for-byte for DOT/Mermaid emitters.
2. `JourneyRenderEdge` exposes only `{from,to}`. Add stable ID, type, author-order position, and same-endpoint duplicate ordinal without changing legacy emission.

There is no dedicated journey projection or render-model suite. Gate 2 must add focused coverage for first-parent selection, Stage edge-line order, interleaved root author order, empty/single Stage, Step-only roots, duplicate edge identity, profile behavior, and bundle dependence.

### 3.3 Current staged preview and capability status

- [`src/renderer/viewRenderers.ts`](../../src/renderer/viewRenderers.ts) assigns `journeyMapRenderer.capability = dotAndMermaidPreviewCapability()`. Journey SVG/PNG therefore default to `legacy_graphviz_preview`; journey is the only remaining legacy-default view.
- [`src/renderer/previewBackends.ts`](../../src/renderer/previewBackends.ts) has the reusable `createStagedProjectionPreviewBackend(...)` path and carries renderer diagnostics, but no journey staged backend.
- [`src/renderer/renderArtifacts.ts`](../../src/renderer/renderArtifacts.ts) lacks a staged journey backend ID.
- [`src/renderer/previewWorkflow.ts`](../../src/renderer/previewWorkflow.ts) is the generic public compile/validate/project/preview seam. `renderSourcePreview(...)` maps staged diagnostics without a view-specific CLI branch.
- CLI integration is generic, but help text in [`src/cli/program.ts`](../../src/cli/program.ts) enumerates the current five staged-default views. `tests/cli.spec.ts` currently proves legacy journey preview.
- Helper preview flows through `src/authoring/preview.ts` and `src/cli/helperProgram.ts`; relevant suites are `tests/authoringDirectoryServices.spec.ts`, `tests/helperCli.spec.ts`, and `tests/helperCli.integration.spec.ts`.
- Pre-existing unrelated drift: [`src/authoring/contracts.ts`](../../src/authoring/contracts.ts) omits the already-live staged outcome-opportunity backend ID. Gate 9 must not silently repair it. Record it, decide scope explicitly, and keep a journey-only change unless separately approved.

### 3.4 Shared infrastructure and harnesses

- Scene primitives: `buildDiagramRootContainer(...)`, `buildCardNode(...)`, `buildPortSpec(...)`, and cardinal-port precedent in [`sceneBuilders.ts`](../../src/renderer/staged/sceneBuilders.ts).
- Measurement: shared theme, vendored-font measurement, wrapping, width bands, content frames, ports, and overflow in `theme.ts`, `textMeasurement.ts`, `microLayout.ts`, and `primitives.ts`.
- Pre-routing boundary: `positionMeasuredSceneBeforeRouting(...)` in [`macroLayout.ts`](../../src/renderer/staged/macroLayout.ts). Do not use `positionMeasuredScene(...)` as proof that the generic immediate router is sufficient.
- Routing primitives: `buildPositionedIndex(...)`, endpoint/port resolution, point collapse, and basic orthogonal helpers in [`routing.ts`](../../src/renderer/staged/routing.ts). Shared routing lacks journey-ready occupancy, boundary gates, lowest-common-container ownership, and bounded expansion.
- Diagnostics: phase/severity constructors and stable sorting in [`diagnostics.ts`](../../src/renderer/staged/diagnostics.ts).
- Target path: `renderPositionedSceneToSvg(...)` and `renderPositionedSceneToPng(...)` in [`svgBackend.ts`](../../src/renderer/staged/svgBackend.ts); PNG already derives from SVG.
- Snapshot harness: `expectRendererStageSnapshot(...)` and `expectRendererStageTextSnapshot(...)` in [`tests/rendererStageSnapshotHarness.ts`](../../tests/rendererStageSnapshotHarness.ts).
- Geometry harness: flattening, boxes, headers, intersection, endpoint entry, separation, and terminal-leg helpers in [`tests/stagedVisualHarness.ts`](../../tests/stagedVisualHarness.ts).
- Acceptance/routing precedents: [`tests/stagedVisualAcceptance.spec.ts`](../../tests/stagedVisualAcceptance.spec.ts), [`tests/scenarioFlowPreRouting.spec.ts`](../../tests/scenarioFlowPreRouting.spec.ts), [`tests/scenarioFlowRouting.spec.ts`](../../tests/scenarioFlowRouting.spec.ts), [`tests/serviceBlueprintPreRouting.spec.ts`](../../tests/serviceBlueprintPreRouting.spec.ts), [`tests/stagedServiceBlueprint.spec.ts`](../../tests/stagedServiceBlueprint.spec.ts), and [`tests/outcomeOpportunityMapRouting.spec.ts`](../../tests/outcomeOpportunityMapRouting.spec.ts).

### 3.5 Existing proof and corpus artifacts

Current journey proof is insufficient for staged retirement: two projection snapshots, two legacy DOT goldens, and legacy-only corpus variants for `outcome_to_ia_trace` and `service_blueprint_slice`. [`src/examples/renderedCorpus.ts`](../../src/examples/renderedCorpus.ts) marks only journey preview-only. [`src/examples/generateRenderedExamples.ts`](../../src/examples/generateRenderedExamples.ts) generates default/non-default previews and has explicit debug branches for complex staged routers, but no journey branch. [`tests/renderedCorpus.spec.ts`](../../tests/renderedCorpus.spec.ts) enforces this current state.

### 3.6 Drift conclusion

No current code contradicts a non-negotiable journey architecture decision. The two drift items above are real but do not invalidate this plan: bundle-owned sort consumption must be resolved at Gate 2 before protected projection changes; unrelated authoring backend typing must be scoped at Gate 9. Any newly discovered contradiction triggers the stop policy in section 13.

## 4. Non-negotiable invariants

1. `bundle/v0.1/` governs machine behavior; tests and TypeScript literals cannot substitute for bundle-owned rules.
2. Projection remains the semantic boundary. Parser, compiler, validator, and projection behavior stays unchanged unless a gate proves a required bundle-contract change and stops for approval.
3. Root Stages and root Steps retain top-level author order. Steps inside a Stage retain that Stage's qualifying `CONTAINS` edge-line order. First qualifying Stage parent remains authoritative for multiply-contained Steps.
4. `PRECEDES` is an explicit routed overlay, never placement authority. Source-order contradictions remain visible rather than being reordered away.
5. Every projected `PRECEDES` edge renders exactly once with stable identity, including same-endpoint duplicates.
6. Branches, joins, disconnected chains, cross-Stage and backward edges, cycles, self-loops, and duplicates are valid or diagnosable topology.
7. The explicit pipeline is `Projection -> RendererScene -> MeasuredScene -> pre-routing PositionedScene -> routed PositionedScene -> SVG -> PNG`.
8. `RendererScene` contains hierarchy, typed content, ports, metadata, and intent—not final coordinates, final lines, routes, or target payloads.
9. SVG is first-class; PNG is rasterized from that exact SVG.
10. No ELK or external layout/routing engine. No raw `.sdd`, CSS-class parsing, SVG recovery, or proof-specific coordinates.
11. Existing staged renderer modules and output are protected. Shared changes are additive and behavior-preserving; established renderers are not migrated onto new helpers in this work.
12. Occupancy changes final geometry. A debug-only occupancy structure is failure.
13. Hard route quality is lexicographic: semantic correctness and obstacle avoidance; endpoint clarity and separation; then crossings, direction, boundary crossings, bends, length, balance, and symmetry. A shorter route cannot win by introducing a higher-order defect.
14. Snapshot/golden refresh records already accepted behavior; it never normalizes a defect.
15. Human visual review blocks every gate with visual output.

## 5. Fixed decisions, assumptions, and open decisions

### Fixed by architecture

- Dedicated journey `PRECEDES` routing is the default architecture. The generic router may replace it only after focused proof establishes every required topology, occupancy, expansion, geometry, diagnostic, and debug-stage behavior; absence of such proof means create `staged/journeyMapRouting.ts`.
- Source-ordered horizontal root items; titled Stage clusters; source-ordered horizontal Step cards; visible empty Stages; root Steps remain real root items.
- Lowest-common-container ownership: same-Stage routes belong to that Stage; cross-Stage/root-Step routes belong to root.
- Adjacent gaps, Stage-local bypass, inter-Stage gutters, root outer bypass, deterministic Stage-boundary gates, late endpoint ordering, occupancy displacement, and bounded rerouting are required concepts.
- Backward/cyclic paths are peripheral. `PRECEDES` does not produce placement order.
- No separate middle-layer file unless typed renderer-owned placement data becomes substantial; do not duplicate the render model for symmetry.

### Working assumptions to prove

- Shared card/cluster measurement can express Stage titles and typed badges without a journey-only text engine.
- A `standard -> wide` width-band policy with height growth before clamping is a viable starting point, not accepted policy until Gate 4 proof.
- South escape/return ports plus east output/west input are sufficient; north ports require visual proof that Stage headers remain clear.
- Sixteen pixels is the established minimum separation for competing overlapping same-orientation spans and crowded endpoints; theme/measurement may require more, never less.

### Open decisions, owned by named gates

- Gate 1 locks exact proof fixture names/content and measurable acceptance thresholds beyond the 16px baseline.
- Gate 2 resolves edge ID shape/duplicate ordinal and bundle-owned reference sorting without changing legacy output.
- Gate 4 decides Stage equal-height policy, width bands, overflow rules, and baseline gutter dimensions from visual proof.
- Gates 5–7 select route templates, gate ordering, expansion bounds, and whether any additive shared helper is justified.
- Gate 6 must define an explicit coincident-edge policy: duplicates need distinct stable routes where geometry permits; if deliberate coincidence remains, diagnostics and visual identity proof are required.
- Gate 9 decides whether corpus debug artifacts include pre-routing plus step-2/step-3 for all curated examples or only named proof-worthy variants. It does not decide legacy removal.

## 6. Write scope

### Expected production scope in future implementation

- New `src/renderer/staged/journeyMap.ts` and, unless the proof exception succeeds, `src/renderer/staged/journeyMapRouting.ts`.
- Narrow additive changes to `src/renderer/journeyMapRenderModel.ts`.
- Additive shared staged helpers only in the owning module (`contracts.ts`, `sceneBuilders.ts`, `routing.ts`, `macroLayout.ts`, `diagnostics.ts`, or test harnesses) with existing-renderer regression proof.
- Gate 9 registry/capability/types: `previewBackends.ts`, `renderArtifacts.ts`, `viewRenderers.ts`, generic CLI/helper/corpus integration surfaces.

### Expected test, fixture, artifact, and documentation scope

- Focused journey render-model, scene, pre-routing, routing, visual acceptance, backend, CLI/helper, and corpus tests.
- Small synthetic `.sdd` fixtures under `tests/fixtures/render/`; stage JSON/SVG goldens under `tests/goldens/renderer-stages/`; corpus artifacts only at Gate 10.
- Current docs such as `docs/toolchain/architecture.md`, `docs/toolchain/development.md`, and current renderer capability/help documentation only after staged promotion. Historical `docs/Done/` documents stay historical.

### Forbidden scope

- Parser, compiler, validator, projection, bundle, or schema changes without explicit gate stop and approval.
- Behavioral edits to `staged/iaPlaceMap.ts`, `staged/uiContracts.ts`, `staged/scenarioFlow*.ts`, `staged/serviceBlueprint*.ts`, or `staged/outcomeOpportunityMap*.ts`.
- Legacy renderer removal, broad renderer refactors, external-engine additions, unrelated typing cleanup, or snapshot/corpus churn before acceptance.

## 7. Reuse/replication matrix

| Exact path | Leverage/replicate | Do not copy; protected behavior |
| --- | --- | --- |
| [`staged/iaPlaceMap.ts`](../../src/renderer/staged/iaPlaceMap.ts) | `buildIaPlaceMapRendererScene(...)` pipeline skeleton, card/cluster construction, source-ordered container/leaf structure, SVG/PNG wrappers | follower grouping, `planScopeEntries`, containment/navigation merging, owned-scope regrouping, IA local-route patterns |
| [`staged/uiContracts.ts`](../../src/renderer/staged/uiContracts.ts) | titled scope chrome/container construction, leaf/container endpoint registration and mapping, cross-container ownership patterns | ELK layout, contract gutters/labels, transition priority, UI-specific endpoint semantics |
| [`staged/scenarioFlowMiddleLayer.ts`](../../src/renderer/staged/scenarioFlowMiddleLayer.ts) | deterministic topology classification/order, typed connector plans, cycle/disconnected diagnostics | PRECEDES topological placement, chronology bands, decision tracks, mirrored lanes, parking, branch-label semantics |
| [`staged/scenarioFlowRouting.ts`](../../src/renderer/staged/scenarioFlowRouting.ts) | `buildScenarioFlowRoutingStages(...)`: endpoint buckets, exterior approach, occupancy, late order, bundle displacement, global expansion, debug stages | scenario lanes/channels, label rules, placement metadata and route archetypes |
| [`staged/serviceBlueprintRouting.ts`](../../src/renderer/staged/serviceBlueprintRouting.ts) | `buildServiceBlueprintRoutingStages(...)`: control-flow seams, gutters, locked segments, bundle resolution, bounded expansion, prepared/final reconstruction | service lanes, chronology bands, support/resource channels, separators, parking, merge semantics |
| [`staged/outcomeOpportunityMapRouting.ts`](../../src/renderer/staged/outcomeOpportunityMapRouting.ts) | `buildOutcomeOpportunityMapRoutingStages(...)`, orthogonal templates, occupancy-driven shared-gap separation, late endpoints, final-route validation | fixed semantic columns/outcome bands, labels/aggregates, domain channels and patterns |
| [`sceneBuilders.ts`](../../src/renderer/staged/sceneBuilders.ts) | `buildPortSpec`, `buildDiagramRootContainer`, `buildCardNode`; build a journey port set from generic primitives | IA/transition/contract-specific port builders as journey semantics |
| [`routing.ts`](../../src/renderer/staged/routing.ts) | positioned index, port/endpoint resolution, point collapse, marker-leg/basic orthogonal primitives | assuming `buildSharedRoute` or local-hint fallback supplies occupancy, ownership, gates, or expansion |
| [`macroLayout.ts`](../../src/renderer/staged/macroLayout.ts) | recursive placement, container bounds, lowest-common-owner precedent, `positionMeasuredSceneBeforeRouting(...)` | immediate generic routing as journey proof; any ELK path or expansion of ELK |
| [`diagnostics.ts`](../../src/renderer/staged/diagnostics.ts) | structured phase/severity diagnostics and deterministic sorting | console-only or silent fallback |
| [`svgBackend.ts`](../../src/renderer/staged/svgBackend.ts) | deterministic SVG; PNG from SVG | journey geometry or direct PNG drawing |
| [`connectorLabelPlacement.ts`](../../src/renderer/staged/connectorLabelPlacement.ts) | segment/box utilities only if future journey labels actually exist | label placement/policies for currently unlabeled `PRECEDES` edges |

The implementation thread records a protected-file baseline hash/diff at Gate 0 and proves no protected renderer output changed at any gate that touches shared code.

## 8. Proof corpus and visual acceptance rubric

### Proof design

Gate 1 specifies, but does not broadly generate, these fixtures:

1. **Primary multi-Stage proof:** at least three Stages, one empty, one single-Step, one long title, long Step label, visible badge, root Step interleaved with Stages, adjacent same-Stage flow, adjacent and skipping cross-Stage flow, branch, join, and disconnected chain. It must remain readable enough to isolate defects.
2. **Ordering/ownership:** source order contradicts `PRECEDES`; mixed root Stage/Step order; within-Stage `CONTAINS` edge-line order; multiply-contained Step proving first-parent plus validation evidence.
3. **Exceptional topology:** backward edge, annotated cycle, unannotated cycle diagnostic as applicable, self-loop, and root-Step transitions.
4. **Identity:** duplicate same-endpoint `PRECEDES` relationships with distinct properties/annotations and stable occurrence identity.
5. **Dense/compressed:** crowded branch/join endpoints, overlapping candidate spans, narrow Stage/inter-Stage/root gutters, and enough occupancy to force bounded expansion.
6. **Profiles:** the same badge-bearing Step under simple, permissive, and strict.

Fixtures isolate one failure family where possible. The primary case proves composition; focused cases diagnose mechanics. No broad corpus promotion occurs before all focused cases pass.

### Executable hard assertions

- Every adjacent route-point pair has equal x or equal y.
- No route intersects a non-endpoint Step box.
- No route enters source or target interior beyond its legal terminal approach.
- No route intersects a Stage header or badge block.
- No cross-Stage route traverses an unrelated Stage interior.
- Arrow-ended routes preserve the shared minimum readable terminal leg when geometry permits; fallback is diagnosed.
- Competing same-orientation overlapping spans are separated by at least 16px.
- Crowded endpoint offsets are distinct, at least 16px apart where space permits, and ordered by adjacent prepared stems with stable priority fallback.
- Every projected `PRECEDES` edge maps to exactly one unique stable final route; no scene-only or omitted edge.
- Stage/root-Step global order and each Stage's Step order match author/edge-line order at RendererScene, pre-routing, and final stages.
- Boundary gates avoid headers, remain ordered, and a root-owned edge does not enter unrelated Stage interiors.
- Occupancy coordinates differ from nominal/template coordinates in the compressed proof and the same changes appear in final route geometry.

### Blocking human rubric

At normal preview size, reviewers must explicitly mark pass/fail for: clear left-to-right reading; direct canonical forward tracks; separated branches and legible join convergence; peripheral backward/cycle handling; edge identity at crossings/crowded endpoints; intentional Stage chrome, whitespace, empty/single-Stage treatment and alignment; readable labels/badges; and consistent ports/boundary gates. Every substantial pass reports satisfied invariants, violated invariants, and acceptability. A hard failure cannot be waived by subjective preference.

## 9. Linear gated implementation sequence

Only one gate may be in progress. A gate begins only after the previous gate's evidence is accepted. Each accepted gate gets a focused checkpoint/commit; do not squash away review boundaries before closeout.

### Gate 0 — Authority, drift, and protected baseline

**Objective.** Reconfirm this inventory immediately before implementation and lock the protected baseline.

**Rationale/references.** Sections 2–4; architecture §§2–5, 13, 21; `AGENTS.md` authority and stop policies.

**Prerequisites.** This plan approved; clean understanding of unrelated workspace changes.

**Scope.** Read-only inspection of all authority files, `journeyMap.ts`, `journeyMapRenderModel.ts`, author-order helpers, preview/capability/corpus files, named tests, and protected staged modules. No production/test/fixture/artifact writes.

**Actions.** Record bundle fields and generic consumers; confirm cited symbols/tests exist; capture `git status --short` and protected-file hashes/diff; identify unrelated changes; run current focused journey projection/render/profile/capability/CLI baselines; record the two known drift items and any new mismatch.

**Artifacts.** Gate report only: source-role table, exact baseline commands/results, protected files, drift decisions.

**Automated acceptance.** Existing focused tests pass without updates. **Human review.** Reviewer confirms authority hierarchy and no hidden conflict.

**Pass/fail.** Pass only if architecture and current contracts agree materially and scope is unambiguous. Fail/stop on unclear authority, protected behavior already failing, or a contradiction that changes semantics/routing.

**Commands.** `TMPDIR=/tmp pnpm exec vitest run tests/projectionSnapshots.spec.ts tests/render_profile_display.spec.ts tests/viewRenderers.spec.ts tests/cli.spec.ts`; `git status --short`; `git diff --check`.

**Checkpoint.** No commit. **Residual risk.** Narrow semantic tests are still absent; Gate 2 owns them.

### Gate 1 — Proof corpus and acceptance contract lock

**Objective.** Define exact primary/focused fixture content and assertions before routing code.

**Rationale/references.** Sections 8 and 11; architecture §§9–10, 16–18.

**Prerequisites.** Gate 0 accepted.

**Scope.** Test design document/checklist and proposed future paths such as `tests/fixtures/render/journey_map_staged_primary.sdd`, `journey_map_staged_topology.sdd`, `journey_map_staged_duplicate.sdd`, and `journey_map_staged_compressed.sdd`. Do not create broad corpus outputs.

**Actions.** Specify every node/edge/profile and expected first parent/order/owner/archetype; assign each hard assertion and human rubric item to a fixture; define stable expected edge identity; define normal preview size and review capture; define stage/debug filenames.

**Artifacts.** Reviewed fixture matrix, geometry assertion matrix, visual-review form, expected diagnostic matrix. No rendered artifact required.

**Acceptance.** Automated completeness check or review checklist proves every required topology maps to an assertion. Human reviewers confirm the primary case is complex but diagnosable.

**Pass/fail.** Fail if any required archetype lacks isolated evidence, acceptance depends on snapshots, or fixture coordinates preordain routes.

**Stops.** Stop if fixture semantics require bundle/projection changes or authority cannot classify expected behavior.

**Commands.** `rg -n "journey_map" bundle/v0.1/manifest.yaml bundle/v0.1/examples tests/fixtures tests`; `git diff --check`.

**Checkpoint.** Test-design/fixture-contract commit only if repository practice stores it; otherwise reviewed checkpoint. **Residual risk.** Exact visual policy remains provisional until measured output.

### Gate 2 — Typed journey render inputs and semantic regression proof

**Objective.** Add typed badge data and stable edge identity/order while preserving all legacy semantics and output.

**Rationale/references.** Architecture §5; bundle authority; current narrow gaps in section 3.2.

**Prerequisites.** Gates 0–1 accepted.

**Scope.** `src/renderer/journeyMapRenderModel.ts`; new focused journey render-model tests/fixtures. `src/projector/journeyMap.ts` and bundle are read-only unless bundle-sort proof fails and approval is obtained. Legacy DOT/Mermaid goldens must not change.

**Production changes.** Add typed resolved badges to `JourneyRenderStep`; stable `JourneyRenderEdge` ID/type/author order/duplicate ordinal; retain `labelLines` and legacy emitter behavior.

**Actions.** First add characterization tests for first parent, structural stream order, root order, empty/single/Step-only, profiles and duplicates; define deterministic identity from projection/author order plus occurrence ordinal; add typed fields; prove DOT/Mermaid equality; mutation-test bundle display and annotation configuration. Investigate `sort` consumption.

**Artifacts.** Typed model snapshots/data assertions only; no preview.

**Automated acceptance.** Exact order/first-parent/profile/duplicate assertions; projected edge count equals unique model-edge count; IDs stable over repeat runs; legacy text unchanged; a relevant bundle-only mutation changes intended runtime behavior. Human review confirms no semantic policy leaked into renderer-only literals.

**Pass/fail.** Pass only with bundle-dependence proof and unchanged legacy output. Stop if fixing hardcoded sort requires protected projection behavior: report evidence and request approval before proceeding.

**Commands.** `TMPDIR=/tmp pnpm exec vitest run tests/projectionSnapshots.spec.ts tests/render_profile_display.spec.ts tests/render_dot.spec.ts tests/render_mermaid.spec.ts <new-journey-model-suite>`; `TMPDIR=/tmp pnpm run build`; `git diff --check`.

**Checkpoint.** One typed-input commit. **Residual risk.** Scene IDs/ports still need proof.

### Gate 3 — RendererScene construction without semantic routing

**Objective.** Construct backend-neutral, source-ordered journey hierarchy and explicit edge intent without route geometry.

**Rationale/references.** Architecture §§6–7; staged authoring boundaries.

**Prerequisites.** Gate 2 accepted.

**Scope.** New `src/renderer/staged/journeyMap.ts`; journey scene suite and Gate 1 fixtures; shared builders only additively if proven necessary. Protected renderers read-only.

**Production changes.** Root horizontal intent; titled Stage clusters; Step cards; interleaved root Steps; empty Stage chrome intent; typed badge blocks; typed metadata for root/Stage/Step order and ownership; semantic ports; exactly one scene edge per model edge with orthogonal intent and arrow marker.

**Actions.** Build node/container structure first; assert order/IDs/classes/metadata/content; add journey ports; then add edge intents without routes. Keep final geometry, lines, polylines and SVG payload absent.

**Artifacts.** RendererScene snapshot only after structural assertions and review pass.

**Automated acceptance.** Structure/order/first-parent/empty Stage/profile badges; edge exactly-once identity; no forbidden geometry fields; deterministic repeat. Human review inspects semantic snapshot for correct hierarchy/intent.

**Pass/fail.** Fail on inferred adjacency edges, missing duplicate edge, class-parsed structure, or hidden bundle policy.

**Stops.** Stop if shared primitives cannot represent required typed content without a cross-layer hack.

**Commands.** `TMPDIR=/tmp pnpm exec vitest run <new-journey-scene-suite> tests/stagedSceneBuilders.spec.ts tests/stagedRenderer.spec.ts`; `TMPDIR=/tmp pnpm run build`; `git diff --check`.

**Checkpoint.** Scene-only commit. **Residual risk.** Card/Stage proportions and port positions are not accepted until measurement.

### Gate 4 — Measurement and pre-routing placement

**Objective.** Accept readable no-edge structure, wrapping, chrome, placement, and reserved routing space before routing.

**Rationale/references.** Architecture §§7–8, 14; source order owns placement.

**Prerequisites.** Gate 3 accepted.

**Scope.** Journey orchestrator, shared measurement/macro-layout contracts only additively, new pre-routing suite and focused fixture outputs.

**Production changes.** Title/badge measurement, shared width-band/overflow policy, Stage bounds/header, horizontal child/root placement, empty Stage minimum bounds, root alignment, baseline adjacent/Stage/inter-Stage/root gutters. Use `positionMeasuredSceneBeforeRouting(...)` or journey-owned equivalent that leaves semantic edges unrouted.

**Actions.** Prove standard/wide bands and wrapping; place cards/Stages/root items; reserve gutters without edge-driven reordering; render no-edge/pre-routing SVG for review; decide equal-height policy from proof.

**Artifacts.** Accepted `MeasuredScene`, pre-routing `PositionedScene`, and review-only SVG/PNG; snapshots captured after acceptance.

**Automated acceptance.** Font-backed measurements; no clipping/overlap; badge and header boxes distinct; source order stable; pre-routing semantic routes absent; reserved gutters measurable and deterministic.

**Human review.** Long labels/badges readable at normal size; Stage chrome/whitespace intentional; empty/single Stages and mixed root Steps aligned; no-edge journey reads left to right.

**Pass/fail.** Both geometry and human review required. Stop if route complexity is being hidden by changing source order or if shared measurement needs view-specific character heuristics.

**Commands.** `TMPDIR=/tmp pnpm exec vitest run <new-journey-scene-suite> <new-journey-pre-routing-suite> tests/stagedRenderer.spec.ts tests/stagedSvgBackend.spec.ts`; `git diff --check`.

**Checkpoint.** Measurement/pre-routing commit. **Residual risk.** Baseline gutters may expand later; node order/bounds policy remains fixed.

### Gate 5 — Basic explicit PRECEDES routing

**Objective.** Prove dedicated routing foundations on adjacent same-Stage and simple adjacent cross-Stage edges.

**Rationale/references.** Architecture §§9–12; generic router is not assumed sufficient.

**Prerequisites.** Gate 4 accepted.

**Scope.** New `staged/journeyMapRouting.ts` unless the full generic-router exception is proven; basic routing tests and debug renderers.

**Production changes.** Positioned index; typed connector plan/archetype/priority; node-side buckets; initial endpoints; step-2 orthogonal templates; legal exterior approaches; simple Stage gates; final basic reconstruction/validation.

**Actions.** Classify only accepted basic families; assign ports/owner; create pre-routing and step-2 debug artifacts; enforce orthogonality and terminal legs; prove exactly-once coverage; visually accept before broadening.

**Artifacts.** Pre-routing and route-template/step-2 PositionedScene plus SVG; final basic scene for comparison.

**Automated acceptance.** Orthogonality, endpoint exteriority, Step/header/badge clearance, terminal leg, correct Stage gate, stable route/edge count and identity.

**Human review.** Direct forward tracks, clear arrows, consistent east/west ports, no needless bends.

**Pass/fail.** Fail if two-point diagonal, silent fallback/omission, or generic route lacks required debug/control seams. Stop rather than generalize a failing basic route.

**Commands.** `TMPDIR=/tmp pnpm exec vitest run <new-journey-pre-routing-suite> <new-journey-routing-suite>`; `git diff --check`.

**Checkpoint.** Basic-router commit. **Residual risk.** Long/exceptional routes and contention deliberately remain unsupported or diagnosed.

### Gate 6 — Route archetypes and boundary ownership

**Objective.** Route all topology families correctly before solving dense contention.

**Rationale/references.** Architecture §§8.3, 10–12.5.

**Prerequisites.** Gate 5 accepted.

**Scope.** Journey router, focused topology fixtures/tests/debug artifacts only.

**Production changes.** Non-adjacent same-Stage bypass; long cross-Stage/root routes; root-Step routes; branch/join topology; backward/cycle/self-loop peripheral routes; lowest-common-container ownership; ordered Stage-boundary gates; unrelated-Stage avoidance; distinct duplicate policy.

**Actions.** Implement and accept one family at a time in this order: same-Stage skip, long cross-Stage/root, branch, join, backward, cycle, self-loop, duplicate. For each: template, geometric assertions, debug SVG, human review, then generalize shared classification.

**Artifacts.** Step-2 and provisional route artifacts for every archetype; owner/gate metadata snapshots; intentional diagnostics.

**Automated acceptance.** All hard obstacle/ownership assertions; source order unchanged; branches/joins cover all identities; boundary crossings/gates deterministic; cycles/self-loops orthogonal with clear target leg; no unrelated Stage traversal.

**Human review.** Canonical forward paths remain direct; exceptional paths peripheral; branch identity and join convergence clear; duplicate identity understandable.

**Pass/fail.** Each family blocks the next. Stop on proof-specific coordinates, source reordering, external-engine pressure, or Stage traversal used as a shortcut.

**Commands.** `TMPDIR=/tmp pnpm exec vitest run <new-journey-routing-suite> <new-journey-visual-suite>`; `git diff --check`.

**Checkpoint.** Prefer separate reviewed commits per high-risk family, ending with an all-archetype checkpoint. **Residual risk.** Dense occupancy may still collapse otherwise correct templates.

### Gate 7 — Occupancy, endpoint ordering, and bounded gutter expansion

**Objective.** Make contention resolution real, deterministic, separated, and geometry-affecting.

**Rationale/references.** Architecture §12; routing is the primary revision hotspot.

**Prerequisites.** Gate 6 accepted.

**Scope.** Journey router, compressed/dense fixtures, routing tests; additive shared helper only with protected regressions.

**Production changes.** Endpoint buckets/offsets; provisional routes; occupancy records for node sides, adjacent gaps, Stage-local bypasses, inter-Stage gutters, root bypass, boundary gates, obstacle swerves, and stems; locked coordinates; bundle/segment displacement; late endpoint ordering; fixed 16px separation; bounded Stage/root expansion; rerouting; final reconstruction from resolved coordinates.

**Actions.** Extract occupancy from provisional routes; resolve overlapping spans by deterministic priority; rebuild endpoints from prepared stems; compute overflow; expand whole affected structures in bounded loops; rebuild index and reroute; reconstruct final route; validate. Never merely rerun midpoint templates.

**Artifacts.** Step-2 route-template, step-3 occupancy/gutter, prepared-route/late-order data where useful, expansion-attempt diagnostics, and final PositionedScene/SVG. Step-3 must visibly and numerically differ where contention exists.

**Automated acceptance.** At least 16px competing-span/endpoint separation; occupancy changes final coordinates; locked endpoints/gates remain legal; bounded attempts deterministic; expansion shifts whole structures without order change; final route reconstructed from resolved tracks; all hard assertions remain green.

**Human review.** Dense branches/joins remain traceable; parallel tracks look intentional; expansion creates useful whitespace; no merged trunks hide edge identity.

**Pass/fail.** Fail if occupancy is debug-only, tracks collapse, labels/chrome hide defects, or bounded expansion silently exhausts. Stop and report before snapshots.

**Commands.** `TMPDIR=/tmp pnpm exec vitest run <new-journey-routing-suite> <new-journey-visual-suite> tests/scenarioFlowRouting.spec.ts tests/outcomeOpportunityMapRouting.spec.ts tests/stagedServiceBlueprint.spec.ts` when shared files changed; `git diff --check`.

**Checkpoint.** Occupancy/expansion commit. **Residual risk.** Diagnostics/profile/final cross-case visual consistency remain Gate 8.

### Gate 8 — Diagnostics, profiles, and final focused visual acceptance

**Objective.** Accept the complete focused renderer across profiles and all proof archetypes.

**Rationale/references.** Architecture §§14–18; diagnostics cannot normalize proof failure.

**Prerequisites.** Gate 7 accepted.

**Scope.** Journey orchestrator/router diagnostics, profile tests, staged visual harness additions, all focused proofs.

**Production changes.** Stable error/warn/info diagnostics with phase/edge/item context. Errors: unresolved endpoints, intrusion, diagonal, header/unrelated Stage crossing, duplicate scene ID, edge omission/duplication. Warnings: bounded expansion exhaustion, unavoidable crossing/separation loss, exceptional fallback, archetype fallback. Info: Step-only/disconnected/peripheral cycle/first-parent context where useful.

**Actions.** Exercise simple/permissive/strict badge behavior; add negative/degraded fixtures; run all geometry assertions; render every proof at normal size; conduct blocking human review; report satisfied/violated invariants explicitly and iterate without golden refresh.

**Artifacts.** Final focused PositionedScene and review SVG/PNG per archetype/profile; sorted diagnostics snapshots only for intentional cases.

**Automated acceptance.** Full hard rubric; no forbidden diagnostics in accepted proofs; expected intentional diagnostics stable; permissive/strict badges visible and simple hidden; repeat-run determinism.

**Human review.** Every item in section 8 is explicitly passed. Any violation means gate failure even with green tests.

**Stops.** All global stops apply, especially silent omission, diagonal routes, intrusion, header crossing, unrelated traversal, collapsed tracks, or snapshots proposed to conceal them.

**Commands.** `TMPDIR=/tmp pnpm exec vitest run <all-new-journey-suites> tests/stagedVisualAcceptance.spec.ts`; repeat deterministic renders and compare hashes; `git diff --check`.

**Checkpoint.** Focused visual-acceptance commit/report. **Residual risk.** Public backend/corpus wiring not yet enabled.

### Gate 9 — SVG/PNG and public preview integration

**Objective.** Register the accepted SVG-first renderer through normal backend/capability/CLI/helper flows while retaining explicit legacy preview.

**Rationale/references.** Architecture §§18.3, 20; section 3.3 inventory.

**Prerequisites.** Gate 8 accepted with signed visual rubric.

**Scope.** Journey SVG/PNG wrappers; `previewBackends.ts`, `renderArtifacts.ts`, `viewRenderers.ts`, relevant CLI/helper help and tests; no corpus promotion yet.

**Production changes.** Add `staged_journey_map_preview`; projection-source backend; staged SVG/PNG capabilities/defaults plus legacy alternatives; normal diagnostics; CLI/helper behavior. PNG must call the SVG-derived shared path.

**Actions.** Add backend ID/type; register renderer; advertise capabilities/defaults; test explicit legacy, staged default, `--dot-out` fallback, SVG/PNG, diagnostic mapping, helper forwarding/materialization; update current help wording. Explicitly decide and document that the unrelated missing outcome ID in `authoring/contracts.ts` is out of scope unless separately approved.

**Artifacts.** Temporary integration SVG/PNG only; no committed broad corpus artifacts.

**Automated acceptance.** Capability selection; staged default; legacy selectable; PNG nonempty and derived from same SVG; CLI/helper generic paths; normal diagnostics; no Graphviz requirement for default staged preview.

**Human review.** Public output matches Gate 8 accepted SVG at normal size; backend selection does not alter geometry.

**Pass/fail.** Fail on journey-specific CLI semantic branches, loss of legacy selection, parallel PNG rendering, or diagnostic loss.

**Commands.** `TMPDIR=/tmp pnpm exec vitest run tests/viewRenderers.spec.ts tests/previewWorkflow.spec.ts tests/cli.spec.ts tests/authoringDirectoryServices.spec.ts tests/helperCli.spec.ts tests/helperCli.integration.spec.ts <new-journey-backend-suite>`; `TMPDIR=/tmp pnpm run build`; `TMPDIR=/tmp pnpm sdd show <primary-fixture> --view journey_map --out /tmp/journey-map.svg`; `git diff --check`.

**Checkpoint.** Public integration commit. **Residual risk.** Committed goldens/corpus/docs still reflect legacy status until Gate 10.

### Gate 10 — Goldens, corpus promotion, regression, and closeout

**Objective.** Capture accepted evidence, promote journey from preview-only, verify regressions, and hand off reviewably.

**Rationale/references.** Acceptance-before-snapshots policy; architecture §§18–22.

**Prerequisites.** Gates 0–9 accepted; no unresolved hard/visual failures.

**Scope.** Journey stage snapshots/SVG goldens, rendered corpus/generator/tests, current docs/help, full verification. Historical Done docs unchanged.

**Production/test/docs changes.** Promote journey in `renderedCorpus.ts`; add journey debug generation branch only for meaningful stages; update generator README checklist and corpus tests; remove preview-only label; preserve legacy backend siblings; update current toolchain docs; capture accepted scene/measured/pre-routing/step-2/step-3/final/SVG/diagnostic evidence.

**Actions.** Capture focused stage snapshots in order; confirm step progression; generate journey corpus and inspect scope before accepting broad regeneration; verify legacy siblings; run focused routing, shared-file regressions, full tests/build/generation; review final corpus visually; report invariant status and changed-file inventory.

**Required artifacts.** `RendererScene`, `MeasuredScene`, pre-routing PositionedScene, route-template/step-2, occupancy/step-3, final PositionedScene, final SVG, PNG derivation assertion, intentional diagnostics. Broad corpus follows focused acceptance only.

**Automated acceptance.** Deterministic LF artifacts; complete corpus; all focused and full suites/build pass; protected renderer outputs unchanged; no unexpected generated churn.

**Human review.** Final focused and representative corpus SVG/PNG pass section 8 rubric. Debug stages show meaningful progression and occupancy visibly affects final geometry.

**Pass/fail.** Fail if regeneration masks defects, debug stages are nominal, protected outputs move, or full tests reveal drift. Revert artifact refresh—not accepted code—to last accepted checkpoint and return to owning gate.

**Commands.** See section 10 matrix; minimally `TMPDIR=/tmp pnpm test`, `TMPDIR=/tmp pnpm run build`, `TMPDIR=/tmp pnpm run generate:rendered-examples`, focused reruns after generation, `git diff --check`, and changed-file audit.

**Checkpoint.** Separate evidence/corpus/docs commit after implementation commits. **Residual risk.** Legacy removal remains a separate task.

## 10. Verification command matrix

Use repository root and `TMPDIR=/tmp` for every Node/Vitest command that may create temporary files. Replace placeholder journey suite names with the exact names locked in Gate 1.

| Concern | Command |
| --- | --- |
| Build/typecheck | `TMPDIR=/tmp pnpm run build` |
| Journey semantics/legacy | `TMPDIR=/tmp pnpm exec vitest run tests/projectionSnapshots.spec.ts tests/render_profile_display.spec.ts tests/render_dot.spec.ts tests/render_mermaid.spec.ts <journey-model-suite>` |
| Scene/measurement/pre-routing | `TMPDIR=/tmp pnpm exec vitest run <journey-scene-suite> <journey-pre-routing-suite> tests/stagedRenderer.spec.ts tests/stagedSceneBuilders.spec.ts tests/stagedSvgBackend.spec.ts` |
| Routing/geometry | `TMPDIR=/tmp pnpm exec vitest run <journey-routing-suite> <journey-visual-suite> tests/stagedVisualAcceptance.spec.ts` |
| Shared routing regression, if shared files changed | `TMPDIR=/tmp pnpm exec vitest run tests/scenarioFlowRouting.spec.ts tests/outcomeOpportunityMapRouting.spec.ts tests/stagedServiceBlueprint.spec.ts tests/stagedVisualAcceptance.spec.ts tests/stagedMacroLayout.spec.ts` |
| Capability/backend/CLI | `TMPDIR=/tmp pnpm exec vitest run tests/viewRenderers.spec.ts tests/previewWorkflow.spec.ts tests/cli.spec.ts` |
| Helper integration | `TMPDIR=/tmp pnpm exec vitest run tests/authoringDirectoryServices.spec.ts tests/helperCli.spec.ts tests/helperCli.integration.spec.ts` |
| Corpus | `TMPDIR=/tmp pnpm exec vitest run tests/renderedCorpus.spec.ts` |
| Generate corpus, Gate 10 only | `TMPDIR=/tmp pnpm run generate:rendered-examples` |
| Public smoke, after build | `TMPDIR=/tmp pnpm sdd show <primary-fixture> --view journey_map --out /tmp/journey-map.svg` and repeat with `--format png`/explicit legacy backend as supported |
| Full suite | `TMPDIR=/tmp pnpm test` |
| Whitespace | `git diff --check` |
| Scope/protected audit | `git status --short`; `git diff --name-only`; compare Gate 0 protected hashes/goldens |

Do not run corpus generation as a convenient way to fix expected-output failures. Inspect any generated change before retaining it.

## 11. Snapshot, golden, and corpus policy

- No snapshot refresh precedes semantic, geometric, and human acceptance for its stage.
- Capture RendererScene only after Gate 3 structure acceptance; measurement/pre-routing after Gate 4; step-2 after Gate 5/6 archetype acceptance; occupancy/step-3 and final after Gate 7/8 acceptance; final SVG/corpus after Gate 9.
- Required complex-case snapshots are RendererScene, MeasuredScene, pre-routing PositionedScene, route-template/step-2, occupancy/step-3, final PositionedScene, final SVG, and intentional diagnostics. PNG is asserted as SVG-derived; store PNG only where corpus policy requires it.
- Debug stages must differ meaningfully. Occupancy records must change resolved coordinates and final routes in the dense case.
- Goldens record accepted output; they do not decide whether output is good.
- Broad corpus regeneration occurs only in Gate 10, after focused corpus acceptance. Preserve explicit legacy siblings while staged becomes default.
- Stored text uses canonical LF and deterministic ordering. Review generated diffs for accidental unrelated churn.

## 12. Diagnostics and degraded-output policy

Diagnostics use shared `scene|measure|layout|routing|backend` phases, `error|warn|info` severity, stable ordering, and edge/item context.

- **Error:** missing/unresolved final Step endpoint; duplicate scene edge ID; projected-edge omission or duplication; diagonal orthogonal segment; source/target or non-endpoint intrusion; Stage-header/badge crossing; unrelated-Stage traversal.
- **Warning:** bounded expansion exhaustion; unavoidable crossing after deterministic alternatives; lost 16px separation; exceptional fallback port/gate; preferred archetype fallback. Warnings never waive a proof-case hard failure.
- **Info:** Stage-less/Step-only view; disconnected chains placed solely by source order; intentional peripheral backward/cycle handling; first-parent selection when validation already reports multiple containment. Avoid noise for ordinary direct routes.

The final gate report lists every emitted diagnostic, why it is acceptable, and which proof triggers it. An accepted primary proof should have no fallback/error diagnostics.

## 13. Stop and escalation conditions

Stop the active gate, preserve evidence, and request direction when:

- desired behavior requires unapproved parser, compiler, validator, projection, bundle, or schema change;
- a machine-readable rule belongs in the bundle but cannot be expressed or bundle mutation does not affect runtime behavior;
- source order must change to clean up routing;
- routing depends on raw `.sdd`, CSS classes, SVG parsing, or proof-specific coordinates;
- ELK or any external placement/routing engine appears necessary;
- occupancy does not influence final tracks;
- labels or Stage chrome merely hide merged/intersecting routes;
- a proof retains diagonal orthogonal routes, node intrusion, endpoint entry, Stage-header crossing, unrelated-Stage traversal, collapsed tracks, or silent edge omission/duplication;
- existing staged renderer behavior would need modification;
- snapshots/goldens would need refresh to conceal failure;
- authority is unclear or current code contradicts a fixed architecture decision;
- bundle-sort drift requires a projection behavior change; or
- unrelated authoring backend typing cleanup becomes necessary to integrate journey.

The stop report includes authority citation, smallest reproducer, stage/debug artifact, satisfied and violated invariants, attempted safe alternatives, and the exact approval/contract decision needed. Do not continue into a later gate.

## 14. Risks and containment

| Risk/revision hotspot | Containment |
| --- | --- |
| Router works for a chain but collapses under arbitrary topology | Gates 5–7 separate basics, archetypes, and contention; every family gets isolated geometry and human acceptance before generalization |
| `PRECEDES` accidentally becomes placement authority | Source-order assertions at scene, pre-routing, final, and contradiction fixture |
| Duplicate edges collide or disappear | Gate 2 stable occurrence identity; exactly-once assertions at every downstream stage |
| Cross-Stage routes cut through chrome/other Stages | LCA ownership, explicit boundary gates, header/interior assertions, skip proof |
| Branch/join endpoint inversion | Provisional stems, late endpoint ordering, fixed offsets, focused fan-out/fan-in review |
| Occupancy becomes decorative | Dense fixture must show nominal-to-resolved coordinate and final-geometry change |
| Expansion destabilizes layout | Bounded deterministic loop, whole-structure shifts, order assertions, exhaustion diagnostic |
| Shared helper changes established renderers | Additive-only changes, Gate 0 protected baseline, focused existing-renderer regressions, no migration |
| Snapshot-driven acceptance | Acceptance matrices precede artifacts; human review blocks; corpus deferred to Gate 10 |
| Long labels/badges distort routing | Gate 4 accepts measurement/chrome before routing; header/badge boxes become obstacles |
| Hidden bundle defaults | Gate 2 bundle mutation proof and explicit projection-change stop |
| One-pass overpromise | Linear family-by-family routing checkpoints; failed family blocks generalization |

## 15. Closeout evidence and handoff format

The implementation handoff must lead with outcome and include:

1. Gate ledger with acceptance date/reviewer/checkpoint for Gates 0–10.
2. Authority/invariant table marking each invariant satisfied or violated; no silent omissions.
3. Exact bundle file(s) governing behavior, runtime consumption path, and bundle-dependence tests.
4. Changed-file inventory grouped by production, tests/fixtures, accepted goldens/corpus, and current docs; explicit confirmation protected renderers are unchanged.
5. Proof-corpus matrix with route families, stage artifacts, geometry results, diagnostics, and human verdict.
6. Routing design summary: identities/priorities, ownership/gates, template families, occupancy/displacement, endpoint order, expansion bound, reconstruction and validation.
7. Verification commands and results, including full suite/build/corpus generation, deterministic rerun, whitespace check, and protected regression results.
8. Public integration evidence: staged default, explicit legacy fallback, SVG-first PNG, CLI/helper behavior, and normal diagnostic mapping.
9. Remaining warnings, deliberate degradations, deferred work, and explicit statement that legacy removal is not part of this implementation.
10. Links to the primary final SVG/PNG, each meaningful debug stage, and the focused tests that enforce hard geometry.

The handoff must not call the renderer complete if any hard invariant or blocking human review fails. In that case, it reports the last accepted gate and returns work to the owning gate.
