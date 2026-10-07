# IA Place Map

IA builds containment/navigation structure and uses generic shared routing. Its final validation declares intentional source trunks.

**S** = shared rendering. **R** = shared routing. Unmarked steps belong to the view unless a callback or caller is named.

## Overview

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Arial, sans-serif","fontSize":"16px","primaryColor":"#ffffff","primaryTextColor":"#172033","primaryBorderColor":"#64748b","lineColor":"#64748b"},"flowchart":{"htmlLabels":false,"curve":"linear","nodeSpacing":24,"rankSpacing":20,"padding":8}}}%%
flowchart TD
    scene["Build scopes and edges"] --> coverage["S · Check edge coverage"]
    coverage --> measure["S · Measure text"]
    measure --> place["S · Place nodes"]
    place --> routes["R · Build initial routes"]
    routes --> audit["R · Check scene routes"]
    audit --> export["S · SVG / PNG"]
    class coverage,measure,place,export shared
    class routes,audit routing
    classDef shared fill:#e8f0fc,stroke:#4977ad,color:#102a43
    classDef routing fill:#f0edff,stroke:#7461aa,color:#342a59
    classDef failure fill:#fff1f0,stroke:#b94e49,color:#702926
    classDef result fill:#edf7f0,stroke:#4e8963,color:#264632
```

The shared staged pipeline handles measurement, positioning, and routing. IA has no dedicated preparation/expansion loop or shared lifecycle call in this path.

| Chart step | Implementation |
| --- | --- |
| Scene | `buildIaPlaceMapRendererScene` |
| Coverage / pipeline | `completeExactSceneConnections`, `runStagedRendererPipeline` |

## Routing and validation

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Arial, sans-serif","fontSize":"16px","primaryColor":"#ffffff","primaryTextColor":"#172033","primaryBorderColor":"#64748b","lineColor":"#64748b"},"flowchart":{"htmlLabels":false,"curve":"linear","nodeSpacing":24,"rankSpacing":20,"padding":8}}}%%
flowchart TD
    geometry["S · Read positioned nodes"] --> endpoints["R · Resolve ports"]
    endpoints --> routes["R · Choose initial route"]
    routes --> labels["S · Place labels"]
    labels --> trunks["Declare shared trunks"]
    trunks --> validate["R · Check scene routes"]
    validate --> result["Scene and diagnostics"]
    class geometry,labels shared
    class endpoints,routes,validate routing
    class result result
    classDef shared fill:#e8f0fc,stroke:#4977ad,color:#102a43
    classDef routing fill:#f0edff,stroke:#7461aa,color:#342a59
    classDef failure fill:#fff1f0,stroke:#b94e49,color:#702926
    classDef result fill:#edf7f0,stroke:#4e8963,color:#264632
```

Initial routing chooses a hint, local pattern, contract lane, or default route; the priority is shown in [shared pipeline](shared-pipeline.md#initial-route-choice). Only default shared routes receive parallel offsets. Edges classed `shared_trunk` receive `ia-trunk:<source ID>` on every segment; other same-source edges do not receive that exemption.

| Chart step | Implementation |
| --- | --- |
| Initial geometry / routes | `positionMeasuredScene`, `positionMeasuredEdge` |
| Endpoint resolution | `resolveEdgeEndpoint` |
| Scene validation | `validatePositionedSceneRouting` |

## Source files

- [iaPlaceMap.ts](../../src/renderer/staged/iaPlaceMap.ts)
- [pipeline.ts](../../src/renderer/staged/pipeline.ts)
- [macroLayout.ts](../../src/renderer/staged/macroLayout.ts)
- [routingCore/sceneValidation.ts](../../src/renderer/staged/routingCore/sceneValidation.ts)
