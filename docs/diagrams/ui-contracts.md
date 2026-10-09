# UI Contracts

UI starts with generic routes, then selects endpoint exits, searches for legal routes, repairs node avoidance and labels, and audits the final scene.

**S** = shared rendering. **R** = shared routing. Unmarked steps belong to the view unless a callback or caller is named.

## Overview

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Arial, sans-serif","fontSize":"16px","primaryColor":"#ffffff","primaryTextColor":"#172033","primaryBorderColor":"#64748b","lineColor":"#64748b"},"flowchart":{"htmlLabels":false,"curve":"linear","nodeSpacing":24,"rankSpacing":20,"padding":8}}}%%
flowchart TD
    scene["Build presentation scene"] --> layout["S · Measure and place"]
    layout --> initial["R · Build initial routes"]
    initial --> exits["1 · Choose endpoint exits"]
    exits --> search["R · Find legal routes"]
    search --> nodes["2 · R · Avoid nodes"]
    nodes --> labels["3 · Repair labels"]
    labels --> audit["4 · Check final scene"]
    audit --> export["S · SVG / PNG"]
    class layout,export shared
    class initial,search,nodes routing
    classDef shared fill:#e8f0fc,stroke:#4977ad,color:#102a43
    classDef routing fill:#f0edff,stroke:#7461aa,color:#342a59
    classDef failure fill:#fff1f0,stroke:#b94e49,color:#702926
    classDef result fill:#edf7f0,stroke:#4e8963,color:#264632
```

The scene builder reads bundle-owned presentation roles/scopes and creates nodes, ports, fanouts, transition strips, and edge coverage. Shared search has **no expansion callback** here. Node repair remains a separate pass after lifecycle acceptance or failure.

| Chart step | Implementation |
| --- | --- |
| Scene | `buildUiContractsPresentationModel`, `UiContractsSceneBuilder.complete` |
| Pipeline | `runStagedRendererPipeline` |
| Shared search | `routeUiContractsScene` → `runRoutingLifecycle` |

## 1. Choose endpoint exits

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Arial, sans-serif","fontSize":"16px","primaryColor":"#ffffff","primaryTextColor":"#172033","primaryBorderColor":"#64748b","lineColor":"#64748b"},"flowchart":{"htmlLabels":false,"curve":"linear","nodeSpacing":24,"rankSpacing":20,"padding":8}}}%%
flowchart TD
    align["R · Choose horizontal Y"] --> allocate["Allocate bottom ports"]
    allocate --> choose["Try bottom exits"]
    choose --> corridor["R · Propose corridors"]
    corridor --> validate["R · Check trial routes"]
    validate --> swap["R · Try attachment swaps"]
    swap --> context["Fix selected endpoints"]
    class align,corridor,validate,swap routing
    class context result
    classDef shared fill:#e8f0fc,stroke:#4977ad,color:#102a43
    classDef routing fill:#f0edff,stroke:#7461aa,color:#342a59
    classDef failure fill:#fff1f0,stroke:#b94e49,color:#702926
    classDef result fill:#edf7f0,stroke:#4e8963,color:#264632
```

View-owned selection loops use shared proposal, route-cost, and validation helpers. Horizontal alignment also uses a shared coordinate helper. Changed edge IDs are recorded for label repair. Illegal endpoint proposals are not committed.

| Chart step | Implementation |
| --- | --- |
| Alignment / allocation | `alignHorizontalTransitions`, `allocateBottomPorts` |
| Shared horizontal helper | `resolveHorizontalSharedY` |
| Selection / swapping | `selectUiBottomExits`, `optimizeSouthExitAssignments` |
| Shared proposals / checks / costs | `buildPortCorridorCandidates`, `validateFinalRouteSet`, `compareRouteCosts`, `swapSouthboundSourceAttachments` |

## 2. Repair node avoidance

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Arial, sans-serif","fontSize":"16px","primaryColor":"#ffffff","primaryTextColor":"#172033","primaryBorderColor":"#64748b","lineColor":"#64748b"},"flowchart":{"htmlLabels":false,"curve":"linear","nodeSpacing":24,"rankSpacing":20,"padding":8}}}%%
flowchart TD
    candidates["R · Try exterior routes"] --> check["R · Check with settled edges"]
    check --> legal{"Legal candidate?"}
    legal -->|"Yes"| replace["Keep first legal route"]
    legal -->|"None left"| keep["Keep original route"]
    replace --> more{"More edges?"}
    keep --> more
    more -->|"Yes"| candidates
    more -->|"No"| labels["Continue to label repair"]
    class candidates,check routing
    class labels result
    classDef shared fill:#e8f0fc,stroke:#4977ad,color:#102a43
    classDef routing fill:#f0edff,stroke:#7461aa,color:#342a59
    classDef failure fill:#fff1f0,stroke:#b94e49,color:#702926
    classDef result fill:#edf7f0,stroke:#4e8963,color:#264632
```

The shared repair visits edges in order and tries the current route followed by exterior top/bottom/left/right routes. Its checks include settled earlier edges and node boxes. The later complete-scene audit checks all resulting edges together.

| Chart step | Implementation |
| --- | --- |
| Shared repair | `repairPositionedSceneRoutesAroundNodes` |
| Candidates / checks | `buildExteriorOrthogonalCandidates`, `validateRouting` |

## 3. Repair labels

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Arial, sans-serif","fontSize":"16px","primaryColor":"#ffffff","primaryTextColor":"#172033","primaryBorderColor":"#64748b","lineColor":"#64748b"},"flowchart":{"htmlLabels":false,"curve":"linear","nodeSpacing":24,"rankSpacing":20,"padding":8}}}%%
flowchart TD
    pending["Select labels to repair"]
    pending --> place["S · Place within scope"]
    place --> legal{"Label clear?"}
    legal -->|"Yes"| replace["Use and reserve label"]
    legal -->|"No"| fail["Keep old label; add error"]
    replace --> more{"More labels?"}
    fail --> more
    more -->|"Yes"| place
    more -->|"No"| audit["Continue to final audit"]
    class place shared
    class fail failure
    class audit result
    classDef shared fill:#e8f0fc,stroke:#4977ad,color:#102a43
    classDef routing fill:#f0edff,stroke:#7461aa,color:#342a59
    classDef failure fill:#fff1f0,stroke:#b94e49,color:#702926
    classDef result fill:#edf7f0,stroke:#4e8963,color:#264632
```

Placement blocks scopes, nodes, headers, markers, connector segments, and already reserved labels. Labels are rechecked after placement. Unresolved candidates preserve the old label and add an error.

| Chart step | Implementation |
| --- | --- |
| Label orchestration | `repairUiContractsLabels`, `labelProblems` |
| Shared placement | `positionConnectorLabel` |

## 4. Final audits

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Arial, sans-serif","fontSize":"16px","primaryColor":"#ffffff","primaryTextColor":"#172033","primaryBorderColor":"#64748b","lineColor":"#64748b"},"flowchart":{"htmlLabels":false,"curve":"linear","nodeSpacing":24,"rankSpacing":20,"padding":8}}}%%
flowchart TD
    scene["Repaired scene"] --> pipeline["R · Check scene routes"]
    pipeline --> backend["S · Enter SVG backend"]
    backend --> routes["R · Check scene routes"]
    routes --> labels["Check final labels"]
    labels --> diagnostics["Merge audit diagnostics"]
    diagnostics --> serialize["S · Serialize SVG"]
    class pipeline,routes routing
    class backend,serialize shared
    classDef shared fill:#e8f0fc,stroke:#4977ad,color:#102a43
    classDef routing fill:#f0edff,stroke:#7461aa,color:#342a59
    classDef failure fill:#fff1f0,stroke:#b94e49,color:#702926
    classDef result fill:#edf7f0,stroke:#4e8963,color:#264632
```

UI allows collinear overlap only between the final segments of two edges entering the same target. The pipeline first audits routes; the SVG backend then repeats route checks and audits labels on the exact emitted scene. PNG passes through that same SVG backend.

| Chart step | Implementation |
| --- | --- |
| Route checks | `validateUiContractsRoutes` → `validatePositionedSceneRouting` |
| Final route / label audit | `auditUiContractsFinalScene` |
| Artifact backend | `renderPositionedSceneToSvg`, `renderPositionedSceneToPng` |

## Source files

- [uiContracts.ts](../../src/renderer/staged/uiContracts.ts)
- [uiContractsPresentationScene.ts](../../src/renderer/staged/uiContractsPresentationScene.ts)
- [pipeline.ts](../../src/renderer/staged/pipeline.ts)
- [uiContractsRouting.ts](../../src/renderer/staged/uiContractsRouting.ts)
- [uiContractsLabels.ts](../../src/renderer/staged/uiContractsLabels.ts)
- [routingCore/sceneValidation.ts](../../src/renderer/staged/routingCore/sceneValidation.ts)
- [svgBackend.ts](../../src/renderer/staged/svgBackend.ts)
