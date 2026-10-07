# Service Blueprint

Service Blueprint owns lane/cell geometry, route preparation, and expansion. It uses shared route search for final acceptance.

**S** = shared rendering. **R** = shared routing. Unmarked steps belong to the view unless a callback or caller is named.

## Overview

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Arial, sans-serif","fontSize":"16px","primaryColor":"#ffffff","primaryTextColor":"#172033","primaryBorderColor":"#64748b","lineColor":"#64748b"},"flowchart":{"htmlLabels":false,"curve":"linear","nodeSpacing":24,"rankSpacing":20,"padding":8}}}%%
flowchart TD
    scene["Build scene"] --> measure["S · Measure text"]
    measure --> place["S · Place nodes"]
    place --> prepare["1–2 · Prepare routes"]
    prepare --> accept["3 · R · Find legal routes"]
    accept --> finish["4 · Finish scene"]
    finish --> export["S · SVG / PNG"]
    class measure,place,export shared
    class accept routing
    class finish result
    classDef shared fill:#e8f0fc,stroke:#4977ad,color:#102a43
    classDef routing fill:#f0edff,stroke:#7461aa,color:#342a59
    classDef failure fill:#fff1f0,stroke:#b94e49,color:#702926
    classDef result fill:#edf7f0,stroke:#4e8963,color:#264632
```

After shared placement, the macro-layout helpers normalize and validate cell contents. The wrapper then adds lane titles and dividers. Optional debug artifacts capture the pre-routing, step-2, and step-3 scenes.

| Chart step | Implementation |
| --- | --- |
| Scene / placement | `buildServiceBlueprintRenderContext`, `applyServiceBlueprintPostLayoutStep` |
| Routing entrypoint | `buildServiceBlueprintRoutingStages` |

## 1. Preparation loop

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Arial, sans-serif","fontSize":"16px","primaryColor":"#ffffff","primaryTextColor":"#172033","primaryBorderColor":"#64748b","lineColor":"#64748b"},"flowchart":{"htmlLabels":false,"curve":"linear","nodeSpacing":24,"rankSpacing":20,"padding":8}}}%%
flowchart TD
    plans["Plan ports and tracks"] --> templates["Build template routes"]
    templates --> compact["Compact obstacle detours"]
    compact --> separate["Separate occupied tracks"]
    separate --> demand["Measure gutter demand"]
    demand --> grow{"Can grow?"}
    grow -->|"Yes"| expand["Grow gutters; rebuild"]
    expand --> templates
    grow -->|"No"| ready["Prepare final routes"]
    class ready result
    classDef shared fill:#e8f0fc,stroke:#4977ad,color:#102a43
    classDef routing fill:#f0edff,stroke:#7461aa,color:#342a59
    classDef failure fill:#fff1f0,stroke:#b94e49,color:#702926
    classDef result fill:#edf7f0,stroke:#4e8963,color:#264632
```

“Can grow” requires positive space demand and remaining budget. Preparation and final expansion share **four passes total**, applied to the original positioned scene. Late endpoint ordering is part of obstacle preparation.

| Chart step | Implementation |
| --- | --- |
| Plans / templates | `buildConnectorPlans`, `buildStep3ConnectorPlansForScene` |
| Compact / separate | `buildPreparedRoutesWithObstacleCompaction`, `resolveOccupancyDisplacements` |
| Expand | `applyGlobalGutterExpansions` |

## 2. Choose final candidates

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Arial, sans-serif","fontSize":"16px","primaryColor":"#ffffff","primaryTextColor":"#172033","primaryBorderColor":"#64748b","lineColor":"#64748b"},"flowchart":{"htmlLabels":false,"curve":"linear","nodeSpacing":24,"rankSpacing":20,"padding":8}}}%%
flowchart TD
    rebuild["Rebuild prepared routes"] --> order["Order endpoints"]
    order --> displace["Apply track displacement"]
    displace --> candidates["Compacted / step-3 routes"]
    candidates --> select["R · Choose clear candidate"]
    select --> context["Resolve ports and blockers"]
    context --> ready["Final routing context"]
    class select routing
    class ready result
    classDef shared fill:#e8f0fc,stroke:#4977ad,color:#102a43
    classDef routing fill:#f0edff,stroke:#7461aa,color:#342a59
    classDef failure fill:#fff1f0,stroke:#b94e49,color:#702926
    classDef result fill:#edf7f0,stroke:#4e8963,color:#264632
```

The shared selector tries the supplied candidates in order and checks orthogonality and non-endpoint node intersections. Complete acceptance happens later. The context adds marker legs, node boxes, painted lane-title blockers, and finite bounds.

| Chart step | Implementation |
| --- | --- |
| Rebuild final routes | `prepareFinal` |
| Shared selector | `selectRouteCandidate` |
| Complete acceptance | `runRoutingLifecycle` |

## 3. Acceptance and expansion

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

The callback measures implicated gutter occupancy plus facing-port marker/stub deficits. It rebuilds final preparation after growing the original baseline. The shared search is detailed in [shared routing](shared-routing.md).

| Chart step | Implementation |
| --- | --- |
| Shared search | `runRoutingLifecycle` |
| Callback | `extractGutterOccupancyByConnector`, `resolveRequiredColumnExpansions`, `resolveRequiredLaneExpansions`, `prepareFinal` |

## 4. Finish the scene

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Arial, sans-serif","fontSize":"16px","primaryColor":"#ffffff","primaryTextColor":"#172033","primaryBorderColor":"#64748b","lineColor":"#64748b"},"flowchart":{"htmlLabels":false,"curve":"linear","nodeSpacing":24,"rankSpacing":20,"padding":8}}}%%
flowchart TD
    routes["Final routes"] --> occupancy["Refresh occupancy"]
    occupancy --> labels["S · Measure and place labels"]
    labels --> intersections["Check node intersections"]
    intersections --> scene["Build final scene"]
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

Final labels use the final routed geometry. The shared emitted-route audit runs only after successful lifecycle acceptance. SVG/PNG export and the public artifact gate are covered in [shared pipeline](shared-pipeline.md).

| Chart step | Implementation |
| --- | --- |
| Labels | `createEdgeLabelMeasurementService`, `buildFinalPositionedEdgesWithLabels`, `positionConnectorLabel` |
| Scene / audit | `buildStageScene`, `validateFinalRouteSet` |

## Source files

- [serviceBlueprint.ts](../../src/renderer/staged/serviceBlueprint.ts)
- [serviceBlueprintRouting.ts](../../src/renderer/staged/serviceBlueprintRouting.ts)
- [macroLayout.ts](../../src/renderer/staged/macroLayout.ts)
- [routingCore/candidates.ts](../../src/renderer/staged/routingCore/candidates.ts)
