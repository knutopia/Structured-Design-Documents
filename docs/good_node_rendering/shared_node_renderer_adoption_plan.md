# Shared Node Renderer Adoption Plan

## Status and Scope

The shared node renderer is implemented, accepted in its standalone production-path proof, and adopted by `ui_contracts`. This plan covers adoption by the remaining staged SVG renderers:

1. `scenario_flow`
2. `service_blueprint`
3. `outcome_opportunity_map`
4. `ia_place_map`
5. `journey_map`

This is a staged-renderer migration only. It does not change parser, compiler, validator, projection, DOT, Mermaid, or legacy Graphviz behavior.

## Objective

Make every eligible leaf semantic node use the shared node renderer while preserving each diagram renderer's macro layout, containment, semantic metadata, ports, edge routing, diagnostics, and bundle-driven display policy.

After migration, a diagram builder supplies only semantic node content:

- title
- decorator mode
- node type
- node ID
- ordered attributes

The shared node renderer continues to own title and attribute formatting, title casing for attribute labels, grouping, wrapping, typography, plain-versus-dense selection, width, height growth, internal geometry, and SVG composition.

## Sources and Authority

Use these sources in order:

1. `solving_for_good_node_rendering.md` defines shared-node composition.
2. `shared_node_renderer_acceptance.md` records the accepted measurements and visual contract.
3. `shared_node_renderer_implementation_plan.md` defines ownership and staged-pipeline boundaries.
4. Bundle view conventions and resolved detail-display policies govern which semantic information a view exposes.
5. Existing staged-renderer acceptance tests define macro-layout, containment, routing, and diagnostic behavior that must be preserved unless a changed node allocation makes a narrowly identified expectation obsolete.
6. Existing SVG goldens are evidence of the old output, not authority for retaining old node typography or geometry.

The Figma Node Reference Visuals remain the visual authority for the node itself. Existing renderer goldens remain the comparison source for diagram-level behavior around the node.

## Non-Negotiable Migration Boundary

### Migrate

Migrate leaf semantic `SceneNode` instances that currently use the generic card path:

- Scenario-flow `Step`, `Place`, and `ViewState`
- Service-blueprint `Step`, `SystemAction`, `DataEntity`, `Policy`, and any other eligible semantic leaf admitted by the view
- Outcome-opportunity `Outcome`, `Opportunity`, `Initiative`, and `Metric`
- IA place-map `Place`
- Journey-map `Step`, whether contained in a Stage or placed at the root

### Do Not Migrate

Keep structural `SceneContainer` instances on their existing rendering path:

- IA place-map `Area`
- IA structural wrappers around a Place and its owned scope
- Journey-map `Stage`
- scenario-flow lane, band, track, cell, and root containers
- service-blueprint lane, band, cell, and root containers
- outcome-opportunity column, band, cell, parking, and root containers
- all diagram roots and routing-only structural items

The deciding factor is scene responsibility, not the ontology name. An item that contains children, establishes a layout or routing scope, or owns a header band remains a container. A leaf item that presents one semantic entity is eligible for the shared node.

Container chrome, headers, padding, and layout strategies are out of scope. Container sizes and positions may change because their migrated children have different measured allocations; their structure and styling must not change as part of this work.

## Cross-Cutting Decisions

### Decorators

Every migrated renderer must pass the resolved `StagedRenderSettings.nodeDecoratorMode` to `buildSharedNode`. Use the same fallback already used by the accepted `ui_contracts` integration when direct tests or internal callers omit the setting.

Do not let an individual diagram renderer decide whether to show type or ID. The caller-level mode is a single preview/render setting, and the shared node decides how that mode is composed.

### Titles and Attributes

Do not adapt preformatted `labelLines` by guessing which lines are titles, labels, or values. Change renderer-owned render models where necessary so structured title and attribute information survives until scene construction.

Maintain these rules:

- Projection node name becomes the shared-node title.
- Detail-display policy determines which optional semantic annotations are included.
- Included annotations become ordered `SharedNodeAttribute` values.
- Stable semantic identities, not display labels, become `groupId` values.
- Raw attribute labels may remain lower case; shared-node normalization owns editorial title casing.
- Attribute values and IDs are never case-normalized.
- Repeated annotations with the same semantic group remain separate input attributes and are consolidated by the shared node.

### Width and Overflow

The accepted shared node is `224px` wide and grows vertically. Remove migrated nodes' local `narrow`/`standard`/`wide` selection and local `escalate_width_band` or `secondary_area` overflow behavior.

Do not preserve renderer-specific width merely to minimize golden changes. If the fixed shared width exposes a real diagram-level problem:

1. verify that the shared node itself satisfies its acceptance contract;
2. diagnose the owning grid, lane, hierarchy, or routing policy;
3. correct a genuine shared macro-layout or routing gap;
4. stop if the only available fix is a renderer-specific internal node variant.

If adaptive node width is later required, design it as a content-driven shared-node capability and migrate every renderer through that common rule.

### Ports, Classes, and Metadata

Preserve each renderer's existing port IDs, roles, sides, offsets, and offset policies. Preserve `viewMetadata`, placement classes, type classes, and other semantic selectors.

Existing shape and visual-role data must remain available where it is part of a render model or bundle contract:

- Service blueprint may continue to carry `component`, `cylinder`, and `hexagon` shape metadata.
- Outcome-opportunity map must continue to consume bundle-owned `visual_role` and `legacy_dot_shape` values.
- Scenario flow may continue to carry its projected shape and style metadata.

Do not recreate staged cylinder, hexagon, ellipse, or note geometry during this migration. Those names currently affect legacy renderers or survive as staged classes, but the staged SVG backend presently draws their semantic nodes as rectangles.

`ViewState` dashed chrome is different: it is an actual staged-SVG distinction today. Preserve it provisionally as a paint-only semantic state applied to the shared node's final outline. It must not alter shared measurement, wrapping, padding, or composition. Confirm its intended permanence during the `scenario_flow` proof review.

### Legacy Outputs

Do not route DOT, Mermaid, or Graphviz through `buildSharedNode`. Their existing shape interpretation and serialization remain unchanged. Add regression coverage where needed to prove the staged migration did not alter legacy artifacts.

## Preparation Gate

Before migrating the next renderer:

1. Record the current test and golden inventory for all five remaining staged renderers.
2. Identify assertions that test semantic structure, macro layout, routing, ports, diagnostics, node dimensions, and literal SVG separately.
3. Select one canonical proof fixture per renderer plus any targeted fixture needed for optional attributes, long titles, repeated attributes, or root-versus-contained placement.
4. Add shared integration assertions that can be reused for every renderer:
   - every eligible leaf has `sharedNode` structured content;
   - no eligible leaf uses caller-built content blocks;
   - decorator mode propagates unchanged;
   - width is the shared width;
   - node height matches measured content;
   - ports and view metadata survive the conversion;
   - shared-node SVG structure and explicit alphabetic baselines are used;
   - no migrated leaf retains a local width or overflow policy.
5. Capture the pre-migration SVG/PNG and positioned scene for the selected proof fixture. Use them to compare layout and routing, not to require pixel identity inside nodes.

Do not update goldens during this preparation gate.

## Phase 1: Migrate `scenario_flow`

### Why First

Scenario-flow nodes currently carry only a name as node content. This makes it the smallest semantic adapter and the clearest proof that fixed-width shared nodes can participate in an existing lane/grid and routing system.

### Semantic Mapping

- title: projection node name
- node type and ID: existing render-node values
- decorator mode: resolved staged setting
- attributes: none with current view conventions
- classes: preserve lane, placement-role, type, shape, and style classes
- ports: preserve flow, mirror, and realization ports exactly
- view metadata: preserve current scenario-flow placement metadata

Replace renderer-owned `labelLines` with an unformatted title field, or otherwise remove it at the earliest renderer-owned boundary where it is no longer needed by a legacy path. Do not make the staged builder extract a title from presentation lines.

### Special Proofs

- `Step`, `Place`, and `ViewState` all use shared nodes.
- A long name wraps and grows vertically without width-band escalation.
- Type/ID decorator modes work for all three types.
- Dashed `ViewState` remains a paint-only distinction on the shared outline, pending explicit visual acceptance.
- Lane membership, component placement, branch placement, and all connector endpoints remain correct.

### Exit Criteria

- All eligible scenario-flow leaves use `buildSharedNode`.
- Scenario-flow contains no local node content-block, typography, width-band, or overflow construction.
- Routing and macro-layout acceptance pass after expectations tied solely to old node allocations are deliberately updated.
- One integrated SVG/PNG proof is visually accepted before scenario-flow goldens are refreshed.

## Phase 2: Migrate `service_blueprint`

### Why Second

Service-blueprint nodes are also title-only today, so they reuse the adapter proven by scenario flow. Its lane, band, cell, and connector-plan tests then exercise the shared node under more coupled grid and routing behavior.

### Semantic Mapping

- title: projection node name
- node type and ID: existing render-node values
- decorator mode: resolved staged setting
- attributes: none with current view conventions
- classes: preserve semantic type, shape, lane/cell, parking, and other placement classes
- ports: preserve flow, support, and resource ports, including the current resource offsets
- view metadata: preserve the semantic node's service-blueprint cell identity

Keep shape metadata for legacy compatibility and diagnostics, but do not implement component, cylinder, or hexagon geometry in the staged shared-node path.

### Special Proofs

- At least one each of `Step`, `SystemAction`, `DataEntity`, and `Policy` renders through the shared path.
- The `DataEntity` still carries `shape-cylinder` metadata without pretending that the staged backend renders a cylinder.
- The fixed grid remains deterministic when formerly narrow Step nodes become `224px` wide.
- North/south support and resource routes still attach to the intended ports and do not enter node boxes.
- Crowded gutter compression and merged/incompatible connector behavior remain readable and diagnostic behavior remains intentional.

### Exit Criteria

- All eligible service-blueprint leaves use `buildSharedNode`.
- Lane shells, cells, bands, routing ownership, and connector planning are structurally unchanged.
- Shape metadata remains available to legacy paths.
- The canonical service-blueprint proof is visually accepted before renderer-stage and routing-debug goldens are refreshed.

## Phase 3: Migrate `outcome_opportunity_map`

### Why Third

This renderer is the first remaining migration that converts optional secondary presentation lines into real shared attributes. It also removes type-specific overflow policies and exercises hierarchy/column routing with variable node heights.

### Semantic Mapping

- title: projection node name
- node type and ID: existing render-node values
- decorator mode: resolved staged setting
- `instrumented_at` references:
  - include only when the resolved detail policy enables instrumentation annotations;
  - group by the reference's stable instrumentation group;
  - use that group as the raw attribute label;
  - use the existing formatted target name/ID as the value.
- `implemented_by` references:
  - include only when the resolved detail policy enables implementation annotations;
  - group under a stable `implemented_by` identity;
  - use the bundle-provided implementation annotation label;
  - use the existing formatted target name/ID as the value.
- classes: preserve type, bundle-owned visual role, legacy shape, semantic column, band, placement role, and parking selectors
- ports and view metadata: preserve unchanged

Replace the render model's combined reference strings with structured reference attributes. Preserve the existing bundle-driven inclusion policy and implementation label; do not duplicate those conventions in the staged scene builder.

### Special Proofs

- Instrumentation examples consolidate repeated Event or Experience references under one title-cased label.
- Implementation references use the bundle-owned label and preserve target ordering.
- Compact/detail display suppression still removes the corresponding attributes.
- `Metric` no longer uses a secondary-area one-line overflow rule.
- `Outcome`, `Opportunity`, and the other node types no longer escalate width bands.
- Bundle `visual_role` and `legacy_dot_shape` mutation tests continue to prove runtime consumption, even though shared staged chrome is uniform.
- Hierarchy placement, parking behavior, labels on connectors, and routing remain acceptable with variable heights.

### Exit Criteria

- No outcome-opportunity leaf reconstructs attributes from punctuation-bearing display lines.
- All four semantic types use the shared node.
- Bundle authority for display policy, implementation labels, visual roles, and legacy shapes remains demonstrable.
- Canonical and targeted instrumentation proofs are accepted before goldens are refreshed.

## Phase 4: Migrate `ia_place_map` Places

### Why Fourth

IA introduces nested containment, Place-owned scopes, mixed top-level source order, and local structural routing. It should migrate only after title-only and attribute-bearing leaf integrations are stable.

### Semantic Mapping

- title: projection Place name
- node type: `Place`
- node ID: existing Place ID
- decorator mode: resolved staged setting
- route/key subtitle: an ordered attribute with stable group identity and a raw label such as `route or key`
- access badge: an ordered attribute with stable group identity and raw label `access`
- display metadata: ordered attributes preserving the existing annotation keys, values, and source order
- ports: preserve the IA north/south chain and east/west ports, including the chain offset
- classes: preserve root/nested Place and depth selectors

The render model must carry structured Place title and attributes rather than `buildIaStylePlaceLabelLines` output for the staged node. Continue using the resolved detail-display policy to decide whether route/key, access, and metadata are included.

The former badge and subtitle visual treatments intentionally become shared attribute groups. Do not add shared-node badge or subtitle variants to reproduce the old card internals.

### Container Boundary

- Keep `Area` as a `SceneContainer` with its existing header and children.
- Keep each structural Place wrapper/owned-scope container.
- Replace only the actual Place `SceneNode` inside that structure.
- Do not turn an Area header into a decorator or shared-node title.

### Special Proofs

- Mixed top-level Area/Place source order is unchanged.
- Nested Places remain owned by the same Place or Area containers.
- Hub/follower grouping and earliest-hub claiming remain unchanged.
- Local contains/navigation edge merging and forward-only structure remain unchanged.
- The reference-style hub/follower proof remains readable at the shared width.
- Detail suppression produces the expected reduced attribute list without caller-side formatting.

### Exit Criteria

- Every Place leaf uses the shared node.
- No Area or structural wrapper uses shared-node rendering.
- IA structural ownership and local route semantics are unchanged.
- One mixed-container proof and the reference hub/follower proof are visually accepted before IA goldens are refreshed.

## Phase 5: Migrate `journey_map` Steps

### Why Last

Journey-map routing has the largest set of exact endpoint, branch/join, reciprocal, self-loop, duplicate-occurrence, and dense-layout acceptance constraints. Its Stage grid and root-level Steps also exercise both contained and uncontained shared nodes.

### Semantic Mapping

- title: projection Step name
- node type: `Step`
- node ID: existing Step ID
- decorator mode: resolved staged setting
- reference badges: ordered shared attributes grouped by their stable semantic reference role; derive the raw display label deterministically from that role and retain the current target-name/ID value
- classes: preserve journey-map and contained/root Step selectors
- ports: preserve all four journey flow/escape ports exactly
- view metadata: preserve existing contained/uncontained and ordering metadata

The render model must retain structured reference data and stop appending badge labels to `labelLines`. The resolved detail policy continues to decide whether references are included. Shared-node grouping owns repeated roles and shared title casing owns their display labels.

Before implementation, lock the deterministic role-to-label rule with focused examples. If a human-readable label cannot be derived without encoding a new semantic convention, stop and add that display label through the appropriate bundle-owned view convention rather than hiding a keyword table in TypeScript.

### Container Boundary

- Keep `Stage` as a `SceneContainer`.
- Preserve its header band, padding, grid/stack strategy, child ordering, metadata, and routing ownership.
- Replace only contained and root Step `SceneNode` instances.
- Do not render Stage title or ID with the shared-node decorator.

### Special Proofs

- Empty and single-Step Stages remain valid.
- Source-ordered Stage/root-Step hierarchy is unchanged.
- Reference visibility and repeated-reference ordering remain deterministic.
- Contained and root Steps use identical shared-node composition for equivalent semantic requests.
- Same-Stage skips, cross-Stage routes, branches, joins, backwards routes, reciprocal SCCs, self-loops, and duplicate endpoints remain outside node boxes and preserve accepted endpoint semantics.
- Any change to exact route coordinates is explained by changed node allocations and independently reviewed for readability; it is not accepted merely because snapshots were regenerated.
- Existing recorded dense-layout acceptance debt is not reclassified as solved by this migration.

### Exit Criteria

- Every Journey Step uses the shared node and every Stage remains a container.
- The scene retains exact semantic edge identity and routing ownership.
- All non-dense accepted routing proofs remain accepted.
- Known dense-layout failures remain explicitly reported until separately remediated.
- Journey renderer-stage, routing, visual-acceptance, and corpus goldens are refreshed only after the proof review.

## Test and Golden Strategy for Every Phase

Use the following order for each renderer:

1. Update or add render-model tests for structured semantic title and attributes.
2. Add RendererScene assertions for shared-node content, decorator propagation, ports, classes, and view metadata.
3. Run shared measurement and structural SVG assertions before snapshot changes.
4. Run macro-layout and routing tests against the new measured dimensions.
5. Inspect the canonical SVG at 100% in Firefox and VS Code and inspect the PNG derived from it.
6. Import the canonical SVG into Figma when the renderer exercises a new composition or when browser/native-import results differ.
7. Report satisfied invariants, violated invariants, and visual acceptability.
8. Update only that renderer's stage snapshots and goldens.
9. Run all previously migrated renderer suites to detect shared regressions.
10. Run the full staged-renderer, preview, artifact-path, font, deterministic-SVG, and rendered-corpus suites.

Classify changed expectations before updating them:

- **Required node change:** shared typography, chrome, decorator, title casing, width, height, or internal structure.
- **Expected allocation consequence:** container size, cell size, item position, or route coordinate changed because a node's measured box changed.
- **Regression:** lost semantic content, wrong order, wrong port, edge entering a node, broken containment, unintended clipping/wrapping, changed legacy output, or a container visual changing without justification.

Only the first two categories may be accepted in this migration.

## Cleanup After the Final Migration

After all five renderer proofs are accepted:

- remove generic card-node formatting helpers only when no non-shared consumer still needs them;
- remove obsolete local node width-policy and overflow-policy builders;
- remove renderer-model `labelLines` fields that existed only for staged leaf-node presentation;
- retain generic content blocks for containers, headers, connector labels, annotations, and other non-shared primitives;
- retain shape and visual-role fields required by bundle authority, legacy renderers, diagnostics, or semantic CSS hooks;
- document the final eligible-node/container boundary in the staged renderer architecture;
- update the implementation status in `shared_node_renderer_implementation_plan.md`.

Do not broaden cleanup into connector-label font remediation. That work has a separate acceptance concern and should remain independently reviewable.

## Stop Conditions

Stop the current renderer migration rather than normalizing its goldens when:

- the shared node fails its accepted standalone measurements or visual contract;
- a caller must provide line breaks, line counts, density, dimensions, or formatted label/value strings;
- a proposed fix adds renderer-specific node typography, padding, wrapping, or width behavior;
- semantic annotation grouping cannot be derived from structured data;
- a required display convention belongs in the bundle but is available only as a new hardcoded TypeScript mapping;
- a container must be converted to a node to make the layout work;
- routing enters a node, loses an endpoint, changes semantic ownership, or becomes materially less readable;
- a legacy DOT, Mermaid, or Graphviz artifact changes;
- snapshot regeneration would be the only evidence that the result is acceptable.

## Completion Criteria

The adoption is complete when:

- `ui_contracts` and all five remaining staged renderers use the shared component for every eligible leaf semantic node;
- no migrated builder supplies presentation choices beyond semantic content, ports, placement classes, and view metadata;
- Area, Stage, and all other structural containers remain on the container path;
- shared-node typography, layout, title casing, baselines, and SVG structure are consistent across diagram types;
- all bundle-owned display and legacy-shape behavior remains authoritative and testable;
- accepted macro-layout and routing behavior remains readable and semantically correct;
- SVG is still the first-class artifact and PNG remains derived from SVG;
- all targeted, cross-renderer, legacy-regression, and corpus tests pass;
- final visual proofs are accepted before their goldens are committed.
