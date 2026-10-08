# Routing hardening execution evidence

Started 2026-09-12. Baseline checkout: `9a3c966eba3db788f4770f27093c6c21fb260c56`.
Initial dirty state: only untracked `docs/routing_hardening/` (the supplied plan).
Node `v22.17.0`, pnpm `10.31.0`; `TMPDIR=/tmp pnpm run build` passed.

The implementation plan is the intended acceptance contract; this record reports observed status.

| Stage | State | Evidence / next gate |
| --- | --- | --- |
| 0 | accepted | 48-row matrix and independent oracle agree; exact CLI reproduced all three errors. See baseline evidence below. |
| 1 | accepted | `design_decisions.md`, real geometry acceptance/rejection tests; 20 contract/core tests passed. |
| 2 | accepted | Fixed-track/dependency regressions and Journey checks pass; reviewed root-margin correction below. |
| 3 | accepted | Captured exact + neutral/transpose/reverse/translation, current geometry, bounded repair/expansion/rejection tests pass. |
| 4 | accepted | Matrix, actual repair/rejection/expansion, unchanged snapshots and SVG/PNG review accepted; review findings closed below. |
| 5 | accepted | Full matrix, repair/rejection/marker expansion, focused snapshots and SVG/PNG accepted. |
| 6 | accepted | Full matrix, preserved bypass/branch order and snapshots, actual repair/rejection/expansion and SVG/PNG accepted. |
| 7 | accepted | Full suite run and unrelated failures classified; Journey golden correction rerun passes; 48-case repeat matrix/CLI and final audit complete. |

## Authority and non-negotiable contract

- H1: staged forms and projection boundary remain unchanged ([AGENTS.md](../../AGENTS.md), [migration internal forms](../toolchain/renderer_migration_guidance.md#internal-forms)).
- H2/H3/H5: success certifies complete reconstructed geometry, including terminal spans and unchanged routes; 16px separation with 0.5px tolerance; assignment ownership survives reconstruction ([plan sections 2 and 5](routing_hardening_implementation_plan.md)).
- H4/H7: preserve ports, markers and semantic identity; bundle governs semantic channels/priority. Geometric mechanics remain renderer-owned.
- H6/H8: finite deterministic attempts, explicit failure, preserve valid geometry and existing unrelated behavior.
- H9/H10: independent geometry and SVG/derived-PNG review precede goldens; production repair and rejection are separate gates from synthetic tests.

Normative semantic input: `bundle/v0.1/core/views.yaml` loaded from `manifest.yaml`; architectural guardrails: AGENTS and migration guidance. Existing visual proofs are exemplars, not exceptions to routing policy.

## Baseline production call-path audit

All references describe the starting checkout.

| Caller | Final route-changing boundary | Actual acceptance / discrepancy |
| --- | --- | --- |
| Outcome | `outcomeOpportunityMapRouting.ts`: prepared routes, local displacement, `resolveAndReconstructRouteOccupancy` near 4997 | Assignments are copied into final plans before labels. Failure still exposes original route map. Final shared validation near 5066 detects interactions but filters kinds and uses `minTerminalLeg: 0`; no repair call. |
| Service | `serviceBlueprintRouting.ts`: per-connector compacted/step3 candidate selection, then occupancy near 4075 | Candidate choice checks only node intersection/orthogonality. Occupancy excludes endpoints; final validator near 4163 disables interactions and terminal clearance. Later label creation needs mutation audit. |
| Scenario | `scenarioFlowRouting.ts`: settled prepared routes, occupancy near 3800 | Original routes consumed through fallback map on failure. Labels follow; final validator near 3844 disables interactions and terminal clearance. Existing eight-pass layout expansion occurs before this boundary. |
| Journey | `journeyMapRouting.ts` near 5925 calls `solveRoutingClaims` directly | Retains outward-only ranges, reciprocal/peripheral locks, most-constrained search. Aggregation violations are not passed as `priorViolations`; must be reviewed in Stage 2. |
| IA/UI | generic pipeline scene validation | Existing explicit sharing/container-origin behavior must retain separate compatibility tests. |

Shared discrepancies:

- `lifecycle.ts` has no production caller; it solves stale candidate segments and appends repair observations, without rebuilding span geometry.
- `occupancy.ts` excludes fixed entries unless they overlap a movable same-axis span. It loses endpoint roles and cannot carry ranges/explicit lock reasons from its public input.
- `solver.ts::claimsCompete` requires overlapping coordinate domains, missing clearance-close distinct locks. Fixed coordinate enumeration also omits resource bounds. Failed component search fills absent assignments with nominal coordinates.
- `sceneValidation.ts` gets actual endpoint coordinates from positioned endpoints (good) but has no declared-side or reserved blocker contract.
- Architecture describes ownership of shared coordination; it does not establish adoption. Earlier completion claims require a dated correction at closure.

## Bundle input classification (initial audit)

| Input | Ownership / runtime path |
| --- | --- |
| Semantic channel, edge priority, labels/display detail | Existing bundle fields: `core/views.yaml` connector conventions → `loadBundle` → `ViewSpec` → `src/renderer/outcomeOpportunityMapRenderModel.ts` → staged adapter. Preserve. |
| Node/port arrangement and route templates | View-owned topology derived from bundle semantics, downstream of measurement. |
| Separation, tolerance, interval math, search budgets, span dependencies | Shared geometric renderer mechanics. No grammar or semantic bundle addition needed for these. |
| Resource bounds, headers, reserved lanes | Adapter-owned geometry derived from positioned layout; must be supplied explicitly rather than inferred in core from view names. |
| New channel-specific sharing/crossing/port permissions | Missing semantic policy if needed; requires typed bundle extension and mutation proof before use. No such permission is authorized merely by baseline overlap. |
| Marker leg clearance | Renderer paint geometry plus resolved edge markers; current blanket zero overrides lack documented justification. Stage 1 must define per-end clearance. |

## Current invariant assessment

H1/H7/H9: preserved by read-only baseline work; no golden refreshed. H2/H3/H5/H10: baseline defects verified in source and geometry. H4/H6/H8: partially audited, not accepted. No production adoption gate is accepted yet.

## Stage 0 accepted evidence (2026-09-13)

`capture_baseline.mjs` captured 48 settings with explicit `simple` validation independently of detail. Reproduction prerequisites: `rg --files src bundle/v0.1 > /tmp/sdd-routing-hardening-baseline-files.txt` and `git rev-parse HEAD > /tmp/sdd-routing-hardening-baseline-head.txt`, then `TMPDIR=/tmp node docs/routing_hardening/capture_baseline.mjs`. Complete evidence is `/tmp/sdd-routing-hardening/baseline/{matrix,fingerprint}.json`, with per-case `.scene.json`, `.evidence.json`, `.svg`, `.png` and exact Outcome stage artifacts. Invalid baseline images are diagnostic evidence only, not accepted previews. No golden changes.

| Matrix group (each 2 details × 4 decorators) | Shared + independent result |
| --- | --- |
| Exact Outcome | `none`: 4 separation defects; other decorators: 3. |
| Exact Service | 2 collinear overlaps, hidden by production exclusions. |
| Exact Scenario | Clean. |
| Outcome `multiple_outcomes` | Clean. |
| Service `service_blueprint_slice` | Clean. |
| Scenario `scenario_branching` | Clean. |

All 48 cases pass the separate 12px target-terminal audit. Independent raw geometry agrees with the complete shared interaction checks. Endpoint coordinates in captured scenes originate from rendered routes; they establish a preservation baseline, not independent declared-port correctness. All three production edge builders copy endpoints from routes, so production finalization must instead retain adapter-resolved endpoints before repair. Service's downstream label builder only reads accepted routes.

Exact CLI command from plan §8.2, explicit `simple`, returned exit 1 and three separation errors (1.5/14.5/1.5px); log: `/tmp/sdd-routing-hardening/baseline/cli-outcome.detailed.type-id.log`. No SVG was published by the CLI.

Service risk: `J-040 → J-042` and `J-040 → J-043` depart from the same east-side point (1040,76), sharing 36px. The latter also overlaps the arrival to J-041 by 12px. This is a pre-existing endpoint/candidate defect, not an intentional sharing permission. Stage 5 needs an adapter-owned endpoint candidate correction or must surface the smallest extra dependency; moving bends with those duplicate endpoints frozen cannot remove positive shared departure spans.

Baseline command: `TMPDIR=/tmp pnpm exec vitest run tests/routingCore.spec.ts tests/journeyMapRouting.spec.ts tests/journeyMapBranchJoinRouting.spec.ts tests/journeyMapVisualAcceptance.spec.ts tests/stagedIaPlaceMap.spec.ts tests/stagedUiContracts.spec.ts`: 109 passed, 11 failed. Core (13), Journey routing (63), branch/join (5), visual (13), IA (9) all pass. UI: eight missing `docs/hierarchical_ui_contracts/departure_desk.sdd` cases and three existing snapshot mismatches, independently present before production edits; keep these separate from routing regressions.

Review conclusion: baseline gate satisfied; geometry repair and production adoption remain unaccepted. Astra Medium baseline agent and Astra High contract reviewer saved work but reached account usage limits before final reports. Orchestrator inspected files/results directly and continues locally.

## Stage 1 / Stage 2 evidence

Stage 1 replaces the unused per-connector lifecycle signature with a complete required context and success/failure union; initial validation can preserve valid routes or reject invalid ones, but cannot repair yet. Independent neutral interval tests prove accepted geometry and bounded rejection without a mock validity flag. `design_decisions.md` records ownership, marker policy, budgets and span dependency decisions. Build passes. `/tmp/sdd-routing-hardening/stage1-contract.log`: 20 passing tests. Assignment failures remain explicit in `stage1-red.log` (8 failures, 4 passes) until Stage 2.

Stage 2 corrects clearance-close domain competition, checks fixed resource bounds, retains fixed occupancy, preserves observation bounds/locks, discards failed partial assignments, and forwards Journey aggregation violations. Initial `stage2.log`: 111 passed, two Journey reciprocal expansion-trace assertions failed. The corrected solver moves a root track from Y=183 to Y=195 to clear the locked reciprocal track at Y=179 (old separation 4px). Existing Journey expansion ownership then requests 32px root capacity alongside the existing 32px stage gutter request. Reciprocal routes themselves still match exact coordinate assertions.

A proposed nested-expansion coalescing pass restored reciprocal traces but changed dense Journey from two to three attempts (`stage2-recheck.log`: 103 passed, two dense attempt-count failures). That pass was withdrawn rather than changing tests to accommodate it. Causal baseline/corrected SVG/PNG comparison is in progress. Stage 2 remains unaccepted until this compatibility decision has geometry/visual evidence. H2/H10 production repair remain unimplemented, and fixed detection alone does not repair Outcome.

Stage 2 acceptance supersedes that interim assessment: `/tmp/sdd-routing-hardening/journey-{baseline,corrected}.{json,svg,png}` isolates competition detection. All edges (including labels/markers), node/container children and diagnostics are byte-identical. Only root height changes 229→261. The outer track at Y=215 previously retained only 14px below it, less than `expansionForResolvedTrackGroup`'s 20px margin. Corrected assignment exposes that resource deficit and triggers the existing 32px minimum expansion. SVG/derived-PNG review accepts the additional blank lower margin; no golden refreshed. Two exact expansion expectations and the corresponding root-height assertion now reflect the justified capacity change, with a new independent retained-margin assertion.

`stage2-accepted.log`: all core/acceptance/assignment, Journey visual/branch and 62/63 routing tests pass; the remaining assertion was the old root-height expectation. After correcting that reviewed expectation, `stage2-reciprocal-final.log` passes the remaining test. `stage2-dependencies.log`: 14/14 pass including explicit terminal-to-bend span links and bounded failure. Build passes. Full Journey bounds, directional/reciprocal locks and continuity marks remain unchanged. Source observations preserve allowed/forbidden ranges, resources, endpoint role and lock reason; failure assignments are empty. Final acceptance remains separate from assignment success.

## Stage 3 acceptance

The single route-set lifecycle validates first, considers the existing assignment candidate only under complete acceptance, then enumerates event-derived turn alternatives. Terminal dependencies nominate adjacent movable runs; reconstruction moves both corners, normalization re-extracts runs, and every candidate is checked against all connectors/nodes/resources. New interactions nominate formerly unaffected connectors. Repeated geometry is deduplicated. Bounds and expansion counters are finite, expansion cannot drop connectors/blockers or weaken policy/terminal clearance, and failure has no accepted route map.

`tests/routingHardeningLifecycle.spec.ts` covers reduced H–V–H, transpose V–H–V, reverse, translation, captured exact Outcome, neutral IDs, input reordering, second-resolution stability, contradictory frozen spans, fixed turns, a newly interacting surrounding route (preserved), zero-width normalization, multiple blockers, penalized crossing choice, no expansion owner, post-validation expansion, repeat termination, and exhausted budgets. `tests/fixtures/render/routing_hardening_captured_outcome.json` is captured input evidence, not a refreshed golden. Independent parallel intervals and the existing independent rectangle oracle check outputs separately from production validation.

`stage3-proof.log`: 36 tests pass. `stage3-compatibility.log`: 51 pass with only the same 11 pre-existing UI failures; IA remains accepted. Later core refinements are covered by Stage 4's combined gate run. No grammar, bundle semantic policy, projection, or legacy changes.

## Stage 4 ongoing evidence and preservation decisions

Outcome now supplies independently resolved node/port endpoints through `resolveFinalPlanEndpoints`, the root-owned free-space resource with solid node blockers, semantic priority, explicit side constraints, and per-end shared marker clearance. Prepared compaction locks are coordinate preferences; their endpoint invariants remain independently fixed. Those lock writers are local bundle/obstacle compaction, not new semantic policy. The final route result is consumed once, before labels, and actual emitted routes are revalidated against the same context using the explicit plan-ID → semantic-edge-ID mapping. Failure candidates remain diagnostic-only and the public preview publishes no artifact.

The exact SVG and PNG CLI commands now exit 0 with no errors; `/tmp/sdd-routing-hardening/outcome-production/exact{,-png}-cli.log`, `exact.svg`, `exact.png`. Initial independent visual review accepts distinct terminal tracks, intact ports/markers and readable connector labels. The existing empty Metric column title remains clipped at the right canvas edge as in the baseline; this is unchanged decoration debt, not a routing change.

`stage4-matrix.log`: 18/18 pass (16 explicit simple/detail/decorator rows, real production rejection with contradictory fixed runs, marker-footprint test). Exact nodes/ports/canvas match captured baseline. Only I-010→OP-010 and I-011→OP-010 change their vertical turn positions; every other exact connector remains unchanged.

An initial template-envelope constraint unnecessarily changed two `multiple_outcomes` routes; that proposed bound was rejected because the existing allocated band gutter permits the original assignment. Root-owned free-space bounds plus solid nodes preserve that legal resource. `stage4-preservation-v2.log` passes all canonical/synthetic Outcome stage snapshots unchanged. Shared lifecycle now considers the established assignment candidate, validates it globally and compares it with terminal-aware alternatives. No existing Outcome golden has been refreshed. Final combined visual run and independent reviewer are pending; Service remains untouched until the gate is accepted.


## Stage 4 accepted (2026-09-13)

Independent Astra High review (`stage4_review.md`) found three blockers, all corrected: expansion preserves absolute hard locks/ranges and scoped sharing; Outcome supplies the existing expansion owner with one shared four-pass ceiling; crossing policy is `penalize`. Accepted results retain the accepted layout context, and expansion receives matching current violations. Regression tests cover discarded locks/ranges and continuity-mark input. `stage4-review-fixes.log` records 16 passing core tests (the initial expansion fixture failure was diagnosed and corrected below).

Outcome preparation repeatedly requested two pixels after its last occupied row, which this cell-shifting expansion owner cannot realize. Filtering such ineffective terminal-row/column requests prevents them from consuming the shared budget without moving any diagram geometry. A registered-theme marker-clearance fixture now exercises a real production expansion, full revalidation, emitted-scene ownership, deterministic repetition, and the combined four-pass ceiling. `stage4-expansion-gate.log`: 33/33 pass (Outcome matrix, focused, snapshots, expansion); `stage4-final-build.log`: build passes. No snapshots changed.

`outcome-accepted/` captures all 16 Outcome rows with clean complete shared checks, independent parallel/node oracle and target terminal audit. All captured scenes are identical to the earlier visually reviewed `outcome-production/` revision, including unrelated routes. Exact detailed/type,id PNG was inspected again: routing/markers/labels accepted; pre-existing clipped empty Metric heading remains separate decoration debt. H1–H9 satisfied for the accepted shared/Outcome scope, H10 established for Outcome. Service/Scenario adoption and full-program compatibility remain required.


## Stage 5 accepted (2026-09-13)

Service now uses the same complete coordinator. The old node-clear fallback used step-3 endpoints instead of final endpoint offsets, creating duplicate departure sections; it now reconstructs its existing candidate topology from independently resolved final endpoints. The core accepts axis-aligned two-point `straight` routes while still validating their geometry as orthogonal. Service supplies node obstacles and measured lane/separator title reservations; separator lines remain traversable. Blanket endpoint/interaction exclusions are removed. Emitted routes are checked again before successful rendering.

Preparation and final validation share four expansions. Cumulative requirements are applied to the stable base scene; a real oversized-marker fixture proves final-validation expansion and acceptance. `stage5-gate.log`: 35/35 Service matrix/focused/shared visual tests pass. `stage5-complete.log`: 55/55 core, Service matrix/focused, rejection, and expansion tests pass. `stage5-build3.log`: build passes. Existing Service staged snapshots remain unchanged.

`service-candidate/` contains 16 clean shared/independent/terminal-audit rows; `service-geometry-changes.json` compares baseline geometry. Representative `service_blueprint_slice` retains every route and the complete root. Exact decorated cases change only J-040→J-043, restoring its declared offset. Without decorators the corrected departure also requires moving its parallel corridor and the neighboring J-040→J-042 and J-020→J-021 corridors: otherwise their overlap retains less than 15.5px clearance. Nodes/canvas remain unchanged in all cases. SVG/derived-PNG reviewed for both exact variants and the representative proof; lane topology, labels and markers accepted. H2/H3/H4/H5/H6/H8/H10 established for Service; no new bundle semantic policy or golden updates.


## Stage 6 accepted (2026-09-14)

Scenario resolves declared endpoints from its existing side/offset, horizontal alignment and vertical realization decisions before final candidates. It supplies all node obstacles, measured lane-title reservations and the actual root-owned free space. Its existing canvas sizing includes prepared edge extents; the initial adapter incorrectly used node-only bounds and forced a wide bypass inward. The probe in `scenario-preservation-probe.json` isolated this introduced bounds error. Moving existing route-extent sizing before final acceptance restores the original bypass order and snapshots. An experimental extra adapter assignment step was removed once this cause was corrected; Scenario now has one final coordinator with no assignment-only bypass.

The existing semantic preparation and final capacity callback share eight passes and apply absolute cumulative demands to the stable original layout. Compact branching needs two independent parallel repairs; production tests validate complete geometry and actual published routes. Real bounded rejection publishes no artifact, and an oversized-marker fixture proves final expansion. Final assignment preparation keeps unimplicated connectors fixed while retaining all physical sections in the problem. A most-constrained assignment-order experiment did not materially improve runtime and was withdrawn; lower-level search budgets/order remain unchanged.

`stage6-final.log`: 44/44 pass across the 16-row matrix, actual rejection/expansion, routing, staged snapshots, spacing and shared-node tests. `scenario-accepted/` contains 16 clean shared/independent/terminal-audit captures; `scenario-geometry-changes.json` shows every route and root unchanged from baseline. SVG/derived-PNG reviewed for the exact case and branching proof; branch/decision ports, bypass order, labels and markers are accepted. No goldens changed. Earlier heavily concurrent runs hit five-second test timeouts; the recorded gate uses two workers and a 30-second timeout (compact branching cases take roughly 9–10 seconds). Those limits change test execution only, not renderer acceptance or search budgets.

`stage6-adopter-regression.log`: 81/81 shared, Outcome and Service tests pass, including original Outcome snapshots. Shared review additionally protects expansion input from in-place mutation: owners receive detached geometry/constraint copies so they cannot erase the original hard-lock contract while rebuilding. H10 is now established for all three adopters; Stage 7 verification remains required.

## Stage 7 accepted evidence (2026-09-14)

Final production audit: `final-callsite-audit.txt` finds one shared coordinator and emitted-route revalidation in each adopter. None imports assignment-only reconstruction or disables final endpoint/edge interactions. Journey still calls the lower solver, forwarding aggregation violations; its orchestration is otherwise unchanged. Parser/compiler/projection, semantic bundle files, legacy renderers and IA/UI routing source are unchanged.

Two full 48-case captures, `final-a/` and `final-b/`, have identical scene/diagnostic evidence, SVG and SVG-derived PNG bytes. `determinism-report.json` records 201 matching artifacts, identical rows, no hard errors and source SHA-256 `d0534b240703391fff987ad5d1aba5da7dc528b9885042db967f6a2b42cd60f4`. Reproduce comparison with `node docs/routing_hardening/compare_evidence.mjs LEFT RIGHT REPORT`. All three exact CLI views succeed in SVG and PNG with explicit `simple`, `detailed`, `type,id`; logs/artifacts are `final-cli.<view>.<format>[.log]`.

The full suite exposed the previously reviewed Journey reciprocal root-margin correction in the `topology` goldens. Recursive comparison proves only root height changes 229→261 in step-3/final; step-2, all nodes/routes, labels/marks and diagnostics are unchanged. `journey-topology/{baseline,final}.png` was inspected before refreshing exactly four files (step-3/final scene JSON and SVG). SVG diffs contain only viewport/canvas height. `journey-topology-accepted.log` passes the affected snapshot test. No adopter or unrelated golden was refreshed.

Astra High independently reviewed Stage 3/4 and supplied concrete findings that were fixed and regression-tested. Attempts to obtain a later independent integration review reached the account's agent usage limit; no later agent review is claimed. The orchestrator completed the call-path, constraint-retention and visual audits. `final-core-review.log` passes all 18 core/Outcome-expansion tests, including in-place expansion mutation protection.

| Invariant | Final routing assessment | Evidence |
| --- | --- | --- |
| H1 | satisfied | Routing remains downstream of projection; staged forms and SVG→PNG path unchanged. |
| H2 | satisfied | Full current-route validation; real production repair/rejection/expansion for all adopters; complete 48-row matrix. |
| H3 | satisfied | Independent intervals/node oracle and terminal audits clean; no separation relaxation or sharing exemption. |
| H4 | satisfied | Independent endpoints and sides, marker footprints, immutable expansion locks/clearance, established Scenario/Service topology retained. |
| H5 | satisfied | Logical span dependencies rebuilt after bends; only accepted maps consumed; emitted routes revalidated. |
| H6 | satisfied within explicit finite search | Candidate/revision/assignment/expansion bounds, repeated-state tests, detached expansion input and 201 byte-identical repeat artifacts. This is not completeness for arbitrary layouts. |
| H7 | satisfied | Existing loaded bundle policy paths retained; no new semantic policy, hardcoded proof identifiers or pixel solution. |
| H8 | satisfied for affected routing | Scenario matrix entirely preserved; Outcome/Service changes justified above; Journey margin-only correction reviewed; unrelated UI issues tracked separately. |
| H9 | satisfied | Geometry and SVG/PNG accepted before the four narrowly scoped Journey golden updates. |
| H10 | satisfied | Every adopter has behavioral production repair, rejection and expansion evidence through the same coordinator. |


### Full-suite result and unrelated issues

`TMPDIR=/tmp pnpm test --maxWorkers=2 --minWorkers=1 --testTimeout=30000` rebuilt TypeScript successfully and ran all 125 test files: **1,287 passed, 23 failed, 27 skipped** (1,337 tests), with 115 passing files and 10 failing files. Log: `/tmp/sdd-routing-hardening/full-suite.log`. The one routing-related failure was the Journey topology golden described above; its corrected targeted rerun passed. Every other required routing test in the full run passed, including Journey directional/reciprocal, branch/join, endpoint ordering, bounded expansion, stage/golden and continuity-mark proofs; IA intentional sharing; legacy DOT/Mermaid/Graphviz paths; parser/compiler/projection and bundle-authority tests.

The remaining **22 individual failures and four suite-setup/collection failures** are unrelated pre-existing issues, left visible:

| Issue | Affected tests | Baseline evidence / disposition |
| --- | --- | --- |
| Three UI complete-sheet snapshot mismatches | `stagedUiContracts.spec.ts`: place-viewstate-transition, ui-state-fallback, dense-sparse | All three were reproduced in Stage 0 before production edits. UI source and these goldens are unchanged. |
| Missing `docs/hierarchical_ui_contracts/departure_desk.sdd` | Eight staged UI matrix cases, one container case, eight fanout cases, one topology case; setup failures in B5 scopes, complete and presentation-model suites | File is absent from baseline HEAD; none of these documentation paths was changed by this work. 27 tests were skipped after failed setup. |
| Missing `docs/hierarchical_ui_contracts/b5_pipeline_evidence.json` | B5 replay suite cannot collect | File is absent from baseline HEAD; no routing evidence regenerated to hide the missing input. |
| Missing `docs/good_node_rendering/unified_node.sdd` | One shared-node CLI decorator case | File is absent from baseline HEAD; shared-node source is unchanged. |

These are documented exceptions under plan §§7–9, not a claim that the repository suite is green. No required routing invariant or production/settings proof remains unfinished. The final source does not change parsing, compilation, graph validation, projection, bundle semantics, or legacy behavior. The only accepted golden changes are the four reviewed Journey height updates. `git diff --check` passes.

### Completion and limits

Stages 0–7 and H1–H10 are accepted for this program. Outcome, Service and Scenario now distinguish assignment feasibility, reconstructed geometry acceptance, actual production adoption, and independent visual/geometry proof. Complete-context hard validation remains mandatory after repair and expansion; failed search never exposes an accepted route map or public preview artifact.

Search is intentionally finite and does not prove all geometrically feasible diagrams will render. Four/eight expansion passes are retained operational limits required by the supplied plan, not constants derived from the reproduction. Absolute per-run locks remain absolute during expansion; a future movable locked-resource contract needs explicit typed geometry references. Continuity marks are accepted for declared geometry and invalidated by generic route repair; Journey retains its specialized mark owner. No broader renderer/layout or label-system redesign was undertaken.

## Shared scenario overlap recovery — 2026-10-07

Implementation follows [the saved overlap-recovery plan](plan_shared_connector_overlap_recovery_for_scenario_flows.md). The production change is confined to the shared final-routing lifecycle: a private generator offers existing port-derived corridor shapes for overlap/spacing conflicts after assignment/turn alternatives do not resolve the current state. Complete validation, ownership restrictions, deterministic scoring, atomic blocking recovery, expansion ownership, and the existing global search ceilings are retained. No bundle, projection, semantic adapter, legacy output, public API, or golden change is involved.

### Proof and targeted verification

The checked-in `tests/fixtures/render/scenario_overlap_reconvergence.sdd` contains seven ScenarioSteps and nine named-diagram PRECEDES edges. The source compiles, validates with the v0.2 bundle's `simple` profile, and projects DG-001. Before the production edit, all eight staged SVG configurations plus PNG failed on connector overlap; the new shared suite had 12 expected repair failures and four passing budget/ownership protections. The existing shared baseline passed 42/42 tests.

After the edit, 58/58 shared tests pass (16 new cases plus the existing 42), and 9/9 scenario integration tests pass. Tests check the actual emitted routes with both complete acceptance and the independent parallel-conflict oracle, preserving node geometry, endpoints, blockers, bounds, and input data. New cases cover spaced parallel runs, two independent conflicts composed through the queue, clearance, transformations, input-order determinism, unrelated routes, scoped blockers, global crossing-mark invalidation, separate run/shared-track guards, budgets, and the valid-input fast path. The scenario matrix also checks label-label/node/header collisions, other-route crossings through labels, and root containment using the existing visual harness.

Every proof configuration has the same actual final trace:

| Detail | Decorators | Validations | Candidates | Repair revisions | Expansion passes | Repeated states |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| compact | none, type, id, type/id (each) | 154 | 154 | 1 | 0 | 14 |
| detailed | none, type, id, type/id (each) | 154 | 154 | 1 | 0 | 14 |

The planned compatibility gate passes **85/85 tests in nine files** (116.69s), including existing Scenario/Outcome/Service production acceptance and failure-publication checks, measured-marker expansion, UI routing optimization, staged Scenario snapshots, shared visual acceptance, and named-diagram CLI/projection tests. TypeScript builds successfully. Independent read-only review found no correctness issues in the production change or regressions.

### Evidence and visual assessment

Temporary evidence is in `/tmp/sdd-scenario-overlap-recovery`: eight SVGs and initial/final geometry/trace JSON files, the detailed type/id PNG, and an eight-mode contact sheet. Reproduce accepted evidence with:

```bash
SDD_SCENARIO_OVERLAP_EVIDENCE_DIR=/tmp/sdd-scenario-overlap-recovery TMPDIR=/tmp pnpm exec vitest run tests/scenarioFlowOverlap.spec.ts --maxWorkers=2 --minWorkers=1
```

The repaired SVG/PNG matrix has distinct cross-link routes, correctly attached arrowheads, and no clipping. Diagnostic-only renders retaining the unrepaired preparation were also captured for visual comparison; these invalid route sets are not acceptance artifacts. Cross-link option labels were already detached outside the node rows before repair. One of these labels reflows to another collision-free position under the existing label-placement policy after repair. That association/readability limitation remains visible; this change does not redesign label placement. Visual acceptance is for the incremental routing change and collision/clipping checks, not a claim that detached labels provide ideal association.

### Full-suite result and completion

`TMPDIR=/tmp pnpm test --maxWorkers=2 --minWorkers=1` builds TypeScript successfully and completes **153 test files: 151 passed, 2 failed; 1,675 tests passed, 2 failed** (586.55s). Log: `/tmp/sdd-overlap-full-suite.log`. All new regressions and the required shared/adopter/compatibility gates pass. The repository suite is not green because of two independently reproduced pre-existing input failures:

| Failure | Evidence and disposition |
| --- | --- |
| `tests/diagramTypeNodeEdgeReference.spec.ts` reads missing `docs/doc_site/diagram_types/node_edge_reference.md`. | `git cat-file -e HEAD:docs/doc_site/diagram_types/node_edge_reference.md` confirms the input is absent from HEAD. The test and its documentation inputs are untouched. The isolated rerun reproduces ENOENT; log `/tmp/sdd-overlap-unrelated-doc-failure.log`. |
| `tests/scenarioFlowBottomExit.spec.ts` forces the v0.1 bundle/header onto the already migrated planning document `docs/sdd_app_planning/whiteboarding_diagrams/tmp.sdd`. | The source uses `ScenarioStep` at line 158, which the v0.1 parser rejects; the test fails its compilation assertion before invoking the renderer. The test, planning source, parser/compiler, and v0.1 bundle are unchanged from HEAD. The isolated rerun reproduces the parse errors; log `/tmp/sdd-overlap-bottom-exit-failure.log`. |

No snapshots or goldens were refreshed to normalize these failures. `git diff --check` passes. Routing acceptance is satisfied: complete/independent emitted-geometry checks, immutable endpoints/layout, no proof expansion, preserved marker/blocker/ownership policy, unchanged valid-input behavior, bounded deterministic recovery, atomic blocking recovery, and failure-without-publication. Incremental SVG/PNG visual acceptance is satisfied with the existing detached-label limitation described above. Independent reviews found no correctness issue in the implementation or regressions.

The planned routing implementation is complete; the unrelated repository test inputs remain visible follow-up work. The original incident source remains unavailable, so the evidence establishes the reproduced failure class rather than that document's exact cause. Bounded recovery still does not guarantee a solution for every feasible diagram.


## Shared label capacity and Scenario correction — 2026-10-07

The seven-node `scenario_overlap_reconvergence.sdd` proof now has no detached displayed labels, collisions, clipping, omissions, fallback diagnostics or unresolved-label warnings in the eight detail/decorator configurations. Compact detail continues to suppress branch labels through bundle-owned display policy. Detailed cross-link labels remain beside their own connectors inside the endpoint-row envelope. The exact SVG/PNG and eight-mode contact sheet were visually inspected. Artifacts, independent geometry evidence, per-call and aggregate traces are under `/tmp/sdd-label-proof`.

The red run recorded eight failures before production changes (`/tmp/sdd-label-red.log`). Shared `connectorLabelLayout.ts` now supplies independent association/collision assessment, opt-in associated placement and measured interval-packed corridor demand. Scenario owns the cumulative layout application and correction loop. All accepted/emitted routes still pass `validateFinalRouteSet`; fixed-geometry overlap recovery remains separately covered. This work introduces no bundle convention, parser/compiler/projector behavior, CLI option, semantic port permission or legacy output change.

Proof traces: compact configurations consume two preparation expansions, no label/routing expansions, 154 routing candidates and one repair revision. Detailed configurations consume one preparation expansion plus one label correction, no routing expansions, 314 aggregate candidates and two repair revisions; revision 1 is selected. All have zero unresolved label IDs. The detailed measured final gutter state is columns `{1: 48, 2: 272}` and rows `{0: 96}`. Expansion is deliberately allowed for label capacity; the previous fixed-node/bounds guarantee remains a shared routing-core guarantee rather than a full-renderer guarantee.

The user chose warning-only degraded publication. Tests exercise both SVG and PNG warnings, unmovable/missing capacity, persistent corrections reaching the shared eight-expansion ceiling, carried candidate/revision budgets, complete-scene rollback after later routing failure, preserved inherited measurement diagnostics, wrapped labels, unequal node heights, vertical/reversed segments, interval reuse, duplicate request merging and input immutability. Existing Scenario stage snapshots pass without refreshing any goldens. The focused six-file compatibility run passed 68 tests; it covered Scenario, Outcome, Service and visual acceptance. Subsequent Scenario owner/snapshot checks passed 39 tests. Other renderer adoption is intentionally deferred.

Two previously reported unrelated failures were independently reproduced against the unmodified HEAD tree extracted into `/tmp/sdd-label-baseline` (`/tmp/sdd-label-baseline-failures.log`): the missing `docs/doc_site/diagram_types/node_edge_reference.md`, and the v0.1 optional-bottom-exit test compiling v0.2 declarations from the planning source.

`TMPDIR=/tmp pnpm test --maxWorkers=2 --minWorkers=1` completed 155 files: **152 passed, three failed; 1,698 tests passed, three failed** (623.11s; `/tmp/sdd-label-full.log`). In addition to the two baseline failures, it detected the B5 immutable source-hash guard for the authorized opt-in extension of `connectorLabelPlacement.ts`. That file is now listed with the existing intentionally extended sources in the guard, with its reason documented; the historical hash manifest and accepted geometry artifacts remain unchanged. The targeted B5 replay, existing placement and UI repair rerun passes **33/33 tests** (`/tmp/sdd-label-b5.log`). No whole-suite green result is claimed. IA, Journey, Outcome, Service, existing Scenario snapshots and legacy compatibility passed in the full run.

The final new shared-label, Scenario orchestration and eight-configuration proof run passes **34/34 tests** (`/tmp/sdd-label-complete-focused.log`), including preservation of inherited measurement warnings. TypeScript builds successfully (`/tmp/sdd-label-final-build.log`), and `git diff --check` passes. Neither test timeouts nor search/expansion budgets were increased. Regenerate proof SVGs, detailed type/id PNG and trace JSON with:

```bash
SDD_SCENARIO_OVERLAP_EVIDENCE_DIR=/tmp/sdd-label-proof TMPDIR=/tmp pnpm exec vitest run tests/scenarioFlowOverlap.spec.ts --maxWorkers=2 --minWorkers=1
```

Acceptance assessment: proof association, clearance, full routing acceptance, determinism, bounded correction, warning fallback and existing renderer compatibility are satisfied. Capacity packing and routing are bounded heuristics, not completeness claims for arbitrary diagrams; an unmappable or insufficient corridor remains visible through warnings, while initial invalid routing still prevents preview publication. No snapshots or corpus artifacts were refreshed. Unrelated workspace edits are preserved.

## Preserve a single turn after Scenario layout correction — 2026-10-08

The proof's S-002 → S-004 connector now retains two segments and one turn after label-driven layout rebuilds. The south-to-west preparation template previously added a 16px downward overshoot unconditionally; the already-selected south port then bypassed optional-port reconsideration. Preparation now offers the single turn when both existing terminal stubs fit. Backward destinations keep the detour template, and blocked proposals still pass through obstacle refinement and complete routing acceptance. This is a seven-line Scenario geometry change under existing port permissions; the shared routing lifecycle's unchanged-valid-input contract is preserved.

The new emitted-route assertion initially failed in all four detailed configurations, with the other five proof tests passing (`/tmp/sdd-single-turn-red.log`). After the fix, all eight configurations plus PNG and the label-correction suite pass: **19/19 tests** (`/tmp/sdd-single-turn-proof.log`). Two additional stable regressions pass for a backward south exit and a reserved corridor blocking the proposed single turn; the latter uses real routing recovery and independently audits final label association (`/tmp/scenario-single-turn-tests.log`). Scenario routing, final acceptance, staged snapshots, visual acceptance, shared corridor recovery and overlap recovery pass **52/52 tests** (`/tmp/sdd-single-turn-compat.log`). Total focused verification: **73 passing tests**. TypeScript builds and `git diff --check` pass. No snapshots were updated; this follow-up did not rerun the whole repository suite.

The eight SVGs, detailed type/id PNG and contact sheet in `/tmp/sdd-single-turn-proof` were visually reviewed. The corrected detailed connector is 32px shorter; all displayed labels remain associated and all proof configurations have no unresolved-label warnings. Aggregate proof budgets remain unchanged: compact uses 154 candidates and one repair revision, detailed uses 314 candidates and two repair revisions with one label-driven expansion. No acceptance invariant remains violated in this follow-up.
