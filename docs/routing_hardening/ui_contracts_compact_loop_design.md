# UI Contracts: compact loops and bounded layout negotiation

2026-10-17. **Production architecture, implemented in the working tree.** Based on the accepted focused comparison at `7b49a59`. The [implementation record](ui_contracts_compact_loop_implementation_status.md) distinguishes verified production results from this original design contract. This document does not authorize another prototype or a fork/merge redesign.

## 1. Contract and evidence

The production change is one coordinated operation: construct complete connectors, allocate their attachments, negotiate space with layout, and accept an entire positioned scene. Adding a special self-loop drawing to the existing sequence of repair passes would leave the underlying failure mechanism intact.

Sources have distinct roles:

| Role | Source | Consequence |
| --- | --- | --- |
| Machine authority | [`bundle/v0.2/core/views.yaml`](../../bundle/v0.2/core/views.yaml), `ui_contracts.conventions.renderer_defaults.ui_contracts_presentation` | Add and consume the UI routing policy here before enabling the new behavior. The existing IA policy is a reusable precedent, not implicit UI policy. |
| Architectural guardrails | [`AGENTS.md`](../../AGENTS.md) | Preserve projection semantics, the staged pipeline, bundle authority, deterministic output, and LEGACY behavior. Shared geometry belongs in renderer infrastructure. |
| Accepted visual behavior | [Focused comparison](../../src/renderer/staged/routing-prototype/FOCUSED-COMPARISON.md) and [compact IA reference](../ia_place_map_hardening/manual_review_2_evidence/self-loop.compact.svg) | Compact, same-edge, negative traversal; full external label; preserve the working pair. |
| Scope correction | [Sizing and scope assessment](ui_contracts_routing_scope_correction.md) | No synthetic rectangular bars. Real port demand may justify minimum card growth; the prototype's sizing formulas do not. |
| Proof input | [`aeb_help_center_de_astra.sdd`](../../aeb_help_center_de_astra.sdd), scope `P-360005333058`, states `VS-001` and `VS-002` | Whole view has forward, return, and self-loop transitions. DG-002 selects only the working forward/return pair. |

Non-negotiable acceptance invariants:

1. Every selected relationship retains its intended representation, endpoints, full label and markers. No dropped or duplicated transitions can make a trial pass.
2. The self-loop uses two distinct ports on the same edge. With negative x traversal, departure is right of arrival. Pitch and outward depth come from shared geometry helpers, independently of label dimensions. The current default theme yields 23 and 17 units respectively.
3. Bottom wins an otherwise equal comparison. A valid top placement that avoids enlargement wins over an otherwise equivalent bottom placement needing enlargement. Invalid candidates never enter the comparison.
4. The accepted proof retains the measured cards and working pair, including their labels, up to whole-region translation. Container growth creates room around them; it does not stretch the loop or quietly reroute that pair.
5. All space has an owner. Extra room must participate in production measurement/layout and move affected later content. Enlarging an SVG viewport is insufficient.
6. A successful result passes coverage, attachment, route, label, marker, and containment checks on the exact scene serialized. Failure is an explicit result, not an invalid successful artifact.
7. Search is deterministic and bounded across alternatives and retries. Exhausting it means no accepted placement was found within the permitted search, not that no solution exists.

The focused comparison satisfies the local geometry checks: south passes, north fails label collision/association with the retained return, and south requests 80 units below the captured owner. **80 is evidence for that captured geometry, not a renderer constant.** Full-sheet reflow and publication acceptance remain unproven. The horizontal isolated-components packing was ruled out in the diagnosis and needs no special-case fix.

## 2. Replace the conflicting responsibilities

The current implementation has four concrete problems:

- [`withUpperReturn`](../../src/renderer/staged/uiContractsTransitions.ts) replaces a return relationship with five independently routed edges through frame ports. Different returns can share their vertical legs. A self-loop consequently travels around the sequence instead of its own card.
- [`buildEndpoint`](../../src/renderer/staged/uiContractsRouting.ts) infers a port side from the route being checked. A candidate cannot independently prove its own attachment contract this way.
- [`runStagedRendererPipeline`](../../src/renderer/staged/pipeline.ts) routes UI Contracts, repairs routes again, and then repairs labels. These operations do not negotiate layout together, and later operations can invalidate earlier decisions.
- [`validateUiContractsRoutes`](../../src/renderer/staged/uiContractsRouting.ts) permits final-segment overlap merely because two edges end at the same item. That permission is absent from the routing lifecycle and is broader than an explicitly represented shared segment.

The existing SVG/PNG entrypoints in [`uiContracts.ts`](../../src/renderer/staged/uiContracts.ts) remain the public interface. Inside them, a dedicated asynchronous `runUiContractsRendererPipeline` owns preparation, measurement, layout, allocation, routing, label placement, retries, and acceptance. Its result contains one coherent renderer/measured/positioned revision. SVG consumes that revision; PNG rasterizes its SVG.

The implementation reuses shared geometry, allocation, label, and audit functions. It does not copy the entire IA coordinator or create a general plugin framework. These dependencies are all in-process. The UI module owns presentation-specific mapping; shared infrastructure owns geometric calculations and bounded search machinery.

The enabled path bypasses the current UI sequence of post-routing repair passes. No repair runs after acceptance. The compatibility path remains available to bundles without the new policy; this is capability-based, not a hardcoded bundle-version test.

## 3. Put the policy through the bundle

Add this proposed block beneath `ui_contracts_presentation` in `bundle/v0.2/core/views.yaml`:

```yaml
routing:
  scope: within_transition_region
  export_clearance: readable_gap
  capacity:
    owner: padding_and_adjacency_gaps
    node: port_minimum
  self_loop:
    shape: compact_same_side
    traversal: { axis: x, direction: negative }
    side_trials:
      - { side: south, pair_placement: before_other_arrivals }
      - { side: north, pair_placement: nearest_feasible }
    label: external
    selection: [crossings, bends, enlargement, side_order, length]
```

The names above are proposed schema additions, not existing fields. `scope` governs transition routing; it does not force unrelated composition/contract connectors into transition containers. The supported capacity alternatives are `owner: fixed | padding_and_adjacency_gaps` and `node: fixed | port_minimum`. `node: port_minimum` permits only growth justified by attachment capacity, not by external label width. Selection is lexicographic after hard acceptance. `side_order` reads the list order; there is no hidden south-side preference in TypeScript.

Implementation path:

1. Extend [`UiContractsPresentationConfig`](../../src/bundle/types.ts). Extract the existing IA traversal/side-trial shape into a shared type without changing IA defaults or behavior.
2. Extend [`uiContractsPresentationProblems` / `resolveUiContractsPresentation`](../../src/bundle/uiContractsPresentation.ts) and loaded-bundle validation in [`validateLoadedBundle.ts`](../../src/bundle/validateLoadedBundle.ts). Reject unsupported modes, non-tangent sides, duplicate sides, missing ranking fields, and malformed values. Absence of the entire block selects compatibility behavior; a malformed present block is an error.
3. Carry the resolved policy through [`buildUiContractsPresentationModel`](../../src/renderer/uiContractsPresentationModel.ts) into renderer metadata. Preserve it through measurement, positioning, and metadata cloning. Do not change projection or infer the policy from view IDs in the solver.
4. The dedicated pipeline consumes that metadata. The existing shared helpers consume the declared direction, trial order, and pair-placement policy.

Coverage and final acceptance are unconditional correctness obligations, not configurable escape hatches. Search limits, geometric tolerances, font measurements, and theme-derived clearance remain shared implementation machinery. The bundle expresses presentation choices and permitted capacity changes, not a second routing algorithm.

Bundle-dependence tests must reverse trial order in an equal-fit case, change traversal direction, and disable node growth in an exhausted-port case. Each must change runtime behavior through the loaded bundle. v0.1 bundle files and LEGACY renderers remain unchanged.

## 4. Represent intent before geometry

Keep a renderer-owned inventory with stable occurrence IDs, source order, source/target occurrence IDs, owner IDs, prepared label text, expected markers, and relationship provenance. Persist it beyond scene construction. The existing `relationshipSegments` map currently checks presence and then disappears; a key existing is not proof that a valid path survives routing.

For ordinary forward, return, and self-loop transitions, one relationship produces one complete `SceneEdge`. A return rail is part of that connector's positioned polyline, not five independent scene edges. Return classification still uses graph order; it does not depend on final coordinates. Adapt the existing general return construction to generate one complete route with the same intermediate geometry. DG-002 verifies preservation; runtime must not read its captured SVG or embed fixture coordinates.

The inventory distinguishes an ordinary path from an existing junction path. Existing fork/merge and containment presentations retain their current topology and appearance. Their builders declare ordered segment references and junction identities for each represented relationship, plus which physical segments are shared. A shared segment is painted once and referenced by each relationship using it. No invented bar primitive, blanket same-target exemption, or parsing of `:return:`/`:lead` ID strings is allowed.

The adapter resolves each node attachment from the positioned node, declared side, allocated offset, and marker clearance **before** creating route candidates. Junction attachments are independently bound to declared junction identities and directions, with zero terminal clearance only where the existing unmarked junction permits it. Routes are checked against these bindings; bindings are never reconstructed from a candidate's first/last segment.

Existing builders need explicit provenance where they emit multi-segment paths, including contract fanout leads. That is inventory work, not permission to change their visual treatment. If an existing presentation fails the consolidated contract, expose the specific mismatch and resolve it against its actual builder before enabling the new production path.

Coordinates, resolved port offsets, line breaks, candidate scores, and retry history stay out of `RendererScene` intent metadata. Allocated attachments and solver evidence belong to measured/positioned revisions.

## 5. Construct and assess a compact loop

For each permitted side, use `allocateOrderedPortPair`, `readablePortPitch`, `readableRoutingClearance`, and `buildPortCorridorSeed` from [`routingCore`](../../src/renderer/staged/routingCore). Reserve all already allocated endpoints on that side, including support connectors. Allocate both loop endpoints together; their spacing does not derive from the label. Multiple loops also reserve one another's ports in stable occurrence order.

The compact shape is a hard constraint: two outward terminal legs and a local return rail, with the declared same-side traversal and shared pitch/depth. Generic route repair must not turn it into a wide enclosing route or reverse its direction. Add a shared fixed-route constraint for the loop and any retained pair during that trial: their segments still occupy space and participate in every check, but candidate generation and occupancy assignment cannot move them. Port changes or another loop side create a new trial. Audit the shape again independently after search; this catches accidental constraint loss during reconstruction.

Place the fully measured label outside that rail using shared connector-label placement and association checks. Its box may be wider than the loop. Search local external anchors at the existing shared label distance; do not expand the port pair, stretch the loop to frame the text, omit the label, or move it arbitrarily far away. Check it against all other labels, route segments, headers, nodes, and painted marker footprints.

First evaluate both permitted sides against the same current geometry with the existing valid pair retained. The proof must reproduce the accepted result. In general scenes, any permitted change to another route is a separate complete candidate and must pass the same audit; a retained route is not silently mutated while assessing a loop.

Compare only accepted complete candidates using the bundle ranking. `enlargement` is the sum of positive changes in unique owned capacity resources relative to the original baseline, counted once per resource. Do not count a child's growth again as ancestor growth. Length and bend/crossing counts cover the complete connector set. Stable occurrence IDs break any remaining ties. This selects the best accepted candidate actually explored, not a claimed global optimum.

## 6. Space requirements and ownership

Capacity requests identify a physical resource and an absolute minimum. They are evidence from a particular measured candidate, not instructions to add arbitrary padding until something passes.

```ts
type CapacityResource =
  | { kind: "padding"; containerId: string; side: PortSide }
  | { kind: "gap"; containerId: string; beforeId: string; afterId: string }
  | { kind: "node_extent"; nodeId: string; axis: "x" | "y" };

interface CapacityRequirement {
  resource: CapacityResource;
  minimumExtent: number; // absolute lower bound, in renderer units
  reason: "route_clearance" | "label_envelope" | "port_capacity";
  connectorIds: readonly string[];
}
```

These types are internal renderer data. Resource IDs come from the scene tree and declared routing owners, never from a nearest-box guess.

For the proof, the transition-region container owns the loop and its external label. Declare that owner in the inventory and `ownerContainerId`, and keep the region present even when there is only a self-loop. Routing and label audits use this declared owner, not the current label code's inferred deepest common ancestor. A south deficit enlarges that region's bottom padding. The containing scope consequently moves its following contracts down and grows; following scopes move through ordinary root layout. If the scope participates in a packed row, the row height and subsequent rows are recomputed. Header bands and unrelated packed sections remain real obstacles in the final scene.

An interior corridor belongs to the actual adjacent-child gap in their common layout owner. Use `LayoutIntent.gapAfter` only when that owner really uses linear adjacency. A packed row boundary is not automatically a `gapAfter` resource. If no current layout mechanism can realize a request, report `unsupported_capacity_owner` for that branch instead of moving global coordinates or inventing a resource.

For an external label, derive the requirement from the union of the loop, label, painted marker bounds, and readable export clearance relative to the actual owner bounds. Adding bottom padding cannot fix a collision with another route that moves with the same content. Such a failure needs another side/anchor/route candidate; it is not evidence for bottom growth. Likewise, a root viewport increase does not create space inside a transition owner.

Merge requirements for the **same candidate** as follows:

- First account for concurrent tracks/labels sharing a corridor using their spans and the shared capacity helpers. Competing occupants may require distinct lanes; taking the maximum of their individual widths alone can underallocate.
- Convert the resulting deficit to an absolute resource target: current resource extent plus the measured deficit, rounded upward to renderer precision.
- Merge repeated bounds on one resource with `max`, not addition. Independent resources retain separate entries. Never merge requests from mutually exclusive top and bottom trials.
- Apply a target only if permitted by loaded policy and supported by that resource. A request that changes no realized geometry is no progress.

For node-side capacity, the minimum is defined for a declared attachment ordering and reservation policy. Extend the shared port allocator to return a required extent or a reason that this ordering cannot be satisfied. It must consider occupied intervals, corner/marker clearance, and the contiguous ordered pair, not only the number of free slots. Growing the right end cannot create room before an arrival pinned at the left; that must trigger another permitted allocation or a specific failure. There is no claim of a minimum over every possible ordering.

For the initial supported case, existing reservations are fixed local offsets within one trial. Represent a requested group as fixed relative offsets from a variable start; the loop pair has offsets `0` and `pitch`. Subtract each relative offset from every reserved port's exclusion interval, merge those forbidden start intervals, and find the earliest admissible start after the corner inset. The required side length is that start plus the group span and the far inset, bounded below by the current length. Apply ordering limits such as `before_other_arrivals` before returning a demand: if its fixed upper bound excludes every start, increasing length cannot satisfy this trial. This is a finite interval calculation, not repeated one-pixel growth. After real remeasurement, rebind all reservations and rerun allocation; requirements are conditional on the declared ordering, not promises that unrelated geometry stayed fixed.

External label dimensions never enter node-port pitch. A tall label in another region cannot increase this card's port minimum.

## 7. Rebuild through real measurement and layout

Keep one immutable prepared presentation model and its loaded policy/settings. Each branch holds its own capacity ledger and attachment choices. Rebuild from that input; do not mutate the previous `PositionedScene` or accumulate coordinate translations.

Container-only changes can eventually reuse measured text, but the first production implementation should rebuild the scene and measure it again for correctness. There is a concrete reason: UI scene builders perform preliminary measurement to derive gaps, anchors, and port offsets. Changing only a final measured rectangle would leave those earlier decisions stale.

Use a shared measurement input such as `minimumNodeExtents: ReadonlyMap<OccurrenceId, {width?, height?}>`. Pass the same requirements to the builder's preliminary measurements, the fanout builder's measurements, and final `measureRendererScene`. This is renderer input, not authored SDD data. Apply capacity lower bounds to newly built container padding/gaps before final measurement; retain the greater of the fresh natural value and the ledger requirement.

For shared nodes, extend [`measureSharedNode`](../../src/renderer/staged/sharedNode.ts):

- Resolve width from the theme width and requested minimum **before** measuring decorators, title, and attribute content.
- Wrap text at that resolved width, then resolve height from natural content, theme minimum, and the requested minimum. Preserve the original measured height as a floor when increasing width within a retry branch so width growth does not introduce unrelated vertical shrinkage.
- Produce consistent body/background bounds, content coordinates, ports, and shared-size-group measurements. Recompute any width-dependent groups before final positioning.

The existing `reflowMeasuredSharedNode` only adjusts height-related layout; it is not a width-remeasurement implementation. Mutating a theme globally, editing `PositionedNode.width`, or repainting old text in a larger hand-drawn card is not permitted.

Then call the ordinary asynchronous macro-layout path, beginning before routing. Resolve attachments again, rebuild all route seeds, place labels, and audit. This naturally handles nested scopes, later sections, and packed rows. For a pure bottom-padding proof revision, assert that the two cards and working pair retain their local geometry. If the rebuild changes that geometry, the proof is not accepted merely because collisions disappeared.

## 8. Bounded search, retries, and failure

Use an asynchronous outer coordinator. The shared `runRoutingLifecycle` expansion callback is synchronous and cannot safely own asynchronous scene rebuilding. Call it without an inner layout-expansion callback; the outer coordinator owns all capacity changes.

Maintain one aggregate budget for the render, using existing shared candidate/repair limits and expansion policy as defaults (currently 4096 candidates, 128 repairs, four expansions). Reuse `RoutingQualityBudget` and `withRoutingQualityBudgetAllowance` for synchronous route search; the outer coordinator owns the expansion counter and deducts other proposal work. Enumerating attachment/side alternatives and label candidates must also consume bounded work, rather than restarting hidden per-attempt searches. An already valid seed can be audited with no search allowance. Never call the lifecycle with zero candidate allowance: it currently clamps that value to one.

The work queue contains complete assignments, not unrelated per-edge successes. Start with the baseline and permitted side alternatives. For several loops, generate side/allocation combinations lazily in stable occurrence order; do not build an unbounded Cartesian product. Reserve a seed assessment for each available side of the focused loop before allowing one side to consume recovery work. Schedule equal-depth branches in round-robin order and reserve remaining headroom before nested search. All consumed work, including rejected branches, stays charged globally.

```text
prepare immutable model, policy, baseline measurements, shared budget
queue permitted complete trial assignments
bestAccepted = none

while a trial remains and its required work is permitted:
    rebuild scene from prepared input + that trial's capacity ledger
    allocate attachments from the rebuilt geometry
    construct complete connectors; place all required labels
    audit the complete scene
    if accepted:
        retain the entire revision if its policy cost is better
        continue any permitted comparison work
    otherwise:
        record violations for this trial
        enqueue untried permitted placement/route alternatives
        derive only capacity requirements supported by those violations
        if requirements are realizable, progressive, and budget permits:
            enqueue rebuilt trial with merged absolute requirements

return bestAccepted if present; otherwise return a structured failure
```

Before enqueueing, use a canonical trial key containing loaded policy, attachment choices, and sorted capacity targets. After rebuild, also detect repeated realized geometry, including bounds, attachment bindings, routes, measured/positioned labels, and marker data. This catches padding requests that do not affect the relevant space. Do not use mutable callback identities or an accumulated diagnostics list as geometry identity.

A branch terminates when it has no untried placement or realizable capacity request, repeats geometry, violates an unrepairable contract, or exhausts its allowance. Other branches may still succeed. Every reflow beyond baseline consumes the shared expansion allowance, including reflows in rejected branches. A previously accepted revision remains available even if later exploration exhausts the budget. Return it as valid, with evidence that optimization stopped; do not replace it with the last failed attempt.

Internally return a discriminated result:

```ts
type UiRoutingOutcome =
  | { status: "accepted"; revision: AcceptedUiRevision; evidence: SearchEvidence }
  | { status: "failed"; reason: FailureReason;
      violations: readonly Finding[]; unresolved: readonly CapacityRequirement[];
      evidence: SearchEvidence; diagnosticRevision?: UiRevision };
```

Failure reasons distinguish invalid contract, exhausted attachment capacity, unsupported capacity ownership, no remaining permitted candidate, repeated geometry, candidate budget, repair budget, and expansion budget. Report the affected relationship/owner, rejected placements, requested resources, and consumed limits. Do not translate `candidate_exhausted` into “impossible diagram.” A valid geometric candidate with an invalid/missing label is still a failed scene.

Preparation errors persist. Rejected-trial errors belong in search evidence; they must not contaminate a later accepted revision. A failed result retains concrete findings from its diagnostic revision plus the terminal search reason. No `while (!placed) addPadding()` loop, no reset budget, and no success-by-dropping-content fallback.

## 9. One acceptance contract and one publication gate

Build the final context from the immutable inventory and independently allocated attachments. Check:

1. **Coverage:** each expected ordinary connector or declared junction path exists with the right occurrence provenance; segment continuity, expected labels and markers survive; structural representations remain accounted for.
2. **Attachments and shape:** endpoint coordinates/sides agree with allocation; marker terminal legs fit; compact-loop pitch, depth, same-edge condition, and declared traversal hold (negative x in the production bundle).
3. **Routes:** orthogonality, node/header intrusion, clearance, owner containment, and illegal overlap against the complete physical route set. Crossings follow the existing applicable policy and are scored; the accepted proof has zero crossings. Explicit physical sharing is checked by declared segment identity, not a same-target shortcut.
4. **Labels and markers:** use shared label collision and association checks plus an independent painted-marker audit. Full measured labels are present, close to their own route, unambiguously associated, and inside their owner/export bounds.
5. **Layout:** nodes, headers, labels, markers, and required clearances fit actual measured/positioned containers and the exported viewport. The proof's unchanged local pair/card geometry is checked separately from collision freedom.

Search and final serialization use the same contract and policy. The final audit is read-only and recomputes findings from actual geometry; a recorded “accepted” flag or stored zero-violation count is insufficient. Test mutation of an accepted scene to verify this gate catches stale acceptance.

Today [`renderPositionedSceneToSvg`](../../src/renderer/staged/svgBackend.ts) throws on IA acceptance errors but only appends UI audit diagnostics; [`previewWorkflow.ts`](../../src/renderer/previewWorkflow.ts) subsequently suppresses UI artifacts on errors. Tighten the enabled UI path so ordinary SVG/PNG calls cannot return a successful artifact after failed acceptance, including calls outside the CLI workflow.

Preserve the existing explicit combined-view `--force` diagnostic behavior by carrying a diagnostic-artifact intent through the preview backend. That intent may serialize the failed diagnostic revision, with error diagnostics and an explicit diagnostic designation. It never changes the outcome to accepted or clears the failing exit status. Named-diagram error suppression remains unchanged. Do not accidentally remove this diagnostic path by throwing before its explicit intent reaches the renderer.

## 10. Implementation sequence and acceptance gates

Each implementation slice includes its necessary code, tests, and technical documentation. The new routing policy is not enabled for normal v0.2 output until the production proof passes.

| Slice | Concrete work | Gate before proceeding |
| --- | --- | --- |
| 1. Policy and complete intent | Bundle schema/validation/runtime consumption; persisted inventory; complete ordinary transitions; declared existing junction paths; independently resolved attachments. | Loaded-bundle mutation changes behavior. DG-002's complete path and labels retain their geometry. No relationship disappears when return fragments are removed. |
| 2. Compact proof on production geometry | Shared ordered pair, compact route constraints, external label placement, both side trials, full acceptance function. | Accepted two-state case reproduced with fixed cards/pair. Top rejection has the actual label findings. A label-sized or right-to-left-across-the-card loop fails acceptance even if collision-free. |
| 3. Owned reflow and bounded coordinator | Capacity ledger, real scene rebuild, aggregate budgeting, failure result, and publication gate. | Actual whole-sheet proof passes with later content reflowed, including a following section and a packed-layout case. Failure and zero-budget cases terminate and publish no normal artifact. |
| 4. Genuine port-capacity growth | Shared allocation demand, measurement minima, preliminary/final measurement propagation, consistent content/port bounds. | Crowded attachments require only justified minimum extent. Unrelated long labels do not enlarge the node. Impossible pinned ordering reports failure. Policy cannot enable node growth until this gate passes. |
| 5. Compatibility and enablement | Real existing fork/merge/fanout, secondary states, multiple loops/owners, detail/decorator variants; remove enabled-path repair chain and inconsistent exemptions. | Full final audits pass; v0.1/LEGACY stay stable; accepted artifact is deterministic. Only then enable bundle policy and refresh relevant downstream evidence. |

For slices 1–3, test with node growth disabled in the loaded test policy; the accepted proof needs no card growth. The final shipped policy may permit it only after slice 4. This avoids presenting an unsupported capability as implemented.

Tests exercise the public render seam and the shared geometry/measurement interfaces where behavior is independently reusable. Use actual prepared proof data and production SVG, not handwritten prototype painting. Required negative controls include missing transition, changed endpoint, stretched compact loop, detached/omitted label, marker intrusion, shared-target overlap, repeated ineffective growth, budget starvation, rejected-branch mutation, and a valid candidate followed by exhausted exploration. Resource merging needs concurrent-lane and exclusive-side cases.

The next concrete deliverable is the production two-state proof carried through owned full-scene reflow and the final artifact gate. Broader tuning, goldens, and any claim of general routing success wait for that evidence.

## Status

The architecture is implemented in the working tree, including the shipped v0.2 policy, owned reflow, production measurement minima, complete-scene acceptance and publication gate. The actual full-sheet and DG-002 CLI outputs pass exact-scene audits and visual inspection. See the [implementation record](ui_contracts_compact_loop_implementation_status.md) for commands, compatibility results, artifact links and remaining limitations. Historical prototype evidence and goldens remain unchanged. Earlier present-tense descriptions above record the starting implementation and the required design changes.
