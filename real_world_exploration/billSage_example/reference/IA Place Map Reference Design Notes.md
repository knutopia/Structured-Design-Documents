# IA Place Map Reference Design Notes

Meant to guide a matching implementation.

Files referenced:
Source: <real_world_exploration/billSage_structure.sdd>
Reference visual as PNG: <real_world_exploration/reference/billSage_structure.ia_place_map.recommended.bottomToLeft_connectors.reference.png>
Reference visual as SVG: <real_world_exploration/reference/billSage_structure.ia_place_map.recommended.bottomToLeft_connectors.reference.svg>

## Challenge: Nesting Amongst Sibling Nodes

In billSage.structure.sdd, Area "A-200 Projections" contains the following sibling nodes:
- P-210 "Projections Overview"
- P-220 "Projection"
    which inturn contains 
    - P-221 "Fee Schedule Scenario Details"
    - P-222 "Funding Scenario Details"

- P-230 "Create New Projection"

### Hub-Nesting

The challenge here is that we want to show P-220, P-230 indented to the right from P-210.
Why? Because P-210 serves as a "hub" or "landing page". The only way that this character is seen in the SDD source is because
- P-210 is listed FIRST in A-200 AND it NAVIGATES_TO P-220, P-230 (it navigates to the nodes that FOLLOW it in the source.) 
...this combination of factors can be read as a "rendering hint": "To accomodate the NAVIGATES_TO connections from the FIRST to the FOLLOWING nodes, we indent the FOLLOWING nodes to the right."

### Containment Nesting

A second level of nesting occurs for P-221 and P-222 contained in P-220. Since this is an explicit CONTAINS relationship, this nesting is straigtforward.

## Showing Connectors

- Connectors show "Place CONTAINS Place" and Place NAVIGATES_TO Place".
- We show "forward" connectors: where "place A (NAVIGATES_TO place B)" occurs in the source BEFORE "place B (NAVIGATES_TO place A)", we show a connector for "place A (NAVIGATES_TO place B)" but not for "place B (NAVIGATES_TO place A)"

## Connector Shape

- A connector originates vertically from the bottom edge of the originating node.
- A connector terminates horizontally at the left edge of the destination node.
- A connector has a single 90 degree angle.

## Connectors drive node placement

...in the sense of "To accomodate connections we indent nodes to the right."

## Preserving Containment Order Source Order

As already established, 
-we continue to respect CONTAINS ("hierarchy edge" - containment order) to drive node order. That is why P-220 is followed by P-221, followed by P-222.
-we continue to respect node order based on node order in the source file ("source order"). That is why P-210 is followed by P-220, followed by P-230.
-because containment order ranks higher than source order, P-221 and P-222 appear below P-220 and above P-230

## Good Spacing

The reference visual shows visually pleasant spacing. Aim to replicate.

## Limited Perspective, But Current Perspective

The reference visual and the design notes here outline only ONE of many possible layouts for the given source structure. It is our CURRENT, INITIAL goal to get to a usable diagram. It is imperfect.

In the future, we will offer more options. (hoizontal vs vertical layout, spacing options, what connections to show, "same level" vs "implied hierarchy" sibling representation etc.)