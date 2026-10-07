# Journey Map

Journey Map owns route families, preparation, expansion, and final validation. It calls the shared track solver directly.

**S** = shared rendering. **R** = shared routing. Unmarked steps belong to the view unless a callback or caller is named.

## Overview

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Arial, sans-serif","fontSize":"16px","primaryColor":"#ffffff","primaryTextColor":"#172033","primaryBorderColor":"#64748b","lineColor":"#64748b"},"flowchart":{"htmlLabels":false,"curve":"linear","nodeSpacing":24,"rankSpacing":20,"padding":8}}}%%
flowchart TD
    scene["Build scene"] --> measure["S · Measure text"]
    measure --> place["S · Place nodes"]
    place --> prepare["1 · Prepare route families"]
    prepare --> accept["2–3 · Resolve tracks"]
    accept --> finish["4 · Finish scene"]
    finish --> export["S · SVG / PNG"]
    class measure,place,export shared

    class finish result
    classDef shared fill:#e8f0fc,stroke:#4977ad,color:#102a43
    classDef routing fill:#f0edff,stroke:#7461aa,color:#342a59
    classDef failure fill:#fff1f0,stroke:#b94e49,color:#702926
    classDef result fill:#edf7f0,stroke:#4e8963,color:#264632
```

Scene construction reads the loaded Journey layout policy and builds nested Stages, root Steps, branch groups, and lineages. Placement aligns uncontained Steps with Stage content. Journey does not call the shared final-routing lifecycle.

| Chart step | Implementation |
| --- | --- |
| Scene | `buildJourneyMapRendererScene`, `buildJourneyScenePlacement` |
| Placement / routing | `positionJourneyMapMeasuredSceneBeforeRouting`, `buildJourneyMapRoutingStages` |

## 1. Admit and build routes

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Arial, sans-serif","fontSize":"16px","primaryColor":"#ffffff","primaryTextColor":"#172033","primaryBorderColor":"#64748b","lineColor":"#64748b"},"flowchart":{"htmlLabels":false,"curve":"linear","nodeSpacing":24,"rankSpacing":20,"padding":8}}}%%
flowchart TD
    index["Index nodes and topology"] --> edge["Read next authored edge"]
    edge --> admit{"Admitted?"}
    admit -->|"Yes"| ports["Choose ports and family"]
    ports --> routes["Build three route stages"]
    admit -->|"No"| record["Defer or report failure"]
    routes --> more{"More edges?"}
    record --> more
    more -->|"Yes"| edge
    more -->|"No"| check["Check stages; save debug"]
    class record failure
    class check result
    classDef shared fill:#e8f0fc,stroke:#4977ad,color:#102a43
    classDef routing fill:#f0edff,stroke:#7461aa,color:#342a59
    classDef failure fill:#fff1f0,stroke:#b94e49,color:#702926
    classDef result fill:#edf7f0,stroke:#4e8963,color:#264632
```

Indexes include degree, cycle, and duplicate-group admission. Route selection includes gates, bypasses, self-loops, duplicate fans, branches, and joins. The three stages are step-2, provisional, and final-basic. Deferred families are recorded; invalid IDs, endpoints, ownership, and failed atomic groups produce errors.

| Chart step | Implementation |
| --- | --- |
| Route orchestration | `buildJourneyMapRoutingStagesInternal` |
| Admission / family | `resolveRouteEligibility`, `buildBranchPlan`, `buildJoinPlan` |
| Stage checks | `validateJourneyMapBasicRoutes`, `validateJourneyMapRoutes` |

## 2. Prepare physical tracks

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Arial, sans-serif","fontSize":"16px","primaryColor":"#ffffff","primaryTextColor":"#172033","primaryBorderColor":"#64748b","lineColor":"#64748b"},"flowchart":{"htmlLabels":false,"curve":"linear","nodeSpacing":24,"rankSpacing":20,"padding":8}}}%%
flowchart TD
    occupancy["Measure nominal occupancy"] --> state["Create route states"]
    state --> terminals["Build terminal legs"]
    terminals --> reciprocal["Separate reciprocal tracks"]
    reciprocal --> order["Order endpoints"]
    order --> stems["Separate crowded stems"]
    stems --> direct["Resolve direct-run conflicts"]
    direct --> ready["Prepared physical routes"]
    class ready result
    classDef shared fill:#e8f0fc,stroke:#4977ad,color:#102a43
    classDef routing fill:#f0edff,stroke:#7461aa,color:#342a59
    classDef failure fill:#fff1f0,stroke:#b94e49,color:#702926
    classDef result fill:#edf7f0,stroke:#4e8963,color:#264632
```

These Journey-owned transforms run before shared assignment because they can change physical runs and spans. Endpoint ordering includes both late ordering and reciprocal ordering.

| Chart step | Implementation |
| --- | --- |
| State / terminals | `buildInitialResolvedConnectorState`, `applyPreferredTerminalLegConstruction` |
| Reciprocal / order | `resolveSimpleReciprocalTracks`, `applyLateEndpointOrdering`, `applySimpleReciprocalEndpointOrdering` |
| Stems / conflicts | `resolveCrowdedPreparedStems`, `resolveLateDirectRunConflicts` |

## 3. Assign tracks

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Arial, sans-serif","fontSize":"16px","primaryColor":"#ffffff","primaryTextColor":"#172033","primaryBorderColor":"#64748b","lineColor":"#64748b"},"flowchart":{"htmlLabels":false,"curve":"linear","nodeSpacing":24,"rankSpacing":20,"padding":8}}}%%
flowchart TD
    map["Map resources to runs"] --> claims["R · Merge track claims"]
    claims --> solver["R · Solve tracks"]
    solver --> solved{"Solved?"}
    solved -->|"Yes"| rebuild["Rebuild physical routes"]
    solved -->|"No"| fail["Keep routes; add error"]
    rebuild --> crossings["Reduce crossings"]
    fail --> crossings
    crossings --> gates["Apply stage gates"]
    class claims,solver routing
    class fail failure
    classDef shared fill:#e8f0fc,stroke:#4977ad,color:#102a43
    classDef routing fill:#f0edff,stroke:#7461aa,color:#342a59
    classDef failure fill:#fff1f0,stroke:#b94e49,color:#702926
    classDef result fill:#edf7f0,stroke:#4e8963,color:#264632
```

Journey selects a 250-state shared search with 16-unit separation and a 0.001 epsilon. Crossing swaps must preserve separation and collinear-overlap quality. Shared assignment is followed by Journey reconstruction and validation.

| Chart step | Implementation |
| --- | --- |
| Journey adapter | `resolveJourneyMapTrackOccupancy` |
| Shared assignment | `aggregateRoutingObservations`, `solveRoutingClaims` |
| Post-assignment | `reconstructRouteFromResolvedRuns`, `minimizeJourneyMapCrossings`, `applyResolvedStageGates` |

## 4. Expand or validate

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Arial, sans-serif","fontSize":"16px","primaryColor":"#ffffff","primaryTextColor":"#172033","primaryBorderColor":"#64748b","lineColor":"#64748b"},"flowchart":{"htmlLabels":false,"curve":"linear","nodeSpacing":24,"rankSpacing":20,"padding":8}}}%%
flowchart TD
    demand["Demand; build scenes"] --> grow{"Can grow?"}
    grow -->|"Yes"| expand["Grow original baseline"]
    expand --> changed{"Expanded?"}
    changed -->|"Yes"| recurse["Repeat all routing"]
    recurse --> signature["Check semantic signature"]
    changed -->|"No"| validate["Audit; mark crossings"]
    grow -->|"No"| validate
    validate --> output["Scene and diagnostics"]
    signature --> output
    class output result
    classDef shared fill:#e8f0fc,stroke:#4977ad,color:#102a43
    classDef routing fill:#f0edff,stroke:#7461aa,color:#342a59
    classDef failure fill:#fff1f0,stroke:#b94e49,color:#702926
    classDef result fill:#edf7f0,stroke:#4e8963,color:#264632
```

“Can grow” requires a non-repeating funded request and fewer than **four expansion attempts**. Demands include reciprocal, track, stem, branch/join, intersection, and terminal-leg capacity. Recursion preserves the connector signature and original early debug scenes; signature drift throws. Final Journey checks cover ownership, gates, routes, occupancy, separation, and expansion history.

| Chart step | Implementation |
| --- | --- |
| Expand / recurse | `applyJourneyMapExpansionRequests`, `buildJourneyMapRoutingStagesInternal` |
| Final checks | `validateJourneyMapResolvedStages` |
| Crossing diagnostics / marks | `collectJourneyMapResidualCrossings`, `withJourneyMapContinuityMarks` |

## Source files

- [journeyMap.ts](../../src/renderer/staged/journeyMap.ts)
- [journeyMapMiddleLayer.ts](../../src/renderer/staged/journeyMapMiddleLayer.ts)
- [journeyMapRouting.ts](../../src/renderer/staged/journeyMapRouting.ts)
- [routingCore/claims.ts](../../src/renderer/staged/routingCore/claims.ts)
- [routingCore/solver.ts](../../src/renderer/staged/routingCore/solver.ts)
