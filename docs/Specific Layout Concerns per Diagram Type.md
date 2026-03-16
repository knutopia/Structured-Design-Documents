# Specific Layout Concerns per Diagram Type

This is supporting information for the renderer migration.

Different diagrams have different specific layout needs that the rendering engine must address. Here are some of them.

## ia_place_map

- horizontal top level layout with clean vertical alignment
- no content visually ABOVE top level nodes
- mixed top-level `Place` and `Area` handling
- vertical layout for an `Area` that contains lower-level `Place` nodes
- within an `Area`, consecutive sibling `Place` items in ordered `CONTAINS` source order should render as a recursive top-to-lower place chain with rightward indentation
- the same source-order chaining rule applies at top level: consecutive sibling `Place` items render as an implicit lower-level place chain until a non-`Place` sibling boundary breaks the chain
- this top-to-lower place hierarchy may occur on multiple levels, so indentation must support recursive chaining
- differentiating between node types should be possible across rendering profiles, even in `simple`

## ui_contracts

This is a challenging diagram type.

- Both in Place nodes and in Component nodes, we have possible presence of one or more ViewState or State nodes, with TRANSITIONS_TO relationships. In previous work with DOT output, we have introduced "ViewState Graph" and "State Graph" synthetic containers to capture such TRANSITIONS_TO relationships as horizontal layouts with labeled connectors.

- Relationships EMITS, BINDS_TO, DEPENDS_ON have to emerge from a container sometimes (not from a simple node). They should, if possible, not interfere with the grid placement of sibling items (nodes or containers) of the item they come from. This is a hard problem for a soft layout.

- Some Place nodes have LOTS of content to show in a ui_contracts diagram, and some have NONE. Yet we want to maintain some level of visual balance. This is probably best achieved by usign a vertical top-level layout. (Not sure about this.)
