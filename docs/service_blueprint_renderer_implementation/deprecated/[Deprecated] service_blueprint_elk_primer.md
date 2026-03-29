# [Deprecated] ELK Primer For `service_blueprint`

This note is a focused primer on how [`elkjs`](https://github.com/kieler/elkjs) and the ELK reference can be used to draw a `service_blueprint` diagram.

It is intentionally renderer-architecture-agnostic. The question here is not "how should this repo wire ELK into its staged pipeline?" but simply:

- How does ELK think about layout?
- Which ELK mechanisms map well to service blueprints?
- Which options, graph conventions, and API calls are most relevant?
- Where is ELK strong, and where will a service-blueprint-specific convention still be needed?

## The Example We Are Grounding On

The sample [`service_blueprint_slice.sdd`](/home/knut/projects/sdd/examples/rendered/v0.1/journey_map_diagram_type/service_blueprint_slice_example/service_blueprint_slice.sdd) has:

- a primary customer lane: `J-020 -> J-021`
- operational lanes: `frontstage`, `backstage`, `support`
- derived support lanes: `system`, `policy`
- cross-lane relations such as `REALIZED_BY`, `DEPENDS_ON`, `CONSTRAINED_BY`, `READS`, and `WRITES`

The existing derived lane order in the current projection snapshot is:

1. `customer`
2. `frontstage`
3. `backstage`
4. `support`
5. `system`
6. `policy`

That is already close to a classic service-blueprint mental model: fixed horizontal lanes, with left-to-right progression expressing time / sequence / concurrency bands.

## Short Version

ELK can help a lot with `service_blueprint`, but not because it has a native "service blueprint" or "swimlane grid" algorithm. It helps because:

- `ELK Layered` is very good at left-to-right directed graphs with ports and orthogonal routing.
- it can return bend points and edge sections directly in JSON
- it supports compound graphs and cross-hierarchy edges
- it has useful ordering controls: model order, in-layer predecessor/successor constraints, port order, and semi-interactive ordering

The main caution is equally important:

- ELK Layered optimizes a directed graph, not a strict row-and-column blueprint grid.
- exact slot columns and exact lane rows are not first-class ELK concepts.
- if a service blueprint must look like a rigid grid, ELK alone should not be treated as a magic swimlane engine.

So the most realistic ELK usage patterns are:

1. ELK owns left-to-right ordering and orthogonal routes, while service-blueprint conventions own lane rows.
2. ELK owns compound-lane layout and cross-lane routing, but the blueprint must accept that lanes are still ordinary graph objects, not sacred fixed swimlanes.
3. A hybrid approach uses ELK mostly for routing and ordering hints, while blueprint-specific logic preserves the visual grid.

## The ELK Mental Model

ELK's JSON model is simple and important. A graph contains:

- `children`: nodes
- `ports`: attachment points on node borders
- `edges`: connections between nodes or ports
- `sections`: routed edge geometry after layout
- `layoutOptions`: key-value options on graphs, nodes, ports, edges, and labels

The official JSON format docs are here:

- [ELK JSON Format](https://eclipse.dev/elk/documentation/tooldevelopers/graphdatastructure/jsonformat.html)
- [ELK Coordinate System](https://eclipse.dev/elk/documentation/tooldevelopers/graphdatastructure/coordinatesystem.html)

Important consequences for `service_blueprint`:

- Every visible slot can be represented as an ELK node with `width` and `height`.
- Each node can expose multiple semantic ports, which is extremely useful for separating primary flow from support / dependency / policy edges.
- Edge routing comes back as `sections` with `startPoint`, `endPoint`, and `bendPoints`.
- Labels are part of the graph model too, but ELK generally does not size text for you. If you use ELK labels, you should provide reasonable label sizes up front.

## The Best-Fit Algorithm

The relevant algorithm is [`org.eclipse.elk.layered`](https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html).

Why this one fits:

- ELK's own docs describe it as the flagship algorithm for directed node-link diagrams with ports.
- The algorithm explicitly supports:
  - ports
  - orthogonal routing
  - edge labels
  - compound graphs
  - cross-hierarchy edges when hierarchy handling is enabled

For a service blueprint, that maps naturally to:

- left-to-right time flow
- fixed or semi-fixed entry/exit sides on slots
- orthogonal dogleg connectors between lanes
- optional lane compounds

## Base `elkjs` Call Shape

`elkjs` is not a rendering framework. It computes positions and route geometry and returns a laid-out JSON graph.

Official API entry points are in the [`elkjs` README](https://github.com/kieler/elkjs/blob/master/README.md):

- `new ELK()`
- `await elk.layout(graph, options?)`
- `await elk.knownLayoutOptions()`
- `await elk.knownLayoutAlgorithms()`

Minimal call pattern:

```js
import ELK from "elkjs";

const elk = new ELK();

const graph = {
  id: "root",
  layoutOptions: {
    "elk.algorithm": "layered",
    "elk.direction": "RIGHT",
    "elk.edgeRouting": "ORTHOGONAL"
  },
  children: [
    { id: "J-020", width: 180, height: 72 },
    { id: "PR-020", width: 180, height: 72 }
  ],
  edges: [
    { id: "e1", sources: ["J-020"], targets: ["PR-020"] }
  ]
};

const laidOut = await elk.layout(graph);
```

Good "default starting point" options for blueprint work:

```js
{
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.edgeRouting": "ORTHOGONAL",
  "elk.separateConnectedComponents": "false",
  "elk.padding": "[left=24,top=24,right=24,bottom=24]",
  "elk.spacing.nodeNode": "24",
  "elk.layered.spacing.nodeNodeBetweenLayers": "72",
  "elk.spacing.edgeNode": "18",
  "elk.layered.spacing.edgeNodeBetweenLayers": "18",
  "elk.spacing.edgeEdge": "12",
  "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
  "elk.layered.crossingMinimization.forceNodeModelOrder": "true",
  "elk.layered.considerModelOrder.portModelOrder": "true",
  "elk.layered.nodePlacement.favorStraightEdges": "true"
}
```

What those do:

- `direction=RIGHT`: primary blueprint flow goes left to right.
- `edgeRouting=ORTHOGONAL`: routes become Manhattan-style segments.
- `separateConnectedComponents=false`: disconnected pieces stay part of one composed diagram instead of drifting apart as separate sub-layouts.
- spacing options: create readable corridors between cells and between columns.
- model-order options: preserve author / input order unless ELK must change it to avoid crossings.
- `favorStraightEdges=true`: biases toward straighter timeline-like flow.

## The Most Important ELK Primitives For Blueprinting

### 1. Nodes As Slots

The cleanest ELK abstraction is:

- one visible blueprint slot = one ELK node

That node should already know:

- its lane
- its semantic kind (`Step`, `Process`, `SystemAction`, `Policy`, `DataEntity`)
- its measured size
- whether it participates in the main left-to-right storyline or is mainly an auxiliary support node

### 2. Ports As Semantic Edge Channels

Ports are where ELK becomes much more useful than DOT for this diagram type.

Relevant options:

- [`org.eclipse.elk.portConstraints`](https://eclipse.dev/elk/reference/options/org-eclipse-elk-portConstraints.html)
- [`org.eclipse.elk.port.side`](https://eclipse.dev/elk/reference/options/org-eclipse-elk-port-side.html)
- [`org.eclipse.elk.port.index`](https://eclipse.dev/elk/reference/options/org-eclipse-elk-port-index.html)
- [`org.eclipse.elk.layered.portSortingStrategy`](https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-portSortingStrategy.html)
- [`org.eclipse.elk.layered.allowNonFlowPortsToSwitchSides`](https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-allowNonFlowPortsToSwitchSides.html)

Recommended convention:

- set each node to `FIXED_ORDER` or `FIXED_SIDE`
- reserve `WEST` and `EAST` ports for primary left-to-right flow
- reserve `NORTH` and `SOUTH` ports for vertical or diagonal support edges
- assign `port.index` if the order of multiple ports on the same side matters

Example:

```js
{
  id: "PR-020",
  width: 180,
  height: 72,
  layoutOptions: {
    "elk.portConstraints": "FIXED_ORDER"
  },
  ports: [
    {
      id: "PR-020:flow-in",
      layoutOptions: { "elk.port.side": "WEST", "elk.port.index": "0" }
    },
    {
      id: "PR-020:flow-out",
      layoutOptions: { "elk.port.side": "EAST", "elk.port.index": "1" }
    },
    {
      id: "PR-020:up",
      layoutOptions: { "elk.port.side": "NORTH", "elk.port.index": "2" }
    },
    {
      id: "PR-020:down",
      layoutOptions: {
        "elk.port.side": "SOUTH",
        "elk.port.index": "3",
        "elk.layered.allowNonFlowPortsToSwitchSides": "false"
      }
    }
  ]
}
```

This is one of the most important `service_blueprint` conventions an LLM should internalize:

- primary flow is not "just another edge"
- cross-lane support edges should not all fight for the same anonymous node boundary
- explicit ports are how you keep entry and exit geometry legible

### 3. Edge Sections As Route Geometry

ELK JSON returns routed edges as `sections` with bend points. That is the main output a blueprint renderer wants.

See:

- [JSON format: edges and sections](https://eclipse.dev/elk/documentation/tooldevelopers/graphdatastructure/jsonformat.html)
- [Coordinate system rules](https://eclipse.dev/elk/documentation/tooldevelopers/graphdatastructure/coordinatesystem.html)

Useful options when consuming JSON output:

- [`org.eclipse.elk.json.shapeCoords`](https://eclipse.dev/elk/reference/options/org-eclipse-elk-json-shapeCoords.html)
- [`org.eclipse.elk.json.edgeCoords`](https://eclipse.dev/elk/reference/options/org-eclipse-elk-json-edgeCoords.html)

If you want simpler downstream consumption, ask ELK for root-relative coordinates:

```js
{
  "elk.json.shapeCoords": "ROOT",
  "elk.json.edgeCoords": "ROOT"
}
```

Without that, many coordinates are relative to parents or edge containers, which is correct but more cumbersome.

## Three ELK Modeling Strategies For `service_blueprint`

### Strategy A: Flat Graph, ELK Owns Columns

Model every visible slot as a direct child of the root graph.

Use:

- `elk.direction=RIGHT`
- explicit ports
- strong model-order hints
- orthogonal routing

When this works well:

- the blueprint is basically a directed acyclic graph with a recognizable left-to-right storyline
- the x-axis should be driven mostly by graph semantics
- the exact y-coordinate of each node does not need to be a rigid swimlane row until after layout

Benefits:

- simplest ELK graph
- easiest routing output
- easiest use of ports and orthogonal sections
- easy to give primary storyline edges higher importance

Risks:

- ELK will not naturally understand "customer is always row 1, frontstage is always row 2, ..."
- y-order may still need blueprint-specific snapping or normalization

This is the best option if the goal is:

- "let ELK decide the concurrency columns"

### Strategy B: Compound Lanes, ELK Owns Cross-Lane Layout Too

Model each lane as a compound parent node, with slot nodes as its `children`.

Important option:

- [`org.eclipse.elk.hierarchyHandling=INCLUDE_CHILDREN`](https://eclipse.dev/elk/reference/options/org-eclipse-elk-hierarchyHandling.html)

Why:

- the ELK docs explicitly say including multiple hierarchy levels in one layout run helps with cross-hierarchical edges
- `ELK Layered` explicitly supports compound graphs and cross-hierarchy edges

Benefits:

- lane membership is explicit in the graph model
- ELK can route edges that cross lane boundaries in one global run
- hierarchy-crossing edges can use ELK's own hierarchical-port handling

Risks:

- ELK still treats lane containers as graph objects in a layered layout, not as sacred swimlane stripes
- a single layered run has one dominant direction, so "vertical lanes containing horizontal children" is not a built-in blueprint mode
- you may still need conventions to keep lanes visually lane-like

Practical local finding from quick `elkjs` 0.11.1 experiments in this repo:

- `INCLUDE_CHILDREN` does give routed cross-hierarchy edges
- but it also makes ELK optimize the compound graph as one layered problem, which means lane containers behave like ordinary layout participants rather than fixed blueprint rows

This strategy is best if the priority is:

- "ELK should understand that lanes are real semantic groups"

### Strategy C: Hybrid Blueprint Grid, ELK Owns Ordering And Route Hints

This is often the most realistic service-blueprint use of ELK.

The idea:

- blueprint conventions decide lane rows
- blueprint conventions may also decide rough or exact slot columns
- ELK is used to:
  - preserve left-to-right order
  - reduce crossings
  - produce orthogonal route sections
  - honor port geometry

Why this is realistic:

- ELK Layered is excellent at route-aware ordering
- ELK Layered is not a dedicated swimlane grid engine
- the ELK docs do not offer arbitrary "put this node into exact row R and exact column C" as the normal direct `elk.layout(...)` workflow

Two especially relevant facts from the docs:

- `layerConstraint` only offers coarse placement (`FIRST`, `FIRST_SEPARATE`, `LAST`, `LAST_SEPARATE`) rather than arbitrary column assignment
- `layerChoiceConstraint` and `positionChoiceConstraint` are documented as interactive-visitor features, not part of the default layered configuration path

That makes a hybrid ELK story very natural for service blueprints:

- use ELK to solve graph-theoretic pain
- use blueprint conventions to preserve the human reading structure

## Ordering Controls That Matter A Lot

### Preserve author order where possible

Relevant options:

- [`org.eclipse.elk.layered.considerModelOrder.strategy`](https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-considerModelOrder-strategy.html)
- [`org.eclipse.elk.layered.crossingMinimization.forceNodeModelOrder`](https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-crossingMinimization-forceNodeModelOrder.html)
- [`org.eclipse.elk.layered.considerModelOrder.portModelOrder`](https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-considerModelOrder-portModelOrder.html)

These are very attractive for `service_blueprint` because author order often already encodes intended chronology.

### Force nodes into the same layer

Relevant options:

- [`org.eclipse.elk.layered.crossingMinimization.inLayerPredOf`](https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-crossingMinimization-inLayerPredOf.html)
- [`org.eclipse.elk.layered.crossingMinimization.inLayerSuccOf`](https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-crossingMinimization-inLayerSuccOf.html)

These are useful when several lane-local nodes should sit in the same concurrency band.

This is an important pattern for blueprints:

- use the graph structure to establish columns
- then use in-layer constraints to keep intended peers together

### Semi-interactive ordering from current positions

Relevant options:

- [`org.eclipse.elk.layered.crossingMinimization.semiInteractive`](https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-crossingMinimization-semiInteractive.html)
- [`org.eclipse.elk.position`](https://eclipse.dev/elk/reference/options/org-eclipse-elk-position.html)

The docs say semi-interactive crossing minimization derives desired order from `org.eclipse.elk.position`.

Practical local finding:

- in a quick `elkjs` experiment, `semiInteractive=true` did preserve the order of nodes within a layer based on provided positions

That makes semi-interactive layout a promising tool if a blueprint system already knows:

- the intended lane order
- the intended order of nodes within a column

It should not be treated as "full fixed grid layout", but it is a strong hinting mechanism.

## How To Treat Different Edge Families

A service blueprint usually has more than one edge family:

- primary storyline edges: `PRECEDES`
- realization / execution edges: `REALIZED_BY`
- operational dependencies: `DEPENDS_ON`
- policy and data relations: `CONSTRAINED_BY`, `READS`, `WRITES`

ELK works best if these are not all treated identically.

Recommended convention:

- primary flow edges:
  - use `WEST -> EAST` flow ports
  - give them higher importance for straightness and shortness
- auxiliary cross-lane edges:
  - use `NORTH` / `SOUTH` or dedicated support ports
  - let them dogleg orthogonally instead of competing with primary flow ports

Useful edge-level priorities:

- [`org.eclipse.elk.layered.priority.shortness`](https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-priority-shortness.html)
- [`org.eclipse.elk.layered.priority.straightness`](https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-priority-straightness.html)

These can help keep the customer / primary process path visually crisp while allowing support edges to take longer detours.

## Edge Bundling And Shared Touch Points

Relevant options:

- [`org.eclipse.elk.layered.mergeEdges`](https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-mergeEdges.html)
- [`org.eclipse.elk.layered.mergeHierarchyEdges`](https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-mergeHierarchyEdges.html)
- [`org.eclipse.elk.junctionPoints`](https://eclipse.dev/elk/reference/options/org-eclipse-elk-junctionPoints.html)

How to think about them for blueprints:

- `mergeEdges=true` can reduce clutter by making multiple no-port edges share touch points
- but it can also hide distinctions that matter semantically, especially if `READS` and `WRITES` must remain visibly separate
- `mergeHierarchyEdges=true` is particularly interesting if lanes are compound nodes and many edges cross the same lane boundary
- `junctionPoints` are output-only, and matter if you intentionally model or allow hyperedge-like merges

Default instinct for `service_blueprint`:

- keep `mergeEdges=false` unless you explicitly want bundled behavior
- consider `mergeHierarchyEdges=true` only when compound lanes produce too many nearly identical hierarchy crossings

## Labels

ELK supports labels on nodes, ports, and edges, but there is a practical caveat in the JSON docs:

- ELK generally does not estimate text size for you

That means an ELK-heavy blueprint should either:

1. pre-measure labels and feed label sizes into ELK, or
2. let ELK route first and place many labels afterwards in a blueprint-specific labeling pass

For service blueprints, option 2 is often simpler for relation labels such as:

- `depends on`
- `reads`
- `writes`
- `constrained by`

## What ELK Does Not Give You For Free

The primer is most useful if it is honest about limits.

ELK does not natively give you:

- a service-blueprint or swimlane-specific algorithm
- rigid row assignment by lane as a first-class concept
- arbitrary exact column pinning as a simple direct layered option
- a standalone post-layout router you can assume is present in every `elkjs` build

Practical local finding on that last point:

- the installed `elkjs` 0.11.1 in this repo reports `fixed`, `box`, `random`, `layered`, `stress`, `mrtree`, `radial`, `force`, `sporeOverlap`, `sporeCompaction`, and `rectpacking`
- it does not report a standalone Libavoid router in `knownLayoutAlgorithms()`

So, for `elkjs` as actually available here, the dependable routing tool is:

- `ELK Layered` with orthogonal routing

not:

- a separate general-purpose routing pass after an already fixed grid layout

## Recommended Mental Model For An LLM

If an LLM is asked "how should ELK be used for a service blueprint?", the best compact answer is:

- Treat `service_blueprint` as a left-to-right layered graph with strict lane semantics layered on top.
- Use `ELK Layered`, not DOT, as the main layout engine.
- Use explicit ports aggressively.
- Keep primary storyline edges distinct from support/dependency edges.
- Use orthogonal routing.
- Use model-order and in-layer constraints to preserve intended chronology and column peers.
- Use compound lanes only if you want ELK to understand hierarchy; do not assume compounds automatically behave like fixed swimlanes.
- If exact lane rows and exact slot columns are mandatory, let blueprint conventions own part of the geometry and let ELK solve ordering and routing problems around that geometry.

## Suggested First ELK Convention Set For `service_blueprint`

If starting from scratch, this is the most promising initial convention set:

1. Use `org.eclipse.elk.layered`.
2. Set `elk.direction=RIGHT`.
3. Set `elk.edgeRouting=ORTHOGONAL`.
4. Represent every visible slot as a node with measured width and height.
5. Give every node explicit semantic ports.
6. Route primary chronology through east/west flow ports.
7. Route support edges through north/south or dedicated auxiliary ports.
8. Preserve input order with model-order options.
9. Use in-layer constraints for nodes that should share a concurrency band.
10. Treat ELK as the owner of route geometry, but not automatically the sole owner of rigid swimlane-grid structure.

## Sources

- [`elkjs` README](https://github.com/kieler/elkjs/blob/master/README.md)
- [ELK reference index](https://eclipse.dev/elk/reference.html)
- [ELK Layered algorithm reference](https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html)
- [ELK JSON format](https://eclipse.dev/elk/documentation/tooldevelopers/graphdatastructure/jsonformat.html)
- [ELK coordinate system](https://eclipse.dev/elk/documentation/tooldevelopers/graphdatastructure/coordinatesystem.html)
- [Direction](https://eclipse.dev/elk/reference/options/org-eclipse-elk-direction.html)
- [Edge Routing](https://eclipse.dev/elk/reference/options/org-eclipse-elk-edgeRouting.html)
- [Hierarchy Handling](https://eclipse.dev/elk/reference/options/org-eclipse-elk-hierarchyHandling.html)
- [Port Constraints](https://eclipse.dev/elk/reference/options/org-eclipse-elk-portConstraints.html)
- [Port Side](https://eclipse.dev/elk/reference/options/org-eclipse-elk-port-side.html)
- [Port Index](https://eclipse.dev/elk/reference/options/org-eclipse-elk-port-index.html)
- [Port Sorting Strategy](https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-portSortingStrategy.html)
- [Consider Model Order](https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-considerModelOrder-strategy.html)
- [Force Node Model Order](https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-crossingMinimization-forceNodeModelOrder.html)
- [In Layer Predecessor Of](https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-crossingMinimization-inLayerPredOf.html)
- [In Layer Successor Of](https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-crossingMinimization-inLayerSuccOf.html)
- [Semi-Interactive Crossing Minimization](https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-crossingMinimization-semiInteractive.html)
- [Position](https://eclipse.dev/elk/reference/options/org-eclipse-elk-position.html)
- [Layer Constraint](https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-layering-layerConstraint.html)
- [Layer Choice Constraint](https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-layering-layerChoiceConstraint.html)
- [Shape Coords](https://eclipse.dev/elk/reference/options/org-eclipse-elk-json-shapeCoords.html)
- [Edge Coords](https://eclipse.dev/elk/reference/options/org-eclipse-elk-json-edgeCoords.html)
- [Merge Edges](https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-mergeEdges.html)
- [Merge Hierarchy-Crossing Edges](https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-mergeHierarchyEdges.html)
- [Junction Points](https://eclipse.dev/elk/reference/options/org-eclipse-elk-junctionPoints.html)
- [Shortness Priority](https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-priority-shortness.html)
- [Straightness Priority](https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-priority-straightness.html)
