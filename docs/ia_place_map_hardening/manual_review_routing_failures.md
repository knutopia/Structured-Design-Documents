# Manual Review: Routing Failures

Reviewing [implementation_evidence.md](docs/ia_place_map_hardening/implementation_evidence.md) for [ia_place_map Hardening Implementation Plan](docs/ia_place_map_hardening/ia_place_map_hardening_implementation_plan.md)

While the implementation is structurally acceptable, the resulting routing and label placement is badly unusable. Not suitable for presentation to human users. We have experienced this same failure class repeatedly with EVERY renderer in the repo and it is as UNACCEPTABLE as it was the previous dozen times.

The same problems (in most cases) and the same class of problem (in a few cases) has been solved in our other renderers.

The following are specific unusable, unacceptle routing problems. The solution must be systemic and not 'golden-sample' based. This would be a great time to curse at the apparent systemic failure of Codex/OpenAi models.

## Combined 

### ia_parallel_navigation_v02.compact.combined.svg

- Connectors start and end near node edges, not at / near center of node edge as they shou;d 
- Hard to see to see what connector the upper label belongs to.
- Lower label is vertically very close to left-bound connector above it. Should be further away.
- Left-bound connector crosses vertical arriving connector at upper edge of `Workspace home` too close to the arrow.
- Shortest right-bound connector is needlessly offset upwards instead of being vertically centered on the nodes.
- Overlap of label with `Account` area forces nodes in both areas to be pushed down, creating awkward empty vertical space in both areas. The gutter between the 2 areas could easily house the label (as it houses the other label), avoiding the awkward spacing. 

### ia_parallel_navigation_v02.detailed.combined.svg

- Left-bound connector too close to upper edge of area containers above it.
- Upper label too close to left-bound connector above it.
- Very large unneeded horizontal space between the 2 areas.
- Would improve if the 2 straight-line connectors started / ended near-centered on the node edges and their labels lived above / below instead of overlapping

## Full named DG-001

### ia_parallel_navigation_v02.compact.DG-001.svg

- Same as combined / compact

### ia_parallel_navigation_v02.detailed.DG-001.svg

- Same as combined / detailed

## Open workspace DG-002 

### ia_parallel_navigation_v02.compact.DG-002.svg

- Connector needlessly offset upwards instead of being vertically centered on connected nodes.

### ia_parallel_navigation_v02.detailed.DG-002.svg

- Connector needlessly offset downwards instead of being vertically centered on connected nodes.

## Accept invitation DG-003 

### ia_parallel_navigation_v02.compact.DG-003.svg 

- Same as DG-002 / compact

### ia_parallel_navigation_v02.detailed.DG-003.svg

- Same as DG-002 / detailed

## BillSage compatibility 

### billSage_structure.compact.combined.svg 

- A connector hairball in `Projections` with connectors multiple connector segments violating minimum/standard distance from node edges and from the area edge. 
- One vertical segment exiting OUTSIDE the area container.
- Unnecessary connector crossings below `Projection` where the rightmost-arriving connector needlessly crosses both other connectors twice each. 
- Several arriving connector arrows crowded by too-close connector turns.

### billSage_structure.detailed.combined.svg

- Same issues as `compact` variety
- Connector arriving at top edge of `Projection` is needlessly crumpled (5 sections) instead of being a straight vertical single-section connector.

## Both decorators 

### decorators.compact.type-id.svg

- Same as combined / compact

### decorators.detailed.type-id.svg

- Same as combined / detailed