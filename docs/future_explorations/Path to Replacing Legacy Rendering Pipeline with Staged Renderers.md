# Path to Replacing Legacy Rendering Pipeline with Staged Renderers

**KG:**
We he have "old" renderers that output mermaid and DOT, and we have newer "staged" renderers that output custom-formatted SVG. All but one diagram types are supported by staged renderers. What would it take to entirely deprecate the "old" renderers and to just make the staged renderers the normal rendering pipeline?

Do not write any code.

**GPT-5.6:**

The cutover is closer than it appears: the normal CLI/helper preview path already uses staged SVG/PNG for five of the six views. `journey_map` is the only legacy-only view. The larger remaining issue is that the repository’s APIs, capability model, corpus, and terminology still treat DOT/Mermaid as foundational.

I would handle this as four deliberate changes.

## 1. Finish `journey_map`

Its bundle contract is already fairly small: `Stage`/`Step`, `CONTAINS`, `PRECEDES`, source ordering, and profile-controlled opportunity badges ([views.yaml](/home/knut/projects/sdd/bundle/v0.1/core/views.yaml:115)). The existing render model already derives most of that semantic structure ([journeyMapRenderModel.ts](/home/knut/projects/sdd/src/renderer/journeyMapRenderModel.ts:71)).

A staged renderer would need:

- Stage strips or containers with ordered Step cards.
- Support for uncontained root Steps.
- Deterministic source ordering.
- Explicit `PRECEDES` routing within and across stages.
- Opportunity-reference badges under permissive/strict profiles.
- SVG-first PNG generation, renderer diagnostics, and normal stage snapshots.
- Visual proof cases covering multiple stages, cross-stage edges, long labels, empty/single-step stages, root Steps, and profile differences.

The present journey corpus has only two modest examples and is explicitly marked preview-only ([renderedCorpus.ts](/home/knut/projects/sdd/src/examples/renderedCorpus.ts:39)). It is not enough evidence for retiring the fallback. Journey acceptance is the main visual-risk item.

## 2. Make the projection-to-SVG path the canonical renderer

Today the public library export `renderSource(...)` is still DOT/Mermaid-only ([index.ts](/home/knut/projects/sdd/src/index.ts:7), [types.ts](/home/knut/projects/sdd/src/types.ts:38)). Meanwhile, the actual modern workflow lives behind `renderSourcePreview(...)`, which branches between text-fed and projection-fed backends ([previewWorkflow.ts](/home/knut/projects/sdd/src/renderer/previewWorkflow.ts:107)).

A proper cutover should:

- Define the primary render request as `view + profile + svg|png`, returning an artifact and diagnostics.
- Export that artifact renderer as the normal library API.
- Make every registered view projection-backed.
- Treat PNG uniformly as rasterization of the generated SVG.
- Stop organizing `ViewRenderCapability` around `textArtifacts`; it currently remains a text-renderer registry with previews attached ([viewRenderers.ts](/home/knut/projects/sdd/src/renderer/viewRenderers.ts:46)).
- Either rename migration-era `staged_*_preview` backend IDs to durable names or make backend identity internal. “Staged” should stop being a meaningful runtime class once it is the only pipeline.
- Decide whether `--backend` remains as a genuine extension point. If there is one supported renderer per view, it probably should not be part of the normal CLI/helper request.

This is also the place to clean up public helper contracts. They currently expose the legacy and staged IDs directly—and the union has already drifted behind runtime support ([contracts.ts](/home/knut/projects/sdd/src/authoring/contracts.ts:12)).

## 3. Remove remaining legacy coupling

Two bundle/runtime details should be resolved before declaring the new pipeline canonical:

- The outcome-opportunity staged renderer still requires `legacy_dot_shape` from the authoritative bundle and propagates it into the staged render model ([views.yaml](/home/knut/projects/sdd/bundle/v0.1/core/views.yaml:45), [outcomeOpportunityMapRenderModel.ts](/home/knut/projects/sdd/src/renderer/outcomeOpportunityMapRenderModel.ts:192)). That should become a generic visual-role/shape convention, with the bundle type and consumer changed together.
- The staged theme resolves assets from a hardcoded `bundle/v0.1` path instead of the loaded bundle ([theme.ts](/home/knut/projects/sdd/src/renderer/staged/theme.ts:105)). The canonical renderer should receive bundle-derived asset/theme configuration so alternate bundle contents actually affect runtime behavior.

After those are addressed, removal becomes straightforward:

- Delete the DOT and Mermaid emitters, Graphviz preview backend, legacy preview styling, and old text-only render API.
- Remove hidden `sdd render`, `sdd dot`, and `sdd mmd` commands ([program.ts](/home/knut/projects/sdd/src/cli/program.ts:645)).
- Remove `sdd show --dot-out` and legacy backend examples ([program.ts](/home/knut/projects/sdd/src/cli/program.ts:711)).
- Remove the Graphviz setup/check command and Graphviz installation documentation.
- Remove `preview_defaults.dot` and other bundle fields that exist only for Graphviz ([views.yaml](/home/knut/projects/sdd/bundle/v0.1/core/views.yaml:3)).
- Keep shared semantic render models where staged renderers still consume them; the old emitter files and the render models are not the same thing.

This would eliminate Graphviz as an environment requirement. It would not automatically remove `elkjs`; that is a separate remaining staged-layout dependency/remnant.

## 4. Replace the legacy evidence, not merely delete it

The corpus generator currently requires DOT and Mermaid for every view, then renders every additional backend—including legacy Graphviz siblings ([generateRenderedExamples.ts](/home/knut/projects/sdd/src/examples/generateRenderedExamples.ts:342), [generateRenderedExamples.ts](/home/knut/projects/sdd/src/examples/generateRenderedExamples.ts:411)).

The committed corpus currently contains:

- 33 DOT files.
- 33 Mermaid files.
- 54 legacy Graphviz SVG/PNG siblings.
- About 7.2 MB of legacy Graphviz siblings.

Those can disappear, but their useful assertions must move:

- Source-order tests → `RendererScene`/positioned-scene assertions.
- Profile-display tests → scene content and SVG assertions.
- Shape/style tests → bundle-dependent scene classes and SVG styling.
- DOT/Mermaid golden tests → deterministic stage snapshots and SVG visual acceptance.
- Legacy/default-backend tests → one canonical backend per view.
- Corpus tests → SVG/PNG plus intentional routing-debug artifacts only.

Current architecture/development/CLI/helper/MCP-design documentation would need updating. Historical “Done” plans can remain historical rather than being rewritten.

## Recommended landing sequence

I would use four PR-sized gates:

1. Journey-map design, proof corpus, staged implementation, and visual acceptance.
2. Promote journey and introduce the canonical SVG/PNG library/registry surface.
3. Deprecation window: old APIs and hidden commands warn, while all normal workflows use the canonical path.
4. Remove DOT, Mermaid, Graphviz, legacy bundle fields, corpus artifacts, tests, and current documentation references.

Because this is a private `0.1.0` package, steps 3 and 4 could be combined if there are no downstream consumers of the exported `renderSource(...)` API or helper backend IDs. Otherwise, this is a breaking API change and deserves a compatibility window.

## Completion gates

I would call the migration complete only when:

- All six views use `Projection → RendererScene → MeasuredScene → PositionedScene → SVG → PNG`.
- `journey_map` is no longer preview-only.
- Running all tests and generating the corpus succeeds with no Graphviz installed.
- Production source contains no DOT/Mermaid/Graphviz renderer imports.
- No public CLI or helper contract mentions `legacy_*`, `staged_*`, Mermaid, DOT, or `--dot-out`.
- Bundle-owned renderer conventions affect the canonical path, including bundle-relative assets.
- Removed DOT/Mermaid tests have equivalent semantic coverage in scene/SVG tests.
- Default filenames and `sdd show` behavior remain stable.

A reasonable estimate is roughly 12–20 engineer-days, mostly driven by journey-map visual design and acceptance rather than legacy deletion. The deletion itself is comparatively mechanical once journey and the canonical API are proven.

No files were changed. I also ran the focused capability, preview-workflow, and corpus suites: 33 tests passed.