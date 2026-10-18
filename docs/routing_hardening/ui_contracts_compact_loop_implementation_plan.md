# Implementation plan: UI Contracts compact loops and bounded layout negotiation

2026-10-17. Execution plan for GPT-6.1 Sol with High reasoning effort. The [implementation record](ui_contracts_compact_loop_implementation_status.md) tracks execution and verification; writing this plan alone did not establish completion.

Read the [architecture](ui_contracts_compact_loop_design.md) first. It defines the intended behavior and acceptance contract; this plan defines implementation order, code ownership, verification, and completion criteria. Read the [scope correction](ui_contracts_routing_scope_correction.md) before consulting older prototypes. Follow the repository's [AGENTS.md](../../AGENTS.md).

## Mandate and limits

Implement the production architecture through final enablement and verification. Do not stop after adding types, producing another design, passing a synthetic loop test, or completing the first proof. The gates below control sequencing; they are not requests for additional user approval. Continue through all gates unless a concrete architectural contradiction or external blocker prevents it. Report that contradiction accurately rather than silently weakening an invariant.

The user explicitly permits subagents using **GPT-6.1 Sol**. Keep the coordinating thread on **GPT-6.1 Sol, High reasoning effort**. Delegation is optional; use it for bounded tasks with disjoint file ownership after the relevant interfaces are settled. The coordinator owns integration and the final visual verdict. Do not create additional user-visible chats or new prototypes as substitutes for implementation.

The result must solve the actual three-transition failure while preserving DG-002's working pair. The approved geometry and all architectural requirements are in the architecture document; do not reopen the visual direction. Preserve the existing fork/merge presentation, parser/compiler/validator/projection behavior, v0.1 behavior, and LEGACY output. Do not introduce ELK, synthetic bars, global label-driven port spacing, or fixture-specific routing branches.

## Starting state and first actions

Expected checkout when this plan was prepared:

- Repository: `/home/knut/projects/sdd`.
- Branch: `codex/prototype-ui-contracts-routing`; HEAD: `7b49a59` (`Use existing compact loop geometry in focused prototype`). Recheck this; never reset the checkout to match it.
- Pre-existing edit: `src/renderer/staged/routing-prototype/ALLOCATION.md`.
- Pre-existing untracked documents: this plan, the architecture, and `ui_contracts_routing_scope_correction.md` in this directory. Preserve them. Temporary handoff material is under `/tmp`.
- This chat and the implementation chat use the same local project checkout. The handoff author will stop editing after dispatch. Recheck status for any subsequent user changes before editing or committing.

Run from repository root. Use Node 22 and `TMPDIR=/tmp`. If Node/pnpm is missing, follow AGENTS.md's nvm/Corepack instructions. Do not change global CLI preferences. Inspect nested AGENTS.md files if present before changing their directories.

```sh
git status --short
git branch --show-current
git log -1 --format='%h %s'
TMPDIR=/tmp pnpm run build
TMPDIR=/tmp pnpm exec vitest run tests/stagedUiContracts.spec.ts tests/uiContractsTopology.spec.ts tests/uiContractsRoutingOptimization.spec.ts tests/routingOrderedPortPair.spec.ts tests/routingPortCorridorSeed.spec.ts
```

Record actual baseline results, including pre-existing failures. Do not label them regressions without comparison. The commands above have **not** been run as implementation validation by the planning thread. Many existing UI tests load v0.1: they are useful compatibility tests but cannot establish the new v0.2 path works.

Create `ui_contracts_compact_loop_implementation_status.md` beside this plan. Keep a compact table: step, implemented behavior, commands/results, satisfied invariants, violated invariants, evidence paths, next step. Update after substantial passes, not every edit. Distinguish code completed from output accepted. If the turn is compacted, resume from this table and the actual diff.

Do not bulk-stage unrelated edits. Any local commits must contain only the intended implementation, its tests, and relevant documents. A push, PR, or repository cleanup is not part of this handoff's deliverable.

## Read map: existing code and reusable mechanisms

All paths in this table are relative to repository root. They exist at the starting revision; proposed new files are identified separately below. Search by symbol if line numbers shift.

| Responsibility | Read/change points |
| --- | --- |
| UI public render functions | `src/renderer/staged/uiContracts.ts`: `buildUiContractsRendererScene`, `renderUiContractsStagedSvg`, `renderUiContractsStagedPng` |
| Bundle contract and loading | `bundle/v0.2/core/views.yaml`; `src/bundle/types.ts`; `src/bundle/uiContractsPresentation.ts`; `src/bundle/validateLoadedBundle.ts` |
| Prepared occurrence model | `src/renderer/uiContractsPresentationModel.ts`: `UiContractsPresentationModel`, `UiContractsSequence`, `buildUiContractsPresentationModel` |
| Scene construction | `src/renderer/staged/uiContractsPresentationScene.ts`: `UiContractsSceneBuilder`, `sequence`, `layeredSequence`, `scope`, `complete`, `relationshipSegments` |
| Return and junction construction | `src/renderer/staged/uiContractsTransitions.ts`: `returnEdges`, `withUpperReturn`, `branchRegion`; `uiContractsFanout.ts`: `buildUiContractsFanout` |
| Current competing passes | `src/renderer/staged/pipeline.ts`; `uiContractsRouting.ts`: `routeUiContractsScene`, `buildEndpoint`, `deriveSideFromRoute`, `validateUiContractsRoutes`; `uiContractsLabels.ts` |
| Stage contracts/cloning | `src/renderer/staged/contracts.ts`: scene/measurement/positioning types, `ViewMetadata`, `EdgeViewMetadata`, both clone functions, `LayoutIntent`, `RendererRoutingEvidence` |
| Actual measurement/reflow | `src/renderer/staged/microLayout.ts`: `measureRendererScene`, `measureNode`, `measureNodePorts`, `normalizeMeasuredSceneSharedSizes`, `reflowMeasuredSceneContainers`; `sharedNode.ts`: `measureSharedNode`, `reflowMeasuredSharedNode` |
| Asynchronous positioning | `src/renderer/staged/macroLayout.ts`: `positionMeasuredSceneBeforeRouting`, `positionMeasuredEdgesAgainstRoot`, stack/linear/packed layout |
| Port and loop geometry | `src/renderer/staged/routingCore/{portCapacity,orderedPortPair,bounds,candidates}.ts` |
| Route search and fixed claims | `src/renderer/staged/routingCore/{lifecycle,occupancy,reconstruction,qualitySelection,optimization}.ts` |
| Capacity calculations | `src/renderer/staged/routingCore/{capacity,exteriorCapacity}.ts`; `connectorLabelLayout.ts` capacity and clearance functions |
| Labels/markers | `src/renderer/staged/connectorLabelLayout.ts`, `connectorLabelPlacement.ts`, `labelCollisionGeometry.ts`, `markerGeometry.ts` |
| Artifact gate | `src/renderer/staged/svgBackend.ts`; `diagnostics.ts`: `RendererArtifactError`; `src/renderer/previewBackends.ts`: request/result contracts and error mapping; `previewWorkflow.ts` |
| Comparable production orchestration | `src/renderer/staged/iaPlaceMapRouting.ts`: trial isolation, shared budgets, accepted revision retention. Read relevant functions, not a wholesale source copy. |

Useful existing tests: `uiContractsPresentationModel.spec.ts`, `uiContractsTopology.spec.ts`, `uiContractsComplete.spec.ts`, `uiContractsContainer.spec.ts`, `uiContractsRefinements.spec.ts`, `uiContractsB5Scopes.spec.ts`, `uiContractsFanoutProof.spec.ts`, `uiContractsSouthExitSwap.spec.ts`, `uiContractsLabelRepair.spec.ts`, `stagedUiContracts.spec.ts`, `routingCore.spec.ts`, `routingCorePortCapacity.spec.ts`, `routingOrderedPortPair.spec.ts`, `routingPortCorridorSeed.spec.ts`, `routingQualityBudgetAllowance.spec.ts`, `routingQualityBalanced.spec.ts`, `sharedNodeRenderer.spec.ts`, `sharedNodeEmphasis.spec.ts`, `stagedMacroLayout.spec.ts`, `stagedSvgBackend.spec.ts`, and `previewWorkflow.spec.ts`, all under `tests/`.

## Implementation structure and dependency direction

Keep the current public SVG/PNG functions. Add an internal asynchronous coordinator, preferably `src/renderer/staged/uiContractsPipeline.ts`. It prepares the presentation model once, constructs each candidate scene using the same prepared input plus requirements, measures, positions, allocates, routes, places labels, audits, and returns an accepted or failed outcome.

Suggested internal organization:

- `uiContractsRoutingInventory.ts`: typed inventory preparation, relationship/path provenance, and declared owner information. Reuse existing contracts where possible.
- `uiContractsAcceptance.ts`: read-only complete-scene audit. Both coordinator and backend call it; it must not import either caller or invoke repair.
- `uiContractsCapacity.ts`: maps actual violations and measured envelopes to declared layout resources. Shared geometric capacity arithmetic stays in `routingCore`/shared label machinery.
- `uiContractsPipeline.ts`: queue, branch isolation, capacity ledger, budgets, and outcome selection. Keep geometry algorithms out of its main loop.

These filenames are guidance, not a requirement to add empty abstraction layers. Do not export a dozen test hooks or build a pluggable router framework. Share a concrete helper when IA and UI need the same behavior; do not move UI semantics into generic helpers.

Avoid an import cycle. The current scene builder imports `measureScene` from `pipeline.ts`; the new coordinator must not cause builder → pipeline → coordinator → builder recursion. Move that measurement dependency to `microLayout.ts` or a neutral stage helper without changing measurement semantics. The backend can depend on acceptance; acceptance cannot depend on SVG serialization.

The accepted result must contain mutually matching `RendererScene`, `MeasuredScene`, and `PositionedScene` revisions. Never return the last attempted measured scene alongside an earlier accepted positioned scene. Preparation input, branch ledger, and output evidence have distinct lifetimes. Use typed discriminated outcomes, not optional `success` flags spread across objects.

## Step 0 — Establish the production proof and preservation checks

**Do before changing routing behavior.**

1. Read `src/renderer/staged/routing-prototype/FOCUSED-COMPARISON.md`, `focused-comparison-evidence.json`, the captured `evidence.json`, and `dg002.svg`. Inspect `docs/ia_place_map_hardening/manual_review_2_evidence/self-loop.compact.svg` and its companion JSON. Preserve all historical evidence.
2. Load `aeb_help_center_de_astra.sdd` with `bundle/v0.2/manifest.yaml`, compile, project, and prepare through the production functions. Select `scope:P-360005333058` by prepared identity for the focused test. Inspect the helper `/tmp/sdd-transition-probes.mjs` if available, but do not make tests depend on `/tmp`.
3. Add a small reusable test fixture/helper, e.g. `tests/uiContractsCompactLoopFixture.ts`. It must obtain the actual two-state transition data and prepared labels through production preparation. Use a committed source fixture only if necessary for test isolation, retain source provenance, and assert its intended membership. Do not paste positioned prototype geometry into runtime or make every test compile the entire large document.
4. Test the working pair separately from the three-transition case. For DG-002 use the production named-diagram preparation path, so membership excludes the loop for the authored reason. Do not simulate DG-002 by a runtime exception for its ID.
5. Establish normalized geometry comparison by relationship provenance and node semantic identity. Whole-region translation is allowed. Compare node dimensions/content, pair endpoints, intermediate points, labels, markers, and styles. A changed edge ID caused by replacing fragments is not a visual regression; changed routing is.
6. Save baseline run details in the status document. The known current three-transition failure is expected; do not turn its failure into a passing golden or change diagnostics severity.

**Gate 0:** the test fixture independently distinguishes DG-002's two relationships from the full region's three, and detects a changed pair route or label. No new production behavior is claimed.

## Step 1 — Bundle policy, validation, and transport

Implement architecture §3 before relying on new behavior. Do not enable the new block in the normal v0.2 bundle yet.

1. Add typed optional `UiContractsPresentationConfig.routing` using the exact proposed policy shape. Supported `capacity.owner` values are `fixed` and `padding_and_adjacency_gaps`; supported `capacity.node` values are `fixed` and `port_minimum`.
2. Extract the existing IA traversal/side-trial structure into a reusable type/validator if that removes duplication. Preserve IA's accepted optional fields and behavior. UI's shape, label mode, and ordered cost fields must be explicit rather than filled by hardcoded UI defaults.
3. Validate through `uiContractsPresentationProblems` and `validateLoadedBundle`. Cover malformed present blocks, empty/duplicate side trials, sides that are not tangent to traversal, unsupported values, and duplicate/missing/unknown selection criteria. Accept absence of the entire block for compatibility; do not treat malformed data as absence.
4. Carry the resolved policy into the presentation model and scene metadata. Update cloning, measurement, positioning, and any code that narrows metadata so it survives every stage. Keep coordinates and search history out of scene intent.
5. During development, use validated copies of the loaded bundle in new tests to add the policy, with `node: fixed` for Steps 2–5. This must use the production config resolver, not test-only routing branches. At enablement the same data will live in the actual v0.2 YAML.
6. New tests, e.g. `tests/uiContractsRoutingPolicy.spec.ts`, must cover both loaded-bundle rejection and runtime consumption. Complete behavioral mutation tests as their consuming steps land: reversed equal-fit trial order, changed traversal, fixed owner capacity, and fixed node capacity.

**Gate 1:** policy survives to the renderer; missing policy retains existing behavior; invalid policy cannot silently fall back. Existing v0.1 and IA policy tests remain valid.

## Step 2 — Complete transition paths and independent attachments

Implement architecture §4. This is the representation change that removes the root fragment problem.

1. Persist expected node occurrences and relationship representations from `UiContractsSceneBuilder.complete`. Use exact prepared relationship/occurrence IDs and source order. Record explicit structural representations separately from routed paths; do not require an arrow for a relationship already intentionally represented by ownership/nesting.
2. Under the new policy, replace `withUpperReturn`'s five-edge emission with one complete edge per ordinary return. Keep semantic return classification and the existing forward-node arrangement. Generate its complete initial polyline after positioning from declared attachment/owner information. No coordinates or encoded SVG in the scene contract.
3. Create/retain a transition-region owner even for a self-loop-only sequence. Assign `ownerContainerId` deliberately. Do not infer label ownership from the deepest common ancestor of two identical endpoints.
4. Include ordinary forward, return, and self-loop endpoints in the inventory. Preserve label preparation, styles, expected markers, and relationship multiplicity. Do not allocate only forward ports and silently give all returns a shared default port.
5. Declare ordered physical segment references for existing fork/merge, containment, and fanout paths. A shared physical segment appears once in the painted scene; multiple logical paths can reference it. Where the current temporary `relationshipSegments` map cannot prove direction/order/continuity, enhance the builder's registration at the point it knows that topology. Do not recover it by parsing edge ID strings.
6. Resolve node-side attachments from node geometry, declared side, port offset, and marker clearance before candidate construction. Bind junction endpoints from declared junction identity/direction. Do not call `deriveSideFromRoute` on the enabled path.
7. Use the pre-routing macro-layout entrypoint for candidate layout. `measureEdge` currently preserves symbolic endpoints and measured labels; allocate actual endpoints afterward. Do not run the old UI route-repair chain as an initialization side effect.
8. Add coverage and endpoint tests, e.g. `tests/uiContractsRoutingInventory.spec.ts`: duplicate/missing ordinary path, broken segment order, omitted shared trunk, wrong junction, changed expected marker, and lost provenance must be rejected.

**Gate 2:** the new path produces complete ordinary transitions; the DG-002 pair retains its normalized geometry and full labels. Existing junction presentations retain their shape and representation. A missing fragment or wrong terminal cannot pass merely because a relationship ID exists in a map.

## Step 3 — Fixed route constraints, compact loop, and complete audit

Implement architecture §§5 and 9 on the focused case before general search tuning.

### Shared fixed-route support

Add an optional shared fixed-route constraint to the routing connector contract (or extend an existing equivalent mechanism). Default omission must preserve other renderers' behavior. A fixed connector still contributes its complete segments, blockers, endpoint checks, and crossings; it simply cannot be displaced during that trial.

Propagate the constraint through lifecycle cloning, occupancy assignment, corridor/terminal alternatives, reconstruction, quality proposals, and canonicalization. Skipping one candidate generator is insufficient if occupancy can still move the route. Add a shared test in `tests/routingFixedRoutes.spec.ts`: a movable route avoids a fixed route, an infeasible scene returns failure with the fixed route unchanged, and toggling fixed status changes candidate identity. Do not mark all scene routes fixed globally.

### Compact candidate

1. Use the shared ordered-pair allocator and readable pitch/clearance helpers. Reserve actual occupied endpoints on the candidate side before allocating the loop. Apply bundle-declared direction and pair placement.
2. Keep the working pair fixed in the focused proof. Place the loop's complete full label outside the compact rail using shared label geometry. Its width never sets the pair spacing or rail depth.
3. Assess each permitted side from the same baseline. The accepted proof's south trial must pass local checks; its north trial must retain the actual collision/association rejection against the working return. No hardcoded rejection by side name.
4. Implement one complete audit that combines coverage, independent attachment binding, fixed-route preservation, compact shape, route validity, label preservation/association, markers, ownership, and export containment. Return structured findings; do not mutate or repair.
5. Treat missing labels as errors using expected inventory, not a loop over labels that happen to remain. Compare full prepared text with wrapped output using the shared text-preservation helper. Keep marker footprints in collision context and independently audit painted arrows.
6. Build validation permissions from declared physical sharing. Remove the broad same-target final-segment exemption from the enabled path. Existing compatibility behavior can retain its old checks until it is intentionally retired; do not accidentally change v0.1.

At this step, local geometry can pass while owner bounds fail. Preserve the measured capacity deficit as an expected finding until Step 4. Do not declare the normal artifact accepted by enlarging its crop or omitting containment from the audit.

Add `tests/uiContractsCompactLoop.spec.ts` with theme-default proof checks, occupied-port behavior, a collision-free but label-sized invalid loop, reversed traversal, omitted/detached label, wrong attachment, and marker intrusion. Runtime derives dimensions from theme helpers; default-theme tests may assert the accepted 23-unit pitch and 17-unit depth as evidence, alongside a changed-theme case proving they are not constants.

**Gate 3:** compact shape and complete local geometry reproduce the accepted comparison; bounds deficits remain explicit. A broad enclosing loop fails even if no collision is detected. The original pair remains unchanged up to translation.

## Step 4 — Owned capacity and actual reflow

Implement architecture §§6–7 with fixed node sizes first. This step must turn the local proof into a real scene that contains the label and moves following content.

1. Define internal resource keys for owner padding, actual linear adjacency gaps, and later node extent. Prefer structured keys or one canonical key function; do not scatter string splitting across modules. Verify each key against the scene tree and supported layout strategy.
2. For every candidate, derive capacity requests from its actual route/label/marker envelope and shared clearance. Classify the reason. A collision with a route that would move together with the loop is not a padding deficit.
3. Keep simultaneous-occupant measurement separate from request merging. Measure concurrent tracks/labels by spans using shared helpers, then convert deficits into absolute minimum resource targets. Merge same-resource lower bounds with `max`. Never add equivalent requests repeatedly or combine mutually exclusive sides.
4. Apply each branch's ledger to a fresh scene built from the prepared model. Recompute baseline-derived layout values, then use `max(fresh natural resource, requested minimum)`. Do not edit positioned coordinates. Round required capacity conservatively using shared metric precision.
5. Pass the modified scene through production measurement and `positionMeasuredSceneBeforeRouting`; rebind attachments and generate fresh seeds/labels. Enforce the proof's pair/card preservation on this result. A bigger viewport alone must fail.
6. Use the transition region as the loop-label owner. Growing it must affect subsequent local contracts, the scope bounds, and later sections/rows through the existing layout tree. Treat packed rows as packed rows: `gapAfter` cannot create an imaginary resource between nonadjacent packed items.
7. If a request names an unsupported owner/layout, return `unsupported_capacity_owner` for that branch. Do not fall back to root padding or shift arbitrary siblings by hand.

Add `tests/uiContractsCapacityReflow.spec.ts`. Cover actual two-state proof with a following section, an owner inside a packed row, nested scope headers, multiple requests for one padding resource, independent resources, concurrent label lanes, and rejected top/bottom ledger isolation. Include a no-op demand whose relevant realized geometry does not change. Assert sibling displacement and container containment, not merely a larger root height.

The captured 80-unit demand is a cross-check for the identical captured baseline. Production demand must be measured from production ownership/bounds. Explain any difference through those measurements; never tune an 80-unit constant into code.

**Gate 4:** production SVG for the full affected scope fits the accepted loop and full label; later content reflows; fixed pair/card invariants pass. No ordinary success is produced by bypassing the full audit.

## Step 5 — Bounded async coordinator and deterministic failure

Implement architecture §8. Integrate the previous mechanisms into one asynchronous operation, not additional post-processing passes.

1. Define a prepared immutable input, per-branch capacity ledger and attachment choices, one aggregate search budget, a finite/lazy work queue, and `bestAccepted`. Retain complete matching scene-stage triples for accepted revisions.
2. Schedule baseline side assessments before expensive recovery can consume the allowance. For multiple loops, lazily enumerate complete assignments in stable source order, with round-robin service at equal search depth. No eager Cartesian-product allocation and no greedy “first locally valid loop wins” rule.
3. Keep the shared route lifecycle synchronous and use it without its layout-expansion callback. The outer coordinator performs asynchronous rebuilds. Deduct all consumed candidate/repair work across branches and retries, including rejected branches; reuse the shared quality allowance mechanism where appropriate.
4. Define exact counters in code comments and evidence: attachment/side proposal, route proposal, label proposal, repair, expansion. A proposal is charged once at its owning level. Nested route trace charges must not be double-counted by the outer level. Count finite interval scans as bounded work within an allocation proposal; charge alternate allocations separately.
5. Preserve existing defaults from shared constants rather than duplicating 4096/128/4 in UI code. Add opt-in allowance plumbing to label proposal generation if needed so it cannot reset an unbounded search on every retry. Omitted new allowance options must preserve existing callers.
6. Audit an already constructed seed even if no search budget remains. Do not call `runRoutingLifecycle` with zero candidates; its current `Math.max(1, ...)` would invent work. Validate limits as finite nonnegative integers before queue construction.
7. Before queueing, canonicalize policy, attachment choices, and sorted absolute requirements. After rebuilding, detect repeated realized geometry using bounds, bindings, routes, labels, and markers. Include the fixed-route constraint and owner policy. Use stable data, not callback identities, diagnostic histories, or locale-dependent sorting.
8. A repeated/no-progress branch terminates locally; other branches continue. A realized capacity rebuild beyond baseline consumes the shared expansion allowance even if later rejected. Merge all justified deficits for one revision before rebuilding so one independent deficit is not needlessly charged per loop.
9. Only fully accepted candidates enter the cost comparison. Read cost ordering from the bundle. Count unique capacity-resource growth once; do not also count propagated ancestor growth. For multiple loops, represent side preference deterministically in source order and document the comparison. Retain stable final tie-breaking.
10. If a later branch fails/exhausts, keep the earlier best accepted scene. Its diagnostics contain preparation findings plus its final audit, not every rejected error. Record rejected findings in evidence. If no scene is accepted, return the typed terminal reason with a diagnostic revision, concrete findings, unresolved requests, and budget totals.

Add `tests/uiContractsRoutingLifecycle.spec.ts`. Mandatory cases: no fitting side with fixed capacity; owner growth success; repeated no-op growth; unsupported resource; zero candidate/repair/expansion allowance; one side cannot starve the other before seed assessment; multiple loops interact; rejected branch cannot mutate baseline; accepted candidate survives later exhaustion; finite stop with a meaningful failure reason. Tests must control actual constraints/budgets, not mock the acceptance function into always returning true or false.

**Gate 5:** both valid and invalid scenes terminate deterministically, share budgets, and yield coherent outcomes. The real proof passes through the new coordinator. No fallback returns a success-shaped failed scene.

## Step 6 — Minimum card growth through shared measurement

Implement architecture §§6–7's node-capacity capability only after the fixed-card proof works. Permission to grow cards exists; the old prototype's resizing formulas are not the method.

1. Extend shared port allocation to return a realizable minimum extent or a specific ordering/capacity failure. Implement the finite forbidden-start-interval calculation described in the architecture. Maintain fixed reservations within a trial, side/corner insets, marker-derived separation, and rigid relative offsets for the compact pair.
2. Respect ordering bounds. If `before_other_arrivals` leaves no permissible interval before a fixed arrival, widening the far end cannot solve it. Try another permitted allocation/side or fail that branch. Do not keep widening until a budget happens to end.
3. Add optional per-occurrence measurement minima to the shared measurement path. Validate finite nonnegative dimensions. Pass identical requirements through scene-builder preliminary measurements, fanout preliminary measurements, and final scene measurement. Defaults must preserve every existing caller.
4. In `measureSharedNode`, resolve width before decorator/title/attribute wrapping; derive height afterward from natural content, theme minimum, requested minimum, and the branch's original-height floor. Recompute measured text blocks, backgrounds, ports, and any shared-size group dependencies. Do not mutate the global theme or reuse width-stale measured blocks.
5. Revisit existing builder calculations tied to measured sizes, especially `layeredSequence`, `branchRegion`, and `buildUiContractsFanout`. The fanout builder currently throws when its source-port capacity is exceeded. The enabled production path must translate real capacity shortages into typed requirements rather than leave an uncaught exception or allocate off-card ports. Preserve the compatibility path's established output.
6. Node minima are indexed by rendering occurrence. Do not unintentionally grow every depiction of a semantic node. Shared-size groups may propagate size only where the existing group contract requires it; record/test that propagation.
7. Keep external label requirements in owner padding/gaps. The loop's full label must not enter node width, terminal pitch, or an unrelated region's port demand.

Add `tests/sharedNodeMinimumExtent.spec.ts` and extend the shared port-capacity tests. Verify title/decorator/attribute wrapping at increased width, height-only growth, dense/plain content placement, port bounds, shared groups, and unchanged no-minimum output. Add integrated UI tests where actual crowded attachments need growth and a tall unrelated label does not change the card. Test bundle `node: fixed` versus `port_minimum` on the same input.

**Gate 6:** growth is justified by real port demand and is measured/painted through production code. No stale text/port bounds, global pitch dependency, or unsupported ordering is hidden by extra size. Only now may test and final bundle policies permit `node: port_minimum`.

## Step 7 — Artifact gate and diagnostic preview

Wire architecture §9 through all relevant callers, not only the CLI's final suppression check.

1. `renderUiContractsStagedSvg/Png` use the dedicated pipeline when the loaded policy is present; without it, retain compatibility. An accepted outcome proceeds to serialization. A failed normal outcome raises/maps structured renderer diagnostics via existing `RendererArtifactError`/`PreviewArtifactRenderingError` conventions.
2. `renderPositionedSceneToSvg` performs the read-only UI audit on the exact enabled scene before publishing and rejects error-severity findings. Keep a surviving policy/inventory marker through all clones so a missing inventory is an error, not an excuse to bypass acceptance. Never trust only a cached accepted flag.
3. Preserve a narrow explicit diagnostic-artifact intent through `RenderPreviewArtifactRequest`, staged settings/options, and the backend. `previewWorkflow` derives it only from the existing combined-view force behavior; normal callers default to accepted output. Do not make `--force` downgrade diagnostics or repair/mutate the scene.
4. A diagnostic artifact carries an explicit diagnostic designation and errors. The existing named-diagram suppression behavior remains. Invalid context may have no coherent scene to draw; in that case even force returns diagnostics without fabricating geometry.
5. PNG uses the same accepted/diagnostic SVG and audit. It must not invoke a separate route search or bypass checks. Normal output failures must not write a partial artifact or accidentally advertise a stale file as new success.
6. Remove enabled-path calls to the old `routeUiContractsScene -> repairPositionedSceneRoutesAroundNodes -> repairUiContractsLabels` chain. Keep compatibility-only code where required. Do not simply stop calling validators to make the old chain appear obsolete.

Extend `tests/stagedSvgBackend.spec.ts` and `tests/previewWorkflow.spec.ts`, or add `tests/uiContractsPublication.spec.ts`. Use a genuinely invalid scene to test normal suppression versus explicit force; the existing force test uses a clean fixture and does not prove this behavior. Mutate an accepted positioned scene's endpoint, label, marker, and inventory individually and confirm direct SVG export rejects it. Test named diagram force suppression and PNG behavior.

**Gate 7:** no normal public path can publish an enabled invalid UI artifact. Explicit diagnostic output remains available with error status. The successful proof reaches actual SVG/PNG through production entrypoints.

## Step 8 — Compatibility, bundle enablement, and final evidence

1. Test actual existing fork/merge/fanout and containment builders, including physical shared segments and repeated semantic identities. Exercise primary ViewState sequences, secondary State sequences, multiple loops on one node, separate transition owners, and ordinary returns. The old prototype's rectangular-bar fixture is excluded as evidence.
2. Run compact/detailed and none/type/type,id decorator variants on representative fixtures. Keep the exact accepted proof on compact + type,id. Inspect affected output at readable scale, including the pair/loop crop and surrounding following content. Use existing browser/image tooling appropriately; do not design another comparison UI.
3. Complete loaded-bundle mutation tests: equal-fit side order, traversal direction, fixed owner capacity, and fixed node capacity. Show that a bundle-only change changes intended runtime behavior.
4. Add the architecture's final routing block to the actual v0.2 `ui_contracts_presentation` only when all required mechanisms are integrated. Do not add it to v0.1. Re-run the public proof using the unmodified loaded production bundle, without test policy injection.
5. Run the affected regression suites and then the full suite. Investigate failures against baseline. Do not repeatedly run broad suites while a focused invariant is still failing. Do not delete meaningful coverage to make the suite green. Obsolete fragment-specific implementation assertions can be replaced after equivalent end-to-end behavior is covered.
6. Verify the shared changes do not alter IA/scenario-flow/journey/service/outcome output unintentionally. Keep IA's existing policy behavior intact; the new shared constraint and measurement options must be opt-in.
7. Only after acceptance, update necessary UI downstream snapshots/evidence. Review each change for the cited invariants. Preserve the original failed/accepted prototype artifacts as historical evidence. Do not regenerate the entire rendered corpus to normalize a local change.
8. Record final commands, outcomes, and evidence in the status document. Add concise technical documentation for the new routing policy and internal coordinator; update the architecture's implementation status accurately. Keep implementation detail out of the user-facing documentation website unless a user-visible setting needs explanation.

**Gate 8:** the final v0.2 bundle activates the implemented behavior; the actual full-sheet and DG-002 outputs pass; compatibility and final publication tests pass; the visual inspection supports the same conclusion as the tests.

## Verification commands and evidence protocol

New test filenames above are proposed files to create, not tests already present. Adjust commands only if you deliberately choose different filenames and record that mapping. Run `pnpm run build` after TypeScript changes before a CLI command, because `pnpm sdd` executes `dist/cli/main.js`. Direct Vitest runs do not replace the TypeScript build.

Recommended focused implementation suites:

```sh
TMPDIR=/tmp pnpm run build
TMPDIR=/tmp pnpm exec vitest run tests/uiContractsRoutingPolicy.spec.ts tests/uiContractsRoutingInventory.spec.ts tests/routingFixedRoutes.spec.ts tests/uiContractsCompactLoop.spec.ts
TMPDIR=/tmp pnpm exec vitest run tests/uiContractsCapacityReflow.spec.ts tests/uiContractsRoutingLifecycle.spec.ts tests/sharedNodeMinimumExtent.spec.ts tests/routingCorePortCapacity.spec.ts tests/routingOrderedPortPair.spec.ts
TMPDIR=/tmp pnpm exec vitest run tests/uiContractsPublication.spec.ts tests/stagedSvgBackend.spec.ts tests/previewWorkflow.spec.ts
```

Before final acceptance, run the existing UI regression files listed in the read map, shared routing/measurement tests, and the other affected staged renderers. Finish with:

```sh
TMPDIR=/tmp pnpm test
git diff --check
```

Generate actual production evidence with explicit invocation settings. These final commands are expected to succeed without force after implementation:

```sh
mkdir -p /tmp/sdd-ui-contracts-production-proof
TMPDIR=/tmp pnpm sdd show aeb_help_center_de_astra.sdd --bundle bundle/v0.2/manifest.yaml --profile simple --view ui_contracts --detail compact --decorators type,id --format svg --out /tmp/sdd-ui-contracts-production-proof/full.svg --diagnostics json
TMPDIR=/tmp pnpm sdd show aeb_help_center_de_astra.sdd --bundle bundle/v0.2/manifest.yaml --profile simple --diagram DG-002 --detail compact --decorators type,id --format svg --out /tmp/sdd-ui-contracts-production-proof/dg002.svg --diagnostics json
TMPDIR=/tmp pnpm sdd show aeb_help_center_de_astra.sdd --bundle bundle/v0.2/manifest.yaml --profile simple --view ui_contracts --detail compact --decorators type,id --format png --out /tmp/sdd-ui-contracts-production-proof/full.png --diagnostics json
```

The original full-sheet failure can be slow. Use the focused production fixture while developing; do not rerun the full CLI failure on every edit. If a final run exceeds a reasonable test timeout, investigate the bounded-search counters before raising timeouts or budgets. A finite candidate count can still hide expensive unbounded proposal generation; include that work in your analysis.

Save a production positioned-scene JSON and structured acceptance report beside the artifacts via a small test/evidence driver that calls public production functions. Include source hash, code revision/diff identity, bundle policy, settings, node/relationship counts, selected side, actual capacity targets, budget totals, rejected-side findings, and final audit findings. Do not use the prototype HTML generator as the production renderer.

For the exact focused comparison, verify the full loop label, two 224-by-53 default-theme cards if measurement inputs remain identical, same-edge negative traversal, 23-unit pitch, 17-unit depth, three transitions/three terminal arrows, and unchanged pair geometry up to translation. Treat those dimensions as input-specific evidence, not universal constants. If an input or theme has changed, identify the change rather than silently accepting a different proof.

## Optional subagent work packages

The user authorizes GPT-6.1 Sol subagents. The parent remains responsible for reading both documents and coordinating shared contracts. Use High effort for substantive implementation/review. With `collaboration.spawn_agent`, an explicit model override requires `fork_turns: "none"`; supply the absolute document paths, relevant excerpts/decisions, exact task, and file ownership. Use `model: "gpt-6.1-sol"`, `reasoning_effort: "high"`. Alternatively inherit from this GPT-6.1 Sol parent where supported and verify the resulting configuration. Do not substitute another model.

Safe candidates after agreement on interfaces:

| Package | Ownership | Must not do |
| --- | --- | --- |
| Bundle contract | `src/bundle/types.ts`, `uiContractsPresentation.ts`, shared bundle validation, policy tests | Enable YAML early; independently invent scene contracts; change IA defaults |
| Shared fixed routes | `routingCore` constraint propagation and its tests | Edit UI coordinator/contracts without coordination; weaken route validation |
| Measurement minima, after Gate 4 | `sharedNode.ts`, `microLayout.ts`, dedicated tests, agreed options | Apply prototype sizing formulas; change theme defaults; independently change builder call sites |
| Independent final review | Read-only review of implementation vs both documents and actual proof output | Edit acceptance expectations to match output; claim visual acceptance from test counts alone |

Assign each edited file to only one active agent. `contracts.ts`, the coordinator, builder integration, publication integration, and proof acceptance should have one coordinator-owned integration point. If two packages need a shared type, settle it first; do not merge contradictory versions afterward. Share current interface decisions explicitly because agents started without history will not know them. Do not spawn separate user-visible threads for these subtasks.

## Failure handling and completion checklist

When a step fails, inspect the smallest production reproduction and classify the failure as policy, inventory, attachment, geometry, measurement, ownership, search/budget, or publication. Fix that responsible layer. Do not retune side preference to conceal label failure, increase global spacing to avoid understanding ownership, or convert an error into a warning. If a chosen strategy contradicts the invariants, stop that strategy and report the contradiction with the scene and finding; continue independent authorized work where possible.

Completed and verified on 2026-10-17; commands, results and evidence are in the
[implementation record](ui_contracts_compact_loop_implementation_status.md). The
following checklist records the final implementation acceptance:

- [x] Final v0.2 bundle policy is present, validated, transported, and consumed; mutation tests prove authority.
- [x] Ordinary return/self-loop relationships have complete paths and independently bound endpoints.
- [x] Accepted compact-loop appearance and the preserved DG-002 pair hold in production output.
- [x] Full label/marker bounds fit actual owners; following content reflows correctly.
- [x] Port-driven card growth uses consistent preliminary and final production measurement.
- [x] Branches are isolated; budgets are cumulative; repeated/no-progress/exhausted search terminates with accurate results.
- [x] Earlier accepted revisions survive later failure; all returned stages describe that same revision.
- [x] Coverage, route, label, marker, shape, and containment audits run on exact exported geometry.
- [x] Normal invalid output is blocked; explicit diagnostic output retains errors and existing named-diagram behavior.
- [x] Existing junction presentations, v0.1, LEGACY, and other affected renderers pass compatibility checks.
- [x] Necessary tests/build and actual CLI proofs pass; final visuals were inspected; snapshots were updated only after acceptance.
- [x] Status document distinguishes verified behavior from remaining limitations and links the evidence.

The final response should state what changed, the exact production proof result, what was tested, any remaining failure/limitation, and links to the produced SVG/PNG and status document. If a core box above remains unchecked, report the implementation as incomplete. Do not describe a locally passing crop as successful full-sheet rendering.
