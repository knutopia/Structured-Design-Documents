# Options for Adding Details to Diagrams

6-26-26

**KG:**
The outcome-opportunity map diagrams omit most node properties and some edges. This creates clean visuals, but important information is not communicated by the diagrams.
(This general approach is present in the other staged renderers too.)

For example: 
In [outcome_to_ia_trace.outcome_opportunity_map.svg](examples/rendered/v0.1/outcome_opportunity_map_diagram_type/outcome_to_ia_trace_example/permissive_profile/outcome_to_ia_trace.outcome_opportunity_map.svg) (from [outcome_to_ia_trace.sdd](bundle/v0.1/examples/outcome_to_ia_trace.sdd) ) the node I-001 shows ONLY the node title and the IMPLEMENTED_BY edge.

While it's sometimes good to have a diagram that is this clean, at other times it is desirable to also show properties like "Description" and "Non-Goals", and the IMPLEMTED_BY edge.

Please propose 3 possible approaches that could extend our rendering pipelines to allow for configurable level of detail without overly complicating the tool calls with many parameters. Do not write any code.

**GPT-5.5:**

Three viable approaches:

**1. Extend Existing Profiles Into Detail Tiers**
Use the existing `simple` / `permissive` / `strict` profile path as the single control. The bundle already has `renderer_defaults.profile_display`, and render models already read booleans from it.

Example mapping:
- `simple`: titles only, primary edges only.
- `permissive`: titles, key annotations, selected secondary edges.
- `strict`: titles, important properties like `Description`, `Non-Goals`, plus all in-scope edges.

This is the least disruptive tool-call story: users already pass a profile. Main risk: profiles currently also imply validation posture, so “strict validation but compact rendering” becomes awkward.

**2. Add Named Render Presets Per View**
Introduce one new optional selector, such as `render_preset: compact | summary | detailed`, defined in bundle view renderer defaults. Validation profile stays separate.

Each preset would define:
- property groups to show per node type,
- edge channels to render,
- max secondary lines before truncation,
- whether omitted information is summarized.

This is the cleanest architecture if we expect many diagram detail modes. Tool calls stay simple because the user chooses one preset, not many flags. Main cost: a new public render option and more golden coverage.

**3. Keep Diagrams Clean, Add Progressive Detail Artifacts**
Preserve the current diagram as the primary visual, but add optional detail surfaces generated from the same render model: side panels, node fact sheets, SVG tooltips, or companion markdown/HTML sections.

Example presets:
- `diagram`: clean current visual.
- `diagram_with_details`: clean graph plus per-node details below/alongside.
- `audit`: expanded node facts and omitted-edge summary.

This avoids cluttering dense diagrams while still communicating important omitted properties and relationships. It is especially attractive for LLM/tool workflows because the extra detail can be machine-readable. Main downside: it does not solve “everything visible inside the SVG node” unless paired with a detailed preset.

My recommendation: use **Approach 2** as the core model, with **Approach 3** as an output option later. It separates validation strictness from visual density and keeps tool calls to one meaningful extra choice.