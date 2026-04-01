# Service Blueprint Reference Design Notes

Meant to guide a matching implementation.

If this reference note or its older example visual conflicts with the current normative layout rules on support-node realization, the layout rules win.

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
  For readability, a renderer may realize that lane using conceptual sublanes such as `system_action` and `system_resource`.
- "Policy" nodes (PL-020) live in the "Policy" lane.

Support nodes may also be realized in auxiliary spill slots owned by a semantic band when local packing in that band's support row or sublane would become unreadable. Those spill slots are physical placement aids, not new semantic columns.

## Row, Column, Node Appearance

- Rows and Columns are invisible. (No per-row / per-column containers shown.)
- The "Line of Interaction" and "Line of Visibility" separators have left-aligned titles in the reference layout. In the staged renderer, those titles should use small non-bold connector-label typography rather than the bold lettering seen in the older reference artwork.

- All rows have the same height. All columns have the same width.

-Additional space between rows or between columns may be introduced by connector routing if necessary (see below.)

- A node is sized "shrink to fit" around its text content.

- Line wrapping is applied to text content when text content width supercedes maximum width.

- A node is placed vertically centered in its row.

- A node is placed horizontally centered in its column.

## Connector Positioning & Appearance

- An "outgoing" connector starts pointing away perpendicularly from the originating edge of the originating node.

- An "incoming" connector terminates by perpendicularly approaching its terminating edge on the destination node from outside the node.

- A connector never crosses the interior space of its originating or destination node (or of any other node.)

### Fixed Connector Separation Distance

In various situations, connectors and features of connectors need to be spaced relatively to one another. In these situations, we use a fixed_separation_distance parameter to achieve unified spacing. 

### Primarily Horizontal PRECEDES Connectors

PRECEDES relationships are the primary relationship type shown in a service blueprint. A PRECEDES connector always crosses column boundaries.

A connector for a PRECEDES edge... 

- starts vertically centered at the right edge of the originating node, horizontally, pointing left-to-right.

- terminates vertically centered at the left edge of the destination node, horizontally, pointing left-to-right.

- connects nodes that are adjacent in the same lane (e.g. "J-020 PRECEDES J-021") is a simple left-to-right arrow.

- that connects nodes on different lanes (e.g. "PR-020 PRECEDES PR-021") uses "stair-stepping": a vertical segment that is horizontally close to the originating point, offset from the originating point by fixed_separation_distance (or multiples of fixed_separation_distance if other things are in the way)

### Primarily Vertical Connectors for Other Types

A connector for other any other edge type starts and terminates at the top edge or the bottom edge of the nodes involved. (Thus we call it "primvertical".)

If connecting nodes in different columns (e.g. "SA-021 READS D-020"), the connector uses a horizontal segment that is vertically close to the originating point, offset from the originating point by fixed_separation_distance (e.g. "SA-021 READS D-020"), or by multiples of fixed_separation_distance if other things are in the way (e.g. "SA-022 READS D-020".)

Vertical connectors between nodes in both different lanes and different columns (no example) use "stair stepping" with a vertical segment to bridge lanes, with the vertical segment close to the originating node, offset from the originating node by fixed_separation_distance, or by multiples of fixed_separation_distance if other things are in the way.

Use of Top- and Bottom Edges:

- If connecting two nodes in the same row (e.g "SA-021 READS D-020") the connector originates downward from the bottom edge of the originating node, and terminates upward at the bottom edge of the destination node.

- If the originating node is in a higher row than the destination node (e.g "PR-022 DEPENDS_ON SA-022"), the connector originates downward from the bottom edge of the originating node and terminates downward at the top edge of the destination node.

- If the originating node is in a lower row than the destination node (no example), the connector originates upward from the top edge of the originating node and terminates upward at the bottom edge of the destination node.

### Handling Multiple Connectors on the Same Edge

When multiple connectors share the same edge of the same node they each use a separate connection point on the node edge. Points on the edge are separated by fixed_separation_distance.

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

### Spacing Vertical Segments of Connectors

If multiple vertical segments of connectors share space within the same column (e.g. "PR-020 DEPENDS_ON SA-020", "PR-020 CONSTRAINED_BY PL-020"), they are offset horizontally from one another by fixed_separation_distance.

If multiple vertical segments of connectors have to share horizontal space between two columns (no example), they are offset horizontally from one another by fixed_separation_distance. If there is not enough horizontal space to accommodate all such adjacent vertical connector segments (for example, because both columns contain wide nodes in the same lane), then horizontal gutter space is added between the two columns (shifting the second & following columns to the right), sized in multiples of fixed_separation_distance, to make space for the vertical segments. 

### Spacing Horizontal Segments of Connectors

If multiple horizontal segments of connectors have to share vertical space between rows (e.g. "SA-020 WRITES D-020", "SA-021 READS D-020", "SA-022 READS D-020"), they are offset vertically from one another by fixed_separation_distance. If there is not enough vertical space to accomodate all such adjacent horizontal connector segments between two adjacent rows, (no example), then vertical gutter space is added between the two rows (shifting the second & following rows downwards), sized in multiples of fixed_separation_distance, to make space for the horizontal segments. 

### Routing Connectors Around Nodes ("Swerving")

When a vertical segment of a connector is blocked by a node that is in its way (e.g. "PR-020 CONSTRAINED_BY PL-020" blocked by SA-02), the connector avoids crossing the obstacle node by use of a horizontal offset to the right (horizontal- then vertical- then horizontal segment). The offset part of the connector keeps a horizontal and vertical distance of fixed_separation_distance (or multiples thereof if other obstacles in place) from the obstacle node.

When a horizontal segment of a connector is blocked by a node that is in its way (no example), the connector avoids crossing the obstacle node by use of a vertical downward offset (vertical- then horizontal- then vertical segment). The offset part of the connector keeps a horizontal and vertical distance of fixed_sepraration_distance (or multiples thereof if other obstacles in place) from the obstacle node.

## Handling Connector Labels

### Connector Routing Takes Precedence

Labels are placed after connectors are routed.

### No PRECEDES Label

A PRECEDES connection does not show a connector label. All other connection types do show connector labels.

### Fixed Label Placement Distance

A Label is placed near its connector. We use a fixed_label_distance parameter to achieve unified spacing between connectors and labels.

### Middle-of-Connector Label Placement 

A label is placed at the middle (halfway point) of a connector. If there are obstructions, it is shifted to an unobstructed position nearby.

#### LabeL Placement for a Vertical Segment

If the connector segment at the middle of the connector is vertical, 
the label is placed to the right of the connector, offset by fixed_label_distance.

Handling obstructions:

- If there is another vertical connector immediately the right of the to-be-labeled connector, so that the label covers the second connector, but there is no other connector to the left of the to-be-labeled connector (e.g. "depends on" label on "PR-020 DEPENDS_ON SA-020" with "PR-020 CONSTRAINED_BY PL-020" connector to the right), then the label position is flipped to the left side of the connector, offset by fixed_label_distance.

- If there are other vertical connectors immediately to the left and to the right of the to-be-labeled connector, then the label is left in place, and covering the connector to the right is accepted.

-If there is any kind of horizontal line crossing the to-be-labeled connector at the vertical label position (a horizontal connector, the "line of interaction", or the "line of visibility"), the label position is shifted up, to sit above the crossing line, offset from the line by 2 x fixed_label_distance. (E.g. "realized by" label on "J-020 REALIZED_BY PR-020" obstructed by "Line of Interaction".)

#### Label Placement for a Horizontal Segment

If the connector segment at the middle of the connector is horizontal, the label is placed covering the connector, vertically centered. 

Handling obstructions: 

- If there is an obstruction, then the label position is shifted to the right, by 2 x fixed_label_distance, to not cover the obstructing item.

Example of an obstruction: a vertical segment of another connector occupying the same space (e.g. "reads" label on "SA-021 READS D-020" obstructed by vertical segment of "SA-022 READS D-020".)

## Possible Rendering Sequence

1. Node Placement, driven by PRECEDES and other relationships

2. Connector Placement by source order (of nodes, of connectors per node)
2.1 Place every node's first outgoing connector (by source order of connectors per node) ...for "centered" placement on edge
2.2 Place every node's second outgoing connector ...for offset connection point on edge
2.3 Place every node's Nth outgoing connector...
2.3.1 At outgoing edge position of originating node
2.3.2 At incoming edge position of destination node
2.3.3 with well-spaced direction changes

3. Shift / modify connectors if needed...
3.1 to accomodate (incoming & outgoing) connection points on node edge
3.2 to avoid connectors cutting through nodes
3.3 to avoid overlapping connector lines (crossings OK but not overlapping lines)

4. Place visible connector labels
4.1 Place every label on connector center position
4.2 Shift label placement if needed...
4.2.1 to avoid overlapping parallel nearby connectors if possible
4.2.2 to avoid overlapping nearby nodes
4.2.3 to avoid covering nearby perpendicular lines
