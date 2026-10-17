# THROWAWAY: allocation and bounded rebuilding

Open **[allocation-prototype.html](allocation-prototype.html)** directly in a browser. This is the second experiment, extending the first proof without replacing its captures. All code, fonts, measurements and comparisons are embedded in the one offline file. State is in memory. Rebuild it with `TMPDIR=/tmp pnpm prototype:routing:allocation`.

## Question and verdict

Can complete-transition routing automatically allocate attachments, grow measured card or surrounding layout capacity, and recover to valid routes with readable labels under one cumulative allowance?

**Yes for the declared fixtures; enough to proceed to a bounded implementation specification, not a production migration.** The experiment demonstrates automatic card growth, actual changes to surrounding spacing and enclosure size, upper-side fallback without growth, preserved fork/merge bars, a small real shared-route search recovery, and shared label relocation. Accepted fixtures retain their complete inventories and full text with zero route, label or coverage findings. Exhaustion and unchanged rebuilding remain explicit failures.

The geometry producer is deliberately limited: a horizontal sequence with forward/return/loop templates, plus one declared branch/merge fixture. It is not a topology discovery algorithm or a general allocator for arbitrary mixed sheets. It cannot justify replacing the current UI renderer yet. No experimental code is promoted into production.

The preserved first capture is commit `f774d5bcb4213941e14d168724985b7e72a7cd68` on `codex/prototype-ui-contracts-routing`, based on production `4ae2de20621dcf0027f31414f59ca9255a54dc77`. The second capture is a later commit on that same throwaway branch. No implementation issue was identified or created.

## Authority and acceptance invariants

The [captured proposal and experiment brief](allocation-evidence/experiment-brief.md) is context for this experiment, not authority to implement its proposed production migration. These invariants were selected before implementation:

| Role / source | Non-negotiable invariant | Experimental evidence |
| --- | --- | --- |
| Semantic authority: [v0.2 views bundle](../../../../bundle/v0.2/core/views.yaml), `ui_contracts_presentation` | Preserve loaded original relationships and full measured labels. A new production loop-side convention belongs in the bundle. | Original seed and expected text come unchanged from the first capture's loaded-bundle projection. `POLICY` is explicitly experimental; no bundle contract or production preference is added. Synthetic relationships are labelled as such. |
| Geometry contract: [routing decisions](../../../../docs/routing_hardening/design_decisions.md), opening contract | Complete-context acceptance; independent endpoints; endpoint re-entry, boxes, bounds, separation and actual marker clearance. Matching source/target IDs do not permit sharing. | `allocate` resolves endpoints before `build`. `runRoutingLifecycle` and the final read-only `validateFinalRouteSet` use those requirements. No sharing callbacks or shared-track exceptions exist. |
| Proposal: allocation, expansion and immediate experiment sections | Try south and then a fitting north alternative at the current size. Only then request measured capacity; preserve explicit physical bars and relationship paths. | Original, crowded, expansion, north and branch walkthroughs. Bars are boxes painted once; logical paths identify physical connectors and directed junction traversal. |
| Existing budget precedent: [IA execution record](../../../../docs/ia_place_map_hardening/manual_review_2_execution.md), “One live allowance” | Four effective expansions, 4,096 candidates, 128 repairs per complete run; no reset across stages. Absolute resource requirements merge by maximum; unchanged geometry stops. | One state owns counters and a cause ledger. Both side trials, preparation candidates, shared search and label search consume it. The exhaustion fixture reaches exactly 4,096. A no-op rebuild stops with zero effective expansions. |
| Label contract: [shared label assessment](../connectorLabelLayout.ts) | Full text, owning-route association, bounds, nodes, markers, unrelated connectors and other labels must pass independent assessment. | Real `assessConnectorLabels`, `auditConnectorLabels`, `wrappedLabelPreservesText` and `measureConnectorLabelCapacity`; final labels also become blockers in the read-only route audit. |
| Guardrails: [AGENTS.md](../../../../AGENTS.md) | Isolate experimental sizing/rebuilding; keep production stages, existing captures and legacy behavior; no ELK or golden refresh. | Only throwaway files and their task-runner command change. First prototype files and the two unrelated untracked files are preserved. |
| Visual exemplar: [IA self-loop](../../../../docs/ia_place_map_hardening/manual_review_2_evidence/self-loop.compact.svg) | Explore same-side loops with a legible label; the exemplar is not a general algorithm. | Visual walkthrough of lower and upper U-loops, decorated cards, parallel transitions and explicit junctions. |

All scoped acceptance invariants pass in the accepted fixtures. The negative fixtures intentionally violate acceptance and remain rejected. The output is acceptable as an experimental artifact; a general production routing claim is unproven.

## What actually executes

`allocation-model.mjs` is the DOM-free owner. `createExperiment`, `advance` and `complete` are used by both the browser and capture script. Each guided button performs a real action; free-play uses the same state. Geometry, pending requests, attachment requirements, validator findings and cumulative consumption update after every action. The technical inspector exposes full state and the cause ledger.

Shared production helpers execute unchanged:

- `allocatePortOffsets` for deterministic side-bounded ordinary attachments; `allocateOrderedPortPair` for each atomic loop pair, including fixed support reservations and earlier pairs.
- `readablePortPitch` and `markerRoutingClearance` for the current theme's marker/stroke footprint.
- `measureRoutingCorridorDeficits` and `measureConnectorLabelCapacity` for physical corridor and label-lane evidence.
- `runRoutingLifecycle` with the remaining allowance and its separate expansion callback disabled.
- Shared label assessment/audit and final route validation against the complete physical inventory.

The browser embeds the real shared label module. Its Node-owned theme loading is replaced by the captured production theme. Node-owned font loading is replaced by a strict premeasured-text adapter: an attempt to measure an unprovided text decoration throws. All fixture labels are measured by `UiContractsSceneBuilder.labelMeasure` with the vendored production fonts during capture; the shared label geometry, association and collision algorithms are not rewritten. Text decorations outside this fixture scope are unproven.

Card growth is an experimental minimum-size overlay on natural production measurements. Content retains its measured typography and full text, while card backgrounds, attachments, bar alignment, spacing and bounds are rebuilt. It does not establish a production minimum-size measurement interface or general content reflow. Loop lanes use each actual measured label width, not the width of the longest label for every loop. The minimum is the demand of this experimental adjacent-lane policy, not an optimization proof over every possible layout.

Resources name individual card widths/heights, the between-card gap, and upper/lower padding. Simultaneous requests merge by maximum and later requirements remain absolute. Every layout starts again from the same natural measured inventory and accumulated requirements. One expansion may satisfy several resources. In the crowded fixture both cards grow from 53px to 210px high, and the loop-owning card grows from 224px to 285.128px wide. In the narrow-layout fixture the gap grows from 28px to 222.9px, upper padding from 16px to 112px and lower padding from 12px to 110px; card positions and canvas bounds change. These are owner-computed geometry changes from the starting constraints.

The original return stays one node-to-node connector. Fork and merge are explicit physical bars: seven physical connectors cover five directed logical relationships in the branch fixture. Physical connectors are validated once each; common bars are owned junction geometry, not duplicate overlapping connectors or blanket same-target exemptions.

## Captured results

`allocation-evidence/evidence.json` contains deterministic full results, including failed attempts, prepared and accepted points, independent attachments, measured requirements, search traces and budget ledgers. The generator repeats each complete experiment and requires byte-identical state. `allocation-evidence/walkthrough.json` records browser interaction outcomes; neighboring PNGs are visual evidence, not production goldens.

| Experiment | Result | Cumulative candidates / repair revisions / expansions |
| --- | --- | --- |
| Original forward + return + loop | Accept, all three retained; south side | 1 / 0 / 0 |
| Four parallels + return + two loops + support-port reservation | Accept after automatic measured card growth | 3 / 0 / 1 |
| Narrow gap and shallow enclosure | Accept after both side trials and actual layout expansion | 3 / 0 / 1 |
| Lower corridor insufficient, upper already fits | Accept on north, no growth | 2 / 0 / 0 |
| Fork + merge + complete return | Accept; two bars, seven physical connectors, five logical paths | 1 / 0 / 0 |
| Prepared 4px return terminal | Accept after real shared route search changes points | 4 / 0 / 0 |
| Label initially inside its source card | Accept after shared label relocation | 2 / 0 / 0 |
| Coincident parallel ports, shared search enabled | Reject at cumulative candidate ceiling | 4,096 / 61 / 1 |
| Rebuilding owner returns unchanged geometry | Reject `repeated_state` | 2 / 0 / 0 |
| Drawn endpoint moved by 8px | Reject mismatch, non-orthogonal segment and intrusion | 1 / 0 / 0 |
| Accidental shared attachments, repair bypassed for inspection | Reject six overlaps, preserve all seven connectors | 3 / 0 / 1 |

The route-recovery case performs three shared search candidates and changes the return geometry. It succeeds in atomic corridor recovery before a queued repair revision; its repair-revision count is **zero**, not evidence of a successful queued multi-revision search. The label-recovery case spends one real placement candidate. All other accepted cases are valid prepared route sets after allocation or rebuilding and use zero shared route-search candidates.

A complete prepared side alternative costs one candidate evaluation, including deterministic attachment calculation and its complete route check. The shared coordinator adds its own reported candidates and repairs. Label placement decrements the same remaining candidate allowance. Read-only audits, deterministic capacity arithmetic and allocation arithmetic do not independently consume search candidates; their calls/findings are exposed. Effective geometry changes consume expansions; no-op rebuilding attempts are recorded but do not.

The original production comparison has three semantic transitions, eleven scene edges and five reduced-region diagnostics. Actual DG-002 has two semantic transitions and zero diagnostics because membership explicitly omits the self-loop. The generator reuses the committed original HTML data and records its SHA-256; these are not equivalent inventories or newly improved production captures.

## Visual walkthrough and limits

Local Chromium opened the artifact directly with `file://` in an offline browser context. The walkthrough exercised every case, ordered expansion buttons, original-failure and actual-DG-002 comparisons, the attachment overlay, inspector and a narrow viewport. The browser recorded no page errors or external requests. Visual inspection found full readable labels and separated tracks in the accepted original, grown-card, expanded-layout, north-fallback, branch and repaired-return cases. The branch fixture is intentionally wide and uses horizontal scrolling at natural scale.

Proceed to an implementation specification only with these remaining gates explicit:

- Arbitrary complete-sheet topology, unrelated containment/composition/support connectors, multiple return families and allocation preservation across changes remain unproven.
- The branch fixture is declared geometry, not a production adapter extraction. Junction provenance and complete-path auditing need a typed production contract.
- A real asynchronous UI layout owner, shared minimum sizing/reflow and the proposed v0.2 bundle preference are not implemented. v0.1 compatibility and bundle mutation behavior remain untested.
- Cumulative counters are demonstrated across side trials, one simultaneous expansion, shared routing and label placement. Four sequential effective expansions and repair-ceiling exhaustion are not demonstrated; their limits are enforced, not asserted sufficient for arbitrary inputs.
- The 4,096-candidate failure deliberately has coincident attachment requirements. It demonstrates bounded, honest failure, not incompleteness on a known feasible alternative attachment assignment. Search never revises allocated endpoint requirements.
- No production authority is removed here. The eventual specification must retain the proposal's replacement/deletion gates, one acceptance policy, zero post-acceptance route mutation and a public serialization rejection gate.

No formal prototype test suite, production snapshot/golden refresh, parser/spec change, implementation issue, publication, PR or external message is part of this experiment.
