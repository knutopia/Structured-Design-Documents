# [Done] Deriving a Staged Journey Map Renderer

**KG:**

We have a single legacy-renderer-only (no staged renderer) diagram type left: journey map. 

Please compare the structure (node- edge types, potential topology-complexity) of journey map to the other diagram types.

The purpose of this comparison is to determine if there is a path to implement a staged renderer for journey map by replicating and slightly modifying an existing renderer.

For what it's worth, the journey map bundle contract is already fairly small: Stage/Step, CONTAINS, PRECEDES, source ordering, and profile-controlled opportunity badges ([views.yaml (line 115)](/home/knut/projects/sdd/bundle/v0.1/core/views.yaml:115)). The existing render model already derives most of that semantic structure ([journeyMapRenderModel.ts (line 71)](/home/knut/projects/sdd/src/renderer/journeyMapRenderModel.ts:71)).

A staged renderer would need:
Stage strips or containers with ordered Step cards.
Support for uncontained root Steps.
Deterministic source ordering.
Explicit PRECEDES routing within and across stages.
Opportunity-reference badges under permissive/strict profiles.
SVG-first PNG generation, renderer diagnostics, and normal stage snapshots.
Visual proof cases covering multiple stages, cross-stage edges, long labels, empty/single-step stages, root Steps, and profile differences.

Do not write any code.

**GPT-5.6:**

The journey map is the smallest staged-renderer target semantically, but its routing topology is not necessarily linear. It is best understood as:

> a shallow, source-ordered container forest with an arbitrary directed Step-to-Step overlay.

There is a credible staged-renderer path based primarily on the IA place-map renderer skeleton, with cross-container edge handling patterned after UI Contracts. A complete implementation should not clone Scenario Flow or Service Blueprint wholesale.

## Structural comparison

| View | Nodes / edges | Structural topology | Potential connector topology | Journey-map reuse value |
|---|---|---|---|---|
| Journey map | 2 / 2 | One-level `Stage → Step` containment plus uncontained root Steps | Arbitrary directed graph over Steps: chains, branches, joins, cross-stage edges, backward edges, disconnected components, and cycles | Baseline |
| IA place map | 2 / 2 | Recursive `Area/Place → Place` containment forest | `NAVIGATES_TO` overlay between Places | Closest scene/model structure |
| Scenario flow | 3 / 4 | No containment; three semantic lanes and chronology bands/tracks | Branching Step spine plus realization, navigation, and transition channels | Closest PRECEDES topology, wrong placement policy |
| Service blueprint | 5 / 6 | Fixed lane grid crossed with derived chronology bands | Multiple cross-lane flow, support, resource, and policy channels | Considerably more complex |
| Outcome-opportunity map | 4 / 5 | Fixed four-column semantic grid, no containment | Dense typed fan-out/fan-in between columns | Useful only for high-density routing ideas |
| UI Contracts | 7 / 6 | Recursive heterogeneous scopes plus synthetic transition/support groups | Edges between leaves and containers at different nesting levels | Closest cross-container endpoint mechanics |

The node/edge inventories come directly from the bundle view definitions: journey map is only `Stage`, `Step`, `CONTAINS`, and `PRECEDES`; all other staged views have either deeper hierarchy, more node classes, more edge channels, or all three. [views.yaml](/home/knut/projects/sdd/bundle/v0.1/core/views.yaml:115)

### The important complication

Journey containment is strictly shallower than IA or UI Contracts: the bundle only allows `Stage → Step`. But multiple structural parents are only warned about, and the existing model resolves them first-parent-wins. [contracts.yaml](/home/knut/projects/sdd/bundle/v0.1/core/contracts.yaml:57) [journeyMapRenderModel.ts](/home/knut/projects/sdd/src/renderer/journeyMapRenderModel.ts:91)

`PRECEDES` is less constrained. Its endpoints must be Steps, but cycles are warnings even in strict mode, not errors. Therefore the renderer cannot assume a simple DAG or monotonic left-to-right chain. [contracts.yaml](/home/knut/projects/sdd/bundle/v0.1/core/contracts.yaml:109)

This makes journey map:

- Structurally simpler than every other view.
- Potentially as difficult as Scenario Flow for connector routing.
- Easier than Scenario Flow overall because there is only one edge channel, no edge labels currently carried by the render model, no decision-node shape, and no mirrored Place/ViewState lanes.

## Why IA place map is the best primary template

The two render models are nearly isomorphic:

- Both expose ordered `rootItems`.
- Both distinguish container-like and leaf-like items.
- Both carry source-order chains and a separate semantic edge list.
- Both support top-level uncontained leaves.
- Journey is only one level deep, whereas IA recurses through Places. [journeyMapRenderModel.ts](/home/knut/projects/sdd/src/renderer/journeyMapRenderModel.ts:7) [iaPlaceMapRenderModel.ts](/home/knut/projects/sdd/src/renderer/iaPlaceMapRenderModel.ts:7)

Journey’s existing model already handles almost all semantic preparation:

- Stage children use outgoing structural-edge source order.
- Root Stages and Steps use top-level source order.
- Empty and single-step Stages naturally survive.
- Uncontained Steps become root items.
- Profile policy controls opportunity badge lines.
- All visible ordering edges are extracted. [journeyMapRenderModel.ts](/home/knut/projects/sdd/src/renderer/journeyMapRenderModel.ts:100)

The underlying author-order functions provide deterministic fallbacks when explicit author-order metadata is unavailable. [authorOrder.ts](/home/knut/projects/sdd/src/compiler/authorOrder.ts:22)

The staged IA renderer also has the desirable thin outer pipeline:

`render model → RendererScene → shared measure/layout/routing → SVG`, with PNG obtained by rasterizing that SVG. [iaPlaceMap.ts](/home/knut/projects/sdd/src/renderer/staged/iaPlaceMap.ts:522) [svgBackend.ts](/home/knut/projects/sdd/src/renderer/staged/svgBackend.ts:687)

### What must not be copied from IA

IA routing is specialized around forward source-order navigation and locally merges navigation with containment/follower structure. It explicitly rejects backward navigation for that planning path. [iaPlaceMap.ts](/home/knut/projects/sdd/src/renderer/staged/iaPlaceMap.ts:195)

Journey cannot do that because every `PRECEDES` edge must remain explicit, including:

- Cross-stage edges.
- Non-adjacent edges.
- Backward edges relative to source order.
- Branch and join edges.
- Cycles.

So IA is the right scene-building and pipeline template, but not the right edge planner.

## Why the other renderers should not be cloned

Scenario Flow has the strongest PRECEDES routing, but its middle layer topologically repositions Steps into chronology bands and branch tracks. On cycles, it falls back to author order. [scenarioFlowMiddleLayer.ts](/home/knut/projects/sdd/src/renderer/staged/scenarioFlowMiddleLayer.ts:186)

That conflicts with journey map’s stronger source-order presentation requirement: PRECEDES should be an overlay on author-ordered Stage/Step placement, not the authority that rearranges it. Copying Scenario Flow would preserve routing sophistication while importing the wrong layout semantics.

Service Blueprint has ordered Steps and ungrouped-node support, but it derives a multi-lane grid from a topologically ordered Step spine and numerous cross-lane relationships. [serviceBlueprintMiddleLayer.ts](/home/knut/projects/sdd/src/renderer/staged/serviceBlueprintMiddleLayer.ts:333) Its lane shells, semantic bands, spill columns, parking, separators, and three connector channels would mostly be deleted.

UI Contracts is useful as a secondary reference because it already:

- Builds titled scope containers.
- Supports root leaves and nested leaves.
- Resolves edges between nodes in different containers.
- Assigns cross-container edges to their lowest common owner container through the shared layout machinery. [uiContracts.ts](/home/knut/projects/sdd/src/renderer/staged/uiContracts.ts:197) [macroLayout.ts](/home/knut/projects/sdd/src/renderer/staged/macroLayout.ts:830)

Its `elk_layered` transition layouts should not be copied. The relevant reusable idea is endpoint ownership and generic orthogonal edge construction, not its layout strategy. [uiContracts.ts](/home/knut/projects/sdd/src/renderer/staged/uiContracts.ts:285)

Outcome-opportunity routing is much more sophisticated than needed and is deeply coupled to fixed semantic columns, outcome bands, multiple connector channels, labels, and parking behavior.

## Recommended path

A staged journey renderer can reasonably be built as a small view adapter around existing shared infrastructure:

1. Reuse `buildJourneyMapRenderModel` as the semantic input.
2. Represent each Stage as a titled cluster or strip containing horizontally ordered Step cards.
3. Render uncontained Steps as root-level cards in their existing source position.
4. Give Steps west/east flow ports, with north/south escape ports if backward and fan-out routing requires them.
5. Emit every model edge as a `PRECEDES` scene edge; never turn source-order adjacency into a visible edge unless the semantic edge exists.
6. Run the normal shared measure/layout pipeline.
7. Render SVG first and derive PNG through the existing SVG rasterization path.
8. Register it through the same staged preview capability and diagnostic surfaces as the other views.

The opportunity badges need a small staged-content adaptation. The bundle already produces sorted typed references in projection, while the legacy render model flattens them into bracketed label lines. [journeyMap.ts](/home/knut/projects/sdd/src/projector/journeyMap.ts:26) A staged renderer should ideally create `badge_text` content blocks from those references rather than treating the brackets as ordinary text.

## Routing is the only material uncertainty

The shared generic router can resolve nested endpoints and deterministic orthogonal routes, but its simple fallback does not guarantee obstacle avoidance. It explicitly diagnoses that limitation when `avoidNodeBoxes` is requested without stronger routing geometry. [macroLayout.ts](/home/knut/projects/sdd/src/renderer/staged/macroLayout.ts:1293)

Therefore:

- Linear within-stage and adjacent cross-stage flows should be low risk.
- Branches, joins, backward edges, and edges spanning multiple populated Stages are the proof cases that determine whether this remains a “slightly modified IA renderer.”
- If those cases expose intersections, the fix should strengthen shared routing—such as deterministic top/bottom bypass lanes and endpoint bundling—rather than importing a journey-specific copy of the multi-thousand-line Scenario Flow router.

## Proof-case additions

The proposed proof cases are good, but topology analysis suggests adding four more:

- A branch and join within one Stage.
- A branch or join spanning multiple Stages.
- A PRECEDES edge running backward relative to source order.
- An annotated PRECEDES cycle.

Also worthwhile:

- Source order deliberately contradicting PRECEDES order, proving cards are not rearranged.
- Multiple root Steps interleaved with empty and populated Stages.
- A multiply-contained Step, proving the staged output retains the current first-parent behavior and reports the existing validation warning.
- Duplicate same-endpoint PRECEDES edges, because the current journey edge model has no explicit edge ID or author-order field. Stable unique scene-edge identity may need an occurrence ordinal. [journeyMapRenderModel.ts](/home/knut/projects/sdd/src/renderer/journeyMapRenderModel.ts:25)

## Verdict

Yes, there is a practical replication path.

The scene, measurement, profile, artifact, and snapshot work is low complexity and can follow IA place map closely. Journey is substantially simpler than IA in containment and simpler than every grid-based renderer.

The honest qualification is that robust routing is medium complexity, not trivial. If the listed plus branch/back-edge proof cases pass using the shared router, this is a small IA-derived renderer. If they do not, the remaining work is a shared routing enhancement—not a reason to clone Scenario Flow or Service Blueprint.

No files were changed.