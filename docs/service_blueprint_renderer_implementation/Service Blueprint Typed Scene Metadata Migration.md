# Service Blueprint Typed Scene Metadata Migration

## Purpose

This note defines a behavior-preserving refactor of the staged renderer so that
`service_blueprint` structural semantics no longer depend on CSS-style class
tokens or `viewId` branches inside shared layout and routing logic.

It also includes a smaller adjacent cleanup in `ui_contracts`, where a local
layout decision currently depends on the `transition_graph` class even though
the relevant containers already expose distinguishing `role` values.

The target is unchanged rendered output and unchanged routing behavior.
Styling classes remain in place for styling and SVG selectors, but they stop
being the source of truth for layout and routing semantics.

## Current Problem

### `service_blueprint`

The `service_blueprint` middle layer already carries typed structural data such
as:

- `laneId`
- `laneShellId`
- `bandId`
- `bandLabel`
- `bandKind`
- `rowOrder`
- `columnOrder`

That data is flattened into class tokens during staged scene construction, then
later recovered by shared or downstream code via `classes.includes(...)`.
Shared layout also branches on `viewId === "service_blueprint"` for
blueprint-only normalization and validation.

That makes class strings and `viewId` function as a hidden semantic API. The
pattern is brittle and untyped: a harmless styling-token rename can break
layout or routing without TypeScript catching it.

### `ui_contracts`

`resolvePlaceLayout` currently decides whether to use a 2-column layout by
checking whether children include the `transition_graph` class.

Those same containers already expose structured `role` values
(`view_state_graph` and `state_graph`), so the class check is unnecessary and
should be replaced with a role-based helper.

### `ia_place_map`

`ia_place_map` is not part of this migration. It was reviewed for equivalent
class/view backdoors and no comparable structural dependence was found.

## Contract And Interface Decisions

Add optional `viewMetadata` to all staged item contracts that can participate in
service-blueprint structure:

- `SceneContainer`
- `SceneNode`
- `MeasuredContainer`
- `MeasuredNode`
- `PositionedContainer`
- `PositionedNode`

Do not add new top-level scene metadata solely to replace `viewId`.

Keep `classes` unchanged and continue using them for styling and backend
selectors.

Keep `viewId` unchanged and continue using it for artifact identity and
SVG/backend styling only.

The intended metadata shape is:

```ts
interface ViewMetadata {
  serviceBlueprint?: ServiceBlueprintItemMetadata;
}

type ServiceBlueprintItemMetadata =
  | {
      kind: "cell";
      laneId: string;
      laneShellId: string;
      bandId: string;
      bandLabel: string;
      bandKind: ServiceBlueprintBandKind;
      rowOrder: number;
      columnOrder: number;
    }
  | {
      kind: "semantic_node";
      cellId: string;
    };
```

No `ui_contracts` metadata is added in this migration. Its cleanup should use
existing `role` values instead.

## Implementation Slices

This migration should land in narrow, behavior-preserving slices, as described here.
After completing a slice, mark it by prepending [Done] to its title. 

### [Done] 1. Preserve metadata through staged contracts

Add `viewMetadata` to the staged item contracts and preserve it through
measurement and positioning without changing behavior.

Primary files:

- `src/renderer/staged/contracts.ts`
- `src/renderer/staged/microLayout.ts`
- `src/renderer/staged/macroLayout.ts`

### 2. Populate `service_blueprint` metadata at scene build time

When building the `service_blueprint` renderer scene:

- attach cell metadata to staged cell containers
- attach semantic-node metadata to staged semantic nodes

Primary file:

- `src/renderer/staged/serviceBlueprint.ts`

### 3. Move blueprint-only post-layout work out of shared layout branching

Move `service_blueprint`-only post-layout normalization and validation out of
shared `macroLayout` control flow and into an explicit
`service_blueprint` pipeline step that runs after generic positioning.

This removes the need for shared layout code to branch on
`viewId === "service_blueprint"` for structural behavior.

Primary files:

- `src/renderer/staged/macroLayout.ts`
- `src/renderer/staged/serviceBlueprint.ts`

### 4. Switch `service_blueprint` structural readers to typed metadata

Update service-blueprint helpers so structural identification uses typed
metadata rather than class-token matching.

This includes:

- cell identification
- semantic-node identification
- decoration helpers that need blueprint cells
- routing helpers that need blueprint cells or semantic nodes

Primary files:

- `src/renderer/staged/serviceBlueprintRouting.ts`
- `src/renderer/staged/serviceBlueprintDecorations.ts`

### 5. Replace the `ui_contracts` class backdoor with a role-based helper

Update `ui_contracts` place-layout detection to use a helper such as
`isTransitionGraphContainer(item)` based on:

- `role === "view_state_graph"`
- `role === "state_graph"`

Do not add new metadata for this step.

Primary file:

- `src/renderer/staged/uiContracts.ts`

### 6. Remove old structural backdoors after typed behavior is verified

Only after the typed path is fully wired and verified:

- remove the old `service_blueprint` class-based structural checks
- remove the old `service_blueprint` shared `viewId` structural branch

Classes must remain emitted for styling compatibility even after structural
dependence is removed.

## Boundaries And Non-Goals

This migration must not:

- change parser, compiler, validator, projection, or middle-layer semantics
- change `service_blueprint` routing policy
- change `service_blueprint` visual layout intent
- remove existing styling classes from emitted scene items
- change SVG backend `service_blueprint` styling rules that intentionally key
  off classes or view identity
- expand into `ia_place_map`
- turn into a generic renderer-wide metadata framework beyond the minimal
  additions defined above

## Test And Acceptance Plan

Focused baseline and acceptance command:

```sh
TMPDIR=/tmp pnpm vitest tests/serviceBlueprintPreRouting.spec.ts tests/stagedServiceBlueprint.spec.ts tests/stagedUiContracts.spec.ts
```

The migration must preserve passing behavior for:

- `service_blueprint` pre-routing artifact generation
- `service_blueprint` routing debug stages
- `service_blueprint` staged SVG output
- `ui_contracts` staged snapshots
- `ui_contracts` place/view-state structure

The test updates should follow these rules:

- add or update assertions so service-blueprint structural test helpers use
  typed metadata instead of `classes.includes("service_blueprint_cell")`
- retain at least one assertion that legacy classes are still emitted for
  styling compatibility
- update `ui_contracts` tests only as needed to reflect the internal
  role-based detection
- keep expected rendered output and scene structure unchanged
- do not update SVG or PNG snapshots to mask regressions

Renderer, measured-scene, and positioned-scene JSON snapshots may change only
to reflect:

- the intentional new metadata fields
- the removal of class/view-based structural dependence

## Assumptions And Defaults

- Title: `Service Blueprint Typed Scene Metadata Migration`
- Scope: one new migration note file, not an update to
  `Service Blueprint Code Cleanup.md`
- Acceptance bar: rendered output stays unchanged; internal staged-scene JSON
  may gain metadata fields
- `ui_contracts` treatment: include it as a smaller adjacent cleanup in this
  same note, not a separate note
- `ia_place_map` treatment: explicitly mention that it was reviewed and is out
  of scope
