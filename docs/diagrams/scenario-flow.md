# Scenario Flow

Follow the overview, then the numbered routing stages. **S** marks shared rendering; **R** marks shared routing. Unmarked steps belong to Scenario Flow.

## Overview

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Arial, sans-serif","fontSize":"16px","primaryColor":"#ffffff","primaryTextColor":"#172033","primaryBorderColor":"#64748b","lineColor":"#64748b"},"flowchart":{"htmlLabels":false,"curve":"linear","nodeSpacing":24,"rankSpacing":20,"padding":8}}}%%
flowchart TD
    scene["Build scene"] --> measure["S · Measure text"]
    measure --> place["S · Place nodes"]
    place --> prepare["1–2 · Prepare routes"]
    prepare --> accept["3–4 · Accept routes"]
    accept --> finish["5 · Finish scene"]
    finish --> export["S · SVG / PNG"]
    class measure,place,export shared
    class finish result
    classDef shared fill:#e8f0fc,stroke:#4977ad,color:#102a43
    classDef routing fill:#f0edff,stroke:#7461aa,color:#342a59
    classDef failure fill:#fff1f0,stroke:#b94e49,color:#702926
    classDef result fill:#edf7f0,stroke:#4e8963,color:#264632
```

Scene construction includes the render model, lane/track middle layer, grid cells, and edges. Node placement adds lane titles and dividers before routing. Export and the public artifact gate are covered in [shared pipeline](shared-pipeline.md).

| Chart step | Implementation |
| --- | --- |
| Build scene | `buildScenarioFlowRenderContext` |
| Measure / place | `measureScene` → `positionMeasuredSceneBeforeRouting` |
| Route stages | `buildScenarioFlowRoutingStages` |

## 1. Preparation loop

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Arial, sans-serif","fontSize":"16px","primaryColor":"#ffffff","primaryTextColor":"#172033","primaryBorderColor":"#64748b","lineColor":"#64748b"},"flowchart":{"htmlLabels":false,"curve":"linear","nodeSpacing":24,"rankSpacing":20,"padding":8}}}%%
flowchart TD
    plans["Plan ports and tracks"] --> templates["Build template routes"]
    templates --> refine["2 · Refine routes"]
    refine --> occupancy["Resolve track occupancy"]
    occupancy --> demand["Measure space needed"]
    demand --> capacity["R · Check capacity"]
    capacity --> grow{"Can grow?"}
    grow -->|"No"| ready["Prepared routes"]
    grow -->|"Yes"| expand["Grow gutters"]
    expand --> templates
    class capacity routing
    class ready result
    classDef shared fill:#e8f0fc,stroke:#4977ad,color:#102a43
    classDef routing fill:#f0edff,stroke:#7461aa,color:#342a59
    classDef failure fill:#fff1f0,stroke:#b94e49,color:#702926
    classDef result fill:#edf7f0,stroke:#4e8963,color:#264632
```

“Can grow” requires positive capacity demand and remaining budget. Preparation and final expansion share **eight passes total**. Expansions accumulate against the original positioned scene. Step-2 and step-3 debug scenes capture the initial templates and refinement, before the expansion loop.

| Chart step | Implementation |
| --- | --- |
| Plan ports and tracks | `buildConnectorPlans`, `buildNodeEdgeBuckets`, `buildEndpointOffsets` |
| Template / refine | `buildTemplateRoute`, `buildStep3Routes` |
| Resolve occupancy | `resolveOccupancyCoordinates` |
| Shared capacity check | `measureRoutingCorridorDeficits` |
| Grow gutters | `applyGlobalGutterExpansions` |

## 2. Route refinement

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Arial, sans-serif","fontSize":"16px","primaryColor":"#ffffff","primaryTextColor":"#172033","primaryBorderColor":"#64748b","lineColor":"#64748b"},"flowchart":{"htmlLabels":false,"curve":"linear","nodeSpacing":24,"rankSpacing":20,"padding":8}}}%%
flowchart TD
    route["Start with template"] --> obstacles["Avoid node boxes"]
    obstacles --> compact["Apply coordinates; compact"]
    compact --> occupancy["Measure occupied tracks"]
    occupancy --> local["Separate local groups"]
    local --> clamp["Clamp obstacle turns"]
    clamp --> collapse["Collapse source detours"]
    collapse --> ready["Refresh occupancy"]
    class ready result
    classDef shared fill:#e8f0fc,stroke:#4977ad,color:#102a43
    classDef routing fill:#f0edff,stroke:#7461aa,color:#342a59
    classDef failure fill:#fff1f0,stroke:#b94e49,color:#702926
    classDef result fill:#edf7f0,stroke:#4e8963,color:#264632
```

Occupancy is rebuilt after local separation, clamping, and collapse. Supplied segment coordinates can trigger another obstacle-refinement pass before compaction. These steps are view-owned; “bundle-local” in the code names a connector grouping.

| Chart step | Implementation |
| --- | --- |
| Refine route | `buildPreparedRoutes`, `buildStep3Routes` |
| Avoid / compact | `refineRouteAgainstObstacles`, `applyObstacleLocalCompaction` |
| Measure / separate | `buildOccupancyByConnector`, `resolveOccupancyCoordinates` |
| Clamp / collapse | `resolveObstacleBoundaryClampCoordinates`, `applySourceEdgeSwerveEntryCollapse` |

## 3. Prepare acceptance

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Arial, sans-serif","fontSize":"16px","primaryColor":"#ffffff","primaryTextColor":"#172033","primaryBorderColor":"#64748b","lineColor":"#64748b"},"flowchart":{"htmlLabels":false,"curve":"linear","nodeSpacing":24,"rankSpacing":20,"padding":8}}}%%
flowchart TD
    prepared["Rebuild prepared routes"] --> bounds["Include route extents"]
    bounds --> context["Resolve final ports"]
    context --> bottom["Try bottom exits"]
    bottom --> proposals["R · Propose corridors"]
    proposals --> trials["R · Check trial routes"]
    trials --> selected["Fix chosen port sides"]
    selected --> ready["Final routing context"]
    class proposals,trials routing
    class ready result
    classDef shared fill:#e8f0fc,stroke:#4977ad,color:#102a43
    classDef routing fill:#f0edff,stroke:#7461aa,color:#342a59
    classDef failure fill:#fff1f0,stroke:#b94e49,color:#702926
    classDef result fill:#edf7f0,stroke:#4e8963,color:#264632
```

The context includes ports, marker legs, node boxes, lane-title blockers, and finite bounds. Each eligible bottom exit is considered once, with at most 65 candidates. Only legal whole-route-set trials with an acceptable cost are committed.

| Chart step | Implementation |
| --- | --- |
| Rebuild / resolve context | `prepareFinalContext` |
| Bottom exits | `selectOptionalBottomExits` |
| Shared proposals / checks | `buildPortCorridorCandidates`, `validateFinalRouteSet` |

## 4. Acceptance and expansion

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Arial, sans-serif","fontSize":"16px","primaryColor":"#ffffff","primaryTextColor":"#172033","primaryBorderColor":"#64748b","lineColor":"#64748b"},"flowchart":{"htmlLabels":false,"curve":"linear","nodeSpacing":24,"rankSpacing":20,"padding":8}}}%%
flowchart TD
    search["R · Find legal routes"] --> resolved{"Resolved?"}
    resolved -->|"Yes"| accepted["Use accepted routes"]
    resolved -->|"No"| failed["Record failure"]
    search -.->|"Expansion request"| deficit["Measure port gaps"]
    deficit --> funded{"Can grow?"}
    funded -->|"Yes"| rebuild["Grow and rebuild"]
    rebuild -.-> search
    funded -->|"No"| stop["Stop expanding"]
    class search routing
    class accepted result
    class failed,stop failure
    classDef shared fill:#e8f0fc,stroke:#4977ad,color:#102a43
    classDef routing fill:#f0edff,stroke:#7461aa,color:#342a59
    classDef failure fill:#fff1f0,stroke:#b94e49,color:#702926
    classDef result fill:#edf7f0,stroke:#4e8963,color:#264632
```

The callback can grow geometry for measured facing-port and marker/stub deficits. It can return no expansion even when route violations remain. The detailed search and its stopping conditions are in [shared routing](shared-routing.md). Failed routing retains diagnostic geometry and records its reason and trace.

| Chart step | Implementation |
| --- | --- |
| Shared search | `runRoutingLifecycle` |
| Expansion callback | `buildScenarioFlowRoutingStages` callback → `prepareFinalContext` |

## 5. Finish the scene

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Arial, sans-serif","fontSize":"16px","primaryColor":"#ffffff","primaryTextColor":"#172033","primaryBorderColor":"#64748b","lineColor":"#64748b"},"flowchart":{"htmlLabels":false,"curve":"linear","nodeSpacing":24,"rankSpacing":20,"padding":8}}}%%
flowchart TD
    routes["Final routes"] --> intersections["Check node intersections"]
    intersections --> labels["S · Place labels"]
    labels --> scene["Build final scene"]
    scene -->|"If resolved"| audit["R · Check emitted routes"]
    scene -->|"Otherwise"| refresh["Refresh final occupancy"]
    audit --> refresh
    refresh --> result["Scene and diagnostics"]
    class labels shared
    class audit routing
    class result result
    classDef shared fill:#e8f0fc,stroke:#4977ad,color:#102a43
    classDef routing fill:#f0edff,stroke:#7461aa,color:#342a59
    classDef failure fill:#fff1f0,stroke:#b94e49,color:#702926
    classDef result fill:#edf7f0,stroke:#4e8963,color:#264632
```

Labels avoid nodes, dividers, routes, and earlier labels. Emitted routes receive a full shared audit only after the lifecycle resolves. Optional-exit occupancy and endpoint buckets are refreshed before returning.

| Chart step | Implementation |
| --- | --- |
| Intersection / labels / scene | `emitFinalIntersectionDiagnostics`, `placeLabels`, `withEdgesAndDiagnostics` |
| Shared label placement | `positionConnectorLabel` |
| Shared emitted audit | `validateFinalRouteSet` |
| Final occupancy | `refreshOptionalExitOccupancy` |

## Source files

| File | Role |
| --- | --- |
| [scenarioFlow.ts](../../src/renderer/staged/scenarioFlow.ts) | Scene construction, positioning, artifact wrappers |
| [scenarioFlowRouting.ts](../../src/renderer/staged/scenarioFlowRouting.ts) | Preparation, endpoint selection, expansion, finalization |
| [capacity.ts](../../src/renderer/staged/routingCore/capacity.ts) | Shared capacity measurement |
| [lifecycle.ts](../../src/renderer/staged/routingCore/lifecycle.ts) | Shared acceptance and complete route validation |

Implementation reference: `6a784814f6e9c70b207c19efb6ec267551a2c98e`, 2026-10-06.
