status: blocked
phase: author-dry-run

The helper author dry-run returned `assessment.should_stop: true` and `assessment.can_commit: false`, so the SDD content was not committed and no validation, projection, or render artifacts were generated.

Exact helper assessment:

```json
{
  "outcome": "blocked",
  "layer": "candidate_diagnostics",
  "can_commit": false,
  "can_render": false,
  "should_stop": true,
  "next_action": "Fix the candidate diagnostics before commit or render.",
  "summary": "The applied candidate has blocking diagnostics."
}
```

Blocking diagnostic:

```json
{
  "stage": "parse",
  "code": "parse.invalid_edge_line",
  "severity": "error",
  "message": "Invalid edge_line syntax",
  "file": "experiments/grafsys-com-reasoning-effort/shared-evidence-run/medium/grafsys.sdd",
  "span": {
    "line": 21,
    "column": 1,
    "endLine": 21,
    "endColumn": 87,
    "startOffset": 709,
    "endOffset": 795
  }
}
```

Likely source in the authored request: the `TRANSITIONS_TO` self-transition on `VS-001` includes an `effect` value with spaces (`same-site home link targets https://grafsys.com/`), and the generated candidate edge line did not parse under the bundle syntax.
