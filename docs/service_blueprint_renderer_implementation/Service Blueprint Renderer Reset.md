# Service Blueprint Renderer Reset

This note records the architectural reset for staged `service_blueprint` preview work.

## Why This Reset Happened

The rejected staged implementation used a two-pass `elk_lanes` design:

- run `ELK Layered` once for horizontal ordering
- snap nodes into rigid lane rows after layout
- run an interactive reroute pass
- accept renderer-side routing fallback if the reroute was unstable

That design is no longer allowed. It produced invalid routing and depended on guarantees that the current ELK toolchain does not provide.

## Accepted Constraints

- The shipped `elkjs` bundle in this repo is `elkjs@0.11.1`.
- Its registered layout algorithms include `org.eclipse.elk.layered` and `org.eclipse.elk.fixed`, but do not include `Libavoid`.
- `ELK Fixed` is not treated as a standalone obstacle router.
- `interactive` and `semiInteractive` are not treated as a fixed-position rerouting contract.
- `service_blueprint` may not snap nodes after ELK and then trust the original or partially-rerouted edge geometry.
- `service_blueprint` may not use renderer-side routing fallback on the staged preview path.
- If ELK routing is used for `service_blueprint`, `ELK Layered` must own final node placement and final routing in the same run.
- Semantic lanes and semantic columns may still be renderer-owned inputs, but they must be materialized as ELK-visible structure.

## Consequences For The Repo

- `staged_service_blueprint_preview` remains the default selected preview backend and is now implemented through the ELK-authoritative staged renderer described by the updated layout rules.
- `legacy_graphviz_preview` remains explicitly available for comparison `service_blueprint` preview output.
- The old two-pass `elk_lanes` guidance is obsolete and must not be used as the basis for new implementation work.

## Grounding Sources

Official ELK references:

- `ELK Layered`: orthogonal routing, ports, compound graphs, and cross-hierarchy edges
- `Hierarchy Handling`: `INCLUDE_CHILDREN` for single-run hierarchical layout
- `Interactive`: best-effort minimal changes, not a fixed-position rerouting guarantee
- `Position`: available as an option, but not a hard fixed-coordinate contract for the rejected path
- `ELK Fixed`: keeps current layout and optional bend points, not a standalone router

Repo-local grounding:

- the installed `elkjs` bundle was checked with `knownLayoutAlgorithms()`
- the result confirmed that `Libavoid` is not available in the shipped JavaScript bundle
