# [Done] Simplify sdd-skill bundle-awareness instructions

**Intended file:** `docs/sdd_skill_bundle_awareness_simplification_plan.md`  
**Status:** Prepared in Plan mode; the file has not been written.

## 1. Objective and boundaries

Simplify the bundle-awareness instructions so an LLM can follow one clear startup procedure and then concentrate on the requested authoring task.

Preserve the behavior implemented by the bundle-awareness update:

- Explicit bundle selection takes precedence over saved preferences and the repository fallback.
- Existing documents use an appropriate available bundle. A mismatch must be resolved before mutation.
- One selected manifest stays attached to the current workflow, including saved rendering.
- Language rules come from the selected manifest and its referenced files.
- Helper assessments, revisions, handles, dry runs, commit behavior, and rendering gates retain their existing meaning.

This is an instructional refactor. Do not change helper or CLI runtime code, bundle files, public contracts, or selection precedence. Do not redesign unrelated parts of the skill.

The plan is based on the implementation recorded in this conversation. The shell was unavailable during planning. Before editing, read the current repository instructions, canonical skill, workflow reference, and relevant source tests. Reconcile their current contents with the descriptions below; do not assume exact line numbers or overwrite intervening changes.

Use the `skill-creator` skill when executing this plan.

## 2. Establish one authoritative startup procedure

In `skills/sdd-skill/SKILL.md`, replace the scattered bundle-selection instructions with one clearly identified procedure near the beginning of the skill.

Keep helper executable discovery first. Then instruct the model to identify the task kind before selecting the bundle: new document, existing document, search, or a command that does not consume a bundle.

The central procedure must communicate these rules, in this order:

1. **Choose the initial bundle.** Honor a supplied manifest or requested shipped version. Otherwise, select a matching available bundle for an existing document whose declaration is known. For a new document without a requested version, let the helper use its configured selection.
2. **Resolve the initial contract.** Obtain a bundle-resolved contract relevant to the next operation. Include the explicit manifest when one is already known.
3. **Retain the returned manifest.** Read the absolute `resolution.manifest_path` and use it as `<manifest>` for the remainder of the workflow.
4. **Pass the retained manifest.** Every subsequent bundle-consuming helper command and saved `sdd show` command receives `--bundle <manifest>`.
5. **Use the selected language authority.** Follow that manifest’s references when language details are needed. Request additional contract detail only when needed for request composition, allowed values, or formatting guidance.

Aim for approximately 150–220 words for the central procedure. Treat that as an editorial target, not a reason to remove a required safeguard.

Make these distinctions explicit:

- The initial bundle-resolved contract request is required to establish the workflow’s manifest.
- Later contract requests are conditional on an information need.
- Static help, `capabilities`, static contracts, and git-only operations do not require bundle selection.

This distinction replaces the current conflicting combination of “resolve a contract to pin the manifest” and “resolve contracts only when bundle values are unknown.”

Keep `<helper>` defined as the resolved executable or wrapper. Keep `<manifest>` defined as the absolute path returned by contract resolution. Do not redefine `<helper>` to secretly include bundle arguments.

### Contract-selection detail

Put the following supporting detail in the workflow reference rather than expanding the main procedure:

- Reuse the bundle-resolved contract already needed for the next operation.
- Use `--purpose request` only for subjects that support it: create, author, apply, and undo.
- When the immediate operation has no bundle-resolved contract, use `helper.command.create --purpose request --resolve bundle` to obtain bundle identity. Explain once that inspecting the create contract does not create a document.
- A later contract request that uses `--resolve bundle` must also receive the retained manifest.

Do not add a new discovery command or require both a generic identity lookup and an operation-specific lookup when one request can serve both purposes.

## 3. Consolidate the existing prose and examples

### Main skill

Remove duplicate bundle-selection explanations from the create, edit, render, and hard-stop sections once the central procedure covers them.

Keep each task branch focused on its own work:

- Creation: create the document, retain the returned revision, and author the initial content.
- Editing: inspect for revision and handles, then use the appropriate mutation workflow.
- Rendering: require the relevant assessment and produce the intended saved artifact.

Retain explicit `--bundle <manifest>` arguments in command examples. These demonstrate application of the central rule without repeating its explanation.

Remove or revise every restriction saying that bundle-resolved contracts are used “only” when IDs or other allowed values are unknown. After startup, additional introspection may also be needed for request shape or formatting guidance.

### Workflow reference

In `skills/sdd-skill/references/workflow.md`:

- Remove the complete numbered selection procedure currently under “1a. Select And Pin The Bundle.”
- Keep task classification before any instruction that depends on whether the document is new or existing.
- After task classification, refer directly to the main skill’s startup procedure.
- Preserve the existing detailed authoring workflow and its assessment gates.
- Consolidate additional bundle explanations into one short “Bundle selection edge cases” subsection near the existing language-authority guidance.
- Do not reproduce the main startup procedure in that subsection.

The edge-case subsection must cover:

- **Unknown existing declaration:** use available read-only access to establish the declaration when needed. If the intended bundle remains ambiguous, resolve that uncertainty before mutation. Do not rewrite the header to make a default selection succeed.
- **Conflicting explicit selection:** surface the mismatch instead of silently replacing the user’s chosen manifest.
- **Mixed-version search:** run separate searches with explicit selections and suitable scopes. Each pass uses one bundle.
- **Intentional bundle changes:** refresh the relevant contract and rerun the applicable dry run. Retaining a path does not freeze the file’s contents.
- **Creation assertion:** `create --version` asserts the selected bundle’s default creation version; it does not select a bundle.

Keep these as concise exception guidance. Do not turn them into another mandatory checklist for routine work.

### Related material

Review the existing recipes, helper-gap reference, and published skill guide for duplicated or contradictory bundle wording.

Update only passages affected by the simplification. Preserve the published explanation of bundle selection where it helps human readers understand the skill.

Audit command examples using this rule:

- Before selection is established, a bundle-resolved contract may omit `--bundle` only when intentionally allowing the helper to choose.
- After selection is established, bundle-consuming examples include `--bundle <manifest>`.
- Examples aimed at a concrete version explicitly select that version’s manifest.
- Static discovery and git examples do not need a bundle argument.

Do not mechanically add `--bundle` to every occurrence of the word `contract`; static contract inspection remains valid.

## 4. Review and verification gates

Complete these gates in order. Fix a failed gate before proceeding.

### Gate A: Instruction coherence

Review the finished main skill and workflow together.

Confirm that:

- A reader can find one authoritative startup procedure.
- Task classification precedes bundle decisions that depend on it.
- Required initial resolution and optional subsequent introspection are clearly distinguished.
- No instruction permits an accidental return to personal defaults after selection.
- Existing document declarations are not silently rewritten.
- Language authority remains attached to the loaded manifest.
- Unrelated authoring and rendering safeguards remain present.

Do not judge success by word count alone. The simplification succeeds when it removes repeated decisions and contradictory conditions.

### Gate B: Existing source checks

Update affected expectations in `tests/sddSkillSource.spec.ts`.

Preserve checks for helper capability agreement, language authority, assessments, revisions, request-file conventions, and saved-artifact behavior. Adjust checks that depend on the old placement or exact wording of bundle instructions.

Do not weaken the tests to generic assertions such as “the skill contains the word bundle.” Also do not add an exact-string assertion for every new sentence.

Run the focused skill source tests and the skill validator. If published documentation changed, run the documentation build.

A full runtime test run is unnecessary for this prose-only change unless an unexpected failure reveals a broader dependency. Do not regenerate snapshots or renderer artifacts.

### Gate C: Five instruction walkthroughs

Read the instructions as if executing these tasks and record the expected selection and continuation:

| Scenario | Required result |
| --- | --- |
| Create a document with no version request | Initial resolution uses helper defaults; later operations use its returned manifest. |
| Edit an existing v0.1 document while the saved preference is v0.2 | Select the matching v0.1 manifest; retain the document declaration. |
| Use a custom manifest outside version-named directories | Retain the returned absolute path without reconstructing it from version metadata. |
| Inspect or search without a mutation request | Establish the manifest through the documented contract fallback; create no document. |
| Validate, preview, and save a diagram | All three operations use the same retained manifest. |

Also confirm that static discovery and git-only tasks bypass bundle setup.

These walkthroughs establish that the prose specifies the intended behavior. Do not describe them as measured evidence of improved LLM adherence unless actual model trials were performed.

## 5. Installation and completion report

After all gates pass, inspect the installed skill against the canonical source before refreshing it.

If the installed copy contains independent customizations, preserve it and report the differences requiring reconciliation. Otherwise, back it up, refresh it using the documented installation flow, and verify that it matches the canonical source. Report whether a host reload is still required.

The completion report must state:

- Where the central startup procedure now lives.
- Which duplicated or conflicting instructions were removed.
- Which checks and walkthroughs passed.
- Whether the installed copy was refreshed.
- Any remaining ambiguity or unverified behavior.

Do not claim the instructions improve actual LLM success rates based solely on static tests. The intended outcome is a smaller, internally consistent instruction set that preserves the established bundle-awareness behavior.
