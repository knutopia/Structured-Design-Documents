# Renderer Migration Guidance

## Purpose

This document directs renderer work while the SDD language remains at `v0.1`.

The goal is to improve rendering quality without destabilizing the language, bundle, compiler, validator, projection contracts, or contributor documentation.

This document now defines the target renderer architecture in enough detail to ground future implementation planning.

## Current Position

- `bundle/v0.1/` remains the machine-readable source of truth for tooling.
- The SDD language remains at `v0.1` with no language expansion during this renderer migration stream.
- Rendering pipeline work is not versioned yet.
- Rendering improvements should proceed as incremental git commits until the result is mature enough to justify formal versioning.
- Existing internal DOT and Mermaid renderers remain available until replacement paths are proven.

## Locked Decisions

1. Do not introduce `bundle/v0.2` or a new language version for renderer-only changes.
2. Do not treat renderer backend changes as language changes.
3. Keep parsing, compilation, validation, and projection semantics stable unless a separate explicit decision is made.
4. Keep projection as the semantic boundary between the graph model and rendering technology.
5. Introduce the new grid-oriented renderer in parallel with legacy renderers before replacing defaults.
6. Prefer backend/status naming such as `legacy_dot`, `legacy_mermaid`, `grid_renderer`, or `experimental_svg` over version-shaped renderer labels.
7. Treat text measurement and text wrapping as shared renderer infrastructure, not as view-by-view heuristics.

## Target Architecture

### Preserve the existing semantic spine

The core pipeline remains conceptually intact:

1. `loadBundle`
2. `parseSource`
3. `compileSource`
4. `validateGraph`
5. `projectView`
6. render from projection

Renderer work must not push new layout concerns into parsing, compilation, or validation.

### Add explicit renderer stages after projection

The renderer should no longer jump directly from projection to a backend emitter.

The target internal pipeline is:

1. projection
2. scene construction
3. micro-layout and measurement
4. macro-layout and routing
5. vector artifact generation
6. rasterization, when requested

These stages are intentionally separate because they solve different problems:

- scene construction maps view semantics onto reusable renderer primitives
- micro-layout sizes content and resolves text wrapping
- macro-layout places nodes, containers, and connectors in 2D space
- vector generation paints a styled SVG from already-positioned elements
- rasterization derives PNG from SVG rather than becoming a parallel rendering system

### Internal forms

The renderer migration introduces three new internal forms after projection:

1. `RendererScene`
2. `MeasuredScene`
3. `PositionedScene`

They are internal contracts, not new public CLI outputs.

#### Projection

Projection remains the semantic input contract.

Projection continues to own:

- view scope
- derived annotations
- node groups
- omissions
- projection notes

Projection does not own:

- node pixel dimensions
- line wrapping
- edge polylines
- absolute x/y placement
- SVG structure

#### RendererScene

`RendererScene` is the first renderer-owned form.

Its job is to translate projection semantics into reusable visual primitives without choosing final coordinates.

`RendererScene` should capture:

- stable element ids
- hierarchical containers
- optional container header content blocks for containers that render labeled chrome
- primitive kinds such as `card`, `cluster`, `lane`, `header`, `badge`, `edge_label`
- semantic class tags and theme roles
- ordered child relationships
- declared ports and anchor roles
- edge declarations with routing preferences
- layout strategy declarations per container
- width policy, overflow policy, and text style references

`RendererScene` must not contain:

- character-count width guesses
- final line breaks
- final node width/height
- final x/y positions
- backend-specific syntax such as ELK JSON or SVG strings

#### MeasuredScene

`MeasuredScene` is the result of micro-layout.

Its job is to resolve intrinsic content size before any global placement happens.

`MeasuredScene` should capture:

- exact node width and height
- wrapped text lines per text block
- measured container header blocks and any header-band height growth they require
- resolved header, subtitle, badge, and metadata block sizes
- container chrome size such as padding, label bar height, and internal gutters
- resolved port offsets relative to local node bounds
- overflow status such as `fits`, `clamped`, or `escalated_width_band`

At this stage the renderer knows how large things are, but not where they go globally.

#### PositionedScene

`PositionedScene` is the result of macro-layout and routing.

Its job is to produce absolute geometry for final painting.

`PositionedScene` should capture:

- absolute x/y positions for every container and node
- final width and height for every element
- routed edge geometry as polylines or path segments
- final edge-label positions
- z-order and paint grouping information needed by the SVG backend

### Suggested contract shape

The exact type names may change, but the architecture should converge on a shape close to:

```ts
interface RendererScene {
  viewId: string;
  profileId: string;
  themeId: string;
  root: SceneContainer;
  edges: SceneEdge[];
  diagnostics: RendererDiagnostic[];
}

interface SceneContainer {
  id: string;
  role: string;
  primitive: "root" | "cluster" | "lane" | "stack" | "grid";
  classes: string[];
  layout: LayoutIntent;
  children: SceneItem[];
  chrome: ChromeSpec;
}

interface SceneNode {
  id: string;
  role: string;
  primitive: "card" | "header" | "badge" | "label";
  classes: string[];
  content: ContentBlock[];
  ports: PortSpec[];
  widthPolicy: WidthPolicy;
  overflowPolicy: OverflowPolicy;
}

interface MeasuredNode {
  id: string;
  width: number;
  height: number;
  contentBlocks: MeasuredContentBlock[];
  ports: MeasuredPort[];
  overflow: OverflowResult;
}

interface PositionedNode extends MeasuredNode {
  x: number;
  y: number;
}
```

The important point is the boundary, not the exact spelling.

## Shared renderer primitives

The new renderer should not let each view invent bespoke visual logic for common diagram elements.

The renderer should define a small shared primitive library, such as:

- `card`
- `cluster`
- `lane`
- `header`
- `badge`
- `annotation_list`
- `edge_label`
- `connector_port`

Each primitive should come with:

- typography tokens
- padding tokens
- corner radius and stroke tokens
- width-band policy
- overflow policy
- internal content flow rules

Views then map semantic concepts onto these shared primitives:

- IA places and journey steps can both use `card`
- area shells, stages, and scoped UI state groups can all use `cluster`
- service blueprint rows and journey phases can both use `lane`

This is the main defense against one-off renderer logic.

## Text measurement and micro-layout

### Make micro-layout a first-class subsystem

Text sizing, text wrapping, and internal node composition must be solved before ELK is invoked.

This should be implemented as a shared micro-layout engine that:

- measures text using the same font assets used for final rendering
- resolves line breaks using actual text measurement, not character counts
- computes intrinsic block heights from line count and theme tokens
- lays out internal node content such as title, subtitle, badges, metadata, and footers
- produces explicit overflow results instead of silently clipping

Micro-layout is where the renderer decides:

- how many lines a title occupies
- whether metadata stays inline or moves to a footer band
- whether a node should step up from `narrow` to `standard` width
- whether text is clamped with ellipsis after all allowed width bands are exhausted

Micro-layout is not allowed to decide:

- global node ordering
- container placement
- edge routing

### Use width bands, not arbitrary widths

To keep output deterministic and designerly, node widths should come from a small shared set of width bands rather than continuous free sizing.

Examples:

- `chip`
- `narrow`
- `standard`
- `wide`

The measurement flow for a text-bearing primitive should be:

1. choose the preferred width band for the primitive role
2. measure and wrap content at that width
3. compute resulting height and chrome
4. if the result violates a policy, escalate to the next allowed width band
5. if all allowed width bands fail, apply the declared overflow policy

This keeps sizing policy explicit and reusable instead of turning into special cases.

### Overflow must be explicit

Every text-bearing primitive should declare an overflow policy.

Allowed outcomes include:

- grow taller
- escalate width band
- clamp to a maximum line count with ellipsis
- move low-priority metadata into a secondary area
- emit a render diagnostic

The renderer must never silently let text collide with borders or adjacent content.

### Measurement backend guidance

The architecture should expose a `TextMeasurementService` boundary.

The preferred behavior is:

- real font-based measurement
- deterministic output across contributor environments
- shared font assets between measurement and final rendering

A browser-grade measurement pass is acceptable if the runtime is pinned and the fonts are vendored. A pure Node measurement backend is also acceptable if it preserves the same contract.

The measurement implementation may change later. The architecture boundary must not.

## Macro-layout and routing

### Treat ELK as a macro-layout engine, not as the renderer architecture

ELK should be used where it is strong:

- layered node placement
- orthogonal routing
- explicit ports
- hierarchical graph layout
- subgraph and container layout

ELK should not become the renderer scene format or the source of truth for text composition.

The SDD renderer should own its own scene forms and translate only the relevant subgraphs into ELK input when needed.

### Support multiple container layout strategies

Not every view should be solved by one global ELK pass.

The macro-layout layer should support a strategy registry for containers, with strategies such as:

- `stack`
- `grid`
- `lanes`
- `elk_layered`
- `elk_force`, only if a view genuinely benefits from it

Each container chooses its strategy through scene construction.

This allows hybrid layouts:

- a service blueprint root may use `lanes`
- a journey phase strip may use `grid`
- a scenario branch cluster may use `elk_layered`
- an IA root may use `elk_layered` while area interiors use `stack`

This is a feature, not an inconsistency. Different diagram regions have different structural needs.

### Layout should be recursive

Macro-layout should operate recursively over the scene tree:

1. measure children first
2. place child containers using their declared layout strategy
3. reserve container chrome and padding
4. compute container bounds
5. route connectors once node positions are known

This allows a container to be laid out independently before it becomes an item inside its parent.

### Ports and anchors are first-class

Every node that participates in connector routing should expose named ports or anchors.

Examples:

- `north`
- `south`
- `east`
- `west`
- `primary_out`
- `primary_in`
- `lane_entry`
- `lane_exit`

Scene builders declare which ports exist and what semantic role they serve.

Micro-layout computes the local offsets of those ports.

Macro-layout chooses which declared ports each edge uses and then routes accordingly.

Those ports are semantic routing anchors, not default visual decoration. Normal staged SVG output should keep ordinary node/container ports hidden unless a view explicitly uses a visible `connector_port` primitive.

### Routing policy belongs to the layout layer

The scene builder should declare routing preferences, not actual polylines.

Examples:

- `orthogonal`
- `straight`
- `stepped`
- `avoid_node_boxes`
- `prefer_vertical_entry`
- `bendPlacement: target_bias`

The routing system then resolves those preferences after placement.

Shared routing policy should also reserve a minimum readable terminal leg for arrow-ended routes when geometry allows, instead of leaving arrowheads cramped against a final bend.

ELK may route edges inside ELK-managed containers. Shared router logic may route edges for manual `grid` or `lanes` containers. The important point is that routing remains a shared subsystem rather than being embedded in individual view emitters.

## View responsibilities

### Projection builders

Projection builders continue to own semantic derivation:

- what nodes and edges are in scope
- what groups exist
- what annotations exist
- what omissions and notes should be emitted

Projection builders do not own pixel geometry.

### View scene builders

Each renderable view should have one scene builder that maps projection semantics onto shared primitives and layout strategies.

The scene builder owns:

- primitive choice
- container nesting
- ordering hints
- edge routing preferences
- style roles and class tags
- width-band and overflow policy selection

The scene builder does not own:

- direct text measurement
- direct x/y placement
- direct SVG string assembly

### Shared renderer infrastructure

Shared renderer infrastructure owns:

- theme tokens
- text measurement
- micro-layout
- macro-layout strategy registry
- ELK adapter
- routing
- SVG backend
- PNG derivation

This is the core architectural shift. View code should select from shared infrastructure, not reimplement it.

## Backend rendering

### SVG is the first-class artifact backend

The new renderer's primary artifact backend should be SVG.

SVG generation should consume `PositionedScene` and should own:

- shape emission
- marker and arrowhead definitions
- normal visibility policy for semantic routing anchors
- layer ordering
- text element emission from already-wrapped lines
- CSS class injection
- embedded or linked style blocks as required by the preview path

SVG generation must not own:

- semantic derivation
- text wrapping decisions
- global layout
- routing decisions

### PNG remains derived from SVG

PNG should remain a rasterization step derived from SVG, not a separate scene renderer.

This preserves one vector truth source and reduces parity bugs.

### DOT and Mermaid remain separate internal backends

Internal DOT and Mermaid output remain useful as:

- compatibility outputs
- readable textual artifacts for debugging
- regression references during migration

They should remain separate text backends rather than forcing the new scene contract to mimic either syntax.

## Theme and style system

The renderer should use explicit theme tokens for anything that affects measurement or placement.

That includes:

- font family
- font size
- font weight
- line height
- card padding
- cluster padding
- grid unit
- lane gutter
- stroke width
- border radius
- arrow size
- minimum marker-leg clearance

Measurement and final rendering must use the same theme revision and the same font assets.

Scene items should carry semantic class tags and theme roles, not raw inline style decisions.

## Diagnostics and determinism

### Determinism requirements

Deterministic output remains a feature, not a side effect.

The new renderer should preserve:

- stable scene ordering
- stable measurement ordering
- stable layout ordering
- stable routing ordering
- stable SVG serialization ordering
- stable theme token resolution
- canonical `LF` newlines for any stored text artifacts

### Renderer diagnostics

The new renderer should emit structured diagnostics for renderer-specific failures or degraded output, including:

- unsupported primitive combinations
- text clamping
- overflow that exceeded allowed policies
- unresolved port references
- layout strategy failures
- routing fallbacks

These are renderer diagnostics, not validation diagnostics.

## View-specific guidance

The architecture must support different views choosing different layout mixes.

Recommended bias by view:

- `service_blueprint`: if ELK is used, let `ELK Layered` own final node placement and final routing in the same run; do not snap lane rows after layout and do not rely on renderer-side routing fallback
- `journey_map`: prefer lane or strip layout for phases, with routing support for cross-phase references
- `ia_place_map`: use hierarchical containers, explicit ports, and manual hub/follower grouping; let owned child scopes and follower scopes grow parent geometry bottom-up, then route only local structure connectors with deterministic direct-vertical and shared-trunk patterns
- `scenario_flow`: likely benefits most from `elk_layered` plus explicit decision-node port policy
- `outcome_opportunity_map`: may mix semantic lanes with ELK-managed routing between lane-contained nodes
- `ui_contracts`: likely benefits from manual scoped containers, reserved gutter space plus dedicated label lanes for container-origin contract edges, and selective ELK use for transition routing

The point is not to assign one universal engine to every view. The point is to let each view reuse the same renderer contracts while choosing the right layout strategies.

## Implementation planning anchors

Future implementation planning should organize work around these architectural workstreams:

1. Define the internal renderer contracts: `RendererScene`, `MeasuredScene`, `PositionedScene`, renderer diagnostics, and theme tokens.
2. Build the shared primitive library and micro-layout engine, including width-band policy, overflow policy, and real text measurement.
3. Build the macro-layout strategy registry, including at minimum `stack`, `grid`, `lanes`, and an ELK adapter for `elk_layered`.
4. Build the SVG backend against `PositionedScene`, with CSS class emission and shared marker definitions.
5. Refactor CLI preview handling so preview generation is backend-aware rather than DOT-hardwired.
6. Prove the architecture on a view that already has explicit row or lane semantics before expanding broadly.
7. Expand view by view, keeping parallel legacy outputs until the new backend is clearly better for that view.

These workstreams are the planning backbone. Individual commits and implementation slices can vary, but they should not undermine the stage boundaries defined above.

## Documentation discipline

Renderer migration must be documented as it happens.

When major renderer decisions land:

- update `docs/toolchain/architecture.md`
- update `docs/toolchain/decisions.md`
- update `docs/toolchain/development.md`
- keep `Readme.md` accurate about the current default renderer path and known limitations

If a renderer decision changes architecture rather than just implementation detail, add an explicit repo-local decision record or migration note before or with the code change.

## Naming guidance

While rendering is not versioned separately, avoid naming that implies a new language version.

Prefer names based on:

- backend technology
- migration status
- artifact type

Avoid names based on:

- `v0.2` when the language is still `v0.1`
- implied spec changes that do not exist
- generic names that hide whether something is legacy or experimental

## Testing guidance

### Keep existing contracts stable

The following should remain stable unless explicitly changed:

- compiled graph snapshots
- validation behavior
- projection snapshots

### Add renderer-stage contracts

For the new backend, add deterministic tests for:

- scene construction snapshots
- measured-scene snapshots
- positioned-scene snapshots
- backend artifact generation
- stable ordering of placed elements and connectors
- renderer diagnostics
- CLI preview routing

### Keep parallel corpora when needed

If the new renderer produces materially different outputs, keep separate artifact sets by backend inside the existing `v0.1` language context rather than inventing a new language version.

### Add human visual review

Rendering quality is not purely a conformance problem.

Use reviewer-friendly outputs and explicit visual checks for:

- readability
- label collisions
- text clamping frequency
- grid consistency
- connector clarity
- diagram usefulness as a communication artifact

## Non-goals for this migration stream

- changing `.sdd` syntax
- expanding the v0.1 node or relationship vocabulary
- introducing `bundle/v0.2`
- replacing all renderers in one step
- pushing layout semantics into compiler or validator logic
- letting ELK JSON become the public or primary renderer contract
- treating backend experimentation as a spec change before it is proven

## Exit condition for future versioning

Rendering should remain incrementally evolved until there is a clear reason to version it formally.

That threshold is reached only when one or more of these become true:

- the renderer introduces a stable contract worth exposing publicly
- the bundle needs new machine-readable rendering semantics that affect interoperability
- multiple backends or tools need a shared formal layout/schema contract
- the migration has settled enough that versioned documentation would reduce confusion rather than create it

Until then, prefer steady incremental commits over premature renderer versioning.
