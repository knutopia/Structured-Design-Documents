# Specific Layout Concerns per Diagram Type

This is supporting information for evolving the renderer migration.

Different diagrams have different specific layout needs that the rendering engine must address. Here are some of them.

## ia_place_map

- horizontal top level layout with clean vertical alignment
- no content visually ABOVE top level nodes
- MIX of Place and Area on top level

- Vertical layout for Area that CONTAINS lower-level Place nodes
    - Within Places in Area, there often is a "Top" Place followed (in ordered CONTAINS statements in source) by other Place nodes (that are often navigation targets from the "Top" Place). This hierarchy within should by default be shown by a horizontal offset / "indent" (to the right) of the lower-level Place nodes, compared to the "Top" Place.
        -This "Top-to-lower" Place hierarchy may occur on multiple levels. Indent should solve for this.
- A top-level Place nodes may be followed (in source) by another Place node (without explicit containment) that should show "underneath" (vertically but with indentation.)
    -This "Top-to-lower" Place hierarchy may occur on multiple levels. Indent should solve for this.
-Differentiating between node types should be possible (label or simple visual convention) across rendering profiles (even in "Simple".)

## ui_contracts

This is a challenging diagram type.

- Both in Place nodes and in Component nodes, we have possible presence of one or more ViewState or State nodes, with TRANSITIONS_TO relationships. In previous work with DOT output, we have introduced "ViewState Graph" and "State Graph" synthetic containers to capture such TRANSITIONS_TO relationships as horizontal layouts with labeled connectors.

- Relationships EMITS, BINDS_TO, DEPENDS_ON have to emerge from a container sometimes (not from a simple node). They should, if possible, not interfere with the grid placement of sibling items (nodes or containers) of the item they come from. This is a hard problem for a soft layout.

- Some Place nodes have LOTS of content to show in a ui_contracts diagram, and some have NONE. Yet we want to maintain some level of visual balance. This is probably best achieved by usign a vertical top-level layout. (Not sure about this.)