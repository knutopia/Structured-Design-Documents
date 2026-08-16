# Implementation Plan for User-Settable Validation and Rendering Defaults

Date: 2026-08-16

Status: Ready for linear execution

## Purpose

This document is the execution companion to
[`user_settable_defaults_architecture.md`](user_settable_defaults_architecture.md). It is intended to be handed to a new implementation thread and used as a live, stage-gated plan until the architecture is complete.

The implementation introduces two independent settings:

- `profile`, selected by `--profile`, controls validation only;
- `detail`, selected by `--detail`, controls rendering only.

It also introduces user-global and project-scoped preferences, keeps portable fallbacks in the selected bundle, changes automatic render-artifact identity to detail, and removes validation profiles from renderer-owned state.

The work is deliberately linear. Complete and approve one stage before starting the next. Do not attempt a broad parallel rewrite of CLI, configuration, helper contracts, renderer contracts, and goldens.

## Authority order

When sources disagree, use this order:

1. [`user_settable_defaults_architecture.md`](user_settable_defaults_architecture.md) for the target architecture.
2. [`de-strict_actionable_inventory.md`](de-strict_actionable_inventory.md) for the immediate default-profile change and its known inventory.
3. `bundle/v0.1/` for machine-readable SDD behavior.
4. Repository architecture and renderer constraints in `AGENTS.md` and `docs/toolchain/`.
5. Current code and tests as evidence of existing behavior, not as authority for preserving hidden defaults.
6. [`simple_profile_default.md`](simple_profile_default.md) as historical blast-radius analysis only.

If a stage exposes a real conflict between the first three authorities, stop and request a decision. Do not choose a convenient code-local convention that bypasses the bundle.

## Locked decisions

The executor must not reopen these decisions during implementation:

- The shipped validation fallback is `simple`.
- The shipped render-detail fallback is `compact`.
- The initial detail IDs are `compact` and `detailed`.
- Resolution precedence is independent for each setting:

  ```text
  CLI argument
    > project sdd.config.yaml
    > user-global configuration
    > selected bundle fallback
  ```

- The bundle declares profiles, detail modes, per-view detail behavior, and portable fallback IDs.
- Mutable selections live outside the bundle.
- Project preferences live at the discovered repository root in `sdd.config.yaml`.
- Only the human-facing `sdd` CLI reads persistent preferences automatically.
- `sdd-helper` remains explicit.
- Library APIs use explicit values or the loaded bundle fallbacks and never inspect user/project configuration.
- Automatic render names use `<source>.<view>.<detail>[.<backend>].<format>`.
- Validation profile remains in validation/provenance metadata, not renderer scene state or artifact names.
- Guided Addition's `default_display_profile_id` and `display_by_profile` remain separate and unchanged.

## Non-negotiable invariants

Every stage must preserve the following unless that stage explicitly performs the named migration:

1. Markdown explains, the bundle governs machine behavior, and code consumes the loaded bundle.
2. Changing only bundle fallback or detail-policy data changes runtime behavior without a code edit.
3. `--profile` cannot select display fields, layout, SVG classes, renderer scenes, or artifact names in the completed implementation.
4. `--detail` cannot change parse, compile, validate, or raw projection results.
5. Projection remains the semantic boundary before renderer preparation.
6. Renderer flow remains `projection -> RendererScene -> MeasuredScene -> PositionedScene -> SVG -> PNG`.
7. Legacy DOT, Mermaid, and Graphviz paths remain supported and consume the same detail policy as staged paths.
8. User/project configuration never enters the bundle fingerprint.
9. An invalid high-precedence value is an error; it never falls through to a lower scope.
10. `compile`, Guided Addition, helper validation, and other non-applicable surfaces do not begin reading persistent defaults.
11. Stored goldens and the rendered corpus are updated only after behavioral equivalence is proved.
12. Existing unrelated worktree changes, archived implementation evidence, and Service Blueprint documentation assets are not rewritten as collateral cleanup.

## Scope boundaries

### In scope

- bundle manifest types, loading, validation, accessors, and fingerprint evidence;
- the five profile-consuming `sdd` commands: `validate`, `render`, `dot`, `mmd`, and `show`;
- user-global and project configuration reading and atomic mutation;
- `sdd defaults show`, `set`, and `unset`;
- `--detail` on `show`, `render`, `dot`, and `mmd`;
- public combined rendering APIs and structured results;
- detail-owned display policies for all six current renderable views;
- staged and legacy renderer plumbing;
- helper preview arguments, results, discovery, contract metadata, and SDD Skill workflow text;
- automatic preview paths and rendered-corpus organization;
- focused tests, migration-equivalence evidence, public CLI documentation, and generated corpus updates.

### Out of scope

- changing validation rules inside `simple`, `permissive`, or `strict`;
- removing `strict` or any other declared profile;
- adding more detail levels;
- changing projection schemas or view semantics;
- changing Guided Addition profile behavior;
- adding a generalized cache subsystem where none exists;
- removing legacy renderers;
- changing renderer layout or routing for aesthetic reasons;
- rewriting historical files under `docs/Done/` merely to replace profile metadata;
- modifying the Service Blueprint tutorial or its checked-in illustration as incidental cleanup.

## Executor operating protocol

### Linear sequence

Execute Stage 0 through Stage 5 in order. Within a stage, follow the listed checkpoints in order. A later stage may rely only on an earlier stage whose LLM approval verdict is `APPROVED`.

Do not combine stages into one unreviewed diff. Small commits are optional, but each stage must remain reviewable as a coherent unit even if the user did not ask for commits.

### Subagent rule

Default to no subagents.

Use a subagent only when the executor can state in advance why a bounded, preferably read-only task is likely to improve quality. Suitable examples are:

- an independent bundle-authority audit after Stage 1;
- a focused review of configuration failure cases after Stage 2;
- an independent visual/equivalence audit across six views after Stage 3 or 4.

Do not use subagents merely to increase throughput. Never allow multiple agents to write overlapping files. The primary executor owns all integration, reruns the relevant checks, and records whether a subagent was used in the stage achievement report.

### Limited-human-intervention rule

The executor may advance without human confirmation when a stage passes its specified checks and receives LLM approval. Ask the user only when one of these stop conditions occurs:

- the architecture and bundle contract cannot be reconciled without a new decision;
- unrelated user changes overlap files that the stage must modify and cannot be preserved safely;
- a destructive corpus/golden regeneration would remove unexplained material;
- required equivalence or independence cannot be proved after a reasonable corrective pass;
- a required external tool is unavailable and the documented alternate evidence is insufficient;
- the implementation would need a new persistent scope, new detail ID, new public command, or other material scope expansion.

Routine code organization, test-file placement, naming of internal helpers, and correction of stage-local defects do not require human approval.

### Required LLM approval gate

At the end of every stage, the executor must inspect the complete stage diff and write an achievement report in the execution log at the end of this document. Use exactly one verdict:

- `APPROVED`: every stage acceptance condition is satisfied; work may continue.
- `NOT APPROVED`: at least one acceptance condition is unmet; fix the stage or stop.

An approval report must include:

- implemented scope;
- files or subsystems changed;
- commands run and their results;
- satisfied invariants;
- violated invariants, explicitly `none` when applicable;
- residual risks that are genuinely deferred by this plan;
- snapshot/golden/corpus disposition;
- subagent use and the quality benefit, or `none`;
- the next authorized stage.

Tests being green are not sufficient approval. The LLM must also confirm bundle authority, failure behavior, scope control, and the stage's behavioral evidence.

## Sequence overview

| Stage | Outcome | Initial status |
| --- | --- | --- |
| 0 | Re-baselined inventory and protected-worktree record | Pending |
| 1 | Bundle-owned `simple` validation fallback, with hidden strict defaults removed | Pending |
| 2 | Persistent configuration and profile precedence for the human CLI | Pending |
| 3 | Bundle-owned detail vocabulary and profile/detail-independent rendering inputs | Pending |
| 4 | Renderer/helper/artifact identity fully migrated from profile to detail | Pending |
| 5 | Documentation, corpus, full verification, and closeout | Pending |

## Stage 0: Re-baseline and protect the workspace

### Objective

Confirm that this plan still matches the repository at execution time, establish the exact baseline, and identify changes that must be preserved.

### Checkpoint 0.1: Read authority and current instructions

Read completely:

- this implementation plan;
- [`user_settable_defaults_architecture.md`](user_settable_defaults_architecture.md);
- [`de-strict_actionable_inventory.md`](de-strict_actionable_inventory.md);
- the repository `AGENTS.md` files applicable to every target path;
- current CLI, bundle, renderer, helper, and corpus code named below.

Extract a short list of non-negotiable invariants before editing.

### Checkpoint 0.2: Record current state

Record:

- `git status --short`;
- current branch and baseline commit;
- whether the worktree already contains user changes;
- current Node and pnpm availability;
- whether Graphviz is available through `pnpm run check:graphviz`;
- current full build/test result using `TMPDIR=/tmp`.

Do not clean, reset, or overwrite unrelated changes.

### Checkpoint 0.3: Refresh the blast-radius searches

At minimum, locate and classify current occurrences of:

- Commander defaults containing `strict`;
- `?? "strict"` and equivalent runtime fallbacks;
- `profile_display`, `resolveProfileDisplayPolicy`, and profile-named display types;
- `profileId` in staged renderer contracts and backends;
- `data-profile-id` and `profile-*` SVG metadata;
- profile-based preview filenames;
- helper preview `profile_id` contracts and bindings;
- profile-based rendered-corpus variants and directories;
- public docs that state `strict` is the default.

The known starting points include:

- `bundle/v0.1/manifest.yaml`;
- `bundle/v0.1/core/views.yaml`;
- `src/bundle/types.ts`;
- `src/bundle/loadBundle.ts`;
- `src/bundle/validateLoadedBundle.ts`;
- `src/bundle/fingerprint.ts`;
- `src/cli/program.ts`;
- `src/types.ts` and `src/index.ts`;
- `src/renderer/renderView.ts`;
- `src/renderer/profileDisplay.ts`;
- `src/renderer/prepareProjectionForRender.ts`;
- `src/renderer/viewRenderers.ts`;
- `src/renderer/previewWorkflow.ts` and `previewBackends.ts`;
- `src/renderer/staged/contracts.ts` and all six staged view renderers;
- `src/previewArtifactPaths.ts`;
- `src/authoring/contracts.ts`, `preview.ts`, `contractMetadata.ts`, and `contractResolution.ts`;
- `src/cli/helperProgram.ts` and `helperDiscovery.ts`;
- `src/examples/renderedCorpus.ts` and `generateRenderedExamples.ts`;
- `skills/sdd-skill/`;
- the focused CLI, renderer, helper, bundle, corpus, and skill tests.

### Stage 0 acceptance

- The authority order is unambiguous.
- Existing user changes are listed and protected.
- The baseline build/test result is known.
- Any repository drift from this plan is documented before implementation.
- No product files have been edited.

### Stage 0 LLM approval

Approve Stage 0 only after the baseline and refreshed inventory are recorded in the execution log. If a material new consumer of profile-dependent rendering is found, add it to the appropriate later stage before approving.

## Stage 1: Make `simple` the bundle-owned validation fallback

### Objective

Complete the immediate de-strict inventory without yet introducing persistent preferences or render detail. At the end of this stage, omitted-profile behavior comes from the selected bundle and the shipped bundle chooses `simple`.

Profile still controls both validation and rendering during this transitional stage. Do not begin the renderer/detail migration here.

### Checkpoint 1.1: Extend the bundle contract

Add this shipped manifest field:

```yaml
tool_defaults:
  validation_profile_id: simple
```

Implement the corresponding manifest type and a generic bundle accessor such as `getBundleValidationProfileFallback(bundle)`. Export the accessor if public combined APIs need it.

Validation must reject:

- a missing or malformed `tool_defaults` section;
- an empty validation fallback;
- a fallback that does not name a declared and loaded profile;
- duplicate manifest profile IDs.

Do not infer a fallback from manifest order. Do not add `simple` as a TypeScript fallback behind malformed bundle data.

The manifest already participates in `createBundleFingerprintInput(...)`; add focused evidence that changing the new field changes the fingerprint. Do not add user/project configuration to that input.

### Checkpoint 1.2: Remove hidden CLI defaults

Remove Commander's hardcoded default value from `--profile` on:

- `validate`;
- hidden `render`;
- hidden `dot`;
- hidden `mmd`;
- `show`.

After the selected bundle is loaded, resolve:

```text
explicit --profile, otherwise bundle.tool_defaults.validation_profile_id
```

Use one shared resolution helper for all five commands. An explicit unknown profile must continue to fail through an actionable validation error.

Update help text so omission means the selected bundle's default. Remove wording that labels `strict` as the default. Keep examples that explicitly demonstrate strict governance.

### Checkpoint 1.3: Remove hidden library defaults

In the combined text-rendering API:

- resolve `options.profileId` or the bundle fallback exactly once;
- use that resolved profile for validation and the still-profile-coupled renderer;
- report the effective profile in the structured result;
- remove every `?? "strict"` or equivalent code fallback.

Lower-level validation remains profile-explicit.

Treat profile IDs as bundle-declared strings rather than a closed TypeScript union of the three shipped IDs. The shipped bundle still declares only `simple`, `permissive`, and `strict`, but alternate valid bundles must not require a source-code union edit.

### Checkpoint 1.4: Make tests intentional

Follow the detailed inventory in [`de-strict_actionable_inventory.md`](de-strict_actionable_inventory.md):

- retain omitted profile only in focused default-resolution tests;
- add an explicit profile to unrelated CLI tests;
- preserve existing artifact expectations by selecting the profile the test actually intends;
- test all five CLI commands through the shared resolver;
- test explicit override;
- test an unknown fallback and unknown explicit override;
- test a bundle-only fallback mutation using a temporary bundle fixture;
- test the library fallback and single resolved value;
- test the fingerprint change.

A bundle-mutation proof must edit only bundle data in a temporary copy and then call the public runtime. Mutating a code constant or only a mock return value is not sufficient evidence of bundle authority.

### Checkpoint 1.5: Update only current default wording

Update the live CLI documentation statements identified by the actionable inventory. Ordinary examples may continue to omit `--profile` because omission is now legitimate bundle-driven behavior.

Do not regenerate renderer goldens or the rendered corpus in this stage. Do not rewrite archived docs or Service Blueprint assets.

### Focused verification

Run the smallest relevant suites after each checkpoint, then at minimum:

```bash
TMPDIR=/tmp pnpm run build
TMPDIR=/tmp pnpm exec vitest run tests/cli.spec.ts tests/render_dot.spec.ts tests/render_mermaid.spec.ts
TMPDIR=/tmp pnpm test
```

Include any newly created bundle-default test file in the focused command.

Manually verify representative omitted and explicit commands:

```bash
TMPDIR=/tmp pnpm sdd validate bundle/v0.1/examples/outcome_to_ia_trace.sdd
TMPDIR=/tmp pnpm sdd validate bundle/v0.1/examples/outcome_to_ia_trace.sdd --profile strict
TMPDIR=/tmp pnpm sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map --out /tmp/stage1-default.svg
```

### Stage 1 achievement criteria

- The bundle is the only omitted-profile fallback authority.
- The shipped fallback is `simple`.
- All five CLI commands and the combined library API use it.
- Explicit profile overrides still win.
- No hidden strict fallback remains in active runtime code.
- Unrelated tests are profile-explicit.
- Existing renderer behavior remains profile-coupled and otherwise unchanged.
- No renderer goldens or corpus artifacts changed.

### Stage 1 LLM approval

The LLM must review the diff for duplicated fallback logic and search active code for hidden strict assumptions. Approve only if the bundle-only mutation test demonstrates runtime dependence on the manifest field.

## Stage 2: Add persistent configuration and profile precedence

### Objective

Add the versioned configuration substrate, project/global path rules, provenance-aware resolution, and `sdd defaults` management. Integrate persistent profile selection into the human CLI only.

This stage prepares the same schema for `render_detail_id`, but detail selection does not become effective until Stage 3 adds the bundle vocabulary.

### Checkpoint 2.1: Add an application-layer configuration module

Create a cohesive module outside the bundle and renderer layers. A suitable organization is `src/config/` with separate types, paths, parser/validator, resolver, and writer files. Exact filenames may follow repository conventions, but responsibilities must remain separable and dependency-injectable.

Implement the shared schema:

```yaml
version: "1"
defaults:
  validation_profile_id: simple
  render_detail_id: compact
```

Both settings are optional. Reject:

- malformed YAML;
- a non-object root or `defaults` value;
- unsupported version;
- unknown keys at either level;
- non-string or empty IDs;
- duplicate YAML keys;
- unreadable files.

Missing files and missing individual settings are normal absence, not errors.

Configuration files select IDs only. They cannot define profiles, rules, display flags, or view behavior.

### Checkpoint 2.2: Implement platform-native paths

Resolve the global file as documented by the architecture:

| Runtime platform | Path |
| --- | --- |
| Linux/WSL | `${XDG_CONFIG_HOME}/sdd/config.yaml`, otherwise `~/.config/sdd/config.yaml` |
| macOS | `~/Library/Application Support/sdd/config.yaml` |
| Windows | `%APPDATA%\sdd\config.yaml` |

Inject platform, environment, and home-directory/path dependencies so tests never read or write the executor's real user configuration.

For project scope, reuse the existing repository-root discovery contract starting at CLI `cwd`. The project file is exactly `<repo-root>/sdd.config.yaml`; do not search above the resolved root and do not base normal resolution on the source file's directory.

Normal commands may proceed without a discovered project root by treating project configuration as absent. Project-scoped `set` and `unset` must fail when no root is discoverable.

### Checkpoint 2.3: Implement independent resolution with provenance

Define a shared result for each setting containing:

- effective `value`;
- `source`: `cli`, `project`, `global`, or `bundle`;
- optional `sourcePath` for file-backed sources.

Resolve profile independently in the required precedence order. Select the first present value, then validate it against the loaded bundle. An invalid selected value is a hard error that names:

- setting and value;
- source and path when applicable;
- selected bundle;
- available declared values.

Do not catch that error and continue down the precedence chain.

Design the resolver so Stage 3 can activate detail through the same generic mechanism rather than adding a parallel implementation.

### Checkpoint 2.4: Add safe configuration mutation

Implement atomic `set` and `unset` operations:

- create parent directories only for the exact chosen global path;
- preserve the other configured setting;
- serialize UTF-8 with canonical LF and deterministic key order;
- write to a sibling temporary file and rename atomically;
- clean up a failed temporary write;
- make setting the same value idempotent;
- remove an empty `defaults` mapping;
- remove an otherwise empty config file after `unset`;
- never rewrite the bundle.

Do not preserve unknown keys by accident; unknown keys make the file invalid before mutation.

### Checkpoint 2.5: Add `sdd defaults`

Implement the final command family:

```text
sdd defaults show [--global | --project] [--bundle <manifest>]
sdd defaults set <profile|detail> <value> (--global | --project) [--bundle <manifest>]
sdd defaults unset <profile|detail> (--global | --project)
```

At this stage, `profile` is fully operational. The generic `detail` branch may exist, but against the shipped Stage-2 bundle it must fail explicitly because no declared render-detail vocabulary exists yet; Stage 3 activates it. Do not silently accept an unvalidated detail value.

Rules:

- `set` and `unset` require exactly one scope;
- `show` accepts no scope or exactly one scope, never both;
- `show` without scope reports effective profile, source, source path when present, selected bundle path, and bundle fallback;
- scoped `show` reports the exact file path, stored/unset values, and validity against the selected bundle;
- value errors and malformed scope combinations use nonzero exits and actionable messages;
- `unset` does not require a bundle because it removes a named preference rather than selecting behavior.

Keep output deterministic and test its semantic fields. Do not add an unplanned JSON mode merely to simplify tests.

### Checkpoint 2.6: Integrate only the human CLI

Apply persistent profile resolution to `validate`, `render`, `dot`, `mmd`, and `show` after bundle loading and before validation.

Do not read configuration from:

- `compile`;
- `add` or Guided Addition internals;
- `sdd-helper`;
- `validateGraph(...)`;
- library rendering APIs;
- renderer entrypoints.

A malformed global/project file should fail a command that consumes its setting, but must not break `compile` or Guided Addition solely because those commands do not use these defaults.

### Required tests

Add focused configuration tests for:

- all platform paths, including XDG fallback;
- no project root;
- nearest discovered project root;
- absent files and partial files;
- global profile;
- project profile;
- CLI > project > global > bundle;
- an invalid value at every precedence level;
- invalid project value not falling through to valid global value;
- malformed, unsupported, unknown-key, duplicate-key, unreadable, and empty-ID files;
- set, idempotent set, partial preservation, unset, empty-file removal, and atomic write failure;
- deterministic source reporting and paths;
- real-user-config isolation through dependency injection;
- all five CLI consumers;
- `compile` and Guided Addition not reading malformed preference files;
- library/helper behavior remaining configuration-independent;
- bundle fingerprint equality before and after creating user/project configuration.

Use temporary directories for every configuration test. Never mutate the executor's actual global config.

### Focused verification

```bash
TMPDIR=/tmp pnpm run build
TMPDIR=/tmp pnpm exec vitest run tests/cli.spec.ts
TMPDIR=/tmp pnpm test
```

Include all new configuration-focused test files in the focused run.

Perform manual CLI checks under an isolated temporary configuration root. Exercise bundle, global, project, and explicit profile sources plus `show`, `set`, and `unset`.

### Stage 2 achievement criteria

- The versioned parser, path resolver, reader, writer, and resolver are independently testable.
- Profile precedence and provenance are correct for all five human CLI consumers.
- `sdd defaults` manages profile safely.
- Invalid selected values never fall through.
- Machine-facing and library surfaces remain free of filesystem preference reads.
- User/project config does not affect bundle fingerprints.
- Render detail is not yet active and rendering remains profile-coupled.

### Stage 2 LLM approval

The LLM must inspect failure paths and dependency injection, not only success cases. Approve only if tests prove that no real user config is accessed and that malformed unused configuration does not contaminate unrelated commands.

## Stage 3: Introduce render detail and separate runtime inputs

### Objective

Declare render detail in the bundle, activate persistent and CLI detail resolution, and make validation and display-policy selection use independent effective values. Establish migration equivalence before profile-owned renderer state is removed.

### Checkpoint 3.1: Extend the bundle manifest and view contract

Add the final shipped fields:

```yaml
tool_defaults:
  validation_profile_id: simple
  render_detail_id: compact

render_details:
  - id: compact
    intent: Low-noise rendering focused on primary structure.
  - id: detailed
    intent: Fuller rendering with secondary labels, annotations, and supporting detail.
```

Add manifest types, a render-detail type/accessor, and bundle validation for:

- malformed `tool_defaults`;
- duplicate or empty detail IDs;
- missing/empty intent;
- unknown render-detail fallback;
- missing detail-policy coverage;
- unknown policy detail IDs;
- non-object policies and non-boolean display values.

Manifest order must not imply the fallback.

Use bundle-owned participation plus a focused cross-layer test to ensure every currently code-renderable view has explicit coverage for every declared detail. Do not hardcode the six view IDs into bundle-validation logic.

### Checkpoint 3.2: Add detail-owned policies without changing content

In `bundle/v0.1/core/views.yaml`, add `renderer_defaults.detail_display` for all six current renderable views:

- copy the current `simple` policy to `compact`;
- copy the current `permissive`/`strict` policy to `detailed`.

All current views have identical permissive and strict policies. Add a test that proves that assertion directly from bundle data before removing the old field.

Introduce generic detail-policy resolution and detail-named policy types/readers. During the equivalence checkpoint, the old profile resolver may coexist temporarily, but new production display selection must converge on the detail resolver by the end of this stage.

Do not change flag values, add view-specific branches, or move render shaping into projection.

### Checkpoint 3.3: Activate detail configuration and CLI options

Activate `render_detail_id` in the Stage-2 resolver and all `sdd defaults` operations.

Add `--detail <detail_id>` only to:

- `show`;
- hidden `render`;
- hidden `dot`;
- hidden `mmd`.

Do not add it to `validate`, `compile`, or `add`. Commander help must describe profile as validation and detail as rendering. Omission uses the independently resolved default for each.

All rendering commands resolve both values once and carry provenance internally. A project may provide one setting while global or bundle supplies the other.

### Checkpoint 3.4: Separate combined library orchestration

Update combined source-rendering options to accept:

```text
profileId?: string
detailId?: string
```

When omitted, resolve each from the loaded bundle only. Never call the filesystem preference resolver from library code.

The combined flow must be:

```text
compile
  -> validate with effective profileId
  -> raw project without profileId/detailId
  -> prepare/render with effective detailId
```

Structured results must report both effective IDs, including failure results where resolution succeeded. Lower-level validation remains profile-explicit. Lower-level renderer/model entrypoints become detail-explicit.

Update `renderSourcePreview(...)` similarly. Its orchestration may carry both IDs, but its projection-source backend request must use detail for rendering. Profile is validation provenance only.

### Checkpoint 3.5: Migrate text and staged display selection

Migrate both renderer families to resolve display flags from detail:

- legacy DOT and Mermaid text renderers;
- staged preview renderers for all six views;
- `prepareProjectionForRender(...)`, including UI Contracts omission notes;
- all view render models and place-label helpers.

Rename user-visible notes that say `simple profile` to `compact detail` or equivalent detail language.

It is acceptable for renderer scene structures and SVG metadata to retain profile-named fields only until Stage 4, but those fields must not be consulted for display selection. Record this transitional debt explicitly in the Stage 3 achievement report; the branch is not architecturally complete until Stage 4.

### Checkpoint 3.6: Prove migration equivalence before deletion

Create a focused equivalence harness before removing `profile_display`. For every current view and applicable backend, prove:

| New detail | Existing behavior to match |
| --- | --- |
| `compact` | `simple` |
| `detailed` | `permissive` and `strict` |

Evidence must cover:

- resolved display-policy objects;
- DOT text;
- Mermaid text where supported;
- staged renderer scenes before metadata-only field migration;
- deterministic SVG content;
- PNG output or deterministic SVG-to-PNG input;
- legacy Graphviz preview input and, when Graphviz is available, output.

For SVG comparison, normalize only the explicitly planned metadata rename when necessary. Do not normalize node content, dimensions, coordinates, routes, classes unrelated to profile/detail, diagnostics, or notes.

If Graphviz is unavailable, equal DOT input plus an unchanged legacy Graphviz adapter is acceptable Stage-3 evidence. Record the missing direct artifact comparison. If the adapter changed, direct Graphviz output comparison is required.

Generate temporary representative compact and detailed SVG/PNG artifacts for all six views. The executor LLM must visually inspect the representative pairs and record whether:

- compact retains the current low-noise behavior;
- detailed retains the current fuller behavior;
- there is no layout/routing regression beyond the expected added or removed content.

A read-only visual-review subagent is appropriate only if it materially improves coverage. It is not required.

Do not update stored goldens or the rendered corpus during this checkpoint.

### Required independence tests

Add tests proving:

1. With source, bundle, view, backend, format, and detail fixed, changing profile may change validation diagnostics or eligibility but cannot change a successful render's content. During Stage 3 only, staged scene/SVG comparison may normalize the exhaustively listed transitional `profileId`, `profile-*`, and `data-profile-id` metadata; DOT, Mermaid, render-model content, geometry, and all other serialized fields must compare exactly.
2. With source, bundle, view, and profile fixed, changing detail may change renderer output but cannot change validation diagnostics.
3. Changing only `tool_defaults.render_detail_id` changes omitted-detail rendering.
4. Changing only a per-view detail policy changes that view's output.
5. Project/global profile and detail resolve independently.
6. Invalid profile and detail errors each identify their own setting and source.
7. An unsupported view/detail combination fails instead of using another detail.

Use sources that pass under at least two profiles for the successful-render comparison. Compare serialized text/SVG and scene/model contracts, not only a few substrings. The Stage-3 normalizer must be narrow and tested; Stage 4 removes it and requires byte-identical successful artifacts across profiles when detail is fixed.

### Focused verification

Run all new bundle/detail/equivalence tests plus at minimum:

```bash
TMPDIR=/tmp pnpm run build
TMPDIR=/tmp pnpm exec vitest run tests/render_profile_display.spec.ts tests/prepareProjectionForRender.spec.ts tests/previewWorkflow.spec.ts tests/stagedRenderer.spec.ts tests/cli.spec.ts
TMPDIR=/tmp pnpm test
```

The profile-display test file may be intentionally renamed to detail terminology after equivalence is established.

### Stage 3 achievement criteria

- The bundle declares and validates `compact` and `detailed` plus the `compact` fallback.
- All six current views have complete detail policies.
- Human CLI and library resolution carry independent profile and detail values.
- Profile selects validation; detail selects display behavior.
- Legacy and staged output behaviors match their pre-migration equivalents.
- Independence tests pass with only the documented transitional metadata normalization; no rendered content difference is permitted.
- Stored goldens and corpus remain unchanged pending Stage 4 migration.
- Any remaining profile-named renderer metadata is listed exhaustively.

### Stage 3 LLM approval

Approve only after the equivalence matrix is complete and visually reviewed. A test suite made green by refreshing snapshots is an automatic `NOT APPROVED`.

## Stage 4: Remove profile from renderer, helper, and artifact identity

### Objective

Finish the architectural separation: renderer-owned contracts, helper preview, SVG metadata, automatic paths, and corpus planning use detail. Profile remains only in validation and execution provenance.

### Checkpoint 4.1: Remove profile-owned display state

Delete `renderer_defaults.profile_display` from the bundle only after Stage 3 equivalence is approved.

Remove or rename:

- `src/renderer/profileDisplay.ts`;
- `ResolvedProfileDisplayPolicy`;
- `resolveProfileDisplayPolicy(...)`;
- `readBooleanProfileDisplaySetting(...)`;
- profile-named parameters in render-model builders and staged view renderers.

Every renderer consumer must use the detail-owned equivalents. There must be no compatibility fallback from detail to a validation profile.

### Checkpoint 4.2: Migrate staged scene contracts and SVG metadata

Replace:

```text
RendererScene.profileId
MeasuredScene.profileId
PositionedScene.profileId
```

with `detailId`, including micro-layout, macro-layout, routing/debug artifacts, fixtures, snapshot harnesses, and all six scene builders.

Replace SVG metadata:

```text
profile-<id>        -> detail-<id>
data-profile-id     -> data-detail-id
```

Do not include validation profile in SVG comments, classes, data attributes, or renderer diagnostics merely as provenance. Return it in the surrounding combined result instead.

Run the exact profile-independence comparison again after this migration. With detail fixed, successful serialized artifacts must now be byte-identical across validation profiles.

### Checkpoint 4.3: Migrate preview backends and automatic paths

Projection-backed preview requests and staged backend callbacks must carry `detailId`, not `profileId`. Text-backed legacy preview obtains detail-shaped DOT/Mermaid before backend invocation.

Change `src/previewArtifactPaths.ts` and every caller to build:

```text
<source>.<view>.<detail>[.<backend>].<format>
```

Explicit output paths continue to win. Add exact tests for default and explicit backend suffixes.

Update CLI help and write messages accordingly.

### Checkpoint 4.4: Make helper preview explicit in both dimensions

Keep helper validation unchanged and profile-explicit. Change helper preview to require both:

```text
--profile <profile_id>
--detail <detail_id>
```

Update together:

- `RenderPreviewArgs` and `RenderPreviewResult`;
- helper command parsing;
- preview service calls and failure context;
- helper capabilities/discovery text;
- contract shapes and required fields;
- bundle bindings and bundle-resolved allowed values;
- contract resolution support for manifest render-detail declarations;
- helper CLI tests and integration tests;
- artifact materialization basename;
- `skills/sdd-skill/SKILL.md` and relevant workflow references/tests.

Preview results carry both `profile_id` and `detail_id`. Preview matching in the SDD Skill must require the same document revision, view, profile, detail, format, and backend.

Do not make helper arguments optional and do not let helper read persistent config.

Bundle-derived contract resolution must expose detail IDs generically. Do not hardcode `compact` and `detailed` in helper metadata as the source of allowed values.

### Checkpoint 4.5: Migrate structured execution metadata

Ensure combined library and preview results report both IDs consistently in camelCase, while helper JSON uses `profile_id` and `detail_id`.

If an actual combined validation/render cache or artifact record exists at execution time, include both effective IDs where validation outcome is cached and include detail where renderer output is cached. Do not add a new generalized cache subsystem solely for this plan.

Confirm again that user/project files are absent from bundle fingerprint input.

### Checkpoint 4.6: Plan corpus migration without yet regenerating

Change corpus planning from profile variants to detail variants:

- enumerate `bundle.manifest.render_details`;
- use detail-named variant types and directory helpers;
- use directories such as `compact_detail/` and `detailed_detail/`;
- render each detail once rather than producing duplicate output for every validation-profile/detail cross-product;
- validate generation with an explicit bundle-derived validation profile, normally `tool_defaults.validation_profile_id`;
- record that validation profile in the generated README/provenance text;
- keep detail and backend in artifact identity.

Keep focused validation tests across all profiles outside the rendered corpus. The corpus demonstrates renderer detail, not validation-policy permutations.

At this checkpoint, test path planning and generation into a temporary root if practical. Do not remove the committed profile-based corpus until Stage 5 authorizes regeneration.

### Required searches before approval

The following should be absent from active bundle/renderer/helper code except in intentional migration tests or validation provenance:

- `profile_display`;
- `resolveProfileDisplayPolicy`;
- `ResolvedProfileDisplayPolicy`;
- `data-profile-id`;
- renderer scene `profileId`;
- preview artifact path options named `profileId`;
- helper preview without `detail_id`.

`profileId` remains legitimate in validation and combined orchestration. It must not flow below the validation/render split.

### Focused verification

```bash
TMPDIR=/tmp pnpm run build
TMPDIR=/tmp pnpm exec vitest run tests/helperCli.spec.ts tests/helperCli.integration.spec.ts tests/authoringPreviewMaterialization.spec.ts tests/previewWorkflow.spec.ts tests/stagedRenderer.spec.ts tests/stagedSvgBackend.spec.ts tests/renderedCorpus.spec.ts tests/sddSkillSource.spec.ts
TMPDIR=/tmp pnpm test
```

Include renamed/new detail, artifact-path, contract-metadata, and contract-resolution suites.

Manually inspect:

- helper `capabilities`;
- bundle-resolved preview contract detail;
- one explicit helper preview carrying both IDs;
- one `sdd show` automatic filename;
- SVG root classes/data attributes;
- profile-fixed/detail-changed and detail-fixed/profile-changed output pairs.

### Stage 4 achievement criteria

- No renderer-owned contract or display resolver depends on profile.
- SVG and automatic artifact identity use detail.
- Helper preview is explicit in both settings and remains config-independent.
- Structured results retain both effective IDs.
- Corpus planning is detail-based and collision-free.
- Exact post-migration independence tests pass.
- Committed corpus/goldens have not yet been regenerated.

### Stage 4 LLM approval

The LLM must trace one staged path and one legacy path from combined orchestration to artifact output and confirm that profile stops at validation while detail continues to rendering. Approve only if the post-migration artifacts are byte-identical across profiles when detail is fixed.

## Stage 5: Update evidence, documentation, and close out

### Objective

Regenerate only the evidence made intentionally obsolete by the approved contract changes, update live documentation, and perform final end-to-end acceptance.

### Checkpoint 5.1: Update focused goldens intentionally

List every golden/snapshot change before applying it and classify it as one of:

- schema rename `profileId` -> `detailId`;
- SVG metadata rename;
- filename/directory rename from profile to detail;
- expected compact/detailed content mapping already proved in Stage 3.

Reject any unexplained geometry, routing, content, diagnostic, or note change. If such a change appears, return to Stage 3 or 4; do not normalize it with a snapshot refresh.

Historical assets under `docs/Done/` are not active goldens and should not be bulk rewritten.

### Checkpoint 5.2: Regenerate the rendered corpus once

Before running the generator:

- inspect `examples/rendered/v0.1/` for unrelated or hand-authored files;
- confirm Stage 4 corpus path tests pass;
- confirm the generator's deletion scope is exactly the versioned generated corpus root;
- verify Graphviz availability or document the accepted alternate legacy evidence.

Then run the repository generator rather than editing generated files manually:

```bash
TMPDIR=/tmp pnpm run generate:rendered-examples
```

Verify:

- only detail directories exist for newly generated render variants;
- compact and detailed outputs match the approved equivalence mapping;
- no profile/detail collision or duplicate content set remains;
- README/provenance names the validation profile used for generation;
- staged and retained legacy backends are present as expected;
- a second generation produces identical sorted hashes.

Visually inspect at least one compact and one detailed generated artifact for each of the six views. Record the LLM verdict in the Stage 5 report.

### Checkpoint 5.3: Update live documentation

Update current documentation to explain:

- bundle fallback `simple` and `compact`;
- `--profile` as validation-only;
- `--detail` as rendering-only;
- CLI > project > global > bundle precedence for each setting;
- `sdd defaults show/set/unset` with scope requirements;
- platform-native global paths and repository-root `sdd.config.yaml`;
- helper explicitness;
- detail-based automatic artifact names;
- detail-based corpus organization.

Likely live targets include:

- `docs/toolchain/development.md`;
- `docs/doc_site/sdd_cli_tools/index.md`;
- CLI help assertions;
- relevant SDD Skill workflow documentation;
- `AGENTS.md` if its current-project-goal wording is now completed or obsolete.

Do not rewrite the architecture or actionable inventory to conceal deviations. If implementation required an approved deviation, add a short dated amendment or record it in this plan's execution log.

Do not edit `docs/doc_site/.vitepress/dist` directly. Rebuild the documentation site:

```bash
TMPDIR=/tmp pnpm run docs:build
```

Preserve unrelated Service Blueprint documentation changes and assets.

### Checkpoint 5.4: Final behavior matrix

Run and record a matrix covering:

| Case | Expected result |
| --- | --- |
| No config/no flags | bundle `simple` + `compact` |
| Global profile only | global profile + lower-scope detail |
| Global detail only | lower-scope profile + global detail |
| Partial project config | project value for one setting, independent fallback for the other |
| Full project config | both project values |
| CLI profile only | CLI profile, independently resolved detail |
| CLI detail only | independently resolved profile, CLI detail |
| Both CLI flags | both CLI values |
| Invalid project profile with valid global profile | hard error at project |
| Invalid project detail with valid global detail | hard error at project |
| Malformed global config | actionable error on consuming human CLI command |
| Same malformed config with `compile` | compile remains unaffected |
| Library omitted values | bundle fallbacks only |
| Helper preview | both IDs required; no config reads |
| Fixed detail, changed profile | same successful artifact; validation may differ |
| Fixed profile, changed detail | same validation; render may differ |

Cover all five profile-consuming commands and all four detail-consuming commands.

### Checkpoint 5.5: Final verification and drift searches

Run:

```bash
TMPDIR=/tmp pnpm run build
TMPDIR=/tmp pnpm test
TMPDIR=/tmp pnpm run docs:build
git diff --check
```

Also run focused searches proving:

- no active hardcoded strict fallback remains;
- no active profile-owned renderer display state remains;
- no automatic preview filename uses profile;
- help and live docs no longer describe strict as the default;
- Guided Addition's separate profile fields remain present and unchanged;
- config paths/settings do not enter bundle fingerprints;
- the generated corpus and renderer evidence are deterministic.

Review the complete diff by subsystem. Confirm that parser, compiler, raw projection, validation rules, Guided Addition, layout, and routing have no unexplained changes.

### Final completion criteria

The implementation is complete only when:

- the bundle declares valid profile/detail fallbacks and detail policies;
- shipped omitted values are `simple` and `compact`;
- user-global and project preferences resolve independently and safely;
- `sdd defaults` shows, sets, and unsets both settings;
- the human CLI alone reads persistent preferences;
- `--profile` affects validation only;
- `--detail` affects rendering only;
- helper and lower-level machine workflows remain explicit;
- renderer scenes, SVG metadata, artifact paths, and corpus organization use detail;
- invalid configuration never silently falls through;
- bundle-only mutation tests prove runtime bundle authority;
- compact/detailed equivalence and profile/detail independence are proved;
- live documentation and CLI help match behavior;
- full tests and documentation build pass;
- no unrelated user work was overwritten.

### Stage 5 LLM approval

The final LLM approval must be based on the complete diff, full verification, behavior matrix, deterministic regeneration evidence, and visual review. If any completion criterion is unmet, verdict is `NOT APPROVED` and the implementation must not be reported as complete.

## Recommended test organization

The executor may reuse existing files where that keeps ownership clear. If new suites are useful, the following boundaries are recommended:

- `tests/bundleToolDefaults.spec.ts`: fallback declarations, validation, fingerprint, and bundle mutation;
- `tests/defaultsConfig.spec.ts`: schema, paths, reads/writes, atomicity, and precedence;
- `tests/cliDefaults.spec.ts`: defaults commands, source reporting, and five-command integration;
- `tests/renderDetail.spec.ts`: bundle detail policy, fallback mutation, view coverage, and legacy behavior;
- `tests/profileDetailIndependence.spec.ts`: separation and migration-equivalence matrix;
- existing staged view suites: scene `detailId`, SVG metadata, and view-specific compact/detailed behavior;
- existing helper/contract/skill suites: explicit `profile_id` + `detail_id`;
- `tests/renderedCorpus.spec.ts`: detail variants and deterministic path planning.

Do not create a single oversized test file that obscures which layer owns a failure.

## Implementation notes for known repository surfaces

These notes are a starting map, not permission to skip Stage 0 drift discovery:

- `src/bundle/types.ts` currently leaves `renderer_defaults` open-ended; add enough typing and validation for detail policy without hardcoding view-specific flag names.
- `src/bundle/validateLoadedBundle.ts` already collects deterministic bundle diagnostics and is the natural validation path.
- `src/bundle/fingerprint.ts` includes the manifest and views, so bundle detail/fallback data should affect fingerprints naturally; tests still need to prove it.
- `src/cli/program.ts` currently loads bundle/source together and carries Commander profile defaults; resolution should occur after bundle load and before compile/validation.
- `src/authoring/workspace.ts` already provides repository-root discovery suitable for project config.
- `src/renderer/renderView.ts` currently resolves profile separately for validation and rendering; resolve both effective settings once in the combined layer.
- `src/renderer/profileDisplay.ts` and `src/renderer/viewRenderers.ts` are the central legacy text-policy path.
- `src/renderer/prepareProjectionForRender.ts` contains the UI Contracts pre-render shaping boundary and must use detail without changing raw projection.
- `src/renderer/previewWorkflow.ts` is the combined preview orchestration boundary where profile and detail split.
- `src/renderer/previewBackends.ts` and staged renderer entrypoints must become detail-only below that boundary.
- `src/renderer/staged/contracts.ts`, `microLayout.ts`, `macroLayout.ts`, and `svgBackend.ts` carry current scene profile metadata.
- `src/previewArtifactPaths.ts` is shared by human and helper preview naming.
- `src/authoring/contracts.ts`, `contractMetadata.ts`, and `contractResolution.ts` must evolve together so helper contract discovery remains accurate.
- `src/examples/renderedCorpus.ts` currently expands variants over manifest profiles; it must ultimately expand over render details instead.
- `skills/sdd-skill/references/workflow.md` currently defines preview matching in terms of profile only and must include detail.

## Execution log

Append one report per stage using this template. Do not pre-mark stages complete.

```markdown
### Stage N achievement report

Verdict: APPROVED | NOT APPROVED

Implemented:
- ...

Changed subsystems:
- ...

Verification:
- `<command>` — pass/fail and relevant result

Satisfied invariants:
- ...

Violated invariants:
- none | ...

Residual risks:
- none | explicitly deferred item

Snapshots/goldens/corpus:
- unchanged | exact intentional changes and evidence

Subagents:
- none | bounded task and quality benefit

Next authorized stage:
- Stage N+1 | none
```
