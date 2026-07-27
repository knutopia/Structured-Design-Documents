# [Done] Journey Map Visual Remediation Implementation Plan

**Status:** implemented through Gate 7; Gate 8 dense experiment rejected; Gate 9 closeout completed without compressed or corpus promotion.

**Scope:** the visual issues recorded in [`visual_issues_in_journey_map.md`](visual_issues_in_journey_map.md), including the clarified requirement that opportunity references appear as plain, unboxed secondary text.

**Primary proof:** the focused Journey Map fixtures and plates cataloged in [`staged_journey_map_renderer_current_state_visual_review.md`](staged_journey_map_renderer_current_state_visual_review.md).

**Execution status:** execution closed on 2026-07-18 with `JM-VIS-002` still open. Bundle compatibility terms such as `inline_step_badges` and typed `badges` retain authority over inline reference presence, target resolution, ordering, and profile visibility; unboxed `metadata` is a staged Journey presentation choice and does not change SDD semantics. Direct-horizontal candidate policy is Journey-owned for this remediation. Connector labels remain deferred.

## 1. Outcome

Improve the staged Journey Map renderer without weakening the renderer architecture, source-order guarantees, bundle authority, deterministic output, or the accepted legacy paths. The work should produce:

1. vertically stacked parallel options in a shared progression column;
2. single-segment horizontal connectors between clear adjacent same-lane Steps;
3. minimal-turn routes where a legal minimal route exists;
4. right-edge Stage egress for long forward cross-Stage routes when that exit is clearer;
5. more breathing room between a connector's last bend and its arrowhead;
6. opportunity references rendered as plain, unboxed secondary metadata;
7. a materially less tangled dense expansion proof; and
8. no implementation of connector labels in this remediation.

The order above follows the issue catalog. It is not the recommended implementation order.

## 2. Authority and non-negotiable invariants

Use the following authority order when a decision is ambiguous:

1. repository `AGENTS.md`, the v0.1 bundle, and the staged-renderer constraints;
2. the desired outcomes in [`visual_issues_in_journey_map.md`](visual_issues_in_journey_map.md);
3. this plan for implementation sequencing and architecture;
4. [`staged_journey_map_renderer_verification_contract.md`](staged_journey_map_renderer_verification_contract.md) and the current-state review for proof ownership and evidence;
5. the [completed Journey Map architecture](<[Done] staged_journey_map_renderer_architecture.md>) and [completed migration plan](<[Done] staged_journey_map_renderer_gated_implementation_plan.md>) as historical guardrails.

The following invariants are mandatory throughout the work:

- Preserve the pipeline `projection -> RendererScene -> MeasuredScene -> PositionedScene -> SVG -> PNG`.
- Projection remains the semantic boundary. Placement, routing, line breaking, and SVG presentation remain renderer concerns.
- `RendererScene` may express layout intent, but not final coordinates, final route points, SVG, DOT, Mermaid, or engine-specific layout data.
- Do not introduce ELK/Elkjs or any other external graph layout engine.
- Preserve root, Stage, and Step authored order in model and scene arrays. Physical branch lanes may share a progression column, but must not rewrite semantic order.
- Do not use `PRECEDES` to globally reorder authored Steps. It may classify a narrowly recognized branch pattern for renderer-owned placement intent.
- Preserve every semantic edge occurrence, edge identity, author order, and duplicate ordinal exactly once.
- Keep the v0.1 bundle in control of reference source, target type, ordering, and profile visibility. Do not hardcode those semantics in the renderer.
- Preserve the simple/permissive/strict reference visibility behavior.
- Keep legacy DOT, Mermaid, and Graphviz-backed Journey Map output byte-stable unless a separately approved requirement says otherwise.
- Keep PNG derived from the exact staged SVG.
- Do not refresh snapshots, goldens, or corpus artifacts until the owning semantic, geometric, diagnostic, and visual acceptance checks pass.
- Preserve the shared hard arrow-marker terminal-leg minimum of `12px`.
- All fallback behavior must be deterministic and either contractually valid or explicitly diagnosed. A fallback must not silently conceal a failed visual invariant.

## 3. Issue register and recommended sequence

Gate 0 should add the proposed new IDs to the current-state review before implementation begins.

| Catalog issue | Tracking ID | Recommended gate | Reason for position |
| --- | --- | --- | --- |
| 6. Plain opportunity-reference text | `JM-VIS-008` | 1 | Removing badge chrome changes measurement, Step height, and every downstream route baseline. |
| 1. Stack parallel options | `JM-VIS-003` | 2–3 | Placement must stabilize before route-shape tuning. |
| 2. Straight adjacent connectors | `JM-VIS-001` | 4 | Directness depends on final branch columns and node heights. |
| 4. Distant-route vertical offset | `JM-VIS-006` | 5 | Establish the long-route shape before terminal-clearance tuning. |
| 5. Connector-end de-crowding | `JM-VIS-007` | 6 | Terminal treatment is a late constraint on accepted route shapes. |
| 3. Single-turn routes | `JM-VIS-005` | 7 | Reassess after stacking and direct-route work; the reported example may disappear. |
| 7. Dense expansion de-tangling | `JM-VIS-002` | 8 | Highest blast radius; it should build on all accepted placement and routing behavior. |
| 8. Connector labels | deferred | none | Explicitly out of scope. Preserve current omission. |

`JM-VIS-004` remains a regression watch for self-loop/backward-route separation at every routing gate.

## 4. Architectural direction

### 4.1 Keep semantics stable; change only staged presentation for opportunity references

The current bundle uses `show_reference_badges` and `inline_step_badges`, and the typed render model exposes `JourneyRenderReferenceBadge` and `JourneyRenderStep.badges`. Those names are compatibility surfaces shared with legacy renderers. Renaming them is not required to satisfy the visual requirement and would create unrelated bundle, projection, and legacy churn.

For this remediation:

- preserve the bundle values, projection data, typed reference records, sorting, target-name fallback, and profile policy;
- preserve stable reference content IDs where practical, even if they contain the historical `__badge__` term;
- in the staged Journey Map scene only, emit each visible reference as `kind: "metadata"`, `textStyleRole: "metadata"`, `region: "secondary"`, and `priority: "secondary"`;
- rely on the existing metadata measurement and SVG behavior, which is already unboxed in other staged views;
- do not add Journey-specific SVG CSS or a transparent/zero-radius badge workaround; and
- do not change the shared rendering of legitimate `badge_text` blocks used by other views.

This is deliberately a presentation change at the `RendererScene` boundary, not a change to SDD semantics.

The visual precedent is the unboxed metadata used for `INSTRUMENTED_AT`/`IMPLEMENTED_BY` references in the staged Outcome-Opportunity Map and for `route_or_key` in the staged IA Place Map. The IA access badge such as `auth` is explicitly not the precedent.

The Journey router already treats all secondary content as an obstacle, but its diagnostic is named `renderer.routing.journey_map_badge_intersection`. Amend the diagnostic contract and replace that Journey-specific code with a truthful generic name such as `renderer.routing.journey_map_secondary_content_intersection`. Update the verification contract and focused negative test in the same gate. Do not emit duplicate old/new diagnostics.

### 4.2 Add backend-neutral explicit grid-cell intent

The current shared grid layout is row-major and accepts only a column count. It cannot express `J-202` and `J-203` in the same progression column without reordering children or patching coordinates after layout. Neither approach is acceptable.

Extend the shared `LayoutIntent` contract with an additive explicit grid-placement form, conceptually:

```ts
grid?: {
  placements: Array<{
    itemId: string;
    row: number;
    column: number;
  }>;
}
```

The exact property spelling may be finalized during implementation, but the contract must have these characteristics:

- it is backend-neutral and contains integer cell intent, not coordinates;
- it is additive: existing grids without explicit placements remain byte-stable;
- placement records are deterministic and keyed by child ID;
- the shared macro-layout layer validates unknown IDs, duplicate IDs, duplicate cells, negative/non-integer indices, and omitted children;
- invalid intent produces a generic layout diagnostic and a deterministic existing-behavior fallback; and
- shared macro-layout tests prove both explicit placement and unchanged row-major fallback.

Do not introduce a Journey-specific layout strategy or manipulate `PositionedScene` coordinates after shared macro layout.

### 4.3 Introduce a narrow Journey middle layer for physical placement metadata

Branch recognition and cell assignment are substantial enough to justify a dedicated `src/renderer/staged/journeyMapMiddleLayer.ts`, rather than continuing to grow the scene builder or router.

The middle layer should derive renderer-owned placement metadata from the already typed Journey render model. It may annotate Step metadata with fields such as:

- `progressionColumn`;
- `laneOrder`;
- `branchGroupId`; and
- `placementRole` (`split`, `option`, `join`, or ordinary).

These fields express physical layout classification only. Retain `rootOrder`, `stageOrder`, `stepOrder`, and `globalStepOrder` for semantic/authored ordering.

Recognize only conservative, deterministic simple diamonds in the first implementation:

1. a split Step has at least two ordinary forward `PRECEDES` successors in the same Stage;
2. the option Steps are contiguous in authored `CONTAINS` order;
3. each option has the same unique direct join Step;
4. the join follows the option block in authored order; and
5. the candidate is not cyclic, backward, cross-Stage, nested, overlapping, or otherwise ambiguous.

For the primary proof, assign:

- `J-201`: column 0, row 0;
- `J-202`: column 1, row 0;
- `J-203`: column 1, row 1; and
- `J-204`: column 2, row 0.

The first-authored option owns the main lane. Later authored options stack below it. Unsupported topology retains the current single-row authored placement and current routing behavior; it is not automatically an error. A malformed explicit grid intent, by contrast, is a renderer contract violation and must be diagnosed.

### 4.4 Separate authored order from spatial adjacency

After branch stacking, `stepOrder` alone is no longer sufficient to decide whether two nodes are physically adjacent. The router should use:

- authored order for semantic direction, stable edge ordering, duplicate ordering, and contradiction detection; and
- `progressionColumn` plus `laneOrder` for physical adjacency, aligned-lane directness, and branch track selection.

Update source-order assertions accordingly. Scene child arrays must remain authored. Ordinary non-branch Stages should remain strictly increasing in X. Within a recognized branch diamond, progression columns must be monotonic, only recognized options may share X, and their Y/lane order must follow authored order.

### 4.5 Evolve routing through deterministic candidates, not fixture-specific branches

Each route improvement should add a named candidate or preference to the Journey router and evaluate it against the same hard geometry rules. Candidate selection should be lexicographic, not a single opaque weighted score:

1. semantic correctness and exact edge preservation;
2. legal ports, marker legs, orthogonality, obstacle/content/chrome clearance;
3. Stage ownership and avoidance of unrelated Stage interiors;
4. route separation, crossing count, and endpoint traceability;
5. desired route family for the relevant case;
6. bend count;
7. route length; and
8. stable ID/author-order tie-breakers.

Do not add branches keyed to `J-201`, `J-203`, `J-204`, `J-401`, `G-900`, or `G-910`. Those IDs belong only in fixtures and assertions.

### 4.6 Use a preferred Journey terminal leg without weakening the shared minimum

The shared `MIN_ARROW_MARKER_LEG = 12px` is a hard validity threshold. The desired de-crowding is a visual preference of `18px`—1.5 times the hard minimum—between the last bend and the arrowhead on bent Journey routes.

Add a Journey-specific preferred terminal-leg constant or routing option of `18px`. Do not globally change the shared `12px` value. Direct one-segment routes have no last bend and are exempt from the preferred-length assertion. If an 18px terminal leg cannot be achieved without violating a higher-priority invariant, retain at least 12px and emit a deterministic Journey degraded-output diagnostic with the edge ID and achieved/desired lengths. A nominal proof fixture fails if it produces that fallback.

## 5. Step-by-step implementation gates

### Gate 0 — lock the remediation contract and baseline

**Purpose:** eliminate ambiguity before production changes.

1. Update the current-state visual review with `JM-VIS-005` through `JM-VIS-008`, affected plates, proof edges, and explicit status.
2. Record connector labels as deferred and out of scope.
3. Correct links in current docs that still point to pre-`[Done]` architecture/plan filenames, and link this plan as the active execution document.
4. Amend the verification contract before code:
   - replace the universal Stage-child X-order assertion with the authored-order/progression-column rules in section 4.4;
   - define plain reference metadata and the renamed secondary-content collision diagnostic;
   - identify the exact proof edge or edges for terminal de-crowding;
   - set `18px` as the preferred last-leg value for bent nominal Journey routes;
   - define the dense-case structural and numeric acceptance criteria below.
5. Capture a read-only baseline: focused test results, current diagnostics, route bend/terminal-length inventory, node/root dimensions, the compressed proof's 42 crossing warnings, and protected hashes.
6. Record protected surfaces: v0.1 bundle semantics, projection snapshots, legacy Journey DOT/Mermaid outputs, other staged renderer goldens, and public SVG/PNG selection behavior.

**Exit:** every issue has an owner, exact proof, automated assertion, human review plate, and pass/fail rule. No production file changes.

**Stop:** do not proceed if a desired behavior requires new SDD semantics that the current bundle cannot express. Extend the bundle contract first in a separately reviewed prerequisite.

### Gate 1 — render opportunity references as plain secondary metadata

**Purpose:** stabilize measurement before placement and routing work.

1. Change only the staged Journey scene builder's reference content blocks from badge presentation to metadata presentation.
2. Preserve reference values, order, profile visibility, target-name fallback, semantic identity, and stable content IDs.
3. Rename the Journey secondary-content intersection diagnostic and update the verification contract and tests.
4. Update scene and measurement assertions before any golden refresh.
5. Confirm simple hides references while permissive and strict show the same ordered plain text.
6. Confirm the SVG contains no rectangle or pill associated with these Journey reference blocks.
7. Confirm `badge_text` rendering in IA Place Map and any other legitimate consumer is unchanged.

**Likely production scope:** `src/renderer/staged/journeyMap.ts`, `src/renderer/staged/journeyMapRouting.ts`; no shared SVG backend, bundle, projection, or legacy render-model change should be necessary.

**Acceptance:** the primary reference plate shows clean unboxed text; secondary-content collision checks remain active and truthful; deterministic output and protected hashes pass.

**Stop:** if the implementation requires Journey-only SVG styling, invisible rectangles, or changes to shared badge chrome, reject it and return to the scene-block design.

### Gate 2 — add explicit grid-cell intent to shared macro layout

**Purpose:** create the reusable layout capability required by branch stacking.

1. Extend the renderer-owned layout contract with explicit grid placements.
2. Implement validation and deterministic fallback in shared macro layout.
3. Add isolated shared tests for uneven child sizes, sparse row/column indices, centered/start alignment, invalid intent, and legacy row-major parity.
4. Do not enable the new intent in Journey Map yet.
5. Hash or compare representative non-Journey staged outputs to prove unchanged fallback behavior.

**Likely production scope:** `src/renderer/staged/contracts.ts`, `src/renderer/staged/macroLayout.ts`.

**Acceptance:** generic tests prove the new intent; all existing containers without it are unchanged.

**Stop:** do not proceed if explicit cells require final coordinates in `RendererScene` or force changes to unrelated view builders.

### Gate 3 — recognize and stack simple Journey branch diamonds

**Purpose:** resolve the placement part of `JM-VIS-003` before tuning routes.

1. Add the Journey middle layer and typed physical-placement metadata.
2. Recognize only the conservative simple-diamond topology described in section 4.3.
3. Feed explicit grid-cell intent to each eligible Stage while retaining authored child arrays.
4. Keep unsupported/ambiguous cases on the current single-row layout.
5. Update pre-routing and source-order assertions to distinguish authored order from progression columns.
6. If placement alone creates a hard-invalid route, make only the minimum routing classification change required to retain hard validity; defer visual route optimization to Gate 4.
7. Review both branch fan-out and join fan-in plates at normal size.

**Likely production scope:** new `src/renderer/staged/journeyMapMiddleLayer.ts`, plus `contracts.ts`, `journeyMap.ts`, and narrowly `journeyMapRouting.ts`.

**Acceptance:** `J-203` is below `J-202`; `J-201` and `J-204` remain on the main lane; source arrays and edge identities are unchanged; no new overlap, intrusion, Stage-header crossing, or ambiguous merged trunk appears.

**Stop:** if the topology recognizer begins behaving like a general graph layout engine or uses broad `PRECEDES` reordering, narrow the supported pattern rather than adding heuristics.

### Gate 4 — align clear adjacent same-lane connectors

**Purpose:** close `JM-VIS-001` for the named Journey cases.

1. Add a Journey-only direct-horizontal route candidate.
2. Define eligibility using physical adjacency: consecutive progression columns, same lane, east-to-west direction, overlapping legal side interiors, and a clear horizontal corridor.
3. Choose a shared endpoint Y deterministically by minimizing total endpoint displacement, then preferring the main/authored lane, then coordinate order.
4. Reserve the shared endpoint Y before late endpoint ordering.
5. Carry an explicit direct-route preference/lock through final reconstruction so later occupancy logic cannot recreate a dogleg.
6. Keep duplicate same-endpoint occurrences visually distinct; do not collapse their semantic identities onto one path.
7. Document this helper as an extraction candidate for shared routing only after a second staged view demonstrates the same need.

**Acceptance proofs:**

- `J-101 -> J-102` is one horizontal segment;
- `J-102 -> J-103` is one horizontal segment;
- `J-201 -> J-202` is one horizontal segment after branch stacking; and
- the public `J-001 -> J-002` example is one horizontal segment when unobstructed.

All four must retain legal ports, clear arrows, exact edge counts, and zero secondary-content intersections.

**Stop:** do not weaken shared obstacle checks, snap endpoints after routing, or encode fixture IDs to obtain straight lines.

### Gate 5 — add right-edge egress for long forward cross-Stage routes

**Purpose:** close `JM-VIS-006` without inflating the source Stage.

1. Add a named long forward cross-Stage candidate that exits from the source Step's east side.
2. Route to a legal gate on the source Stage's right boundary.
3. Descend only after leaving the Stage, using the inter-root gutter or root-owned exterior track.
4. Continue on a root-owned track and enter the target through a legal target Stage gate/port.
5. Select this candidate only when its source-to-right-boundary corridor is clear and it wins the lexicographic routing priorities.
6. Compare Stage/root dimension changes against the Gate 0 baseline.

**Acceptance proof:** `J-204 -> J-401` no longer exits through the bottom of the source Stage; the source Stage is not vertically expanded for this route; intervening items and Stage chrome remain clear.

**Stop:** do not promise a globally straight long route where intervening root items require a bypass. The acceptance is right-edge source egress and reduced local vertical distortion, not zero bends at any cost.

### Gate 6 — increase last-bend-to-arrow clearance

**Purpose:** close `JM-VIS-007` after route families stabilize.

1. Add the `18px` Journey preferred terminal leg for bent routes.
2. Incorporate it while constructing candidates, rather than moving the final point after collision validation.
3. Re-run occupancy, endpoint ordering, marker-leg enforcement, and collision validation with the preferred leg.
4. Add the explicit degraded diagnostic for routes that achieve 12–17px only.
5. Inventory every final Journey edge: direct routes are marked not applicable; bent nominal routes meet 18px; constructed degraded tests meet 12px and emit the expected diagnostic.
6. Review crowded fan-in, duplicate, self-loop, backward, and dense cases for regressions.

**Acceptance:** all named nominal proofs meet the preferred clearance, no arrowhead overlaps a turn or neighboring route, and the shared 12px hard contract remains unchanged.

**Stop:** do not globally copy the Outcome-Opportunity router or its constants. Reuse its 18px value as visual precedent while preserving Journey-specific route ownership.

### Gate 7 — reassess minimal-turn routing

**Purpose:** avoid implementing a fix for a case that earlier gates eliminate.

1. Re-render and measure every issue-3 example after Gates 1–6.
2. If the reported `J-201 -> J-203` four-segment shape no longer exists and no equivalent avoidable case remains, record `JM-VIS-005` as superseded by placement/directness work. Add a regression assertion for the accepted new shape; write no new routing code.
3. If an avoidable multi-turn case remains, add deterministic enumeration of legal minimal L-shaped candidates using valid source/target sides, exterior approach rules, obstacle clearance, route separation, and preferred terminal length.
4. Select a one-turn candidate only when it satisfies every higher-priority invariant.

**Acceptance:** each named case uses the minimum legal turn count; a route may retain extra turns only when the test identifies the blocking obstacle or ownership constraint.

**Stop:** if the proposed minimal route crosses node content, Stage chrome, another route's required separation, or creates an illegal target approach, retain the safer route and document why.

### Gate 8 — de-tangle the dense expansion proof

**Purpose:** address `JM-VIS-002` only after the lower-risk geometry is stable.

1. Treat this as a candidate experiment before changing committed evidence.
2. Add an early south-egress candidate for root-owned branch fan-out:
   - a short departure near the source;
   - separated vertical descents near the source side;
   - ordered gates through the south boundary of `G-900`; and
   - horizontal root-owned tracks beginning below that boundary rather than inside the Stage.
3. Ensure the route owner, not the containing Stage, funds exterior root tracks.
4. Compare current and candidate artifacts with identical content, dimensions, and review scale.
5. Require all of the following before accepting the candidate:
   - zero long root-owned horizontal spans through the interior of `G-900`;
   - no source-Stage expansion attributable only to those spans;
   - no increase in hard diagnostics, route omissions, or crossings;
   - visibly traceable fan-out and arrowheads at normal size; and
   - at least a 25% reduction from the accepted 42 residual crossings, meaning no more than 31, before claiming `JM-VIS-002` closed.
6. If the structural composition improves but the crossing count remains above 31, record a partial improvement and keep `JM-VIS-002` open.
7. Re-check compressed Stage/root dimensions against the Gate 0 baseline and lock an exact permissible growth bound before committing snapshots.

**Acceptance:** the dense proof is materially easier to trace, meets the numeric gate, and does not trade local detours for new global expansion or ambiguity.

**Stop:** if early egress produces structurally wrong ownership, speculative tuning, or snapshot churn without the material improvement above, stop and report the experiment instead of normalizing it.

### Gate 9 — integration, evidence capture, and closeout

**Purpose:** promote only behavior already accepted in focused proofs.

1. Run the complete focused Journey matrix and affected shared regression suites.
2. Render temporary SVG/PNG artifacts and conduct normal-size review against every affected plate.
3. Report satisfied invariants, violated invariants, residual warnings, and open issue status explicitly.
4. Refresh focused scene/stage/diagnostic/SVG goldens only after their owning gates pass.
5. Generate the rendered corpus only after focused acceptance; inspect every changed file before retaining it.
6. Run two corpus generations and compare sorted hashes for determinism.
7. Verify public unsuffixed Journey SVG/PNG still selects the staged backend, PNG derives from the exact SVG, and explicit legacy artifacts remain exact.
8. Update the current-state review, verification contract, issue catalog statuses, and this plan's execution ledger.
9. Keep connector labels documented as deferred; do not alter label model, placement, or bundle behavior.

**Exit:** focused and full verification pass, accepted artifacts are deterministic, protected outputs are exact, and each issue is closed, partial, superseded, or deferred with evidence.

## 5.1 Execution ledger

| Gate | Result | Evidence and decision |
| --- | --- | --- |
| 0 — contract and baseline | complete | Bundle-controlled reference presence/order was separated from staged presentation chrome; direct-route policy was recorded as Journey-owned; validation paths were made repository-relative. The dense baseline was 42 crossings; pre-routing root `1888×192`, `G-900` `760×128`, `G-910` `760×128`; final root `2064×384`, `G-900` `872×224`, `G-910` `760×160`. Protected output matrices established the legacy/projection/non-Journey hash boundary. |
| 1 — plain reference metadata | complete | Strict and permissive staged Journey references render as unboxed secondary metadata, simple remains hidden, and shared legitimate `badge_text` chrome is unchanged. The collision diagnostic is `renderer.routing.journey_map_secondary_content_intersection`. |
| 2 — explicit shared grid | complete | Measurement and macro layout consume the same pure resolver; complete/unique/non-negative placement validation, sparse cells, alignment, fallback, deep-clone isolation, and existing row-major byte parity are covered. |
| 3 — middle layer and stacking | complete | The extracted middle layer recognizes only the locked non-overlapping simple-diamond topology. `G-200` retains authored children `[J-201,J-202,J-203,J-204]` while assigning `(0,0)`, `(1,0)`, `(1,1)`, `(2,0)`. Unsupported topology keeps the former horizontal fallback. |
| 4 — direct routes | complete | The common deterministic selector scores actual previously accepted provisional routes in authored order. `J-101→J-102`, `J-102→J-103`, `J-201→J-202`, and public `J-001→J-002` are one segment; duplicate same-endpoint groups remain excluded. |
| 5 — right-edge egress | complete | `J-204→J-401` selects `long_forward_east_egress`, leaves `G-200` through its east gate before descending, and does not change `G-200` dimensions. |
| 6 — preferred terminal leg | complete with one specified degraded case | Preferred 18px construction runs before occupancy and endpoint resolution. Nominal bent proofs meet 18px; dense `J-903→J-950` exhausts bounded alternatives at 12px and emits exactly one warning containing achieved 12, desired 18, and hard minimum 12. |
| 7 — minimal-turn reassessment | complete | Stacked fan-out/fan-in use selected minimal-L candidates where legal. The original `J-201→J-203` multi-turn defect disappeared, so `JM-VIS-005` is superseded by the executable stacked-placement/candidate proof. |
| 8 — dense early-egress experiment | rejected | The experiment preserved all 18 edge identities and emitted no hard errors, but produced 58 residual crossings and 56 continuity marks, root `2064×400`, `G-900` `856×224`, and `G-910` `760×160`. It failed the `≤31` crossing and `≤2064×384` root gates. `early_south_egress` was withdrawn from selection, compressed goldens were not refreshed, and `JM-VIS-002` remains open. |
| 9 — integration and closeout | partial by stop rule | Focused Journey, shared-grid, protected legacy/projection, non-Journey staged, public backend, build, and the full serial Vitest run pass (`161/161` suites, `630/630` tests). Accepted focused Journey evidence was refreshed only for completed gates. Corpus generation and promotion were withheld because Gate 8 failed; no corpus bytes were normalized around the rejected dense output. |

Independent read-only review accepted the primary and topology proofs at intrinsic size and confirmed no unexplained non-Journey drift. It rejected the dense composition on the numeric gates above. Residual runtime diagnostics are the one dense preferred-leg warning, 58 dense crossing warnings, and the pre-existing informational topology diagnostics; accepted nominal proofs have no hard routing diagnostics.

The immutable before/after provenance, accepted comparison plates, current-runtime public proof, and rejected dense artifacts were captured on 2026-07-22 in the [Journey Map visual remediation comparison record](journey_map_visual_remediation_comparison_record.md). This documentation record does not change any execution-ledger decision.

## 6. Required test strategy

Add structural assertions before snapshot updates. The likely focused matrix is:

| Concern | Command |
| --- | --- |
| Build/typecheck | `TMPDIR=/tmp pnpm run build` |
| Journey model/profile/legacy preservation | `TMPDIR=/tmp pnpm exec vitest run tests/projectionSnapshots.spec.ts tests/render_profile_display.spec.ts tests/render_dot.spec.ts tests/render_mermaid.spec.ts tests/journeyMapRenderModel.spec.ts` |
| Scene and measurement | `TMPDIR=/tmp pnpm exec vitest run tests/stagedJourneyMap.spec.ts tests/journeyMapPreRouting.spec.ts tests/stagedRenderer.spec.ts tests/stagedSceneBuilders.spec.ts tests/stagedSvgBackend.spec.ts` |
| Shared explicit grid | `TMPDIR=/tmp pnpm exec vitest run tests/stagedMacroLayout.spec.ts` |
| Journey routing and visual geometry | `TMPDIR=/tmp pnpm exec vitest run tests/journeyMapRouting.spec.ts tests/journeyMapVisualAcceptance.spec.ts tests/journeyMapRendererStageSnapshots.spec.ts tests/stagedVisualAcceptance.spec.ts` |
| Shared renderer regression if shared files change | `TMPDIR=/tmp pnpm exec vitest run tests/scenarioFlowRouting.spec.ts tests/outcomeOpportunityMapRouting.spec.ts tests/stagedServiceBlueprint.spec.ts tests/stagedVisualAcceptance.spec.ts tests/stagedMacroLayout.spec.ts` |
| Public backend/CLI | `TMPDIR=/tmp pnpm exec vitest run tests/viewRenderers.spec.ts tests/previewWorkflow.spec.ts tests/cli.spec.ts` |
| Corpus | `TMPDIR=/tmp pnpm exec vitest run tests/renderedCorpus.spec.ts` |
| Full suite | `TMPDIR=/tmp pnpm test` |
| Generate corpus, Gate 9 only | `TMPDIR=/tmp pnpm run generate:rendered-examples` |
| Whitespace/scope | `git diff --check`; `git status --short`; `git diff --name-only` |

If normal parallel execution hits the repository's known wall-clock contention after all focused suites pass, use the established serial confirmation: `TMPDIR=/tmp pnpm exec vitest run --no-file-parallelism --reporter=dot`. Do not change timeouts merely to make a visual remediation appear green.

Each affected proof should assert, as applicable:

- model/scene authored order and stable identity;
- explicit progression columns and lane order;
- exact edge occurrence count;
- orthogonal, non-zero route segments;
- expected source/target sides and Stage gates;
- node, secondary-content, Stage-header, and unrelated-Stage clearance;
- route separation and crossing counts;
- minimum and preferred terminal-leg lengths;
- no unexpected diagnostics;
- deterministic repeat output; and
- SVG/PNG parity.

## 7. Artifact and review policy

- Use temporary review artifacts until the owning gate passes.
- Retain the existing historically named `journey-map.badges.*` files during the remediation if renaming would obscure baseline comparison. Their content may prove plain reference metadata even though the filename records historical terminology.
- Do not infer acceptance from a green snapshot test. Geometry and normal-size human review are independent gates.
- Review the primary proof after every geometry gate and the compressed proof after every routing gate, even when the compressed issue is not yet being tuned.
- Any changed non-Journey staged output requires an explanation and explicit review; an unexplained change is a stop.
- Corpus regeneration is evidence capture, never a repair mechanism.

## 8. Explicitly out of scope

- connector-label modeling, measurement, placement, or SVG rendering;
- bundle vocabulary migration from `badge` terminology to `metadata` terminology;
- projection, parser, compiler, or validator behavior changes unless Gate 0 identifies an unexpressible semantic prerequisite;
- removal or redesign of legacy DOT/Mermaid/Graphviz paths;
- adoption of ELK/Elkjs;
- broad shared-router extraction based on only one Journey use case;
- unrelated renderer cleanup or corpus drift normalization.

Connector labels should receive a separate spec-first plan later. That work must identify label source semantics in the bundle/render model before it adds measurement or placement behavior.

## 9. Global stop conditions

Stop the current gate and report the mismatch when any of the following occurs:

- a proposed fix contradicts the authority hierarchy or bundle-controlled behavior;
- authored order or semantic edge identity changes;
- a route becomes diagonal, enters content/chrome, uses an illegal port, or loses its arrow marker leg;
- a branch-placement heuristic affects ambiguous or unsupported topology without an explicit contract;
- a fallback silently fails the desired visual invariant;
- dense tuning moves clutter without materially improving traceability;
- a snapshot or corpus refresh would be needed to hide a failing acceptance assertion;
- unrelated staged or legacy outputs change without prior architectural justification; or
- the implementation begins encoding fixture IDs, final coordinates, or engine-specific data in scene contracts.

The correct response to a stop is a focused invariant report and a plan amendment, not additional speculative tuning.
