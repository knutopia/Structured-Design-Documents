## SDD Skill Observation: `shop_sched_exploration` Rerun

### Goal

Execute the same prompt after the semantic-guidance update and observe whether the first helper-authored request uses explicit bundle-defined semantics.

### Persisted Artifacts

- `01_capabilities.json`: helper capability manifest used for discovery
- `02_contract_create.json`: deep contract for `create`
- `03_contract_author.json`: deep contract for `author`
- `04_contract_validate_bundle.json`: bundle-resolved validation profile discovery
- `05_contract_project_bundle.json`: bundle-resolved view discovery
- `06_vocab_excerpt.txt`: bundle vocabulary excerpt used to confirm `Area`, `Place`, `CONTAINS`, and `NAVIGATES_TO`
- `07_views_ia_place_map_excerpt.txt`: IA view excerpt showing hierarchy and edge scope
- `08_contracts_relationships_excerpt.txt`: endpoint contract excerpt for `CONTAINS`
- `09_authoring_spec_nesting_excerpt.txt`: normative nesting-versus-semantics excerpt
- `10_create_result.json`: create result for `shop_sched_exploration.sdd`
- `11_author_request_dry_run.json`: first dry-run request payload
- `12_author_result_dry_run.json`: first dry-run result
- `13_author_request_commit.json`: committed author request payload
- `14_author_result_commit.json`: committed author result
- `15_validate_simple.json`: persisted-state validation result
- `16_project_ia_place_map.json`: persisted-state IA projection result
- `17_sdd_show_stdout.txt`: `sdd show` output
- `18_document_snapshot.txt`: committed SDD text snapshot
- `/home/knut/projects/sdd/shop_sched_exploration.sdd`: committed SDD document
- `/home/knut/projects/sdd/shop_sched_exploration.ia_place_map.simple.svg`: saved IA diagram

### Behavioral Observation

This rerun used explicit semantic relationships on the first `author` dry run.

The first authored request already contained:

- explicit `CONTAINS` edges from the `Area` to the scheduling places
- explicit `NAVIGATES_TO` edges between the places
- top-level `Area` and `Place` nodes rather than relying on nested `children` to imply hierarchy

The first dry run validated cleanly and its inline `ia_place_map` projection reflected the intended hierarchy immediately. No semantic correction pass was needed.

### Net Assessment

This run shows the updated skill guidance materially changed behavior:

- helper discovery still supplied command and contract shape
- bundle/spec authority was then used to resolve the semantic relationship before composing the request
- the first request took advantage of the enhanced semantic guidance rather than discovering the missing hierarchy after a structurally valid but semantically incomplete draft
