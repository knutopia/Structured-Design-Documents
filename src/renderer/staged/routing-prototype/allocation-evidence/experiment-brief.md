# UI Contracts routing architecture and second prototype brief

Recorded 2026-10-16 from the architecture discussion in the originating chat. This is the first file capture of that proposal. It is a proposed production architecture to investigate, not a production implementation or a finding that the mechanism is adequate. The immediate authorized task is the throwaway prototype in the final section.

## Scope and authority

Replace transition preparation and consolidate acceptance for the entire UI Contracts sheet. Preserve containment, composition, supporting contracts, and existing fork/merge bars, adapting their routing only as necessary for consistent acceptance.

Sources by role:

- Machine presentation authority: `/home/knut/projects/sdd/bundle/v0.2/core/views.yaml`, `ui_contracts_presentation`, beginning around line 4173. Relationship roles, visibility, labels, and any new spec-owned routing preferences must flow from the loaded bundle.
- Architectural routing contract: `/home/knut/projects/sdd/docs/routing_hardening/design_decisions.md`, especially lines 5–25. Complete-context acceptance, independently resolved endpoints, bounded search, and expansion ownership govern the design.
- Repository guardrails: `/home/knut/projects/sdd/AGENTS.md`. Preserve staged rendering, semantic projection, determinism, and acceptance before snapshot updates. Do not use ELK.
- Visual reference for the same-side loop: `/home/knut/projects/sdd/docs/ia_place_map_hardening/manual_review_2_evidence/self-loop.compact.svg` and its `.sdd` source. Read the implementation record rather than inferring a general algorithm from this one image.

Explicit user choices:

1. Transition preparation plus common acceptance for the complete sheet; do not redesign all UI connector layout together.
2. Preserve fork/merge bars, with explicit junction ownership and relationship provenance.
3. Prefer a same-side loop below its node, with an above-node fallback.
4. Avoid expansion when the above-node alternative fits already: try permitted sides at current size before growth.
5. Permit minimum card growth justified by measured port demand, including the necessary shared sizing support.
6. Use replacement acceptance machinery for both bundle versions. Preserve v0.1 attachment conventions; introduce the new loop preference through v0.2 policy.

Parser, compiler, semantic validation, projection, legacy rendering, and unrelated views remain outside this migration. The prototype is narrower still: it experiments with the geometry mechanism without implementing this production migration.

## Representation and ownership

One asynchronous UI layout module owns a rendering attempt. Its interface accepts a coordinate-free `RendererScene` and returns the final measured and positioned scenes, diagnostics, and aggregate routing evidence. Existing public rendering entrypoints need no new user-facing options.

Internally it coordinates measurement, attachment allocation, prepared candidates, shared routing, labels, and capacity-driven rebuilding. Shared modules continue to own generic geometry calculations and route validation.

Ordinary forward transitions, returns, and self-loops remain complete connectors with actual node endpoints, relationship identity, label, and arrow. Bends are route geometry. They must not be broken into independently accepted frame-to-frame pieces.

Forks and merges retain an explicit junction network: a physical bar is painted once; each logical relationship records its directed path through the network. Audit both physical geometry and complete relationship coverage. Matching source or target IDs never grant an overlap permission.

Retain a surrounding routing enclosure where needed, but never use it as an artificial endpoint for a return. Forward edges belong to the inner layout group; complete returns and loops belong to the surrounding routing enclosure. The existing `ownerContainerId` mechanism in shared macro layout supports this separation, so complete cyclic edges need not collapse forward ordering into one rank. No new layout engine is needed.

Carry relationship paths, junction ownership, expected labels, and resolved bundle preferences as typed renderer metadata. Resolve required endpoints independently from measured ports/junctions before constructing route candidates.

Read-only feasibility evidence from this discussion: existing v0.1 branch, merge, and diamond examples were rendered and passed `validateFinalRouteSet` with independently resolved declared ports and no sharing exemption (4, 4, and 8 physical connectors respectively). This supports preserving explicit bars; it does not establish the new mixed-topology mechanism.

## Allocation and sizing

- Allocate against the complete connector inventory. Preserve valid existing attachments where possible; account for non-transition reservations. Use stable source/relationship order for allocation and tie-breaking.
- Allocate loop departure/arrival pairs atomically, including occupied ports from other loops. Reuse shared `allocatePortOffsets`, `allocateOrderedPortPair`, marker metrics, corridor measurements, and label-capacity helpers.
- Use measured side capacity, corner clearance, and actual marker footprints. Do not squeeze slots below required separation or derive permitted sides from the produced polyline.
- Add optional shared minimum sizing in a future production implementation. Node dimensions stay at least natural measured size and grow only for explicit measured capacity. Recompute content, ports, and junction alignment through shared measurement; preserve typography and full text.
- Keep returns in the upper routing corridor. For the proposed v0.2 loop policy, try south then north at current size; expand only if neither permitted alternative yields acceptable routes and labels.
- Proposed bundle addition: `ui_contracts_presentation.routing_preferences.self_loop`, reusing the existing IA traversal/ordered-side vocabulary. Validate through bundle loading and consume through `resolveUiContractsPresentation` into renderer intent. Absence preserves existing attachment conventions; invalid data fails validation. Do not hardcode this production policy behind the bundle's back.

## Expansion and acceptance

Proposed production contract amendment: one UI layout owner, with at most four effective expansion revisions for the whole sheet, sharing 4,096 candidate evaluations and 128 repair revisions across preparation alternatives, routing, loop trials, and label placement. These are experiment defaults and a proposal, not a proof that arbitrary diagrams can be solved within them.

- Capacity requests identify actual resources: node dimensions, layout gaps, or enclosure padding.
- Merge simultaneous requirements for the same resource by maximum. Convert later deficits to absolute requirements; rebuild from the stable original scene.
- One revision can satisfy several resources. Repeated or unchanged geometry stops recovery. No stage, scope, side trial, or repeated coordinator call replenishes the allowance.
- Macro layout is asynchronous, while `runRoutingLifecycle` has a synchronous expansion callback. Keep async rebuilding in the UI layout owner, following the existing IA pattern. Call the shared coordinator with the remaining search allowance and disable its separate expansion mechanism. The requirement is actual owner-controlled rebuilding, not use of a particular callback.
- Trace consumption by cause and the selected geometry revision. Rejected attempts remain evidence, not stale production errors attached to an ultimately accepted scene.

Use `validateFinalRouteSet` consistently for candidate acceptance and the emitted routes: independent endpoints, endpoint re-entry, obstacles, finite owner bounds, separation, and actual marker clearance. Preserve production crossing treatment `penalize`; require zero crossings in the original proof case. Remove blanket terminal-sharing exemptions.

Use shared label assessment against an independent expected-label inventory. Check text completeness, association, bounds, and collisions. Label failures may request capacity from the same owner.

Final SVG audit is read-only and uses the same route requirements. No later repair changes accepted routes. Required acceptance failures block public SVG and derived PNG, including direct renderer entrypoints.

## Replacement gate for eventual production migration

The eventual migration must remove competing authority:

| Current mechanism | Disposition |
| --- | --- |
| Five-piece return construction and artificial frame ports | Complete node-to-node connectors |
| Route-derived endpoint sides | Independently resolved attachment requirements |
| Post-coordinator node repair in the UI path | Remove |
| Two blanket same-target overlap exemptions | Remove; retain explicit junction networks |
| Separate UI label-placement authority | Shared assessment inside the layout owner |
| Duplicate diagnostics losing participants | Structured violation identity and all related connectors |

Useful alignment/route-seeding helpers may survive as candidate producers. They cannot certify geometry or modify accepted output. Show acceptance policies reduced from two to one and post-acceptance route mutation passes reduced to zero. Repeated calls to the same validator and a read-only audit are not competing authorities.

Both bundles use the architecture. Compatibility preserves semantics and bundle policies, not every old coordinate. Other views' budgets stay unchanged. Apply required contract/documentation changes before production expansion is implemented. Do not implement this migration as part of the prototype.

## Required production evidence, after prototyping

Prefer public source-preview and staged UI renderer seams. Cover the reduced original proof and then complete sheet; deliberate DG-002 omission; loops, parallel transitions, cycles/branches; decorated cards, long labels, larger markers; real card growth and real surrounding-layout expansion; aggregate exhaustion and repeated states; determinism; both bundle versions/details/decorators; bundle mutations affecting loop behavior; and corruption of final geometry rejected at serialization. Refresh evidence only after geometric and visual acceptance.

## Immediate task: second logic prototype

Question: Can complete-transition routing automatically allocate attachments, grow measured capacity when necessary, and produce valid routes with readable labels within one shared allowance?

Extend the existing offline demonstration on its throwaway branch. Preserve or clearly retain access to the original failure and actual DG-002 comparisons. Use real shared allocation and validation helpers; isolate experimental sizing/rebuilding from production code. Identify experimental policy data explicitly rather than claiming that the proposed production bundle contract is implemented.

Show the full relevant state after every action: attachments, card dimensions, capacity requests, selected side, validation findings, and cumulative candidate/repair/expansion use. Keep the interface understandable and expose technical detail through an inspector. State stays in memory.

Guided cases:

1. Original forward/return/self-loop combination with automatic allocation.
2. Multiple loops/parallel transitions competing for ports, forcing measured card growth.
3. Insufficient corridor or label space, forcing automatic rebuilding/expansion.
4. Above-node fallback that avoids growth.
5. Mixed branch/return topology preserving junction ownership.
6. Exhausted allowance and repeated geometry yielding an honest failure.
7. Invalid endpoints and accidental shared ports still rejected.

Use four expansions, 4,096 candidate evaluations, and 128 repair revisions cumulatively for each complete experiment/run. Demonstrate automatic recovery from an actually inadequate starting layout, not merely a button that switches to a previously adequate drawing. Surface whether the shared routing search itself performed repairs; do not imply successful search from an already-valid prepared set.

Deliver a single shareable offline HTML file, visual walkthroughs and negative controls, deterministic evidence, and a scoped verdict. A failed mechanism is a legitimate experimental finding if shown accurately. Do not hide failure with weaker validation, dropped relationships, increased budgets, or another independent repair pass.

Follow prototype skill: no formal test suite or production golden refresh. Capture the prototype and verdict on the throwaway branch. Distinguish experiment results from remaining production integration work; no production migration or promotion of experimental code is authorized by this task. The current evidence only proves limited geometry feasibility. This experiment determines whether the proposed mechanism is adequate to proceed to an implementation spec or needs revision.
