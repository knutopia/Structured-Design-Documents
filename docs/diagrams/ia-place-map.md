# IA Place Map

Containment owns the hierarchy and source ordering. Navigation is a separate
occurrence inventory: a selected return, cross-Area connection, or parallel
navigation never creates another Place or changes containment.

## Bundle authority and preparation

`bundle/v0.2/core/views.yaml` opts IA into exact projection references,
complete navigation occurrence coverage, event/guard presentation, singleton
unannotated containment/navigation fusion, and optional `routing_scope` ownership.
The scope policy selects scene containers from loaded node-type selectors; removing
it restores root-only routing bounds without changing projection.
`core/contracts.yaml` governs supported
annotations and identifies Event references for name resolution. The real bundle
loader validates those policies before use. Capability absence retains the legacy
behavior, including the v0.1 baseline; there is no bundle-version routing branch.

`projectView` emits exact `source_edge_id` references for enabled combined and
named IA selections. Public preparation reconstructs the source occurrence index
from the supplied graph and bundle and rejects missing, stale, substituted, or
incomplete references. Projection topology is unchanged.

`buildIaPlaceMapRenderModel` prepares labels through the shared relationship
formatter. Event names are resolved without projecting Events; conflicting names
include IDs, and unresolved names retain the authored reference. Bundle templates
and detail switches control presentation. DOT, Mermaid, and staged outputs consume
the same label payload, with their own escaping and layout.

## Staged pipeline

```mermaid
flowchart TD
    projection[Projection] --> scene[RendererScene: hierarchy and complete occurrence inventory]
    scene --> measure[MeasuredScene: shared text and node measurement]
    measure --> ports[Centre ordinary ports with structural reservations]
    ports --> position[PositionedScene: shared stack layout and route seeds]
    position --> route[Compare complete route alternatives with shared quality selection]
    route --> labels[Shared adjacent label assessment and independent audit]
    labels --> demands[Measure owned gap and padding deficits]
    demands --> reflow[Rebuild from measured baseline plus absolute demands]
    reflow --> position
    labels --> final[Audit exact coverage, routes, text, ports and painted markers]
    final --> svg[Accepted SVG]
    svg --> png[SVG-derived PNG]
```

`runIaPlaceMapRendererPipeline` supplies ownership and endpoint preferences over
shared measurement, macro layout, port capacity, route candidates, routing
lifecycle, label capacity/search, and marker geometry. It preserves the existing
containment/follower placement plan while emitting every selected navigation
occurrence independently. Fusion requires exactly one unannotated navigation and
one matching containment declaration; parallel or annotated navigation stays
separate from structure.

Capacity requests belong to an actual adjacent sibling gap or Area/root padding.
The shared `gapAfter` layout intent widens that gap only, and remeasures containers
before reflowing ancestors and later siblings. Area top padding owns header-to-first
Place channels; exterior padding owns channels outside descendant node bodies.
Same-owner navigation and labels remain inside that selected owner's content
envelope. Cross-owner navigation may cross endpoint container borders transversely;
parallel runs keep their stand-off, and unrelated selected containers block entry.
Container interiors remain traversable; node bodies and Area headers block routes.
No final coordinates or line breaks enter RendererScene or projection.

Ordinary singleton ports use side midpoints. Groups remain symmetric at the shared
paint-aware pitch; fixed structural reservations may displace an entire group to
the nearest feasible position. Geometric endpoint order reduces crossings, with
authored occurrence order breaking ties. Facing singleton attachments try a shared
legal coordinate on either axis. Ports are recomputed after reflow and never spread
to accommodate label width.

Complete accepted alternatives rank crossings, bends, expansion, port displacement,
length, and stable identity. Route generation and label probes reserve capacity for
later connectors, and all trials consume one live allowance: 4,096 candidates,
128 repair revisions, and four expansion passes. Labelled scenes reserve allowance
for later measured reflows, then divide each frame between proposals and complete
selection. Partial scoring uses cheap adjacent probes; complete scoring includes
prospective offset events and repeats all final audits. Measured text capacity uses the
maximum width for disjoint rows. Anchor-specific deficits retain their actual gap
or padding owner; a small terminal-channel deficit can precede a larger label demand.
Repeated geometry states or unresolved capacity produce fatal diagnostics. An
already accepted coherent revision may return with a comparison-limit warning.
Typed `routingEvidence` records trials, port groups, rejected alternatives, and
measured expansions separately from user-facing diagnostics.

## Final acceptance

Only explicitly identified structural source trunk segments may share a track.
Navigation receives no whole-path sharing exemption. Shared readable geometry uses
16px painted stand-off and 0.5px tolerance. Labels sit 12px beside their own route
and at least 24px from unrelated routes, retaining all measured annotation text.
Adjacency uses the minimum distance to every segment of the label's own connector.
Independent final checks
compare the original occurrence/label/marker inventory with the emitted scene,
validate attachment sides and insets, and check route separation, body/header
collisions, label association and ambiguity, painted arrowheads, and export bounds.
The SVG backend repeats acceptance immediately before serialization. Failed enabled
IA artifacts are withheld in combined and named public paths, including `force`.
PNG rasterizes that same accepted SVG.

## Source files and evidence

- [iaPlaceMapRenderModel.ts](../../src/renderer/iaPlaceMapRenderModel.ts)
- [relationshipLabelFormatter.ts](../../src/renderer/relationshipLabelFormatter.ts)
- [iaPlaceMap.ts](../../src/renderer/staged/iaPlaceMap.ts)
- [iaPlaceMapRouting.ts](../../src/renderer/staged/iaPlaceMapRouting.ts)
- [connectorLabelLayout.ts](../../src/renderer/staged/connectorLabelLayout.ts)
- [routingCore](../../src/renderer/staged/routingCore)
- [markerAudit.ts](../../src/renderer/staged/markerAudit.ts)
- [Implementation evidence](../ia_place_map_hardening/implementation_evidence.md)
- [Routing recovery execution](../ia_place_map_hardening/routing_quality_execution.md)
- [SVG routing recovery proofs](../ia_place_map_hardening/routing_quality_evidence/README.md)
