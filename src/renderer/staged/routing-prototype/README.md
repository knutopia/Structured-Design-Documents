# THROWAWAY: UI Contracts routing proof

The second experiment is [allocation and bounded rebuilding](ALLOCATION.md); open its [single offline HTML](allocation-prototype.html). The first prototype and its evidence below remain preserved.

Open **[prototype.html](prototype.html)** directly in a browser. It is a single offline HTML file with embedded fonts, captured production SVGs, the pure routing model, and the real shared route validator. There are no network requests or persistent state.

Rebuild from the repository root with `TMPDIR=/tmp pnpm prototype:routing`. The command compiles the unchanged production renderer, reloads the source document and v0.2 bundle, captures production evidence, measures the candidate inputs, validates the eight demonstration states, and regenerates the HTML. The local `esbuild` already supplied with `tsx` embeds the validator at capture time; opening the result requires no build tools or server.

## Question and verdict

Can complete connectors with independently allocated attachments and enough routing space preserve the forward transition, return transition, and self-loop together?

**Yes, for this two-state proof region and its subsets.** The candidate retains all three relationships with zero shared-validator violations and zero label collisions. The return runs above the sequence; the self-loop runs below its own state. The existing east-departure / west-arrival convention is retained. Independent port slots remove accidental sharing. The production renderer remains unchanged.

This supports investigating complete transition preparation. It does **not** establish a general router or approve a production migration. Do not promote this prototype directly.

Captured on branch **`codex/prototype-ui-contracts-routing`**, based on production commit `4ae2de20621dcf0027f31414f59ca9255a54dc77`. No implementation issue was identified, so the branch pointer and verdict are recorded here and in the prototype commit; no issue or external message was created.

## Authority and acceptance

| Role | Source | Invariant |
| --- | --- | --- |
| Semantic authority | [`bundle/v0.2/core/views.yaml`](../../../../bundle/v0.2/core/views.yaml), `ui_contracts_presentation` | Load relationship, role, label, and ownership policy through `loadBundle` → `projectView` / `projectDiagram` → `buildUiContractsPresentationModel`. Do not reconstruct spec conventions in the prototype. |
| Geometry contract | [`docs/routing_hardening/design_decisions.md`](../../../../docs/routing_hardening/design_decisions.md), [`routingCore/lifecycle.ts`](../routingCore/lifecycle.ts) | Validate complete connectors against independently resolved endpoints, node boxes, finite bounds, marker/stub requirements, and the entire route set. No interaction exemptions or inferred permissions. |
| Architectural guardrails | [`AGENTS.md`](../../../../AGENTS.md) | Geometry stays in the renderer. Keep production stages, legacy behavior, bundle authority, and deterministic measurements intact. No ELK. |
| Visual and semantic proof input | [`aeb_help_center_de_astra.sdd`](../../../../aeb_help_center_de_astra.sdd), scope `P-360005333058` | Preserve both states and all three transitions in the candidate; show real rejected production geometry and actual DG-002 output at comparable scale. |

All acceptance invariants above are satisfied by this prototype. The intentionally invalid controls retain and display their violations. No snapshots or production goldens were changed. The handoff was used as context for the requested experiment, not as authorization for a production migration or external action.

## Evidence

| Case | Semantic transitions | Production diagnostics / candidate violations |
| --- | ---: | --- |
| Reduced production, forward + return + self-loop | 3 | 5: four overlaps and one endpoint intrusion |
| Actual DG-002, proof region | 2 | 0; diagram membership excludes the loop |
| Production without self-loop | 2 | 0 |
| Production without return | 2 | 1 endpoint intrusion |
| Production self-loop alone | 1 | 0 |
| Complete candidate, all three | 3 | 0; 3 connectors, 11 physical segments |
| Candidate forward, pair, forward + loop, loop alone | 1–2 | 0 in every case |
| Candidate with 6px side lanes | 3 | 4 terminal clearance violations |
| Candidate reusing attachment slots | 3 | 2 overlaps |
| Candidate moving only a drawn endpoint | 3 | 3 violations, including endpoint mismatch |

`evidence.json` records the source hash, selected bundle, source revision baseline, full positioned production captures, semantic inventories, independently allocated endpoints, candidate points, label rectangles, diagnostics, and coordinator traces. `dg002.svg` is the actual full named-diagram SVG, including its DG-002 metadata. The demo's named-diagram viewport is a crop of that output, not a reconstruction from the reduced probe.

The current production path represents the full three-transition proof as 11 scene edges / 14 physical segments. The candidate represents it as 3 complete connectors / 11 physical segments. Relationship identity is kept distinct from both counts.

## What the experiment does

`model.mjs` is a DOM-free module. `allocate` chooses ports from measured boxes and topology **before** `construct` creates polylines. Full-inventory slots remain fixed while edges are toggled. Labels are measured by the production measurement service using bundled fonts. Their rectangles block every connector; a separate check catches label/node and label/label intersections and canvas overflow.

The candidate uses the shared defaults of 16px separation and 0.5px tolerance, at least 12px terminal clearance, and the stronger `forbid` crossing policy. There are no sharing exemptions. A valid prepared set passes to `runRoutingLifecycle`, and the accepted context is validated again. Invalid controls are shown as diagnostic geometry and never certified. Moving a route endpoint does not modify the required endpoint.

The proposed drawing preserves production node SVGs, fonts, label measurements, edge color, label boxes, and arrow dimensions. Every visible line corresponds to the validated points. Initial screenshots were inspected at a shared 125% scale; labels and arrowheads were legible, with no routing collisions in the accepted mixed case. Browser interaction checks exercised the guided walkthroughs and negative controls; this throwaway work adds no formal test suite.

## Limits and decision trace

- Topology is deliberately limited to the projected two-node ordering, one forward transition, one return, and one loop on the second state. This is not a capacity algorithm for arbitrary degrees, parallel edges, or multiple loops.
- The loop is placed below its own node to avoid reentering the earlier state. The return uses the upper corridor. This obeys endpoint-box and whole-route interaction checks without declaring shared tracks.
- Attachments reserve three topological levels with 16px separation. The measured nodes fit this proof. General port allocation, decorated-header placement policy, and node growth remain production design work.
- Horizontal space includes the measured forward label and terminal room. Vertical space reserves the measured return/loop labels plus 12px label offsets and 40px track-to-node gaps. These are visible prototype layout choices, not new bundle conventions.
- The candidate is valid before coordinator search: one coordinator validation, zero repair candidates, zero automatic expansions. The capacity button explicitly rebuilds the experiment from its baseline. It does **not** prove a working lifecycle expansion callback or search recovery.
- The candidate validates its complete transition region, not interactions with the rest of the full sheet. It does not run a production adapter migration or production label-repair pass.
- The original seven diagnostics in full sheet context are not recaptured as part of this small experiment. The real reduced reproduction has five. Counts are not presented as interchangeable.
- The HTML is a comparison and a logic exercise, not a shipping renderer. No production decision is folded into main until a production implementation is selected and checked against the broader contracts.

The next production step would need a generic complete-transition adapter with explicit capacity ownership, broader mixed-topology cases, and proof that no later repair changes accepted geometry. This experiment supplies evidence for that decision, not that implementation.
