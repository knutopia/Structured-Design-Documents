# Visual Issues to Address in Journey Map

## 1. Stacking Parallel Options

Issue: Parallel paths are shown sequentially, with J-203 to the right of J-202.
Example: J-201 PRECEDES J-202 and J-201 PRECEDES J-203 (journey_map_staged_primary.sdd)

Desired solution: show parallel paths on separate horizontal lanes, so that J-203 is positioned below J-202.

This is a node placement issue (with routing consequences) seen in the primary fixture (plate JM-G03-01 and others.)
Relevant gate: *Gate 4 — measurement and source-ordered placement*
Also of consequence for Gate 6, *Plate JM-G06-01 — non-adjacent same-Stage skip*

## 2. Straight Connectors Between Adjacent Nodes Within a Stage

Issue: Two adjacent nodes within the same stage are connected by 3-segment connectors, because origin-Y and destination-y are different because of node height differences or because of connector-on-edge placement in multiple-connector-per-edge situations.

Examples: 
- J-101 PRECEDES J-102, J-202 PRECEDES J-203 (journey_map_staged_primary.sdd)
- (multiple connectors originating on same edge, impacted by Issue 1 above): J-201 PRECEDES J-202 (journey_map_staged_primary.sdd)
- J-001 PRECEDES J-002 (outcome_to_ia_trace.sdd)

Desired solution: use a straight, horizontal single-segment connector where possible, reducing segment-count for readability. To do this we sacrifice vertically-centered connector placement on vertical destination node edge (and possibly on corresponding source node edge)

This is about *Gate 5 — basic routing*
Also Gate 9, *plate JM-G09-01*

## 3. Single-Turn Connectors Where Possible

Issue: We have instances (1 instace actually) where a 4-segment connector is used to achieve a "to the right and up" connection. In the instance, another connector at/near the same y-value on a following node is routed around, causing a "to the right, down, right, up" 4-segment connector.

Desired solution: use a 2-segment "right, up" connector. Achieve the required collision avoidance with the other connector by vertically shifting the connector origin down on the originating edge.

Example: J-201 PRECEDES J-203 (journey_map_staged_primary.sdd)

The example connector is placed in gate 7 step 3 *JM-G07-01*.
A challenge with this issue is that solving issue 1 ("Stacking Parallel Options") will make the example disappear, since that solution will reposition J-203.

## 4. Distant-Route Vertical Offset Reduction

Issue: Long cross-stage connector goes deep vertically, originating at bottom node edge, exiting bottom of stage container before going to the right.

Desired outcome: With no obstacles to avoid, route the connector through the right edge of originating stage (instead of bottom edge) for a slightly more compact overall layout.

Example: J-204 PRECEDES J-401 (journey_map_staged_primary.sdd)

Gate 6, *plate JM-G06-02*

## 5. Connector-End De-Crowding

Issue: A connector turn in immediate proximity of a connector end with an arrow head. This looks visually crowed.

Desired outcome: More (1.5*) distance between connector end and the last turn of the connector. (In other words: a longer final connector segment.) This will look cleaner. (Has been achieved recently in the outcome-opportunity map renderer.)

Not sure what gate this belongs to. Potentially deep impact on routing.

## 6. Rounded Rectangles instead of Ovals for Opportunity Badges

Issue: While used in some other diagram types staged pipelines too, the ovals used for opportunity badges are ugly and hard to read.

Desired outcome: clean "secondary node content". 

For a good implementation, see: 
M001 INSTRUMENTED_AT J-002, M-001 INSTRUMENTED_AT E-001, I-001 IMPLEMENTED_BY P-001 
(in examples/rendered/v0.1/outcome_opportunity_map_diagram_type/outcome_to_ia_trace_example/outcome_to_ia_trace.sdd, examples/rendered/v0.1/outcome_opportunity_map_diagram_type/outcome_to_ia_trace_example/strict_profile/outcome_to_ia_trace.outcome_opportunity_map.svg)

Not sure what gate this belongs to.

## 7. High Density Expansion De-Tangle

Not sure if there is asolution for this one. I see an actual solution but don't know how to express it as logic:

Issue: In step 3 and in final step of plate JM-G07-02, all the connectors from Stage G-900 "A" to Stage G-910 "B" make a "downwards detour" after leaving the right edge of G-900, before continuing to the right. The reason might be that the uppermost of those connectors is close to the bottom edge of G-910 vertically, just as a result of vertically stacking horizontal connector edges with their standard vertical gap. (Not sure.) The detour is visually noisy. This noise adds up when combined with the noise of all these G900-to-G-910 connectors turning "right-down-right" near their origins.

Desired outcome: "Straighter" long distance connectors with fewer segments. This could be achieved by shifting the G900-to-G-910 connectors down slightly (by a standard-gap?) so they vertically clear the bottomt of G-910. As a side effect, the vertical height of G900 would have to grow slightly to accomodate the additional space needed on the right edge of G-900 for the horizontal connector segments to pass through.

An even cleaner outcome would be one where all these G900-to-G-910 route right-down near their origins, leave G-900 crossing its bottom edge and only then turn to the right. This would shrink G-900 vertically, which is visually cleaner and semantically good because G-900 then does not serve as a container for some long horizontal connector segments: G-900 becomes more focused on housing its contained nodes and their connections.

The trouble is that both of these desired outcomes are hard to generalize and possibly have significant blast radius, so we must tread extremely carefully.

journey_map_staged_compressed.sdd

Gate 7, *plate JM-G07-02*

## 8. Label Placement

We are missing connector labels entirely. Do not fix yet.