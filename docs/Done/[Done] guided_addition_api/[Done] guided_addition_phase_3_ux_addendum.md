# [Done] Guided Addition Phase 3 UX Addendum

Status: **ACCEPTED**

Phase decision: **ACCEPT**

Human approval: **ACCEPTED on 2026-08-14**

This addendum supplies the minimum missing human-facing proof needed before the Guided Addition v1 architecture can be locked. It does not reopen or replace the accepted Phase 1 transcripts. It does not define final API type, field, action, or schema names.

## 1. Authority And Boundary

This addendum interprets, in order:

1. [UX Brief for a Guided Addition API](./ux_brief_guided_addition_api.md).
2. [Guided Addition UX Acceptance Transcripts](./guided_addition_ux_acceptance_transcripts.md), which remain accepted.
3. [Guided Addition Remediation Strategy](./guided_addition_remediation_strategy.md).
4. `AGENTS.md` and the loaded bundle for structural relationship semantics and source organization.

Every transcript starts from a fresh copy of the controlled fixture in the accepted Phase 1 transcript document. Existing accepted wording and behavior remain unchanged.

## 2. Semantic Coverage Audit

| Semantic class | Existing accepted evidence | Missing proof | Addendum evidence |
| --- | --- | --- | --- |
| Four known-node routes and no-node launch | T02–T07 and T19 | None | Not repeated |
| Structural new target with one or more siblings | T08 and T09 | None | Not repeated |
| Structural new target with zero siblings | Phase 1 checklist requires no no-op order prompt | Exact interaction absent | A03 |
| Structural existing target with an existing source | T10 and T11 | None for one-or-more-sibling destination | Not repeated |
| Structural existing target with a newly created incoming source | General structural rule applies, but source placement and move/leave sequence are not shown | Move and leave paths | A01 and A02 |
| Existing-node-first relationship disambiguation | T04 and T07 show multiple valid relationships | Exact single-relationship auto-progression absent | A04 |
| Non-structural graph-consistent placement | T03, T06, and T12 | None | Not repeated |
| Diagram filter selection/change/clear | T01, T13, T14, and T19 | None | Not repeated |
| Optional details, review, Save warning, and Cancel | T15–T18 | None | Not repeated |

Coverage conclusion: A01–A04 are the minimum missing interactions. They add no new route and introduce no new bundle semantic rule.

## 3. Supplemental Acceptance Transcripts

### A01 — Incoming Structural New Source, Move Existing Target

This transcript starts with `P-100: Dashboard` as the known node. It selects the incoming relationship-first route and `Area CONTAINS P-100`, then creates the new Area source.

**Exact interaction after relationship selection**

```console
Choose starting point (origin) for Area CONTAINS P-100
  1. A-200: Projects (Area)
  2. Create a new Area
Choose a number: 2
Chosen: new Area CONTAINS P-100

New node ID [A-201]: A-201
New node Name: Dashboard Workspace
New node Description: Area containing the dashboard
Add more details about A-201: Dashboard Workspace? [y/N]: n

Nest P-100: Dashboard in A-201: Dashboard Workspace?
  1. Yes: move P-100 into A-201
  2. No: leave P-100 where it is
Choose a number: 1
Chosen: Yes: move P-100 into A-201

Confirm Moving P-100: Dashboard
  From top level
  To within A-201: Dashboard Workspace, as its only child
  A-201: Dashboard Workspace will take P-100's current top-level position.
  Existing relationships and nested content remain unchanged.
Move this node?
  1. Move it
  2. Go back
Choose a number: 1
Chosen: Move P-100
```

**Selected response:** Create incoming structural source `A-201`; move existing target `P-100` under it; confirm the exact move.

**Provisional semantic action (descriptive only):** Add the new Area at the target's former top-level position, add `A-201 CONTAINS P-100`, and move the complete `P-100` subtree under the new Area.

**Why no order menu appears:** The new Area has no children before the move. `P-100` becomes its only child, so first and last are the same. Replacing `P-100` at its former level gives the new structural source one predictable position without introducing a second source-order decision.

**Expected semantic proposal:** Add `A-201: Dashboard Workspace`; add `A-201 CONTAINS P-100`; place `A-201` where `P-100` was; move the complete existing `P-100` declaration under `A-201`; preserve `P-100`'s relationship and nested `C-100` content.

**Expected committed source effect:** The affected top-level position becomes:

```sdd
Area A-201 "Dashboard Workspace"
  description="Area containing the dashboard"
  CONTAINS P-100 "Dashboard"

  + Place P-100 "Dashboard"
    COMPOSED_OF C-100 "Status Card"

    + Component C-100 "Status Card"
    END
  END
END
```

Exactly one `P-100` declaration and one `C-100` declaration remain.

### A02 — Incoming Structural New Source, Leave Existing Target

This transcript follows A01 through creation of `A-201`, then chooses not to move the existing target.

**Exact interaction**

```console
Nest P-100: Dashboard in A-201: Dashboard Workspace?
  1. Yes: move P-100 into A-201
  2. No: leave P-100 where it is
Choose a number: 2
Chosen: No: leave P-100 where it is

Where to place A-201: Dashboard Workspace
  1. Immediately before P-100: Dashboard at top level — Recommended
  2. At top level, first
Choose a number: 1
Chosen: Immediately before P-100: Dashboard at top level
```

**Selected response:** Create incoming structural source `A-201`; leave `P-100` top-level; place the new origin immediately before its existing target.

**Provisional semantic action (descriptive only):** Add the structural relationship without moving its existing target, and apply the accepted graph-consistent placement rule to the new incoming source.

**Why the choice constrains the next menu:** Declining the move fixes `P-100`'s organization. The new Area still needs a same-level position; incoming graph order permits immediately before the target or top-level first, not after the target.

**Expected semantic proposal:** Add top-level `A-201` immediately before `P-100`; add `A-201 CONTAINS P-100`; leave the complete `P-100` declaration unchanged at top level.

**Expected committed source effect:** Add this block immediately before the unchanged `P-100` block, with one blank line between definitions:

```sdd
Area A-201 "Dashboard Workspace"
  description="Area containing the dashboard"
  CONTAINS P-100 "Dashboard"
END
```

### A03 — Structural New Target With Zero Existing Siblings

This transcript starts with `P-300: Reports`, selects outgoing relationship-first, chooses `P-300 CONTAINS Place`, and creates `P-301: Settings`.

**Exact interaction after new-node editing**

```console
Nest P-301: Settings in P-300: Reports?
  1. Yes: place P-301 in P-300
  2. No: place P-301 at top level
Choose a number: 1
Chosen: Yes: place P-301 in P-300
```

**Selected response:** Nest the new target under `P-300`; no sibling-order question follows.

**Provisional semantic action (descriptive only):** Add `P-301` as the only child of `P-300` and record its only possible sibling position automatically.

**Why no order menu appears:** `P-300` has no nested children. First and last are identical and therefore are not a meaningful human decision.

**Expected semantic proposal:** Add `P-300 CONTAINS P-301`; add `P-301: Settings` as the only nested child of `P-300`.

**Expected committed source effect:**

```sdd
Place P-300 "Reports"
  CONTAINS P-301 "Settings"

  + Place P-301 "Settings"
    description="Configuration and preferences"
  END
END
```

### A04 — Existing-Node-First With One Valid Relationship

This transcript starts with `P-100: Dashboard` and chooses outgoing existing-destination-first.

**Exact interaction**

```console
Choose relationship from P-100 to existing destination
  1. [Filter nodes by diagram type: All diagram types]
  2. P-100 CONTAINS / NAVIGATES_TO P-210: Projects Overview (Place)
  3. P-100 CONTAINS / NAVIGATES_TO P-300: Reports (Place)
  4. P-100 CONTAINS VS-100: Summary (ViewState)
  5. P-100 COMPOSED_OF C-100: Status Card (Component)
  6. P-100 COMPOSED_OF C-200: Global Navigation (Component)
Choose a number: 4
Chosen: P-100 CONTAINS VS-100

Nest VS-100: Summary in P-100: Dashboard?
  1. Yes: move VS-100 into P-100
  2. No: leave VS-100 where it is
Choose a number: 2
Chosen: No: leave VS-100 where it is
```

**Selected response:** Choose existing destination `VS-100`; accept its sole valid relationship automatically; leave the existing node where it is.

**Provisional semantic action (descriptive only):** Bind the node-first choice directly to its only bundle-valid triple, then continue to the structural organization decision without a redundant relationship picker.

**Why no relationship menu appears:** Exact types `Place → ViewState` and outgoing direction permit only `CONTAINS`. A disambiguation menu with one item would add no decision.

**Expected semantic proposal:** Add `P-100 CONTAINS VS-100`; leave the top-level `VS-100` declaration unchanged.

**Expected committed source effect:** Add `CONTAINS VS-100 "Summary"` beside `P-100`'s existing relationship content and before its nested child. No node declaration moves.

## 4. Acceptance Checklist And Stop Condition

Human acceptance should explicitly confirm or correct:

- a newly created incoming structural source replaces the moved target at its former level;
- moving the existing target into an empty new source does not show a sibling-order prompt;
- declining that move places the new incoming source by the accepted before-target graph rule;
- nesting a new target under an empty parent does not show a sibling-order prompt;
- existing-node-first with one valid relationship skips relationship disambiguation;
- all move and leave-in-place language accurately describes the committed effect.

The explicit acceptance above establishes that:

- the accepted Phase 1 transcripts remain unchanged and accepted;
- the v1 architecture may lock behavior for these semantic classes;
- Phase 4 implementation remains unauthorized.

Phase decision: **ACCEPT**
