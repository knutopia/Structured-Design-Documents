# Future `create --template` Options

## Two-Tier Future Direction

Future authoring acceleration likely needs two separate layers that should not be conflated: neutral bootstrap templates for starting a document and explicit semantic seed content for known business contexts. Both can help LLM-driven authoring, but they solve different problems and should sit in different parts of the helper and MCP design.

### Tier 1: Neutral Create Templates

`create --template` should remain narrowly about document initialization. The only currently supported concrete template ID is still `empty`, and any future additions in this lane should stay near-empty and semantically neutral. A hypothetical future example such as `neutral_scaffold` could make sense if it remains a bootstrap aid rather than a semantic content seed, but this should not turn into `simple` or `strict` document variants. Profiles remain validation overlays, not template families.

### Tier 2: Domain-Specific Starter Packs

Domain-specific starter packs are a different future idea. They would represent explicit, opt-in semantic seed content for a known business context, such as known reusable components, known places, known policies, or known operational nodes. These starter packs should be modeled as a separate future mechanism from `create --template`, with application happening through normal structured authoring operations or imports so the resulting semantics remain reviewable, revision-bound, dry-runnable, and undoable.

### Why The Split Helps LLM Authoring

- Neutral templates reduce blank-page friction without anchoring the model to the wrong graph.
- Starter packs help when they encode real organizational knowledge, not generic sample content.
- Mixing the two would blur bootstrap versus semantics and weaken the helper-first mutation model.

The rest of this note continues to discuss `create --template` specifically. Tier 2 starter packs are a separate future direction rather than an expansion of current helper support.

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

# Follow Up

(kg:)

For our [SKILL.md](skills/sdd-skill/SKILL.md) ( [README.md](docs/readme_support_docs/sdd-skill/README.md) ) and for our future MCP Server ( [sdd_mcp_server_design.md](docs/future_explorations/mcp_server/sdd_mcp_server_design.md) ), what would be a sensible, actually useful, small set of templates ( [sdd_helper_future_template_options.md](docs/Deferred/sdd_helper_future_template_options.md) ) to make available to the ssd-helper app ( [README.md](docs/readme_support_docs/sdd-helper/README.md) ) - possibly a "simple profile template" and a "strict profile template" ? 

Bigger question: Does the nature of templates ACTUALLY help with LLM-driven authoring of SSD documents?

(codex:)

**Recommendation**

I would keep helper-side document templates very small:

- `empty`: keep it as the default, stable path. That is the current contract and implementation already ([sdd_mcp_server_design.md](/home/knut/projects/sdd/docs/future_explorations/mcp_server/sdd_mcp_server_design.md:836), [mutations.ts](/home/knut/projects/sdd/src/authoring/mutations.ts:1501)).
- `neutral_scaffold`: optional later, but only if it stays near-empty and semantically neutral. Think “parse-valid starter” or “structural shell,” not seeded app content ([sdd_helper_future_template_options.md](/home/knut/projects/sdd/docs/Deferred/sdd_helper_future_template_options.md:27), [sdd_helper_future_template_options.md](/home/knut/projects/sdd/docs/Deferred/sdd_helper_future_template_options.md:62)).
- `strict_ready_scaffold`: only as a deferred, parameterized template family, not as a fixed template. It should fill required props from the selected profile and caller-provided values, not inject fake nodes or fake business semantics.

I would not make `simple_profile_template` and `strict_profile_template` the main concept. In this repo, profiles are validation overlays, not document variants ([architecture.md](/home/knut/projects/sdd/docs/toolchain/architecture.md:161), [architecture.md](/home/knut/projects/sdd/docs/toolchain/architecture.md:233)), while `--template` is supposed to be document bootstrapping, not a semantic mode switch ([sdd_helper_future_template_options.md](/home/knut/projects/sdd/docs/Deferred/sdd_helper_future_template_options.md:17)).

**Why**

The real difference between “simple” and “strict” is mostly completeness pressure, not document shape. `small_app.sdd` vs `small_app_strict.sdd` shows that strict authoring mostly adds repeated per-node metadata like `owner`, `surface`, `route_or_key`, `access`, `responsibility`, `inputs`, `outputs`, `place_id`, and `data_required` ([small_app.sdd](/home/knut/projects/sdd/docs/readme_support_docs/small_app_example/small_app.sdd:8), [small_app_strict.sdd](/home/knut/projects/sdd/docs/readme_support_docs/small_app_example/small_app_strict.sdd:8), [strict.yaml](/home/knut/projects/sdd/bundle/v0.1/profiles/strict.yaml:37)). That means a strict *document* template is only a weak accelerator. The useful help belongs at node-insertion time, not file-creation time.

So for the future MCP server, the highest-value “template” layer is probably prompt/recipe presets, not create-time document templates. The MCP design already leans that way with `sdd.author_new_document` taking `template_id`, `validate_profile`, and `projection_views` ([sdd_mcp_server_design.md](/home/knut/projects/sdd/docs/future_explorations/mcp_server/sdd_mcp_server_design.md:959)). I’d rather expose presets like `draft_new_document` and `governed_new_document` there than hardcoded simple/strict file templates.

**Do templates actually help LLM-driven authoring?**

A bit, but only in the right place.

- Create-time templates help when they remove neutral setup friction.
- They hurt when they seed guessed semantics, because that becomes real graph state and can anchor the model in the wrong direction ([sdd_helper_future_template_options.md](/home/knut/projects/sdd/docs/Deferred/sdd_helper_future_template_options.md:44)).
- The bigger win for LLMs is bundle-driven scaffolding plus validation loops: profile-aware required-property hints, structured `apply` recipes, projection feedback, and example retrieval.

If you want, I can turn this into a concrete proposal for:
1. helper template IDs,
2. MCP prompt presets,
3. a bundle-driven “strict node scaffold” approach that stays aligned with bundle authority.

(kg:)

I suppose there might be room for domain-specific templates that do things like carry nodes for known available components (defined by business context).

(codex:)

Yes, there probably is room for that, but I’d separate it from “templates” in the narrow `create --template` sense.

`create --template` still feels best as bootstrapping only: `empty`, maybe later `neutral_scaffold`. That matches the current direction that templates should stay semantically neutral, while profiles stay validation overlays rather than document variants ([sdd_helper_future_template_options.md](/home/knut/projects/sdd/docs/Deferred/sdd_helper_future_template_options.md:64), [architecture.md](/home/knut/projects/sdd/docs/toolchain/architecture.md:161)).

For the idea you’re describing, I’d use a different concept:

- `starter packs` or `domain packs`: explicit, opt-in semantic seed content for a known business context.
- `component imports`: selective insertion of known reusable components from a maintained catalog.
- `context defaults`: owner/surface/access/route conventions that fill common metadata without guessing product structure.

That matters because under the current SDD model, inserted nodes are real semantics immediately, not just hints. So a full “available components” inventory can easily become misleading if most of it is merely possible rather than actually in use. The safe version is: create empty or near-empty, then apply a named pack or import selected components as a normal dry-run change set. That keeps it reviewable, revision-bound, and undoable instead of hiding a lot of semantics inside document creation.

So my updated view is:

- `simple template` and `strict template`: probably not the right primary abstraction.
- `empty` plus maybe `neutral_scaffold`: good helper/MCP create templates.
- domain-specific starter packs: potentially very useful, if they are authoritative, small, explicit, and parameterized.
- full domain catalogs: better exposed as read resources plus selective import, not auto-seeded into every new document.

For LLM-driven authoring, that absolutely can help, but only when it encodes real organizational knowledge. It helps when it removes repeated low-value setup. It hurts when it injects plausible-but-wrong structure that the model then has to edit around.

If you want, I can sketch a concrete 2-tier design:
1. tiny `create` templates,
2. separate `starter pack` / `component catalog` mechanism for the future MCP server and helper.
