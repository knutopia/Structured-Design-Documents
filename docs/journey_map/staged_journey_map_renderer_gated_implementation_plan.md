# Staged Journey Map Renderer — Gated Implementation Plan

Status: implementation in progress — Gate 6 join family in blocking review

Audience: the single implementation agent, reviewers, and maintainers responsible for accepting a staged `journey_map` renderer

Purpose: deliver a deterministic, visually excellent journey-map renderer through narrow, sequential, proof-driven gates. Correct semantics, obstacle-free routing, connector identity, visual readability, and reviewability outrank implementation speed.

## Implementation ledger

This ledger is the execution record for the linear Gate 0 → Gate 10 dependency chain. Only the active gate may be in progress; every later gate remains blocked until its prerequisite evidence is accepted.

| Gate | Status | Reviewer | Accepted | Checkpoint | Validation |
| --- | --- | --- | --- | --- | --- |
| 0 — Authority, drift, protected baseline | accepted | user | 2026-07-12 | no commit | 4 files/63 tests; whitespace and protected baseline clean |
| 1 — Proof corpus and acceptance contract | accepted | user | 2026-07-12 | `c94eab8` | prerequisite and proof-contract validation green |
| 2 — Typed render inputs | accepted | user | 2026-07-13 | `3900c5e` | 5 files/28 tests; build, whitespace, protected baselines clean |
| 3 — RendererScene | accepted | user | 2026-07-13 | `d40a2fc` | 3 files/29 tests; accepted snapshots, build, whitespace, protected baselines clean |
| 4 — Measurement and pre-routing | accepted | user | 2026-07-13 | `ad75f44` | accepted evidence captured; 5 files/45 tests; shared regressions 4 files/24 tests; build, whitespace, protected hashes clean |
| 5 — Basic routing | accepted | user | 2026-07-13 | `4ad14e2` | 2 files/16 focused tests; 5 files/44 shared regressions; build, deterministic review package, whitespace, and protected baselines clean |
| 6 — Archetypes and ownership | in review — join family | user | — | pending | same-Stage skip `2c2c580`; long cross-Stage/root `3a894be`; branch `6dad32e`; join 2 files/27 tests and broader 5 files/61 tests green; human readability violated and retained for Gates 7–8; backward and later families blocked |
| 7 — Occupancy and expansion | blocked by Gate 6 | — | — | — | — |
| 8 — Diagnostics and focused acceptance | blocked by Gate 7 | — | — | — | — |
| 9 — Public preview integration | blocked by Gate 8 | — | — | — | — |
| 10 — Goldens, corpus, and closeout | blocked by Gate 9 | — | — | — | — |

## Implementation log

### Gate 0 — 2026-07-12 review package

**Execution state.** The read-only authority, drift, tooling, and protected-baseline pass is complete. Gate 0 is in review; Gate 1 has not begun. The only tracked change made for this gate is this user-required execution record.

**Authority and runtime consumption.** Repository policy is `AGENTS.md`. Bundle behavior is governed by `bundle/v0.1/core/views.yaml` and `bundle/v0.1/core/contracts.yaml`; `buildJourneyMapProjection(...)` in `src/projector/journeyMap.ts` consumes the loaded view contract at the semantic boundary; `buildJourneyMapRenderModel(...)` in `src/renderer/journeyMapRenderModel.ts` consumes projection output, bundle-provided hierarchy/ordering edge lists, profile display policy, and the author-order helpers in `src/compiler/authorOrder.ts`. Staged renderer documents and existing staged modules agree with the explicit projection-to-SVG pipeline and the journey-specific no-ELK/no-external-engine rule.

**Baseline state.** Branch `journey_map` was clean and aligned with `origin/journey_map` at `41fd368026a84720222fb4f14614f536615ed641`. Tooling was Node `v22.17.0`, pnpm `10.31.0`, and Vitest `2.1.9`. No unrelated workspace changes were present before this ledger update.

**Protected renderer baseline.** SHA-256 hashes recorded before implementation:

| File | SHA-256 |
| --- | --- |
| `src/renderer/staged/iaPlaceMap.ts` | `98462a96069c3fc750c051ce339beeb8431ae34b271972bb42083cdd16fd13e7` |
| `src/renderer/staged/uiContracts.ts` | `4c99cbd6acc406b535d6d58ea6a6ad61a5ecb152c96c33f085663dc2d780c58c` |
| `src/renderer/staged/scenarioFlow.ts` | `445d9eaaaef82a486aef80422cf307b694d1ce938f2fdd4667c1568d8df91318` |
| `src/renderer/staged/scenarioFlowDecorations.ts` | `1d2d37aecc771d02de96790588d2d50bb1783ad5169825bc6fcd71acc71ab301` |
| `src/renderer/staged/scenarioFlowMiddleLayer.ts` | `99837f7d6df0d45c617ba5040d594a7ee63839d5b0f2c5fee7251193e869dbdd` |
| `src/renderer/staged/scenarioFlowRouting.ts` | `a252ac1176e39ea2f942f164ba4eabfcfec73f862c221257fcc6ee4e75d9937f` |
| `src/renderer/staged/serviceBlueprint.ts` | `ad097e7348c6ba0a79e2a185e7df285de23e2430cfcd03f8712122cd76af584e` |
| `src/renderer/staged/serviceBlueprintDecorations.ts` | `41d02d526e572dd58b0a3b44b7fd2601b2a9e6d41442f8143dc6b3059e571b43` |
| `src/renderer/staged/serviceBlueprintMiddleLayer.ts` | `608fa7cf3bfe724397ab8b67eb5f8233abea0523c76f4ae2fdba0e04534698b4` |
| `src/renderer/staged/serviceBlueprintRouting.ts` | `64a3a68986a532c8494b8592508cefbda3b31bc4f2b67c46d8d84223c949cc2b` |
| `src/renderer/staged/outcomeOpportunityMap.ts` | `b9dcfcd63c76244794f2f5767762ce695392ee4f42c023a6026042cd595188b0` |
| `src/renderer/staged/outcomeOpportunityMapDecorations.ts` | `2178e56a4311322659b9ed3590b1bd2119525be6d0a93607460e053d92aaeb33` |
| `src/renderer/staged/outcomeOpportunityMapMiddleLayer.ts` | `4d1ba3a36dda83f0b2e0a4f8580a6aab07a6445cd5647db3def8e6728d668f51` |
| `src/renderer/staged/outcomeOpportunityMapRouting.ts` | `b2b1c984c5fda517376c91738b3a83614cd83ec45ebf0ddd07f3d3dabdfe6181` |

Legacy journey DOT baselines were `8eea08164170aa69730b348c24eebafbbec7614cf456fc29ac181982291fdb04` for `outcome_to_ia_trace.journey_map.dot` and `43269f0851ca96c9b370b02cc850345243e88da468ba465dc8d8ca61795d144e` for `service_blueprint_slice.journey_map.dot`.

**Validation.** `TMPDIR=/tmp pnpm exec vitest run tests/projectionSnapshots.spec.ts tests/render_profile_display.spec.ts tests/viewRenderers.spec.ts tests/cli.spec.ts` passed: 4 files, 63 tests. `git diff --check` passed. All cited tests and integration seams exist, and the baseline did not require Graphviz.

**Material decisions and drift.** No new contradiction or architectural ambiguity was found. Gate 2 must give edge IDs semantic occurrence identity using the contract identity fields plus a duplicate ordinal, with author order stored separately. Typed badges must remain one block per resolved reference with target-name/ID fallback. Gate 7 occupancy records must retain the metadata required by the journey architecture. Existing ELK documentation describes protected current behavior only and does not authorize journey ELK. Gate 9 changes journey preview selection only while retaining internal DOT/Mermaid behavior and explicit legacy preview.

Two known drift items remain deliberately unresolved: `reference_annotations.sort: id_ascending` is not visibly consumed by `splitReferenceIds(...)`, so Gate 2 must prove bundle dependence and stop before any protected projection change; `src/authoring/contracts.ts` omits the live outcome-opportunity staged backend ID, which remains out of journey scope unless separately approved at Gate 9.

**Invariant report.** Satisfied: authority hierarchy, bundle ownership, projection boundary, source-order policy, explicit staged pipeline, SVG-first/PNG-derived policy, legacy selectability, protected-renderer scope, determinism baseline, and no-external-engine rule. Violated: none found. Artifacts/diagnostics: no visual artifact is required at Gate 0 and no new diagnostic was emitted. Deviation: the gate report is stored in this controlling plan as explicitly required by the execution request; no production, test, fixture, or rendered artifact was changed. Residual risk: focused journey semantic characterization does not yet exist and remains assigned to Gate 2.

**Acceptance.** Accepted by the user on 2026-07-12. Gate 1 opened only after this acceptance was received.

### Gate 1 — 2026-07-12 stop report: intentional-cycle annotation

**Gate state.** Gate 1 began after Gate 0 acceptance and stopped before the fixture contract was locked. No fixture, production, test, snapshot, or rendered artifact has been created. Gates 2–10 remain blocked.

**Authority conflict.** `bundle/v0.1/core/contracts.yaml` defines `precedes_cycle_policy` with `loop_annotation_prop: kind` and `loop_annotation_value: loop`; explanatory definitions explicitly identify this as an edge property, and the approved plan states that `PRECEDES` cycles recognize `props.kind=loop`. SDD syntax supports edge properties. The generic `cyclicFlowPolicy(...)` executor in `src/validator/ruleExecutors.ts`, however, looks for `kind=loop` on a cycle node. Under the strict profile, `Step.kind` permits only `decision`, so the node-level workaround that suppresses the cycle warning creates `validate.step_kind_enum` as a strict error.

**Smallest reproducer.** A two-Step cycle with `kind=loop` on one `PRECEDES` edge still emits `validate.precedes_cycle_policy` because the edge property is ignored. Moving `kind=loop` to either Step suppresses that warning but violates strict `Step.kind=[decision]`. There is no existing cycle-policy test that resolves the contradiction.

**Safe alternatives evaluated.** Separating annotated and unannotated cycle fixtures avoids diagnostic cross-talk but does not make the annotated edge observable to validation. Accepting the cycle warning for both cases would erase the bundle-owned annotated/unannotated distinction and would turn a known bundle-authority failure into fixture policy. Changing source order, renderer behavior, or proof coordinates is irrelevant and forbidden.

**Invariant report.** Still satisfied: journey scope, projection boundary, renderer isolation, source-order policy, and no-external-engine rule. Violated by current runtime behavior: the bundle-declared intentional-loop annotation is not consumed from the specified edge property, and strict validation has no valid node-level substitute. Gate 1 acceptance is therefore not available.

**Decision and approval.** On 2026-07-12 the user authorized the recommended narrow prerequisite contract repair and requested explicit, retraceable bundle-impact documentation. The repair may therefore update the bundle contract, its TypeScript contract shape, the generic validator consumer, focused validation tests, and explanatory contract commentary before Gate 1 fixture design resumes.

**Bundle impact contract.** `precedes_cycle_policy.rule_logic` will explicitly declare: (1) the annotation target (`edge`), (2) the property and value (`kind=loop`), and (3) coverage (`each_cyclic_component`). `loadBundle(...)` already preserves open `rule_logic` data, so no view-specific loader branch is permitted; the generic `RuleLogic` type will expose the fields and `cyclicFlowPolicy(...)` will consume them. Each strongly connected cyclic component—including a one-node self-loop—must contain at least one matching internal annotated edge. A marker in one cyclic component cannot suppress a diagnostic for another. Tests must prove strict-profile compatibility without `Step.kind=loop`, edge-target consumption, per-component behavior, self-loops, deterministic related IDs, and that bundle-only mutations of the marker/target/coverage change runtime results. This repair changes validation only; parser, compiler, projection, renderer, and existing journey placement/routing semantics remain unchanged.

**Deviation boundary.** This approved prerequisite is the only Gate 1 scope expansion. It must not introduce journey-specific validator code, new syntax, a new relationship, or renderer behavior. Gate 1 remains incomplete until the repair passes focused and full relevant validation and the fixture/acceptance contract is subsequently locked and reviewed.

### Gate 1 prerequisite repair — validation result

**Implemented bundle behavior.** `bundle/v0.1/core/contracts.yaml` now declares `loop_annotation_target: edge`, `loop_annotation_prop: kind`, `loop_annotation_value: loop`, and `loop_annotation_coverage: each_cyclic_component`. The generic `RuleLogic` TypeScript surface exposes those fields, `loadBundle(...)` passes them through without a relationship-specific branch, and `cyclicFlowPolicy(...)` uses deterministic strongly connected components. A multi-node component or self-loop is accepted only when one internal `PRECEDES` edge has the configured marker; connectors entering or leaving the component do not annotate it; one annotated component does not suppress another component's diagnostic.

**Compatibility and retraceability.** The current v0.1 bundle is explicit and authoritative. For an older external bundle that omits the new target and coverage fields, the generic executor preserves the previous node-marker/relationship-wide behavior: any matching cycle-node marker suppresses the rule, otherwise one diagnostic contains the union of cyclic node IDs. Changing the loaded target, marker property/value, or coverage changes validation results without code edits. `definitions/v0.1/endpoint_contracts_semantic_rules_sdd_text_v_0_dot_1.md` now mirrors the per-component edge rule. No syntax, profile, manifest path, compiled schema, projection schema, example, projection snapshot, or rendered golden changed. Existing manifest examples contain no `PRECEDES` cycle, so regeneration was neither needed nor performed. A future independently versioned release must associate the first consuming engine version with this field; that release-version bookkeeping is outside this repository-local repair.

**Changed files for the prerequisite.** Bundle: `bundle/v0.1/core/contracts.yaml`. Generic runtime contract/consumer: `src/bundle/types.ts`, `src/validator/ruleExecutors.ts`. Proof: `tests/cyclicFlowPolicy.spec.ts`. Commentary and execution trace: the endpoint-contract definition and this plan. No journey renderer, projection, parser, compiler, profile, snapshot, or protected staged renderer file changed.

**Validation.** `TMPDIR=/tmp pnpm exec vitest run tests/cyclicFlowPolicy.spec.ts tests/validate.spec.ts tests/projectionSnapshots.spec.ts` passed 3 files and 16 tests. The focused suite proves strict edge annotation without `Step.kind`, rejection of the former strict-invalid node workaround, unannotated diagnostics, self-loops, independent components, multi-component deterministic related IDs, legacy omitted-field behavior, acyclic regression, and bundle-only target/marker/coverage mutation. `TMPDIR=/tmp pnpm run build` passed. `git diff --check` passed. Manifest examples remain strict/simple error-free and projection snapshots remain unchanged.

**Invariant report.** Satisfied: bundle authority, generic consumption, bundle-only behavior change, strict-profile compatibility, deterministic component diagnostics, projection stability, and renderer isolation. Violated: none after repair. Deviation status: approved and closed. Gate 1 fixture/acceptance design may resume; Gate 1 itself is not yet accepted.

### Gate 1 — locked proof-corpus contract

The literal, decision-complete Gate 1 artifact is [`staged_journey_map_renderer_gate1_proof_contract.md`](staged_journey_map_renderer_gate1_proof_contract.md). Its five complete `.sdd` sources, per-edge ownership/archetypes, profiles, assertion/rubric ownership, diagnostic triggers, artifact names, thresholds, and return-to-Gate-1 stop rule are normative for later implementation. The summaries below provide traceability but do not authorize omissions or discretionary fixture edits.

**Future fixture paths.** Gate 2 creates the semantic fixtures; Gate 1 only locks their content. The paths are:

- `tests/fixtures/render/journey_map_staged_primary.sdd`
- `tests/fixtures/render/journey_map_staged_ordering_ownership.sdd`
- `tests/fixtures/render/journey_map_staged_topology.sdd`
- `tests/fixtures/render/journey_map_staged_duplicate.sdd`
- `tests/fixtures/render/journey_map_staged_compressed.sdd`

Every literal value and source placement is fixed in the linked contract. All fixtures start with `SDD-TEXT 0.1`, satisfy strict required properties/realization except for named intentional warnings, place Stage `CONTAINS` lines before nested blocks, keep root/multiply-contained Steps top-level, and treat nesting as organization rather than semantics.

#### Primary composition and profile fixture

`journey_map_staged_primary.sdd` has projected root order `[G-100, G-200, J-250, J-260, G-300, G-400]`.

| Node | Name / role | Exact structural or property contract |
| --- | --- | --- |
| `G-100` | Discover | `CONTAINS` order `[J-101,J-102,J-103]` |
| `J-101` | Recognize a need | contained by `G-100` |
| `J-102` | Compare plans, eligibility details, and expected total cost before choosing | contained by `G-100`; long-label proof |
| `J-103` | Shortlist an option | contained by `G-100` |
| `G-200` | Evaluate every option and choose the best path with confidence | long Stage title; `CONTAINS` order `[J-201,J-202,J-203,J-204]` |
| `J-201` | Review the recommendation | `kind=decision`; `opportunity_refs="OP-200, OP-100"` deliberately reverses bundle display order |
| `J-202` | Compare the tradeoffs | contained by `G-200` |
| `J-203` | Resolve remaining concerns | contained by `G-200` |
| `J-204` | Choose a path | contained by `G-200` |
| `J-250`,`J-260` | Ask for / Receive human guidance | uncontained root Steps forming a disconnected two-node chain |
| `G-300` | Pause and reconsider | empty Stage |
| `G-400`,`J-401` | Commit / Complete enrollment | single-Step Stage; `CONTAINS [J-401]` |
| `OP-100`,`OP-200` | Clear total cost / Confidence before commitment | resolved badge targets |
| `P-100` | Journey proof surface | strict realization target for every Step |

Authored qualifying `PRECEDES` order is fixed as follows; `owner` is the required lowest common container and the archetype is the expected routing classification.

| Order | Edge | Owner | Archetype / proof |
| --- | --- | --- | --- |
| 0 | `J-101→J-102` | `G-100` | adjacent forward same-Stage direct |
| 1 | `J-102→J-103` | `G-100` | adjacent forward same-Stage direct |
| 2 | `J-103→J-201` | root | adjacent forward cross-Stage bridge |
| 3 | `J-201→J-202` | `G-200` | adjacent branch member |
| 4 | `J-201→J-203` | `G-200` | non-adjacent branch/bypass member |
| 5 | `J-202→J-204` | `G-200` | non-adjacent join/bypass member |
| 6 | `J-203→J-204` | `G-200` | adjacent join member |
| 7 | `J-204→J-401` | root | long cross-Stage/root bypass avoiding root Steps and unrelated empty `G-300` |
| 8 | `J-250→J-260` | root | root-Step direct; disconnected component |

#### Ordering and ownership fixture

`journey_map_staged_ordering_ownership.sdd` has projected root order `[G-600,J-590,G-500,J-591]`. `G-600` is authored before `G-500`, but projection edge ordering is canonical by `from/type/to`; therefore multiply-contained `J-503` selects `G-500` as its first qualifying parent.

- `G-600` “Authored-first secondary parent” has `CONTAINS [J-601,J-503,J-602]`; its rendered children are `[J-601,J-602]` after first-parent filtering.
- Top-level `J-503` “Shared multiply-contained step” stays top-level in source because it has two semantic parents, but renders inside `G-500`.
- `G-500` “Projected-first structural owner” has deliberately non-ID `CONTAINS [J-503,J-502,J-501]`; this exact order is its rendered child order.
- Root Steps are `J-590` “Root handoff” and `J-591` “Root return”. `P-500` is the strict realization target.
- Authored `PRECEDES` order: `J-503→J-501` (same-Stage skip), `J-501→J-502` (backward relative to the locked child order), and `J-591→J-590` (backward root-owned edge). Placement remains source/edge-line ordered.
- Expected validation: one `validate.contains_single_parent_recommended` warning related to `J-503`. Expected renderer context: one `renderer.scene.journey_map_first_parent_selected` info diagnostic; no renderer warning/error.

#### Exceptional topology fixture

`journey_map_staged_topology.sdd` has root order `[J-790,G-700,J-791]`. `G-700` “Loops and returns” has `CONTAINS [J-701,J-702,J-711,J-712,J-713,J-714]`; `P-700` realizes every Step. Both branching Steps `J-790` and `J-714` have `kind=decision`.

| Order | Edge | Contract |
| --- | --- | --- |
| 0 | `J-790→J-701` | root-to-contained transition; `J-790 kind=decision` because it also targets `J-791` |
| 1 | `J-790→J-791` | direct root-Step branch member |
| 2 | `J-701→J-702 kind=loop` | annotated two-node cycle, internal edge marker |
| 3 | `J-702→J-701` | annotated component return; same-Stage peripheral route |
| 4 | `J-711→J-712` | unannotated cycle member |
| 5 | `J-712→J-711` | unannotated cycle return; exactly one component diagnostic expected for `[J-711,J-712]` |
| 6 | `J-713→J-713 kind=loop` | annotated self-loop |
| 7 | `J-714→J-713` | standalone backward same-Stage edge |
| 8 | `J-714→J-791` | contained-to-root transition |

The annotated two-node cycle and self-loop emit no cycle-policy diagnostic. Validation emits exactly one `validate.precedes_cycle_policy` warning for the unannotated component. Renderer output routes every edge and may emit only the locked peripheral backward/cycle/self-loop info diagnostics; renderer warning/error is forbidden.

#### Duplicate identity and Step-only fixture

`journey_map_staged_duplicate.sdd` has no Stage. Root order is `[J-801,J-802]`; both Steps are realized by `P-800`. Branching Step `J-801` has `kind=decision` and authors these three same-endpoint edges in order:

1. `PRECEDES J-802 "Continue guided" {advisor_available} channel=guided`
2. `PRECEDES J-802 "Continue alone" {self_service} channel=self_service`
3. `PRECEDES J-802 "Different non-semantic hint" {advisor_available} channel=guided`

The bundle identity tuple is `(from,type,to,event,guard,effect,stable props)` and excludes `to_name`. Occurrence 0 and 2 therefore share a semantic identity while occurrence 1 is distinct. Gate 2 must preserve three projected/model/scene/final occurrences and expose: qualifying authored order `[0,1,2]`, same-endpoint ordinal `[0,1,2]`, semantic identity keys, and exact-identity ordinals `[0,0,1]`. Final ID string encoding remains Gate 2's owned decision, but it must derive from semantic occurrence identity rather than a bare global index. Projection intentionally erases annotations/properties; these fields may influence stable identity lookup but do not become journey edge labels or scene payload. Expect one `validate.duplicate_edge_detection` warning, the existing Step-only projection note, one `renderer.scene.journey_map_step_only` info diagnostic, and three distinct final routes where geometry permits; coincidence is not accepted by default.

#### Dense/compressed fixture

`journey_map_staged_compressed.sdd` has root order `[G-900,J-950,G-910]`, `G-900 CONTAINS [J-901,J-902,J-903]`, and `G-910 CONTAINS [J-911,J-912,J-913]`. Names are deliberately short (`A`, `A1`–`A3`, `X`, `B`, `B1`–`B3`) so content width does not hide routing pressure. `P-900` realizes every Step. Every Step with multiple outgoing edges has `kind=decision`.

Authored `PRECEDES` order is:

`J-901→J-902`, `J-901→J-903`, `J-901→J-950`, `J-901→J-911`, `J-901→J-912`, `J-901→J-913`, `J-902→J-903`, `J-902→J-950`, `J-902→J-913`, `J-903→J-950`, `J-903→J-913`, `J-950→J-911`, `J-950→J-912`, `J-950→J-913`, `J-911→J-913`, `J-912→J-913`, `J-912→J-902 kind=loop`, `J-913→J-901 kind=loop`.

This yields six outgoing edges at `J-901`, six incoming edges at `J-913`, three incoming and three outgoing edges at `J-950`, competing Stage-local skips, cross-Stage branches/joins, obstacle-local swerves around the root Step, and two peripheral backward routes. The internal loop markers keep validation focused on geometry. The fixture encodes no coordinates. Acceptance requires at least one Stage-local and one root/inter-item resolved coordinate to differ from nominal, at least one bounded whole-structure expansion/reroute, distinct late-ordered endpoints, and 16px minimum competing-track separation. If literal semantic contention does not force that behavior, Gate 7 fails and returns to Gate 1 for a documented amendment and renewed acceptance; later gates may not tune the graph opportunistically.

#### Profile reuse

Run the primary fixture under simple, permissive, and strict. Run ordering/ownership, topology, duplicate, and compressed under strict. Simple exposes no typed badge blocks and retains title-only legacy lines. Permissive and strict expose exactly two badges for `J-201` in bundle-declared ID order: `OP-100` “Clear total cost”, then `OP-200` “Confidence before commitment”; their legacy `labelLines` append those bracketed names in the same order. Hierarchy, model edge identity/order, and scene intent are otherwise identical. Geometry may differ only where the measured badge-bearing card height changes. The strict-required scaffold prevents unrelated validation noise.

### Gate 1 — test, assertion, artifact, and diagnostic contract

**Future suite names.** `tests/journeyMapRenderModel.spec.ts`, `tests/stagedJourneyMap.spec.ts`, `tests/journeyMapPreRouting.spec.ts`, `tests/journeyMapRouting.spec.ts`, `tests/journeyMapVisualAcceptance.spec.ts`, and `tests/journeyMapPreviewBackend.spec.ts`.

**Hard assertion ownership.** Existing generic harnesses remain preferred. Later work may add only test-owned `expectRoutesOrthogonal(...)` and `collectBadgeBoxes(...)` to `tests/stagedVisualHarness.ts`; Stage traversal, boundary gates, endpoint order, exactly-once occurrence matching, and author-order coordinate checks stay journey-specific.

| Assertion | Owning proof/stages |
| --- | --- |
| Orthogonal adjacent route points | every case at step-2, step-3, final |
| Exterior endpoint approach | every case at step-2, step-3, final |
| No non-endpoint Step, endpoint-interior, Stage-header, badge, or unrelated-Stage intersection | every applicable case at step-3/final; ordering included |
| Shared 12px terminal leg from `MIN_ARROW_MARKER_LEG` | every arrow-ended final edge; accepted proofs cannot use fallback |
| 16px overlapping same-orientation separation | every competing span at step-3/final; focused pressure in primary/topology/duplicate/compressed |
| Distinct late endpoint offsets ordered by prepared stems then priority | primary, topology branch sides, duplicate same-endpoint sides, compressed crowded sides |
| Exactly one semantic edge occurrence with no route geometry | RendererScene and MeasuredScene for every case; the pre-routing artifact bundle retains those ledgers while its PositionedScene has `edges=[]` |
| Exactly one stable orthogonal route per occurrence | step-2, step-3, final for every case; duplicate is the multiplicity proof |
| Root and Stage child order preserved | every case at model, scene, pre-routing, final |
| Ordered legal boundary gates | primary, ordering root return, topology root transitions, compressed contention |
| Occupancy changes final geometry and expansion is bounded | compressed only; resolved-vs-nominal plus final segment and whole-structure shift |
| Deterministic repeat | all model/scene/routing data and stored text hashes |

**Stage golden names.** No golden is captured until its owning gate accepts behavior. The linked proof contract enumerates every required filename per case/profile and the three exact degraded-diagnostic artifacts; later gates have no discretion to omit a named stage. PNG derivation is asserted and temporary PNGs are reviewed, but renderer-stage PNG goldens are not stored.

Temporary review artifacts use `/tmp/journey-map-review/<case>.<profile>.<pre-routing|step-2|step-3|final>.{svg,png}`. Gate 10 corpus debug stems, where Gate 9 later decides they are meaningful, remain the established `pre_routing`, `routing_step_2_edges`, and `routing_step_3_gutters` names.

**Renderer diagnostic codes.** The linked proof contract maps every exact full code to a directly constructed trigger, phase/severity, target/related IDs, and one of three named degraded artifacts. Information diagnostics and intentional validation warnings are likewise mapped to exact cases/artifacts. Normal direct routes emit no info noise.

Accepted primary/profile/compressed proofs contain no renderer warning/error. Ordering contains only the named validation warning plus first-parent info. Topology contains only the one named validation cycle warning plus peripheral topology info. Duplicate contains only the named validation duplicate warning plus Step-only info. Directly constructed negative/degraded unit inputs exercise the error/warning codes; those diagnostics never waive a proof failure.

**Normal visual review contract.** Review in a `1680×1050` CSS-pixel viewport at 100% browser zoom, with SVG at intrinsic width/height and one scene unit per CSS pixel. Primary and dense/debug cases may scroll horizontally at intrinsic 100%; each also receives a fit-to-viewport overview used only for whole-map composition, never text-readability acceptance. Vertical fit, intrinsic text/Stage/badge readability, and all geometry checks remain binding. Review PNG uses the shared 192 DPI path with no post-raster scaling.

Use this consolidated review form for each blocking visual pass:

```text
Journey Map Review — Gate __ / case __ / profile __ / artifact __
Stage progression meaningful: pre-routing __ step-2 __ step-3 __ final __
Hard checks: orthogonal __ obstacles/endpoints __ headers/badges __ unrelated Stages __
16px separation __ exactly-once edges __ source order __ occupancy affects final __
Visual: LTR reading __ direct forward tracks __ branch/join clarity __ peripheral returns __
edge identity __ Stage chrome/whitespace __ empty/single Stage __ labels/badges __ ports/gates __
Diagnostics: expected __ unexpected __
Satisfied invariants: __
Violated invariants: __
Verdict: PASS | FAIL   Reviewer/date: __
```

The linked ownership table defines which review items each case must pass; an item may be `N/A` only when another named case owns it. Any owned hard-check failure, unexpected renderer error/warning, non-empty violated-invariant field, nominally identical debug stages, or snapshot proposal before acceptance is a FAIL and blocks the next gate.

### Gate 1 — validation and consolidated review package

**Artifacts.** The decision-complete fixture/assertion/review artifact is [`staged_journey_map_renderer_gate1_proof_contract.md`](staged_journey_map_renderer_gate1_proof_contract.md). It contains five literal future fixture sources, exact source placement and properties, all edge owners/archetypes/modifiers, profile assignments, expected validation diagnostics, hard and human assertion ownership, exact stage/diagnostic filenames, full diagnostic trigger mapping, the 12px terminal-leg threshold, normal review dimensions, and the return-to-Gate-1 amendment rule. No `.sdd` fixture, snapshot, golden, corpus output, SVG, or PNG has been created at Gate 1.

**Executable fixture validation.** A temporary read-only extractor compiled all five literal Markdown sources through the real loaded bundle. Primary passed simple, permissive, and strict with no validation diagnostic. Ordering/ownership passed strict with only `validate.contains_single_parent_recommended`; topology passed strict with only `validate.precedes_cycle_policy` for `[J-711,J-712]`; duplicate passed strict with only `validate.duplicate_edge_detection`; compressed passed strict with no diagnostic. This is five fixtures and seven profile runs with no unexpected compile/validation result.

**Commands and results.** Gate 1's exact `rg -n "journey_map" bundle/v0.1/manifest.yaml bundle/v0.1/examples tests/fixtures tests` command passed and reconfirmed the current journey evidence/capability surface. `git diff --check` passed. The approved prerequisite rerun `TMPDIR=/tmp pnpm exec vitest run tests/cyclicFlowPolicy.spec.ts tests/validate.spec.ts tests/projectionSnapshots.spec.ts` passed 3 files and 16 tests; `TMPDIR=/tmp pnpm run build` passed. No manifest, compiled snapshot, projection snapshot, renderer snapshot, golden, or corpus artifact changed.

**Completeness review.** Independent read-only review initially found open literal values, incomplete edge/profile/assertion/rubric/diagnostic/artifact ownership, two missing decision markers, an unlocked terminal threshold, and an opportunistic compressed-fixture fallback. All were corrected. Final re-review found only the protected marker-leg severity (`info`, not `warn`) and simple/permissive final PositionedScene filenames; both were corrected. The final reviewer found no remaining contract blocker.

**Invariant report.** Satisfied: every required topology has an exact fixture and assertion owner; primary is composition-rich while exceptional mechanics remain isolated and diagnosable; strict validation is controlled; bundle annotations and profiles are explicit; no coordinates preordain routes; hard assertions precede snapshots; visual review ownership and N/A policy are fixed; deterministic stage/diagnostic names are fixed; compressed contention cannot be tuned outside renewed Gate 1 review. Violated: none found. Deviation: the user-approved generic cycle-contract prerequisite is implemented, documented, and green; no other deviation occurred. Residual risk: visual width, chrome, routing templates, contention behavior, and final diagnostics remain deliberately unproven until their owning gates.

**Acceptance.** Accepted by the user on 2026-07-12. The reviewer confirmed the Gate 1 proof contract is sufficient to begin Gate 2. The Gate 1 checkpoint contains the approved bundle/validator prerequisite, its tests and commentary, the literal proof contract, and this execution record.

### Gate 2 — 2026-07-12 stop report: reference sort consumption

**Gate state.** Gate 2 opened only after the accepted Gate 1 checkpoint `c94eab8`. No Gate 2 fixture, production render-model change, test, snapshot, or rendered artifact has been created. Gates 3–10 remain blocked.

**Authority failure.** `bundle/v0.1/core/views.yaml` declares `journey_map.conventions.renderer_defaults.reference_annotations.sort: id_ascending`. `buildJourneyMapProjection(...)` reads the bundle-owned source property and target type, but `splitReferenceIds(...)` in the protected `src/projector/journeyMap.ts` always locale-sorts and does not receive the bundle sort field. The approved plan requires a bundle-only mutation to change intended runtime behavior and explicitly requires approval before modifying protected projection behavior.

**Smallest reproducer.** The locked primary literal source authors `opportunity_refs="OP-200, OP-100"`. With the real bundle, projection correctly produces `[OP-100,OP-200]`. A read-only in-memory bundle mutation that removes only `reference_annotations.sort` still produces `[OP-100,OP-200]` rather than source order `[OP-200,OP-100]`; `mutationChangedBehavior=false`. This proves the field currently does not govern runtime ordering.

**Recommended narrow repair.** Authorize an edit to `src/projector/journeyMap.ts` so `buildReferenceAnnotations(...)` passes the loaded `sort` value into generic reference splitting/ordering. `id_ascending` performs the current deterministic ID sort; absence of a configured sort preserves authored comma-list order. Add a focused bundle-mutation test showing that removing only the field changes projection order while the real bundle preserves every current projection snapshot. No parser, compiler, validator, bundle value, schema, profile, renderer, legacy text, or existing snapshot output should change.

**Invariant report.** Still satisfied: projection remains the semantic boundary; current bundle output is deterministic; no renderer policy has been added; no snapshot was refreshed. Violated by current runtime: the bundle sort convention is non-authoritative because a bundle-only change has no effect. Gate 2 cannot pass until the protected projection repair is explicitly approved, implemented, and proven. The alternative—keeping hardcoded sorting and weakening the bundle-dependence criterion—is not recommended and would contradict repository policy.

**Approval and repair boundary.** On 2026-07-12 the user authorized the recommended narrow projection repair. The current bundle value remains `sort: id_ascending`; therefore the repair must preserve the current bundle's projection bytes and every existing snapshot. The runtime may add only generic consumption of the loaded field: `id_ascending` sorts resolved IDs in ascending locale order, while an omitted field preserves the authored comma-list order. No new bundle keyword, default sort, parser/compiler/validator behavior, projection schema field, renderer policy, or snapshot refresh is authorized. A focused in-memory bundle mutation that removes only `sort` is the required proof that the field controls behavior. The implementation log must record the exact bundle path, runtime consumer, test, and before/after orders so the impact can be retraced later.

**Authorized projection repair result.** `bundle/v0.1/core/views.yaml#/views[id=journey_map]/conventions/renderer_defaults/reference_annotations/sort` remains unchanged at `id_ascending`. `buildReferenceAnnotations(...)` in `src/projector/journeyMap.ts` now passes the loaded field to generic reference-list ordering; the only recognized behavior is the declared `id_ascending` sort, and an absent or otherwise undeclared value leaves the parsed comma-list in author order. `tests/projectionSnapshots.spec.ts` compiles a reversed `OP-200, OP-100` source once, proves `[OP-100,OP-200]` with the real bundle, deletes only the loaded `sort` field in memory, and proves `[OP-200,OP-100]`. `TMPDIR=/tmp pnpm exec vitest run tests/projectionSnapshots.spec.ts` passed 1 file and 2 tests, including every manifest projection snapshot. Satisfied: bundle authority, current-byte preservation, projection boundary, and no hidden default. Violated: none after repair. No bundle, parser, compiler, validator, schema, renderer, legacy text, snapshot, or golden changed for this repair.

### Gate 2 — 2026-07-13 consolidated review package

**Implementation state.** Gate 2 production work and automated verification are complete and paused for the required consolidated human acceptance. Gate 3 has not begun. No Gate 2 checkpoint commit has been created because acceptance is still pending.

**Typed badge contract.** `JourneyRenderStep.badges` contains one `JourneyRenderReferenceBadge` per resolved, profile-visible projection reference. Each block retains the projection-owned role, target ID/type/name, source property, and the legacy bracketed display label. The same loop appends the unchanged bracketed value to `labelLines`, so staged consumers no longer need to parse legacy text while DOT/Mermaid retain byte-identical input. Simple exposes no badge blocks; permissive and strict expose `OP-100` then `OP-200`, with target-name/ID fallback kept in the existing label helper. A bundle-only mutation of `profile_display.simple.show_reference_badges` changes the typed model without a code edit.

**Stable edge identity decision.** The render-model builder now receives the loaded bundle and locates the generic common rule whose `rule_logic.kind` is `duplicate_edge_identity`; its bundle-declared `key_fields` are the only semantic identity field list. Matching retains projection multiplicity and array order while pairing each projected `(from,type,to)` occurrence with the corresponding compiled occurrence in source-span order. Programmatic spanless graphs use the pre-existing canonical compiled order as a deterministic fallback. The model stores `type`, global qualifying `authorOrder`, `sameEndpointOrdinal`, tagged-JSON `semanticIdentityKey` with stable property-key order, and `exactIdentityOrdinal`. The final ID is `from__type__to__sha256(semanticIdentityKey)__exactIdentityOrdinal`; it is not a bare global index, and unrelated/distinct same-endpoint insertions do not renumber an existing semantic occurrence. Any projected/compiled multiplicity mismatch throws a focused construction error instead of inventing identity. Mutating only the bundle identity fields to include `to_name` changes the identity keys, ordinals, and IDs, proving the runtime path is bundle-controlled.

**Locked fixtures and SDD helper impact.** The five accepted fixtures now exist under `tests/fixtures/render/`. They were created and authored exclusively through `skills/sdd-skill/scripts/run_helper.sh`: create revision, author dry-run, assessment check, same-candidate author commit, persisted strict/profile validation, and persisted projection. All five dry-runs returned `can_commit=true`; primary/compressed had no diagnostic, ordering had only `validate.contains_single_parent_recommended`, topology only `validate.precedes_cycle_policy`, and duplicate only `validate.duplicate_edge_detection`. Persisted validation returned `can_render=true` for all seven required profile runs. Persisted projections contain primary 14 nodes/17 edges/1 annotation, ordering 9/9/0, topology 9/15/0, duplicate 2/3/0, and compressed 9/24/0.

The helper's scaffold formatter omits blank separator lines and exposes no blank-line apply operation. An independent Gate 2 audit correctly treated that formatting drift as a blocker because Gate 1 declares the fenced blocks byte-exact. The missing separators were therefore restored as a formatting-only fallback after the helper completed every structural mutation; no semantic `.sdd` line was hand-edited. An automated byte comparison now reports `exact_locked_source=true` for all five files. Persisted helper validation was rerun after that correction and again returned the exact expected diagnostics, `can_render=true`, and `should_stop=false` for all seven required profile runs. Deviation status: resolved with no remaining fixture-content deviation; the helper limitation and formatting-only fallback are retained here for traceability.

**Focused proof.** `tests/journeyMapRenderModel.spec.ts` has ten tests covering projected-first parent selection, Stage `CONTAINS` edge-line order, interleaved top-level author order, empty/single Stages, Step-only roots, all duplicate occurrences, simple/permissive/strict badges, target-name/ID fallback, legacy `labelLines`, authored edge order independent from projection ordering, semantic identity equality/inequality, same-endpoint and exact-identity ordinals `[0,1,2]` and `[0,0,1]`, unique deterministic IDs, repeat builds, bundle identity mutation, bundle profile-display mutation, and the exact expected validation diagnostic per fixture/profile. The projection suite separately owns bundle reference-sort mutation proof.

**Commands and results.** `TMPDIR=/tmp pnpm exec vitest run tests/projectionSnapshots.spec.ts tests/render_profile_display.spec.ts tests/render_dot.spec.ts tests/render_mermaid.spec.ts tests/journeyMapRenderModel.spec.ts` passed 5 files and 28 tests. `TMPDIR=/tmp pnpm run build` passed. `git diff --check` passed. No snapshot or golden was refreshed. The two protected legacy journey DOT hashes remain `8eea08164170aa69730b348c24eebafbbec7614cf456fc29ac181982291fdb04` and `43269f0851ca96c9b370b02cc850345243e88da468ba465dc8d8ca61795d144e`; all fourteen Gate 0 protected staged-renderer hashes remain unchanged.

**Changed-file and invariant audit.** Intended production paths are the approved `src/projector/journeyMap.ts` repair, `src/renderer/journeyMapRenderModel.ts`, and the journey call site in `src/renderer/viewRenderers.ts`. Evidence is the five fixture files, `tests/projectionSnapshots.spec.ts`, `tests/journeyMapRenderModel.spec.ts`, and this ledger. Satisfied: bundle authority and mutation dependence; projection boundary; first-parent/source order; profile control; one typed badge per resolved reference; projected-edge multiplicity; stable semantic occurrence identity; unique IDs; deterministic repeat; legacy DOT/Mermaid bytes; protected renderer isolation; no external engine; and no snapshot normalization. Violated: none. Renderer diagnostic artifacts are not owned by Gate 2 and were not created. Residual risk: scene identity consumption, ports, geometry, and visual quality remain deliberately unproven until Gates 3–8.

**Independent review.** A read-only final audit found no bundle-authority leak, semantic-policy literal, identity/multiplicity defect, source-order defect, profile-badge defect, protected legacy-emitter change, or unproven Gate 2 model criterion. It initially blocked on the helper-created whitespace mismatch described above; that blocker is now resolved by exact-byte proof and persisted revalidation. Its non-blocking observation that target-name/ID fallback lacked a direct test was also closed by constructing a resolved projection reference without `target_name` and proving both the typed badge and legacy line fall back to `[OP-100]`.

**Human review request.** Confirm that the generic loaded-bundle identity fields—not renderer literal semantics—govern edge identity; the approved projection repair has no current-bundle byte impact; typed badges expose projection data without parsing `labelLines`; all five fixtures are now byte-exact; and no Gate 3 scene/layout policy has leaked into Gate 2. Acceptance authorizes the Gate 2 checkpoint commit and opens Gate 3 only after that commit.

**Acceptance.** Accepted by the user on 2026-07-13. Checkpoint `3900c5e` (`Gate 2 done`) succeeded and is recorded in the ledger. Gate 3 opened only after that checkpoint was present.

### Gate 3 — 2026-07-13 opening record

**Gate state.** Gate 3 opened after accepted Gate 2 checkpoint `3900c5e`. Scope is backend-neutral `RendererScene` construction and its focused semantic proof only; measurement, coordinates, routing geometry, SVG/PNG, preview integration, and goldens remain blocked by later gates. Temporary semantic JSON is permitted for Gate 3 review, while the checked-in RendererScene snapshot remains blocked until Gate 3 structural assertions and human review pass, as required by the Gate 3 artifact policy.

### Gate 3 — 2026-07-13 stop report: disconnected-chain diagnostic

**Gate state.** Work stopped before adding `src/renderer/staged/journeyMap.ts`, the journey scene suite, or any scene snapshot/review artifact. The only Gate 3 code in progress is additive typed journey item/edge metadata in the shared scene contract and preservation of that optional edge metadata through generic measurement/positioning. Protected renderers remain untouched. Gates 4–10 remain blocked.

**Contract ambiguity.** The accepted Gate 1 matrix assigns scene/info `renderer.scene.journey_map_disconnected_chain` to the primary fixture's main/root components and forbids unexpected renderer diagnostics in the other accepted fixtures, but it does not define the component universe, main-component selection, treatment of isolated Steps, or interaction with cycles. A generic weak-component check over `PRECEDES` would also find multiple components in ordering/ownership (the contained chain, root return chain, and isolated `J-601`/`J-602`) and topology (including the isolated unannotated cycle), contradicting the locked per-case expectations. Suppressing those cases by fixture ID or literal node ID is forbidden semantic-policy leakage.

**Recommended generic trigger.** Amend the diagnostic contract so scene construction emits `journey_map_disconnected_chain` only when all of these conditions hold: (1) the projected Step `PRECEDES` graph is acyclic and has no self-loop; (2) every projected Step is incident to at least one `PRECEDES` edge, so isolated structural Steps do not turn an ownership/order proof into a connectivity diagnostic; and (3) the graph has exactly two edge-bearing weak components. The component containing the lowest flattened visual Step order is the main component. Emit one info diagnostic for the other component, with its lowest-order Step as `targetId` and all component Step IDs in flattened visual order in `details`. This deterministically yields only `[J-250,J-260]` for primary; ordering is excluded by isolated Steps, topology by cycles, and duplicate/compressed by being connected.

**Alternatives.** A broad component rule would require amending the ordering/topology diagnostic expectations and deciding how noisy isolated Steps should be. Deferring the decision to Gate 8 does not resolve the scene-phase contract and would leave Gate 3's accepted semantic snapshot incomplete. Omitting the diagnostic contradicts the already accepted full code/trigger matrix. The recommended rule is the narrowest generic, fixture-independent definition found from the approved proof corpus.

**Invariant report.** Still satisfied: Gate dependency order, bundle/model semantic boundary, no external engine, protected renderer isolation, no snapshot capture, and no geometry/routing implementation. Unresolved: the exact scene diagnostic trigger. No production journey scene, test, artifact, or golden has been created. Approval is required before the Gate 1 diagnostic contract is amended and Gate 3 implementation resumes.

**Stop-state validation.** `TMPDIR=/tmp pnpm run build` passed after the additive metadata work in progress. `git diff --check` passed. The only uncommitted paths are this ledger plus `src/renderer/staged/contracts.ts`, `microLayout.ts`, and `macroLayout.ts`; no protected renderer, fixture, snapshot, or golden changed.

**Approval and contract amendment.** On 2026-07-13 the user accepted the recommended generic trigger. The Gate 1 proof contract now defines `journey_map_disconnected_chain` as an acyclic, no-isolate, exactly-two-edge-bearing-weak-components condition; the component containing the lowest flattened visual Step order is main, and the other component owns the info diagnostic. This yields primary `[J-250,J-260]` without fixture-specific branching and leaves ordering, topology, duplicate, and compressed at their locked diagnostic expectations. Gate 3 resumed only after this amendment was recorded.

### Gate 3 — 2026-07-13 consolidated implementation and review package

**Gate state.** Automated and independent review criteria pass; Gate 3 is paused for its single blocking human review. No Gate 4 measurement/placement work has begun, no checked-in scene snapshot or golden has been captured, and no Gate 3 checkpoint exists. On acceptance, the exact accepted temporary semantic artifact will be copied into the owned scene snapshot location, byte-compared, revalidated, and committed before Gate 4 opens.

**Implementation.** New `src/renderer/staged/journeyMap.ts` constructs the backend-neutral scene directly from `buildJourneyMapRenderModel(...)` using the loaded bundle, the view's hierarchy/ordering edge lists, and resolved profile display policy. The root retains the model's interleaved source order; Stages are titled horizontal `cluster` containers, including empty and single-Step Stages; Step cards carry deterministic root/Stage/local/global order metadata plus mutually exclusive contained/root semantic classes. Title blocks use the typed Step title, and reference badge blocks use typed resolved target names with target-ID fallback without parsing legacy `labelLines`. Every Step declares west/east flow and south escape roles with no north port.

Every model edge is copied once with its Gate 2 ID unchanged, orthogonal intent, target arrow, semantic port-role preferences, common semantic owner, and typed author/same-endpoint/exact-identity ordinals. Scene endpoints intentionally contain only item IDs: explicit port IDs would prematurely bind backward, cycle, self-loop, and later escape routes before their owning routing gates. Route priority is likewise not invented in Gate 3; `authorOrder` remains typed input from which the Gate 5 connector plan may derive its approved priority policy. Erased guard/property identity material does not become scene payload, and no adjacency, hierarchy, or sibling-chain edge is inferred.

**Diagnostics.** Scene diagnostics are derived independently rather than copied from validator output or free-text projection notes. Primary simple/permissive/strict emit only info `renderer.scene.journey_map_disconnected_chain` targeting `J-250` with ordered related IDs `[J-250,J-260]`. Ordering/ownership emits only info `renderer.scene.journey_map_first_parent_selected` for `J-503`, with distinct candidate Stages `[G-500,G-600]` and selected `G-500`; repeated hierarchy occurrences from one Stage do not trigger it. Duplicate emits only info `renderer.scene.journey_map_step_only` for `[J-801,J-802]`. Topology and compressed emit no scene diagnostic. A direct negative model test retains duplicate edge occurrences and emits error `renderer.scene.journey_map_duplicate_edge_id` for an intentionally collided ID. Diagnostics are deterministically sorted, and accepted fixtures contain no renderer warning/error.

**Review correction record.** The first independent code review found four gate-boundary defects: missing contained/root classes, explicit flow-port IDs that constrained later exceptional routing, route priority prematurely equated with author order, and optional edge metadata propagation into Gate 4 measurement/positioning contracts. It also found duplicate hierarchy occurrences were not de-duplicated and owner/profile proof was incomplete. All were corrected before artifact capture: semantic classes were added; endpoint port IDs and route priority were removed; `MeasuredEdge`, `PositionedEdge`, micro-layout, macro-layout, and the measurement assertion returned to the Gate 2 baseline; distinct parents now preserve insertion order through de-duplication; exact semantic owners now cover every proof-corpus edge; and simple/permissive/strict scene intent parity is tested. The second read-only review confirmed every finding closed and found no new production blocker. This is a review-driven correction inside Gate 3, not a retained deviation.

**Automated validation.** `TMPDIR=/tmp pnpm exec vitest run tests/stagedJourneyMap.spec.ts tests/stagedSceneBuilders.spec.ts tests/stagedRenderer.spec.ts` passed 3 files and 28 tests. `TMPDIR=/tmp pnpm run build` passed. `git diff --check` passed. Two fresh semantic artifact generations produced identical SHA-256 listings. All fourteen Gate 0 protected staged-renderer hashes and both protected legacy journey DOT hashes remain byte-identical. Changed production scope is only the new scene builder and additive scene-contract metadata; proof scope is `tests/stagedJourneyMap.spec.ts`; documentation scope is the accepted Gate 1 diagnostic amendment and this append-only record. No projection, bundle, fixture, protected renderer, measurement/layout module, snapshot, golden, DOT, Mermaid, SVG, or PNG changed.

**Temporary review artifacts.** `/tmp/journey-map-review/gate3/manifest.json` summarizes seven deterministic cases: primary under simple/permissive/strict and ordering/ownership, topology, duplicate, and compressed under strict. It records root order, edge count, diagnostics, and per-scene hashes. The full semantic JSON files beside it are review-only and intentionally outside the repository until acceptance. Manifest SHA-256 is `fef1a957e3428ae36598c6ba906b9fe1adbe4f1563af230ab4de7f59af419358`; primary strict is `f9eab93d2c069f343a0ee78d6ae86fd216aad7b52158c696e42f8c725dd35145`.

**Invariant report.** Satisfied: gate dependency order; loaded-bundle/model semantic authority; source and first-parent order; empty/single/Step-only hierarchy; typed profile badges; stable exactly-once edge identity including duplicates; full semantic owner matrix; port-role declaration without route selection; deterministic diagnostics and serialization; no forbidden geometry, final line breaks, routes, backend payload, ELK, external engine, protected behavior change, snapshot normalization, or hidden TypeScript policy. Violated: none. Provisional root/Stage gaps, padding, header intent, and width/overflow policy are structural scene inputs only; their measured proportions and visual quality remain explicitly unaccepted until Gate 4. Edge-metadata propagation and route-priority classification remain deliberately deferred to their owning gates.

**Human review request.** Confirm that the seven-case semantic package has the locked source-ordered hierarchy, typed profile content, item-only edge endpoints with semantic port preferences, complete edge multiplicity/owners, and only the intended diagnostics; that no Gate 4 geometry or Gate 5+ routing policy leaked into the scene; and that the accepted disconnected-chain amendment is represented exactly. Acceptance authorizes capture of the byte-identical primary strict RendererScene snapshot, final Gate 3 validation, and the Gate 3 checkpoint commit. Gate 4 remains blocked until that checkpoint succeeds.

### Gate 3 — 2026-07-13 acceptance and evidence capture

**Acceptance.** The user accepted the consolidated Gate 3 package on 2026-07-13. Gate 4 remains blocked until the focused Gate 3 checkpoint succeeds.

**Accepted evidence.** The reviewed temporary semantic bytes were captured under the exact Gate 1 names owned by Gate 3: primary strict, simple/permissive badge variants, ordering/ownership, topology, and duplicate RendererScenes. Their repository SHA-256 values exactly match the reviewed temporary artifacts: primary `f9eab93d2c069f343a0ee78d6ae86fd216aad7b52158c696e42f8c725dd35145`; simple badges `b743af3a698b0dd92419f5f01b99cb62aa80fdc4e845047034d8be07c302b433`; permissive badges `45d2029327c992602ed7ae102561d57b7026e616124dff5707523a3000fc9962`; ordering/ownership `9cad371385a238d9605d2cf772a7e840080a8bc6210702f3de65f05a1961be31`; topology `c683788ddbc392cb0e4f2c9502e9076facab1fde8ddf6f862798b769adb2b32c`; duplicate `c5aeda2e1d86f89cbeeae093e03cca5067e22271a740255870beda18c1a689eb`. Compressed has no RendererScene filename in the accepted evidence-name contract and therefore received no Gate 3 golden.

**Post-acceptance validation.** The focused scene suite now byte-compares all six accepted repository snapshots. `TMPDIR=/tmp pnpm exec vitest run tests/stagedJourneyMap.spec.ts tests/stagedSceneBuilders.spec.ts tests/stagedRenderer.spec.ts` passed 3 files and 29 tests. `TMPDIR=/tmp pnpm run build` and `git diff --check` passed. No accepted semantic value changed during capture; no snapshot was refreshed to hide a defect. The checkpoint is the only remaining Gate 3 action.

**Checkpoint.** Commit `d40a2fc` (`Gate 3: add journey RendererScene`) succeeded with only the reviewed Gate 3 production, proof, accepted snapshot, diagnostic-amendment, and ledger files. Gate 4 opened only after this checkpoint existed.

### Gate 4 — 2026-07-13 opening record

**Gate state.** Gate 4 is active. Scope is shared measurement plus source-ordered journey pre-routing placement and its accepted no-edge review artifacts. Dedicated route construction, endpoint competition, route archetypes, occupancy, public preview selection, corpus regeneration, and legacy removal remain blocked by Gates 5–10. The Gate 3 scene semantics and snapshots are now protected inputs: any required hierarchy, semantic endpoint, source-order, profile, or diagnostic change triggers the stop policy rather than being normalized through geometry.

### Gate 4 — 2026-07-13 stop report: intrinsic viewport contradiction

**Gate state.** Work stopped during the read-only baseline before any Gate 4 production, test, golden, or review-artifact change. The only post-checkpoint working-tree change is this main-ledger record. Gates 5–10 remain blocked.

**Reproducer.** Measuring the accepted primary/strict Gate 3 scene with shared `measureRendererScene(...)` and placing it with `positionMeasuredSceneBeforeRouting(...)` produces an intrinsic root size of `3023.576 × 264` scene/CSS pixels. The accepted visual contract requires that primary fit a `1680×1050` CSS-pixel viewport at 100% browser zoom, intrinsic SVG size, one scene unit per CSS pixel, and no downscaling. This is not primarily gutter tuning: the measured semantic items alone require at least `2519.576px` before root/Stage padding and required gaps (`G-100` cards `224+304+224`; `G-200` cards `4×224`; two root Steps `2×224`; empty `G-300` header about `199.576`; `G-400` card `224`). Therefore the accepted horizontal root and Stage stacks using the Gate 4 `standard→wide` proof policy cannot fit within `1680px`, even with zero padding and gaps.

**Contract conflict.** Preserving the accepted source-ordered horizontal root/Stage-child architecture and standard/wide readable cards violates the primary must-fit viewport invariant. Satisfying must-fit requires a material amendment: allow intrinsic horizontal scrolling; permit multi-row/wrapped root or Stage layout; or replace the locked standard/wide proof policy with substantially narrower cards and much taller wrapping. The repository does not authorize one choice over the others, and a geometry tweak cannot reconcile them. Per the stop policy, no implementation or snapshot refresh may proceed without user direction.

**Recommendation.** Amend only the primary must-fit clause to allow horizontal scrolling at intrinsic 100%, retaining a fit-to-viewport overview solely for whole-map composition and retaining intrinsic 100% review for text, Stage chrome, spacing, and route readability. This preserves source order, conventional journey-map left-to-right reading, readable standard/wide cards, and the accepted scene hierarchy. Multi-row wrapping would change placement semantics and complicate later route archetypes; chip/narrow cards would undermine the long-label and badge proof and still leave little room for required routing gutters.

**Pre-routing representation clarification.** The Gate 1 assertion table says one semantic occurrence with no route geometry at RendererScene, MeasuredScene, and pre-routing, while the accepted Gate 4 action uses shared `positionMeasuredSceneBeforeRouting(...)`. That established function intentionally returns `PositionedScene.edges=[]`, and `PositionedEdge` cannot represent an unrouted occurrence because `route` is required. The narrow repository-consistent clarification is that the pre-routing artifact *bundle* proves exactly-once semantics through its accompanying `RendererScene.edges` and `MeasuredScene.edges`, while `preRoutingPositionedScene.edges` remains empty and its SVG contains no positioned semantic connector/edge instances. The shared backend's static edge CSS and marker definitions may remain because they do not instantiate an occurrence. Adding a route-less positioned-edge variant would broaden shared contracts without improving placement proof and would contradict the explicit requirement that pre-routing routes are absent. This clarification is included in the requested contract decision; implementation remains paused until accepted.

**Secondary non-blocking finding.** The shared `escalate_width_band` policy currently measures secondary-priority badge blocks in the primary content region; the existing `secondary_area` policy moves them but cannot compose with width escalation. Once the viewport contract is resolved, Gate 4 should add an opt-in generic/composable priority-to-secondary-region measurement policy rather than a journey-specific heuristic. This issue is resolvable from the accepted architecture and does not require a separate user decision.

**Invariant report.** Satisfied: Gate dependency order; accepted Gate 3 checkpoint; loaded-bundle/scene authority; source order; current standard/wide measurement; no production or artifact mutation; no protected renderer change; no snapshot normalization. Violated by the simultaneous accepted contract: primary intrinsic width `3023.576px` exceeds `1680px`, with an irreducible semantic-width lower bound of `2519.576px`. Residual risk after the recommended amendment is intentional horizontal navigation for primary review; all vertical fit, intrinsic readability, overlap, gutter, deterministic-placement, and later routing invariants remain binding.

**Amendment acceptance and resume.** On 2026-07-13 the user accepted both recommended amendments. Primary may scroll horizontally at intrinsic 100%, with fit-to-viewport used only for composition and intrinsic review retained for readability and geometry. Pre-routing exactly-once evidence is the paired artifact bundle: `RendererScene.edges` and `MeasuredScene.edges` retain every unrouted occurrence, while `preRoutingPositionedScene.edges=[]` and its SVG contains no positioned semantic connector/edge instances; static shared CSS and marker definitions are not semantic instances. The accepted source-ordered horizontal composition, standard/wide policy, and mandatory vertical/intrinsic quality checks are unchanged. Gate 4 resumed only after these contract changes were recorded.

### Gate 4 — 2026-07-13 consolidated implementation and review package

**Gate state.** Production, automated acceptance, independent read-only audit, and the agent visual pass are complete. Gate 4 is paused for its single blocking user review; Gate 5 has not begun. No Gate 4 measured/pre-routing golden has been captured and no checkpoint exists. The two RendererScene evidence edits described below remain proposed and uncommitted with the rest of Gate 4 until this review is accepted.

**Implementation and material decisions.** `ContentBlock.region` is an optional backend-neutral layout intent. Shared measurement honors it before the existing overflow-policy-derived region, so journey badges can remain secondary while the card independently uses `standard -> wide` escalation; inputs that omit it retain prior behavior. Shared measurement also clones optional typed edge metadata into `MeasuredEdge`, which makes the amended exactly-once ledger available without route geometry. The journey orchestrator builds `RendererScene -> MeasuredScene -> pre-routing PositionedScene -> SVG -> PNG`; PNG is generated from, and returns, the exact SVG bytes exposed by the artifact result, including backend diagnostics.

Source order owns placement and PRECEDES presence/order has no geometry effect. Stages share a common top edge and retain natural height rather than being equalized. Direct root Steps align with the Stage card/content row through a typed journey post-layout callback. Accepted baseline whitespace is 24px between adjacent Steps, 20px Stage-local bottom space, 40px between root items, and 32px root-outer bottom space. Empty and single-Stage bounds remain natural. Primary strict/permissive measure `3023.576 × 268`, primary simple `3023.576 × 208`, ordering/ownership `1904 × 208`, topology `2096 × 208`, duplicate `552 × 112`, and compressed `1888 × 192`; all satisfy the amended horizontal-scroll contract and vertical `<=1050px` fit.

**Evidence and diagnostics.** `/tmp/journey-map-review/gate4/` contains 36 review-only files: measured JSON, positioned JSON, intrinsic SVG, shared 192-DPI PNG, and composition-only fit overview for each of the seven locked fixture/profile runs, plus `manifest.json`. The package was regenerated twice after the final audit corrections and all 36 file hashes were identical. The final manifest SHA-256 is `8155091f78093ce5f54b090af03d0e295de16cfcbe49a5494ea7efb66a9a595b`. Primary strict evidence hashes are measured `f694b651f2fb4cf1e5aee7c5708fbe225ab1fa7014e7c885040b2620c21907c4`, positioned `b40529183be64b33585680b28d5765ef43b5d866913a5e367189b66cda8e8d13`, stored SVG `9e2fc5e2e18c8a2043ec4d185d15badea412987000999269a718a399403ef082`, PNG `2cd0178ab2d7e50f925d409cefb81bb70034df8ca391f84428da4c5f06057c86`, and fit overview `354838f2b8a93c3e68764d117a51c03c1145e6dde0499343566ffc59ad85c030`. The stored SVG hash includes the review file's terminal LF; the manifest also records the raw returned SVG hash.

Expected diagnostics are unchanged and contain no warn/error: primary has only `journey_map_disconnected_chain` info, ordering/ownership only `journey_map_first_parent_selected` info, duplicate only `journey_map_step_only` info, and topology/compressed none. RendererScene and MeasuredScene preserve the exact ID array, count, and independently cloned typed metadata for every occurrence in all seven runs; duplicate retains three occurrences. Pre-routing PositionedScenes have `edges=[]` and `decorations=[]`; SVGs have no semantic edge group or `data-edge-id`, while generic static CSS/marker definitions remain inert.

**Proposed RendererScene evidence evolution.** Explicit badge region intent adds only `region: "secondary"` to the two badges in each of `journey-map.primary.renderer-scene.json` and `journey-map.badges.permissive.renderer-scene.json`. A byte audit proved that these four additive fields are the entire evolution; simple, ordering/ownership, topology, duplicate, and unrelated goldens are byte-identical. This is Gate 4 measurement intent, not a hidden semantic or broad snapshot refresh. The proposed diffs remain uncommitted pending acceptance.

**Validation.** `TMPDIR=/tmp pnpm exec vitest run tests/stagedJourneyMap.spec.ts tests/journeyMapPreRouting.spec.ts tests/stagedRenderer.spec.ts tests/stagedSceneBuilders.spec.ts tests/stagedSvgBackend.spec.ts` passed 5 files and 44 tests. The focused shared regression command for macro-layout, scenario-flow pre-routing, service-blueprint pre-routing, and staged outcome-opportunity passed 4 files and 24 tests. `pnpm build` and `git diff --check` passed. All fourteen Gate 0 staged-renderer hashes and both legacy journey DOT hashes remain exact. Tests cover all-case edge preservation, every measured card block inside bounds and pairwise non-overlap, font-backed exact wrapping, distinct badge/header regions, standard/wide escalation, source order, natural Stage chrome, empty/single Stages, mixed root Steps, fixed whitespace, edge-order independence, backend diagnostics, connector-free semantic output, exact SVG-to-PNG derivation, horizontal scrolling, vertical fit, and deterministic reruns.

**Independent review and invariant report.** The final read-only audit found the production changes generic/additive, the journey composition route-free, and protected behavior unchanged. It initially identified missing all-case occurrence proof, all-card clipping/overlap proof, backend diagnostic propagation, literal connector-markup wording, and explicit overview evidence. Those gaps are now closed by focused tests, returning PNG/SVG backend diagnostics from the orchestrator, narrowing the wording to semantic instances, and seven deterministic fit overviews. Satisfied: gate order; backend-neutral scenes; source order; explicit staged pipeline; no ELK/external router; no routing/preview leakage; standard/wide and badge separation; geometry containment; no warn/error; deterministic LF artifacts; protected legacy/staged output. Violated: none. Residual risk: Gate 5+ routing may require bounded gutter expansion, but cannot change the accepted item order or bounds policy.

**Agent visual verdict and human review request.** PASS: left-to-right no-edge reading, intrinsic long-label and badge readability, intentional Stage chrome/whitespace, empty/single Stage behavior, mixed root-Step alignment, and whole-map composition in the fit overviews. Routing dimensions are `N/A` until their owning gates. Confirm the intrinsic and overview artifacts meet the Gate 4 human criteria. Acceptance authorizes exact capture of the owned measured/pre-routing goldens, revalidation, and the Gate 4 checkpoint; Gate 5 remains blocked until that checkpoint succeeds.

### Gate 4 — 2026-07-13 acceptance and evidence capture

**Acceptance.** The user accepted the consolidated Gate 4 package on 2026-07-13. Gate 5 remains blocked until the focused Gate 4 checkpoint succeeds.

**Accepted evidence.** The eight Gate 4-owned reviewed JSON artifacts were copied byte-for-byte into their exact Gate 1 names. Repository hashes are: primary measured `f694b651f2fb4cf1e5aee7c5708fbe225ab1fa7014e7c885040b2620c21907c4`; primary pre-routing positioned `b40529183be64b33585680b28d5765ef43b5d866913a5e367189b66cda8e8d13`; simple badges measured `2fdcb41f3bde1ab9ed36a4adf5b60a4347a0a01993b6bfa77a2026813a3084da`; permissive badges measured `55c4c4800437b7806bc766abcf4cf3bd6a4e638eba89e838b13108978f0176b5`; ordering/ownership pre-routing positioned `3e487c5e014f62a558d4f2623ea5171c519fb97a9cd0aefefbde3b33e6e292c7`; topology pre-routing positioned `2ae8d12bc301be8e132f1a36289734f3f81e2ef3a52f721daaa3e298f3217270`; duplicate pre-routing positioned `5798fe18d3f9227cbe16a3fb68a645f3dd49f8801382655c30006208a066a4db`; compressed pre-routing positioned `4686c8554ae592fa1c9088c42d05a2f6cf7582c997ba5a3e2a320ebb59c236a5`. The accepted RendererScene evidence evolution remains the four reviewed additive badge-region fields only.

**Post-acceptance validation.** The pre-routing suite now byte-compares all eight accepted Gate 4 repository artifacts. `TMPDIR=/tmp pnpm exec vitest run tests/stagedJourneyMap.spec.ts tests/journeyMapPreRouting.spec.ts tests/stagedRenderer.spec.ts tests/stagedSceneBuilders.spec.ts tests/stagedSvgBackend.spec.ts` passed 5 files and 45 tests. The build, whitespace, protected-baseline, and changed-file audits remain required immediately before the checkpoint.

**Checkpoint.** Commit `ad75f44` (`Gate 4: add journey measurement and pre-routing`) succeeded with only the reviewed Gate 4 production, contracts, tests, accepted evidence, amendment, and ledger files. Gate 5 opened only after this checkpoint existed.

### Gate 5 — 2026-07-13 opening record

**Gate state.** Gate 5 is active. Scope is dedicated basic journey PRECEDES routing for adjacent same-Stage and simple adjacent cross-Stage families, with explicit plans and step-2 routes. Gate 6 archetypes, Gate 7 occupancy/expansion, Gate 8 final endpoint ordering/diagnostics, preview integration, and corpus regeneration remain blocked. Gate 4 source order, measured bounds, natural Stage policy, root alignment, and accepted pre-routing evidence are protected inputs.

**Locked Gate 5 family boundary.** Classification uses typed Stage/root placement plus degrees computed over every measured PRECEDES occurrence. Only three primary occurrences qualify: `J-101→J-102` and `J-102→J-103` as simple adjacent forward same-Stage routes, and `J-103→J-201` as the simple adjacent forward cross-Stage route. A basic edge requires source outdegree one and target indegree one; same-Stage Steps must be consecutive, while the cross-Stage case must connect the last Step of one Stage to the first Step of the next adjacent root Stage. The boundary-Step condition is the narrow Gate 5 decision implied by direct legal approaches. Adjacent edges carrying branch/join modifiers, root-Step edges, non-adjacent/long edges, backward/cycle/self-loop edges, and duplicates remain explicitly deferred to Gate 6+.

**Partial debug evidence decision.** Gate 5 returns a typed stable deferred-edge ledger so the union of routed and deferred IDs equals all measured IDs exactly once. Intentionally deferred families do not emit omission/fallback diagnostics. The Gate 5 primary step-2 scene is therefore explicitly partial basic-routing debug evidence, not the complete primary step-2 proof. Official `journey-map.primary.step-2.*` capture remains blocked until Gate 6 accepts every route archetype, as required by the staged artifact timing. Calling the three-edge debug scene complete or updating the official step-2 goldens now is a stop condition.

### Gate 5 — 2026-07-13 implementation and consolidated review package

**Implementation result.** `src/renderer/staged/journeyMapRouting.ts` now owns a dedicated, backend-neutral basic journey router. It builds typed connector plans with the stable Gate 2 occurrence ID, author and duplicate ordinals, lowest accepted owner, deterministic priority, semantic east/west endpoints, node-side buckets, locked Stage gates, markers, step-2 templates, and final-basic routes. `src/renderer/staged/journeyMap.ts` exposes paired debug artifacts and derives each PNG from the exact SVG returned by the same render call. The only shared routing change is the additive export of the existing `MIN_ARROW_MARKER_LEG = 12` constant; its value and established behavior are unchanged.

**Classification and coverage decision.** Basic eligibility is semantic, not geometric: it uses typed Stage/root/Step source order and degrees computed over every measured edge occurrence. The primary fixture routes exactly `J-101→J-102`, `J-102→J-103`, and `J-103→J-201`. Its other six occurrences are represented exactly once in the typed deferred ledger as branch, join, non-adjacent same-Stage, long cross-Stage, or root-Step work. The locked fixture matrix proves that every measured ID is in exactly one of routed, deferred, or failed; no Gate 6 family is routed early and no intentional deferral produces an omission/fallback diagnostic.

**Geometry and validation result.** Same-Stage routes use ordinary exterior east/west ports and a minimal orthogonal midpoint dogleg with 12px source and target marker legs. The simple cross-Stage route uses the adjacent root gutter and typed source-east/target-west Stage gates. Step 2 retains the route template's gutter controls; final-basic reconstruction inserts both locked boundary-gate vertices, so the two PositionedScenes and SVG byte streams are observably distinct even where the collinear vertices rasterize to identical pixels. Both stages are independently checked for a non-empty source-to-target connection, orthogonality, endpoint exteriority, Step/header/badge/unrelated-Stage clearance, terminal marker-leg length, and the archetype-specific gate count, order, Stage, side, vertical bounds, and route membership. Locked structural diagnostics cover missing endpoints, omissions, duplicate IDs, diagonals, disconnected routes, insufficient marker legs, illegal intersections, and invalid gates.

**Automated validation.** `TMPDIR=/tmp pnpm exec vitest run tests/journeyMapPreRouting.spec.ts tests/journeyMapRouting.spec.ts` passed 2 files and 16 tests. `TMPDIR=/tmp pnpm exec vitest run tests/scenarioFlowRouting.spec.ts tests/outcomeOpportunityMapRouting.spec.ts tests/stagedServiceBlueprint.spec.ts tests/stagedVisualAcceptance.spec.ts tests/stagedMacroLayout.spec.ts` passed 5 files and 44 tests. `pnpm build` and `git diff --check` passed. The tests directly compare the orchestrator's PNG with the PNG rendered from its returned SVG. All fourteen Gate 0 staged-renderer hashes and both legacy journey DOT hashes remain exact. The changed-file audit contains only this ledger, `journeyMap.ts`, the additive `routing.ts` export, new `journeyMapRouting.ts`, and `tests/journeyMapRouting.spec.ts`; no bundle, projection, schema, fixture, accepted golden, protected renderer, legacy emitter, preview selector, or corpus file changed.

**Review artifacts and determinism.** `/tmp/journey-map-review/gate5/` contains 25 review-only files for primary simple, permissive, and strict profiles: routing evidence, step-2 and final-basic PositionedScenes, SVG/PNG renders, fit overviews, and `manifest.json`. Two complete regenerations produced identical hashes for all 25 files. The manifest SHA-256 is `3a0a8d17210c1080e474c75d1a0ce3c6e8d363dfc3eacb41a33fadc26a063ddf`. Key strict file hashes are routing evidence `be5138ce2dee214bc159fd8594dbfbf47c4f2338b1517abf197b5c9a3290c0fa`, step-2 PositionedScene `24d946447b979c080f7d445558e4aa62b69d245efff4f50658d58f7eb1d7ffb4`, final-basic PositionedScene `73583b76f87c68e8109a480a18d43cdcc52377533d41aa555b45d3c66d27c995`, stored step-2 SVG `6016722e2ed2a15bfcb2b8c66baab9daba8fcc60f7d9a904b0520117f2c8e1aa`, stored final-basic SVG `f5f40fa6121dbf65f798154139ae129f8e82c1cc21bf3a28e47b2831d5e168c6`, exact shared PNG `dd488f89eb1c163fcee07f14ace58304a426e61ea4613dedb22dd18ff272ed5d`, and fit overview `7b02223164f8ba0d924442c8c64cff3e86f5367db504604e401b88dfc3921326`. The package and filenames explicitly say `basic-partial`; `completePrimaryStep2` is false and no official step-2 golden was captured.

**Diagnostics, review, and invariants.** Normal primary runs have no routing warning/error and no failed connector; they retain only the already accepted scene-info diagnostic for the disconnected `J-250→J-260` chain. The agent visual verdict is PASS for direct forward tracks, clear target arrows, consistent east/west ports, minimal bends, correct adjacent Stage-gutter traversal, Stage/header/Step/badge clearance, and unchanged source-ordered geometry in both intrinsic and fit views. The initial independent read-only audit found three code blockers: placement-dependent classification, acceptance of empty/disconnected routes, and validation of final-basic only. All were corrected and covered by negative/positive tests; the final re-audit found no remaining code blocker. Satisfied: Gate dependency order, typed semantic classification, exactly-once identity coverage, explicit debug/control seams, source order, backend-neutral routing data, hard basic geometry checks, deterministic SVG/PNG derivation, protected renderer isolation, and no external engine. Violated: none.

**Decisions, deviations, and residual risk.** No architectural or scope deviation was required. The material artifact-timing clarification is that Gate 5 evidence is intentionally partial and the complete official primary step-2 proof waits for Gate 6; this preserves the plan's archetype-acceptance boundary instead of normalizing unrouted edges. Route occupancy, endpoint competition, bounded expansion, non-basic archetypes, complete primary routing, final diagnostics, preview integration, and corpus/golden capture remain assigned to Gates 6–10. Gate 6 remains blocked until the user accepts this combined automated and visual package and the focused Gate 5 checkpoint succeeds.

**Human review request.** Confirm that the three basic routes are direct and readable, arrows and east/west approaches are clear, the cross-Stage route uses the adjacent gutter and both correct boundaries, no needless bend or collision is visible, and the explicitly partial/deferred boundary is acceptable. Acceptance authorizes the Gate 5 checkpoint only; Gate 6 will then proceed one blocking route family at a time in the approved order.

### Gate 5 — 2026-07-13 acceptance record

**Acceptance.** The user accepted the consolidated Gate 5 automated and visual package on 2026-07-13, including the explicitly partial basic-routing boundary and the decision to defer complete official primary step-2 evidence until Gate 6. No review-only artifact is copied into the repository at this boundary. Gate 6 remains blocked until the focused Gate 5 post-acceptance validation and checkpoint succeed.

**Post-acceptance validation and checkpoint.** The focused 2-file/16-test command, the protected 5-file/44-test shared-routing command, `pnpm build`, `git diff --check`, all fourteen protected staged-renderer hashes, and both legacy journey DOT hashes passed unchanged. Commit `4ad14e2` (`Gate 5: add basic journey routing`) contains only the accepted Gate 5 production, test, and ledger files. Gate 6 opened only after that checkpoint existed.

### Gate 6 — 2026-07-13 same-Stage skip opening record

**Family state.** Only the first approved Gate 6 family, non-adjacent same-Stage skip routing, is active. Long cross-Stage/root, branch, join, backward, cycle, self-loop, and duplicate families remain blocked. This family may extend the dedicated journey router, its focused tests, and review-only debug artifacts; it may not change accepted placement, reorder source items, introduce occupancy/expansion early, use an external engine, or refresh official step-2 goldens before every Gate 6 family is accepted.

**Locked eligibility and exclusions.** Exactly one occurrence enters this family: strict ordering/ownership `J-503→J-501`, stable ID `J-503__PRECEDES__J-501__c8f35bbd840d5e1bff1eb4eed771c5362ef16bd9c7f80e653a3aa392b25477c8__0`, author/same-endpoint/exact-identity ordinals `0/0/0`, accepted first-parent owner `G-500`. Eligibility requires typed same-Stage membership, `target.stepOrder > source.stepOrder + 1`, one same-endpoint occurrence, no cycle/backward relation, source outdegree one, and target indegree one over all measured occurrences. Primary `J-201→J-203` and `J-202→J-204`, compressed `J-901→J-903` and `J-911→J-913`, and every other branch/join-modified skip remain deferred until their named family gates. Ordering `J-501→J-502` and `J-591→J-590` remain deferred backward/root work. Primary retains exactly its three accepted Gate 5 plans and bytes.

**Locked route contract.** The archetype is `non_adjacent_forward_same_stage`, priority rank 2 after the two accepted basic ranks, owner `G-500`, and no Stage-boundary gates. It resolves `journey_escape_out` and `journey_escape_in` on the south sides and records a typed Stage-local bypass control seam; its node buckets likewise use south, not east/west. The nominal track is computed generically as the maximum bottom of owning-Stage children intersecting the source-to-target span, including endpoints, plus `MIN_ARROW_MARKER_LEG`; the route is a vertical south departure, one horizontal forward track below the intervening Steps, and a vertical south arrival. The track must remain strictly inside the accepted Stage bottom. Insufficient space emits the locked archetype-fallback plus omission diagnostics and fails this family; bounds expansion and occupancy are Gate 7 work and may not be pulled forward.

**Proof and review contract.** Accepted-coordinate evidence, never production literals, is source `(980,156)`, target `(1476,140)`, intervening `J-502` bounds `x=1116..1340/y=92..140`, `G-500` bottom `176`, nominal track `y=168`, and route `[(980,156),(980,168),(1476,168),(1476,140)]`. Automated proof requires typed identity/owner/priority/track metadata, south buckets, exactly-once partition, orthogonality, exterior endpoints, 12px minimum terminal legs, Step/header/badge/unrelated-Stage clearance, unchanged root/child geometry and source order, no routing warning/error, deterministic SVG/PNG, and unchanged Gate 5 primary routing. Review requires a clear left-to-right bypass below `J-502`, readable upward target arrow, consistent south ports, no needless bend or collision, and intentional Stage whitespace. Review-only pre-routing/step-2/provisional artifacts are permitted; official goldens remain blocked until all Gate 6 families are accepted.

### Gate 6 — 2026-07-13 same-Stage skip implementation and review package

**Implementation result.** The dedicated router now classifies `non_adjacent_forward_same_stage` after the two accepted Gate 5 priorities and routes only ordering/ownership `J-503→J-501`. Cardinal endpoint support is generalized without changing existing basic plans: this family resolves typed `journey_escape_out`/`journey_escape_in` south ports, records them in south node buckets, retains accepted first-parent owner `G-500`, and exposes a typed Stage-local bypass with nominal coordinate, span, intermediate IDs, obstacle controls, order, and unlocked status. The nominal track is computed from all spanned Step bottoms plus the shared 12px marker-leg minimum; no fixture ID or coordinate appears in production. Missing south ports or insufficient accepted Stage space produce the locked unresolved/fallback plus omission diagnostics, with no silent east/west fallback or premature expansion.

**Family boundary and debug-stage result.** The ordering fixture now partitions as one routed occurrence plus deferred `J-501→J-502` backward/non-adjacent work and deferred `J-591→J-590` root-Step/backward work, with no failure. Primary retains exactly the three accepted Gate 5 plans; topology, duplicate, and compressed route none. Branch/join-modified primary and compressed skips remain deferred. Step 2 retains the four-point nominal bypass. Provisional reconstruction inserts the bounds-derived entry/exit vertices for intervening `J-502` at `x=1116/1340`, producing a distinct six-point PositionedScene/SVG control seam while the collinear controls intentionally preserve identical pixels. This closes the Gate 1 non-nominal-debug-stage requirement without inventing a swerve or implementing Gate 7 occupancy/displacement.

**Automated validation.** `TMPDIR=/tmp pnpm exec vitest run tests/journeyMapRouting.spec.ts tests/journeyMapVisualAcceptance.spec.ts` passed 2 files and 12 tests. `TMPDIR=/tmp pnpm exec vitest run tests/journeyMapPreRouting.spec.ts tests/stagedJourneyMap.spec.ts` passed 2 files and 24 tests. `pnpm build` and `git diff --check` passed. The independent audit additionally passed the established 5-file/44-test protected shared-routing matrix. All fourteen Gate 0 staged-renderer hashes and both legacy journey DOT hashes remain exact. The primary strict Gate 5 returned step-2 SVG hash remains `2ca5e8b0f81ac98e515456dcc7c297776f32e92e650ae40015b00d057fc43527` and PNG remains `dd488f89eb1c163fcee07f14ace58304a426e61ea4613dedb22dd18ff272ed5d`. Changed repository scope is this ledger, `journeyMap.ts`, `journeyMapRouting.ts`, `journeyMapRouting.spec.ts`, and new `journeyMapVisualAcceptance.spec.ts`; no bundle, projection, schema, fixture, accepted golden, protected renderer, legacy emitter, preview selector, or corpus file changed.

**Review artifacts and determinism.** `/tmp/journey-map-review/gate6/same-stage-skip/` contains 12 explicitly partial review files: routing evidence, pre-routing/step-2/provisional PositionedScenes, SVG/PNG pairs, a provisional fit overview, and `manifest.json`. Two final complete regenerations produced identical hashes for every file. Manifest SHA-256 is `db11018fbf5239344456be0d3b61f4eeeb680eecf3ea971981ccc4f8dcec0880`. Key stored-file hashes are routing evidence `e176023e7418cd0e608a81c202d1715d9c3dafcf541bfb650b64d7a7456f9109`, accepted pre-routing scene `3e487c5e014f62a558d4f2623ea5171c519fb97a9cd0aefefbde3b33e6e292c7`, step-2 scene `5ecc285590cc045e551124c807195f25b845eb91e821488ce53c9c4a7d50b12b`, provisional scene `e4dd3f65c641e152253569f9e9c0585a248af04ef0ef31fc2514d6ff7622f3e7`, canonical-LF step-2 SVG `dc3687bacc17a3ec6422da2082edb551e6e5367d9469216826148c6564e48555`, canonical-LF provisional SVG `e09706b53a516d49820d9121cbcae135ab6406936e66530c0344c2645d18fc03`, shared pixel PNG `f5bcc4e7d5304161109563fc8f708ab7b01cbbeb446c2d20df07e88e34589543`, and fit overview `bd5406ab5cbc05b1a38f7eb83680cde494c9dccb832c62d62fccabe103626cf7`. The manifest separately labels hashes of returned SVG bytes and stored SVG files with canonical terminal LF.

**Diagnostics, review, and invariants.** The accepted run has no routing info/warn/error and no failed connector; it retains only the locked scene info diagnostic selecting `G-500` over `G-600` for multiply-contained `J-503`. Agent visual verdict is PASS: the route leaves `J-503` downward, reads left-to-right below the complete Step row, clears `J-502`, rises into a clear target arrow at `J-501`, stays inside `G-500` and below its header, uses three visible orthogonal segments with no needless bend, and leaves a collision-free 8px Stage-border remainder. Root order `[G-600,J-590,G-500,J-591]` and child order `[J-503,J-502,J-501]` remain exact. The independent audit initially blocked identical step-2/provisional bytes; after obstacle controls made the stages structurally distinct, final re-audit found no residual blocker. Satisfied: sequential family order, typed first-parent ownership, semantic classification, source order, south exterior ports, exact identity partition, hard geometry, non-nominal debug controls, deterministic SVG-derived PNG, protected isolation, and no Gate 7 leakage. Violated: none.

**Decisions, deviations, and residual risk.** No architectural, fixture, or scope deviation was required. The material implementation decision is to preserve the visually minimal nominal bypass while giving provisional reconstruction explicit collinear obstacle-control vertices; this is a real bounds-derived debug seam, not a byte-only perturbation, and does not claim occupancy. The remaining Gate 6 families—long cross-Stage/root, branch, join, backward, cycle, self-loop, and duplicate—remain blocked, as do all Gate 7+ contention, integration, and corpus work. No official golden was captured.

**Family human review request.** Confirm the strict ordering/ownership artifact has a clear south-to-south bypass below `J-502`, a readable upward target arrow, correct `G-500` ownership, unchanged source order, no card/header/border collision or needless bend, intentional Stage whitespace, and an acceptable structurally distinct step-2/provisional control seam with identical pixels. Acceptance authorizes a focused same-Stage-skip checkpoint and opening only the next Gate 6 family, long cross-Stage/root; it does not accept Gate 6 as a whole.

### Gate 6 — 2026-07-13 same-Stage skip acceptance record

**Family acceptance.** The user accepted the combined same-Stage skip automated and visual package on 2026-07-13, including the south-to-south `G-500` bypass, the 8px Stage-border remainder, and the structurally distinct step-2/provisional control seam with identical pixels. This accepts only the first Gate 6 family, not Gate 6 as a whole. Long cross-Stage/root routing remains blocked until post-acceptance verification and the focused family checkpoint succeed.

**Post-acceptance validation and checkpoint.** The focused 2-file/12-test command, the 2-file/24-test journey regression command, `pnpm build`, `git diff --check`, all fourteen protected staged-renderer hashes, and both legacy journey DOT hashes passed unchanged. Commit `2c2c580` (`Gate 6: add same-Stage skip routing`) contains only the accepted same-Stage skip production, tests, and ledger. The next family opened only after this checkpoint existed.

### Gate 6 — 2026-07-13 long cross-Stage/root opening record

**Family state.** Only the second approved Gate 6 family, long cross-Stage/root routing, is active. Branch, join, backward, cycle, self-loop, and duplicate families remain blocked. The accepted Gate 5 direct routes and Gate 6 same-Stage skip are protected inputs. This family may add root-owned long cross-Stage and root-Step templates, root outer-bypass controls, ordered source/target Stage gates, tests, and review-only artifacts; it may not reorder or resize accepted placement, promote branch/join/backward/cycle/duplicate edges early, introduce Gate 7 occupancy/expansion, traverse unrelated Stage interiors, or capture official goldens before every Gate 6 family is accepted.

**Locked eligibility and exclusions.** Exactly two primary occurrences enter this family. `J-204→J-401`, stable ID `J-204__PRECEDES__J-401__318ddfc8a0a2555e2d3e8d652057700201e31e361ac7f271648ae7600f4e1b85__0`, author/same-endpoint/exact-identity ordinals `7/0/0`, is a root-owned long forward cross-Stage outer bypass. `J-250→J-260`, stable ID `J-250__PRECEDES__J-260__41af070b7875a64ca707ee01b6165425f0d5fc78aa0510895157b68f9195daa6__0`, ordinals `8/0/0`, is a root-owned adjacent forward root-Step direct route. Both retain the accepted unique-occurrence, acyclic/forward, source-outdegree-one, and target-indegree-one guards over all measured edges. Modifier-bearing ordering, topology, duplicate, and compressed root/long candidates remain deferred to branch, join, backward, cycle, or duplicate families. Primary becomes five routed and four deferred branch/join occurrences; ordering remains one, and topology/duplicate/compressed remain zero.

**Locked root route contract.** Both new archetypes have priority rank 3. Long cross-Stage routing resolves south `journey_escape_out`/`journey_escape_in` ports, south buckets, and locked order-zero south boundary gates on the source and target Stages. It exposes a typed unlocked root-outer horizontal bypass whose nominal coordinate is the maximum bottom of every accepted root child plus `MIN_ARROW_MARKER_LEG`, strictly inside the unchanged root bottom; its span is the endpoint x-range, its intermediate root-item order is typed, and its provisional obstacle controls derive from each intermediate root child's positioned bounds. Step 2 contains the minimal U-shaped outer template. Provisional reconstruction inserts the two Stage gates plus intermediate root-item entry/exit controls, producing distinct structure without claiming occupancy. The adjacent root-Step route resolves east/west flow ports and remains a legal two-point horizontal route with no Stage gates or outer bypass. Missing ports, gates, or baseline capacity fail visibly through the locked unresolved/fallback and omission diagnostics; no placement expansion is permitted in this family.

**Proof and review contract.** Strict/permissive evidence only, never production literals: long endpoints `(1788,140)→(2859.576,140)`, source/target south gates `(1788,236)` and `(2859.576,160)`, root bottom `268`, outer track `y=248`, and intermediate controls for `J-250 x=1960..2184`, `J-260 x=2224..2448`, and `G-300 x=2488..2687.576`. Simple derives source gate `y=176`, root bottom `208`, and track `y=188`; target gate remains `y=160`. Root direct is `(2184,116)→(2224,116)`. Automated proof requires exact identity/owner/priority/ports/buckets/gates/bypass metadata, exactly-once partition, profile-derived bounds, orthogonality, exteriority, 12px terminal legs, full root-row and unrelated-Stage avoidance, unchanged source order/bounds, distinct step-2/provisional structure, deterministic SVG-derived PNG, and exact preservation of earlier family plans/bytes. Human review requires a visibly peripheral long route below the row that uses only the correct Stage gates, avoids both root Steps and empty `G-300`, retains a clear upward target arrow without dominating direct tracks, and keeps `J-250→J-260` as a simple east/west chain. No architectural ambiguity was found; failure to fit the accepted root gutter is a stop condition rather than authority for Gate 7 expansion.

### Gate 6 — 2026-07-13 long cross-Stage/root implementation and review package

**Implementation result.** The dedicated journey router now recognizes exactly the two locked primary occurrences after the existing unique-identity, degree, acyclic, and typed-forward-order guards. `J-204→J-401` is root-owned with rank 3, south escape endpoints, locked order-zero south Stage gates, and a typed `JourneyMapRootOuterBypass`. Its nominal track derives from the maximum bottom of every positioned root child plus `MIN_ARROW_MARKER_LEG`; its intermediate root-item IDs and provisional entry/exit controls derive from typed root order and current bounds. `J-250→J-260` is root-owned with rank 3 and uses the exact two-point east/west flow-port template. A vertical mismatch now fails construction visibly instead of broadening that archetype to a dogleg. Branch/join, backward, cycle, self-loop, and duplicate occurrences remain deferred, and no occupancy, separation, displacement, rerouting, or expansion behavior was introduced.

**Validation and defensive audit.** `TMPDIR=/tmp pnpm exec vitest run tests/journeyMapRouting.spec.ts tests/journeyMapVisualAcceptance.spec.ts` passed 2 files and 17 tests. The broader journey command over render-model, scene, pre-routing, routing, and visual suites passed 5 files and 51 tests. `TMPDIR=/tmp pnpm run build` and `git diff --check` passed. A delegated read-only contract audit found two defensive gaps before review: root-Step misalignment could produce a four-point dogleg, and Stage-gate validation did not enforce `locked: true`; both were corrected and covered, together with exact root flow-port ID assertions. All fourteen Gate 0 protected staged-renderer hashes and both legacy journey DOT hashes remain unchanged. Satisfied invariants: exact five-routed/four-deferred primary partition, stable identities/priorities/owners, typed ports/buckets/gates/bypass, bounds-derived profile geometry, orthogonality, exteriority, terminal legs, Step/header/badge/root-item/unrelated-Stage clearance, unchanged placement/source order, earlier-family route-structure preservation, explicit failure diagnostics, and absence of Gate 7 behavior. Violated invariants: none. Accepted-proof routing warnings/errors: none.

**Review artifacts and determinism.** The consolidated review-only package is `/tmp/journey-map-review/gate6/long-cross-root/` with simple, permissive, and strict pre-routing, step-2, and provisional PositionedScene/SVG/PNG evidence plus fitted overviews and `manifest.json`. Its manifest SHA-256 is `a46b0c2554ff9e1cfea0c5dcb3da65c59a71a000b10534e7d302aabd5fb48985`; the aggregate hash over every package file is `4d26705d8e0ec6a6730406c620f715690cc43c8d317620a31784db2d4bbe027b` on consecutive complete reruns. Step-2 and provisional SVG/scene structures differ because provisional reconstruction inserts the typed gates and bounds controls; their pixels intentionally match. PNG is produced from the exact corresponding SVG path. The sole accepted scene diagnostic in every profile is the pre-existing info `renderer.scene.journey_map_disconnected_chain` for the intentional `J-250/J-260` secondary chain; there is no routing warning or error. These are partial family-review artifacts, not official goldens.

**Decisions, deviations, and residual risk.** No architectural, fixture, bundle, projection, placement, or public-backend deviation was required. The root-outer track deliberately uses the full root row rather than only the endpoint span, matching the locked peripheral policy and preventing a route from slipping between uneven root items. Exact two-point root-Step geometry is treated as an archetype invariant, so misalignment is a diagnosed construction failure. Visual inspection of simple and strict fitted overviews confirms the long route is peripheral below the row, crosses only its source/target south boundaries, clears `J-250`, `J-260`, and `G-300`, and retains an upward target arrow; the secondary root chain remains visually direct. Remaining Gate 6 families—branch, join, backward, cycle, self-loop, and duplicate—remain blocked. Dense contention and expansion remain Gate 7 work. No official golden was captured.

**Family human review request.** Confirm that the simple/strict primary overviews show a clearly peripheral long route below the entire root row, correct south exits through `G-200` and `G-400`, no traversal of `J-250`, `J-260`, or empty `G-300`, a readable upward target arrow that does not dominate canonical direct routes, and a simple horizontal `J-250→J-260` chain. Acceptance authorizes only the focused long cross-Stage/root checkpoint and opening of the next Gate 6 family, branch; it does not accept Gate 6 as a whole.

### Gate 6 — 2026-07-13 long cross-Stage/root acceptance record

**Family acceptance.** The user accepted the combined long cross-Stage/root automated and visual package on 2026-07-13, including the full-row peripheral bypass, locked south `G-200`/`G-400` gates, bounds-derived intermediate controls, upward target arrow, and exact two-point `J-250→J-260` chain. This accepts only the second Gate 6 family, not Gate 6 as a whole. The branch family remains blocked until focused post-acceptance verification and the long cross-Stage/root checkpoint succeed.

**Post-acceptance validation.** The focused 2-file/17-test command and the broader 5-file/51-test journey command passed. `TMPDIR=/tmp pnpm run build`, `git diff --check`, all fourteen Gate 0 protected staged-renderer hashes, and both legacy journey DOT hashes passed unchanged. Review-only artifacts remain under `/tmp` and official goldens remain unchanged.

**Checkpoint and scope-note deviation.** Commit `3a894be` (`Gate 6 done`) checkpoints the accepted long cross-Stage/root production, focused tests, and ledger after the successful post-acceptance validation. The app commit action also added one `progress.md` line reading `Gate 6 done`. That message and progress wording are broader than the actual dependency state: they mean this accepted family checkpoint only and do not mark Gate 6 complete. The controlling ledger remains authoritative; branch, join, backward, cycle, self-loop, and duplicate families are still required and blocked in order. The extra progress line is preserved as user/app-owned committed state and recorded here as a checkpoint-scope deviation rather than rewritten or hidden.

### Gate 6 — 2026-07-13 branch opening stop report: branch/join overlap precedence

**Stop state.** The read-only branch-family opening audit stopped before any branch production or test change. The accepted long cross-Stage/root checkpoint is intact. Join, backward, cycle, self-loop, duplicate, and Gate 7+ work remain blocked.

**Unresolved contract overlap.** Primary `J-201→J-202` and `J-201→J-203` are unambiguously branch-only: their source outdegree is two, each target indegree is one, and both are unique, forward, and acyclic. The topology fixture is ambiguous under the current rollout taxonomy. The Gate 1 normative table explicitly labels `J-790→J-701` and `J-790→J-791` as `branch fan-out` and `J-714→J-791` as a forward `branch member`; however, each target also has indegree two when degrees are computed over all measured occurrences, so the current generic deferred taxonomy also calls these edges joins. `J-714→J-713` is additionally backward and remains unambiguously assigned to the later backward family. The approved family sequence says branch precedes join but does not explicitly state whether source-branch or target-join wins for a single occurrence carrying both structural modifiers.

**Safe alternatives.** Alternative A is dependency-clean-only branch eligibility: require source outdegree greater than one and target indegree exactly one. It routes only the two primary edges now; primary becomes seven routed/two deferred joins, while topology remains zero until join/later families. This is the smallest code change but postpones edges explicitly named as topology branch proof. Alternative B gives a unique forward acyclic source-branch occurrence precedence over target-join during Gate 6 family rollout. It routes the two primary edges plus topology `J-790→J-701`, `J-790→J-791`, and `J-714→J-791`; topology backward/cycle/self-loop edges remain deferred. Join later adds only non-branch incoming alternatives and Gate 7 still owns endpoint ordering/separation. Compressed remains deferred under the accepted target-to-source-path/cycle guard, and duplicates remain deferred by occurrence multiplicity under either alternative.

**Recommended amendment.** Adopt Alternative B because it follows the literal Gate 1 topology labels and the approved branch-before-join order while remaining generic: `branch` wins only for unique, forward, non-cyclic occurrences whose source has multiple outgoing measured edges; backward, cycle, self-loop, and duplicate classifications retain later-family precedence. These branch plans receive topology rank 4 and retain their bounds-derived base route: primary adjacent east/west direct and non-adjacent south Stage-local bypass; topology root-to-contained direct through one locked west Stage gate, root-to-root outer bypass around `G-700`, and contained-to-root direct through one locked east Stage gate. This does not authorize Gate 7 endpoint displacement or occupancy.

**Decision required.** Approve Alternative B, select Alternative A, or provide a different explicit overlap precedence. No branch implementation may begin until this family-boundary amendment is accepted and recorded.

**Amendment acceptance.** On 2026-07-13 the user approved Alternative B. During Gate 6 family rollout, a unique, forward, non-cyclic occurrence whose source has multiple outgoing measured edges is assigned to the branch family even when its target also has multiple incoming measured edges. Backward, cycle, self-loop, and duplicate classification retains later-family precedence. This is a generic overlap rule over typed edge occurrence/degrees/order, not a fixture-ID exception. It authorizes the exact two primary and three topology forward branch occurrences identified above; it does not authorize join convergence work, Gate 7 endpoint displacement, occupancy, separation, or expansion.

### Gate 6 — 2026-07-13 branch family opening record

**Family state and exact occurrence set.** Only the third Gate 6 family, branch fan-out, is active. Exactly five occurrences qualify under the accepted Alternative B rule. Primary adds `J-201→J-202`, stable ID `J-201__PRECEDES__J-202__593fe33d0efc3afc341263d5931f29a5f6fe37e5d7a0c711e6b630dc3f490377__0`, author/same-endpoint/exact ordinals `3/0/0`, and `J-201→J-203`, stable ID `J-201__PRECEDES__J-203__fa511db8d388c1c641794046eb99f8143ad8ad693087448c54862f0fdd6d7105__0`, ordinals `4/0/0`; both are owned by `G-200`. Topology adds root-owned `J-790→J-701`, stable ID `J-790__PRECEDES__J-701__661a1f868e72e80d2f47aedd3157ec09171f344f4a9aa62486fc7da5457bd384__0`, author `0`; root-owned `J-790→J-791`, stable ID `J-790__PRECEDES__J-791__71d18a11d3f80b2283cb17a0d68e86a327e54fca708def24c118a265fc3cd6be__0`, author `1`; and root-owned `J-714→J-791`, stable ID `J-714__PRECEDES__J-791__37d24514299e09f03f8d2a42e59503f5de765431b1348d451dfadcb4d8555722__0`, author `8`; all three have zero duplicate ordinals. Primary becomes seven routed/two deferred join occurrences. Topology becomes three routed/six deferred cycle/backward/self-loop occurrences. Ordering remains one, duplicate and compressed remain zero. Join and every later family remain blocked.

**Typed classification and priority contract.** Branch is an additive typed topology modifier on a bounds-derived base route, so previously accepted non-branch connector-plan structures/bytes remain unchanged. A branch plan exposes `topologyModifiers:["branch"]` plus typed source outdegree and authored outgoing ordinal; bypass alternatives also expose a typed bounds-derived departure control. Every branch occurrence receives archetype priority rank `4`, then the existing root order, Step order, author order, target order, duplicate ordinals, and stable ID tie-breakers. Primary bases are adjacent forward same-Stage and non-adjacent forward same-Stage. Topology bases are adjacent forward root-to-contained, long forward root-Step outer bypass, and adjacent forward contained-to-root. The source-branch predicate is computed over all measured occurrences, while uniqueness, target-to-source-path/cycle rejection, and typed forward order remain hard guards. Removing branch pressure may return an otherwise canonical edge to its earlier base family; no fixture name, raw source, class token, or literal semantic ID participates.

**Ports, gates, and route templates.** Every branch member leaves through the source's east flow port, in authored outgoing order; each target retains the side required by its base morphology. Primary `J-201→J-202` targets the west flow port through the accepted direct template. `J-201→J-203` targets the south escape port: a short east departure stem reaches a vertical control derived from the midpoint between the source east edge and intervening `J-202` left bound, then descends to the Stage-local track and uses the accepted obstacle controls. Topology `J-790→J-701` targets west and crosses only the locked order-zero west gate of target Stage `G-700`; `J-714→J-791` is symmetric through the locked east gate of source Stage `G-700`. Their step-2 routes are minimal direct geometry and provisional reconstruction inserts the single boundary-gate vertex. `J-790→J-791` targets the south escape port: its east departure reaches a bounds-derived vertical control before `G-700`, descends to a root-outer bypass below the full root row, and records `G-700` as the typed intermediate item/control; it has no Stage gate because it stays outside the Stage. Bypass metadata distinguishes semantic endpoint span from the actual post-departure track span. Gate 7 alone may later assign distinct offsets on a shared side; this family may not introduce occupancy, displacement, fixed separation, or expansion.

**Coordinate evidence and validation contract.** Strict/permissive primary evidence only: adjacent branch `(1156,154)→(1180,116)` with departure/midpoint `x=1168`; skip `(1156,154)→(1540,156)` departs at `x=1168`, uses `G-200` track `y=228` inside bottom `236`, and records `J-202 x=1180..1404` controls. Simple derives adjacent `(1156,124)→(1180,116)` and skip `(1156,124)→(1540,156)` through departure `x=1168` and track `y=168` inside bottom `176`, with the same controls. Strict topology evidence: `J-790→J-701` is `(256,116)→(316,116)` through west gate `(296,116)`; `J-790→J-791` is `(256,116)→(1952,140)`, departs at `x=276`, uses root track `y=188` with `G-700 x=296..1800` controls inside root bottom `208`, and targets south; `J-714→J-791` is `(1780,116)→(1840,116)` through east gate `(1800,116)`. Source branch ordinals are primary `0/1`, topology `J-790 0/1`, and `J-714→J-791 1` because its authored ordinal-zero backward member remains deferred. Coordinates are test/review evidence, never production literals. Automated proof requires exact identities/owners/modifier/base/priority/outdegree/ordinal/departure controls, ports/buckets/gates/bypasses, partition counts, branch-over-join precedence, profile derivation, orthogonality/exteriority/terminal legs, all hard obstacle checks, unchanged placement/source order, exact earlier-plan preservation, explicit negative failures, deterministic SVG-derived PNG, and no Gate 7 behavior.

**Human review contract.** Primary must show both edges originating at `J-201` east: a canonical adjacent route to `J-202` and a clearly separate short-stem/lower-corridor route to south `J-203`, with no merged long trunk, badge/card/header collision, or needless bend. Topology must show both `J-790` edges originating east: a short route through the correct west `G-700` gate and a distinct short-stem peripheral route around the entire Stage to south `J-791`; the later `J-714→J-791` exit must use only the correct east gate. `J-791` west/south arrivals deliberately defer join convergence/order. Arrows and semantic edge identity must remain traceable even though Gate 7 has not yet introduced crowded-side separation. Failure to fit the existing gutters stops this family rather than authorizing expansion. No official golden may be captured.

### Gate 6 — 2026-07-13 branch family implementation and review package

**Implementation result.** The dedicated journey router now applies the accepted Alternative B overlap rule to typed measured occurrences: a unique forward acyclic edge from a source with authored outdegree greater than one receives `topologyModifiers:["branch"]`, a typed `JourneyMapBranchPlan`, and priority rank 4 even when its target is also a join. Exactly the two locked primary and three locked topology occurrences route. Primary is seven routed/two deferred joins; topology is three routed/six deferred cycle/backward/self-loop occurrences; ordering remains one; duplicate and compressed remain zero. Branch sources use the common east flow port and authored outgoing ordinal. Direct targets retain west flow ports; bypass targets retain south escape ports. The non-adjacent primary and root-outer topology alternatives record separate semantic endpoint spans, actual post-departure spans, and typed vertical departure controls derived from the first intervening positioned bound. Root-to-contained and contained-to-root routes expose only their respective locked west/east `G-700` gate. No fixture ID, raw source, class token, occupancy, endpoint displacement, fixed separation, rerouting, or expansion participates in production behavior.

**Defensive audit and material decisions.** A delegated read-only audit found three issues before the package was offered for review. First, branch ordinal initially followed incidental measured-edge array order; the degree index now sorts each source's occurrences by typed `authorOrder`, same-endpoint ordinal, exact-identity ordinal, and stable ID, with a reverse-array proof. Second, standalone structural validation could not reject a plausible but swapped ordinal; production validation now receives the measured scene and verifies exact source outdegree and authored ordinal, while the optional standalone path retains range validation. Third, a branch-modified non-adjacent cross-Stage morphology could enter eligibility without an accepted east-source boundary template; that morphology is now explicitly deferred as branch/join/long-cross rather than failing construction. This is a defensive boundary around the exact accepted branch bases, not authorization for a new route family. The re-audit found all three issues closed and no remaining concrete defect. The Alternative B amendment is the only architectural deviation from the original family taxonomy and was accepted before implementation.

**Validation.** `TMPDIR=/tmp pnpm exec vitest run tests/journeyMapRouting.spec.ts tests/journeyMapVisualAcceptance.spec.ts` passed 2 files and 23 tests after the audit fixes. The broader journey command over render-model, scene, pre-routing, routing, and visual suites passed 5 files and 57 tests. `TMPDIR=/tmp pnpm run build` and `git diff --check` passed. Tests prove exact identities/owners/archetypes/modifiers/priorities/degrees/ordinals, Alternative B branch-over-join precedence, common-east ports, base target sides, one-sided gates, typed departure/bypass controls, exact partitions, profile-derived geometry, measured-edge reorder independence, measured-context rejection of an in-range swapped ordinal, explicit construction failures, unsupported-morphology deferral, orthogonality, exterior endpoints, minimum terminal legs, node/badge/header/unrelated-Stage clearance, and absence of Gate 7 diagnostics or behavior. All fourteen Gate 0 protected staged-renderer hashes and both legacy journey DOT hashes remain unchanged. Satisfied invariants: all locked branch-family semantic, geometry, determinism, preservation, diagnostic, and scope invariants. Violated invariants: none after the audit fixes. Accepted-proof routing warnings/errors: none.

**Review artifacts and determinism.** The consolidated review-only package is `/tmp/journey-map-review/gate6/branch/` with primary simple/permissive/strict and topology strict pre-routing, step-2, and provisional PositionedScene/SVG/PNG evidence, fitted overviews, routing evidence, and `manifest.json` (45 files). The manifest SHA-256 is `9eb8eb0b492d1153dbfc356ed09c05acc80d0577d4d2e76aad33a9d69b67579e`; the aggregate hash over every package file is `73613c926d114258808b00098ae2203e63b8c77f12d55dd7516d183d6e7c7c77` on consecutive complete reruns and remained unchanged after the audit fixes. PNG is derived from the exact corresponding SVG path. Primary profiles retain only the pre-existing info `renderer.scene.journey_map_disconnected_chain` for the intentional `J-250/J-260` chain; topology has no renderer diagnostic; every case has zero failed connector IDs. These are partial family-review artifacts, not official goldens.

**Visual inspection and residual risk.** The primary strict overview shows both `J-201` connectors leaving the same east point, with the adjacent target reached by a compact dogleg and the skip separating after a 12px stem into the lower Stage corridor; the route clears both secondary badges, all cards, and the Stage header. The topology overview shows the short `J-790→J-701` west-gate entry, the separate `J-790→J-791` root-peripheral track below the entire `G-700` Stage, and the `J-714→J-791` east-gate exit. No long merged trunk, unrelated Stage traversal, or needless bend was observed. Join convergence and late west/south target ordering remain intentionally deferred; Gate 7 still owns contention separation and bounded expansion. Join, backward, cycle, self-loop, and duplicate remain blocked in that order. No official golden was captured and no checkpoint commit is permitted before human acceptance.

**Family human review request.** Confirm that the primary strict overview preserves a common east departure while keeping the direct and lower-corridor alternatives visually distinct and collision-free, and that the topology strict overview uses only the correct west/east `G-700` gates while the outer route stays below the entire Stage and reaches `J-791` from the south. Acceptance authorizes only the focused branch checkpoint and opening of the join family after post-acceptance validation; it does not accept Gate 6 as a whole.

### Gate 6 — 2026-07-13 branch family acceptance record

**Family acceptance and explicit qualification.** The user accepted the branch family on 2026-07-13 and authorized continuation, while explicitly reporting that the diagrams are problematic for human readability and must be revisited. This accepts the branch classification, identity, ownership, port/gate, bounds-derived template, diagnostic, and preservation contract sufficiently to create the focused family checkpoint and open join after post-acceptance validation. It does not assert that the current partial diagrams are visually satisfactory, waive the readability concern, accept all of Gate 6, or authorize official goldens.

**Readability debt and downstream stop.** The unresolved human-readability concern is retained as a material residual risk rather than normalized by green tests or snapshot evidence. Gate 7 must evaluate whether real occupancy, late endpoint ordering, 16px contention separation, and bounded whole-structure expansion materially improve branch/join traceability. Gate 8 final focused visual acceptance remains blocked until the user confirms the complete routed proofs are human-readable at normal review scale. If Gate 7 geometry does not materially address this concern, implementation must stop before Gate 8 acceptance or any Gate 10 golden refresh and return to the owning routing/layout decision rather than treating this provisional family acceptance as a waiver.

**Post-acceptance validation.** The focused routing/visual command passed 2 files and 23 tests, and the broader render-model/scene/pre-routing/routing/visual journey command passed 5 files and 57 tests. `TMPDIR=/tmp pnpm run build` and `git diff --check` passed. All fourteen Gate 0 protected staged-renderer hashes and both legacy journey DOT hashes remain unchanged. The accepted review package hashes remain the implementation-record values above and no official golden was captured. The branch checkpoint is therefore eligible; join remains blocked until that commit succeeds.

**Checkpoint.** Commit `6dad32e` (`Gate 6: add branch routing`) records the accepted branch production code, focused routing/visual proofs, and ledger. The worktree was clean immediately afterward. This checkpoint does not waive the recorded readability debt or accept all of Gate 6. With the dependency satisfied, only the join-family read-only contract audit is active; join production remains blocked until its exact occurrence, precedence, geometry, validation, and review contract is locked from the approved sources.

### Gate 6 — 2026-07-13 join family opening record

**Family state and eligibility.** Only the fourth Gate 6 family, join fan-in, is active. Exactly two primary occurrences qualify: `J-202→J-204`, stable ID `J-202__PRECEDES__J-204__34ffe7148c62ef2de7d7441ff3c229f6cdb4caa830ec06c13e4fc135c1d271b4__0`, author/same-endpoint/exact ordinals `5/0/0`, and `J-203→J-204`, stable ID `J-203__PRECEDES__J-204__507b45c44ab3c264dd2cf0e03b67cea5ea2e7d31b604dd0d7f5a434686a53ac9__0`, ordinals `6/0/0`; both are owned by `G-200`. Join eligibility requires a unique, forward, acyclic occurrence with source outdegree one and target indegree greater than one. Alternative B source-branch precedence remains accepted, so already-routed branch members are not reclassified or mutated by this family. Duplicate, backward, cycle, and self-loop candidates retain later-family precedence. Primary becomes nine routed/zero deferred/zero failed; ordering remains one/two/zero; topology remains three/six/zero; duplicate remains zero/three/zero; compressed remains zero/eighteen/zero because its entire measured graph is cyclic. No later family or Gate 7 behavior may open early.

**Typed join, priority, and route contract.** Each join plan exposes `topologyModifiers:["join"]` plus typed target indegree and authored incoming ordinal. The target incoming list is sorted by typed `authorOrder`, same-endpoint ordinal, exact-identity ordinal, and stable ID, independently of measured-edge array order. Join priority rank is 5 followed by the accepted priority tie-breakers. Both joins use the common `J-204` west flow port in authored incoming order. `J-203→J-204` retains an adjacent east-to-west direct dogleg. `J-202→J-204` retains a non-adjacent same-Stage morphology but uses the source south escape port and a typed west-target arrival: its Stage-local bypass distinguishes semantic endpoint span from the actual pre-arrival track span and exposes a bounds-derived vertical arrival control between the last intervening Step's east bound and the target west bound. Step 2 contains the minimal source-to-track-to-arrival template; provisional reconstruction inserts typed `J-203` entry/exit controls. No Stage gate is involved. Missing ports, capacity, metadata, or malformed degree/ordinal/arrival contracts fail visibly; an unsupported join-modified base is explicitly deferred rather than construction-failed.

**Coordinate and partition evidence.** All primary profiles derive the same join geometry because only `J-201` carries profile-controlled badges. Direct `J-203→J-204` is east `(1652,124)` to west `(1676,116)` through `x=1664`: `[(1652,124),(1664,124),(1664,116),(1676,116)]`. Bypass `J-202→J-204` is south `(1292,140)` to west `(1676,116)`, uses Stage-local track `y=168`, records intervening `J-203 x=1428..1652`, and arrives through bounds midpoint `x=1664`: step 2 `[(1292,140),(1292,168),(1664,168),(1664,116),(1676,116)]`; provisional adds `(1428,168),(1652,168)`. Its actual span is `1292..1664`, semantic endpoint span `1292..1676`, and vertical arrival span `116..168` with obstacle item `J-203`, east boundary `1652`, order zero, unlocked. `G-200` bottom is `176` simple and `236` permissive/strict. Buckets are `J-202` south start, `J-203` east start, and `J-204` west endings in target ordinals `0/1`.

**Validation and preservation contract.** Automated proof must cover exact IDs/owners/base archetypes/rank/degree/ordinal/ports/buckets/no-gates/bypass/arrival metadata and all exact fixture partitions; reverse measured-edge order; identical join geometry across profiles; step-2/provisional/final-basic orthogonality, exteriority, 12px target legs, and non-endpoint Step/header/badge/unrelated-Stage clearance; missing target/source ports, capacity failure, malformed target degree/ordinal/arrival control, and unsupported-morphology deferral; exact preservation of all seven accepted primary plans/routes and every other fixture partition; deterministic SVG-derived PNG; zero accepted-primary routing warnings/errors; and absence of occupancy, fixed separation, expansion, or other Gate 7 behavior.

**Known visual defect and review contract.** The nominal join bypass crosses the accepted branch route at `(1540,168)`; under simple it also shares a longer `y=168` track segment. Both joins share a short target-adjacent convergence before the common 12px terminal stem. These are known human-readability defects, not hard Gate 6 obstacle/endpoint violations and not evidence of visual success. Review must assess the canonical direct path, lower bypass obstacle clearance, common west target, arrows, ports, and whitespace at intrinsic `1680×1050`, 100% zoom, while explicitly retaining the crossing/merged-convergence failure. Fit-to-viewport evidence cannot accept text readability. Gate 7 must make occupancy, late endpoint ordering, separation, and any bounded expansion materially affect these structures; Gate 8 remains blocked until the complete proof is human-readable. No snapshot or golden may conceal this debt.

### Gate 6 — 2026-07-13 join family implementation and review package

**Implementation result.** The journey router now adds a typed join modifier only to the two locked primary occurrences. `JourneyMapJoinPlan` carries target indegree, authored target ordinal, and an optional bounds-derived vertical arrival control. Incoming occurrences are sorted by typed author order, duplicate ordinals, and stable ID independently of measured-edge array order. Rank-5 plans target the common west flow port; the adjacent member uses the compact east/west dogleg, while the non-adjacent member uses the source south escape port, typed Stage-local track/endpoint spans, `J-203` obstacle bounds, and the west-target arrival control. Primary is exactly nine routed/zero deferred/zero failed; every other fixture retains the locked partition. All seven accepted earlier primary plans are byte-for-byte structurally preserved. Unsupported join morphologies are deferred, and no fixture ID, raw source, class token, occupancy, endpoint displacement, fixed separation, expansion, or later-family behavior appears in production.

**Audit and defensive validation.** The delegated read-only audit found one validation gap: measured-context validation initially checked target degree equality/ordinal but did not separately require target indegree greater than one or source outdegree exactly one. Production construction was already correct. Validation now requires the exact measured incoming/outgoing predicates and edge membership; the analogous branch check now explicitly requires measured outdegree greater than one. Direct negative proofs show that a false single-incoming join and a join claim from a branching source are rejected. Re-audit found the issue closed and no remaining concrete defect.

**Validation.** `TMPDIR=/tmp pnpm exec vitest run tests/journeyMapRouting.spec.ts tests/journeyMapVisualAcceptance.spec.ts` passed 2 files and 27 tests. The broader journey render-model/scene/pre-routing/routing/visual command passed 5 files and 61 tests. `TMPDIR=/tmp pnpm run build` and `git diff --check` passed. Automated coverage includes exact identities/owners/base archetypes/modifier/rank/degrees/ordinals/ports/buckets/no-gates/bypass/arrival metadata and partitions; reverse measured-edge order; identical join geometry across profiles; measured-context degree/membership rejection; missing target/source ports; insufficient Stage capacity; malformed degree/ordinal/arrival controls; unsupported-morphology deferral; exact earlier-plan preservation; SVG-derived PNG determinism; hard orthogonality/exteriority/terminal-leg/node/badge/header/unrelated-Stage checks; and absence of Gate 7 diagnostics/behavior. All fourteen Gate 0 protected staged-renderer hashes and both legacy journey DOT hashes remain unchanged. Accepted-primary routing warnings/errors: none.

**Review artifacts and determinism.** The consolidated review-only package is `/tmp/journey-map-review/gate6/join/` with primary simple/permissive/strict pre-routing, step-2, and provisional PositionedScene/SVG/PNG evidence, fitted overviews, routing evidence, and `manifest.json` (34 files). Manifest SHA-256 is `78fafe645d3ab467a283d92c3f7aa4d9349553917f0a1c10fa81413be455f43d`; the aggregate hash is `1134025f7de745027e524518b75a57c889f39bcd58a2c1cd28bb76e7538fd705` on consecutive full reruns and after the validator correction. PNG derives from the exact corresponding SVG. Every profile has nine routed/two join/zero deferred/zero failed, plus only the accepted disconnected-chain info diagnostic. These are partial review artifacts, not official goldens.

**Invariant and visual report.** Satisfied hard invariants: exact occurrence partition and identity; typed ownership/priority/degree/order/ports/bypass/arrival; source-order and accepted-geometry preservation; deterministic reconstruction; Step/badge/header/unrelated-Stage clearance; legal exterior endpoints; orthogonality; 12px target legs; explicit failure diagnostics; protected renderer/legacy stability; and no Gate 7 behavior. Violated human invariant: branch/join identity is not reliably readable in the combined diagram. The strict overview visibly contains the locked crossing at `(1540,168)` and shared target-adjacent convergence; simple additionally shares a longer horizontal segment. The panorama and fit overview also make text difficult to read as already reported by the user. The family is therefore structurally implemented but not visually satisfactory. This violation is retained as blocking Gate 8 debt, not reframed as success and not hidden by snapshots.

**Family human review request.** Review the strict/intrinsic primary evidence for the direct join, lower bypass, common west target, correct ports, arrow, and obstacle clearance, while treating the nominal crossing, short merged convergence, and overall readability as explicit failures that remain assigned to Gates 7–8. Acceptance would authorize only the join checkpoint and opening of backward routing; it would not declare the diagram readable, accept Gate 6 as a whole, or authorize a golden. No commit or backward-family production work may begin before that decision.

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
