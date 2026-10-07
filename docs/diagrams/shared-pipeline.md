# Shared pipeline and export

All six views use shared measurement, placement, and SVG/PNG export. IA and UI also use generic initial routing.

**S** = shared rendering. **R** = shared routing. Unmarked steps belong to the view unless a callback or caller is named.

## Measurement and placement

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Arial, sans-serif","fontSize":"16px","primaryColor":"#ffffff","primaryTextColor":"#172033","primaryBorderColor":"#64748b","lineColor":"#64748b"},"flowchart":{"htmlLabels":false,"curve":"linear","nodeSpacing":24,"rankSpacing":20,"padding":8}}}%%
flowchart TD
    scene["RendererScene"] --> fonts["S · Resolve theme and fonts"]
    fonts --> measure["S · Measure text and nodes"]
    measure --> normalize["S · Normalize shared sizes"]
    normalize --> measured["MeasuredScene"]
    measured --> place["S · Place containers"]
    place --> mode{"Routing path?"}
    mode -->|"View-owned"| bare["Nodes without routes"]
    mode -->|"Generic"| routed["Initial routes and labels"]
    class fonts,measure,normalize,place shared
    class measured,bare,routed result
    classDef shared fill:#e8f0fc,stroke:#4977ad,color:#102a43
    classDef routing fill:#f0edff,stroke:#7461aa,color:#342a59
    classDef failure fill:#fff1f0,stroke:#b94e49,color:#702926
    classDef result fill:#edf7f0,stroke:#4e8963,color:#264632
```

Scene contracts retain the sequence projection → RendererScene → MeasuredScene → PositionedScene. Scenario, Service, Outcome, and Journey use the nodes-only branch, then their own routing orchestration. IA and UI take generic routing. Post-layout callbacks normalize Service cells or align Journey Steps.

| Chart step | Implementation |
| --- | --- |
| Measurement | `measureRendererScene` |
| Placement | `layoutMeasuredSceneRoot`, `positionMeasuredSceneBeforeRouting`, `positionMeasuredScene` |

## Initial route choice

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Arial, sans-serif","fontSize":"16px","primaryColor":"#ffffff","primaryTextColor":"#172033","primaryBorderColor":"#64748b","lineColor":"#64748b"},"flowchart":{"htmlLabels":false,"curve":"linear","nodeSpacing":24,"rankSpacing":20,"padding":8}}}%%
flowchart TD
    hint{"Route hint?"}
    hint -->|"Yes"| hinted["R · Use hint"]
    hint -->|"No"| pattern{"Local pattern?"}
    pattern -->|"Yes"| local["R · Use pattern"]
    pattern -->|"No"| lane{"Contract lane?"}
    lane -->|"Yes"| contract["R · Use lane"]
    lane -->|"No"| fallback["R · Default and offset"]
    hinted --> labels["S · Place label"]
    local --> labels
    contract --> labels
    fallback --> labels
    class hinted,local,contract,fallback routing
    class labels shared
    classDef shared fill:#e8f0fc,stroke:#4977ad,color:#102a43
    classDef routing fill:#f0edff,stroke:#7461aa,color:#342a59
    classDef failure fill:#fff1f0,stroke:#b94e49,color:#702926
    classDef result fill:#edf7f0,stroke:#4e8963,color:#264632
```

Before this choice, shared code resolves ports, ownership, available patterns, contract lanes, and route hints. Only default shared routes receive parallel offsets. Labels use a lane, strict segment, or general route anchor. This constructs initial geometry; later validation or repair is owned by the caller.

| Chart step | Implementation |
| --- | --- |
| Entrypoint / ports | `positionMeasuredEdge`, `resolveEdgeEndpoint` |
| Ordered choices | `buildRouteFromLocalHint`, `buildLocalPatternRoute`, `buildSourceContractLaneRoute`, `buildSharedRoute` |
| Offsets / labels | `offsetParallelOrthogonalRoute`, `positionEdgeLabelInLane`, `tryPositionEdgeLabelOnSegment`, `positionEdgeLabel` |

## Preview dispatch

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Arial, sans-serif","fontSize":"16px","primaryColor":"#ffffff","primaryTextColor":"#172033","primaryBorderColor":"#64748b","lineColor":"#64748b"},"flowchart":{"htmlLabels":false,"curve":"linear","nodeSpacing":24,"rankSpacing":20,"padding":8}}}%%
flowchart TD
    select["S · Select view and backend"] --> projection["Prepare projection"]
    projection --> ready{"Projection ready?"}
    ready -->|"No"| fail["Return diagnostics"]
    ready -->|"Yes"| settings["S · Resolve display settings"]
    settings --> renderer["Call view renderer"]
    renderer --> merge["S · Merge diagnostics"]
    merge --> gate["Apply artifact gate"]
    class select,settings,merge shared
    class fail failure
    classDef shared fill:#e8f0fc,stroke:#4977ad,color:#102a43
    classDef routing fill:#f0edff,stroke:#7461aa,color:#342a59
    classDef failure fill:#fff1f0,stroke:#b94e49,color:#702926
    classDef result fill:#edf7f0,stroke:#4e8963,color:#264632
```

This begins with a compiled graph; source parsing, compilation, and validation happen earlier. The selected staged backend requires projection input and a matching view. Bundle data supplies theme, detail, and node-decorator settings. Graphviz is a separate backend selection, not an automatic retry in this flow.

| Chart step | Implementation |
| --- | --- |
| Projection preparation | `prepareCompiledGraphPreview` |
| Dispatch | `createStagedProjectionPreviewBackend` |
| Result / diagnostics | `renderPreparedCompiledGraphPreview` |

## Artifact gate

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Arial, sans-serif","fontSize":"16px","primaryColor":"#ffffff","primaryTextColor":"#172033","primaryBorderColor":"#64748b","lineColor":"#64748b"},"flowchart":{"htmlLabels":false,"curve":"linear","nodeSpacing":24,"rankSpacing":20,"padding":8}}}%%
flowchart TD
    artifact["Serialized artifact"] --> errors{"Any errors?"}
    errors -->|"No"| expose["Expose artifact"]
    errors -->|"Yes"| force{"Force allowed?"}
    force -->|"Yes"| expose
    force -->|"No"| hide["Withhold artifact"]
    class artifact,expose result
    class hide failure
    classDef shared fill:#e8f0fc,stroke:#4977ad,color:#102a43
    classDef routing fill:#f0edff,stroke:#7461aa,color:#342a59
    classDef failure fill:#fff1f0,stroke:#b94e49,color:#702926
    classDef result fill:#edf7f0,stroke:#4e8963,color:#264632
```

Force is allowed here only when enabled **and no named diagram is selected**. Named-diagram errors withhold the public artifact even with force. A backend may already have serialized diagnostic geometry before this gate.

| Chart step | Implementation |
| --- | --- |
| Gate | `renderPreparedCompiledGraphPreview` |

## SVG and PNG export

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Arial, sans-serif","fontSize":"16px","primaryColor":"#ffffff","primaryTextColor":"#172033","primaryBorderColor":"#64748b","lineColor":"#64748b"},"flowchart":{"htmlLabels":false,"curve":"linear","nodeSpacing":24,"rankSpacing":20,"padding":8}}}%%
flowchart TD
    scene["Final scene"] --> theme["S · Resolve backend theme"]
    theme --> audit["UI only: audit scene"]
    audit --> paint["S · Build paint layers"]
    paint --> defs["S · Embed definitions"]
    defs --> svg["S · Serialize SVG"]
    svg -->|"PNG requested"| raster["S · Rasterize SVG"]
    svg -->|"SVG requested"| result["Artifact and diagnostics"]
    raster --> result
    class theme,paint,defs,svg,raster shared
    class result result
    classDef shared fill:#e8f0fc,stroke:#4977ad,color:#102a43
    classDef routing fill:#f0edff,stroke:#7461aa,color:#342a59
    classDef failure fill:#fff1f0,stroke:#b94e49,color:#702926
    classDef result fill:#edf7f0,stroke:#4e8963,color:#264632
```

UI's read-only final audit checks routes and labels before serialization. SVG uses scene paint order, embedded fonts, and LF newlines. PNG derives from SVG. Scenario, Outcome, and Journey PNG wrappers call their SVG wrapper before the shared PNG helper, so their scene is serialized twice.

| Chart step | Implementation |
| --- | --- |
| SVG / PNG | `renderPositionedSceneToSvg`, `renderPositionedSceneToPng` |
| UI final audit | `auditUiContractsFinalScene` |
| Rasterization | `renderSvgToPng` |

## Source files

- [previewWorkflow.ts](../../src/renderer/previewWorkflow.ts)
- [previewBackends.ts](../../src/renderer/previewBackends.ts)
- [pipeline.ts](../../src/renderer/staged/pipeline.ts)
- [microLayout.ts](../../src/renderer/staged/microLayout.ts)
- [macroLayout.ts](../../src/renderer/staged/macroLayout.ts)
- [routing.ts](../../src/renderer/staged/routing.ts)
- [svgBackend.ts](../../src/renderer/staged/svgBackend.ts)
