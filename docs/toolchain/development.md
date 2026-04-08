# Toolchain Development

## Prerequisites

Required local tooling:

- Node.js 22 LTS
- `pnpm`

The implementation work for v0.1 was done against a workspace-local Node 22 runtime because the machine default was Node 6 and `pnpm` was not installed. A normal contributor setup should install Node 22 and `pnpm` system-wide or through a version manager.

Optional local tooling:

- Graphviz, for CLI preview generation and for VS Code extensions or other tools that shell out to `dot`

Graphviz is not required for the core v0.1 build and test flow because the engine retains internal `.dot` and `.mmd` text artifacts for tests and debugging. It is required once you want CLI preview artifacts (`.svg` by default or `.png` on demand) or editor integrations that invoke the Graphviz binary.

Projection remains an internal artifact in v0.1. The repo now projects every manifest-declared view through the shared projector path for tests, while CLI rendering and preview commands stay limited to views registered as renderable.

Current renderable views:

- Supported preview output via `sdd show`: `ia_place_map`, `ui_contracts`, `service_blueprint`
- Preview-only / not-yet-usable output via `sdd show`: `journey_map`, `outcome_opportunity_map`, `scenario_flow`
- Internal `.dot` and `.mmd` text artifacts are retained for all renderable views for tests, corpus generation, and debugging.

Committed rendered examples live under `examples/rendered/v0.1/`. Each view/example pair keeps the source `.sdd` at the pair root and stores rendered artifacts under suffixed profile subfolders such as `simple_profile/`, `permissive_profile/`, and `strict_profile/`, nested under suffixed view and example folders such as `ia_place_map_diagram_type/outcome_to_ia_trace_example/`. Unsuffixed preview files represent the default preview backend for that view/profile. Preserved non-default preview artifacts are committed as backend-suffixed siblings when a view keeps parallel preview backends. Keep that corpus separate from `tests/goldens/`, which remains focused on small test-only fixtures and focused regression assets.

The CLI preview pipeline is SVG-first:

- `sdd show` resolves preview output through a backend-aware registry and writes `.svg` by default
- `ia_place_map` now defaults `sdd show` to the staged preview backend `staged_ia_place_map_preview`, which renders projection-driven staged SVG directly and derives PNG from that SVG
- `ui_contracts` now also defaults `sdd show` to the staged preview backend `staged_ui_contracts_preview`, which renders the routed and balanced staged SVG directly and derives PNG from that SVG
- `service_blueprint` now also defaults `sdd show` to the staged preview backend `staged_service_blueprint_preview`, which renders the ELK-authoritative staged SVG directly and derives PNG from that SVG
- the remaining views still default to `legacy_graphviz_preview`, which renders DOT, runs Graphviz to produce SVG layout, embeds the vendored Public Sans webfont, and produces PNG from that SVG when requested
- legacy Graphviz preview remains selectable for `ia_place_map`, `service_blueprint`, and `ui_contracts` with `--backend legacy_graphviz_preview`, and internal `--dot-out` automatically chooses a DOT-capable backend when needed
- PNG output is still derived from SVG in both preview paths, and the vendored Public Sans desktop font keeps preview typography independent of user-installed system fonts
- The shared preview defaults live in `bundle/v0.1/core/views.yaml`, with `svg_font_asset` for SVG output, `png_font_asset` for PNG output, and legacy `font_asset` kept only as a compatibility fallback

Font provenance:

- The vendored `Public Sans` preview assets are sourced from the official upstream `Public Sans v2.001` release archive and are committed in `bundle/v0.1/assets/fonts/`.
- `PublicSans-Regular.woff` is the SVG/web asset and `PublicSans-Regular.otf` is the PNG/native-rendering asset.
- Keep `bundle/v0.1/assets/fonts/PublicSans-OFL.txt` with the assets whenever either file is refreshed.
- If the font is updated, refresh both assets from the same upstream release, preserve the license text, and keep the configured `svg_font_asset` and `png_font_asset` paths in `bundle/v0.1/core/views.yaml` in sync.

Install Graphviz in the same environment that runs the workspace tooling:

- VS Code Remote - WSL, WSL/Ubuntu, or native Linux: `sudo apt update` then `sudo apt install graphviz`
- Native Windows-side execution: install Graphviz on Windows and ensure `dot.exe` is on `PATH`

Verify the setup with:

```bash
pnpm run check:graphviz
```

## Install

From repo root:

```bash
pnpm install
```

## Build

```bash
pnpm build
```

## Test

```bash
pnpm test
```

## Regenerate Rendered Corpus

```bash
TMPDIR=/tmp pnpm run generate:rendered-examples
```

## CLI Usage

Compile a source file:

```bash
pnpm sdd compile bundle/v0.1/examples/outcome_to_ia_trace.sdd
```

Validate with the default profile:

```bash
pnpm sdd validate bundle/v0.1/examples/outcome_to_ia_trace.sdd
```

Validate an early draft with the low-noise profile:

```bash
pnpm sdd validate real_world_exploration/billSage_example/billSage_simple_structure.sdd --profile simple
```

Render an SVG preview artifact:

```bash
pnpm sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map
```

Render the preserved legacy Graphviz preview for `ia_place_map` explicitly:

```bash
pnpm sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map --backend legacy_graphviz_preview --out /tmp/outcome-legacy.svg
```

Render a Journey Map SVG preview artifact:

```bash
pnpm sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view journey_map --out /tmp/journey.svg
```

Render an Outcome-Opportunity Map SVG preview artifact:

```bash
pnpm sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view outcome_opportunity_map --out /tmp/outcome-map.svg
```

Attempt the default Service Blueprint staged SVG preview artifact:

```bash
pnpm sdd show bundle/v0.1/examples/service_blueprint_slice.sdd --view service_blueprint --out /tmp/blueprint.svg
```

Render the preserved legacy Graphviz Service Blueprint preview explicitly:

```bash
pnpm sdd show bundle/v0.1/examples/service_blueprint_slice.sdd --view service_blueprint --backend legacy_graphviz_preview --out /tmp/blueprint-legacy.svg
```

Render a Scenario Flow SVG preview artifact:

```bash
pnpm sdd show bundle/v0.1/examples/scenario_branching.sdd --view scenario_flow --out /tmp/scenario.svg
```

Render a UI Contracts SVG preview artifact:

```bash
pnpm sdd show bundle/v0.1/examples/place_viewstate_transition.sdd --view ui_contracts --out /tmp/ui-contracts.svg
```

Render the preserved legacy Graphviz UI Contracts preview explicitly:

```bash
pnpm sdd show bundle/v0.1/examples/place_viewstate_transition.sdd --view ui_contracts --backend legacy_graphviz_preview --out /tmp/ui-contracts-legacy.svg
```

Render a PNG preview artifact:

```bash
pnpm sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map --format png --out /tmp/outcome.png
```

Write an internal text artifact for debugging:

```bash
pnpm sdd render bundle/v0.1/examples/place_viewstate_transition.sdd --view ui_contracts --format mermaid --out /tmp/place_viewstate_transition.mmd
```

Internal `.dot` and `.mmd` outputs remain available for tests, corpus generation, and debugging, but they are not the supported public preview path. Use `sdd show` for visible artifacts.

Profile guidance lives in [profiles.md](./profiles.md).

## Structure

- `src/bundle/`: bundle loading and runtime guards
- `src/parser/`: syntax-driven line classification and block parsing
- `src/compiler/`: graph construction, canonicalization, schema validation
- `src/validator/`: generic rule execution and profile validation
- `src/projector/`: internal multi-view projection registry, shared helpers, and per-view builders
- `src/renderer/`: render capability registry, view render models, emitters, staged renderer contracts and backends, shared SVG artifact helpers, legacy preview backend plumbing, and preview style resolution
- `src/examples/`: curated render-pair discovery plus rendered-corpus generation helpers
- `src/diagnostics/`: structured diagnostics and formatting
- `src/cli/`: command wiring
- `tests/`: conformance, regression, and negative fixtures

## Bundle View Conventions

`bundle/v0.1/core/views.yaml` has three different kinds of downstream view settings:

- `preview_defaults`: shared preview artifact defaults for CLI previews, including backends that still route through DOT internally, such as fonts and DPI. These affect SVG/PNG generation, not `.sdd` authoring.
- `normative_defaults`: descriptive statements about the default semantic reading of a view. They explain how a contributor or projection consumer should interpret the view, but they do not by themselves validate source files or mutate compiled graphs.
- `renderer_defaults`: machine-readable downstream conventions consumed by projection builders, render-model builders, and preview-style resolution. These can change derived annotations, node groups, view metadata, shapes, labels, lane assignment, preview styling, or profile-specific display density without changing `.sdd` syntax.

Practical rule of thumb:

- if a rule should reject or warn on author input, it belongs in contracts or profiles
- if a rule explains how a view should be interpreted, document it under `normative_defaults`
- if a rule drives derived projection or rendering behavior, encode it under `renderer_defaults`

Authoring guidance for the newly renderable views:

- `service_blueprint` expects canonical `Process.visibility` values of `frontstage`, `backstage`, or `support`
- downstream rendering still maps legacy `customer-visible` to `frontstage` and `not-visible` to `backstage`, but those aliases are compatibility behavior rather than canonical authoring
- `Step` nodes always occupy the derived `customer` lane; `SystemAction` and `DataEntity` occupy `system`; `Policy` occupies `policy`
- `scenario_flow` branch points should be modeled as `Step.props.kind=decision`
- branch labels follow bundle precedence: guard text first, then event id, then the target node name when neither guard nor event is present
- `ui_contracts` treats `ViewState` transitions as the primary UI-contract graph when any `ViewState` nodes are present
- use `State` for scoped secondary detail on a `Place` or `Component`, and set `State.scope_id` to that owning node id
- component-scoped `State` detail renders inside the owning component rather than as a sibling of that component
- supporting `Event`, `SystemAction`, and `DataEntity` nodes render inside their unique structural owner in `ui_contracts`; only ambiguous or ownerless support nodes fall back to a shared root-level group
- if a UI contract slice has no `ViewState` nodes, renderers fall back to the grouped `State` transitions as the effective primary graph instead of inventing a separate state-machine subsystem

## Adding A New Validation Primitive

1. Extend the executor set in `src/validator/ruleExecutors.ts`.
2. Register the executor in `src/validator/ruleRegistry.ts`.
3. Add positive or negative fixtures that exercise the new rule kind.
4. Prefer expressing the new behavior in the bundle first, then teaching the engine how to execute it.

## Adding A New Renderer Format

1. Reuse an existing view render model when possible, or add a new render-model builder if the view needs one.
2. Add a new emitter beside `dot.ts` and `mermaid.ts`.
3. Register format support through the render capability registry in `src/renderer/viewRenderers.ts`.
4. Keep all view semantics in projection and render-model construction, not in the emitter.
5. Add stable golden tests for the new internal text output.

## Staged Renderer Notes

- `src/renderer/staged/` holds the internal `RendererScene`, `MeasuredScene`, and `PositionedScene` contracts plus the current staged pipeline for those stages.
- `src/renderer/staged/sceneBuilders.ts` holds the shared root-container, card-node, and reusable port builders extracted from the first two migrated views.
- ordinary staged node/container ports are routing anchors, not normal painted SVG affordances; only explicit `connector_port` primitives should render as visible port dots.
- `src/renderer/staged/theme.ts` is the staged theme registry for measurement-affecting tokens, width bands, and vendored font asset paths.
- `src/renderer/staged/primitives.ts` defines shared primitive flow rules and validates primitive/content combinations before layout.
- `src/renderer/staged/textMeasurement.ts` performs deterministic font-backed measurement with the vendored Public Sans OTF asset.
- `src/renderer/staged/microLayout.ts` is the Step 3 micro-layout entry point: intrinsic node sizing, wrapped lines, local content frames, local node-port offsets, and explicit overflow outcomes. Measured-scene diagnostics should describe true fallback or degraded output, not expected intermediate container-port deferral.
- `src/renderer/staged/macroLayout.ts` is the Step 5 macro-layout entry point: recursive `stack`/`grid`/`lanes` placement, container bounds, container-port resolution, deterministic staged routing, dedicated contract-label lane assignment, and shared arrow-terminal clearance plus target-approach handling.
- `src/renderer/staged/svgBackend.ts` is the Step 4 backend entry point: deterministic SVG emission from `PositionedScene`, shared user-space arrow markers, and staged PNG derivation from that SVG.
- `src/renderer/staged/uiContracts.ts` now holds the routed and balanced staged `ui_contracts` scene builder plus staged SVG/PNG preview path used by the public `staged_ui_contracts_preview` backend, including reserved gutter space and a dedicated label lane for container-origin support edges plus normalized staged `ViewState` container presentation.
- `src/renderer/svgArtifacts.ts` holds the shared embedded-font and SVG-to-PNG helpers reused by the staged backend and the legacy Graphviz preview backend.
- This staged pipeline is intentionally separate from `renderSource`, `viewRenderers.ts`, and the CLI preview registry until a later migration step moves specific views onto it.
- `tests/rendererStageSnapshotHarness.ts` is the shared helper for deterministic staged-renderer JSON comparisons.
- Committed staged-renderer goldens live under `tests/goldens/renderer-stages/` and now include both stage JSON fixtures and deterministic staged SVG fixtures for the staged fixture set plus the current `ia_place_map` and internal staged `ui_contracts` coverage; they are implementation-contract fixtures, not bundle source-of-truth artifacts.
- The staged pipeline now has shared measurement, manual macro-layout, selective `elk_layered` placement, and shared routing strong enough for both proof views. Staged `ia_place_map` now uses manual hub/follower grouping, bottom-up owned-scope sizing, and deterministic local-structure routing without IA-specific ELK fallback, while staged `ui_contracts` combines scoped manual layout with selective `elk_layered` transition placement and dedicated contract-label lanes.

## Adding A New View

1. Add the view to the bundle.
2. Add or update example coverage and declare projection snapshots in `bundle/v0.1/manifest.yaml`.
3. Implement a projection builder in `src/projector/` and register it in `src/projector/viewProjectors.ts`.
4. Keep bundle semantics in that projection builder, using `renderer_defaults` only for downstream derived data.
5. Add a render model only if the view will become renderable. Public CLI support should be expressed through `sdd show`; internal DOT or Mermaid text artifacts are optional and should only be added when they stay useful for tests or debugging.
6. Register renderable views in `src/renderer/viewRenderers.ts`; CLI preview support derives from that registry.
7. Add explicit CLI support only after the projection and rendering path is proven by tests. v0.1 still has no public `sdd project` command.
