# Staged Journey Map Renderer — Gate 1 Proof Contract

Status: accepted on 2026-07-12; normative for Gates 2–10

Authority: subordinate execution artifact of [`staged_journey_map_renderer_gated_implementation_plan.md`](staged_journey_map_renderer_gated_implementation_plan.md). The bundle and repository policy remain higher authority. This document fixes literal fixture content and acceptance ownership; later gates must return to Gate 1 and re-review any amendment.

## 1. Literal future fixture sources

Gate 2 creates these files byte-for-byte with canonical LF. Gate 1 creates no `.sdd` fixture. All support nodes and `REALIZED_BY` edges exist only to keep strict validation focused; journey projection omits them by bundle scope.

### `tests/fixtures/render/journey_map_staged_primary.sdd`

```sdd
SDD-TEXT 0.1

Stage G-100 "Discover"
  owner=Design
  description="Recognize and frame the journey need"
  order_index=10
  CONTAINS J-101 "Recognize a need"
  CONTAINS J-102 "Compare plans, eligibility details, and expected total cost before choosing"
  CONTAINS J-103 "Shortlist an option"
  + Step J-101 "Recognize a need"
    owner=Design
    description="Recognize a need that starts the journey"
    actor=User
    intent="Understand the need"
    success_criteria="The need is clear"
    PRECEDES J-102 "Compare plans, eligibility details, and expected total cost before choosing"
    REALIZED_BY P-100 "Journey proof surface"
  END
  + Step J-102 "Compare plans, eligibility details, and expected total cost before choosing"
    owner=Design
    description="Compare detailed options before narrowing the choice"
    actor=User
    intent="Compare available options"
    success_criteria="Viable options are understood"
    PRECEDES J-103 "Shortlist an option"
    REALIZED_BY P-100 "Journey proof surface"
  END
  + Step J-103 "Shortlist an option"
    owner=Design
    description="Select a shortlist for deeper evaluation"
    actor=User
    intent="Create a shortlist"
    success_criteria="A shortlist is ready"
    PRECEDES J-201 "Review the recommendation"
    REALIZED_BY P-100 "Journey proof surface"
  END
END

Stage G-200 "Evaluate every option and choose the best path with confidence"
  owner=Design
  description="Evaluate tradeoffs and resolve concerns"
  order_index=20
  CONTAINS J-201 "Review the recommendation"
  CONTAINS J-202 "Compare the tradeoffs"
  CONTAINS J-203 "Resolve remaining concerns"
  CONTAINS J-204 "Choose a path"
  + Step J-201 "Review the recommendation"
    owner=Design
    description="Review the recommendation and supporting evidence"
    actor=User
    intent="Evaluate the recommendation"
    success_criteria="The recommendation is understood"
    kind=decision
    opportunity_refs="OP-200, OP-100"
    PRECEDES J-202 "Compare the tradeoffs"
    PRECEDES J-203 "Resolve remaining concerns"
    REALIZED_BY P-100 "Journey proof surface"
  END
  + Step J-202 "Compare the tradeoffs"
    owner=Design
    description="Compare the tradeoffs between shortlisted options"
    actor=User
    intent="Understand tradeoffs"
    success_criteria="Tradeoffs are explicit"
    PRECEDES J-204 "Choose a path"
    REALIZED_BY P-100 "Journey proof surface"
  END
  + Step J-203 "Resolve remaining concerns"
    owner=Design
    description="Resolve concerns that could block commitment"
    actor=User
    intent="Resolve open concerns"
    success_criteria="Blocking concerns are resolved"
    PRECEDES J-204 "Choose a path"
    REALIZED_BY P-100 "Journey proof surface"
  END
  + Step J-204 "Choose a path"
    owner=Design
    description="Choose the preferred path"
    actor=User
    intent="Make a confident choice"
    success_criteria="A path is selected"
    PRECEDES J-401 "Complete enrollment"
    REALIZED_BY P-100 "Journey proof surface"
  END
END

Step J-250 "Ask for human guidance"
  owner=Design
  description="Ask a person for additional guidance"
  actor=User
  intent="Get human guidance"
  success_criteria="A guidance request is made"
  PRECEDES J-260 "Receive human guidance"
  REALIZED_BY P-100 "Journey proof surface"
END

Step J-260 "Receive human guidance"
  owner=Design
  description="Receive guidance outside the main journey chain"
  actor=User
  intent="Understand the guidance"
  success_criteria="Guidance is received"
  REALIZED_BY P-100 "Journey proof surface"
END

Stage G-300 "Pause and reconsider"
  owner=Design
  description="Represent an intentionally empty journey stage"
  order_index=30
END

Stage G-400 "Commit"
  owner=Design
  description="Complete the selected path"
  order_index=40
  CONTAINS J-401 "Complete enrollment"
  + Step J-401 "Complete enrollment"
    owner=Design
    description="Complete enrollment in the selected option"
    actor=User
    intent="Finish enrollment"
    success_criteria="Enrollment is complete"
    REALIZED_BY P-100 "Journey proof surface"
  END
END

Opportunity OP-100 "Clear total cost"
  owner=Design
  description="Make total cost easy to understand"
  evidence="Journey research"
  segment=all_users
  severity=medium
END

Opportunity OP-200 "Confidence before commitment"
  owner=Design
  description="Increase confidence before commitment"
  evidence="Journey research"
  segment=all_users
  severity=high
END

Place P-100 "Journey proof surface"
  owner=Design
  description="Out-of-view realization target for the primary proof"
  surface=web
  route_or_key=/proof/journey-primary
  access=auth
END
```

### `tests/fixtures/render/journey_map_staged_ordering_ownership.sdd`

```sdd
SDD-TEXT 0.1

Stage G-600 "Authored-first secondary parent"
  owner=Design
  description="A Stage authored first but not selected as the shared Step owner"
  order_index=10
  CONTAINS J-601 "Enter secondary flow"
  CONTAINS J-503 "Shared multiply-contained step"
  CONTAINS J-602 "Leave secondary flow"
  + Step J-601 "Enter secondary flow"
    owner=Design
    description="Enter the secondary authored Stage"
    actor=User
    intent="Enter the secondary flow"
    success_criteria="The secondary flow is entered"
    REALIZED_BY P-500 "Ordering proof surface"
  END
  + Step J-602 "Leave secondary flow"
    owner=Design
    description="Leave the secondary authored Stage"
    actor=User
    intent="Leave the secondary flow"
    success_criteria="The secondary flow is left"
    REALIZED_BY P-500 "Ordering proof surface"
  END
END

Step J-590 "Root handoff"
  owner=Design
  description="An uncontained root handoff before the selected owner"
  actor=User
  intent="Receive a root handoff"
  success_criteria="The handoff is understood"
  REALIZED_BY P-500 "Ordering proof surface"
END

Step J-503 "Shared multiply-contained step"
  owner=Design
  description="A Step with two explicit Stage parents"
  actor=User
  intent="Exercise first-parent selection"
  success_criteria="Exactly one rendered owner is selected"
  PRECEDES J-501 "Last-authored child"
  REALIZED_BY P-500 "Ordering proof surface"
END

Stage G-500 "Projected-first structural owner"
  owner=Design
  description="The canonical projection-first owner for the shared Step"
  order_index=20
  CONTAINS J-503 "Shared multiply-contained step"
  CONTAINS J-502 "Middle-authored child"
  CONTAINS J-501 "Last-authored child"
  + Step J-502 "Middle-authored child"
    owner=Design
    description="The middle child in explicit CONTAINS edge-line order"
    actor=User
    intent="Remain in the middle position"
    success_criteria="Middle placement is preserved"
    REALIZED_BY P-500 "Ordering proof surface"
  END
  + Step J-501 "Last-authored child"
    owner=Design
    description="The final child in explicit CONTAINS edge-line order"
    actor=User
    intent="Expose a backward PRECEDES edge"
    success_criteria="Source order remains unchanged"
    PRECEDES J-502 "Middle-authored child"
    REALIZED_BY P-500 "Ordering proof surface"
  END
END

Step J-591 "Root return"
  owner=Design
  description="A later root Step that returns to an earlier root Step"
  actor=User
  intent="Return to the earlier handoff"
  success_criteria="The backward root route remains visible"
  PRECEDES J-590 "Root handoff"
  REALIZED_BY P-500 "Ordering proof surface"
END

Place P-500 "Ordering proof surface"
  owner=Design
  description="Out-of-view realization target for ordering proof"
  surface=web
  route_or_key=/proof/journey-ordering
  access=auth
END
```

### `tests/fixtures/render/journey_map_staged_topology.sdd`

```sdd
SDD-TEXT 0.1

Step J-790 "Root entry"
  owner=Design
  description="An uncontained entry into exceptional topology"
  actor=User
  intent="Enter the topology proof"
  success_criteria="Both root branches remain visible"
  kind=decision
  PRECEDES J-701 "Begin intentional retry"
  PRECEDES J-791 "Root exit"
  REALIZED_BY P-700 "Topology proof surface"
END

Stage G-700 "Loops and returns"
  owner=Design
  description="Contain annotated loops, an unannotated cycle, and a backward edge"
  order_index=10
  CONTAINS J-701 "Begin intentional retry"
  CONTAINS J-702 "Complete intentional retry"
  CONTAINS J-711 "Begin unannotated retry"
  CONTAINS J-712 "Complete unannotated retry"
  CONTAINS J-713 "Repeat current action"
  CONTAINS J-714 "Return to prior action"
  + Step J-701 "Begin intentional retry"
    owner=Design
    description="Begin a bundle-annotated two-node retry"
    actor=User
    intent="Start an intentional retry"
    success_criteria="The retry starts"
    PRECEDES J-702 "Complete intentional retry" kind=loop
    REALIZED_BY P-700 "Topology proof surface"
  END
  + Step J-702 "Complete intentional retry"
    owner=Design
    description="Return within the annotated retry component"
    actor=User
    intent="Complete the intentional retry"
    success_criteria="The retry returns clearly"
    PRECEDES J-701 "Begin intentional retry"
    REALIZED_BY P-700 "Topology proof surface"
  END
  + Step J-711 "Begin unannotated retry"
    owner=Design
    description="Begin an intentionally unannotated cycle"
    actor=User
    intent="Start the unannotated cycle"
    success_criteria="Validation identifies the component"
    PRECEDES J-712 "Complete unannotated retry"
    REALIZED_BY P-700 "Topology proof surface"
  END
  + Step J-712 "Complete unannotated retry"
    owner=Design
    description="Return within the unannotated cycle"
    actor=User
    intent="Complete the unannotated cycle"
    success_criteria="The warning is stable and routing remains valid"
    PRECEDES J-711 "Begin unannotated retry"
    REALIZED_BY P-700 "Topology proof surface"
  END
  + Step J-713 "Repeat current action"
    owner=Design
    description="Exercise an annotated self-loop"
    actor=User
    intent="Repeat the current action"
    success_criteria="The self-loop arrow is clear"
    PRECEDES J-713 "Repeat current action" kind=loop
    REALIZED_BY P-700 "Topology proof surface"
  END
  + Step J-714 "Return to prior action"
    owner=Design
    description="Exercise a standalone backward edge and root exit"
    actor=User
    intent="Return and then leave the Stage"
    success_criteria="Both routes remain distinguishable"
    kind=decision
    PRECEDES J-713 "Repeat current action"
    PRECEDES J-791 "Root exit"
    REALIZED_BY P-700 "Topology proof surface"
  END
END

Step J-791 "Root exit"
  owner=Design
  description="An uncontained exit from exceptional topology"
  actor=User
  intent="Leave the topology proof"
  success_criteria="The root exit remains ordered"
  REALIZED_BY P-700 "Topology proof surface"
END

Place P-700 "Topology proof surface"
  owner=Design
  description="Out-of-view realization target for topology proof"
  surface=web
  route_or_key=/proof/journey-topology
  access=auth
END
```

### `tests/fixtures/render/journey_map_staged_duplicate.sdd`

```sdd
SDD-TEXT 0.1

Step J-801 "Choose a route"
  owner=Design
  description="Author three same-endpoint PRECEDES occurrences"
  actor=User
  intent="Choose how to continue"
  success_criteria="Every authored occurrence remains identifiable"
  kind=decision
  PRECEDES J-802 "Continue guided" {advisor_available} channel=guided
  PRECEDES J-802 "Continue alone" {self_service} channel=self_service
  PRECEDES J-802 "Different non-semantic hint" {advisor_available} channel=guided
  REALIZED_BY P-800 "Duplicate proof surface"
END

Step J-802 "Continue"
  owner=Design
  description="Receive all same-endpoint occurrences"
  actor=User
  intent="Continue through the selected route"
  success_criteria="Every route arrives distinctly"
  REALIZED_BY P-800 "Duplicate proof surface"
END

Place P-800 "Duplicate proof surface"
  owner=Design
  description="Out-of-view realization target for duplicate proof"
  surface=web
  route_or_key=/proof/journey-duplicate
  access=auth
END
```

### `tests/fixtures/render/journey_map_staged_compressed.sdd`

```sdd
SDD-TEXT 0.1

Stage G-900 "A"
  owner=Design
  description="Dense source Stage"
  order_index=10
  CONTAINS J-901 "A1"
  CONTAINS J-902 "A2"
  CONTAINS J-903 "A3"
  + Step J-901 "A1"
    owner=Design
    description="Highest fan-out source"
    actor=User
    intent="Fan out across every routing region"
    success_criteria="All outgoing routes remain distinct"
    kind=decision
    PRECEDES J-902 "A2"
    PRECEDES J-903 "A3"
    PRECEDES J-950 "X"
    PRECEDES J-911 "B1"
    PRECEDES J-912 "B2"
    PRECEDES J-913 "B3"
    REALIZED_BY P-900 "Compressed proof surface"
  END
  + Step J-902 "A2"
    owner=Design
    description="Secondary fan-out source"
    actor=User
    intent="Compete for local and root tracks"
    success_criteria="Outgoing routes remain separated"
    kind=decision
    PRECEDES J-903 "A3"
    PRECEDES J-950 "X"
    PRECEDES J-913 "B3"
    REALIZED_BY P-900 "Compressed proof surface"
  END
  + Step J-903 "A3"
    owner=Design
    description="Tertiary fan-out source"
    actor=User
    intent="Join the crowded root targets"
    success_criteria="Both routes remain visible"
    kind=decision
    PRECEDES J-950 "X"
    PRECEDES J-913 "B3"
    REALIZED_BY P-900 "Compressed proof surface"
  END
END

Step J-950 "X"
  owner=Design
  description="Crowded root obstacle and branch point"
  actor=User
  intent="Bridge the two Stages"
  success_criteria="Incoming and outgoing routes remain ordered"
  kind=decision
  PRECEDES J-911 "B1"
  PRECEDES J-912 "B2"
  PRECEDES J-913 "B3"
  REALIZED_BY P-900 "Compressed proof surface"
END

Stage G-910 "B"
  owner=Design
  description="Dense target Stage"
  order_index=20
  CONTAINS J-911 "B1"
  CONTAINS J-912 "B2"
  CONTAINS J-913 "B3"
  + Step J-911 "B1"
    owner=Design
    description="First target and local bypass source"
    actor=User
    intent="Join the final target"
    success_criteria="The local skip remains distinct"
    PRECEDES J-913 "B3"
    REALIZED_BY P-900 "Compressed proof surface"
  END
  + Step J-912 "B2"
    owner=Design
    description="Second target and backward return source"
    actor=User
    intent="Join and return across Stages"
    success_criteria="Forward and return routes remain distinct"
    kind=decision
    PRECEDES J-913 "B3"
    PRECEDES J-902 "A2" kind=loop
    REALIZED_BY P-900 "Compressed proof surface"
  END
  + Step J-913 "B3"
    owner=Design
    description="Highest fan-in target and outer return source"
    actor=User
    intent="Receive crowded routes and return"
    success_criteria="Every incoming route and return remains identifiable"
    PRECEDES J-901 "A1" kind=loop
    REALIZED_BY P-900 "Compressed proof surface"
  END
END

Place P-900 "Compressed proof surface"
  owner=Design
  description="Out-of-view realization target for compressed proof"
  surface=web
  route_or_key=/proof/journey-compressed
  access=auth
END
```

## 2. Edge ownership and archetype contract

Primary edges are fixed by the controlling plan. The remaining edges are fixed here; modifiers never change placement authority.

### Ordering/ownership

| Edge | Owner | Base archetype | Modifier |
| --- | --- | --- | --- |
| `J-503→J-501` | `G-500` | non-adjacent forward same-Stage bypass | first-parent proof |
| `J-501→J-502` | `G-500` | backward same-Stage peripheral return | source-order contradiction |
| `J-591→J-590` | root | backward root outer return | interleaved-root contradiction |

### Topology

| Edge | Owner | Base archetype | Modifier |
| --- | --- | --- | --- |
| `J-790→J-701` | root | root-to-contained direct/bypass | branch fan-out |
| `J-790→J-791` | root | root-to-root direct/bypass | branch fan-out |
| `J-701→J-702` | `G-700` | cycle peripheral track | annotated component |
| `J-702→J-701` | `G-700` | backward cycle return | annotated component |
| `J-711→J-712` | `G-700` | cycle peripheral track | unannotated component |
| `J-712→J-711` | `G-700` | backward cycle return | unannotated component |
| `J-713→J-713` | `G-700` | self-loop outer track | annotated self-loop |
| `J-714→J-713` | `G-700` | backward same-Stage return | branch member |
| `J-714→J-791` | root | contained-to-root bypass | branch member |

### Duplicate

| Occurrence | Owner | Base archetype | Modifier |
| --- | --- | --- | --- |
| 0 `J-801→J-802` | root | adjacent forward root-Step | same-endpoint ordinal 0; semantic key guided; exact ordinal 0 |
| 1 `J-801→J-802` | root | adjacent forward root-Step | same-endpoint ordinal 1; semantic key self-service; exact ordinal 0 |
| 2 `J-801→J-802` | root | adjacent forward root-Step | same-endpoint ordinal 2; semantic key guided; exact ordinal 1 |

### Compressed

| # | Edge | Owner | Base archetype | Modifier |
| --- | --- | --- | --- | --- |
| C01 | `J-901→J-902` | `G-900` | adjacent forward same-Stage direct | branch |
| C02 | `J-901→J-903` | `G-900` | non-adjacent same-Stage bypass | branch |
| C03 | `J-901→J-950` | root | contained-to-root direct/bypass | branch + root fan-in |
| C04 | `J-901→J-911` | root | long cross-Stage outer bypass | branch |
| C05 | `J-901→J-912` | root | long cross-Stage outer bypass | branch |
| C06 | `J-901→J-913` | root | long cross-Stage outer bypass | branch; join pressure retained in measured buckets |
| C07 | `J-902→J-903` | `G-900` | adjacent forward same-Stage direct | branch |
| C08 | `J-902→J-950` | root | contained-to-root direct/bypass | branch; root fan-in pressure |
| C09 | `J-902→J-913` | root | long cross-Stage outer bypass | branch |
| C10 | `J-903→J-950` | root | contained-to-root direct/bypass | branch; root fan-in pressure |
| C11 | `J-903→J-913` | root | long cross-Stage outer bypass | branch |
| C12 | `J-950→J-911` | root | root-to-contained bridge | branch |
| C13 | `J-950→J-912` | root | root-to-contained bypass | branch |
| C14 | `J-950→J-913` | root | root-to-contained bypass | branch; join pressure retained in measured buckets |
| C15 | `J-911→J-913` | `G-910` | non-adjacent same-Stage bypass | join |
| C16 | `J-912→J-913` | `G-910` | adjacent forward same-Stage direct | join |
| C17 | `J-912→J-902` | root | backward cross-Stage outer return | annotated cycle member |
| C18 | `J-913→J-901` | root | backward cross-Stage outer return | annotated cycle member |

The 2026-07-13 Gate 6 complex-SCC amendment makes the route-role column generic and executable. Remove typed visual-return occurrences from a complex SCC's ordinary-forward degree graph, then apply exclusive Alternative B precedence: ordinary source outdegree greater than one owns the branch route role; otherwise ordinary target indegree greater than one owns the join route role. Complete measured node buckets still retain every source and target occurrence for Gate 7 occupancy, so route-role precedence does not erase fan-in/fan-out pressure. This amendment changes only the compressed modifier rows shown above; owners, base morphologies, authored order, fixture bytes, validation expectations, and every non-compressed contract remain unchanged.

## 3. Profile and validation contract

- Primary runs under simple, permissive, and strict. Simple hides badges; permissive and strict show `OP-100` then `OP-200`. All three are reviewed where content differs.
- Ordering/ownership, topology, duplicate, and compressed run under strict only.
- Primary and compressed have no validation diagnostic.
- Ordering/ownership expects exactly `validate.contains_single_parent_recommended` related to `J-503`.
- Topology expects exactly `validate.precedes_cycle_policy` related to `[J-711,J-712]`.
- Duplicate expects exactly one `validate.duplicate_edge_detection` related to `[J-801,J-802]`.
- Every branching Step is explicitly `kind=decision`; unexpected `validate.branching_step_should_be_marked_decision`, required-property, realization, reference, prefix, or Step-kind diagnostics fail the fixture contract.

## 4. Hard assertion and human-rubric ownership

The shared final arrow-marker terminal-leg threshold is exactly `MIN_ARROW_MARKER_LEG = 12px` from `src/renderer/staged/routing.ts`. Every accepted final arrow route must meet 12px; `renderer.routing.marker_leg_minimum_unmet` is allowed only in a directly constructed degraded case and fails a proof fixture.

| Assertion | Stages | Cases |
| --- | --- | --- |
| One semantic edge occurrence, unique stable ID, no route geometry | RendererScene and MeasuredScene; paired pre-routing evidence retains those ledgers while its PositionedScene has `edges=[]` | all cases; duplicate proves multiplicity |
| Exactly one orthogonal route per occurrence | step-2, step-3, final | all cases |
| Exterior endpoint approach | step-2, step-3, final | all cases |
| Non-endpoint Step, endpoint-interior, header, badge, unrelated-Stage clearance | step-3 and final | every applicable edge; ordering included |
| 16px separation for every competing overlapping same-orientation span | step-3 and final | all cases; focused pressure in primary, topology, duplicate, compressed |
| Crowded endpoint order/spacing | step-3 and final | primary branch/join, topology `J-790`/`J-714`, duplicate both sides, compressed crowded nodes |
| Root/child source order | model, scene, pre-routing, final | every case; duplicate covers Step-only root order |
| Boundary gates ordered and outside headers | step-3 and final | primary, ordering root return, topology root transitions, compressed |
| 12px final terminal leg | final | every arrow-ended edge |
| Nominal-to-resolved occupancy change plus bounded whole-structure expansion | step-3 and final | compressed only |

Human ownership at `1680×1050`, 100% zoom, intrinsic SVG: primary owns left-to-right reading, direct tracks, Stage chrome, empty/single Stages, long labels, badges, and baseline whitespace; primary and compressed own branch/join clarity; topology and compressed own peripheral returns; duplicate and compressed own edge identity; primary, ordering, topology, and compressed own consistent ports/boundary gates; primary and compressed own intentional whitespace. Primary and dense/debug cases may scroll horizontally at intrinsic 100%; a fit-to-viewport overview is composition evidence only and cannot accept text readability. Vertical fit and every intrinsic geometry/readability check remain binding. A review item may be `N/A` only when this table assigns it to another case; owned items require PASS. Any hard failure, unexpected renderer warning/error, non-empty violated-invariant field, or nominally identical debug stages fails the gate.

## 5. Exact evidence names

All names are under `tests/goldens/renderer-stages/`; capture occurs only at the owning later gate.

- Primary strict: `journey-map.primary.renderer-scene.json`, `journey-map.primary.measured-scene.json`, `journey-map.primary.pre-routing.positioned-scene.json`, `journey-map.primary.step-2.positioned-scene.json`, `journey-map.primary.step-2.svg`, `journey-map.primary.step-3.positioned-scene.json`, `journey-map.primary.step-3.svg`, `journey-map.primary.positioned-scene.json`, `journey-map.primary.svg`, `journey-map.primary.diagnostics.json`.
- Badge variants: `journey-map.badges.simple.renderer-scene.json`, `journey-map.badges.simple.measured-scene.json`, `journey-map.badges.simple.positioned-scene.json`, `journey-map.badges.simple.svg`, `journey-map.badges.permissive.renderer-scene.json`, `journey-map.badges.permissive.measured-scene.json`, `journey-map.badges.permissive.positioned-scene.json`, `journey-map.badges.permissive.svg`. Strict badge evidence is the primary set.
- Ordering/ownership: `journey-map.ordering-ownership.renderer-scene.json`, `journey-map.ordering-ownership.pre-routing.positioned-scene.json`, `journey-map.ordering-ownership.positioned-scene.json`, `journey-map.ordering-ownership.svg`, `journey-map.ordering-ownership.validation-diagnostics.json`, `journey-map.ordering-ownership.diagnostics.json`.
- Topology: `journey-map.topology.renderer-scene.json`, `journey-map.topology.pre-routing.positioned-scene.json`, `journey-map.topology.step-2.positioned-scene.json`, `journey-map.topology.step-2.svg`, `journey-map.topology.step-3.positioned-scene.json`, `journey-map.topology.step-3.svg`, `journey-map.topology.positioned-scene.json`, `journey-map.topology.svg`, `journey-map.topology.validation-diagnostics.json`, `journey-map.topology.diagnostics.json`.
- Duplicate: `journey-map.duplicate.renderer-scene.json`, `journey-map.duplicate.pre-routing.positioned-scene.json`, `journey-map.duplicate.step-2.positioned-scene.json`, `journey-map.duplicate.step-2.svg`, `journey-map.duplicate.step-3.positioned-scene.json`, `journey-map.duplicate.step-3.svg`, `journey-map.duplicate.positioned-scene.json`, `journey-map.duplicate.svg`, `journey-map.duplicate.validation-diagnostics.json`, `journey-map.duplicate.diagnostics.json`.
- Compressed: `journey-map.compressed.pre-routing.positioned-scene.json`, `journey-map.compressed.step-2.positioned-scene.json`, `journey-map.compressed.step-2.svg`, `journey-map.compressed.step-3.positioned-scene.json`, `journey-map.compressed.step-3.svg`, `journey-map.compressed.positioned-scene.json`, `journey-map.compressed.svg`, `journey-map.compressed.diagnostics.json`.
- Degraded structural: `journey-map.degraded.structural.diagnostics.json`; degraded geometry: `journey-map.degraded.geometry.diagnostics.json`; degraded capacity/fallback: `journey-map.degraded.capacity.diagnostics.json`.

Temporary review captures are `/tmp/journey-map-review/<case>.<profile>.<pre-routing|step-2|step-3|final>.{svg,png}`. PNG uses the shared 192 DPI path without post-scaling and is not stored as a renderer-stage golden.

## 6. Diagnostic trigger matrix

Every code is a full code, deterministically sorted, and includes the listed related IDs/target context.

| Code | Trigger/input | Related IDs / artifact |
| --- | --- | --- |
| `renderer.scene.journey_map_duplicate_edge_id` error | constructed scene with two occurrences assigned one ID | `[edgeId]`; structural |
| `renderer.routing.journey_map_unresolved_endpoint` error | plan references missing Step/port | `[edgeId,nodeId]`; structural |
| `renderer.routing.journey_map_edge_omitted` error | projected/model occurrence absent from routed scene | `[edgeId]`; structural |
| `renderer.routing.journey_map_edge_duplicated` error | one occurrence reconstructed twice | `[edgeId]`; structural |
| `renderer.routing.journey_map_non_orthogonal_route` error | final diagonal segment | `[edgeId]`; geometry |
| `renderer.routing.journey_map_node_intersection` error | route crosses unrelated Step | `[edgeId,stepId]`; geometry |
| `renderer.routing.journey_map_endpoint_intrusion` error | route enters source/target beyond legal terminal approach | `[edgeId,stepId]`; geometry |
| `renderer.routing.journey_map_stage_header_intersection` error | route crosses Stage header band | `[edgeId,stageId]`; geometry |
| `renderer.routing.journey_map_badge_intersection` error | route crosses measured badge block | `[edgeId,stepId,badgeId]`; geometry |
| `renderer.routing.journey_map_unrelated_stage_intersection` error | root-owned route enters unrelated Stage | `[edgeId,stageId]`; geometry |
| `renderer.routing.journey_map_gutter_expansion_exhausted` warn | constructed occupancy exceeds bounded attempts | `[ownerId]`; capacity |
| `renderer.routing.journey_map_unavoidable_crossing` warn | deterministic alternatives retain crossing | `[edgeA,edgeB]`; capacity |
| `renderer.routing.journey_map_track_separation_unmet` warn | overlapping spans cannot retain 16px | `[edgeA,edgeB]`; capacity |
| `renderer.routing.journey_map_port_fallback` warn | preferred semantic port unavailable | `[edgeId,nodeId]`; capacity |
| `renderer.routing.journey_map_boundary_gate_fallback` warn | preferred Stage gate unavailable | `[edgeId,stageId]`; capacity |
| `renderer.routing.journey_map_archetype_fallback` warn | preferred template cannot be constructed | `[edgeId]`; capacity |
| `renderer.routing.marker_leg_minimum_unmet` info | constructed terminal leg remains below 12px | `[edgeId]`; capacity; still fails an accepted proof by the hard contract |
| `renderer.scene.journey_map_disconnected_chain` info | acyclic Step `PRECEDES` graph where every projected Step is incident and exactly two edge-bearing weak components exist; component containing lowest flattened visual Step order is main | non-main component Step IDs in flattened visual order; primary `[J-250,J-260]` |
| `renderer.scene.journey_map_first_parent_selected` info | ordering multiply-contained `J-503` | `[J-503,G-500,G-600]`; ordering diagnostics |
| `renderer.scene.journey_map_step_only` info | duplicate fixture | `[J-801,J-802]`; duplicate diagnostics |
| `renderer.routing.journey_map_peripheral_backward_edge` info | topology/compressed backward edge | `[edgeId]`; case diagnostics |
| `renderer.routing.journey_map_peripheral_cycle` info | topology/compressed cycle component | component edge IDs; case diagnostics |
| `renderer.routing.journey_map_self_loop` info | topology `J-713→J-713` | `[edgeId,J-713]`; topology diagnostics |

Direct negative inputs are unit-only and never accepted visual proofs. Warnings do not waive failure.

For `journey_map_disconnected_chain`, self-loops and multi-node directed cycles make the trigger inapplicable. Isolated Steps make the trigger inapplicable. The diagnostic targets the lowest flattened-order Step in the non-main component and records that component's ordered Step IDs in `details`. This is a generic scene-topology rule: fixture names and literal node IDs are never consulted.

## 7. Gate 1 completeness and stop rule

The primary case is complex but diagnosable because composition concerns are visible while ordering ownership, exceptional topology, duplicates, and contention have isolated fixtures. Every required topology, hard assertion, human rubric item, diagnostic family, stage artifact, profile, and threshold has an owner above.

If compressed semantic contention does not force both resolved-coordinate changes and bounded whole-structure expansion, Gate 7 stops and returns to Gate 1. The literal graph may change only through a recorded Gate 1 amendment and renewed human acceptance. Never tune coordinates, silently add edges, weaken the assertion, or refresh goldens.
