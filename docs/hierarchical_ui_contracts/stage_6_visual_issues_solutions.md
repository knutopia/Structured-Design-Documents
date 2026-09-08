# Stage 6 Visual Issues & Solutions

*See [local figma exports](/home/knut/projects/sdd/docs/hierarchical_ui_contracts/stage_6_issues_visual_references) if Figma MCP connection fails.*

## Visual Guidance for Identified Issues

- Self-loop routing failure (in [self_loop.svg](/home/knut/projects/sdd/docs/hierarchical_ui_contracts/implementation_evidence/stage6/self_loop.svg) ):

This has been addressed for the Journey Map diagram. Not sure if an "Above" or a "Below" connector routing is used there - please align with existing solution. 

Both options shown here:
https://www.figma.com/design/XugYvQ9C0qi0Hwl88k43Wm/SDD-Node-Visuals?node-id=2055-3104&t=DrHMZWAbkftKAVsi-1

- Return Transition Issue (in [cycle.svg](/home/knut/projects/sdd/docs/hierarchical_ui_contracts/implementation_evidence/stage6/cycle.svg) ):

This should probably be a horizontal layout of states, like the "diamond" example that presents similar content.

As with self-loop, this has been addressed for the Journey Map diagram. Not sure if an "Above" or a "Below" connector routing is used there - please align with existing solution. (Node spacing in the examples is not mandatory - use shared-code-povided node spacing.)

Both options shown here:
https://www.figma.com/design/XugYvQ9C0qi0Hwl88k43Wm/SDD-Node-Visuals?node-id=2058-4511&t=DrHMZWAbkftKAVsi-1

## Additional Issues

Identified the following additional issues during visual review:

- Siblings (children on same level) should share a hierarchy container instead of using separate ones (in [three_parents_children.svg](/home/knut/projects/sdd/docs/hierarchical_ui_contracts/implementation_evidence/stage6/three_parents_children.svg) ) Solution:
  [https://www.figma.com/design/XugYvQ9C0qi0Hwl88k43Wm/SDD-Node-Visuals?node-id=2052-1926&t=DrHMZWAbkftKAVsi-1](https://www.figma.com/design/XugYvQ9C0qi0Hwl88k43Wm/SDD-Node-Visuals?node-id=2052-1926&t=DrHMZWAbkftKAVsi-1)

- (Not technically a failure but worth improving:) at vertical connector ends, horizontal connector segments encroach on arrow heads. Horizontal segments should leave "breathing room" for arrow heads. (Thought this was part of shared routing code, but may be wrong.)

See: "Component scope - Focal" in [three_parents_children.svg](/home/knut/projects/sdd/docs/hierarchical_ui_contracts/implementation_evidence/stage6/three_parents_children.svg)

```sdd
Component C-110 "Focal"
  CONTAINS C-120 "Child 0"
  CONTAINS C-121 "Child 1"
  CONTAINS C-122 "Child 2"
END
```

- For current visual proofs (three_parents_children.svg), when importing SVGs into Figma, arrow tips do not render reliably. (This has been addressed before for SVGs for other renderers.)