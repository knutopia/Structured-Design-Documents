# [Done] Stage 2 Visual Issues to Address in Journey Map

This document captures 2 remaining visual remediation issues after execution of the original visual remediation plan.

7-23-26

References:
- docs/done/[Done] journey_map_renderer_implementation/journey_map_visual_remediation_comparison_record.md (visual proofs for visual remediation plan execution, referenced below)
- docs/done/[Done] journey_map_renderer_implementation/[Done] journey_map_visual_remediation_implementation_plan.md (executed visual remediation plan)


## 1. Straight Connector Balance

Reference: `JM-RM-02` — adjacent Steps use direct horizontal routes

### Problem: 

- Vertical balance of straight connectors between nodes of different heights looks unbalanced to the human observer.

Examples:
- In assets/visual-remediation-2026-07-18/focus/jm-rm-02.after.svg, the connector from second (tall) node to third (less tall) node lands near the bottom of the destination node's left edge.
- In assets/visual-remediation-2026-07-18/focus/jm-rm-03.after.svg (a plate from the next issue `JM-RM-03`, but expressing the current issue in this detail), the connector from "Review the recommendation" (tall node) to "Compare the tradeoffs" (less tall node) arrives at the very bottom of the destination node's left edge.
- Same in assets/visual-remediation-2026-07-18/focus/jm-rm-06.after.svg (`JM-RM-06`)

### Desired outcome:

- Achieve visual balance by vertically positioning the straight-line adjacent-node connector with awareness of the height of the less-tall node, so the connector sits (if possible) vertically centered relative to the less-tall node's edge or (if necessary - dictated by potential other connectors on the same edge) not-centered but reasonably-close to the vertical center. Note that the examples show the destination node as the less-tall node, but it could also be the origination node.

## 2. Forward-Route Connector Vertical Gap

Reference: `JM-RM-04` — long forward route leaves through the right edge

### Problem:

- While the example DOES indeed route the forward-route connector through the right edge of G-200, but, as before, it then proceeds to the left "on a root-owned lower track." That lower track is below the lowest edge of anything else in the diagram (below G-200 in this case), leaving a large gap between the long, low-positioned forward segment of the connector and the (shallow) other content that occupies space above the segment in the diagram. That large gap looks unbalanced and pointless to the human observer.

The example: J-204→J-401 to the right of G-200 in assets/visual-remediation-2026-07-18/focus/jm-rm-04.after.svg

### Desired Outcome:

- Route the forward-segment of the connector vertically closer to the content that sits above it, creating a visually-balanced outcome. Avoid using the "root-owned lower track" which is all-clear (before routing the connector) all the way from the left edge to the right edge of the diagram and thus takes the (tall) height of G-200 into account although G-200 does not horizontally compete with the connector segment in question. Instead use a lower track that is "locally clear" in the horizontal expanse that will be used by the connector segment in question.