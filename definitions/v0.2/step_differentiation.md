# Step Differentiation in v0.2

v0.2 has three authorable Step types: `JourneyStep` for meaningful episodes of customer intent or behavior, `BlueprintStep` for customer behavior anchoring service delivery, and `ScenarioStep` for specific actions and decisions. Each type belongs to its corresponding primary view: `journey_map`, `service_blueprint`, or `scenario_flow`.

The [vocabulary](../../bundle/v0.2/core/vocab.yaml) and [compiled schema](../../bundle/v0.2/core/schema.json) remove the v0.2 `Step` token. `BluePrintStep` is not an alias. v0.1 retains `Step` through its own bundle.

The [syntax contract](../../bundle/v0.2/core/syntax.yaml) declares `Step` as a deprecated node token. Top-level and nested `Step` headers produce the error `parse.deprecated_node_type`: "Node type 'Step' is deprecated after v0.1. Use JourneyStep, BlueprintStep, or ScenarioStep as appropriate." This diagnostic does not make `Step` valid in v0.2.

## Relationships and Obligations

The [contracts](../../bundle/v0.2/core/contracts.yaml) govern these endpoint pairs:

| Relationship | Step endpoints |
| --- | --- |
| `CONTAINS` | `Stage → JourneyStep` |
| `PRECEDES` | Same-type pairs for each of the three types |
| `REALIZED_BY` | Each type → `Place`, `ViewState`, or `Process` |
| `INSTRUMENTED_AT` | `Metric` → each type |
| `MAPS_TO` | `JourneyStep ↔ BlueprintStep` |
| `REFINED_BY` | `JourneyStep` or `BlueprintStep` → `ScenarioStep` |

Each type inherits the previous Step property, opportunity-reference, decision-kind, and branching-marker obligations. Direct realization remains optional under `simple`, recommended under `permissive`, and required under `strict`. Required-property checks retain their existing profile applicability. The [profiles](../../bundle/v0.2/profiles/) declare the individual rule instances.

`MAPS_TO` is optional, symmetric, and many-to-many. Either authored direction establishes one correspondence; reciprocal declarations remain in the compiled graph but count once semantically. Exact repeated directed declarations retain the duplicate-edge warning. Correspondence does not merge identities, propagate properties or relationships, or imply transitive equivalence.

`REFINED_BY` is optional, directed, and non-transitive. It expresses partial elaboration, not exhaustive decomposition, containment, ownership, or execution order. A parent can have several ScenarioSteps and a ScenarioStep can refine several parents. Incoming lookup finds the parents without creating an inverse edge. Sequence still requires explicit `PRECEDES` declarations.

Mapped JourneySteps and BlueprintSteps can have different refinement sets. Neither mapping nor refinement supplies another node's realization; each parent and ScenarioStep must satisfy its own direct-realization obligation.

## Views and Authoring

The [view configuration](../../bundle/v0.2/core/views.yaml) selects the corresponding type without importing other Step types into the primary structure. It declares cross-view references independently of render detail: journey and blueprint nodes show **Maps to** and **Refined by**, while scenario nodes show **Refines**. Compact output hides these groups; detailed output shows target names and IDs, sorted by ID. Existing Opportunity references keep their ordering and display behavior.

Journey realization links remain outside the primary journey structure. Blueprint displays its Process connections; scenario displays Place and ViewState connections. All three realization target types remain globally legal.

The [authoring metadata](../../bundle/v0.2/core/authoring.yaml) defines suggested prefixes `J`, `BP`, and `S`, with the existing numeric allocation policy and profile-specific prefix validation. Forms and guided relationship choices follow the selected bundle. Both authored directions of `MAPS_TO` are available; tools neither insert a reverse declaration automatically nor warn merely because the reverse declaration exists.

## Canonical Proof

The [mixed canonical example](../../bundle/v0.2/examples/step_differentiation.sdd) demonstrates many-to-many correspondence, a reciprocal pair, different refinements with shared targets, independent sequences and direct realizations, and instrumentation of all three types.
