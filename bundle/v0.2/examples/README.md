# Canonical v0.2 examples

These examples declare `SDD-TEXT 0.2` and use the [v0.2 bundle](../manifest.yaml). Inherited examples have been explicitly migrated where they previously used `Step`; the [v0.1 examples](../../v0.1/examples/) remain the compatibility baseline.

| Examples | Primary content |
| --- | --- |
| `outcome_to_ia_trace`, `branching_journey`, `three_branch_journey` | JourneySteps with `J` IDs |
| `service_blueprint_slice` | BlueprintSteps with `BP` IDs; service-blueprint projection |
| `scenario_branching`, `flow_journey_topology_challenge` | ScenarioSteps with `S` IDs |
| `metric_event_instrumentation` | ScenarioStep instrumentation with an `S` ID |
| `step_differentiation` | Two JourneySteps, two BlueprintSteps, three ScenarioSteps; correspondence, refinement, realization and instrumentation |

The manifest lists each intended projection and snapshot. The mixed proof has journey, service-blueprint, and scenario projections. See the [Step definition](../../../definitions/v0.2/step_differentiation.md) and [versioned rendered corpus](../../../examples/rendered/v0.2/README.md).
