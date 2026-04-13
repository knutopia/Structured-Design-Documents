# SDD Skill Guide

If you have an app idea in mind, you do not need to start by writing code. You can start by describing the app in plain language.

The SDD Skill helps turn that description into a structured design document. From there, it can show the app map, or information architecture: the main screens or places in the app and how they connect.

## Start With An App Idea

You can start with a request like this:

```text
Imagine a volunteer scheduling app for a community food pantry. Create an SDD for it and show the information architecture.
```

That is enough to get started. You do not need to know SDD syntax first.

In plain language, the information architecture is the map of the app: the main places people can go, what those places are for, and how they connect.

## What This Gives You

Instead of a vague app idea, you now have a structured design starting point.

- A named structure for the app, with places and relationships the model can reason about.
- A visible app map that makes the overall shape easier to review.
- A concrete starting point for follow-up refinement before you move into implementation.

The skill uses the repo's safer structured SDD workflow instead of relying on ad hoc text editing.

## Good Follow-Up Requests

Once the first structure exists, the next steps can stay conversational. For example:

- Add an admin review area for coordinators who approve volunteer signups.
- Show the UI contracts for signing up for a shift.
- Rename "Open Shifts" to "Available Shifts" and update the structure.
- Undo the last change.

## Why Use The Skill Before You Start Coding

If you begin coding from a one-line request, the model has to invent the product structure at the same time it is generating implementation details. That often leads to avoidable churn.

With an SDD capturing the app design first, you give the coding model a real structure to work from. That is a much better starting point than asking an LLM to "make an app" and hoping it invents a good product shape on its own.
