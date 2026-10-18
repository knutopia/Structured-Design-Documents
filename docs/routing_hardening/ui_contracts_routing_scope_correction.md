# UI Contracts routing: scope correction and sizing assessment

2026-10-17. This records the user's instruction to eliminate the second prototype's invented bar treatment from scope, and the subsequent inspection of its experimental sizing. It supersedes conflicting implications in the captured architecture/prototype brief and the prototype's initial verdict. It does not change the bundle or production renderer.

## Scope correction

The prototype's solid rectangular fork/merge bars are excluded from the proposed solution, prototype acceptance evidence, and implementation requirements. Do not introduce a new bar primitive, new bar painter, or a production junction scheme derived from that fixture.

The synthetic `branch` case manually creates bar boxes in `rebuildLayout`, treats them as node obstacles for routing, and paints rectangles directly in the HTML shell. Their vertical spans are not routed connector segments. Its identity-based coverage check does not establish an accepted routed path through the bar. Consequently, it supplies no evidence of preserving the existing UI renderer's fork/merge treatment.

Existing production fork/merge presentation remains a compatibility consideration. That does not authorize its redesign. If consolidating acceptance exposes a real compatibility problem, investigate it against the actual scene builder and measured/positioned scene, rather than introducing the synthetic fixture's representation.

The historical capture at `a53d03f` remains evidence of what the experiment did. Exclude `branch` when counting positive results relevant to the forward scope: six positive mechanism fixtures and four negative controls remain. Historical HTML, JSON, and images are not regenerated to conceal the excluded case.

The active scope remains complete ordinary transitions, independently resolved attachments, backward-to-left self-loops, measured capacity negotiation, and consistent complete-route acceptance. The prototype's bar fixture introduces no additional feature or implementation obligation.

## Sizing assessment

The user's permission for minimum card growth justified by real port demand remains. The prototype has not established its sizing formulas as the production method.

### What the experiment establishes

For its declared fixtures, it computes requests, merges simultaneous resource requirements, updates absolute resource dimensions, rebuilds a simple layout from its baseline, and obtains routes and labels accepted by the shared validators. This is useful evidence for the capacity negotiation mechanism.

### What does not transfer directly

1. **Measurement and painting are bypassed for grown cards.** The model changes node width/height numerically. The HTML shell draws new backgrounds and reuses text extracted from the original node SVG. It does not call production shared-node measurement, width-dependent wrapping, general content reflow, or the production SVG backend for those enlarged cards. Production `measureSharedNode` currently uses the theme's width; its existing reflow helper updates height-related layout only.
2. **Label arrangement is included in purported port demand.** `ordinaryPitch` takes the maximum forward-label height across the supplied layout, adds label margins and another 16px, and uses that pitch for every ordinary endpoint group. In the crowded case it is 62px, producing a 210px card-height requirement for four attachments. The shared marker-derived pitch is 23px; with the same 12px inset, four ports alone fit a 93px side. The larger result is demand from a selected adjacent-label arrangement, not a demonstrated minimum port requirement.
3. **There is a concrete nonlocal dependency.** An allocation-only probe using the actual prototype `allocate` function has four A-to-B edges with 22px-high labels. Adding an unrelated C-to-D edge with a 200px-high label raises A's requested height from 210px to 744px. This demonstrates that the current formula cannot safely be generalized to larger inventories. It is not a production renderer failure or a complete-layout feasibility test.
4. **Loop-label lanes force card width.** The prototype places loop labels in adjacent horizontal lanes and charges those lanes to card width. It grows the loop-owning card from 224px to 285.128px. The shared ordered-pair helper can place both loop pairs on the original 224px side, with the existing support reservation at offset 12: departure/arrival pairs 123.5/100.5 and 77.5/54.5. Thus port capacity alone does not explain that width growth. This probe does not prove the labels and full routes fit without other changes; it identifies the policy responsible for the growth.
5. **Layout resources are specialized.** One gap and upper/lower padding describe the horizontal fixture. They do not establish resource ownership, layout rebuilding, or preservation for arbitrary nested scopes, local contracts, packed sections, and multiple independent transition regions.

The direct probes used the captured default arrow/stroke sizes (10px/2px), shared `readablePortPitch`, `allocatePortOffsets`, `allocateOrderedPortPair`, and the prototype allocation function. They wrote no production state or new golden artifacts.

## Consequence for the implementation specification

Retain capacity negotiation and independently validated geometry as design evidence. Do not select the experimental sizing overlay or its formulas as implementation decisions.

Before implementing card growth, specify and verify a shared measurement interface that accepts actual minimum dimensions and returns consistent content, ports, and bounds. Distinguish card-side port demand from external route/label capacity. Any decision to enlarge a card to accommodate external labels needs its own justification; it must not be presented as an unavoidable port minimum.

Requirements must identify the affected node/side or physical corridor. An unrelated label must not inflate another region's cards through a global pitch. All layout changes must rebuild through the staged measurement/layout path under the same cumulative allowance, and final acceptance must inspect the actual production scene.

The next specification may state the intended capability and these acceptance requirements. The prototype does not close the production sizing design. Do not turn its incidental constants or hand-painted card geometry into requirements.
