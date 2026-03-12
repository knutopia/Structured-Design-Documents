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
