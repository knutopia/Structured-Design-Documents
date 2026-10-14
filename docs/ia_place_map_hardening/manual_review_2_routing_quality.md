# Manual Review of Routing Quality Improvements

In response to [routing_quality_execution.md](routing_quality_execution.md), [routing_quality_recovery_plan.md](routing_quality_recovery_plan.md)

- See inline comments.

- The `type-id`, `id` and `type` decorator variations are identical in routing, as the decorator variations are identical in their use of node space. Thus, for clarity the `id` and `type` version proofs are removed from the list in this document.

## billsage.compact
[billsage.compact](routing_quality_evidence/billsage.compact.svg)  
[billsage.compact.type-id](routing_quality_evidence/billsage.compact.type-id.svg)

- Good overall
- Question about `P-210 -> P-230` right-edge-start to right-edge-end routing: what rule prevents this from being a two-segment bottom-edge-start, left-edge end connector? (there likely IS a rule, so I am not saying that the current routing is wrong.)

## billsage.detailed
[billsage.detailed](routing_quality_evidence/billsage.detailed.svg)  
[billsage.detailed.type-id](routing_quality_evidence/billsage.detailed.type-id.svg)  

- Good overall
- Questionable P-210 - P-230 right-arrival routing

## multiple-incoming.compact
[multiple-incoming.compact](routing_quality_evidence/multiple-incoming.compact.svg)  
[multiple-incoming.detailed](routing_quality_evidence/multiple-incoming.detailed.svg)  

- Good overall

## parallel.compact.*
[parallel.compact.DG-001](routing_quality_evidence/parallel.compact.DG-001.svg)  
[parallel.compact.DG-002](routing_quality_evidence/parallel.compact.DG-002.svg)  
[parallel.compact.DG-003](routing_quality_evidence/parallel.compact.DG-003.svg)  
[parallel.compact](routing_quality_evidence/parallel.compact.svg)  
[parallel.compact.type-id](routing_quality_evidence/parallel.compact.type-id.svg)  

- Good overall
- in example with leftbound connector, the leftbound connector encroaches on right- and bottom diagram edge - it should not.
- Opportunity for cleaner line breaks in labels, allowing for shorter labels:
[Accept invitation]
{invitation valid}
instead of
[Accept invitation]{invitation
valid}

## parallel.detailed.*
[parallel.detailed.DG-001](routing_quality_evidence/parallel.detailed.DG-001.svg)  
[parallel.detailed.DG-002](routing_quality_evidence/parallel.detailed.DG-002.svg)  
[parallel.detailed.DG-003](routing_quality_evidence/parallel.detailed.DG-003.svg)  

[parallel.detailed](routing_quality_evidence/parallel.detailed.svg)  
[parallel.detailed.type-id](routing_quality_evidence/parallel.detailed.type-id.svg)  

- same comments as parallel.compact.*

## self-loop.compact
[self-loop.compact](routing_quality_evidence/self-loop.compact.svg)  
[self-loop.detailed](routing_quality_evidence/self-loop.detailed.svg)  
|
- leftbound connector encroaches on right- and bottom diagram edge - it should not.
- the "forward"-facing self-loop connector looks odd. Expected:
    - simple solution: "backward"-facing (return-to-same-edge, as now), or
    - more ambitious: bottom-edge placement, "backward" facing (return-to-same-edge, as now) before (to the left of) existing connector end on bottom edge. More challenging label placement to achieve label-to-connector association. Benefit would be cleaner overall layout allowing for top-aligned nodes in both areas to connect via 2 straight-line horizontal connectors, instead of current 3-segment-connectors.