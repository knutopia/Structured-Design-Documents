# Validation Profiles

Profiles change validation strictness without changing `.sdd` syntax, compiled graph shape, or renderer behavior.

## Profile Ladder

- `simple`: low-noise drafting for early diagrams; keeps structural integrity strict and checks optional property formats only when those properties are authored
- `permissive`: warning-first completeness; keeps the current governance-oriented rules active, mostly as warnings
- `recommended`: strict governance for production-ready models

## When To Use Which

- Use `simple` when the goal is to capture structure and flow without filling in repetitive metadata yet.
- Use `permissive` when you want broad feedback but do not want governance warnings to block progress.
- Use `recommended` when the model is intended to be complete, reviewable, and tool-clean.

## `primary_nav` Vs `entry_points`

- Use `primary_nav=true` only to mark that a place is part of the primary navigation.
- Use `entry_points` only when the ingress channel adds information beyond primary-nav membership.
- Typical `entry_points` cases are deep links, notifications, dashboard links, or cross-product handoffs.
- Avoid writing both `primary_nav=true` and `entry_points=nav:global_nav` unless the ingress distinction itself matters to the model.

## Authoring Guidance

- Omit repetitive defaults in `simple` unless they carry meaning for the diagram you are drawing.
- Add metadata when it clarifies behavior, ownership, routing, or access boundaries rather than because a stricter profile may require it later.
- Expect draft examples to validate under `simple` first and often fail `recommended` until that richer metadata is added.
