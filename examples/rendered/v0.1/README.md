# Rendered Example Corpus

This directory is generated from the canonical bundle examples and committed as a reviewer-friendly reference corpus.
Folders suffixed with `[preview_only]` are committed for inspection/reference during renderer migration and are not yet ready as polished example output.

Regenerate it with:

```bash
TMPDIR=/tmp pnpm run generate:rendered-examples
```

Source manifest: `bundle/v0.1/manifest.yaml`

Curated view/example pairs:

- `outcome_opportunity_map_diagram_type [preview_only]/metric_event_instrumentation_example`
- `outcome_opportunity_map_diagram_type [preview_only]/outcome_to_ia_trace_example`
- `journey_map_diagram_type [preview_only]/outcome_to_ia_trace_example`
- `ia_place_map_diagram_type/outcome_to_ia_trace_example`
- `ia_place_map_diagram_type/place_viewstate_transition_example`
- `ui_contracts_diagram_type/place_viewstate_transition_example`
- `scenario_flow_diagram_type [preview_only]/scenario_branching_example`
- `journey_map_diagram_type [preview_only]/service_blueprint_slice_example`
- `service_blueprint_diagram_type/service_blueprint_slice_example`
- `ui_contracts_diagram_type/ui_state_fallback_example`

Profiles rendered in each pair directory: `simple_profile`, `permissive_profile`, `strict_profile`.

Each pair directory contains the source `.sdd` at the pair root plus suffixed per-profile subfolders with internal `.dot` and `.mmd` text artifacts alongside `.svg` and `.png` preview outputs.
Unsuffixed `.svg` and `.png` files are the default preview backend for that view/profile when that backend emits artifacts. When a view keeps parallel preview backends, preserved non-default preview artifacts are committed as backend-suffixed siblings.
`simple_profile` may omit optional overlays for readability; `permissive_profile` and `strict_profile` keep the fuller render detail.

`ia_place_map` visual review checklist:

- top-level items read left-to-right with clean vertical alignment
- no headers, labels, or routed edges sit visually above the top-level nodes
- mixed top-level `Place` and `Area` ordering follows source order
- same-scope follower places align at one indent level under the earliest preceding hub that navigates to them
- single-child contained places stay directly below the owner; branched child or follower scopes reserve a left connector trunk
- `simple_profile` suppresses route/access/entry-point overlays while preserving allowed `primary_nav` annotations
- only forward local structure connectors are drawn, using direct-vertical or shared-trunk routes

`ui_contracts` visual review checklist:

- top-level Place containers remain vertically balanced even when content density varies sharply
- synthetic `ViewState Graph` and fallback `State graph` regions read horizontally inside their owning scope
- contract edges that emerge from containers stay readable without collapsing sibling grid or stack placement
- default unsuffixed `.svg` and `.png` artifacts come from the staged renderer, while legacy Graphviz siblings remain available when committed

`service_blueprint` visual review checklist:

- staged unsuffixed `.svg` and `.png` artifacts come from the fixed-grid staged renderer with service_blueprint-specific routed connectors
- additional `.pre_routing.svg` and `.pre_routing.png` siblings capture the fixed grid before any edge routing runs
- additional `.routing_step_2_edges.svg` and `.routing_step_2_edges.png` siblings show connectors immediately after edge-side selection, before obstacle swerves or spacing refinement
- additional `.routing_step_3_gutters.svg` and `.routing_step_3_gutters.png` siblings show obstacle-aware provisional connector routes and gutter occupancy before final spacing refinement
- customer, frontstage, backstage, support, system, and policy lanes remain legible in semantic top-to-bottom order
- customer chronology reads left-to-right, `DataEntity` and `Policy` nodes remain visually secondary, band-aligned support nodes in the `system` and `policy` rows, and connector labels remain intentionally absent until a later routing step
- legacy Graphviz preview siblings remain committed for side-by-side comparison
