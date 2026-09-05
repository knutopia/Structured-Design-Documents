# Containment Hierarchy in UI Contracts Diagrams

**kg:**
Our current ui_contracts diagrams do not visualize containment relationships between components.

Please explore options for adding this capability to ui_contracts diagrams. Since the current diagrams display state- and viewState sequences and other details, this is not a simple addition.
Be aware that the "staged" renderer is the current and future-facing renderer.

Do not write any code.

**Deepseek-v4-pro-0813:**
I've completed a thorough exploration of the ui_contracts pipeline. Here is my analysis and the options for adding component containment visualization.

## Current state

The ui_contracts diagram already renders **some** containment, but only for a fixed, hardcoded subset of the hierarchy. The containment tree is built in `uiContractsRenderModel.ts` (`buildUiContractsRenderData`), which reads `COMPOSED_OF` and `CONTAINS` edges and produces a nested item tree (`Place → ViewState → Component`, plus `State`/support groups). The staged scene builder (`uiContracts.ts`) then turns that tree into nested `SceneContainer`s.

Critically, the containment that is *already* visualized is:

- `Place CONTAINS ViewState` → ViewState nested inside Place
- `Place COMPOSED_OF Component` → Component nested inside Place
- `ViewState COMPOSED_OF Component` → Component nested inside ViewState

The containment that is **not** visualized is:

- `Component CONTAINS Component` — explicitly dropped. In `buildUiContractsRenderData`, the hierarchy-edge loop only records `placeIds → viewStateIds` and `(placeIds | viewStateIds) → componentIds`. A `Component CONTAINS Component` edge is never captured, so nested components are flattened to siblings (or become root items).
- `Place CONTAINS Place` — also dropped (documented as "the staged renderer does not emit this hierarchy" in `hidden_edge_reference.md`).

This is confirmed by the bundle contract (`contracts.yaml`): `CONTAINS` allows `Component → Component` and `Place → Place`, and `COMPOSED_OF` allows `Place → Component` and `ViewState → Component`. So the *spec already permits* component containment — the renderer just doesn't consume it.

The `unified_node.sdd` attachment is exactly this scenario: `C-010 "Node" CONTAINS C-020 "Decorator Header"` and `C-040 "Node Body"`, which in turn `CONTAINS` further components. Today that whole tree would render flat.

## Why this is not a simple addition

The ui_contracts view is the most semantically overloaded of the staged renderers. A single `Place` container can simultaneously hold:

1. A **ViewState transition graph** (an `elk_layered` horizontal container of ViewState nodes with `TRANSITIONS_TO` edges).
2. **Component scopes** (vertical `stack` containers).
3. **State groups** (secondary transition graphs, `elk_layered`).
4. **Supporting contracts** (Event/DataEntity/SystemAction) in a reserved contract gutter.

The layout is chosen dynamically in `resolvePlaceLayout`: if a transition graph coexists with non-transition siblings, it switches to a 2-column `grid`; otherwise a vertical `stack`. Adding arbitrary component nesting means a component container could itself contain a transition graph, a state group, supporting contracts, *and* further nested components — i.e. the full "Place-like" layout logic would need to recurse into components, not just Places.

There are also two hard constraints from `AGENTS.md`:

- **Bundle authority**: any new machine-behavior convention must be expressed in `v0.1` and consumed generically. The current renderer hardcodes the containment matrix (`placeIds`, `viewStateIds`, `componentIds` and the specific `if (placeIds.has(from) && viewStateIds.has(to))` branches). Adding component nesting by extending those literal branches would violate the "no hidden TypeScript-only spec rules" rule. The bundle already has the data (`hierarchy_edges: [COMPOSED_OF, CONTAINS]` and the `allowed_endpoints` in `contracts.yaml`), but the render model doesn't consume it generically.
- **Staged renderer is the target**: the legacy DOT/Mermaid paths are `LEGACY`. Any change must land in the staged path (`RendererScene → MeasuredScene → PositionedScene → SVG`), and must not leak layout/geometry into projection.

## Options

### Option A — Generic hierarchy consumption in the render model (recommended)

Replace the hardcoded containment matrix in `buildUiContractsRenderData` with a generic, bundle-driven hierarchy walk, mirroring what `iaPlaceMapRenderModel.ts` already does.

- Read `hierarchy_edges` from the view spec (already `[COMPOSED_OF, CONTAINS]`) instead of literal edge-type checks.
- Build a `structuralParentByChildId` map from *all* projected hierarchy edges (first-parent-wins, like IA does), rather than the current type-pair-specific maps.
- Make `UiContractsComponentItem.childItems` accept nested `UiContractsComponentItem` (and `ViewStateItem`/`StateGroupItem`), so a component can contain components.
- Reuse `getSourceOrderedStructuralStream` (already imported) to order nested children by author order.

**Pros**: removes a hidden hardcoded rule; makes `Component CONTAINS Component` (and `Place CONTAINS Place`) fall out of the same generic path; aligns with the bundle-authority policy; reuses proven IA machinery.

**Cons**: the *scene builder* still needs to decide how to lay out a component that now contains a transition graph + nested components + supporting contracts. This is the real work — see Option C.

### Option B — Extend the bundle contract explicitly

If component containment should be a *distinct* visual treatment (e.g. a "component tree" inset rather than full Place-like nesting), add a new `renderer_defaults` convention to `views.yaml` (e.g. a `component_containment` policy with `render_mode: inset | nested | hidden` and per-detail-display toggles), then consume it in the render model.

**Pros**: keeps the decision traceable to the bundle; lets `compact` vs `detailed` differ (e.g. collapse nested components in compact, expand in detailed); matches the existing `detail_display` pattern (`show_secondary_state_groups_when_primary_view_state`, etc.).

**Cons**: more surface area; requires deciding the semantics of the new convention before coding.

### Option C — Scene-builder layout strategy for nested components

This is the unavoidable companion to A or B. The staged scene builder must decide how a component container lays out its children when they include a transition graph and/or nested components. Sub-options:

- **C1 — Reuse `resolvePlaceLayout` recursively.** Treat a component-with-children like a Place: if it has a transition graph + non-transition siblings, use the 2-column grid; else vertical stack. Lowest effort, but risks visual ambiguity between "Place scope" and "Component scope" and may produce very deep, wide nesting.
- **C2 — Dedicated "component tree" inset.** Render nested components as a distinct inset cluster (e.g. a `component_tree` role with its own chrome/theme class), keeping the transition graph and supporting contracts in the parent scope. This matches the `unified_node.sdd` mental model (a component with sub-components) and avoids overloading the Place layout.
- **C3 — Collapse-by-default with a detail toggle.** In `compact`, flatten nested components (current behavior); in `detailed`, expand them. This is the lowest-risk incremental step and can be gated behind a bundle `detail_display` flag.

## Key risks / open questions

1. **Layout recursion depth.** The staged macro-layout (`macroLayout.ts`) already recurses containers, so deep nesting is technically supported — but the *scene builder* currently only emits transition graphs at the Place level (`buildScopedSceneItems`). Making components emit transition graphs requires generalizing that logic, which is the highest-risk part.

2. **Edge routing across nested scopes.** `buildSemanticRenderableEdges` already filters out `COMPOSED_OF`/`CONTAINS` and resolves container endpoints. Nested components would need their `contract_out`/`contract_in` ports and the contract gutter to work at arbitrary depth, not just one level under Place/ViewState.

3. **Bundle-authority test.** Per `AGENTS.md`, the feature is only "complete" when a reviewer can point to (a) the bundle file encoding the behavior, (b) the runtime path consuming it, and (c) tests proving behavior depends on bundle content. Option A alone (generic consumption) satisfies this for *which* edges are hierarchy; Option B is needed if the *visual treatment* is a new convention.

4. **Proof case.** The `unified_node.sdd` attachment (and the `grafsys.sdd` experiments, which contain real `Component CONTAINS Component` trees) are the natural proof cases. Per the quality rules, get one of these right before regenerating goldens.

## Recommendation

Pursue **Option A + C3 first** (generic hierarchy consumption, with nested components collapsed in `compact` and expanded in `detailed`), gated by a new `detail_display` flag added via **Option B** if the visual treatment needs to be bundle-owned. This is the smallest change that removes the hidden hardcoded rule and makes `Component CONTAINS Component` render, while deferring the harder "component-as-full-scope" layout (C1/C2) until the proof case shows it's needed.

The single most important prerequisite is **not** the renderer code — it's deciding, in the bundle, whether component containment is a *structural nesting* (reuse existing hierarchy semantics) or a *new visual convention* (needs a new `renderer_defaults` entry). That decision determines whether this is a render-model refactor or a bundle-contract extension.

Would you like me to dig deeper into any specific option — for example, trace exactly how `resolvePlaceLayout` and the contract gutter would need to generalize for nested components, or draft the bundle `renderer_defaults` shape for a component-containment policy?