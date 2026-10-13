# IA place map routing quality recovery

Status: **implemented and accepted, 2026-10-13**. See
[execution evidence](routing_quality_execution.md) and [SVG proofs](routing_quality_evidence/README.md).
The user's SVG-only instruction supersedes this plan's PNG proof commands.
Prepared 2026-10-12 against
`276d28b239028c0a71a8aec4ba091e5147282af5`; working tree was clean before this file.
Paths below are repository-relative. Re-read current code and `AGENTS.md` before execution.

## Start here: authority, scope, invariants

The [manual review](manual_review_routing_failures.md) rejects the previous visual
acceptance. `implementation_evidence.md` is historical evidence, including failed
images; its “all invariants satisfied” claim is superseded by that review. The old
implementation plan describes work already present: do not recreate occurrence
identity, label formatting, or the IA routing adapter.

| Source and role | Non-negotiable requirement |
| --- | --- |
| `AGENTS.md`: architectural guardrails | Preserve `projection → RendererScene → MeasuredScene → PositionedScene → SVG → PNG`; geometry stays downstream of projection. Shared geometry belongs in shared infrastructure. No ELK. |
| `bundle/v0.2/core/contracts.yaml`: semantic authority | Preserve selected source occurrences, event/guard annotations, duplicate warnings, and allowed containment. Do not invent nested Area semantics. |
| `bundle/v0.2/core/views.yaml`: view authority | Preserve hierarchy, authored structural order, exact references, presentation templates/detail visibility, and singleton containment/navigation fusion. New spec-owned policies must flow through the loaded bundle. |
| `AGENTS.md`: acceptance authority | Prove the cited cases before generalization or golden refresh. Independent tests and normal-scale visual review are both required. Report satisfied/violated invariants after each substantial pass. |
| Manual review, `evidence/`, proof fixtures: visual evidence | Correct every listed failure class. Rejected pixels are a baseline, never a target. Fixtures must not select special production behavior. |

Scope: opted-in v0.2 IA staged SVG and SVG-derived PNG, compact/detailed, combined,
named, API/CLI/helper paths. Preserve parser/compiler/validator/projection behavior,
v0.1, unrelated renderers, and LEGACY DOT/Mermaid/Graphviz output. Keep IA's existing
stack/follower hierarchy and node order; owned spacing may change. This is not a
macro-layout replacement or a six-renderer migration.

## Current execution path and concrete reusable solutions

`loadBundle` → `buildIaPlaceMapRendererScene` in `src/renderer/staged/iaPlaceMap.ts`
→ `runIaPlaceMapRendererPipeline` in `iaPlaceMapRouting.ts` →
`renderPositionedSceneToSvg/Png` in `svgBackend.ts`. The backend already invokes
`auditIaPlaceMapFinalScene` and rejects fatal IA diagnostics. Public preview enters
through `src/renderer/previewBackends.ts:renderPreviewArtifact`; helper preview is
`src/authoring/preview.ts`. Preserve exact-reference preflight at public boundaries.

Unless qualified, filenames below are under `src/renderer/staged/`.

| Existing code | Finding and required use |
| --- | --- |
| `routingCore/portCapacity.ts:allocatePortOffsets`; `iaPlaceMapRouting.ts:allocateOccurrencePorts` | Slots begin at the inset, so the midpoint may be absent. IA makes pitch depend on label dimensions and freezes allocation before reflow. Fix the shared allocation mechanics and IA orchestration. |
| `uiContractsRouting.ts:allocateBottomPorts`, `alignHorizontalTransitions`, `selectUiBottomExits`, `optimizeSouthExitAssignments` | Existing examples of symmetric ports and complete-scene comparison of alternative attachments. Reuse/extract mechanics, not UI selectors or its clamping behavior. |
| `routingCore/optimization.ts:routeCost`, `compareRouteCosts`, `resolveHorizontalSharedY` | Shared costs count crossings/bends/length. Alignment currently handles a particular fan-in/fan-out case; it is not already a general centered allocator. Extend generically where needed. |
| `iaPlaceMapRouting.ts:collectRoutingGeometry`, `buildFinalRoutingContext` | Node margin is only half-stroke plus epsilon (1.5px with current defaults); headers lack a margin; only root bounds constrain routes. Area borders/internal ownership are absent. |
| `scenarioFlowRouting.ts:buildScenarioFlowRoutingStages`; `routingCore/validation.ts`; `tests/routingNodeClearance.spec.ts` | Scenario supplies 16px node margins and axis-sensitive divider blockers. Shared validation already supports `RoutingBox.clearance`, `blocksAxis`, and `appliesToConnectorIds`, including endpoint-leg exceptions. Use these capabilities. |
| `routingCore/lifecycle.ts:runRoutingLifecycle`, `validateFinalRouteSet`; `routingCore/candidates.ts:buildPortCorridorCandidates` | Valid input returns immediately; default `penalize` crossings do not constitute violations. Repair is not visual optimization. Corridor reconstruction excludes topology-bound sharing/run constraints; do not remove those protections. |
| `connectorLabelLayout.ts:assessConnectorLabels`, `auditConnectorLabels`, capacity functions | Existing labels passing the audit are retained; competing-route intersection/relative distance is weaker than readable separation. Capacity chooses a longest-segment anchor and can grow the wrong space. |
| `scenarioFlowRouting.ts:scenarioLabelInput`, `scenarioLabelCorridors`, label correction loop | Working patterns for geometric label scopes, measured capacity, aggregate search budgets, and complete revision snapshots. Do not inherit Scenario's warning-only degraded-label publication policy. |
| `iaPlaceMapRouting.ts:resolveOwnerGap`, `cloneMeasuredWithGapDemands`; `microLayout.ts:reflowMeasuredSceneContainers` | Reuse baseline-plus-absolute-demand reflow; fix ownership/capacity inputs rather than adding arbitrary coordinates or padding. |

## Architectural decisions

1. **Make ownership policy explicit in the bundle.** Add a proposed optional
   `routing_scope` object to `renderer_defaults.ia_place_map` in
   `bundle/v0.2/core/views.yaml`, with `container_node_types: [Area]`,
   `internal_routes: within_common_owner`, and
   `cross_owner_routes: through_common_ancestor`. These are new fields, not existing
   APIs. Extend `RendererIaPlaceMapConfig`, strict `validateIaPlaceMapPolicy`, and
   loading tests first. Absence retains existing ownership behavior. Resolve
   selected container IDs from loaded node-type selectors and projected hierarchy
   in `buildIaPlaceMapRendererScene`; carry IDs/policy through typed scene metadata
   and its clone helpers. Generic routing consumes geometry/IDs, never `Area`,
   `NAVIGATES_TO`, fixture names, or bundle-version strings. Real-loader removal
   or selector mutation must change routing scope without altering projection.
   Validate selectors against included node types and representable scene containers;
   reject unsupported values rather than silently falling back. Keep bundle fingerprints
   and `definitions/v0.2/` explanation consistent with the added policy.
   Numeric distances, candidate algorithms, and centering remain shared renderer
   geometry; no changes to `contracts.yaml` semantics are planned.

2. **Center ordinary attachments; preserve structural grammar.** An unconstrained
   singleton uses the exact side midpoint; multiple ports form a symmetric group
   about it at the minimum legal pitch. Reservations may force a deterministic
   nearest feasible displacement, which must be recorded. Port spacing depends on
   track/marker capacity, not label width/height. Account for all incoming/outgoing
   reservations on a side together; use geometric endpoint order to avoid crossings,
   with authored occurrence order as a stable tie-break. Never merge identities.
   For unequal or offset nodes, try a shared coordinate inside both legal side spans
   before adding bends; minimize displacement from both centers. Apply this on both
   axes, not only UI's existing horizontal case.
   Existing `north_chain`/`south_chain` offsets and segment-specific structural
   trunks are intentional exceptions to ordinary centering. Keep direct structural
   routes direct where their legal anchors align; never exempt their other segments
   from clearance. Recompute allocation after geometry changes, without stale ports.

3. **Enforce local ownership and meaningful margins.** Same-owner routes and labels
   remain inside that owner's content envelope; root owns routes without a common
   selected container. Cross-Area routes may traverse their endpoint Areas and
   ancestor free space, but not unrelated Area interiors. Headers are blockers;
   container interiors are not blanket obstacles. Allow transverse boundary
   crossings for cross-owner routes while enforcing stand-off for parallel runs.
   Add a typed per-connector rectangular routing bound to the shared context for
   internal routes; intersect it with root bounds in candidate generation and final
   validation. Rebuild it from the owner after reflow and retain ownership through
   repair. Do not approximate it with topology-indexed run locks.

   Adopt 16px (the existing shared track pitch and Scenario node margin) for
   route-to-node/header/border and competing parallel-track
   clearance; 0.5px geometric tolerance. Scope border margins refer to interior
   route space. Exempt only actual attachment legs and declared shared segments.
   Preserve `markerRoutingClearance`, painted marker blockers, and marker audits;
   require 16px stand-off from unrelated painted arrowheads. Larger theme geometry
   must increase required space rather than weaken checks. Centralize these metrics
   in shared policy/theme, not IA-local constants.

4. **Select readable candidates explicitly; retain repair compatibility.** Keep
   `runRoutingLifecycle`'s valid-input preservation contract unchanged for existing
   callers. Build an opt-in shared quality-selection service, using
   `routingCore/optimization.ts` and the UI complete-context comparison pattern.
   IA supplies allowed sides, ownership, structural constraints, and gap owners.
   Try centered direct routes, low-bend alternatives, and geometrically ordered
   return attachments before expansion; evaluate the complete affected route set,
   including labels and markers. Invoke bounded repair for invalid candidates.
   Rank fully valid results by crossings, bends, required expansion, port-group
   displacement from center, length, then stable identity. A cheap invalid result
   can never outrank a valid one. Existing aligned singleton/structural routes are
   candidates, not casualties of sequential return-edge routing. Do not use a
   global `forbid` crossing switch as a substitute for selection: arbitrary graphs
   may require crossings. The cited small proofs must eliminate avoidable crossings.

5. **Reserve label space in corridors, independently of ports.** Extend shared
   label assessment/search with opt-in adjacent-label and clearance requirements.
   For IA, labels sit beside their owning segment, not on it; target the existing
   12px own-route distance. Require at least 24px from unrelated routes, using
   `FIXED_LABEL_CLEARANCE`, with own-route association strictly preferred. Retain
   measured-text integrity, marker/node/header clearance, and independent auditing.
   Prefer cross-Area labels wholly in the inter-Area gutter; try above/below anchors
   and alternate route segments before increasing Area top padding. Old labels may
   move when they fail the stronger criteria. Scope and capacity must use the same
   selected anchor. Reuse interval packing: labels with disjoint vertical envelopes
   reuse horizontal capacity (maximum required width, not summed widths). Each
   expansion requires a measured deficit and an actual gap/padding owner. Do not
   expand both headers because a movable label initially overlaps one Area.

6. **One bounded joint solve, with final independent acceptance.** Rebuild from the
   original measured scene plus absolute demands; remeasure ancestors/later siblings,
   ports, blockers, routes, and labels. Use the existing four IA expansion passes
   and `DEFAULT_FINAL_ROUTING_LIMITS` (4096 candidates / 128 repair revisions) as
   aggregate limits across quality trials, repair calls, and label retries. Port-side
   trial search must also be bounded/accounted. Current IA calls reset lifecycle
   budgets per reflow; use Scenario's remaining-budget pattern to close that gap.
   Zero remaining budget must not enter the lifecycle's minimum-one clamp. Cache
   canonical states; save complete coherent revisions and rejection reasons.
   Extend `auditIaPlaceMapFinalScene` and shared audits for the stronger constraints.
   Required-label, ownership, clearance, or proof-quality failures remain errors
   and withhold SVG/PNG, including `force`. Tests must compute their own geometric
   distances/crossings/centers, not just call the production audit again.

All new shared options must preserve existing callers' defaults. Apply them through
the existing enabled IA adapter and loaded scope policy; preserve v0.1's fallback.
Do not copy Scenario/UI routing engines or introduce another IA-only geometry kernel.

## Ordered implementation and gates

1. **Capture the rejection before changing behavior.** Record current HEAD/status,
   source/bundle hashes, and focused baseline results. Preserve `evidence/` unchanged.
   Add proposed `tests/iaPlaceMapRoutingQuality.spec.ts`, with independent geometry
   helpers patterned on `tests/routingNodeClearance.spec.ts` and
   `tests/stagedVisualHarness.ts`. Make the known failures observable as failing
   assertions; keep occurrence/text tests intact. Output candidates only under `/tmp`.

2. **Establish bundle and geometry contracts.** Implement decision 1, typed scope
   metadata/cloning, and shared per-connector bounds/clearance checks. Add real-loader
   positive/negative/mutation cases to `tests/iaPlaceMapHardeningBundle.spec.ts`.
   Prove a same-Area escape fails, a legitimate cross-Area traversal succeeds, and
   repair/reflow cannot discard ownership. Add adversarial final-scene corruption
   checks for close segments, labels, and markers at the SVG boundary.

3. **Pass the single-connector proof first.** Correct shared port allocation with
   reserved-port and odd/even group cases in `tests/routingCorePortCapacity.spec.ts`;
   its current “centred” expectation `[44,60]` on a 100px side is not symmetric.
   Integrate centered direct candidates and adjacent labels. DG-002/DG-003 must pass
   in both details with no needless bend or offset. Preserve legacy structural ports.

4. **Pass the complete parallel proof.** Integrate bounded quality selection and
   joint label/corridor capacity. Combined and DG-001 must satisfy every manual-review
   item in both details, including return-arrow clearance, gutter labels, and compact
   header spacing. Review SVG-derived PNGs at normal scale. Record candidate costs,
   rejected alternatives, and each expansion's owner/deficit; tests alone do not pass
   this gate. Do not broaden fixtures or refresh goldens while it fails.

5. **Pass BillSage, then generalize.** Retain its order, indentation, eight connections,
   three returns, and intentional structural sharing. Order return ports/tracks to
   remove the avoidable double crossings; select a shared legal x-coordinate in the
   facing-side overlap for a straight Overview→Projection route rather than freezing
   today's mismatched anchors. Ensure all internal routes remain
   inside `Projections`. After both proof families pass, cover varied node sizes,
   renamed IDs, translated geometry, longer labels, decorators, three-plus parallels,
   identical duplicates, reciprocal routes, self-loops, multiple incoming sources,
   and legal nested Place ownership. No fixture-ID conditions or coordinate goldens
   as the sole quality oracle.

6. **Close public/compatibility gates and capture evidence last.** Extend existing
   `iaPlaceMapHardeningPublic.spec.ts` for combined/named API, CLI batches, helper,
   `force`, and fatal-audit failures. Keep per-target batch isolation. Run shared
   compatibility suites and full suite. Only after numerical and visual acceptance
   refresh affected v0.2 IA renderer goldens/artifacts; projection snapshots should
   not change. `rendererStageSnapshotHarness.ts` reads stored files: Vitest `-u` is
   not their generator. Do not regenerate the entire corpus. Add a dated correction
   to the old evidence report and update `docs/diagrams/ia-place-map.md` only as part
   of the later implementation; this planning task changes only this plan.

## Acceptance matrix

| Proof | Required outcome, in compact and detailed |
| --- | --- |
| `tests/fixtures/render/ia_parallel_navigation_v02.sdd`, DG-002 / DG-003 | Exactly the selected occurrence and full label; one horizontal segment at both facing-side midpoints within 0.5px for equal aligned nodes. Label adjacent in the gutter. |
| Same fixture, combined / DG-001 | Equal four-navigation inventories; distinct labeled forward paths, neighboring connection, and return. Balanced ordinary attachments, unambiguous labels, required margins, no crossing near arrowheads, no gratuitous detours. Gutter fits labels without avoidable Area-top expansion. |
| `tests/fixtures/render/billSage_structure.sdd`, combined | Eight connections including all returns; preserved source order/indentation/trunks; no internal route leaves `Projections`; no boundary hugging, crowded arrows, avoidable double crossings, or needless five-segment top arrival. |
| Both decorators and broader variants | Same invariants with measured dimensions, no lost annotation text/occurrences, bounded failure diagnostics when genuinely unresolved, deterministic SVG/LF and PNG from that SVG. |

Independently compare proof routes against feasible straight/low-bend alternatives;
do not demand global optimality for arbitrary graphs. For spacing, independently
measure selected label/track envelopes and available gaps: no positive expansion
when those envelopes already fit, and no sum of widths for disjoint label rows.
Check complete strokes/labels/arrowheads against owner and export bounds. Preserve
v0.1 and unrelated output, including existing valid-input/no-op routing tests.

## Verification commands for the implementation chat

Run from repository root with Node 22/pnpm (`source ~/.nvm/nvm.sh` if needed).
These commands were not executed to author this plan. The quality spec is proposed;
omit it from the initial baseline until created.

```bash
git status --short
git rev-parse HEAD
TMPDIR=/tmp pnpm run build
TMPDIR=/tmp pnpm exec vitest run tests/iaPlaceMapHardening.spec.ts tests/iaPlaceMapHardeningBundle.spec.ts tests/iaPlaceMapHardeningGeometry.spec.ts tests/iaPlaceMapHardeningPublic.spec.ts tests/iaPlaceMapRoutingQuality.spec.ts --maxWorkers=4 --minWorkers=4
TMPDIR=/tmp pnpm exec vitest run tests/routingCorePortCapacity.spec.ts tests/routingNodeClearance.spec.ts tests/routingCorridorRecovery.spec.ts tests/routingCorridorTerminalLegs.spec.ts tests/routingHardeningLifecycle.spec.ts tests/connectorLabelLayout.spec.ts tests/connectorLabelPlacement.spec.ts tests/uiContractsRoutingOptimization.spec.ts tests/uiContractsSouthExitSwap.spec.ts tests/routingHardeningScenario.spec.ts tests/routingHardeningOutcomeExpansion.spec.ts tests/routingHardeningService.spec.ts --maxWorkers=4 --minWorkers=4
TMPDIR=/tmp pnpm exec vitest run tests/stagedIaPlaceMap.spec.ts tests/iaPlaceMapSharedNode.spec.ts tests/stagedVisualAcceptance.spec.ts tests/diagramSeparationViews.spec.ts tests/diagramSeparationCli.spec.ts tests/projectionSnapshots.spec.ts tests/previewArtifacts.spec.ts --maxWorkers=4 --minWorkers=4
```

Representative renders (after building):

```bash
TMPDIR=/tmp pnpm sdd show tests/fixtures/render/ia_parallel_navigation_v02.sdd --bundle bundle/v0.2/manifest.yaml --profile simple --detail compact --decorators none --view ia_place_map --out /tmp/ia-quality.compact.combined.svg
TMPDIR=/tmp pnpm sdd show tests/fixtures/render/ia_parallel_navigation_v02.sdd --bundle bundle/v0.2/manifest.yaml --profile simple --detail detailed --decorators none --diagram all --view ia_place_map --format png --out /tmp/ia-quality.detailed.named.png
TMPDIR=/tmp pnpm sdd show tests/fixtures/render/billSage_structure.sdd --bundle bundle/v0.2/manifest.yaml --profile simple --detail detailed --decorators none --view ia_place_map --format png --out /tmp/ia-quality.billsage.detailed.png
TMPDIR=/tmp pnpm test --maxWorkers=4 --minWorkers=4
git diff --check
git diff --name-only
```

Repeat render commands for both details, SVG/PNG, DG-001/002/003 and decorators
`none`, `type`, `id`, `type,id` using `--decorators`. Also exercise combined
`--view all` separately from named `--diagram all`; inspect per-target results.
Run `TMPDIR=/tmp pnpm run docs:build` only if implementation changes site sources.
Graphviz is not required for staged quality; use `pnpm run check:graphviz` before
any separately needed LEGACY smoke test. Do not change LEGACY layout to fix IA SVG.

## Original unresolved gates and stop conditions

The preimplementation gates below are preserved as planning history. They are
closed by the final numerical/visual acceptance and 174-file / 1,932-test run in
the execution report. The stop conditions remain applicable to future changes.

- No product decision blocks baseline tests or the contracts above. **No corrected
  visual proof exists yet.** Exact feasible return-port ordering and the joint
  compact route/label arrangement must be demonstrated; the current audit passing
  does not establish feasibility or quality.
- Shared per-connector owner bounds and the bounded quality-selection coordinator
  do not yet exist. Their API must preserve ownership during repair/reflow and
  aggregate accounting. Do not assume existing run constraints or `routeCost` alone
  provide these capabilities. Resolve these contract gaps before production use.
- Compatibility of stronger IA margins with every structural trunk is unproven.
  If the cited proofs cannot fit through owned spacing and legal attachment
  alternatives while preserving hierarchy, stop with the exact failing geometry
  and proposed architectural revision. Do not silently redesign layout or widen
  sharing exemptions.

Stop and report the violated invariant when further tuning is speculative, semantic
behavior lacks bundle expression, a required occurrence/label disappears, scope or
clearance is weakened to pass, budgets reset/increase, or goldens would conceal a
regression. Search exhaustion is not proof of geometric impossibility. If tests pass
but any manual-review failure remains, report **incomplete/rejected** and leave
canonical evidence untouched. Each implementation report must name satisfied
invariants, violations, remaining gates, and whether the actual images are acceptable.
