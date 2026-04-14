# Future Bootstrap And Starter-Pack Options

## Current Contract

`create` is now a single-purpose bootstrap operation.

- helper `create` no longer accepts a template identifier
- shared `createDocument(...)` no longer accepts `template_id`
- future MCP `sdd.create_document` should follow the same contract
- create always writes the empty `SDD-TEXT 0.1` skeleton

This keeps document creation canonical and prevents create-time seed content from becoming accidental source-of-truth graph semantics.

## Separate The Two Future Needs

Future authoring acceleration still appears to have two distinct needs, but they should no longer share the `create` surface:

### 1. Empty Bootstrap

This is the current contract and should stay simple:

- create a new document safely
- return revision/change-set metadata
- do nothing beyond empty bootstrap

### 2. Starter Packs Or Imports

This is the deferred future capability for richer setup:

- domain-specific starter packs
- component catalogs
- policy or metadata defaults
- other explicit semantic seed content

These should be exposed through normal structured authoring operations or dedicated higher-level authoring tools/prompts, not through `create`.

## Why This Split Helps LLM Authoring

- Empty bootstrap removes blank-page friction without anchoring the model to the wrong graph.
- Starter packs can help when they encode real organizational knowledge rather than sample filler.
- Keeping them separate preserves the helper-first, revision-bound mutation model and makes semantic seed content reviewable, dry-runnable, and undoable.

## Safe Future Direction

If richer bootstrapping is added later, the safe shape is:

- discover starter packs or component catalogs through dedicated read resources and/or prompts
- apply them through structured mutation tools
- keep resulting semantics explicit in change sets
- avoid hidden sample payload inside document creation

In particular, do not reintroduce `simple`/`strict` create variants. Profiles remain validation overlays, not document variants.

## Deferred Conclusion

The useful future work is not more create-time templates. It is a separate starter-pack/import capability that works through the shared authoring core.

Create should remain empty bootstrap only.
