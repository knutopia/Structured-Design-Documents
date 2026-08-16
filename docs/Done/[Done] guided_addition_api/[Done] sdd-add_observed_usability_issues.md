# [Done] SDD-Add: Observed Usability Issues

This document shows CLI walk-through copies of running the new SDD-Add tool, with inline comments to identify issues.

The UX of SDD-Add falls apart with poor language and pervasive deviations from the UX brief. 

It looks like the source unifis similar elements between the flow variations that are detailed in the UX brief. That is architecturally "noble" but extremely poorly executed, erasing critical UX detail. Not what I expected from a flagship model.

See inline comments "# issueN:"

## issue1:
"(fallback_append)" is confusing technical language. Remove from the output. What other technical language is hidden in the output?

## issue2: 

why does it say "Review complete" and what does it mean? This is confusing to the user.

## issue3: 

why are there TWO consecutive commit moments? Extremely confusing.

## issue4: 

what does "choose relationship route" even mean? The flow is broken here and ignoring the UX brief. Update the choices:

Choose relationship first or node first
  1. Connect P-100 to another node, choose relationship
  2. Connect P-100 to another node, choose existing target node
  3. Connect another node to P-100, choose relationship
  4. Connect another node to P-100, choose existing origin node

When "existing node" is chosen (options 2 or 4), the follow-up choice must NOT be "Choose a relationship" but a NODE choice. The node choice then CONSTRAINS the relationship choice. That is how (2 and 4) are DIFFERENT than (1 and 2) - this applies to the other "relationship or node" branch points too. 

This is important. The brief details this, specifically. Do you understand?

## issue5:

1. That choice must not exist where it is right now. See issue 4.
2. "Choose the other endpoint": "OTHER ENDPOINT" is condusing, unclear language
3. "P-210 (Place)": node names are missing from the menu.

It's not worth explaing a solution here. See issue 7.

## issue6: 

1. Again the "(fallback_append)" language. (see above)

2. Main problem: both offered choices are NESTING choices. The choice must be: nesting or not. The first/last position choice should FOLLOW the nesting choice (and in the nesting case, the first/last position choice should only be prompted if there are >0 existing nested nodes in the target level)

3. Another serious problem: when the target node EXISTS (as it does here), it must not be forcibly repositioned (as it is here).

Solution:

S1: Update the nesting choice (when nesting a NEW target node):

Nest P-311 in P-100?
  1. yes: place P-311 in P-100
  2. no: place P-311 at top-level

S2: Update the nesting choice (when nesting an EXISTING target node):

Nest P-311 in P-100?
  1. yes: place P-311 in P-100
  2. no: leave P-311 where it is

...THEN show the first- / last-position prompt (except in case of S2.2)

Do you understand?

## issue7:

Similar language problems as issue5, but this time the menu is in the right place.

- "other endpoint" is poor language
- node names are missing from the choices
- "1 matching relationship(s) already exist": lazy singular-plural

Solution:
- sensible title
- menu entries with names
- singular when needed, plural when needed for "matching relationship" annotation

Like this:

Choose endpoint for P-100 NAVIGATES_TO (…)
  1. P-210: Projects Overview (Place)
  (...)
  7. P-311 (Place) — 1 matching relationship already exists

Also: when this is a choice for an INCOMING relationship, adjust the title:

Choose starting point for (…) NAVIGATES_TO P-100

## issue8:

What are these two similar-but-(possibly)-different "advanced" user-confuser choices?

Show advanced node fields? [y/N]: n
...
Show optional advanced relationship fields? [y/N]: n

## issue9:

Not appropriate user-facing language, same as issue1:
"same_source_target_order"

## issue 10:

This seems like a random offering: placing the destination node before the originating node??? 
Why does this exist?

"4. top level, before P-100 — Alternative placement"

## issue 11:

There MUST NOT be contained-placement choice in that flow - after all there is no nested/hieriarchical relationship. 

Do you understand? This is important.

## issue 12 (not shown in source):

Source code spacing: when a node is appended at the end, there is no empty line before the new node:
```sdd

Component C-900 "Global Navigation"
END
Place P-311 "superPlaceNode"
  description="it's the best place"
END
```

for readability, keep an empty line between node definitions as it is commonly done.

## issue 13 (not shown in source):

An outgoing edge in an existing node is placed at the bottom of the node, AFTER nested nodes:

```sdd
Place P-100 "Dashboard"
  description="Global project status and flow entry points"
  primary_nav=true
  COMPOSED_OF C-100 "Projects Status Summary"
  COMPOSED_OF C-110 # (Quoted target name hints are optional...)
  COMPOSED_OF C-900 "Global Navigation" # (...but can improve readability)

  + Component C-100 "Projects Status Summary"
    description="At-a-glance view of project statuses"
  END
  + Component C-110 "Priority List of Tasks"
    description="What needs to be done"
  END
  NAVIGATES_TO P-311 "superPlaceNode"
END
```
That edge belongs at the bottom of the edge-content of the node, adjacent to the other edges.

## issue 14:

The diagram-type filters described throughout the UX brief are absent from the guided `sdd add` interaction.

The `--view` command option is not a substitute for guided filtering. It requires the user to know and supply an internal view ID before the interaction begins. During the interaction, the user cannot browse diagram types, choose one to narrow node or relationship choices, change the selected diagram type, or return to all diagram types.

The only in-flow filter prompt is available after a view was supplied externally, and it exposes internal role/presence classifications rather than offering diagram-type selection.

Diagram-type filtering must be available as an optional, understandable part of each relevant browse flow described in the UX brief, including standalone node types and all four known-node relationship flows.

## Walk-Through 1: Adding a Standalone Node

knut@sdd:~/projects/sdd$ pnpm sdd add small_app.sdd

> sdd-toolchain@0.1.0 sdd /home/knut/projects/sdd
> node dist/cli/main.js add small_app.sdd

What would you like to add?
  1. Add a standalone node — Create a node without a relationship
  2. Add a relationship — Choose an existing starting node, then connect it
Choose a number: 1
Choose a node type
  1. Outcome — Desired change in user or business reality.
  2. Metric — Measurement definition for an outcome.
  3. Opportunity — Evidence-backed problem or leverage point.
  4. Initiative — Planned solution theme or release slice.
  5. Stage — Coarse journey phase.
  6. Step — Unit of user intent or behavior.
  7. Area — Information architecture grouping.
  8. Place — Navigable product location.
  9. ViewState — Distinct render or interaction mode within a place.
  10. Component — UI building block.
  11. State — State machine state.
  12. Event — Named trigger from user or system.
  13. Process — Operational activity.
  14. SystemAction — Discrete system operation or API call.
  15. DataEntity — Domain object.
  16. Policy — Rule or constraint.
Choose a number: 8
Show advanced node fields? [y/N]: n
Node ID — Stable identifier for the new node. [P-311]:
Name — Human-readable node name.: superPlaceNode
Description — Short explanation of the node's purpose.: it's the best place
Choose placement (fallback_append)    # issue1: Remove "(fallback_append)" technical language
  1. top level, last — Recommended: fallback_append    # issue1: Remove "(fallback_append)" technical language
  2. top level, first — Alternative placement
Choose a number: 1
Proposal addp_7c69c3bf60b6ba9c8415d3152e66931f280898a382178ca65429b302eda84b2d
  Add Place P-311: superPlaceNode
  Place node at top level, last
Review complete    # issue2: WHAT DOES THIS MEAN to the user?
  1. Save
  2. Cancel
Choose a number: 1    # issue3: COMMIT ONE...
Dry run: applied
  Nodes added: 1
  Edges added: 0
  Reorder/reparent changes: 0
Commit these exact reviewed changes? [y/N]: y    # issue3: ...COMMIT TWO  ...why 2 commits?
Commit: applied
  Nodes added: 1
  Edges added: 0
  Reorder/reparent changes: 0
Saved small_app.sdd.
knut@sdd:~/projects/sdd$

##  Walk-Through 2: Adding a Relationship to an Existing Node

knut@sdd:~/projects/sdd$ pnpm sdd add small_app.sdd

> sdd-toolchain@0.1.0 sdd /home/knut/projects/sdd
> node dist/cli/main.js add small_app.sdd

What would you like to add?
  1. Add a standalone node — Create a node without a relationship
  2. Add a relationship — Choose an existing starting node, then connect it
Choose a number: 2
Choose starting node
  1. P-100: Dashboard — Place
  2. C-100: Projects Status Summary — Component
  3. C-110: Priority List of Tasks — Component
  4. A-200: Current Projects — Area
  5. P-210: Projects Overview — Place
  6. C-220: Overview Actions — Component
  7. C-230: Contextual Actions for List of Projects — Component
  8. VS-210a: Project List — ViewState
  9. VS-210b: Duplicate Project Dialog — ViewState
  10. VS-210c: Delete Project Confirmation Dialog — ViewState
  11. P-220: Project — Place
  12. P-221: Behavior Details — Place
  13. P-222: Dataset Details — Place
  14. VS-220a: Overview Tab — ViewState
  15. VS-220b: Behavior Tab — ViewState
  16. VS-220c: Dataset Tab — ViewState
  17. P-230: Create New Project — Place
  18. VS-230a: Create New Project Step 1 — ViewState
  19. VS-230b: Create New Project Step 2 — ViewState
  20. VS-230c: Create New Project Step 3 — ViewState
  21. A-300: Vault — Area
  22. P-310: Projects by Period — Place
  23. C-900: Global Navigation — Component
  24. P-311: superPlaceNode — Place
Choose a number: 1
Choose a relationship route    # issue4: WRONG PROMT! "relationship route" is CRYPTIC GARBAGE
  1. Connect P-100 to an existing or new node    # issue4: OPTIONS 1 AND 2 are differentiated badly
  2. Connect P-100 to an existing node
  3. Connect an existing or new node to P-100    # issue4: OPTIONS 3 AND 4 are differentiated badly
  4. Connect an existing node to P-100
Choose a number: 2
Choose a relationship    # WRONG FLOW! When "existing node" is chosen (2), this should be a NODE choice not a relationship choice. The node choice then CONSTRAINS the relationship choice. That is how (2) is DIFFERENT than (1) - THE BRIEF IS CLEAR ABOUT THIS.
  1. Place CONTAINS Place — Hierarchical containment or grouping for IA, journey structure, and UI hierarchy. · 7 existing endpoints
  2. Place CONTAINS ViewState — Hierarchical containment or grouping for IA, journey structure, and UI hierarchy. · 9 existing endpoints
  3. Place COMPOSED_OF Component — Composition relationship for UI assembly. · 5 existing endpoints
  4. Place NAVIGATES_TO Place — Navigation from one place to another. · 7 existing endpoints
Choose a number: 4
Choose the other endpoint # issue5: "OTHER ENDPOINT" is condusing, unclear language
  1. P-210 (Place) # issue5: node names are missing. Hard to choose blindly.
  2. P-220 (Place)
  3. P-221 (Place)
  4. P-222 (Place)
  5. P-230 (Place)
  6. P-310 (Place)
  7. P-311 (Place)
Choose a number: 7
Show optional advanced relationship fields? [y/N]: n
Choose placement (fallback_append)    # issue6: WRONG CHOICE OFFERED: BOTH are NESTING. Choice should be/include nesting or not nesting...
  1. body of P-100, last — Recommended: fallback_append
  2. body of P-100, first — Alternative placement
Choose a number: 1
Proposal addp_b099585cc079a2b9e0fa9ef942a25690079ddd6a8b06610a2dbe53de5fe37a46
  Connect P-100 -[NAVIGATES_TO]-> P-311
  Place edge at body of P-100, last
Review complete
  1. Save
  2. Cancel
Choose a number: 1
Dry run: applied
  Nodes added: 0
  Edges added: 1
  Reorder/reparent changes: 0
Commit these exact reviewed changes? [y/N]: y
Commit: applied
  Nodes added: 0
  Edges added: 1
  Reorder/reparent changes: 0
Saved small_app.sdd.
knut@sdd:~/projects/sdd$

##  Walk-Through 3: Adding a Relationship to a New Node

knut@sdd:~/projects/sdd$ pnpm sdd add small_app.sdd

> sdd-toolchain@0.1.0 sdd /home/knut/projects/sdd
> node dist/cli/main.js add small_app.sdd

What would you like to add?
  1. Add a standalone node — Create a node without a relationship
  2. Add a relationship — Choose an existing starting node, then connect it
Choose a number: 2
Choose starting node
  1. P-100: Dashboard — Place
  2. C-100: Projects Status Summary — Component
  3. C-110: Priority List of Tasks — Component
  4. A-200: Current Projects — Area
  5. P-210: Projects Overview — Place
  6. C-220: Overview Actions — Component
  7. C-230: Contextual Actions for List of Projects — Component
  8. VS-210a: Project List — ViewState
  9. VS-210b: Duplicate Project Dialog — ViewState
  10. VS-210c: Delete Project Confirmation Dialog — ViewState
  11. P-220: Project — Place
  12. P-221: Behavior Details — Place
  13. P-222: Dataset Details — Place
  14. VS-220a: Overview Tab — ViewState
  15. VS-220b: Behavior Tab — ViewState
  16. VS-220c: Dataset Tab — ViewState
  17. P-230: Create New Project — Place
  18. VS-230a: Create New Project Step 1 — ViewState
  19. VS-230b: Create New Project Step 2 — ViewState
  20. VS-230c: Create New Project Step 3 — ViewState
  21. A-300: Vault — Area
  22. P-310: Projects by Period — Place
  23. C-900: Global Navigation — Component
  24. P-311: superPlaceNode — Place
Choose a number: 1
Choose a relationship route    # issue4 again
  1. Connect P-100 to an existing or new node
  2. Connect P-100 to an existing node
  3. Connect an existing or new node to P-100
  4. Connect an existing node to P-100
Choose a number: 1
Choose a relationship
  1. Place CONTAINS Place — Hierarchical containment or grouping for IA, journey structure, and UI hierarchy. · 7 existing endpoints
  2. Place CONTAINS ViewState — Hierarchical containment or grouping for IA, journey structure, and UI hierarchy. · 9 existing endpoints
  3. Place COMPOSED_OF Component — Composition relationship for UI assembly. · 5 existing endpoints
  4. Place NAVIGATES_TO Place — Navigation from one place to another. · 7 existing endpoints
  5. Place CONSTRAINED_BY Policy — Declares policy or rule constraint. · 0 existing endpoints
Choose a number: 4
Choose the other endpoint    # issue7: "other endpoint" is poor language
  1. P-210 (Place)    # issue7: node names are missing from the choices
  2. P-220 (Place)
  3. P-221 (Place)
  4. P-222 (Place)
  5. P-230 (Place)
  6. P-310 (Place)
  7. P-311 (Place) — 1 matching relationship(s) already exist    # issue7: don't be cheap with singular/plural
  8. Create a new Place
Choose a number: 8
Show advanced node fields? [y/N]: n    # issue8: "advanced node fields"...
Node ID — Stable identifier for the new node. [P-312]:
Name — Human-readable node name.: anotherPlace
Description — Short explanation of the node's purpose.: the place of otherness
Show optional advanced relationship fields? [y/N]: n    # issue8: ...vs. "advanced relationship fields" ..huh? too advanced for users.
Choose placement (same_source_target_order)
  1. top level, after P-311 — Recommended: same_source_target_order    # issue9: ...kill that language
  2. top level, last — Alternative placement
  3. top level, first — Alternative placement
  4. top level, before P-100 — Alternative placement    # issue10: why is this a choice?
  5. top level, after P-100 — Alternative placement
Choose a number: 1
Choose placement (fallback_append)    # issue 11: there MUST NOT be contained-placement choice here?
  1. body of P-100, last — Recommended: fallback_append
  2. body of P-100, first — Alternative placement
Choose a number: 1
Proposal addp_b8009a6796e793cfdc39637bd271ce8d045f850df2ac0eae96966ef52edf4a50
  Add Place P-312: anotherPlace
  Connect P-100 -[NAVIGATES_TO]-> P-312
  Place node at top level, after P-311
  Place edge at body of P-100, last
Review complete
  1. Save
  2. Cancel
Choose a number: 2
Cancelled. No changes were written.    # it's just unusable.
knut@sdd:~/projects/sdd$
