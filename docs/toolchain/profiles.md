# Validation Profiles

Profiles change validation strictness without changing `.sdd` syntax, compiled graph shape, or projection scope. They can also adjust optional render detail, with `simple` using a lower-noise display policy where configured.

Think of `simple` as useful for expressing design structure and intent. Consider `strict` as requiring lots of specification-type detail that is great as a reference for using the .sdd file as an engineering reference, but repetitive to author. `permissive` is in-between, providing results and feedback warnings, where `strict` would stop with errors instead.

## Profile Ladder

- `simple`: low-noise drafting for early diagrams; keeps structural integrity strict and checks optional property formats only when those properties are authored
- `permissive`: warning-first completeness; keeps the current governance-oriented rules active, mostly as warnings
- `strict`: strict governance, enforcing presence of detailed metadata

In v0.1 rendering, `simple` suppresses place `route_or_key`, `access`, and `entry_points` wherever a renderer could otherwise show them. `primary_nav` remains visible only in views that already render it.

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
