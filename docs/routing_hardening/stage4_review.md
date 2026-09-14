# Independent Stage 3/4 review

2026-09-13. Reviewed the working-tree lifecycle, Outcome integration, marker helper, assignment changes and `tests/routingHardening*.ts`. This records the implementation **before the orchestrator's follow-up corrections** to crossing policy and Outcome expansion ownership. No production code was edited by this reviewer.

**Disposition: keep Stage 3/4 acceptance open until the three findings below are resolved.** The captured Outcome repair is convincing evidence for the narrow turn/span mechanism; it does not remove the remaining contract gaps.

## Actionable acceptance findings

### 1. Expansion can remove a declared hard run constraint and return success

`routingCore/lifecycle.ts`, expansion-context checks around lines 235–250, preserve connector membership, endpoint-node identities and minimum legs, but do not preserve/remap `runConstraints`. Consequently the final result can violate a previously declared hard resource lock without reporting it (H2/H4/H5).

Concrete probe: one H–V–H route is `[0,40] → [120,40] → [120,100] → [200,100]`; its internal vertical run is resource-locked at X=120. Initial canvas `maxX=150` requires expansion. The callback grows `maxX` to 200, deletes `runConstraints`, and supplies the same route with turn X=80. The lifecycle reports `resolved`, one expansion, zero violations. Revalidation against the original lock rejects `vertical-internal-0` with `empty_coordinate_range`.

Reproduction (imports current TypeScript directly, not potentially stale `dist`):

```bash
TMPDIR=/tmp node --import tsx /tmp/sdd-routing-hardening/review-stage4-probes.ts
```

Saved output: `/tmp/sdd-routing-hardening/review-stage4-probes.json`. Direct `pnpm exec tsx` hit this sandbox's IPC `EPERM`; `node --import tsx` ran successfully.

Required correction: expansion must retain hard ownership and explicitly remap geometry-dependent locks/resources through its layout revision. Comparing every old/new coordinate for equality would incorrectly prohibit legitimate layout translation; preserving a constraint's identity/reason or supplying an explicit remapping is the relevant contract. Add the negative dropped-lock case plus a positive valid translated-resource case. The same check should protect declared sides and scoped sharing from silent policy changes; the demonstrated blocker is the lost run lock.

### 2. Outcome does not yet send final-validation failures to its expansion owner

At the reviewed `outcomeOpportunityMapRouting.ts` final boundary, `runRoutingLifecycle(finalContext)` has no `expand` callback. Earlier preparation expansion cannot respond to geometry failures first discovered by complete final acceptance. This leaves the production lifecycle incomplete even though the mandatory exact fixture correctly succeeds without expansion (H6/H10; hardening plan §5.5 and Stage 3/4 tasks).

Required correction: connect final resolution to the existing stable-baseline layout owner and share its existing four-application ceiling with preparation. Add a production-path case that requires final-resolution expansion and verifies absolute accumulated requirements, plus a rejection case when the common ceiling is exhausted. Do not add another independent four-pass loop. The orchestrator has acknowledged this item and is implementing the correction.

### 3. Outcome selects repaired candidates with crossings allowed at zero cost

The reviewed final context specifies `crossingTreatment: "allow"`. The earlier routing unification plan's Common Acceptance Policy explicitly says Outcome/Service/Scenario crossings remain a scored cost (line 238), and hardening §5.5 says `penalize` must actually influence selection. The core has a crossing-cost implementation and a synthetic test, but the production adapter bypasses that cost (H4/H7/H10).

Required correction: retain the intended `penalize` policy in the production path, then rerun the exact/matrix proof and unchanged-geometry checks. The legacy diagnostic-only `allow` override does not establish the desired final selection policy. The orchestrator has acknowledged this item and is implementing the correction.

## Narrow additional contract/evidence gaps

- `FinalRoutingConnector` has no `markedCrossings` input, and final validation does not forward marks to `RoutingValidationEdge`. Thus the accepted design's `require_mark` treatment cannot accept a legitimately marked crossing. Add/remap this data before claiming that complete policy vocabulary is implemented; it is not needed by Outcome's current scored-crossing proof. No Journey migration is requested.
- Accepted-route geometry is cloned/frozen and failure has no accepted route map. Ordinary turn candidates preserve topology when run constraints/sharing exist; a normalization changing topology is discarded. This is conservative, not a demonstrated false success. The initial assignment candidate normalizes through another reconstruction path; add a case combining normalization with run ownership/sharing before claiming generic topology remapping. The current zero-width test does not exercise such a remapping.
- Production final endpoint expectations now come from `resolveFinalPlanEndpoints` and the measured node/offset geometry, independently of candidate route points. The post-label route lookup explicitly maps `plan.id → plan.edgeId → emitted route`; the reviewed mapping is correct. Add or retain a fixture where the IDs differ so later refactoring cannot silently collapse that distinction. Missing emitted edges currently produce an exception at the non-null assertion, rather than a routing diagnostic; no current fixture demonstrates missing output.
- The production rejection test injects immutable turn constraints at the real final boundary, invokes the actual coordinator, and checks `renderSourcePreview` publishes no artifact. This is behavioral renderer/preview rejection evidence, not a mock failed status. It does not exercise the missing production expansion owner, nor replace the exact CLI smoke evidence.
- Candidate/revision budgets are finite and remain global across expansion. The initial assignment solve additionally has finite per-component search bounds; those counts are not present in `FinalRoutingTrace`. Record that distinction so candidate count is not presented as total search work. No unbounded loop was found in the reviewed path.
- Source inspection supports treating target/obstacle compaction locks as preparation ownership rather than universal immutable coordinates: their assigned values preserve local packing/crossing preferences. Replacing their template envelope with root-owned free space can be valid, provided real node/endpoint/resource prohibitions remain represented. Document that root is the actual final resource and inspect dense/parking proofs; this review found no concrete missing Outcome hard reservation to justify demanding a speculative corridor framework.

## Geometry, visual and invariant assessment

Inspected `/tmp/sdd-routing-hardening/outcome-production/exact.png`: repaired Outcome terminal sections are visibly separated, arrowheads remain readable, and the multi-input fans follow the same general composition. This is a visual check of the captured proof, not acceptance of the full matrix. The clipped rightmost heading is reported by the orchestrator as identical baseline decoration debt; no new clipping regression is claimed here.

H1/H7 architectural layering remains intact in the reviewed changes: no parser/compiler/projection edits or semantic identifiers were added to the generic candidate mechanism. H2/H3/H5 have substantial executable evidence for the fixed-layout captured proof; finding 1 prevents an unconditional expanded-context success claim. H4 retains independent endpoints and both-end marker requirements, but crossing policy and marked-crossing inputs need the corrections above. H6 has bounded core attempts but still needs production expansion ownership. H8 is supported by the unchanged valid-input path and the orchestrator's unchanged canonical Outcome snapshots; wider compatibility remains later evidence. H9 has this limited exact-image review and no reviewer-requested golden refresh. H10 has real Outcome repair/rejection wiring; full Outcome lifecycle adoption remains open, and Service/Scenario are explicitly unreviewed downstream stages.

Required next evidence: executable regressions for finding 1; corrected Outcome final expansion/crossing production tests; rerun the current exact/settings matrix and designated Outcome proofs; update the status ledger with exact commands/results. No broader routing redesign is requested.
