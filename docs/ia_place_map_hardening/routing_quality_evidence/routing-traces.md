# Routing proof decisions

Captured 2026-10-13 from typed `PositionedScene.routingEvidence` after numerical and normal-scale SVG acceptance. Costs compare fully accepted scenes by crossings, bends, absolute owned expansion, port-group displacement and length, followed by stable identity. Candidate counts include attachment trials, proposal generation, repair and label probes; limits remain 4,096 candidates, 128 repairs and four expansion passes. A rejected or exhausted alternative is not a proof of geometric impossibility. Expansion values are measured absolute increments from the original scene, not additions to earlier reflows. Canonical source and SVG hashes are stored beside this file.

## billsage.compact.id

Selected best accepted cost: `facing-flank-east-reverse:proposal-0`: [0, 12, 72, 190, 2162.5].

Pass 0, remaining candidates 3320, repairs 122.

Rejected alternatives:

- `facing-flank-east-reverse:seed`: candidate_exhausted.
- `facing-flank-east:seed`: candidate_exhausted.
- `facing-flank-west-reverse:seed`: endpoint_envelope_exhausted.
- `facing-flank-west:seed`: endpoint_envelope_exhausted.
- `facing-reverse:seed`: candidate_exhausted.
- `south-reverse:seed`: endpoint_envelope_exhausted.
- `north-reverse:seed`: candidate_exhausted.
- `north:seed`: candidate_exhausted.
- `facing:seed`: candidate_exhausted.
- `south:seed`: endpoint_envelope_exhausted.

Pass 0.

- gaps: `P-210__follower_scope → P-220__group → P-230__group`; measured increment 2px.
- gaps: `P-220__contains_scope_branch → P-221__group → P-222__group`; measured increment 2px.
- gaps: `P-220__group → P-220 → P-220__contains_scope_branch`; measured increment 18px.
- padding: `A-200 → right`; measured increment 50px.
- Rejected revision: `facing-flank-east`.
- Connector "navigation:source-edge-05a50583f4d9a685a06cd396e2a3a7c6bed3edf7c620573328f44d1d2567bca8-0" segment 1 intersects non-endpoint box "P-221".
- Connector "navigation:source-edge-05a50583f4d9a685a06cd396e2a3a7c6bed3edf7c620573328f44d1d2567bca8-0" segment 1 intersects non-endpoint box "P-222".
- Connector "navigation:source-edge-90e6a7c9bd6b601aae36440684a666f7ed86162be43debbf4db83413bccf5ec5-0" segment 0 intersects non-endpoint box "P-221".
- Connector "navigation:source-edge-b09a7ed8a62b206217a95920e2aede1e4320558a6a11e69dca19ab5868443f2f-0" segment 0 intersects non-endpoint box "P-221".
- Connector "navigation:source-edge-b09a7ed8a62b206217a95920e2aede1e4320558a6a11e69dca19ab5868443f2f-0" segment 0 intersects non-endpoint box "P-222".

Pass 1, remaining candidates 2374, repairs 118.

| Accepted revision | Crossings, bends, expansion, displacement, length |
| --- | --- |
| `facing-flank-east-reverse:proposal-0` | 0, 12, 72, 190, 2162.5 |
| `facing-flank-east-reverse:proposal-1` | 2, 12, 72, 190, 2162.5 |
| `facing-flank-east-reverse:proposal-2` | 2, 12, 72, 190, 2162.5 |
| `facing-flank-east:proposal-0` | 3, 12, 72, 144, 1952.5 |
| `facing-flank-east:proposal-1` | 3, 12, 72, 144, 1952.5 |
| `facing-flank-east:proposal-2` | 3, 12, 72, 144, 1952.5 |
| `facing-flank-east:proposal-3` | 3, 12, 72, 144, 1952.5 |
| `facing-flank-east-reverse:proposal-3` | 4, 12, 72, 190, 2162.5 |

Rejected alternatives:

- `facing-flank-west-reverse:seed`: endpoint_envelope_exhausted.
- `facing-flank-west:seed`: endpoint_envelope_exhausted.
- `facing-reverse:seed`: candidate_exhausted.
- `south-reverse:seed`: endpoint_envelope_exhausted.
- `north-reverse:seed`: candidate_exhausted.
- `north:seed`: candidate_exhausted.
- `facing:seed`: candidate_exhausted.
- `south:seed`: endpoint_envelope_exhausted.

Selected ordinary port groups (offsets and reservations in px):

| Node / side | Offsets | Reserved offsets | Signed group displacement |
| --- | --- | --- | --- |
| P-210 / south | 136 | none | 24 |
| P-220 / north | 88 | none | -24 |
| P-210 / east | 42.5 | none | 0 |
| P-230 / east | 26.5 | none | 0 |
| P-221 / north | 41 | none | -71 |
| P-220 / south | 89, 112, 135 | 24 | 0 |
| P-222 / north | 64 | none | -48 |
| P-230 / north | 135 | none | 23 |


## billsage.compact

Selected best accepted cost: `facing-flank-east-reverse:proposal-0`: [0, 12, 72, 190, 2047.5].

Pass 0, remaining candidates 3320, repairs 122.

Rejected alternatives:

- `facing-flank-east-reverse:seed`: candidate_exhausted.
- `facing-flank-east:seed`: candidate_exhausted.
- `facing-flank-west-reverse:seed`: endpoint_envelope_exhausted.
- `facing-flank-west:seed`: endpoint_envelope_exhausted.
- `facing-reverse:seed`: candidate_exhausted.
- `south-reverse:seed`: endpoint_envelope_exhausted.
- `north-reverse:seed`: candidate_exhausted.
- `north:seed`: candidate_exhausted.
- `facing:seed`: candidate_exhausted.
- `south:seed`: endpoint_envelope_exhausted.

Pass 0.

- gaps: `P-210__follower_scope → P-220__group → P-230__group`; measured increment 2px.
- gaps: `P-220__contains_scope_branch → P-221__group → P-222__group`; measured increment 2px.
- gaps: `P-220__group → P-220 → P-220__contains_scope_branch`; measured increment 18px.
- padding: `A-200 → right`; measured increment 50px.
- Rejected revision: `facing-flank-east`.
- Connector "navigation:source-edge-05a50583f4d9a685a06cd396e2a3a7c6bed3edf7c620573328f44d1d2567bca8-0" segment 1 intersects non-endpoint box "P-221".
- Connector "navigation:source-edge-05a50583f4d9a685a06cd396e2a3a7c6bed3edf7c620573328f44d1d2567bca8-0" segment 1 intersects non-endpoint box "P-222".
- Connector "navigation:source-edge-90e6a7c9bd6b601aae36440684a666f7ed86162be43debbf4db83413bccf5ec5-0" segment 0 intersects non-endpoint box "P-221".
- Connector "navigation:source-edge-b09a7ed8a62b206217a95920e2aede1e4320558a6a11e69dca19ab5868443f2f-0" segment 0 intersects non-endpoint box "P-221".
- Connector "navigation:source-edge-b09a7ed8a62b206217a95920e2aede1e4320558a6a11e69dca19ab5868443f2f-0" segment 0 intersects non-endpoint box "P-222".

Pass 1, remaining candidates 2374, repairs 118.

| Accepted revision | Crossings, bends, expansion, displacement, length |
| --- | --- |
| `facing-flank-east-reverse:proposal-0` | 0, 12, 72, 190, 2047.5 |
| `facing-flank-east-reverse:proposal-1` | 2, 12, 72, 190, 2047.5 |
| `facing-flank-east-reverse:proposal-2` | 2, 12, 72, 190, 2047.5 |
| `facing-flank-east:proposal-0` | 3, 12, 72, 144, 1837.5 |
| `facing-flank-east:proposal-1` | 3, 12, 72, 144, 1837.5 |
| `facing-flank-east:proposal-2` | 3, 12, 72, 144, 1837.5 |
| `facing-flank-east:proposal-3` | 3, 12, 72, 144, 1837.5 |
| `facing-flank-east-reverse:proposal-3` | 4, 12, 72, 190, 2047.5 |

Rejected alternatives:

- `facing-flank-west-reverse:seed`: endpoint_envelope_exhausted.
- `facing-flank-west:seed`: endpoint_envelope_exhausted.
- `facing-reverse:seed`: candidate_exhausted.
- `south-reverse:seed`: endpoint_envelope_exhausted.
- `north-reverse:seed`: candidate_exhausted.
- `north:seed`: candidate_exhausted.
- `facing:seed`: candidate_exhausted.
- `south:seed`: endpoint_envelope_exhausted.

Selected ordinary port groups (offsets and reservations in px):

| Node / side | Offsets | Reserved offsets | Signed group displacement |
| --- | --- | --- | --- |
| P-210 / south | 136 | none | 24 |
| P-220 / north | 88 | none | -24 |
| P-210 / east | 33 | none | 0 |
| P-230 / east | 24 | none | 0 |
| P-221 / north | 41 | none | -71 |
| P-220 / south | 89, 112, 135 | 24 | 0 |
| P-222 / north | 64 | none | -48 |
| P-230 / north | 135 | none | 23 |


## billsage.compact.type-id

Selected best accepted cost: `facing-flank-east-reverse:proposal-0`: [0, 12, 72, 190, 2162.5].

Pass 0, remaining candidates 3320, repairs 122.

Rejected alternatives:

- `facing-flank-east-reverse:seed`: candidate_exhausted.
- `facing-flank-east:seed`: candidate_exhausted.
- `facing-flank-west-reverse:seed`: endpoint_envelope_exhausted.
- `facing-flank-west:seed`: endpoint_envelope_exhausted.
- `facing-reverse:seed`: candidate_exhausted.
- `south-reverse:seed`: endpoint_envelope_exhausted.
- `north-reverse:seed`: candidate_exhausted.
- `north:seed`: candidate_exhausted.
- `facing:seed`: candidate_exhausted.
- `south:seed`: endpoint_envelope_exhausted.

Pass 0.

- gaps: `P-210__follower_scope → P-220__group → P-230__group`; measured increment 2px.
- gaps: `P-220__contains_scope_branch → P-221__group → P-222__group`; measured increment 2px.
- gaps: `P-220__group → P-220 → P-220__contains_scope_branch`; measured increment 18px.
- padding: `A-200 → right`; measured increment 50px.
- Rejected revision: `facing-flank-east`.
- Connector "navigation:source-edge-05a50583f4d9a685a06cd396e2a3a7c6bed3edf7c620573328f44d1d2567bca8-0" segment 1 intersects non-endpoint box "P-221".
- Connector "navigation:source-edge-05a50583f4d9a685a06cd396e2a3a7c6bed3edf7c620573328f44d1d2567bca8-0" segment 1 intersects non-endpoint box "P-222".
- Connector "navigation:source-edge-90e6a7c9bd6b601aae36440684a666f7ed86162be43debbf4db83413bccf5ec5-0" segment 0 intersects non-endpoint box "P-221".
- Connector "navigation:source-edge-b09a7ed8a62b206217a95920e2aede1e4320558a6a11e69dca19ab5868443f2f-0" segment 0 intersects non-endpoint box "P-221".
- Connector "navigation:source-edge-b09a7ed8a62b206217a95920e2aede1e4320558a6a11e69dca19ab5868443f2f-0" segment 0 intersects non-endpoint box "P-222".

Pass 1, remaining candidates 2374, repairs 118.

| Accepted revision | Crossings, bends, expansion, displacement, length |
| --- | --- |
| `facing-flank-east-reverse:proposal-0` | 0, 12, 72, 190, 2162.5 |
| `facing-flank-east-reverse:proposal-1` | 2, 12, 72, 190, 2162.5 |
| `facing-flank-east-reverse:proposal-2` | 2, 12, 72, 190, 2162.5 |
| `facing-flank-east:proposal-0` | 3, 12, 72, 144, 1952.5 |
| `facing-flank-east:proposal-1` | 3, 12, 72, 144, 1952.5 |
| `facing-flank-east:proposal-2` | 3, 12, 72, 144, 1952.5 |
| `facing-flank-east:proposal-3` | 3, 12, 72, 144, 1952.5 |
| `facing-flank-east-reverse:proposal-3` | 4, 12, 72, 190, 2162.5 |

Rejected alternatives:

- `facing-flank-west-reverse:seed`: endpoint_envelope_exhausted.
- `facing-flank-west:seed`: endpoint_envelope_exhausted.
- `facing-reverse:seed`: candidate_exhausted.
- `south-reverse:seed`: endpoint_envelope_exhausted.
- `north-reverse:seed`: candidate_exhausted.
- `north:seed`: candidate_exhausted.
- `facing:seed`: candidate_exhausted.
- `south:seed`: endpoint_envelope_exhausted.

Selected ordinary port groups (offsets and reservations in px):

| Node / side | Offsets | Reserved offsets | Signed group displacement |
| --- | --- | --- | --- |
| P-210 / south | 136 | none | 24 |
| P-220 / north | 88 | none | -24 |
| P-210 / east | 42.5 | none | 0 |
| P-230 / east | 26.5 | none | 0 |
| P-221 / north | 41 | none | -71 |
| P-220 / south | 89, 112, 135 | 24 | 0 |
| P-222 / north | 64 | none | -48 |
| P-230 / north | 135 | none | 23 |


## billsage.compact.type

Selected best accepted cost: `facing-flank-east-reverse:proposal-0`: [0, 12, 72, 190, 2162.5].

Pass 0, remaining candidates 3320, repairs 122.

Rejected alternatives:

- `facing-flank-east-reverse:seed`: candidate_exhausted.
- `facing-flank-east:seed`: candidate_exhausted.
- `facing-flank-west-reverse:seed`: endpoint_envelope_exhausted.
- `facing-flank-west:seed`: endpoint_envelope_exhausted.
- `facing-reverse:seed`: candidate_exhausted.
- `south-reverse:seed`: endpoint_envelope_exhausted.
- `north-reverse:seed`: candidate_exhausted.
- `north:seed`: candidate_exhausted.
- `facing:seed`: candidate_exhausted.
- `south:seed`: endpoint_envelope_exhausted.

Pass 0.

- gaps: `P-210__follower_scope → P-220__group → P-230__group`; measured increment 2px.
- gaps: `P-220__contains_scope_branch → P-221__group → P-222__group`; measured increment 2px.
- gaps: `P-220__group → P-220 → P-220__contains_scope_branch`; measured increment 18px.
- padding: `A-200 → right`; measured increment 50px.
- Rejected revision: `facing-flank-east`.
- Connector "navigation:source-edge-05a50583f4d9a685a06cd396e2a3a7c6bed3edf7c620573328f44d1d2567bca8-0" segment 1 intersects non-endpoint box "P-221".
- Connector "navigation:source-edge-05a50583f4d9a685a06cd396e2a3a7c6bed3edf7c620573328f44d1d2567bca8-0" segment 1 intersects non-endpoint box "P-222".
- Connector "navigation:source-edge-90e6a7c9bd6b601aae36440684a666f7ed86162be43debbf4db83413bccf5ec5-0" segment 0 intersects non-endpoint box "P-221".
- Connector "navigation:source-edge-b09a7ed8a62b206217a95920e2aede1e4320558a6a11e69dca19ab5868443f2f-0" segment 0 intersects non-endpoint box "P-221".
- Connector "navigation:source-edge-b09a7ed8a62b206217a95920e2aede1e4320558a6a11e69dca19ab5868443f2f-0" segment 0 intersects non-endpoint box "P-222".

Pass 1, remaining candidates 2374, repairs 118.

| Accepted revision | Crossings, bends, expansion, displacement, length |
| --- | --- |
| `facing-flank-east-reverse:proposal-0` | 0, 12, 72, 190, 2162.5 |
| `facing-flank-east-reverse:proposal-1` | 2, 12, 72, 190, 2162.5 |
| `facing-flank-east-reverse:proposal-2` | 2, 12, 72, 190, 2162.5 |
| `facing-flank-east:proposal-0` | 3, 12, 72, 144, 1952.5 |
| `facing-flank-east:proposal-1` | 3, 12, 72, 144, 1952.5 |
| `facing-flank-east:proposal-2` | 3, 12, 72, 144, 1952.5 |
| `facing-flank-east:proposal-3` | 3, 12, 72, 144, 1952.5 |
| `facing-flank-east-reverse:proposal-3` | 4, 12, 72, 190, 2162.5 |

Rejected alternatives:

- `facing-flank-west-reverse:seed`: endpoint_envelope_exhausted.
- `facing-flank-west:seed`: endpoint_envelope_exhausted.
- `facing-reverse:seed`: candidate_exhausted.
- `south-reverse:seed`: endpoint_envelope_exhausted.
- `north-reverse:seed`: candidate_exhausted.
- `north:seed`: candidate_exhausted.
- `facing:seed`: candidate_exhausted.
- `south:seed`: endpoint_envelope_exhausted.

Selected ordinary port groups (offsets and reservations in px):

| Node / side | Offsets | Reserved offsets | Signed group displacement |
| --- | --- | --- | --- |
| P-210 / south | 136 | none | 24 |
| P-220 / north | 88 | none | -24 |
| P-210 / east | 42.5 | none | 0 |
| P-230 / east | 26.5 | none | 0 |
| P-221 / north | 41 | none | -71 |
| P-220 / south | 89, 112, 135 | 24 | 0 |
| P-222 / north | 64 | none | -48 |
| P-230 / north | 135 | none | 23 |


## billsage.detailed.id

Selected best accepted cost: `facing-flank-east-reverse:proposal-0`: [0, 12, 76, 190, 2863.5].

Pass 0, remaining candidates 3024, repairs 120.

Rejected alternatives:

- `facing-flank-east-reverse:seed`: candidate_exhausted.
- `facing-flank-east:seed`: candidate_exhausted.
- `facing-flank-west-reverse:seed`: endpoint_envelope_exhausted.
- `facing-flank-west:seed`: endpoint_envelope_exhausted.
- `facing-reverse:seed`: candidate_exhausted.
- `east-reverse:seed`: endpoint_envelope_exhausted.
- `south-reverse:seed`: endpoint_envelope_exhausted.
- `north-reverse:seed`: candidate_exhausted.
- `north:seed`: candidate_exhausted.
- `east:seed`: endpoint_envelope_exhausted.
- `east-flank-east-reverse:seed`: endpoint_envelope_exhausted.
- `facing:seed`: candidate_exhausted.
- `west-reverse:seed`: candidate_exhausted.
- `west:seed`: candidate_exhausted.
- `south:seed`: endpoint_envelope_exhausted.
- `west-flank-west-reverse:seed`: endpoint_envelope_exhausted.
- `west-flank-west:seed`: endpoint_envelope_exhausted.
- `east-flank-east:seed`: endpoint_envelope_exhausted.

Pass 0.

- gaps: `P-210__follower_scope → P-220__group → P-230__group`; measured increment 2px.
- gaps: `P-210__group → P-210 → P-210__follower_scope`; measured increment 2px.
- padding: `A-200 → left`; measured increment 2px.
- Rejected revision: `west`.
- Connectors "navigation:source-edge-90e6a7c9bd6b601aae36440684a666f7ed86162be43debbf4db83413bccf5ec5-0" and "navigation:source-edge-b09a7ed8a62b206217a95920e2aede1e4320558a6a11e69dca19ab5868443f2f-0" have 315px of overlapping vertical span at 0px separation.
- Connector "navigation:source-edge-05a50583f4d9a685a06cd396e2a3a7c6bed3edf7c620573328f44d1d2567bca8-0" segment 0 violates the 17px clearance of node "P-220__contains__P-221__source-edge-1a4b74752f522d2bb8dc201b058b1224b58520f998f06fdcecf1fd9f55c3d249-0:end:marker".
- Connector "navigation:source-edge-05a50583f4d9a685a06cd396e2a3a7c6bed3edf7c620573328f44d1d2567bca8-0" segment 0 violates the 17px clearance of node "P-220__contains__P-222__source-edge-028d7ca5cdfce89e3d30d846a54c7e56ae61268f502f7c005097ff89c69e6dd9-0:end:marker".
- Connector "navigation:source-edge-05a50583f4d9a685a06cd396e2a3a7c6bed3edf7c620573328f44d1d2567bca8-0" segment 0 intersects non-endpoint box "P-220".
- Connector "navigation:source-edge-05a50583f4d9a685a06cd396e2a3a7c6bed3edf7c620573328f44d1d2567bca8-0" segment 0 intersects non-endpoint box "P-221".
- Connector "navigation:source-edge-05a50583f4d9a685a06cd396e2a3a7c6bed3edf7c620573328f44d1d2567bca8-0" segment 0 intersects non-endpoint box "P-222".

Pass 1, remaining candidates 1732, repairs 112.

Rejected alternatives:

- `facing-flank-east-reverse:seed`: candidate_exhausted.
- `facing-flank-east:seed`: candidate_exhausted.
- `facing-flank-west-reverse:seed`: endpoint_envelope_exhausted.
- `facing-flank-west:seed`: endpoint_envelope_exhausted.
- `facing-reverse:seed`: candidate_exhausted.
- `east-reverse:seed`: endpoint_envelope_exhausted.
- `south-reverse:seed`: endpoint_envelope_exhausted.
- `north-reverse:seed`: candidate_exhausted.
- `north:seed`: candidate_exhausted.
- `east:seed`: endpoint_envelope_exhausted.
- `east-flank-east-reverse:seed`: endpoint_envelope_exhausted.
- `facing:seed`: candidate_exhausted.
- `west-reverse:seed`: candidate_exhausted.
- `west:seed`: candidate_exhausted.
- `south:seed`: endpoint_envelope_exhausted.
- `west-flank-west-reverse:seed`: endpoint_envelope_exhausted.
- `west-flank-west:seed`: endpoint_envelope_exhausted.
- `east-flank-east:seed`: endpoint_envelope_exhausted.

Pass 1.

- gaps: `P-220__contains_scope_branch → P-221__group → P-222__group`; measured increment 2px.
- gaps: `P-220__group → P-220 → P-220__contains_scope_branch`; measured increment 18px.
- padding: `A-200 → right`; measured increment 50px.
- Rejected revision: `facing-flank-east`.
- Connector "navigation:source-edge-05a50583f4d9a685a06cd396e2a3a7c6bed3edf7c620573328f44d1d2567bca8-0" segment 1 intersects non-endpoint box "P-221".
- Connector "navigation:source-edge-05a50583f4d9a685a06cd396e2a3a7c6bed3edf7c620573328f44d1d2567bca8-0" segment 1 intersects non-endpoint box "P-222".
- Connector "navigation:source-edge-90e6a7c9bd6b601aae36440684a666f7ed86162be43debbf4db83413bccf5ec5-0" segment 0 intersects non-endpoint box "P-221".
- Connector "navigation:source-edge-b09a7ed8a62b206217a95920e2aede1e4320558a6a11e69dca19ab5868443f2f-0" segment 0 intersects non-endpoint box "P-221".
- Connector "navigation:source-edge-b09a7ed8a62b206217a95920e2aede1e4320558a6a11e69dca19ab5868443f2f-0" segment 0 intersects non-endpoint box "P-222".

Pass 2, remaining candidates 0, repairs 109.

| Accepted revision | Crossings, bends, expansion, displacement, length |
| --- | --- |
| `facing-flank-east-reverse:proposal-0` | 0, 12, 76, 190, 2863.5 |
| `facing-reverse:proposal-0` | 0, 14, 76, 155.5, 2664 |
| `facing-reverse:proposal-1` | 0, 14, 76, 155.5, 2696 |
| `facing-reverse:proposal-2` | 0, 14, 76, 155.5, 2696 |
| `facing-reverse:proposal-3` | 0, 14, 76, 155.5, 2728 |
| `east:proposal-0` | 2, 12, 76, 96, 2682 |
| `facing-flank-east-reverse:proposal-1` | 2, 12, 76, 190, 2863.5 |
| `facing-flank-east-reverse:proposal-2` | 2, 12, 76, 190, 2863.5 |
| `east:proposal-1` | 2, 14, 76, 96, 2682 |
| `east:proposal-2` | 2, 14, 76, 96, 2682 |
| `east:proposal-3` | 2, 14, 76, 96, 2682 |
| `facing-flank-east:proposal-0` | 3, 12, 76, 144, 2653.5 |
| `facing-flank-east:proposal-1` | 3, 12, 76, 144, 2653.5 |
| `facing-flank-east:proposal-2` | 3, 12, 76, 144, 2653.5 |
| `facing-flank-east:proposal-3` | 3, 12, 76, 144, 2653.5 |
| `east-reverse:proposal-0` | 3, 12, 76, 96, 2682 |
| `east-reverse:proposal-1` | 3, 12, 76, 96, 2682 |
| `east-reverse:proposal-2` | 3, 12, 76, 96, 2683 |
| `east-reverse:proposal-3` | 3, 12, 76, 96, 2683 |
| `facing-flank-east-reverse:proposal-3` | 4, 12, 76, 190, 2863.5 |

Rejected alternatives:

- `facing-flank-west-reverse:seed`: endpoint_envelope_exhausted.
- `facing-flank-west:seed`: endpoint_envelope_exhausted.
- `south-reverse:seed`: endpoint_envelope_exhausted.
- `north-reverse:seed`: candidate_exhausted.
- `north:seed`: candidate_exhausted.
- `east-flank-east-reverse:seed`: candidate_exhausted.

Selected ordinary port groups (offsets and reservations in px):

| Node / side | Offsets | Reserved offsets | Signed group displacement |
| --- | --- | --- | --- |
| P-210 / south | 136 | none | 24 |
| P-220 / north | 88 | none | -24 |
| P-210 / east | 90.5 | none | 0 |
| P-230 / east | 65.5 | none | 0 |
| P-221 / north | 41 | none | -71 |
| P-220 / south | 89, 112, 135 | 24 | 0 |
| P-222 / north | 64 | none | -48 |
| P-230 / north | 135 | none | 23 |


## billsage.detailed

Selected best accepted cost: `facing-flank-east-reverse:proposal-0`: [0, 12, 76, 190, 2692.5].

Pass 0, remaining candidates 3024, repairs 120.

Rejected alternatives:

- `facing-flank-east-reverse:seed`: candidate_exhausted.
- `facing-flank-east:seed`: candidate_exhausted.
- `facing-flank-west-reverse:seed`: endpoint_envelope_exhausted.
- `facing-flank-west:seed`: endpoint_envelope_exhausted.
- `facing-reverse:seed`: candidate_exhausted.
- `east-reverse:seed`: endpoint_envelope_exhausted.
- `south-reverse:seed`: endpoint_envelope_exhausted.
- `north-reverse:seed`: candidate_exhausted.
- `north:seed`: candidate_exhausted.
- `east:seed`: endpoint_envelope_exhausted.
- `east-flank-east-reverse:seed`: endpoint_envelope_exhausted.
- `facing:seed`: candidate_exhausted.
- `west-reverse:seed`: candidate_exhausted.
- `west:seed`: candidate_exhausted.
- `south:seed`: endpoint_envelope_exhausted.
- `west-flank-west-reverse:seed`: endpoint_envelope_exhausted.
- `west-flank-west:seed`: endpoint_envelope_exhausted.
- `east-flank-east:seed`: endpoint_envelope_exhausted.

Pass 0.

- gaps: `P-210__follower_scope → P-220__group → P-230__group`; measured increment 2px.
- gaps: `P-210__group → P-210 → P-210__follower_scope`; measured increment 2px.
- padding: `A-200 → left`; measured increment 2px.
- Rejected revision: `west`.
- Connectors "navigation:source-edge-90e6a7c9bd6b601aae36440684a666f7ed86162be43debbf4db83413bccf5ec5-0" and "navigation:source-edge-b09a7ed8a62b206217a95920e2aede1e4320558a6a11e69dca19ab5868443f2f-0" have 277px of overlapping vertical span at 0px separation.
- Connector "navigation:source-edge-05a50583f4d9a685a06cd396e2a3a7c6bed3edf7c620573328f44d1d2567bca8-0" segment 0 violates the 17px clearance of node "P-220__contains__P-221__source-edge-1a4b74752f522d2bb8dc201b058b1224b58520f998f06fdcecf1fd9f55c3d249-0:end:marker".
- Connector "navigation:source-edge-05a50583f4d9a685a06cd396e2a3a7c6bed3edf7c620573328f44d1d2567bca8-0" segment 0 violates the 17px clearance of node "P-220__contains__P-222__source-edge-028d7ca5cdfce89e3d30d846a54c7e56ae61268f502f7c005097ff89c69e6dd9-0:end:marker".
- Connector "navigation:source-edge-05a50583f4d9a685a06cd396e2a3a7c6bed3edf7c620573328f44d1d2567bca8-0" segment 0 intersects non-endpoint box "P-220".
- Connector "navigation:source-edge-05a50583f4d9a685a06cd396e2a3a7c6bed3edf7c620573328f44d1d2567bca8-0" segment 0 intersects non-endpoint box "P-221".
- Connector "navigation:source-edge-05a50583f4d9a685a06cd396e2a3a7c6bed3edf7c620573328f44d1d2567bca8-0" segment 0 intersects non-endpoint box "P-222".

Pass 1, remaining candidates 1741, repairs 112.

Rejected alternatives:

- `facing-flank-east-reverse:seed`: candidate_exhausted.
- `facing-flank-east:seed`: candidate_exhausted.
- `facing-flank-west-reverse:seed`: endpoint_envelope_exhausted.
- `facing-flank-west:seed`: endpoint_envelope_exhausted.
- `facing-reverse:seed`: candidate_exhausted.
- `east-reverse:seed`: endpoint_envelope_exhausted.
- `south-reverse:seed`: endpoint_envelope_exhausted.
- `north-reverse:seed`: candidate_exhausted.
- `north:seed`: candidate_exhausted.
- `east:seed`: endpoint_envelope_exhausted.
- `east-flank-east-reverse:seed`: endpoint_envelope_exhausted.
- `facing:seed`: candidate_exhausted.
- `west-reverse:seed`: candidate_exhausted.
- `west:seed`: candidate_exhausted.
- `south:seed`: endpoint_envelope_exhausted.
- `west-flank-west-reverse:seed`: endpoint_envelope_exhausted.
- `west-flank-west:seed`: endpoint_envelope_exhausted.
- `east-flank-east:seed`: endpoint_envelope_exhausted.

Pass 1.

- gaps: `P-220__contains_scope_branch → P-221__group → P-222__group`; measured increment 2px.
- gaps: `P-220__group → P-220 → P-220__contains_scope_branch`; measured increment 18px.
- padding: `A-200 → right`; measured increment 50px.
- Rejected revision: `facing-flank-east`.
- Connector "navigation:source-edge-05a50583f4d9a685a06cd396e2a3a7c6bed3edf7c620573328f44d1d2567bca8-0" segment 1 intersects non-endpoint box "P-221".
- Connector "navigation:source-edge-05a50583f4d9a685a06cd396e2a3a7c6bed3edf7c620573328f44d1d2567bca8-0" segment 1 intersects non-endpoint box "P-222".
- Connector "navigation:source-edge-90e6a7c9bd6b601aae36440684a666f7ed86162be43debbf4db83413bccf5ec5-0" segment 0 intersects non-endpoint box "P-221".
- Connector "navigation:source-edge-b09a7ed8a62b206217a95920e2aede1e4320558a6a11e69dca19ab5868443f2f-0" segment 0 intersects non-endpoint box "P-221".
- Connector "navigation:source-edge-b09a7ed8a62b206217a95920e2aede1e4320558a6a11e69dca19ab5868443f2f-0" segment 0 intersects non-endpoint box "P-222".

Pass 2, remaining candidates 0, repairs 109.

| Accepted revision | Crossings, bends, expansion, displacement, length |
| --- | --- |
| `facing-flank-east-reverse:proposal-0` | 0, 12, 76, 190, 2692.5 |
| `facing-reverse:proposal-0` | 0, 14, 76, 155.5, 2512 |
| `facing-reverse:proposal-1` | 0, 14, 76, 155.5, 2544 |
| `facing-reverse:proposal-2` | 0, 14, 76, 155.5, 2544 |
| `facing-reverse:proposal-3` | 0, 14, 76, 155.5, 2576 |
| `east:proposal-0` | 2, 12, 76, 96, 2473 |
| `facing-flank-east-reverse:proposal-1` | 2, 12, 76, 190, 2692.5 |
| `facing-flank-east-reverse:proposal-2` | 2, 12, 76, 190, 2692.5 |
| `east:proposal-1` | 2, 14, 76, 96, 2473 |
| `east:proposal-2` | 2, 14, 76, 96, 2473 |
| `east:proposal-3` | 2, 14, 76, 96, 2473 |
| `east-reverse:proposal-0` | 3, 12, 76, 96, 2473 |
| `east-reverse:proposal-1` | 3, 12, 76, 96, 2473 |
| `east-reverse:proposal-2` | 3, 12, 76, 96, 2473 |
| `facing-flank-east:proposal-0` | 3, 12, 76, 144, 2482.5 |
| `facing-flank-east:proposal-1` | 3, 12, 76, 144, 2482.5 |
| `facing-flank-east:proposal-2` | 3, 12, 76, 144, 2482.5 |
| `facing-flank-east:proposal-3` | 3, 12, 76, 144, 2482.5 |
| `east-reverse:proposal-3` | 3, 12, 76, 96, 2505 |
| `facing-flank-east-reverse:proposal-3` | 4, 12, 76, 190, 2692.5 |

Rejected alternatives:

- `facing-flank-west-reverse:seed`: endpoint_envelope_exhausted.
- `facing-flank-west:seed`: endpoint_envelope_exhausted.
- `south-reverse:seed`: endpoint_envelope_exhausted.
- `north-reverse:seed`: candidate_exhausted.
- `north:seed`: candidate_exhausted.
- `east-flank-east-reverse:seed`: candidate_exhausted.
- `facing:seed`: candidate_exhausted.

Selected ordinary port groups (offsets and reservations in px):

| Node / side | Offsets | Reserved offsets | Signed group displacement |
| --- | --- | --- | --- |
| P-210 / south | 136 | none | 24 |
| P-220 / north | 88 | none | -24 |
| P-210 / east | 81 | none | 0 |
| P-230 / east | 56 | none | 0 |
| P-221 / north | 41 | none | -71 |
| P-220 / south | 89, 112, 135 | 24 | 0 |
| P-222 / north | 64 | none | -48 |
| P-230 / north | 135 | none | 23 |


## billsage.detailed.type-id

Selected best accepted cost: `facing-flank-east-reverse:proposal-0`: [0, 12, 76, 190, 2863.5].

Pass 0, remaining candidates 3024, repairs 120.

Rejected alternatives:

- `facing-flank-east-reverse:seed`: candidate_exhausted.
- `facing-flank-east:seed`: candidate_exhausted.
- `facing-flank-west-reverse:seed`: endpoint_envelope_exhausted.
- `facing-flank-west:seed`: endpoint_envelope_exhausted.
- `facing-reverse:seed`: candidate_exhausted.
- `east-reverse:seed`: endpoint_envelope_exhausted.
- `south-reverse:seed`: endpoint_envelope_exhausted.
- `north-reverse:seed`: candidate_exhausted.
- `north:seed`: candidate_exhausted.
- `east:seed`: endpoint_envelope_exhausted.
- `east-flank-east-reverse:seed`: endpoint_envelope_exhausted.
- `facing:seed`: candidate_exhausted.
- `west-reverse:seed`: candidate_exhausted.
- `west:seed`: candidate_exhausted.
- `south:seed`: endpoint_envelope_exhausted.
- `west-flank-west-reverse:seed`: endpoint_envelope_exhausted.
- `west-flank-west:seed`: endpoint_envelope_exhausted.
- `east-flank-east:seed`: endpoint_envelope_exhausted.

Pass 0.

- gaps: `P-210__follower_scope → P-220__group → P-230__group`; measured increment 2px.
- gaps: `P-210__group → P-210 → P-210__follower_scope`; measured increment 2px.
- padding: `A-200 → left`; measured increment 2px.
- Rejected revision: `west`.
- Connectors "navigation:source-edge-90e6a7c9bd6b601aae36440684a666f7ed86162be43debbf4db83413bccf5ec5-0" and "navigation:source-edge-b09a7ed8a62b206217a95920e2aede1e4320558a6a11e69dca19ab5868443f2f-0" have 315px of overlapping vertical span at 0px separation.
- Connector "navigation:source-edge-05a50583f4d9a685a06cd396e2a3a7c6bed3edf7c620573328f44d1d2567bca8-0" segment 0 violates the 17px clearance of node "P-220__contains__P-221__source-edge-1a4b74752f522d2bb8dc201b058b1224b58520f998f06fdcecf1fd9f55c3d249-0:end:marker".
- Connector "navigation:source-edge-05a50583f4d9a685a06cd396e2a3a7c6bed3edf7c620573328f44d1d2567bca8-0" segment 0 violates the 17px clearance of node "P-220__contains__P-222__source-edge-028d7ca5cdfce89e3d30d846a54c7e56ae61268f502f7c005097ff89c69e6dd9-0:end:marker".
- Connector "navigation:source-edge-05a50583f4d9a685a06cd396e2a3a7c6bed3edf7c620573328f44d1d2567bca8-0" segment 0 intersects non-endpoint box "P-220".
- Connector "navigation:source-edge-05a50583f4d9a685a06cd396e2a3a7c6bed3edf7c620573328f44d1d2567bca8-0" segment 0 intersects non-endpoint box "P-221".
- Connector "navigation:source-edge-05a50583f4d9a685a06cd396e2a3a7c6bed3edf7c620573328f44d1d2567bca8-0" segment 0 intersects non-endpoint box "P-222".

Pass 1, remaining candidates 1732, repairs 112.

Rejected alternatives:

- `facing-flank-east-reverse:seed`: candidate_exhausted.
- `facing-flank-east:seed`: candidate_exhausted.
- `facing-flank-west-reverse:seed`: endpoint_envelope_exhausted.
- `facing-flank-west:seed`: endpoint_envelope_exhausted.
- `facing-reverse:seed`: candidate_exhausted.
- `east-reverse:seed`: endpoint_envelope_exhausted.
- `south-reverse:seed`: endpoint_envelope_exhausted.
- `north-reverse:seed`: candidate_exhausted.
- `north:seed`: candidate_exhausted.
- `east:seed`: endpoint_envelope_exhausted.
- `east-flank-east-reverse:seed`: endpoint_envelope_exhausted.
- `facing:seed`: candidate_exhausted.
- `west-reverse:seed`: candidate_exhausted.
- `west:seed`: candidate_exhausted.
- `south:seed`: endpoint_envelope_exhausted.
- `west-flank-west-reverse:seed`: endpoint_envelope_exhausted.
- `west-flank-west:seed`: endpoint_envelope_exhausted.
- `east-flank-east:seed`: endpoint_envelope_exhausted.

Pass 1.

- gaps: `P-220__contains_scope_branch → P-221__group → P-222__group`; measured increment 2px.
- gaps: `P-220__group → P-220 → P-220__contains_scope_branch`; measured increment 18px.
- padding: `A-200 → right`; measured increment 50px.
- Rejected revision: `facing-flank-east`.
- Connector "navigation:source-edge-05a50583f4d9a685a06cd396e2a3a7c6bed3edf7c620573328f44d1d2567bca8-0" segment 1 intersects non-endpoint box "P-221".
- Connector "navigation:source-edge-05a50583f4d9a685a06cd396e2a3a7c6bed3edf7c620573328f44d1d2567bca8-0" segment 1 intersects non-endpoint box "P-222".
- Connector "navigation:source-edge-90e6a7c9bd6b601aae36440684a666f7ed86162be43debbf4db83413bccf5ec5-0" segment 0 intersects non-endpoint box "P-221".
- Connector "navigation:source-edge-b09a7ed8a62b206217a95920e2aede1e4320558a6a11e69dca19ab5868443f2f-0" segment 0 intersects non-endpoint box "P-221".
- Connector "navigation:source-edge-b09a7ed8a62b206217a95920e2aede1e4320558a6a11e69dca19ab5868443f2f-0" segment 0 intersects non-endpoint box "P-222".

Pass 2, remaining candidates 0, repairs 109.

| Accepted revision | Crossings, bends, expansion, displacement, length |
| --- | --- |
| `facing-flank-east-reverse:proposal-0` | 0, 12, 76, 190, 2863.5 |
| `facing-reverse:proposal-0` | 0, 14, 76, 155.5, 2664 |
| `facing-reverse:proposal-1` | 0, 14, 76, 155.5, 2696 |
| `facing-reverse:proposal-2` | 0, 14, 76, 155.5, 2696 |
| `facing-reverse:proposal-3` | 0, 14, 76, 155.5, 2728 |
| `east:proposal-0` | 2, 12, 76, 96, 2682 |
| `facing-flank-east-reverse:proposal-1` | 2, 12, 76, 190, 2863.5 |
| `facing-flank-east-reverse:proposal-2` | 2, 12, 76, 190, 2863.5 |
| `east:proposal-1` | 2, 14, 76, 96, 2682 |
| `east:proposal-2` | 2, 14, 76, 96, 2682 |
| `east:proposal-3` | 2, 14, 76, 96, 2682 |
| `facing-flank-east:proposal-0` | 3, 12, 76, 144, 2653.5 |
| `facing-flank-east:proposal-1` | 3, 12, 76, 144, 2653.5 |
| `facing-flank-east:proposal-2` | 3, 12, 76, 144, 2653.5 |
| `facing-flank-east:proposal-3` | 3, 12, 76, 144, 2653.5 |
| `east-reverse:proposal-0` | 3, 12, 76, 96, 2682 |
| `east-reverse:proposal-1` | 3, 12, 76, 96, 2682 |
| `east-reverse:proposal-2` | 3, 12, 76, 96, 2683 |
| `east-reverse:proposal-3` | 3, 12, 76, 96, 2683 |
| `facing-flank-east-reverse:proposal-3` | 4, 12, 76, 190, 2863.5 |

Rejected alternatives:

- `facing-flank-west-reverse:seed`: endpoint_envelope_exhausted.
- `facing-flank-west:seed`: endpoint_envelope_exhausted.
- `south-reverse:seed`: endpoint_envelope_exhausted.
- `north-reverse:seed`: candidate_exhausted.
- `north:seed`: candidate_exhausted.
- `east-flank-east-reverse:seed`: candidate_exhausted.

Selected ordinary port groups (offsets and reservations in px):

| Node / side | Offsets | Reserved offsets | Signed group displacement |
| --- | --- | --- | --- |
| P-210 / south | 136 | none | 24 |
| P-220 / north | 88 | none | -24 |
| P-210 / east | 90.5 | none | 0 |
| P-230 / east | 65.5 | none | 0 |
| P-221 / north | 41 | none | -71 |
| P-220 / south | 89, 112, 135 | 24 | 0 |
| P-222 / north | 64 | none | -48 |
| P-230 / north | 135 | none | 23 |


## billsage.detailed.type

Selected best accepted cost: `facing-flank-east-reverse:proposal-0`: [0, 12, 76, 190, 2863.5].

Pass 0, remaining candidates 3024, repairs 120.

Rejected alternatives:

- `facing-flank-east-reverse:seed`: candidate_exhausted.
- `facing-flank-east:seed`: candidate_exhausted.
- `facing-flank-west-reverse:seed`: endpoint_envelope_exhausted.
- `facing-flank-west:seed`: endpoint_envelope_exhausted.
- `facing-reverse:seed`: candidate_exhausted.
- `east-reverse:seed`: endpoint_envelope_exhausted.
- `south-reverse:seed`: endpoint_envelope_exhausted.
- `north-reverse:seed`: candidate_exhausted.
- `north:seed`: candidate_exhausted.
- `east:seed`: endpoint_envelope_exhausted.
- `east-flank-east-reverse:seed`: endpoint_envelope_exhausted.
- `facing:seed`: candidate_exhausted.
- `west-reverse:seed`: candidate_exhausted.
- `west:seed`: candidate_exhausted.
- `south:seed`: endpoint_envelope_exhausted.
- `west-flank-west-reverse:seed`: endpoint_envelope_exhausted.
- `west-flank-west:seed`: endpoint_envelope_exhausted.
- `east-flank-east:seed`: endpoint_envelope_exhausted.

Pass 0.

- gaps: `P-210__follower_scope → P-220__group → P-230__group`; measured increment 2px.
- gaps: `P-210__group → P-210 → P-210__follower_scope`; measured increment 2px.
- padding: `A-200 → left`; measured increment 2px.
- Rejected revision: `west`.
- Connectors "navigation:source-edge-90e6a7c9bd6b601aae36440684a666f7ed86162be43debbf4db83413bccf5ec5-0" and "navigation:source-edge-b09a7ed8a62b206217a95920e2aede1e4320558a6a11e69dca19ab5868443f2f-0" have 315px of overlapping vertical span at 0px separation.
- Connector "navigation:source-edge-05a50583f4d9a685a06cd396e2a3a7c6bed3edf7c620573328f44d1d2567bca8-0" segment 0 violates the 17px clearance of node "P-220__contains__P-221__source-edge-1a4b74752f522d2bb8dc201b058b1224b58520f998f06fdcecf1fd9f55c3d249-0:end:marker".
- Connector "navigation:source-edge-05a50583f4d9a685a06cd396e2a3a7c6bed3edf7c620573328f44d1d2567bca8-0" segment 0 violates the 17px clearance of node "P-220__contains__P-222__source-edge-028d7ca5cdfce89e3d30d846a54c7e56ae61268f502f7c005097ff89c69e6dd9-0:end:marker".
- Connector "navigation:source-edge-05a50583f4d9a685a06cd396e2a3a7c6bed3edf7c620573328f44d1d2567bca8-0" segment 0 intersects non-endpoint box "P-220".
- Connector "navigation:source-edge-05a50583f4d9a685a06cd396e2a3a7c6bed3edf7c620573328f44d1d2567bca8-0" segment 0 intersects non-endpoint box "P-221".
- Connector "navigation:source-edge-05a50583f4d9a685a06cd396e2a3a7c6bed3edf7c620573328f44d1d2567bca8-0" segment 0 intersects non-endpoint box "P-222".

Pass 1, remaining candidates 1732, repairs 112.

Rejected alternatives:

- `facing-flank-east-reverse:seed`: candidate_exhausted.
- `facing-flank-east:seed`: candidate_exhausted.
- `facing-flank-west-reverse:seed`: endpoint_envelope_exhausted.
- `facing-flank-west:seed`: endpoint_envelope_exhausted.
- `facing-reverse:seed`: candidate_exhausted.
- `east-reverse:seed`: endpoint_envelope_exhausted.
- `south-reverse:seed`: endpoint_envelope_exhausted.
- `north-reverse:seed`: candidate_exhausted.
- `north:seed`: candidate_exhausted.
- `east:seed`: endpoint_envelope_exhausted.
- `east-flank-east-reverse:seed`: endpoint_envelope_exhausted.
- `facing:seed`: candidate_exhausted.
- `west-reverse:seed`: candidate_exhausted.
- `west:seed`: candidate_exhausted.
- `south:seed`: endpoint_envelope_exhausted.
- `west-flank-west-reverse:seed`: endpoint_envelope_exhausted.
- `west-flank-west:seed`: endpoint_envelope_exhausted.
- `east-flank-east:seed`: endpoint_envelope_exhausted.

Pass 1.

- gaps: `P-220__contains_scope_branch → P-221__group → P-222__group`; measured increment 2px.
- gaps: `P-220__group → P-220 → P-220__contains_scope_branch`; measured increment 18px.
- padding: `A-200 → right`; measured increment 50px.
- Rejected revision: `facing-flank-east`.
- Connector "navigation:source-edge-05a50583f4d9a685a06cd396e2a3a7c6bed3edf7c620573328f44d1d2567bca8-0" segment 1 intersects non-endpoint box "P-221".
- Connector "navigation:source-edge-05a50583f4d9a685a06cd396e2a3a7c6bed3edf7c620573328f44d1d2567bca8-0" segment 1 intersects non-endpoint box "P-222".
- Connector "navigation:source-edge-90e6a7c9bd6b601aae36440684a666f7ed86162be43debbf4db83413bccf5ec5-0" segment 0 intersects non-endpoint box "P-221".
- Connector "navigation:source-edge-b09a7ed8a62b206217a95920e2aede1e4320558a6a11e69dca19ab5868443f2f-0" segment 0 intersects non-endpoint box "P-221".
- Connector "navigation:source-edge-b09a7ed8a62b206217a95920e2aede1e4320558a6a11e69dca19ab5868443f2f-0" segment 0 intersects non-endpoint box "P-222".

Pass 2, remaining candidates 0, repairs 109.

| Accepted revision | Crossings, bends, expansion, displacement, length |
| --- | --- |
| `facing-flank-east-reverse:proposal-0` | 0, 12, 76, 190, 2863.5 |
| `facing-reverse:proposal-0` | 0, 14, 76, 155.5, 2664 |
| `facing-reverse:proposal-1` | 0, 14, 76, 155.5, 2696 |
| `facing-reverse:proposal-2` | 0, 14, 76, 155.5, 2696 |
| `facing-reverse:proposal-3` | 0, 14, 76, 155.5, 2728 |
| `east:proposal-0` | 2, 12, 76, 96, 2682 |
| `facing-flank-east-reverse:proposal-1` | 2, 12, 76, 190, 2863.5 |
| `facing-flank-east-reverse:proposal-2` | 2, 12, 76, 190, 2863.5 |
| `east:proposal-1` | 2, 14, 76, 96, 2682 |
| `east:proposal-2` | 2, 14, 76, 96, 2682 |
| `east:proposal-3` | 2, 14, 76, 96, 2682 |
| `facing-flank-east:proposal-0` | 3, 12, 76, 144, 2653.5 |
| `facing-flank-east:proposal-1` | 3, 12, 76, 144, 2653.5 |
| `facing-flank-east:proposal-2` | 3, 12, 76, 144, 2653.5 |
| `facing-flank-east:proposal-3` | 3, 12, 76, 144, 2653.5 |
| `east-reverse:proposal-0` | 3, 12, 76, 96, 2682 |
| `east-reverse:proposal-1` | 3, 12, 76, 96, 2682 |
| `east-reverse:proposal-2` | 3, 12, 76, 96, 2683 |
| `east-reverse:proposal-3` | 3, 12, 76, 96, 2683 |
| `facing-flank-east-reverse:proposal-3` | 4, 12, 76, 190, 2863.5 |

Rejected alternatives:

- `facing-flank-west-reverse:seed`: endpoint_envelope_exhausted.
- `facing-flank-west:seed`: endpoint_envelope_exhausted.
- `south-reverse:seed`: endpoint_envelope_exhausted.
- `north-reverse:seed`: candidate_exhausted.
- `north:seed`: candidate_exhausted.
- `east-flank-east-reverse:seed`: candidate_exhausted.

Selected ordinary port groups (offsets and reservations in px):

| Node / side | Offsets | Reserved offsets | Signed group displacement |
| --- | --- | --- | --- |
| P-210 / south | 136 | none | 24 |
| P-220 / north | 88 | none | -24 |
| P-210 / east | 90.5 | none | 0 |
| P-230 / east | 65.5 | none | 0 |
| P-221 / north | 41 | none | -71 |
| P-220 / south | 89, 112, 135 | 24 | 0 |
| P-222 / north | 64 | none | -48 |
| P-230 / north | 135 | none | 23 |


## multiple-incoming.compact

Selected best accepted cost: `south:accepted-probe-0`: [1, 6, 349.664, 0, 1574.964].

Pass 0, remaining candidates 4096, repairs 128.

- gaps: `root → A-001 → A-002`; measured increment 146.988px.

Pass 1, remaining candidates 3940, repairs 128.

Rejected alternatives:

- `facing:seed`: endpoint_envelope_exhausted.
- `south:seed`: endpoint_envelope_exhausted.

Pass 1.

- gaps: `P-002__group → P-002 → P-002__contains_scope_single`; measured increment 2px.
- padding: `A-002 → right`; measured increment 18px.
- Rejected revision: `south`.
- Route leaves the adapter's finite routing bounds.
- Connector "navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0" segment 0 violates the 17px clearance of node "P-003".
- Connector "navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0" segment 1 violates the 17px clearance of node "A-001:border-y:144".
- Connector "navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0" segment 1 violates the 17px clearance of node "P-002__contains__P-003__source-edge-1f8db5d5f8d95f599ca2c955802b8d7239b0b5bd927abb4029118224e933aee4-0:end:marker".
- Connector "navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0" segment 1 violates the 17px clearance of node "P-003".
- Connector "navigation:source-edge-471ad453128831b4b4f84d5194a662327235306c6d3a52cc9d8ae6249d0953bf-0" segment 1 violates the 17px clearance of node "A-002:border-x:730.988".
- Label finding: {"connectorId":"navigation:source-edge-9f1a76814241a1fff97051c5256c169812fb4700e576605d7d0f22c5539249f1-0","kind":"ambiguous","obstacleId":"navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0"}.
- Label finding: {"connectorId":"navigation:source-edge-9f1a76814241a1fff97051c5256c169812fb4700e576605d7d0f22c5539249f1-0","kind":"connector","obstacleId":"navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0"}.
- Label finding: {"connectorId":"navigation:source-edge-471ad453128831b4b4f84d5194a662327235306c6d3a52cc9d8ae6249d0953bf-0","kind":"bounds"}.

Pass 2, remaining candidates 3596, repairs 127.

Rejected alternatives:

- `south:proposal-0`: scene_rejected.
- `facing:seed`: candidate_exhausted.

Pass 2.

- padding: `A-002 → right`; measured increment 182.676px.
- Rejected revision: `south`.
- Label finding: {"connectorId":"navigation:source-edge-471ad453128831b4b4f84d5194a662327235306c6d3a52cc9d8ae6249d0953bf-0","kind":"bounds"}.
- Label finding: {"connectorId":"navigation:source-edge-471ad453128831b4b4f84d5194a662327235306c6d3a52cc9d8ae6249d0953bf-0","kind":"ambiguous","obstacleId":"navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0"}.
- Label finding: {"connectorId":"navigation:source-edge-471ad453128831b4b4f84d5194a662327235306c6d3a52cc9d8ae6249d0953bf-0","kind":"connector","obstacleId":"navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0"}.

Pass 3, remaining candidates 2677, repairs 126.

| Accepted revision | Crossings, bends, expansion, displacement, length |
| --- | --- |
| `south:accepted-probe-0` | 1, 6, 349.664, 0, 1574.964 |
| `south:accepted-probe-1` | 1, 8, 349.664, 0, 1583.964 |
| `south:accepted-probe-2` | 1, 8, 349.664, 0, 1588.964 |
| `south:accepted-probe-3` | 1, 8, 349.664, 0, 1574.964 |
| `south:accepted-probe-4` | 1, 8, 349.664, 0, 1628.964 |
| `south:proposal-0` | 1, 6, 349.664, 0, 1574.964 |
| `south:proposal-1` | 1, 8, 349.664, 0, 1574.964 |
| `south:proposal-2` | 1, 8, 349.664, 0, 1583.964 |
| `south:proposal-3` | 1, 8, 349.664, 0, 1588.964 |

Rejected alternatives:

- `facing:seed`: candidate_exhausted.

Pass 3.

- padding: `A-002 → top`; measured increment 18px.
- padding: `A-001 → top`; measured increment 18px.
- Rejected revision: `facing`.
- Connector "navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0" segment 0 intersects non-endpoint box "A-002:header-band".
- Connector "navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0" segment 2 intersects non-endpoint box "A-001:header-band".

Pass 4, remaining candidates 1447, repairs 126.

| Accepted revision | Crossings, bends, expansion, displacement, length |
| --- | --- |
| `south:accepted-probe-0` | 1, 6, 385.664, 0, 1574.964 |
| `south:accepted-probe-1` | 1, 8, 385.664, 0, 1583.964 |
| `south:accepted-probe-2` | 1, 8, 385.664, 0, 1596.964 |
| `south:accepted-probe-3` | 1, 8, 385.664, 0, 1574.964 |
| `south:accepted-probe-4` | 1, 8, 385.664, 0, 1636.964 |
| `south:proposal-0` | 1, 6, 385.664, 0, 1574.964 |
| `south:proposal-1` | 1, 8, 385.664, 0, 1574.964 |
| `south:proposal-2` | 1, 8, 385.664, 0, 1583.964 |
| `south:proposal-3` | 1, 8, 385.664, 0, 1596.964 |

Rejected alternatives:

- `facing:proposal-0`: scene_rejected.
- `facing:seed`: scene_rejected.
- `facing:proposal-1`: scene_rejected.
- `facing:proposal-2`: scene_rejected.
- `facing:proposal-3`: scene_rejected.

Selected ordinary port groups (offsets and reservations in px):

| Node / side | Offsets | Reserved offsets | Signed group displacement |
| --- | --- | --- | --- |
| P-001 / east | 12.5, 35.5 | none | 0 |
| P-002 / west | 12.5, 35.5 | none | 0 |
| P-002 / south | 112 | 24 | 0 |
| P-001 / south | 112 | none | 0 |
| P-003 / east | 24 | none | 0 |
| P-002 / east | 24 | none | 0 |


## multiple-incoming.detailed

Selected best accepted cost: `south:accepted-probe-0`: [1, 6, 333.664, 0, 1724.964].

Pass 0, remaining candidates 4096, repairs 128.

- gaps: `root → A-001 → A-002`; measured increment 146.988px.

Pass 1, remaining candidates 3865, repairs 128.

Rejected alternatives:

- `facing:seed`: endpoint_envelope_exhausted.
- `north:seed`: endpoint_envelope_exhausted.
- `west-reverse:seed`: endpoint_envelope_exhausted.
- `east-reverse:seed`: endpoint_envelope_exhausted.
- `east:seed`: endpoint_envelope_exhausted.
- `south:seed`: endpoint_envelope_exhausted.
- `west:seed`: endpoint_envelope_exhausted.

Pass 1.

- padding: `A-002 → right`; measured increment 18px.
- Rejected revision: `east`.
- Route leaves the adapter's finite routing bounds.
- Connectors "navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0" and "navigation:source-edge-471ad453128831b4b4f84d5194a662327235306c6d3a52cc9d8ae6249d0953bf-0" have 11.5px of overlapping vertical span at 0px separation.
- Connector "navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0" segment 1 violates the 17px clearance of node "A-002:border-x:730.988".
- Connector "navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0" segment 2 violates the 17px clearance of node "navigation:source-edge-9f1a76814241a1fff97051c5256c169812fb4700e576605d7d0f22c5539249f1-0:end:marker".
- Connector "navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0" segment 2 violates the 17px clearance of node "P-002".
- Connector "navigation:source-edge-471ad453128831b4b4f84d5194a662327235306c6d3a52cc9d8ae6249d0953bf-0" segment 1 violates the 17px clearance of node "A-002:border-x:730.988".
- Connectors "navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0" and "navigation:source-edge-9f1a76814241a1fff97051c5256c169812fb4700e576605d7d0f22c5539249f1-0" have 113.494px of overlapping horizontal span at 11.5px separation.
- Connector "navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0" segment 2 intersects non-endpoint box "P-002".
- Label finding: {"connectorId":"navigation:source-edge-9f1a76814241a1fff97051c5256c169812fb4700e576605d7d0f22c5539249f1-0","kind":"ambiguous","obstacleId":"navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0"}.
- Label finding: {"connectorId":"navigation:source-edge-9f1a76814241a1fff97051c5256c169812fb4700e576605d7d0f22c5539249f1-0","kind":"connector","obstacleId":"navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0"}.
- Label finding: {"connectorId":"navigation:source-edge-471ad453128831b4b4f84d5194a662327235306c6d3a52cc9d8ae6249d0953bf-0","kind":"bounds"}.

Pass 2, remaining candidates 2650, repairs 124.

Rejected alternatives:

- `facing:proposal-0`: scene_rejected.
- `facing:seed`: scene_rejected.
- `north:seed`: candidate_exhausted.
- `west-reverse:seed`: endpoint_envelope_exhausted.
- `east-reverse:seed`: candidate_exhausted.
- `east:seed`: scene_rejected.
- `south:seed`: candidate_exhausted.
- `west:seed`: endpoint_envelope_exhausted.

Pass 2.

- gaps: `P-002__group → P-002 → P-002__contains_scope_single`; measured increment 2px.
- Rejected revision: `south`.
- Connector "navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0" segment 0 intersects non-endpoint box "P-003".
- Label finding: {"connectorId":"navigation:source-edge-471ad453128831b4b4f84d5194a662327235306c6d3a52cc9d8ae6249d0953bf-0","kind":"bounds"}.

Pass 3, remaining candidates 1473, repairs 121.

Rejected alternatives:

- `south:proposal-0`: scene_rejected.
- `facing:proposal-0`: scene_rejected.
- `facing:seed`: scene_rejected.
- `north:seed`: candidate_exhausted.
- `west-reverse:seed`: endpoint_envelope_exhausted.
- `east-reverse:seed`: candidate_exhausted.
- `east:seed`: scene_rejected.
- `west:seed`: endpoint_envelope_exhausted.

Pass 3.

- padding: `A-002 → right`; measured increment 166.676px.
- Rejected revision: `south`.
- Label finding: {"connectorId":"navigation:source-edge-471ad453128831b4b4f84d5194a662327235306c6d3a52cc9d8ae6249d0953bf-0","kind":"bounds"}.

Pass 4, remaining candidates 240, repairs 120.

| Accepted revision | Crossings, bends, expansion, displacement, length |
| --- | --- |
| `south:accepted-probe-0` | 1, 6, 333.664, 0, 1724.964 |
| `south:accepted-probe-1` | 1, 6, 333.664, 0, 1744.964 |
| `south:accepted-probe-2` | 1, 8, 333.664, 0, 1796.964 |
| `south:proposal-0` | 1, 6, 333.664, 0, 1724.964 |
| `south:proposal-1` | 1, 6, 333.664, 0, 1744.964 |
| `south:proposal-2` | 1, 8, 333.664, 0, 1796.964 |

Rejected alternatives:

- `south:proposal-3`: scene_rejected.
- `facing:proposal-0`: scene_rejected.
- `facing:seed`: scene_rejected.
- `facing:proposal-1`: scene_rejected.
- `facing:proposal-2`: scene_rejected.
- `facing:proposal-3`: scene_rejected.
- `north:seed`: candidate_exhausted.

Pass 4.

- padding: `A-002 → right`; measured increment 16.000000000000057px.
- Rejected revision: `south`.
- Label finding: {"connectorId":"navigation:source-edge-471ad453128831b4b4f84d5194a662327235306c6d3a52cc9d8ae6249d0953bf-0","kind":"bounds"}.

Selected ordinary port groups (offsets and reservations in px):

| Node / side | Offsets | Reserved offsets | Signed group displacement |
| --- | --- | --- | --- |
| P-001 / east | 37.5, 60.5 | none | 0 |
| P-002 / west | 37.5, 60.5 | none | 0 |
| P-002 / south | 112 | 24 | 0 |
| P-001 / south | 112 | none | 0 |
| P-003 / east | 49 | none | 0 |
| P-002 / east | 49 | none | 0 |


## parallel.compact.DG-001

Selected best accepted cost: `south:accepted-probe-0`: [0, 4, 148.988, 0, 1458.964].

Pass 0, remaining candidates 4096, repairs 128.

- gaps: `root → A-001 → A-002`; measured increment 146.988px.

Pass 1, remaining candidates 3851, repairs 126.

Rejected alternatives:

- `facing:seed`: candidate_exhausted.
- `south:seed`: candidate_exhausted.

Pass 1.

- gaps: `P-002__group → P-002 → P-002__contains_scope_single`; measured increment 2px.
- Rejected revision: `south`.
- Connector "navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0" segment 0 intersects non-endpoint box "P-003".

Pass 2, remaining candidates 3739, repairs 125.

| Accepted revision | Crossings, bends, expansion, displacement, length |
| --- | --- |
| `south:accepted-probe-0` | 0, 4, 148.988, 0, 1458.964 |
| `south:proposal-0` | 0, 4, 148.988, 0, 1458.964 |

Rejected alternatives:

- `facing:seed`: candidate_exhausted.

Selected ordinary port groups (offsets and reservations in px):

| Node / side | Offsets | Reserved offsets | Signed group displacement |
| --- | --- | --- | --- |
| P-001 / east | 12.5, 35.5 | none | 0 |
| P-002 / west | 12.5, 35.5 | none | 0 |
| P-002 / south | 112 | 24 | 0 |
| P-001 / south | 112 | none | 0 |


## parallel.compact.DG-002

Selected best accepted cost: `facing:accepted-probe-0`: [0, 0, 131.676, 0, 211.676].

Pass 0, remaining candidates 4096, repairs 128.

- gaps: `root → A-001 → A-002`; measured increment 131.676px.

Pass 1, remaining candidates 4092, repairs 128.

| Accepted revision | Crossings, bends, expansion, displacement, length |
| --- | --- |
| `facing:accepted-probe-0` | 0, 0, 131.676, 0, 211.676 |
| `facing:proposal-0` | 0, 0, 131.676, 0, 211.676 |
| `facing:seed` | 0, 0, 131.676, 0, 211.676 |

Selected ordinary port groups (offsets and reservations in px):

| Node / side | Offsets | Reserved offsets | Signed group displacement |
| --- | --- | --- | --- |
| P-001 / east | 24 | none | 0 |
| P-002 / west | 24 | none | 0 |


## parallel.compact.DG-003

Selected best accepted cost: `facing:accepted-probe-0`: [0, 0, 146.988, 0, 226.988].

Pass 0, remaining candidates 4096, repairs 128.

- gaps: `root → A-001 → A-002`; measured increment 146.988px.

Pass 1, remaining candidates 4092, repairs 128.

| Accepted revision | Crossings, bends, expansion, displacement, length |
| --- | --- |
| `facing:accepted-probe-0` | 0, 0, 146.988, 0, 226.988 |
| `facing:proposal-0` | 0, 0, 146.988, 0, 226.988 |
| `facing:seed` | 0, 0, 146.988, 0, 226.988 |

Selected ordinary port groups (offsets and reservations in px):

| Node / side | Offsets | Reserved offsets | Signed group displacement |
| --- | --- | --- | --- |
| P-001 / east | 24 | none | 0 |
| P-002 / west | 24 | none | 0 |


## parallel.compact.id

Selected best accepted cost: `south:accepted-probe-0`: [0, 4, 148.988, 0, 1468.964].

Pass 0, remaining candidates 4096, repairs 128.

- gaps: `root → A-001 → A-002`; measured increment 146.988px.

Pass 1, remaining candidates 3855, repairs 126.

Rejected alternatives:

- `facing:seed`: candidate_exhausted.
- `south:seed`: candidate_exhausted.

Pass 1.

- gaps: `P-002__group → P-002 → P-002__contains_scope_single`; measured increment 2px.
- Rejected revision: `south`.
- Connector "navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0" segment 0 intersects non-endpoint box "P-003".

Pass 2, remaining candidates 3745, repairs 125.

| Accepted revision | Crossings, bends, expansion, displacement, length |
| --- | --- |
| `south:accepted-probe-0` | 0, 4, 148.988, 0, 1468.964 |
| `south:proposal-0` | 0, 4, 148.988, 0, 1468.964 |

Rejected alternatives:

- `facing:seed`: candidate_exhausted.

Selected ordinary port groups (offsets and reservations in px):

| Node / side | Offsets | Reserved offsets | Signed group displacement |
| --- | --- | --- | --- |
| P-001 / east | 15, 38 | none | 0 |
| P-002 / west | 15, 38 | none | 0 |
| P-002 / south | 112 | 24 | 0 |
| P-001 / south | 112 | none | 0 |


## parallel.compact

Selected best accepted cost: `south:accepted-probe-0`: [0, 4, 148.988, 0, 1458.964].

Pass 0, remaining candidates 4096, repairs 128.

- gaps: `root → A-001 → A-002`; measured increment 146.988px.

Pass 1, remaining candidates 3851, repairs 126.

Rejected alternatives:

- `facing:seed`: candidate_exhausted.
- `south:seed`: candidate_exhausted.

Pass 1.

- gaps: `P-002__group → P-002 → P-002__contains_scope_single`; measured increment 2px.
- Rejected revision: `south`.
- Connector "navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0" segment 0 intersects non-endpoint box "P-003".

Pass 2, remaining candidates 3739, repairs 125.

| Accepted revision | Crossings, bends, expansion, displacement, length |
| --- | --- |
| `south:accepted-probe-0` | 0, 4, 148.988, 0, 1458.964 |
| `south:proposal-0` | 0, 4, 148.988, 0, 1458.964 |

Rejected alternatives:

- `facing:seed`: candidate_exhausted.

Selected ordinary port groups (offsets and reservations in px):

| Node / side | Offsets | Reserved offsets | Signed group displacement |
| --- | --- | --- | --- |
| P-001 / east | 12.5, 35.5 | none | 0 |
| P-002 / west | 12.5, 35.5 | none | 0 |
| P-002 / south | 112 | 24 | 0 |
| P-001 / south | 112 | none | 0 |


## parallel.compact.type-id

Selected best accepted cost: `south:accepted-probe-0`: [0, 4, 148.988, 0, 1468.964].

Pass 0, remaining candidates 4096, repairs 128.

- gaps: `root → A-001 → A-002`; measured increment 146.988px.

Pass 1, remaining candidates 3855, repairs 126.

Rejected alternatives:

- `facing:seed`: candidate_exhausted.
- `south:seed`: candidate_exhausted.

Pass 1.

- gaps: `P-002__group → P-002 → P-002__contains_scope_single`; measured increment 2px.
- Rejected revision: `south`.
- Connector "navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0" segment 0 intersects non-endpoint box "P-003".

Pass 2, remaining candidates 3745, repairs 125.

| Accepted revision | Crossings, bends, expansion, displacement, length |
| --- | --- |
| `south:accepted-probe-0` | 0, 4, 148.988, 0, 1468.964 |
| `south:proposal-0` | 0, 4, 148.988, 0, 1468.964 |

Rejected alternatives:

- `facing:seed`: candidate_exhausted.

Selected ordinary port groups (offsets and reservations in px):

| Node / side | Offsets | Reserved offsets | Signed group displacement |
| --- | --- | --- | --- |
| P-001 / east | 15, 38 | none | 0 |
| P-002 / west | 15, 38 | none | 0 |
| P-002 / south | 112 | 24 | 0 |
| P-001 / south | 112 | none | 0 |


## parallel.compact.type

Selected best accepted cost: `south:accepted-probe-0`: [0, 4, 148.988, 0, 1468.964].

Pass 0, remaining candidates 4096, repairs 128.

- gaps: `root → A-001 → A-002`; measured increment 146.988px.

Pass 1, remaining candidates 3855, repairs 126.

Rejected alternatives:

- `facing:seed`: candidate_exhausted.
- `south:seed`: candidate_exhausted.

Pass 1.

- gaps: `P-002__group → P-002 → P-002__contains_scope_single`; measured increment 2px.
- Rejected revision: `south`.
- Connector "navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0" segment 0 intersects non-endpoint box "P-003".

Pass 2, remaining candidates 3745, repairs 125.

| Accepted revision | Crossings, bends, expansion, displacement, length |
| --- | --- |
| `south:accepted-probe-0` | 0, 4, 148.988, 0, 1468.964 |
| `south:proposal-0` | 0, 4, 148.988, 0, 1468.964 |

Rejected alternatives:

- `facing:seed`: candidate_exhausted.

Selected ordinary port groups (offsets and reservations in px):

| Node / side | Offsets | Reserved offsets | Signed group displacement |
| --- | --- | --- | --- |
| P-001 / east | 15, 38 | none | 0 |
| P-002 / west | 15, 38 | none | 0 |
| P-002 / south | 112 | 24 | 0 |
| P-001 / south | 112 | none | 0 |


## parallel.detailed.DG-001

Selected best accepted cost: `south:accepted-probe-0`: [0, 4, 148.988, 0, 1558.964].

Pass 0, remaining candidates 4096, repairs 128.

- gaps: `root → A-001 → A-002`; measured increment 146.988px.

Pass 1, remaining candidates 3240, repairs 124.

Rejected alternatives:

- `facing:proposal-0`: scene_rejected.
- `facing:seed`: scene_rejected.
- `north:seed`: candidate_exhausted.
- `east:seed`: candidate_exhausted.
- `west:seed`: candidate_exhausted.
- `south:seed`: candidate_exhausted.

Pass 1.

- gaps: `P-002__group → P-002 → P-002__contains_scope_single`; measured increment 2px.
- Rejected revision: `south`.
- Connector "navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0" segment 0 intersects non-endpoint box "P-003".

Pass 2, remaining candidates 3132, repairs 123.

| Accepted revision | Crossings, bends, expansion, displacement, length |
| --- | --- |
| `south:accepted-probe-0` | 0, 4, 148.988, 0, 1558.964 |
| `south:proposal-0` | 0, 4, 148.988, 0, 1558.964 |

Rejected alternatives:

- `facing:proposal-0`: scene_rejected.
- `facing:seed`: scene_rejected.
- `north:seed`: candidate_exhausted.

Selected ordinary port groups (offsets and reservations in px):

| Node / side | Offsets | Reserved offsets | Signed group displacement |
| --- | --- | --- | --- |
| P-001 / east | 37.5, 60.5 | none | 0 |
| P-002 / west | 37.5, 60.5 | none | 0 |
| P-002 / south | 112 | 24 | 0 |
| P-001 / south | 112 | none | 0 |


## parallel.detailed.DG-002

Selected best accepted cost: `facing:accepted-probe-0`: [0, 0, 131.676, 0, 211.676].

Pass 0, remaining candidates 4096, repairs 128.

- gaps: `root → A-001 → A-002`; measured increment 131.676px.

Pass 1, remaining candidates 4092, repairs 128.

| Accepted revision | Crossings, bends, expansion, displacement, length |
| --- | --- |
| `facing:accepted-probe-0` | 0, 0, 131.676, 0, 211.676 |
| `facing:proposal-0` | 0, 0, 131.676, 0, 211.676 |
| `facing:seed` | 0, 0, 131.676, 0, 211.676 |

Selected ordinary port groups (offsets and reservations in px):

| Node / side | Offsets | Reserved offsets | Signed group displacement |
| --- | --- | --- | --- |
| P-001 / east | 49 | none | 0 |
| P-002 / west | 49 | none | 0 |


## parallel.detailed.DG-003

Selected best accepted cost: `facing:accepted-probe-0`: [0, 0, 146.988, 0, 226.988].

Pass 0, remaining candidates 4096, repairs 128.

- gaps: `root → A-001 → A-002`; measured increment 146.988px.

Pass 1, remaining candidates 4092, repairs 128.

| Accepted revision | Crossings, bends, expansion, displacement, length |
| --- | --- |
| `facing:accepted-probe-0` | 0, 0, 146.988, 0, 226.988 |
| `facing:proposal-0` | 0, 0, 146.988, 0, 226.988 |
| `facing:seed` | 0, 0, 146.988, 0, 226.988 |

Selected ordinary port groups (offsets and reservations in px):

| Node / side | Offsets | Reserved offsets | Signed group displacement |
| --- | --- | --- | --- |
| P-001 / east | 49 | none | 0 |
| P-002 / west | 49 | none | 0 |


## parallel.detailed.id

Selected best accepted cost: `south:accepted-probe-0`: [0, 4, 148.988, 0, 1596.964].

Pass 0, remaining candidates 4096, repairs 128.

- gaps: `root → A-001 → A-002`; measured increment 146.988px.

Pass 1, remaining candidates 3240, repairs 124.

Rejected alternatives:

- `facing:proposal-0`: scene_rejected.
- `facing:seed`: scene_rejected.
- `north:seed`: candidate_exhausted.
- `east:seed`: candidate_exhausted.
- `west:seed`: candidate_exhausted.
- `south:seed`: candidate_exhausted.

Pass 1.

- gaps: `P-002__group → P-002 → P-002__contains_scope_single`; measured increment 2px.
- Rejected revision: `south`.
- Connector "navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0" segment 0 intersects non-endpoint box "P-003".

Pass 2, remaining candidates 3132, repairs 123.

| Accepted revision | Crossings, bends, expansion, displacement, length |
| --- | --- |
| `south:accepted-probe-0` | 0, 4, 148.988, 0, 1596.964 |
| `south:proposal-0` | 0, 4, 148.988, 0, 1596.964 |

Rejected alternatives:

- `facing:proposal-0`: scene_rejected.
- `facing:seed`: scene_rejected.
- `north:seed`: candidate_exhausted.

Selected ordinary port groups (offsets and reservations in px):

| Node / side | Offsets | Reserved offsets | Signed group displacement |
| --- | --- | --- | --- |
| P-001 / east | 47, 70 | none | 0 |
| P-002 / west | 47, 70 | none | 0 |
| P-002 / south | 112 | 24 | 0 |
| P-001 / south | 112 | none | 0 |


## parallel.detailed

Selected best accepted cost: `south:accepted-probe-0`: [0, 4, 148.988, 0, 1558.964].

Pass 0, remaining candidates 4096, repairs 128.

- gaps: `root → A-001 → A-002`; measured increment 146.988px.

Pass 1, remaining candidates 3240, repairs 124.

Rejected alternatives:

- `facing:proposal-0`: scene_rejected.
- `facing:seed`: scene_rejected.
- `north:seed`: candidate_exhausted.
- `east:seed`: candidate_exhausted.
- `west:seed`: candidate_exhausted.
- `south:seed`: candidate_exhausted.

Pass 1.

- gaps: `P-002__group → P-002 → P-002__contains_scope_single`; measured increment 2px.
- Rejected revision: `south`.
- Connector "navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0" segment 0 intersects non-endpoint box "P-003".

Pass 2, remaining candidates 3132, repairs 123.

| Accepted revision | Crossings, bends, expansion, displacement, length |
| --- | --- |
| `south:accepted-probe-0` | 0, 4, 148.988, 0, 1558.964 |
| `south:proposal-0` | 0, 4, 148.988, 0, 1558.964 |

Rejected alternatives:

- `facing:proposal-0`: scene_rejected.
- `facing:seed`: scene_rejected.
- `north:seed`: candidate_exhausted.

Selected ordinary port groups (offsets and reservations in px):

| Node / side | Offsets | Reserved offsets | Signed group displacement |
| --- | --- | --- | --- |
| P-001 / east | 37.5, 60.5 | none | 0 |
| P-002 / west | 37.5, 60.5 | none | 0 |
| P-002 / south | 112 | 24 | 0 |
| P-001 / south | 112 | none | 0 |


## parallel.detailed.type-id

Selected best accepted cost: `south:accepted-probe-0`: [0, 4, 148.988, 0, 1596.964].

Pass 0, remaining candidates 4096, repairs 128.

- gaps: `root → A-001 → A-002`; measured increment 146.988px.

Pass 1, remaining candidates 3240, repairs 124.

Rejected alternatives:

- `facing:proposal-0`: scene_rejected.
- `facing:seed`: scene_rejected.
- `north:seed`: candidate_exhausted.
- `east:seed`: candidate_exhausted.
- `west:seed`: candidate_exhausted.
- `south:seed`: candidate_exhausted.

Pass 1.

- gaps: `P-002__group → P-002 → P-002__contains_scope_single`; measured increment 2px.
- Rejected revision: `south`.
- Connector "navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0" segment 0 intersects non-endpoint box "P-003".

Pass 2, remaining candidates 3132, repairs 123.

| Accepted revision | Crossings, bends, expansion, displacement, length |
| --- | --- |
| `south:accepted-probe-0` | 0, 4, 148.988, 0, 1596.964 |
| `south:proposal-0` | 0, 4, 148.988, 0, 1596.964 |

Rejected alternatives:

- `facing:proposal-0`: scene_rejected.
- `facing:seed`: scene_rejected.
- `north:seed`: candidate_exhausted.

Selected ordinary port groups (offsets and reservations in px):

| Node / side | Offsets | Reserved offsets | Signed group displacement |
| --- | --- | --- | --- |
| P-001 / east | 47, 70 | none | 0 |
| P-002 / west | 47, 70 | none | 0 |
| P-002 / south | 112 | 24 | 0 |
| P-001 / south | 112 | none | 0 |


## parallel.detailed.type

Selected best accepted cost: `south:accepted-probe-0`: [0, 4, 148.988, 0, 1596.964].

Pass 0, remaining candidates 4096, repairs 128.

- gaps: `root → A-001 → A-002`; measured increment 146.988px.

Pass 1, remaining candidates 3240, repairs 124.

Rejected alternatives:

- `facing:proposal-0`: scene_rejected.
- `facing:seed`: scene_rejected.
- `north:seed`: candidate_exhausted.
- `east:seed`: candidate_exhausted.
- `west:seed`: candidate_exhausted.
- `south:seed`: candidate_exhausted.

Pass 1.

- gaps: `P-002__group → P-002 → P-002__contains_scope_single`; measured increment 2px.
- Rejected revision: `south`.
- Connector "navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0" segment 0 intersects non-endpoint box "P-003".

Pass 2, remaining candidates 3132, repairs 123.

| Accepted revision | Crossings, bends, expansion, displacement, length |
| --- | --- |
| `south:accepted-probe-0` | 0, 4, 148.988, 0, 1596.964 |
| `south:proposal-0` | 0, 4, 148.988, 0, 1596.964 |

Rejected alternatives:

- `facing:proposal-0`: scene_rejected.
- `facing:seed`: scene_rejected.
- `north:seed`: candidate_exhausted.

Selected ordinary port groups (offsets and reservations in px):

| Node / side | Offsets | Reserved offsets | Signed group displacement |
| --- | --- | --- | --- |
| P-001 / east | 47, 70 | none | 0 |
| P-002 / west | 47, 70 | none | 0 |
| P-002 / south | 112 | 24 | 0 |
| P-001 / south | 112 | none | 0 |


## self-loop.compact

Selected best accepted cost: `south-loop-north:accepted-probe-0`: [0, 10, 225.488, 0, 1602.964].

Pass 0, remaining candidates 4096, repairs 128.

- gaps: `root → A-001 → A-002`; measured increment 146.988px.

Pass 1, remaining candidates 3879, repairs 128.

Rejected alternatives:

- `facing-reverse:seed`: endpoint_envelope_exhausted.
- `facing:seed`: endpoint_envelope_exhausted.
- `south-reverse:seed`: endpoint_envelope_exhausted.
- `south-loop-north:seed`: endpoint_envelope_exhausted.
- `south:seed`: endpoint_envelope_exhausted.

Pass 1.

- gaps: `P-002__group → P-002 → P-002__contains_scope_single`; measured increment 2px.
- padding: `A-001 → top`; measured increment 66px.
- Rejected revision: `south-loop-north`.
- Route leaves the adapter's finite routing bounds.
- Connector "navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0" segment 0 violates the 17px clearance of node "P-003".
- Connector "navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0" segment 1 violates the 17px clearance of node "A-001:border-y:144".
- Connector "navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0" segment 1 violates the 17px clearance of node "P-002__contains__P-003__source-edge-1f8db5d5f8d95f599ca2c955802b8d7239b0b5bd927abb4029118224e933aee4-0:end:marker".
- Connector "navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0" segment 1 violates the 17px clearance of node "P-003".
- Connector "navigation:source-edge-c8743528d995ce3135c07303a6cf3a71da38eee0c66453a63a417508aec240c2-0" segment 0 intersects non-endpoint box "A-001:header-band".
- Connector "navigation:source-edge-c8743528d995ce3135c07303a6cf3a71da38eee0c66453a63a417508aec240c2-0" segment 1 intersects non-endpoint box "A-001:header-band".
- Connector "navigation:source-edge-c8743528d995ce3135c07303a6cf3a71da38eee0c66453a63a417508aec240c2-0" segment 2 intersects non-endpoint box "A-001:header-band".
- Label finding: {"connectorId":"navigation:source-edge-c8743528d995ce3135c07303a6cf3a71da38eee0c66453a63a417508aec240c2-0","kind":"bounds"}.
- Label finding: {"connectorId":"navigation:source-edge-c8743528d995ce3135c07303a6cf3a71da38eee0c66453a63a417508aec240c2-0","kind":"header","obstacleId":"A-001:header"}.
- Label finding: {"connectorId":"navigation:source-edge-c8743528d995ce3135c07303a6cf3a71da38eee0c66453a63a417508aec240c2-0","kind":"header","obstacleId":"A-001__header"}.
- Label finding: {"connectorId":"navigation:source-edge-9f1a76814241a1fff97051c5256c169812fb4700e576605d7d0f22c5539249f1-0","kind":"ambiguous","obstacleId":"navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0"}.
- Label finding: {"connectorId":"navigation:source-edge-9f1a76814241a1fff97051c5256c169812fb4700e576605d7d0f22c5539249f1-0","kind":"connector","obstacleId":"navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0"}.

Pass 2, remaining candidates 2857, repairs 128.

Rejected alternatives:

- `south-loop-north:proposal-0`: scene_rejected.
- `south-loop-north:proposal-1`: scene_rejected.
- `south-loop-north:proposal-2`: scene_rejected.
- `south-loop-north:proposal-3`: scene_rejected.

Pass 2.

- padding: `A-002 → bottom`; measured increment 10.5px.
- Rejected revision: `south-loop-north`.
- Label finding: {"connectorId":"navigation:source-edge-9f1a76814241a1fff97051c5256c169812fb4700e576605d7d0f22c5539249f1-0","kind":"bounds"}.
- Label finding: {"connectorId":"navigation:source-edge-9f1a76814241a1fff97051c5256c169812fb4700e576605d7d0f22c5539249f1-0","kind":"connector","obstacleId":"navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0"}.

Pass 3, remaining candidates 2338, repairs 128.

| Accepted revision | Crossings, bends, expansion, displacement, length |
| --- | --- |
| `south-loop-north:accepted-probe-0` | 0, 10, 225.488, 0, 1602.964 |
| `south-loop-north:accepted-probe-1` | 0, 10, 225.488, 0, 1602.964 |
| `south-loop-north:accepted-probe-2` | 0, 10, 225.488, 0, 1602.964 |
| `south-loop-north:accepted-probe-3` | 0, 10, 225.488, 0, 1602.964 |
| `south-loop-north:proposal-0` | 0, 10, 225.488, 0, 1602.964 |
| `south-loop-north:proposal-1` | 0, 10, 225.488, 0, 1602.964 |
| `south-loop-north:proposal-2` | 0, 10, 225.488, 0, 1602.964 |
| `south-loop-north:proposal-3` | 0, 10, 225.488, 0, 1602.964 |

Selected ordinary port groups (offsets and reservations in px):

| Node / side | Offsets | Reserved offsets | Signed group displacement |
| --- | --- | --- | --- |
| P-001 / east | 12.5, 35.5 | none | 0 |
| P-002 / west | 12.5, 35.5 | none | 0 |
| P-001 / north | 100.5, 123.5 | none | 0 |
| P-002 / south | 112 | 24 | 0 |
| P-001 / south | 112 | none | 0 |


## self-loop.detailed

Selected best accepted cost: `south-loop-north:accepted-probe-0`: [0, 10, 214.988, 0, 1681.964].

Pass 0, remaining candidates 4096, repairs 128.

- gaps: `root → A-001 → A-002`; measured increment 146.988px.

Pass 1, remaining candidates 3847, repairs 128.

Rejected alternatives:

- `facing:seed`: endpoint_envelope_exhausted.
- `north-reverse:seed`: endpoint_envelope_exhausted.
- `north:seed`: endpoint_envelope_exhausted.
- `west:seed`: endpoint_envelope_exhausted.
- `east-loop-north:seed`: endpoint_envelope_exhausted.
- `west-loop-north:seed`: endpoint_envelope_exhausted.
- `south-reverse:seed`: endpoint_envelope_exhausted.
- `south-loop-north:seed`: endpoint_envelope_exhausted.
- `south:seed`: endpoint_envelope_exhausted.

Pass 1.

- padding: `A-001 → top`; measured increment 66px.
- Rejected revision: `west-loop-north`.
- Route leaves the adapter's finite routing bounds.
- Connector "navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0" segment 0 violates the 17px clearance of node "P-001".
- Connector "navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0" segment 1 violates the 17px clearance of node "A-001:border-x:24".
- Connector "navigation:source-edge-c8743528d995ce3135c07303a6cf3a71da38eee0c66453a63a417508aec240c2-0" segment 0 intersects non-endpoint box "A-001:header-band".
- Connector "navigation:source-edge-c8743528d995ce3135c07303a6cf3a71da38eee0c66453a63a417508aec240c2-0" segment 1 intersects non-endpoint box "A-001:header-band".
- Connector "navigation:source-edge-c8743528d995ce3135c07303a6cf3a71da38eee0c66453a63a417508aec240c2-0" segment 2 intersects non-endpoint box "A-001:header-band".
- Connectors "navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0" and "navigation:source-edge-9f1a76814241a1fff97051c5256c169812fb4700e576605d7d0f22c5539249f1-0" have 113.494px of overlapping horizontal span at 11.5px separation.
- Connector "navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0" segment 0 intersects non-endpoint box "P-001".
- Label finding: {"connectorId":"navigation:source-edge-c8743528d995ce3135c07303a6cf3a71da38eee0c66453a63a417508aec240c2-0","kind":"bounds"}.
- Label finding: {"connectorId":"navigation:source-edge-c8743528d995ce3135c07303a6cf3a71da38eee0c66453a63a417508aec240c2-0","kind":"header","obstacleId":"A-001:header"}.
- Label finding: {"connectorId":"navigation:source-edge-c8743528d995ce3135c07303a6cf3a71da38eee0c66453a63a417508aec240c2-0","kind":"header","obstacleId":"A-001__header"}.
- Label finding: {"connectorId":"navigation:source-edge-9f1a76814241a1fff97051c5256c169812fb4700e576605d7d0f22c5539249f1-0","kind":"ambiguous","obstacleId":"navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0"}.
- Label finding: {"connectorId":"navigation:source-edge-9f1a76814241a1fff97051c5256c169812fb4700e576605d7d0f22c5539249f1-0","kind":"connector","obstacleId":"navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0"}.

Pass 2, remaining candidates 2603, repairs 125.

Rejected alternatives:

- `east-loop-north:seed`: candidate_exhausted.
- `south-loop-north:seed`: candidate_exhausted.
- `west-loop-north:seed`: candidate_exhausted.

Pass 2.

- gaps: `P-002__group → P-002 → P-002__contains_scope_single`; measured increment 2px.
- Rejected revision: `south-loop-north`.
- Connector "navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0" segment 1 violates the 17px clearance of node "A-001:border-y:260".
- Connector "navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0" segment 0 intersects non-endpoint box "P-003".
- Connector "navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0" segment 1 intersects non-endpoint box "P-003".
- Label finding: {"connectorId":"navigation:source-edge-9f1a76814241a1fff97051c5256c169812fb4700e576605d7d0f22c5539249f1-0","kind":"ambiguous","obstacleId":"navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0"}.
- Label finding: {"connectorId":"navigation:source-edge-9f1a76814241a1fff97051c5256c169812fb4700e576605d7d0f22c5539249f1-0","kind":"connector","obstacleId":"navigation:source-edge-05974ce447dc29b910cca7d40a4ffcb30087970c9a7a67d178cb6353adf9c82e-0"}.

Pass 3, remaining candidates 2107, repairs 125.

| Accepted revision | Crossings, bends, expansion, displacement, length |
| --- | --- |
| `south-loop-north:accepted-probe-0` | 0, 10, 214.988, 0, 1681.964 |
| `south-loop-north:accepted-probe-1` | 0, 10, 214.988, 0, 1681.964 |
| `south-loop-north:accepted-probe-2` | 0, 10, 214.988, 0, 1681.964 |
| `south-loop-north:accepted-probe-3` | 0, 10, 214.988, 0, 1681.964 |
| `south-loop-north:proposal-0` | 0, 10, 214.988, 0, 1681.964 |
| `south-loop-north:proposal-1` | 0, 10, 214.988, 0, 1681.964 |
| `south-loop-north:proposal-2` | 0, 10, 214.988, 0, 1681.964 |
| `south-loop-north:proposal-3` | 0, 10, 214.988, 0, 1681.964 |

Selected ordinary port groups (offsets and reservations in px):

| Node / side | Offsets | Reserved offsets | Signed group displacement |
| --- | --- | --- | --- |
| P-001 / east | 37.5, 60.5 | none | 0 |
| P-002 / west | 37.5, 60.5 | none | 0 |
| P-001 / north | 100.5, 123.5 | none | 0 |
| P-002 / south | 112 | 24 | 0 |
| P-001 / south | 112 | none | 0 |

