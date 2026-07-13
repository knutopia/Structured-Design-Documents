# Staged Journey Map Renderer — Gated Implementation Plan

Status: implementation in progress — Gate 2 typed render inputs

Audience: the single implementation agent, reviewers, and maintainers responsible for accepting a staged `journey_map` renderer

Purpose: deliver a deterministic, visually excellent journey-map renderer through narrow, sequential, proof-driven gates. Correct semantics, obstacle-free routing, connector identity, visual readability, and reviewability outrank implementation speed.

## Implementation ledger

This ledger is the execution record for the linear Gate 0 → Gate 10 dependency chain. Only the active gate may be in progress; every later gate remains blocked until its prerequisite evidence is accepted.

| Gate | Status | Reviewer | Accepted | Checkpoint | Validation |
| --- | --- | --- | --- | --- | --- |
| 0 — Authority, drift, protected baseline | accepted | user | 2026-07-12 | no commit | 4 files/63 tests; whitespace and protected baseline clean |
| 1 — Proof corpus and acceptance contract | accepted | user | 2026-07-12 | Gate 1 checkpoint pending | prerequisite and proof-contract validation green |
| 2 — Typed render inputs | in progress | — | — | pending | characterization pending |
| 3 — RendererScene | blocked by Gate 2 | — | — | — | — |
| 4 — Measurement and pre-routing | blocked by Gate 3 | — | — | — | — |
| 5 — Basic routing | blocked by Gate 4 | — | — | — | — |
| 6 — Archetypes and ownership | blocked by Gate 5 | — | — | — | — |
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
| Exactly one semantic edge occurrence with no route geometry | RendererScene, MeasuredScene, pre-routing for every case |
| Exactly one stable orthogonal route per occurrence | step-2, step-3, final for every case; duplicate is the multiplicity proof |
| Root and Stage child order preserved | every case at model, scene, pre-routing, final |
| Ordered legal boundary gates | primary, ordering root return, topology root transitions, compressed contention |
| Occupancy changes final geometry and expansion is bounded | compressed only; resolved-vs-nominal plus final segment and whole-structure shift |
| Deterministic repeat | all model/scene/routing data and stored text hashes |

**Stage golden names.** No golden is captured until its owning gate accepts behavior. The linked proof contract enumerates every required filename per case/profile and the three exact degraded-diagnostic artifacts; later gates have no discretion to omit a named stage. PNG derivation is asserted and temporary PNGs are reviewed, but renderer-stage PNG goldens are not stored.

Temporary review artifacts use `/tmp/journey-map-review/<case>.<profile>.<pre-routing|step-2|step-3|final>.{svg,png}`. Gate 10 corpus debug stems, where Gate 9 later decides they are meaningful, remain the established `pre_routing`, `routing_step_2_edges`, and `routing_step_3_gutters` names.

**Renderer diagnostic codes.** The linked proof contract maps every exact full code to a directly constructed trigger, phase/severity, target/related IDs, and one of three named degraded artifacts. Information diagnostics and intentional validation warnings are likewise mapped to exact cases/artifacts. Normal direct routes emit no info noise.

Accepted primary/profile/compressed proofs contain no renderer warning/error. Ordering contains only the named validation warning plus first-parent info. Topology contains only the one named validation cycle warning plus peripheral topology info. Duplicate contains only the named validation duplicate warning plus Step-only info. Directly constructed negative/degraded unit inputs exercise the error/warning codes; those diagnostics never waive a proof failure.

**Normal visual review contract.** Review in a `1680×1050` CSS-pixel viewport at 100% browser zoom, with SVG at intrinsic width/height and one scene unit per CSS pixel. The primary proof must fit without downscaling. Dense/debug cases may scroll at 100% and also receive a fit-to-viewport overview that is not used for text-readability acceptance. Review PNG uses the shared 192 DPI path with no post-raster scaling.

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
