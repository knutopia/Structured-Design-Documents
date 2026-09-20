# Routing Hardening Implementation Plan

**Status:** Implemented; stages 0–7 accepted on 2026-09-14. See [execution evidence and unrelated full-suite issues](implementation_status.md).  
**Date:** 2026-09-12  
**Audience:** The implementation orchestrator and its implementers/reviewers.  
**Objective:** Make shared final route resolution trustworthy, prove it through Outcome–Opportunity, and establish the same guarantee in its Service Blueprint and Scenario Flow callers without redesigning all six renderers.

## 1. Mandate and finish line

At the shared final-resolution boundary, a successful result must certify that the complete reconstructed routes satisfy the declared hard routing rules. Failed validation must influence repair, candidate selection, or layout expansion. Exhausting a bounded search must produce an explicit failure, never an accepted invalid diagram.

This program addresses the defect family exposed by `sdd_for_sdd.sdd`, including the shared logic errors and missing production lifecycle integration. It is larger than adjusting two connector turns and smaller than replacing every renderer's routing architecture.

The primary adoption scope is Outcome–Opportunity, Service Blueprint, and Scenario Flow. Journey participates in regression verification and any necessary adaptation to corrected lower-level solver behavior. IA Place Map and UI Contracts retain their current routing paths and receive compatibility checks.

The orchestrator must distinguish four claims throughout the work:

1. A lower-level assignment satisfies the constraints supplied to it.
2. A reconstructed route set passes complete geometry acceptance.
3. A production renderer actually uses that acceptance and repair path.
4. The resulting diagram passes independent geometry and visual acceptance.

None of these claims establishes the next automatically. The earlier unification delivered substantial shared machinery but did not establish all four in production. Do not repeat that completion error.

## 2. Authority, evidence, and invariants

### 2.1 Source roles

| Role | Source | How to use it |
| --- | --- | --- |
| Workspace authority | [AGENTS.md](../../AGENTS.md) | Governs bundle ownership, renderer boundaries, determinism, acceptance gates, and stop conditions. |
| Machine-readable semantic contract | [View bundle](../../bundle/v0.1/core/views.yaml), loaded through [manifest.yaml](../../bundle/v0.1/manifest.yaml) | Governs view semantics, channels, semantic priority, and display policy. |
| Renderer architecture | [Renderer migration guidance](../toolchain/renderer_migration_guidance.md), [architecture](../toolchain/architecture.md) | Preserve projection and staged renderer boundaries; shared infrastructure owns general routing mechanics. |
| Earlier requirements and completion discrepancy | [Routing unification plan](<../Done/[Done] routing_unification/[Done] routing_unification_implementation_plan.md>) | Its shared lifecycle, acceptance policy, and completion criteria explain the intended contract. Its “complete” status is not evidence of current production adoption. |
| Exact defect evidence | [sdd_for_sdd.sdd](../sdd_app_planning/sdd_for_sdd.sdd), Section 3 below | First mandatory production proof. Reproduce against the implementation checkout before relying on coordinates. |
| Accepted visual references | Existing Outcome `multiple_outcomes` proofs and the renderer-specific visual suites | Preserve established readability, endpoint conventions, labels, and intentional crossings. References illustrate quality; they do not override invariants. |
| Independent acceptance oracle | [stagedVisualHarness.ts](../../tests/stagedVisualHarness.ts), [stagedVisualAcceptance.spec.ts](../../tests/stagedVisualAcceptance.spec.ts), Journey's visual tests | Check final geometry independently of the production solver and validator. |

Where architectural prose describes a desired implementation that the source does not yet provide, record that discrepancy. Do not reinterpret the source as satisfying the prose simply because tests pass.

### 2.2 Non-negotiable invariants

These IDs are used in stage reports and the completion ledger.

| ID | Invariant | Authority |
| --- | --- | --- |
| H1 | Preserve `projection -> RendererScene -> MeasuredScene -> PositionedScene -> SVG -> PNG`. Routing stays downstream of projection; no final geometry enters `RendererScene`. | AGENTS.md, Renderer Constraints; migration guidance, Internal Forms. |
| H2 | Every successful final-resolution result passes all declared hard rules on the complete, current, reconstructed geometry, including fixed endpoint sections and interactions with unchanged routes. | Earlier plan, Shared solve lifecycle and Common Acceptance Policy; this plan's mandate. |
| H3 | Competing parallel sections retain 16px minimum separation subject to the existing 0.5px tolerance. No prohibited positive-span collinear sharing, node intrusion, endpoint intrusion, or non-orthogonal output is accepted. | Earlier plan, Common Acceptance Policy; current shared policy and validator. |
| H4 | Preserve declared ports, endpoint sides, semantic edge identity, marker behavior, and view-authorized sharing/crossing policy. Marker-leg requirements must be explicit and justified. | AGENTS.md; earlier plan, Internal contracts and Common Acceptance Policy. |
| H5 | One physical run has one authoritative assignment for a given geometry revision. Reconstruction and later passes cannot silently discard that assignment or invalidate acceptance. | Earlier plan, Stable physical-segment ownership; AGENTS.md, Decision traceability. |
| H6 | Search, repair, and expansion are finite and deterministic. Unsuccessful searches report their limits and remaining violations without claiming mathematical impossibility unless that was proved. | AGENTS.md, Renderer Constraints; earlier plan, Deterministic assignment. |
| H7 | Semantic policy remains bundle-owned and reaches the runtime through loaded bundle data. General geometry and solving remain shared renderer infrastructure. | AGENTS.md, Bundle Authority; earlier plan, Bundle-Authority Gate. |
| H8 | Preserve valid existing geometry when it already meets the complete contract and no implicated dependency requires movement. Preserve parser, compiler, graph validator, projection, and legacy behavior. | AGENTS.md; earlier plan, Compatibility and Rollout. |
| H9 | Proof geometry and SVG/derived-PNG appearance are accepted before refreshing related goldens. Every substantial pass reports satisfied and violated invariants. | AGENTS.md, Quality And Drift Control. |
| H10 | Production integration is proved behaviorally for all three adopters. A lifecycle export, an import, or a synthetic lifecycle test alone does not establish adoption. | Earlier plan, Affected Renderer Matrix and Completion Criteria; this plan's mandate. |

For H4, audit the current `minTerminalLeg: 0` overrides. The shared default is 12px, but blindly applying one value to every marker and port configuration is not a substitute for a documented marker-aware requirement. A zero requirement must have a geometric/marker justification, not merely preserve a passing test.

### 2.3 Bundle gate

Before modifying routing behavior, classify every adapter input used by the new path as:

- Existing bundle-owned semantics.
- Pure geometric mechanics or renderer policy.
- View-owned topology derived from bundle semantics.
- Missing bundle-owned semantic policy.

The existing Outcome channel and priority path is `bundle/v0.1/core/views.yaml` → `loadBundle(...)` → `ViewSpec.conventions.renderer_defaults.connectors` → `outcomeOpportunityMapRenderModel.ts` → the staged adapter. Preserve it.

If the work needs a configurable or channel-specific sharing, crossing, port, or semantic ordering rule, extend a typed routing-policy portion of the view bundle first. The implementation must identify the exact new fields in `core/views.yaml`, extend [bundle types](../../src/bundle/types.ts), validate them in [validateLoadedBundle.ts](../../src/bundle/validateLoadedBundle.ts), and consume them through [loadBundle.ts](../../src/bundle/loadBundle.ts) and the relevant render-model/adapter entrypoint. Add a bundle-mutation test proving that changing the field changes runtime behavior.

Do not put interval math, search mechanics, or this reproduction's pixel coordinates into the bundle. No grammar change is expected or authorized by this plan.

## 3. Verified diagnosis to preserve

### 3.1 Reproduction

From the repository root, the reported command is:

```bash
TMPDIR=/tmp pnpm sdd show "$PWD/docs/sdd_app_planning/sdd_for_sdd.sdd" \
  --view outcome_opportunity_map --detail detailed \
  --decorators type,id --diagnostics json
```

During diagnosis this produced exactly three `renderer.routing.outcome_opportunity_track_separation` errors and exit code 1:

| Horizontal sections | Y coordinates | Shared X span | Separation |
| --- | --- | --- | --- |
| I-010 departure / I-011 arrival at OP-010 | 92.5 / 94 | 16px | 1.5px |
| I-011 departure / I-020 arrival at OP-020 | 212.5 / 198 | 48px | 14.5px |
| I-011 departure / I-021 arrival at OP-020 | 212.5 / 214 | 64px | 1.5px |

Each relevant connector has a horizontal departure, a vertical run, and a horizontal arrival. The port fixes the horizontal section's Y-coordinate; the adjacent vertical run controls the section's length. A fixed transverse coordinate does not make the section's longitudinal span independent of the solve.

### 3.2 Observed failure chain

1. The first separation conflict is present in early route templates. The later view compaction introduces the other two while separating vertical runs. It does not enforce the horizontal consequences of those turn assignments.
2. Outcome's local displacement pass requests a 14.5px adjustment for I-011's arrival section. `buildFinalRoute` reconstructs the attempted detour with both turns at X=507.336. The detour has zero width; normalization removes the redundant points and restores the conflicting section at Y=94. This was observed in raw and collapsed points, not inferred solely from source.
3. At the shared occupancy boundary there are 28 segments. All 19 horizontal segments are excluded by the relevant-entry filter. The remaining nine vertical segments receive their existing coordinates. The helper returns `resolved` with zero displacement.
4. A debugger evaluation passing all 28 entries directly to the lower solver still returns `resolved` with no violations or movement. `claimsCompete` rejects pairs whose allowed coordinate ranges do not overlap, overlooking nearby distinct locked tracks that violate separation.
5. Outcome's separate final validator detects the three conflicts. No production call to `runRoutingLifecycle` feeds them into another attempt.

The shared reconstruction helper did **not** create these three errors: it made no changes in this reproduction. Do not use the earlier general hypothesis about displacement-created conflicts as the specific causal explanation here. Such conflicts still require their own regression coverage.

### 3.3 Feasibility evidence and limits

On a copy of the paused final scene, moving only these vertical runs yielded zero shared validation violations, including a 12px terminal-leg requirement:

| Connector | Original X | Feasible X |
| --- | --- | --- |
| I-010 → OP-010 | 523.336 | 411.336 |
| I-011 → OP-010 | 507.336 | 427.336 |

Nodes, ports, canvas size, and every other connector stayed unchanged. Permitted perpendicular crossings decreased.

This proves available routing capacity for this case. It is not an implementation, an optimality claim, an approved visual artifact, or a golden. Never encode these IDs, coordinates, or a globally reversed fan order as the solution. Re-establish the reproduction after recording the implementation checkout and rebuilding `dist`, because the CLI runs compiled JavaScript.

## 4. Scope and affected paths

| Area | Required work | Boundary |
| --- | --- | --- |
| Shared geometry/claims/solver | Correct competition, fixed-section representation, reconstruction dependencies, and result semantics. | No domain identifiers or proof coordinates in the core. |
| Shared lifecycle | One authoritative bounded final-resolution path with current-geometry validation and effective repair. | Adapt the existing lifecycle; do not grow an unrelated second lifecycle beside it. |
| Outcome–Opportunity | First production adopter and mandatory exact proof. Repair/displace turns with their terminal consequences represented. | Preserve semantic columns, bands, nodes, ports, labels, and archetypes unless an evidenced correction requires a local change. |
| Service Blueprint | Adopt the same final guarantee and enable complete applicable interaction checks. | Preserve lanes, semantic topology, and existing candidate families. |
| Scenario Flow | Adopt the same final guarantee after its semantic layout/expansion stage. | Preserve Step spine, branch order, decision ports, parking behavior, and eight-pass expansion bound. |
| Journey Map | Verify corrected lower solver and make narrow compatibility changes if needed. | Retain Journey's orchestration, directional resources, reciprocal constraints, crossing minimizer, and continuity marks. |
| IA / UI | Verify shared geometry/validation compatibility. | No migration to the new final solver is required. Preserve their explicit sharing and container-origin contracts. |

Current direct callers of `resolveAndReconstructRouteOccupancy` are Outcome, Service, and Scenario. Journey calls `solveRoutingClaims` directly. Changes to geometry or validation have a wider reach than changes to the occupancy wrapper; keep that distinction in every change review.

Out of scope: parser/compiler/projection redesign; label-placement unification; new layout engines; node-layout redesign; universal candidate generation; wholesale deletion of legacy custom routing; renderer registry changes; new user-visible flags; broad changes to IA/UI/Journey orchestration; and unrelated website or documentation migrations.

Small cleanup of a superseded final pass is in scope when necessary to prevent duplicate ownership. Aesthetic source consolidation is not a prerequisite to delivery.

## 5. Required architecture

### 5.1 Separate assignment from final acceptance

Keep the low-level track solver usable by Journey. Its result certifies only the supplied track problem, which must itself be checked correctly. Give final route resolution a distinct result type or unmistakably separate API contract.

A successful final result contains accepted routes and no hard violations. Only this result may be consumed as successful final geometry by the three adopters. A failed result may carry diagnostic/debug candidates, but those must not be exposed as an accepted `routeByConnectorId` fallback. Partial assignments are not final geometry.

Document the exact status vocabulary in Stage 1. If existing internal names such as `unsatisfiable` are retained for compatibility, distinguish proven contradictory constraints from candidate, repair, or search-budget exhaustion in the reason/diagnostic. Do not claim that no geometric solution exists merely because a finite search did not find one.

### 5.2 Resolve a route set with complete context

The existing lifecycle candidate contract is shaped around one connector. The hardening path must support a candidate arrangement for an affected component plus immutable surrounding routes, or a complete route-set candidate. Calling the existing per-connector lifecycle repeatedly cannot establish global acceptance by itself.

Required context includes:

- Actual declared source and target points, sides, and endpoint-node identities, obtained independently of candidate route points.
- All final route sections, including fixed sections and unchanged external routes.
- Node obstacles and adapter-declared blocking headers, separators, container boundaries, or reserved lanes. Do not treat every container as a solid obstacle.
- Allowed routing resources, coordinate bounds, and layout-expansion ownership.
- Stable connector priority, sharing declarations, crossing treatment, and marker clearance requirements.
- Lock reasons, distinguishing an endpoint invariant from a previous heuristic's preferred lane.

Final validation covers the complete scene context even when only one component was searched. If a proposed change interacts with another component, expand the affected set and rebuild its constraints before accepting it. Do not ignore the unchanged portion of the diagram.

### 5.3 Model terminal and bend dependencies explicitly

Represent a terminal section's fixed transverse coordinate separately from its span endpoints. Link movable span endpoints to adjacent logical runs. Preserve logical run identity within a candidate/revision; assign a new candidate identity when topology changes. Array indexes are reconstruction metadata, not durable ownership keys across topology changes or point collapse.

For parallel sections closer than the allowed separation, legality may be restored by shortening or separating their spans. For example, an eastward departure and a west-side arrival at nearby Y-coordinates can require the departure turn to lie to the left of the arrival turn. This is a relationship between turn coordinates, not permission to move either port vertically.

Choose and document one representation for these dependencies in Stage 1: explicit coupled constraints, or deterministic candidate generation with rebuilt geometric claims and a complete acceptance check. The implementation must demonstrate that it can consider the changed spans; re-solving frozen spans with more iterations does not qualify.

The competition broad phase must be conservative with respect to required clearance. Distinct fixed coordinate ranges can still compete. The final assignment compatibility predicate must check actual selected coordinates and current spans under the same tolerance policy. Do not merely widen one broad-phase range while leaving the narrow check inconsistent.

### 5.4 Reconstruction must realize the attempted correction

Reconstruction preserves endpoint attachment and orthogonality, updates adjacent bends together, and produces a fresh physical-segment description for validation. If normalization removes a proposed repair or a later override restores an old coordinate, the attempt made no progress and must not be counted as a successful correction.

For Outcome's zero-width detour, choose a legal distinct turn position or a different candidate. Disabling point normalization to retain duplicate points is not a repair. Source and target port changes require an explicit adapter-owned candidate decision; the generic solver must not move them incidentally.

### 5.5 One effective solve–validate–repair coordinator

Extend/refactor `runRoutingLifecycle` and route final production calls through it, either directly or through one shared final-resolution facade. Preserve lower-level helpers only with clearly limited contracts. If a replacement entrypoint is technically preferable, retire or delegate the superseded lifecycle in the same stage and demonstrate equivalent ownership. Do not leave two competing definitions of final success.

The coordinator must:

1. Validate the initial complete candidate arrangement. Return it unchanged if it already passes all hard rules.
2. Identify the implicated sections, their dependencies, and relevant immutable obstacles/routes.
3. Build current claims and solve or enumerate legal alternatives, preserving ports and resource bounds.
4. Reconstruct, normalize, re-extract physical geometry, and validate globally.
5. On failure, use the violation context to change constraints, turn placement, or topology. Rebuild geometric observations when spans or topology change.
6. Request adapter-owned expansion only when needed; apply absolute accumulated requirements to a stable layout baseline and rebuild affected routing input.
7. Stop with accepted geometry or a bounded, explanatory failure.

The current lifecycle only appends repair observations to the same candidate segments. That is insufficient when reconstruction changes spans. Its repair interface and loop must permit a new geometry revision/problem, not just another observation list over stale segments.

Keep search-state, repair-attempt, candidate, and expansion budgets explicit. Preserve the current expansion ceilings: four for Outcome and Service, eight for Scenario; Journey retains its existing bounds and specialized search policy. Define the additional finite budgets and counting rules in Stage 1. Do not conflate bounded optimization with a validated result.

Detect repeated canonical states and duplicate ineffective repairs. Constraints that are properties of a candidate must not leak into another topology. Retain only still-valid constraints across revisions. Expansion state must grow monotonically in absolute terms rather than repeatedly adding the same displacement.

Candidate preference is deterministic: preserve a valid original arrangement; otherwise reject hard violations, prefer avoiding expansion and unrelated movement, then apply declared displacement/crossing/bend/length preferences and a stable tie-break. A `penalize` crossing policy must influence scoring, not silently become permission with no cost. Hard rules never become a weighted tradeoff.

### 5.6 Finalization and diagnostics

Route-changing view passes must execute before shared acceptance or trigger renewed acceptance. Labels remain downstream and use the final accepted routes. Decoration/label generation that does not change routes need not re-solve routing, but its existing independent clearance checks remain required.

Service and Scenario must not retain `includeEdgeInteractions: false` as their final routing acceptance behavior. Legitimate intentional sharing is expressed for the specific runs through policy, not by suppressing an entire class of checks. Preserve IA/UI exceptions through their existing paths; do not generalize an exception merely because routes have the same target.

Preserve existing view-specific diagnostic codes where accurate. Final errors should name all involved semantic connectors and carry useful run, obstacle/resource, and exhaustion context. Intermediate repaired violations belong in debug traces, not final warnings. Keep rejected geometry available to diagnostic tooling without having the CLI publish it as a successful preview.

## 6. Orchestrator execution protocol

### 6.1 Ownership and delegation

The orchestrator owns the contract, stage order, scope, integration, and completion decision. It must inspect evidence rather than treating an implementer's “done” message as acceptance.

Use bounded delegation when useful: baseline inventory, independent acceptance tests, or a review of one completed change. Give each assignment the relevant H-invariants, exact file ownership, proof cases, and required report. Avoid simultaneous edits to `routingCore` by multiple implementers. Do not migrate Service or Scenario in parallel with a still-failing Outcome proof.

An independent reviewer should examine final geometry and production integration without relying on the implementation's own status flag. Small reviewable changes are preferred; do not create separate user-owned tasks, merge, publish, or perform other external actions without the authorization applicable to the implementation session.

### 6.2 Stage ledger and handoff

At implementation start, create a concise status/evidence record in this directory. Keep this plan's intended contract separate from observed implementation status. For each stage record:

- State: not started, active, acceptance blocked, or accepted.
- Checkout/revision and exact commands/settings used for evidence.
- Changed files and current production callers.
- H-invariants satisfied, violated, or not yet assessed.
- Exact proof/test/artifact paths and any reviewed geometry differences.
- Newly exposed failures, classification, and remaining work.
- Reviewer conclusion and the next bounded assignment.

Every stage acceptance statement must point to evidence. “Tests green,” an updated golden, and an imported lifecycle function are insufficient on their own. Do not mark later stages accepted because a shared helper already exists.

Proceed autonomously through satisfied gates within the authorized scope. Routine stage progression does not require renewed permission. Surface unresolved policy conflicts or a material scope expansion with concrete evidence before continuing dependent work.

### 6.3 Dependency order

| Stage | Work | Depends on | Initial status |
| --- | --- | --- | --- |
| 0 | Baseline, proof inventory, and early risk assessment | None | Accepted |
| 1 | Executable acceptance contract and design decisions | 0 | Accepted |
| 2 | Shared constraint and assignment correctness | 1 | Accepted |
| 3 | Effective shared final-resolution lifecycle | 2 | Accepted |
| 4 | Outcome production proof and adoption | 3 | Accepted |
| 5 | Service Blueprint adoption | 4 | Accepted |
| 6 | Scenario Flow adoption | 5 | Accepted |
| 7 | Cross-renderer verification, artifact refresh, and closure | 4–6 | Accepted |

Journey regression checks begin in Stage 2 and repeat when lower solver behavior changes. IA/UI compatibility checks accompany shared geometry/validation changes, not only Stage 7.

### 6.4 Model and reasoning effort

Use **GPT-6 Astra at High** for the implementation/orchestrator task. If using one effort setting throughout the program, choose High. Planning at Extra High does not require implementation at the same effort; the detailed plan narrows the work but still leaves substantial constraint-design, integration, and regression judgment.

| Work | Recommended effort |
| --- | --- |
| Main orchestrator and production integration | High |
| Shared constraint and lifecycle design, Stages 1–3 | High initially; try Extra High on a bounded unresolved problem. |
| Difficult regression diagnosis or architectural review | Extra High when High is not resolving the problem. |
| Delegated documentation, evidence collection, and straightforward fixtures | Medium, with orchestrator review. |

Treat escalation as a targeted experiment: identify the unresolved question and the evidence that would resolve it, then assess whether the higher effort produces a useful improvement. Do not run the entire program at Extra High merely because it is available. These are task-specific recommendations, not benchmark results for this repository. They align with [OpenAI's reasoning-effort guidance](https://developers.openai.com/api/docs/guides/reasoning#reasoning-effort), checked on 2026-09-12, which recommends High for complex workflows and Extra High when its benefit justifies the additional latency and cost.

Reasoning effort never changes the acceptance standard. Medium-effort delegated work still needs review, and Extra High does not substitute for production integration evidence, independent geometry checks, visual acceptance, or any stage gate in this plan.

## 7. Detailed implementation stages

### Stage 0 — Establish the real baseline before estimating the repair

**Purpose:** Discover hidden Service/Scenario failures early and preserve the exact Outcome evidence before behavior changes.

Tasks:

- Read current workspace instructions, record the checkout and dirty files, and build the current source before CLI reproduction. Do not overwrite unrelated work.
- Reproduce Section 3 and capture settings, diagnostics, positioned geometry, and relevant stage geometry. Invalid baseline SVG/PNG may be captured through diagnostic tooling, explicitly marked rejected; do not bypass CLI acceptance to publish it as a successful preview.
- Establish the finite proof matrix in Section 8, including all three views of `sdd_for_sdd.sdd`.
- Run complete shared interaction validation and independent geometry checks on Service/Scenario baseline scenes even where production currently omits those checks. Record each hidden violation separately from currently emitted diagnostics.
- Audit current production call paths, post-solve route mutations, locks discarded at wrapper boundaries, policy overrides, and the unused lifecycle.
- Record node/port/canvas geometry and final routes for valid baseline cases to enable preservation comparisons.
- Classify each baseline failure using Section 9 and state the resulting implementation risk. Do not promise a schedule from the earlier test count.

**Deliverables:** Baseline matrix, failure inventory, source/settings fingerprints, call-path map, and a bounded risk assessment.

**Exit gate:** The exact failure is reproducible or its changed behavior is explained; all three adopter baselines are assessed with equivalent applicable checks; no golden has changed; no unexplained policy hierarchy conflict remains.

### Stage 1 — Freeze the acceptance contract and implementation decisions

**Purpose:** Make correctness executable before implementing the repair strategy.

Tasks:

- Record the final-resolution API, result semantics, route-set scope, geometry revision/identity scheme, dependency representation, lock meanings, obstacle/resource inputs, and finite budgets described in Section 5.
- Decide how the existing lifecycle will be extended and how wrappers will delegate. Identify the last route-changing pass in each adopter and the final acceptance boundary after it.
- Complete the bundle-policy audit. Implement any necessary typed bundle-policy foundation before consuming new semantic behavior; geometric hardening alone need not change the bundle.
- Add independent acceptance cases for the specific reported relations and a reduced geometry fixture with neutral IDs. Preserve exact production reproduction separately; do not trim its source to make it pass.
- Establish a test that a final-resolution success is followed by clean independent validation of the returned geometry. Establish a rejection test for an invalid unrepaired candidate, not just selection of a manually marked “valid” candidate.
- Define marker-leg and adapter blocking policies. Document how tolerances, permitted crossings, and intentional sharing agree between solver, validator, and oracle.

**Deliverables:** Brief design-decision record and executable failing acceptance cases. Keep expected failures isolated and clearly recorded until their implementation stages; do not normalize failures with snapshots or permanent skip/expected-failure annotations.

**Exit gate:** A reviewer can describe exactly what success certifies, what moves are allowed, where changed spans are rebuilt, how real production integration will be tested, and how the solve stops.

### Stage 2 — Correct shared constraint and assignment behavior

**Primary files:** `routingCore/contracts.ts`, `claims.ts`, `solver.ts`, `occupancy.ts`, and geometry helpers as required.

Tasks:

- Retain fixed sections as constraints and validation participants; distinguish a section that cannot shift from a section whose adjacent turn can change its span.
- Correct competition for clearance-close disjoint coordinate domains, including distinct locked coordinates. Preserve explicit intentional sharing.
- Preserve bounds, resource ownership, endpoint attachment, and lock reasons when translating adapter input into claims. Do not repair the filter by dropping all locks or marking endpoint sections freely movable.
- Implement the minimum shared representation needed to carry turn/span dependencies into Stage 3. Any relation that cannot be solved by a frozen-span assignment must be returned to candidate/repair coordination, not treated as global impossibility.
- Ensure a low-level successful assignment satisfies all supplied constraints. Prevent consumption of partial assignments on failure.
- Exercise Journey's direct solver path immediately; retain its directional ranges, reciprocal locks, and specialized search settings.

**Required regressions:** Nearby locked tracks at 1.5px and 14.5px; exactly 16px; tolerance boundaries; all sections fixed; mixed fixed/movable sections; multiple observations per physical run; incompatible locks; disjoint domains that are close versus safely separated; intentional shared tracks; bounded exhausted search; deterministic reordered input.

**Exit gate:** Shared assignment meets its limited contract and relevant Journey checks pass. The orchestrator explicitly reports that fixing detection alone does not repair Outcome or complete H2/H10. Newly exposed caller failures remain visible in the ledger.

### Stage 3 — Implement effective shared final resolution

**Primary files:** `routingCore/lifecycle.ts`, `reconstruction.ts`, `occupancy.ts`, `candidates.ts`, validation adapters, and focused tests.

Develop this stage as a vertical slice against the reduced defect and the captured exact Outcome scene. The captured scene supplies real node, port, and routing-resource constraints to the shared test harness. Do not build speculative candidate families for Service/Scenario or a general routing framework before the Outcome production gate in Stage 4.

Tasks:

- Implement the route-set context and one coordinator specified in Section 5. Prefer extending the existing subsystem over creating a parallel one.
- Generate terminal-aware turn alternatives or coupled assignments from geometry, with no view IDs, semantic names, or fixture coordinates in the core.
- Rebuild physical spans, observations, and affected components after reconstruction or candidate changes. Global validation must include surrounding routes and declared blockers.
- Handle both pre-solve contradictions and post-reconstruction violations through repair/candidate selection. The corrected locked-track detector must not terminate the entire lifecycle when shortening a span remains a legal alternative.
- Detect ineffective zero-width repairs, duplicate states, and oscillation. Keep a stable nominal baseline and candidate-specific constraints.
- Integrate bounded absolute expansion through the adapter callback, including failures first discovered by final validation.
- Add a valid-input preservation path and tests that unaffected components stay unchanged when safe.
- Make success unrepresentable through the final API without complete acceptance. The public renderer still reports explicit failure when all allowed attempts fail.

**Required proofs:** Reduced H–V–H terminal conflict; its transposed V–H–V equivalent; reversed directions; a repair that lengthens a neighbouring section into a new conflict; a zero-width detour; new interaction with a formerly separate component; multi-node blockers; candidate change after contradictory fixed spans; expansion; no expansion owner; exhausted repairs; repeated-state termination.

**Exit gate:** The reduced defect and captured exact Outcome geometry are repaired by the shared machinery and checked independently. Repaired geometry is stable on a second resolution. Lifecycle tests exercise changed geometry, real validation, and failure paths. This is infrastructure readiness, not production adoption; Stage 4 must still prove that the running renderer supplies the same complete contract.

### Stage 4 — Prove Outcome through the production path

**Primary files:** `outcomeOpportunityMapRouting.ts`, its staged caller, relevant tests, and only the shared changes exposed by this proof.

Tasks:

- Replace the final single adjustment plus diagnostic-only ending with the shared final-resolution path. Supply full endpoints, obstacles, resource bounds, and view policy.
- Preserve useful view-owned templates and preparation passes as candidate input. Remove or reconcile final coordinate ownership that discards an accepted assignment.
- Address the observed zero-width local reconstruction attempt through the shared reconstruction/candidate contract. Do not add another Outcome-only spacing engine.
- Solve the exact Section 3 case within its existing final node, port, and canvas arrangement. The diagnosis demonstrates capacity; unexplained node movement or expansion is a failed proof, not an acceptable shortcut.
- Prove the production call reaches shared validation and performs a repair for this case. Test an irreparable production-path fixture to ensure the renderer/CLI rejects output rather than consuming a fallback route map.
- Run the mandatory Outcome matrix, the three existing visual proofs, dense/shared-node cases, and endpoint/label acceptance. Preserve meaningful pre-routing, step-2, step-3, and final debug artifacts.
- Inspect SVG and SVG-derived PNG. Record why the selected turn arrangement satisfies the contract; exact diagnostic coordinates need not be reproduced.

**Exit gate:** Exact and neutral-ID proofs pass without weakened policy; both shared validation and independent oracle accept final geometry; labels/markers remain readable; unrelated routes are preserved or every necessary change is justified; runtime adoption and bounded rejection are demonstrated. Do not begin Service adoption before this gate.

### Stage 5 — Adopt Service Blueprint without suppressing interactions

**Primary files:** `serviceBlueprintRouting.ts`, its staged integration and focused/visual tests.

Tasks:

- Use the same final-resolution path after view-owned candidate preparation. Feed node-clear candidates, full endpoint sections, resource bounds, and all unchanged routes into acceptance.
- Remove `includeEndpointSegments: false` and disabled final edge interactions as blanket exclusions from the accepted problem. Express any justified sharing with specific policy instead.
- Ensure track adjustment cannot invalidate earlier node-clear candidate selection. A candidate selected in isolation must still pass route-set acceptance after assignments.
- Preserve operational lanes, semantic ordering, support/resource patterns, markers, and downstream label placement.
- Resolve Stage 0's in-scope hidden failures through shared mechanics. If a new defect requires wider work, apply Section 9 before broadening the stage.
- Demonstrate production repair and rejection behavior, inspect the designated SVG/PNG proofs, and compare valid baseline geometry.

**Exit gate:** Service's mandatory matrix and existing focused/visual proofs pass the same applicable hard interaction rules as Outcome. No temporary suppression or diagnostic filtering hides a failure. Outcome remains accepted.

### Stage 6 — Adopt Scenario Flow after semantic placement

**Primary files:** `scenarioFlowRouting.ts`, its staged integration and focused/visual tests.

Tasks:

- Keep semantic lane/band placement and Step/branch candidate construction view-owned. Integrate shared final resolution after the final topology preparation.
- Enable complete applicable interaction validation. Feed endpoint, obstacle, corridor, and reserved-lane constraints rather than selectively removing violations after validation.
- Coordinate geometric expansion through the existing owner with absolute state and the preserved eight-pass ceiling. Avoid nesting two independent expansion loops that multiply attempts or repeatedly add the same requirement.
- Preserve branch order, decision ports, parking routes, labels, and existing compact/detailed spacing behavior.
- Resolve the baseline inventory's in-scope failures; prove production repair and bounded rejection; inspect proof SVG/PNG before any related golden update.

**Exit gate:** Scenario's mandatory matrix, dense branches, parking/multi-obstacle cases, and spacing regressions pass full applicable acceptance. Outcome and Service remain accepted. All three adopters now have behavioral evidence for H10.

### Stage 7 — Verify compatibility and close with evidence

Tasks:

- Run Journey routing, branch/join, endpoint-order, expansion, stage-gate, and visual proofs. Preserve required continuity marks and intentional crossing treatment. Make only changes needed for corrected shared contracts; report a larger Journey need as a scope issue.
- Run IA/UI compatibility, including intentional trunks, container-origin routes, and current UI scope/topology proofs when shared geometry/validation changes reach them.
- Re-run the full finite proof matrix with explicit settings and compare two identical renders for stable scenes, diagnostics, SVG bytes, and derived PNG output where the existing deterministic harness supports it.
- Review every changed accepted diagram. Capture goldens only after structural and visual acceptance. Do not regenerate the entire corpus indiscriminately.
- Run build, focused suites, and the full repository suite. Verify parser/compiler/projection and legacy tests remain unchanged in behavior.
- Audit all production callers: no adopter can reach final rendering through an assignment-only success, bypass interaction checks, or change routes after final acceptance without revalidation.
- Update architecture documentation to name actual production integration and limits. Add an explicit dated correction/link to the earlier completion record without erasing its history. Remove stale success claims and unused superseded finalization paths within scope.
- Produce a final H1–H10 ledger, case matrix, changed-geometry report, test/visual evidence, and remaining unrelated issues with their disposition.

**Exit gate:** Section 11 is satisfied. An unrelated pre-existing failure may be documented separately, but any unresolved required routing invariant or required proof keeps this program incomplete. There is no “complete except the lifecycle” outcome.

## 8. Verification matrix and commands

### 8.1 Finite coverage requirements

> **Amendment (2026-09-18).** "Exact production input" originally named the live document
> `docs/sdd_app_planning/sdd_for_sdd.sdd`. That document is work-in-progress and its
> containing folder is expected to disappear, so tests and verification commands must not
> read it. Coverage now uses the frozen fixture
> `tests/fixtures/render/sdd_for_sdd_frozen.sdd`, a byte-identical copy taken on
> 2026-09-18 (sha256 `c43579920b85102b129067b88a022ec27397b829a1b59999acf2763590c242d8`).
>
> This resolves a prior authority conflict: the plan mandated the live document while the
> maintainer instructed that tests must not depend on it. An earlier decoupling instruction
> was never carried out because the conflict was not surfaced. The frozen fixture satisfies
> both: exact production geometry is still covered, and the gates are hermetic, so a red
> gate now means a code regression rather than document drift.
>
> Section 3.1 retains the original live-path command as a historical record of the reported
> defect. It is evidence, not an instruction to re-run.

| Coverage | Required cases/settings |
| --- | --- |
| Exact production input | The frozen fixture `tests/fixtures/render/sdd_for_sdd_frozen.sdd` in Outcome, Service, and Scenario; each with `compact` and `detailed`, crossed with `none`, `type`, `id`, and `type,id` decorators. |
| Existing accepted proofs | Outcome `multiple_outcomes`, `outcome_to_ia_trace`, `metric_event_instrumentation`; Service/Scenario fixtures already exercised by their focused and visual suites. |
| Decorator/measurement sensitivity | The full 2×4 settings matrix for `multiple_outcomes` and one representative existing Service and Scenario proof selected and named in Stage 0. Longer-label/decorator cases exercise measured geometry rather than assuming one shape. |
| Core adversarial geometry | Stage 2/3 cases, neutral IDs, reordered input, translations, transposed axes, alternate candidates, all-fixed conflicts, new span interactions, and bounded failures. |
| Production wiring | Repair and rejection through each of the three real staged renderers, plus the exact CLI smoke case. Synthetic coordinator tests alone do not qualify. |
| Journey | Existing dense peripheral, reciprocal, endpoint-order, branch/join, expansion, and continuity-mark proofs. |
| IA/UI | Existing intentional sharing and endpoint validation proofs; current UI scopes/container-origin cases affected by shared changes. |
| Compatibility | Existing legacy, parser/compiler/projection, render-detail, decorator, and full repository suites. |

Use the selected bundle's declared decorator modes. If the bundle has changed since this plan, record the mapping and extend coverage for new relevant modes. Do not couple validation profile to render detail in a new test helper. Record the resolved profile; use explicit `--profile simple` for deterministic CLI acceptance unless a particular case intentionally tests another profile.

The independent oracle must not delegate the property under test to the production validator. Preserve its separate interval/intersection calculations. Deterministic generated cases can broaden geometry coverage, but do not replace the exact production reproduction or visual review.

### 8.2 Commands

Run from the repository root with Node 22 and `TMPDIR=/tmp`. Use `source ~/.nvm/nvm.sh` only if the shell cannot find the tools. `pnpm sdd` uses `dist`, so rebuild before CLI evidence after source changes.

```bash
TMPDIR=/tmp pnpm run build
mkdir -p /tmp/sdd-routing-hardening
TMPDIR=/tmp pnpm sdd show "$PWD/tests/fixtures/render/sdd_for_sdd_frozen.sdd" \
  --view outcome_opportunity_map --profile simple --detail detailed \
  --decorators type,id --diagnostics json \
  --out /tmp/sdd-routing-hardening/outcome.detailed.type-id.svg
TMPDIR=/tmp pnpm sdd show "$PWD/tests/fixtures/render/sdd_for_sdd_frozen.sdd" \
  --view outcome_opportunity_map --profile simple --detail detailed \
  --decorators type,id --format png --diagnostics json \
  --out /tmp/sdd-routing-hardening/outcome.detailed.type-id.png
```

Use unique output names per view, detail, decorator mode, and baseline/candidate revision. Keep generated evidence outside tracked goldens until acceptance. Add equivalent Service/Scenario commands for the matrix; do not overwrite source-adjacent artifacts while diagnosing.

Existing focused entrypoints include:

```bash
TMPDIR=/tmp pnpm exec vitest run tests/routingCore.spec.ts
TMPDIR=/tmp pnpm exec vitest run tests/outcomeOpportunityMapRouting.spec.ts tests/stagedOutcomeOpportunityMap.spec.ts
TMPDIR=/tmp pnpm exec vitest run tests/stagedServiceBlueprint.spec.ts
TMPDIR=/tmp pnpm exec vitest run tests/scenarioFlowRouting.spec.ts tests/stagedSpacingRegression.spec.ts
TMPDIR=/tmp pnpm exec vitest run tests/journeyMapRouting.spec.ts tests/journeyMapBranchJoinRouting.spec.ts tests/journeyMapVisualAcceptance.spec.ts
TMPDIR=/tmp pnpm exec vitest run tests/stagedIaPlaceMap.spec.ts tests/stagedUiContracts.spec.ts
TMPDIR=/tmp pnpm exec vitest run tests/stagedVisualAcceptance.spec.ts
TMPDIR=/tmp pnpm test
```

Add new contract/integration test files to the stage commands and ledger. Run affected tests while iterating, broaden after integration, and avoid repeating the entire suite without a code change or unresolved concern. Tests that generate artifacts must use temporary output locations unless an accepted refresh is being performed.

## 9. Newly exposed failures and scope control

Complete validation is expected to expose some defects that older paths did not report. Do not call every new diagnostic a regression, and do not call an invalid baseline acceptable merely because it was previously silent.

| Classification | Evidence | Required response |
| --- | --- | --- |
| Existing defect revealed by stronger checking | Baseline geometry already violates the unchanged rule. | Record it; repair within the active stage when it belongs to this constraint/lifecycle family. Never suppress the check to preserve prior apparent success. |
| Regression introduced by the change | Baseline passes the same complete rule and candidate fails or visibly degrades. | Stop that adoption, isolate the causal change, and correct it before refreshing artifacts. |
| Legitimate intentional behavior | Bundle/architectural policy explicitly authorizes the exact sharing/crossing behavior. | Model the scoped permission and test both permitted and forbidden nearby cases. Do not infer permission from a golden. |
| Policy ambiguity or unrelated architectural defect | A coherent example shows a missing semantic rule or a need to change layout/topology outside the mandate. | Produce a reduced case, violated invariants, smallest additional dependency, and affected callers. Reassess scope before implementing the wider change. Keep dependent gates unaccepted. |

For mandatory proof cases, an explicit failure diagnostic is correct failure handling but does not satisfy the requirement to render them successfully. For intentionally impossible synthetic cases, that same bounded failure is the required outcome.

Time spent or test count must not silently reduce scope. Equally, discovery of another renderer issue is not authorization to redesign that renderer. Keep the ledger clear about what is complete, what is blocked, and what has been explicitly deferred outside this program.

## 10. Stop conditions

Stop the failing line of implementation and report evidence when:

- Final validation rejects the candidate and the next proposed change is speculative tuning without a changed constraint or candidate rationale.
- The same canonical geometry/violation state repeats without progress.
- A fix requires semantic identifiers, proof coordinates, global fan reversal, blanket exemptions, or weaker separation/clearance to pass.
- A proposed shared change causes an unexplained regression in a valid Journey/IA/UI or already accepted adopter proof.
- A repair needs a bundle-owned policy the bundle cannot express; extend that contract first.
- A required fix crosses into new macro-layout, route-template architecture, or label-system work beyond the stated scope.
- Goldens would need to be refreshed before hard invariants and visual appearance are accepted.
- Any success result contains invalid reconstructed geometry, partial assignments, or a route changed after acceptance.

Routine diagnosed defects within the current stage should be fixed without repeatedly seeking permission. These stop conditions prevent speculative or unauthorized scope expansion; they do not make every iteration an approval gate.

## 11. Completion checklist

- [x] The Section 3 command and the mandatory production/settings matrix render successfully under full applicable routing acceptance.
- [x] Shared detection covers fixed terminal sections and close disjoint coordinate ranges correctly.
- [x] Turn/span dependencies are represented and current geometry is rebuilt after each relevant change.
- [x] Repairs survive normalization and reconstruction; ineffective attempts cannot be reported as progress.
- [x] All three adopters use one shared final-resolution lifecycle with real production repair and rejection tests.
- [x] `resolved` at that boundary implies clean complete geometry under the declared policy.
- [x] No blanket endpoint or edge-interaction exclusions hide failures in those adopters.
- [x] Search/repair/expansion bounds, repeated-state behavior, and deterministic tie-breaking are documented and tested.
- [x] Existing valid geometry is preserved where possible; every necessary changed accepted case has a recorded justification.
- [x] Journey retains its direct-solver behavior, directional/reciprocal constraints, and continuity marks; IA/UI special contracts remain accepted.
- [x] Bundle-policy additions, if any, have typed validation, runtime consumption, and mutation tests.
- [x] Independent geometry and SVG/derived-PNG review preceded related golden refreshes.
- [x] Build, focused tests, full suite, and deterministic repeat renders have recorded results.
- [x] Production call paths and architecture documentation agree; the earlier completion discrepancy is explicitly corrected.
- [x] The final report lists H1–H10 results, evidence paths, actual affected callers, and any out-of-scope issues without presenting required unfinished work as complete.

Only after these gates are met may the orchestrator mark routing hardening complete. This plan itself records intent and diagnosis, not implementation success.
