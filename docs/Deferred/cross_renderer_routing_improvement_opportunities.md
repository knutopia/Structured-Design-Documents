# Cross-Renderer Routing Improvement Opportunities

8-26-26

> What happened here?
>
> User context
>
> Attachments:
> - knut@sdd:~/projects/sdd/docs/sdd_app_planning$ pnpm sdd show $PWD/sdd_for_sdd.s…: `/mnt/c/Users/Knut/.codex/attachments/4de2d800-6c3c-4218-9785-db9d95da7ff8/pasted-text.txt`

<details><summary>6 previous messages</summary>

> I’ll inspect the pasted terminal transcript and trace the reported behavior back to the relevant command path in this repository. I’m using the SDD skill because this is specifically an `sdd show` diagnosis.
>
> <details><summary>Explored 2 files</summary>
>
> - Read `/mnt/c/Users/Knut/.codex/skills/sdd-skill/SKILL.md`
> - Read `/mnt/c/Users/Knut/.codex/attachments/4de2d800-6c3c-4218-9785-db9d95da7ff8/pasted-text.txt`
>
> </details>
>
> The transcript shows a renderer-quality failure, not a parser or package-manager failure: the document reached layout/routing, then `show --view all` found five connector-to-node collisions and deliberately returned exit code 1. I’m checking whether artifacts were still written and why warnings/info were bundled into the same report.
>
> <details><summary>Explored 4 files, 2 searches, ran 2 commands</summary>
>
> - Ran `rg -n "renderer\.routing\.(scenario_flow_node_intersection|service_blueprint_node_intersection)|journey_map_unavoidable_crossing|show" packages src apps scripts test tests 2>/dev/null | head -n 260
> find docs/sdd_app_planning -maxdepth 2 -type f -printf '%TY-%Tm-%Td %TH:%TM:%TS %p\n' | sort
> rg -n "J-030|J-031|J-032|J-010|J-020|J-040|J-043|J-044|J-045|P-010|P-012|P-014|P-016" docs/sdd_app_planning/sdd_for_sdd.sdd`
>
> <details><summary>Explored 4 files, a search</summary>
>
> - Searched for `scenario_flow_node_intersection|service_blueprint_node_intersection|unavoidable_crossing|disconnected_chain|disconnected_scoped_node` in `src`
> - Read `./tests/cli.spec.ts`
> - Read `./src/cli/program.ts`
> - Read `./src/cli/program.ts`
> - Read `./docs/sdd_app_planning/sdd_for_sdd.sdd`
>
> </details>
>
> - Ran `rg -n "async function runShowCommand|function runShowCommand|runShowCommand" src/cli
> sed -n '3540,3655p' src/renderer/staged/scenarioFlowRouting.ts
> sed -n '4010,4095p' src/renderer/staged/serviceBlueprintRouting.ts
> sed -n '380,435p' src/renderer/staged/journeyMap.ts
> TMPDIR=/tmp pnpm sdd validate docs/sdd_app_planning/sdd_for_sdd.sdd --diagnostics json`
>
> <details><summary>Explored 3 files, a search</summary>
>
> - Read `./src/cli/program.ts`
> - Read `./src/cli/program.ts`
> - Searched for `has.*error|severity.*error|RendererDiagnostic` in `cli`
> - Read `./src/renderer/staged/scenarioFlowMiddleLayer.ts`
>
> </details>
>
> </details>
>
> Validation succeeds cleanly, so the `.sdd` itself is accepted under the current profile. The failure is confined to staged rendering, and `--view all` is intentionally atomic: if any applicable view has a renderer error, it writes none of the batch—even views that rendered successfully.
>
> <details><summary>Explored 5 files, ran a command</summary>
>
> - Ran `TMPDIR=/tmp pnpm sdd defaults show
> sed -n '500,705p' src/cli/program.ts
> sed -n '220,320p' src/renderer/previewWorkflow.ts
> rg -n "batch_applicability|scenario_flow|service_blueprint|journey_map" bundle/v0.1/core/views.yaml | head -n 120`
>
> <details><summary>Explored 5 files</summary>
>
> - Read `./src/cli/program.ts`
> - Read `./src/renderer/previewWorkflow.ts`
> - Read `./docs/sdd_app_planning/sdd_for_sdd.sdd`
> - Read `./src/renderer/staged/scenarioFlowRouting.ts`
> - Read `./src/renderer/staged/serviceBlueprintRouting.ts`
>
> </details>
>
> </details>
</details>

The `.sdd` file is valid; the new staged renderer could not route several connectors without crossing nodes.

What occurred:

- `sdd show --view all` compiled and validated successfully using the defaults `simple` + `compact`.
- During rendering:
  - `scenario_flow`: `J-030 → J-032` crosses `J-031`. The source forms a triangle: `J-030 → J-031 → J-032`, plus the direct `J-030 → J-032` edge ([source](./docs/sdd_app_planning/sdd_for_sdd.sdd:215)).
  - `service_blueprint`: four connectors still intersected unrelated node boxes, especially around the large `J-040` fan-out ([source](./docs/sdd_app_planning/sdd_for_sdd.sdd:172)).
- Those five collisions are renderer errors. The journey crossings and disconnected/parked nodes are only warnings or information.
- `--view all` is atomic: any renderer error prevents every batch artifact from being written ([implementation](./src/cli/program.ts:682)). Consequently, no new diagrams were saved.
- `ELIFECYCLE` merely means pnpm received exit code 1 from `sdd`; pnpm itself did not fail.

So this is principally a staged-routing limitation exposed by this document—not malformed SDD. Removing `J-030 → J-032` may resolve the scenario-flow collision if that shortcut is unintended. For the service blueprint, render that view with the legacy backend or address the router; I would not distort the document merely to satisfy it. Successful views can also be generated individually, avoiding the all-or-nothing batch behavior.

> Thank you. I edited the sdd file so that at least scenario\_flow renders for now. The non-working version preseved in [sdd\_for\_sdd\_rendering\_issues.sdd](docs/sdd_app_planning/sdd_for_sdd_rendering_issues.sdd) .
>
> We ran into some other rendering issues recently too, for outcome\_opportunity\_map: [outcome\_opportunity\_map\_routing\_fix.md](docs/Deferred/outcome_opportunity_map_routing_fix.md)&#x20;
>
> Do you see any common ground between those 3 issues, architecturally, or will addressing them essentially require 3 different work threads?
>
> Do not write any code.

<details><summary>8 previous messages</summary>

> I’ll compare the preserved scenario/service-blueprint case with the outcome-map routing notes, then trace each failure through the staged renderer pipeline. I’m using the SDD skill for the document-side semantics; this is analysis only, with no code or file changes.
>
> <details><summary>Ran a command</summary>
>
> - Ran `sed -n '1,240p' /mnt/c/Users/Knut/.codex/skills/sdd-skill/SKILL.md
> sed -n '1,320p' docs/Deferred/outcome_opportunity_map_routing_fix.md
> sed -n '1,280p' docs/sdd_app_planning/sdd_for_sdd_rendering_issues.sdd
> sed -n '1,280p' docs/sdd_app_planning/sdd_for_sdd.sdd
> diff -u docs/sdd_app_planning/sdd_for_sdd_rendering_issues.sdd docs/sdd_app_planning/sdd_for_sdd.sdd || true`
>
> </details>
>
> The common ground is already visible: all three are valid semantic graphs that become invalid only after final connector placement. I’m now checking whether they share an actual routing mechanism—or merely the same failure class—because that determines whether one foundation thread can materially reduce the other two.
>
> <details><summary>Explored a file, a search, ran 5 commands</summary>
>
> - Ran `sed -n '1,140p' src/renderer/staged/outcomeOpportunityMapRouting.ts
> sed -n '1,140p' src/renderer/staged/scenarioFlowRouting.ts
> sed -n '1,150p' src/renderer/staged/serviceBlueprintRouting.ts
> rg -n "function (findRouteIntersection|routeIntersectsForbiddenBoxes|resolveTargetEdgeLocalCompaction|resolveOccupancyDisplacements|buildGutter|chooseCrossingMinimizedOrder|buildFinalRoute)" src/renderer/staged/{outcomeOpportunityMapRouting,scenarioFlowRouting,serviceBlueprintRouting}.ts
> rg -n "export (function|interface|type|const)|from \"\.\/.*(routing|geometry|connector|gutter|occupancy)" src/renderer/staged/{outcomeOpportunityMapRouting,scenarioFlowRouting,serviceBlueprintRouting}.ts | head -n 300
> find src/renderer/staged -maxdepth 1 -type f -printf '%f\n' | sort | rg 'routing|Routing|connector|geometry|Geometry|gutter|occup|route'`
>
> - Ran `sed -n '1,260p' src/renderer/staged/routing.ts
> sed -n '1,220p' src/renderer/staged/connectorLabelPlacement.ts
> rg -n "FIXED_SEPARATION_DISTANCE|OBSTACLE_SWERVE_CLEARANCE|GUTTER_OVERFLOW_TOLERANCE|type .*GutterKind|interface .*GutterOccupancy|function buildGutterRects|function buildGutterOccupancyForIntersection|function resolveOccupancyDisplacements|function buildFinalRoute|routeIntersects|findRouteIntersection" src/renderer/staged/{outcomeOpportunityMapRouting,scenarioFlowRouting,serviceBlueprintRouting}.ts
> rg -n "diagnostic.*intersection|node_intersection|collinear|crossing|overlap" src/renderer/staged/outcomeOpportunityMapRouting.ts | tail -n 120`
>
> - Ran `sed -n '3640,3725p' src/renderer/staged/outcomeOpportunityMapRouting.ts
> sed -n '4860,5045p' src/renderer/staged/outcomeOpportunityMapRouting.ts
> sed -n '3840,3895p' src/renderer/staged/serviceBlueprintRouting.ts
> sed -n '1070,1125p' src/renderer/staged/scenarioFlowRouting.ts
> rg -n "node_intersection|edge.*intersection|collinear|crossing" src/renderer/staged/outcomeOpportunityMapRouting.ts tests/outcomeOpportunity* tests/stagedOutcome* 2>/dev/null | head -n 260`
>
> - Ran `sed -n '3625,3805p' src/renderer/staged/scenarioFlowRouting.ts
> sed -n '3880,4120p' src/renderer/staged/serviceBlueprintRouting.ts
> rg -n "function (buildPreparedRoutesWithObstacleCompaction|applyGlobalGutterExpansions|resolveRequiredGlobalGutterState|buildGlobalGutterState|extractGutterOccupancyByConnector|buildNodeEdgeBuckets|buildNodeGutters|buildIndex)" src/renderer/staged/{outcomeOpportunityMapRouting,scenarioFlowRouting,serviceBlueprintRouting}.ts`
>
> <details><summary>Explored 3 files, a search</summary>
>
> - Read `./bundle/v0.1/core/views.yaml`
> - Read `./bundle/v0.1/core/views.yaml`
> - Read `./bundle/v0.1/core/views.yaml`
> - Searched for `routing|gutter|clearance|separation|crossing|overlap|connector` in `views.yaml`
>
> </details>
>
> - Ran `rg -n "shared routing|routing infrastructure|connector routing|gutter occupancy|orthogonal rout|route.*constraint|node intersection" docs src/renderer tests | head -n 320
> wc -l src/renderer/staged/{outcomeOpportunityMapRouting,scenarioFlowRouting,serviceBlueprintRouting}.ts
> rg -n "MAX_.*ATTEMPT|MAX_GLOBAL_GUTTER_ATTEMPTS|MAX_FINAL_ROUTING_ATTEMPTS" src/renderer/staged/{outcomeOpportunityMapRouting,scenarioFlowRouting,serviceBlueprintRouting}.ts`
>
> </details>
>
> A key architectural clue is that Outcome–Opportunity and Service Blueprint were explicitly designed from the same routing architecture, while Scenario Flow later copied the same concepts into a separate router. That makes this neither one small fix nor three unrelated problems.
>
> <details><summary>Explored 4 files, ran a command</summary>
>
> <details><summary>Explored 4 files</summary>
>
> - Read `./docs/Done/[Done] outcome_opportunity_map_renderer_implementation/[Done] outcome_opportunity_service_blueprint_routing_architecture.md`
> - Read `./docs/Deferred/renderer_migration_master_plan.md`
> - Read `./docs/Done/[Done] scenario_flow_renderer_implementation/[Done] scenario_flow_routing_parity_plan.md`
> - Read `./docs/Done/[Done] scenario_flow_renderer_implementation/[Done]  scenario_flow_renderer_design.md`
>
> </details>
>
> - Ran `rg -n "function (collectIntersecting|expect.*Node|expect.*Intersect|collect.*Cross|expect.*Separ|route.*node)|node intersection|same-orientation|collinear" tests/{scenarioFlowRouting,stagedScenarioFlow,stagedServiceBlueprint,outcomeOpportunityMapRouting,stagedVisualAcceptance}.spec.ts | head -n 340
> sed -n '1,90p' tests/stagedVisualAcceptance.spec.ts
> sed -n '820,890p' tests/outcomeOpportunityMapRouting.spec.ts
> sed -n '730,790p' tests/stagedServiceBlueprint.spec.ts
> sed -n '300,345p' tests/scenarioFlowRouting.spec.ts`
>
> </details>
>
> The architectural diagnosis is now fairly clear: the repository has a shared routing vocabulary, but not a shared routing engine. The three routers independently implement gutters, occupancy, endpoint ordering, expansion, and final validation—about 12,900 lines across three files—so fixes can share design and tests while still requiring view-local integration.
>
> <details><summary>Explored 6 files</summary>
>
> - Read `./docs/Done/[Done] outcome_opportunity_map_renderer_implementation/[Done] outcome_opportunity_service_blueprint_routing_architecture.md`
> - Read `./docs/Done/[Done] scenario_flow_renderer_implementation/[Done] scenario_flow_routing_parity_plan.md`
> - Read `./docs/Deferred/outcome_opportunity_map_routing_fix.md`
> - Read `./src/renderer/staged/outcomeOpportunityMapRouting.ts`
> - Read `./src/renderer/staged/scenarioFlowRouting.ts`
> - Read `./src/renderer/staged/serviceBlueprintRouting.ts`
>
> </details>
</details>

Yes—there is substantial common ground, but I would not address all three in one implementation thread.

The shared architectural problem is that the routing loops declare themselves settled based on local gutter/spacing calculations, while full geometry validity is checked only afterward. Residual node intersections, edge overlaps, and crossings are reported—or sometimes not detected—but are not fed back into route selection or expansion.

| Case | Immediate failure | Shared architectural gap |
|---|---|---|
| Outcome–Opportunity | Target-local lanes overlap or reverse order, producing merged tracks and staircase crossings | Lane allocation is locally heuristic; final validation does not comprehensively cover edge-to-edge conflicts |
| Scenario Flow | The shortcut `J-030 → J-032` passes through `J-031` | Final node-intersection detection reports the invalid route but does not trigger another corridor choice |
| Service Blueprint | Dense `J-040` fan-out and `J-010 → J-020` pass through unrelated nodes | The expansion loop can report “no more expansion needed” even though final routes remain geometrically invalid |

This is visible in the control flow:

- Scenario Flow finishes its expansion loop and only then emits intersection diagnostics ([scenario router](./src/renderer/staged/scenarioFlowRouting.ts:3665)).
- Service Blueprint similarly completes routing and only afterward checks forbidden boxes ([service router](./src/renderer/staged/serviceBlueprintRouting.ts:4060)).
- Outcome–Opportunity checks node intersections after reconstruction, but its observed edge-to-edge overlaps and crossings are not an equivalent final blocker ([outcome router](./src/renderer/staged/outcomeOpportunityMapRouting.ts:3675)).

There is also an important historical signal. Both the Outcome–Opportunity architecture and the Scenario Flow parity plan explicitly treated Service Blueprint as the proven routing model ([architecture](./docs/Done/[Done]%20outcome_opportunity_map_renderer_implementation/[Done]%20outcome_opportunity_service_blueprint_routing_architecture.md:21), [parity plan](<./docs/Done/[Done] scenario_flow_renderer_implementation/[Done] scenario_flow_routing_parity_plan.md:3>)). The new Service Blueprint failure shows that it was proof-case reliable, not generally complete. Copying its phase structure propagated the same blind spot.

What is actually shared today is mostly vocabulary and control-flow shape:

- endpoint buckets
- gutters and occupancy records
- fixed separation
- bounded expansion
- final-route reconstruction
- diagnostics and label placement

But these are independently implemented in three view-specific files—roughly 12,900 lines combined. There is no common constraint-solving router underneath them. Therefore, one fix will not automatically repair the other two.

My recommendation is one architectural umbrella with three bounded remediation threads:

1. **Shared routing contract and proof matrix**

   Make all three preserved cases first-class proof cases. Define common hard invariants: no non-endpoint node intersection, no endpoint intrusion, no collinear overlap, deterministic minimum spacing, and an explicit crossing policy. Most importantly, define that residual final violations must either cause bounded repair/re-expansion or a clearly classified degraded result.

2. **Outcome–Opportunity lane allocation**

   Keep this separate because its diagnosis is already precise: target-edge compaction owns the defective coordinates and ordering ([handoff](./docs/Deferred/outcome_opportunity_map_routing_fix.md:36)). This is primarily monotonic lane assignment and crossing minimization, not obstacle detouring.

3. **Scenario Flow and Service Blueprint obstacle remediation**

   Treat these as sibling threads under one “residual node intersection” design. They can share geometry predicates, candidate scoring, and a validate-and-repair contract, but their route archetypes and placement structures differ enough that integration should remain separately gated.

I would extract shared production helpers only after two routers demonstrate genuinely identical behavior. The earlier architecture guidance already recommends that restraint ([routing architecture](./docs/Done/[Done]%20outcome_opportunity_map_renderer_implementation/[Done]%20outcome_opportunity_service_blueprint_routing_architecture.md:292)).

One additional architectural concern: endpoint-side ordering, channel priority, and preferred corridor policies may be bundle-owned conventions. A fix that simply branches on the literal `initiative_addressing` channel in TypeScript risks repeating the repository’s bundle-authority problem. Generic geometry belongs in shared renderer infrastructure; view/channel policy should come through bundle-consumed renderer defaults where it represents intended behavior.

So: **not three unrelated efforts, but probably three implementation threads coordinated by one shared routing-hardening contract**. A monolithic generic-router rewrite would be risky; three isolated patches would miss the clear systemic lesson.

> Please expand the perspective across ALL our diagram types - we implemented them one by one, and each one has different routing code. While ia\_place\_map aund ui\_contracts also have fairly unique layouts, the other diagram types share a lot of similarity. Are there routing-alignment opportunities?

<details><summary>4 previous messages</summary>

> I’ll broaden this into a renderer-wide routing inventory: all operational views, their route archetypes, what they currently share, and where alignment would reduce duplication without flattening legitimate layout differences. I’m using the SDD skill because the view semantics and bundle boundaries matter here; this remains analysis only.
>
> <details><summary>Explored 4 files, 2 searches, ran 2 commands</summary>
>
> - Ran `sed -n '1,240p' /mnt/c/Users/Knut/.codex/skills/sdd-skill/SKILL.md
> rg -n '^  - id:|^    status:|^    name:' bundle/v0.1/core/views.yaml
> find src/renderer/staged -maxdepth 1 -type f -printf '%f\n' | sort
> wc -l src/renderer/staged/*.ts | sort -nr | head -n 40
> rg -n "build.*Routing|RoutingStages|route.*Positioned|position.*Route|route.*Edge|renderStaged.*|build.*PositionedScene" src/renderer/staged/{iaPlaceMap.ts,uiContracts.ts,journeyMap.ts,journeyMapRouting.ts,outcomeOpportunityMap.ts,outcomeOpportunityMapRouting.ts,serviceBlueprint.ts,serviceBlueprintRouting.ts,scenarioFlow.ts,scenarioFlowRouting.ts} 2>/dev/null | head -n 400`
>
> - Ran `sed -n '1,120p' src/renderer/staged/iaPlaceMap.ts
> sed -n '520,640p' src/renderer/staged/iaPlaceMap.ts
> sed -n '1,110p' src/renderer/staged/uiContracts.ts
> sed -n '520,742p' src/renderer/staged/uiContracts.ts
> rg -n "route(Positioned|Measured|Scene|Edges)|route.*Scene|positionRendererScene|macroLayout|routeEdges|buildPositioned" src/renderer/staged/*.ts | head -n 400
> rg -n "iaPlaceMap|uiContracts|renderStagedIa|renderStagedUi|buildIa|buildUi" src/renderer -g '*.ts' | head -n 300`
>
> <details><summary>Explored 7 files, 2 searches</summary>
>
> - Read `./src/renderer/staged/pipeline.ts`
> - Read `./src/renderer/staged/macroLayout.ts`
> - Searched for `^export function|^function` in `routing.ts`
> - Read `./src/renderer/staged/routing.ts`
> - Read `./src/renderer/staged/macroLayout.ts`
> - Read `./src/renderer/staged/macroLayout.ts`
> - Read `./src/renderer/staged/routing.ts`
> - Searched for `export interface RoutingIntent|interface RoutingIntent|type RoutingStyle|LocalRoutePattern` in `contracts.ts`
> - Read `./src/renderer/staged/contracts.ts`
>
> </details>
>
> </details>
>
> The six operational views fall into two routing families. `ia_place_map` and `ui_contracts` use the generic staged pipeline; Journey, Outcome–Opportunity, Service Blueprint, and Scenario Flow each own a large custom router despite sharing orthogonal routes, endpoint buckets, obstacle boxes, occupancy, expansion, and final geometry checks. I’m separating genuinely reusable mechanics from view-owned topology and visual grammar.
>
> <details><summary>Explored 6 files, 3 searches, ran 2 commands</summary>
>
> <details><summary>Explored 8 files, 3 searches</summary>
>
> - Read `./src/renderer/staged/journeyMapRouting.ts`
> - Read `./src/renderer/staged/journeyMapRouting.ts`
> - Read `./src/renderer/staged/journeyMapRouting.ts`
> - Searched for `^import|from "\.\/|type .*Gutter|interface .*Occup|interface .*Bucket|function .*Expansion|function .*Intersect|function .*Cross|function .*Endpoint|function .*Route` in `journeyMapRouting.ts`
> - Searched for `continuity|crossing|gutter|occupancy|expansion|node.*intersection|endpoint.*intrusion|separation` in `journeyMapRouting.ts`
> - Read `./docs/toolchain/architecture.md`
> - Read `./docs/toolchain/development.md`
> - Read `./docs/toolchain/adding_staged_renderers.md`
> - Read `./docs/Done/[Done] journey_map_renderer_implementation/[Done] Deriving a Staged Journey Map Renderer.md`
> - Read `./docs/Deferred/renderer_migration_master_plan.md`
> - Searched for `routing|shared` in `renderer_migration_guidance.md`
>
> </details>
>
> - Ran `for f in src/renderer/staged/{journeyMapRouting,outcomeOpportunityMapRouting,scenarioFlowRouting,serviceBlueprintRouting}.ts; do rg -o '^function [A-Za-z0-9_]+' "$f" | sed "s#^#$f #"; done | awk '{name=$3; count[name]++; files[name]=files[name] " " $1} END {for (name in count) if (count[name] > 1) print count[name], name, files[name]}' | sort -k1,1nr -k2,2
> for f in src/renderer/staged/{journeyMapRouting,outcomeOpportunityMapRouting,scenarioFlowRouting,serviceBlueprintRouting}.ts; do echo "$f"; rg '^import|^} from "\./' "$f" | head -n 70; done
> rg -n "export function expect|export const .*ROUT|function expect.*Route|function collect.*Segment|function .*Intersect" tests/stagedVisualHarness.ts tests/*Routing.spec.ts | head -n 400`
>
> - Ran `rg -n "elk_layered|authority:|avoidNodeBoxes|localPattern|labelPlacement|sourcePortRole|targetPortRole" src/renderer/staged/{iaPlaceMap,uiContracts,journeyMap,outcomeOpportunityMap,serviceBlueprint,scenarioFlow}.ts
> rg -n "layout: \{|strategy:" src/renderer/staged/{iaPlaceMap,uiContracts,journeyMap,outcomeOpportunityMap,serviceBlueprint,scenarioFlow}.ts | head -n 260
> rg -n "routing:" bundle/v0.1/core/views.yaml bundle/v0.1/core/*.yaml
> rg -n "priority_order|edge_type_channels|renderer_defaults:" bundle/v0.1/core/views.yaml | head -n 260`
>
> </details>
</details>

Yes. Across all six operational diagram types, there is a strong routing-alignment opportunity.

The right target is not one universal layout algorithm. It is:

> View-specific placement and route archetypes over a shared deterministic orthogonal-routing core.

That would preserve each diagram’s visual grammar while consolidating geometry, occupancy, constraint solving, expansion, and acceptance.

## Current routing families

| Diagram | Current routing character | Alignment potential |
|---|---|---|
| `ia_place_map` | Generic pipeline with two local patterns: direct vertical and intentional shared trunk | Low for corridor solving; high for shared geometry, endpoints, marker legs, and validation |
| `ui_contracts` | Generic pipeline plus container-origin contract lanes and selective `elk_layered` remnants | Moderate: shared validation, obstacle avoidance, endpoint ownership, and label placement; keep container-lane behavior |
| `journey_map` | Very sophisticated dedicated router: archetypes, stage gates, occupancy, expansion, candidate scoring, crossing minimization and continuity marks | High at the mechanics level; route archetypes and marked-crossing policy remain Journey-specific |
| `outcome_opportunity_map` | Custom columns/bands router with endpoint buckets, local bundles, occupancy, expansion and labels | Very high |
| `service_blueprint` | Custom grid/lane router with almost the same routing phase model as Outcome–Opportunity | Very high |
| `scenario_flow` | Custom lane/band router adapted toward Service Blueprint parity | Very high |

The structural split is striking:

- The generic router is about 1,160 lines and handles ports, simple orthogonal bends, marker legs, basic parallel offsets and labels ([routing.ts](./src/renderer/staged/routing.ts:243)).
- The four custom routers total roughly 22,500 lines:
  - [Journey Map](./src/renderer/staged/journeyMapRouting.ts:1)
  - [Outcome–Opportunity](./src/renderer/staged/outcomeOpportunityMapRouting.ts:1)
  - [Service Blueprint](./src/renderer/staged/serviceBlueprintRouting.ts:1)
  - [Scenario Flow](./src/renderer/staged/scenarioFlowRouting.ts:1)

Outcome, Service and Scenario even independently define many identically named concepts: `buildNodeEdgeBuckets`, `buildEndpointOffsets`, `buildGutterRects`, obstacle compaction, gutter occupancy, global expansion, bridge coordinates and positioned-edge construction. Journey implements equivalent responsibilities using a different resource vocabulary.

## The shared core worth building

### 1. Orthogonal geometry kernel

All views should use one production implementation for:

- axis-aligned route normalization
- point, segment and rectangle operations
- segment–node intersection
- endpoint intrusion
- perpendicular crossings
- collinear overlap
- span overlap and minimum separation
- route extents, bend count and Manhattan length
- marker-terminal leg checks

Those operations are currently duplicated across the custom routers and again—appropriately independently—in the visual test harness.

The tests should retain an independent geometric oracle; production routers should share the production kernel.

### 2. Common constraint and acceptance model

Every final route should be assessed against the same typed constraints:

- no non-endpoint node intrusion
- exterior endpoint departure and arrival
- orthogonality
- minimum terminal leg
- minimum separation for competing tracks
- no prohibited collinear overlap
- label and decoration clearance where required
- explicit crossing policy

The policy must allow view-specific exceptions:

- IA’s shared trunk is an intentional overlap.
- Journey may retain unavoidable perpendicular crossings if they receive continuity marks and warnings.
- Outcome, Service and Scenario generally want competing tracks separated.
- Some UI contract relationships use a reserved source lane.

This would fix the present inconsistency where the same geometric defect is detected differently—or not detected—depending on the view.

### 3. Shared corridor and occupancy solver

Journey, Outcome, Service and Scenario all need a common abstraction resembling:

- physical corridor or gutter rectangle
- permitted routing axis
- nominal track coordinate
- occupied span
- connector priority
- locked or movable claim
- endpoint/bundle ownership
- expandable layout owner
- available bounds

Each view would discover different physical resources:

- Journey: stage gates, stage bypasses, root spans and outer gutters
- Outcome: column and outcome-band gutters
- Service: operational columns and lanes
- Scenario: Step tracks, bands and parking corridors

But track assignment, overlap grouping, fixed separation, overflow calculation and deterministic displacement can be shared.

This is the largest practical alignment opportunity.

### 4. Shared solve–validate–repair lifecycle

The current custom routers broadly do:

`template → occupancy → displacement → expansion → reconstruction → final diagnostic`

The architectural weakness is that final violations usually do not re-enter the solver. The aligned lifecycle should be:

`candidate routes → occupancy → track assignment → expansion → reconstruction → full validation → repair/alternate candidate or expansion → bounded completion`

“No expansion requested” should not imply success if final geometry is invalid.

Journey already contains the strongest version of route candidate scoring—hard traversal violations, separation violations, crossings, preferred family, bends and route length ([candidate selection](./src/renderer/staged/journeyMapRouting.ts:614)). That machinery is a useful source for a generic scoring model, although Journey’s candidate generators should remain view-specific.

### 5. Shared final label placement

There are presently two label-placement families:

- the generic functions in `routing.ts`, used by IA and UI Contracts
- the much larger [connectorLabelPlacement.ts](./src/renderer/staged/connectorLabelPlacement.ts:1), used by Outcome, Service and Scenario

These could converge on one obstacle-aware label service with policy modes for:

- normal segment association
- strict segment placement
- container-origin contract lane
- aggregate labels
- omitted/fallback diagnostics

Label placement should remain downstream of final route geometry.

## What should remain view-specific

The shared core should not know about `Step`, `Opportunity`, `Place`, `PRECEDES`, or `ADDRESSES`.

Keep these in adapters:

- semantic connector-channel selection
- route archetype generation
- port-role selection
- source and target side preferences
- semantic priority
- corridor discovery from the view’s positioned layout
- allowed shared trunks or crossings
- Journey continuity marks
- UI contract container-origin lanes
- decorations and separator ownership
- node placement and macro-layout

That maintains projection as the semantic boundary and routing as a `PositionedScene` concern.

## Bundle boundary

The geometry engine belongs in TypeScript. View semantics and policies that affect machine behavior should remain bundle-driven.

Likely bundle-owned policy includes:

- connector-channel priority
- preferred endpoint sides or port roles
- whether a channel may share tracks
- crossing treatment
- channel-specific ordering policy

Pure geometric mechanics—intersection math, deterministic track allocation, candidate scoring and bounded constraint solving—belong in shared renderer infrastructure.

This distinction is especially important for the Outcome fix: a shared core should not contain a literal `initiative_addressing` branch unless the bundle supplies the relevant channel policy.

## Recommended consolidation sequence

I would use three waves rather than one broad rewrite:

1. **Shared geometry and acceptance contract**

   Establish a six-view proof matrix, including the preserved failing cases. Extract geometry and typed violations without changing route behavior.

2. **Outcome–Opportunity + Service Blueprint foundation**

   These two have the closest structural duplication and are the safest place to extract corridor claims, local bundle assignment, endpoint ordering, displacement and expansion. Resolve the current failures through that shared core, then adapt Scenario Flow.

3. **Journey and generic-pipeline adoption**

   Move Journey incrementally onto the shared geometry, occupancy and validation contracts while preserving its route archetypes and continuity marks. Apply the same final validator and selected endpoint/label services to IA and UI Contracts. Do not expand the remaining ELK-based UI path; replacement of those remnants should be a separately gated migration ([current UI layout remnants](./src/renderer/staged/uiContracts.ts:299)).

So the opportunity is substantial: **four diagram types can share most routing mechanics, while all six can share geometry, validation and diagnostics**. The main architectural mistake to avoid is equating shared routing with shared layout or a single route-template generator. No files were changed.
