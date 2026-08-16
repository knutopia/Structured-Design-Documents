# [Done] Guided Addition UX Acceptance Transcripts

Status: **ACCEPTED**

Phase decision: **ACCEPT**

This document is the Phase 1 UX proof source for remediating Guided Addition. It specifies human-visible interaction behavior to review and correct before corrective architecture begins. It does **not** define final API types, approve an architecture, authorize implementation, or change the authority of the loaded bundle.

The semantic-action descriptions below are deliberately provisional. They describe meaning so that a later API design can be tested against the accepted interaction; they are not proposed type, field, action, or schema names.

## 1. Authority And Acceptance Boundary

These transcripts interpret, in order:

1. [UX Brief for a Guided Addition API](./ux_brief_guided_addition_api.md), especially sections 1.1–1.4, 2.1, 2.2 “Notes Regarding Filtering,” “Sub-Flow: Create New Node,” “New-Node Placement in Document Source,” and “Content Delivery, Not Document Editing.”
2. [SDD-Add: Observed Usability Issues](./sdd-add_observed_usability_issues.md), issues 1–14.
3. `AGENTS.md`, especially bundle authority, spec-first acceptance, source organization, and stop conditions.
4. `bundle/v0.1/core/views.yaml`, `vocab.yaml`, `contracts.yaml`, and `authoring.yaml` for the current diagram names, node types, valid relationship triples, form fields, and authoring semantics.

The human reviewer accepted this wording and behavior. Later architecture must reproduce the accepted transcripts without making clients reconstruct semantic choices.

## 2. Controlled Fixture

Every transcript starts from a fresh copy of exactly this source. Effects from one transcript never carry into another.

```sdd
SDD-TEXT 0.1

Place P-100 "Dashboard"
  COMPOSED_OF C-100 "Status Card"

  + Component C-100 "Status Card"
  END
END

Area A-200 "Projects"
  CONTAINS P-210 "Projects Overview"

  + Place P-210 "Projects Overview"
    NAVIGATES_TO P-100 "Dashboard"
  END
END

Place P-300 "Reports"
END

ViewState VS-100 "Summary"
END

Component C-200 "Global Navigation"
END

Outcome O-100 "Improve project visibility"
END
```

The principal anchor is `P-100: Dashboard`. The fixture deliberately supplies existing and new Place choices; nested and top-level nodes; one existing incoming navigation; structural, behavioral, and cross-diagram possibilities; and one existing child under the anchor.

## 3. Reading The Transcripts

- `console` blocks are exact proposed user-facing text. The responses shown after prompts are the selected responses for that transcript.
- “Provisional semantic action” is descriptive only and is not a final API contract.
- Transcripts 1–15 prove individual decisions through proposal formation. Transcripts 16–18 separately prove Save, warning, and Cancel ownership so those decisions are not repeated in every case. Transcript 19 is a late addition to cover the no-node-launch flow when relationship is chosen.
- “Expected committed source effect” means the exact effect if that proposal later follows the applicable accepted Save transcript. Unshown source remains byte-for-byte unchanged.
- `[Filter nodes by diagram type: ...]` / `[Filter relationships by diagram type: ...]` remains the first action inside each applicable browse menu. Selecting or clearing a filter rerenders that same browse step; it does not change the relationship-first or existing-node-first order.
- A regular relationship is listed before a bridge relationship. A bridge remains available with the plain-language annotation `Cross-diagram connection`. Raw display classifications are not user-visible.

## 4. Acceptance Transcripts

### T01 — Standalone Place With Diagram Selection, Change, And Clear

**Exact interaction**

```console
What would you like to add?
  1. Add a standalone node
  2. Add a relationship
Choose a number: 1
Chosen: Add a standalone node

Choose a node type
  1. [Filter nodes by diagram type: All diagram types]
  2. Outcome — Desired change in user or business reality.
  3. Metric — Measurement definition for an outcome.
  4. Opportunity — Evidence-backed problem or leverage point.
  5. Initiative — Planned solution theme or release slice.
  6. Stage — Coarse journey phase.
  7. Step — Unit of user intent or behavior.
  8. Area — Information architecture grouping.
  9. Place — Navigable product location.
  10. ViewState — Distinct render or interaction mode within a place.
  11. Component — UI building block.
  12. State — State machine state.
  13. Event — Named trigger from user or system.
  14. Process — Operational activity.
  15. SystemAction — Discrete system operation or API call.
  16. DataEntity — Domain object.
  17. Policy — Rule or constraint.
Choose a number: 1
Chosen: Change filter

Choose a diagram type to filter nodes by
  1. All diagram types (current)
  2. Outcome-Opportunity Map
  3. Journey Map
  4. Service Blueprint
  5. IA Place Map
  6. Scenario Flow
  7. UI Contracts
Choose a number: 5
Chosen: IA Place Map filter

Choose a node type
  1. [Filter nodes by diagram type: IA Place Map]
  2. Area — Information architecture grouping.
  3. Place — Navigable product location.
Choose a number: 1
Chosen: Change filter

Choose a diagram type to filter nodes by
  1. All diagram types
  2. Outcome-Opportunity Map
  3. Journey Map
  4. Service Blueprint
  5. IA Place Map (current)
  6. Scenario Flow
  7. UI Contracts
Choose a number: 7
Chosen: UI Contracts filter

Choose a node type
  1. [Filter nodes by diagram type: UI Contracts]
  2. Place — Navigable product location.
  3. ViewState — Distinct render or interaction mode within a place.
  4. Component — UI building block.
  5. State — State machine state.
  6. Event — Named trigger from user or system.
  7. DataEntity — Domain object.
  8. SystemAction — Discrete system operation or API call.
Choose a number: 1
Chosen: Change filter

Choose a diagram type to filter nodes by
  1. All diagram types
  2. Outcome-Opportunity Map
  3. Journey Map
  4. Service Blueprint
  5. IA Place Map
  6. Scenario Flow
  7. UI Contracts (current)
Choose a number: 1
Chosen: All diagram types filter

Choose a node type
  1. [Filter nodes by diagram type: All diagram types]
  2. Outcome — Desired change in user or business reality.
  3. Metric — Measurement definition for an outcome.
  4. Opportunity — Evidence-backed problem or leverage point.
  5. Initiative — Planned solution theme or release slice.
  6. Stage — Coarse journey phase.
  7. Step — Unit of user intent or behavior.
  8. Area — Information architecture grouping.
  9. Place — Navigable product location.
  10. ViewState — Distinct render or interaction mode within a place.
  11. Component — UI building block.
  12. State — State machine state.
  13. Event — Named trigger from user or system.
  14. Process — Operational activity.
  15. SystemAction — Discrete system operation or API call.
  16. DataEntity — Domain object.
  17. Policy — Rule or constraint.
Choose a number: 9
Chosen: node type Place

New node ID [P-301]: P-301
New node Name: Settings
New node Description: Configuration and preferences
Add more details about P-301: Settings? [y/N]: n

Where to place P-301: Settings
  1. Last position — Recommended
  2. First position
Choose a number: 1
Chosen: Last position
```

**Selected response:** Add a standalone node, then IA Place Map, then UI Contracts, then All diagram types; `Place`; `P-301: Settings`; no additional details; top-level last.

**Provisional semantic action (descriptive only):** Clear the diagram filter, propose a new standalone Place with the three primary fields, and recommend appending it as the last top-level definition.

**Why the choice constrains the next menu:** Each diagram selection replaces the visible node types with the selected diagram's bundle-included node types. Clearing returns the complete bundle vocabulary without losing the standalone-node intent.

**Expected semantic proposal:** Add `Place P-301: Settings` with description `Configuration and preferences`; no relationship; top-level last.

**Expected committed source effect:** Append this definition, preceded by one blank line:

```sdd
Place P-301 "Settings"
  description="Configuration and preferences"
END
```

**Proof:** UX brief 2.1, diagram filtering, create-new-node sub-flow, and new-node placement; issues 1, 8, 9, 12, and 14.

### T02 — Outgoing Relationship-First To Existing P-300

**Exact interaction**

```console
Choose a connection direction
  1. Outgoing: P-100 connects to another node [choose by relationship type]
  2. Outgoing: P-100 connects to another node [choose by existing destination node]
  3. Incoming: another node connects to P-100 [choose by relationship type]
  4. Incoming: another node connects to P-100 [choose by existing origin node]
Choose a number: 1
Chosen: P-100 connects to another node [choose by relationship type]

Choose relationship type 
  1. [Filter relationships by diagram type: All diagram types]
  2. P-100 CONTAINS Place — Put a Place inside Dashboard. 
  3. P-100 CONTAINS ViewState — Put a ViewState inside Dashboard.
  4. P-100 COMPOSED_OF Component — Make a Component part of Dashboard.
  5. P-100 NAVIGATES_TO Place — Navigate from Dashboard to a Place.
  6. P-100 CONSTRAINED_BY Policy — Apply a Policy to Dashboard.
Choose a number: 5
Chosen: P-100 NAVIGATES_TO Place

Choose destination for P-100 NAVIGATES_TO Place
  1. P-210: Projects Overview (Place)
  2. P-300: Reports (Place)
  3. Create a new Place
Choose a number: 2
Chosen: P-100 NAVIGATES_TO P-300

Add an event trigger or guard condition to this navigation? [y/N]: n
```

**Selected response:** Outgoing relationship-first; `Place NAVIGATES_TO Place`; existing destination `P-300: Reports`; no optional navigation details.

**Provisional semantic action (descriptive only):** Propose a navigation from the anchor to the selected existing Place and preserve the target's current source location.

**Why the choice constrains the next menu:** Selecting the relationship/type combination limits destinations to existing Place nodes plus creation of one new Place. Selecting an existing destination removes all new-node fields and placement decisions.

**Expected semantic proposal:** Add `P-100 NAVIGATES_TO P-300`; leave `P-300` top-level where it is.

**Expected committed source effect:** Insert `NAVIGATES_TO P-300 "Reports"` after the existing relationship line in `P-100` and before its nested child. No node definition moves.

**Proof:** UX brief 1.1, progressive disclosure, and placement; issues 4, 5, 7, 8, 11, and 13.

### T03 — Outgoing Relationship-First To New P-301

**Exact interaction**

```console
Choose a connection direction
  1. Outgoing: P-100 connects to another node [choose by relationship type]
  2. Outgoing: P-100 connects to another node [choose by existing destination node]
  3. Incoming: another node connects to P-100 [choose by relationship type]
  4. Incoming: another node connects to P-100 [choose by existing origin node]
Choose a number: 1
Chosen: P-100 connects to another node [choose by relationship type]

Choose relationship type
  1. [Filter relationships by diagram type: All diagram types]
  2. P-100 CONTAINS Place — Put a Place inside Dashboard.
  3. P-100 CONTAINS ViewState — Put a ViewState inside Dashboard.
  4. P-100 COMPOSED_OF Component — Make a Component part of Dashboard.
  5. P-100 NAVIGATES_TO Place — Navigate from Dashboard to a Place.
  6. P-100 CONSTRAINED_BY Policy — Apply a Policy to Dashboard.
Choose a number: 5
Chosen: P-100 NAVIGATES_TO Place

Choose destination for P-100 NAVIGATES_TO Place
  1. P-210: Projects Overview (Place)
  2. P-300: Reports (Place)
  3. Create a new Place
Choose a number: 3
Chosen: P-100 NAVIGATES_TO new Place

New node ID [P-301]: P-301
New node Name: Settings
New node Description: Configuration and preferences
Add more details about P-301: Settings? [y/N]: n
Add an event trigger or guard condition to this navigation? [y/N]: n

Where to place P-301: Settings
  1. Immediately after P-100: Dashboard at top level — Recommended
  2. At top level, last
Choose a number: 1
Chosen: Immediately after P-100: Dashboard at top level
```

**Selected response:** Outgoing relationship-first; navigation to a new Place; `P-301: Settings`; no additional details; immediately after the anchor.

**Provisional semantic action (descriptive only):** Propose the new Place, the outgoing navigation, and a same-level target position that follows the graph sequence.

**Why the choice constrains the next menu:** The selected combination fixes the new node type as Place. Because navigation is non-structural, the organization menu contains only same-level, graph-consistent choices and no nesting decision.

**Expected semantic proposal:** Add `P-301: Settings`, add `P-100 NAVIGATES_TO P-301`, and place the new destination immediately after `P-100` at top level.

**Expected committed source effect:** Add the relationship before `P-100`'s nested child, then add the new definition after the complete `P-100` definition with blank lines on both sides.

**Proof:** UX brief 1.1, create-new-node sub-flow, progressive disclosure, and placement; issues 4, 8, 9, 10, 11, 12, and 13.

### T04 — Outgoing Existing-Node-First, Then Constrained Relationship

**Exact interaction**

```console
Choose a connection direction
  1. Outgoing: P-100 connects to another node [choose by relationship type]
  2. Outgoing: P-100 connects to another node [choose by existing destination node]
  3. Incoming: another node connects to P-100 [choose by relationship type]
  4. Incoming: another node connects to P-100 [choose by existing origin node]
Choose a number: 2
Chosen: P-100 connects to another node [choose by existing destination node]

Choose relationship from P-100 to existing destination
  1. [Filter nodes by diagram type: All diagram types]
  2. P-100 CONTAINS / NAVIGATES_TO P-210: Projects Overview (Place)
  3. P-100 CONTAINS / NAVIGATES_TO P-300: Reports (Place)
  4. P-100 CONTAINS VS-100: Summary (ViewState)
  5. P-100 COMPOSED_OF C-100: Status Card (Component)
  6. P-100 COMPOSED_OF C-200: Global Navigation (Component)
Choose a number: 2
Chosen: P-100 CONTAINS / NAVIGATES_TO P-210

Choose how P-100: Dashboard connects to P-210: Projects Overview
  1. P-100 CONTAINS P-210 — Put Projects Overview inside Dashboard.
  2. P-100 NAVIGATES_TO P-210 — Navigate from Dashboard to Projects Overview.
Choose a number: 2
Chosen: P-100 NAVIGATES_TO P-210

Add an event trigger or guard condition to this navigation? [y/N]: n
```

**Selected response:** Outgoing existing-node-first; `P-210: Projects Overview`; `NAVIGATES_TO`; no optional details.

**Provisional semantic action (descriptive only):** Propose the selected valid relationship from the anchor to the already chosen existing node, without moving it.

**Why the choice constrains the next menu:** The existing-node menu includes only nodes reachable from a Place by at least one bundle-valid relationship. Choosing the exact Place `P-210` narrows the next menu to the two valid `Place Place` relationships in this direction.

**Expected semantic proposal:** Add `P-100 NAVIGATES_TO P-210`; leave `P-210` nested under `A-200`.

**Expected committed source effect:** Add `NAVIGATES_TO P-210 "Projects Overview"` to `P-100` before its nested child. The entire `P-210` definition remains unchanged under `A-200`.

**Proof:** UX brief 1.2 and placement; issues 4, 5, 7, 11, and 13.

### T05 — Incoming Relationship-First From Existing P-210

**Exact interaction**

```console
Choose a connection direction
  1. Outgoing: P-100 connects to another node [choose by relationship type]
  2. Outgoing: P-100 connects to another node [choose by existing destination node]
  3. Incoming: another node connects to P-100 [choose by relationship type]
  4. Incoming: another node connects to P-100 [choose by existing origin node]
Choose a number: 3
Chosen: another node connects to P-100 [choose by relationship type]

Choose a relationship type 
  1. [Filter relationships by diagram type: All diagram types]
  2. Area CONTAINS P-100 — Put Dashboard inside an Area.
  3. Place CONTAINS P-100 — Put Dashboard inside a Place.
  4. Place NAVIGATES_TO P-100 — Navigate from a Place to Dashboard.
  5. Initiative IMPLEMENTED_BY P-100 — Connect an Initiative to Dashboard.
  6. Step REALIZED_BY P-100 — Connect a journey Step to Dashboard.
  7. Metric INSTRUMENTED_AT P-100 — Observe a Metric at Dashboard.
Choose a number: 4
Chosen: Place NAVIGATES_TO P-100

Choose starting point (origin) for Place NAVIGATES_TO P-100
  1. P-210: Projects Overview (Place) — 1 matching relationship already exists
  2. P-300: Reports (Place)
  3. Create a new Place
Choose a number: 1
Chosen: P-210 NAVIGATES_TO P-100

Add an event trigger or guard condition to this navigation? [y/N]: n
```

**Selected response:** Incoming relationship-first; Place navigation; existing origin `P-210: Projects Overview`; no optional details.

**Provisional semantic action (descriptive only):** Propose another navigation with the selected existing Place as origin and flag the exact existing match for informed review.

**Why the choice constrains the next menu:** Choosing `Place NAVIGATES_TO P-100` removes every non-Place origin. The existing-edge annotation is computed for that exact direction and triple and uses singular wording.

**Expected semantic proposal:** Add another unannotated `P-210 NAVIGATES_TO P-100`; preserve both node locations; surface the duplicate-edge warning only when Save is selected.

**Expected committed source effect:** No write occurs without the warning acceptance in T17. If accepted there, a second identical relationship line is inserted beside the existing one in `P-210`; no node moves.

**Proof:** UX brief 1.3, directionality, and Save ownership; issues 4, 5, 7, and 11.

### T06 — Incoming Relationship-First From A New Place

**Exact interaction**

```console
Choose a connection direction
  1. Outgoing: P-100 connects to another node [choose by relationship type]
  2. Outgoing: P-100 connects to another node [choose by existing destination node]
  3. Incoming: another node connects to P-100 [choose by relationship type]
  4. Incoming: another node connects to P-100 [choose by existing origin node]
Choose a number: 3
Chosen: another node connects to P-100 [choose by relationship type]

Choose a relationship type 
  1. [Filter relationships by diagram type: All diagram types]
  2. Area CONTAINS P-100 — Put Dashboard inside an Area.
  3. Place CONTAINS P-100 — Put Dashboard inside a Place.
  4. Place NAVIGATES_TO P-100 — Navigate from a Place to Dashboard.
  5. Initiative IMPLEMENTED_BY P-100 — Connect an Initiative to Dashboard.
  6. Step REALIZED_BY P-100 — Connect a journey Step to Dashboard.
  7. Metric INSTRUMENTED_AT P-100 — Observe a Metric at Dashboard.
Choose a number: 4
Chosen: Place NAVIGATES_TO P-100

Choose starting point (origin) for Place NAVIGATES_TO P-100
  1. P-210: Projects Overview (Place) — 1 matching relationship already exists
  2. P-300: Reports (Place)
  3. Create a new Place
Choose a number: 3
Chosen: new Place NAVIGATES_TO P-100

New node ID [P-301]: P-301
New node Name: Activity
New node Description: Recent project activity
Add more details about P-301: Activity? [y/N]: n
Add an event trigger or guard condition to this navigation? [y/N]: n

Where to place P-301: Activity
  1. Immediately before P-100: Dashboard at top level — Recommended
  2. At top level, first
Choose a number: 1
Chosen: Immediately before P-100: Dashboard at top level
```

**Selected response:** Incoming relationship-first; navigation from a new Place; `P-301: Activity`; no additional details; immediately before the anchor.

**Provisional semantic action (descriptive only):** Propose a new Place containing the outgoing relationship to the anchor and a same-level location before its destination.

**Why the choice constrains the next menu:** The incoming combination fixes the new origin type as Place. Graph sequence allows before-anchor or top-level-first placement; it does not allow the new origin after its destination.

**Expected semantic proposal:** Add `P-301: Activity`, add `P-301 NAVIGATES_TO P-100`, and place the new origin immediately before `P-100`.

**Expected committed source effect:** Insert the new top-level definition before `P-100`, separated from it by one blank line. Its navigation line appears before `END`.

**Proof:** UX brief 1.3, create-new-node sub-flow, and placement; issues 4, 7, 8, 10, 11, 12, and 13.

### T07 — Incoming Existing-Node-First, Then Exact Valid Relationships

**Exact interaction**

```console
Choose a connection direction
  1. Outgoing: P-100 connects to another node [choose by relationship type]
  2. Outgoing: P-100 connects to another node [choose by existing destination node]
  3. Incoming: another node connects to P-100 [choose by relationship type]
  4. Incoming: another node connects to P-100 [choose by existing origin node]
Choose a number: 4
Chosen: another node connects to P-100 [choose by existing origin node]

Choose relationship from existing starting point (origin) to P-100 Dashboard
  1. [Filter nodes by diagram type: All diagram types]
  2. A-200: Projects (Area) CONTAINS P-100
  3. P-210: Projects Overview (Place) CONTAINS / NAVIGATES_TO P-100
  4. P-300: Reports (Place) CONTAINS / NAVIGATES_TO P-100
Choose a number: 3
Chosen: P-210 CONTAINS / NAVIGATES_TO P-100

Choose how P-210: Projects Overview connects to P-100: Dashboard
  1. P-210 CONTAINS P-100 — Put Dashboard inside Projects Overview.
  2. P-210 NAVIGATES_TO P-100 — Navigate from Projects Overview to Dashboard. 1 matching relationship already exists.
Choose a number: 2
Chosen: P-210 NAVIGATES_TO P-100

Add an event trigger or guard condition to this navigation? [y/N]: n
```

**Selected response:** Incoming existing-node-first; `P-210: Projects Overview`; `NAVIGATES_TO`; no optional details.

**Provisional semantic action (descriptive only):** Propose the selected valid relationship from the already chosen origin to the anchor and preserve both existing source locations.

**Why the choice constrains the next menu:** The origin menu includes only existing nodes with a valid bundle relationship to a Place. Choosing exact types `Place Place` and incoming direction leaves only `CONTAINS` and `NAVIGATES_TO`; relationships for Area, Step, Initiative, or Metric are not carried forward.

**Expected semantic proposal:** Add another `P-210 NAVIGATES_TO P-100`; flag the exact existing match at review and Save.

**Expected committed source effect:** The same warning-gated duplicate effect as T05. No node placement or nesting question appears.

**Proof:** UX brief 1.4 and Save ownership; issues 4, 5, 7, and 11.

### T08 — Structural New Target, Nest Yes, Then Sibling Order

**Exact interaction**

```console
Choose a connection direction
  1. Outgoing: P-100 connects to another node [choose by relationship type]
  2. Outgoing: P-100 connects to another node [choose by existing destination node]
  3. Incoming: another node connects to P-100 [choose by relationship type]
  4. Incoming: another node connects to P-100 [choose by existing origin node]
Choose a number: 1
Chosen: P-100 connects to another node [choose by relationship type]

Choose a relationship type
  1. [Filter relationships by diagram type: All diagram types]
  2. P-100 CONTAINS Place — Put a Place inside Dashboard.
  3. P-100 CONTAINS ViewState — Put a ViewState inside Dashboard.
  4. P-100 COMPOSED_OF Component — Make a Component part of Dashboard.
  5. P-100 NAVIGATES_TO Place — Navigate from Dashboard to a Place.
  6. P-100 CONSTRAINED_BY Policy — Apply a Policy to Dashboard.
Choose a number: 2
Chosen: P-100 CONTAINS Place

Choose destination for P-100 CONTAINS Place
  1. P-210: Projects Overview (Place)
  2. P-300: Reports (Place)
  3. Create a new Place
Choose a number: 3
Chosen: P-100 CONTAINS new Place

New node ID [P-301]: P-301
New node Name: Settings
New node Description: Configuration and preferences
Add more details about P-301: Settings? [y/N]: n

Nest P-301: Settings in P-100: Dashboard?
  1. Yes: place P-301 in P-100
  2. No: place P-301 at top level
Choose a number: 1
Chosen: Yes: place P-301 in P-100

Where to place P-301: Settings within P-100: Dashboard
  1. Last position, after C-100: Status Card — Recommended
  2. First position, before C-100: Status Card
Choose a number: 1
Chosen: Last position, after C-100: Status Card
```

**Selected response:** Outgoing structural combination; new `P-301: Settings`; nest yes; last after the existing nested child.

**Provisional semantic action (descriptive only):** Propose a new structural child, nest its definition under the anchor, and order it after the one existing child.

**Why the choice constrains the next menu:** `Place CONTAINS Place` is structural, so organization is decided before ordering. Choosing nesting selects `P-100` as the source parent. Because that parent already has `C-100`, first/last is meaningful and appears only then.

**Expected semantic proposal:** Add `P-100 CONTAINS P-301`; add `P-301: Settings` nested last within `P-100`.

**Expected committed source effect:** Insert the new relationship after `COMPOSED_OF C-100` and before any child declarations; insert the new Place child after the complete `C-100` child.

**Proof:** UX brief 1.1 and new-node placement; issues 6, 9, 11, and 13.

### T09 — Structural New Target, Nest No, Then Top-Level Order

**Exact interaction**

```console
Choose a connection direction
  1. Outgoing: P-100 connects to another node [choose by relationship type]
  2. Outgoing: P-100 connects to another node [choose by existing destination node]
  3. Incoming: another node connects to P-100 [choose by relationship type]
  4. Incoming: another node connects to P-100 [choose by existing origin node]
Choose a number: 1
Chosen: P-100 connects to another node [choose by relationship type]

Choose a relationship type
  1. [Filter relationships by diagram type: All diagram types]
  2. P-100 CONTAINS Place — Put a Place inside Dashboard.
  3. P-100 CONTAINS ViewState — Put a ViewState inside Dashboard.
  4. P-100 COMPOSED_OF Component — Make a Component part of Dashboard.
  5. P-100 NAVIGATES_TO Place — Navigate from Dashboard to a Place.
  6. P-100 CONSTRAINED_BY Policy — Apply a Policy to Dashboard.
Choose a number: 2
Chosen: P-100 CONTAINS Place

Choose destination for P-100 CONTAINS Place
  1. P-210: Projects Overview (Place)
  2. P-300: Reports (Place)
  3. Create a new Place
Choose a number: 3
Chosen: P-100 CONTAINS new Place

New node ID [P-301]: P-301
New node Name: Settings
New node Description: Configuration and preferences
Add more details about P-301: Settings? [y/N]: n

Nest P-301: Settings in P-100: Dashboard?
  1. Yes: place P-301 in P-100
  2. No: place P-301 at top level
Choose a number: 2
Chosen: No: place P-301 at top level

Where to place P-301: Settings
  1. Last position — Recommended
  2. First position
Choose a number: 1
Chosen: Last position
```

**Selected response:** Outgoing structural combination; new `P-301: Settings`; nest no; top-level last.

**Provisional semantic action (descriptive only):** Propose a structural relationship while organizing the new target as a top-level definition, then choose its order among existing top-level definitions.

**Why the choice constrains the next menu:** Declining nesting fixes the top level as the target organization. Existing top-level definitions make first/last meaningful, so that ordering question follows; no nested-sibling question appears.

**Expected semantic proposal:** Add `P-100 CONTAINS P-301`; add `P-301: Settings` as the last top-level definition.

**Expected committed source effect:** Insert the relationship before `P-100`'s child and append the new definition after one blank line.

**Proof:** UX brief 1.1 and new-node placement; issues 6, 12, and 13.

### T10 — Structural Existing Target, Explicit Move, Then Sibling Order

**Exact interaction**

```console
Choose a connection direction
  1. Outgoing: P-100 connects to another node [choose by relationship type]
  2. Outgoing: P-100 connects to another node [choose by existing destination node]
  3. Incoming: another node connects to P-100 [choose by relationship type]
  4. Incoming: another node connects to P-100 [choose by existing origin node]
Choose a number: 1
Chosen: P-100 connects to another node [choose by relationship type]

Choose a relationship type
  1. [Filter relationships by diagram type: All diagram types]
  2. P-100 CONTAINS Place — Put a Place inside Dashboard.
  3. P-100 CONTAINS ViewState — Put a ViewState inside Dashboard.
  4. P-100 COMPOSED_OF Component — Make a Component part of Dashboard.
  5. P-100 NAVIGATES_TO Place — Navigate from Dashboard to a Place.
  6. P-100 CONSTRAINED_BY Policy — Apply a Policy to Dashboard.
Choose a number: 2
Chosen: P-100 CONTAINS Place

Choose destination for P-100 CONTAINS Place
  1. P-210: Projects Overview (Place)
  2. P-300: Reports (Place)
  3. Create a new Place
Choose a number: 1
Chosen: P-100 CONTAINS P-210

Nest P-210: Projects Overview in P-100: Dashboard?
  1. Yes: move P-210 into P-100
  2. No: leave P-210 where it is
Choose a number: 1
Chosen: Yes: move P-210 into P-100 

Where to place P-210: Projects Overview within P-100: Dashboard
  1. Last position, after C-100: Status Card — Recommended
  2. First position, before C-100: Status Card
Choose a number: 1
Chosen: Last position, after C-100 

Confirm Moving P-210: Projects Overview  EMPHASIS
  From within A-200: Projects
  To within P-100: Dashboard, after C-100: Status Card
  Existing relationships remain unchanged.
Move this node?
  1. Move it
  2. Go back
Choose a number: 1
Chosen: Move P-210
```

**Selected response:** `P-100 CONTAINS P-210`; move the existing target under `P-100`; place it last; accept the displayed move effect.

**Provisional semantic action (descriptive only):** Propose the structural relationship and one explicit relocation of the existing node declaration, preserving that node's own content and relationships.

**Why the choice constrains the next menu:** Choosing yes fixes a new source parent for an existing declaration. Because `P-100` already has a child, sibling order follows. The concrete from/to effect is then confirmed because moving existing source content is material.

**Expected semantic proposal:** Add `P-100 CONTAINS P-210`; remove the one nested `P-210` declaration from `A-200`; insert that same declaration once under `P-100` after `C-100`; retain `A-200 CONTAINS P-210` and `P-210 NAVIGATES_TO P-100` unchanged.

**Expected committed source effect:** The moved-node proof snippet in section 6.4: exactly one `+ Place P-210` declaration remains, now within `P-100`; no copy remains within `A-200`.

**Proof:** UX brief 1.1 and placement; issue 6. A later Save may present the concrete multiple-structural-parent warning; the move confirmation itself is not a second ordinary Save.

### T11 — Structural Existing Target, Leave It Where It Is, No Order Prompt

**Exact interaction**

```console
Choose a connection direction
  1. Outgoing: P-100 connects to another node [choose by relationship type]
  2. Outgoing: P-100 connects to another node [choose by existing destination node]
  3. Incoming: another node connects to P-100 [choose by relationship type]
  4. Incoming: another node connects to P-100 [choose by existing origin node]
Choose a number: 1
Chosen: P-100 connects to another node [choose by relationship type]

Choose a relationship type
  1. [Filter relationships by diagram type: All diagram types]
  2. P-100 CONTAINS Place — Put a Place inside Dashboard.
  3. P-100 CONTAINS ViewState — Put a ViewState inside Dashboard.
  4. P-100 COMPOSED_OF Component — Make a Component part of Dashboard.
  5. P-100 NAVIGATES_TO Place — Navigate from Dashboard to a Place.
  6. P-100 CONSTRAINED_BY Policy — Apply a Policy to Dashboard.  
Choose a number: 2
Chosen: P-100 CONTAINS Place

Choose destination for P-100 CONTAINS Place
  1. P-210: Projects Overview (Place)
  2. P-300: Reports (Place)
  3. Create a new Place
Choose a number: 1
Chosen: P-100 CONTAINS P-210

Nest P-210: Projects Overview in P-100: Dashboard?
  1. Yes: move P-210 into P-100
  2. No: leave P-210 where it is
Choose a number: 2
Chosen: No: leave P-210 where it is
```

**Selected response:** `P-100 CONTAINS P-210`; no move; leave `P-210` where it is.

**Provisional semantic action (descriptive only):** Propose only the new structural relationship and explicitly preserve the existing target declaration's location.

**Why the choice constrains the next menu:** Choosing no completes source organization for an existing node: its current parent and sibling order stay intact. There is therefore no first/last question and no move confirmation.

**Expected semantic proposal:** Add `P-100 CONTAINS P-210`; leave the complete `P-210` declaration under `A-200` without alteration.

**Expected committed source effect:** The leave-in-place proof snippet in section 6.3: one new relationship line appears in `P-100`, while the `A-200` block is byte-for-byte unchanged.

**Proof:** UX brief 1.1 and placement; issue 6 and issue 13.

### T12 — Non-Structural New Nodes Use Only Graph-Consistent Placement

This transcript has paired outgoing and incoming cases, each reset to the fixture.

#### T12A — New outgoing destination

**Exact interaction**

```console
P-100: Dashboard will navigate to new Place P-301: Settings.

Where to place P-301: Settings
  1. Immediately after P-100: Dashboard at top level — Recommended
  2. At top level, last
Choose a number: 1
Chosen: Immediately after P-100: Dashboard at top level
```

#### T12B — New incoming starting point

**Exact interaction**

```console
New Place P-301: Activity will navigate to P-100: Dashboard.

Where to place P-301: Activity
  1. Immediately before P-100: Dashboard at top level — Recommended
  2. At top level, first
Choose a number: 1
Chosen: Immediately before P-100: Dashboard at top level
```

**Selected response:** Outgoing destination immediately after its origin; incoming origin immediately before its destination.

**Provisional semantic action (descriptive only):** Recommend same-level positions that follow the directed graph sequence, with one less-local but still consistent alternative in each case.

**Why the choice constrains the next menu:** Direction determines which side of the anchor is graph-consistent. A non-structural relationship never creates a nesting choice. Outgoing does not offer before-origin; incoming does not offer after-destination.

**Expected semantic proposal:** T12A is the placement portion of T03; T12B is the placement portion of T06.

**Expected committed source effect:** T12A places the complete new definition after `P-100`; T12B places it before `P-100`; both keep one blank line between adjacent top-level definitions.

**Proof:** UX brief 1.1, 1.3, and placement; issues 9, 10, 11, and 12.

### T13 — Select, Change, And Clear Diagram Type During Relationship-First Browsing

**Exact interaction**

```console
Choose a connection direction
  1. Outgoing: P-100 connects to another node [choose by relationship type]
  2. Outgoing: P-100 connects to another node [choose by existing destination node]
  3. Incoming: another node connects to P-100 [choose by relationship type]
  4. Incoming: another node connects to P-100 [choose by existing origin node]
Choose a number: 1
Chosen: P-100 connects to another node [choose by relationship type]

Choose a relationship type
  1. [Filter relationships by diagram type: All diagram types]
  2. P-100 CONTAINS Place — Put a Place inside Dashboard.
  3. P-100 CONTAINS ViewState — Put a ViewState inside Dashboard.
  4. P-100 COMPOSED_OF Component — Make a Component part of Dashboard.
  5. P-100 NAVIGATES_TO Place — Navigate from Dashboard to a Place.
  6. P-100 CONSTRAINED_BY Policy — Apply a Policy to Dashboard.
Choose a number: 1
Chosen: Change filter

Choose a diagram type to filter nodes by
  1. All diagram types (current)
  2. Outcome-Opportunity Map
  3. Journey Map
  4. Service Blueprint
  5. IA Place Map
  6. Scenario Flow
  7. UI Contracts
Choose a number: 5
Chosen: IA Place Map filter

Choose a relationship type
  1. [Filter relationships by diagram type: IA Place Map]
  2. P-100 CONTAINS Place — Put a Place inside Dashboard.
  3. P-100 NAVIGATES_TO Place — Navigate from Dashboard to a Place.
  4. P-100 CONTAINS ViewState — Cross-diagram connection
  5. P-100 COMPOSED_OF Component — Cross-diagram connection
  6. P-100 CONSTRAINED_BY Policy — Cross-diagram connection

Choose a number: 1
Chosen: Change filter

Choose a diagram type to filter nodes by
  1. All diagram types
  2. Outcome-Opportunity Map
  3. Journey Map
  4. Service Blueprint
  5. IA Place Map (current)
  6. Scenario Flow
  7. UI Contracts
Choose a number: 7
Chosen: UI Contracts filter

Choose a relationship type
  1. [Filter relationships by diagram type: UI Contracts]
  2. P-100 CONTAINS ViewState — Put a ViewState inside Dashboard.
  3. P-100 COMPOSED_OF Component — Make a Component part of Dashboard.
  4. P-100 CONTAINS Place — Put a Place inside Dashboard.
  5. P-100 NAVIGATES_TO Place — Cross-diagram connection
  6. P-100 CONSTRAINED_BY Policy — Cross-diagram connection
Choose a number: 1
Chosen: Change filter

Choose a diagram type to filter nodes by
  1. All diagram types
  2. Outcome-Opportunity Map
  3. Journey Map
  4. Service Blueprint
  5. IA Place Map
  6. Scenario Flow
  7. UI Contracts (current)
Choose a number: 1
Chosen: All diagram types filter

Choose a relationship type
  1. [Filter relationships by diagram type: All diagram types]
  2. P-100 CONTAINS Place — Put a Place inside Dashboard.
  3. P-100 CONTAINS ViewState — Put a ViewState inside Dashboard.
  4. P-100 COMPOSED_OF Component — Make a Component part of Dashboard.
  5. P-100 NAVIGATES_TO Place — Navigate from Dashboard to a Place.
  6. P-100 CONSTRAINED_BY Policy — Apply a Policy to Dashboard.
Choose a number: 5
Chosen: P-100 NAVIGATES_TO Place

Choose destination for P-100 NAVIGATES_TO Place
  1. P-210: Projects Overview (Place)
  2. P-300: Reports (Place)
  3. Create a new Place
Choose a number: 2
Chosen: P-100 NAVIGATES_TO P-300

Add an event trigger or guard condition to this navigation? [y/N]: n
```

**Selected response:** Relationship-first; IA Place Map; UI Contracts; clear to All diagram types; select `NAVIGATES_TO Place`; select `P-300: Reports`; no optional details.

**Provisional semantic action (descriptive only):** Recompute the same outgoing relationship/type browse step for each diagram selection, then preserve the relationship-first selection when one combination is chosen.

**Why the choice constrains the next menu:** A selected diagram prioritizes combinations native to that diagram. Valid bridge combinations remain afterward with one understandable annotation. Changing or clearing affects only the current option set and never advances to named destinations prematurely.

**Expected semantic proposal:** Add `P-100 NAVIGATES_TO P-300`; leave the existing destination where it is.

**Expected committed source effect:** Filter actions are read-only. The final proposal has the source effect specified in T02 and section 6.2.

**Proof:** UX brief 1.1.1.1 and “Notes Regarding Filtering”; issues 4 and 14. The six names and relationship classifications are bundle-derived.

### T14 — Select, Change, And Clear Diagram Type During Existing-Node-First Browsing

**Exact interaction**

```console
Choose a connection direction
  1. Outgoing: P-100 connects to another node [choose by relationship type]
  2. Outgoing: P-100 connects to another node [choose by existing destination node]
  3. Incoming: another node connects to P-100 [choose by relationship type]
  4. Incoming: another node connects to P-100 [choose by existing origin node]
Choose a number: 2
Chosen: P-100 connects to another node [choose by existing destination node]

Choose relationship from P-100 to existing destination
  1. [Filter nodes by diagram type: All diagram types]
  2. P-100 CONTAINS / NAVIGATES_TO P-210: Projects Overview (Place)
  3. P-100 CONTAINS / NAVIGATES_TO P-300: Reports (Place)
  4. P-100 CONTAINS VS-100: Summary (ViewState)
  5. P-100 COMPOSED_OF C-100: Status Card (Component)
  6. P-100 COMPOSED_OF C-200: Global Navigation (Component)
Choose a number: 1
Chosen: Change filter

Choose a diagram type to filter nodes by
  1. All diagram types (current)
  2. Outcome-Opportunity Map
  3. Journey Map
  4. Service Blueprint
  5. IA Place Map
  6. Scenario Flow
  7. UI Contracts
Choose a number: 5
Chosen: IA Place Map filter

Choose relationship from P-100 to existing destination
  1. [Filter nodes by diagram type: IA Place Map]
  2. P-100 CONTAINS / NAVIGATES_TO P-210: Projects Overview (Place)
  3. P-100 CONTAINS / NAVIGATES_TO P-300: Reports (Place)
  4. P-100 CONTAINS VS-100: Summary (ViewState) — Cross-diagram connection
  5. P-100 COMPOSED_OF C-100: Status Card (Component) — Cross-diagram connection
  6. P-100 COMPOSED_OF C-200: Global Navigation (Component) — Cross-diagram connection
Choose a number: 1
Chosen: Change filter

Choose a diagram type to filter nodes by
  1. All diagram types
  2. Outcome-Opportunity Map
  3. Journey Map
  4. Service Blueprint
  5. IA Place Map (current)
  6. Scenario Flow
  7. UI Contracts
Choose a number: 7
Chosen: UI Contracts filter

Choose relationship from P-100 to existing destination
  1. [Filter nodes by diagram type: UI Contracts]
  2. P-100 CONTAINS P-210: Projects Overview (Place)
  3. P-100 NAVIGATES_TO P-210: Projects Overview (Place) — Cross-diagram connection
  4. P-100 CONTAINS P-300: Reports (Place)
  5. P-100 NAVIGATES_TO P-300: Reports (Place) — Cross-diagram connection
  6. P-100 CONTAINS VS-100: Summary (ViewState)
  7. P-100 COMPOSED_OF C-100: Status Card (Component)
  8. P-100 COMPOSED_OF C-200: Global Navigation (Component)
Choose a number: 1
Chosen: Change filter

Choose a diagram type to filter nodes by
  1. All diagram types
  2. Outcome-Opportunity Map
  3. Journey Map
  4. Service Blueprint
  5. IA Place Map
  6. Scenario Flow
  7. UI Contracts (current)
Choose a number: 1
Chosen: All diagram types filter

Choose relationship from P-100 to existing destination
  1. [Filter nodes by diagram type: All diagram types]
  2. P-100 CONTAINS / NAVIGATES_TO P-210: Projects Overview (Place)
  3. P-100 CONTAINS / NAVIGATES_TO P-300: Reports (Place)
  4. P-100 CONTAINS VS-100: Summary (ViewState)
  5. P-100 COMPOSED_OF C-100: Status Card (Component)
  6. P-100 COMPOSED_OF C-200: Global Navigation (Component)
Choose a number: 2
Chosen: P-100 CONTAINS / NAVIGATES_TO P-210

Choose how P-100: Dashboard connects to P-210: Projects Overview
  1. P-100 CONTAINS P-210 — Put Projects Overview inside Dashboard.
  2. P-100 NAVIGATES_TO P-210 — Navigate from Dashboard to Projects Overview.
Choose a number: 2
Chosen: P-100 NAVIGATES_TO P-210

Add an event trigger or guard condition to this navigation? [y/N]: n
```

**Selected response:** Existing-target-first; IA Place Map; UI Contracts; clear to All diagram types; `P-210: Projects Overview`; `NAVIGATES_TO`; no optional details.

**Provisional semantic action (descriptive only):** Recompute the same named-target browse step for each diagram selection, then constrain the relationship menu by the selected node's exact type and outgoing direction.

**Why the choice constrains the next menu:** Filtering ranks or annotates valid existing relationship-target combos. If multiple relationship types apply to a target, they are combined in a single line item. When a "Cross-diagram connection" annotations applies, the annotated relationship is always shown on a line of its own. After choosing `P-210` the exact two-item `Place Place` relationship menu appears, where the relationship then is disambiguated by the follow-up choice.

**Expected semantic proposal:** Add `P-100 NAVIGATES_TO P-210`; preserve the target location.

**Expected committed source effect:** The same source effect as T04.

**Proof:** UX brief 1.2.1.1 and “Notes Regarding Filtering”; issues 4, 5, 7, and 14.

### T15 — Contextual Optional Node And Relationship Details

**Exact interaction**

```console
New node ID [P-301]: P-301
New node Name: Settings
New node Description: Configuration and preferences
Add more details about P-301: Settings? [y/N]: y

Owner (optional): Product Experience
Surface (optional): web
Route or key (optional): /settings
Access (optional): signed-in users
Entry points (optional):
Primary navigation (optional):

Add an event trigger or guard condition to this navigation? [y/N]: y
Trigger (optional):
Condition (optional): signed_in

Where to place P-301: Settings
  1. Immediately after P-100: Dashboard at top level — Recommended
  2. At top level, last
Choose a number: 1
Chosen: Immediately after P-100: Dashboard at top level
```

**Selected response:** Complete ID, name, and description first; disclose additional Place details; supply owner, surface, route, and access; disclose navigation details; supply only a condition; accept after-anchor placement.

**Provisional semantic action (descriptive only):** Add the entered optional node properties and the supported navigation condition to the new-node proposal from T03.

**Why the choice constrains the next menu:** The node type determines which optional labels are offered. The relationship type determines that trigger and condition are supported; a relationship with no optional fields would skip the second disclosure question entirely.

**Expected semantic proposal:** Add `P-301: Settings` with description, owner, surface, route, and access; add `P-100 NAVIGATES_TO P-301` with condition `signed_in`; place the new destination after the anchor.

**Expected committed source effect:** The new node contains the entered properties only, and the inserted relationship uses the supported condition annotation:

```sdd
Place P-100 "Dashboard"
  COMPOSED_OF C-100 "Status Card"
  NAVIGATES_TO P-301 "Settings" {signed_in}

  + Component C-100 "Status Card"
  END
END

Place P-301 "Settings"
  description="Configuration and preferences"
  owner="Product Experience"
  surface=web
  route_or_key=/settings
  access="signed-in users"
END
```

**Proof:** UX brief create-new-node sub-flow and progressive disclosure; issue 8 and issue 13.

### T16 — Proposal Review Followed By One Warning-Free Save

This transcript begins with the warning-free standalone proposal from T01.

**Exact interaction**

```console
Review proposed addition
  Add Place P-301: Settings
  Description: Configuration and preferences
  Place P-301 at top level, last

Save these changes?
  1. Save
  2. Cancel
Choose a number: 1
Chosen: Save changes

Saved guided-addition-acceptance.sdd.
```

**Selected response:** Save.

**Provisional semantic action (descriptive only):** Ask the authoring service to verify and commit the reviewed proposal in one user-owned Save decision.

**Why the choice constrains the next menu:** There is no next ordinary decision when verification is warning-free. Internal verification is not presented as another commit choice.

**Expected semantic proposal:** The unchanged T01 proposal is the only content submitted for verification and commit.

**Expected committed source effect:** Exactly one new top-level `P-301` definition is appended with a separating blank line; the file is written once after Save.

**Proof:** UX brief “Content Delivery, Not Document Editing”; issues 1, 2, 3, 9, and 12.

### T17 — Save With A Concrete Warning, Then Save Anyway

This transcript begins with the duplicate incoming navigation proposal from T05.

**Exact interaction**

```console
Review proposed addition
  Add relationship: P-210: Projects Overview NAVIGATES_TO P-100: Dashboard
  Leave both existing nodes where they are

Save these changes?
  1. Save
  2. Cancel
Choose a number: 1
Chosen: Save changes

Warning
  P-210: Projects Overview already has this exact navigation to P-100: Dashboard.

Save anyway?
  1. Save anyway
  2. Go back
Choose a number: 1
Chosen: Save anyway

Saved guided-addition-acceptance.sdd.
```

**Selected response:** Save; after the concrete duplicate warning, Save anyway.

**Provisional semantic action (descriptive only):** Verify the reviewed proposal, pause on the exact duplicate warning, and commit only after informed warning acceptance.

**Why the choice constrains the next menu:** The second decision exists solely because verification discovered a concrete condition after Save. It is not an unconditional second commit moment.

**Expected semantic proposal:** The proposal stays unchanged; warning acceptance does not create a new or altered proposal.

**Expected committed source effect:** Add one additional `NAVIGATES_TO P-100 "Dashboard"` directly after the existing identical line in `P-210`; no node moves and no other source changes.

**Proof:** UX brief Save/Cancel ownership and bundle duplicate-edge warning; issues 2, 3, 7, and 11.

### T18 — Cancel From Proposal Review With No Write

This transcript begins with the standalone proposal from T01.

**Exact interaction**

```console
Review proposed addition
  Add Place P-301: Settings
  Description: Configuration and preferences
  Place P-301 at top level, last

Save these changes?
  1. Save
  2. Cancel
Choose a number: 2
Chosen: Cancel

Canceled. No changes were made.
```

**Selected response:** Cancel.

**Provisional semantic action (descriptive only):** Discard the in-memory proposal without invoking a write.

**Why the choice constrains the next menu:** Cancel terminates the interaction. No verification, warning, placement, or confirmation step follows.

**Expected semantic proposal:** Discarded; it is never submitted to the authoring service.

**Expected committed source effect:** None. The fixture remains byte-for-byte identical.

**Proof:** UX brief “Content Delivery, Not Document Editing”; issues 2 and 3.

### T19 — No-Node Launch With Starting-Node Filter, Then Outgoing Relationship-First To New P-301 

*T19 reaches the T03 relationship path when the command is launched without the --node option. It additionally proves selecting, changing, and clearing the diagram filter in the starting-node browser. After P-100 is selected, the remaining interaction is identical to T03.*

**Exact interaction**

```console
What would you like to add?
  1. Add a standalone node
  2. Add a relationship
Choose a number: 2
Chosen: Add a relationship

Choose a node to add the relationship to
  1. [Filter nodes by diagram type: All diagram types]
  2. P-100: Dashboard (Place)
  3. VS-100: Summary (ViewState)
  4. O-100: Improve project visibility (Outcome)
  5. C-100: Status Card (Component)
  6. A-200: Projects (Area)
  7. C-200: Global Navigation (Component)
  8. P-210: Projects Overview (Place)
  9. P-300: Reports (Place)
Choose a number: 1
Chosen: Change filter

Choose a diagram type to filter nodes by
  1. All diagram types (current)
  2. Outcome-Opportunity Map
  3. Journey Map
  4. Service Blueprint
  5. IA Place Map
  6. Scenario Flow
  7. UI Contracts
Choose a number: 5
Chosen: IA Place Map filter

Choose a node to add the relationship to
  1. [Filter nodes by diagram type: IA Place Map]
  2. P-100: Dashboard (Place)
  3. A-200: Projects (Area)
  4. P-210: Projects Overview (Place)
  5. P-300: Reports — Place)
Choose a number: 1
Chosen: Change filter

Choose a diagram type to filter nodes by
  1. All diagram types
  2. Outcome-Opportunity Map
  3. Journey Map
  4. Service Blueprint
  5. IA Place Map (current)
  6. Scenario Flow
  7. UI Contracts
Choose a number: 7
Chosen: UI Contracts filter

Choose a node to add the relationship to
  1. [Filter nodes by diagram type: UI Contracts]
  2. P-100: Dashboard (Place)
  3. VS-100: Summary (ViewState)
  4. C-100: Status Card (Component)
  5. C-200: Global Navigation (Component)
  6. P-210: Projects Overview (Place)
  7. P-300: Reports — Place)
Choose a number: 1
Chosen: Change filter

Choose a diagram type to filter nodes by
  1. All diagram types
  2. Outcome-Opportunity Map
  3. Journey Map
  4. Service Blueprint
  5. IA Place Map
  6. Scenario Flow
  7. UI Contracts (current)
Choose a number: 1
Chosen: All diagram types filter

Choose a node to add the relationship to
  1. [Filter nodes by diagram type: All diagram types]
  2. P-100: Dashboard (Place)
  3. VS-100: Summary (ViewState)
  4. O-100: Improve project visibility (Outcome)
  5. C-100: Status Card (Component)
  6. A-200: Projects (Area)
  7. C-200: Global Navigation (Component)
  8. P-210: Projects Overview (Place)
  9. P-300: Reports (Place)
Choose a number: 2
Chosen: P-100: Dashboard

Choose a connection direction
  1. Outgoing: P-100 connects to another node [choose by relationship type]
  2. Outgoing: P-100 connects to another node [choose by existing destination node]
  3. Incoming: another node connects to P-100 [choose by relationship type]
  4. Incoming: another node connects to P-100 [choose by existing origin node]
Choose a number: 1
Chosen: P-100 connects to another node [choose by relationship type]

Choose relationship type
  1. [Filter relationships by diagram type: All diagram types]
  2. P-100 CONTAINS Place — Put a Place inside Dashboard.
  3. P-100 CONTAINS ViewState — Put a ViewState inside Dashboard.
  4. P-100 COMPOSED_OF Component — Make a Component part of Dashboard.
  5. P-100 NAVIGATES_TO Place — Navigate from Dashboard to a Place.
  6. P-100 CONSTRAINED_BY Policy — Apply a Policy to Dashboard.
Choose a number: 5
Chosen: P-100 NAVIGATES_TO Place

Choose destination for P-100 NAVIGATES_TO Place
  1. P-210: Projects Overview (Place)
  2. P-300: Reports (Place)
  3. Create a new Place
Choose a number: 3
Chosen: P-100 NAVIGATES_TO new Place

New node ID [P-301]: P-301
New node Name: Settings
New node Description: Configuration and preferences
Add more details about P-301: Settings? [y/N]: n
Add an event trigger or guard condition to this navigation? [y/N]: n

Where to place P-301: Settings
  1. Immediately after P-100: Dashboard at top level — Recommended
  2. At top level, last
Choose a number: 1
Chosen: Immediately after P-100: Dashboard at top level
```

**Selected response:** Add a relationship; select IA Place Map, change to UI Contracts, then clear to All diagram types in the starting-node browser; select existing node `P-100: Dashboard`; choose outgoing relationship-first; navigate to a new Place; create `P-301: Settings`; provide no additional details; place it immediately after the anchor.

**Provisional semantic action (descriptive only):** Clear the starting-node diagram filter, select `P-100` as the existing node to connect, then propose the new Place, outgoing navigation, and same-level target position that follows the graph sequence.

**Why the choice constrains the next menu:** Selecting, changing, or clearing the diagram filter rerenders the same starting-node browser and preserves the Add a relationship intent. A selected diagram narrows the browser to existing nodes whose types are included in that diagram. Only selecting `P-100` advances to connection direction. Its node type then constrains the available relationship combinations, and the selected relationship combination fixes the new endpoint type as Place. Because navigation is non-structural, organization offers only same-level, graph-consistent choices and no nesting decision.

**Expected semantic proposal:** Add `P-301: Settings`, add `P-100 NAVIGATES_TO P-301`, and place the new destination immediately after `P-100` at top level.

**Expected committed source effect:** Add the relationship before `P-100`'s nested child, then add the new definition after the complete `P-100` definition with blank lines on both sides.

**Proof:** UX brief 2.0.1, 2.2—including 2.2.1.1—1.1, diagram filtering, create-new-node sub-flow, progressive disclosure, and placement; issue 14.

## 5. UX-Brief Traceability

| Transcript | UX-brief route or sub-flow | Filtering | Placement / organization | Progressive disclosure | Save / Cancel ownership |
| --- | --- | --- | --- | --- | --- |
| T01 | 2.1 Add a Node; Create New Node | Select, change, clear; standalone node types narrow | Top-level first/last, last recommended | Primary fields before contextual node details | Proposal only; T16/T18 complete it |
| T02 | 1.1 outgoing relationship-first, existing target | Browse action remains available | Existing non-structural target stays where it is | Contextual navigation details | Proposal only |
| T03 | 1.1 outgoing relationship-first, new target | Browse action remains available | New outgoing target follows origin; no nesting | Node details, then navigation details | Proposal only |
| T04 | 1.2 outgoing existing-node-first | Filter belongs to named-node browse | Existing target stays where it is | Navigation details after relationship selection | Proposal only |
| T05 | 1.3 incoming relationship-first, existing origin | Browse action remains available | Existing origin stays where it is | Navigation details; exact-match count | Warning deferred to T17 |
| T06 | 1.3 incoming relationship-first, new origin | Browse action remains available | New incoming origin precedes destination; no nesting | Node details, then navigation details | Proposal only |
| T07 | 1.4 incoming existing-node-first | Filter belongs to named-node browse | Existing nodes stay where they are | Navigation details after relationship selection | Warning deferred to T17 |
| T08 | 1.1 outgoing relationship-first, new target | Browse action remains available | Nest yes, then sibling order because one child exists | No relationship disclosure because `CONTAINS` has no optional fields | Proposal only |
| T09 | 1.1 outgoing relationship-first, new target | Browse action remains available | Nest no, then top-level order | No unsupported relationship disclosure | Proposal only |
| T10 | 1.1 outgoing relationship-first, existing target | Browse action remains available | Explicit move, sibling order, concrete effect confirmation | No unsupported relationship disclosure | Material move confirmed before review; Save remains separate |
| T11 | 1.1 outgoing relationship-first, existing target | Browse action remains available | Leave where it is; no order prompt | No unsupported relationship disclosure | Proposal only |
| T12 | 1.1 and 1.3 new non-structural endpoint | Already constrained by selected combination | Direction-specific, same-level choices only | Covered by T03/T06 | Proposal only |
| T13 | 1.1.1 relationship-first browse | Select IA, change to UI, clear; same step rerenders | Not reached | Not reached | No write while browsing |
| T14 | 1.2.1 existing-node-first browse | Select IA, change to UI, clear; same step rerenders | Existing node not moved by browsing | Not reached | No write while browsing |
| T15 | Create New Node and relationship-detail sub-flow | Combination already selected | New destination follows origin | Contextual node and navigation disclosures | Proposal only |
| T16 | Content delivery boundary | Not applicable | Reviewed effect remains unchanged | Not applicable | One warning-free Save |
| T17 | Content delivery boundary | Not applicable | Existing locations retained | Not applicable | Save, then one concrete warning decision |
| T18 | Content delivery boundary | Not applicable | Proposed effect discarded | Not applicable | Cancel performs no write |
| T19 | 2.2 starting-node browse, then 1.1 outgoing relationship-first to a new target | Select IA, change to UI, clear; starting-node types narrow and the same browse step rerenders | New outgoing target follows origin; no nesting | Node details, then navigation details | Proposal only |
Collectively, the set directly covers UX-brief sections 1.0, 1.1, 1.2, 1.3, 1.4, 2.0, 2.1, 2.2; diagram filtering; new-node placement; contextual progressive disclosure; and client-owned Save/Cancel.

## 6. Exact Source-Organization Proofs

These are acceptance expectations, not current implementation output. They must become exact source assertions in later authoring work. In each case, the fixture is reset first.

### 6.1 Blank Line Between Top-Level Definitions

After T01 followed by T16, the end of the document is exactly:

```sdd
Outcome O-100 "Improve project visibility"
END

Place P-301 "Settings"
  description="Configuration and preferences"
END
```

Acceptance assertion: there is exactly one empty line between the preceding `END` and `Place P-301`; the new declaration is not attached directly to the preceding definition.

### 6.2 Relationship Lines Before Nested Children

After T02 is saved, the complete changed anchor block is exactly:

```sdd
Place P-100 "Dashboard"
  COMPOSED_OF C-100 "Status Card"
  NAVIGATES_TO P-300 "Reports"

  + Component C-100 "Status Card"
  END
END
```

Acceptance assertion: the inserted relationship is adjacent to existing relationship content and precedes the first nested child. No user is asked where the relationship line itself should go.

### 6.3 Existing Node Left Where It Is

After T11 is saved, the affected blocks are exactly:

```sdd
Place P-100 "Dashboard"
  COMPOSED_OF C-100 "Status Card"
  CONTAINS P-210 "Projects Overview"

  + Component C-100 "Status Card"
  END
END

Area A-200 "Projects"
  CONTAINS P-210 "Projects Overview"

  + Place P-210 "Projects Overview"
    NAVIGATES_TO P-100 "Dashboard"
  END
END
```

Acceptance assertion: the `Area A-200` block, including the one nested `P-210` declaration, is byte-for-byte identical to the fixture. Only the new relationship line in `P-100` is added.

### 6.4 Accepted Move Occurs Exactly Once

After T10's move effect and an accepted Save, the affected blocks are exactly:

```sdd
Place P-100 "Dashboard"
  COMPOSED_OF C-100 "Status Card"
  CONTAINS P-210 "Projects Overview"

  + Component C-100 "Status Card"
  END

  + Place P-210 "Projects Overview"
    NAVIGATES_TO P-100 "Dashboard"
  END
END

Area A-200 "Projects"
  CONTAINS P-210 "Projects Overview"
END
```

Acceptance assertions:

- exactly one `+ Place P-210 "Projects Overview"` declaration exists in the whole source;
- that declaration is nested under `P-100`, after `C-100`;
- no `P-210` declaration remains nested under `A-200`;
- the existing `A-200 CONTAINS P-210` and `P-210 NAVIGATES_TO P-100` relationships remain unchanged;
- the move is applied once, not copied and not replayed.

## 7. Observed-Issue Coverage

| Issue | Acceptance transcripts | Required proof |
| --- | --- | --- |
| 1 — internal placement reason | T01–T18 user-facing blocks | No internal placement reason appears; placement uses ordinary language. |
| 2 — meaningless review completion | T16–T18 | Review is a proposal summary followed by a direct Save/Cancel question. |
| 3 — two routine commits | T16, T17 | T16 has one decision; T17 adds a decision only for a displayed duplicate warning. |
| 4 — collapsed relationship-first/node-first | T02–T07, T13, T14 | Four distinct prompt orders preserve direction and selection order. |
| 5 — misplaced relationship choice, unclear endpoint, missing names | T04, T07, T14 | Node-first shows named nodes first; choices include ID, name, type; next relationships are exact-type constrained. |
| 6 — nesting and forced movement | T08–T11 | Nest/no-nest precedes order; an existing node moves only by explicit choice; `no` leaves it unchanged with no order prompt. |
| 7 — endpoint wording, names, plurality | T02, T05, T07 | Destination/starting-point wording, full node identity, and `1 matching relationship already exists`. |
| 8 — unexplained advanced fields | T01, T03, T06, T08, T15 | Contextual disclosure follows primary fields; relationship disclosure names its purpose and is absent when unsupported. |
| 9 — internal source-order reason | T01–T18 user-facing blocks | No internal source-order reason appears. |
| 10 — destination before origin | T03, T06, T12 | Outgoing target choices are after origin; incoming origin choices are before destination. |
| 11 — containment in non-structural flow | T02–T07, T12, T15 | Navigation never asks about nesting; relationship-line placement is never a prompt. |
| 12 — missing blank line | T01, T03, T06, T09, T16; section 6.1 | Exact source proof preserves a blank line between top-level definitions. |
| 13 — relationship after child | T02–T11, T15; section 6.2 | Exact source proof places relationships before nested children. |
| 14 — absent diagram-type filters | T01, T13, T14, T19 | Human-readable select/change/clear actions are inside standalone-node, relationship-first, existing-node-first, and initial starting-node browse menus. The same filtering rule applies to incoming variants. |

Coverage result: **14 of 14 issues covered; no uncovered observed issue.**

## 8. Acceptance Checklist And Stop Condition

Human acceptance confirms:

- the exact four-choice relationship prompt and subsequent decision order;
- the diagram names, in-menu location, select/change/clear behavior, regular-first ordering, and bridge annotation;
- direction-aware prompts and full existing-node identity;
- contextual node and relationship detail disclosure;
- structural nest/no-nest, move/leave, and sibling-order behavior;
- graph-consistent non-structural placement;
- plain-language proposal review;
- one ordinary Save, concrete-warning confirmation, and no-write Cancel;
- the four exact source-organization proofs in section 6.

The accepted transcripts authorize the next remediation gate, not an unconstrained implementation. If any transcript cannot be represented by the shared API, correct the architecture before coding through the mismatch.

Phase decision: **ACCEPT**
