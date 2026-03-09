# To Do Notes (short term 3-9-26)

1. [Done] CRLF Normalization

2. [Done] Smoke-test the CLI manually against one example:
pnpm sdd compile bundle/v0.1/examples/outcome_to_ia_trace.sdd
pnpm sdd validate bundle/v0.1/examples/outcome_to_ia_trace.sdd
pnpm sdd render bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map --format mermaid

3. Pick one expansion track and keep it narrow:
A Improve developer usability first: add command-line wrappers for producing .dot / .mmd and optionally PNGs.
B Expand language coverage first: implement one more view end-to-end, probably scenario_flow or journey_map, since both look well-specified in bundle/v0.1/core/views.yaml.