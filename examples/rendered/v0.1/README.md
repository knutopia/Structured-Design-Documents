# Rendered Example Corpus

This directory is generated from the canonical bundle examples and committed as a reviewer-friendly reference corpus.

Regenerate it with:

```bash
TMPDIR=/tmp pnpm run generate:rendered-examples
```

Source manifest: `bundle/v0.1/manifest.yaml`

Curated view/example pairs:

- `outcome_opportunity_map_diagram_type/metric_event_instrumentation_example`
- `outcome_opportunity_map_diagram_type/outcome_to_ia_trace_example`
- `journey_map_diagram_type/outcome_to_ia_trace_example`
- `ia_place_map_diagram_type/outcome_to_ia_trace_example`
- `ia_place_map_diagram_type/place_viewstate_transition_example`
- `ui_contracts_diagram_type/place_viewstate_transition_example`
- `scenario_flow_diagram_type/scenario_branching_example`
- `journey_map_diagram_type/service_blueprint_slice_example`
- `service_blueprint_diagram_type/service_blueprint_slice_example`
- `ui_contracts_diagram_type/ui_state_fallback_example`

Profiles rendered in each pair directory: `simple_profile`, `permissive_profile`, `recommended_profile`.

Each pair directory contains the source `.sdd` at the pair root plus suffixed per-profile subfolders with `.dot`, `.mmd`, `.svg`, and `.png` render outputs.
Unsuffixed `.svg` and `.png` files are the default preview backend for that view/profile when that backend emits artifacts. When a view keeps parallel preview backends, preserved non-default preview artifacts are committed as backend-suffixed siblings.
A fail-closed default staged backend may intentionally omit unsuffixed preview files while keeping explicit backend-suffixed legacy preview artifacts committed.
`simple_profile` may omit optional overlays for readability; `permissive_profile` and `recommended_profile` keep the fuller render detail.

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
