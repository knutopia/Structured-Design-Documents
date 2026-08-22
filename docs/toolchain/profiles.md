# Validation Profiles

Profiles change validation strictness without changing `.sdd` syntax, compiled graph shape, projection scope, or rendering. Render detail is selected independently as `compact` or `detailed`.

Think of `simple` as useful for expressing design structure and intent. Consider `strict` as requiring lots of specification-type detail that is great as a reference for using the .sdd file as an engineering reference, but repetitive to author. `permissive` is in-between, providing results and feedback warnings, where `strict` would stop with errors instead.

## Profile Ladder

- `simple`: light-touch validation for early drafts; keeps structural integrity strict and checks optional property formats only when those properties are authored
- `permissive`: warning-first completeness; keeps the current governance-oriented rules active, mostly as warnings
- `strict`: strict governance, enforcing presence of detailed metadata

In v0.1 rendering, `compact` suppresses optional annotations such as place `route_or_key`, `access`, and `entry_points`; `detailed` includes the fuller bundle-declared display policy. `primary_nav` remains visible in views that render it. Either detail can be combined with any successful validation profile.

## When To Use Which

- Use `simple` when the goal is to capture structure and flow without filling in repetitive metadata yet. Great for communicating design structure.
- Use `permissive` when you want feedback about missing metadata but do not want governance warnings to block progress.
- Use `strict` when the model is intended to be complete, reviewable, and tool-clean. Useful if design structure is meant to provide more detailed engineering guidance.

## `primary_nav` Vs `entry_points`

- Use `primary_nav=true` only to mark that a place is part of the primary navigation.
- Use `entry_points` only when the ingress channel adds information beyond primary-nav membership.
- Typical `entry_points` cases are deep links, notifications, dashboard links, or cross-product handoffs.
- Avoid writing both `primary_nav=true` and `entry_points=nav:global_nav` unless the ingress distinction itself matters to the model.

## Authoring Guidance

- Omit repetitive defaults in `simple` unless they carry meaning for the diagram you are drawing.
- Add metadata when it clarifies behavior, ownership, routing, or access boundaries rather than because a stricter profile may require it later.
- Expect draft examples to validate under `simple` first and often fail `strict` until that richer metadata is added.
