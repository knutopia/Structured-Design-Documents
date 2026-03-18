# Specific Layout Concerns per Diagram Type

This is supporting information for the renderer migration.

Different diagrams have different specific layout needs that the rendering engine must address. Here are some of them.

## ia_place_map

- horizontal top level layout with clean vertical alignment
- no content visually ABOVE top level nodes
- mixed top-level `Place` and `Area` handling
- vertical layout for an `Area` that contains lower-level `Place` nodes
- within an `Area`, consecutive sibling `Place` items in ordered `CONTAINS` source order should render as an author-ordered lower-level place chain whose siblings stay aligned at one shared rendered depth
- the same source-order chaining rule applies at top level: consecutive sibling `Place` items render as an implicit lower-level place chain until a non-`Place` sibling boundary breaks the chain
- explicit structural `Place` descendants may still introduce deeper rendered levels, but consecutive sibling `Place` runs within each rendered level should not recursively indent equal siblings
- same-chain navigation should keep deterministic place-chain structure while allowing branch-local ELK routing where it can improve a local chain region without becoming the whole-layout source of truth
- same-chain branch regions may need to grow locally before parent layout is finalized so ELK has enough room to route without immediately collapsing back to the manual obstacle router
- same-chain navigation should reserve a readable vertical target approach into child nodes, even when that requires a source-side escape lane rather than a simple midpoint dogleg
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
