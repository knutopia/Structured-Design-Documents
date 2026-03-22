# Service Blueprint Rendering Structure Guidance

Meant to guide a matching implementation.

Files referenced:
Source: <examples/rendered/v0.1/service_blueprint_diagram_type/service_blueprint_slice_example/service_blueprint_slice.sdd>

Reference visual as PNG: <docs/service_blueprint_renderer_implementation/reference/service_blueprint_slice.service_blueprint.tight_routing.png>
Reference visual as SVG: <docs/service_blueprint_renderer_implementation/reference/service_blueprint_slice.service_blueprint.tight_routing.svg>

views.yaml: <bundle/v0.1/core/views.yaml>

## Overall Structure

The service blueprint consists of columns, each representing concurrent steps and (labeled) rows representing lanes. 

### Column Placement of Nodes

Determined by flow of PRECEDES edges between nodes. (see SDD Source)

### Lane Placement of Nodes

- "Step" nodes (J-020, J-021) live in the "Customer" lane.
- "Process" nodes (PR-020, PR-021, PR-022)
- "SystemAction" nodes (SA-020, SA-021, SA-022) and "DataEntity" nodes (D-020) live in the "System" lane.
- "Policy" nodes (PL-020) live in the "Policy" lane.

## Row, Column, Node Appearance

- Rows and Columns are invisible. (No per-row / per-column containers shown.)

- All rows have the same height. All columns have the same width.

-Additional space between rows or between columns may be introduced by connector routing if necessary (see below.)

- A node is sized "shrink to fit" around its text content.

- Line wrapping is applied to text content when text content width supercedes maximum width.

- A node is placed vertically centered in its row.

- A node is placed horizontally centered in its column

## Connector Positioning & Appearance

- An "outgoing" connector starts pointing away perpendicularly from the originating edge of the originating node.

- An "incoming" connector terminates by perpendicularly approaching its terminating edge on the destination node from outside the node.

- A connector never crosses the interior space of its originating or destination node (or of any other node.)

### Horizontal PRECEDES Connections

A connector for a PRECEDES edge... 

- starts vertically centered at the right edge of the originating node, horizontally, pointing left-to-right.

- terminates vertically centered at the left edge of the destination node, horizontally, pointing lef-to-right.

### Vertical Connections for Other Types

A connector for other any other edge type starts and terminates at the top edge or the bottom edge of the nodes involved.

Specifically,

- If connecting two nodes in the same row (e.g "SA-021 READS D-020") the connector originates downward from the bottom edge of the originating node, and terminates upward at the bottom edge of the destination node.

- If the originating node is in a higher row than the destination node (e.g "PR-022 DEPENDS_ON SA-022"), the connector originates downward from the bottom edge of the originating node and terminates downward at the top edge of the destination node.

- If the originating node is in a lower row than the destination node (no example), the connector originates upward from the top edge of the originating node and terminates upward at the bottom edge of the destination node.

### Handling Multiple Connectors on the Same Edge

When multiple connectors share the same edge of the same node they each use a separate connection point on the node edge. There is a fixed distance of separation between the points.

- If the node edge is long enough to accomodate all its connectors, the first of the connectors maintains its position at the center of the edge, and subsequent connectors take position...
    - below it (on a vertical / left edge)
    - to the right of it (on a horizontal / top or bottom edge)

- If the node edge is too short to accomodate all its connectors on half its length (e.g D-020 "Claim" with 3 incoming connectors), the connection points share the entire width of the node edge, centered as a group. (No more centered first point.) If the edge is too short to accommodate all points, placement continues on an invisible line extending the edge on both ends. The node size is not changed.

Determining if node edge length is long enough:
edge length > 2x (connector count - 1) x fixed_separation_distance

### Accomodating Both Starting and Terminating Connectors on the Same Node Edge

When both outgoing and incoming connectors share a node edge, we maintain "directional priority", acknowledging that most connections go downwards and left-to-right (as opposed to upwards and right-to-left):

- At the top or bottom edge of a node, incoming connectors take positions at the left and outgoing connectors take position to the right.

- (While current semantics do not allow this case,) if incoming and outgoing connectors shared the left or right edge of a node, incoming connectors would take the upper positions, followed by outgoing connectors in the lower positions.

### Merging Connectors With Identical Nodes

If more than one connector are present that share the same originating node and the same terminating node (e.g. "SA-020 READS D-020", "SA-020 WRITES D-020"), they are shown as a single connector, with a combined label (e.g "reads, writes")

### Routing Connectors From Column to Column

...constrained space...

### Routing Connectors Around Nodes

### Creating Gutter Space to Accomodate Connectors

## Label Placement