# Renderer flows

Start with [Scenario Flow](scenario-flow.md). Each document opens with an overview, then separates preparation, acceptance, and finalization into small charts. Function names and implementation details sit below the charts.

## Diagrams

| View | Document |
| --- | --- |
| Scenario Flow | [scenario-flow.md](scenario-flow.md) |
| Service Blueprint | [service-blueprint.md](service-blueprint.md) |
| Outcome–Opportunity Map | [outcome-opportunity-map.md](outcome-opportunity-map.md) |
| Journey Map | [journey-map.md](journey-map.md) |
| IA Place Map | [ia-place-map.md](ia-place-map.md) |
| UI Contracts | [ui-contracts.md](ui-contracts.md) |
| Shared measurement, routing, and export | [shared-pipeline.md](shared-pipeline.md) |
| Shared routing search and validation | [shared-routing.md](shared-routing.md) |

## Ownership key

| Mark | Meaning | Appearance |
| --- | --- | --- |
| **S ·** | Shared rendering infrastructure | Blue box |
| **R ·** | Shared routing infrastructure | Purple box |
| No prefix | View-owned step or named caller/callback | Plain box |
| — | Result / diagnostic failure | Green / red box |

Decisions have short labels; their exact conditions are explained below the chart. Dotted arrows represent callback requests. Numbered steps link an overview to its detailed stages. The shared-routing document describes shared code except explicitly named view/caller operations.

## Compare routing ownership

| View | Final route acceptance | Scene expansion |
| --- | --- | --- |
| Scenario Flow | Shared lifecycle | 8 preparation/callback passes total |
| Service Blueprint | Shared lifecycle | 4 preparation/callback passes total |
| Outcome–Opportunity Map | Shared lifecycle | 4 preparation/callback passes total |
| Journey Map | Own validator after shared track assignment | Up to 4 recursive attempts |
| IA Place Map | Shared scene validation with trunk policy | No expansion loop in this path |
| UI Contracts | Shared lifecycle, then node repair and final audits | No lifecycle expansion callback |

The overlap investigation is exposed in [the corridor-recovery gate](shared-routing.md#2-corridor-recovery-gate). Overlap/spacing/crossing-only failures enter existing-bend repair rather than port-corridor reconstruction.

## Scope and sources

These diagrams document the six staged backends registered in [previewBackends.ts](../../src/renderer/previewBackends.ts), at commit `6a784814f6e9c70b207c19efb6ec267551a2c98e` on 2026-10-06. They describe current code, including failure paths and diagnostic geometry.

[AGENTS.md](../../AGENTS.md) supplies the architectural boundary: projection → RendererScene → MeasuredScene → PositionedScene → SVG → PNG. The loaded [v0.2 bundle](../../bundle/v0.2/core/views.yaml) and preserved [v0.1 bundle](../../bundle/v0.1/core/views.yaml) govern specification behavior. The charts do not introduce new rules.

Each stage has an implementation table and each document links its source files. SVG/PNG serialization and the artifact-withholding gate are documented once in the shared pipeline. Legacy DOT, Mermaid-text, and Graphviz paths are outside this set.
