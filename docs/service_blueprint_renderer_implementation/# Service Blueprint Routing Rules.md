# Service Blueprint Routing Rules

This is meant to guide the creation of a connector-routing engine for diagram type service_blueprint. Node placement is solved. The routing of connector lines from one node to another is the remaining challenge.

## Grounding Inputs

### Local Source-of-Truth Inputs:

- SDD source example: `examples/rendered/v0.1/journey_map_diagram_type/service_blueprint_slice_example/service_blueprint_slice.sdd`
- `bundle/v0.1/core/views.yaml`
- `definitions/v0.1/endpoint_contracts_semantic_rules_sdd_text_v_0_dot_1.md`
- Manually-routed reference design rendering created from SDD source example: 
    - `docs/service_blueprint_renderer_implementation/reference/service_blueprint_slice.service_blueprint.tight_routing.png`
    - `docs/service_blueprint_renderer_implementation/reference/service_blueprint_slice.service_blueprint.tight_routing.svg`

### Guidance: 

- Layout Rules: (does not solve routing): `docs/service_blueprint_layout_rules.md`
- Reference design notes, derived from manually routed reference design renderings: `docs/service_blueprint_renderer_implementation/reference/Service Blueprint Reference Design Notes.md`

Please refer to the [reference design notes connector positioning & appearance]('reference/Service Blueprint Reference Design Notes.md#connector_positioning_&_appearance') section.

## Connector Hierarchy

Not all connectors are equal (for best human readability.) To reflect this, we route connectors in a prioritized processing order and keep track of what connector "comes first". 

This deterministic order determines placement of connection points of node edges, placing of parallel connector segments in a given gutter space, etc.

### Prioritized Connector Sequence:

1. Process PRECEDES connections before other types
2. Top-down vertical order: based on the lane of originating nodes (in the lanes-columns grid), route connectors starting in higher lanes before connectors starting in lower lanes.
2. Left-right horizontal order: based on the column of originating nodes (in the lanes-columns grid), route connectors starting in "lower" lanes (left) before connectors starting in higher lanes (right).

## Proposed Routing Step Sequence

### 1. Initialize Helper Structures

#### 1.1 Connectors per Edge
Per node edge, per node, track ordered lists of starting_connector_edges and ending_connector_edges.

#### 1.2 Node Gutter Space

Per node, track right-gutter and bottom-gutter available space. 

Right-gutter is the horizontal space between the rightmost edge of a node and the rightmost edge of the next node to its right, in the same lane.

Bottom-gutter is the vertical space between the bottom edge of a node and the top edge of the node below it, in the same column.

Note that this space may be extended later if additional space is needed to accomodate connector routing.

#### 1.3 Node Gutter Connector Tracking

Per node per right-gutter, and per node per bottom-gutter, track an ordered list of connectores occupying the gutter: connectors_per_gutter. 

This data will allow determination of required gutter size based on "occupancy", and will allow predictable relative positioning of adjacent parallel connector segments in a gutter.

### 2. Determine Edges Per Connector

Based on relative position of originating node to destination node, determine the starting edge for the connector (on the originating node) and the ending edge (on the destination node) and register the connectors with the matching starting_connector_edges and ending_connector_edges.

### 3. Determine Gutters to Occupy

Based on known starting & ending edges, and known position of "obstacle nodes", determine the gutters occupied by the connector, and add the connector toconnectors_per_gutter.

In more detail, this might involve the following steps:

3.1 Route a connector as a simple set of perpendicular segments, with correct directions relative to starting & ending edges, ignoring obstacles.

3.2 Shift the connector to avoid obstacle nodes (nodes that are crossed by the connector), obstacle by obstacle, by shifting the connector into the adjacent right- and bottom gutters. Accomodate for "swerving" obstacle avoidance.

### 4. Refine Connector Spacing

As with the preceding steps, follow the Prioritized Connector Sequence when refining connector spacing.

#### 4.1 Space Out Connection Points

With all connectors assigned to edges and gutters, look at each connector edge with populated starting_connector_edges and / or ending_connector_edges. Then assign well-spaced coordinates to the connector start / end points per edge.  

#### 4.2 Space Out Parallel Segments Per Gutter Space

Adjust the routing per affected connector to remain stable. Within the node gutter immediately adjacent to the given edge, adjust the routing so that parallel connector segments (before "turning to" the final edge-perpendicular segment / after "coming from" the initial edge-perpendicular segment) are well-spaced. 

Track these adjustments to the other gutters occupied per connector: per gutter, if encountering overlapping connectors, shift connectors to appear well-spaced, parallel to one another.

### Position Connector Labels.

(...)