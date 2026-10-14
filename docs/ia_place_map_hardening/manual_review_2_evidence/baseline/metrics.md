# Review-2 immutable baseline metrics

Captured HEAD: `c1cd5d476370ebad496eece78c57517f53ea5f45`.

These measurements summarize the pre-change positioned scenes. They establish comparison baselines, not acceptance under the proposed policies. Crossings are recomputed from strict perpendicular interior intersections; bends count normalized route points minus two.

| Proof | Canvas width | Canvas height | Connectors | Crossings | Bends |
| --- | ---: | ---: | ---: | ---: | ---: |
| DG-001.compact.json | 754.988 | 250 | 4 | 0 | 4 |
| DG-001.detailed.json | 754.988 | 350 | 4 | 0 | 4 |
| DG-002.compact.json | 739.676 | 168 | 1 | 0 | 0 |
| DG-002.detailed.json | 739.676 | 218 | 1 | 0 | 0 |
| DG-003.compact.json | 754.988 | 168 | 1 | 0 | 0 |
| DG-003.detailed.json | 754.988 | 218 | 1 | 0 | 0 |
| billsage.compact.json | 1938 | 533 | 8 | 0 | 12 |
| billsage.detailed.json | 1940 | 887 | 8 | 0 | 12 |
| multiple-incoming.compact.json | 955.664 | 250 | 5 | 1 | 6 |
| multiple-incoming.detailed.json | 939.664 | 350 | 5 | 1 | 6 |
| parallel.compact.json | 754.988 | 250 | 4 | 0 | 4 |
| parallel.detailed.json | 754.988 | 350 | 4 | 0 | 4 |
| self-loop.compact.json | 754.988 | 260.5 | 5 | 0 | 10 |
| self-loop.detailed.json | 754.988 | 350 | 5 | 0 | 10 |

The multiple-incoming baseline has one crossing in both details. Other baseline cases have zero. Immutable scene hashes, hierarchy/order, complete occurrence labels, root padding, expansion claims and consumed budgets are retained in `metrics.json`; original scenes are retained alongside these metrics.

No historical SVG or user-authored review was changed by capture.
