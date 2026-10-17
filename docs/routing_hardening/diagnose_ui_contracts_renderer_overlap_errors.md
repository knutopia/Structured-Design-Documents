# Diagnose ui_contracts Renderer Overlap Errors

10-16-26

## Q:

> What is the problem of the day with our fragile-to-the-point-of-useless renderer?
> Does this have anything to do with the new horizontal layout of the "Components without hierarchy" section?
>
> User context
>
> Attachments:
> - knut@sdd:~/projects/sdd$ pnpm sdd show aeb_help_center_de_astra.sdd --view ui_c…: `/mnt/c/Users/Knut/.codex/attachments/1896dd5a-0908-4877-a3c0-07853e495ffd/Pasted text.txt`

## A:

**No—the horizontal component layout is not the cause. This is an existing transition-routing defect.** I reproduced your exact errors, then ran the reduced case with the code from before the horizontal-layout change: identical routes and errors.

The failing combination is:

- `VS-001 → VS-002`
- `VS-002 → VS-001`
- `VS-002 → VS-002` — changing filters while already filtered.

The [return-path builder](./src/renderer/staged/uiContractsTransitions.ts:23) sends both returning arrows around the entire sequence. It separates their top horizontal sections but leaves their side sections overlapping. It also brings the self-loop back from the far left, across `VS-001`. The subsequent repair cannot produce acceptable geometry, so rendering fails.

This exposes a coverage gap: the [topology tests](./tests/uiContractsTopology.spec.ts:30) test cycles and an isolated self-loop separately. My probes confirm that each works separately, while this combination fails.

**There’s also a reason your existing SVG worked:** its metadata identifies it as named diagram `DG-002`. That diagram deliberately excludes the self-loop. Your `--view ui_contracts` command includes all matching relationships, including that loop.

I verified that `DG-002` still renders successfully with the new horizontal layout:

```bash
pnpm sdd show /home/knut/projects/sdd/aeb_help_center_de_astra.sdd \
  --bundle /home/knut/projects/sdd/bundle/v0.2/manifest.yaml \
  --diagram DG-002 --decorators type,id --diagnostics json
```

That restores the intended overview. The renderer still needs a structural fix for self-loops within larger sequences and separate return-path allocation; the document passes validation.

## Q:

> Is there a valid solution strategy that is more than yet-another-shortsighted-patch?

## A:

**Yes. The durable strategy is to change what the router owns: complete transitions, their endpoints, and the space needed to route them.** The current failure exposes a weakness in that ownership.

The code currently splits one returning transition into five independent connectors, attaches them to artificial frame ports, and asks the shared router to repair the pieces. The adapter then [infers endpoint directions from the routes already drawn](./src/renderer/staged/uiContractsRouting.ts:433). Finally, [another repair pass changes routes after the routing coordinator](./src/renderer/staged/pipeline.ts:34). Correctness is distributed across mechanisms that have different information and constraints.

I recommend a contained replacement of the UI Contracts transition-routing path, with these requirements:

1. **Preserve each transition as one logical connector.**
   Its source, destination, label, arrowhead, and relationship identity stay together throughout routing. A self-loop has two attachments on the same node. Bends are internal geometry, not artificial connector endpoints. Intentional shared branches need explicit junction and sharing ownership.

2. **Allocate endpoints and routing space together.**
   Forward transitions, returning transitions, and self-loops must participate in the same port-capacity calculation. Today, return edges bypass the forward-edge allocation. Reserve sufficient space for the complete paths—including vertical legs, labels, and arrowheads. Separating only the top horizontal tracks cannot solve that problem.

3. **Give one module responsibility for the complete routing result.**
   The existing shared routing core already provides complete-connector validation, capacity helpers, and bounded expansion. UI Contracts should supply truthful endpoints, obstacles, and layout ownership to it. Endpoint sides must come from independently resolved port geometry. Every geometry change must go through the same acceptance process; retire the separate post-routing repair for this path.

4. **Let routing request space from layout.**
   When measured demand exceeds available room, the layout owner should expand the relevant gutters or enclosure and rebuild the affected geometry. The staged pipeline remains intact: this negotiation stays inside rendering. Increasing search budgets cannot compensate for contradictory attachments or missing space.

5. **Test combinations and stability through the public renderer.**
   Start with the exact failing case, then cover multiple self-loops, loops on intermediate nodes, overlapping cycles, parallel transitions, branches combined with returns, and long labels. Enumerate small graphs to find interactions that handpicked examples miss. Also test determinism, bounded execution, and whether adding an unrelated scope disturbs existing local routing.

The acceptance criteria must include correct endpoints, preserved relationships, clear arrowheads and labels, no forbidden intersections or overlaps, and readable geometry. Snapshots follow those checks and visual inspection.

This can remain renderer work under the existing bundle semantics. Any newly introduced semantic permission—such as allowing shared tracks—would need bundle authority.

**The first milestone should prove this ownership model on the failing case and its neighboring combinations, while deleting the old return-path machinery.** That deletion matters: completion should leave fewer competing routing rules. The strategy is supported by the existing architecture; its sufficiency still needs that proof before broader migration.
