# DODGE - Dynamic Object Diagram Grid Evaluator

“Vision for Diagram Layout”

## Purpose

Provide a tool that supports diagram layout and connector routing by providing “vision” - a consistently occupied spatial grid representing the diagram - to a layout algorithm using it.

## Core Concept

The system models a diagram canvas as a grid of less-than-native resolution, for example at grid_size = 16 pixel. Each grid cell keeps a record of drawn objects that occupy the cell, and of objects that otherwise mark it (“cell is a gutter around object X”). Such records can be inspected by a ‘drawing’ (placement) algorithm that adds objects (nodes, connectors) to a diagram, providing the algorithm with “vision” of what’s there.

The layout algorithm benefits from this „vision“ by avoiding layout failures caused by the customary „blindness“ of such algorithms. The layout algorithm can rely on standard calls tp the tool and on standard responses from the tool, eliminating the need for thousands of lines of omission-prone custom layout manipulation and layout validation code that bog down the SDD rendering codebase today.

## Objects Mark Cells

The grid is used to “draw” the diagram: when a node is placed in the grid, it marks a part of the grid that matches its size, so the node is recorded in the affected cells. Different types of node cells are marked: Interior, TopEdge, BottomEdge, LeftEdge, RightEdge, TopLeftCorner, TopRightCorner, BottomLeftCorner, BottomRightCorner. A set of spacer cells (“meant to stay empty”) around the node-occupied cells is also recorded in the grid. All marked cells are also recorded outside the grid as a ‘drawing record” for the node.

Likewise, when a connector is placed, it marks the cells it occupies: a Start (VerticalUpwardStart, VerticalDownwardStart, HorizontalRightwardStart, HorizontalLeftwardStart), Segment cells (VerticalUpwardSegment, VerticalDownwardSegment, HorizontalRightwardSegment, HorizontalLeftwardSegment), Turn cells (UpToRightTurn, UpToLeftTurn, DownToRightTurn, DownToLeftTurn etc.) and an End (VerticalUpwardEnd, VerticalDownwardEnd, HorizontalLeftwardEnd, HorizontalRightwardEnd).

When a connector labels is placed, it marks its cells. A label fitting in a single cell height marks LeftEdge, RightEdge. A label occupying more than one cell height marks edged and corners like a node, as it occupies grid space in a similar way.

Similarly, hierarchical containers that enclose nodes and other containers, mark the cells they occupy, with additional cell types, for example TitleBar, InteriorSpacer (to keep content away from container edges) and InteriorContent (to accept content placement.) 

The per-cell records allow every object drawing operation to check each targeted cell for pre-existing occupancy, avoiding illegal overlaps while accommodating legal ones.

The per-object drawing records allow removal of every object, so an object can be re-positioned to modify a layout.

Some cells are marked to capture conditions that are valuable to support decision making by a layout algorithm. For example, a cell that represents a crossing of a connector’s vertical segment with another connector’s horizontal segment is marked as a CrossingCell, allowing a layout algorithm to make decisions about placing connector crossings near one-another or not.

## Marked Content- and Gutter Spaces

Based on a layout strategy (pursued by the layout alogrithm outside the tool), Nodes are placed in a certain overall pattern and then connectors are routed between them. 

One such pattern (and the most-used example in SDD) is a simple grid, where nodes occupy positions in an x-y grid. Horizontal and vertical empty space in-between these nodes is gutter-space, creating visual order and providing space to accommodate connectors.

Another pattern (used in SDD’s ia_place_map) is a hierarchical layout, where local grids of nodes are offset against other nodes at other hierarchical levels, and hierarchical containers enclose nodes and other containers. In a hierarchical layout, gutter-spaces also exist, but are defined hierarchically, in relation to the current-level frame.

When performing a layout, a layout algorithm, before placing nodes and containers, can claim untouched space as ContentSpace (that accepts Node placement) or as GutterSpace (providing „whitespace“ and room for connector routing.) 

(HorizontalGutter exists as columns of cells, and VerticalGutter as rows of cells. A given cell can belong to both a HorizontalGutter and a VerticalGutter, as those do overlap. Gutter is defined in relation to its surroundings: 

- Global Gutters („across the entire diagram“) for simple layouts,
- Locally-constrained Gutters for more sophisticated layouts (hierarchical, or flat-but-with placement goals that are not plain-grid-based) in relation to a container-interior or to adjacent nodes for locally-constrained layouts.

## Occupancy Rules

Rules are used to evaluate the grid. 

Some rules are spacing rules, that take advantage of the grid size, sized as 1x or as even multiples of basic grid size.

Examples:

- Required distances from objects, to achieve spacing. Used to define spacer cells around nodes, distances between parallel connector segments.
- Gutter sizes, for defaults and increments. When using an X-and-Y grid-of-nodes as the basic layout targets, a globalColumnGutterRule ensures that there is a default horizontal gutter between columns of Nodes, of a minimum gutter width. Likewise a globalRowGutterRule ensures that there is a default vertical gutter between rows of nodes, of a minimum gutter height.

Some rules are logic rules that allow or deny occupying a given cell in a given way, taking existing content into account.

Examples:

- Generally cells are single-occupancy, except for specific, meaningful situations like a connector crossing, a ConnectorStart or ConnectorEnd touching a NodeEdge, a connector crossing a Divider Line, a connector crossing a ContainerEdge.
- Connector segments may only occupy gutter cells and must avoid spacer cells around nodes, except for ConnectorStart segments which by their purpose live in a spacer cell at the edge of a node.

## Emergents-Tracking

As content gets drawn, some „local phenomena“ can emerge as a result that are worth tracking. Specifically, clusters of items appear:

- Connector-clusters: an area where many adjacent grid cells are occupied by connector crossings or connector turns.
- Label-clusters: an area where several labels appear visually close together.

Such emerging objects are tracked by the tool, similar to objects drawn by the layout algoritm, and they are recorded in the cells where they appear.

Not all such clusters need to be avoided in all layouts, but a given layout alogrithm may choose to act to avoid them.

## Metrics

The tool tracks metrics related to layout quality that the layout algorithm may choose to query. Some of those metrics are global - applying to the entire grid/canvas. 

Examples:

- Average crossings per connector
- Average turns per connector
- Average connector length
- Connector-cluster count
- Label-cluster count
- Empty-column count
- Empty-row count
- Gutter column width variation
- Gutter row height variation
- Top- / Bottom- / Left- / Right-starting connector count
- Top- / Bottom- / Left- / Right-ending connector count

Some metrics are tracked per-object, stored alongside the „drawing record“ of an object. 

Examples:

- Crossings per connector
- Turns per connector
- Connector-clusters per connector
- Length per connector
- Label-clusters per connector
- Top- / Bottom- / Left- / Right-starting connector count per node
- Top- / Bottom- / Left- / Right-ending connector count per node

Not all layout algorithms must optimize for all metrics. The layout algorithm author makes the choices.

## Drawing Actions

Drawing commands are „symbolic“ (grid-based) versions of actual draw-on-a-canvas commands.

- Place-item:
    - Place_node(where)
    - Place_connector-segment (where, direction)
    - Place_connector_turn (where, direction)
    - Place_connector_start_on_edge (node, edge)
    - Place_label
    - Enclose_in_Container(content_to_enclose)
- Equivalent Remove-item actions

There is a temptation to actually embed layout logic in this tool (choosing the correct edge for a connector to start at, attempting different routes for a connector to minimize crossings, automatically expanding gutter space when needed etc.) But such code exists in the shared rendering codebase. That code should be optimized to take advantage of the “vision” provided to it here, but we do not need to re-invent the wheel.

## Grid Modification Actions

Sometimes, there is not enough space: a node that needs to be placed is wider or taller than the space available for it, or connector that needs to be routed encounters a gutter space that is already completely occupied by parallel segments of multiple connectors. In such situations, the layout algorithm has the option to request more space, and the tool responds by adding the space, inserting additional columns or rows of un-occupied space to solve the problem. 

The new space is marked as ContentSpace or GutterSpace, according to the surrounding cells. 

The edit is performed in the manner of an „affine transformation“ (not a truly fitting term here, but used for illustration): 

- Local additions are executed to achieve globally consistent results.
- Already-drawn objects that are „cut“ by new space are „mended“ to consistently use the space, and their records are updated.

The layout algorithm may also request to remove space, where there is unoccupied space, if that is consistent with the algorithm‘s intent (to eliminat gratuitous whitespace) and if the tool confirms there is no content preventing such an action.

## Branching

The tool provides means to track edits, roll back edits, and to branch out parallel edits to the same previous state. This allows the caller to quickly explore layout alternatives in a non-destructive manner.

## Producing Graphical Artifacts

The tool is meant to be visually deterministic, producing predictable outputs of its current state. This solves two issues:

- While the rendering pipeline is going through its steps, the caller can prompt the tool to generate a representative schematic visual output of a given content state. This output provides a visualization for review and quality assurance, allowing for diagram state to be seen as a sequence of frames. Such output makes the rendering sequence clear to the human observer and to an LLM analyzing it.
- When the pipeline is done, the caller can ask the tool for a high-fidelity SVG output based on the tool state.

## Coda

This is a vision for a tool to improve the rendering pipelines of SDD. 

If nothing else, it will clearly visualize the currently present idiotic local optimizations that make the existing poorly over-engineered SDD rendering pipelines unsuitable for public release today, as they keep breaking with any content variation beyond the canonical examples.

There is a chance for further optimization by simplifying rendering logic (placement and routing) by replacing full-resolution diagram juggling and fragile state-chasing per algorithm with a consistent set of simplified functionality and clear state.