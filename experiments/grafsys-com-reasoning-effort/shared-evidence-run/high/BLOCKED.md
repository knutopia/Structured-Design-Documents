status: blocked

Reason: helper author dry-run returned `assessment.should_stop: true`, so the requested stop condition applies before commit, validation, projection, or render.

Helper assessment:

- outcome: `blocked`
- layer: `candidate_diagnostics`
- can_commit: `false`
- can_render: `false`
- should_stop: `true`
- next_action: `Fix the candidate diagnostics before commit or render.`
- summary: `The applied candidate has blocking diagnostics.`

Representative blocking diagnostics:

- `parse.invalid_node_header` at line 2: `Invalid top_node_header syntax`
- `parse.expected_top_level_block` starting at line 3: `Expected a top-level node block`
- `parse.minimum_top_level_blocks`: `Expected at least 1 top-level node block`

No `.sdd` authoring commit was made after the dry-run. The persisted `grafsys.sdd` remains the helper-created empty bootstrap.
