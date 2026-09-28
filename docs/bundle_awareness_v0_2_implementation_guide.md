# Bundle awareness and v0.2 compatibility: implementation guide

Status: proposed implementation, based on repository revision `375b0c2` on 2026-09-28. This document specifies work to perform; it does not claim that the work is already implemented.

## 1. Goal and scope

Make the interactive authoring command (`sdd add`), syntax highlighting generator, `sdd-helper`, and `sdd-skill` consume the intended bundle consistently. Support both the preserved v0.1 bundle and the active v0.2 bundle through the same runtime code.

The two bundles currently describe the same language features, with different version declarations and artifact identities. New v0.2 features will arrive later. This preparation must make those differences flow from bundle data without adding `if (version === "0.2")` branches or maintaining separate implementations.

Keep this small: reuse the existing bundle loader, CLI selection resolver, authoring services, contract metadata, and skill wrapper. No new package, bundle registry, automatic document migration, or plugin system is needed.

Terminology:

- **Guided Addition** means `sdd add`, implemented through the guided authoring domain services and a terminal adapter.
- **Helper** means `sdd-helper`, the JSON CLI used by the skill. It is a separate adapter over shared authoring services.
- **Bundle version** identifies the selected bundle. **Document language version** is the declaration in an `.sdd` file. Keep both distinct from npm package versions, helper contract versions, and Guided Addition workflow/proposal versions.

## 2. Authority and acceptance invariants

Read these sources before implementation. If this guide conflicts with a loaded bundle's language rules, the bundle governs. This guide defines the intended tool integration policy, not new language syntax.

| Role | Source | Consequence |
| --- | --- | --- |
| Machine-readable language contract | [v0.2 manifest](../bundle/v0.2/manifest.yaml), its referenced core files and profiles; [v0.1 manifest](../bundle/v0.1/manifest.yaml) for compatibility | Syntax, vocabulary, endpoints, profiles, views, and authoring conventions come from the selected bundle. |
| Version acceptance and new-document declaration | [v0.2 syntax](../bundle/v0.2/core/syntax.yaml): `document.version_declaration`; corresponding v0.1 fields | `post_parse_supported_versions` governs parsing; `default_effective_version` governs an omitted declaration and the current bootstrap. |
| Compiled and projected artifact contracts | [compiled schema](../bundle/v0.2/core/schema.json), [projection schema](../bundle/v0.2/core/projection_schema.json) | Version acceptance cannot be broadened by editing only a parser list. |
| Architectural guardrails | [AGENTS.md](../AGENTS.md), especially Bundle Authority and Renderer Constraints | Keep parser entry through `loadBundle(...)` and `createParserSyntaxRuntime(bundle)`; keep rendering behind projection. |
| Existing selection mechanism | [bundleResolution.ts](../src/cli/bundleResolution.ts), [configuration runtime](../src/config/runtime.ts) | Reuse the selection precedence and error handling described below. |
| Authoring contract and continuation mechanisms | [contracts.ts](../src/authoring/contracts.ts), [contractMetadata.ts](../src/authoring/contractMetadata.ts), [bootstrap.ts](../src/authoring/bootstrap.ts) | Preserve request/result shapes except for the explicit additive changes below; retain revision and assessment behavior. |
| Downstream evidence | [compile tests](../tests/compile.spec.ts), [projection snapshot tests](../tests/projectionSnapshots.spec.ts), bundle examples | Examples and snapshots demonstrate behavior; they do not define it. There is no visual redesign or new visual exemplar in this work. |

Non-negotiable acceptance invariants:

1. Each operation loads one selected bundle and passes it through the complete operation. An adapter must not select v0.2 and later reopen v0.1 for creation, validation, projection, contract resolution, or preview.
2. Interactive commands use explicit manifest override, then saved global bundle version, then the built-in fallback. The current fallback is `0.2`. Missing, malformed, or mismatched selections fail; they do not silently select another bundle.
3. A document header is checked using the selected bundle. It does not silently select another bundle, rewrite the document, or opt the operation into a migration.
4. New-document headers come from `createEmptyDocumentBootstrap(bundle)`. Existing document versions are preserved during edits.
5. Generated editor artifacts and automated tests are independent of the developer's real global preferences.
6. The helper's discovery remains cheap and static. Bundle-resolved contracts identify the actual loaded bundle and expose values derived from it.
7. A skill authoring session uses the same explicit manifest for contract discovery, creation/editing, validation, and saved rendering.
8. Preserve JSON output conventions, domain rejection assessments, revision checks, Guided Addition bundle fingerprints, Save/Cancel behavior, and deterministic LF serialization.

No shipped bundle behavior needs changing merely to make these adapters select a bundle. Existing manifest, syntax, vocabulary, authoring, and view fields already encode the necessary rules. If implementation reveals an actual missing language convention, extend the bundle contract and its generic runtime first; do not put the convention into the adapter.

## 3. Current implementation and gaps

| Target | What already works | Work still needed |
| --- | --- | --- |
| `sdd add` | [runGuidedAdditionCommand](../src/cli/guidedAddition.ts) calls `loadSelectedBundle(...)` with the repository root. The selected `Bundle` reaches snapshots, the planner, dry run, and commit. | Repository discovery still requires a v0.1 manifest. Help text still says the fallback is v0.1. Transcript tests use v0.1 documents without consistently isolating defaults. Add explicit v0.2 end-to-end coverage. |
| Highlighting | [createSddTextMateAssets(bundle)](../src/highlighting/sddTextMate.ts) derives grammar/configuration from the supplied bundle and parser syntax runtime. | [Generator entrypoint](../src/highlighting/generateSddTextMate.ts) always loads v0.1. Checked-in asset tests assume that selection. The [VSIX script](../scripts/package-vscode-sdd.mjs) hardcodes a `0.1.0` filename. |
| `sdd-helper` | Shared authoring services generally receive a `Bundle`; bootstrap is already bundle-driven. `contract --resolve bundle` expands existing bindings. | [loadBundleContext](../src/cli/helperProgram.ts) always loads v0.1. There is no `--bundle` option or global preference integration. `CreateDocumentArgs.version`, its published schema, and discovery text restrict/advertise v0.1. |
| `sdd-skill` | The repository owns the canonical [skill](../skills/sdd-skill/SKILL.md) and wrapper; the skill uses helper discovery, contracts, and assessments. | Instructions point to v0.1 files and `create --version 0.1`. The wrapper's repo marker requires v0.1. Saved rendering via `sdd show` can select a different bundle from the helper. Installed copies need refreshing after the tracked source changes. |

Additional existing details to account for:

- [DEFAULT_BUNDLE_VERSION](../src/cli/bundleResolution.ts) is already `0.2`, but [bundleDefaults.spec.ts](../tests/bundleDefaults.spec.ts) still expects `0.1` when no preference is saved. Resolve this outdated expectation during implementation.
- [authoringFormat.ts](../src/authoring/authoringFormat.ts) constructs source references as `bundle/v${language_version}/...`. An explicit custom manifest may live elsewhere, and bundle version need not equal language version. Fix the reported source location, not just the version literal.
- [workspace.ts](../src/authoring/workspace.ts) and [run_helper.sh](../skills/sdd-skill/scripts/run_helper.sh) both use `bundle/v0.1/manifest.yaml` as a repository marker.
- [The documentation site](../docs/doc_site/.vitepress/config.ts) imports the checked-in VS Code grammar. Changing generated assets also affects documentation highlighting.
- The helper currently returns a structured blocked validation result for a v0.2 document because it loads v0.1. Exit zero for that domain result does not mean validation succeeded.

## 4. Selection policy and architecture

### 4.1 Interactive CLI and helper policy

Use the existing precedence:

```text
explicit --bundle <manifest>
    otherwise saved global defaults.bundle_version
    otherwise DEFAULT_BUNDLE_VERSION
        -> loadBundle(selected manifest)
        -> pass the resulting Bundle to domain services
```

The saved setting is written by `sdd defaults set bundle 0.2`. `--bundle` accepts a manifest path, not the string `0.2`. The helper reads that same configuration; do not introduce helper-specific defaults or a second configuration file.

For both authoring adapters:

- Find the repository root first. Resolve a saved/fallback version under `<repoRoot>/bundle/v<version>/manifest.yaml`.
- Resolve an explicit relative manifest against the caller's working directory, using the existing launcher-cwd convention. Then pass an absolute path to the shared resolver. Document paths in `sdd-helper` remain repo-relative as today.
- Pass the repo root explicitly as the fourth argument to `loadSelectedBundle(...)`; do not rely on `process.cwd()` when invoked from a nested directory.
- Preserve explicit-path behavior: a custom manifest does not need to live in a directory named after its declared version.
- Preserve `config.bundle_not_found` and `config.bundle_version_mismatch` for saved/fallback selections. An explicit invalid path also fails visibly. An explicit valid manifest bypasses reading the global bundle preference, including a malformed global configuration on that resolution path.
- Load once per command and retain that `Bundle`. Do not let later domain operations re-read global preferences.

There is no automatic header-based bundle switching in this step. A v0.1 document used with the v0.2 bundle currently produces a version error; callers select v0.1 explicitly to work on it. Supporting old language versions inside a newer bundle would be a separate language compatibility change across syntax, schemas, and runtime, not a CLI convenience fix.

`search` remains a search under one selected bundle. In a mixed-version repository it reports/skips incompatible documents under its existing diagnostic rules. Use `--under` and repeat the search with another explicit bundle when both versions are relevant. Do not invent a second header parser or switch bundles independently for each file.

### 4.2 Generator policy

Highlighting generation is a build operation. It must ignore user-global preferences:

```text
explicit --bundle <manifest>
    otherwise repository DEFAULT_BUNDLE_VERSION
        -> loadBundle(...)
        -> createSddTextMateAssets(bundle)
        -> deterministic grammar + language configuration files
```

Reuse `bundleManifestPath(...)` and `DEFAULT_BUNDLE_VERSION` from the existing CLI selection module for the entrypoint's default path. Do not call preference-reading resolution for this build. The pure grammar builder must not import configuration, filesystem discovery, or CLI selection code.

For this preparation, ship one grammar generated from the repository's default bundle, currently v0.2. Generate either bundle independently for tests or inspection. Do not merge vocabularies or create header-dispatch grammars now. Current functional parity means the generated grammar may be byte-identical; that is expected. When future syntax diverges incompatibly, simultaneous editor support needs its own design. Highlighting is not language validation, and a numeric version being highlighted does not prove it is accepted by the compiler.

### 4.3 Version-neutral repository detection

Change the shared authoring repo predicate and shell wrapper from `package.json` plus a particular manifest to `package.json` plus the `bundle/` directory. Keep walking ancestors as today. Detecting the repository and selecting a valid manifest are separate steps; the loader is responsible for checking the selected bundle.

Use the same marker rule in both implementations. Preserve test injection for filesystem checks and existing path-scope restrictions. Test a minimal repository containing only v0.2 and nested invocation. Reject an unrelated directory that only has `package.json`.

### 4.4 No protocol renaming by language version

Keep Guided Addition `workflow_version: "1.0"`, proposal versions, the helper's `contract_version: "0.1"`, and stable format-card/hint identifiers unless their protocol changes independently. Existing `sdd.v0_1.*` hint IDs identify contract entries; do not use them to decide language support. Language metadata and source references must identify the selected bundle accurately.

## 5. Target 1: Guided Addition (`sdd add`)

Files: [guidedAddition.ts](../src/cli/guidedAddition.ts), [program.ts](../src/cli/program.ts), [workspace.ts](../src/authoring/workspace.ts), [guided snapshot code](../src/authoring/guidedAddition/snapshot.ts), [additionProposalsV1.ts](../src/authoring/additionProposalsV1.ts).

1. Retain the existing `runGuidedAdditionCommand` selection flow. It already normalizes an explicit manifest against `deps.cwd()` and calls `loadSelectedBundle(deps.defaultsConfig, deps.loadBundle, explicitBundlePath, repoRoot)`.
2. Apply the version-neutral repository detection change from section 4.3.
3. Update bundle-option help to derive its fallback wording from `DEFAULT_BUNDLE_VERSION`. The same stale text is repeated across main CLI commands; use a small shared text function/constant rather than replacing it with repeated `0.2` literals. Label v0.1 examples with an explicit v0.1 manifest where necessary so they still work with the new fallback.
4. Retain domain ownership of bundle details: `createGuidanceCatalog(bundle)`, `src/bundle/guidedAuthoring.ts`, snapshots, and the planner consume `core/authoring.yaml`, vocabulary, contracts, and views. Do not teach the terminal adapter node types, relationship lists, or version-specific forms.
5. Confirm existing-file and new-file paths both use the same selected bundle. The new-file declaration must come from the bootstrap; dry run and Save must retain the bundle fingerprint and warning-confirmation protections already implemented.

Required proof cases:

- Create one small document through the scripted terminal prompt and Save, once with each explicit shipped manifest. Assert the corresponding declaration and successful compilation with that bundle.
- Cancel new-document authoring and assert that the document is still absent, for both versions.
- Edit an existing document with its matching bundle. A mismatched document/bundle must fail before persistence.
- Inject global `0.1` and `0.2` preferences and verify selection; verify an explicit manifest overrides the injected preference.
- Verify a nested caller resolves the override correctly and can work in a repository with only v0.2.
- Retain the stale bundle fingerprint rejection test. A proposal from one bundle must not be accepted under another just because today's node types happen to be identical.

Use [guidedAdditionCli.spec.ts](../tests/guidedAdditionCli.spec.ts) and [cliDefaults.spec.ts](../tests/cliDefaults.spec.ts). For existing v0.1 fixtures, explicitly select v0.1 in the test harness. Add a focused two-version scenario instead of cloning every transcript test or changing fixture headers indiscriminately.

## 6. Target 2: highlighting generator and packaging

Files: [generateSddTextMate.ts](../src/highlighting/generateSddTextMate.ts), [sddTextMate.ts](../src/highlighting/sddTextMate.ts), [package-vscode-sdd.mjs](../scripts/package-vscode-sdd.mjs), [extension package](../editors/vscode-sdd/package.json), [extension README](../editors/vscode-sdd/README.md).

### 6.1 Entrypoint options and output

Add two options to the generator entrypoint using the already-installed Commander parser:

| Option | Meaning | Omitted value |
| --- | --- | --- |
| `--bundle <manifest>` | Absolute path or caller-relative path to the manifest | Repository default bundle, without global preferences |
| `--out-dir <directory>` | Root receiving `syntaxes/sdd.tmLanguage.json` and `language-configuration.json` | Existing `editors/vscode-sdd/` directory |

Resolve explicit paths with launcher-cwd semantics. Compute/load the bundle and construct both assets before writing either file, so an unsupported syntax contract fails before replacing checked-in assets. Preserve deterministic serialization and LF newlines. Print the selected manifest along with the generated paths so a developer can verify what was generated.

Suggested code structure: keep option parsing and writes in the entrypoint; keep `createSddTextMateAssets(bundle)` pure. A small exported writer may be introduced if needed for testing, but do not move bundle semantics into it.

Proposed commands after implementation, from the repo root:

```bash
TMPDIR=/tmp pnpm run generate:textmate
TMPDIR=/tmp pnpm run generate:textmate --bundle bundle/v0.1/manifest.yaml --out-dir /tmp/sdd-highlight-v01
TMPDIR=/tmp pnpm run generate:textmate --bundle bundle/v0.2/manifest.yaml --out-dir /tmp/sdd-highlight-v02
```

The `pnpm` script must forward these arguments to the Node entrypoint. Verify the actual script invocation, not only direct calls to the builder.

### 6.2 Grammar behavior and future features

Retain `loadBundle(...) -> createSddTextMateAssets(bundle) -> createParserSyntaxRuntime(bundle)`. Rename version-specific error wording such as “v0.1 highlighting requires…” to describe the actual capability limit. Do not remove the checks: if future v0.2 syntax cannot be represented, fail with an explicit unsupported-contract error and extend the generic builder before claiming highlighting support.

### 6.3 Packaged and checked-in assets

- Continue generating assets before packaging the VSIX. The default generator selection supplies a reproducible build target.
- Read the extension's own `package.json` version to form `sdd-language-<extension version>.vsix`. Do not derive it from the bundle language version or toolchain package version.
- Update README generation/install examples and remove the assertion that generation always uses v0.1.
- Keep the VitePress import of the generated grammar working. Regenerate checked-in assets only after semantic tokenization checks pass. If the two bundles yield identical output, a zero asset diff is valid.

### 6.4 Tests

Refactor [sddTextMate.spec.ts](../tests/sddTextMate.spec.ts) into two responsibilities:

1. Semantic tokenization and bundle-mutation behavior run for each explicit shipped bundle, with a separate highlighter lifecycle per version.
2. The checked-in artifact synchronization test runs once against the repository default bundle. Do not compare both versions with the same files after they diverge.

Add generator entrypoint coverage with temporary output directories: explicit v0.1/v0.2 selection, nested-cwd relative paths, invalid manifest without output replacement, and identical default output under different isolated global preferences. Assert selection through loaded identity or logged manifest as well as bytes, because both bundles currently generate the same assets.

## 7. Target 3: `sdd-helper`

### 7.1 Add selection at the CLI boundary

In [helperProgram.ts](../src/cli/helperProgram.ts):

1. Add `defaultsConfig: DefaultsConfigRuntime` to `HelperCliDeps`, constructed by `createDefaultsConfigRuntime()` in default dependencies. Keep it injectable for tests.
2. Add a root `--bundle <manifest>` option. Use Commander global-option access consistently so both `sdd-helper --bundle M validate ...` and `sdd-helper validate ... --bundle M` work. Do not add manifest paths to every domain request DTO or JSON mutation body.
3. Change `loadBundleContext` to accept the requested manifest and call the shared resolver. Conceptually:

```ts
const { repoRoot, workspace } = await loadWorkspaceContext(deps);
const explicitManifest = requestedManifest === undefined
  ? undefined
  : path.resolve(deps.cwd(), requestedManifest);
const { bundle, selection } = await loadSelectedBundle(
  deps.defaultsConfig,
  deps.loadBundle,
  explicitManifest,
  repoRoot
);
return { workspace, bundle, selection };
```

4. Pass the root option to every existing bundle-consuming command: `inspect`, `search`, `create`, `apply`, `author`, `undo`, `validate`, `project`, `preview`, and `contract --resolve bundle`. Audit all `loadBundleContext` callers rather than fixing only `validate`.
5. Keep bare help, `capabilities`, and static `contract` free of repository/config/bundle loading. `git-status` and `git-commit` still need workspace resolution but no bundle. Accepting a root option does not require loading it for these commands.
6. Classify configuration/loading failures through the existing `sdd-helper-error` lane with a nonzero exit. Preserve the underlying `config.*` identifier in diagnostics when available; retain the existing top-level helper error-code vocabulary. Do not turn a missing bundle into a successful validation payload.
7. Keep domain validation/mutation rejections in the existing structured result lane, including exit-zero behavior and `assessment.should_stop`. Do not use process exit alone to assert success in tests or skill instructions.

This change adopts the global **bundle** setting only. Keep current helper requirements for explicit profile/detail/request fields; do not silently redesign their defaults as part of this work.

### 7.2 Make creation metadata match the domain behavior

The existing `createDocument` implementation obtains a bootstrap from the supplied bundle. Its optional `--version` is an assertion: when supplied, it must equal the bootstrap's `default_effective_version`. Preserve that behavior. `--version` does not select a different bundle and does not mean “choose any version the parser can read.”

Implement these changes together:

- In [contracts.ts](../src/authoring/contracts.ts), change `CreateDocumentArgs.version?: "0.1"` to `version?: string`.
- In [contractMetadata.ts](../src/authoring/contractMetadata.ts), change the static `shared.shape.create_document_args` version property from enum `["0.1"]` to a string schema. Add a bundle binding for `/version` using the existing binding system.
- Proposed binding ID: `shared.binding.create_document.version`; shape: `shared.shape.create_document_args`; artifact: new `syntax_yaml`; selector: `document.version_declaration.default_effective_version`.
- Extend `ContractBindingSpec.bundle_source.artifact` and its published JSON schema to include `syntax_yaml`. Resolve that artifact through the existing [resolveBundleFieldReference](../src/bundle/bundleReferences.ts) mechanism with artifact `syntax`; convert a string result to a one-element `resolved_values` list. Reject unexpected values explicitly. No literal supported-language-version list belongs in this resolver.
- Add `bundle_resolved` to the helper create subject's `detail_modes`. Preserve request-purpose filtering so the binding is included in `contract helper.command.create --purpose request --resolve bundle`.
- Keep resolved structural schemas consistent with the existing contract architecture: the static schema says string; the binding exposes the active allowed value. Do not introduce a second enum-population implementation just for create.
- Update discovery/contract wording to say creation uses the selected bundle's default document version. Remove “Current implementation supports version 0.1.” Update request invocation templates to show the bundle override.

The resulting create request can normally omit `--version`. If supplied with an incompatible value, creation must reject before writing the target document, retaining existing rejection/journal conventions.

### 7.3 Expose actual bundle identity to callers

Extend bundle-resolved `ContractSubjectDetail.resolution` with:

```ts
manifest_path?: string;     // Absolute normalized path of the loaded manifest.
language_version?: string;  // From manifest.language_version.
```

Populate these alongside existing `bundle_name` and `bundle_version` in [contractResolution.ts](../src/authoring/contractResolution.ts). Update both the TypeScript shape and the reflected JSON schema in `contractMetadata.ts`. Static details leave these fields absent. Request-purpose details must preserve them. Document the path as local to the current host; it is not a portable document URI.

The skill uses `manifest_path` to pin later commands. The `Bundle` already contains `manifestPath` and `rootDir`; do not reconstruct its location from a version string. Tests using fake bundles must now supply these real contract fields rather than rely on casts that omit them.

In [authoringFormat.ts](../src/authoring/authoringFormat.ts), build syntax/vocabulary source references from `bundle.rootDir` plus `bundle.manifest.core.syntax` or `.vocab`. Emit normalized absolute filesystem paths with the existing `#/...` fragments. Remove the language-version directory inference and hidden `0.1` fallback. Apply this to format cards and diagnostic source references. Keep stable card IDs as discussed in section 4.4.

### 7.4 Keep discovery accurate and static

In [helperDiscovery.ts](../src/cli/helperDiscovery.ts), advertise the root bundle option and precedence without loading a bundle. Prefer one additive `global_options` field on `HelperCapabilitiesResult`, using the existing option-description shape, over duplicating the option entry for every command. Update any reflected schema/tests for that shape. Document that it applies to commands which consume a bundle; static discovery and git commands do not load one.

Update create's static support description, full and request-purpose invocation templates, the JSON help stub where needed, and [the helper guide](doc_site/sdd-helper/index.md). Check `shouldReturnHelperHelp` and Commander parsing for options before/after commands; do not let help/discovery accidentally read a broken global configuration.

### 7.5 Helper tests

Use [helperCli.spec.ts](../tests/helperCli.spec.ts), [helperCli.integration.spec.ts](../tests/helperCli.integration.spec.ts), [authoringContractMetadata.spec.ts](../tests/authoringContractMetadata.spec.ts), and [authoringContractResolution.spec.ts](../tests/authoringContractResolution.spec.ts).

- Unit dependency factories must inject a defaults runtime. Static help/contracts/capabilities and git-only calls must not read it or load a bundle.
- Integration child processes must receive isolated configuration locations. On this WSL/Linux setup, set a temporary `XDG_CONFIG_HOME` in the child environment; keep any macOS/Windows harness paths isolated using the existing config runtime's platform rules. Never rewrite the developer's actual defaults.
- Existing v0.1 document tests should pass an explicit v0.1 manifest. Add a compact lifecycle for both versions: create, author a minimal valid node using the returned revision, inspect, validate, project, preview, dry-run/apply, and undo. Choose one existing staged view and valid fixture content; broad renderer golden regeneration is unnecessary.
- Check both CLI positions for `--bundle`, relative paths from nested directories, global preference selection, fallback selection, explicit override, missing bundle, manifest-version mismatch, and malformed global config.
- Check that create's static schema is version-neutral, its resolved binding returns the selected creation version, omission creates that version, and an incompatible explicit `--version` rejects before document creation.
- Verify full and request-purpose contract identity, source-reference paths, and static metadata immutability after resolving v0.1 then v0.2.

## 8. Target 4: `sdd-skill`

The canonical source is [skills/sdd-skill/](../skills/sdd-skill/). Update the tracked source before copying it into an installed location. Keep the main skill brief; put the detailed selection workflow into [references/workflow.md](../skills/sdd-skill/references/workflow.md).

### 8.1 Select and retain the bundle for a task

Teach this sequence using existing helper introspection, with no extra discovery command:

1. Resolve the helper executable using the current repository-wrapper/installed-wrapper rules. Read capabilities as currently required.
2. If the user specified a manifest, pass it explicitly. If they specified a shipped language version, resolve and verify the corresponding manifest in this repository. For an existing document with a known declared version, select its matching available bundle explicitly. Do not rewrite the header to make a default selection pass. If the version or manifest is unclear, expose the mismatch and resolve it before mutation.
3. If no version was requested for a new document, let the helper use the saved/global fallback selection for the initial bundle-resolved contract request.
4. Read `resolution.manifest_path` from that response and use that absolute path on every later bundle-consuming helper command. This prevents a changed personal default from redirecting the middle of the workflow.
5. Follow the loaded manifest's relative file references when reading syntax, vocabulary, endpoint rules, authoring metadata, profiles, or views. Replace hardcoded `bundle/v0.1/` language-authority instructions with this rule; do not mechanically replace them with `bundle/v0.2/`.
6. Use the same explicit manifest with `sdd show` for saved artifacts. Keep existing helper-preview versus saved-artifact guidance and explicit profile/detail values.

Proposed workflow commands after implementation (`<helper>`, `<manifest>`, and `<document>` are explanatory placeholders):

```text
<helper> contract helper.command.create --purpose request --resolve bundle
<helper> --bundle <manifest> create <document>
<helper> --bundle <manifest> contract helper.command.author --purpose request --resolve bundle
<helper> --bundle <manifest> author --request <request-file>
<helper> --bundle <manifest> validate <document> --profile <profile-id>
sdd show <document> --bundle <manifest> --view <view-id> --profile <profile-id> --detail <detail-id>
```

If a manifest is already known, use it on the initial contract request too. For existing-document work, obtain a bundle-resolved contract relevant to that operation, then pin its manifest before `inspect` or mutation. Search across versions requires explicit separate bundle selections as described in section 4.1.

Keep dry-run/commit, returned-revision continuation, handle validity, and `assessment` rules. Do not add a blanket user confirmation solely for bundle discovery. Do not guess helper support from a package version or an example's content.

Pinning a manifest path prevents global preference drift; it does not freeze that file's contents. Existing Guided Addition fingerprint protections remain in force. This preparation does not add a new cross-process transaction protocol to every helper request. After an intentional bundle edit, refresh contract discovery and rerun the relevant dry run.

### 8.2 Wrapper and installed copies

In [run_helper.sh](../skills/sdd-skill/scripts/run_helper.sh):

- Use the version-neutral repo marker from section 4.3.
- Continue forwarding all arguments with `"$@"`; do not choose or override a bundle in Bash.
- Preserve the caller's directory through the existing `INIT_CWD`/launcher-cwd convention. The current pnpm script invocation overwrites an inherited `INIT_CWD`; exporting it before `pnpm sdd-helper` is insufficient. Capture the caller directory before any `cd`, then invoke the repository's built Node entrypoint directly after runtime setup, as shown below. This runs the same helper code as the package script.
- Keep `TMPDIR=/tmp`, existing Node/Corepack setup, and JSON stdout behavior. Diagnostics from setup belong on stderr.

Concrete wrapper structure, with existing repository discovery and runtime setup retained between these lines:

```bash
caller_cwd="$(pwd -P)"
# Existing repository discovery and Node/runtime setup run here.
export INIT_CWD="$caller_cwd"
exec node "$repo_root/dist/cli/helperMain.js" "$@"
```

Run `pnpm run build` before wrapper integration checks, as for the current helper. Do not add an automatic build that mixes compiler output into the helper's JSON stdout. Verify the wrapper's caller-relative manifest behavior in a spawned process; absolute paths from contract resolution should be used for subsequent skill calls.

Update [SKILL.md](../skills/sdd-skill/SKILL.md), [workflow.md](../skills/sdd-skill/references/workflow.md), [current-helper-gaps.md](../skills/sdd-skill/references/current-helper-gaps.md), relevant [recipes](../skills/sdd-skill/references/change-set-recipes.md), and the [published skill guide](doc_site/sdd-skill/index.md). Remove the v0.1-only creation limit after the helper tests pass.

The published installation flow copies the tracked skill folder into `$CODEX_HOME/skills/sdd-skill`. Repository changes do not update existing installations automatically. Refresh the installed copy using that documented flow when deploying this change, then reload the host. Inspect local customizations before overwriting a separately maintained installed copy. Do not claim the installed skill is updated after editing only the repository source.

### 8.3 Skill verification

Update relevant expectations in [sddSkillSource.spec.ts](../tests/sddSkillSource.spec.ts), especially assertions that currently require v0.1 authority text. Keep helper capability/command-list agreement checks. Do not turn every new sentence into an exact-string test.

Run the wrapper from the repository root, a nested directory, and an installed-style temporary copy outside the repository. Verify explicit selection and preservation of caller-relative manifest paths. Then perform one v0.2 create/author/validate/project/preview sequence through the wrapper in a temporary workspace. Confirm `assessment` success and effective version, not just exit codes. Repeat the small compatibility path with v0.1.

## 9. Tests that prove real bundle awareness

Tests using only the shipped bundles can miss a fixed v0.1 load because both versions currently have the same vocabulary and behavior. Use explicit selection assertions plus targeted bundle mutation proofs.

| Proof | Change in a test-only bundle | Observable result |
| --- | --- | --- |
| Creation version | Change the default document version and all related version constraints consistently in a temporary bundle. Keep its directory deliberately unrelated to its language version. | Create metadata and emitted bootstrap reflect that bundle; reported source paths still point to its actual files. |
| Guided form | Change an existing node form's label/default in `core/authoring.yaml`, keeping the bundle valid. | The catalog and rendered prompt show the changed value through the same Guided Addition pipeline. |
| Highlighting | Add a test-only vocabulary token to an in-memory bundle, as existing tests already do. | Tokenization assigns the intended scope only for assets generated from the changed bundle. |
| Helper contract | Change bundle-defined view/profile/detail IDs consistently in a valid temporary bundle. | Resolved contract bindings expose changed values; unchanged v0.1 remains unchanged. |
| Parser behavior | Change a syntax field supported by the generic syntax runtime in a valid test bundle. | Source acceptance or formatting guidance changes through the loaded syntax contract, without an adapter branch. |

For adapter-selection proofs, write a valid temporary bundle and load it through the real entrypoint; an injected `loadBundle` that returns the same object regardless of the requested path is insufficient. For pure builder/catalog mutation proofs, a structured clone is appropriate. Keep synthetic language identifiers in tests only; do not add them to production bundles.

Do not add a real v0.2 feature just to prove this plumbing. Do not refresh snapshots or renderer goldens to conceal an incorrect bundle selection. Existing [compile](../tests/compile.spec.ts) and [projection](../tests/projectionSnapshots.spec.ts) baselines already run both versions and remain part of acceptance.

## 10. Implementation order and gates

Implement in this order. Each step should leave its focused checks passing before moving on.

1. **Shared selection and discovery:** version-neutral repo detection; reconcile the existing fallback test and help wording; isolate test configuration. Gate: selection precedence, nested paths, and repositories without v0.1 work as specified.
2. **Guided Addition verification:** add explicit two-version scripted scenarios and pin older fixtures. Gate: creation, edit, Cancel, mismatched-version rejection, and existing fingerprint checks pass.
3. **Helper selection and contracts:** root override, shared defaults runtime, create binding, resolved identity, correct artifact source paths, static discovery updates. Gate: every bundle-backed command receives the selected bundle; create/contract behavior and error lanes agree.
4. **Highlighting:** generator flags, deterministic default, output directory, packaging filename, tests, then checked-in assets. Gate: both bundles and a changed test bundle tokenize correctly; personal preferences cannot change generated output.
5. **Skill and documentation:** pin the resolved manifest, update wrapper and workflow references, exercise a real workflow, then document/install the updated source as appropriate. Gate: helper operations and saved rendering use the same bundle.

Suggested focused checks, from the repository root after the respective changes:

```bash
TMPDIR=/tmp pnpm run build
TMPDIR=/tmp pnpm exec vitest run tests/bundleDefaults.spec.ts tests/cliDefaults.spec.ts tests/guidedAdditionCli.spec.ts
TMPDIR=/tmp pnpm exec vitest run tests/authoringContractMetadata.spec.ts tests/authoringContractResolution.spec.ts tests/helperCli.spec.ts tests/helperCli.integration.spec.ts
TMPDIR=/tmp pnpm exec vitest run tests/sddTextMate.spec.ts tests/sddSkillSource.spec.ts tests/compile.spec.ts tests/projectionSnapshots.spec.ts
```

Include any newly introduced generator/wrapper integration files in the focused runs. The initial build matters because subprocess integration tests invoke `dist/cli/helperMain.js`. Run `TMPDIR=/tmp pnpm test` once for the completed cross-cutting implementation; investigate failures and distinguish pre-existing ones without weakening checks. Run `docs:build` if published documentation or generated grammar integration changes. All commands above are implementation-time gates, not evidence that this proposal has already passed them.

Completion evidence should state:

- Which manifest each target selected in the explicit, global, and fallback cases.
- Which v0.1/v0.2 workflows passed and which test-only bundle change proved runtime dependence.
- Whether the installed skill was refreshed or only the canonical repository source was updated.
- Whether any acceptance invariant remains violated. Report incomplete work plainly; passing unchanged snapshots alone is not sufficient.

## 11. Boundaries for the implementing model

- Do not perform a repository-wide `0.1` to `0.2` replacement. Historical definitions, compatibility fixtures, helper protocol versions, and versioned examples have distinct purposes.
- Do not remove v0.1 tests or make all fixtures rely on the current global default.
- Do not infer support from equal current outputs. Verify actual selection and mutated bundle behavior.
- Do not add automatic version conversion, mixed-version search routing, or multi-version editor grammars as part of this preparation.
- Do not move bundle rules into CLI flags, shell scripts, skill prose, or TypeScript identifier tables. Tool options select bundles; bundle data selects language behavior.
- Preserve the projection boundary and renderer outputs. This task does not require renderer migration, font relocation, or changes to legacy rendering.
- Preserve static introspection without loading a repo. Extend existing helper metadata rather than adding an alternate discovery API.
- If a future language feature exceeds what the bundle/runtime can express, stop and extend that contract through its generic loader/runtime path before implementing adapter support.
