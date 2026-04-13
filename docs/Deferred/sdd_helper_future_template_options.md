# Future `create --template` Options

## Purpose And Current State

This note records a cautious future direction for `sdd-helper create --template ...`.

Today, the helper supports exactly one documented template identifier:

- `template_id=empty`

That current behavior is intentionally narrow. The create flow is framed as empty-document bootstrapping rather than as a content-generation or example-seeding workflow. The helper and future MCP surfaces also rely on structural, revision-bound, handle-based mutation rather than raw text replacement or free-form cleanup.

This note does not propose an immediate implementation. It exists to summarize what future template IDs could plausibly be for, why some seemingly convenient directions would be risky, and what a safer future template system would likely need to preserve.

## What `--template` Appears Reserved For

The current shape of the contract suggests that `--template` is an extensibility hook for future document bootstrapping modes rather than a version selector or semantic mode switch.

`--version` already carries the language-version role. Bundle data remains the source of truth for language behavior. That leaves `--template` as the likely place for future creation-time scaffolding choices.

In other words, the option appears best understood as:

- how to initialize a new document
- not how to reinterpret SDD semantics
- not how to bypass the normal helper-first authoring workflow

## Possible Future Template Directions

If the project ever expands beyond `empty`, the most plausible future directions are still narrow:

- `empty`
  Preserves the current zero-body bootstrap path.
- parse-valid neutral starter
  A minimal starter that is structurally valid without embedding domain-specific example content.
- structural scaffold starter
  A starter that provides a small neutral shell with placeholders or parameter slots, intended to be filled deliberately during follow-on helper mutations.
- domain-neutral layout skeletons
  Very light scaffolds aimed at common document shapes without claiming to be real product content.

These examples should be treated as tentative categories, not as implied planned IDs.

It is also important not to overread negative tests. A rejected value such as `starter` in tests is evidence that unsupported template IDs are rejected today, not evidence that a real `starter` template is planned.

## Caveats And Failure Modes

The main risk in future template expansion is not syntax. It is semantic drift at the moment of creation.

If a future template were to inject example product nodes as valid SDD content, those nodes would become real document semantics immediately. They would participate in inspect output, handles, ordering, validation, projection, preview, and search. If that seeded content did not match the user’s real intent, the model would begin its first structured edit from the wrong graph.

That creates several avoidable problems:

- mismatched example payload creates friction instead of acceleration
- live example nodes can anchor the model toward editing or renaming sample structures instead of creating the right ones
- the document can appear more complete than it really is while still encoding the wrong semantics

Commented example payload is safer than live example payload in one narrow sense: it does not immediately become semantic graph content. Even so, it is still not a strong fit for the current helper architecture.

Comments and blank lines are intentionally preserved by the rewrite layer but are not part of the public inspect or change-set contract. That means commented examples would not be first-class structural authoring material. They could remain visually present in the file, but they would not participate cleanly in the helper-first workflow that the current design is built around.

That leads to another caveat: future template expansion should not assume that unused template material will be removed reliably by implicit inference. Under the current design, reliable cleanup comes from explicit structural operations. A system that expects the model to notice irrelevant seeded content and then silently clean it up would be brittle, especially when the seeded content is comments or non-structural trivia.

## Recommended Safe Future Template System

The safest future direction is to keep templates semantically neutral.

Recommended defaults:

- templates are for structure and scaffolding, not exemplar product content
- template output should either be empty or intentionally minimal and semantically neutral
- if richer bootstrapping is ever added, it should be parameterized at creation time rather than shipping fixed sample nodes
- any cleanup or removal should require explicit structural operations rather than implicit pruning rules

This implies a practical bias:

- prefer empty or near-empty starters
- prefer placeholders or neutral shells over sample businesses, sample journeys, or sample app features
- keep examples in documentation, recipes, or separate example `.sdd` files rather than in created documents

If the project eventually wants creation-time acceleration beyond `empty`, the safest path is likely a parameterized scaffold model rather than a sample-content model. A parameterized scaffold can still reduce repetition while avoiding the risk that a plausible-looking example graph becomes accidental source-of-truth content.

## Deferred Conclusion

Future `--template` expansion remains a reasonable deferred capability, but it should be approached as a structural authoring aid, not as a sample-content injection feature.

The current helper-first architecture is strongest when a newly created document starts from content that is either:

- empty, or
- minimal, neutral, and intentionally aligned with explicit follow-on structured edits

Any future template system that depends on commented examples, seeded business payload, or implicit removal of unused template material would cut against the current revision-bound structural mutation model and would likely weaken document creation rather than strengthen it.
