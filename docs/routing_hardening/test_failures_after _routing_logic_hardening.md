# Test Failures After Routing Logic Hardening

**Failures with Root Causes A and C have been fixed. Root Cause B remains.**

**quen3.8-max**:

Ran terminal command:  cd /home/knut/projects/sdd && TMPDIR=/tmp pnpm test 2>&1 | tee /tmp/sdd_full_test_output.txt | tail -5



31 failures this run (the count varies between runs — I'll note that). Let me extract the complete failure list with error details.

 

Ran terminal command:  cd /home/knut/projects/sdd && grep -E "^ FAIL |^ ❯ .*failed|Test Files|Tests " /tmp/sdd_full_test_output.txt | head -80



Now let me extract the error details for each failure category.

 

Ran terminal command:  cd /home/knut/projects/sdd && grep -B2 -A12 "Unhandled\|Errors  " /tmp/sdd_full_test_output.txt | head -60



Let me extract the error details for the four files that failed at collection/load time, plus representative error messages for the assertion failures.

 

Ran terminal command:  cd /home/knut/projects/sdd && grep -A15 "uiContractsB5Replay.spec.ts \]" /tmp/sdd_full_test_output.txt | head -40



Let me extract all the distinct error messages across the failures to categorize them.

 

Ran terminal command:  cd /home/knut/projects/sdd && grep -E "Error: ENOENT|AssertionError|Error: expect|toMatchSnapshot|Unable to find|expected" /tmp/sdd_full_test_output.txt | sort | uniq -c | sort -rn | head -40



Let me get details on the routing failures and the remaining error categories.

 

Ran terminal command:  cd /home/knut/projects/sdd && grep -B3 -A25 "routingHardeningScenario.spec.ts > Scenario production" /tmp/sdd_full_test_output.txt | head -70



The routing failures reference `VS-006__transitions_to__VS-010` — that's the **new node you just added** to `sdd_for_sdd.sdd`. So those 6 are triggered by the document edit, not pre-existing. Let me gather the remaining error details to build an accurate, categorized handoff.

 

Ran terminal command:  cd /home/knut/projects/sdd && grep -A18 "sharedNodeRenderer.spec.ts > shared node renderer > carries" /tmp/sdd_full_test_output.txt | head -25 && echo "=====CONTAINER=====" && grep -A18 "uiContractsContainer.spec.ts > native B5" /tmp/sdd_full_test_output.txt | head -25



Let me get the remaining error details and verify which fixture files are missing.

 

Ran terminal command:  cd /home/knut/projects/sdd && grep -A12 "stagedSpacingRegression.spec.ts > spacing regression proof cases > trims the sdd_for_sdd Scenario Flow to occupied lane rows (compact)" /tmp/sdd_full_test_output.txt | head -16 && echo "=====FANOUT=====" && grep -A12 "uiContractsFanoutProof.spec.ts > single-source contract fan-out feasibility > C-430, decorators none" /tmp/sdd_full_test_output.txt | head -16 && echo "=====TOPOLOGY=====" && grep -A12 "uiContractsTopology.spec.ts > B5 topology acceptance" /tmp/sdd_full_test_output.txt | head -16



Let me verify the missing fixture files and check the stagedUiContracts snapshot failure details.

 

Ran terminal command:  cd /home/knut/projects/sdd && ls docs/hierarchical_ui_contracts/ 2>&1 | head -20; echo "=====good_node_rendering====="; ls docs/good_node_rendering/ 2>&1 | head -10; echo "=====STAGED UI CONTRACTS====="; grep -A14 "stagedUiContracts.spec.ts > public staged UI contracts B5 renderer > preserves accepted complete-sheet snapshots for place-viewstate-transition" /tmp/sdd_full_test_output.txt | head -18



The workspace tree showed `docs/[Done] hierarchical_ui_contracts/` — the directory was renamed with a `[Done]` prefix. Let me verify this is the cause of the ENOENT failures.

 

Ran terminal command:  cd /home/knut/projects/sdd && ls -d docs/*hierarchical* docs/*good_node* 2>&1; echo "=====CONTENTS====="; ls "docs/[Done] hierarchical_ui_contracts/" 2>&1 | head -20



Confirmed the root cause of the ENOENT failures. Let me verify the specific fixture files exist in the renamed directory.

 

Ran terminal command:  cd /home/knut/projects/sdd && ls "docs/[Done] hierarchical_ui_contracts/" | grep -E "departure_desk|b5_pipeline_evidence|\.sdd$|\.json$" | head -20; echo "=====GIT LOG for rename====="; git --no-pager log --oneline -3 -- "docs/[Done] hierarchical_ui_contracts" 2>&1 | head -5



Confirmed the ENOENT root cause. Let me locate the `good_node_rendering` fixture and confirm which failures stem from the `sdd_for_sdd.sdd` edit.

 

Ran terminal command:  cd /home/knut/projects/sdd && find . -name "unified_node.sdd" -not -path "./node_modules/*" 2>/dev/null | head -5; echo "=====GIT STATUS sdd_for_sdd====="; git status --short docs/sdd_app_planning/sdd_for_sdd.sdd; echo "=====DIFF STAT====="; git --no-pager diff --stat docs/sdd_app_planning/sdd_for_sdd.sdd



The `sdd_for_sdd.sdd` now shows clean in git — let me confirm whether the VS-006 edit was committed, since that determines whether the routing failures are "expected" or a real regression.

 

Ran terminal command:  cd /home/knut/projects/sdd && git --no-pager log --oneline -3 -- docs/sdd_app_planning/sdd_for_sdd.sdd; echo "=====VS-006 in HEAD?====="; git --no-pager show HEAD:docs/sdd_app_planning/sdd_for_sdd.sdd 2>/dev/null | grep -c "VS-006"; echo "=====VS-006 on disk?====="; grep -c "VS-006" docs/sdd_app_planning/sdd_for_sdd.sdd



The VS-006 node is committed (HEAD: "Parse error in sdd-add fixed"). Let me confirm the collection errors for the remaining two files to complete the picture.

 

Ran terminal command:  cd /home/knut/projects/sdd && grep -A8 "FAIL  tests/uiContractsComplete.spec.ts \[" /tmp/sdd_full_test_output.txt | head -10; echo "====="; grep -A8 "FAIL  tests/uiContractsPresentationModel.spec.ts \[" /tmp/sdd_full_test_output.txt | head -10



I have the complete inventory. Let me do one final check to determine whether the `stagedUiContracts` and `stagedOutcomeOpportunityMap` failures are pre-existing snapshot drift or triggered by the recent `sdd_for_sdd.sdd` edit, so the handoff is accurate.

 

Ran terminal command:  cd /home/knut/projects/sdd && echo "=====stagedUiContracts fixture source====="; grep -nE "readFile|fixtures|\.sdd|departure|sdd_for_sdd" tests/stagedUiContracts.spec.ts | head -10; echo "=====stagedOutcomeOpportunityMap fixture source====="; grep -nE "readFile|fixtures|\.sdd|sdd_for_sdd" tests/stagedOutcomeOpportunityMap.spec.ts | head -10; echo "=====stagedSpacingRegression fixture source====="; grep -nE "readFile|fixtures|\.sdd|sdd_for_sdd" tests/stagedSpacingRegression.spec.ts | head -10



I now have a complete, verified inventory. Here is the full handoff list.

---

# SDD Test Failures — Handoff List

**Run:** `TMPDIR=/tmp pnpm test` (full suite, 2026-09-14)
**Result:** `Test Files 12 failed | 113 passed (125)` · `Tests 31 failed | 1281 passed | 27 skipped (1339)`
**Note on count:** The failed-test count fluctuates between runs (I observed 26, 27, and 31). The variance is `stagedOutcomeOpportunityMap` (a 15s timeout — flaky under load) and collection-error files whose tests don't always register. The 31 below is the most complete capture.

**Important:** None of these are caused by the `sdd add` event/effect quoting fix. They fall into three independent root causes (A, B, C below).

---

## Root Cause A — Renamed fixture directories (ENOENT) — 17 tests + 4 collection failures

The directories `docs/hierarchical_ui_contracts/` and `docs/good_node_rendering/` were renamed (commit `b927892` "Docs Done clean-up") to `docs/[Done] hierarchical_ui_contracts/` and `docs/Done/[Done] good_node_rendering/`. The referenced fixture files **still exist** at the new paths (`departure_desk.sdd`, `b5_pipeline_evidence.json`, `unified_node.sdd`), but the tests still read the old paths.

**Fix direction:** Update the hardcoded paths in these specs (or restore/symlink the directories). Verify against `AGENTS.md` "Acceptance before snapshots" — these are path fixes, not snapshot normalization.

| Test file | Failing tests | Missing path read |
|---|---|---|
| `uiContractsB5Replay.spec.ts` | **collection error** (whole file, `:9`) | `docs/hierarchical_ui_contracts/b5_pipeline_evidence.json` |
| `uiContractsB5Scopes.spec.ts` | **collection error** (whole file, `:15`) | `docs/hierarchical_ui_contracts/departure_desk.sdd` |
| `uiContractsComplete.spec.ts` | **collection error** (whole file, `:15`) | `docs/hierarchical_ui_contracts/departure_desk.sdd` |
| `uiContractsPresentationModel.spec.ts` | **collection error** (whole file, `:13`) | `docs/hierarchical_ui_contracts/departure_desk.sdd` |
| `uiContractsFanoutProof.spec.ts` | 8 tests (`:19`): `C-430/C-420/C-450/long-binding` × `decorators none`, `decorators type,id` | `docs/hierarchical_ui_contracts/departure_desk.sdd` |
| `uiContractsTopology.spec.ts` | 1 test (`:91`): "keeps local composition and contracts fixed when sequences grow horizontally" | `docs/hierarchical_ui_contracts/departure_desk.sdd` |
| `uiContractsContainer.spec.ts` | 1 test (`:43`): "adds native titles to all twelve B5 inputs without moving nodes, connectors, or labels" | `docs/hierarchical_ui_contracts/b5_pipeline_evidence.json` |
| `sharedNodeRenderer.spec.ts` | 1 test (`:313`): "carries the CLI decorator selection through the staged preview request" | `docs/good_node_rendering/unified_node.sdd` |

---

## Root Cause B — Triggered by the committed `VS-006` edit to `sdd_for_sdd.sdd` — 8 tests

Commit `cbdf367` ("Parse error in sdd-add fixed") added `ViewState VS-006 "Diagram Browsing, Single Node Selected"` with `TRANSITIONS_TO VS-010 ... ["Select: Add Relationship"]` to `sdd_for_sdd.sdd`. Two suites consume that document directly and now fail because the new node changed the scenario-flow layout/routing.

**Fix direction:** These are real layout/routing consequences of the new node — decide whether to (a) re-baseline the spacing goldens after confirming the render is correct, or (b) treat the routing intrusion as a genuine renderer bug to fix. Per AGENTS.md, do **not** refresh goldens to hide a routing regression.

| Test file | Failing tests | Error |
|---|---|---|
| `routingHardeningScenario.spec.ts` | 6 tests: `docs/sdd_app_planning/sdd_for_sdd.sdd / simple / {compact,detailed} / {type,id,type,id}` | `expected [ {phase:'routing',…}, …(2) ] to deeply equal []` — connector `VS-006__transitions_to__VS-010` segment 4 intersects non-endpoint box `VS-010` (`renderer.routing.scenario_flow_endpoint_intrusion`, `..._node_intersection`, `..._track_separation`) |
| `stagedSpacingRegression.spec.ts` | 2 tests (`:74`): "trims the sdd_for_sdd Scenario Flow to occupied lane rows (compact)" and "(detailed)" | `expected {…} to match object { width: 1508, height: 880 }` — received `width: 1514, height: 1284` |

---

## Root Cause C — Pre-existing renderer snapshot drift / timeout — 12 tests

These consume `bundle/v0.1/examples/*` and `tests/fixtures/render/*` (NOT `sdd_for_sdd.sdd`), so they are unrelated to the document edit. They are renderer-output drift against stored goldens, plus one timeout.

**Fix direction:** Investigate whether the staged renderer output legitimately changed; re-baseline goldens only after confirming the rendered output is correct (AGENTS.md: "Snapshot refresh is evidence capture, not a way to normalize failure").

| Test file | Failing tests | Error |
|---|---|---|
| `stagedUiContracts.spec.ts` | 11 tests: "preserves accepted complete-sheet snapshots for {place-viewstate-transition, ui-state-fallback, dense-sparse}" + "public preview {compact,detailed} / {none,type,id,type,id}" | `AssertionError: expected '{"viewId":"ui_contracts",…' to be '{…' // Object.is equality` (renderer-stage JSON golden mismatch) |
| `stagedOutcomeOpportunityMap.spec.ts` | 1 test: "matches renderer-stage snapshots for canonical proof cases and routing debug stages" | `Error: Test timed out in 15000ms` (flaky — passes on some runs) |

---

## Quick reference — all 12 failing files

```
tests/uiContractsB5Replay.spec.ts            (collection: ENOENT b5_pipeline_evidence.json)   [A]
tests/uiContractsB5Scopes.spec.ts            (collection: ENOENT departure_desk.sdd)          [A]
tests/uiContractsComplete.spec.ts            (collection: ENOENT departure_desk.sdd)          [A]
tests/uiContractsPresentationModel.spec.ts   (collection: ENOENT departure_desk.sdd)          [A]
tests/uiContractsFanoutProof.spec.ts         (8 tests: ENOENT departure_desk.sdd)             [A]
tests/uiContractsTopology.spec.ts            (1 test:  ENOENT departure_desk.sdd)             [A]
tests/uiContractsContainer.spec.ts           (1 test:  ENOENT b5_pipeline_evidence.json)      [A]
tests/sharedNodeRenderer.spec.ts             (1 test:  ENOENT unified_node.sdd)               [A]
tests/routingHardeningScenario.spec.ts       (6 tests: VS-006 routing intrusion)              [B]
tests/stagedSpacingRegression.spec.ts        (2 tests: VS-006 changed dimensions)             [B]
tests/stagedUiContracts.spec.ts              (11 tests: renderer golden drift)                [C]
tests/stagedOutcomeOpportunityMap.spec.ts    (1 test:  15s timeout, flaky)                    [C]
```

Full raw output is saved at `sdd_full_test_output.txt` if the other thread wants the complete diffs.

**Suggested triage order:** A (mechanical path fixes, clears 17 tests + 4 files) → B (decide re-baseline vs. routing bug) → C (renderer drift investigation).