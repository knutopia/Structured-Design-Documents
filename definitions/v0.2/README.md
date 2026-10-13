# SDD-Text v0.2 definitions

The machine-readable contract for v0.2 lives in [`bundle/v0.2/manifest.yaml`](../../bundle/v0.2/manifest.yaml) and the bundle files it names. These definitions explain decisions and rationale; they do not override bundle behavior.

v0.2 starts from the preserved [`bundle/v0.1/`](../../bundle/v0.1/) baseline. The historical [`definitions/v0.1/`](../v0.1/) documents explain that baseline and its original extraction into a bundle. They are not a separate v0.2 specification.

When a v0.2 language feature is added, update the relevant bundle contract and generic runtime path first, then document the change here or in a focused v0.2 definition. State how it differs from v0.1 and link the bundle fields that govern it. Keep the two versions' examples and snapshot checks aligned with their own bundles.

- [Step differentiation](step_differentiation.md): distinct journey, blueprint, and scenario types; explicit correspondence and refinement; migration from v0.1.

### IA renderer routing ownership

`core/views.yaml` optionally declares `renderer_defaults.ia_place_map.routing_scope`.
`container_node_types` selects included semantic types that the IA adapter represents
as identified scene containers (currently Area). An empty selection declares no
container owners. `internal_routes: within_common_owner` scopes internal paths to
their common selected owner; `cross_owner_routes: through_common_ancestor` permits
cross-owner traversal through endpoint owners and their common ancestor. The staged
scene resolves selectors against the selected projection and carries container IDs
and policy through measurement and positioning. Geometry remains renderer-owned;
this policy adds no containment semantics. Absence retains the existing routing
ownership behavior, including the preserved v0.1 bundle. The canonical bundle
fingerprint includes this policy through its existing views input.
