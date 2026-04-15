# SDD Skill Guide

The SDD Skill is the simple way to work with structured design documents.

## Use Case: Start With An App Idea

If you have an app idea in mind, you can start by describing the app in plain language.

The SDD Skill helps turn that description into a structured design document.

Here is an example prompt:

```text
Use $Sdd Skill to design a mechanic's scheduling app for a communal automotive shop.     

Create a new SDD for it and show the information architecture as a simple diagram. Include: 
- Dashboard
- a Mechanic's Scheduling area with Open Shifts, Shift Detail, My Schedule
```
That is enough to get started. You do not need to know SDD syntax first (although the syntax is quite simple.)

## Output

The prompt generates the SDD file (Structured Design Document) and the information architecture diagram.

SDD full source: [communal_automotive_shop_mechanic_scheduling.sdd](examples/communal_automotive_shop_mechanic_scheduling.sdd)

Trimmed excerpt:

```text
SDD-TEXT 0.1
Place P-100 "Dashboard"
  owner=Design
  description="Shop-wide overview of today's work, staffing, and bay readiness"
  surface=web
  route_or_key=/dashboard
  access=auth
  primary_nav=true
END
Area A-200 "Mechanic's Scheduling"
  owner=Ops
  description="Mechanic-facing scheduling space for claiming shifts, reviewing shift details, and tracking assigned work"
  scope=mechanic_scheduling
  CONTAINS P-210 "Open Shifts"
  CONTAINS P-220 "Shift Detail"
  CONTAINS P-230 "My Schedule"
  + Place P-210 "Open Shifts"
    owner=Design
    description="Browsable list of unclaimed repair shifts across shared bays and specialties"
    surface=web
    route_or_key=/scheduling/open-shifts
    access=auth
    primary_nav=true
  END
```

Information architecture from that first prompt:

<a href="examples/communal_automotive_shop_mechanic_scheduling.ia_place_map.strict.svg">
  <img src="examples/communal_automotive_shop_mechanic_scheduling.ia_place_map.strict.svg" alt="Scheduling app IA after the first prompt" height="230">
</a>

## What This Creates

Instead of a vague app idea, you now have a structured design starting point, before anything is baked into code.

- A named structure for the app, with places and relationships the model can reason about.
- A visible app map that makes the overall shape easier to review.
- A concrete starting point for follow-up refinement before you move into implementation.

Behind the scenes, the skill uses editing tools that allow it to read, write and check SDD documents quickly and reliably.

## Follow-Up Request

Once the first structure exists, the next steps can stay conversational. For example:

### Add An Admin Review Area

```text
Using $sdd-skill, add an Admin Review area for coordinators who approve volunteer signups. Include "Review Customer Inquiries" and "Volunteer Detail".
Connect it from the Dashboard.

Show the IA again. Use the simple profile for it.
```

Full source: [communal_automotive_shop_mechanic_scheduling2.sdd](examples/communal_automotive_shop_mechanic_scheduling_2.sdd)

Trimmed excerpt:

```text
Area A-300 "Admin Review"
  owner=Ops
  description="Coordinator workspace for reviewing inbound requests and approving volunteer signups"
  scope=admin_review
  CONTAINS P-310 "Review Customer Inquiries"
  CONTAINS P-320 "Volunteer Detail"
  + Place P-310 "Review Customer Inquiries"
    owner=Ops
    description="Coordinator queue for triaging customer inquiries and related volunteer signup requests"
  END
```

Rendered output from the admin-area follow-up:

<a href="examples/communal_automotive_shop_mechanic_scheduling2.ia_place_map.simple.svg">
  <img src="examples/communal_automotive_shop_mechanic_scheduling2.ia_place_map.simple" alt="Scheduling app IA after adding the admin review area" height="230">
</a>

Note: because the prompt asked to use the simple profile for the IA, the diagram shows less detail.

### Add A Signup Flow And Show The UI Contracts

```text
Using $sdd-skill, add a simple signup flow in Shift Detail, with these view states:
- View Shift
- Confirm Signup
- Signup Success

Show the UI contracts. (simple profile)
```

Full source: [communal_automotive_shop_mechanic_scheduling3.sdd](examples/communal_automotive_shop_mechanic_scheduling3.sdd)

Trimmed excerpt, showing the added viewStates within Shift Detail:

```text
+ Place P-220 "Shift Detail"
    owner=Design
    description="Detailed view of a specific shift with bay, skill, and tool requirements"
    surface=web
    route_or_key=/scheduling/shifts/:shift_id
    access=auth
    CONTAINS VS-220a "View Shift"
    CONTAINS VS-220b "Confirm Signup"
    CONTAINS VS-220c "Signup Success"
    + ViewState VS-220a "View Shift"
      TRANSITIONS_TO VS-220b "Confirm Signup"
    END
    + ViewState VS-220b "Confirm Signup"
      TRANSITIONS_TO VS-220c "Signup Success"
    END
    + ViewState VS-220c "Signup Success"
    END
  END
```

Rendered output from the UI-contract follow-up, showing the viewState sequence:

<a href="examples/communal_automotive_shop_mechanic_scheduling3.ui_contracts.simple.svg">
  <img src="examples/communal_automotive_shop_mechanic_scheduling3.ui_contracts.simple.svg" alt="Scheduling app UI contracts for the shift signup flow" height="230">
</a>


## EDITS PENDING:
The same style also works for smaller follow-ups:

```text
Using $sdd-skill, update the volunteer scheduling SDD.

Rename "Open Shifts" to "Available Shifts" and show the information architecture again.
```

```text
Using $sdd-skill, undo the last change to the volunteer scheduling SDD and show the information architecture again.
```

## What Happens Behind The Scenes

- The skill creates or opens the `.sdd` document for the app idea.
- It looks at the current structure before making changes, so each follow-up builds on the actual document.
- It updates the design through the repo's structured SDD workflow instead of brittle free-form rewriting.
- It asks for a view like Information Architecture or UI Contracts so you can inspect the result visually.

For the technical workflow behind the examples, see the canonical repo skill bundle at [SKILL.md](../../../skills/sdd-skill/SKILL.md), especially [workflow.md](../../../skills/sdd-skill/references/workflow.md), [change-set-recipes.md](../../../skills/sdd-skill/references/change-set-recipes.md), and [current-helper-gaps.md](../../../skills/sdd-skill/references/current-helper-gaps.md), plus the [SDD Helper Guide](../sdd-helper/).

## Why Use The Skill Before You Start Coding

If you begin coding from a one-line request, the model has to invent the product structure at the same time it is generating implementation details. That often leads to avoidable churn.

With an SDD capturing the app design first, you give the coding model a real structure to work from. That is a much better starting point than asking an LLM to "make an app" and hoping it invents a good product shape on its own.
