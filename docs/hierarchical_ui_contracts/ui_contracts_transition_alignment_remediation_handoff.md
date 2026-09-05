# UI Contracts Transition Alignment Remediation Handoff

## Status

**Open, non-blocking macro-layout/routing quality issue.**

This issue was identified during visual review of the public corpus regenerated after
the shared-node adoption and routing-unification work. It does not invalidate the
shared-node implementation or its accepted public-artifact refresh. The rendered
nodes are correctly measured, and the affected transition route is geometrically
valid. The remaining defect is that renderer-owned layered placement unnecessarily
misaligns an otherwise direct pair of UI transition endpoints, forcing a visually
inferior orthogonal dogleg.

The future remediation should preserve the accepted shared-node implementation and
the completed shared routing architecture. It must improve UI transition-graph
placement through generic renderer-owned layout behavior, not restore ELK or insert a
proof-specific route exception.

## Executive Summary

In both compact and detailed `ui_contracts` renderings of
`bundle/v0.1/examples/place_viewstate_transition.sdd`, the transition from **Billing
Editing** to **Billing Success** is rendered as a right-up-right polyline:

```text
compact:
  M 296 184
  L 387.212 184
  L 387.212 152
  L 478.424 152

detailed:
  M 448 272
  L 539.212 272
  L 539.212 207
  L 630.424 207
```

The corresponding transition was a single straight horizontal segment before the
renderer-owned `layered` strategy replaced ELK during routing unification. The current
route is not produced by shared final repair. It already exists in the base positioned
scene, and `repairPositionedSceneRoutesAroundNodes(...)` returns it unchanged.

The immediate cause is unequal-height ranks being top-aligned:

- `VS-010a` (**Billing Editing**) is a structural container. In detailed output its
  positioned bounds are `x=48, y=174, width=400, height=196`, so its east transition
  port is at `y=272`.
- `VS-010b` (**Billing Success**) is a semantic leaf. Its detailed bounds are
  `x=630.424, y=174, width=224, height=66`, so its west transition port is at `y=207`.
- Both start at `y=174`, but their center ports differ by 65px.
- Compact output has the same shape with a 32px endpoint difference.

The generic orthogonal router then correctly connects the unequal east/west endpoint
coordinates with a midpoint dogleg. The clean first remediation to test is centered
cross-axis placement for UI transition-graph ranks, implemented by making the generic
layered strategy honor its existing `crossAlignment` contract.

## Authority and Scope

Apply these sources in this order:

1. [`../../AGENTS.md`](../../AGENTS.md) governs renderer boundaries, determinism,
   bundle authority, SVG-first output, no-ELK direction, quality gates, and stop
   conditions.
2. [`../routing_unification/routing_unification_implementation_plan.md`](../routing_unification/routing_unification_implementation_plan.md)
   records the completed shared routing implementation. In particular, UI Contracts
   now uses renderer-owned SCC/longest-path layered placement, shared exterior route
   repair, and shared final validation; `elkjs` is removed.
3. [`../toolchain/architecture.md`](../toolchain/architecture.md) defines current staged
   layout and routing ownership.
4. [`../toolchain/renderer_migration_guidance.md`](../toolchain/renderer_migration_guidance.md)
   requires renderer-owned layered placement for UI transition graphs and prohibits
   reintroducing an external layout engine.
5. [`../../bundle/v0.1/`](../../bundle/v0.1/) remains authoritative for machine-owned
   semantic behavior. This issue currently appears to concern pure renderer geometry,
   not a missing semantic bundle policy.
6. Focused layout, UI Contracts, routing, and visual-acceptance tests are executable
   acceptance authority. Existing snapshots and public artifacts are evidence only.

This remediation is in scope for renderer-owned macro layout and the resulting route
quality. It is out of scope for parser, compiler, validator, projection, shared-node
measurement, SVG painting, legacy Graphviz, DOT, or Mermaid behavior.

## Reproduction and Evidence

### Production source and edge identity

Use:

```text
bundle/v0.1/examples/place_viewstate_transition.sdd
view: ui_contracts
details: compact, detailed
edge: transitions_to:VS-010a->VS-010b
source label: Billing Editing
target label: Billing Success
```

Current public evidence:

- [`../../examples/rendered/v0.1/ui_contracts_diagram_type/place_viewstate_transition_example/compact_detail/place_viewstate_transition.ui_contracts.svg`](../../examples/rendered/v0.1/ui_contracts_diagram_type/place_viewstate_transition_example/compact_detail/place_viewstate_transition.ui_contracts.svg)
- [`../../examples/rendered/v0.1/ui_contracts_diagram_type/place_viewstate_transition_example/detailed_detail/place_viewstate_transition.ui_contracts.svg`](../../examples/rendered/v0.1/ui_contracts_diagram_type/place_viewstate_transition_example/detailed_detail/place_viewstate_transition.ui_contracts.svg)
- [`../../tests/goldens/renderer-stages/ui-contracts.place-viewstate-transition.positioned-scene.json`](../../tests/goldens/renderer-stages/ui-contracts.place-viewstate-transition.positioned-scene.json)
- [`../../tests/goldens/renderer-stages/ui-contracts.place-viewstate-transition.svg`](../../tests/goldens/renderer-stages/ui-contracts.place-viewstate-transition.svg)

The pre-public-refresh corpus can be inspected without modifying the worktree:

```bash
git show 01d6d37:examples/rendered/v0.1/ui_contracts_diagram_type/place_viewstate_transition_example/compact_detail/place_viewstate_transition.ui_contracts.svg

git show 01d6d37:examples/rendered/v0.1/ui_contracts_diagram_type/place_viewstate_transition_example/detailed_detail/place_viewstate_transition.ui_contracts.svg
```

Those public artifacts contain straight routes:

```text
compact stale corpus:
  M 241 184 L 425.424 184

detailed stale corpus:
  M 321 272 L 505.424 272
```

The renderer-stage evidence immediately before routing unification is more useful for
attribution because it isolates the ELK-to-renderer-owned-layered change. The parent of
commit `8389fb7` contains:

```text
M 449 272 L 633.424 272
```

The current detailed positioned-scene golden contains:

```text
M 448 272
L 539.212 272
L 539.212 207
L 630.424 207
```

Commit `8389fb7` introduced the renderer-owned layered implementation and removed the
ELK adapter as part of routing unification. This evidence places the route-shape change
at that migration boundary rather than in shared-node composition.

### Base route versus shared repair

A direct production-path inspection was run for both details by:

1. loading the v0.1 bundle;
2. compiling and projecting `place_viewstate_transition.sdd`;
3. building the UI Contracts `RendererScene`;
4. measuring it;
5. calling `positionScene(...)`; and
6. applying `repairPositionedSceneRoutesAroundNodes(...)` separately.

For compact and detailed output, the points before and after repair were identical.
The observed result was:

```text
compact repairChangedRoute:  false
detailed repairChangedRoute: false
```

Therefore the following are not the cause:

- shared exterior candidate selection;
- final node-intersection repair;
- shared final route validation;
- SVG serialization; or
- PNG rasterization.

## Current Pipeline and Ownership

The relevant pipeline remains:

```text
projection
  -> RendererScene
  -> MeasuredScene
  -> renderer-owned layered placement
  -> endpoint resolution and base orthogonal routing
  -> shared exterior repair
  -> shared final validation
  -> SVG
  -> PNG derived from SVG
```

### Scene construction

[`../../src/renderer/staged/uiContracts.ts`](../../src/renderer/staged/uiContracts.ts)
builds `view_state_graph` and fallback `state_graph` containers with:

```ts
{
  strategy: "layered",
  direction: "horizontal",
  gap: TRANSITION_GRAPH_GAP,
  crossAlignment: "start"
}
```

Transition edges declare semantic routing intent only:

```ts
{
  style: "orthogonal",
  preferAxis: "horizontal",
  avoidNodeBoxes: true,
  sourcePortRole: "transition_out",
  targetPortRole: "transition_in"
}
```

This ownership is correct. The scene does not contain final coordinates or polylines.

### Renderer-owned layered placement

[`../../src/renderer/staged/macroLayout.ts`](../../src/renderer/staged/macroLayout.ts)
implements `layoutLayeredContainer(...)` by:

1. building the transition adjacency graph from owned edges;
2. finding strongly connected components;
3. ranking the condensed graph by longest path;
4. preserving stable child/source order within ranks;
5. placing ranks left-to-right; and
6. stacking each rank from cross-axis coordinate zero.

The current placement loop initializes `crossOffset = 0` independently for every rank
and assigns every first child that same cross-axis origin. It computes the maximum
cross-axis extent afterward, but does not use `container.layout.crossAlignment` to
offset narrower ranks within that extent.

Consequently, `crossAlignment: "start"` and `crossAlignment: "center"` currently
produce the same layered placement. This is a generic contract gap in the layered
strategy. The existing stack and grid strategies already implement center alignment,
so their behavior provides a nearby renderer-owned precedent.

### Base routing

[`../../src/renderer/staged/routing.ts`](../../src/renderer/staged/routing.ts) resolves
the named east/west transition ports after placement. For opposite horizontal sides
at different Y coordinates, `buildSharedRoute(...)` creates a centered orthogonal
three-run route. Given the positioned endpoints, the resulting dogleg is expected and
correct.

### Shared routing implementation

[`../../src/renderer/staged/pipeline.ts`](../../src/renderer/staged/pipeline.ts) applies
`repairPositionedSceneRoutesAroundNodes(...)` and shared final validation to UI
Contracts after base placement and routing. The repair layer considers the existing
route before outer alternatives. Since this dogleg is orthogonal, has legal endpoints,
avoids nodes, and has adequate terminal legs, the existing candidate passes and is
retained.

That behavior is consistent with the recent routing-unification architecture. Shared
repair should not rewrite a valid route merely because a different macro placement
could have produced a simpler route. Route simplicity here must be improved at the
placement boundary that determines the port coordinates.

## Root Cause

The root cause is a cross-axis placement quality gap in the new renderer-owned layered
strategy:

- ranks are correctly determined by SCC condensation and longest-path ordering;
- rank X coordinates and semantic order are correct;
- unequal-height rank contents are all top-aligned;
- the layered strategy does not honor its declared cross-alignment field;
- east/west center ports therefore become vertically misaligned; and
- generic orthogonal routing necessarily introduces a dogleg.

The shared-node renderer legitimately makes leaf height content-dependent. A
structural `ViewState` container and a leaf `ViewState` should not be expected to have
equal heights. Macro layout must consume those valid allocations well. Changing node
height, forcing a renderer-specific node variant, or moving the target port away from
the node's center would solve the symptom at the wrong boundary.

## Why Existing Tests Pass

[`../../tests/stagedUiContracts.spec.ts`](../../tests/stagedUiContracts.spec.ts) proves
the current UI Contracts structure, diagnostics, terminal-leg length, contract-lane
labels, deterministic snapshots, and several balancing behaviors. The positioned
scene and SVG snapshots faithfully lock the dogleg but do not judge whether an
unobstructed transition could be direct.

[`../../tests/stagedVisualAcceptance.spec.ts`](../../tests/stagedVisualAcceptance.spec.ts)
checks UI Contracts node clearance, endpoint entry, same-orientation separation, and
support-edge label clearance. The route satisfies those hard invariants, so the test
correctly passes. The suite has no route-simplicity assertion for free transition
edges.

The missing coverage is a narrow quality invariant:

> When adjacent singleton transition ranks can be cross-axis aligned without changing
> rank order, causing overlap, or violating another locked layout contract, their
> unobstructed horizontal transition should remain a direct two-point route.

Do not generalize this into “all transition edges must be straight.” Multi-node ranks,
cycles, self-loops, backward edges, and genuine obstacles may require orthogonal
detours.

## Preferred Remediation to Prove First

Use the existing scene contract rather than inventing a UI-specific coordinate patch:

1. Extend `layoutLayeredContainer(...)` to retain each rank's cross-axis extent.
2. After the maximum cross-axis extent is known, apply the declared
   `crossAlignment` consistently:
   - `start`: offset `0`;
   - `center`: offset `(maximumCross - rankCrossSize) / 2`;
   - `stretch`: preserve current item sizes unless a separate, justified container
     stretching contract is designed.
3. Change UI transition-graph containers from `crossAlignment: "start"` to
   `crossAlignment: "center"` if focused proof confirms that this is the intended
   view-owned policy.
4. Let normal port resolution and `buildSharedRoute(...)` rebuild routes from the new
   positioned geometry.
5. Keep shared exterior repair and shared final validation unchanged unless the new
   geometry exposes a separate hard violation.

For the current proof, centering the single target rank within the taller source rank
would make the endpoints coincide vertically:

```text
compact:  target shifts by 32px; both transition ports become y=184
detailed: target shifts by 65px; both transition ports become y=272
```

The expected route then collapses naturally to one horizontal segment without any
route-specific special case.

### Why this is appropriately generic

- `CrossAlignment` already exists in the renderer scene contract.
- Stack and grid layout already honor center alignment.
- The layered strategy is shared renderer infrastructure, not a UI-semantic parser.
- UI Contracts chooses the desired layout policy while shared macro layout executes
  it.
- No semantic IDs, labels, fixture coordinates, or raw `.sdd` text are required.
- No bundle extension is required for a purely geometric renderer policy unless the
  project deliberately decides that transition-rank alignment must become
  user-configurable machine behavior.

## Alternative if Centered Ranks Are Insufficient

If a proof corpus with multiple nodes per rank shows that whole-rank centering creates
avoidable crossings or poor lineage continuity, stop before refreshing snapshots and
evaluate deterministic edge-aware cross-axis ordering/alignment. A barycentric or
median-predecessor heuristic may be appropriate, but it is materially more complex and
should not be introduced for the current two-node case without evidence.

Any such extension must preserve:

- SCC membership and rank assignment;
- stable source-order tie-breaking;
- node non-overlap within ranks;
- deterministic output under repeated rendering;
- bounded behavior for cycles and disconnected components; and
- shared final validation.

Start with the simpler existing-contract implementation. Do not introduce a general
crossing-minimization subsystem unless centered rank alignment demonstrably fails.

## Rejected Shortcuts

Do not:

- special-case `VS-010a`, `VS-010b`, “Billing Editing,” or “Billing Success”;
- force the shared leaf node or structural container to a matching height;
- move transition ports to arbitrary off-center coordinates solely to flatten this
  edge;
- mutate the final SVG path;
- make shared final repair optimize visual simplicity beyond its validation role;
- reintroduce ELK, Graphviz, Mermaid, or another external layout engine;
- weaken endpoint, orthogonality, terminal-leg, node-clearance, separation, or label
  invariants;
- change projection order or semantic edge identity; or
- refresh goldens to normalize a structurally worse experimental result.

## Required Regression Coverage

Add focused coverage before updating accepted artifacts:

1. A generic `layered` macro-layout test with two connected singleton ranks of unequal
   heights proves that `crossAlignment: "center"` centers the narrower rank and that
   `crossAlignment: "start"` remains top-aligned.
2. The same generic test proves rank order, layer gap, container bounds, and output are
   deterministic.
3. A multi-node-rank test proves centered rank placement preserves within-rank source
   order, configured gaps, and node non-overlap.
4. Compact and detailed UI Contracts integration tests prove
   `transitions_to:VS-010a->VS-010b` has equal endpoint Y coordinates and a two-point
   horizontal route.
5. UI transition tests retain exact endpoint identity, `transition_out` /
   `transition_in` port roles, arrow marker, semantic edge ID, and label text.
6. Existing cycle, fallback-state, disconnected, contract-lane, node-clearance,
   terminal-leg, label-clearance, and shared final-validation coverage remains green.
7. Repeated renders produce byte-identical positioned-scene and SVG output.
8. PNG remains rasterization of the accepted SVG.

Likely focused commands:

```bash
TMPDIR=/tmp pnpm exec vitest run tests/stagedMacroLayout.spec.ts
TMPDIR=/tmp pnpm exec vitest run tests/stagedUiContracts.spec.ts
TMPDIR=/tmp pnpm exec vitest run tests/stagedVisualAcceptance.spec.ts
TMPDIR=/tmp pnpm exec vitest run tests/previewWorkflow.spec.ts
TMPDIR=/tmp pnpm exec vitest run tests/renderedCorpus.spec.ts
TMPDIR=/tmp pnpm run build
```

Run `TMPDIR=/tmp pnpm test` only after focused layout, routing, and visual behavior is
accepted.

## Visual Proof Gate

Before changing UI Contracts renderer-stage goldens or public corpus artifacts:

1. render `place_viewstate_transition.sdd` in compact and detailed detail;
2. compare the current dogleg against the candidate direct route;
3. inspect the full transition graph, not only the affected edge;
4. confirm Billing Success is vertically balanced relative to Billing Editing;
5. confirm the transition label remains readable and strongly associated with its
   edge;
6. inspect `ui_state_fallback.sdd` in both details for unintended movement;
7. include at least one multi-node-rank or cycle proof;
8. confirm shared final validation emits no error; and
9. obtain explicit visual acceptance before refreshing artifacts.

The existing public artifacts are accepted evidence for the shared-node update even
though they retain this dogleg. A later routing/layout remediation may legitimately
change their geometry again, but that change needs its own proof and acceptance.

## Acceptance Criteria

The issue is resolved only when:

- `VS-010a -> VS-010b` renders as a direct horizontal transition in compact and
  detailed detail;
- the result follows from generic layered placement and normal port resolution rather
  than an edge-specific route override;
- the layered strategy demonstrably honors its declared cross-alignment contract;
- SCC rank assignment, stable order, layer spacing, and container bounds remain
  correct;
- multi-node ranks remain non-overlapping and readable;
- existing UI Contracts contract lanes, transition labels, cycles, fallback-state
  groups, and disconnected components do not regress;
- shared route repair and final validation remain active and clean;
- SVG is deterministic and PNG derives from the accepted SVG;
- focused and full suites pass; and
- proof SVGs and PNGs are visually accepted before goldens and public artifacts are
  refreshed.

## Stop Conditions

Stop and report instead of coding through the issue when:

- centered rank alignment creates a node overlap, new route crossing, or materially
  worse transition graph;
- the intended meaning of `crossAlignment` for layered ranks cannot be reconciled with
  stack/grid precedent;
- a proposed fix requires changing shared-node measurement;
- a semantic alignment rule appears necessary but cannot be represented through the
  bundle;
- shared final validation begins accepting a previously forbidden route condition;
- the implementation depends on proof IDs or coordinates; or
- goldens would need refreshing before the structural and visual gates pass.

## Future-Thread Checklist

1. Reproduce and lock the current compact/detailed dogleg before editing.
2. Add the generic unequal-height layered-rank tests.
3. Implement `crossAlignment` in `layoutLayeredContainer(...)` without UI terminology.
4. Opt UI transition graphs into centered rank alignment.
5. Run focused layout and UI suites.
6. Produce compact, detailed, fallback-state, and multi-rank visual proofs.
7. Stop for visual review.
8. Refresh UI Contracts goldens and public artifacts only after approval.
9. Run the complete repository suite and deterministic repeat-render checks.
10. Update this handoff from **open** to **resolved**, recording the accepted approach,
    proof artifacts, and test results.
