# Prompt: Create a Gated Implementation Plan for the Staged Journey Map Renderer

Copy the prompt below into a new Codex thread rooted at this repository.

```text
Create a gated, quality-driven implementation plan for the staged `journey_map` renderer. Do not implement the renderer in this thread.

Goal

Produce a detailed, executable plan that a future implementation thread can follow gate by gate to deliver a visually excellent, deterministic staged journey-map renderer. Optimize for correctness, routing clarity, visual quality, and reviewability—not implementation speed.

Save the completed plan at:

`docs/journey_map/staged_journey_map_renderer_gated_implementation_plan.md`

This planning thread may write that plan document only. Do not write production code, tests, fixtures, snapshots, goldens, rendered corpus artifacts, or generated previews. Do not stage or commit changes unless the user separately asks.

Repository Context

- `journey_map` is the only remaining legacy-renderer-only diagram type.
- The bundle contract is intentionally small: `Stage`, `Step`, `CONTAINS`, `PRECEDES`, source ordering, and profile-controlled opportunity-reference badges.
- The existing journey projection and render model already derive most semantic structure.
- Connector routing has historically been the highest-risk and most revision-intensive part of every staged renderer.
- The future implementation should remain linear and proof-driven. Parallel implementation is not a goal.
- Existing staged renderer modules are exemplars and must not be behaviorally modified as part of journey-map implementation.

Primary Architecture Authority

Read this document completely before planning:

`docs/journey_map/staged_journey_map_renderer_architecture.md`

Treat it as the architecture authority for this plan, subordinate only to current `AGENTS.md` instructions and the active bundle contract. Do not silently weaken or omit its routing, diagnostics, proof-corpus, stop-condition, or visual-acceptance requirements.

Authority Hierarchy

Use these sources by role:

1. `AGENTS.md` — current repository constraints, quality policy, renderer boundaries, no-ELK rule, and stop conditions.
2. `bundle/v0.1/core/views.yaml` — machine-readable journey view scope and profile display policy.
3. `bundle/v0.1/core/contracts.yaml` — `CONTAINS` and `PRECEDES` endpoint/cycle/multi-parent behavior.
4. `src/projector/journeyMap.ts` — current projection and opportunity-reference annotation behavior.
5. `src/renderer/journeyMapRenderModel.ts` — current source ordering, first-parent behavior, root items, badges, and ordering edges.
6. `docs/toolchain/adding_staged_renderers.md` — responsibility boundaries, evidence requirements, and staged renderer authoring rules.
7. `docs/toolchain/architecture.md` — current pipeline and integration surfaces.
8. `docs/journey_map/staged_journey_map_renderer_architecture.md` — journey-specific architecture and acceptance contract.
9. Existing staged renderers and their routing documentation — implementation exemplars only.

Where older migration documentation discusses ELK, follow the current `AGENTS.md` and journey architecture instead: do not use or expand ELK, Graphviz, Mermaid, DOT, or another external layout engine for staged journey placement or routing.

Planning-Thread Instructions

1. Inspect the current repository state before drafting the plan. Verify that the architecture document's cited files, functions, tests, and capability wiring still exist and note any drift.
2. Extract a short list of cited non-negotiable invariants before designing gates.
3. Separate sources by role: normative contract, architectural guardrails, implementation exemplars, and visual evidence.
4. Inspect existing journey projection/render-model tests and the staged test/routing harnesses that a future implementation should reuse.
5. Inspect the current preview backend, view capability, CLI/helper, and rendered-corpus wiring so the integration gates name real files and tests.
6. Inspect existing routing implementations to identify exact reusable structures and exact view-specific behavior that must not be copied.
7. Do not assume the generic router is sufficient. The plan must require proof before choosing between generic routing and a dedicated journey routing phase.
8. Do not update the architecture document in this thread. If current code or contracts contradict it, record the mismatch and stop for direction when the difference materially changes the plan.
9. Produce the saved plan document and a concise final summary linking to it.

Sub-Agent Policy

Sub-agents are permitted when they materially improve planning quality, but they are optional.

If used:

- Use them for concrete, independent, bounded research tasks such as:
  - journey semantic/order/test inventory
  - routing-mechanics reuse inventory across IA, UI Contracts, Scenario Flow, Service Blueprint, and Outcome-Opportunity
  - preview/capability/CLI/corpus integration inventory
  - proof-fixture and visual-acceptance test inventory
- Prefer read-only investigation. Sub-agents must not edit production code, tests, fixtures, snapshots, goldens, or corpus artifacts.
- Do not delegate reading or interpreting applicable skill instructions or the primary architecture document; the main agent must read those itself.
- Ask each sub-agent to cite exact files, functions, tests, and risks rather than offering generic recommendations.
- Reconcile all findings in the main thread. Conflicting recommendations must be resolved against the authority hierarchy.
- Do not use sub-agents to parallelize future implementation gates. The plan should keep one implementation gate in progress at a time.

Non-Negotiable Plan Invariants

The saved plan must preserve at least these constraints:

- `bundle/v0.1/` governs machine behavior.
- Projection remains the semantic boundary.
- Preserve parser, compiler, validator, and projection behavior unless a gate explicitly proves a required bundle-contract change and stops for approval.
- Preserve existing journey first-parent and source-order semantics.
- Root Stages and root Steps remain in top-level author order.
- Steps inside a Stage remain in that Stage's `CONTAINS` edge-line order.
- `PRECEDES` is an explicit routed overlay and never becomes the placement authority.
- Every projected `PRECEDES` edge is rendered exactly once with stable identity.
- Cycles, backward edges, branches, joins, disconnected chains, cross-Stage edges, and duplicate same-endpoint edges are planned as valid or diagnosable topology—not dismissed as impossible.
- Keep the explicit staged path: `Projection -> RendererScene -> MeasuredScene -> pre-routing PositionedScene -> routed PositionedScene -> SVG -> PNG`.
- Final coordinates, final line breaks, route polylines, and target payloads stay out of `RendererScene`.
- SVG is first-class; PNG is derived from SVG.
- No ELK or other external layout/routing engine.
- Existing staged renderer behavior remains unchanged.
- Snapshot refresh is evidence capture only and occurs after acceptance, never to normalize defects.
- Human visual review is a blocking acceptance gate for routing quality.

Required Reuse Analysis

The plan must contain a reuse/replication table naming exact code paths, responsibilities to leverage, and behavior not to copy. At minimum assess:

- `src/renderer/staged/iaPlaceMap.ts`
  - leverage: scene/pipeline skeleton, card/cluster construction, source-ordered container/leaf structure, SVG/PNG wrappers
  - reject: forward-navigation follower grouping, navigation/containment merging, IA-specific local route patterns
- `src/renderer/staged/uiContracts.ts`
  - leverage: titled scope containers, leaf/container endpoint mapping, cross-container edge ownership patterns
  - reject: ELK layouts, UI contract gutters/labels, transition-priority semantics
- `src/renderer/staged/scenarioFlowMiddleLayer.ts` and `scenarioFlowRouting.ts`
  - leverage: topology classification, cycle/disconnected diagnostics, endpoint buckets, exterior approach, occupancy, late ordering, bundle displacement, global expansion, debug stages
  - reject: PRECEDES-driven placement, chronology bands, decision tracks, mirrored lanes, branch-label semantics
- `src/renderer/staged/serviceBlueprintRouting.ts`
  - leverage: proven routing control-flow seams, gutter model, bundle resolution, locked segments, bounded expansion, final reconstruction
  - reject: service lanes, chronology bands, support/resource channels, separators, parking semantics
- `src/renderer/staged/outcomeOpportunityMapRouting.ts`
  - leverage: orthogonal template enforcement, occupancy-driven shared-gap separation, final-route validation
  - reject: fixed semantic columns, outcome bands, connector/aggregate labels, domain route patterns
- shared staged modules such as `sceneBuilders.ts`, `routing.ts`, `macroLayout.ts`, `diagnostics.ts`, `svgBackend.ts`, and `connectorLabelPlacement.ts`

The plan must keep existing renderer modules read-only. If a missing generic mechanism belongs in shared infrastructure, plan an additive, behavior-preserving shared change with regression tests; do not combine journey work with migrating established renderers onto that helper.

Required Plan Structure

The saved plan must include all of the following sections.

1. Status, audience, purpose, and completion definition.
2. Authority hierarchy and exact source references.
3. Current-state inventory:
   - bundle and projection readiness
   - journey render-model readiness and narrow gaps
   - current staged preview/capability status
   - relevant shared infrastructure
   - existing tests and proof artifacts
4. Non-negotiable invariants extracted from cited sources.
5. Explicit assumptions, open decisions, and decisions already fixed by architecture.
6. Production write scope, test/documentation write scope, and forbidden write scope.
7. Reuse/replication matrix for existing renderers and shared infrastructure.
8. Proof-corpus design and visual acceptance rubric.
9. Linear gated implementation sequence.
10. Verification command matrix, using `TMPDIR=/tmp` for Node/Vitest commands.
11. Snapshot/golden/corpus policy.
12. Diagnostics and degraded-output policy.
13. Stop conditions and escalation conditions.
14. Risks, likely revision hotspots, and how the gates contain them.
15. Final closeout evidence and expected handoff format.

Gate Design Requirements

The plan must be linear. At most one gate may be in progress during implementation. Later gates may depend only on accepted earlier gates.

For every gate include:

- objective
- rationale and architecture references
- prerequisites
- exact expected files or file families in scope
- production changes expected
- tests/fixtures/docs expected
- actions in implementation order
- required renderer-stage or debug artifacts
- automated acceptance assertions
- human visual-review checklist where applicable
- explicit pass/fail gate
- stop conditions
- verification commands
- expected commit boundary or checkpoint
- residual risks handed to the next gate

Do not make a gate "complete" merely because tests are green. Where visual output exists, the gate passes only when both geometric assertions and human visual review pass.

Required Gate Coverage

The exact number and names may be refined after inspection, but the plan must cover these risks in a sequence at least as disciplined as the following:

Gate 0 — Authority, drift, and baseline inventory

- Confirm the architecture and current code agree.
- Record the bundle files, projection entrypoint, current capability status, and existing tests.
- Record protected existing-renderer files.
- No production implementation.

Gate 1 — Proof corpus and acceptance contract

- Specify one primary multi-Stage proof case and smaller focused fixtures.
- Cover multiple Stages, cross-Stage edges, long labels, empty and single-Step Stages, root Steps, profile differences, branch/join, backward edge, cycle/self-loop, source-order contradiction, multiply-contained Step, duplicate edge identity, and compressed gutters.
- Define hard geometry assertions and soft human-review criteria before routing code.
- Do not create broad corpus artifacts yet.

Gate 2 — Typed journey render inputs

- Plan stable typed badge data and stable `PRECEDES` edge identity/order.
- Preserve legacy journey emitter behavior.
- Prove bundle-dependent behavior rather than hidden defaults.

Gate 3 — RendererScene construction without semantic routing

- Plan root ordering, Stage clusters, Step cards, uncontained root Steps, typed metadata, ports, classes, and empty Stage behavior.
- Snapshot the scene only after its semantic structure is accepted.
- Keep existing renderers unchanged.

Gate 4 — Measurement and pre-routing placement

- Plan title/badge measurement, wrapping, width-band/overflow policy, Stage bounds, root alignment, and baseline routing gutters.
- Require visual review of the no-edge structure before adding routing complexity.

Gate 5 — Basic explicit PRECEDES routing

- Adjacent same-Stage and simple adjacent cross-Stage routes.
- Exterior endpoint approaches, legal terminal legs, orthogonality, and exactly-once edge coverage.
- Provide pre-routing and route-template debug artifacts.

Gate 6 — Route archetypes and boundary ownership

- Non-adjacent same-Stage, long cross-Stage, root-Step, branch, join, backward, cycle, and self-loop routes.
- Lowest-common-container ownership and Stage-boundary gates.
- No unrelated Stage traversal.

Gate 7 — Occupancy, endpoint ordering, and gutter expansion

- Node-side buckets, provisional routes, occupancy extraction, bundle/segment displacement, late endpoint ordering, fixed separation, bounded Stage/root expansion, rerouting, and final-route reconstruction.
- Require compressed/dense proof cases.
- Occupancy must drive geometry; it cannot be debug-only decoration.

Gate 8 — Diagnostics, profiles, and final visual acceptance

- Simple/permissive/strict badge behavior.
- Errors, warnings, and information diagnostics.
- Full hard-geometry and human visual review of every proof archetype.
- Report satisfied and violated invariants explicitly.

Gate 9 — SVG/PNG and public preview integration

- SVG-first PNG path.
- Preview backend registration, view capability/default selection, CLI/helper tests, and normal staged diagnostics.
- Preserve selectable legacy support until a separate cutover task.

Gate 10 — Goldens, corpus promotion, regression, and closeout

- Refresh snapshots and SVG/corpus artifacts only after Gates 0-9 are accepted.
- Run focused routing suites, existing-renderer regression suites when shared files were touched, full tests, build, and rendered-example generation as appropriate.
- Update current documentation that must reflect the new staged status; leave historical Done documents historical.

The planning thread may split a high-risk routing gate into smaller sequential gates if that improves proof quality. It must not collapse scene, routing, visual acceptance, and golden capture into one broad implementation gate.

Routing Quality Requirements For The Plan

The plan must make these hard assertions executable:

- every segment of an orthogonal route is horizontal or vertical
- no route crosses a non-endpoint Step box
- no route enters source or target interiors
- no route crosses a Stage header or badge block
- no cross-Stage route traverses an unrelated Stage interior
- arrow-ended routes preserve readable terminal legs when geometry allows
- competing same-orientation overlapping spans are separated by at least the established 16px baseline
- crowded endpoint offsets are separated and ordered against adjacent stems
- every projected `PRECEDES` edge has one stable route
- Stage and Step placement remains source-ordered

The plan must also require human review for:

- clear left-to-right reading
- direct canonical tracks for forward flow
- legible branch separation and join convergence
- peripheral treatment of backward and cyclic edges
- clear edge identity at crossings and crowded endpoints
- intentional Stage chrome, whitespace, and alignment
- readable long labels and badges at normal preview size
- consistent port and Stage-boundary-gate usage

Routing should follow a lexicographic quality order: semantic correctness and obstacle avoidance first; endpoint clarity and segment separation next; crossings, direction, boundary crossings, bends, length, balance, and symmetry afterward. A shorter route may not win by introducing a more severe readability defect.

Snapshot And Golden Policy

- Do not plan snapshot refresh before the corresponding gate's semantic, geometric, and visual invariants pass.
- Stage snapshots should include `RendererScene`, `MeasuredScene`, pre-routing `PositionedScene`, route-template/step-2, occupancy/step-3, final `PositionedScene`, final SVG, and intentional diagnostics where routing complexity warrants them.
- Debug stages must show meaningful progression. A nominal occupancy stage that does not affect final geometry is not acceptable evidence.
- Goldens must not be used to normalize a visually poor result.
- Broad rendered-corpus regeneration comes after the focused proof corpus is accepted.

Stop Conditions

The plan must direct implementation to stop and report if:

- desired behavior requires unapproved parser, compiler, validator, or projection changes
- a machine-readable rule belongs in the bundle but cannot be expressed there
- source order must be changed to make routing appear clean
- routing starts depending on raw `.sdd` text, CSS classes, SVG parsing, or proof-specific coordinates
- an external layout engine appears necessary
- occupancy does not influence final tracks
- labels or Stage chrome merely hide merged/intersecting routes
- accepted proof cases retain diagonal orthogonal routes, node intrusion, Stage-header crossing, unrelated-Stage traversal, collapsed tracks, or silent edge omission
- existing staged renderer behavior would need modification
- snapshots would need updating to conceal a failed acceptance invariant
- the authority hierarchy is unclear or current code contradicts a non-negotiable architecture decision

Plan Quality Bar

The plan must be specific enough that an implementation agent can execute each gate without rediscovering architecture or guessing acceptance. Name exact files, functions, test suites, artifacts, and likely commands after inspecting the current repository.

Do not overpromise a one-pass router. Explicitly identify routing as the primary revision hotspot and structure gates so each route family is rendered, geometrically tested, visually inspected, and accepted before broader routing generalization.

Do not optimize for minimal gate count or speed. Prefer narrow, reviewable, sequential gates with strong stop conditions.

Required Verification Of The Plan Document

Before finishing this planning thread:

- verify every local Markdown link in the saved plan resolves
- run a whitespace/diff check on the plan document
- confirm no production/test/fixture/snapshot/golden/corpus files were changed
- report any unrelated pre-existing workspace changes without modifying them

Final Response Expectations

- Link to `docs/journey_map/staged_journey_map_renderer_gated_implementation_plan.md`.
- Summarize the gate structure and the principal routing-risk controls.
- State that no implementation code or artifacts were changed.
- Report link and whitespace verification.
- Call out unresolved decisions or architecture mismatches that the implementation thread must address.
```
