# Outcome–Opportunity Map

This renderer owns lane/column routes, occupancy preparation, and aggregate-label policy. It delegates final route search to the shared lifecycle.

**S** = shared rendering. **R** = shared routing. Unmarked steps belong to the view unless a callback or caller is named.

## Overview

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Arial, sans-serif","fontSize":"16px","primaryColor":"#ffffff","primaryTextColor":"#172033","primaryBorderColor":"#64748b","lineColor":"#64748b"},"flowchart":{"htmlLabels":false,"curve":"linear","nodeSpacing":24,"rankSpacing":20,"padding":8}}}%%
flowchart TD
    scene["Build scene"] --> measure["S · Measure text"]
    measure --> place["S · Place nodes"]
    place --> prepare["1 · Prepare routes"]
    prepare --> accept["2 · R · Find legal routes"]
    accept --> finish["3 · Finish scene"]
    finish --> export["S · SVG / PNG"]
    class measure,place,export shared
    class accept routing
    class finish result
    classDef shared fill:#e8f0fc,stroke:#4977ad,color:#102a43
    classDef routing fill:#f0edff,stroke:#7461aa,color:#342a59
    classDef failure fill:#fff1f0,stroke:#b94e49,color:#702926
    classDef result fill:#edf7f0,stroke:#4e8963,color:#264632
```

The render model and middle layer define columns, lanes, cells, and edges. The wrapper adds decorations after shared placement. Initial template and refined routes have separate debug scenes.

| Chart step | Implementation |
| --- | --- |
| Scene / placement | `buildOutcomeOpportunityRenderContext`, `buildOutcomeOpportunityPreRoutingPipeline` |
| Routing entrypoint | `buildOutcomeOpportunityMapRoutingStages` |

## 1. Preparation loop

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Arial, sans-serif","fontSize":"16px","primaryColor":"#ffffff","primaryTextColor":"#172033","primaryBorderColor":"#64748b","lineColor":"#64748b"},"flowchart":{"htmlLabels":false,"curve":"linear","nodeSpacing":24,"rankSpacing":20,"padding":8}}}%%
flowchart TD
    templates["Build step-3 routes"] --> compact["Compact and separate"]
    compact --> demand["Measure gutter demand"]
    demand --> trim["Drop unfundable requests"]
    trim --> grow{"Can grow?"}
    grow -->|"Yes"| expand["Grow gutters; rebuild"]
    expand --> compact
    grow -->|"No"| ready["Prepare final routes"]
    class ready result
    classDef shared fill:#e8f0fc,stroke:#4977ad,color:#102a43
    classDef routing fill:#f0edff,stroke:#7461aa,color:#342a59
    classDef failure fill:#fff1f0,stroke:#b94e49,color:#702926
    classDef result fill:#edf7f0,stroke:#4e8963,color:#264632
```

Requests beyond the last occupied row/column cannot create capacity and are discarded. Preparation and final expansion share **four passes total**. Each expansion is applied to the original positioned scene; the existing step-3 plans are rebuilt against the new geometry.

| Chart step | Implementation |
| --- | --- |
| Templates / detours | `routePlansForScene`, `applyLocalSwervesToStep3Plans` |
| Compact / separate | `buildPreparedRoutesWithObstacleCompaction`, `resolveOccupancyDisplacements` |
| Expand / final preparation | `applyGlobalGutterExpansions`, `prepareFinalRoutes` |

## 2. Acceptance and expansion

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Arial, sans-serif","fontSize":"16px","primaryColor":"#ffffff","primaryTextColor":"#172033","primaryBorderColor":"#64748b","lineColor":"#64748b"},"flowchart":{"htmlLabels":false,"curve":"linear","nodeSpacing":24,"rankSpacing":20,"padding":8}}}%%
flowchart TD
    search["R · Find legal routes"] --> status{"Resolved?"}
    status -->|"Yes"| routes["Use accepted routes"]
    status -->|"No"| fail["Record failure"]
    search -.->|"Expansion request"| demand["Measure current demand"]
    demand --> grow{"Can grow?"}
    grow -->|"Yes"| rebuild["Grow and rebuild"]
    rebuild -.-> search
    grow -->|"No"| stop["Stop expanding"]
    class search routing
    class routes result
    class fail,stop failure
    classDef shared fill:#e8f0fc,stroke:#4977ad,color:#102a43
    classDef routing fill:#f0edff,stroke:#7461aa,color:#342a59
    classDef failure fill:#fff1f0,stroke:#b94e49,color:#702926
    classDef result fill:#edf7f0,stroke:#4e8963,color:#264632
```

Final preparation resolves endpoint order, displacement, marker legs, node boxes, and finite bounds. The callback derives gutter demand from the current route set and violations. The shared search is detailed in [shared routing](shared-routing.md).

| Chart step | Implementation |
| --- | --- |
| Final context | `prepareFinalRoutes` |
| Shared search | `runRoutingLifecycle` |
| Expansion callback | `resolveFinalValidationGutterDemand` |

## 3. Finish the scene

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Arial, sans-serif","fontSize":"16px","primaryColor":"#ffffff","primaryTextColor":"#172033","primaryBorderColor":"#64748b","lineColor":"#64748b"},"flowchart":{"htmlLabels":false,"curve":"linear","nodeSpacing":24,"rankSpacing":20,"padding":8}}}%%
flowchart TD
    routes["Final routes"] --> occupancy["Refresh occupancy"]
    occupancy --> intersections["Check node intersections"]
    intersections --> aggregate["Choose aggregate labels"]
    aggregate --> labels["S · Place labels"]
    labels --> scene["Build final scene"]
    scene -->|"If resolved"| audit["R · Check emitted routes"]
    scene -->|"Otherwise"| output["Scene and diagnostics"]
    audit --> output
    class labels shared
    class audit routing
    class output result
    classDef shared fill:#e8f0fc,stroke:#4977ad,color:#102a43
    classDef routing fill:#f0edff,stroke:#7461aa,color:#342a59
    classDef failure fill:#fff1f0,stroke:#b94e49,color:#702926
    classDef result fill:#edf7f0,stroke:#4e8963,color:#264632
```

Aggregate-label selection is view-owned. The shared label placer receives the suppressed edge IDs and aggregate-label obstacles. Emitted routes receive a full shared audit only after successful lifecycle acceptance.

| Chart step | Implementation |
| --- | --- |
| Aggregate labels | `buildOutcomeOpportunityAggregateLabelDecision` |
| Shared label placement | `placeLabels` → `positionConnectorLabel` |
| Scene / audit | `withStep2EdgesAndDiagnostics`, `validateFinalRouteSet` |

## Source files

- [outcomeOpportunityMap.ts](../../src/renderer/staged/outcomeOpportunityMap.ts)
- [outcomeOpportunityMapRouting.ts](../../src/renderer/staged/outcomeOpportunityMapRouting.ts)
- [routingCore/lifecycle.ts](../../src/renderer/staged/routingCore/lifecycle.ts)
