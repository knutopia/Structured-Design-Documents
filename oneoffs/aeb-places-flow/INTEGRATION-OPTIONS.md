# Introducing Place Flow to SDD

This is a design recommendation, not an implemented SDD feature. The one-off figures remain visual proof cases. The shared-start Figure 2 variant adds the combined-graph case to the two independent routes and the Community fork.

## Recommendation

Introduce **Place Flow** as a new public view, provisionally `place_flow`, within the information-architecture family. Give it a small, distinct semantic contract: Places connected by navigation. Reuse SDD's staged rendering modules and extract reusable navigation presentation where justified. Do not create another independent drawing stack or migrate Scenario Flow as a prerequisite.

The distinction is the question each view answers:

| View | Question | Organizing relationship |
| --- | --- | --- |
| IA Place Map | How is the site organized? | Containment, with navigation also available |
| Scenario Flow | What happens in this scenario, and where is it realized? | Ordering between ScenarioSteps |
| Place Flow | Where can a visitor go from this page? | Navigation between Places |

The visual resemblance to Scenario Flow is useful, but it does not make navigation a scenario. Multiple outgoing links need no invented ScenarioStep or decision diamond. A link indicates a possible move; it does not assert that every visitor takes that path or that a page can only be visited once.

## Existing authority and non-negotiable invariants

- The active v0.2 bundle governs machine behavior. `bundle/v0.2/core/views.yaml:2116` selects Area/Place and CONTAINS/NAVIGATES_TO for IA. Its defaults at `:2746` make containment and source-order sibling chains primary for presentation.
- `bundle/v0.2/core/views.yaml:2806` selects ScenarioStep/Place/ViewState for Scenario Flow. Its default at `:3441` gives PRECEDES on ScenarioStep the primary flow spine.
- `bundle/v0.2/core/contracts.yaml:3` defines named selection as explicit edge occurrences plus explicit nodes and their endpoints, with no closure. Layout must not silently add another edge merely because both endpoints are present.
- `src/projector/projectView.ts:50` applies selection before projection. Preserve that order for combined and named targets.
- `AGENTS.md` keeps projection independent of geometry and requires the staged pipeline `Projection -> RendererScene -> MeasuredScene -> PositionedScene -> SVG -> PNG`.

The renderer guides remain useful for stage ownership. Some passages in `docs/toolchain/adding_staged_renderers.md` still name v0.1; the current repository instructions and v0.2 bundle take precedence for this proposal.

## Alternatives

| Option | Practicality | Architectural consequence | Assessment |
| --- | --- | --- | --- |
| An `ia_place_map` presentation variation | Strong conceptual relationship; shares Place metadata and navigation labels | Must distinguish containment-led layout from navigation-led layout. If it drops containment, it also changes view scope. A persisted variation introduces selection, defaults, validation and artifact-identity work. | A reasonable second choice if SDD intends to introduce a general presentation-variation feature for several views. More than a layout flag in the current system. |
| A `scenario_flow` variation | Looks similar to these examples | Must replace the primary spine, handle Places as primary nodes, preserve navigation events and bypass scenario-specific visibility, lanes, realization and parking rules | Weakest fit. The existing renderer is not a generic flow layout that can simply be renamed. |
| A new `place_flow` view | Uses established named-diagram and view-discovery mechanisms; requires explicit registration and tests | Gives navigation a clear contract while allowing reuse below the view interface | Recommended. A new public view does not require a separate measurement, painting or routing stack. |
| An alternate preview backend | Useful for a temporary experiment on the same projection | Backend selection would start changing the meaning of a view if it also removes containment or changes eligibility | Keep as an experiment only. Backend choice should concern rendering technology/capabilities. |
| A configurable universal flow view or external export | Could cover many future requests | Adds a configuration language, more combinations and potentially disconnected behavior outside SDD's contracts | Too much machinery for these cases. External tools remain a useful escape hatch, not the primary integration. |

An IA variation becomes preferable if the intended feature is strictly “lay out precisely this same IA content differently,” including a defined treatment of every selected containment edge. These examples instead suggest a stable navigation-only question. A separate view expresses that difference directly and avoids weakening IA's existing hierarchy behavior.

## Combined and named diagrams are a separate concern

Do not introduce a layout mode whose purpose is “combined versus named.” The renderer receives the selected graph and applies the same rules.

- A combined selection containing both article routes has one Home identity and one shared visual Home. Its outgoing navigation produces two branches.
- Two named route selections each contain Home. Each artifact independently renders its own Home occurrence. That repetition is across diagrams, not a change to the domain model.
- A named selection may itself contain both routes and therefore share Home. Being named does not mean being linear.
- Separate occurrences inside one artifact should require an explicit presentation policy and identity traceability; do not duplicate every join to make layout easier.

The current one-off two-column illustration repeats Home inside one illustration to approximate two separate route panels. It is not an implementation of a new selector. The new shared-start illustration uses the same selected eight Places and seven edges, with one visual occurrence per Place.

Existing CLI distinctions already support the intended product behavior: `--view <type>` renders a combined view, `--diagram <id>` renders one named selection, `--diagram all` batches named diagrams, and `--view all` batches supported combined view types. New `place_flow` examples would use those existing concepts after the view is registered. No new flags are required for this distinction.

Keep validation profile, render detail and layout presentation separate as well. A direction preference or card-width policy is a presentation setting, not another validation profile or another diagram type. Persisted per-diagram presentation settings would need an explicit bundle contract and artifact identity; they should not become prerequisites for getting a simple fork right.

## Proposed production shape

### Bundle and projection

Define the new view in `bundle/v0.2/core/views.yaml`, using existing Place and NAVIGATES_TO vocabulary. Its hierarchy is empty. Navigation supplies directed progression for layout; it does not acquire the temporal semantics of PRECEDES. Preserve event/guard presentation in compact as well as detailed output, and preserve each selected source occurrence, including parallel links with different annotations.

Keep the initial selection contract straightforward: selected Places remain selected, including explicit isolated Places. Show disconnected components honestly. Do not silently narrow combined selection to reachable nodes or silently omit isolated nodes. A later connected-only filter would need an explicit bundle contract and omission reporting.

New behavior needs bundle-owned fields for progression, branch order, cycle handling, node-occurrence policy and navigation presentation. Extend `src/bundle/types.ts` and the loader/validation machinery before consuming those fields. Use `loadBundle(...)` and the existing parser/compiler path; no new source grammar or node/relationship vocabulary is needed for this initial view.

One concrete reuse issue needs attention: `src/projector/edgeOccurrences.ts:12` currently reads the exact-reference policy from `renderer_defaults.ia_place_map`. `RendererIaPlaceMapConfig` also couples navigation presentation to containment fusion. Extract the common occurrence/presentation contract into an appropriate shared bundle-owned location, with compatible handling of existing IA data. Do not make Place Flow pretend to be an IA hierarchy just to get accurate event labels. Prove combined as well as named parallel-edge fidelity.

Register the new projector through `src/projector/viewProjectors.ts`, its renderer capability through `src/renderer/viewRenderers.ts`, and its staged backend through `src/renderer/previewBackends.ts`. Helper view discovery already reads the loaded bundle (`src/authoring/contractResolution.ts:56`); a bundle entry alone does not supply a registered renderer. Review batch applicability and artifact identity along with registration. Preserve v0.1 compatibility and existing view outputs.

### Rendering modules

The useful seam is between **semantic flow selection** and **flow composition**. A flow-composition module should accept stable node/edge occurrences, bundle-resolved flow policy and layout intent, and produce ranks/branches and connector intent with diagnostics. Measurement, positioning, routing and SVG emission retain their existing stage ownership. Caller input should not include manually allocated tracks or arbitrary waypoints just to get an ordinary fork.

Reuse shared cards, decorators, text measurement, fonts, label capsules, theme, SVG emission and rasterization. Put navigation presentation behind a small reusable interface shared with IA. Keep the initial Place Flow composition cohesive and scoped. Extract additional graph-layout logic from Scenario Flow only when two working implementations demonstrate the same requirement and tests protect both callers.

The existing scenario middle layer has named step/place/view-state lanes, realization placement and parking behavior. Its cycle fallback uses source-order chronology (`src/renderer/staged/scenarioFlowMiddleLayer.ts:362`). Those are scenario choices, not ready-made policies for a cyclic website navigation graph. Copying the file or broadening it with many “if Place Flow” branches would spread maintenance cost.

The one-off painter is not production infrastructure. Production should express these layouts through the existing scene stages and shared SVG backend. Keep the one-off artifacts as independent visual acceptance references.

### Width and spacing

Wide cards solved the long-word problem in the first figures, but should not define the new view. Prefer ordinary card widths, allow greater height, and widen an individual card or a local alignment group only when measured content needs it. Keep ordinary inter-node gaps; allocate extra space only for branch separation, labels or feedback routes. A short title in one branch should not inherit an entire diagram's widest title.

The new shared-start proof uses this direction: regular-width cards and a wider glossary article only where the unbroken German word requires it. Any production width change belongs in shared measurement/cell-sizing policy, not in special handling for AEB or Place Flow titles. Audit the actual shared-node measurement path before assuming existing width-band settings already control it.

## Scalability and acceptance

Scalability has three different meanings: manageable implementation, bounded computation and readable output. A new view with shared modules helps the first. Neither a new view name nor a generic router guarantees the other two.

Before generalizing, use an explicit progression of proof cases:

1. These three illustrations: independent paths, one shared start, and three alternatives.
2. A fork that rejoins, several incoming links to one Place, and unequal branch lengths. Keep one identity at the join.
3. A simple return link, a self-loop and bidirectional navigation. Cycles must remain visible; arrange forward progression and return channels without inventing chronology. Strongly connected components may guide layout internally without collapsing semantic Places in the output.
4. Several disconnected components, parallel annotated links, long labels and mixed title lengths. Preserve every selected occurrence.
5. A high-degree hub and a larger real model. Bound layout/routing work and report excessive congestion or size. Never hide edges to make the figure look clean.

Use stable source order as a tie-breaker, explicit ports and reserved branch/return channels, and structured diagnostics for unsupported or degraded cases. Route construction should respect space reserved during placement; avoid depending on repeated global repair passes to recover a bad initial composition. Reuse shared routing primitives and validators, with a cohesive flow-specific route planner where the layout supplies stronger information.

Arbitrary navigation graphs cannot all be crossing-free or fit on one page. Named selections are the primary readability mechanism for large models. A combined view is still useful, but do not promise that “render all” stays readable at any size. Any automatic partitioning or overview abstraction should be explicit and traceable, and should be designed only after the smaller graph contract is sound.

Acceptance must cover bundle-dependence, exact source occurrences, no unintended parser/compiler/validator/projection changes, deterministic artifacts, text legibility, endpoint clarity and actual visual quality. Preserve the previous view baselines. Expand snapshots only after each proof passes; a clean diagnostic list alone is not acceptance.

## Implementation sequence

1. Agree on the navigation-only view contract and supported graph shapes; retain these figures as visual targets.
2. Extend and test the v0.2 bundle contract and generic occurrence/presentation consumption. Register projection and prove combined/named fidelity before layout.
3. Implement the small Place Flow composition module through the shared staged pipeline, first for paths and forks, then joins and cycles.
4. Add batch/CLI/helper discovery coverage, minimal authoring examples and concise user documentation. Require visual acceptance before making the new view operational by default.
5. Evaluate reuse with Scenario Flow from evidence. Do not make an unrelated renderer refactor the entry cost for this feature.

This provides a clear user-facing diagram, limits the initial integration scope, and leaves a real seam for later reuse without committing SDD to a speculative universal graph renderer.
