# Specific Layout Concerns per Diagram Type

This is supporting information for the renderer migration.

Different diagrams have different specific layout needs that the rendering engine must address. Here are some of them.

## ia_place_map

- horizontal top level layout with clean vertical alignment
- no content visually ABOVE top level nodes
- mixed top-level `Place` and `Area` handling
- vertical layout for an `Area` that contains lower-level `Place` nodes
- explicit `Place CONTAINS Place` creates owned child scope
- same-scope follower indentation is a renderer rule, not a projection rule: the earliest preceding sibling `Place` that has forward `NAVIGATES_TO` edges to later direct sibling `Place` items may claim those later siblings as followers
- follower claiming is local to one sibling scope, stops at `Area` or non-`Place` boundaries, and does not cross explicit containment boundaries
- top level stays horizontal, `Area` interiors stay vertical, and each `place_group` stays vertical: place card first, owned scope second
- a single explicit contained child stays directly below its parent with no extra indent; multi-child contained scopes and follower scopes reserve a left trunk lane and indent the child column to the right
- lower-level content must make the space it needs before routing: child scopes determine parent width and height, including connector corridor space
- staged `ia_place_map` routing is deterministic and manual: direct single-child connectors go bottom-to-top vertically, while branched/follower connectors use a shared vertical trunk with a left-entry horizontal terminal segment
- internal routing anchors should not be painted as visible dots in normal output
- differentiating between node types should be possible across rendering profiles, even in `simple`

## ui_contracts

This is a challenging diagram type.

- Both in Place nodes and in Component nodes, we have possible presence of one or more ViewState or State nodes, with TRANSITIONS_TO relationships. In previous work with DOT output, we have introduced "ViewState Graph" and "State Graph" synthetic containers to capture such TRANSITIONS_TO relationships as horizontal layouts with labeled connectors.

- Relationships EMITS, BINDS_TO, DEPENDS_ON have to emerge from a container sometimes (not from a simple node). They should, if possible, not interfere with the grid placement of sibling items (nodes or containers) of the item they come from. This is a hard problem for a soft layout.
- Container-origin support edges need reserved gutter space so arrowheads and labels have horizontal room before they reach owned support nodes.
- Container-origin support edges need a dedicated, invisible label lane inside that reserved gutter so labels do not collide with scope headers or with one another.
- The reserved gutter should be treated as two invisible subregions: a label lane for label boxes and a separate route corridor for connector geometry, so local support routes do not pass through labels after lane assignment.
- Internal routing anchors should not be painted as visible dots in normal output.
- Containerized `ViewState` scopes should stay visually equivalent to leaf `ViewState` nodes even when they have nested content.

- Some Place nodes have LOTS of content to show in a ui_contracts diagram, and some have NONE. Yet we want to maintain some level of visual balance. This is probably best achieved by usign a vertical top-level layout. (Not sure about this.)
