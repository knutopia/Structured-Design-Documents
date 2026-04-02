# [Done] Indentation in IA Place Map

This note resolves the earlier ambiguity around IA indentation.

## Renderer-side rule

- Explicit `Place CONTAINS Place` creates owned child scope.
- Same-scope indentation is not driven by source indentation and is not a new projection or bundle semantic.
- Within one direct sibling scope, the earliest preceding sibling `Place` that has a forward `NAVIGATES_TO` edge to a later direct sibling `Place` may claim that later sibling as a follower.
- Follower claiming is local to that sibling scope only. It stops at `Area` boundaries, non-`Place` boundaries, and explicit containment boundaries.
- A follower can belong to only one hub.

## Layout consequence

- Top level stays horizontal.
- `Area` interiors stay vertical.
- A `place_group` stacks the place card first and its owned scope second.
- A single explicit contained child stays directly below the parent with no extra indent.
- Multi-child contained scopes and follower scopes reserve a left trunk lane and indent their child column to the right.
- Child scopes make the space they need before routing; routing does not try to squeeze into already-finalized branch bounds.

## Connector consequence

- Staged `ia_place_map` renders only forward local structure connectors:
  - parent to direct child
  - hub to claimed follower
- If `CONTAINS` and forward `NAVIGATES_TO` exist for the same local pair, staged IA renders one merged connector.
- Direct single-child connectors use a vertical bottom-to-top route.
- Branched contained-child connectors and follower connectors use a shared vertical trunk with left-entry horizontal terminal segments.
- IA-specific ELK fallback is not part of the staged IA renderer contract.

## Scope of this note

- This is staged-renderer policy for `ia_place_map`.
- It does not change parser behavior.
- It does not change compiler, validator, projection, bundle schema, or legacy text renderers.
